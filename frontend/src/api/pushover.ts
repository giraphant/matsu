/**
 * Pushover notifications API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '../constants/api';

interface PushoverConfig {
  user_key: string;
  api_token?: string | null;
}

export const pushoverApi = {
  /**
   * Get Pushover configuration
   */
  getConfig: () =>
    apiClient.get<PushoverConfig | null>(API_ENDPOINTS.PUSHOVER_CONFIG),

  /**
   * Save Pushover configuration
   */
  saveConfig: (config: PushoverConfig) =>
    apiClient.post(API_ENDPOINTS.PUSHOVER_CONFIG, config),

  /**
   * Send test notification
   */
  sendTest: (config: PushoverConfig) =>
    apiClient.post<{ message?: string }>(API_ENDPOINTS.PUSHOVER_TEST, config),
};
