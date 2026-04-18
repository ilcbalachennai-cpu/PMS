import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Lock, User as UserIcon, AlertCircle, IndianRupee, ShieldCheck, Maximize, Minimize, Power } from 'lucide-react';
import { User as UserType, CompanyProfile } from '../types';
import { MOCK_USERS, BRAND_CONFIG } from '../constants';
import { validateLicenseStartup, trackCloudLogin, APP_VERSION, getAppDeveloper, getStoredLicense, requestResetOTP, updateCloudPassword, requestDeveloperOTP, verifyDeveloperOTP, verifyIdentityEmail, syncIdentityRepair } from '../services/licenseService';
import CustomModal from './Shared/CustomModal';
import { Mail, CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: UserType) => void;
  currentLogo: string;
  setLogo: (url: string) => void;
  companyProfile?: CompanyProfile;
}

const Login: React.FC<LoginProps> = ({ onLogin, currentLogo: _currentLogo, companyProfile }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const [_bridgeReady, setBridgeReady] = useState(!!(window as any).electronAPI);
  const usernameRef = useRef<HTMLInputElement>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState<'IDENTIFY' | 'OTP' | 'SUCCESS'>('IDENTIFY');
  const [resetEmail, setResetEmail] = useState('');
  const [resetUserID, setResetUserID] = useState('');
  const [resetOTP, setResetOTP] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [showDevModal, setShowDevModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [hasAgreedLegal, setHasAgreedLegal] = useState(() => {
    const lastAgreedDate = localStorage.getItem('app_legal_agreed_date');
    const today = new Date().toISOString().split('T')[0];
    return lastAgreedDate === today;
  });
  const [devOTP, setDevOTP] = useState('');
  const [isVerifyingDev, setIsVerifyingDev] = useState(false);
  const [devError, setDevError] = useState('');
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncStep, setSyncStep] = useState<'EMAIL' | 'FORM' | 'SUCCESS'>('EMAIL');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [syncNotice, setSyncNotice] = useState('');
  const [syncEmail, setSyncEmail] = useState('');
  const [syncNewUID, setSyncNewUID] = useState('');
  const [syncNewPass, setSyncNewPass] = useState('');
  const [syncConfirmPass, setSyncConfirmPass] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncedUserName, setSyncedUserName] = useState('');
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreStep, setRestoreStep] = useState<'INPUT' | 'OTP' | 'SUCCESS'>('INPUT');
  const [restoreEmail, setRestoreEmail] = useState('');
  const [restoreMobile, setRestoreMobile] = useState('');
  const [restoreName, setRestoreName] = useState('');
  const [restoreOTP, setRestoreOTP] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [restoreTargetName, setRestoreTargetName] = useState('');
  const otpInputRef = useRef<HTMLInputElement>(null);
  const restoreOtpRef = useRef<HTMLInputElement>(null);

  // Auto-focus OTP input when Developer modal opens
  useEffect(() => {
    if (showDevModal) {
      setTimeout(() => { if (otpInputRef.current) otpInputRef.current.focus(); }, 150);
    }
  }, [showDevModal]);

  // V02.02.21: Auto-focus submit button when OTP is 6 digits
  useEffect(() => {
    if (devOTP.length === 6) {
      const btn = document.getElementById('btn-dev-auth');
      if (btn) btn.focus();
    }
  }, [devOTP]);

  useEffect(() => {
    if (resetOTP.length === 6) {
      const btn = document.getElementById('btn-reset-auth');
      if (btn) btn.focus();
    }
  }, [resetOTP]);

  useEffect(() => {
    if (restoreOTP.length === 6) {
      const btn = document.getElementById('btn-restore-auth');
      if (btn) btn.focus();
    }
  }, [restoreOTP]);

  // Check for auto-logout timeout
  useEffect(() => {
    if (sessionStorage.getItem('logout_reason') === 'timeout') {
      setShowTimeoutMessage(true);
      sessionStorage.removeItem('logout_reason');
    }
    
    // Check if legal alert should be shown
    if (companyProfile?.loginAlertEnabled && companyProfile.loginAlertMessage && !hasAgreedLegal) {
      // Small timeout to ensure app state is settled
      const timer = setTimeout(() => setShowLegalModal(true), 500);
      return () => clearTimeout(timer);
    }
  }, [companyProfile?.loginAlertEnabled, companyProfile?.loginAlertMessage, hasAgreedLegal]);

  // Monitor bridge status
  useEffect(() => {
    if ((window as any).electronAPI) {
      setBridgeReady(true);
      return;
    }
    const timer = setInterval(() => {
      if ((window as any).electronAPI) {
        setBridgeReady(true);
        clearInterval(timer);
      }
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Handle Full Screen Logic
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  // Auto-focus on mount
  useEffect(() => {
    // --- EMERGENCY AUTO-LOCKOUT PROTECTION ---
    const checkAdminLockout = () => {
      const savedUsersRaw = localStorage.getItem('app_users');
      let hasLocalAdmin = false;
      if (savedUsersRaw) {
        try {
          const savedUsers: UserType[] = JSON.parse(savedUsersRaw);
          hasLocalAdmin = savedUsers.some(u => u.role === 'Administrator');
        } catch (e) { }
      }

      const isSetupComplete = localStorage.getItem('app_setup_complete') === 'true';

      // If we think setup is done but have no admin, something is wrong
      if (isSetupComplete && !hasLocalAdmin) {
        console.warn("🚫 LOCKOUT DETECTED: Setup marked complete but no local Admin found. Attempting Cloud Recovery...");
        // Skip reload, let them try cloud sync or register
      }
    };

    const checkMigrationRequirement = () => {
      const savedUsersRaw = localStorage.getItem('app_users');
      if (savedUsersRaw) {
        try {
          const savedUsers: UserType[] = JSON.parse(savedUsersRaw);
          const admin = savedUsers.find(u => u.role === 'Administrator');
          if (admin) {
            const id = String(admin.username).toUpperCase();
            const idRegex = /^[A-Z0-9]{5,12}$/;
            // Auto-trigger if ID is generic 'ADMIN' or doesn't meet 5-12 char criteria
            if (id === 'ADMIN' || !idRegex.test(id)) {
              console.log("🚩 Mandatory Security Migration Triggered: Legacy ID detected.");
              setSyncStep('EMAIL');
              setShowSyncModal(true);
            }
          }
        } catch (e) { }
      }
    };

    checkAdminLockout();
    checkMigrationRequirement();

    const timer = setTimeout(() => {
      if (usernameRef.current) {
        usernameRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      // Get registered users from localStorage
      const savedUsersRaw = localStorage.getItem('app_users');
      let allUsers = [...MOCK_USERS];

      // 1. Add cloud-synced Developer account if it exists
      const cloudDev = getAppDeveloper();
      if (cloudDev) {
        allUsers.push(cloudDev);
      } else if (!import.meta.env.PROD) {
        // Fallback for local dev if sync hasn't happened yet
        allUsers.push({
          username: 'VRANGA',
          password: 'password', // Default local fallback
          role: 'Developer',
          name: 'VRANGA (Developer)',
          email: 'developer@bharatpay.com'
        } as any);
      }

      if (savedUsersRaw) {
        try {
          const savedUsers: UserType[] = JSON.parse(savedUsersRaw);
          // Combine, allowing saved users to override mock users with same username (like 'admin')
          allUsers = [
            ...savedUsers,
            ...allUsers.filter(au => !savedUsers.some(su => su.username === au.username))
          ];
        } catch (e) {
          console.error("Failed to parse app_users", e);
        }
      }

      const cleanUsername = username.trim().toUpperCase();
      const cleanPassword = password.trim();

      // --- V02.02.11: DEVELOPER SECURE BYPASS (OTP FIRST/MANDATORY) ---
      // This ensures that 'VRANGA' always triggers a cloud credential check + OTP
      const isDev = cleanUsername.toLowerCase() === 'vranga';
      if (isDev) {
        console.log("🛠️ Developer high-priority bypass initiated:", cleanUsername);
        try {
          // Step 1: Request OTP (GAS will verify cleanPassword vs Master_Config sheet)
          const res = await requestDeveloperOTP(cleanUsername, cleanPassword);
          if (res.success) {
            setShowDevModal(true);
            setIsLoading(false);
            return;
          } else {
            // If credential check fails or GAS error, show error
            setError(res.message);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.error("Dev Auth Initiation failed:", e);
          setError("Developer Auth Service Unavailable.");
          setIsLoading(false);
          return;
        }
      }

      // --- V02.02.07: IDENTITY-AWARE LOOKUP (Standard Users) ---
      const license = getStoredLicense();
      const user = allUsers.find((u) => {
        const uNameStr = String(u.username).trim();
        const inputUNameStr = cleanUsername;

        // Match 1: Direct username match (STRICT CASE)
        const isDirectMatch = uNameStr === inputUNameStr;

        // Match 2: Registered Identity Alias (For Admin) - STRICT CASE
        const isIdentityAlias = (u.role === 'Administrator' &&
          license && license.userID &&
          String(license.userID).trim() === inputUNameStr);

        return (isDirectMatch || isIdentityAlias) && String(u.password).trim() === cleanPassword;
      });

      if (user) {
        console.log("✅ Login successful for:", cleanUsername);
        setFailedAttempts(0); // Reset on success

        // --- V01.0.11: CLOUD LOGIN TRACKING ---
        try {
          const machineId = localStorage.getItem('app_machine_id');
          const license = getStoredLicense();
          if (machineId && license?.registeredTo && user.role !== 'Developer') {
            trackCloudLogin(license.registeredTo, machineId);
          }
        } catch (e) {
          console.warn("Could not fire cloud tracking:", e);
        }

        onLogin(user);
      } else {
        // --- EMERGENCY REDIRECT IF NO ADMINS ---
        const hasAdmin = allUsers.some(u => u.role === 'Administrator');
        if (!hasAdmin && !import.meta.env.PROD) {
          console.warn("🚫 NO ADMINISTRATOR FOUND: System requires local admin character. Resetting...");
          localStorage.removeItem('app_setup_complete');
          window.location.reload();
          return;
        }

        // --- CLOUD FALLBACK ---
        console.log("⚠️ Local login failed. Attempting cloud sync fallback...");
        const syncResult = await validateLicenseStartup(true, cleanUsername);

        // 1. ADVANCED DEVELOPER BYPASS (Check this FIRST before license validity)
        let freshDev = getAppDeveloper();
        if (freshDev) {
          console.log("🛠️ Cloud Developer synced:", freshDev.username);
          if (String(freshDev.username).trim() === cleanUsername &&
            String(freshDev.password).trim() === cleanPassword) {
            console.log("✅ Login successful via Cloud Sync (Developer Bypass) for:", cleanUsername);
            setFailedAttempts(0);
            onLogin(freshDev);
            return;
          }
        }

        // --- V02.02.16: IDENTITY RESTORATION TRIGGER ---
        if (syncResult.status === 'PENDING_RESTORE') {
          console.log("🛠️ Identity Restoration Required for:", syncResult.data?.userName);
          setRestoreTargetName(syncResult.data?.userName || 'User');
          setRestoreStep('INPUT');
          setShowRestoreModal(true);
          setIsLoading(false);
          return;
        }

        if (syncResult.valid) {
          setFailedAttempts(0);
          // Re-read users after sync
          const updatedUsersRaw = localStorage.getItem('app_users');
          if (updatedUsersRaw) {
            const updatedUsers: UserType[] = JSON.parse(updatedUsersRaw);

            // CRITICAL: Update the parent allUsers reference
            allUsers = [
              ...updatedUsers,
              ...(freshDev ? [freshDev] : []),
              ...allUsers.filter(au => !updatedUsers.some(su => su.username === au.username) && au.username !== freshDev?.username)
            ];

            const syncedUser = updatedUsers.find(
              (u) =>
                String(u.username).trim().toLowerCase() === cleanUsername.toLowerCase() &&
                String(u.password).trim() === cleanPassword
            );

            if (syncedUser) {
              console.log("✅ Login successful via Cloud Sync for:", cleanUsername);

              // --- V01.0.11: CLOUD LOGIN TRACKING ---
              try {
                const machineId = localStorage.getItem('app_machine_id');
                const license = getStoredLicense();
                if (machineId && license?.registeredTo && syncedUser.role !== 'Developer') {
                  trackCloudLogin(license.registeredTo, machineId);
                }
              } catch (e) {
                console.warn("Could not fire cloud tracking on fallback:", e);
              }

              onLogin(syncedUser);
              return;
            }
          }
        }

        // Final failure message
        const license = getStoredLicense();
        const primaryUID = license?.userID || "";
        const cleanUID = username.trim().toUpperCase();

        // Ground Truth: If we have a verified identity that matches (case-insensitive for sync repair)
        const isPerfectMatch = (primaryUID.toUpperCase() === cleanUID.toUpperCase() && primaryUID !== "");

        const isLegacy = (cleanUID.length > 0 && cleanUID.length < 5 || cleanUID === 'ADMIN');
        const isCaseMismatch = !isPerfectMatch && allUsers.some(u => String(u.username).trim().toLowerCase() === cleanUID.toLowerCase());
        const isLicenseMismatch = !isPerfectMatch && license?.userID && String(license.userID).trim().toLowerCase() === cleanUID.toLowerCase();

        // ONLY trigger transition if identity is bad OR if failure limit reached
        const nextFailedCount = failedAttempts + 1;
        setFailedAttempts(nextFailedCount);

        if (isLegacy || isCaseMismatch || isLicenseMismatch || (!isPerfectMatch && nextFailedCount >= 3)) {
          setError(`Identity Transition Required (Attempt ${nextFailedCount}/3)`);
          setSyncNotice('Dear user kindly reset your USER ID (one time) with new ID as per the criteria set under User ID for a seamless access in future');
          setSyncStep('EMAIL');
          setShowSyncModal(true);
          setSyncNewUID(username);
          setSyncError('');
          setSyncEmail('');
        } else {
          setSyncNotice('');
          const userExists = allUsers.some(u => u.username.toLowerCase() === cleanUID.toLowerCase());
          if (userExists) {
            setError(`Invalid password. Credentials do not match. (Attempt ${nextFailedCount}/3)`);
          } else {
            setError(`${syncResult.message || "Invalid credentials."} (Attempt ${nextFailedCount}/3)`);
          }
        }
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Critical login failure:", err);
      setError('An unexpected error occurred during login. Please try again.');
      setIsLoading(false);
    }
  };

  const autofill = (u: string) => {
    let finalUsername = u;

    // --- V02.02.07: SMART IDENTITY MAPPING ---
    // If the shortcut is trying to fill 'admin', check if we have a 
    // real registered Identity from the license to use instead.
    if (u.toLowerCase() === 'admin') {
      const license = getStoredLicense();
      if (license && license.userID && license.userID.toUpperCase() !== 'TRIAL' && license.userID.toUpperCase() !== 'RESCUE') {
        finalUsername = license.userID;
      }
    }

    setUsername(finalUsername);
    setPassword('');
    // Auto-focus password field after filling username
    const passInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    if (passInput) passInput.focus();
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setIsResetting(true);
    try {
      const res = await requestResetOTP(resetEmail, resetUserID);
      if (res.success) {
        setResetStep('OTP');
      } else {
        setResetError(res.message);
      }
    } catch (err: any) {
      setResetError(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (newPass.length < 9) {
      setResetError('New password must be at least 9 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setResetError('Passwords do not match.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await updateCloudPassword(resetEmail, newPass, resetOTP);
      if (res.success) {
        setResetStep('SUCCESS');
        // Force a sync to repair local database with new cloud password
        await validateLicenseStartup(true, resetUserID);
      } else {
        setResetError(res.message);
      }
    } catch (err: any) {
      setResetError(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleDevVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevError('');
    setIsVerifyingDev(true);
    try {
      const res = await verifyDeveloperOTP(username, devOTP);
      if (res.success && res.data) {
        setShowDevModal(false);
        onLogin(res.data);
      } else {
        setDevError(res.message);
      }
    } catch (err: any) {
      setDevError(err.message);
    } finally {
      setIsVerifyingDev(false);
    }
  };

  const handleAcceptLegal = () => {
    const today = new Date().toISOString().split('T')[0];
    setHasAgreedLegal(true);
    setShowLegalModal(false);
    localStorage.setItem('app_legal_agreed_date', today);
  };

  const handleVerifySyncEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncError('');
    setIsSyncing(true);
    try {
      const res = await verifyIdentityEmail(syncEmail);
      if (res.success) {
        setSyncedUserName(res.userName || 'Verified User');
        setSyncStep('FORM');
      } else {
        setSyncError(res.message);
      }
    } catch (err: any) {
      setSyncError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExecuteSyncRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncError('');
    
    // Strict Format Validation
    const idRegex = /^[A-Z0-9]{5,12}$/;
    if (!idRegex.test(syncNewUID)) {
      setSyncError('User ID must be 5-12 alphanumeric characters (UC).');
      return;
    }
    if (syncNewPass.length < 9) {
      setSyncError('Password must be at least 9 characters.');
      return;
    }
    if (syncNewPass !== syncConfirmPass) {
      setSyncError('Passwords do not match.');
      return;
    }

    setIsSyncing(true);
    try {
      const res = await syncIdentityRepair(syncEmail, syncNewUID, syncNewPass);
      if (res.success) {
        setSyncStep('SUCCESS');
        // The service already calls validateLicenseStartup(true)
      } else {
        setSyncError(res.message);
      }
    } catch (err: any) {
      setSyncError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRequestRestoreOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestoreError('');
    setIsRestoring(true);
    try {
      const targetUID = username.trim().toUpperCase();
      const res = await requestRestoreOTP(targetUID, restoreEmail, restoreMobile);
      if (res.success) {
        setRestoreStep('OTP');
        setTimeout(() => { if (restoreOtpRef.current) restoreOtpRef.current.focus(); }, 150);
      } else {
        setRestoreError(res.message);
      }
    } catch (err: any) {
      setRestoreError(err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleVerifyAndFinalizeRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestoreError('');
    setIsRestoring(true);
    try {
      const targetUID = username.trim().toUpperCase();
      const res = await verifyRestoreOTP(targetUID, restoreEmail, restoreOTP);
      if (res.success) {
        // Trigger a fresh sync to rebuild local profile from restored cloud data
        await validateLicenseStartup(true, targetUID);
        setSyncedUserName(res.data?.userName || 'User');
        setRestoreStep('SUCCESS');
      } else {
        setRestoreError(res.message);
      }
    } catch (err: any) {
      setRestoreError(err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDisagreeLegal = () => {
    const api = (window as any).electronAPI;
    if (api) {
      try {
        if (api.closeApp) api.closeApp();
        else if (api.invoke) api.invoke('close-app');
      } catch (err) {
        console.error("LEGAL: Close failed", err);
      }
    } else {
      window.close();
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#020617] flex items-center justify-center p-4 relative">
      {/* Full Screen Toggle Button */}
      <button
        onClick={toggleFullScreen}
        className="absolute top-4 right-4 z-50 p-2.5 bg-slate-800/50 hover:bg-slate-700 text-white rounded-full border border-slate-700 backdrop-blur-sm transition-all shadow-lg hover:scale-105"
        title={isFullScreen ? "Exit Full Screen" : "Enter Full Screen"}
      >
        {isFullScreen ? <Minimize size={20} /> : <Maximize size={20} />}
      </button>

      {/* Quit Application Button - Top Right per User Request */}
      <button
        onClick={async () => {
          const api = (window as any).electronAPI;
          if (api) {
            try {
              if (api.closeApp) api.closeApp();
              else if (api.invoke) api.invoke('close-app');
            } catch (err) {
              console.error("LOGIN: Close failed", err);
            }
          } else {
            window.close();
            setTimeout(() => window.location.reload(), 100);
          }
        }}
        className="absolute top-4 right-16 z-50 p-2.5 bg-red-950/20 hover:bg-red-900/40 text-red-400 rounded-full border border-red-500/30 backdrop-blur-sm transition-all shadow-lg hover:scale-105 flex items-center gap-2 px-4 group"
        title="Quit Application"
      >
        <Power size={18} className="group-hover:rotate-12 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Quit Application</span>
      </button>

      {/* Background Decor - Fixed Position to avoid layout shift */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[100px]"></div>
      </div>

      {/* Login Card - High Z-Index */}
      <div className="w-full max-w-4xl relative z-10 bg-[#1e293b] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">

        {/* Left: Branding & Info */}
        <div className="md:w-1/2 bg-[#0f172a] p-10 md:p-16 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-800 text-center relative overflow-hidden group">
          {/* Subtle Glow Background for Logo */}
          <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

          <div className="relative z-10 flex flex-col items-center gap-2">
            {/* Logo Section */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-tr from-blue-600 to-emerald-600 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
              <div className="relative flex items-center justify-center w-40 h-40 rounded-full bg-transparent shadow-2xl overflow-hidden border-4 border-white transform group-hover:scale-105 transition-transform duration-500">
                <img
                  src={BRAND_CONFIG.logoUrl}
                  alt={BRAND_CONFIG.companyName}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* App Title Section */}
            <div className="space-y-1">
              <div className="flex flex-col items-center gap-1">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-900/30 border border-blue-500/30 rounded-full mb-1">
                  <IndianRupee size={14} className="text-[#FF9933]" />
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">Enterprise Payroll Solutions</span>
                </div>
                <h1 className="text-5xl font-black flex items-center justify-center gap-0 drop-shadow-2xl">
                  <span className="text-[#FF9933]">Bharat</span>
                  <span className="text-white">Pay</span>
                  <span className="text-[#34d399] tracking-tighter">{BRAND_CONFIG.appNameSuffix}</span>
                </h1>
              </div>
              <div className="h-1 w-24 bg-gradient-to-r from-transparent via-blue-500 to-transparent mx-auto rounded-full opacity-50"></div>
            </div>

              {/* Branding Footer */}
              <div className="pt-0 flex flex-col items-center gap-2">
                <span className="text-[9px] text-slate-600 font-bold tracking-widest uppercase mb-0">Architected & Engineered by</span>
                <div className="px-6 py-2 bg-slate-900/40 border border-slate-800 rounded-2xl">
                  <span className="text-xs font-black text-[#FF9933] tracking-wider uppercase">{BRAND_CONFIG.companyName}</span>
                </div>
                <p className="text-slate-500 text-[8px] font-bold uppercase tracking-[0.2em] mt-0">{BRAND_CONFIG.tagline}</p>
  
                {/* Version Pill */}
                <div className="mt-4 px-4 py-1 bg-slate-800/80 border border-slate-700/50 rounded-full shadow-lg">
                  <span className="text-[9px] font-black tracking-widest text-[#FFD700] uppercase">Version {APP_VERSION}</span>
                </div>
              </div>
          </div>
        </div>

        {/* Right: Login Form */}
        <div className="md:w-1/2 p-10 md:p-16 bg-[#1e293b] flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
          <div className="relative z-10">
            <div className="mb-10">
              <h2 className="text-3xl font-black text-white tracking-tight">Welcome Back</h2>
              <p className="text-slate-400 text-sm mt-2 font-medium">Please sign in to your secure portal.</p>
            </div>

            {showTimeoutMessage && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 mb-6">
                <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-red-200">
                  BPP_APP was inactive over 10 minutes, relogin to continue with App access
                </p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-red-400 shrink-0" size={20} />
                    <p className="text-xs text-red-200">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Username</label>
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                  <input
                    ref={usernameRef}
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toUpperCase())}
                    title="Username"
                    aria-label="Username"
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-500 text-sm uppercase"
                    placeholder="ENTER USERNAME"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    title="Password"
                    aria-label="Password"
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-500 text-sm"
                    placeholder="••••••••"
                  />
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex justify-end pr-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowResetModal(true);
                        setResetStep('IDENTIFY');
                      }}
                      className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-3 group disabled:opacity-70 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="uppercase tracking-[0.2em] text-sm">Sign In to Dashboard</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <div className="pt-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3 text-center">Quick Access Roles</p>
                <div className={`grid grid-cols-3 gap-2 max-w-sm mx-auto`}>
                  {(() => {
                    const savedUsersRaw = localStorage.getItem('app_users');
                    let localUsers: UserType[] = [];

                    if (savedUsersRaw) {
                      try {
                        localUsers = JSON.parse(savedUsersRaw);
                      } catch (e) { }
                    }

                    const admin = localUsers.find(u => u.role === 'Administrator');
                    const payrollUser = localUsers.find(u => u.role === 'User');

                    const buttons = [
                      // Admin Slot
                      <button
                        key="admin"
                        onClick={() => {
                          if (admin) {
                            const license = getStoredLicense();
                            const bestID = (license && license.userID &&
                              license.userID.toUpperCase() !== 'TRIAL' &&
                              license.userID.toUpperCase() !== 'RESCUE')
                              ? license.userID
                              : admin.username;
                            autofill(bestID);
                          }
                        }}
                        disabled={!admin}
                        type="button"
                        title={admin ? `Login as ${admin.name}` : 'Admin user not active'}
                        aria-label={admin ? `Login as ${admin.name}` : 'Admin user not active'}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all group ${admin
                          ? 'bg-blue-900/10 hover:bg-blue-900/20 border border-blue-900/30'
                          : 'bg-slate-900/10 border border-slate-800/30 opacity-50 cursor-not-allowed'
                          }`}
                      >
                        <ShieldCheck className={`${admin ? 'text-blue-500' : 'text-slate-500'} mb-1 group-hover:scale-110 transition-transform`} size={16} />
                        <span className={`text-[10px] font-bold ${admin ? 'text-blue-500' : 'text-slate-500'} truncate w-full px-1`}>
                          {admin ? admin.name : 'ADMIN INACTIVE'}
                        </span>
                      </button>,
                      // User Slot (Payroll Executive)
                      <button
                        key="user"
                        onClick={() => payrollUser && autofill(payrollUser.username)}
                        disabled={!payrollUser}
                        type="button"
                        title={payrollUser ? `Login as ${payrollUser.name}` : 'Payroll user not active'}
                        aria-label={payrollUser ? `Login as ${payrollUser.name}` : 'Payroll user not active'}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all group ${payrollUser
                          ? 'bg-emerald-900/10 hover:bg-emerald-900/20 border border-emerald-900/30'
                          : 'bg-slate-900/10 border border-slate-800/30 opacity-50 cursor-not-allowed'
                          }`}
                      >
                        <UserIcon className={`${payrollUser ? 'text-emerald-500' : 'text-slate-500'} mb-1 group-hover:scale-110 transition-transform`} size={16} />
                        <span className={`text-[10px] font-bold ${payrollUser ? 'text-emerald-500' : 'text-slate-500'} truncate w-full px-1`}>
                          {payrollUser ? payrollUser.name : 'PAYROLL INACTIVE'}
                        </span>
                      </button>,
                      // Developer Bypass Slot (Only in Local Dev or Authorized)
                      <button
                        key="dev"
                        onClick={() => autofill('VRANGA')}
                        type="button"
                        className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all group bg-amber-900/10 hover:bg-amber-900/20 border border-amber-900/30 ${!import.meta.env.DEV ? 'hidden' : ''}`}
                        title="Developer Quick Access"
                      >
                        <Lock className="text-amber-500 mb-1 group-hover:rotate-12 transition-transform" size={16} />
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-tighter">Developer</span>
                      </button>
                    ];

                    return buttons;
                  })()}
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="absolute bottom-6 text-slate-600 text-xs text-center w-full z-10 pointer-events-none">
          &copy; 2025 {BRAND_CONFIG.companyName}. All rights reserved.
        </div>
      </div>

      {/* Legal Notice Modal Gate */}
      {showLegalModal && companyProfile?.loginAlertMessage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#020617]/95 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-[#1e293b] w-full max-w-2xl rounded-[2.5rem] border border-blue-500/30 shadow-[0_0_50px_rgba(37,99,235,0.2)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-8 flex items-center gap-6 border-b border-white/10">
              <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
                <ShieldAlert className="text-white" size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-white tracking-tight uppercase italic leading-none">Mandatory Legal Notice</h3>
                <p className="text-blue-200 text-[10px] font-bold opacity-80 uppercase tracking-[0.3em]">Identity Verification & Compliance Board</p>
              </div>
            </div>

            {/* Content Section */}
            <div className="p-10 space-y-8 bg-[#1e293b] overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="p-6 px-12 bg-blue-500/5 border-l-4 border-blue-500 rounded-r-2xl">
                <p className="text-[14px] leading-relaxed text-slate-100 font-medium italic whitespace-pre-wrap text-center">
                  {companyProfile.loginAlertMessage}
                </p>
              </div>

              <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-700/50 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></div>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    By clicking <span className="text-emerald-400 font-black">"I HAVE READ & ACCEPT"</span>, you acknowledge that you are authorized to access this system and agree to comply with all corporate and statutory regulations.
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    Selection of <span className="text-rose-400 font-black underline">"I DISAGREE"</span> will immediately terminate this application session.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Action Bar */}
            <div className="p-8 bg-[#0f172a] border-t border-slate-800 flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleDisagreeLegal}
                className="flex-1 py-4 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 font-black rounded-2xl transition-all uppercase tracking-widest text-xs border border-slate-700 hover:border-rose-500/30 group"
              >
                I Disagree
              </button>
              <button
                onClick={handleAcceptLegal}
                className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-900/40 uppercase tracking-widest text-xs group flex items-center justify-center gap-3 active:scale-95"
              >
                I Have Read & Accept
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      <CustomModal
        isOpen={showResetModal}
        onClose={() => !isResetting && setShowResetModal(false)}
        type={resetStep === 'SUCCESS' ? 'success' : 'info'}
        title="Security Gateway"
        message={
          <div className="py-2">
            {resetStep === 'IDENTIFY' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center text-center space-y-3 mb-4">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                    <Mail className="text-blue-400" size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Recover Identity</h3>
                    <p className="text-xs text-slate-400 mt-1">Enter your registered ID and Email to receive a 6-digit OTP.</p>
                  </div>
                </div>

                {resetError && (
                  <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                    <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-red-200 uppercase leading-relaxed">{resetError}</p>
                  </div>
                )}

                <form onSubmit={handleRequestOTP} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Registered User ID</label>
                    <input
                      type="text"
                      required
                      value={resetUserID}
                      onChange={(e) => setResetUserID(e.target.value.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                      placeholder="e.g. BALA01"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Registered Email</label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="mail@example.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isResetting}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                  >
                    {isResetting ? <Loader2 className="animate-spin" size={18} /> : "Request OTP Code"}
                  </button>
                </form>
              </div>
            )}

            {resetStep === 'OTP' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center text-center space-y-3 mb-4">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                    <ShieldCheck className="text-emerald-400" size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-emerald-400 uppercase tracking-tight">Verify & Reset</h3>
                    <p className="text-xs text-slate-400 mt-1">Check your email for the 6-digit verification code.</p>
                  </div>
                </div>

                {resetError && (
                  <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                    <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-red-200 uppercase leading-relaxed">{resetError}</p>
                  </div>
                )}

                <form onSubmit={handleVerifyAndReset} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 text-center block">6-Digit OTP</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={resetOTP}
                      onChange={(e) => setResetOTP(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 px-4 text-white text-2xl font-black text-center tracking-[1em] outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                      placeholder="000000"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">New Password</label>
                      <input
                        type="password"
                        required
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Confirm</label>
                      <input
                        type="password"
                        required
                        value={confirmPass}
                        onChange={(e) => setConfirmPass(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <button
                    id="btn-reset-auth"
                    type="submit"
                    disabled={isResetting}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                  >
                    {isResetting ? <Loader2 className="animate-spin" size={18} /> : "Finalise Reset"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetStep('IDENTIFY')}
                    className="w-full text-[10px] font-black text-slate-500 hover:text-slate-400 uppercase tracking-widest py-2"
                  >
                    Change Email / ID
                  </button>
                </form>
              </div>
            )}

            {resetStep === 'SUCCESS' && (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center scale-110">
                  <CheckCircle2 className="text-emerald-400" size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Password Reset Successful</h3>
                  <p className="text-xs text-slate-400 max-w-[200px] mx-auto">Your identity has been repaired. You can now login with your new password.</p>
                </div>
                <button
                  onClick={() => {
                    setShowResetModal(false);
                    setPassword('');
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest text-xs"
                >
                  Close & Login
                </button>
              </div>
            )}
          </div>
        }
      />

      {/* Developer Secure OTP Modal */}
      <CustomModal
        isOpen={showDevModal}
        onClose={() => !isVerifyingDev && setShowDevModal(false)}
        type="info"
        title="Developer Portal"
        message={
          <div className="py-2 space-y-6">
            <div className="flex flex-col items-center justify-center text-center space-y-3 mb-4">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
                <ShieldCheck className="text-amber-400" size={32} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Developer Auth</h3>
                <p className="text-xs text-slate-400 mt-1">Pass Code sent to developer Mail ID</p>
              </div>
            </div>

            {devError && (
              <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-red-200 uppercase leading-relaxed">{devError}</p>
              </div>
            )}

            <form onSubmit={handleDevVerify} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 text-center block">6-Digit Bypass Code</label>
                <input
                  ref={otpInputRef}
                  type="text"
                  required
                  maxLength={6}
                  value={devOTP}
                  onChange={(e) => setDevOTP(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 px-4 text-white text-2xl font-black text-center tracking-[1em] outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono"
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
                <p className="text-[10px] font-black text-amber-500 text-center tracking-widest uppercase mt-2 flex items-center justify-center gap-1">
                  <span>⏱</span> OTP is valid only for 2 minutes
                </p>
              </div>

              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">Safety Protocol Active</p>
                <p className="text-[9px] text-slate-500 text-center uppercase leading-relaxed font-black">Success grants full app access without affecting any cloud license rows or tracking.</p>
              </div>

              <button
                id="btn-dev-auth"
                type="submit"
                disabled={isVerifyingDev}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
              >
                {isVerifyingDev ? <Loader2 className="animate-spin" size={18} /> : "Authorize Developer Session"}
              </button>
            </form>
          </div>
        }
      />

      {/* NEW: Universal Identity Repair & Sync Portal */}
      <CustomModal
        isOpen={showSyncModal}
        onClose={() => !isSyncing && setShowSyncModal(false)}
        type={syncStep === 'SUCCESS' ? 'success' : 'info'}
        title="Identity Sync Portal"
        message={
          <div className="py-2">
            {syncNotice && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 mb-6 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
                    <ShieldCheck className="text-emerald-400" size={20} />
                  </div>
                  <p className="text-[11px] font-bold text-emerald-100 leading-relaxed uppercase tracking-wider italic">
                    {syncNotice}
                  </p>
                </div>
              </div>
            )}
            {syncStep === 'EMAIL' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center text-center space-y-3 mb-4">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                    <Mail className="text-emerald-400" size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Sync & Repair Account</h3>
                    <p className="text-xs text-slate-400 mt-1 pb-1">Enter your registered Email to verify your identity in the cloud database.</p>
                  </div>
                </div>

                {syncError && (
                  <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                    <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-red-200 uppercase leading-relaxed">{syncError}</p>
                  </div>
                )}

                <form onSubmit={handleVerifySyncEmail} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Registered Corporate Email</label>
                    <input
                      type="email"
                      required
                      value={syncEmail}
                      onChange={(e) => setSyncEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      placeholder="mail@example.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSyncing || !syncEmail}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                  >
                    {isSyncing ? <Loader2 className="animate-spin" size={18} /> : "Verify Identity"}
                  </button>
                </form>
              </div>
            )}

            {syncStep === 'FORM' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center text-center space-y-3 mb-4">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="text-emerald-400" size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Identity Verified</h3>
                    <p className="text-xs text-slate-400 mt-1">Hello <span className="text-emerald-400 font-bold">{syncedUserName}</span>, please set your new hardened credentials below.</p>
                  </div>
                </div>

                {syncError && (
                  <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                    <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-red-200 uppercase leading-relaxed">{syncError}</p>
                  </div>
                )}

                <form onSubmit={handleExecuteSyncRepair} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">New User ID (5-12 Alphanumeric)</label>
                    <input
                      type="text"
                      required
                      value={syncNewUID}
                      onChange={(e) => setSyncNewUID(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                      placeholder="e.g. SBOBBY12"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">New Password</label>
                      <input
                        type="password"
                        required
                        value={syncNewPass}
                        onChange={(e) => setSyncNewPass(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Confirm</label>
                      <input
                        type="password"
                        required
                        value={syncConfirmPass}
                        onChange={(e) => setSyncConfirmPass(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSyncing}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                  >
                    {isSyncing ? <Loader2 className="animate-spin" size={18} /> : "Finalise & Sync Identity"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSyncStep('EMAIL')}
                    className="w-full text-[10px] font-black text-slate-500 hover:text-slate-400 uppercase tracking-widest py-2"
                  >
                    Back to Identification
                  </button>
                </form>
              </div>
            )}

            {syncStep === 'SUCCESS' && (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center scale-110 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                  <ShieldCheck className="text-emerald-400" size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Identity Fully Synced</h3>
                  <p className="text-xs text-slate-400 max-w-[220px] mx-auto leading-relaxed">Your account has been migrated to the new security standard and synchronized with the Google Sheet.</p>
                </div>
                <button
                  onClick={() => {
                    setShowSyncModal(false);
                    setUsername(syncNewUID);
                    setPassword('');
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest text-xs border border-slate-700"
                >
                  Return to Login
                </button>
              </div>
            )}
          </div>
        }
      />

      {/* NEW: Identity Restoration Backdrop (Hardware Locked) */}
      <CustomModal
        isOpen={showRestoreModal}
        onClose={() => !isRestoring && setShowRestoreModal(false)}
        type={restoreStep === 'SUCCESS' ? 'success' : 'info'}
        title="Identity Restoration"
        message={
          <div className="py-2">
            {restoreStep === 'INPUT' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center text-center space-y-3 mb-4">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                    <ShieldCheck className="text-blue-400" size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Access Locked</h3>
                    <p className="text-xs text-slate-400 mt-1">Hello <span className="text-blue-400 font-bold">{restoreTargetName}</span>, recognized hardware detected but local data is missing.</p>
                  </div>
                </div>

                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-2">
                  <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest text-center italic">Stage 2: Knowledge Proof Required</p>
                  <p className="text-[9px] text-slate-500 text-center uppercase leading-relaxed font-black">Provide your registered credentials to verify ownership of this hardware identity.</p>
                </div>

                {restoreError && (
                  <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                    <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-red-200 uppercase leading-relaxed">{restoreError}</p>
                  </div>
                )}

                <form onSubmit={handleRequestRestoreOTP} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Registered Name</label>
                      <input
                        type="text"
                        required
                        value={restoreName}
                        onChange={(e) => setRestoreName(e.target.value.toUpperCase())}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all uppercase"
                        placeholder="E.G. JEY PRANAV"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Registered Email</label>
                      <input
                        type="email"
                        required
                        value={restoreEmail}
                        onChange={(e) => setRestoreEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="e.g. jeypranav@email.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Registered Mobile (Last 10 Digits)</label>
                      <input
                        type="text"
                        required
                        value={restoreMobile}
                        onChange={(e) => setRestoreMobile(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                        placeholder="8838XXXXXX"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isRestoring || !restoreEmail || !restoreMobile}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                  >
                    {isRestoring ? <Loader2 className="animate-spin" size={18} /> : "Request Restoration OTP"}
                  </button>
                </form>
              </div>
            )}

            {restoreStep === 'OTP' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center text-center space-y-3 mb-4">
                  <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
                    <Mail className="text-amber-400" size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Stage 3: OTP Verification</h3>
                    <p className="text-xs text-slate-400 mt-1">Verification code sent to <span className="text-amber-400 font-bold">{restoreEmail}</span></p>
                  </div>
                </div>

                {restoreError && (
                  <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                    <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-red-200 uppercase leading-relaxed">{restoreError}</p>
                  </div>
                )}

                <form onSubmit={handleVerifyAndFinalizeRestore} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 text-center block">6-Digit Verification Code</label>
                    <input
                      ref={restoreOtpRef}
                      type="text"
                      required
                      maxLength={6}
                      value={restoreOTP}
                      onChange={(e) => setRestoreOTP(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 px-4 text-white text-2xl font-black text-center tracking-[1em] outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono"
                      placeholder="000000"
                    />
                    <p className="text-[10px] font-black text-amber-500 text-center tracking-widest uppercase mt-2 flex items-center justify-center gap-1">
                      <span>⏱</span> Restoration code valid for 120s
                    </p>
                  </div>

                  <button
                    id="btn-restore-auth"
                    type="submit"
                    disabled={isRestoring || restoreOTP.length < 6}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                  >
                    {isRestoring ? <Loader2 className="animate-spin" size={18} /> : "Finalize Restoration"}
                  </button>
                </form>
              </div>
            )}

            {restoreStep === 'SUCCESS' && (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center scale-110 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  <ShieldCheck className="text-emerald-400" size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Identity Restored</h3>
                  <p className="text-xs text-slate-400 max-w-[220px] mx-auto leading-relaxed">Full profile successfully reconstructed from cloud. Local sync complete.</p>
                </div>
                <button
                  onClick={() => {
                    setShowRestoreModal(false);
                    // Force a direct login attempt now that profile is synced
                    const targetU = username.trim().toUpperCase();
                    handleLogin({ preventDefault: () => {} } as React.FormEvent);
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest text-xs border border-slate-700"
                >
                  Enter Application
                </button>
              </div>
            )}
          </div>
        }
      />
    </div >
  );
};

export default Login;