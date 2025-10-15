#!/bin/bash
set -e

echo "Starting Matsu Monitor System..."

# Ensure required directories exist and are writable
# This is important when volumes are mounted from the host
echo "Ensuring required directories exist..."
mkdir -p /app/data /app/logs /app/static
chmod 755 /app/data /app/logs /app/static 2>/dev/null || true

# Start FastAPI server (background workers start automatically via startup.py)
echo "Starting FastAPI server..."
exec python main.py
