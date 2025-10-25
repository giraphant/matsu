'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
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

interface UnifiedRow {
  symbol: string;
  rates: Record<string, number>; // exchange -> annualized_rate
  hasSpot: Record<string, boolean>; // exchange -> has spot price
  spread: {
    max: number;
    min: number;
    diff: number;
    maxExchange: string;
    minExchange: string;
  } | null;
}

export default function TradingPage() {
  const [fundingRates, setFundingRates] = useState<FundingRateData[]>([]);
  const [spotPrices, setSpotPrices] = useState<SpotPriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("unified");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

  // Build unified table data
  const buildUnifiedData = (): UnifiedRow[] => {
    const symbols = ['BTC', 'ETH', 'SOL'];
    const exchanges = ['lighter', 'aster', 'grvt', 'backpack', 'binance', 'hyperliquid'];

    return symbols.map(symbol => {
      const symbolRates = fundingRates.filter(r => r.symbol === symbol);
      const symbolSpots = spotPrices.filter(p => p.symbol === symbol);

      const rates: Record<string, number> = {};
      const hasSpot: Record<string, boolean> = {};

      // Build rates map
      exchanges.forEach(exchange => {
        const rate = symbolRates.find(r => r.exchange === exchange);
        rates[exchange] = rate ? rate.annualized_rate : NaN;

        // Check if exchange has spot price
        const spot = symbolSpots.find(s => s.exchange === exchange);
        hasSpot[exchange] = !!spot;
      });

      // Calculate spread
      const validRates = Object.entries(rates)
        .filter(([_, value]) => !isNaN(value))
        .map(([exchange, value]) => ({ exchange, value }));

      let spread = null;
      if (validRates.length >= 2) {
        const sorted = validRates.sort((a, b) => b.value - a.value);
        const max = sorted[0];
        const min = sorted[sorted.length - 1];

        spread = {
          max: max.value,
          min: min.value,
          diff: max.value - min.value,
          maxExchange: max.exchange,
          minExchange: min.exchange
        };
      }

      return {
        symbol,
        rates,
        hasSpot,
        spread
      };
    });
  };

  // Calculate top spreads across all symbols
  const getTopSpreads = () => {
    const allSpreads: Array<{
      symbol: string;
      spread: number;
      maxExchange: string;
      minExchange: string;
      maxRate: number;
      minRate: number;
    }> = [];

    const data = buildUnifiedData();
    data.forEach(row => {
      if (row.spread) {
        allSpreads.push({
          symbol: row.symbol,
          spread: row.spread.diff,
          maxExchange: row.spread.maxExchange,
          minExchange: row.spread.minExchange,
          maxRate: row.spread.max,
          minRate: row.spread.min
        });
      }
    });

    return allSpreads.sort((a, b) => b.spread - a.spread);
  };

  const unifiedData = buildUnifiedData();
  const topSpreads = getTopSpreads();
  const exchanges = ['lighter', 'aster', 'grvt', 'backpack', 'binance', 'hyperliquid'];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Funding Rates</h1>
          <p className="text-muted-foreground">
            Monitor funding rates and arbitrage opportunities across exchanges
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            onClick={fetchData}
            disabled={refreshing}
            variant="outline"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="unified">Unified View</TabsTrigger>
          <TabsTrigger value="spreads">Top Spreads</TabsTrigger>
        </TabsList>

        {/* Unified Table View */}
        <TabsContent value="unified" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Funding Rates Comparison</CardTitle>
              <CardDescription>Annualized rates across all exchanges (8-hour normalized)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">Symbol</th>
                      {exchanges.map(exchange => (
                        <th key={exchange} className="text-right py-3 px-4 font-semibold capitalize">
                          {exchange}
                        </th>
                      ))}
                      <th className="text-right py-3 px-4 font-semibold">Spread</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unifiedData.map(row => (
                      <tr key={row.symbol} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-bold">{row.symbol}</td>
                        {exchanges.map(exchange => {
                          const rate = row.rates[exchange];
                          const hasSpotMarket = row.hasSpot[exchange];

                          return (
                            <td key={exchange} className="text-right py-3 px-4">
                              {!isNaN(rate) ? (
                                <div className="flex flex-col items-end gap-1">
                                  <span className={`font-mono ${rate > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {rate.toFixed(2)}%
                                  </span>
                                  {hasSpotMarket && exchange === 'binance' && (
                                    <Badge variant="outline" className="text-xs">Spot</Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="text-right py-3 px-4">
                          {row.spread ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                                {row.spread.diff.toFixed(2)}%
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {row.spread.maxExchange} → {row.spread.minExchange}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Spot</Badge>
                  <span className="text-muted-foreground">Spot market available on Binance</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-orange-600 dark:text-orange-400 font-bold">Spread</span>
                  <span className="text-muted-foreground">Arbitrage opportunity (high → low)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Spreads Tab */}
        <TabsContent value="spreads" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Arbitrage Opportunities</CardTitle>
              <CardDescription>Ranked by funding rate spread across exchanges</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topSpreads.map((item, idx) => (
                  <div
                    key={`${item.symbol}-${idx}`}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`text-2xl font-bold ${idx === 0 ? 'text-orange-500' : idx === 1 ? 'text-orange-400' : 'text-orange-300'}`}>
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-lg">{item.symbol}</div>
                        <div className="text-sm text-muted-foreground">
                          Long on <span className="font-medium capitalize">{item.minExchange}</span> ({item.minRate.toFixed(2)}%)
                          {' '}<span className="mx-1">→</span>{' '}
                          Short on <span className="font-medium capitalize">{item.maxExchange}</span> ({item.maxRate.toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {item.spread.toFixed(2)}%
                      </div>
                      <div className="text-xs text-muted-foreground">APY spread</div>
                    </div>
                  </div>
                ))}
                {topSpreads.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No spreads available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Explanation Card */}
          <Card>
            <CardHeader>
              <CardTitle>How to Use Spreads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <strong>Arbitrage Strategy:</strong> Open a long position on the exchange with lower funding rate,
                and simultaneously open a short position on the exchange with higher funding rate.
              </p>
              <p className="text-muted-foreground">
                The spread represents the annualized profit you could earn from the funding rate differential,
                assuming the spread remains constant. Always account for transaction fees, slippage, and market risks.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
