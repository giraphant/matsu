"""
Aster funding rate monitor.
Fetches BTC, ETH, SOL funding rates from Aster and stores them in the database.
"""

from datetime import datetime
from typing import List, Dict, Any
import httpx
import asyncio

from app.core.logger import get_logger
from app.models.database import FundingRate, get_db_session
from app.background_tasks.base import BaseMonitor

logger = get_logger(__name__)


# Target symbols to monitor
TARGET_SYMBOLS = ["BTC", "ETH", "SOL"]


class AsterMonitor(BaseMonitor):
    """Monitor for Aster funding rates."""

    def __init__(self):
        # Run every 5 minutes (300 seconds)
        super().__init__(name="Aster Funding Rates", interval=300)
        self.premium_url = "https://fapi.asterdex.com/fapi/v1/premiumIndex"
        self.funding_url = "https://fapi.asterdex.com/fapi/v1/fundingInfo"

    async def run(self) -> None:
        """Fetch and store funding rates for one iteration."""
        logger.debug(f"Fetching Aster funding rates...")

        rates = await self._fetch_funding_rates()

        if not rates:
            logger.warning(f"No rates fetched from Aster")
            return

        stored_count = await self._store_rates(rates)
        logger.info(f"Stored {stored_count} Aster funding rates")

    async def _fetch_funding_rates(self) -> List[Dict[str, Any]]:
        """Fetch funding rates from Aster API."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Fetch both endpoints in parallel
                premium_response, funding_response = await asyncio.gather(
                    client.get(self.premium_url, headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    }),
                    client.get(self.funding_url, headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    })
                )

                premium_response.raise_for_status()
                funding_response.raise_for_status()

                premium_data = premium_response.json()
                funding_data = funding_response.json()

                # Build interval map from funding info
                interval_map = {}
                for entry in funding_data:
                    symbol = entry.get("symbol", "").upper()
                    if symbol:
                        interval_map[symbol] = entry.get("fundingIntervalHours", 8)

                # Process premium index data
                rates = []
                for entry in premium_data:
                    symbol = entry.get("symbol", "").upper()
                    if not symbol:
                        continue

                    # Normalize symbol (remove USDT/USD suffix if present)
                    normalized_symbol = symbol
                    if normalized_symbol.endswith("USDT"):
                        normalized_symbol = normalized_symbol[:-4]
                    elif normalized_symbol.endswith("USD"):
                        normalized_symbol = normalized_symbol[:-3]

                    # Only process target symbols
                    if normalized_symbol not in TARGET_SYMBOLS:
                        continue

                    # Get last funding rate
                    last_rate = entry.get("lastFundingRate")
                    if last_rate is None:
                        continue

                    try:
                        rate_value = float(last_rate)
                    except (ValueError, TypeError):
                        continue

                    # Normalize to 8-hour rate
                    hours = interval_map.get(symbol, 8)
                    eight_hour_rate = rate_value * (8 / hours)

                    # Convert nextFundingTime from milliseconds timestamp to datetime
                    next_funding = entry.get("nextFundingTime")
                    next_funding_dt = None
                    if next_funding:
                        try:
                            next_funding_dt = datetime.fromtimestamp(next_funding / 1000)
                        except:
                            pass

                    # Get mark price
                    mark_price = None
                    if entry.get("markPrice"):
                        try:
                            mark_price = float(entry.get("markPrice"))
                        except:
                            pass

                    rates.append({
                        'symbol': normalized_symbol,
                        'rate': eight_hour_rate,
                        'next_funding_time': next_funding_dt,
                        'mark_price': mark_price
                    })

                return rates

        except Exception as e:
            logger.error(f"Error fetching Aster rates: {e}")
            return []

    async def _store_rates(self, rates: List[Dict[str, Any]]) -> int:
        """Store funding rates in database."""
        db = get_db_session()
        stored_count = 0

        try:
            for rate_data in rates:
                # Annualize the 8-hour rate
                annualized_rate = self._annualize_rate(rate_data['rate'])

                new_rate = FundingRate(
                    exchange='aster',
                    symbol=rate_data['symbol'],
                    rate=rate_data['rate'],
                    annualized_rate=annualized_rate,
                    next_funding_time=rate_data.get('next_funding_time'),
                    mark_price=rate_data.get('mark_price'),
                    timestamp=datetime.utcnow()
                )

                db.add(new_rate)
                stored_count += 1

            db.commit()
            return stored_count

        except Exception as e:
            logger.error(f"Error storing Aster rates: {e}")
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
