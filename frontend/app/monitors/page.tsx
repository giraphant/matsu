'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Activity } from 'lucide-react';
import { toast } from "sonner";
import { MonitorCard } from '@/components/monitor-card';
import { getApiUrl } from '@/lib/api-config';
import { useNotification } from '@/hooks/useNotification';
import { AlertLevel, ALERT_LEVELS } from '@/lib/alerts';
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

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  level: string;
  enabled: boolean;
  cooldown_seconds: number;
  actions: string[];
}

// Monitor categories
type MonitorCategory = 'funding' | 'spot' | 'account' | 'hedge' | 'other';

interface CategoryConfig {
  id: MonitorCategory;
  label: string;
  prefixes: string[];
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'funding', label: '资金费率', prefixes: ['lighter-', 'aster-', 'grvt-', 'backpack-', 'mini_'] },
  { id: 'spot', label: '现货价格', prefixes: ['binance_spot_', 'okx_spot_', 'bybit_spot_', 'jupiter_spot_', 'pyth_spot_'] },
  { id: 'account', label: '账户信息', prefixes: ['lighter_account_', 'lighter_position_'] },
  { id: 'hedge', label: '对冲量', prefixes: ['jlp_hedge_', 'alp_hedge_'] },
  { id: 'other', label: '其他', prefixes: [] },
];

// Get category for a monitor based on its ID
function getMonitorCategory(monitorId: string): MonitorCategory {
  for (const category of CATEGORIES) {
    if (category.prefixes.some(prefix => monitorId.startsWith(prefix))) {
      return category.id;
    }
  }
  return 'other';
}

// Sortable wrapper for MonitorCard
function SortableMonitorCard({
  monitor,
  onEdit,
  onDelete,
  onSetAlert,
  isAlert = false,
  alertLevel
}: {
  monitor: Monitor;
  onEdit: (monitor: Monitor) => void;
  onDelete: (id: string) => void;
  onSetAlert: (monitor: Monitor) => void;
  isAlert?: boolean;
  alertLevel?: string;
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
          isAlert={isAlert}
          alertLevel={alertLevel}
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
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alertStates, setAlertStates] = useState<Map<string, {lastNotified: number, isActive: boolean}>>(new Map());

  // Tab and filter states
  const [currentTab, setCurrentTab] = useState<'all' | MonitorCategory>('all');
  const [selectedCategories, setSelectedCategories] = useState<Set<MonitorCategory>>(
    new Set(['funding', 'spot', 'account', 'hedge', 'other'])
  );

  const { playAlertSound, requestNotificationPermission } = useNotification();

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

  // Get storage key for current tab
  const getOrderStorageKey = (tab: 'all' | MonitorCategory) => `monitor-order-${tab}`;

  // Fetch monitors and apply saved order
  const fetchMonitors = async () => {
    try {
      const response = await fetch(getApiUrl('/api/monitors'));
      if (!response.ok) throw new Error('Failed to fetch monitors');
      const data = await response.json();

      // Filter to only enabled monitors for the monitor card view
      const enabledMonitors = data.filter((m: Monitor) => m.enabled);

      // Apply saved order from localStorage (use current tab's order)
      const savedOrder = localStorage.getItem(getOrderStorageKey(currentTab));
      if (savedOrder) {
        try {
          const orderMap = JSON.parse(savedOrder);
          const ordered = enabledMonitors.sort((a: Monitor, b: Monitor) => {
            const indexA = orderMap[a.id] ?? 999;
            const indexB = orderMap[b.id] ?? 999;
            return indexA - indexB;
          });
          setMonitors(ordered);
        } catch {
          setMonitors(enabledMonitors);
        }
      } else {
        setMonitors(enabledMonitors);
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

        // Save order to localStorage for current tab
        const orderMap = newOrder.reduce((acc, monitor, index) => {
          acc[monitor.id] = index;
          return acc;
        }, {} as Record<string, number>);
        localStorage.setItem(getOrderStorageKey(currentTab), JSON.stringify(orderMap));

        return newOrder;
      });
    }
  };

  // Toggle category selection in ALL tab
  const toggleCategory = (categoryId: MonitorCategory) => {
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      // Save to localStorage
      localStorage.setItem('selected-categories', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  };

  // Get filtered monitors based on current tab and selected categories
  const getFilteredMonitors = () => {
    if (currentTab === 'all') {
      // In ALL tab, filter by selected categories
      return monitors.filter(m => selectedCategories.has(getMonitorCategory(m.id)));
    } else {
      // In category tabs, show only that category
      return monitors.filter(m => getMonitorCategory(m.id) === currentTab);
    }
  };

  // Fetch alert rules
  const fetchAlertRules = async () => {
    try {
      const response = await fetch(getApiUrl('/api/alert-rules'));
      if (!response.ok) throw new Error('Failed to fetch alert rules');
      const data = await response.json();
      setAlertRules(data);
    } catch (error) {
      console.error('Error fetching alert rules:', error);
    }
  };

  // Check if monitor is in alert state
  const isMonitorInAlert = useCallback((monitor: Monitor, rule: AlertRule): boolean => {
    if (!rule.enabled || monitor.value === null || monitor.value === undefined) {
      return false;
    }

    const condition = rule.condition;
    const value = monitor.value;

    // Parse condition to extract upper/lower limits
    const upperMatch = condition.match(/>\s*=?\s*(-?\d+\.?\d*)/);
    const lowerMatch = condition.match(/<\s*=?\s*(-?\d+\.?\d*)/);

    if (upperMatch || lowerMatch) {
      const upper = upperMatch ? parseFloat(upperMatch[1]) : null;
      const lower = lowerMatch ? parseFloat(lowerMatch[1]) : null;

      if (upper !== null && value > upper) return true;
      if (lower !== null && value < lower) return true;
    }

    return false;
  }, []);

  // Get alert rule for monitor
  const getAlertRuleForMonitor = useCallback((monitorId: string): AlertRule | undefined => {
    return alertRules.find(rule =>
      rule.condition.includes(`monitor:${monitorId}`)
    );
  }, [alertRules]);

  // Check alerts and play sounds
  useEffect(() => {
    if (monitors.length === 0 || alertRules.length === 0) return;

    const checkAlerts = () => {
      monitors.forEach(monitor => {
        const rule = getAlertRuleForMonitor(monitor.id);
        if (!rule || !rule.enabled) return;

        const isAlert = isMonitorInAlert(monitor, rule);
        const state = alertStates.get(monitor.id);
        const level = rule.level as AlertLevel;
        const alertConfig = ALERT_LEVELS[level] || ALERT_LEVELS.medium;

        if (isAlert && monitor.value !== null) {
          // New alert or time to repeat
          const now = Date.now();
          const shouldNotify = !state?.isActive ||
            (now - (state.lastNotified || 0)) >= alertConfig.interval * 1000;

          if (shouldNotify) {
            // Play alert sound
            playAlertSound(level);

            const newStates = new Map(alertStates);
            newStates.set(monitor.id, {
              lastNotified: now,
              isActive: true
            });
            setAlertStates(newStates);
          }
        } else if (state?.isActive) {
          // Clear alert state when value returns to normal
          const newStates = new Map(alertStates);
          newStates.set(monitor.id, {
            lastNotified: state.lastNotified,
            isActive: false
          });
          setAlertStates(newStates);
        }
      });
    };

    // Check immediately
    checkAlerts();

    // Then check every 10 seconds
    const interval = setInterval(checkAlerts, 10000);
    return () => clearInterval(interval);
  }, [monitors, alertRules, alertStates, isMonitorInAlert, getAlertRuleForMonitor, playAlertSound]);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  // Load selected categories from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('selected-categories');
    if (saved) {
      try {
        setSelectedCategories(new Set(JSON.parse(saved)));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Re-fetch when tab changes to apply correct sorting
  useEffect(() => {
    fetchMonitors();
  }, [currentTab]);

  useEffect(() => {
    fetchMonitors();
    fetchAlertRules();
    // Refresh every 30 seconds
    const monitorInterval = setInterval(fetchMonitors, 30000);
    const alertInterval = setInterval(fetchAlertRules, 60000);
    return () => {
      clearInterval(monitorInterval);
      clearInterval(alertInterval);
    };
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

    // Fetch existing alert rules for this monitor
    try {
      const url = getApiUrl(`/api/alert-rules/by-monitor/${monitor.id}`);
      console.log('Fetching alert rules from:', url);
      const response = await fetch(url);
      console.log('Alert rules response status:', response.status);

      if (response.ok) {
        const rules = await response.json();
        console.log('Alert rules data:', rules);

        if (rules && rules.length > 0) {
          // Parse the first rule's condition to extract thresholds
          const rule = rules[0];
          const { upper, lower } = parseConditionToThresholds(rule.condition, monitor.id);

          setAlertFormData({
            upper_threshold: upper || '',
            lower_threshold: lower || '',
            alert_level: rule.level || 'medium'
          });
          toast.info(`Loaded existing alert configuration`);
        } else {
          resetAlertFormData();
          toast.info('No existing alert rules found');
        }
      } else {
        resetAlertFormData();
        toast.info('No existing alert rules found');
      }
    } catch (error) {
      console.error('Error fetching alert rules:', error);
      resetAlertFormData();
    }

    setAlertDialogOpen(true);
  };

  // Parse condition formula to extract thresholds
  const parseConditionToThresholds = (condition: string, monitorId: string): { upper: string | null; lower: string | null } => {
    const upperMatch = condition.match(/\$\{monitor:.*?\}\s*>\s*(-?[\d.]+)/);
    const lowerMatch = condition.match(/\$\{monitor:.*?\}\s*<\s*(-?[\d.]+)/);

    return {
      upper: upperMatch ? upperMatch[1] : null,
      lower: lowerMatch ? lowerMatch[1] : null
    };
  };

  // Handle alert submit
  const handleAlertSubmit = async () => {
    if (!alertMonitor) {
      console.error('No alertMonitor set');
      toast.error('Monitor not selected');
      return;
    }

    console.log('Starting alert submission for monitor:', alertMonitor.id);
    console.log('Form data:', alertFormData);

    try {
      // First, delete existing alert rules for this monitor
      console.log('Fetching existing rules...');
      const existingRulesResponse = await fetch(getApiUrl(`/api/alert-rules/by-monitor/${alertMonitor.id}`));
      if (existingRulesResponse.ok) {
        const existingRules = await existingRulesResponse.json();
        console.log('Existing rules to delete:', existingRules);
        for (const rule of existingRules) {
          console.log('Deleting rule:', rule.id);
          await fetch(getApiUrl(`/api/alert-rules/${rule.id}`), { method: 'DELETE' });
        }
      }

      // Build condition formula from thresholds
      const conditions = [];
      if (alertFormData.upper_threshold && alertFormData.upper_threshold.trim() !== '') {
        conditions.push(`\${monitor:${alertMonitor.id}} > ${alertFormData.upper_threshold}`);
      }
      if (alertFormData.lower_threshold && alertFormData.lower_threshold.trim() !== '') {
        conditions.push(`\${monitor:${alertMonitor.id}} < ${alertFormData.lower_threshold}`);
      }

      console.log('Conditions array:', conditions);

      if (conditions.length === 0) {
        console.error('No thresholds provided');
        toast.error('Please set at least one threshold');
        return;
      }

      const condition = conditions.join(' or ');

      // Calculate cooldown_seconds based on alert level
      const levelCooldowns: Record<string, number> = {
        'critical': 30,   // 30 seconds
        'high': 120,      // 2 minutes
        'medium': 300,    // 5 minutes
        'low': 900        // 15 minutes
      };
      const cooldown_seconds = levelCooldowns[alertFormData.alert_level] || 300;

      // Create new alert rule with level-appropriate cooldown
      const payload = {
        name: alertMonitor.name,
        condition: condition,
        level: alertFormData.alert_level,
        cooldown_seconds: cooldown_seconds,
        actions: ['pushover']
      };

      console.log('Creating alert rule with payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(getApiUrl('/api/alert-rules'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('Save response status:', response.status);
      console.log('Save response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Save error response:', errorText);
        toast.error(`Failed to save: ${errorText}`);
        throw new Error('Failed to save alert rule');
      }

      const savedRule = await response.json();
      console.log('Saved rule:', savedRule);

      toast.success('Alert configuration saved successfully');
      fetchAlertRules();  // Refresh alert rules list
      setAlertDialogOpen(false);
      resetAlertForm();
    } catch (error) {
      console.error('Error saving alert rule:', error);
      toast.error(`Failed to save alert configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle delete alert
  const handleDeleteAlert = async () => {
    if (!alertMonitor) return;
    if (!confirm('Are you sure you want to delete all alert rules for this monitor?')) return;

    try {
      // Get all alert rules for this monitor
      const rulesResponse = await fetch(getApiUrl(`/api/alert-rules/by-monitor/${alertMonitor.id}`));

      if (!rulesResponse.ok) throw new Error('Failed to fetch alert rules');

      const rules = await rulesResponse.json();

      // Delete each rule
      for (const rule of rules) {
        const deleteResponse = await fetch(getApiUrl(`/api/alert-rules/${rule.id}`), {
          method: 'DELETE'
        });

        if (!deleteResponse.ok) {
          console.error(`Failed to delete alert rule ${rule.id}`);
        }
      }

      toast.success(`Deleted ${rules.length} alert rule(s)`);
      setAlertDialogOpen(false);
      resetAlertForm();
    } catch (error) {
      console.error('Error deleting alert rules:', error);
      toast.error('Failed to delete alert rules');
    }
  };

  // Reset alert form data only (keep alertMonitor)
  const resetAlertFormData = () => {
    setAlertFormData({
      upper_threshold: '',
      lower_threshold: '',
      alert_level: 'medium'
    });
  };

  // Reset alert form completely (including alertMonitor)
  const resetAlertForm = () => {
    resetAlertFormData();
    setAlertMonitor(null);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Skeleton className="h-9 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex flex-col gap-y-4">
                <div className="flex flex-col gap-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="flex flex-col gap-y-1">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-24 w-full mt-4" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitors</h1>
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
        <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as 'all' | MonitorCategory)}>
          <TabsList className="mb-6">
            <TabsTrigger value="all">全部</TabsTrigger>
            {CATEGORIES.map(cat => (
              <TabsTrigger key={cat.id} value={cat.id}>
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="mt-0">
            {/* Category filter badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {CATEGORIES.map(cat => {
                const count = monitors.filter(m => getMonitorCategory(m.id) === cat.id).length;
                const isSelected = selectedCategories.has(cat.id);

                return (
                  <Badge
                    key={cat.id}
                    variant={isSelected ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleCategory(cat.id)}
                  >
                    {cat.label} ({count})
                  </Badge>
                );
              })}
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={getFilteredMonitors().map((m) => m.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {getFilteredMonitors().map((monitor) => {
                    const alertRule = getAlertRuleForMonitor(monitor.id);
                    const isAlert = alertRule ? isMonitorInAlert(monitor, alertRule) : false;

                    return (
                      <SortableMonitorCard
                        key={monitor.id}
                        monitor={monitor}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onSetAlert={handleSetAlert}
                        isAlert={isAlert}
                        alertLevel={alertRule?.level}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </TabsContent>

          {CATEGORIES.map(cat => (
            <TabsContent key={cat.id} value={cat.id} className="mt-0">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={getFilteredMonitors().map((m) => m.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {getFilteredMonitors().map((monitor) => {
                      const alertRule = getAlertRuleForMonitor(monitor.id);
                      const isAlert = alertRule ? isMonitorInAlert(monitor, alertRule) : false;

                      return (
                        <SortableMonitorCard
                          key={monitor.id}
                          monitor={monitor}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onSetAlert={handleSetAlert}
                          isAlert={isAlert}
                          alertLevel={alertRule?.level}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Alert Configuration Dialog */}
      <Dialog
        open={alertDialogOpen}
        onOpenChange={(open) => {
          setAlertDialogOpen(open);
          // Only reset form when dialog is closed
          if (!open) {
            resetAlertForm();
          }
        }}
      >
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
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
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
    </div>
  );
}
