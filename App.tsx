import { useState, useEffect, useRef, FC } from 'react';
import {
  LayoutDashboard, Users, Calculator, FileText, Settings as SettingsIcon,
  LogOut, Bot, ShieldCheck,
  Loader2, Lock, Wrench,
  CalendarClock, IndianRupee, Megaphone, Maximize, Minimize,
  ArrowRight, RefreshCw, Database,
  ChevronLeft, ChevronRight, X,
  ShieldAlert, CalendarX, WifiOff, Wifi, Scale, Building2, Plus, Trash2
} from 'lucide-react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import EmployeeList from './components/EmployeeList';
import PayProcess from './components/PayProcess';
import Reports from './components/Reports';
import StatutoryReports from './components/StatutoryReports';
import Utilities from './components/Utilities';
import Settings from './components/Settings';
import AIAssistant from './components/AIAssistant';
import PFCalculator from './components/PFCalculator';
import MISDashboard from './components/MIS/MISDashboard';
import Registration from './components/Registration';
import AppSetup from './components/AppSetup';
import CustomModal from './components/Shared/CustomModal';
import UpdatePortal from './components/Shared/UpdatePortal';
import TrialNoticeModal from './components/Shared/TrialNoticeModal';
import SocialSecurityCode from './components/SocialSecurityCode';
import { signalApplicationReady } from './components/Shared/GlobalRescueUI';

import { getStoredLicense, APP_VERSION, trackHeartbeat, getMachineId, checkOnlineStatus, checkSyncRequirement, getOfflineActiveDaysCount, clearSyncRetryCount } from './services/licenseService';
import { parseExpiryDate, formatExpiryDate } from './utils/formatters';
import { View, User, Employee, PayrollResult, CompanyProfile, StatutoryConfig } from './types';
import { BRAND_CONFIG } from './constants';

// --- CUSTOM HOOKS ---
import { useAlerts } from './hooks/useAlerts';
import { usePayrollPeriod } from './hooks/usePayrollPeriod';
import { useLicense } from './hooks/useLicense';
import { useAppUpdate } from './hooks/useAppUpdate';
import { usePayrollData } from './hooks/usePayrollData';
import { useAppInitialization } from './hooks/useAppInitialization';
import { useUIState } from './hooks/useUIState';
import { useAuth } from './hooks/useAuth';
import { useSync } from './hooks/useSync';
import { useNavigation } from './hooks/useNavigation';

const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Global OS Detection for UI refinement
const isWin7 = /Windows NT 6.1/.test(window.navigator.userAgent);

const NavigationItem = ({ view, icon: Icon, label, activeView, onNavigate, isSidebarOpen, depth = 0, disabled = false }: { view: View, icon: any, label: string, activeView: View, onNavigate: (v: View) => void, isSidebarOpen: boolean, depth?: number, disabled?: boolean }) => (
  <button
    onClick={() => !disabled && onNavigate(view)}
    title={`Navigate to ${label}`}
    aria-label={`Navigate to ${label}`}
    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all relative group ${disabled ? 'opacity-40 cursor-not-allowed grayscale' : ''} ${activeView === view
      ? (isWin7
        ? 'bg-blue-600/60 text-white shadow-[0_0_15px_rgba(37,99,235,0.25)] ring-1 ring-blue-400'
        : 'bg-blue-600 text-white shadow-lg')
      : 'text-slate-300 hover:bg-blue-900/40 hover:text-white'
      } ${depth > 0 ? 'ml-2 border-l border-slate-700 pl-4 w-[95%]' : ''}`}
  >
    {activeView === view && isWin7 && (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-lg shadow-[0_0_10px_#3b82f6]"></div>
    )}
    <Icon size={depth > 0 ? 16 : 18} className={`shrink-0 ${depth > 0 ? "opacity-80" : ""} ${activeView === view && isWin7 ? "text-blue-400" : ""}`} />
    {isSidebarOpen && <span className={`text-left whitespace-nowrap tracking-tight ${depth > 0 ? 'text-[13px]' : 'text-sm'} ${activeView === view ? 'font-black text-white' : 'font-semibold'}`}>{label}</span>}
  </button>
);

const SyncCountdownBanner: FC<{ initialMs: number; onExpiry: () => void }> = ({ initialMs, onExpiry }) => {
  const [remaining, setRemaining] = useState(initialMs);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1000) {
          clearInterval(timer);
          onExpiry();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onExpiry]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const isUrgent = remaining < 180000; // 3 minutes

  return (
    <div className={`fixed top-0 left-0 right-0 z-[1000] px-6 py-2 flex items-center justify-between border-b shadow-2xl transition-all ${
      isUrgent ? 'bg-rose-600 border-rose-400 animate-pulse' : 'bg-amber-600 border-amber-400'
    }`}>
      <div className="flex items-center gap-3">
        <WifiOff size={18} className="text-white animate-bounce" />
        <div className="flex flex-col">
          <span className="text-[11px] font-black uppercase tracking-widest text-white">Identity Verification Required</span>
          <span className="text-[9px] font-bold text-white/80 uppercase">Please connect to internet to synchronize license status</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-bold text-white/70 uppercase">Access Suspends In</span>
          <span className="text-xl font-black text-white tabular-nums tracking-tighter">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>
        <div className="h-8 w-px bg-white/20"></div>
        <div className="p-1.5 bg-white/10 rounded-lg">
          <CalendarClock size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
};

const PayrollShell: FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const mainContentRef = useRef<HTMLElement>(null);

  // --- Initialize Hooks ---
  const { alertConfig, showAlert, closeAlert } = useAlerts();
  const { globalMonth, setGlobalMonth, globalYear, setGlobalYear, latestFrozenPeriod } = usePayrollPeriod();
  const { currentUser, handleLogin, logout, setCurrentUser } = useAuth();
  const { 
    latestAppVersion, setLatestAppVersion, 
    latestPatchTimestamp, setLatestPatchTimestamp,
    setDownloadUrl,
    showUpdateNotice, setShowUpdateNotice,
    showBackgroundNotice, setShowBackgroundNotice,
    isUpdateDownloading,
    isUpdatePreparing,
    updateDownloaded,
    updateError, setUpdateError,
    downloadProgress,
    isPatchNotice, isPatchMandatory, isSessionDismissed, patchSkipCount,
    deploymentStep,
    handleUpdateNow, handleUpdateLater 
  } = useAppUpdate(showAlert, currentUser?.role === 'Developer');

  const [isInstalling, setIsInstalling] = useState(false);
  const [isAddingNewCompany, setIsAddingNewCompany] = useState(false);
  const {
    employees, setEmployees, config, setConfig, companyProfile, setCompanyProfile,
    leavePolicy, setLeavePolicy, attendances, setAttendances, leaveLedgers, setLeaveLedgers,
    advanceLedgers, setAdvanceLedgers, payrollHistory, setPayrollHistory, fines, setFines,
    arrearHistory, setArrearHistory, otRecords, setOTRecords, designations, setDesignations, divisions, setDivisions,
    branches, setBranches, sites, setSites, logoUrl, setLogoUrl,
    safeSave, handleRollover, handleNuclearReset,
    companies, activeCompanyId, switchCompany, addCompany, deleteCompany
  } = usePayrollData(showAlert);

  const { licenseStatus, licenseInfo, dataSizeLimit, verifyLicense, checkNewMessages } = useLicense();
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const { isAppDirectoryConfigured, setIsAppDirectoryConfigured } = useAppInitialization(verifyLicense);
  const { activeView, setActiveView } = useNavigation(mainContentRef, currentUser);

  const handleSystemRepair = () => {
    setUpdateError('SECURITY_VIOLATION');
  };

  const {
    settingsTab, setSettingsTab, isSidebarOpen, setIsSidebarOpen,
    showLoginMessage, setShowLoginMessage,
    showRegistrationManual, setShowRegistrationManual, setSkipSetupRedirect,
    isSetupComplete, setIsSetupComplete
  } = useUIState(employees.length, activeView, setActiveView);

  const [isCompanyGateOpen, setIsCompanyGateOpen] = useState(true);
  const [isPurgeMode, setIsPurgeMode] = useState(false);
  const [showPurgeAuthModal, setShowPurgeAuthModal] = useState(false);
  const [purgeTargetId, setPurgeTargetId] = useState<string | null>(null);
  const [purgePassword, setPurgePassword] = useState('');
  const [purgeAuthError, setPurgeAuthError] = useState('');

  const [showFlashPopup, setShowFlashPopup] = useState(false);
  const [isSettingsDirty, setIsSettingsDirty] = useState(false);
  const [isRestorationForced, setIsRestorationForced] = useState(false);
  const [isStartupTimerActive, setIsStartupTimerActive] = useState(true);

  // --- V02.02.41: ID Format Migration (Add Underscore to 12-char IDs) ---
  useEffect(() => {
    const companiesRaw = localStorage.getItem('app_companies');
    if (!companiesRaw) return;
    
    try {
      const companiesList = JSON.parse(companiesRaw);
      let globalChanged = false;
      
      const migratedCompanies = companiesList.map((c: any) => {
        // Pattern: 12 alphanumeric characters, no underscore
        // Specifically targeting the 6 alpha + 6 numeric pattern
        if (c.id && c.id.length === 12 && !c.id.includes('_')) {
          const oldId = c.id;
          const newId = `${oldId.substring(0, 6)}_${oldId.substring(6)}`;
          
          console.log(`Migrating company ID: ${oldId} -> ${newId}`);
          
          // 1. Collect all associated localStorage keys
          const keysToRename: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(`${oldId}_`)) {
              keysToRename.push(k);
            }
          }
          
          // 2. Perform renaming
          keysToRename.forEach(k => {
            const data = localStorage.getItem(k);
            if (data !== null) {
              const newKey = k.replace(`${oldId}_`, `${newId}_`);
              localStorage.setItem(newKey, data);
              localStorage.removeItem(k);
            }
          });
          
          // 3. Update Active ID if matched
          if (localStorage.getItem('app_active_company_id') === oldId) {
            localStorage.setItem('app_active_company_id', newId);
          }
          
          c.id = newId;
          globalChanged = true;
        }
        return c;
      });
      
      if (globalChanged) {
        localStorage.setItem('app_companies', JSON.stringify(migratedCompanies));
        window.location.reload(); // Hard reload to re-initialize all hooks with new IDs
      }
    } catch (e) {
      console.error('Migration failed:', e);
    }
  }, []);

  // --- V02.02.28: 5-Second Startup Branding Timer (Synchronized with Animation) ---
  useEffect(() => {
    const timer = setTimeout(() => setIsStartupTimerActive(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // --- CONNECTIVITY MONITORING (Day 1/2/3 Logic) ---
  const [connStatus, setConnStatus] = useState<{
    isOnline: boolean;
    offlineDay: number;
    graceRemaining: number | null;
  }>({
    isOnline: navigator.onLine,
    offlineDay: 0,
    graceRemaining: null
  });

  useEffect(() => {
    // Check Status Frequently
    const monitorConnectivity = async () => {
      // 1. Check Hardware/Nav Status
      const { isOnline } = await checkOnlineStatus();
      
      // 2. Check Policy/Grace
      const syncInfo = checkSyncRequirement();
      const offlineDays = getOfflineActiveDaysCount();

      setConnStatus({
        isOnline,
        offlineDay: offlineDays,
        graceRemaining: syncInfo.isSyncGracePeriod ? syncInfo.graceRemaining || null : null
      });

      // If blocked, trigger license verification to show the block screen
      if (syncInfo.blocked && !isOnline) {
         verifyLicense();
      }
    };

    // Initial check
    monitorConnectivity();

    // Polling: Slow when online (30s), Fast when offline (5s)
    const interval = setInterval(monitorConnectivity, connStatus.isOnline ? 30000 : 5000);
    
    // Also listen to window events
    const handleOnline = () => monitorConnectivity();
    const handleOffline = () => monitorConnectivity();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connStatus.isOnline, verifyLicense]);

  const safeNavigate = (view: View, tab?: string) => {
    if (activeView === View.Settings && isSettingsDirty && view !== View.Settings) {
      showAlert(
        'confirm',
        'Unsaved Configuration',
        'You have unsaved changes in the configuration section. Would you like to stay and save them, or discard and leave?',
        () => { /* Stay - Do nothing */ },
        () => {
          setIsSettingsDirty(false);
          setActiveView(view);
          if (tab) setSettingsTab(tab as any);
        },
        'Stay & Save',
        'Discard & Leave'
      );
      return;
    }
    setActiveView(view);
    if (tab) setSettingsTab(tab as any);
  };

  const handleRetryVerification = async () => {
    if (isRetryingSync) return;
    setIsRetryingSync(true);
    try {
      await verifyLicense(true);
    } finally {
      setIsRetryingSync(false);
    }
  };


  // Trial Notice State
  const [showTrialNotice, setShowTrialNotice] = useState(false);
  const [trialInfo, setTrialInfo] = useState<{ daysRemaining: number; expiryDate: string } | null>(null);

  // --- V02.02.24: UNIVERSAL LEGAL ALERT ---
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [hasAgreedLegal, setHasAgreedLegal] = useState(() => {
    const lastAgreedDate = localStorage.getItem('app_legal_agreed_date');
    const today = new Date().toISOString().split('T')[0];
    return lastAgreedDate === today;
  });

  const handleAcceptLegal = () => {
    const today = new Date().toISOString().split('T')[0];
    setHasAgreedLegal(true);
    setShowLegalModal(false);
    localStorage.setItem('app_legal_agreed_date', today);
    showAlert('success', 'Compliance Acknowledged', 'Legal terms accepted for today.');
  };

  const handleDisagreeLegal = () => {
    const api = (window as any).electronAPI;
    if (api) {
      if (api.closeApp) api.closeApp();
      else if (api.invoke) api.invoke('close-app');
    } else {
      window.close();
    }
  };

  useEffect(() => {
    // V02.02.24: Legal notice now appears POST-LOGIN for better reliability
    if (currentUser && companyProfile?.loginAlertEnabled && companyProfile.loginAlertMessage && !hasAgreedLegal) {
      const timer = setTimeout(() => setShowLegalModal(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [currentUser, companyProfile?.loginAlertEnabled, companyProfile?.loginAlertMessage, hasAgreedLegal]);

  // Persistence & Sync Hook
  useSync({
    employees, config, companyProfile, attendances, leaveLedgers, advanceLedgers,
    payrollHistory, fines, leavePolicy, arrearHistory, otRecords, logoUrl,
    designations, divisions, branches, sites, isSetupComplete, safeSave,
    activeCompanyId
  });

  // --- Specialized Effects ---

  const sessionStartRef = useRef(new Date().toISOString());

  // --- V02.02.08: MASTER DATABASE REPAIR & PROACTIVE RECOVERY ---
  // Ensure 'admin' is permanently linked to Registered ID (e.g., SAIPRA12)
  useEffect(() => {
    const license = getStoredLicense();
    if (license && license.userID && license.userID.toUpperCase() !== 'RESCUE' && license.userID.toUpperCase() !== 'TRIAL') {
      const usersRaw = localStorage.getItem('app_users');
      let users: User[] = [];
      try {
        if (usersRaw) users = JSON.parse(usersRaw);
      } catch (e) { }

      const adminIndex = users.findIndex((u: any) => u.role === 'Administrator');

      if (adminIndex === -1) {
        // PROACTIVE RECOVERY: No admin found but license is active.
        // Create a default admin using license identity to restore login access.
        console.log(`🛡️ Repair: Proactively restoring admin identity for ${license.userID}`);
        const recoveredAdmin: User = {
          username: license.userID,
          password: '', // Password will be handled by cloud sync or reset flow
          name: license.userName || 'System Administrator',
          role: 'Administrator',
          email: license.registeredTo || ''
        };
        users.push(recoveredAdmin);
        localStorage.setItem('app_users', JSON.stringify(users));
        if (window.electronAPI) window.electronAPI.dbSet('app_users', users);
      } else if (users[adminIndex].username !== license.userID) {
        console.log(`🛡️ Repair: Synchronizing internal admin -> ${license.userID}`);
        users[adminIndex].username = license.userID;
        localStorage.setItem('app_users', JSON.stringify(users));
        if (window.electronAPI) window.electronAPI.dbSet('app_users', users);
      }
    }
  }, []);

  useEffect(() => {
    // Signal success to GlobalRescueUI (Watchdog) - Always signal once mounting is stable
    signalApplicationReady();

    const syncMessages = async () => {
      try {
        const updates = await checkNewMessages();
        if (updates) {
          // Sync news/statutory
          setCompanyProfile(prev => ({
            ...prev,
            flashNews: updates.scrollNews || prev.flashNews,
            postLoginMessage: updates.statutory || prev.postLoginMessage,
            postLoginHeader: updates.header || prev.postLoginHeader,
            postLoginAlignment: updates.alignment || prev.postLoginAlignment,
            flashPopupMessage: updates.flashPopupMessage || prev.flashPopupMessage,
            flashPopupHeader: updates.flashPopupHeader || prev.flashPopupHeader,
            flashPopupId: updates.flashPopupId || prev.flashPopupId,
            loginAlertEnabled: updates.loginAlertEnabled !== undefined ? updates.loginAlertEnabled : prev.loginAlertEnabled,
            loginAlertMessage: updates.loginAlertMessage || prev.loginAlertMessage
          }));

          // --- Refresh Global Update State ---
          if (updates.latestVersion) setLatestAppVersion(updates.latestVersion);
          if (updates.downloadUrl) setDownloadUrl(updates.downloadUrl);
          
          if (updates.patchTimestamp && updates.patchTimestamp !== latestPatchTimestamp) {
            setLatestPatchTimestamp(updates.patchTimestamp);
          }
        }
      } catch (err) {
        console.error("Background message sync failed:", err);
      }
    };

    // Initial check
    syncMessages();

    // Periodic check every 10 minutes
    const interval = setInterval(syncMessages, 600000);
    return () => clearInterval(interval);
  }, [checkNewMessages, setCompanyProfile]);

  // --- NEW: Immediate Version Sync on Boot ---
  useEffect(() => {
    if (licenseStatus.valid && licenseStatus.data) {
      if (licenseStatus.data.latestVersion) setLatestAppVersion(licenseStatus.data.latestVersion);
      if (licenseStatus.data.downloadUrl) setDownloadUrl(licenseStatus.data.downloadUrl);
    }
  }, [licenseStatus.valid, licenseStatus.data, setLatestAppVersion, setDownloadUrl]);


  useEffect(() => {
    const lastSessionMsgId = sessionStorage.getItem('app_session_last_msg_id');
    const currentMsgId = localStorage.getItem('app_last_statutory_date') || companyProfile.postLoginMessage;

    // REGULAR messages only show at login if ID has changed from last session/locally
    if (currentUser && companyProfile.postLoginMessage?.trim() !== '' && lastSessionMsgId !== currentMsgId) {
      setShowLoginMessage(true);
      if (currentMsgId) sessionStorage.setItem('app_session_last_msg_id', currentMsgId);
    }
  }, [currentUser, companyProfile.postLoginMessage]);

  // Auto Logout Timer
  useEffect(() => {
    if (!currentUser) return; // Only track when logged in

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      // 10 minutes = 600000 ms
      timeoutId = setTimeout(async () => {
        sessionStorage.setItem('logout_reason', 'timeout');
        // Report auto-logout to cloud to clear "LIVE" status
        if (currentUser && currentUser.role !== 'Developer') {
          try {
            const mid = await getMachineId();
            await trackHeartbeat(currentUser.email || "", mid, currentUser.username, sessionStartRef.current, "LOGGED OUT");
          } catch (e) { console.warn("Auto-logout heartbeat failed", e); }
        }
        logout();
      }, 600000);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer));

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [currentUser, logout]);

  // Heartbeat Tracker (LIVE Status in Google Sheets)
  useEffect(() => {
    if (!currentUser || !licenseStatus.valid || currentUser.role === 'Developer') return;

    const startHeartbeat = async () => {
      const mid = await getMachineId();
      trackHeartbeat(currentUser.email || "", mid, currentUser.username, sessionStartRef.current, "LIVE");
    };

    // Initial ping
    startHeartbeat();

    // Pulse every 5 minutes
    const heartbeatInterval = setInterval(startHeartbeat, 300000);

    return () => clearInterval(heartbeatInterval);
  }, [currentUser, licenseStatus.valid]);

  // --- HANDLERS INTEGRATION ---

  const handleUpdateLogo = (url: string) => { setLogoUrl(url); safeSave('app_logo', url); };

  const handleAddEmployee = (newEmp: Employee) => {
    if (employees.length >= dataSizeLimit) {
      showAlert('warning', 'Employee Limit Reached', `Your current license/trial is limited to ${dataSizeLimit} employees. Please upgrade your license to add more.`);
      return;
    }

    // DOJ-Aware Leave Initialization
    const dojDate = new Date(newEmp.doj);
    dojDate.setHours(0, 0, 0, 0);
    const periodEnd = new Date(globalYear, monthsArr.indexOf(globalMonth) + 1, 0);
    periodEnd.setHours(23, 59, 59, 999);

    const isFutureJoiner = dojDate > periodEnd;

    const elCredit = isFutureJoiner ? 0 : (leavePolicy?.el?.maxPerYear || 18) / 12;
    const slCredit = isFutureJoiner ? 0 : (leavePolicy?.sl?.maxPerYear || 12) / 12;
    const clCredit = isFutureJoiner ? 0 : (leavePolicy?.cl?.maxPerYear || 12) / 12;

    // Newly Joining Logic: If DOJ is within the current processing month/year, Opening Balances must be 0
    const isNewlyJoining = dojDate.getMonth() === monthsArr.indexOf(globalMonth) && dojDate.getFullYear() === globalYear;
    
    const initialEL = isNewlyJoining ? 0 : (newEmp.initialOpeningBalances?.el || 0);
    const initialSL = isNewlyJoining ? 0 : (newEmp.initialOpeningBalances?.sl || 0);
    const initialCL = isNewlyJoining ? 0 : (newEmp.initialOpeningBalances?.cl || 0);

    setEmployees(prev => [...prev, newEmp]);
    setAttendances(prev => [...prev, { employeeId: newEmp.id, month: globalMonth, year: globalYear, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 }]);
    setLeaveLedgers(prev => [...prev, {
      employeeId: newEmp.id,
      el: {
        opening: initialEL,
        eligible: elCredit,
        encashed: 0,
        availed: 0,
        balance: initialEL + elCredit
      },
      sl: {
        eligible: slCredit + initialSL,
        availed: 0,
        balance: slCredit + initialSL
      },
      cl: {
        availed: 0,
        accumulation: initialCL,
        balance: clCredit + initialCL
      }
    }]);
    setAdvanceLedgers(prev => [...prev, { employeeId: newEmp.id, opening: 0, totalAdvance: 0, monthlyInstallment: 0, paidAmount: 0, balance: 0, emiCount: 0, manualPayment: 0, recovery: 0 }]);
  };

  const handleBulkAddEmployees = (newEmps: Employee[]) => {
    const currentCount = employees.length;
    const remainingSpace = dataSizeLimit - currentCount;
    if (remainingSpace <= 0) { showAlert('warning', 'Employee Limit reached', "Cannot import more employees. Limit reached."); return; }
    const availableEmps = newEmps.slice(0, remainingSpace);
    if (availableEmps.length < newEmps.length) { showAlert('info', 'Partial Import', `Only ${availableEmps.length} out of ${newEmps.length} employees imported due to license limits.`); }
    const currentIds = new Set(employees.map(e => e.id));
    const trulyNewEmps = availableEmps.filter(e => !currentIds.has(e.id));
    setEmployees(curr => {
      const empMap = new Map<string, Employee>();
      curr.forEach(e => empMap.set(e.id, e));
      availableEmps.forEach(newEmp => {
        const existing = empMap.get(newEmp.id);
        if (existing) { empMap.set(newEmp.id, { ...newEmp, photoUrl: existing.photoUrl, serviceRecords: [...existing.serviceRecords, ...newEmp.serviceRecords] }); }
        else { empMap.set(newEmp.id, newEmp); }
      });
      return Array.from(empMap.values());
    });
    if (trulyNewEmps.length > 0) {
      const periodEnd = new Date(globalYear, monthsArr.indexOf(globalMonth) + 1, 0);
      periodEnd.setHours(23, 59, 59, 999);

      const getCredits = (dojStr: string) => {
        const doj = new Date(dojStr);
        doj.setHours(0, 0, 0, 0);
        const isFuture = doj > periodEnd;
        return {
          el: isFuture ? 0 : (leavePolicy?.el?.maxPerYear || 18) / 12,
          sl: isFuture ? 0 : (leavePolicy?.sl?.maxPerYear || 12) / 12,
          cl: isFuture ? 0 : (leavePolicy?.cl?.maxPerYear || 12) / 12
        };
      };

      setAttendances(prev => [...prev, ...trulyNewEmps.map(e => ({ employeeId: e.id, month: globalMonth, year: globalYear, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 }))]);
      setLeaveLedgers(prev => [...prev, ...trulyNewEmps.map(e => {
        const c = getCredits(e.doj);
        const dojDate = new Date(e.doj);
        const isNewlyJoining = dojDate.getMonth() === monthsArr.indexOf(globalMonth) && dojDate.getFullYear() === globalYear;
        
        const init = isNewlyJoining ? { el: 0, sl: 0, cl: 0 } : (e.initialOpeningBalances || { el: 0, sl: 0, cl: 0 });
        
        return {
          employeeId: e.id,
          el: { opening: init.el, eligible: c.el, encashed: 0, availed: 0, balance: init.el + c.el },
          sl: { eligible: c.sl + init.sl, availed: 0, balance: c.sl + init.sl },
          cl: { availed: 0, accumulation: init.cl, balance: c.cl + init.cl }
        };
      })]);
      setAdvanceLedgers(prev => [...prev, ...trulyNewEmps.map(e => ({ employeeId: e.id, opening: 0, totalAdvance: 0, monthlyInstallment: 0, paidAmount: 0, balance: 0, emiCount: 0, manualPayment: 0, recovery: 0 }))]);
      setOTRecords(prev => [...prev, ...trulyNewEmps.map(e => ({ employeeId: e.id, month: globalMonth, year: globalYear, otDays: 0, otHours: 0, otRate: 0, otAmount: 0 }))]);
    }
  };

  const handleAuthLogin = (user: User) => {
    // V02.02.25: Automatically exit full-screen mode upon successful login
    const api = (window as any).electronAPI;
    if (api && api.setFullScreen) {
      api.setFullScreen(false).catch(() => {});
    }

    handleLogin(user);
    setIsCompanyGateOpen(true);

    // 1. Mandatory Security Check: Forced Reset Detection
    const isForcedReset = sessionStorage.getItem('app_forced_reset') === 'true';
    if (isForcedReset && user.role === 'Administrator') {
      setActiveView(View.Settings);
      setSettingsTab('LICENSE');
      setTimeout(() => {
        showAlert('warning', 'Mandatory Password Reset', 'You are using a temporary access code. For security reasons, you must set a new permanent password now.');
      }, 800);
      return; // Skip other notices
    }

    // Daily Trial Notice
    const license = getStoredLicense();
    if (license?.isTrial) {
      const today = new Date().toISOString().split('T')[0];
      const lastShown = localStorage.getItem('trial_notice_shown_date');
      if (lastShown !== today) {
        const expiry = parseExpiryDate(license.expiryDate);
        if (expiry) {
          const diffMs = expiry.getTime() - Date.now();
          const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
          setTrialInfo({
            daysRemaining: daysLeft,
            expiryDate: formatExpiryDate(expiry)
          });
          setShowTrialNotice(true);
          localStorage.setItem('trial_notice_shown_date', today);
        }
      }
    }

    // --- V02.02.19: IDENTITY RESTORATION PROACTIVE ALERT ---
    const isWorkingOnLicense = activeView === View.Settings && settingsTab === 'LICENSE';
    if (license?.status === 'PENDING_RESTORE' && user.role === 'Administrator' && !isWorkingOnLicense) {
      setActiveView(View.Settings);
      setSettingsTab('LICENSE');
      setTimeout(() => {
        showAlert('warning', 'Identity Restoration Required', '🔒 System identifies a mismatch between your local identity and cloud records. Please click "Re-Activate System" with your registered Email/Mobile to restore full access.');
      }, 1000);
      return; 
    }

    if (!companyProfile?.establishmentName || companyProfile.establishmentName === 'Your Establishment Name') {
      setActiveView(View.Settings);
      setSettingsTab('COMPANY');
    } else {
      setTimeout(() => { showAlert('success', 'System Secured', `Welcome back, ${user.name || user.username}. Connected to local database successfully.`); }, 500);
    }
  };

  const executePurge = () => {
    if (!purgeTargetId || !currentUser) return;
    if (purgePassword !== currentUser.password) {
      setPurgeAuthError('Incorrect Security Password');
      return;
    }
    
    deleteCompany(purgeTargetId);
    setShowPurgeAuthModal(false);
    setPurgeTargetId(null);
    setPurgePassword('');
    setPurgeAuthError('');
    showAlert('success', 'Purge Successful', 'Organization unit has been permanently removed from the system.');
  };


  const handleRegistrationComplete = async (data: { companyProfile: CompanyProfile; statutoryConfig: StatutoryConfig; adminUser: User; }) => {
    if (isAddingNewCompany) {
      let namePrefix = (data.companyProfile.establishmentName || 'COMPANY').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (namePrefix.length < 6) namePrefix = namePrefix.padEnd(6, 'X');
      else namePrefix = namePrefix.substring(0, 6);
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      const newId = `${namePrefix}_${randomNum}`;
      const newCompany = { ...data.companyProfile, id: newId };
      addCompany(newCompany, data.statutoryConfig);
      setIsAddingNewCompany(false);
      setShowRegistrationManual(false);
      return;
    }

    let profileToSave = { ...data.companyProfile };
    let requiresReload = false;
    
    if (profileToSave.id === 'default') {
      let namePrefix = (profileToSave.establishmentName || 'COMPANY').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (namePrefix.length < 6) namePrefix = namePrefix.padEnd(6, 'X');
      else namePrefix = namePrefix.substring(0, 6);
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      const firstId = `${namePrefix}_${randomNum}`;
      
      profileToSave.id = firstId;
      localStorage.setItem('app_active_company_id', firstId);
      localStorage.setItem('app_companies', JSON.stringify([profileToSave]));
      requiresReload = true;
    }

    setCompanyProfile(profileToSave);
    setConfig(data.statutoryConfig);
    const savedUsersRaw = localStorage.getItem('app_users');
    let savedUsers: User[] = (() => { try { return savedUsersRaw ? JSON.parse(savedUsersRaw) : []; } catch { return []; } })();
    const adminIdx = savedUsers.findIndex(u => u.username === data.adminUser.username);
    if (adminIdx >= 0) savedUsers[adminIdx] = data.adminUser; else savedUsers.push(data.adminUser);
    localStorage.setItem('app_users', JSON.stringify(savedUsers));
    localStorage.setItem('app_setup_complete', 'true');

    // Check for Post-Reset Enrollment Mode
    const isResetMode = localStorage.getItem('app_is_reset_mode') === 'true';

    if ((window as any).electronAPI) {
      (window as any).electronAPI.dbSet('app_users', savedUsers);
      (window as any).electronAPI.dbSet('app_setup_complete', 'true');
    }
    await verifyLicense();
    setIsSetupComplete(true);
    setShowRegistrationManual(false);
    setCurrentUser(data.adminUser);
    sessionStorage.setItem('app_session_user', JSON.stringify(data.adminUser));

    if (isResetMode) {
      localStorage.removeItem('app_is_reset_mode');
      setActiveView(View.Employees);
      setSkipSetupRedirect(true);
      setTimeout(() => {
        showAlert('success', 'System Reset Ready', 'Start Enrolling Employee', () => { });
      }, 800);
    } else {
      setActiveView(View.Settings);
      setSettingsTab('COMPANY');
      setSkipSetupRedirect(false);
      showAlert('success', 'Setup Complete', `BharatPay Pro is now ready for ${profileToSave.establishmentName}.`, () => {
          if (requiresReload) window.location.reload();
      });
    }
  };

  const handleLogoutAction = () => {
    if (activeView === View.Settings && isSettingsDirty) {
      showAlert('warning', 'Unsaved Changes', 'You are about to sign out with unsaved configuration changes. These changes will be lost. Proceed anyway?', () => {
        setIsSettingsDirty(false);
        logout();
        window.location.reload();
      }, () => { }, 'Discard & Sign Out', 'Stay Here');
      return;
    }
    showAlert('confirm', 'Sign Out', 'Select an action to proceed:', async () => {
      const mid = await getMachineId();
      if (currentUser?.role !== 'Developer') {
        await trackHeartbeat(currentUser?.email || "", mid, currentUser?.username || "UNKNOWN", sessionStartRef.current, 'LOGGED OUT');
      }
      logout();
      window.location.reload();
    }, async () => {
      const mid = await getMachineId();
      if (currentUser?.role !== 'Developer') {
        await trackHeartbeat(currentUser?.email || "", mid, currentUser?.username || "UNKNOWN", sessionStartRef.current, 'LOGGED OUT');
      }
      if ((window as any).electronAPI) (window as any).electronAPI.closeApp();
      else { logout(); window.close(); window.location.reload(); }
    }, 'Re-login', 'Quit Application', 'Cancel');
  };

  const onRolloverTrigger = async (updatedHistory?: PayrollResult[]) => {
    const result = await handleRollover(globalMonth, globalYear, monthsArr, updatedHistory);
    if (result) {
      const { nextMonth, nextYear, backupRes, backupFileName } = result;
      setGlobalMonth(nextMonth);
      setGlobalYear(nextYear);
      if (backupRes.success) {
        showAlert('success', 'Next Month Initialized', (
          <div className="space-y-2 text-left">
            <p>System advanced to <b>{nextMonth} {nextYear}</b>.</p>
            <div className="p-2 bg-indigo-900/20 border border-indigo-500/30 rounded-lg">
              <p className="text-[11px] text-indigo-400 font-bold mb-1">✔ Automatic Backup Created (After Confirmation)</p>
              <p className="text-[10px] text-slate-400 font-mono">{backupFileName}.enc</p>
            </div>
          </div>
        ) as any, () => {
          if (backupRes.path && (window as any).electronAPI) (window as any).electronAPI.openItemLocation(backupRes.path);
        });
      }
    }
  };

  const handleResetLicenseIdentity = async () => {
    showAlert('danger', 'ARE YOU SURE?', 'This will clear the current license and reset system identity.', async () => {
      localStorage.removeItem('app_license_secure');
      localStorage.removeItem('app_machine_id');
      if ((window as any).electronAPI) {
        await (window as any).electronAPI.dbDelete('app_license_secure');
        await (window as any).electronAPI.dbDelete('app_machine_id');
      }
      clearSyncRetryCount();
      window.location.reload();
    }, undefined, 'YES, RESET IDENTITY', undefined, 'CANCEL');
  };

  const toggleFullScreenMode = async () => {
    const api = (window as any).electronAPI;
    
    if (api && api.getIsFullScreen && api.setFullScreen) {
      // Robust sync with Electron window state
      const current = await api.getIsFullScreen();
      api.setFullScreen(!current).catch(() => {
        // Fallback to browser API if IPC fails
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
      });
    } else {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const getFinancialYearLabel = () => {
    const isJanToMar = ['January', 'February', 'March'].includes(globalMonth);
    const startYear = isJanToMar ? globalYear - 1 : globalYear;
    return `FY ${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)} ACTIVE`;
  };

  const effectiveUser = (currentUser || { id: 'setup', name: 'Initial Setup', role: 'Administrator', username: 'setup', password: '', email: '' }) as User;
  const isSettingsAccessible = effectiveUser.role === 'Developer' || effectiveUser.role === 'Administrator';
  const isNavLocked = employees.length === 0;

  if (isStartupTimerActive || isAppDirectoryConfigured === null || !licenseStatus.checked) return <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center z-[1000] space-y-8 animate-in fade-in duration-700">
    <div className="relative">
      <div className="absolute -inset-4 bg-blue-500/20 blur-2xl rounded-full animate-pulse"></div>
      <div className="relative w-36 h-36 rounded-full border-[6px] border-white overflow-hidden shadow-2xl bg-[#020617] flex items-center justify-center">
        <img src="./logo3.png" alt="Startup Logo" className="w-full h-full object-cover" />
      </div>
    </div>
    <div className="flex flex-col items-center gap-1.5 animate-slow-pulse">
      <div className="flex items-center gap-3">
         <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_12px_#3b82f6]"></div>
         <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">
           Security Verification Underway Please Wait
           <span className="inline-block w-8 text-left animate-ellipsis-wait">......</span>
         </p>
      </div>
    </div>
    {/* Progress Bar (Additional Feature) */}
    <div className="w-48 h-1 bg-slate-900 rounded-full overflow-hidden">
       <div className="h-full bg-blue-600 animate-loading-bar-5s rounded-full"></div>
    </div>
  </div>;

  // --- V02.02.10: ADVANCED SECURITY OVERLAYS ---
  const isExpired = licenseStatus.message === 'LICENSE EXPIRED' || (licenseStatus.data?.isExpired);
  const isTampered = licenseStatus.message === 'SECURITY VIOLATION' || (licenseStatus.data?.isTampered);
  const isSyncBlocked = licenseStatus.data?.isSyncBlocked;
  const syncMessage = licenseStatus.message;
  const isSyncWarning = !isSyncBlocked && syncMessage?.includes('uninterrupted use');

  if (licenseStatus.checked && (isExpired || isTampered || isSyncBlocked)) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-10 shadow-2xl relative overflow-hidden">
          {/* Decorative Glow */}
          <div className={`absolute -top-24 -left-24 w-48 h-48 ${isTampered ? 'bg-rose-600/20' : 'bg-amber-600/20'} blur-3xl rounded-full animate-pulse`}></div>

          <div className="relative z-10">
            <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center ${isTampered ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
              {isTampered ? <ShieldAlert size={40} /> : isExpired ? <CalendarX size={40} /> : <WifiOff size={40} />}
            </div>

            <h1 className="text-2xl font-black text-white mb-3 tracking-tight uppercase">
              {isTampered ? 'Security Violation' : isExpired ? 'License Expired' : 'Action Required'}
            </h1>

            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              {isTampered
                ? 'System clock tampering detected. Access has been permanently suspended for security reasons. Please contact support to restore your identity.'
                : isExpired
                  ? 'Your BharatPay Pro license has reached its expiry date. Please contact ilcbala.BharatPayRoll@gmail.com to proceed with renewal.'
                  : syncMessage || 'A mandatory internet connection is required to verify your license status.'}
            </p>

            <div className="space-y-3">
              <button
                onClick={handleRetryVerification}
                disabled={isRetryingSync}
                className={`w-full py-3.5 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${isTampered ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'
                  } ${isRetryingSync ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isRetryingSync ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} /> Retry Verification
                  </>
                )}
              </button>

              <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase opacity-60">Security Engine v{licenseStatus.data?.latestVersion || '02.02.19'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-[100dvh] overflow-hidden bg-[#020617] text-white ${isWin7 ? 'is-win7' : ''}`}>
      {/* Sync Countdown (Day 3 Grace Period) */}
      {licenseStatus.data?.isSyncGracePeriod && licenseStatus.data.graceRemaining > 0 && (
        <SyncCountdownBanner 
          initialMs={licenseStatus.data.graceRemaining} 
          onExpiry={() => {
            // Force block state and logout
            window.location.reload(); 
          }} 
        />
      )}

      {/* Sync Warning Banner (Day 2) */}
      {isSyncWarning && !licenseStatus.data?.isSyncGracePeriod && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-600 text-white text-[11px] font-bold py-1.5 px-4 text-center shadow-lg animate-in slide-in-from-top duration-500 flex items-center justify-center gap-2">
          <Wifi size={14} className="animate-pulse" /> {syncMessage}
        </div>
      )}

      <CustomModal {...alertConfig} onClose={closeAlert} autoCloseSecs={alertConfig.autoCloseSecs} />

      {isAppDirectoryConfigured === false && <AppSetup onComplete={() => setIsAppDirectoryConfigured(true)} />}

      {licenseStatus.checked && !licenseStatus.valid && !showRegistrationManual && isAppDirectoryConfigured && (
        <div className="fixed inset-0 z-[500] bg-[#020617] flex items-center justify-center p-2 md:p-4 overflow-hidden">
          {/* ... License Lock UI ... */}
          <div className="w-full max-w-6xl relative z-10 bg-[#1e293b] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row md:h-[min(800px,90vh)]">
            <div className="md:w-5/12 bg-[#0f172a] p-8 md:p-10 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-800 text-center relative overflow-hidden group shrink-0">
              <img src={BRAND_CONFIG.logoUrl} alt="Logo" className="w-32 h-32 rounded-full mb-6 border-4 border-[#1e293b]" />
              <h1 className="text-3xl font-black"><span className="text-[#FF9933]">Bharat</span>Pay<span className="text-[#4ADE80]">{BRAND_CONFIG.appNameSuffix}</span></h1>
            </div>
            <div className="flex-1 p-10 flex flex-col justify-center items-center text-center bg-[#1e293b]">
              {!getStoredLicense() ? (
                <div className="space-y-6">
                  <h2 className="text-2xl font-black uppercase text-white">System Initialization</h2>
                  <button onClick={() => setShowRegistrationManual(true)} className="w-full py-4 bg-amber-600 text-white font-black rounded-xl uppercase tracking-widest">Register Now <ArrowRight className="inline ml-2" /></button>
                  <button onClick={handleResetLicenseIdentity} className="text-slate-500 text-[10px] uppercase font-bold tracking-widest hover:text-amber-500"><Database className="inline mr-1" /> Emergency Reset</button>
                </div>
              ) : (
                <div className="space-y-6">
                  <Lock size={48} className="mx-auto text-red-500 animate-pulse" />
                  <h2 className="text-2xl font-black uppercase text-white">System Locked</h2>
                  <p className="text-sm text-slate-400 max-w-xs mx-auto">
                    {licenseStatus.retryCount >= 3 
                      ? "Security Conflict Detected (3/3 attempts). Your account access has been suspended due to identity mismatch."
                      : licenseStatus.message}
                  </p>
                  
                  {licenseStatus.status === 'BLOCK_LEGACY' && licenseStatus.launcherUrl && (
                    <button 
                      onClick={() => (window as any).electronAPI?.openExternal(licenseStatus.launcherUrl)}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={20} className="animate-spin-slow" /> 
                      Download Latest Launcher
                    </button>
                  )}
                  
                  {licenseStatus.retryCount >= 3 ? (
                    <button 
                      onClick={() => setIsRestorationForced(true)} 
                      className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl uppercase tracking-widest transition-all shadow-lg shadow-amber-900/20"
                    >
                      <RefreshCw className="inline mr-2 animate-spin-slow" /> 
                      Initiate Identity Restoration
                    </button>
                  ) : (
                    <button 
                      onClick={() => (window as any).electronAPI?.closeApp()} 
                      className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase tracking-widest transition-all"
                    >
                      Quit Application
                    </button>
                  )}
                  
                  <button onClick={handleResetLicenseIdentity} className="text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors">
                    <RefreshCw className="inline mr-1" /> Reset All Local Data
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(showRegistrationManual || isRestorationForced || (companies.length === 0)) ? (
        <Registration
          onComplete={handleRegistrationComplete}
          onRestore={() => window.location.reload()}
          showAlert={showAlert}
          isResetMode={localStorage.getItem('app_is_reset_mode') === 'true'}
          onSystemRepair={handleSystemRepair}
          isNewCompany={isAddingNewCompany}
          activeCompanyId={activeCompanyId}
        />
      ) : !currentUser ? (
        <Login onLogin={handleAuthLogin} currentLogo={logoUrl} setLogo={handleUpdateLogo} />
      ) : (
        <>
          {/* --- V02.02.29: MULTI-COMPANY SELECTION GATE --- */}
          {isCompanyGateOpen && (
            <div className="fixed inset-0 z-[600] bg-[#020617] flex flex-col items-center justify-start pt-32 pb-12 px-6 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar">
              {/* Animated Background Glows */}
              <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-blue-600/10 blur-[100px] rounded-full animate-pulse pointer-events-none"></div>
              <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-600/10 blur-[100px] rounded-full animate-pulse delay-700 pointer-events-none"></div>

              {/* Ghost Background Header */}
              <h1 className="fixed top-12 left-1/2 -translate-x-1/2 text-[5vw] font-bold text-white/[0.02] uppercase tracking-[0.1em] select-none pointer-events-none whitespace-nowrap z-0">
                Organization Selector
              </h1>

              <div className="w-full max-w-4xl relative z-10 flex flex-col items-center">
                <div className="mb-12 text-center space-y-3">
                  <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-slate-900/50 border border-slate-800 rounded-full mb-2">
                     <Building2 size={16} className="text-blue-400/80" />
                     <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.25em]">Multi-Company Silo Gate</span>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight uppercase">
                    {isPurgeMode ? 'Select ' : 'Select '}<span className={isPurgeMode ? 'text-rose-500' : 'text-blue-500'}>Organization</span> {isPurgeMode ? 'to Delete' : 'to Load'}
                  </h1>
                  <p className="text-slate-400 text-xs font-medium tracking-wide max-w-md mx-auto leading-relaxed">
                    {isPurgeMode ? 'Click the trash icon on any unit to permanently remove it.' : `Welcome, ${currentUser?.name || currentUser?.username}. Choose an organization unit to begin.`}
                  </p>
                </div>

                {!isPurgeMode ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
                    {companies.map(c => (
                      <div 
                        key={c.id}
                        className={`group relative flex flex-col p-5 bg-slate-900/40 hover:bg-blue-600/5 border transition-all duration-300 rounded-2xl text-left overflow-hidden h-44 ${activeCompanyId === c.id ? 'border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.1)] bg-blue-600/5' : 'border-slate-800 hover:border-blue-500/30'}`}
                      >
                        {/* Main Clickable Area */}
                        <button 
                          className="absolute inset-0 z-0"
                          title={`Load ${c.establishmentName}`}
                          onClick={() => {
                            switchCompany(c.id);
                            setIsCompanyGateOpen(false);
                            setIsPurgeMode(false);
                          }}
                        ></button>

                        <Building2 size={80} className="absolute -bottom-4 -right-4 text-white/[0.02] group-hover:text-blue-500/5 transition-colors pointer-events-none" />
                        
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base mb-4 transition-all duration-300 pointer-events-none ${activeCompanyId === c.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500 group-hover:bg-blue-600 group-hover:text-white'}`}>
                          {c.establishmentName?.substring(0, 1).toUpperCase() || 'C'}
                        </div>

                        <div className="mt-auto relative z-10 pointer-events-none">
                          <h3 className={`text-base font-bold tracking-tight leading-tight mb-1 truncate transition-colors ${activeCompanyId === c.id ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                            {c.establishmentName}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-bold text-blue-400/80 uppercase tracking-widest bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/10">
                              {c.cin ? 'Registered' : 'Incomplete'}
                            </span>
                            <span className="text-[12px] text-[#FFD700] font-black font-mono tracking-[0.2em] truncate">
                              ID: {c.id}
                            </span>
                          </div>
                        </div>

                        {/* Purge Button (Visible for all, protected for active) */}
                        <button
                          onClick={(e) => {
                             e.stopPropagation();
                             if (activeCompanyId === c.id) {
                               showAlert?.('info', 'Action Prohibited', `Not possible to delete active company. Select another company (shut company) first, and then you can select this company to purge.`);
                             } else {
                               showAlert?.('danger', 'CRITICAL: PERMANENT DELETION', `You are about to PERMANENTLY DELETE "${c.establishmentName}" (ID: ${c.id}) and all its records. This cannot be undone. Are you absolutely sure?`, () => {
                                   setPurgeTargetId(c.id);
                                   setShowPurgeAuthModal(true);
                                   setPurgePassword('');
                                   setPurgeAuthError('');
                               });
                             }
                          }}
                          className={`absolute top-4 right-4 z-20 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${activeCompanyId === c.id ? 'bg-slate-800/50 text-slate-500' : 'bg-rose-900/20 text-rose-500 hover:bg-rose-600 hover:text-white'}`}
                          title={activeCompanyId === c.id ? "Active Company Protected" : "Purge Company"}
                        >
                          <Trash2 size={16} />
                        </button>

                        {activeCompanyId === c.id && (
                          <div className="absolute top-5 right-5 pointer-events-none">
                             <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_#3b82f6]"></div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add New Company Button */}
                    <button 
                      onClick={() => {
                        setIsAddingNewCompany(true);
                        setShowRegistrationManual(true);
                        setIsCompanyGateOpen(false);
                        setIsPurgeMode(false);
                      }}
                      className="group flex flex-col items-center justify-center p-5 bg-emerald-600/5 hover:bg-emerald-600/10 border border-dashed border-emerald-500/20 hover:border-emerald-500/50 transition-all duration-300 rounded-2xl text-center h-44 space-y-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:bg-emerald-500 group-hover:text-white">
                         <Plus size={20} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-emerald-500/80 uppercase tracking-widest">Add New Unit</h3>
                        <p className="text-[9px] text-emerald-500/40 font-bold uppercase tracking-tighter mt-0.5">Initialize Payroll</p>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="w-full max-w-2xl space-y-3 bg-slate-900/20 p-6 rounded-3xl border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-300">
                    {companies.map(c => (
                      <div 
                        key={c.id}
                        className={`group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${activeCompanyId === c.id ? 'bg-blue-600/5 border-blue-500/30' : 'bg-slate-900/40 border-slate-800 hover:border-rose-500/30 hover:bg-rose-500/5'}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${activeCompanyId === c.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-rose-900/20 group-hover:text-rose-500'}`}>
                            {c.establishmentName?.substring(0, 1).toUpperCase() || 'C'}
                          </div>
                          <div>
                            <h3 className={`text-base font-bold tracking-tight ${activeCompanyId === c.id ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                              {c.establishmentName}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[13px] font-black text-[#FFD700] uppercase tracking-[0.2em] bg-slate-950/50 px-2 py-0.5 rounded border border-slate-800/50">
                                ID: {c.id}
                              </span>
                              {activeCompanyId === c.id && <span className="text-[8px] font-black text-blue-400 uppercase tracking-tighter bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">Active Session</span>}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                             e.stopPropagation();
                             if (activeCompanyId === c.id) {
                               showAlert?.('info', 'Action Prohibited', `Not possible to delete active company. Select another company (shut company) first, and then you can select this company to purge.`);
                             } else {
                               showAlert?.('danger', 'CRITICAL: PERMANENT DELETION', `You are about to PERMANENTLY DELETE "${c.establishmentName}" (ID: ${c.id}) and all its records. This cannot be undone. Are you absolutely sure?`, () => {
                                   setPurgeTargetId(c.id);
                                   setShowPurgeAuthModal(true);
                                   setPurgePassword('');
                                   setPurgeAuthError('');
                               });
                             }
                          }}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeCompanyId === c.id ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50' : 'bg-rose-900/20 text-rose-500 hover:bg-rose-600 hover:text-white shadow-lg shadow-rose-900/10'}`}
                        >
                          <Trash2 size={14} />
                          {activeCompanyId === c.id ? 'Locked' : 'Confirm Purge'}
                        </button>
                      </div>
                    ))}
                    
                    <button 
                      onClick={() => setIsPurgeMode(false)}
                      className="w-full mt-6 py-4 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-slate-700/50"
                    >
                      Cancel & Return to Selector
                    </button>
                  </div>
                )}

                {/* Password Verification Modal for Purge */}
                {showPurgeAuthModal && (
                  <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-rose-900/50 shadow-2xl p-8 flex flex-col gap-6 relative">
                      <button onClick={() => setShowPurgeAuthModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close"><X size={20} /></button>
                      
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-rose-900/20 text-rose-500 rounded-full border border-rose-900/50 mb-2">
                          <Lock size={32} />
                        </div>
                        <h3 className="text-xl font-black text-white text-center uppercase tracking-tighter">Security Verification</h3>
                        <p className="text-[10px] text-rose-300 text-center leading-relaxed uppercase font-bold tracking-wide">
                          Confirm password to authorize permanent deletion.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1 mb-1.5 block">Admin Password</label>
                          <input 
                            type="password" 
                            placeholder="••••••••" 
                            autoFocus 
                            className={`w-full bg-[#0f172a] border ${purgeAuthError ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3.5 text-white outline-none focus:ring-2 focus:ring-rose-500 transition-all font-mono`} 
                            value={purgePassword} 
                            onChange={(e) => { setPurgePassword(e.target.value); setPurgeAuthError(''); }} 
                            onKeyDown={(e) => e.key === 'Enter' && executePurge()} 
                          />
                          {purgeAuthError && <p className="text-[10px] text-red-400 font-bold mt-2 text-center animate-pulse">{purgeAuthError}</p>}
                        </div>
                        
                        <button 
                          onClick={executePurge}
                          className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                        >
                          <Trash2 size={16} /> Authorize Purge
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-16 flex flex-col items-center gap-4">
                  <div className="flex items-center gap-8">
                     <button onClick={handleLogoutAction} className="text-slate-500 hover:text-red-400 text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2">
                       <LogOut size={14} /> Change User Account
                     </button>
                     <div className="w-px h-4 bg-slate-800"></div>
                     <button onClick={() => setIsCompanyGateOpen(false)} className="text-slate-500 hover:text-blue-400 text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2">
                       <LayoutDashboard size={14} /> Skip to Last Active
                     </button>
                  </div>
                  <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.3em] mt-2">Enterprise Multi-Company Mode v{APP_VERSION}</p>
                </div>
              </div>
            </div>
          )}

          {showLoginMessage && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="bg-[#1e293b] w-full max-w-lg rounded-2xl border border-blue-500/50 p-8 space-y-6">
                <h3 className="text-lg font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                  <Megaphone size={20} className="text-amber-500" />
                  Developer Message Board
                </h3>
                <div className="space-y-4">
                  {companyProfile.postLoginHeader && (
                    <h4 className={`text-md font-bold text-white uppercase tracking-tight ${companyProfile.postLoginAlignment === 'CENTER' ? 'text-center' :
                        companyProfile.postLoginAlignment === 'RIGHT' ? 'text-right' : 'text-left'
                      }`}>
                      {companyProfile.postLoginHeader}
                    </h4>
                  )}
                  <p className={`text-slate-200 text-xs leading-relaxed whitespace-pre-wrap ${companyProfile.postLoginAlignment === 'CENTER' ? 'text-center' :
                      companyProfile.postLoginAlignment === 'RIGHT' ? 'text-right' : 'text-left'
                    }`}>
                    {companyProfile.postLoginMessage}
                  </p>
                </div>
                <button onClick={() => setShowLoginMessage(false)} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl uppercase tracking-widest transition-all">Acknowledge & Continue</button>
              </div>
            </div>
          )}

          {showFlashPopup && companyProfile.flashPopupMessage && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
              <div className="bg-slate-900 w-full max-w-lg rounded-2xl border-2 border-amber-500/50 p-8 space-y-6 shadow-[0_0_50px_rgba(245,158,11,0.2)]">
                <h3 className="text-xl font-black text-amber-500 uppercase tracking-[0.2em] flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Megaphone size={24} className="text-amber-500 animate-bounce" />
                  </div>
                  {companyProfile.flashPopupHeader || "Urgent Announcement"}
                </h3>
                <div className="space-y-4 py-2">
                  <p className="text-white text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    {companyProfile.flashPopupMessage}
                  </p>
                </div>
                <button
                  onClick={() => setShowFlashPopup(false)}
                  className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white text-sm font-black rounded-xl uppercase tracking-[0.2em] transition-all shadow-lg hover:shadow-amber-500/20 active:scale-95"
                >
                  I Have Read This Notice
                </button>
              </div>
            </div>
          )}

          {showTrialNotice && trialInfo && (
            <TrialNoticeModal
              daysRemaining={trialInfo.daysRemaining}
              expiryDate={trialInfo.expiryDate}
              onClose={() => setShowTrialNotice(false)}
            />
          )}

          <aside
            className={`${isSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-[#0f172a] border-r border-slate-800 flex flex-col z-40`}
            onMouseEnter={() => !isSidebarOpen && setIsSidebarOpen(true)}
          >
            <div className="p-6 flex flex-col items-start border-b border-slate-800 transition-all">
              <div className="flex items-center gap-3">
                <IndianRupee size={18} className="text-[#FF9933]" />
                {isSidebarOpen && <span className="text-lg font-black"><span className="text-[#FF9933]">Bharat</span><span className="text-white">Pay</span><span className="text-[#34d399]"> Pro</span></span>}
              </div>
              {isSidebarOpen && (
                <div className="mt-0.5 ml-7 animate-in fade-in slide-in-from-left-2 duration-500 flex flex-col gap-0.5">
                  <span className="text-[8px] font-black text-[#FFD700] uppercase tracking-[0.25em] whitespace-nowrap">Indian Payroll Management</span>
                </div>
              )}
            </div>
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
              <NavigationItem view={View.Dashboard} icon={LayoutDashboard} label="Dashboard" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={(isNavLocked || isCompanyGateOpen) && activeView !== View.Dashboard} />
              <NavigationItem view={View.Employees} icon={Users} label="Employee Master" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} />
              <NavigationItem view={View.PayProcess} icon={CalendarClock} label="Process Payroll" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} />
              <NavigationItem view={View.Reports} icon={FileText} label="Pay Reports" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} />
              <NavigationItem view={View.Statutory} icon={ShieldCheck} label="Statutory Reports" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} />
              <NavigationItem view={View.MIS} icon={IndianRupee} label="Management Info (MIS)" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} />
              <NavigationItem view={View.SSCode} icon={Scale} label="Social Security / Code Wages" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} />
              <NavigationItem view={View.PFCalculator} icon={Calculator} label="PF ECR Calculator" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} />
              <NavigationItem view={View.Utilities} icon={Wrench} label="Utilities" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} />
              <NavigationItem view={View.AI_Assistant} icon={Bot} label="Compliance AI" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} />
              {isSettingsAccessible && <NavigationItem view={View.Settings} icon={SettingsIcon} label="Configuration" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} />}
            </nav>
            <div className="p-4 border-t border-slate-800 bg-[#0b1120] space-y-1">
              <button onClick={handleLogoutAction} className={`w-full flex items-center ${isSidebarOpen ? 'justify-start gap-3 px-4' : 'justify-center'} py-2.5 rounded-lg text-red-400 hover:bg-red-900/20`}><LogOut size={18} /> {isSidebarOpen && <span className="font-bold text-sm">Sign Out</span>}</button>
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`w-full flex items-center ${isSidebarOpen ? 'justify-start gap-3 px-4' : 'justify-center'} py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all`}
              >
                {isSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                {isSidebarOpen && <span className="font-bold text-[10px] uppercase tracking-[0.2em]">Collapse</span>}
              </button>
            </div>
          </aside>
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <header className="bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800 h-16 flex items-center justify-between px-8 shrink-0 z-30">
              <div className="flex items-center gap-4 shrink-0 mr-4">
                <div className="relative group/company">
                  <button className="flex items-center gap-3 bg-[#1e293b] hover:bg-[#2d3b50] px-4 py-2 rounded-xl border border-slate-700 transition-all group-hover/company:border-blue-500/50">
                    <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-full border border-slate-600 shadow-lg object-cover shrink-0" />
                    <div className="flex flex-col items-start leading-tight">
                      <span className="text-sm font-black text-white tracking-tight truncate max-w-[220px]">{companyProfile.establishmentName || "Select Organization"}</span>
                      <div className="flex flex-col items-start mt-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-black text-[#FFD700] tracking-[0.05em] uppercase whitespace-nowrap">
                            {licenseInfo?.isTrial ? "Trial Valid Upto :" : "License Valid Upto :"}
                          </span>
                          {licenseInfo?.expiryDate && (
                            <span className="text-[9px] font-black text-[#FFD700] uppercase tracking-tighter">
                              {licenseInfo.expiryDate}
                            </span>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 transition-all duration-500 mt-0.5 ${
                          connStatus.isOnline 
                            ? 'text-emerald-400' 
                            : (connStatus.offlineDay >= 3 ? 'text-rose-500 animate-pulse' : 'text-amber-500')
                        }`}>
                          {connStatus.isOnline ? (
                            <div className="flex items-center gap-1 animate-pulse">
                              <div className="w-1 h-1 bg-emerald-500 rounded-full shadow-[0_0_5px_#10b981]"></div>
                              <span className="text-[8px] font-black uppercase tracking-widest">Live Connection</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                               <div className="w-1 h-1 bg-amber-500 rounded-full"></div>
                               <span className="text-[8px] font-black uppercase tracking-widest">Offline Mode</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-500 rotate-90 group-hover/company:text-white transition-all" />
                  </button>
                  
                  {/* Company Switcher Dropdown */}
                  <div className="absolute top-full left-0 mt-2 w-72 bg-[#1e293b] border border-slate-700 rounded-2xl shadow-2xl opacity-0 invisible group-hover/company:opacity-100 group-hover/company:visible transition-all z-[100] overflow-hidden">
                    <div className="p-4 bg-[#0f172a] border-b border-slate-800">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Select Organization</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      {companies.map(c => (
                        <button 
                          key={c.id}
                          onClick={() => switchCompany(c.id)}
                          className={`w-full flex items-center gap-3 p-4 text-left hover:bg-blue-900/20 transition-all border-b border-slate-800/50 last:border-0 ${activeCompanyId === c.id ? 'bg-blue-900/40 border-l-4 border-l-blue-500' : ''}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${activeCompanyId === c.id ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                            {c.establishmentName?.substring(0, 2).toUpperCase() || 'CO'}
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className={`text-sm font-bold truncate ${activeCompanyId === c.id ? 'text-white' : 'text-slate-300'}`}>{c.establishmentName}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 font-mono tracking-tighter truncate">{c.cin || 'No CIN Registered'}</span>
                              <span className="text-[8px] px-1.5 py-0.5 bg-slate-800 text-amber-500 rounded font-black uppercase tracking-tighter border border-slate-700 shrink-0">{c.id}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="p-3 bg-[#0f172a] border-t border-slate-800">
                      <button 
                        onClick={() => {
                          setIsAddingNewCompany(true);
                          setShowRegistrationManual(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                      >
                        <RefreshCw size={14} /> Add New Company
                      </button>
                    </div>
                  </div>
                </div>

                </div>
              <div className="flex-1 px-4 min-w-[200px] max-w-lg mx-auto">
                <div className="flex items-center gap-0 bg-[#020617] rounded-xl border border-slate-800 overflow-hidden h-10 shadow-2xl">
                  <div className="bg-slate-900 border-r border-slate-800 h-full px-4 flex items-center justify-center shrink-0">
                    <Megaphone size={16} className="text-amber-500" />
                  </div>
                  <div className="flex-1 overflow-hidden relative">
                    <div className="animate-marquee-seamless whitespace-nowrap text-[13px] font-semibold text-amber-100 py-2 flex">
                      <span className="pr-40">{companyProfile.flashNews || 'Welcome to BharatPay Pro! Use Configuration to update this message.'}</span>
                      <span className="pr-40">{companyProfile.flashNews || 'Welcome to BharatPay Pro! Use Configuration to update this message.'}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-5 shrink-0 ml-4">
                <button
                  onClick={toggleFullScreenMode}
                  title={document.fullscreenElement ? "Exit Full Screen" : "Enter Full Screen"}
                  className="p-2.5 bg-slate-800/40 hover:bg-slate-800 rounded-full border border-slate-700/50 shadow-lg text-slate-400 hover:text-white transition-all"
                >
                  {document.fullscreenElement ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
                  <div className="flex flex-col items-end gap-1">
                    <div className="px-3 py-1 bg-slate-900 border border-slate-800/80 rounded-md shadow-sm relative z-0">
                      <span className="text-[9px] text-[#FFD700] uppercase tracking-[0.2em] font-black">VERSION {APP_VERSION}</span>
                    </div>
                    <div className="px-4 py-1.5 bg-[#020617] border border-emerald-800/60 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.2)] animate-slow-pulse -mt-1.5 relative z-10">
                      <span className="text-[10px] font-black text-[#10b981] uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-[#10b981] rounded-full shadow-[0_0_8px_#10b981]"></div>
                        {getFinancialYearLabel()}
                      </span>
                    </div>
                  </div>
                </div>
            </header>

            <main
              ref={mainContentRef}
              className="flex-1 overflow-y-auto bg-slate-950 custom-scrollbar relative"
              onMouseEnter={() => isSidebarOpen && activeView !== View.Dashboard && setIsSidebarOpen(false)}
            >
              <div className="p-8 max-w-7xl mx-auto">
                {activeView === View.Dashboard && <Dashboard employees={employees} config={config} companyProfile={companyProfile} attendances={attendances} leaveLedgers={leaveLedgers} advanceLedgers={advanceLedgers} payrollHistory={payrollHistory} month={globalMonth} year={globalYear} setMonth={setGlobalMonth} setYear={setGlobalYear} onNavigate={safeNavigate} />}
                {activeView === View.Employees && <EmployeeList employees={employees} setEmployees={setEmployees} onAddEmployee={handleAddEmployee} onBulkAddEmployees={handleBulkAddEmployees} designations={designations} divisions={divisions} branches={branches} sites={sites} currentUser={effectiveUser} companyProfile={companyProfile} dataSizeLimit={dataSizeLimit} showAlert={showAlert} globalMonth={globalMonth} globalYear={globalYear} />}
                {activeView === View.PayProcess && <PayProcess employees={employees} config={config} companyProfile={companyProfile} attendances={attendances} setAttendances={setAttendances} leaveLedgers={leaveLedgers} setLeaveLedgers={setLeaveLedgers} advanceLedgers={advanceLedgers} setAdvanceLedgers={setAdvanceLedgers} savedRecords={payrollHistory} setSavedRecords={setPayrollHistory} leavePolicy={leavePolicy} month={globalMonth} setMonth={setGlobalMonth} year={globalYear} setYear={setGlobalYear} currentUser={effectiveUser} fines={fines} setFines={setFines} arrearHistory={arrearHistory} setArrearHistory={setArrearHistory} otRecords={otRecords} setOTRecords={setOTRecords} showAlert={showAlert} />}
                {activeView === View.Reports && <Reports employees={employees} setEmployees={setEmployees} config={config} companyProfile={companyProfile} attendances={attendances} savedRecords={payrollHistory} setSavedRecords={setPayrollHistory} month={globalMonth} year={globalYear} setMonth={setGlobalMonth} setYear={setGlobalYear} leaveLedgers={leaveLedgers} setLeaveLedgers={setLeaveLedgers} advanceLedgers={advanceLedgers} setAdvanceLedgers={setAdvanceLedgers} currentUser={effectiveUser} onRollover={onRolloverTrigger} arrearHistory={arrearHistory} showAlert={showAlert} latestFrozenPeriod={latestFrozenPeriod} />}
                {activeView === View.Statutory && <StatutoryReports payrollHistory={payrollHistory} employees={employees} config={config} companyProfile={companyProfile} globalMonth={globalMonth} setGlobalMonth={setGlobalMonth} globalYear={globalYear} setGlobalYear={setGlobalYear} attendances={attendances} leaveLedgers={leaveLedgers} advanceLedgers={advanceLedgers} arrearHistory={arrearHistory} latestFrozenPeriod={latestFrozenPeriod} showAlert={showAlert} />}
                {activeView === View.MIS && <MISDashboard payrollHistory={payrollHistory} employees={employees} companyProfile={companyProfile} showAlert={showAlert} />}
                {activeView === View.SSCode && <SocialSecurityCode payrollHistory={payrollHistory} employees={employees} config={config} companyProfile={companyProfile} globalMonth={globalMonth} setGlobalMonth={setGlobalMonth} globalYear={globalYear} setGlobalYear={setGlobalYear} showAlert={showAlert} />}
                {activeView === View.Utilities && <Utilities designations={designations} setDesignations={setDesignations} divisions={divisions} setDivisions={setDivisions} branches={branches} setBranches={setBranches} sites={sites} setSites={setSites} showAlert={showAlert} />}
                {activeView === View.PFCalculator && <PFCalculator employees={employees} payrollHistory={payrollHistory} config={config} companyProfile={companyProfile} month={globalMonth} setMonth={setGlobalMonth} year={globalYear} setYear={setGlobalYear} />}
                {activeView === View.Settings && isSettingsAccessible && <Settings config={config} setConfig={setConfig} companyProfile={companyProfile} setCompanyProfile={setCompanyProfile} currentLogo={logoUrl} setLogo={handleUpdateLogo} leavePolicy={leavePolicy} setLeavePolicy={setLeavePolicy} onRestore={onRefresh} initialTab={settingsTab} userRole={effectiveUser?.role} currentUser={effectiveUser} isSetupMode={employees.length === 0} onSkipSetupRedirect={() => { setSkipSetupRedirect(true); safeNavigate(View.Dashboard); }} onNuclearReset={handleNuclearReset} onDirtyChange={setIsSettingsDirty} showAlert={showAlert} verifyLicense={verifyLicense} activeCompanyId={activeCompanyId} onDeleteCompany={deleteCompany} onOpenGate={() => { setIsCompanyGateOpen(true); setIsPurgeMode(true); }} />}
                {activeView === View.AI_Assistant && <AIAssistant />}
              </div>
            </main>
          </div>
        </>
      )}


      <UpdatePortal 
        isOpen={((showUpdateNotice || isPatchNotice || isUpdatePreparing || showBackgroundNotice || updateDownloaded || updateError === 'SECURITY_VIOLATION' || isInstalling) && !isSessionDismissed) || updateError === 'SECURITY_VIOLATION' || isInstalling}
        state={
          isInstalling ? 'INSTALLING' :
          updateError === 'SECURITY_VIOLATION' ? 'VIOLATION' :
          isPatchNotice ? 'PATCH' : 
          updateDownloaded ? 'READY' :
          isUpdatePreparing ? 'PREPARING' :
          showBackgroundNotice ? 'BACKGROUND' : 'TOAST'
        }
        version={latestAppVersion}
        isMandatory={isPatchMandatory}
        isDownloading={isUpdateDownloading}
        isPreparing={isUpdatePreparing}
        downloadProgress={downloadProgress}
        patchSkipCount={patchSkipCount}
        deploymentStep={deploymentStep}
        onUpdateNow={() => handleUpdateNow(async () => {
          setIsInstalling(true);
          // Pre-install persistence
          const keysToPersist = ['app_users', 'app_license_secure', 'app_data_size', 'app_employees', 'app_setup_complete', 'app_logo'];
          for (const k of keysToPersist) {
            const val = localStorage.getItem(k);
            if (val && (window as any).electronAPI) {
              await (window as any).electronAPI.dbSet(k, val.startsWith('{') || val.startsWith('[') ? JSON.parse(val) : val);
            }
          }
        })}
        onUpdateLater={handleUpdateLater}
        onClose={() => {
           setShowUpdateNotice(false);
           setShowBackgroundNotice(false);
           setUpdateError(null);
           setIsInstalling(false);
        }}
      />

      {/* --- V02.02.18: LEGACY VERSION HARD-BLOCK OVERLAY --- */}
      {licenseStatus.status === 'BLOCK_LEGACY' && (
        <div className="fixed inset-0 bg-[#020617] z-[10000] flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
            <div className="mb-8 relative inline-block">
              <div className="absolute inset-0 bg-rose-500/20 blur-3xl rounded-full"></div>
              <ShieldAlert size={80} className="text-rose-500 relative animate-pulse" />
            </div>
            
            <h2 className="text-3xl font-black text-white mb-2 tracking-tight uppercase">Legacy Support Ended</h2>
            <div className="w-16 h-1 bg-rose-600 mx-auto mb-6"></div>
            
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              Your application version <strong className="text-white">({APP_VERSION})</strong> is no longer supported by the cloud security engine. Since your version lacks built-in update features, a manual refresh is required to maintain system integrity.
            </p>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mb-8 text-left">
              <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-3">Next Steps:</h4>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex gap-3">
                  <div className="shrink-0 w-5 h-5 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center font-bold">1</div>
                  <span>Click the update button below to download the latest <strong>Launch_App</strong>.</span>
                </li>
                <li className="flex gap-3">
                  <div className="shrink-0 w-5 h-5 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center font-bold">2</div>
                  <span>Double-click the downloaded file to automatically install and launch the latest version.</span>
                </li>
              </ul>
            </div>

            <a
              href={licenseStatus.launcherUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center gap-3 w-full py-4 bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white rounded-xl font-black text-sm transition-all shadow-[0_10px_30px_rgba(225,29,72,0.3)] hover:shadow-[0_15px_40px_rgba(225,29,72,0.4)] hover:-translate-y-0.5"
            >
              DOWNLOAD LATEST LAUNCHER
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </a>
            
            <p className="mt-8 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Security Protocol V02.02.18 Enabled
            </p>
          </div>
        </div>
      )}

      {/* --- V02.02.24: MANDATORY LEGAL ALERT OVERLAY --- */}
      {showLegalModal && companyProfile?.loginAlertMessage && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[#020617]/95 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-[#1e293b] w-full max-w-2xl rounded-[2.5rem] border border-blue-500/30 shadow-[0_0_50px_rgba(37,99,235,0.2)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
            <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-8 flex items-center gap-6 border-b border-white/10">
              <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
                <ShieldAlert className="text-white" size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-white tracking-tight uppercase italic leading-none">Mandatory Legal Notice</h3>
                <p className="text-blue-200 text-[10px] font-bold opacity-80 uppercase tracking-[0.3em]">Identity Verification & Compliance Board</p>
              </div>
            </div>

            <div className="p-10 space-y-8 bg-[#1e293b] overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="p-6 px-12 bg-blue-500/5 border-l-4 border-blue-500 rounded-r-2xl">
                <p className="text-[14px] leading-relaxed text-slate-100 font-medium italic whitespace-pre-wrap text-center">
                  {companyProfile.loginAlertMessage}
                </p>
              </div>

              <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-700/50 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></div>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    By clicking <span className="text-emerald-400 font-black">"I HAVE READ & ACCEPT"</span>, you acknowledge that you are authorized to access this system and agree to comply with all corporate and statutory regulations.
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    Selection of <span className="text-rose-400 font-black underline">"I DISAGREE"</span> will immediately terminate this application session.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 bg-[#0f172a] border-t border-slate-800 flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleDisagreeLegal}
                className="flex-1 py-4 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 font-black rounded-2xl transition-all uppercase tracking-widest text-xs border border-slate-700 hover:border-rose-500/30 group"
              >
                I Disagree
              </button>
              <button
                onClick={handleAcceptLegal}
                className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-900/40 uppercase tracking-widest text-xs group flex items-center justify-center gap-3 active:scale-95"
              >
                I Have Read & Accept
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const App: React.FC = () => {
  const [refreshKey] = useState(0);
  const handleRefresh = () => { 
    // Hard reload is required to ensure SQLite mappings and usePayrollData hooks 
    // are fully synchronized with the new multi-company storage keys.
    window.location.reload(); 
  };
  return <PayrollShell key={refreshKey} onRefresh={handleRefresh} />;
};

export default App;
