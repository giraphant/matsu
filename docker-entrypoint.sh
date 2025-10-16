#!/bin/bash
set -e

echo "Starting Matsu Monitor System..."

# Ensure required directories exist and are writable
# This is important when volumes are mounted from the host
echo "Ensuring required directories exist..."
mkdir -p /app/data /app/logs /var/log/supervisor
chmod 755 /app/data /app/logs 2>/dev/null || true

# Start both Python API and Next.js frontend via supervisord
echo "Starting supervisord (Python API on :9988, Next.js on :13145)..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
