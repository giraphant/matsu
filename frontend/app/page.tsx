'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMonitors, getActiveAlerts, getWebhookData } from '@/lib/api';
import type { Monitor } from '@/lib/api';

export default function OverviewPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [dataPoints, setDataPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch monitors
        const monitorsData = await getMonitors();
        setMonitors(monitorsData);

        // Fetch active alerts
        try {
          const alertsData = await getActiveAlerts();
          setActiveAlerts(alertsData);
        } catch {
          // Alerts API might not be available
          setActiveAlerts([]);
        }

        // Fetch webhook data count
        try {
          const webhookData = await getWebhookData();
          setDataPoints(webhookData.length);
        } catch {
          setDataPoints(0);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load data. Please check your connection.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Overview</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Monitors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : monitors.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {monitors.filter(m => m.enabled).length} enabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : activeAlerts.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {activeAlerts.length === 0 ? 'All clear' : 'Needs attention'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : dataPoints}
            </div>
            <p className="text-xs text-muted-foreground">Total collected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : 'Healthy'}
            </div>
            <p className="text-xs text-muted-foreground">All systems operational</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Monitors</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : monitors.length === 0 ? (
              <div className="text-muted-foreground">No monitors configured</div>
            ) : (
              <div className="space-y-2">
                {monitors.slice(0, 5).map((monitor) => (
                  <div key={monitor.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{monitor.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {monitor.value !== undefined
                          ? `${monitor.value.toFixed(monitor.decimal_places)} ${monitor.unit || ''}`
                          : 'No data'}
                      </div>
                    </div>
                    <div className={`h-2 w-2 rounded-full ${monitor.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : activeAlerts.length === 0 ? (
              <div className="text-muted-foreground">No active alerts</div>
            ) : (
              <div className="space-y-2">
                {activeAlerts.slice(0, 5).map((alert, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{alert.title || 'Alert'}</div>
                      <div className="text-sm text-muted-foreground">
                        {alert.message || 'Alert triggered'}
                      </div>
                    </div>
                    <div className={`h-2 w-2 rounded-full bg-yellow-500`} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}