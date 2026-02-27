
import React, { useState, useMemo, useEffect } from 'react';
import { FileText, Download, Lock, Unlock, AlertTriangle, CheckCircle2, X, FileSpreadsheet, CreditCard, ClipboardList, Wallet, KeyRound, UserX, Save, RefreshCw, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, PayrollResult, StatutoryConfig, CompanyProfile, Attendance, LeaveLedger, AdvanceLedger, User, ArrearBatch } from '../types';
import {
    generateExcelReport,
    generateSimplePaySheetPDF,
    generatePaySlipsPDF,
    generateBankStatementPDF,
    generateLeaveLedgerReport,
    generateAdvanceShortfallReport,
    generateArrearReport,
    formatDateInd
} from '../services/reportService';
import CustomModal, { ModalType } from './Shared/CustomModal';

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
    onRollover: (history?: PayrollResult[]) => void;
    arrearHistory?: ArrearBatch[];
    showAlert: (type: ModalType, title: string, message: string, onConfirm?: () => void) => void;
}

const Reports: React.FC<ReportsProps> = ({
    employees,
    setEmployees,
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
    currentUser,
    onRollover,
    arrearHistory,
    showAlert
}) => {
    const [reportType, setReportType] = useState<string>('Pay Sheet');
    const [format, setFormat] = useState<'PDF' | 'Excel'>('PDF');
    const [isGenerating, setIsGenerating] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // New State for Arrear Report Generation Batch Selection
    const [arrearSelectedPeriod, setArrearSelectedPeriod] = useState<string>('');

    useEffect(() => {
        if (arrearHistory && arrearHistory.length > 0) {
            const currentValid = arrearHistory.find(b => `${b.month}-${b.year}` === arrearSelectedPeriod);
            if (!currentValid) {
                // Default to latest if not set or if current selection is invalid
                const latest = arrearHistory[arrearHistory.length - 1];
                setArrearSelectedPeriod(`${latest.month}-${latest.year}`);
            }
        }
    }, [arrearHistory, arrearSelectedPeriod]);

    // General Modal State
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        type: 'confirm' | 'success' | 'error';
        title: string;
        message: string | React.ReactNode;
        onConfirm?: () => void;
        onClose?: () => void;
    }>({ isOpen: false, type: 'confirm', title: '', message: '' });

    // Zero Wage / Exit Mark Modal State
    const [zeroWageEmployees, setZeroWageEmployees] = useState<PayrollResult[]>([]);
    const [exitData, setExitData] = useState<Record<string, { dol: string, reason: string }>>({});

    // Auth Modal State for Unlock
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authPassword, setAuthPassword] = useState('');
    const [authError, setAuthError] = useState('');

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

    // Check for unsaved changes in Process Payroll (Temp Storage)
    useEffect(() => {
        const tempKey = `app_temp_payroll_${month}_${year}`;
        const tempData = localStorage.getItem(tempKey);
        if (tempData) {
            try {
                const parsed = JSON.parse(tempData);
                setHasUnsavedChanges(Array.isArray(parsed) && parsed.length > 0);
            } catch (e) {
                setHasUnsavedChanges(false);
            }
        } else {
            setHasUnsavedChanges(false);
        }
    }, [month, year]);

    const getPayrollPeriodStart = () => {
        const mIdx = months.indexOf(month);
        return `${year}-${String(mIdx + 1).padStart(2, '0')}-01`;
    };

    const getPayrollPeriodEnd = () => {
        const mIdx = months.indexOf(month);
        const lastDay = new Date(year, mIdx + 1, 0).getDate();
        return `${year}-${String(mIdx + 1).padStart(2, '0')}-${lastDay}`;
    };

    const handleReportTypeChange = (type: string) => {
        setReportType(type);
        if (type === 'Pay Slips') {
            setFormat('PDF');
        }
    };

    const executeFreeze = () => {
        const updated = savedRecords.map(r => {
            if (r.month === month && r.year === year) return { ...r, status: 'Finalized' as const };
            return r;
        });
        setSavedRecords(updated);

        // SHOW SUCCESS MESSAGE
        setModalState({
            isOpen: true,
            type: 'success',
            title: 'Operation Successful',
            message: 'Data Frozen and Locked Successfully',
            onClose: () => {
                // TRIGGER ROLLOVER ONLY AFTER MODAL IS CLOSED
                onRollover(updated);
            }
        });
    };

    const handleFreeze = () => {
        if (currentUser?.role !== 'Developer' && currentUser?.role !== 'Administrator') {
            setModalState({ isOpen: true, type: 'error', title: 'Access Denied', message: 'Only Administrators can freeze payroll.' });
            return;
        }

        if (hasUnsavedChanges) {
            setModalState({ isOpen: true, type: 'error', title: 'Unsaved Changes', message: 'There are unsaved payroll calculations in "Process Payroll". Please save them as Draft before freezing.' });
            return;
        }

        if (!hasData) {
            setModalState({ isOpen: true, type: 'error', title: 'No Draft Found', message: 'Please calculate and "Save Draft" in the Pay Process module before freezing.' });
            return;
        }

        // CHECK FOR ZERO WAGES (NIL)
        const zw = currentResults.filter(r => r.payableDays === 0 || (r.earnings?.total || 0) === 0);

        if (zw.length > 0) {
            const defaultDOL = getPayrollPeriodStart();
            const initialExitData: Record<string, { dol: string, reason: string }> = {};
            zw.forEach(r => {
                const emp = employees.find(e => e.id === r.employeeId);
                if (emp) {
                    initialExitData[emp.id] = {
                        dol: emp.dol || defaultDOL,
                        reason: emp.leavingReason || 'Resignation'
                    };
                }
            });
            setExitData(initialExitData);
            setZeroWageEmployees(zw);
        } else {
            // COMPUTE ADVANCE SHORTFALLS (planned recovery > actual payroll deduction)
            const advShortfalls = currentResults
                .map(r => {
                    const emp = employees.find(e => e.id === r.employeeId);
                    const adv = advanceLedgers.find(a => a.employeeId === r.employeeId);
                    if (!adv || (adv.recovery || 0) === 0) return null;
                    const planned = adv.recovery;
                    const actual = r.deductions?.advanceRecovery || 0;
                    const shortfall = planned - actual;
                    if (shortfall <= 0) return null;
                    return { id: r.employeeId, name: emp?.name || r.employeeId, planned, actual, shortfall };
                })
                .filter(Boolean) as { id: string; name: string; planned: number; actual: number; shortfall: number }[];

            // DETECT EMPLOYEES LEAVING WITH PENDING ADVANCE
            const periodStart = getPayrollPeriodStart();
            const periodEnd = getPayrollPeriodEnd();
            const leavingWithAdvance = currentResults
                .map(r => {
                    const emp = employees.find(e => e.id === r.employeeId);
                    const adv = advanceLedgers.find(a => a.employeeId === r.employeeId);
                    if (!emp || !emp.dol || !adv || (adv.balance || 0) <= 0) return null;

                    // Check if DOL is in current month
                    const dolDate = emp.dol;
                    if (dolDate >= periodStart && dolDate <= periodEnd) {
                        return { name: emp.name, balance: adv.balance };
                    }
                    return null;
                })
                .filter(Boolean) as { name: string; balance: number }[];

            const confirmMessage = (advShortfalls.length > 0 || leavingWithAdvance.length > 0) ? (
                <div className="text-left space-y-3">
                    <p className="text-slate-300 text-sm">Are you sure you want to finalize payroll for <b>{month} {year}</b>?</p>

                    {leavingWithAdvance.length > 0 && (
                        <div className="bg-red-900/30 border border-red-600/40 rounded-xl p-3">
                            <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                                <AlertTriangle size={14} /> Critical: Pending Advance for Exits
                            </p>
                            <p className="text-red-300/80 text-[11px] mb-2">The following employees are leaving service but still have an outstanding advance balance:</p>
                            <div className="space-y-1">
                                {leavingWithAdvance.map((s, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs bg-red-950/40 px-2 py-1.5 rounded border border-red-900/30">
                                        <span className="text-white font-semibold">{s.name}</span>
                                        <span className="text-red-400 font-bold font-mono">Pending ₹{s.balance.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {advShortfalls.length > 0 && (
                        <div className="bg-amber-900/30 border border-amber-600/40 rounded-xl p-3">
                            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">⚠ Advance Recovery Shortfall</p>
                            <p className="text-amber-300/80 text-[11px] mb-2">Advance could not be fully recovered for these employees due to insufficient salary:</p>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                                {advShortfalls.map(s => (
                                    <div key={s.id} className="flex justify-between items-center text-xs bg-slate-800/60 px-2 py-1.5 rounded">
                                        <span className="text-white font-semibold">{s.name}</span>
                                        <span className="font-mono text-[10px] flex gap-2">
                                            <span className="text-slate-400">Planned <span className="text-amber-400">₹{s.planned}</span></span>
                                            <span className="text-slate-400">Recovered <span className="text-emerald-400">₹{s.actual}</span></span>
                                            <span className="text-red-400 font-bold">Shortfall ₹{s.shortfall}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {advShortfalls.length > 0 && <p className="text-slate-500 text-[10px] mt-2">Shortfall will carry forward to next month's opening balance.</p>}
                </div>
            ) : `Are you sure you want to finalize payroll for ${month} ${year}?\n\nThis will lock all attendance, leave, and advance records for this period.`;

            setModalState({
                isOpen: true,
                type: 'confirm',
                title: 'Confirm Freeze',
                message: confirmMessage,
                onConfirm: executeFreeze
            });
        }
    };

    const handleExitChange = (id: string, field: 'dol' | 'reason', value: string) => {
        setExitData(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    const processExitAndFreeze = () => {
        // ON LOP employees: DOL is optional — they remain active in the system
        const invalidEntries = Object.entries(exitData).filter(([_, val]) => {
            const data = val as { dol: string, reason: string };
            if (data.reason === 'ON LOP') return false; // DOL not required for ON LOP
            if (!data.dol) return true;
            const yearVal = parseInt(data.dol.split('-')[0]);
            return yearVal < 2000 || yearVal > 2100;
        });

        if (invalidEntries.length > 0) {
            setModalState({
                isOpen: true,
                type: 'error',
                title: 'Invalid Date Detected',
                message: 'One or more employees have an invalid Date of Leaving (e.g., incorrect year). Please correct the date (YYYY-MM-DD) before proceeding.'
            });
            return;
        }

        const employeesWithAdvance = Object.entries(exitData).filter(([id, data]) => {
            if (data.reason === 'ON LOP') return false;
            const adv = advanceLedgers.find(a => a.employeeId === id);
            return adv && (adv.balance || 0) > 0;
        });

        const performFreeze = () => {
            const updatedEmployees = employees.map(emp => {
                if (exitData[emp.id]) {
                    const { dol, reason } = exitData[emp.id];
                    if (reason === 'ON LOP') {
                        // ON LOP: only save the reason; clear any previous DOL so the employee stays active
                        return { ...emp, dol: '', leavingReason: reason };
                    }
                    return { ...emp, dol, leavingReason: reason };
                }
                return emp;
            });
            setEmployees(updatedEmployees);
            setZeroWageEmployees([]);
            setExitData({});
            executeFreeze();
        };

        if (employeesWithAdvance.length > 0) {
            const names = employeesWithAdvance.map(([id]) => employees.find(e => e.id === id)?.name || id).join(', ');
            setModalState({
                isOpen: true,
                type: 'confirm',
                title: 'Pending Advances Found',
                message: (
                    <div className="space-y-3">
                        <p className="text-sm">The following employees are being marked as LEFT but still have outstanding advance balances:</p>
                        <ul className="text-xs text-red-400 font-bold list-disc list-inside">
                            {employeesWithAdvance.map(([id]) => {
                                const emp = employees.find(e => e.id === id);
                                const adv = advanceLedgers.find(a => a.employeeId === id);
                                return <li key={id}>{emp?.name}: ₹{adv?.balance.toLocaleString()}</li>;
                            })}
                        </ul>
                        <p className="text-xs text-slate-400">Are you sure you want to finalize their exit and freeze payroll?</p>
                    </div>
                ),
                onConfirm: performFreeze
            });
        } else {
            performFreeze();
        }
    };

    const handleUnlock = () => {
        if (currentUser?.role !== 'Developer' && currentUser?.role !== 'Administrator') {
            setModalState({ isOpen: true, type: 'error', title: 'Access Denied', message: 'Only Administrators can unlock payroll.' });
            return;
        }
        setAuthPassword('');
        setAuthError('');
        setShowAuthModal(true);
    };

    const handleAuthVerify = () => {
        if (authPassword === currentUser?.password) {
            setShowAuthModal(false);
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
        } else {
            setAuthError('Incorrect Password');
        }
    };

    const generateReport = () => {
        // Exception for Arrear Report: It relies on History, not Lock state
        if (reportType !== 'Arrear Report' && !isLocked) return;

        setIsGenerating(true);
        setTimeout(() => {
            try {
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
                        // Grand Total row
                        const sum = (key: keyof typeof excelData[0]) =>
                            excelData.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);
                        excelData.push({
                            'ID': '',
                            'Name': 'GRAND TOTAL',
                            'Designation': '',
                            'Days Paid': sum('Days Paid'),
                            'Basic': sum('Basic'),
                            'DA': sum('DA'),
                            'Retaining Allw': sum('Retaining Allw'),
                            'HRA': sum('HRA'),
                            'Conveyance': sum('Conveyance'),
                            'Washing': sum('Washing'),
                            'Attire': sum('Attire'),
                            'Special Allw 1': sum('Special Allw 1'),
                            'Special Allw 2': sum('Special Allw 2'),
                            'Special Allw 3': sum('Special Allw 3'),
                            'Bonus': sum('Bonus'),
                            'Leave Encash': sum('Leave Encash'),
                            'GROSS EARNINGS': sum('GROSS EARNINGS'),
                            'PF (EE)': sum('PF (EE)'),
                            'VPF': sum('VPF'),
                            'ESI (EE)': sum('ESI (EE)'),
                            'Prof Tax': sum('Prof Tax'),
                            'Income Tax': sum('Income Tax'),
                            'LWF': sum('LWF'),
                            'Advance': sum('Advance'),
                            'Fine': sum('Fine'),
                            'TOTAL DEDUCTIONS': sum('TOTAL DEDUCTIONS'),
                            'NET PAY': sum('NET PAY')
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
                        generateBankStatementPDF(bankRecords, employees, month, year, companyProfile);
                    }
                } else if (reportType === 'Leave Ledger') {
                    const resultsMap = new Map<string, PayrollResult>(currentResults.map(r => [r.employeeId, r]));
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
                            const snapshot = resultsMap.get(e.id)?.leaveSnapshot;
                            const liveLedger = leaveLedgers.find(led => led.employeeId === e.id);
                            const l = snapshot || liveLedger || {
                                el: { opening: 0, eligible: 0, encashed: 0, availed: 0, balance: 0 },
                                sl: { eligible: 0, availed: 0, balance: 0 },
                                cl: { accumulation: 0, availed: 0, balance: 0 }
                            };
                            const elUsed = (l.el.availed || 0) + (l.el.encashed || 0);

                            return {
                                'ID': e.id,
                                'Name': e.name,
                                'EL Opening': l.el.opening || 0,
                                'EL Credit': l.el.eligible || 0,
                                'EL Used': elUsed,
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
                        // Pass leaveLedgers to the PDF generator to populate data
                        generateLeaveLedgerReport(currentResults, activeEmps, leaveLedgers, month, year, 'AC', companyProfile);
                    }

                } else if (reportType === 'Advance Shortfall') {
                    const shortfallData = currentResults.map(r => {
                        const emp = employees.find(e => e.id === r.employeeId);
                        const adv = advanceLedgers.find(a => a.employeeId === r.employeeId);
                        if (!adv || (adv.recovery || 0) === 0) return null;

                        const recovered = r.deductions?.advanceRecovery || 0;
                        const planned = adv.recovery;
                        const shortfall = planned - recovered;
                        if (shortfall <= 0) return null;
                        return {
                            id: r.employeeId,
                            name: emp?.name,
                            target: planned,
                            recovered,
                            shortfall
                        };
                    }).filter(d => d !== null);

                    if (shortfallData.length === 0) {
                        setModalState({ isOpen: true, type: 'error', title: 'No Data Available', message: 'No Data Available to Report' });
                        return;
                    }

                    generateAdvanceShortfallReport(shortfallData, month, year, format, companyProfile);
                } else if (reportType === 'Arrear Report') {
                    // Retrieve from Arrear History based on selected batch, not global month
                    let batch: ArrearBatch | undefined;

                    if (arrearHistory && arrearHistory.length > 0) {
                        const [selectedMonth, selectedYear] = arrearSelectedPeriod.split('-');
                        batch = arrearHistory.find(b => b.month === selectedMonth && b.year === parseInt(selectedYear, 10));
                    }

                    if (!batch || !batch.records || batch.records.length === 0) {
                        throw new Error(`No arrear calculation found. Please process increments in Pay Process > Arrear Salary first.`);
                    }

                    generateArrearReport(
                        batch.records,
                        batch.effectiveMonth,
                        batch.effectiveYear,
                        batch.month,
                        batch.year,
                        format,
                        companyProfile
                    );
                }

            } catch (e: any) {
                setModalState({ isOpen: true, type: 'error', title: 'Generation Failed', message: e.message });
            } finally {
                setIsGenerating(false);
            }
        }, 500);
    };

    const handleModalClose = () => {
        // Execute the onClose callback (Rollover) if defined
        if (modalState.onClose) {
            modalState.onClose();
        }
        setModalState({ ...modalState, isOpen: false, onClose: undefined });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 relative">

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
                    disabled={!isLocked && (!hasData || hasUnsavedChanges)}
                    className={`px-6 py-2.5 rounded-lg font-bold text-sm shadow-lg transition-all ${isLocked
                        ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
                        : (hasData && !hasUnsavedChanges)
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                >
                    {isLocked
                        ? 'Unlock Period'
                        : hasUnsavedChanges
                            ? 'Save in Process Payroll to Freeze'
                            : hasData
                                ? 'Confirm & Freeze Data'
                                : 'No Data to Freeze'}
                </button>
            </div>

            {/* Report Generation Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Report Selection */}
                <div className={`lg:col-span-2 bg-[#1e293b] rounded-2xl border border-slate-800 p-6 shadow-xl transition-opacity ${!isLocked && reportType !== 'Arrear Report' ? 'opacity-70' : 'opacity-100'}`}>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Select Report</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[
                            { id: 'Pay Sheet', icon: FileSpreadsheet, label: 'Monthly Pay Sheet' },
                            { id: 'Pay Slips', icon: FileText, label: 'Pay Slips' },
                            { id: 'Bank Statement', icon: CreditCard, label: 'Bank Statement' },
                            { id: 'Leave Ledger', icon: ClipboardList, label: 'Leave Ledger' },
                            { id: 'Advance Shortfall', icon: Wallet, label: 'Advance Shortfall' },
                            { id: 'Arrear Report', icon: TrendingUp, label: 'Arrear Salary Report' },
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleReportTypeChange(item.id)}
                                className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-all ${reportType === item.id
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
                                    Generating <b>{reportType}</b> in <b>{format}</b> format
                                    {reportType === 'Arrear Report' && arrearSelectedPeriod ?
                                        ` for selected batch.` :
                                        ` for ${month} ${year}.`
                                    }
                                </p>
                            </div>

                            {reportType === 'Arrear Report' && arrearHistory && arrearHistory.length > 0 && (
                                <div className="space-y-2 mt-4 animate-in fade-in slide-in-from-top-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Arrear Batch</label>
                                    <select
                                        value={arrearSelectedPeriod}
                                        onChange={e => setArrearSelectedPeriod(e.target.value)}
                                        className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold outline-none focus:border-indigo-500 transition-colors"
                                    >
                                        {arrearHistory.map(b => (
                                            <option key={`${b.month}-${b.year}`} value={`${b.month}-${b.year}`}>
                                                [{b.status || 'Finalized'}] Processed: {b.month} {b.year} (Eff: {b.effectiveMonth} {b.effectiveYear})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={generateReport}
                        disabled={isGenerating || (reportType !== 'Arrear Report' && !isLocked)}
                        className={`w-full py-4 font-black rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all mt-6 ${(reportType !== 'Arrear Report' && !isLocked)
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20'
                            }`}
                    >
                        {isGenerating ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                        ) : (reportType !== 'Arrear Report' && !isLocked) ? (
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

            {/* Auth Modal */}
            {showAuthModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                        <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                        <div className="flex flex-col items-center gap-2">
                            <div className="p-3 bg-indigo-900/20 text-indigo-500 rounded-full border border-indigo-900/50 mb-2">
                                <KeyRound size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-white text-center">Admin Verification</h3>
                            <p className="text-xs text-slate-400 text-center">Enter your password to unlock this period.</p>
                        </div>

                        <div className="space-y-3 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                            <input
                                type="password"
                                placeholder="Enter Password"
                                autoFocus
                                className={`w-full bg-[#0f172a] border ${authError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm`}
                                value={authPassword}
                                onChange={(e) => { setAuthPassword(e.target.value); setAuthError(''); }}
                                onKeyDown={(e) => e.key === 'Enter' && handleAuthVerify()}
                            />
                            {authError && <p className="text-[10px] text-red-400 font-bold text-center animate-pulse">{authError}</p>}
                        </div>
                        <button onClick={handleAuthVerify} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all text-sm">
                            VERIFY & UNLOCK
                        </button>
                    </div>
                </div>
            )}

            {/* ZERO WAGE / EXIT MARKING MODAL */}
            {zeroWageEmployees.length > 0 && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-w-4xl max-h-[90vh] rounded-2xl border border-amber-500/30 shadow-2xl flex flex-col overflow-hidden relative">

                        {/* Header - Styled like an Alert Card (Amber/Orange) */}
                        <div className="bg-amber-600 p-6 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/20 rounded-full text-white shadow-lg border border-white/10">
                                    <UserX size={28} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-wide">Mark Exit & Freeze</h3>
                                    <p className="text-xs text-amber-100 font-medium mt-0.5">
                                        Zero wage employees detected. Verify status or mark as left.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setZeroWageEmployees([]); setExitData({}); }}
                                className="p-2 bg-black/10 hover:bg-black/20 text-white/80 hover:text-white rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-0 bg-[#0f172a] custom-scrollbar">
                            {/* Context Banner */}
                            <div className="bg-[#1e293b] p-4 border-b border-slate-800 flex gap-3 items-center sticky top-0 z-10 shadow-md">
                                <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    The following employees have <b>NIL Wages</b> (0 Days). If they have left the organization, please enter their <b>Date of Leaving (DOL)</b> and <b>Reason</b> below.
                                    <br />This will update the Employee Master automatically before freezing the payroll.
                                </p>
                            </div>

                            <div className="p-4">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-800/50 text-xs font-bold uppercase text-slate-400">
                                        <tr>
                                            <th className="px-4 py-3 rounded-tl-lg border-b border-slate-700">Employee Details</th>
                                            <th className="px-4 py-3 border-b border-slate-700">Date of Leaving</th>
                                            <th className="px-4 py-3 border-b border-slate-700 w-24">Pending Adv</th>
                                            <th className="px-4 py-3 rounded-tr-lg border-b border-slate-700">Reason for Leaving</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 text-sm">
                                        {zeroWageEmployees.map((r) => {
                                            const emp = employees.find(e => e.id === r.employeeId);
                                            const data = exitData[r.employeeId] || { dol: '', reason: '' };
                                            const maxDate = getPayrollPeriodEnd();

                                            return (
                                                <tr key={r.employeeId} className="bg-[#1e293b]/50 hover:bg-[#1e293b] transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-white text-sm">{emp?.name}</div>
                                                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                                            {r.employeeId}
                                                            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 ml-2">Zero Pay</span>
                                                            {data.reason === 'ON LOP' && (
                                                                <span className="bg-teal-900/40 border border-teal-500/40 text-teal-400 px-1.5 py-0.5 rounded ml-1">Stays Active</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="date"
                                                            className={`border rounded-lg px-3 py-2 text-xs w-full outline-none transition-all placeholder-slate-600 ${data.reason === 'ON LOP'
                                                                ? 'bg-slate-800/40 border-slate-700 text-slate-500 cursor-not-allowed'
                                                                : 'bg-[#0f172a] border-slate-600 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50'
                                                                }`}
                                                            value={data.reason === 'ON LOP' ? '' : data.dol}
                                                            max={maxDate}
                                                            disabled={data.reason === 'ON LOP'}
                                                            placeholder={data.reason === 'ON LOP' ? 'Not required' : ''}
                                                            onChange={(e) => handleExitChange(r.employeeId, 'dol', e.target.value)}
                                                        />
                                                        {data.reason === 'ON LOP' && (
                                                            <p className="text-[9px] text-teal-400 mt-1">Employee stays active — no exit date needed</p>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className={`font-mono font-bold ${(() => {
                                                            const adv = advanceLedgers.find(a => a.employeeId === r.employeeId);
                                                            const pending = adv ? (adv.balance + (adv.recovery || 0)) : 0;
                                                            return pending > 0 ? 'text-red-400' : 'text-slate-500';
                                                        })()}`}>
                                                            ₹{(() => {
                                                                const adv = advanceLedgers.find(a => a.employeeId === r.employeeId);
                                                                const pending = adv ? (adv.balance + (adv.recovery || 0)) : 0;
                                                                return pending.toLocaleString();
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            className="bg-[#0f172a] border border-slate-600 rounded-lg px-3 py-2 text-white text-xs w-full focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
                                                            value={data.reason}
                                                            onChange={(e) => handleExitChange(r.employeeId, 'reason', e.target.value)}
                                                            title="Select separation reason"
                                                        >
                                                            <option value="">Select Reason...</option>
                                                            <option value="ON LOP">ON LOP</option>
                                                            <option value="Resignation">Resignation</option>
                                                            <option value="Retirement">Retirement</option>
                                                            <option value="Termination">Termination</option>
                                                            <option value="Death">Death</option>
                                                            <option value="Absconding">Absconding</option>
                                                        </select>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-5 bg-[#1e293b] border-t border-slate-800 flex justify-between items-center gap-4">
                            <div className="text-[10px] text-slate-500 italic">
                                * Leaving date can be anytime within the payroll month.
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setZeroWageEmployees([]); setExitData({}); }}
                                    className="px-6 py-2.5 rounded-xl border border-slate-600 text-slate-300 font-bold text-xs hover:bg-slate-800 transition-all uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={processExitAndFreeze}
                                    className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-amber-900/30 transition-all uppercase tracking-wider flex items-center gap-2 transform hover:scale-105 active:scale-95"
                                >
                                    <Save size={16} /> Proceed to Freeze
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* General Message Modal */}
            {modalState.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                        <button onClick={handleModalClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                        <div className="flex flex-col items-center gap-2">
                            <div className={`p-3 rounded-full border ${modalState.type === 'error' ? 'bg-red-900/30 text-red-500 border-red-900/50' : modalState.type === 'success' ? 'bg-emerald-900/30 text-emerald-500 border-emerald-900/50' : 'bg-blue-900/30 text-blue-500 border-blue-900/50'}`}>
                                {modalState.type === 'error' ? <AlertTriangle size={24} /> : modalState.type === 'success' ? <CheckCircle2 size={24} /> : <Lock size={24} />}
                            </div>
                            <h3 className="text-lg font-bold text-white text-center">{modalState.title}</h3>
                            <div className="text-sm text-slate-400 text-center whitespace-pre-line w-full">{modalState.message}</div>
                        </div>
                        <div className="flex gap-3 mt-4">
                            {modalState.type === 'confirm' ? (
                                <>
                                    <button onClick={handleModalClose} className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 font-bold hover:bg-slate-800 transition-colors">Cancel</button>
                                    <button onClick={modalState.onConfirm} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg">Confirm</button>
                                </>
                            ) : (
                                <button onClick={handleModalClose} className="w-full py-2.5 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition-colors">Close</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
