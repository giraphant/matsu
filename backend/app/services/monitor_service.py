"""
Monitor Service
Business logic for monitor operations.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
import uuid

from app.models.database import Monitor, MonitorValue
from app.repositories.monitor_repo import MonitorRepository
from app.services.formula_engine import FormulaEngine
from app.core.logger import get_logger

logger = get_logger(__name__)


class MonitorService:
    """Service for monitor business logic."""

    def __init__(self, db: Session):
        self.db = db
        self.repo = MonitorRepository(db)
        self.formula_engine = FormulaEngine(db)

    def create_monitor(
        self,
        name: str,
        formula: str,
        unit: Optional[str] = None,
        description: Optional[str] = None,
        color: Optional[str] = None,
        decimal_places: int = 2,
        monitor_id: Optional[str] = None
    ) -> Optional[Monitor]:
        """
        Create a new monitor. All monitors are just formulas.

        Args:
            name: Monitor name
            formula: The formula (constant, reference, or computation)
            unit: Display unit
            description: Description
            color: Display color
            decimal_places: Number of decimal places
            monitor_id: Optional custom ID

        Returns:
            Created Monitor or None if validation fails
        """
        # Check circular dependency
        temp_id = monitor_id or f"temp_{uuid.uuid4().hex[:8]}"
        if self.formula_engine.check_circular_dependency(temp_id, formula):
            logger.error(f"Circular dependency detected in formula: {formula}")
            return None

        # Generate ID if not provided
        if not monitor_id:
            monitor_id = f"monitor_{uuid.uuid4().hex[:12]}"

        # Create monitor
        monitor = Monitor(
            id=monitor_id,
            name=name,
            formula=formula,
            unit=unit,
            description=description,
            color=color,
            decimal_places=decimal_places,
            enabled=True
        )

        created = self.repo.create(monitor)

        # Compute initial value
        self.formula_engine.compute_monitor_value(created.id)

        return created

    def update_monitor(self, monitor_id: str, updates: Dict[str, Any]) -> Optional[Monitor]:
        """Update monitor."""
        # If formula is being updated, check for circular dependencies
        if 'formula' in updates:
            if self.formula_engine.check_circular_dependency(monitor_id, updates['formula']):
                logger.error(f"Circular dependency detected in updated formula")
                return None

        updated = self.repo.update(monitor_id, updates)

        # Recompute if formula changed
        if updated and 'formula' in updates:
            self.formula_engine.compute_monitor_value(updated.id)

        return updated

    def delete_monitor(self, monitor_id: str) -> bool:
        """Delete monitor."""
        return self.repo.delete(monitor_id)

    def get_monitor(self, monitor_id: str) -> Optional[Monitor]:
        """Get monitor by ID."""
        return self.repo.get_by_id(monitor_id)

    def get_all_monitors(self, enabled_only: bool = False) -> List[Monitor]:
        """Get all monitors, optionally filtered by enabled status."""
        return self.repo.get_all(enabled_only=enabled_only)

    def get_monitor_with_value(self, monitor_id: str) -> Optional[Dict[str, Any]]:
        """
        Get monitor with its current value.

        Returns:
            Dictionary with monitor info and current value
        """
        monitor = self.repo.get_by_id(monitor_id)
        if not monitor:
            return None

        # Get latest value
        latest_value = self.repo.get_latest_value(monitor_id)

        return {
            'id': monitor.id,
            'name': monitor.name,
            'formula': monitor.formula,
            'unit': monitor.unit,
            'description': monitor.description,
            'color': monitor.color,
            'decimal_places': monitor.decimal_places,
            'enabled': monitor.enabled,
            'value': latest_value.value if latest_value else None,
            'computed_at': latest_value.computed_at if latest_value else None,
            'created_at': monitor.created_at,
            'updated_at': monitor.updated_at
        }

    def get_all_monitors_with_values(self) -> List[Dict[str, Any]]:
        """Get all monitors with their current values."""
        monitors = self.get_all_monitors()
        result = []

        for monitor in monitors:
            monitor_data = self.get_monitor_with_value(monitor.id)
            if monitor_data:
                result.append(monitor_data)

        return result

    def recompute_all(self):
        """Recompute all enabled monitor values."""
        # Only recompute enabled monitors
        monitors = self.get_all_monitors(enabled_only=True)
        recomputed = []

        for monitor in monitors:
            value = self.formula_engine.compute_monitor_value(monitor.id)
            if value is not None:
                recomputed.append(monitor.id)

        logger.info(f"Recomputed {len(recomputed)} monitors")
        return recomputed

    def trigger_recompute_on_webhook(self, webhook_monitor_id: str):
        """
        Trigger recomputation when webhook data arrives.

        Args:
            webhook_monitor_id: The monitor_id from webhook (monitoring_data table)
        """
        dependency = f"webhook:{webhook_monitor_id}"
        recomputed = self.formula_engine.recompute_dependent_monitors(dependency)
        logger.info(f"Webhook {webhook_monitor_id} triggered recompute of {len(recomputed)} monitors")
        return recomputed
