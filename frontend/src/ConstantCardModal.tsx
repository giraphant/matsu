import React, { useState, useEffect } from 'react';

interface ConstantCard {
  monitor_id?: string;
  monitor_name?: string | null;
  latest_value?: number | null;
  unit?: string | null;
  description?: string | null;
  color?: string | null;
}

interface ConstantCardModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (constant: any) => void;
  editingConstant: ConstantCard | null;
}

export default function ConstantCardModal({ show, onClose, onSave, editingConstant }: ConstantCardModalProps) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');

  useEffect(() => {
    if (editingConstant) {
      setName(editingConstant.monitor_name || '');
      setValue(String(editingConstant.latest_value || ''));
      setUnit(editingConstant.unit || '');
      setDescription(editingConstant.description || '');
      setColor(editingConstant.color || '#3b82f6');
    } else {
      setName('');
      setValue('');
      setUnit('');
      setDescription('');
      setColor('#3b82f6');
    }
  }, [editingConstant, show]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !value.trim()) {
      alert('Name and value are required');
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      alert('Value must be a number');
      return;
    }

    onSave({
      name: name.trim(),
      value: numValue,
      unit: unit.trim() || null,
      description: description.trim() || null,
      color: color
    });
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3>{editingConstant ? 'Edit Constant Card' : 'New Constant Card'}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="constant-form">
          <div className="form-group">
            <label htmlFor="const-name">Name *</label>
            <input
              id="const-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Target APR, Risk-Free Rate"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="const-value">Value *</label>
            <input
              id="const-value"
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 10.5"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="const-unit">Unit</label>
            <input
              id="const-unit"
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. %, $, ETH"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="const-desc">Description</label>
            <textarea
              id="const-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="form-textarea"
            />
          </div>

          <div className="form-group">
            <label htmlFor="const-color">Color</label>
            <div className="color-picker-group">
              <input
                id="const-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="color-picker"
              />
              <span className="color-value">{color}</span>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {editingConstant ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
