
import React, { useState, useMemo, useRef } from 'react';
import { Upload, Save, Lock, AlertTriangle, CheckCircle2, X, AlertCircle, Search, FileSpreadsheet, Download, Gavel } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, FineRecord, PayrollResult } from '../types';

interface FineManagerProps {
  employees: Employee[];
  fines: FineRecord[];
  setFines: (fines: FineRecord[]) => void;
  month: string;
  year: number;
  savedRecords: PayrollResult[];
  hideContextSelector?: boolean;
}

const FineManager: React.FC<FineManagerProps> = ({
  employees,
  fines,
  setFines,
  month,
  year,
  savedRecords,
  hideContextSelector = false
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'success' | 'error';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'confirm', title: '', message: '' });

  const isLocked = useMemo(() => {
    return savedRecords.some(r => r.month === month && r.year === year && r.status === 'Finalized');
  }, [savedRecords, month, year]);

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const filteredEmployees = useMemo(() => {
    const monthIdx = months.indexOf(month);
    const periodStart = new Date(year, monthIdx, 1);
    periodStart.setHours(0,0,0,0);

    return employees.filter(emp => {
      let isActive = true;
      if (emp.dol) {
          const [y, m, d] = emp.dol.split('-').map(Number);
          const dolDate = new Date(y, m - 1, d);
          dolDate.setHours(0,0,0,0);
          isActive = dolDate >= periodStart;
      }
      if (!isActive) return false;
      
      const searchMatch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.id.toLowerCase().includes(searchTerm.toLowerCase());
      return searchMatch;
    });
  }, [employees, month, year, searchTerm]);

  const handleUpdate = (empId: string, field: 'amount' | 'reason' | 'tax', value: string | number) => {
      if (isLocked || justSaved) return;

      const existingIndex = fines.findIndex(f => f.employeeId === empId && f.month === month && f.year === year);
      let newFines = [...fines];

      const newVal = (field === 'amount' || field === 'tax') && value === '' ? undefined : value;

      if (existingIndex >= 0) {
          newFines[existingIndex] = { ...newFines[existingIndex], [field]: newVal };
      } else {
          newFines.push({
              employeeId: empId,
              month,
              year,
              amount: field === 'amount' ? Number(newVal) : 0,
              reason: field === 'reason' ? String(newVal) : '',
              tax: field === 'tax' ? Number(newVal) : undefined
          });
      }
      setFines(newFines);
  };

  const handleSave = () => {
      if (isLocked) return;
      setIsSaving(true);
      setTimeout(() => {
          localStorage.setItem('app_fines', JSON.stringify(fines));
          setIsSaving(false);
          setJustSaved(true);
          setModalState({
              isOpen: true,
              type: 'success',
              title: 'Records Updated',
              message: 'Tax & Fine register has been saved successfully.'
          });
      }, 500);
  };

  const downloadTemplate = () => {
      const headers = ["Employee ID", "Name", "Income Tax", "Fine Amount", "Reason"];
      const data = filteredEmployees.map(e => {
          const f = fines.find(rec => rec.employeeId === e.id && rec.month === month && rec.year === year);
          return [e.id, e.name, f?.tax || 0, f?.amount || 0, f?.reason || '']; 
      });
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tax_Fine_Register");
      XLSX.writeFile(wb, `Tax_Fine_Template_${month}_${year}.xlsx`);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isLocked || justSaved) return;
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
              
              const newFines = [...fines.filter(f => !(f.month === month && f.year === year))]; // Clear current month to replace
              let count = 0;

              data.forEach((row: any) => {
                  const id = String(row['Employee ID'] || row['ID'] || '').trim();
                  const amount = Number(row['Fine Amount'] || row['Amount'] || 0);
                  const reason = String(row['Reason'] || row['Fine Reason'] || '').trim();
                  
                  // Flexible Tax Keys
                  const taxKeys = ['Income Tax', 'Tax', 'TDS', 'IT'];
                  let taxVal = 0;
                  for (const k of taxKeys) {
                      if (row[k] !== undefined) {
                          taxVal = Number(row[k]);
                          break;
                      }
                  }

                  if (id && (amount > 0 || taxVal > 0)) {
                      newFines.push({
                          employeeId: id,
                          month,
                          year,
                          amount,
                          reason,
                          tax: taxVal
                      });
                      count++;
                  }
              });

              setFines(newFines);
              setModalState({ isOpen: true, type: 'success', title: 'Import Successful', message: `Imported ${count} records.` });
          } catch (err) {
              setModalState({ isOpen: true, type: 'error', title: 'Import Error', message: 'Failed to parse file.' });
          } finally {
              setIsUploading(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6">
        {isLocked && (
            <div className="bg-amber-900/20 border border-amber-700 p-4 rounded-xl flex gap-3 items-center animate-in fade-in slide-in-from-top-2">
                <Lock size={20} className="text-amber-400" />
                <div>
                    <h3 className="font-bold text-amber-200 text-sm">Register Locked</h3>
                    <p className="text-xs text-amber-300/80">Payroll finalized. Records cannot be modified.</p>
                </div>
            </div>
        )}

        {!isLocked && justSaved && (
            <div className="bg-emerald-900/20 border border-emerald-700 p-4 rounded-xl flex gap-3 items-center animate-in fade-in slide-in-from-top-2">
                <div className="p-2 bg-emerald-900/40 rounded-full text-emerald-400"><CheckCircle2 size={20} /></div>
                <div>
                    <h3 className="font-bold text-emerald-200 text-sm">Changes Saved</h3>
                    <p className="text-xs text-emerald-300/80">Data is in Read-Only mode. Click 'Modify' to edit.</p>
                </div>
            </div>
        )}

        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-900/30 border border-red-500/20 text-red-400">
                    <Gavel size={24} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white">Tax & Fine Register</h2>
                    {!hideContextSelector && <p className="text-xs text-slate-400">{month} {year}</p>}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input type="text" placeholder="Search..." className="pl-9 pr-4 py-2 bg-[#0f172a] border border-slate-700 rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-blue-500 w-40" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                {!isLocked && (
                    <>
                        <button onClick={justSaved ? () => setJustSaved(false) : handleSave} disabled={isSaving} className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-xs transition-all shadow-lg ${justSaved ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                            {isSaving ? <div className="animate-spin rounded-full h-3 w-3 border-2 border-white/30 border-t-white" /> : <Save size={14} />} {justSaved ? 'Modify' : 'Save'}
                        </button>
                        <button onClick={downloadTemplate} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg font-bold text-xs border border-slate-600"><Download size={14} /> Template</button>
                        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading || justSaved} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-xs transition-all shadow-lg disabled:opacity-50 disabled:bg-slate-700"><Upload size={14} /> Import</button>
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
                        <th className="px-4 py-4 text-right">Income Tax (₹)</th>
                        <th className="px-4 py-4 text-right">Fine Amount (₹)</th>
                        <th className="px-6 py-4">Reason / Remarks</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {filteredEmployees.map(emp => {
                        const rec = fines.find(f => f.employeeId === emp.id && f.month === month && f.year === year) || { amount: 0, reason: '', tax: undefined };
                        const inputDisabled = isLocked || justSaved;
                        
                        return (
                            <tr key={emp.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="text-sm font-bold text-white">{emp.name}</div>
                                    <div className="text-[10px] text-slate-500">{emp.id}</div>
                                </td>
                                <td className="px-4 py-4 text-right">
                                    <input 
                                        type="number" 
                                        disabled={inputDisabled}
                                        className={`w-32 bg-[#0f172a] border rounded-lg p-2 text-right text-sm font-mono outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60 disabled:bg-transparent disabled:border-transparent ${rec.tax !== undefined && rec.tax > 0 ? 'text-sky-400 font-bold border-sky-900/50' : 'text-slate-400 border-slate-700'}`}
                                        value={rec.tax !== undefined ? rec.tax : ''}
                                        onChange={e => handleUpdate(emp.id, 'tax', e.target.value)}
                                        placeholder="Auto"
                                    />
                                </td>
                                <td className="px-4 py-4 text-right">
                                    <input 
                                        type="number" 
                                        disabled={inputDisabled}
                                        className={`w-32 bg-[#0f172a] border rounded-lg p-2 text-right text-sm font-mono outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-60 disabled:bg-transparent disabled:border-transparent ${rec.amount > 0 ? 'text-red-400 font-bold border-red-900/50' : 'text-slate-400 border-slate-700'}`}
                                        value={rec.amount}
                                        onChange={e => handleUpdate(emp.id, 'amount', +e.target.value)}
                                        placeholder="0"
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <input 
                                        type="text" 
                                        disabled={inputDisabled}
                                        className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:bg-transparent disabled:border-transparent"
                                        value={rec.reason}
                                        onChange={e => handleUpdate(emp.id, 'reason', e.target.value)}
                                        placeholder={rec.amount > 0 ? "Enter reason..." : "-"}
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>

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

export default FineManager;
