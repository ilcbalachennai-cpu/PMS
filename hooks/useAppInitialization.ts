
import { useState, useCallback, useEffect } from 'react';

export const useAppInitialization = (verifyLicense: () => Promise<void>) => {
  const [isAppDirectoryConfigured, setIsAppDirectoryConfigured] = useState<boolean | null>(null);
  const [isBootSyncComplete, setIsBootSyncComplete] = useState<boolean>(false);

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
            'app_users', 'app_companies', 'app_active_company_id',
            'app_master_designations', 'app_master_divisions', 'app_master_branches',
            'app_master_sites', 'app_employees', 'app_config', 'app_company_profile',
            'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 'app_payroll_history',
            'app_fines', 'app_leave_policy', 'app_arrear_history', 'app_logo',
            'app_active_patch_ts', 'app_latest_patch_timestamp', 'app_latest_version',
            'app_download_url', 'app_download_url_win7', 'app_launcher_url',
            'app_update_hash', 'app_update_hash_win10', 'app_update_hash_win7',
            'app_patch_skip_count', 'app_version_marker'
          ];
          const stringKeys = [
            'app_license_secure', 'app_machine_id', 'app_setup_complete', 'app_data_size',
            'app_active_company_id', 'app_active_patch_ts', 'app_latest_patch_timestamp',
            'app_latest_version', 'app_download_url', 'app_download_url_win7',
            'app_launcher_url', 'app_update_hash', 'app_update_hash_win10',
            'app_update_hash_win7', 'app_patch_skip_count', 'app_version_marker'
          ];
          for (const k of keysToRecover) {
             // @ts-ignore
            const res = await window.electronAPI.dbGet(k);
            if (res.success && res.data !== null && res.data !== undefined) {
              const isStringVal = typeof res.data === 'string' && stringKeys.includes(k);
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
    // --- V05.02.05: Robust Boot Synchronization ---
    // Always sync system update parameters from SQLite to LocalStorage on boot.
    // This makes update and patch timestamps 100% resilient against LocalStorage write-buffering cutoff.
    // @ts-ignore
    if (window.electronAPI && window.electronAPI.getAppDirectory) {
      try {
        const systemKeys = [
          'app_active_patch_ts', 
          'app_latest_patch_timestamp', 
          'app_latest_version', 
          'app_patch_skip_count', 
          'app_version_skip_count', 
          'app_version_marker'
        ];
        for (const k of systemKeys) {
          // @ts-ignore
          const res = await window.electronAPI.dbGet(k);
          if (res.success && res.data !== null && res.data !== undefined) {
             localStorage.setItem(k, String(res.data));
          }
        }
      } catch (syncErr) {
        console.warn("System update boot sync failed:", syncErr);
      }
    }

    await verifyLicense();
    setIsBootSyncComplete(true);
  }, [verifyLicense]);

  useEffect(() => {
    initApp();
  }, [initApp]);

  return { isAppDirectoryConfigured, isBootSyncComplete };
};
