"""
Hyperliquid funding rate monitor (REFACTORED VERSION - EXAMPLE).
Shows how simple monitors become with the base class.
"""

from typing import List, Dict, Any

from app.background_tasks.funding_base import BaseFundingRateMonitor


TARGET_SYMBOLS = ["BTC", "ETH", "SOL"]


class HyperliquidMonitorRefactored(BaseFundingRateMonitor):
    """Refactored monitor for Hyperliquid funding rates."""

    def __init__(self):
        super().__init__(
            exchange_name="hyperliquid",
            api_url="https://api.hyperliquid.xyz/info",
            interval=300
        )

    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        """Fetch funding rates from Hyperliquid API."""
        try:
            # Hyperliquid uses POST with specific payload
            data = await self._http_post(
                self.api_url,
                json_data={"type": "metaAndAssetCtxs"}
            )

            rates = []
            for asset_ctx in data[0].get("universe", []):
                coin_name = asset_ctx.get("name", "")

                # Only process target symbols
                if coin_name not in TARGET_SYMBOLS:
                    continue

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

            return rates

        except Exception as e:
            self.logger.error(f"Error fetching Hyperliquid rates: {e}")
            return []
