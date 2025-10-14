"""
Base repository with common database operations.
Provides CRUD (Create, Read, Update, Delete) operations.
"""

from typing import Generic, TypeVar, Type, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy.ext.declarative import DeclarativeMeta

# Generic type for SQLAlchemy models
ModelType = TypeVar("ModelType", bound=DeclarativeMeta)


class BaseRepository(Generic[ModelType]):
    """
    Base repository with common CRUD operations.

    Usage:
        class UserRepository(BaseRepository[User]):
            def __init__(self, db: Session):
                super().__init__(User, db)
    """

    def __init__(self, model: Type[ModelType], db: Session):
        """
        Initialize repository.

        Args:
            model: SQLAlchemy model class
            db: Database session
        """
        self.model = model
        self.db = db

    def get_by_id(self, id: Any) -> Optional[ModelType]:
        """
        Get a single record by ID.

        Args:
            id: Primary key value

        Returns:
            Model instance or None
        """
        return self.db.query(self.model).filter(self.model.id == id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[ModelType]:
        """
        Get all records with pagination.

        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of model instances
        """
        return self.db.query(self.model).offset(skip).limit(limit).all()

    def create(self, **kwargs) -> ModelType:
        """
        Create a new record.

        Args:
            **kwargs: Field values for the new record

        Returns:
            Created model instance
        """
        instance = self.model(**kwargs)
        self.db.add(instance)
        self.db.commit()
        self.db.refresh(instance)
        return instance

    def update(self, id: Any, **kwargs) -> Optional[ModelType]:
        """
        Update a record by ID.

        Args:
            id: Primary key value
            **kwargs: Fields to update

        Returns:
            Updated model instance or None
        """
        instance = self.get_by_id(id)
        if instance:
            for key, value in kwargs.items():
                setattr(instance, key, value)
            self.db.commit()
            self.db.refresh(instance)
        return instance

    def delete(self, id: Any) -> bool:
        """
        Delete a record by ID.

        Args:
            id: Primary key value

        Returns:
            True if deleted, False if not found
        """
        instance = self.get_by_id(id)
        if instance:
            self.db.delete(instance)
            self.db.commit()
            return True
        return False

    def count(self) -> int:
        """
        Count total records.

        Returns:
            Total number of records
        """
        return self.db.query(self.model).count()
