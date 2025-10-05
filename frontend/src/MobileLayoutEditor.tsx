import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface MobileLayoutEditorProps {
  show: boolean;
  onClose: () => void;
  layout: LayoutItem[];
  onSave: (newLayout: LayoutItem[]) => void;
  monitorNames: Map<string, string>;
}

export default function MobileLayoutEditor({
  show,
  onClose,
  layout,
  onSave,
  monitorNames
}: MobileLayoutEditorProps) {
  const [editedLayout, setEditedLayout] = useState<LayoutItem[]>([]);

  useEffect(() => {
    if (show) {
      // Sort by y position for mobile (vertical list)
      const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
      setEditedLayout(sorted);
    }
  }, [show, layout]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newLayout = [...editedLayout];
    [newLayout[index - 1], newLayout[index]] = [newLayout[index], newLayout[index - 1]];
    setEditedLayout(newLayout);
  };

  const moveDown = (index: number) => {
    if (index === editedLayout.length - 1) return;
    const newLayout = [...editedLayout];
    [newLayout[index], newLayout[index + 1]] = [newLayout[index + 1], newLayout[index]];
    setEditedLayout(newLayout);
  };

  const updateHeight = (index: number, h: number) => {
    const newLayout = [...editedLayout];
    newLayout[index] = { ...newLayout[index], h: Math.max(1, Math.min(3, h)) };
    setEditedLayout(newLayout);
  };

  const handleSave = () => {
    // Recalculate y positions based on order
    let currentY = 0;
    const finalLayout = editedLayout.map((item, index) => ({
      ...item,
      x: 0,
      y: currentY,
      w: 1, // Mobile is always 1 column
    })).map(item => {
      const result = { ...item };
      currentY += item.h;
      return result;
    });

    onSave(finalLayout);
    onClose();
  };

  const getDisplayName = (id: string) => {
    if (id.startsWith('const-')) {
      return id.replace('const-', '常量: ');
    }
    return monitorNames.get(id) || id;
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content mobile-layout-editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>编辑布局顺序</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="mobile-layout-list">
          {editedLayout.map((item, index) => (
            <div key={item.i} className="mobile-layout-item">
              <div className="layout-item-info">
                <div className="layout-item-name">{getDisplayName(item.i)}</div>
                <div className="layout-item-controls">
                  <label>
                    高度:
                    <input
                      type="number"
                      min="1"
                      max="3"
                      value={item.h}
                      onChange={(e) => updateHeight(index, parseInt(e.target.value))}
                      className="height-input"
                    />
                  </label>
                </div>
              </div>
              <div className="layout-item-actions">
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className="btn-icon"
                  title="上移"
                >
                  <ArrowUp size={18} />
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === editedLayout.length - 1}
                  className="btn-icon"
                  title="下移"
                >
                  <ArrowDown size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
