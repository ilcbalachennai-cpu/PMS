
import React, { useState } from 'react';
import {
    FolderPlus,
    HardDrive,
    ArrowRight,
    CheckCircle2,
    Loader2,
    ShieldCheck,
    IndianRupee,
    AlertCircle
} from 'lucide-react';

interface AppSetupProps {
    onComplete: () => void;
}

const AppSetup: React.FC<AppSetupProps> = ({ onComplete }) => {
    const [selectedPath, setSelectedPath] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const handleSelectFolder = async () => {
        setError('');
        // @ts-ignore
        if (!window.electronAPI) {
            setError('This feature requires the Electron environment.');
            return;
        }

        try {
            // @ts-ignore
            const result = await window.electronAPI.selectAppDirectory();
            if (result.success && result.path) {
                setSelectedPath(result.path);
            } else if (!result.canceled) {
                setError(result.error || 'Failed to select folder.');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        }
    };

    const handleInitialize = async () => {
        if (!selectedPath) return;

        setIsProcessing(true);
        setError('');

        try {
            // @ts-ignore
            const result = await window.electronAPI.initializeAppDirectory(selectedPath);
            if (result.success) {
                // Short delay for visual feedback
                setTimeout(() => {
                    onComplete();
                }, 1000);
            } else {
                setError(result.error || 'Failed to initialize application directory.');
                setIsProcessing(false);
            }
        } catch (err: any) {
            setError(err.message || 'Initialization failed.');
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-500">
                {/* Logo & Branding */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-600 shadow-xl shadow-blue-900/40 mb-2">
                        <IndianRupee size={40} className="text-[#FF9933]" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white">
                        <span className="text-[#FF9933]">Bharat</span>Pay<span className="text-[#4ADE80]">Pro</span>
                    </h1>
                    <p className="text-slate-400 text-sm font-medium tracking-wide border-t border-slate-800 pt-4 mx-auto max-w-[200px]">
                        STORAGE CONFIGURATION
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#FF9933] via-white to-[#138808] opacity-50" />

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <HardDrive className="text-blue-400" size={24} />
                                Select Workspace
                            </h2>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Choose where BharatPayPro will store your databases, generated reports, and encrypted backups.
                            </p>
                        </div>

                        {/* Folder Selection Box */}
                        <div
                            className={`p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${selectedPath
                                    ? 'bg-emerald-500/5 border-emerald-500/50 shadow-inner'
                                    : 'bg-slate-900/50 border-slate-800 hover:border-blue-500/50 hover:bg-slate-900'
                                }`}
                            onClick={handleSelectFolder}
                        >
                            {selectedPath ? (
                                <>
                                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Selected Location</p>
                                        <p className="text-xs text-slate-200 font-mono break-all px-2 line-clamp-2">{selectedPath}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                        <FolderPlus size={32} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-slate-300">Browse for Folder</p>
                                        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Storage path will be initialized here</p>
                                    </div>
                                </>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                                <AlertCircle className="text-red-500 shrink-0" size={18} />
                                <span className="text-xs text-red-400 font-medium">{error}</span>
                            </div>
                        )}

                        {/* Action Bar */}
                        <div className="space-y-4 pt-2">
                            <button
                                disabled={!selectedPath || isProcessing}
                                onClick={handleInitialize}
                                className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-xl transition-all ${!selectedPath || isProcessing
                                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:scale-[1.02] active:scale-95 shadow-blue-900/20'
                                    }`}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        Initializing BharatPP...
                                    </>
                                ) : (
                                    <>
                                        Initialize Application
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>

                            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                <ShieldCheck size={14} className="text-emerald-500" />
                                Automated Folder Structure Creation
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Footer */}
                <div className="bg-slate-900/30 rounded-2xl p-4 border border-slate-800/50">
                    <div className="flex gap-4">
                        <div className="p-2 bg-blue-500/10 rounded flex-shrink-0">
                            <AlertCircle size={16} className="text-blue-400" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Setup Note</p>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                A directory named <span className="text-blue-400 font-bold">BharatPP</span> will be created at the selected location with subfolders for <span className="text-white">Data</span>, <span className="text-white">Reports</span>, and <span className="text-white">Backups</span>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppSetup;
