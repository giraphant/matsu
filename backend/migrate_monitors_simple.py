#!/usr/bin/env python3
"""
Simple migration: Drop and recreate monitors table without circular imports.
"""

import os
import sqlite3

# Database path
DB_PATH = os.getenv("DATABASE_PATH", "data/monitoring.db")

def migrate():
    """Drop old monitors table and recreate with new schema."""
    if not os.path.exists(DB_PATH):
        print(f"✗ Database not found at {DB_PATH}")
        return False

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if monitors table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='monitors'")
        if cursor.fetchone():
            print("→ Found existing 'monitors' table")

            # Check if it has the old 'type' column
            cursor.execute("PRAGMA table_info(monitors)")
            columns = cursor.fetchall()
            column_names = [col[1] for col in columns]

            if 'type' in column_names:
                print("  ✗ Table has old schema with 'type' column")

                # Drop the table
                print("  → Dropping old monitors table...")
                cursor.execute("DROP TABLE monitors")
                print("  ✓ Dropped")
            else:
                print("  ✓ Table already has new schema (no 'type' column)")
                conn.close()
                return True
        else:
            print("→ No existing 'monitors' table found")

        # Create new table without 'type' column
        print("→ Creating monitors table with new schema...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS monitors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                formula TEXT NOT NULL,
                unit TEXT,
                description TEXT,
                color TEXT,
                decimal_places INTEGER DEFAULT 2,
                enabled BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create monitor_values table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS monitor_values (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                monitor_id TEXT NOT NULL,
                value REAL,
                computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                dependencies TEXT
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_monitor_values_monitor_id ON monitor_values(monitor_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_monitor_values_computed_at ON monitor_values(computed_at)")

        # Create alert_rules table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS alert_rules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                condition TEXT NOT NULL,
                level TEXT DEFAULT 'medium',
                enabled BOOLEAN DEFAULT 1,
                cooldown_seconds INTEGER DEFAULT 300,
                actions TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.commit()
        print("✓ Tables created successfully")

        # Verify new schema
        cursor.execute("PRAGMA table_info(monitors)")
        new_columns = cursor.fetchall()
        column_names = [col[1] for col in new_columns]
        print(f"✓ New schema columns: {column_names}")

        if 'type' not in column_names and 'formula' in column_names:
            print("✓ Migration successful - 'type' column removed, 'formula' column present")
            return True
        else:
            print("✗ Migration failed - schema incorrect")
            return False

    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
        return False
    finally:
        conn.close()

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
