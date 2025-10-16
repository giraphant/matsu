'use client';

import { useState, useEffect } from 'react';
import { DataTable } from './data-table';
import { columns, WebhookData } from './columns';
import { columns as monitorColumns, MonitorData } from './monitors-columns';
import { columns as alertRuleColumns, AlertRuleData } from './alert-rules-columns';
import { ChartDialog } from './chart-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, TrendingUp, TrendingDown, Activity, Database } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function ChartsPage() {
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [monitors, setMonitors] = useState<MonitorData[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRuleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("webhooks");

  // Alert Rule Edit Dialog
  const [alertEditDialogOpen, setAlertEditDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AlertRuleData | null>(null);
  const [alertFormData, setAlertFormData] = useState({
    name: '',
    condition: '',
    level: 'medium',
    cooldown_seconds: 300,
  });

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    increasing: 0,
    decreasing: 0,
    unchanged: 0,
    avgChange: 0,
  });

  useEffect(() => {
    fetchWebhooks();
    fetchMonitors();
    fetchAlertRules();
    const interval = setInterval(() => {
      fetchWebhooks();
      fetchMonitors();
      fetchAlertRules();
    }, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchWebhooks = async () => {
    if (!loading) setRefreshing(true);
    try {
      const response = await fetch('/api/webhook-monitors');
      if (response.ok) {
        const data = await response.json();

        // Process webhook-monitors data and convert to WebhookData format
        const processedData: WebhookData[] = await Promise.all(data.map(async (monitor: any) => {
          // Calculate time since
          const timestamp = new Date(monitor.latest_timestamp);
          const now = new Date();
          const diffMs = now.getTime() - timestamp.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffMs / 86400000);

          let time_since = '';
          if (diffMins < 1) {
            time_since = 'Just now';
          } else if (diffMins < 60) {
            time_since = `${diffMins}m ago`;
          } else if (diffHours < 24) {
            time_since = `${diffHours}h ago`;
          } else {
            time_since = `${diffDays}d ago`;
          }

          // Extract current and calculate previous value from history
          const currentValue = monitor.latest_value || 0;
          let previousValue = 0;
          let changePercent = 0;

          // Fetch history to get previous value
          try {
            const historyResponse = await fetch(`/api/webhooks/${monitor.monitor_id}/history?limit=2`);
            if (historyResponse.ok) {
              const history = await historyResponse.json();
              if (history.length >= 2) {
                previousValue = history[1].value || 0;
                if (previousValue !== 0) {
                  changePercent = ((currentValue - previousValue) / previousValue) * 100;
                }
              }
            }
          } catch (error) {
            console.error('Failed to fetch history for', monitor.monitor_id, error);
          }

          // Parse description as data if it's JSON
          let dataObj = {};
          try {
            if (monitor.description) {
              dataObj = JSON.parse(monitor.description);
            }
          } catch {
            dataObj = { description: monitor.description };
          }

          // Extract tags from monitor_type or description
          const tags = [monitor.monitor_type || 'monitor'];
          if (monitor.unit) tags.push(monitor.unit);

          return {
            id: monitor.monitor_id,
            uid: monitor.monitor_id,
            title: monitor.monitor_name || monitor.monitor_id,
            text: monitor.description || `Latest: ${currentValue} ${monitor.unit || ''}`,
            tags: tags,
            data: dataObj,
            created_at: monitor.latest_timestamp,
            time_since: time_since,
            current_value: currentValue,
            previous_value: previousValue,
            change_percent: changePercent,
          };
        }));

        setWebhooks(processedData);
        calculateStats(processedData);
      }
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMonitors = async () => {
    try {
      const response = await fetch('/api/monitors');
      if (response.ok) {
        const data = await response.json();
        setMonitors(data);
      }
    } catch (error) {
      console.error('Failed to fetch monitors:', error);
    }
  };

  const fetchAlertRules = async () => {
    try {
      const response = await fetch('/api/alert-rules');
      if (response.ok) {
        const data = await response.json();
        setAlertRules(data);
      }
    } catch (error) {
      console.error('Failed to fetch alert rules:', error);
    }
  };

  const calculateStats = (data: WebhookData[]) => {
    const total = data.length;
    const increasing = data.filter(w => w.change_percent && w.change_percent > 0).length;
    const decreasing = data.filter(w => w.change_percent && w.change_percent < 0).length;
    const unchanged = total - increasing - decreasing;

    const avgChange = data.reduce((sum, w) => sum + (w.change_percent || 0), 0) / (total || 1);

    setStats({
      total,
      increasing,
      decreasing,
      unchanged,
      avgChange,
    });
  };

  const handleViewDetails = (webhook: WebhookData) => {
    setSelectedWebhook(webhook);
    setDialogOpen(true);
  };

  const handleDeleteWebhook = async (monitorId: string) => {
    if (!confirm('Are you sure you want to delete this webhook? All historical data will be permanently deleted.')) {
      return;
    }

    try {
      const response = await fetch(`/api/monitors/${monitorId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Webhook deleted successfully');
        fetchWebhooks();
      } else {
        throw new Error('Failed to delete webhook');
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      toast.error('Failed to delete webhook');
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'webhooks') {
      fetchWebhooks();
    } else if (activeTab === 'monitors') {
      fetchMonitors();
    } else if (activeTab === 'alerts') {
      fetchAlertRules();
    }
  };

  // Monitor handlers
  const handleMonitorToggle = async (monitor: MonitorData) => {
    try {
      const response = await fetch(`/api/monitors/${monitor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !monitor.enabled }),
      });
      if (response.ok) {
        fetchMonitors();
      }
    } catch (error) {
      console.error('Failed to toggle monitor:', error);
    }
  };

  const handleMonitorEdit = (monitor: MonitorData) => {
    // TODO: Implement edit dialog
    console.log('Edit monitor:', monitor);
  };

  const handleMonitorDelete = async (monitorId: string) => {
    if (!confirm('Are you sure you want to delete this monitor?')) return;
    try {
      const response = await fetch(`/api/monitors/${monitorId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchMonitors();
      }
    } catch (error) {
      console.error('Failed to delete monitor:', error);
    }
  };

  // Alert rule handlers
  const handleAlertRuleToggle = async (rule: AlertRuleData) => {
    try {
      const response = await fetch(`/api/alert-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (response.ok) {
        fetchAlertRules();
      }
    } catch (error) {
      console.error('Failed to toggle alert rule:', error);
    }
  };

  const handleAlertRuleEdit = (rule: AlertRuleData) => {
    setEditingAlert(rule);
    setAlertFormData({
      name: rule.name,
      condition: rule.condition,
      level: rule.level,
      cooldown_seconds: rule.cooldown_seconds,
    });
    setAlertEditDialogOpen(true);
  };

  const handleAlertRuleSave = async () => {
    if (!editingAlert) return;

    try {
      const response = await fetch(`/api/alert-rules/${editingAlert.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertFormData),
      });

      if (response.ok) {
        toast.success('Alert rule updated successfully');
        setAlertEditDialogOpen(false);
        fetchAlertRules();
      } else {
        throw new Error('Failed to update alert rule');
      }
    } catch (error) {
      console.error('Failed to save alert rule:', error);
      toast.error('Failed to save alert rule');
    }
  };

  const handleAlertRuleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this alert rule?')) return;
    try {
      const response = await fetch(`/api/alert-rules/${ruleId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchAlertRules();
      }
    } catch (error) {
      console.error('Failed to delete alert rule:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Management</h1>
          <p className="text-muted-foreground">
            Manage webhooks, monitors, and alert rules
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="monitors">Monitors</TabsTrigger>
          <TabsTrigger value="alerts">Alert Rules</TabsTrigger>
        </TabsList>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Monitors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">Active webhooks</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Increasing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold text-green-600">{stats.increasing}</span>
                </div>
                <p className="text-xs text-muted-foreground">Positive change</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Decreasing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  <span className="text-2xl font-bold text-red-600">{stats.decreasing}</span>
                </div>
                <p className="text-xs text-muted-foreground">Negative change</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Unchanged</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">{stats.unchanged}</div>
                <p className="text-xs text-muted-foreground">No change</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Avg. Change</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  stats.avgChange > 0 ? 'text-green-600' :
                  stats.avgChange < 0 ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {stats.avgChange.toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground">Average percentage</p>
              </CardContent>
            </Card>
          </div>

          {/* Webhooks Data Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Webhooks</CardTitle>
              <CardDescription>
                Click on any row to view detailed charts and historical data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={webhooks}
                meta={{
                  onViewDetails: handleViewDetails,
                  onDelete: handleDeleteWebhook,
                }}
                pageSize={15}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monitors Tab */}
        <TabsContent value="monitors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>All Monitors</CardTitle>
              <CardDescription>
                Manage and monitor your data sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={monitorColumns}
                data={monitors}
                meta={{
                  onToggle: handleMonitorToggle,
                  onEdit: handleMonitorEdit,
                  onDelete: handleMonitorDelete,
                }}
                filterColumns={[
                  { id: "name", placeholder: "Filter by name..." },
                  { id: "formula", placeholder: "Filter by formula..." }
                ]}
                pageSize={15}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alert Rules Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>All Alert Rules</CardTitle>
              <CardDescription>
                Configure alerting conditions and thresholds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={alertRuleColumns}
                data={alertRules}
                meta={{
                  onToggle: handleAlertRuleToggle,
                  onEdit: handleAlertRuleEdit,
                  onDelete: handleAlertRuleDelete,
                }}
                filterColumns={[
                  { id: "name", placeholder: "Filter by name..." },
                  { id: "condition", placeholder: "Filter by condition..." }
                ]}
                pageSize={15}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Chart Dialog */}
      <ChartDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        webhook={selectedWebhook}
      />

      {/* Alert Rule Edit Dialog */}
      <Dialog open={alertEditDialogOpen} onOpenChange={setAlertEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Alert Rule</DialogTitle>
            <DialogDescription>
              Modify the alert rule configuration
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="alert-name">Name</Label>
              <Input
                id="alert-name"
                value={alertFormData.name}
                onChange={(e) => setAlertFormData({ ...alertFormData, name: e.target.value })}
                placeholder="Alert rule name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="alert-condition">Condition</Label>
              <Textarea
                id="alert-condition"
                value={alertFormData.condition}
                onChange={(e) => setAlertFormData({ ...alertFormData, condition: e.target.value })}
                placeholder="e.g., ${monitor:id} > 100"
                className="font-mono text-sm"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Use $&#123;monitor:id&#125; or $&#123;webhook:id&#125; in conditions
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="alert-level">Level</Label>
                <Select
                  value={alertFormData.level}
                  onValueChange={(value) => setAlertFormData({ ...alertFormData, level: value })}
                >
                  <SelectTrigger id="alert-level">
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
              <div className="grid gap-2">
                <Label htmlFor="alert-cooldown">Cooldown (seconds)</Label>
                <Input
                  id="alert-cooldown"
                  type="number"
                  value={alertFormData.cooldown_seconds}
                  onChange={(e) => setAlertFormData({ ...alertFormData, cooldown_seconds: parseInt(e.target.value) || 300 })}
                  min={0}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlertEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAlertRuleSave}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}