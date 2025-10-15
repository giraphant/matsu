/**
 * Grid layout hook for Bento cards (Monitor System)
 */

import { useState, useEffect, useMemo } from 'react';
import { NewMonitor } from '../api/newMonitors';

const BENTO_LAYOUT_KEY = 'bento_layout';

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export function useBentoLayout(monitors: NewMonitor[]) {
  const [gridLayout, setGridLayout] = useState<LayoutItem[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Load saved layout from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(BENTO_LAYOUT_KEY);
    if (saved) {
      try {
        setGridLayout(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse bento layout:', e);
      }
    }
  }, []);

  // Mark initial load as complete after monitors load
  useEffect(() => {
    if (monitors.length > 0) {
      setIsInitialLoad(false);
    }
  }, [monitors]);

  const generateDefaultLayout = (monitorList: NewMonitor[]): LayoutItem[] => {
    return monitorList.map((monitor, index) => {
      // Vary card sizes for visual interest
      let w = 1, h = 1;
      if (index % 7 === 0) { w = 2; h = 2; } // large
      else if (index % 5 === 0) { w = 2; h = 1; } // wide

      return {
        i: monitor.id,
        x: (index * 1) % 4,
        y: Math.floor(index / 4) * 1,
        w,
        h,
        minW: 1,
        minH: 1,
        maxW: 4,
        maxH: 3
      };
    });
  };

  const getMergedLayout = (monitorList: NewMonitor[], savedLayout: LayoutItem[]): LayoutItem[] => {
    // Create set of all current IDs
    const allCurrentIds = new Set(monitorList.map(m => m.id));

    // Start with saved layouts that still exist
    const allLayouts: LayoutItem[] = savedLayout.filter(l => allCurrentIds.has(l.i));

    // Track which items we've already added
    const addedIds = new Set(allLayouts.map(l => l.i));

    // Add new monitors that aren't in saved layout
    monitorList.forEach((monitor, index) => {
      if (!addedIds.has(monitor.id)) {
        const maxY = allLayouts.length > 0 ? Math.max(...allLayouts.map(l => l.y + l.h)) : 0;

        let w = 1, h = 1;
        if (index % 7 === 0) { w = 2; h = 2; }
        else if (index % 5 === 0) { w = 2; h = 1; }

        allLayouts.push({
          i: monitor.id,
          x: 0,
          y: maxY,
          w,
          h,
          minW: 1,
          minH: 1,
          maxW: 4,
          maxH: 3
        });
        addedIds.add(monitor.id);
      }
    });

    return allLayouts;
  };

  const onLayoutChange = (layout: LayoutItem[], isMobile: boolean = false) => {
    // Don't save layout changes on mobile
    if (isMobile) return;

    // Update state immediately
    setGridLayout(layout);

    // Don't save to localStorage during initial load
    if (isInitialLoad) {
      return;
    }

    localStorage.setItem(BENTO_LAYOUT_KEY, JSON.stringify(layout));
  };

  const saveLayout = (layout: LayoutItem[]) => {
    setGridLayout(layout);
    localStorage.setItem(BENTO_LAYOUT_KEY, JSON.stringify(layout));
  };

  // Memoize the computed layout
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
