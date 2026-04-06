
import React, { useState, useEffect, useMemo } from 'react';
import { Save, RefreshCw, Lock, FileText, Eye, AlertCircle, AlertTriangle, X, CheckCircle, Download, Scale, HandCoins, Users, Calculator } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, PayrollResult, StatutoryConfig, CompanyProfile, Attendance, LeaveLedger, AdvanceLedger, User, FineRecord, OTRecord } from '../types';
import { calculatePayroll } from '../services/payrollEngine';
import { numberToWords, formatDateInd, generateExcelWorkbook, getStandardFileName } from '../services/reportService';

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
    fines?: FineRecord[];
    otRecords?: OTRecord[];
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
    fines = [],
    otRecords = []
}) => {
    const [results, setResults] = useState<PayrollResult[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [previewRecord, setPreviewRecord] = useState<PayrollResult | null>(null);

    // Compliance Modal State
    const [complianceConflicts, setComplianceConflicts] = useState<any[]>([]);
    const [showComplianceModal, setShowComplianceModal] = useState(false);

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

    const hasAnyAttendance = useMemo(() => {
        return attendances.some(a => 
            a.month === month && 
            a.year === year && 
            ((a.presentDays || 0) + (a.earnedLeave || 0) + (a.sickLeave || 0) + (a.casualLeave || 0) + (a.lopDays || 0)) > 0
        );
    }, [attendances, month, year]);

    const activeEmployees = useMemo(() => {
        const monthIdx = months.indexOf(month);
        const periodStart = new Date(year, monthIdx, 1);
        periodStart.setHours(0, 0, 0, 0);
        return employees.filter(emp => {
            if (!emp.dol) return true;
            const [y, m, d] = emp.dol.split('-').map(Number);
            const dolDate = new Date(y, m - 1, d);
            dolDate.setHours(0, 0, 0, 0);
            return dolDate >= periodStart;
        });
    }, [employees, month, year]);

    // Load Data Effect (Priority: Temp Storage > Saved Records)
    useEffect(() => {
        const tempKey = `app_temp_payroll_${month}_${year}`;
        const savedTemp = localStorage.getItem(tempKey);
        let loadedFromTemp = false;

        if (savedTemp) {
            try {
                const parsed = JSON.parse(savedTemp);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setResults(parsed);
                    setIsSaved(false); // Temp data is by definition unsaved
                    loadedFromTemp = true;
                }
            } catch (e) {
                localStorage.removeItem(tempKey);
            }
        }

        if (!loadedFromTemp) {
            const drafts = savedRecords.filter(r => r.month === month && r.year === year);
            if (drafts.length > 0) {
                setResults(drafts);
                setIsSaved(true);
            } else {
                setResults([]);
                setIsSaved(false);
            }
        }
    }, [month, year, savedRecords]);

    // Sync Unsaved Changes to Temp Storage
    useEffect(() => {
        const tempKey = `app_temp_payroll_${month}_${year}`;
        if (!isSaved && results.length > 0) {
            localStorage.setItem(tempKey, JSON.stringify(results));
        }
    }, [results, isSaved, month, year]);

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
                            <p className="text-xs text-slate-300 leading-relaxed">Go to <b>Employee Master &gt; Edit Employee &gt; Statutory Options</b> and enable "EPS Maturity Control".<br /><br />Select <b>"Pension Eligible"</b> to continue EPS or <b>"Full PF Redirect"</b> to stop EPS.</p>
                        </div>
                        <p className="text-xs text-center text-red-400 font-bold mt-2">Payroll processing is blocked until settings are updated.</p>
                    </div>
                ),
            });
            return false;
        }
        return true;
    };

    const executeCalculation = (restrictedMode = false) => {
        setIsProcessing(true);
        setTimeout(() => {
            try {
                const calculatedResults = activeEmployees.map(emp => {
                    const attendance = attendances.find(a => a.employeeId === emp.id && a.month === month && a.year === year) || { employeeId: emp.id, month, year, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 };
                    const leave = leaveLedgers.find(l => l.employeeId === emp.id) || { employeeId: emp.id, el: { opening: 0, eligible: 0, encashed: 0, availed: 0, balance: 0 }, sl: { eligible: 0, availed: 0, balance: 0 }, cl: { availed: 0, accumulation: 0, balance: 0 } };
                    const advance = advanceLedgers.find(a => a.employeeId === emp.id) || { employeeId: emp.id, opening: 0, totalAdvance: 0, monthlyInstallment: 0, paidAmount: 0, balance: 0, emiCount: 0, manualPayment: 0, recovery: 0 };

                    const shouldRestrict = restrictedMode && complianceConflicts.some(c => c.employeeId === emp.id);
                    const otRecord = otRecords.find(r => r.employeeId === emp.id && r.month === month && r.year === year) || null;

                    return calculatePayroll(emp, config, attendance, leave, advance, month, year, { restrictTo50Percent: shouldRestrict }, fines, otRecord);
                });
                setResults(calculatedResults);
                setIsSaved(false);
                setComplianceConflicts([]); // Clear conflicts after resolution
                setShowComplianceModal(false);
            } catch (e) {
                console.error(e);
            } finally {
                setIsProcessing(false);
            }
        }, 800);
    };

    const handleCalculate = () => {
        if (isLocked) return;

        // --- SEQUENTIAL PROCESSING CHECK ---
        const getPeriodValue = (m: string, y: number) => (y * 12) + months.indexOf(m);
        const finalizedRecords = savedRecords.filter(r => r.status === 'Finalized');

        if (finalizedRecords.length > 0) {
            const currentVal = getPeriodValue(month, year);

            // Find min and max finalized periods
            let lastLockedVal = -1;
            let firstMaidenVal = Infinity;

            finalizedRecords.forEach(r => {
                const val = getPeriodValue(r.month, r.year);
                if (val > lastLockedVal) lastLockedVal = val;
                if (val < firstMaidenVal) firstMaidenVal = val;
            });

            // 1. Check if trying to process beyond the next immediate month
            if (currentVal > lastLockedVal + 1) {
                setModalState({
                    isOpen: true,
                    type: 'error',
                    title: 'Sequence Violation',
                    message: 'not possible to process data with out processing the Month and Year next to locked Month and year.'
                });
                return;
            }

            // 2. Check if trying to process before the first maiden month
            if (currentVal < firstMaidenVal) {
                setModalState({
                    isOpen: true,
                    type: 'error',
                    title: 'Data Integrity Alert',
                    message: 'not possible to process data before the initial maiden month and year.'
                });
                return;
            }
        }
        // -----------------------------------
        
        // VALIDATION: Check for "Total Days > Days in Month"
        const daysInMonthTotal = new Date(year, months.indexOf(month) + 1, 0).getDate();
        const attendanceErrors = activeEmployees.filter(emp => {
            const att = attendances.find(a => a.employeeId === emp.id && a.month === month && a.year === year) || { presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 };
            const total = (att.presentDays || 0) + (att.earnedLeave || 0) + (att.sickLeave || 0) + (att.casualLeave || 0) + (att.lopDays || 0);
            return total > daysInMonthTotal;
        });

        if (attendanceErrors.length > 0) {
            setModalState({
                isOpen: true,
                type: 'error',
                title: 'Attendance Validation Error',
                message: (
                    <div className="text-left space-y-3">
                        <p className="text-xs font-bold text-red-400 uppercase tracking-tight">Total accounted days for the following employees exceed {daysInMonthTotal} days for {month}:</p>
                        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 max-h-48 overflow-y-auto custom-scrollbar shadow-inner">
                            {attendanceErrors.map(emp => {
                                const att = attendances.find(a => a.employeeId === emp.id && a.month === month && a.year === year) || { presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 };
                                const total = (att.presentDays || 0) + (att.earnedLeave || 0) + (att.sickLeave || 0) + (att.casualLeave || 0) + (att.lopDays || 0);
                                return (
                                    <div key={emp.id} className="flex justify-between items-center text-[10px] py-1.5 border-b border-slate-800 last:border-0 animate-in fade-in slide-in-from-left-2 transition-all">
                                        <div className="flex flex-col">
                                            <span className="text-white font-black uppercase">{emp.name}</span>
                                            <span className="text-slate-500 font-mono text-[9px]">{emp.id}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-red-400 font-black py-0.5 px-2 bg-red-950/30 border border-red-900/40 rounded text-[11px] font-mono">Total {total}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-[9px] text-slate-400 italic text-center font-bold uppercase tracking-wider">* Fix attendance records in 'Attendance Manager' then recalculate.</p>
                    </div>
                )
            });
            return;
        }

        if (!checkAgeMaturity()) return;

        setIsProcessing(true);
        // Initial Run - Standard Calculation
        setTimeout(() => {
            const initialResults = activeEmployees.map(emp => {
                const attendance = attendances.find(a => a.employeeId === emp.id && a.month === month && a.year === year) || { employeeId: emp.id, month, year, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 };
                const leave = leaveLedgers.find(l => l.employeeId === emp.id) || { employeeId: emp.id, el: { opening: 0, eligible: 0, encashed: 0, availed: 0, balance: 0 }, sl: { eligible: 0, availed: 0, balance: 0 }, cl: { availed: 0, accumulation: 0, balance: 0 } };
                const advance = advanceLedgers.find(a => a.employeeId === emp.id) || { employeeId: emp.id, opening: 0, totalAdvance: 0, monthlyInstallment: 0, paidAmount: 0, balance: 0, emiCount: 0, manualPayment: 0, recovery: 0 };
                const otRecord = otRecords.find(r => r.employeeId === emp.id && r.month === month && r.year === year) || null;
                return calculatePayroll(emp, config, attendance, leave, advance, month, year, { restrictTo50Percent: false }, fines, otRecord);
            });

            // CHECK CONDITION B: Advance > 50% of Code_Gross_Wages
            const conflicts: any[] = [];
            initialResults.forEach(r => {
                const emp = activeEmployees.find(e => e.id === r.employeeId);
                if (!emp) return;

                // Re-derive Statutory Deductions to get Code Gross (Not stored in result directly, so calculating)
                const statDed = (r.deductions.epf || 0) + (r.deductions.vpf || 0) + (r.deductions.esi || 0) + (r.deductions.pt || 0) + (r.deductions.it || 0) + (r.deductions.lwf || 0);
                const codeGross = Math.max(0, r.earnings.total - statDed);
                const limit = Math.round(codeGross * 0.5);
                const advance = r.deductions.advanceRecovery || 0;

                if (advance > limit && advance > 0) {
                    conflicts.push({
                        employeeId: r.employeeId,
                        name: emp.name,
                        codeGross: codeGross,
                        limit: limit,
                        proposed: advance
                    });
                }
            });

            if (conflicts.length > 0) {
                setComplianceConflicts(conflicts);
                setShowComplianceModal(true);
                setIsProcessing(false);
            } else {
                setResults(initialResults);
                setIsSaved(false);
                setIsProcessing(false);
            }
        }, 500);
    };

    const handleSaveDraft = () => {
        if (results.length === 0 || isLocked) return;

        // Clear temp storage for this period as we are committing it
        const tempKey = `app_temp_payroll_${month}_${year}`;
        localStorage.removeItem(tempKey);

        const otherRecords = savedRecords.filter(r => !(r.month === month && r.year === year));
        const newRecords = results.map(r => ({ ...r, status: 'Draft' as const }));
        setSavedRecords([...otherRecords, ...newRecords]);
        setIsSaved(true);
        setModalState({ isOpen: true, type: 'success', title: 'Draft Saved', message: `Payroll for ${month} ${year} saved successfully.` });
    };

    const handleExportDraft = async () => {
        if (results.length === 0) return;

        // Use full results for export, including 0 wages employees
        const data = results.map(r => {
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
                'OT Amount': r?.earnings?.otAmount || 0,
                'Leave Encash': r?.earnings?.leaveEncashment || 0,
                'Gross Earnings': r?.earnings?.total || 0,

                // Deductions
                'PF (Employee)': r?.deductions?.epf || 0,
                'VPF': r?.deductions?.vpf || 0,
                'ESI (Employee)': r?.deductions?.esi || 0,
                'Professional Tax': r?.deductions?.pt || 0,
                'Income Tax (TDS)': r?.deductions?.it || 0,
                'LWF (Employee)': r?.deductions?.lwf || 0,
                'Advance Recovery': r?.deductions?.advanceRecovery || 0,
                'Fine / Damages': r?.deductions?.fine || 0,
                'Fine Reason': r?.fineReason || '',
                'Total Deductions': r?.deductions?.total || 0,

                // Net Pay
                'Net Pay': r.netPay
            };
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Draft Payroll");
        const fileName = getStandardFileName('Draft_Payroll', companyProfile, month, year);
        await generateExcelWorkbook(wb, fileName);
    };

    const totalNet = results.reduce((acc, curr) => acc + (curr?.netPay || 0), 0);
    const totalGross = results.reduce((acc, curr) => acc + (curr?.earnings?.total || 0), 0);
    const totalDed = results.reduce((acc, curr) => acc + (curr?.deductions?.total || 0), 0);

    const activeCount = results.length;
    const presentCount = results.filter(r => r.payableDays > 0).length;
    const absentCount = activeCount - presentCount;

    // --- AGGREGATE TOTALS FOR TABLE SUMMARY ---
    const tableTotals = useMemo(() => {
        return results.reduce((acc, r) => ({
            days: acc.days + (r.payableDays || 0),
            basic: acc.basic + (r.earnings.basic || 0),
            da: acc.da + (r.earnings.da || 0),
            hra: acc.hra + (r.earnings.hra || 0),
            others: acc.others + ((r?.earnings?.total || 0) - ((r?.earnings?.basic || 0) + (r?.earnings?.da || 0) + (r?.earnings?.hra || 0))),
            gross: acc.gross + (r.earnings.total || 0),
            pf: acc.pf + (r.deductions.epf || 0),
            esi: acc.esi + (r.deductions.esi || 0),
            ptTds: acc.ptTds + ((r.deductions.pt || 0) + (r.deductions.it || 0)),
            advance: acc.advance + (r.deductions.advanceRecovery || 0),
            dedn: acc.dedn + (r.deductions.total || 0),
            net: acc.net + (r.netPay || 0)
        }), { days: 0, basic: 0, da: 0, hra: 0, others: 0, gross: 0, pf: 0, esi: 0, ptTds: 0, advance: 0, dedn: 0, net: 0 });
    }, [results]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className={`bg-[#1e293b] p-3 rounded-xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 ${isLocked ? 'opacity-90' : ''}`}>
                <div className="flex items-center gap-3">
                    {isLocked ? (
                        <div className="p-2 bg-amber-900/20 text-amber-500 rounded-xl border border-amber-900/50"><Lock size={20} /></div>
                    ) : (
                        <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/30"><RefreshCw size={20} className="text-white" /></div>
                    )}
                    <div>
                        <h2 className="text-base font-black text-white uppercase tracking-tight">{isLocked ? 'Payroll Locked' : 'Run Payroll'}</h2>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{isLocked ? `Period ${month} ${year} is finalized.` : `Process salaries for ${month} ${year}.`}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isLocked ? (
                        <>
                            <button 
                                onClick={handleCalculate} 
                                disabled={isProcessing || !hasAnyAttendance} 
                                title={!hasAnyAttendance ? "No attendance data found for this period" : "Calculate Payroll Sheet"} 
                                aria-label="Calculate Payroll Sheet" 
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[12px] rounded-lg transition-all shadow-lg shadow-blue-900/20 disabled:opacity-70 disabled:bg-slate-700 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                                ) : (
                                    !hasAnyAttendance ? <AlertCircle size={15} className="text-amber-400 font-bold" /> : <Calculator size={15} />
                                )}
                                {!hasAnyAttendance ? 'No Attendance Data' : 'Calculate Sheet'}
                            </button>
                            {results.length > 0 && (
                                <>
                                    <button 
                                        onClick={handleSaveDraft} 
                                        disabled={isSaved || !hasAnyAttendance} 
                                        title={!hasAnyAttendance ? "Cannot save without attendance data" : (isSaved ? "Already Saved as Draft" : "Save as Draft")} 
                                        aria-label={isSaved ? "Already Saved as Draft" : "Save as Draft"} 
                                        className={`flex items-center gap-1.5 px-4 py-2 font-bold text-[12px] rounded-lg shadow-lg transition-all ${isSaved || !hasAnyAttendance ? 'bg-emerald-900/20 text-emerald-500/50 border border-emerald-900/30 cursor-not-allowed grayscale-[0.5]' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20'}`}
                                    >
                                        <Save size={15} />
                                        {isSaved ? 'Draft Saved' : 'Save Draft'}
                                    </button>
                                    <button 
                                        onClick={handleExportDraft} 
                                        disabled={!hasAnyAttendance}
                                        className={`p-2 rounded-lg border transition-all shadow-lg font-black text-[12px] ${!hasAnyAttendance ? 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'}`} 
                                        title={!hasAnyAttendance ? "No data to export" : "Export to Excel"} 
                                        aria-label="Export to Excel"
                                    >
                                        <Download size={14} />
                                    </button>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/20 border border-amber-900/50 rounded-lg text-amber-400 text-[10px] font-black uppercase tracking-tight">
                            <Lock size={12} /> View Only
                        </div>
                    )}
                </div>
            </div>

            {results.length > 0 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-[#1e293b] p-3 rounded-xl border border-slate-800 shadow-lg border-l-4 border-l-slate-600"><p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Total Gross</p><h3 className="text-xl font-black text-white">₹ {totalGross.toLocaleString()}</h3></div>
                        <div className="bg-[#1e293b] p-3 rounded-xl border border-slate-800 shadow-lg border-l-4 border-l-red-500/50"><p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Total Deductions</p><h3 className="text-xl font-black text-red-400">₹ {totalDed.toLocaleString()}</h3></div>
                        <div className="bg-[#1e293b] p-3 rounded-xl border border-slate-800 shadow-lg border-l-4 border-l-emerald-500/50 relative overflow-hidden"><div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div><p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Net Payable</p><h3 className="text-xl font-black text-emerald-400">₹ {totalNet.toLocaleString()}</h3></div>
                    </div>

                    <div className="flex items-center bg-[#111827] px-4 py-2 rounded-lg border border-slate-800 shadow-inner">
                        <div className="flex items-center gap-2 mr-4 text-slate-500">
                            <Users size={12} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Status :</span>
                        </div>
                        <div className="flex gap-8 text-[9px] font-black uppercase tracking-widest">
                            <div className="flex items-center gap-1.5">
                                <span className="text-slate-500">Active :</span>
                                <span className="text-white font-mono text-xs">{activeCount}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-slate-500">Present :</span>
                                <span className="text-emerald-400 font-mono text-xs">{presentCount}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-slate-500">Absent :</span>
                                <span className="text-red-400 font-mono text-xs">{absentCount}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#1e293b] rounded-xl border border-slate-800 overflow-hidden shadow-2xl max-h-[600px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-[#0f172a] text-sky-400 text-[10px] uppercase tracking-normal font-bold sticky top-0 z-10 shadow-md">
                                <tr>
                                    <th className="px-5 py-3 bg-[#0f172a]">Employee Identity</th>
                                    <th className="px-2 py-3 text-center bg-[#0f172a]">Days</th>
                                    <th className="px-3 py-3 text-right bg-[#0f172a]">Basic</th>
                                    <th className="px-3 py-3 text-right bg-[#0f172a]">DA</th>
                                    <th className="px-3 py-3 text-right bg-[#0f172a]">HRA</th>
                                    <th className="px-3 py-3 text-right bg-[#0f172a] text-slate-500">Others</th>
                                    <th className="px-3 py-3 text-right text-white bg-[#0f172a]">Gross</th>
                                    <th className="px-3 py-3 text-right text-blue-400 bg-[#0f172a]">PF</th>
                                    <th className="px-3 py-3 text-right text-pink-400 bg-[#0f172a]">ESI</th>
                                    <th className="px-3 py-3 text-right text-amber-400 bg-[#0f172a]">PT/TDS</th>
                                    <th className="px-3 py-3 text-right text-sky-400 bg-[#0f172a]">Advance</th>
                                    <th className="px-3 py-3 text-right text-red-300 bg-[#0f172a]">Dedn</th>
                                    <th className="px-3 py-3 text-right text-emerald-400 bg-[#0f172a]">Net Pay</th>
                                    <th className="px-3 py-3 text-center bg-[#0f172a] sticky right-0 z-20 shadow-[-4px_0_4px_-4px_rgba(0,0,0,0.5)]">View</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {results.filter(r => !isSaved || r.netPay > 0).map(r => {
                                    const emp = employees.find(e => e.id === r.employeeId);
                                    const others = (r?.earnings?.total || 0) - ((r?.earnings?.basic || 0) + (r?.earnings?.da || 0) + (r?.earnings?.hra || 0));
                                    const isZeroAttendance = r.payableDays === 0;

                                    return (
                                        <tr key={r.employeeId} className={`hover:bg-slate-800/50 transition-colors ${isZeroAttendance ? 'opacity-40 grayscale-[0.5] font-medium italic select-none pointer-events-none' : ''}`}>
                                            <td className="px-5 py-2">
                                                <div className="text-xs font-bold text-white uppercase tracking-normal">{emp?.name}</div>
                                                <div className="text-[9px] text-slate-500 font-mono uppercase tracking-normal">{r.employeeId}</div>
                                            </td>
                                            <td className="px-2 py-2 text-center font-mono text-slate-300 text-[11px]">{r.payableDays}</td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-300 text-[11px]">{(r?.earnings?.basic || 0).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-300 text-[11px]">{(r?.earnings?.da || 0).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-300 text-[11px]">{(r?.earnings?.hra || 0).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-500 text-[11px]">{others.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right font-mono font-black text-white text-[11px]">{(r?.earnings?.total || 0).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right font-mono text-blue-300 text-[11px]">{(r?.deductions?.epf || 0).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right font-mono text-pink-300 text-[11px]">{(r?.deductions?.esi || 0).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right font-mono text-amber-300 text-[11px]">{((r?.deductions?.pt || 0) + (r?.deductions?.it || 0)).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right font-mono text-sky-300 font-black text-[11px]">{(r?.deductions?.advanceRecovery || 0).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right font-mono text-red-300 text-[11px]">{(r?.deductions?.total || 0).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right font-mono font-black text-emerald-400 text-xs bg-emerald-900/10">{(r?.netPay || 0).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-center sticky right-0 bg-[#1e293b] shadow-[-4px_0_4px_-4px_rgba(0,0,0,0.5)]">
                                                <button onClick={() => setPreviewRecord(r)} className="p-1.5 bg-blue-900/20 text-blue-400 hover:text-white hover:bg-blue-600 rounded-lg transition-colors" title={`View Pay Slip for ${emp?.name}`} aria-label={`View Pay Slip for ${emp?.name}`}>
                                                    <Eye size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="sticky bottom-0 z-20 bg-[#0f172a]/95 backdrop-blur-md border-t-2 border-slate-700 shadow-[0_-4px_10px_rgba(0,0,0,0.3)]">
                                <tr className="text-[10px] font-black uppercase tracking-tight">
                                    <td className="px-5 py-3 text-sky-400">Total Summary</td>
                                    <td className="px-2 py-3 text-center font-mono text-white bg-white/5">{tableTotals.days.toFixed(1)}</td>
                                    <td className="px-3 py-3 text-right font-mono text-slate-300">{Math.round(tableTotals.basic).toLocaleString()}</td>
                                    <td className="px-3 py-3 text-right font-mono text-slate-300">{Math.round(tableTotals.da).toLocaleString()}</td>
                                    <td className="px-3 py-3 text-right font-mono text-slate-300">{Math.round(tableTotals.hra).toLocaleString()}</td>
                                    <td className="px-3 py-3 text-right font-mono text-slate-500">{Math.round(tableTotals.others).toLocaleString()}</td>
                                    <td className="px-3 py-3 text-right font-mono text-white bg-white/5 font-black">{Math.round(tableTotals.gross).toLocaleString()}</td>
                                    <td className="px-3 py-3 text-right font-mono text-blue-400">{Math.round(tableTotals.pf).toLocaleString()}</td>
                                    <td className="px-3 py-3 text-right font-mono text-pink-400">{Math.round(tableTotals.esi).toLocaleString()}</td>
                                    <td className="px-3 py-3 text-right font-mono text-amber-400">{Math.round(tableTotals.ptTds).toLocaleString()}</td>
                                    <td className="px-3 py-3 text-right font-mono text-sky-400">{Math.round(tableTotals.advance).toLocaleString()}</td>
                                    <td className="px-3 py-3 text-right font-mono text-red-400 bg-red-950/20">{Math.round(tableTotals.dedn).toLocaleString()}</td>
                                    <td className="px-3 py-3 text-right font-mono text-emerald-400 bg-emerald-950/20 font-black">{Math.round(tableTotals.net).toLocaleString()}</td>
                                    <td className="px-3 py-3 bg-[#0f172a] sticky right-0"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* COMPLIANCE ALERT MODAL (ADVANCE RECOVERY) */}
            {showComplianceModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-w-lg rounded-2xl border border-amber-500/50 shadow-2xl p-0 flex flex-col relative overflow-hidden">
                        <div className="bg-amber-600 p-6 flex justify-between items-start">
                            <div className="flex gap-4">
                                <div className="p-3 bg-white/20 rounded-full text-white shadow-lg"><Scale size={24} /></div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-wide">Advance Recovery Limit Alert</h3>
                                    <p className="text-xs text-amber-100 mt-1 font-medium">As per Code on Wages 2020, total deductions generally should not exceed 50% of wages.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-[#0f172a] max-h-60 overflow-y-auto custom-scrollbar">
                            <p className="text-xs text-slate-400 mb-4">Advance recovery for the following employees is above 50% of Code Gross Wages:</p>
                            <table className="w-full text-left text-xs">
                                <thead className="text-slate-500 uppercase font-bold border-b border-slate-700">
                                    <tr>
                                        <th className="pb-2">Employee</th>
                                        <th className="pb-2 text-right">Code Gross</th>
                                        <th className="pb-2 text-right text-amber-400">Proposed</th>
                                        <th className="pb-2 text-right text-emerald-400">50% Limit</th>
                                    </tr>
                                </thead>
                                <tbody className="text-slate-300 divide-y divide-slate-800">
                                    {complianceConflicts.map((c: any) => (
                                        <tr key={c.employeeId}>
                                            <td className="py-2">
                                                <span className="font-bold text-white">{c.name}</span><br />
                                                <span className="text-slate-500 text-[10px]">{c.employeeId}</span>
                                            </td>
                                            <td className="py-2 text-right font-mono">{c.codeGross.toLocaleString()}</td>
                                            <td className="py-2 text-right font-mono text-amber-400 font-bold">{c.proposed.toLocaleString()}</td>
                                            <td className="py-2 text-right font-mono text-emerald-400">{c.limit.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 bg-[#1e293b] border-t border-slate-800 flex flex-col gap-4">
                            <div className="flex gap-3">
                                <button onClick={() => executeCalculation(true)} title="Restrict advance recovery to 50% limit" aria-label="Restrict advance recovery to 50% limit" className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2">
                                    <CheckCircle size={16} /> Restrict to 50%
                                </button>
                                <button onClick={() => executeCalculation(false)} title="Ignore limit and deduct full advance" aria-label="Ignore limit and deduct full advance" className="flex-1 py-3 border border-amber-600 text-amber-400 hover:bg-amber-900/20 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                                    <HandCoins size={16} /> Ignore & Deduct Full
                                </button>
                            </div>
                            <p className="text-[9px] text-center text-slate-500">Note: Even if 'Ignore' is selected, deduction will be automatically capped at Code Gross Wages to prevent negative Net Pay.</p>
                        </div>
                    </div>
                </div>
            )}

            {modalState.isOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"><div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative"><button title="Close Modal" aria-label="Close Modal" onClick={() => setModalState({ ...modalState, isOpen: false })} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button><div className="flex flex-col items-center gap-2"><div className={`p-3 rounded-full border ${modalState.type === 'error' ? 'bg-red-900/30 text-red-500 border-red-900/50' : modalState.type === 'success' ? 'bg-emerald-900/30 text-emerald-500 border-emerald-900/50' : 'bg-blue-900/30 text-blue-500 border-blue-900/50'}`}>{modalState.type === 'error' ? <AlertTriangle size={24} /> : modalState.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}</div><h3 className="text-lg font-bold text-white text-center">{modalState.title}</h3><div className="text-sm text-slate-400 text-center w-full">{modalState.message}</div></div><div className="flex gap-3 mt-4"><button onClick={() => setModalState({ ...modalState, isOpen: false })} title="Close" aria-label="Close" className="w-full py-2.5 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition-colors">Close</button></div></div></div>
            )}

            {previewRecord && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl flex flex-col relative text-slate-900">
                        <div className="sticky top-0 bg-slate-100 border-b border-slate-200 p-4 flex justify-between items-center z-10"><h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText size={18} className="text-blue-600" /> Pay Slip Preview</h3><button title="Close Preview" aria-label="Close Preview" onClick={() => setPreviewRecord(null)} className="p-2 hover:bg-red-100 text-slate-500 hover:text-red-500 rounded-full transition-colors"><X size={20} /></button></div>
                        <div className="p-8 space-y-6 print:p-0">
                            <div className="text-center space-y-1 border-b-2 border-slate-800 pb-4"><h2 className="text-2xl font-black text-slate-900 uppercase">{companyProfile.establishmentName}</h2><p className="text-xs text-slate-600 font-medium whitespace-pre-wrap px-12">{[companyProfile.doorNo, companyProfile.buildingName, companyProfile.street, companyProfile.area, companyProfile.city, companyProfile.state, companyProfile.pincode].filter(Boolean).join(', ')}</p><h3 className="text-lg font-bold text-slate-800 mt-2 uppercase underline decoration-2 underline-offset-4 decoration-slate-400">Pay Slip - {month} {year}</h3></div>
                            {(() => {
                                const emp = employees.find(e => e.id === previewRecord.employeeId);
                                if (!emp) return null;
                                const r = previewRecord;
                                const special = (r?.earnings?.special1 || 0) + (r?.earnings?.special2 || 0) + (r?.earnings?.special3 || 0);
                                const other = (r?.earnings?.washing || 0) + (r?.earnings?.attire || 0);
                                let isPropPFCapped = r.isProportionatePFCapped;
                                if (isPropPFCapped === undefined) {
                                    const dMonth = r.daysInMonth || 30;
                                    if (r.payableDays > 0 && r.payableDays < dMonth && (r?.deductions?.epf || 0) > 0) {
                                        const proratedCeil = Math.round((15000 / dMonth) * r.payableDays);
                                        const expectedEPFDed = Math.round(proratedCeil * 0.12);
                                        const standardBase = (r?.earnings?.basic || 0) + (r?.earnings?.da || 0) + (r?.earnings?.retainingAllowance || 0);
                                        if (r.deductions.epf === expectedEPFDed && standardBase > proratedCeil) {
                                            isPropPFCapped = true;
                                        }
                                    }
                                }
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
                                    <div className="border border-slate-800"><div className="grid grid-cols-4 bg-slate-800 text-white text-xs font-bold uppercase text-center divide-x divide-slate-600"><div className="p-2">Earnings</div><div className="p-2">Amount (₹)</div><div className="p-2">Deductions</div><div className="p-2">Amount (₹)</div></div><div className="grid grid-cols-4 text-xs divide-x divide-slate-300"><div className="space-y-1 p-2"><div className="text-slate-600">Basic Pay</div><div className="text-slate-600">DA</div><div className="text-slate-600">Retaining Allw</div><div className="text-slate-600">HRA</div><div className="text-slate-600">Conveyance</div><div className="text-slate-600">Overtime Pay</div><div className="text-slate-600">Special Allw</div><div className="text-slate-600">Other Allw</div><div className="text-slate-600">Leave Encash</div></div><div className="space-y-1 p-2 text-right font-mono text-slate-900"><div>{(r?.earnings?.basic || 0).toFixed(2)}</div><div>{(r?.earnings?.da || 0).toFixed(2)}</div><div>{(r?.earnings?.retainingAllowance || 0).toFixed(2)}</div><div>{(r?.earnings?.hra || 0).toFixed(2)}</div><div>{(r?.earnings?.conveyance || 0).toFixed(2)}</div><div className="font-bold text-blue-600">{(r?.earnings?.otAmount || 0).toFixed(2)}</div><div>{special.toFixed(2)}</div><div>{other.toFixed(2)}</div><div>{(r?.earnings?.leaveEncashment || 0).toFixed(2)}</div></div><div className="space-y-1 p-2"><div className="text-slate-600">Provident Fund {r.isCode88 ? '*' : ''}{isPropPFCapped ? <span className="text-[#000080] font-bold"> #</span> : ''}</div><div className="text-slate-600">ESI {r.isESICodeWagesUsed ? '**' : ''}</div><div className="text-slate-600">Professional Tax</div><div className="text-slate-600">Income Tax</div><div className="text-slate-600">VPF</div><div className="text-slate-600">LWF</div><div className="text-slate-600">Adv Recovery</div><div className="text-red-600 font-bold">Fine / Damages</div></div><div className="space-y-1 p-2 text-right font-mono text-slate-900"><div>{(r?.deductions?.epf || 0).toFixed(2)}</div><div>{(r?.deductions?.esi || 0).toFixed(2)}</div><div>{(r?.deductions?.pt || 0).toFixed(2)}</div><div>{(r?.deductions?.it || 0).toFixed(2)}</div><div>{(r?.deductions?.vpf || 0).toFixed(2)}</div><div>{(r?.deductions?.lwf || 0).toFixed(2)}</div><div>{(r?.deductions?.advanceRecovery || 0).toFixed(2)}</div><div className="text-red-600 font-bold">{(r?.deductions?.fine || 0).toFixed(2)}</div></div></div><div className="grid grid-cols-4 bg-slate-100 border-t border-slate-800 text-xs font-bold divide-x divide-slate-300"><div className="p-2 text-slate-800">Gross Earnings</div><div className="p-2 text-right text-slate-900">{(r?.earnings?.total || 0).toFixed(2)}</div><div className="p-2 text-slate-800">Total Deductions</div><div className="p-2 text-right text-slate-900">{(r?.deductions?.total || 0).toFixed(2)}</div></div></div>
                                    <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 flex flex-col md:flex-row justify-between items-center gap-4"><div><p className="text-xs font-bold text-blue-800 uppercase tracking-widest">Net Salary Payable</p><p className="text-[10px] text-blue-600 italic mt-1 max-w-sm">{numberToWords(Math.round(r?.netPay || 0))} Rupees Only</p></div><div className="text-3xl font-black text-blue-900">₹ {Math.round(r?.netPay || 0).toLocaleString('en-IN')}</div></div>
                                    <div className="text-[10px] text-slate-400 space-y-1 pt-4 border-t border-slate-200">{r.isCode88 && <p>* PF calculated on Code Wages (Social Security Code 2020)</p>}{r.isESICodeWagesUsed && <p>** ESI calculated on Code Wages (Social Security Code 2020)</p>}{isPropPFCapped && <p className="text-[#000080] font-bold italic"># Proportionate Wages(15000*days worked/actual days of the month) considered for PF Calculation due to Non Contribution Days (NCP)</p>}{r.esiRemark && <p className="text-amber-600 font-bold">{r.esiRemark}</p>}<p className="text-center italic mt-4">This is a computer-generated document and does not require a signature.</p></div></>
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
