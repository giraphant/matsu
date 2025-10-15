'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Activity } from 'lucide-react';
import { toast } from "sonner";
import { ResizableMonitorCard, CardSize } from '@/components/resizable-monitor-card';

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

interface MonitorLayout {
  id: string;
  size: CardSize;
}

const STORAGE_KEY = 'monitors-layout';

export default function MonitorsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [layout, setLayout] = useState<MonitorLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    formula: '',
    unit: '',
    description: '',
    color: '#3b82f6',
    decimal_places: 2
  });

  // Setup drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load layout from localStorage
  const loadLayout = (monitors: Monitor[]): MonitorLayout[] => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedLayout: MonitorLayout[] = JSON.parse(saved);

        // Create a map of existing layouts
        const layoutMap = new Map(savedLayout.map(l => [l.id, l.size]));

        // Build layout array matching current monitors
        return monitors.map((monitor, index) => ({
          id: monitor.id,
          size: layoutMap.get(monitor.id) || getDefaultSize(index),
        }));
      }
    } catch (error) {
      console.error('Failed to load layout:', error);
    }

    // Return default layout
    return monitors.map((monitor, index) => ({
      id: monitor.id,
      size: getDefaultSize(index),
    }));
  };

  // Get default size based on index (more varied pattern for 4-column grid)
  const getDefaultSize = (index: number): CardSize => {
    const pattern: CardSize[] = ['medium', 'small', 'vertical', 'tiny', 'small', 'large', 'vertical', 'tiny'];
    return pattern[index % pattern.length];
  };

  // Save layout to localStorage
  const saveLayout = (newLayout: MonitorLayout[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout));
    } catch (error) {
      console.error('Failed to save layout:', error);
    }
  };

  // Fetch monitors
  const fetchMonitors = async () => {
    try {
      const response = await fetch('/api/monitors');
      if (!response.ok) throw new Error('Failed to fetch monitors');
      const data = await response.json();
      setMonitors(data);

      // Initialize or update layout
      const newLayout = loadLayout(data);
      setLayout(newLayout);
    } catch (error) {
      console.error('Error fetching monitors:', error);
      toast.error('Failed to load monitors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMonitors, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle form submission
  const handleSubmit = async () => {
    try {
      const url = editingMonitor
        ? `/api/monitors/${editingMonitor.id}`
        : '/api/monitors';

      const method = editingMonitor ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save monitor');

      toast.success(editingMonitor ? 'Monitor updated' : 'Monitor created');
      fetchMonitors();
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving monitor:', error);
      toast.error('Failed to save monitor');
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this monitor?')) return;

    try {
      const response = await fetch(`/api/monitors/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete monitor');

      toast.success('Monitor deleted');

      // Remove from layout
      const newLayout = layout.filter(l => l.id !== id);
      setLayout(newLayout);
      saveLayout(newLayout);

      fetchMonitors();
    } catch (error) {
      console.error('Error deleting monitor:', error);
      toast.error('Failed to delete monitor');
    }
  };

  // Handle edit
  const handleEdit = (monitor: Monitor) => {
    setEditingMonitor(monitor);
    setFormData({
      name: monitor.name,
      formula: monitor.formula,
      unit: monitor.unit || '',
      description: monitor.description || '',
      color: monitor.color || '#3b82f6',
      decimal_places: monitor.decimal_places
    });
    setDialogOpen(true);
  };

  // Handle resize
  const handleResize = (id: string, size: CardSize) => {
    const newLayout = layout.map(item =>
      item.id === id ? { ...item, size } : item
    );
    setLayout(newLayout);
    saveLayout(newLayout);
    toast.success('Card size updated');
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = layout.findIndex(item => item.id === active.id);
      const newIndex = layout.findIndex(item => item.id === over.id);

      const newLayout = arrayMove(layout, oldIndex, newIndex);
      setLayout(newLayout);
      saveLayout(newLayout);
      toast.success('Layout updated');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      formula: '',
      unit: '',
      description: '',
      color: '#3b82f6',
      decimal_places: 2
    });
    setEditingMonitor(null);
  };

  // Get sorted monitors based on layout order
  const getSortedMonitors = (): { monitor: Monitor; size: CardSize }[] => {
    return layout
      .map(layoutItem => {
        const monitor = monitors.find(m => m.id === layoutItem.id);
        return monitor ? { monitor, size: layoutItem.size } : null;
      })
      .filter((item): item is { monitor: Monitor; size: CardSize } => item !== null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading monitors...</p>
        </div>
      </div>
    );
  }

  const sortedMonitors = getSortedMonitors();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitors Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Drag cards to reorder • Click resize icon to change size
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Monitor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingMonitor ? 'Edit Monitor' : 'Create New Monitor'}
              </DialogTitle>
              <DialogDescription>
                Define a custom monitor with a formula to track metrics
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., BTC/USDT Ratio"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="formula">Formula</Label>
                <Textarea
                  id="formula"
                  placeholder="e.g., ${webhook:btc_price} * 2"
                  value={formData.formula}
                  onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Use $&#123;webhook:id&#125; or $&#123;monitor:id&#125; in formulas
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="unit">Unit (optional)</Label>
                  <Input
                    id="unit"
                    placeholder="e.g., USD, %"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="decimal_places">Decimal Places</Label>
                  <Select
                    value={formData.decimal_places.toString()}
                    onValueChange={(value) =>
                      setFormData({ ...formData, decimal_places: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="color">Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this monitor tracks..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" onClick={handleSubmit}>
                {editingMonitor ? 'Save Changes' : 'Create Monitor'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {monitors.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No monitors yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first monitor to start tracking custom metrics
            </p>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Monitor
            </Button>
          </div>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={layout.map(l => l.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-4 gap-4 auto-rows-[200px]">
              {sortedMonitors.map(({ monitor, size }) => (
                <ResizableMonitorCard
                  key={monitor.id}
                  monitor={monitor}
                  size={size}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onResize={handleResize}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Floating refresh button */}
      <Button
        className="fixed bottom-6 right-6 rounded-full shadow-lg"
        size="icon"
        onClick={fetchMonitors}
      >
        <Activity className="h-4 w-4" />
      </Button>
    </div>
  );
}
