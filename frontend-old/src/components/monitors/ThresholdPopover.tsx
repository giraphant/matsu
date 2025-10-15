/**
 * Threshold settings popover
 */

import React from 'react';

interface ThresholdPopoverProps {
  monitorId: string;
  threshold?: { upper?: number; lower?: number; level?: string };
  onUpdate: (monitorId: string, upper?: number, lower?: number, level?: string) => void;
  onClose: () => void;
}

export function ThresholdPopover({
  monitorId,
  threshold,
  onUpdate,
  onClose
}: ThresholdPopoverProps) {
  const handleSave = () => {
    const upperInput = document.getElementById(`upper-${monitorId}`) as HTMLInputElement;
    const lowerInput = document.getElementById(`lower-${monitorId}`) as HTMLInputElement;
    const levelSelect = document.getElementById(`level-${monitorId}`) as HTMLSelectElement;
    const upper = upperInput.value ? parseFloat(upperInput.value) : undefined;
    const lower = lowerInput.value ? parseFloat(lowerInput.value) : undefined;
    const level = levelSelect.value;
    onUpdate(monitorId, upper, lower, level);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <div
      className="threshold-popover"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <h4>Alert Settings</h4>
      <div className="threshold-input-group">
        <label>Upper Limit</label>
        <input
          type="number"
          placeholder="Leave empty to disable"
          defaultValue={threshold?.upper}
          id={`upper-${monitorId}`}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="threshold-input-group">
        <label>Lower Limit</label>
        <input
          type="number"
          placeholder="Leave empty to disable"
          defaultValue={threshold?.lower}
          id={`lower-${monitorId}`}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="threshold-input-group">
        <label>Alert Level</label>
        <select
          id={`level-${monitorId}`}
          defaultValue={threshold?.level || 'medium'}
          className="alert-level-select"
        >
          <option value="critical">🔴 Critical (30s)</option>
          <option value="high">🟠 High (2m)</option>
          <option value="medium">🟡 Medium (5m)</option>
          <option value="low">🟢 Low (15m)</option>
        </select>
      </div>
      <div className="threshold-popover-actions">
        <button
          className="btn-secondary"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onUpdate(monitorId, undefined, undefined);
            onClose();
          }}
        >
          Clear
        </button>
        <button
          className="btn-primary"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleSave();
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
