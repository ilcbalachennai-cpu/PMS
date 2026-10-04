import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  History, ShieldCheck, Search, FileSpreadsheet, RefreshCw,
  Building2, Scale, CheckCircle2, ArrowRight
} from 'lucide-react';
import { CompanyProfile, ConfigChangeLog } from '../../types';
import { getConfigChangeLogs, exportConfigChangeExcel } from '../../services/auditService';
import { openSavedReport } from '../../services/reportService';

interface ConfigChangeAuditTrailProps {
  companyProfile: CompanyProfile;
  showAlert: (type: 'success' | 'warning' | 'danger' | 'info' | 'confirm' | 'error', title: string, message: string | React.ReactNode, onConfirm?: () => void, onCancel?: () => void, confirmLabel?: string, cancelLabel?: string) => void;
  activeCompanyId?: string;
  onNavigate?: (view: any) => void;
}

export const ConfigChangeAuditTrail: React.FC<ConfigChangeAuditTrailProps> = ({
  companyProfile,
  showAlert,
  activeCompanyId = 'default',
  onNavigate: _onNavigate
}) => {
  const [logs, setLogs] = useState<ConfigChangeLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'Company Profile' | 'Statutory Configuration'>('ALL');

  // Load audit trail from Electron DB / LocalStorage
  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await getConfigChangeLogs(activeCompanyId);
      setLogs(records);
    } catch (e) {
      console.error('Failed to load config change audit logs', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Category filter
      if (categoryFilter !== 'ALL' && log.category !== categoryFilter) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchField = (log.field || '').toLowerCase().includes(q);
        const matchOld = (log.oldValue || '').toLowerCase().includes(q);
        const matchNew = (log.newValue || '').toLowerCase().includes(q);
        const matchChangedBy = (log.changedBy || '').toLowerCase().includes(q);
        const matchApprovedBy = (log.approvedBy || '').toLowerCase().includes(q);
        const matchCategory = (log.category || '').toLowerCase().includes(q);
        return matchField || matchOld || matchNew || matchChangedBy || matchApprovedBy || matchCategory;
      }

      return true;
    });
  }, [logs, categoryFilter, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const total = logs.length;
    const companyProfileCount = logs.filter(l => l.category === 'Company Profile').length;
    const statutoryCount = logs.filter(l => l.category === 'Statutory Configuration').length;
    const latestDate = logs.length > 0
      ? new Date(logs[0].timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'None';

    return { total, companyProfileCount, statutoryCount, latestDate };
  }, [logs]);

  // Export handler
  const handleExportExcel = async () => {
    if (filteredLogs.length === 0) {
      showAlert('warning', 'No Records', 'There are no configuration change records to export for the selected filter.');
      return;
    }

    setIsExporting(true);
    try {
      const savedPath = await exportConfigChangeExcel(filteredLogs, companyProfile);
      if (savedPath) {
        showAlert(
          'success',
          'Audit Report Exported',
          `The Config Change Audit report has been saved to your reports folder.`,
          () => openSavedReport(savedPath),
          undefined,
          'Open Report & Folder'
        );
      }
    } catch (err: any) {
      console.error('Failed to export config change audit log', err);
      showAlert('error', 'Export Failed', err.message || 'An error occurred while generating Excel report.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-300">
      {/* Header and Context */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center border border-cyan-500/20 text-cyan-400 shadow-lg shadow-cyan-900/10">
            <History size={26} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-black text-white tracking-tight uppercase">
                Configuration Change Audit Trail
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Admin OTP Approved
              </span>
            </div>
            <p className="text-slate-400 text-xs font-medium">
              Historical two-factor admin approval log for Company Profile and Statutory Rules &bull; <span className="text-white font-semibold">{companyProfile.establishmentName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadLogs}
            disabled={isLoading}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all shadow-md flex items-center gap-2 text-xs font-bold"
            title="Refresh Logs"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={isExporting || filteredLogs.length === 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2.5"
          >
            <FileSpreadsheet size={16} />
            {isExporting ? 'Generating...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1e293b]/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <History size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Config Changes</span>
            <div className="text-2xl font-black text-white">{metrics.total}</div>
          </div>
        </div>

        <div className="bg-[#1e293b]/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Building2 size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Company Profile</span>
            <div className="text-2xl font-black text-indigo-300">{metrics.companyProfileCount}</div>
          </div>
        </div>

        <div className="bg-[#1e293b]/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Scale size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Statutory Rules</span>
            <div className="text-2xl font-black text-amber-400">{metrics.statutoryCount}</div>
          </div>
        </div>

        <div className="bg-[#1e293b]/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Last Modified</span>
            <div className="text-lg font-black text-emerald-400 truncate">{metrics.latestDate}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0f172a] p-3 rounded-2xl border border-slate-800">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
          <button
            onClick={() => setCategoryFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              categoryFilter === 'ALL'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All Changes ({logs.length})
          </button>

          <button
            onClick={() => setCategoryFilter('Company Profile')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              categoryFilter === 'Company Profile'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Building2 size={13} />
            Company Profile ({metrics.companyProfileCount})
          </button>

          <button
            onClick={() => setCategoryFilter('Statutory Configuration')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              categoryFilter === 'Statutory Configuration'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Scale size={13} />
            Statutory Rules ({metrics.statutoryCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search field, value, user, or OTP approver..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#1e293b] border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
          />
        </div>
      </div>

      {/* Main Table View */}
      <div className="flex-1 bg-[#0f172a] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-[#002060] text-white select-none shadow-sm">
              <tr>
                <th className="py-3 px-3 w-12 text-center font-black uppercase tracking-wider text-[10px] border-r border-[#001A4E]">#</th>
                <th className="py-3 px-4 w-40 font-black uppercase tracking-wider text-[10px] border-r border-[#001A4E]">Date & Time</th>
                <th className="py-3 px-4 w-48 font-black uppercase tracking-wider text-[10px] border-r border-[#001A4E]">Category</th>
                <th className="py-3 px-4 w-60 font-black uppercase tracking-wider text-[10px] border-r border-[#001A4E]">Field Modified</th>
                <th className="py-3 px-4 font-black uppercase tracking-wider text-[10px] border-r border-[#001A4E]">Previous Value</th>
                <th className="py-3 px-2 w-8 text-center font-black uppercase tracking-wider text-[10px] border-r border-[#001A4E]">&bull;</th>
                <th className="py-3 px-4 font-black uppercase tracking-wider text-[10px] border-r border-[#001A4E]">Approved Value</th>
                <th className="py-3 px-4 w-48 font-black uppercase tracking-wider text-[10px] border-r border-[#001A4E]">Changed By</th>
                <th className="py-3 px-4 w-56 font-black uppercase tracking-wider text-[10px] border-r border-[#001A4E]">Approved By</th>
                <th className="py-3 px-3 w-32 text-center font-black uppercase tracking-wider text-[10px]">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw size={24} className="animate-spin text-cyan-400" />
                      <span className="text-xs uppercase tracking-widest font-bold">Loading Audit Trail...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-800/60 flex items-center justify-center text-slate-500 border border-slate-700">
                        <History size={28} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                          {searchQuery.trim() || categoryFilter !== 'ALL' ? 'No Matching Config Changes Found' : 'No Configuration Changes Logged Yet'}
                        </p>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          {searchQuery.trim() || categoryFilter !== 'ALL'
                            ? 'Try clearing the search query or changing the category filter.'
                            : 'All future modifications made to Company Profile or Statutory Rules will require Admin OTP approval and will be systematically recorded here.'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, index) => {
                  const dateObj = new Date(log.timestamp);
                  const formattedDate = dateObj.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });
                  const formattedTime = dateObj.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  });

                  return (
                    <tr
                      key={log.id || index}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Sl No */}
                      <td className="py-3 px-3 text-center text-slate-500 text-[11px] font-mono border-r border-slate-800/60">
                        {index + 1}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4 border-r border-slate-800/60 whitespace-nowrap">
                        <div className="text-slate-200 font-semibold">{formattedDate}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{formattedTime}</div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 border-r border-slate-800/60 whitespace-nowrap">
                        {log.category === 'Company Profile' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <Building2 size={12} />
                            Company Profile
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Scale size={12} />
                            Statutory Rules
                          </span>
                        )}
                      </td>

                      {/* Field */}
                      <td className="py-3 px-4 border-r border-slate-800/60">
                        <div className="text-white font-bold tracking-tight">
                          {log.field}
                        </div>
                        {log.fieldKey && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            {log.fieldKey}
                          </div>
                        )}
                      </td>

                      {/* Previous Value */}
                      <td className="py-3 px-4 border-r border-slate-800/60">
                        <div className="max-w-[220px] break-words text-rose-300 line-through opacity-85 text-xs font-mono">
                          {log.oldValue || '(Blank)'}
                        </div>
                      </td>

                      {/* Arrow */}
                      <td className="py-3 px-2 text-center border-r border-slate-800/60 text-slate-500">
                        <ArrowRight size={13} className="inline text-slate-500" />
                      </td>

                      {/* New Value */}
                      <td className="py-3 px-4 border-r border-slate-800/60">
                        <div className="max-w-[220px] break-words text-emerald-400 font-bold text-xs font-mono bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/20 inline-block">
                          {log.newValue || '(Blank)'}
                        </div>
                      </td>

                      {/* Changed By */}
                      <td className="py-3 px-4 border-r border-slate-800/60 whitespace-nowrap">
                        <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                          {log.changedBy || 'User'}
                        </div>
                        {log.changedByRole && (
                          <div className="text-[10px] text-slate-500 uppercase tracking-widest pl-3">
                            Role: {log.changedByRole}
                          </div>
                        )}
                      </td>

                      {/* Approved By */}
                      <td className="py-3 px-4 border-r border-slate-800/60 whitespace-nowrap">
                        <div className="text-cyan-300 font-bold text-xs flex items-center gap-1.5">
                          <ShieldCheck size={14} className="text-cyan-400 shrink-0" />
                          <span className="truncate max-w-[200px]" title={log.approvedBy}>
                            {log.approvedBy || 'Admin OTP'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 pl-5">
                          Two-Factor Authorized
                        </div>
                      </td>

                      {/* Audit Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 size={11} />
                          Verified
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Stats Bar */}
        <div className="p-3.5 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <strong className="text-white">{filteredLogs.length}</strong> of <strong className="text-white">{logs.length}</strong> recorded configuration adjustments
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck size={14} className="text-cyan-400" />
            <span>Tamper-proof localized database audit trail</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigChangeAuditTrail;
