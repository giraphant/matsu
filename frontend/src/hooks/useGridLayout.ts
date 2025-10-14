import { useState, useEffect, useMemo } from 'react';
import { MonitorSummary } from '../types';
import { storage, STORAGE_KEYS } from '../utils/storage';

export function useGridLayout(monitors: MonitorSummary[]) {
  const [gridLayout, setGridLayout] = useState<any[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Load saved layout from localStorage
  useEffect(() => {
    const savedLayout = storage.get<any[]>(STORAGE_KEYS.GRID_LAYOUT, []);
    if (savedLayout && savedLayout.length > 0) {
      setGridLayout(savedLayout);
    }
  }, []);

  // Mark initial load as complete after monitors load
  useEffect(() => {
    if (monitors.length > 0) {
      setIsInitialLoad(false);
    }
  }, [monitors]);

  const generateDefaultLayout = (monitorList: MonitorSummary[]) => {
    return monitorList.map((monitor, index) => {
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

  const getMergedLayout = (monitorList: MonitorSummary[], savedLayout: any[]) => {
    // Create set of all current IDs
    const allCurrentIds = new Set<string>();
    monitorList.forEach(m => allCurrentIds.add(m.monitor_id));

    // Start with saved layouts that still exist
    const allLayouts: any[] = savedLayout.filter(l => allCurrentIds.has(l.i));

    // Track which items we've already added
    const addedIds = new Set(allLayouts.map(l => l.i));

    // Add new monitors that aren't in saved layout
    monitorList.forEach((monitor, index) => {
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

  const onLayoutChange = (layout: any[], isMobile: boolean = false) => {
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

    storage.set(STORAGE_KEYS.GRID_LAYOUT, layout);
  };

  const saveLayout = (layout: any[]) => {
    setGridLayout(layout);
    storage.set(STORAGE_KEYS.GRID_LAYOUT, layout);
  };

  // Memoize the computed layout to prevent unnecessary recalculations
  const computedLayout = useMemo(() => {
    const result = gridLayout.length > 0
      ? getMergedLayout(monitors, gridLayout)
      : generateDefaultLayout(monitors);

    return result;
  }, [monitors, gridLayout]);

  return {
    gridLayout,
    computedLayout,
    onLayoutChange,
    saveLayout,
    generateDefaultLayout
  };
}
