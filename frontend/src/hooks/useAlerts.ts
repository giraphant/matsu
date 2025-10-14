/**
 * Alert management hook
 */

import { useState, useEffect, useCallback } from 'react';
import { alertApi } from '../api/alerts';
import { AlertThreshold } from '../types/alert';
import { Threshold } from '../types/monitor';

export function useAlerts() {
  const [thresholds, setThresholds] = useState<Map<string, Threshold>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadAlertConfigs = useCallback(async () => {
    try {
      const configs = await alertApi.getConfigs();
      const newThresholds = new Map<string, Threshold>();

      configs.forEach((config: AlertThreshold) => {
        newThresholds.set(config.monitor_id, {
          upper: config.upper_threshold,
          lower: config.lower_threshold,
          level: config.alert_level
        });
      });

      setThresholds(newThresholds);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load alert configs:', error);
      setLoading(false);
    }
  }, []);

  const updateThreshold = useCallback(async (
    monitorId: string,
    upper?: number,
    lower?: number,
    level?: string
  ) => {
    const newThresholds = new Map(thresholds);

    if (upper !== undefined || lower !== undefined) {
      const existing = newThresholds.get(monitorId);
      const thresholdData: Threshold = {
        upper,
        lower,
        level: level || existing?.level || 'medium'
      };
      newThresholds.set(monitorId, thresholdData);

      // Save to backend
      try {
        await alertApi.saveConfig({
          monitor_id: monitorId,
          upper_threshold: upper,
          lower_threshold: lower,
          alert_level: thresholdData.level as any
        });
      } catch (error) {
        console.error('Failed to save threshold to backend:', error);
      }
    } else {
      newThresholds.delete(monitorId);

      // Delete from backend
      try {
        await alertApi.deleteConfig(monitorId);
      } catch (error) {
        console.error('Failed to delete threshold from backend:', error);
      }
    }

    setThresholds(newThresholds);
  }, [thresholds]);

  const isValueOutOfRange = useCallback((value: number | null, monitorId: string): boolean => {
    if (value === null) return false;
    const threshold = thresholds.get(monitorId);
    if (!threshold) return false;
    if (threshold.upper !== undefined && value > threshold.upper) return true;
    if (threshold.lower !== undefined && value < threshold.lower) return true;
    return false;
  }, [thresholds]);

  useEffect(() => {
    loadAlertConfigs();

    // Sync alert configs every 60 seconds
    const interval = setInterval(loadAlertConfigs, 60000);
    return () => clearInterval(interval);
  }, [loadAlertConfigs]);

  return {
    thresholds,
    loading,
    loadAlertConfigs,
    updateThreshold,
    isValueOutOfRange
  };
}
