
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
  Eye,
  HandCoins,
  UserX
} from 'lucide-react';
import { Employee, StatutoryConfig, Attendance, LeaveLedger, AdvanceLedger, PayrollResult, LeavePolicy, CompanyProfile, User } from '../types';
import { calculatePayroll } from '../services/payrollEngine';
import { generateExcelReport, generatePDFTableReport, generatePaySlipsPDF, generateSimplePaySheetPDF, generateLeaveLedgerReport, generateAdvanceShortfallReport, formatDateInd } from '../services/reportService';
import LedgerManager from './LedgerManager';
import { DEFAULT_LEAVE_POLICY } from '../constants'; 

interface ReportsProps {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>; // Added setter
  config: StatutoryConfig;
  companyProfile: CompanyProfile; 
  attendances: Attendance[];
  savedRecords: PayrollResult[];
  setSavedRecords: React.Dispatch<React.SetStateAction<PayrollResult[]>>;
  month: string;
  year: number;
  setMonth: (m: string) => void;
  setYear: (y: number) => void;
  leaveLedgers?: LeaveLedger[];
  setLeaveLedgers?: React.Dispatch<React.SetStateAction<LeaveLedger[]>>;
  advanceLedgers?: AdvanceLedger[];
  setAdvanceLedgers?: React.Dispatch<React.SetStateAction<AdvanceLedger[]>>;
  currentUser?: User;
}

const Reports: React.FC<ReportsProps> = ({ 
    employees, 
    setEmployees,
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
    setAdvanceLedgers = (_val) => {},
    currentUser
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFreezing, setIsFreezing] = useState(false);
  
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showUnlockAuth, setShowUnlockAuth] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Shortfall Modal State
  const [shortfallModal, setShortfallModal] = useState<{
      isOpen: boolean;
      data: any[];
  }>({ isOpen: false, data: [] });

  // Zero Wages Modal State - Now holds editable data
  const [zeroWagesModal, setZeroWagesModal] = useState<{
      isOpen: boolean;
      data: { id: string; name: string; dol: string; reason: string }[];
  }>({ isOpen: false, data: [] });

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'success' | 'error';
    title: string;
    message: string | React.ReactNode;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'confirm', title: '', message: '' });

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);

  const currentMonthStatus = useMemo(() => {
    const record = savedRecords.find(r => r.month === month && r.year === year);
    if (!record) return 'Unsaved'; 
    return record.status || 'Draft'; 
  }, [savedRecords, month, year]);

  const getPayrollData = (): PayrollResult[] | null => {
    const existingRecords = savedRecords.filter(r => r.month === month && r.year === year);
    if (existingRecords.length > 0) {
        return existingRecords;
    }
    return null;
  };

  const executeFreeze = () => {
    setModalState(prev => ({ ...prev, isOpen: false })); 
    setShortfallModal({ isOpen: false, data: [] }); 
    setZeroWagesModal({ isOpen: false, data: [] }); 
    setIsFreezing(true);

    setTimeout(() => {
        try {
            const currentData = getPayrollData();
            
            if (!currentData || currentData.length === 0) {
                throw new Error("No payroll data found to freeze. Please 'Run Payroll' and 'Save Draft' first.");
            }

            const finalPayrollData: PayrollResult[] = currentData.map(r => {
                const ledger = leaveLedgers.find(l => l.employeeId === r.employeeId);
                return {
                    ...r,
                    status: 'Finalized' as const,
                    leaveSnapshot: ledger ? JSON.parse(JSON.stringify(ledger)) : undefined
                };
            });

            setSavedRecords(prev => {
                const otherRecords = prev.filter(r => !(r.month === month && r.year === year));
                return [...otherRecords, ...finalPayrollData];
            });

            if (setLeaveLedgers) {
                setLeaveLedgers(prevLedgers => prevLedgers.map(ledger => {
                const att = attendances.find(a => a.employeeId === ledger.employeeId && a.month === month && a.year === year) || { earnedLeave: 0, sickLeave: 0, casualLeave: 0, encashedDays: 0 };
                
                const elUsed = (att.earnedLeave || 0) + (att.encashedDays || 0);
                const elCapacity = (ledger.el.opening || 0) + (ledger.el.eligible || 0);
                const elClosing = elCapacity - elUsed; 
                
                const elNewAccrual = 1.5;
                const clClosing = (ledger.cl.accumulation || 0) - (att.casualLeave || 0);
                const clNewAccrual = 1.0;
                const slClosing = (ledger.sl.eligible || 0) - (att.sickLeave || 0);
                const slNewAccrual = 1.0; 

                return {
                    ...ledger,
                    el: { opening: elClosing, eligible: elNewAccrual, encashed: 0, availed: 0, balance: elClosing + elNewAccrual },
                    sl: { eligible: slClosing + slNewAccrual, availed: 0, balance: slClosing + slNewAccrual },
                    cl: { accumulation: clClosing + clNewAccrual, availed: 0, balance: clClosing + clNewAccrual }
                };
                }));
            }

            if (setAdvanceLedgers) {
                setAdvanceLedgers(prevAdvances => prevAdvances.map(ledger => {
                    const payroll = finalPayrollData.find(p => p.employeeId === ledger.employeeId);
                    const recovery = payroll?.deductions?.advanceRecovery || 0;
                    const closingBalance = (ledger.balance || 0) - recovery;
                    return { ...ledger, opening: closingBalance, totalAdvance: 0, monthlyInstallment: ledger.monthlyInstallment, paidAmount: 0, balance: closingBalance };
                }));
            }

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
            setModalState({ isOpen: true, type: 'error', title: 'Freeze Failed', message: error.message });
        } finally {
            setIsFreezing(false);
        }
    }, 500);
  };

  const confirmFreeze = () => {
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

  // Step 2: Check Shortfalls
  const verifyShortfall = () => {
      const currentData = getPayrollData();
      if (!currentData) return;

      const detectedShortfalls: any[] = [];

      currentData.forEach(record => {
          const emp = employees.find(e => e.id === record.employeeId);
          const adv = advanceLedgers.find(a => a.employeeId === record.employeeId);
          
          if (adv && adv.balance > 0 && adv.monthlyInstallment > 0) {
              const target = Math.min(adv.monthlyInstallment, adv.balance);
              const recovered = record.deductions.advanceRecovery || 0;
              
              if (recovered < target) {
                  detectedShortfalls.push({
                      id: emp?.id,
                      name: emp?.name,
                      days: record.payableDays,
                      gross: record.earnings.total,
                      target: target,
                      recovered: recovered,
                      shortfall: target - recovered
                  });
              }
          }
      });

      if (detectedShortfalls.length > 0) {
          setShortfallModal({ isOpen: true, data: detectedShortfalls });
      } else {
          confirmFreeze();
      }
  };

  // Step 1: Check Zero Wages (Initiator)
  const initiateFreeze = () => {
      const currentData = getPayrollData();
      if (!currentData) {
          setModalState({ isOpen: true, type: 'error', title: 'No Data', message: 'No payroll data found to freeze.' });
          return;
      }

      const zeroWages = currentData.filter(r => r.payableDays === 0).map(r => {
          const emp = employees.find(e => e.id === r.employeeId);
          return {
              id: r.employeeId,
              name: emp?.name || '',
              dol: emp?.dol || '',
              reason: emp?.leavingReason || ''
          };
      });

      if (zeroWages.length > 0) {
          setZeroWagesModal({ isOpen: true, data: zeroWages });
      } else {
          verifyShortfall();
      }
  };

  const handleZeroWageChange = (id: string, field: 'dol' | 'reason', value: string) => {
      setZeroWagesModal(prev => ({
          ...prev,
          data: prev.data.map(item => item.id === id ? { ...item, [field]: value } : item)
      }));
  };

  const handleSaveExitAndFreeze = () => {
      // 1. Update Employee Master
      const updates = new Map(zeroWagesModal.data.map(item => [item.id, item]));
      
      const updatedEmployees = employees.map(emp => {
          const update = updates.get(emp.id);
          // Only update if DOL is provided in the modal
          if (update && update.dol) {
              return { ...emp, dol: update.dol, leavingReason: update.reason };
          }
          return emp;
      });

      setEmployees(updatedEmployees);
      
      // 2. Close Modal and Proceed
      setZeroWagesModal({ isOpen: false, data: [] });
      verifyShortfall();
  };

  const userRole = currentUser?.role;
  const canUnlock = userRole === 'Developer' || userRole === 'Administrator';

  const initiateUnlock = () => {
      const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const currentMonthIdx = monthsArr.indexOf(month);
      const currentVal = year * 12 + currentMonthIdx;

      const futureRecord = savedRecords.find(r => {
          const rMonthIdx = monthsArr.indexOf(r.month);
          const rVal = r.year * 12 + rMonthIdx;
          return rVal > currentVal;
      });

      if (futureRecord) {
          setModalState({
              isOpen: true,
              type: 'error',
              title: 'Sequential Lock Active',
              message: `Cannot unlock payroll for ${month} ${year}.\n\nData for a subsequent month (${futureRecord.month} ${futureRecord.year}) is already processed/pending.\n\nYou must remove the later data first to maintain ledger integrity.`
          });
          return;
      }

      setAuthPassword('');
      setAuthError('');
      setShowUnlockAuth(true);
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
          
          setModalState({
              isOpen: true,
              type: 'success',
              title: 'Data Unlocked',
              message: "Payroll Unlocked. You can now edit attendance and re-calculate in 'Run Payroll'."
          });
      } else {
          setAuthError('Incorrect Password');
      }
  };

  const handleDownload = async (reportType: string, format: 'PDF' | 'Excel') => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    const results = getPayrollData(); 

    if (reportType.includes('Leave Ledger')) {
        let ledgersToUse = leaveLedgers;
        if (results && results.length > 0) {
             if (results[0].leaveSnapshot) {
                 ledgersToUse = employees.map(emp => {
                     const res = results.find(r => r.employeeId === emp.id);
                     return res?.leaveSnapshot || leaveLedgers.find(l => l.employeeId === emp.id)!;
                 });
             }
        }
        generateLeaveLedgerReport(employees, ledgersToUse, attendances, month, year, reportType.includes('BC') ? 'BC' : 'AC', companyProfile);
        setIsGenerating(false);
        return;
    }

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
        let hasCode88 = false;
        let hasESICode = false;

        const flatData = results.map(r => {
          const emp = employees.find(e => e.id === r.employeeId);
          const special = (r?.earnings?.special1 || 0) + (r?.earnings?.special2 || 0) + (r?.earnings?.special3 || 0);
          const other = (r?.earnings?.washing || 0) + (r?.earnings?.attire || 0);
          
          if (r.isCode88) hasCode88 = true;
          if (r.isESICodeWagesUsed) hasESICode = true;

          return {
            'Emp ID': r.employeeId,
            'Name': emp?.name,
            'Designation': emp?.designation,
            'Days Paid': r.payableDays,
            'Basic': r?.earnings?.basic || 0,
            'DA': r?.earnings?.da || 0,
            'Retaining': r?.earnings?.retainingAllowance || 0,
            'HRA': r?.earnings?.hra || 0,
            'Conveyance': r?.earnings?.conveyance || 0,
            'Special Allw': special,
            'Other Allw': other,
            'Leave Encash': r?.earnings?.leaveEncashment || 0,
            'Gross Pay': r?.earnings?.total || 0,
            'EPF': r?.deductions?.epf || 0,
            'VPF': r?.deductions?.vpf || 0,
            'ESI': r?.deductions?.esi || 0,
            'PT': r?.deductions?.pt || 0,
            'TDS': r?.deductions?.it || 0,
            'LWF': r?.deductions?.lwf || 0,
            'Adv Recovery': r?.deductions?.advanceRecovery || 0,
            'Total Ded': r?.deductions?.total || 0,
            'NET PAY': r.netPay,
            _isCode88: r.isCode88,
            _isESICode: r.isESICodeWagesUsed
          };
        });

        if (format === 'Excel') {
          const excelData = flatData.map(({ _isCode88, _isESICode, ...rest }) => rest);
          generateExcelReport(excelData, 'Pay Sheet', `PaySheet_${month}_${year}`);
        } else {
          const headers = ['ID', 'Name', 'Days', 'Basic', 'DA', 'Retn', 'HRA', 'Conv', 'Spec', 'Othr', 'Encash', 'GROSS', 'PF', 'VPF', 'ESI', 'PT', 'TDS', 'LWF', 'Adv', 'DED', 'NET PAY'];
          const pdfData = flatData.map(d => [
            d['Emp ID'], d['Name'], d['Days Paid'], 
            d['Basic'], d['DA'], d['Retaining'], d['HRA'], d['Conveyance'], d['Special Allw'], d['Other Allw'], d['Leave Encash'], d['Gross Pay'],
            d._isCode88 ? `${d['EPF']}*` : d['EPF'], 
            d['VPF'], 
            d._isESICode ? `${d['ESI']}**` : d['ESI'], 
            d['PT'], d['TDS'], d['LWF'], d['Adv Recovery'], d['Total Ded'], 
            d['NET PAY']
          ]);
          let footnote = '';
          if (hasCode88) footnote += '* PF calculated on Code Wages. ';
          if (hasESICode) footnote += '** ESI calculated on Code Wages.';
          generatePDFTableReport(`Pay Sheet - ${month} ${year}`, headers, pdfData as any[][], `PaySheet_${month}_${year}`, 'l', footnote || undefined, companyProfile);
        }
      } 
      else if (reportType === 'Pay Slips') {
        if (format === 'PDF') generatePaySlipsPDF(results, employees, month, year, companyProfile);
      }
      else if (reportType === 'Bank Statement') {
        const bankData = results.map(r => {
            const emp = employees.find(e => e.id === r.employeeId);
            return { 'Employee Name': emp?.name, 'Bank Account Number': emp?.bankAccount, 'IFSC Code': emp?.ifsc, 'Net Salary': r.netPay, 'Payment Date': new Date().toISOString().split('T')[0] };
        });
        if (format === 'Excel') generateExcelReport(bankData, 'Bank Advice', `BankTransfer_${month}_${year}`);
        else {
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
              grouped[key] = (grouped[key] || 0) + (r?.earnings?.total || 0);
          });
          const summaryData = Object.entries(grouped).map(([key, val]) => ({ [groupKey]: key, 'Total Cost': val }));
          if (format === 'Excel') generateExcelReport(summaryData, 'Cost Summary', `${groupKey}_Summary`);
          else {
             const headers = [groupKey.toUpperCase(), 'Total Cost (INR)'];
             const pdfData = summaryData.map(d => [d[groupKey], d['Total Cost'].toLocaleString()]);
             generatePDFTableReport(`${groupKey} Wise Cost Summary - ${month}`, headers, pdfData as any[][], `${groupKey}_Summary`, 'p', undefined, companyProfile);
          }
      }
    } catch (e: any) {
      setModalState({ isOpen: true, type: 'error', title: 'Report Generation Failed', message: e.message || 'An unexpected error occurred.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const isFinalized = currentMonthStatus === 'Finalized';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 text-white relative">
      <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div><h2 className="text-2xl font-black text-white">Pay Reports & Confirmation</h2><p className="text-xs text-slate-400 mt-1">Generate payroll outputs and manage freeze status.</p></div>
            <div className="flex items-center gap-3">
                <select value={month} onChange={e => setMonth(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500">{['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (<option key={m} value={m}>{m}</option>))}</select>
                <select value={year} onChange={e => setYear(+e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white">{yearOptions.map(y => (<option key={y} value={y}>{y}</option>))}</select>
            </div>
        </div>
        <div className="p-4 bg-[#0f172a] rounded-xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${currentMonthStatus === 'Finalized' ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-900' : currentMonthStatus === 'Draft' ? 'bg-blue-900/20 text-blue-400 border border-blue-900' : 'bg-slate-800 text-slate-500'}`}>{currentMonthStatus === 'Finalized' ? <CheckCircle size={24} /> : currentMonthStatus === 'Draft' ? <FileCheck size={24} /> : <RefreshCw size={24} />}</div>
                <div><h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Payroll Status</h3><p className={`text-lg font-black ${currentMonthStatus === 'Finalized' ? 'text-emerald-400' : currentMonthStatus === 'Draft' ? 'text-blue-400' : 'text-slate-500'}`}>{currentMonthStatus === 'Unsaved' ? 'NOT SAVED' : currentMonthStatus.toUpperCase()}</p></div>
             </div>
             <div className="flex gap-3">
                {currentMonthStatus === 'Unsaved' && (<button disabled className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-slate-500 font-bold rounded-lg border border-slate-700 cursor-not-allowed"><Save size={18} /> Run Payroll First</button>)}
                {currentMonthStatus === 'Draft' && (<button onClick={initiateFreeze} disabled={isFreezing} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg transition-colors disabled:opacity-50">{isFreezing ? <RefreshCw className="animate-spin" size={18} /> : <Lock size={18} />} {isFreezing ? 'Freezing...' : 'Confirm & Freeze Data'}</button>)}
                {currentMonthStatus === 'Finalized' && canUnlock && (<button onClick={initiateUnlock} className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-lg border border-slate-600 transition-colors"><Unlock size={18} /> Unlock Data</button>)}
             </div>
        </div>
      </div>
      {currentMonthStatus === 'Unsaved' && (<div className="bg-amber-900/20 border border-amber-700/50 p-4 rounded-xl flex items-center gap-4 text-amber-200"><AlertTriangle size={24} className="text-amber-400 shrink-0" /><div><h4 className="font-bold text-sm">Action Required</h4><p className="text-xs text-amber-400/80">Payroll has not been calculated or saved for {month} {year}. You must complete the payroll process before generating reports.</p></div></div>)}
      <div className={`space-y-8 animate-in fade-in duration-300 ${currentMonthStatus === 'Unsaved' ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className={!isFinalized ? 'opacity-50 pointer-events-none grayscale' : ''}>
          <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4">Core Payroll Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#1e293b] border border-slate-800 p-6 rounded-2xl shadow-xl hover:border-blue-500/50 transition-all">
              <div className="flex gap-4">
                <div className="p-3 rounded-xl bg-blue-900/30 text-blue-400 h-fit"><FileSpreadsheet size={24} /></div>
                <div className="flex-1 space-y-3">
                  <div><h4 className="font-bold text-white">Monthly Pay Sheet</h4><p className="text-xs text-slate-400">Consolidated register of earnings & deductions for all employees.</p></div>
                  <div className="flex gap-2"><button onClick={() => handleDownload('Pay Sheet', 'PDF')} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"><Printer size={14} /> PDF Print</button><button onClick={() => handleDownload('Pay Sheet', 'Excel')} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/20 hover:bg-green-900/40 text-green-400 rounded text-xs font-medium border border-green-900/50 transition-colors disabled:opacity-50"><FileSpreadsheet size={14} /> Excel Export</button></div>
                </div>
              </div>
            </div>
            <div className="bg-[#1e293b] border border-slate-800 p-6 rounded-2xl shadow-xl hover:border-blue-500/50 transition-all">
              <div className="flex gap-4">
                <div className="p-3 rounded-xl bg-purple-900/30 text-purple-400 h-fit"><UserCircle size={24} /></div>
                <div className="flex-1 space-y-3">
                  <div><h4 className="font-bold text-white">Individual Pay Slips</h4><p className="text-xs text-slate-400">Generate and print salary slips for distribution.</p></div>
                  <div className="flex gap-2"><button onClick={() => handleDownload('Pay Slips', 'PDF')} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"><Printer size={14} /> Print All (PDF)</button></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4">Banking Transactions & Leave Ledger</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className={`bg-[#1e293b] border border-slate-800 p-6 rounded-2xl shadow-xl hover:border-blue-500/50 transition-all ${!isFinalized ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
              <div className="flex gap-4">
                <div className="p-3 rounded-xl bg-emerald-900/30 text-emerald-400 h-fit"><CreditCard size={24} /></div>
                <div className="flex-1 space-y-3">
                  <div><h4 className="font-bold text-white">Payment of Wages</h4><p className="text-xs text-slate-400">Bank transfer statements and direct debit files.</p></div>
                  <div className="flex gap-2"><button onClick={() => handleDownload('Bank Statement', 'PDF')} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"><FileText size={14} /> Statement PDF</button><button onClick={() => handleDownload('Bank Statement', 'Excel')} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/20 hover:bg-green-900/40 text-green-400 rounded text-xs font-medium border border-green-900/50 transition-colors disabled:opacity-50"><FileSpreadsheet size={14} /> Excel Export</button></div>
                </div>
              </div>
            </div>
            <div className="bg-[#1e293b] border border-slate-800 p-6 rounded-2xl shadow-xl hover:border-blue-500/50 transition-all">
              <div className="flex gap-4">
                <div className="p-3 rounded-xl bg-amber-900/30 text-amber-400 h-fit"><ClipboardList size={24} /></div>
                <div className="flex-1 space-y-3">
                  <div><h4 className="font-bold text-white">Leave Ledger Reports</h4><p className="text-xs text-slate-400">Generate Before & After Confirmation ledgers.</p></div>
                  <div className="flex gap-2 flex-wrap"><button onClick={() => handleDownload('Leave Ledger BC', 'PDF')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium border border-slate-700 transition-colors" title="Before Confirmation (Opening + Credit)"><FileText size={14} /> Report (BC)</button><button onClick={() => handleDownload('Leave Ledger AC', 'PDF')} disabled={!isFinalized} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-slate-700 transition-colors ${!isFinalized ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-50' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`} title={!isFinalized ? "Locked until Payroll is Finalized" : "After Confirmation (Closing Balance)"}><FileText size={14} /> Report (AC)</button><button onClick={() => setShowLedgerModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/20 hover:bg-amber-900/40 text-amber-400 rounded text-xs font-medium border border-amber-900/50 transition-colors"><Eye size={14} /> View History</button></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={!isFinalized ? 'opacity-50 pointer-events-none grayscale' : ''}>
          <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4">Cost Center Summaries</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#1e293b] p-5 rounded-xl border border-slate-800 hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => handleDownload('Division Summary', 'PDF')}><div className="flex items-center gap-3 mb-3"><Network className="text-amber-400" size={20} /><h4 className="font-bold text-sm text-slate-200">Division-wise</h4></div><p className="text-[10px] text-slate-500">Salary cost breakdown grouped by Division/Department.</p><div className="mt-4 flex justify-end opacity-50 group-hover:opacity-100 transition-opacity"><Download size={16} className="text-amber-400" /></div></div>
            <div className="bg-[#1e293b] p-5 rounded-xl border border-slate-800 hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => handleDownload('Branch Summary', 'PDF')}><div className="flex items-center gap-3 mb-3"><Building2 className="text-emerald-400" size={20} /><h4 className="font-bold text-sm text-slate-200">Branch-wise</h4></div><p className="text-[10px] text-slate-500">Location based cost analysis summary.</p><div className="mt-4 flex justify-end opacity-50 group-hover:opacity-100 transition-opacity"><Download size={16} className="text-emerald-400" /></div></div>
            <div className="bg-[#1e293b] p-5 rounded-xl border border-slate-800 hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => handleDownload('Site Summary', 'PDF')}><div className="flex items-center gap-3 mb-3"><MapPin className="text-pink-400" size={20} /><h4 className="font-bold text-sm text-slate-200">Site-wise</h4></div><p className="text-[10px] text-slate-500">Project site specific payroll expense reports.</p><div className="mt-4 flex justify-end opacity-50 group-hover:opacity-100 transition-opacity"><Download size={16} className="text-pink-400" /></div></div>
          </div>
        </div>
      </div>
      
      {/* ZERO WAGES ALERT MODAL (EDITABLE) */}
      {zeroWagesModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl p-0 flex flex-col relative overflow-hidden">
                <div className="bg-amber-600 p-6 flex justify-between items-start">
                    <div className="flex gap-4">
                        <div className="p-3 bg-white/20 rounded-full text-white shadow-lg"><UserX size={24} /></div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-wide">Proceed to Mark Exit</h3>
                            <p className="text-xs text-amber-100 mt-1 font-medium">Following employees have NIL wages. Enter separation details to proceed.</p>
                        </div>
                    </div>
                    <button onClick={() => setZeroWagesModal({ isOpen: false, data: [] })} className="text-white/70 hover:text-white"><X size={20} /></button>
                </div>
                
                <div className="p-6 bg-[#0f172a] max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs">
                        <thead className="text-slate-500 uppercase font-bold border-b border-slate-700">
                            <tr>
                                <th className="pb-3 pl-2 w-24">EMP ID</th>
                                <th className="pb-3 w-40">Name</th>
                                <th className="pb-3 w-32">Date of Leaving</th>
                                <th className="pb-3">Reason</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-300 divide-y divide-slate-800">
                            {zeroWagesModal.data.map((r: any) => (
                                <tr key={r.id} className="hover:bg-slate-800/50">
                                    <td className="py-3 pl-2 font-mono text-slate-500">{r.id}</td>
                                    <td className="py-3 font-bold text-white">{r.name}</td>
                                    <td className="py-3">
                                        <input 
                                            type="date" 
                                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500 w-full"
                                            value={r.dol} 
                                            onChange={(e) => handleZeroWageChange(r.id, 'dol', e.target.value)} 
                                        />
                                    </td>
                                    <td className="py-3">
                                        <input 
                                            type="text" 
                                            placeholder="Enter Reason..."
                                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500 w-full"
                                            value={r.reason} 
                                            onChange={(e) => handleZeroWageChange(r.id, 'reason', e.target.value)} 
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-[#1e293b] border-t border-slate-800 flex flex-col gap-4">
                    <div className="flex gap-3 pt-2 border-t border-slate-700/50">
                        <button onClick={() => setZeroWagesModal({ isOpen: false, data: [] })} className="flex-1 py-3 border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors">
                            Cancel (Abort)
                        </button>
                        <button onClick={handleSaveExitAndFreeze} className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2">
                            <Save size={14} /> Save & Proceed to Freeze
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* SHORTFALL ALERT MODAL */}
      {shortfallModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl p-0 flex flex-col relative overflow-hidden">
                <div className="bg-red-600 p-6 flex justify-between items-start">
                    <div className="flex gap-4">
                        <div className="p-3 bg-white/20 rounded-full text-white shadow-lg"><AlertTriangle size={24} /></div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-wide">Advance Recovery Alert</h3>
                            <p className="text-xs text-red-100 mt-1 font-medium">The following employees have unrecovered advances due to <b>insufficient wages</b> or <b>zero days</b>.</p>
                        </div>
                    </div>
                    <button onClick={() => setShortfallModal({ isOpen: false, data: [] })} className="text-white/70 hover:text-white"><X size={20} /></button>
                </div>
                
                <div className="p-6 bg-[#0f172a] max-h-60 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs">
                        <thead className="text-slate-500 uppercase font-bold border-b border-slate-700">
                            <tr>
                                <th className="pb-2">Employee</th>
                                <th className="pb-2 text-right">Target</th>
                                <th className="pb-2 text-right text-emerald-400">Recovered</th>
                                <th className="pb-2 text-right text-red-400">Shortfall</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-300 divide-y divide-slate-800">
                            {shortfallModal.data.map((r: any) => (
                                <tr key={r.id}>
                                    <td className="py-2">
                                        <span className="font-bold text-white">{r.name}</span><br/>
                                        <span className="text-slate-500 text-[10px]">{r.id}</span>
                                        {r.days === 0 && <span className="ml-2 text-[8px] bg-red-900/50 text-red-200 px-1 rounded uppercase">Zero Days</span>}
                                    </td>
                                    <td className="py-2 text-right font-mono">{r.target.toLocaleString()}</td>
                                    <td className="py-2 text-right font-mono text-emerald-400">{r.recovered.toLocaleString()}</td>
                                    <td className="py-2 text-right font-mono text-red-400 font-bold">{r.shortfall.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-[#1e293b] border-t border-slate-800 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                            <button onClick={() => generateAdvanceShortfallReport(shortfallModal.data, month, year, 'PDF', companyProfile)} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-xs border border-slate-600 flex items-center gap-2"><FileText size={14} /> PDF</button>
                            <button onClick={() => generateAdvanceShortfallReport(shortfallModal.data, month, year, 'Excel', companyProfile)} className="px-3 py-2 bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-400 rounded-lg font-bold text-xs border border-emerald-900/50 flex items-center gap-2"><FileSpreadsheet size={14} /> Excel</button>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2 border-t border-slate-700/50">
                        <button onClick={() => setShortfallModal({ isOpen: false, data: [] })} className="flex-1 py-3 border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors">
                            Unlock / Cancel
                        </button>
                        <button onClick={executeFreeze} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2">
                            Continue & Freeze <Lock size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showLedgerModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"><div className="bg-[#1e293b] w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 shadow-2xl flex flex-col relative"><div className="p-6 bg-[#0f172a] border-b border-slate-700 flex justify-between items-center sticky top-0 z-10"><div><h2 className="text-xl font-black text-white">Leave Ledger History</h2><p className="text-xs text-slate-400">View comprehensive leave balances, accruals, and monthly history.</p></div><button onClick={() => setShowLedgerModal(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-lg transition-colors"><X size={24} /></button></div><div className="p-6"><LedgerManager employees={employees} leaveLedgers={leaveLedgers} setLeaveLedgers={setLeaveLedgers} advanceLedgers={advanceLedgers} setAdvanceLedgers={setAdvanceLedgers} leavePolicy={DEFAULT_LEAVE_POLICY} month={month} year={year} setMonth={setMonth} setYear={setYear} savedRecords={savedRecords} hideContextSelector={true} viewMode="leave" isReadOnly={true} /></div></div></div>
      )}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"><div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative"><button onClick={() => setModalState({ ...modalState, isOpen: false })} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button><div className="flex flex-col items-center gap-2"><div className={`p-3 rounded-full border ${modalState.type === 'error' ? 'bg-red-900/30 text-red-500 border-red-900/50' : modalState.type === 'success' ? 'bg-emerald-900/30 text-emerald-500 border-emerald-900/50' : 'bg-blue-900/30 text-blue-500 border-blue-900/50'}`}>{modalState.type === 'error' ? <AlertTriangle size={24} /> : modalState.type === 'success' ? <CheckCircle size={24} /> : <HelpCircle size={24} />}</div><h3 className="text-lg font-bold text-white text-center">{modalState.title}</h3><div className="text-sm text-slate-400 text-center whitespace-pre-line">{modalState.message}</div></div><div className="flex gap-3 mt-4">{modalState.type === 'confirm' ? (<><button onClick={() => setModalState({ ...modalState, isOpen: false })} className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 font-bold hover:bg-slate-800 transition-colors">Cancel</button><button onClick={modalState.onConfirm} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg">Confirm</button></>) : (<button onClick={() => setModalState({ ...modalState, isOpen: false })} className="w-full py-2.5 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition-colors">Close</button>)}</div></div></div>
      )}
      {showUnlockAuth && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"><div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-blue-900/50 shadow-2xl p-6 flex flex-col gap-4 relative"><button onClick={() => setShowUnlockAuth(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button><div className="flex flex-col items-center gap-2"><div className="p-4 bg-blue-900/20 text-blue-500 rounded-full border border-blue-900/50 mb-2"><KeyRound size={32} /></div><h3 className="text-xl font-black text-white text-center">Unlock Data</h3><p className="text-xs text-blue-300 text-center leading-relaxed">Data for this period is currently Frozen. Enter your password to UNLOCK it for editing.</p></div><div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800"><input type="password" placeholder="Enter your password" autoFocus className={`w-full bg-[#0f172a] border ${authError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all`} value={authPassword} onChange={(e) => { setAuthPassword(e.target.value); setAuthError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleConfirmUnlock()} />{authError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{authError}</p>}</div><button onClick={handleConfirmUnlock} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"><Unlock size={18} /> CONFIRM UNLOCK</button></div></div>
      )}
    </div>
  );
};

export default Reports;
