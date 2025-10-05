#!/bin/bash
set -e

echo "Starting Distill Webhook Visualizer..."

# Ensure required directories exist and are writable
# This is important when volumes are mounted from the host
echo "Ensuring required directories exist..."
mkdir -p /app/data /app/logs /app/static
chmod 755 /app/data /app/logs /app/static 2>/dev/null || true

# Run database migrations
echo "Running database migrations..."
python -c "
import sqlite3
import os

DB_PATH = '/app/data/monitoring.db'

# Ensure database exists
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

try:
    # Create Polymarket tables if they don't exist
    cursor.execute('''
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
    ''')

    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_polymarket_condition
        ON polymarket_markets(condition_id)
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS polymarket_analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            condition_id TEXT NOT NULL,
            analysis_text TEXT NOT NULL,
            model_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (condition_id) REFERENCES polymarket_markets(condition_id)
        )
    ''')

    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_analysis_condition
        ON polymarket_analyses(condition_id)
    ''')

    conn.commit()
    print('✓ Database migrations completed')
except Exception as e:
    print(f'⚠ Migration error (may be normal): {e}')
finally:
    conn.close()
"

# Start alert daemon in background
echo "Starting alert daemon..."
python alert_daemon.py &
DAEMON_PID=$!
echo "Alert daemon started with PID $DAEMON_PID"

# Start FastAPI server in foreground
echo "Starting FastAPI server..."
exec python main.py
