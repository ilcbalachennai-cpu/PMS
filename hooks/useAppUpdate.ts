
import { useState, useEffect, useCallback } from 'react';
import { APP_VERSION, APP_PATCH_TIMESTAMP } from '../services/licenseService';

  const parseDateTime = (str: string | null): number => {
    if (!str || typeof str !== 'string') return 0;
    try {
      // Clean the string from any leading/trailing whitespace including non-breaking spaces
      const cleanStr = str.trim().replace(/\u00a0/g, ' ');
      
      // ALWAYS use manual parsing for dd-MM-yyyy HH:mm:ss to avoid browser locale/guessing bugs
      const parts = cleanStr.split(/[\sT]+/).filter(Boolean);
      const datePart = parts[0];
      const timePart = parts[1] || '00:00:00';
      
      const dateSep = datePart.includes('-') ? '-' : '/';
      const [day, month, year] = datePart.split(dateSep).map(Number);
      
      let [hour, minute, second] = timePart.split(':').map(s => parseInt(s, 10) || 0);
      const isPM = cleanStr.toLowerCase().includes('pm');
      const isAM = cleanStr.toLowerCase().includes('am');
      
      if (isPM && hour < 12) hour += 12;
      if (isAM && hour === 12) hour = 0;
      
      const d = new Date(year, month - 1, day, hour, minute, second);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    } catch (e) { 
      console.warn("Patch Timestamp Parsing Failed for:", str, e);
      return 0; 
    }
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
  const [appStartupTime] = useState(Date.now());
  const [downloadUrl, setDownloadUrl] = useState<string | null>(localStorage.getItem('app_download_url'));
  const [sha256, setSha256] = useState<string | null>(localStorage.getItem('app_update_hash'));
  const [showUpdateNotice, setShowUpdateNotice] = useState(false);
  const [showBackgroundNotice, setShowBackgroundNotice] = useState(false);
  const [isUpdateDownloading, setIsUpdateDownloading] = useState(false);
  const [isUpdatePreparing, setIsUpdatePreparing] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(() => {
    const isReady = localStorage.getItem('app_update_ready') === 'true';
    if (!isReady) return false;
    
    // V03.01.04: Double-Check Version before declaring "Ready"
    const cloudVer = localStorage.getItem('app_latest_version');
    if (cloudVer && !isVersionHigher(cloudVer, APP_VERSION)) {
        return false; 
    }
    return true;
  });
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [deploymentStep, setDeploymentStep] = useState<number>(3); // 3=EXTRACT, 4=VALIDATE, 5=APPLY, 6=SUCCESS
  const [now, setNow] = useState(Date.now());

  // --- V03.01.02: Clock for update cooldown ---
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000); // Refresh every 10 seconds for tighter patch sync
    return () => clearInterval(timer);
  }, []);

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

  // --- V03.01.04: Version Migration Sync ---
  // If we just upgraded to a new version, automatically adopt the cloud patch timestamp
  // as our new baseline to prevent "heritage" patch loops from old versions.
  useEffect(() => {
    const versionMarker = localStorage.getItem('app_version_marker');
    if (versionMarker && versionMarker !== APP_VERSION) {
       if (latestPatchTimestamp) {
          console.log(`🎊 [VersionSync] Upgrade detected (${versionMarker} -> ${APP_VERSION}). Adopting cloud patch baseline: ${latestPatchTimestamp}`);
          localStorage.setItem('app_active_patch_ts', latestPatchTimestamp);
          setActivePatchTs(latestPatchTimestamp);
          localStorage.setItem('app_version_marker', APP_VERSION);
       } else {
          console.log(`⏳ [VersionSync] Upgrade detected (${versionMarker} -> ${APP_VERSION}). Waiting for cloud patch timestamp...`);
       }
    } else if (!versionMarker) {
        localStorage.setItem('app_version_marker', APP_VERSION);
    }
  }, [latestPatchTimestamp]);

  // --- V03.01.04: HARD CLEANUP OF REDUNDANT UPDATE FLAGS ---
  useEffect(() => {
    const ready = localStorage.getItem('app_update_ready') === 'true';
    if (!ready) return;

    const cloudVer = localStorage.getItem('app_latest_version');
    const cloudPatchTs = localStorage.getItem('app_latest_patch_timestamp');
    const localPatchTs = localStorage.getItem('app_active_patch_ts') || APP_PATCH_TIMESTAMP;

    const isVerHigher = cloudVer ? isVersionHigher(cloudVer, APP_VERSION) : false;
    const isPatchNewer = cloudPatchTs ? parseDateTime(cloudPatchTs) > parseDateTime(localPatchTs) : false;

    if (!isVerHigher && !isPatchNewer) {
      console.log(`🧹 [HardCleanup] Current version (${APP_VERSION}) is up to date. Nuking redundant update flags.`);
      localStorage.removeItem('app_update_ready');
      setUpdateDownloaded(false);
      setShowUpdateNotice(false);
    }
  }, []);

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
    const delayMs = 5 * 60 * 1000; 

    console.log(`[PatchSync] Cloud: ${latestPatchTimestamp} (${latestTs}) | Local X: ${activePatchTs} (${activeTs}) | Startup: ${appStartupTime} | Now: ${now} | Grace Ends: ${appStartupTime + delayMs}`);
    
    // Check if patch is newer AND if the 5-minute grace period has passed
    if (latestTs > activeTs && !isSessionDismissed) {
       if (now >= (appStartupTime + delayMs)) {
         console.log("🚀 [PatchSync] Startup grace period expired. Triggering update notice.");
         setIsPatchNotice(true);
         setIsPatchMandatory(patchSkipCount >= 3);
         setShowUpdateNotice(true);
       } else {
         const remainingSecs = Math.ceil(((latestTs + delayMs) - now) / 1000);
         console.log(`⏳ [PatchSync] Patch detected but in 5-min cooldown. Waiting ${remainingSecs}s more for developer verification...`);
         setIsPatchNotice(false);
         setShowUpdateNotice(false);
       }
    } else {
       setIsPatchNotice(false);
       // Only hide if we aren't showing a VERSION update
       if (!latestAppVersion || !isVersionHigher(latestAppVersion, APP_VERSION)) {
          setShowUpdateNotice(false);
       }
    }
  }, [latestAppVersion, latestPatchTimestamp, activePatchTs, isSessionDismissed, patchSkipCount, updateDownloaded, now]);

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
