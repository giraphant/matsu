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

        total_stored = 0

        for adapter in self.adapters:
            try:
                # Fetch rates from this exchange
                rates = await adapter.fetch_funding_rates()

                if not rates:
                    logger.warning(f"[{adapter.exchange_name}] No rates fetched")
                    continue

                # Filter to top 50 by volume/turnover (if volume data available)
                filtered_rates = self._filter_top_by_volume(rates, limit=50)

                if len(filtered_rates) < len(rates):
                    logger.info(f"[{adapter.exchange_name}] Filtered {len(rates)} → {len(filtered_rates)} (top 50 by volume)")

                # Store in database
                stored_count = await self._store_rates(adapter.exchange_name, filtered_rates)
                total_stored += stored_count

                logger.info(f"[{adapter.exchange_name}] Stored {stored_count} rates")

            except Exception as e:
                logger.error(f"[{adapter.exchange_name}] Error: {e}", exc_info=True)
                # Continue with other exchanges

        logger.info(f"Total stored: {total_stored} funding rates across {len(self.adapters)} exchanges")

    def _filter_top_by_volume(self, rates: List[dict], limit: int = 50) -> List[dict]:
        """
        Filter funding rates to top N by volume/turnover.

        Args:
            rates: List of funding rate dicts (may include 'volume_24h' or 'turnover_24h')
            limit: Maximum number of rates to keep

        Returns:
            Filtered list (top N by volume, or all if no volume data)
        """
        if not rates or len(rates) <= limit:
            return rates

        # Check if rates have volume/turnover data
        has_volume = any(r.get('volume_24h') is not None or r.get('turnover_24h') is not None for r in rates)

        if not has_volume:
            # No volume data, return all
            return rates

        # Sort by turnover (preferred) or volume, then take top N
        def get_volume_key(rate):
            # Prefer turnover_24h (USDT value), fallback to volume_24h
            turnover = rate.get('turnover_24h')
            if turnover is not None:
                try:
                    return float(turnover)
                except (ValueError, TypeError):
                    pass

            volume = rate.get('volume_24h')
            if volume is not None:
                try:
                    return float(volume)
                except (ValueError, TypeError):
                    pass

            return 0

        # Sort descending by volume
        sorted_rates = sorted(rates, key=get_volume_key, reverse=True)
        return sorted_rates[:limit]

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
