"""
Lighter funding rate monitor service.
Fetches BTC, ETH, SOL funding rates from Lighter and stores them as monitoring data.
"""

import asyncio
from datetime import datetime
from typing import List
import httpx

from app.models.database import MonitoringData, get_db_session


# Target symbols to monitor
TARGET_SYMBOLS = ["BTC", "ETH", "SOL"]


async def fetch_lighter_funding_rates():
    """Fetch funding rates from Lighter API."""
    url = "https://mainnet.zklighter.elliot.ai/api/v1/funding-rates"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers={
                "Accept": "application/json",
                "Content-Type": "application/json"
            })
            response.raise_for_status()
            data = response.json()

            return data.get("funding_rates", [])
    except Exception as e:
        import traceback
        print(f"[LighterMonitor] Error fetching Lighter rates: {e}")
        print(f"[LighterMonitor] Traceback: {traceback.format_exc()}")
        return []


def annualize_rate(rate_8h: float) -> float:
    """
    Convert 8-hour funding rate to annualized percentage.

    Args:
        rate_8h: 8-hour funding rate (e.g., 0.0001 = 0.01%)

    Returns:
        Annualized rate in percentage (e.g., 10.95 = 10.95% APY)
    """
    # 8-hour rate * 3 (per day) * 365 (per year) * 100 (to percentage)
    return rate_8h * 3 * 365 * 100


async def store_funding_rates():
    """Fetch Lighter funding rates and store in monitoring_data table."""
    print("[LighterMonitor] Fetching funding rates...")

    rates = await fetch_lighter_funding_rates()

    if not rates:
        print("[LighterMonitor] No rates fetched")
        return

    db = get_db_session()
    try:
        stored_count = 0

        for entry in rates:
            symbol = entry.get("symbol", "").upper()
            exchange = entry.get("exchange", "lighter").lower()
            rate = entry.get("rate")

            # Only process 'lighter' exchange, skip others (binance, bybit, hyperliquid)
            if exchange != "lighter":
                continue

            # Skip if not one of our target symbols
            if symbol not in TARGET_SYMBOLS:
                continue

            # Skip if no rate available
            if rate is None:
                continue

            # Annualize the rate
            annualized_rate = annualize_rate(float(rate))

            # Create monitor_id (e.g., "lighter-btc")
            monitor_id = f"lighter-{symbol.lower()}"
            monitor_name = f"Lighter {symbol} Funding Rate"

            # Create or update monitoring data
            new_data = MonitoringData(
                monitor_id=monitor_id,
                monitor_name=monitor_name,
                monitor_type='monitor',
                url=f"https://lighter.xyz/trade/{symbol}USDT",
                value=annualized_rate,
                unit='%',
                status='active',
                timestamp=datetime.utcnow(),
                webhook_received_at=datetime.utcnow()
            )

            db.add(new_data)
            stored_count += 1

        db.commit()
        print(f"[LighterMonitor] Stored {stored_count} funding rates")

    except Exception as e:
        print(f"[LighterMonitor] Error storing rates: {e}")
        db.rollback()
    finally:
        db.close()


async def lighter_monitor_loop():
    """Background loop to fetch and store Lighter funding rates periodically."""
    print("[LighterMonitor] Starting monitor loop...")

    while True:
        try:
            await store_funding_rates()
        except Exception as e:
            print(f"[LighterMonitor] Error in monitor loop: {e}")

        # Wait 5 minutes before next fetch
        await asyncio.sleep(300)


def start_lighter_monitor():
    """Start the Lighter monitor background task."""
    asyncio.create_task(lighter_monitor_loop())
    print("[LighterMonitor] Background task started")
