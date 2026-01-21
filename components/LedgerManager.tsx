
import React, { useState, useMemo, useEffect } from 'react';
import { ClipboardList, Wallet, Save, ArrowRightLeft, TrendingUp, CheckCircle, AlertCircle, Lock, Users } from 'lucide-react';
import { Employee, LeaveLedger, AdvanceLedger, LeavePolicy, PayrollResult } from '../types';

interface LedgerManagerProps {
  employees: Employee[];
  leaveLedgers: LeaveLedger[];
  setLeaveLedgers: (l: LeaveLedger[]) => void;
  advanceLedgers: AdvanceLedger[];
  setAdvanceLedgers: (a: AdvanceLedger[]) => void;
  leavePolicy: LeavePolicy;
  // New props for context and locking
  month: string;
  year: number;
  setMonth: (m: string) => void;
  setYear: (y: number) => void;
  savedRecords: PayrollResult[];
  hideContextSelector?: boolean;
  // Configuration Props
  viewMode?: 'both' | 'leave' | 'advance';
  isReadOnly?: boolean;
}

const LedgerManager: React.FC<LedgerManagerProps> = ({ 
  employees, 
  leaveLedgers, 
  setLeaveLedgers, 
  advanceLedgers, 
  setAdvanceLedgers, 
  leavePolicy,
  month,
  year,
  setMonth,
  setYear,
  savedRecords,
  hideContextSelector = false,
  viewMode = 'both',
  isReadOnly = false
}) => {
  // Initialize active tab based on viewMode
  const [activeTab, setActiveTab] = useState<'leave' | 'advance'>(viewMode === 'advance' ? 'advance' : 'leave');
  
  // Track saved state of advances per employee ID
  const [savedAdvances, setSavedAdvances] = useState<Set<string>>(new Set());

  // Ensure active tab aligns with viewMode changes
  useEffect(() => {
    if (viewMode === 'leave') setActiveTab('leave');
    if (viewMode === 'advance') setActiveTab('advance');
  }, [viewMode]);

  // Check if current month is locked
  const isLocked = useMemo(() => {
    return savedRecords.some(r => r.month === month && r.year === year && r.status === 'Finalized');
  }, [savedRecords, month, year]);

  const updateLeave = (empId: string, type: 'el' | 'sl' | 'cl', field: string, val: number) => {
    if (isLocked || isReadOnly) return;

    setLeaveLedgers(leaveLedgers.map(l => {
      if (l.employeeId === empId) {
        if (type === 'el') {
          // Validation: Encashed cannot exceed Opening + Eligible
          if (field === 'encashed') {
             const maxEncashable = (l.el.opening || 0) + (l.el.eligible || 0);
             if (val > maxEncashable) {
                 alert(`Cannot encash more than available balance (${maxEncashable} days).`);
                 return l;
             }
          }

          const updated = { ...l.el, [field]: val } as typeof l.el;
          // Updated Formula: Bal = Opening + Eligible - Encashed - Availed
          updated.balance = updated.opening + updated.eligible - updated.encashed - (updated.availed || 0);
          return { ...l, el: updated };
        } else if (type === 'sl') {
          const updated = { ...l.sl, [field]: val } as typeof l.sl;
          updated.balance = updated.eligible - updated.availed;
          return { ...l, sl: updated };
        } else {
          // cl
          const updated = { ...l.cl, [field]: val } as typeof l.cl;
          updated.balance = updated.accumulation - updated.availed;
          return { ...l, cl: updated };
        }
      }
      return l;
    }));
  };

  const updateAdvance = (empId: string, field: keyof AdvanceLedger, val: number) => {
    if (isLocked || isReadOnly) return;

    // Mark as unsaved/dirty when user types
    if (savedAdvances.has(empId)) {
        const newSet = new Set(savedAdvances);
        newSet.delete(empId);
        setSavedAdvances(newSet);
    }

    setAdvanceLedgers(advanceLedgers.map(a => {
      if (a.employeeId === empId) {
        const updated = { ...a, [field]: val };
        // Recalculate balance strictly here for consistent state
        // Balance = Opening + Total Grant - Paid
        updated.balance = (updated.opening || 0) + (updated.totalAdvance || 0) - (updated.paidAmount || 0);
        return updated;
      }
      return a;
    }));
  };

  const handleAdvanceSave = (empId: string) => {
      if (isLocked || isReadOnly) return;
      // Commit the specific advance change - Calculation already done in updateAdvance
      // We just mark as saved visually
      setSavedAdvances(prev => new Set(prev).add(empId));
  };

  if (employees.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-64 bg-[#1e293b] rounded-xl border border-slate-800 border-dashed text-slate-500">
              <Users size={48} className="mb-4 opacity-50" />
              <h3 className="text-lg font-bold text-white">No Employees Found</h3>
              <p className="text-sm">Please add employees in "Employee Master" to manage ledgers.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      
      {/* Date Context & Locking Banner */}
      <div className="flex flex-col gap-4">
          <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-white">
              {!hideContextSelector && (
                <>
                <select 
                    value={month}
                    onChange={e => setMonth(e.target.value)}
                    className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                    <option key={m} value={m}>{m}</option>
                    ))}
                </select>
                <select 
                    value={year}
                    onChange={e => setYear(+e.target.value)}
                    className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value={2024}>2024</option>
                    <option value={2025}>2025</option>
                </select>
                </>
              )}
            </div>

            {/* Tab Switching only if viewMode is 'both' */}
            {viewMode === 'both' ? (
                <div className="flex gap-4 p-1 bg-[#0f172a] rounded-xl w-fit border border-slate-700">
                    <button onClick={() => setActiveTab('leave')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'leave' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Leave Ledger</button>
                    <button onClick={() => setActiveTab('advance')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'advance' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Advance Ledger</button>
                </div>
            ) : (
                <div className="px-4 py-2 bg-[#0f172a] rounded-lg border border-slate-700 text-sm font-bold text-sky-400 uppercase tracking-widest">
                    {viewMode === 'leave' ? 'Leave Ledger' : 'Advance Ledger'}
                </div>
            )}
          </div>

          {/* Locked Status Banner */}
          {isLocked && (
            <div className="bg-amber-900/20 border border-amber-700 p-4 rounded-xl flex gap-3 items-center animate-in fade-in slide-in-from-top-2">
                <div className="p-2 bg-amber-900/40 rounded-full text-amber-400">
                    <Lock size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-amber-200 text-sm">Ledgers Locked</h3>
                    <p className="text-xs text-amber-300/80">
                        Payroll for {month} {year} has been finalized. Ledger modifications are disabled to ensure data consistency.
                        <br/> To edit, unlock the payroll period from "Pay Reports".
                    </p>
                </div>
            </div>
          )}

          {/* Read Only Banner */}
          {!isLocked && isReadOnly && (
             <div className="bg-blue-900/20 border border-blue-700 p-4 rounded-xl flex gap-3 items-center animate-in fade-in slide-in-from-top-2">
                <div className="p-2 bg-blue-900/40 rounded-full text-blue-400">
                    <ClipboardList size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-blue-200 text-sm">Read Only View</h3>
                    <p className="text-xs text-blue-300/80">
                        Leave ledgers are auto-updated based on attendance and payroll processing. Manual edits are disabled here.
                    </p>
                </div>
             </div>
          )}
      </div>

      {activeTab === 'leave' ? (
        <div className={`space-y-4 ${isLocked || isReadOnly ? 'pointer-events-none' : ''}`}>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex gap-6 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    <span>EL Max CF: <strong className="text-white">{leavePolicy.el.maxCarryForward}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>SL Max CF: <strong className="text-white">{leavePolicy.sl.maxCarryForward}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>CL Max CF: <strong className="text-white">{leavePolicy.cl.maxCarryForward}</strong></span>
                </div>
            </div>

            <div className="bg-[#1e293b] rounded-xl border border-slate-800 overflow-x-auto shadow-2xl">
            <table className="w-full text-left">
                <thead className="bg-[#0f172a] text-[10px] text-sky-400 uppercase font-bold tracking-widest">
                <tr>
                    <th className="px-6 py-4 border-r border-slate-800">Employee Details</th>
                    <th className="px-6 py-4 text-center bg-blue-900/10 border-r border-slate-800" colSpan={5}>Earn Leave Ledger (EL)</th>
                    <th className="px-6 py-4 text-center bg-emerald-900/10 border-r border-slate-800" colSpan={3}>Sick Leave Ledger (SL)</th>
                    <th className="px-6 py-4 text-center bg-amber-900/10" colSpan={3}>Casual Leave Ledger (CL)</th>
                </tr>
                <tr className="bg-[#0f172a]/50 border-t border-slate-800 text-slate-100">
                    <th className="px-6 py-2 border-r border-slate-800"></th>
                    <th className="px-2 py-2 text-center border-r border-slate-800">OB (Open)</th>
                    <th className="px-2 py-2 text-center border-r border-slate-800">Eligible</th>
                    <th className="px-2 py-2 text-center border-r border-slate-800 text-red-400">Encashed</th>
                    <th className="px-2 py-2 text-center border-r border-slate-800 text-red-400">Availed</th>
                    <th className="px-2 py-2 text-center text-blue-400 border-r border-slate-800 font-black">CF Balance</th>
                    <th className="px-2 py-2 text-center border-r border-slate-800">Eligible</th>
                    <th className="px-2 py-2 text-center border-r border-slate-800 text-red-400">Availed</th>
                    <th className="px-2 py-2 text-center text-emerald-400 border-r border-slate-800 font-black">CF Balance</th>
                    <th className="px-2 py-2 text-center border-r border-slate-800">Eligible</th>
                    <th className="px-2 py-2 text-center border-r border-slate-800 text-red-400">Availed</th>
                    <th className="px-2 py-2 text-center text-amber-400 font-black">CF Balance</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                {employees.map(emp => {
                    const l = leaveLedgers.find(lx => lx.employeeId === emp.id)!;
                    return (
                    <tr key={emp.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 border-r border-slate-800 font-bold text-white">{emp.name}</td>
                        {/* EL */}
                        <td className="px-1 py-4 border-r border-slate-800"><input disabled={isLocked || isReadOnly} type="number" className="w-14 bg-transparent text-center focus:bg-slate-900 text-slate-300 font-mono disabled:opacity-50" value={l.el.opening} onChange={e => updateLeave(emp.id, 'el', 'opening', +e.target.value)} /></td>
                        <td className="px-1 py-4 border-r border-slate-800"><input disabled={isLocked || isReadOnly} type="number" className="w-14 bg-transparent text-center focus:bg-slate-900 text-slate-300 font-mono disabled:opacity-50" value={l.el.eligible} onChange={e => updateLeave(emp.id, 'el', 'eligible', +e.target.value)} /></td>
                        <td className="px-1 py-4 border-r border-slate-800"><input disabled={isLocked || isReadOnly} type="number" className="w-14 bg-transparent text-center text-red-400 focus:bg-slate-900 font-bold font-mono disabled:opacity-50" value={l.el.encashed} onChange={e => updateLeave(emp.id, 'el', 'encashed', +e.target.value)} /></td>
                        <td className="px-1 py-4 border-r border-slate-800"><input disabled={isLocked || isReadOnly} type="number" className="w-14 bg-transparent text-center text-red-400 focus:bg-slate-900 font-mono disabled:opacity-50" value={l.el.availed || 0} onChange={e => updateLeave(emp.id, 'el', 'availed', +e.target.value)} /></td>
                        <td className="px-1 py-4 border-r border-slate-800 font-black text-blue-400 text-center font-mono">{l.el.balance}</td>
                        {/* SL */}
                        <td className="px-1 py-4 border-r border-slate-800"><input disabled={isLocked || isReadOnly} type="number" className="w-14 bg-transparent text-center focus:bg-slate-900 text-slate-300 font-mono disabled:opacity-50" value={l.sl.eligible} onChange={e => updateLeave(emp.id, 'sl', 'eligible', +e.target.value)} /></td>
                        <td className="px-1 py-4 border-r border-slate-800"><input disabled={isLocked || isReadOnly} type="number" className="w-14 bg-transparent text-center text-red-400 focus:bg-slate-900 font-mono disabled:opacity-50" value={l.sl.availed} onChange={e => updateLeave(emp.id, 'sl', 'availed', +e.target.value)} /></td>
                        <td className="px-1 py-4 border-r border-slate-800 font-black text-emerald-400 text-center font-mono">{l.sl.balance}</td>
                        {/* CL */}
                        <td className="px-1 py-4 border-r border-slate-800"><input disabled={isLocked || isReadOnly} type="number" className="w-14 bg-transparent text-center focus:bg-slate-900 text-slate-300 font-mono disabled:opacity-50" value={l.cl.accumulation} onChange={e => updateLeave(emp.id, 'cl', 'accumulation', +e.target.value)} /></td>
                        <td className="px-1 py-4 border-r border-slate-800"><input disabled={isLocked || isReadOnly} type="number" className="w-14 bg-transparent text-center text-red-400 focus:bg-slate-900 font-mono disabled:opacity-50" value={l.cl.availed} onChange={e => updateLeave(emp.id, 'cl', 'availed', +e.target.value)} /></td>
                        <td className="px-1 py-4 font-black text-amber-400 text-center font-mono">{l.cl.balance}</td>
                    </tr>
                    );
                })}
                </tbody>
            </table>
            </div>
        </div>
      ) : (
        <div className={`bg-[#1e293b] rounded-xl border border-slate-800 overflow-hidden shadow-2xl ${isLocked || isReadOnly ? 'opacity-80 pointer-events-none' : ''}`}>
          <table className="w-full text-left">
            <thead className="bg-[#0f172a] text-[10px] text-sky-400 uppercase font-bold tracking-widest">
              <tr>
                <th className="px-6 py-4">Employee Identity</th>
                <th className="px-6 py-4">Opening Balance</th>
                <th className="px-6 py-4">New Advance Grant</th>
                <th className="px-6 py-4">Monthly Installment (EMI)</th>
                <th className="px-6 py-4">Recovered So Far</th>
                <th className="px-6 py-4 text-blue-400 font-black">Balance Remaining</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {employees.map(emp => {
                const a = advanceLedgers.find(ax => ax.employeeId === emp.id)!;
                // Balance is explicitly calculated here for display, matching state update logic
                const balance = (a.opening || 0) + (a.totalAdvance || 0) - (a.paidAmount || 0);
                const isSaved = savedAdvances.has(emp.id);

                return (
                  <tr key={emp.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{emp.name}</td>
                    <td className="px-6 py-4"><input disabled={isLocked || isReadOnly} type="number" className="bg-slate-900 border border-slate-700 rounded p-1.5 w-24 text-slate-300 font-mono disabled:opacity-50" value={a.opening} onChange={e => updateAdvance(emp.id, 'opening', +e.target.value)} /></td>
                    <td className="px-6 py-4"><input disabled={isLocked || isReadOnly} type="number" className="bg-slate-900 border border-slate-700 rounded p-1.5 w-24 text-slate-300 font-mono disabled:opacity-50" value={a.totalAdvance} onChange={e => updateAdvance(emp.id, 'totalAdvance', +e.target.value)} /></td>
                    <td className="px-6 py-4"><input disabled={isLocked || isReadOnly} type="number" className="bg-slate-900 border border-slate-700 rounded p-1.5 w-24 text-slate-300 font-mono disabled:opacity-50" value={a.monthlyInstallment} onChange={e => updateAdvance(emp.id, 'monthlyInstallment', +e.target.value)} /></td>
                    <td className="px-6 py-4"><span className="font-mono text-slate-400">{a.paidAmount}</span></td>
                    <td className="px-6 py-4 font-black text-blue-400 font-mono">₹{balance.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                        {!isReadOnly && (
                        <button 
                           onClick={() => handleAdvanceSave(emp.id)}
                           disabled={isLocked}
                           className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                               isSaved 
                               ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg' 
                               : 'bg-blue-600 hover:bg-blue-700 text-white'
                           }`}
                        >
                            {isSaved ? <CheckCircle size={14} /> : <Save size={14} />}
                            {isSaved ? 'Saved' : 'Update Grant'}
                        </button>
                        )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LedgerManager;
