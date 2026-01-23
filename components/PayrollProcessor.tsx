
import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, FileText, Calculator, AlertTriangle, X, Printer, Save, Lock, Snowflake, HelpCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { Employee, StatutoryConfig, PayrollResult, Attendance, LeaveLedger, AdvanceLedger } from '../types';
import { calculatePayroll } from '../services/payrollEngine';
import { generatePaySlipsPDF, generateSimplePaySheetPDF, numberToWords } from '../services/reportService';
import { BRAND_CONFIG } from '../constants';

interface PayrollProcessorProps {
  employees: Employee[];
  config: StatutoryConfig;
  attendances: Attendance[];
  leaveLedgers: LeaveLedger[];
  advanceLedgers: AdvanceLedger[];
  savedRecords: PayrollResult[];
  setSavedRecords: React.Dispatch<React.SetStateAction<PayrollResult[]>>; // Enhanced type definition
  // Global date props
  month: string;
  year: number;
  setMonth: (m: string) => void;
  setYear: (y: number) => void;
  // Ledger Setters for Freeze
  setLeaveLedgers?: (l: LeaveLedger[]) => void;
  setAdvanceLedgers?: (a: AdvanceLedger[]) => void;
  hideContextSelector?: boolean;
}

const PayrollProcessor: React.FC<PayrollProcessorProps> = ({ 
  employees, 
  config, 
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
  hideContextSelector = false
}) => {
  const [processed, setProcessed] = useState<PayrollResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false); // Persists "Draft Saved" state
  const [viewingSlip, setViewingSlip] = useState<PayrollResult | null>(null);
  const [isLoadedFromSave, setIsLoadedFromSave] = useState(false);
  const [payrollStatus, setPayrollStatus] = useState<'Draft' | 'Finalized' | null>(null);

  // Custom Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'success' | 'error';
    title: string;
    message: string | React.ReactNode;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'confirm', title: '', message: '' });

  // Compliance Rule: If employee count >= 20, PF must be Statutory
  const isMandatoryStatutory = employees.length >= 20;
  const isComplianceValid = !isMandatoryStatutory || (isMandatoryStatutory && config.pfComplianceType === 'Statutory');

  // Effect: Load Saved Records whenever Global Month/Year changes
  useEffect(() => {
    // Safety check: ensure savedRecords is an array
    const history = Array.isArray(savedRecords) ? savedRecords : [];
    const existingRecords = history.filter(r => r.month === month && r.year === year);
    
    if (existingRecords.length > 0) {
        setProcessed(existingRecords);
        setIsLoadedFromSave(true);
        // If any record is Finalized, the whole month is considered Finalized
        setPayrollStatus(existingRecords[0].status || 'Draft');
        setShowSavedFeedback(true); // Since it's loaded from save, it is saved
    } else {
        setProcessed([]);
        setIsLoadedFromSave(false);
        setPayrollStatus(null);
        setShowSavedFeedback(false);
    }
  }, [month, year, savedRecords]); 

  // Safe Defaults
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

  const runPayroll = () => {
    if (!isComplianceValid) return;
    if (payrollStatus === 'Finalized') return;

    setIsProcessing(true);
    // Short timeout for UI feedback only
    setTimeout(() => {
      try {
          const results = employees.map(emp => {
            // Attendance default for calculation
            const att = attendances.find(a => a.employeeId === emp.id && a.month === month && a.year === year) || 
                        { employeeId: emp.id, month: month, year: year, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 };
            
            const leave = leaveLedgers.find(l => l.employeeId === emp.id) || defaultLeaveLedger(emp.id);
            const advance = advanceLedgers.find(a => a.employeeId === emp.id) || defaultAdvanceLedger(emp.id);
            
            const result = calculatePayroll(emp, config, att, leave, advance, month, year);
            
            // Set status to Draft initially
            result.status = 'Draft';
            return result;
          });
          
          // NOTE: We do NOT auto-save to persistence here anymore.
          // User must explicitly click "Save Draft".

          // Optimistic UI updates
          setProcessed(results);
          setIsProcessing(false);
          setIsLoadedFromSave(false); // It's a fresh calculation
          setPayrollStatus('Draft');
          setShowSavedFeedback(false); // Reset feedback on recalculate (Re-edit mode)
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

  const executeSave = async () => {
    setIsSaving(true);
    setModalState(prev => ({ ...prev, isOpen: false })); // Close confirmation modal
    
    try {
        // Validation: Check if processed data exists
        if (!processed || processed.length === 0) {
            throw new Error("No payroll data calculated. Please run 'Calculate Pay Sheet' first.");
        }

        // 1. Prepare Draft Records
        const draftRecords = processed.map(r => ({
            ...r,
            status: 'Draft' as const // Ensure we stay in Draft mode so Reports can Freeze later
        }));
        
        // 2. Update Global History using FUNCTIONAL UPDATE to avoid stale state
        setSavedRecords(prevRecords => {
            const currentHistory = Array.isArray(prevRecords) ? prevRecords : [];
            // Remove any existing records for this period (overwrite logic)
            const otherRecords = currentHistory.filter(r => !(r.month === month && r.year === year));
            return [...otherRecords, ...draftRecords];
        });

        // 3. Update Local UI State
        setProcessed(draftRecords);
        setPayrollStatus('Draft');
        setIsLoadedFromSave(true);
        
        // Show Success Feedback Button persistently until re-edit
        setShowSavedFeedback(true);
        
        setModalState({
            isOpen: true,
            type: 'success',
            title: 'Draft Saved',
            message: "Payroll calculated and saved as Draft.\n\nTo lock data and rollover ledgers, go to 'Pay Reports' and click 'Confirm & Freeze'."
        });

    } catch (error: any) {
        console.error("Save Error:", error);
        setModalState({
            isOpen: true,
            type: 'error',
            title: 'Save Failed',
            message: `Reason: ${error.message}`
        });
    } finally {
        setIsSaving(false);
    }
  };

  const initiateSave = () => {
    // Always trigger save confirmation
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

  const getEmployee = (id: string) => employees.find(e => e.id === id);

  const handleDownloadPaySheet = () => {
      if (processed.length === 0) return;
      // Use simple pay sheet generator based on new request
      generateSimplePaySheetPDF(processed, employees, month, year);
  };

  const handleDownloadIndividualSlip = (result: PayrollResult) => {
      generatePaySlipsPDF([result], employees, month, year);
  };

  return (
    <div className="space-y-6 text-white relative">
      {/* Compliance Warning */}
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

      {/* Locked Status Banner */}
      {payrollStatus === 'Finalized' && (
        <div className="bg-blue-900/20 border border-blue-700 p-4 rounded-xl flex gap-3 items-center">
            <Lock className="text-blue-400" size={24} />
            <div>
                <h3 className="font-bold text-blue-200 text-sm">Payroll Period Locked</h3>
                <p className="text-xs text-blue-300">Data for {month} {year} is confirmed. Statutory reports can be generated. To edit, you must unlock via Pay Reports.</p>
            </div>
        </div>
      )}

      <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="flex gap-4">
          {!hideContextSelector && (
            <>
            <select value={month} onChange={e => setMonth(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white">
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (<option key={m} value={m}>{m}</option>))}
            </select>
            <select value={year} onChange={e => setYear(+e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white">
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
            </select>
            </>
          )}
        </div>
        
        <div className="flex gap-3">
             {processed.length > 0 && (
                <button 
                    onClick={handleDownloadPaySheet}
                    className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all text-sm bg-slate-700 hover:bg-slate-600 text-slate-200"
                >
                    <FileSpreadsheet size={18} /> Download Pay Sheet
                </button>
             )}

             {processed.length > 0 && payrollStatus !== 'Finalized' && (
               <button 
                onClick={initiateSave} 
                disabled={isSaving || showSavedFeedback} 
                className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all text-sm disabled:opacity-70 disabled:cursor-not-allowed ${
                    showSavedFeedback 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
               >
                {isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : showSavedFeedback ? <CheckCircle2 size={18} /> : <Save size={18} />}
                {isSaving ? 'Saving...' : showSavedFeedback ? 'Draft Saved' : 'Save Draft'}
               </button>
             )}

             {payrollStatus === 'Finalized' && (
                 <button disabled className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700">
                     <CheckCircle size={20} /> Data Saved & Locked
                 </button>
             )}

            {payrollStatus !== 'Finalized' && (
                <button 
                onClick={runPayroll} 
                disabled={isProcessing || !isComplianceValid} 
                className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all ${
                    !isComplianceValid 
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                >
                {isProcessing ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" /> : <Play size={20} />}
                {/* Changed to check processed.length for Re-Calculate status */}
                {processed.length > 0 ? 'Re-Calculate' : 'Calculate Pay Sheet'}
                </button>
            )}
        </div>
      </div>

      {/* Results Table */}
      {processed.length > 0 && (
        <div className="bg-[#1e293b] rounded-xl border border-slate-800 overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0f172a] text-[10px] text-sky-400 uppercase font-bold tracking-widest">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-4 py-4 text-center">Paid Days</th>
                <th className="px-4 py-4 text-right text-emerald-400">Gross Earned</th>
                <th className="px-4 py-4 text-right text-amber-400">EPF</th>
                <th className="px-4 py-4 text-right text-amber-400">ESI</th>
                <th className="px-4 py-4 text-right text-amber-400">PT</th>
                <th className="px-4 py-4 text-right text-red-400">Total Ded.</th>
                <th className="px-6 py-4 text-right text-blue-400">Net Payable</th>
                <th className="px-4 py-4 text-center">Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {processed.map((res) => {
                  const emp = getEmployee(res.employeeId);
                  if (!emp) return null;
                  return (
                    <tr key={res.employeeId} className="hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white text-sm">{emp.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{res.employeeId}</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-2 py-1 rounded bg-slate-900 text-slate-300 font-mono text-xs">{res.payableDays}</span>
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-emerald-400">
                        {Math.round(res.earnings.total).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-slate-400">
                        {Math.round(res.deductions.epf).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-slate-400">
                        {Math.round(res.deductions.esi).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-slate-400">
                        {Math.round(res.deductions.pt).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-red-400 font-bold">
                        {Math.round(res.deductions.total).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-blue-400 font-black text-lg">
                        {Math.round(res.netPay).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button 
                            onClick={() => setViewingSlip(res)}
                            className="p-2 hover:bg-blue-900/30 text-slate-500 hover:text-blue-400 rounded-lg transition-colors"
                        >
                            <FileText size={16} />
                        </button>
                      </td>
                    </tr>
                  );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* PAY SLIP MODAL - Updated to Match ILCbala Screenshot */}
      {viewingSlip && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-3xl max-h-[95vh] overflow-y-auto rounded-lg shadow-2xl relative flex flex-col text-slate-900">
                <div className="absolute top-4 right-4 flex gap-2 no-print">
                    <button 
                        onClick={() => handleDownloadIndividualSlip(viewingSlip)}
                        className="text-slate-500 hover:text-blue-600 p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Download PDF"
                    >
                        <Printer size={20} />
                    </button>
                    <button onClick={() => setViewingSlip(null)} className="text-slate-400 hover:text-red-500 p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-8">
                    {(() => {
                        const emp = getEmployee(viewingSlip.employeeId);
                        if (!emp) return null;
                        
                        // FIX: Grouped Allowances mapping to match PDF logic exactly
                        // "Special Allowances" in PDF refers to special1 + special2 + special3
                        const specialAllowanceTotal = viewingSlip.earnings.special1 + viewingSlip.earnings.special2 + viewingSlip.earnings.special3;
                        
                        // "Other Allowances" in PDF refers to washing + attire
                        const otherAllowanceTotal = viewingSlip.earnings.washing + viewingSlip.earnings.attire;

                        return (
                            <div className="font-sans text-slate-900">
                                {/* Header */}
                                <div className="text-center mb-6">
                                    <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-widest">{BRAND_CONFIG.companyName}</h1>
                                    <p className="text-sm text-slate-600 font-medium mt-1">Industrial Estate, Chennai, Tamil Nadu</p>
                                    <div className="mt-4">
                                        <h2 className="text-lg font-bold text-slate-800 uppercase">PAY SLIP - {month.toUpperCase()} {year}</h2>
                                    </div>
                                </div>

                                {/* Employee Details Grid */}
                                <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-slate-800 mb-6 border border-slate-200 p-4 rounded-lg bg-slate-50">
                                    {/* Left Column */}
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-[120px_1fr]">
                                            <span className="font-bold">Employee Name:</span>
                                            <span className="uppercase text-slate-900">{emp.name}</span>
                                        </div>
                                        <div className="grid grid-cols-[120px_1fr]">
                                            <span className="font-bold">Employee ID:</span>
                                            <span className="text-slate-900">{emp.id}</span>
                                        </div>
                                        <div className="grid grid-cols-[120px_1fr]">
                                            <span className="font-bold">Bank A/c:</span>
                                            <span className="text-slate-900">{emp.bankAccount}</span>
                                        </div>
                                        <div className="grid grid-cols-[120px_1fr]">
                                            <span className="font-bold">UAN No:</span>
                                            <span className="text-slate-900">{emp.uanc || 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* Right Column */}
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-[120px_1fr]">
                                            <span className="font-bold">Designation:</span>
                                            <span className="text-slate-900">{emp.designation}</span>
                                        </div>
                                        <div className="grid grid-cols-[120px_1fr]">
                                            <span className="font-bold">Department:</span>
                                            <span className="text-slate-900">{emp.department || emp.division || 'Corporate'}</span>
                                        </div>
                                        <div className="grid grid-cols-[120px_1fr]">
                                            <span className="font-bold">Days Paid:</span>
                                            <span className="text-slate-900">{viewingSlip.payableDays} / {viewingSlip.daysInMonth}</span>
                                        </div>
                                        <div className="grid grid-cols-[120px_1fr]">
                                            <span className="font-bold">PF No:</span>
                                            <span className="text-slate-900">{emp.pfNumber || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Earnings & Deductions Table */}
                                <table className="w-full text-sm border border-slate-300 mb-6 text-slate-900">
                                    <thead className="bg-slate-800 text-white font-bold">
                                        <tr>
                                            <th className="py-2 px-4 text-left w-1/4">Earnings</th>
                                            <th className="py-2 px-4 text-right w-1/4">Amount (Rs.)</th>
                                            <th className="py-2 px-4 text-left w-1/4 border-l border-slate-600">Deductions</th>
                                            <th className="py-2 px-4 text-right w-1/4">Amount (Rs.)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        <tr>
                                            <td className="py-2 px-4 text-slate-800">Basic Pay</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{viewingSlip.earnings.basic.toFixed(2)}</td>
                                            <td className="py-2 px-4 border-l border-slate-200 text-slate-800">Provident Fund</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{viewingSlip.deductions.epf.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-4 text-slate-800">DA</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{viewingSlip.earnings.da.toFixed(2)}</td>
                                            <td className="py-2 px-4 border-l border-slate-200 text-slate-800">Professional Tax</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{viewingSlip.deductions.pt.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-4 text-slate-800">HRA</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{viewingSlip.earnings.hra.toFixed(2)}</td>
                                            <td className="py-2 px-4 border-l border-slate-200 text-slate-800">ESI</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{viewingSlip.deductions.esi.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-4 text-slate-800">Conveyance</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{viewingSlip.earnings.conveyance.toFixed(2)}</td>
                                            <td className="py-2 px-4 border-l border-slate-200 text-slate-800">Income Tax</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{viewingSlip.deductions.it.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-4 text-slate-800">Special Allowances</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{specialAllowanceTotal.toFixed(2)}</td>
                                            <td className="py-2 px-4 border-l border-slate-200 text-slate-800">VPF</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{viewingSlip.deductions.vpf.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-4 text-slate-800">Other Allowances</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{otherAllowanceTotal.toFixed(2)}</td>
                                            <td className="py-2 px-4 border-l border-slate-200 text-slate-800">LWF</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{viewingSlip.deductions.lwf.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-4 text-slate-800">Leave Encashment</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{viewingSlip.earnings.leaveEncashment.toFixed(2)}</td>
                                            <td className="py-2 px-4 border-l border-slate-200 text-slate-800">Advance Recovery</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{viewingSlip.deductions.advanceRecovery.toFixed(2)}</td>
                                        </tr>
                                        <tr className="bg-slate-100 font-bold border-t border-slate-300">
                                            <td className="py-2 px-4 text-slate-900">Total Earnings</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{viewingSlip.earnings.total.toFixed(2)}</td>
                                            <td className="py-2 px-4 border-l border-slate-300 text-slate-900">Total Deductions</td>
                                            <td className="py-2 px-4 text-right font-mono text-slate-900">{viewingSlip.deductions.total.toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Net Pay Box */}
                                <div className="border-2 border-blue-500 bg-white p-4 flex justify-between items-center mb-6 shadow-sm">
                                    <span className="font-bold text-slate-900 text-lg uppercase">NET SALARY PAYABLE:</span>
                                    <span className="font-black text-slate-900 text-2xl">Rs. {Math.round(viewingSlip.netPay).toLocaleString('en-IN')}/-</span>
                                </div>
                                
                                {/* Amount in Words */}
                                <div className="text-slate-800 text-sm font-bold border-b border-slate-300 pb-4 mb-4">
                                   Amount in Words: {numberToWords(Math.round(viewingSlip.netPay))} Rupees Only
                                </div>

                                {/* Footer */}
                                <div className="text-center space-y-2">
                                    <p className="text-xs text-slate-500 italic">This is a computer-generated document and does not require a signature.</p>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
         </div>
      )}

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
                    <div className="text-sm text-slate-400 text-center whitespace-pre-line">{modalState.message}</div>
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

export default PayrollProcessor;
