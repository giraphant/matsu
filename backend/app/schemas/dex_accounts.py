"""
Pydantic schemas for DEX account management.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class DexAccountBase(BaseModel):
    """Base schema for DEX account."""
    name: str = Field(..., description="User-friendly name for the account")
    exchange: str = Field(..., description="Exchange name (e.g., 'lighter', 'hyperliquid')")
    address: str = Field(..., description="Blockchain address or account identifier")
    enabled: bool = Field(default=True, description="Enable/disable monitoring for this account")
    tags: Optional[List[str]] = Field(default=None, description="Tags for filtering")
    notes: Optional[str] = Field(default=None, description="Optional notes")


class DexAccountCreate(DexAccountBase):
    """Schema for creating a new DEX account."""
    pass


class DexAccountUpdate(BaseModel):
    """Schema for updating a DEX account."""
    name: Optional[str] = None
    exchange: Optional[str] = None
    address: Optional[str] = None
    enabled: Optional[bool] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class DexAccountResponse(DexAccountBase):
    """Schema for DEX account response."""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
