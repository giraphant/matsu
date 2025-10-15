"""
Pyth Network Oracle Spot Price Monitor
Fetches spot prices from Pyth oracle network via Hermes API
"""

from datetime import datetime
from sqlalchemy.orm import Session

from app.background_tasks.base import BaseMonitor
from app.models.database import SpotPrice, get_db_session
from app.core.logger import get_logger

logger = get_logger(__name__)


class PythSpotMonitor(BaseMonitor):
    def __init__(self):
        super().__init__(name="Pyth Oracle Prices", interval=60)  # Every 1 minute
        self.api_url = "https://hermes.pyth.network/v2/updates/price/latest"

        # Price feed IDs for Pyth Network
        # See: https://pyth.network/developers/price-feed-ids
        self.price_feeds = {
            'BTC': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
            'ETH': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
            'SOL': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
            'JLP': '0x6704952e00b6a088b6dcdb8170dcd591eaf64cff9e996ca75ae0ca55bfb96687',
            'ALP': '0xa6cdf5ac29a2bb75c2d1347e85362b703c7c8090a21d358e6b4155294e5b3159',
        }

    async def run(self) -> None:
        """Fetch spot prices from Pyth Hermes API"""
        db = get_db_session()

        try:
            import httpx

            stored_count = 0

            # Fetch price for each symbol
            for symbol, feed_id in self.price_feeds.items():
                try:
                    url = f"{self.api_url}?ids[]={feed_id}"

                    async with httpx.AsyncClient(timeout=30.0) as client:
                        response = await client.get(url)
                        response.raise_for_status()
                        data = response.json()

                    if not data or 'parsed' not in data:
                        logger.warning(f"No data returned from Pyth API for {symbol}")
                        continue

                    # Parse Pyth response
                    # Structure: data.parsed[0].price.price (with exponent)
                    parsed = data['parsed']
                    if not parsed or len(parsed) == 0:
                        logger.warning(f"No parsed data for {symbol} from Pyth")
                        continue

                    price_data = parsed[0]['price']
                    price_raw = int(price_data['price'])
                    expo = int(price_data['expo'])

                    # Calculate actual price: price * 10^expo
                    price = price_raw * (10 ** expo)

                    # Store in database
                    new_price = SpotPrice(
                        exchange='pyth',
                        symbol=symbol,
                        price=float(price),
                        volume_24h=None,  # Pyth doesn't provide volume
                        timestamp=datetime.utcnow()
                    )
                    db.add(new_price)
                    stored_count += 1

                    logger.info(f"Pyth {symbol} price: ${price:.2f}")

                except Exception as e:
                    logger.error(f"Error fetching Pyth price for {symbol}: {e}", exc_info=True)
                    continue

            db.commit()
            logger.info(f"Stored {stored_count} Pyth oracle prices")

        except Exception as e:
            logger.error(f"Error fetching Pyth oracle prices: {e}", exc_info=True)
            db.rollback()
        finally:
            db.close()


def get_monitor():
    """Factory function to create monitor instance"""
    return PythSpotMonitor()
