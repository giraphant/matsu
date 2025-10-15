"""
Monitor System alert checker worker.
Periodically checks AlertRule conditions against monitor values and sends Pushover notifications.
"""

from datetime import datetime
from sqlalchemy.orm import Session

from app.core.logger import get_logger
from app.monitors.base import BaseMonitor
from app.models.database import get_db_session, Monitor, AlertRule, MonitorValue
from app.services.pushover import PushoverService

logger = get_logger(__name__)


class MonitorAlertChecker(BaseMonitor):
    """Worker to check Monitor System alert rules and send Pushover notifications."""

    def __init__(self, interval: int = 30):
        """
        Initialize monitor alert checker.

        Args:
            interval: Seconds between alert checks (default: 30)
        """
        super().__init__(name="Monitor Alert Checker", interval=interval)
        self.alert_states = {}  # {rule_id: {'last_notified': timestamp, 'is_active': bool}}

    async def run(self) -> None:
        """Check all monitor alert rules."""
        db = get_db_session()
        try:
            # Get all enabled alert rules
            alert_rules = db.query(AlertRule).filter(AlertRule.enabled == True).all()

            logger.info(f"[MonitorAlertChecker] Checking {len(alert_rules)} alert rules")

            pushover_service = PushoverService(db)

            if not pushover_service.is_configured():
                logger.debug("[MonitorAlertChecker] Pushover not configured, skipping notifications")
                return

            for rule in alert_rules:
                try:
                    # Evaluate the alert condition
                    is_triggered = await self._evaluate_condition(rule, db)

                    if is_triggered:
                        await self._handle_triggered_alert(rule, db, pushover_service)
                    else:
                        # Clear active state if alert was previously active
                        if rule.id in self.alert_states and self.alert_states[rule.id].get('is_active'):
                            self.alert_states[rule.id]['is_active'] = False
                            logger.info(f"[MonitorAlertChecker] Alert cleared: {rule.name}")

                except Exception as e:
                    logger.error(f"[MonitorAlertChecker] Error checking rule '{rule.name}': {e}")
                    continue

        except Exception as e:
            logger.error(f"[MonitorAlertChecker] Error in alert checker: {e}")
            raise
        finally:
            db.close()

    async def _evaluate_condition(self, rule: AlertRule, db: Session) -> bool:
        """
        Evaluate alert rule condition.

        Supports simple conditions like:
        - ${monitor:id} > 100
        - ${monitor:id} < 50
        - ${monitor:id} > 100 || ${monitor:id} < 50
        """
        import re

        condition = rule.condition

        # Find all monitor references in the condition
        monitor_refs = re.findall(r'\$\{monitor:([^}]+)\}', condition)

        if not monitor_refs:
            logger.warning(f"[MonitorAlertChecker] No monitor references found in condition: {condition}")
            return False

        # Replace monitor references with actual values
        evaluated_condition = condition
        for monitor_id in monitor_refs:
            monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()

            if not monitor:
                logger.warning(f"[MonitorAlertChecker] Monitor {monitor_id} not found")
                return False

            # Get latest value
            latest_value = db.query(MonitorValue).filter(
                MonitorValue.monitor_id == monitor_id
            ).order_by(MonitorValue.computed_at.desc()).first()

            if not latest_value or latest_value.value is None:
                logger.debug(f"[MonitorAlertChecker] No value for monitor {monitor_id}")
                return False

            # Replace ${monitor:id} with actual value
            evaluated_condition = evaluated_condition.replace(
                f'${{monitor:{monitor_id}}}',
                str(latest_value.value)
            )

        # Evaluate the condition (simple comparison only for security)
        try:
            # Check if condition contains only numbers and safe operators
            safe_chars = set('0123456789.><=|& -or')
            # Replace operators to check remaining characters
            check_str = evaluated_condition
            for op in ['||', '&&', '>=', '<=', '==', '!=', '>', '<', ' or ', ' and ']:
                check_str = check_str.replace(op, '')

            if not all(c in safe_chars for c in evaluated_condition):
                logger.error(f"[MonitorAlertChecker] Unsafe condition: {evaluated_condition}")
                return False

            # Replace logical operators
            evaluated_condition = evaluated_condition.replace(' or ', ' or ').replace(' || ', ' or ')
            evaluated_condition = evaluated_condition.replace(' and ', ' and ').replace(' && ', ' and ')

            result = eval(evaluated_condition)
            return bool(result)

        except Exception as e:
            logger.error(f"[MonitorAlertChecker] Error evaluating condition '{evaluated_condition}': {e}")
            return False

    async def _handle_triggered_alert(self, rule: AlertRule, db: Session, pushover_service: PushoverService):
        """Handle a triggered alert - check cooldown and send notification."""
        now = datetime.utcnow()
        rule_state = self.alert_states.get(rule.id, {})

        # Check cooldown
        last_notified = rule_state.get('last_notified')
        if last_notified:
            time_since_last = (now - last_notified).total_seconds()
            if time_since_last < rule.cooldown_seconds:
                logger.debug(f"[MonitorAlertChecker] Alert '{rule.name}' in cooldown ({time_since_last:.0f}s < {rule.cooldown_seconds}s)")
                return

        # Send notification
        logger.info(f"[MonitorAlertChecker] 🚨 Alert triggered: {rule.name}")

        try:
            sent = pushover_service.send_alert(
                message=f"Alert condition met: {rule.condition}",
                title=f"🚨 {rule.name}",
                level=rule.level,
                url="https://distill.baa.one"
            )

            if sent:
                logger.info(f"[MonitorAlertChecker] ✅ Pushover notification sent for '{rule.name}'")
                self.alert_states[rule.id] = {
                    'last_notified': now,
                    'is_active': True
                }
            else:
                logger.warning(f"[MonitorAlertChecker] ⚠️  Failed to send Pushover notification for '{rule.name}'")

        except Exception as e:
            logger.error(f"[MonitorAlertChecker] Error sending notification for '{rule.name}': {e}")
