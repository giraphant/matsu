'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Edit, GripVertical, Maximize2, TrendingUp, TrendingDown, Activity } from 'lucide-react';

export type CardSize = 'small' | 'medium' | 'large' | 'xlarge';

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

// Map size to grid classes
export const getGridClassForSize = (size: CardSize): string => {
  switch (size) {
    case 'small':
      return 'col-span-1 row-span-1';
    case 'medium':
      return 'col-span-2 row-span-1';
    case 'large':
      return 'col-span-2 row-span-2';
    case 'xlarge':
      return 'col-span-3 row-span-2';
    default:
      return 'col-span-1 row-span-1';
  }
};

export function ResizableMonitorCard({
  monitor,
  size,
  onEdit,
  onDelete,
  onResize,
}: ResizableMonitorCardProps) {
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
  };

  // Format value with unit
  const formatValue = (monitor: Monitor) => {
    if (monitor.value === null || monitor.value === undefined) return 'N/A';
    const formatted = monitor.value.toFixed(monitor.decimal_places);
    return monitor.unit ? `${formatted} ${monitor.unit}` : formatted;
  };

  // Get trend icon
  const getTrendIcon = (value?: number) => {
    if (!value) return <Activity className="h-4 w-4" />;
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4" />;
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`${getGridClassForSize(size)} overflow-hidden hover:shadow-lg transition-shadow relative group`}
      {...attributes}
    >
      {/* Border top color */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: monitor.color || '#3b82f6' }}
      />

      <CardHeader className="pb-2 pt-3">
        <div className="flex justify-between items-start gap-2">
          {/* Drag handle */}
          <button
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity touch-none"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>

          <CardTitle className="text-lg line-clamp-1 flex-1">
            {monitor.name}
          </CardTitle>

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Resize dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onResize(monitor.id, 'small')}>
                  Small (1×1)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResize(monitor.id, 'medium')}>
                  Medium (2×1)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResize(monitor.id, 'large')}>
                  Large (2×2)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResize(monitor.id, 'xlarge')}>
                  X-Large (3×2)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onEdit(monitor)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive"
              onClick={() => onDelete(monitor.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {monitor.description && (
          <CardDescription className="line-clamp-2 mt-1">
            {monitor.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-baseline gap-2 mb-2">
          <span className={`font-bold ${size === 'small' ? 'text-2xl' : 'text-3xl'}`}>
            {formatValue(monitor)}
          </span>
          {getTrendIcon(monitor.value)}
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={monitor.enabled ? "default" : "secondary"}>
              {monitor.enabled ? 'Active' : 'Disabled'}
            </Badge>
            <code className="text-xs bg-muted px-1 py-0.5 rounded line-clamp-1 flex-1 min-w-0">
              {monitor.formula}
            </code>
          </div>
          {monitor.computed_at && (
            <p className="text-xs text-muted-foreground">
              Updated {new Date(monitor.computed_at).toLocaleTimeString()}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
