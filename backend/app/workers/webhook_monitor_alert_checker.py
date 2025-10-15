"""
Webhook Monitor alert checker worker.
Periodically checks AlertConfig rules against webhook monitor values and sends Pushover notifications.
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.core.logger import get_logger
from app.monitors.base import BaseMonitor
from app.models.database import get_db_session, AlertConfig, AlertState, MonitoringData
from app.services.pushover import PushoverService, format_alert_message

logger = get_logger(__name__)


class WebhookMonitorAlertChecker(BaseMonitor):
    """Worker to check webhook monitor alert rules and send Pushover notifications."""

    def __init__(self, interval: int = 30):
        """
        Initialize webhook monitor alert checker.

        Args:
            interval: Seconds between alert checks (default: 30)
        """
        super().__init__(name="Webhook Monitor Alert Checker", interval=interval)

    async def run(self) -> None:
        """Check all webhook monitor alert rules."""
        db = get_db_session()
        try:
            # Get all alert configs (both with and without thresholds, we'll filter later)
            alert_configs = db.query(AlertConfig).all()

            logger.info(f"[WebhookMonitorAlertChecker] Checking {len(alert_configs)} alert configs")

            pushover_service = PushoverService(db)

            if not pushover_service.is_configured():
                logger.debug("[WebhookMonitorAlertChecker] Pushover not configured, skipping notifications")
                # Still check alerts for logging purposes, but don't send

            for config in alert_configs:
                # Skip if no thresholds set
                if config.upper_threshold is None and config.lower_threshold is None:
                    continue

                # Get the latest monitor data for this monitor_id
                monitor = db.query(MonitoringData).filter(
                    MonitoringData.monitor_id == config.monitor_id
                ).order_by(MonitoringData.timestamp.desc()).first()

                if not monitor or monitor.value is None:
                    logger.debug(f"[WebhookMonitorAlertChecker] No data for monitor {config.monitor_id}, skipping")
                    continue

                # Check if value is out of range
                is_breached = False
                if config.upper_threshold is not None and monitor.value > config.upper_threshold:
                    is_breached = True
                if config.lower_threshold is not None and monitor.value < config.lower_threshold:
                    is_breached = True

                if not is_breached:
                    # Value is in range, clear active alert state if exists
                    active_alert = db.query(AlertState).filter(
                        AlertState.monitor_id == config.monitor_id,
                        AlertState.is_active == True
                    ).first()

                    if active_alert:
                        active_alert.is_active = False
                        active_alert.resolved_at = datetime.utcnow()
                        db.commit()
                        logger.info(f"[WebhookMonitorAlertChecker] Cleared alert for {monitor.monitor_name}")

                    continue

                # Value is breached, check cooldown
                last_alert = db.query(AlertState).filter(
                    AlertState.monitor_id == config.monitor_id,
                    AlertState.is_active == True
                ).order_by(AlertState.triggered_at.desc()).first()

                # Cooldown periods by alert level (in seconds)
                cooldown_map = {
                    'critical': 30,
                    'high': 120,
                    'medium': 300,
                    'low': 900
                }
                cooldown = cooldown_map.get(config.alert_level, 300)

                now = datetime.utcnow()
                if last_alert:
                    time_since_last = (now - last_alert.triggered_at).total_seconds()
                    if time_since_last < cooldown:
                        logger.debug(f"[WebhookMonitorAlertChecker] Alert {config.monitor_id} in cooldown ({time_since_last:.0f}s < {cooldown}s)")
                        continue

                # Trigger alert!
                logger.info(f"[WebhookMonitorAlertChecker] 🚨 Alert triggered for {monitor.monitor_name}: value={monitor.value}, upper={config.upper_threshold}, lower={config.lower_threshold}")

                # Create alert state record
                alert_state = AlertState(
                    monitor_id=config.monitor_id,
                    alert_level=config.alert_level,
                    triggered_at=now,
                    last_notified_at=now,
                    notification_count=1 if not last_alert else last_alert.notification_count + 1,
                    is_active=True
                )
                db.add(alert_state)
                db.commit()

                # Send Pushover notification
                if pushover_service.is_configured():
                    try:
                        # Get monitor tags if available
                        # Note: Old system doesn't have tags in DB, would need to load from localStorage
                        # For now, just send without tags
                        message = format_alert_message(
                            monitor_name=monitor.monitor_name,
                            current_value=monitor.value,
                            threshold_upper=config.upper_threshold,
                            threshold_lower=config.lower_threshold,
                            unit=monitor.unit,
                            tags=None
                        )

                        sent = pushover_service.send_alert(
                            message=message,
                            title=f"🚨 {monitor.monitor_name} Alert",
                            level=config.alert_level,
                            url="https://distill.baa.one"
                        )

                        if sent:
                            logger.info(f"[WebhookMonitorAlertChecker] ✅ Pushover notification sent for {monitor.monitor_name}")
                        else:
                            logger.warning(f"[WebhookMonitorAlertChecker] ⚠️  Failed to send Pushover notification for {monitor.monitor_name}")

                    except Exception as e:
                        logger.error(f"[WebhookMonitorAlertChecker] Error sending Pushover notification: {e}")

        except Exception as e:
            logger.error(f"[WebhookMonitorAlertChecker] Error checking webhook monitor alerts: {e}")
            raise
        finally:
            db.close()
