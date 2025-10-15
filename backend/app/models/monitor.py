"""
Monitor System Models
Unified abstraction for all monitoring entities.
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class Monitor(Base):
    """
    Unified Monitor definition.
    All cards (direct, computed, constant) are represented as Monitors.
    """
    __tablename__ = 'monitors'

    id = Column(String, primary_key=True)  # e.g., "monitor_btc_price", "computed_btc_eth_diff"
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # 'direct', 'computed', 'constant'
    formula = Column(Text, nullable=False)  # Formula or data source reference
    unit = Column(String)
    description = Column(Text)
    color = Column(String)
    decimal_places = Column(Integer, default=2)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Monitor(id={self.id}, name={self.name}, type={self.type})>"


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


class AlertState(Base):
    """
    Track alert trigger state to implement cooldown.
    """
    __tablename__ = 'alert_states'

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(String, nullable=False, index=True)
    triggered_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    trigger_count = Column(Integer, default=1)
    last_value = Column(Float)  # The value that triggered the alert

    def __repr__(self):
        return f"<AlertState(alert_id={self.alert_id}, triggered_at={self.triggered_at}, is_active={self.is_active})>"
