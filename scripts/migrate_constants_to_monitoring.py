#!/usr/bin/env python3
"""
Migrate constant cards from separate table to monitoring_data table.
"""

import os
import sys
import sqlite3
from datetime import datetime

# Add backend directory to path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.join(script_dir, '..')
sys.path.insert(0, os.path.join(project_dir, 'backend'))

DB_PATH = os.path.join(project_dir, 'data/monitoring.db')


def migrate():
    """Migrate constant cards to monitoring_data table."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if monitor_type column exists
        cursor.execute("PRAGMA table_info(monitoring_data)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'monitor_type' not in columns:
            print("Adding monitor_type column...")
            cursor.execute("ALTER TABLE monitoring_data ADD COLUMN monitor_type TEXT DEFAULT 'monitor'")
            cursor.execute("ALTER TABLE monitoring_data ADD COLUMN color TEXT")
            cursor.execute("ALTER TABLE monitoring_data ADD COLUMN description TEXT")
            # Make url nullable
            print("✓ Added new columns")

        # Check if constant_cards table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='constant_cards'")
        if not cursor.fetchone():
            print("No constant_cards table found, nothing to migrate")
            conn.close()
            return

        # Get all constant cards
        cursor.execute("SELECT id, name, value, unit, description, color, created_at FROM constant_cards")
        constants = cursor.fetchall()

        if not constants:
            print("No constant cards to migrate")
            conn.close()
            return

        print(f"Found {len(constants)} constant cards to migrate")

        # Migrate each constant to monitoring_data
        for const in constants:
            const_id, name, value, unit, description, color, created_at = const
            monitor_id = f"const-{const_id}"

            # Check if already migrated
            cursor.execute("SELECT id FROM monitoring_data WHERE monitor_id = ?", (monitor_id,))
            if cursor.fetchone():
                print(f"  Skipping {name} (already migrated)")
                continue

            # Insert as monitoring_data with type='constant'
            cursor.execute("""
                INSERT INTO monitoring_data
                (monitor_id, monitor_name, monitor_type, url, value, unit, color, description,
                 status, timestamp, webhook_received_at)
                VALUES (?, ?, 'constant', '', ?, ?, ?, ?, 'active', ?, ?)
            """, (monitor_id, name, value, unit, color or '#3b82f6', description,
                  created_at, created_at))

            print(f"  ✓ Migrated: {name}")

        conn.commit()
        print(f"\n✓ Successfully migrated {len(constants)} constant cards")
        print("\nNote: The old constant_cards table has been kept for backup.")
        print("You can drop it manually after verifying the migration:")
        print("  sqlite3 data/monitoring.db 'DROP TABLE constant_cards;'")

    except Exception as e:
        print(f"✗ Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    print("Starting constant cards migration...")
    migrate()
