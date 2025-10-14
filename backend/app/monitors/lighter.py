"""
Lighter funding rate monitor.
Fetches BTC, ETH, SOL funding rates from Lighter and stores them as monitoring data.
"""

from datetime import datetime
from typing import List, Dict, Any
import httpx

from app.models.database import MonitoringData, get_db_session
from app.monitors.base import BaseMonitor


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
        print(f"[{self.name}] Fetching funding rates...")

        rates = await self._fetch_funding_rates()

        if not rates:
            print(f"[{self.name}] No rates fetched")
            return

        stored_count = await self._store_rates(rates)
        print(f"[{self.name}] Stored {stored_count} funding rates")

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
            print(f"[{self.name}] Error fetching rates: {e}")
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

                # Annualize the 8-hour rate
                annualized_rate = self._annualize_rate(float(rate))

                # Create monitoring data entry
                monitor_id = f"lighter-{symbol.lower()}"
                monitor_name = f"Lighter {symbol} Funding Rate"

                new_data = MonitoringData(
                    monitor_id=monitor_id,
                    monitor_name=monitor_name,
                    monitor_type='monitor',
                    url=f"https://lighter.xyz/trade/{symbol}USDT",
                    value=annualized_rate,
                    unit='%',
                    status='active',
                    timestamp=datetime.utcnow(),
                    webhook_received_at=datetime.utcnow()
                )

                db.add(new_data)
                stored_count += 1

            db.commit()
            return stored_count

        except Exception as e:
            print(f"[{self.name}] Error storing rates: {e}")
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
