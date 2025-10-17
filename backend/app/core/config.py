"""
Configuration management for the application.
Centralizes all environment variable access and configuration.
"""

import os
from typing import List


class Settings:
    """Application settings loaded from environment variables."""

    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    DOMAIN: str = os.getenv("DOMAIN", "localhost")

    # Database settings
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "data/monitoring.db")

    @property
    def DATABASE_URL(self) -> str:
        """Get database URL for SQLAlchemy."""
        return os.getenv("DATABASE_URL", f"sqlite:///./{self.DATABASE_PATH}")

    # CORS settings
    @property
    def CORS_ORIGINS(self) -> List[str]:
        default_origins = f"https://{self.DOMAIN},http://localhost:3000,http://127.0.0.1:3000"
        return os.getenv("CORS_ORIGINS", default_origins).split(",")

    # User credentials (for initial setup)
    RAMU_PASSWORD: str = os.getenv("RAMU_PASSWORD", "changeme")

    # API URLs
    @property
    def BASE_URL(self) -> str:
        protocol = "https" if self.DOMAIN != "localhost" else "http"
        if self.DOMAIN != "localhost":
            return f"{protocol}://{self.DOMAIN}"
        else:
            return f"http://localhost:{self.PORT}"

    # Background task intervals (in seconds)
    DEX_CACHE_REFRESH_INTERVAL: int = 60
    FUNDING_RATE_CHECK_INTERVAL: int = 60
    LIGHTER_MONITOR_INTERVAL: int = 60

    # Feature flags
    ENABLE_DEX_MONITORING: bool = os.getenv("ENABLE_DEX_MONITORING", "true").lower() == "true"
    ENABLE_LIGHTER_MONITORING: bool = os.getenv("ENABLE_LIGHTER_MONITORING", "true").lower() == "true"

    # Position monitoring
    JLP_AMOUNT: float = float(os.getenv("JLP_AMOUNT", "0"))


# Global settings instance
settings = Settings()
