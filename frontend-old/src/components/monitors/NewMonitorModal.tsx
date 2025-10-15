/**
 * Modal for creating/editing monitors
 */

import React, { useState, useEffect } from 'react';
import { NewMonitor, MonitorCreate } from '../../api/newMonitors';
import { monitorApi } from '../../api/monitors';

interface NewMonitorModalProps {
  show: boolean;
  monitor: NewMonitor | null;
  existingMonitors: NewMonitor[];
  onClose: () => void;
  onSave: (data: MonitorCreate) => Promise<void>;
}

interface WebhookMonitor {
  monitor_id: string;
  monitor_name: string;
  latest_value: number | null;
  unit?: string;
}

// Helper to get CSS variable value
const getCSSVar = (varName: string): string => {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
};

// Color presets for monitors - using CSS variables
const COLOR_PRESETS = [
  { name: 'Orange', cssVar: '--primary', fallback: '#f97316' },
  { name: 'Blue', cssVar: null, fallback: '#3b82f6' },
  { name: 'Purple', cssVar: null, fallback: '#8b5cf6' },
  { name: 'Green', cssVar: null, fallback: '#10b981' },
  { name: 'Red', cssVar: null, fallback: '#ef4444' },
  { name: 'Slate', cssVar: null, fallback: '#64748b' }
];

export default function NewMonitorModal({
  show,
  monitor,
  existingMonitors,
  onClose,
  onSave
}: NewMonitorModalProps) {
  const [name, setName] = useState('');
  const [formula, setFormula] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [decimalPlaces, setDecimalPlaces] = useState(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [webhookMonitors, setWebhookMonitors] = useState<WebhookMonitor[]>([]);
  const [resolvedColors, setResolvedColors] = useState<Array<{name: string, value: string}>>([]);

  // Resolve CSS variables to actual colors
  useEffect(() => {
    const colors = COLOR_PRESETS.map(preset => ({
      name: preset.name,
      value: preset.cssVar ? getCSSVar(preset.cssVar) || preset.fallback : preset.fallback
    }));
    setResolvedColors(colors);

    // Set default color to first resolved color (primary)
    if (!color && colors.length > 0) {
      setColor(colors[0].value);
    }
  }, []);

  // Load webhook monitors when modal opens
  useEffect(() => {
    if (show) {
      monitorApi.getAll().then(monitors => {
        setWebhookMonitors(monitors as any);
      }).catch(err => {
        console.error('Failed to load webhook monitors:', err);
      });
    }
  }, [show]);

  useEffect(() => {
    if (show && monitor) {
      setName(monitor.name);
      setFormula(monitor.formula);
      setUnit(monitor.unit || '');
      setDescription(monitor.description || '');
      setColor(monitor.color || (resolvedColors.length > 0 ? resolvedColors[0].value : ''));
      setDecimalPlaces(monitor.decimal_places);
    } else if (show && !monitor) {
      setName('');
      setFormula('');
      setUnit('');
      setDescription('');
      setColor(resolvedColors.length > 0 ? resolvedColors[0].value : '');
      setDecimalPlaces(2);
    }
    setError('');
  }, [show, monitor, resolvedColors]);

  const handleSave = async () => {
    if (!name.trim() || !formula.trim()) {
      setError('Name and formula are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSave({
        name: name.trim(),
        formula: formula.trim(),
        unit: unit.trim() || undefined,
        description: description.trim() || undefined,
        color: color,
        decimal_places: decimalPlaces
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save monitor');
    } finally {
      setSaving(false);
    }
  };

  const insertMonitor = (monitorId: string) => {
    const variable = `\${monitor:${monitorId}}`;
    setFormula(prev => prev + variable);
  };

  const insertWebhook = (webhookId: string) => {
    const variable = `\${webhook:${webhookId}}`;
    setFormula(prev => prev + variable);
  };

  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <h3>{monitor ? 'Edit Monitor' : 'Create New Monitor'}</h3>

        {error && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: 'var(--destructive)',
            color: 'white',
            borderRadius: 'calc(var(--radius) - 2px)'
          }}>
            {error}
          </div>
        )}

        <div className="monitor-modal-form">
          <div className="form-group">
            <label>Monitor Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., BTC-ETH Spread"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Formula *</label>
            <textarea
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="Examples:&#10;Constant: 100&#10;Reference: ${monitor:id}&#10;Computed: ${monitor:a} - ${monitor:b}"
              rows={4}
              className="form-textarea"
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
            />
            <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '6px' }}>
              Use ${'{monitor:id}'} to reference other monitors. Supports +, -, *, /, abs(), max(), min()
            </p>
          </div>

          {webhookMonitors.length > 0 && (
            <div className="form-group">
              <label>Insert Webhook Reference</label>
              <div className="monitor-list-select">
                {webhookMonitors.map(wm => (
                  <div
                    key={wm.monitor_id}
                    onClick={() => insertWebhook(wm.monitor_id)}
                    className="monitor-list-item"
                  >
                    <span className="name">{wm.monitor_name}</span>
                    <span className="current-value">
                      (current: {wm.latest_value !== null ? wm.latest_value.toFixed(2) : 'N/A'} {wm.unit || ''})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {existingMonitors.length > 0 && (
            <div className="form-group">
              <label>Insert Monitor Reference</label>
              <div className="monitor-list-select">
                {existingMonitors
                  .filter(m => !monitor || m.id !== monitor.id)
                  .map(m => (
                    <div
                      key={m.id}
                      onClick={() => insertMonitor(m.id)}
                      className="monitor-list-item"
                    >
                      <span className="name">{m.name}</span>
                      <span className="current-value">
                        (current: {m.value?.toFixed(m.decimal_places) || 'N/A'})
                      </span>
                    </div>
                  ))}
              </div>
              {existingMonitors.filter(m => !monitor || m.id !== monitor.id).length === 0 && (
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', padding: '8px', textAlign: 'center' }}>
                  No other monitors available to reference
                </p>
              )}
            </div>
          )}

          <div className="monitor-modal-row">
            <div className="form-group">
              <label>Unit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g., USD, %"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Decimal Places</label>
              <input
                type="number"
                value={decimalPlaces}
                onChange={(e) => setDecimalPlaces(parseInt(e.target.value) || 0)}
                min="0"
                max="8"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="form-textarea"
            />
          </div>

          <div className="form-group">
            <label>Color</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '8px',
              marginTop: '8px'
            }}>
              {resolvedColors.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  title={preset.name}
                  style={{
                    width: '100%',
                    height: '36px',
                    backgroundColor: preset.value,
                    border: color === preset.value ? '3px solid var(--foreground)' : '2px solid var(--border)',
                    borderRadius: 'calc(var(--radius) - 2px)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: color === preset.value ? '0 0 0 2px var(--background)' : 'none'
                  }}
                  onMouseOver={(e) => {
                    if (color !== preset.value) {
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
