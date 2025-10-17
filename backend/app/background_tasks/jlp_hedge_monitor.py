"""
JLP Hedge Position Monitor
Calculates required hedge positions based on JLP holdings and stores in database.

Formula: hedge = (owned - locked + shortOI + fees×0.75) / totalSupply × jlpAmount
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

# JLP Configuration
JLP_MINT = "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4"
RPC_URL = "https://api.mainnet-beta.solana.com"
ASSETS_OFFSET = 214
FEES_USER_SHARE = 0.75

CUSTODY_ACCOUNTS = {
    "SOL": ("7xS2gz2bTp3fwCC7knJvUWTEU9Tycczu6VhJYKgi1wdz", 9),
    "ETH": ("AQCGyheWPLeo6Qp9WpYS9m3Qj479t7R636N9ey1rEjEn", 8),
    "WBTC": ("5Pv3gM9JrFFH883SWAhvJC9RPYmo8UNxuFtv5bMMALkm", 8),
    "USDC": ("G18jKKXQwBbrHeiK3C9MRXhkHsLHf7XgCSisykV46EZa", 6),
    "USDT": ("4vkNeXiYEUizLdrpdPS1eC2mccyM4NUPRtERrk6ZETkk", 6),
}

STABLECOINS = {"USDC", "USDT"}


class JLPHedgeMonitor(BaseMonitor):
    """Monitor for JLP hedge position calculations."""

    def __init__(self):
        # Run every 60 seconds (1 minute)
        super().__init__(name="JLP Hedge Calculator", interval=60)
        logger.info("JLP Hedge Monitor initialized (reads JLP amount from database)")

    def _get_jlp_amount(self) -> float:
        """Get JLP amount from database settings."""
        db = get_db_session()
        try:
            setting = db.query(AppSetting).filter(AppSetting.key == "jlp_amount").first()
            if setting:
                return float(setting.value)
            return 0.0
        except Exception as e:
            logger.error(f"Error reading JLP amount from database: {e}")
            return 0.0
        finally:
            db.close()

    async def run(self) -> None:
        """Calculate and store hedge positions for one iteration."""

        # Read JLP amount from database
        jlp_amount = self._get_jlp_amount()

        if jlp_amount <= 0:
            logger.debug("JLP amount is 0, skipping hedge calculation")
            return

        logger.debug(f"Calculating JLP hedge positions for {jlp_amount:,.2f} JLP...")

        try:
            # Calculate hedge positions
            hedge_positions = await self._calculate_hedge(jlp_amount)

            if not hedge_positions:
                logger.warning("No hedge positions calculated")
                return

            # Store data
            stored_count = await self._store_hedge_data(hedge_positions)
            logger.info(f"Stored {stored_count} JLP hedge positions")

        except Exception as e:
            logger.error(f"Error in JLP hedge monitor: {e}", exc_info=True)

    def _parse_u64(self, data: bytes, offset: int) -> int:
        """Parse little-endian u64"""
        return struct.unpack('<Q', data[offset:offset+8])[0]

    async def _get_jlp_supply(self, client) -> float:
        """Get JLP total supply"""
        try:
            from solders.pubkey import Pubkey

            mint = Pubkey.from_string(JLP_MINT)
            response = await client.get_token_supply(mint)

            if response.value:
                amount = float(response.value.amount)
                decimals = response.value.decimals
                return amount / (10 ** decimals)

            raise ValueError("Failed to get JLP supply")
        except Exception as e:
            logger.error(f"Error getting JLP supply: {e}")
            raise

    async def _get_custody_data(self, client, custody_addr: str, decimals: int) -> Dict[str, float]:
        """Read custody account assets field"""
        try:
            from solders.pubkey import Pubkey

            pubkey = Pubkey.from_string(custody_addr)
            response = await client.get_account_info(pubkey)

            if not response.value or not response.value.data:
                raise ValueError(f"Failed to get custody: {custody_addr}")

            data = bytes(response.value.data)

            if len(data) < ASSETS_OFFSET + 48:
                raise ValueError(f"Insufficient data length: {len(data)}")

            # Read assets field (6 consecutive u64)
            raw_fees = self._parse_u64(data, ASSETS_OFFSET)
            raw_owned = self._parse_u64(data, ASSETS_OFFSET + 8)
            raw_locked = self._parse_u64(data, ASSETS_OFFSET + 16)
            raw_short_sizes = self._parse_u64(data, ASSETS_OFFSET + 32)
            raw_short_prices = self._parse_u64(data, ASSETS_OFFSET + 40)

            if raw_locked > raw_owned:
                raise ValueError("Invalid data: locked > owned")

            # Convert to token amounts
            owned = raw_owned / (10 ** decimals)
            locked = raw_locked / (10 ** decimals)
            fees = (raw_fees / (10 ** decimals)) * FEES_USER_SHARE
            short_oi = raw_short_sizes / raw_short_prices if raw_short_prices > 0 else 0

            return {
                "owned": owned,
                "locked": locked,
                "fees": fees,
                "short_oi": short_oi,
            }
        except Exception as e:
            logger.error(f"Error getting custody data for {custody_addr}: {e}")
            raise

    async def _calculate_hedge(self, jlp_amount: float) -> Dict[str, Dict[str, float]]:
        """Calculate hedge amounts (excluding stablecoins)"""
        try:
            from solana.rpc.async_api import AsyncClient

            client = AsyncClient(RPC_URL)

            try:
                total_supply = await self._get_jlp_supply(client)

                if total_supply <= 0:
                    raise ValueError(f"Invalid total supply: {total_supply}")

                hedge_positions = {}

                for symbol, (custody_addr, decimals) in CUSTODY_ACCOUNTS.items():
                    if symbol in STABLECOINS:
                        continue

                    data = await self._get_custody_data(client, custody_addr, decimals)
                    net_exposure = data["owned"] - data["locked"] + data["short_oi"] + data["fees"]
                    per_jlp = net_exposure / total_supply
                    hedge_amount = per_jlp * jlp_amount

                    # Use BTC instead of WBTC for display
                    display_symbol = "BTC" if symbol == "WBTC" else symbol

                    hedge_positions[display_symbol] = {
                        "amount": hedge_amount,
                        "per_jlp": per_jlp,
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
                    monitor_id=f'jlp_hedge_{symbol}',
                    monitor_name=f'JLP {symbol} 对冲量',
                    value=data['amount'],
                    timestamp=timestamp
                )
                db.add(hedge_data)
                stored_count += 1

                logger.info(f"JLP Hedge {symbol}: {data['amount']:+.8f} (per JLP: {data['per_jlp']:.10f})")

            db.commit()
            return stored_count

        except Exception as e:
            logger.error(f"Error storing JLP hedge data: {e}")
            db.rollback()
            return 0

        finally:
            db.close()


def get_monitor():
    """Factory function to create monitor instance"""
    return JLPHedgeMonitor()
