
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Calculator,
  FileText,
  Settings as SettingsIcon,
  LogOut,
  Bot,
  Menu,
  X,
  ShieldCheck,
  Network,
  UserCircle,
  AlertCircle,
  Loader2,
  Lock,
  Building2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Wrench,
  CalendarClock,
  IndianRupee,
  Megaphone,
  Youtube,
  Maximize,
  Minimize,
  MessageSquare,
  ArrowRight,
  Power,
  RefreshCw,
  Database,
  Info
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
import Registration from './components/Registration';
import AppSetup from './components/AppSetup';
import CustomModal, { ModalType } from './components/Shared/CustomModal';
import {
  validateLicenseStartup,
  getStoredLicense,
  fetchLatestMessages,
  APP_VERSION,
} from './services/licenseService';
import { getBackupFileName } from './services/reportService';

import {
  User,
  View,
  Employee,
  StatutoryConfig,
  CompanyProfile,
  PayrollResult,
  LeavePolicy,
  Attendance,
  LeaveLedger,
  AdvanceLedger,
  FineRecord,
  ArrearBatch
} from './types';
import {
  INITIAL_STATUTORY_CONFIG,
  INITIAL_COMPANY_PROFILE,
  DEFAULT_LEAVE_POLICY,
  BRAND_CONFIG,
  SAMPLE_EMPLOYEES
} from './constants';

const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const NavigationItem = ({ view, icon: Icon, label, activeView, setActiveView, isSidebarOpen, depth = 0, disabled = false }: { view: View, icon: any, label: string, activeView: View, setActiveView: (v: View) => void, isSidebarOpen: boolean, depth?: number, disabled?: boolean }) => (
  <button
    onClick={() => !disabled && setActiveView(view)}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${disabled ? 'opacity-40 cursor-not-allowed grayscale' : ''} ${activeView === view
      ? 'bg-blue-500 text-white shadow-lg'
      : 'text-slate-300 hover:bg-blue-900/50 hover:text-white'
      } ${depth > 0 ? 'ml-2 border-l border-slate-700 pl-4 w-[95%]' : ''}`}
  >
    <Icon size={depth > 0 ? 18 : 20} className={depth > 0 ? "opacity-80" : ""} />
    {isSidebarOpen && <span className={`font-medium ${depth > 0 ? 'text-sm' : ''}`}>{label}</span>}
  </button>
);

const SidebarHeader = ({ title, isSidebarOpen }: { title: string, isSidebarOpen: boolean }) => (
  isSidebarOpen ? <div className="px-4 mt-6 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</div> : <div className="mt-4 mb-2 border-t border-slate-800"></div>
);

const PayrollShell: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  // --- HELPERS ---
  const isVersionHigher = (latest: string, current: string): boolean => {
    try {
      const l = latest.split('.').map(Number);
      const c = current.split('.').map(Number);
      for (let i = 0; i < Math.max(l.length, c.length); i++) {
        const v1 = l[i] || 0;
        const v2 = c[i] || 0;
        if (v1 > v2) return true;
        if (v1 < v2) return false;
      }
      return false;
    } catch (e) { return false; }
  };

  const getDefaultPeriod = () => {
    try {
      const historyData = localStorage.getItem('app_payroll_history');
      const attendanceData = localStorage.getItem('app_attendance');

      const history = historyData ? JSON.parse(historyData) : [];
      const attendance = attendanceData ? JSON.parse(attendanceData) : [];

      const getMonthValue = (m: string | null | undefined, y: number | null | undefined) => {
        if (!m || !y) return 0;
        const idx = monthsArr.indexOf(String(m).trim());
        if (idx === -1) return 0;
        return (Number(y) * 12) + idx;
      };

      let lastLockedVal = getMonthValue('March', 2025);
      if (Array.isArray(history) && history.length > 0) {
        history.filter((h: any) => h.status === 'Finalized').forEach((h: any) => {
          const val = getMonthValue(h.month, h.year);
          if (val > lastLockedVal) lastLockedVal = val;
        });
      }

      let latestDraftVal = -1;
      let latestDraftPeriod = null;

      if (Array.isArray(attendance) && attendance.length > 0) {
        attendance.forEach((a: any) => {
          const val = getMonthValue(a.month, a.year);
          if (val > lastLockedVal) {
            const hasData = (a.presentDays || 0) > 0 || (a.earnedLeave || 0) > 0 || (a.sickLeave || 0) > 0 || (a.casualLeave || 0) > 0 || (a.lopDays || 0) > 0 || (a.encashedDays || 0) > 0;
            const isFinalized = history.some((h: any) => h.month === a.month && h.year === a.year && h.status === 'Finalized');
            if (hasData && !isFinalized) {
              if (val > latestDraftVal) {
                latestDraftVal = val;
                latestDraftPeriod = { month: a.month, year: a.year };
              }
            }
          }
        });
      }

      if (latestDraftPeriod) return latestDraftPeriod;
      const nextVal = lastLockedVal + 1;
      return { month: monthsArr[nextVal % 12], year: Math.floor(nextVal / 12) };
    } catch (e) {
      console.error("Error determining default period:", e);
      return { month: 'April', year: 2025 };
    }
  };

  // --- COMPONENT STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUser = sessionStorage.getItem('app_session_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.role) return parsed;
      }
      return null;
    } catch (e) { return null; }
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem('app_employees');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(() => {
    try {
      return localStorage.getItem('app_setup_complete') === 'true' || employees.length > 0;
    } catch (e) { return false; }
  });

  const [globalMonth, setGlobalMonth] = useState<string>(() => getDefaultPeriod().month);
  const [globalYear, setGlobalYear] = useState<number>(() => getDefaultPeriod().year);

  const [activeView, setActiveView] = useState<View>(View.Dashboard);
  const [isResetting, setIsResetting] = useState(false);
  const [skipSetupRedirect, setSkipSetupRedirect] = useState(false);
  const mainContentRef = useRef<HTMLElement>(null);
  const [settingsTab, setSettingsTab] = useState<'STATUTORY' | 'COMPANY' | 'DATA' | 'DEVELOPER' | 'LICENSE' | 'USERS'>('STATUTORY');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [licenseStatus, setLicenseStatus] = useState<{ checked: boolean; valid: boolean; message: string }>({ checked: false, valid: false, message: '' });
  const [showRegistrationManual, setShowRegistrationManual] = useState(false);
  const [dataSizeLimit, setDataSizeLimit] = useState<number>(() => {
    const license = getStoredLicense();
    return license?.dataSize || 50;
  });

  const [latestAppVersion, setLatestAppVersion] = useState<string | null>(localStorage.getItem('app_latest_version'));
  const [downloadUrl, setDownloadUrl] = useState<string | null>(localStorage.getItem('app_download_url'));
  const [showUpdateNotice, setShowUpdateNotice] = useState(false);
  const [isUpdateDownloading, setIsUpdateDownloading] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(localStorage.getItem('app_update_ready') === 'true');

  useEffect(() => {
    if (latestAppVersion && isVersionHigher(latestAppVersion, APP_VERSION)) {
      if (updateDownloaded) {
        // We have a pending update ready from a previous session
        setAlertConfig({
          isOpen: true,
          type: 'confirm',
          title: 'Update Ready to Install',
          message: `Version ${latestAppVersion} has been downloaded. Would you like to install it now? Your data will be backed up automatically.`,
          confirmLabel: 'Install Now',
          cancelLabel: 'Later',
          onConfirm: handleUpdateNow
        });
      } else {
        setShowUpdateNotice(true);
      }
    }
  }, [latestAppVersion]);

  useEffect(() => {
    // @ts-ignore
    if (window.electronAPI?.onUpdateDownloadComplete) {
      // @ts-ignore
      window.electronAPI.onUpdateDownloadComplete(() => {
        console.log("📥 Background download finished entirely.");
        localStorage.setItem('app_update_ready', 'true');
        setUpdateDownloaded(true);
        setIsUpdateDownloading(false);
        setAlertConfig({
          isOpen: true,
          type: 'confirm',
          title: 'Update Download Complete',
          message: `The background update has successfully downloaded! Would you like to restart and install it now?`,
          confirmLabel: 'Install Now',
          cancelLabel: 'Later',
          onConfirm: handleUpdateNow
        });
      });
    }
  }, []);

  const [isAppDirectoryConfigured, setIsAppDirectoryConfigured] = useState<boolean | null>(null);

  // --- LICENSE ENFORCEMENT ---
  const verifyLicense = async () => {
    const result = await validateLicenseStartup();
    if (!result.valid) {
      setLicenseStatus({ checked: true, valid: false, message: result.message || 'License Verification Failed' });
    } else {
      const license = getStoredLicense();
      if (license?.dataSize) {
        setDataSizeLimit(license.dataSize);
      }
      setLicenseStatus({ checked: true, valid: true, message: '' });

      // Initial fetch of messages if license is valid
      checkNewMessages();
    }
  };

  // --- INITIAL CHECKS ---
  useEffect(() => {
    const initApp = async () => {
      // 1. Check App Storage Configuration
      // @ts-ignore
      if (window.electronAPI && window.electronAPI.getAppDirectory) {
        // @ts-ignore
        const dir = await window.electronAPI.getAppDirectory();
        setIsAppDirectoryConfigured(!!dir);

        if (dir) {
          // AUTO-RECOVERY: If Chromium wiped localStorage, rescue it from SQLite
          const licenseRes = await (window as any).electronAPI.dbGet('app_license_secure');

          if (licenseRes.success && licenseRes.data && !localStorage.getItem('app_license_secure')) {
            console.log("RECOVERY: LocalStorage empty but SQLite contains data. Restoring...");
            const keysToRecover = [
              'app_license_secure', 'app_data_size', 'app_machine_id', 'app_setup_complete',
              'app_users', 'app_master_designations', 'app_master_divisions', 'app_master_branches',
              'app_master_sites', 'app_employees', 'app_config', 'app_company_profile',
              'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 'app_payroll_history',
              'app_fines', 'app_leave_policy', 'app_arrear_history', 'app_logo'
            ];
            for (const k of keysToRecover) {
              const res = await (window as any).electronAPI.dbGet(k);
              if (res.success && res.data !== null && res.data !== undefined) {
                const isStringVal = typeof res.data === 'string' && (k === 'app_license_secure' || k === 'app_machine_id' || k === 'app_setup_complete' || k === 'app_data_size');
                localStorage.setItem(k, isStringVal ? res.data : JSON.stringify(res.data));
              }
            }
            window.location.reload();
            return;
          }
        } else {
          // AUTO-PATH DETECTION: If not configured, scan for BPP_APP folder
          const searchRes = await (window as any).electronAPI.findBPPApp();
          if (searchRes.success && searchRes.path) {
            console.log(`RECOVERY: Auto-detected app directory at ${searchRes.path}. Initializing...`);
            await (window as any).electronAPI.initializeAppDirectory(searchRes.path);
            window.location.reload();
            return;
          }
        }
      } else {
        setIsAppDirectoryConfigured(true); // Web mode or Non-Electron
      }

      // 2. Verify License
      await verifyLicense();
    };

    initApp();

    // Check version from local storage initially
    const v = localStorage.getItem('app_latest_version');
    if (v && v !== APP_VERSION) {
      setLatestAppVersion(v);
      setDownloadUrl(localStorage.getItem('app_download_url'));
    }

    // Setup periodic message check (every 1 hour)
    const interval = setInterval(checkNewMessages, 3600000);
    return () => clearInterval(interval);
  }, []);

  const checkNewMessages = async () => {
    const updates = await fetchLatestMessages();
    if (updates) {
      setCompanyProfile(prev => ({
        ...prev,
        flashNews: updates.scrollNews,
        postLoginMessage: updates.statutory
      }));

      const v = localStorage.getItem('app_latest_version');
      if (v) {
        setLatestAppVersion(v);
        setDownloadUrl(localStorage.getItem('app_download_url'));
      }
    }
  };
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    message: string | React.ReactNode;
    onConfirm?: () => void;
    onSecondaryConfirm?: () => void;
    confirmLabel?: string;
    secondaryConfirmLabel?: string;
    cancelLabel?: string;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  const showAlert = (
    type: ModalType,
    title: string,
    message: string | React.ReactNode,
    onConfirm?: () => void,
    onSecondaryConfirm?: () => void,
    confirmLabel?: string,
    secondaryConfirmLabel?: string,
    cancelLabel?: string
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
      cancelLabel
    });
  };

  const handleUpdateNow = async () => {
    setAlertConfig(prev => ({ ...prev, isOpen: false }));
    // @ts-ignore
    if (window.electronAPI) {
      setIsUpdateDownloading(true);

      // 1. Download if not already ready
      if (!updateDownloaded) {
        const url = downloadUrl || localStorage.getItem('app_download_url');
        if (!url) return setIsUpdateDownloading(false);

        // --- NEW: Download with 10s Timeout for UI responsiveness ---
        let downloadTimedOut = false;
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => {
            downloadTimedOut = true;
            reject(new Error("TIMEOUT"));
          }, 10000)
        );

        try {
          await Promise.race([
            (window as any).electronAPI.startUpdateDownload(url),
            timeoutPromise
          ]);
        } catch (err: any) {
          if (err.message === "TIMEOUT") {
            console.log("UPDATE: Download taking time. Backgrounding...");
            setIsUpdateDownloading(false);
            showAlert('info', 'Updating in Background', 'The download is taking a few moments. We will continue in the background. You can keep using the application, and we will prompt you once it is ready.');
            return; // Exit and let it run in background (the electron main process keeps downloading)
          } else {
            setIsUpdateDownloading(false);
            return setAlertConfig({
              isOpen: true,
              type: 'error',
              title: 'Download Failed',
              message: 'Failed to download the update. Please check your internet connection.'
            });
          }
        }
      }

      // 2. Persist critical storage to SQLite before update
      const keysToPersist = ['app_users', 'app_license_secure', 'app_data_size', 'app_employees', 'app_setup_complete'];
      for (const k of keysToPersist) {
        const val = localStorage.getItem(k);
        if (val) {
          try {
            await (window as any).electronAPI.dbSet(k, val.startsWith('{') || val.startsWith('[') ? JSON.parse(val) : val);
          } catch (e) { }
        }
      }

      // 3. Trigger Backup & Install
      localStorage.removeItem('app_update_ready');
      await (window as any).electronAPI.backupAndInstall();
    }
  };

  const handleUpdateLater = async () => {
    setShowUpdateNotice(false);
    // @ts-ignore
    if (window.electronAPI && !updateDownloaded) {
      const url = downloadUrl || localStorage.getItem('app_download_url');
      if (url) {
        console.log("📥 Background update download started...");
        const res = await (window as any).electronAPI.startUpdateDownload(url);
        if (res.success) {
          localStorage.setItem('app_update_ready', 'true');
          setUpdateDownloaded(true);
          console.log("✅ Background update download complete. Will prompt on next login.");
        }
      }
    }
  };


  const [config, setConfig] = useState<StatutoryConfig>(() => {
    try {
      const saved = localStorage.getItem('app_config');
      if (!saved) return INITIAL_STATUTORY_CONFIG;
      let parsed = INITIAL_STATUTORY_CONFIG;
      try {
        const raw = JSON.parse(saved);
        if (raw && typeof raw === 'object') parsed = raw;
      } catch (e) { }
      return {
        ...INITIAL_STATUTORY_CONFIG,
        ...parsed,
        higherContributionComponents: { ...INITIAL_STATUTORY_CONFIG.higherContributionComponents, ...(parsed.higherContributionComponents || {}) },
        leaveWagesComponents: { ...INITIAL_STATUTORY_CONFIG.leaveWagesComponents, ...(parsed.leaveWagesComponents || {}) }
      };
    } catch (e) { return INITIAL_STATUTORY_CONFIG; }
  });

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => {
    try {
      const saved = localStorage.getItem('app_company_profile');
      if (!saved) return INITIAL_COMPANY_PROFILE;
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return { ...INITIAL_COMPANY_PROFILE, ...parsed };
      } catch (e) { }
      return INITIAL_COMPANY_PROFILE;
    } catch (e) { return INITIAL_COMPANY_PROFILE; }
  });

  const [logoUrl, setLogoUrl] = useState<string>(() => {
    try {
      const savedLogo = localStorage.getItem('app_logo');
      if (savedLogo) {
        if (savedLogo.startsWith('"')) {
          try { return JSON.parse(savedLogo); } catch (e) { return savedLogo; }
        }
        return savedLogo;
      }
      return BRAND_CONFIG.logoUrl;
    } catch (e) { return BRAND_CONFIG.logoUrl; }
  });

  const [leavePolicy, setLeavePolicy] = useState<LeavePolicy>(() => {
    try {
      const saved = localStorage.getItem('app_leave_policy');
      if (!saved) return DEFAULT_LEAVE_POLICY;
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            el: { ...DEFAULT_LEAVE_POLICY.el, ...(parsed.el || {}) },
            sl: { ...DEFAULT_LEAVE_POLICY.sl, ...(parsed.sl || {}) },
            cl: { ...DEFAULT_LEAVE_POLICY.cl, ...(parsed.cl || {}) }
          };
        }
      } catch (e) { }
      return DEFAULT_LEAVE_POLICY;
    } catch (e) { return DEFAULT_LEAVE_POLICY; }
  });

  // Masters
  const [designations, setDesignations] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('app_master_designations') || '[]').length ? JSON.parse(localStorage.getItem('app_master_designations')!) : ['Software Engineer', 'Project Manager', 'HR Manager', 'Accounts Executive', 'Peon']; } catch (e) { return ['Software Engineer', 'Project Manager', 'HR Manager', 'Accounts Executive', 'Peon']; }
  });
  const [divisions, setDivisions] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('app_master_divisions') || '[]').length ? JSON.parse(localStorage.getItem('app_master_divisions')!) : ['Head Office', 'Manufacturing', 'Sales', 'Marketing', 'Engineering']; } catch (e) { return ['Head Office', 'Manufacturing', 'Sales', 'Marketing', 'Engineering']; }
  });
  const [branches, setBranches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('app_master_branches') || '[]').length ? JSON.parse(localStorage.getItem('app_master_branches')!) : ['Chennai', 'New Delhi', 'Mumbai', 'Bangalore']; } catch (e) { return ['Chennai', 'New Delhi', 'Mumbai', 'Bangalore']; }
  });
  const [sites, setSites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('app_master_sites') || '[]').length ? JSON.parse(localStorage.getItem('app_master_sites')!) : ['Main Plant', 'Warehouse A', 'IT Park Office', 'Site-01']; } catch (e) { return ['Main Plant', 'Warehouse A', 'IT Park Office', 'Site-01']; }
  });

  const [attendances, setAttendances] = useState<Attendance[]>(() => {
    try {
      const saved = localStorage.getItem('app_attendance');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [leaveLedgers, setLeaveLedgers] = useState<LeaveLedger[]>(() => {
    try {
      const saved = localStorage.getItem('app_leave_ledgers');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [advanceLedgers, setAdvanceLedgers] = useState<AdvanceLedger[]>(() => {
    try {
      const saved = localStorage.getItem('app_advance_ledgers');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [payrollHistory, setPayrollHistory] = useState<PayrollResult[]>(() => {
    try {
      const saved = localStorage.getItem('app_payroll_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [fines, setFines] = useState<FineRecord[]>(() => {
    try {
      const saved = localStorage.getItem('app_fines');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [arrearHistory, setArrearHistory] = useState<ArrearBatch[]>(() => {
    try {
      const saved = localStorage.getItem('app_arrear_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  // --- SAFE STORAGE ---
  const safeSave = (key: string, data: any) => {
    if (isResetting) return;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e: any) {
      console.error(`Failed to save ${key}:`, e);
      if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
        showAlert('warning', 'Storage Limit Exceeded', "Your browser's local storage is full. Please remove large images or use the 'Factory Reset' in Settings to clear old data.");
      }
    }
  };

  // --- PERSISTENCE ---
  useEffect(() => {
    const syncToDB = async () => {
      // @ts-ignore
      if (window.electronAPI) {
        // Fetch current users from localStorage since currentUser might just be the active session, 
        // but we need to backup all configured users.
        const allUsersRaw = localStorage.getItem('app_users');
        const allUsers = allUsersRaw ? JSON.parse(allUsersRaw) : [];

        const keys = [
          { k: 'app_employees', v: employees },
          { k: 'app_config', v: config },
          { k: 'app_company_profile', v: companyProfile },
          { k: 'app_attendance', v: attendances },
          { k: 'app_leave_ledgers', v: leaveLedgers },
          { k: 'app_advance_ledgers', v: advanceLedgers },
          { k: 'app_payroll_history', v: payrollHistory },
          { k: 'app_fines', v: fines },
          { k: 'app_leave_policy', v: leavePolicy },
          { k: 'app_arrear_history', v: arrearHistory },
          { k: 'app_logo', v: logoUrl },
          { k: 'app_master_designations', v: designations },
          { k: 'app_master_divisions', v: divisions },
          { k: 'app_master_branches', v: branches },
          { k: 'app_master_sites', v: sites },
          { k: 'app_setup_complete', v: isSetupComplete ? 'true' : 'false' },
          { k: 'app_users', v: allUsers }
        ];
        for (const item of keys) {
          // @ts-ignore
          window.electronAPI.dbSet(item.k, item.v);
        }
      }
    };
    syncToDB();
  }, [
    employees, config, companyProfile, attendances, leaveLedgers, advanceLedgers,
    payrollHistory, fines, leavePolicy, arrearHistory, logoUrl,
    designations, divisions, branches, sites, isSetupComplete, currentUser
  ]);

  useEffect(() => { safeSave('app_employees', employees); }, [employees]);
  useEffect(() => { safeSave('app_config', config); }, [config]);
  useEffect(() => { safeSave('app_company_profile', companyProfile); }, [companyProfile]);
  useEffect(() => { safeSave('app_attendance', attendances); }, [attendances]);
  useEffect(() => { safeSave('app_leave_ledgers', leaveLedgers); }, [leaveLedgers]);
  useEffect(() => { safeSave('app_advance_ledgers', advanceLedgers); }, [advanceLedgers]);
  useEffect(() => { safeSave('app_payroll_history', payrollHistory); }, [payrollHistory]);
  useEffect(() => { safeSave('app_leave_policy', leavePolicy); }, [leavePolicy]);
  useEffect(() => { safeSave('app_master_designations', designations); }, [designations]);
  useEffect(() => { safeSave('app_master_divisions', divisions); }, [divisions]);
  useEffect(() => { safeSave('app_master_branches', branches); }, [branches]);
  useEffect(() => { safeSave('app_master_sites', sites); }, [sites]);
  useEffect(() => { safeSave('app_fines', fines); }, [fines]);
  useEffect(() => { safeSave('app_arrear_history', arrearHistory); }, [arrearHistory]);

  useLayoutEffect(() => {
    if (mainContentRef.current) mainContentRef.current.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeView, currentUser]);

  useEffect(() => {
    // Only force Settings view if we have no employees and NOT already in Settings and not skipped
    if (employees.length === 0 && activeView !== View.Settings && !skipSetupRedirect) {
      setActiveView(View.Settings);
      setSettingsTab('DATA');
    }
  }, [employees.length, activeView, isSetupComplete, skipSetupRedirect]);

  useEffect(() => {
    const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  useEffect(() => {
    if (currentUser && companyProfile.postLoginMessage && companyProfile.postLoginMessage.trim() !== '') {
      setShowLoginMessage(true);
    }
  }, [currentUser]);

  // --- HANDLERS ---
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

    if (remainingSpace <= 0) {
      showAlert('warning', 'Employee Limit reached', "Cannot import more employees. Limit reached.");
      return;
    }

    const availableEmps = newEmps.slice(0, remainingSpace);
    if (availableEmps.length < newEmps.length) {
      showAlert('info', 'Partial Import', `Only ${availableEmps.length} out of ${newEmps.length} employees imported due to license limits.`);
    }

    const currentIds = new Set(employees.map(e => e.id));
    const trulyNewEmps = availableEmps.filter(e => !currentIds.has(e.id));
    setEmployees(curr => {
      const empMap = new Map<string, Employee>();
      curr.forEach(e => empMap.set(e.id, e));
      availableEmps.forEach(newEmp => {
        const existing = empMap.get(newEmp.id);
        if (existing) {
          empMap.set(newEmp.id, { ...newEmp, photoUrl: existing.photoUrl, serviceRecords: [...existing.serviceRecords, ...newEmp.serviceRecords] });
        } else { empMap.set(newEmp.id, newEmp); }
      });
      return Array.from(empMap.values());
    });
    if (trulyNewEmps.length > 0) {
      setAttendances(prev => [...prev, ...trulyNewEmps.map(e => ({ employeeId: e.id, month: globalMonth, year: globalYear, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 }))]);
      setLeaveLedgers(prev => [...prev, ...trulyNewEmps.map(e => ({ employeeId: e.id, el: { opening: 0, eligible: 1.5, encashed: 0, availed: 0, balance: 1.5 }, sl: { eligible: 1, availed: 0, balance: 1 }, cl: { availed: 0, accumulation: 0, balance: 0 } }))]);
      setAdvanceLedgers(prev => [...prev, ...trulyNewEmps.map(e => ({ employeeId: e.id, opening: 0, totalAdvance: 0, monthlyInstallment: 0, paidAmount: 0, balance: 0, emiCount: 0, manualPayment: 0, recovery: 0 }))]);
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('app_session_user', JSON.stringify(user));

    // Redirect to Configuration if profile is empty/default
    if (!companyProfile?.establishmentName || companyProfile.establishmentName === 'Your Establishment Name' || companyProfile.establishmentName === 'Your Name' || companyProfile.establishmentName === 'Your Name - as mentioned in App request mail') {
      setActiveView(View.Settings);
      setSettingsTab('COMPANY');
    } else {
      setTimeout(() => {
        showAlert('success', 'System Secured', `Welcome back, ${user.name || user.username}. Connected to local database successfully.`);
      }, 500);
    }
  };

  const handleRegistrationComplete = async (data: {
    companyProfile: CompanyProfile;
    statutoryConfig: StatutoryConfig;
    adminUser: User;
  }) => {
    setCompanyProfile(data.companyProfile);
    setConfig(data.statutoryConfig);

    // Save the admin user
    const savedUsersRaw = localStorage.getItem('app_users');
    let savedUsers: User[] = savedUsersRaw ? JSON.parse(savedUsersRaw) : [];

    // Add or Update admin
    const adminIdx = savedUsers.findIndex(u => u.username === data.adminUser.username);
    if (adminIdx >= 0) {
      savedUsers[adminIdx] = data.adminUser;
    } else {
      savedUsers.push(data.adminUser);
    }

    localStorage.setItem('app_users', JSON.stringify(savedUsers));
    localStorage.setItem('app_setup_complete', 'true');

    // Sync to SQLite
    // @ts-ignore
    if (window.electronAPI) {
      // @ts-ignore
      window.electronAPI.dbSet('app_users', savedUsers);
      // @ts-ignore
      window.electronAPI.dbSet('app_setup_complete', 'true');
    }

    // Re-verify the license FIRST so validity becomes true before the Registration disappears
    await verifyLicense();

    setIsSetupComplete(true);
    setShowRegistrationManual(false);

    // Automatically log the user in to bypass the Login screen.
    // Ensure this mirrors `handleLogin` behavior for a unified experience.
    setCurrentUser(data.adminUser);
    sessionStorage.setItem('app_session_user', JSON.stringify(data.adminUser));

    // Force redirect to Settings since they did a Fresh Setup with default values
    setActiveView(View.Settings);
    setSettingsTab('COMPANY');
    setSkipSetupRedirect(false);

    showAlert('success', 'Setup Complete', `BharatPay Pro is now ready for ${data.companyProfile.establishmentName}. You will now be redirected to the Configuration panel.`);
  };

  const handleLogout = () => {
    const isElectron = !!(window as any).electronAPI;

    showAlert(
      'confirm',
      'Sign Out',
      'Select an action to proceed:',
      () => {
        // Re-login session
        sessionStorage.removeItem('app_session_user');
        window.location.reload();
      },
      () => {
        console.log("LOGOUT: Quit requested. Checking electronAPI...");
        if ((window as any).electronAPI) {
          console.log("LOGOUT: Calling electronAPI.closeApp()");
          (window as any).electronAPI.closeApp();
        } else {
          console.error("LOGOUT: electronAPI is MISSING! Attempting browser window close.");
          // Fallback for browser: just clear session or close window if possible
          sessionStorage.removeItem('app_session_user');
          window.close();
          // If window.close() fails (as it often does in modern browsers unless opened by script),
          // we at least logged out.
          window.location.reload();
        }
      },
      'Re-login',
      'Quit Application',
      'Cancel'
    );
  };

  const handleDashboardNavigation = (view: View, tab?: string) => {
    setActiveView(view);
    if (view === View.Settings) setSettingsTab(tab as any || 'STATUTORY');
  };

  const handleRollover = async (updatedHistory?: PayrollResult[]) => {
    try {
      // --- NEW: AUTOMATIC BACKUP (AC - After Confirmation) ---
      // This backup is taken just before advancing the month

      // Explicit 3-second delay to guarantee state separation and show progress
      showAlert('loading', 'Finalizing Data', "Creating 'After Confirmation' snapshot. Please wait 3 seconds...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      const backupFileName = getBackupFileName('AC', companyProfile, globalMonth, globalYear);
      // @ts-ignore
      const backupRes = await window.electronAPI.createDataBackup(backupFileName);

      const currentIdx = monthsArr.indexOf(globalMonth);
      let nextMonth = globalMonth;
      let nextYear = globalYear;
      if (currentIdx === 11) { nextMonth = monthsArr[0]; nextYear = globalYear + 1; }
      else { nextMonth = monthsArr[currentIdx + 1]; }

      setAttendances(prev => prev.map(a => a.month === globalMonth && a.year === globalYear ? { ...a, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0, encashedDays: 0 } : a));
      setAdvanceLedgers(prev => {
        const currentHistory = updatedHistory || payrollHistory;
        const finalizedResults = currentHistory.filter(r => r.month === globalMonth && r.year === globalYear && r.status === 'Finalized');
        return prev.map(a => {
          const payrollResult = finalizedResults.find(r => r.employeeId === a.employeeId);
          const actualRecovered = payrollResult ? (payrollResult.deductions?.advanceRecovery ?? 0) : 0;
          const carryOpening = Math.max(0, (a.opening || 0) + (a.totalAdvance || 0) - actualRecovered);
          const nextEmiCount = carryOpening > 0 ? (a.emiCount || 0) : 0;
          let nextRecovery = nextEmiCount > 0 ? Math.min(Math.round(carryOpening / nextEmiCount), carryOpening) : 0;
          return { ...a, opening: carryOpening, totalAdvance: 0, manualPayment: 0, emiCount: nextEmiCount, recovery: nextRecovery, balance: Math.max(0, carryOpening - nextRecovery) };
        });
      });
      setFines(prev => prev.filter(f => !(f.month === globalMonth && f.year === globalYear)));
      setGlobalMonth(nextMonth);
      setGlobalYear(nextYear);

      // Show success notification for AC backup
      if (backupRes.success) {
        showAlert('success', 'Next Month Initialized', (
          <div className="space-y-2 text-left">
            <p>System advanced to <b>{nextMonth} {nextYear}</b>.</p>
            <div className="p-2 bg-indigo-900/20 border border-indigo-500/30 rounded-lg">
              <p className="text-[11px] text-indigo-400 font-bold mb-1">✔ Automatic Backup Created (After Confirmation)</p>
              <p className="text-[10px] text-slate-400 font-mono">{backupFileName}.enc</p>
            </div>
            <p className="text-[10px] text-slate-400 italic">The backup folder will open for your reference.</p>
          </div>
        ) as any, () => {
          if (backupRes.path && (window as any).electronAPI) {
            (window as any).electronAPI.openItemLocation(backupRes.path);
          }
        });
      } else {
        showAlert('warning', 'Rollover Complete (with Backup Warning)', `System advanced to ${nextMonth} ${nextYear}, but the automatic 'After Confirmation' backup failed: ${backupRes.error || 'Unknown error'}.`);
      }
    } catch (e: any) {
      showAlert('error', 'Rollover Failed', `Critical error during month initialization: ${e.message}`);
    }
  };

  const handleViewChange = (view: View) => {
    if (employees.length === 0 && !skipSetupRedirect && view !== View.Settings) {
      showAlert('info', 'Action Required', 'Company Profile & Statutory Compliance pre-exist. Please choose "START AFRESH" or "RESTORE BACKUP" in the Configuration section before accessing other functions.');
      return;
    }
    setActiveView(view);
  };

  const handleNuclearReset = async () => {
    setIsResetting(true);
    localStorage.clear();

    // Wipe electron SQLite database to prevent auto-recovery from resurrecting the app
    if ((window as any).electronAPI && (window as any).electronAPI.dbDelete) {
      const keysToWipe = [
        'app_license_secure', 'app_data_size', 'app_machine_id', 'app_setup_complete',
        'app_users', 'app_master_designations', 'app_master_divisions', 'app_master_branches',
        'app_master_sites', 'app_employees', 'app_config', 'app_company_profile',
        'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 'app_payroll_history',
        'app_fines', 'app_leave_policy', 'app_arrear_history', 'app_logo'
      ];
      for (const k of keysToWipe) {
        try {
          await (window as any).electronAPI.dbDelete(k);
        } catch (e) {
          console.error(`Error deleting ${k} from db`, e);
        }
      }
    }

    // Reset key states locally to force UI update
    setEmployees([]);
    setIsSetupComplete(false);
    setCurrentUser(null);

    showAlert('success', 'Factory Reset Complete', 'All system data has been wiped. The application will now restart.', () => {
      window.location.href = window.location.href.split('#')[0];
    });
  };

  const handleResetLicense = async () => {
    showAlert(
      'danger',
      'ARE YOU SURE?',
      'This will clear the current license and reset system identity. You will need to re-register.\n\nYour Data (Employees, Payroll, etc.) will NOT be touched.',
      async () => {
        localStorage.removeItem('app_license_secure');
        localStorage.removeItem('app_license');
        localStorage.removeItem('app_machine_id');

        // Also clear from persistent SQLite store
        if ((window as any).electronAPI) {
          await (window as any).electronAPI.dbDelete('app_license_secure');
          await (window as any).electronAPI.dbDelete('app_license');
          await (window as any).electronAPI.dbDelete('app_machine_id');
        }

        window.location.reload();
      },
      undefined,
      'YES, RESET IDENTITY',
      undefined,
      'CANCEL'
    );
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else if (document.exitFullscreen) document.exitFullscreen();
  };

  // --- DERIVED ---
  const getFinancialYearLabel = () => {
    const isJanToMar = ['January', 'February', 'March'].includes(globalMonth);
    const startYear = isJanToMar ? globalYear - 1 : globalYear;
    return `FY ${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)} ACTIVE`;
  };

  const effectiveUser = (currentUser || { id: 'setup', name: 'Initial Setup', role: 'Administrator', username: 'setup', password: '', email: '' }) as User;
  const isSettingsAccessible = effectiveUser.role === 'Developer' || effectiveUser.role === 'Administrator';

  const isNavLocked = employees.length === 0 && !skipSetupRedirect;

  // --- RENDER ---
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#020617] text-white">
      <CustomModal
        isOpen={alertConfig.isOpen}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        onConfirm={alertConfig.onConfirm}
        onSecondaryConfirm={alertConfig.onSecondaryConfirm}
        confirmLabel={alertConfig.confirmLabel}
        secondaryConfirmLabel={alertConfig.secondaryConfirmLabel}
        cancelLabel={alertConfig.cancelLabel}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {/* --- RENDER HELPERS --- */}
      {isAppDirectoryConfigured === null && (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={48} />
        </div>
      )}

      {isAppDirectoryConfigured === false && (
        <AppSetup onComplete={() => setIsAppDirectoryConfigured(true)} />
      )}

      {/* --- STARTUP LICENSE LOCK --- */}
      {licenseStatus.checked && !licenseStatus.valid && !showRegistrationManual && isAppDirectoryConfigured && (
        <div className="fixed inset-0 z-[500] bg-[#020617] flex items-center justify-center p-2 md:p-4 overflow-hidden">
          <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[100px]"></div>
          </div>

          <div className="w-full max-w-6xl relative z-10 bg-[#1e293b] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row md:h-[min(800px,90vh)]">
            <div className="md:w-5/12 bg-[#0f172a] p-8 md:p-10 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-800 text-center relative overflow-hidden group shrink-0">
              <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
              <div className="relative z-10 flex flex-col items-center gap-8">
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-tr from-blue-600 to-emerald-600 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
                  <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-white shadow-2xl p-[6px] overflow-hidden border-4 border-[#1e293b] transform group-hover:scale-105 transition-transform duration-500">
                    <img src={BRAND_CONFIG.logoUrl} alt={BRAND_CONFIG.companyName} className="w-full h-full object-cover rounded-full" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full mb-2">
                      <IndianRupee size={16} className="text-[#FF9933]" />
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Enterprise Payroll Solutions</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter leading-none">
                      <span className="text-[#FF9933] drop-shadow-sm">Bharat</span>
                      <span className="text-white drop-shadow-md">Pay</span>
                      <span className="text-[#4ADE80]">{BRAND_CONFIG.appNameSuffix}</span>
                    </h1>
                  </div>
                </div>
                <div className="pt-4 flex flex-col items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase opacity-60">Architected & Engineered by</span>
                  <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-900/50 border border-slate-800 rounded-2xl">
                    <span className="text-sm font-black text-[#FF9933] tracking-wide">{BRAND_CONFIG.companyName}</span>
                  </div>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">{BRAND_CONFIG.tagline}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 p-10 md:p-16 flex flex-col justify-center items-center text-center bg-[#1e293b] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
              <div className="relative z-10 w-full max-w-sm space-y-8">
                {!getStoredLicense() ? (
                  <>
                    <div className="space-y-4">
                      <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center text-amber-500 border border-amber-500/20 mx-auto transform rotate-3">
                        <ShieldCheck size={40} strokeWidth={1.5} />
                      </div>
                      <h2 className="text-3xl font-black text-white tracking-tight uppercase">System Initialization</h2>
                      <p className="text-slate-400 text-sm leading-relaxed">No trial or active license found. Please register to begin.</p>
                    </div>
                    <div className="space-y-4 pt-4">
                      <button onClick={() => setShowRegistrationManual(true)} className="w-full py-4 bg-gradient-to-r from-[#FF9933] to-[#e68a2e] text-white font-black rounded-xl shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3">
                        First Time Registration <ArrowRight size={20} />
                      </button>
                      <button onClick={() => (window as any).electronAPI?.closeApp()} className="w-full py-3 bg-slate-800/50 hover:bg-red-600/10 text-red-500 font-bold rounded-xl border border-slate-700 hover:border-red-500/30 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                        <Power size={14} /> Quit Application
                      </button>
                      <div className="pt-4 border-t border-slate-800">
                        <button
                          onClick={handleResetLicense}
                          className="w-full py-2.5 text-slate-500 hover:text-amber-500 transition-all uppercase tracking-widest text-[9px] font-black flex items-center justify-center gap-2"
                        >
                          <Database size={12} /> Emergency Identity Reset
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-500 border border-red-500/20 mx-auto animate-pulse">
                        <Lock size={40} strokeWidth={1.5} />
                      </div>
                      <h2 className="text-3xl font-black text-white tracking-tight uppercase">System Locked</h2>
                      <p className="text-slate-400 text-sm leading-relaxed">{licenseStatus.message}</p>
                      <div className="mt-4 p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                        <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest break-all">HWID: {getStoredLicense()?.machineId || 'UNAUTHORIZED'}</p>
                      </div>
                    </div>
                    <div className="pt-6 space-y-4">
                      <button onClick={() => (window as any).electronAPI?.closeApp()} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-xl shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-2">
                        <Power size={18} /> Quit Application
                      </button>
                      <button onClick={handleResetLicense} className="w-full py-3 bg-slate-800/50 hover:bg-amber-600/10 text-amber-500 font-bold rounded-xl border border-slate-700 hover:border-amber-500/30 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                        <RefreshCw size={14} /> Reset License & Identity
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MAIN FLOW --- */}
      {!licenseStatus.checked ? (
        <div className="fixed inset-0 bg-[#020617] flex items-center justify-center z-[1000]">
          <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
            <div className="relative w-24 h-24 bg-transparent rounded-full shadow-2xl border-4 border-white overflow-hidden">
              <img src={BRAND_CONFIG.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] animate-pulse">Security Verification Underway Please Wait.....</span>
            </div>
          </div>
        </div>
      ) : (!getStoredLicense() && (showRegistrationManual || (!isSetupComplete && employees.length === 0))) ? (
        <Registration onComplete={handleRegistrationComplete} onRestore={() => window.location.reload()} showAlert={showAlert} />
      ) : !currentUser ? (
        <Login onLogin={handleLogin} currentLogo={logoUrl} setLogo={handleUpdateLogo} />
      ) : (
        <>
          {showLoginMessage && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-[#1e293b] w-full max-w-lg rounded-2xl border border-blue-500/50 shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
                {/* Premium Header */}
                <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 p-5 border-b border-blue-500/30 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                        <MessageSquare className="text-blue-400" size={20} />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] opacity-80">Message From</h3>
                        <h4 className="text-lg font-black text-white tracking-tight">System Administration</h4>
                      </div>
                    </div>
                    <button onClick={() => setShowLoginMessage(false)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all" title="Close">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Content Area */}
                <div className="p-8 bg-slate-900/40 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl mt-1">
                      <Info className="text-blue-400/60" size={24} />
                    </div>
                    <div className="space-y-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Authorized Notification</p>
                      <div className="text-sm text-slate-200 leading-relaxed font-medium whitespace-pre-wrap selection:bg-blue-500/30">
                        {companyProfile.postLoginMessage}
                      </div>
                      <div className="h-px w-full bg-gradient-to-r from-blue-500/20 to-transparent pt-[1px]"></div>
                      <p className="text-[9px] text-slate-500 italic font-medium italic">Sent: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-[#1e293b] border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => setShowLoginMessage(false)}
                    className="group relative px-8 py-2.5 overflow-hidden rounded-xl bg-blue-600 text-white font-black text-xs uppercase tracking-[0.15em] shadow-lg shadow-blue-900/40 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <span className="relative z-10">Acknowledge & Continue</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
                  </button>
                </div>
              </div>
            </div>
          )}


          <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-[#0f172a] border-r border-slate-800 flex flex-col`}>
            <div className="p-6 flex items-center gap-3 border-b border-slate-800">
              <div className="bg-[#4169E1] p-1.5 rounded-lg text-white"><IndianRupee size={18} className="text-[#FF9933]" /></div>
              {isSidebarOpen && <span className="text-lg font-black"><span className="text-[#FF9933]">Bharat</span>Pay<span className="text-[#4ADE80]">Pro</span></span>}
            </div>
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
              <NavigationItem view={View.Dashboard} icon={LayoutDashboard} label="Dashboard" activeView={activeView} setActiveView={handleViewChange} isSidebarOpen={isSidebarOpen} disabled={isNavLocked && activeView !== View.Dashboard} />
              <NavigationItem view={View.Employees} icon={Users} label="Employee Master" activeView={activeView} setActiveView={handleViewChange} isSidebarOpen={isSidebarOpen} disabled={isNavLocked} />
              <SidebarHeader title="Pay Process" isSidebarOpen={isSidebarOpen} />
              <NavigationItem view={View.PayProcess} icon={CalendarClock} label="Process Payroll" activeView={activeView} setActiveView={handleViewChange} isSidebarOpen={isSidebarOpen} disabled={isNavLocked} />
              <SidebarHeader title="Analytics" isSidebarOpen={isSidebarOpen} />
              <NavigationItem view={View.Reports} icon={FileText} label="Pay Reports" activeView={activeView} setActiveView={handleViewChange} isSidebarOpen={isSidebarOpen} disabled={isNavLocked} />
              <NavigationItem view={View.Statutory} icon={ShieldCheck} label="Statutory Reports" activeView={activeView} setActiveView={handleViewChange} isSidebarOpen={isSidebarOpen} disabled={isNavLocked} />
              <NavigationItem view={View.PFCalculator} icon={Calculator} label="PF ECR Calculator" activeView={activeView} setActiveView={handleViewChange} isSidebarOpen={isSidebarOpen} disabled={isNavLocked} />
              <SidebarHeader title="System" isSidebarOpen={isSidebarOpen} />
              <NavigationItem view={View.Utilities} icon={Wrench} label="Utilities" activeView={activeView} setActiveView={handleViewChange} isSidebarOpen={isSidebarOpen} disabled={isNavLocked} />
              <NavigationItem view={View.AI_Assistant} icon={Bot} label="Compliance AI" activeView={activeView} setActiveView={handleViewChange} isSidebarOpen={isSidebarOpen} disabled={isNavLocked} />
              {isSettingsAccessible && <NavigationItem view={View.Settings} icon={SettingsIcon} label="Configuration" activeView={activeView} setActiveView={handleViewChange} isSidebarOpen={isSidebarOpen} />}
            </nav>
            <div className="p-4 border-t border-slate-800 bg-[#0b1120]">
              <button onClick={handleLogout} className={`w-full flex items-center ${isSidebarOpen ? 'justify-start gap-3 px-4' : 'justify-center'} py-2.5 rounded-lg text-red-400 hover:bg-red-900/20 transition-colors`}>
                <LogOut size={18} /> {isSidebarOpen && <span className="font-bold text-sm">Sign Out</span>}
              </button>
            </div>
            <div className="p-2 border-t border-slate-800">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-full flex justify-center p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
              </button>
            </div>
          </aside>

          <main ref={mainContentRef} className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950">
            <header className="bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-800 h-16 flex items-center justify-between px-8 sticky top-0 z-10 gap-6">
              <div className="shrink-0 max-w-[40%]">
                <h2 className="text-sm font-black text-white tracking-wide flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0 border border-slate-600">
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  </div>
                  <span>{companyProfile.establishmentName || BRAND_CONFIG.companyName}</span>
                </h2>
              </div>
              <div className="flex-1 flex flex-col justify-center overflow-hidden h-full max-w-[55%] gap-1">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border border-slate-800 rounded-lg w-full relative overflow-hidden group">
                  <div className="shrink-0 p-1.5 bg-amber-900/30 rounded text-amber-400 border border-amber-900/30"><Megaphone size={14} className="animate-pulse" /></div>
                  <div className="overflow-hidden relative w-full h-5 flex items-center">
                    <div className="animate-marquee whitespace-nowrap text-xs font-bold text-amber-100 uppercase tracking-widest absolute">{companyProfile.flashNews || 'Welcome to BharatPay Pro!'}</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <button onClick={toggleFullScreen} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-full border border-slate-700 transition-all hover:scale-105 shadow-lg hidden md:block">{isFullScreen ? <Minimize size={18} /> : <Maximize size={18} />}</button>
                <div className="flex flex-col items-end gap-1.5">
                  <div className="relative group overflow-hidden rounded-full p-[1px]">
                    <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#059669_0%,#3b82f6_50%,#059669_100%)]" />
                    <div className="inline-flex h-full w-full items-center justify-center rounded-full bg-[#0f172a] px-3 py-1.5 backdrop-blur-3xl">
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                        <span className="text-[10px] font-black tracking-[0.05em] text-emerald-400 animate-pulse">{getFinancialYearLabel()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center px-2 py-[2px] bg-slate-800/80 border border-slate-700 rounded shadow-inner justify-center min-w-[120px]">
                    <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Version <span className="text-white">{APP_VERSION}</span></span>
                  </div>
                </div>
              </div>
            </header>
            <div className="p-8 max-w-7xl mx-auto">
              {activeView === View.Dashboard && <Dashboard employees={employees} config={config} companyProfile={companyProfile} attendances={attendances} leaveLedgers={leaveLedgers} advanceLedgers={advanceLedgers} payrollHistory={payrollHistory} month={globalMonth} year={globalYear} setMonth={setGlobalMonth} setYear={setGlobalYear} onNavigate={handleViewChange} />}
              {activeView === View.Employees && <EmployeeList employees={employees} setEmployees={setEmployees} onAddEmployee={handleAddEmployee} onBulkAddEmployees={handleBulkAddEmployees} designations={designations} divisions={divisions} branches={branches} sites={sites} currentUser={effectiveUser} companyProfile={companyProfile} dataSizeLimit={dataSizeLimit} />}
              {activeView === View.PayProcess && <PayProcess employees={employees} setEmployees={setEmployees} config={config} companyProfile={companyProfile} attendances={attendances} setAttendances={setAttendances} leaveLedgers={leaveLedgers} setLeaveLedgers={setLeaveLedgers} advanceLedgers={advanceLedgers} setAdvanceLedgers={setAdvanceLedgers} savedRecords={payrollHistory} setSavedRecords={setPayrollHistory} leavePolicy={leavePolicy} month={globalMonth} setMonth={setGlobalMonth} year={globalYear} setYear={setGlobalYear} currentUser={effectiveUser} fines={fines} setFines={setFines} arrearHistory={arrearHistory} setArrearHistory={setArrearHistory} showAlert={showAlert} />}
              {activeView === View.Reports && <Reports employees={employees} setEmployees={setEmployees} config={config} companyProfile={companyProfile} attendances={attendances} savedRecords={payrollHistory} setSavedRecords={setPayrollHistory} month={globalMonth} year={globalYear} setMonth={setGlobalMonth} setYear={setGlobalYear} leaveLedgers={leaveLedgers} setLeaveLedgers={setLeaveLedgers} advanceLedgers={advanceLedgers} setAdvanceLedgers={setAdvanceLedgers} currentUser={effectiveUser} onRollover={handleRollover} arrearHistory={arrearHistory} showAlert={showAlert} />}
              {activeView === View.Statutory && <StatutoryReports payrollHistory={payrollHistory} employees={employees} config={config} companyProfile={companyProfile} globalMonth={globalMonth} setGlobalMonth={setGlobalMonth} globalYear={globalYear} setGlobalYear={setGlobalYear} attendances={attendances} leaveLedgers={leaveLedgers} advanceLedgers={advanceLedgers} arrearHistory={arrearHistory} />}
              {activeView === View.Utilities && <Utilities designations={designations} setDesignations={setDesignations} divisions={divisions} setDivisions={setDivisions} branches={branches} setBranches={setBranches} sites={sites} setSites={setSites} showAlert={showAlert} />}
              {activeView === View.PFCalculator && <PFCalculator employees={employees} payrollHistory={payrollHistory} config={config} companyProfile={companyProfile} month={globalMonth} setMonth={setGlobalMonth} year={globalYear} setYear={setGlobalYear} />}
              {activeView === View.Settings && isSettingsAccessible && <Settings config={config} setConfig={setConfig} companyProfile={companyProfile} setCompanyProfile={setCompanyProfile} currentLogo={logoUrl} setLogo={handleUpdateLogo} leavePolicy={leavePolicy} setLeavePolicy={setLeavePolicy} onRestore={onRefresh} initialTab={settingsTab} userRole={effectiveUser?.role} currentUser={effectiveUser} isSetupMode={employees.length === 0} onSkipSetupRedirect={() => { setSkipSetupRedirect(true); setActiveView(View.Dashboard); }} onNuclearReset={() => {
                showAlert('danger', 'Factory Reset', '🚨 CRITICAL WARNING: This will DELETE ALL DATA and cannot be undone.', () => { handleNuclearReset(); });
              }} showAlert={showAlert} />}
              {activeView === View.AI_Assistant && <AIAssistant />}
            </div>
          </main>
        </>
      )}

      {/* Smart Update Notification Overlay */}
      {showUpdateNotice && (
        <div className="fixed bottom-6 right-6 z-[60] animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-slate-900 border border-blue-500/30 rounded-xl shadow-2xl p-6 max-w-sm">
            <div className="flex items-start gap-4">
              <div className="bg-blue-500/20 p-2 rounded-lg">
                <RefreshCw className="text-blue-400 animate-spin-slow" size={24} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-lg">Update Available!</h4>
                  <button
                    onClick={() => setShowUpdateNotice(false)}
                    className="text-slate-500 hover:text-white transition-colors"
                    title="Close"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="text-slate-400 text-sm mt-1">Version {latestAppVersion} is ready for download. This update includes performance and security fixes.</p>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleUpdateNow}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold transition-all active:scale-95"
                  >
                    Update Now
                  </button>
                  <button
                    onClick={handleUpdateLater}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    Next Login
                    {updateDownloaded && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Background Download State Overlay */}
      {isUpdateDownloading && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-slate-900 border border-blue-500/30 p-8 rounded-2xl max-w-md w-full text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <Loader2 className="absolute inset-0 m-auto text-blue-500 animate-pulse" size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Preparing Update...</h3>
            <p className="text-slate-400">Downloading latest version and snapshotting your data for safety. Please do not close the app.</p>
          </div>
        </div>
      )}

      {/* Main Alerts */}
      <CustomModal
        {...alertConfig}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

const App: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefresh = () => { setRefreshKey(prev => prev + 1); };
  return <PayrollShell key={refreshKey} onRefresh={handleRefresh} />;
};

export default App;
