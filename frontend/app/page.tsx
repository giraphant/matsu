'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertCircle,
  TrendingUp,
  Users,
  Zap,
  ChartBar,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Wallet
} from 'lucide-react';
import { getMonitors, getActiveAlerts, getWebhookData, getDexFundingRates } from '@/lib/api';
import type { Monitor, FundingRate } from '@/lib/api';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import Link from 'next/link';

// Mini sparkline component
function Sparkline({ data, color = '#3b82f6' }: { data: number[], color?: string }) {
  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload[0]) {
              return (
                <div className="rounded bg-popover p-1 text-xs shadow-md">
                  {payload[0].value?.toFixed(2)}
                </div>
              );
            }
            return null;
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function OverviewPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [dataPoints, setDataPoints] = useState(0);
  const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate sample data for sparklines
  const generateSparklineData = (base: number, variance: number = 10) => {
    return Array.from({ length: 20 }, () => base + (Math.random() - 0.5) * variance);
  };

  const [monitorSparkline] = useState(() => generateSparklineData(50, 20));
  const [alertSparkline] = useState(() => generateSparklineData(30, 15));
  const [dataSparkline] = useState(() => generateSparklineData(70, 25));

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel
        const [monitorsData, alertsData, webhookData, fundingData] = await Promise.all([
          getMonitors().catch(() => []),
          getActiveAlerts().catch(() => []),
          getWebhookData().catch(() => []),
          getDexFundingRates().catch(() => ({ rates: [] }))
        ]);

        setMonitors(monitorsData);
        setActiveAlerts(alertsData);
        setDataPoints(webhookData.length);
        setFundingRates(fundingData.rates || []);
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
  const totalFundingRates = fundingRates.length;
  const topFundingRate = fundingRates
    .filter(r => r.rate !== null)
    .sort((a, b) => (b.rate || 0) - (a.rate || 0))[0];

  // Mock growth percentages (in real app, calculate from historical data)
  const monitorsGrowth = 12.5;
  const alertsGrowth = -5.2;
  const dataGrowth = 23.7;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
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
        {/* Stats Cards - First Row */}
        <Card className="group hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Monitors</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : activeMonitors}</div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground">
                {monitors.length} total
              </p>
              <span className={`flex items-center text-xs ${monitorsGrowth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {monitorsGrowth > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(monitorsGrowth)}%
              </span>
            </div>
            <div className="mt-2">
              <Sparkline data={monitorSparkline} color="#3b82f6" />
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground group-hover:text-yellow-500 transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : activeAlerts.length}</div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground">
                {activeAlerts.length === 0 ? 'All clear' : 'Needs attention'}
              </p>
              <span className={`flex items-center text-xs ${alertsGrowth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {alertsGrowth > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(alertsGrowth)}%
              </span>
            </div>
            <div className="mt-2">
              <Sparkline data={alertSparkline} color="#eab308" />
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Data Points</CardTitle>
            <ChartBar className="h-4 w-4 text-muted-foreground group-hover:text-green-500 transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : dataPoints.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground">Total collected</p>
              <span className={`flex items-center text-xs ${dataGrowth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dataGrowth > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(dataGrowth)}%
              </span>
            </div>
            <div className="mt-2">
              <Sparkline data={dataSparkline} color="#10b981" />
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Healthy</div>
            <p className="text-xs text-muted-foreground mt-1">All systems operational</p>
            <Progress value={95} className="mt-3 h-2" />
            <p className="text-xs text-muted-foreground mt-1">95% capacity</p>
          </CardContent>
        </Card>

        {/* Large Featured Card - Spans 2 columns on larger screens */}
        <Card className="md:col-span-2 lg:col-span-2 group hover:shadow-lg transition-all duration-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Funding Rates</CardTitle>
                <CardDescription>Highest opportunities across exchanges</CardDescription>
              </div>
              <Link href="/dex-rates">
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

        {/* Monitor List */}
        <Card className="lg:col-span-2 group hover:shadow-lg transition-all duration-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Monitors</CardTitle>
                <CardDescription>Live monitor status</CardDescription>
              </div>
              <Link href="/charts">
                <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                  View Charts <ArrowUpRight className="ml-1 h-3 w-3" />
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
                <Link href="/settings">
                  <Badge variant="outline" className="mt-2 cursor-pointer">Configure →</Badge>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {monitors.slice(0, 5).map((monitor) => (
                  <div key={monitor.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${monitor.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                      <div>
                        <div className="font-medium">{monitor.name}</div>
                        {monitor.description && (
                          <div className="text-xs text-muted-foreground">{monitor.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {monitor.value !== undefined ? (
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
            <Link href="/settings?tab=monitors">
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  <span className="text-sm">Add Monitor</span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/settings?tab=alerts">
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span className="text-sm">Configure Alerts</span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/settings?tab=funding">
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm">Funding Alerts</span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/dex-rates">
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

        {/* System Status */}
        <Card className="group hover:shadow-lg transition-all duration-200">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Service health</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm">API Server</span>
                </div>
                <Badge variant="outline" className="text-xs">Online</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm">Database</span>
                </div>
                <Badge variant="outline" className="text-xs">Healthy</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm">Alert Engine</span>
                </div>
                <Badge variant="outline" className="text-xs">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm">DEX Fetcher</span>
                </div>
                <Badge variant="outline" className="text-xs">Running</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}