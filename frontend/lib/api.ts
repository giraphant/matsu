// API client for connecting to the backend

const API_BASE_URL = '/api';

// Types
// Monitor interface with heartbeat support
export interface Monitor {
  id: string;
  name: string;
  formula: string;
  unit?: string;
  description?: string;
  color?: string;
  decimal_places: number;
  tags?: string[];
  enabled: boolean;
  heartbeat_enabled: boolean;
  heartbeat_interval?: number;
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
  heartbeat_enabled: boolean;
  heartbeat_interval?: number;
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
  id: number;
  name: string;
  user_key: string;
  api_token?: string;
  enabled: boolean;
  min_alert_level: string;  // low, medium, high, critical
  created_at: string;
  updated_at: string;
}

export async function getPushoverConfigs(): Promise<PushoverConfig[]> {
  const response = await fetch(`${API_BASE_URL}/pushover/configs`);
  if (!response.ok) throw new Error('Failed to fetch Pushover configurations');
  return response.json();
}

export async function getPushoverConfig(id: number): Promise<PushoverConfig> {
  const response = await fetch(`${API_BASE_URL}/pushover/config/${id}`);
  if (!response.ok) throw new Error('Failed to fetch Pushover configuration');
  return response.json();
}

export async function createPushoverConfig(config: {
  name: string;
  user_key: string;
  api_token?: string;
  enabled?: boolean;
  min_alert_level?: string;
}): Promise<PushoverConfig> {
  const response = await fetch(`${API_BASE_URL}/pushover/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error('Failed to create Pushover configuration');
  return response.json();
}

export async function updatePushoverConfig(
  id: number,
  config: {
    name?: string;
    user_key?: string;
    api_token?: string;
    enabled?: boolean;
    min_alert_level?: string;
  }
): Promise<PushoverConfig> {
  const response = await fetch(`${API_BASE_URL}/pushover/config/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error('Failed to update Pushover configuration');
  return response.json();
}

export async function deletePushoverConfig(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/pushover/config/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete Pushover configuration');
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

// App Settings
export interface AppSetting {
  key: string;
  value: string;
  description?: string;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const response = await fetch(`${API_BASE_URL}/settings`);
  if (!response.ok) throw new Error('Failed to fetch settings');
  return response.json();
}

export async function getSetting(key: string): Promise<AppSetting> {
  const response = await fetch(`${API_BASE_URL}/settings/${key}`);
  if (!response.ok) throw new Error(`Failed to fetch setting: ${key}`);
  return response.json();
}

export async function updateSetting(key: string, value: string): Promise<AppSetting> {
  const response = await fetch(`${API_BASE_URL}/settings/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  if (!response.ok) throw new Error(`Failed to update setting: ${key}`);
  return response.json();
}

// DEX Accounts
export interface DexAccount {
  id: number;
  name: string;
  exchange: string;
  address: string;
  enabled: boolean;
  tags?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export async function getDexAccounts(exchange?: string, enabled?: boolean): Promise<DexAccount[]> {
  const params = new URLSearchParams();
  if (exchange) params.append('exchange', exchange);
  if (enabled !== undefined) params.append('enabled', String(enabled));

  const url = `${API_BASE_URL}/dex-accounts${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch DEX accounts');
  return response.json();
}

export async function getDexAccount(id: number): Promise<DexAccount> {
  const response = await fetch(`${API_BASE_URL}/dex-accounts/${id}`);
  if (!response.ok) throw new Error('Failed to fetch DEX account');
  return response.json();
}

export async function createDexAccount(account: {
  name: string;
  exchange: string;
  address: string;
  enabled?: boolean;
  tags?: string[];
  notes?: string;
}): Promise<DexAccount> {
  const response = await fetch(`${API_BASE_URL}/dex-accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  });
  if (!response.ok) throw new Error('Failed to create DEX account');
  return response.json();
}

export async function updateDexAccount(
  id: number,
  account: {
    name?: string;
    exchange?: string;
    address?: string;
    enabled?: boolean;
    tags?: string[];
    notes?: string;
  }
): Promise<DexAccount> {
  const response = await fetch(`${API_BASE_URL}/dex-accounts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  });
  if (!response.ok) throw new Error('Failed to update DEX account');
  return response.json();
}

export async function deleteDexAccount(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/dex-accounts/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete DEX account');
}