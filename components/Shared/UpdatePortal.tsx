import React from 'react';
import { 
  RefreshCw, Loader2, ShieldAlert, 
  ArrowRight, X, Wrench,
  Database, Download, CheckCircle2,
  Zap, Hash, Shield
} from 'lucide-react';

interface UpdatePortalProps {
  isOpen: boolean;
  state: 'TOAST' | 'PREPARING' | 'BACKGROUND' | 'READY' | 'VIOLATION' | 'PATCH' | 'INSTALLING';
  version: string | null;
  onUpdateNow: () => void;
  onUpdateLater: () => void;
  onClose: () => void;
  isMandatory?: boolean;
  isDownloading?: boolean;
  isPreparing?: boolean;
  downloadProgress?: number;
  patchSkipCount?: number;
  deploymentStep?: number;
}

const UpdatePortal: React.FC<UpdatePortalProps> = ({
  isOpen,
  state,
  version,
  onUpdateNow,
  onUpdateLater,
  onClose,
  isMandatory = false,
  isDownloading = false,
  isPreparing = false,
  downloadProgress = 0,
  patchSkipCount = 0,
  deploymentStep: externalStep
}) => {
  const [secondsLeft, setSecondsLeft] = React.useState(20);
  const [installStep, setInstallStep] = React.useState(3);
  const [marqueeIdx, setMarqueeIdx] = React.useState(0);
  const progRef1 = React.useRef<HTMLDivElement>(null);
  const progRef2 = React.useRef<HTMLDivElement>(null);
  const progRef3 = React.useRef<HTMLDivElement>(null);
  const [restartCountdown, setRestartCountdown] = React.useState(3);

  // Use external step if provided, otherwise fallback to local simulation
  const effectiveStep = externalStep !== undefined ? externalStep : installStep;

  // Sync Progress Bars directly
  React.useEffect(() => {
    [progRef1, progRef2, progRef3].forEach(ref => {
      if (ref.current) {
        ref.current.style.width = `${downloadProgress}%`;
      }
    });
  }, [downloadProgress, state, isOpen]);

  // Countdown logic for mandatory patches
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && state === 'PATCH' && isMandatory) {
      setSecondsLeft(20);
      timer = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            onUpdateNow();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [isOpen, state, isMandatory, onUpdateNow]);

  // Simulated Progress Steps for INSTALLING state
  React.useEffect(() => {
    let timer: NodeJS.Timeout;

    if (state === 'INSTALLING') {
      setInstallStep(3); // Reset to EXTRACT
      setRestartCountdown(3); 

      timer = setInterval(() => {
        setInstallStep(prev => {
           if (prev < 6) return prev + 1;
           return 6;
        });
      }, 1500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [state]);

  // Restart countdown logic (V02.02.26.1: Increased robustness)
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (state === 'INSTALLING' && effectiveStep === 6) {
       setRestartCountdown(3); // Reset to 3 when success begins
       timer = setInterval(() => {
          setRestartCountdown(prev => (prev > 0 ? prev - 1 : 0));
       }, 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [state, effectiveStep]);

  // Marquee Indicator Animation Logic
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (state === 'INSTALLING') {
      timer = setInterval(() => {
        setMarqueeIdx(prev => (prev + 1) % 15);
      }, 150);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [state]);

  const getMarqueeText = () => {
    const base = "................";
    const arrows = ">>>>>>";
    const pos = marqueeIdx % base.length;
    let res = base.split('');
    for (let i = 0; i < arrows.length; i++) {
      const idx = (pos + i) % base.length;
      res[idx] = arrows[i];
    }
    return res.join('');
  };

  if (!isOpen) return null;

  // --- Helper: Professional Status Message ---
  const getStatusMessage = (progress: number) => {
    if (progress === 0) return "Initializing...";
    if (progress < 30) return "Fetching Manifest...";
    if (progress < 60) return "Streaming Binary...";
    if (progress < 90) return "Verifying Integrity...";
    return "Finalizing...";
  };

  // --- Component: Progress Step Indicator (ULTRA COMPACT) ---
  const ProgressSteps = ({ currentStep, theme = 'blue' }: { currentStep: number, theme?: 'blue' | 'amber' | 'red' }) => {
    const steps = ['MANIFEST', 'SNAPSHOT', 'DOWNLOAD', 'EXTRACT', 'VALIDATE', 'APPLY', 'SUCCESS'];
    
    // Theme-based colors
    const activeColor = theme === 'amber' ? 'bg-amber-500' : theme === 'red' ? 'bg-red-500' : 'bg-blue-500';
    const borderColor = theme === 'amber' ? 'border-amber-500/30' : theme === 'red' ? 'border-red-500/30' : 'border-blue-500/30';
    
    // Done color is always Green for this request
    const doneColor = 'bg-emerald-500';

    return (
      <div className={`flex items-center justify-between px-6 py-2 border-b ${borderColor} bg-slate-950/40 mb-4 relative rounded-t-[1.5rem]`}>
        <div className="absolute top-[22px] left-[52px] right-[52px] h-[1px] bg-slate-800 z-0"></div>
        {steps.map((step, idx) => {
          const isActive = idx === currentStep;
          const isDone = idx < currentStep;
          return (
            <div key={step} className="relative z-10 flex flex-col items-center gap-1">
               <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all duration-500 
                ${isDone 
                   ? `${doneColor} border-transparent text-white shadow-[0_0_100px_rgba(16,185,129,0.2)]` 
                   : isActive 
                      ? `${(idx === 6 ? doneColor : activeColor)} border-transparent text-white scale-110 shadow-[0_0_12px_rgba(245,158,11,0.5)]` 
                      : 'bg-slate-900 border-white/20 text-white'}`}>
                {isDone ? <CheckCircle2 size={10} /> : <span className="text-[7px] font-black text-white">{idx + 1}</span>}
              </div>
              <span className={`text-[6px] font-black tracking-widest ${isDone ? 'text-emerald-500' : isActive ? (idx === 6 ? 'text-emerald-500' : 'text-amber-500') : 'text-white'}`}>{step}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // ── RENDER: TOAST ──
  if (state === 'TOAST') {
    return (
      <div className="fixed bottom-6 right-6 z-[60] bg-slate-900/90 backdrop-blur-xl border border-blue-500/30 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-w-sm animate-in slide-in-from-bottom-5 duration-500 overflow-hidden flex gap-4">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/80"></div>
        <div className="shrink-0 p-3 bg-blue-500/10 rounded-xl flex items-center justify-center relative overflow-hidden">
          <RefreshCw className="text-blue-400 animate-spin-slow relative z-10" size={24} />
          <div className="absolute inset-0 bg-blue-500/5 animate-pulse"></div>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-black text-white text-xs uppercase tracking-widest">Update Available</h4>
            <button onClick={onClose} title="Close" className="text-slate-500 hover:text-white transition-colors"><X size={14} /></button>
          </div>
          <p className="text-slate-400 text-[10px] leading-tight mb-4 font-bold opacity-80 uppercase tracking-tighter">
             Version {version} is ready for deployment.
          </p>
          <div className="flex gap-2">
            <button onClick={onUpdateNow} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-white text-[9px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95">Update Now</button>
            <button onClick={onUpdateLater} className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg text-slate-300 text-[9px] font-black uppercase tracking-widest transition-all">Next Login</button>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: PREPARING & DOWNLOADING ──
  if (state === 'PREPARING') {
    const currentStep = downloadProgress > 0 ? 2 : (isPreparing ? 1 : 0);
    return (
      <div className="fixed inset-0 bg-[#020617]/95 backdrop-blur-2xl z-[600] flex items-center justify-center p-6 text-center">
        <div className="w-full max-w-md">
            <div className="glass-panel rounded-[2rem] p-8 relative overflow-hidden">
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full"></div>
                
                <ProgressSteps currentStep={currentStep} />

                <div className="relative z-10 space-y-6 mt-4">
                    <div className="w-16 h-16 mx-auto relative">
                       <div className="absolute inset-0 bg-blue-600/20 rounded-[1.5rem] blur-xl animate-pulse"></div>
                       <div className="relative w-full h-full bg-slate-900 border border-blue-500/20 rounded-[1.5rem] flex items-center justify-center text-blue-400">
                          {isPreparing ? <Database size={32} className="animate-float-slow" /> : <Download size={32} className="animate-pulse" />}
                       </div>
                    </div>

                    <div className="space-y-2">
                       <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                          {downloadProgress > 0 ? `${downloadProgress}%` : isPreparing ? "Preparing" : "Connecting"}
                       </h3>
                       <p className="text-blue-400 text-[9px] font-black uppercase tracking-[0.3em] h-4">
                          {getStatusMessage(downloadProgress)}
                       </p>
                    </div>

                    <div className="space-y-3">
                       <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/5 relative">
                           <div 
                             ref={progRef1}
                             className="h-full bg-gradient-to-r from-blue-700 via-blue-500 to-indigo-500 rounded-full transition-all duration-300 relative overflow-hidden"
                           >
                               <div className="shimmer-overlay"></div>
                           </div>
                       </div>
                       <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-slate-500">
                          <span>Secure Snapshot</span>
                          <span>v{version}</span>
                       </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
  }

  // ── RENDER: READY TO INSTALL ──
  if (state === 'READY') {
    return (
      <div className="fixed inset-0 bg-[#020617]/95 backdrop-blur-2xl z-[300] flex items-center justify-center p-6 text-center">
        <div className="w-full max-w-sm">
            <div className="glass-panel rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl">
                <div className="p-8 space-y-6">
                    <div className="w-14 h-14 mx-auto bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/10">
                        <Zap size={28} className="animate-pulse" />
                    </div>
                    
                    <div className="space-y-3">
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter">System Ready</h3>
                        <div className="h-1 w-10 bg-blue-600 mx-auto rounded-full"></div>
                        <p className="text-slate-400 text-[10px] font-bold leading-relaxed px-2">
                            Deployment package <strong className="text-white">v{version}</strong> is validated. Apply now to maintain stability.
                        </p>
                    </div>

                    <div className="space-y-3 pt-2">
                        <button 
                            onClick={onUpdateNow} 
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-[0.2em] rounded-full shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 group text-[10px]"
                        >
                            Execute Upgrade
                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                        {!isMandatory && (
                            <button onClick={onUpdateLater} className="w-full py-1 text-slate-600 hover:text-white font-black uppercase tracking-widest text-[8px] transition-colors">Install next closure</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
  }

  // ── RENDER: CRITICAL PATCH (ULTRA-COMPACT PREMIUM) ──
  if (state === 'PATCH') {
    const currentStep = downloadProgress > 0 ? 2 : (isPreparing ? 1 : 0);
    return (
      <div className="fixed inset-0 bg-[#020617]/90 backdrop-blur-xl z-[5000] flex items-center justify-center p-6 text-center">
        <div className="w-full max-w-sm">
            <div className="glass-panel-amber-glow rounded-[1.5rem] relative overflow-hidden border-amber-500/30 shadow-[0_0_60px_rgba(245,158,11,0.2)]">
                
                {/* 1. ULTRA COMPACT Stepper */}
                <ProgressSteps currentStep={currentStep} theme="amber" />

                <div className="px-6 pb-6 space-y-5 relative z-10">
                    
                    {/* 2. COMPACT Branding */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-center gap-2">
                           <div className="w-5 h-5 rounded bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md">
                              <Zap size={12} strokeWidth={3} />
                           </div>
                           <h2 className="text-lg font-black text-white tracking-tighter uppercase italic leading-none">BharatPay <span className="text-amber-500">Pro</span></h2>
                        </div>
                        <p className="text-amber-500/50 text-[6px] font-black uppercase tracking-[0.4em]">Software Maintenance</p>
                    </div>

                    {/* 3. SHARP Hex-Icon */}
                    <div className="relative w-24 h-24 mx-auto">
                        <div className="absolute inset-0 bg-amber-500/10 blur-[30px] animate-pulse"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-full h-full border border-amber-500/20 rotate-45 rounded-[1rem] flex items-center justify-center shadow-inner">
                               <div className="w-[85%] h-[85%] border border-amber-500/10 -rotate-45 rounded-[0.8rem] flex items-center justify-center">
                                   <div className="w-12 h-12 bg-slate-900 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-500">
                                      <Wrench size={24} className={`${isDownloading ? "animate-spin-slow" : "animate-float-slow"}`} />
                                   </div>
                               </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Labels & Metadata */}
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <h1 className="text-xl font-black text-white leading-none tracking-tighter uppercase">Maintenance Patch</h1>
                            <p className="text-amber-500 text-[8px] font-black uppercase tracking-[0.3em]">Critical Sync Update</p>
                        </div>
                        
                        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest border-y border-white/5 py-2.5">
                            <div className="flex items-center gap-1"><Shield size={10} className="text-amber-600" /><span>v{version || '02.02.26'}</span></div>
                            <div className="w-[1px] h-2 bg-slate-800"></div>
                            <div className="flex items-center gap-1"><Hash size={10} className="text-amber-600" /><span>ID: BP-PR-881</span></div>
                            <div className="w-[1px] h-2 bg-slate-800"></div>
                            <span className="text-amber-600">CRITICAL</span>
                        </div>
                    </div>

                    {/* 5. Buttons */}
                    <div className="space-y-3">
                        <button 
                            onClick={onUpdateNow} 
                            disabled={isDownloading || isPreparing}
                            className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black uppercase tracking-[0.15em] rounded-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 group"
                        >
                            {isDownloading ? <RefreshCw className="animate-spin" size={14} /> : <Zap size={14} strokeWidth={3} />}
                            <span className="text-[12px] font-black">{isDownloading ? `Downloading ${downloadProgress}%` : "Install Now"}</span>
                        </button>

                        {!isMandatory && (
                          <button 
                              onClick={onUpdateLater} 
                              disabled={isDownloading || isPreparing}
                              className="w-full py-2.5 text-slate-500 hover:text-amber-500 font-bold uppercase tracking-[0.2em] text-[14px] border border-slate-800 hover:border-amber-500/20 rounded-lg transition-all"
                          >
                              Postpone Update
                          </button>
                        )}
                    </div>

                    {/* 6. Footer */}
                    <p className="text-[10px] text-white font-black uppercase tracking-[0.4em]">
                        Postpone <span className="text-white">{patchSkipCount} / 3</span>
                    </p>
                </div>

                {/* Mandatory Timer */}
                {isMandatory && !isDownloading && !isPreparing && (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-6 z-[100]">
                      <div className="space-y-4 w-full max-w-[200px] p-6 bg-black border border-red-500 shadow-2xl rounded-[1.5rem]">
                         <p className="text-[7px] text-red-500 font-black uppercase tracking-[0.2em]">Mandatory</p>
                         <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Launch In <span className="text-red-500 tabular-nums">{secondsLeft}s</span></h2>
                      </div>
                  </div>
                )}
            </div>
        </div>
      </div>
    );
  }

  // ── RENDER: INSTALLING ──
  if (state === 'INSTALLING') {
     return (
      <div className="fixed inset-0 bg-[#020617] z-[1000] flex items-center justify-center p-6 text-center animate-in fade-in duration-1000">
        <div className="max-w-sm w-full space-y-8">
            <div className="glass-panel rounded-[2rem] overflow-hidden border border-white/5 pb-8 shadow-2xl">
                <ProgressSteps currentStep={effectiveStep} theme="blue" />
                
                <div className="px-8 space-y-8">
                    <div className="relative mx-auto w-20 h-20 mt-4">
                        <div className={`absolute inset-0 transition-colors duration-1000 ${installStep === 6 ? 'bg-emerald-600/30' : 'bg-blue-600/30'} rounded-full blur-[40px] animate-pulse`}></div>
                        <div className={`relative w-full h-full bg-slate-900 border transition-colors duration-1000 ${effectiveStep === 6 ? 'border-emerald-500/20' : 'border-blue-500/20'} rounded-full flex items-center justify-center`}>
                            {effectiveStep === 6 ? (
                                <CheckCircle2 className="text-emerald-500 animate-in zoom-in duration-500" size={32} />
                            ) : (
                                <Loader2 className="text-blue-500 animate-spin" size={32} />
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <h2 className={`text-2xl font-black transition-colors duration-1000 ${effectiveStep === 6 ? 'text-emerald-400' : 'text-white'} uppercase tracking-tighter`}>
                             {effectiveStep === 6 ? "Update Successful" : "Finalizing"}
                        </h2>
                        <div className={`h-1 w-10 transition-colors duration-1000 ${effectiveStep === 6 ? 'bg-emerald-500' : 'bg-blue-600'} mx-auto rounded-full`}></div>
                        <p className={`text-[10px] font-bold uppercase tracking-[0.2em] leading-relaxed transition-colors duration-500 ${effectiveStep === 6 ? 'text-emerald-500' : 'text-slate-500'}`}>
                            {effectiveStep === 3 ? "Extracting Secure Pack..." :
                             effectiveStep === 4 ? "Validating Cryptographic Signatures..." :
                             effectiveStep === 5 ? "Applying Core Patch..." :
                             "Software maintenance applied successfully!"}
                        </p>
                        {effectiveStep === 6 && (
                            <div className="flex flex-col gap-1 mt-2">
                                <p className="text-white text-[12px] font-black uppercase tracking-[0.3em] animate-pulse">Restarting System</p>
                                <p className="text-emerald-500 text-[10px] font-black opacity-80 uppercase tracking-widest">In {restartCountdown} Seconds...</p>
                            </div>
                        )}
                        <div className="flex justify-center mt-2">
                            <span className={`text-[10px] font-mono tracking-widest transition-all duration-500 ${effectiveStep === 6 ? 'text-emerald-500/80 scale-110' : 'text-blue-500/40'}`}>
                                {effectiveStep === 6 ? "READY-TO-LAUNCH" : getMarqueeText()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
     );
  }

  // ── RENDER: VIOLATION ──
  if (state === 'VIOLATION') {
    return (
      <div className="fixed inset-0 bg-red-950/95 backdrop-blur-3xl z-[2000] flex items-center justify-center p-6 text-center">
        <div className="w-full max-w-sm">
            <div className="glass-panel-red rounded-[2rem] p-8 relative overflow-hidden">
                <div className="space-y-8 relative z-10">
                   <div className="w-16 h-16 mx-auto bg-slate-950 border border-red-500/40 rounded-2xl flex items-center justify-center text-red-500 shadow-lg">
                      <ShieldAlert size={32} />
                   </div>
                   <div className="space-y-2">
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter">Security Alert</h3>
                      <p className="text-red-400 text-[9px] font-black uppercase tracking-[0.2em]">Identity Mismatch</p>
                   </div>
                   <button onClick={onUpdateNow} className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest rounded-lg text-[10px] shadow-lg">Initiate Repair</button>
                   <button onClick={onClose} className="w-full py-2 text-slate-500 font-bold uppercase tracking-widest text-[8px]">Terminate</button>
                </div>
            </div>
        </div>
      </div>
    );
  }

  return null;
};

export default UpdatePortal;
