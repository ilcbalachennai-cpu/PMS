
import { useState, useCallback } from 'react';
import { 
  Employee, StatutoryConfig, CompanyProfile, PayrollResult, 
  Attendance, LeaveLedger, AdvanceLedger, FineRecord, 
  ArrearBatch, LeavePolicy, OTRecord 
} from '../types';
import { 
  INITIAL_STATUTORY_CONFIG, INITIAL_COMPANY_PROFILE, 
  DEFAULT_LEAVE_POLICY 
} from '../constants';
import { getBackupFileName } from '../services/reportService';

export const usePayrollData = (showAlert: any) => {
  const [isResetting, setIsResetting] = useState(false);

  // --- STATE INITIALIZATION ---
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem('app_employees');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

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

  const [otRecords, setOTRecords] = useState<OTRecord[]>(() => {
    try {
      const saved = localStorage.getItem('app_ot_records');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [designations, setDesignations] = useState<string[]>(() => {
    try { 
      const raw = localStorage.getItem('app_master_designations');
      return raw ? JSON.parse(raw) : ['Software Engineer', 'Project Manager', 'HR Manager', 'Accounts Executive', 'Peon']; 
    } catch (e) { return ['Software Engineer', 'Project Manager', 'HR Manager', 'Accounts Executive', 'Peon']; }
  });
  const [divisions, setDivisions] = useState<string[]>(() => {
    try { 
      const raw = localStorage.getItem('app_master_divisions');
      return raw ? JSON.parse(raw) : ['Head Office', 'Manufacturing', 'Sales', 'Marketing', 'Engineering']; 
    } catch (e) { return ['Head Office', 'Manufacturing', 'Sales', 'Marketing', 'Engineering']; }
  });
  const [branches, setBranches] = useState<string[]>(() => {
    try { 
      const raw = localStorage.getItem('app_master_branches');
      return raw ? JSON.parse(raw) : ['Chennai', 'New Delhi', 'Mumbai', 'Bangalore']; 
    } catch (e) { return ['Chennai', 'New Delhi', 'Mumbai', 'Bangalore']; }
  });
  const [sites, setSites] = useState<string[]>(() => {
    try { 
      const raw = localStorage.getItem('app_master_sites');
      return raw ? JSON.parse(raw) : ['Main Plant', 'Warehouse A', 'IT Park Office', 'Site-01']; 
    } catch (e) { return ['Main Plant', 'Warehouse A', 'IT Park Office', 'Site-01']; }
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
      return '../public/logo.png'; // BRAND_CONFIG.logoUrl fallback
    } catch (e) { return '../public/logo.png'; }
  });

  // --- PERSISTENCE HELPERS ---
  const safeSave = useCallback((key: string, data: any) => {
    if (isResetting) return;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e: any) {
      console.error(`Failed to save ${key}:`, e);
      if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
        showAlert('warning', 'Storage Limit Exceeded', "Your browser's local storage is full. Please remove large images or use the 'Factory Reset' in Settings to clear old data.");
      }
    }
  }, [isResetting, showAlert]);

  // --- HANDLERS ---
  const handleRollover = useCallback(async (
    globalMonth: string, globalYear: number, 
    monthsArr: string[], updatedHistory?: PayrollResult[]
  ) => {
    try {
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
          return { 
            ...a, 
            opening: carryOpening, 
            totalAdvance: 0, 
            manualPayment: 0, 
            paidAmount: 0, 
            monthlyInstallment: 0, 
            emiCount: nextEmiCount, 
            recovery: nextRecovery, 
            balance: Math.max(0, carryOpening - nextRecovery) 
          };
        });
      });
      setLeaveLedgers(prev => {
        const currentHistory = updatedHistory || payrollHistory;
        const finalizedResults = currentHistory.filter(r => r.month === globalMonth && r.year === globalYear && r.status === 'Finalized');
        
        return prev.map(l => {
          const payrollResult = finalizedResults.find(r => r.employeeId === l.employeeId);
          const emp = employees.find(e => e.id === l.employeeId);
          
          // Determine if employee has joined by the end of the next month
          const dojDate = emp ? new Date(emp.doj) : new Date(0);
          dojDate.setHours(0, 0, 0, 0);
          const nextPeriodEnd = new Date(nextYear, monthsArr.indexOf(nextMonth) + 1, 0);
          nextPeriodEnd.setHours(23, 59, 59, 999);
          
          const isEligible = dojDate <= nextPeriodEnd;

          let prevELBal = l.el.balance;
          let prevSLBal = l.sl.balance;
          let prevCLBal = l.cl.balance;

          if (payrollResult && payrollResult.leaveSnapshot) {
            prevELBal = payrollResult.leaveSnapshot.el.balance;
            prevSLBal = payrollResult.leaveSnapshot.sl.balance;
            prevCLBal = payrollResult.leaveSnapshot.cl.balance;
          }

          // Case: If employee hasn't joined by the end of NEXT month, they stay at 0
          // Case: If they JOIN in the next month, their opening is 0, but they get credit
          const elCredit = isEligible ? (leavePolicy?.el?.maxPerYear || 18) / 12 : 0;
          const slCredit = isEligible ? (leavePolicy?.sl?.maxPerYear || 12) / 12 : 0;
          const clCredit = isEligible ? (leavePolicy?.cl?.maxPerYear || 12) / 12 : 0;

          const isAprilReset = nextMonth === 'April';

           // Capped Carry Forward Logic based on Annual Leave Policy
           const carryEL = isEligible ? Math.min(prevELBal, isAprilReset ? (leavePolicy?.el?.maxCarryForward || 30) : 999) : 0;
           const carrySL = isEligible ? (isAprilReset ? Math.min(prevSLBal, leavePolicy?.sl?.maxCarryForward || 0) : prevSLBal) : 0;
           const carryCL = isEligible ? (isAprilReset ? Math.min(prevCLBal, leavePolicy?.cl?.maxCarryForward || 0) : prevCLBal) : 0;

           return {
             ...l,
             el: { 
               opening: carryEL, 
               eligible: elCredit, 
               encashed: 0, 
               availed: 0, 
               balance: carryEL + elCredit 
             },
             sl: { 
               eligible: slCredit, 
               availed: 0, 
               balance: carrySL + slCredit 
             },
             cl: { 
               availed: 0, 
               accumulation: carryCL, 
               balance: carryCL + clCredit 
             }
          };
        });
      });
      setFines(prev => prev.filter(f => !(f.month === globalMonth && f.year === globalYear)));
      setOTRecords(prev => prev.filter(f => !(f.month === globalMonth && f.year === globalYear)));
      
      return { nextMonth, nextYear, backupRes, backupFileName };
    } catch (e: any) {
      showAlert('error', 'Rollover Failed', `Critical error during month initialization: ${e.message}`);
      return null;
    }
  }, [companyProfile, payrollHistory, showAlert]);

  const handlePayrollReset = useCallback(async () => {
    setIsResetting(true);
    
    const keysToWipe = [
      'app_employees', 'app_attendance', 'app_leave_ledgers', 
      'app_advance_ledgers', 'app_payroll_history', 'app_fines', 
      'app_arrear_history', 'app_ot_records'
    ];

    // Clear Local Storage
    keysToWipe.forEach(k => localStorage.removeItem(k));

    // Wipe electron SQLite database
    // @ts-ignore
    if (window.electronAPI && window.electronAPI.dbDelete) {
      for (const k of keysToWipe) {
        try {
          // @ts-ignore
          await window.electronAPI.dbDelete(k);
        } catch (e) { console.error(`Error deleting ${k} from db`, e); }
      }
    }

    // Refresh State
    setEmployees([]);
    setAttendances([]);
    setLeaveLedgers([]);
    setAdvanceLedgers([]);
    setPayrollHistory([]);
    setFines([]);
    setArrearHistory([]);
    setOTRecords([]);
    
    setIsResetting(false);
    
    showAlert('success', 'Payroll Reset Complete', 'All employee and payroll records have been cleared. Company profile and statutory rules are preserved.', () => {
       window.location.reload();
    });
  }, [showAlert]);

  const handleNuclearReset = useCallback(async () => {
    setIsResetting(true);
    localStorage.clear();
    localStorage.setItem('app_is_reset_mode', 'true');

    // Wipe electron SQLite database
    // @ts-ignore
    if (window.electronAPI && window.electronAPI.dbDelete) {
      const keysToWipe = [
        'app_license_secure', 'app_data_size', 'app_machine_id', 'app_setup_complete',
        'app_users', 'app_master_designations', 'app_master_divisions', 'app_master_branches',
        'app_master_sites', 'app_employees', 'app_config', 'app_company_profile',
        'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 'app_payroll_history',
        'app_fines', 'app_leave_policy', 'app_arrear_history', 'app_ot_records', 'app_logo'
      ];
      for (const k of keysToWipe) {
        try {
          // @ts-ignore
          await window.electronAPI.dbDelete(k);
        } catch (e) { console.error(`Error deleting ${k} from db`, e); }
      }
    }

    setEmployees([]);
    setAttendances([]);
    setLeaveLedgers([]);
    setAdvanceLedgers([]);
    setPayrollHistory([]);
    setFines([]);
    setArrearHistory([]);
    setOTRecords([]);
    
    showAlert('success', 'Factory Reset Complete', 'All system data has been wiped. The application will now restart.', () => {
      window.location.href = window.location.href.split('#')[0];
    });
  }, [showAlert]);

  return {
    employees, setEmployees,
    config, setConfig,
    companyProfile, setCompanyProfile,
    leavePolicy, setLeavePolicy,
    attendances, setAttendances,
    leaveLedgers, setLeaveLedgers,
    advanceLedgers, setAdvanceLedgers,
    payrollHistory, setPayrollHistory,
    fines, setFines,
    arrearHistory, setArrearHistory,
    otRecords, setOTRecords,
    designations, setDesignations,
    divisions, setDivisions,
    branches, setBranches,
    sites, setSites,
    logoUrl, setLogoUrl,
    safeSave, handleRollover, handlePayrollReset, handleNuclearReset,
    isResetting
  };
};
