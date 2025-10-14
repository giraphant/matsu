"""
Shared models for DEX fetchers.
"""

from pydantic import BaseModel
from typing import Optional


class FundingRate(BaseModel):
    """Funding rate entry from a DEX."""
    exchange: str
    symbol: str
    rate: Optional[float]
    next_funding_time: Optional[str] = None
    mark_price: Optional[float] = None
    has_binance_spot: Optional[bool] = None
