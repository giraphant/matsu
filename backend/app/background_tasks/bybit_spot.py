"""
Bybit spot price monitor.
Fetches BTC, ETH, SOL spot prices from Bybit and stores them in the database.
"""

from datetime import datetime
from typing import List, Dict, Any
import httpx

from app.core.logger import get_logger
from app.models.database import SpotPrice, get_db_session
from app.background_tasks.base import BaseMonitor

logger = get_logger(__name__)


# Target symbols to monitor
TARGET_SYMBOLS = ["BTC", "ETH", "SOL"]


class BybitSpotMonitor(BaseMonitor):
    """Monitor for Bybit spot prices."""

    def __init__(self):
        # Run every 10 seconds
        super().__init__(name="Bybit Spot Prices", interval=10)
        self.api_url = "https://api.bybit.com/v5/market/tickers"

    async def run(self) -> None:
        """Fetch and store spot prices for one iteration."""
        logger.debug(f"Fetching Bybit spot prices...")

        prices = await self._fetch_spot_prices()

        if not prices:
            logger.warning(f"No prices fetched from Bybit")
            return

        stored_count = await self._store_prices(prices)
        logger.info(f"Stored {stored_count} Bybit spot prices")

    async def _fetch_spot_prices(self) -> List[Dict[str, Any]]:
        """Fetch spot prices from Bybit API."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    self.api_url,
                    params={"category": "spot"},
                    headers={"Accept": "application/json"}
                )
                response.raise_for_status()
                data = response.json()

                if data.get("retCode") != 0:
                    logger.error(f"Bybit API error: {data.get('retMsg')}")
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
                    base_symbol = symbol[:-4]  # Remove "USDT"

                    # Only process target symbols
                    if base_symbol not in TARGET_SYMBOLS:
                        continue

                    last_price = item.get("lastPrice")
                    volume = item.get("volume24h")

                    if last_price is None:
                        continue

                    try:
                        price_value = float(last_price)
                        volume_value = float(volume) if volume else None
                    except (ValueError, TypeError):
                        continue

                    prices.append({
                        'symbol': base_symbol,
                        'price': price_value,
                        'volume_24h': volume_value
                    })

                return prices

        except Exception as e:
            logger.error(f"Error fetching Bybit spot prices: {e}")
            return []

    async def _store_prices(self, prices: List[Dict[str, Any]]) -> int:
        """Store spot prices in database."""
        db = get_db_session()
        stored_count = 0

        try:
            for price_data in prices:
                new_price = SpotPrice(
                    exchange='bybit',
                    symbol=price_data['symbol'],
                    price=price_data['price'],
                    volume_24h=price_data.get('volume_24h'),
                    timestamp=datetime.utcnow()
                )

                db.add(new_price)
                stored_count += 1

            db.commit()
            return stored_count

        except Exception as e:
            logger.error(f"Error storing Bybit spot prices: {e}")
            db.rollback()
            return 0

        finally:
            db.close()
