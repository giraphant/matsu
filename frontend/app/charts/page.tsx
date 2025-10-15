'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getMonitors, getMonitorHistory, getWebhookData } from '@/lib/api';
import type { Monitor, ChartDataPoint } from '@/lib/api';

export default function ChartsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMonitors() {
      try {
        setLoading(true);
        setError(null);

        // Fetch monitors
        const monitorsData = await getMonitors();
        setMonitors(monitorsData);

        // Select first monitor by default
        if (monitorsData.length > 0 && !selectedMonitor) {
          setSelectedMonitor(monitorsData[0].id);
        }

        // Fetch recent webhook data
        try {
          const webhookData = await getWebhookData();
          setRecentEvents(webhookData.slice(0, 10));
        } catch {
          setRecentEvents([]);
        }
      } catch (err) {
        console.error('Failed to fetch monitors:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchMonitors();
  }, []);

  useEffect(() => {
    async function fetchChartData() {
      if (!selectedMonitor) return;

      try {
        const history = await getMonitorHistory(selectedMonitor, 100);

        // Format data for recharts
        const formattedData = history.map(point => ({
          ...point,
          time: new Date(point.timestamp).toLocaleTimeString(),
          date: new Date(point.timestamp).toLocaleDateString(),
        }));

        setChartData(formattedData);
      } catch (err) {
        console.error('Failed to fetch chart data:', err);
        setChartData([]);
      }
    }

    fetchChartData();

    // Refresh chart data every 30 seconds
    const interval = setInterval(fetchChartData, 30000);

    return () => clearInterval(interval);
  }, [selectedMonitor]);

  const selectedMonitorData = monitors.find(m => m.id === selectedMonitor);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Charts</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Activity Overview</CardTitle>
            <CardDescription>
              {selectedMonitorData ? `Monitoring: ${selectedMonitorData.name}` : 'Select a monitor to view data'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {loading ? (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : monitors.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No monitors configured
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No data available for this monitor
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={selectedMonitorData?.color || '#3b82f6'}
                    strokeWidth={2}
                    dot={false}
                    name={selectedMonitorData?.name || 'Value'}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Monitor Selection</CardTitle>
            <CardDescription>
              Choose a monitor to display
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {monitors.map(monitor => (
                <button
                  key={monitor.id}
                  onClick={() => setSelectedMonitor(monitor.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent ${
                    selectedMonitor === monitor.id ? 'border-primary bg-accent' : ''
                  }`}
                >
                  <div className="font-medium">{monitor.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {monitor.description || 'No description'}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Last value: {monitor.value !== undefined
                      ? `${monitor.value.toFixed(monitor.decimal_places)} ${monitor.unit || ''}`
                      : 'No data'}
                  </div>
                </button>
              ))}
              {monitors.length === 0 && !loading && (
                <div className="text-center text-muted-foreground py-8">
                  No monitors available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Webhook Events</CardTitle>
          <CardDescription>Latest incoming webhook data</CardDescription>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No recent events
            </div>
          ) : (
            <div className="space-y-2">
              {recentEvents.map((event, idx) => (
                <div key={idx} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {event.monitor_id || 'Unknown Monitor'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {JSON.stringify(event.data).substring(0, 100)}...
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}