'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getPushoverConfigs,
  createPushoverConfig,
  updatePushoverConfig,
  deletePushoverConfig,
  testPushover,
  getFundingRateAlerts,
  createFundingRateAlert,
  updateFundingRateAlert,
  deleteFundingRateAlert,
  getSetting,
  updateSetting,
} from '@/lib/api';
import type { PushoverConfig, FundingRateAlert } from '@/lib/api';

export default function SettingsPage() {
  // State for different tabs
  const [activeTab, setActiveTab] = useState('general');

  // Pushover config state
  const [pushoverConfigs, setPushoverConfigs] = useState<PushoverConfig[]>([]);
  const [newPushoverName, setNewPushoverName] = useState('');
  const [newPushoverUserKey, setNewPushoverUserKey] = useState('');
  const [newPushoverApiToken, setNewPushoverApiToken] = useState('');
  const [newPushoverMinLevel, setNewPushoverMinLevel] = useState('low');
  const [testingPushover, setTestingPushover] = useState<number | null>(null);
  const [creatingPushover, setCreatingPushover] = useState(false);
  const [editingPushover, setEditingPushover] = useState<number | null>(null);
  const [editPushoverName, setEditPushoverName] = useState('');
  const [editPushoverUserKey, setEditPushoverUserKey] = useState('');
  const [editPushoverApiToken, setEditPushoverApiToken] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

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

  // JLP configuration state
  const [jlpAmount, setJlpAmount] = useState('0');
  const [savingJlpAmount, setSavingJlpAmount] = useState(false);

  // ALP configuration state
  const [alpAmount, setAlpAmount] = useState('0');
  const [savingAlpAmount, setSavingAlpAmount] = useState(false);

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
      const [pushoverData, fundingAlertsData] = await Promise.all([
        getPushoverConfigs().catch(() => []),
        getFundingRateAlerts().catch(() => []),
      ]);

      setPushoverConfigs(pushoverData);
      setFundingAlerts(fundingAlertsData);

      // Fetch JLP amount setting
      try {
        const jlpSetting = await getSetting('jlp_amount');
        setJlpAmount(jlpSetting.value);
      } catch (err) {
        // Setting might not exist yet, use default 0
        setJlpAmount('0');
      }

      // Fetch ALP amount setting
      try {
        const alpSetting = await getSetting('alp_amount');
        setAlpAmount(alpSetting.value);
      } catch (err) {
        // Setting might not exist yet, use default 0
        setAlpAmount('0');
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  // Pushover functions
  async function handleCreatePushover() {
    try {
      setCreatingPushover(true);
      setError(null);
      setSuccessMessage(null);

      await createPushoverConfig({
        name: newPushoverName,
        user_key: newPushoverUserKey,
        api_token: newPushoverApiToken || undefined,
        enabled: true,
        min_alert_level: newPushoverMinLevel,
      });

      setNewPushoverName('');
      setNewPushoverUserKey('');
      setNewPushoverApiToken('');
      setNewPushoverMinLevel('low');
      setSuccessMessage('Pushover configuration created successfully');
      fetchAllData();
    } catch (err) {
      setError('Failed to create Pushover configuration');
    } finally {
      setCreatingPushover(false);
    }
  }

  async function handleTogglePushover(config: PushoverConfig) {
    try {
      await updatePushoverConfig(config.id, {
        enabled: !config.enabled,
      });
      fetchAllData();
    } catch (err) {
      setError('Failed to update Pushover configuration');
    }
  }

  async function handleDeletePushover(id: number) {
    if (!confirm('Are you sure you want to delete this Pushover configuration?')) return;

    try {
      await deletePushoverConfig(id);
      setSuccessMessage('Pushover configuration deleted');
      fetchAllData();
    } catch (err) {
      setError('Failed to delete Pushover configuration');
    }
  }

  async function handleUpdateMinLevel(config: PushoverConfig, newLevel: string) {
    try {
      await updatePushoverConfig(config.id, {
        min_alert_level: newLevel,
      });
      fetchAllData();
    } catch (err) {
      setError('Failed to update alert level');
    }
  }

  function handleStartEdit(config: PushoverConfig) {
    setEditingPushover(config.id);
    setEditPushoverName(config.name);
    setEditPushoverUserKey(config.user_key);
    setEditPushoverApiToken(config.api_token || '');
  }

  function handleCancelEdit() {
    setEditingPushover(null);
    setEditPushoverName('');
    setEditPushoverUserKey('');
    setEditPushoverApiToken('');
  }

  async function handleSaveEdit(configId: number) {
    try {
      setSavingEdit(true);
      setError(null);
      setSuccessMessage(null);

      await updatePushoverConfig(configId, {
        name: editPushoverName,
        user_key: editPushoverUserKey,
        api_token: editPushoverApiToken || undefined,
      });

      setSuccessMessage('Pushover device updated successfully');
      handleCancelEdit();
      fetchAllData();
    } catch (err) {
      setError('Failed to update Pushover device');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleTestPushover(config: PushoverConfig) {
    try {
      setTestingPushover(config.id);
      setError(null);
      setSuccessMessage(null);

      const success = await testPushover({
        user_key: config.user_key,
        api_token: config.api_token,
      });

      if (success) {
        setSuccessMessage(`Test notification sent to ${config.name}!`);
      } else {
        setError(`Failed to send test notification to ${config.name}`);
      }
    } catch (err) {
      setError('Failed to send test notification');
    } finally {
      setTestingPushover(null);
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

  // JLP amount functions
  async function handleSaveJlpAmount() {
    try {
      setSavingJlpAmount(true);
      setError(null);
      setSuccessMessage(null);

      await updateSetting('jlp_amount', jlpAmount);
      setSuccessMessage('JLP amount updated successfully');
    } catch (err) {
      setError('Failed to update JLP amount');
    } finally {
      setSavingJlpAmount(false);
    }
  }

  // ALP amount functions
  async function handleSaveAlpAmount() {
    try {
      setSavingAlpAmount(true);
      setError(null);
      setSuccessMessage(null);

      await updateSetting('alp_amount', alpAmount);
      setSuccessMessage('ALP amount updated successfully');
    } catch (err) {
      setError('Failed to update ALP amount');
    } finally {
      setSavingAlpAmount(false);
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="funding">Funding Alerts</TabsTrigger>
          <TabsTrigger value="positions">Position Config</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Pushover Device</CardTitle>
              <CardDescription>
                Configure multiple Pushover devices for receiving alert notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="pushover-name" className="text-sm font-medium">
                  Device Name
                </label>
                <Input
                  id="pushover-name"
                  value={newPushoverName}
                  onChange={(e) => setNewPushoverName(e.target.value)}
                  placeholder="e.g., iPhone, iPad, Desktop"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="pushover-user" className="text-sm font-medium">
                  User Key
                </label>
                <Input
                  id="pushover-user"
                  value={newPushoverUserKey}
                  onChange={(e) => setNewPushoverUserKey(e.target.value)}
                  placeholder="Your Pushover user key"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="pushover-token" className="text-sm font-medium">
                  API Token (Optional)
                </label>
                <Input
                  id="pushover-token"
                  value={newPushoverApiToken}
                  onChange={(e) => setNewPushoverApiToken(e.target.value)}
                  placeholder="Custom API token (leave empty for default)"
                  type="password"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="pushover-min-level" className="text-sm font-medium">
                  Minimum Alert Level
                </label>
                <Select value={newPushoverMinLevel} onValueChange={setNewPushoverMinLevel}>
                  <SelectTrigger id="pushover-min-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (All alerts)</SelectItem>
                    <SelectItem value="medium">Medium and above</SelectItem>
                    <SelectItem value="high">High and Critical only</SelectItem>
                    <SelectItem value="critical">Critical only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreatePushover}
                disabled={creatingPushover || !newPushoverName || !newPushoverUserKey}
              >
                {creatingPushover ? 'Adding...' : 'Add Device'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Pushover Devices</CardTitle>
              <CardDescription>
                Manage your Pushover notification devices
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-muted-foreground">Loading...</div>
              ) : pushoverConfigs.length === 0 ? (
                <div className="text-muted-foreground">No Pushover devices configured</div>
              ) : (
                <div className="space-y-2">
                  {pushoverConfigs.map((config) => (
                    <div key={config.id} className="rounded-lg border p-3">
                      {editingPushover === config.id ? (
                        // Edit mode
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Device Name</label>
                            <Input
                              value={editPushoverName}
                              onChange={(e) => setEditPushoverName(e.target.value)}
                              placeholder="Device name"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">User Key</label>
                            <Input
                              value={editPushoverUserKey}
                              onChange={(e) => setEditPushoverUserKey(e.target.value)}
                              placeholder="Pushover user key"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">API Token (Optional)</label>
                            <Input
                              value={editPushoverApiToken}
                              onChange={(e) => setEditPushoverApiToken(e.target.value)}
                              placeholder="Custom API token"
                              type="password"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleSaveEdit(config.id)}
                              disabled={savingEdit || !editPushoverName || !editPushoverUserKey}
                              size="sm"
                            >
                              {savingEdit ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={handleCancelEdit}
                              disabled={savingEdit}
                              size="sm"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // Display mode
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="font-medium">{config.name}</div>
                            <div className="text-sm text-muted-foreground">
                              User Key: {config.user_key.slice(0, 10)}...
                            </div>
                            {config.api_token && (
                              <div className="text-xs text-muted-foreground">
                                Custom API Token configured
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-muted-foreground">Min Level:</span>
                              <Select
                                value={config.min_alert_level}
                                onValueChange={(value) => handleUpdateMinLevel(config, value)}
                              >
                                <SelectTrigger className="h-7 w-[140px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low (All)</SelectItem>
                                  <SelectItem value="medium">Medium+</SelectItem>
                                  <SelectItem value="high">High+</SelectItem>
                                  <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStartEdit(config)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestPushover(config)}
                              disabled={testingPushover === config.id}
                            >
                              {testingPushover === config.id ? 'Testing...' : 'Test'}
                            </Button>
                            <Switch
                              checked={config.enabled}
                              onCheckedChange={() => handleTogglePushover(config)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePushover(config.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}
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

        <TabsContent value="positions" className="space-y-4">
          {/* JLP Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>JLP Position Configuration</CardTitle>
              <CardDescription>
                Configure your JLP token holdings for hedge position calculation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="jlp-amount" className="text-sm font-medium">
                  JLP Amount
                </label>
                <Input
                  id="jlp-amount"
                  type="number"
                  step="0.01"
                  value={jlpAmount}
                  onChange={(e) => setJlpAmount(e.target.value)}
                  placeholder="Enter your JLP amount"
                />
                <p className="text-xs text-muted-foreground">
                  Calculates hedge positions for SOL, ETH, and BTC. Set to 0 to disable.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleSaveJlpAmount}
                  disabled={savingJlpAmount}
                >
                  {savingJlpAmount ? 'Saving...' : 'Save JLP Amount'}
                </Button>
                <div className="text-sm">
                  Status: {parseFloat(jlpAmount) > 0 ? (
                    <span className="text-green-600 dark:text-green-400 font-medium">Active</span>
                  ) : (
                    <span className="text-muted-foreground">Inactive</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ALP Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>ALP Position Configuration</CardTitle>
              <CardDescription>
                Configure your ALP token holdings for hedge position calculation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="alp-amount" className="text-sm font-medium">
                  ALP Amount
                </label>
                <Input
                  id="alp-amount"
                  type="number"
                  step="0.01"
                  value={alpAmount}
                  onChange={(e) => setAlpAmount(e.target.value)}
                  placeholder="Enter your ALP amount"
                />
                <p className="text-xs text-muted-foreground">
                  Calculates hedge positions for SOL, BONK, and BTC. Set to 0 to disable.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleSaveAlpAmount}
                  disabled={savingAlpAmount}
                >
                  {savingAlpAmount ? 'Saving...' : 'Save ALP Amount'}
                </Button>
                <div className="text-sm">
                  Status: {parseFloat(alpAmount) > 0 ? (
                    <span className="text-green-600 dark:text-green-400 font-medium">Active</span>
                  ) : (
                    <span className="text-muted-foreground">Inactive</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Configuration Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Position Monitors Status</CardTitle>
              <CardDescription>
                All position monitors run every 60 seconds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="font-medium">JLP Hedge Monitor</div>
                    <div className="text-sm text-muted-foreground">
                      {parseFloat(jlpAmount).toLocaleString()} JLP → SOL, ETH, BTC
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    {parseFloat(jlpAmount) > 0 ? (
                      <span className="text-green-600 dark:text-green-400">Active</span>
                    ) : (
                      <span className="text-muted-foreground">Inactive</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="font-medium">ALP Hedge Monitor</div>
                    <div className="text-sm text-muted-foreground">
                      {parseFloat(alpAmount).toLocaleString()} ALP → SOL, BONK, BTC
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    {parseFloat(alpAmount) > 0 ? (
                      <span className="text-green-600 dark:text-green-400">Active</span>
                    ) : (
                      <span className="text-muted-foreground">Inactive</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}