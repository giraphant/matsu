"""
Bybit funding rate monitor.
Fetches funding rates from Bybit and stores them in the database.
"""

from datetime import datetime
from typing import List, Dict, Any
import httpx

from app.core.logger import get_logger
from app.models.database import FundingRate, get_db_session
from app.background_tasks.base import BaseMonitor

logger = get_logger(__name__)


class BybitMonitor(BaseMonitor):
    """Monitor for Bybit funding rates."""

    def __init__(self):
        # Run every 5 minutes (300 seconds)
        super().__init__(name="Bybit Funding Rates", interval=300)
        self.api_url = "https://api.bybit.com/v5/market/tickers"

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
        """Fetch funding rates from Bybit API."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Fetch linear perpetual (USDT contracts) tickers
                response = await client.get(
                    self.api_url,
                    params={"category": "linear"}
                )
                response.raise_for_status()
                data = response.json()

                if data.get("retCode") != 0:
                    logger.error(f"Bybit API error: {data.get('retMsg')}")
                    return []

                rates = []
                for item in data.get("result", {}).get("list", []):
                    symbol = item.get("symbol", "")

                    # Only process USDT perpetual contracts
                    if not symbol.endswith("USDT"):
                        continue

                    # Extract base symbol (e.g., BTCUSDT -> BTC)
                    base_symbol = symbol[:-4]

                    # Get funding rate
                    funding_rate = item.get("fundingRate")
                    if funding_rate is None:
                        continue

                    # Get mark price
                    mark_price = item.get("markPrice")

                    # Get next funding time (Unix timestamp in milliseconds)
                    next_funding_time_str = item.get("nextFundingTime")

                    rates.append({
                        "symbol": base_symbol,
                        "funding_rate": funding_rate,
                        "mark_price": mark_price,
                        "next_funding_time": next_funding_time_str
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
                funding_rate = entry.get("funding_rate")
                mark_price = entry.get("mark_price")
                next_funding_time_str = entry.get("next_funding_time")

                if funding_rate is None:
                    continue

                # Convert to float
                rate_value = float(funding_rate)

                # Convert mark price
                mark_price_value = float(mark_price) if mark_price else None

                # Parse next funding time
                next_funding_time = None
                if next_funding_time_str:
                    try:
                        next_funding_time = datetime.fromtimestamp(int(next_funding_time_str) / 1000)
                    except (ValueError, TypeError):
                        pass

                # Bybit uses 8-hour funding rate
                annualized_rate = self._annualize_rate(rate_value)

                # Create funding rate entry
                new_rate = FundingRate(
                    exchange='bybit',
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
