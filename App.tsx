import React, { useState, useEffect } from 'react';
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
  Network
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
  BRAND_CONFIG 
} from './constants';

const App: React.FC = () => {
  // Session State
  const [user, setUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<View>(View.Dashboard);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Global Date Context for Views
  const [globalMonth, setGlobalMonth] = useState<string>('October');
  const [globalYear, setGlobalYear] = useState<number>(2024);

  // Data State with Persistence Initialization
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('app_employees');
    return saved ? JSON.parse(saved) : [];
  });

  const [config, setConfig] = useState<StatutoryConfig>(() => {
    const saved = localStorage.getItem('app_config');
    return saved ? JSON.parse(saved) : INITIAL_STATUTORY_CONFIG;
  });

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => {
    const saved = localStorage.getItem('app_company_profile');
    return saved ? JSON.parse(saved) : INITIAL_COMPANY_PROFILE;
  });

  const [leavePolicy, setLeavePolicy] = useState<LeavePolicy>(() => {
    const saved = localStorage.getItem('app_leave_policy');
    return saved ? JSON.parse(saved) : DEFAULT_LEAVE_POLICY;
  });

  const [attendances, setAttendances] = useState<Attendance[]>(() => {
    const saved = localStorage.getItem('app_attendance');
    return saved ? JSON.parse(saved) : [];
  });

  const [leaveLedgers, setLeaveLedgers] = useState<LeaveLedger[]>(() => {
    const saved = localStorage.getItem('app_leave_ledgers');
    return saved ? JSON.parse(saved) : [];
  });

  const [advanceLedgers, setAdvanceLedgers] = useState<AdvanceLedger[]>(() => {
    const saved = localStorage.getItem('app_advance_ledgers');
    return saved ? JSON.parse(saved) : [];
  });

  const [payrollHistory, setPayrollHistory] = useState<PayrollResult[]>(() => {
    const saved = localStorage.getItem('app_payroll_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [designations, setDesignations] = useState<string[]>(() => {
    const saved = localStorage.getItem('app_master_designations');
    return saved ? JSON.parse(saved) : ['Manager', 'Engineer', 'Supervisor', 'Operator', 'Helper', 'Clerk'];
  });

  const [divisions, setDivisions] = useState<string[]>(() => {
    const saved = localStorage.getItem('app_master_divisions');
    return saved ? JSON.parse(saved) : ['Production', 'Quality', 'Maintenance', 'HR', 'Stores', 'Accounts'];
  });

  const [branches, setBranches] = useState<string[]>(() => {
    const saved = localStorage.getItem('app_master_branches');
    return saved ? JSON.parse(saved) : ['Chennai - HQ', 'Coimbatore', 'Madurai', 'Bangalore', 'Mumbai'];
  });

  const [sites, setSites] = useState<string[]>(() => {
    const saved = localStorage.getItem('app_master_sites');
    return saved ? JSON.parse(saved) : ['Factory A', 'Factory B', 'Warehouse', 'Corporate Office'];
  });

  const [appLogo, setAppLogo] = useState<string>(() => {
    return localStorage.getItem('app_logo') || BRAND_CONFIG.logoUrl;
  });

  // Persistence Effects
  useEffect(() => localStorage.setItem('app_employees', JSON.stringify(employees)), [employees]);
  useEffect(() => localStorage.setItem('app_config', JSON.stringify(config)), [config]);
  useEffect(() => localStorage.setItem('app_company_profile', JSON.stringify(companyProfile)), [companyProfile]);
  useEffect(() => localStorage.setItem('app_leave_policy', JSON.stringify(leavePolicy)), [leavePolicy]);
  useEffect(() => localStorage.setItem('app_attendance', JSON.stringify(attendances)), [attendances]);
  useEffect(() => localStorage.setItem('app_leave_ledgers', JSON.stringify(leaveLedgers)), [leaveLedgers]);
  useEffect(() => localStorage.setItem('app_advance_ledgers', JSON.stringify(advanceLedgers)), [advanceLedgers]);
  useEffect(() => localStorage.setItem('app_payroll_history', JSON.stringify(payrollHistory)), [payrollHistory]);
  
  useEffect(() => localStorage.setItem('app_master_designations', JSON.stringify(designations)), [designations]);
  useEffect(() => localStorage.setItem('app_master_divisions', JSON.stringify(divisions)), [divisions]);
  useEffect(() => localStorage.setItem('app_master_branches', JSON.stringify(branches)), [branches]);
  useEffect(() => localStorage.setItem('app_master_sites', JSON.stringify(sites)), [sites]);
  
  useEffect(() => {
    if (appLogo) localStorage.setItem('app_logo', appLogo);
  }, [appLogo]);

  // Session Persistence
  useEffect(() => {
    const session = localStorage.getItem('app_session_user');
    if (session) {
      setUser(JSON.parse(session));
    }
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('app_session_user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('app_session_user');
    setActiveView(View.Dashboard);
  };

  const handleAddEmployee = (newEmp: Employee) => {
    setEmployees([...employees, newEmp]);
    // Initialize Ledgers
    setLeaveLedgers([...leaveLedgers, {
      employeeId: newEmp.id,
      el: { opening: 0, eligible: 0, encashed: 0, availed: 0, balance: 0 },
      sl: { eligible: 0, availed: 0, balance: 0 },
      cl: { availed: 0, accumulation: 0, balance: 0 }
    }]);
    setAdvanceLedgers([...advanceLedgers, {
      employeeId: newEmp.id,
      opening: 0,
      totalAdvance: 0,
      monthlyInstallment: 0,
      paidAmount: 0,
      balance: 0
    }]);
  };

  const handleBulkAddEmployees = (newEmps: Employee[]) => {
      const currentIds = new Set(employees.map(e => e.id));
      const filteredNew = newEmps.filter(e => !currentIds.has(e.id));
      
      const newLeaveLedgers = filteredNew.map(e => ({
          employeeId: e.id,
          el: { opening: 0, eligible: 0, encashed: 0, availed: 0, balance: 0 },
          sl: { eligible: 0, availed: 0, balance: 0 },
          cl: { availed: 0, accumulation: 0, balance: 0 }
      }));

      const newAdvanceLedgers = filteredNew.map(e => ({
          employeeId: e.id,
          opening: 0,
          totalAdvance: 0,
          monthlyInstallment: 0,
          paidAmount: 0,
          balance: 0
      }));

      setEmployees(prev => [...prev, ...filteredNew]);
      setLeaveLedgers(prev => [...prev, ...newLeaveLedgers]);
      setAdvanceLedgers(prev => [...prev, ...newAdvanceLedgers]);
  };

  const handleRestoreData = () => {
    // Reload state from storage
    window.location.reload();
  };

  if (!user) {
    return <Login onLogin={handleLogin} currentLogo={appLogo} setLogo={setAppLogo} />;
  }

  const NavItem = ({ view, label, icon: Icon }: { view: View; label: string; icon: any }) => (
    <button
      onClick={() => { setActiveView(view); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
        activeView === view 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex min-h-screen bg-[#020617] text-slate-200 font-sans overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed md:static inset-y-0 left-0 w-72 bg-[#1e293b] border-r border-slate-800 transform transition-transform duration-300 z-50 flex flex-col ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white p-0.5 overflow-hidden shrink-0">
             <img src={appLogo} alt="Logo" className="w-full h-full object-cover rounded-md" />
          </div>
          <div>
            <h1 className="font-black text-white text-lg leading-tight">{BRAND_CONFIG.appName}<span className="text-blue-500">{BRAND_CONFIG.appNameSuffix}</span></h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{companyProfile.establishmentName}</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 mb-2 mt-2">Main Menu</div>
          <NavItem view={View.Dashboard} label="Dashboard" icon={LayoutDashboard} />
          <NavItem view={View.Employees} label="Employee Master" icon={Users} />
          <NavItem view={View.PayProcess} label="Run Payroll" icon={Calculator} />
          
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 mb-2 mt-6">Compliance & Reports</div>
          <NavItem view={View.Reports} label="Pay Reports" icon={FileText} />
          <NavItem view={View.Statutory} label="Statutory Reports" icon={ShieldCheck} />
          
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 mb-2 mt-6">System</div>
          <NavItem view={View.Utilities} label="Utilities" icon={Network} />
          <NavItem view={View.Settings} label="Configuration" icon={SettingsIcon} />
          <NavItem view={View.AI_Assistant} label="AI Assistant" icon={Bot} />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-900/20 hover:text-red-400 transition-colors font-medium"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
          <div className="mt-4 text-center text-[10px] text-slate-600">
             v2.5.0 • Licensed to {companyProfile.establishmentName || 'User'}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-hidden flex flex-col relative">
        {/* Header */}
        <header className="h-16 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 z-30 shrink-0">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden p-2 text-slate-400 hover:text-white"
              >
                {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <h2 className="text-lg font-bold text-white hidden md:block">
                  {activeView === View.Dashboard && 'Dashboard Overview'}
                  {activeView === View.Employees && 'Employee Management'}
                  {activeView === View.PayProcess && 'Payroll Processing'}
                  {activeView === View.Reports && 'Reports & Analytics'}
                  {activeView === View.Statutory && 'Statutory Compliance'}
                  {activeView === View.Utilities && 'System Utilities'}
                  {activeView === View.Settings && 'Settings & Configuration'}
                  {activeView === View.AI_Assistant && 'AI Compliance Assistant'}
              </h2>
           </div>
           
           <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                  <div className="text-sm font-bold text-white">{user.name}</div>
                  <div className="text-[10px] text-slate-400 uppercase">{user.role} Access</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-lg shadow-blue-900/20">
                  {user.name.charAt(0)}
              </div>
           </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth relative">
          
          {activeView === View.Dashboard && (
            <Dashboard 
              employees={employees} 
              config={config} 
              attendances={attendances} 
              leaveLedgers={leaveLedgers} 
              advanceLedgers={advanceLedgers}
              month={globalMonth}
              year={globalYear} 
              onNavigate={setActiveView}
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

          {activeView === View.Statutory && (
            <StatutoryReports 
               payrollHistory={payrollHistory}
               employees={employees}
               config={config}
               globalMonth={globalMonth}
               setGlobalMonth={setGlobalMonth}
               globalYear={globalYear}
               setGlobalYear={setGlobalYear}
               attendances={attendances}
               leaveLedgers={leaveLedgers}
               advanceLedgers={advanceLedgers}
            />
          )}

          {activeView === View.Utilities && (
            <Utilities 
                designations={designations}
                setDesignations={setDesignations}
                divisions={divisions}
                setDivisions={setDivisions}
                branches={branches}
                setBranches={setBranches}
                sites={sites}
                setSites={setSites}
            />
          )}

          {activeView === View.Settings && (
            <Settings 
                config={config}
                setConfig={setConfig}
                companyProfile={companyProfile}
                setCompanyProfile={setCompanyProfile}
                currentLogo={appLogo}
                setLogo={setAppLogo}
                leavePolicy={leavePolicy}
                setLeavePolicy={setLeavePolicy}
                onRestore={handleRestoreData}
            />
          )}

          {activeView === View.AI_Assistant && (
            <AIAssistant />
          )}

          <div className="h-10"></div> {/* Bottom Spacer */}
        </div>
      </main>
    </div>
  );
};

export default App;