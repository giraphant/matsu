"""
DEX funding rates cache warmer worker.
Periodically refreshes the cached DEX funding rates to ensure fresh data.
"""

from app.monitors.base import BaseMonitor


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
            print(f"[{self.name}] DEX funding rates cache refreshed")
        except Exception as e:
            print(f"[{self.name}] Failed to refresh DEX cache: {e}")
            raise
