"""Core application modules."""

from .config import settings
# Note: startup_manager is not imported here to avoid circular dependency
# Import directly: from app.core.startup import startup_manager
from .logger import get_logger, setup_logging

__all__ = ["settings", "get_logger", "setup_logging"]
