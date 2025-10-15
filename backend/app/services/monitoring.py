"""
Monitoring service for business logic.
Handles webhook processing, alert checking, and data management.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.models.database import MonitoringData, AlertState
from app.schemas.monitoring import DistillWebhookPayload
from app.repositories.monitoring import MonitoringRepository
from app.repositories.alert import AlertStateRepository
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

        # 2. Trigger Monitor System recomputation (new system - monitors with formulas)
        # Alert checking is now done via AlertRule system, not the old AlertConfig
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

        # Alert information is now handled by AlertRule system
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

            # Alert information is now handled by AlertRule system
            summary['alert_configured'] = False

        return summaries
