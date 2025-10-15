/**
 * Monitors data hook
 */

import { useState, useEffect, useCallback } from 'react';
import { monitorApi } from '../api/monitors';
import { MonitorSummary } from '../types/monitor';

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

  // Optimistic update for constant cards (avoids full reload)
  const updateMonitorOptimistic = useCallback((monitorId: string, updates: Partial<MonitorSummary>) => {
    setMonitors(prev => prev.map(m =>
      m.monitor_id === monitorId ? { ...m, ...updates } : m
    ));
  }, []);

  // Add a new constant card optimistically
  const addMonitorOptimistic = useCallback((newMonitor: MonitorSummary) => {
    setMonitors(prev => [...prev, newMonitor]);
  }, []);

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
    deleteMonitor,
    updateMonitorOptimistic,
    addMonitorOptimistic
  };
}
