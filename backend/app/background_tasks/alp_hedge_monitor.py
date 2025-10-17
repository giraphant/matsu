"""
ALP Hedge Position Monitor
Calculates required hedge positions based on ALP holdings and stores in database.

Formula: hedge = (owned - locked + shortOI) / totalSupply × alpAmount
"""

import asyncio
import struct
from datetime import datetime
from typing import Dict, Any
import os

from app.core.logger import get_logger
from app.models.database import WebhookData, AppSetting, get_db_session
from app.background_tasks.base import BaseMonitor

logger = get_logger(__name__)

# ALP Configuration
ALP_MINT = "4yCLi5yWGzpTWMQ1iWHG5CrGYAdBkhyEdsuSugjDUqwj"
ORACLE_ACCOUNT = "GEm9TZP7BL8rTz1JDy6X74PL595zr1putA9BXC8ehDmU"
RPC_URL = "https://api.mainnet-beta.solana.com"
ASSETS_OFFSET = 368
SHORT_POSITION_OFFSET = 600

CUSTODY_ACCOUNTS = {
    "BONK": ("9n5qQNwjnYH9763vF9LForC37XZhb7pDsMGBDKWLpump", 5),
    "JITOSOL": ("DzKfaYgdbuM8cHaJRrFF7EqB6fJ7Y8sjYLBmpYiH8NrW", 9),
    "WBTC": ("3FJuhXYYPn2PTpLBRzG8Ci8SDfDdJtGpTHS1g9k22nqr", 8),
}

# Oracle symbol offsets for price data
ORACLE_SYMBOL_OFFSETS = {
    "JITOSOL": 0,
    "SOL": 1,
    "BONK": 2,
    "WBTC": 3,
}


class ALPHedgeMonitor(BaseMonitor):
    """Monitor for ALP hedge position calculations."""

    def __init__(self):
        # Run every 60 seconds (1 minute)
        super().__init__(name="ALP Hedge Calculator", interval=60)
        logger.info("ALP Hedge Monitor initialized (reads ALP amount from database)")

    def _get_alp_amount(self) -> float:
        """Get ALP amount from database settings."""
        db = get_db_session()
        try:
            setting = db.query(AppSetting).filter(AppSetting.key == "alp_amount").first()
            if setting:
                return float(setting.value)
            return 0.0
        except Exception as e:
            logger.error(f"Error reading ALP amount from database: {e}")
            return 0.0
        finally:
            db.close()

    async def run(self) -> None:
        """Calculate and store hedge positions for one iteration."""

        # Read ALP amount from database
        alp_amount = self._get_alp_amount()

        if alp_amount <= 0:
            logger.debug("ALP amount is 0, skipping hedge calculation")
            return

        logger.debug(f"Calculating ALP hedge positions for {alp_amount:,.2f} ALP...")

        try:
            # Calculate hedge positions
            hedge_positions = await self._calculate_hedge(alp_amount)

            if not hedge_positions:
                logger.warning("No hedge positions calculated")
                return

            # Store data
            stored_count = await self._store_hedge_data(hedge_positions)
            logger.info(f"Stored {stored_count} ALP hedge positions")

        except Exception as e:
            logger.error(f"Error in ALP hedge monitor: {e}", exc_info=True)

    def _parse_u64(self, data: bytes, offset: int) -> int:
        """Parse little-endian u64"""
        return struct.unpack('<Q', data[offset:offset+8])[0]

    async def _get_oracle_prices(self, client) -> Dict[str, float]:
        """Get prices from oracle account"""
        try:
            from solders.pubkey import Pubkey

            oracle_pubkey = Pubkey.from_string(ORACLE_ACCOUNT)
            response = await client.get_account_info(oracle_pubkey)

            if not response.value or not response.value.data:
                raise ValueError("Failed to get oracle account")

            data = bytes(response.value.data)
            prices = {}

            # Extract prices for each symbol
            for symbol, offset in ORACLE_SYMBOL_OFFSETS.items():
                price_offset = 8 + offset * 8  # 8 bytes header + symbol offset
                raw_price = self._parse_u64(data, price_offset)
                prices[symbol] = raw_price / 1e10  # Price is stored with 10 decimals

            return prices

        except Exception as e:
            logger.error(f"Error getting oracle prices: {e}")
            raise

    async def _get_alp_supply(self, client) -> float:
        """Get ALP total supply"""
        try:
            from solders.pubkey import Pubkey

            mint = Pubkey.from_string(ALP_MINT)
            response = await client.get_token_supply(mint)

            if response.value:
                amount = float(response.value.amount)
                decimals = response.value.decimals
                return amount / (10 ** decimals)

            raise ValueError("Failed to get ALP supply")
        except Exception as e:
            logger.error(f"Error getting ALP supply: {e}")
            raise

    async def _get_custody_data(self, client, custody_addr: str, decimals: int) -> Dict[str, float]:
        """Read custody account assets and short position data"""
        try:
            from solders.pubkey import Pubkey

            pubkey = Pubkey.from_string(custody_addr)
            response = await client.get_account_info(pubkey)

            if not response.value or not response.value.data:
                raise ValueError(f"Failed to get custody: {custody_addr}")

            data = bytes(response.value.data)

            # Read assets field (at ASSETS_OFFSET)
            if len(data) < ASSETS_OFFSET + 24:
                raise ValueError(f"Insufficient data length for assets: {len(data)}")

            raw_owned = self._parse_u64(data, ASSETS_OFFSET)
            raw_locked = self._parse_u64(data, ASSETS_OFFSET + 8)

            if raw_locked > raw_owned:
                raise ValueError("Invalid data: locked > owned")

            # Read short position data (at SHORT_POSITION_OFFSET)
            if len(data) < SHORT_POSITION_OFFSET + 16:
                raise ValueError(f"Insufficient data length for shorts: {len(data)}")

            raw_short_sizes = self._parse_u64(data, SHORT_POSITION_OFFSET)
            raw_short_prices = self._parse_u64(data, SHORT_POSITION_OFFSET + 8)

            # Convert to token amounts
            owned = raw_owned / (10 ** decimals)
            locked = raw_locked / (10 ** decimals)
            short_oi = raw_short_sizes / raw_short_prices if raw_short_prices > 0 else 0

            return {
                "owned": owned,
                "locked": locked,
                "short_oi": short_oi,
            }
        except Exception as e:
            logger.error(f"Error getting custody data for {custody_addr}: {e}")
            raise

    async def _calculate_hedge(self, alp_amount: float) -> Dict[str, Dict[str, float]]:
        """Calculate hedge amounts (excluding stablecoins)"""
        try:
            from solana.rpc.async_api import AsyncClient

            client = AsyncClient(RPC_URL)

            try:
                # Get oracle prices first (needed for JITOSOL->SOL conversion)
                prices = await self._get_oracle_prices(client)

                # Get total supply
                total_supply = await self._get_alp_supply(client)

                if total_supply <= 0:
                    raise ValueError(f"Invalid total supply: {total_supply}")

                hedge_positions = {}
                jitosol_hedge = None

                for symbol, (custody_addr, decimals) in CUSTODY_ACCOUNTS.items():
                    data = await self._get_custody_data(client, custody_addr, decimals)

                    # ALP formula: no fees component
                    net_exposure = data["owned"] - data["locked"] + data["short_oi"]
                    per_alp = net_exposure / total_supply
                    hedge_amount = per_alp * alp_amount

                    # Special handling for JITOSOL - convert to SOL
                    if symbol == "JITOSOL":
                        jitosol_hedge = hedge_amount
                        # Convert JITOSOL to SOL using price ratio
                        if "JITOSOL" in prices and "SOL" in prices and prices["SOL"] > 0:
                            sol_equivalent = hedge_amount * (prices["JITOSOL"] / prices["SOL"])
                            hedge_positions["SOL"] = {
                                "amount": sol_equivalent,
                                "per_alp": sol_equivalent / alp_amount,
                            }
                            logger.debug(f"JITOSOL {hedge_amount:.8f} -> SOL {sol_equivalent:.8f}")
                    else:
                        # Use BTC instead of WBTC for display
                        display_symbol = "BTC" if symbol == "WBTC" else symbol
                        hedge_positions[display_symbol] = {
                            "amount": hedge_amount,
                            "per_alp": per_alp,
                        }

                return hedge_positions

            finally:
                await client.close()

        except ImportError as e:
            logger.error(f"Missing required package: {e}. Install with: pip install solana solders")
            return {}
        except Exception as e:
            logger.error(f"Error calculating hedge positions: {e}", exc_info=True)
            return {}

    async def _store_hedge_data(self, hedge_positions: Dict[str, Dict[str, float]]) -> int:
        """Store hedge position data in database."""
        db = get_db_session()
        stored_count = 0

        try:
            timestamp = datetime.utcnow()

            # Store each hedge position
            for symbol, data in hedge_positions.items():
                hedge_data = WebhookData(
                    monitor_id=f'alp_hedge_{symbol}',
                    monitor_name=f'ALP {symbol} 对冲量',
                    value=data['amount'],
                    timestamp=timestamp
                )
                db.add(hedge_data)
                stored_count += 1

                logger.info(f"ALP Hedge {symbol}: {data['amount']:+.8f} (per ALP: {data['per_alp']:.10f})")

            db.commit()
            return stored_count

        except Exception as e:
            logger.error(f"Error storing ALP hedge data: {e}")
            db.rollback()
            return 0

        finally:
            db.close()


def get_monitor():
    """Factory function to create monitor instance"""
    return ALPHedgeMonitor()
