"""
Aster exchange adapter.
Handles funding rates from Aster.
"""

import asyncio
from datetime import datetime
from typing import List, Dict, Any

from .base import BaseExchangeAdapter


class AsterAdapter(BaseExchangeAdapter):
    """
    Aster exchange adapter.

    Capabilities:
    - Funding rates
    """

    PREMIUM_URL = "https://api.prod.aster.app/v1/premium-index"
    FUNDING_URL = "https://api.prod.aster.app/v1/funding-info"

    def __init__(self):
        super().__init__("aster")

    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        """
        Fetch funding rates from Aster.

        Aster requires fetching two endpoints:
        - Premium index (for rates)
        - Funding info (for intervals and next funding time)

        Returns:
            List of dicts with keys:
            - symbol: str (e.g., "BTC", "ETH", "SOL")
            - rate: float (8-hour normalized rate)
            - annualized_rate: float (APY percentage)
            - mark_price: float
            - next_funding_time: datetime
        """
        try:
            # Fetch both endpoints in parallel
            premium_data, funding_data = await asyncio.gather(
                self._http_get(self.PREMIUM_URL, headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }),
                self._http_get(self.FUNDING_URL, headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                })
            )

            # Build interval map from funding info
            interval_map = {}
            next_funding_map = {}
            for entry in funding_data:
                symbol = entry.get("symbol", "").upper()
                if symbol:
                    interval_map[symbol] = entry.get("fundingIntervalHours", 8)
                    next_time_str = entry.get("nextFundingTime")
                    if next_time_str:
                        next_funding_map[symbol] = next_time_str

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

                # Get funding rate
                rate = entry.get("fundingRate")
                if rate is None:
                    continue

                rate_value = float(rate)

                # Get funding interval (default to 8 hours)
                interval_hours = interval_map.get(symbol, 8)

                # Normalize to 8-hour rate
                rate_8h = rate_value * (8 / interval_hours)
                annualized_rate = self.annualize_8h_rate(rate_8h)

                # Get mark price
                mark_price = entry.get("markPrice")
                mark_price_value = float(mark_price) if mark_price else None

                # Get next funding time
                next_funding_time = None
                next_time_str = next_funding_map.get(symbol)
                if next_time_str:
                    try:
                        # Parse ISO format timestamp
                        next_funding_time = datetime.fromisoformat(next_time_str.replace('Z', '+00:00'))
                    except (ValueError, AttributeError):
                        pass

                rates.append({
                    "symbol": normalized_symbol,
                    "rate": rate_8h,
                    "annualized_rate": annualized_rate,
                    "mark_price": mark_price_value,
                    "next_funding_time": next_funding_time
                })

            self.logger.debug(f"Fetched {len(rates)} funding rates")
            return rates

        except Exception as e:
            self.logger.error(f"Error fetching funding rates: {e}")
            return []

    async def fetch_spot_prices(self) -> List[Dict[str, Any]]:
        """Aster doesn't provide spot prices."""
        return []
