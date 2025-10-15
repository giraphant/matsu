'use client';

import { useState, useEffect } from 'react';
import { DataTable } from './data-table';
import { columns, WebhookData } from './columns';
import { ChartDialog } from './chart-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function ChartsPage() {
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
    const interval = setInterval(fetchWebhooks, 60000); // Refresh every minute
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

  const handleViewChart = (webhook: WebhookData) => {
    setSelectedWebhook(webhook);
    setDialogOpen(true);
  };

  const handleViewDetails = (webhook: WebhookData) => {
    setSelectedWebhook(webhook);
    setDialogOpen(true);
  };

  const handleRefresh = () => {
    fetchWebhooks();
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
          <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
          <p className="text-muted-foreground">
            Monitor and analyze webhook data from Distill Web Monitor
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

      {/* Data Table */}
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
            onViewChart={handleViewChart}
            onViewDetails={handleViewDetails}
            pageSize={15}
          />
        </CardContent>
      </Card>

      {/* Chart Dialog */}
      <ChartDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        webhook={selectedWebhook}
      />
    </div>
  );
}