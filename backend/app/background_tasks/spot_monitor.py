"""
Spot prices monitor (coordinator).
Orchestrates fetching spot prices from all exchanges.
"""

import json
from datetime import datetime
from typing import List, Type, Optional

from app.core.logger import get_logger
from app.models.database import SpotPrice, AppSetting, get_db_session
from app.background_tasks.base import BaseMonitor
from app.background_tasks.exchanges.base import BaseExchangeAdapter
from app.background_tasks.exchanges import (
    BinanceAdapter,
    BybitAdapter,
    OKXAdapter,
    JupiterAdapter,
    PythAdapter,
)

logger = get_logger(__name__)


class SpotPriceMonitor(BaseMonitor):
    """
    Main spot prices monitor.

    Coordinates fetching spot prices from all supported exchanges
    and stores them in the database.
    """

    # Exchanges that support spot prices
    EXCHANGES: List[Type[BaseExchangeAdapter]] = [
        BinanceAdapter,
        BybitAdapter,
        OKXAdapter,
        JupiterAdapter,
        PythAdapter,
    ]

    def __init__(self, interval: int = 60):
        """
        Initialize spot prices monitor.

        Args:
            interval: Seconds between checks (default: 60 = 1 minute)
        """
        super().__init__(name="Spot Prices Coordinator", interval=interval)
        self.adapters = [ExchangeCls() for ExchangeCls in self.EXCHANGES]

    def _get_cex_target_symbols(self) -> Optional[List[str]]:
        """
        Get target symbols for CEX spot prices from database settings.

        Returns:
            List of symbols (e.g., ["BTC", "ETH", "SOL"]) or None for all symbols
        """
        db = get_db_session()
        try:
            setting = db.query(AppSetting).filter(
                AppSetting.key == 'spot_target_symbols'
            ).first()

            if not setting or not setting.value:
                # Default: BTC, ETH, SOL if not configured
                return ["BTC", "ETH", "SOL"]

            # Parse JSON array
            try:
                symbols = json.loads(setting.value)
                if isinstance(symbols, list):
                    return [s.upper() for s in symbols]
                else:
                    logger.warning("spot_target_symbols is not a list, using default")
                    return ["BTC", "ETH", "SOL"]
            except json.JSONDecodeError:
                logger.error("Failed to parse spot_target_symbols, using default")
                return ["BTC", "ETH", "SOL"]

        except Exception as e:
            logger.error(f"Error reading spot_target_symbols: {e}")
            return ["BTC", "ETH", "SOL"]
        finally:
            db.close()

    async def run(self) -> None:
        """Fetch spot prices from all exchanges."""
        logger.debug("Fetching spot prices from all exchanges...")

        # Get target symbols for CEX (Binance, Bybit, OKX)
        cex_target_symbols = self._get_cex_target_symbols()
        logger.debug(f"CEX target symbols: {cex_target_symbols}")

        total_stored = 0

        for adapter in self.adapters:
            try:
                # CEX adapters (Binance, Bybit, OKX) support filtering
                # Jupiter and Pyth have hardcoded token lists
                if adapter.exchange_name in ['binance', 'bybit', 'okx']:
                    prices = await adapter.fetch_spot_prices(target_symbols=cex_target_symbols)
                else:
                    # Jupiter and Pyth don't support filtering (hardcoded lists)
                    prices = await adapter.fetch_spot_prices()

                if not prices:
                    logger.warning(f"[{adapter.exchange_name}] No prices fetched")
                    continue

                # Store in database
                stored_count = await self._store_prices(adapter.exchange_name, prices)
                total_stored += stored_count

                logger.info(f"[{adapter.exchange_name}] Stored {stored_count} prices")

            except Exception as e:
                logger.error(f"[{adapter.exchange_name}] Error: {e}", exc_info=True)
                # Continue with other exchanges

        logger.info(f"Total stored: {total_stored} spot prices across {len(self.adapters)} exchanges")

    async def _store_prices(self, exchange_name: str, prices: List[dict]) -> int:
        """
        Store spot prices in database.

        Args:
            exchange_name: Exchange identifier
            prices: List of price dictionaries

        Returns:
            Number of prices stored
        """
        db = get_db_session()
        stored_count = 0

        try:
            for entry in prices:
                # Validate required fields
                symbol = entry.get("symbol")
                price = entry.get("price")

                if not symbol or price is None:
                    logger.warning(f"[{exchange_name}] Skipping invalid entry: {entry}")
                    continue

                # Create spot price entry
                new_price = SpotPrice(
                    exchange=exchange_name,
                    symbol=symbol,
                    price=float(price),
                    volume_24h=float(entry["volume_24h"]) if entry.get("volume_24h") else None,
                    timestamp=datetime.utcnow()
                )

                db.add(new_price)
                stored_count += 1

            db.commit()
            return stored_count

        except Exception as e:
            logger.error(f"[{exchange_name}] Error storing prices: {e}")
            db.rollback()
            return 0

        finally:
            db.close()
