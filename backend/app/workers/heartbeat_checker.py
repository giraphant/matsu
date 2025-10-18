"""
Heartbeat checker - monitors data staleness for monitors with heartbeat enabled.
Sends alerts when monitors haven't received data within expected interval.
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any

from app.background_tasks.base import BackgroundTask
from app.models.database import get_db_session, Monitor, WebhookData, AlertState
from app.repositories.monitor_repo import MonitorRepository
from app.repositories.webhook_repo import WebhookRepository
from app.core.logger import get_logger
import json

logger = get_logger(__name__)


class HeartbeatChecker(BackgroundTask):
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
        """Check all monitors with heartbeat enabled."""
        db = get_db_session()

        try:
            # Get all monitors with heartbeat enabled
            monitors = db.query(Monitor).filter(
                Monitor.heartbeat_enabled == True,
                Monitor.enabled == True
            ).all()

            if not monitors:
                return

            logger.info(f"[HeartbeatChecker] Checking {len(monitors)} monitors with heartbeat enabled")

            for monitor in monitors:
                await self._check_monitor_heartbeat(db, monitor)

        except Exception as e:
            logger.error(f"[HeartbeatChecker] Error: {e}", exc_info=True)
        finally:
            db.close()

    async def _check_monitor_heartbeat(self, db, monitor: Monitor):
        """
        Check if a monitor's data is stale.

        Args:
            db: Database session
            monitor: Monitor to check
        """
        try:
            # Skip if heartbeat_interval not set
            if not monitor.heartbeat_interval:
                return

            # Get last webhook data for this monitor
            # We need to find webhook_id from the formula
            webhook_id = self._extract_webhook_id(monitor.formula)
            if not webhook_id:
                # logger.debug(f"[HeartbeatChecker] Monitor {monitor.name} doesn't reference a webhook")
                return

            # Get last webhook update time
            last_webhook = db.query(WebhookData).filter(
                WebhookData.monitor_id == webhook_id
            ).order_by(WebhookData.timestamp.desc()).first()

            if not last_webhook:
                logger.warning(f"[HeartbeatChecker] No webhook data found for {webhook_id}")
                return

            # Check if data is stale
            now = datetime.utcnow()
            elapsed_seconds = (now - last_webhook.timestamp).total_seconds()

            if elapsed_seconds > monitor.heartbeat_interval:
                # Data is stale! Trigger alert
                await self._trigger_heartbeat_alert(
                    db,
                    monitor,
                    webhook_id,
                    elapsed_seconds,
                    last_webhook.timestamp
                )
            else:
                # Data is fresh, resolve any active heartbeat alerts
                await self._resolve_heartbeat_alert(db, monitor)

        except Exception as e:
            logger.error(f"[HeartbeatChecker] Error checking monitor {monitor.name}: {e}", exc_info=True)

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
        monitor: Monitor,
        webhook_id: str,
        elapsed_seconds: float,
        last_update: datetime
    ):
        """
        Trigger heartbeat alert with cooldown mechanism.

        Args:
            db: Database session
            monitor: Monitor that's stale
            webhook_id: Webhook ID being monitored
            elapsed_seconds: Seconds since last update
            last_update: Timestamp of last update
        """
        alert_level = "high"  # Heartbeat failures are important
        cooldown_seconds = 600  # 10 minute cooldown for heartbeat alerts

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
            monitor=monitor,
            webhook_id=webhook_id,
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

    async def _resolve_heartbeat_alert(self, db, monitor: Monitor):
        """
        Mark heartbeat alert as resolved when data resumes.

        Args:
            db: Database session
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
        monitor: Monitor,
        webhook_id: str,
        elapsed_seconds: float,
        last_update: datetime,
        level: str
    ):
        """
        Send Pushover notification for heartbeat failure.

        Args:
            monitor: Monitor that's stale
            webhook_id: Webhook ID being monitored
            elapsed_seconds: Seconds since last update
            last_update: Timestamp of last update
            level: Alert level
        """
        try:
            from app.services.pushover import send_pushover_alert

            elapsed_minutes = elapsed_seconds / 60
            expected_minutes = monitor.heartbeat_interval / 60

            title = f"⚠️ {monitor.name} - Heartbeat Timeout"
            message = (
                f"Monitor: {monitor.name}\n"
                f"Webhook: {webhook_id}\n"
                f"Expected interval: {expected_minutes:.1f} minutes\n"
                f"Time since last update: {elapsed_minutes:.1f} minutes\n"
                f"Last update: {last_update.strftime('%Y-%m-%d %H:%M:%S')} UTC\n\n"
                f"Data source may be down or disconnected."
            )

            await send_pushover_alert(
                title=title,
                message=message,
                priority=1,  # High priority for heartbeat failures
                level=level
            )

        except Exception as e:
            logger.error(f"[HeartbeatChecker] Failed to send Pushover alert: {e}", exc_info=True)
