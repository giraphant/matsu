"""
Repository for alert-related operations.
Encapsulates all database queries for AlertConfig and AlertState models.
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.database import AlertConfig, AlertState
from app.core.logger import get_logger

logger = get_logger(__name__)


class AlertRepository:
    """Repository for AlertConfig model."""

    def __init__(self, db: Session):
        """
        Initialize alert repository.

        Args:
            db: Database session
        """
        self.db = db

    def get_by_monitor_id(self, monitor_id: str) -> Optional[AlertConfig]:
        """
        Get alert configuration by monitor ID.

        Args:
            monitor_id: Monitor identifier

        Returns:
            AlertConfig or None
        """
        return self.db.query(AlertConfig).filter(
            AlertConfig.monitor_id == monitor_id
        ).first()

    def get_all(self) -> List[AlertConfig]:
        """
        Get all alert configurations.

        Returns:
            List of AlertConfig records
        """
        return self.db.query(AlertConfig).all()

    def create(self, alert_config: AlertConfig) -> AlertConfig:
        """
        Create a new alert configuration.

        Args:
            alert_config: AlertConfig instance

        Returns:
            Created AlertConfig
        """
        self.db.add(alert_config)
        self.db.commit()
        self.db.refresh(alert_config)
        logger.debug(f"Created alert config: {alert_config.monitor_id}")
        return alert_config

    def update(self, monitor_id: str, **kwargs) -> Optional[AlertConfig]:
        """
        Update alert configuration.

        Args:
            monitor_id: Monitor identifier
            **kwargs: Fields to update

        Returns:
            Updated AlertConfig or None
        """
        config = self.get_by_monitor_id(monitor_id)
        if config:
            for key, value in kwargs.items():
                setattr(config, key, value)
            config.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(config)
            logger.debug(f"Updated alert config: {monitor_id}")
        return config

    def delete(self, monitor_id: str) -> bool:
        """
        Delete alert configuration.

        Args:
            monitor_id: Monitor identifier

        Returns:
            True if deleted, False if not found
        """
        config = self.get_by_monitor_id(monitor_id)
        if config:
            self.db.delete(config)
            self.db.commit()
            logger.debug(f"Deleted alert config: {monitor_id}")
            return True
        return False


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
