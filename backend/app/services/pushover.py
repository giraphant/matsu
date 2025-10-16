"""
Pushover notification service.
Handles sending notifications via Pushover API.
"""

import requests
from typing import Optional
from sqlalchemy.orm import Session

from app.core.logger import get_logger
from app.repositories.pushover import PushoverRepository

logger = get_logger(__name__)


DEFAULT_API_TOKEN = "azGDORePK8gMaC0QOYAMyEEuzJnyUi"  # Default app token

# Alert level priority (higher number = more important)
ALERT_LEVEL_PRIORITY = {
    'low': 0,
    'medium': 1,
    'high': 2,
    'critical': 3
}

ALERT_LEVELS = {
    'critical': {
        'priority': 2,  # Emergency - requires acknowledgment
        'sound': 'siren',
        'retry': 30,  # Retry every 30 seconds
        'expire': 3600  # Give up after 1 hour
    },
    'high': {
        'priority': 1,  # High priority
        'sound': 'persistent'
    },
    'medium': {
        'priority': 0,  # Normal
        'sound': 'pushover'
    },
    'low': {
        'priority': -1,  # Low - no sound
        'sound': 'none'
    }
}


def should_send_to_device(alert_level: str, device_min_level: str) -> bool:
    """
    Check if an alert should be sent to a device based on level filtering.

    Args:
        alert_level: The alert level (low, medium, high, critical)
        device_min_level: The minimum level configured for the device

    Returns:
        True if alert should be sent, False otherwise
    """
    alert_priority = ALERT_LEVEL_PRIORITY.get(alert_level, 0)
    device_priority = ALERT_LEVEL_PRIORITY.get(device_min_level, 0)
    return alert_priority >= device_priority


def send_pushover_notification(
    user_key: str,
    message: str,
    title: str = "Monitor Alert",
    level: str = 'medium',
    api_token: Optional[str] = None,
    url: Optional[str] = None
) -> bool:
    """
    Send a Pushover notification.

    Args:
        user_key: Pushover user key
        message: Notification message
        title: Notification title
        level: Alert level (critical, high, medium, low)
        api_token: Optional API token (uses default if not provided)
        url: Optional URL to include in notification

    Returns:
        True if notification was sent successfully, False otherwise
    """
    logger.info(f"[Pushover] send_pushover_notification called - title: {title}, level: {level}")

    if not user_key:
        logger.warning("[Pushover] No user key configured")
        return False

    token = api_token or DEFAULT_API_TOKEN
    logger.info(f"[Pushover] Using {'custom' if api_token else 'default'} API token")
    config = ALERT_LEVELS.get(level, ALERT_LEVELS['medium'])

    payload = {
        'token': token,
        'user': user_key,
        'message': message,
        'title': title,
        'priority': config['priority'],
        'sound': config['sound']
    }

    # Add retry/expire for critical alerts
    if level == 'critical':
        payload['retry'] = config.get('retry', 30)
        payload['expire'] = config.get('expire', 3600)

    # Add URL if provided
    if url:
        payload['url'] = url
        payload['url_title'] = "View Dashboard"

    logger.info(f"[Pushover] Sending request to Pushover API...")
    logger.debug(f"[Pushover] Payload: {payload}")

    try:
        response = requests.post(
            'https://api.pushover.net/1/messages.json',
            data=payload,
            timeout=10
        )

        logger.info(f"[Pushover] Response status: {response.status_code}")
        logger.debug(f"[Pushover] Response body: {response.text}")

        if response.status_code == 200:
            logger.info(f"[Pushover] ✅ Notification sent successfully: {title}")
            return True
        else:
            logger.error(f"[Pushover] ❌ Failed to send notification: {response.status_code} - {response.text}")
            return False

    except Exception as e:
        logger.error(f"[Pushover] ❌ Exception while sending notification: {e}")
        return False


def format_alert_message(
    monitor_name: str,
    current_value: float,
    threshold_upper: Optional[float],
    threshold_lower: Optional[float],
    unit: Optional[str],
    tags: Optional[list[str]] = None
) -> str:
    """
    Format an alert message for Pushover.

    Args:
        monitor_name: Name of the monitor
        current_value: Current value
        threshold_upper: Upper threshold (if breached)
        threshold_lower: Lower threshold (if breached)
        unit: Unit of measurement
        tags: Optional tags for the monitor

    Returns:
        Formatted message string
    """
    value_str = f"{current_value:,.2f}"
    if unit:
        value_str += f" {unit}"

    if threshold_upper is not None and current_value > threshold_upper:
        threshold_str = f"{threshold_upper:,.2f}"
        if unit:
            threshold_str += f" {unit}"
        reason = f"Above threshold: {threshold_str}"
    elif threshold_lower is not None and current_value < threshold_lower:
        threshold_str = f"{threshold_lower:,.2f}"
        if unit:
            threshold_str += f" {unit}"
        reason = f"Below threshold: {threshold_str}"
    else:
        reason = "Threshold exceeded"

    message = f"Current: {value_str}\n{reason}"

    if tags:
        message += f"\nTags: {', '.join(tags)}"

    return message


class PushoverService:
    """
    Service class for Pushover notifications.
    Encapsulates business logic for sending notifications.
    """

    def __init__(self, db: Session):
        """
        Initialize Pushover service.

        Args:
            db: Database session
        """
        self.db = db
        self.pushover_repo = PushoverRepository(db)

    def send_alert(
        self,
        message: str,
        title: str = "Monitor Alert",
        level: str = 'medium',
        url: Optional[str] = None
    ) -> bool:
        """
        Send an alert notification to enabled Pushover devices that meet the minimum alert level.

        Args:
            message: Notification message
            title: Notification title
            level: Alert level (critical, high, medium, low)
            url: Optional URL to include

        Returns:
            True if sent successfully to at least one device, False otherwise
        """
        logger.info(f"[PushoverService] send_alert called - title: {title}, level: {level}")

        configs = self.pushover_repo.get_enabled()

        if not configs:
            logger.warning("[PushoverService] ⚠️  No enabled Pushover configurations, skipping notification")
            return False

        # Filter devices by minimum alert level
        eligible_configs = []
        for config in configs:
            if should_send_to_device(level, config.min_alert_level):
                eligible_configs.append(config)
                logger.debug(f"[PushoverService] '{config.name}' is eligible (alert:{level} >= min:{config.min_alert_level})")
            else:
                logger.debug(f"[PushoverService] '{config.name}' skipped (alert:{level} < min:{config.min_alert_level})")

        if not eligible_configs:
            logger.info(f"[PushoverService] No devices meet minimum level requirement for {level} alert")
            return False

        logger.info(f"[PushoverService] Sending to {len(eligible_configs)}/{len(configs)} eligible device(s)")

        success_count = 0
        for config in eligible_configs:
            logger.info(f"[PushoverService] Sending to '{config.name}' (user_key: {config.user_key[:10]}...)")

            success = send_pushover_notification(
                user_key=config.user_key,
                message=message,
                title=title,
                level=level,
                api_token=config.api_token,
                url=url
            )

            if success:
                success_count += 1
                logger.info(f"[PushoverService] ✅ Successfully sent to '{config.name}'")
            else:
                logger.error(f"[PushoverService] ❌ Failed to send to '{config.name}'")

        logger.info(f"[PushoverService] Sent to {success_count}/{len(eligible_configs)} device(s)")
        return success_count > 0

    def is_configured(self) -> bool:
        """
        Check if Pushover is configured.

        Returns:
            True if configured, False otherwise
        """
        return self.pushover_repo.is_configured()
