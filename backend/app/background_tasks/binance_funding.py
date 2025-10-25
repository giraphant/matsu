"""
Binance funding rate monitor.
Fetches BTC, ETH, SOL funding rates from Binance and stores them in the database.
"""

from datetime import datetime
from typing import List, Dict, Any
import httpx

from app.core.logger import get_logger
from app.models.database import FundingRate, get_db_session
from app.background_tasks.base import BaseMonitor

logger = get_logger(__name__)


# Target symbols to monitor (Binance uses USDT pairs)
TARGET_SYMBOLS = {
    "BTCUSDT": "BTC",
    "ETHUSDT": "ETH",
    "SOLUSDT": "SOL"
}


class BinanceMonitor(BaseMonitor):
    """Monitor for Binance funding rates."""

    def __init__(self):
        # Run every 5 minutes (300 seconds)
        super().__init__(name="Binance Funding Rates", interval=300)
        self.api_url = "https://fapi.binance.com/fapi/v1/premiumIndex"

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
        """Fetch funding rates from Binance API."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(self.api_url)
                response.raise_for_status()
                data = response.json()

                # Filter for our target symbols
                filtered_rates = []
                for item in data:
                    symbol = item.get("symbol")
                    if symbol in TARGET_SYMBOLS:
                        filtered_rates.append(item)

                return filtered_rates

        except Exception as e:
            logger.error(f"Error fetching rates: {e}")
            return []

    async def _store_rates(self, rates: List[Dict[str, Any]]) -> int:
        """Store funding rates in database."""
        db = get_db_session()
        stored_count = 0

        try:
            for entry in rates:
                binance_symbol = entry.get("symbol")

                # Map Binance symbol to our standard symbol
                if binance_symbol not in TARGET_SYMBOLS:
                    continue

                symbol = TARGET_SYMBOLS[binance_symbol]

                # Get last funding rate
                last_funding_rate = entry.get("lastFundingRate")
                if last_funding_rate is None:
                    continue

                # Convert to float
                rate_value = float(last_funding_rate)

                # Get mark price
                mark_price = entry.get("markPrice")
                mark_price_value = float(mark_price) if mark_price else None

                # Get next funding time (Unix timestamp in milliseconds)
                next_funding_time_ms = entry.get("nextFundingTime")
                next_funding_time = None
                if next_funding_time_ms:
                    next_funding_time = datetime.fromtimestamp(int(next_funding_time_ms) / 1000)

                # Binance uses 8-hour funding rate
                annualized_rate = self._annualize_rate(rate_value)

                # Create funding rate entry
                new_rate = FundingRate(
                    exchange='binance',
                    symbol=symbol,
                    rate=rate_value,
                    annualized_rate=annualized_rate,
                    next_funding_time=next_funding_time,
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
