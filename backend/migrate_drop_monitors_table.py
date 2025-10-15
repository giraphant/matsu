#!/usr/bin/env python3
"""
Database migration: Drop and recreate monitors table
The monitors table has an old schema with 'type' column.
This script drops it and lets SQLAlchemy recreate with new schema.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models.database import engine, Monitor, MonitorValue, AlertRule, Base
from sqlalchemy import inspect, text

def migrate():
    """Drop old monitors table and recreate with new schema."""
    inspector = inspect(engine)

    with engine.begin() as conn:
        # Check if monitors table exists
        if 'monitors' in inspector.get_table_names():
            print("→ Found existing 'monitors' table")

            # Check if it has the old 'type' column
            columns = [col['name'] for col in inspector.get_columns('monitors')]
            if 'type' in columns:
                print("  ✗ Table has old schema with 'type' column")

                # Drop the table
                print("  → Dropping old monitors table...")
                conn.execute(text("DROP TABLE monitors"))
                print("  ✓ Dropped")
            else:
                print("  ✓ Table already has new schema (no 'type' column)")
                return True
        else:
            print("→ No existing 'monitors' table found")

        # Create tables with new schema
        print("→ Creating tables with new schema...")
        Base.metadata.create_all(bind=engine, tables=[
            Monitor.__table__,
            MonitorValue.__table__,
            AlertRule.__table__
        ])
        print("✓ Tables created successfully")

        # Verify new schema
        inspector = inspect(engine)
        new_columns = [col['name'] for col in inspector.get_columns('monitors')]
        print(f"✓ New schema columns: {new_columns}")

        if 'type' not in new_columns:
            print("✓ Migration successful - 'type' column removed")
            return True
        else:
            print("✗ Migration failed - 'type' column still exists")
            return False

if __name__ == "__main__":
    print("=" * 60)
    print("Monitor System Migration: Drop and Recreate Monitors Table")
    print("=" * 60)
    print()

    success = migrate()

    print()
    if success:
        print("✓ Migration completed successfully!")
    else:
        print("✗ Migration failed.")
    print("=" * 60)
