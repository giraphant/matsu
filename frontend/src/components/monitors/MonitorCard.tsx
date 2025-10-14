/**
 * Monitor card component for overview grid
 */

import React from 'react';
import { Bell, Pencil, Trash2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis } from 'recharts';
import { MonitorSummary } from '../../types/monitor';
import { formatValue, formatTimeSince } from '../../utils/format';

interface MonitorCardProps {
  monitor: MonitorSummary;
  displayName: string;
  tags: string[];
  layout: { h: number };
  chartPoints: any[];
  isAlert: boolean;
  threshold?: { upper?: number; lower?: number; level?: string };
  onThresholdClick: () => void;
  showThresholdPopover: boolean;
  onEditConstant?: () => void;
  onDeleteConstant?: () => void;
}

export function MonitorCard({
  monitor,
  displayName,
  tags,
  layout,
  chartPoints,
  isAlert,
  threshold,
  onThresholdClick,
  showThresholdPopover,
  onEditConstant,
  onDeleteConstant
}: MonitorCardProps) {
  const showChart = layout.h >= 2;

  // Render constant card
  if (monitor.monitor_type === 'constant') {
    return (
      <div className="bento-item" style={{ borderLeft: `4px solid ${monitor.color || '#3b82f6'}` }}>
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
                onEditConstant?.();
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
                onDeleteConstant?.();
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
    <div className={`bento-item ${isAlert ? 'alert' : ''}`}>
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
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onThresholdClick();
          }}
          title="Set thresholds"
        >
          <Bell size={14} />
        </button>
      </div>

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
}
