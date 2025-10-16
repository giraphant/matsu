"""
Pydantic schemas for monitoring data API.
Separated from database models for better organization.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_serializer


class DistillWebhookPayload(BaseModel):
    """Expected payload from Distill webhook."""
    id: str  # Distill uses 'id' as monitor identifier
    name: Optional[str] = None  # Distill monitor name
    uri: str  # Distill uses 'uri' for the monitored URL
    text: str  # Distill sends the extracted value as 'text'

    # Optional fields for backwards compatibility
    monitor_id: Optional[str] = None
    monitor_name: Optional[str] = None
    url: Optional[str] = None
    value: Optional[float] = None
    text_value: Optional[str] = None
    status: Optional[str] = None
    timestamp: Optional[str] = None
    is_change: Optional[bool] = False
    change_type: Optional[str] = None
    previous_value: Optional[float] = None


class MonitoringDataResponse(BaseModel):
    """Response model for monitoring data."""
    id: int
    monitor_id: str
    monitor_name: Optional[str]
    url: str
    value: Optional[float]
    text_value: Optional[str]
    unit: Optional[str]
    status: str
    timestamp: datetime
    webhook_received_at: datetime
    is_change: bool
    change_type: Optional[str]
    previous_value: Optional[float]

    class Config:
        from_attributes = True

    @field_serializer('timestamp', 'webhook_received_at')
    def serialize_dt(self, dt: datetime, _info) -> str:
        """Serialize datetime as UTC ISO format with Z suffix."""
        if dt is None:
            return None
        return dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'


class MonitorSummary(BaseModel):
    """Summary statistics for a monitor."""
    monitor_id: str
    monitor_name: Optional[str]
    monitor_type: Optional[str] = 'monitor'  # 'monitor' or 'constant'
    url: str
    unit: Optional[str]
    decimal_places: Optional[int] = 2  # Number of decimal places to display
    color: Optional[str] = None  # For constant cards
    description: Optional[str] = None  # For constant cards
    total_records: int
    latest_value: Optional[float]
    latest_timestamp: datetime
    min_value: Optional[float]
    max_value: Optional[float]
    avg_value: Optional[float]
    change_count: int

    @field_serializer('latest_timestamp')
    def serialize_timestamp(self, dt: datetime, _info) -> str:
        """Serialize datetime as UTC ISO format with Z suffix."""
        if dt is None:
            return None
        # Ensure datetime is formatted as UTC with Z suffix
        return dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
