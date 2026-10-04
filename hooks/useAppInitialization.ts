
import { useState, useCallback, useEffect } from 'react';
import { APP_PATCH_TIMESTAMP } from '../services/licenseService';
import { parseDateTime } from '../utils/formatters';

export const useAppInitialization = (verifyLicense: () => Promise<void>) => {
  const [isAppDirectoryConfigured, setIsAppDirectoryConfigured] = useState<boolean | null>(null);
  const [isBootSyncComplete, setIsBootSyncComplete] = useState<boolean>(false);

  const initApp = useCallback(async () => {
    try {
      // @ts-ignore
      if (window.electronAPI && window.electronAPI.getAppDirectory) {
        // @ts-ignore
        const dir = await window.electronAPI.getAppDirectory();
        setIsAppDirectoryConfigured(!!dir);

        if (dir) {
          try {
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
                'app_fines', 'app_leave_policy', 'app_arrear_history', 'app_logo'
              ];
              const stringKeys = [
                'app_license_secure', 'app_machine_id', 'app_setup_complete', 'app_data_size',
                'app_active_company_id'
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
          } catch (recoveryErr) {
            console.warn("Recovery sequence failed:", recoveryErr);
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
    } catch (dirErr) {
      console.warn("Failed to check app directory configuration:", dirErr);
      setIsAppDirectoryConfigured(true);
    }

    // --- V05.02.05: Robust Boot Synchronization ---
    if (window.electronAPI && window.electronAPI.getAppDirectory) {
      try {
        const systemKeys = [
          'app_active_patch_ts', 
          'app_pending_patch_ts',
          'app_active_installer_hash',
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
             let val = String(res.data);
             // Baseline enforcement: Active patch timestamp can NEVER be older than compiled software baseline
             // and NEVER downgraded by an old database value or stale backup!
             if (k === 'app_active_patch_ts') {
                 const currentLocal = localStorage.getItem('app_active_patch_ts') || '';
                 const localHashes = [
                     localStorage.getItem('app_active_installer_hash'),
                     localStorage.getItem('app_pending_installer_hash')
                 ].filter(Boolean).map(h => (h || '').trim().toLowerCase());
                 const cloudWin10 = (localStorage.getItem('app_update_hash_win10') || localStorage.getItem('app_update_hash') || '').trim().toLowerCase();
                 const cloudWin7 = (localStorage.getItem('app_update_hash_win7') || '').trim().toLowerCase();
                 const cloudTs = localStorage.getItem('app_latest_patch_timestamp') || '';
                 const isExactHash = localHashes.some(h => h && (h === cloudWin10 || h === cloudWin7));

                 let finalTs = (isExactHash && cloudTs) ? cloudTs : APP_PATCH_TIMESTAMP;
                 if (val && parseDateTime(val) >= parseDateTime(finalTs)) {
                    finalTs = val;
                 }
                 if (currentLocal && parseDateTime(currentLocal) >= parseDateTime(finalTs)) {
                    finalTs = currentLocal;
                 }
                 val = finalTs;
                 const dbSetFn = (window as any).electronAPI?.dbSetGlobal || (window as any).electronAPI?.dbSet;
                 if (dbSetFn) dbSetFn(k, val).catch(() => {});
              }
             if (k === 'app_active_installer_hash' && (!val || val === 'null' || val === 'undefined')) {
                const currentLocalHash = localStorage.getItem('app_active_installer_hash');
                if (currentLocalHash) {
                   val = currentLocalHash;
                   const dbSetFn = (window as any).electronAPI?.dbSetGlobal || (window as any).electronAPI?.dbSet;
                   if (dbSetFn) dbSetFn(k, val).catch(() => {});
                }
             }
             localStorage.setItem(k, val);
          } else if (k === 'app_active_patch_ts') {
              const currentLocal = localStorage.getItem('app_active_patch_ts') || '';
              const localHashes = [
                  localStorage.getItem('app_active_installer_hash'),
                  localStorage.getItem('app_pending_installer_hash')
              ].filter(Boolean).map(h => (h || '').trim().toLowerCase());
              const cloudWin10 = (localStorage.getItem('app_update_hash_win10') || localStorage.getItem('app_update_hash') || '').trim().toLowerCase();
              const cloudWin7 = (localStorage.getItem('app_update_hash_win7') || '').trim().toLowerCase();
              const cloudTs = localStorage.getItem('app_latest_patch_timestamp') || '';
              const isExactHash = localHashes.some(h => h && (h === cloudWin10 || h === cloudWin7));

              let finalTs = (isExactHash && cloudTs) ? cloudTs : APP_PATCH_TIMESTAMP;
              if (currentLocal && parseDateTime(currentLocal) >= parseDateTime(finalTs)) {
                 finalTs = currentLocal;
              }
              localStorage.setItem('app_active_patch_ts', finalTs);
              const dbSetFn = (window as any).electronAPI?.dbSetGlobal || (window as any).electronAPI?.dbSet;
              if (dbSetFn) dbSetFn('app_active_patch_ts', finalTs).catch(() => {});
           }
        }
      } catch (syncErr) {
        console.warn("System update boot sync failed:", syncErr);
      }
    }

    try {
      await Promise.race([
        verifyLicense(),
        new Promise((resolve) => setTimeout(resolve, 15000))
      ]);
    } catch (licErr) {
      console.error("License verification failed during initApp:", licErr);
    }
    setIsBootSyncComplete(true);
    // @ts-ignore
    if (window.electronAPI && typeof window.electronAPI.signalInitComplete === 'function') {
      // @ts-ignore
      window.electronAPI.signalInitComplete();
    }
  }, [verifyLicense]);

  useEffect(() => {
    initApp();
  }, [initApp]);

  return { isAppDirectoryConfigured, isBootSyncComplete };
};
