"""
DEPRECATED: Webhook Monitor alert checker worker.
This worker is deprecated and should not be used. It checks the old AlertConfig system.
The new AlertRule system is now used instead. This file is kept for reference only.

Legacy documentation:
Periodically checks AlertConfig rules against webhook monitor values and sends Pushover notifications.
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.core.logger import get_logger
from app.monitors.base import BaseMonitor
from app.models.database import get_db_session, AlertState, MonitoringData
from app.services.pushover import PushoverService, format_alert_message

logger = get_logger(__name__)


class WebhookMonitorAlertChecker(BaseMonitor):
    """Worker to check webhook monitor alert rules and send Pushover notifications."""

    def __init__(self, interval: int = 30):
        """
        Initialize webhook monitor alert checker.

        Args:
            interval: Seconds between alert checks (default: 30)
        """
        super().__init__(name="Webhook Monitor Alert Checker", interval=interval)

    async def run(self) -> None:
        """
        DEPRECATED: This method is no longer active.
        The AlertConfig system has been removed. Use AlertRule system instead.
        """
        logger.warning("[WebhookMonitorAlertChecker] This worker is deprecated and disabled. Use AlertRule system instead.")
