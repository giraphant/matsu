"""Monitor modules for background tasks."""

from .base import BaseMonitor
# Funding rate monitors
from .lighter_funding import LighterMonitor
from .aster_funding import AsterMonitor
from .grvt_funding import GRVTMonitor
from .backpack_funding import BackpackMonitor
from .binance_funding import BinanceMonitor
from .bybit_funding import BybitMonitor
from .hyperliquid_funding import HyperliquidMonitor
# Spot price monitors
from .binance_spot import BinanceSpotMonitor
from .okx_spot import OKXSpotMonitor
from .bybit_spot import BybitSpotMonitor
from .jupiter_spot import JupiterSpotMonitor
from .pyth_spot import PythSpotMonitor
# Account monitors
from .lighter_account import LighterAccountMonitor
# Position calculators
from .jlp_hedge_monitor import JLPHedgeMonitor
from .alp_hedge_monitor import ALPHedgeMonitor
# Database maintenance
from .database_downsampler import DatabaseDownsampler

__all__ = [
    "BaseMonitor",
    # Funding rates
    "LighterMonitor",
    "AsterMonitor",
    "GRVTMonitor",
    "BackpackMonitor",
    "BinanceMonitor",
    "BybitMonitor",
    "HyperliquidMonitor",
    # Spot prices
    "BinanceSpotMonitor",
    "OKXSpotMonitor",
    "BybitSpotMonitor",
    "JupiterSpotMonitor",
    "PythSpotMonitor",
    # Accounts
    "LighterAccountMonitor",
    # Position calculators
    "JLPHedgeMonitor",
    "ALPHedgeMonitor",
    # Database maintenance
    "DatabaseDownsampler",
]
