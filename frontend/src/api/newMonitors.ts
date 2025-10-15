/**
 * API client for new unified Monitor System
 * All monitors are just formulas - no type distinction
 */

export interface NewMonitor {
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

export interface MonitorCreate {
  name: string;
  formula: string;
  unit?: string;
  description?: string;
  color?: string;
  decimal_places?: number;
}

export interface MonitorUpdate {
  name?: string;
  formula?: string;
  unit?: string;
  description?: string;
  color?: string;
  decimal_places?: number;
  enabled?: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  level: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
  cooldown_seconds: number;
  actions: string[];
  created_at: string;
  updated_at: string;
}

export interface AlertRuleCreate {
  name: string;
  condition: string;
  level?: 'critical' | 'high' | 'medium' | 'low';
  cooldown_seconds?: number;
  actions?: string[];
}

export interface AlertRuleUpdate {
  name?: string;
  condition?: string;
  level?: 'critical' | 'high' | 'medium' | 'low';
  enabled?: boolean;
  cooldown_seconds?: number;
  actions?: string[];
}

const API_BASE = '/api';

export const newMonitorApi = {
  // Monitor CRUD
  async getAll(): Promise<NewMonitor[]> {
    const response = await fetch(`${API_BASE}/monitors`);
    if (!response.ok) throw new Error('Failed to fetch monitors');
    return response.json();
  },

  async getById(id: string): Promise<NewMonitor> {
    const response = await fetch(`${API_BASE}/monitors/${id}`);
    if (!response.ok) throw new Error('Failed to fetch monitor');
    return response.json();
  },

  async create(data: MonitorCreate): Promise<NewMonitor> {
    const response = await fetch(`${API_BASE}/monitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create monitor: ${error}`);
    }
    return response.json();
  },

  async update(id: string, data: MonitorUpdate): Promise<NewMonitor> {
    const response = await fetch(`${API_BASE}/monitors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update monitor');
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/monitors/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete monitor');
  },

  async recomputeAll(): Promise<{ monitors: string[] }> {
    const response = await fetch(`${API_BASE}/monitors/recompute`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to recompute monitors');
    return response.json();
  }
};

export const alertRuleApi = {
  // Alert Rule CRUD
  async getAll(): Promise<AlertRule[]> {
    const response = await fetch(`${API_BASE}/alert-rules`);
    if (!response.ok) throw new Error('Failed to fetch alert rules');
    return response.json();
  },

  async create(data: AlertRuleCreate): Promise<AlertRule> {
    const response = await fetch(`${API_BASE}/alert-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create alert rule: ${error}`);
    }
    return response.json();
  },

  async update(id: string, data: AlertRuleUpdate): Promise<AlertRule> {
    const response = await fetch(`${API_BASE}/alert-rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update alert rule');
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/alert-rules/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete alert rule');
  },

  async checkAlerts(): Promise<{ triggered_alerts: any[] }> {
    const response = await fetch(`${API_BASE}/alert-rules/check`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to check alerts');
    return response.json();
  }
};
