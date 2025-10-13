"""
Database models and configuration for Distill webhook data.
"""

import os
from datetime import datetime
from typing import Optional, List
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from pydantic import BaseModel
import hashlib
import secrets

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/monitoring.db")

# Ensure data directory exists
os.makedirs("data", exist_ok=True)

# SQLAlchemy setup
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    """Database model for user accounts."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    def __repr__(self):
        return f"<User(username='{self.username}')>"

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using SHA256."""
        return hashlib.sha256(password.encode()).hexdigest()

    def verify_password(self, password: str) -> bool:
        """Verify a password against the stored hash."""
        return self.password_hash == User.hash_password(password)


class MonitoringData(Base):
    """Database model for storing Distill monitoring data."""

    __tablename__ = "monitoring_data"

    id = Column(Integer, primary_key=True, index=True)
    monitor_id = Column(String, index=True, nullable=False)
    monitor_name = Column(String, nullable=True)
    monitor_type = Column(String, nullable=True, default='monitor')  # 'monitor' or 'constant'
    url = Column(String, nullable=False, default='')
    value = Column(Float, nullable=True)
    text_value = Column(Text, nullable=True)
    unit = Column(String, nullable=True)  # Unit for display (%, $, ETH, etc.)
    decimal_places = Column(Integer, nullable=True, default=2)  # Number of decimal places to display
    color = Column(String, nullable=True)  # For constant cards
    description = Column(Text, nullable=True)  # For constant cards
    status = Column(String, nullable=False, default='active')
    timestamp = Column(DateTime, nullable=False, index=True)
    webhook_received_at = Column(DateTime, default=datetime.utcnow)
    is_change = Column(Boolean, default=False)
    change_type = Column(String, nullable=True)
    previous_value = Column(Float, nullable=True)

    def __repr__(self):
        return f"<MonitoringData(monitor_id='{self.monitor_id}', timestamp='{self.timestamp}', value='{self.value}')>"


class AlertConfig(Base):
    """Database model for alert configurations."""

    __tablename__ = "alert_configs"

    monitor_id = Column(String, primary_key=True)
    upper_threshold = Column(Float, nullable=True)
    lower_threshold = Column(Float, nullable=True)
    alert_level = Column(String, default='medium')  # critical, high, medium, low
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<AlertConfig(monitor_id='{self.monitor_id}', level='{self.alert_level}')>"


class AlertState(Base):
    """Database model for tracking alert states."""

    __tablename__ = "alert_states"

    id = Column(Integer, primary_key=True, index=True)
    monitor_id = Column(String, index=True, nullable=False)
    alert_level = Column(String, nullable=False)
    triggered_at = Column(DateTime, nullable=False)
    last_notified_at = Column(DateTime, nullable=False)
    notification_count = Column(Integer, default=1)
    resolved_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)

    def __repr__(self):
        return f"<AlertState(monitor_id='{self.monitor_id}', is_active={self.is_active})>"


class PushoverConfig(Base):
    """Database model for Pushover configuration."""

    __tablename__ = "pushover_config"

    id = Column(Integer, primary_key=True)
    user_key = Column(String, nullable=False)
    api_token = Column(String, nullable=True)  # Optional, can use default
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<PushoverConfig(user_key='***')>"


class FundingRateAlert(Base):
    """Database model for funding rate alert rules."""

    __tablename__ = "funding_rate_alerts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # User-friendly name for this alert
    alert_type = Column(String, nullable=False)  # 'single' or 'spread'
    exchanges = Column(String, nullable=False)  # JSON array of exchange names
    threshold = Column(Float, nullable=False)  # Threshold value (in percentage, e.g. 0.01 for 1%)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_triggered_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<FundingRateAlert(name='{self.name}', type='{self.alert_type}', enabled={self.enabled})>"


# Pydantic models for API
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


def get_db() -> Session:
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ConstantCard(Base):
    """Database model for constant/reference value cards."""

    __tablename__ = "constant_cards"

    id = Column(String, primary_key=True)  # UUID
    name = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    unit = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    color = Column(String, nullable=True, default='#3b82f6')  # Hex color for the card
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ConstantCard(name='{self.name}', value={self.value})>"


def create_tables():
    """Create database tables."""
    Base.metadata.create_all(bind=engine)


def get_db_session() -> Session:
    """Get a database session (for direct use)."""
    return SessionLocal()