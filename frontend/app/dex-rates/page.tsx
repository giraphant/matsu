'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ArrowUpDown } from 'lucide-react';
import { getApiUrl } from "@/lib/api-config";

interface FundingRateData {
  exchange: string;
  symbol: string;
  rate: number;
  annualized_rate: number;
  next_funding_time: string | null;
  mark_price: number | null;
  timestamp: string;
}

interface SpotPriceData {
  exchange: string;
  symbol: string;
  price: number;
  volume_24h: number | null;
  timestamp: string;
}

type SortColumn = 'symbol' | 'spread' | 'lighter' | 'aster' | 'grvt' | 'backpack' | 'binance' | 'bybit' | 'hyperliquid';

export default function DexRatesPage() {
  const [fundingRates, setFundingRates] = useState<FundingRateData[]>([]);
  const [spotPrices, setSpotPrices] = useState<SpotPriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filters and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortColumn>('spread');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [enabledExchanges, setEnabledExchanges] = useState<Set<string>>(
    new Set(['lighter', 'aster', 'grvt', 'backpack', 'binance', 'bybit', 'hyperliquid'])
  );

  const exchanges = ['lighter', 'aster', 'grvt', 'backpack', 'binance', 'bybit', 'hyperliquid'];

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      if (!loading) setRefreshing(true);

      const [fundingRes, spotRes] = await Promise.all([
        fetch(getApiUrl('/api/trading/funding-rates')),
        fetch(getApiUrl('/api/trading/spot-prices'))
      ]);

      if (fundingRes.ok) {
        const fundingData = await fundingRes.json();
        setFundingRates(fundingData);
      }

      if (spotRes.ok) {
        const spotData = await spotRes.json();
        setSpotPrices(spotData);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch trading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Group rates by symbol
  const groupedRates = useMemo(() => {
    return fundingRates.reduce((acc, rate) => {
      if (!acc[rate.symbol]) {
        acc[rate.symbol] = {};
      }
      acc[rate.symbol][rate.exchange] = rate.annualized_rate;
      return acc;
    }, {} as Record<string, Record<string, number>>);
  }, [fundingRates]);

  // Check which symbols have Binance spot
  const binanceSpotSymbols = useMemo(() => {
    const symbols = new Set<string>();
    spotPrices.forEach(spot => {
      if (spot.exchange === 'binance') {
        symbols.add(spot.symbol);
      }
    });
    return symbols;
  }, [spotPrices]);

  // Filter and sort symbols
  const processedSymbols = useMemo(() => {
    // Get all symbols
    let symbols = Object.keys(groupedRates);

    // Filter by search term
    if (searchTerm) {
      symbols = symbols.filter(symbol =>
        symbol.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter: require at least 2 exchanges with data
    symbols = symbols.filter(symbol => {
      const rates = groupedRates[symbol];
      const validRates = Object.values(rates).filter(r => r !== null && r !== undefined && !isNaN(r));
      return validRates.length >= 2;
    });

    // Calculate spreads and sort
    const symbolsWithSpreads = symbols.map(symbol => {
      const rates = groupedRates[symbol];
      const enabledRates = exchanges
        .filter(ex => enabledExchanges.has(ex))
        .map(ex => rates[ex])
        .filter(r => r !== null && r !== undefined && !isNaN(r));

      const spread = enabledRates.length >= 2
        ? Math.max(...enabledRates) - Math.min(...enabledRates)
        : null;

      return { symbol, spread, rates };
    });

    // Sort
    symbolsWithSpreads.sort((a, b) => {
      let compareValue = 0;

      if (sortBy === 'symbol') {
        compareValue = a.symbol.localeCompare(b.symbol);
      } else if (sortBy === 'spread') {
        // Prioritize symbols with all enabled exchanges
        const aHasAll = exchanges.every(ex =>
          !enabledExchanges.has(ex) || (a.rates[ex] !== null && a.rates[ex] !== undefined && !isNaN(a.rates[ex]))
        );
        const bHasAll = exchanges.every(ex =>
          !enabledExchanges.has(ex) || (b.rates[ex] !== null && b.rates[ex] !== undefined && !isNaN(b.rates[ex]))
        );

        if (aHasAll && !bHasAll) return -1;
        if (!aHasAll && bHasAll) return 1;

        // Sort by spread
        if (a.spread === null && b.spread === null) return 0;
        if (a.spread === null) return 1;
        if (b.spread === null) return -1;
        compareValue = a.spread - b.spread;
      } else {
        // Sort by specific exchange
        const rateA = a.rates[sortBy];
        const rateB = b.rates[sortBy];

        if ((rateA === null || rateA === undefined || isNaN(rateA)) &&
            (rateB === null || rateB === undefined || isNaN(rateB))) return 0;
        if (rateA === null || rateA === undefined || isNaN(rateA)) return 1;
        if (rateB === null || rateB === undefined || isNaN(rateB)) return -1;
        compareValue = rateA - rateB;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return symbolsWithSpreads;
  }, [groupedRates, searchTerm, sortBy, sortOrder, enabledExchanges, exchanges]);

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'symbol' ? 'asc' : 'desc');
    }
  };

  const toggleExchange = (exchange: string) => {
    const newEnabled = new Set(enabledExchanges);
    if (newEnabled.has(exchange)) {
      newEnabled.delete(exchange);
    } else {
      newEnabled.add(exchange);
    }
    setEnabledExchanges(newEnabled);
  };

  const formatRate = (rate: number | null | undefined): string => {
    if (rate === null || rate === undefined || isNaN(rate)) return 'N/A';
    const sign = rate >= 0 ? '+' : '';
    return `${sign}${rate.toFixed(4)}%`;
  };

  const getRateColor = (rate: number | null | undefined): string => {
    if (rate === null || rate === undefined || isNaN(rate)) return 'text-muted-foreground';
    return rate >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DEX Funding Rates</h1>
          <p className="text-muted-foreground">
            Compare funding rates across {exchanges.length} exchanges
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            onClick={() => fetchData()}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Search */}
          <div>
            <Input
              type="text"
              placeholder="Search symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {/* Exchange filters */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Exchanges:</span>
            {exchanges.map(exchange => (
              <label key={exchange} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabledExchanges.has(exchange)}
                  onChange={() => toggleExchange(exchange)}
                  className="w-4 h-4"
                />
                <span className="text-sm capitalize">{exchange}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th
                    onClick={() => handleSort('symbol')}
                    className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none"
                  >
                    <div className="flex items-center gap-2">
                      Symbol
                      {sortBy === 'symbol' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  {exchanges.filter(ex => enabledExchanges.has(ex)).map(exchange => (
                    <th
                      key={exchange}
                      onClick={() => handleSort(exchange as SortColumn)}
                      className="text-right py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none capitalize"
                    >
                      <div className="flex items-center justify-end gap-2">
                        {exchange === 'backpack' ? 'BP' : exchange}
                        {sortBy === exchange && (
                          <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th
                    onClick={() => handleSort('spread')}
                    className="text-right py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50 select-none"
                  >
                    <div className="flex items-center justify-end gap-2">
                      Spread
                      {sortBy === 'spread' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && processedSymbols.length === 0 ? (
                  <tr>
                    <td colSpan={exchanges.filter(ex => enabledExchanges.has(ex)).length + 2} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : processedSymbols.length === 0 ? (
                  <tr>
                    <td colSpan={exchanges.filter(ex => enabledExchanges.has(ex)).length + 2} className="text-center py-8 text-muted-foreground">
                      No symbols found
                    </td>
                  </tr>
                ) : (
                  processedSymbols.map(({ symbol, spread, rates }) => (
                    <tr key={symbol} className="border-b hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{symbol}</span>
                          {binanceSpotSymbols.has(symbol) && (
                            <span
                              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-white text-[10px] font-bold"
                              title="Has Binance spot trading"
                            >
                              ✓
                            </span>
                          )}
                        </div>
                      </td>
                      {exchanges.filter(ex => enabledExchanges.has(ex)).map(exchange => (
                        <td key={exchange} className={`text-right py-3 px-4 font-mono ${getRateColor(rates[exchange])}`}>
                          {formatRate(rates[exchange])}
                        </td>
                      ))}
                      <td className="text-right py-3 px-4 font-mono font-bold text-orange-600 dark:text-orange-400">
                        {spread !== null ? `${spread.toFixed(4)}%` : 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-sm text-muted-foreground">
        Showing {processedSymbols.length} symbols •
        <span className="ml-1">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-white text-[10px] font-bold mx-1">✓</span>
          = Has Binance spot trading
        </span>
      </div>
    </div>
  );
}
