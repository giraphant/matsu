import { useState, useEffect, useCallback } from 'react';
import { ChartData, MonitorSummary } from '../types';

export function useChartData() {
  const [selectedMonitor, setSelectedMonitor] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [days, setDays] = useState(7);
  const [miniChartData, setMiniChartData] = useState<Map<string, any[]>>(new Map());

  // Load chart data for detail view
  useEffect(() => {
    if (selectedMonitor) {
      loadChartData(selectedMonitor, days);
    }
  }, [selectedMonitor, days]);

  const loadChartData = async (monitorId: string, daysParam: number) => {
    try {
      const response = await fetch(`/api/chart-data/${monitorId}?days=${daysParam}`);
      const data = await response.json();
      setChartData(data);
    } catch (error) {
      console.error('Failed to load chart data:', error);
    }
  };

  // Downsample data points for performance - keep only every Nth point
  const downsampleData = (data: any[], maxPoints: number = 50): any[] => {
    if (data.length <= maxPoints) return data;
    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, index) => index % step === 0 || index === data.length - 1);
  };

  const loadMiniChartData = useCallback(async (monitorList: MonitorSummary[]) => {
    const newMiniData = new Map();
    await Promise.all(
      monitorList.map(async (monitor) => {
        try {
          const response = await fetch(`/api/chart-data/${monitor.monitor_id}?days=7`);
          const data = await response.json();
          // Convert timestamp strings to Unix timestamps (milliseconds)
          const chartData = (data.data || []).map((point: any) => ({
            ...point,
            timestamp: new Date(point.timestamp).getTime()
          }));
          // Downsample to max 50 points for mini charts
          const sampledData = downsampleData(chartData, 50);
          newMiniData.set(monitor.monitor_id, sampledData);
        } catch (error) {
          console.error(`Failed to load mini chart for ${monitor.monitor_id}:`, error);
        }
      })
    );
    setMiniChartData(newMiniData);
  }, []);

  const clearSelection = () => {
    setSelectedMonitor(null);
    setChartData(null);
  };

  return {
    selectedMonitor,
    setSelectedMonitor,
    chartData,
    days,
    setDays,
    miniChartData,
    loadMiniChartData,
    clearSelection
  };
}
