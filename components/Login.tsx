
import React, { useState } from 'react';
import { ArrowRight, Lock, User as UserIcon, AlertCircle, Edit, IndianRupee } from 'lucide-react';
import { User } from '../types';
import { MOCK_USERS, BRAND_CONFIG } from '../constants';

interface LoginProps {
  onLogin: (user: User) => void;
  currentLogo: string;
  setLogo: (url: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, currentLogo, setLogo }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay for realistic feel
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

  return (
    <div className="min-h-screen w-full bg-[#020617] flex items-center justify-center p-4 relative">
      {/* Background Decor - Fixed Position to avoid layout shift */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[100px]"></div>
      </div>

      {/* Login Card - High Z-Index */}
      <div className="w-full max-w-md relative z-10 bg-[#1e293b] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Header Section */}
        <div className="bg-[#0f172a] p-8 text-center border-b border-slate-800 flex flex-col items-center">
            
            {/* 1. App Title with Rupee Symbol */}
            <div className="flex flex-col items-center mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-900/20">
                        <IndianRupee size={28} />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">
                        {BRAND_CONFIG.appName}<span className="text-blue-500">{BRAND_CONFIG.appNameSuffix}</span>
                    </h1>
                </div>
                <p className="text-slate-300 text-sm font-semibold tracking-wide">Comprehensive Pay Roll Management</p>
                <p className="text-[10px] text-sky-500 font-bold uppercase tracking-widest mt-1 opacity-90">Powered By {BRAND_CONFIG.companyName}</p>
            </div>

            {/* 2. Logo */}
            <div className="relative inline-block group mb-3">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white shadow-2xl shadow-black/50 p-1 overflow-hidden border-4 border-[#1e293b]">
                    <img 
                      src={currentLogo} 
                      alt={BRAND_CONFIG.companyName} 
                      className="w-full h-full object-cover rounded-full"
                    />
                </div>
                {/* Upload Overlay */}
                <label className="absolute inset-0 top-0 h-24 w-24 mx-auto rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity z-10">
                    <Edit className="text-white" size={24} />
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </label>
            </div>
            
            {/* 3. Tagline */}
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">{BRAND_CONFIG.tagline}</p>
        </div>

        {/* Form Section */}
        <form onSubmit={handleLogin} className="p-8 space-y-6">
            {error && (
                <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="text-red-400 shrink-0" size={20} />
                    <p className="text-sm text-red-200">{error}</p>
                </div>
            )}

            <div className="space-y-2">
                <label className="text-xs font-bold text-amber-500 uppercase tracking-widest ml-1">Username</label>
                <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-600"
                        placeholder="Enter your username"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-amber-500 uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-slate-600"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-amber-900/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <>
                        Sign In to Dashboard <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                )}
            </button>

            <div className="text-center pt-4 border-t border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Default Access</p>
                <div className="mt-2 flex justify-center gap-4 text-xs text-slate-400">
                    <span>User: <b>admin</b> / Pass: <b>password</b></span>
                </div>
            </div>
        </form>
      </div>
      
      <div className="absolute bottom-6 text-slate-600 text-xs text-center w-full z-10 pointer-events-none">
        &copy; 2024 {BRAND_CONFIG.companyName}. All rights reserved.
      </div>
    </div>
  );
};

export default Login;
