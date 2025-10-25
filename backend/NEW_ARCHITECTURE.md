# New Background Tasks Architecture

## Philosophy

**Organize by EXCHANGE, coordinate by FUNCTION**

- Each exchange file contains ALL its capabilities (funding, spot, account)
- Coordinator tasks (funding_monitor, spot_monitor) orchestrate across exchanges
- Clear separation: Exchange adapters = data fetching, Monitors = orchestration + storage

## Directory Structure

```
app/background_tasks/
│
├── base.py                         # BaseMonitor (task loop)
│
├── funding_monitor.py              # 主任务：Funding rates coordinator
├── spot_monitor.py                 # 主任务：Spot prices coordinator
│
├── exchanges/                      # 交易所适配器（按交易所组织）
│   ├── __init__.py
│   ├── base.py                     # BaseExchangeAdapter
│   │
│   ├── binance.py                  # Binance: funding + spot
│   ├── bybit.py                    # Bybit: funding + spot
│   ├── hyperliquid.py              # Hyperliquid: funding only
│   ├── lighter.py                  # Lighter: funding + account
│   ├── aster.py                    # Aster: funding only
│   ├── grvt.py                     # GRVT: funding only
│   ├── backpack.py                 # Backpack: funding only
│   │
│   ├── okx.py                      # OKX: spot only
│   ├── jupiter.py                  # Jupiter: spot only (Solana)
│   └── pyth.py                     # Pyth: spot only (Oracle)
│
├── lighter_account.py              # Account monitors (separate concern)
├── jlp_hedge_monitor.py            # Position calculators
├── alp_hedge_monitor.py
│
└── workers/                        # Other workers
    ├── monitor_alert_checker.py
    ├── monitor_recompute_worker.py
    ├── heartbeat_checker.py
    └── database_downsampler.py
```

## Key Components

### 1. Exchange Adapters (`exchanges/`)

**Purpose**: Fetch data from exchange APIs

**Responsibilities**:
- Know the exchange's API endpoints
- Parse exchange-specific response formats
- Return standardized data structures
- Handle exchange-specific quirks

**Example** (`exchanges/binance.py`):
```python
class BinanceAdapter(BaseExchangeAdapter):
    """All Binance functionality in one place."""

    FUNDING_API = "https://fapi.binance.com/..."
    SPOT_API = "https://api.binance.com/..."

    async def fetch_funding_rates(self) -> List[Dict]:
        # Fetch from Binance Futures API
        # Return standardized format

    async def fetch_spot_prices(self) -> List[Dict]:
        # Fetch from Binance Spot API
        # Return standardized format
```

**Benefits**:
- ✅ One file = one exchange's complete documentation
- ✅ Easy to add/remove exchanges
- ✅ Share HTTP client, auth, rate limiting per exchange
- ✅ Clear ownership

### 2. Coordinator Monitors

**Purpose**: Orchestrate data collection across all exchanges

**`funding_monitor.py`**:
```python
class FundingRateMonitor(BaseMonitor):
    """Coordinates funding rate collection from all exchanges."""

    EXCHANGES = [
        BinanceAdapter,
        BybitAdapter,
        HyperliquidAdapter,
        # ... more
    ]

    async def run(self):
        for ExchangeCls in self.EXCHANGES:
            adapter = ExchangeCls()
            rates = await adapter.fetch_funding_rates()
            await self._store_rates(adapter.exchange_name, rates)
```

**`spot_monitor.py`**:
```python
class SpotPriceMonitor(BaseMonitor):
    """Coordinates spot price collection from all exchanges."""

    EXCHANGES = [
        BinanceAdapter,
        BybitAdapter,
        OKXAdapter,
        # ... more
    ]

    async def run(self):
        for ExchangeCls in self.EXCHANGES:
            adapter = ExchangeCls()
            prices = await adapter.fetch_spot_prices()
            await self._store_prices(adapter.exchange_name, prices)
```

**Benefits**:
- ✅ Single place to see which exchanges provide funding rates
- ✅ Single place to see which exchanges provide spot prices
- ✅ Unified error handling and retry logic
- ✅ Centralized database storage logic
- ✅ Easy to enable/disable exchanges

## Comparison: Old vs New

### Old Architecture (Current)

```
app/background_tasks/
├── binance_funding.py      (140 lines)
├── binance_spot.py         (120 lines)
├── bybit_funding.py        (158 lines)
├── bybit_spot.py           (115 lines)
├── hyperliquid_funding.py  (146 lines)
├── lighter_funding.py      (127 lines)
├── aster_funding.py        (181 lines)
├── grvt_funding.py         (189 lines)
├── backpack_funding.py     (145 lines)
├── okx_spot.py             (110 lines)
├── jupiter_spot.py         (130 lines)
└── pyth_spot.py            (125 lines)

Total: ~1800 lines
```

**Problems**:
- ❌ Binance functionality split across 2 files
- ❌ Bybit functionality split across 2 files
- ❌ Each file has duplicated storage/error handling
- ❌ Hard to see "which exchanges support funding rates?"
- ❌ Hard to see "what does Binance provide?"

### New Architecture (Proposed)

```
app/background_tasks/
├── funding_monitor.py          (130 lines) - coordinates all funding
├── spot_monitor.py             (130 lines) - coordinates all spot
│
└── exchanges/
    ├── binance.py              (140 lines) - all Binance features
    ├── bybit.py                (150 lines) - all Bybit features
    ├── hyperliquid.py          (70 lines)  - funding only
    ├── lighter.py              (80 lines)  - funding only
    ├── aster.py                (90 lines)  - funding only
    ├── grvt.py                 (95 lines)  - funding only
    ├── backpack.py             (75 lines)  - funding only
    ├── okx.py                  (60 lines)  - spot only
    ├── jupiter.py              (70 lines)  - spot only
    └── pyth.py                 (65 lines)  - spot only

Total: ~1155 lines (36% reduction)
```

**Benefits**:
- ✅ All Binance code in `binance.py`
- ✅ All Bybit code in `bybit.py`
- ✅ Storage logic in 2 places (funding_monitor, spot_monitor)
- ✅ Easy to answer: "Which exchanges support funding?" → Look at funding_monitor.py
- ✅ Easy to answer: "What does Binance provide?" → Look at binance.py

## Migration Strategy

### Phase 1: Create New Structure (Non-Breaking)
- ✅ Create `exchanges/` directory
- ✅ Create `funding_monitor.py` and `spot_monitor.py`
- ✅ Implement `BinanceAdapter` as proof-of-concept
- ⬜ Test in isolation (don't register with startup yet)

### Phase 2: Parallel Testing
- ⬜ Run old monitors AND new monitors simultaneously
- ⬜ Compare data stored by both
- ⬜ Verify no regressions

### Phase 3: Gradual Migration
- ⬜ Migrate one exchange at a time (start with Binance)
- ⬜ Disable old monitor, enable new adapter
- ⬜ Monitor logs for 24 hours
- ⬜ Repeat for next exchange

### Phase 4: Cleanup
- ⬜ Remove old `*_funding.py` and `*_spot.py` files
- ⬜ Update `startup.py` imports
- ⬜ Update documentation
- ⬜ Archive old code

## Startup Configuration

### Old (startup.py):
```python
from app.background_tasks import (
    LighterMonitor, AsterMonitor, GRVTMonitor, BackpackMonitor,
    BinanceMonitor, BybitMonitor, HyperliquidMonitor,
    BinanceSpotMonitor, OKXSpotMonitor, BybitSpotMonitor,
    JupiterSpotMonitor, PythSpotMonitor,
    # ... 13 imports
)

# Create 13 monitor instances
self.monitors.append(LighterMonitor())
self.monitors.append(AsterMonitor())
# ... 11 more
```

### New (startup.py):
```python
from app.background_tasks.funding_monitor import FundingRateMonitor
from app.background_tasks.spot_monitor import SpotPriceMonitor

# Create 2 coordinator monitors
self.monitors.append(FundingRateMonitor(interval=300))  # 5 min
self.monitors.append(SpotPriceMonitor(interval=60))     # 1 min
```

**Benefit**: Startup code becomes much simpler!

## Adding a New Exchange

### Old Approach:
1. Copy `binance_funding.py` → `newexchange_funding.py`
2. Modify API endpoints and parsing logic
3. Add import to `__init__.py`
4. Add to `startup.py`
5. If exchange has spot: repeat for `newexchange_spot.py`

**Result**: 2 new files, ~280 lines

### New Approach:
1. Create `exchanges/newexchange.py`
2. Implement `fetch_funding_rates()` and/or `fetch_spot_prices()`
3. Add to `EXCHANGES` list in `funding_monitor.py` or `spot_monitor.py`

**Result**: 1 new file, ~100 lines

## Execution Model

### OLD: Parallel Independent Monitors
- 13 separate asyncio tasks running
- Each fetches from one exchange
- Each stores to database independently

### NEW: 2 Coordinators with Sequential Processing
- 2 asyncio tasks (funding_monitor, spot_monitor)
- Each coordinator loops through exchanges sequentially
- Still stores to database per-exchange

**Question**: Should coordinators fetch in parallel?

**Answer**: Can optimize later:
```python
# Sequential (current)
for adapter in self.adapters:
    rates = await adapter.fetch_funding_rates()
    await self._store_rates(adapter.exchange_name, rates)

# Parallel (future optimization)
tasks = [adapter.fetch_funding_rates() for adapter in self.adapters]
results = await asyncio.gather(*tasks, return_exceptions=True)
for adapter, rates in zip(self.adapters, results):
    if isinstance(rates, Exception):
        logger.error(f"[{adapter.exchange_name}] Failed: {rates}")
    else:
        await self._store_rates(adapter.exchange_name, rates)
```

**Recommendation**: Start sequential, optimize to parallel later if needed.

## Files Created

### Core Architecture:
- `exchanges/__init__.py` - Package exports
- `exchanges/base.py` - BaseExchangeAdapter
- `exchanges/binance.py` - Full Binance implementation (example)
- `funding_monitor.py` - Funding rates coordinator
- `spot_monitor.py` - Spot prices coordinator

### Stubs (to be implemented):
- `exchanges/bybit.py`
- `exchanges/hyperliquid.py`
- `exchanges/lighter.py`
- `exchanges/aster.py`
- `exchanges/grvt.py`
- `exchanges/backpack.py`
- `exchanges/okx.py`
- `exchanges/jupiter.py`
- `exchanges/pyth.py`

## Next Steps

1. **Review** this architecture proposal
2. **Test** BinanceAdapter works correctly
3. **Decide** on migration timeline
4. **Implement** remaining adapters one by one
5. **Deploy** gradually with monitoring

## Summary

✅ **Better organization**: Exchange-centric file structure
✅ **Less duplication**: 36% code reduction
✅ **Easier maintenance**: Change storage logic in 2 places, not 13
✅ **Better discoverability**: "What does Binance do?" → look at binance.py
✅ **Simpler startup**: 2 monitors instead of 13
✅ **Future-proof**: Easy to add exchanges or new data types
