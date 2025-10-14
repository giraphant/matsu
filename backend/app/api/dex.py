"""
DEX funding rates comparison API.
Fetch and compare funding rates from multiple DEXs.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Tuple
from datetime import datetime
import asyncio
import json
import time

from app.core.logger import get_logger
from app.models.database import get_db, FundingRateAlert
from app.services.dex_fetchers import (
    FundingRate,
    fetch_lighter_funding_rates,
    fetch_grvt_funding_rates,
    fetch_backpack_funding_rates,
    fetch_aster_funding_rates,
    fetch_binance_spot_symbols,
    normalize_binance_rates
)

router = APIRouter()
logger = get_logger(__name__)

# Global cache for funding rates
_funding_rates_cache: Optional[List[FundingRate]] = None
_cache_last_updated: Optional[datetime] = None
_cache_lock = asyncio.Lock()
CACHE_DURATION_SECONDS = 60  # Cache for 1 minute


class FundingRatesResponse(BaseModel):
    """Response containing funding rates from all DEXs."""
    rates: List[FundingRate]
    last_updated: datetime
    error: Optional[str] = None


class FundingRateAlertCreate(BaseModel):
    """Request model for creating funding rate alert."""
    name: str
    alert_type: str  # 'single' or 'spread'
    exchanges: List[str]
    threshold: float  # In percentage (e.g., 0.01 for 1%)
    enabled: bool = True


class FundingRateAlertResponse(BaseModel):
    """Response model for funding rate alert."""
    id: int
    name: str
    alert_type: str
    exchanges: List[str]
    threshold: float
    enabled: bool
    created_at: datetime
    updated_at: datetime
    last_triggered_at: Optional[datetime]


async def fetch_all_funding_rates() -> List[FundingRate]:
    """Fetch funding rates from all DEXs and normalize them."""
    start_time = time.time()

    # Fetch from all sources in parallel, including Binance spot symbols
    lighter_rates, aster_rates, grvt_rates, backpack_rates, binance_spot_symbols = await asyncio.gather(
        fetch_lighter_funding_rates(),
        fetch_aster_funding_rates(),
        fetch_grvt_funding_rates(),
        fetch_backpack_funding_rates(),
        fetch_binance_spot_symbols()
    )

    # Normalize Binance rates to 8-hour periods
    normalized_lighter = await normalize_binance_rates(lighter_rates)

    elapsed = time.time() - start_time
    logger.info(f"Fetched all funding rates in {elapsed:.2f}s - Lighter: {len(normalized_lighter)}, ASTER: {len(aster_rates)}, GRVT: {len(grvt_rates)}, Backpack: {len(backpack_rates)}, Binance spot: {len(binance_spot_symbols)}")

    # Combine all rates and mark which have Binance spot
    all_rates = normalized_lighter + aster_rates + grvt_rates + backpack_rates

    # Add has_binance_spot flag to each rate
    for rate in all_rates:
        rate.has_binance_spot = rate.symbol.upper() in binance_spot_symbols

    return all_rates


async def get_cached_rates(force_refresh: bool = False) -> Tuple[List[FundingRate], datetime]:
    """
    Get funding rates from cache or fetch fresh if cache is stale.

    Args:
        force_refresh: If True, bypass cache and fetch fresh data

    Returns:
        Tuple of (rates, last_updated)
    """
    global _funding_rates_cache, _cache_last_updated

    async with _cache_lock:
        now = datetime.utcnow()
        cache_is_stale = (
            _funding_rates_cache is None or
            _cache_last_updated is None or
            (now - _cache_last_updated).total_seconds() > CACHE_DURATION_SECONDS
        )

        if force_refresh or cache_is_stale:
            # Fetch fresh data
            logger.debug(f"Fetching fresh funding rates data (force_refresh={force_refresh}, cache_is_stale={cache_is_stale})...")
            _funding_rates_cache = await fetch_all_funding_rates()
            _cache_last_updated = now
            logger.debug(f"Fetched {len(_funding_rates_cache)} funding rates")

        return _funding_rates_cache, _cache_last_updated


@router.get("/dex/funding-rates", response_model=FundingRatesResponse)
async def get_funding_rates(force_refresh: bool = Query(False, description="Force refresh data bypassing cache")):
    """
    Get funding rates from all supported DEXs.
    Currently supports: Lighter (Binance, Bybit, Hyperliquid), ASTER, GRVT, Backpack.

    By default, returns cached data (updated every minute).
    Use ?force_refresh=true to fetch fresh data from all exchanges.
    """
    try:
        rates, last_updated = await get_cached_rates(force_refresh=force_refresh)

        logger.debug(f"Returning {len(rates)} rates to frontend, last_updated: {last_updated}")

        return FundingRatesResponse(
            rates=rates,
            last_updated=last_updated
        )
    except Exception as e:
        logger.error(f"Error in get_funding_rates: {e}")
        return FundingRatesResponse(
            rates=[],
            last_updated=datetime.utcnow(),
            error=str(e)
        )


@router.get("/dex/funding-rates/{symbol}", response_model=FundingRatesResponse)
async def get_funding_rates_by_symbol(
    symbol: str,
    force_refresh: bool = Query(False, description="Force refresh data bypassing cache")
):
    """
    Get funding rates for a specific symbol across all DEXs.
    Example: /dex/funding-rates/SOL

    By default, returns cached data (updated every minute).
    Use ?force_refresh=true to fetch fresh data from all exchanges.
    """
    try:
        rates, last_updated = await get_cached_rates(force_refresh=force_refresh)

        # Filter by symbol
        symbol_upper = symbol.upper()
        filtered_rates = [
            r for r in rates
            if r.symbol.upper().startswith(symbol_upper)
        ]

        return FundingRatesResponse(
            rates=filtered_rates,
            last_updated=last_updated
        )
    except Exception as e:
        return FundingRatesResponse(
            rates=[],
            last_updated=datetime.utcnow(),
            error=str(e)
        )


# Funding Rate Alert Endpoints

@router.post("/dex/funding-rate-alerts", response_model=FundingRateAlertResponse)
async def create_funding_rate_alert(
    alert: FundingRateAlertCreate,
    db: Session = Depends(get_db)
):
    """Create a new funding rate alert rule."""
    db_alert = FundingRateAlert(
        name=alert.name,
        alert_type=alert.alert_type,
        exchanges=json.dumps(alert.exchanges),
        threshold=alert.threshold,
        enabled=alert.enabled
    )
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)

    return FundingRateAlertResponse(
        id=db_alert.id,
        name=db_alert.name,
        alert_type=db_alert.alert_type,
        exchanges=json.loads(db_alert.exchanges),
        threshold=db_alert.threshold,
        enabled=db_alert.enabled,
        created_at=db_alert.created_at,
        updated_at=db_alert.updated_at,
        last_triggered_at=db_alert.last_triggered_at
    )


@router.get("/dex/funding-rate-alerts", response_model=List[FundingRateAlertResponse])
async def get_funding_rate_alerts(db: Session = Depends(get_db)):
    """Get all funding rate alert rules."""
    alerts = db.query(FundingRateAlert).all()
    return [
        FundingRateAlertResponse(
            id=alert.id,
            name=alert.name,
            alert_type=alert.alert_type,
            exchanges=json.loads(alert.exchanges),
            threshold=alert.threshold,
            enabled=alert.enabled,
            created_at=alert.created_at,
            updated_at=alert.updated_at,
            last_triggered_at=alert.last_triggered_at
        )
        for alert in alerts
    ]


@router.put("/dex/funding-rate-alerts/{alert_id}", response_model=FundingRateAlertResponse)
async def update_funding_rate_alert(
    alert_id: int,
    alert: FundingRateAlertCreate,
    db: Session = Depends(get_db)
):
    """Update a funding rate alert rule."""
    db_alert = db.query(FundingRateAlert).filter(FundingRateAlert.id == alert_id).first()
    if not db_alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    db_alert.name = alert.name
    db_alert.alert_type = alert.alert_type
    db_alert.exchanges = json.dumps(alert.exchanges)
    db_alert.threshold = alert.threshold
    db_alert.enabled = alert.enabled
    db_alert.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(db_alert)

    return FundingRateAlertResponse(
        id=db_alert.id,
        name=db_alert.name,
        alert_type=db_alert.alert_type,
        exchanges=json.loads(db_alert.exchanges),
        threshold=db_alert.threshold,
        enabled=db_alert.enabled,
        created_at=db_alert.created_at,
        updated_at=db_alert.updated_at,
        last_triggered_at=db_alert.last_triggered_at
    )


@router.delete("/dex/funding-rate-alerts/{alert_id}")
async def delete_funding_rate_alert(
    alert_id: int,
    db: Session = Depends(get_db)
):
    """Delete a funding rate alert rule."""
    db_alert = db.query(FundingRateAlert).filter(FundingRateAlert.id == alert_id).first()
    if not db_alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    db.delete(db_alert)
    db.commit()

    return {"message": "Alert deleted successfully"}


async def check_funding_rate_alerts():
    """Check all enabled funding rate alerts and send notifications if triggered."""
    from app.models.database import SessionLocal

    db = SessionLocal()
    try:
        # Get current funding rates
        rates, last_updated = await get_cached_rates(force_refresh=False)

        # Group rates by symbol, keep full rate objects to access has_binance_spot
        grouped_rates = {}
        for rate in rates:
            if rate.symbol not in grouped_rates:
                grouped_rates[rate.symbol] = {}
            grouped_rates[rate.symbol][rate.exchange] = rate

        # Get all enabled alerts
        alerts = db.query(FundingRateAlert).filter(FundingRateAlert.enabled == True).all()

        for alert in alerts:
            exchanges = json.loads(alert.exchanges)
            triggered = False
            message = ""

            # Check if we should skip based on last_triggered_at (10 min cooldown)
            if alert.last_triggered_at:
                time_since_last = datetime.utcnow() - alert.last_triggered_at
                if time_since_last.total_seconds() < 600:  # 10 minutes
                    continue

            if alert.alert_type == 'single':
                # Check single exchange funding rates (期现套利 - needs Binance spot)
                for symbol, exchange_rate_objs in grouped_rates.items():
                    # Check if this symbol has Binance spot
                    has_spot = any(r.has_binance_spot for r in exchange_rate_objs.values() if r.has_binance_spot)
                    if not has_spot:
                        continue  # Skip symbols without Binance spot

                    for exchange in exchanges:
                        if exchange in exchange_rate_objs:
                            rate_obj = exchange_rate_objs[exchange]
                            if rate_obj.rate is not None and rate_obj.rate >= alert.threshold:
                                triggered = True
                                message = f"🎯 {alert.name}\n{symbol} on {exchange.upper()}: {rate_obj.rate*100:.4f}% (threshold: {alert.threshold*100:.2f}%)"
                                break
                    if triggered:
                        break

            elif alert.alert_type == 'spread':
                # Check spread between exchanges
                for symbol, exchange_rate_objs in grouped_rates.items():
                    # Get rates for selected exchanges
                    selected_rates = []
                    for exchange in exchanges:
                        if exchange in exchange_rate_objs:
                            rate_obj = exchange_rate_objs[exchange]
                            if rate_obj.rate is not None:
                                selected_rates.append((exchange, rate_obj.rate))

                    if len(selected_rates) >= 2:
                        rates_only = [r[1] for r in selected_rates]
                        spread = max(rates_only) - min(rates_only)

                        if spread >= alert.threshold:
                            triggered = True
                            # Sort by rate descending to show highest first
                            selected_rates.sort(key=lambda x: x[1], reverse=True)
                            # Build message with all exchanges
                            rates_str = "\n".join([f"{ex.upper()}: {rate*100:.4f}%" for ex, rate in selected_rates])
                            message = f"📊 {alert.name}\n{symbol} - Spread: {spread*100:.4f}%\n{rates_str}\n(threshold: {alert.threshold*100:.2f}%)"
                            break

            if triggered:
                # Send notification
                try:
                    from app.services.pushover import send_pushover_notification
                    from app.models.database import PushoverConfig

                    # Get pushover config
                    pushover_config = db.query(PushoverConfig).first()
                    if pushover_config:
                        send_pushover_notification(
                            user_key=pushover_config.user_key,
                            message=message,
                            title="Funding Rate Alert",
                            level='medium',
                            api_token=pushover_config.api_token
                        )
                        # Update last triggered time
                        alert.last_triggered_at = datetime.utcnow()
                        db.commit()
                        logger.info(f"Alert triggered: {alert.name}")
                    else:
                        logger.warning("No Pushover config found, skipping notification")
                except Exception as e:
                    logger.error(f"Failed to send alert notification: {e}")

    except Exception as e:
        logger.error(f"Error checking funding rate alerts: {e}")
    finally:
        db.close()
