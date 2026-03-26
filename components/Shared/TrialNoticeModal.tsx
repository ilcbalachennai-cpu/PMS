import React, { useState } from 'react';
import { ShieldAlert, IndianRupee, ArrowRight, Mail, X, Lock, Info, Loader2 } from 'lucide-react';

interface TrialNoticeModalProps {
    expiryDate: string;
    pricing?: string;
    employeeCount: number;
    onClose: () => void;
}

const TrialNoticeModal: React.FC<TrialNoticeModalProps> = ({ expiryDate, pricing, employeeCount, onClose }) => {
    const [view, setView] = useState<'notice' | 'pricing'>('notice');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);

    const calculateDaysLeft = () => {
        try {
            const [d, m, y] = expiryDate.split('-');
            const expiry = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59);
            const diff = expiry.getTime() - new Date().getTime();
            return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        } catch (e) {
            return 0;
        }
    };

    const daysLeft = calculateDaysLeft();

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-500">
            <div className="bg-[#1e293b] w-full max-w-lg rounded-[2.5rem] border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 relative">
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    title="Close Notice"
                    className="absolute top-6 right-6 p-2 bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-all z-10"
                >
                    <X size={20} />
                </button>

                <div className="p-10 space-y-8">
                    {view === 'notice' ? (
                        <div className="space-y-8 text-center">
                            <div className="w-20 h-20 bg-amber-500/20 rounded-3xl flex items-center justify-center mx-auto text-amber-500 animate-bounce-slow">
                                <ShieldAlert size={40} />
                            </div>
                            
                            <div className="space-y-3">
                                <h3 className="text-2xl font-black text-white italic tracking-tight uppercase">Trial Period Active</h3>
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
                                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Version: Evaluation Trial</span>
                                </div>
                            </div>

                            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 space-y-2">
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest leading-relaxed">
                                    This is a Trial Version and Would Expire in 
                                </p>
                                <div className="text-5xl font-black text-white tracking-tighter flex items-center justify-center gap-3">
                                    {daysLeft}
                                    <span className="text-xl text-slate-500 italic">Days</span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-4">
                                    Valid until {expiryDate}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <button 
                                    onClick={() => setView('pricing')}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 group"
                                >
                                    Go for Licence
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                                <button 
                                    onClick={onClose}
                                    className="text-slate-500 hover:text-slate-300 text-[10px] font-black uppercase tracking-widest transition-colors"
                                >
                                    Continue in Trial Mode
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
                                    <IndianRupee size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white italic leading-none">Licence Fee</h3>
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Pricing Information</p>
                                </div>
                            </div>

                            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-4 md:p-8 min-h-[160px] flex items-center justify-center overflow-hidden">
                                {pricing ? (
                                    (() => {
                                        try {
                                            // 1. Try to parse as JSON (for array data)
                                            const data = typeof pricing === 'string' && (pricing.startsWith('[') || pricing.startsWith('{')) 
                                                ? JSON.parse(pricing) 
                                                : pricing;

                                            if (Array.isArray(data) && data.length > 0) {
                                                const hasHeaders = Array.isArray(data[0]);
                                                return (
                                                    <div className="w-full overflow-x-auto custom-scrollbar-horizontal rounded-2xl border border-slate-700/50 bg-slate-950/30">
                                                        <table className="w-full text-left border-collapse min-w-[800px]">
                                                            <thead>
                                                                <tr className="border-b border-slate-700 bg-slate-800/80 sticky top-0 z-10">
                                                                    {hasHeaders ? (
                                                                        data[0].map((cell: any, i: number) => (
                                                                            <th key={i} className="p-4 text-[10px] font-black text-blue-400 uppercase tracking-widest whitespace-nowrap bg-slate-800 shadow-[0_1px_0_rgba(255,255,255,0.05)]">
                                                                                {cell}
                                                                            </th>
                                                                        ))
                                                                    ) : (
                                                                        Object.keys(data[0]).map((key, i) => (
                                                                            <th key={i} className="p-4 text-[10px] font-black text-blue-400 uppercase tracking-widest whitespace-nowrap bg-slate-800 shadow-[0_1px_0_rgba(255,255,255,0.05)]">
                                                                                {key}
                                                                            </th>
                                                                        ))
                                                                    )}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-800/50">
                                                                {(hasHeaders ? data.slice(1) : data).map((row: any, rowIndex: number) => (
                                                                    <tr key={rowIndex} className="hover:bg-blue-500/5 transition-all group">
                                                                        {hasHeaders && Array.isArray(row) ? (
                                                                            row.map((cell: any, cellIndex: number) => (
                                                                                <td key={cellIndex} className="p-4 text-xs text-slate-300 font-bold whitespace-nowrap group-hover:text-blue-200">
                                                                                    {cell}
                                                                                </td>
                                                                            ))
                                                                        ) : (
                                                                            Object.values(row).map((cell: any, cellIndex: number) => (
                                                                                <td key={cellIndex} className="p-4 text-xs text-slate-300 font-bold whitespace-nowrap group-hover:text-blue-200">
                                                                                    {cell}
                                                                                </td>
                                                                            ))
                                                                        )}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                );
                                            }
                                        } catch (e) {
                                            console.warn("Pricing parse error:", e);
                                        }

                                        // 2. Fallback to pre-formatted text
                                        return (
                                            <pre className="text-slate-200 font-black text-sm whitespace-pre-wrap leading-relaxed text-center font-sans tracking-wide">
                                                {typeof pricing === 'string' ? pricing : JSON.stringify(pricing, null, 2)}
                                            </pre>
                                        );
                                    })()
                                ) : (
                                    <div className="text-center space-y-4">
                                        <div className="relative">
                                            {isSyncing ? (
                                                <Loader2 className="mx-auto text-blue-500 animate-spin relative z-10" size={40} />
                                            ) : (
                                                <Info className="mx-auto text-blue-500 animate-pulse relative z-10" size={40} />
                                            )}
                                            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full scale-150 animate-pulse"></div>
                                        </div>
                                        <div className="space-y-3">
                                            <p className="text-slate-200 text-sm font-black italic uppercase tracking-widest">
                                                {syncSuccess ? 'Sync Successful!' : 'Pricing Sync in Progress'}
                                            </p>
                                            <p className="text-slate-500 text-[10px] font-medium leading-relaxed max-w-xs mx-auto">
                                                {syncSuccess 
                                                    ? 'Your pricing has been updated. The application will reload automatically...' 
                                                    : 'Your custom pricing is being fetched from the Google Sheet. This usually takes a few seconds.'}
                                            </p>
                                            {!syncSuccess && (
                                                <div className="pt-2">
                                                    <button 
                                                        disabled={isSyncing}
                                                        onClick={async () => {
                                                            setIsSyncing(true);
                                                            try {
                                                                const { syncLicenseStatus } = await import('../../services/licenseService');
                                                                const success = await syncLicenseStatus();
                                                                if (success) {
                                                                    setSyncSuccess(true);
                                                                    setTimeout(() => window.location.reload(), 2000);
                                                                } else {
                                                                    alert("Sync Failed. Please check your internet connection.");
                                                                }
                                                            } catch (e) {
                                                                console.error("Sync Error:", e);
                                                            } finally {
                                                                setIsSyncing(false);
                                                            }
                                                        }}
                                                        className={`px-6 py-2.5 bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-400 hover:text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        {isSyncing ? 'Syncing...' : 'Sync Now'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footnote */}
                            <div className="flex items-center gap-2 px-6 py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl animate-pulse">
                                <Info size={14} className="text-amber-500 shrink-0" />
                                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic">
                                    Note: License Fee is Valid for 1 Year
                                </p>
                            </div>

                            <div className="bg-blue-900/20 border border-blue-500/30 rounded-3xl p-6 space-y-4">
                                <div className="flex items-center gap-3 text-blue-400">
                                    <Mail size={18} />
                                    <span className="text-[10px] font-black uppercase tracking-[0.15em]">Licence Request</span>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm font-black text-white italic">Write to ilcbalaBharatPayRoll@gmail.com</p>
                                    <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
                                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                                            <span className="text-slate-500 font-black uppercase tracking-tighter mr-2">Subject:</span>
                                            Require Licence for {employeeCount} employees
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={() => setView('notice')}
                                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all"
                            >
                                Back to Expiry Status
                            </button>
                        </div>
                    )}
                </div>

                <div className="bg-slate-900/50 p-4 border-t border-slate-800 flex items-center justify-center gap-3">
                    <Lock size={14} className="text-amber-500" />
                    <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.3em] italic">
                        Secured by BharatPay Pro Protection System
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TrialNoticeModal;
