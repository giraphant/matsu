"""
Binance funding rate monitor (REFACTORED VERSION - EXAMPLE).
Demonstrates how to use BaseFundingRateMonitor to reduce code duplication.
"""

from datetime import datetime
from typing import List, Dict, Any

from app.background_tasks.funding_base import BaseFundingRateMonitor


# Target symbols to monitor (Binance uses USDT pairs)
TARGET_SYMBOLS = {
    "BTCUSDT": "BTC",
    "ETHUSDT": "ETH",
    "SOLUSDT": "SOL"
}


class BinanceMonitorRefactored(BaseFundingRateMonitor):
    """Refactored monitor for Binance funding rates."""

    def __init__(self):
        super().__init__(
            exchange_name="binance",
            api_url="https://fapi.binance.com/fapi/v1/premiumIndex",
            interval=300  # 5 minutes
        )

    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        """
        Fetch funding rates from Binance API.

        API Response Format:
        [
            {
                "symbol": "BTCUSDT",
                "lastFundingRate": "0.00010000",
                "nextFundingTime": 1609459200000,
                "markPrice": "29000.00000000"
            },
            ...
        ]
        """
        try:
            # Fetch data from Binance
            data = await self._http_get(self.api_url)

            rates = []
            for item in data:
                symbol_pair = item.get("symbol", "")

                # Only process target symbols
                if symbol_pair not in TARGET_SYMBOLS:
                    continue

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

                # Parse next funding time
                next_funding_time = None
                if next_funding_time_ms:
                    try:
                        next_funding_time = datetime.fromtimestamp(int(next_funding_time_ms) / 1000)
                    except (ValueError, TypeError):
                        pass

                # Normalize symbol (BTCUSDT -> BTC)
                normalized_symbol = TARGET_SYMBOLS[symbol_pair]

                rates.append({
                    "symbol": normalized_symbol,
                    "rate": rate_8h,
                    "annualized_rate": annualized_rate,
                    "mark_price": mark_price,
                    "next_funding_time": next_funding_time
                })

            return rates

        except Exception as e:
            self.logger.error(f"Error fetching Binance rates: {e}")
            return []
