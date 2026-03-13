
import { useState, useCallback } from 'react';
import { validateLicenseStartup, getStoredLicense, fetchLatestMessages } from '../services/licenseService';

export const useLicense = () => {
  const [licenseStatus, setLicenseStatus] = useState<{ checked: boolean; valid: boolean; message: string }>({ checked: false, valid: false, message: '' });
  const [dataSizeLimit, setDataSizeLimit] = useState<number>(() => {
    const license = getStoredLicense();
    return license?.dataSize || 50;
  });

  const verifyLicense = useCallback(async () => {
    const result = await validateLicenseStartup();
    if (!result.valid) {
      setLicenseStatus({ checked: true, valid: false, message: result.message || 'License Verification Failed' });
    } else {
      const license = getStoredLicense();
      if (license?.dataSize) {
        setDataSizeLimit(license.dataSize);
      }
      setLicenseStatus({ checked: true, valid: true, message: '' });
    }
  }, []);

  const checkNewMessages = useCallback(async () => {
    const updates = await fetchLatestMessages();
    return updates; // Return to be handled by App.tsx or useSync
  }, []);

  return { licenseStatus, dataSizeLimit, verifyLicense, checkNewMessages, setLicenseStatus };
};
