import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Settings, Plus, Pencil, Trash2, Bell } from 'lucide-react';
import GridLayout from 'react-grid-layout';
import ManageMonitorItem from './ManageMonitorItem';
import ConstantCardModal from './ConstantCardModal';
import DexRates from './DexRates';
import MobileLayoutEditor from './MobileLayoutEditor';
import { Loading, EmptyState } from './components/common';
import { LoginForm } from './components/auth';
import { Header, ViewMode } from './components/layout';
import { useAuth, useTheme, useMonitors, useAlerts, useNotification } from './hooks';
import { MonitorSummary, ChartData } from './types';
import { formatValue, formatTimeSince } from './utils/format';
import { ALERT_LEVELS } from './constants/alerts';
import './App.css';
import 'react-grid-layout/css/styles.css';

function App() {
  // Use custom hooks
  const { isAuthenticated, loading: authLoading, login, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { monitors, loading: monitorsLoading, loadMonitors, updateUnit: updateMonitorUnit, updateDecimalPlaces: updateMonitorDecimalPlaces, deleteMonitor } = useMonitors(isAuthenticated);
  const { thresholds, updateThreshold, isValueOutOfRange } = useAlerts();
  const { showDesktopNotification, requestNotificationPermission } = useNotification();

  // Local state
  const [selectedMonitor, setSelectedMonitor] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [days, setDays] = useState(7);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState('');
  const [showManageModal, setShowManageModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'monitors' | 'pushover'>('monitors');
  const [pushoverUserKey, setPushoverUserKey] = useState('');
  const [pushoverApiToken, setPushoverApiToken] = useState('');
  const [hiddenMonitors, setHiddenMonitors] = useState<Set<string>>(new Set());
  const [monitorTags, setMonitorTags] = useState<Map<string, string[]>>(new Map());
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [monitorNames, setMonitorNames] = useState<Map<string, string>>(new Map());
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [gridLayout, setGridLayout] = useState<any[]>([]);
  const [miniChartData, setMiniChartData] = useState<Map<string, any[]>>(new Map());
  const [showThresholdPopover, setShowThresholdPopover] = useState<string | null>(null);
  const [alertStates, setAlertStates] = useState<Map<string, {lastNotified: number, isActive: boolean}>>(new Map());
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [monitorSearchQuery, setMonitorSearchQuery] = useState('');
  const [showConstantModal, setShowConstantModal] = useState(false);
  const [editingConstant, setEditingConstant] = useState<MonitorSummary | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileLayoutEditor, setShowMobileLayoutEditor] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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

  // Load saved data from localStorage
  useEffect(() => {
    const savedHidden = localStorage.getItem('hiddenMonitors');
    if (savedHidden) {
      setHiddenMonitors(new Set(JSON.parse(savedHidden)));
    }
    const savedTags = localStorage.getItem('monitorTags');
    if (savedTags) {
      setMonitorTags(new Map(Object.entries(JSON.parse(savedTags))));
    }
    const savedNames = localStorage.getItem('monitorNames');
    if (savedNames) {
      setMonitorNames(new Map(Object.entries(JSON.parse(savedNames))));
    }
    const savedLayout = localStorage.getItem('gridLayout');
    if (savedLayout) {
      setGridLayout(JSON.parse(savedLayout));
    }
  }, []);

  useEffect(() => {
    if (selectedMonitor) {
      loadChartData(selectedMonitor, days);
    }
  }, [selectedMonitor, days]);

  // Request notification permission on mount (handled by useNotification hook)
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  // Load Pushover config when modal opens
  useEffect(() => {
    if (showManageModal && settingsTab === 'pushover') {
      loadPushoverConfig();
    }
  }, [showManageModal, settingsTab]);

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
              const displayName = monitorNames.get(monitor.monitor_id) || monitor.monitor_name || monitor.monitor_id;
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
  }, [monitors, thresholds, alertStates, isAuthenticated]);

  // Set initial selected monitor when monitors load
  useEffect(() => {
    if (monitors.length > 0 && !selectedMonitor) {
      setSelectedMonitor(monitors[0].monitor_id);
    }
    // Load mini chart data for each monitor
    loadMiniChartData(monitors);
    setIsInitialLoad(false);
  }, [monitors, selectedMonitor]);

  // Downsample data points for performance - keep only every Nth point
  const downsampleData = (data: any[], maxPoints: number = 50): any[] => {
    if (data.length <= maxPoints) return data;
    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, index) => index % step === 0 || index === data.length - 1);
  };


  const loadMiniChartData = async (monitorList: MonitorSummary[]) => {
    const newMiniData = new Map();
    await Promise.all(
      monitorList.map(async (monitor) => {
        try {
          const response = await fetch(`/api/chart-data/${monitor.monitor_id}?days=7`);
          const data = await response.json();
          // Convert timestamp strings to Unix timestamps (milliseconds)
          const chartData = (data.data || []).map((point: any) => ({
            ...point,
            timestamp: new Date(point.timestamp).getTime()
          }));
          // Downsample to max 50 points for mini charts
          const sampledData = downsampleData(chartData, 50);
          newMiniData.set(monitor.monitor_id, sampledData);
        } catch (error) {
          console.error(`Failed to load mini chart for ${monitor.monitor_id}:`, error);
        }
      })
    );
    setMiniChartData(newMiniData);
  };


  const loadChartData = async (monitorId: string, daysParam: number) => {
    try {
      const response = await fetch(`/api/chart-data/${monitorId}?days=${daysParam}`);
      const data = await response.json();
      setChartData(data);
    } catch (error) {
      console.error('Failed to load chart data:', error);
    }
  };


  const handleLogout = () => {
    logout();
    setSelectedMonitor(null);
    setChartData(null);
  };

  const generateDefaultLayout = (monitors: MonitorSummary[]) => {
    return monitors.map((monitor, index) => {
      // Vary card sizes for visual interest
      let w = 1, h = 1;
      if (index % 7 === 0) { w = 2; h = 2; } // large
      else if (index % 5 === 0) { w = 2; h = 1; } // wide

      return {
        i: monitor.monitor_id,
        x: (index * 1) % 4,
        y: Math.floor(index / 4) * 1,
        w: w,
        h: h,
        minW: 1,
        minH: 1,
        maxW: 4,
        maxH: 3
      };
    });
  };

  const getMergedLayout = (monitors: MonitorSummary[], savedLayout: any[]) => {
    // Create set of all current IDs
    const allCurrentIds = new Set<string>();
    monitors.forEach(m => allCurrentIds.add(m.monitor_id));

    // Start with saved layouts that still exist
    const allLayouts: any[] = savedLayout.filter(l => allCurrentIds.has(l.i));

    // Track which items we've already added
    const addedIds = new Set(allLayouts.map(l => l.i));

    // Add new monitors that aren't in saved layout
    monitors.forEach((monitor, index) => {
      if (!addedIds.has(monitor.monitor_id)) {
        const maxY = allLayouts.length > 0 ? Math.max(...allLayouts.map(l => l.y + l.h)) : 0;

        let w = 1, h = 1;
        if (index % 7 === 0) { w = 2; h = 2; }
        else if (index % 5 === 0) { w = 2; h = 1; }

        allLayouts.push({
          i: monitor.monitor_id,
          x: 0,
          y: maxY,
          w: w,
          h: h,
          minW: 1,
          minH: 1,
          maxW: 4,
          maxH: 3
        });
        addedIds.add(monitor.monitor_id);
      }
    });

    return allLayouts;
  };

  const onLayoutChange = (layout: any[]) => {
    // Don't save layout changes on mobile (use dedicated editor instead)
    if (isMobile) return;

    console.log('[Layout] onLayoutChange called, saving layout with', layout.length, 'items');
    console.log('[Layout] New layout constant IDs:', layout.filter(l => l.i.startsWith('const-')).map(l => l.i));
    console.log('[Layout] isInitialLoad:', isInitialLoad);

    // Update state immediately for user interactions
    setGridLayout(layout);

    // Don't save to localStorage during initial load to prevent overwriting saved layout before constants load
    if (isInitialLoad) {
      console.log('[Layout] Skipping localStorage save during initial load');
      return;
    }

    localStorage.setItem('gridLayout', JSON.stringify(layout));
  };

  // Sort items by layout order on mobile
  const getSortedItemsForMobile = (): Array<{ type: 'monitor', data: MonitorSummary }> => {
    if (!isMobile) return visibleMonitors.map(m => ({ type: 'monitor' as const, data: m }));

    // Create a map of layout items by id
    const layoutMap = new Map(gridLayout.map(l => [l.i, l]));

    // Combine monitors with their layout info
    const allItems = visibleMonitors.map(m => ({
      type: 'monitor' as const,
      id: m.monitor_id,
      data: m,
      layout: layoutMap.get(m.monitor_id) || { y: 999, x: 0 }
    }));

    // Sort by y position, then x
    allItems.sort((a, b) => {
      if (a.layout.y !== b.layout.y) return a.layout.y - b.layout.y;
      return a.layout.x - b.layout.x;
    });

    console.log('Mobile sorted items:', allItems.map(item => ({
      id: item.id,
      type: item.type,
      y: item.layout.y
    })));

    // Return mixed array maintaining sort order
    return allItems;
  };

  const toggleHideMonitor = (monitorId: string) => {
    const newHidden = new Set(hiddenMonitors);
    if (newHidden.has(monitorId)) {
      newHidden.delete(monitorId);
    } else {
      newHidden.add(monitorId);
    }
    setHiddenMonitors(newHidden);
    localStorage.setItem('hiddenMonitors', JSON.stringify(Array.from(newHidden)));
  };

  const addTagToMonitor = (monitorId: string, tag: string) => {
    const newTags = new Map(monitorTags);
    const existing = newTags.get(monitorId) || [];
    if (!existing.includes(tag)) {
      newTags.set(monitorId, [...existing, tag]);
      setMonitorTags(newTags);
      localStorage.setItem('monitorTags', JSON.stringify(Object.fromEntries(newTags)));
    }
  };

  const removeTagFromMonitor = (monitorId: string, tag: string) => {
    const newTags = new Map(monitorTags);
    const existing = newTags.get(monitorId) || [];
    newTags.set(monitorId, existing.filter(t => t !== tag));
    setMonitorTags(newTags);
    localStorage.setItem('monitorTags', JSON.stringify(Object.fromEntries(newTags)));
  };

  const updateMonitorName = (monitorId: string, name: string) => {
    const newNames = new Map(monitorNames);
    if (name.trim()) {
      newNames.set(monitorId, name.trim());
    } else {
      newNames.delete(monitorId);
    }
    setMonitorNames(newNames);
    localStorage.setItem('monitorNames', JSON.stringify(Object.fromEntries(newNames)));
  };

  // Constant management functions
  const saveConstant = async (constantData: any) => {
    try {
      if (editingConstant) {
        // Update existing constant
        const response = await fetch(`/api/constant/${editingConstant.monitor_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(constantData)
        });
        if (response.ok) {
          await loadMonitors();
          setShowConstantModal(false);
          setEditingConstant(null);
        } else {
          alert('Failed to update constant');
        }
      } else {
        // Create new constant
        const response = await fetch('/api/constant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(constantData)
        });
        if (response.ok) {
          await loadMonitors();
          setShowConstantModal(false);
        } else {
          alert('Failed to create constant');
        }
      }
    } catch (error) {
      console.error('Failed to save constant:', error);
      alert('Failed to save constant');
    }
  };

  const deleteConstant = async (monitorId: string) => {
    if (!window.confirm('Are you sure you want to delete this constant card?')) return;

    try {
      const response = await fetch(`/api/constant/${monitorId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        await loadMonitors();
      } else {
        alert('Failed to delete constant');
      }
    } catch (error) {
      console.error('Failed to delete constant:', error);
      alert('Failed to delete constant');
    }
  };


  const loadPushoverConfig = async () => {
    try {
      const response = await fetch('/api/pushover/config');
      if (response.ok) {
        const config = await response.json();
        if (config) {
          setPushoverUserKey(config.user_key || '');
          setPushoverApiToken(config.api_token || '');
        }
      }
    } catch (error) {
      console.error('Failed to load Pushover config:', error);
    }
  };

  const savePushoverConfig = async () => {
    try {
      const response = await fetch('/api/pushover/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_key: pushoverUserKey,
          api_token: pushoverApiToken || null
        })
      });

      if (response.ok) {
        alert('Pushover configuration saved!');
      } else {
        alert('Failed to save Pushover configuration');
      }
    } catch (error) {
      console.error('Failed to save Pushover config:', error);
      alert('Error saving Pushover configuration');
    }
  };

  const testPushoverNotification = async () => {
    if (!pushoverUserKey) {
      alert('Please enter your Pushover User Key first');
      return;
    }

    try {
      const response = await fetch('/api/pushover/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_key: pushoverUserKey,
          api_token: pushoverApiToken || null
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Test notification sent! Check your Pushover app.');
      } else {
        const error = await response.json();
        alert(`Failed to send test notification: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
      alert('Error sending test notification');
    }
  };

  const handleDeleteMonitor = async (monitorId: string) => {
    await deleteMonitor(monitorId);
    if (selectedMonitor === monitorId) {
      setSelectedMonitor(null);
    }
  };

  const handleUpdateUnit = async (unit: string) => {
    if (!selectedMonitor) return;
    await updateMonitorUnit(selectedMonitor, unit);
    setShowUnitModal(false);
    setEditingUnit('');
  };

  // Filter monitors
  const allTags = Array.from(new Set(Array.from(monitorTags.values()).flat()));
  const visibleMonitors = monitors.filter(m => {
    const isHidden = hiddenMonitors.has(m.monitor_id);
    const tags = monitorTags.get(m.monitor_id) || [];
    const matchesTag = selectedTag === 'all' || tags.includes(selectedTag);
    return !isHidden && matchesTag;
  });

  // Memoize the computed layout to prevent unnecessary recalculations
  const computedLayout = useMemo(() => {
    const result = gridLayout.length > 0
      ? getMergedLayout(visibleMonitors, gridLayout)
      : generateDefaultLayout(visibleMonitors);

    return result;
  }, [visibleMonitors, gridLayout]);

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
        (() => {
          const sortedItems = getSortedItemsForMobile();
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
            {sortedItems.map((item) => {
              const monitor = item.data;
              const displayName = monitorNames.get(monitor.monitor_id) || monitor.monitor_name || monitor.monitor_id;
              const tags = monitorTags.get(monitor.monitor_id) || [];
              const layout = gridLayout.find(l => l.i === monitor.monitor_id) ||
                            generateDefaultLayout([monitor])[0];
              const showChart = layout.h >= 2;
              const chartPoints = miniChartData.get(monitor.monitor_id) || [];
              const isAlert = isValueOutOfRange(monitor.latest_value, monitor.monitor_id);
              const threshold = thresholds.get(monitor.monitor_id);

              // Render constant card
              if (monitor.monitor_type === 'constant') {
                return (
                  <div key={monitor.monitor_id} className="bento-item" style={{ borderLeft: `4px solid ${monitor.color || '#3b82f6'}` }}>
                    <div className="bento-header">
                      <div className="bento-title-section">
                        <h3>{displayName}</h3>
                        {monitor.description && (
                          <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '4px 0 0 0' }}>
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
                            setEditingConstant(monitor);
                            setShowConstantModal(true);
                          }}
                          title="Edit constant"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="threshold-btn"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteConstant(monitor.monitor_id);
                          }}
                          title="Delete constant"
                          style={{ color: 'var(--destructive)', pointerEvents: 'auto' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="bento-value constant-value" style={{ color: monitor.color || '#3b82f6' }}>
                      {formatValue(monitor.latest_value, monitor.unit, monitor.decimal_places)}
                    </div>

                    <div className="bento-stats" style={{ opacity: 0.5 }}>
                      <div className="bento-stat">
                        <span className="label">Type</span>
                        <span className="value">Constant</span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Render normal monitor card
              return (
                  <div key={monitor.monitor_id} className={`bento-item ${isAlert ? 'alert' : ''}`}>
                  <div className="bento-header">
                    <div className="bento-title-section">
                      <h3>{displayName}</h3>
                      {tags.length > 0 && (
                        <div className="bento-tags">
                          {tags.map(tag => (
                            <span key={tag} className="bento-tag">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className="threshold-btn"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setShowThresholdPopover(showThresholdPopover === monitor.monitor_id ? null : monitor.monitor_id);
                      }}
                      title="Set thresholds"
                    >
                      <Bell size={14} />
                    </button>
                  </div>

                  {showThresholdPopover === monitor.monitor_id && (
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
                          defaultValue={threshold?.upper}
                          id={`upper-${monitor.monitor_id}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const upperInput = document.getElementById(`upper-${monitor.monitor_id}`) as HTMLInputElement;
                              const lowerInput = document.getElementById(`lower-${monitor.monitor_id}`) as HTMLInputElement;
                              const levelSelect = document.getElementById(`level-${monitor.monitor_id}`) as HTMLSelectElement;
                              const upper = upperInput.value ? parseFloat(upperInput.value) : undefined;
                              const lower = lowerInput.value ? parseFloat(lowerInput.value) : undefined;
                              const level = levelSelect.value;
                              updateThreshold(monitor.monitor_id, upper, lower, level);
                              setShowThresholdPopover(null);
                            }
                          }}
                        />
                      </div>
                      <div className="threshold-input-group">
                        <label>Lower Limit</label>
                        <input
                          type="number"
                          placeholder="Leave empty to disable"
                          defaultValue={threshold?.lower}
                          id={`lower-${monitor.monitor_id}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const upperInput = document.getElementById(`upper-${monitor.monitor_id}`) as HTMLInputElement;
                              const lowerInput = document.getElementById(`lower-${monitor.monitor_id}`) as HTMLInputElement;
                              const levelSelect = document.getElementById(`level-${monitor.monitor_id}`) as HTMLSelectElement;
                              const upper = upperInput.value ? parseFloat(upperInput.value) : undefined;
                              const lower = lowerInput.value ? parseFloat(lowerInput.value) : undefined;
                              const level = levelSelect.value;
                              updateThreshold(monitor.monitor_id, upper, lower, level);
                              setShowThresholdPopover(null);
                            }
                          }}
                        />
                      </div>
                      <div className="threshold-input-group">
                        <label>Alert Level</label>
                        <select
                          id={`level-${monitor.monitor_id}`}
                          defaultValue={threshold?.level || 'medium'}
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
                            updateThreshold(monitor.monitor_id, undefined, undefined);
                            setShowThresholdPopover(null);
                          }}
                        >
                          Clear
                        </button>
                        <button
                          className="btn-primary"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            const upperInput = document.getElementById(`upper-${monitor.monitor_id}`) as HTMLInputElement;
                            const lowerInput = document.getElementById(`lower-${monitor.monitor_id}`) as HTMLInputElement;
                            const levelSelect = document.getElementById(`level-${monitor.monitor_id}`) as HTMLSelectElement;
                            const upper = upperInput.value ? parseFloat(upperInput.value) : undefined;
                            const lower = lowerInput.value ? parseFloat(lowerInput.value) : undefined;
                            const level = levelSelect.value;
                            updateThreshold(monitor.monitor_id, upper, lower, level);
                            setShowThresholdPopover(null);
                          }}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}

                  <div className={`bento-value ${isAlert ? 'alert' : ''}`}>
                    {formatValue(monitor.latest_value, monitor.unit, monitor.decimal_places)}
                    <div className="last-updated" title={new Date((monitor.latest_timestamp.endsWith('Z') ? monitor.latest_timestamp : monitor.latest_timestamp + 'Z')).toLocaleString()}>
                      {formatTimeSince(monitor.latest_timestamp)}
                    </div>
                  </div>

                  {showChart && chartPoints.length > 0 && (
                    <div className="bento-mini-chart">
                      <ResponsiveContainer width="100%" height={120}>
                        <LineChart data={chartPoints}>
                          <XAxis
                            dataKey="timestamp"
                            hide={true}
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            scale="time"
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="var(--primary)"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="bento-stats">
                    <div className="bento-stat">
                      <span className="label">Min</span>
                      <span className="value">{formatValue(monitor.min_value, monitor.unit, monitor.decimal_places)}</span>
                    </div>
                    <div className="bento-stat">
                      <span className="label">Avg</span>
                      <span className="value">{formatValue(monitor.avg_value, monitor.unit, monitor.decimal_places)}</span>
                    </div>
                    <div className="bento-stat">
                      <span className="label">Max</span>
                      <span className="value">{formatValue(monitor.max_value, monitor.unit, monitor.decimal_places)}</span>
                    </div>
                  </div>
                  </div>
                );

            })}
          </GridLayout>

          {/* Floating Action Button for Adding Constants */}
          {!isMobile && (
            <button
              className="fab"
              onClick={() => {
                setEditingConstant(null);
                setShowConstantModal(true);
              }}
              title="Add constant card"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
          );
        })()
      ) : viewMode === 'dex' ? (
        <DexRates />
      ) : (
        <div className="dashboard">
          {/* Sidebar */}
          <div className="sidebar">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Monitors ({visibleMonitors.length}/{monitors.length})</h3>
              <button className="manage-btn" onClick={() => setShowManageModal(true)} title="Manage monitors">
                <Settings size={16} />
              </button>
            </div>

            {/* Tag Filter */}
            {allTags.length > 0 && (
              <div className="tag-filter">
                <button
                  className={`tag-filter-btn ${selectedTag === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedTag('all')}
                >
                  All
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    className={`tag-filter-btn ${selectedTag === tag ? 'active' : ''}`}
                    onClick={() => setSelectedTag(tag)}
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
                  onClick={() => setSelectedMonitor(monitor.monitor_id)}
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
                            onClick={() => setDays(d)}
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
      )}

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
        <div className="modal-overlay" onClick={() => setShowManageModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h3>Settings</h3>

            {/* Tab Navigation */}
            <div className="settings-tabs">
              <button
                className={`settings-tab ${settingsTab === 'monitors' ? 'active' : ''}`}
                onClick={() => setSettingsTab('monitors')}
              >
                Monitors
              </button>
              <button
                className={`settings-tab ${settingsTab === 'pushover' ? 'active' : ''}`}
                onClick={() => setSettingsTab('pushover')}
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
                    onChange={(e) => setMonitorSearchQuery(e.target.value)}
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
                        onToggleHide={() => toggleHideMonitor(monitor.monitor_id)}
                        onDelete={() => handleDeleteMonitor(monitor.monitor_id)}
                        onAddTag={(tag) => addTagToMonitor(monitor.monitor_id, tag)}
                        onRemoveTag={(tag) => removeTagFromMonitor(monitor.monitor_id, tag)}
                        onUpdateName={(name: string) => updateMonitorName(monitor.monitor_id, name)}
                        onUpdateDecimalPlaces={(decimalPlaces: number) => updateMonitorDecimalPlaces(monitor.monitor_id, decimalPlaces)}
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
                      onChange={(e) => setPushoverUserKey(e.target.value)}
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
                      onChange={(e) => setPushoverApiToken(e.target.value)}
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
                    <button className="btn-secondary" onClick={testPushoverNotification}>
                      Test Notification
                    </button>
                    <button className="btn-primary" onClick={savePushoverConfig}>
                      Save Configuration
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setShowManageModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Constant Card Modal */}
      <ConstantCardModal
        show={showConstantModal}
        onClose={() => {
          setShowConstantModal(false);
          setEditingConstant(null);
        }}
        onSave={saveConstant}
        editingConstant={editingConstant}
      />

      <MobileLayoutEditor
        show={showMobileLayoutEditor}
        onClose={() => setShowMobileLayoutEditor(false)}
        layout={gridLayout}
        onSave={(newLayout) => {
          setGridLayout(newLayout);
          localStorage.setItem('gridLayout', JSON.stringify(newLayout));
        }}
        monitorNames={monitorNames}
      />
    </div>
  );
}

export default App;