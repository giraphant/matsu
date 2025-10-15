/**
 * Browser notification and alert sound hook
 */

import { useEffect, useCallback } from 'react';
import { AlertLevel, ALERT_LEVELS, SOUND_FILES } from '@/lib/alerts';

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

  return {
    requestNotificationPermission,
    playAlertSound
  };
}
