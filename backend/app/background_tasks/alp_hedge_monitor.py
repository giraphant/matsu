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
    "BONK": ("8aJuzsgjxBnvRhDcfQBD7z4CUj7QoPEpaNwVd7KqsSk5", 5),
    "JITOSOL": ("GZ9XfWwgTRhkma2Y91Q9r1XKotNXYjBnKKabj19rhT71", 9),
    "WBTC": ("GFu3qS22mo6bAjg4Lr5R7L8pPgHq6GvbjJPKEHkbbs2c", 8),
}

# Oracle symbol offsets for price data (符号位置，价格在符号-32字节处)
ORACLE_SYMBOL_OFFSETS = {
    "SOL": 56,      # 需要SOL价格来换算JITOSOL
    "BONK": 312,
    "JITOSOL": 120,
    "WBTC": 248,
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
        """Get prices from oracle account (符号-32字节, 除以1e10)"""
        try:
            from solders.pubkey import Pubkey

            oracle_pubkey = Pubkey.from_string(ORACLE_ACCOUNT)
            response = await client.get_account_info(oracle_pubkey)

            if not response.value or not response.value.data:
                raise ValueError("Failed to get oracle data")

            data = bytes(response.value.data)

            max_offset = max(ORACLE_SYMBOL_OFFSETS.values())
            if len(data) < max_offset + 8:
                raise ValueError(f"Insufficient oracle data length: {len(data)}")

            prices = {}
            for symbol, symbol_offset in ORACLE_SYMBOL_OFFSETS.items():
                price_offset = symbol_offset - 32  # 价格在符号-32字节处
                raw_price = self._parse_u64(data, price_offset)
                price = raw_price / 1e10

                if price <= 0:
                    raise ValueError(f"Invalid price for {symbol}: {price}")

                prices[symbol] = price

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

    async def _get_custody_data(self, client, custody_addr: str, decimals: int, price: float) -> Dict[str, float]:
        """Read custody account assets and short position data"""
        try:
            from solders.pubkey import Pubkey

            pubkey = Pubkey.from_string(custody_addr)
            response = await client.get_account_info(pubkey)

            if not response.value or not response.value.data:
                raise ValueError(f"Failed to get custody: {custody_addr}")

            data = bytes(response.value.data)

            if len(data) < max(ASSETS_OFFSET + 24, SHORT_POSITION_OFFSET + 8):
                raise ValueError(f"Insufficient custody data length: {len(data)}")

            # Read assets field
            raw_owned = self._parse_u64(data, ASSETS_OFFSET + 8)
            raw_locked = self._parse_u64(data, ASSETS_OFFSET + 16)

            if raw_locked > raw_owned:
                raise ValueError("Invalid data: locked > owned")

            # Read SHORT Position USD value
            raw_short_usd = self._parse_u64(data, SHORT_POSITION_OFFSET)

            # Convert to token amounts
            owned = raw_owned / (10 ** decimals)
            locked = raw_locked / (10 ** decimals)
            short_usd = raw_short_usd / 1e6
            short_oi = short_usd / price if price > 0 else 0

            return {
                "owned": owned,
                "locked": locked,
                "short_oi": short_oi,
            }
        except Exception as e:
            logger.error(f"Error getting custody data for {custody_addr}: {e}")
            raise

    async def _calculate_hedge(self, alp_amount: float) -> Dict[str, Dict[str, float]]:
        """Calculate hedge amounts"""
        try:
            from solana.rpc.async_api import AsyncClient

            client = AsyncClient(RPC_URL)

            try:
                # Get oracle prices first
                prices = await self._get_oracle_prices(client)

                # Get total supply
                total_supply = await self._get_alp_supply(client)

                if total_supply <= 0:
                    raise ValueError(f"Invalid total supply: {total_supply}")

                hedge_positions = {}
                jitosol_to_sol_ratio = prices["JITOSOL"] / prices["SOL"]

                for symbol, (custody_addr, decimals) in CUSTODY_ACCOUNTS.items():
                    price = prices.get(symbol)
                    if not price:
                        raise ValueError(f"No price for {symbol}")

                    data = await self._get_custody_data(client, custody_addr, decimals, price)

                    net_exposure = data["owned"] - data["locked"] + data["short_oi"]
                    per_alp = net_exposure / total_supply
                    hedge_amount = per_alp * alp_amount

                    # JITOSOL转换为SOL
                    if symbol == "JITOSOL":
                        sol_amount = hedge_amount * jitosol_to_sol_ratio
                        if "SOL" in hedge_positions:
                            hedge_positions["SOL"]["amount"] += sol_amount
                            hedge_positions["SOL"]["per_alp"] += per_alp * jitosol_to_sol_ratio
                        else:
                            hedge_positions["SOL"] = {
                                "amount": sol_amount,
                                "per_alp": per_alp * jitosol_to_sol_ratio,
                            }
                    else:
                        hedge_positions[symbol] = {
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
                # Use BTC instead of WBTC for display
                display_symbol = "BTC" if symbol == "WBTC" else symbol

                hedge_data = WebhookData(
                    monitor_id=f'alp_hedge_{display_symbol}',
                    monitor_name=f'ALP {display_symbol} 对冲量',
                    value=data['amount'],
                    timestamp=timestamp
                )
                db.add(hedge_data)
                stored_count += 1

                logger.info(f"ALP Hedge {display_symbol}: {data['amount']:+.8f} (per ALP: {data['per_alp']:.10f})")

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
