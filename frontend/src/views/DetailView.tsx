import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Settings } from 'lucide-react';
import { MonitorSummary, ChartData } from '../types';
import { formatValue } from '../utils/format';
import ManageMonitorItem from '../ManageMonitorItem';

interface DetailViewProps {
  monitors: MonitorSummary[];
  visibleMonitors: MonitorSummary[];
  selectedMonitor: string | null;
  currentMonitor: MonitorSummary | undefined;
  chartData: ChartData | null;
  days: number;
  monitorNames: Map<string, string>;
  monitorTags: Map<string, string[]>;
  hiddenMonitors: Set<string>;
  allTags: string[];
  selectedTag: string;
  showManageModal: boolean;
  settingsTab: 'monitors' | 'pushover';
  monitorSearchQuery: string;
  pushoverUserKey: string;
  pushoverApiToken: string;
  onSelectMonitor: (monitorId: string) => void;
  onSetDays: (days: number) => void;
  onUpdateUnit: (unit: string) => void;
  onSetSelectedTag: (tag: string) => void;
  onShowManageModal: (show: boolean) => void;
  onSetSettingsTab: (tab: 'monitors' | 'pushover') => void;
  onSetMonitorSearchQuery: (query: string) => void;
  onToggleHideMonitor: (monitorId: string) => void;
  onDeleteMonitor: (monitorId: string) => void;
  onAddTag: (monitorId: string, tag: string) => void;
  onRemoveTag: (monitorId: string, tag: string) => void;
  onUpdateName: (monitorId: string, name: string) => void;
  onUpdateDecimalPlaces: (monitorId: string, decimalPlaces: number) => void;
  onSetPushoverUserKey: (key: string) => void;
  onSetPushoverApiToken: (token: string) => void;
  onSavePushoverConfig: () => void;
  onTestPushoverNotification: () => void;
}

export function DetailView({
  monitors,
  visibleMonitors,
  selectedMonitor,
  currentMonitor,
  chartData,
  days,
  monitorNames,
  monitorTags,
  hiddenMonitors,
  allTags,
  selectedTag,
  showManageModal,
  settingsTab,
  monitorSearchQuery,
  pushoverUserKey,
  pushoverApiToken,
  onSelectMonitor,
  onSetDays,
  onUpdateUnit,
  onSetSelectedTag,
  onShowManageModal,
  onSetSettingsTab,
  onSetMonitorSearchQuery,
  onToggleHideMonitor,
  onDeleteMonitor,
  onAddTag,
  onRemoveTag,
  onUpdateName,
  onUpdateDecimalPlaces,
  onSetPushoverUserKey,
  onSetPushoverApiToken,
  onSavePushoverConfig,
  onTestPushoverNotification
}: DetailViewProps) {
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState('');

  const handleUpdateUnit = async (unit: string) => {
    await onUpdateUnit(unit);
    setShowUnitModal(false);
    setEditingUnit('');
  };

  return (
    <>
      <div className="dashboard">
        {/* Sidebar */}
        <div className="sidebar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Monitors ({visibleMonitors.length}/{monitors.length})</h3>
            <button className="manage-btn" onClick={() => onShowManageModal(true)} title="Manage monitors">
              <Settings size={16} />
            </button>
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="tag-filter">
              <button
                className={`tag-filter-btn ${selectedTag === 'all' ? 'active' : ''}`}
                onClick={() => onSetSelectedTag('all')}
              >
                All
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  className={`tag-filter-btn ${selectedTag === tag ? 'active' : ''}`}
                  onClick={() => onSetSelectedTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <div className="monitor-list">
            {visibleMonitors.map(monitor => (
              <button
                key={monitor.monitor_id}
                className={`monitor-item ${selectedMonitor === monitor.monitor_id ? 'active' : ''}`}
                onClick={() => onSelectMonitor(monitor.monitor_id)}
              >
                <div className="monitor-name">
                  {monitorNames.get(monitor.monitor_id) || monitor.monitor_name || monitor.monitor_id}
                </div>
                <div className="monitor-value">
                  {formatValue(monitor.latest_value, monitor.unit, monitor.decimal_places)}
                </div>
                {monitorTags.get(monitor.monitor_id) && monitorTags.get(monitor.monitor_id)!.length > 0 && (
                  <div className="monitor-tags">
                    {monitorTags.get(monitor.monitor_id)!.map(tag => (
                      <span key={tag} className="monitor-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          {currentMonitor && (
            <>
              {/* Stats Cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Latest Value</div>
                  <div className="stat-value">
                    {formatValue(currentMonitor.latest_value, currentMonitor.unit, currentMonitor.decimal_places)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Average</div>
                  <div className="stat-value">
                    {formatValue(currentMonitor.avg_value, currentMonitor.unit, currentMonitor.decimal_places)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Min / Max</div>
                  <div className="stat-value small">
                    {formatValue(currentMonitor.min_value, currentMonitor.unit, currentMonitor.decimal_places)} / {formatValue(currentMonitor.max_value, currentMonitor.unit, currentMonitor.decimal_places)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Changes</div>
                  <div className="stat-value">{currentMonitor.change_count}</div>
                </div>
              </div>

              {/* Chart */}
              {chartData && (
                <div className="chart-card">
                  <div className="chart-header">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h2>{chartData.monitor_name}</h2>
                        {currentMonitor && (
                          <button
                            className="unit-edit-btn"
                            onClick={() => {
                              setEditingUnit(currentMonitor.unit || '');
                              setShowUnitModal(true);
                            }}
                            title="Edit unit"
                          >
                            <span style={{ fontSize: '14px', marginRight: '4px' }}>Unit:</span>
                            <strong>{currentMonitor.unit || 'none'}</strong>
                          </button>
                        )}
                      </div>
                      <a href={chartData.url} target="_blank" rel="noopener noreferrer" className="chart-url">
                        {chartData.url}
                      </a>
                    </div>
                    <div className="time-range-buttons">
                      {[1, 7, 30].map(d => (
                        <button
                          key={d}
                          className={`time-btn ${days === d ? 'active' : ''}`}
                          onClick={() => onSetDays(d)}
                        >
                          {d}D
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={chartData.data.map(point => ({
                        ...point,
                        timestampMs: new Date(point.timestamp).getTime(),
                        timestampFormatted: new Date(point.timestamp).toLocaleDateString('en-GB', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }),
                        value: point.value || 0
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32)" />
                        <XAxis
                          dataKey="timestampMs"
                          type="number"
                          domain={['dataMin', 'dataMax']}
                          scale="time"
                          tick={{ fontSize: 12, fill: 'oklch(0.552 0.016 285.938)' }}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return date.toLocaleDateString('en-GB', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            });
                          }}
                        />
                        <YAxis tick={{ fontSize: 12, fill: 'oklch(0.552 0.016 285.938)' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'oklch(1 0 0)',
                            border: '1px solid oklch(0.92 0.004 286.32)',
                            borderRadius: '0.65rem'
                          }}
                          labelFormatter={(value) => {
                            const date = new Date(value);
                            return date.toLocaleString('en-GB', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            });
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="oklch(0.646 0.222 41.116)"
                          strokeWidth={2}
                          dot={{ fill: 'oklch(0.646 0.222 41.116)', r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-summary">
                    <div className="summary-item">
                      <span>Total Points:</span> <strong>{chartData.summary.total_points}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Changes Detected:</span> <strong>{chartData.summary.changes_detected}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Min Value:</span> <strong>{chartData.summary.value_range.min?.toFixed(2) || 'N/A'}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Max Value:</span> <strong>{chartData.summary.value_range.max?.toFixed(2) || 'N/A'}</strong>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Unit Edit Modal */}
      {showUnitModal && (
        <div className="modal-overlay" onClick={() => setShowUnitModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Set Display Unit</h3>
            <p className="modal-description">Choose a unit for {currentMonitor?.monitor_name}</p>

            <div className="unit-options">
              {['%', '$', '€', '£', 'ETH', 'BTC', 'SOL', 'USDC'].map(u => (
                <button
                  key={u}
                  className={`unit-option ${editingUnit === u ? 'active' : ''}`}
                  onClick={() => setEditingUnit(u)}
                >
                  {u}
                </button>
              ))}
            </div>

            <div className="custom-unit-input">
              <label>Custom Unit:</label>
              <input
                type="text"
                value={editingUnit}
                onChange={(e) => setEditingUnit(e.target.value)}
                placeholder="Enter custom unit"
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowUnitModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={() => handleUpdateUnit(editingUnit)}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Monitors Modal */}
      {showManageModal && (
        <div className="modal-overlay" onClick={() => onShowManageModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h3>Settings</h3>

            {/* Tab Navigation */}
            <div className="settings-tabs">
              <button
                className={`settings-tab ${settingsTab === 'monitors' ? 'active' : ''}`}
                onClick={() => onSetSettingsTab('monitors')}
              >
                Monitors
              </button>
              <button
                className={`settings-tab ${settingsTab === 'pushover' ? 'active' : ''}`}
                onClick={() => onSetSettingsTab('pushover')}
              >
                Pushover
              </button>
            </div>

            {/* Monitors Tab */}
            {settingsTab === 'monitors' && (
              <>
                <p className="modal-description">Hide, tag, or delete your monitors</p>

                {/* Search Bar */}
                <div style={{ marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="Search monitors..."
                    value={monitorSearchQuery}
                    onChange={(e) => onSetMonitorSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '14px',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      backgroundColor: 'var(--background)',
                      color: 'var(--foreground)'
                    }}
                  />
                </div>

                <div className="manage-list">
                  {monitors
                    .filter(monitor => {
                      if (!monitorSearchQuery) return true;
                      const searchLower = monitorSearchQuery.toLowerCase();
                      const displayName = monitorNames.get(monitor.monitor_id) || monitor.monitor_name || monitor.monitor_id;
                      const tags = monitorTags.get(monitor.monitor_id) || [];
                      return (
                        displayName?.toLowerCase().includes(searchLower) ||
                        monitor.monitor_id.toLowerCase().includes(searchLower) ||
                        tags.some(tag => tag.toLowerCase().includes(searchLower))
                      );
                    })
                    .map(monitor => (
                      <ManageMonitorItem
                        key={monitor.monitor_id}
                        monitor={monitor}
                        customName={monitorNames.get(monitor.monitor_id) || ''}
                        tags={monitorTags.get(monitor.monitor_id) || []}
                        isHidden={hiddenMonitors.has(monitor.monitor_id)}
                        formatValue={formatValue}
                        onToggleHide={() => onToggleHideMonitor(monitor.monitor_id)}
                        onDelete={() => onDeleteMonitor(monitor.monitor_id)}
                        onAddTag={(tag) => onAddTag(monitor.monitor_id, tag)}
                        onRemoveTag={(tag) => onRemoveTag(monitor.monitor_id, tag)}
                        onUpdateName={(name: string) => onUpdateName(monitor.monitor_id, name)}
                        onUpdateDecimalPlaces={(decimalPlaces: number) => onUpdateDecimalPlaces(monitor.monitor_id, decimalPlaces)}
                      />
                    ))}
                </div>

                {monitors.filter(monitor => {
                  if (!monitorSearchQuery) return true;
                  const searchLower = monitorSearchQuery.toLowerCase();
                  const displayName = monitorNames.get(monitor.monitor_id) || monitor.monitor_name || monitor.monitor_id;
                  const tags = monitorTags.get(monitor.monitor_id) || [];
                  return (
                    displayName?.toLowerCase().includes(searchLower) ||
                    monitor.monitor_id.toLowerCase().includes(searchLower) ||
                    tags.some(tag => tag.toLowerCase().includes(searchLower))
                  );
                }).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted-foreground)' }}>
                    No monitors found matching "{monitorSearchQuery}"
                  </div>
                )}
              </>
            )}

            {/* Pushover Tab */}
            {settingsTab === 'pushover' && (
              <div className="pushover-settings">
                <p className="modal-description">Configure Pushover notifications for alerts</p>

                <div className="pushover-form">
                  <div className="form-group">
                    <label>Pushover User Key *</label>
                    <input
                      type="password"
                      placeholder="Your 30-character user key"
                      value={pushoverUserKey}
                      onChange={(e) => onSetPushoverUserKey(e.target.value)}
                      className="pushover-input"
                    />
                    <small>Find this in your Pushover account settings</small>
                  </div>

                  <div className="form-group">
                    <label>API Token (Optional)</label>
                    <input
                      type="password"
                      placeholder="Leave empty to use default"
                      value={pushoverApiToken}
                      onChange={(e) => onSetPushoverApiToken(e.target.value)}
                      className="pushover-input"
                    />
                    <small>Use default token or create your own app in Pushover</small>
                  </div>

                  <div className="pushover-info">
                    <h4>How to get your Pushover User Key:</h4>
                    <ol>
                      <li>Sign up or log in at <a href="https://pushover.net" target="_blank" rel="noopener noreferrer">pushover.net</a></li>
                      <li>Your user key is shown on the main page</li>
                      <li>Copy and paste it above</li>
                    </ol>
                    <p><strong>Note:</strong> Pushover costs $5 one-time on iOS/Android after 7-day trial</p>
                  </div>

                  <div className="pushover-actions">
                    <button className="btn-secondary" onClick={onTestPushoverNotification}>
                      Test Notification
                    </button>
                    <button className="btn-primary" onClick={onSavePushoverConfig}>
                      Save Configuration
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-primary" onClick={() => onShowManageModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
