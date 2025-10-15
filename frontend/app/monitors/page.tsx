'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Activity } from 'lucide-react';
import { toast } from "sonner";
import { MonitorCard } from '@/components/monitor-card';
import { getApiUrl } from '@/lib/api-config';
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
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

// Sortable wrapper for MonitorCard
function SortableMonitorCard({
  monitor,
  onEdit,
  onDelete,
  onSetAlert
}: {
  monitor: Monitor;
  onEdit: (monitor: Monitor) => void;
  onDelete: (id: string) => void;
  onSetAlert: (monitor: Monitor) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: monitor.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div ref={setActivatorNodeRef} {...listeners}>
        <MonitorCard
          monitor={monitor}
          onEdit={onEdit}
          onDelete={onDelete}
          onSetAlert={onSetAlert}
          showChart={true}
        />
      </div>
    </div>
  );
}

export default function MonitorsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null);

  // Alert dialog states
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertMonitor, setAlertMonitor] = useState<Monitor | null>(null);
  const [alertFormData, setAlertFormData] = useState({
    upper_threshold: '',
    lower_threshold: '',
    alert_level: 'medium'
  });

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    formula: '',
    unit: '',
    description: '',
    color: '#3b82f6',
    decimal_places: 2
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch monitors and apply saved order
  const fetchMonitors = async () => {
    try {
      const response = await fetch(getApiUrl('/api/monitors'));
      if (!response.ok) throw new Error('Failed to fetch monitors');
      const data = await response.json();

      // Apply saved order from localStorage
      const savedOrder = localStorage.getItem('monitor-order');
      if (savedOrder) {
        try {
          const orderMap = JSON.parse(savedOrder);
          const ordered = data.sort((a: Monitor, b: Monitor) => {
            const indexA = orderMap[a.id] ?? 999;
            const indexB = orderMap[b.id] ?? 999;
            return indexA - indexB;
          });
          setMonitors(ordered);
        } catch {
          setMonitors(data);
        }
      } else {
        setMonitors(data);
      }
    } catch (error) {
      console.error('Error fetching monitors:', error);
      toast.error('Failed to load monitors');
    } finally {
      setLoading(false);
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setMonitors((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);

        // Save order to localStorage
        const orderMap = newOrder.reduce((acc, monitor, index) => {
          acc[monitor.id] = index;
          return acc;
        }, {} as Record<string, number>);
        localStorage.setItem('monitor-order', JSON.stringify(orderMap));

        return newOrder;
      });
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
        ? getApiUrl(`/api/monitors/${editingMonitor.id}`)
        : getApiUrl('/api/monitors');

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
      const response = await fetch(getApiUrl(`/api/monitors/${id}`), { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete monitor');

      toast.success('Monitor deleted');
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

  // Handle set alert
  const handleSetAlert = async (monitor: Monitor) => {
    setAlertMonitor(monitor);

    // Fetch existing alert config
    try {
      const response = await fetch(getApiUrl(`/api/alerts/config/${monitor.id}`));
      if (response.ok) {
        const config = await response.json();
        if (config) {
          setAlertFormData({
            upper_threshold: config.upper_threshold?.toString() || '',
            lower_threshold: config.lower_threshold?.toString() || '',
            alert_level: config.alert_level || 'medium'
          });
        } else {
          resetAlertForm();
        }
      } else {
        resetAlertForm();
      }
    } catch (error) {
      console.error('Error fetching alert config:', error);
      resetAlertForm();
    }

    setAlertDialogOpen(true);
  };

  // Handle alert submit
  const handleAlertSubmit = async () => {
    if (!alertMonitor) return;

    try {
      const payload = {
        monitor_id: alertMonitor.id,
        upper_threshold: alertFormData.upper_threshold ? parseFloat(alertFormData.upper_threshold) : null,
        lower_threshold: alertFormData.lower_threshold ? parseFloat(alertFormData.lower_threshold) : null,
        alert_level: alertFormData.alert_level
      };

      const response = await fetch(getApiUrl('/api/alerts/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save alert config');

      toast.success('Alert configuration saved');
      setAlertDialogOpen(false);
      resetAlertForm();
    } catch (error) {
      console.error('Error saving alert config:', error);
      toast.error('Failed to save alert configuration');
    }
  };

  // Handle delete alert
  const handleDeleteAlert = async () => {
    if (!alertMonitor) return;
    if (!confirm('Are you sure you want to delete this alert configuration?')) return;

    try {
      const response = await fetch(getApiUrl(`/api/alerts/config/${alertMonitor.id}`), {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete alert config');

      toast.success('Alert configuration deleted');
      setAlertDialogOpen(false);
      resetAlertForm();
    } catch (error) {
      console.error('Error deleting alert config:', error);
      toast.error('Failed to delete alert configuration');
    }
  };

  // Reset alert form
  const resetAlertForm = () => {
    setAlertFormData({
      upper_threshold: '',
      lower_threshold: '',
      alert_level: 'medium'
    });
    setAlertMonitor(null);
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

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitors Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Track your custom metrics with real-time updates
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
            items={monitors.map((m) => m.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {monitors.map((monitor) => (
                <SortableMonitorCard
                  key={monitor.id}
                  monitor={monitor}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSetAlert={handleSetAlert}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Alert Configuration Dialog */}
      <Dialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Alert Configuration</DialogTitle>
            <DialogDescription>
              Set alert thresholds for {alertMonitor?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="upper_threshold">Upper Threshold (optional)</Label>
              <Input
                id="upper_threshold"
                type="number"
                step="any"
                placeholder="Alert when value exceeds..."
                value={alertFormData.upper_threshold}
                onChange={(e) => setAlertFormData({ ...alertFormData, upper_threshold: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lower_threshold">Lower Threshold (optional)</Label>
              <Input
                id="lower_threshold"
                type="number"
                step="any"
                placeholder="Alert when value falls below..."
                value={alertFormData.lower_threshold}
                onChange={(e) => setAlertFormData({ ...alertFormData, lower_threshold: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="alert_level">Alert Level</Label>
              <Select
                value={alertFormData.alert_level}
                onValueChange={(value) =>
                  setAlertFormData({ ...alertFormData, alert_level: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAlert}
            >
              Delete Alert
            </Button>
            <Button type="button" variant="outline" onClick={() => setAlertDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" onClick={handleAlertSubmit}>
              Save Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
