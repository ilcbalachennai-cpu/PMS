
import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Employee, StatutoryConfig, CompanyProfile, PayrollResult, 
  Attendance, LeaveLedger, AdvanceLedger, FineRecord, 
  ArrearBatch, LeavePolicy, OTRecord 
} from '../types';
import { 
  INITIAL_STATUTORY_CONFIG, INITIAL_COMPANY_PROFILE, 
  DEFAULT_LEAVE_POLICY 
} from '../constants';
import { getBackupFileName, getMonthAbbr } from '../services/reportService';
import { getCompanyBackupFolder, generateCompanyId, normalizeEmployeeDates } from '../utils/formatters';

export const usePayrollData = (showAlert: any) => {
  const [isResetting, setIsResetting] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const triggerReload = () => setReloadTrigger(prev => prev + 1);
  const lastCompanyIdRef = useRef<string>('');

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
            const newId = generateCompanyId(parsed.establishmentName || 'COMPANY');
            const defaultCompany = { ...INITIAL_COMPANY_PROFILE, ...parsed, id: newId };
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

  const [activeFinancialYear, setActiveFinancialYear] = useState<string>(() => {
    const saved = localStorage.getItem('app_active_financial_year');
    if (saved && saved !== 'undefined') return saved;
    const now = new Date();
    const currentYear = now.getFullYear();
    const startYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
    return `FY${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
  });

  const [availableFinancialYears, setAvailableFinancialYears] = useState<string[]>(() => {
    const list = new Set<string>();
    list.add('FY24-25');
    list.add('FY25-26');
    list.add('FY26-27');
    list.add('FY27-28');
    
    const saved = localStorage.getItem('app_active_financial_year');
    if (saved && saved !== 'undefined') {
      list.add(saved);
    }
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const startYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
    const currentFY = `FY${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
    const nextFY = `FY${String(startYear + 1).slice(-2)}-${String(startYear + 2).slice(-2)}`;
    list.add(currentFY);
    list.add(nextFY);
    
    return Array.from(list).sort();
  });

  // Helper to get company-specific key
  // V03.01.03: In the physical isolation model, we use FLAT keys inside silos.
  // We only use the activeCompanyId for storage path isolation, not for key prefixing.
  const getCKey = useCallback((key: string) => {
    // V04.00.00: Financial Year Scoping (Option 1)
    // Transactional data gets suffixed with BOTH Financial Year and Company ID.
    // Master data gets suffixed with ONLY Company ID.
    const transactionalKeys = [
      'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 
      'app_payroll_history', 'app_fines', 'app_arrear_history', 'app_ot_records'
    ];
    
    if (transactionalKeys.includes(key)) {
      return `${key}_${activeFinancialYear}_${activeCompanyId}`;
    }
    return `${key}_${activeCompanyId}`;
  }, [activeCompanyId, activeFinancialYear]);

  // --- STATE INITIALIZATION (Now company-aware) ---
  // --- STATE INITIALIZATION (Now company-aware) ---
  const getStoredInitial = (key: string, fallback: any) => {
    try {
      const scopedKey = getCKey(key);
      const raw = localStorage.getItem(scopedKey);
      if (raw) return JSON.parse(raw);
      
      return fallback;
    } catch (e) { return fallback; }
  };

  const [employees, setEmployeesState] = useState<Employee[]>(() => {
    const initial = getStoredInitial('app_employees', []);
    return Array.isArray(initial) ? initial.map(normalizeEmployeeDates) : [];
  });
  const setEmployees = useCallback((val: Employee[] | ((prev: Employee[]) => Employee[])) => {
    setEmployeesState(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      return next.map(normalizeEmployeeDates);
    });
  }, []);
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

  // Cleanup missing companies on mount
  useEffect(() => {
    const cleanupCompanies = async () => {
      if (!window.electronAPI?.listSilos) return;
      
      try {
        const res = await window.electronAPI.listSilos();
        if (res.success && res.silos) {
          const foundSilos = res.silos as string[];
          
            setCompanies(prevCompanies => {
              let updated = false;
              let newCompanies = [...prevCompanies];

              // 1. Remove missing silos
              const filtered = newCompanies.filter(c => foundSilos.includes(c.id));
              if (filtered.length !== newCompanies.length) {
                console.log(`[Cleanup] Removed ${newCompanies.length - filtered.length} missing companies from registry.`);
                newCompanies = filtered;
                updated = true;
              }

              // 2. Auto-Rescue found silos that are NOT in the registry
              // V06.01.02: Disabled automatic frontend rescue to respect intentional "Remove From List Only" actions.
              // Users can use the manual "Rescue Organizations" button from the Settings menu instead.
              const existingIds = newCompanies.map(c => c.id);
              const missingSilos = foundSilos.filter(s => !existingIds.includes(s));
              if (missingSilos.length > 0) {
                console.log(`[Auto-Rescue] Found ${missingSilos.length} unregistered physical folders. Ignored automatically to respect manual delinking.`);
              }

              // Only update if something was actually changed
              if (updated) {
                localStorage.setItem('app_companies', JSON.stringify(newCompanies));
                if (window.electronAPI?.dbSetGlobal) {
                  window.electronAPI.dbSetGlobal('app_companies', newCompanies);
                }
                return newCompanies;
              }
              return prevCompanies;
          });
        }
      } catch (e) {
        console.error("Cleanup failed", e);
      }
    };

    cleanupCompanies();
  }, [setCompanies]);

  // Save activeCompanyId and switch backend data silo
  useEffect(() => {
    let isMounted = true;
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("[usePayrollData] Hydration safety timeout triggered.");
        setIsHydrating(false);
      }
    }, 5000); // 5s absolute limit

    const performSync = async () => {
      try {
        setIsHydrating(true);
        console.log(`[usePayrollData] Notifying backend of company switch: ${activeCompanyId}`);
        localStorage.setItem('app_active_company_id', activeCompanyId);
        
        if (window.electronAPI?.switchCompanyData) {
          if (window.electronAPI.dbSetGlobal) {
            await window.electronAPI.dbSetGlobal('app_active_company_id', activeCompanyId);
          }
          await window.electronAPI.switchCompanyData(activeCompanyId);
          await new Promise(resolve => setTimeout(resolve, 500));

          let dbRes = await window.electronAPI.dbGetAll();
          if (dbRes.success && Array.isArray(dbRes.data)) {
            // V04.01.02: JIT Partitioning Bridge for Legacy Monolithic Keys
            let needsReFetch = false;
            const legacyKeysToPartition = ['app_payroll_history', 'app_attendance', 'app_fines', 'app_arrear_history', 'app_ot_records'];
            for (const baseKey of legacyKeysToPartition) {
               const legacyItem = dbRes.data.find((item: any) => item.key === `${baseKey}_${activeCompanyId}` || item.key === baseKey);
               if (legacyItem) {
                  try {
                     const rawArray = typeof legacyItem.value === 'string' ? JSON.parse(legacyItem.value) : legacyItem.value;
                     if (Array.isArray(rawArray) && rawArray.length > 0) {
                        const partitions: Record<string, any[]> = {};
                        rawArray.forEach((record: any) => {
                           const m = record.month;
                           const y = Number(record.year);
                           if (m && !isNaN(y)) {
                              const startY = (m === 'January' || m === 'February' || m === 'March') ? y - 1 : y;
                              const endY = startY + 1;
                              const fy = `FY${String(startY).slice(-2)}-${String(endY).slice(-2)}`;
                              if (!partitions[fy]) partitions[fy] = [];
                              partitions[fy].push(record);
                           }
                        });

                        for (const [fy, records] of Object.entries(partitions)) {
                           const fyKey = `${baseKey}_${fy}_${activeCompanyId}`;
                           if (window.electronAPI?.dbSet) {
                              await window.electronAPI.dbSet(fyKey, records);
                           }
                        }
                        if (window.electronAPI?.dbDelete) {
                           await window.electronAPI.dbDelete(legacyItem.key);
                        }
                        needsReFetch = true;
                     }
                  } catch (e) {
                     console.error(`JIT Partitioning failed for ${baseKey}:`, e);
                  }
               }
            }

            if (needsReFetch) {
               dbRes = await window.electronAPI.dbGetAll();
            }

            const siloData: Record<string, any> = {};
            
            // Generate exact targeted keys based on current FY and Company
            const expectedKeys = {
              app_employees: getCKey('app_employees'),
              app_config: getCKey('app_config'),
              app_company_profile: getCKey('app_company_profile'),
              app_attendance: getCKey('app_attendance'),
              app_payroll_history: getCKey('app_payroll_history'),
              app_leave_ledgers: getCKey('app_leave_ledgers'),
              app_advance_ledgers: getCKey('app_advance_ledgers'),
              app_fines: getCKey('app_fines'),
              app_leave_policy: getCKey('app_leave_policy'),
              app_arrear_history: getCKey('app_arrear_history'),
              app_ot_records: getCKey('app_ot_records'),
              app_master_designations: getCKey('app_master_designations'),
              app_master_divisions: getCKey('app_master_divisions'),
              app_master_branches: getCKey('app_master_branches'),
              app_master_sites: getCKey('app_master_sites'),
              app_logo: getCKey('app_logo'),
            };

            const fySet = new Set<string>();
            let maxPayrollVal = -1;
            let maxPayrollFY = '';
            const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

            dbRes.data.forEach((item: { key: string, value: any }) => {
              const key = item.key;
              const value = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
              
              // Dynamically extract available Financial Years for this company
              if (key.endsWith(`_${activeCompanyId}`)) {
                 const match = key.match(/_(FY\d{2}-\d{2})_/);
                 if (match) {
                    let hasRealData = false;
                    try {
                       const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
                       if (Array.isArray(parsed) && parsed.length > 0) {
                          if (key.startsWith('app_attendance_FY')) {
                             hasRealData = parsed.some((r: any) => r.presentDays > 0 || r.earnedLeave > 0 || r.sickLeave > 0 || r.casualLeave > 0 || r.lopDays > 0);
                          } else if (key.startsWith('app_ot_records_FY')) {
                             hasRealData = parsed.some((r: any) => (r.otHours || 0) > 0 || (r.otAmount || 0) > 0);
                          } else if (key.startsWith('app_fines_FY')) {
                             hasRealData = parsed.some((r: any) => (r.amount || 0) > 0);
                          } else if (key.startsWith('app_advance_ledgers_FY') || key.startsWith('app_leave_ledgers_FY')) {
                             // Ledgers always have base records, so only consider them data if there's actual history/usage
                             hasRealData = parsed.some((r: any) => (r.history && r.history.length > 0) || r.usedEL > 0 || r.usedSL > 0 || r.usedCL > 0);
                          } else {
                             // Payroll history or anything else with length > 0 is real data
                             hasRealData = true;
                          }
                       } else if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0 && !Array.isArray(parsed)) {
                          hasRealData = true; // Non-empty object
                       }
                    } catch (e) {
                       // If not JSON, but not empty string
                       if (value !== '[]' && value !== '{}' && value !== '""' && value !== '') {
                          hasRealData = true;
                       }
                    }
                    
                    if (hasRealData) {
                        fySet.add(match[1]);
                    }
                 }
              }

              // V04.03.01: Find the latest processed/confirmed payroll records across all years to auto-default the year on load
              if (key.startsWith('app_payroll_history_FY') && key.endsWith(`_${activeCompanyId}`)) {
                 try {
                    const records = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
                    if (Array.isArray(records) && records.length > 0) {
                       records.forEach((r: any) => {
                          const mIdx = monthsArr.indexOf(r.month);
                          if (mIdx !== -1) {
                             const val = (r.year * 12) + mIdx;
                             if (val > maxPayrollVal) {
                                maxPayrollVal = val;
                                const match = key.match(/_(FY\d{2}-\d{2})_/);
                                if (match) {
                                   maxPayrollFY = match[1];
                                }
                             }
                          }
                       });
                    }
                 } catch (e) {
                    console.error("Error parsing payroll history in usePayrollData:", e);
                 }
              }

              Object.entries(expectedKeys).forEach(([baseKey, fullTargetKey]) => {
                if (key === fullTargetKey) {
                  // Perfect match for current FY and Company
                  siloData[baseKey] = value;
                } else if (key === `${baseKey}_${activeCompanyId}` && !siloData[baseKey]) {
                  // Fallback: Data exists from BEFORE the FY update (Legacy Double-Lock)
                  siloData[baseKey] = value;
                } else if (key === baseKey && !siloData[baseKey]) {
                  // Fallback: Really old Flat key data
                  siloData[baseKey] = value;
                }
              });

              // V04.00.07: Nuclear Cleanup for errant FY23-24 test data
              if (key.includes('_FY23-24_') && window.electronAPI?.dbDelete) {
                 window.electronAPI.dbDelete(key).catch(() => {});
                 fySet.delete('FY23-24'); // Ensure it's removed from the set
              }
            });

            // Calculate previous Financial Year carry-forwards if current transactional data is missing or not frozen/confirmed
            let isAnyFinalized = false;
            if (siloData['app_payroll_history']) {
              try {
                const parsedHistory = typeof siloData['app_payroll_history'] === 'string'
                  ? JSON.parse(siloData['app_payroll_history'])
                  : siloData['app_payroll_history'];
                if (Array.isArray(parsedHistory)) {
                  isAnyFinalized = parsedHistory.some((r: any) => r.status === 'Finalized');
                }
              } catch (e) {
                console.error("Error parsing payroll history for carry forward check:", e);
              }
            }

            const prevFY = (() => {
              const match = activeFinancialYear.match(/FY(\d{2})-(\d{2})/);
              if (match) {
                const start = parseInt(match[1]);
                const end = parseInt(match[2]);
                const prevStart = String(start - 1).padStart(2, '0');
                const prevEnd = String(end - 1).padStart(2, '0');
                return `FY${prevStart}-${prevEnd}`;
              }
              return null;
            })();

            if (prevFY) {
              const prevLeaveLedgerKey = `app_leave_ledgers_${prevFY}_${activeCompanyId}`;
              const prevAdvanceLedgerKey = `app_advance_ledgers_${prevFY}_${activeCompanyId}`;
              
              let prevLeaveItem = dbRes.data.find((item: any) => item.key === prevLeaveLedgerKey);
              if (!prevLeaveItem && prevFY === 'FY25-26') {
                const unscopedKey = `app_leave_ledgers_${activeCompanyId}`;
                prevLeaveItem = dbRes.data.find((item: any) => item.key === unscopedKey);
              }
              
              let prevAdvanceItem = dbRes.data.find((item: any) => item.key === prevAdvanceLedgerKey);
              if (!prevAdvanceItem && prevFY === 'FY25-26') {
                const unscopedKey = `app_advance_ledgers_${activeCompanyId}`;
                prevAdvanceItem = dbRes.data.find((item: any) => item.key === unscopedKey);
              }
              
              // 1. Leave Ledgers Carry-Forward
              if (!siloData['app_leave_ledgers'] || siloData['app_leave_ledgers'] === '[]') {
                try {
                  let prevLeaveLedgers: any[] = [];
                  let loadedFromMarchSnapshot = false;
                  
                  // Prioritize March finalized payroll history snapshot as ground truth
                  const prevPayrollHistoryKey = `app_payroll_history_${prevFY}_${activeCompanyId}`;
                  const prevPayrollItem = dbRes.data.find((item: any) => item.key === prevPayrollHistoryKey);
                  if (prevPayrollItem) {
                    const history = typeof prevPayrollItem.value === 'string' ? JSON.parse(prevPayrollItem.value) : prevPayrollItem.value;
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
                      console.log(`[usePayrollData] Preferred and loaded ${prevLeaveLedgers.length} records from March payroll history snapshot.`);
                    }
                  }
                  
                  // Fallback to previous living document if March finalized payroll is not available
                  if (!loadedFromMarchSnapshot) {
                    prevLeaveLedgers = prevLeaveItem 
                      ? (typeof prevLeaveItem.value === 'string' ? JSON.parse(prevLeaveItem.value) : prevLeaveItem.value)
                      : [];
                  }
                    
                  console.log(`[usePayrollData] Carrying forward leave balances to ${activeFinancialYear} (Source: ${prevLeaveItem ? prevLeaveItem.key : 'Master Card'}, Overwrite allowed: ${!isAnyFinalized})...`);
                  
                  const loadedEmployees = siloData['app_employees'] ? JSON.parse(siloData['app_employees']) : [];
                  const loadedPolicy = siloData['app_leave_policy'] ? JSON.parse(siloData['app_leave_policy']) : DEFAULT_LEAVE_POLICY;
                  
                  let baseYear = 2026;
                  const match = activeFinancialYear.match(/FY(\d{2})-(\d{2})/);
                  if (match) {
                    baseYear = 2000 + parseInt(match[1]);
                  }
                  
                  const nextLeaveLedgers = loadedEmployees.map((emp: any) => {
                    const dojDate = emp ? new Date(emp.doj) : new Date(0);
                    dojDate.setHours(0, 0, 0, 0);
                    
                    // April end of new year
                    const nextPeriodEnd = new Date(baseYear, 3, 30); // April 30th
                    nextPeriodEnd.setHours(23, 59, 59, 999);
                    const isEligible = dojDate <= nextPeriodEnd;
                    
                    const elCredit = isEligible ? (loadedPolicy?.el?.maxPerYear || 18) / 12 : 0;
                    const slCredit = isEligible ? (loadedPolicy?.sl?.maxPerYear || 12) / 12 : 0;
                    const clCredit = isEligible ? (loadedPolicy?.cl?.maxPerYear || 12) / 12 : 0;
                    
                    const l = Array.isArray(prevLeaveLedgers) ? prevLeaveLedgers.find((pl: any) => pl.employeeId === emp.id) : null;
                    
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
                      // Fallback to employee master card initialOpeningBalances
                      const initBalances = emp.initialOpeningBalances || {};
                      const initEL = initBalances.el || 0;
                      const initSL = initBalances.sl || 0;
                      const initCL = initBalances.cl || 0;
                      
                      carryEL = isEligible ? initEL : 0;
                      carrySL = isEligible ? initSL : 0;
                      carryCL = isEligible ? initCL : 0;
                    }
                    
                    return {
                      employeeId: emp.id,
                      el: { opening: carryEL, eligible: elCredit, encashed: 0, availed: 0, balance: carryEL + elCredit },
                      sl: { eligible: slCredit, availed: 0, balance: carrySL + slCredit },
                      cl: { availed: 0, accumulation: carryCL, balance: carryCL + clCredit },
                      companyId: activeCompanyId
                    };
                  });
                  
                  siloData['app_leave_ledgers'] = JSON.stringify(nextLeaveLedgers);
                  // Persist to new year in DB immediately
                  if (window.electronAPI?.dbSet) {
                    window.electronAPI.dbSet(getCKey('app_leave_ledgers'), nextLeaveLedgers).catch((e: any) => {
                      console.error("Auto save carried leave ledgers failed:", e);
                    });
                  }
                } catch (err) {
                  console.error("Failed to carry forward leave ledgers:", err);
                }
              }

              // 2. Advance Ledgers Carry-Forward
              if (!siloData['app_advance_ledgers'] || siloData['app_advance_ledgers'] === '[]') {
                try {
                  const prevAdvanceLedgers = prevAdvanceItem
                    ? (typeof prevAdvanceItem.value === 'string' ? JSON.parse(prevAdvanceItem.value) : prevAdvanceItem.value)
                    : [];
                    
                  console.log(`[usePayrollData] Carrying forward advance balances to ${activeFinancialYear} (Source: ${prevAdvanceItem ? prevAdvanceItem.key : 'Zeros'}, Overwrite allowed: ${!isAnyFinalized})...`);
                  
                  const loadedEmployees = siloData['app_employees'] ? JSON.parse(siloData['app_employees']) : [];
                  
                  const nextAdvanceLedgers = loadedEmployees.map((emp: any) => {
                    const a = Array.isArray(prevAdvanceLedgers) ? prevAdvanceLedgers.find((pa: any) => pa.employeeId === emp.id) : null;
                    
                    const carryOpening = a ? (a.balance || 0) : 0;
                    const emiCount = a ? (a.emiCount || 0) : 0;
                    const recovery = emiCount > 0 ? Math.min(Math.round(carryOpening / emiCount), carryOpening) : 0;
                    const balance = Math.max(0, carryOpening - recovery);
                    
                    return {
                      employeeId: emp.id,
                      opening: carryOpening,
                      totalAdvance: 0,
                      manualPayment: 0,
                      paidAmount: 0,
                      emiCount: emiCount,
                      recovery: recovery,
                      balance: balance,
                      monthlyInstallment: emiCount,
                      companyId: activeCompanyId
                    };
                  });
                  
                  siloData['app_advance_ledgers'] = JSON.stringify(nextAdvanceLedgers);
                  // Persist to new year in DB immediately
                  if (window.electronAPI?.dbSet) {
                    window.electronAPI.dbSet(getCKey('app_advance_ledgers'), nextAdvanceLedgers).catch((e: any) => {
                      console.error("Auto save carried advance ledgers failed:", e);
                    });
                  }
                } catch (err) {
                  console.error("Failed to carry forward advance ledgers:", err);
                }
              }
            }


             // V04.00.06: Ghost Year Auto-Correction & Switched Company Latest FY Auto-Selection
             const isCompanySwitch = lastCompanyIdRef.current !== activeCompanyId;
             lastCompanyIdRef.current = activeCompanyId;

             if (fySet.size === 0) {
                fySet.add(activeFinancialYear); // Brand new DB, keep the default
             } else {
                const validYears = Array.from(fySet).sort();
                const latestYear = validYears[validYears.length - 1];
                
                // V04.03.01: Auto-select active FY based on the last confirmed/processed payroll data to keep Dashboard in perfect sync
                const targetDefaultFY = maxPayrollFY || latestYear;
                
                if (isCompanySwitch || !fySet.has(activeFinancialYear)) {
                   if (activeFinancialYear !== targetDefaultFY) {
                      console.log(`[usePayrollData] Auto-selecting active FY based on last processed payroll data: ${targetDefaultFY}`);
                      setActiveFinancialYear(targetDefaultFY);
                      localStorage.setItem('app_active_financial_year', targetDefaultFY);
                   }
                }
             }

             const now = new Date();
             const currentYear = now.getFullYear();
             const startYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
             const activeFyFallback = `FY${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
             fySet.add(activeFyFallback);
             
             setAvailableFinancialYears(Array.from(fySet).sort());

            // V04.00.01: Aggressive LocalStorage Cleanup
            // Clean up ALL dynamically generated app_ keys to free up quota before hydrating.
            // This prevents the 5MB browser quota crash when switching FYs or Companies.
            const keysToKeep = [
               'app_active_company_id', 'app_companies', 'app_users', 'app_license_secure', 
               'app_machine_id', 'settings_initial_tab', 'app_active_financial_year', 'app_legal_agreed_date',
               'app_active_patch_ts', 'app_latest_patch_timestamp', 'app_latest_version',
               'app_download_url', 'app_download_url_win7', 'app_launcher_url',
               'app_update_hash', 'app_update_hash_win10', 'app_update_hash_win7',
               'app_patch_skip_count', 'app_version_skip_count', 'app_version_marker', 'app_update_ready'
            ];
            for (let i = localStorage.length - 1; i >= 0; i--) {
               const k = localStorage.key(i);
               if (k && k.startsWith('app_') && !keysToKeep.includes(k) && !k.startsWith('app_msg_dismissed') && !k.includes('app_setup_complete')) {
                  localStorage.removeItem(k);
               }
            }

            Object.entries(siloData).forEach(([fKey, value]) => {
              // Ensure we save it back with the STRICT correct scoping
              try {
                localStorage.setItem(getCKey(fKey), value);
              } catch (quotaErr) {
                console.warn(`[usePayrollData] LocalStorage write skipped for ${fKey} due to quota limit:`, quotaErr);
              }
              try {
                if (fKey === 'app_logo') {
                  try {
                    const parsedLogo = value.startsWith('"') ? JSON.parse(value) : value;
                    setLogoUrl(parsedLogo);
                  } catch {
                    setLogoUrl(value);
                  }
                } else {
                  const parsed = JSON.parse(value);
                  if (fKey === 'app_employees') setEmployees(parsed);
                  if (fKey === 'app_config') setConfig(parsed);
                  if (fKey === 'app_company_profile') setCompanyProfile(parsed);
                  if (fKey === 'app_attendance') setAttendances(parsed);
                  if (fKey === 'app_payroll_history') setPayrollHistory(parsed);
                  if (fKey === 'app_leave_ledgers') setLeaveLedgers(parsed);
                  if (fKey === 'app_advance_ledgers') setAdvanceLedgers(parsed);
                  if (fKey === 'app_fines') setFines(parsed);
                  if (fKey === 'app_leave_policy') setLeavePolicy(parsed);
                  if (fKey === 'app_master_designations') setDesignations(parsed);
                  if (fKey === 'app_master_divisions') setDivisions(parsed);
                  if (fKey === 'app_master_branches') setBranches(parsed);
                  if (fKey === 'app_master_sites') setSites(parsed);
                }
              } catch (e) {}
            });

            // V03.01.07: Fallback for company profile and config if not found in DB
            // This prevents a new company from inheriting data from the previous company state.
            if (!siloData['app_company_profile']) {
              const currentComp = companies.find(c => c.id === activeCompanyId);
              setCompanyProfile(currentComp || INITIAL_COMPANY_PROFILE);
            }
            if (!siloData['app_config']) {
              setConfig(INITIAL_STATUTORY_CONFIG);
            }
            if (!siloData['app_employees']) setEmployees([]);
            if (!siloData['app_attendance']) setAttendances([]);
            if (!siloData['app_payroll_history']) setPayrollHistory([]);
            if (!siloData['app_leave_ledgers']) setLeaveLedgers([]);
            if (!siloData['app_advance_ledgers']) setAdvanceLedgers([]);
            if (!siloData['app_fines']) setFines([]);
            if (!siloData['app_leave_policy']) setLeavePolicy(DEFAULT_LEAVE_POLICY);
          }
        }
      } catch (err) {
        console.error("Hydration failed:", err);
      } finally {
        if (isMounted) {
          setIsHydrating(false);
          clearTimeout(safetyTimeout);
        }
      }
    };

    performSync();
    return () => { isMounted = false; clearTimeout(safetyTimeout); };
  }, [activeCompanyId, activeFinancialYear, reloadTrigger]);


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

  // V04.03.02: JIT Hydration for missing app_companies in LocalStorage
  // (Crucial for when backend registry is intact but renderer cache was wiped)
  useEffect(() => {
    if (companies.length === 0 && window.electronAPI?.dbGetGlobal) {
      window.electronAPI.dbGetGlobal('app_companies').then((res: any) => {
        if (res) {
          try {
            const parsed = typeof res === 'string' ? JSON.parse(res) : res;
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log("[usePayrollData] Successfully recovered app_companies from global registry");
              setCompanies(parsed);
              localStorage.setItem('app_companies', JSON.stringify(parsed));
              
              // --- V05 BREAK LOOP ---
              if (localStorage.getItem('app_is_reset_mode') === 'true') {
                 localStorage.removeItem('app_is_reset_mode');
                 window.location.reload();
              }
            }
          } catch (e) {
            console.error("Failed to parse app_companies during JIT hydration", e);
          }
        }
      });
    } else if (companies.length > 0 && localStorage.getItem('app_is_reset_mode') === 'true') {
        localStorage.removeItem('app_is_reset_mode');
        window.location.reload();
    }
  }, [companies.length]);

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
        setLogoUrl(prev => prev && prev.startsWith('data:') ? prev : '../public/logo.png');
      }
    } catch (e) {
      setLogoUrl(prev => prev && prev.startsWith('data:') ? prev : '../public/logo.png');
    }
  }, [activeCompanyId, activeFinancialYear, isResetting, reloadTrigger, getCKey]);

  // --- PERSISTENCE HELPERS ---
  const safeSave = useCallback(async (key: string, data: any) => {
    if (isResetting) return;
    try {
      const uKey = getCKey(key);
      const value = JSON.stringify(data);
      
      // 1. Local Persistence (Isolated via Unique Key)
      localStorage.setItem(uKey, value);
      
      // 2. Physical Silo Persistence (Double-Lock: Unique Key inside isolated DB)
      if (window.electronAPI?.dbSet) {
        await window.electronAPI.dbSet(uKey, data);
      }
    } catch (e: any) {
      console.error(`Failed to save ${key}:`, e);
      if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
        showAlert('warning', 'Storage Limit Exceeded', "Your browser's local storage is full. Please remove large images or use the 'Factory Reset' in Settings to clear old data.");
      }
    }
  }, [isResetting, showAlert, getCKey]);

  // --- DATA PURGE UTILITY ---
  const purgeState = useCallback(() => {
    setIsResetting(true);
    
    // V03.01.05: Also clear Silo-specific LocalStorage keys to prevent race conditions
    const siloKeys = [
      'app_employees', 'app_config', 'app_company_profile',
      'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 
      'app_payroll_history', 'app_fines', 'app_leave_policy', 
      'app_arrear_history', 'app_ot_records'
    ];
    siloKeys.forEach(k => localStorage.removeItem(k));

    setEmployees([]);
    setAttendances([]);
    setLeaveLedgers([]);
    setAdvanceLedgers([]);
    setPayrollHistory([]);
    setFines([]);
    setArrearHistory([]);
    setOTRecords([]);
    // masters reset to default
    setDesignations(['Software Engineer', 'Project Manager', 'HR Manager', 'Accounts Executive', 'Peon']);
    setDivisions(['Head Office', 'Manufacturing', 'Sales', 'Marketing', 'Engineering']);
    setBranches(['Chennai', 'New Delhi', 'Mumbai', 'Bangalore']);
    setSites(['Main Plant', 'Warehouse A', 'IT Park Office', 'Site-01']);
    setLogoUrl('../public/logo.png');
    
    // Tiny delay to allow React to flush the 'empty' state before re-hydrating
    setTimeout(() => setIsResetting(false), 50);
  }, []);

  // --- HANDLERS ---
  const switchFinancialYear = useCallback((fy: string) => {
    if (fy === activeFinancialYear) return;
    
    purgeState();
    setActiveFinancialYear(fy);
    localStorage.setItem('app_active_financial_year', fy);
  }, [activeFinancialYear, purgeState]);

  const switchCompany = useCallback((id: string) => {
    if (id === activeCompanyId) return;
    
    // V03.01.05: Smooth Isolation - No more nuclear reload
    // We purge and then let the activeCompanyId effect handle the switch.
    purgeState();
    setActiveCompanyId(id);
    localStorage.setItem('app_active_company_id', id);
  }, [activeCompanyId, purgeState]);

  const addCompany = useCallback(async (newCompany: CompanyProfile, initialConfig?: StatutoryConfig) => {
    const updated = [...companies, newCompany];
    setCompanies(updated);
    localStorage.setItem('app_companies', JSON.stringify(updated));
    
    // --- LIFETIME CREATION TRACKER ---
    let lifetimeCount = parseInt(localStorage.getItem('app_lifetime_company_creations') || '0');
    // If uninitialized, seed with current companies length before adding
    if (lifetimeCount === 0) {
      lifetimeCount = companies.length;
    }
    lifetimeCount += 1;
    localStorage.setItem('app_lifetime_company_creations', lifetimeCount.toString());

    if (window.electronAPI?.dbSetGlobal) {
      await window.electronAPI.dbSetGlobal('app_companies', updated);
      await window.electronAPI.dbSetGlobal('app_lifetime_company_creations', lifetimeCount);
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

  const deleteCompany = useCallback(async (id: string) => {
    if (companies.length <= 1) {
      showAlert('warning', 'Action Prohibited', 'You must have at least one company in the system.');
      return;
    }

    if (id === activeCompanyId) {
      showAlert('warning', 'Action Prohibited', "Can't DELETE the current company which is in open state. Please switch to another company first.");
      return;
    }

    const updated = companies.filter(c => c.id !== id);
    setCompanies(updated);
    localStorage.setItem('app_companies', JSON.stringify(updated));
    if (window.electronAPI?.dbSetGlobal) {
      window.electronAPI.dbSetGlobal('app_companies', updated);
    }

    // V03.01.04: Physical cleanup
    if (window.electronAPI?.deleteSilo) {
      const res = await window.electronAPI.deleteSilo(id);
      if (res && res.success === false) {
        showAlert('error', 'Folder Deletion Failed', `Could not delete the company's physical folder: ${res.error || 'Unknown Error'}. Please ensure no files inside are open in another application and try again.`);
        return;
      }
    }

    if (activeCompanyId === id) {
      switchCompany(updated[0].id);
    }

    showAlert('success', 'Organization Removed', 'The organization and its physical data have been permanently deleted.');
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
      const subfolderPath = `${getCompanyBackupFolder(companyProfile.establishmentName, companyProfile.id)}/BK_${getMonthAbbr(globalMonth)}${String(globalYear).slice(-2)}`;
      const backupRes = await window.electronAPI.createDataBackup({
        fileName: backupFileName,
        subfolder: subfolderPath,
        encryptionKey: encryptionKey
      });

      const currentIdx = monthsArr.indexOf(globalMonth);
      let nextMonth = globalMonth;
      let nextYear = globalYear;
      if (currentIdx === 11) { nextMonth = monthsArr[0]; nextYear = globalYear + 1; }
      else { nextMonth = monthsArr[currentIdx + 1]; }

      // Compute Next States
      const nextAttendances = attendances.map(a => a.month === globalMonth && a.year === globalYear ? { ...a, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0, encashedDays: 0 } : a);
      
      const currentHistory = updatedHistory || payrollHistory;
      const finalizedResults = currentHistory.filter(r => r.month === globalMonth && r.year === globalYear && r.status === 'Finalized');
      
      const nextAdvanceLedgers = advanceLedgers.map(a => {
        const payrollResult = finalizedResults.find(r => r.employeeId === a.employeeId);
        const actualRecovered = payrollResult ? (payrollResult.deductions?.advanceRecovery ?? 0) : 0;
        const carryOpening = Math.max(0, (a.opening || 0) + (a.totalAdvance || 0) - actualRecovered);
        const nextEmiCount = carryOpening > 0 ? Math.max(1, (a.emiCount || 0) - (actualRecovered > 0 ? 1 : 0)) : 0;
        const nextRecovery = nextEmiCount > 0 ? Math.min(Math.round(carryOpening / nextEmiCount), carryOpening) : 0;
        return { ...a, opening: carryOpening, totalAdvance: 0, manualPayment: 0, paidAmount: 0, monthlyInstallment: 0, emiCount: nextEmiCount, recovery: nextRecovery, balance: Math.max(0, carryOpening - nextRecovery) };
      });

      const nextLeaveLedgers = leaveLedgers.map(l => {
        const payrollResult = finalizedResults.find(r => r.employeeId === l.employeeId);
        const emp = employees.find(e => e.id === l.employeeId);
        const dojDate = emp ? new Date(emp.doj) : new Date(0);
        dojDate.setHours(0, 0, 0, 0);
        const nextPeriodEnd = new Date(nextYear, monthsArr.indexOf(nextMonth) + 1, 0);
        nextPeriodEnd.setHours(23, 59, 59, 999);
        const isEligible = dojDate <= nextPeriodEnd;
        let prevELBal = l.el.balance; let prevSLBal = l.sl.balance; let prevCLBal = l.cl.balance;
        if (payrollResult && payrollResult.leaveSnapshot) {
          prevELBal = payrollResult.leaveSnapshot.el.balance; prevSLBal = payrollResult.leaveSnapshot.sl.balance; prevCLBal = payrollResult.leaveSnapshot.cl.balance;
        }
        const elCredit = isEligible ? (leavePolicy?.el?.maxPerYear || 18) / 12 : 0;
        const slCredit = isEligible ? (leavePolicy?.sl?.maxPerYear || 12) / 12 : 0;
        const clCredit = isEligible ? (leavePolicy?.cl?.maxPerYear || 12) / 12 : 0;
        const isAprilReset = nextMonth === 'April';
        const carryEL = isEligible ? Math.min(prevELBal, isAprilReset ? (leavePolicy?.el?.maxCarryForward || 30) : 999) : 0;
        const carrySL = isEligible ? (isAprilReset ? Math.min(prevSLBal, leavePolicy?.sl?.maxCarryForward || 0) : prevSLBal) : 0;
        const carryCL = isEligible ? (isAprilReset ? Math.min(prevCLBal, leavePolicy?.cl?.maxCarryForward || 0) : prevCLBal) : 0;
        return {
           ...l,
           el: { opening: carryEL, eligible: elCredit, encashed: 0, availed: 0, balance: carryEL + elCredit },
           sl: { eligible: slCredit, availed: 0, balance: carrySL + slCredit },
           cl: { availed: 0, accumulation: carryCL, balance: carryCL + clCredit }
        };
      });

      const nextFines = fines.filter(f => !(f.month === globalMonth && f.year === globalYear));
      const nextOTRecords = otRecords.filter(f => !(f.month === globalMonth && f.year === globalYear));

      setAttendances(nextAttendances);
      setAdvanceLedgers(nextAdvanceLedgers);
      setLeaveLedgers(nextLeaveLedgers);
      setFines(nextFines);
      setOTRecords(nextOTRecords);

      // V04.00.04: If rolling over from March to April, physically persist the carry-forwards to the NEW FY silo
      if (globalMonth === 'March' && nextMonth === 'April' && window.electronAPI?.dbSet) {
          const targetFY = `FY${String(nextYear).slice(-2)}-${String(nextYear + 1).slice(-2)}`;
          // We manually craft the keys to bypass activeFinancialYear since it hasn't switched yet
          const overrideCKey = (k: string) => `${k}_${targetFY}_${activeCompanyId}`;
          await window.electronAPI.dbSet(overrideCKey('app_attendance'), nextAttendances);
          await window.electronAPI.dbSet(overrideCKey('app_advance_ledgers'), nextAdvanceLedgers);
          await window.electronAPI.dbSet(overrideCKey('app_leave_ledgers'), nextLeaveLedgers);
          await window.electronAPI.dbSet(overrideCKey('app_fines'), nextFines);
          await window.electronAPI.dbSet(overrideCKey('app_ot_records'), nextOTRecords);
      }
      
      return { nextMonth, nextYear, backupRes, backupFileName };
    } catch (e: any) {
      showAlert('error', 'Rollover Failed', `Critical error during month initialization: ${e.message}`);
      return null;
    }
  }, [companyProfile, payrollHistory, showAlert, activeFinancialYear, activeCompanyId]);

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
       sessionStorage.setItem('app_is_reloading_after_reset', 'true');
       window.location.reload();
    }, undefined, 'RELOAD NOW', undefined, undefined, 5, false, 'Disk Cleanup in Progress...');
  }, [showAlert, activeCompanyId, getCKey]);

  const handleDeepReset = useCallback(async (deleteFolder = true, targetCompanyId?: string) => {
    const purgeId = targetCompanyId || activeCompanyId;
    const isPurgingActive = purgeId === activeCompanyId;

    if (isPurgingActive) {
        setIsResetting(true);
    }
    
    // 1. Determine updated companies array
    const updatedCompanies = companies.filter(c => c.id !== purgeId);
    
    const targetProfile = companies.find(c => c.id === purgeId);

    
    // 2. Wipe the keys for the active company ONLY IF purging active
    if (isPurgingActive) {
      const keysToWipe = [
        'app_employees', 'app_config', 'app_company_profile',
        'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 'app_payroll_history',
        'app_fines', 'app_leave_policy', 'app_arrear_history', 'app_ot_records', 'app_logo',
        'app_master_designations', 'app_master_divisions', 'app_master_branches', 'app_master_sites'
      ];

      // Wipe active company keys from local storage only to prevent SQLite locks before physical folder deletion
      for (const k of keysToWipe) {
        localStorage.removeItem(getCKey(k));
        localStorage.removeItem(k);
      }
    }

    // 3. Clear/delete the SQLite database silo
    if (deleteFolder && (window as any).electronAPI?.deleteSilo) {
      try {
        const res = await (window as any).electronAPI.deleteSilo(purgeId);
        if (res && res.success === false) {
          showAlert('error', 'Folder Deletion Failed', `Could not delete the company's physical folder: ${res.error || 'Unknown Error'}. Please ensure no files inside are open in another application and try again.`);
          if (isPurgingActive) setIsResetting(false);
          return;
        }
      } catch (e) {
        console.error("Error calling deleteSilo", e);
        showAlert('error', 'Folder Deletion Failed', `An unexpected error occurred: ${(e as any).message || e}`);
        if (isPurgingActive) setIsResetting(false);
        return;
      }
    }

    // 4. Update the global companies list
    localStorage.setItem('app_companies', JSON.stringify(updatedCompanies));
    setCompanies(updatedCompanies);
    if ((window as any).electronAPI?.dbSetGlobal) {
      try {
        await (window as any).electronAPI.dbSetGlobal('app_companies', updatedCompanies);
      } catch (e) { console.error("Error updating app_companies globally", e); }
    }

    // 5. Determine the next company or setup mode
    if (!isPurgingActive) {
      const successMsg = deleteFolder
        ? `The company '${targetProfile?.establishmentName || purgeId}' (ID: ${purgeId}) has been completely deleted and its physical folders purged.`
        : `The company '${targetProfile?.establishmentName || purgeId}' (ID: ${purgeId}) has been removed from active registries. The physical folders remain intact.`;

      showAlert('success', 'Company Removed Successfully', successMsg);
      return;
    }

    if (updatedCompanies.length > 0) {
      const nextCompany = updatedCompanies[0];
      localStorage.setItem('app_active_company_id', nextCompany.id);
      localStorage.setItem('app_setup_complete', 'true');
      
      const successMsg = deleteFolder
        ? `The company '${targetProfile?.establishmentName || purgeId}' (ID: ${purgeId}) has been completely deleted and its physical folders purged. The system will now reload to load your remaining company: '${nextCompany.establishmentName}' (ID: ${nextCompany.id}).`
        : `The company '${targetProfile?.establishmentName || purgeId}' (ID: ${purgeId}) has been removed from active registries. The physical folders remain intact. The system will now reload to load your remaining company: '${nextCompany.establishmentName}' (ID: ${nextCompany.id}).`;

      showAlert('success', 'Company Removed Successfully', successMsg, () => {
        sessionStorage.setItem('app_is_reloading_after_reset', 'true');
        window.location.reload();
      }, undefined, 'LOAD NEXT COMPANY', undefined, undefined, 5, false, 'Switching Silos...');
    } else {
      localStorage.removeItem('app_active_company_id');
      localStorage.setItem('app_setup_complete', 'false');
      localStorage.setItem('app_is_reset_mode', 'true');
      
      const successMsg = deleteFolder
        ? `The company '${targetProfile?.establishmentName || purgeId}' (ID: ${purgeId}) has been completely deleted and its physical folders purged. System will now reload to Setup Mode.`
        : `The company '${targetProfile?.establishmentName || purgeId}' (ID: ${purgeId}) has been removed from active registries (folders remain intact). System will now reload to Setup Mode.`;

      showAlert('success', 'All Companies Removed', successMsg, () => {
        sessionStorage.setItem('app_is_reloading_after_reset', 'true');
        window.location.reload();
      }, undefined, 'ENTER SETUP MODE', undefined, undefined, 5, false, 'Preparing Setup Environment...');
    }
  }, [showAlert, activeCompanyId, companies, getCKey, companyProfile]);

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
      sessionStorage.setItem('app_is_reloading_after_reset', 'true');
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
    companies, setCompanies, activeCompanyId, activeFinancialYear, availableFinancialYears, switchCompany, switchFinancialYear, addCompany, deleteCompany, purgeState,
    triggerReload
  };
};
