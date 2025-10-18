#!/usr/bin/env python3
"""
Database migration: Add heartbeat monitoring fields to monitors table

Adds:
- heartbeat_enabled (BOOLEAN): Whether to check for data staleness
- heartbeat_interval (INTEGER): Expected interval in seconds between data updates

Usage:
    python migrations/add_heartbeat_to_monitors.py
"""

import sqlite3
import os
import sys

# Determine database path
if os.path.exists('/home/matsu/data/monitoring.db'):
    DB_PATH = '/home/matsu/data/monitoring.db'
elif os.path.exists('/app/data/monitoring.db'):
    DB_PATH = '/app/data/monitoring.db'
else:
    DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'monitoring.db')

print(f"Using database: {DB_PATH}")

if not os.path.exists(DB_PATH):
    print(f"ERROR: Database not found at {DB_PATH}")
    sys.exit(1)


def upgrade():
    """Add heartbeat monitoring fields to monitors table."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(monitors)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'heartbeat_enabled' in columns:
            print("Column 'heartbeat_enabled' already exists, skipping...")
        else:
            print("Adding heartbeat_enabled column...")
            cursor.execute("""
                ALTER TABLE monitors
                ADD COLUMN heartbeat_enabled BOOLEAN DEFAULT 0
            """)
            print("✓ Added heartbeat_enabled column")

        if 'heartbeat_interval' in columns:
            print("Column 'heartbeat_interval' already exists, skipping...")
        else:
            print("Adding heartbeat_interval column...")
            cursor.execute("""
                ALTER TABLE monitors
                ADD COLUMN heartbeat_interval INTEGER
            """)
            print("✓ Added heartbeat_interval column")

        conn.commit()
        print("\n✅ Migration completed successfully!")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        conn.close()


def downgrade():
    """Remove heartbeat monitoring fields (SQLite doesn't support DROP COLUMN easily)."""
    print("Downgrade not supported for SQLite ALTER TABLE ADD COLUMN")
    print("To remove columns, you would need to:")
    print("1. Create new table without the columns")
    print("2. Copy data over")
    print("3. Drop old table and rename new one")


if __name__ == "__main__":
    print("=" * 60)
    print("Migration: Add heartbeat monitoring to monitors table")
    print("=" * 60)
    print()

    upgrade()

    print()
    print("Next steps:")
    print("1. Restart backend service")
    print("2. Configure heartbeat_interval for monitors in UI")
    print("3. Heartbeat checker will automatically monitor data staleness")
