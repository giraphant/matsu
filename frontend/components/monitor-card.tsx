'use client';

import { useState, useEffect } from 'react';
import { MoreVertical, Edit, Trash2, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
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
  showChart?: boolean;
}

export function MonitorCard({ monitor, onEdit, onDelete, showChart = true }: MonitorCardProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [changePercent, setChangePercent] = useState<number>(0);

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

  return (
    <Card className="relative overflow-hidden border border-transparent dark:border-border/50">
      <section className="flex flex-col flex-nowrap">
        {/* Header Section */}
        <div className="flex flex-col justify-between gap-y-2 px-4 pt-4 pb-2">
          <div className="flex flex-col gap-y-2">
            <div className="flex flex-col gap-y-0.5">
              <dt className="text-sm font-medium text-muted-foreground/80 truncate">
                {monitor.name}
              </dt>
              {monitor.description && (
                <dt className="text-xs text-muted-foreground/50 font-normal truncate">
                  {monitor.description}
                </dt>
              )}
            </div>
            <div className="flex items-baseline gap-x-2">
              <dd className="text-xl font-semibold text-foreground">
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
          </div>
        </div>

        {/* Chart Section */}
        {showChart && chartData.length > 0 && (
          <div className="min-h-24 w-full">
            <ResponsiveContainer width="100%" height={96}>
              <AreaChart
                data={chartData}
                className="translate-y-1 scale-105"
              >
                <defs>
                  <linearGradient id={`gradient-${monitor.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="10%"
                      stopColor={monitor.color || 'hsl(var(--primary))'}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor={monitor.color || 'hsl(var(--primary))'}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <YAxis
                  domain={[
                    Math.min(...chartData.map((d) => d.value)) * 0.95,
                    'auto'
                  ]}
                  hide
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={monitor.color || 'hsl(var(--primary))'}
                  strokeWidth={2}
                  fill={`url(#gradient-${monitor.id})`}
                  animationDuration={300}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Empty state for no chart data */}
        {showChart && chartData.length === 0 && (
          <div className="min-h-24 w-full flex items-center justify-center text-xs text-muted-foreground">
            No data available
          </div>
        )}

        {/* Menu Button - Absolute positioned */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 rounded-full"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[120px]">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(monitor)}>
                <Edit className="mr-2 h-3 w-3" />
                <span className="text-xs">Edit</span>
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
