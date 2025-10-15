/**
 * Alert configuration constants
 */

export type AlertLevel = 'critical' | 'high' | 'medium' | 'low';

export interface AlertConfig {
  interval: number; // seconds between repeated alerts
  volume: number; // 0.0 to 1.0
  requireInteraction: boolean; // whether notification requires user interaction
}

export const ALERT_LEVELS: Record<AlertLevel, AlertConfig> = {
  critical: { interval: 30, volume: 0.8, requireInteraction: true },
  high: { interval: 120, volume: 0.6, requireInteraction: false },
  medium: { interval: 300, volume: 0.3, requireInteraction: false },
  low: { interval: 900, volume: 0.1, requireInteraction: false }
};

export const SOUND_FILES: Record<AlertLevel, string> = {
  critical: '/sounds/alert-critical.mp3',
  high: '/sounds/alert-high.mp3',
  medium: '/sounds/alert-medium.mp3',
  low: '/sounds/alert-low.mp3'
};

export const ALERT_ICONS: Record<AlertLevel, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢'
};
