/**
 * Monitors Management View
 * Create and manage monitors and alert rules
 */

import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { newMonitorApi, alertRuleApi, NewMonitor, AlertRule, MonitorCreate, AlertRuleCreate } from '../api/newMonitors';
import NewMonitorModal from '../components/monitors/NewMonitorModal';
import AlertRuleModal from '../components/monitors/AlertRuleModal';

export default function MonitorsView() {
  const [monitors, setMonitors] = useState<NewMonitor[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMonitorModal, setShowMonitorModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<NewMonitor | null>(null);
  const [editingAlert, setEditingAlert] = useState<AlertRule | null>(null);
  const [activeTab, setActiveTab] = useState<'monitors' | 'alerts'>('monitors');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [monitorsData, alertsData] = await Promise.all([
        newMonitorApi.getAll(),
        alertRuleApi.getAll()
      ]);
      setMonitors(monitorsData);
      setAlertRules(alertsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMonitor = async (data: MonitorCreate) => {
    if (editingMonitor) {
      await newMonitorApi.update(editingMonitor.id, data);
    } else {
      await newMonitorApi.create(data);
    }
    await loadData();
    setEditingMonitor(null);
  };

  const handleDeleteMonitor = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this monitor?')) return;
    try {
      await newMonitorApi.delete(id);
      await loadData();
    } catch (error) {
      alert('Failed to delete monitor');
    }
  };

  const handleSaveAlert = async (data: AlertRuleCreate) => {
    if (editingAlert) {
      await alertRuleApi.update(editingAlert.id, data);
    } else {
      await alertRuleApi.create(data);
    }
    await loadData();
    setEditingAlert(null);
  };

  const handleDeleteAlert = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this alert rule?')) return;
    try {
      await alertRuleApi.delete(id);
      await loadData();
    } catch (error) {
      alert('Failed to delete alert rule');
    }
  };

  const handleRecompute = async () => {
    try {
      await newMonitorApi.recomputeAll();
      await loadData();
      alert('All monitors recomputed successfully');
    } catch (error) {
      alert('Failed to recompute monitors');
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="monitors-container">
      <div className="monitors-header">
        <h1>Monitor System</h1>
        <p>Create computed monitors with formulas and set up alert rules</p>
      </div>

      {/* Tabs */}
      <div className="monitors-tabs">
        <button
          onClick={() => setActiveTab('monitors')}
          className={`monitors-tab ${activeTab === 'monitors' ? 'active' : ''}`}
        >
          Monitors ({monitors.length})
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`monitors-tab ${activeTab === 'alerts' ? 'active' : ''}`}
        >
          Alert Rules ({alertRules.length})
        </button>
      </div>

      {/* Monitors Tab */}
      {activeTab === 'monitors' && (
        <div>
          <div className="monitors-actions">
            <h2>Monitors</h2>
            <div className="monitors-actions-buttons">
              <button onClick={handleRecompute} className="btn-secondary">
                <RefreshCw size={16} style={{ marginRight: '6px' }} />
                Recompute All
              </button>
              <button
                onClick={() => {
                  setEditingMonitor(null);
                  setShowMonitorModal(true);
                }}
                className="btn-primary"
              >
                <Plus size={16} style={{ marginRight: '6px' }} />
                New Monitor
              </button>
            </div>
          </div>

          <div>
            {monitors.map(monitor => (
              <div
                key={monitor.id}
                className="monitor-card"
                style={{ borderLeft: `4px solid ${monitor.color || '#3b82f6'}` }}
              >
                <div className="monitor-card-header">
                  <div className="monitor-card-info">
                    <div className="monitor-card-title">
                      <h3>{monitor.name}</h3>
                    </div>
                    <div className="monitor-formula">{monitor.formula}</div>
                    {monitor.description && (
                      <p className="monitor-description">{monitor.description}</p>
                    )}
                    <div className="monitor-value-display">
                      <div>
                        <span className="value">
                          {monitor.value !== null && monitor.value !== undefined
                            ? monitor.value.toFixed(monitor.decimal_places)
                            : 'N/A'}
                        </span>
                        {monitor.unit && <span className="unit">{monitor.unit}</span>}
                      </div>
                      {monitor.computed_at && (
                        <span className="timestamp">
                          Updated: {new Date(monitor.computed_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="monitor-card-actions">
                    <button
                      onClick={() => {
                        setEditingMonitor(monitor);
                        setShowMonitorModal(true);
                      }}
                      className="btn-icon"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteMonitor(monitor.id)}
                      className="btn-icon btn-danger"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {monitors.length === 0 && (
              <div className="monitor-empty">
                No monitors yet. Click "New Monitor" to create one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alert Rules Tab */}
      {activeTab === 'alerts' && (
        <div>
          <div className="monitors-actions">
            <h2>Alert Rules</h2>
            <button
              onClick={() => {
                setEditingAlert(null);
                setShowAlertModal(true);
              }}
              className="btn-primary"
            >
              <Plus size={16} style={{ marginRight: '6px' }} />
              New Alert Rule
            </button>
          </div>

          <div>
            {alertRules.map(rule => (
              <div key={rule.id} className="alert-rule-card">
                <div className="alert-rule-header">
                  <div className="alert-rule-info">
                    <div className="alert-rule-title">
                      <AlertTriangle
                        size={18}
                        style={{
                          color: rule.level === 'high' ? '#dc2626' :
                                 rule.level === 'medium' ? '#ca8a04' : '#2563eb'
                        }}
                      />
                      <h3>{rule.name}</h3>
                      {!rule.enabled && (
                        <span className="alert-level-badge disabled">Disabled</span>
                      )}
                    </div>
                    <div className="alert-condition">{rule.condition}</div>
                    <div className="alert-rule-meta">
                      <span>Level: <strong style={{ textTransform: 'capitalize' }}>{rule.level}</strong></span>
                      <span>Cooldown: {rule.cooldown_seconds}s</span>
                      <span>Actions: {rule.actions.join(', ')}</span>
                    </div>
                  </div>
                  <div className="alert-rule-actions">
                    <button
                      onClick={() => {
                        setEditingAlert(rule);
                        setShowAlertModal(true);
                      }}
                      className="btn-icon"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteAlert(rule.id)}
                      className="btn-icon btn-danger"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {alertRules.length === 0 && (
              <div className="monitor-empty">
                No alert rules yet. Click "New Alert Rule" to create one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <NewMonitorModal
        show={showMonitorModal}
        monitor={editingMonitor}
        existingMonitors={monitors}
        onClose={() => {
          setShowMonitorModal(false);
          setEditingMonitor(null);
        }}
        onSave={handleSaveMonitor}
      />

      <AlertRuleModal
        show={showAlertModal}
        rule={editingAlert}
        monitors={monitors}
        onClose={() => {
          setShowAlertModal(false);
          setEditingAlert(null);
        }}
        onSave={handleSaveAlert}
      />
    </div>
  );
}
