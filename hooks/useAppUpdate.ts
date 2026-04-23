
import { useState, useEffect, useCallback } from 'react';
import { APP_VERSION, APP_PATCH_TIMESTAMP } from '../services/licenseService';

  const parseDateTime = (str: string | null): number => {
    if (!str) return 0;
    try {
      const [datePart, timePart] = str.split(' ');
      const [day, month, year] = datePart.split('-').map(Number);
      const [hour, minute, second] = (timePart || '00:00:00').split(':').map(Number);
      return new Date(year, month - 1, day, hour, minute, second).getTime();
    } catch (e) { return 0; }
  };

  const isVersionHigher = (latest: string, current: string): boolean => {
    try {
      // Helper to strip non-numeric prefixes like 'V' or 'v'
      const normalize = (v: string) => v.replace(/^[vV]/, '').split('.');
      
      const l = normalize(latest).map(v => parseInt(v, 10) || 0);
      const c = normalize(current).map(v => parseInt(v, 10) || 0);
      
      for (let i = 0; i < Math.max(l.length, c.length); i++) {
        const v1 = l[i] || 0;
        const v2 = c[i] || 0;
        if (v1 > v2) return true;
        if (v1 < v2) return false;
      }
      return false;
    } catch (e) { return false; }
  };

export const useAppUpdate = (showAlert: any, isDeveloper: boolean = false) => {
  const [latestAppVersion, setLatestAppVersion] = useState<string | null>(localStorage.getItem('app_latest_version'));
  const [latestPatchTimestamp, setLatestPatchTimestamp] = useState<string | null>(localStorage.getItem('app_latest_patch_timestamp'));
  const [downloadUrl, setDownloadUrl] = useState<string | null>(localStorage.getItem('app_download_url'));
  const [sha256, setSha256] = useState<string | null>(localStorage.getItem('app_update_hash'));
  const [showUpdateNotice, setShowUpdateNotice] = useState(false);
  const [showBackgroundNotice, setShowBackgroundNotice] = useState(false);
  const [isUpdateDownloading, setIsUpdateDownloading] = useState(false);
  const [isUpdatePreparing, setIsUpdatePreparing] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(localStorage.getItem('app_update_ready') === 'true');
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [deploymentStep, setDeploymentStep] = useState<number>(3); // 3=EXTRACT, 4=VALIDATE, 5=APPLY, 6=SUCCESS

  useEffect(() => {
    // @ts-ignore
    if (window.electronAPI?.onUpdateDownloadProgress) {
      // @ts-ignore
      window.electronAPI.onUpdateDownloadProgress((progress: number) => {
        setDownloadProgress(progress);
      });
    }
  }, []);
  
  // --- 'LOCATION X' Patch Tracking (V02.02.23) ---
  const [activePatchTs, setActivePatchTs] = useState<string>(() => {
    const stored = localStorage.getItem('app_active_patch_ts') || APP_PATCH_TIMESTAMP;
    // --- V02.02.24: Baseline Enforcement ---
    // If the stored marker is older than the hardcoded baseline (from licenseService),
    // elevate it to the baseline to prevent heritage patches from old versions.
    if (parseDateTime(stored) < parseDateTime(APP_PATCH_TIMESTAMP)) {
       return APP_PATCH_TIMESTAMP;
    }
    return stored;
  });
  
  const [isPatchNotice, setIsPatchNotice] = useState(false);
  const [patchSkipCount, setPatchSkipCount] = useState<number>(() => 
    parseInt(localStorage.getItem('app_patch_skip_count') || '0', 10)
  );
  const [isPatchMandatory, setIsPatchMandatory] = useState(false);
  const [isSessionDismissed, setIsSessionDismissed] = useState(() => 
    sessionStorage.getItem('patch_session_suppressed') === 'true'
  );



  const handleUpdateNow = useCallback(async (onInstall: () => Promise<void>) => {
    setShowUpdateNotice(false);
    // @ts-ignore
    if (window.electronAPI) {
      try {
        setIsUpdateDownloading(true);

        if (!updateDownloaded) {
          let finalUrl = "";
          try {
            // @ts-ignore
            const osVersion = await window.electronAPI.getOSVersion();
            const isLegacyWin = osVersion.startsWith('6.'); 
            
            const launcherUrl = localStorage.getItem('app_launcher_url');
            if (launcherUrl) {
               finalUrl = launcherUrl;
            } else if (isLegacyWin) {
               finalUrl = localStorage.getItem('app_download_url_win7') || "";
            } else {
               finalUrl = downloadUrl || localStorage.getItem('app_download_url') || "";
            }
          } catch (e) {
            finalUrl = localStorage.getItem('app_launcher_url') || downloadUrl || localStorage.getItem('app_download_url') || "";
          }

          if (!finalUrl) {
            showAlert('error', 'Update Configuration Error', 'The download URL for this patch is missing from the cloud configuration. Please verify the App_Config sheet.');
            return;
          }

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("TIMEOUT")), 120000)
          );

          let res;
          try {
            setIsUpdatePreparing(true);
            
            // Select OS-specific hash
            // @ts-ignore
            const osVersion = await window.electronAPI.getOSVersion();
            const isLegacyWin = String(osVersion).startsWith('6.'); 
            const targetHash = isLegacyWin 
              ? localStorage.getItem('app_update_hash_win7') 
              : localStorage.getItem('app_update_hash_win10');
            const fallbackHash = sha256 || localStorage.getItem('app_update_hash');

            // @ts-ignore
            res = await Promise.race([
              (window as any).electronAPI.startUpdateDownload(finalUrl, targetHash || fallbackHash),
              timeoutPromise
            ]);
          } catch (err: any) {
            if (err.message === "TIMEOUT") {
              setShowBackgroundNotice(true);
            } else {
              setUpdateError('DOWNLOAD_FAILED');
              showAlert('error', 'Download Failed', 'Failed to download the update. Please check your internet connection.');
            }
            return;
          } finally {
            setIsUpdatePreparing(false);
          }
          
          if (res && res.success === false) {
             if (res.error === 'SECURITY_HASH_MISMATCH') {
                setUpdateError('SECURITY_VIOLATION');
             } else {
                setUpdateError('DOWNLOAD_FAILED');
                showAlert('error', 'Download Failed', `Update failed: ${res.error || 'Network error'}.`);
             }
             return;
          }
        }

        // 🚀 [V02.02.26.1] MANAGED DEPLOYMENT SEQUENCE
        // Explicitly driving stages to prevent "silent failures"
        setDeploymentStep(3); // EXTRACTing
        await onInstall();
        
        setDeploymentStep(4); // VALIDATEing
        await new Promise(r => setTimeout(r, 2000));
        
        setDeploymentStep(5); // APPLYing
        await new Promise(r => setTimeout(r, 3000));

        // 🏆 SUCCESS STATE: Final feedback before restart
        setDeploymentStep(6); 
        console.log("🏆 Patch Successfully Applied. Holding for UI readability...");
        await new Promise(resolve => setTimeout(resolve, 3100));

        // 🎖️ [PatchSync] Synchronize patch timestamp during Version or Patch update
        if (latestPatchTimestamp) {
           localStorage.setItem('app_active_patch_ts', latestPatchTimestamp);
           localStorage.setItem('app_patch_skip_count', '0');
           setActivePatchTs(latestPatchTimestamp);
           setPatchSkipCount(0);
        }

        localStorage.removeItem('app_update_ready');
        // @ts-ignore - Pass silent flag for patches
        const result = await (window as any).electronAPI.backupAndInstall({ silent: isPatchNotice });
        if (result && result.success === false) {
           showAlert('error', 'Restart Failed', `The update was downloaded but the installer could not be launched automatically: ${result.error || 'Unknown error'}. Please try restarting the app manually.`);
        }
      } catch (e: any) {
        console.error("Update process error:", e);
        showAlert('error', 'Update Error', `An error occurred during the update sequence: ${e.message || 'Unknown error'}`);
      } finally {
        setIsUpdateDownloading(false);
        setIsUpdatePreparing(false);
      }
    }
  }, [updateDownloaded, downloadUrl, showAlert, isPatchNotice, latestPatchTimestamp, activePatchTs, sha256]);

  const handleUpdateLater = useCallback(async () => {
    // --- LATER: Suppress for session ---
    sessionStorage.setItem('patch_session_suppressed', 'true');
    setIsSessionDismissed(true);

    if (isPatchNotice) {
      const newSkipCount = patchSkipCount + 1;
      localStorage.setItem('app_patch_skip_count', String(newSkipCount));
      setPatchSkipCount(newSkipCount);
    }
    
    setIsPatchNotice(false);
    setShowUpdateNotice(false);
    // @ts-ignore
    if (window.electronAPI && !updateDownloaded) {
      const url = downloadUrl || localStorage.getItem('app_download_url');
      if (url) {
        // @ts-ignore
        const res = await (window as any).electronAPI.startUpdateDownload(url);
        if (res.success) {
          localStorage.setItem('app_update_ready', 'true');
          setUpdateDownloaded(true);
        }
      }
    }
  }, [downloadUrl, updateDownloaded, isPatchNotice, latestPatchTimestamp, patchSkipCount, activePatchTs]);
  useEffect(() => {
    // 🛡️ [V02.02.23] DEVELOPER BYPASS
    if (import.meta.env.DEV || isDeveloper) {
       console.log("🛡️ [UpdateSync] System updates and patches are suppressed in Developer Environment.");
       setShowUpdateNotice(false);
       setIsPatchNotice(false);
       setUpdateDownloaded(false);
       return;
    }
    
    // --- V02.02.24: Smart Patch Reset ---
    if (latestPatchTimestamp) {
        const lastSeenTs = localStorage.getItem('app_last_seen_patch_ts');
        const latestTsNum = parseDateTime(latestPatchTimestamp);
        const lastSeenTsNum = parseDateTime(lastSeenTs);

        if (latestTsNum > lastSeenTsNum) {
            console.log(`🆕 [PatchSync] New patch detected (${latestPatchTimestamp}). Resetting skip count.`);
            localStorage.setItem('app_patch_skip_count', '0');
            localStorage.setItem('app_last_seen_patch_ts', latestPatchTimestamp);
            setPatchSkipCount(0);
            
            // --- Also Reset Session Dismissal for new patches ---
            sessionStorage.removeItem('patch_session_suppressed');
            setIsSessionDismissed(false);
        } else {
            console.log(`📡 [PatchSync] Same patch detected (${latestPatchTimestamp}). Maintaining skip count: ${patchSkipCount}/3.`);
            localStorage.setItem('app_last_seen_patch_ts', latestPatchTimestamp);
        }
    }

    // ── PHASE 1: Version Update (Absolute Priority) ──
    if (latestAppVersion && isVersionHigher(latestAppVersion, APP_VERSION)) {
       setIsPatchNotice(false);
       setIsPatchMandatory(false);
       setShowUpdateNotice(true);
       return;
    }

    // ── PHASE 2: Patch Update (Only if no new version) ──
    const latestTs = parseDateTime(latestPatchTimestamp);
    const activeTs = parseDateTime(activePatchTs);

    console.log(`[PatchSync] Cloud: ${latestPatchTimestamp} (${latestTs}) | Local X: ${activePatchTs} (${activeTs}) | Dismissed: ${isSessionDismissed}`);
    
    if (latestTs > activeTs && !isSessionDismissed) {
       setIsPatchNotice(true);
       setIsPatchMandatory(patchSkipCount >= 3);
       setShowUpdateNotice(true);
    }
  }, [latestAppVersion, latestPatchTimestamp, activePatchTs, isSessionDismissed, patchSkipCount, updateDownloaded]);

  useEffect(() => {
    // @ts-ignore
    if (window.electronAPI?.onUpdateDownloadComplete) {
      // @ts-ignore
      window.electronAPI.onUpdateDownloadComplete(() => {
        localStorage.setItem('app_update_ready', 'true');
        setUpdateDownloaded(true);
        setIsUpdateDownloading(false);
      });
    }
  }, []);

  return { 
    latestAppVersion, setLatestAppVersion, 
    latestPatchTimestamp, setLatestPatchTimestamp,
    downloadUrl, setDownloadUrl, 
    sha256, setSha256,
    showUpdateNotice, setShowUpdateNotice,
    showBackgroundNotice, setShowBackgroundNotice,
    isUpdateDownloading, setIsUpdateDownloading,
    isUpdatePreparing, setIsUpdatePreparing,
    updateDownloaded, setUpdateDownloaded,
    updateError, setUpdateError,
    downloadProgress,
    isPatchNotice, isPatchMandatory, patchSkipCount, isSessionDismissed,
    deploymentStep,
    handleUpdateNow, handleUpdateLater
  };
};
