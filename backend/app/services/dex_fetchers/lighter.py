"""Lighter DEX funding rate fetcher."""

import httpx
from typing import List

from .models import FundingRate


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
