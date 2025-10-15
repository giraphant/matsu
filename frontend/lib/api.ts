// API client for connecting to the backend

const API_BASE_URL = '/api';

// Types
export interface Monitor {
  id: string;
  name: string;
  formula: string;
  unit?: string;
  description?: string;
  color?: string;
  decimal_places: number;
  enabled: boolean;
  value?: number;
  computed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  level: string;
  enabled: boolean;
  cooldown_seconds: number;
  actions: string[];
  created_at: string;
  updated_at: string;
}

export interface WebhookData {
  id: number;
  monitor_id: string;
  timestamp: string;
  data: any;
}

export interface ChartDataPoint {
  timestamp: number;
  value: number;
}

export interface DexRate {
  token_pair: string;
  rate: number;
  source: string;
  timestamp: string;
}

// API functions

// Monitors
export async function getMonitors(): Promise<Monitor[]> {
  const response = await fetch(`${API_BASE_URL}/monitors`);
  if (!response.ok) throw new Error('Failed to fetch monitors');
  return response.json();
}

export async function getMonitor(id: string): Promise<Monitor> {
  const response = await fetch(`${API_BASE_URL}/monitors/${id}`);
  if (!response.ok) throw new Error('Failed to fetch monitor');
  return response.json();
}

export async function createMonitor(data: Partial<Monitor>): Promise<Monitor> {
  const response = await fetch(`${API_BASE_URL}/monitors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create monitor');
  return response.json();
}

export async function updateMonitor(id: string, data: Partial<Monitor>): Promise<Monitor> {
  const response = await fetch(`${API_BASE_URL}/monitors/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update monitor');
  return response.json();
}

export async function deleteMonitor(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/monitors/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete monitor');
}

export async function getMonitorHistory(id: string, limit = 100): Promise<ChartDataPoint[]> {
  const response = await fetch(`${API_BASE_URL}/monitors/${id}/history?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch monitor history');
  return response.json();
}

// Alert Rules
export async function getAlertRules(): Promise<AlertRule[]> {
  const response = await fetch(`${API_BASE_URL}/alert-rules`);
  if (!response.ok) throw new Error('Failed to fetch alert rules');
  return response.json();
}

export async function createAlertRule(data: Partial<AlertRule>): Promise<AlertRule> {
  const response = await fetch(`${API_BASE_URL}/alert-rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create alert rule');
  return response.json();
}

export async function updateAlertRule(id: string, data: Partial<AlertRule>): Promise<AlertRule> {
  const response = await fetch(`${API_BASE_URL}/alert-rules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update alert rule');
  return response.json();
}

export async function deleteAlertRule(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/alert-rules/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete alert rule');
}

// Webhook Data
export async function getWebhookData(): Promise<WebhookData[]> {
  const response = await fetch(`${API_BASE_URL}/data`);
  if (!response.ok) throw new Error('Failed to fetch webhook data');
  return response.json();
}

export async function getChartData(monitorId: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/chart-data/${monitorId}`);
  if (!response.ok) throw new Error('Failed to fetch chart data');
  return response.json();
}

// DEX Funding Rates
export interface FundingRate {
  exchange: string;
  symbol: string;
  rate: number | null;
  rate_annualized?: number | null;
  funding_period_hours?: number;
  next_funding_time?: string | null;
  mark_price?: number | null;
  open_interest?: number | null;
  has_binance_spot?: boolean;
}

export interface FundingRatesResponse {
  rates: FundingRate[];
  last_updated: string;
  error?: string;
}

export async function getDexFundingRates(forceRefresh = false): Promise<FundingRatesResponse> {
  const response = await fetch(`${API_BASE_URL}/dex/funding-rates${forceRefresh ? '?force_refresh=true' : ''}`);
  if (!response.ok) throw new Error('Failed to fetch DEX funding rates');
  return response.json();
}

export async function getDexFundingRatesBySymbol(symbol: string, forceRefresh = false): Promise<FundingRatesResponse> {
  const response = await fetch(`${API_BASE_URL}/dex/funding-rates/${symbol}${forceRefresh ? '?force_refresh=true' : ''}`);
  if (!response.ok) throw new Error('Failed to fetch DEX funding rates for symbol');
  return response.json();
}

// Alerts
export async function getActiveAlerts(): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/alerts/active`);
  if (!response.ok) throw new Error('Failed to fetch active alerts');
  return response.json();
}

export async function getAlertHistory(limit = 50): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/alerts/history?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch alert history');
  return response.json();
}

// Pushover Configuration
export interface PushoverConfig {
  user_key: string;
  api_token?: string;
  updated_at?: string;
}

export async function getPushoverConfig(): Promise<PushoverConfig | null> {
  const response = await fetch(`${API_BASE_URL}/pushover/config`);
  if (!response.ok) return null;
  return response.json();
}

export async function savePushoverConfig(config: { user_key: string; api_token?: string }): Promise<PushoverConfig> {
  const response = await fetch(`${API_BASE_URL}/pushover/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error('Failed to save Pushover configuration');
  return response.json();
}

export async function testPushover(config: { user_key: string; api_token?: string }): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/pushover/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return response.ok;
}

// Funding Rate Alerts
export interface FundingRateAlert {
  id: number;
  name: string;
  alert_type: string;
  exchanges: string[];
  threshold: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_triggered_at?: string;
}

export async function getFundingRateAlerts(): Promise<FundingRateAlert[]> {
  const response = await fetch(`${API_BASE_URL}/dex/funding-rate-alerts`);
  if (!response.ok) throw new Error('Failed to fetch funding rate alerts');
  return response.json();
}

export async function createFundingRateAlert(alert: {
  name: string;
  alert_type: string;
  exchanges: string[];
  threshold: number;
  enabled: boolean;
}): Promise<FundingRateAlert> {
  const response = await fetch(`${API_BASE_URL}/dex/funding-rate-alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(alert),
  });
  if (!response.ok) throw new Error('Failed to create funding rate alert');
  return response.json();
}

export async function updateFundingRateAlert(id: number, alert: {
  name: string;
  alert_type: string;
  exchanges: string[];
  threshold: number;
  enabled: boolean;
}): Promise<FundingRateAlert> {
  const response = await fetch(`${API_BASE_URL}/dex/funding-rate-alerts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(alert),
  });
  if (!response.ok) throw new Error('Failed to update funding rate alert');
  return response.json();
}

export async function deleteFundingRateAlert(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/dex/funding-rate-alerts/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete funding rate alert');
}

// Utility function to check API health
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch('/health');
    return response.ok;
  } catch {
    return false;
  }
}