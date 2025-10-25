"""
Account monitor (coordinator).
Orchestrates fetching account data from all exchanges that support it.
"""

from datetime import datetime
from typing import List, Type, Dict, Any

from app.core.logger import get_logger
from app.models.database import WebhookData, DexAccount, get_db_session
from app.background_tasks.base import BaseMonitor
from app.background_tasks.exchanges.base import BaseExchangeAdapter
from app.background_tasks.exchanges import LighterAdapter

logger = get_logger(__name__)


class AccountMonitor(BaseMonitor):
    """
    Main account monitor coordinator.

    Coordinates fetching account data (balance, positions) from all
    supported exchanges and stores them in the database.
    """

    # Map exchange names to their adapter classes
    EXCHANGE_ADAPTERS: Dict[str, Type[BaseExchangeAdapter]] = {
        'lighter': LighterAdapter,
        # Future: Add more exchanges that support account monitoring
        # 'hyperliquid': HyperliquidAdapter,
        # 'grvt': GRVTAdapter,
    }

    def __init__(self, interval: int = 30):
        """
        Initialize account monitor.

        Args:
            interval: Seconds between checks (default: 30)
        """
        super().__init__(name="Account Coordinator", interval=interval)
        # Cache adapters to maintain API client state
        self.adapters: Dict[str, BaseExchangeAdapter] = {}

    def _get_adapter(self, exchange: str) -> BaseExchangeAdapter:
        """
        Get or create adapter for an exchange.

        Args:
            exchange: Exchange name (e.g., "lighter")

        Returns:
            Exchange adapter instance
        """
        if exchange not in self.adapters:
            AdapterClass = self.EXCHANGE_ADAPTERS.get(exchange)
            if not AdapterClass:
                raise ValueError(f"No adapter found for exchange: {exchange}")
            self.adapters[exchange] = AdapterClass()

        return self.adapters[exchange]

    def _get_accounts_to_monitor(self) -> List[Dict[str, Any]]:
        """
        Get list of all enabled accounts from database.

        Returns:
            List of account dicts with keys: id, name, exchange, address
        """
        db = get_db_session()
        try:
            accounts = db.query(DexAccount).filter(
                DexAccount.enabled == True
            ).all()

            result = []
            for account in accounts:
                # Only include accounts from supported exchanges
                if account.exchange in self.EXCHANGE_ADAPTERS:
                    result.append({
                        'id': account.id,
                        'name': account.name,
                        'exchange': account.exchange,
                        'address': account.address
                    })

            return result

        finally:
            db.close()

    async def run(self) -> None:
        """Fetch account data from all exchanges."""
        try:
            # Get accounts to monitor
            accounts = self._get_accounts_to_monitor()

            if not accounts:
                logger.debug("No accounts to monitor")
                return

            logger.debug(f"Monitoring {len(accounts)} account(s) across {len(set(a['exchange'] for a in accounts))} exchanges")

            # Fetch and store data for each account
            total_stored = 0
            for account in accounts:
                try:
                    exchange = account['exchange']
                    adapter = self._get_adapter(exchange)

                    # Check if adapter supports account data
                    if not hasattr(adapter, 'fetch_account_data'):
                        logger.warning(f"[{exchange}] Adapter doesn't support account data")
                        continue

                    # Fetch account data
                    account_data = await adapter.fetch_account_data(
                        account['address'],
                        account['name']
                    )

                    if not account_data:
                        logger.warning(f"[{exchange}] No data fetched for {account['name']}")
                        continue

                    # Store in database
                    stored_count = await self._store_account_data(account_data, account)
                    total_stored += stored_count

                except Exception as e:
                    logger.error(f"[{account['exchange']}] Error monitoring {account['name']}: {e}", exc_info=True)

            if total_stored > 0:
                logger.info(f"Stored {total_stored} account metrics from {len(accounts)} accounts")

        except Exception as e:
            logger.error(f"Error in account monitor: {e}", exc_info=True)

    async def _store_account_data(self, account_data: Dict[str, Any], account: Dict[str, Any]) -> int:
        """
        Store account data in database.

        Args:
            account_data: Account data dict with account_value, positions, etc.
            account: Account metadata dict with id, name, exchange

        Returns:
            Number of metrics stored
        """
        db = get_db_session()
        stored_count = 0

        try:
            timestamp = datetime.utcnow()
            account_name = account['name']
            account_id = account['id']
            exchange = account['exchange']

            # Create unique monitor ID prefix for this account
            id_prefix = f'{exchange}_account_{account_id}'

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

                logger.info(f"[{exchange}] {account_name} Account Value: ${account_data['account_value']:,.2f}")

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

                    logger.debug(f"[{exchange}] {account_name} {symbol} Position: {size:+.4f}")

            db.commit()
            return stored_count

        except Exception as e:
            logger.error(f"[{account['exchange']}] Error storing account data for {account['name']}: {e}")
            db.rollback()
            return 0

        finally:
            db.close()
