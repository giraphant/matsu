"""
Bybit exchange adapter.
Handles both funding rates and spot prices from Bybit.
"""

from datetime import datetime
from typing import List, Dict, Any

from .base import BaseExchangeAdapter


class BybitAdapter(BaseExchangeAdapter):
    """
    Bybit exchange adapter.

    Capabilities:
    - Funding rates (linear perpetual contracts)
    - Spot prices
    """

    # API endpoints
    FUNDING_API = "https://api.bybit.com/v5/market/tickers"
    SPOT_API = "https://api.bybit.com/v5/market/tickers"

    def __init__(self):
        super().__init__("bybit")

    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        """
        Fetch funding rates from Bybit linear perpetual contracts.

        Returns:
            List of dicts with keys:
            - symbol: str (normalized, e.g., "BTC")
            - rate: float (8-hour rate)
            - annualized_rate: float (APY percentage)
            - mark_price: float
            - next_funding_time: datetime
        """
        try:
            data = await self._http_get(
                self.FUNDING_API,
                params={"category": "linear"}
            )

            if data.get("retCode") != 0:
                self.logger.error(f"Bybit API error: {data.get('retMsg')}")
                return []

            rates = []
            for item in data.get("result", {}).get("list", []):
                symbol = item.get("symbol", "")

                # Only process USDT perpetual contracts
                if not symbol.endswith("USDT"):
                    continue

                # Extract base symbol (e.g., BTCUSDT -> BTC)
                base_symbol = symbol[:-4]

                # Get funding rate
                funding_rate = item.get("fundingRate")
                if funding_rate is None:
                    continue

                # Parse values
                rate_8h = float(funding_rate)
                annualized_rate = self.annualize_8h_rate(rate_8h)

                # Get mark price
                mark_price = item.get("markPrice")
                mark_price_value = float(mark_price) if mark_price else None

                # Get next funding time (Unix timestamp in milliseconds)
                next_funding_time_str = item.get("nextFundingTime")
                next_funding_time = None
                if next_funding_time_str:
                    try:
                        next_funding_time = datetime.fromtimestamp(int(next_funding_time_str) / 1000)
                    except (ValueError, TypeError):
                        pass

                rates.append({
                    "symbol": base_symbol,
                    "rate": rate_8h,
                    "annualized_rate": annualized_rate,
                    "mark_price": mark_price_value,
                    "next_funding_time": next_funding_time
                })

            self.logger.debug(f"Fetched {len(rates)} funding rates")
            return rates

        except Exception as e:
            self.logger.error(f"Error fetching funding rates: {e}")
            return []

    async def fetch_spot_prices(self) -> List[Dict[str, Any]]:
        """
        Fetch spot prices from Bybit Spot.

        Returns:
            List of dicts with keys:
            - symbol: str (normalized, e.g., "BTC")
            - price: float
            - volume_24h: float
        """
        try:
            data = await self._http_get(
                self.SPOT_API,
                params={"category": "spot"}
            )

            if data.get("retCode") != 0:
                self.logger.error(f"Bybit API error: {data.get('retMsg')}")
                return []

            result = data.get("result", {})
            tickers = result.get("list", [])

            if not isinstance(tickers, list):
                return []

            prices = []
            for item in tickers:
                if not isinstance(item, dict):
                    continue

                symbol = item.get("symbol", "")

                # Only process USDT pairs
                if not symbol.endswith("USDT"):
                    continue

                # Extract base symbol
                base_symbol = symbol[:-4]

                # Get price and volume
                last_price = item.get("lastPrice")
                volume = item.get("volume24h")

                if last_price is None:
                    continue

                try:
                    price_value = float(last_price)
                    volume_value = float(volume) if volume else None

                    prices.append({
                        "symbol": base_symbol,
                        "price": price_value,
                        "volume_24h": volume_value
                    })
                except (ValueError, TypeError):
                    continue

            self.logger.debug(f"Fetched {len(prices)} spot prices")
            return prices

        except Exception as e:
            self.logger.error(f"Error fetching spot prices: {e}")
            return []
