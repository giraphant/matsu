# Multi-stage build for frontend and backend
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Force cache bust - change this value to force rebuild
ARG CACHE_BUST=2025-10-16-v11-nodejs-mode

# Copy frontend source
COPY frontend/ ./

# Build frontend (Next.js standalone mode for Node.js SSR)
RUN npm run build

# Stage 2: Python backend with Node.js for Next.js
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV PORT=9988
ENV NEXT_PORT=13145
ENV NODE_ENV=production

# Install system dependencies including Node.js and supervisor
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        libc6-dev \
        curl \
        supervisor \
        ca-certificates \
        gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements first for better caching
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Copy built Next.js from frontend-builder stage (standalone mode)
COPY --from=frontend-builder /build/.next/standalone ./nextjs
COPY --from=frontend-builder /build/.next/static ./nextjs/.next/static
COPY --from=frontend-builder /build/public ./nextjs/public

# Create required directories
RUN mkdir -p data logs

# Copy supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy and set entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Note: Running as root to allow entrypoint to manage directory permissions
# when volumes are mounted. This is necessary for Coolify deployment.

# Expose ports (9988 for Python API, 13145 for Next.js frontend)
EXPOSE 9988 13145

# Health check for Coolify - check both services
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:9988/health && curl -f http://localhost:13145/ || exit 1

# Run the application with supervisord
CMD ["/docker-entrypoint.sh"]