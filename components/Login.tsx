import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Lock, User as UserIcon, AlertCircle, IndianRupee, ShieldCheck, Maximize, Minimize, Power } from 'lucide-react';
import { User as UserType } from '../types';
import { MOCK_USERS, BRAND_CONFIG } from '../constants';
import { validateLicenseStartup, trackCloudLogin, APP_VERSION, getAppDeveloper } from '../services/licenseService';

interface LoginProps {
  onLogin: (user: UserType) => void;
  currentLogo: string;
  setLogo: (url: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, currentLogo: _currentLogo }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const [_bridgeReady, setBridgeReady] = useState(!!(window as any).electronAPI);
  const usernameRef = useRef<HTMLInputElement>(null);

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
        } catch (e) {}
      }

      const isSetupComplete = localStorage.getItem('app_setup_complete') === 'true';
      
      // If we think setup is done but have no admin, something is wrong
      if (isSetupComplete && !hasLocalAdmin) {
         console.warn("🚫 LOCKOUT DETECTED ON MOUNT: Setup marked complete but no Admin found. Resetting...");
         localStorage.removeItem('app_setup_complete');
         window.location.reload();
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
          username: 'ILCBala',
          password: 'password', // Default local fallback
          role: 'Developer',
          name: 'ILCBala (Developer)',
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

      // Debug: Log all available usernames (only in dev)
      const isDev = import.meta.env.DEV;
      if (isDev) {
        console.log("🔐 Login Attempt:", { username: cleanUsername });
        console.log("👥 Local User DB:", allUsers.map(u => ({ username: u.username, role: u.role })));
      }

      const user = allUsers.find(
        (u) =>
          String(u.username).trim().toLowerCase() === cleanUsername.toLowerCase() &&
          String(u.password).trim() === cleanPassword
      );

      if (user) {
        console.log("✅ Login successful for:", cleanUsername);

        // --- V01.0.11: CLOUD LOGIN TRACKING ---
        try {
          const machineId = localStorage.getItem('app_machine_id');
          if (machineId) {
            // To track accurately we need the registered Email from the license
            const rawLicense = localStorage.getItem('app_license_secure');
            if (rawLicense) {
              // Quick unscramble to get email without importing the whole unscramble logic
              // We can just rely on getStoredLicense if we import it, let's just do that in a cleaner way:
              // Since getStoredLicense is not exported/imported directly here, let's just use the known structure 
              // or better yet, we can export getStoredLicense from licenseService.

              // Actually, let's just use what we have. We know the email is the 'registeredTo' field.
              const btoaDecoded = atob(rawLicense);
              const SECRET_PEPPER = "BPP_PRO_2026_SECURE_VAL";

              // Decode payload
              const unsalted = btoaDecoded.split('').map((c, i) =>
                String.fromCharCode(c.charCodeAt(0) ^ (SECRET_PEPPER.charCodeAt(i % SECRET_PEPPER.length)))
              ).join('');

              const parts = unsalted.split('|');
              const jsonPayload = parts.slice(0, -1).join('|');
              const licenseObj = JSON.parse(jsonPayload);

              if (licenseObj && licenseObj.registeredTo) {
                trackCloudLogin(licenseObj.registeredTo, machineId);
              }
            }
          }
        } catch (e) {
          console.warn("Could not fire cloud tracking:", e);
        }

        onLogin(user);
      } else {
        // --- EMERGENCY REDIRECT IF NO ADMINS ---
        const hasAdmin = allUsers.some(u => u.role === 'Administrator');
        if (!hasAdmin) {
            console.warn("🚫 NO ADMINISTRATOR FOUND: System requires local admin character. Resetting to initialization.");
            localStorage.removeItem('app_setup_complete');
            window.location.reload();
            return;
        }

        // --- CLOUD FALLBACK ---
        console.log("⚠️ Local login failed. Attempting cloud sync fallback...");
        const syncResult = await validateLicenseStartup(true);

        // 1. ADVANCED DEVELOPER BYPASS (Check this FIRST before license validity)
        // If a valid developer was just synced, let them in regardless of license status
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
            
            // CRITICAL: Update the parent allUsers reference so the final error message (line 266) is accurate
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
                if (machineId) {
                  const rawLicense = localStorage.getItem('app_license_secure');
                  if (rawLicense) {
                    const btoaDecoded = atob(rawLicense);
                    const SECRET_PEPPER = "BPP_PRO_2026_SECURE_VAL";
                    const unsalted = btoaDecoded.split('').map((c, i) =>
                      String.fromCharCode(c.charCodeAt(0) ^ (SECRET_PEPPER.charCodeAt(i % SECRET_PEPPER.length)))
                    ).join('');
                    const parts = unsalted.split('|');
                    const jsonPayload = parts.slice(0, -1).join('|');
                    const licenseObj = JSON.parse(jsonPayload);
                    if (licenseObj && licenseObj.registeredTo) {
                      trackCloudLogin(licenseObj.registeredTo, machineId);
                    }
                  }
                }
              } catch (e) {
                console.warn("Could not fire cloud tracking on fallback:", e);
              }

              onLogin(syncedUser);
              return;
            }
          }
        }

        // If still fails, try case-insensitive username for helpful error
        const userWithDifferentCase = allUsers.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
        if (userWithDifferentCase) {
          setError('Invalid password. (Note: Usernames are case-sensitive)');
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
    setUsername(u);
    setPassword('');
    // Auto-focus password field after filling username
    const passInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    if (passInput) passInput.focus();
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
        <div className="md:w-5/12 bg-[#0f172a] p-10 md:p-16 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-800 text-center relative overflow-hidden group">
          {/* Subtle Glow Background for Logo */}
          <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

          <div className="relative z-10 flex flex-col items-center gap-8">
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
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-1">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-900/30 border border-blue-500/30 rounded-full mb-2">
                  <IndianRupee size={14} className="text-[#FF9933]" />
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">Enterprise Payroll Solutions</span>
                </div>
                <h1 className="text-5xl font-black tracking-tighter leading-none">
                  <span className="text-[#FF9933] drop-shadow-sm">Bharat</span>
                  <span className="text-white drop-shadow-md">Pay</span>
                  <span className="text-[#34d399]">{BRAND_CONFIG.appNameSuffix}</span>
                </h1>
              </div>
              <div className="h-1 w-24 bg-gradient-to-r from-transparent via-blue-500 to-transparent mx-auto rounded-full opacity-50"></div>
            </div>

            {/* Branding Footer */}
            <div className="pt-2 flex flex-col items-center gap-2">
              <span className="text-[9px] text-slate-600 font-bold tracking-widest uppercase mb-1">Architected & Engineered by</span>
              <div className="px-6 py-2 bg-slate-900/40 border border-slate-800 rounded-2xl">
                <span className="text-xs font-black text-[#FF9933] tracking-wider uppercase">{BRAND_CONFIG.companyName}</span>
              </div>
              <p className="text-slate-500 text-[8px] font-bold uppercase tracking-[0.2em] mt-1">{BRAND_CONFIG.tagline}</p>
              
              {/* Version Pill - Prominent at bottom per Image 2 */}
              <div className="mt-4 px-4 py-1 bg-slate-800/80 border border-slate-700/50 rounded-full shadow-lg">
                <span className="text-[9px] font-black tracking-widest text-[#FFD700] uppercase">Version {APP_VERSION}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Login Form */}
        <div className="md:w-7/12 p-10 md:p-16 bg-[#1e293b] flex flex-col justify-center relative overflow-hidden">
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
                <div className={`grid ${!import.meta.env.PROD ? 'grid-cols-3' : 'grid-cols-2'} gap-2 max-w-sm mx-auto`}>
                  {(() => {
                    const isDevMode = !import.meta.env.PROD;
                    const savedUsersRaw = localStorage.getItem('app_users');
                    let localUsers: UserType[] = [];
                    
                    if (savedUsersRaw) {
                      try {
                        localUsers = JSON.parse(savedUsersRaw);
                      } catch (e) { }
                    }

                    const admin = localUsers.find(u => u.role === 'Administrator');
                    const payrollUser = localUsers.find(u => u.role === 'User');
                    const developer = getAppDeveloper();
                    
                    // Strictly hide developer button in PROD builds per user request
                    const showDev = isDevMode; 

                    const buttons = [
                      // Admin Slot
                      <button 
                        key="admin" 
                        onClick={() => admin && autofill(admin.username)} 
                        disabled={!admin}
                        type="button"
                        title={admin ? `Login as ${admin.name}` : 'Admin user not active'}
                        aria-label={admin ? `Login as ${admin.name}` : 'Admin user not active'}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all group ${
                          admin 
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
                        className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all group ${
                          payrollUser 
                            ? 'bg-emerald-900/10 hover:bg-emerald-900/20 border border-emerald-900/30' 
                            : 'bg-slate-900/10 border border-slate-800/30 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <UserIcon className={`${payrollUser ? 'text-emerald-500' : 'text-slate-500'} mb-1 group-hover:scale-110 transition-transform`} size={16} />
                        <span className={`text-[10px] font-bold ${payrollUser ? 'text-emerald-500' : 'text-slate-500'} truncate w-full px-1`}>
                          {payrollUser ? payrollUser.name : 'PAYROLL INACTIVE'}
                        </span>
                      </button>
                    ];

                    if (showDev) {
                      buttons.push(
                        <button 
                          key="developer" 
                          onClick={() => {
                            if (developer) autofill(developer.username);
                            else autofill('ILCBala'); // Fallback for local developer mode
                          }} 
                          type="button"
                          title={developer ? `Login as ${developer.name} (Cloud Account)` : 'Login as Developer (Local Mode)'}
                          aria-label={developer ? `Login as ${developer.name}` : 'Login as Developer'}
                          className="flex flex-col items-center justify-center p-2 rounded-lg transition-all group bg-amber-900/10 hover:bg-amber-900/20 border border-amber-900/30"
                        >
                          <IndianRupee className="text-[#FF9933] mb-1 group-hover:scale-110 transition-transform" size={16} />
                          <span className="text-[10px] font-bold text-[#FF9933] truncate w-full px-1">
                            {developer ? developer.name : 'ILCBala (Developer)'}
                          </span>
                        </button>
                      );
                    }

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
    </div >
  );
};

export default Login;