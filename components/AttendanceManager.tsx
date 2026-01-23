
import React, { useState, useMemo, useRef } from 'react';
import { Upload, Table as TableIcon, CheckCircle2, AlertCircle, FileSpreadsheet, Save, Lock, AlertTriangle, Users, Edit2, X, CheckCircle, HelpCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, Attendance, PayrollResult, LeaveLedger } from '../types';

interface AttendanceManagerProps {
  employees: Employee[];
  attendances: Attendance[];
  setAttendances: (att: Attendance[]) => void;
  // New props for global state
  month: string;
  year: number;
  setMonth: (m: string) => void;
  setYear: (y: number) => void;
  savedRecords: PayrollResult[];
  leaveLedgers: LeaveLedger[]; 
  setLeaveLedgers?: (ledgers: LeaveLedger[]) => void; // Added setter for syncing
  hideContextSelector?: boolean;
}

const AttendanceManager: React.FC<AttendanceManagerProps> = ({ 
  employees, 
  attendances, 
  setAttendances,
  month,
  year,
  setMonth,
  setYear,
  savedRecords,
  leaveLedgers,
  setLeaveLedgers,
  hideContextSelector = false
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false); // Used for persistent saved state
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'success' | 'error';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'confirm', title: '', message: '' });

  const daysInMonth = new Date(year, ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(month) + 1, 0).getDate();

  // Check if current month is locked
  const isLocked = useMemo(() => {
    return savedRecords.some(r => r.month === month && r.year === year && r.status === 'Finalized');
  }, [savedRecords, month, year]);

  // Helper to get or create attendance record for current view
  const getAttendance = (empId: string) => {
    return attendances.find(a => a.employeeId === empId && a.month === month && a.year === year) || 
           { employeeId: empId, month: month, year: year, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0, encashedDays: 0 };
  };

  const handleUpdate = (empId: string, field: keyof Attendance, value: number) => {
    if (isLocked) return; 

    // Reset saved state immediately when user types/edits data
    if (justSaved) setJustSaved(false);

    // Check if record exists
    const exists = attendances.some(a => a.employeeId === empId && a.month === month && a.year === year);
    
    let newVal = Math.max(0, value);
    // Basic validation, strict validation happens on save/render
    if (field === 'lopDays' || field === 'presentDays' || field === 'earnedLeave' || field === 'sickLeave' || field === 'casualLeave') {
      newVal = Math.min(newVal, daysInMonth);
    }
    // Encashment validation (logic wise, you can't encash more than 30 usually, but validation against balance happens in render/save)
    if (field === 'encashedDays') {
        newVal = Math.max(0, value); 
    }

    if (exists) {
      setAttendances(attendances.map(a => {
        if (a.employeeId === empId && a.month === month && a.year === year) {
          return { ...a, [field]: newVal };
        }
        return a;
      }));
    } else {
      // Create new record if it doesn't exist for this specific month/year
      const newRecord: Attendance = {
         employeeId: empId,
         month: month,
         year: year,
         presentDays: 0,
         earnedLeave: 0,
         sickLeave: 0,
         casualLeave: 0,
         lopDays: 0,
         encashedDays: 0,
         [field]: newVal
      };
      setAttendances([...attendances, newRecord]);
    }
  };

  const handleSave = () => {
    if (isLocked) return;

    // VALIDATION 1: Check if at least one employee has non-zero data
    const hasData = employees.some(emp => {
        const att = getAttendance(emp.id);
        const total = (att.presentDays || 0) + (att.earnedLeave || 0) + (att.sickLeave || 0) + (att.casualLeave || 0) + (att.lopDays || 0) + (att.encashedDays || 0);
        return total > 0;
    });

    if (!hasData) {
        setModalState({
            isOpen: true,
            type: 'error',
            title: 'Validation Failed',
            message: '"0" value for the entire month not allowed, at least one employee attendance is required.'
        });
        return;
    }

    // VALIDATION 2: Check Ledger Balances against CAPACITY (Opening + Eligible)
    // We check against Total Capacity because Balance might be reduced if we already saved once.
    const ledgerErrors = employees.filter(emp => {
        const att = getAttendance(emp.id);
        const ledger = leaveLedgers.find(l => l.employeeId === emp.id);
        if (!ledger) return false;

        const elUsed = (att.earnedLeave || 0) + (att.encashedDays || 0);
        const elCapacity = (ledger.el.opening || 0) + (ledger.el.eligible || 0);
        const isELExceeded = elUsed > elCapacity;

        const slCapacity = (ledger.sl.eligible || 0); // Assuming SL eligible includes opening/total for year/month
        const isSLExceeded = att.sickLeave > slCapacity;

        const clCapacity = (ledger.cl.accumulation || 0); // CL uses accumulation as total available
        const isCLExceeded = (att.casualLeave || 0) > clCapacity;

        return isELExceeded || isSLExceeded || isCLExceeded;
    });

    if (ledgerErrors.length > 0) {
        setModalState({
            isOpen: true,
            type: 'error',
            title: 'Balance Exceeded',
            message: `Cannot save: Leave usage exceeds available limit for ${ledgerErrors.length} employee(s).\n\nEnsure usage does not exceed Opening + Eligible credits.`
        });
        return;
    }

    setIsSaving(true);
    
    // 1. Sync Attendance to Leave Ledgers (Update Availed & Balance)
    if (setLeaveLedgers) {
        const updatedLedgers = leaveLedgers.map(ledger => {
            const att = getAttendance(ledger.employeeId);
            
            // Recalculate Balances based on Current Attendance
            // EL
            const elAvailed = att.earnedLeave || 0;
            const elEncashed = att.encashedDays || 0;
            const elBalance = (ledger.el.opening + ledger.el.eligible) - elEncashed - elAvailed;

            // SL
            const slAvailed = att.sickLeave || 0;
            const slBalance = (ledger.sl.eligible) - slAvailed;

            // CL
            const clAvailed = att.casualLeave || 0;
            const clBalance = (ledger.cl.accumulation) - clAvailed;

            return {
                ...ledger,
                el: { ...ledger.el, availed: elAvailed, encashed: elEncashed, balance: elBalance },
                sl: { ...ledger.sl, availed: slAvailed, balance: slBalance },
                cl: { ...ledger.cl, availed: clAvailed, balance: clBalance }
            };
        });
        setLeaveLedgers(updatedLedgers);
    }

    // 2. Persist Attendance
    try {
        localStorage.setItem('app_attendance', JSON.stringify(attendances));
        setTimeout(() => {
            setIsSaving(false);
            setJustSaved(true);
        }, 800);
    } catch (e) {
        console.error(e);
        setIsSaving(false);
        setModalState({
            isOpen: true,
            type: 'error',
            title: 'Save Failed',
            message: 'Could not save attendance to local storage.'
        });
    }
  };

  const downloadTemplate = () => {
    const headers = ["Employee ID", "Name", "Present Days", "EL (Availed)", "EL Encash", "SL (Sick)", "CL (Casual)", "LOP"];
    // Pre-fill with current employees
    const data = employees.map(emp => [
        emp.id,
        emp.name,
        0, 0, 0, 0, 0, 0
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `Attendance_Template_${month}_${year}.xlsx`);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
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

        const newAttendances = [...attendances];
        let updateCount = 0;

        data.forEach((row: any) => {
            // Flexible key matching helper
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

            // Update existing or create new for THIS MONTH/YEAR
            const existingIdx = newAttendances.findIndex(a => a.employeeId === empId && a.month === month && a.year === year);
            
            // Clean inputs
            const present = Math.min(getVal(['Present Days', 'Present', 'Paid Days']) || 0, daysInMonth);
            const el = getVal(['EL (Availed)', 'EL', 'Earned Leave', 'EL (Earned)']);
            const encash = getVal(['EL Encash', 'Encashment', 'EL Encashed']);
            const sl = getVal(['SL (Sick)', 'SL', 'Sick Leave']);
            const cl = getVal(['CL (Casual)', 'CL', 'Casual Leave']);
            const lop = getVal(['LOP', 'Loss of Pay', 'Absent']);

            const attRecord: Attendance = {
                employeeId: empId,
                month,
                year,
                presentDays: present,
                earnedLeave: el,
                sickLeave: sl,
                casualLeave: cl,
                lopDays: lop,
                encashedDays: encash
            };

            if (existingIdx >= 0) {
                newAttendances[existingIdx] = attRecord;
            } else {
                newAttendances.push(attRecord);
            }
            updateCount++;
        });

        setAttendances(newAttendances);
        setJustSaved(false); // Reset saved status as data changed
        setModalState({
            isOpen: true,
            type: 'success',
            title: 'Import Successful',
            message: `Updated attendance records for ${updateCount} employees.\n\nPlease review and click 'Update Attendance' to save.`
        });

      } catch (error: any) {
          console.error(error);
          setModalState({
            isOpen: true,
            type: 'error',
            title: 'Import Failed',
            message: 'Could not parse Excel file. Please use the template.'
        });
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
              <p className="text-sm">Please add employees in "Employee Master" to manage attendance.</p>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      
      {/* Locked Status Banner */}
      {isLocked && (
        <div className="bg-amber-900/20 border border-amber-700 p-4 rounded-xl flex gap-3 items-center animate-in fade-in slide-in-from-top-2">
            <div className="p-2 bg-amber-900/40 rounded-full text-amber-400">
                <Lock size={20} />
            </div>
            <div>
                <h3 className="font-bold text-amber-200 text-sm">Attendance Locked</h3>
                <p className="text-xs text-amber-300/80">
                    Payroll for {month} {year} has been finalized. Attendance modification is disabled to ensure data integrity.
                    <br/> To edit, unlock the payroll period from "Pay Reports".
                </p>
            </div>
        </div>
      )}

      {/* Saved/Read-Only Status Banner */}
      {!isLocked && justSaved && (
        <div className="bg-emerald-900/20 border border-emerald-700 p-4 rounded-xl flex gap-3 items-center animate-in fade-in slide-in-from-top-2">
            <div className="p-2 bg-emerald-900/40 rounded-full text-emerald-400">
                <CheckCircle2 size={20} />
            </div>
            <div>
                <h3 className="font-bold text-emerald-200 text-sm">Attendance Saved & Synced</h3>
                <p className="text-xs text-emerald-300/80">
                    Data is currently in <b>Read-Only</b> mode. Click 'Modify Attendance' to make changes.
                </p>
            </div>
        </div>
      )}

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
          <div className="text-sm text-slate-300 pl-4 border-l border-slate-700">
            Total days: <span className="text-sky-400 font-bold">{daysInMonth}</span>
          </div>
        </div>

        <div className="flex gap-3">
             <button 
                onClick={justSaved ? () => setJustSaved(false) : handleSave}
                disabled={isSaving || isLocked}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg disabled:opacity-50 disabled:bg-slate-700 disabled:cursor-not-allowed ${
                    justSaved
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-900/20' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20'
                }`}
             >
                {isSaving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> 
                ) : isLocked ? (
                    <Lock size={18} />
                ) : justSaved ? (
                    <Edit2 size={18} />
                ) : (
                    <Save size={18} />
                )}
                
                {isLocked ? 'Locked' : justSaved ? 'Modify Attendance' : 'Save Attendance'}
             </button>

            <button 
                onClick={downloadTemplate}
                className="flex items-center gap-2 bg-slate-700 text-slate-200 px-4 py-2.5 rounded-lg font-bold transition-all border border-slate-600 hover:bg-slate-600 text-sm"
                title="Download Excel Template"
            >
                <Download size={16} /> Template
            </button>

            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isLocked}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg disabled:opacity-50 disabled:bg-slate-700 disabled:cursor-not-allowed"
            >
              {isUploading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <Upload size={18} />}
              Excel Import
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleExcelUpload} 
                className="hidden" 
                accept=".xlsx, .xls" 
            />
        </div>
      </div>

      <div className={`bg-[#1e293b] rounded-xl border border-slate-800 overflow-hidden shadow-2xl ${isLocked ? 'opacity-80 pointer-events-none' : ''}`}>
        <table className="w-full text-left">
          <thead className="bg-[#0f172a] text-sky-400 text-xs uppercase tracking-wider font-bold">
            <tr>
              <th className="px-6 py-4">Employee Identity</th>
              <th className="px-4 py-4 text-center">Present Days</th>
              {/* UPDATED: Renamed from EL (Earned) to EL (Availed) */}
              <th className="px-4 py-4 text-center">EL (Availed)</th>
              {/* UPDATED: Font color to Orange */}
              <th className="px-4 py-4 text-center text-orange-400">EL Encash</th>
              <th className="px-4 py-4 text-center">SL (Sick)</th>
              <th className="px-4 py-4 text-center">CL (Casual)</th>
              <th className="px-4 py-4 text-center text-red-400">LOP</th>
              <th className="px-6 py-4">Status & Alerts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {employees.map(emp => {
              const att = getAttendance(emp.id);
              const ledger = leaveLedgers.find(l => l.employeeId === emp.id) || { el: { balance: 0, opening: 0, eligible: 0 }, sl: { balance: 0, eligible: 0 }, cl: { balance: 0, accumulation: 0 } };
              
              const totalAccounted = att.presentDays + att.earnedLeave + att.sickLeave + (att.casualLeave || 0) + att.lopDays;
              const isInvalid = totalAccounted > daysInMonth;
              
              // Validate Balances against CAPACITY (Opening + Eligible) to avoid double counting regression
              const elUsed = (att.earnedLeave || 0) + (att.encashedDays || 0);
              const elCapacity = (ledger.el.opening || 0) + (ledger.el.eligible || 0);
              const isELExceeded = elUsed > elCapacity;

              const slCapacity = (ledger.sl.eligible || 0);
              const isSLExceeded = att.sickLeave > slCapacity;

              const clCapacity = (ledger.cl.accumulation || 0);
              const isCLExceeded = (att.casualLeave || 0) > clCapacity;

              const exceededErrors = [];
              if (isELExceeded) exceededErrors.push(`EL Limit: ${elCapacity}`);
              if (isSLExceeded) exceededErrors.push(`SL Limit: ${slCapacity}`);
              if (isCLExceeded) exceededErrors.push(`CL Limit: ${clCapacity}`);

              // Force disable if saved or locked
              const inputDisabled = isLocked || justSaved;

              return (
                <tr key={emp.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-white">{emp.name}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-tight font-mono">{emp.id}</div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <input disabled={inputDisabled} type="number" className="w-16 bg-[#0f172a] border border-slate-700 rounded p-1.5 text-center text-sm text-white font-mono disabled:opacity-50" value={att.presentDays} onChange={e => handleUpdate(emp.id, 'presentDays', +e.target.value || 0)} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="relative">
                        <input 
                            disabled={inputDisabled} 
                            type="number" 
                            className={`w-16 bg-[#0f172a] border rounded p-1.5 text-center text-sm font-mono disabled:opacity-50 ${isELExceeded ? 'border-red-500 text-red-400 bg-red-900/10' : 'border-slate-700 text-white'}`} 
                            value={att.earnedLeave} 
                            onChange={e => handleUpdate(emp.id, 'earnedLeave', +e.target.value || 0)} 
                        />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="relative">
                        {/* UPDATED: Input styling to Orange */}
                        <input 
                            disabled={inputDisabled} 
                            type="number" 
                            className={`w-16 bg-orange-900/20 border rounded p-1.5 text-center text-sm font-mono font-bold disabled:opacity-50 ${isELExceeded ? 'border-red-500 text-red-500 bg-red-900/10' : 'border-orange-900/50 text-orange-400'}`} 
                            value={att.encashedDays || 0} 
                            onChange={e => handleUpdate(emp.id, 'encashedDays', +e.target.value || 0)} 
                        />
                        {isELExceeded && <div className="absolute -top-3 left-0 w-full text-[8px] text-red-400 font-bold bg-black/80 rounded px-1">Max: {elCapacity}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="relative">
                        <input 
                            disabled={inputDisabled} 
                            type="number" 
                            className={`w-16 bg-[#0f172a] border rounded p-1.5 text-center text-sm font-mono disabled:opacity-50 ${isSLExceeded ? 'border-red-500 text-red-400 bg-red-900/10' : 'border-slate-700 text-white'}`} 
                            value={att.sickLeave} 
                            onChange={e => handleUpdate(emp.id, 'sickLeave', +e.target.value || 0)} 
                        />
                        {isSLExceeded && <div className="absolute -top-3 left-0 w-full text-[8px] text-red-400 font-bold bg-black/80 rounded px-1">Max: {slCapacity}</div>}
                    </div>
                  </td>
                   <td className="px-4 py-4 text-center">
                    <div className="relative">
                        <input 
                            disabled={inputDisabled} 
                            type="number" 
                            className={`w-16 bg-[#0f172a] border rounded p-1.5 text-center text-sm font-mono disabled:opacity-50 ${isCLExceeded ? 'border-red-500 text-red-400 bg-red-900/10' : 'border-slate-700 text-white'}`} 
                            value={att.casualLeave || 0} 
                            onChange={e => handleUpdate(emp.id, 'casualLeave', +e.target.value || 0)} 
                        />
                        {isCLExceeded && <div className="absolute -top-3 left-0 w-full text-[8px] text-red-400 font-bold bg-black/80 rounded px-1">Max: {clCapacity}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <input disabled={inputDisabled} type="number" className="w-16 bg-red-900/10 border border-red-900/40 rounded p-1.5 text-center text-sm text-red-200 font-bold font-mono disabled:opacity-50" value={att.lopDays} onChange={e => handleUpdate(emp.id, 'lopDays', +e.target.value || 0)} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                        {isInvalid && (
                        <div className="flex items-center gap-1.5 text-red-400 text-xs font-bold bg-red-950/20 px-2 py-1 rounded border border-red-900/50">
                            <AlertCircle size={14} /> Total &gt; {daysInMonth}
                        </div>
                        )}
                        {exceededErrors.length > 0 ? (
                            <div className="flex flex-col gap-1 text-[10px] text-amber-400 bg-amber-900/20 px-2 py-1 rounded border border-amber-900/50">
                                <div className="flex items-center gap-1 font-bold"><AlertTriangle size={12} /> Restricted Limit</div>
                                {exceededErrors.map((err, i) => <span key={i} className="text-amber-200/70">{err}</span>)}
                            </div>
                        ) : !isInvalid && (
                            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold bg-emerald-950/20 px-2 py-1 rounded border border-emerald-900/50 w-fit">
                                <CheckCircle2 size={14} /> Validated
                            </div>
                        )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* GENERAL NOTIFICATION / CONFIRMATION MODAL */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setModalState({ ...modalState, isOpen: false })} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                    <X size={20} />
                </button>
                <div className="flex flex-col items-center gap-2">
                    <div className={`p-3 rounded-full border ${
                        modalState.type === 'error' ? 'bg-red-900/30 text-red-500 border-red-900/50' : 
                        modalState.type === 'success' ? 'bg-emerald-900/30 text-emerald-500 border-emerald-900/50' :
                        'bg-blue-900/30 text-blue-500 border-blue-900/50'
                    }`}>
                        {modalState.type === 'error' ? <AlertTriangle size={24} /> : 
                         modalState.type === 'success' ? <CheckCircle size={24} /> : 
                         <HelpCircle size={24} />}
                    </div>
                    <h3 className="text-lg font-bold text-white text-center">{modalState.title}</h3>
                    <p className="text-sm text-slate-400 text-center whitespace-pre-line">{modalState.message}</p>
                </div>
                
                <div className="flex gap-3 mt-4">
                    {modalState.type === 'confirm' ? (
                        <>
                            <button 
                                onClick={() => setModalState({ ...modalState, isOpen: false })}
                                className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 font-bold hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={modalState.onConfirm}
                                className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg"
                            >
                                Confirm
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => setModalState({ ...modalState, isOpen: false })}
                            className="w-full py-2.5 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition-colors"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManager;
