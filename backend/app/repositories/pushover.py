"""
Repository for Pushover configuration operations.
Encapsulates all database queries for PushoverConfig model.
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.database import PushoverConfig
from app.core.logger import get_logger

logger = get_logger(__name__)


class PushoverRepository:
    """Repository for PushoverConfig model - supports multiple configurations."""

    def __init__(self, db: Session):
        """
        Initialize pushover repository.

        Args:
            db: Database session
        """
        self.db = db

    def get_all(self) -> List[PushoverConfig]:
        """
        Get all Pushover configurations.

        Returns:
            List of PushoverConfig instances
        """
        return self.db.query(PushoverConfig).order_by(PushoverConfig.created_at).all()

    def get_enabled(self) -> List[PushoverConfig]:
        """
        Get all enabled Pushover configurations.

        Returns:
            List of enabled PushoverConfig instances
        """
        return self.db.query(PushoverConfig).filter(
            PushoverConfig.enabled == True
        ).order_by(PushoverConfig.created_at).all()

    def get_by_id(self, config_id: int) -> Optional[PushoverConfig]:
        """
        Get a Pushover configuration by ID.

        Args:
            config_id: Configuration ID

        Returns:
            PushoverConfig or None
        """
        return self.db.query(PushoverConfig).filter(PushoverConfig.id == config_id).first()

    def create(
        self,
        name: str,
        user_key: str,
        api_token: Optional[str] = None,
        enabled: bool = True,
        min_alert_level: str = 'low'
    ) -> PushoverConfig:
        """
        Create a new Pushover configuration.

        Args:
            name: Configuration name
            user_key: Pushover user key
            api_token: Optional API token
            enabled: Whether the configuration is enabled
            min_alert_level: Minimum alert level (low, medium, high, critical)

        Returns:
            PushoverConfig instance
        """
        config = PushoverConfig(
            name=name,
            user_key=user_key,
            api_token=api_token,
            enabled=enabled,
            min_alert_level=min_alert_level
        )
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        logger.debug(f"Created Pushover config: {name} (min_level={min_alert_level})")
        return config

    def update(
        self,
        config_id: int,
        name: Optional[str] = None,
        user_key: Optional[str] = None,
        api_token: Optional[str] = None,
        enabled: Optional[bool] = None,
        min_alert_level: Optional[str] = None
    ) -> Optional[PushoverConfig]:
        """
        Update a Pushover configuration.

        Args:
            config_id: Configuration ID
            name: Optional new name
            user_key: Optional new user key
            api_token: Optional new API token
            enabled: Optional enabled status
            min_alert_level: Optional minimum alert level

        Returns:
            Updated PushoverConfig or None if not found
        """
        config = self.get_by_id(config_id)
        if not config:
            return None

        if name is not None:
            config.name = name
        if user_key is not None:
            config.user_key = user_key
        if api_token is not None:
            config.api_token = api_token
        if enabled is not None:
            config.enabled = enabled
        if min_alert_level is not None:
            config.min_alert_level = min_alert_level

        config.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(config)
        logger.debug(f"Updated Pushover config: {config.name}")
        return config

    def delete(self, config_id: int) -> bool:
        """
        Delete a Pushover configuration.

        Args:
            config_id: Configuration ID

        Returns:
            True if deleted, False if not found
        """
        config = self.get_by_id(config_id)
        if config:
            self.db.delete(config)
            self.db.commit()
            logger.debug(f"Deleted Pushover config: {config.name}")
            return True
        return False

    def is_configured(self) -> bool:
        """
        Check if any Pushover configuration exists.

        Returns:
            True if at least one configuration exists, False otherwise
        """
        return self.db.query(PushoverConfig).count() > 0
