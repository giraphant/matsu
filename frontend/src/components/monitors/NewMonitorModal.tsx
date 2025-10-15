/**
 * Modal for creating/editing monitors in the new unified system
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
  const [type, setType] = useState<'direct' | 'computed' | 'constant'>('constant');
  const [formula, setFormula] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [decimalPlaces, setDecimalPlaces] = useState(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens/closes or monitor changes
  useEffect(() => {
    if (show && monitor) {
      // Editing existing monitor
      setName(monitor.name);
      setType(monitor.type);
      setFormula(monitor.formula);
      setUnit(monitor.unit || '');
      setDescription(monitor.description || '');
      setColor(monitor.color || '#3b82f6');
      setDecimalPlaces(monitor.decimal_places);
    } else if (show) {
      // Creating new monitor
      setName('');
      setType('constant');
      setFormula('');
      setUnit('');
      setDescription('');
      setColor('#3b82f6');
      setDecimalPlaces(2);
    }
    setError('');
  }, [show, monitor]);

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!formula.trim()) {
      setError('Formula is required');
      return;
    }

    // Validate formula based on type
    if (type === 'constant') {
      const num = parseFloat(formula);
      if (isNaN(num)) {
        setError('Constant formula must be a number');
        return;
      }
    } else if (type === 'computed' || type === 'direct') {
      if (!formula.includes('${')) {
        setError('Formula must contain at least one variable reference like ${monitor:id}');
        return;
      }
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
        color: color || undefined,
        decimal_places: decimalPlaces
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save monitor');
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (monitorId: string) => {
    const variable = `\${monitor:${monitorId}}`;
    setFormula(prev => prev + variable);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4 dark:text-white">
            {monitor ? 'Edit Monitor' : 'Create New Monitor'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded">
              {error}
            </div>
          )}

          {/* Monitor Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">
              Monitor Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              disabled={!!monitor}
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50"
            >
              <option value="constant">Constant (Fixed Value)</option>
              <option value="computed">Computed (Formula)</option>
              <option value="direct">Direct (Webhook Reference)</option>
            </select>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {type === 'constant' && 'A fixed value you set manually'}
              {type === 'computed' && 'Calculate from other monitors using formulas'}
              {type === 'direct' && 'Reference data from webhook monitors'}
            </p>
          </div>

          {/* Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., BTC-ETH Spread"
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          {/* Formula */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">
              Formula *
            </label>
            <textarea
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder={
                type === 'constant' ? '100' :
                type === 'computed' ? '${monitor:id1} - ${monitor:id2}' :
                '${webhook:monitor-id}'
              }
              rows={3}
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {type === 'constant' && 'Enter a numeric value'}
              {type === 'computed' && 'Use ${monitor:id} to reference other monitors. Supports +, -, *, /, abs(), max(), min()'}
              {type === 'direct' && 'Use ${webhook:monitor_id} to reference webhook data'}
            </p>
          </div>

          {/* Variable Helper (for computed/direct) */}
          {(type === 'computed' || type === 'direct') && existingMonitors.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Insert Variable
              </label>
              <div className="border dark:border-gray-600 rounded p-2 max-h-32 overflow-y-auto">
                {existingMonitors.map(m => (
                  <button
                    key={m.id}
                    onClick={() => insertVariable(m.id)}
                    className="block w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                  >
                    <span className="font-medium dark:text-white">{m.name}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2 text-xs">
                      ({m.type})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Unit */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">
              Unit
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g., USD, %, BTC"
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          {/* Color and Decimal Places */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Color
              </label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-10 px-1 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Decimal Places
              </label>
              <input
                type="number"
                value={decimalPlaces}
                onChange={(e) => setDecimalPlaces(parseInt(e.target.value) || 0)}
                min="0"
                max="8"
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>

          {/* Buttons */}
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
