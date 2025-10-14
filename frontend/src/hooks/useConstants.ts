import { useState } from 'react';
import { MonitorSummary } from '../types';

export function useConstants(
  loadMonitors: () => Promise<void>,
  updateMonitorOptimistic: (monitorId: string, updates: Partial<MonitorSummary>) => void,
  addMonitorOptimistic: (newMonitor: MonitorSummary) => void
) {
  const [showConstantModal, setShowConstantModal] = useState(false);
  const [editingConstant, setEditingConstant] = useState<MonitorSummary | null>(null);

  const saveConstant = async (constantData: any) => {
    try {
      if (editingConstant) {
        // Update existing constant

        // Optimistic update - update UI immediately
        updateMonitorOptimistic(editingConstant.monitor_id, {
          monitor_name: constantData.name,
          latest_value: constantData.value,
          unit: constantData.unit,
          description: constantData.description,
          color: constantData.color
        });

        // Close modal immediately for better UX
        setShowConstantModal(false);
        setEditingConstant(null);

        // Send update to server in background
        const response = await fetch(`/api/constant/${editingConstant.monitor_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(constantData)
        });

        if (!response.ok) {
          // If server update fails, reload to get correct state
          alert('Failed to update constant');
          loadMonitors();
        }
      } else {
        // Create new constant
        const response = await fetch('/api/constant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(constantData)
        });

        if (response.ok) {
          const createdConstant = await response.json();

          // Optimistic add - add to UI immediately
          addMonitorOptimistic({
            monitor_id: createdConstant.id || `constant-${Date.now()}`,
            monitor_name: constantData.name,
            monitor_type: 'constant',
            latest_value: constantData.value,
            unit: constantData.unit,
            description: constantData.description,
            color: constantData.color,
            total_records: 1,
            latest_timestamp: new Date().toISOString(),
            url: '',
            decimal_places: 2,
            min_value: constantData.value,
            max_value: constantData.value,
            avg_value: constantData.value,
            change_count: 0
          });

          // Close modal immediately
          setShowConstantModal(false);

          // Reload in background to get server-generated ID
          loadMonitors();
        } else {
          alert('Failed to create constant');
        }
      }
    } catch (error) {
      console.error('Failed to save constant:', error);
      alert('Failed to save constant');
      // Reload to sync with server state
      loadMonitors();
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

  const openConstantModal = (constant: MonitorSummary | null = null) => {
    setEditingConstant(constant);
    setShowConstantModal(true);
  };

  const closeConstantModal = () => {
    setShowConstantModal(false);
    setEditingConstant(null);
  };

  return {
    showConstantModal,
    editingConstant,
    saveConstant,
    deleteConstant,
    openConstantModal,
    closeConstantModal
  };
}
