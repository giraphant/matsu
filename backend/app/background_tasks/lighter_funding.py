"""
Lighter funding rate monitor.
Fetches BTC, ETH, SOL funding rates from Lighter and stores them in the database.
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


class LighterMonitor(BaseMonitor):
    """Monitor for Lighter funding rates."""

    def __init__(self):
        # Run every 5 minutes (300 seconds)
        super().__init__(name="Lighter Funding Rates", interval=300)
        self.api_url = "https://mainnet.zklighter.elliot.ai/api/v1/funding-rates"

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
        """Fetch funding rates from Lighter API."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    self.api_url,
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    }
                )
                response.raise_for_status()
                data = response.json()
                return data.get("funding_rates", [])

        except Exception as e:
            logger.error(f"Error fetching rates: {e}")
            return []

    async def _store_rates(self, rates: List[Dict[str, Any]]) -> int:
        """Store funding rates in database."""
        db = get_db_session()
        stored_count = 0

        try:
            for entry in rates:
                symbol = entry.get("symbol", "").upper()
                exchange = entry.get("exchange", "lighter").lower()
                rate = entry.get("rate")

                # Only process 'lighter' exchange
                if exchange != "lighter":
                    continue

                # Only process target symbols
                if symbol not in TARGET_SYMBOLS:
                    continue

                # Skip if no rate available
                if rate is None:
                    continue

                # Convert rate to float
                rate_value = float(rate)

                # Annualize the 8-hour rate
                annualized_rate = self._annualize_rate(rate_value)

                # Create funding rate entry
                new_rate = FundingRate(
                    exchange='lighter',
                    symbol=symbol,
                    rate=rate_value,
                    annualized_rate=annualized_rate,
                    next_funding_time=None,  # Lighter doesn't provide this in current API
                    mark_price=None,  # Not available in current API response
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
    def _annualize_rate(rate_8h: float) -> float:
        """
        Convert 8-hour funding rate to annualized percentage.

        Args:
            rate_8h: 8-hour funding rate (e.g., 0.0001 = 0.01%)

        Returns:
            Annualized rate in percentage (e.g., 10.95 = 10.95% APY)
        """
        # 8-hour rate * 3 (per day) * 365 (per year) * 100 (to percentage)
        return rate_8h * 3 * 365 * 100
