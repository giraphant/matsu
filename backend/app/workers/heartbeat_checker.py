"""
Heartbeat checker - monitors data staleness for monitors with heartbeat enabled.
Sends alerts when monitors haven't received data within expected interval.
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any

from app.background_tasks.base import BaseMonitor
from app.models.database import get_db_session, Monitor, WebhookData, AlertState
from app.repositories.monitor_repo import MonitorRepository
from app.repositories.webhook_repo import WebhookRepository
from app.core.logger import get_logger
import json

logger = get_logger(__name__)


class HeartbeatChecker(BaseMonitor):
    """
    Background task that checks for stale data on monitors with heartbeat enabled.

    For each monitor with heartbeat_enabled=True:
    1. Check last webhook data update time
    2. If (now - last_update) > heartbeat_interval, trigger alert
    3. Use cooldown mechanism to avoid spam
    """

    def __init__(self):
        super().__init__(
            name="Heartbeat Checker",
            interval=30  # Check every 30 seconds
        )

    async def run(self):
        """Check all alert rules with heartbeat enabled."""
        db = get_db_session()

        try:
            from app.models.database import AlertRule

            # Get all alert rules with heartbeat enabled
            alert_rules = db.query(AlertRule).filter(
                AlertRule.heartbeat_enabled == True,
                AlertRule.enabled == True
            ).all()

            if not alert_rules:
                return

            logger.info(f"[HeartbeatChecker] Checking {len(alert_rules)} alert rules with heartbeat enabled")

            for rule in alert_rules:
                await self._check_alert_rule_heartbeat(db, rule)

        except Exception as e:
            logger.error(f"[HeartbeatChecker] Error: {e}", exc_info=True)
        finally:
            db.close()

    async def _check_alert_rule_heartbeat(self, db, alert_rule):
        """
        Check if an alert rule's monitored data is stale.

        Args:
            db: Database session
            alert_rule: AlertRule with heartbeat enabled
        """
        try:
            # Skip if heartbeat_interval not set
            if not alert_rule.heartbeat_interval:
                return

            # Extract monitor ID from condition
            monitor_id = self._extract_monitor_id(alert_rule.condition)
            if not monitor_id:
                logger.warning(f"[HeartbeatChecker] Could not extract monitor_id from condition: {alert_rule.condition}")
                return

            # Get monitor
            monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
            if not monitor:
                logger.warning(f"[HeartbeatChecker] Monitor {monitor_id} not found")
                return

            # Get last computed value for this monitor
            from app.models.database import MonitorValue
            last_value = db.query(MonitorValue).filter(
                MonitorValue.monitor_id == monitor_id
            ).order_by(MonitorValue.computed_at.desc()).first()

            if not last_value:
                logger.debug(f"[HeartbeatChecker] No values found for monitor {monitor.name}")
                return

            # Check if data is stale
            now = datetime.utcnow()
            elapsed_seconds = (now - last_value.computed_at).total_seconds()

            if elapsed_seconds > alert_rule.heartbeat_interval:
                # Data is stale! Trigger alert
                await self._trigger_heartbeat_alert(
                    db,
                    alert_rule,
                    monitor,
                    elapsed_seconds,
                    last_value.computed_at
                )
            else:
                # Data is fresh, resolve any active heartbeat alerts
                await self._resolve_heartbeat_alert(db, alert_rule, monitor)

        except Exception as e:
            logger.error(f"[HeartbeatChecker] Error checking alert rule {alert_rule.name}: {e}", exc_info=True)

    def _extract_monitor_id(self, condition: str) -> str | None:
        """
        Extract monitor ID from alert rule condition.
        E.g., "${monitor:monitor_xxx} > 100" -> "monitor_xxx"
        """
        import re
        match = re.search(r'\$\{monitor:([^}]+)\}', condition)
        if match:
            return match.group(1)
        return None

    def _extract_webhook_id(self, formula: str) -> str | None:
        """
        Extract webhook ID from formula.
        E.g., "${webhook:jlp_hedge_SOL}" -> "jlp_hedge_SOL"
        """
        import re
        match = re.search(r'\$\{webhook:([^}]+)\}', formula)
        if match:
            return match.group(1)
        return None

    async def _trigger_heartbeat_alert(
        self,
        db,
        alert_rule,
        monitor: Monitor,
        elapsed_seconds: float,
        last_update: datetime
    ):
        """
        Trigger heartbeat alert with cooldown mechanism.

        Args:
            db: Database session
            alert_rule: AlertRule with heartbeat config
            monitor: Monitor that's stale
            elapsed_seconds: Seconds since last update
            last_update: Timestamp of last update
        """
        alert_level = alert_rule.level  # Use AlertRule's level
        cooldown_seconds = alert_rule.cooldown_seconds  # Use AlertRule's cooldown

        # Check if we already have an active alert within cooldown
        existing = db.query(AlertState).filter(
            AlertState.monitor_id == monitor.id,
            AlertState.alert_level == f"heartbeat_{alert_level}",
            AlertState.is_active == True
        ).first()

        if existing:
            # Check cooldown
            time_since_last_notify = (datetime.utcnow() - existing.last_notified_at).total_seconds()
            if time_since_last_notify < cooldown_seconds:
                # Still in cooldown, don't notify again
                return

        # Either no existing alert or cooldown expired
        # Send Pushover notification
        await self._send_pushover_alert(
            alert_rule=alert_rule,
            monitor=monitor,
            elapsed_seconds=elapsed_seconds,
            last_update=last_update,
            level=alert_level
        )

        # Update or create alert state
        if existing:
            existing.last_notified_at = datetime.utcnow()
            existing.notification_count += 1
        else:
            new_alert = AlertState(
                monitor_id=monitor.id,
                alert_level=f"heartbeat_{alert_level}",
                triggered_at=datetime.utcnow(),
                last_notified_at=datetime.utcnow(),
                notification_count=1,
                is_active=True
            )
            db.add(new_alert)

        db.commit()
        logger.info(f"[HeartbeatChecker] Alert triggered for {monitor.name} ({elapsed_seconds:.0f}s since last update)")

    async def _resolve_heartbeat_alert(self, db, alert_rule, monitor: Monitor):
        """
        Mark heartbeat alert as resolved when data resumes.

        Args:
            db: Database session
            alert_rule: AlertRule with heartbeat config
            monitor: Monitor that's no longer stale
        """
        # Find any active heartbeat alerts for this monitor
        active_alerts = db.query(AlertState).filter(
            AlertState.monitor_id == monitor.id,
            AlertState.alert_level.like("heartbeat_%"),
            AlertState.is_active == True
        ).all()

        if active_alerts:
            for alert in active_alerts:
                alert.is_active = False
                alert.resolved_at = datetime.utcnow()
                logger.info(f"[HeartbeatChecker] Resolved heartbeat alert for {monitor.name}")

            db.commit()

    async def _send_pushover_alert(
        self,
        alert_rule,
        monitor: Monitor,
        elapsed_seconds: float,
        last_update: datetime,
        level: str
    ):
        """
        Send Pushover notification for heartbeat failure.

        Args:
            alert_rule: AlertRule with heartbeat config
            monitor: Monitor that's stale
            elapsed_seconds: Seconds since last update
            last_update: Timestamp of last update
            level: Alert level
        """
        try:
            from app.services.pushover import PushoverService
            from app.models.database import get_db_session

            elapsed_minutes = elapsed_seconds / 60
            expected_minutes = alert_rule.heartbeat_interval / 60

            title = f"⚠️ {monitor.name} - Heartbeat Timeout"
            message = (
                f"Monitor: {monitor.name}\n"
                f"Expected interval: {expected_minutes:.1f} minutes\n"
                f"Time since last update: {elapsed_minutes:.1f} minutes\n"
                f"Last update: {last_update.strftime('%Y-%m-%d %H:%M:%S')} UTC\n\n"
                f"Monitor data hasn't been updated within expected interval."
            )

            db = get_db_session()
            try:
                pushover_service = PushoverService(db)
                pushover_service.send_alert(
                    title=title,
                    message=message,
                    level=level
                )
            finally:
                db.close()

        except Exception as e:
            logger.error(f"[HeartbeatChecker] Failed to send Pushover alert: {e}", exc_info=True)
