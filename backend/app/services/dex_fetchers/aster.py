"""ASTER DEX funding rate fetcher."""

import httpx
import asyncio
from datetime import datetime
from typing import List

from .models import FundingRate


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
