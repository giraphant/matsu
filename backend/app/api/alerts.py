"""
Pushover integration API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.models.database import SessionLocal
from app.repositories.pushover import PushoverRepository

router = APIRouter()


# Pydantic models
class PushoverConfigCreate(BaseModel):
    name: str
    user_key: str
    api_token: Optional[str] = None
    enabled: bool = True


class PushoverConfigUpdate(BaseModel):
    name: Optional[str] = None
    user_key: Optional[str] = None
    api_token: Optional[str] = None
    enabled: Optional[bool] = None


class PushoverConfigResponse(BaseModel):
    id: int
    name: str
    user_key: str
    api_token: Optional[str]
    enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PushoverTestRequest(BaseModel):
    user_key: str
    api_token: Optional[str] = None


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Pushover Config endpoints
@router.get("/pushover/configs", response_model=List[PushoverConfigResponse])
def get_all_pushover_configs(db: Session = Depends(get_db)):
    """Get all Pushover configurations."""
    repo = PushoverRepository(db)
    return repo.get_all()


@router.get("/pushover/config/{config_id}", response_model=PushoverConfigResponse)
def get_pushover_config(config_id: int, db: Session = Depends(get_db)):
    """Get a specific Pushover configuration by ID."""
    repo = PushoverRepository(db)
    config = repo.get_by_id(config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Pushover config not found")
    return config


@router.post("/pushover/config", response_model=PushoverConfigResponse, status_code=201)
def create_pushover_config(
    config: PushoverConfigCreate,
    db: Session = Depends(get_db)
):
    """Create a new Pushover configuration."""
    repo = PushoverRepository(db)
    return repo.create(
        name=config.name,
        user_key=config.user_key,
        api_token=config.api_token,
        enabled=config.enabled
    )


@router.put("/pushover/config/{config_id}", response_model=PushoverConfigResponse)
def update_pushover_config(
    config_id: int,
    config: PushoverConfigUpdate,
    db: Session = Depends(get_db)
):
    """Update a Pushover configuration."""
    repo = PushoverRepository(db)
    updated = repo.update(
        config_id=config_id,
        name=config.name,
        user_key=config.user_key,
        api_token=config.api_token,
        enabled=config.enabled
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Pushover config not found")
    return updated


@router.delete("/pushover/config/{config_id}")
def delete_pushover_config(config_id: int, db: Session = Depends(get_db)):
    """Delete a Pushover configuration."""
    repo = PushoverRepository(db)
    success = repo.delete(config_id)
    if not success:
        raise HTTPException(status_code=404, detail="Pushover config not found")
    return {"message": "Pushover config deleted successfully"}


@router.post("/pushover/test")
def test_pushover_notification(request: PushoverTestRequest):
    """Send a test Pushover notification."""
    from app.services.pushover import send_pushover_notification

    success = send_pushover_notification(
        user_key=request.user_key,
        message="This is a test notification from your monitoring system!",
        title="Test Notification",
        level='medium',
        api_token=request.api_token
    )

    if success:
        return {"message": "Test notification sent successfully!"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send test notification")
