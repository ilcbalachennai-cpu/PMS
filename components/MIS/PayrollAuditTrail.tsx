import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  ShieldAlert, AlertTriangle, Search, CheckCircle2, FileSpreadsheet, ArrowRight, Lock
} from 'lucide-react';
import { Employee, PayrollResult, CompanyProfile, StatutoryConfig } from '../../types';
import { 
  calculateECRAudit, calculateESIAudit, calculatePayAudit, 
  exportECRAuditExcel, exportESIAuditExcel, exportPayAuditExcel,
  ECRAuditSummary, ESIAuditSummary, PayAuditSummary
} from '../../services/auditService';
import { openSavedReport } from '../../services/reportService';

interface PayrollAuditTrailProps {
  employees: Employee[];
  payrollHistory: PayrollResult[];
  companyProfile: CompanyProfile;
  config?: StatutoryConfig;
  showAlert: (type: string, title: string, message: string) => void;
  globalMonth?: string;
  globalYear?: number;
  onNavigate?: (view: any) => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Helper to parse period string "Month Year" to numeric value
const parsePeriod = (p: string) => {
  if (!p) return { month: 'August', year: 2026, monthIdx: 7, val: 2026 * 12 + 7 };
  const [m, yStr] = p.split(' ');
  const y = parseInt(yStr, 10) || 2026;
  const mIdx = MONTHS.indexOf(m);
  const safeMIdx = mIdx >= 0 ? mIdx : 7;
  return {
    month: m,
    year: y,
    monthIdx: safeMIdx,
    val: y * 12 + safeMIdx
  };
};

const formatPeriod = (monthIdx: number, year: number): string => {
  return `${MONTHS[monthIdx]} ${year}`;
};

const getNextPeriod = (p: string): string => {
  const { monthIdx, year } = parsePeriod(p);
  if (monthIdx === 11) {
    return formatPeriod(0, year + 1);
  }
  return formatPeriod(monthIdx + 1, year);
};

const getPrevPeriod = (p: string): string => {
  const { monthIdx, year } = parsePeriod(p);
  if (monthIdx === 0) {
    return formatPeriod(11, year - 1);
  }
  return formatPeriod(monthIdx - 1, year);
};

export const PayrollAuditTrail: React.FC<PayrollAuditTrailProps> = ({
  employees,
  payrollHistory,
  companyProfile,
  config,
  showAlert,
  globalMonth,
  globalYear,
  onNavigate
}) => {
  const [subTab, setSubTab] = useState<'ECR' | 'ESI' | 'PAY'>('ECR');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'CHANGES_ONLY' | 'ALERTS_ONLY' | 'NEW' | 'DROPPED'>('CHANGES_ONLY');
  const [isExporting, setIsExporting] = useState(false);

  // Determine all unique periods available in payroll records
  const availablePeriods = useMemo(() => {
    const periodMap = new Map<string, { month: number; year: number; val: number }>();
    payrollHistory.forEach(r => {
      const mIdx = MONTHS.indexOf(r.month);
      if (mIdx >= 0 && r.year) {
        const key = `${r.month} ${r.year}`;
        if (!periodMap.has(key)) {
          periodMap.set(key, { month: mIdx, year: r.year, val: r.year * 12 + mIdx });
        }
      }
    });

    if (periodMap.size === 0) {
      const fallbackM = globalMonth && MONTHS.includes(globalMonth) ? globalMonth : 'August';
      const fallbackY = globalYear || 2026;
      const mIdx = MONTHS.indexOf(fallbackM);
      const prevM = mIdx === 0 ? 'December' : MONTHS[mIdx - 1];
      const prevY = mIdx === 0 ? fallbackY - 1 : fallbackY;
      return [`${fallbackM} ${fallbackY}`, `${prevM} ${prevY}`];
    }

    // Sort chronologically descending (newest first, e.g. August 2026, July 2026, ...)
    const sorted = Array.from(periodMap.values())
      .sort((a, b) => b.val - a.val)
      .map(p => `${MONTHS[p.month]} ${p.year}`);

    return sorted;
  }, [payrollHistory, globalMonth, globalYear]);

  // Selected periods for comparison:
  // Current (M) must ALWAYS be chronologically AFTER Baseline (M-1)!
  const [currPeriod, setCurrPeriod] = useState<string>(() => {
    if (globalMonth && globalYear && MONTHS.includes(globalMonth)) {
      const gKey = `${globalMonth} ${globalYear}`;
      const gVal = parsePeriod(gKey).val;
      const hasPrior = availablePeriods.some(p => parsePeriod(p).val < gVal);
      if (hasPrior) return gKey;
    }
    if (availablePeriods.length > 0) {
      return availablePeriods[0];
    }
    return 'August 2026';
  });

  const [prevPeriod, setPrevPeriod] = useState<string>(() => {
    const initialCurr = (globalMonth && globalYear && MONTHS.includes(globalMonth) && availablePeriods.some(p => parsePeriod(p).val < parsePeriod(`${globalMonth} ${globalYear}`).val))
      ? `${globalMonth} ${globalYear}`
      : (availablePeriods[0] || 'August 2026');

    const currVal = parsePeriod(initialCurr).val;

    // Find closest period in availablePeriods strictly BEFORE currVal
    const priorPeriod = availablePeriods.find(p => parsePeriod(p).val < currVal);
    if (priorPeriod) {
      return priorPeriod;
    }
    return getPrevPeriod(initialCurr);
  });

  // Current Month (M) MUST be any Month & Year AFTER Base Month & Year (M-1)
  const currentPeriodOptions = useMemo(() => {
    const baseVal = parsePeriod(prevPeriod).val;
    const after = availablePeriods.filter(p => parsePeriod(p).val > baseVal);

    const nextP = getNextPeriod(prevPeriod);
    if (!after.includes(nextP)) {
      after.push(nextP);
    }

    return after.sort((a, b) => parsePeriod(b).val - parsePeriod(a).val);
  }, [availablePeriods, prevPeriod]);

  // Baseline Month (M-1) MUST be any Month & Year BEFORE Current Month & Year (M)
  const baselinePeriodOptions = useMemo(() => {
    const currVal = parsePeriod(currPeriod).val;
    const before = availablePeriods.filter(p => parsePeriod(p).val < currVal);

    const prevP = getPrevPeriod(currPeriod);
    if (!before.includes(prevP)) {
      before.push(prevP);
    }

    return before.sort((a, b) => parsePeriod(b).val - parsePeriod(a).val);
  }, [availablePeriods, currPeriod]);

  // Handler for Base Month changes
  const handlePrevPeriodChange = (newPrev: string) => {
    setPrevPeriod(newPrev);
    const newBaseVal = parsePeriod(newPrev).val;
    const currVal = parsePeriod(currPeriod).val;

    // Current Month must always be after Base Month
    if (currVal <= newBaseVal) {
      const candidates = availablePeriods
        .filter(p => parsePeriod(p).val > newBaseVal)
        .sort((a, b) => parsePeriod(a).val - parsePeriod(b).val);

      if (candidates.length > 0) {
        setCurrPeriod(candidates[0]);
      } else {
        setCurrPeriod(getNextPeriod(newPrev));
      }
    }
  };

  // Handler for Current Month changes
  const handleCurrPeriodChange = (newCurr: string) => {
    setCurrPeriod(newCurr);
    const newCurrVal = parsePeriod(newCurr).val;
    const baseVal = parsePeriod(prevPeriod).val;

    // Base Month must always be before Current Month
    if (baseVal >= newCurrVal) {
      const candidates = availablePeriods
        .filter(p => parsePeriod(p).val < newCurrVal)
        .sort((a, b) => parsePeriod(b).val - parsePeriod(a).val);

      if (candidates.length > 0) {
        setPrevPeriod(candidates[0]);
      } else {
        setPrevPeriod(getPrevPeriod(newCurr));
      }
    }
  };

  // Enforce chronological integrity: Current (M) must always be strictly after Baseline (M-1)
  useEffect(() => {
    const baseVal = parsePeriod(prevPeriod).val;
    const currVal = parsePeriod(currPeriod).val;
    if (currVal <= baseVal) {
      const candidates = availablePeriods
        .filter(p => parsePeriod(p).val > baseVal)
        .sort((a, b) => parsePeriod(a).val - parsePeriod(b).val);
      if (candidates.length > 0) {
        setCurrPeriod(candidates[0]);
      } else {
        setCurrPeriod(getNextPeriod(prevPeriod));
      }
    }
  }, [prevPeriod, availablePeriods]);

  // Extract records for current & previous periods
  const currResults = useMemo(() => {
    const [m, y] = currPeriod.split(' ');
    return payrollHistory.filter(r => r.month === m && r.year === Number(y));
  }, [payrollHistory, currPeriod]);

  const prevResults = useMemo(() => {
    const [m, y] = prevPeriod.split(' ');
    return payrollHistory.filter(r => r.month === m && r.year === Number(y));
  }, [payrollHistory, prevPeriod]);

  // Determine frozen status of periods
  const isPeriodFrozen = useCallback((p: string): boolean => {
    const [m, y] = p.split(' ');
    const records = payrollHistory.filter(r => r.month === m && r.year === Number(y));
    return records.length > 0 && records.every(r => r.status === 'Finalized');
  }, [payrollHistory]);

  const isCurrFrozen = useMemo(() => isPeriodFrozen(currPeriod), [isPeriodFrozen, currPeriod]);
  const isPrevFrozen = useMemo(() => isPeriodFrozen(prevPeriod), [isPeriodFrozen, prevPeriod]);

  // Compute Audits
  const ecrSummary: ECRAuditSummary = useMemo(() => {
    return calculateECRAudit(currResults, prevResults, employees, currPeriod, prevPeriod);
  }, [currResults, prevResults, employees, currPeriod, prevPeriod]);

  const esiSummary: ESIAuditSummary = useMemo(() => {
    return calculateESIAudit(currResults, prevResults, employees, currPeriod, prevPeriod, config);
  }, [currResults, prevResults, employees, currPeriod, prevPeriod, config]);

  const paySummary: PayAuditSummary = useMemo(() => {
    return calculatePayAudit(currResults, prevResults, employees, currPeriod, prevPeriod);
  }, [currResults, prevResults, employees, currPeriod, prevPeriod]);

  // Handle Export to Excel
  const handleExport = async () => {
    if (!isCurrFrozen) {
      showAlert('warning', 'Export Blocked', `Cannot export audit spreadsheet for ${currPeriod}: Data is not frozen.`);
      return;
    }

    try {
      setIsExporting(true);
      let savedPath: string | null = null;
      if (subTab === 'ECR') {
        savedPath = await exportECRAuditExcel(ecrSummary, companyProfile);
      } else if (subTab === 'ESI') {
        savedPath = await exportESIAuditExcel(esiSummary, companyProfile);
      } else {
        savedPath = await exportPayAuditExcel(paySummary, companyProfile);
      }

      if (savedPath) {
        await openSavedReport(savedPath);
        showAlert('success', 'Export Successful', `Audit report generated and saved successfully.`);
      }
    } catch (e: any) {
      showAlert('error', 'Export Failed', e.message || 'Could not export audit spreadsheet.');
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered ECR rows
  const filteredEcrRows = useMemo(() => {
    return ecrSummary.rows.filter(r => {
      const matchesSearch = !searchQuery.trim() || 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.empId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.uan.includes(searchQuery.trim());

      if (!matchesSearch) return false;
      if (filterMode === 'CHANGES_ONLY') return r.hasChange;
      if (filterMode === 'ALERTS_ONLY') return r.alerts.length > 0;
      if (filterMode === 'NEW') return r.status === 'NEW_MEMBER';
      if (filterMode === 'DROPPED') return r.status === 'DROPPED_MEMBER';
      return true;
    });
  }, [ecrSummary, searchQuery, filterMode]);

  // Filtered ESI rows
  const filteredEsiRows = useMemo(() => {
    return esiSummary.rows.filter(r => {
      const matchesSearch = !searchQuery.trim() || 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.empId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.esiNo.includes(searchQuery.trim());

      if (!matchesSearch) return false;
      if (filterMode === 'CHANGES_ONLY') return r.hasChange;
      if (filterMode === 'ALERTS_ONLY') return r.alerts.length > 0;
      if (filterMode === 'NEW') return r.status === 'NEW_IP' || r.status === 'DROPPED_INTO_COVERAGE';
      if (filterMode === 'DROPPED') return r.status === 'DROPPED_IP' || r.status === 'CROSSED_CEILING' || r.status === 'ZERO_CONTRIB';
      return true;
    });
  }, [esiSummary, searchQuery, filterMode]);

  // Filtered Pay rows
  const filteredPayRows = useMemo(() => {
    return paySummary.rows.filter(r => {
      const matchesSearch = !searchQuery.trim() || 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.empId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.designation.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (filterMode === 'CHANGES_ONLY') return r.hasChange;
      if (filterMode === 'ALERTS_ONLY') return r.alerts.length > 0;
      if (filterMode === 'NEW') return r.status === 'NEW_JOINER';
      if (filterMode === 'DROPPED') return r.status === 'EXITED';
      return true;
    });
  }, [paySummary, searchQuery, filterMode]);

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Period Selector */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
            <ShieldAlert size={26} />
          </div>
          <div>
            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              Statutory & Payroll Audit Trail
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Variance Engine
              </span>
            </h3>
            <p className="text-xs text-slate-400">Month-over-month compliance variance analysis, anomaly detection, and member tracking</p>
          </div>
        </div>

        {/* Period Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-xl border border-slate-700">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Baseline (M-1):</span>
            <select
              value={prevPeriod}
              onChange={e => handlePrevPeriodChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-white font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500 cursor-pointer"
            >
              {baselinePeriodOptions.map(p => {
                const frozen = isPeriodFrozen(p);
                return (
                  <option key={p} value={p}>
                    {p} {frozen ? '🔒 (Frozen)' : '⚠️ (Not Frozen)'}
                  </option>
                );
              })}
            </select>

            <ArrowRight size={14} className="text-amber-400" />

            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Current (M):</span>
            <select
              value={currPeriod}
              onChange={e => handleCurrPeriodChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-white font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500 cursor-pointer"
            >
              {currentPeriodOptions.map(p => {
                const frozen = isPeriodFrozen(p);
                return (
                  <option key={p} value={p}>
                    {p} {frozen ? '🔒 (Frozen)' : '⚠️ (Not Frozen)'}
                  </option>
                );
              })}
            </select>

            {/* Status Pill for Current Audit Month */}
            {isCurrFrozen ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm" title="Data for current month is frozen & locked">
                <Lock size={11} /> Frozen
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse shadow-sm" title="Data for current month is NOT frozen">
                <AlertTriangle size={11} /> Not Frozen
              </span>
            )}
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting || !isCurrFrozen}
            title={!isCurrFrozen ? "Audit comparison Excel export is blocked: Selected month is not frozen." : "Export Audit to Excel"}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-900/40 border border-emerald-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet size={16} />
            {isExporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Main Audit Area: Enforce Frozen Gate */}
      {!isCurrFrozen ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-slate-900/90 border-2 border-rose-500/30 rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-6 max-w-2xl w-full shadow-2xl backdrop-blur-xl">
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-rose-500/10 border-2 border-rose-500/20 flex items-center justify-center text-rose-400 shadow-inner">
                <Lock size={44} className="animate-pulse" />
              </div>
              <div className="absolute -top-1 -right-1 w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center text-slate-950 font-black shadow-md">
                <AlertTriangle size={15} />
              </div>
            </div>

            <div className="space-y-2 max-w-lg">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-black uppercase tracking-widest">
                <AlertTriangle size={13} /> Audit Comparison Gate Enforced
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">
                Data is Not Frozen for {currPeriod}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Statutory audit trail comparison of a month is <span className="text-rose-300 font-bold">only possible if the data for that month is frozen</span>. Comparison against active draft payroll is restricted to ensure compliance integrity and prevent discrepancies with EPFO / ESIC filings.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-md">
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-center">
                <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Audit Month</div>
                <div className="text-sm font-black text-white mt-1">{currPeriod}</div>
              </div>
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-center">
                <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Freeze Status</div>
                <div className="text-sm font-black text-rose-400 mt-1 flex items-center justify-center gap-1">
                  <AlertTriangle size={13} /> {currResults.length === 0 ? 'No Data' : 'Not Frozen'}
                </div>
              </div>
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-center">
                <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Draft Records</div>
                <div className="text-sm font-black text-white mt-1">{currResults.length} Employee(s)</div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              {onNavigate && (
                <button
                  onClick={() => onNavigate('reports')}
                  className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock size={15} /> Go to Reports to Freeze Data
                </button>
              )}
              {availablePeriods.some(p => isPeriodFrozen(p)) && (
                <button
                  onClick={() => {
                    const firstFrozen = availablePeriods.find(p => isPeriodFrozen(p));
                    if (firstFrozen) {
                      setCurrPeriod(firstFrozen);
                      const prior = availablePeriods.find(p => parsePeriod(p).val < parsePeriod(firstFrozen).val);
                      setPrevPeriod(prior || getPrevPeriod(firstFrozen));
                    }
                  }}
                  className="w-full sm:w-auto px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-slate-700 cursor-pointer"
                >
                  Switch to Frozen Month
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Baseline advisory notice if baseline month is not frozen */}
          {!isPrevFrozen && (
            <div className="p-3.5 bg-amber-950/30 border border-amber-500/30 rounded-xl flex items-center gap-3 text-xs text-amber-300 animate-in slide-in-from-top-1">
              <AlertTriangle size={16} className="text-amber-400 shrink-0" />
              <span>
                <strong>Baseline Notice:</strong> Baseline month (<strong>{prevPeriod}</strong>) is not frozen. Variance figures are calculated against draft records for {prevPeriod}.
              </span>
            </div>
          )}

          {/* Sub-tab Navigation */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => { setSubTab('ECR'); setFilterMode('CHANGES_ONLY'); }}
            className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
              subTab === 'ECR' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            a. ECR Audit (EPF / EPS)
            {ecrSummary.zeroEPSAlerts.length > 0 ? (
              <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-red-600 text-white animate-pulse">
                {ecrSummary.zeroEPSAlerts.length}
              </span>
            ) : ecrSummary.rows.filter(r => r.hasChange).length > 0 ? (
              <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-amber-600 text-white">
                {ecrSummary.rows.filter(r => r.hasChange).length}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => { setSubTab('ESI'); setFilterMode('CHANGES_ONLY'); }}
            className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
              subTab === 'ESI' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            b. ESI Audit (ESIC)
            {esiSummary.rows.filter(r => r.hasChange).length > 0 && (
              <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-amber-600 text-white">
                {esiSummary.rows.filter(r => r.hasChange).length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setSubTab('PAY'); setFilterMode('CHANGES_ONLY'); }}
            className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
              subTab === 'PAY' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            c. Employee Pay Audit
            {paySummary.rows.filter(r => r.hasChange).length > 0 && (
              <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-violet-600 text-white">
                {paySummary.rows.filter(r => r.hasChange).length}
              </span>
            )}
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterMode('CHANGES_ONLY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'CHANGES_ONLY'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            Changes Only
          </button>
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'ALL'
                ? 'bg-slate-700 text-white font-bold'
                : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            {subTab === 'ESI' ? 'All Covered IPs' : 'All Members'}
          </button>
          <button
            onClick={() => setFilterMode('ALERTS_ONLY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'ALERTS_ONLY'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 font-bold'
                : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            Alerts Only
          </button>
          <button
            onClick={() => setFilterMode('NEW')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'NEW'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold'
                : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            New
          </button>
          <button
            onClick={() => setFilterMode('DROPPED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'DROPPED'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold'
                : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            Dropped / Exited
          </button>
        </div>
      </div>

      {/* SUBTAB 1: ECR AUDIT */}
      {subTab === 'ECR' && (
        <div className="space-y-6 flex-1 flex flex-col min-h-0">
          {/* Critical Red Alert Banner for Zero EPS */}
          {ecrSummary.zeroEPSAlerts.length > 0 && (
            <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
              <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h4 className="text-sm font-black text-red-300 uppercase tracking-wide">
                  Critical Compliance Anomaly: {ecrSummary.zeroEPSAlerts.length} Employee(s) with Active EPF have EPS Contribution Dropped to ₹0
                </h4>
                <p className="text-xs text-red-200/80 mt-1">
                  The following active employees had active EPS contribution in {prevPeriod}, but in {currPeriod} their EPS contribution dropped to ₹0 while EPF remains active.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {ecrSummary.zeroEPSAlerts.map(a => (
                    <span key={a.empId} className="px-2.5 py-1 bg-red-900/60 border border-red-500/50 rounded-lg text-[11px] font-mono text-white font-bold">
                      {a.empId} ({a.name}): {a.alerts[0]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* KPI Cards: Members, Total Contribution, EPF, EPS, EDLI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 1. Number of Employees */}
            <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest truncate">1. Contributing Members</span>
                <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  ecrSummary.memberDiff >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {ecrSummary.memberDiff >= 0 ? `+${ecrSummary.memberDiff}` : ecrSummary.memberDiff} ({ecrSummary.memberPercent}%)
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
                <span className="text-xl font-black text-white">{ecrSummary.currMembers}</span>
                <span className="text-[11px] text-slate-400 font-bold truncate">was {ecrSummary.prevMembers}</span>
              </div>
            </div>

            {/* 2. Total Contribution */}
            <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest truncate">2. Total Contribution</span>
                <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  ecrSummary.totalContribDiff >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {ecrSummary.totalContribDiff >= 0 ? '+' : ''}{ecrSummary.totalContribPercent}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
                <span className="text-xl font-black text-emerald-400">₹{ecrSummary.currTotalContrib.toLocaleString()}</span>
                <span className="text-[11px] text-slate-400 font-bold truncate">was ₹{ecrSummary.prevTotalContrib.toLocaleString()}</span>
              </div>
            </div>

            {/* 3. Total EPF */}
            <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest truncate">3. Total EPF (EE + ER)</span>
                <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  ecrSummary.totalEPFDiff >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {ecrSummary.totalEPFDiff >= 0 ? '+' : ''}{ecrSummary.totalEPFPercent}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
                <span className="text-xl font-black text-sky-400">₹{ecrSummary.currTotalEPF.toLocaleString()}</span>
                <span className="text-[11px] text-slate-400 font-bold truncate">was ₹{ecrSummary.prevTotalEPF.toLocaleString()}</span>
              </div>
            </div>

            {/* 4. Total EPS */}
            <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest truncate">4. Total EPS (A/C 10)</span>
                <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  ecrSummary.erEPSDiff >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {ecrSummary.erEPSDiff >= 0 ? '+' : ''}{ecrSummary.erEPSPercent}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
                <span className="text-xl font-black text-amber-400">₹{ecrSummary.currEREPS.toLocaleString()}</span>
                <span className="text-[11px] text-slate-400 font-bold truncate">was ₹{ecrSummary.prevEREPS.toLocaleString()}</span>
              </div>
            </div>

            {/* 5. Total EDLI */}
            <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest truncate">5. Total EDLI (A/C 21)</span>
                <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  ecrSummary.edliDiff >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {ecrSummary.edliDiff >= 0 ? '+' : ''}{ecrSummary.edliPercent}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
                <span className="text-xl font-black text-indigo-400">₹{ecrSummary.currEDLI.toLocaleString()}</span>
                <span className="text-[11px] text-slate-400 font-bold truncate">was ₹{ecrSummary.prevEDLI.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search by Employee ID, Name, or UAN Number..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-amber-500"
            />
          </div>

          {/* Comparison Table */}
          <div className="flex-1 bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
            <div className="overflow-x-auto custom-scrollbar flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900/90 text-slate-400 uppercase font-extrabold text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">UAN</th>
                    <th className="p-3 text-right">EPF Wages ({prevPeriod} ➔ {currPeriod})</th>
                    <th className="p-3 text-right">EPS Wages ({prevPeriod} ➔ {currPeriod})</th>
                    <th className="p-3 text-right">NCP Days ({prevPeriod} ➔ {currPeriod})</th>
                    <th className="p-3 text-right">EE PF Share</th>
                    <th className="p-3 text-right">ER EPS Share</th>
                    <th className="p-3 text-right">ER EPF Share</th>
                    <th className="p-3 text-right">EDLI (0.5%)</th>
                    <th className="p-3 text-right">Total Contrib</th>
                    <th className="p-3">Audit Alert / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredEcrRows.map(r => (
                    <tr key={r.empId} className={`hover:bg-slate-800/40 transition-colors ${
                      r.status === 'EPS_DROPPED_ZERO' ? 'bg-red-950/20' : ''
                    }`}>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white">{r.name}</span>
                          {r.dol && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Resigned: {r.dol}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.empId}</div>
                      </td>
                      <td className="p-3 font-mono text-slate-300 text-[11px]">{r.uan}</td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-slate-400">₹{r.prevEPFWage.toLocaleString()}</span>
                        <ArrowRight size={10} className="inline mx-1 text-slate-600" />
                        <span className="text-white font-bold">₹{r.currEPFWage.toLocaleString()}</span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-slate-400">₹{r.prevEPSWage.toLocaleString()}</span>
                        <ArrowRight size={10} className="inline mx-1 text-slate-600" />
                        <span className={`font-bold ${r.currEPSWage === 0 && r.prevEPSWage > 0 ? 'text-red-400 underline font-black' : 'text-amber-400'}`}>
                          ₹{r.currEPSWage.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-slate-400">{r.prevNCPDays} d</span>
                        <ArrowRight size={10} className="inline mx-1 text-slate-600" />
                        <span className={`font-bold ${r.currNCPDays > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                          {r.currNCPDays} d
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-slate-400">₹{r.prevEEPF.toLocaleString()}</span>
                        <ArrowRight size={10} className="inline mx-1 text-slate-600" />
                        <span className="text-sky-400 font-bold">₹{r.currEEPF.toLocaleString()}</span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-slate-400">₹{r.prevEREPS.toLocaleString()}</span>
                        <ArrowRight size={10} className="inline mx-1 text-slate-600" />
                        <span className={`font-bold ${r.currEREPS === 0 && r.prevEREPS > 0 ? 'text-red-400 font-black' : 'text-amber-400'}`}>
                          ₹{r.currEREPS.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-slate-400">₹{r.prevEREPF.toLocaleString()}</span>
                        <ArrowRight size={10} className="inline mx-1 text-slate-600" />
                        <span className="text-indigo-400 font-bold">₹{r.currEREPF.toLocaleString()}</span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-slate-400">₹{r.prevEDLI.toLocaleString()}</span>
                        <ArrowRight size={10} className="inline mx-1 text-slate-600" />
                        <span className="text-purple-400 font-bold">₹{r.currEDLI.toLocaleString()}</span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-slate-400">₹{r.prevTotalContrib.toLocaleString()}</span>
                        <ArrowRight size={10} className="inline mx-1 text-slate-600" />
                        <span className="text-emerald-400 font-black">₹{r.currTotalContrib.toLocaleString()}</span>
                      </td>
                      <td className="p-3">
                        {r.alerts.length > 0 ? (
                          <div className="space-y-1">
                            {r.alerts.map((al, idx) => (
                              <span key={idx} className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.status === 'EPS_DROPPED_ZERO'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : r.status === 'NEW_MEMBER'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : r.status === 'DROPPED_MEMBER'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}>
                                {al}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-500" /> Verified Match
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredEcrRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500 italic">
                        {filterMode === 'CHANGES_ONLY'
                          ? 'No EPF/EPS contribution shifts, member drops, or anomalies detected between selected periods. All covered employees had consistent contributions.'
                          : 'No employees found matching the filter criteria.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: ESI AUDIT */}
      {subTab === 'ESI' && (
        <div className="space-y-6 flex-1 flex flex-col min-h-0">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest truncate">ESI Covered Members</span>
                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${
                  esiSummary.memberDiff >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {esiSummary.memberDiff >= 0 ? `+${esiSummary.memberDiff}` : esiSummary.memberDiff}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
                <span className="text-2xl font-black text-white">{esiSummary.currMembers}</span>
                <span className="text-xs text-slate-400 font-bold truncate">was {esiSummary.prevMembers}</span>
              </div>
            </div>

            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest truncate">Total IP Share (0.75%)</span>
                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${
                  esiSummary.ipDiff >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {esiSummary.ipDiff >= 0 ? '+' : ''}{esiSummary.ipPercent}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
                <span className="text-2xl font-black text-sky-400">₹{esiSummary.currIP.toLocaleString()}</span>
                <span className="text-xs text-slate-400 font-bold truncate">was ₹{esiSummary.prevIP.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest truncate">Total ER Share (3.25%)</span>
                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${
                  esiSummary.erDiff >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {esiSummary.erDiff >= 0 ? '+' : ''}{esiSummary.erPercent}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
                <span className="text-2xl font-black text-indigo-400">₹{esiSummary.currER.toLocaleString()}</span>
                <span className="text-xs text-slate-400 font-bold truncate">was ₹{esiSummary.prevER.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest truncate">Total ESI Deposit</span>
                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${
                  (esiSummary.ipDiff + esiSummary.erDiff) >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {(esiSummary.ipDiff + esiSummary.erDiff) >= 0 ? '+' : ''}₹{((esiSummary.currIP + esiSummary.currER) - (esiSummary.prevIP + esiSummary.prevER)).toLocaleString()}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
                <span className="text-2xl font-black text-emerald-400">₹{(esiSummary.currIP + esiSummary.currER).toLocaleString()}</span>
                <span className="text-xs text-slate-400 font-bold truncate">was ₹{(esiSummary.prevIP + esiSummary.prevER).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search by Employee ID, Name, or ESI Number..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-amber-500"
            />
          </div>

          {/* ESI Table */}
          <div className="flex-1 bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
            <div className="overflow-x-auto custom-scrollbar flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900/90 text-slate-400 uppercase font-extrabold text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">ESI Number</th>
                    <th className="p-3 text-right">Payable Days</th>
                    <th className="p-3 text-right">Gross Wages ({prevPeriod} ➔ {currPeriod})</th>
                    <th className="p-3 text-right">IP Share (0.75%)</th>
                    <th className="p-3 text-right">ER Share (3.25%)</th>
                    <th className="p-3">Audit Alert / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredEsiRows.map(r => (
                    <tr key={r.empId} className={`hover:bg-slate-800/40 transition-colors ${
                      r.status === 'NEW_IP' || r.status === 'DROPPED_INTO_COVERAGE' ? 'bg-emerald-950/10' :
                      r.status === 'DROPPED_IP' || r.status === 'CROSSED_CEILING' ? 'bg-rose-950/15' :
                      r.status === 'CONTRIB_CHANGED' ? 'bg-amber-950/15' : ''
                    }`}>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white">{r.name}</span>
                          {r.dol && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Resigned: {r.dol}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.empId}</div>
                      </td>
                      <td className="p-3 font-mono text-slate-300 text-[11px]">{r.esiNo}</td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-slate-400">{r.prevDays}</span>
                        <ArrowRight size={10} className="inline mx-1 text-slate-600" />
                        <span className="text-white font-bold">{r.currDays}</span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-slate-400">₹{r.prevWage.toLocaleString()}</span>
                        <ArrowRight size={10} className="inline mx-1 text-slate-600" />
                        <span className="text-white font-bold">₹{r.currWage.toLocaleString()}</span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-slate-400">₹{r.prevIP.toLocaleString()}</span>
                        <ArrowRight size={10} className="inline mx-1 text-slate-600" />
                        <span className={`font-bold ${r.currIP !== r.prevIP ? 'text-sky-400 underline font-black' : 'text-sky-400'}`}>
                          ₹{r.currIP.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-slate-400">₹{r.prevER.toLocaleString()}</span>
                        <ArrowRight size={10} className="inline mx-1 text-slate-600" />
                        <span className={`font-bold ${r.currER !== r.prevER ? 'text-indigo-400 underline font-black' : 'text-indigo-400'}`}>
                          ₹{r.currER.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3">
                        {r.alerts.length > 0 ? (
                          <div className="space-y-1">
                            {r.alerts.map((al, idx) => (
                              <span key={idx} className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.status === 'NEW_IP' || r.status === 'DROPPED_INTO_COVERAGE'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : r.status === 'DROPPED_IP' || r.status === 'CROSSED_CEILING' || r.status === 'ZERO_CONTRIB'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}>
                                {al}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-500" /> Normal Coverage
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredEsiRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                        {filterMode === 'CHANGES_ONLY'
                          ? 'No ESI contribution shifts or member status changes detected between selected periods.'
                          : 'No employees found matching the filter criteria.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: EMPLOYEE PAY AUDIT */}
      {subTab === 'PAY' && (
        <div className="space-y-6 flex-1 flex flex-col min-h-0">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest truncate">Total Headcount</span>
                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${
                  paySummary.headcountDiff >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {paySummary.headcountDiff >= 0 ? `+${paySummary.headcountDiff}` : paySummary.headcountDiff}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
                <span className="text-2xl font-black text-white">{paySummary.currHeadcount}</span>
                <span className="text-xs text-slate-400 font-bold truncate">was {paySummary.prevHeadcount}</span>
              </div>
            </div>

            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest truncate">Total Gross Salary</span>
                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${
                  paySummary.grossDiff >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {paySummary.grossDiff >= 0 ? '+' : ''}{paySummary.grossPercent}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
                <span className="text-2xl font-black text-emerald-400">₹{paySummary.currGross.toLocaleString()}</span>
                <span className="text-xs text-slate-400 font-bold truncate">was ₹{paySummary.prevGross.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest truncate">Total Net Pay</span>
                <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${
                  paySummary.netDiff >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {paySummary.netDiff >= 0 ? '+' : ''}{paySummary.netPercent}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1 flex-wrap">
                <span className="text-2xl font-black text-sky-400">₹{paySummary.currNet.toLocaleString()}</span>
                <span className="text-xs text-slate-400 font-bold truncate">was ₹{paySummary.prevNet.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search by Employee ID, Name, or Designation..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-amber-500"
            />
          </div>

          {/* Pay Table */}
          <div className="flex-1 bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
            <div className="overflow-x-auto custom-scrollbar flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900/90 text-slate-400 uppercase font-extrabold text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Designation</th>
                    <th className="p-3 text-right">Payable Days</th>
                    <th className="p-3 text-right">Basic Pay ({prevPeriod} ➔ {currPeriod})</th>
                    <th className="p-3 text-right">Gross Salary ({prevPeriod} ➔ {currPeriod})</th>
                    <th className="p-3 text-right">Gross Variance</th>
                    <th className="p-3 text-right">Net Pay</th>
                    <th className="p-3">Audit Alert / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredPayRows.map(r => (
                    <tr key={r.empId} className={`hover:bg-slate-800/40 transition-colors ${
                      r.status === 'NEW_JOINER' ? 'bg-emerald-950/10' :
                      r.status === 'EXITED' || r.status === 'ZERO_BASIC' ? 'bg-rose-950/15' :
                      r.status === 'HIGH_VARIANCE' ? 'bg-purple-950/20' :
                      r.status === 'PAY_CHANGED' ? 'bg-amber-950/10' : ''
                    }`}>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white">{r.name}</span>
                          {r.dol && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Resigned: {r.dol}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.empId}</div>
                      </td>
                      <td className="p-3 text-slate-300">{r.designation}</td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-slate-400">{r.prevDays}</span>
                        <ArrowRight size={10} className="inline mx-1 text-slate-600" />
                        <span className="text-white font-bold">{r.currDays}</span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-slate-400">₹{r.prevBasic.toLocaleString()}</span>
                        <ArrowRight size={10} className="inline mx-1 text-slate-600" />
                        <span className="text-white font-bold">₹{r.currBasic.toLocaleString()}</span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className="text-slate-400">₹{r.prevGross.toLocaleString()}</span>
                        <ArrowRight size={10} className="inline mx-1 text-slate-600" />
                        <span className="text-emerald-400 font-bold">₹{r.currGross.toLocaleString()}</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold">
                        <span className={r.grossDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {r.grossDiff >= 0 ? `+₹${r.grossDiff.toLocaleString()}` : `-₹${Math.abs(r.grossDiff).toLocaleString()}`}
                          {r.prevGross > 0 && ` (${r.grossPercent}%)`}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-sky-400 font-bold">
                        ₹{r.currNet.toLocaleString()}
                      </td>
                      <td className="p-3">
                        {r.alerts.length > 0 ? (
                          <div className="space-y-1">
                            {r.alerts.map((al, idx) => {
                              const isResigned = al.startsWith('Due to Employee Resigned') || al.startsWith('Absent from');
                              const isJoined = al.startsWith('Due to Newly Joined');
                              const isDaysInc = al.startsWith('Due to increase in Pay days');
                              const isLOP = al.startsWith('Due to LOP');
                              const isIncrement = al.startsWith('Due to Increment');
                              const isAnomaly = al.startsWith('Anomaly:');

                              let badgeStyle = 'bg-slate-800/80 text-slate-300 border border-slate-700/60';
                              if (isResigned || isAnomaly) {
                                badgeStyle = 'bg-rose-500/20 text-rose-300 border border-rose-500/40';
                              } else if (isJoined) {
                                badgeStyle = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
                              } else if (isDaysInc) {
                                badgeStyle = 'bg-sky-500/20 text-sky-300 border border-sky-500/40';
                              } else if (isIncrement) {
                                badgeStyle = 'bg-amber-500/20 text-amber-300 border border-amber-500/40';
                              } else if (isLOP) {
                                badgeStyle = 'bg-orange-500/20 text-orange-300 border border-orange-500/40';
                              } else if (r.status === 'HIGH_VARIANCE') {
                                badgeStyle = 'bg-violet-500/20 text-violet-300 border border-violet-500/40';
                              }

                              return (
                                <span key={idx} className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${badgeStyle}`}>
                                  {al}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-500" /> Consistent Pay
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredPayRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                        {filterMode === 'CHANGES_ONLY'
                          ? 'No salary variances, new joiners, exits, or pay anomalies detected between selected periods. All employees had consistent compensation.'
                          : 'No employees found matching the filter criteria.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default PayrollAuditTrail;
