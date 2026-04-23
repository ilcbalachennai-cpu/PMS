import React, { Component, ErrorInfo, ReactNode, useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Download, Loader2, Wrench } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isHangDetected: boolean;
}

/**
 * GLOBAL RESCUE UI
 * 1. Error Boundary: Catches React rendering crashes.
 * 2. Watchdog: Catches initialization hangs (> 15 seconds).
 */
export default class GlobalRescueUI extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isHangDetected: false
  };

  private hangTimer: NodeJS.Timeout | null = null;

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isHangDetected: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🔥 CRITICAL RENDER ERROR:', error, errorInfo);
  }

  componentDidMount() {
    // Start Initialization Watchdog
    // If signalApplicationReady() isn't called within 15s, show Rescue UI
    this.hangTimer = setTimeout(() => {
      if (!this.state.hasError) {
        this.setState({ isHangDetected: true });
      }
    }, 15000);

    // Listen for readiness signal from App.tsx
    window.addEventListener('BPP_INIT_SUCCESS', () => {
      if (this.hangTimer) {
        clearTimeout(this.hangTimer);
        this.hangTimer = null;
      }
    });
  }

  componentWillUnmount() {
    if (this.hangTimer) clearTimeout(this.hangTimer);
  }

  handleRestart = () => {
    // @ts-ignore
    if (window.electronAPI && window.electronAPI.relaunchApp) {
      // @ts-ignore
      window.electronAPI.relaunchApp();
    } else {
      window.location.reload();
    }
  };

  handleRepair = () => {
      // 🚀 Prioritize D2 (Launch_APP) as it handles OS detection automatically
      const launcherUrl = localStorage.getItem('app_launcher_url');
      const standardUrl = localStorage.getItem('app_download_url');
      const url = launcherUrl || standardUrl || 'https://github.com/ILCBala';
      
      // @ts-ignore
      if (window.electronAPI && window.electronAPI.openExternal) {
          // @ts-ignore
          window.electronAPI.openExternal(url);
      } else {
          window.open(url, '_blank');
      }
  };

  public render() {
    if (this.state.hasError || this.state.isHangDetected) {
      return (
        <div className="fixed inset-0 z-[9999] bg-[#020617] flex items-center justify-center p-6 font-sans">
          <div className="max-w-xl w-full bg-[#0a0f1d] border border-white/10 rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] -mr-32 -mt-32 rounded-full"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-600/10 blur-[100px] -ml-32 -mb-32 rounded-full"></div>

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className={`p-4 rounded-2xl ${this.state.hasError ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'}`}>
                  {this.state.hasError ? <ShieldAlert size={32} /> : <Wrench size={32} />}
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight uppercase">System Recovery Active</h1>
                  <p className="text-slate-400 text-sm font-medium">
                    {this.state.hasError ? 'Software fault detected' : 'Initialization hang detected'}
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-10">
                <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
                  <p className="text-slate-200 text-sm leading-relaxed font-semibold">
                    {this.state.hasError 
                      ? "BharatPay Pro encountered a critical error while rendering the interface. This may be due to temporary memory corruption or missing local files."
                      : "The system is taking longer than usual to initialize. This could be due to a slow internet connection or a conflict in the local database structure."}
                  </p>
                </div>

                <div className="flex items-center gap-3 px-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Available Recovery Paths</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={this.handleRestart}
                  className="w-full flex items-center justify-between group bg-blue-600 hover:bg-blue-500 text-white rounded-2xl p-5 transition-all shadow-lg shadow-blue-900/20"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-white/10 p-2 rounded-xl group-hover:rotate-180 transition-transform duration-500">
                      <RefreshCw size={20} />
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-black uppercase">Re-Start Application</span>
                      <span className="block text-[10px] opacity-70">Attempt immediate system relaunch</span>
                    </div>
                  </div>
                  <Download className="opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all" size={20} />
                </button>

                <button
                  onClick={this.handleRepair}
                  className="w-full flex items-center justify-between group bg-white/5 hover:bg-white/10 border border-white/5 text-white rounded-2xl p-5 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-800 p-2 rounded-xl text-slate-300">
                      <Download size={20} />
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-black uppercase">Prepare System Repair</span>
                      <span className="block text-[10px] text-slate-500">Download and Re-Install latest stable version</span>
                    </div>
                  </div>
                </button>
              </div>

              {this.state.hasError && (
                <div className="mt-8 pt-6 border-t border-white/5">
                  <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest block mb-2">Technical Insight</span>
                  <div className="bg-black/40 rounded-xl p-3 max-h-24 overflow-auto scrollbar-hide text-[10px] font-mono text-rose-400/60 leading-tight">
                    {this.state.error?.stack || this.state.error?.message}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HELPER: Use this to signal that the app has finished loading
 */
export const signalApplicationReady = () => {
    window.dispatchEvent(new CustomEvent('BPP_INIT_SUCCESS'));
};
