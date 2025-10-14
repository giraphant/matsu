import { useState, useEffect, useMemo } from 'react';
import { MonitorSummary } from '../types';

export function useMonitorMetadata(monitors: MonitorSummary[]) {
  const [hiddenMonitors, setHiddenMonitors] = useState<Set<string>>(new Set());
  const [monitorTags, setMonitorTags] = useState<Map<string, string[]>>(new Map());
  const [monitorNames, setMonitorNames] = useState<Map<string, string>>(new Map());
  const [selectedTag, setSelectedTag] = useState<string>('all');

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
  }, []);

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

  const getDisplayName = (monitorId: string, monitor?: MonitorSummary) => {
    return monitorNames.get(monitorId) || monitor?.monitor_name || monitorId;
  };

  // Get all unique tags
  const allTags = useMemo(() => {
    return Array.from(new Set(Array.from(monitorTags.values()).flat()));
  }, [monitorTags]);

  // Filter visible monitors based on hidden status and selected tag
  const visibleMonitors = useMemo(() => {
    return monitors.filter(m => {
      const isHidden = hiddenMonitors.has(m.monitor_id);
      const tags = monitorTags.get(m.monitor_id) || [];
      const matchesTag = selectedTag === 'all' || tags.includes(selectedTag);
      return !isHidden && matchesTag;
    });
  }, [monitors, hiddenMonitors, monitorTags, selectedTag]);

  return {
    hiddenMonitors,
    monitorTags,
    monitorNames,
    selectedTag,
    setSelectedTag,
    allTags,
    visibleMonitors,
    toggleHideMonitor,
    addTagToMonitor,
    removeTagFromMonitor,
    updateMonitorName,
    getDisplayName
  };
}
