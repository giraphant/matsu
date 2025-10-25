/**
 * Service Worker management hook
 * Handles registration, communication, and alert monitoring
 */

import { useEffect, useCallback, useRef } from 'react';
import { AlertLevel } from '@/lib/alerts';

export function useServiceWorker() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Register Service Worker
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      registerServiceWorker();
    } else {
      console.warn('[SW] Service Workers not supported in this browser');
    }

    // Listen for messages from Service Worker
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      registrationRef.current = registration;

      console.log('[SW] Service Worker registered successfully');

      // Wait for it to be active
      if (registration.active) {
        startMonitoring();
      } else if (registration.installing || registration.waiting) {
        const worker = registration.installing || registration.waiting;
        worker?.addEventListener('statechange', (e) => {
          const sw = e.target as ServiceWorker;
          if (sw.state === 'activated') {
            startMonitoring();
          }
        });
      }
    } catch (error) {
      console.error('[SW] Registration failed:', error);
    }
  };

  const handleServiceWorkerMessage = (event: MessageEvent) => {
    const { type, data } = event.data;

    switch (type) {
      case 'PLAY_SOUND':
        // Play alert sound in the page context
        playSound(data.soundFile, data.volume);
        break;

      case 'ALERT_TRIGGERED':
        console.log('[SW] Alert triggered:', data);
        // You can dispatch custom events here if needed
        window.dispatchEvent(new CustomEvent('alert-triggered', { detail: data }));
        break;

      case 'GET_SETTINGS':
        // Service Worker is requesting settings
        const settings = getBackgroundAlertSettings();
        event.ports[0].postMessage(settings);
        break;
    }
  };

  const playSound = (soundFile: string, volume: number) => {
    try {
      const audio = new Audio(soundFile);
      audio.volume = volume;
      audio.play().catch(e => console.error('[SW] Failed to play sound:', e));
    } catch (error) {
      console.error('[SW] Error playing sound:', error);
    }
  };

  const startMonitoring = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (navigator.serviceWorker?.controller) {
      console.log('[SW] Starting alert monitoring...');
      navigator.serviceWorker.controller.postMessage({
        type: 'START_MONITORING'
      });
    }
  }, []);

  const stopMonitoring = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (navigator.serviceWorker?.controller) {
      console.log('[SW] Stopping alert monitoring...');
      navigator.serviceWorker.controller.postMessage({
        type: 'STOP_MONITORING'
      });
    }
  }, []);

  const checkNow = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CHECK_NOW'
      });
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) {
      console.log('[SW] Browser does not support notifications');
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

  return {
    startMonitoring,
    stopMonitoring,
    checkNow,
    requestNotificationPermission,
    isSupported: typeof window !== 'undefined' && 'serviceWorker' in navigator
  };
}

// Helper function to get settings from localStorage
function getBackgroundAlertSettings() {
  try {
    const enabled = localStorage.getItem('backgroundAlertsEnabled');
    return {
      backgroundAlertsEnabled: enabled === null ? true : enabled === 'true'
    };
  } catch {
    return { backgroundAlertsEnabled: true };
  }
}
