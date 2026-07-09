import React from 'react';
import { Search, FileSpreadsheet, Upload, Download, RotateCcw, Plus, Loader2 } from 'lucide-react';

interface EmployeeToolbarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    totalActive: number;
    totalActiveLabel?: string;
    limit: number;
    isImporting: boolean;
    onDownloadTemplate: () => void;
    onDownloadUpdateTemplate: () => void;
    onImportClick: () => void;
    onImportUpdateClick: () => void;
    onExportClick: () => void;
    onShowRejoin: () => void;
    onAddNew: () => void;
    showFYFilter?: boolean;
    onToggleFYFilter?: (val: boolean) => void;
    activeFinancialYear?: string;
    isLicenseExpired?: boolean;
    isReadOnly?: boolean;
}

const EmployeeToolbar: React.FC<EmployeeToolbarProps> = ({
    searchTerm,
    onSearchChange,
    totalActive,
    totalActiveLabel = "Active",
    limit,
    isImporting,
    onDownloadTemplate,
    onDownloadUpdateTemplate,
    onImportClick,
    onImportUpdateClick,
    onExportClick,
    onShowRejoin,
    onAddNew,
    showFYFilter,
    onToggleFYFilter,
    activeFinancialYear,
    isLicenseExpired,
    isReadOnly
}) => {
    return (
        <div className="space-y-2">
            {/* ACTION CARD */}
            <div className="bg-[#1e293b] p-2 rounded-2xl border border-slate-800/80 shadow-2xl flex flex-nowrap items-center justify-between gap-2 transition-all overflow-x-auto custom-scrollbar">
                <div className="flex items-center flex-nowrap gap-1">
                    {!isLicenseExpired && !isReadOnly && (
                        <div className="flex items-center gap-2 bg-[#0f172a] p-1 rounded-xl border border-slate-800">
                            <button
                                onClick={onDownloadTemplate}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/50 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all font-black text-[10px] uppercase tracking-wider"
                                title="Download blank template for new employees"
                            >
                                <FileSpreadsheet size={16} /> Template
                            </button>
                            <button
                                onClick={onDownloadUpdateTemplate}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/50 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all font-black text-[10px] uppercase tracking-wider"
                                title="Download template with existing employees to update details"
                            >
                                <FileSpreadsheet size={16} className="text-amber-500" /> Update Template
                            </button>
                            <button
                                onClick={onImportClick}
                                disabled={isImporting}
                                title="Import new employee records from an Excel template"
                                className={`flex items-center gap-1.5 px-3 py-1.5 ${isImporting ? 'bg-blue-600/50 text-blue-300 cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]'} rounded-lg transition-all font-black text-[10px] uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} 
                                Import New
                            </button>
                            <button
                                onClick={onImportUpdateClick}
                                disabled={isImporting}
                                title="Update existing employee records using the downloaded Update Template"
                                className={`flex items-center gap-1.5 px-3 py-1.5 ${isImporting ? 'bg-amber-600/50 text-amber-300 cursor-wait' : 'bg-amber-600 text-white hover:bg-amber-500 hover:shadow-[0_0_15px_rgba(245,158,11,0.5)]'} rounded-lg transition-all font-black text-[10px] uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} 
                                Import Updates
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-2 bg-[#0f172a] p-1 rounded-xl border border-slate-800">
                        <button
                            onClick={onExportClick}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-600 hover:text-white hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] rounded-lg transition-all font-black text-[10px] uppercase tracking-wider"
                        >
                            <Download size={16} /> Export
                        </button>
                    </div>
                </div>

                <div className="flex items-center flex-nowrap gap-2">
                    {!isLicenseExpired && (
                        <button
                            onClick={onShowRejoin}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl transition-all font-black text-[11px] uppercase tracking-wider border border-slate-700"
                        >
                            <RotateCcw size={16} className="text-amber-400" />
                            Rejoin
                        </button>
                    )}
                    
                    {!isLicenseExpired && isReadOnly && (
                         <div className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-950/20 text-red-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                             READ-ONLY MODE (LIMIT EXCEEDED)
                         </div>
                    )}

                    {!isLicenseExpired && !isReadOnly && (
                        <button
                            onClick={onAddNew}
                            disabled={totalActive >= limit}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed
                                ${totalActive >= limit 
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 cursor-not-allowed' 
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] shadow-lg'}`}
                        >
                            <Plus size={18} />
                            Add New
                        </button>
                    )}
                </div>
            </div>

            {/* STATUS & SEARCH BOX */}
            <div className="flex items-center justify-between gap-4 px-2">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 bg-[#0f172a]/80 border border-slate-800/60 px-4 py-2 rounded-full shadow-inner backdrop-blur-md shrink-0">
                        <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
                            {totalActiveLabel}: <span className="text-white ml-1 font-bold">{totalActive}</span>
                            <span className="mx-2 text-slate-700">/</span>
                            Limit: <span className="text-sky-400 font-bold">{limit}</span>
                        </span>
                    </div>

                    {showFYFilter !== undefined && activeFinancialYear && (
                        <div className="hidden md:flex items-center bg-[#0f172a]/80 border border-slate-800/60 px-3 py-2 rounded-full shadow-inner backdrop-blur-md shrink-0 transition-colors hover:border-slate-700/80">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={showFYFilter} 
                                    onChange={e => onToggleFYFilter?.(e.target.checked)} 
                                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer"
                                />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 select-none">
                                    {activeFinancialYear} Only
                                </span>
                            </label>
                        </div>
                    )}
                </div>

                <div className="relative flex-1 max-w-[400px] group lg:block hidden">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder="Search by Name, ID, UAN or ESI..."
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
