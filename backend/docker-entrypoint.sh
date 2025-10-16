#!/bin/bash
set -e

echo "Starting Matsu Backend API..."

# Ensure required directories exist and are writable
# This is important when volumes are mounted from the host
echo "Ensuring required directories exist..."
mkdir -p /app/data /app/logs
chmod 755 /app/data /app/logs 2>/dev/null || true

# Start FastAPI server (background workers start automatically via startup.py)
echo "Starting FastAPI server on :9988..."
exec python main.py
