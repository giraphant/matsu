"""Backpack exchange adapter."""
from typing import List, Dict, Any
from .base import BaseExchangeAdapter


class BackpackAdapter(BaseExchangeAdapter):
    API_URL = "https://api.backpack.exchange/api/v1/markets"
    
    def __init__(self):
        super().__init__("backpack")
    
    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        try:
            data = await self._http_get(self.API_URL)
            rates = []
            
            for market in data:
                symbol = market.get("symbol", "")
                if not symbol.endswith("_USDC_PERP"):
                    continue

                base_symbol = symbol.replace("_USDC_PERP", "")

                funding_rate = market.get("fundingRate")
                if funding_rate is None:
                    continue
                
                rate_8h = float(funding_rate)
                annualized_rate = self.annualize_8h_rate(rate_8h)
                
                rates.append({
                    "symbol": base_symbol,
                    "rate": rate_8h,
                    "annualized_rate": annualized_rate,
                    "mark_price": None,
                    "next_funding_time": None
                })
            
            self.logger.debug(f"Fetched {len(rates)} funding rates")
            return rates
        except Exception as e:
            self.logger.error(f"Error: {e}")
            return []
    
    async def fetch_spot_prices(self) -> List[Dict[str, Any]]:
        return []
