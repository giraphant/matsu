"""Jupiter exchange adapter (Solana DEX aggregator)."""
from typing import List, Dict, Any
from .base import BaseExchangeAdapter

TARGET_TOKENS = {
    "So11111111111111111111111111111111111111112": "SOL",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
}

class JupiterAdapter(BaseExchangeAdapter):
    API_URL = "https://price.jup.ag/v4/price"
    
    def __init__(self):
        super().__init__("jupiter")
    
    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        return []
    
    async def fetch_spot_prices(self) -> List[Dict[str, Any]]:
        try:
            token_ids = list(TARGET_TOKENS.keys())
            params = {"ids": ",".join(token_ids)}
            
            data = await self._http_get(self.API_URL, params=params)
            prices = []
            
            for token_id, price_data in data.get("data", {}).items():
                symbol = TARGET_TOKENS.get(token_id)
                if not symbol:
                    continue
                
                price = price_data.get("price")
                if price is None:
                    continue
                
                prices.append({
                    "symbol": symbol,
                    "price": float(price),
                    "volume_24h": None
                })
            
            self.logger.debug(f"Fetched {len(prices)} spot prices")
            return prices
        except Exception as e:
            self.logger.error(f"Error: {e}")
            return []
