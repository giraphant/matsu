#!/usr/bin/env python3
"""
Database migration: Change category column to tags column in monitors table

Run this script to rename category to tags and change format from single value to JSON array.
"""

import sys
import os
import sqlite3
import json

# Database path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'monitoring.db')


def upgrade():
    """Change category column to tags column."""
    print(f"Migrating monitors table: category -> tags...")
    print(f"Database: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if category column exists
        cursor.execute("PRAGMA table_info(monitors)")
        columns = {row[1]: row for row in cursor.fetchall()}

        if 'tags' in columns:
            print("✓ Tags column already exists, skipping migration")
            return

        # Check if we're migrating from category or creating fresh
        if 'category' in columns:
            print("  Found category column, migrating to tags...")

            # Create new tags column
            cursor.execute("ALTER TABLE monitors ADD COLUMN tags TEXT")

            # Migrate data: convert single category to JSON array
            cursor.execute("SELECT id, category FROM monitors WHERE category IS NOT NULL")
            for row in cursor.fetchall():
                monitor_id, category = row
                tags_json = json.dumps([category])
                cursor.execute("UPDATE monitors SET tags = ? WHERE id = ?", (tags_json, monitor_id))

            # Note: SQLite doesn't support DROP COLUMN easily, but we can just ignore it
            print("  ✓ Migrated category data to tags (category column left for compatibility)")
        else:
            print("  No category column found, adding tags column...")
            cursor.execute("ALTER TABLE monitors ADD COLUMN tags TEXT")
            print("  ✓ Added tags column")

        conn.commit()
        print("✓ Successfully migrated to tags column")
        print("  Column type: TEXT (JSON array)")
        print("  Example value: [\"资金费率\", \"高优先级\"]")

    finally:
        conn.close()


def downgrade():
    """Rollback: tags -> category."""
    print("Note: Downgrade would convert tags array back to single category.")
    print("This would lose data if monitors have multiple tags.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Migrate monitors table')
    parser.add_argument('--down', action='store_true', help='Downgrade migration')
    args = parser.parse_args()

    if args.down:
        downgrade()
    else:
        upgrade()
