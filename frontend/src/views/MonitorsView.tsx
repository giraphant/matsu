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
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold dark:text-white mb-2">Monitor System</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create computed monitors with formulas and set up alert rules
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b dark:border-gray-700">
        <button
          onClick={() => setActiveTab('monitors')}
          className={`px-4 py-2 border-b-2 transition ${
            activeTab === 'monitors'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Monitors ({monitors.length})
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2 border-b-2 transition ${
            activeTab === 'alerts'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Alert Rules ({alertRules.length})
        </button>
      </div>

      {/* Monitors Tab */}
      {activeTab === 'monitors' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold dark:text-white">Monitors</h2>
            <div className="flex gap-2">
              <button
                onClick={handleRecompute}
                className="px-4 py-2 border rounded hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-white flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Recompute All
              </button>
              <button
                onClick={() => {
                  setEditingMonitor(null);
                  setShowMonitorModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={16} />
                New Monitor
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            {monitors.map(monitor => (
              <div
                key={monitor.id}
                className="border dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition"
                style={{ borderLeftWidth: '4px', borderLeftColor: monitor.color || '#3b82f6' }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold dark:text-white">{monitor.name}</h3>
                      <span className={`px-2 py-1 text-xs rounded ${
                        monitor.type === 'computed' ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' :
                        monitor.type === 'constant' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                        'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      }`}>
                        {monitor.type}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-mono">
                      {monitor.formula}
                    </div>
                    {monitor.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{monitor.description}</p>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold dark:text-white">
                        {monitor.value !== null && monitor.value !== undefined
                          ? monitor.value.toFixed(monitor.decimal_places)
                          : 'N/A'}
                        {monitor.unit && <span className="text-lg ml-1 text-gray-500">{monitor.unit}</span>}
                      </div>
                      {monitor.computed_at && (
                        <div className="text-xs text-gray-500">
                          Updated: {new Date(monitor.computed_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingMonitor(monitor);
                        setShowMonitorModal(true);
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="Edit"
                    >
                      <Edit size={16} className="dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteMonitor(monitor.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                      title="Delete"
                    >
                      <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {monitors.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No monitors yet. Click "New Monitor" to create one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alert Rules Tab */}
      {activeTab === 'alerts' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold dark:text-white">Alert Rules</h2>
            <button
              onClick={() => {
                setEditingAlert(null);
                setShowAlertModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus size={16} />
              New Alert Rule
            </button>
          </div>

          <div className="grid gap-4">
            {alertRules.map(rule => (
              <div
                key={rule.id}
                className="border dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={18} className={
                        rule.level === 'high' ? 'text-red-600' :
                        rule.level === 'medium' ? 'text-yellow-600' :
                        'text-blue-600'
                      } />
                      <h3 className="text-lg font-semibold dark:text-white">{rule.name}</h3>
                      {!rule.enabled && (
                        <span className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-mono">
                      {rule.condition}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>Level: <strong className="capitalize">{rule.level}</strong></span>
                      <span>Cooldown: {rule.cooldown_seconds}s</span>
                      <span>Actions: {rule.actions.join(', ')}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingAlert(rule);
                        setShowAlertModal(true);
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="Edit"
                    >
                      <Edit size={16} className="dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteAlert(rule.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                      title="Delete"
                    >
                      <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {alertRules.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
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
