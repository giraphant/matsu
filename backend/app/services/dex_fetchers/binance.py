"""Binance helper functions for funding rate normalization and spot checking."""

import httpx
from typing import List, Dict, Set

from app.core.logger import get_logger
from .models import FundingRate

logger = get_logger(__name__)


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
        logger.error(f"Error fetching Binance funding info: {e}")
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


async def fetch_binance_spot_symbols() -> Set[str]:
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

            logger.debug(f"Found {len(spot_symbols)} Binance spot symbols")
            return spot_symbols
    except Exception as e:
        logger.error(f"Error fetching Binance spot symbols: {e}")
        return set()
