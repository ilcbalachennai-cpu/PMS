import { useState, useEffect, useRef, FC, useCallback, useMemo } from 'react';
import {
  LayoutDashboard, Users, Calculator, FileText, Settings as SettingsIcon,
  LogOut, Bot, ShieldCheck,
  Loader2, Lock, Unlock, Wrench,
  CalendarClock, IndianRupee, Megaphone, Maximize, Minimize,
  ArrowRight, RefreshCw, Database,
  ChevronLeft, ChevronRight, X, Eye, EyeOff,
  ShieldAlert, CalendarX, WifiOff, Wifi, Scale, Building2, Plus, Trash2,
  Mail, AlertTriangle
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

import { getStoredLicense, APP_VERSION, trackHeartbeat, getMachineId, checkOnlineStatus, checkSyncRequirement, getOfflineActiveDaysCount, clearSyncRetryCount, requestResetOTP, verifyResetOTP } from './services/licenseService';
import { parseExpiryDate, formatExpiryDate, generateCompanyId } from './utils/formatters';
import { View, User, Employee, PayrollResult, CompanyProfile, StatutoryConfig, SettingsTab } from './types';
import { BRAND_CONFIG, INITIAL_COMPANY_PROFILE, DEFAULT_LEAVE_POLICY } from './constants';

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
import { executeDiagnosticExport } from './utils/diagnostics';

const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Global OS Detection for UI refinement
const isWin7 = /Windows NT 6.1/.test(window.navigator.userAgent);

const NavigationItem = ({ view, icon: Icon, label, activeView, onNavigate, isSidebarOpen, depth = 0, disabled = false, isLocked = false, onClickLocked, disabledTooltip }: { view: View, icon: any, label: string, activeView: View, onNavigate: (v: View) => void, isSidebarOpen: boolean, depth?: number, disabled?: boolean, isLocked?: boolean, onClickLocked?: () => void, disabledTooltip?: string }) => (
  <button
    onClick={() => {
      if (isLocked) {
        onClickLocked?.();
      } else if (!disabled) {
        onNavigate(view);
      }
    }}
    title={isLocked ? "You need the premium access code to activate this feature" : (disabled && disabledTooltip ? disabledTooltip : `Navigate to ${label}`)}
    aria-label={isLocked ? "Feature Locked" : (disabled && disabledTooltip ? disabledTooltip : `Navigate to ${label}`)}
    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all relative group ${disabled || isLocked ? 'opacity-40 cursor-not-allowed' : ''} ${activeView === view
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
    {isLocked && <Lock size={12} className="ml-auto text-amber-500" />}
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
  const deleteProgressRef = useRef<HTMLDivElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);
  const isReloadingAfterReset = sessionStorage.getItem('app_is_reloading_after_reset') === 'true';
  const [exitingMessage, setExitingMessage] = useState<string | null>(null);

  // --- Initialize Hooks ---
  const { alertConfig, showAlert, closeAlert } = useAlerts();
  const { currentUser, handleLogin, logout, setCurrentUser } = useAuth();
  
  const {
    employees, setEmployees, config, setConfig, companyProfile, setCompanyProfile,
    leavePolicy, setLeavePolicy, attendances, setAttendances, leaveLedgers, setLeaveLedgers,
    advanceLedgers, setAdvanceLedgers, payrollHistory, setPayrollHistory, fines, setFines,
    arrearHistory, setArrearHistory, otRecords, setOTRecords, designations, setDesignations, divisions, setDivisions,
    branches, setBranches, sites, setSites, logoUrl, setLogoUrl,
    safeSave, handleRollover, handlePayrollReset, handleDeepReset, handleNuclearReset,
    companies, setCompanies, activeCompanyId, activeFinancialYear, availableFinancialYears, switchCompany, switchFinancialYear, addCompany, deleteCompany, isHydrating, isResetting, triggerReload: reloadData
  } = usePayrollData(showAlert);


  const rescueOrganizations = useCallback(async () => {
    if (!window.electronAPI?.listSilos) return;
    
    try {
      const res = await window.electronAPI.listSilos();
      if (res.success && res.silos) {
        const foundSilos = res.silos as string[];
        const existingIds = companies.map(c => c.id);
        const missingSilos = foundSilos.filter(s => !existingIds.includes(s));
        
        if (missingSilos.length === 0) {
          showAlert('info', 'No Orphans Found', 'All physical data folders are already linked to your organizations.');
          return;
        }

        let selectedSilos: string[] = []; // Start empty, user decides selection

        showAlert('confirm', 'Select Organizations to Rescue', (
          <div className="space-y-3 mt-2 max-h-48 overflow-y-auto p-2 bg-slate-900/50 rounded-xl border border-slate-700/50">
            {missingSilos.map(siloId => (
              <label key={siloId} className="flex items-center gap-3 p-2 hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer">
                <input 
                  type="checkbox" 
                  defaultChecked={false}
                  onChange={(e) => {
                    if (e.target.checked) {
                      selectedSilos.push(siloId);
                    } else {
                      selectedSilos = selectedSilos.filter(s => s !== siloId);
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">{siloId}</span>
                  <span className="text-[10px] text-slate-500 font-mono">Orphaned Folder</span>
                </div>
              </label>
            ))}
          </div>
        ), async () => {
          if (selectedSilos.length === 0) {
            showAlert('warning', 'No Selection', 'Please select at least one organization to rescue.');
            return;
          }

          // --- V05.01.01: Limit Tracker Check for Rescue ---
          const license = getStoredLicense();
          const limit = license?.companyLimit || 1;
          let lifetimeCount = parseInt(localStorage.getItem('app_lifetime_company_creations') || '0');
          if (lifetimeCount === 0) lifetimeCount = companies.length;

          if (lifetimeCount + selectedSilos.length > limit) {
             const availableSlots = Math.max(0, limit - lifetimeCount);
             showAlert('danger', 'License Limit Exceeded', `Your current license allows a maximum of ${limit} company creation(s). You have ${availableSlots} slot(s) remaining, but selected ${selectedSilos.length} organizations to rescue. Please select fewer or upgrade your license.`);
             return;
          }

          // Increment the tracker securely
          lifetimeCount += selectedSilos.length;
          localStorage.setItem('app_lifetime_company_creations', lifetimeCount.toString());
          if (window.electronAPI?.dbSetGlobal) {
             await window.electronAPI.dbSetGlobal('app_lifetime_company_creations', lifetimeCount);
          }

          // Add selected silos to the registry
          let newCompanies = [...companies];
          for (const siloId of selectedSilos) {
            const rescued: CompanyProfile = {
              ...INITIAL_COMPANY_PROFILE,
              id: siloId,
              establishmentName: siloId,
              cin: ''
            };
            newCompanies.push(rescued);
          }

          setCompanies(newCompanies);
          localStorage.setItem('app_companies', JSON.stringify(newCompanies));
          if (window.electronAPI?.dbSetGlobal) {
            await window.electronAPI.dbSetGlobal('app_companies', newCompanies);
          }
          
          showAlert('success', 'Recovery Successful', `${selectedSilos.length} missing organizations have been re-linked to your system. Please update their names in Settings.`);
        });
      }
    } catch (e) {
      console.error("Rescue failed", e);
    }
  }, [companies, showAlert, setCompanies]);

  const { globalMonth, setGlobalMonth, globalYear, setGlobalYear, latestFrozenPeriod } = usePayrollPeriod(activeCompanyId, activeFinancialYear);

  // V04.00.05: Strict Financial Year Isolation Check
  const isFYMismatch = useMemo(() => {
    if (!activeFinancialYear) return false;
    const match = activeFinancialYear.match(/FY(\d{2})-(\d{2})/);
    if (!match) return false;
    
    const startY = 2000 + parseInt(match[1]);
    const endY = 2000 + parseInt(match[2]);
    const isJanToMar = ['January', 'February', 'March'].includes(globalMonth);
    
    return isJanToMar ? globalYear !== endY : globalYear !== startY;
  }, [globalMonth, globalYear, activeFinancialYear]);

  const { licenseStatus, licenseInfo, dataSizeLimit, verifyLicense, checkNewMessages } = useLicense();
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const { isAppDirectoryConfigured, isBootSyncComplete } = useAppInitialization(verifyLicense);

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
    isPatchNotice, isPatchMandatory, isSessionDismissed, patchSkipCount, versionSkipCount,
    deploymentStep,
    handleUpdateNow, handleUpdateLater 
  } = useAppUpdate(showAlert, currentUser?.role === 'Developer', currentUser?.username, currentUser?.email, isBootSyncComplete);

  const [isInstalling, setIsInstalling] = useState(false);
  const [isAddingNewCompany, setIsAddingNewCompany] = useState(false);

  // V04.01.05: Financial Year Switch Period Selector States
  const [showFySwitchModal, setShowFySwitchModal] = useState(false);
  const [pendingFySwitch, setPendingFySwitch] = useState<string | null>(null);
  const [modalSwitchMonth, setModalSwitchMonth] = useState<string>('April');
  const [modalSwitchYear, setModalSwitchYear] = useState<number>(2025);


  const { activeView, setActiveView } = useNavigation(mainContentRef, currentUser);

  const handleSystemRepair = () => {
    setUpdateError('SECURITY_VIOLATION');
  };

  const {
    settingsTab, setSettingsTab, isSidebarOpen, setIsSidebarOpen,
    showLoginMessage, setShowLoginMessage,
    showRegistrationManual, setShowRegistrationManual, setSkipSetupRedirect,
    isSetupComplete, setIsSetupComplete
  } = useUIState(activeCompanyId, employees.length);

  // --- V03.01.02: SMART GATE INITIALIZATION ---
  // Start with the selection gate closed to directly load the Dashboard of the active company
  const [isCompanyGateOpen, setIsCompanyGateOpen] = useState(false);

  // --- V03.01.07: Hover Dropdown States ---
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showFyDropdown, setShowFyDropdown] = useState(false);

  // --- V03.01.02: AUTO-SELECT SINGLE COMPANY (Safety Sync) ---
  useEffect(() => {
    if (currentUser && companies.length === 1 && isCompanyGateOpen) {
      console.log("Auto-selecting single organization and closing gate...");
      switchCompany(companies[0].id);
      setIsCompanyGateOpen(false);
    }
  }, [currentUser, companies.length, isCompanyGateOpen, switchCompany]);

  // --- JIT FINANCIAL YEAR BALANCE CARRY-FORWARD & INITIALIZATION ---
  useEffect(() => {
    if (isHydrating || isResetting || !activeFinancialYear || !activeCompanyId || employees.length === 0) return;

    if (activeView === View.PayProcess) {
      // 1. Check if April is in draft mode (no month finalized in history)
      const isAnyFinalized = payrollHistory.some((r: any) => r.status === 'Finalized');
      if (isAnyFinalized) return;

      // 2. Check if the opening balance is missing
      const isMissing = leaveLedgers.length === 0 || 
                        leaveLedgers.length < employees.length;

      if (isMissing) {
        console.log(`[JIT Rollover] Accessing Process Payroll and April is in draft with missing opening balances. Running carry-forward...`);
        
        const runJITRollover = async () => {
          const match = activeFinancialYear.match(/FY(\d{2})-(\d{2})/);
          if (!match) return;

          const start = parseInt(match[1]);
          const prevStart = String(start - 1).padStart(2, '0');
          const prevFY = `FY${prevStart}-${start}`;

          const prevLeaveLedgerKey = `app_leave_ledgers_${prevFY}_${activeCompanyId}`;
          const prevAdvanceLedgerKey = `app_advance_ledgers_${prevFY}_${activeCompanyId}`;
          const unscopedLeaveKey = `app_leave_ledgers_${activeCompanyId}`;
          const unscopedAdvanceKey = `app_advance_ledgers_${activeCompanyId}`;

          let prevLeaveLedgers: any[] = [];
          let prevAdvanceLedgers = [];

          if (window.electronAPI?.dbGet) {
            let loadedFromMarchSnapshot = false;

            // Prioritize March finalized payroll history snapshot as ground truth
            const prevPayrollHistoryKey = `app_payroll_history_${prevFY}_${activeCompanyId}`;
            const histRes = await window.electronAPI.dbGet(prevPayrollHistoryKey);
            if (histRes.success && histRes.data) {
              const history = typeof histRes.data === 'string' ? JSON.parse(histRes.data) : histRes.data;
              const marchEntries = Array.isArray(history) ? history.filter((r: any) => r.month === 'March' && r.status === 'Finalized') : [];
              if (marchEntries.length > 0) {
                prevLeaveLedgers = marchEntries.map((r: any) => {
                  const snap = r.leaveSnapshot || {};
                  return {
                    employeeId: r.employeeId,
                    el: snap.el || { opening: 0, eligible: 0, encashed: 0, availed: 0, balance: 0 },
                    sl: snap.sl || { eligible: 0, availed: 0, balance: 0 },
                    cl: snap.cl || { availed: 0, accumulation: 0, balance: 0 },
                    companyId: activeCompanyId
                  };
                });
                loadedFromMarchSnapshot = true;
                console.log(`[JIT Rollover] Preferred and loaded ${prevLeaveLedgers.length} records from March payroll history snapshot.`);
              }
            }

            // Fallback to previous living document if March finalized payroll is not available
            if (!loadedFromMarchSnapshot) {
              const leaveRes = await window.electronAPI.dbGet(prevLeaveLedgerKey);
              if (leaveRes.success && leaveRes.data) {
                prevLeaveLedgers = typeof leaveRes.data === 'string' ? JSON.parse(leaveRes.data) : leaveRes.data;
              } else if (prevFY === 'FY25-26') {
                const unscopedLeaveRes = await window.electronAPI.dbGet(unscopedLeaveKey);
                if (unscopedLeaveRes.success && unscopedLeaveRes.data) {
                  prevLeaveLedgers = typeof unscopedLeaveRes.data === 'string' ? JSON.parse(unscopedLeaveRes.data) : unscopedLeaveRes.data;
                }
              }
            }

            // Fetch advance
            const advanceRes = await window.electronAPI.dbGet(prevAdvanceLedgerKey);
            if (advanceRes.success && advanceRes.data) {
              prevAdvanceLedgers = typeof advanceRes.data === 'string' ? JSON.parse(advanceRes.data) : advanceRes.data;
            } else if (prevFY === 'FY25-26') {
              const unscopedAdvanceRes = await window.electronAPI.dbGet(unscopedAdvanceKey);
              if (unscopedAdvanceRes.success && unscopedAdvanceRes.data) {
                prevAdvanceLedgers = typeof unscopedAdvanceRes.data === 'string' ? JSON.parse(unscopedAdvanceRes.data) : unscopedAdvanceRes.data;
              }
            }
          }

          let baseYear = 2000 + start;

          const loadedPolicy = leavePolicy || DEFAULT_LEAVE_POLICY;

          // 3. Compute next leave ledgers
          const nextLeaveLedgers = employees.map((emp) => {
            const dojDate = emp ? new Date(emp.doj) : new Date(0);
            dojDate.setHours(0, 0, 0, 0);

            const nextPeriodEnd = new Date(baseYear, 3, 30);
            nextPeriodEnd.setHours(23, 59, 59, 999);
            const isEligible = dojDate <= nextPeriodEnd;

            const elCredit = isEligible ? (loadedPolicy?.el?.maxPerYear || 18) / 12 : 0;
            const slCredit = isEligible ? (loadedPolicy?.sl?.maxPerYear || 12) / 12 : 0;
            const clCredit = isEligible ? (loadedPolicy?.cl?.maxPerYear || 12) / 12 : 0;

            const l = Array.isArray(prevLeaveLedgers) ? prevLeaveLedgers.find((pl: any) => pl.employeeId === emp.id) : null;
            const currentRecord = leaveLedgers.find((cl: any) => cl.employeeId === emp.id);

            const availedEL = currentRecord?.el?.availed || 0;
            const encashedEL = currentRecord?.el?.encashed || 0;
            const availedSL = currentRecord?.sl?.availed || 0;
            const availedCL = currentRecord?.cl?.availed || 0;

            let carryEL = 0;
            let carrySL = 0;
            let carryCL = 0;

            if (l) {
              const prevELBal = l.el?.balance || 0;
              const prevSLBal = l.sl?.balance || 0;
              const prevCLBal = l.cl?.balance || 0;

              carryEL = isEligible ? Math.min(prevELBal, loadedPolicy?.el?.maxCarryForward || 30) : 0;
              carrySL = isEligible ? Math.min(prevSLBal, loadedPolicy?.sl?.maxCarryForward || 0) : 0;
              carryCL = isEligible ? Math.min(prevCLBal, loadedPolicy?.cl?.maxCarryForward || 0) : 0;
            } else {
               const initBalances = (emp.initialOpeningBalances as any) || {};
               const initEL = initBalances.el || 0;
               const initSL = initBalances.sl || 0;
               const initCL = initBalances.cl || 0;

              carryEL = isEligible ? initEL : 0;
              carrySL = isEligible ? initSL : 0;
              carryCL = isEligible ? initCL : 0;
            }

            return {
              employeeId: emp.id,
              el: { opening: carryEL, eligible: elCredit, encashed: encashedEL, availed: availedEL, balance: carryEL + elCredit - encashedEL - availedEL },
              sl: { eligible: slCredit, availed: availedSL, balance: carrySL + slCredit - availedSL },
              cl: { availed: availedCL, accumulation: carryCL, balance: carryCL + clCredit - availedCL },
              companyId: activeCompanyId
            };
          });

          // 4. Compute next advance ledgers
          const nextAdvanceLedgers = employees.map((emp) => {
            const a = Array.isArray(prevAdvanceLedgers) ? prevAdvanceLedgers.find((pa: any) => pa.employeeId === emp.id) : null;
            const currentRecord = advanceLedgers.find((ca: any) => ca.employeeId === emp.id);

            const carryOpening = a ? (a.balance || 0) : 0;
            const emiCount = a ? (a.emiCount || 0) : 0;

            const totalAdvance = currentRecord?.totalAdvance || 0;
            const manualPayment = currentRecord?.manualPayment || 0;
            const paidAmount = currentRecord?.paidAmount || 0;
            const recovery = currentRecord?.recovery || (emiCount > 0 ? Math.min(Math.round(carryOpening / emiCount), carryOpening) : 0);
            const balance = Math.max(0, carryOpening + totalAdvance - recovery - manualPayment - paidAmount);

            return {
              employeeId: emp.id,
              opening: carryOpening,
              totalAdvance: totalAdvance,
              manualPayment: manualPayment,
              paidAmount: paidAmount,
              emiCount: emiCount,
              recovery: recovery,
              balance: balance,
              monthlyInstallment: emiCount,
              companyId: activeCompanyId
            };
          });

          // 5. Update State & Persist
          setLeaveLedgers(nextLeaveLedgers);
          setAdvanceLedgers(nextAdvanceLedgers);
          
          await safeSave('app_leave_ledgers', nextLeaveLedgers);
          await safeSave('app_advance_ledgers', nextAdvanceLedgers);
          console.log(`[JIT Rollover] Successfully carried forward and saved leave and advance ledgers.`);
        };

        runJITRollover().catch(err => {
          console.error("JIT rollover error:", err);
        });
      }
    }
  }, [
    activeView, activeFinancialYear, activeCompanyId, employees, leaveLedgers, advanceLedgers,
    payrollHistory, leavePolicy, isHydrating, isResetting, safeSave, setLeaveLedgers, setAdvanceLedgers
  ]);

  const [isPurgeMode, setIsPurgeMode] = useState(false);
  const [showPurgeAuthModal, setShowPurgeAuthModal] = useState(false);
  const [purgeTargetId, setPurgeTargetId] = useState<string | null>(null);
  const [purgePassword, setPurgePassword] = useState('');
  const [purgeAuthError, setPurgeAuthError] = useState('');

  // --- Secure Deletion States (V03.01.04) ---
  const [showSecureDeleteModal, setShowSecureDeleteModal] = useState(false);
  const [secureDeleteTargetId, setSecureDeleteTargetId] = useState<string | null>(null);
  const [secureDeletePassword, setSecureDeletePassword] = useState('');
  const [secureDeleteEmail, setSecureDeleteEmail] = useState('');
  const [secureDeleteOTP, setSecureDeleteOTP] = useState('');
  const [secureDeleteStep, setSecureDeleteStep] = useState<'PASSWORD' | 'OTP'>('PASSWORD');
  const [secureDeleteError, setSecureDeleteError] = useState('');
  const [isSecureDeleteProcessing, setIsSecureDeleteProcessing] = useState(false);
  const [secureDeleteTimer, setSecureDeleteTimer] = useState(0);

  // --- Secure Deletion Timer Effect ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showSecureDeleteModal && secureDeleteStep === 'OTP') {
      if (secureDeleteTimer > 0) {
        interval = setInterval(() => {
          setSecureDeleteTimer(prev => prev - 1);
        }, 1000);
      } else {
        // Timer reached 0: FORCE ABORT (User Requirement)
        setShowSecureDeleteModal(false);
        setSecureDeleteTargetId(null);
        showAlert('warning', 'Security Timeout', 'Authorization window expired. Operation cancelled for security.');
      }
    }
    return () => clearInterval(interval);
  }, [showSecureDeleteModal, secureDeleteStep, secureDeleteTimer]);

  useEffect(() => {
    if (deleteProgressRef.current) {
      deleteProgressRef.current.style.width = `${(secureDeleteTimer / 90) * 100}%`;
    }
  }, [secureDeleteTimer]);

  useEffect(() => {
    if (secureDeleteStep === 'OTP' && otpInputRef.current) {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
    }
  }, [secureDeleteStep]);

  // --- Database Access Password Gate States ---
  const [showDbGateModal, setShowDbGateModal] = useState(false);
  const [dbGateTargetId, setDbGateTargetId] = useState<string | null>(null);
  const [dbGatePassword, setDbGatePassword] = useState('');
  const [dbGateError, setDbGateError] = useState('');
  const [dbGateShowPass, setDbGateShowPass] = useState(false);

  // --- Database Access Password Gate Logic ---
  const handleSwitchCompanyWithGate = (id: string, closeSelectionGate = false) => {
    if (id === activeCompanyId && !isCompanyGateOpen) return;
    
    // V03.01.05: Check for unsaved payroll drafts before allowing a switch
    // This addresses the user's request: "before switching company we should ensure the current company data is saved and closed"
    // Fixed: Only check for the CURRENT active month and year to avoid false alerts from ghost drafts
    const tempKey = `app_temp_payroll_${activeCompanyId}_${globalMonth}_${globalYear}`;
    const hasUnsavedDrafts = localStorage.getItem(tempKey) !== null;

    const proceedWithSwitch = () => {
      const targetComp = companies.find(c => c.id === id);
      if (targetComp?.dashboardPassword) {
        setDbGateTargetId(id);
        setDbGatePassword('');
        setDbGateError('');
        setDbGateShowPass(false);
        setShowDbGateModal(true);
      } else {
        switchCompany(id);
        if (closeSelectionGate) {
          setIsCompanyGateOpen(false);
          setIsPurgeMode(false);
        }
      }
    };

    if (hasUnsavedDrafts) {
      showAlert(
        'confirm',
        'Unsaved Payroll Drafts',
        'You have unsaved payroll calculations for the current company. Switching companies will leave these as drafts in the current silo. Would you like to proceed or go back to save/clear them?',
        () => proceedWithSwitch(),
        () => { 
          if (closeSelectionGate) {
            setIsCompanyGateOpen(false);
          }
          safeNavigate(View.PayProcess); 
        },
        'Proceed Anyway',
        'Go to Payroll'
      );
    } else {
      proceedWithSwitch();
    }
  };

  const verifyDbGatePassword = () => {
    if (!dbGateTargetId) return;
    const targetComp = companies.find(c => c.id === dbGateTargetId);
    
    if (targetComp?.dashboardPassword === dbGatePassword) {
      switchCompany(dbGateTargetId);
      setShowDbGateModal(false);
      setDbGateTargetId(null);
      if (isCompanyGateOpen) {
        setIsCompanyGateOpen(false);
        setIsPurgeMode(false);
      }
    } else {
      setDbGateError('Incorrect Database Password');
    }
  };

  // --- Secure Deletion Logic (V03.01.04) ---
  const handleInitiateSecureDelete = (id: string) => {
    setSecureDeleteTargetId(id);
    setSecureDeletePassword('');
    setSecureDeleteOTP('');
    setSecureDeleteStep('PASSWORD');
    setSecureDeleteError('');
    setSecureDeleteEmail(currentUser?.email || licenseInfo?.registeredTo || companyProfile?.email || '');
    setShowSecureDeleteModal(true);
  };

  const handleRequestSecureDeleteOTP = async () => {
    if (!currentUser) return;
    
    // 1. Verify Local Password First
    if (currentUser.password !== secureDeletePassword) {
      setSecureDeleteError('Incorrect Login Password');
      return;
    }

    setIsSecureDeleteProcessing(true);
    setSecureDeleteError('');

    try {
      // V03.01.07: Developer bypass for specific machine
      const mid = await getMachineId();
      const isDevMachine = mid === '05D02810-8051-7C4A-B33D-19383C3F3A2F';
      
      if (currentUser.role === 'Developer' && isDevMachine && secureDeleteTargetId) {
        await deleteCompany(secureDeleteTargetId);
        setShowSecureDeleteModal(false);
        setSecureDeleteTargetId(null);
        setIsCompanyGateOpen(true);
        showAlert('success', 'Organization Purged (Dev Bypass)', 'The company and its physical folder have been permanently removed without OTP.');
        setIsSecureDeleteProcessing(false);
        return;
      }

      let email = secureDeleteEmail || currentUser.email || licenseInfo?.registeredTo || companyProfile.email || "";
      if (currentUser.role === 'Developer' || email === 'developer@bharatpay.com') {
        email = 'ilcbala.bharatpayroll@gmail.com';
      }
      
      if (!email) {
        setSecureDeleteError('Account has no registered email. Recovery impossible.');
        setIsSecureDeleteProcessing(false);
        return;
      }



      const targetCompany = companies.find(c => c.id === secureDeleteTargetId);
      const companyName = targetCompany ? targetCompany.establishmentName : "Unknown Company";
      const res = await requestResetOTP(email, currentUser.username, companyName);
      if (res.success) {
        setSecureDeleteStep('OTP');
        setSecureDeleteTimer(90); // 90 Seconds countdown
      } else {
        setSecureDeleteError(res.message || 'Failed to send OTP. Check internet.');
      }
    } catch (e) {
      setSecureDeleteError('Connection Failure');
    } finally {
      setIsSecureDeleteProcessing(false);
    }
  };

  const handleVerifySecureDelete = async () => {
    if (!secureDeleteTargetId || !currentUser) return;

    if (secureDeleteOTP.length < 6) {
      setSecureDeleteError('Enter 6-digit OTP');
      return;
    }

    setIsSecureDeleteProcessing(true);
    setSecureDeleteError('');

    try {


      let email = secureDeleteEmail || currentUser.email || "";
      if (currentUser.role === 'Developer' || email === 'developer@bharatpay.com') {
        email = 'ilcbala.bharatpayroll@gmail.com';
      }
      // Use our new generic verification service
      const res = await verifyResetOTP(email, currentUser.username, secureDeleteOTP);
      
      if (res.success) {
        // Success! Execute the actual deletion
        await deleteCompany(secureDeleteTargetId);
        setShowSecureDeleteModal(false);
        setSecureDeleteTargetId(null);
        setIsCompanyGateOpen(true);
        showAlert('success', 'Organization Purged', 'The company and its physical folder have been permanently removed.');
      } else {
        setSecureDeleteError(res.message || 'Invalid OTP. Please try again.');
      }
    } catch (e) {
      setSecureDeleteError('Verification connection failed.');
    } finally {
      setIsSecureDeleteProcessing(false);
    }
  };

  const [showFlashPopup, setShowFlashPopup] = useState(false);
  const [isSettingsDirty, setIsSettingsDirty] = useState(false);
  const [isRestorationForced, setIsRestorationForced] = useState(false);
  const [isStartupTimerActive, setIsStartupTimerActive] = useState(!isReloadingAfterReset);

  // --- V03.01.01: ID Format Migration (Add Underscore to 12-char IDs) ---
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
    const latestYear = availableFinancialYears.length > 0 
      ? availableFinancialYears[availableFinancialYears.length - 1] 
      : activeFinancialYear;

    if (activeView === View.Settings && isSettingsDirty && view !== View.Settings) {
      showAlert(
        'confirm',
        'Unsaved Configuration',
        'You have unsaved changes in the configuration section. Would you like to stay and save them, or discard and leave?',
        () => { /* Stay - Do nothing */ },
        () => {
          setIsSettingsDirty(false);
          
          if (view === View.PayProcess && activeFinancialYear && latestYear && activeFinancialYear !== latestYear) {
            showAlert(
              'confirm',
              'Switch to Current Financial Year',
              `You are attempting to Process Payroll, this would switch the Financial Year to the Current Financial Year (${latestYear.replace('-', ' ')}).`,
              () => {
                switchFinancialYear(latestYear);
                setActiveView(view);
                if (tab) setSettingsTab(tab as any);
              },
              () => {},
              'Proceed',
              undefined,
              'Cancel'
            );
            return;
          }
          
          setActiveView(view);
          if (tab) setSettingsTab(tab as any);
        },
        'Stay & Save',
        'Discard & Leave'
      );
      return;
    }

    if (view === View.PayProcess && activeFinancialYear && latestYear && activeFinancialYear !== latestYear) {
      showAlert(
        'confirm',
        'Switch to Current Financial Year',
        `You are attempting to Process Payroll, this would switch the Financial Year to the Current Financial Year (${latestYear.replace('-', ' ')}).`,
        () => {
          switchFinancialYear(latestYear);
          setActiveView(view);
          if (tab) setSettingsTab(tab as any);
        },
        () => {},
        'Proceed',
        undefined,
        'Cancel'
      );
      return;
    }

    setActiveView(view);
    if (tab) {
      setSettingsTab(tab as any);
    } else if (view === View.Settings) {
      setSettingsTab(SettingsTab.Company);
    }
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
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return lastAgreedDate === today;
  });

  useEffect(() => {
    const verifyAgreedDate = async () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (hasAgreedLegal) return;

      if (window.electronAPI?.dbGet) {
        const res = await window.electronAPI.dbGet('app_legal_agreed_date');
        if (res.success && res.data === today) {
          setHasAgreedLegal(true);
          localStorage.setItem('app_legal_agreed_date', today);
        }
      }
    };
    verifyAgreedDate();
  }, [hasAgreedLegal]);

  const handleAcceptLegal = async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setHasAgreedLegal(true);
    setShowLegalModal(false);
    localStorage.setItem('app_legal_agreed_date', today);
    if (window.electronAPI?.dbSet) {
      await window.electronAPI.dbSet('app_legal_agreed_date', today);
    }
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
    // Updated to show on first login for the day regardless of company selection
    if (currentUser && !hasAgreedLegal) {
      const timer = setTimeout(() => setShowLegalModal(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [currentUser, hasAgreedLegal]);

  // --- V03.01.04: AUTO-MIGRATION FOR 3-DIGIT EMPLOYEE IDS ---
  useEffect(() => {
    if (!isHydrating && employees.length > 0) {
      const legacyEmployees = employees.filter(e => /^EMP\d{3}$/i.test(e.id));
      if (legacyEmployees.length > 0) {
        console.log(`🛠️ Found ${legacyEmployees.length} legacy 3-digit Employee IDs. Running auto-migration...`);
        
        const idMap = new Map<string, string>();
        const updatedEmployees = employees.map(e => {
          const match = e.id.match(/^EMP(\d{3})$/i);
          if (match) {
            const newId = `EMP${match[1].padStart(4, '0')}`;
            idMap.set(e.id, newId);
            return { ...e, id: newId };
          }
          return e;
        });

        if (idMap.size > 0) {
          const updateTable = (table: any[], idKey: string) => 
            table.map(item => idMap.has(item[idKey]) ? { ...item, [idKey]: idMap.get(item[idKey]) } : item);

          // Batch update states
          setEmployees(updatedEmployees);
          setAttendances(updateTable(attendances, 'employeeId'));
          setPayrollHistory(updateTable(payrollHistory, 'employeeId'));
          setLeaveLedgers(updateTable(leaveLedgers, 'employeeId'));
          setAdvanceLedgers(updateTable(advanceLedgers, 'employeeId'));
          setFines(updateTable(fines, 'employeeId'));
          setOTRecords(updateTable(otRecords, 'employeeId'));
          setArrearHistory(updateTable(arrearHistory, 'employeeId'));

          showAlert('success', 'Data Synchronized', `Successfully updated ${idMap.size} legacy employee IDs to 4-digit format.`);
        }
      }
    }
  }, [isHydrating, employees, attendances, payrollHistory, leaveLedgers, advanceLedgers, fines, otRecords, arrearHistory, setEmployees, setAttendances, setPayrollHistory, setLeaveLedgers, setAdvanceLedgers, setFines, setOTRecords, setArrearHistory, showAlert]);

  // Persistence & Sync Hook
  useSync({
    employees, config, companyProfile, attendances, leaveLedgers, advanceLedgers,
    payrollHistory, fines, leavePolicy, arrearHistory, otRecords, logoUrl,
    designations, divisions, branches, sites, isSetupComplete, safeSave,
    activeCompanyId, activeFinancialYear, isHydrating, isResetting
  });

  // --- Specialized Effects ---

  // Get exact session start time to avoid drift/stale values from login page loads
  const getSessionStart = () => {
    const loginTimeStr = sessionStorage.getItem('session_login_time');
    if (loginTimeStr) {
      try {
        return new Date(parseInt(loginTimeStr, 10)).toISOString();
      } catch (e) {
        console.warn("Failed to parse session_login_time:", e);
      }
    }
    return new Date().toISOString();
  };

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
          if (updates.latestVersion) {
            setLatestAppVersion(updates.latestVersion);
            localStorage.setItem('app_latest_version', updates.latestVersion);
            // @ts-ignore
            if (window.electronAPI) window.electronAPI.dbSet('app_latest_version', updates.latestVersion).catch(() => {});
          }
          if (updates.downloadUrl) {
            setDownloadUrl(updates.downloadUrl);
            localStorage.setItem('app_download_url', updates.downloadUrl);
            // @ts-ignore
            if (window.electronAPI) window.electronAPI.dbSet('app_download_url', updates.downloadUrl).catch(() => {});
          }
          
          if (updates.patchTimestamp && updates.patchTimestamp !== latestPatchTimestamp) {
            setLatestPatchTimestamp(updates.patchTimestamp);
            localStorage.setItem('app_latest_patch_timestamp', updates.patchTimestamp);
            // @ts-ignore
            if (window.electronAPI) window.electronAPI.dbSet('app_latest_patch_timestamp', updates.patchTimestamp).catch(() => {});
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
  }, [checkNewMessages, setCompanyProfile, latestPatchTimestamp]);

  // --- NEW: Immediate Version Sync on Boot ---
  useEffect(() => {
    if (licenseStatus.valid && licenseStatus.data) {
      if (licenseStatus.data.latestVersion) {
        setLatestAppVersion(licenseStatus.data.latestVersion);
        localStorage.setItem('app_latest_version', licenseStatus.data.latestVersion);
        // @ts-ignore
        if (window.electronAPI) window.electronAPI.dbSet('app_latest_version', licenseStatus.data.latestVersion).catch(() => {});
      }
      if (licenseStatus.data.downloadUrl) {
        setDownloadUrl(licenseStatus.data.downloadUrl);
        localStorage.setItem('app_download_url', licenseStatus.data.downloadUrl);
        // @ts-ignore
        if (window.electronAPI) window.electronAPI.dbSet('app_download_url', licenseStatus.data.downloadUrl).catch(() => {});
      }
      if (licenseStatus.data.patchTimestamp) {
        setLatestPatchTimestamp(licenseStatus.data.patchTimestamp);
        localStorage.setItem('app_latest_patch_timestamp', licenseStatus.data.patchTimestamp);
        // @ts-ignore
        if (window.electronAPI) window.electronAPI.dbSet('app_latest_patch_timestamp', licenseStatus.data.patchTimestamp).catch(() => {});
      }
    }
  }, [licenseStatus.valid, licenseStatus.data, setLatestAppVersion, setDownloadUrl, setLatestPatchTimestamp]);


  useEffect(() => {
    const currentMsgId = (localStorage.getItem('app_last_statutory_date') || companyProfile.postLoginMessage || '').trim();
    const isDismissedInSession = currentMsgId && sessionStorage.getItem(`app_msg_dismissed_${currentMsgId}`);

    if (currentUser && currentMsgId !== '' && !isDismissedInSession && !isReloadingAfterReset) {
      setShowLoginMessage(true);
    }
  }, [currentUser, companyProfile.postLoginMessage, isReloadingAfterReset]);

  // V03.01.06: Clear the reset reload flag after initialization
  useEffect(() => {
    if (isReloadingAfterReset) {
      const timer = setTimeout(() => {
        sessionStorage.removeItem('app_is_reloading_after_reset');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isReloadingAfterReset]);

  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(10);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Auto Logout Timer (Throttling-Proof & Background-Safe)
  useEffect(() => {
    if (!currentUser || isLoggingOut) return; // Only track when logged in

    // Always initialize/reset activity time on mount or login to prevent stale timeouts from previous sessions
    localStorage.setItem('app_last_activity_time', String(Date.now()));

    let lastX = -1;
    let lastY = -1;
    const MOVE_THRESHOLD = 5; // Ignored if moved less than 5 pixels (DPI jitter / layout scroll)

    const updateActivity = (e: Event) => {
      if (showIdleWarning) return; // Block activity updates while warning is active
      if (e.type === 'mousemove') {
        const me = e as MouseEvent;
        // Skip synthetic mousemove events triggered by layout/marquee updates when cursor is parked
        if (me.movementX === 0 && me.movementY === 0) return;
        
        if (lastX !== -1 && lastY !== -1) {
          const deltaX = Math.abs(me.clientX - lastX);
          const deltaY = Math.abs(me.clientY - lastY);
          if (deltaX < MOVE_THRESHOLD && deltaY < MOVE_THRESHOLD) {
            // Ignore minor subpixel scaling jitter or marquee layout oscillation
            return;
          }
        }
        lastX = me.clientX;
        lastY = me.clientY;
      }
      localStorage.setItem('app_last_activity_time', String(Date.now()));
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach(e => window.addEventListener(e, updateActivity));

    // Check every 5 seconds if we have been inactive
    const checkInterval = setInterval(async () => {
      const lastActive = localStorage.getItem('app_last_activity_time') || Date.now();
      const elapsed = Date.now() - Number(lastActive);
      
      // If idle time exceeds 9 minutes AND no active update is downloading
      if (elapsed > 540000 && !isUpdateDownloading && !showIdleWarning) {
        console.log("[ActivityTracker] Idle threshold reached! Showing warning...");
        setShowIdleWarning(true);
        setIdleCountdown(10);
      }
    }, 5000);

    return () => {
      clearInterval(checkInterval);
      events.forEach(e => window.removeEventListener(e, updateActivity));
    };
  }, [currentUser, isUpdateDownloading, showIdleWarning, isLoggingOut]);

  // Idle Warning Countdown Effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showIdleWarning) {
      if (idleCountdown > 0) {
        timer = setTimeout(() => setIdleCountdown(prev => prev - 1), 1000);
      } else {
        // Countdown finished, execute logout
        console.log("[ActivityTracker] Idle countdown finished! Logging out...");
        setIsLoggingOut(true);
        sessionStorage.setItem('logout_reason', 'timeout');
        const executeLogout = async () => {
          if (currentUser && currentUser.role !== 'Developer') {
            try {
              const mid = await getMachineId();
              await trackHeartbeat(currentUser.email || "", mid, currentUser.username, getSessionStart(), "LOGGED OUT");
            } catch(e) { console.warn("Auto-logout heartbeat failed", e); }
          }
          closeAlert();
          logout();
          window.location.reload();
        };
        executeLogout();
      }
    }
    return () => clearTimeout(timer);
  }, [showIdleWarning, idleCountdown, currentUser, logout, closeAlert]);

  // Heartbeat Tracker (LIVE Status in Google Sheets)
  useEffect(() => {
    if (!currentUser || !licenseStatus.valid || currentUser.role === 'Developer') return;

    const startHeartbeat = async () => {
      const mid = await getMachineId();
      trackHeartbeat(currentUser.email || licenseInfo?.registeredTo || "", mid, currentUser.username, getSessionStart(), "LIVE");
    };

    // Initial ping
    startHeartbeat();

    // Pulse every 5 minutes
    const heartbeatInterval = setInterval(startHeartbeat, 300000);

    return () => clearInterval(heartbeatInterval);
  }, [currentUser, licenseStatus.valid, licenseInfo?.registeredTo]);

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

    // Auto-register any new designations, divisions, branches, or sites from imported employees
    const newDesignations = Array.from(new Set(availableEmps.map(e => e.designation).filter(Boolean)));
    const newDivisions = Array.from(new Set(availableEmps.map(e => e.division || e.department).filter(Boolean)));
    const newBranches = Array.from(new Set(availableEmps.map(e => e.branch).filter(Boolean)));
    const newSites = Array.from(new Set(availableEmps.map(e => e.site).filter(Boolean)));

    if (newDesignations.length > 0) {
      setDesignations(prev => {
        const next = [...prev];
        newDesignations.forEach(d => {
          if (!next.includes(d)) next.push(d);
        });
        return next;
      });
    }
    if (newDivisions.length > 0) {
      setDivisions(prev => {
        const next = [...prev];
        newDivisions.forEach(d => {
          if (!next.includes(d)) next.push(d);
        });
        return next;
      });
    }
    if (newBranches.length > 0) {
      setBranches(prev => {
        const next = [...prev];
        newBranches.forEach(b => {
          if (!next.includes(b)) next.push(b);
        });
        return next;
      });
    }
    if (newSites.length > 0) {
      setSites(prev => {
        const next = [...prev];
        newSites.forEach(s => {
          if (!next.includes(s)) next.push(s);
        });
        return next;
      });
    }

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

    // Set precise session login time to avoid stale/drifted start times from mount
    sessionStorage.setItem('session_login_time', Date.now().toString());

    handleLogin(user);
    setIsCompanyGateOpen(true);
    // Overwrite activity time on successful login to prevent stale idle logouts
    localStorage.setItem('app_last_activity_time', String(Date.now()));

    // V02.02.40: Dispatch immediate login heartbeat status "LIVE" to Google Sheets
    const triggerLoginHeartbeat = async () => {
      try {
        const mid = await getMachineId();
        const license = getStoredLicense();
        if (user.role !== 'Developer') {
          await trackHeartbeat(user.email || license?.registeredTo || "", mid, user.username, new Date().toISOString(), "LIVE");
        }
      } catch (err) {
        console.error("Login heartbeat triggering failed:", err);
      }
    };
    triggerLoginHeartbeat();

    // Refresh license verification and info to ensure states like licenseStatus are sync'd
    verifyLicense(true).catch(() => {});

    // 1. Mandatory Security Check: Forced Reset Detection
    const isForcedReset = sessionStorage.getItem('app_forced_reset') === 'true';
    if (isForcedReset && user.role === 'Administrator') {
      setActiveView(View.Settings);
      setSettingsTab(SettingsTab.License);
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
      setSettingsTab(SettingsTab.License);
      setTimeout(() => {
        showAlert('warning', 'Identity Restoration Required', '🔒 System identifies a mismatch between your local identity and cloud records. Please click "Re-Activate System" with your registered Email/Mobile to restore full access.');
      }, 1000);
      return; 
    }

    if (!companyProfile?.establishmentName || companyProfile.establishmentName === 'Your Establishment Name') {
      setActiveView(View.Settings);
      setSettingsTab(SettingsTab.Company);
    } else {
      setTimeout(() => { 
        showAlert('success', 'System Secured', `Welcome back, ${user.name || user.username}. Connected to local database successfully.`, undefined, undefined, 'Proceed', undefined, undefined, 2); 
      }, 500);
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
    // V03.01.02: Determine if this is a sub-company addition to stabilize state transitions
    const isAddingNew = isAddingNewCompany;

    if (isAddingNew) {
      const newId = generateCompanyId(data.companyProfile.establishmentName);
      const newCompany = { ...data.companyProfile, id: newId };
      
      // CRITICAL: Update visibility flags BEFORE calling addCompany to prevent 
      // redundant Registration mount during the ensuing re-render/context switch
      setIsAddingNewCompany(false);
      setShowRegistrationManual(false);
      
      // Then trigger the data switch and re-hydration
      addCompany(newCompany, data.statutoryConfig);
      return;
    }

    let profileToSave = { ...data.companyProfile };
    let requiresReload = false;
    
    if (profileToSave.id === 'default') {
      const firstId = generateCompanyId(profileToSave.establishmentName);
      
      profileToSave.id = firstId;
      localStorage.setItem('app_active_company_id', firstId);
      localStorage.setItem('app_companies', JSON.stringify([profileToSave]));
      
      // Extract admin user
      const savedUsersRaw = localStorage.getItem('app_users');
      let savedUsers: User[] = (() => { try { return savedUsersRaw ? JSON.parse(savedUsersRaw) : []; } catch { return []; } })();
      const adminIdx = savedUsers.findIndex(u => u.username === data.adminUser.username);
      if (adminIdx >= 0) savedUsers[adminIdx] = data.adminUser; else savedUsers.push(data.adminUser);
      localStorage.setItem('app_users', JSON.stringify(savedUsers));

      if ((window as any).electronAPI) {
        // 1. Save global items first (Root DB)
        if ((window as any).electronAPI.dbSetGlobal) {
          await (window as any).electronAPI.dbSetGlobal('app_companies', [profileToSave]);
          await (window as any).electronAPI.dbSetGlobal('app_active_company_id', firstId);
          await (window as any).electronAPI.dbSetGlobal('app_users', savedUsers);
        } else {
          await (window as any).electronAPI.dbSet('app_companies', [profileToSave]);
          await (window as any).electronAPI.dbSet('app_active_company_id', firstId);
          await (window as any).electronAPI.dbSet('app_users', savedUsers);
        }
        
        // 2. Switch Electron process to the new Company Silo!
        if ((window as any).electronAPI.switchCompanyData) {
           await (window as any).electronAPI.switchCompanyData(firstId);
        }

        // 3. Save Silo-specific items (Silo DB)
        await (window as any).electronAPI.dbSet('app_companies', [profileToSave]); // Backup copy inside Silo
        await (window as any).electronAPI.dbSet('app_active_company_id', firstId); // Backup copy inside Silo
        await (window as any).electronAPI.dbSet('app_config', data.statutoryConfig);
        await (window as any).electronAPI.dbSet('app_company_profile', profileToSave);
        await (window as any).electronAPI.dbSet(`${firstId}_app_setup_complete`, 'true');
      }

      requiresReload = true;
    }

    setCompanyProfile(profileToSave);
    setConfig(data.statutoryConfig);
    const savedUsersRaw = localStorage.getItem('app_users');
    let savedUsers: User[] = (() => { try { return savedUsersRaw ? JSON.parse(savedUsersRaw) : []; } catch { return []; } })();
    const adminIdx = savedUsers.findIndex(u => u.username === data.adminUser.username);
    if (adminIdx >= 0) savedUsers[adminIdx] = data.adminUser; else savedUsers.push(data.adminUser);
    localStorage.setItem('app_users', JSON.stringify(savedUsers));
    safeSave('app_setup_complete', 'true');

    // Check for Post-Reset Enrollment Mode
    const isResetMode = localStorage.getItem('app_is_reset_mode') === 'true';

    // If it's not a fresh install (default), it just falls through and sets users 
    // because addCompany would have already switched the DB.
    if ((window as any).electronAPI && !requiresReload) {
      (window as any).electronAPI.dbSet('app_users', savedUsers);
      (window as any).electronAPI.dbSet(`${profileToSave.id}_app_setup_complete`, 'true');
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
      setSettingsTab(SettingsTab.Company);
      setSkipSetupRedirect(false);
      showAlert(
          'success', 
          'Setup Complete', 
          'You have sucessfully installed the Aplication do read the User info docuement before Using the application', 
          () => {
              const api = (window as any).electronAPI;
              if (api && api.openUserManual) {
                  api.openUserManual();
              }
              if (requiresReload) window.location.reload();
          },
          () => {
              if (requiresReload) window.location.reload();
          },
          'Read User Info',
          'Continue'
      );
    }
  };

  const handleLogoutAction = () => {
    if (isUpdateDownloading) {
      showAlert('warning', 'Update in Progress', 'A new version is currently downloading in the background. Please wait for the download to complete before logging out or closing the application.');
      return;
    }
    if (activeView === View.Settings && isSettingsDirty) {
      showAlert('warning', 'Unsaved Changes', 'You are about to sign out with unsaved configuration changes. These changes will be lost. Proceed anyway?', () => {
        setIsSettingsDirty(false);
        logout();
        window.location.reload();
      }, () => { }, 'Discard & Sign Out', 'Stay Here');
      return;
    }
    showAlert('confirm', 'Sign Out', 'Select an action to proceed:', async () => {
      setExitingMessage('Securing Session & Signing Out...');
      try {
        const mid = await getMachineId();
        if (currentUser?.role !== 'Developer') {
          await trackHeartbeat(currentUser?.email || licenseInfo?.registeredTo || "", mid, currentUser?.username || "UNKNOWN", getSessionStart(), 'LOGGED OUT');
        }
      } catch (err) {
        console.error("Logout heartbeat failed:", err);
      } finally {
        logout();
        window.location.reload();
      }
    }, async () => {
      setExitingMessage('Securing Session & Exiting...');
      try {
        const mid = await getMachineId();
        if (currentUser?.role !== 'Developer') {
          await trackHeartbeat(currentUser?.email || licenseInfo?.registeredTo || "", mid, currentUser?.username || "UNKNOWN", getSessionStart(), 'LOGGED OUT');
        }
      } catch (err) {
        console.error("Exit heartbeat failed:", err);
      } finally {
        if ((window as any).electronAPI) (window as any).electronAPI.closeApp();
        else { logout(); window.close(); window.location.reload(); }
      }
    }, 'Re-login', 'Quit Application', 'Cancel');
  };

  const onRolloverTrigger = async (updatedHistory?: PayrollResult[]) => {
    const result = await handleRollover(globalMonth, globalYear, monthsArr, updatedHistory);
    if (result) {
      const { nextMonth, nextYear, backupRes, backupFileName } = result;
      // V04.00.03: Auto-Advance Financial Year on March -> April Rollover
      if (globalMonth === 'March' && nextMonth === 'April') {
         const newFy = `FY${String(nextYear).slice(-2)}-${String(nextYear + 1).slice(-2)}`;
         // Switch the silo automatically so new data lands in the new FY
         switchFinancialYear(newFy);
      }

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



  const effectiveUser = (currentUser || { id: 'setup', name: 'Initial Setup', role: 'Administrator', username: 'setup', password: '', email: '' }) as User;
  const isSettingsAccessible = effectiveUser.role === 'Developer' || effectiveUser.role === 'Administrator';
  
  // --- V06.01.07: Mandatory Company Config Enforcement ---
  const isCompanyProfileComplete = !!(
    companyProfile.establishmentName?.trim() &&
    companyProfile.cin?.trim() &&
    companyProfile.pan?.trim() &&
    companyProfile.pfCode?.trim() &&
    companyProfile.esiCode?.trim() &&
    companyProfile.doorNo?.trim() &&
    companyProfile.street?.trim() &&
    companyProfile.city?.trim() &&
    companyProfile.state?.trim() &&
    companyProfile.pincode?.trim()
  );
  const isNavLocked = (employees.length === 0 && companies.length <= 1) || !isCompanyProfileComplete;

  // Enforce redirection to Configuration -> Company Profile if incomplete
  useEffect(() => {
    if (!isCompanyProfileComplete && activeView !== View.Settings && activeView !== View.Dashboard) {
      safeNavigate(View.Settings);
      setSettingsTab(SettingsTab.Company);
      showAlert(
        'warning', 
        'Company Profile Setup Required', 
        'Please update the important fields marked with a red asterisk (*) under the "Company Profile" tab. Then, move to the "Statutory Rules" tab, scan through, and confirm to activate Employee adding and Attendance processing.'
      );
    }
  }, [isCompanyProfileComplete, activeView]);
  // ---------------------------------------------------------

  // --- V03.01.02: Normalizing Render Path to Prevent Hook Violations ---
  const isExpired = licenseStatus.message === 'LICENSE EXPIRED' || (licenseStatus.data?.isExpired);
  const isTampered = licenseStatus.message === 'SECURITY VIOLATION' || (licenseStatus.data?.isTampered);
  const isSyncBlocked = licenseStatus.data?.isSyncBlocked;
  const syncMessage = licenseStatus.message;
  const isSyncWarning = !isSyncBlocked && syncMessage?.includes('uninterrupted use');

  const showStartupOverlay = isStartupTimerActive || isAppDirectoryConfigured === null || !licenseStatus.checked;
  const showLicenseGate = licenseStatus.checked && (isExpired || isTampered || isSyncBlocked);

  const hasPreviousYearData = useMemo(() => {
    if (!activeFinancialYear || !availableFinancialYears.length) return false;
    const parseFY = (s: string) => {
      const match = s.match(/FY(\d{2})-(\d{2})/);
      return match ? parseInt(match[1]) : 0;
    };
    const currentVal = parseFY(activeFinancialYear);
    return availableFinancialYears.some(fy => parseFY(fy) < currentVal);
  }, [activeFinancialYear, availableFinancialYears]);

  return (
    <div className={`flex h-[100dvh] overflow-hidden bg-[#020617] text-white ${isWin7 ? 'is-win7' : ''}`}>
      {exitingMessage && (
        <div className="fixed inset-0 bg-[#020617]/90 backdrop-blur-md flex flex-col items-center justify-center z-[20000] space-y-8 animate-in fade-in duration-300">
          <div className="relative">
            <div className="absolute -inset-4 bg-blue-500/20 blur-2xl rounded-full animate-pulse"></div>
            <div className="relative w-24 h-24 rounded-full border-[4px] border-white/10 overflow-hidden shadow-2xl bg-[#020617] flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">{exitingMessage}</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Please wait while the system completes background sync</p>
          </div>
        </div>
      )}
      
      {showStartupOverlay ? (
        <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center z-[1000] space-y-8 animate-in fade-in duration-700">
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
          <div className="w-48 h-1 bg-slate-900 rounded-full overflow-hidden">
             <div className="h-full bg-blue-600 animate-loading-bar-5s rounded-full"></div>
          </div>
        </div>
      ) : showLicenseGate ? (
        <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-10 shadow-2xl relative overflow-hidden">
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
                  <button onClick={executeDiagnosticExport} className="w-full mt-2 py-2.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5">
                    <FileText size={14} /> Export Error Log
                  </button>
                  <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase opacity-60 mt-3">Security Engine v{licenseStatus.data?.latestVersion || '02.02.19'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>

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

      {licenseStatus.checked && !licenseStatus.valid && !showRegistrationManual && isAppDirectoryConfigured && (
        <div className="fixed inset-0 z-[15000] bg-[#020617] flex items-center justify-center p-2 md:p-4 overflow-hidden">
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

      {isAppDirectoryConfigured === false ? (
        <div className="flex flex-col md:flex-row w-full h-full min-h-screen bg-[#020617] overflow-y-auto custom-scrollbar">
          <div className="md:w-1/3 flex items-center justify-center p-4 border-r border-slate-800/30 bg-[#020617]">
             <AppSetup onComplete={() => window.location.reload()} />
          </div>
          <div className="flex-1 flex items-center justify-center p-4 md:bg-slate-900/10">
            <Login 
              onLogin={handleAuthLogin} 
              currentLogo={logoUrl} 
              setLogo={handleUpdateLogo} 
              isLocked={true}
            />
          </div>
        </div>
      ) : (showRegistrationManual || isRestorationForced || (companies.length === 0)) ? (
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
        <div className="flex flex-col md:flex-row w-full h-full min-h-screen bg-[#020617] overflow-y-auto custom-scrollbar">
          <div className="flex-1 flex items-center justify-center p-4">
            <Login 
              onLogin={handleAuthLogin} 
              currentLogo={logoUrl} 
              setLogo={handleUpdateLogo} 
              isLocked={false}
            />
          </div>
        </div>
      ) : (
        <>
          {/* --- V02.02.29: MULTI-COMPANY SELECTION GATE --- */}
          {isCompanyGateOpen && (
            <div className="fixed inset-0 z-[600] bg-[#020617] flex flex-col items-center justify-center p-6 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar">
              {/* Floating Application Logo (Top Left) */}
              <div className="fixed top-6 left-8 z-[1000] flex items-center gap-3 bg-slate-900/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800/50 shadow-2xl pointer-events-none select-none group/floating-logo transition-all hover:bg-slate-900/60">
                <div className="relative">
                  <div className="absolute -inset-1.5 bg-blue-500/20 blur-md rounded-full group-hover/floating-logo:bg-blue-500/30 transition-all"></div>
                  <img src="./logo3.png" alt="BPP Logo" className="relative w-8 h-8 rounded-full border border-slate-700 shadow-lg" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-black tracking-tighter uppercase italic">
                    <span className="text-[#FF9933]">Bharat</span>Pay<span className="text-[#4ADE80]"> Pro</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em]">Premium Payroll Silo</span>
                  </div>
                </div>
              </div>
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
                        className={`group relative flex flex-col p-4 bg-slate-900/40 hover:bg-blue-600/5 border transition-all duration-300 rounded-2xl text-left overflow-hidden h-24 ${activeCompanyId === c.id ? 'border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.1)] bg-blue-600/5' : 'border-slate-800 hover:border-blue-500/30'}`}
                      >
                        {/* Main Clickable Area */}
                        <button 
                          className="absolute inset-0 z-0"
                          title={`Load ${c.establishmentName}`}
                          onClick={() => handleSwitchCompanyWithGate(c.id, true)}
                        ></button>

                        <Building2 size={80} className="absolute -bottom-4 -right-4 text-white/[0.02] group-hover:text-blue-500/5 transition-colors pointer-events-none" />
                        
                        <div className="flex flex-col items-center justify-center h-full relative z-10 pointer-events-none px-4">
                          <h3 className={`text-base font-black tracking-tight leading-tight mb-2 text-center transition-colors ${activeCompanyId === c.id ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                            {c.establishmentName?.replace('Rescued: ', '')}
                          </h3>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const emps = localStorage.getItem(`app_employees_${c.id}`);
                              const hasEmployees = (() => { try { return emps && JSON.parse(emps).length > 0; } catch { return false; } })();
                              
                              const profileRaw = localStorage.getItem(`app_company_profile_${c.id}`);
                              const profile = (() => { try { return profileRaw ? JSON.parse(profileRaw) : null; } catch { return null; } })();
                              const panFromProfile = profile ? profile.pan : "";
                              
                              const hasPAN = (c.pan && c.pan.trim() !== "") || (panFromProfile && panFromProfile.trim() !== "");
                              
                              let status = 'INITIALIZED';
                              let colorClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                              
                              if (!hasPAN && !hasEmployees) {
                                status = 'INITIALIZED';
                                colorClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                              } else if (hasPAN && !hasEmployees) {
                                status = 'REGISTERED';
                                colorClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                              } else if (hasPAN && hasEmployees) {
                                status = 'REGISTERED';
                                colorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                              } else if (!hasPAN && hasEmployees) {
                                status = 'UNREGISTERED';
                                colorClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                              }
                              
                              return (
                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border transition-colors ${colorClass}`}>
                                  {status}
                                </span>
                              );
                            })()}
                            <span className="text-[10px] text-amber-400 font-black font-mono tracking-widest opacity-80">
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
                        const license = getStoredLicense();
                        const limit = license?.companyLimit || 1;
                        const lifetimeCount = parseInt(localStorage.getItem('app_lifetime_company_creations') || '0');
                        
                        if (lifetimeCount >= limit) {
                          showAlert?.('danger', 'License Limit Reached', `Your current license allows a maximum of ${limit} company creation(s). You have reached your lifetime limit and cannot create any more companies. Upgrade your license to create more.`);
                          return;
                        }

                        setIsAddingNewCompany(true);
                        setShowRegistrationManual(true);
                        setIsCompanyGateOpen(false);
                        setIsPurgeMode(false);
                      }}
                      className="group flex flex-col items-center justify-center p-4 bg-emerald-600/5 hover:bg-emerald-600/10 border border-dashed border-emerald-500/20 hover:border-emerald-500/50 transition-all duration-300 rounded-2xl text-center h-24 space-y-1.5"
                    >
                      <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:bg-emerald-500 group-hover:text-white">
                         <Plus size={16} />
                      </div>
                      <h3 className="text-[10px] font-black text-emerald-500/80 uppercase tracking-widest">Add New Unit</h3>
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
                            className={`w-full bg-[#0f172a] border ${purgeAuthError ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3.5 text-white placeholder:text-slate-600/50 outline-none focus:ring-2 focus:ring-rose-500 transition-all font-mono`} 
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
                       <LogOut size={14} /> Change User Account/Quit App
                     </button>
                     <div className="w-px h-4 bg-slate-800"></div>
                     <button onClick={executeDiagnosticExport} className="text-slate-500 hover:text-blue-400 text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2">
                       <FileText size={14} /> Export Diagnostics
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
                <button 
                  onClick={() => { 
                    setShowLoginMessage(false); 
                    const currentMsgId = (localStorage.getItem('app_last_statutory_date') || companyProfile.postLoginMessage || '').trim();
                    if (currentMsgId) sessionStorage.setItem(`app_msg_dismissed_${currentMsgId}`, 'true');
                  }} 
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl uppercase tracking-widest transition-all"
                >
                  Acknowledge & Continue
                </button>
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

          {showPremiumModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-amber-500/50 p-8 space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-amber-500/10 rounded-full border border-amber-500/30">
                    <Lock size={32} className="text-amber-500" />
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-widest text-center">
                    Premium Feature Locked
                  </h3>
                  <p className="text-slate-300 text-xs text-center leading-relaxed">
                    You need the premium access code to activate this feature. Please contact support to upgrade your license.
                  </p>
                  <p className="text-blue-400 text-xs text-center font-bold">
                    ilcbala.Bharatpayroll@gmail.com
                  </p>
                </div>
                <button 
                  onClick={() => setShowPremiumModal(false)} 
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl uppercase tracking-widest transition-all"
                >
                  Close
                </button>
              </div>
            </div>
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
              <NavigationItem view={View.Dashboard} icon={LayoutDashboard} label="Dashboard" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isCompanyGateOpen && activeView !== View.Dashboard} />
              <NavigationItem view={View.Employees} icon={Users} label="Employee Master" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} disabledTooltip={!isCompanyProfileComplete ? "Company Profile Mandatory fields to be updated and saved to activate this function" : undefined} />
              <NavigationItem view={View.PayProcess} icon={CalendarClock} label="Process Payroll" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} disabledTooltip={!isCompanyProfileComplete ? "Company Profile Mandatory fields to be updated and saved to activate this function" : undefined} />
              <NavigationItem view={View.Reports} icon={FileText} label="Pay Reports" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} />
              <NavigationItem view={View.Statutory} icon={ShieldCheck} label="Statutory Reports" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} />
              <NavigationItem view={View.MIS} icon={IndianRupee} label="Management Info (MIS)" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} isLocked={!licenseInfo?.splMIS} onClickLocked={() => setShowPremiumModal(true)} />
              <NavigationItem view={View.SSCode} icon={Scale} label="Social Security / Code Wages" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} />
              <NavigationItem view={View.PFCalculator} icon={Calculator} label="PF ECR Calculator" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} />
              <NavigationItem view={View.Utilities} icon={Wrench} label="Utilities" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} />
              <NavigationItem view={View.AI_Assistant} icon={Bot} label="Compliance AI" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen} />
              <NavigationItem view={View.Settings} icon={SettingsIcon} label="Configuration" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={!isSettingsAccessible} />
            </nav>
            <div className="p-4 border-t border-slate-800 bg-[#0b1120] space-y-1">
              <button onClick={executeDiagnosticExport} className={`w-full flex items-center ${isSidebarOpen ? 'justify-start gap-3 px-4' : 'justify-center'} py-2.5 rounded-lg text-blue-400 hover:bg-blue-900/20`} title="Export Diagnostics">
                <FileText size={18} /> {isSidebarOpen && <span className="font-bold text-sm">Export Diagnostics</span>}
              </button>
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
                <div 
                  className={`relative ${activeView === View.Dashboard ? 'group/company' : 'cursor-not-allowed opacity-80'}`}
                  onMouseEnter={() => activeView === View.Dashboard && setShowCompanyDropdown(true)}
                  onMouseLeave={() => setShowCompanyDropdown(false)}
                >
                  <button 
                    disabled={activeView !== View.Dashboard}
                    className={`flex items-center gap-3 bg-[#1e293b] px-4 py-2 rounded-xl border border-slate-700 transition-all ${activeView === View.Dashboard ? 'hover:bg-[#2d3b50] group-hover/company:border-blue-500/50' : ''}`}
                    title={activeView !== View.Dashboard ? "Switching organizations is restricted while working in this module. Return to Dashboard to change company." : "Switch Organization"}
                  >
                    <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-full border border-slate-600 shadow-lg object-cover shrink-0" />
                    <div className="flex flex-col items-start leading-tight">
                       <div className="flex items-center gap-2 max-w-[340px]">
                         <span className="text-sm font-black text-white tracking-tight truncate">
                           {companyProfile.establishmentName?.replace('Rescued: ', '') || "Select Organization"}
                         </span>
                         <span className="text-[9px] px-1.5 py-0.5 bg-blue-600 text-white rounded border border-blue-400 font-mono font-black shrink-0 shadow-lg uppercase tracking-tighter">
                           {activeCompanyId}
                         </span>
                       </div>
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
                    {activeView === View.Dashboard ? (
                      <ChevronRight size={16} className="text-slate-500 rotate-90 group-hover/company:text-white transition-all" />
                    ) : (
                      <Lock size={14} className="text-slate-600" />
                    )}
                  </button>
                  
                  {/* Company Switcher Dropdown - Only Rendered/Visible on Dashboard */}
                  {activeView === View.Dashboard && showCompanyDropdown && (
                    <div className="absolute top-full left-0 pt-1.5 w-72 z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="bg-[#1e293b] border-2 border-blue-500/80 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.3)] overflow-hidden">
                        <div className="p-4 bg-[#0f172a] border-b border-slate-800">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Select Organization</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {companies.map(c => (
                          <button 
                            key={c.id}
                            onClick={() => {
                              handleSwitchCompanyWithGate(c.id);
                              setShowCompanyDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 p-4 text-left hover:bg-blue-900/20 transition-all border-b border-slate-800/50 last:border-0 ${activeCompanyId === c.id ? 'bg-blue-900/40 border-l-4 border-l-blue-500' : ''}`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${activeCompanyId === c.id ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                              {c.establishmentName?.substring(0, 2).toUpperCase() || 'CO'}
                            </div>
                            <div className="flex-1 flex flex-col overflow-hidden">
                               <div className="flex items-center justify-between gap-2 mb-0.5">
                                 <span className={`text-sm font-bold truncate ${activeCompanyId === c.id ? 'text-white' : 'text-slate-300'}`}>{c.establishmentName?.replace('Rescued: ', '')}</span>
                                 <div className="flex items-center gap-2">
                                   {c.dashboardPassword && <Lock size={12} className="text-blue-400 shrink-0" />}
                                   {activeCompanyId !== c.id && (
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         handleInitiateSecureDelete(c.id);
                                       }}
                                       className="p-1.5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-500 rounded-md transition-all"
                                       title="Delete Organization"
                                     >
                                       <Trash2 size={14} />
                                     </button>
                                   )}
                                 </div>
                               </div>
                               <div className="flex items-center gap-2">
                                 <span className="text-[10px] text-slate-500 font-mono tracking-tighter truncate">{c.cin || 'No CIN'}</span>
                                 <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter border shrink-0 ${activeCompanyId === c.id ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-800 text-amber-500 border-slate-700'}`}>{c.id}</span>
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
                  )}
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
                        <div className="px-4 py-2.5 bg-[#0b0f19] border border-slate-700/80 rounded-full shadow-2xl -mt-2 relative z-10 flex items-center gap-2.5">
                          <CalendarClock size={15} className="text-white shrink-0 animate-none" />
                          {activeView === View.PayProcess || activeView === View.Settings || activeView === View.AI_Assistant || activeView === View.Utilities ? (
                            <span className="text-[15px] font-black text-white uppercase tracking-widest select-none cursor-default" title="Financial Year selection is disabled in this view">
                              {activeFinancialYear ? activeFinancialYear.replace('-', ' ') : ''} ACTIVE
                            </span>
                          ) : (
                            <div 
                              className="relative"
                              onMouseEnter={() => setShowFyDropdown(true)}
                              onMouseLeave={() => setShowFyDropdown(false)}
                            >
                              <button
                                className="flex items-center gap-1.5 text-[15px] font-black text-white uppercase tracking-widest outline-none cursor-pointer"
                              >
                                <span>{activeFinancialYear ? activeFinancialYear.replace('-', ' ') : ''} ACTIVE</span>
                                <span className="text-[10px] text-white/90 select-none pointer-events-none">▼</span>
                              </button>

                              {showFyDropdown && (
                                <div className="absolute right-0 top-full pt-1.5 w-56 z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
                                  <div className="bg-[#1e293b] border-2 border-blue-500/80 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.3)] overflow-hidden">
                                    <div className="p-3 bg-[#0f172a] border-b border-slate-800">
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Financial Year</span>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                      {availableFinancialYears.map(fy => (
                                        <button
                                          key={fy}
                                          onClick={() => {
                                            setPendingFySwitch(fy);
                                            // Pre-populate target months/years based on selected FY
                                            const match = fy.match(/FY(\d{2})-(\d{2})/);
                                            if (match) {
                                              const startY = 2000 + parseInt(match[1]);
                                              setModalSwitchMonth('April');
                                              setModalSwitchYear(startY);
                                            }
                                            setShowFySwitchModal(true);
                                            setShowFyDropdown(false);
                                          }}
                                          className={`w-full flex items-center gap-3 p-3.5 text-left hover:bg-blue-900/20 transition-all border-b border-slate-800/50 last:border-0 text-xs font-bold ${activeFinancialYear === fy ? 'text-blue-400 bg-blue-950/20 border-l-4 border-l-blue-500' : 'text-slate-300'}`}
                                        >
                                          {fy.replace('-', ' ')} ACTIVE
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                  </div>
                </div>
            </header>

            <main
              ref={mainContentRef}
              className="flex-1 overflow-y-auto bg-slate-950 custom-scrollbar relative"
              onMouseEnter={() => isSidebarOpen && activeView !== View.Dashboard && setIsSidebarOpen(false)}
            >
              {!isCompanyProfileComplete && (
                <div className="bg-rose-950/30 border-b border-rose-500/20 px-8 py-3.5 flex items-center justify-between gap-4 backdrop-blur-md sticky top-0 z-20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
                      <AlertTriangle size={18} className="animate-pulse" />
                    </div>
                    <p className="text-xs font-bold text-slate-300">
                      Please Update the Mandatory Fields marked with <span className="text-rose-400 font-extrabold text-sm">*</span> in Company Profile to enable other functions under Dashboard.
                    </p>
                  </div>
                  {activeView !== View.Settings && (
                    <button
                      onClick={() => {
                        safeNavigate(View.Settings);
                        setSettingsTab(SettingsTab.Company);
                      }}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all hover:shadow-[0_0_15px_rgba(225,29,72,0.3)] shrink-0"
                    >
                      Update Profile
                    </button>
                  )}
                </div>
              )}
              {isHydrating && (
                <div className="absolute inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
                   <div className="bg-[#0f172a] border-2 border-blue-500/30 rounded-[2.5rem] p-12 flex flex-col items-center gap-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-2xl w-full relative overflow-hidden group">
                      {/* Decorative Background Glow */}
                      <div className="absolute -right-24 -top-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
                      
                      <div className="relative">
                        <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse"></div>
                        <Loader2 size={64} className="text-blue-500 animate-spin relative" />
                      </div>

                      <div className="flex flex-col items-center gap-4 text-center">
                         <h2 className="text-2xl font-black text-white tracking-tight leading-tight">
                           Please wait,&nbsp; Loading&nbsp; {activeFinancialYear ? activeFinancialYear.replace('FY', 'FY ') : ''} <br/>
                           <span className="text-blue-400">{companyProfile.establishmentName || 'Organization'}</span>
                         </h2>
                         <div className="px-4 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20">
                            <p className="text-xs font-black text-blue-300 uppercase tracking-widest">
                               ID: {activeCompanyId}
                            </p>
                         </div>
                      </div>

                      <div className="w-full space-y-3">
                        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/5 relative">
                           <div className="absolute inset-0 bg-blue-500/5"></div>
                           <div className="h-full bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600 rounded-full animate-loading-progress shadow-[0_0_20px_rgba(59,130,246,0.6)] relative z-10"></div>
                        </div>
                        <div className="flex justify-center">
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] animate-ellipsis-wait">Initializing Silo</span>
                        </div>
                        <button 
                            onClick={executeDiagnosticExport}
                            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors z-50 flex items-center gap-1.5"
                        >
                            <FileText size={12} />
                            Export Diagnostics
                        </button>
                     </div>
                   </div>
                </div>
              )}

              <div className="p-8 max-w-7xl mx-auto relative">
                {isFYMismatch && [View.Dashboard, View.PayProcess, View.Reports, View.Statutory, View.MIS, View.SSCode, View.PFCalculator].includes(activeView) && (
                  <div className="absolute inset-0 z-[50] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300 rounded-3xl m-8">
                     <div className="bg-rose-950/40 border border-rose-500/50 rounded-3xl p-10 max-w-lg text-center shadow-[0_0_50px_rgba(225,29,72,0.15)] flex flex-col items-center">
                        <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mb-6 animate-pulse shadow-inner border border-rose-500/30">
                          <AlertTriangle size={32} />
                        </div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Financial Year Mismatch</h2>
                        <div className="h-1 w-12 bg-rose-500 rounded-full mb-6"></div>
                        <p className="text-slate-300 text-sm leading-relaxed mb-6">
                          The selected period (<strong className="text-white">{globalMonth} {globalYear}</strong>) falls outside the active data silo (<strong className="text-rose-400">{activeFinancialYear}</strong>).
                        </p>

                        <div className="w-full flex flex-col gap-4 border-t border-rose-500/20 pt-6">
                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest text-left">
                            Select Financial Year to Switch
                          </span>
                          
                          <div className="flex flex-col gap-2.5 w-full">
                            {availableFinancialYears.map(fy => {
                              // Calculate if this year matches the selected month & year
                              const match = fy.match(/FY(\d{2})-(\d{2})/);
                              let isTarget = false;
                              if (match) {
                                const startY = 2000 + parseInt(match[1]);
                                const endY = startY + 1;
                                const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                                const monthIdx = months.indexOf(globalMonth);
                                const selectedYear = globalYear;
                                if (monthIdx < 3) { // Jan, Feb, Mar
                                  isTarget = (selectedYear === endY);
                                } else { // Apr to Dec
                                  isTarget = (selectedYear === startY);
                                }
                              }

                              return (
                                <button
                                  key={fy}
                                  onClick={() => {
                                    setPendingFySwitch(fy);
                                    const match = fy.match(/FY(\d{2})-(\d{2})/);
                                    if (match) {
                                      const startY = 2000 + parseInt(match[1]);
                                      if (isTarget) {
                                        setModalSwitchMonth(globalMonth);
                                        setModalSwitchYear(globalYear);
                                      } else {
                                        setModalSwitchMonth('April');
                                        setModalSwitchYear(startY);
                                      }
                                    }
                                    setShowFySwitchModal(true);
                                  }}
                                  className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border ${
                                    isTarget 
                                      ? 'bg-gradient-to-r from-emerald-600/35 to-teal-600/35 border-emerald-500/60 text-white hover:from-emerald-500/40 hover:to-teal-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:scale-[1.02] active:scale-[98]'
                                      : 'bg-slate-900/60 border-slate-700/80 text-slate-300 hover:bg-slate-800/80 hover:text-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <CalendarClock size={14} className={isTarget ? "text-emerald-400 animate-pulse" : "text-slate-400"} />
                                    <span>{fy.replace('-', ' ')}</span>
                                  </div>
                                  {isTarget && (
                                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[9px] font-black tracking-widest border border-emerald-500/30">
                                      RECOMMENDED
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <button 
                            onClick={executeDiagnosticExport}
                            className="mt-6 text-[10px] font-bold text-slate-600 hover:text-rose-400 uppercase tracking-widest transition-colors flex items-center gap-1.5"
                        >
                            <FileText size={12} />
                            Export Diagnostics
                        </button>
                     </div>
                  </div>
                )}
                {activeView === View.Dashboard && <Dashboard employees={employees} config={config} companyProfile={companyProfile} attendances={attendances} leaveLedgers={leaveLedgers} advanceLedgers={advanceLedgers} payrollHistory={payrollHistory} month={globalMonth} year={globalYear} setMonth={setGlobalMonth} setYear={setGlobalYear} onNavigate={safeNavigate} activeFinancialYear={activeFinancialYear} />}
                {activeView === View.Employees && <EmployeeList employees={employees} setEmployees={setEmployees} onAddEmployee={handleAddEmployee} onBulkAddEmployees={handleBulkAddEmployees} designations={designations} divisions={divisions} branches={branches} sites={sites} currentUser={effectiveUser} companyProfile={companyProfile} dataSizeLimit={dataSizeLimit} showAlert={showAlert} globalMonth={globalMonth} globalYear={globalYear} activeFinancialYear={activeFinancialYear} />}
                {activeView === View.PayProcess && <PayProcess employees={employees} setEmployees={setEmployees} config={config} companyProfile={companyProfile} attendances={attendances} setAttendances={setAttendances} leaveLedgers={leaveLedgers} setLeaveLedgers={setLeaveLedgers} advanceLedgers={advanceLedgers} setAdvanceLedgers={setAdvanceLedgers} savedRecords={payrollHistory} setSavedRecords={setPayrollHistory} leavePolicy={leavePolicy} month={globalMonth} setMonth={setGlobalMonth} year={globalYear} setYear={setGlobalYear} currentUser={effectiveUser} fines={fines} setFines={setFines} arrearHistory={arrearHistory} setArrearHistory={setArrearHistory} otRecords={otRecords} setOTRecords={setOTRecords} showAlert={showAlert} onNavigate={safeNavigate} setSettingsTab={setSettingsTab} licenseInfo={licenseInfo || undefined} hasPreviousYearData={hasPreviousYearData} activeFinancialYear={activeFinancialYear} />}
                {activeView === View.Reports && <Reports employees={employees} setEmployees={setEmployees} config={config} companyProfile={companyProfile} attendances={attendances} savedRecords={payrollHistory} setSavedRecords={setPayrollHistory} month={globalMonth} year={globalYear} setMonth={setGlobalMonth} setYear={setGlobalYear} leaveLedgers={leaveLedgers} setLeaveLedgers={setLeaveLedgers} advanceLedgers={advanceLedgers} setAdvanceLedgers={setAdvanceLedgers} currentUser={effectiveUser} onRollover={onRolloverTrigger} arrearHistory={arrearHistory} showAlert={showAlert} latestFrozenPeriod={latestFrozenPeriod} onNavigate={safeNavigate} activeFinancialYear={activeFinancialYear} />}
                {activeView === View.Statutory && <StatutoryReports payrollHistory={payrollHistory} employees={employees} config={config} companyProfile={companyProfile} globalMonth={globalMonth} setGlobalMonth={setGlobalMonth} globalYear={globalYear} setGlobalYear={setGlobalYear} attendances={attendances} leaveLedgers={leaveLedgers} advanceLedgers={advanceLedgers} arrearHistory={arrearHistory} latestFrozenPeriod={latestFrozenPeriod} showAlert={showAlert} activeFinancialYear={activeFinancialYear} />}
                {activeView === View.MIS && <MISDashboard payrollHistory={payrollHistory} employees={employees} companyProfile={companyProfile} showAlert={showAlert} activeFinancialYear={activeFinancialYear} />}
                {activeView === View.SSCode && <SocialSecurityCode payrollHistory={payrollHistory} employees={employees} config={config} companyProfile={companyProfile} globalMonth={globalMonth} setGlobalMonth={setGlobalMonth} globalYear={globalYear} setGlobalYear={setGlobalYear} showAlert={showAlert} activeFinancialYear={activeFinancialYear} />}
                {activeView === View.Utilities && <Utilities designations={designations} setDesignations={setDesignations} divisions={divisions} setDivisions={setDivisions} branches={branches} setBranches={setBranches} sites={sites} setSites={setSites} showAlert={showAlert} />}
                {activeView === View.PFCalculator && <PFCalculator employees={employees} payrollHistory={payrollHistory} config={config} companyProfile={companyProfile} month={globalMonth} setMonth={setGlobalMonth} year={globalYear} setYear={setGlobalYear} activeFinancialYear={activeFinancialYear} />}
                {activeView === View.Settings && isSettingsAccessible && <Settings config={config} setConfig={setConfig} companyProfile={companyProfile} setCompanyProfile={setCompanyProfile} currentLogo={logoUrl} setLogo={handleUpdateLogo} leavePolicy={leavePolicy} setLeavePolicy={setLeavePolicy} onRestore={() => { reloadData(); onRefresh(); safeNavigate(View.Dashboard); }} initialTab={settingsTab} setSettingsTab={setSettingsTab} userRole={effectiveUser?.role} currentUser={effectiveUser} isSetupMode={employees.length === 0} onSkipSetupRedirect={() => { setSkipSetupRedirect(true); safeNavigate(View.Dashboard); }} onPayrollReset={handlePayrollReset} onDeepReset={handleDeepReset} onNuclearReset={handleNuclearReset} onRescueOrganizations={rescueOrganizations} onInitiateSecureDelete={handleInitiateSecureDelete} onDirtyChange={setIsSettingsDirty} showAlert={showAlert} verifyLicense={verifyLicense} activeCompanyId={activeCompanyId} onOpenGate={() => { setIsCompanyGateOpen(true); setIsPurgeMode(true); }} globalMonth={globalMonth} globalYear={globalYear} activeFinancialYear={activeFinancialYear} latestPatchTimestamp={latestPatchTimestamp} />}
                {activeView === View.AI_Assistant && <AIAssistant />}
              </div>
              {/* --- Database Password Gate Modal --- */}
          {showDbGateModal && (
            <div className="fixed inset-0 z-[800] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-[#1e293b] w-full max-w-sm rounded-3xl border border-blue-500/30 shadow-2xl p-8 flex flex-col gap-6 relative overflow-hidden">
                {/* Visual Background Element */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
                
                <button onClick={() => setShowDbGateModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors" title="Close Verification"><X size={20} /></button>
                
                <div className="flex flex-col items-center gap-4 relative z-10">
                  <div className="p-5 bg-blue-900/20 text-blue-400 rounded-2xl border border-blue-500/30 shadow-inner">
                    <Unlock size={36} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Database Locked</h3>
                    <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1 mb-2">
                      {companies.find(c => c.id === dbGateTargetId)?.establishmentName || "Secured Organization"} [{dbGateTargetId}]
                    </p>
                    <div className="h-0.5 w-12 bg-blue-500/30 mx-auto rounded-full mb-3"></div>
                    <p className="text-[9px] text-blue-300 font-bold uppercase tracking-widest">
                      Verification required for access
                    </p>
                  </div>
                </div>

                <div className="space-y-5 relative z-10">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1 mb-2 block">Company Access Password</label>
                    <div className="relative group">
                      <input 
                        type={dbGateShowPass ? "text" : "password"} 
                        placeholder="••••••••" 
                        autoFocus 
                        className={`w-full bg-[#0f172a] border ${dbGateError ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-slate-700 group-hover:border-blue-500/50'} rounded-2xl px-5 py-4 text-white placeholder:text-slate-600/50 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono`} 
                        value={dbGatePassword} 
                        onChange={(e) => { setDbGatePassword(e.target.value); setDbGateError(''); }} 
                        onKeyDown={(e) => e.key === 'Enter' && verifyDbGatePassword()} 
                      />
                      <button 
                        onClick={() => setDbGateShowPass(!dbGateShowPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-400 transition-colors"
                      >
                        {dbGateShowPass ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {dbGateError && <p className="text-[10px] text-red-400 font-bold mt-2.5 text-center animate-pulse flex items-center justify-center gap-1.5"><ShieldAlert size={12} /> {dbGateError}</p>}
                  </div>
                  
                  <button 
                    onClick={verifyDbGatePassword}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-900/20 transition-all flex items-center justify-center gap-2 uppercase tracking-[0.15em] text-xs active:scale-[0.98]"
                  >
                    <ShieldCheck size={18} /> Unlock Database
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- Secure Deletion Modal (V03.01.04) --- */}
          {showSecureDeleteModal && (
            <div className="fixed inset-0 z-[900] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-[#1e293b] w-full max-w-sm rounded-[2rem] border border-rose-500/30 shadow-[0_0_50px_rgba(225,29,72,0.2)] p-8 flex flex-col gap-6 relative overflow-hidden">
                <div className="absolute -top-12 -left-12 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl"></div>
                
                {!isSecureDeleteProcessing && (
                  <button onClick={() => setShowSecureDeleteModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors" title="Cancel Purge">
                    <X size={20} />
                  </button>
                )}

                <div className="flex flex-col items-center gap-4 relative z-10">
                  <div className="p-5 bg-rose-900/20 text-rose-500 rounded-2xl border border-rose-500/30 shadow-inner animate-pulse">
                    <Trash2 size={36} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Secure Purge Authorization</h3>
                    <p className="text-[10px] text-rose-400 font-black uppercase tracking-widest mt-1 mb-2">
                      Target: {companies.find(c => c.id === secureDeleteTargetId)?.establishmentName || "Unknown Silo"} [{secureDeleteTargetId}]
                    </p>
                    <div className="h-0.5 w-12 bg-rose-500/30 mx-auto rounded-full"></div>
                  </div>
                </div>

                <div className="space-y-5 relative z-10">
                  {secureDeleteStep === 'PASSWORD' ? (
                    <div className="space-y-4">
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic text-center">
                        This action is irreversible. Enter your <span className="text-white font-black underline">Login Password</span> to request a Secure Deletion OTP to <span className="text-rose-400 font-bold">{(currentUser?.role === 'Developer' || currentUser?.email === 'developer@bharatpay.com') ? 'ilcbala.bharatpayroll@gmail.com' : (secureDeleteEmail || "your registered email")}</span>.
                      </p>
                      <div className="relative group">
                        <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-rose-500 transition-colors" />
                        <input 
                          type="password" 
                          placeholder="Admin Password" 
                          autoFocus 
                          disabled={isSecureDeleteProcessing}
                          className="w-full bg-[#0f172a] border border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-white outline-none focus:ring-2 focus:ring-rose-500 transition-all font-mono" 
                          value={secureDeletePassword}
                          onChange={(e) => { setSecureDeletePassword(e.target.value); setSecureDeleteError(''); }}
                          onKeyDown={(e) => e.key === 'Enter' && handleRequestSecureDeleteOTP()}
                        />
                      </div>
                      <button 
                        onClick={handleRequestSecureDeleteOTP}
                        disabled={isSecureDeleteProcessing || !secureDeletePassword}
                        className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black py-4 rounded-xl shadow-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs active:scale-[0.98]"
                      >
                        {isSecureDeleteProcessing ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                        {isSecureDeleteProcessing ? 'VERIFYING...' : 'REQUEST DELETE OTP'}
                      </button>
                      <div className="flex justify-center items-center mt-3">
                        <button 
                          onClick={() => setShowSecureDeleteModal(false)}
                          className="text-[10px] text-slate-500 hover:text-slate-300 font-black uppercase tracking-widest"
                        >
                          Cancel & Close
                        </button>
                      </div>
                    </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl relative overflow-hidden">
                          <div className="flex justify-between items-center relative z-10">
                            <p className="text-[10px] text-emerald-400 font-black leading-relaxed">
                              OTP SENT SUCCESSFULLY!<br/>
                              Check your email.
                            </p>
                            <div className={`flex flex-col items-center justify-center p-2 rounded-xl border ${secureDeleteTimer > 10 ? 'bg-slate-900/50 border-emerald-500/30 text-emerald-400' : 'bg-rose-900/20 border-rose-500/30 text-rose-500 animate-pulse'}`}>
                              <span className="text-[8px] font-black uppercase tracking-tighter mb-0.5">Expires</span>
                              <span className="text-sm font-black mono tracking-tighter">{Math.floor(secureDeleteTimer / 60)}:{(secureDeleteTimer % 60).toString().padStart(2, '0')}</span>
                            </div>
                          </div>
                          {/* Background Progress Bar for Timer */}
                          <div 
                            ref={deleteProgressRef}
                            className="absolute bottom-0 left-0 h-1 bg-emerald-500/20 transition-all duration-1000"
                          ></div>
                        </div>
                        <div className="relative group">
                          <ShieldCheck size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                          <input 
                            ref={otpInputRef}
                            type="password" 
                            maxLength={6}
                            placeholder="000000" 
                            autoFocus 
                            disabled={isSecureDeleteProcessing || secureDeleteTimer === 0}
                            className={`w-full bg-[#0f172a] border border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-xl font-black text-center tracking-[0.5em] outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${secureDeleteTimer === 0 ? 'opacity-30' : 'text-emerald-400'}`} 
                            value={secureDeleteOTP}
                            onChange={(e) => { setSecureDeleteOTP(e.target.value.replace(/\D/g, '')); setSecureDeleteError(''); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleVerifySecureDelete()}
                          />
                        </div>
                        <button 
                          onClick={handleVerifySecureDelete}
                          disabled={isSecureDeleteProcessing || secureDeleteOTP.length < 6 || secureDeleteTimer === 0}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-4 rounded-xl shadow-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs active:scale-[0.98]"
                        >
                          {isSecureDeleteProcessing ? <Loader2 size={18} className="animate-spin" /> : <ShieldAlert size={18} />}
                          {isSecureDeleteProcessing ? 'VERIFYING...' : (secureDeleteTimer === 0 ? 'CODE EXPIRED' : 'CONFIRM PERMANENT PURGE')}
                        </button>
                        <div className="flex justify-center items-center px-1">
                          <button 
                            onClick={() => setSecureDeleteStep('PASSWORD')}
                            className="text-[9px] text-slate-500 hover:text-slate-300 font-black uppercase tracking-tight"
                          >
                            Back to Password
                          </button>
                        </div>
                      </div>
                    )}

                  {secureDeleteError && (
                    <p className="text-[10px] text-red-400 font-bold text-center animate-pulse flex items-center justify-center gap-1.5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <AlertTriangle size={12} /> {secureDeleteError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>


      <UpdatePortal 
        isOpen={((showUpdateNotice || isPatchNotice || isUpdatePreparing || showBackgroundNotice || updateDownloaded || updateError === 'SECURITY_VIOLATION' || isInstalling) && (!isSessionDismissed || isPatchMandatory)) || updateError === 'SECURITY_VIOLATION' || isInstalling}
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
        versionSkipCount={versionSkipCount}
        deploymentStep={deploymentStep}
        isVersionUpdate={!isPatchNotice}
        onUpdateNow={() => handleUpdateNow(async () => {
          setIsInstalling(true);
          // Pre-install persistence
          const keysToPersist = ['app_users', 'app_license_secure', 'app_data_size', 'app_employees', 'app_setup_complete', 'app_logo'];
          for (const k of keysToPersist) {
            const val = localStorage.getItem(k);
            if (val && (window as any).electronAPI) {
              const isGlobalKey = ['app_users', 'app_license_secure', 'app_data_size', 'app_setup_complete'].includes(k);
              const dbSetFn = isGlobalKey
                ? ((window as any).electronAPI.dbSetGlobal || (window as any).electronAPI.dbSet)
                : (window as any).electronAPI.dbSet;
              await dbSetFn(k, val.startsWith('{') || val.startsWith('[') ? JSON.parse(val) : val);
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
      )}      {/* --- V04.01.05: FINANCIAL YEAR SWITCH PERIOD SELECTOR MODAL --- */}
      {showFySwitchModal && pendingFySwitch && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center">
            <div className="w-12 h-12 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center mb-5 border border-indigo-500/30">
              <CalendarClock size={24} />
            </div>
            
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">Select Processing Period</h3>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              Please choose the starting Month & Year for entering the <strong className="text-indigo-400 font-bold">{pendingFySwitch.replace('-', ' ')}</strong> silo.
            </p>

            <div className="flex gap-2 w-full mb-6">
              <div className="flex-1 text-left">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Month</label>
                <select
                  value={modalSwitchMonth}
                  onChange={(e) => {
                    const selectedMonth = e.target.value;
                    setModalSwitchMonth(selectedMonth);
                    if (pendingFySwitch) {
                      const match = pendingFySwitch.match(/FY(\d{2})-(\d{2})/);
                      if (match) {
                        const startY = 2000 + parseInt(match[1]);
                        const endY = 2000 + parseInt(match[2]);
                        const isNextYear = ['January', 'February', 'March'].includes(selectedMonth);
                        setModalSwitchYear(isNextYear ? endY : startY);
                      }
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700/80 px-3 py-2.5 rounded-xl text-xs font-bold text-white outline-none focus:border-indigo-500 cursor-pointer"
                  title="Select Month"
                  aria-label="Select Month"
                >
                  {['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'].map(m => (
                    <option key={m} value={m} className="bg-slate-950 text-white">{m}</option>
                  ))}
                </select>
              </div>
              
              <div className="w-28 text-left">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Year</label>
                <select
                  value={modalSwitchYear}
                  onChange={(e) => setModalSwitchYear(parseInt(e.target.value))}
                  disabled={true}
                  className="w-full bg-slate-900 border border-slate-700/80 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 outline-none cursor-not-allowed"
                  title="Auto-calculated Year"
                  aria-label="Year"
                >
                  {(() => {
                    const match = pendingFySwitch.match(/FY(\d{2})-(\d{2})/);
                    if (match) {
                      const startY = 2000 + parseInt(match[1]);
                      const endY = 2000 + parseInt(match[2]);
                      return [startY, endY].map(y => (
                        <option key={y} value={y} className="bg-slate-950 text-white">{y}</option>
                      ));
                    }
                    return null;
                  })()}
                </select>
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => {
                  setShowFySwitchModal(false);
                  setPendingFySwitch(null);
                }}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs uppercase tracking-widest rounded-xl transition-all border border-slate-700/50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  switchFinancialYear(pendingFySwitch);
                  setGlobalMonth(modalSwitchMonth);
                  setGlobalYear(modalSwitchYear);
                  
                  localStorage.setItem(`app_selected_month_${activeCompanyId}_${pendingFySwitch}`, modalSwitchMonth);
                  localStorage.setItem(`app_selected_year_${activeCompanyId}_${pendingFySwitch}`, String(modalSwitchYear));
                  
                  setShowFySwitchModal(false);
                  setPendingFySwitch(null);
                }}
                className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_20px_rgba(99,102,241,0.3)] hover:scale-[1.02] active:scale-98"
              >
                Enter Month
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- V02.02.24: MANDATORY LEGAL ALERT OVERLAY --- */}
      {showLegalModal && (
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
                  {(() => {
                    const profileRaw = localStorage.getItem('app_company_profile');
                    if (profileRaw) {
                      try {
                        const profile = JSON.parse(profileRaw);
                        if (profile.loginAlertMessage) return profile.loginAlertMessage;
                      } catch (e) {}
                    }
                    return companyProfile?.loginAlertMessage || `ILCBala is the sole owner of "BharatPayPro" Payroll Management Software and all its Designs, Modules, Layouts, Reports and UI are exclusive right of the Developer, any one tries to copy or infringe upon any Designs, Modules, Layouts, Reports & UI shall be held accountable for copy-right and patent violation, appropriate legal action will be initiated as per the prevailing laws in India, within the jurisdiction of Tamil Nadu - Chennai.`;
                  })()}
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
        </>
      )}

      {/* Auto Logout Idle Warning Modal */}
      {showIdleWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#0f172a] border border-amber-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">Session Timeout</h2>
            <p className="text-slate-400 mb-6 leading-relaxed">
              You have been idle for a while. For your security, you will be automatically logged out in:
            </p>
            <div className="text-6xl font-black text-amber-500 mb-8 tabular-nums">
              {idleCountdown}
            </div>
            <button
              onClick={() => {
                setShowIdleWarning(false);
                localStorage.setItem('app_last_activity_time', String(Date.now()));
              }}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(217,119,6,0.3)]"
            >
              Continue Working
            </button>
          </div>
        </div>
      )}
    </>
  )}
</div>
);
};

const App: React.FC = () => {
  const handleRefresh = () => { 
    // Data refresh is now handled via reloadData() inside the hook
  };
  return <PayrollShell onRefresh={handleRefresh} />;
};

export default App;
