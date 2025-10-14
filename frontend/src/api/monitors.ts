/**
 * Monitors API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '../constants/api';
import { MonitorSummary, ChartData } from '../types/monitor';

export const monitorApi = {
  /**
   * Get all monitors summary
   */
  getAll: () =>
    apiClient.get<MonitorSummary[]>(API_ENDPOINTS.MONITORS),

  /**
   * Get chart data for a specific monitor
   */
  getChartData: (monitorId: string, days: number) =>
    apiClient.get<ChartData>(API_ENDPOINTS.CHART_DATA(monitorId, days)),

  /**
   * Update monitor unit
   */
  updateUnit: (monitorId: string, unit: string) =>
    apiClient.patch(
      `${API_ENDPOINTS.MONITOR_UNIT(monitorId)}?unit=${encodeURIComponent(unit)}`
    ),

  /**
   * Update monitor decimal places
   */
  updateDecimalPlaces: (monitorId: string, decimalPlaces: number) =>
    apiClient.patch(
      `${API_ENDPOINTS.MONITOR_DECIMAL(monitorId)}?decimal_places=${decimalPlaces}`
    ),

  /**
   * Delete a monitor
   */
  delete: (monitorId: string) =>
    apiClient.delete(API_ENDPOINTS.MONITOR_BY_ID(monitorId)),
};
