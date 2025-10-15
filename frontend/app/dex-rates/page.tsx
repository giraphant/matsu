'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDexFundingRates, getDexFundingRatesBySymbol } from '@/lib/api';
import type { FundingRate, FundingRatesResponse } from '@/lib/api';

export default function DexRatesPage() {
  const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group rates by symbol
  const groupedRates = fundingRates.reduce((acc, rate) => {
    if (!acc[rate.symbol]) {
      acc[rate.symbol] = [];
    }
    acc[rate.symbol].push(rate);
    return acc;
  }, {} as Record<string, FundingRate[]>);

  // Get unique symbols sorted
  const symbols = Object.keys(groupedRates).sort();

  useEffect(() => {
    fetchRates(false);

    // Refresh data every minute
    const interval = setInterval(() => fetchRates(false), 60000);

    return () => clearInterval(interval);
  }, []);

  async function fetchRates(forceRefresh: boolean) {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      let response: FundingRatesResponse;
      if (selectedSymbol) {
        response = await getDexFundingRatesBySymbol(selectedSymbol, forceRefresh);
      } else {
        response = await getDexFundingRates(forceRefresh);
      }

      setFundingRates(response.rates);
      setLastUpdated(new Date(response.last_updated));

      if (response.error) {
        setError(response.error);
      }
    } catch (err) {
      console.error('Failed to fetch funding rates:', err);
      setError('Failed to load funding rates');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Calculate statistics
  const topFundingRates = [...fundingRates]
    .filter(r => r.rate !== null)
    .sort((a, b) => (b.rate || 0) - (a.rate || 0))
    .slice(0, 5);

  const exchanges = [...new Set(fundingRates.map(r => r.exchange))].sort();

  // Format rate for display
  const formatRate = (rate: number | null): string => {
    if (rate === null) return 'N/A';
    return `${(rate * 100).toFixed(4)}%`;
  };

  const formatAnnualized = (rate: number | null, periodHours?: number): string => {
    if (rate === null) return 'N/A';
    const periodsPerYear = (365 * 24) / (periodHours || 8);
    const annualized = rate * periodsPerYear * 100;
    return `${annualized.toFixed(2)}%`;
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">DEX Funding Rates</h1>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            size="sm"
            onClick={() => fetchRates(true)}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Force Refresh'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-destructive">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Symbols</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{symbols.length}</div>
            <p className="text-xs text-muted-foreground">Across {exchanges.length} exchanges</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Highest Funding</CardTitle>
          </CardHeader>
          <CardContent>
            {topFundingRates[0] ? (
              <>
                <div className="text-2xl font-bold">{formatRate(topFundingRates[0].rate)}</div>
                <p className="text-xs text-muted-foreground">
                  {topFundingRates[0].symbol} on {topFundingRates[0].exchange}
                </p>
              </>
            ) : (
              <div className="text-2xl font-bold">N/A</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Binance Spot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fundingRates.filter(r => r.has_binance_spot).length}
            </div>
            <p className="text-xs text-muted-foreground">Available for spot arbitrage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fundingRates.length}</div>
            <p className="text-xs text-muted-foreground">Total funding rates</p>
          </CardContent>
        </Card>
      </div>

      {/* Symbol Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Symbol</CardTitle>
          <CardDescription>Select a symbol to view rates across all exchanges</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedSymbol === '' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectedSymbol('');
                fetchRates(false);
              }}
            >
              All
            </Button>
            {['BTC', 'ETH', 'SOL', 'ARB', 'OP', 'MATIC'].map(symbol => (
              <Button
                key={symbol}
                variant={selectedSymbol === symbol ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSelectedSymbol(symbol);
                  fetchRates(false);
                }}
              >
                {symbol}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Funding Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Top Funding Rates</CardTitle>
          <CardDescription>Highest funding rates across all exchanges</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !refreshing ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : topFundingRates.length === 0 ? (
            <div className="text-muted-foreground">No data available</div>
          ) : (
            <div className="space-y-2">
              {topFundingRates.map((rate, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {rate.symbol} on {rate.exchange.toUpperCase()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {rate.has_binance_spot && (
                        <span className="mr-2 rounded bg-green-100 dark:bg-green-900 px-1.5 py-0.5 text-xs">
                          Spot Available
                        </span>
                      )}
                      {rate.next_funding_time && (
                        <span>Next: {new Date(rate.next_funding_time).toLocaleTimeString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{formatRate(rate.rate)}</div>
                    <div className="text-xs text-muted-foreground">
                      Annual: {formatAnnualized(rate.rate, rate.funding_period_hours)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rates by Symbol */}
      <Card>
        <CardHeader>
          <CardTitle>Funding Rates by Symbol</CardTitle>
          <CardDescription>
            Compare rates across different exchanges
            {selectedSymbol && ` (Filtered: ${selectedSymbol})`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !refreshing ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : symbols.length === 0 ? (
            <div className="text-muted-foreground">No data available</div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {symbols.map(symbol => {
                const symbolRates = groupedRates[symbol];
                const hasSpot = symbolRates.some(r => r.has_binance_spot);
                const maxRate = Math.max(...symbolRates.map(r => r.rate || 0));
                const minRate = Math.min(...symbolRates.filter(r => r.rate !== null).map(r => r.rate || 0));
                const spread = maxRate - minRate;

                return (
                  <div key={symbol} className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{symbol}</h3>
                        {hasSpot && (
                          <span className="rounded bg-green-100 dark:bg-green-900 px-1.5 py-0.5 text-xs">
                            Spot
                          </span>
                        )}
                      </div>
                      {spread > 0 && (
                        <span className="text-sm text-muted-foreground">
                          Spread: {(spread * 100).toFixed(4)}%
                        </span>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {symbolRates
                        .sort((a, b) => (b.rate || 0) - (a.rate || 0))
                        .map((rate, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded bg-muted/50 p-2 text-sm"
                          >
                            <span className="font-medium">{rate.exchange.toUpperCase()}</span>
                            <span className={rate.rate === maxRate ? 'text-green-600 dark:text-green-400' : ''}>
                              {formatRate(rate.rate)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}