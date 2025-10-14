/**
 * Browser notification hook
 */

import { useEffect, useCallback } from 'react';
import { MonitorSummary } from '../types/monitor';
import { AlertLevel } from '../types/alert';
import { ALERT_LEVELS, SOUND_FILES, ALERT_ICONS } from '../constants/alerts';
import { formatValue } from '../utils/format';

export function useNotification() {
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  const playAlertSound = useCallback((level: AlertLevel) => {
    const config = ALERT_LEVELS[level];
    const soundFile = SOUND_FILES[level];

    const audio = new Audio(soundFile);
    audio.volume = config.volume;

    audio.addEventListener('error', (e) => {
      console.error(`[Alert Sound] Failed to load audio: ${soundFile}`, e);
    });

    audio.play().catch(e => console.error('[Alert Sound] Play failed:', e));
  }, []);

  const showDesktopNotification = useCallback((
    monitor: MonitorSummary,
    level: AlertLevel,
    value: number,
    threshold: { upper?: number; lower?: number },
    monitorName: string
  ) => {
    if (!('Notification' in window)) {
      console.log('Desktop notifications not supported on this browser');
      return;
    }

    const config = ALERT_LEVELS[level];
    const icon = ALERT_ICONS[level];

    const thresholdText = threshold?.upper
      ? `>${formatValue(threshold.upper, monitor.unit, monitor.decimal_places)}`
      : `<${formatValue(threshold?.lower || 0, monitor.unit, monitor.decimal_places)}`;

    new Notification(`${icon} ${monitorName} Alert`, {
      body: `Current: ${formatValue(value, monitor.unit, monitor.decimal_places)}\nThreshold: ${thresholdText}`,
      icon: '/favicon.ico',
      tag: monitor.monitor_id,
      requireInteraction: config.requireInteraction
    });

    playAlertSound(level);
  }, [playAlertSound]);

  return {
    requestNotificationPermission,
    showDesktopNotification,
    playAlertSound
  };
}
