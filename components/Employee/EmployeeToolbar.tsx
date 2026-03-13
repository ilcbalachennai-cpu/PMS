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
        <div className="space-y-6">
            <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="relative w-full xl:w-96 shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search Master Records..."
                        title="Search Master Records"
                        aria-label="Search Master Records"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#0f172a] border border-slate-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
                <div className="flex items-center flex-wrap gap-2 xl:justify-end">
                    <button
                        onClick={onDownloadTemplate}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 rounded-lg transition-all font-bold text-xs"
                        title="Download Excel Template"
                        aria-label="Download Excel Template"
                    >
                        <FileSpreadsheet size={16} /> Template
                    </button>
                    <button
                        onClick={onImportClick}
                        disabled={isImporting}
                        className="flex items-center gap-2 px-3 py-2 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 border border-emerald-600/30 rounded-lg transition-all font-bold text-xs"
                        title="Bulk Import via Excel"
                        aria-label="Bulk Import via Excel"
                    >
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Import
                    </button>

                    <div className="w-[1px] h-6 bg-slate-700 mx-1 hidden md:block"></div>

                    <button
                        onClick={onExportClick}
                        title="Export Records"
                        aria-label="Export Records"
                        className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 rounded-lg transition-all font-bold text-xs"
                    >
                        <Download size={16} /> Export
                    </button>
                    <button
                        onClick={onShowRejoin}
                        title="Rejoin Management"
                        aria-label="Rejoin Management"
                        className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 rounded-lg transition-all font-bold text-xs"
                    >
                        <RotateCcw size={16} /> Rejoin
                    </button>
                    <button
                        onClick={onAddNew}
                        title="Add New Employee"
                        aria-label="Add New Employee"
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-shadow shadow-lg font-bold"
                    >
                        <Plus size={18} /> Add New
                    </button>
                </div>
            </div>

            <div className="flex justify-start px-2 -my-3">
                <div className="flex items-center gap-2 bg-[#1e293b]/80 border border-slate-800 px-4 py-1.5 rounded-full shadow-lg z-0 backdrop-blur-sm">
                    <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Active Employees: <span className="text-white text-xs ml-1 font-mono">{totalActive}</span>
                        <span className="mx-2 text-slate-600">/</span>
                        Limit: <span className="text-sky-400 text-xs font-mono">{limit}</span>
                    </span>
                </div>
            </div>
        </div>
    );
};

export default EmployeeToolbar;
