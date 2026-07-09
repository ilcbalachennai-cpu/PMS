
import React, { useState, useEffect, useMemo } from 'react';
import { Save, RefreshCw, Lock, FileText, Eye, AlertCircle, AlertTriangle, X, CheckCircle, Download, Scale, HandCoins, Users, Calculator, Settings, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, PayrollResult, StatutoryConfig, CompanyProfile, Attendance, LeaveLedger, AdvanceLedger, User, FineRecord, OTRecord, ArrearBatch, View, SettingsTab, LicenseData } from '../types';
import { calculatePayroll } from '../services/payrollEngine';
import { numberToWords, formatDateInd, generateExcelWorkbook, getStandardFileName, openSavedReport, appendSummaryRowToExcelData } from '../services/reportService';
import { formatIndianNumber, didConfigCalculationFieldsChange, didEmployeePayFieldsChange } from '../utils/formatters';
import { ModalType } from './Shared/CustomModal';
import { getActivePaySheetColumns } from '../constants';

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
    arrearHistory?: ArrearBatch[];
    showAlert?: (type: ModalType, title: string, message: string, onConfirm?: () => void, onSecondary?: () => void, confirmLabel?: string, secondaryLabel?: string, cancelLabel?: string, autoCloseSecs?: number) => void;
    onNavigate?: (view: View) => void;
    setSettingsTab?: (tab: SettingsTab) => void;
    licenseInfo?: LicenseData;
    attendanceJustSaved?: boolean;
    advanceJustSaved?: boolean;
    fineJustSaved?: boolean;
    otJustSaved?: boolean;
    onSwitchTab?: (tab: 'attendance' | 'ledgers' | 'fines' | 'overtime' | 'arrears' | 'payroll') => void;
    setEmployees?: React.Dispatch<React.SetStateAction<Employee[]>>;
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
    otRecords = [],
    arrearHistory = [],
    showAlert,
    onNavigate,
    setSettingsTab,
    licenseInfo,
    attendanceJustSaved,
    advanceJustSaved,
    fineJustSaved,
    otJustSaved,
    onSwitchTab,
    setEmployees
}) => {
    const [results, setResults] = useState<PayrollResult[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [previewRecord, setPreviewRecord] = useState<PayrollResult | null>(null);
    const [masterDataChanged, setMasterDataChanged] = useState(false);
    const [dataIsStale, setDataIsStale] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const hasAnyUnsavedTab =
        attendanceJustSaved === false ||
        advanceJustSaved === false ||
        fineJustSaved === false ||
        (config.enableOT && otJustSaved === false);

    const handleNavigateToSettings = () => {
        localStorage.setItem('settings_initial_tab', SettingsTab.Statutory);
        localStorage.setItem('settings_initial_tab_force', SettingsTab.Statutory);
        setSettingsTab?.(SettingsTab.Statutory);
        if (onNavigate) {
            onNavigate(View.Settings);
        }
    };

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
        const tempKey = `app_temp_payroll_${companyProfile.id}_${month}_${year}`;
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

    }, [month, year, savedRecords, companyProfile.id, config]);

    useEffect(() => {
        const tempKey = `app_temp_payroll_${companyProfile.id}_${month}_${year}`;
        if (!isSaved && results.length > 0) {
            localStorage.setItem(tempKey, JSON.stringify(results));
        }
    }, [results, isSaved, month, year]);

    const initialEmployees = useMemo(() => {
        const employeesKey = `app_calc_employees_${companyProfile.id}_${month}_${year}`;
        const stored = localStorage.getItem(employeesKey);
        if (stored) {
            try {
                return JSON.parse(stored) as Employee[];
            } catch (e) {
                return null;
            }
        }
        return null;
    }, [companyProfile.id, month, year, results.length]);

    useEffect(() => {
        if (results.length > 0 && !isLocked) {
            if (initialEmployees === null) {
                setMasterDataChanged(true);
                setIsSaved(false);
            } else {
                let payAffected = false;
                for (const emp of activeEmployees) {
                    const original = initialEmployees.find(e => e.id === emp.id);
                    if (!original || didEmployeePayFieldsChange(original, emp)) {
                        payAffected = true;
                        break;
                    }
                }
                if (!payAffected) {
                    for (const orig of initialEmployees) {
                        const current = activeEmployees.find(e => e.id === orig.id);
                        if (!current) {
                            payAffected = true;
                            break;
                        }
                    }
                }

                if (payAffected) {
                    setMasterDataChanged(true);
                    setIsSaved(false);
                } else {
                    setMasterDataChanged(false);
                }
            }
        } else {
            setMasterDataChanged(false);
        }
    }, [activeEmployees, initialEmployees, results.length, isLocked]);

    const prevAttendancesRef = React.useRef(attendances);
    const prevAdvancesRef = React.useRef(advanceLedgers);
    const prevFinesRef = React.useRef(fines);
    const prevOtRecordsRef = React.useRef(otRecords);
    const prevArrearHistoryRef = React.useRef(arrearHistory);
    const prevConfigRef = React.useRef(config);

    useEffect(() => {
        if (results.length > 0 && !isLocked) {
            const configKey = `app_calc_config_${companyProfile.id}_${month}_${year}`;
            const storedConfig = localStorage.getItem(configKey);

            let storedConfigObj = null;
            if (storedConfig) {
                try {
                    storedConfigObj = JSON.parse(storedConfig);
                } catch (e) {
                    storedConfigObj = null;
                }
            }
            const configChanged =
                didConfigCalculationFieldsChange(prevConfigRef.current, config) ||
                (storedConfigObj ? didConfigCalculationFieldsChange(storedConfigObj, config) : false);

            const dataChanged =
                prevAttendancesRef.current !== attendances ||
                prevAdvancesRef.current !== advanceLedgers ||
                prevFinesRef.current !== fines ||
                prevOtRecordsRef.current !== otRecords ||
                prevArrearHistoryRef.current !== arrearHistory ||
                configChanged;

            if (dataChanged) {
                setDataIsStale(true);
            }
        }
        prevAttendancesRef.current = attendances;
        prevAdvancesRef.current = advanceLedgers;
        prevFinesRef.current = fines;
        prevOtRecordsRef.current = otRecords;
        prevArrearHistoryRef.current = arrearHistory;
        prevConfigRef.current = config;
    }, [attendances, advanceLedgers, fines, otRecords, arrearHistory, config, results.length, isLocked, companyProfile.id, month, year]);



    const checkAgeMaturity = () => {
        const unconfigured58: Employee[] = [];
        const unconfigured60: Employee[] = [];
        const monthIndex = months.indexOf(month);
        activeEmployees.forEach(emp => {
            if (!emp.dob || emp.isPFExempt) return;
            const dob = new Date(emp.dob);
            const periodEnd = new Date(year, monthIndex + 1, 0);

            // Calculate age at the end of the processing month
            let empAge = periodEnd.getFullYear() - dob.getFullYear();
            const m = periodEnd.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && periodEnd.getDate() < dob.getDate())) {
                empAge--;
            }

            // Checks for age groups
            if (empAge >= 60) {
                const isConfigured = !!emp.isPFExempt || (!!emp.epsMaturityConfigured && emp.epsMaturityConfiguredAge !== 58);
                if (!isConfigured) {
                    unconfigured60.push(emp);
                }
            } else if (empAge >= 58 && empAge < 60) {
                const isConfigured = !!emp.epsMaturityConfigured || !!emp.isDeferredPension || !!emp.isPFExempt;
                if (!isConfigured) {
                    unconfigured58.push(emp);
                }
            }
        });

        if (unconfigured58.length > 0 || unconfigured60.length > 0) {
            setModalState({
                isOpen: true,
                type: 'error',
                title: 'Action Required: Statutory Settings Check (Age 58+ / 60+)',
                message: (
                    <div className="text-left text-sm space-y-4 text-slate-300">
                        {unconfigured58.length > 0 && (
                            <div className="space-y-2">
                                <p className="font-bold text-amber-400">The following employees have crossed the age of 58. EPS contributions must stop or be deferred.</p>
                                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 max-h-32 overflow-y-auto custom-scrollbar">
                                    <ul className="space-y-1">
                                        {unconfigured58.map(e => (
                                            <li key={e.id} className="flex justify-between items-center text-xs">
                                                <span className="text-white font-semibold">{e.name}</span>
                                                <span className="text-slate-400 font-mono">DOB: {formatDateInd(e.dob)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {unconfigured60.length > 0 && (
                            <div className="space-y-2">
                                <p className="font-bold text-red-400">The following employees have crossed the age of 60. You must select Statutory option 7.A (PF Exempted) or 7.C (Only PF Contribution Allowed).</p>
                                <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 max-h-32 overflow-y-auto custom-scrollbar">
                                    <ul className="space-y-1">
                                        {unconfigured60.map(e => (
                                            <li key={e.id} className="flex justify-between items-center text-xs">
                                                <span className="text-white font-semibold">{e.name}</span>
                                                <span className="text-slate-400 font-mono">DOB: {formatDateInd(e.dob)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 space-y-2">
                            <p className="font-bold text-sky-400 text-xs uppercase flex items-center gap-2"><AlertTriangle size={12} /> Steps to Resolve</p>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                Go to <b>Employee Master &gt; Edit Employee &gt; Statutory Options</b> and save their statutory options (either Option 7.A, 7.B, or 7.C).
                            </p>
                        </div>
                        <p className="text-xs text-center text-red-400 font-bold mt-2">Payroll processing is blocked until settings are updated.</p>
                    </div>
                ),
            });
            return false;
        }
        return true;
    };

    const executeCalculation = (restrictedMode = false, silent = false) => {
        setIsProcessing(true);
        setTimeout(() => {
            try {
                const calculatedResults = activeEmployees.map(emp => {
                    const attendance = attendances.find(a => a.employeeId === emp.id && a.month === month && a.year === year) || { employeeId: emp.id, month, year, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 };
                    const leave = leaveLedgers.find(l => l.employeeId === emp.id) || { employeeId: emp.id, el: { opening: 0, eligible: 0, encashed: 0, availed: 0, balance: 0 }, sl: { eligible: 0, availed: 0, balance: 0 }, cl: { availed: 0, accumulation: 0, balance: 0 } };
                    const advance = advanceLedgers.find(a => a.employeeId === emp.id) || { employeeId: emp.id, opening: 0, totalAdvance: 0, monthlyInstallment: 0, paidAmount: 0, balance: 0, emiCount: 0, manualPayment: 0, recovery: 0 };

                    const shouldRestrict = restrictedMode && complianceConflicts.some(c => c.employeeId === emp.id);
                    const otRecord = otRecords.find(r => r.employeeId === emp.id && r.month === month && r.year === year) || null;

                    return calculatePayroll(emp, config, attendance, leave, advance, month, year, { restrictTo50Percent: shouldRestrict }, fines, otRecord, 0, savedRecords);
                });
                const isRecalc = results.length > 0;
                setResults(calculatedResults);
                setIsSaved(false);
                setMasterDataChanged(false); // Clear the warning on successful calculation
                setDataIsStale(false); // Reset stale state on successful calculation

                const configKey = `app_calc_config_${companyProfile.id}_${month}_${year}`;
                localStorage.setItem(configKey, JSON.stringify(config));
                const employeesKey = `app_calc_employees_${companyProfile.id}_${month}_${year}`;
                localStorage.setItem(employeesKey, JSON.stringify(activeEmployees));

                // Update refs to current values to prevent immediate stale state trigger
                prevAttendancesRef.current = attendances;
                prevAdvancesRef.current = advanceLedgers;
                prevFinesRef.current = fines;
                prevOtRecordsRef.current = otRecords;
                prevArrearHistoryRef.current = arrearHistory;
                prevConfigRef.current = config;

                setComplianceConflicts([]); // Clear conflicts after resolution
                setShowComplianceModal(false);

                if (!silent) {
                    setModalState({
                        isOpen: true,
                        type: 'success',
                        title: isRecalc ? 'Recalculation Applied Successfully' : 'Payroll Calculation Completed',
                        message: isRecalc 
                            ? `Pay data for ${month} ${year} has been updated with the latest inputs and statutory configurations.`
                            : `Payroll calculation for ${month} ${year} completed successfully.`
                    });
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsProcessing(false);
            }
        }, silent ? 0 : 800);
    };

    const handleCalculate = () => {
        if (isLocked || companyProfile.isReadOnly) return;

        if (hasAnyUnsavedTab) {
            const unsavedTabs: { name: string; key: 'attendance' | 'ledgers' | 'fines' | 'overtime' }[] = [];
            if (attendanceJustSaved === false) unsavedTabs.push({ name: '1. Attendance', key: 'attendance' });
            if (advanceJustSaved === false) unsavedTabs.push({ name: '2. Advances', key: 'ledgers' });
            if (fineJustSaved === false) unsavedTabs.push({ name: '3. Tax & Fines', key: 'fines' });
            if (config.enableOT && otJustSaved === false) unsavedTabs.push({ name: '4. Overtime', key: 'overtime' });

            setModalState({
                isOpen: true,
                type: 'error',
                title: 'Unsaved Tab Data Warning',
                message: (
                    <div className="text-left space-y-3">
                        <p className="text-xs font-bold text-amber-400 uppercase tracking-tight">
                            The following module tab(s) are in an unsaved condition:
                        </p>
                        <ul className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/80 space-y-2 shadow-inner">
                            {unsavedTabs.map(tab => (
                                <li key={tab.key} className="flex items-center justify-between text-xs font-bold text-white py-1.5 px-2.5 rounded bg-slate-800/40 border border-slate-700/50">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                                        {tab.name}
                                    </span>
                                    {onSwitchTab && (
                                        <button
                                            onClick={() => {
                                                setModalState(prev => ({ ...prev, isOpen: false }));
                                                onSwitchTab(tab.key);
                                            }}
                                            className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded font-bold transition-all shadow font-mono uppercase"
                                        >
                                            Go to Tab →
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                        <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                            Please navigate to the indicated tab(s) and click <strong className="text-emerald-400">'Save'</strong> to save your changes before applying Calculate / Recalculate.
                        </p>
                    </div>
                )
            });
            return;
        }

        // --- SEQUENTIAL PROCESSING CHECK REMOVED AS PER USER REQUEST ---
        // (Previously added sequence enforcement was too restrictive)

        // VALIDATION: Check for "Total Days > Days in Month"

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
            // Check for LOP employees who have returned to work (attendance > 0)
            const employeesToRestore = activeEmployees.filter(emp => {
                if ((emp.leavingReason || '').trim().toUpperCase() === 'ON LOP') {
                    const att = attendances.find(a => a.employeeId === emp.id && a.month === month && a.year === year);
                    if (att && ((att.presentDays || 0) + (att.earnedLeave || 0) + (att.casualLeave || 0) + (att.sickLeave || 0) > 0)) {
                        return true;
                    }
                }
                return false;
            });

            if (employeesToRestore.length > 0) {
                const restoredIds = new Set(employeesToRestore.map(e => e.id));
                // Update the master employee list to permanently clear LOP status
                if (setEmployees) {
                    setEmployees(prev => prev.map(emp => {
                        if (restoredIds.has(emp.id)) {
                            return { ...emp, leavingReason: '' };
                        }
                        return emp;
                    }));
                }
            }

            // Map over activeEmployees, overriding properties for restored ones so the current run is accurate
            const processedActiveEmployees = activeEmployees.map(emp => {
                if (employeesToRestore.some(e => e.id === emp.id)) {
                    return { ...emp, leavingReason: '' };
                }
                return emp;
            });

            const initialResults = processedActiveEmployees.map(emp => {
                const attendance = attendances.find(a => a.employeeId === emp.id && a.month === month && a.year === year) || { employeeId: emp.id, month, year, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0 };
                const leave = leaveLedgers.find(l => l.employeeId === emp.id) || { employeeId: emp.id, el: { opening: 0, eligible: 0, encashed: 0, availed: 0, balance: 0 }, sl: { eligible: 0, availed: 0, balance: 0 }, cl: { availed: 0, accumulation: 0, balance: 0 } };
                const advance = advanceLedgers.find(a => a.employeeId === emp.id) || { employeeId: emp.id, opening: 0, totalAdvance: 0, monthlyInstallment: 0, paidAmount: 0, balance: 0, emiCount: 0, manualPayment: 0, recovery: 0 };
                const otRecord = otRecords.find(r => r.employeeId === emp.id && r.month === month && r.year === year) || null;

                return calculatePayroll(emp, config, attendance, leave, advance, month, year, { restrictTo50Percent: false }, fines, otRecord, 0, savedRecords);
            });

            // CHECK CONDITION B: Advance > 50% of Code_Gross_Wages
            const conflicts: any[] = [];
            initialResults.forEach(r => {
                const emp = processedActiveEmployees.find(e => e.id === r.employeeId);
                if (!emp) return;

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
                const isRecalc = results.length > 0;
                setResults(initialResults);
                setIsSaved(false);
                setMasterDataChanged(false); // Clear the warning on successful calculation
                setDataIsStale(false); // Reset stale state on successful calculation

                // --- NEW: Trigger Activation if not already activated ---
                if (companyProfile.companySignature && (window as any).electronAPI?.getActivatedSilos && (window as any).electronAPI?.registerActivatedSilo) {
                    (window as any).electronAPI.getActivatedSilos().then((res: any) => {
                        if (res?.success && !res.silos.includes(companyProfile.companySignature!)) {
                            (window as any).electronAPI.registerActivatedSilo(companyProfile.companySignature!);
                            console.log(`[Activation] Registered silo signature: ${companyProfile.companySignature}`);
                        }
                    });
                }

                const configKey = `app_calc_config_${companyProfile.id}_${month}_${year}`;
                localStorage.setItem(configKey, JSON.stringify(config));
                const employeesKey = `app_calc_employees_${companyProfile.id}_${month}_${year}`;
                localStorage.setItem(employeesKey, JSON.stringify(activeEmployees));

                // Update refs to current values to prevent immediate stale state trigger
                prevAttendancesRef.current = attendances;
                prevAdvancesRef.current = advanceLedgers;
                prevFinesRef.current = fines;
                prevOtRecordsRef.current = otRecords;
                prevArrearHistoryRef.current = arrearHistory;
                prevConfigRef.current = config;

                setIsProcessing(false);

                setModalState({
                    isOpen: true,
                    type: 'success',
                    title: isRecalc ? 'Recalculation Applied Successfully' : 'Payroll Calculation Completed',
                    message: isRecalc 
                        ? `Pay data for ${month} ${year} has been updated with the latest inputs and statutory configurations.`
                        : `Payroll calculation for ${month} ${year} completed successfully.`
                });
            }
        }, 500);
    };

    const handleSaveDraft = () => {
        if (results.length === 0 || isLocked) return;

        // Clear temp storage for this period as we are committing it
        const tempKey = `app_temp_payroll_${companyProfile.id}_${month}_${year}`;
        localStorage.removeItem(tempKey);

        const configKey = `app_calc_config_${companyProfile.id}_${month}_${year}`;
        localStorage.setItem(configKey, JSON.stringify(config));
        const employeesKey = `app_calc_employees_${companyProfile.id}_${month}_${year}`;
        localStorage.setItem(employeesKey, JSON.stringify(activeEmployees));

        const otherRecords = savedRecords.filter(r => !(r.month === month && r.year === year));
        const newRecords = results.map(r => ({ ...r, status: 'Draft' as const }));
        setSavedRecords([...otherRecords, ...newRecords]);
        setIsSaved(true);
        setMasterDataChanged(false);
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
                [companyProfile?.specialAllowance1Name || 'Special Allw 1']: r?.earnings?.special1 || 0,
                [companyProfile?.specialAllowance2Name || 'Special Allw 2']: r?.earnings?.special2 || 0,
                [companyProfile?.specialAllowance3Name || 'Special Allw 3']: r?.earnings?.special3 || 0,

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

        // Filter out blank columns (where all employees have 0 or '')
        const keys = Object.keys(data[0] || {});
        const alwaysKeep = ['Employee ID', 'Name', 'Designation', 'Department', 'Total Days', 'Paid Days', 'Basic Pay', 'Gross Earnings', 'Total Deductions', 'Net Pay'];
        
        keys.forEach(key => {
            if (alwaysKeep.includes(key)) return;
            
            const hasData = data.some(row => row[key as keyof typeof row] !== 0 && row[key as keyof typeof row] !== '' && row[key as keyof typeof row] !== null && row[key as keyof typeof row] !== undefined);
            
            if (!hasData) {
                data.forEach(row => {
                    delete (row as any)[key];
                });
            }
        });
        const summaryData = appendSummaryRowToExcelData(data);
        const ws = XLSX.utils.json_to_sheet(summaryData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Draft Payroll");
        const fileName = getStandardFileName('Draft_Payroll', companyProfile, month, year);
        const savedPath = await generateExcelWorkbook(wb, fileName, companyProfile.establishmentName);

        if (savedPath && showAlert) {
            showAlert(
                'success',
                'Draft Generated',
                `Draft Payroll sheet for ${month} ${year} has been exported to your Report files folder.`,
                () => openSavedReport(savedPath),
                undefined,
                'Open Report & Folder',
                undefined,
                undefined,
                2
            );
        } else if (!savedPath && showAlert) {
            const filename = (window as any).lastGeneratedFileName || 'the file';
            showAlert('error', 'Export Failed', `Similar file is already open, close "${filename}" to generate the new report`);
        }
    };

    const totalNet = results.reduce((acc, curr) => acc + (curr?.netPay || 0), 0);
    const totalGross = results.reduce((acc, curr) => acc + (curr?.earnings?.total || 0), 0);
    const totalDed = results.reduce((acc, curr) => acc + (curr?.deductions?.total || 0), 0);

    const activeCount = results.length;
    const presentCount = results.filter(r => r.payableDays > 0).length;
    const absentCount = activeCount - presentCount;

    // --- AGGREGATE TOTALS FOR TABLE SUMMARY ---
    // const tableTotals = useMemo(() => {
    //     return results.reduce((acc, r) => ({
    //         days: acc.days + (r.payableDays || 0),
    //         basic: acc.basic + (r.earnings.basic || 0),
    //         da: acc.da + (r.earnings.da || 0),
    //         leaveEncash: acc.leaveEncash + (r.earnings.leaveEncashment || 0),
    //         others: acc.others + ((r?.earnings?.total || 0) - ((r?.earnings?.basic || 0) + (r?.earnings?.da || 0) + (r?.earnings?.leaveEncashment || 0))),
    //         gross: acc.gross + (r.earnings.total || 0),
    //         pf: acc.pf + (r.deductions.epf || 0),
    //         esi: acc.esi + (r.deductions.esi || 0),
    //         ptTds: acc.ptTds + ((r.deductions.pt || 0) + (r.deductions.it || 0)),
    //         advance: acc.advance + (r.deductions.advanceRecovery || 0),
    //         dedn: acc.dedn + (r.deductions.total || 0),
    //         net: acc.net + (r.netPay || 0)
    //     }), { days: 0, basic: 0, da: 0, leaveEncash: 0, others: 0, gross: 0, pf: 0, esi: 0, ptTds: 0, advance: 0, dedn: 0, net: 0 });
    // }, [results]);

    const filteredResults = useMemo(() => {
        return results.filter(r => {
            if (isSaved && r.netPay === 0) return false;
            if (!searchTerm.trim()) return true;
            const term = searchTerm.toLowerCase().trim();
            const emp = employees.find(e => e.id === r.employeeId);
            const nameMatch = emp?.name?.toLowerCase().includes(term) || false;
            const idMatch = r.employeeId?.toLowerCase().includes(term) || false;
            return nameMatch || idMatch;
        });
    }, [results, employees, searchTerm, isSaved]);

    // Dynamic Columns Definition
    const activeColumns = useMemo(() => {
        return getActivePaySheetColumns(results, config);
    }, [results, config]);

    const columnMap = useMemo(() => ({
        days: { label: 'Days', className: 'text-center text-slate-100', value: (r: PayrollResult) => r.payableDays },
        basic: { label: 'Basic', className: 'text-right text-slate-100', value: (r: PayrollResult) => Math.round(r?.earnings?.basic || 0) },
        da: { label: 'DA', className: 'text-right text-slate-100', value: (r: PayrollResult) => Math.round(r?.earnings?.da || 0) },
        retaining: { label: 'Retain', className: 'text-right text-slate-100', value: (r: PayrollResult) => Math.round(r?.earnings?.retainingAllowance || 0) },
        hra: { label: 'HRA', className: 'text-right text-slate-100', value: (r: PayrollResult) => Math.round(r?.earnings?.hra || 0) },
        conveyance: { label: 'Conv', className: 'text-right text-slate-100', value: (r: PayrollResult) => Math.round(r?.earnings?.conveyance || 0) },
        washing: { label: 'Wash', className: 'text-right text-slate-100', value: (r: PayrollResult) => Math.round(r?.earnings?.washing || 0) },
        attire: { label: 'Attire', className: 'text-right text-slate-100', value: (r: PayrollResult) => Math.round(r?.earnings?.attire || 0) },
        special1: { label: companyProfile?.specialAllowance1Name || 'Spl 1', className: 'text-right text-slate-100', value: (r: PayrollResult) => Math.round(r?.earnings?.special1 || 0) },
        others: { 
            label: 'Others', 
            className: 'text-right text-slate-300', 
            value: (r: PayrollResult) => {
                const earningsKeys = ['basic', 'da', 'retaining', 'hra', 'conveyance', 'washing', 'attire', 'special1', 'special2', 'special3', 'bonus', 'leaveEncashment', 'otAmount', 'arrears'];
                const displayedEarningsKeys = earningsKeys.filter(k => activeColumns.includes(k));
                const sumOfDisplayed = displayedEarningsKeys.reduce((acc, k) => {
                    const val = r?.earnings?.[k as keyof typeof r.earnings] || 0;
                    return acc + val;
                }, 0);
                return Math.round((r?.earnings?.total || 0) - sumOfDisplayed);
            }
        },
        special2: { label: companyProfile?.specialAllowance2Name || 'Spl 2', className: 'text-right text-slate-100', value: (r: PayrollResult) => Math.round(r?.earnings?.special2 || 0) },
        special3: { label: companyProfile?.specialAllowance3Name || 'Spl 3', className: 'text-right text-slate-100', value: (r: PayrollResult) => Math.round(r?.earnings?.special3 || 0) },
        bonus: { label: 'Bonus', className: 'text-right text-slate-100', value: (r: PayrollResult) => Math.round(r?.earnings?.bonus || 0) },
        leaveEncashment: { label: 'Leave', className: 'text-right text-slate-100', value: (r: PayrollResult) => Math.round(r?.earnings?.leaveEncashment || 0) },
        otAmount: { label: 'OT', className: 'text-right text-slate-100', value: (r: PayrollResult) => Math.round(r?.earnings?.otAmount || 0) },
        arrears: { label: 'Arrears', className: 'text-right text-slate-100', value: (r: PayrollResult) => Math.round(r?.earnings?.arrears || 0) },
        totalEarnings: { label: 'Gross', className: 'text-right text-white font-black', value: (r: PayrollResult) => Math.round(r?.earnings?.total || 0) },
        epf: { label: 'PF', className: 'text-right text-blue-300', value: (r: PayrollResult) => Math.round(r?.deductions?.epf || 0) },
        vpf: { label: 'VPF', className: 'text-right text-blue-300', value: (r: PayrollResult) => Math.round(r?.deductions?.vpf || 0) },
        esi: { label: 'ESI', className: 'text-right text-pink-300', value: (r: PayrollResult) => Math.round(r?.deductions?.esi || 0) },
        advanceRecovery: { label: 'ADV', className: 'text-right text-sky-300 font-black', value: (r: PayrollResult) => Math.round(r?.deductions?.advanceRecovery || 0) },
        pt_it: { label: 'PT/TDS', className: 'text-right text-amber-300', value: (r: PayrollResult) => Math.round((r?.deductions?.pt || 0) + (r?.deductions?.it || 0)) },
        pt: { label: 'PT', className: 'text-right text-amber-300', value: (r: PayrollResult) => Math.round(r?.deductions?.pt || 0) },
        it: { label: 'IT', className: 'text-right text-amber-300', value: (r: PayrollResult) => Math.round(r?.deductions?.it || 0) },
        lwf: { label: 'LWF', className: 'text-right text-slate-400', value: (r: PayrollResult) => Math.round(r?.deductions?.lwf || 0) },
        fine: { label: 'Fine', className: 'text-right text-red-300', value: (r: PayrollResult) => Math.round(r?.deductions?.fine || 0) },
        otherDeductions: { 
            label: 'Others', 
            className: 'text-right text-purple-300', 
            value: (r: PayrollResult) => {
                const deductionKeys = ['epf', 'vpf', 'esi', 'advanceRecovery', 'pt', 'lwf', 'it', 'fine'];
                const displayedDeductionKeys = deductionKeys.filter(k => activeColumns.includes(k));
                let sumOfDisplayed = displayedDeductionKeys.reduce((acc, k) => {
                    const val = r?.deductions?.[k as keyof typeof r.deductions] || 0;
                    return acc + val;
                }, 0);

                // Explicitly add grouped columns if they are displayed
                if (activeColumns.includes('pt_it')) {
                    sumOfDisplayed += (r?.deductions?.pt || 0) + (r?.deductions?.it || 0);
                }

                return Math.round((r?.deductions?.total || 0) - sumOfDisplayed);
            }
        },
        totalDeductions: { label: 'DEDN', className: 'text-right text-red-300', value: (r: PayrollResult) => Math.round(r?.deductions?.total || 0) },
        netPay: { label: 'Net Pay', className: 'text-right text-emerald-400 font-black bg-emerald-900/10', value: (r: PayrollResult) => Math.round(r?.netPay || 0) }
    }), [activeColumns, companyProfile]);

    const isSticky = config.enableDynamicPaySheet || false;

    const tableWrapperRef = React.useRef<HTMLDivElement>(null);
    const topScrollRef = React.useRef<HTMLDivElement>(null);
    const [tableWidth, setTableWidth] = React.useState(0);

    React.useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableWrapper = tableWrapperRef.current;

        if (!topScroll || !tableWrapper) return;

        const handleTopScroll = () => {
            tableWrapper.scrollLeft = topScroll.scrollLeft;
        };

        const handleTableScroll = () => {
            topScroll.scrollLeft = tableWrapper.scrollLeft;
        };

        topScroll.addEventListener('scroll', handleTopScroll);
        tableWrapper.addEventListener('scroll', handleTableScroll);

        const updateWidth = () => {
            setTableWidth(tableWrapper.scrollWidth);
        };

        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(tableWrapper);

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableWrapper.removeEventListener('scroll', handleTableScroll);
            observer.disconnect();
        };
    }, [results, activeColumns]);

    const earningsKeys = ['basic', 'da', 'retaining', 'hra', 'conveyance', 'washing', 'attire', 'special1', 'special2', 'special3', 'others', 'bonus', 'leaveEncashment', 'otAmount', 'arrears', 'totalEarnings'];
    const deductionKeys = ['epf', 'vpf', 'esi', 'advanceRecovery', 'pt', 'it', 'lwf', 'fine', 'otherDeductions', 'totalDeductions'];

    const earningsCount = activeColumns.filter(c => earningsKeys.includes(c)).length;
    const deductionCount = activeColumns.filter(c => deductionKeys.includes(c)).length;

    const beforeEarningsCount = (activeColumns.includes('days') ? 1 : 0) + 1; // +1 for Employee Identity
    
    const afterCount = activeColumns.filter(c => c === 'netPay').length + 1; // +1 for View

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {masterDataChanged && results.length > 0 && !isLocked && !companyProfile.isReadOnly && (
                <div className="bg-amber-900/20 border border-amber-600/50 p-4 rounded-xl flex items-center justify-between gap-4 animate-pulse">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-600 rounded-lg text-white shadow-lg shadow-amber-900/50">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-tight">Master Data Updated</h3>
                            <p className="text-amber-200 text-[10px] font-bold uppercase tracking-wider">EMPLOYEE MASTER RECORDS HAVE BEEN CHANGED AFFECTING THE PAY SHEET. CLICK RECALCULATE TO APPLY THE CHANGES.</p>
                        </div>
                    </div>
                    <button onClick={() => setMasterDataChanged(false)} title="Dismiss Warning" aria-label="Dismiss Warning" className="text-amber-400 hover:text-white transition-colors"><X size={18} /></button>
                </div>
            )}
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
                        (() => {
                            const configKey = `app_calc_config_${companyProfile.id}_${month}_${year}`;
                            const storedConfig = localStorage.getItem(configKey);
                            const isConfigStale = results.length > 0 && (!storedConfig || (() => {
                                try {
                                    return didConfigCalculationFieldsChange(JSON.parse(storedConfig), config);
                                } catch (e) {
                                    return false;
                                }
                            })());
                            const hasPendingChanges = hasAnyUnsavedTab || dataIsStale || masterDataChanged || isConfigStale;
                            const isCalculateDisabled = isProcessing || !hasAnyAttendance || (results.length > 0 && !hasPendingChanges) || companyProfile.isReadOnly;
                            const isSaveDraftDisabled = isSaved || !hasAnyAttendance || hasPendingChanges || results.length === 0 || companyProfile.isReadOnly;

                            return (
                                <>
                                    <button
                                        onClick={handleCalculate}
                                        disabled={isCalculateDisabled}
                                        title={!hasAnyAttendance ? "No attendance data found for this period" : (results.length > 0 ? (isCalculateDisabled ? "Recalculation in inactive mode until new changes or modifications are initiated" : "Recalculate Payroll with updated changes") : "Calculate Payroll")}
                                        aria-label="Calculate Payroll"
                                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[12px] rounded-lg transition-all shadow-lg shadow-blue-900/20 disabled:opacity-70 disabled:bg-slate-700 disabled:cursor-not-allowed"
                                    >
                                        {isProcessing ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                                        ) : (
                                            !hasAnyAttendance ? <AlertCircle size={15} className="text-amber-400 font-bold" /> : (companyProfile.isReadOnly ? <AlertCircle size={15} className="text-red-400" /> : <Calculator size={15} />)
                                        )}
                                        {companyProfile.isReadOnly ? 'Read-Only Mode' : (!hasAnyAttendance ? 'No Attendance Data' : (results.length > 0 ? 'ReCalculate Pay' : 'Calculate Pay'))}
                                    </button>
                                    {results.length > 0 && (
                                        <>
                                            <button
                                                onClick={handleSaveDraft}
                                                disabled={isSaveDraftDisabled}
                                                title={!hasAnyAttendance ? "Cannot save without attendance data" : (hasPendingChanges ? "New edits or statutory rule changes detected. Please Recalculate before saving draft." : (isSaved ? "Draft Already Saved" : "Save as Draft"))}
                                                aria-label={isSaved ? "Draft Already Saved" : "Save as Draft"}
                                                className={`flex items-center gap-1.5 px-4 py-2 font-bold text-[12px] rounded-lg shadow-lg transition-all ${isSaveDraftDisabled ? 'bg-emerald-900/20 text-emerald-500/50 border border-emerald-900/30 cursor-not-allowed grayscale-[0.5]' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20'}`}
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
                            );
                        })()
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
                        <div className="bg-[#1e293b] p-3 rounded-xl border border-slate-800 shadow-lg border-l-4 border-l-slate-600"><p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Total Gross</p><h3 className="text-xl font-black text-white">₹ {formatIndianNumber(totalGross)}</h3></div>
                        <div className="bg-[#1e293b] p-3 rounded-xl border border-slate-800 shadow-lg border-l-4 border-l-red-500/50"><p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Total Deductions</p><h3 className="text-xl font-black text-red-400">₹ {formatIndianNumber(totalDed)}</h3></div>
                        <div className="bg-[#1e293b] p-3 rounded-xl border border-slate-800 shadow-lg border-l-4 border-l-emerald-500/50 relative overflow-hidden"><div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div><p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Net Payable</p><h3 className="text-xl font-black text-emerald-400">₹ {formatIndianNumber(totalNet)}</h3></div>
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
                        <div className="ml-auto flex items-center gap-3">
                            <div className="relative flex items-center">
                                <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Filter by EMP / Name..."
                                    className="w-44 md:w-56 pl-8 pr-7 py-1.5 bg-slate-900/90 border border-slate-700/80 rounded-lg text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2 text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                                        title="Clear Search"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    if (!licenseInfo?.splDynamic) {
                                        showAlert?.('info', 'Premium Feature Locked', 'You need the premium access code to activate this feature. Please contact support to upgrade.');
                                    } else {
                                        handleNavigateToSettings();
                                    }
                                }}
                                title={!licenseInfo?.splDynamic ? "You need the premium access code to activate this feature" : (config.enableDynamicPaySheet ? "Change to Static PaySheet" : "Change to Dynamic PaySheet")}
                                className={`flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[12px] rounded-lg transition-all shadow-lg shadow-blue-900/20 ${!licenseInfo?.splDynamic ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                {!licenseInfo?.splDynamic ? <Lock size={14} className="text-amber-500" /> : <Settings size={14} className="text-white" />}
                                {config.enableDynamicPaySheet ? (
                                    <span>Dynamic PaySheet</span>
                                ) : (
                                    <span>Static PaySheet</span>
                                )}
                            </button>
                        </div>
                    </div>

                    {config.enableDynamicPaySheet && (
                        <div ref={topScrollRef} className="overflow-auto custom-scrollbar max-w-full bg-[#111827] rounded-lg border border-slate-800 p-1 mb-2">
                            <style>{`#top-scroll-inner { width: ${tableWidth}px; }`}</style>
                            <div id="top-scroll-inner" className="h-1"></div>
                        </div>
                    )}

                    <div ref={tableWrapperRef} className="bg-[#1e293b] rounded-xl border border-slate-800 shadow-2xl max-h-[600px] overflow-auto custom-scrollbar max-w-full">
                        <table className="min-w-full text-left border-collapse">
                            <thead className="bg-[#0f172a] text-sky-400 text-[10px] uppercase tracking-normal font-bold sticky top-0 z-20 shadow-md">
                                <tr className="border-b border-slate-800 text-[9px] uppercase tracking-wider text-slate-500">
                                    <th colSpan={beforeEarningsCount} className={`px-3 py-1 bg-[#0f172a] ${isSticky ? 'sticky left-0 z-30 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.5)]' : ''}`}></th>
                                    <th colSpan={earningsCount} className="px-2 py-1.5 text-center bg-[#0f172a]">
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <span className="font-black text-sky-400 tracking-widest text-[10px] uppercase">Pay Breakup</span>
                                            <div className="w-full h-[3px] bg-gradient-to-r from-sky-500 via-blue-500 to-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.6)]"></div>
                                        </div>
                                    </th>
                                    <th colSpan={deductionCount} className="px-2 py-1.5 text-center bg-[#0f172a]">
                                        <div className="flex flex-col items-center justify-center gap-1">
                                            <span className="font-black text-pink-400 tracking-widest text-[10px] uppercase">Deduction Breakup</span>
                                            <div className="w-full h-[3px] bg-gradient-to-r from-pink-500 via-rose-500 to-pink-400 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
                                        </div>
                                    </th>
                                    <th colSpan={afterCount} className={`px-2 py-1 bg-[#0f172a] ${isSticky ? 'sticky right-0 z-30 shadow-[-4px_0_4px_-4px_rgba(0,0,0,0.5)]' : ''}`}></th>
                                </tr>
                                <tr>
                                    <th className={`px-3 py-3 bg-[#0f172a] whitespace-nowrap ${isSticky ? 'sticky left-0 z-30 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.5)]' : ''}`}>Employee Identity</th>
                                    {activeColumns.map(colId => {
                                        const col = columnMap[colId as keyof typeof columnMap];
                                        if (!col) return null;
                                        // V03.01.07: Force Sky Blue for requested headers while maintaining alignment
                                        const isRequestedSkyBlue = ['days', 'basic', 'da', 'leaveEncashment'].includes(colId);
                                        const headerClassName = isRequestedSkyBlue 
                                            ? col.className.replace('text-slate-300', 'text-sky-400') 
                                            : col.className;
                                        
                                        return (
                                            <th key={colId} className={`px-1.5 py-3 bg-[#0f172a] whitespace-nowrap ${headerClassName}`}>
                                                {col.label}
                                            </th>
                                        );
                                    })}
                                    <th className={`px-2 py-3 text-center bg-[#0f172a] whitespace-nowrap ${isSticky ? 'sticky right-0 z-30 shadow-[-4px_0_4px_-4px_rgba(0,0,0,0.5)]' : ''}`}>View</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredResults.length === 0 ? (
                                    <tr>
                                        <td colSpan={activeColumns.length + 2} className="px-4 py-8 text-center text-slate-400 text-xs italic font-medium bg-[#1e293b]">
                                            No employee records found matching "{searchTerm}"
                                        </td>
                                    </tr>
                                ) : (
                                    filteredResults.map(r => {
                                        const emp = employees.find(e => e.id === r.employeeId);
                                        const isZeroAttendance = r.payableDays === 0;

                                        return (
                                            <tr key={r.employeeId} className={`group hover:bg-slate-800/50 transition-colors ${isZeroAttendance ? 'opacity-40 grayscale-[0.5] font-medium italic select-none pointer-events-none' : ''}`}>
                                                <td className={`px-3 py-2 bg-[#1e293b] group-hover:bg-slate-800/50 transition-colors whitespace-nowrap ${isSticky ? 'sticky left-0 z-10 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.5)]' : ''}`}>
                                                    <div className="text-xs font-bold text-white uppercase tracking-normal">{emp?.name}</div>
                                                    <div className="text-[9px] text-slate-500 font-mono uppercase tracking-normal">{r.employeeId}</div>
                                                </td>
                                                {activeColumns.map(colId => {
                                                    const col = columnMap[colId as keyof typeof columnMap];
                                                    if (!col) return null;
                                                    const val = col.value(r);
                                                    return (
                                                        <td key={colId} className={`px-1.5 py-2 font-mono text-[11px] whitespace-nowrap ${col.className}`}>
                                                            {colId === 'days' ? val : formatIndianNumber(val)}
                                                        </td>
                                                    );
                                                })}
                                                <td className={`px-2 py-2 text-center bg-[#1e293b] group-hover:bg-slate-800/50 transition-colors whitespace-nowrap ${isSticky ? 'sticky right-0 z-10 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.5)]' : ''}`}>
                                                    <button onClick={() => setPreviewRecord(r)} className="p-1.5 bg-blue-900/20 text-blue-400 hover:text-white hover:bg-blue-600 rounded-lg transition-colors" title={`View Pay Slip for ${emp?.name}`} aria-label={`View Pay Slip for ${emp?.name}`}>
                                                        <Eye size={12} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            <tfoot className="sticky bottom-0 z-20 bg-[#0f172a]/95 backdrop-blur-md border-t-2 border-slate-700 shadow-[0_-4px_10px_rgba(0,0,0,0.3)]">
                                <tr className="text-[10px] font-black uppercase tracking-tight">
                                    <td className={`px-3 py-3 text-sky-400 bg-[#0f172a] whitespace-nowrap ${isSticky ? 'sticky left-0 z-10 shadow-[4px_0_4px_-4px_rgba(0,0,0,0.5)]' : ''}`}>Total Summary</td>
                                    {activeColumns.map(colId => {
                                        const col = columnMap[colId as keyof typeof columnMap];
                                        if (!col) return null;
                                        const total = results.reduce((acc, r) => acc + (col.value(r) || 0), 0);
                                        const isSpecialCol = col.className.includes('text-white') || col.className.includes('text-blue-400') || col.className.includes('text-pink-400') || col.className.includes('text-amber-400') || col.className.includes('text-sky-400') || col.className.includes('text-red-400') || col.className.includes('text-emerald-400');
                                        const textClass = isSpecialCol ? col.className.split(' ').find(c => c.startsWith('text-')) : 'text-slate-300';

                                        return (
                                            <td key={colId} className={`px-1.5 py-3 font-mono whitespace-nowrap ${col.className} ${textClass}`}>
                                                {colId === 'days' ? total.toFixed(1) : formatIndianNumber(total)}
                                            </td>
                                        );
                                    })}
                                    <td className={`px-2 py-3 bg-[#0f172a] whitespace-nowrap ${isSticky ? 'sticky right-0 z-10 shadow-[-4px_0_4px_-4px_rgba(0,0,0,0.5)]' : ''}`}></td>
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
                                            <td className="py-2 text-right font-mono">{formatIndianNumber(Math.round(c.codeGross))}</td>
                                            <td className="py-2 text-right font-mono text-amber-400 font-bold">{formatIndianNumber(Math.round(c.proposed))}</td>
                                            <td className="py-2 text-right font-mono text-emerald-400">{formatIndianNumber(Math.round(c.limit))}</td>
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
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                        <div className="flex flex-col items-center gap-2">
                            <div className={`p-3 rounded-full border ${modalState.type === 'error' ? 'bg-red-900/30 text-red-500 border-red-900/50' : modalState.type === 'success' ? 'bg-emerald-900/30 text-emerald-500 border-emerald-900/50' : 'bg-blue-900/30 text-blue-500 border-blue-900/50'}`}>
                                {modalState.type === 'error' ? <AlertTriangle size={24} /> : modalState.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                            </div>
                            <h3 className="text-lg font-bold text-white text-center">{modalState.title}</h3>
                            <div className="text-sm text-slate-400 text-center w-full">{modalState.message}</div>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setModalState({ ...modalState, isOpen: false })} title="Close" aria-label="Close" className="w-full py-2.5 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition-colors">OK</button>
                        </div>
                    </div>
                </div>
            )}

            {previewRecord && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white text-[#0f172a] w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl flex flex-col relative">
                        <div className="sticky top-0 bg-[#f1f5f9] border-b border-slate-200 p-4 flex justify-between items-center z-10"><h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText size={18} className="text-blue-600" /> Pay Slip Preview</h3><button title="Close Preview" aria-label="Close Preview" onClick={() => setPreviewRecord(null)} className="p-2 hover:bg-red-100 text-slate-500 hover:text-red-500 rounded-full transition-colors"><X size={20} /></button></div>
                        <div className="p-8 space-y-6 print:p-0">
                            <div className="text-center space-y-1 border-b-2 border-slate-800 pb-4"><h2 className="text-2xl font-black text-slate-900 uppercase">{companyProfile.establishmentName}</h2><p className="text-xs text-slate-600 font-medium whitespace-pre-wrap px-12">{[companyProfile.doorNo, companyProfile.buildingName, companyProfile.street, companyProfile.area, companyProfile.city, companyProfile.state, companyProfile.pincode].filter(Boolean).join(', ')}</p><h3 className="text-lg font-bold text-slate-800 mt-2 uppercase underline decoration-2 underline-offset-4 decoration-slate-400">Pay Slip - {month} {year}</h3></div>
                            {(() => {
                                const emp = employees.find(e => e.id === previewRecord.employeeId);
                                if (!emp) return null;
                                const r = previewRecord;
                                const special = (r?.earnings?.special1 || 0) + (r?.earnings?.special2 || 0) + (r?.earnings?.special3 || 0);
                                // Calculate other as a residue to ensure the sum of earnings matches the Gross total
                                const other = (r?.earnings?.total || 0) - (
                                    (r?.earnings?.basic || 0) + 
                                    (r?.earnings?.da || 0) + 
                                    (r?.earnings?.retainingAllowance || 0) + 
                                    (r?.earnings?.hra || 0) + 
                                    (r?.earnings?.conveyance || 0) + 
                                    (r?.earnings?.otAmount || 0) + 
                                    special + 
                                    (r?.earnings?.leaveEncashment || 0)
                                );
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
                                    <div className="border border-slate-800"><div className="grid grid-cols-4 bg-slate-800 text-white text-xs font-bold uppercase text-center divide-x divide-slate-600"><div className="p-2">Earnings</div><div className="p-2">Amount (₹)</div><div className="p-2">Deductions</div><div className="p-2">Amount (₹)</div></div><div className="grid grid-cols-4 text-xs divide-x divide-slate-300"><div className="space-y-1 p-2"><div className="text-slate-600">Basic Pay</div><div className="text-slate-600">DA</div><div className="text-slate-600">Retaining Allw</div><div className="text-slate-600">HRA</div><div className="text-slate-600">Conveyance</div><div className="text-slate-600">Washing Allw</div><div className="text-slate-600">{companyProfile?.specialAllowance1Name || 'Special Allw 1'}</div><div className="text-slate-600">{companyProfile?.specialAllowance2Name || 'Special Allw 2'}</div><div className="text-slate-600">{companyProfile?.specialAllowance3Name || 'Special Allw 3'}</div><div className="text-slate-600">Overtime Pay</div><div className="text-slate-600">Leave Encash</div></div><div className="space-y-1 p-2 text-right font-mono text-slate-900"><div>{(r?.earnings?.basic || 0).toFixed(2)}</div><div>{(r?.earnings?.da || 0).toFixed(2)}</div><div>{(r?.earnings?.retainingAllowance || 0).toFixed(2)}</div><div>{(r?.earnings?.hra || 0).toFixed(2)}</div><div>{(r?.earnings?.conveyance || 0).toFixed(2)}</div><div>{other.toFixed(2)}</div><div>{(r?.earnings?.special1 || 0).toFixed(2)}</div><div>{(r?.earnings?.special2 || 0).toFixed(2)}</div><div>{(r?.earnings?.special3 || 0).toFixed(2)}</div><div className="font-bold text-blue-600">{(r?.earnings?.otAmount || 0).toFixed(2)}</div><div>{(r?.earnings?.leaveEncashment || 0).toFixed(2)}</div></div><div className="space-y-1 p-2"><div className="text-slate-600">Provident Fund {r.isCode88 ? '*' : ''}{isPropPFCapped ? <span className="text-[#000080] font-bold"> #</span> : ''}</div><div className="text-slate-600">ESI {r.isESICodeWagesUsed ? '**' : ''}</div><div className="text-slate-600">Professional Tax</div><div className="text-slate-600">Income Tax</div><div className="text-slate-600">VPF</div><div className="text-slate-600">LWF</div><div className="text-slate-600">Adv Recovery</div><div className="text-red-600 font-bold">Fine / Damages</div><div className="text-slate-600"></div><div className="text-slate-600"></div></div><div className="space-y-1 p-2 text-right font-mono text-slate-900"><div>{(r?.deductions?.epf || 0).toFixed(2)}</div><div>{(r?.deductions?.esi || 0).toFixed(2)}</div><div>{(r?.deductions?.pt || 0).toFixed(2)}</div><div>{(r?.deductions?.it || 0).toFixed(2)}</div><div>{(r?.deductions?.vpf || 0).toFixed(2)}</div><div>{(r?.deductions?.lwf || 0).toFixed(2)}</div><div>{(r?.deductions?.advanceRecovery || 0).toFixed(2)}</div><div className="text-red-600 font-bold">{(r?.deductions?.fine || 0).toFixed(2)}</div><div></div><div></div></div></div><div className="grid grid-cols-4 bg-slate-100 border-t border-slate-800 text-xs font-bold divide-x divide-slate-300"><div className="p-2 text-slate-800">Gross Earnings</div><div className="p-2 text-right text-slate-900">{(r?.earnings?.total || 0).toFixed(2)}</div><div className="p-2 text-slate-800">Total Deductions</div><div className="p-2 text-right text-slate-900">{(r?.deductions?.total || 0).toFixed(2)}</div></div></div>
                                    <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 flex flex-col md:flex-row justify-between items-center gap-4"><div><p className="text-xs font-bold text-blue-800 uppercase tracking-widest">Net Salary Payable</p><p className="text-[10px] text-blue-600 italic mt-1 max-w-sm">{numberToWords(Math.round(r?.netPay || 0))} Rupees Only</p></div><div className="text-3xl font-black text-blue-900">₹ {formatIndianNumber(Math.round(r?.netPay || 0))}</div></div>
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
