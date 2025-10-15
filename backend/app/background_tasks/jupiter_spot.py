"""
Jupiter (Solana on-chain) Spot Price Monitor
Fetches spot prices from Jupiter aggregator API
"""

from datetime import datetime
from sqlalchemy.orm import Session

from app.background_tasks.base import BaseMonitor
from app.models.database import SpotPrice, get_db_session
from app.core.logger import get_logger

logger = get_logger(__name__)


class JupiterSpotMonitor(BaseMonitor):
    def __init__(self):
        super().__init__(name="Jupiter Spot Prices", interval=60)  # Every 1 minute
        self.api_url = "https://price.jup.ag/v6/price"
        self.symbols = ['SOL', 'BTC', 'ETH']

    async def check(self, db: Session) -> dict:
        """Fetch spot prices from Jupiter API"""
        try:
            import httpx

            # Fetch prices for all symbols in one request
            ids = ','.join(self.symbols)
            url = f"{self.api_url}?ids={ids}"

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()

            if not data or 'data' not in data:
                logger.warning(f"No data returned from Jupiter API")
                return {"status": "no_data"}

            # Process each symbol
            prices_data = data['data']
            stored_count = 0

            for symbol in self.symbols:
                if symbol not in prices_data:
                    logger.warning(f"No price data for {symbol} from Jupiter")
                    continue

                price_info = prices_data[symbol]
                price = price_info.get('price')

                if price is None:
                    logger.warning(f"No price value for {symbol} from Jupiter")
                    continue

                # Store in database
                new_price = SpotPrice(
                    exchange='jupiter',
                    symbol=symbol,
                    price=float(price),
                    volume_24h=None,  # Jupiter API doesn't provide 24h volume in price endpoint
                    timestamp=datetime.utcnow()
                )
                db.add(new_price)
                stored_count += 1

                logger.info(f"Jupiter {symbol} price: ${price}")

            db.commit()

            return {
                "status": "success",
                "symbols_count": stored_count,
                "message": f"Stored {stored_count} Jupiter spot prices"
            }

        except Exception as e:
            logger.error(f"Error fetching Jupiter spot prices: {e}", exc_info=True)
            db.rollback()
            return {"status": "error", "error": str(e)}


def get_monitor():
    """Factory function to create monitor instance"""
    return JupiterSpotMonitor()
