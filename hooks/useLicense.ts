import { useState, useCallback } from 'react';
import { 
  validateLicenseStartup, getStoredLicense, fetchLatestMessages,
  getSyncRetryCount, incrementSyncRetryCount, clearSyncRetryCount
} from '../services/licenseService';
import { LicenseData } from '../types';

export const useLicense = () => {
  const [licenseStatus, setLicenseStatus] = useState<{ checked: boolean; valid: boolean; message: string; data?: any; retryCount: number; status?: string; launcherUrl?: string }>({ 
    checked: false, valid: false, message: '', data: null, retryCount: getSyncRetryCount() 
  });
  const [licenseInfo, setLicenseInfo] = useState<LicenseData | null>(getStoredLicense());
  const [dataSizeLimit, setDataSizeLimit] = useState<number>(() => {
    const license = getStoredLicense();
    return license?.dataSize || 50;
  });

  const verifyLicense = useCallback(async (force: boolean = false) => {
    const result = await validateLicenseStartup(force);
    const license = getStoredLicense();
    setLicenseInfo(license);
    
    if (!result.valid) {
      setLicenseStatus({ 
        checked: true, 
        valid: false, 
        message: result.message || 'License Verification Failed', 
        data: result.data,
        retryCount: getSyncRetryCount(),
        status: (result as any).status,
        launcherUrl: (result as any).launcherUrl
      });
    } else {
      clearSyncRetryCount();
      if (license?.dataSize) {
        setDataSizeLimit(license.dataSize);
      }
      setLicenseStatus({ 
        checked: true, 
        valid: true, 
        message: '', 
        data: result.data,
        retryCount: 0
      });
    }
  }, []);

  const checkNewMessages = useCallback(async () => {
    const updates = await fetchLatestMessages();
    return updates; // Return to be handled by App.tsx or useSync
  }, []);

  return { licenseStatus, licenseInfo, dataSizeLimit, verifyLicense, checkNewMessages, setLicenseStatus };
};
