
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
  const [isHydrating, setIsHydrating] = useState(true);

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
  // V03.01.03: In the physical isolation model, we use FLAT keys inside silos.
  // We only use the activeCompanyId for storage path isolation, not for key prefixing.
  const getCKey = useCallback((key: string) => {
    if (activeCompanyId === 'default' || !activeCompanyId) return key;
    return `${activeCompanyId}_${key}`;
  }, [activeCompanyId]);

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

  // Save activeCompanyId and switch backend data silo
  useEffect(() => {
    const syncDatabaseSilo = async () => {
      console.log(`[usePayrollData] Notifying backend of company switch: ${activeCompanyId}`);
      localStorage.setItem('app_active_company_id', activeCompanyId);
      
      if (window.electronAPI?.switchCompanyData) {
        await window.electronAPI.switchCompanyData(activeCompanyId);
        
        // After switching the physical DB, fetch the latest data from that silo
        const dbRes = await window.electronAPI.dbGetAll();
        if (dbRes.success && Array.isArray(dbRes.data)) {
            console.log(`[usePayrollData] Hydrating state from ${activeCompanyId} data silo...`);
            
            // Map to track what we've found to handle priority
            const siloData: Record<string, any> = {};
            
            dbRes.data.forEach((item: { key: string, value: any }) => {
                const key = item.key;
                const value = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
                
                // 1. If it's a prefixed key for the ACTIVE company, it's our top priority data
                if (activeCompanyId && key.startsWith(`${activeCompanyId}_`)) {
                    const flatKey = key.replace(`${activeCompanyId}_`, '');
                    siloData[flatKey] = value;
                } 
                // 2. If it's a global system key, keep it
                else if (key.startsWith('app_companies') || key.startsWith('app_active_company_id') || key.startsWith('app_license_data') || key.startsWith('app_users')) {
                    localStorage.setItem(key, value);
                }
                // 3. If it's a standard flat key (starts with app_), use it 
                // but only if we haven't already found a company-prefixed version (priority)
                else if (key.startsWith('app_')) {
                    if (!siloData[key]) {
                        siloData[key] = value;
                    }
                }
                // 4. Fallback for company-prefixed profiles
                else if (key.startsWith('company_')) {
                    if (!siloData[key]) {
                        siloData[key] = value;
                    }
                }
            });

            // Commit the silo-exclusive data to localStorage AND React State
            Object.entries(siloData).forEach(([key, value]) => {
                localStorage.setItem(key, value);
                
                // Direct State Updates for immediate UI reflection
                try {
                    const parsed = JSON.parse(value);
                    if (key === 'app_employees') setEmployees(parsed);
                    if (key === 'app_statutory_config') setConfig(parsed);
                    if (key === 'app_company_profile') setCompanyProfile(parsed);
                    if (key === 'app_attendance') setAttendances(parsed);
                    if (key === 'app_payroll_history') setPayrollHistory(parsed);
                    if (key === 'app_leave_ledgers') setLeaveLedgers(parsed);
                    if (key === 'app_advance_ledgers') setAdvanceLedgers(parsed);
                    if (key === 'app_fines') setFines(parsed);
                    if (key === 'app_leave_policy') setLeavePolicy(parsed);
                    if (key === 'master_designations') setDesignations(parsed);
                    if (key === 'master_divisions') setDivisions(parsed);
                    if (key === 'master_branches') setBranches(parsed);
                    if (key === 'master_sites') setSites(parsed);
                } catch (e) {}
            });

            triggerReload();
        }
      }
    };
    
    const performSync = async () => {
        await syncDatabaseSilo();
        setIsHydrating(false);
    };
    performSync();
  }, [activeCompanyId]);

  const [reloadTrigger, setReloadTrigger] = useState(0);
  const triggerReload = () => setReloadTrigger(prev => prev + 1);

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

  // --- DATA RE-HYDRATION ON COMPANY SWITCH ---
  useEffect(() => {
    if (isResetting) return;
    
    // Helper to reload a single state from scoped storage
    const reloadState = (key: string, setter: (val: any) => void, fallback: any) => {
      const data = getStoredInitial(key, fallback);
      setter(data);
    };

    reloadState('app_employees', setEmployees, []);
    reloadState('app_config', setConfig, INITIAL_STATUTORY_CONFIG);
    
    // For profile, prioritized companies list, then storage
    const found = companies.find(c => c.id === activeCompanyId);
    if (found) {
        setCompanyProfile(found);
    } else {
        reloadState('app_company_profile', setCompanyProfile, INITIAL_COMPANY_PROFILE);
    }

    reloadState('app_leave_policy', setLeavePolicy, DEFAULT_LEAVE_POLICY);
    reloadState('app_attendance', setAttendances, []);
    reloadState('app_leave_ledgers', setLeaveLedgers, []);
    reloadState('app_advance_ledgers', setAdvanceLedgers, []);
    reloadState('app_payroll_history', setPayrollHistory, []);
    reloadState('app_fines', setFines, []);
    reloadState('app_arrear_history', setArrearHistory, []);
    reloadState('app_ot_records', setOTRecords, []);
    reloadState('app_master_designations', setDesignations, ['Software Engineer', 'Project Manager', 'HR Manager', 'Accounts Executive', 'Peon']);
    reloadState('app_master_divisions', setDivisions, ['Head Office', 'Manufacturing', 'Sales', 'Marketing', 'Engineering']);
    reloadState('app_master_branches', setBranches, ['Chennai', 'New Delhi', 'Mumbai', 'Bangalore']);
    reloadState('app_master_sites', setSites, ['Main Plant', 'Warehouse A', 'IT Park Office', 'Site-01']);

    // Logo reload
    try {
      const savedLogo = localStorage.getItem(getCKey('app_logo'));
      if (savedLogo) {
        if (savedLogo.startsWith('"')) {
          try { setLogoUrl(JSON.parse(savedLogo)); } catch (e) { setLogoUrl(savedLogo); }
        } else {
          setLogoUrl(savedLogo);
        }
      } else {
        setLogoUrl('../public/logo.png');
      }
    } catch (e) {
      setLogoUrl('../public/logo.png');
    }
  }, [activeCompanyId, isResetting, reloadTrigger]);

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

  // --- DATA PURGE UTILITY ---
  const purgeState = useCallback(() => {
    setIsResetting(true);
    setEmployees([]);
    setAttendances([]);
    setLeaveLedgers([]);
    setAdvanceLedgers([]);
    setPayrollHistory([]);
    setFines([]);
    setArrearHistory([]);
    setOTRecords([]);
    // masters reset to empty or default
    setDesignations(['Software Engineer', 'Project Manager', 'HR Manager', 'Accounts Executive', 'Peon']);
    setDivisions(['Head Office', 'Manufacturing', 'Sales', 'Marketing', 'Engineering']);
    setBranches(['Chennai', 'New Delhi', 'Mumbai', 'Bangalore']);
    setSites(['Main Plant', 'Warehouse A', 'IT Park Office', 'Site-01']);
    setLogoUrl('../public/logo.png');
    
    // Tiny delay to allow React to flush the 'empty' state before re-hydrating
    setTimeout(() => setIsResetting(false), 50);
  }, []);

  // --- MULTI-COMPANY HANDLERS ---
  const switchCompany = useCallback((id: string) => {
    if (id === activeCompanyId) return;
    
    // 1. Flush memory
    purgeState();
    
    // 2. Update Registry
    setActiveCompanyId(id);
    localStorage.setItem('app_active_company_id', id);
    if (window.electronAPI?.dbSetGlobal) {
      window.electronAPI.dbSetGlobal('app_active_company_id', id);
    }

    // 3. Handover to Physical Silo
    if (window.electronAPI?.switchCompanyData) {
      window.electronAPI.switchCompanyData(id);
    }

    showAlert('success', 'Company Switched', `Active Silo: ${companies.find(c => c.id === id)?.establishmentName || id}`, undefined, undefined, 'OK', undefined, undefined, 1.5);
  }, [activeCompanyId, companies, purgeState, showAlert]);

  const addCompany = useCallback(async (newCompany: CompanyProfile, initialConfig?: StatutoryConfig) => {
    const updated = [...companies, newCompany];
    setCompanies(updated);
    localStorage.setItem('app_companies', JSON.stringify(updated));
    if (window.electronAPI?.dbSetGlobal) {
      await window.electronAPI.dbSetGlobal('app_companies', updated);
    }
    
    // Switch to new silo
    switchCompany(newCompany.id);

    // If initial config provided, write it to the new silo immediately
    if (initialConfig) {
      const configKey = `${newCompany.id}_app_config`;
      localStorage.setItem(configKey, JSON.stringify(initialConfig));
      if (window.electronAPI?.dbSet) {
        await window.electronAPI.dbSet('app_config', initialConfig);
      }
    }
    
    showAlert('success', 'Organization Added', `${newCompany.establishmentName} has been provisioned.`);
  }, [companies, switchCompany, showAlert]);

  const deleteCompany = useCallback((id: string) => {
    if (companies.length <= 1) {
      showAlert('warning', 'Action Prohibited', 'You must have at least one company in the system.');
      return;
    }

    const updated = companies.filter(c => c.id !== id);
    setCompanies(updated);
    localStorage.setItem('app_companies', JSON.stringify(updated));
    if (window.electronAPI?.dbSetGlobal) {
      window.electronAPI.dbSetGlobal('app_companies', updated);
    }

    if (activeCompanyId === id) {
      switchCompany(updated[0].id);
    }

    showAlert('success', 'Organization Removed', 'The organization has been removed from the registry.');
  }, [companies, activeCompanyId, switchCompany, showAlert]);



  // --- HANDLERS ---
  const handleRollover = useCallback(async (
    globalMonth: string, globalYear: number, 
    monthsArr: string[], updatedHistory?: PayrollResult[]
  ) => {
    try {
      showAlert('loading', 'Finalizing Data', "Creating 'After Confirmation' snapshot. Please wait 3 seconds...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      const backupFileName = getBackupFileName('AC', companyProfile, globalMonth, globalYear);
      const encryptionKey = companyProfile.securityPin || 'INITIAL_PMS_KEY';
      const backupRes = await window.electronAPI.createDataBackup({
        fileName: backupFileName,
        subfolder: companyProfile.establishmentName,
        encryptionKey: encryptionKey
      });

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
    
    showAlert('success', 'Partial Reset Complete', 'All employee and payroll records for the active company have been cleared. System will now reload.', () => {
       window.location.reload();
    }, undefined, 'RELOAD NOW', undefined, undefined, 5, false, 'Disk Cleanup in Progress...');
  }, [showAlert, activeCompanyId, getCKey]);

  const handleDeepReset = useCallback(async () => {
    setIsResetting(true);
    const keysToWipe = [
      'app_employees', 'app_config', 'app_company_profile',
      'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 'app_payroll_history',
      'app_fines', 'app_leave_policy', 'app_arrear_history', 'app_ot_records', 'app_logo',
      'app_master_designations', 'app_master_divisions', 'app_master_branches', 'app_master_sites'
    ];

    for (const k of keysToWipe) {
      localStorage.removeItem(getCKey(k));
      localStorage.removeItem(k);
      
      if ((window as any).electronAPI?.dbDelete) {
        try {
          if (k === 'app_config' || k === 'app_company_profile' || k === 'app_leave_policy') {
            await (window as any).electronAPI.dbSet(getCKey(k), {});
            await (window as any).electronAPI.dbSet(k, {});
          } else {
            await (window as any).electronAPI.dbDelete(getCKey(k));
            await (window as any).electronAPI.dbDelete(k);
          }
        } catch (e) { console.error(`Error wiping ${k}`, e); }
      }
    }

    localStorage.setItem('app_setup_complete', 'false');
    localStorage.setItem('app_is_reset_mode', 'true');

    showAlert('success', 'Deep Reset Complete', 'The active company has been wiped to a factory state. System will now reload.', () => {
      window.location.reload();
    }, undefined, 'RELOAD NOW', undefined, undefined, 5, false, 'Factory Reset in Progress...');
  }, [showAlert]);

  const handleNuclearReset = useCallback(async () => {
    setIsResetting(true);
    
    // Clear ALL Local Storage
    localStorage.clear();
    localStorage.setItem('app_is_reset_mode', 'true');

    // Wipe electron SQLite database completely (Backend handles directory deletion)
    if ((window as any).electronAPI?.wipeAllData) {
      await (window as any).electronAPI.wipeAllData();
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
    }, undefined, 'RELOAD NOW', undefined, undefined, 5, false, 'Nuclear Wipe in Progress...');
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
    safeSave, handleRollover, handlePayrollReset, handleDeepReset, handleNuclearReset,
    isResetting, isHydrating,
    companies, activeCompanyId, switchCompany, addCompany, deleteCompany, purgeState
  };
};
