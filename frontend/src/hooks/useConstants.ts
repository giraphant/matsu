import { useState } from 'react';
import { MonitorSummary } from '../types';

export function useConstants(loadMonitors: () => Promise<void>) {
  const [showConstantModal, setShowConstantModal] = useState(false);
  const [editingConstant, setEditingConstant] = useState<MonitorSummary | null>(null);

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
