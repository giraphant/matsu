/**
 * Bento2 Grid View - New version using Monitor System (Testing)
 * Displays selected monitors as cards with alert highlighting and sound
 */

import React, { useState, useEffect, useCallback } from 'react';
import GridLayout from 'react-grid-layout';
import { Plus, Trash2, Bell } from 'lucide-react';
import { NewMonitor, AlertRule } from '../api/newMonitors';
import { formatValue, formatTimeSince } from '../utils/format';
import AddCardModal from '../components/bento/AddCardModal';
import AlertRuleModal from '../components/monitors/AlertRuleModal';
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
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [editingMonitorId, setEditingMonitorId] = useState<string | null>(null);
  const [alertStates, setAlertStates] = useState<Map<string, {lastNotified: number, isActive: boolean}>>(new Map());

  const { playAlertSound, requestNotificationPermission } = useNotification();

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
      <div className="bento-container">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '32px',
          textAlign: 'center'
        }}>
          <h2 style={{ marginBottom: '12px' }}>No Cards Yet</h2>
          <p style={{ color: 'var(--muted-foreground)', marginBottom: '24px', maxWidth: '400px' }}>
            Add monitors to your Bento grid by clicking the button below.
            You can create monitors in the Monitors tab.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} />
            Add Card
          </button>
        </div>

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
          const alertRule = getAlertRuleForMonitor(monitor.id);
          const hasAlert = !!alertRule;
          const isAlert = alertRule ? isMonitorInAlert(monitor, alertRule) : false;

          return (
            <div
              key={monitor.id}
              className={`bento-item ${isAlert ? 'alert' : ''}`}
              style={{ borderLeft: `4px solid ${monitor.color || '#3b82f6'}` }}
            >
              <div className="bento-header">
                <div className="bento-title-section">
                  <h3>{monitor.name}</h3>
                  {monitor.description && (
                    <p style={{
                      fontSize: '12px',
                      color: 'var(--muted-foreground)',
                      margin: '4px 0 0 0'
                    }}>
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
                      setEditingMonitorId(monitor.id);
                      setShowAlertModal(true);
                    }}
                    title={hasAlert ? `Alert: ${alertRule.level}` : "Set alert"}
                    style={{
                      pointerEvents: 'auto',
                      color: hasAlert ? 'var(--primary)' : undefined,
                      fontWeight: hasAlert ? 'bold' : undefined
                    }}
                  >
                    <Bell size={14} />
                  </button>
                  <button
                    className="threshold-btn"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveCard(monitor.id);
                    }}
                    title="Remove from Bento"
                    style={{ color: 'var(--destructive)', pointerEvents: 'auto' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className={`bento-value ${isAlert ? 'alert' : ''}`} style={{ color: isAlert ? undefined : (monitor.color || '#3b82f6') }}>
                {formatValue(monitor.value ?? null, monitor.unit ?? null, monitor.decimal_places)}
                {monitor.computed_at && (
                  <div className="last-updated" title={new Date(monitor.computed_at).toLocaleString()}>
                    {formatTimeSince(monitor.computed_at)}
                  </div>
                )}
              </div>

              {showChart && (
                <div className="bento-mini-chart">
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '120px',
                    color: 'var(--muted-foreground)',
                    fontSize: '12px'
                  }}>
                    Chart coming soon
                  </div>
                </div>
              )}

              <div className="bento-stats" style={{ opacity: 0.7 }}>
                <div className="bento-stat">
                  <span className="label">Formula</span>
                  <span className="value" style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {monitor.formula}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </GridLayout>

      {/* Floating Action Button for Adding Cards */}
      {!isMobile && (
        <button
          className="fab"
          onClick={() => setShowAddModal(true)}
          title="Add card"
        >
          <Plus size={20} />
        </button>
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

      <AlertRuleModal
        show={showAlertModal}
        rule={editingMonitorId ? getAlertRuleForMonitor(editingMonitorId) ?? null : null}
        monitors={allMonitors}
        onClose={() => {
          setShowAlertModal(false);
          setEditingMonitorId(null);
        }}
        onSave={async (data) => {
          // Add monitor ID to the data if creating new
          const dataWithId = data as any;
          if (!dataWithId.id && editingMonitorId) {
            // Auto-fill name and condition based on selected monitor
            const monitor = allMonitors.find(m => m.id === editingMonitorId);
            if (monitor && !data.name) {
              dataWithId.name = `${monitor.name} Alert`;
            }
            if (monitor && !data.condition) {
              dataWithId.condition = `\${monitor:${editingMonitorId}} > 0`;
            }
          }
          await onSaveAlertRule(dataWithId);
          setShowAlertModal(false);
          setEditingMonitorId(null);
        }}
      />
    </div>
  );
}
