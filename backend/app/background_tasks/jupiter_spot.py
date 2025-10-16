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
        super().__init__(name="Jupiter Spot Prices", interval=10)  # Every 10 seconds
        self.api_url = "https://lite-api.jup.ag/price/v3"

        # Token mint addresses on Solana
        # See: https://solscan.io or https://explorer.solana.com
        self.tokens = {
            'SOL': 'So11111111111111111111111111111111111111112',  # Native SOL
            'BTC': '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',  # Wrapped BTC (Portal)
            'ETH': '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',  # Wrapped Ether (Wormhole)
            'JLP': '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',  # Jupiter Perps LP
            'ALP': '4yCLi5yWGzpTWMQ1iWHG5CrGYAdBkhyEdsuSugjDUqwj',  # Adrena LP
        }

    async def run(self) -> None:
        """Fetch spot prices from Jupiter API"""
        db = get_db_session()

        try:
            import httpx

            # Fetch prices for all tokens in one request
            # API expects comma-separated token mint addresses
            token_addresses = ','.join(self.tokens.values())
            url = f"{self.api_url}?ids={token_addresses}"

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()

            if not data:
                logger.warning(f"No data returned from Jupiter API")
                return

            # Process each token
            # Response format: {address: {usdPrice: 123.45, ...}}
            stored_count = 0

            for symbol, address in self.tokens.items():
                if address not in data:
                    logger.warning(f"No price data for {symbol} ({address}) from Jupiter")
                    continue

                price_info = data[address]
                price = price_info.get('usdPrice')

                if price is None:
                    logger.warning(f"No usdPrice value for {symbol} from Jupiter")
                    continue

                # Store in database
                new_price = SpotPrice(
                    exchange='jupiter',
                    symbol=symbol,
                    price=float(price),
                    volume_24h=None,  # Jupiter v3 API doesn't provide 24h volume
                    timestamp=datetime.utcnow()
                )
                db.add(new_price)
                stored_count += 1

                logger.info(f"Jupiter {symbol} price: ${price:.2f}")

            db.commit()
            logger.info(f"Stored {stored_count} Jupiter spot prices")

        except Exception as e:
            logger.error(f"Error fetching Jupiter spot prices: {e}", exc_info=True)
            db.rollback()
        finally:
            db.close()


def get_monitor():
    """Factory function to create monitor instance"""
    return JupiterSpotMonitor()
