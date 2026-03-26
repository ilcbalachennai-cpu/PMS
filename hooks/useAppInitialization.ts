
import { useState, useCallback, useEffect } from 'react';
import { usePayrollData } from './usePayrollData';
import { useLicense } from './useLicense';
import { useUIState } from './useUIState';
import { usePayrollPeriod } from './usePayrollPeriod';
import { View } from '../types';

export const useAppInitialization = (showAlert: any) => {
  // 1. Core Data State
  const payrollData = usePayrollData(showAlert);
  
  // 2. License State
  const license = useLicense();
  
  // 3. Payroll Period State
  const period = usePayrollPeriod();

  // 4. UI State (Dependent on employees count)
  const ui = useUIState(payrollData.employees.length);

  // 5. App Initialization Logic
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Small Delay for UX Splash Screen
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Verify License
      await license.verifyLicense();
      
      // Check for trial status
      license.checkTrialStatus();

      setIsInitialized(true);
    };
    init();
  }, []);

  return {
    isInitialized,
    isSetupComplete: ui.isSetupComplete,
    setIsSetupComplete: ui.setIsSetupComplete,
    
    // Core Data
    employees: payrollData.employees,
    setEmployees: payrollData.setEmployees,
    companyProfile: payrollData.companyProfile,
    setCompanyProfile: payrollData.setCompanyProfile,
    statutoryConfig: payrollData.config,
    setStatutoryConfig: payrollData.setConfig,
    results: payrollData.payrollHistory,
    setResults: payrollData.setPayrollHistory,
    
    // Period
    payrollPeriod: {
         month: period.globalMonth,
         year: period.globalYear
    },
    setPayrollPeriod: (p: { month: string, year: number }) => {
         period.setGlobalMonth(p.month);
         period.setGlobalYear(p.year);
    },

    // UI State
    activeView: ui.activeView,
    setActiveView: ui.setActiveView,
    settingsTab: ui.settingsTab,
    setSettingsTab: ui.setSettingsTab,
    showRegistrationManual: ui.showRegistrationManual,
    setShowRegistrationManual: ui.setShowRegistrationManual,
    
    // Media
    logoUrl: payrollData.logoUrl,
    setLogoUrl: payrollData.setLogoUrl,
    handleUpdateLogo: (url: string) => payrollData.setLogoUrl(url),
    
    // License
    isTrial: license.isTrial,
    showTrialNotice: license.showTrialNotice,
    setShowTrialNotice: license.setShowTrialNotice,
    licenseStatus: license.licenseStatus,
    setLicenseStatus: license.setLicenseStatus,
    checkTrialStatus: license.checkTrialStatus,
    
    handleRegistrationComplete: () => {
        ui.setIsSetupComplete(true);
        window.location.reload();
    }
  };
};
