
import React, { useState, useMemo } from 'react';
import { 
  Download, 
  Printer, 
  UserCircle, 
  FileSpreadsheet,
  CreditCard,
  FileText, 
  Network,
  Building2,
  MapPin,
  RefreshCw,
  Lock,
  Unlock,
  CheckCircle,
  AlertTriangle,
  KeyRound,
  X,
  Save,
  FileCheck,
  HelpCircle,
  ClipboardList,
  Eye
} from 'lucide-react';
import { Employee, StatutoryConfig, Attendance, LeaveLedger, AdvanceLedger, PayrollResult, LeavePolicy, CompanyProfile } from '../types';
import { calculatePayroll } from '../services/payrollEngine';
import { generateExcelReport, generatePDFTableReport, generatePaySlipsPDF, generateSimplePaySheetPDF } from '../services/reportService';
import LedgerManager from './LedgerManager';
import { DEFAULT_LEAVE_POLICY } from '../constants'; // Fallback

interface ReportsProps {
  employees: Employee[];
  config: StatutoryConfig;
  companyProfile: CompanyProfile; // Added prop
  attendances: Attendance[];
  savedRecords: PayrollResult[];
  setSavedRecords: React.Dispatch<React.SetStateAction<PayrollResult[]>>;
  // Global date props
  month: string;
  year: number;
  setMonth: (m: string) => void;
  setYear: (y: number) => void;
  // Ledger props for updates
  leaveLedgers?: LeaveLedger[];
  setLeaveLedgers?: React.Dispatch<React.SetStateAction<LeaveLedger[]>>;
  advanceLedgers?: AdvanceLedger[];
  setAdvanceLedgers?: React.Dispatch<React.SetStateAction<AdvanceLedger[]>>;
}

const Reports: React.FC<ReportsProps> = ({ 
    employees, 
    config, 
    companyProfile,
    attendances, 
    savedRecords, 
    setSavedRecords,
    month,
    year,
    setMonth,
    setYear,
    leaveLedgers = [],
    setLeaveLedgers = (_val) => {},
    advanceLedgers = [],
    setAdvanceLedgers = (_val) => {}
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFreezing, setIsFreezing] = useState(false);
  
  // Ledger Modal State
  const [showLedgerModal, setShowLedgerModal] = useState(false);

  // Unlock Modal State
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // General Notification/Confirmation Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'success' | 'error';
    title: string;
    message: string | React.ReactNode;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'confirm', title: '', message: '' });

  // Dynamic Year Range: Current Year - 5 to Current Year + 1
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);

  // Get current status from saved history
  const currentMonthStatus = useMemo(() => {
    const record = savedRecords.find(r => r.month === month && r.year === year);
    if (!record) return 'Unsaved'; // Data exists in calculation engine but not saved to history
    return record.status || 'Draft'; // Handle legacy records by defaulting to Draft
  }, [savedRecords, month, year]);

  // Helper to get fresh data
  const getPayrollData = (): PayrollResult[] | null => {
    // Try to get saved data first (Draft or Finalized)
    const existingRecords = savedRecords.filter(r => r.month === month && r.year === year);
    if (existingRecords.length > 0) {
        return existingRecords;
    }
    // Return null if no saved data found
    return null;
  };

  const executeFreeze = () => {
    setModalState(prev => ({ ...prev, isOpen: false })); // Close confirmation
    setIsFreezing(true);

    // Small delay to allow UI to show processing state
    setTimeout(() => {
        try {
            // 1. Get the definitive data snapshot (from Draft or Calculation)
            const currentData = getPayrollData();
            
            if (!currentData || currentData.length === 0) {
                throw new Error("No payroll data found to freeze. Please 'Run Payroll' and 'Save Draft' first.");
            }

            // 2. Prepare FINALIZED Data (Synchronous)
            const finalPayrollData: PayrollResult[] = currentData.map(r => ({
                ...r,
                status: 'Finalized' as const
            }));

            // 3. Update Payroll History (Save to Persistence)
            setSavedRecords(prev => {
                // Remove any existing records for this month (Drafts) to replace with Finalized
                const otherRecords = prev.filter(r => !(r.month === month && r.year === year));
                return [...otherRecords, ...finalPayrollData];
            });

            // 4. ROLLOVER Leave Ledgers using FINALIZED data
            if (setLeaveLedgers) {
                setLeaveLedgers(prevLedgers => prevLedgers.map(ledger => {
                // Ensure we match the exact attendance record used for payroll
                const att = attendances.find(a => a.employeeId === ledger.employeeId && a.month === month && a.year === year) || { earnedLeave: 0, sickLeave: 0, casualLeave: 0, encashedDays: 0 };
                
                // CRITICAL FIX: Calculate Closing Balance from "Capacity - Usage" to avoid Double Deduction if 'balance' was already updated by Attendance Save.
                // Previous Logic: (ledger.el.balance) - elUsed. 
                // New Logic: (Opening + Eligible) - elUsed. This is robust whether balance was pre-updated or not.
                
                // EL Logic
                const elUsed = (att.earnedLeave || 0) + (att.encashedDays || 0);
                const elCapacity = (ledger.el.opening || 0) + (ledger.el.eligible || 0);
                const elClosing = elCapacity - elUsed; // True Closing Balance
                
                const elNewAccrual = 1.5;

                // CL Logic
                const clClosing = (ledger.cl.accumulation || 0) - (att.casualLeave || 0);
                const clNewAccrual = 1.0;

                // SL Logic
                const slClosing = (ledger.sl.eligible || 0) - (att.sickLeave || 0);
                const slNewAccrual = 1.0; 

                return {
                    ...ledger,
                    el: {
                        opening: elClosing, // Moved closing to opening for next month
                        eligible: elNewAccrual, // Fresh Accrual
                        encashed: 0,
                        availed: 0, // RESET for next month
                        balance: elClosing + elNewAccrual
                    },
                    sl: {
                        eligible: slClosing + slNewAccrual, // Carry Forward + Accrual
                        availed: 0, // RESET
                        balance: slClosing + slNewAccrual
                    },
                    cl: {
                        accumulation: clClosing + clNewAccrual, // Carry Forward + Accrual
                        availed: 0, // RESET
                        balance: clClosing + clNewAccrual
                    }
                };
                }));
            }

            // 5. ROLLOVER Advance Ledgers using FINALIZED data
            if (setAdvanceLedgers) {
                setAdvanceLedgers(prevAdvances => prevAdvances.map(ledger => {
                    const payroll = finalPayrollData.find(p => p.employeeId === ledger.employeeId);
                    const recovery = payroll ? payroll.deductions.advanceRecovery : 0;
                    
                    // True Closing = Current Balance (which includes manual payments) - Payroll Recovery
                    // Note: Advance Ledger "balance" is robustly calculated as "Open + Grant - Paid" in LedgerManager.
                    // However, here we need to capture the state. 
                    // Best approach: Use the calculated balance from ledger state and subtract recovery.
                    const closingBalance = (ledger.balance || 0) - recovery;

                    return {
                        ...ledger,
                        opening: closingBalance, // Move closing to opening
                        totalAdvance: 0, // STRICT RESET: No new grant
                        monthlyInstallment: ledger.monthlyInstallment, // Keep EMI same
                        paidAmount: 0, // STRICT RESET: No payments made yet in new month
                        balance: closingBalance
                    };
                }));
            }

            // Success Feedback
            setModalState({
                isOpen: true,
                type: 'success',
                title: 'Data Frozen Successfully',
                message: (
                    <div className="text-slate-400">
                        Payroll for <span className="text-sky-400 font-bold text-lg">{month} {year}</span> has been successfully FROZEN.
                        <br /><br />
                        Ledgers have been rolled over with accruals.
                    </div>
                )
            });

        } catch (error: any) {
            console.error("Freeze Error:", error);
            setModalState({
                isOpen: true,
                type: 'error',
                title: 'Freeze Failed',
                message: error.message
            });
        } finally {
            setIsFreezing(false);
        }
    }, 500);
  };

  const initiateFreeze = () => {
      setModalState({
          isOpen: true,
          type: 'confirm',
          title: `Freeze Payroll: ${month} ${year}`,
          message: (
            <div className="text-slate-400">
                Are you sure you want to FREEZE payroll for <span className="text-sky-400 font-bold text-base">{month} {year}</span>?
                <br /><br />
                This will:
                <ul className="list-disc pl-6 mt-2 text-left space-y-1">
                    <li>Lock data for Statutory Reports.</li>
                    <li>ROLLOVER Ledgers to next month.</li>
                    <li>Add monthly Accruals (CL +1, EL +1.5).</li>
                </ul>
            </div>
          ),
          onConfirm: executeFreeze
      });
  };

  const handleUnlockVerify = () => {
    // Allows either 'admin' or standard default 'password'
    if (passwordInput === 'admin' || passwordInput === 'password') {
        setSavedRecords(prev => prev.map(r => {
            if (r.month === month && r.year === year) {
                return { ...r, status: 'Draft' as const };
            }
            return r;
        }));
        
        setShowUnlockModal(false);
        setPasswordInput('');
        setPasswordError('');
        setModalState({
            isOpen: true,
            type: 'success',
            title: 'Data Unlocked',
            message: "Payroll Unlocked. You can now edit attendance and re-calculate in 'Run Payroll'."
        });
    } else {
        setPasswordError("Incorrect Password. Try 'admin' or 'password'.");
    }
  };

  const handleDownload = async (reportType: string, format: 'PDF' | 'Excel') => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    const results = getPayrollData();

    if (!results || results.length === 0) {
        setIsGenerating(false);
        setModalState({
            isOpen: true,
            type: 'error',
            title: 'Data Not Found',
            message: `Payroll for ${month} ${year} has NOT been generated yet.\n\nPlease go to 'Run Payroll' -> 'Calculate Pay Sheet' and 'Save Draft' before generating reports.`
        });
        return;
    }

    try {
      if (reportType === 'Pay Sheet') {
        const flatData = results.map(r => {
          const emp = employees.find(e => e.id === r.employeeId);
          const special = r.earnings.special1 + r.earnings.special2 + r.earnings.special3;
          const other = r.earnings.washing + r.earnings.attire;
          
          return {
            'Emp ID': r.employeeId,
            'Name': emp?.name,
            'Designation': emp?.designation,
            'Days Paid': r.payableDays,
            'Basic': r.earnings.basic,
            'DA': r.earnings.da,
            'Retaining': r.earnings.retainingAllowance,
            'HRA': r.earnings.hra,
            'Conveyance': r.earnings.conveyance,
            'Special Allw': special,
            'Other Allw': other,
            'Leave Encash': r.earnings.leaveEncashment,
            'Gross Pay': r.earnings.total,
            'EPF': r.deductions.epf,
            'VPF': r.deductions.vpf,
            'ESI': r.deductions.esi,
            'PT': r.deductions.pt,
            'TDS': r.deductions.it,
            'LWF': r.deductions.lwf,
            'Adv Recovery': r.deductions.advanceRecovery,
            'Total Ded': r.deductions.total,
            'NET PAY': r.netPay
          };
        });

        if (format === 'Excel') {
          generateExcelReport(flatData, 'Pay Sheet', `PaySheet_${month}_${year}`);
        } else {
          const headers = [
             'ID', 'Name', 'Days', 
             'Basic', 'DA', 'Retn', 'HRA', 'Conv', 'Spec', 'Othr', 'Encash', 'GROSS',
             'PF', 'VPF', 'ESI', 'PT', 'TDS', 'LWF', 'Adv', 'DED', 
             'NET PAY'
          ];
          const pdfData = flatData.map(d => [
            d['Emp ID'], d['Name'], d['Days Paid'], 
            d['Basic'], d['DA'], d['Retaining'], d['HRA'], d['Conveyance'], d['Special Allw'], d['Other Allw'], d['Leave Encash'], d['Gross Pay'],
            d['EPF'], d['VPF'], d['ESI'], d['PT'], d['TDS'], d['LWF'], d['Adv Recovery'], d['Total Ded'], 
            d['NET PAY']
          ]);
          generatePDFTableReport(`Pay Sheet - ${month} ${year}`, headers, pdfData as any[][], `PaySheet_${month}_${year}`, 'l', undefined, companyProfile);
        }
      } 
      else if (reportType === 'Pay Slips') {
        if (format === 'PDF') {
            generatePaySlipsPDF(results, employees, month, year, companyProfile);
        }
      }
      else if (reportType === 'Bank Statement') {
        const bankData = results.map(r => {
            const emp = employees.find(e => e.id === r.employeeId);
            return {
                'Employee Name': emp?.name,
                'Bank Account Number': emp?.bankAccount,
                'IFSC Code': emp?.ifsc,
                'Net Salary': r.netPay,
                'Payment Date': new Date().toISOString().split('T')[0]
            };
        });

        if (format === 'Excel') {
            generateExcelReport(bankData, 'Bank Advice', `BankTransfer_${month}_${year}`);
        } else {
            const headers = ['Name', 'Account No', 'IFSC', 'Net Pay'];
            const pdfData = bankData.map(d => [d['Employee Name'], d['Bank Account Number'], d['IFSC Code'], d['Net Salary']]);
            generatePDFTableReport(`Bank Transfer Statement - ${month} ${year}`, headers, pdfData as any[][], `BankTransfer_${month}_${year}`, 'p', undefined, companyProfile);
        }
      }
      else if (reportType.includes('Summary')) {
          const groupKey = reportType.split(' ')[0] === 'Division' ? 'division' : reportType.split(' ')[0] === 'Branch' ? 'branch' : 'site';
          const grouped: Record<string, number> = {};
          results.forEach(r => {
              const emp = employees.find(e => e.id === r.employeeId);
              const key = (emp as any)[groupKey] || 'Unknown';
              grouped[key] = (grouped[key] || 0) + r.earnings.total;
          });
          const summaryData = Object.entries(grouped).map(([key, val]) => ({ [groupKey]: key, 'Total Cost': val }));
          if (format === 'Excel') {
             generateExcelReport(summaryData, 'Cost Summary', `${groupKey}_Summary`);
          } else {
             const headers = [groupKey.toUpperCase(), 'Total Cost (INR)'];
             const pdfData = summaryData.map(d => [d[groupKey], d['Total Cost'].toLocaleString()]);
             generatePDFTableReport(`${groupKey} Wise Cost Summary - ${month}`, headers, pdfData as any[][], `${groupKey}_Summary`, 'p', undefined, companyProfile);
          }
      }
    } catch (e: any) {
      console.error(e);
      setModalState({
          isOpen: true,
          type: 'error',
          title: 'Report Generation Failed',
          message: e.message || 'An unexpected error occurred.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 text-white relative">
      
      {/* Header & Status Dashboard */}
      <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 className="text-2xl font-black text-white">Pay Reports & Confirmation</h2>
                <p className="text-xs text-slate-400 mt-1">Generate payroll outputs and manage freeze status.</p>
            </div>
            <div className="flex items-center gap-3">
                <select 
                    value={month} 
                    onChange={e => setMonth(e.target.value)} 
                    className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500"
                >
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (<option key={m} value={m}>{m}</option>))}
                </select>
                <select value={year} onChange={e => setYear(+e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white">
                    {yearOptions.map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>
        </div>

        {/* Status Bar */}
        <div className="p-4 bg-[#0f172a] rounded-xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${
                    currentMonthStatus === 'Finalized' ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-900' :
                    currentMonthStatus === 'Draft' ? 'bg-blue-900/20 text-blue-400 border border-blue-900' :
                    'bg-slate-800 text-slate-500'
                }`}>
                    {currentMonthStatus === 'Finalized' ? <CheckCircle size={24} /> : 
                     currentMonthStatus === 'Draft' ? <FileCheck size={24} /> : <RefreshCw size={24} />}
                </div>
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Payroll Status</h3>
                    <p className={`text-lg font-black ${
                         currentMonthStatus === 'Finalized' ? 'text-emerald-400' :
                         currentMonthStatus === 'Draft' ? 'text-blue-400' : 'text-slate-500'
                    }`}>
                        {currentMonthStatus === 'Unsaved' ? 'NOT SAVED' : currentMonthStatus.toUpperCase()}
                    </p>
                </div>
             </div>

             <div className="flex gap-3">
                {/* Scenario 1: Unsaved Data (Show Save & Freeze) */}
                {currentMonthStatus === 'Unsaved' && (
                    <button 
                        disabled
                        className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-slate-500 font-bold rounded-lg border border-slate-700 cursor-not-allowed"
                    >
                        <Save size={18} />
                        Run Payroll First
                    </button>
                )}

                {/* Scenario 2: Draft Saved (Show Confirm & Freeze) */}
                {currentMonthStatus === 'Draft' && (
                    <button 
                        onClick={initiateFreeze}
                        disabled={isFreezing}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg transition-colors disabled:opacity-50"
                    >
                        {isFreezing ? <RefreshCw className="animate-spin" size={18} /> : <Lock size={18} />} 
                        {isFreezing ? 'Freezing...' : 'Confirm & Freeze Data'}
                    </button>
                )}
                
                {/* Scenario 3: Finalized (Show Unlock) */}
                {currentMonthStatus === 'Finalized' && (
                    <button 
                        onClick={() => { setShowUnlockModal(true); setPasswordInput(''); setPasswordError(''); }}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-lg border border-slate-600 transition-colors"
                    >
                        <Unlock size={18} /> Unlock Data
                    </button>
                )}
             </div>
        </div>
      </div>

      {currentMonthStatus === 'Unsaved' && (
          <div className="bg-amber-900/20 border border-amber-700/50 p-4 rounded-xl flex items-center gap-4 text-amber-200">
              <AlertTriangle size={24} className="text-amber-400 shrink-0" />
              <div>
                  <h4 className="font-bold text-sm">Action Required</h4>
                  <p className="text-xs text-amber-400/80">Payroll has not been calculated or saved for {month} {year}. You must complete the payroll process before generating reports.</p>
              </div>
          </div>
      )}

      <div className={`space-y-8 animate-in fade-in duration-300 ${currentMonthStatus === 'Unsaved' ? 'opacity-50 pointer-events-none' : ''}`}>
        
        {/* Section 1: Core Payroll Documents */}
        <div>
          <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4">Core Payroll Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pay Sheet */}
            <div className="bg-[#1e293b] border border-slate-800 p-6 rounded-2xl shadow-xl hover:border-blue-500/50 transition-all">
              <div className="flex gap-4">
                <div className="p-3 rounded-xl bg-blue-900/30 text-blue-400 h-fit"><FileSpreadsheet size={24} /></div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className="font-bold text-white">Monthly Pay Sheet</h4>
                    <p className="text-xs text-slate-400">Consolidated register of earnings & deductions for all employees.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDownload('Pay Sheet', 'PDF')} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50">
                      <Printer size={14} /> PDF Print
                    </button>
                    <button onClick={() => handleDownload('Pay Sheet', 'Excel')} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/20 hover:bg-green-900/40 text-green-400 rounded text-xs font-medium border border-green-900/50 transition-colors disabled:opacity-50">
                      <FileSpreadsheet size={14} /> Excel Export
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Pay Slip */}
            <div className="bg-[#1e293b] border border-slate-800 p-6 rounded-2xl shadow-xl hover:border-blue-500/50 transition-all">
              <div className="flex gap-4">
                <div className="p-3 rounded-xl bg-purple-900/30 text-purple-400 h-fit"><UserCircle size={24} /></div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className="font-bold text-white">Individual Pay Slips</h4>
                    <p className="text-xs text-slate-400">Generate and print salary slips for distribution.</p>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => handleDownload('Pay Slips', 'PDF')} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50">
                      <Printer size={14} /> Print All (PDF)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Banking Transactions & Leave Ledger (Renamed for clarity) */}
        <div>
          <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4">Banking Transactions & Leave Ledger</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Payment of Wages */}
             <div className="bg-[#1e293b] border border-slate-800 p-6 rounded-2xl shadow-xl hover:border-blue-500/50 transition-all">
              <div className="flex gap-4">
                <div className="p-3 rounded-xl bg-emerald-900/30 text-emerald-400 h-fit"><CreditCard size={24} /></div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className="font-bold text-white">Payment of Wages</h4>
                    <p className="text-xs text-slate-400">Bank transfer statements and direct debit files.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDownload('Bank Statement', 'PDF')} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50">
                      <FileText size={14} /> Statement PDF
                    </button>
                    <button onClick={() => handleDownload('Bank Statement', 'Excel')} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/20 hover:bg-green-900/40 text-green-400 rounded text-xs font-medium border border-green-900/50 transition-colors disabled:opacity-50">
                      <FileSpreadsheet size={14} /> Excel Export
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Leave Ledger - New Card Placement */}
            <div className="bg-[#1e293b] border border-slate-800 p-6 rounded-2xl shadow-xl hover:border-blue-500/50 transition-all">
              <div className="flex gap-4">
                <div className="p-3 rounded-xl bg-amber-900/30 text-amber-400 h-fit"><ClipboardList size={24} /></div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className="font-bold text-white">Leave Ledger</h4>
                    <p className="text-xs text-slate-400">View comprehensive leave balances and history.</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                        onClick={() => setShowLedgerModal(true)} 
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium border border-slate-700 transition-colors"
                    >
                      <Eye size={14} /> View Ledger History
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Analytical Summaries */}
        <div>
          <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4">Cost Center Summaries</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Division Wise */}
            <div className="bg-[#1e293b] p-5 rounded-xl border border-slate-800 hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => handleDownload('Division Summary', 'PDF')}>
              <div className="flex items-center gap-3 mb-3">
                <Network className="text-amber-400" size={20} />
                <h4 className="font-bold text-sm text-slate-200">Division-wise</h4>
              </div>
              <p className="text-[10px] text-slate-500">Salary cost breakdown grouped by Division/Department.</p>
              <div className="mt-4 flex justify-end opacity-50 group-hover:opacity-100 transition-opacity">
                  <Download size={16} className="text-amber-400" />
              </div>
            </div>

            {/* Branch Wise */}
            <div className="bg-[#1e293b] p-5 rounded-xl border border-slate-800 hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => handleDownload('Branch Summary', 'PDF')}>
              <div className="flex items-center gap-3 mb-3">
                <Building2 className="text-emerald-400" size={20} />
                <h4 className="font-bold text-sm text-slate-200">Branch-wise</h4>
              </div>
              <p className="text-[10px] text-slate-500">Location based cost analysis summary.</p>
              <div className="mt-4 flex justify-end opacity-50 group-hover:opacity-100 transition-opacity">
                  <Download size={16} className="text-emerald-400" />
              </div>
            </div>

            {/* Site Wise */}
            <div className="bg-[#1e293b] p-5 rounded-xl border border-slate-800 hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => handleDownload('Site Summary', 'PDF')}>
              <div className="flex items-center gap-3 mb-3">
                <MapPin className="text-pink-400" size={20} />
                <h4 className="font-bold text-sm text-slate-200">Site-wise</h4>
              </div>
              <p className="text-[10px] text-slate-500">Project site specific payroll expense reports.</p>
              <div className="mt-4 flex justify-end opacity-50 group-hover:opacity-100 transition-opacity">
                  <Download size={16} className="text-pink-400" />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* LEAVE LEDGER MODAL */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 shadow-2xl flex flex-col relative">
                <div className="p-6 bg-[#0f172a] border-b border-slate-700 flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-black text-white">Leave Ledger History</h2>
                        <p className="text-xs text-slate-400">View comprehensive leave balances, accruals, and monthly history.</p>
                    </div>
                    <button onClick={() => setShowLedgerModal(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-lg transition-colors">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-6">
                     <LedgerManager 
                        employees={employees}
                        leaveLedgers={leaveLedgers}
                        setLeaveLedgers={setLeaveLedgers}
                        advanceLedgers={advanceLedgers}
                        setAdvanceLedgers={setAdvanceLedgers}
                        leavePolicy={DEFAULT_LEAVE_POLICY}
                        month={month}
                        year={year}
                        setMonth={setMonth}
                        setYear={setYear}
                        savedRecords={savedRecords}
                        hideContextSelector={true}
                        viewMode="leave"
                        isReadOnly={true}
                    />
                </div>
            </div>
        </div>
      )}

      {/* UNLOCK MODAL */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setShowUnlockModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                    <X size={20} />
                </button>
                <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-red-900/30 text-red-500 rounded-full border border-red-900/50">
                        <KeyRound size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white">Supervisor Access</h3>
                    <p className="text-xs text-slate-400 text-center">Unlocking finalized payroll requires authorization.</p>
                </div>
                
                <div className="space-y-3 mt-2">
                    <input 
                        type="password" 
                        placeholder="Enter Supervisor Password" 
                        autoFocus
                        className={`w-full bg-[#0f172a] border ${passwordError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-amber-500`}
                        value={passwordInput}
                        onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleUnlockVerify()}
                    />
                    {passwordError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{passwordError}</p>}
                    
                    <button 
                        onClick={handleUnlockVerify}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg shadow-lg transition-colors mt-2"
                    >
                        UNLOCK DATA
                    </button>
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

export default Reports;
