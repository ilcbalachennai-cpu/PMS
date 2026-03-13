
import { useState, useEffect, useCallback } from 'react';
import { APP_VERSION } from '../services/licenseService';

export const useAppUpdate = (showAlert: any) => {
  const [latestAppVersion, setLatestAppVersion] = useState<string | null>(localStorage.getItem('app_latest_version'));
  const [downloadUrl, setDownloadUrl] = useState<string | null>(localStorage.getItem('app_download_url'));
  const [showUpdateNotice, setShowUpdateNotice] = useState(false);
  const [isUpdateDownloading, setIsUpdateDownloading] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(localStorage.getItem('app_update_ready') === 'true');

  const isVersionHigher = (latest: string, current: string): boolean => {
    try {
      const l = latest.split('.').map(Number);
      const c = current.split('.').map(Number);
      for (let i = 0; i < Math.max(l.length, c.length); i++) {
        const v1 = l[i] || 0;
        const v2 = c[i] || 0;
        if (v1 > v2) return true;
        if (v1 < v2) return false;
      }
      return false;
    } catch (e) { return false; }
  };

  const handleUpdateNow = useCallback(async (onInstall: () => Promise<void>) => {
    setShowUpdateNotice(false);
    // @ts-ignore
    if (window.electronAPI) {
      setIsUpdateDownloading(true);

      if (!updateDownloaded) {
        let finalUrl = "";
        try {
          // @ts-ignore
          const osVersion = await window.electronAPI.getOSVersion();
          const isLegacyWin = osVersion.startsWith('6.'); 
          
          if (isLegacyWin) {
             finalUrl = localStorage.getItem('app_download_url_win7') || "";
          } else {
             finalUrl = downloadUrl || localStorage.getItem('app_download_url') || "";
          }
        } catch (e) {
          finalUrl = downloadUrl || localStorage.getItem('app_download_url') || "";
        }

        if (!finalUrl) {
          setIsUpdateDownloading(false);
          return;
        }

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => {
            reject(new Error("TIMEOUT"));
          }, 10000)
        );

        try {
          // @ts-ignore
          await Promise.race([
            (window as any).electronAPI.startUpdateDownload(finalUrl),
            timeoutPromise
          ]);
        } catch (err: any) {
          if (err.message === "TIMEOUT") {
            setIsUpdateDownloading(false);
            showAlert('info', 'Updating in Background', 'The download is taking a few moments. We will continue in the background. You can keep using the application, and we will prompt you once it is ready.');
            return;
          } else {
            setIsUpdateDownloading(false);
            showAlert('error', 'Download Failed', 'Failed to download the update. Please check your internet connection.');
            return;
          }
        }
      }

      // Pre-install persistence
      await onInstall();

      localStorage.removeItem('app_update_ready');
      // @ts-ignore
      await (window as any).electronAPI.backupAndInstall();
    }
  }, [updateDownloaded, downloadUrl, showAlert]);

  const handleUpdateLater = useCallback(async () => {
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
  }, [downloadUrl, updateDownloaded]);

  useEffect(() => {
    if (latestAppVersion && isVersionHigher(latestAppVersion, APP_VERSION)) {
      if (updateDownloaded) {
        // We don't trigger showAlert directly here if we want App.tsx to handle the confirm logic
        // But for modularity, let's just expose the state and let App.tsx decide.
      } else {
        setShowUpdateNotice(true);
      }
    }
  }, [latestAppVersion, updateDownloaded]);

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
    downloadUrl, setDownloadUrl, 
    showUpdateNotice, setShowUpdateNotice,
    isUpdateDownloading, setIsUpdateDownloading,
    updateDownloaded, setUpdateDownloaded,
    handleUpdateNow, handleUpdateLater
  };
};
