/**
 * Alerts API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '../constants/api';
import { AlertThreshold } from '../types/alert';

export const alertApi = {
  /**
   * Get all alert configurations
   */
  getConfigs: () =>
    apiClient.get<AlertThreshold[]>(API_ENDPOINTS.ALERT_CONFIGS),

  /**
   * Save or update alert configuration
   */
  saveConfig: (config: AlertThreshold) =>
    apiClient.post(API_ENDPOINTS.ALERT_CONFIG, config),

  /**
   * Delete alert configuration
   */
  deleteConfig: (monitorId: string) =>
    apiClient.delete(API_ENDPOINTS.ALERT_CONFIG_BY_ID(monitorId)),
};
