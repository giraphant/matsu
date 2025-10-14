/**
 * Monitors data hook
 */

import { useState, useEffect, useCallback } from 'react';
import { monitorApi } from '../api/monitors';
import { MonitorSummary, ChartData } from '../types/monitor';

export function useMonitors(autoRefresh: boolean = true) {
  const [monitors, setMonitors] = useState<MonitorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMonitors = useCallback(async () => {
    try {
      const data = await monitorApi.getAll();
      setMonitors(data);
      setError(null);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitors');
      setLoading(false);
    }
  }, []);

  const updateUnit = useCallback(async (monitorId: string, unit: string) => {
    try {
      await monitorApi.updateUnit(monitorId, unit);
      await loadMonitors();
    } catch (err) {
      console.error('Failed to update unit:', err);
      throw err;
    }
  }, [loadMonitors]);

  const updateDecimalPlaces = useCallback(async (monitorId: string, decimalPlaces: number) => {
    try {
      await monitorApi.updateDecimalPlaces(monitorId, decimalPlaces);
      await loadMonitors();
    } catch (err) {
      console.error('Failed to update decimal places:', err);
      throw err;
    }
  }, [loadMonitors]);

  const deleteMonitor = useCallback(async (monitorId: string) => {
    try {
      await monitorApi.delete(monitorId);
      await loadMonitors();
    } catch (err) {
      console.error('Failed to delete monitor:', err);
      throw err;
    }
  }, [loadMonitors]);

  useEffect(() => {
    loadMonitors();

    if (autoRefresh) {
      // Refresh every 30 seconds
      const interval = setInterval(loadMonitors, 30000);
      return () => clearInterval(interval);
    }
  }, [loadMonitors, autoRefresh]);

  return {
    monitors,
    loading,
    error,
    loadMonitors,
    updateUnit,
    updateDecimalPlaces,
    deleteMonitor
  };
}

/**
 * Hook for loading chart data for a specific monitor
 */
export function useChartData(monitorId: string | null, days: number) {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!monitorId) {
      setChartData(null);
      return;
    }

    const loadChartData = async () => {
      try {
        setLoading(true);
        const data = await monitorApi.getChartData(monitorId, days);
        setChartData(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load chart data');
      } finally {
        setLoading(false);
      }
    };

    loadChartData();
  }, [monitorId, days]);

  return { chartData, loading, error };
}
