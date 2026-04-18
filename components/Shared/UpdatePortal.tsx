
import React from 'react';
import { 
  RefreshCw, Loader2, Info, ShieldAlert, CheckCircle2, 
  ArrowRight, X, ShieldCheck, Database, AlertTriangle
} from 'lucide-react';

interface UpdatePortalProps {
  isOpen: boolean;
  state: 'TOAST' | 'PREPARING' | 'BACKGROUND' | 'READY' | 'VIOLATION';
  version: string | null;
  onUpdateNow: () => void;
  onUpdateLater: () => void;
  onClose: () => void;
}

const UpdatePortal: React.FC<UpdatePortalProps> = ({
  isOpen,
  state,
  version,
  onUpdateNow,
  onUpdateLater,
  onClose
}) => {
  if (!isOpen) return null;

  // ── RENDER: TOAST (Image 2) ──
  if (state === 'TOAST') {
    return (
      <div className="fixed bottom-6 right-6 z-[60] bg-[#1e293b] border border-blue-500/30 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-w-sm animate-in slide-in-from-bottom-5 duration-500 overflow-hidden flex gap-4">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50"></div>
        <div className="shrink-0 p-3 bg-blue-500/10 rounded-xl flex items-center justify-center">
          <RefreshCw className="text-blue-400 animate-spin-slow" size={24} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-black text-white text-sm uppercase tracking-tight">Update Available!</h4>
            <button 
              onClick={onClose} 
              className="text-slate-500 hover:text-white transition-colors"
              title="Close Notification"
              aria-label="Close update notification"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed mb-4">
             Version {version} is ready for download. This update includes performance and security fixes.
          </p>
          <div className="flex gap-2">
            <button 
              onClick={onUpdateNow} 
              className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
            >
              Update Now
            </button>
            <button 
              onClick={onUpdateLater} 
              className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg text-slate-300 text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Next Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: PREPARING (Image 3) ──
  if (state === 'PREPARING') {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-500 px-6">
        <div className="bg-[#1e293b] w-full max-w-sm rounded-[2.5rem] border border-blue-500/30 shadow-2xl p-10 overflow-hidden text-center space-y-8">
           <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <Database className="text-blue-400 opacity-50" size={32} />
           </div>
           
           <div className="space-y-3">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Preparing Update...</h3>
              <div className="h-1 w-20 bg-blue-500/20 mx-auto rounded-full overflow-hidden">
                 <div className="h-full bg-blue-500 w-1/4 animate-ping"></div>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed font-medium">
                 Snapshotting your local data and downloading the latest release. Please wait...
              </p>
           </div>
        </div>
      </div>
    );
  }

  // ── RENDER: BACKGROUND INFO (Image 4) ──
  if (state === 'BACKGROUND') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in zoom-in-95 duration-300">
        <div className="bg-[#1e293b] w-full max-w-sm rounded-[2.5rem] border border-blue-500/30 shadow-2xl p-0 overflow-hidden text-center">
            <div className="p-8 bg-blue-500/10 border-b border-blue-500/20 flex flex-col items-center gap-4">
               <div className="p-4 bg-slate-900 border border-slate-700 rounded-3xl shadow-inner">
                  <Info className="text-blue-400" size={40} />
               </div>
               <h3 className="text-xl font-black text-white uppercase tracking-tighter">Updating In Background</h3>
            </div>
            <div className="p-10 space-y-8">
               <p className="text-slate-300 text-sm leading-relaxed font-medium">
                  The download is taking a few moments. We will continue in the background. You can keep using the application, and we will prompt you once it is ready.
               </p>
               <button 
                onClick={onClose} 
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95"
               >
                 OK
               </button>
            </div>
        </div>
      </div>
    );
  }

  // ── RENDER: READY TO INSTALL (Image 1) ──
  if (state === 'READY') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-in zoom-in-95 duration-300">
        <div className="bg-[#1e293b] w-full max-w-md rounded-[2.5rem] border border-blue-500/20 shadow-2xl p-0 overflow-hidden text-center">
            <div className="p-10 bg-blue-500/5 border-b border-white/5 flex flex-col items-center gap-5">
               <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl">
                  <AlertTriangle className="text-blue-400" size={48} />
               </div>
               <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Update Ready To Install</h3>
               <div className="h-0.5 w-16 bg-blue-500/30 rounded-full"></div>
            </div>
            
            <div className="p-12 space-y-10">
               <p className="text-slate-300 text-sm leading-relaxed font-medium">
                  Version <strong className="text-white">{version}</strong> has been downloaded. Would you like to install it now? Your data will be backed up automatically for safety.
               </p>
               
               <div className="flex gap-4">
                  <button 
                    onClick={onUpdateLater} 
                    className="flex-1 py-4 bg-slate-800/50 hover:bg-slate-800 text-slate-400 font-black uppercase tracking-widest rounded-2xl border border-white/5 transition-all"
                  >
                    Later
                  </button>
                  <button 
                    onClick={onUpdateNow} 
                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all shadow-blue-900/40 active:scale-95 flex items-center justify-center gap-2"
                  >
                    Install Now
                    <ArrowRight size={18} />
                  </button>
               </div>
            </div>
        </div>
      </div>
    );
  }

  // ── RENDER: SECURITY VIOLATION (NEW) ──
  if (state === 'VIOLATION') {
    return (
      <div className="fixed inset-0 bg-rose-950/95 backdrop-blur-xl z-[1000] flex items-center justify-center p-6 text-center">
        <div className="max-w-lg w-full bg-slate-900 border-2 border-rose-500/50 rounded-[3rem] p-12 shadow-[0_0_100px_rgba(244,63,94,0.3)] relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-600/20 blur-3xl rounded-full"></div>
            
            <div className="relative z-10 space-y-8">
               <div className="w-24 h-24 mx-auto bg-rose-500/10 rounded-3xl flex items-center justify-center text-rose-500 border border-rose-500/30">
                  <ShieldAlert size={56} className="animate-pulse" />
               </div>
               
               <div className="space-y-4">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Security Violation</h3>
                  <div className="h-1 w-20 bg-rose-600 mx-auto rounded-full"></div>
                  <p className="text-rose-200/80 text-sm font-bold uppercase tracking-[0.2em]">SHA-256 Integrity Verification Failed</p>
               </div>

               <p className="text-slate-400 text-sm leading-relaxed">
                  The downloaded update file does not match the security hash provided by the cloud engine. 
                  The file has been deleted to protect your hardware and data from potential corruption or unauthorized modification.
               </p>

               <div className="pt-4">
                  <button 
                    onClick={onClose} 
                    className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3"
                  >
                    <X size={18} /> Close & Notify Support
                  </button>
               </div>
            </div>
        </div>
      </div>
    );
  }

  return null;
};

export default UpdatePortal;
