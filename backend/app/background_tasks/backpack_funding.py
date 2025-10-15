"""
Backpack funding rate monitor.
Fetches BTC, ETH, SOL funding rates from Backpack and stores them in the database.
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


class BackpackMonitor(BaseMonitor):
    """Monitor for Backpack funding rates."""

    def __init__(self):
        # Run every 5 minutes (300 seconds)
        super().__init__(name="Backpack Funding Rates", interval=300)
        self.api_url = "https://api.backpack.exchange/api/v1/markPrices"

    async def run(self) -> None:
        """Fetch and store funding rates for one iteration."""
        logger.debug(f"Fetching Backpack funding rates...")

        rates = await self._fetch_funding_rates()

        if not rates:
            logger.warning(f"No rates fetched from Backpack")
            return

        stored_count = await self._store_rates(rates)
        logger.info(f"Stored {stored_count} Backpack funding rates")

    async def _fetch_funding_rates(self) -> List[Dict[str, Any]]:
        """Fetch funding rates from Backpack API."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(self.api_url, headers={
                    "Accept": "application/json"
                })
                response.raise_for_status()
                data = response.json()

                if not isinstance(data, list):
                    return []

                rates = []
                for item in data:
                    if not isinstance(item, dict):
                        continue

                    symbol = item.get("symbol", "")
                    funding_rate = item.get("fundingRate")

                    if not symbol or funding_rate is None:
                        continue

                    # Remove _USDC_PERP or _USD_PERP suffix to get base symbol
                    clean_symbol = symbol.replace("_USDC_PERP", "").replace("_USD_PERP", "").upper()

                    # Only process target symbols
                    if clean_symbol not in TARGET_SYMBOLS:
                        continue

                    try:
                        # Backpack returns hourly rate, multiply by 8 for 8-hour rate
                        rate_value = float(funding_rate) * 8
                    except (ValueError, TypeError):
                        continue

                    # Get mark price
                    mark_price = None
                    if item.get("markPrice"):
                        try:
                            mark_price = float(item.get("markPrice"))
                        except:
                            pass

                    rates.append({
                        'symbol': clean_symbol,
                        'rate': rate_value,
                        'mark_price': mark_price
                    })

                return rates

        except Exception as e:
            logger.error(f"Error fetching Backpack rates: {e}")
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
                    exchange='backpack',
                    symbol=rate_data['symbol'],
                    rate=rate_data['rate'],
                    annualized_rate=annualized_rate,
                    next_funding_time=None,  # Backpack doesn't provide this
                    mark_price=rate_data.get('mark_price'),
                    timestamp=datetime.utcnow()
                )

                db.add(new_rate)
                stored_count += 1

            db.commit()
            return stored_count

        except Exception as e:
            logger.error(f"Error storing Backpack rates: {e}")
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
