
import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, FileText, Calculator, AlertTriangle, X, Printer, Save, Lock, Snowflake, HelpCircle, CheckCircle2 } from 'lucide-react';
import { Employee, StatutoryConfig, PayrollResult, Attendance, LeaveLedger, AdvanceLedger } from '../types';
import { calculatePayroll } from '../services/payrollEngine';
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
  const [showSavedFeedback, setShowSavedFeedback] = useState(false); // New temporary feedback state
  const [viewingSlip, setViewingSlip] = useState<PayrollResult | null>(null);
  const [isLoadedFromSave, setIsLoadedFromSave] = useState(false);
  const [payrollStatus, setPayrollStatus] = useState<'Draft' | 'Finalized' | null>(null);

  // Custom Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'success' | 'error';
    title: string;
    message: string;
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
    } else {
        setProcessed([]);
        setIsLoadedFromSave(false);
        setPayrollStatus(null);
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
          setShowSavedFeedback(false); // Reset feedback on recalculate
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
        
        // Show Success Feedback Button temporarily
        setShowSavedFeedback(true);
        setTimeout(() => setShowSavedFeedback(false), 3000); // Revert to Blue "Save Draft" after 3s
        
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
        message: `This will save the current calculation for ${month} ${year}.\n\nYou can still edit attendance and recalculate.\nTo finalize and deduct leaves, use 'Confirm & Freeze' in Reports.`,
        onConfirm: executeSave
    });
  };

  const getEmployee = (id: string) => employees.find(e => e.id === id);

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
             {processed.length > 0 && payrollStatus !== 'Finalized' && (
               <button 
                onClick={initiateSave} 
                disabled={isSaving} 
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
                {isLoadedFromSave ? 'Re-Calculate' : 'Calculate Pay Sheet'}
                </button>
            )}
        </div>
      </div>

      {processed.length === 0 && (
          <div className="text-center py-20 bg-[#1e293b]/50 rounded-2xl border border-slate-800 border-dashed">
              <Calculator size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">Select Month/Year and click Calculate to generate payroll.</p>
              <p className="text-xs text-slate-500 mt-2">Ensure attendance is saved for the selected period first.</p>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {processed.map(res => {
          const emp = employees.find(e => e.id === res.employeeId) || { name: 'Unknown', id: res.employeeId, designation: 'Unknown' } as Employee;
          return (
            <div key={res.employeeId} className="bg-[#1e293b] rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300">
              <div className="p-5 bg-[#0f172a] flex justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-900/30 flex items-center justify-center text-blue-400"><CheckCircle size={18} /></div>
                  <div><h4 className="font-bold text-sm">{emp.name}</h4><p className="text-[10px] text-slate-500 uppercase">{emp.id} • {res.payableDays} Days</p></div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="text-center pb-4 border-b border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Net Take-Home</div>
                  <div className="text-3xl font-black">₹{res.netPay.toLocaleString()}</div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gross Earnings</span>
                    <span className="font-bold">₹{res.earnings.total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Deductions</span>
                    <span className="text-red-400 font-bold">-₹{res.deductions.total.toLocaleString()}</span>
                  </div>
                </div>
                <div className="bg-[#0f172a] p-3 rounded-lg border border-slate-800 text-[10px] text-slate-300 space-y-1">
                  <div className="flex justify-between">
                    <span>Statutory PF (12%)</span>
                    <span>₹{res.deductions.epf}</span>
                  </div>
                  {res.deductions.vpf > 0 && (
                    <div className="flex justify-between text-blue-300 font-medium">
                      <span>VPF (Extra)</span>
                      <span>₹{res.deductions.vpf}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>ESI Contribution</span>
                    <span>₹{res.deductions.esi}</span>
                  </div>
                  <div className="flex justify-between text-amber-500">
                    <span>Prof. Tax</span>
                    <span>₹{res.deductions.pt}</span>
                  </div>
                  <div className="pt-1 mt-1 border-t border-slate-800/50 flex justify-between text-[9px] italic text-slate-500">
                    <span>Employer PF Contrib.</span>
                    <span>₹{(res.employerContributions.epf + res.employerContributions.eps)}</span>
                  </div>
                </div>
              </div>
              <div className="p-3 border-t border-slate-800">
                <button 
                  onClick={() => setViewingSlip(res)}
                  className="w-full py-2 text-[10px] text-blue-400 font-bold uppercase hover:bg-blue-900/10 rounded-lg transition-colors"
                >
                  View Detailed Pay Slip
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* CUSTOM MODAL FOR ALERTS & CONFIRMATION */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setModalState({...modalState, isOpen: false})} className="absolute top-4 right-4 text-slate-400 hover:text-white">
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
                                onClick={() => setModalState({...modalState, isOpen: false})}
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
                            onClick={() => setModalState({...modalState, isOpen: false})}
                            className="w-full py-2.5 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition-colors"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* PAYSLIP MODAL */}
      {viewingSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl flex flex-col text-slate-900">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 flex justify-between items-center sticky top-0 z-10">
               <h2 className="text-lg font-bold text-white flex items-center gap-2">
                 <FileText size={18} className="text-blue-400" /> Pay Slip Preview
               </h2>
               <div className="flex gap-2">
                 <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors" title="Print">
                    <Printer size={18} />
                 </button>
                 <button onClick={() => setViewingSlip(null)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors">
                    <X size={20} />
                 </button>
               </div>
            </div>
            
            <div className="p-8 space-y-6 bg-white font-sans">
                {/* Company Header */}
                <div className="text-center border-b-2 border-slate-200 pb-6">
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide">{BRAND_CONFIG.companyName}</h1>
                    <p className="text-xs text-slate-500 font-bold mt-1">Corporate Office: Industrial Estate, Chennai, Tamil Nadu</p>
                    <div className="mt-4 inline-block px-4 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600">
                        PAYSLIP FOR THE MONTH OF {viewingSlip.month.toUpperCase()} {viewingSlip.year}
                    </div>
                </div>

                {/* Employee Details Grid */}
                {(() => {
                    const emp = getEmployee(viewingSlip.employeeId);
                    return (
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm border-b border-slate-200 pb-6">
                            <div className="flex justify-between"><span className="text-slate-500 font-medium">Employee Name</span> <span className="font-bold">{emp?.name}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 font-medium">Employee ID</span> <span className="font-bold">{viewingSlip.employeeId}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 font-medium">Designation</span> <span className="font-bold">{emp?.designation}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 font-medium">Department</span> <span className="font-bold">{emp?.division}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 font-medium">Date of Joining</span> <span className="font-bold">{emp?.doj}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 font-medium">UAN Number</span> <span className="font-bold">{emp?.uanc || 'N/A'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 font-medium">Payable Days</span> <span className="font-bold">{viewingSlip.payableDays} / {viewingSlip.daysInMonth}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 font-medium">Bank Account</span> <span className="font-bold">{emp?.bankAccount}</span></div>
                            
                            <div className="col-span-2 mt-2 pt-2 border-t border-slate-100 flex items-start gap-2">
                                <span className="text-slate-500 font-medium shrink-0">Address:</span>
                                <span className="font-bold text-slate-700">
                                    {emp?.flatNumber ? `${emp.flatNumber}, ` : ''}
                                    {emp?.streetAddress}, {emp?.city}, {emp?.state} - {emp?.pincode}
                                </span>
                            </div>
                        </div>
                    );
                })()}

                {/* Financials Table */}
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-2 bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-300">
                        <div className="p-3 border-r border-slate-300">Earnings</div>
                        <div className="p-3">Deductions</div>
                    </div>
                    <div className="grid grid-cols-2 text-sm">
                        {/* Earnings Column */}
                        <div className="border-r border-slate-300 p-4 space-y-2">
                             <div className="flex justify-between"><span>Basic Pay</span> <span>{viewingSlip.earnings.basic.toLocaleString()}</span></div>
                             <div className="flex justify-between"><span>DA</span> <span>{viewingSlip.earnings.da.toLocaleString()}</span></div>
                             <div className="flex justify-between"><span>Retaining Allowance</span> <span>{viewingSlip.earnings.retainingAllowance.toLocaleString()}</span></div>
                             <div className="flex justify-between"><span>HRA</span> <span>{viewingSlip.earnings.hra.toLocaleString()}</span></div>
                             <div className="flex justify-between"><span>Conveyance</span> <span>{viewingSlip.earnings.conveyance.toLocaleString()}</span></div>
                             <div className="flex justify-between"><span>Special Allowance</span> <span>{(viewingSlip.earnings.special1 + viewingSlip.earnings.special2 + viewingSlip.earnings.special3).toLocaleString()}</span></div>
                             <div className="flex justify-between"><span>Other Allowances</span> <span>{(viewingSlip.earnings.washing + viewingSlip.earnings.attire).toLocaleString()}</span></div>
                             {viewingSlip.earnings.leaveEncashment > 0 && <div className="flex justify-between"><span>Leave Encashment</span> <span>{viewingSlip.earnings.leaveEncashment.toLocaleString()}</span></div>}
                             {/* Bonus Removed as it's Annual */}
                        </div>
                        
                        {/* Deductions Column */}
                        <div className="p-4 space-y-2">
                             <div className="flex justify-between"><span>Provident Fund (Employee)</span> <span>{viewingSlip.deductions.epf.toLocaleString()}</span></div>
                             {viewingSlip.deductions.vpf > 0 && <div className="flex justify-between"><span>VPF (Voluntary)</span> <span>{viewingSlip.deductions.vpf.toLocaleString()}</span></div>}
                             <div className="flex justify-between"><span>ESI Contribution</span> <span>{viewingSlip.deductions.esi.toLocaleString()}</span></div>
                             <div className="flex justify-between"><span>Professional Tax</span> <span>{viewingSlip.deductions.pt.toLocaleString()}</span></div>
                             <div className="flex justify-between"><span>Income Tax Recovery</span> <span>{viewingSlip.deductions.it.toLocaleString()}</span></div>
                             <div className="flex justify-between"><span>Labour Welfare Fund</span> <span>{viewingSlip.deductions.lwf.toLocaleString()}</span></div>
                             {viewingSlip.deductions.advanceRecovery > 0 && <div className="flex justify-between"><span>Advance Recovery</span> <span>{viewingSlip.deductions.advanceRecovery.toLocaleString()}</span></div>}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 bg-slate-50 border-t border-slate-300 font-bold text-sm">
                        <div className="p-3 border-r border-slate-300 flex justify-between">
                            <span>Total Earnings (A)</span>
                            <span>₹ {viewingSlip.earnings.total.toLocaleString()}</span>
                        </div>
                        <div className="p-3 flex justify-between text-red-600">
                            <span>Total Deductions (B)</span>
                            <span>₹ {viewingSlip.deductions.total.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Net Pay */}
                <div className="flex items-center justify-between bg-blue-50 p-6 rounded-xl border border-blue-100">
                    <div>
                        <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">Net Salary Payable</span>
                        <p className="text-xs text-slate-500 italic mt-1">(Total Earnings - Total Deductions)</p>
                    </div>
                    <div className="text-3xl font-black text-slate-800">
                        ₹ {viewingSlip.netPay.toLocaleString()}
                    </div>
                </div>

                {/* Footer Note */}
                <div className="text-[10px] text-center text-slate-400 mt-8">
                    This is a computer-generated document and does not require a signature.
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollProcessor;
