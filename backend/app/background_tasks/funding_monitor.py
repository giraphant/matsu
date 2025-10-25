"""
Funding rates monitor (coordinator).
Orchestrates fetching funding rates from all exchanges.
"""

from datetime import datetime
from typing import List, Type

from app.core.logger import get_logger
from app.models.database import FundingRate, get_db_session
# Direct import to avoid circular dependency from __init__.py
from app.background_tasks.base import BaseMonitor
from app.background_tasks.exchanges.base import BaseExchangeAdapter
from app.background_tasks.exchanges import (
    BinanceAdapter,
    BybitAdapter,
    HyperliquidAdapter,
    LighterAdapter,
    AsterAdapter,
    GRVTAdapter,
    BackpackAdapter,
)

logger = get_logger(__name__)


class FundingRateMonitor(BaseMonitor):
    """
    Main funding rates monitor.

    Coordinates fetching funding rates from all supported exchanges
    and stores them in the database.
    """

    # Exchanges that support funding rates
    EXCHANGES: List[Type[BaseExchangeAdapter]] = [
        BinanceAdapter,
        BybitAdapter,
        HyperliquidAdapter,
        LighterAdapter,
        AsterAdapter,
        GRVTAdapter,
        BackpackAdapter,
    ]

    def __init__(self, interval: int = 300):
        """
        Initialize funding rates monitor.

        Args:
            interval: Seconds between checks (default: 300 = 5 minutes)
        """
        super().__init__(name="Funding Rates Coordinator", interval=interval)
        self.adapters = [ExchangeCls() for ExchangeCls in self.EXCHANGES]

    async def run(self) -> None:
        """Fetch funding rates from all exchanges."""
        logger.debug("Fetching funding rates from all exchanges...")

        # Step 1: Fetch all rates from all exchanges
        all_rates = {}  # {exchange_name: [rates]}

        for adapter in self.adapters:
            try:
                rates = await adapter.fetch_funding_rates()

                if not rates:
                    logger.warning(f"[{adapter.exchange_name}] No rates fetched")
                    continue

                all_rates[adapter.exchange_name] = rates
                logger.info(f"[{adapter.exchange_name}] Fetched {len(rates)} rates")

            except Exception as e:
                logger.error(f"[{adapter.exchange_name}] Error: {e}", exc_info=True)
                # Continue with other exchanges

        # Step 2: Group by symbol and find max volume for each symbol across all exchanges
        symbol_max_volume = {}  # {symbol: max_volume}

        for exchange_name, rates in all_rates.items():
            for rate in rates:
                symbol = rate.get("symbol")
                if not symbol:
                    continue

                # Get volume/turnover
                volume = rate.get("turnover_24h") or rate.get("volume_24h")
                if volume is not None:
                    try:
                        volume = float(volume)
                        # Track max volume for this symbol across all exchanges
                        if symbol not in symbol_max_volume or volume > symbol_max_volume[symbol]:
                            symbol_max_volume[symbol] = volume
                    except (ValueError, TypeError):
                        pass

        # Step 3: Get top 50 symbols by volume
        if symbol_max_volume:
            top_symbols = sorted(symbol_max_volume.keys(), key=lambda s: symbol_max_volume[s], reverse=True)[:50]
            top_symbols_set = set(top_symbols)
            logger.info(f"Selected top 50 symbols by volume: {', '.join(list(top_symbols)[:10])}...")
        else:
            # No volume data available, keep all symbols
            top_symbols_set = None
            logger.info("No volume data available, storing all symbols")

        # Step 4: Filter and store rates for each exchange
        total_stored = 0

        for exchange_name, rates in all_rates.items():
            # Filter to top 50 symbols (if we have volume data)
            if top_symbols_set:
                filtered_rates = [r for r in rates if r.get("symbol") in top_symbols_set]
                if len(filtered_rates) < len(rates):
                    logger.info(f"[{exchange_name}] Filtered {len(rates)} → {len(filtered_rates)} (top 50 symbols)")
            else:
                filtered_rates = rates

            # Store in database
            stored_count = await self._store_rates(exchange_name, filtered_rates)
            total_stored += stored_count
            logger.info(f"[{exchange_name}] Stored {stored_count} rates")

        logger.info(f"Total stored: {total_stored} funding rates across {len(all_rates)} exchanges")

    async def _store_rates(self, exchange_name: str, rates: List[dict]) -> int:
        """
        Store funding rates in database.

        Args:
            exchange_name: Exchange identifier
            rates: List of rate dictionaries

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
                    logger.warning(f"[{exchange_name}] Skipping invalid entry: {entry}")
                    continue

                # Create funding rate entry
                new_rate = FundingRate(
                    exchange=exchange_name,
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
            logger.error(f"[{exchange_name}] Error storing rates: {e}")
            db.rollback()
            return 0

        finally:
            db.close()
