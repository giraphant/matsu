/**
 * API endpoint constants
 */

const API_BASE = '/api';

export const API_ENDPOINTS = {
  // Auth
  LOGIN: `${API_BASE}/auth/login`,

  // Webhook Monitors (legacy)
  MONITORS: `${API_BASE}/webhook-monitors`,
  MONITOR_BY_ID: (id: string) => `${API_BASE}/monitors/${id}`,
  MONITOR_UNIT: (id: string) => `${API_BASE}/monitors/${id}/unit`,
  MONITOR_DECIMAL: (id: string) => `${API_BASE}/monitors/${id}/decimal-places`,

  // Charts
  CHART_DATA: (id: string, days: number) => `${API_BASE}/chart-data/${id}?days=${days}`,

  // Alerts
  ALERT_CONFIGS: `${API_BASE}/alerts/configs`,
  ALERT_CONFIG: `${API_BASE}/alerts/config`,
  ALERT_CONFIG_BY_ID: (id: string) => `${API_BASE}/alerts/config/${id}`,

  // DEX
  DEX_RATES: `${API_BASE}/dex/funding-rates`,
  DEX_ALERT_CONFIG: `${API_BASE}/dex/funding-rate-alert-config`,

  // Constants
  CONSTANT: `${API_BASE}/constant`,
  CONSTANT_BY_ID: (id: string) => `${API_BASE}/constant/${id}`,

  // Pushover
  PUSHOVER_CONFIG: `${API_BASE}/pushover/config`,
  PUSHOVER_TEST: `${API_BASE}/pushover/test`,
} as const;
