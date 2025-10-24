"""
Lighter Account Monitor
Fetches account value and positions from Lighter protocol without needing private key
Supports multiple accounts from database
"""

from datetime import datetime
from typing import Dict, Any, List
import asyncio

from app.core.logger import get_logger
from app.models.database import WebhookData, DexAccount, get_db_session
from app.background_tasks.base import BaseMonitor

logger = get_logger(__name__)


class LighterAccountMonitor(BaseMonitor):
    """Monitor for Lighter account data - supports multiple accounts."""

    def __init__(self, account_index: int = None):
        # Run every 30 seconds
        super().__init__(name="Lighter Account", interval=30)
        # Legacy: support single account_index for backward compatibility
        self.legacy_account_index = account_index
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

    def _get_accounts_to_monitor(self) -> List[Dict[str, Any]]:
        """Get list of Lighter accounts to monitor from database."""
        db = get_db_session()
        try:
            accounts = db.query(DexAccount).filter(
                DexAccount.exchange == 'lighter',
                DexAccount.enabled == True
            ).all()

            result = []
            for account in accounts:
                result.append({
                    'id': account.id,
                    'name': account.name,
                    'address': account.address
                })

            # Legacy: if no accounts in database but legacy_account_index is set, use that
            if not result and self.legacy_account_index is not None:
                result.append({
                    'id': None,
                    'name': f'Account {self.legacy_account_index}',
                    'address': str(self.legacy_account_index)
                })

            return result

        finally:
            db.close()

    async def run(self) -> None:
        """Fetch and store account data for all enabled accounts."""
        try:
            # Initialize API if needed
            if self.account_api is None:
                await self._initialize_api()

            # Get accounts to monitor
            accounts = self._get_accounts_to_monitor()

            if not accounts:
                logger.debug("No Lighter accounts to monitor")
                return

            logger.debug(f"Monitoring {len(accounts)} Lighter account(s)")

            # Fetch and store data for each account
            total_stored = 0
            for account in accounts:
                try:
                    account_data = await self._fetch_account_data(account['address'], account['name'])

                    if not account_data:
                        logger.warning(f"No data fetched for {account['name']}")
                        continue

                    stored_count = await self._store_account_data(account_data, account)
                    total_stored += stored_count

                except Exception as e:
                    logger.error(f"Error monitoring account {account['name']}: {e}", exc_info=True)

            if total_stored > 0:
                logger.info(f"Stored {total_stored} Lighter account metrics from {len(accounts)} accounts")

        except Exception as e:
            logger.error(f"Error in Lighter account monitor: {e}", exc_info=True)

    async def _fetch_account_data(self, address: str, account_name: str) -> Dict[str, Any]:
        """Fetch account data from Lighter API."""
        try:
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
            logger.error(f"Error fetching Lighter account data: {e}", exc_info=True)
            return {}

    async def _store_account_data(self, account_data: Dict[str, Any], account: Dict[str, Any]) -> int:
        """Store account data in database with account-specific monitor IDs."""
        db = get_db_session()
        stored_count = 0

        try:
            timestamp = datetime.utcnow()
            account_name = account['name']
            account_id = account.get('id')

            # Create unique monitor ID prefix for this account
            # If account has DB id, use it; otherwise use address
            if account_id:
                id_prefix = f'lighter_account_{account_id}'
            else:
                # Legacy mode: use simple lighter_account prefix
                id_prefix = 'lighter_account'

            # Store account value
            if 'account_value' in account_data:
                account_value_data = WebhookData(
                    monitor_id=f'{id_prefix}_value',
                    monitor_name=f'{account_name} 账户价值',
                    value=account_data['account_value'],
                    timestamp=timestamp
                )
                db.add(account_value_data)
                stored_count += 1

                logger.info(f"{account_name} Account Value: ${account_data['account_value']:,.2f}")

            # Store each position
            if 'positions' in account_data:
                for symbol, size in account_data['positions'].items():
                    position_data = WebhookData(
                        monitor_id=f'{id_prefix}_position_{symbol}',
                        monitor_name=f'{account_name} {symbol} 持仓',
                        value=size,
                        timestamp=timestamp
                    )
                    db.add(position_data)
                    stored_count += 1

                    logger.debug(f"{account_name} {symbol} Position: {size:+.4f}")

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
