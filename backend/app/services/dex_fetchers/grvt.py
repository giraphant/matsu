"""GRVT DEX funding rate fetcher."""

import httpx
import asyncio
from typing import List

from app.core.logger import get_logger
from .models import FundingRate

logger = get_logger(__name__)


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
                    except Exception:
                        return None

            # Fetch all instruments concurrently with rate limiting
            tasks = [fetch_instrument_funding(inst) for inst in instruments]
            results = await asyncio.gather(*tasks)

            # Filter out None results
            rates = [r for r in results if r is not None]
            return rates
    except Exception as e:
        logger.error(f"Error fetching GRVT rates: {e}")
        return []
