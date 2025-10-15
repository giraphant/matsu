/**
 * Modal for adding monitors to Bento grid
 */

import React, { useState } from 'react';
import { NewMonitor } from '../../api/newMonitors';
import { Search } from 'lucide-react';

interface AddCardModalProps {
  show: boolean;
  availableMonitors: NewMonitor[];
  onClose: () => void;
  onAdd: (monitorId: string) => void;
}

export default function AddCardModal({
  show,
  availableMonitors,
  onClose,
  onAdd
}: AddCardModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  if (!show) return null;

  const filteredMonitors = availableMonitors.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.formula.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = (monitorId: string) => {
    onAdd(monitorId);
    setSearchQuery('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <h3>Add Card to Bento</h3>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted-foreground)'
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search monitors..."
              className="form-input"
              style={{ paddingLeft: '36px' }}
              autoFocus
            />
          </div>
        </div>

        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {filteredMonitors.length === 0 ? (
            <p style={{
              textAlign: 'center',
              color: 'var(--muted-foreground)',
              padding: '32px'
            }}>
              {availableMonitors.length === 0
                ? 'All monitors are already added to Bento!'
                : 'No monitors found matching your search.'}
            </p>
          ) : (
            <div className="monitor-list-select">
              {filteredMonitors.map(m => (
                <div
                  key={m.id}
                  onClick={() => handleAdd(m.id)}
                  className="monitor-list-item"
                  style={{ borderLeft: `4px solid ${m.color || '#3b82f6'}` }}
                >
                  <div>
                    <div className="name">{m.name}</div>
                    {m.description && (
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--muted-foreground)',
                        marginTop: '4px'
                      }}>
                        {m.description}
                      </div>
                    )}
                    <div style={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: 'var(--muted-foreground)',
                      marginTop: '4px',
                      opacity: 0.7
                    }}>
                      {m.formula}
                    </div>
                  </div>
                  <div className="current-value">
                    {m.value !== null && m.value !== undefined
                      ? `${m.value.toFixed(m.decimal_places)} ${m.unit || ''}`
                      : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
