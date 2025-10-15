"""
GRVT funding rate monitor.
Fetches BTC, ETH, SOL funding rates from GRVT and stores them in the database.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
import httpx
import asyncio

from app.core.logger import get_logger
from app.models.database import FundingRate, get_db_session
from app.background_tasks.base import BaseMonitor

logger = get_logger(__name__)


# Target symbols to monitor
TARGET_SYMBOLS = ["BTC", "ETH", "SOL"]


class GRVTMonitor(BaseMonitor):
    """Monitor for GRVT funding rates."""

    def __init__(self):
        # Run every 5 minutes (300 seconds)
        super().__init__(name="GRVT Funding Rates", interval=300)
        self.instruments_url = "https://market-data.grvt.io/full/v1/instruments"
        self.funding_url = "https://market-data.grvt.io/full/v1/funding"

    async def run(self) -> None:
        """Fetch and store funding rates for one iteration."""
        logger.debug(f"Fetching GRVT funding rates...")

        rates = await self._fetch_funding_rates()

        if not rates:
            logger.warning(f"No rates fetched from GRVT")
            return

        stored_count = await self._store_rates(rates)
        logger.info(f"Stored {stored_count} GRVT funding rates")

    async def _fetch_funding_rates(self) -> List[Dict[str, Any]]:
        """Fetch funding rates from GRVT API."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Step 1: Fetch instruments with correct filters
                instruments_response = await client.post(self.instruments_url, json={
                    "kind": ["PERPETUAL"],
                    "quote": ["USDT"],
                    "is_active": True
                }, headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                })
                instruments_response.raise_for_status()
                instruments_data = instruments_response.json()

                instruments = instruments_data.get("result", [])
                if not instruments:
                    return []

                # Filter instruments to only target symbols
                target_instruments = [
                    inst for inst in instruments
                    if inst.get("base", "").upper() in TARGET_SYMBOLS
                ]

                # Step 2: Fetch funding for instruments with concurrency limit
                semaphore = asyncio.Semaphore(5)  # Max 5 concurrent requests

                async def fetch_instrument_funding(instrument) -> Optional[Dict[str, Any]]:
                    instrument_id = instrument.get("instrument")
                    base_currency = instrument.get("base")

                    if not instrument_id or not base_currency:
                        return None

                    async with semaphore:
                        try:
                            funding_response = await client.post(self.funding_url, json={
                                "instrument": instrument_id,
                                "limit": 1
                            }, headers={
                                "Accept": "application/json",
                                "Content-Type": "application/json"
                            })
                            funding_response.raise_for_status()
                            funding_data = funding_response.json()

                            funding_result = funding_data.get("result", [])
                            if not funding_result:
                                return None

                            funding_point = funding_result[0]
                            # Use 8h average if available
                            funding_rate = funding_point.get("funding_rate_8_h_avg") or funding_point.get("funding_rate")

                            if funding_rate is not None:
                                # GRVT returns percentage, divide by 100 to get decimal
                                rate_value = float(funding_rate) / 100

                                # Get mark price
                                mark_price = None
                                if funding_point.get("mark_price"):
                                    try:
                                        mark_price = float(funding_point.get("mark_price"))
                                    except:
                                        pass

                                # Parse funding time
                                next_funding = None
                                if funding_point.get("funding_time"):
                                    try:
                                        # Assuming ISO format or timestamp
                                        next_funding = datetime.fromisoformat(funding_point.get("funding_time").replace('Z', '+00:00'))
                                    except:
                                        pass

                                return {
                                    'symbol': base_currency.upper(),
                                    'rate': rate_value,
                                    'next_funding_time': next_funding,
                                    'mark_price': mark_price
                                }
                        except Exception as e:
                            logger.debug(f"Error fetching funding for {instrument_id}: {e}")
                            return None

                # Fetch all instruments concurrently with rate limiting
                tasks = [fetch_instrument_funding(inst) for inst in target_instruments]
                results = await asyncio.gather(*tasks)

                # Filter out None results
                rates = [r for r in results if r is not None]
                return rates

        except Exception as e:
            logger.error(f"Error fetching GRVT rates: {e}")
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
                    exchange='grvt',
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
            logger.error(f"Error storing GRVT rates: {e}")
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
