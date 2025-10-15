/**
 * Modal for creating/editing alert rules
 */

import React, { useState, useEffect } from 'react';
import { AlertRule, AlertRuleCreate, NewMonitor } from '../../api/newMonitors';

interface AlertRuleModalProps {
  show: boolean;
  rule: AlertRule | null;
  monitors: NewMonitor[];
  onClose: () => void;
  onSave: (data: AlertRuleCreate) => Promise<void>;
}

export default function AlertRuleModal({
  show,
  rule,
  monitors,
  onClose,
  onSave
}: AlertRuleModalProps) {
  const [name, setName] = useState('');
  const [condition, setCondition] = useState('');
  const [level, setLevel] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [cooldownSeconds, setCooldownSeconds] = useState(300);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show && rule) {
      setName(rule.name);
      setCondition(rule.condition);
      setLevel(rule.level);
      setCooldownSeconds(rule.cooldown_seconds);
    } else if (show) {
      setName('');
      setCondition('');
      setLevel('medium');
      setCooldownSeconds(300);
    }
    setError('');
  }, [show, rule]);

  const handleSave = async () => {
    if (!name.trim() || !condition.trim()) {
      setError('Name and condition are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSave({
        name: name.trim(),
        condition: condition.trim(),
        level,
        cooldown_seconds: cooldownSeconds,
        actions: ['pushover']
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save alert rule');
    } finally {
      setSaving(false);
    }
  };

  const insertMonitor = (monitorId: string) => {
    const variable = `\${monitor:${monitorId}}`;
    setCondition(prev => prev + variable);
  };

  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <h3>{rule ? 'Edit Alert Rule' : 'Create Alert Rule'}</h3>

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
            <label>Alert Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., BTC Spread Too Low"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Condition *</label>
            <textarea
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="${monitor:id} < 50"
              rows={3}
              className="form-textarea"
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
            />
            <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '6px' }}>
              Supports: {'>'}, {'<'}, {'>='}, {'<='}, ==, !=. Use ${'${monitor:id}'} to reference monitors.
            </p>
          </div>

          {monitors.length > 0 && (
            <div className="form-group">
              <label>Insert Monitor</label>
              <div className="monitor-list-select">
                {monitors.map(m => (
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
            </div>
          )}

          <div className="monitor-modal-row">
            <div className="form-group">
              <label>Alert Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                className="form-input"
              >
                <option value="critical">Critical (30s)</option>
                <option value="high">High (2min)</option>
                <option value="medium">Medium (5min)</option>
                <option value="low">Low (15min)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Cooldown (seconds)</label>
              <input
                type="number"
                value={cooldownSeconds}
                onChange={(e) => setCooldownSeconds(parseInt(e.target.value) || 0)}
                min="0"
                className="form-input"
              />
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
