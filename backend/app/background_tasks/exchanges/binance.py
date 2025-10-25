"""
Binance exchange adapter.
Handles both funding rates and spot prices from Binance.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional

from .base import BaseExchangeAdapter


class BinanceAdapter(BaseExchangeAdapter):
    """
    Binance exchange adapter.

    Capabilities:
    - Funding rates (futures)
    - Spot prices
    """

    # API endpoints
    FUNDING_API = "https://fapi.binance.com/fapi/v1/premiumIndex"
    SPOT_API = "https://api.binance.com/api/v3/ticker/24hr"

    # Target symbols
    FUNDING_SYMBOLS = {
        "BTCUSDT": "BTC",
        "ETHUSDT": "ETH",
        "SOLUSDT": "SOL"
    }

    def __init__(self):
        super().__init__("binance")

    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        """
        Fetch funding rates from Binance Futures with volume data.

        Returns:
            List of dicts with keys:
            - symbol: str (normalized, e.g., "BTC")
            - rate: float (8-hour rate)
            - annualized_rate: float (APY percentage)
            - mark_price: float
            - next_funding_time: datetime
            - turnover_24h: float (USDT volume for filtering)
        """
        try:
            import asyncio

            # Fetch both funding rates and 24hr tickers in parallel
            funding_data, ticker_data = await asyncio.gather(
                self._http_get(self.FUNDING_API),
                self._http_get("https://fapi.binance.com/fapi/v1/ticker/24hr")
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
            for item in funding_data:
                symbol_pair = item.get("symbol", "")

                # Only process USDT perpetual contracts
                if not symbol_pair.endswith("USDT"):
                    continue

                # Extract base symbol (e.g., BTCUSDT -> BTC)
                base_symbol = symbol_pair[:-4]

                # Extract data
                funding_rate_str = item.get("lastFundingRate")
                mark_price_str = item.get("markPrice")
                next_funding_time_ms = item.get("nextFundingTime")

                if funding_rate_str is None:
                    continue

                # Parse values
                rate_8h = float(funding_rate_str)
                annualized_rate = self.annualize_8h_rate(rate_8h)
                mark_price = float(mark_price_str) if mark_price_str else None

                # Parse next funding time (milliseconds timestamp)
                next_funding_time = None
                if next_funding_time_ms:
                    try:
                        next_funding_time = datetime.fromtimestamp(int(next_funding_time_ms) / 1000)
                    except (ValueError, TypeError):
                        pass

                # Get volume from ticker map
                turnover_24h = volume_map.get(symbol_pair)

                rates.append({
                    "symbol": base_symbol,
                    "rate": rate_8h,
                    "annualized_rate": annualized_rate,
                    "mark_price": mark_price,
                    "next_funding_time": next_funding_time,
                    "turnover_24h": turnover_24h  # For volume filtering
                })

            self.logger.debug(f"Fetched {len(rates)} funding rates")
            return rates

        except Exception as e:
            self.logger.error(f"Error fetching funding rates: {e}")
            return []

    async def fetch_spot_prices(self, target_symbols: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Fetch spot prices from Binance Spot.

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
            data = await self._http_get(self.SPOT_API)

            prices = []
            for item in data:
                symbol_pair = item.get("symbol", "")

                # Only process USDT pairs
                if not symbol_pair.endswith("USDT"):
                    continue

                # Extract base symbol
                base_symbol = symbol_pair[:-4]  # Remove "USDT"

                # Filter by target symbols if specified
                if target_symbols and base_symbol not in target_symbols:
                    continue

                # Get price and volume
                price_str = item.get("lastPrice")
                volume_str = item.get("quoteVolume")  # Volume in USDT

                if price_str is None:
                    continue

                price = float(price_str)
                volume_24h = float(volume_str) if volume_str else None

                prices.append({
                    "symbol": base_symbol,
                    "price": price,
                    "volume_24h": volume_24h
                })

            self.logger.debug(f"Fetched {len(prices)} spot prices")
            return prices

        except Exception as e:
            self.logger.error(f"Error fetching spot prices: {e}")
            return []
