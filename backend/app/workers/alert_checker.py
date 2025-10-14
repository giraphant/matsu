"""
Funding rate alert checker worker.
Periodically checks funding rates against alert thresholds and triggers notifications.
"""

from app.monitors.base import BaseMonitor


class AlertChecker(BaseMonitor):
    """Worker to check funding rate alerts."""

    def __init__(self, interval: int = 60):
        """
        Initialize alert checker.

        Args:
            interval: Seconds between alert checks (default: 60)
        """
        super().__init__(name="Funding Rate Alert Checker", interval=interval)

    async def run(self) -> None:
        """Check funding rate alerts."""
        from app.api.dex import check_funding_rate_alerts

        try:
            await check_funding_rate_alerts()
        except Exception as e:
            print(f"[{self.name}] Error checking alerts: {e}")
            raise
