/**
 * Modal for creating/editing monitors
 */

import React, { useState, useEffect } from 'react';
import { NewMonitor, MonitorCreate } from '../../api/newMonitors';

interface NewMonitorModalProps {
  show: boolean;
  monitor: NewMonitor | null;
  existingMonitors: NewMonitor[];
  onClose: () => void;
  onSave: (data: MonitorCreate) => Promise<void>;
}

export default function NewMonitorModal({
  show,
  monitor,
  existingMonitors,
  onClose,
  onSave
}: NewMonitorModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'direct' | 'computed' | 'constant'>('computed');
  const [formula, setFormula] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [decimalPlaces, setDecimalPlaces] = useState(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show && monitor) {
      setName(monitor.name);
      setType(monitor.type);
      setFormula(monitor.formula);
      setUnit(monitor.unit || '');
      setDescription(monitor.description || '');
      setColor(monitor.color || '#3b82f6');
      setDecimalPlaces(monitor.decimal_places);
    } else if (show) {
      setName('');
      setType('computed');
      setFormula('');
      setUnit('');
      setDescription('');
      setColor('#3b82f6');
      setDecimalPlaces(2);
    }
    setError('');
  }, [show, monitor]);

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
        type,
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
            <label>Monitor Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="form-input"
            >
              <option value="computed">Computed (formula-based)</option>
              <option value="constant">Constant (fixed value)</option>
              <option value="direct">Direct (webhook reference)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Formula *</label>
            <textarea
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder={
                type === 'computed' ? '${monitor:id1} - ${monitor:id2}' :
                type === 'constant' ? '100' :
                'webhook.btc_price'
              }
              rows={3}
              className="form-textarea"
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
            />
            <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '6px' }}>
              {type === 'computed' && 'Use ${monitor:id} to reference other monitors. Supports +, -, *, /, abs(), max(), min()'}
              {type === 'constant' && 'Enter a numeric value'}
              {type === 'direct' && 'Enter the webhook field path (e.g., webhook.field_name)'}
            </p>
          </div>

          {type === 'computed' && existingMonitors.length > 0 && (
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
            <div className="color-picker-group">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="color-picker"
              />
              <span className="color-value">{color}</span>
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
