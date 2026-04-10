import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Lock, User as UserIcon, AlertCircle, IndianRupee, ShieldCheck, Maximize, Minimize, Power } from 'lucide-react';
import { User as UserType, CompanyProfile } from '../types';
import { MOCK_USERS, BRAND_CONFIG } from '../constants';
import { validateLicenseStartup, trackCloudLogin, APP_VERSION, getAppDeveloper, getStoredLicense, requestResetOTP, updateCloudPassword, requestDeveloperOTP, verifyDeveloperOTP } from '../services/licenseService';
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
  const [devOTP, setDevOTP] = useState('');
  const [isVerifyingDev, setIsVerifyingDev] = useState(false);
  const [devError, setDevError] = useState('');
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus OTP input when Developer modal opens
  useEffect(() => {
    if (showDevModal) {
      setTimeout(() => { if (otpInputRef.current) otpInputRef.current.focus(); }, 150);
    }
  }, [showDevModal]);

  // Check for auto-logout timeout
  useEffect(() => {
    if (sessionStorage.getItem('logout_reason') === 'timeout') {
      setShowTimeoutMessage(true);
      sessionStorage.removeItem('logout_reason');
    }
  }, []);

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

    checkAdminLockout();

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

      const cleanUsername = username.trim();
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
        const uNameStr = String(u.username).trim().toLowerCase();
        const inputUNameStr = cleanUsername.toLowerCase();

        // Match 1: Direct username match
        const isDirectMatch = uNameStr === inputUNameStr;

        // Match 2: Registered Identity Alias (For Admin)
        const isIdentityAlias = (u.role === 'Administrator' &&
          license && license.userID &&
          String(license.userID).trim().toLowerCase() === inputUNameStr);

        return (isDirectMatch || isIdentityAlias) && String(u.password).trim() === cleanPassword;
      });

      if (user) {
        console.log("✅ Login successful for:", cleanUsername);

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
          if (String(freshDev.username).trim().toLowerCase() === cleanUsername.toLowerCase() &&
            String(freshDev.password).trim() === cleanPassword) {
            console.log("✅ Login successful via Cloud Sync (Developer Bypass) for:", cleanUsername);
            onLogin(freshDev);
            return;
          }
        }

        if (syncResult.valid) {
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
        const userExists = allUsers.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
        if (userExists) {
          setError('Invalid password. Credentials do not match.');
        } else {
          setError('Invalid credentials. Please check your username and password.');
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

              {/* Dynamic Alert Message Board - Legal Notice / News */}
              {companyProfile?.loginAlertEnabled && companyProfile.loginAlertMessage && (
                <div className="mt-6 p-5 bg-[#0a0f1d] border-2 border-rose-500/30 rounded-3xl max-w-[320px] shadow-[0_0_20px_rgba(244,63,94,0.1)] relative overflow-hidden group/alert animate-in fade-in slide-in-from-bottom-4 duration-1000">
                  <div className="absolute inset-0 bg-rose-500/[0.02] group-hover/alert:bg-rose-500/[0.05] transition-colors"></div>
                  <div className="relative z-10">
                    <p className="text-[10px] text-rose-400 font-black uppercase tracking-[0.2em] mb-3 flex items-center justify-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                      Legal Notice
                    </p>
                    <div className="h-px w-12 bg-rose-500/20 mx-auto mb-3"></div>
                    <p className="text-[10px] leading-relaxed text-slate-300 font-bold text-center whitespace-pre-wrap px-1">
                      {companyProfile.loginAlertMessage}
                    </p>
                  </div>
                </div>
              )}
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
                <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="text-red-400 shrink-0" size={20} />
                  <p className="text-xs text-red-200">{error}</p>
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
                    onChange={(e) => setUsername(e.target.value)}
                    title="Username"
                    aria-label="Username"
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-500 text-sm"
                    placeholder="Enter username"
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
    </div >
  );
};

export default Login;