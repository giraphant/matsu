/**
 * Hook for managing Bento cards (monitors displayed on Overview page)
 * Users can freely select which monitors to display
 * Alert configuration is separate but integrated
 */

import { useState, useEffect, useCallback } from 'react';
import { newMonitorApi, alertRuleApi } from '../api/newMonitors';
import { NewMonitor, AlertRule } from '../api/newMonitors';

const BENTO_CARDS_KEY = 'bento_cards';

export function useBentoCards() {
  const [allMonitors, setAllMonitors] = useState<NewMonitor[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load selected card IDs from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(BENTO_CARDS_KEY);
    if (stored) {
      try {
        setSelectedCardIds(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse bento cards:', e);
      }
    }
  }, []);

  // Load all monitors and alert rules
  const loadData = useCallback(async () => {
    try {
      const [monitors, rules] = await Promise.all([
        newMonitorApi.getAll(),
        alertRuleApi.getAll()
      ]);
      setAllMonitors(monitors);
      setAlertRules(rules);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Get monitors that are selected for display
  const displayedCards = allMonitors.filter(m => selectedCardIds.includes(m.id));

  // Add a card to the display
  const addCard = useCallback((monitorId: string) => {
    setSelectedCardIds(prev => {
      if (prev.includes(monitorId)) return prev;
      const updated = [...prev, monitorId];
      localStorage.setItem(BENTO_CARDS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Remove a card from the display
  const removeCard = useCallback((monitorId: string) => {
    setSelectedCardIds(prev => {
      const updated = prev.filter(id => id !== monitorId);
      localStorage.setItem(BENTO_CARDS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Toggle card selection
  const toggleCard = useCallback((monitorId: string) => {
    if (selectedCardIds.includes(monitorId)) {
      removeCard(monitorId);
    } else {
      addCard(monitorId);
    }
  }, [selectedCardIds, addCard, removeCard]);

  // Get available monitors (not yet added to bento)
  const availableMonitors = allMonitors.filter(m => !selectedCardIds.includes(m.id));

  // Get alert rule for a specific monitor
  const getAlertRuleForMonitor = useCallback((monitorId: string) => {
    // Alert rules can have conditions like: ${monitor:xxx} > 100
    // We need to find rules that reference this monitor
    return alertRules.find(rule =>
      rule.condition.includes(`monitor:${monitorId}`)
    );
  }, [alertRules]);

  return {
    allMonitors,
    displayedCards,
    availableMonitors,
    alertRules,
    selectedCardIds,
    loading,
    addCard,
    removeCard,
    toggleCard,
    getAlertRuleForMonitor,
    refreshData: loadData
  };
}
