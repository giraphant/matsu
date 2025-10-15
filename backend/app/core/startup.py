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
from app.monitors.base import BaseMonitor

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

    def _create_initial_users(self) -> None:
        """Create initial users if no users exist."""
        db = get_db_session()
        try:
            user_count = db.query(User).count()
            if user_count == 0:
                initial_users = [
                    ("ramu", settings.RAMU_PASSWORD),
                    ("ligigy", settings.LIGIGY_PASSWORD),
                    ("quasi", settings.QUASI_PASSWORD)
                ]

                for username, password in initial_users:
                    user = User(
                        username=username,
                        password_hash=User.hash_password(password),
                        is_active=True
                    )
                    db.add(user)

                db.commit()
                logger.info("Created initial users: ramu, ligigy, quasi")
        finally:
            db.close()

    async def _start_background_services(self) -> None:
        """Start all background monitors and workers."""
        # Import monitors and workers
        from app.monitors.lighter import LighterMonitor
        from app.workers.dex_cache_warmer import DexCacheWarmer
        from app.workers.alert_checker import AlertChecker
        from app.workers.webhook_monitor_alert_checker import WebhookMonitorAlertChecker
        from app.workers.monitor_alert_checker import MonitorAlertChecker

        # Create monitor instances based on feature flags
        if settings.ENABLE_DEX_MONITORING:
            self.monitors.append(DexCacheWarmer(interval=settings.DEX_CACHE_REFRESH_INTERVAL))
            self.monitors.append(AlertChecker(interval=settings.FUNDING_RATE_CHECK_INTERVAL))

        if settings.ENABLE_LIGHTER_MONITORING:
            self.monitors.append(LighterMonitor())

        # Always start Webhook Monitor Alert Checker (for Bento/Overview page alerts)
        self.monitors.append(WebhookMonitorAlertChecker(interval=30))

        # Always start Monitor Alert Checker (for Bento2/Monitor System alerts)
        self.monitors.append(MonitorAlertChecker(interval=30))

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
