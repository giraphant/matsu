"""
Alert Engine
Evaluates alert rules and triggers notifications.
"""

import re
import json
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.database import AlertRule, AlertState as OldAlertState
from app.services.formula_engine import FormulaEngine
from app.core.logger import get_logger

logger = get_logger(__name__)


class AlertEngine:
    """
    Engine for evaluating and triggering alerts.

    Alert conditions are formulas that evaluate to boolean:
    - "${monitor:btc} > 50000"
    - "${monitor:diff} < ${monitor:threshold}"
    - "abs(${monitor:spread}) > 100"
    """

    # Comparison operators pattern
    COMPARISON_PATTERN = re.compile(r'(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+)')

    def __init__(self, db: Session):
        self.db = db
        self.formula_engine = FormulaEngine(db)

    def evaluate_condition(self, condition: str) -> Optional[bool]:
        """
        Evaluate an alert condition.

        Args:
            condition: Condition formula (e.g., "${monitor:btc} > 50000")

        Returns:
            True if condition met, False if not, None if cannot evaluate
        """
        try:
            # Parse condition into left, operator, right
            match = self.COMPARISON_PATTERN.match(condition.strip())
            if not match:
                logger.error(f"Invalid condition format: {condition}")
                return None

            left_expr = match.group(1).strip()
            operator = match.group(2)
            right_expr = match.group(3).strip()

            # Evaluate left side
            left_value = self.formula_engine.evaluate(left_expr)
            if left_value is None:
                logger.debug(f"Cannot evaluate left side: {left_expr}")
                return None

            # Evaluate right side
            right_value = self.formula_engine.evaluate(right_expr)
            if right_value is None:
                logger.debug(f"Cannot evaluate right side: {right_expr}")
                return None

            # Compare
            if operator == '>':
                return left_value > right_value
            elif operator == '>=':
                return left_value >= right_value
            elif operator == '<':
                return left_value < right_value
            elif operator == '<=':
                return left_value <= right_value
            elif operator == '==':
                return abs(left_value - right_value) < 1e-10  # Float comparison
            elif operator == '!=':
                return abs(left_value - right_value) >= 1e-10
            else:
                logger.error(f"Unknown operator: {operator}")
                return None

        except Exception as e:
            logger.error(f"Error evaluating condition '{condition}': {e}")
            return None

    def check_alert(self, alert_rule: AlertRule) -> Optional[Dict[str, Any]]:
        """
        Check if an alert rule should trigger.

        Args:
            alert_rule: AlertRule to check

        Returns:
            Alert trigger info if triggered, None otherwise
        """
        if not alert_rule.enabled:
            return None

        # Check cooldown
        last_trigger = self.db.query(OldAlertState).filter(
            OldAlertState.monitor_id == alert_rule.id,
            OldAlertState.is_active == True
        ).order_by(OldAlertState.triggered_at.desc()).first()

        if last_trigger:
            time_since = datetime.utcnow() - last_trigger.triggered_at
            if time_since.total_seconds() < alert_rule.cooldown_seconds:
                logger.debug(f"Alert {alert_rule.id} in cooldown")
                return None

        # Evaluate condition
        is_triggered = self.evaluate_condition(alert_rule.condition)

        if is_triggered:
            # Get the actual value for the alert message
            # Try to extract monitor reference from condition
            parsed_expr, dependencies = self.formula_engine.parse_formula(alert_rule.condition)
            values = self.formula_engine.resolve_dependencies(dependencies)

            # Get first non-None value as representative value
            trigger_value = next((v for v in values.values() if v is not None), None)

            return {
                'alert_id': alert_rule.id,
                'alert_name': alert_rule.name,
                'condition': alert_rule.condition,
                'level': alert_rule.level,
                'trigger_value': trigger_value,
                'actions': json.loads(alert_rule.actions) if alert_rule.actions else []
            }

        return None

    def check_all_alerts(self) -> List[Dict[str, Any]]:
        """
        Check all enabled alert rules.

        Returns:
            List of triggered alerts
        """
        alerts = self.db.query(AlertRule).filter(AlertRule.enabled == True).all()
        triggered = []

        for alert in alerts:
            trigger_info = self.check_alert(alert)
            if trigger_info:
                triggered.append(trigger_info)

        return triggered

    def record_trigger(self, alert_id: str, trigger_value: Optional[float] = None):
        """Record an alert trigger."""
        state = OldAlertState(
            monitor_id=alert_id,  # Using monitor_id field for alert_id
            alert_level='medium',  # Default level
            triggered_at=datetime.utcnow(),
            last_notified_at=datetime.utcnow(),
            notification_count=1,
            is_active=True
        )
        self.db.add(state)
        self.db.commit()
        logger.info(f"Recorded alert trigger: {alert_id}")

    def resolve_alert(self, alert_id: str):
        """Mark an alert as resolved."""
        states = self.db.query(OldAlertState).filter(
            OldAlertState.monitor_id == alert_id,
            OldAlertState.is_active == True
        ).all()

        for state in states:
            state.is_active = False
            state.resolved_at = datetime.utcnow()

        self.db.commit()
        logger.info(f"Resolved alert: {alert_id}")
