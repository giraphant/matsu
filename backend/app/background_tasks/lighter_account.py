"""
Lighter Account Monitor
Fetches account value and positions from Lighter protocol without needing private key
"""

from datetime import datetime
from typing import Dict, Any
import asyncio

from app.core.logger import get_logger
from app.models.database import WebhookData, get_db_session
from app.background_tasks.base import BaseMonitor

logger = get_logger(__name__)


class LighterAccountMonitor(BaseMonitor):
    """Monitor for Lighter account data."""

    def __init__(self, account_index: int = 138344):
        # Run every 30 seconds
        super().__init__(name="Lighter Account", interval=30)
        self.account_index = account_index
        self.api_client = None
        self.account_api = None

    async def _initialize_api(self):
        """Initialize Lighter API client (read-only, no private key needed)"""
        if self.api_client is None:
            try:
                from lighter import Configuration, ApiClient, AccountApi

                config = Configuration(host="https://mainnet.zklighter.elliot.ai")
                self.api_client = ApiClient(configuration=config)
                self.account_api = AccountApi(self.api_client)

                logger.info("Lighter API client initialized (read-only mode)")
            except ImportError:
                logger.error("lighter-sdk not installed. Install with: pip install lighter-sdk")
                raise
            except Exception as e:
                logger.error(f"Failed to initialize Lighter API: {e}")
                raise

    async def run(self) -> None:
        """Fetch and store account data for one iteration."""
        logger.debug(f"Fetching Lighter account data for index {self.account_index}...")

        try:
            # Initialize API if needed
            if self.account_api is None:
                await self._initialize_api()

            # Fetch account data
            account_data = await self._fetch_account_data()

            if not account_data:
                logger.warning(f"No account data fetched for index {self.account_index}")
                return

            # Store data
            stored_count = await self._store_account_data(account_data)
            logger.info(f"Stored {stored_count} Lighter account metrics")

        except Exception as e:
            logger.error(f"Error in Lighter account monitor: {e}", exc_info=True)

    async def _fetch_account_data(self) -> Dict[str, Any]:
        """Fetch account data from Lighter API."""
        try:
            # Query account
            response = await self.account_api.account(
                by="index",
                value=str(self.account_index)
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
            logger.error(f"Error fetching Lighter account data: {e}", exc_info=True)
            return {}

    async def _store_account_data(self, account_data: Dict[str, Any]) -> int:
        """Store account data in database."""
        db = get_db_session()
        stored_count = 0

        try:
            timestamp = datetime.utcnow()

            # Store account value
            if 'account_value' in account_data:
                account_value_data = WebhookData(
                    monitor_id='lighter_account_value',
                    monitor_name='Lighter 账户价值',
                    value=account_data['account_value'],
                    timestamp=timestamp
                )
                db.add(account_value_data)
                stored_count += 1

                logger.info(f"Lighter Account Value: ${account_data['account_value']:,.2f}")

            # Store each position
            if 'positions' in account_data:
                for symbol, size in account_data['positions'].items():
                    position_data = WebhookData(
                        monitor_id=f'lighter_position_{symbol}',
                        monitor_name=f'Lighter {symbol} 持仓',
                        value=size,
                        timestamp=timestamp
                    )
                    db.add(position_data)
                    stored_count += 1

                    logger.info(f"Lighter {symbol} Position: {size:+.4f}")

            db.commit()
            return stored_count

        except Exception as e:
            logger.error(f"Error storing Lighter account data: {e}")
            db.rollback()
            return 0

        finally:
            db.close()


def get_monitor():
    """Factory function to create monitor instance"""
    return LighterAccountMonitor(account_index=138344)
