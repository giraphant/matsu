/**
 * Settings View - Application settings and configuration
 */

import React from 'react';

interface SettingsViewProps {
  pushoverUserKey: string;
  pushoverApiToken: string;
  onSetPushoverUserKey: (key: string) => void;
  onSetPushoverApiToken: (token: string) => void;
  onSavePushoverConfig: () => void;
  onTestPushoverNotification: () => void;
}

export function SettingsView({
  pushoverUserKey,
  pushoverApiToken,
  onSetPushoverUserKey,
  onSetPushoverApiToken,
  onSavePushoverConfig,
  onTestPushoverNotification
}: SettingsViewProps) {
  return (
    <div className="settings-container" style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '24px'
    }}>
      <h2 style={{ marginBottom: '24px' }}>Settings</h2>

      {/* Pushover Configuration */}
      <div className="settings-section" style={{
        backgroundColor: 'var(--card)',
        padding: '24px',
        borderRadius: 'calc(var(--radius) + 2px)',
        border: '1px solid var(--border)',
        marginBottom: '24px'
      }}>
        <h3 style={{ marginBottom: '16px' }}>Pushover Notifications</h3>
        <p style={{
          color: 'var(--muted-foreground)',
          marginBottom: '24px',
          fontSize: '14px'
        }}>
          Configure Pushover to receive alert notifications on your devices
        </p>

        <div className="pushover-form">
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              Pushover User Key *
            </label>
            <input
              type="password"
              placeholder="Your 30-character user key"
              value={pushoverUserKey}
              onChange={(e) => onSetPushoverUserKey(e.target.value)}
              className="form-input"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid var(--border)',
                borderRadius: 'calc(var(--radius) - 2px)',
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)'
              }}
            />
            <small style={{
              display: 'block',
              marginTop: '6px',
              color: 'var(--muted-foreground)',
              fontSize: '12px'
            }}>
              Find this in your Pushover account settings
            </small>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              API Token (Optional)
            </label>
            <input
              type="password"
              placeholder="Leave empty to use default"
              value={pushoverApiToken}
              onChange={(e) => onSetPushoverApiToken(e.target.value)}
              className="form-input"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid var(--border)',
                borderRadius: 'calc(var(--radius) - 2px)',
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)'
              }}
            />
            <small style={{
              display: 'block',
              marginTop: '6px',
              color: 'var(--muted-foreground)',
              fontSize: '12px'
            }}>
              Use default token or create your own app in Pushover
            </small>
          </div>

          <div className="pushover-info" style={{
            backgroundColor: 'var(--muted)',
            padding: '16px',
            borderRadius: 'calc(var(--radius) - 2px)',
            marginBottom: '24px'
          }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600' }}>
              How to get your Pushover User Key:
            </h4>
            <ol style={{
              marginLeft: '20px',
              marginBottom: '12px',
              fontSize: '13px',
              lineHeight: '1.6'
            }}>
              <li>Sign up or log in at <a
                href="https://pushover.net"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--primary)' }}
              >
                pushover.net
              </a></li>
              <li>Your user key is shown on the main page</li>
              <li>Copy and paste it above</li>
            </ol>
            <p style={{ fontSize: '13px', margin: 0 }}>
              <strong>Note:</strong> Pushover costs $5 one-time on iOS/Android after 7-day trial
            </p>
          </div>

          <div className="pushover-actions" style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              className="btn-secondary"
              onClick={onTestPushoverNotification}
            >
              Test Notification
            </button>
            <button
              className="btn-primary"
              onClick={onSavePushoverConfig}
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
