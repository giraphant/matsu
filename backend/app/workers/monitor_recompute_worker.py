"""
Monitor Recompute Worker
Periodically recomputes all enabled monitors to keep values up-to-date.
"""

from app.core.logger import get_logger
from app.background_tasks.base import BaseMonitor
from app.models.database import get_db_session
from app.services.monitor_service import MonitorService

logger = get_logger(__name__)


class MonitorRecomputeWorker(BaseMonitor):
    """Worker to periodically recompute all monitor values."""

    def __init__(self, interval: int = 10):
        """
        Initialize monitor recompute worker.

        Args:
            interval: Seconds between recompute runs (default: 10)
        """
        super().__init__(name="Monitor Recompute Worker", interval=interval)

    async def run(self) -> None:
        """Recompute all enabled monitors."""
        db = get_db_session()
        try:
            service = MonitorService(db)
            recomputed = service.recompute_all()

            if recomputed:
                logger.info(f"[MonitorRecompute] Recomputed {len(recomputed)} monitors")
            else:
                logger.debug(f"[MonitorRecompute] No monitors to recompute")

        except Exception as e:
            logger.error(f"[MonitorRecompute] Error recomputing monitors: {e}")
        finally:
            db.close()
