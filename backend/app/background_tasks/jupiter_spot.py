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
        self.quote_url = "https://quote-api.jup.ag/v6/quote"
        self.sol_address = 'So11111111111111111111111111111111111111112'
        self.usdc_address = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'  # USDC

        # USD-priced tokens (get price via USDC swap quote)
        self.usd_tokens = {
            'SOL': 'So11111111111111111111111111111111111111112',  # Native SOL
            'BTC': '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',  # Wrapped BTC (Portal)
            'ETH': '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',  # Wrapped Ether (Wormhole)
            'JLP': '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',  # Jupiter Perps LP
            'ALP': '4yCLi5yWGzpTWMQ1iWHG5CrGYAdBkhyEdsuSugjDUqwj',  # Adrena LP
        }

        # SOL Liquid Staking Tokens (LSTs) - how many LSTs per SOL
        self.lst_tokens = {
            'SOL/BNSOL': 'BNso1VUJnh4zcfpZa6986Ea66P6TCp59hvtNJ8b1X85',  # How many BNSOL per SOL
            'SOL/JitoSOL': 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',  # How many JitoSOL per SOL
            'SOL/JupSOL': 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v',  # How many JupSOL per SOL
            'SOL/bbSOL': 'Bybit2vBJGhPF52GBdNaQfUJ6ZpThSgHBobjWZpLPb4B',  # How many bbSOL per SOL
            'SOL/mSOL': 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  # How many mSOL per SOL
        }

    async def run(self) -> None:
        """Fetch spot prices from Jupiter API"""
        db = get_db_session()

        try:
            import httpx
            stored_count = 0

            async with httpx.AsyncClient(timeout=30.0) as client:
                # Fetch USD prices using swap quotes (Token -> USDC)
                # For each token, get quote to swap 1 token to USDC to determine USD price
                for symbol, token_address in self.usd_tokens.items():
                    try:
                        # Determine appropriate amount based on token
                        # Use 1 token as base (adjusted for decimals)
                        if symbol == 'SOL':
                            base_amount = 1_000_000_000  # 1 SOL (9 decimals)
                        elif symbol in ['BTC', 'ETH']:
                            base_amount = 100_000_000  # 0.1 BTC/ETH (8 decimals)
                        else:
                            base_amount = 1_000_000_000  # 1 token (assuming 9 decimals)

                        # Get quote: Token -> USDC
                        params = {
                            'inputMint': token_address,
                            'outputMint': self.usdc_address,
                            'amount': base_amount,
                            'slippageBps': 50
                        }

                        quote_response = await client.get(self.quote_url, params=params)
                        quote_response.raise_for_status()
                        quote_data = quote_response.json()

                        in_amount = int(quote_data.get('inAmount', 0))
                        out_amount = int(quote_data.get('outAmount', 0))

                        if in_amount == 0 or out_amount == 0:
                            logger.warning(f"Invalid quote for {symbol}: in={in_amount}, out={out_amount}")
                            continue

                        # Calculate USD price: (USDC out / USDC decimals) / (Token in / Token decimals)
                        # USDC has 6 decimals, so out_amount is in micro-USDC
                        usdc_value = out_amount / 1_000_000  # Convert to USDC

                        # Calculate price per token
                        if symbol in ['BTC', 'ETH']:
                            # We used 0.1 token, so multiply by 10
                            price = usdc_value * 10
                        else:
                            # We used 1 token
                            price = usdc_value

                        # Store in database
                        new_price = SpotPrice(
                            exchange='jupiter',
                            symbol=symbol,
                            price=float(price),
                            volume_24h=None,
                            timestamp=datetime.utcnow()
                        )
                        db.add(new_price)
                        stored_count += 1

                        logger.info(f"Jupiter {symbol} price: ${price:.2f} (quote: {in_amount} -> {out_amount} USDC)")

                    except Exception as e:
                        logger.error(f"Error fetching Jupiter quote for {symbol}: {e}", exc_info=True)
                        continue

                # Fetch SOL/LST ratios using quote API for real market prices
                # Use 100 SOL as the base amount (100 * 10^9 for 9 decimals)
                base_amount = 100_000_000_000

                for symbol, lst_address in self.lst_tokens.items():
                    try:
                        # Get quote for SOL -> LST swap
                        params = {
                            'inputMint': self.sol_address,  # Swapping FROM SOL
                            'outputMint': lst_address,      # Swapping TO LST
                            'amount': base_amount,
                            'slippageBps': 50
                        }

                        quote_response = await client.get(self.quote_url, params=params)
                        quote_response.raise_for_status()
                        quote_data = quote_response.json()

                        in_amount = int(quote_data.get('inAmount', 0))
                        out_amount = int(quote_data.get('outAmount', 0))

                        if in_amount == 0 or out_amount == 0:
                            logger.warning(f"Invalid quote amounts for {symbol}: in={in_amount}, out={out_amount}")
                            continue

                        # Calculate ratio: how many LSTs per SOL
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

                        logger.info(f"Jupiter {symbol} ratio: {ratio:.6f} (quote: {in_amount/1e9:.2f} SOL -> {out_amount/1e9:.2f} LST)")

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
