"""Jupiter exchange adapter (Solana DEX aggregator)."""
from typing import List, Dict, Any
from .base import BaseExchangeAdapter

# USD-priced tokens (get price via USDC swap quote)
# Format: symbol -> (token_address, decimals)
USD_TOKENS = {
    'SOL': ('So11111111111111111111111111111111111111112', 9),  # Native SOL
    'BTC': ('3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', 8),  # Wrapped BTC (Portal)
    'ETH': ('7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', 8),  # Wrapped Ether (Wormhole)
    'JLP': ('27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4', 6),  # Jupiter Perps LP
    'ALP': ('4yCLi5yWGzpTWMQ1iWHG5CrGYAdBkhyEdsuSugjDUqwj', 6),  # Adrena LP
}

# SOL Liquid Staking Tokens (LSTs) - ratios (how many LST tokens per 1 SOL)
LST_TOKENS = {
    'SOL/BNSOL': 'BNso1VUJnh4zcfpZa6986Ea66P6TCp59hvtNJ8b1X85',  # How many BNSOL per SOL
    'SOL/JitoSOL': 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',  # How many JitoSOL per SOL
    'SOL/JupSOL': 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v',  # How many JupSOL per SOL
    'SOL/bbSOL': 'Bybit2vBJGhPF52GBdNaQfUJ6ZpThSgHBobjWZpLPb4B',  # How many bbSOL per SOL
    'SOL/mSOL': 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  # How many mSOL per SOL
}

USDC_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
USDC_DECIMALS = 6
SOL_ADDRESS = 'So11111111111111111111111111111111111111112'
SOL_DECIMALS = 9

class JupiterAdapter(BaseExchangeAdapter):
    QUOTE_URL = "https://lite-api.jup.ag/swap/v1/quote"

    def __init__(self):
        super().__init__("jupiter")

    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        return []

    async def fetch_spot_prices(self) -> List[Dict[str, Any]]:
        """
        Fetch spot prices from Jupiter swap quotes.

        Returns USD prices for tokens (via USDC) and LST ratios (vs SOL).
        """
        try:
            prices = []

            # Fetch USD prices (Token -> USDC quotes)
            for symbol, (token_address, token_decimals) in USD_TOKENS.items():
                try:
                    # Use 1 token as base amount
                    base_amount = 10 ** token_decimals

                    data = await self._http_get(
                        self.QUOTE_URL,
                        params={
                            'inputMint': token_address,
                            'outputMint': USDC_ADDRESS,
                            'amount': base_amount,
                            'slippageBps': 50
                        }
                    )

                    in_amount = int(data.get('inAmount', 0))
                    out_amount = int(data.get('outAmount', 0))

                    if in_amount == 0 or out_amount == 0:
                        self.logger.warning(f"Invalid quote for {symbol}")
                        continue

                    # Calculate USD price
                    # Price = (outAmount / 10^usdc_decimals) / (inAmount / 10^token_decimals)
                    price = (out_amount * (10 ** token_decimals)) / (in_amount * (10 ** USDC_DECIMALS))

                    prices.append({
                        "symbol": symbol,
                        "price": float(price),
                        "volume_24h": None
                    })

                    self.logger.info(f"Jupiter {symbol} price: ${price:.2f}")

                except Exception as e:
                    self.logger.error(f"Error fetching {symbol} price: {e}")

            # Fetch LST ratios (SOL -> LST quotes)
            for symbol, lst_address in LST_TOKENS.items():
                try:
                    # Use 1 SOL as base amount
                    base_amount = 10 ** SOL_DECIMALS

                    data = await self._http_get(
                        self.QUOTE_URL,
                        params={
                            'inputMint': SOL_ADDRESS,
                            'outputMint': lst_address,
                            'amount': base_amount,
                            'slippageBps': 50
                        }
                    )

                    in_amount = int(data.get('inAmount', 0))
                    out_amount = int(data.get('outAmount', 0))

                    if in_amount == 0 or out_amount == 0:
                        self.logger.warning(f"Invalid quote for {symbol}")
                        continue

                    # Get LST decimals from first quote
                    # Ratio = how many LST tokens per 1 SOL
                    # Since amounts already include decimals, just divide
                    ratio = out_amount / in_amount

                    prices.append({
                        "symbol": symbol,
                        "price": float(ratio),
                        "volume_24h": None
                    })

                    self.logger.info(f"Jupiter {symbol} ratio: {ratio:.6f}")

                except Exception as e:
                    self.logger.error(f"Error fetching {symbol} ratio: {e}")

            self.logger.debug(f"Fetched {len(prices)} spot prices")
            return prices

        except Exception as e:
            self.logger.error(f"Error: {e}")
            return []
