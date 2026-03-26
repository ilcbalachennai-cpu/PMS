
import { useState, useCallback, useEffect } from 'react';
import { validateLicenseStartup, getStoredLicense, checkNewMessages } from '../services/licenseService';

export const useLicense = () => {
  const [licenseStatus, setLicenseStatus] = useState<{ checked: boolean; valid: boolean; message: string }>({ 
    checked: false, 
    valid: false, 
    message: '' 
  });
  
  const [dataSizeLimit, setDataSizeLimit] = useState<number>(() => {
    const license = getStoredLicense();
    return license?.dataSize || 50;
  });

  const [isTrial, setIsTrial] = useState(false);
  const [showTrialNotice, setShowTrialNotice] = useState(false);

  const verifyLicense = useCallback(async () => {
    const result = await validateLicenseStartup();
    if (!result.valid) {
      setLicenseStatus({ checked: true, valid: false, message: result.message || 'License Verification Failed' });
    } else {
      const license = getStoredLicense();
      if (license) {
          setDataSizeLimit(license.dataSize || 50);
          setIsTrial(!!license.isTrial);
      }
      setLicenseStatus({ checked: true, valid: true, message: '' });
    }
  }, []);

  const checkTrialStatus = useCallback(() => {
     const license = getStoredLicense();
     if (license && license.isTrial) {
        setIsTrial(true);
        // Show notice if expiring soon or every few logical cycles
        const [day, month, year] = license.expiryDate.split('-');
        const expiry = new Date(Number(year), Number(month) - 1, Number(day));
        const diff = expiry.getTime() - new Date().getTime();
        const daysLeft = Math.ceil(diff / (1000 * 3600 * 24));
        
        if (daysLeft <= 7) {
           setShowTrialNotice(true);
        }
     }
  }, []);

  return { 
    licenseStatus, dataSizeLimit, 
    verifyLicense, checkNewMessages, 
    setLicenseStatus, isTrial, 
    showTrialNotice, setShowTrialNotice,
    checkTrialStatus
  };
};
