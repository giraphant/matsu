#!/usr/bin/env python3
"""
Data cleanup script for Distill monitoring database.
Removes old monitoring data to prevent database bloat.
"""

import os
import sys
from datetime import datetime, timedelta
from sqlalchemy import func

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models.database import SessionLocal, MonitoringData


def cleanup_old_data(days_to_keep: int = 90, dry_run: bool = False):
    """
    Delete monitoring data older than specified days.

    Args:
        days_to_keep: Number of days of data to retain (default: 90)
        dry_run: If True, only show what would be deleted without actually deleting
    """
    db = SessionLocal()

    try:
        # Calculate cutoff date
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)

        # Count records to be deleted
        old_records_count = db.query(MonitoringData).filter(
            MonitoringData.timestamp < cutoff_date
        ).count()

        # Get total records before cleanup
        total_records = db.query(MonitoringData).count()

        print(f"Database cleanup analysis:")
        print(f"  Total records: {total_records:,}")
        print(f"  Cutoff date: {cutoff_date.date()}")
        print(f"  Records older than {days_to_keep} days: {old_records_count:,}")
        print(f"  Records to keep: {total_records - old_records_count:,}")
        print(f"  Percentage to delete: {(old_records_count / total_records * 100):.2f}%")

        if old_records_count == 0:
            print("\n✓ No old records to delete.")
            return

        if dry_run:
            print(f"\n[DRY RUN] Would delete {old_records_count:,} records")
            print("Run without --dry-run flag to actually delete the data")
            return

        # Confirm deletion
        print(f"\n⚠️  This will permanently delete {old_records_count:,} records!")
        confirm = input("Type 'yes' to confirm deletion: ")

        if confirm.lower() != 'yes':
            print("Deletion cancelled.")
            return

        # Delete old records
        print(f"\nDeleting {old_records_count:,} records...")
        deleted = db.query(MonitoringData).filter(
            MonitoringData.timestamp < cutoff_date
        ).delete(synchronize_session=False)

        db.commit()

        print(f"✓ Deleted {deleted:,} records")
        print(f"✓ Remaining records: {db.query(MonitoringData).count():,}")

        # Vacuum database to reclaim space
        print("\nOptimizing database (VACUUM)...")
        db.execute("VACUUM")
        print("✓ Database optimized")

    except Exception as e:
        print(f"\n✗ Error during cleanup: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def get_database_stats():
    """Display current database statistics."""
    db = SessionLocal()

    try:
        total_records = db.query(MonitoringData).count()

        # Get oldest and newest records
        oldest = db.query(func.min(MonitoringData.timestamp)).scalar()
        newest = db.query(func.max(MonitoringData.timestamp)).scalar()

        # Get records per monitor
        monitors = db.query(
            MonitoringData.monitor_id,
            func.count(MonitoringData.id).label('count')
        ).group_by(MonitoringData.monitor_id).all()

        print("Database Statistics:")
        print(f"  Total records: {total_records:,}")
        print(f"  Oldest record: {oldest}")
        print(f"  Newest record: {newest}")
        if oldest and newest:
            age_days = (newest - oldest).days
            print(f"  Data age span: {age_days} days")
        print(f"\nRecords per monitor:")
        for monitor_id, count in sorted(monitors, key=lambda x: x[1], reverse=True):
            print(f"    {monitor_id}: {count:,}")

    finally:
        db.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Cleanup old monitoring data')
    parser.add_argument(
        '--days',
        type=int,
        default=90,
        help='Number of days of data to keep (default: 90)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be deleted without actually deleting'
    )
    parser.add_argument(
        '--stats',
        action='store_true',
        help='Show database statistics only'
    )

    args = parser.parse_args()

    if args.stats:
        get_database_stats()
    else:
        cleanup_old_data(days_to_keep=args.days, dry_run=args.dry_run)
