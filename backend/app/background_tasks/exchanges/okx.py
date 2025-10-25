"""OKX exchange adapter."""
from typing import List, Dict, Any
from .base import BaseExchangeAdapter

class OkxAdapter(BaseExchangeAdapter):
    API_URL = "https://www.okx.com/api/v5/market/tickers"
    
    def __init__(self):
        super().__init__("okx")
    
    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        return []
    
    async def fetch_spot_prices(self) -> List[Dict[str, Any]]:
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
