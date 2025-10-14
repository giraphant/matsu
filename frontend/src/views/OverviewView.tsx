import React from 'react';
import GridLayout from 'react-grid-layout';
import { LineChart, Line, XAxis, ResponsiveContainer } from 'recharts';
import { Plus, Pencil, Trash2, Bell } from 'lucide-react';
import { MonitorSummary } from '../types';
import { formatValue, formatTimeSince } from '../utils/format';

interface OverviewViewProps {
  visibleMonitors: MonitorSummary[];
  computedLayout: any[];
  miniChartData: Map<string, any[]>;
  monitorNames: Map<string, string>;
  monitorTags: Map<string, string[]>;
  thresholds: Map<string, { upper?: number; lower?: number; level?: string }>;
  showThresholdPopover: string | null;
  isMobile: boolean;
  isValueOutOfRange: (value: number | null, monitorId: string) => boolean;
  onLayoutChange: (layout: any[]) => void;
  onThresholdClick: (monitorId: string) => void;
  onThresholdUpdate: (monitorId: string, upper?: number, lower?: number, level?: string) => void;
  onEditConstant: (monitor: MonitorSummary) => void;
  onDeleteConstant: (monitorId: string) => void;
  onAddConstant: () => void;
  gridLayout: any[];
}

export function OverviewView({
  visibleMonitors,
  computedLayout,
  miniChartData,
  monitorNames,
  monitorTags,
  thresholds,
  showThresholdPopover,
  isMobile,
  isValueOutOfRange,
  onLayoutChange,
  onThresholdClick,
  onThresholdUpdate,
  onEditConstant,
  onDeleteConstant,
  onAddConstant,
  gridLayout
}: OverviewViewProps) {

  // Sort items by layout order on mobile
  const getSortedItemsForMobile = () => {
    if (!isMobile) return visibleMonitors;

    // Create a map of layout items by id
    const layoutMap = new Map(gridLayout.map(l => [l.i, l]));

    // Combine monitors with their layout info
    const allItems = visibleMonitors.map(m => ({
      monitor: m,
      layout: layoutMap.get(m.monitor_id) || { y: 999, x: 0 }
    }));

    // Sort by y position, then x
    allItems.sort((a, b) => {
      if (a.layout.y !== b.layout.y) return a.layout.y - b.layout.y;
      return a.layout.x - b.layout.x;
    });

    return allItems.map(item => item.monitor);
  };

  const sortedMonitors = getSortedItemsForMobile();

  return (
    <div className="bento-container">
      <GridLayout
        className="bento-grid"
        layout={computedLayout}
        cols={4}
        rowHeight={200}
        width={1600}
        onLayoutChange={onLayoutChange}
        isDraggable={!isMobile}
        isResizable={!isMobile}
        compactType={null}
        preventCollision={true}
      >
        {sortedMonitors.map((monitor) => {
          const displayName = monitorNames.get(monitor.monitor_id) || monitor.monitor_name || monitor.monitor_id;
          const tags = monitorTags.get(monitor.monitor_id) || [];
          const layout = gridLayout.find(l => l.i === monitor.monitor_id) || { h: 1 };
          const showChart = layout.h >= 2;
          const chartPoints = miniChartData.get(monitor.monitor_id) || [];
          const isAlert = isValueOutOfRange(monitor.latest_value, monitor.monitor_id);
          const threshold = thresholds.get(monitor.monitor_id);

          // Render constant card
          if (monitor.monitor_type === 'constant') {
            return (
              <div key={monitor.monitor_id} className="bento-item" style={{ borderLeft: `4px solid ${monitor.color || '#3b82f6'}` }}>
                <div className="bento-header">
                  <div className="bento-title-section">
                    <h3>{displayName}</h3>
                    {monitor.description && (
                      <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '4px 0 0 0' }}>
                        {monitor.description}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', position: 'relative', zIndex: 100 }}>
                    <button
                      className="threshold-btn"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onEditConstant(monitor);
                      }}
                      title="Edit constant"
                      style={{ pointerEvents: 'auto' }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="threshold-btn"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDeleteConstant(monitor.monitor_id);
                      }}
                      title="Delete constant"
                      style={{ color: 'var(--destructive)', pointerEvents: 'auto' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="bento-value constant-value" style={{ color: monitor.color || '#3b82f6' }}>
                  {formatValue(monitor.latest_value, monitor.unit, monitor.decimal_places)}
                </div>

                <div className="bento-stats" style={{ opacity: 0.5 }}>
                  <div className="bento-stat">
                    <span className="label">Type</span>
                    <span className="value">Constant</span>
                  </div>
                </div>
              </div>
            );
          }

          // Render normal monitor card
          return (
            <div key={monitor.monitor_id} className={`bento-item ${isAlert ? 'alert' : ''}`}>
              <div className="bento-header">
                <div className="bento-title-section">
                  <h3>{displayName}</h3>
                  {tags.length > 0 && (
                    <div className="bento-tags">
                      {tags.map(tag => (
                        <span key={tag} className="bento-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="threshold-btn"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onThresholdClick(monitor.monitor_id);
                  }}
                  title="Set thresholds"
                >
                  <Bell size={14} />
                </button>
              </div>

              {showThresholdPopover === monitor.monitor_id && (
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
                      id={`upper-${monitor.monitor_id}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const upperInput = document.getElementById(`upper-${monitor.monitor_id}`) as HTMLInputElement;
                          const lowerInput = document.getElementById(`lower-${monitor.monitor_id}`) as HTMLInputElement;
                          const levelSelect = document.getElementById(`level-${monitor.monitor_id}`) as HTMLSelectElement;
                          const upper = upperInput.value ? parseFloat(upperInput.value) : undefined;
                          const lower = lowerInput.value ? parseFloat(lowerInput.value) : undefined;
                          const level = levelSelect.value;
                          onThresholdUpdate(monitor.monitor_id, upper, lower, level);
                        }
                      }}
                    />
                  </div>
                  <div className="threshold-input-group">
                    <label>Lower Limit</label>
                    <input
                      type="number"
                      placeholder="Leave empty to disable"
                      defaultValue={threshold?.lower}
                      id={`lower-${monitor.monitor_id}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const upperInput = document.getElementById(`upper-${monitor.monitor_id}`) as HTMLInputElement;
                          const lowerInput = document.getElementById(`lower-${monitor.monitor_id}`) as HTMLInputElement;
                          const levelSelect = document.getElementById(`level-${monitor.monitor_id}`) as HTMLSelectElement;
                          const upper = upperInput.value ? parseFloat(upperInput.value) : undefined;
                          const lower = lowerInput.value ? parseFloat(lowerInput.value) : undefined;
                          const level = levelSelect.value;
                          onThresholdUpdate(monitor.monitor_id, upper, lower, level);
                        }
                      }}
                    />
                  </div>
                  <div className="threshold-input-group">
                    <label>Alert Level</label>
                    <select
                      id={`level-${monitor.monitor_id}`}
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
                        onThresholdUpdate(monitor.monitor_id, undefined, undefined);
                      }}
                    >
                      Clear
                    </button>
                    <button
                      className="btn-primary"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        const upperInput = document.getElementById(`upper-${monitor.monitor_id}`) as HTMLInputElement;
                        const lowerInput = document.getElementById(`lower-${monitor.monitor_id}`) as HTMLInputElement;
                        const levelSelect = document.getElementById(`level-${monitor.monitor_id}`) as HTMLSelectElement;
                        const upper = upperInput.value ? parseFloat(upperInput.value) : undefined;
                        const lower = lowerInput.value ? parseFloat(lowerInput.value) : undefined;
                        const level = levelSelect.value;
                        onThresholdUpdate(monitor.monitor_id, upper, lower, level);
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              <div className={`bento-value ${isAlert ? 'alert' : ''}`}>
                {formatValue(monitor.latest_value, monitor.unit, monitor.decimal_places)}
                <div className="last-updated" title={new Date((monitor.latest_timestamp.endsWith('Z') ? monitor.latest_timestamp : monitor.latest_timestamp + 'Z')).toLocaleString()}>
                  {formatTimeSince(monitor.latest_timestamp)}
                </div>
              </div>

              {showChart && chartPoints.length > 0 && (
                <div className="bento-mini-chart">
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartPoints}>
                      <XAxis
                        dataKey="timestamp"
                        hide={true}
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        scale="time"
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="bento-stats">
                <div className="bento-stat">
                  <span className="label">Min</span>
                  <span className="value">{formatValue(monitor.min_value, monitor.unit, monitor.decimal_places)}</span>
                </div>
                <div className="bento-stat">
                  <span className="label">Avg</span>
                  <span className="value">{formatValue(monitor.avg_value, monitor.unit, monitor.decimal_places)}</span>
                </div>
                <div className="bento-stat">
                  <span className="label">Max</span>
                  <span className="value">{formatValue(monitor.max_value, monitor.unit, monitor.decimal_places)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </GridLayout>

      {/* Floating Action Button for Adding Constants */}
      {!isMobile && (
        <button
          className="fab"
          onClick={onAddConstant}
          title="Add constant card"
        >
          <Plus size={20} />
        </button>
      )}
    </div>
  );
}
