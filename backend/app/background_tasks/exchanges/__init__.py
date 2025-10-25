"""
Exchange adapters for fetching trading data.

Each exchange module contains all functionality for that exchange:
- Funding rates
- Spot prices
- Account data
- etc.

This organization makes it easy to:
1. See all capabilities of an exchange in one file
2. Share HTTP clients and common logic per exchange
3. Add/remove exchanges cleanly
"""

from .binance import BinanceAdapter
from .bybit import BybitAdapter
from .hyperliquid import HyperliquidAdapter
from .lighter import LighterAdapter
from .okx import OKXAdapter
from .jupiter import JupiterAdapter
from .pyth import PythAdapter
from .aster import AsterAdapter
from .grvt import GRVTAdapter
from .backpack import BackpackAdapter

__all__ = [
    "BinanceAdapter",
    "BybitAdapter",
    "HyperliquidAdapter",
    "LighterAdapter",
    "OKXAdapter",
    "JupiterAdapter",
    "PythAdapter",
    "AsterAdapter",
    "GRVTAdapter",
    "BackpackAdapter",
]
