"""
Base class for exchange adapters.
Provides common utilities for fetching data from exchanges.
"""

from typing import Optional, Dict, Any
from abc import ABC
import httpx

from app.core.logger import get_logger


class BaseExchangeAdapter(ABC):
    """
    Base class for exchange data adapters.

    Each exchange adapter can implement:
    - fetch_funding_rates() -> List[Dict]
    - fetch_spot_prices() -> List[Dict]
    - fetch_account_data() -> Dict
    - etc.
    """

    def __init__(self, exchange_name: str):
        """
        Initialize exchange adapter.

        Args:
            exchange_name: Exchange identifier (e.g., "binance", "bybit")
        """
        self.exchange_name = exchange_name.lower()
        self.logger = get_logger(f"{__name__}.{exchange_name}")

    async def _http_get(
        self,
        url: str,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        timeout: float = 10.0
    ) -> Any:
        """
        HTTP GET request helper.

        Args:
            url: Request URL
            params: Query parameters
            headers: HTTP headers
            timeout: Request timeout in seconds

        Returns:
            JSON response

        Raises:
            httpx.HTTPError: On request failure
        """
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            return response.json()

    async def _http_post(
        self,
        url: str,
        json_data: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        timeout: float = 10.0
    ) -> Any:
        """
        HTTP POST request helper.

        Args:
            url: Request URL
            json_data: JSON body
            headers: HTTP headers
            timeout: Request timeout in seconds

        Returns:
            JSON response

        Raises:
            httpx.HTTPError: On request failure
        """
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=json_data, headers=headers)
            response.raise_for_status()
            return response.json()

    @staticmethod
    def annualize_8h_rate(rate_8h: float) -> float:
        """
        Convert 8-hour funding rate to annualized percentage.

        Args:
            rate_8h: 8-hour funding rate (e.g., 0.0001 = 0.01%)

        Returns:
            Annualized rate in percentage (e.g., 10.95%)
        """
        return rate_8h * 3 * 365 * 100

    @staticmethod
    def annualize_1h_rate(rate_1h: float) -> float:
        """
        Convert 1-hour funding rate to annualized percentage.

        Args:
            rate_1h: 1-hour funding rate

        Returns:
            Annualized rate in percentage
        """
        return rate_1h * 24 * 365 * 100

    @staticmethod
    def normalize_symbol(symbol: str) -> str:
        """
        Normalize symbol to standard format (uppercase, no suffix).

        Examples:
            "BTCUSDT" -> "BTC"
            "btc-perp" -> "BTC"
            "eth" -> "ETH"

        Args:
            symbol: Raw symbol from exchange

        Returns:
            Normalized symbol
        """
        # Remove common suffixes
        symbol = symbol.upper()
        for suffix in ["USDT", "USD", "PERP", "-PERP", "_PERP"]:
            if symbol.endswith(suffix):
                symbol = symbol[:-len(suffix)]
        return symbol
