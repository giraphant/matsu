"""
Funding rate alert checker worker.
Periodically checks funding rates against alert thresholds and triggers notifications.
"""

from app.core.logger import get_logger
from app.background_tasks.base import BaseMonitor

logger = get_logger(__name__)


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
            logger.error(f"Error checking alerts: {e}")
            raise
