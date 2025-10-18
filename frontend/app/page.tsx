'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertCircle,
  TrendingUp,
  Bell,
  ArrowUpRight,
  DollarSign,
  Wallet,
  Tag,
  Flame,
  Target,
  TrendingDown
} from 'lucide-react';
import { getMonitors, getActiveAlerts, getDexFundingRates, getAlertHistory } from '@/lib/api';
import type { Monitor, FundingRate } from '@/lib/api';
import Link from 'next/link';

export default function OverviewPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [alertHistory, setAlertHistory] = useState<any[]>([]);
  const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel
        const [monitorsData, alertsData, fundingData, historyData] = await Promise.all([
          getMonitors().catch(() => []),
          getActiveAlerts().catch(() => []),
          getDexFundingRates().catch(() => ({ rates: [] })),
          getAlertHistory(100).catch(() => [])
        ]);

        setMonitors(monitorsData);
        setActiveAlerts(alertsData);
        setFundingRates(fundingData.rates || []);
        setAlertHistory(historyData);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate statistics
  const activeMonitors = monitors.filter(m => m.enabled).length;

  // Get all unique tags from monitors
  const getTagStats = () => {
    const tagMap = new Map<string, number>();
    monitors.forEach(monitor => {
      if (monitor.tags && Array.isArray(monitor.tags)) {
        monitor.tags.forEach(tag => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        });
      }
    });
    return Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  };

  // Calculate alert statistics
  const getAlertStats = () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayAlerts = alertHistory.filter(a => new Date(a.triggered_at) >= todayStart).length;
    const weekAlerts = alertHistory.filter(a => new Date(a.triggered_at) >= weekStart).length;

    return { todayAlerts, weekAlerts };
  };

  // Get top 3 key monitors (highest absolute values)
  const getKeyMonitors = () => {
    return monitors
      .filter(m => m.enabled && m.value !== null && m.value !== undefined)
      .sort((a, b) => Math.abs(b.value || 0) - Math.abs(a.value || 0))
      .slice(0, 3);
  };

  const tagStats = getTagStats();
  const { todayAlerts, weekAlerts } = getAlertStats();
  const keyMonitors = getKeyMonitors();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Monitor your system performance and trading opportunities in real-time
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-destructive">
          {error}
        </div>
      )}

      {/* Bento Grid Layout */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Active Monitors */}
        <Card className="group hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Monitors</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : activeMonitors}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {monitors.length} total
            </p>
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card className="group hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground group-hover:text-yellow-500 transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : activeAlerts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeAlerts.length === 0 ? 'All clear' : 'Needs attention'}
            </p>
          </CardContent>
        </Card>

        {/* Alert History */}
        <Card className="group hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alert History</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : todayAlerts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Today • {weekAlerts} this week
            </p>
          </CardContent>
        </Card>

        {/* Tag Overview */}
        <Card className="group hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tag Groups</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : tagStats.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {tagStats.length === 0 ? 'No tags yet' : `${tagStats[0]?.tag} (${tagStats[0]?.count})`}
            </p>
          </CardContent>
        </Card>

        {/* Top Funding Rates - Spans 2 columns */}
        <Card className="md:col-span-2 lg:col-span-2 group hover:shadow-lg transition-all duration-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Funding Rates</CardTitle>
                <CardDescription>Highest opportunities across exchanges</CardDescription>
              </div>
              <Link href="/dex-rates" prefetch={false}>
                <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                  View All <ArrowUpRight className="ml-1 h-3 w-3" />
                </Badge>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">Loading rates...</div>
            ) : fundingRates.length === 0 ? (
              <div className="text-muted-foreground">No funding rates available</div>
            ) : (
              <div className="space-y-3">
                {fundingRates
                  .filter(r => r.rate !== null)
                  .sort((a, b) => (b.rate || 0) - (a.rate || 0))
                  .slice(0, 3)
                  .map((rate, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-green-500' : idx === 1 ? 'bg-blue-500' : 'bg-yellow-500'}`} />
                        <div>
                          <div className="font-medium">{rate.symbol}</div>
                          <div className="text-sm text-muted-foreground">{rate.exchange.toUpperCase()}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{((rate.rate || 0) * 100).toFixed(4)}%</div>
                        {rate.has_binance_spot && (
                          <Badge variant="outline" className="text-xs">Spot</Badge>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tag Distribution - Spans 2 columns */}
        <Card className="md:col-span-2 lg:col-span-2 group hover:shadow-lg transition-all duration-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Monitors by Tag</CardTitle>
                <CardDescription>Distribution across categories</CardDescription>
              </div>
              <Link href="/monitors" prefetch={false}>
                <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                  View All <ArrowUpRight className="ml-1 h-3 w-3" />
                </Badge>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : tagStats.length === 0 ? (
              <div className="text-muted-foreground">No tags configured</div>
            ) : (
              <div className="space-y-2">
                {tagStats.map((stat, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{stat.tag}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{stat.count} monitors</span>
                      <div className="w-24 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2"
                          style={{ width: `${(stat.count / monitors.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <Card className="lg:col-span-2 group hover:shadow-lg transition-all duration-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Key Metrics</CardTitle>
                <CardDescription>Top monitors by value</CardDescription>
              </div>
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : keyMonitors.length === 0 ? (
              <div className="text-muted-foreground">No active monitors with values</div>
            ) : (
              <div className="space-y-3">
                {keyMonitors.map((monitor, idx) => (
                  <div key={monitor.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                      <div>
                        <div className="font-medium">{monitor.name}</div>
                        {monitor.tags && monitor.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {monitor.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-lg">
                        {monitor.value?.toFixed(monitor.decimal_places)}
                      </div>
                      {monitor.unit && (
                        <div className="text-xs text-muted-foreground">{monitor.unit}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Monitors */}
        <Card className="lg:col-span-2 group hover:shadow-lg transition-all duration-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Monitors</CardTitle>
                <CardDescription>Live monitor status</CardDescription>
              </div>
              <Link href="/monitors" prefetch={false}>
                <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                  View All <ArrowUpRight className="ml-1 h-3 w-3" />
                </Badge>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">Loading monitors...</div>
            ) : monitors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Wallet className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No monitors configured</p>
                <Link href="/monitors" prefetch={false}>
                  <Badge variant="outline" className="mt-2 cursor-pointer">Configure →</Badge>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {monitors.filter(m => m.enabled).slice(0, 5).map((monitor) => (
                  <div key={monitor.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <div>
                        <div className="font-medium">{monitor.name}</div>
                        {monitor.tags && monitor.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {monitor.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {monitor.value !== undefined && monitor.value !== null ? (
                        <>
                          <div className="font-mono font-bold">
                            {monitor.value.toFixed(monitor.decimal_places)}
                          </div>
                          {monitor.unit && (
                            <div className="text-xs text-muted-foreground">{monitor.unit}</div>
                          )}
                        </>
                      ) : (
                        <Badge variant="outline">No data</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="group hover:shadow-lg transition-all duration-200">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Link href="/monitors" prefetch={false}>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  <span className="text-sm">View Monitors</span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/settings?tab=general" prefetch={false}>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span className="text-sm">Configure Alerts</span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/settings?tab=funding" prefetch={false}>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm">Funding Alerts</span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/dex-rates" prefetch={false}>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm">View DEX Rates</span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
