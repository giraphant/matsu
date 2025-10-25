"""OKX exchange adapter."""
from typing import List, Dict, Any, Optional
from .base import BaseExchangeAdapter

class OKXAdapter(BaseExchangeAdapter):
    API_URL = "https://www.okx.com/api/v5/market/tickers"

    def __init__(self):
        super().__init__("okx")

    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        return []

    async def fetch_spot_prices(self, target_symbols: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Fetch spot prices from OKX Spot.

        Args:
            target_symbols: Optional list of symbols to filter (e.g., ["BTC", "ETH", "SOL"])
                          If None, returns all USDT pairs.

        Returns:
            List of dicts with keys:
            - symbol: str (normalized, e.g., "BTC")
            - price: float
            - volume_24h: float
        """
        try:
            data = await self._http_get(self.API_URL, params={"instType": "SPOT"})

            if data.get("code") != "0":
                self.logger.error(f"OKX API error: {data.get('msg')}")
                return []

            prices = []
            for item in data.get("data", []):
                inst_id = item.get("instId", "")
                if not inst_id.endswith("-USDT"):
                    continue

                base_symbol = inst_id.replace("-USDT", "")

                # Filter by target symbols if specified
                if target_symbols and base_symbol not in target_symbols:
                    continue

                last_price = item.get("last")
                volume = item.get("volCcy24h")

                if last_price is None:
                    continue

                prices.append({
                    "symbol": base_symbol,
                    "price": float(last_price),
                    "volume_24h": float(volume) if volume else None
                })

            self.logger.debug(f"Fetched {len(prices)} spot prices")
            return prices
        except Exception as e:
            self.logger.error(f"Error: {e}")
            return []
