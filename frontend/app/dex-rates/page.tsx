'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
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

export default function TradingPage() {
  const [fundingRates, setFundingRates] = useState<FundingRateData[]>([]);
  const [spotPrices, setSpotPrices] = useState<SpotPriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("funding");
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

  // Group funding rates by symbol
  const fundingBySymbol = fundingRates.reduce((acc, rate) => {
    if (!acc[rate.symbol]) acc[rate.symbol] = [];
    acc[rate.symbol].push(rate);
    return acc;
  }, {} as Record<string, FundingRateData[]>);

  // Group spot prices by symbol
  const spotBySymbol = spotPrices.reduce((acc, price) => {
    if (!acc[price.symbol]) acc[price.symbol] = [];
    acc[price.symbol].push(price);
    return acc;
  }, {} as Record<string, SpotPriceData[]>);

  const symbols = ['BTC', 'ETH', 'SOL'];

  // Calculate price spreads
  const calculateSpread = (symbol: string) => {
    const prices = spotBySymbol[symbol] || [];
    if (prices.length < 2) return null;

    const priceValues = prices.map(p => p.price);
    const maxPrice = Math.max(...priceValues);
    const minPrice = Math.min(...priceValues);
    const spreadPercent = ((maxPrice - minPrice) / minPrice) * 100;

    return {
      maxPrice,
      minPrice,
      spread: maxPrice - minPrice,
      spreadPercent,
      maxExchange: prices.find(p => p.price === maxPrice)?.exchange,
      minExchange: prices.find(p => p.price === minPrice)?.exchange
    };
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trading Monitor</h1>
          <p className="text-muted-foreground">
            Monitor funding rates and spot price spreads across exchanges
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
          <TabsTrigger value="funding">Funding Rates</TabsTrigger>
          <TabsTrigger value="spot">Spot Spreads</TabsTrigger>
        </TabsList>

        {/* Funding Rates Tab */}
        <TabsContent value="funding" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {symbols.map(symbol => {
              const rates = fundingBySymbol[symbol] || [];
              const avgRate = rates.length > 0
                ? rates.reduce((sum, r) => sum + r.annualized_rate, 0) / rates.length
                : 0;

              return (
                <Card key={symbol}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{symbol} Funding Rates</CardTitle>
                    <CardDescription>Annualized rates across exchanges</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-4">
                      {avgRate.toFixed(2)}%
                    </div>
                    <div className="space-y-2">
                      {rates.sort((a, b) => b.annualized_rate - a.annualized_rate).map((rate, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <span className="font-medium capitalize">{rate.exchange}</span>
                          <span className={rate.annualized_rate > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {rate.annualized_rate.toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Detailed Funding Rates */}
          {symbols.map(symbol => {
            const rates = fundingBySymbol[symbol] || [];
            if (rates.length === 0) return null;

            return (
              <Card key={symbol}>
                <CardHeader>
                  <CardTitle>{symbol} Detailed Rates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    {rates.sort((a, b) => b.annualized_rate - a.annualized_rate).map((rate, idx) => (
                      <div key={idx} className="border rounded-lg p-3 space-y-1">
                        <div className="font-semibold capitalize">{rate.exchange}</div>
                        <div className="text-2xl font-bold">
                          {rate.annualized_rate.toFixed(2)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          8h: {(rate.rate * 100).toFixed(4)}%
                        </div>
                        {rate.mark_price && (
                          <div className="text-xs text-muted-foreground">
                            Mark: ${rate.mark_price.toLocaleString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Spot Spreads Tab */}
        <TabsContent value="spot" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {symbols.map(symbol => {
              const spread = calculateSpread(symbol);
              if (!spread) return null;

              return (
                <Card key={symbol}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{symbol} Price Spread</CardTitle>
                    <CardDescription>Across CEX exchanges</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-4">
                      {spread.spreadPercent > 0 ? (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      )}
                      <div className="text-3xl font-bold">
                        {spread.spreadPercent.toFixed(3)}%
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">High:</span>
                        <span className="font-medium">
                          ${spread.maxPrice.toLocaleString()} ({spread.maxExchange})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Low:</span>
                        <span className="font-medium">
                          ${spread.minPrice.toLocaleString()} ({spread.minExchange})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Spread:</span>
                        <span className="font-medium">${spread.spread.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Detailed Spot Prices */}
          {symbols.map(symbol => {
            const prices = spotBySymbol[symbol] || [];
            if (prices.length === 0) return null;

            return (
              <Card key={symbol}>
                <CardHeader>
                  <CardTitle>{symbol} Spot Prices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {prices.sort((a, b) => b.price - a.price).map((price, idx) => (
                      <div key={idx} className="border rounded-lg p-3 space-y-1">
                        <div className="font-semibold capitalize">{price.exchange}</div>
                        <div className="text-2xl font-bold">
                          ${price.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                        {price.volume_24h && (
                          <div className="text-xs text-muted-foreground">
                            Vol: ${(price.volume_24h / 1000000).toFixed(2)}M
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {new Date(price.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading trading data...</p>
          </div>
        </div>
      )}
    </div>
  );
}
