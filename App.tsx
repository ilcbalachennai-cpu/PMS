import React, { useState, useEffect } from 'react';
import { 
  Users, 
  LayoutDashboard, 
  Calculator, 
  FileText, 
  Settings as SettingsIcon, 
  Bot,
  Menu,
  X,
  IndianRupee,
  CalendarDays,
  Wallet,
  ClipboardList,
  Wrench,
  LogOut,
  UserCircle,
  ShieldCheck,
  Building2,
  MapPin,
  CalendarClock
} from 'lucide-react';
import { View, Employee, StatutoryConfig, Attendance, LeaveLedger, AdvanceLedger, User, PayrollResult, LeavePolicy } from './types';
import { SAMPLE_EMPLOYEES, INITIAL_STATUTORY_CONFIG, BRAND_CONFIG, DEFAULT_LEAVE_POLICY } from './constants';
import Dashboard from './components/Dashboard';
import EmployeeList from './components/EmployeeList';
import PayrollProcessor from './components/PayrollProcessor';
import Reports from './components/Reports';
import StatutoryReports from './components/StatutoryReports';
import Settings from './components/Settings';
import AIAssistant from './components/AIAssistant';
import AttendanceManager from './components/AttendanceManager';
import LedgerManager from './components/LedgerManager';
import Utilities from './components/Utilities';
import PayProcess from './components/PayProcess';
import Login from './components/Login';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<View>(View.Dashboard);
  
  // --- GLOBAL DATE STATE (To ensure persistence across views) ---
  const [globalMonth, setGlobalMonth] = useState<string>('November');
  const [globalYear, setGlobalYear] = useState<number>(2024);

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

  // Initialize Employees
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
  
  // Initialize logo from localStorage if available
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    try {
      const savedLogo = localStorage.getItem('app_logo');
      return savedLogo || BRAND_CONFIG.logoUrl;
    } catch (e) {
      return BRAND_CONFIG.logoUrl;
    }
  });

  // Leave Policy State
  const [leavePolicy, setLeavePolicy] = useState<LeavePolicy>(() => {
    try {
        const saved = localStorage.getItem('app_leave_policy');
        return saved ? JSON.parse(saved) : DEFAULT_LEAVE_POLICY;
    } catch (e) { return DEFAULT_LEAVE_POLICY; }
  });
  
  // Handler to update logo state and persist to localStorage
  const handleUpdateLogo = (url: string) => {
    setLogoUrl(url);
    safeSave('app_logo', url);
  };

  // Masters state for Utilities
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

  // --- PERSISTENCE LOGIC START ---

  // Initialize Attendance from LocalStorage
  const [attendances, setAttendances] = useState<Attendance[]>(() => {
    try {
      const saved = localStorage.getItem('app_attendance');
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error("Error loading attendance", e); }
    
    // Default fallback
    return employees.map(e => ({ 
        employeeId: e.id, 
        month: globalMonth, 
        year: globalYear, 
        presentDays: 31, 
        earnedLeave: 0, 
        sickLeave: 0, 
        casualLeave: 0, 
        lopDays: 0 
    }));
  });

  // Initialize Leave Ledgers with MIGRATION for new 'availed' field
  const [leaveLedgers, setLeaveLedgers] = useState<LeaveLedger[]>(() => {
    try {
      const saved = localStorage.getItem('app_leave_ledgers');
      if (saved) {
          const parsed = JSON.parse(saved);
          // Migration Logic: Ensure 'el' has 'availed' property if missing
          return parsed.map((l: any) => ({
              ...l,
              el: { ...l.el, availed: l.el.availed ?? 0 } // Add default availed: 0 if missing
          }));
      }
    } catch (e) {}

    return employees.map(e => ({
      employeeId: e.id,
      el: { opening: 10, eligible: 1.5, encashed: 0, availed: 0, balance: 11.5 },
      sl: { eligible: 1, availed: 0, balance: 1 },
      cl: { availed: 0, accumulation: 0, balance: 1 }
    }));
  });

  // Initialize Advance Ledgers from LocalStorage with MIGRATION for 'opening'
  const [advanceLedgers, setAdvanceLedgers] = useState<AdvanceLedger[]>(() => {
    try {
      const saved = localStorage.getItem('app_advance_ledgers');
      if (saved) {
          const parsed = JSON.parse(saved);
          // Migration: Add opening balance if missing
          return parsed.map((a: any) => ({
              ...a,
              opening: a.opening ?? 0, // Default to 0 if missing
              totalAdvance: a.totalAdvance || 0,
              monthlyInstallment: a.monthlyInstallment || 0,
              paidAmount: a.paidAmount || 0,
              // Recalculate balance to ensure consistency
              balance: (a.opening ?? 0) + (a.totalAdvance || 0) - (a.paidAmount || 0)
          }));
      }
    } catch (e) {}
    
    return employees.map(e => ({ employeeId: e.id, opening: 0, totalAdvance: 0, monthlyInstallment: 0, paidAmount: 0, balance: 0 }));
  });

  // Initialize Payroll History from LocalStorage
  const [payrollHistory, setPayrollHistory] = useState<PayrollResult[]>(() => {
    try {
        const saved = localStorage.getItem('app_payroll_history');
        return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  // --- EFFECT HOOKS FOR AUTO-SAVING ---
  
  useEffect(() => { safeSave('app_employees', employees); }, [employees]);
  useEffect(() => { safeSave('app_config', config); }, [config]);
  useEffect(() => { safeSave('app_attendance', attendances); }, [attendances]);
  useEffect(() => { safeSave('app_leave_ledgers', leaveLedgers); }, [leaveLedgers]);
  useEffect(() => { safeSave('app_advance_ledgers', advanceLedgers); }, [advanceLedgers]);
  useEffect(() => { safeSave('app_payroll_history', payrollHistory); }, [payrollHistory]);
  useEffect(() => { safeSave('app_leave_policy', leavePolicy); }, [leavePolicy]);
  
  // Save Masters
  useEffect(() => { safeSave('app_master_designations', designations); }, [designations]);
  useEffect(() => { safeSave('app_master_divisions', divisions); }, [divisions]);
  useEffect(() => { safeSave('app_master_branches', branches); }, [branches]);
  useEffect(() => { safeSave('app_master_sites', sites); }, [sites]);

  // --- PERSISTENCE LOGIC END ---

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
    // 1. Update Employees (Upsert Logic: Update if exists, else Add)
    setEmployees(currentEmployees => {
      // Explicitly type tuple to ensure map is Map<string, Employee>
      const empMap = new Map<string, Employee>();
      currentEmployees.forEach(e => empMap.set(e.id, e));
      
      newEmps.forEach(newEmp => {
        const existing = empMap.get(newEmp.id);
        if (existing) {
             // Merge to preserve data not available in Excel (like Photo)
             empMap.set(newEmp.id, {
                 ...newEmp,
                 photoUrl: existing.photoUrl,
                 // Append import log to service records
                 serviceRecords: [...existing.serviceRecords, ...newEmp.serviceRecords]
             });
        } else {
             empMap.set(newEmp.id, newEmp);
        }
      });
      return Array.from(empMap.values());
    });
    
    // 2. Initialize Associated Data (ONLY for completely new IDs)
    // We don't want to reset ledgers/attendance for existing employees being updated via Excel.
    const currentIds = new Set(employees.map(e => e.id));
    const trulyNewEmps = newEmps.filter(e => !currentIds.has(e.id));

    if (trulyNewEmps.length > 0) {
        // Initialize attendance for new employees
        const newAttendances = trulyNewEmps.map(e => ({ 
            employeeId: e.id, 
            month: globalMonth, 
            year: globalYear, 
            presentDays: 30, 
            earnedLeave: 0, 
            sickLeave: 0,
            casualLeave: 0,
            lopDays: 0 
        }));
        setAttendances(prev => [...prev, ...newAttendances]);

        // Initialize leave ledgers
        const newLeaves = trulyNewEmps.map(e => ({
            employeeId: e.id,
            el: { opening: 0, eligible: 1.5, encashed: 0, availed: 0, balance: 1.5 },
            sl: { eligible: 1, availed: 0, balance: 1 },
            cl: { availed: 0, accumulation: 0, balance: 0 }
        }));
        setLeaveLedgers(prev => [...prev, ...newLeaves]);

        // Initialize advance ledgers
        const newAdvances = trulyNewEmps.map(e => ({ 
            employeeId: e.id, 
            opening: 0,
            totalAdvance: 0, 
            monthlyInstallment: 0, 
            paidAmount: 0, 
            balance: 0 
        }));
        setAdvanceLedgers(prev => [...prev, ...newAdvances]);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveView(View.Dashboard);
  };

  // --- AUTHENTICATION CHECK ---
  // If no user is logged in, show the Login screen
  if (!currentUser) {
    return <Login onLogin={setCurrentUser} currentLogo={logoUrl} setLogo={handleUpdateLogo} />;
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

  return (
    <div className="flex min-h-screen bg-[#020617] text-white">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-[#0f172a] border-r border-slate-800 flex flex-col`}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-blue-600 p-2 rounded-lg text-white shrink-0"><IndianRupee size={24} /></div>
          {isSidebarOpen && <span className="text-xl font-bold tracking-tight">{BRAND_CONFIG.appName}<span className="text-blue-500">{BRAND_CONFIG.appNameSuffix}</span></span>}
        </div>
        
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
          {/* CORE MODULES */}
          <NavigationItem view={View.Dashboard} icon={LayoutDashboard} label="Dashboard" />
          <NavigationItem view={View.Employees} icon={Users} label="Employee Master" />
          
          {/* PAY PROCESS GROUP */}
          <SidebarHeader title="Pay Process" />
          <NavigationItem view={View.PayProcess} icon={CalendarClock} label="Process Payroll" />

          {/* ANALYTICS & REPORTS */}
          <SidebarHeader title="Analytics" />
          <NavigationItem view={View.Reports} icon={FileText} label="Pay Reports" />
          <NavigationItem view={View.Statutory} icon={ShieldCheck} label="Statutory Reports" />
          
          {/* SYSTEM TOOLS */}
          <SidebarHeader title="System" />
          <NavigationItem view={View.Utilities} icon={Wrench} label="Utilities" />
          <NavigationItem view={View.AI_Assistant} icon={Bot} label="Compliance AI" />
          <NavigationItem view={View.Settings} icon={SettingsIcon} label="Configuration" />
        </nav>

        {/* Branding Footer for ILCbala */}
        {isSidebarOpen && (
          <div className="px-6 py-4 border-t border-slate-800 bg-[#0b1120]">
            <div className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-white overflow-hidden shrink-0 border border-slate-600">
                 <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              </div>
              <div className="leading-tight overflow-hidden">
                <span className="text-[10px] text-slate-400 block tracking-widest uppercase">Powered By</span>
                <span className="text-xs font-bold text-slate-200 block truncate">{BRAND_CONFIG.companyName}</span>
              </div>
            </div>
          </div>
        )}

        {/* User Profile Section */}
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
          
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center ${isSidebarOpen ? 'justify-start gap-3 px-4' : 'justify-center'} py-2.5 rounded-lg text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors`}
          >
            <LogOut size={18} />
            {isSidebarOpen && <span className="font-bold text-sm">Sign Out</span>}
          </button>
        </div>

        <div className="p-2 border-t border-slate-800">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-full flex justify-center p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-800 h-20 flex items-center justify-between px-8 sticky top-0 z-10">
          {/* Replaced View Title with Company Info */}
          <div>
            <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
               <Building2 size={20} className="text-blue-500" />
               {BRAND_CONFIG.companyName}
            </h2>
            <p className="text-[10px] text-slate-400 font-bold pl-7 flex items-center gap-1.5 mt-1">
               <MapPin size={10} className="text-slate-500" />
               Corporate HQ • Industrial Estate, Chennai, TN
            </p>
          </div>
          
          {/* Enhanced FY Active Badge */}
          <div className="flex items-center gap-4">
            <div className="relative group overflow-hidden rounded-full p-[1px]">
              {/* Spinning Border Gradient */}
              <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#059669_0%,#3b82f6_50%,#059669_100%)]" />
              
              {/* Badge Content */}
              <div className="inline-flex h-full w-full items-center justify-center rounded-full bg-[#0f172a] px-5 py-2 backdrop-blur-3xl">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 duration-1000"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-black tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-sky-400 to-emerald-400 animate-pulse">
                    FY 24-25 ACTIVE
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto">
          {activeView === View.Dashboard && (
            <Dashboard 
              employees={employees} 
              config={config} 
              attendances={attendances} 
              leaveLedgers={leaveLedgers} 
              advanceLedgers={advanceLedgers}
              month={globalMonth}
              year={globalYear} 
            />
          )}
          {activeView === View.Statutory && (
            <StatutoryReports 
               payrollHistory={payrollHistory}
               employees={employees}
               config={config}
               globalMonth={globalMonth}
               setGlobalMonth={setGlobalMonth}
               globalYear={globalYear}
               setGlobalYear={setGlobalYear}
            />
          )}
          {activeView === View.Employees && (
            <EmployeeList 
              employees={employees} 
              setEmployees={setEmployees} 
              onAddEmployee={handleAddEmployee}
              onBulkAddEmployees={handleBulkAddEmployees}
              designations={designations}
              divisions={divisions}
              branches={branches}
              sites={sites}
            />
          )}
          
          {/* CONSOLIDATED PAY PROCESS VIEW */}
          {activeView === View.PayProcess && (
            <PayProcess 
                employees={employees}
                config={config}
                attendances={attendances}
                setAttendances={setAttendances}
                leaveLedgers={leaveLedgers}
                setLeaveLedgers={setLeaveLedgers}
                advanceLedgers={advanceLedgers}
                setAdvanceLedgers={setAdvanceLedgers}
                savedRecords={payrollHistory}
                setSavedRecords={setPayrollHistory}
                leavePolicy={leavePolicy}
                month={globalMonth}
                setMonth={setGlobalMonth}
                year={globalYear}
                setYear={setGlobalYear}
            />
          )}

          {activeView === View.Reports && (
            <Reports 
                employees={employees} 
                config={config} 
                attendances={attendances}
                savedRecords={payrollHistory}
                setSavedRecords={setPayrollHistory}
                month={globalMonth}
                year={globalYear}
                setMonth={setGlobalMonth}
                setYear={setGlobalYear}
                leaveLedgers={leaveLedgers}
                setLeaveLedgers={setLeaveLedgers}
                advanceLedgers={advanceLedgers}
                setAdvanceLedgers={setAdvanceLedgers}
            />
          )}
          {activeView === View.Utilities && (
            <Utilities 
              designations={designations} setDesignations={setDesignations}
              divisions={divisions} setDivisions={setDivisions}
              branches={branches} setBranches={setBranches}
              sites={sites} setSites={setSites}
            />
          )}
          {activeView === View.Settings && <Settings 
              config={config} 
              setConfig={setConfig} 
              currentLogo={logoUrl} 
              setLogo={handleUpdateLogo} 
              leavePolicy={leavePolicy} 
              setLeavePolicy={setLeavePolicy} 
          />}
          {activeView === View.AI_Assistant && <AIAssistant />}
        </div>
      </main>
    </div>
  );
};

export default App;