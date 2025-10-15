'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getMonitors,
  createMonitor,
  updateMonitor,
  deleteMonitor,
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  getPushoverConfig,
  savePushoverConfig,
  testPushover,
  getFundingRateAlerts,
  createFundingRateAlert,
  updateFundingRateAlert,
  deleteFundingRateAlert,
} from '@/lib/api';
import type { Monitor, AlertRule, PushoverConfig, FundingRateAlert } from '@/lib/api';

export default function SettingsPage() {
  // State for different tabs
  const [activeTab, setActiveTab] = useState('general');

  // Pushover config state
  const [pushoverConfig, setPushoverConfig] = useState<PushoverConfig | null>(null);
  const [pushoverUserKey, setPushoverUserKey] = useState('');
  const [pushoverApiToken, setPushoverApiToken] = useState('');
  const [testingPushover, setTestingPushover] = useState(false);
  const [savingPushover, setSavingPushover] = useState(false);

  // Monitors state
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [newMonitorName, setNewMonitorName] = useState('');
  const [newMonitorFormula, setNewMonitorFormula] = useState('');
  const [newMonitorUnit, setNewMonitorUnit] = useState('');
  const [creatingMonitor, setCreatingMonitor] = useState(false);

  // Alert rules state
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [newAlertName, setNewAlertName] = useState('');
  const [newAlertCondition, setNewAlertCondition] = useState('');
  const [newAlertLevel, setNewAlertLevel] = useState('medium');
  const [creatingAlert, setCreatingAlert] = useState(false);

  // Funding rate alerts state
  const [fundingAlerts, setFundingAlerts] = useState<FundingRateAlert[]>([]);
  const [newFundingAlertName, setNewFundingAlertName] = useState('');
  const [newFundingAlertType, setNewFundingAlertType] = useState('single');
  const [newFundingAlertExchanges, setNewFundingAlertExchanges] = useState<string[]>([]);
  const [newFundingAlertThreshold, setNewFundingAlertThreshold] = useState('0.01');
  const [creatingFundingAlert, setCreatingFundingAlert] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Available exchanges for funding rate alerts
  const availableExchanges = ['lighter', 'aster', 'grvt', 'backpack', 'hyperliquid', 'bybit', 'binance'];

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [pushoverData, monitorsData, alertRulesData, fundingAlertsData] = await Promise.all([
        getPushoverConfig().catch(() => null),
        getMonitors().catch(() => []),
        getAlertRules().catch(() => []),
        getFundingRateAlerts().catch(() => []),
      ]);

      if (pushoverData) {
        setPushoverConfig(pushoverData);
        setPushoverUserKey(pushoverData.user_key || '');
        setPushoverApiToken(pushoverData.api_token || '');
      }

      setMonitors(monitorsData);
      setAlertRules(alertRulesData);
      setFundingAlerts(fundingAlertsData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  // Pushover functions
  async function handleSavePushover() {
    try {
      setSavingPushover(true);
      setError(null);
      setSuccessMessage(null);

      await savePushoverConfig({
        user_key: pushoverUserKey,
        api_token: pushoverApiToken,
      });

      setSuccessMessage('Pushover configuration saved successfully');
      fetchAllData();
    } catch (err) {
      setError('Failed to save Pushover configuration');
    } finally {
      setSavingPushover(false);
    }
  }

  async function handleTestPushover() {
    try {
      setTestingPushover(true);
      setError(null);
      setSuccessMessage(null);

      const success = await testPushover({
        user_key: pushoverUserKey,
        api_token: pushoverApiToken,
      });

      if (success) {
        setSuccessMessage('Test notification sent successfully!');
      } else {
        setError('Failed to send test notification');
      }
    } catch (err) {
      setError('Failed to send test notification');
    } finally {
      setTestingPushover(false);
    }
  }

  // Monitor functions
  async function handleCreateMonitor() {
    try {
      setCreatingMonitor(true);
      setError(null);

      await createMonitor({
        name: newMonitorName,
        formula: newMonitorFormula,
        unit: newMonitorUnit || undefined,
        decimal_places: 2,
        enabled: true,
      });

      setNewMonitorName('');
      setNewMonitorFormula('');
      setNewMonitorUnit('');
      setSuccessMessage('Monitor created successfully');
      fetchAllData();
    } catch (err) {
      setError('Failed to create monitor');
    } finally {
      setCreatingMonitor(false);
    }
  }

  async function handleToggleMonitor(monitor: Monitor) {
    try {
      await updateMonitor(monitor.id, { enabled: !monitor.enabled });
      fetchAllData();
    } catch (err) {
      setError('Failed to update monitor');
    }
  }

  async function handleDeleteMonitor(id: string) {
    if (!confirm('Are you sure you want to delete this monitor?')) return;

    try {
      await deleteMonitor(id);
      setSuccessMessage('Monitor deleted');
      fetchAllData();
    } catch (err) {
      setError('Failed to delete monitor');
    }
  }

  // Alert rule functions
  async function handleCreateAlert() {
    try {
      setCreatingAlert(true);
      setError(null);

      await createAlertRule({
        name: newAlertName,
        condition: newAlertCondition,
        level: newAlertLevel,
        actions: ['pushover'],
        cooldown_seconds: 300,
      });

      setNewAlertName('');
      setNewAlertCondition('');
      setSuccessMessage('Alert rule created successfully');
      fetchAllData();
    } catch (err) {
      setError('Failed to create alert rule');
    } finally {
      setCreatingAlert(false);
    }
  }

  async function handleToggleAlert(alert: AlertRule) {
    try {
      await updateAlertRule(alert.id, {
        name: alert.name,
        condition: alert.condition,
        level: alert.level,
        enabled: !alert.enabled,
        cooldown_seconds: alert.cooldown_seconds,
        actions: alert.actions,
      });
      fetchAllData();
    } catch (err) {
      setError('Failed to update alert rule');
    }
  }

  async function handleDeleteAlert(id: string) {
    if (!confirm('Are you sure you want to delete this alert rule?')) return;

    try {
      await deleteAlertRule(id);
      setSuccessMessage('Alert rule deleted');
      fetchAllData();
    } catch (err) {
      setError('Failed to delete alert rule');
    }
  }

  // Funding rate alert functions
  async function handleCreateFundingAlert() {
    try {
      setCreatingFundingAlert(true);
      setError(null);

      await createFundingRateAlert({
        name: newFundingAlertName,
        alert_type: newFundingAlertType,
        exchanges: newFundingAlertExchanges,
        threshold: parseFloat(newFundingAlertThreshold),
        enabled: true,
      });

      setNewFundingAlertName('');
      setNewFundingAlertExchanges([]);
      setNewFundingAlertThreshold('0.01');
      setSuccessMessage('Funding rate alert created successfully');
      fetchAllData();
    } catch (err) {
      setError('Failed to create funding rate alert');
    } finally {
      setCreatingFundingAlert(false);
    }
  }

  async function handleToggleFundingAlert(alert: FundingRateAlert) {
    try {
      await updateFundingRateAlert(alert.id, {
        name: alert.name,
        alert_type: alert.alert_type,
        exchanges: alert.exchanges,
        threshold: alert.threshold,
        enabled: !alert.enabled,
      });
      fetchAllData();
    } catch (err) {
      setError('Failed to update funding rate alert');
    }
  }

  async function handleDeleteFundingAlert(id: number) {
    if (!confirm('Are you sure you want to delete this funding rate alert?')) return;

    try {
      await deleteFundingRateAlert(id);
      setSuccessMessage('Funding rate alert deleted');
      fetchAllData();
    } catch (err) {
      setError('Failed to delete funding rate alert');
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Settings</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-destructive">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg bg-green-100 dark:bg-green-900 p-3 text-green-800 dark:text-green-200">
          {successMessage}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="monitors">Monitors</TabsTrigger>
          <TabsTrigger value="alerts">Alert Rules</TabsTrigger>
          <TabsTrigger value="funding">Funding Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pushover Notifications</CardTitle>
              <CardDescription>
                Configure Pushover for receiving alert notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="pushover-user" className="text-sm font-medium">
                  User Key
                </label>
                <Input
                  id="pushover-user"
                  value={pushoverUserKey}
                  onChange={(e) => setPushoverUserKey(e.target.value)}
                  placeholder="Your Pushover user key"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="pushover-token" className="text-sm font-medium">
                  API Token (Optional)
                </label>
                <Input
                  id="pushover-token"
                  value={pushoverApiToken}
                  onChange={(e) => setPushoverApiToken(e.target.value)}
                  placeholder="Custom API token (leave empty for default)"
                  type="password"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSavePushover}
                  disabled={savingPushover || !pushoverUserKey}
                >
                  {savingPushover ? 'Saving...' : 'Save Configuration'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestPushover}
                  disabled={testingPushover || !pushoverUserKey}
                >
                  {testingPushover ? 'Sending...' : 'Send Test'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Monitor</CardTitle>
              <CardDescription>
                Add a new monitor to track calculated values
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  placeholder="Monitor name"
                  value={newMonitorName}
                  onChange={(e) => setNewMonitorName(e.target.value)}
                />
                <Input
                  placeholder="Formula (e.g., value * 2)"
                  value={newMonitorFormula}
                  onChange={(e) => setNewMonitorFormula(e.target.value)}
                />
                <Input
                  placeholder="Unit (optional)"
                  value={newMonitorUnit}
                  onChange={(e) => setNewMonitorUnit(e.target.value)}
                />
              </div>
              <Button
                onClick={handleCreateMonitor}
                disabled={creatingMonitor || !newMonitorName || !newMonitorFormula}
              >
                {creatingMonitor ? 'Creating...' : 'Create Monitor'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing Monitors</CardTitle>
              <CardDescription>
                Manage your configured monitors
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-muted-foreground">Loading...</div>
              ) : monitors.length === 0 ? (
                <div className="text-muted-foreground">No monitors configured</div>
              ) : (
                <div className="space-y-2">
                  {monitors.map((monitor) => (
                    <div key={monitor.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-1">
                        <div className="font-medium">{monitor.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Formula: {monitor.formula} {monitor.unit && `(${monitor.unit})`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={monitor.enabled}
                          onCheckedChange={() => handleToggleMonitor(monitor)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMonitor(monitor.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Alert Rule</CardTitle>
              <CardDescription>
                Define conditions that trigger notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  placeholder="Alert name"
                  value={newAlertName}
                  onChange={(e) => setNewAlertName(e.target.value)}
                />
                <Input
                  placeholder="Condition (e.g., value > 100)"
                  value={newAlertCondition}
                  onChange={(e) => setNewAlertCondition(e.target.value)}
                />
                <Select value={newAlertLevel} onValueChange={setNewAlertLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alert level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreateAlert}
                disabled={creatingAlert || !newAlertName || !newAlertCondition}
              >
                {creatingAlert ? 'Creating...' : 'Create Alert Rule'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing Alert Rules</CardTitle>
              <CardDescription>
                Manage your alert rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-muted-foreground">Loading...</div>
              ) : alertRules.length === 0 ? (
                <div className="text-muted-foreground">No alert rules configured</div>
              ) : (
                <div className="space-y-2">
                  {alertRules.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-1">
                        <div className="font-medium">{alert.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Condition: {alert.condition} | Level: {alert.level}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={alert.enabled}
                          onCheckedChange={() => handleToggleAlert(alert)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAlert(alert.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Funding Rate Alert</CardTitle>
              <CardDescription>
                Get notified about funding rate opportunities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  placeholder="Alert name"
                  value={newFundingAlertName}
                  onChange={(e) => setNewFundingAlertName(e.target.value)}
                />
                <Select value={newFundingAlertType} onValueChange={setNewFundingAlertType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alert type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Exchange (Spot Arbitrage)</SelectItem>
                    <SelectItem value="spread">Spread Between Exchanges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Exchanges</label>
                <div className="flex flex-wrap gap-2">
                  {availableExchanges.map((exchange) => (
                    <Button
                      key={exchange}
                      variant={newFundingAlertExchanges.includes(exchange) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        if (newFundingAlertExchanges.includes(exchange)) {
                          setNewFundingAlertExchanges(newFundingAlertExchanges.filter(e => e !== exchange));
                        } else {
                          setNewFundingAlertExchanges([...newFundingAlertExchanges, exchange]);
                        }
                      }}
                    >
                      {exchange.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Threshold ({newFundingAlertType === 'single' ? 'Min Rate' : 'Min Spread'})
                </label>
                <Input
                  type="number"
                  step="0.0001"
                  placeholder="0.01 (1%)"
                  value={newFundingAlertThreshold}
                  onChange={(e) => setNewFundingAlertThreshold(e.target.value)}
                />
              </div>
              <Button
                onClick={handleCreateFundingAlert}
                disabled={creatingFundingAlert || !newFundingAlertName || newFundingAlertExchanges.length === 0}
              >
                {creatingFundingAlert ? 'Creating...' : 'Create Funding Alert'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing Funding Rate Alerts</CardTitle>
              <CardDescription>
                Manage your funding rate alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-muted-foreground">Loading...</div>
              ) : fundingAlerts.length === 0 ? (
                <div className="text-muted-foreground">No funding rate alerts configured</div>
              ) : (
                <div className="space-y-2">
                  {fundingAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-1">
                        <div className="font-medium">{alert.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Type: {alert.alert_type} | Threshold: {(alert.threshold * 100).toFixed(2)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Exchanges: {alert.exchanges.join(', ')}
                        </div>
                        {alert.last_triggered_at && (
                          <div className="text-xs text-muted-foreground">
                            Last triggered: {new Date(alert.last_triggered_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={alert.enabled}
                          onCheckedChange={() => handleToggleFundingAlert(alert)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteFundingAlert(alert.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}