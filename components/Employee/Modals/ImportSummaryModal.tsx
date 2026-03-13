import React from 'react';
import { Upload, X, CheckCircle, FileX, FileText, FileSpreadsheet } from 'lucide-react';

interface ImportSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    summary: {
        total: number;
        success: number;
        failed: number;
        errors: { row: number, name: string, id: string, reason: string }[];
    } | null;
    onDownloadReport: (format: 'Excel' | 'PDF') => void;
}

const ImportSummaryModal: React.FC<ImportSummaryModalProps> = ({
    isOpen,
    onClose,
    summary,
    onDownloadReport
}) => {
    if (!isOpen || !summary) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl border border-slate-700 shadow-2xl">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-[#0f172a] rounded-t-2xl">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Upload size={20} className="text-blue-400" /> Import Result
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                            Processed {summary.total} rows from Excel file.
                        </p>
                    </div>
                    <button onClick={onClose} title="Close Import Result" aria-label="Close Import Result" className="text-slate-400 hover:text-white"><X size={20} /></button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-emerald-900/20 border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Successful</p>
                                <h4 className="text-2xl font-black text-emerald-300">{summary.success}</h4>
                            </div>
                            <CheckCircle className="text-emerald-500 opacity-50" size={32} />
                        </div>
                        <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-red-400 uppercase font-bold tracking-wider">Failed / Duplicate</p>
                                <h4 className="text-2xl font-black text-red-300">{summary.failed}</h4>
                            </div>
                            <FileX className="text-red-500 opacity-50" size={32} />
                        </div>
                    </div>

                    {summary.failed > 0 && (
                        <div className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden">
                            <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 text-xs font-bold text-slate-300 uppercase">
                                Error Details ({summary.failed})
                            </div>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-800 text-slate-400 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 w-16">Row</th>
                                            <th className="px-4 py-2">Employee</th>
                                            <th className="px-4 py-2 text-red-300">Reason for Failure</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700 text-slate-300">
                                        {summary.errors.map((err, i) => (
                                            <tr key={i} className="hover:bg-slate-800/50">
                                                <td className="px-4 py-2 font-mono text-slate-500">{err.row}</td>
                                                <td className="px-4 py-2">
                                                    <div className="font-bold text-white">{err.name}</div>
                                                    <div className="text-[10px] text-slate-500">{err.id}</div>
                                                </td>
                                                <td className="px-4 py-2 text-red-400">{err.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {summary.failed === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-emerald-400">
                            <CheckCircle size={48} className="mb-2" />
                            <p className="font-bold">All records imported successfully!</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-700 bg-[#1e293b] flex justify-end gap-3 rounded-b-2xl">
                    {summary.failed > 0 && (
                        <>
                            <button onClick={() => onDownloadReport('PDF')} className="px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-lg font-bold text-xs transition-colors flex items-center gap-2">
                                <FileText size={16} /> PDF Report
                            </button>
                            <button onClick={() => onDownloadReport('Excel')} className="px-4 py-2 bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/50 rounded-lg font-bold text-xs transition-colors flex items-center gap-2">
                                <FileSpreadsheet size={16} /> Excel Report
                            </button>
                        </>
                    )}
                    <button onClick={onClose} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm transition-colors">Close</button>
                </div>
            </div>
        </div>
    );
};

export default ImportSummaryModal;
