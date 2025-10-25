"""
Base class for funding rate monitors.
Provides common functionality for fetching and storing funding rates from different exchanges.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from abc import abstractmethod
import httpx

from app.core.logger import get_logger
from app.models.database import FundingRate, get_db_session
from app.background_tasks.base import BaseMonitor

logger = get_logger(__name__)


class BaseFundingRateMonitor(BaseMonitor):
    """
    Abstract base class for funding rate monitors.

    Subclasses only need to implement:
    - fetch_funding_rates(): Get data from exchange API
    - parse_rate_entry(): Convert exchange-specific format to standard format
    """

    def __init__(self, exchange_name: str, api_url: str, interval: int = 300):
        """
        Initialize funding rate monitor.

        Args:
            exchange_name: Exchange identifier (e.g., "binance", "bybit")
            api_url: API endpoint URL
            interval: Seconds between checks (default: 300 = 5 minutes)
        """
        super().__init__(name=f"{exchange_name.title()} Funding Rates", interval=interval)
        self.exchange_name = exchange_name.lower()
        self.api_url = api_url

    async def run(self) -> None:
        """Fetch and store funding rates for one iteration."""
        logger.debug(f"[{self.exchange_name}] Fetching funding rates...")

        try:
            rates = await self.fetch_funding_rates()

            if not rates:
                logger.warning(f"[{self.exchange_name}] No rates fetched")
                return

            stored_count = await self._store_rates(rates)
            logger.info(f"[{self.exchange_name}] Stored {stored_count} funding rates")

        except Exception as e:
            logger.error(f"[{self.exchange_name}] Error fetching rates: {e}")
            raise

    @abstractmethod
    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        """
        Fetch funding rates from exchange API.

        Returns:
            List of rate dictionaries with keys:
            - symbol: str (normalized, e.g., "BTC", "ETH")
            - rate: float (8-hour normalized rate)
            - annualized_rate: float (APY percentage)
            - mark_price: Optional[float]
            - next_funding_time: Optional[datetime]

        Raises:
            NotImplementedError: Must be implemented by subclass
        """
        raise NotImplementedError("Subclasses must implement fetch_funding_rates()")

    async def _store_rates(self, rates: List[Dict[str, Any]]) -> int:
        """
        Store funding rates in database.

        Args:
            rates: List of parsed rate dictionaries

        Returns:
            Number of rates stored
        """
        db = get_db_session()
        stored_count = 0

        try:
            for entry in rates:
                # Validate required fields
                symbol = entry.get("symbol")
                rate = entry.get("rate")
                annualized_rate = entry.get("annualized_rate")

                if not symbol or rate is None or annualized_rate is None:
                    logger.warning(f"[{self.exchange_name}] Skipping invalid entry: {entry}")
                    continue

                # Create funding rate entry
                new_rate = FundingRate(
                    exchange=self.exchange_name,
                    symbol=symbol,
                    rate=float(rate),
                    annualized_rate=float(annualized_rate),
                    next_funding_time=entry.get("next_funding_time"),
                    mark_price=float(entry["mark_price"]) if entry.get("mark_price") else None,
                    timestamp=datetime.utcnow()
                )

                db.add(new_rate)
                stored_count += 1

            db.commit()
            return stored_count

        except Exception as e:
            logger.error(f"[{self.exchange_name}] Error storing rates: {e}")
            db.rollback()
            return 0

        finally:
            db.close()

    @staticmethod
    def annualize_8h_rate(rate_8h: float) -> float:
        """
        Convert 8-hour funding rate to annualized percentage.

        Args:
            rate_8h: 8-hour funding rate (e.g., 0.0001 = 0.01%)

        Returns:
            Annualized rate in percentage (e.g., 10.95 = 10.95% APY)
        """
        # 8-hour rate * 3 (per day) * 365 (per year) * 100 (to percentage)
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
        # 1-hour rate * 24 (per day) * 365 (per year) * 100 (to percentage)
        return rate_1h * 24 * 365 * 100

    async def _http_get(self, url: str, params: Optional[Dict] = None, timeout: float = 10.0) -> Dict:
        """
        Helper method for HTTP GET requests.

        Args:
            url: Request URL
            params: Query parameters
            timeout: Request timeout in seconds

        Returns:
            JSON response as dictionary

        Raises:
            httpx.HTTPError: On request failure
        """
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()

    async def _http_post(self, url: str, json_data: Optional[Dict] = None, timeout: float = 10.0) -> Dict:
        """
        Helper method for HTTP POST requests.

        Args:
            url: Request URL
            json_data: JSON body
            timeout: Request timeout in seconds

        Returns:
            JSON response as dictionary

        Raises:
            httpx.HTTPError: On request failure
        """
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=json_data)
            response.raise_for_status()
            return response.json()
