
import { useState, useEffect, useRef, FC } from 'react';
import {
  LayoutDashboard, Users, Calculator, FileText, Settings as SettingsIcon,
  LogOut, Bot, ShieldCheck,
  Loader2, Lock, Wrench,
  CalendarClock, IndianRupee, Megaphone, Maximize, Minimize,
  ArrowRight, RefreshCw, Database,
  ChevronLeft, ChevronRight
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
import TrialNoticeModal from './components/Shared/TrialNoticeModal';

import { getStoredLicense, APP_VERSION } from './services/licenseService';
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


const PayrollShell: FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const mainContentRef = useRef<HTMLElement>(null);
  
  // --- Initialize Hooks ---
  const { alertConfig, setAlertConfig, showAlert, closeAlert } = useAlerts();
  const { globalMonth, setGlobalMonth, globalYear, setGlobalYear, latestFrozenPeriod } = usePayrollPeriod();
  const { licenseStatus, licenseInfo, dataSizeLimit, verifyLicense, checkNewMessages } = useLicense();
  const { 
    latestAppVersion, setLatestAppVersion,
    setDownloadUrl,
    showUpdateNotice, isUpdateDownloading, 
    updateDownloaded, handleUpdateNow, handleUpdateLater 
  } = useAppUpdate(showAlert);
  const {
    employees, setEmployees, config, setConfig, companyProfile, setCompanyProfile,
    leavePolicy, setLeavePolicy, attendances, setAttendances, leaveLedgers, setLeaveLedgers,
    advanceLedgers, setAdvanceLedgers, payrollHistory, setPayrollHistory, fines, setFines,
    arrearHistory, setArrearHistory, otRecords, setOTRecords, designations, setDesignations, divisions, setDivisions,
    branches, setBranches, sites, setSites, logoUrl, setLogoUrl,
    safeSave, handleRollover, handleNuclearReset
  } = usePayrollData(showAlert);
  const { isAppDirectoryConfigured, setIsAppDirectoryConfigured } = useAppInitialization(verifyLicense);
  const { currentUser, handleLogin, logout, setCurrentUser } = useAuth();
  const { activeView, setActiveView } = useNavigation(mainContentRef, currentUser);
  const {
    settingsTab, setSettingsTab, isSidebarOpen, setIsSidebarOpen,
    showLoginMessage, setShowLoginMessage,
    showRegistrationManual, setShowRegistrationManual, setSkipSetupRedirect,
    isSetupComplete, setIsSetupComplete
  } = useUIState(employees.length, activeView, setActiveView);

  // NEW: Dedicated Flash Message State
  const [showFlashPopup, setShowFlashPopup] = useState(false);
  const [isSettingsDirty, setIsSettingsDirty] = useState(false);

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


  // Trial Notice State
  const [showTrialNotice, setShowTrialNotice] = useState(false);
  const [trialInfo, setTrialInfo] = useState<{ daysRemaining: number; expiryDate: string } | null>(null);

  // Persistence & Sync Hook
  useSync({
    employees, config, companyProfile, attendances, leaveLedgers, advanceLedgers,
    payrollHistory, fines, leavePolicy, arrearHistory, otRecords, logoUrl,
    designations, divisions, branches, sites, isSetupComplete, safeSave
  });

  // --- Specialized Effects ---
  
  // --- V02.02.08: MASTER DATABASE REPAIR ---
  // Ensure 'admin' is permanently renamed to Registered ID (Sbobby12)
  useEffect(() => {
    const license = getStoredLicense();
    if (license && license.userID && license.userID.toUpperCase() !== 'TRIAL' && license.userID.toUpperCase() !== 'RESCUE') {
      const usersRaw = localStorage.getItem('app_users');
      if (usersRaw) {
        try {
          const users = JSON.parse(usersRaw);
          const adminIndex = users.findIndex((u: any) => u.role === 'Administrator');
          if (adminIndex !== -1 && users[adminIndex].username !== license.userID) {
            console.log(`🛡️ Repair: Renaming internal admin -> ${license.userID}`);
            users[adminIndex].username = license.userID;
            localStorage.setItem('app_users', JSON.stringify(users));
            // @ts-ignore
            if (window.electronAPI) window.electronAPI.dbSet('app_users', users);
          }
        } catch (err) { console.error("Database Repair Failed", err); }
      }
    }
  }, []);
  
  // Handle New Update Detected
  useEffect(() => {
    if (showUpdateNotice && !updateDownloaded && !isUpdateDownloading && latestAppVersion) {
      setAlertConfig({
        isOpen: true,
        type: 'confirm',
        title: 'New Update Available',
        message: `A new version (${latestAppVersion}) of BharatPay Pro is available with important enhancements. Would you like to download it now? You can keep working while it downloads in the background.`,
        confirmLabel: 'Download Now',
        cancelLabel: 'Later',
        onConfirm: () => handleUpdateNow(async () => {
             const keysToPersist = ['app_users', 'app_license_secure', 'app_data_size', 'app_employees', 'app_setup_complete'];
             for (const k of keysToPersist) {
               const val = localStorage.getItem(k);
               if (val && (window as any).electronAPI) {
                 try {
                   const parsed = (val.startsWith('{') || val.startsWith('[')) ? JSON.parse(val) : val;
                   await (window as any).electronAPI.dbSet(k, parsed);
                 } catch (e) {
                   await (window as any).electronAPI.dbSet(k, val);
                 }
               }
             }
        })
      });
    }
  }, [showUpdateNotice, updateDownloaded, isUpdateDownloading, latestAppVersion, setAlertConfig, handleUpdateNow]);

  // Handle Update Prompt on Start (Once Downloaded)
  useEffect(() => {
    if (latestAppVersion && updateDownloaded) {
        setAlertConfig({
          isOpen: true,
          type: 'confirm',
          title: 'Update Ready to Install',
          message: `Version ${latestAppVersion} has been downloaded. Would you like to install it now? Your data will be backed up automatically.`,
          confirmLabel: 'Install Now',
          cancelLabel: 'Later',
          onConfirm: () => handleUpdateNow(async () => {
             const keysToPersist = ['app_users', 'app_license_secure', 'app_data_size', 'app_employees', 'app_setup_complete'];
             for (const k of keysToPersist) {
               const val = localStorage.getItem(k);
               if (val && (window as any).electronAPI) {
                 try {
                   const parsed = (val.startsWith('{') || val.startsWith('[')) ? JSON.parse(val) : val;
                   await (window as any).electronAPI.dbSet(k, parsed);
                 } catch (e) {
                   await (window as any).electronAPI.dbSet(k, val);
                 }
               }
             }
          })
        });
    }
  }, [latestAppVersion, updateDownloaded, setAlertConfig, handleUpdateNow]);

  useEffect(() => {
    if (!licenseStatus.valid) return;

    const syncMessages = async () => {
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
          flashPopupId: updates.flashPopupId || prev.flashPopupId
        }));

        // --- NEW: Refresh Global Update State ---
        if (updates.latestVersion) setLatestAppVersion(updates.latestVersion);
        if (updates.downloadUrl) setDownloadUrl(updates.downloadUrl);

        // --- REFINED IMMEDIATE FLASH LOGIC ---
        // Only show immediate popup if key is IMMEDIATE and it hasn't been seen
        if (updates.key === 'IMMEDIATE' && updates.flashPopupId) {
          const seenIdsRaw = localStorage.getItem('app_seen_flash_ids') || '[]';
          let seenIds: string[] = [];
          try { seenIds = JSON.parse(seenIdsRaw); } catch { seenIds = []; }
          
          if (!seenIds.includes(updates.flashPopupId)) {
            setShowFlashPopup(true);
            seenIds.push(updates.flashPopupId);
            localStorage.setItem('app_seen_flash_ids', JSON.stringify(seenIds));
          }
        }
      }
    };

    // Initial check
    syncMessages();

    // Periodic check every 10 minutes
    const interval = setInterval(syncMessages, 600000);
    return () => clearInterval(interval);
  }, [licenseStatus.valid, checkNewMessages, setCompanyProfile, setShowLoginMessage]);

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
      timeoutId = setTimeout(() => {
        sessionStorage.setItem('logout_reason', 'timeout');
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

  // --- HANDLERS INTEGRATION ---
  
  const handleUpdateLogo = (url: string) => { setLogoUrl(url); safeSave('app_logo', url); };

  const handleAddEmployee = (newEmp: Employee) => {
    if (employees.length >= dataSizeLimit) {
      showAlert('warning', 'Employee Limit Reached', `Your current license/trial is limited to ${dataSizeLimit} employees. Please upgrade your license to add more.`);
      return;
    }
    setEmployees(prev => [...prev, newEmp]);
    setAttendances(prev => [...prev, { employeeId: newEmp.id, month: globalMonth, year: globalYear, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 }]);
    setLeaveLedgers(prev => [...prev, { employeeId: newEmp.id, el: { opening: 0, eligible: 1.5, encashed: 0, availed: 0, balance: 1.5 }, sl: { eligible: 1, availed: 0, balance: 1 }, cl: { availed: 0, accumulation: 0, balance: 0 } }]);
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
      setAttendances(prev => [...prev, ...trulyNewEmps.map(e => ({ employeeId: e.id, month: globalMonth, year: globalYear, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 }))]);
      setLeaveLedgers(prev => [...prev, ...trulyNewEmps.map(e => ({ employeeId: e.id, el: { opening: 0, eligible: 1.5, encashed: 0, availed: 0, balance: 1.5 }, sl: { eligible: 1, availed: 0, balance: 1 }, cl: { availed: 0, accumulation: 0, balance: 0 } }))]);
      setAdvanceLedgers(prev => [...prev, ...trulyNewEmps.map(e => ({ employeeId: e.id, opening: 0, totalAdvance: 0, monthlyInstallment: 0, paidAmount: 0, balance: 0, emiCount: 0, manualPayment: 0, recovery: 0 }))]);
      setOTRecords(prev => [...prev, ...trulyNewEmps.map(e => ({ employeeId: e.id, month: globalMonth, year: globalYear, otDays: 0, otHours: 0, otRate: 0, otAmount: 0 }))]);
    }
  };

  const handleAuthLogin = (user: User) => {
    handleLogin(user);
    
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

    if (!companyProfile?.establishmentName || companyProfile.establishmentName === 'Your Establishment Name') {
      setActiveView(View.Settings);
      setSettingsTab('COMPANY');
    } else {
      setTimeout(() => { showAlert('success', 'System Secured', `Welcome back, ${user.name || user.username}. Connected to local database successfully.`); }, 500);
    }
  };


  const handleRegistrationComplete = async (data: { companyProfile: CompanyProfile; statutoryConfig: StatutoryConfig; adminUser: User; }) => {
    setCompanyProfile(data.companyProfile);
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
        showAlert('success', 'System Reset Ready', 'Start Enrolling Employee', () => {});
      }, 800);
    } else {
      setActiveView(View.Settings);
      setSettingsTab('COMPANY');
      setSkipSetupRedirect(false);
      showAlert('success', 'Setup Complete', `BharatPay Pro is now ready for ${data.companyProfile.establishmentName}.`);
    }
  };

  const handleLogoutAction = () => {
    if (activeView === View.Settings && isSettingsDirty) {
      showAlert('warning', 'Unsaved Changes', 'You are about to sign out with unsaved configuration changes. These changes will be lost. Proceed anyway?', () => {
        setIsSettingsDirty(false);
        logout();
        window.location.reload();
      }, () => {}, 'Discard & Sign Out', 'Stay Here');
      return;
    }
    showAlert('confirm', 'Sign Out', 'Select an action to proceed:', () => { 
        logout(); 
        window.location.reload(); 
    }, () => {
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
        window.location.reload();
      }, undefined, 'YES, RESET IDENTITY', undefined, 'CANCEL');
  };

  const toggleFullScreenMode = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else if (document.exitFullscreen) document.exitFullscreen();
  };

  const getFinancialYearLabel = () => {
    const isJanToMar = ['January', 'February', 'March'].includes(globalMonth);
    const startYear = isJanToMar ? globalYear - 1 : globalYear;
    return `FY ${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)} ACTIVE`;
  };

  const effectiveUser = (currentUser || { id: 'setup', name: 'Initial Setup', role: 'Administrator', username: 'setup', password: '', email: '' }) as User;
  const isSettingsAccessible = effectiveUser.role === 'Developer' || effectiveUser.role === 'Administrator';
  const isNavLocked = employees.length === 0;

  if (isAppDirectoryConfigured === null) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={48} /></div>;

  return (
    <div className={`flex h-[100dvh] overflow-hidden bg-[#020617] text-white ${isWin7 ? 'is-win7' : ''}`}>
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
                            <p className="text-slate-400">{licenseStatus.message}</p>
                            <button onClick={() => (window as any).electronAPI?.closeApp()} className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase tracking-widest">Quit Application</button>
                            <button onClick={handleResetLicenseIdentity} className="text-amber-100 text-xs font-bold uppercase tracking-widest hover:underline"><RefreshCw className="inline mr-1" /> Reset Identity</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {!licenseStatus.checked ? (
        <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center z-[1000] space-y-8 animate-in fade-in duration-700">
          <div className="relative">
             <div className="absolute -inset-4 bg-blue-500/20 blur-2xl rounded-full animate-pulse"></div>
             <div className="relative w-36 h-36 rounded-full border-[6px] border-white overflow-hidden shadow-2xl bg-[#020617] flex items-center justify-center">
                <img src="./logo3.png" alt="Startup Logo" className="w-full h-full object-cover" />
             </div>
          </div>
          <div className="flex items-center gap-3 animate-slow-pulse">
             <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_#3b82f6]"></div>
             <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Security Verification Underway Please Wait.....</p>
          </div>
        </div>
      ) : (!getStoredLicense() && (showRegistrationManual || (!isSetupComplete && employees.length === 0))) ? (
        <Registration 
          onComplete={handleRegistrationComplete} 
          onRestore={() => window.location.reload()} 
          showAlert={showAlert} 
          isResetMode={localStorage.getItem('app_is_reset_mode') === 'true'}
        />
      ) : !currentUser ? (
        <Login onLogin={handleAuthLogin} currentLogo={logoUrl} setLogo={handleUpdateLogo} />
      ) : (
        <>
          {showLoginMessage && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <div className="bg-[#1e293b] w-full max-w-lg rounded-2xl border border-blue-500/50 p-8 space-y-6">
                     <h3 className="text-lg font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                        <Megaphone size={20} className="text-amber-500" />
                        Developer Message Board
                     </h3>
                    <div className="space-y-4">
                        {companyProfile.postLoginHeader && (
                            <h4 className={`text-md font-bold text-white uppercase tracking-tight ${
                                companyProfile.postLoginAlignment === 'CENTER' ? 'text-center' : 
                                companyProfile.postLoginAlignment === 'RIGHT' ? 'text-right' : 'text-left'
                            }`}>
                                {companyProfile.postLoginHeader}
                            </h4>
                        )}
                        <p className={`text-slate-200 text-xs leading-relaxed whitespace-pre-wrap ${
                            companyProfile.postLoginAlignment === 'CENTER' ? 'text-center' : 
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
                   {isSidebarOpen && <span className="text-lg font-black"><span className="text-[#FF9933]">Bharat</span><span className="text-white">Pay</span><span className="text-[#34d399]">Pro</span></span>}
                </div>
                {isSidebarOpen && (
                   <div className="mt-0.5 ml-7 animate-in fade-in slide-in-from-left-2 duration-500 flex flex-col gap-0.5">
                      <span className="text-[8px] font-black text-[#FFD700] uppercase tracking-[0.25em] whitespace-nowrap">Indian Payroll Management</span>
                   </div>
                )}
             </div>
             <nav className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
                <NavigationItem view={View.Dashboard} icon={LayoutDashboard} label="Dashboard" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked && activeView !== View.Dashboard} />
                <NavigationItem view={View.Employees} icon={Users} label="Employee Master" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked} />
                <NavigationItem view={View.PayProcess} icon={CalendarClock} label="Process Payroll" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked} />
                <NavigationItem view={View.Reports} icon={FileText} label="Pay Reports" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked} />
                <NavigationItem view={View.Statutory} icon={ShieldCheck} label="Statutory Reports" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked} />
                <NavigationItem view={View.MIS} icon={IndianRupee} label="Management Info (MIS)" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked} />
                <NavigationItem view={View.PFCalculator} icon={Calculator} label="PF ECR Calculator" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked} />
                <NavigationItem view={View.Utilities} icon={Wrench} label="Utilities" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked} />
                <NavigationItem view={View.AI_Assistant} icon={Bot} label="Compliance AI" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked} />
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
                    <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-full border border-slate-700 shadow-xl object-cover" />
                    <div className="flex flex-col">
                       <span className="text-sm font-black text-white tracking-tight">{companyProfile.establishmentName || (BRAND_CONFIG.appName + " " + BRAND_CONFIG.appNameSuffix)}</span>
                       <span className="text-[8px] font-black text-[#FFD700] tracking-widest mt-0.5">
                          {licenseInfo?.isTrial ? "Trial Valid Upto : " : "License Valid Upto : "}{formatExpiryDate(licenseInfo?.expiryDate)}
                       </span>
                    </div>
                 </div>
                 <div className="flex-1 px-4 min-w-[300px] max-w-xl mx-auto">
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
 
                     <div className="flex flex-col items-end gap-0">
                      <div className="px-4 py-1.5 bg-[#020617] border border-emerald-800/60 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.2)] animate-slow-pulse">
                         <span className="text-[10px] font-black text-[#10b981] uppercase tracking-widest flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-[#10b981] rounded-full shadow-[0_0_8px_#10b981]"></div>
                            {getFinancialYearLabel()}
                         </span>
                      </div>
                        <div className="px-3 py-1 bg-slate-900 border border-slate-800/80 rounded-md shadow-sm -mt-1.5 relative z-0">
                           <span className="text-[9px] text-[#FFD700] uppercase tracking-[0.2em] font-black">VERSION {APP_VERSION}</span>
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
                 {activeView === View.Utilities && <Utilities designations={designations} setDesignations={setDesignations} divisions={divisions} setDivisions={setDivisions} branches={branches} setBranches={setBranches} sites={sites} setSites={setSites} showAlert={showAlert} />}
                 {activeView === View.PFCalculator && <PFCalculator employees={employees} payrollHistory={payrollHistory} config={config} companyProfile={companyProfile} month={globalMonth} setMonth={setGlobalMonth} year={globalYear} setYear={setGlobalYear} />}
                 {activeView === View.Settings && isSettingsAccessible && <Settings config={config} setConfig={setConfig} companyProfile={companyProfile} setCompanyProfile={setCompanyProfile} currentLogo={logoUrl} setLogo={handleUpdateLogo} leavePolicy={leavePolicy} setLeavePolicy={setLeavePolicy} onRestore={onRefresh} initialTab={settingsTab} userRole={effectiveUser?.role} currentUser={effectiveUser} isSetupMode={employees.length === 0} onSkipSetupRedirect={() => { setSkipSetupRedirect(true); safeNavigate(View.Dashboard); }} onNuclearReset={handleNuclearReset} onDirtyChange={setIsSettingsDirty} showAlert={showAlert} />}
                 {activeView === View.AI_Assistant && <AIAssistant />}
               </div>
             </main>
          </div>
        </>
      )}

      {showUpdateNotice && (
        <div className="fixed bottom-6 right-6 z-[60] bg-slate-900 border border-blue-500/30 p-6 rounded-xl shadow-2xl max-w-sm animate-in slide-in-from-bottom-5">
            <h4 className="font-bold text-white mb-1">Update Available!</h4>
            <p className="text-slate-400 text-xs mb-4">Version {latestAppVersion} is ready.</p>
            <div className="flex gap-2">
                <button onClick={() => handleUpdateNow(async () => {})} className="flex-1 bg-blue-600 py-2 rounded-lg text-xs font-bold">Update Now</button>
                <button onClick={handleUpdateLater} className="flex-1 bg-slate-800 py-2 rounded-lg text-xs font-bold">Later</button>
            </div>
        </div>
      )}

      {isUpdateDownloading && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center">
            <div className="text-center space-y-4">
                <Loader2 className="animate-spin text-blue-500 mx-auto" size={48} />
                <h3 className="text-xl font-bold">Downloading Update...</h3>
            </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefresh = () => { setRefreshKey(prev => prev + 1); };
  return <PayrollShell key={refreshKey} onRefresh={handleRefresh} />;
};

export default App;
