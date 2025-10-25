"""
Startup task manager for initializing and starting background services.
Centralizes all startup logic including database initialization, migrations, and background tasks.
"""

import asyncio
import sqlite3
from typing import List

from app.core.config import settings
from app.core.logger import get_logger
from app.models.database import create_tables, get_db_session, User
from app.background_tasks.base import BaseMonitor

logger = get_logger(__name__)


class StartupManager:
    """Manages application startup tasks and background services."""

    def __init__(self):
        """Initialize startup manager."""
        self.monitors: List[BaseMonitor] = []

    async def initialize(self) -> None:
        """
        Initialize the application.

        This includes:
        - Database table creation
        - Database migrations
        - Initial user creation
        - Starting background monitors and workers
        """
        # Initialize database
        create_tables()

        # Run database migrations
        self._run_migrations()

        # Create initial users
        self._create_initial_users()

        # Start background services
        await self._start_background_services()

        # Print startup info
        self._print_startup_info()

    def _run_migrations(self) -> None:
        """Run database migrations."""
        # Remove formula column from alert_configs if it exists (SQLite migration)
        try:
            conn = sqlite3.connect(settings.DATABASE_PATH)
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(alert_configs)")
            columns = [col[1] for col in cursor.fetchall()]

            if 'formula' in columns:
                # SQLite doesn't support DROP COLUMN, so recreate the table
                cursor.execute("""
                    CREATE TABLE alert_configs_new (
                        monitor_id TEXT PRIMARY KEY,
                        upper_threshold REAL,
                        lower_threshold REAL,
                        alert_level TEXT DEFAULT 'medium',
                        created_at TIMESTAMP,
                        updated_at TIMESTAMP
                    )
                """)
                cursor.execute("""
                    INSERT INTO alert_configs_new (monitor_id, upper_threshold, lower_threshold, alert_level, created_at, updated_at)
                    SELECT monitor_id, upper_threshold, lower_threshold, alert_level, created_at, updated_at
                    FROM alert_configs
                """)
                cursor.execute("DROP TABLE alert_configs")
                cursor.execute("ALTER TABLE alert_configs_new RENAME TO alert_configs")
                conn.commit()
                logger.info("Removed formula column from alert_configs")

            conn.close()
        except Exception as e:
            logger.debug(f"Migration note: {e}")

        # Add heartbeat fields to alert_rules
        try:
            conn = sqlite3.connect(settings.DATABASE_PATH)
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(alert_rules)")
            columns = [col[1] for col in cursor.fetchall()]

            if 'heartbeat_enabled' not in columns:
                cursor.execute("""
                    ALTER TABLE alert_rules
                    ADD COLUMN heartbeat_enabled BOOLEAN DEFAULT 0
                """)
                logger.info("Added heartbeat_enabled column to alert_rules")

            if 'heartbeat_interval' not in columns:
                cursor.execute("""
                    ALTER TABLE alert_rules
                    ADD COLUMN heartbeat_interval INTEGER
                """)
                logger.info("Added heartbeat_interval column to alert_rules")

            conn.commit()
            conn.close()
        except Exception as e:
            logger.debug(f"Migration note: {e}")

        # Create dex_accounts table if it doesn't exist
        try:
            conn = sqlite3.connect(settings.DATABASE_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='dex_accounts'")

            if not cursor.fetchone():
                cursor.execute("""
                    CREATE TABLE dex_accounts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        exchange TEXT NOT NULL,
                        address TEXT NOT NULL,
                        enabled BOOLEAN DEFAULT 1,
                        tags TEXT,
                        notes TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                cursor.execute("CREATE INDEX ix_dex_accounts_exchange ON dex_accounts(exchange)")
                conn.commit()
                logger.info("Created dex_accounts table for multi-account support")

            conn.close()
        except Exception as e:
            logger.debug(f"Migration note: {e}")

    def _create_initial_users(self) -> None:
        """Create initial user if no users exist."""
        db = get_db_session()
        try:
            user_count = db.query(User).count()
            if user_count == 0:
                # Create default admin user
                user = User(
                    username="ramu",
                    password_hash=User.hash_password(settings.RAMU_PASSWORD),
                    is_active=True
                )
                db.add(user)
                db.commit()
                logger.info("Created initial user: ramu")
        finally:
            db.close()

    async def _start_background_services(self) -> None:
        """Start all background monitors and workers."""
        # Import monitors and workers
        from app.background_tasks import (
            JLPHedgeMonitor, ALPHedgeMonitor,
            DatabaseDownsampler
        )
        # NEW: Exchange-centric architecture
        from app.background_tasks.funding_monitor import FundingRateMonitor
        from app.background_tasks.spot_monitor import SpotPriceMonitor
        from app.background_tasks.account_monitor import AccountMonitor

        from app.workers.monitor_alert_checker import MonitorAlertChecker
        from app.workers.monitor_recompute_worker import MonitorRecomputeWorker
        from app.workers.heartbeat_checker import HeartbeatChecker

        # NEW: Unified funding rate coordinator (replaces 7 individual monitors)
        # Fetches from: Binance, Bybit, Hyperliquid, Lighter, Aster, GRVT, Backpack
        self.monitors.append(FundingRateMonitor(interval=300))  # Every 5 minutes

        # NEW: Unified spot price coordinator (replaces 5 individual monitors)
        # Fetches from: Binance, Bybit, OKX, Jupiter (Solana), Pyth (Oracle)
        self.monitors.append(SpotPriceMonitor(interval=60))  # Every 1 minute

        # NEW: Unified account coordinator (every 30 seconds)
        # Fetches account data from all exchanges that support it: Lighter, etc.
        # Note: Accounts are now managed through the database (Settings > DEX Accounts)
        self.monitors.append(AccountMonitor(interval=30))

        # Position calculators (every 60 seconds)
        # JLP Hedge Monitor reads jlp_amount from database settings
        self.monitors.append(JLPHedgeMonitor())
        # ALP Hedge Monitor reads alp_amount from database settings
        self.monitors.append(ALPHedgeMonitor())

        # Monitor recompute worker (every 10 seconds to match spot price updates)
        self.monitors.append(MonitorRecomputeWorker(interval=10))

        # DEPRECATED: WebhookMonitorAlertChecker removed (used old AlertConfig system)
        # Now only use Monitor Alert Checker for AlertRule system
        self.monitors.append(MonitorAlertChecker(interval=10))

        # Heartbeat checker (every 30 seconds)
        # Monitors data staleness for monitors with heartbeat_enabled=True
        self.monitors.append(HeartbeatChecker())

        # Database downsampler (every 24 hours)
        # Automatically downsamples old data to reduce database size
        # Runs at 2 AM UTC by default (86400 seconds = 24 hours)
        self.monitors.append(DatabaseDownsampler(interval=86400, keep_backups=3))

        # Start all monitors
        for monitor in self.monitors:
            await monitor.start()

    async def shutdown(self) -> None:
        """Shutdown all background services gracefully."""
        logger.info("Shutting down background services...")

        # Stop all monitors
        for monitor in self.monitors:
            await monitor.stop()

        logger.info("All background services stopped")

    def _print_startup_info(self) -> None:
        """Print startup information."""
        logger.info("Distill Webhook Visualiser started successfully!")
        logger.info(f"Webhook endpoint: {settings.BASE_URL}/webhook/distill")
        logger.info(f"Dashboard: {settings.BASE_URL}/")
        logger.info(f"API Docs: {settings.BASE_URL}/docs")


# Global startup manager instance
startup_manager = StartupManager()
