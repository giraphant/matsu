"""
Lighter exchange adapter.
Handles funding rates and account data from Lighter.
"""

from typing import List, Dict, Any

from .base import BaseExchangeAdapter


class LighterAdapter(BaseExchangeAdapter):
    """
    Lighter exchange adapter.

    Capabilities:
    - Funding rates
    - Account data (balance, positions)
    """

    API_URL = "https://mainnet.zklighter.elliot.ai/api/v1/funding-rates"

    def __init__(self):
        super().__init__("lighter")
        self.api_client = None
        self.account_api = None

    async def fetch_funding_rates(self) -> List[Dict[str, Any]]:
        """
        Fetch funding rates from Lighter.

        Returns:
            List of dicts with keys:
            - symbol: str (e.g., "BTC", "ETH", "SOL")
            - rate: float (8-hour rate)
            - annualized_rate: float (APY percentage)
            - mark_price: None (not provided)
            - next_funding_time: None (not provided)
        """
        try:
            data = await self._http_get(
                self.API_URL,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            )

            funding_rates = data.get("funding_rates", [])
            rates = []

            for entry in funding_rates:
                symbol = entry.get("symbol", "").upper()
                exchange = entry.get("exchange", "lighter").lower()
                rate = entry.get("rate")

                # Only process 'lighter' exchange
                if exchange != "lighter":
                    continue

                # Skip if no rate available
                if rate is None:
                    continue

                # Convert rate to float
                rate_value = float(rate)

                # Annualize the 8-hour rate
                annualized_rate = self.annualize_8h_rate(rate_value)

                rates.append({
                    "symbol": symbol,
                    "rate": rate_value,
                    "annualized_rate": annualized_rate,
                    "mark_price": None,  # Not available in API response
                    "next_funding_time": None  # Not available in API response
                })

            self.logger.debug(f"Fetched {len(rates)} funding rates")
            return rates

        except Exception as e:
            self.logger.error(f"Error fetching funding rates: {e}")
            return []

    async def fetch_spot_prices(self) -> List[Dict[str, Any]]:
        """Lighter doesn't provide spot prices."""
        return []

    async def _initialize_account_api(self):
        """Initialize Lighter API client for account data (read-only)."""
        if self.api_client is None:
            try:
                from lighter import Configuration, ApiClient, AccountApi

                config = Configuration(host="https://mainnet.zklighter.elliot.ai")
                self.api_client = ApiClient(configuration=config)
                self.account_api = AccountApi(self.api_client)

                self.logger.info("Lighter account API initialized (read-only)")
            except ImportError:
                self.logger.error("lighter-sdk not installed. Install with: pip install lighter-sdk")
                raise
            except Exception as e:
                self.logger.error(f"Failed to initialize Lighter API: {e}")
                raise

    async def fetch_account_data(self, address: str, account_name: str) -> Dict[str, Any]:
        """
        Fetch account data from Lighter.

        Args:
            address: Account address or index
            account_name: Human-readable account name (for logging)

        Returns:
            Dict with keys:
            - account_value: float (total account value)
            - collateral: float
            - unrealized_pnl: float
            - positions: dict {symbol: size}
        """
        try:
            # Initialize API if needed
            if self.account_api is None:
                await self._initialize_account_api()

            # Query account (address can be account index or actual address)
            response = await self.account_api.account(
                by="index",
                value=address
            )

            if not response or not hasattr(response, 'accounts') or len(response.accounts) == 0:
                return {}

            account = response.accounts[0]

            # Calculate account value
            collateral = float(account.collateral) if hasattr(account, 'collateral') and account.collateral else 0

            # Sum unrealized PnL from all positions
            total_unrealized_pnl = 0
            positions = {}

            if hasattr(account, 'positions'):
                for position in account.positions:
                    # Get unrealized PnL
                    if hasattr(position, 'unrealized_pnl') and position.unrealized_pnl:
                        total_unrealized_pnl += float(position.unrealized_pnl)

                    # Get position size (with sign)
                    if hasattr(position, 'symbol') and hasattr(position, 'position'):
                        symbol = position.symbol
                        pos_size = float(position.position)

                        # Apply sign
                        if hasattr(position, 'sign'):
                            pos_size = pos_size * position.sign

                        # Only store non-zero positions
                        if abs(pos_size) > 0.0001:
                            positions[symbol] = pos_size

            # Calculate total account value
            account_value = collateral + total_unrealized_pnl

            return {
                'account_value': account_value,
                'collateral': collateral,
                'unrealized_pnl': total_unrealized_pnl,
                'positions': positions
            }

        except Exception as e:
            self.logger.error(f"Error fetching account data for {account_name}: {e}")
            return {}
