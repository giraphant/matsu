"""
Repository for Pushover configuration operations.
Encapsulates all database queries for PushoverConfig model.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models.database import PushoverConfig
from app.core.logger import get_logger

logger = get_logger(__name__)


class PushoverRepository:
    """Repository for PushoverConfig model."""

    def __init__(self, db: Session):
        """
        Initialize pushover repository.

        Args:
            db: Database session
        """
        self.db = db

    def get_config(self) -> Optional[PushoverConfig]:
        """
        Get the Pushover configuration (singleton).

        Returns:
            PushoverConfig or None
        """
        return self.db.query(PushoverConfig).first()

    def create_or_update(self, user_key: str, api_token: Optional[str] = None) -> PushoverConfig:
        """
        Create or update Pushover configuration.

        Args:
            user_key: Pushover user key
            api_token: Optional API token

        Returns:
            PushoverConfig instance
        """
        config = self.get_config()

        if config:
            # Update existing
            config.user_key = user_key
            if api_token:
                config.api_token = api_token
            config.updated_at = datetime.utcnow()
            logger.debug("Updated Pushover config")
        else:
            # Create new
            config = PushoverConfig(
                user_key=user_key,
                api_token=api_token
            )
            self.db.add(config)
            logger.debug("Created Pushover config")

        self.db.commit()
        self.db.refresh(config)
        return config

    def delete(self) -> bool:
        """
        Delete Pushover configuration.

        Returns:
            True if deleted, False if not found
        """
        config = self.get_config()
        if config:
            self.db.delete(config)
            self.db.commit()
            logger.debug("Deleted Pushover config")
            return True
        return False

    def is_configured(self) -> bool:
        """
        Check if Pushover is configured.

        Returns:
            True if configuration exists, False otherwise
        """
        return self.get_config() is not None
