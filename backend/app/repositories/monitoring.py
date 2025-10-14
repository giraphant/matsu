"""
Repository for monitoring data operations.
Encapsulates all database queries for MonitoringData model.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc

from app.models.database import MonitoringData
from app.core.logger import get_logger

logger = get_logger(__name__)


class MonitoringRepository:
    """Repository for MonitoringData model with specialized queries."""

    def __init__(self, db: Session):
        """
        Initialize monitoring repository.

        Args:
            db: Database session
        """
        self.db = db

    def get_by_id(self, data_id: int) -> Optional[MonitoringData]:
        """Get monitoring data by ID."""
        return self.db.query(MonitoringData).filter(MonitoringData.id == data_id).first()

    def get_by_monitor_id(
        self,
        monitor_id: str,
        limit: int = 100,
        offset: int = 0,
        order_by: str = "timestamp",
        order_dir: str = "desc"
    ) -> List[MonitoringData]:
        """
        Get monitoring data for a specific monitor.

        Args:
            monitor_id: Monitor identifier
            limit: Maximum number of records
            offset: Number of records to skip
            order_by: Field to order by
            order_dir: Order direction (asc/desc)

        Returns:
            List of MonitoringData records
        """
        query = self.db.query(MonitoringData).filter(
            MonitoringData.monitor_id == monitor_id
        )

        # Apply ordering
        order_field = getattr(MonitoringData, order_by, MonitoringData.timestamp)
        if order_dir.lower() == "asc":
            query = query.order_by(asc(order_field))
        else:
            query = query.order_by(desc(order_field))

        return query.offset(offset).limit(limit).all()

    def get_by_date_range(
        self,
        start_date: datetime,
        end_date: datetime,
        monitor_id: Optional[str] = None,
        limit: int = 100
    ) -> List[MonitoringData]:
        """
        Get monitoring data within a date range.

        Args:
            start_date: Start of date range
            end_date: End of date range
            monitor_id: Optional monitor filter
            limit: Maximum number of records

        Returns:
            List of MonitoringData records
        """
        query = self.db.query(MonitoringData).filter(
            MonitoringData.timestamp >= start_date,
            MonitoringData.timestamp <= end_date
        )

        if monitor_id:
            query = query.filter(MonitoringData.monitor_id == monitor_id)

        return query.order_by(desc(MonitoringData.timestamp)).limit(limit).all()

    def get_latest(self, monitor_id: str) -> Optional[MonitoringData]:
        """
        Get the latest record for a monitor.

        Args:
            monitor_id: Monitor identifier

        Returns:
            Latest MonitoringData record or None
        """
        return self.db.query(MonitoringData).filter(
            MonitoringData.monitor_id == monitor_id
        ).order_by(desc(MonitoringData.timestamp)).first()

    def get_summary_statistics(self, monitor_id: str) -> Dict[str, Any]:
        """
        Get summary statistics for a monitor.

        Args:
            monitor_id: Monitor identifier

        Returns:
            Dictionary with statistics (min, max, avg, count, etc.)
        """
        stats = self.db.query(
            func.count(MonitoringData.id).label('total_records'),
            func.min(MonitoringData.value).label('min_value'),
            func.max(MonitoringData.value).label('max_value'),
            func.avg(MonitoringData.value).label('avg_value'),
            func.sum(func.cast(MonitoringData.is_change, int)).label('change_count')
        ).filter(
            MonitoringData.monitor_id == monitor_id
        ).first()

        latest = self.get_latest(monitor_id)

        return {
            'monitor_id': monitor_id,
            'total_records': stats.total_records or 0,
            'min_value': float(stats.min_value) if stats.min_value is not None else None,
            'max_value': float(stats.max_value) if stats.max_value is not None else None,
            'avg_value': float(stats.avg_value) if stats.avg_value is not None else None,
            'change_count': stats.change_count or 0,
            'latest_value': latest.value if latest else None,
            'latest_timestamp': latest.timestamp if latest else None,
            'monitor_name': latest.monitor_name if latest else None,
            'monitor_type': latest.monitor_type if latest else 'monitor',
            'url': latest.url if latest else '',
            'unit': latest.unit if latest else None,
            'decimal_places': latest.decimal_places if latest else 2,
            'color': latest.color if latest else None,
            'description': latest.description if latest else None
        }

    def get_all_monitors_summary(self) -> List[Dict[str, Any]]:
        """
        Get summary statistics for all monitors.

        Returns:
            List of dictionaries with statistics for each monitor
        """
        # Get unique monitor IDs
        monitor_ids = self.db.query(MonitoringData.monitor_id).distinct().all()

        summaries = []
        for (monitor_id,) in monitor_ids:
            summary = self.get_summary_statistics(monitor_id)
            summaries.append(summary)

        return summaries

    def create(self, data: MonitoringData) -> MonitoringData:
        """
        Create a new monitoring data record.

        Args:
            data: MonitoringData instance

        Returns:
            Created MonitoringData record
        """
        self.db.add(data)
        self.db.commit()
        self.db.refresh(data)
        logger.debug(f"Created monitoring data: {data.monitor_id}")
        return data

    def delete_old_records(self, days: int = 30) -> int:
        """
        Delete records older than specified days.

        Args:
            days: Number of days to keep

        Returns:
            Number of deleted records
        """
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        count = self.db.query(MonitoringData).filter(
            MonitoringData.timestamp < cutoff_date
        ).delete()

        self.db.commit()
        logger.info(f"Deleted {count} old monitoring records (older than {days} days)")
        return count
