
import React, { useState, useRef, useMemo } from 'react';
import { Save, Upload, Download, Lock, AlertTriangle, CheckCircle2, X, Wallet, ClipboardList, Edit2, UserX } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, LeaveLedger, AdvanceLedger, PayrollResult, LeavePolicy } from '../types';

interface LedgerManagerProps {
  employees: Employee[];
  leaveLedgers: LeaveLedger[];
  setLeaveLedgers?: (ledgers: LeaveLedger[]) => void;
  advanceLedgers: AdvanceLedger[];
  setAdvanceLedgers?: (ledgers: AdvanceLedger[]) => void;
  leavePolicy: LeavePolicy;
  month: string;
  year: number;
  setMonth: (m: string) => void;
  setYear: (y: number) => void;
  savedRecords: PayrollResult[];
  hideContextSelector?: boolean;
  viewMode?: 'leave' | 'advance';
  isReadOnly?: boolean;
}

const LedgerManager: React.FC<LedgerManagerProps> = ({
  employees,
  leaveLedgers,
  setLeaveLedgers,
  advanceLedgers,
  setAdvanceLedgers,
  month,
  year,
  savedRecords,
  hideContextSelector = false,
  viewMode = 'leave',
  isReadOnly = false
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false); // State to track saved/read-only mode
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Custom Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'success' | 'error';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'confirm', title: '', message: '' });

  // Check lock status
  const isLocked = useMemo(() => {
    return savedRecords.some(r => r.month === month && r.year === year && r.status === 'Finalized');
  }, [savedRecords, month, year]);

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const filteredEmployees = useMemo(() => {
    const monthIdx = months.indexOf(month);
    const periodStart = new Date(year, monthIdx, 1);
    periodStart.setHours(0,0,0,0);

    return employees.filter(emp => {
        // 1. Determine if Active
        let isActive = true;
        if (emp.dol) {
            const [y, m, d] = emp.dol.split('-').map(Number);
            const dolDate = new Date(y, m - 1, d);
            dolDate.setHours(0,0,0,0);
            isActive = dolDate >= periodStart;
        }

        if (viewMode === 'leave') {
            // For Leave: Only show active employees
            return isActive;
        } else {
            // For Advance: Show Active OR (Inactive with Balance > 0)
            if (isActive) return true;
            
            const ledger = advanceLedgers.find(a => a.employeeId === emp.id);
            // Must have positive balance to appear
            return ledger && ledger.balance > 0;
        }
    });
  }, [employees, month, year, viewMode, advanceLedgers]);

  const handleLeaveUpdate = (empId: string, field: 'el' | 'sl' | 'cl', subField: string, value: number) => {
      if (isLocked || isReadOnly || justSaved || !setLeaveLedgers) return;

      const exists = leaveLedgers.some(l => l.employeeId === empId);

      if (exists) {
        const updated = leaveLedgers.map(l => {
            if (l.employeeId === empId) {
               return {
                   ...l,
                   [field]: {
                       ...l[field],
                       [subField]: value
                   }
               };
            }
            return l;
        });
        setLeaveLedgers(updated);
      } else {
        // Create new record if missing
        const newRecord: LeaveLedger = {
            employeeId: empId,
            el: { opening: 0, eligible: 0, encashed: 0, availed: 0, balance: 0 },
            sl: { eligible: 0, availed: 0, balance: 0 },
            cl: { availed: 0, accumulation: 0, balance: 0 },
            [field]: { ...{ opening: 0, eligible: 0, encashed: 0, availed: 0, balance: 0, accumulation: 0 }, [subField]: value }
        };
        // Ensure structure consistency for nested object spread above
        if (field === 'el') newRecord.el[subField as keyof typeof newRecord.el] = value;
        if (field === 'sl') newRecord.sl[subField as keyof typeof newRecord.sl] = value;
        if (field === 'cl') newRecord.cl[subField as keyof typeof newRecord.cl] = value;

        setLeaveLedgers([...leaveLedgers, newRecord]);
      }
  };

  const handleAdvanceUpdate = (empId: string, field: keyof AdvanceLedger, value: number) => {
      if (isLocked || isReadOnly || justSaved || !setAdvanceLedgers) return;
      
      const exists = advanceLedgers.some(a => a.employeeId === empId);

      if (exists) {
        const updated = advanceLedgers.map(a => {
            if (a.employeeId === empId) {
               const newRecord = { ...a, [field]: value };
               // Auto-calc balance
               if (field === 'totalAdvance' || field === 'paidAmount' || field === 'opening') {
                   newRecord.balance = (newRecord.opening || 0) + (newRecord.totalAdvance || 0) - (newRecord.paidAmount || 0);
               }
               return newRecord;
            }
            return a;
        });
        setAdvanceLedgers(updated);
      } else {
        // Create new record
        const newRecord: AdvanceLedger = {
            employeeId: empId,
            opening: 0,
            totalAdvance: 0,
            monthlyInstallment: 0,
            paidAmount: 0,
            balance: 0,
            [field]: value
        };
        // Auto-calc balance
        if (field === 'totalAdvance' || field === 'paidAmount' || field === 'opening') {
            newRecord.balance = (newRecord.opening || 0) + (newRecord.totalAdvance || 0) - (newRecord.paidAmount || 0);
        }
        setAdvanceLedgers([...advanceLedgers, newRecord]);
      }
  };

  const handleSave = () => {
    if (isLocked || isReadOnly) return;
    setIsSaving(true);
    // Simulate save (persistence is handled by parent via useEffect)
    setTimeout(() => {
        setIsSaving(false);
        setJustSaved(true); // Enable Read-Only mode
        setModalState({
            isOpen: true,
            type: 'success',
            title: 'Ledgers Updated',
            message: 'Ledger changes have been saved locally.'
        });
    }, 500);
  };

  const downloadTemplate = () => {
      const wb = XLSX.utils.book_new();
      
      if (viewMode === 'leave') {
          const headers = ["Employee ID", "Name", "EL Opening", "SL Opening", "CL Opening"];
          const data = filteredEmployees.map(e => {
              const l = leaveLedgers.find(led => led.employeeId === e.id);
              return [e.id, e.name, l?.el.opening || 0, l?.sl.eligible || 0, l?.cl.accumulation || 0]; 
          });
          const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
          XLSX.utils.book_append_sheet(wb, ws, "Leave_Ledger");
      } else {
          const headers = ["Employee ID", "Name", "Advance Amount", "Monthly EMI", "Paid Amount"];
          const data = filteredEmployees.map(e => {
              const a = advanceLedgers.find(adv => adv.employeeId === e.id);
              return [e.id, e.name, a?.totalAdvance || 0, a?.monthlyInstallment || 0, a?.paidAmount || 0];
          });
          const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
          XLSX.utils.book_append_sheet(wb, ws, "Advance_Ledger");
      }
      
      XLSX.writeFile(wb, `${viewMode}_Ledger_Template.xlsx`);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isLocked || isReadOnly || justSaved) return;
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const ws = wb.Sheets[wb.SheetNames[0]];
              const data = XLSX.utils.sheet_to_json(ws);
              
              if (viewMode === 'leave' && setLeaveLedgers) {
                  const newLedgers = [...leaveLedgers];
                  let count = 0;
                  data.forEach((row: any) => {
                      const id = row['Employee ID'] || row['ID'];
                      if (filteredEmployees.some(e => e.id === id)) {
                          const idx = newLedgers.findIndex(l => l.employeeId === id);
                          if (idx >= 0) {
                              newLedgers[idx].el.opening = Number(row['EL Opening'] || newLedgers[idx].el.opening);
                              newLedgers[idx].sl.eligible = Number(row['SL Opening'] || newLedgers[idx].sl.eligible);
                              newLedgers[idx].cl.accumulation = Number(row['CL Opening'] || newLedgers[idx].cl.accumulation);
                          } else {
                              newLedgers.push({
                                  employeeId: id,
                                  el: { opening: Number(row['EL Opening'] || 0), eligible: 0, encashed: 0, availed: 0, balance: Number(row['EL Opening'] || 0) },
                                  sl: { eligible: Number(row['SL Opening'] || 0), availed: 0, balance: Number(row['SL Opening'] || 0) },
                                  cl: { accumulation: Number(row['CL Opening'] || 0), availed: 0, balance: Number(row['CL Opening'] || 0) }
                              });
                          }
                          count++;
                      }
                  });
                  setLeaveLedgers(newLedgers);
                  setModalState({ isOpen: true, type: 'success', title: 'Import Successful', message: `Updated leave ledgers for ${count} records.` });

              } else if (viewMode === 'advance' && setAdvanceLedgers) {
                   const newLedgers = [...advanceLedgers];
                   let count = 0;
                   data.forEach((row: any) => {
                       const id = row['Employee ID'] || row['ID'];
                       if (filteredEmployees.some(e => e.id === id)) {
                           const idx = newLedgers.findIndex(l => l.employeeId === id);
                           
                           const totalAdvance = Number(row['Advance Amount'] || 0);
                           const monthlyInstallment = Number(row['Monthly EMI'] || 0);
                           const paidAmount = Number(row['Paid Amount'] || 0);

                           if (idx >= 0) {
                               newLedgers[idx].totalAdvance = totalAdvance;
                               newLedgers[idx].monthlyInstallment = monthlyInstallment;
                               newLedgers[idx].paidAmount = paidAmount;
                               newLedgers[idx].balance = (newLedgers[idx].opening || 0) + newLedgers[idx].totalAdvance - newLedgers[idx].paidAmount;
                           } else {
                               newLedgers.push({
                                   employeeId: id,
                                   opening: 0,
                                   totalAdvance,
                                   monthlyInstallment,
                                   paidAmount,
                                   balance: totalAdvance - paidAmount
                               });
                           }
                           count++;
                       }
                   });
                   setAdvanceLedgers(newLedgers);
                   setModalState({ isOpen: true, type: 'success', title: 'Import Successful', message: `Updated advance ledgers for ${count} records.` });
              }
          } catch (err) {
              setModalState({ isOpen: true, type: 'error', title: 'Error', message: 'Failed to parse file.' });
          } finally {
              setIsUploading(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsBinaryString(file);
  };

  const currentModeTitle = viewMode === 'leave' ? 'Leave Ledger' : 'Advance Ledger';
  const Icon = viewMode === 'leave' ? ClipboardList : Wallet;

  return (
    <div className="space-y-6">
       {/* Locked Banner */}
       {isLocked && (
        <div className="bg-amber-900/20 border border-amber-700 p-4 rounded-xl flex gap-3 items-center animate-in fade-in slide-in-from-top-2">
            <Lock size={20} className="text-amber-400" />
            <div>
                <h3 className="font-bold text-amber-200 text-sm">Ledgers Locked</h3>
                <p className="text-xs text-amber-300/80">Payroll finalized. Ledgers cannot be modified.</p>
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
                <h3 className="font-bold text-emerald-200 text-sm">Ledgers Saved</h3>
                <p className="text-xs text-emerald-300/80">
                    Data is currently in <b>Read-Only</b> mode. Click 'Modify {viewMode === 'leave' ? 'Leave' : 'Advance'}' to make changes.
                </p>
            </div>
        </div>
       )}

       <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl border ${viewMode === 'leave' ? 'bg-emerald-900/30 border-emerald-500/20 text-emerald-400' : 'bg-blue-900/30 border-blue-500/20 text-blue-400'}`}>
                  <Icon size={24} />
              </div>
              <div>
                  <h2 className="text-lg font-bold text-white">{currentModeTitle}</h2>
                  {!hideContextSelector && (
                      <p className="text-xs text-slate-400">{month} {year}</p>
                  )}
              </div>
          </div>
          
          <div className="flex gap-3">
              {!isReadOnly && !isLocked && (
                  <>
                  <button 
                    onClick={justSaved ? () => setJustSaved(false) : handleSave} 
                    disabled={isSaving} 
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg ${
                        justSaved 
                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-900/20' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                      {isSaving ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> 
                      ) : justSaved ? (
                          <Edit2 size={16} />
                      ) : (
                          <Save size={16} />
                      )}
                      {justSaved ? `Modify ${viewMode === 'leave' ? 'Leave' : 'Advance'}` : 'Save Changes'}
                  </button>
                  <button onClick={downloadTemplate} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2.5 rounded-lg font-bold text-sm border border-slate-600">
                      <Download size={16} /> Template
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isUploading || justSaved} 
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg disabled:opacity-50 disabled:bg-slate-700 disabled:cursor-not-allowed"
                    title="Import Excel Data"
                  >
                      {isUploading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <Upload size={16} />}
                      Import
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleExcelImport} className="hidden" accept=".xlsx, .xls" />
                  </>
              )}
          </div>
       </div>
       
       <div className="bg-[#1e293b] rounded-xl border border-slate-800 overflow-hidden shadow-2xl overflow-x-auto">
           <table className="w-full text-left">
               <thead className="bg-[#0f172a] text-xs font-bold uppercase text-slate-400">
                   <tr>
                       <th className="px-6 py-4">Employee</th>
                       {viewMode === 'leave' ? (
                           <>
                               <th className="px-4 py-4 text-center">EL Opening</th>
                               <th className="px-4 py-4 text-center">EL Credit</th>
                               <th className="px-4 py-4 text-center">EL Balance</th>
                               <th className="px-4 py-4 text-center">SL Balance</th>
                               <th className="px-4 py-4 text-center">CL Balance</th>
                           </>
                       ) : (
                           <>
                               <th className="px-4 py-4 text-center">Opening</th>
                               <th className="px-4 py-4 text-center">New Advance</th>
                               <th className="px-4 py-4 text-center">Paid Manual</th>
                               <th className="px-4 py-4 text-center">EMI</th>
                               <th className="px-4 py-4 text-center font-bold text-white">Balance</th>
                           </>
                       )}
                   </tr>
               </thead>
               <tbody className="divide-y divide-slate-800">
                   {filteredEmployees.map(emp => {
                       // Common disabled state for inputs
                       const baseDisabled = isReadOnly || isLocked || justSaved;

                       if (viewMode === 'leave') {
                           const l = leaveLedgers.find(led => led.employeeId === emp.id) || { el: { opening: 0, eligible: 0, balance: 0 }, sl: { balance: 0, eligible: 0 }, cl: { balance: 0, accumulation: 0 } };
                           return (
                               <tr key={emp.id} className="hover:bg-slate-800/50">
                                   <td className="px-6 py-4"><div className="text-sm font-bold text-white">{emp.name}</div><div className="text-[10px] text-slate-500">{emp.id}</div></td>
                                   <td className="px-4 py-4 text-center text-slate-300 font-mono text-sm">{l.el.opening}</td>
                                   <td className="px-4 py-4 text-center"><input disabled={baseDisabled} type="number" className="w-16 bg-[#0f172a] border border-slate-700 rounded p-1 text-center text-white text-sm disabled:opacity-50" value={l.el.eligible} onChange={e => handleLeaveUpdate(emp.id, 'el', 'eligible', +e.target.value)} /></td>
                                   <td className="px-4 py-4 text-center font-bold text-blue-400">{l.el.balance}</td>
                                   <td className="px-4 py-4 text-center text-emerald-400">{l.sl.balance}</td>
                                   <td className="px-4 py-4 text-center text-amber-400">{l.cl.balance}</td>
                               </tr>
                           );
                       } else {
                           const a = advanceLedgers.find(adv => adv.employeeId === emp.id) || { opening: 0, totalAdvance: 0, paidAmount: 0, monthlyInstallment: 0, balance: 0 };
                           
                           // Determine if Ex-Employee with pending balance
                           let isExPending = false;
                           if (emp.dol) {
                               const [y, m, d] = emp.dol.split('-').map(Number);
                               const dolDate = new Date(y, m-1, d);
                               dolDate.setHours(0,0,0,0);
                               const periodStart = new Date(year, months.indexOf(month), 1);
                               periodStart.setHours(0,0,0,0);
                               // They are Ex if DOL < Start
                               if (dolDate < periodStart) isExPending = true;
                           }

                           const rowClass = isExPending ? "bg-pink-900/20 hover:bg-pink-900/30" : "hover:bg-slate-800/50";
                           const inputDisabled = baseDisabled || isExPending;

                           return (
                               <tr key={emp.id} className={rowClass}>
                                   <td className="px-6 py-4">
                                       <div className="text-sm font-bold text-white">{emp.name}</div>
                                       <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                           {emp.id} 
                                           {isExPending && <span className="bg-red-500/20 text-red-400 px-1.5 rounded-[2px] font-black uppercase text-[8px] flex items-center gap-1"><UserX size={8} /> Left</span>}
                                       </div>
                                   </td>
                                   <td className="px-4 py-4 text-center text-slate-400 font-mono">{a.opening || 0}</td>
                                   <td className="px-4 py-4 text-center"><input disabled={inputDisabled} type="number" className="w-20 bg-[#0f172a] border border-slate-700 rounded p-1 text-center text-emerald-400 font-bold text-sm disabled:opacity-50 disabled:bg-transparent disabled:border-transparent" value={a.totalAdvance} onChange={e => handleAdvanceUpdate(emp.id, 'totalAdvance', +e.target.value)} /></td>
                                   <td className="px-4 py-4 text-center"><input disabled={inputDisabled} type="number" className="w-20 bg-[#0f172a] border border-slate-700 rounded p-1 text-center text-amber-400 text-sm disabled:opacity-50 disabled:bg-transparent disabled:border-transparent" value={a.paidAmount} onChange={e => handleAdvanceUpdate(emp.id, 'paidAmount', +e.target.value)} /></td>
                                   <td className="px-4 py-4 text-center"><input disabled={inputDisabled} type="number" className="w-20 bg-[#0f172a] border border-slate-700 rounded p-1 text-center text-slate-300 text-sm disabled:opacity-50 disabled:bg-transparent disabled:border-transparent" value={a.monthlyInstallment} onChange={e => handleAdvanceUpdate(emp.id, 'monthlyInstallment', +e.target.value)} /></td>
                                   <td className="px-4 py-4 text-center font-black text-white text-lg">
                                       {a.balance}
                                       {isExPending && <div className="text-[8px] text-pink-400 uppercase tracking-widest mt-1">Recovery Pending</div>}
                                   </td>
                               </tr>
                           );
                       }
                   })}
               </tbody>
           </table>
       </div>

      {/* Modal for Feedback */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setModalState({ ...modalState, isOpen: false })} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                <div className="flex flex-col items-center gap-2">
                    <div className={`p-3 rounded-full border ${modalState.type === 'error' ? 'bg-red-900/30 text-red-500 border-red-900/50' : 'bg-emerald-900/30 text-emerald-500 border-emerald-900/50'}`}>
                        {modalState.type === 'error' ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                    </div>
                    <h3 className="text-lg font-bold text-white text-center">{modalState.title}</h3>
                    <p className="text-sm text-slate-400 text-center">{modalState.message}</p>
                </div>
                <button onClick={() => setModalState({ ...modalState, isOpen: false })} className="w-full py-2.5 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition-colors">Close</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default LedgerManager;
