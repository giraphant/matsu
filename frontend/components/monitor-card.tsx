'use client';

import { useState, useEffect } from 'react';
import { Bell, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LineChart, Line, XAxis, ResponsiveContainer } from 'recharts';
import { cn } from "@/lib/utils";

interface Monitor {
  id: string;
  name: string;
  formula: string;
  unit?: string;
  description?: string;
  color?: string;
  decimal_places: number;
  enabled: boolean;
  value?: number;
  computed_at?: string;
  created_at: string;
  updated_at: string;
}

interface MonitorCardProps {
  monitor: Monitor;
  onEdit?: (monitor: Monitor) => void;
  onDelete?: (id: string) => void;
  showChart?: boolean;
}

export function MonitorCard({ monitor, onEdit, onDelete, showChart = true }: MonitorCardProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState<{ min: number | null; avg: number | null; max: number | null }>({
    min: null,
    avg: null,
    max: null,
  });

  // Fetch chart data
  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const response = await fetch(`/api/monitors/${monitor.id}/history?limit=50`);
        if (response.ok) {
          const data = await response.json();
          setChartData(data);

          // Calculate stats
          if (data.length > 0) {
            const values = data.map((p: any) => p.value);
            setStats({
              min: Math.min(...values),
              max: Math.max(...values),
              avg: values.reduce((sum: number, v: number) => sum + v, 0) / values.length,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
      }
    };

    fetchChartData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchChartData, 30000);
    return () => clearInterval(interval);
  }, [monitor.id]);

  // Format value with unit
  const formatValue = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    const formatted = value.toFixed(monitor.decimal_places);
    return monitor.unit ? `${formatted} ${monitor.unit}` : formatted;
  };

  // Calculate trend
  const hasTrend = chartData.length >= 2;
  const trend = hasTrend
    ? chartData[chartData.length - 1].value - chartData[chartData.length - 2].value
    : 0;
  const isPositive = trend > 0;

  // Format time since
  const formatTimeSince = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <Card
      className="relative overflow-hidden transition-all duration-300 hover:shadow-lg h-full flex flex-col"
      style={{ borderTop: `3px solid ${monitor.color || 'hsl(var(--primary))'}` }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base truncate">
                {monitor.name}
              </h3>
              <Badge variant={monitor.enabled ? "default" : "secondary"} className="text-xs">
                {monitor.enabled ? 'Active' : 'Disabled'}
              </Badge>
            </div>
            {monitor.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {monitor.description}
              </p>
            )}
          </div>

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit(monitor)}
                title="Edit monitor"
              >
                <Bell className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onDelete(monitor.id)}
                title="Delete monitor"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4 flex-1 flex flex-col space-y-3">
        {/* Main Value */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">
              {formatValue(monitor.value)}
            </span>
            {hasTrend && trend !== 0 && (
              <span className={cn(
                "flex items-center text-sm font-medium",
                isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                {isPositive ? (
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-0.5" />
                )}
                {Math.abs(trend).toFixed(monitor.decimal_places)}
              </span>
            )}
          </div>
          {monitor.computed_at && (
            <p className="text-xs text-muted-foreground">
              Updated {formatTimeSince(monitor.computed_at)}
            </p>
          )}
        </div>

        {/* Chart */}
        {showChart && chartData.length > 0 && (
          <>
            <Separator />
            <div className="h-24 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="timestamp"
                    hide={true}
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    scale="time"
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={monitor.color || 'hsl(var(--primary))'}
                    strokeWidth={2}
                    dot={false}
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* Stats */}
        {chartData.length > 0 && (
          <>
            <Separator />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">Min</p>
                <p className="text-sm font-semibold mt-0.5 tabular-nums">
                  {formatValue(stats.min)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">Avg</p>
                <p className="text-sm font-semibold mt-0.5 tabular-nums">
                  {formatValue(stats.avg)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">Max</p>
                <p className="text-sm font-semibold mt-0.5 tabular-nums">
                  {formatValue(stats.max)}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Formula hint if no chart */}
        {!showChart && (
          <code className="text-xs bg-muted px-2 py-1 rounded truncate block mt-auto">
            {monitor.formula}
          </code>
        )}
      </CardContent>
    </Card>
  );
}
