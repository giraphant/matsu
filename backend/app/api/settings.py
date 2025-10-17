"""
Application settings API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict

from app.models.database import SessionLocal, AppSetting

router = APIRouter()


# Pydantic models
class SettingResponse(BaseModel):
    key: str
    value: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class SettingUpdate(BaseModel):
    value: str


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Settings endpoints
@router.get("/settings", response_model=Dict[str, str])
def get_all_settings(db: Session = Depends(get_db)):
    """Get all application settings as key-value pairs."""
    settings = db.query(AppSetting).all()
    return {s.key: s.value for s in settings}


@router.get("/settings/{key}", response_model=SettingResponse)
def get_setting(key: str, db: Session = Depends(get_db)):
    """Get a specific setting by key."""
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    return setting


@router.put("/settings/{key}", response_model=SettingResponse)
def update_setting(
    key: str,
    update: SettingUpdate,
    db: Session = Depends(get_db)
):
    """Update or create a setting."""
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()

    if setting:
        # Update existing
        setting.value = update.value
    else:
        # Create new
        setting = AppSetting(key=key, value=update.value)
        db.add(setting)

    db.commit()
    db.refresh(setting)
    return setting


@router.delete("/settings/{key}")
def delete_setting(key: str, db: Session = Depends(get_db)):
    """Delete a setting."""
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")

    db.delete(setting)
    db.commit()
    return {"message": f"Setting '{key}' deleted successfully"}
