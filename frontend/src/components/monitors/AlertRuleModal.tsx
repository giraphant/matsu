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
  const [level, setLevel] = useState<'high' | 'medium' | 'low'>('medium');
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4 dark:text-white">
            {rule ? 'Edit Alert Rule' : 'Create Alert Rule'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">
              Alert Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., BTC Spread Too Low"
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">
              Condition *
            </label>
            <textarea
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="${monitor:id} < 50"
              rows={3}
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Supports: {'>'}, {'<'}, {'>='}, {'<='}, ==, !=. Use ${'${monitor:id}'} to reference monitors.
            </p>
          </div>

          {monitors.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Insert Monitor
              </label>
              <div className="border dark:border-gray-600 rounded p-2 max-h-32 overflow-y-auto">
                {monitors.map(m => (
                  <button
                    key={m.id}
                    onClick={() => insertMonitor(m.id)}
                    className="block w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                  >
                    <span className="font-medium dark:text-white">{m.name}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      (current: {m.value?.toFixed(m.decimal_places) || 'N/A'})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Alert Level
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Cooldown (seconds)
              </label>
              <input
                type="number"
                value={cooldownSeconds}
                onChange={(e) => setCooldownSeconds(parseInt(e.target.value) || 0)}
                min="0"
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border rounded hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
