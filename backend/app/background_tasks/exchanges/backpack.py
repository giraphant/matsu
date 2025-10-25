"""Backpack exchange adapter."""
import asyncio
from typing import List, Dict, Any
from .base import BaseExchangeAdapter


class BackpackAdapter(BaseExchangeAdapter):
    MARKETS_URL = "https://api.backpack.exchange/api/v1/markets"
    FUNDING_RATE_URL = "https://api.backpack.exchange/api/v1/fundingRates"
    TICKER_URL = "https://api.backpack.exchange/api/v1/ticker"

    def __init__(self):
        super().__init__("backpack")

    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        try:
            # Get all markets first to find USDC perps
            markets = await self._http_get(self.MARKETS_URL)

            # Filter for USDC perpetuals
            perp_symbols = [
                m.get("symbol", "")
                for m in markets
                if m.get("symbol", "").endswith("_USDC_PERP")
            ]

            if not perp_symbols:
                return []

            # Fetch funding rates and tickers in parallel for all symbols
            tasks = []
            for symbol in perp_symbols:
                tasks.append(self._http_get(
                    self.FUNDING_RATE_URL,
                    params={"symbol": symbol, "limit": 1}
                ))
                tasks.append(self._http_get(
                    self.TICKER_URL,
                    params={"symbol": symbol}
                ))

            results = await asyncio.gather(*tasks, return_exceptions=True)

            rates = []
            for i in range(0, len(results), 2):
                symbol = perp_symbols[i // 2]
                base_symbol = symbol.replace("_USDC_PERP", "")

                # Get funding rate (latest entry)
                funding_result = results[i]
                if isinstance(funding_result, Exception) or not funding_result:
                    continue

                funding_rate_str = funding_result[0].get("fundingRate") if len(funding_result) > 0 else None
                if funding_rate_str is None:
                    continue

                # Get volume from ticker
                ticker_result = results[i + 1]
                volume_24h = None
                if not isinstance(ticker_result, Exception) and ticker_result:
                    volume_str = ticker_result.get("quoteVolume")
                    if volume_str:
                        volume_24h = float(volume_str)

                # Backpack uses 1-hour funding (they switched in Aug 2025)
                rate_1h = float(funding_rate_str)
                rate_8h = rate_1h * 8  # Normalize to 8h
                annualized_rate = self.annualize_1h_rate(rate_1h)

                rates.append({
                    "symbol": base_symbol,
                    "rate": rate_8h,
                    "annualized_rate": annualized_rate,
                    "mark_price": None,
                    "next_funding_time": None,
                    "turnover_24h": volume_24h  # For volume filtering
                })

            self.logger.debug(f"Fetched {len(rates)} funding rates")
            return rates
        except Exception as e:
            self.logger.error(f"Error: {e}")
            return []
    
    async def fetch_spot_prices(self) -> List[Dict[str, Any]]:
        return []
