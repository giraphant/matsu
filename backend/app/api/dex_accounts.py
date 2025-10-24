"""
API endpoints for managing DEX accounts.
"""

import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import DexAccount, get_db
from app.schemas.dex_accounts import DexAccountCreate, DexAccountUpdate, DexAccountResponse
from app.api.auth import require_auth

router = APIRouter()


@router.get("/dex-accounts", response_model=List[DexAccountResponse])
async def get_dex_accounts(
    exchange: str = None,
    enabled: bool = None,
    db: Session = Depends(get_db),
    _: dict = Depends(require_auth)
):
    """
    Get all DEX accounts, optionally filtered by exchange and enabled status.
    """
    query = db.query(DexAccount)

    if exchange:
        query = query.filter(DexAccount.exchange == exchange)

    if enabled is not None:
        query = query.filter(DexAccount.enabled == enabled)

    accounts = query.order_by(DexAccount.created_at.desc()).all()

    # Parse tags JSON
    for account in accounts:
        if account.tags:
            try:
                account.tags = json.loads(account.tags)
            except:
                account.tags = []
        else:
            account.tags = []

    return accounts


@router.get("/dex-accounts/{account_id}", response_model=DexAccountResponse)
async def get_dex_account(
    account_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_auth)
):
    """Get a specific DEX account by ID."""
    account = db.query(DexAccount).filter(DexAccount.id == account_id).first()

    if not account:
        raise HTTPException(status_code=404, detail="DEX account not found")

    # Parse tags JSON
    if account.tags:
        try:
            account.tags = json.loads(account.tags)
        except:
            account.tags = []
    else:
        account.tags = []

    return account


@router.post("/dex-accounts", response_model=DexAccountResponse)
async def create_dex_account(
    account: DexAccountCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_auth)
):
    """Create a new DEX account."""

    # Convert tags to JSON string
    tags_json = json.dumps(account.tags) if account.tags else None

    db_account = DexAccount(
        name=account.name,
        exchange=account.exchange.lower(),
        address=account.address,
        enabled=account.enabled,
        tags=tags_json,
        notes=account.notes
    )

    db.add(db_account)
    db.commit()
    db.refresh(db_account)

    # Parse tags back for response
    if db_account.tags:
        db_account.tags = json.loads(db_account.tags)
    else:
        db_account.tags = []

    return db_account


@router.put("/dex-accounts/{account_id}", response_model=DexAccountResponse)
async def update_dex_account(
    account_id: int,
    account_update: DexAccountUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_auth)
):
    """Update an existing DEX account."""
    db_account = db.query(DexAccount).filter(DexAccount.id == account_id).first()

    if not db_account:
        raise HTTPException(status_code=404, detail="DEX account not found")

    # Update fields if provided
    if account_update.name is not None:
        db_account.name = account_update.name
    if account_update.exchange is not None:
        db_account.exchange = account_update.exchange.lower()
    if account_update.address is not None:
        db_account.address = account_update.address
    if account_update.enabled is not None:
        db_account.enabled = account_update.enabled
    if account_update.tags is not None:
        db_account.tags = json.dumps(account_update.tags)
    if account_update.notes is not None:
        db_account.notes = account_update.notes

    db.commit()
    db.refresh(db_account)

    # Parse tags for response
    if db_account.tags:
        db_account.tags = json.loads(db_account.tags)
    else:
        db_account.tags = []

    return db_account


@router.delete("/dex-accounts/{account_id}")
async def delete_dex_account(
    account_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_auth)
):
    """Delete a DEX account."""
    db_account = db.query(DexAccount).filter(DexAccount.id == account_id).first()

    if not db_account:
        raise HTTPException(status_code=404, detail="DEX account not found")

    db.delete(db_account)
    db.commit()

    return {"message": "DEX account deleted successfully"}
