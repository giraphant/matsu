'use client';

import { useState, useEffect } from 'react';
import { MoreVertical, Edit, Trash2, ArrowUpRight, ArrowDownRight, Minus, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api-config";

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
  onSetAlert?: (monitor: Monitor) => void;
  showChart?: boolean;
  isAlert?: boolean;
  alertLevel?: string;
}

export function MonitorCard({ monitor, onEdit, onDelete, onSetAlert, showChart = true, isAlert = false, alertLevel }: MonitorCardProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [changePercent, setChangePercent] = useState<number>(0);
  const [timeAgo, setTimeAgo] = useState<string>('');

  // Format time ago
  const formatTimeAgo = (dateString: string | undefined) => {
    if (!dateString) return '';

    // Parse UTC time and convert to local
    const past = new Date(dateString);
    // Check if the date string doesn't end with 'Z', add it to parse as UTC
    const utcPast = dateString.endsWith('Z') ? past : new Date(dateString + 'Z');
    const now = new Date();
    const seconds = Math.floor((now.getTime() - utcPast.getTime()) / 1000);

    if (seconds < 0) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Update time ago every second
  useEffect(() => {
    const updateTimeAgo = () => {
      setTimeAgo(formatTimeAgo(monitor.computed_at));
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 1000);
    return () => clearInterval(interval);
  }, [monitor.computed_at]);

  // Fetch chart data
  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const response = await fetch(getApiUrl(`/api/monitors/${monitor.id}/history?limit=50`));
        if (response.ok) {
          const data = await response.json();
          setChartData(data);

          // Calculate percentage change
          if (data.length >= 2) {
            const firstValue = data[0].value;
            const lastValue = data[data.length - 1].value;
            if (firstValue !== 0) {
              const change = ((lastValue - firstValue) / firstValue) * 100;
              setChangePercent(change);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
      }
    };

    fetchChartData();
    const interval = setInterval(fetchChartData, 30000);
    return () => clearInterval(interval);
  }, [monitor.id]);

  // Format value with unit
  const formatValue = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    const formatted = value.toFixed(monitor.decimal_places);
    return monitor.unit ? `${formatted} ${monitor.unit}` : formatted;
  };

  // Determine color variant based on change
  const getChangeColor = () => {
    if (changePercent > 0) return 'success';
    if (changePercent < 0) return 'destructive';
    return 'secondary';
  };

  const getChangeIcon = () => {
    if (changePercent > 0) return <ArrowUpRight className="h-3 w-3" />;
    if (changePercent < 0) return <ArrowDownRight className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  // Get the custom color or fallback to primary
  const alertBgColor = monitor.color || 'hsl(var(--primary))';

  return (
    <Card
      className={cn(
        "relative overflow-hidden border border-transparent dark:border-border/50 p-0 gap-0 transition-all duration-300",
        isAlert && "border-2"
      )}
      style={isAlert ? {
        backgroundColor: alertBgColor,
        borderColor: alertBgColor
      } : undefined}
    >
      <section className="flex flex-col flex-nowrap">
        {/* Header Section */}
        <div className="flex flex-col justify-between gap-y-2 p-4">
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-y-0">
              <dt className={cn(
                "text-sm font-medium truncate",
                isAlert ? "text-white" : "text-default-600"
              )}>
                {monitor.name}
              </dt>
              {monitor.description && (
                <dt className={cn(
                  "text-xs font-normal truncate",
                  isAlert ? "text-white/80" : "text-default-400"
                )}>
                  {monitor.description}
                </dt>
              )}
            </div>
            <div className="flex flex-col gap-y-1">
              <div className="flex items-baseline gap-x-2">
                <dd className={cn(
                  "text-3xl font-semibold",
                  isAlert ? "text-white" : "text-default-700"
                )}>
                  {formatValue(monitor.value)}
                </dd>
                {changePercent !== 0 && (
                  <Badge
                    variant={getChangeColor()}
                    className="h-5 gap-0.5 text-xs font-medium px-1.5"
                  >
                    {getChangeIcon()}
                    <span>{Math.abs(changePercent).toFixed(1)}%</span>
                  </Badge>
                )}
              </div>
              {timeAgo && (
                <p className={cn(
                  "text-xs",
                  isAlert ? "text-white/70" : "text-muted-foreground"
                )}>
                  {timeAgo}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Chart Section - no padding, tight to bottom */}
        {showChart && chartData.length > 0 && (
          <div className="min-h-24 w-full -mb-1">
            <ResponsiveContainer width="100%" height={96}>
              <LineChart
                data={chartData}
                className="translate-y-1 scale-105"
                accessibilityLayer
              >
                <YAxis
                  domain={['auto', 'auto']}
                  hide
                />
                <Line
                  dataKey="value"
                  stroke={isAlert ? 'rgba(255, 255, 255, 0.9)' : (monitor.color || 'hsl(var(--primary))')}
                  strokeWidth={2}
                  dot={false}
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Empty state for no chart data */}
        {showChart && chartData.length === 0 && (
          <div className="min-h-20 w-full flex items-center justify-center text-xs text-muted-foreground">
            No data available
          </div>
        )}

        {/* Menu Button - Absolute positioned */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 rounded-full z-10"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(monitor)}>
                <Edit className="mr-2 h-3 w-3" />
                <span className="text-xs">Edit</span>
              </DropdownMenuItem>
            )}
            {onSetAlert && (
              <DropdownMenuItem onClick={() => onSetAlert(monitor)}>
                <Bell className="mr-2 h-3 w-3" />
                <span className="text-xs">Alert</span>
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(monitor.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3 w-3" />
                <span className="text-xs">Delete</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </section>
    </Card>
  );
}
