import { useState, useEffect } from 'react';

export const useUIState = (activeCompanyId: string, employeesCount: number) => {
  const getCKey = (key: string) => activeCompanyId === 'default' ? key : `${activeCompanyId}_${key}`;

  const [settingsTab, setSettingsTab] = useState<'STATUTORY' | 'COMPANY' | 'DATA' | 'DEVELOPER' | 'LICENSE' | 'USERS'>(() => {
    const saved = sessionStorage.getItem('settings_initial_tab');
    if (saved) {
      sessionStorage.removeItem('settings_initial_tab');
      return saved as any;
    }
    return 'COMPANY';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  const [showRegistrationManual, setShowRegistrationManual] = useState(false);
  const [skipSetupRedirect, setSkipSetupRedirect] = useState(false);
  
  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(() => {
    try {
      return localStorage.getItem(getCKey('app_setup_complete')) === 'true' || employeesCount > 0;
    } catch (e) { return false; }
  });

  // Re-check setup status when company or employee count changes
  useEffect(() => {
    setIsSetupComplete(localStorage.getItem(getCKey('app_setup_complete')) === 'true' || employeesCount > 0);
  }, [activeCompanyId, employeesCount]);

  useEffect(() => {
    const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  return {
    settingsTab, setSettingsTab,
    isSidebarOpen, setIsSidebarOpen,
    isFullScreen, setIsFullScreen,
    showLoginMessage, setShowLoginMessage,
    showRegistrationManual, setShowRegistrationManual,
    skipSetupRedirect, setSkipSetupRedirect,
    isSetupComplete, setIsSetupComplete
  };
};

