/**
 * Service Worker for background alert monitoring
 * Runs independently of page tabs, checking alerts every 10 seconds
 */

const CACHE_NAME = 'matsu-alerts-v1';
const API_BASE_URL = '/api';

// Alert configuration
const ALERT_LEVELS = {
  critical: { interval: 30, volume: 0.8, requireInteraction: true },
  high: { interval: 120, volume: 0.6, requireInteraction: false },
  medium: { interval: 300, volume: 0.3, requireInteraction: false },
  low: { interval: 900, volume: 0.1, requireInteraction: false }
};

const SOUND_FILES = {
  critical: '/sounds/alert-critical.mp3',
  high: '/sounds/alert-high.mp3',
  medium: '/sounds/alert-medium.mp3',
  low: '/sounds/alert-low.mp3'
};

const ALERT_ICONS = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢'
};

// Alert state storage
let alertStates = new Map();
let checkInterval = null;

// Install event
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    clients.claim().then(() => {
      console.log('[Service Worker] Claimed clients');
      // Start alert checking
      startAlertChecking();
    })
  );
});

// Message handler
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);

  if (event.data.type === 'START_MONITORING') {
    startAlertChecking();
  } else if (event.data.type === 'STOP_MONITORING') {
    stopAlertChecking();
  } else if (event.data.type === 'CHECK_NOW') {
    checkAlerts();
  }
});

// Start periodic alert checking
function startAlertChecking() {
  if (checkInterval) {
    console.log('[Service Worker] Alert checking already running');
    return;
  }

  console.log('[Service Worker] Starting alert monitoring...');

  // Check immediately
  checkAlerts();

  // Then check every 10 seconds
  checkInterval = setInterval(() => {
    checkAlerts();
  }, 10000);
}

// Stop alert checking
function stopAlertChecking() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log('[Service Worker] Stopped alert monitoring');
  }
}

// Main alert checking function
async function checkAlerts() {
  try {
    // Check if background alerts are enabled
    const settings = await getSettings();
    if (!settings.backgroundAlertsEnabled) {
      console.log('[Service Worker] Background alerts disabled, skipping check');
      return;
    }

    // Fetch monitors and alert rules
    const [monitors, alertRules] = await Promise.all([
      fetch(`${API_BASE_URL}/monitors`).then(r => r.json()),
      fetch(`${API_BASE_URL}/alert-rules`).then(r => r.json())
    ]);

    // Check each monitor against its alert rules
    for (const monitor of monitors) {
      const rule = alertRules.find(r => {
        try {
          // Check if rule condition mentions this monitor
          return r.condition.includes(`\${monitor:${monitor.id}}`);
        } catch {
          return false;
        }
      });

      if (!rule || !rule.enabled) continue;

      const isAlert = await evaluateAlertCondition(monitor, rule);
      const state = alertStates.get(monitor.id);
      const level = rule.level || 'medium';
      const alertConfig = ALERT_LEVELS[level];

      if (isAlert && monitor.value !== null) {
        // New alert or time to repeat
        const now = Date.now();
        const shouldNotify = !state?.isActive ||
          (now - (state.lastNotified || 0)) >= alertConfig.interval * 1000;

        if (shouldNotify) {
          // Trigger alert
          triggerAlert(monitor, rule, level);

          alertStates.set(monitor.id, {
            lastNotified: now,
            isActive: true
          });
        }
      } else if (state?.isActive) {
        // Clear alert state when value returns to normal
        alertStates.set(monitor.id, {
          lastNotified: state.lastNotified,
          isActive: false
        });
      }
    }

  } catch (error) {
    console.error('[Service Worker] Error checking alerts:', error);
  }
}

// Evaluate alert condition
async function evaluateAlertCondition(monitor, rule) {
  try {
    // Replace the current monitor's value
    let condition = rule.condition.replace(`\${monitor:${monitor.id}}`, monitor.value);

    // Replace other monitor references by fetching their current values
    const monitorMatches = condition.match(/\$\{monitor:([^}]+)\}/g);
    if (monitorMatches) {
      // Fetch all monitors to get their current values
      const monitors = await fetch(`${API_BASE_URL}/monitors`).then(r => r.json());
      const monitorMap = {};
      monitors.forEach(m => monitorMap[m.id] = m.value);

      // Replace each monitor reference
      monitorMatches.forEach(match => {
        const monitorId = match.match(/\$\{monitor:([^}]+)\}/)[1];
        const value = monitorMap[monitorId];
        if (value !== undefined && value !== null) {
          condition = condition.replace(match, value);
        }
      });
    }

    // Replace logical operators for JavaScript evaluation
    condition = condition.replace(/\bor\b/gi, '||').replace(/\band\b/gi, '&&');

    // Basic safety check - allow numbers, operators, spaces, and JavaScript logical operators
    if (!/^[\d\s\.\+\-\*\/\(\)<>=!&|]+$/.test(condition)) {
      console.warn('[Service Worker] Invalid condition format:', condition);
      return false;
    }

    return eval(condition);
  } catch (error) {
    console.error('[Service Worker] Error evaluating condition:', error);
    return false;
  }
}

// Trigger alert notification and sound
async function triggerAlert(monitor, rule, level) {
  const icon = ALERT_ICONS[level] || '⚠️';
  const title = `${icon} ${rule.name}`;

  // Format value with monitor's decimal_places setting
  const decimalPlaces = monitor.decimal_places !== undefined ? monitor.decimal_places : 2;
  const formattedValue = typeof monitor.value === 'number'
    ? monitor.value.toFixed(decimalPlaces)
    : monitor.value;

  const body = `${monitor.name}: ${formattedValue}${monitor.unit || ''}`;

  console.log(`[Service Worker] Alert triggered: ${title} - ${body}`);

  // Show notification
  if (Notification.permission === 'granted') {
    const alertConfig = ALERT_LEVELS[level];

    self.registration.showNotification(title, {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      tag: `alert-${monitor.id}`,
      requireInteraction: alertConfig.requireInteraction,
      data: {
        monitorId: monitor.id,
        level: level,
        url: '/monitors'
      }
    });
  }

  // Play alert sound
  playAlertSound(level);

  // Notify open clients
  notifyClients({
    type: 'ALERT_TRIGGERED',
    monitor: monitor,
    rule: rule,
    level: level
  });
}

// Play alert sound
async function playAlertSound(level) {
  try {
    const soundFile = SOUND_FILES[level];
    const alertConfig = ALERT_LEVELS[level];

    // Notify clients to play sound
    // (Service Worker can't directly play audio in all browsers)
    notifyClients({
      type: 'PLAY_SOUND',
      soundFile: soundFile,
      volume: alertConfig.volume
    });
  } catch (error) {
    console.error('[Service Worker] Error playing sound:', error);
  }
}

// Notify all connected clients
async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage(message);
  });
}

// Get settings from IndexedDB or default
async function getSettings() {
  // Try to get from clients first
  const clients = await self.clients.matchAll({ type: 'window' });

  if (clients.length > 0) {
    // Ask first client for settings
    return new Promise((resolve) => {
      const channel = new MessageChannel();

      channel.port1.onmessage = (event) => {
        resolve(event.data || { backgroundAlertsEnabled: true });
      };

      clients[0].postMessage(
        { type: 'GET_SETTINGS' },
        [channel.port2]
      );

      // Timeout fallback
      setTimeout(() => {
        resolve({ backgroundAlertsEnabled: true });
      }, 1000);
    });
  }

  // Default: enabled
  return { backgroundAlertsEnabled: true };
}

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/monitors';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

console.log('[Service Worker] Loaded successfully');
