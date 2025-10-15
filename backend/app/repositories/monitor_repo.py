"""
Repository for Monitor operations.
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.database import Monitor, MonitorValue
from app.core.logger import get_logger

logger = get_logger(__name__)


class MonitorRepository:
    """Repository for Monitor model."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, monitor_id: str) -> Optional[Monitor]:
        """Get monitor by ID."""
        return self.db.query(Monitor).filter(Monitor.id == monitor_id).first()

    def get_all(self, enabled_only: bool = True) -> List[Monitor]:
        """Get all monitors."""
        query = self.db.query(Monitor)
        if enabled_only:
            query = query.filter(Monitor.enabled == True)
        return query.order_by(Monitor.created_at).all()

    def create(self, monitor: Monitor) -> Monitor:
        """Create a new monitor."""
        self.db.add(monitor)
        self.db.commit()
        self.db.refresh(monitor)
        logger.info(f"Created monitor: {monitor.id}")
        return monitor

    def update(self, monitor_id: str, updates: dict) -> Optional[Monitor]:
        """Update monitor."""
        monitor = self.get_by_id(monitor_id)
        if not monitor:
            return None

        for key, value in updates.items():
            if hasattr(monitor, key):
                setattr(monitor, key, value)

        self.db.commit()
        self.db.refresh(monitor)
        logger.info(f"Updated monitor: {monitor_id}")
        return monitor

    def delete(self, monitor_id: str) -> bool:
        """Delete monitor."""
        monitor = self.get_by_id(monitor_id)
        if not monitor:
            return False

        # Also delete cached values
        self.db.query(MonitorValue).filter(MonitorValue.monitor_id == monitor_id).delete()

        self.db.delete(monitor)
        self.db.commit()
        logger.info(f"Deleted monitor: {monitor_id}")
        return True

    def get_latest_value(self, monitor_id: str) -> Optional[MonitorValue]:
        """Get latest computed value for monitor."""
        return self.db.query(MonitorValue).filter(
            MonitorValue.monitor_id == monitor_id
        ).order_by(desc(MonitorValue.computed_at)).first()

    def get_value_history(self, monitor_id: str, limit: int = 100) -> List[MonitorValue]:
        """Get value history for monitor."""
        return self.db.query(MonitorValue).filter(
            MonitorValue.monitor_id == monitor_id
        ).order_by(desc(MonitorValue.computed_at)).limit(limit).all()
