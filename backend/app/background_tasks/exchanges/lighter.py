"""
Lighter exchange adapter.
Handles funding rates from Lighter.
"""

from typing import List, Dict, Any

from .base import BaseExchangeAdapter


TARGET_SYMBOLS = ["BTC", "ETH", "SOL"]


class LighterAdapter(BaseExchangeAdapter):
    """
    Lighter exchange adapter.

    Capabilities:
    - Funding rates
    """

    API_URL = "https://mainnet.zklighter.elliot.ai/api/v1/funding-rates"

    def __init__(self):
        super().__init__("lighter")

    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        """
        Fetch funding rates from Lighter.

        Returns:
            List of dicts with keys:
            - symbol: str (e.g., "BTC", "ETH", "SOL")
            - rate: float (8-hour rate)
            - annualized_rate: float (APY percentage)
            - mark_price: None (not provided)
            - next_funding_time: None (not provided)
        """
        try:
            data = await self._http_get(
                self.API_URL,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            )

            funding_rates = data.get("funding_rates", [])
            rates = []

            for entry in funding_rates:
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
                annualized_rate = self.annualize_8h_rate(rate_value)

                rates.append({
                    "symbol": symbol,
                    "rate": rate_value,
                    "annualized_rate": annualized_rate,
                    "mark_price": None,  # Not available in API response
                    "next_funding_time": None  # Not available in API response
                })

            self.logger.debug(f"Fetched {len(rates)} funding rates")
            return rates

        except Exception as e:
            self.logger.error(f"Error fetching funding rates: {e}")
            return []

    async def fetch_spot_prices(self) -> List[Dict[str, Any]]:
        """Lighter doesn't provide spot prices."""
        return []
