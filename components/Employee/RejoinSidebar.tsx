import React from 'react';
import { RotateCcw, X, Search, Edit2 } from 'lucide-react';
import { Employee } from '../../types';
import { formatDateInd } from '../../services/reportService';

interface RejoinSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    filteredExEmployees: Employee[];
    onInitiateRejoin: (emp: Employee) => void;
}

const RejoinSidebar: React.FC<RejoinSidebarProps> = ({
    isOpen,
    onClose,
    searchTerm,
    onSearchChange,
    filteredExEmployees,
    onInitiateRejoin
}) => {
    return (
        <div className={`fixed inset-y-0 right-0 w-96 bg-[#1e293b] border-l border-slate-700 shadow-2xl transform transition-transform duration-300 z-40 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-[#0f172a]">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-900/30 rounded text-amber-400"><RotateCcw size={20} /></div>
                    <h3 className="font-bold text-white text-sm">Rejoin Ex-Employee</h3>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4 bg-[#0f172a] border-b border-slate-800">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search Ex-Employees..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-amber-500"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filteredExEmployees.length === 0 ? (
                    <div className="text-center text-slate-500 text-xs py-10">No ex-employees found matching criteria.</div>
                ) : (
                    filteredExEmployees.map(emp => (
                        <div key={emp.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 hover:border-amber-500/50 transition-all group">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-bold text-white text-sm">{emp.name}</h4>
                                    <p className="text-[10px] text-slate-400 font-mono">{emp.id}</p>
                                </div>
                                <span className="text-[9px] font-black text-red-400 bg-red-900/20 px-2 py-1 rounded border border-red-900/30">LEFT: {formatDateInd(emp.dol)}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 line-clamp-1 mb-3">{emp.leavingReason || 'No reason specified'}</p>
                            <button
                                onClick={() => onInitiateRejoin(emp)}
                                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <Edit2 size={12} /> Rejoin / Edit Profile
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default RejoinSidebar;
