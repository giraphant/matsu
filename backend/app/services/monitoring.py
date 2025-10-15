"""
Monitoring service for business logic.
Handles webhook processing, alert checking, and data management.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.models.database import MonitoringData, AlertConfig, AlertState
from app.schemas.monitoring import DistillWebhookPayload
from app.repositories.monitoring import MonitoringRepository
from app.repositories.alert import AlertRepository, AlertStateRepository
from app.services.pushover import PushoverService, format_alert_message
from app.services.monitor_service import MonitorService
from app.core.logger import get_logger

logger = get_logger(__name__)


class MonitoringService:
    """
    Service class for monitoring data business logic.
    Coordinates repositories and implements complex business flows.
    """

    def __init__(self, db: Session):
        """
        Initialize monitoring service.

        Args:
            db: Database session
        """
        self.db = db
        self.monitoring_repo = MonitoringRepository(db)
        self.alert_repo = AlertRepository(db)
        self.alert_state_repo = AlertStateRepository(db)
        self.pushover_service = PushoverService(db)
        self.monitor_service = MonitorService(db)

    def process_webhook(self, payload: DistillWebhookPayload) -> MonitoringData:
        """
        Process webhook data - main business logic entry point.

        This method:
        1. Parses and validates webhook data
        2. Creates monitoring record
        3. Checks for alerts (old system)
        4. Sends notifications if needed
        5. Triggers Monitor System recomputation (new system)

        Args:
            payload: Webhook payload from Distill

        Returns:
            Created MonitoringData record
        """
        # 1. Parse and create monitoring data
        data = self._create_monitoring_data(payload)

        # 2. Check and trigger alerts (old system - AlertConfig)
        self._check_and_trigger_alerts(data)

        # 3. Trigger Monitor System recomputation (new system - monitors with formulas)
        try:
            recomputed = self.monitor_service.trigger_recompute_on_webhook(data.monitor_id)
            if recomputed:
                logger.debug(f"Webhook {data.monitor_id} triggered recompute of {len(recomputed)} monitors")
        except Exception as e:
            logger.error(f"Error triggering monitor recompute: {e}")

        return data

    def _create_monitoring_data(self, payload: DistillWebhookPayload) -> MonitoringData:
        """
        Parse webhook payload and create monitoring data record.

        Args:
            payload: Webhook payload

        Returns:
            Created MonitoringData
        """
        # Map Distill fields to our database fields
        monitor_id = payload.id or payload.monitor_id
        monitor_name = payload.name or payload.monitor_name
        url = payload.uri or payload.url
        text_value = payload.text or payload.text_value

        # Try to parse numeric value from text and detect unit
        value, unit = self._parse_value_and_unit(text_value)

        # Use payload value if parsing failed
        if value is None and payload.value is not None:
            value = payload.value

        # Use current timestamp if not provided
        timestamp = datetime.utcnow()
        if payload.timestamp:
            timestamp = self._parse_timestamp(payload.timestamp)

        # Default status for Distill data
        status = payload.status or "monitored"

        # Get existing monitor settings to preserve them
        existing_record = self.monitoring_repo.get_latest(monitor_id)

        # Preserve existing settings
        decimal_places = 2
        monitor_type = 'monitor'
        color = None
        description = None

        if existing_record:
            if existing_record.decimal_places is not None:
                decimal_places = existing_record.decimal_places
            monitor_type = existing_record.monitor_type or 'monitor'
            color = existing_record.color
            description = existing_record.description

        # Create database record
        data = MonitoringData(
            monitor_id=monitor_id,
            monitor_name=monitor_name,
            monitor_type=monitor_type,
            url=url,
            value=value,
            text_value=text_value,
            unit=unit,
            decimal_places=decimal_places,
            color=color,
            description=description,
            status=status,
            timestamp=timestamp,
            webhook_received_at=datetime.utcnow(),
            is_change=payload.is_change or False,
            change_type=payload.change_type,
            previous_value=payload.previous_value
        )

        # Save to database
        created_data = self.monitoring_repo.create(data)
        logger.info(f"Created monitoring data: monitor_id={monitor_id}, value={value}")

        return created_data

    def _check_and_trigger_alerts(self, data: MonitoringData):
        """
        Check if alert should be triggered and send notification.

        Args:
            data: MonitoringData record
        """
        # Only check alerts if we have a numeric value
        if data.value is None:
            return

        # Get alert configuration
        alert_config = self.alert_repo.get_by_monitor_id(data.monitor_id)

        if not alert_config:
            return

        # Check if alert should be triggered
        should_alert, threshold_type = self._should_trigger_alert(
            data.value,
            alert_config
        )

        if not should_alert:
            # No alert needed - resolve any active alerts
            self.alert_state_repo.resolve(data.monitor_id)
            return

        # Check if we already have an active alert
        active_alert = self.alert_state_repo.get_active_by_monitor_id(data.monitor_id)

        if active_alert:
            # Update notification count
            self.alert_state_repo.update_notification_count(active_alert.id)
            logger.debug(f"Updated existing alert for {data.monitor_id}")
        else:
            # Create new alert state
            alert_state = AlertState(
                monitor_id=data.monitor_id,
                alert_level=alert_config.alert_level,
                triggered_at=datetime.utcnow(),
                last_notified_at=datetime.utcnow(),
                is_active=True
            )
            self.alert_state_repo.create(alert_state)
            logger.info(f"Created new alert state for {data.monitor_id}")

            # Send notification for new alert
            self._send_alert_notification(data, alert_config, threshold_type)

    def _should_trigger_alert(
        self,
        value: float,
        config: AlertConfig
    ) -> tuple[bool, Optional[str]]:
        """
        Check if alert should be triggered based on thresholds.

        Args:
            value: Current value
            config: Alert configuration

        Returns:
            Tuple of (should_trigger, threshold_type)
            threshold_type is 'upper' or 'lower' or None
        """
        if config.upper_threshold is not None and value > config.upper_threshold:
            return True, 'upper'

        if config.lower_threshold is not None and value < config.lower_threshold:
            return True, 'lower'

        return False, None

    def _send_alert_notification(
        self,
        data: MonitoringData,
        config: AlertConfig,
        threshold_type: str
    ):
        """
        Send alert notification via Pushover.

        Args:
            data: MonitoringData that triggered alert
            config: Alert configuration
            threshold_type: 'upper' or 'lower'
        """
        if not self.pushover_service.is_configured():
            logger.warning("Pushover not configured, skipping notification")
            return

        # Format alert message
        threshold_upper = config.upper_threshold if threshold_type == 'upper' else None
        threshold_lower = config.lower_threshold if threshold_type == 'lower' else None

        message = format_alert_message(
            monitor_name=data.monitor_name or data.monitor_id,
            current_value=data.value,
            threshold_upper=threshold_upper,
            threshold_lower=threshold_lower,
            unit=data.unit
        )

        # Send notification
        success = self.pushover_service.send_alert(
            message=message,
            title=f"Alert: {data.monitor_name or data.monitor_id}",
            level=config.alert_level,
            url=data.url
        )

        if success:
            logger.info(f"Alert notification sent for {data.monitor_id}")
        else:
            logger.error(f"Failed to send alert notification for {data.monitor_id}")

    def _parse_value_and_unit(self, text_value: Optional[str]) -> tuple[Optional[float], Optional[str]]:
        """
        Parse numeric value and unit from text.

        Args:
            text_value: Text to parse

        Returns:
            Tuple of (value, unit)
        """
        if not text_value:
            return None, None

        value = None
        unit = None

        try:
            # Detect unit from text
            if '%' in text_value:
                unit = '%'
            elif '$' in text_value:
                unit = '$'
            elif '€' in text_value:
                unit = '€'
            elif '£' in text_value:
                unit = '£'
            # Detect common crypto units
            elif 'SOL' in text_value:
                unit = 'SOL'
            elif 'ETH' in text_value:
                unit = 'ETH'
            elif 'BTC' in text_value:
                unit = 'BTC'

            # Remove commas, percentage signs, currency symbols, and crypto units
            clean_text = text_value.replace(',', '').replace('%', '').replace('$', '').replace('€', '').replace('£', '')
            clean_text = clean_text.replace('SOL', '').replace('ETH', '').replace('BTC', '').strip()

            # Handle k (thousands) and m (millions) suffixes
            multiplier = 1
            if clean_text.lower().endswith('k'):
                multiplier = 1000
                clean_text = clean_text[:-1].strip()
            elif clean_text.lower().endswith('m'):
                multiplier = 1000000
                clean_text = clean_text[:-1].strip()
            elif clean_text.lower().endswith('b'):
                multiplier = 1000000000
                clean_text = clean_text[:-1].strip()

            # Parse as float (handles both positive and negative numbers)
            value = float(clean_text) * multiplier

        except ValueError:
            logger.debug(f"Could not parse numeric value from: {text_value}")

        return value, unit

    def _parse_timestamp(self, timestamp_str: str) -> datetime:
        """
        Parse timestamp from various formats.

        Args:
            timestamp_str: Timestamp string

        Returns:
            Parsed datetime
        """
        formats = [
            "%Y-%m-%dT%H:%M:%S.%fZ",  # ISO format with microseconds
            "%Y-%m-%dT%H:%M:%SZ",     # ISO format without microseconds
            "%Y-%m-%dT%H:%M:%S",      # ISO format without Z
            "%Y-%m-%d %H:%M:%S",      # Simple format
        ]

        for fmt in formats:
            try:
                return datetime.strptime(timestamp_str, fmt)
            except ValueError:
                continue

        # If all formats fail, use current time
        logger.warning(f"Could not parse timestamp: {timestamp_str}, using current time")
        return datetime.utcnow()

    def get_monitor_summary(self, monitor_id: str) -> Dict[str, Any]:
        """
        Get comprehensive summary for a monitor.

        Args:
            monitor_id: Monitor identifier

        Returns:
            Dictionary with summary statistics and status
        """
        summary = self.monitoring_repo.get_summary_statistics(monitor_id)

        # Add business logic: determine status
        if summary['total_records'] == 0:
            summary['status'] = 'no_data'
        elif summary['latest_timestamp']:
            time_since_update = datetime.utcnow() - summary['latest_timestamp']
            if time_since_update > timedelta(hours=1):
                summary['status'] = 'stale'
            else:
                summary['status'] = 'active'
        else:
            summary['status'] = 'unknown'

        # Add alert information
        alert_config = self.alert_repo.get_by_monitor_id(monitor_id)
        if alert_config:
            summary['alert_configured'] = True
            summary['alert_level'] = alert_config.alert_level
            summary['upper_threshold'] = alert_config.upper_threshold
            summary['lower_threshold'] = alert_config.lower_threshold
        else:
            summary['alert_configured'] = False

        return summary

    def get_all_monitors_summary(self) -> List[Dict[str, Any]]:
        """
        Get summary for all monitors.

        Returns:
            List of monitor summaries
        """
        summaries = self.monitoring_repo.get_all_monitors_summary()

        # Enrich each summary with business logic
        for summary in summaries:
            monitor_id = summary['monitor_id']

            # Add status
            if summary['total_records'] == 0:
                summary['status'] = 'no_data'
            elif summary['latest_timestamp']:
                time_since_update = datetime.utcnow() - summary['latest_timestamp']
                if time_since_update > timedelta(hours=1):
                    summary['status'] = 'stale'
                else:
                    summary['status'] = 'active'
            else:
                summary['status'] = 'unknown'

            # Add alert information
            alert_config = self.alert_repo.get_by_monitor_id(monitor_id)
            if alert_config:
                summary['alert_configured'] = True
                summary['alert_level'] = alert_config.alert_level
            else:
                summary['alert_configured'] = False

        return summaries
