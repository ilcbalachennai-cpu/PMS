import React, { useState, useMemo } from 'react';
import { FileText, Download, Lock, Unlock, AlertTriangle, CheckCircle2, X, FileSpreadsheet, CreditCard, ClipboardList, Wallet } from 'lucide-react';
import { Employee, PayrollResult, StatutoryConfig, CompanyProfile, Attendance, LeaveLedger, AdvanceLedger, User } from '../types';
import { 
  generateExcelReport, 
  generateSimplePaySheetPDF, 
  generatePaySlipsPDF, 
  generateBankStatementPDF, 
  generateLeaveLedgerReport, 
  generateAdvanceShortfallReport 
} from '../services/reportService';

interface ReportsProps {
  employees: Employee[];
  setEmployees: (employees: Employee[]) => void;
  config: StatutoryConfig;
  companyProfile: CompanyProfile;
  attendances: Attendance[];
  savedRecords: PayrollResult[];
  setSavedRecords: React.Dispatch<React.SetStateAction<PayrollResult[]>>;
  month: string;
  year: number;
  setMonth: (m: string) => void;
  setYear: (y: number) => void;
  leaveLedgers: LeaveLedger[];
  setLeaveLedgers: (l: LeaveLedger[]) => void;
  advanceLedgers: AdvanceLedger[];
  setAdvanceLedgers: (a: AdvanceLedger[]) => void;
  currentUser?: User;
}

const Reports: React.FC<ReportsProps> = ({
  employees,
  companyProfile,
  attendances,
  savedRecords,
  setSavedRecords,
  month,
  year,
  setMonth,
  setYear,
  leaveLedgers,
  advanceLedgers,
  currentUser
}) => {
  const [reportType, setReportType] = useState<string>('Pay Sheet');
  const [format, setFormat] = useState<'PDF' | 'Excel'>('PDF');
  const [isGenerating, setIsGenerating] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'success' | 'error';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'confirm', title: '', message: '' });

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);

  const currentResults = useMemo(() => {
    return savedRecords.filter(r => r.month === month && r.year === year);
  }, [savedRecords, month, year]);

  const isLocked = useMemo(() => {
    return currentResults.length > 0 && currentResults[0].status === 'Finalized';
  }, [currentResults]);

  const hasData = useMemo(() => {
      return currentResults.length > 0;
  }, [currentResults]);

  const handleReportTypeChange = (type: string) => {
      setReportType(type);
      // Automatically force PDF for Pay Slips as Excel is not supported
      if (type === 'Pay Slips') {
          setFormat('PDF');
      }
  };

  const handleFreeze = () => {
    if (currentUser?.role !== 'Developer' && currentUser?.role !== 'Administrator') {
        setModalState({ isOpen: true, type: 'error', title: 'Access Denied', message: 'Only Administrators can freeze payroll.' });
        return;
    }
    
    if (!hasData) {
        setModalState({ isOpen: true, type: 'error', title: 'No Data', message: 'There is no saved payroll data to freeze for this period.' });
        return;
    }

    setModalState({
        isOpen: true,
        type: 'confirm',
        title: 'Confirm Freeze',
        message: `Are you sure you want to finalize payroll for ${month} ${year}?\n\nThis will lock all attendance, leave, and advance records for this period.`,
        onConfirm: () => {
            const updated = savedRecords.map(r => {
                if (r.month === month && r.year === year) return { ...r, status: 'Finalized' as const };
                return r;
            });
            setSavedRecords(updated);
            setModalState({ isOpen: false, type: 'success', title: '', message: '' });
        }
    });
  };

  const handleUnlock = () => {
    if (currentUser?.role !== 'Developer' && currentUser?.role !== 'Administrator') {
        setModalState({ isOpen: true, type: 'error', title: 'Access Denied', message: 'Only Administrators can unlock payroll.' });
        return;
    }

    setModalState({
        isOpen: true,
        type: 'confirm',
        title: 'Confirm Unlock',
        message: `Unlocking ${month} ${year} will allow modifications to payroll data.\n\nEnsure compliance reports are re-generated if data changes.`,
        onConfirm: () => {
            const updated = savedRecords.map(r => {
                if (r.month === month && r.year === year) return { ...r, status: 'Draft' as const };
                return r;
            });
            setSavedRecords(updated);
            setModalState({ isOpen: false, type: 'success', title: '', message: '' });
        }
    });
  };

  const generateReport = () => {
    if (!isLocked) return;
    setIsGenerating(true);
    setTimeout(() => {
      try {
        // Payroll Data Check
        if ((reportType === 'Pay Sheet' || reportType === 'Pay Slips' || reportType === 'Bank Statement') && currentResults.length === 0) {
             throw new Error("No payroll data found for this period. Please run & save payroll in Pay Process first.");
        }

        if (reportType === 'Pay Sheet') {
            const validResults = currentResults.filter(r => r.earnings?.total > 0);
            if (validResults.length === 0) throw new Error("No employees with wages found. Check if payroll has been processed with attendance.");

            if (format === 'Excel') {
                const excelData = validResults.map(r => {
                    const emp = employees.find(e => e.id === r.employeeId);
                    return {
                        'ID': r.employeeId,
                        'Name': emp?.name,
                        'Designation': emp?.designation,
                        'Days Paid': r.payableDays,
                        
                        // Detailed Earnings
                        'Basic': r.earnings?.basic,
                        'DA': r.earnings?.da,
                        'Retaining Allw': r.earnings?.retainingAllowance,
                        'HRA': r.earnings?.hra,
                        'Conveyance': r.earnings?.conveyance,
                        'Washing': r.earnings?.washing,
                        'Attire': r.earnings?.attire,
                        'Special Allw 1': r.earnings?.special1,
                        'Special Allw 2': r.earnings?.special2,
                        'Special Allw 3': r.earnings?.special3,
                        'Bonus': r.earnings?.bonus,
                        'Leave Encash': r.earnings?.leaveEncashment,
                        'GROSS EARNINGS': r.earnings?.total,

                        // Detailed Deductions
                        'PF (EE)': r.deductions?.epf,
                        'VPF': r.deductions?.vpf,
                        'ESI (EE)': r.deductions?.esi,
                        'Prof Tax': r.deductions?.pt,
                        'Income Tax': r.deductions?.it,
                        'LWF': r.deductions?.lwf,
                        'Advance': r.deductions?.advanceRecovery,
                        'Fine': r.deductions?.fine,
                        'TOTAL DEDUCTIONS': r.deductions?.total,

                        'NET PAY': r.netPay
                    };
                });
                generateExcelReport(excelData, 'Pay Sheet', `PaySheet_${month}_${year}`);
            } else {
                generateSimplePaySheetPDF(validResults, employees, month, year, companyProfile);
            }
        } else if (reportType === 'Pay Slips') {
            const slipRecords = currentResults.filter(r => r.netPay > 0);
            if (slipRecords.length === 0) throw new Error("No employees with positive Net Pay found for Pay Slips.");
            generatePaySlipsPDF(slipRecords, employees, month, year, companyProfile);
        } else if (reportType === 'Bank Statement') {
            const bankRecords = currentResults.filter(r => r.netPay > 0);
            if (bankRecords.length === 0) throw new Error("No employees with positive Net Pay found for Bank Statement.");

            if (format === 'Excel') {
                 const data = bankRecords.map(r => {
                    const emp = employees.find(e => e.id === r.employeeId);
                    return {
                        'Emp ID': r.employeeId,
                        'Name': emp?.name,
                        'Bank Name': '-',
                        'Account No': emp?.bankAccount,
                        'IFSC': emp?.ifsc,
                        'Amount': r.netPay
                    };
                 });
                 generateExcelReport(data, 'Bank Statement', `Bank_Statement_${month}_${year}`);
            } else {
                generateBankStatementPDF(currentResults, employees, month, year, companyProfile);
            }
        } else if (reportType === 'Leave Ledger') {
             // Use snapshot from payroll result for historical accuracy if available
             const resultsMap = new Map(currentResults.map(r => [r.employeeId, r]));
             
             // Filter Active Employees for the selected period
             const periodStart = new Date(year, months.indexOf(month), 1);
             const periodEnd = new Date(year, months.indexOf(month) + 1, 0);
             
             const activeEmps = employees.filter(emp => {
                 const doj = new Date(emp.doj);
                 if (doj > periodEnd) return false;
                 if (emp.dol) {
                     const dol = new Date(emp.dol);
                     if (dol < periodStart) return false;
                 }
                 return true;
             });

             if (activeEmps.length === 0) throw new Error("No active employees found for the selected period.");

             if (format === 'Excel') {
                 const data = activeEmps.map(e => {
                     // Priority: 1. Snapshot from Frozen Payroll (accurate history), 2. Global Ledger (current state - fallback)
                     const snapshot = resultsMap.get(e.id)?.leaveSnapshot;
                     const liveLedger = leaveLedgers.find(led => led.employeeId === e.id);
                     
                     // Use snapshot if available, otherwise fallback to current state (might be inaccurate for past months)
                     const l = snapshot || liveLedger || {
                         el: { opening: 0, eligible: 0, encashed: 0, availed: 0, balance: 0 },
                         sl: { eligible: 0, availed: 0, balance: 0 },
                         cl: { accumulation: 0, availed: 0, balance: 0 }
                     };
                     
                     // Calculate Total EL Used (Taken + Encashed)
                     const elUsed = (l.el.availed || 0) + (l.el.encashed || 0);

                     return {
                         'ID': e.id,
                         'Name': e.name,
                         'EL Opening': l.el.opening || 0,
                         'EL Credit': l.el.eligible || 0,
                         'EL Used': elUsed, // Sum of availed and encashed
                         'EL Balance': l.el.balance || 0,
                         'SL Credit': l.sl.eligible || 0,
                         'SL Availed': l.sl.availed || 0,
                         'SL Balance': l.sl.balance || 0,
                         'CL Credit': l.cl.accumulation || 0, 
                         'CL Availed': l.cl.availed || 0,
                         'CL Balance': l.cl.balance || 0
                     };
                 });
                 generateExcelReport(data, 'Leave Ledger', `LeaveLedger_${month}_${year}`);
             } else {
                 // Pass results directly so PDF generator can access snapshots
                 generateLeaveLedgerReport(currentResults, activeEmps, month, year, 'AC', companyProfile);
             }

        } else if (reportType === 'Advance Shortfall') {
             // Calculate shortfall
             const shortfallData = currentResults.map(r => {
                 const emp = employees.find(e => e.id === r.employeeId);
                 const adv = advanceLedgers.find(a => a.employeeId === r.employeeId);
                 if (!adv || adv.monthlyInstallment === 0) return null;
                 
                 const recovered = r.deductions?.advanceRecovery || 0;
                 const target = Math.min(adv.monthlyInstallment, (adv.balance || 0) + recovered); 
                 if (recovered < target) {
                     return {
                         id: r.employeeId,
                         name: emp?.name,
                         target: target,
                         recovered: recovered,
                         shortfall: target - recovered
                     };
                 }
                 return null;
             }).filter(d => d !== null);

             if (shortfallData.length === 0) {
                 setModalState({ isOpen: true, type: 'error', title: 'No Data Available', message: 'No Data Available to Report' });
                 return;
             }
             
             generateAdvanceShortfallReport(shortfallData, month, year, format, companyProfile);
        }

      } catch (e: any) {
        setModalState({ isOpen: true, type: 'error', title: 'Generation Failed', message: e.message });
      } finally {
        setIsGenerating(false);
      }
    }, 500);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
      
      {/* Header & Context Selector */}
      <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-900/30">
                <FileText size={28} className="text-white" />
            </div>
            <div>
                <h2 className="text-2xl font-black text-white">Pay Reports</h2>
                <p className="text-slate-400 text-sm">Statements, Slips & Bank Files</p>
            </div>
        </div>

        <div className="flex items-center gap-3 bg-[#0f172a] p-2 rounded-xl border border-slate-700">
             <select value={month} onChange={e => setMonth(e.target.value)} className="bg-transparent border-r border-slate-700 px-4 py-1 text-sm text-white font-bold outline-none focus:text-indigo-400">
                {months.map(m => (<option key={m} value={m}>{m}</option>))}
             </select>
             <select value={year} onChange={e => setYear(+e.target.value)} className="bg-transparent px-4 py-1 text-sm text-white font-bold outline-none focus:text-indigo-400">
                {yearOptions.map(y => (<option key={y} value={y}>{y}</option>))}
             </select>
        </div>
      </div>

      {/* Lock/Unlock Section */}
      <div className={`p-6 rounded-xl border flex items-center justify-between shadow-lg transition-all ${isLocked ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-amber-900/10 border-amber-500/30'}`}>
          <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full border ${isLocked ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' : 'bg-amber-900/20 border-amber-500/50 text-amber-400'}`}>
                  {isLocked ? <Lock size={24} /> : <Unlock size={24} />}
              </div>
              <div>
                  <h3 className={`font-bold text-lg ${isLocked ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isLocked ? 'Payroll Finalized' : 'Payroll in Draft'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                      {isLocked 
                        ? 'Data is frozen for compliance reporting. Unlock to edit.' 
                        : 'Freeze data to generate statutory reports and lock edits.'}
                  </p>
              </div>
          </div>
          <button 
            onClick={isLocked ? handleUnlock : handleFreeze} 
            disabled={!isLocked && !hasData}
            className={`px-6 py-2.5 rounded-lg font-bold text-sm shadow-lg transition-all ${
                isLocked 
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600' 
                : hasData 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
              {isLocked ? 'Unlock Period' : hasData ? 'Confirm & Freeze Data' : 'No Data to Freeze'}
          </button>
      </div>

      {/* Report Generation Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Report Selection */}
          <div className={`lg:col-span-2 bg-[#1e293b] rounded-2xl border border-slate-800 p-6 shadow-xl transition-opacity ${!isLocked ? 'opacity-70' : 'opacity-100'}`}>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Select Report</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                      { id: 'Pay Sheet', icon: FileSpreadsheet, label: 'Monthly Pay Sheet' },
                      { id: 'Pay Slips', icon: FileText, label: 'Pay Slips' },
                      { id: 'Bank Statement', icon: CreditCard, label: 'Bank Statement' },
                      { id: 'Leave Ledger', icon: ClipboardList, label: 'Leave Ledger' },
                      { id: 'Advance Shortfall', icon: Wallet, label: 'Advance Shortfall' },
                  ].map(item => (
                      <button 
                        key={item.id}
                        onClick={() => handleReportTypeChange(item.id)}
                        className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-all ${
                            reportType === item.id 
                            ? 'bg-blue-600 border-blue-500 text-white shadow-lg scale-105' 
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600 hover:bg-slate-800'
                        }`}
                      >
                          <item.icon size={24} />
                          <span className="text-xs font-bold text-center">{item.label}</span>
                      </button>
                  ))}
              </div>
          </div>

          {/* Configuration & Action */}
          <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
              <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Configuration</h3>
                  <div className="space-y-4">
                      {reportType !== 'Pay Slips' ? (
                          <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500">Output Format</label>
                              <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                                  <button onClick={() => setFormat('PDF')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${format === 'PDF' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>PDF</button>
                                  <button onClick={() => setFormat('Excel')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${format === 'Excel' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Excel</button>
                              </div>
                          </div>
                      ) : (
                          <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-xs text-blue-300">
                              Format locked to <b>PDF</b> for Pay Slips.
                          </div>
                      )}
                      
                      <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                          <p className="text-xs text-slate-400 leading-relaxed">
                              Generating <b>{reportType}</b> in <b>{format}</b> format for <b>{month} {year}</b>.
                          </p>
                      </div>
                  </div>
              </div>

              <button 
                onClick={generateReport} 
                disabled={isGenerating || !isLocked}
                className={`w-full py-4 font-black rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all mt-6 ${
                    !isLocked 
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20'
                }`}
              >
                  {isGenerating ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                  ) : !isLocked ? (
                      <>
                        <Lock size={20} /> FINALIZE PAYROLL TO DOWNLOAD
                      </>
                  ) : (
                      <>
                        <Download size={20} /> DOWNLOAD REPORT
                      </>
                  )}
              </button>
          </div>
      </div>

      {/* Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setModalState({ ...modalState, isOpen: false })} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                <div className="flex flex-col items-center gap-2">
                    <div className={`p-3 rounded-full border ${modalState.type === 'error' ? 'bg-red-900/30 text-red-500 border-red-900/50' : modalState.type === 'success' ? 'bg-emerald-900/30 text-emerald-500 border-emerald-900/50' : 'bg-blue-900/30 text-blue-500 border-blue-900/50'}`}>
                        {modalState.type === 'error' ? <AlertTriangle size={24} /> : modalState.type === 'success' ? <CheckCircle2 size={24} /> : <Lock size={24} />}
                    </div>
                    <h3 className="text-lg font-bold text-white text-center">{modalState.title}</h3>
                    <p className="text-sm text-slate-400 text-center whitespace-pre-line">{modalState.message}</p>
                </div>
                
                <div className="flex gap-3 mt-4">
                    {modalState.type === 'confirm' ? (
                        <>
                            <button onClick={() => setModalState({ ...modalState, isOpen: false })} className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 font-bold hover:bg-slate-800 transition-colors">Cancel</button>
                            <button onClick={modalState.onConfirm} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg">Confirm</button>
                        </>
                    ) : (
                        <button onClick={() => setModalState({ ...modalState, isOpen: false })} className="w-full py-2.5 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition-colors">Close</button>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Reports;