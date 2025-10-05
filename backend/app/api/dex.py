"""
DEX funding rates comparison API.
Fetch and compare funding rates from multiple DEXs.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Tuple
from datetime import datetime, timedelta
import httpx
import asyncio
from collections import defaultdict
import json

from app.models.database import get_db, FundingRateAlert

router = APIRouter()

# Background task flag
_alert_checker_running = False

# Global cache for funding rates
_funding_rates_cache: Optional[List['FundingRate']] = None
_cache_last_updated: Optional[datetime] = None
_cache_lock = asyncio.Lock()
CACHE_DURATION_SECONDS = 60  # Cache for 1 minute


class FundingRate(BaseModel):
    """Funding rate entry from a DEX."""
    exchange: str
    symbol: str
    rate: Optional[float]
    next_funding_time: Optional[str] = None
    mark_price: Optional[float] = None
    has_binance_spot: Optional[bool] = None


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


async def fetch_lighter_funding_rates() -> List[FundingRate]:
    """Fetch funding rates from Lighter."""
    url = "https://mainnet.zklighter.elliot.ai/api/v1/funding-rates"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers={
                "Accept": "application/json",
                "Content-Type": "application/json"
            })
            response.raise_for_status()
            data = response.json()

            rates = []
            for entry in data.get("funding_rates", []):
                rates.append(FundingRate(
                    exchange=entry.get("exchange", "lighter"),
                    symbol=entry.get("symbol", ""),
                    rate=entry.get("rate"),
                    next_funding_time=entry.get("next_funding_time"),
                    mark_price=entry.get("mark_price")
                ))

            return rates
    except Exception as e:
        print(f"Error fetching Lighter rates: {e}")
        return []


async def fetch_grvt_funding_rates() -> List[FundingRate]:
    """Fetch funding rates from GRVT."""
    instruments_url = "https://market-data.grvt.io/full/v1/instruments"
    funding_url = "https://market-data.grvt.io/full/v1/funding"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Step 1: Fetch instruments with correct filters
            instruments_response = await client.post(instruments_url, json={
                "kind": ["PERPETUAL"],
                "quote": ["USDT"],
                "is_active": True
            }, headers={
                "Accept": "application/json",
                "Content-Type": "application/json"
            })
            instruments_response.raise_for_status()
            instruments_data = instruments_response.json()

            instruments = instruments_data.get("result", [])
            if not instruments:
                return []

            # Step 2: Fetch funding for instruments with concurrency limit
            # Use semaphore to limit concurrent requests to avoid rate limiting
            semaphore = asyncio.Semaphore(5)  # Max 5 concurrent requests

            async def fetch_instrument_funding(instrument):
                instrument_id = instrument.get("instrument")
                base_currency = instrument.get("base")

                if not instrument_id or not base_currency:
                    return None

                async with semaphore:
                    try:
                        funding_response = await client.post(funding_url, json={
                            "instrument": instrument_id,
                            "limit": 1
                        }, headers={
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        })
                        funding_response.raise_for_status()
                        funding_data = funding_response.json()

                        funding_result = funding_data.get("result", [])
                        if not funding_result:
                            return None

                        funding_point = funding_result[0]
                        # Use 8h average if available
                        funding_rate = funding_point.get("funding_rate_8_h_avg") or funding_point.get("funding_rate")

                        if funding_rate is not None:
                            # GRVT returns percentage, divide by 100
                            rate_value = float(funding_rate) / 100

                            return FundingRate(
                                exchange="grvt",
                                symbol=base_currency.upper(),
                                rate=rate_value,
                                next_funding_time=funding_point.get("funding_time"),
                                mark_price=float(funding_point.get("mark_price")) if funding_point.get("mark_price") else None
                            )
                    except Exception as e:
                        return None

            # Fetch all instruments concurrently with rate limiting
            tasks = [fetch_instrument_funding(inst) for inst in instruments]
            results = await asyncio.gather(*tasks)

            # Filter out None results
            rates = [r for r in results if r is not None]
            return rates
    except Exception as e:
        print(f"Error fetching GRVT rates: {e}")
        return []


async def fetch_backpack_funding_rates() -> List[FundingRate]:
    """Fetch funding rates from Backpack."""
    # Correct endpoint is markPrices, not capital
    url = "https://api.backpack.exchange/api/v1/markPrices"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers={
                "Accept": "application/json"
            })
            response.raise_for_status()
            data = response.json()

            if not isinstance(data, list):
                return []

            rates = []
            for item in data:
                if not isinstance(item, dict):
                    continue

                symbol = item.get("symbol", "")
                funding_rate = item.get("fundingRate")

                if not symbol or funding_rate is None:
                    continue

                try:
                    # Backpack returns hourly rate, multiply by 8 for 8-hour rate
                    rate_value = float(funding_rate) * 8
                except (ValueError, TypeError):
                    continue

                # Remove _USDC_PERP suffix to get base symbol
                clean_symbol = symbol.replace("_USDC_PERP", "").replace("_USD_PERP", "").upper()

                rates.append(FundingRate(
                    exchange="backpack",
                    symbol=clean_symbol,
                    rate=rate_value,
                    next_funding_time=None,
                    mark_price=float(item.get("markPrice")) if item.get("markPrice") else None
                ))

            return rates
    except Exception as e:
        print(f"Error fetching Backpack rates: {e}")
        return []


async def fetch_edgex_funding_rates() -> List[FundingRate]:
    """
    Fetch funding rates from EdgeX.
    NOTE: EdgeX uses WebSocket connection (wss://quote.edgex.exchange/api/v1/public/ws)
    which is not suitable for synchronous API calls. Would need separate WebSocket service.
    Disabled for now.
    """
    # EdgeX requires WebSocket connection - not implemented in REST API
    return []


async def fetch_aster_funding_rates() -> List[FundingRate]:
    """Fetch funding rates from ASTER."""
    premium_url = "https://fapi.asterdex.com/fapi/v1/premiumIndex"
    funding_url = "https://fapi.asterdex.com/fapi/v1/fundingInfo"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Fetch both endpoints in parallel
            premium_response, funding_response = await asyncio.gather(
                client.get(premium_url, headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }),
                client.get(funding_url, headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                })
            )

            premium_response.raise_for_status()
            funding_response.raise_for_status()

            premium_data = premium_response.json()
            funding_data = funding_response.json()

            # Build interval map from funding info
            interval_map = {}
            for entry in funding_data:
                symbol = entry.get("symbol", "").upper()
                if symbol:
                    interval_map[symbol] = entry.get("fundingIntervalHours", 8)

            # Process premium index data
            rates = []
            for entry in premium_data:
                symbol = entry.get("symbol", "").upper()
                if not symbol:
                    continue

                # Get last funding rate
                last_rate = entry.get("lastFundingRate")
                if last_rate is None:
                    continue

                try:
                    rate_value = float(last_rate)
                except (ValueError, TypeError):
                    continue

                # Normalize to 8-hour rate
                hours = interval_map.get(symbol, 8)
                eight_hour_rate = rate_value * (8 / hours)

                # Normalize symbol (remove USDT/USD suffix if present)
                # Remove USDT first, then USD to handle both BTCUSDT and BTCUSD
                normalized_symbol = symbol
                if normalized_symbol.endswith("USDT"):
                    normalized_symbol = normalized_symbol[:-4]
                elif normalized_symbol.endswith("USD"):
                    normalized_symbol = normalized_symbol[:-3]

                # Convert nextFundingTime from milliseconds timestamp to ISO string
                next_funding = entry.get("nextFundingTime")
                next_funding_str = None
                if next_funding:
                    try:
                        from datetime import datetime
                        next_funding_str = datetime.fromtimestamp(next_funding / 1000).isoformat()
                    except:
                        pass

                rates.append(FundingRate(
                    exchange="aster",
                    symbol=normalized_symbol,
                    rate=eight_hour_rate,
                    next_funding_time=next_funding_str,
                    mark_price=float(entry.get("markPrice")) if entry.get("markPrice") else None
                ))

            return rates
    except Exception as e:
        print(f"Error fetching ASTER rates: {e}")
        return []


async def fetch_binance_funding_info() -> Dict[str, int]:
    """Fetch Binance funding interval information."""
    url = "https://fapi.binance.com/fapi/v1/fundingInfo"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

            interval_map = {}
            for entry in data:
                if entry.get("symbol") and isinstance(entry.get("fundingIntervalHours"), int):
                    interval_map[entry["symbol"].upper()] = entry["fundingIntervalHours"]

            return interval_map
    except Exception as e:
        print(f"Error fetching Binance funding info: {e}")
        return {}


async def normalize_binance_rates(rates: List[FundingRate]) -> List[FundingRate]:
    """Normalize Binance funding rates to 8-hour periods."""
    binance_info = await fetch_binance_funding_info()

    normalized = []
    for rate in rates:
        if rate.exchange != "binance" or rate.rate is None:
            normalized.append(rate)
            continue

        symbol_key = rate.symbol.upper()
        hours = binance_info.get(symbol_key, 8)
        eight_hour_rate = rate.rate * (8 / hours)

        normalized.append(FundingRate(
            exchange=rate.exchange,
            symbol=rate.symbol,
            rate=eight_hour_rate,
            next_funding_time=rate.next_funding_time,
            mark_price=rate.mark_price
        ))

    return normalized


async def fetch_binance_spot_symbols() -> set:
    """Fetch available Binance spot trading pairs."""
    url = "https://api.binance.com/api/v3/exchangeInfo"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

            # Extract base assets from USDT pairs that are trading
            spot_symbols = set()
            for symbol_info in data.get("symbols", []):
                if (symbol_info.get("status") == "TRADING" and
                    symbol_info.get("quoteAsset") == "USDT"):
                    base_asset = symbol_info.get("baseAsset", "").upper()
                    if base_asset:
                        spot_symbols.add(base_asset)

            print(f"Found {len(spot_symbols)} Binance spot symbols")
            return spot_symbols
    except Exception as e:
        print(f"Error fetching Binance spot symbols: {e}")
        return set()


async def fetch_all_funding_rates() -> List[FundingRate]:
    """Fetch funding rates from all DEXs and normalize them."""
    import time
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
    print(f"Fetched all funding rates in {elapsed:.2f}s - Lighter: {len(normalized_lighter)}, ASTER: {len(aster_rates)}, GRVT: {len(grvt_rates)}, Backpack: {len(backpack_rates)}, Binance spot: {len(binance_spot_symbols)}")

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
            print(f"Fetching fresh funding rates data (force_refresh={force_refresh}, cache_is_stale={cache_is_stale})...")
            _funding_rates_cache = await fetch_all_funding_rates()
            _cache_last_updated = now
            print(f"Fetched {len(_funding_rates_cache)} funding rates")

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

        print(f"Returning {len(rates)} rates to frontend, last_updated: {last_updated}")

        return FundingRatesResponse(
            rates=rates,
            last_updated=last_updated
        )
    except Exception as e:
        print(f"Error in get_funding_rates: {e}")
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

        # Group rates by symbol
        grouped_rates = {}
        for rate in rates:
            if rate.symbol not in grouped_rates:
                grouped_rates[rate.symbol] = {}
            grouped_rates[rate.symbol][rate.exchange] = rate.rate

        # Get all enabled alerts
        alerts = db.query(FundingRateAlert).filter(FundingRateAlert.enabled == True).all()

        for alert in alerts:
            exchanges = json.loads(alert.exchanges)
            triggered = False
            message = ""

            if alert.alert_type == 'single':
                # Check single exchange funding rates
                for symbol, exchange_rates in grouped_rates.items():
                    for exchange in exchanges:
                        if exchange in exchange_rates and exchange_rates[exchange] is not None:
                            rate = exchange_rates[exchange]
                            if rate >= alert.threshold:
                                triggered = True
                                message = f"🎯 {alert.name}\n{symbol} on {exchange.upper()}: {rate*100:.4f}% (threshold: {alert.threshold*100:.2f}%)"
                                break
                    if triggered:
                        break

            elif alert.alert_type == 'spread':
                # Check spread between exchanges
                for symbol, exchange_rates in grouped_rates.items():
                    # Get rates for selected exchanges
                    selected_rates = []
                    for exchange in exchanges:
                        if exchange in exchange_rates and exchange_rates[exchange] is not None:
                            selected_rates.append((exchange, exchange_rates[exchange]))

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
                        print(f"Alert triggered: {alert.name}")
                    else:
                        print("No Pushover config found, skipping notification")
                except Exception as e:
                    print(f"Failed to send alert notification: {e}")

    except Exception as e:
        print(f"Error checking funding rate alerts: {e}")
    finally:
        db.close()


async def funding_rate_alert_checker_task():
    """Background task to check funding rate alerts every minute."""
    global _alert_checker_running
    _alert_checker_running = True

    print("Starting funding rate alert checker...")

    while _alert_checker_running:
        try:
            await check_funding_rate_alerts()
        except Exception as e:
            print(f"Error in alert checker task: {e}")

        # Wait 60 seconds before next check
        await asyncio.sleep(60)


@router.post("/dex/funding-rate-alerts/start-checker")
async def start_alert_checker():
    """Start the background alert checker task."""
    global _alert_checker_running

    if _alert_checker_running:
        return {"message": "Alert checker is already running"}

    # Start background task
    asyncio.create_task(funding_rate_alert_checker_task())

    return {"message": "Alert checker started"}
