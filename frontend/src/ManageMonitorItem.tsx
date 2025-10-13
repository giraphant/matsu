import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Trash2, Pencil } from 'lucide-react';

interface MonitorSummary {
  monitor_id: string;
  monitor_name: string | null;
  url: string;
  unit: string | null;
  decimal_places?: number;
  latest_value: number | null;
}

interface ManageMonitorItemProps {
  monitor: MonitorSummary;
  customName: string;
  tags: string[];
  isHidden: boolean;
  formatValue: (value: number | null, unit: string | null, decimalPlaces?: number) => string;
  onToggleHide: () => void;
  onDelete: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onUpdateName: (name: string) => void;
  onUpdateDecimalPlaces: (decimalPlaces: number) => void;
}

export default function ManageMonitorItem({
  monitor,
  customName,
  tags,
  isHidden,
  formatValue,
  onToggleHide,
  onDelete,
  onAddTag,
  onRemoveTag,
  onUpdateName,
  onUpdateDecimalPlaces,
}: ManageMonitorItemProps) {
  const [newTag, setNewTag] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(customName);
  const [editingDecimalPlaces, setEditingDecimalPlaces] = useState(false);
  const [decimalPlacesInput, setDecimalPlacesInput] = useState(monitor.decimal_places ?? 2);

  useEffect(() => {
    setNameInput(customName);
  }, [customName]);

  useEffect(() => {
    setDecimalPlacesInput(monitor.decimal_places ?? 2);
  }, [monitor.decimal_places]);

  const handleAddTag = () => {
    if (newTag.trim()) {
      onAddTag(newTag.trim());
      setNewTag('');
    }
  };

  const handleSaveName = () => {
    onUpdateName(nameInput);
    setEditingName(false);
  };

  const handleSaveDecimalPlaces = () => {
    onUpdateDecimalPlaces(decimalPlacesInput);
    setEditingDecimalPlaces(false);
  };

  const displayName = customName || monitor.monitor_name || monitor.monitor_id;

  return (
    <div className={`manage-item ${isHidden ? 'hidden' : ''}`}>
      <div className="manage-item-header">
        <div style={{ flex: 1 }}>
          {editingName ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveName();
                  }
                }}
                placeholder="Enter custom name"
                className="tag-input"
                style={{ width: '200px' }}
                autoFocus
              />
              <button className="btn-icon" onClick={handleSaveName} title="Save">
                ✓
              </button>
              <button className="btn-icon" onClick={() => { setEditingName(false); setNameInput(customName); }} title="Cancel">
                ✕
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <strong>{displayName}</strong>
              <button
                className="btn-icon"
                onClick={() => setEditingName(true)}
                title="Edit name"
                style={{ fontSize: '12px', padding: '2px 6px' }}
              >
                <Pencil size={12} />
              </button>
            </div>
          )}
          <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '4px' }}>
            {formatValue(monitor.latest_value, monitor.unit, monitor.decimal_places)}
          </div>
          {!customName && monitor.monitor_name && (
            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
              Original: {monitor.monitor_name}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-icon"
            onClick={onToggleHide}
            title={isHidden ? 'Show' : 'Hide'}
          >
            {isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button
            className="btn-icon btn-danger"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="manage-item-tags">
        {tags.map(tag => (
          <span key={tag} className="manage-tag">
            {tag}
            <button
              onClick={() => onRemoveTag(tag)}
              style={{ marginLeft: '4px', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit' }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          placeholder="Add tag..."
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleAddTag();
            }
          }}
          className="tag-input"
        />
      </div>

      <div className="manage-item-decimals" style={{ marginTop: '8px', fontSize: '12px' }}>
        {editingDecimalPlaces ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: 'var(--muted-foreground)' }}>Decimal Places:</span>
            <input
              type="number"
              min="0"
              max="10"
              value={decimalPlacesInput}
              onChange={(e) => setDecimalPlacesInput(parseInt(e.target.value) || 0)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSaveDecimalPlaces();
                }
              }}
              className="tag-input"
              style={{ width: '80px' }}
              autoFocus
            />
            <button className="btn-icon" onClick={handleSaveDecimalPlaces} title="Save">
              ✓
            </button>
            <button className="btn-icon" onClick={() => { setEditingDecimalPlaces(false); setDecimalPlacesInput(monitor.decimal_places ?? 2); }} title="Cancel">
              ✕
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: 'var(--muted-foreground)' }}>
              Decimal Places: {monitor.decimal_places ?? 2}
            </span>
            <button
              className="btn-icon"
              onClick={() => setEditingDecimalPlaces(true)}
              title="Edit decimal places"
              style={{ fontSize: '12px', padding: '2px 6px' }}
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}