
import React, { useState, useMemo } from 'react';
import { Upload, Table as TableIcon, CheckCircle2, AlertCircle, FileSpreadsheet, Save, Lock, AlertTriangle, Users, Edit2, X, CheckCircle, HelpCircle } from 'lucide-react';
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
  leaveLedgers: LeaveLedger[]; // Added for validation
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
  hideContextSelector = false
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false); // Used for persistent saved state

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
           { employeeId: empId, month: month, year: year, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 };
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
         [field]: newVal
      };
      setAttendances([...attendances, newRecord]);
    }
  };

  const handleSave = () => {
    if (isLocked) return;

    // VALIDATION: Check if at least one employee has non-zero data
    const hasData = employees.some(emp => {
        const att = getAttendance(emp.id);
        const total = (att.presentDays || 0) + (att.earnedLeave || 0) + (att.sickLeave || 0) + (att.casualLeave || 0) + (att.lopDays || 0);
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

    setIsSaving(true);
    // Persist to LocalStorage
    try {
        localStorage.setItem('app_attendance', JSON.stringify(attendances));
        setTimeout(() => {
            setIsSaving(false);
            setJustSaved(true);
            // NOTE: We do NOT set a timeout to revert 'justSaved'. 
            // It stays true (Green button) until handleUpdate is called (user edits something).
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

  const simulateExcelUpload = () => {
    if (isLocked) return;
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      // In a real app, this would parse the excel and update 'attendances' for the selected month
      setModalState({
          isOpen: true,
          type: 'success',
          title: 'Upload Successful',
          message: 'Verified ID, Name, and restricted LOP values for ' + employees.length + ' records.'
      });
    }, 1500);
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
                onClick={handleSave}
                disabled={isSaving || isLocked}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg disabled:opacity-50 disabled:bg-slate-700 disabled:cursor-not-allowed ${
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
                
                {isLocked ? 'Locked' : justSaved ? 'Saved' : 'Update Attendance'}
             </button>

            <button 
              onClick={simulateExcelUpload}
              disabled={isUploading || isLocked}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg disabled:opacity-50 disabled:bg-slate-700 disabled:cursor-not-allowed"
            >
              {isUploading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <Upload size={18} />}
              Excel Upload
            </button>
        </div>
      </div>

      <div className={`bg-[#1e293b] rounded-xl border border-slate-800 overflow-hidden shadow-2xl ${isLocked ? 'opacity-80 pointer-events-none' : ''}`}>
        <table className="w-full text-left">
          <thead className="bg-[#0f172a] text-sky-400 text-xs uppercase tracking-wider font-bold">
            <tr>
              <th className="px-6 py-4">Employee Identity</th>
              <th className="px-4 py-4 text-center">Present Days</th>
              <th className="px-4 py-4 text-center">EL (Earned)</th>
              <th className="px-4 py-4 text-center">SL (Sick)</th>
              <th className="px-4 py-4 text-center">CL (Casual)</th>
              <th className="px-4 py-4 text-center text-red-400">LOP</th>
              <th className="px-6 py-4">Status & Alerts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {employees.map(emp => {
              const att = getAttendance(emp.id);
              const ledger = leaveLedgers.find(l => l.employeeId === emp.id) || { el: { balance: 0 }, sl: { balance: 0 }, cl: { balance: 0 } };
              
              const totalAccounted = att.presentDays + att.earnedLeave + att.sickLeave + (att.casualLeave || 0) + att.lopDays;
              const isInvalid = totalAccounted > daysInMonth;
              
              // Validate Balances
              const isELExceeded = att.earnedLeave > (ledger.el.balance || 0);
              const isSLExceeded = att.sickLeave > (ledger.sl.balance || 0);
              const isCLExceeded = (att.casualLeave || 0) > (ledger.cl.balance || 0);

              const exceededErrors = [];
              if (isELExceeded) exceededErrors.push(`EL Balance: ${ledger.el.balance}`);
              if (isSLExceeded) exceededErrors.push(`SL Balance: ${ledger.sl.balance}`);
              if (isCLExceeded) exceededErrors.push(`CL Balance: ${ledger.cl.balance}`);

              return (
                <tr key={emp.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-white">{emp.name}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-tight font-mono">{emp.id}</div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <input disabled={isLocked} type="number" className="w-16 bg-[#0f172a] border border-slate-700 rounded p-1.5 text-center text-sm text-white font-mono disabled:opacity-50" value={att.presentDays} onChange={e => handleUpdate(emp.id, 'presentDays', +e.target.value || 0)} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="relative">
                        <input 
                            disabled={isLocked} 
                            type="number" 
                            className={`w-16 bg-[#0f172a] border rounded p-1.5 text-center text-sm font-mono disabled:opacity-50 ${isELExceeded ? 'border-red-500 text-red-400 bg-red-900/10' : 'border-slate-700 text-white'}`} 
                            value={att.earnedLeave} 
                            onChange={e => handleUpdate(emp.id, 'earnedLeave', +e.target.value || 0)} 
                        />
                        {isELExceeded && <div className="absolute -top-3 left-0 w-full text-[8px] text-red-400 font-bold bg-black/80 rounded px-1">Max: {ledger.el.balance}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="relative">
                        <input 
                            disabled={isLocked} 
                            type="number" 
                            className={`w-16 bg-[#0f172a] border rounded p-1.5 text-center text-sm font-mono disabled:opacity-50 ${isSLExceeded ? 'border-red-500 text-red-400 bg-red-900/10' : 'border-slate-700 text-white'}`} 
                            value={att.sickLeave} 
                            onChange={e => handleUpdate(emp.id, 'sickLeave', +e.target.value || 0)} 
                        />
                        {isSLExceeded && <div className="absolute -top-3 left-0 w-full text-[8px] text-red-400 font-bold bg-black/80 rounded px-1">Max: {ledger.sl.balance}</div>}
                    </div>
                  </td>
                   <td className="px-4 py-4 text-center">
                    <div className="relative">
                        <input 
                            disabled={isLocked} 
                            type="number" 
                            className={`w-16 bg-[#0f172a] border rounded p-1.5 text-center text-sm font-mono disabled:opacity-50 ${isCLExceeded ? 'border-red-500 text-red-400 bg-red-900/10' : 'border-slate-700 text-white'}`} 
                            value={att.casualLeave || 0} 
                            onChange={e => handleUpdate(emp.id, 'casualLeave', +e.target.value || 0)} 
                        />
                        {isCLExceeded && <div className="absolute -top-3 left-0 w-full text-[8px] text-red-400 font-bold bg-black/80 rounded px-1">Max: {ledger.cl.balance}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <input disabled={isLocked} type="number" className="w-16 bg-red-900/10 border border-red-900/40 rounded p-1.5 text-center text-sm text-red-200 font-bold font-mono disabled:opacity-50" value={att.lopDays} onChange={e => handleUpdate(emp.id, 'lopDays', +e.target.value || 0)} />
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
                                <div className="flex items-center gap-1 font-bold"><AlertTriangle size={12} /> Restricted Balance</div>
                                {exceededErrors.map((err, i) => <span key={i} className="text-amber-200/70">{err} - Move excess to LOP</span>)}
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
