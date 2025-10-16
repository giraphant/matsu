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
  const [testingPushover, setTestingPushover] = useState<number | null>(null);
  const [creatingPushover, setCreatingPushover] = useState(false);

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
      const [pushoverData, fundingAlertsData] = await Promise.all([
        getPushoverConfigs().catch(() => []),
        getFundingRateAlerts().catch(() => []),
      ]);

      setPushoverConfigs(pushoverData);
      setFundingAlerts(fundingAlertsData);
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
      });

      setNewPushoverName('');
      setNewPushoverUserKey('');
      setNewPushoverApiToken('');
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="funding">Funding Alerts</TabsTrigger>
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
                    <div key={config.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-1">
                        <div className="font-medium">{config.name}</div>
                        <div className="text-sm text-muted-foreground">
                          User Key: {config.user_key.slice(0, 10)}...
                        </div>
                        {config.api_token && (
                          <div className="text-xs text-muted-foreground">
                            Custom API Token configured
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
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