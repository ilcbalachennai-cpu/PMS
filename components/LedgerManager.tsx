
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ClipboardList, Wallet, Save, ArrowRightLeft, TrendingUp, CheckCircle, AlertCircle, Lock, Users, CheckCircle2, Edit2, Download, Upload, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Employee, LeaveLedger, AdvanceLedger, LeavePolicy, PayrollResult } from '../types';
import { BRAND_CONFIG } from '../constants';

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
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    if (justSaved) setJustSaved(false); // Reset saved status on edit

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

  const handleBulkSaveAdvances = () => {
      if (isLocked || isReadOnly) return;
      setIsSaving(true);
      // Simulate bulk save processing
      setTimeout(() => {
          setIsSaving(false);
          setJustSaved(true);
      }, 800);
  };

  // --- PRINT LEDGER (BC/AC) ---
  const handlePrintLedger = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    
    // Title Context
    const statusText = isLocked ? "(AC) After Confirmation" : "(BC) Before Confirmation";
    const statusColor = isLocked ? [16, 185, 129] : [59, 130, 246]; // Emerald vs Blue

    // Header
    doc.setFontSize(18);
    doc.text(BRAND_CONFIG.companyName, 14, 15);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Leave Ledger Register - ${month} ${year}`, 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.text(`Status: ${statusText}`, 280, 22, { align: 'right' });
    doc.setTextColor(0);

    // Table Data
    const head = [[
        { content: 'Employee Details', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
        { content: 'Earned Leave (EL)', colSpan: 5, styles: { halign: 'center', fillColor: [219, 234, 254], textColor: 0 } },
        { content: 'Sick Leave (SL)', colSpan: 3, styles: { halign: 'center', fillColor: [209, 250, 229], textColor: 0 } },
        { content: 'Casual Leave (CL)', colSpan: 3, styles: { halign: 'center', fillColor: [254, 243, 199], textColor: 0 } }
    ], [
        // EL
        'Open', 'Credit', 'Encash', 'Avail', 'Bal',
        // SL
        'Credit', 'Avail', 'Bal',
        // CL
        'Credit', 'Avail', 'Bal'
    ]];

    const body = employees.map(emp => {
        const l = leaveLedgers.find(lx => lx.employeeId === emp.id)!;
        return [
            emp.name,
            l.el.opening, l.el.eligible, l.el.encashed, l.el.availed, l.el.balance,
            l.sl.eligible, l.sl.availed, l.sl.balance,
            l.cl.accumulation, l.cl.availed, l.cl.balance
        ];
    });

    autoTable(doc, {
        head: head,
        body: body,
        startY: 30,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 40, fontStyle: 'bold' }
        },
        didParseCell: (data) => {
            // Highlight Balance Columns
            if (data.section === 'body') {
                if (data.column.index === 5) data.cell.styles.fontStyle = 'bold'; // EL Bal
                if (data.column.index === 8) data.cell.styles.fontStyle = 'bold'; // SL Bal
                if (data.column.index === 11) data.cell.styles.fontStyle = 'bold'; // CL Bal
            }
        }
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Generated by ${BRAND_CONFIG.appName} | ${statusText}`, 14, doc.internal.pageSize.height - 10);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
    }

    doc.save(`LeaveLedger_${month}_${year}_${isLocked ? 'AC' : 'BC'}.pdf`);
  };

  // --- EXCEL HANDLING FOR ADVANCES ---
  const downloadAdvanceTemplate = () => {
    const headers = ["Employee ID", "Name", "Opening Balance", "New Advance Grant", "Monthly EMI", "Recovered So Far"];
    const data = employees.map(emp => [
        emp.id,
        emp.name,
        0, 0, 0, 0
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Advance_Ledger");
    XLSX.writeFile(wb, `Advance_Ledger_Template_${month}_${year}.xlsx`);
  };

  const handleAdvanceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked || isReadOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const newLedgers = [...advanceLedgers];
        let updateCount = 0;

        data.forEach((row: any) => {
             // Flexible matching
             const getVal = (keys: string[]) => {
                for (const k of keys) {
                    const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
                    if (foundKey && row[foundKey] !== undefined) return Number(row[foundKey]);
                }
                return 0;
            };
            const getStr = (keys: string[]) => {
                for (const k of keys) {
                    const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
                    if (foundKey && row[foundKey]) return String(row[foundKey]).trim();
                }
                return null;
            };

            const empId = getStr(['Employee ID', 'ID', 'Emp ID']);
            if (!empId) return;

            const existingIdx = newLedgers.findIndex(a => a.employeeId === empId);
            if (existingIdx === -1) return; // Only update existing employees

            const opening = getVal(['Opening Balance', 'Opening']);
            const grant = getVal(['New Advance Grant', 'Grant', 'Advance Amount']);
            const emi = getVal(['Monthly EMI', 'EMI', 'Installment']);
            const paid = getVal(['Recovered So Far', 'Recovered', 'Paid Amount']);
            
            // Calc Balance
            const balance = opening + grant - paid;

            newLedgers[existingIdx] = {
                ...newLedgers[existingIdx],
                opening: opening,
                totalAdvance: grant,
                monthlyInstallment: emi,
                paidAmount: paid,
                balance: balance
            };
            updateCount++;
        });

        setAdvanceLedgers(newLedgers);
        setJustSaved(false);
        alert(`Successfully imported advance data for ${updateCount} employees.`);
      } catch (err) {
        console.error(err);
        alert("Failed to parse Excel file.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
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
                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-[#0f172a] rounded-lg border border-slate-700 text-sm font-bold text-sky-400 uppercase tracking-widest">
                        {viewMode === 'leave' ? 'Leave Ledger' : 'Advance Ledger'}
                    </div>
                    {/* Common Bulk Save Button for Advances */}
                    {activeTab === 'advance' && !isReadOnly && (
                        <>
                        <button 
                            onClick={handleBulkSaveAdvances}
                            disabled={isSaving || isLocked}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                                justSaved
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                        >
                            {isSaving ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> 
                            ) : isLocked ? (
                                <Lock size={18} />
                            ) : justSaved ? (
                                <CheckCircle2 size={18} />
                            ) : (
                                <Edit2 size={18} />
                            )}
                            
                            {isLocked ? 'Locked' : justSaved ? 'Saved' : 'Update Advances'}
                        </button>
                        
                        <button 
                            onClick={downloadAdvanceTemplate}
                            className="flex items-center gap-2 bg-slate-700 text-slate-200 px-4 py-2.5 rounded-lg font-bold transition-all border border-slate-600 hover:bg-slate-600 text-sm"
                            title="Download Excel Template"
                        >
                            <Download size={16} /> Template
                        </button>

                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading || isLocked}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg disabled:opacity-50 disabled:bg-slate-700 disabled:cursor-not-allowed text-sm"
                        >
                            {isUploading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <Upload size={16} />}
                            Import
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleAdvanceUpload} 
                            className="hidden" 
                            accept=".xlsx, .xls" 
                        />
                        </>
                    )}
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
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
                <div className="flex gap-6">
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
                
                <div className="flex items-center gap-3">
                    {/* Month Year Display */}
                    <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-slate-700">
                        <span className="uppercase tracking-widest font-bold text-[10px] text-slate-500">Period:</span>
                        <span className="text-sky-400 font-bold text-sm">{month} {year}</span>
                    </div>

                    {/* Print BC/AC Button */}
                    <button 
                        onClick={handlePrintLedger}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border pointer-events-auto ${
                            isLocked 
                            ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/40' 
                            : 'bg-blue-900/20 text-blue-400 border-blue-900/50 hover:bg-blue-900/40'
                        }`}
                    >
                        <Printer size={14} />
                        {isLocked ? 'Print (AC)' : 'Print (BC)'}
                    </button>
                </div>
            </div>

            <div className="bg-[#1e293b] rounded-xl border border-slate-800 overflow-x-auto shadow-2xl">
            <table className="w-full text-left border-collapse">
                <thead className="bg-[#0f172a] text-[10px] text-sky-400 uppercase font-bold tracking-widest">
                <tr>
                    <th className="px-6 py-4 border-r border-slate-800">Employee Details</th>
                    {/* Added thick right border to header group */}
                    <th className="px-6 py-4 text-center bg-blue-900/10 border-r-4 border-slate-700" colSpan={5}>Earn Leave Ledger (EL)</th>
                    {/* Added thick right border to header group */}
                    <th className="px-6 py-4 text-center bg-emerald-900/10 border-r-4 border-slate-700" colSpan={3}>Sick Leave Ledger (SL)</th>
                    <th className="px-6 py-4 text-center bg-amber-900/10" colSpan={3}>Casual Leave Ledger (CL)</th>
                </tr>
                <tr className="bg-[#0f172a]/50 border-t border-slate-800 text-slate-100">
                    <th className="px-6 py-2 border-r border-slate-800"></th>
                    <th className="px-2 py-2 text-center border-r border-slate-800">OB (Open)</th>
                    <th className="px-2 py-2 text-center border-r border-slate-800">Eligible</th>
                    <th className="px-2 py-2 text-center border-r border-slate-800 text-orange-400">Encashed</th>
                    <th className="px-2 py-2 text-center border-r border-slate-800 text-pink-400">Availed</th>
                    {/* Thick border on CF Balance */}
                    <th className="px-2 py-2 text-center text-blue-400 border-r-4 border-slate-700 font-black">CF Balance</th>
                    
                    <th className="px-2 py-2 text-center border-r border-slate-800">Eligible</th>
                    <th className="px-2 py-2 text-center border-r border-slate-800 text-pink-400">Availed</th>
                    {/* Thick border on CF Balance */}
                    <th className="px-2 py-2 text-center text-emerald-400 border-r-4 border-slate-700 font-black">CF Balance</th>
                    
                    <th className="px-2 py-2 text-center border-r border-slate-800">Eligible</th>
                    <th className="px-2 py-2 text-center border-r border-slate-800 text-pink-400">Availed</th>
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
                        <td className="px-1 py-4 border-r border-slate-800"><input disabled={isLocked || isReadOnly} type="number" className="w-14 bg-transparent text-center text-orange-400 focus:bg-slate-900 font-bold font-mono disabled:opacity-50" value={l.el.encashed} onChange={e => updateLeave(emp.id, 'el', 'encashed', +e.target.value)} /></td>
                        <td className="px-1 py-4 border-r border-slate-800"><input disabled={isLocked || isReadOnly} type="number" className="w-14 bg-transparent text-center text-pink-400 focus:bg-slate-900 font-mono disabled:opacity-50" value={l.el.availed || 0} onChange={e => updateLeave(emp.id, 'el', 'availed', +e.target.value)} /></td>
                        {/* Thick border on CF Balance */}
                        <td className="px-1 py-4 border-r-4 border-slate-700 font-black text-blue-400 text-center font-mono">{l.el.balance}</td>
                        
                        {/* SL */}
                        <td className="px-1 py-4 border-r border-slate-800"><input disabled={isLocked || isReadOnly} type="number" className="w-14 bg-transparent text-center focus:bg-slate-900 text-slate-300 font-mono disabled:opacity-50" value={l.sl.eligible} onChange={e => updateLeave(emp.id, 'sl', 'eligible', +e.target.value)} /></td>
                        <td className="px-1 py-4 border-r border-slate-800"><input disabled={isLocked || isReadOnly} type="number" className="w-14 bg-transparent text-center text-pink-400 focus:bg-slate-900 font-mono disabled:opacity-50" value={l.sl.availed} onChange={e => updateLeave(emp.id, 'sl', 'availed', +e.target.value)} /></td>
                        {/* Thick border on CF Balance */}
                        <td className="px-1 py-4 border-r-4 border-slate-700 font-black text-emerald-400 text-center font-mono">{l.sl.balance}</td>
                        
                        {/* CL */}
                        <td className="px-1 py-4 border-r border-slate-800"><input disabled={isLocked || isReadOnly} type="number" className="w-14 bg-transparent text-center focus:bg-slate-900 text-slate-300 font-mono disabled:opacity-50" value={l.cl.accumulation} onChange={e => updateLeave(emp.id, 'cl', 'accumulation', +e.target.value)} /></td>
                        <td className="px-1 py-4 border-r border-slate-800"><input disabled={isLocked || isReadOnly} type="number" className="w-14 bg-transparent text-center text-pink-400 focus:bg-slate-900 font-mono disabled:opacity-50" value={l.cl.availed} onChange={e => updateLeave(emp.id, 'cl', 'availed', +e.target.value)} /></td>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {employees.map(emp => {
                const a = advanceLedgers.find(ax => ax.employeeId === emp.id)!;
                // Balance is explicitly calculated here for display, matching state update logic
                const balance = (a.opening || 0) + (a.totalAdvance || 0) - (a.paidAmount || 0);

                return (
                  <tr key={emp.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                        <div className="font-bold text-white">{emp.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{emp.id}</div>
                    </td>
                    <td className="px-6 py-4"><input disabled={isLocked || isReadOnly} type="number" className="bg-slate-900 border border-slate-700 rounded p-1.5 w-24 text-slate-300 font-mono disabled:opacity-50" value={a.opening} onChange={e => updateAdvance(emp.id, 'opening', +e.target.value)} /></td>
                    <td className="px-6 py-4"><input disabled={isLocked || isReadOnly} type="number" className="bg-slate-900 border border-slate-700 rounded p-1.5 w-24 text-slate-300 font-mono disabled:opacity-50" value={a.totalAdvance} onChange={e => updateAdvance(emp.id, 'totalAdvance', +e.target.value)} /></td>
                    <td className="px-6 py-4"><input disabled={isLocked || isReadOnly} type="number" className="bg-slate-900 border border-slate-700 rounded p-1.5 w-24 text-slate-300 font-mono disabled:opacity-50" value={a.monthlyInstallment} onChange={e => updateAdvance(emp.id, 'monthlyInstallment', +e.target.value)} /></td>
                    <td className="px-6 py-4"><span className="font-mono text-slate-400">{a.paidAmount}</span></td>
                    <td className="px-6 py-4 font-black text-blue-400 font-mono">₹{balance.toLocaleString()}</td>
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
