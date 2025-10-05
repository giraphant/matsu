import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Bell } from 'lucide-react';

interface FundingRateAlert {
  id: number;
  name: string;
  alert_type: 'single' | 'spread';
  exchanges: string[];
  threshold: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_triggered_at: string | null;
}

interface FundingRateAlertsProps {
  onClose: () => void;
}

const FundingRateAlerts: React.FC<FundingRateAlertsProps> = ({ onClose }) => {
  const [alerts, setAlerts] = useState<FundingRateAlert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAlert, setEditingAlert] = useState<FundingRateAlert | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    alert_type: 'single' as 'single' | 'spread',
    exchanges: [] as string[],
    threshold: 0.01, // 1%
    enabled: true
  });

  const availableExchanges = ['binance', 'bybit', 'hyperliquid', 'lighter', 'aster', 'grvt', 'backpack'];

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const response = await fetch('/api/dex/funding-rate-alerts');
      const data = await response.json();
      setAlerts(data);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingAlert
        ? `/api/dex/funding-rate-alerts/${editingAlert.id}`
        : '/api/dex/funding-rate-alerts';

      const method = editingAlert ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await loadAlerts();
        setShowForm(false);
        setEditingAlert(null);
        setFormData({
          name: '',
          alert_type: 'single',
          exchanges: [],
          threshold: 0.01,
          enabled: true
        });
      }
    } catch (error) {
      console.error('Failed to save alert:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定要删除这个提醒吗？')) return;

    try {
      const response = await fetch(`/api/dex/funding-rate-alerts/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadAlerts();
      }
    } catch (error) {
      console.error('Failed to delete alert:', error);
    }
  };

  const handleEdit = (alert: FundingRateAlert) => {
    setEditingAlert(alert);
    setFormData({
      name: alert.name,
      alert_type: alert.alert_type,
      exchanges: alert.exchanges,
      threshold: alert.threshold,
      enabled: alert.enabled
    });
    setShowForm(true);
  };

  const toggleExchange = (exchange: string) => {
    setFormData(prev => ({
      ...prev,
      exchanges: prev.exchanges.includes(exchange)
        ? prev.exchanges.filter(e => e !== exchange)
        : [...prev.exchanges, exchange]
    }));
  };

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet funding-rate-alerts" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-header">
          <h2>Funding Rate 提醒</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="bottom-sheet-content">
          {!showForm ? (
            <>
              <button
                className="btn-primary"
                onClick={() => setShowForm(true)}
                style={{ marginBottom: '16px', width: '100%' }}
              >
                <Plus size={16} /> 添加提醒规则
              </button>

              <div className="alerts-list">
                {alerts.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: '20px' }}>
                    还没有提醒规则
                  </p>
                ) : (
                  alerts.map(alert => (
                    <div key={alert.id} className="alert-item">
                      <div className="alert-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Bell size={16} style={{ color: alert.enabled ? 'var(--primary)' : 'var(--muted-foreground)' }} />
                          <strong>{alert.name}</strong>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--muted-foreground)', marginTop: '4px' }}>
                          {alert.alert_type === 'single' ? '单交易所' : 'Spread'} •
                          {alert.exchanges.map(e => e.toUpperCase()).join(', ')} •
                          阈值: {(alert.threshold * 100).toFixed(2)}%
                        </div>
                        {alert.last_triggered_at && (
                          <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px' }}>
                            上次触发: {new Date(alert.last_triggered_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="alert-actions">
                        <button
                          className="icon-btn"
                          onClick={() => handleEdit(alert)}
                          title="编辑"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="icon-btn"
                          onClick={() => handleDelete(alert.id)}
                          title="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>规则名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如: BTC高费率提醒"
                  required
                />
              </div>

              <div className="form-group">
                <label>提醒类型</label>
                <select
                  value={formData.alert_type}
                  onChange={(e) => setFormData({ ...formData, alert_type: e.target.value as 'single' | 'spread' })}
                >
                  <option value="single">单交易所费率</option>
                  <option value="spread">交易所间价差</option>
                </select>
              </div>

              <div className="form-group">
                <label>选择交易所</label>
                <div className="exchange-filters">
                  {availableExchanges.map(exchange => (
                    <label key={exchange} className="exchange-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.exchanges.includes(exchange)}
                        onChange={() => toggleExchange(exchange)}
                      />
                      <span>{exchange === 'backpack' ? 'BP' : exchange.toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>
                  阈值 (%)
                  {formData.alert_type === 'single'
                    ? ' - 费率大于等于此值时提醒'
                    : ' - 价差大于等于此值时提醒'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.threshold * 100}
                  onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) / 100 })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="enable-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  />
                  <span>启用此提醒</span>
                </label>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingAlert(null);
                  }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading || formData.exchanges.length === 0}
                >
                  {loading ? '保存中...' : (editingAlert ? '更新' : '创建')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default FundingRateAlerts;
