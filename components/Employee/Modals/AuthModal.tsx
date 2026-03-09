import React from 'react';
import { ShieldAlert, KeyRound, X, Loader2 } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    password: string;
    onPasswordChange: (val: string) => void;
    error: string;
    onSubmit: () => void;
    title?: string;
    description?: string;
}

const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    password,
    onPasswordChange,
    error,
    onSubmit,
    title = "Identity Verification Required",
    description = "Please enter your administrative access key to proceed with this restricted action."
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 bg-[#0f172a] border-b border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <ShieldAlert size={20} className="text-amber-400" /> {title}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
                </div>
                <div className="p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
                            <KeyRound size={32} className="text-amber-400" />
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Admin Password</label>
                            <input
                                autoFocus
                                type="password"
                                placeholder="••••••••"
                                className={`w-full bg-[#0f172a] border ${error ? 'border-red-500 shadow-lg shadow-red-900/20' : 'border-slate-700'} rounded-xl px-4 py-3.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono`}
                                value={password}
                                onChange={(e) => onPasswordChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                            />
                            {error && <p className="text-[10px] text-red-400 font-bold mt-2 animate-pulse flex items-center gap-1"><ShieldAlert size={10} /> {error}</p>}
                        </div>
                        <button
                            onClick={onSubmit}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            VERIFY & PROCEED
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
