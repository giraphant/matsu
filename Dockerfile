# Multi-stage build for frontend and backend
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Force cache bust - change this value to force rebuild
ARG CACHE_BUST=2025-10-15-v6-fix-entrypoint

# Copy frontend source
COPY frontend/ ./

# Build frontend (Next.js with static export)
RUN npm run build

# Stage 2: Python backend with built frontend
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV PORT=9988

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        libc6-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements first for better caching
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Copy built frontend from frontend-builder stage (Next.js outputs to out/)
COPY --from=frontend-builder /build/out/ static/

# Create required directories
RUN mkdir -p data static logs

# Copy and set entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Note: Running as root to allow entrypoint to manage directory permissions
# when volumes are mounted. This is necessary for Coolify deployment.

# Expose port
EXPOSE 9988

# Health check for Coolify
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9988/health || exit 1

# Run the application
CMD ["/docker-entrypoint.sh"]