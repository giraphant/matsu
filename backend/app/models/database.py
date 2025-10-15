"""
Database models for Distill webhook data.
SQLAlchemy ORM models only - Pydantic schemas are in app/schemas/
"""

import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import hashlib

from app.core.config import settings

# Ensure data directory exists
os.makedirs(os.path.dirname(settings.DATABASE_PATH) if '/' in settings.DATABASE_PATH else "data", exist_ok=True)

# SQLAlchemy setup with proper connection pool settings
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

# Configure connection pool
# For SQLite: Use StaticPool to handle concurrent connections better
# For other DBs: Use larger pool size
if settings.DATABASE_URL.startswith("sqlite"):
    from sqlalchemy.pool import StaticPool
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
        poolclass=StaticPool,  # Better for SQLite with many concurrent reads
        echo=False
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
        pool_size=20,  # Increase from default 5
        max_overflow=40,  # Increase from default 10
        pool_timeout=60,  # Increase timeout from default 30
        pool_pre_ping=True,  # Verify connections before use
        echo=False
    )

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


# ============================================================================
# New Monitor System Models (Phase 1)
# ============================================================================

class Monitor(Base):
    """
    Unified Monitor definition - everything is just a formula.

    Examples:
    - Constant: formula = "100"
    - Reference webhook: formula = "${webhook:btc_price}"
    - Computed: formula = "${monitor:a} - ${monitor:b}"
    - Complex: formula = "${monitor:a} * 0.05 + ${monitor:b}"
    """
    __tablename__ = 'monitors'

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    formula = Column(Text, nullable=False)  # The formula IS the definition
    unit = Column(String)
    description = Column(Text)
    color = Column(String)
    decimal_places = Column(Integer, default=2)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Monitor(id={self.id}, name={self.name}, formula={self.formula[:50]})>"


class MonitorValue(Base):
    """
    Cached computed values for monitors.
    Stores calculation results and dependencies.
    """
    __tablename__ = 'monitor_values'

    id = Column(Integer, primary_key=True, autoincrement=True)
    monitor_id = Column(String, nullable=False, index=True)
    value = Column(Float)
    computed_at = Column(DateTime, default=datetime.utcnow, index=True)
    dependencies = Column(Text)  # JSON: ["webhook:xxx", "monitor:yyy"]

    def __repr__(self):
        return f"<MonitorValue(monitor_id={self.monitor_id}, value={self.value}, computed_at={self.computed_at})>"


class AlertRule(Base):
    """
    Alert rules independent of monitors.
    Supports formula-based conditions.
    """
    __tablename__ = 'alert_rules'

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    condition = Column(Text, nullable=False)  # Formula: "${monitor:xxx} < 50"
    level = Column(String, default='medium')  # 'high', 'medium', 'low'
    enabled = Column(Boolean, default=True)
    cooldown_seconds = Column(Integer, default=300)  # 5 minutes default
    actions = Column(Text)  # JSON: ["pushover", "email"]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<AlertRule(id={self.id}, name={self.name}, condition={self.condition})>"


# Database utility functions

def get_db() -> Session:
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create database tables."""
    Base.metadata.create_all(bind=engine)


def get_db_session() -> Session:
    """Get a database session (for direct use)."""
    return SessionLocal()