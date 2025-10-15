"""
Repository for alert-related operations.
Encapsulates all database queries for AlertState model.
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.database import AlertState
from app.core.logger import get_logger

logger = get_logger(__name__)


class AlertStateRepository:
    """Repository for AlertState model."""

    def __init__(self, db: Session):
        """
        Initialize alert state repository.

        Args:
            db: Database session
        """
        self.db = db

    def get_active_by_monitor_id(self, monitor_id: str) -> Optional[AlertState]:
        """
        Get active alert state for a monitor.

        Args:
            monitor_id: Monitor identifier

        Returns:
            AlertState or None
        """
        return self.db.query(AlertState).filter(
            AlertState.monitor_id == monitor_id,
            AlertState.is_active == True
        ).first()

    def get_all_active(self) -> List[AlertState]:
        """
        Get all active alert states.

        Returns:
            List of active AlertState records
        """
        return self.db.query(AlertState).filter(
            AlertState.is_active == True
        ).all()

    def create(self, alert_state: AlertState) -> AlertState:
        """
        Create a new alert state.

        Args:
            alert_state: AlertState instance

        Returns:
            Created AlertState
        """
        self.db.add(alert_state)
        self.db.commit()
        self.db.refresh(alert_state)
        logger.debug(f"Created alert state: {alert_state.monitor_id}")
        return alert_state

    def update_notification_count(self, state_id: int) -> Optional[AlertState]:
        """
        Update notification count and last notified time.

        Args:
            state_id: AlertState ID

        Returns:
            Updated AlertState or None
        """
        state = self.db.query(AlertState).filter(AlertState.id == state_id).first()
        if state:
            state.notification_count += 1
            state.last_notified_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(state)
            logger.debug(f"Updated notification count for alert state: {state_id}")
        return state

    def resolve(self, monitor_id: str) -> bool:
        """
        Resolve active alert for a monitor.

        Args:
            monitor_id: Monitor identifier

        Returns:
            True if resolved, False if no active alert
        """
        state = self.get_active_by_monitor_id(monitor_id)
        if state:
            state.is_active = False
            state.resolved_at = datetime.utcnow()
            self.db.commit()
            logger.debug(f"Resolved alert state: {monitor_id}")
            return True
        return False
