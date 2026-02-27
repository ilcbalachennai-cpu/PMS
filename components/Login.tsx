import React, { useState, useEffect } from 'react';
import { ArrowRight, Lock, User as UserIcon, AlertCircle, IndianRupee, Shield, ShieldCheck, User, Maximize, Minimize, Power } from 'lucide-react';
import { User as UserType } from '../types';
import { MOCK_USERS, BRAND_CONFIG } from '../constants';

interface LoginProps {
  onLogin: (user: UserType) => void;
  currentLogo: string;
  setLogo: (url: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, currentLogo }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(!!(window as any).electronAPI);

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
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      try {
        // Get registered users from localStorage
        const savedUsersRaw = localStorage.getItem('app_users');
        let allUsers = MOCK_USERS;

        if (savedUsersRaw) {
          try {
            const savedUsers: UserType[] = JSON.parse(savedUsersRaw);
            // Combine, allowing saved users to override mock users with same username (like 'admin')
            allUsers = [
              ...savedUsers,
              ...MOCK_USERS.filter(mu => !savedUsers.some(su => su.username === mu.username))
            ];
          } catch (e) {
            console.error("Failed to parse app_users", e);
          }
        }

        const user = allUsers.find(
          (u) => u.username === username && u.password === password
        );

        if (user) {
          console.log("Login successful for:", username);
          onLogin(user);
        } else {
          setError('Invalid credentials. Please check your username and password.');
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Critical login failure:", err);
        setError('An unexpected error occurred during login. Please try again.');
        setIsLoading(false);
      }
    }, 800);
  };

  const autofill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
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
              <div className="relative flex items-center justify-center w-40 h-40 rounded-full bg-white shadow-2xl p-[6px] overflow-hidden border-4 border-[#1e293b] transform group-hover:scale-105 transition-transform duration-500">
                <img
                  src={BRAND_CONFIG.logoUrl}
                  alt={BRAND_CONFIG.companyName}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
            </div>

            {/* App Title Section */}
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-1">
                <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full mb-2">
                  <IndianRupee size={16} className="text-[#FF9933]" />
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Enterprise Payroll Solutions</span>
                </div>
                <h1 className="text-5xl font-black tracking-tighter leading-none">
                  <span className="text-[#FF9933] drop-shadow-sm">Bharat</span>
                  <span className="text-white drop-shadow-md">Pay</span>
                  <span className="text-[#4ADE80]">{BRAND_CONFIG.appNameSuffix}</span>
                </h1>
              </div>
              <div className="h-1 w-24 bg-gradient-to-r from-transparent via-blue-500 to-transparent mx-auto rounded-full opacity-50"></div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em]">DECODING INDIAN LABOUR LAWS</p>
            </div>

            {/* Developer Section */}
            <div className="pt-8 flex flex-col items-center gap-2">
              <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase opacity-60">Architected & Engineered by</span>
              <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <span className="text-sm font-black text-[#FF9933] tracking-wide">{BRAND_CONFIG.companyName}</span>
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
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-600 text-sm"
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
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-600 text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#FF9933] via-white/90 to-[#4ADE80] text-slate-900 font-black py-4 rounded-xl shadow-xl hover:shadow-amber-500/20 transition-all flex items-center justify-center gap-3 group disabled:opacity-70 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="uppercase tracking-[0.2em] text-sm">Sign In to Dashboard</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <div className="flex justify-center mt-2">
                <button
                  type="button"
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
                  className="flex items-center gap-2 text-slate-500 hover:text-red-400 transition-colors text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                  title="Quit Application"
                >
                  <Power size={14} />
                  Quit Application
                </button>
              </div>
            </form>

            {/* Quick Access Roles */}
            <div className="mt-8 pt-6 border-t border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3 text-center">Quick Access Roles</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => autofill('dev', 'dev@123')} className="flex flex-col items-center justify-center p-2 rounded-lg bg-amber-900/10 hover:bg-amber-900/20 border border-amber-900/30 transition-all group">
                  <Shield className="text-amber-500 mb-1 group-hover:scale-110 transition-transform" size={16} />
                  <span className="text-[10px] font-bold text-amber-500">Developer</span>
                </button>
                <button onClick={() => autofill('admin', 'admin@123')} className="flex flex-col items-center justify-center p-2 rounded-lg bg-blue-900/10 hover:bg-blue-900/20 border border-blue-900/30 transition-all group">
                  <ShieldCheck className="text-blue-500 mb-1 group-hover:scale-110 transition-transform" size={16} />
                  <span className="text-[10px] font-bold text-blue-500">Admin</span>
                </button>
                <button onClick={() => autofill('user', 'user@123')} className="flex flex-col items-center justify-center p-2 rounded-lg bg-emerald-900/10 hover:bg-emerald-900/20 border border-emerald-900/30 transition-all group">
                  <User className="text-emerald-500 mb-1 group-hover:scale-110 transition-transform" size={16} />
                  <span className="text-[10px] font-bold text-emerald-500">User</span>
                </button>
              </div>
            </div>
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