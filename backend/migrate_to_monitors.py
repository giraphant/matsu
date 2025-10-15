#!/usr/bin/env python3
"""
Migration script: Convert existing data to new Monitor System

This script:
1. Migrates all webhook monitors (monitoring_data) to direct monitors
2. Migrates all constant cards to constant monitors
3. Computes initial values for all monitors
4. Preserves all existing data (non-destructive migration)

Run with: python migrate_to_monitors.py
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import distinct
from datetime import datetime

from app.models.database import (
    SessionLocal,
    MonitoringData,
    ConstantCard,
    Monitor,
    create_tables
)
from app.services.monitor_service import MonitorService
from app.core.logger import get_logger

logger = get_logger(__name__)


def migrate_webhook_monitors(db):
    """
    Migrate all webhook monitors to direct monitors.
    Each unique monitor_id in monitoring_data becomes a direct monitor.
    """
    logger.info("Starting webhook monitor migration...")

    # Get all unique monitor IDs from monitoring_data
    monitor_ids = db.query(distinct(MonitoringData.monitor_id)).all()

    service = MonitorService(db)
    migrated = 0
    skipped = 0

    for (monitor_id,) in monitor_ids:
        # Get latest record for this monitor to extract metadata
        latest = db.query(MonitoringData).filter(
            MonitoringData.monitor_id == monitor_id
        ).order_by(MonitoringData.timestamp.desc()).first()

        if not latest:
            continue

        # Skip if monitor type is 'constant' (will be migrated separately)
        if latest.monitor_type == 'constant':
            continue

        # Check if monitor already exists
        existing = db.query(Monitor).filter(Monitor.id == f"direct_{monitor_id}").first()
        if existing:
            logger.debug(f"Monitor already exists: direct_{monitor_id}")
            skipped += 1
            continue

        # Create direct monitor
        monitor = Monitor(
            id=f"direct_{monitor_id}",
            name=latest.monitor_name or f"Monitor {monitor_id[:8]}",
            type='direct',
            formula=f"${{webhook:{monitor_id}}}",
            unit=latest.unit,
            description=latest.description,
            color=latest.color,
            decimal_places=latest.decimal_places or 2,
            enabled=True
        )

        db.add(monitor)
        migrated += 1
        logger.info(f"Migrated webhook monitor: {monitor.id} ({monitor.name})")

    db.commit()
    logger.info(f"Webhook monitor migration complete: {migrated} migrated, {skipped} skipped")
    return migrated


def migrate_constant_cards(db):
    """
    Migrate all constant cards to constant monitors.
    """
    logger.info("Starting constant card migration...")

    constant_cards = db.query(ConstantCard).all()

    migrated = 0
    skipped = 0

    for card in constant_cards:
        # Check if monitor already exists
        existing = db.query(Monitor).filter(Monitor.id == f"const_{card.id}").first()
        if existing:
            logger.debug(f"Monitor already exists: const_{card.id}")
            skipped += 1
            continue

        # Create constant monitor
        monitor = Monitor(
            id=f"const_{card.id}",
            name=card.name,
            type='constant',
            formula=str(card.value),
            unit=card.unit,
            description=card.description,
            color=card.color,
            decimal_places=2,
            enabled=True
        )

        db.add(monitor)
        migrated += 1
        logger.info(f"Migrated constant card: {monitor.id} ({monitor.name})")

    db.commit()
    logger.info(f"Constant card migration complete: {migrated} migrated, {skipped} skipped")
    return migrated


def compute_initial_values(db):
    """
    Compute initial values for all monitors.
    """
    logger.info("Computing initial values for all monitors...")

    service = MonitorService(db)
    recomputed = service.recompute_all()

    logger.info(f"Initial value computation complete: {len(recomputed)} monitors")
    return len(recomputed)


def main():
    """Run migration."""
    logger.info("=" * 60)
    logger.info("Starting migration to new Monitor System")
    logger.info("=" * 60)

    # Create tables if they don't exist
    create_tables()

    db = SessionLocal()

    try:
        # Step 1: Migrate webhook monitors
        webhook_count = migrate_webhook_monitors(db)

        # Step 2: Migrate constant cards
        constant_count = migrate_constant_cards(db)

        # Step 3: Compute initial values
        computed_count = compute_initial_values(db)

        logger.info("=" * 60)
        logger.info("Migration Summary:")
        logger.info(f"  - Webhook monitors migrated: {webhook_count}")
        logger.info(f"  - Constant cards migrated: {constant_count}")
        logger.info(f"  - Initial values computed: {computed_count}")
        logger.info("=" * 60)
        logger.info("Migration completed successfully!")
        logger.info("")
        logger.info("Next steps:")
        logger.info("  1. Verify monitors at: /api/monitors")
        logger.info("  2. Create computed monitors for formulas like A-B")
        logger.info("  3. Set up alert rules at: /api/alert-rules")

        return 0

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return 1

    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
