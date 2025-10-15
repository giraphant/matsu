import { useState, useCallback } from 'react';

export function usePushover() {
  const [pushoverUserKey, setPushoverUserKey] = useState('');
  const [pushoverApiToken, setPushoverApiToken] = useState('');

  const loadPushoverConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/pushover/config');
      if (response.ok) {
        const config = await response.json();
        if (config) {
          setPushoverUserKey(config.user_key || '');
          setPushoverApiToken(config.api_token || '');
        }
      }
    } catch (error) {
      console.error('Failed to load Pushover config:', error);
    }
  }, []);

  const savePushoverConfig = async () => {
    try {
      const response = await fetch('/api/pushover/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_key: pushoverUserKey,
          api_token: pushoverApiToken || null
        })
      });

      if (response.ok) {
        alert('Pushover configuration saved!');
      } else {
        alert('Failed to save Pushover configuration');
      }
    } catch (error) {
      console.error('Failed to save Pushover config:', error);
      alert('Error saving Pushover configuration');
    }
  };

  const testPushoverNotification = async () => {
    if (!pushoverUserKey) {
      alert('Please enter your Pushover User Key first');
      return;
    }

    try {
      const response = await fetch('/api/pushover/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_key: pushoverUserKey,
          api_token: pushoverApiToken || null
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Test notification sent! Check your Pushover app.');
      } else {
        const error = await response.json();
        alert(`Failed to send test notification: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
      alert('Error sending test notification');
    }
  };

  return {
    pushoverUserKey,
    setPushoverUserKey,
    pushoverApiToken,
    setPushoverApiToken,
    loadPushoverConfig,
    savePushoverConfig,
    testPushoverNotification
  };
}
