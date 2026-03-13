
import { useState, useCallback, useEffect } from 'react';

export const useAppInitialization = (verifyLicense: () => Promise<void>) => {
  const [isAppDirectoryConfigured, setIsAppDirectoryConfigured] = useState<boolean | null>(null);

  const initApp = useCallback(async () => {
    // @ts-ignore
    if (window.electronAPI && window.electronAPI.getAppDirectory) {
      // @ts-ignore
      const dir = await window.electronAPI.getAppDirectory();
      setIsAppDirectoryConfigured(!!dir);

      if (dir) {
        // Recovery logic
        // @ts-ignore
        const licenseRes = await window.electronAPI.dbGet('app_license_secure');
        if (licenseRes.success && licenseRes.data && !localStorage.getItem('app_license_secure')) {
          console.log("RECOVERY: LocalStorage empty but SQLite contains data. Restoring...");
          const keysToRecover = [
            'app_license_secure', 'app_data_size', 'app_machine_id', 'app_setup_complete',
            'app_users', 'app_master_designations', 'app_master_divisions', 'app_master_branches',
            'app_master_sites', 'app_employees', 'app_config', 'app_company_profile',
            'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 'app_payroll_history',
            'app_fines', 'app_leave_policy', 'app_arrear_history', 'app_logo'
          ];
          for (const k of keysToRecover) {
             // @ts-ignore
            const res = await window.electronAPI.dbGet(k);
            if (res.success && res.data !== null && res.data !== undefined) {
              const isStringVal = typeof res.data === 'string' && (k === 'app_license_secure' || k === 'app_machine_id' || k === 'app_setup_complete' || k === 'app_data_size');
              localStorage.setItem(k, isStringVal ? res.data : JSON.stringify(res.data));
            }
          }
          window.location.reload();
          return;
        }
      } else {
         // @ts-ignore
        const searchRes = await window.electronAPI.findBPPApp();
        if (searchRes.success && searchRes.path) {
           // @ts-ignore
          await window.electronAPI.initializeAppDirectory(searchRes.path);
          window.location.reload();
          return;
        }
      }
    } else {
      setIsAppDirectoryConfigured(true);
    }

    await verifyLicense();
  }, [verifyLicense]);

  useEffect(() => {
    initApp();
  }, []);

  return { isAppDirectoryConfigured, setIsAppDirectoryConfigured };
};
