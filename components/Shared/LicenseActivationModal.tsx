import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, ChevronRight, Ban } from 'lucide-react';
import { CompanyProfile } from '../../types';
import { getStoredLicense } from '../../services/licenseService';

interface LicenseActivationModalProps {
  companies: CompanyProfile[];
  onActivate: (selectedCompanyIds: string[]) => Promise<void>;
  onClose: () => void;
}

const LicenseActivationModal: React.FC<LicenseActivationModalProps> = ({ companies, onActivate, onClose }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isActivating, setIsActivating] = useState(false);
  
  const license = getStoredLicense();
  const limit = license?.companyLimit || 1;
  const usedSlots = (license?.cloudSignatures || []).length;
  const availableSlots = Math.max(0, limit - usedSlots);

  const [orphanedSilos, setOrphanedSilos] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    const fetchOrphans = async () => {
      if ((window as any).electronAPI?.listSilos) {
        const res = await (window as any).electronAPI.listSilos();
        if (res.success && res.silos) {
          const found = res.silos as string[];
          const existingIds = companies.map(c => c.id);
          const missing = found.filter(s => !existingIds.includes(s));
          setOrphanedSilos(missing.map(id => ({ id, name: `Folder: ${id}` })));
        }
      }
    };
    fetchOrphans();
  }, [companies]);

  // Combine them:
  const availableCompanies = [
    ...companies.filter(c => !c.companySignature || c.isReadOnly).map(c => ({
      id: c.id,
      name: c.establishmentName || c.id,
      isReadOnly: c.isReadOnly,
      isOrphan: false
    })),
    ...orphanedSilos.map(o => ({
      id: o.id,
      name: o.name,
      isReadOnly: false,
      isOrphan: true
    }))
  ];

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(s => s !== id));
    } else {
      if (selectedIds.length >= availableSlots) return; // Enforce limit
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleActivate = async () => {
    if (selectedIds.length === 0) return;
    setIsActivating(true);
    await onActivate(selectedIds);
    setIsActivating(false);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#1e293b] w-full max-w-2xl rounded-3xl border border-blue-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-900/50 to-slate-900 border-b border-blue-500/20 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-blue-500/20 rounded-2xl border border-blue-400/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <ShieldCheck size={32} />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black text-white tracking-tight uppercase flex items-center gap-2">
                Setup Company Signature
                <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30 font-bold uppercase tracking-widest">
                  Setup Required
                </span>
              </h2>
              <p className="text-sm text-blue-200/70 mt-1">
                Select the organizations you want to activate and link to your cloud license.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">License Capacity</p>
              <div className="flex items-end gap-2 mt-1">
                <span className="text-2xl font-black text-white">{availableSlots}</span>
                <span className="text-sm font-bold text-slate-500 mb-1">available slots</span>
              </div>
            </div>
            <div className="h-10 w-px bg-slate-700/50"></div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Selected</p>
              <div className="flex items-end gap-2 mt-1">
                <span className={`text-2xl font-black ${selectedIds.length === availableSlots ? 'text-blue-400' : 'text-white'}`}>
                  {selectedIds.length}
                </span>
                <span className="text-sm font-bold text-slate-500 mb-1">/ {availableSlots}</span>
              </div>
            </div>
          </div>

          {availableCompanies.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-slate-700/30 flex flex-col items-center justify-center">
              <CheckCircle2 size={48} className="text-green-500/50 mb-4" />
              <p className="text-lg font-bold text-slate-300">All available companies are already activated.</p>
              <p className="text-sm text-slate-500 mt-2">No further action required.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">
                Select Organizations to Mount
              </label>
              <div className="grid gap-3">
                {availableCompanies.map(company => {
                  const isSelected = selectedIds.includes(company.id);
                  const isDisabled = !isSelected && selectedIds.length >= availableSlots;
                  
                  return (
                    <label 
                      key={company.id}
                      className={`
                        relative flex items-center p-4 rounded-2xl border transition-all duration-200
                        ${isSelected ? 'bg-blue-900/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] cursor-pointer' : 
                          isDisabled ? 'bg-slate-900/30 border-slate-800 opacity-50 cursor-not-allowed' : 
                          'bg-slate-900/50 border-slate-700 hover:border-slate-500 cursor-pointer'}
                      `}
                    >
                      <input 
                        type="checkbox"
                        className="peer sr-only"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => toggleSelection(company.id)}
                      />
                      <div className={`
                        w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-colors mr-4 shrink-0
                        ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-600 bg-slate-800'}
                      `}>
                        {isSelected && <CheckCircle2 size={16} strokeWidth={3} />}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white truncate">{company.name}</h4>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono border border-slate-700 uppercase">
                            {company.id}
                          </span>
                        </div>
                        {company.isReadOnly && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                            <Ban size={10} /> Currently Unmounted (Read-Only)
                          </div>
                        )}
                        {company.isOrphan && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                            Unlinked Folder (Rescue)
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-900/80 border-t border-slate-800 shrink-0 flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            disabled={isActivating}
            className="px-6 py-3 rounded-xl font-bold text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel / Load as Read-Only
          </button>
          <button
            onClick={handleActivate}
            disabled={selectedIds.length === 0 || isActivating}
            className="flex-1 max-w-[200px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isActivating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Activate <ChevronRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LicenseActivationModal;
