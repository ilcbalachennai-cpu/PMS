import React, { useEffect, useState, useRef } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle, Loader2, FolderOpen } from 'lucide-react';

export type ModalType = 'success' | 'error' | 'info' | 'warning' | 'confirm' | 'danger' | 'loading';

interface CustomModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    onSecondaryConfirm?: () => void;
    type: ModalType;
    title: string;
    message: string | React.ReactNode;
    confirmLabel?: string;
    secondaryConfirmLabel?: string;
    cancelLabel?: string;
    autoCloseSecs?: number;
}

const CustomModal: React.FC<CustomModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    onSecondaryConfirm,
    type,
    title,
    message,
    confirmLabel = 'OK',
    secondaryConfirmLabel,
    cancelLabel = 'Cancel',
    autoCloseSecs
}) => {
    const [progress, setProgress] = useState(100);
    const progressBarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (progressBarRef.current) {
            progressBarRef.current.style.width = `${progress}%`;
        }
    }, [progress]);

    useEffect(() => {
        if (!isOpen || type !== 'success' || !autoCloseSecs) {
            setProgress(100);
            return;
        }

        const totalMs = autoCloseSecs * 1000;
        const intervalMs = 50;
        const step = (intervalMs / totalMs) * 100;

        setProgress(100);
        const timer = setInterval(() => {
            setProgress(prev => {
                const next = prev - step;
                if (next <= 0) {
                    clearInterval(timer);
                    // Fire onConfirm (open folder/preview) then close
                    setTimeout(() => {
                        onClose();
                        if (onConfirm) onConfirm();
                    }, 60);
                    return 0;
                }
                return next;
            });
        }, intervalMs);

        return () => clearInterval(timer);
    }, [isOpen, type, autoCloseSecs]);

    if (!isOpen) return null;

    const getTypeStyles = () => {
        switch (type) {
            case 'success':
                return {
                    icon: <CheckCircle2 className="text-emerald-400" size={32} />,
                    border: 'border-emerald-500/50',
                    bg: 'bg-emerald-900/20',
                    button: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20'
                };
            case 'error':
                return {
                    icon: <AlertCircle className="text-red-400" size={32} />,
                    border: 'border-red-500/50',
                    bg: 'bg-red-900/20',
                    button: 'bg-red-600 hover:bg-red-700 shadow-red-900/20'
                };
            case 'warning':
                return {
                    icon: <AlertTriangle className="text-amber-400" size={32} />,
                    border: 'border-amber-500/50',
                    bg: 'bg-amber-900/20',
                    button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/20'
                };
            case 'confirm':
                return {
                    icon: <AlertTriangle className="text-blue-400" size={32} />,
                    border: 'border-blue-500/50',
                    bg: 'bg-blue-900/20',
                    button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/20'
                };
            case 'danger':
                return {
                    icon: <AlertTriangle className="text-red-400" size={32} />,
                    border: 'border-red-500/50',
                    bg: 'bg-red-900/20',
                    button: 'bg-red-600 hover:bg-red-700 shadow-red-900/20'
                };
            case 'loading':
                return {
                    icon: <Loader2 className="text-blue-400 animate-spin" size={32} />,
                    border: 'border-blue-500/30',
                    bg: 'bg-blue-900/10',
                    button: ''
                };
            default:
                return {
                    icon: <Info className="text-blue-400" size={32} />,
                    border: 'border-blue-500/50',
                    bg: 'bg-blue-900/20',
                    button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/20'
                };
        }
    };

    const styles = getTypeStyles();

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className={`bg-[#1e293b] w-full max-w-sm rounded-2xl border ${styles.border} shadow-2xl p-0 flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-200`}>
                <div className={`${styles.bg} p-6 pb-4 border-b ${styles.border} flex flex-col items-center text-center gap-4`}>
                    <div className="p-3 rounded-full bg-slate-900/50 border border-slate-800 shadow-inner">
                        {styles.icon}
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">{title}</h3>
                        <div className="h-0.5 w-12 bg-white/10 mx-auto mt-2 rounded-full" />
                    </div>
                </div>

                <div className="p-8 bg-slate-900/20">
                    <div className="text-sm text-slate-300 leading-relaxed text-center font-medium">
                        {message}
                    </div>
                </div>

                {type === 'success' && autoCloseSecs && (
                    <div className="px-6 pt-2 pb-1">
                        <div className="w-full h-1 bg-slate-700/60 rounded-full overflow-hidden">
                            <div
                                ref={progressBarRef}
                                className="h-full bg-emerald-500 rounded-full transition-none"
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 text-center mt-1 font-medium tracking-wider">
                            Opening report & folder in {Math.ceil(progress / 100 * autoCloseSecs)}s…
                        </p>
                    </div>
                )}

                {type !== 'loading' && (
                    <div className="p-4 bg-[#1e293b] border-t border-slate-700/50 flex gap-3">
                        {(type === 'confirm' || type === 'danger') && (
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 text-sm"
                            >
                                {cancelLabel}
                            </button>
                        )}
                        {onSecondaryConfirm && secondaryConfirmLabel && (
                            <button
                                onClick={() => {
                                    onClose();
                                    onSecondaryConfirm();
                                }}
                                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 text-sm"
                            >
                                {secondaryConfirmLabel}
                            </button>
                        )}
                        <button
                            onClick={() => {
                                onClose();
                                if (onConfirm) onConfirm();
                            }}
                            className={`flex-1 px-4 py-2.5 ${styles.button} text-white font-black uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 text-xs flex items-center justify-center gap-2`}
                        >
                            {type === 'success' && <FolderOpen size={14} />}
                            {confirmLabel}
                        </button>
                    </div>
                )}

                {(type !== 'confirm' && type !== 'danger' && type !== 'loading') && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                        title="Close"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default CustomModal;
