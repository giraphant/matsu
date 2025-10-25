"""
Hyperliquid funding rate monitor.
Fetches BTC, ETH, SOL funding rates from Hyperliquid and stores them in the database.
"""

from datetime import datetime
from typing import List, Dict, Any
import httpx

from app.core.logger import get_logger
from app.models.database import FundingRate, get_db_session
from app.background_tasks.base import BaseMonitor

logger = get_logger(__name__)


# Target symbols to monitor
TARGET_SYMBOLS = ["BTC", "ETH", "SOL"]


class HyperliquidMonitor(BaseMonitor):
    """Monitor for Hyperliquid funding rates."""

    def __init__(self):
        # Run every 5 minutes (300 seconds)
        super().__init__(name="Hyperliquid Funding Rates", interval=300)
        self.api_url = "https://api.hyperliquid.xyz/info"

    async def run(self) -> None:
        """Fetch and store funding rates for one iteration."""
        logger.debug(f"Fetching funding rates...")

        rates = await self._fetch_funding_rates()

        if not rates:
            logger.warning(f"No rates fetched")
            return

        stored_count = await self._store_rates(rates)
        logger.info(f"Stored {stored_count} funding rates")

    async def _fetch_funding_rates(self) -> List[Dict[str, Any]]:
        """Fetch funding rates from Hyperliquid API."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Get metadata to find coin indices
                meta_response = await client.post(
                    self.api_url,
                    json={"type": "metaAndAssetCtxs"}
                )
                meta_response.raise_for_status()
                meta_data = meta_response.json()

                # Extract asset contexts which contain funding info
                rates = []
                for asset_ctx in meta_data[0].get("universe", []):
                    coin_name = asset_ctx.get("name", "")

                    # Only process target symbols
                    if coin_name not in TARGET_SYMBOLS:
                        continue

                    # Get funding rate (predicted, normalized to 1 hour)
                    funding = asset_ctx.get("funding")
                    if not funding:
                        continue

                    # Extract mark price and funding rate
                    mark_px = asset_ctx.get("markPx")

                    rates.append({
                        "symbol": coin_name,
                        "funding": funding,  # 1-hour rate
                        "mark_price": mark_px
                    })

                return rates

        except Exception as e:
            logger.error(f"Error fetching rates: {e}")
            return []

    async def _store_rates(self, rates: List[Dict[str, Any]]) -> int:
        """Store funding rates in database."""
        db = get_db_session()
        stored_count = 0

        try:
            for entry in rates:
                symbol = entry.get("symbol")
                funding_1h = entry.get("funding")
                mark_price = entry.get("mark_price")

                if funding_1h is None:
                    continue

                # Convert to float
                rate_1h = float(funding_1h)

                # Convert 1-hour rate to 8-hour rate for consistency
                rate_8h = rate_1h * 8

                # Annualize the rate
                annualized_rate = self._annualize_rate_from_1h(rate_1h)

                # Convert mark price
                mark_price_value = float(mark_price) if mark_price else None

                # Create funding rate entry
                new_rate = FundingRate(
                    exchange='hyperliquid',
                    symbol=symbol,
                    rate=rate_8h,  # Store as 8-hour equivalent
                    annualized_rate=annualized_rate,
                    next_funding_time=None,  # Hyperliquid doesn't provide explicit next funding time
                    mark_price=mark_price_value,
                    timestamp=datetime.utcnow()
                )

                db.add(new_rate)
                stored_count += 1

            db.commit()
            return stored_count

        except Exception as e:
            logger.error(f"Error storing rates: {e}")
            db.rollback()
            return 0

        finally:
            db.close()

    @staticmethod
    def _annualize_rate_from_1h(rate_1h: float) -> float:
        """
        Convert 1-hour funding rate to annualized percentage.

        Args:
            rate_1h: 1-hour funding rate

        Returns:
            Annualized rate in percentage
        """
        # 1-hour rate * 24 (per day) * 365 (per year) * 100 (to percentage)
        return rate_1h * 24 * 365 * 100
