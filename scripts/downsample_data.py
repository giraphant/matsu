#!/usr/bin/env python3
"""
Data downsampling script for Distill monitoring database.
Applies time-based retention policy to reduce database size while keeping historical trends.

Retention Policy:
- Last 24 hours: Keep all data (full precision)
- 1-7 days: Keep 1 sample every 5 minutes
- 7-30 days: Keep 1 sample every 10 minutes
- 30+ days: Keep 1 sample every 15 minutes
"""

import os
import sys
from datetime import datetime, timedelta
from sqlalchemy import create_engine, func, and_, text, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from typing import Dict, Any

# Direct database connection - avoid circular imports
DATABASE_PATH = os.getenv('DATABASE_PATH', '/app/data/monitoring.db')
DATABASE_URL = f'sqlite:///{DATABASE_PATH}'

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Define minimal models needed for downsampling
class SpotPrice(Base):
    __tablename__ = "spot_prices"
    id = Column(Integer, primary_key=True, autoincrement=True)
    exchange = Column(String, nullable=False, index=True)
    symbol = Column(String, nullable=False, index=True)
    price = Column(Float, nullable=False)
    volume_24h = Column(Float, nullable=True)
    timestamp = Column(DateTime, nullable=False, index=True, default=datetime.utcnow)

class MonitorValue(Base):
    __tablename__ = 'monitor_values'
    id = Column(Integer, primary_key=True, autoincrement=True)
    monitor_id = Column(String, nullable=False, index=True)
    value = Column(Float)
    computed_at = Column(DateTime, default=datetime.utcnow, index=True)
    dependencies = Column(Text)

class WebhookData(Base):
    __tablename__ = "monitoring_data"
    id = Column(Integer, primary_key=True, index=True)
    monitor_id = Column(String, index=True, nullable=False)
    monitor_name = Column(String, nullable=True)
    url = Column(String, nullable=False, default='')
    value = Column(Float, nullable=True)
    text_value = Column(Text, nullable=True)
    timestamp = Column(DateTime, nullable=False, index=True)


class DataDownsampler:
    """Handles time-based data downsampling for database tables."""

    # Retention policy configuration
    POLICY = [
        {"name": "Last 24 hours", "days_ago": 0, "interval_minutes": 0, "keep_all": True},
        {"name": "1-7 days", "days_ago": 1, "days_until": 7, "interval_minutes": 5},
        {"name": "7-30 days", "days_ago": 7, "days_until": 30, "interval_minutes": 10},
        {"name": "30+ days", "days_ago": 30, "days_until": None, "interval_minutes": 15},
    ]

    def __init__(self, dry_run: bool = True, auto_backup: bool = True, keep_backups: int = 3):
        self.dry_run = dry_run
        self.auto_backup = auto_backup
        self.keep_backups = keep_backups
        self.db = SessionLocal()
        self.backup_file = None
        self.stats = {
            'spot_prices': {'before': 0, 'after': 0, 'deleted': 0},
            'monitor_values': {'before': 0, 'after': 0, 'deleted': 0},
            'monitoring_data': {'before': 0, 'after': 0, 'deleted': 0},
        }

    def create_backup(self) -> str:
        """
        Create a backup of the database before downsampling.
        Returns the backup file path.
        """
        import shutil

        db_path = DATABASE_PATH
        if not os.path.exists(db_path):
            print(f"⚠️  Database not found at {db_path}")
            return None

        # Create backup filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        backup_path = f"{db_path}.backup-{timestamp}"

        print(f"\n{'='*60}")
        print("CREATING BACKUP")
        print(f"{'='*60}")
        print(f"Source: {db_path}")
        print(f"Backup: {backup_path}")

        try:
            # Get original file size
            original_size = os.path.getsize(db_path)
            print(f"Size: {original_size / 1024 / 1024:.1f} MB")

            # Copy database file
            shutil.copy2(db_path, backup_path)

            print(f"✓ Backup created successfully")

            return backup_path

        except Exception as e:
            print(f"✗ Failed to create backup: {e}")
            raise

    def cleanup_old_backups(self):
        """Remove old backup files, keeping only the most recent N backups."""
        import glob

        db_path = DATABASE_PATH
        backup_pattern = f"{db_path}.backup-*"

        # Find all backup files
        backups = glob.glob(backup_pattern)

        if len(backups) <= self.keep_backups:
            return

        # Sort by modification time (oldest first)
        backups.sort(key=os.path.getmtime)

        # Remove oldest backups
        to_remove = backups[:-self.keep_backups]

        if to_remove:
            print(f"\n{'='*60}")
            print(f"CLEANING UP OLD BACKUPS (keeping {self.keep_backups} most recent)")
            print(f"{'='*60}")

            for backup in to_remove:
                try:
                    backup_size = os.path.getsize(backup) / 1024 / 1024
                    os.remove(backup)
                    print(f"✓ Removed: {os.path.basename(backup)} ({backup_size:.1f} MB)")
                except Exception as e:
                    print(f"✗ Failed to remove {backup}: {e}")

    def get_time_ranges(self):
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
                    'start': end,  # Swapped for correct range
                    'end': start,
                    'keep_all': False,
                    'interval_minutes': policy['interval_minutes']
                })

        return ranges

    def downsample_table(self, model, time_column: str, table_name: str):
        """
        Downsample a table based on retention policy.

        Args:
            model: SQLAlchemy model class
            time_column: Name of timestamp column
            table_name: Display name for stats
        """
        print(f"\n{'='*60}")
        print(f"Processing table: {table_name}")
        print(f"{'='*60}")

        # Get initial count
        initial_count = self.db.query(model).count()
        self.stats[table_name]['before'] = initial_count
        print(f"Initial record count: {initial_count:,}")

        if initial_count == 0:
            print("✓ Table is empty, skipping")
            return

        total_deleted = 0
        ranges = self.get_time_ranges()

        for time_range in ranges:
            if time_range['keep_all']:
                # Count records in this range (just for info)
                count = self.db.query(model).filter(
                    getattr(model, time_column) >= time_range['start']
                ).count()
                print(f"\n{time_range['name']}: {count:,} records (keeping all)")
                continue

            deleted = self._downsample_time_range(
                model,
                time_column,
                time_range['start'],
                time_range['end'],
                time_range['interval_minutes'],
                time_range['name']
            )
            total_deleted += deleted

        # Get final count
        final_count = self.db.query(model).count()
        self.stats[table_name]['after'] = final_count
        self.stats[table_name]['deleted'] = total_deleted

        print(f"\n{table_name} Summary:")
        print(f"  Before: {initial_count:,} records")
        print(f"  After: {final_count:,} records")
        print(f"  Deleted: {total_deleted:,} records ({total_deleted/initial_count*100:.1f}%)")

    def _downsample_time_range(self, model, time_column: str, start_time: datetime,
                               end_time: datetime, interval_minutes: int, range_name: str) -> int:
        """
        Downsample records in a specific time range by keeping one sample per interval.

        Returns:
            Number of records deleted
        """
        # Count records in this range
        records_in_range = self.db.query(model).filter(
            and_(
                getattr(model, time_column) >= start_time,
                getattr(model, time_column) < end_time
            )
        ).count()

        if records_in_range == 0:
            print(f"\n{range_name}: 0 records (skipping)")
            return 0

        print(f"\n{range_name}:")
        print(f"  Time range: {start_time.strftime('%Y-%m-%d %H:%M')} to {end_time.strftime('%Y-%m-%d %H:%M')}")
        print(f"  Records before: {records_in_range:,}")
        print(f"  Sampling interval: {interval_minutes} minutes")

        if self.dry_run:
            # Estimate records to keep
            time_span = (end_time - start_time).total_seconds() / 60  # minutes
            estimated_kept = int(time_span / interval_minutes) + 1
            estimated_deleted = max(0, records_in_range - estimated_kept)
            print(f"  [DRY RUN] Would keep ~{estimated_kept:,} records")
            print(f"  [DRY RUN] Would delete ~{estimated_deleted:,} records")
            return 0

        # Build query to find records to delete
        # Keep one record per interval by grouping time into buckets
        interval_seconds = interval_minutes * 60

        # Use SQLite's datetime functions to create time buckets
        # We'll keep the first record in each bucket and delete the rest

        # For better performance, we'll use a different approach:
        # 1. Get all records in the time range
        # 2. Group by time buckets
        # 3. Keep first record in each bucket, delete others

        # This is complex in SQLAlchemy, so we'll use raw SQL for efficiency
        table_name = model.__tablename__

        # Create temporary table with records to keep
        # Using strftime to bucket by interval
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

        result = self.db.execute(
            delete_query,
            {
                'start_time': start_time,
                'end_time': end_time,
                'interval_seconds': interval_seconds
            }
        )

        self.db.commit()

        deleted_count = result.rowcount
        records_after = self.db.query(model).filter(
            and_(
                getattr(model, time_column) >= start_time,
                getattr(model, time_column) < end_time
            )
        ).count()

        print(f"  ✓ Deleted {deleted_count:,} records")
        print(f"  ✓ Kept {records_after:,} records")

        return deleted_count

    def run(self):
        """Execute downsampling on all tables."""
        try:
            print("\n" + "="*60)
            print("DATA DOWNSAMPLING TOOL")
            print("="*60)
            print(f"Mode: {'DRY RUN (no changes)' if self.dry_run else 'LIVE (will modify database)'}")
            print(f"Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")

            print("\nRetention Policy:")
            for policy in self.POLICY:
                if policy.get('keep_all'):
                    print(f"  • {policy['name']}: Keep all records")
                else:
                    interval = policy['interval_minutes']
                    print(f"  • {policy['name']}: Keep 1 sample every {interval} minutes")

            # Create backup before actual execution
            if not self.dry_run and self.auto_backup:
                self.backup_file = self.create_backup()
                if not self.backup_file:
                    print("\n⚠️  Warning: Failed to create backup. Aborting.")
                    return

            # Process each table
            self.downsample_table(SpotPrice, 'timestamp', 'spot_prices')
            self.downsample_table(MonitorValue, 'computed_at', 'monitor_values')
            self.downsample_table(WebhookData, 'timestamp', 'monitoring_data')

            # Print overall summary
            print("\n" + "="*60)
            print("OVERALL SUMMARY")
            print("="*60)

            total_before = sum(s['before'] for s in self.stats.values())
            total_after = sum(s['after'] for s in self.stats.values())
            total_deleted = sum(s['deleted'] for s in self.stats.values())

            for table, stats in self.stats.items():
                if stats['before'] > 0:
                    reduction = (stats['deleted'] / stats['before'] * 100) if stats['before'] > 0 else 0
                    print(f"\n{table}:")
                    print(f"  Before: {stats['before']:,}")
                    print(f"  After: {stats['after']:,}")
                    print(f"  Deleted: {stats['deleted']:,} ({reduction:.1f}%)")

            print(f"\nTotal:")
            print(f"  Before: {total_before:,}")
            print(f"  After: {total_after:,}")
            print(f"  Deleted: {total_deleted:,}")

            if total_before > 0:
                overall_reduction = (total_deleted / total_before * 100)
                print(f"  Overall reduction: {overall_reduction:.1f}%")

            if not self.dry_run and total_deleted > 0:
                print("\n" + "="*60)
                print("OPTIMIZING DATABASE")
                print("="*60)
                print("Running VACUUM to reclaim space...")
                self.db.execute(text("VACUUM"))
                print("✓ Database optimized")

                # Show final database size
                if os.path.exists(DATABASE_PATH):
                    final_size = os.path.getsize(DATABASE_PATH) / 1024 / 1024
                    print(f"✓ Final database size: {final_size:.1f} MB")

                    if self.backup_file and os.path.exists(self.backup_file):
                        backup_size = os.path.getsize(self.backup_file) / 1024 / 1024
                        saved = backup_size - final_size
                        print(f"✓ Space saved: {saved:.1f} MB ({saved/backup_size*100:.1f}%)")

                # Cleanup old backups
                if self.auto_backup:
                    self.cleanup_old_backups()

                print(f"\n💾 Backup saved: {os.path.basename(self.backup_file) if self.backup_file else 'N/A'}")

            if self.dry_run:
                print("\n" + "="*60)
                print("This was a DRY RUN - no data was deleted")
                print("Run with --execute flag to actually perform downsampling")
                print("="*60)

        except Exception as e:
            print(f"\n✗ Error during downsampling: {e}")
            self.db.rollback()
            raise
        finally:
            self.db.close()


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description='Downsample time-series data to reduce database size',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Retention Policy:
  • Last 24 hours: Keep all records (full precision)
  • 1-7 days: Keep 1 sample every 5 minutes
  • 7-30 days: Keep 1 sample every 10 minutes
  • 30+ days: Keep 1 sample every 15 minutes

Backup Policy:
  • Automatic backup before execution (enabled by default)
  • Keeps 3 most recent backups (configurable)
  • Old backups automatically cleaned up

Example Usage:
  # Preview what would be deleted (safe)
  python scripts/downsample_data.py

  # Actually perform downsampling (with auto backup)
  python scripts/downsample_data.py --execute

  # Skip backup (not recommended)
  python scripts/downsample_data.py --execute --no-backup

  # Keep more backups
  python scripts/downsample_data.py --execute --keep-backups 5
        """
    )

    parser.add_argument(
        '--execute',
        action='store_true',
        help='Actually perform downsampling (default is dry-run)'
    )

    parser.add_argument(
        '--no-backup',
        action='store_true',
        help='Skip automatic backup before execution (not recommended)'
    )

    parser.add_argument(
        '--keep-backups',
        type=int,
        default=3,
        help='Number of backup files to keep (default: 3)'
    )

    args = parser.parse_args()

    # Confirm if not dry-run
    if args.execute:
        print("\n⚠️  WARNING: This will permanently delete data from the database!")
        if not args.no_backup:
            print("✓ Automatic backup will be created before execution")
            print(f"✓ Will keep {args.keep_backups} most recent backups")
        else:
            print("⚠️  Running without backup (--no-backup flag)")

        confirm = input("\nType 'yes' to proceed with downsampling: ")

        if confirm.lower() != 'yes':
            print("Downsampling cancelled.")
            return

    downsampler = DataDownsampler(
        dry_run=not args.execute,
        auto_backup=not args.no_backup,
        keep_backups=args.keep_backups
    )
    downsampler.run()


if __name__ == "__main__":
    main()
