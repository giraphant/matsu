'use client';

import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Edit, GripVertical, Maximize2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type CardSize = 'tiny' | 'small' | 'vertical' | 'medium' | 'large' | 'xlarge' | 'tall';

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
}

interface ResizableMonitorCardProps {
  monitor: Monitor;
  size: CardSize;
  onEdit: (monitor: Monitor) => void;
  onDelete: (id: string) => void;
  onResize: (id: string, size: CardSize) => void;
}

// Map size to grid classes (4-column grid)
export const getGridClassForSize = (size: CardSize): string => {
  switch (size) {
    case 'tiny':
      return 'col-span-1 row-span-1'; // 1×1 tiny
    case 'small':
      return 'col-span-2 row-span-1'; // 2×1 small wide
    case 'vertical':
      return 'col-span-1 row-span-2'; // 1×2 vertical
    case 'medium':
      return 'col-span-2 row-span-2'; // 2×2 medium square
    case 'large':
      return 'col-span-3 row-span-2'; // 3×2 large
    case 'xlarge':
      return 'col-span-4 row-span-2'; // 4×2 full width
    case 'tall':
      return 'col-span-2 row-span-3'; // 2×3 tall
    default:
      return 'col-span-2 row-span-1';
  }
};

// Determine if card should show chart based on size
const shouldShowChart = (size: CardSize): boolean => {
  return ['medium', 'large', 'xlarge', 'tall', 'vertical'].includes(size);
};

// Determine if card should show stats based on size
const shouldShowStats = (size: CardSize): boolean => {
  return ['medium', 'large', 'xlarge', 'tall'].includes(size);
};

function ResizableMonitorCardComponent(props: ResizableMonitorCardProps) {
  const { monitor, size, onEdit, onDelete, onResize } = props;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: monitor.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    willChange: isDragging ? 'transform' : 'auto',
  };

  // Format value with unit
  const formatValue = (value?: number) => {
    if (value === null || value === undefined) return 'N/A';
    const formatted = value.toFixed(monitor.decimal_places);
    return monitor.unit ? `${formatted} ${monitor.unit}` : formatted;
  };

  // Get trend (mock for now - would calculate from history)
  const trend = 0;
  const isPositive = trend > 0;
  const isNegative = trend < 0;

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

  const showChart = shouldShowChart(size);
  const showStats = shouldShowStats(size);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`${getGridClassForSize(size)} overflow-hidden hover:shadow-lg transition-all relative group flex flex-col`}
      {...attributes}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: monitor.color || '#3b82f6' }}
      />

      <CardHeader className="pb-3 pt-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <button
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity touch-none flex-shrink-0"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base truncate">
                {monitor.name}
              </h3>
              <Badge variant={monitor.enabled ? "default" : "secondary"} className="text-xs flex-shrink-0">
                {monitor.enabled ? 'Active' : 'Disabled'}
              </Badge>
            </div>
            {monitor.description && size !== 'tiny' && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {monitor.description}
              </p>
            )}
          </div>

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7">
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onResize(monitor.id, 'tiny')}>
                  Tiny (1×1)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResize(monitor.id, 'small')}>
                  Small (2×1)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResize(monitor.id, 'vertical')}>
                  Vertical (1×2)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResize(monitor.id, 'medium')}>
                  Medium (2×2)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResize(monitor.id, 'large')}>
                  Large (3×2)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResize(monitor.id, 'xlarge')}>
                  X-Large (4×2)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResize(monitor.id, 'tall')}>
                  Tall (2×3)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onEdit(monitor)}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              onClick={() => onDelete(monitor.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4 flex-1 flex flex-col gap-3">
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className={`font-bold tabular-nums ${size === 'tiny' ? 'text-2xl' : size === 'small' || size === 'vertical' ? 'text-3xl' : 'text-4xl'}`}>
              {formatValue(monitor.value)}
            </span>
            {trend !== 0 && (
              <span className={`flex items-center text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? (
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                ) : isNegative ? (
                  <TrendingDown className="h-3 w-3 mr-0.5" />
                ) : (
                  <Minus className="h-3 w-3 mr-0.5" />
                )}
                {Math.abs(trend).toFixed(monitor.decimal_places)}
              </span>
            )}
          </div>
          {monitor.computed_at && size !== 'tiny' && (
            <p className="text-xs text-muted-foreground">
              Updated {formatTimeSince(monitor.computed_at)}
            </p>
          )}
        </div>

        {showChart && (
          <>
            <Separator />
            <div className={`bg-muted/30 rounded flex items-center justify-center ${size === 'vertical' ? 'h-32' : 'h-24'}`}>
              <p className="text-xs text-muted-foreground">Chart placeholder</p>
            </div>
          </>
        )}

        {showStats && (
          <>
            <Separator />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">Min</p>
                <p className="text-sm font-semibold mt-0.5 tabular-nums">
                  {formatValue(monitor.value ? monitor.value * 0.9 : undefined)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">Avg</p>
                <p className="text-sm font-semibold mt-0.5 tabular-nums">
                  {formatValue(monitor.value ? monitor.value * 0.95 : undefined)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">Max</p>
                <p className="text-sm font-semibold mt-0.5 tabular-nums">
                  {formatValue(monitor.value ? monitor.value * 1.1 : undefined)}
                </p>
              </div>
            </div>
          </>
        )}

        {!showStats && size !== 'tiny' && (
          <code className="text-xs bg-muted px-2 py-1 rounded truncate block mt-auto">
            {monitor.formula}
          </code>
        )}
      </CardContent>
    </Card>
  );
}

export const ResizableMonitorCard = memo(ResizableMonitorCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.monitor.id === nextProps.monitor.id &&
    prevProps.monitor.value === nextProps.monitor.value &&
    prevProps.monitor.computed_at === nextProps.monitor.computed_at &&
    prevProps.monitor.enabled === nextProps.monitor.enabled &&
    prevProps.size === nextProps.size
  );
});
