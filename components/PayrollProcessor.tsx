
import React, { useState, useEffect, useMemo } from 'react';
import { Play, Save, RefreshCw, Lock, FileText, Table, Eye, Check, AlertCircle, ChevronLeft, ChevronRight, Printer, AlertTriangle, X, CheckCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, PayrollResult, StatutoryConfig, CompanyProfile, Attendance, LeaveLedger, AdvanceLedger, User } from '../types';
import { calculatePayroll } from '../services/payrollEngine';
import { numberToWords, formatDateInd } from '../services/reportService';

interface PayrollProcessorProps {
  employees: Employee[];
  config: StatutoryConfig;
  companyProfile: CompanyProfile;
  attendances: Attendance[];
  leaveLedgers: LeaveLedger[];
  advanceLedgers: AdvanceLedger[];
  savedRecords: PayrollResult[];
  setSavedRecords: React.Dispatch<React.SetStateAction<PayrollResult[]>>;
  month: string;
  year: number;
  setMonth: (m: string) => void;
  setYear: (y: number) => void;
  setLeaveLedgers: (l: LeaveLedger[]) => void;
  setAdvanceLedgers: (a: AdvanceLedger[]) => void;
  hideContextSelector?: boolean;
  currentUser?: User;
}

const PayrollProcessor: React.FC<PayrollProcessorProps> = ({
  employees,
  config,
  companyProfile,
  attendances,
  leaveLedgers,
  advanceLedgers,
  savedRecords,
  setSavedRecords,
  month,
  year
}) => {
  const [results, setResults] = useState<PayrollResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [previewRecord, setPreviewRecord] = useState<PayrollResult | null>(null);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'success' | 'error';
    title: string;
    message: string | React.ReactNode;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'confirm', title: '', message: '' });

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const isLocked = useMemo(() => {
    return savedRecords.some(r => r.month === month && r.year === year && r.status === 'Finalized');
  }, [savedRecords, month, year]);

  const activeEmployees = useMemo(() => {
    const monthIdx = months.indexOf(month);
    const periodStart = new Date(year, monthIdx, 1);
    periodStart.setHours(0,0,0,0);
    return employees.filter(emp => {
      if (!emp.dol) return true;
      const [y, m, d] = emp.dol.split('-').map(Number);
      const dolDate = new Date(y, m - 1, d);
      dolDate.setHours(0,0,0,0);
      return dolDate >= periodStart;
    });
  }, [employees, month, year]);

  useEffect(() => {
    const drafts = savedRecords.filter(r => r.month === month && r.year === year);
    if (drafts.length > 0) {
        setResults(drafts);
        setIsSaved(true); 
    } else {
        setResults([]);
        setIsSaved(false);
    }
  }, [month, year, savedRecords]);

  const checkAgeMaturity = () => {
    const unconfiguredMaturity: Employee[] = [];
    const monthIndex = months.indexOf(month);
    activeEmployees.forEach(emp => {
        if (!emp.dob || emp.isPFExempt) return;
        const dob = new Date(emp.dob);
        const maturityDate = new Date(dob.getFullYear() + 58, dob.getMonth(), dob.getDate());
        const periodStart = new Date(year, monthIndex, 1);
        const periodEnd = new Date(year, monthIndex + 1, 0);
        if ((maturityDate < periodStart || (maturityDate >= periodStart && maturityDate <= periodEnd)) && !emp.isDeferredPension) {
            unconfiguredMaturity.push(emp);
        }
    });
    if (unconfiguredMaturity.length > 0) {
        setModalState({
            isOpen: true,
            type: 'error',
            title: 'Action Required: EPS Maturity (Age 58)',
            message: (
                <div className="text-left text-sm space-y-4">
                    <p className="font-bold text-amber-400">The following employees have crossed the age of 58. EPS contributions must stop or be deferred.</p>
                    <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 max-h-32 overflow-y-auto custom-scrollbar">
                        <ul className="space-y-2">
                            {unconfiguredMaturity.map(e => (
                                <li key={e.id} className="flex justify-between items-center text-xs">
                                    <span className="text-white font-semibold">{e.name}</span> 
                                    <span className="text-slate-500 font-mono">DOB: {formatDateInd(e.dob)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 space-y-2">
                        <p className="font-bold text-sky-400 text-xs uppercase flex items-center gap-2"><AlertTriangle size={12} /> Steps to Resolve</p>
                        <p className="text-xs text-slate-300 leading-relaxed">Go to <b>Employee Master &gt; Edit Employee &gt; Statutory Options</b> and enable "EPS Maturity Control".<br/><br/>Select <b>"Pension Eligible"</b> to continue EPS or <b>"Full PF Redirect"</b> to stop EPS.</p>
                    </div>
                    <p className="text-xs text-center text-red-400 font-bold mt-2">Payroll processing is blocked until settings are updated.</p>
                </div>
            ),
        });
        return false;
    }
    return true;
  };

  const handleCalculate = () => {
    if (isLocked) return;
    if (!checkAgeMaturity()) return;
    setIsProcessing(true);
    setTimeout(() => {
        try {
            const calculatedResults = activeEmployees.map(emp => {
                const attendance = attendances.find(a => a.employeeId === emp.id && a.month === month && a.year === year) || { employeeId: emp.id, month, year, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 };
                const leave = leaveLedgers.find(l => l.employeeId === emp.id) || { employeeId: emp.id, el: { opening: 0, eligible: 0, encashed: 0, availed: 0, balance: 0 }, sl: { eligible: 0, availed: 0, balance: 0 }, cl: { availed: 0, accumulation: 0, balance: 0 } };
                const advance = advanceLedgers.find(a => a.employeeId === emp.id) || { employeeId: emp.id, opening: 0, totalAdvance: 0, monthlyInstallment: 0, paidAmount: 0, balance: 0 };
                return calculatePayroll(emp, config, attendance, leave, advance, month, year);
            });
            setResults(calculatedResults);
            setIsSaved(false);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    }, 800);
  };

  const handleSaveDraft = () => {
    if (results.length === 0 || isLocked) return;
    const otherRecords = savedRecords.filter(r => !(r.month === month && r.year === year));
    const newRecords = results.map(r => ({ ...r, status: 'Draft' as const }));
    setSavedRecords([...otherRecords, ...newRecords]);
    setIsSaved(true);
    setModalState({ isOpen: true, type: 'success', title: 'Draft Saved', message: `Payroll for ${month} ${year} saved successfully.` });
  };

  const handleExportDraft = () => {
    if (results.length === 0) return;
    
    // Filter to exclude records with 0 Net Pay (Zero Wages)
    const exportableResults = results.filter(r => r.netPay > 0);

    if (exportableResults.length === 0) {
        setModalState({ isOpen: true, type: 'error', title: 'No Data', message: 'No employees with positive wages found to export.' });
        return;
    }

    const data = exportableResults.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return { 
            'Employee ID': r.employeeId, 
            'Name': emp?.name || '', 
            'Designation': emp?.designation || '',
            'Department': emp?.division || emp?.department || '',
            'Total Days': r.daysInMonth,
            'Paid Days': r.payableDays,
            
            // Earnings
            'Basic Pay': r?.earnings?.basic || 0, 
            'DA': r?.earnings?.da || 0, 
            'Retaining Allw': r?.earnings?.retainingAllowance || 0,
            'HRA': r?.earnings?.hra || 0, 
            'Conveyance': r?.earnings?.conveyance || 0,
            'Washing Allw': r?.earnings?.washing || 0,
            'Attire Allw': r?.earnings?.attire || 0,
            'Special Allw 1': r?.earnings?.special1 || 0,
            'Special Allw 2': r?.earnings?.special2 || 0,
            'Special Allw 3': r?.earnings?.special3 || 0,
            'Bonus': r?.earnings?.bonus || 0,
            'Leave Encashment': r?.earnings?.leaveEncashment || 0,
            'Gross Earnings': r?.earnings?.total || 0, 
            
            // Deductions
            'PF (Employee)': r?.deductions?.epf || 0, 
            'VPF': r?.deductions?.vpf || 0,
            'ESI (Employee)': r?.deductions?.esi || 0, 
            'Professional Tax': r?.deductions?.pt || 0, 
            'Income Tax (TDS)': r?.deductions?.it || 0, 
            'LWF (Employee)': r?.deductions?.lwf || 0,
            'Advance Recovery': r?.deductions?.advanceRecovery || 0,
            'Total Deductions': r?.deductions?.total || 0, 
            
            // Net Pay
            'Net Pay': r.netPay
        };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Draft Payroll");
    XLSX.writeFile(wb, `Draft_Payroll_${month}_${year}.xlsx`);
  };

  const totalNet = results.reduce((acc, curr) => acc + (curr?.netPay || 0), 0);
  const totalGross = results.reduce((acc, curr) => acc + (curr?.earnings?.total || 0), 0);
  const totalDed = results.reduce((acc, curr) => acc + (curr?.deductions?.total || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className={`bg-[#1e293b] p-6 rounded-xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 ${isLocked ? 'opacity-90' : ''}`}>
        <div className="flex items-center gap-4">{isLocked ? (<div className="p-3 bg-amber-900/20 text-amber-500 rounded-full border border-amber-900/50"><Lock size={24} /></div>) : (<div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/30"><RefreshCw size={24} className="text-white" /></div>)}<div><h2 className="text-xl font-black text-white">{isLocked ? 'Payroll Locked' : 'Run Payroll'}</h2><p className="text-slate-400 text-sm">{isLocked ? `Period ${month} ${year} is finalized. Unlock from Reports to edit.` : `Calculate and process salaries for ${month} ${year}.`}</p></div></div>
        <div className="flex items-center gap-3">{!isLocked ? (<><button onClick={handleCalculate} disabled={isProcessing} className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50">{isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} />}{isProcessing ? 'Processing...' : 'Calculate Sheet'}</button>{results.length > 0 && (<><button onClick={handleSaveDraft} disabled={isSaved} className={`flex items-center gap-2 px-6 py-3 font-bold rounded-lg shadow-lg transition-all ${isSaved ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/50 cursor-default' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>{isSaved ? <Check size={18} /> : <Save size={18} />}{isSaved ? 'Saved as Draft' : 'Save Draft'}</button><button onClick={handleExportDraft} className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all shadow-lg" title="Export to Excel"><Download size={18} /></button></>)}</>) : (<div className="flex items-center gap-2 px-4 py-2 bg-amber-900/20 border border-amber-900/50 rounded-lg text-amber-400 text-xs font-bold"><Lock size={14} /> View Only</div>)}</div>
      </div>

      {results.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-800 shadow-lg"><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Gross</p><h3 className="text-2xl font-black text-white">₹{totalGross.toLocaleString()}</h3></div>
            <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-800 shadow-lg"><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Deductions</p><h3 className="text-2xl font-black text-red-400">₹{totalDed.toLocaleString()}</h3></div>
            <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden"><div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Net Payable</p><h3 className="text-2xl font-black text-emerald-400">₹{totalNet.toLocaleString()}</h3></div>
          </div>
          <div className="bg-[#1e293b] rounded-xl border border-slate-800 overflow-hidden shadow-2xl max-h-[600px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-sm">
                <thead className="bg-[#0f172a] text-xs uppercase font-bold text-slate-400 sticky top-0 z-10 shadow-md">
                  <tr><th className="px-4 py-4 bg-[#0f172a]">Employee</th><th className="px-2 py-4 text-center bg-[#0f172a]">Days</th><th className="px-4 py-4 text-right bg-[#0f172a]">Basic</th><th className="px-4 py-4 text-right bg-[#0f172a]">DA</th><th className="px-4 py-4 text-right bg-[#0f172a]">HRA</th><th className="px-4 py-4 text-right bg-[#0f172a]">Others</th><th className="px-4 py-4 text-right text-white bg-[#0f172a]">Gross</th><th className="px-4 py-4 text-right text-blue-400 bg-[#0f172a]">PF</th><th className="px-4 py-4 text-right text-pink-400 bg-[#0f172a]">ESI</th><th className="px-4 py-4 text-right text-amber-400 bg-[#0f172a]">PT/TDS</th><th className="px-4 py-4 text-right text-red-300 bg-[#0f172a]">Deductions</th><th className="px-4 py-4 text-right text-emerald-400 bg-[#0f172a]">Net Pay</th><th className="px-2 py-4 text-center bg-[#0f172a] sticky right-0 z-20 shadow-[-4px_0_4px_-4px_rgba(0,0,0,0.5)]">View</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {results.map(r => {
                    const emp = employees.find(e => e.id === r.employeeId);
                    const others = (r?.earnings?.total || 0) - ((r?.earnings?.basic || 0) + (r?.earnings?.da || 0) + (r?.earnings?.hra || 0));
                    return (<tr key={r.employeeId} className="hover:bg-slate-800/50 transition-colors"><td className="px-4 py-3"><div className="font-bold text-white text-xs">{emp?.name}</div><div className="text-[10px] text-slate-500 font-mono">{r.employeeId}</div></td><td className="px-2 py-3 text-center font-mono text-slate-300 text-xs">{r.payableDays}</td><td className="px-4 py-3 text-right font-mono text-slate-300 text-xs">{(r?.earnings?.basic || 0).toLocaleString()}</td><td className="px-4 py-3 text-right font-mono text-slate-300 text-xs">{(r?.earnings?.da || 0).toLocaleString()}</td><td className="px-4 py-3 text-right font-mono text-slate-300 text-xs">{(r?.earnings?.hra || 0).toLocaleString()}</td><td className="px-4 py-3 text-right font-mono text-slate-400 text-xs">{others.toLocaleString()}</td><td className="px-4 py-3 text-right font-mono font-bold text-white text-xs">{(r?.earnings?.total || 0).toLocaleString()}</td><td className="px-4 py-3 text-right font-mono text-blue-300 text-xs">{(r?.deductions?.epf || 0).toLocaleString()}</td><td className="px-4 py-3 text-right font-mono text-pink-300 text-xs">{(r?.deductions?.esi || 0).toLocaleString()}</td><td className="px-4 py-3 text-right font-mono text-amber-300 text-xs">{((r?.deductions?.pt || 0) + (r?.deductions?.it || 0)).toLocaleString()}</td><td className="px-4 py-3 text-right font-mono text-red-300 text-xs">{(r?.deductions?.total || 0).toLocaleString()}</td><td className="px-4 py-3 text-right font-mono font-black text-emerald-400 text-sm bg-emerald-900/10">{(r?.netPay || 0).toLocaleString()}</td><td className="px-2 py-3 text-center sticky right-0 bg-[#1e293b] shadow-[-4px_0_4px_-4px_rgba(0,0,0,0.5)]"><button onClick={() => setPreviewRecord(r)} className="p-2 bg-blue-900/20 text-blue-400 hover:text-white hover:bg-blue-600 rounded-lg transition-colors" title="View Pay Slip"><Eye size={16} /></button></td></tr>);
                  })}
                </tbody>
              </table>
          </div>
        </div>
      )}

      {modalState.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"><div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative"><button onClick={() => setModalState({ ...modalState, isOpen: false })} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button><div className="flex flex-col items-center gap-2"><div className={`p-3 rounded-full border ${modalState.type === 'error' ? 'bg-red-900/30 text-red-500 border-red-900/50' : modalState.type === 'success' ? 'bg-emerald-900/30 text-emerald-500 border-emerald-900/50' : 'bg-blue-900/30 text-blue-500 border-blue-900/50'}`}>{modalState.type === 'error' ? <AlertTriangle size={24} /> : modalState.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}</div><h3 className="text-lg font-bold text-white text-center">{modalState.title}</h3><div className="text-sm text-slate-400 text-center w-full">{modalState.message}</div></div><div className="flex gap-3 mt-4"><button onClick={() => setModalState({ ...modalState, isOpen: false })} className="w-full py-2.5 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition-colors">Close</button></div></div></div>
      )}

      {previewRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl flex flex-col relative text-slate-900">
                <div className="sticky top-0 bg-slate-100 border-b border-slate-200 p-4 flex justify-between items-center z-10"><h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText size={18} className="text-blue-600" /> Pay Slip Preview</h3><button onClick={() => setPreviewRecord(null)} className="p-2 hover:bg-red-100 text-slate-500 hover:text-red-500 rounded-full transition-colors"><X size={20} /></button></div>
                <div className="p-8 space-y-6 print:p-0">
                    <div className="text-center space-y-1 border-b-2 border-slate-800 pb-4"><h2 className="text-2xl font-black text-slate-900 uppercase">{companyProfile.establishmentName}</h2><p className="text-xs text-slate-600 font-medium whitespace-pre-wrap px-12">{[companyProfile.doorNo, companyProfile.buildingName, companyProfile.street, companyProfile.area, companyProfile.city, companyProfile.state, companyProfile.pincode].filter(Boolean).join(', ')}</p><h3 className="text-lg font-bold text-slate-800 mt-2 uppercase underline decoration-2 underline-offset-4 decoration-slate-400">Pay Slip - {month} {year}</h3></div>
                    {(() => {
                        const emp = employees.find(e => e.id === previewRecord.employeeId);
                        if (!emp) return null;
                        const r = previewRecord;
                        const special = (r?.earnings?.special1 || 0) + (r?.earnings?.special2 || 0) + (r?.earnings?.special3 || 0);
                        const other = (r?.earnings?.washing || 0) + (r?.earnings?.attire || 0);
                        return (<><div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs border border-slate-300 p-4 rounded-lg bg-slate-50">
                                    <div className="flex justify-between border-b border-slate-200 pb-1"><span className="text-slate-500 font-bold uppercase">Employee Name</span><span className="font-bold text-slate-900">{emp.name}</span></div>
                                    <div className="flex justify-between border-b border-slate-200 pb-1"><span className="text-slate-500 font-bold uppercase">Designation</span><span className="font-bold text-slate-900">{emp.designation}</span></div>
                                    <div className="flex justify-between border-b border-slate-200 pb-1"><span className="text-slate-500 font-bold uppercase">Employee ID</span><span className="font-bold text-slate-900">{emp.id}</span></div>
                                    <div className="flex justify-between border-b border-slate-200 pb-1"><span className="text-slate-500 font-bold uppercase">Department</span><span className="font-bold text-slate-900">{emp.division || emp.department}</span></div>
                                    <div className="flex justify-between border-b border-slate-200 pb-1"><span className="text-slate-500 font-bold uppercase">Bank A/c</span><span className="font-bold text-slate-900">{emp.bankAccount}</span></div>
                                    <div className="flex justify-between border-b border-slate-200 pb-1"><span className="text-slate-500 font-bold uppercase">Days Paid</span><span className="font-bold text-slate-900">{r.payableDays} / {r.daysInMonth}</span></div>
                                    <div className="flex justify-between border-b border-slate-200 pb-1"><span className="text-slate-500 font-bold uppercase">UAN No</span><span className="font-bold text-slate-900">{emp.uanc || 'N/A'}</span></div>
                                    <div className="flex justify-between border-b border-slate-200 pb-1"><span className="text-slate-500 font-bold uppercase">PF No</span><span className="font-bold text-slate-900">{emp.pfNumber || 'N/A'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500 font-bold uppercase">ESI No</span><span className="font-bold text-slate-900">{emp.esiNumber || 'N/A'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500 font-bold uppercase">PAN No</span><span className="font-bold text-slate-900">{emp.pan || 'N/A'}</span></div>
                                </div>
                                <div className="border border-slate-800"><div className="grid grid-cols-4 bg-slate-800 text-white text-xs font-bold uppercase text-center divide-x divide-slate-600"><div className="p-2">Earnings</div><div className="p-2">Amount (₹)</div><div className="p-2">Deductions</div><div className="p-2">Amount (₹)</div></div><div className="grid grid-cols-4 text-xs divide-x divide-slate-300"><div className="space-y-1 p-2"><div className="text-slate-600">Basic Pay</div><div className="text-slate-600">DA</div><div className="text-slate-600">Retaining Allw</div><div className="text-slate-600">HRA</div><div className="text-slate-600">Conveyance</div><div className="text-slate-600">Special Allw</div><div className="text-slate-600">Other Allw</div><div className="text-slate-600">Leave Encash</div></div><div className="space-y-1 p-2 text-right font-mono text-slate-900"><div>{(r?.earnings?.basic || 0).toFixed(2)}</div><div>{(r?.earnings?.da || 0).toFixed(2)}</div><div>{(r?.earnings?.retainingAllowance || 0).toFixed(2)}</div><div>{(r?.earnings?.hra || 0).toFixed(2)}</div><div>{(r?.earnings?.conveyance || 0).toFixed(2)}</div><div>{special.toFixed(2)}</div><div>{other.toFixed(2)}</div><div>{(r?.earnings?.leaveEncashment || 0).toFixed(2)}</div></div><div className="space-y-1 p-2"><div className="text-slate-600">Provident Fund {r.isCode88 ? '*' : ''}</div><div className="text-slate-600">ESI {r.isESICodeWagesUsed ? '**' : ''}</div><div className="text-slate-600">Professional Tax</div><div className="text-slate-600">Income Tax</div><div className="text-slate-600">VPF</div><div className="text-slate-600">LWF</div><div className="text-slate-600">Adv Recovery</div></div><div className="space-y-1 p-2 text-right font-mono text-slate-900"><div>{(r?.deductions?.epf || 0).toFixed(2)}</div><div>{(r?.deductions?.esi || 0).toFixed(2)}</div><div>{(r?.deductions?.pt || 0).toFixed(2)}</div><div>{(r?.deductions?.it || 0).toFixed(2)}</div><div>{(r?.deductions?.vpf || 0).toFixed(2)}</div><div>{(r?.deductions?.lwf || 0).toFixed(2)}</div><div>{(r?.deductions?.advanceRecovery || 0).toFixed(2)}</div></div></div><div className="grid grid-cols-4 bg-slate-100 border-t border-slate-800 text-xs font-bold divide-x divide-slate-300"><div className="p-2 text-slate-800">Gross Earnings</div><div className="p-2 text-right text-slate-900">{(r?.earnings?.total || 0).toFixed(2)}</div><div className="p-2 text-slate-800">Total Deductions</div><div className="p-2 text-right text-slate-900">{(r?.deductions?.total || 0).toFixed(2)}</div></div></div>
                                <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 flex flex-col md:flex-row justify-between items-center gap-4"><div><p className="text-xs font-bold text-blue-800 uppercase tracking-widest">Net Salary Payable</p><p className="text-[10px] text-blue-600 italic mt-1 max-w-sm">{numberToWords(Math.round(r?.netPay || 0))} Rupees Only</p></div><div className="text-3xl font-black text-blue-900">₹{Math.round(r?.netPay || 0).toLocaleString('en-IN')}</div></div>
                                <div className="text-[10px] text-slate-400 space-y-1 pt-4 border-t border-slate-200">{r.isCode88 && <p>* PF calculated on Code Wages (Social Security Code 2020)</p>}{r.isESICodeWagesUsed && <p>** ESI calculated on Code Wages (Social Security Code 2020)</p>}<p className="text-center italic mt-4">This is a computer-generated document and does not require a signature.</p></div></>
                        );
                    })()}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default PayrollProcessor;
