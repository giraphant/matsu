#!/usr/bin/env python3
"""
Database migration: Remove 'type' column from monitors table
All monitors are now just formulas - no type distinction needed.
"""

import sqlite3
import os
import shutil
from datetime import datetime

# Database path
DB_PATH = "/home/matsu/data/distill.db"

def backup_database():
    """Create a backup of the database."""
    backup_path = f"{DB_PATH}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(DB_PATH, backup_path)
    print(f"✓ Database backed up to: {backup_path}")
    return backup_path

def migrate():
    """Remove type column from monitors table."""
    if not os.path.exists(DB_PATH):
        print(f"✗ Database not found at {DB_PATH}")
        return False

    # Backup first
    backup_path = backup_database()

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if monitors table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='monitors'")
        if not cursor.fetchone():
            print("✗ Monitors table does not exist. Migration not needed.")
            return True

        # Check if type column exists
        cursor.execute("PRAGMA table_info(monitors)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]

        if 'type' not in column_names:
            print("✓ Type column already removed. No migration needed.")
            return True

        print("→ Removing 'type' column from monitors table...")

        # SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
        # 1. Create new table without type column
        cursor.execute("""
            CREATE TABLE monitors_new (
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

        # 2. Copy data (excluding type column)
        cursor.execute("""
            INSERT INTO monitors_new (id, name, formula, unit, description, color, decimal_places, enabled, created_at, updated_at)
            SELECT id, name, formula, unit, description, color, decimal_places, enabled, created_at, updated_at
            FROM monitors
        """)

        # 3. Drop old table
        cursor.execute("DROP TABLE monitors")

        # 4. Rename new table
        cursor.execute("ALTER TABLE monitors_new RENAME TO monitors")

        conn.commit()
        print("✓ Successfully removed 'type' column from monitors table")

        # Verify
        cursor.execute("PRAGMA table_info(monitors)")
        new_columns = cursor.fetchall()
        print(f"✓ New schema has {len(new_columns)} columns: {[col[1] for col in new_columns]}")

        return True

    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
        print(f"  Restoring from backup: {backup_path}")
        conn.close()
        shutil.copy2(backup_path, DB_PATH)
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Monitor System Migration: Remove 'type' Column")
    print("=" * 60)
    print()

    success = migrate()

    print()
    if success:
        print("✓ Migration completed successfully!")
    else:
        print("✗ Migration failed. Database restored from backup.")
    print("=" * 60)
