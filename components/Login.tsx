
import React, { useState, useEffect } from 'react';
import { ArrowRight, Lock, User as UserIcon, AlertCircle, Edit, IndianRupee, Shield, ShieldCheck, User, Maximize, Minimize } from 'lucide-react';
import { User as UserType } from '../types';
import { MOCK_USERS, BRAND_CONFIG } from '../constants';

interface LoginProps {
  onLogin: (user: UserType) => void;
  currentLogo: string;
  setLogo: (url: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, currentLogo, setLogo }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

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
      const user = MOCK_USERS.find(
        (u) => u.username === username && u.password === password
      );

      if (user) {
        onLogin(user);
      } else {
        setError('Invalid credentials. Please check your username and password.');
        setIsLoading(false);
      }
    }, 800);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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
        <div className="md:w-1/2 bg-[#0f172a] p-8 md:p-12 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-800 text-center">
            
            {/* Logo */}
            <div className="relative inline-block group mb-6">
                <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-white shadow-2xl shadow-black/50 p-1 overflow-hidden border-4 border-[#1e293b]">
                    <img 
                      src={currentLogo} 
                      alt={BRAND_CONFIG.companyName} 
                      className="w-full h-full object-cover rounded-full"
                    />
                </div>
                {/* Upload Overlay */}
                <label className="absolute inset-0 top-0 h-32 w-32 mx-auto rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity z-10">
                    <Edit className="text-white" size={24} />
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </label>
            </div>

            {/* App Title */}
            <div className="mb-2">
                <div className="flex items-center justify-center gap-3 mb-2">
                    <div className="bg-[#4169E1] p-2 rounded-xl text-white shadow-lg shadow-blue-500/20">
                        <IndianRupee size={24} className="text-[#FF9933]" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight">
                        <span className="text-[#FF9933]">Bharat</span>
                        <span className="text-white">Pay</span>
                        <span className="text-[#4ADE80] ml-1">{BRAND_CONFIG.appNameSuffix}</span>
                    </h1>
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">{BRAND_CONFIG.tagline}</p>
            </div>

            {/* Powered By */}
            <p className="text-[10px] text-slate-500 font-bold tracking-widest mt-8 opacity-70">
                POWERED By <span className="text-[#FF9933]">{BRAND_CONFIG.companyName}</span>
            </p>
        </div>

        {/* Right: Login Form */}
        <div className="md:w-1/2 p-8 md:p-12 bg-[#1e293b] flex flex-col justify-center">
            <h2 className="text-2xl font-bold text-white mb-6">Secure Access</h2>
            
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
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            Sign In <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>
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
  );
};

export default Login;
