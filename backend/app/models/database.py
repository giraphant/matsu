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


class WebhookData(Base):
    """Database model for storing webhook data from Distill Web Monitor."""

    __tablename__ = "monitoring_data"  # Keep table name for backward compatibility

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
        return f"<WebhookData(monitor_id='{self.monitor_id}', timestamp='{self.timestamp}', value='{self.value}')>"


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
    """Database model for Pushover configuration - supports multiple devices."""

    __tablename__ = "pushover_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)  # Configuration name (e.g., "iPhone", "iPad")
    user_key = Column(String, nullable=False)
    api_token = Column(String, nullable=True)  # Optional, can use default
    enabled = Column(Boolean, default=True)
    min_alert_level = Column(String, default='low')  # Minimum alert level: low, medium, high, critical
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<PushoverConfig(name='{self.name}', enabled={self.enabled}, min_level={self.min_alert_level})>"


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


# ============================================================================
# Trading Data Models (Funding Rates & Spot Prices)
# ============================================================================

class FundingRate(Base):
    """Database model for funding rate data from various exchanges."""

    __tablename__ = "funding_rates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    exchange = Column(String, nullable=False, index=True)  # lighter, aster, grvt, backpack
    symbol = Column(String, nullable=False, index=True)    # BTC, ETH, SOL
    rate = Column(Float, nullable=False)                   # 8-hour funding rate
    annualized_rate = Column(Float, nullable=False)        # Annualized rate in percentage
    next_funding_time = Column(DateTime, nullable=True)    # Next funding timestamp
    mark_price = Column(Float, nullable=True)              # Mark price at time of collection
    timestamp = Column(DateTime, nullable=False, index=True, default=datetime.utcnow)

    def __repr__(self):
        return f"<FundingRate(exchange='{self.exchange}', symbol='{self.symbol}', rate={self.annualized_rate}%)>"


class SpotPrice(Base):
    """Database model for spot price data from various exchanges."""

    __tablename__ = "spot_prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    exchange = Column(String, nullable=False, index=True)  # binance, okx, bybit, lighter, aster
    symbol = Column(String, nullable=False, index=True)    # BTC, ETH, SOL
    price = Column(Float, nullable=False)                  # Spot price in USDT
    volume_24h = Column(Float, nullable=True)              # 24h trading volume
    timestamp = Column(DateTime, nullable=False, index=True, default=datetime.utcnow)

    def __repr__(self):
        return f"<SpotPrice(exchange='{self.exchange}', symbol='{self.symbol}', price={self.price})>"


# ============================================================================
# New Monitor System Models
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
    tags = Column(Text, nullable=True)  # JSON array of tags: ["资金费率", "高优先级"]
    enabled = Column(Boolean, default=True)

    # Heartbeat monitoring (for webhook-based monitors)
    heartbeat_enabled = Column(Boolean, default=False)  # Enable heartbeat check
    heartbeat_interval = Column(Integer, nullable=True)  # Expected interval in seconds (e.g., 300 = 5 min)

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
    Supports formula-based conditions and heartbeat monitoring.
    """
    __tablename__ = 'alert_rules'

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    condition = Column(Text, nullable=False)  # Formula: "${monitor:xxx} < 50"
    level = Column(String, default='medium')  # 'high', 'medium', 'low'
    enabled = Column(Boolean, default=True)
    cooldown_seconds = Column(Integer, default=300)  # 5 minutes default
    actions = Column(Text)  # JSON: ["pushover", "email"]

    # Heartbeat monitoring (shares the same level as threshold alerts)
    heartbeat_enabled = Column(Boolean, default=False)  # Enable heartbeat check
    heartbeat_interval = Column(Integer, nullable=True)  # Expected interval in seconds

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<AlertRule(id={self.id}, name={self.name}, condition={self.condition})>"


class AppSetting(Base):
    """
    Application settings stored in database.
    Key-value pairs for runtime configuration.
    """
    __tablename__ = 'app_settings'

    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<AppSetting(key={self.key}, value={self.value})>"


class DexAccount(Base):
    """
    Database model for DEX account addresses.
    Stores blockchain account addresses for monitoring positions/balances.
    """
    __tablename__ = 'dex_accounts'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)  # User-friendly name (e.g., "Main Trading Account")
    exchange = Column(String, nullable=False, index=True)  # lighter, hyperliquid, etc.
    address = Column(String, nullable=False)  # Blockchain address or account identifier
    enabled = Column(Boolean, default=True)  # Enable/disable monitoring for this account
    tags = Column(Text, nullable=True)  # JSON array of tags for filtering
    notes = Column(Text, nullable=True)  # Optional notes
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<DexAccount(name='{self.name}', exchange='{self.exchange}', address='{self.address}')>"


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