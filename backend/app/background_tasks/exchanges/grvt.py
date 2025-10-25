"""GRVT exchange adapter."""
import asyncio
from datetime import datetime
from typing import List, Dict, Any
from .base import BaseExchangeAdapter


class GRVTAdapter(BaseExchangeAdapter):
    INSTRUMENTS_URL = "https://market-data.grvt.io/full/v1/instruments"
    FUNDING_URL = "https://market-data.grvt.io/full/v1/funding"
    
    def __init__(self):
        super().__init__("grvt")
    
    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        try:
            # Fetch instruments and funding data
            instruments_data, funding_data = await asyncio.gather(
                self._http_post(self.INSTRUMENTS_URL, json_data={
                    "kind": ["PERPETUAL"],
                    "quote": ["USDT"],
                    "is_active": True
                }, timeout=30.0),
                self._http_post(self.FUNDING_URL, json_data={
                    "kind": ["PERPETUAL"],
                    "quote": ["USDT"]
                }, timeout=30.0)
            )
            
            # Build instrument map
            instrument_map = {}
            for inst in instruments_data.get("result", []):
                instrument_id = inst.get("instrument")
                base = inst.get("base", "")
                if instrument_id and base:
                    instrument_map[instrument_id] = base.upper()
            
            # Process funding data
            rates = []
            for entry in funding_data.get("result", []):
                instrument_id = entry.get("instrument")
                if not instrument_id:
                    continue

                symbol = instrument_map.get(instrument_id)
                if not symbol:
                    continue

                rate = entry.get("funding_rate")
                if rate is None:
                    continue
                
                rate_8h = float(rate)
                annualized_rate = self.annualize_8h_rate(rate_8h)
                
                mark_price = entry.get("mark_price")
                mark_price_value = float(mark_price) if mark_price else None
                
                next_time_str = entry.get("next_funding_time")
                next_funding_time = None
                if next_time_str:
                    try:
                        next_funding_time = datetime.fromisoformat(next_time_str.replace('Z', '+00:00'))
                    except:
                        pass
                
                rates.append({
                    "symbol": symbol,
                    "rate": rate_8h,
                    "annualized_rate": annualized_rate,
                    "mark_price": mark_price_value,
                    "next_funding_time": next_funding_time
                })
            
            self.logger.debug(f"Fetched {len(rates)} funding rates")
            return rates
        except Exception as e:
            self.logger.error(f"Error: {e}")
            return []
    
    async def fetch_spot_prices(self) -> List[Dict[str, Any]]:
        return []
