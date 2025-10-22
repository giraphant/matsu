"""
Database downsampler background task.
Periodically downsamples time-series data to reduce database size while preserving historical trends.

Retention Policy:
- Last 24 hours: Keep all records (full precision)
- 1-7 days: Keep 1 sample every 5 minutes
- 7-30 days: Keep 1 sample every 10 minutes
- 30+ days: Keep 1 sample every 15 minutes
"""

import os
import shutil
import glob
from datetime import datetime, timedelta
from sqlalchemy import and_, text
from typing import Dict, Any

from app.core.logger import get_logger
from app.models.database import get_db_session, SpotPrice, MonitorValue, WebhookData
from app.background_tasks.base import BaseMonitor

logger = get_logger(__name__)


class DatabaseDownsampler(BaseMonitor):
    """
    Background task that periodically downsamples database records.

    Runs once per day (default) to keep database size manageable while
    preserving historical data through time-based downsampling.
    """

    # Retention policy configuration
    POLICY = [
        {"name": "Last 24 hours", "days_ago": 0, "interval_minutes": 0, "keep_all": True},
        {"name": "1-7 days", "days_ago": 1, "days_until": 7, "interval_minutes": 5},
        {"name": "7-30 days", "days_ago": 7, "days_until": 30, "interval_minutes": 10},
        {"name": "30+ days", "days_ago": 30, "days_until": None, "interval_minutes": 15},
    ]

    def __init__(self, interval: int = 86400, keep_backups: int = 3):
        """
        Initialize database downsampler.

        Args:
            interval: Seconds between runs (default: 86400 = 24 hours)
            keep_backups: Number of backup files to keep (default: 3)
        """
        super().__init__(name="Database Downsampler", interval=interval)
        self.keep_backups = keep_backups
        self.last_run = None
        self.stats = {}

    async def run(self) -> None:
        """Execute one iteration of database downsampling."""
        try:
            logger.info("=" * 60)
            logger.info("Starting database downsampling task")
            logger.info(f"Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")

            # Get database path
            from app.core.config import settings
            db_path = settings.DATABASE_PATH

            if not os.path.exists(db_path):
                logger.warning(f"Database not found at {db_path}, skipping downsampling")
                return

            # Get initial database size
            initial_size = os.path.getsize(db_path) / 1024 / 1024  # MB
            logger.info(f"Initial database size: {initial_size:.1f} MB")

            # Create backup
            backup_file = self._create_backup(db_path)
            if not backup_file:
                logger.error("Failed to create backup, aborting downsampling")
                return

            # Get database session
            db = get_db_session()

            try:
                # Downsample each table
                self.stats = {}
                await self._downsample_table(db, SpotPrice, 'timestamp', 'spot_prices')
                await self._downsample_table(db, MonitorValue, 'computed_at', 'monitor_values')
                await self._downsample_table(db, WebhookData, 'timestamp', 'monitoring_data')

                # Calculate totals
                total_deleted = sum(s.get('deleted', 0) for s in self.stats.values())

                if total_deleted > 0:
                    # Optimize database
                    logger.info("Running VACUUM to reclaim space...")
                    db.execute(text("VACUUM"))
                    logger.info("Database optimized")

                    # Get final size
                    final_size = os.path.getsize(db_path) / 1024 / 1024
                    saved = initial_size - final_size

                    logger.info(f"Final database size: {final_size:.1f} MB")
                    logger.info(f"Space saved: {saved:.1f} MB ({saved/initial_size*100:.1f}%)")

                    # Cleanup old backups
                    self._cleanup_old_backups(db_path)

                    logger.info(f"Backup saved: {os.path.basename(backup_file)}")
                else:
                    logger.info("No data to downsample")
                    # Remove backup if nothing was deleted
                    if os.path.exists(backup_file):
                        os.remove(backup_file)
                        logger.info("Removed unnecessary backup")

                self.last_run = datetime.utcnow()
                logger.info("Database downsampling completed successfully")
                logger.info("=" * 60)

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error during database downsampling: {e}", exc_info=True)

    def _create_backup(self, db_path: str) -> str:
        """Create a backup of the database."""
        try:
            timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
            backup_path = f"{db_path}.backup-{timestamp}"

            logger.info(f"Creating backup: {os.path.basename(backup_path)}")
            shutil.copy2(db_path, backup_path)
            logger.info("Backup created successfully")

            return backup_path

        except Exception as e:
            logger.error(f"Failed to create backup: {e}", exc_info=True)
            return None

    def _cleanup_old_backups(self, db_path: str):
        """Remove old backup files, keeping only the most recent N backups."""
        try:
            backup_pattern = f"{db_path}.backup-*"
            backups = glob.glob(backup_pattern)

            if len(backups) <= self.keep_backups:
                return

            # Sort by modification time (oldest first)
            backups.sort(key=os.path.getmtime)

            # Remove oldest backups
            to_remove = backups[:-self.keep_backups]

            for backup in to_remove:
                backup_size = os.path.getsize(backup) / 1024 / 1024
                os.remove(backup)
                logger.info(f"Removed old backup: {os.path.basename(backup)} ({backup_size:.1f} MB)")

        except Exception as e:
            logger.error(f"Error cleaning up old backups: {e}", exc_info=True)

    def _get_time_ranges(self):
        """Calculate time ranges for each retention policy tier."""
        now = datetime.utcnow()
        ranges = []

        for policy in self.POLICY:
            if policy.get('keep_all'):
                start = now - timedelta(days=1)
                end = now
                ranges.append({
                    'name': policy['name'],
                    'start': start,
                    'end': end,
                    'keep_all': True,
                    'interval_minutes': 0
                })
            else:
                start_days = policy['days_ago']
                end_days = policy.get('days_until')

                start = now - timedelta(days=start_days)
                end = now - timedelta(days=end_days) if end_days else datetime.min

                ranges.append({
                    'name': policy['name'],
                    'start': end,
                    'end': start,
                    'keep_all': False,
                    'interval_minutes': policy['interval_minutes']
                })

        return ranges

    async def _downsample_table(self, db, model, time_column: str, table_name: str):
        """Downsample a table based on retention policy."""
        try:
            # Get initial count
            initial_count = db.query(model).count()

            if initial_count == 0:
                logger.info(f"{table_name}: empty, skipping")
                return

            logger.info(f"{table_name}: {initial_count:,} records")

            total_deleted = 0
            ranges = self._get_time_ranges()

            for time_range in ranges:
                if time_range['keep_all']:
                    continue

                deleted = await self._downsample_time_range(
                    db,
                    model,
                    time_column,
                    time_range['start'],
                    time_range['end'],
                    time_range['interval_minutes'],
                    time_range['name']
                )
                total_deleted += deleted

            # Get final count
            final_count = db.query(model).count()

            self.stats[table_name] = {
                'before': initial_count,
                'after': final_count,
                'deleted': total_deleted
            }

            if total_deleted > 0:
                reduction = (total_deleted / initial_count * 100)
                logger.info(f"{table_name}: deleted {total_deleted:,} records ({reduction:.1f}%)")

        except Exception as e:
            logger.error(f"Error downsampling {table_name}: {e}", exc_info=True)

    async def _downsample_time_range(self, db, model, time_column: str,
                                    start_time: datetime, end_time: datetime,
                                    interval_minutes: int, range_name: str) -> int:
        """Downsample records in a specific time range."""
        try:
            # Count records in this range
            records_in_range = db.query(model).filter(
                and_(
                    getattr(model, time_column) >= start_time,
                    getattr(model, time_column) < end_time
                )
            ).count()

            if records_in_range == 0:
                return 0

            interval_seconds = interval_minutes * 60
            table_name = model.__tablename__

            # Delete all records except the first in each time bucket
            delete_query = text(f"""
                DELETE FROM {table_name}
                WHERE id IN (
                    SELECT id FROM {table_name}
                    WHERE {time_column} >= :start_time
                      AND {time_column} < :end_time
                      AND id NOT IN (
                        SELECT MIN(id) FROM {table_name}
                        WHERE {time_column} >= :start_time
                          AND {time_column} < :end_time
                        GROUP BY
                          strftime('%s', {time_column}) / :interval_seconds
                      )
                )
            """)

            result = db.execute(
                delete_query,
                {
                    'start_time': start_time,
                    'end_time': end_time,
                    'interval_seconds': interval_seconds
                }
            )

            db.commit()

            return result.rowcount if result.rowcount else 0

        except Exception as e:
            db.rollback()
            logger.error(f"Error downsampling time range {range_name}: {e}", exc_info=True)
            return 0
