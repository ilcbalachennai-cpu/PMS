
import { useState, useEffect } from 'react';
import { View } from '../types';

export const useUIState = (employeesCount: number) => {
  const [activeView, setActiveView] = useState<View>(View.Dashboard);
  const [settingsTab, setSettingsTab] = useState<'STATUTORY' | 'COMPANY' | 'DATA' | 'DEVELOPER' | 'LICENSE' | 'USERS'>('STATUTORY');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  const [showRegistrationManual, setShowRegistrationManual] = useState(false);
  const [skipSetupRedirect, setSkipSetupRedirect] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(() => {
    try {
      return localStorage.getItem('app_setup_complete') === 'true' || employeesCount > 0;
    } catch (e) { return false; }
  });

  useEffect(() => {
    if (employeesCount === 0 && activeView !== View.Settings && !skipSetupRedirect && isSetupComplete) {
      setActiveView(View.Settings);
      setSettingsTab('DATA');
    }
  }, [employeesCount, activeView, skipSetupRedirect, isSetupComplete]);

  useEffect(() => {
    const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  return {
    activeView, setActiveView,
    settingsTab, setSettingsTab,
    isSidebarOpen, setIsSidebarOpen,
    isFullScreen, setIsFullScreen,
    showLoginMessage, setShowLoginMessage,
    showRegistrationManual, setShowRegistrationManual,
    skipSetupRedirect, setSkipSetupRedirect,
    isSetupComplete, setIsSetupComplete
  };
};
