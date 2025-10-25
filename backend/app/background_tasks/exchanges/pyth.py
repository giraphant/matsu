"""Pyth Network oracle adapter."""
from typing import List, Dict, Any
from .base import BaseExchangeAdapter

TARGET_SYMBOLS = {
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43": "BTC",
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace": "ETH",
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d": "SOL",
}

class PythAdapter(BaseExchangeAdapter):
    API_URL = "https://hermes.pyth.network/v2/updates/price/latest"
    
    def __init__(self):
        super().__init__("pyth")
    
    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        return []
    
    async def fetch_spot_prices(self) -> List[Dict[str, Any]]:
        try:
            price_ids = list(TARGET_SYMBOLS.keys())
            params = {"ids[]": price_ids}
            
            data = await self._http_get(self.API_URL, params=params)
            prices = []
            
            for feed in data.get("parsed", []):
                price_id = feed.get("id")
                symbol = TARGET_SYMBOLS.get(price_id)
                if not symbol:
                    continue
                
                price_data = feed.get("price", {})
                price_str = price_data.get("price")
                expo = price_data.get("expo", 0)
                
                if price_str is None:
                    continue
                
                price = float(price_str) * (10 ** expo)
                
                prices.append({
                    "symbol": symbol,
                    "price": price,
                    "volume_24h": None
                })
            
            self.logger.debug(f"Fetched {len(prices)} spot prices")
            return prices
        except Exception as e:
            self.logger.error(f"Error: {e}")
            return []
