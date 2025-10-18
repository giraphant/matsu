"""
Migration: Add heartbeat monitoring fields to alert_rules table
"""

import sqlite3
import os

# Use relative path from backend directory
DB_PATH = 'data/monitoring.db'


def upgrade():
    """Add heartbeat monitoring fields to alert_rules table."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(alert_rules)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'heartbeat_enabled' not in columns:
            cursor.execute("""
                ALTER TABLE alert_rules
                ADD COLUMN heartbeat_enabled BOOLEAN DEFAULT 0
            """)
            print("✓ Added heartbeat_enabled column to alert_rules")

        if 'heartbeat_interval' not in columns:
            cursor.execute("""
                ALTER TABLE alert_rules
                ADD COLUMN heartbeat_interval INTEGER
            """)
            print("✓ Added heartbeat_interval column to alert_rules")

        conn.commit()
        print("✓ Migration completed successfully")

    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
        raise
    finally:
        conn.close()


def downgrade():
    """Remove heartbeat monitoring fields from alert_rules table."""
    # SQLite doesn't support DROP COLUMN easily, so we'll skip downgrade
    print("Downgrade not implemented for SQLite")


if __name__ == '__main__':
    upgrade()
