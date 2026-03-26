
import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Lock, User as UserIcon, AlertCircle, IndianRupee, ShieldCheck, Maximize, Minimize, Power, Globe, HelpCircle, Activity } from 'lucide-react';
import { User as UserType } from '../types';
import { MOCK_USERS, BRAND_CONFIG } from '../constants';
import { validateLicenseStartup, trackCloudLogin, APP_VERSION, getAppDeveloper } from '../services/licenseService';

interface LoginProps {
  onLogin: (user: UserType) => void;
  currentLogo: string;
  setLogo: (url: string) => void;
  logoutMessage?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, currentLogo: _currentLogo, logoutMessage }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [_bridgeReady, setBridgeReady] = useState(!!(window as any).electronAPI);
  const usernameRef = useRef<HTMLInputElement>(null);

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

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Auto-focus on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (usernameRef.current) {
        usernameRef.current.focus();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 1. License & Security Validation First
      const { valid, message } = await validateLicenseStartup();
      if (!valid) {
        setError(message || 'System Security Check Failed. Contact Support.');
        setIsLoading(false);
        return;
      }

      // 2. Auth Logic
      const usersRaw = localStorage.getItem('app_users');
      let users: UserType[] = usersRaw ? JSON.parse(usersRaw) : MOCK_USERS;
      
      // Auto-inject developer if found in secure storage
      const dev = getAppDeveloper();
      if (dev) {
        if (!users.some(u => u.username === dev.username)) {
           users = [...users, dev];
        }
      }

      const user = users.find(u => 
        u.username.toLowerCase() === username.toLowerCase() && 
        u.password === password
      );

      if (user) {
        // Track login in cloud if online
        const mid = localStorage.getItem('app_machine_id') || 'UNKNOWN';
        trackCloudLogin(user.email, mid);
        
        onLogin(user);
      } else {
        setError('Invalid username or password');
      }
    } catch (err: any) {
      setError('Authentication Service Unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAccess = (user: UserType) => {
    setUsername(user.username);
    setPassword(user.password || '');
    // Small delay to show the fields being filled before proceeding
    setTimeout(() => {
      handleSubmit();
    }, 300);
  };

  const handleQuitApp = () => {
    // @ts-ignore
    if (window.electronAPI && window.electronAPI.quitApp) {
      // @ts-ignore
      window.electronAPI.quitApp();
    } else {
      window.close();
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-1000">
      {/* Premium Login Card */}
      <div className="w-full max-w-5xl bg-slate-900/40 backdrop-blur-2xl rounded-[2.5rem] border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col md:flex-row min-h-[650px] relative group">
        
        {/* Animated Background Gradients */}
        <div className="absolute top-0 -left-20 w-80 h-80 bg-blue-600/10 blur-[100px] rounded-full group-hover:bg-blue-600/20 transition-all duration-1000"></div>
        <div className="absolute bottom-0 -right-20 w-80 h-80 bg-indigo-600/10 blur-[100px] rounded-full group-hover:bg-indigo-600/20 transition-all duration-1000"></div>

        {/* --- LEFT BRANDING SECTION --- */}
        <div className="md:w-5/12 bg-[#0f172a] p-10 md:p-16 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-800 text-center relative overflow-hidden group">
          {/* Decorative Elements */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
          
          <div className="relative z-10 space-y-12">
               {/* Rounded Logo Implementation per Image 2 */}
               <div className="relative mx-auto">
                 <div className="absolute -inset-4 bg-blue-500/20 blur-2xl rounded-full animate-pulse"></div>
                 <div className="relative w-36 h-36 rounded-full border-[6px] border-white overflow-hidden shadow-2xl bg-[#020617] flex items-center justify-center group-hover:scale-105 transition-transform duration-700">
                    <img 
                      src={BRAND_CONFIG.logoUrl} 
                      alt="BharatPay Pro Logo" 
                      className="w-full h-full object-cover" 
                      onError={(e) => { (e.target as any).src = "https://ui-avatars.com/api/?name=BPP&background=0f172a&color=fff&size=128" }}
                    />
                 </div>
               </div>

               <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
                    <IndianRupee size={12} className="text-blue-400" />
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Enterprise Payroll Solutions</span>
                  </div>

                  <h1 className="text-5xl font-black tracking-tighter leading-none">
                    <span className="text-[#FF9933] drop-shadow-sm">Bharat</span>
                    <span className="text-white drop-shadow-md">Pay</span>
                    <span className="text-[#34d399]">{BRAND_CONFIG.appNameSuffix}</span>
                  </h1>

                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">{BRAND_CONFIG.tagline}</p>
                    <div className="h-0.5 w-12 bg-blue-600/50 mx-auto rounded-full"></div>
                  </div>
               </div>

               <div className="pt-8 space-y-6">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] italic">Architected & Engineered By</p>
                    <div className="flex items-center justify-center gap-2">
                       <span className="px-4 py-1 bg-slate-800/50 rounded-full text-xs font-black text-[#FF9933] uppercase tracking-widest border border-slate-700/50">ILCBala</span>
                    </div>
                  </div>
                  <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.4em]">Decoding Indian Labour Laws</p>
               </div>

               {/* Version Pill - Prominent at bottom per Image 2 */}
               <div className="mt-4 px-4 py-1 bg-slate-800/80 border border-slate-700/50 rounded-full shadow-lg">
                 <span className="text-[9px] font-black tracking-widest text-[#FFD700] uppercase">Version {APP_VERSION}</span>
               </div>
          </div>
        </div>

        {/* --- RIGHT LOGIN FORM SECTION --- */}
        <div className="md:w-7/12 p-10 md:p-16 flex flex-col justify-center bg-slate-900/20 relative">
          
          {/* Top Control Bar */}
          <div className="absolute top-8 right-8 flex items-center gap-3">
             <button 
                onClick={toggleFullScreen}
                title={isFullScreen ? "Minimize" : "Maximize"}
                className="p-2.5 bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all border border-slate-700/50"
             >
                {isFullScreen ? <Minimize size={18} /> : <Maximize size={18} />}
             </button>
             <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                <ShieldCheck size={20} />
             </div>
          </div>

          <div className="max-w-md w-full mx-auto space-y-8">
            <div className="space-y-2">
              <h2 className="text-4xl font-black text-white tracking-tight italic">Welcome Back</h2>
              <p className="text-slate-500 font-bold text-sm">Please sign in to your secure portal.</p>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 animate-in slide-in-from-top-2">
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-xs font-black uppercase tracking-wide">{error}</p>
              </div>
            )}

            {logoutMessage && !error && (
               <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center gap-3 text-blue-400 animate-in slide-in-from-top-2">
                 <Power size={18} className="shrink-0" />
                 <p className="text-xs font-black uppercase tracking-wide">{logoutMessage}</p>
               </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                   <div className="relative group/input">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-blue-500 transition-colors">
                      <UserIcon size={20} />
                    </div>
                    <input
                      ref={usernameRef}
                      type="text"
                      className="w-full bg-slate-950/50 border border-slate-800 text-white rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-bold placeholder:text-slate-700"
                      placeholder="Enter username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                   <div className="relative group/input">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-blue-500 transition-colors">
                      <Lock size={20} />
                    </div>
                    <input
                      type="password"
                      className="w-full bg-slate-950/50 border border-slate-800 text-white rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-bold placeholder:text-slate-700"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 group active:scale-[0.98] disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Verifying...</span>
                  </div>
                ) : (
                  <>
                    Sign In to Dashboard
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <button 
              onClick={handleQuitApp}
              className="w-full flex items-center justify-center gap-2 text-slate-600 hover:text-red-500 transition-colors text-[10px] font-black uppercase tracking-[0.2em]"
            >
              <Power size={14} />
              Quit Application
            </button>

            {/* Quick Access Roles */}
            <div className="mt-8 pt-6 border-t border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3 text-center">Quick Access Roles</p>
              <div className={`grid ${getAppDeveloper() && !(import.meta as any).env.PROD ? 'grid-cols-3' : 'grid-cols-2'} gap-2 max-w-md mx-auto`}>
                {MOCK_USERS.map((user) => (
                  <button
                    key={user.username}
                    onClick={() => handleQuickAccess(user)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500/50 rounded-xl text-[10px] font-black text-slate-400 hover:text-blue-400 transition-all uppercase tracking-widest"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${user.username === 'admin' ? 'bg-amber-500' : user.username === 'suganthi' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                    {user.name}
                  </button>
                ))}
                
                {getAppDeveloper() && !(import.meta as any).env.PROD && (
                   <button
                    onClick={() => handleQuickAccess(getAppDeveloper()!)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-[10px] font-black text-indigo-400 transition-all uppercase tracking-widest blink-border"
                  >
                    <Activity size={12} />
                    Core Dev
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* System Bar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full px-16 flex items-center justify-between pointer-events-none opacity-40">
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">
                 <Globe size={10} />
                 Connected
              </div>
              <div className="flex items-center gap-2 text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">
                 <HelpCircle size={10} />
                 Support
              </div>
           </div>
           <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em]">
              Secured Session x2026
           </div>
        </div>

      </div>
    </div>
  );
};

export default Login;