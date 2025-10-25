"""
Aster exchange adapter.
Handles funding rates from Aster.
"""

import asyncio
from datetime import datetime
from typing import List, Dict, Any

from .base import BaseExchangeAdapter


class AsterAdapter(BaseExchangeAdapter):
    """
    Aster exchange adapter.

    Capabilities:
    - Funding rates
    """

    # Updated API endpoints (old domain: api.prod.aster.app no longer resolves)
    PREMIUM_URL = "https://fapi.asterdex.com/fapi/v1/premiumIndex"
    TICKER_URL = "https://fapi.asterdex.com/fapi/v1/ticker/24hr"

    def __init__(self):
        super().__init__("aster")

    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        """
        Fetch funding rates from Aster (new API format).

        New API uses Binance-like endpoints:
        - /fapi/v1/premiumIndex for funding rates
        - /fapi/v1/ticker/24hr for volume data

        Returns:
            List of dicts with keys:
            - symbol: str (e.g., "BTC", "ETH", "SOL")
            - rate: float (8-hour rate)
            - annualized_rate: float (APY percentage)
            - mark_price: float
            - next_funding_time: datetime
            - turnover_24h: float (for volume filtering)
        """
        try:
            # Fetch premium index and 24hr ticker in parallel
            premium_data, ticker_data = await asyncio.gather(
                self._http_get(self.PREMIUM_URL),
                self._http_get(self.TICKER_URL)
            )

            # Build volume map from ticker data
            volume_map = {}
            for ticker in ticker_data:
                symbol = ticker.get("symbol", "")
                quote_volume = ticker.get("quoteVolume")  # USDT volume
                if symbol and quote_volume:
                    try:
                        volume_map[symbol] = float(quote_volume)
                    except (ValueError, TypeError):
                        pass

            rates = []
            for entry in premium_data:
                symbol = entry.get("symbol", "").upper()
                if not symbol:
                    continue

                # Normalize symbol (remove USDT/USD suffix, Aster uses XxxxxUSDS/XxxxxUSD format)
                normalized_symbol = symbol
                if normalized_symbol.endswith("USDT"):
                    normalized_symbol = normalized_symbol[:-4]
                elif normalized_symbol.endswith("USD"):
                    normalized_symbol = normalized_symbol[:-3]

                # Get funding rate (lastFundingRate is the current 8h rate)
                funding_rate = entry.get("lastFundingRate")
                if funding_rate is None:
                    continue

                rate_8h = float(funding_rate)
                annualized_rate = self.annualize_8h_rate(rate_8h)

                # Get mark price
                mark_price = entry.get("markPrice")
                mark_price_value = float(mark_price) if mark_price else None

                # Get next funding time (Unix timestamp in milliseconds)
                next_funding_time_ms = entry.get("nextFundingTime")
                next_funding_time = None
                if next_funding_time_ms:
                    try:
                        next_funding_time = datetime.fromtimestamp(int(next_funding_time_ms) / 1000)
                    except (ValueError, TypeError):
                        pass

                # Get volume from ticker map
                turnover_24h = volume_map.get(symbol)

                rates.append({
                    "symbol": normalized_symbol,
                    "rate": rate_8h,
                    "annualized_rate": annualized_rate,
                    "mark_price": mark_price_value,
                    "next_funding_time": next_funding_time,
                    "turnover_24h": turnover_24h  # For volume filtering
                })

            self.logger.debug(f"Fetched {len(rates)} funding rates")
            return rates

        except Exception as e:
            self.logger.error(f"Error fetching funding rates: {e}")
            return []

    async def fetch_spot_prices(self) -> List[Dict[str, Any]]:
        """Aster doesn't provide spot prices."""
        return []
