
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard, Users, Calculator, FileText, Settings as SettingsIcon,
  LogOut, Bot, ShieldCheck,
  Loader2, Lock, Wrench,
  CalendarClock, IndianRupee, Megaphone, Maximize, Minimize,
  ArrowRight, RefreshCw, Database,
  ShieldAlert, UserCheck, AlertCircle, Info, Download, CheckCircle2,
  Table, BarChart3, PieChart, TrendingUp, History, ClipboardList, HardDrive
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
import MISDashboard from './components/MISDashboard';
import CustomModal from './components/Shared/CustomModal';

import { 
  APP_VERSION, getStoredLicense, validateLicenseStartup, checkNewMessages,
  syncLicenseStatus, getAppDeveloper
} from './services/licenseService';
import { View, User, Employee, PayrollResult, CompanyProfile, StatutoryConfig } from './types';
import { BRAND_CONFIG, INITIAL_COMPANY_PROFILE, INITIAL_STATUTORY_CONFIG } from './constants';

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
import TrialNoticeModal from './components/Shared/TrialNoticeModal';

const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const NavigationItem = ({ view, icon: Icon, label, activeView, setActiveView, isSidebarOpen, depth = 0, disabled = false }: { view: View, icon: any, label: string, activeView: View, setActiveView: (v: View) => void, isSidebarOpen: boolean, depth?: number, disabled?: boolean }) => (
  <button
    onClick={() => !disabled && setActiveView(view)}
    title={disabled ? `${label} (Registration Required)` : `Navigate to ${label}`}
    aria-label={`Navigate to ${label}`}
    disabled={disabled}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group
      ${disabled ? 'opacity-30 grayscale cursor-not-allowed hidden md:flex' : 'hover:bg-blue-600/10'}
      ${activeView === view
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
        : 'text-slate-400'
      }
      ${depth > 0 ? 'ml-4 py-2 border-l border-slate-800' : ''}
    `}
  >
    <div className={`transition-transform duration-300 ${activeView === view ? 'scale-110' : 'group-hover:scale-110'}`}>
      <Icon size={depth > 0 ? 18 : 20} strokeWidth={activeView === view ? 2.5 : 2} />
    </div>
    {isSidebarOpen && (
      <span className={`text-sm font-black tracking-tight ${activeView === view ? 'italic' : 'group-hover:italic transition-all'}`}>
        {label}
      </span>
    )}
    {activeView === view && isSidebarOpen && (
      <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_white]"></div>
    )}
  </button>
);

const App: React.FC = () => {
  const { alerts, showAlert, dismissAlert } = useAlerts();
  const { 
    currentUser, setCurrentUser, handleAuthLogin, 
    handleLogout, logoutMessage, setLogoutMessage 
  } = useAuth();
  
  const { 
    latestAppVersion, setLatestAppVersion, 
    showUpdateNotice, isUpdateDownloading, 
    updateDownloaded, handleUpdateNow, handleUpdateLater,
    setShowUpdateNotice
  } = useAppUpdate(showAlert);

  const {
      isInitialized, isSetupComplete, setIsSetupComplete,
      employees, setEmployees, companyProfile, setCompanyProfile,
      statutoryConfig, setStatutoryConfig,
      results, setResults,
      payrollPeriod, setPayrollPeriod,
      activeView, setActiveView,
      settingsTab, setSettingsTab,
      showRegistrationManual, setShowRegistrationManual,
      logoUrl, setLogoUrl,
      handleUpdateLogo,
      handleRegistrationComplete,
      isTrial, showTrialNotice, setShowTrialNotice,
      licenseStatus, setLicenseStatus,
      checkTrialStatus
  } = useAppInitialization(showAlert);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // --- RECOVERY & PERIODIC SYNC ---
  useEffect(() => {
    const runSync = async () => {
       if (licenseStatus.checked && licenseStatus.valid) {
          const updates = await checkNewMessages();
          if (updates) {
             if (updates.scrollNews) {
                setCompanyProfile(prev => ({ ...prev, flashNews: updates.scrollNews }));
              }
              if (updates.statutory) {
                setCompanyProfile(prev => ({ ...prev, postLoginMessage: updates.statutory }));
             }
             // Version is also checked here if available
             const v = localStorage.getItem('app_latest_version');
             if (v) setLatestAppVersion(v);
          }
       }
    };
    
    // Check for updates periodically
    const timer = setInterval(runSync, 4 * 60 * 60 * 1000); // Every 4 hours
    runSync(); // Initial run
    
    return () => clearInterval(timer);
  }, [licenseStatus.checked, licenseStatus.valid, setCompanyProfile, setLatestAppVersion]);

  // --- HIDE UPDATE NOTICE FOR DEVELOPERS ---
  useEffect(() => {
    if (currentUser?.role === 'Developer') {
      setShowUpdateNotice(false);
    }
  }, [currentUser, setShowUpdateNotice]);

  const handleUpdateLaterClick = () => {
    handleUpdateLater();
    showAlert('info', 'Update Scheduled', 'Update will be downloaded in the background for next startup.');
  };

  const handleManualSync = async () => {
    try {
      showAlert('info', 'Sync in Progress', 'Checking for license and configuration updates...');
      const success = await syncLicenseStatus();
      if (success) {
        showAlert('success', 'Sync Complete', 'System settings and license synchronized successfully.');
        // Briefly delay to let user see success before reload if many things changed
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showAlert('error', 'Sync Failed', 'Could not connect to sync service. Please check your internet connection.');
      }
    } catch (e) {
      showAlert('error', 'Sync Error', 'An error occurred during synchronization.');
    }
  };

  const handleLogoutAction = () => {
    showAlert(
      'warning',
      'Confirm Logout',
      'Are you sure you want to sign out?',
      () => {
        handleLogout();
        window.location.reload();
      },
      () => { /* cancel */ }
    );
  };

  if (!isInitialized) {
    return (
       <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center space-y-8 p-8">
          <div className="relative">
             <div className="absolute -inset-8 bg-blue-600/20 blur-3xl rounded-full animate-pulse"></div>
             <div className="relative w-48 h-48 rounded-full border-[8px] border-white/90 overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.3)] bg-[#020617] flex items-center justify-center p-2">
                <img src={BRAND_CONFIG.logoUrl} alt="Logo" className="w-full h-full object-cover" />
             </div>
          </div>
          <div className="flex flex-col items-center gap-4 text-center">
             <div className="flex items-center gap-3 animate-slow-pulse">
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_12px_#3b82f6]"></div>
                <h2 className="text-sm font-black text-blue-400 uppercase tracking-[0.4em] italic">Initializing Security Architecture</h2>
             </div>
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest max-w-[200px] leading-relaxed">Connecting to local database and verifying license integrity...</p>
          </div>
       </div>
    );
  }

  // --- STARTUP MODAL: Splash Screen shown during license check ---
  if (!licenseStatus.checked) {
    return (
      <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center z-[1000] space-y-8 animate-in fade-in duration-700">
        <div className="relative">
           <div className="absolute -inset-4 bg-blue-500/20 blur-2xl rounded-full animate-pulse"></div>
           <div className="relative w-36 h-36 rounded-full border-[6px] border-white overflow-hidden shadow-2xl bg-[#020617] flex items-center justify-center group-hover:scale-105 transition-transform duration-700">
              <img src={BRAND_CONFIG.logoUrl} alt="Startup Logo" className="w-full h-full object-cover" />
           </div>
        </div>
        <div className="flex items-center gap-3 animate-slow-pulse">
           <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_#3b82f6]"></div>
           <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Security Verification Underway Please Wait.....</p>
        </div>
      </div>
    );
  }

  // --- AUTH FLOW ---
  if (!currentUser) {
    // If not registered at all or registration forced
    if (!getStoredLicense() && (showRegistrationManual || (!isSetupComplete && employees.length === 0))) {
      return (
        <div className="min-h-screen bg-[#020617]">
          <Registration onComplete={handleRegistrationComplete} onRestore={() => window.location.reload()} showAlert={showAlert} />
          {/* Alerts Area */}
          <div className="fixed bottom-6 right-6 z-[2000] flex flex-col gap-4 max-w-sm">
            {alerts.map(alert => (
              <div key={alert.id} className={`p-4 rounded-2xl border shadow-2xl flex gap-3 animate-in slide-in-from-right-10 ${
                alert.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                alert.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                'bg-blue-500/10 border-blue-500/20 text-blue-400'
              }`}>
                <div className="shrink-0 pt-0.5">
                  {alert.type === 'success' ? <CheckCircle2 size={18} /> : 
                   alert.type === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-widest">{alert.title}</h4>
                  <p className="text-[11px] font-medium leading-relaxed opacity-90">{alert.message}</p>
                  {(alert.onConfirm || alert.onCancel) && (
                    <div className="pt-2 flex gap-3">
                      {alert.onConfirm && (
                        <button onClick={() => { alert.onConfirm!(); dismissAlert(alert.id); }} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[9px] font-black uppercase tracking-widest">Confirm</button>
                      )}
                      <button onClick={() => dismissAlert(alert.id)} className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest">{alert.onConfirm ? 'Cancel' : 'Dismiss'}</button>
                    </div>
                  )}
                </div>
                {!alert.onConfirm && (
                  <button onClick={() => dismissAlert(alert.id)} className="ml-auto flex shrink-0 hover:bg-white/10 p-1 rounded-md transition-colors h-fit"><Minimize size={14}/></button>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#020617]">
        <Login onLogin={handleAuthLogin} currentLogo={logoUrl} setLogo={handleUpdateLogo} logoutMessage={logoutMessage || undefined} />
        {/* Alerts Area */}
        <div className="fixed bottom-6 right-6 z-[2000] flex flex-col gap-4 max-w-sm">
          {alerts.map(alert => (
            <div key={alert.id} className={`p-4 rounded-2xl border shadow-2xl flex gap-3 animate-in slide-in-from-right-10 ${
              alert.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              alert.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
              'bg-blue-500/10 border-blue-500/20 text-blue-400'
            }`}>
              <div className="shrink-0 pt-0.5">
                {alert.type === 'success' ? <CheckCircle2 size={18} /> : 
                 alert.type === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-widest">{alert.title}</h4>
                <p className="text-[11px] font-medium leading-relaxed opacity-90">{alert.message}</p>
              </div>
              <button onClick={() => dismissAlert(alert.id)} className="ml-auto flex shrink-0 hover:bg-white/10 p-1 rounded-md transition-colors h-fit"><Minimize size={14}/></button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- APP SETUP FLOW (Unlocked after Login) ---
  if (!isSetupComplete && employees.length === 0) {
    return <AppSetup onComplete={() => setIsSetupComplete(true)} />;
  }

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-blue-600/30">
      
      {/* Sidebar Navigation */}
      <aside 
        className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900/40 backdrop-blur-3xl border-r border-slate-800 flex flex-col transition-all duration-500 ease-in-out relative z-40 group`}
      >
        {/* Floating Sidebar Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-24 w-6 h-6 bg-[#1e293b] border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-blue-600 transition-all shadow-lg z-50 md:flex hidden"
        >
          {isSidebarOpen ? <Minimize size={10} /> : <Maximize size={10} />}
        </button>

        {/* Sidebar Header: Logo & Branding */}
        <div className={`p-6 bg-gradient-to-b from-blue-600/5 to-transparent border-b border-slate-800/50 ${!isSidebarOpen && 'flex justify-center p-4'}`}>
          {isSidebarOpen ? (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-600/20 animate-in zoom-in duration-700">
                <img src={BRAND_CONFIG.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-2xl" />
              </div>
              <div className="animate-in slide-in-from-left-4 duration-500">
                <h1 className="text-lg font-black tracking-tighter leading-none italic uppercase">
                  {BRAND_CONFIG.appName}<span className="text-blue-500">{BRAND_CONFIG.appNameSuffix}</span>
                </h1>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Core Payroll OS</p>
              </div>
            </div>
          ) : (
             <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg overflow-hidden">
                <img src={BRAND_CONFIG.logoUrl} alt="Logo" className="w-full h-full object-cover" />
             </div>
          )}
        </div>

        {/* --- NAVIGATION LINKS --- */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar pr-2 mt-2">
          <div className="space-y-1">
            <p className={`text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-3 px-4 ${!isSidebarOpen && 'text-center truncate'}`}>Core Modules</p>
            <NavigationItem view={View.Dashboard} icon={LayoutDashboard} label="Operations" activeView={activeView} setActiveView={setActiveView} isSidebarOpen={isSidebarOpen} />
            <NavigationItem view={View.Employees} icon={Users} label="Employees" activeView={activeView} setActiveView={setActiveView} isSidebarOpen={isSidebarOpen} />
            <NavigationItem view={View.PayProcess} icon={Calculator} label="Pay Process" activeView={activeView} setActiveView={setActiveView} isSidebarOpen={isSidebarOpen} />
            <NavigationItem view={View.Reports} icon={FileText} label="Master Reports" activeView={activeView} setActiveView={setActiveView} isSidebarOpen={isSidebarOpen} />
            <NavigationItem view={View.Statutory} icon={ShieldCheck} label="Statutory" activeView={activeView} setActiveView={setActiveView} isSidebarOpen={isSidebarOpen} />
          </div>

          <div className="pt-6 space-y-1">
            <p className={`text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-3 px-4 ${!isSidebarOpen && 'text-center truncate'}`}>MIS & Tools</p>
            <NavigationItem view={View.MIS} icon={BarChart3} label="MIS Analytics" activeView={activeView} setActiveView={setActiveView} isSidebarOpen={isSidebarOpen} />
            <NavigationItem view={View.PFCalculator} icon={Calculator} label="PF Expert" activeView={activeView} setActiveView={setActiveView} isSidebarOpen={isSidebarOpen} />
            <NavigationItem view={View.Utilities} icon={Wrench} label="Utilities" activeView={activeView} setActiveView={setActiveView} isSidebarOpen={isSidebarOpen} />
            <NavigationItem view={View.AI_Assistant} icon={Bot} label="Bharat AI" activeView={activeView} setActiveView={setActiveView} isSidebarOpen={isSidebarOpen} />
          </div>
        </nav>

        {/* Sidebar Footer: User & Settings */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/20">
          <NavigationItem view={View.Settings} icon={SettingsIcon} label="Configurations" activeView={activeView} setActiveView={setActiveView} isSidebarOpen={isSidebarOpen} />
          
          <div className={`mt-4 pt-4 border-t border-slate-800 flex items-center gap-3 ${!isSidebarOpen && 'justify-center p-0'}`}>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shrink-0 shadow-lg ${!isSidebarOpen && 'scale-90'}`}>
                <span className="text-xs font-black uppercase">{currentUser.name.charAt(0)}</span>
            </div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-white truncate italic uppercase">{currentUser.name}</p>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest truncate">{currentUser.role}</p>
              </div>
            )}
            {isSidebarOpen && (
              <button 
                onClick={handleLogoutAction}
                className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Modern Header Bar */}
        <header className="h-16 bg-slate-950/20 backdrop-blur-xl border-b border-slate-800 flex items-center justify-between px-8 z-30 relative overflow-hidden">
            {/* Glossy Header Highlight */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
            
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <CalendarClock size={16} className="text-blue-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Current Period:</span>
                    <span className="text-xs font-black text-white px-3 py-1 bg-blue-600/10 border border-blue-500/20 rounded-full">
                       {payrollPeriod.month} {payrollPeriod.year}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Manual Sync Button */}
                <button 
                  onClick={handleManualSync}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700 border border-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                  title="Force Sync with Cloud"
                >
                  <RefreshCw size={14} className="text-blue-400" />
                  Sync Configuration
                </button>

                <div className="h-8 w-[1px] bg-slate-800 mx-2"></div>

                <div className="flex items-center gap-3">
                   <div className="text-right flex flex-col items-end">
                      <p className="text-[10px] font-black text-white leading-none uppercase tracking-tighter italic">
                        {companyProfile?.establishmentName || 'Configure Establishment'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                         <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_#10b981]"></div>
                         <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em]">Online Local DB</p>
                      </div>
                   </div>
                </div>
            </div>
        </header>

        {/* Dashboard Content Container */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
          {/* Main View Manager */}
          <div className="p-8 max-w-[1920px] mx-auto min-h-full animate-in fade-in slide-in-from-bottom-5 duration-700">
             {activeView === View.Dashboard && 
                <Dashboard 
                  setActiveView={setActiveView} 
                  employees={employees} 
                  results={results} 
                  showAlert={showAlert}
                />
             }
             {activeView === View.Employees && <EmployeeList employees={employees} setEmployees={setEmployees} showAlert={showAlert} />}
             {activeView === View.PayProcess && <PayProcess employees={employees} statutoryConfig={statutoryConfig} results={results} setResults={setResults} payrollPeriod={payrollPeriod} setPayrollPeriod={setPayrollPeriod} showAlert={showAlert} />}
             {activeView === View.Reports && <Reports results={results} employees={employees} companyProfile={companyProfile} statutoryConfig={statutoryConfig} showAlert={showAlert} />}
             {activeView === View.Statutory && <StatutoryReports results={results} employees={employees} companyProfile={companyProfile} statutoryConfig={statutoryConfig} showAlert={showAlert} />}
             {activeView === View.Utilities && <Utilities employees={employees} setEmployees={setEmployees} results={results} setResults={setResults} companyProfile={companyProfile} statutoryConfig={statutoryConfig} showAlert={showAlert} />}
             {activeView === View.Settings && <Settings companyProfile={companyProfile} setCompanyProfile={setCompanyProfile} statutoryConfig={statutoryConfig} setStatutoryConfig={setStatutoryConfig} activeTab={settingsTab} setActiveTab={setSettingsTab} />}
             {activeView === View.AI_Assistant && <AIAssistant employees={employees} results={results} companyProfile={companyProfile} />}
             {activeView === View.PFCalculator && <PFCalculator employees={employees} />}
             {activeView === View.MIS && <MISDashboard employees={employees} results={results} companyProfile={companyProfile} />}
          </div>
        </div>

        {/* Global Footer Status Bar */}
        <footer className="h-8 bg-slate-900 border-t border-slate-800/50 flex items-center justify-between px-8 relative z-30">
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-1.5">
                 <ShieldCheck size={12} className="text-blue-500" />
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">License: {isTrial ? 'Evaluation Trial' : 'Enterprise Professional'}</p>
              </div>
              <div className="flex items-center gap-1.5 border-l border-slate-800 pl-6">
                 <Database size={12} className="text-slate-500" />
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">Engine: V7.21 (React-Vite-Electron Core)</p>
              </div>
           </div>
           
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">BPP Build {APP_VERSION}</p>
              </div>
           </div>
        </footer>

        {/* Global Alert Notification Center */}
        <div className="fixed bottom-12 right-6 z-[2000] flex flex-col gap-4 max-w-sm">
          {alerts.map(alert => (
            <div key={alert.id} className={`p-4 rounded-2xl border shadow-2xl flex gap-3 animate-in slide-in-from-right-10 ${
              alert.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              alert.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
              alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
              'bg-blue-500/10 border-blue-500/20 text-blue-400'
            }`}>
              <div className="shrink-0 pt-0.5">
                {alert.type === 'success' ? <CheckCircle2 size={18} /> : 
                 alert.type === 'error' ? <AlertCircle size={18} /> : 
                 alert.type === 'warning' ? <ShieldAlert size={18} /> : <Info size={18} />}
              </div>
              <div className="space-y-1 flex-1">
                <h4 className="text-xs font-black uppercase tracking-widest">{alert.title}</h4>
                <p className="text-[11px] font-medium leading-relaxed opacity-90">{alert.message}</p>
                {(alert.onConfirm || alert.onCancel) && (
                  <div className="pt-2 flex gap-3">
                    {alert.onConfirm && (
                      <button 
                        onClick={() => { alert.onConfirm!(); dismissAlert(alert.id); }} 
                        className="px-4 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors"
                      >
                        Confirm
                      </button>
                    )}
                    <button 
                      onClick={() => { if (alert.onCancel) alert.onCancel(); dismissAlert(alert.id); }} 
                      className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors text-slate-400"
                    >
                      {alert.onConfirm ? 'Cancel' : 'Dismiss'}
                    </button>
                  </div>
                )}
              </div>
              {!alert.onConfirm && (
                <button 
                  onClick={() => dismissAlert(alert.id)} 
                  className="ml-auto flex shrink-0 hover:bg-white/10 p-1 rounded-md transition-colors h-fit"
                >
                  <Minimize size={14}/>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Trial Periodic Notice Overlay */}
        {showTrialNotice && (
          <TrialNoticeModal
            expiryDate={getStoredLicense()?.expiryDate || ''}
            pricing={localStorage.getItem('app_pricing') || undefined}
            employeeCount={employees.length}
            onClose={() => setShowTrialNotice(false)}
          />
        )}

        {/* Update Notice Modal */}
        {showUpdateNotice && (
           <div className="fixed inset-0 z-[2100] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4">
              <div className="bg-[#1e293b] w-full max-w-lg rounded-[2.5rem] border border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.2)] overflow-hidden animate-in zoom-in-95 duration-300">
                 <div className="p-10 text-center space-y-8">
                    <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto text-blue-500 animate-bounce-slow">
                       <Download size={40} />
                    </div>
                    
                    <div className="space-y-3">
                       <h3 className="text-2xl font-black text-white italic tracking-tight uppercase">Update Available!</h3>
                       <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">New Version: {latestAppVersion}</span>
                       </div>
                    </div>

                    <p className="text-slate-400 font-bold text-sm leading-relaxed">
                       A critical system update is ready. For enhanced security and statutory compliance, it is recommended to update now.
                    </p>

                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 flex items-center justify-center gap-3">
                       <Info size={16} className="text-blue-500" />
                       <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Your configuration will be automatically backed up.</span>
                    </div>

                    <div className="space-y-4">
                       <button
                         onClick={() => handleUpdateNow(async () => {})}
                         disabled={isUpdateDownloading}
                         className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 group"
                       >
                         {isUpdateDownloading ? (
                           <>
                             <Loader2 size={18} className="animate-spin" />
                             Downloading...
                           </>
                         ) : (
                           <>
                             Download & Install Now
                             <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                           </>
                         )}
                       </button>
                       <button
                         onClick={handleUpdateLaterClick}
                         disabled={isUpdateDownloading}
                         className="text-slate-500 hover:text-slate-300 text-[10px] font-black uppercase tracking-widest transition-colors block mx-auto pt-2"
                       >
                         Skip for Now (Update in Background)
                       </button>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* Global Action Loader (Overlay) */}
        {isUpdateDownloading && (
           <div className="fixed inset-0 z-[3000] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                 <div className="absolute inset-0 bg-blue-600/20 blur-3xl rounded-full animate-pulse"></div>
                 <div className="w-24 h-24 border-b-2 border-blue-500 rounded-full animate-spin"></div>
              </div>
              <div className="text-center space-y-2 animate-pulse">
                <p className="text-xs font-black text-blue-400 uppercase tracking-[0.3em]">Downloading System Assets</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Please do not close the application...</p>
              </div>
           </div>
        )}

      </main>
    </div>
  );
};

export default App;
