
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
  MessageSquare
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
  AdvanceLedger 
} from './types';
import { 
  INITIAL_STATUTORY_CONFIG, 
  INITIAL_COMPANY_PROFILE, 
  DEFAULT_LEAVE_POLICY, 
  BRAND_CONFIG, 
  SAMPLE_EMPLOYEES 
} from './constants';

// Internal Shell Component that holds all logic
const PayrollShell: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  // Initialize User from Session Storage to persist across reloads
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('app_session_user');
      if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.role) {
              return parsed;
          }
      }
      return null;
    } catch (e) {
      return null;
    }
  });

  const [activeView, setActiveView] = useState<View>(View.Dashboard);
  const mainContentRef = useRef<HTMLElement>(null);
  
  const [globalMonth, setGlobalMonth] = useState<string>(() => {
      try {
          const savedHistory = localStorage.getItem('app_payroll_history');
          if (savedHistory) {
              const parsed: PayrollResult[] = JSON.parse(savedHistory);
              if (parsed.length > 0) {
                  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                  const sorted = parsed.sort((a, b) => {
                      if (a.year !== b.year) return b.year - a.year;
                      return months.indexOf(b.month) - months.indexOf(a.month);
                  });
                  return sorted[0].month;
              }
          }
      } catch(e) {}
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return months[new Date().getMonth()];
  });

  const [globalYear, setGlobalYear] = useState<number>(() => {
      try {
          const savedHistory = localStorage.getItem('app_payroll_history');
          if (savedHistory) {
              const parsed: PayrollResult[] = JSON.parse(savedHistory);
              if (parsed.length > 0) {
                  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                  const sorted = parsed.sort((a, b) => {
                      if (a.year !== b.year) return b.year - a.year;
                      return months.indexOf(b.month) - months.indexOf(a.month);
                  });
                  return sorted[0].year;
              }
          }
      } catch(e) {}
      return new Date().getFullYear();
  });

  const [settingsTab, setSettingsTab] = useState<'STATUTORY' | 'COMPANY' | 'DATA' | 'DEVELOPER'>('STATUTORY');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showLoginMessage, setShowLoginMessage] = useState(false);

  // --- SAFE STORAGE HELPER ---
  const safeSave = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e: any) {
      console.error(`Failed to save ${key}:`, e);
      if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
        alert("⚠️ Storage Limit Exceeded! \n\nYour browser's local storage is full. Please remove large images or use the 'Factory Reset' in Settings to clear old data.");
      }
    }
  };

  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
        const saved = localStorage.getItem('app_employees');
        return saved ? JSON.parse(saved) : SAMPLE_EMPLOYEES;
    } catch (e) { return SAMPLE_EMPLOYEES; }
  });

  const [config, setConfig] = useState<StatutoryConfig>(() => {
    try {
        const saved = localStorage.getItem('app_config');
        return saved ? JSON.parse(saved) : INITIAL_STATUTORY_CONFIG;
    } catch (e) { return INITIAL_STATUTORY_CONFIG; }
  });

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => {
    try {
        const saved = localStorage.getItem('app_company_profile');
        return saved ? JSON.parse(saved) : INITIAL_COMPANY_PROFILE;
    } catch (e) { return INITIAL_COMPANY_PROFILE; }
  });
  
  // FIX: Updated loader to handle stringified strings (safely handling data restoration bugs)
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    try {
      const savedLogo = localStorage.getItem('app_logo');
      if (savedLogo) {
          // If stored via safeSave (JSON.stringify), it will start with a quote
          if (savedLogo.startsWith('"')) {
              try {
                  return JSON.parse(savedLogo);
              } catch (e) {
                  return savedLogo;
              }
          }
          return savedLogo;
      }
      return BRAND_CONFIG.logoUrl;
    } catch (e) {
      return BRAND_CONFIG.logoUrl;
    }
  });

  const [leavePolicy, setLeavePolicy] = useState<LeavePolicy>(() => {
    try {
        const saved = localStorage.getItem('app_leave_policy');
        return saved ? JSON.parse(saved) : DEFAULT_LEAVE_POLICY;
    } catch (e) { return DEFAULT_LEAVE_POLICY; }
  });
  
  const handleUpdateLogo = (url: string) => {
    setLogoUrl(url);
    safeSave('app_logo', url);
  };

  // Masters
  const [designations, setDesignations] = useState<string[]>(() => {
     try { return JSON.parse(localStorage.getItem('app_master_designations') || '[]').length ? JSON.parse(localStorage.getItem('app_master_designations')!) : ['Software Engineer', 'Project Manager', 'HR Manager', 'Accounts Executive', 'Peon']; } catch(e) { return ['Software Engineer', 'Project Manager', 'HR Manager', 'Accounts Executive', 'Peon']; }
  });
  const [divisions, setDivisions] = useState<string[]>(() => {
     try { return JSON.parse(localStorage.getItem('app_master_divisions') || '[]').length ? JSON.parse(localStorage.getItem('app_master_divisions')!) : ['Head Office', 'Manufacturing', 'Sales', 'Marketing', 'Engineering']; } catch(e) { return ['Head Office', 'Manufacturing', 'Sales', 'Marketing', 'Engineering']; }
  });
  const [branches, setBranches] = useState<string[]>(() => {
     try { return JSON.parse(localStorage.getItem('app_master_branches') || '[]').length ? JSON.parse(localStorage.getItem('app_master_branches')!) : ['Chennai', 'New Delhi', 'Mumbai', 'Bangalore']; } catch(e) { return ['Chennai', 'New Delhi', 'Mumbai', 'Bangalore']; }
  });
  const [sites, setSites] = useState<string[]>(() => {
     try { return JSON.parse(localStorage.getItem('app_master_sites') || '[]').length ? JSON.parse(localStorage.getItem('app_master_sites')!) : ['Main Plant', 'Warehouse A', 'IT Park Office', 'Site-01']; } catch(e) { return ['Main Plant', 'Warehouse A', 'IT Park Office', 'Site-01']; }
  });

  const [attendances, setAttendances] = useState<Attendance[]>(() => {
    try {
      const saved = localStorage.getItem('app_attendance');
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error("Error loading attendance", e); }
    return [];
  });

  const [leaveLedgers, setLeaveLedgers] = useState<LeaveLedger[]>(() => {
    try {
      const saved = localStorage.getItem('app_leave_ledgers');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const [advanceLedgers, setAdvanceLedgers] = useState<AdvanceLedger[]>(() => {
    try {
      const saved = localStorage.getItem('app_advance_ledgers');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const [payrollHistory, setPayrollHistory] = useState<PayrollResult[]>(() => {
    try {
        const saved = localStorage.getItem('app_payroll_history');
        return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

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

  useLayoutEffect(() => {
    if (mainContentRef.current) {
        mainContentRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeView, currentUser]);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  };

  useEffect(() => {
      if (currentUser && companyProfile.postLoginMessage && companyProfile.postLoginMessage.trim() !== '') {
          setShowLoginMessage(true);
      }
  }, [currentUser]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleAddEmployee = (newEmp: Employee) => {
    const updatedEmployees = [...employees, newEmp];
    setEmployees(updatedEmployees);
    setAttendances(prev => [...prev, { employeeId: newEmp.id, month: globalMonth, year: globalYear, presentDays: 30, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 }]);
    setLeaveLedgers(prev => [...prev, {
        employeeId: newEmp.id,
        el: { opening: 0, eligible: 1.5, encashed: 0, availed: 0, balance: 1.5 },
        sl: { eligible: 1, availed: 0, balance: 1 },
        cl: { availed: 0, accumulation: 0, balance: 0 }
    }]);
    setAdvanceLedgers(prev => [...prev, { employeeId: newEmp.id, opening: 0, totalAdvance: 0, monthlyInstallment: 0, paidAmount: 0, balance: 0 }]);
  };

  const handleBulkAddEmployees = (newEmps: Employee[]) => {
    setEmployees(currentEmployees => {
      const empMap = new Map<string, Employee>();
      currentEmployees.forEach(e => empMap.set(e.id, e));
      newEmps.forEach(newEmp => {
        const existing = empMap.get(newEmp.id);
        if (existing) {
             empMap.set(newEmp.id, {
                 ...newEmp,
                 photoUrl: existing.photoUrl,
                 serviceRecords: [...existing.serviceRecords, ...newEmp.serviceRecords]
             });
        } else {
             empMap.set(newEmp.id, newEmp);
        }
      });
      return Array.from(empMap.values());
    });
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('app_session_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('app_session_user');
    setActiveView(View.Dashboard);
  };

  const handleDashboardNavigation = (view: View, tab?: string) => {
      setActiveView(view);
      if (view === View.Settings) {
          if (tab) {
              setSettingsTab(tab as any);
          } else {
              setSettingsTab('STATUTORY');
          }
      }
  };

  const getFinancialYearLabel = () => {
    const isJanToMar = ['January', 'February', 'March'].includes(globalMonth);
    const startYear = isJanToMar ? globalYear - 1 : globalYear;
    const endYear = startYear + 1;
    return `FY ${String(startYear).slice(-2)}-${String(endYear).slice(-2)} ACTIVE`;
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} currentLogo={logoUrl} setLogo={handleUpdateLogo} />;
  }

  const NavigationItem = ({ view, icon: Icon, label, depth = 0 }: { view: View, icon: any, label: string, depth?: number }) => (
    <button
      onClick={() => setActiveView(view)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
        activeView === view 
          ? 'bg-blue-500 text-white shadow-lg' 
          : 'text-slate-300 hover:bg-blue-900/50 hover:text-white'
      } ${depth > 0 ? 'ml-2 border-l border-slate-700 pl-4 w-[95%]' : ''}`}
    >
      <Icon size={depth > 0 ? 18 : 20} className={depth > 0 ? "opacity-80" : ""} />
      {isSidebarOpen && <span className={`font-medium ${depth > 0 ? 'text-sm' : ''}`}>{label}</span>}
    </button>
  );

  const SidebarHeader = ({ title }: { title: string }) => (
     isSidebarOpen ? <div className="px-4 mt-6 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</div> : <div className="mt-4 mb-2 border-t border-slate-800"></div>
  );

  const isSettingsAccessible = currentUser.role === 'Developer' || currentUser.role === 'Administrator';

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#020617] text-white">
      {showLoginMessage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#1e293b] w-full max-w-lg rounded-2xl border border-blue-500/50 shadow-2xl p-0 flex flex-col gap-0 relative overflow-hidden">
                <div className="bg-blue-900/30 p-4 border-b border-blue-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="text-blue-400" size={20} />
                        <h3 className="font-bold text-white">System Notice</h3>
                    </div>
                    <button onClick={() => setShowLoginMessage(false)} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 bg-[#0f172a]/50">
                    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                        {companyProfile.postLoginMessage}
                    </div>
                </div>
                <div className="p-4 bg-[#1e293b] border-t border-slate-800 flex justify-end">
                    <button onClick={() => setShowLoginMessage(false)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition-colors text-sm">OK, I Understand</button>
                </div>
            </div>
        </div>
      )}

      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-[#0f172a] border-r border-slate-800 flex flex-col`}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-[#4169E1] p-2 rounded-lg text-white shrink-0 shadow-lg shadow-blue-500/20">
            <IndianRupee size={24} className="text-[#FF9933]" />
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight leading-none">
                    <span className="text-[#FF9933]">Bharat</span>
                    <span className="text-white">Pay</span>
                    <span className="text-[#4ADE80] ml-0.5">Pro</span>
                </span>
                <span className="text-[10px] font-bold text-white mt-1.5 tracking-wider uppercase opacity-80">Powered by ILCbala</span>
            </div>
          )}
        </div>
        
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
          <NavigationItem view={View.Dashboard} icon={LayoutDashboard} label="Dashboard" />
          <NavigationItem view={View.Employees} icon={Users} label="Employee Master" />
          <SidebarHeader title="Pay Process" />
          <NavigationItem view={View.PayProcess} icon={CalendarClock} label="Process Payroll" />
          <SidebarHeader title="Analytics" />
          <NavigationItem view={View.Reports} icon={FileText} label="Pay Reports" />
          <NavigationItem view={View.Statutory} icon={ShieldCheck} label="Statutory Reports" />
          <NavigationItem view={View.PFCalculator} icon={Calculator} label="PF ECR Calculator" />
          <SidebarHeader title="System" />
          <NavigationItem view={View.Utilities} icon={Wrench} label="Utilities" />
          <NavigationItem view={View.AI_Assistant} icon={Bot} label="Compliance AI" />
          {isSettingsAccessible && (
            <NavigationItem view={View.Settings} icon={SettingsIcon} label="Configuration" />
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-[#0b1120]">
          {isSidebarOpen ? (
             <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 border border-slate-600 shrink-0">
                    <UserCircle size={24} />
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
                    <p className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">{currentUser.role}</p>
                </div>
             </div>
          ) : (
             <div className="flex justify-center mb-4">
                 <UserCircle size={24} className="text-slate-400" />
             </div>
          )}
          <button onClick={handleLogout} className={`w-full flex items-center ${isSidebarOpen ? 'justify-start gap-3 px-4' : 'justify-center'} py-2.5 rounded-lg text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors`}>
            <LogOut size={18} />
            {isSidebarOpen && <span className="font-bold text-sm">Sign Out</span>}
          </button>
        </div>

        <div className="p-2 border-t border-slate-800">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-full flex justify-center p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
      </aside>

      <main ref={mainContentRef} className="flex-1 overflow-y-auto">
        <header className="bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-800 h-20 flex items-center justify-between px-8 sticky top-0 z-10 gap-6">
          <div className="shrink-0 max-w-[30%]">
            <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-2 truncate">
               <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0 border border-slate-600">
                  <img src={logoUrl} alt="Establishment Logo" className="w-full h-full object-cover" />
               </div>
               <span className="truncate">{companyProfile.establishmentName || BRAND_CONFIG.companyName}</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-bold pl-11 flex items-center gap-1.5 mt-1 truncate">
               <MapPin size={10} className="text-slate-500 shrink-0" />
               {companyProfile.city ? `${companyProfile.city}, ${companyProfile.state}` : 'Corporate HQ • Industrial Estate, Chennai, TN'}
            </p>
          </div>
          <div className="flex-1 flex flex-col justify-center overflow-hidden h-full max-w-[45%] gap-1">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border border-slate-800 rounded-lg w-full relative overflow-hidden group">
                <div className="shrink-0 p-1.5 bg-amber-900/30 rounded text-amber-400 z-10 border border-amber-900/30">
                    <Megaphone size={14} className="animate-pulse" />
                </div>
                <div className="overflow-hidden relative w-full h-5 flex items-center">
                    <div className="animate-marquee whitespace-nowrap text-xs font-bold text-amber-100 uppercase tracking-widest absolute">
                        {companyProfile.flashNews || 'Welcome to BharatPay Pro! Stay compliant with latest labour laws.'}
                    </div>
                </div>
                <div className="absolute left-10 top-0 bottom-0 w-4 bg-gradient-to-r from-slate-900/90 to-transparent z-10 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-slate-900/90 to-transparent z-10 pointer-events-none"></div>
             </div>
             <a href="https://www.youtube.com/@ILCbala" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 hover:text-red-400 transition-colors">
                <Youtube size={12} className="text-red-500" />
                Labour Laws and Hon'ble Court judgments -Decoded
             </a>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <button onClick={toggleFullScreen} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-full border border-slate-700 transition-all hover:scale-105 shadow-lg" title={isFullScreen ? "Exit Full Screen" : "Enter Full Screen"}>
                {isFullScreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
            <div className="relative group overflow-hidden rounded-full p-[1px]">
              <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#059669_0%,#3b82f6_50%,#059669_100%)]" />
              <div className="inline-flex h-full w-full items-center justify-center rounded-full bg-[#0f172a] px-5 py-2 backdrop-blur-3xl">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 duration-1000"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-black tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-sky-400 to-emerald-400 animate-pulse whitespace-nowrap">
                    {getFinancialYearLabel()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto">
          {activeView === View.Dashboard && <Dashboard employees={employees} config={config} companyProfile={companyProfile} attendances={attendances} leaveLedgers={leaveLedgers} advanceLedgers={advanceLedgers} month={globalMonth} year={globalYear} setMonth={setGlobalMonth} setYear={setGlobalYear} onNavigate={handleDashboardNavigation} />}
          {activeView === View.Statutory && <StatutoryReports payrollHistory={payrollHistory} employees={employees} config={config} companyProfile={companyProfile} globalMonth={globalMonth} setGlobalMonth={setGlobalMonth} globalYear={globalYear} setGlobalYear={setGlobalYear} attendances={attendances} leaveLedgers={leaveLedgers} advanceLedgers={advanceLedgers} />}
          {activeView === View.Employees && <EmployeeList employees={employees} setEmployees={setEmployees} onAddEmployee={handleAddEmployee} designations={designations} divisions={divisions} branches={branches} sites={sites} currentUser={currentUser} companyProfile={companyProfile} />}
          {activeView === View.PayProcess && <PayProcess employees={employees} config={config} companyProfile={companyProfile} attendances={attendances} setAttendances={setAttendances} leaveLedgers={leaveLedgers} setLeaveLedgers={setLeaveLedgers} advanceLedgers={advanceLedgers} setAdvanceLedgers={setAdvanceLedgers} savedRecords={payrollHistory} setSavedRecords={setPayrollHistory} leavePolicy={leavePolicy} month={globalMonth} setMonth={setGlobalMonth} year={globalYear} setYear={setGlobalYear} currentUser={currentUser} />}
          {activeView === View.Reports && <Reports employees={employees} config={config} companyProfile={companyProfile} attendances={attendances} savedRecords={payrollHistory} setSavedRecords={setPayrollHistory} month={globalMonth} year={globalYear} setMonth={setGlobalMonth} setYear={setGlobalYear} leaveLedgers={leaveLedgers} setLeaveLedgers={setLeaveLedgers} advanceLedgers={advanceLedgers} setAdvanceLedgers={setAdvanceLedgers} currentUser={currentUser} />}
          {activeView === View.Utilities && <Utilities designations={designations} setDesignations={setDesignations} divisions={divisions} setDivisions={setDivisions} branches={branches} setBranches={setBranches} sites={sites} setSites={setSites} />}
          {activeView === View.PFCalculator && <PFCalculator employees={employees} payrollHistory={payrollHistory} config={config} companyProfile={companyProfile} month={globalMonth} setMonth={setGlobalMonth} year={globalYear} setYear={setGlobalYear} />}
          {activeView === View.Settings && isSettingsAccessible && <Settings config={config} setConfig={setConfig} companyProfile={companyProfile} setCompanyProfile={setCompanyProfile} currentLogo={logoUrl} setLogo={handleUpdateLogo} leavePolicy={leavePolicy} setLeavePolicy={setLeavePolicy} onRestore={onRefresh} initialTab={settingsTab} userRole={currentUser?.role} currentUser={currentUser} />}
          {activeView === View.AI_Assistant && <AIAssistant />}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };
  return <PayrollShell key={refreshKey} onRefresh={handleRefresh} />;
};

export default App;
