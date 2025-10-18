#!/usr/bin/env python3
"""
Database migration: Add category column to monitors table

Run this script to add the category field to existing monitors table.
"""

import sys
import os
import sqlite3

# Database path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'monitoring.db')


def upgrade():
    """Add category column to monitors table."""
    print(f"Adding category column to monitors table...")
    print(f"Database: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(monitors)")
        columns = [row[1] for row in cursor.fetchall()]

        if 'category' in columns:
            print("✓ Category column already exists, skipping migration")
            return

        # Add the category column
        cursor.execute("ALTER TABLE monitors ADD COLUMN category TEXT")
        conn.commit()

        print("✓ Successfully added category column to monitors table")
        print("  Column type: TEXT (nullable)")
        print("  Valid values: 'funding', 'spot', 'account', 'hedge', 'other'")

    finally:
        conn.close()


def downgrade():
    """Remove category column from monitors table."""
    print("Note: SQLite does not support dropping columns easily.")
    print("To rollback, you would need to recreate the table without the category column.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Migrate monitors table')
    parser.add_argument('--down', action='store_true', help='Downgrade migration')
    args = parser.parse_args()

    if args.down:
        downgrade()
    else:
        upgrade()
