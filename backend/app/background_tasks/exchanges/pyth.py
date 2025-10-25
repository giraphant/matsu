"""Pyth Network oracle adapter."""
from typing import List, Dict, Any
from .base import BaseExchangeAdapter

# Price feed IDs for Pyth Network
# See: https://pyth.network/developers/price-feed-ids
TARGET_SYMBOLS = {
    # Major tokens (USD price)
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43": "BTC",
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace": "ETH",
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d": "SOL",
    # Solana Perps LPs (USD price)
    "0x6704952e00b6a088b6dcdb8170dcd591eaf64cff9e996ca75ae0ca55bfb96687": "JLP",
    "0xa6cdf5ac29a2bb75c2d1347e85362b703c7c8090a21d358e6b4155294e5b3159": "ALP",
    # SOL Liquid Staking Tokens (LSTs) - Ratio vs SOL
    "0x72d61f850fe06047969e1f236a49f3c15c40823098b98ffa72f5b836a028ffa9": "BNSOL/SOL",
    "0x01d577b07031e12635d2fb86af6ae938bdc2b6dba9602d8e8af34d44587566fc": "JitoSOL/SOL",
    "0xf8d8d6b6c866c8b2624fb5b679ae846738725e5fc887fa8e927c8d8645018a2b": "JupSOL/SOL",
    "0x046e7c1cf187195ba3174028ab3be75be88382956f7d4d4b6b507e727370f284": "mSOL/SOL",
    "0x7d9e2258cec229cf52873a8e58d035a276873c485d753860e56d248fb33ce68a": "bbSOL/SOL",
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
