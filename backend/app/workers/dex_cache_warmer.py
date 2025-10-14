"""
DEX funding rates cache warmer worker.
Periodically refreshes the cached DEX funding rates to ensure fresh data.
"""

from app.core.logger import get_logger
from app.monitors.base import BaseMonitor

logger = get_logger(__name__)


class DexCacheWarmer(BaseMonitor):
    """Worker to warm up DEX funding rates cache."""

    def __init__(self, interval: int = 60):
        """
        Initialize DEX cache warmer.

        Args:
            interval: Seconds between cache refreshes (default: 60)
        """
        super().__init__(name="DEX Cache Warmer", interval=interval)

    async def run(self) -> None:
        """Refresh the DEX funding rates cache."""
        from app.api.dex import get_cached_rates

        try:
            await get_cached_rates(force_refresh=True)
            logger.debug(f"DEX funding rates cache refreshed")
        except Exception as e:
            logger.error(f"Failed to refresh DEX cache: {e}")
            raise
