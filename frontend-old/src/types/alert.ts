/**
 * Alert and notification types
 */

export type AlertLevel = 'critical' | 'high' | 'medium' | 'low';

export interface AlertConfig {
  interval: number;
  volume: number;
  requireInteraction: boolean;
}

export interface AlertState {
  lastNotified: number;
  isActive: boolean;
}

export interface AlertThreshold {
  monitor_id: string;
  upper_threshold?: number;
  lower_threshold?: number;
  alert_level?: AlertLevel;
}
