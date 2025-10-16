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
        self.api_url = "https://price.jup.ag/v6/price"
        self.sol_address = 'So11111111111111111111111111111111111111112'

        # USD-priced tokens
        self.usd_tokens = {
            'SOL': 'So11111111111111111111111111111111111111112',  # Native SOL
            'BTC': '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',  # Wrapped BTC (Portal)
            'ETH': '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',  # Wrapped Ether (Wormhole)
            'JLP': '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',  # Jupiter Perps LP
            'ALP': '4yCLi5yWGzpTWMQ1iWHG5CrGYAdBkhyEdsuSugjDUqwj',  # Adrena LP
        }

        # SOL Liquid Staking Tokens (LSTs) - priced vs SOL
        self.lst_tokens = {
            'BNSOL/SOL': 'BNso1VUJnh4zcfpZa6986Ea66P6TCp59hvtNJ8b1X85',  # Binance Staked SOL
            'JitoSOL/SOL': 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',  # Jito Staked SOL
            'JupSOL/SOL': 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v',  # Jupiter Staked SOL
            'bbSOL/SOL': 'Bybit2vBJGhPF52GBdNaQfUJ6ZpThSgHBobjWZpLPb4B',  # Bybit Staked SOL
            'mSOL/SOL': 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  # Marinade Staked SOL
        }

    async def run(self) -> None:
        """Fetch spot prices from Jupiter API"""
        db = get_db_session()

        try:
            import httpx
            stored_count = 0

            async with httpx.AsyncClient(timeout=30.0) as client:
                # Fetch USD prices for regular tokens
                usd_addresses = ','.join(self.usd_tokens.values())
                usd_url = f"{self.api_url}?ids={usd_addresses}"

                try:
                    usd_response = await client.get(usd_url)
                    usd_response.raise_for_status()
                    usd_data = usd_response.json()

                    # Process USD-priced tokens
                    if 'data' in usd_data:
                        for symbol, address in self.usd_tokens.items():
                            if address not in usd_data['data']:
                                logger.warning(f"No price data for {symbol} ({address}) from Jupiter")
                                continue

                            price_info = usd_data['data'][address]
                            price = price_info.get('price')

                            if price is None:
                                logger.warning(f"No price value for {symbol} from Jupiter")
                                continue

                            # Store in database
                            new_price = SpotPrice(
                                exchange='jupiter',
                                symbol=symbol,
                                price=float(price),
                                volume_24h=None,  # Jupiter v6 API doesn't provide 24h volume
                                timestamp=datetime.utcnow()
                            )
                            db.add(new_price)
                            stored_count += 1

                            logger.info(f"Jupiter {symbol} price: ${price:.2f}")
                    else:
                        logger.warning("No data in USD price response from Jupiter")

                except Exception as e:
                    logger.error(f"Error fetching USD prices from Jupiter: {e}", exc_info=True)

                # Fetch LST/SOL ratios using quote API for real market prices
                # Use 100 tokens as the base amount (100 * 10^9 for 9 decimals)
                base_amount = 100_000_000_000

                for symbol, lst_address in self.lst_tokens.items():
                    try:
                        # Get quote for LST -> SOL swap using Lite tier (free)
                        quote_url = "https://lite-api.jup.ag/swap/v1/quote"
                        params = {
                            'inputMint': lst_address,
                            'outputMint': self.sol_address,
                            'amount': base_amount,
                            'swapMode': 'ExactIn',
                            'onlyDirectRoutes': 'true',  # Only direct routes for more accurate ratio
                            'slippageBps': 50
                        }

                        quote_response = await client.get(quote_url, params=params)
                        quote_response.raise_for_status()
                        quote_data = quote_response.json()

                        in_amount = int(quote_data.get('inAmount', 0))
                        out_amount = int(quote_data.get('outAmount', 0))

                        if in_amount == 0 or out_amount == 0:
                            logger.warning(f"Invalid quote amounts for {symbol}: in={in_amount}, out={out_amount}")
                            continue

                        # Calculate ratio: outAmount / inAmount
                        ratio = out_amount / in_amount

                        # Store in database
                        new_price = SpotPrice(
                            exchange='jupiter',
                            symbol=symbol,
                            price=float(ratio),
                            volume_24h=None,
                            timestamp=datetime.utcnow()
                        )
                        db.add(new_price)
                        stored_count += 1

                        logger.info(f"Jupiter {symbol} ratio: {ratio:.6f} (quote: {in_amount/1e9:.2f} -> {out_amount/1e9:.2f})")

                    except Exception as e:
                        logger.error(f"Error fetching Jupiter quote for {symbol}: {e}", exc_info=True)
                        continue

            db.commit()
            logger.info(f"Stored {stored_count} Jupiter prices/ratios")

        except Exception as e:
            logger.error(f"Error in Jupiter spot monitor: {e}", exc_info=True)
            db.rollback()
        finally:
            db.close()


def get_monitor():
    """Factory function to create monitor instance"""
    return JupiterSpotMonitor()
