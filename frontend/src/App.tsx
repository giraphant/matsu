import React, { useState, useEffect } from 'react';
import DexRates from './DexRates';
import MobileLayoutEditor from './MobileLayoutEditor';
import ConstantCardModal from './ConstantCardModal';
import { Loading, EmptyState } from './components/common';
import { LoginForm } from './components/auth';
import { Header, ViewMode } from './components/layout';
import { OverviewView, DetailView } from './views';
import {
  useAuth,
  useTheme,
  useMonitors,
  useAlerts,
  useNotification,
  useGridLayout,
  useChartData,
  usePushover,
  useConstants,
  useMonitorMetadata
} from './hooks';
import { ALERT_LEVELS } from './constants/alerts';
import './App.css';
import 'react-grid-layout/css/styles.css';

function App() {
  // Authentication & Theme
  const { isAuthenticated, loading: authLoading, login, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  // Monitors Data
  const {
    monitors,
    loading: monitorsLoading,
    loadMonitors,
    updateUnit: updateMonitorUnit,
    updateDecimalPlaces: updateMonitorDecimalPlaces,
    deleteMonitor,
    updateMonitorOptimistic,
    addMonitorOptimistic
  } = useMonitors(isAuthenticated);

  // Alerts
  const { thresholds, updateThreshold, isValueOutOfRange } = useAlerts();
  const { showDesktopNotification, requestNotificationPermission } = useNotification();

  // Monitor Metadata (tags, names, hidden, filtering)
  const {
    monitorNames,
    monitorTags,
    hiddenMonitors,
    selectedTag,
    setSelectedTag,
    allTags,
    visibleMonitors,
    toggleHideMonitor,
    addTagToMonitor,
    removeTagFromMonitor,
    updateMonitorName,
    getDisplayName
  } = useMonitorMetadata(monitors);

  // Grid Layout
  const { gridLayout, computedLayout, onLayoutChange, saveLayout } = useGridLayout(visibleMonitors);

  // Chart Data
  const {
    selectedMonitor,
    setSelectedMonitor,
    chartData,
    days,
    setDays,
    miniChartData,
    loadMiniChartData,
    clearSelection
  } = useChartData();

  // Pushover Configuration
  const {
    pushoverUserKey,
    setPushoverUserKey,
    pushoverApiToken,
    setPushoverApiToken,
    loadPushoverConfig,
    savePushoverConfig,
    testPushoverNotification
  } = usePushover();

  // Constants Management
  const {
    showConstantModal,
    editingConstant,
    saveConstant,
    deleteConstant,
    openConstantModal,
    closeConstantModal
  } = useConstants(loadMonitors, updateMonitorOptimistic, addMonitorOptimistic);

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [showThresholdPopover, setShowThresholdPopover] = useState<string | null>(null);
  const [alertStates, setAlertStates] = useState<Map<string, {lastNotified: number, isActive: boolean}>>(new Map());
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileLayoutEditor, setShowMobileLayoutEditor] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'monitors' | 'pushover'>('monitors');
  const [monitorSearchQuery, setMonitorSearchQuery] = useState('');

  const loading = authLoading || monitorsLoading;

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  // Load Pushover config when modal opens
  useEffect(() => {
    if (showManageModal && settingsTab === 'pushover') {
      loadPushoverConfig();
    }
  }, [showManageModal, settingsTab, loadPushoverConfig]);

  // Alert checking loop
  useEffect(() => {
    if (!isAuthenticated || monitors.length === 0) return;

    const checkAlerts = () => {
      monitors.forEach(monitor => {
        const config = thresholds.get(monitor.monitor_id);
        if (!config || (!config.upper && !config.lower)) return;

        const isBreached = isValueOutOfRange(monitor.latest_value, monitor.monitor_id);
        const state = alertStates.get(monitor.monitor_id);
        const level = config.level || 'medium';
        const alertConfig = ALERT_LEVELS[level as keyof typeof ALERT_LEVELS] || ALERT_LEVELS.medium;

        if (isBreached && monitor.latest_value !== null) {
          // New alert or time to repeat
          const now = Date.now();
          const shouldNotify = !state?.isActive ||
            (now - state.lastNotified) >= alertConfig.interval * 1000;

          if (shouldNotify) {
            if (('Notification' in window) && Notification.permission === 'granted') {
              const displayName = getDisplayName(monitor.monitor_id, monitor);
              showDesktopNotification(monitor, level as any, monitor.latest_value, config, displayName);
            } else if ('Notification' in window) {
              requestNotificationPermission();
            }

            const newStates = new Map(alertStates);
            newStates.set(monitor.monitor_id, {
              lastNotified: now,
              isActive: true
            });
            setAlertStates(newStates);
          }
        } else if (state?.isActive) {
          // Clear alert state when value returns to normal
          const newStates = new Map(alertStates);
          newStates.set(monitor.monitor_id, {
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
  }, [monitors, thresholds, alertStates, isAuthenticated, isValueOutOfRange, showDesktopNotification, requestNotificationPermission, monitorNames, getDisplayName]);

  // Set initial selected monitor and load mini chart data
  useEffect(() => {
    if (monitors.length > 0 && !selectedMonitor) {
      setSelectedMonitor(monitors[0].monitor_id);
    }
    // Load mini chart data for each monitor
    loadMiniChartData(monitors);
  }, [monitors, selectedMonitor, loadMiniChartData, setSelectedMonitor]);

  const handleLogout = () => {
    logout();
    clearSelection();
  };

  const handleDeleteMonitor = async (monitorId: string) => {
    await deleteMonitor(monitorId);
    if (selectedMonitor === monitorId) {
      clearSelection();
    }
  };

  const handleUpdateUnit = async (unit: string) => {
    if (!selectedMonitor) return;
    await updateMonitorUnit(selectedMonitor, unit);
  };

  const handleThresholdClick = (monitorId: string) => {
    setShowThresholdPopover(showThresholdPopover === monitorId ? null : monitorId);
  };

  const handleThresholdUpdate = async (monitorId: string, upper?: number, lower?: number, level?: string) => {
    await updateThreshold(monitorId, upper, lower, level);
    setShowThresholdPopover(null);
  };

  const currentMonitor = monitors.find(m => m.monitor_id === selectedMonitor);

  if (loading) {
    return <Loading message="Loading monitors..." />;
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={login} />;
  }

  return (
    <div className="App">
      <Header
        viewMode={viewMode}
        isMobile={isMobile}
        isDarkMode={isDarkMode}
        showMobileMenu={showMobileMenu}
        onViewModeChange={setViewMode}
        onToggleDarkMode={toggleTheme}
        onLogout={handleLogout}
        onToggleMobileMenu={() => setShowMobileMenu(!showMobileMenu)}
        onShowMobileLayoutEditor={() => setShowMobileLayoutEditor(true)}
      />

      {monitors.length === 0 ? (
        <EmptyState
          title="No Monitors Yet"
          message="Start sending webhook data to see your monitors here."
          code="POST /webhook/distill"
        />
      ) : viewMode === 'overview' ? (
        <OverviewView
          visibleMonitors={visibleMonitors}
          computedLayout={computedLayout}
          miniChartData={miniChartData}
          monitorNames={monitorNames}
          monitorTags={monitorTags}
          thresholds={thresholds}
          showThresholdPopover={showThresholdPopover}
          isMobile={isMobile}
          isValueOutOfRange={isValueOutOfRange}
          onLayoutChange={(layout) => onLayoutChange(layout, isMobile)}
          onThresholdClick={handleThresholdClick}
          onThresholdUpdate={handleThresholdUpdate}
          onEditConstant={openConstantModal}
          onDeleteConstant={deleteConstant}
          onAddConstant={() => openConstantModal(null)}
          gridLayout={gridLayout}
        />
      ) : viewMode === 'dex' ? (
        <DexRates />
      ) : (
        <DetailView
          monitors={monitors}
          visibleMonitors={visibleMonitors}
          selectedMonitor={selectedMonitor}
          currentMonitor={currentMonitor}
          chartData={chartData}
          days={days}
          monitorNames={monitorNames}
          monitorTags={monitorTags}
          hiddenMonitors={hiddenMonitors}
          allTags={allTags}
          selectedTag={selectedTag}
          showManageModal={showManageModal}
          settingsTab={settingsTab}
          monitorSearchQuery={monitorSearchQuery}
          pushoverUserKey={pushoverUserKey}
          pushoverApiToken={pushoverApiToken}
          onSelectMonitor={setSelectedMonitor}
          onSetDays={setDays}
          onUpdateUnit={handleUpdateUnit}
          onSetSelectedTag={setSelectedTag}
          onShowManageModal={setShowManageModal}
          onSetSettingsTab={setSettingsTab}
          onSetMonitorSearchQuery={setMonitorSearchQuery}
          onToggleHideMonitor={toggleHideMonitor}
          onDeleteMonitor={handleDeleteMonitor}
          onAddTag={addTagToMonitor}
          onRemoveTag={removeTagFromMonitor}
          onUpdateName={updateMonitorName}
          onUpdateDecimalPlaces={updateMonitorDecimalPlaces}
          onSetPushoverUserKey={setPushoverUserKey}
          onSetPushoverApiToken={setPushoverApiToken}
          onSavePushoverConfig={savePushoverConfig}
          onTestPushoverNotification={testPushoverNotification}
        />
      )}

      {/* Constant Card Modal */}
      <ConstantCardModal
        show={showConstantModal}
        onClose={closeConstantModal}
        onSave={saveConstant}
        editingConstant={editingConstant}
      />

      {/* Mobile Layout Editor */}
      <MobileLayoutEditor
        show={showMobileLayoutEditor}
        onClose={() => setShowMobileLayoutEditor(false)}
        layout={gridLayout}
        onSave={saveLayout}
        monitorNames={monitorNames}
      />
    </div>
  );
}

export default App;
