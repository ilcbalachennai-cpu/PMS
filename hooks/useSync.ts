
import { useEffect } from 'react';
import { 
  Employee, StatutoryConfig, CompanyProfile, Attendance, 
  LeaveLedger, AdvanceLedger, PayrollResult, ArrearBatch, FineRecord 
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
  logoUrl: string;
  designations: string[];
  divisions: string[];
  branches: string[];
  sites: string[];
  isSetupComplete: boolean;
  safeSave: (key: string, data: any) => void;
}

export const useSync = (props: SyncProps) => {
  const {
    employees, config, companyProfile, attendances, leaveLedgers,
    advanceLedgers, payrollHistory, fines, leavePolicy, arrearHistory,
    logoUrl, designations, divisions, branches, sites, isSetupComplete,
    safeSave
  } = props;

  // Master Persistence Sync (Electron DB)
  useEffect(() => {
    const syncToDB = async () => {
      if ((window as any).electronAPI) {
        const allUsersRaw = localStorage.getItem('app_users');
        const allUsers = allUsersRaw ? JSON.parse(allUsersRaw) : [];
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
          { k: 'app_logo', v: logoUrl },
          { k: 'app_master_designations', v: designations },
          { k: 'app_master_divisions', v: divisions },
          { k: 'app_master_branches', v: branches },
          { k: 'app_master_sites', v: sites },
          { k: 'app_setup_complete', v: isSetupComplete ? 'true' : 'false' },
          { k: 'app_users', v: allUsers }
        ];
        for (const item of keys) {
          (window as any).electronAPI.dbSet(item.k, item.v);
        }
      }
    };
    syncToDB();
  }, [
    employees, config, companyProfile, attendances, leaveLedgers, advanceLedgers,
    payrollHistory, fines, leavePolicy, arrearHistory, logoUrl,
    designations, divisions, branches, sites, isSetupComplete
  ]);

  // LocalStorage Direct Syncs
  useEffect(() => { safeSave('app_employees', employees); }, [employees, safeSave]);
  useEffect(() => { safeSave('app_config', config); }, [config, safeSave]);
  useEffect(() => { safeSave('app_company_profile', companyProfile); }, [companyProfile, safeSave]);
  useEffect(() => { safeSave('app_attendance', attendances); }, [attendances, safeSave]);
  useEffect(() => { safeSave('app_leave_ledgers', leaveLedgers); }, [leaveLedgers, safeSave]);
  useEffect(() => { safeSave('app_advance_ledgers', advanceLedgers); }, [advanceLedgers, safeSave]);
  useEffect(() => { safeSave('app_payroll_history', payrollHistory); }, [payrollHistory, safeSave]);
  useEffect(() => { safeSave('app_leave_policy', leavePolicy); }, [leavePolicy, safeSave]);
  useEffect(() => { safeSave('app_master_designations', designations); }, [designations, safeSave]);
  useEffect(() => { safeSave('app_master_divisions', divisions); }, [divisions, safeSave]);
  useEffect(() => { safeSave('app_master_branches', branches); }, [branches, safeSave]);
  useEffect(() => { safeSave('app_master_sites', sites); }, [sites, safeSave]);
  useEffect(() => { safeSave('app_fines', fines); }, [fines, safeSave]);
  useEffect(() => { safeSave('app_arrear_history', arrearHistory); }, [arrearHistory, safeSave]);
};
