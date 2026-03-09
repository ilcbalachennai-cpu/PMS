import React from 'react';
import { X, FileText, Download } from 'lucide-react';

interface DocumentPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    previewDoc: { url: string, name: string } | null;
}

const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
    isOpen,
    onClose,
    previewDoc
}) => {
    if (!isOpen || !previewDoc) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-4xl max-h-[95vh] flex flex-col rounded-3xl border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 bg-[#0f172a] border-b border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <FileText size={20} className="text-blue-400" /> Document Preview: <span className="text-slate-400 font-normal truncate max-w-[300px]">{previewDoc.name}</span>
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition-colors"><X size={20} /></button>
                </div>
                <div className="flex-1 bg-slate-900/50 p-4 overflow-hidden flex items-center justify-center min-h-[60vh]">
                    {previewDoc.url.startsWith('data:image') ? (
                        <img src={previewDoc.url} alt="Document Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
                    ) : previewDoc.url.startsWith('data:application/pdf') ? (
                        <iframe src={previewDoc.url} className="w-full h-full rounded-lg border-0 shadow-lg bg-white" title="PDF Preview"></iframe>
                    ) : (
                        <div className="text-slate-400 flex flex-col items-center gap-3">
                            <FileText size={48} className="opacity-50" />
                            <p>Preview not available for this file type.</p>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-[#0f172a] border-t border-slate-700 flex justify-end">
                    <button onClick={() => {
                        const link = document.createElement('a');
                        link.href = previewDoc.url;
                        link.download = previewDoc.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                        link.click();
                    }} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all">
                        <Download size={16} /> Download Copy
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DocumentPreviewModal;
