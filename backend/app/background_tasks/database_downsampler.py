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
from app.models.database import get_db_session, SpotPrice, MonitorValue, WebhookData, FundingRate
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

    # Policy for spot prices (less aggressive, keep for 48 hours)
    SPOT_PRICE_POLICY = [
        {"name": "Last 1 hour", "hours_ago": 0, "hours_until": 1, "keep_all": True},
        {"name": "1-48 hours", "hours_ago": 1, "hours_until": 48, "interval_minutes": 5},
        {"name": "48+ hours", "hours_ago": 48, "hours_until": None, "delete_all": True},
    ]

    # Aggressive policy for non-important funding rates
    AGGRESSIVE_POLICY = [
        {"name": "Last 1 hour", "hours_ago": 0, "hours_until": 1, "keep_all": True},
        {"name": "1-8 hours", "hours_ago": 1, "hours_until": 8, "interval_minutes": 5},
        {"name": "8+ hours", "hours_ago": 8, "hours_until": None, "delete_all": True},
    ]

    # Important funding rates to keep long-term (using default POLICY)
    IMPORTANT_FUNDING_RATES = [
        ("lighter", "BTC"),
        ("lighter", "ETH"),
        ("lighter", "SOL"),
    ]

    def __init__(self, interval: int = 7200, keep_backups: int = 3):
        """
        Initialize database downsampler.

        Args:
            interval: Seconds between runs (default: 7200 = 2 hours)
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
                # Downsample each table with appropriate policy
                self.stats = {}

                # Spot prices: aggressive policy (1h full, 1-8h sampled, 8h+ delete)
                await self._downsample_spot_prices(db)

                # Funding rates: split into important (long-term) and others (aggressive)
                await self._downsample_funding_rates(db)

                # Monitor values and webhook data: use original long-term policy
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

    def _get_spot_price_time_ranges(self):
        """Calculate time ranges for spot price retention policy (48 hours)."""
        now = datetime.utcnow()
        ranges = []

        for policy in self.SPOT_PRICE_POLICY:
            if policy.get('keep_all'):
                # Keep all in this hour range
                hours = policy['hours_until']
                start = now - timedelta(hours=hours)
                end = now
                ranges.append({
                    'name': policy['name'],
                    'start': start,
                    'end': end,
                    'keep_all': True,
                    'delete_all': False,
                    'interval_minutes': 0
                })
            elif policy.get('delete_all'):
                # Delete everything older than this
                hours = policy['hours_ago']
                end = now - timedelta(hours=hours)
                ranges.append({
                    'name': policy['name'],
                    'start': datetime.min,
                    'end': end,
                    'keep_all': False,
                    'delete_all': True,
                    'interval_minutes': 0
                })
            else:
                # Downsample in this range
                hours_start = policy['hours_ago']
                hours_end = policy.get('hours_until')

                start = now - timedelta(hours=hours_start)
                end = now - timedelta(hours=hours_end) if hours_end else datetime.min

                ranges.append({
                    'name': policy['name'],
                    'start': end,
                    'end': start,
                    'keep_all': False,
                    'delete_all': False,
                    'interval_minutes': policy['interval_minutes']
                })

        return ranges

    def _get_aggressive_time_ranges(self):
        """Calculate time ranges for aggressive retention policy (non-important funding rates)."""
        now = datetime.utcnow()
        ranges = []

        for policy in self.AGGRESSIVE_POLICY:
            if policy.get('keep_all'):
                # Keep all in this hour range
                hours = policy['hours_until']
                start = now - timedelta(hours=hours)
                end = now
                ranges.append({
                    'name': policy['name'],
                    'start': start,
                    'end': end,
                    'keep_all': True,
                    'delete_all': False,
                    'interval_minutes': 0
                })
            elif policy.get('delete_all'):
                # Delete everything older than this
                hours = policy['hours_ago']
                end = now - timedelta(hours=hours)
                ranges.append({
                    'name': policy['name'],
                    'start': datetime.min,
                    'end': end,
                    'keep_all': False,
                    'delete_all': True,
                    'interval_minutes': 0
                })
            else:
                # Downsample in this range
                hours_start = policy['hours_ago']
                hours_end = policy.get('hours_until')

                start = now - timedelta(hours=hours_start)
                end = now - timedelta(hours=hours_end) if hours_end else datetime.min

                ranges.append({
                    'name': policy['name'],
                    'start': end,
                    'end': start,
                    'keep_all': False,
                    'delete_all': False,
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

    async def _downsample_spot_prices(self, db):
        """Downsample spot prices (keep for 48 hours)."""
        try:
            from app.models.database import SpotPrice

            # Get initial count
            initial_count = db.query(SpotPrice).count()

            if initial_count == 0:
                logger.info("spot_prices: empty, skipping")
                return

            logger.info(f"spot_prices: {initial_count:,} records")

            total_deleted = 0
            ranges = self._get_spot_price_time_ranges()

            for time_range in ranges:
                if time_range['keep_all']:
                    continue

                if time_range['delete_all']:
                    # Delete everything older than threshold
                    deleted = db.query(SpotPrice).filter(
                        SpotPrice.timestamp < time_range['end']
                    ).delete()
                    db.commit()
                    total_deleted += deleted
                    if deleted > 0:
                        logger.info(f"spot_prices [{time_range['name']}]: deleted {deleted:,} old records")
                else:
                    # Downsample this time range
                    deleted = await self._downsample_time_range(
                        db,
                        SpotPrice,
                        'timestamp',
                        time_range['start'],
                        time_range['end'],
                        time_range['interval_minutes'],
                        time_range['name']
                    )
                    total_deleted += deleted

            # Get final count
            final_count = db.query(SpotPrice).count()

            self.stats['spot_prices'] = {
                'before': initial_count,
                'after': final_count,
                'deleted': total_deleted
            }

            if total_deleted > 0:
                reduction = (total_deleted / initial_count * 100)
                logger.info(f"spot_prices: deleted {total_deleted:,} records ({reduction:.1f}%)")

        except Exception as e:
            logger.error(f"Error downsampling spot_prices: {e}", exc_info=True)

    async def _downsample_funding_rates(self, db):
        """Downsample funding rates with split policy: important ones use long-term, others use aggressive."""
        try:
            from app.models.database import FundingRate

            # Get initial count
            initial_count = db.query(FundingRate).count()

            if initial_count == 0:
                logger.info("funding_rates: empty, skipping")
                return

            logger.info(f"funding_rates: {initial_count:,} records")

            total_deleted = 0

            # Process important funding rates with long-term policy
            for exchange, symbol in self.IMPORTANT_FUNDING_RATES:
                deleted = await self._downsample_important_funding_rate(db, exchange, symbol)
                total_deleted += deleted

            # Process non-important funding rates with aggressive policy
            deleted = await self._downsample_nonimportant_funding_rates(db)
            total_deleted += deleted

            # Get final count
            final_count = db.query(FundingRate).count()

            self.stats['funding_rates'] = {
                'before': initial_count,
                'after': final_count,
                'deleted': total_deleted
            }

            if total_deleted > 0:
                reduction = (total_deleted / initial_count * 100)
                logger.info(f"funding_rates: deleted {total_deleted:,} records ({reduction:.1f}%)")

        except Exception as e:
            logger.error(f"Error downsampling funding_rates: {e}", exc_info=True)

    async def _downsample_important_funding_rate(self, db, exchange: str, symbol: str) -> int:
        """Downsample an important funding rate pair with long-term policy."""
        try:
            from app.models.database import FundingRate

            total_deleted = 0
            ranges = self._get_time_ranges()  # Use default long-term policy

            for time_range in ranges:
                if time_range['keep_all']:
                    continue

                # Count records in this range for this exchange/symbol
                records_in_range = db.query(FundingRate).filter(
                    and_(
                        FundingRate.exchange == exchange,
                        FundingRate.symbol == symbol,
                        FundingRate.timestamp >= time_range['start'],
                        FundingRate.timestamp < time_range['end']
                    )
                ).count()

                if records_in_range == 0:
                    continue

                interval_seconds = time_range['interval_minutes'] * 60
                table_name = FundingRate.__tablename__

                # Downsample using SQL
                delete_query = text(f"""
                    DELETE FROM {table_name}
                    WHERE id IN (
                        SELECT id FROM {table_name}
                        WHERE exchange = :exchange
                          AND symbol = :symbol
                          AND timestamp >= :start_time
                          AND timestamp < :end_time
                          AND id NOT IN (
                            SELECT MIN(id) FROM {table_name}
                            WHERE exchange = :exchange
                              AND symbol = :symbol
                              AND timestamp >= :start_time
                              AND timestamp < :end_time
                            GROUP BY
                              strftime('%s', timestamp) / :interval_seconds
                          )
                    )
                """)

                result = db.execute(
                    delete_query,
                    {
                        'exchange': exchange,
                        'symbol': symbol,
                        'start_time': time_range['start'],
                        'end_time': time_range['end'],
                        'interval_seconds': interval_seconds
                    }
                )

                db.commit()
                deleted = result.rowcount if result.rowcount else 0
                total_deleted += deleted

            if total_deleted > 0:
                logger.info(f"funding_rates [{exchange} {symbol}]: deleted {total_deleted:,} records (long-term policy)")

            return total_deleted

        except Exception as e:
            db.rollback()
            logger.error(f"Error downsampling {exchange} {symbol} funding rate: {e}", exc_info=True)
            return 0

    async def _downsample_nonimportant_funding_rates(self, db) -> int:
        """Downsample all non-important funding rates with aggressive policy."""
        try:
            from app.models.database import FundingRate

            total_deleted = 0
            ranges = self._get_aggressive_time_ranges()

            for time_range in ranges:
                if time_range['keep_all']:
                    continue

                if time_range['delete_all']:
                    # Delete all non-important funding rates older than threshold
                    # Build query to exclude important pairs
                    query = db.query(FundingRate).filter(
                        FundingRate.timestamp < time_range['end']
                    )

                    # Exclude important pairs
                    for exchange, symbol in self.IMPORTANT_FUNDING_RATES:
                        query = query.filter(
                            ~and_(
                                FundingRate.exchange == exchange,
                                FundingRate.symbol == symbol
                            )
                        )

                    deleted = query.delete(synchronize_session=False)
                    db.commit()
                    total_deleted += deleted

                    if deleted > 0:
                        logger.info(f"funding_rates [non-important, {time_range['name']}]: deleted {deleted:,} old records")
                else:
                    # Downsample non-important pairs in this time range
                    # This is complex with exclusions, so we'll use a different approach
                    interval_seconds = time_range['interval_minutes'] * 60
                    table_name = FundingRate.__tablename__

                    # Build exclusion conditions
                    exclusion_conditions = " AND ".join([
                        f"NOT (exchange = '{ex}' AND symbol = '{sym}')"
                        for ex, sym in self.IMPORTANT_FUNDING_RATES
                    ])

                    delete_query = text(f"""
                        DELETE FROM {table_name}
                        WHERE id IN (
                            SELECT id FROM {table_name}
                            WHERE timestamp >= :start_time
                              AND timestamp < :end_time
                              AND ({exclusion_conditions})
                              AND id NOT IN (
                                SELECT MIN(id) FROM {table_name}
                                WHERE timestamp >= :start_time
                                  AND timestamp < :end_time
                                  AND ({exclusion_conditions})
                                GROUP BY
                                  exchange,
                                  symbol,
                                  strftime('%s', timestamp) / :interval_seconds
                              )
                        )
                    """)

                    result = db.execute(
                        delete_query,
                        {
                            'start_time': time_range['start'],
                            'end_time': time_range['end'],
                            'interval_seconds': interval_seconds
                        }
                    )

                    db.commit()
                    deleted = result.rowcount if result.rowcount else 0
                    total_deleted += deleted

                    if deleted > 0:
                        logger.info(f"funding_rates [non-important, {time_range['name']}]: deleted {deleted:,} records")

            return total_deleted

        except Exception as e:
            db.rollback()
            logger.error(f"Error downsampling non-important funding rates: {e}", exc_info=True)
            return 0
