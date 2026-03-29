import React from 'react';
import { Download, X, FileSpreadsheet, FileText, Filter, CheckSquare, Square, KeyRound } from 'lucide-react';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    exportConfig: {
        format: 'Excel' | 'PDF';
        selectedColumns: string[];
        password: string;
        error: string;
    };
    onConfigChange: (config: any) => void;
    availableColumns: { key: string, label: string }[];
    onToggleColumn: (key: string) => void;
    onToggleAll: () => void;
    onSubmit: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({
    isOpen,
    onClose,
    exportConfig,
    onConfigChange,
    availableColumns,
    onToggleColumn,
    onToggleAll,
    onSubmit
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-3xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-[#0f172a]">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Download size={20} className="text-blue-400" /> Secure Data Export
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">Configure your master record export parameters.</p>
                    </div>
                    <button onClick={onClose} title="Close Export Modal" aria-label="Close Export Modal" className="text-slate-400 hover:text-white"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Format</label>
                            <div className="flex gap-2">
                                <button onClick={() => onConfigChange({ ...exportConfig, format: 'Excel' })} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-2 ${exportConfig.format === 'Excel' ? 'bg-emerald-900/40 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-50'}`}><FileSpreadsheet size={14} /> Excel</button>
                                <button onClick={() => onConfigChange({ ...exportConfig, format: 'PDF' })} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-2 ${exportConfig.format === 'PDF' ? 'bg-blue-900/40 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-50'}`}><FileText size={14} /> PDF</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Filter size={12} /> Select Columns</label>
                            <button onClick={onToggleAll} className="text-[10px] font-bold text-blue-400 hover:text-blue-300">
                                {exportConfig.selectedColumns.length === availableColumns.length ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {availableColumns.map(col => (
                                <button
                                    key={col.key}
                                    onClick={() => onToggleColumn(col.key)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left ${exportConfig.selectedColumns.includes(col.key) ? 'bg-blue-900/20 border-blue-500/50 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                                >
                                    {exportConfig.selectedColumns.includes(col.key) ? <CheckSquare size={14} className="text-blue-400 shrink-0" /> : <Square size={14} className="text-slate-600 shrink-0" />}
                                    <span className="truncate">{col.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-3">
                        <div className="flex items-center gap-2 text-xs text-slate-400"><KeyRound size={14} /> Security Verification</div>
                        <div className="flex items-stretch gap-2">
                            <input
                                type="password"
                                placeholder="Enter Developer/Admin Password"
                                className={`w-full bg-[#0f172a] border ${exportConfig.error ? 'border-red-500 font-mono' : 'border-slate-700 font-mono'} rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm h-full`}
                                value={exportConfig.password}
                                onChange={(e) => onConfigChange({ ...exportConfig, password: e.target.value, error: '' })}
                                onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                            />
                            <button
                                onClick={onSubmit}
                                className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-6 border border-slate-700 rounded-lg transition-all text-sm whitespace-nowrap h-full min-h-[42px]"
                            >
                                Submit
                            </button>
                        </div>
                        {exportConfig.error && <p className="text-[10px] text-red-400 font-bold animate-pulse">{exportConfig.error}</p>}
                    </div>
                </div>

                <div className="p-6 bg-[#1e293b] border-t border-slate-800">
                    <button onClick={onSubmit} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/20 transition-all text-sm flex items-center justify-center gap-2">
                        SECURE DOWNLOAD ({exportConfig.selectedColumns.length} cols)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportModal;
