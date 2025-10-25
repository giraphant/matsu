# Funding Rate Monitors Refactoring Proposal

## Current Architecture Issues

### Problems:
1. **Code Duplication**: Each exchange monitor has ~140-180 lines, with 60-70% duplicated code
2. **Maintenance Burden**: Bug fixes or improvements require updating 7 separate files
3. **Inconsistency Risk**: Easy to have different error handling or logging across exchanges
4. **Testing Overhead**: Need to test the same logic 7 times

### Current Statistics:
```
Lighter:     127 lines
Binance:     140 lines
Bybit:       158 lines
Hyperliquid: 146 lines
Backpack:    145 lines
Aster:       181 lines
GRVT:        189 lines
---
TOTAL:      1086 lines (with ~65% duplication)
```

## Proposed Architecture

### Design Principles:
1. ✅ **Keep Parallel Execution**: Each exchange runs independently (fault isolation)
2. ✅ **Extract Common Logic**: Create `BaseFundingRateMonitor` base class
3. ✅ **Simplify Subclasses**: Exchange monitors only implement API-specific logic

### New Structure:

```
BaseFundingRateMonitor (funding_base.py)
├── Common run() loop
├── Database storage logic
├── Error handling & logging
├── HTTP helpers (_http_get, _http_post)
└── Rate conversion utilities (annualize_8h_rate, annualize_1h_rate)

Exchange Monitors (subclasses)
└── fetch_funding_rates() - Only API-specific parsing
```

### Code Reduction:

| Exchange | Original | Refactored | Reduction |
|----------|----------|------------|-----------|
| Binance | 140 lines | 91 lines | **35%** |
| Hyperliquid | 146 lines | 66 lines | **54%** |
| Estimated Total | 1086 lines | ~650 lines | **40%** |

## Benefits

### 1. Easier Maintenance
- Fix a bug once in `BaseFundingRateMonitor`, all exchanges benefit
- Consistent error handling and retry logic
- Unified logging format

### 2. Faster Development
- Adding a new exchange: ~60 lines instead of ~150 lines
- Only need to implement `fetch_funding_rates()`
- All boilerplate handled by base class

### 3. Better Testing
- Test common logic once in base class
- Exchange tests only need to verify API parsing
- Easier to mock HTTP requests

### 4. Improved Reliability
- Standardized error recovery
- Consistent rate normalization (8-hour standard)
- Built-in HTTP timeout handling

## Implementation Example

### Before (140 lines):
```python
class BinanceMonitor(BaseMonitor):
    def __init__(self):
        super().__init__(name="Binance Funding Rates", interval=300)
        self.api_url = "https://fapi.binance.com/fapi/v1/premiumIndex"

    async def run(self):
        # Boilerplate logging
        # Fetch data
        # Store data
        # Error handling
        # More boilerplate...

    async def _fetch_funding_rates(self):
        # HTTP request logic
        # Response parsing
        # ...

    async def _store_rates(self, rates):
        # Database logic (duplicated across all monitors)
        # ...

    @staticmethod
    def _annualize_rate(rate_8h):
        # Same calculation in every monitor
        # ...
```

### After (91 lines):
```python
class BinanceMonitor(BaseFundingRateMonitor):
    def __init__(self):
        super().__init__(
            exchange_name="binance",
            api_url="https://fapi.binance.com/fapi/v1/premiumIndex",
            interval=300
        )

    async def fetch_funding_rates(self):
        # ONLY exchange-specific API parsing
        data = await self._http_get(self.api_url)

        rates = []
        for item in data:
            if item["symbol"] in TARGET_SYMBOLS:
                rates.append({
                    "symbol": normalize_symbol(item["symbol"]),
                    "rate": float(item["lastFundingRate"]),
                    "annualized_rate": self.annualize_8h_rate(float(item["lastFundingRate"])),
                    "mark_price": float(item["markPrice"]),
                    "next_funding_time": parse_timestamp(item["nextFundingTime"])
                })

        return rates
```

## Migration Strategy

### Phase 1: Add Base Class (Non-Breaking)
- Add `funding_base.py` with `BaseFundingRateMonitor`
- Add refactored versions as `*_funding_refactored.py`
- Keep existing monitors running

### Phase 2: Test in Parallel
- Run both old and new monitors side-by-side
- Compare stored data for consistency
- Monitor for any differences

### Phase 3: Gradual Cutover
- Switch one exchange at a time
- Monitor logs for issues
- Easy rollback if needed

### Phase 4: Cleanup
- Remove old monitor files
- Update imports in `startup.py`
- Archive old code for reference

## Recommendation

**YES, refactor is strongly recommended** because:

1. ✅ **Parallel execution is preserved** - No loss of fault isolation
2. ✅ **Significant code reduction** - 40% less code to maintain
3. ✅ **Better abstraction** - Clear separation of concerns
4. ✅ **Future-proof** - Easy to add new exchanges
5. ✅ **Low risk** - Can be done incrementally

The current architecture works, but doesn't scale well as you add more exchanges. With 7 exchanges already and potentially more coming, the maintenance burden will only grow.

## Files Created

- `app/background_tasks/funding_base.py` - Base class implementation
- `app/background_tasks/binance_funding_refactored.py` - Example refactor
- `app/background_tasks/hyperliquid_funding_refactored.py` - Simpler example

These can be reviewed and tested before committing to the full migration.
