
import { useState, useCallback } from 'react';
import { ModalType } from '../components/Shared/CustomModal';

export interface AlertConfig {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message: string | React.ReactNode;
  onConfirm?: () => void;
  onSecondaryConfirm?: () => void;
  confirmLabel?: string;
  secondaryConfirmLabel?: string;
  cancelLabel?: string;
  autoCloseSecs?: number;
}

export const useAlerts = () => {
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  const showAlert = useCallback((
    type: ModalType,
    title: string,
    message: string | React.ReactNode,
    onConfirm?: () => void,
    onSecondaryConfirm?: () => void,
    confirmLabel?: string,
    secondaryConfirmLabel?: string,
    cancelLabel?: string,
    autoCloseSecs?: number
  ) => {
    setAlertConfig({
      isOpen: true,
      type,
      title,
      message,
      onConfirm,
      onSecondaryConfirm,
      confirmLabel,
      secondaryConfirmLabel,
      cancelLabel,
      autoCloseSecs
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertConfig(prev => ({ ...prev, isOpen: false }));
  }, []);

  return { alertConfig, setAlertConfig, showAlert, closeAlert };
};
