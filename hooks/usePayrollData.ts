
import { useState, useCallback, useEffect } from 'react';
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

  // --- MULTI-COMPANY STATE ---
  const [companies, setCompanies] = useState<CompanyProfile[]>(() => {
    try {
      const saved = localStorage.getItem('app_companies');
      if (saved) return JSON.parse(saved);
      
      // Migration: Check if single profile exists
      const oldProfile = localStorage.getItem('app_company_profile');
      if (oldProfile) {
        try {
          const parsed = JSON.parse(oldProfile);
          if (parsed && typeof parsed === 'object') {
            const defaultCompany = { ...INITIAL_COMPANY_PROFILE, ...parsed, id: 'company_1' };
            localStorage.setItem('app_companies', JSON.stringify([defaultCompany]));
            return [defaultCompany];
          }
        } catch (e) { }
      }
      return [];
    } catch (e) { return []; }
  });

  const [activeCompanyId, setActiveCompanyId] = useState<string>(() => {
    const saved = localStorage.getItem('app_active_company_id');
    if (saved && saved !== 'undefined') return saved;
    if (companies.length > 0) return companies[0].id;
    return 'default';
  });

  // Helper to get company-specific key
  const getCKey = (key: string) => activeCompanyId === 'default' ? key : `${activeCompanyId}_${key}`;

  // --- STATE INITIALIZATION (Now company-aware) ---
  // --- STATE INITIALIZATION (Now company-aware) ---
  const getStoredInitial = (key: string, fallback: any) => {
    try {
      const scopedKey = getCKey(key);
      const raw = localStorage.getItem(scopedKey);
      if (raw) return JSON.parse(raw);
      
      // JIT Migration for company_1
      if (activeCompanyId === 'company_1') {
        const globalRaw = localStorage.getItem(key);
        if (globalRaw) return JSON.parse(globalRaw);
      }
      return fallback;
    } catch (e) { return fallback; }
  };

  const [employees, setEmployees] = useState<Employee[]>(() => getStoredInitial('app_employees', []));
  const [config, setConfig] = useState<StatutoryConfig>(() => getStoredInitial('app_config', INITIAL_STATUTORY_CONFIG));
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => {
    const saved = getStoredInitial('app_company_profile', null);
    if (saved) return saved;
    return companies.find(c => c.id === activeCompanyId) || INITIAL_COMPANY_PROFILE;
  });
  const [leavePolicy, setLeavePolicy] = useState<LeavePolicy>(() => getStoredInitial('app_leave_policy', DEFAULT_LEAVE_POLICY));
  const [attendances, setAttendances] = useState<Attendance[]>(() => getStoredInitial('app_attendance', []));
  const [leaveLedgers, setLeaveLedgers] = useState<LeaveLedger[]>(() => getStoredInitial('app_leave_ledgers', []));
  const [advanceLedgers, setAdvanceLedgers] = useState<AdvanceLedger[]>(() => getStoredInitial('app_advance_ledgers', []));
  const [payrollHistory, setPayrollHistory] = useState<PayrollResult[]>(() => getStoredInitial('app_payroll_history', []));
  const [fines, setFines] = useState<FineRecord[]>(() => getStoredInitial('app_fines', []));
  const [arrearHistory, setArrearHistory] = useState<ArrearBatch[]>(() => getStoredInitial('app_arrear_history', []));
  const [otRecords, setOTRecords] = useState<OTRecord[]>(() => getStoredInitial('app_ot_records', []));
  const [designations, setDesignations] = useState<string[]>(() => getStoredInitial('app_master_designations', ['Software Engineer', 'Project Manager', 'HR Manager', 'Accounts Executive', 'Peon']));
  const [divisions, setDivisions] = useState<string[]>(() => getStoredInitial('app_master_divisions', ['Head Office', 'Manufacturing', 'Sales', 'Marketing', 'Engineering']));
  const [branches, setBranches] = useState<string[]>(() => getStoredInitial('app_master_branches', ['Chennai', 'New Delhi', 'Mumbai', 'Bangalore']));
  const [sites, setSites] = useState<string[]>(() => getStoredInitial('app_master_sites', ['Main Plant', 'Warehouse A', 'IT Park Office', 'Site-01']));
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    try {
      const savedLogo = localStorage.getItem(getCKey('app_logo'));
      if (savedLogo) {
        if (savedLogo.startsWith('"')) {
          try { return JSON.parse(savedLogo); } catch (e) { return savedLogo; }
        }
        return savedLogo;
      }
    } catch (e) {}
    return '../public/logo.png';
  });

  // Save activeCompanyId
  useEffect(() => {
    localStorage.setItem('app_active_company_id', activeCompanyId);
  }, [activeCompanyId]);

  // Update companies list when profile changes
  useEffect(() => {
    if (companyProfile.id === activeCompanyId) {
      setCompanies(prev => {
        const idx = prev.findIndex(c => c.id === activeCompanyId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = companyProfile;
          localStorage.setItem('app_companies', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    }
  }, [companyProfile, activeCompanyId]);

  // --- PERSISTENCE HELPERS ---
  const safeSave = useCallback((key: string, data: any) => {
    if (isResetting) return;
    try {
      localStorage.setItem(getCKey(key), JSON.stringify(data));
    } catch (e: any) {
      console.error(`Failed to save ${key}:`, e);
      if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
        showAlert('warning', 'Storage Limit Exceeded', "Your browser's local storage is full. Please remove large images or use the 'Factory Reset' in Settings to clear old data.");
      }
    }
  }, [isResetting, showAlert, activeCompanyId]);

  // --- MULTI-COMPANY HANDLERS ---
  const switchCompany = (id: string) => {
    setActiveCompanyId(id);
    showAlert('success', 'Company Switched', `Switched to ${companies.find(c => c.id === id)?.establishmentName || 'selected company'}`);
  };

  const addCompany = (newCompany: CompanyProfile, initialConfig?: StatutoryConfig) => {
    // Explicitly persist the new company's profile and config to prevent JIT migration from legacy/global keys
    localStorage.setItem(`${newCompany.id}_app_company_profile`, JSON.stringify(newCompany));
    if (initialConfig) {
      localStorage.setItem(`${newCompany.id}_app_config`, JSON.stringify(initialConfig));
    } else {
      localStorage.setItem(`${newCompany.id}_app_config`, JSON.stringify(INITIAL_STATUTORY_CONFIG));
    }

    setCompanies(prev => {
      const updated = [...prev, newCompany];
      localStorage.setItem('app_companies', JSON.stringify(updated));
      return updated;
    });
    
    // Switch to the new company - loadCompanyData will now find the clean data we just persisted
    setActiveCompanyId(newCompany.id);
    setCompanyProfile(newCompany);
    setConfig(initialConfig || INITIAL_STATUTORY_CONFIG);
    
    showAlert('success', 'Company Added', `New company ${newCompany.establishmentName} added and selected.`);
  };

  const deleteCompany = (id: string) => {
    if (companies.length <= 1) {
      showAlert('warning', 'Action Prohibited', 'You must have at least one company in the system.');
      return;
    }

    // 1. Wipe company-specific data from LocalStorage
    const keys = [
      'app_employees', 'app_config', 'app_attendance', 'app_leave_ledgers', 
      'app_advance_ledgers', 'app_payroll_history', 'app_fines', 'app_arrear_history', 
      'app_ot_records', 'app_master_designations', 'app_master_divisions', 
      'app_master_branches', 'app_master_sites', 'app_logo', 'app_leave_policy',
      'app_setup_complete'
    ];
    keys.forEach(k => localStorage.removeItem(`${id}_${k}`));

    // 2. Wipe from SQLite if available
    if ((window as any).electronAPI?.dbDelete) {
      keys.forEach(k => (window as any).electronAPI.dbDelete(`${id}_${k}`).catch(() => { }));
    }

    // 3. Update companies list
    setCompanies(prev => {
      const updated = prev.filter(c => c.id !== id);
      localStorage.setItem('app_companies', JSON.stringify(updated));
      return updated;
    });

    // 4. Force reload to re-hydrate the Selection Gate cleanly
    showAlert('success', 'Organization Purged', 'The organization and all its records have been permanently removed.', () => {
      window.location.reload();
    });
  };

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

    // Clear Local Storage (Scoped)
    keysToWipe.forEach(k => {
      localStorage.removeItem(getCKey(k));
      localStorage.removeItem(k); // Also clear legacy global keys if any
    });

    // Wipe electron SQLite database
    // @ts-ignore
    if (window.electronAPI && window.electronAPI.dbDelete) {
      for (const k of keysToWipe) {
        try {
          // @ts-ignore
          await window.electronAPI.dbDelete(getCKey(k));
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
    
    showAlert('success', 'Partial Reset Complete', 'All employee and payroll records for the active company have been cleared.', () => {
       window.location.reload();
    });
  }, [showAlert, activeCompanyId, getCKey]);

  const handleNuclearReset = useCallback(async () => {
    setIsResetting(true);
    
    // Clear ALL Local Storage
    localStorage.clear();
    localStorage.setItem('app_is_reset_mode', 'true');

    // Wipe electron SQLite database completely if possible, otherwise key by key
    // @ts-ignore
    if (window.electronAPI && window.electronAPI.dbDelete) {
      // Get all keys from local storage (before we cleared it) or use a comprehensive list
      const globalKeys = [
        'app_license_secure', 'app_data_size', 'app_machine_id', 'app_setup_complete',
        'app_users', 'app_companies', 'app_active_company_id'
      ];
      const scopedKeys = [
        'app_employees', 'app_config', 'app_company_profile',
        'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 'app_payroll_history',
        'app_fines', 'app_leave_policy', 'app_arrear_history', 'app_ot_records', 'app_logo',
        'app_master_designations', 'app_master_divisions', 'app_master_branches', 'app_master_sites'
      ];

      // Wipe globals
      for (const k of globalKeys) {
        try { await (window as any).electronAPI.dbDelete(k); } catch (e) {}
      }

      // Note: In a real nuclear reset, we'd ideally want to drop the whole SQLite file,
      // but dbDelete handles key-level removal.
      // Since we don't have a list of all company IDs here easily after clear, 
      // we rely on the fact that the next setup will overwrite or the user starts fresh.
    }

    setEmployees([]);
    setAttendances([]);
    setLeaveLedgers([]);
    setAdvanceLedgers([]);
    setPayrollHistory([]);
    setFines([]);
    setArrearHistory([]);
    setOTRecords([]);
    setCompanies([]);
    setActiveCompanyId('default');
    
    showAlert('success', 'Factory Reset Complete', 'All system data and identities have been wiped.', () => {
      window.location.reload();
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
    isResetting,
    companies, activeCompanyId, switchCompany, addCompany, deleteCompany
  };
};
