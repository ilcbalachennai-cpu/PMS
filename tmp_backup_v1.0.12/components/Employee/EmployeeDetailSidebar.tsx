import React from 'react';
import { User2, Edit2, Briefcase } from 'lucide-react';
import { Employee } from '../../types';
import { formatDateInd } from '../../services/reportService';

interface EmployeeDetailSidebarProps {
    selectedEmp: Employee | null;
    onEdit: (emp: Employee) => void;
}

const EmployeeDetailSidebar: React.FC<EmployeeDetailSidebarProps> = ({
    selectedEmp,
    onEdit
}) => {
    if (!selectedEmp) {
        return (
            <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-6 shadow-xl h-fit sticky top-24">
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 italic">
                    <Briefcase size={48} className="mb-4 opacity-10" />
                    <p>Select a member record</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-6 shadow-xl h-fit sticky top-24">
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col items-center text-center relative">
                    {selectedEmp.dol && (
                        <div className="absolute top-0 right-0 bg-red-900 text-red-100 text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest border border-red-500/50">
                            Ex-Employee
                        </div>
                    )}
                    <div className="w-24 h-24 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 border-2 border-slate-700 shadow-xl overflow-hidden">
                        {selectedEmp.photoUrl ? (
                            <img src={selectedEmp.photoUrl} className="w-full h-full object-cover" alt={selectedEmp.name} />
                        ) : (
                            <User2 size={48} className="text-slate-500" />
                        )}
                    </div>
                    <h3 className="text-2xl font-black">{selectedEmp.name}</h3>
                    <p className="text-blue-400 text-xs font-bold uppercase tracking-widest">{selectedEmp.designation}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                        <p className="text-slate-500 uppercase font-bold text-[8px] mb-1">Identity Code</p>
                        <p className="font-mono text-white font-bold">{selectedEmp.id}</p>
                    </div>
                    <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                        <p className="text-slate-500 uppercase font-bold text-[8px] mb-1">Date of Join</p>
                        <p className="text-white font-bold">{formatDateInd(selectedEmp.doj)}</p>
                    </div>
                </div>

                {selectedEmp.dol && (
                    <div className="bg-red-900/10 border border-red-900/30 p-4 rounded-xl text-xs space-y-2">
                        <div className="flex justify-between">
                            <span className="text-red-400 font-bold uppercase">Date of Leaving</span>
                            <span className="text-white font-mono">{formatDateInd(selectedEmp.dol)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-red-400 font-bold uppercase">Reason</span>
                            <span className="text-white text-right">{selectedEmp.leavingReason || 'N/A'}</span>
                        </div>
                    </div>
                )}

                <div className="space-y-4 pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold uppercase text-[9px]">Date of Birth</span>
                        <span className="font-mono font-bold text-slate-300">{formatDateInd(selectedEmp.dob)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold uppercase text-[9px]">UAN No (PF)</span>
                        <span className="font-mono font-bold text-sky-400">{selectedEmp.uanc || 'NOT SET'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold uppercase text-[9px]">Contact</span>
                        <span className="font-bold">{selectedEmp.mobile || 'N/A'}</span>
                    </div>
                </div>

                <button
                    onClick={() => onEdit(selectedEmp)}
                    className="w-full py-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    <Edit2 size={16} /> Edit Profile Details
                </button>
            </div>
        </div>
    );
};

export default EmployeeDetailSidebar;
