"""Backpack DEX funding rate fetcher."""

import httpx
from typing import List

from app.core.logger import get_logger
from .models import FundingRate

logger = get_logger(__name__)


async def fetch_backpack_funding_rates() -> List[FundingRate]:
    """Fetch funding rates from Backpack."""
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
        logger.error(f"Error fetching Backpack rates: {e}")
        return []
