/**
 * Modal for creating/editing alert rules
 * Simplified design with basic/advanced mode toggle
 */

import React, { useState, useEffect } from 'react';
import { AlertRule, AlertRuleCreate, NewMonitor } from '../../api/newMonitors';
import { ALERT_LEVELS, ALERT_ICONS } from '../../constants/alerts';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AlertRuleModalProps {
  show: boolean;
  rule: AlertRule | null;
  monitors: NewMonitor[];
  onClose: () => void;
  onSave: (data: AlertRuleCreate) => Promise<void>;
  onDelete?: (ruleId: string) => Promise<void>;
  preselectedMonitorId?: string | null;
}

// Parse condition string to extract upper/lower limits
function parseCondition(condition: string): { upper?: number; lower?: number; monitorId?: string } {
  const result: { upper?: number; lower?: number; monitorId?: string } = {};

  const monitorMatch = condition.match(/\$\{monitor:([^}]+)\}/);
  if (monitorMatch) {
    result.monitorId = monitorMatch[1];
  }

  const upperMatch = condition.match(/>\s*=?\s*(-?\d+\.?\d*)/);
  if (upperMatch) {
    result.upper = parseFloat(upperMatch[1]);
  }

  const lowerMatch = condition.match(/<\s*=?\s*(-?\d+\.?\d*)/);
  if (lowerMatch) {
    result.lower = parseFloat(lowerMatch[1]);
  }

  return result;
}

// Build condition string from upper/lower limits
function buildCondition(monitorId: string, upper?: number, lower?: number): string {
  const parts: string[] = [];
  const ref = `\${monitor:${monitorId}}`;

  if (upper !== undefined && upper !== null) {
    parts.push(`${ref} > ${upper}`);
  }
  if (lower !== undefined && lower !== null) {
    parts.push(`${ref} < ${lower}`);
  }

  return parts.join(' || ') || `${ref} > 0`;
}

export default function AlertRuleModal({
  show,
  rule,
  monitors,
  onClose,
  onSave,
  onDelete,
  preselectedMonitorId
}: AlertRuleModalProps) {
  const [selectedMonitorId, setSelectedMonitorId] = useState('');
  const [upper, setUpper] = useState<number | ''>('');
  const [lower, setLower] = useState<number | ''>('');
  const [level, setLevel] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Advanced mode state
  const [advancedMode, setAdvancedMode] = useState(false);
  const [customCondition, setCustomCondition] = useState('');

  useEffect(() => {
    if (show && rule) {
      const parsed = parseCondition(rule.condition);
      setSelectedMonitorId(parsed.monitorId || '');
      setUpper(parsed.upper ?? '');
      setLower(parsed.lower ?? '');
      setLevel(rule.level);
      setCustomCondition(rule.condition);

      // Auto-enable advanced mode if condition cannot be parsed as simple upper/lower
      const isSimple = parsed.monitorId && (parsed.upper !== undefined || parsed.lower !== undefined);
      setAdvancedMode(!isSimple);
    } else if (show && preselectedMonitorId) {
      setSelectedMonitorId(preselectedMonitorId);
      setUpper('');
      setLower('');
      setLevel('medium');
      setAdvancedMode(false);
      setCustomCondition('');
    } else if (show) {
      setSelectedMonitorId('');
      setUpper('');
      setLower('');
      setLevel('medium');
      setAdvancedMode(false);
      setCustomCondition('');
    }
    setError('');
  }, [show, rule, preselectedMonitorId]);

  const handleSave = async () => {
    if (!selectedMonitorId && !advancedMode) {
      setError('Please select a monitor');
      return;
    }

    let condition: string;

    if (advancedMode) {
      // Advanced mode: use custom condition
      if (!customCondition.trim()) {
        setError('Please enter a condition');
        return;
      }
      condition = customCondition.trim();
    } else {
      // Simple mode: build from upper/lower
      if (upper === '' && lower === '') {
        setError('Please set at least one limit (upper or lower)');
        return;
      }
      const upperVal = upper === '' ? undefined : Number(upper);
      const lowerVal = lower === '' ? undefined : Number(lower);
      condition = buildCondition(selectedMonitorId, upperVal, lowerVal);
    }

    setSaving(true);
    setError('');

    try {
      const monitor = monitors.find(m => m.id === selectedMonitorId);
      const alertLevelConfig = ALERT_LEVELS[level];

      // Pass data without id - onSave handler will determine create vs update
      const data: any = {
        name: monitor ? `${monitor.name} Alert` : 'Alert',
        condition,
        level,
        cooldown_seconds: alertLevelConfig.interval,
        actions: ['pushover']
      };

      // If editing existing rule, add the id
      if (rule?.id) {
        data.id = rule.id;
      }

      await onSave(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save alert rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!rule?.id || !onDelete) return;
    if (!window.confirm('Are you sure you want to delete this alert?')) return;

    setDeleting(true);
    try {
      await onDelete(rule.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete alert rule');
    } finally {
      setDeleting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  if (!show) return null;

  const selectedMonitor = monitors.find(m => m.id === selectedMonitorId);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <h3>{rule ? 'Edit Alert' : 'Set Alert'}</h3>

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
          {/* Mode Toggle */}
          <div style={{ marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => setAdvancedMode(!advancedMode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: 'calc(var(--radius) - 2px)',
                fontSize: '13px',
                color: 'var(--foreground)',
                cursor: 'pointer'
              }}
            >
              {advancedMode ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {advancedMode ? 'Switch to Simple Mode' : 'Advanced Mode (Custom Formula)'}
            </button>
          </div>

          {!advancedMode ? (
            <>
              {/* Simple Mode */}
              <div className="form-group">
                <label>Monitor *</label>
                <select
                  value={selectedMonitorId}
                  onChange={(e) => setSelectedMonitorId(e.target.value)}
                  className="form-input"
                  disabled={!!rule}
                >
                  <option value="">Select a monitor</option>
                  {monitors.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} (current: {m.value?.toFixed(m.decimal_places) ?? 'N/A'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Upper Limit</label>
                <input
                  type="number"
                  value={upper}
                  onChange={(e) => setUpper(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="Leave empty to disable"
                  className="form-input"
                  onKeyDown={handleKeyDown}
                  step="any"
                />
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '4px' }}>
                  Alert when value {'>'} this limit
                </p>
              </div>

              <div className="form-group">
                <label>Lower Limit</label>
                <input
                  type="number"
                  value={lower}
                  onChange={(e) => setLower(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="Leave empty to disable"
                  className="form-input"
                  onKeyDown={handleKeyDown}
                  step="any"
                />
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '4px' }}>
                  Alert when value {'<'} this limit
                </p>
              </div>

              {selectedMonitor && (upper !== '' || lower !== '') && (
                <div style={{
                  padding: '12px',
                  background: 'var(--muted)',
                  borderRadius: 'calc(var(--radius) - 2px)',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  marginBottom: '12px'
                }}>
                  <strong>Preview:</strong>
                  <div style={{ marginTop: '4px', color: 'var(--muted-foreground)' }}>
                    {upper !== '' && `Alert when ${selectedMonitor.name} > ${upper}`}
                    {upper !== '' && lower !== '' && <br />}
                    {lower !== '' && `Alert when ${selectedMonitor.name} < ${lower}`}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Advanced Mode */}
              <div className="form-group">
                <label>Custom Condition *</label>
                <textarea
                  value={customCondition}
                  onChange={(e) => setCustomCondition(e.target.value)}
                  placeholder="${monitor:id} > 100 || ${monitor:id} < 50"
                  rows={3}
                  className="form-textarea"
                  style={{ fontFamily: 'monospace', fontSize: '13px' }}
                />
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '6px' }}>
                  Supports: {'>'}, {'<'}, {'>='}, {'<='}, ==, !=, ||, &&. Use ${'${monitor:id}'} to reference monitors.
                </p>
              </div>
            </>
          )}

          {/* Alert Level */}
          <div className="form-group">
            <label>Alert Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as any)}
              className="form-input alert-level-select"
            >
              <option value="critical">{ALERT_ICONS.critical} Critical (30s)</option>
              <option value="high">{ALERT_ICONS.high} High (2m)</option>
              <option value="medium">{ALERT_ICONS.medium} Medium (5m)</option>
              <option value="low">{ALERT_ICONS.low} Low (15m)</option>
            </select>
            <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '4px' }}>
              Cooldown interval between repeated alerts
            </p>
          </div>
        </div>

        <div className="modal-actions">
          {rule && onDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting || saving}
              className="btn-secondary"
              style={{ marginRight: 'auto', color: 'var(--destructive)' }}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={saving || deleting}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || deleting}
            className="btn-primary"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
