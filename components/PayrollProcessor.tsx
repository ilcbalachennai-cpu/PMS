
import React, { useState, useEffect, useRef } from 'react';
import { Play, CheckCircle, FileText, Calculator, AlertTriangle, X, Printer, Save, Lock, Snowflake, HelpCircle, CheckCircle2, FileSpreadsheet, Unlock, KeyRound, RefreshCw, Eye, Maximize2, Minimize2 } from 'lucide-react';
import { Employee, StatutoryConfig, PayrollResult, Attendance, LeaveLedger, AdvanceLedger, CompanyProfile, User } from '../types';
import { calculatePayroll } from '../services/payrollEngine';
import { numberToWords } from '../services/reportService';
import { BRAND_CONFIG } from '../constants';

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
  setLeaveLedgers?: (l: LeaveLedger[]) => void;
  setAdvanceLedgers?: (a: AdvanceLedger[]) => void;
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
  year,
  setMonth,
  setYear,
  setLeaveLedgers,
  setAdvanceLedgers,
  hideContextSelector = false,
  currentUser
}) => {
  const [processed, setProcessed] = useState<PayrollResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [isLoadedFromSave, setIsLoadedFromSave] = useState(false);
  const [payrollStatus, setPayrollStatus] = useState<'Draft' | 'Finalized' | null>(null);
  const [showUnlockAuth, setShowUnlockAuth] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Modal States for Viewing
  const [viewingPaySheet, setViewingPaySheet] = useState(false);
  const [paySlipData, setPaySlipData] = useState<PayrollResult | null>(null);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'success' | 'error';
    title: string;
    message: string | React.ReactNode;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'confirm', title: '', message: '' });

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const isMandatoryStatutory = employees.length >= 20;
  const isComplianceValid = !isMandatoryStatutory || (isMandatoryStatutory && config.pfComplianceType === 'Statutory');
  const canUnlock = currentUser?.role === 'Developer' || currentUser?.role === 'Administrator';

  useEffect(() => {
    const history = Array.isArray(savedRecords) ? savedRecords : [];
    const existingRecords = history.filter(r => r.month === month && r.year === year);
    if (existingRecords.length > 0) {
        setProcessed(existingRecords);
        setIsLoadedFromSave(true);
        setPayrollStatus(existingRecords[0].status || 'Draft');
        setShowSavedFeedback(true);
    } else {
        setProcessed([]);
        setIsLoadedFromSave(false);
        setPayrollStatus(null);
        setShowSavedFeedback(false);
    }
  }, [month, year, savedRecords]); 

  const defaultLeaveLedger = (empId: string): LeaveLedger => ({
      employeeId: empId,
      el: { opening: 0, eligible: 0, encashed: 0, availed: 0, balance: 0 },
      sl: { eligible: 0, availed: 0, balance: 0 },
      cl: { availed: 0, accumulation: 0, balance: 0 }
    });

  const defaultAdvanceLedger = (empId: string): AdvanceLedger => ({
      employeeId: empId,
      opening: 0,
      totalAdvance: 0,
      monthlyInstallment: 0,
      paidAmount: 0,
      balance: 0
  });

  const executePayrollRun = () => {
    setModalState(prev => ({ ...prev, isOpen: false })); // Close modal if open
    setIsProcessing(true);
    setTimeout(() => {
      try {
          const results = employees.map(emp => {
            const att = attendances.find(a => a.employeeId === emp.id && a.month === month && a.year === year) || 
                        { employeeId: emp.id, month: month, year: year, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 };
            const leave = leaveLedgers.find(l => l.employeeId === emp.id) || defaultLeaveLedger(emp.id);
            const advance = advanceLedgers.find(a => a.employeeId === emp.id) || defaultAdvanceLedger(emp.id);
            const result = calculatePayroll(emp, config, att, leave, advance, month, year);
            result.status = 'Draft';
            return result;
          });
          setProcessed(results);
          setIsProcessing(false);
          setIsLoadedFromSave(false);
          setPayrollStatus('Draft');
          setShowSavedFeedback(false);
      } catch (error: any) {
          console.error("Calculation Error:", error);
          setModalState({
             isOpen: true,
             type: 'error',
             title: 'Calculation Error',
             message: `Error during payroll calculation: ${error.message}`
          });
          setIsProcessing(false);
      }
    }, 800);
  };

  const checkAgeMaturity = () => {
    const unconfiguredMaturity: Employee[] = [];
    const monthIndex = months.indexOf(month);

    employees.forEach(emp => {
        if (!emp.dob) return;
        const dob = new Date(emp.dob);
        const maturityDate = new Date(dob.getFullYear() + 58, dob.getMonth(), dob.getDate());
        const periodStart = new Date(year, monthIndex, 1);
        const periodEnd = new Date(year, monthIndex + 1, 0);
        const isTurning58 = maturityDate >= periodStart && maturityDate <= periodEnd;
        const isAlreadyOver58 = maturityDate < periodStart;

        if ((isTurning58 || isAlreadyOver58) && !emp.isDeferredPension) {
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
                    <p className="font-bold text-amber-400">The following employees have crossed the age of 58 and require configuration:</p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-300 max-h-32 overflow-y-auto custom-scrollbar">
                        {unconfiguredMaturity.map(e => (
                            <li key={e.id}><span className="text-white font-semibold">{e.name}</span> <span className="text-xs text-slate-500">(DOB: {e.dob})</span></li>
                        ))}
                    </ul>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-2">
                        <p className="font-bold text-sky-400 text-xs uppercase flex items-center gap-2">
                            <AlertTriangle size={12} /> Steps to Resolve
                        </p>
                        <p className="text-xs text-slate-300">
                            You must go to <b>Employee Master &gt; Edit Employee &gt; Statutory Options</b> and select "Opt for Deferred Pension".
                        </p>
                    </div>
                    <p className="text-xs text-center text-red-400 font-bold mt-2">Payroll processing is blocked until these settings are updated.</p>
                </div>
            ),
        });
        return false;
    }
    return true;
  };

  const runPayroll = () => {
    if (!isComplianceValid) return;
    if (payrollStatus === 'Finalized') return;
    const canProceed = checkAgeMaturity();
    if (canProceed) {
        executePayrollRun();
    }
  };

  const executeSave = async () => {
    setIsSaving(true);
    setModalState(prev => ({ ...prev, isOpen: false }));
    try {
        if (!processed || processed.length === 0) {
            throw new Error("No payroll data calculated. Please run 'Calculate Pay Sheet' first.");
        }
        const draftRecords = processed.map(r => ({ ...r, status: 'Draft' as const }));
        setSavedRecords(prevRecords => {
            const currentHistory = Array.isArray(prevRecords) ? prevRecords : [];
            const otherRecords = currentHistory.filter(r => !(r.month === month && r.year === year));
            return [...otherRecords, ...draftRecords];
        });
        setProcessed(draftRecords);
        setPayrollStatus('Draft');
        setIsLoadedFromSave(true);
        setShowSavedFeedback(true);
        setModalState({
            isOpen: true,
            type: 'success',
            title: 'Draft Saved',
            message: "Payroll calculated and saved as Draft.\n\nTo lock data and rollover ledgers, go to 'Pay Reports' and click 'Confirm & Freeze'."
        });
    } catch (error: any) {
        setModalState({ isOpen: true, type: 'error', title: 'Save Failed', message: `Reason: ${error.message}` });
    } finally {
        setIsSaving(false);
    }
  };

  const initiateSave = () => {
    setModalState({
        isOpen: true,
        type: 'confirm',
        title: 'Save Payroll Draft',
        message: (
            <div className="text-slate-300 leading-relaxed">
                This will save the current calculation for 
                <span className="font-black text-sky-400 block text-xl my-2">{month} {year}</span>
                <span className="text-sm">You can still edit attendance and recalculate.</span>
                <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-slate-400">
                    To finalize and deduct leaves, use <span className="font-bold text-white">'Confirm & Freeze'</span> in Pay Reports.
                </div>
            </div>
        ),
        onConfirm: executeSave
    });
  };

  const handleConfirmUnlock = () => {
      if (authPassword === currentUser?.password) {
          setShowUnlockAuth(false);
          setSavedRecords(prev => prev.map(r => {
              if (r.month === month && r.year === year) {
                  return { ...r, status: 'Draft' as const };
              }
              return r;
          }));
          setPayrollStatus('Draft');
          setModalState({
              isOpen: true,
              type: 'success',
              title: 'Period Unlocked',
              message: "Payroll period unlocked successfully. You can now edit attendance and recalculate."
          });
      } else {
          setAuthError('Incorrect Password');
      }
  };

  const initiateUnlock = () => {
      const currentMonthIdx = months.indexOf(month);
      const currentVal = year * 12 + currentMonthIdx;

      const futureRecord = savedRecords.find(r => {
          const rMonthIdx = months.indexOf(r.month);
          const rVal = r.year * 12 + rMonthIdx;
          return rVal > currentVal;
      });

      if (futureRecord) {
          setModalState({
              isOpen: true,
              type: 'error',
              title: 'Unlock Restricted',
              message: `Cannot unlock ${month} ${year}.\n\nPayroll for a future month (${futureRecord.month} ${futureRecord.year}) is already in process. Please revert the latest months first.`
          });
          return;
      }

      setAuthPassword('');
      setAuthError('');
      setShowUnlockAuth(true);
  };

  const buildAddressString = (profile?: CompanyProfile) => {
    if (!profile) return "Industrial Estate, Chennai, Tamil Nadu";
    const parts = [
        profile.doorNo,
        profile.buildingName,
        profile.street,
        profile.locality,
        profile.area,
        profile.city,
        profile.state,
        profile.pincode
    ].filter(Boolean);
    return parts.join(', ');
  };

  return (
    <div className="space-y-6 text-white relative">
      {!isComplianceValid && (
        <div className="bg-red-900/30 border border-red-700 p-6 rounded-2xl flex gap-4 items-start animate-pulse">
          <AlertTriangle className="text-red-400 shrink-0" size={32} />
          <div>
            <h3 className="text-lg font-bold text-red-200">Legal Compliance Alert: PF Mandatory Selection</h3>
            <p className="text-sm text-red-300 mt-1">
              Your employee strength is <span className="font-bold underline">{employees.length}</span>. As per Indian Labor Law, once an establishment reaches 20 employees, EPF registration is mandatory. 
            </p>
            <p className="text-sm text-red-100 font-bold mt-2">
              Please update Company Configuration to "Statutory" PF compliance to proceed.
            </p>
          </div>
        </div>
      )}

      {payrollStatus === 'Finalized' && (
        <div className="bg-blue-900/20 border border-blue-700 p-4 rounded-xl flex items-center justify-between shadow-lg">
            <div className="flex gap-3 items-center">
                <Lock className="text-blue-400" size={24} />
                <div>
                    <h3 className="font-bold text-blue-200 text-sm">Payroll Period Locked</h3>
                    <p className="text-xs text-blue-300">Data for {month} {year} is confirmed. Statutory reports can be generated.</p>
                </div>
            </div>
            {canUnlock && (
                <button 
                    onClick={initiateUnlock}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-800 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors border border-blue-600 shadow-md"
                >
                    <Unlock size={14} /> Unlock Period
                </button>
            )}
        </div>
      )}

      <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="flex gap-4">
          {!hideContextSelector && (
            <>
            <select value={month} onChange={e => setMonth(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white">
                {months.map(m => (<option key={m} value={m}>{m}</option>))}
            </select>
            <select value={year} onChange={e => setYear(+e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white">
                {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                ))}
            </select>
            </>
          )}
        </div>
        
        <div className="flex gap-3">
             {processed.length > 0 && (
                <button 
                    onClick={() => setViewingPaySheet(true)}
                    className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all text-sm bg-slate-700 hover:bg-slate-600 text-slate-200"
                >
                    <FileSpreadsheet size={18} /> View Pay Sheet
                </button>
             )}

             {processed.length > 0 && payrollStatus !== 'Finalized' && (
               <button 
                   onClick={initiateSave}
                   disabled={isSaving || isLoadedFromSave}
                   className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg disabled:opacity-50 
                       ${isLoadedFromSave 
                           ? 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none' 
                           : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
               >
                   {isSaving ? <RefreshCw className="animate-spin" size={18} /> : isLoadedFromSave ? <CheckCircle size={18} /> : <Save size={18} />}
                   {isLoadedFromSave ? 'Draft Saved' : 'Save Draft'}
               </button>
             )}
             
             {payrollStatus !== 'Finalized' && (
                 <button 
                     onClick={runPayroll}
                     disabled={isProcessing || !isComplianceValid}
                     className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg disabled:opacity-50"
                 >
                     {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} />}
                     {processed.length > 0 ? 'Recalculate' : 'Run Payroll'}
                 </button>
             )}
        </div>
      </div>
      
      {/* Result Table */}
      {processed.length > 0 ? (
        <div className="bg-[#1e293b] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#0f172a] text-xs font-bold uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-4 py-4 text-center">Days</th>
                  <th className="px-4 py-4 text-center">Earnings</th>
                  <th className="px-4 py-4 text-center">PF</th>
                  <th className="px-4 py-4 text-center">ESI</th>
                  <th className="px-4 py-4 text-center">TDS/PT</th>
                  <th className="px-4 py-4 text-center">Deductions</th>
                  <th className="px-6 py-4 text-right">Net Pay</th>
                  <th className="px-4 py-4 text-center">View Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {processed.map(res => {
                  const emp = employees.find(e => e.id === res.employeeId);
                  return (
                    <tr key={res.employeeId} className="hover:bg-slate-800/50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-white">{emp?.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{res.employeeId}</div>
                      </td>
                      <td className="px-4 py-4 text-center text-slate-300 font-mono">{res.payableDays}</td>
                      <td className="px-4 py-4 text-center text-emerald-400 font-mono">{res.earnings.total.toLocaleString()}</td>
                      <td className="px-4 py-4 text-center text-slate-400 font-mono">{res.deductions.epf.toLocaleString()}</td>
                      <td className="px-4 py-4 text-center text-slate-400 font-mono">{res.deductions.esi.toLocaleString()}</td>
                      <td className="px-4 py-4 text-center text-slate-400 font-mono">{(res.deductions.it + res.deductions.pt).toLocaleString()}</td>
                      <td className="px-4 py-4 text-center text-red-400 font-mono">{res.deductions.total.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-bold text-white text-lg font-mono">₹{res.netPay.toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                          <button 
                            onClick={() => setPaySlipData(res)}
                            className="text-sky-400 hover:text-white p-2 hover:bg-sky-900/30 rounded transition-colors"
                            title="View/Print Pay Slip"
                          >
                              <Eye size={18} />
                          </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 bg-[#1e293b] rounded-xl border border-slate-800 border-dashed text-slate-500">
            <Calculator size={48} className="mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-white">No Payroll Data</h3>
            <p className="text-sm mb-6">Click "Run Payroll" to calculate salaries for this period.</p>
            {payrollStatus !== 'Finalized' && (
             <button 
                 onClick={runPayroll}
                 disabled={isProcessing || !isComplianceValid}
                 className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg"
             >
                 <Play size={18} />
                 Calculate Now
             </button>
            )}
        </div>
      )}

      {/* Pay Sheet Modal View */}
      {viewingPaySheet && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-[95vw] h-[90vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col relative overflow-hidden">
                <div className="p-4 bg-[#0f172a] border-b border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <FileSpreadsheet size={20} className="text-blue-400" />
                        Pay Sheet View <span className="text-slate-500 text-sm font-normal">({month} {year})</span>
                    </h3>
                    <button onClick={() => setViewingPaySheet(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-[#0f172a] text-slate-400 font-bold sticky top-0 z-10">
                            <tr>
                                <th className="p-3 bg-[#0f172a]">ID</th>
                                <th className="p-3 bg-[#0f172a]">Name</th>
                                <th className="p-3 bg-[#0f172a] text-center">Days</th>
                                <th className="p-3 bg-[#0f172a] text-right">Basic</th>
                                <th className="p-3 bg-[#0f172a] text-right">DA</th>
                                <th className="p-3 bg-[#0f172a] text-right">HRA</th>
                                <th className="p-3 bg-[#0f172a] text-right">Conv</th>
                                <th className="p-3 bg-[#0f172a] text-right">Spl Allw</th>
                                <th className="p-3 bg-[#0f172a] text-right">Other</th>
                                <th className="p-3 bg-[#0f172a] text-right font-bold text-white">Gross</th>
                                <th className="p-3 bg-[#0f172a] text-right">PF</th>
                                <th className="p-3 bg-[#0f172a] text-right">ESI</th>
                                <th className="p-3 bg-[#0f172a] text-right">PT</th>
                                <th className="p-3 bg-[#0f172a] text-right">TDS</th>
                                <th className="p-3 bg-[#0f172a] text-right">LWF</th>
                                <th className="p-3 bg-[#0f172a] text-right">Adv</th>
                                <th className="p-3 bg-[#0f172a] text-right font-bold text-red-400">Ded</th>
                                <th className="p-3 bg-[#0f172a] text-right font-black text-emerald-400 sticky right-0 shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.3)]">Net Pay</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 bg-[#1e293b]">
                            {processed.map(r => {
                                const emp = employees.find(e => e.id === r.employeeId);
                                const spl = r.earnings.special1 + r.earnings.special2 + r.earnings.special3;
                                const oth = r.earnings.washing + r.earnings.attire + r.earnings.retainingAllowance + r.earnings.leaveEncashment;
                                return (
                                    <tr key={r.employeeId} className="hover:bg-slate-800/50">
                                        <td className="p-3 text-slate-400 font-mono">{r.employeeId}</td>
                                        <td className="p-3 font-bold text-white">{emp?.name}</td>
                                        <td className="p-3 text-center text-slate-300">{r.payableDays}</td>
                                        <td className="p-3 text-right text-slate-300">{Math.round(r.earnings.basic)}</td>
                                        <td className="p-3 text-right text-slate-300">{Math.round(r.earnings.da)}</td>
                                        <td className="p-3 text-right text-slate-300">{Math.round(r.earnings.hra)}</td>
                                        <td className="p-3 text-right text-slate-300">{Math.round(r.earnings.conveyance)}</td>
                                        <td className="p-3 text-right text-slate-300">{Math.round(spl)}</td>
                                        <td className="p-3 text-right text-slate-300">{Math.round(oth)}</td>
                                        <td className="p-3 text-right font-bold text-white">{Math.round(r.earnings.total)}</td>
                                        <td className="p-3 text-right text-slate-400">{Math.round(r.deductions.epf)}</td>
                                        <td className="p-3 text-right text-slate-400">{Math.round(r.deductions.esi)}</td>
                                        <td className="p-3 text-right text-slate-400">{Math.round(r.deductions.pt)}</td>
                                        <td className="p-3 text-right text-slate-400">{Math.round(r.deductions.it)}</td>
                                        <td className="p-3 text-right text-slate-400">{Math.round(r.deductions.lwf)}</td>
                                        <td className="p-3 text-right text-slate-400">{Math.round(r.deductions.advanceRecovery)}</td>
                                        <td className="p-3 text-right font-bold text-red-400">{Math.round(r.deductions.total)}</td>
                                        <td className="p-3 text-right font-black text-emerald-400 sticky right-0 bg-[#1e293b] shadow-[-10px_0_10px_-5px_rgba(0,0,0,0.3)]">{Math.round(r.netPay)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {/* Pay Slip Modal View */}
      {paySlipData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col relative overflow-hidden text-slate-900">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 print:hidden">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FileText size={20} className="text-blue-600" />
                        Pay Slip Preview
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={() => window.print()} className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors" title="Print"><Printer size={20} /></button>
                        <button onClick={() => setPaySlipData(null)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"><X size={20} /></button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-auto p-8 bg-white print:p-0" id="printable-payslip">
                    {(() => {
                        const emp = employees.find(e => e.id === paySlipData.employeeId);
                        if (!emp) return null;
                        const res = paySlipData;
                        const spl = res.earnings.special1 + res.earnings.special2 + res.earnings.special3;
                        const other = res.earnings.washing + res.earnings.attire;

                        return (
                            <div className="max-w-[210mm] mx-auto bg-white">
                                {/* Header */}
                                <div className="text-center mb-6">
                                    <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-wide">{(companyProfile?.establishmentName || BRAND_CONFIG.companyName)}</h1>
                                    <p className="text-sm text-slate-600 mt-1">{buildAddressString(companyProfile)}</p>
                                    <h2 className="text-lg font-bold text-slate-900 mt-4 border-b-2 border-slate-800 inline-block pb-1">PAY SLIP - {month.toUpperCase()} {year}</h2>
                                </div>

                                {/* Employee Details Grid */}
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6 border border-slate-300 p-4">
                                    <div className="grid grid-cols-[120px_1fr]">
                                        <span className="font-bold text-slate-700">Employee Name:</span>
                                        <span>{emp.name}</span>
                                    </div>
                                    <div className="grid grid-cols-[120px_1fr]">
                                        <span className="font-bold text-slate-700">Designation:</span>
                                        <span>{emp.designation}</span>
                                    </div>
                                    <div className="grid grid-cols-[120px_1fr]">
                                        <span className="font-bold text-slate-700">Employee ID:</span>
                                        <span>{emp.id}</span>
                                    </div>
                                    <div className="grid grid-cols-[120px_1fr]">
                                        <span className="font-bold text-slate-700">Department:</span>
                                        <span>{emp.division || emp.department}</span>
                                    </div>
                                    <div className="grid grid-cols-[120px_1fr]">
                                        <span className="font-bold text-slate-700">Bank A/c:</span>
                                        <span>{emp.bankAccount}</span>
                                    </div>
                                    <div className="grid grid-cols-[120px_1fr]">
                                        <span className="font-bold text-slate-700">Days Paid:</span>
                                        <span>{res.payableDays} / {res.daysInMonth}</span>
                                    </div>
                                    <div className="grid grid-cols-[120px_1fr]">
                                        <span className="font-bold text-slate-700">UAN No:</span>
                                        <span>{emp.uanc || 'N/A'}</span>
                                    </div>
                                    <div className="grid grid-cols-[120px_1fr]">
                                        <span className="font-bold text-slate-700">PF No:</span>
                                        <span>{emp.pfNumber || 'N/A'}</span>
                                    </div>
                                    <div className="grid grid-cols-[120px_1fr]">
                                        <span className="font-bold text-slate-700">ESI No:</span>
                                        <span>{emp.esiNumber || 'N/A'}</span>
                                    </div>
                                    <div className="grid grid-cols-[120px_1fr]">
                                        <span className="font-bold text-slate-700">PAN No:</span>
                                        <span>{emp.pan || 'N/A'}</span>
                                    </div>
                                </div>

                                {/* Salary Matrix */}
                                <div className="border border-slate-800 mb-6">
                                    <div className="grid grid-cols-4 bg-slate-100 border-b border-slate-800 font-bold text-sm">
                                        <div className="p-2 text-center border-r border-slate-800">Earnings</div>
                                        <div className="p-2 text-center border-r border-slate-800">Amount (Rs.)</div>
                                        <div className="p-2 text-center border-r border-slate-800">Deductions</div>
                                        <div className="p-2 text-center">Amount (Rs.)</div>
                                    </div>
                                    
                                    {/* Rows */}
                                    {[
                                        ['Basic Pay', res.earnings.basic, res.isCode88 ? 'Provident Fund*' : 'Provident Fund', res.deductions.epf],
                                        ['DA', res.earnings.da, res.isESICodeWagesUsed ? 'ESI**' : 'ESI', res.deductions.esi],
                                        ['Retaining Allowance', res.earnings.retainingAllowance, 'Professional Tax', res.deductions.pt],
                                        ['HRA', res.earnings.hra, 'Income Tax Recovery', res.deductions.it],
                                        ['Conveyance', res.earnings.conveyance, 'VPF', res.deductions.vpf],
                                        ['Special Allowance', spl, 'LWF', res.deductions.lwf],
                                        ['Other Allowances', other, 'Advance Recovery', res.deductions.advanceRecovery],
                                        ['Leave Encashment', res.earnings.leaveEncashment, '', '']
                                    ].map((row, idx) => (
                                        <div key={idx} className="grid grid-cols-4 text-sm border-b border-slate-200 last:border-b-0">
                                            <div className="p-2 px-4 border-r border-slate-200">{row[0]}</div>
                                            <div className="p-2 px-4 text-right border-r border-slate-800 font-mono">{typeof row[1] === 'number' ? row[1].toFixed(2) : ''}</div>
                                            <div className="p-2 px-4 border-r border-slate-200">{row[2]}</div>
                                            <div className="p-2 px-4 text-right font-mono">{typeof row[3] === 'number' && row[2] ? row[3].toFixed(2) : ''}</div>
                                        </div>
                                    ))}

                                    {/* Total Row */}
                                    <div className="grid grid-cols-4 bg-slate-100 border-t border-slate-800 font-bold text-sm">
                                        <div className="p-2 px-4 border-r border-slate-800">Total Earnings</div>
                                        <div className="p-2 px-4 text-right border-r border-slate-800">{res.earnings.total.toFixed(2)}</div>
                                        <div className="p-2 px-4 border-r border-slate-800">Total Deductions</div>
                                        <div className="p-2 px-4 text-right">{res.deductions.total.toFixed(2)}</div>
                                    </div>
                                </div>

                                {/* Net Pay Box */}
                                <div className="border border-slate-800 p-4 mb-4 flex justify-between items-center bg-slate-50">
                                    <div className="font-bold text-lg">NET SALARY PAYABLE:</div>
                                    <div className="font-bold text-xl">Rs. {Math.round(res.netPay).toLocaleString('en-IN')}/-</div>
                                </div>

                                {/* Footer */}
                                <div className="space-y-4">
                                    <div className="text-sm font-bold">Amount in Words: {numberToWords(Math.round(res.netPay))} Rupees Only</div>
                                    
                                    <div className="text-xs italic text-slate-500 space-y-1">
                                        {res.isCode88 && <p>* PF calculated on Code Wages (Social Security Code 2020)</p>}
                                        {res.isESICodeWagesUsed && <p>** ESI calculated on Code Wages (Social Security Code 2020)</p>}
                                    </div>

                                    <div className="text-center text-xs text-slate-400 pt-8">
                                        This is a computer-generated document and does not require a signature.
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setModalState({ ...modalState, isOpen: false })} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                <div className="flex flex-col items-center gap-2">
                    <div className={`p-3 rounded-full border ${modalState.type === 'error' ? 'bg-red-900/30 text-red-500 border-red-900/50' : modalState.type === 'success' ? 'bg-emerald-900/30 text-emerald-500 border-emerald-900/50' : 'bg-blue-900/30 text-blue-500 border-blue-900/50'}`}>
                        {modalState.type === 'error' ? <AlertTriangle size={24} /> : modalState.type === 'success' ? <CheckCircle2 size={24} /> : <HelpCircle size={24} />}
                    </div>
                    <h3 className="text-lg font-bold text-white text-center">{modalState.title}</h3>
                    <div className="text-sm text-slate-400 text-center whitespace-pre-line w-full">{modalState.message}</div>
                </div>
                
                <div className="flex gap-3 mt-4">
                    {modalState.type === 'confirm' ? (
                        <>
                            <button onClick={() => setModalState({ ...modalState, isOpen: false })} className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 font-bold hover:bg-slate-800 transition-colors">Cancel</button>
                            <button onClick={modalState.onConfirm} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg">Proceed</button>
                        </>
                    ) : (
                        <button onClick={() => setModalState({ ...modalState, isOpen: false })} className="w-full py-2.5 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition-colors">Close</button>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Unlock Auth Modal */}
      {showUnlockAuth && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-blue-900/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setShowUnlockAuth(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                <div className="flex flex-col items-center gap-2">
                    <div className="p-4 bg-blue-900/20 text-blue-500 rounded-full border border-blue-900/50 mb-2">
                        <KeyRound size={32} />
                    </div>
                    <h3 className="text-xl font-black text-white text-center">Unlock Payroll</h3>
                    <p className="text-xs text-blue-300 text-center leading-relaxed">
                        Enter your password to unlock the payroll period. This will revert the status to Draft.
                    </p>
                </div>
                
                <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <input 
                        type="password" 
                        placeholder="Enter your password" 
                        autoFocus
                        className={`w-full bg-[#0f172a] border ${authError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                        value={authPassword}
                        onChange={(e) => { setAuthPassword(e.target.value); setAuthError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmUnlock()}
                    />
                    {authError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{authError}</p>}
                </div>
                
                <button 
                    onClick={handleConfirmUnlock}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
                >
                    <Unlock size={18} /> CONFIRM UNLOCK
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default PayrollProcessor;
