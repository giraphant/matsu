"""
DEX funding rate fetchers.
Each DEX has its own fetcher module for better organization.
"""

from .models import FundingRate
from .lighter import fetch_lighter_funding_rates
from .grvt import fetch_grvt_funding_rates
from .backpack import fetch_backpack_funding_rates
from .aster import fetch_aster_funding_rates
from .binance import fetch_binance_funding_info, fetch_binance_spot_symbols, normalize_binance_rates

__all__ = [
    "FundingRate",
    "fetch_lighter_funding_rates",
    "fetch_grvt_funding_rates",
    "fetch_backpack_funding_rates",
    "fetch_aster_funding_rates",
    "fetch_binance_funding_info",
    "fetch_binance_spot_symbols",
    "normalize_binance_rates"
]
