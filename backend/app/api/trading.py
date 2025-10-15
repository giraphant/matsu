"""
Trading data API endpoints for funding rates and spot prices.
"""

from fastapi import APIRouter, HTTPException
from sqlalchemy import distinct
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime

from app.models.database import FundingRate, SpotPrice, get_db_session
from app.core.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.get("/funding-rates")
async def get_funding_rates() -> List[Dict[str, Any]]:
    """
    Get latest funding rates from all exchanges.

    Returns a list of funding rates with the most recent rate for each exchange-symbol pair.
    """
    db = get_db_session()

    try:
        # Get all unique exchange-symbol combinations
        from sqlalchemy import func
        pairs = db.query(
            FundingRate.exchange,
            FundingRate.symbol,
            func.max(FundingRate.timestamp).label('latest_timestamp')
        ).group_by(
            FundingRate.exchange,
            FundingRate.symbol
        ).all()

        results = []

        # For each pair, get the latest funding rate
        for exchange, symbol, _ in pairs:
            latest = db.query(FundingRate).filter(
                FundingRate.exchange == exchange,
                FundingRate.symbol == symbol
            ).order_by(FundingRate.timestamp.desc()).first()

            if latest:
                results.append({
                    "exchange": latest.exchange,
                    "symbol": latest.symbol,
                    "rate": latest.rate,
                    "annualized_rate": latest.annualized_rate,
                    "next_funding_time": latest.next_funding_time.isoformat() if latest.next_funding_time else None,
                    "mark_price": latest.mark_price,
                    "timestamp": latest.timestamp.isoformat()
                })

        return results

    except Exception as e:
        logger.error(f"Error fetching funding rates: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch funding rates: {str(e)}")
    finally:
        db.close()


@router.get("/spot-prices")
async def get_spot_prices() -> List[Dict[str, Any]]:
    """
    Get latest spot prices from all exchanges.

    Returns a list of spot prices with the most recent price for each exchange-symbol pair.
    """
    db = get_db_session()

    try:
        # Get all unique exchange-symbol combinations
        from sqlalchemy import func
        pairs = db.query(
            SpotPrice.exchange,
            SpotPrice.symbol,
            func.max(SpotPrice.timestamp).label('latest_timestamp')
        ).group_by(
            SpotPrice.exchange,
            SpotPrice.symbol
        ).all()

        results = []

        # For each pair, get the latest spot price
        for exchange, symbol, _ in pairs:
            latest = db.query(SpotPrice).filter(
                SpotPrice.exchange == exchange,
                SpotPrice.symbol == symbol
            ).order_by(SpotPrice.timestamp.desc()).first()

            if latest:
                results.append({
                    "exchange": latest.exchange,
                    "symbol": latest.symbol,
                    "price": latest.price,
                    "volume_24h": latest.volume_24h,
                    "timestamp": latest.timestamp.isoformat()
                })

        return results

    except Exception as e:
        logger.error(f"Error fetching spot prices: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch spot prices: {str(e)}")
    finally:
        db.close()


@router.get("/funding-rates/{exchange}/{symbol}/history")
async def get_funding_rate_history(
    exchange: str,
    symbol: str,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Get historical funding rates for a specific exchange-symbol pair.

    Args:
        exchange: Exchange name (e.g., "lighter", "aster")
        symbol: Symbol name (e.g., "BTC", "ETH")
        limit: Maximum number of records to return (default 100)
    """
    db = get_db_session()

    try:
        history = db.query(FundingRate).filter(
            FundingRate.exchange == exchange.lower(),
            FundingRate.symbol == symbol.upper()
        ).order_by(FundingRate.timestamp.desc()).limit(limit).all()

        return [{
            "exchange": r.exchange,
            "symbol": r.symbol,
            "rate": r.rate,
            "annualized_rate": r.annualized_rate,
            "next_funding_time": r.next_funding_time.isoformat() if r.next_funding_time else None,
            "mark_price": r.mark_price,
            "timestamp": r.timestamp.isoformat()
        } for r in history]

    except Exception as e:
        logger.error(f"Error fetching funding rate history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch funding rate history")
    finally:
        db.close()


@router.get("/spot-prices/{exchange}/{symbol}/history")
async def get_spot_price_history(
    exchange: str,
    symbol: str,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Get historical spot prices for a specific exchange-symbol pair.

    Args:
        exchange: Exchange name (e.g., "binance", "okx")
        symbol: Symbol name (e.g., "BTC", "ETH")
        limit: Maximum number of records to return (default 100)
    """
    db = get_db_session()

    try:
        history = db.query(SpotPrice).filter(
            SpotPrice.exchange == exchange.lower(),
            SpotPrice.symbol == symbol.upper()
        ).order_by(SpotPrice.timestamp.desc()).limit(limit).all()

        return [{
            "exchange": r.exchange,
            "symbol": r.symbol,
            "price": r.price,
            "volume_24h": r.volume_24h,
            "timestamp": r.timestamp.isoformat()
        } for r in history]

    except Exception as e:
        logger.error(f"Error fetching spot price history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch spot price history")
    finally:
        db.close()
