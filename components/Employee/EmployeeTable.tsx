import React from 'react';
import { User2, Edit2, Trash2 } from 'lucide-react';
import { Employee, User } from '../../types';
import { formatDateInd } from '../../services/reportService';

interface EmployeeTableProps {
    employees: Employee[];
    selectedEmp: Employee | null;
    onSelectEmp: (emp: Employee) => void;
    onEdit: (emp: Employee) => void;
    onDelete: (emp: Employee, e: React.MouseEvent) => void;
    calculateGrossWage: (emp: Employee) => number;
    currentUser?: User;
}

const EmployeeTable: React.FC<EmployeeTableProps> = ({
    employees,
    selectedEmp,
    onSelectEmp,
    onEdit,
    onDelete,
    calculateGrossWage,
    currentUser
}) => {
    return (
        <div className="lg:col-span-2 bg-[#1e293b] rounded-xl border border-slate-800 shadow-2xl overflow-hidden h-fit max-h-[800px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left table-fixed">
                <thead className="bg-[#0f172a] text-sky-400 text-[10px] uppercase tracking-[0.2em] font-black sticky top-0 z-10 border-b border-slate-800">
                    <tr>
                        <th className="px-4 py-3 bg-[#0f172a] w-[25%]">Identity</th>
                        <th className="px-4 py-3 bg-[#0f172a] w-[30%]">Designation & Location</th>
                        <th className="px-2 py-3 bg-[#0f172a] w-[15%] text-center">Join Date</th>
                        <th className="px-2 py-3 bg-[#0f172a] w-[15%] text-center">Gross Wages</th>
                        <th className="px-4 py-3 text-right bg-[#0f172a] w-[15%]">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {employees.map((emp) => (
                        <tr
                            key={emp.id}
                            className={`hover:bg-slate-800/50 ${selectedEmp?.id === emp.id ? 'bg-blue-900/40 border-l-4 border-blue-500' : 'border-l-4 border-transparent'} ${emp.dol ? 'opacity-60 grayscale' : ''}`}
                        >
                            <td className="px-4 py-2.5 overflow-hidden">
                                <button
                                    onClick={() => onSelectEmp(emp)}
                                    title={`View details for ${emp.name}`}
                                    className="flex items-center gap-3 w-full text-left outline-none group"
                                >
                                    <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 overflow-hidden shrink-0 relative shadow-lg group-hover:border-blue-500/50 transition-colors">
                                        {emp.photoUrl ? <img src={emp.photoUrl} className="w-full h-full object-cover" alt={emp.name} /> : <User2 size={18} className="text-slate-500" />}
                                        {emp.dol && <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center font-black text-[8px] text-white">LEFT</div>}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-black text-white text-[12px] tracking-tight truncate uppercase leading-tight group-hover:text-blue-400 transition-colors">{emp.name}</div>
                                        <div className="text-[9px] text-slate-500 font-bold font-mono tracking-wider truncate">{emp.id}</div>
                                    </div>
                                </button>
                            </td>
                            <td className="px-4 py-2.5 overflow-hidden">
                                <div className="text-[10px] text-sky-400 font-black uppercase tracking-wider truncate">{emp.designation}</div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase truncate opacity-80">{emp.branch || emp.site || 'Main Office'}</div>
                            </td>
                            <td className="px-2 py-2.5 text-center">
                                <div className="text-[10px] font-bold font-mono text-slate-300 whitespace-nowrap">{formatDateInd(emp.doj)}</div>
                            </td>
                            <td className="px-2 py-2.5 text-center">
                                <div className="font-mono text-emerald-400 font-black text-[12px] tracking-tighter shadow-emerald-400/10">₹{calculateGrossWage(emp).toLocaleString()}</div>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                                <div className="flex justify-end gap-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit(emp); }}
                                        className="text-slate-400 hover:text-blue-400 p-1.5 hover:bg-blue-900/30 rounded-lg transition-all"
                                        title={`Edit ${emp.name}'s Profile`}
                                        aria-label={`Edit ${emp.name}'s Profile`}
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    {(currentUser?.role === 'Developer' || currentUser?.role === 'Administrator') && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDelete(emp, e); }}
                                            className="text-slate-400 hover:text-red-400 p-1.5 hover:bg-red-900/20 rounded-lg transition-all"
                                            title={`Delete ${emp.name}'s Record`}
                                            aria-label={`Delete ${emp.name}'s Record`}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default EmployeeTable;
