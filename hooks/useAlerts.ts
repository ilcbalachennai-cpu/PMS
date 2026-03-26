
import { useState, useCallback } from 'react';

export type AlertType = 'success' | 'error' | 'info' | 'warning' | 'loading' | 'confirm' | 'danger';

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string | React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export const useAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const showAlert = useCallback((
    type: AlertType,
    title: string,
    message: string | React.ReactNode,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newAlert: Alert = { id, type, title, message, onConfirm, onCancel };
    setAlerts(prev => [...prev, newAlert]);
    
    // Auto-dismiss for non-interactive success/info alerts after 5 seconds
    if (!onConfirm && !onCancel && (type === 'success' || type === 'info')) {
      setTimeout(() => {
        dismissAlert(id);
      }, 5000);
    }
    
    return id;
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  return { alerts, showAlert, dismissAlert };
};
