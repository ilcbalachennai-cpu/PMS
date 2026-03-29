import React from 'react';
import { Search, FileSpreadsheet, Upload, Download, RotateCcw, Plus, Loader2 } from 'lucide-react';

interface EmployeeToolbarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    totalActive: number;
    limit: number;
    isImporting: boolean;
    onDownloadTemplate: () => void;
    onImportClick: () => void;
    onExportClick: () => void;
    onShowRejoin: () => void;
    onAddNew: () => void;
}

const EmployeeToolbar: React.FC<EmployeeToolbarProps> = ({
    searchTerm,
    onSearchChange,
    totalActive,
    limit,
    isImporting,
    onDownloadTemplate,
    onImportClick,
    onExportClick,
    onShowRejoin,
    onAddNew
}) => {
    return (
        <div className="space-y-2">
            {/* ACTION CARD */}
            <div className="bg-[#1e293b] p-3 rounded-2xl border border-slate-800/80 shadow-2xl flex flex-wrap items-center justify-between gap-4 transition-all">
                <div className="flex items-center flex-wrap gap-2">
                    <div className="flex items-center gap-2 bg-[#0f172a] p-1 rounded-xl border border-slate-800">
                        <button
                            onClick={onDownloadTemplate}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all font-black text-[10px] uppercase tracking-wider"
                        >
                            <FileSpreadsheet size={16} /> Template
                        </button>
                        <button
                            onClick={onImportClick}
                            disabled={isImporting}
                            className="flex items-center gap-2 px-3 py-2 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 rounded-lg transition-all font-black text-[10px] uppercase tracking-wider border border-emerald-500/10"
                        >
                            {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} className="text-emerald-500" />} Import
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-[#0f172a] p-1 rounded-xl border border-slate-800">
                        <button
                            onClick={onExportClick}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all font-black text-[10px] uppercase tracking-wider"
                        >
                            <Download size={16} /> Export
                        </button>
                        <button
                            onClick={onShowRejoin}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all font-black text-[10px] uppercase tracking-wider"
                        >
                            <RotateCcw size={16} /> Rejoin
                        </button>
                    </div>
                </div>

                <button
                    onClick={onAddNew}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] font-black uppercase tracking-widest text-[11px] group"
                >
                    <Plus size={18} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" /> 
                    Add New
                </button>
            </div>

            {/* STATUS & SEARCH BOX */}
            <div className="flex items-center justify-between gap-4 px-2">
                <div className="flex items-center gap-3 bg-[#0f172a]/80 border border-slate-800/60 px-4 py-2 rounded-full shadow-inner backdrop-blur-md shrink-0">
                    <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
                        Active: <span className="text-white ml-1 font-bold">{totalActive}</span>
                        <span className="mx-2 text-slate-700">/</span>
                        Limit: <span className="text-sky-400 font-bold">{limit}</span>
                    </span>
                </div>

                <div className="relative flex-1 max-w-[400px] group lg:block hidden">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder="Search Master Records..."
                        className="w-full pl-10 pr-4 py-2 bg-[#0f172a] border border-slate-800 rounded-full text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-blue-500/50 transition-all shadow-lg text-[13px] font-medium"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
                
                {/* Mobile/Tablet Search Icon (Visible when wide search is hidden) */}
                <div className="lg:hidden relative">
                     <button 
                        title="Search"
                        aria-label="Search"
                        className="p-2 bg-[#0f172a] border border-slate-800 rounded-full text-slate-400"
                     >
                        <Search size={16} />
                     </button>
                </div>
            </div>
        </div>
    );
};

export default EmployeeToolbar;
