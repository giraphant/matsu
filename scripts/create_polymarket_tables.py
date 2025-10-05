#!/usr/bin/env python3
"""
Create Polymarket tables in database.
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


def create_polymarket_tables():
    """Create Polymarket-related tables."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Create polymarket_markets table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS polymarket_markets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                condition_id TEXT UNIQUE NOT NULL,
                question_id TEXT,
                question TEXT NOT NULL,
                description TEXT,
                market_slug TEXT,
                end_date_iso TIMESTAMP,
                game_start_time TIMESTAMP,
                icon TEXT,
                image TEXT,
                active BOOLEAN DEFAULT 1,
                closed BOOLEAN DEFAULT 0,
                archived BOOLEAN DEFAULT 0,
                tokens_json TEXT,
                tags TEXT,
                fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create index on condition_id
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_polymarket_condition
            ON polymarket_markets(condition_id)
        """)

        # Create polymarket_analyses table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS polymarket_analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                condition_id TEXT NOT NULL,
                analysis_text TEXT NOT NULL,
                model_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (condition_id) REFERENCES polymarket_markets(condition_id)
            )
        """)

        # Create index on condition_id for analyses
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_analysis_condition
            ON polymarket_analyses(condition_id)
        """)

        conn.commit()
        print("✓ Successfully created Polymarket tables")
        print("  - polymarket_markets")
        print("  - polymarket_analyses")

    except Exception as e:
        print(f"✗ Error creating tables: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    print("Creating Polymarket tables...")
    create_polymarket_tables()
