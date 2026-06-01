import { useEffect, useRef } from 'react';
import { 
  Employee, StatutoryConfig, CompanyProfile, Attendance, 
  LeaveLedger, AdvanceLedger, PayrollResult, ArrearBatch, FineRecord, OTRecord 
} from '../types';

interface SyncProps {
  employees: Employee[];
  config: StatutoryConfig;
  companyProfile: CompanyProfile;
  attendances: Attendance[];
  leaveLedgers: LeaveLedger[];
  advanceLedgers: AdvanceLedger[];
  payrollHistory: PayrollResult[];
  fines: FineRecord[];
  leavePolicy: any;
  arrearHistory: ArrearBatch[];
  otRecords: OTRecord[];
  logoUrl: string;
  designations: string[];
  divisions: string[];
  branches: string[];
  sites: string[];
  isSetupComplete: boolean;
  safeSave: (key: string, data: any) => void;
  activeCompanyId: string;
  activeFinancialYear: string; // V04.03.02: Scoping protection
  isHydrating: boolean;
  isResetting: boolean;
}

export const useSync = (props: SyncProps) => {
  const {
    employees, config, companyProfile, attendances, leaveLedgers,
    advanceLedgers, payrollHistory, fines, leavePolicy, arrearHistory, otRecords,
    logoUrl, designations, divisions, branches, sites, isSetupComplete,
    safeSave, activeCompanyId, activeFinancialYear, isHydrating, isResetting
  } = props;

  // V04.03.02: Guard against render-frame race conditions during transition
  const lastCompanyRef = useRef(activeCompanyId);
  const lastFYRef = useRef(activeFinancialYear);
  const suspendSyncRef = useRef(true); // Default to true on mount until fully settled

  // 1. Company/FY change guard (instant lock)
  if (lastCompanyRef.current !== activeCompanyId || lastFYRef.current !== activeFinancialYear) {
    console.log(`[useSync] Transition detected from ${lastFYRef.current}/${lastCompanyRef.current} to ${activeFinancialYear}/${activeCompanyId}. Suspending writes.`);
    lastCompanyRef.current = activeCompanyId;
    lastFYRef.current = activeFinancialYear;
    suspendSyncRef.current = true;
  }

  // 2. Hydration lifecycle and settle delay guard (Dynamic link to UI loading screen!)
  useEffect(() => {
    if (isHydrating) {
      suspendSyncRef.current = true;
      console.log("[useSync] Hydration/Loading screen active. Sync writes locked.");
    } else {
      // Hydration finished. Keep writes locked for another 1.5 seconds to let all React states settle perfectly in DOM.
      const timer = setTimeout(() => {
        suspendSyncRef.current = false;
        console.log("[useSync] React states fully settled in DOM. Sync writes unlocked.");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isHydrating]);

  // Master Persistence Sync (Electron DB)
  useEffect(() => {
    if (isHydrating || isResetting || suspendSyncRef.current) return;
    
    const handler = setTimeout(async () => {
      if ((window as any).electronAPI) {
        const allUsersRaw = localStorage.getItem('app_users');
        const allUsers = (() => { try { return allUsersRaw ? JSON.parse(allUsersRaw) : []; } catch { return []; } })();
        
        const getCKey = (key: string) => {
          const transactionalKeys = [
            'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 
            'app_payroll_history', 'app_fines', 'app_arrear_history', 'app_ot_records'
          ];
          if (transactionalKeys.includes(key)) {
            return `${key}_${activeFinancialYear}_${activeCompanyId}`;
          }
          return `${key}_${activeCompanyId}`;
        };

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
          { k: 'app_ot_records', v: otRecords },
          { k: 'app_logo', v: logoUrl },
          { k: 'app_master_designations', v: designations },
          { k: 'app_master_divisions', v: divisions },
          { k: 'app_master_branches', v: branches },
          { k: 'app_master_sites', v: sites },
          { k: 'app_setup_complete', v: isSetupComplete ? 'true' : 'false' },
          { k: 'app_users', v: allUsers }
        ];
        for (const item of keys) {
          (window as any).electronAPI.dbSet(getCKey(item.k), item.v);
        }
        
        // Also save the master companies list
        const companiesRaw = localStorage.getItem('app_companies');
        if (companiesRaw) {
          (window as any).electronAPI.dbSet('app_companies', JSON.parse(companiesRaw));
        }
        (window as any).electronAPI.dbSet('app_active_company_id', activeCompanyId);
      }
    }, 1000); // Debounce database writes by 1 second

    return () => clearTimeout(handler);
  }, [
    employees, config, companyProfile, attendances, leaveLedgers, advanceLedgers,
    payrollHistory, fines, leavePolicy, arrearHistory, otRecords, logoUrl,
    designations, divisions, branches, sites, isSetupComplete, activeCompanyId,
    isHydrating, isResetting
  ]);

  // LocalStorage Direct Syncs (Shielded during Reset and Transition)
  useEffect(() => { if (isHydrating || isResetting || suspendSyncRef.current) return; safeSave('app_employees', employees); }, [employees, safeSave, isHydrating, isResetting]);
  useEffect(() => { if (isHydrating || isResetting || suspendSyncRef.current) return; safeSave('app_config', config); }, [config, safeSave, isHydrating, isResetting]);
  useEffect(() => { if (isHydrating || isResetting || suspendSyncRef.current) return; safeSave('app_company_profile', companyProfile); }, [companyProfile, safeSave, isHydrating, isResetting]);
  useEffect(() => { if (isHydrating || isResetting || suspendSyncRef.current) return; safeSave('app_attendance', attendances); }, [attendances, safeSave, isHydrating, isResetting]);
  useEffect(() => { if (isHydrating || isResetting || suspendSyncRef.current) return; safeSave('app_leave_ledgers', leaveLedgers); }, [leaveLedgers, safeSave, isHydrating, isResetting]);
  useEffect(() => { if (isHydrating || isResetting || suspendSyncRef.current) return; safeSave('app_advance_ledgers', advanceLedgers); }, [advanceLedgers, safeSave, isHydrating, isResetting]);
  useEffect(() => { if (isHydrating || isResetting || suspendSyncRef.current) return; safeSave('app_payroll_history', payrollHistory); }, [payrollHistory, safeSave, isHydrating, isResetting]);
  useEffect(() => { if (isHydrating || isResetting || suspendSyncRef.current) return; safeSave('app_leave_policy', leavePolicy); }, [leavePolicy, safeSave, isHydrating, isResetting]);
  useEffect(() => { if (isHydrating || isResetting || suspendSyncRef.current) return; safeSave('app_master_designations', designations); }, [designations, safeSave, isHydrating, isResetting]);
  useEffect(() => { if (isHydrating || isResetting || suspendSyncRef.current) return; safeSave('app_master_divisions', divisions); }, [divisions, safeSave, isHydrating, isResetting]);
  useEffect(() => { if (isHydrating || isResetting || suspendSyncRef.current) return; safeSave('app_master_branches', branches); }, [branches, safeSave, isHydrating, isResetting]);
  useEffect(() => { if (isHydrating || isResetting || suspendSyncRef.current) return; safeSave('app_master_sites', sites); }, [sites, safeSave, isHydrating, isResetting]);
  useEffect(() => { if (isHydrating || isResetting || suspendSyncRef.current) return; safeSave('app_fines', fines); }, [fines, safeSave, isHydrating, isResetting]);
  useEffect(() => { if (isHydrating || isResetting || suspendSyncRef.current) return; safeSave('app_arrear_history', arrearHistory); }, [arrearHistory, safeSave, isHydrating, isResetting]);
  useEffect(() => { if (isHydrating || isResetting || suspendSyncRef.current) return; safeSave('app_ot_records', otRecords); }, [otRecords, safeSave, isHydrating, isResetting]);
};
