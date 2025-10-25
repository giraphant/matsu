"""
Hyperliquid exchange adapter.
Handles funding rates from Hyperliquid.
"""

from typing import List, Dict, Any

from .base import BaseExchangeAdapter


class HyperliquidAdapter(BaseExchangeAdapter):
    """
    Hyperliquid exchange adapter.

    Capabilities:
    - Funding rates
    """

    API_URL = "https://api.hyperliquid.xyz/info"

    def __init__(self):
        super().__init__("hyperliquid")

    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        """
        Fetch funding rates from Hyperliquid.

        Hyperliquid provides 1-hour funding rates, which are converted
        to 8-hour equivalent for consistency.

        Returns:
            List of dicts with keys:
            - symbol: str (e.g., "BTC", "ETH", "SOL")
            - rate: float (8-hour equivalent)
            - annualized_rate: float (APY percentage)
            - mark_price: float
            - next_funding_time: None (not provided by Hyperliquid)
        """
        try:
            # Hyperliquid uses POST with specific payload
            data = await self._http_post(
                self.API_URL,
                json_data={"type": "metaAndAssetCtxs"}
            )

            rates = []
            for asset_ctx in data[0].get("universe", []):
                coin_name = asset_ctx.get("name", "")

                # Hyperliquid provides 1-hour rate
                funding_1h = asset_ctx.get("funding")
                mark_price = asset_ctx.get("markPx")

                if funding_1h is None:
                    continue

                # Convert 1h rate to 8h for consistency
                rate_1h = float(funding_1h)
                rate_8h = rate_1h * 8
                annualized_rate = self.annualize_1h_rate(rate_1h)
                mark_price_val = float(mark_price) if mark_price else None

                rates.append({
                    "symbol": coin_name,
                    "rate": rate_8h,  # Store as 8-hour equivalent
                    "annualized_rate": annualized_rate,
                    "mark_price": mark_price_val,
                    "next_funding_time": None  # Hyperliquid doesn't provide this
                })

            self.logger.debug(f"Fetched {len(rates)} funding rates")
            return rates

        except Exception as e:
            self.logger.error(f"Error fetching funding rates: {e}")
            return []

    async def fetch_spot_prices(self) -> List[Dict[str, Any]]:
        """Hyperliquid doesn't provide spot prices."""
        return []
