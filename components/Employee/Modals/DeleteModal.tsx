import React from 'react';
import { Trash2, AlertCircle, X } from 'lucide-react';
import { Employee } from '../../../types';

interface DeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: Employee | null;
    onConfirm: () => void;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
    isOpen,
    onClose,
    employee,
    onConfirm
}) => {
    if (!isOpen || !employee) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-red-900/30 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 bg-red-900/20 border-b border-red-900/30 flex justify-between items-center text-red-400">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Trash2 size={20} /> Irreversible Deletion
                    </h3>
                    <button onClick={onClose} className="text-red-400/60 hover:text-red-400"><X size={20} /></button>
                </div>
                <div className="p-8 space-y-6">
                    <div className="p-4 bg-red-900/10 border border-red-900/20 rounded-xl flex gap-4">
                        <AlertCircle className="text-red-400 shrink-0" size={24} />
                        <div className="text-xs text-red-300 leading-relaxed font-medium">
                            CAUTION: You are about to permanently purge <span className="text-white font-bold">{employee.name} ({employee.id})</span> from the master records. This action cannot be undone and will affect historical payroll references.
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all">Cancel</button>
                        <button onClick={onConfirm} className="flex-2 py-3 px-8 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2">
                            CONFIRM PURGE
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeleteModal;
