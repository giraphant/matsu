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

            # Response format: [meta_data, asset_contexts]
            # meta_data contains universe with coin names
            # asset_contexts contains funding rates and prices
            if not isinstance(data, list) or len(data) < 2:
                self.logger.error("Unexpected Hyperliquid API response format")
                return []

            universe = data[0].get("universe", [])
            asset_contexts = data[1] if len(data) > 1 else []

            if len(universe) != len(asset_contexts):
                self.logger.warning(f"Mismatch: {len(universe)} symbols but {len(asset_contexts)} contexts")

            rates = []
            for i, (meta, ctx) in enumerate(zip(universe, asset_contexts)):
                coin_name = meta.get("name", "")

                # Hyperliquid provides 1-hour rate
                funding_1h = ctx.get("funding")
                mark_price = ctx.get("markPx")
                volume_24h = ctx.get("dayNtlVlm")  # 24h notional volume for filtering

                if funding_1h is None:
                    continue

                # Convert 1h rate to 8h for consistency
                rate_1h = float(funding_1h)
                rate_8h = rate_1h * 8
                annualized_rate = self.annualize_1h_rate(rate_1h)
                mark_price_val = float(mark_price) if mark_price else None
                volume_val = float(volume_24h) if volume_24h else None

                rates.append({
                    "symbol": coin_name,
                    "rate": rate_8h,  # Store as 8-hour equivalent
                    "annualized_rate": annualized_rate,
                    "mark_price": mark_price_val,
                    "next_funding_time": None,  # Hyperliquid doesn't provide this
                    "turnover_24h": volume_val  # For volume filtering
                })

            self.logger.debug(f"Fetched {len(rates)} funding rates")
            return rates

        except Exception as e:
            self.logger.error(f"Error fetching funding rates: {e}")
            return []

    async def fetch_spot_prices(self) -> List[Dict[str, Any]]:
        """Hyperliquid doesn't provide spot prices."""
        return []
