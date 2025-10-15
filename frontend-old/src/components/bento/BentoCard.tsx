/**
 * Modern Bento Card Component using shadcn/ui
 */

import { Bell, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LineChart, Line, XAxis, ResponsiveContainer } from 'recharts';
import { NewMonitor } from '../../api/newMonitors';
import { formatValue, formatTimeSince } from '../../utils/format';
import { cn } from '@/lib/utils';

interface BentoCardProps {
  monitor: NewMonitor;
  isAlert: boolean;
  hasAlert: boolean;
  alertLevel?: string;
  showChart: boolean;
  chartData: any[];
  stats: {
    min: number | null;
    avg: number | null;
    max: number | null;
  };
  onAlertClick: () => void;
  onRemove: () => void;
}

export function BentoCard({
  monitor,
  isAlert,
  hasAlert,
  alertLevel,
  showChart,
  chartData,
  stats,
  onAlertClick,
  onRemove,
}: BentoCardProps) {
  // Calculate trend
  const hasTrend = chartData.length >= 2;
  const trend = hasTrend
    ? chartData[chartData.length - 1].value - chartData[chartData.length - 2].value
    : 0;
  const isPositive = trend > 0;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-lg h-full",
        isAlert && "ring-2 ring-destructive animate-pulse"
      )}
    >
      {/* Alert indicator bar */}
      {isAlert && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-destructive" />
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base truncate">
                {monitor.name}
              </h3>
              {hasAlert && (
                <Badge
                  variant={isAlert ? "destructive" : "outline"}
                  className="text-xs"
                >
                  {alertLevel}
                </Badge>
              )}
            </div>
            {monitor.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {monitor.description}
              </p>
            )}
          </div>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onAlertClick}
            >
              <Bell className={cn(
                "h-3.5 w-3.5",
                hasAlert && "fill-current text-primary"
              )} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4 space-y-3">
        {/* Main Value */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-3xl font-bold tabular-nums",
              isAlert && "text-destructive"
            )}>
              {formatValue(monitor.value ?? null, monitor.unit ?? null, monitor.decimal_places)}
            </span>
            {hasTrend && (
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
                    stroke="hsl(var(--primary))"
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
                  {formatValue(stats.min, monitor.unit ?? null, monitor.decimal_places)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">Avg</p>
                <p className="text-sm font-semibold mt-0.5 tabular-nums">
                  {formatValue(stats.avg, monitor.unit ?? null, monitor.decimal_places)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">Max</p>
                <p className="text-sm font-semibold mt-0.5 tabular-nums">
                  {formatValue(stats.max, monitor.unit ?? null, monitor.decimal_places)}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
