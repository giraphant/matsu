"""
Repository for user operations.
Encapsulates all database queries for User model.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models.database import User
from app.core.logger import get_logger

logger = get_logger(__name__)


class UserRepository:
    """Repository for User model."""

    def __init__(self, db: Session):
        """
        Initialize user repository.

        Args:
            db: Database session
        """
        self.db = db

    def get_by_username(self, username: str) -> Optional[User]:
        """
        Get user by username.

        Args:
            username: Username

        Returns:
            User or None
        """
        return self.db.query(User).filter(User.username == username).first()

    def get_by_id(self, user_id: int) -> Optional[User]:
        """
        Get user by ID.

        Args:
            user_id: User ID

        Returns:
            User or None
        """
        return self.db.query(User).filter(User.id == user_id).first()

    def create(self, username: str, password: str) -> User:
        """
        Create a new user.

        Args:
            username: Username
            password: Plain text password (will be hashed)

        Returns:
            Created User
        """
        user = User(
            username=username,
            password_hash=User.hash_password(password)
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        logger.info(f"Created user: {username}")
        return user

    def authenticate(self, username: str, password: str) -> Optional[User]:
        """
        Authenticate a user.

        Args:
            username: Username
            password: Plain text password

        Returns:
            User if authenticated, None otherwise
        """
        user = self.get_by_username(username)
        if user and user.verify_password(password):
            logger.debug(f"User authenticated: {username}")
            return user
        logger.debug(f"Authentication failed for user: {username}")
        return None

    def update_password(self, username: str, new_password: str) -> bool:
        """
        Update user password.

        Args:
            username: Username
            new_password: New plain text password

        Returns:
            True if updated, False if user not found
        """
        user = self.get_by_username(username)
        if user:
            user.password_hash = User.hash_password(new_password)
            self.db.commit()
            logger.info(f"Updated password for user: {username}")
            return True
        return False

    def deactivate(self, username: str) -> bool:
        """
        Deactivate a user.

        Args:
            username: Username

        Returns:
            True if deactivated, False if user not found
        """
        user = self.get_by_username(username)
        if user:
            user.is_active = False
            self.db.commit()
            logger.info(f"Deactivated user: {username}")
            return True
        return False
