/**
 * Bento2 Grid View - New version using Monitor System (Testing)
 * Displays selected monitors as cards with alert highlighting and sound
 */

import { useState, useEffect, useCallback } from 'react';
import GridLayout from 'react-grid-layout';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewMonitor, AlertRule } from '../api/newMonitors';
import AddCardModal from '../components/bento/AddCardModal';
import { BentoCard } from '../components/bento/BentoCard';
import { useNotification } from '../hooks/useNotification';
import { AlertLevel } from '../types/alert';
import { ALERT_LEVELS } from '../constants/alerts';

interface Bento2ViewProps {
  displayedCards: NewMonitor[];
  availableMonitors: NewMonitor[];
  allMonitors: NewMonitor[];
  alertRules: AlertRule[];
  computedLayout: any[];
  isMobile: boolean;
  onLayoutChange: (layout: any[]) => void;
  onRemoveCard: (monitorId: string) => void;
  onAddCard: (monitorId: string) => void;
  onSaveAlertRule: (data: any) => Promise<void>;
  onDeleteAlertRule: (ruleId: string) => Promise<void>;
  getAlertRuleForMonitor: (monitorId: string) => AlertRule | undefined;
  gridLayout: any[];
}

export function Bento2View({
  displayedCards,
  availableMonitors,
  allMonitors,
  alertRules,
  computedLayout,
  isMobile,
  onLayoutChange,
  onRemoveCard,
  onAddCard,
  onSaveAlertRule,
  onDeleteAlertRule,
  getAlertRuleForMonitor,
  gridLayout
}: Bento2ViewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAlertPopover, setShowAlertPopover] = useState<string | null>(null);
  const [alertStates, setAlertStates] = useState<Map<string, {lastNotified: number, isActive: boolean}>>(new Map());
  const [miniChartData, setMiniChartData] = useState<Map<string, any[]>>(new Map());

  const { playAlertSound, requestNotificationPermission } = useNotification();

  // Helper function to parse alert rule into upper/lower limits
  const parseAlertRule = (rule: AlertRule | undefined): { upper?: number; lower?: number; level?: string } => {
    if (!rule) return {};

    const upperMatch = rule.condition.match(/>\s*=?\s*(-?\d+\.?\d*)/);
    const lowerMatch = rule.condition.match(/<\s*=?\s*(-?\d+\.?\d*)/);

    return {
      upper: upperMatch ? parseFloat(upperMatch[1]) : undefined,
      lower: lowerMatch ? parseFloat(lowerMatch[1]) : undefined,
      level: rule.level
    };
  };

  // Handle alert threshold update
  const handleAlertUpdate = async (monitorId: string, upper?: number, lower?: number, level?: string) => {
    const existingRule = getAlertRuleForMonitor(monitorId);
    const monitor = allMonitors.find(m => m.id === monitorId);

    if (!monitor) return;

    // Build condition from upper/lower
    const parts: string[] = [];
    const ref = `\${monitor:${monitorId}}`;

    if (upper !== undefined && upper !== null) {
      parts.push(`${ref} > ${upper}`);
    }
    if (lower !== undefined && lower !== null) {
      parts.push(`${ref} < ${lower}`);
    }

    const condition = parts.length > 0 ? parts.join(' || ') : `${ref} > 0`;

    const data: any = {
      name: `${monitor.name} Alert`,
      condition,
      level: level || 'medium',
      cooldown_seconds: ALERT_LEVELS[level as AlertLevel]?.interval || 300,
      actions: ['pushover']
    };

    if (existingRule) {
      data.id = existingRule.id;
    }

    await onSaveAlertRule(data);
    setShowAlertPopover(null);
  };

  // Helper function to evaluate alert condition
  const isMonitorInAlert = useCallback((monitor: NewMonitor, rule: AlertRule): boolean => {
    if (!rule.enabled || monitor.value === null || monitor.value === undefined) {
      return false;
    }

    const condition = rule.condition;
    const value = monitor.value;

    // Simple upper/lower limit check (supports patterns like "${monitor:id} > 100 || ${monitor:id} < 50")
    const upperMatch = condition.match(/>\s*=?\s*(-?\d+\.?\d*)/);
    const lowerMatch = condition.match(/<\s*=?\s*(-?\d+\.?\d*)/);

    if (upperMatch || lowerMatch) {
      const upper = upperMatch ? parseFloat(upperMatch[1]) : null;
      const lower = lowerMatch ? parseFloat(lowerMatch[1]) : null;

      if (upper !== null && value > upper) return true;
      if (lower !== null && value < lower) return true;
    }

    return false;
  }, []);

  // Alert checking loop
  useEffect(() => {
    if (displayedCards.length === 0) return;

    const checkAlerts = () => {
      displayedCards.forEach(monitor => {
        const rule = getAlertRuleForMonitor(monitor.id);
        if (!rule || !rule.enabled) return;

        const isAlert = isMonitorInAlert(monitor, rule);
        const state = alertStates.get(monitor.id);
        const level = rule.level as AlertLevel;
        const alertConfig = ALERT_LEVELS[level] || ALERT_LEVELS.medium;

        if (isAlert && monitor.value !== null) {
          // New alert or time to repeat
          const now = Date.now();
          const shouldNotify = !state?.isActive ||
            (now - state.lastNotified) >= alertConfig.interval * 1000;

          if (shouldNotify) {
            // Play alert sound
            playAlertSound(level);

            const newStates = new Map(alertStates);
            newStates.set(monitor.id, {
              lastNotified: now,
              isActive: true
            });
            setAlertStates(newStates);
          }
        } else if (state?.isActive) {
          // Clear alert state when value returns to normal
          const newStates = new Map(alertStates);
          newStates.set(monitor.id, {
            lastNotified: state.lastNotified,
            isActive: false
          });
          setAlertStates(newStates);
        }
      });
    };

    // Check immediately
    checkAlerts();

    // Then check every 10 seconds
    const interval = setInterval(checkAlerts, 10000);

    return () => clearInterval(interval);
  }, [displayedCards, alertRules, alertStates, isMonitorInAlert, getAlertRuleForMonitor, playAlertSound]);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  // Fetch chart data for displayed monitors
  useEffect(() => {
    const fetchChartData = async () => {
      const newChartData = new Map<string, any[]>();

      for (const monitor of displayedCards) {
        try {
          const response = await fetch(`/api/monitors/${monitor.id}/history?limit=50`);
          if (response.ok) {
            const data = await response.json();
            newChartData.set(monitor.id, data);
          }
        } catch (error) {
          console.error(`Failed to fetch chart data for ${monitor.id}:`, error);
        }
      }

      setMiniChartData(newChartData);
    };

    if (displayedCards.length > 0) {
      fetchChartData();

      // Refresh chart data every 30 seconds
      const interval = setInterval(fetchChartData, 30000);
      return () => clearInterval(interval);
    }
  }, [displayedCards]);

  // Sort items by layout order on mobile
  const getSortedItemsForMobile = () => {
    if (!isMobile) return displayedCards;

    const layoutMap = new Map(gridLayout.map(l => [l.i, l]));

    const allItems = displayedCards.map(m => ({
      monitor: m,
      layout: layoutMap.get(m.id) || { y: 999, x: 0 }
    }));

    allItems.sort((a, b) => {
      if (a.layout.y !== b.layout.y) return a.layout.y - b.layout.y;
      return a.layout.x - b.layout.x;
    });

    return allItems.map(item => item.monitor);
  };

  const sortedMonitors = getSortedItemsForMobile();

  if (displayedCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <h2 className="text-2xl font-semibold mb-3">No Cards Yet</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Add monitors to your Bento grid by clicking the button below.
          You can create monitors in the Monitors tab.
        </p>
        <Button onClick={() => setShowAddModal(true)} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Add Card
        </Button>

        <AddCardModal
          show={showAddModal}
          availableMonitors={availableMonitors}
          onClose={() => setShowAddModal(false)}
          onAdd={(id) => {
            onAddCard(id);
            setShowAddModal(false);
          }}
        />
      </div>
    );
  }

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
          const layout = gridLayout.find(l => l.i === monitor.id) || { h: 1 };
          const showChart = layout.h >= 2;
          const chartPoints = miniChartData.get(monitor.id) || [];
          const alertRule = getAlertRuleForMonitor(monitor.id);
          const hasAlert = !!alertRule;
          const isAlert = alertRule ? isMonitorInAlert(monitor, alertRule) : false;

          // Calculate min/avg/max from chart data
          let minValue = null;
          let avgValue = null;
          let maxValue = null;
          if (chartPoints.length > 0) {
            const values = chartPoints.map(p => p.value);
            minValue = Math.min(...values);
            maxValue = Math.max(...values);
            avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;
          }

          return (
            <div key={monitor.id} className="h-full">
              <BentoCard
                monitor={monitor}
                isAlert={isAlert}
                hasAlert={hasAlert}
                alertLevel={alertRule?.level}
                showChart={showChart}
                chartData={chartPoints}
                stats={{
                  min: minValue,
                  avg: avgValue,
                  max: maxValue,
                }}
                onAlertClick={() => setShowAlertPopover(showAlertPopover === monitor.id ? null : monitor.id)}
                onRemove={() => onRemoveCard(monitor.id)}
              />

              {/* Alert Settings Popover */}
              {showAlertPopover === monitor.id && (
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
                      defaultValue={parseAlertRule(alertRule).upper}
                      id={`upper-${monitor.id}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const upperInput = document.getElementById(`upper-${monitor.id}`) as HTMLInputElement;
                          const lowerInput = document.getElementById(`lower-${monitor.id}`) as HTMLInputElement;
                          const levelSelect = document.getElementById(`level-${monitor.id}`) as HTMLSelectElement;
                          const upper = upperInput.value ? parseFloat(upperInput.value) : undefined;
                          const lower = lowerInput.value ? parseFloat(lowerInput.value) : undefined;
                          const level = levelSelect.value;
                          handleAlertUpdate(monitor.id, upper, lower, level);
                        }
                      }}
                    />
                  </div>
                  <div className="threshold-input-group">
                    <label>Lower Limit</label>
                    <input
                      type="number"
                      placeholder="Leave empty to disable"
                      defaultValue={parseAlertRule(alertRule).lower}
                      id={`lower-${monitor.id}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const upperInput = document.getElementById(`upper-${monitor.id}`) as HTMLInputElement;
                          const lowerInput = document.getElementById(`lower-${monitor.id}`) as HTMLInputElement;
                          const levelSelect = document.getElementById(`level-${monitor.id}`) as HTMLSelectElement;
                          const upper = upperInput.value ? parseFloat(upperInput.value) : undefined;
                          const lower = lowerInput.value ? parseFloat(lowerInput.value) : undefined;
                          const level = levelSelect.value;
                          handleAlertUpdate(monitor.id, upper, lower, level);
                        }
                      }}
                    />
                  </div>
                  <div className="threshold-input-group">
                    <label>Alert Level</label>
                    <select
                      id={`level-${monitor.id}`}
                      defaultValue={parseAlertRule(alertRule).level || 'medium'}
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
                        handleAlertUpdate(monitor.id, undefined, undefined);
                      }}
                    >
                      Clear
                    </button>
                    <button
                      className="btn-primary"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        const upperInput = document.getElementById(`upper-${monitor.id}`) as HTMLInputElement;
                        const lowerInput = document.getElementById(`lower-${monitor.id}`) as HTMLInputElement;
                        const levelSelect = document.getElementById(`level-${monitor.id}`) as HTMLSelectElement;
                        const upper = upperInput.value ? parseFloat(upperInput.value) : undefined;
                        const lower = lowerInput.value ? parseFloat(lowerInput.value) : undefined;
                        const level = levelSelect.value;
                        handleAlertUpdate(monitor.id, upper, lower, level);
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </GridLayout>

      {/* Floating Action Button for Adding Cards */}
      {!isMobile && (
        <Button
          size="lg"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
          onClick={() => setShowAddModal(true)}
          title="Add card"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      <AddCardModal
        show={showAddModal}
        availableMonitors={availableMonitors}
        onClose={() => setShowAddModal(false)}
        onAdd={(id) => {
          onAddCard(id);
          setShowAddModal(false);
        }}
      />
    </div>
  );
}
