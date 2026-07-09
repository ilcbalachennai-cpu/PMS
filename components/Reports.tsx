
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FileText, Download, Lock, Unlock, AlertTriangle, CheckCircle2, X, FileSpreadsheet, CreditCard, ClipboardList, Wallet, UserX, Save, TrendingUp, Eye, EyeOff, Database } from 'lucide-react';

// Global OS Detection for UI refinement
const isWin7 = /Windows NT 6.1/.test(window.navigator.userAgent);

import { Employee, PayrollResult, StatutoryConfig, CompanyProfile, Attendance, LeaveLedger, AdvanceLedger, User, ArrearBatch } from '../types';
import {
    generateExcelReport,
    generateSimplePaySheetPDF,
    generateLegacyFormB,
    generatePaySlipsPDF,
    generateBankStatementPDF,
    generateLeaveLedgerReport,
    generateAdvanceShortfallReport,
    generateArrearReport,
    getStandardFileName,
    getBackupFileName,
    openSavedReport,
    generateTemplateWorkbook,
    getMonthAbbr
} from '../services/reportService';
import { formatIndianNumber, getCompanyBackupFolder } from '../utils/formatters';
import { getActivePaySheetColumns } from '../constants';


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
    currentUser: User;
    onRollover: (history: PayrollResult[]) => Promise<void>;
    arrearHistory: any[];
    showAlert: any;
    latestFrozenPeriod: { month: string; year: number } | null;
    onNavigate: (view: any, tab?: string) => void;
    activeFinancialYear?: string;
}

const Reports: React.FC<ReportsProps> = ({
    employees,
    setEmployees,
    config,
    companyProfile,
    attendances: _attendances,
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
    showAlert: _showAlert,
    onNavigate,
    activeFinancialYear
}) => {
    const [reportType, setReportType] = useState<string>('Pay Sheet');
    const [format, setFormat] = useState<'PDF' | 'Excel'>('PDF');
    const [isGenerating, setIsGenerating] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');

    // New State for Arrear Report Generation Batch Selection
    const [arrearSelectedPeriod, setArrearSelectedPeriod] = useState<string>('');

    // New State for Pay Sheet Filtering (Site/Branch/Division)
    const [paySheetFilter, setPaySheetFilter] = useState<'all' | 'site' | 'branch' | 'division'>('all');
    const [paySheetFilterValue, setPaySheetFilterValue] = useState<string>('');
    const [paySlipFilter, setPaySlipFilter] = useState<'all' | 'site' | 'branch' | 'division'>('all');
    const [paySlipFilterValue, setPaySlipFilterValue] = useState<string>('');
    const [useLegacyDesign, setUseLegacyDesign] = useState(false);

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
        type: 'confirm' | 'success' | 'error' | 'loading' | 'backup_check';
        title: string;
        message: string | React.ReactNode;
        onConfirm?: () => void;
        onClose?: () => void;
    }>({ isOpen: false, type: 'confirm', title: '', message: '' });

    // Zero Wage / Exit Mark Modal State
    const [zeroWageEmployees, setZeroWageEmployees] = useState<PayrollResult[]>([]);
    const [exitData, setExitData] = useState<Record<string, { dol: string, reason: string }>>({});

    // Security PIN State
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [pinPurpose, setPinPurpose] = useState<'BEFORE_BACKUP' | 'FINAL_FREEZE'>('BEFORE_BACKUP');
    const [pinShow, setPinShow] = useState(false);
    const pinVerifyBtnRef = useRef<HTMLButtonElement>(null);


    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const CHRONO_ORDER = useMemo(() => ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'], []);

    const [startYear, endYear] = useMemo(() => {
        if (!activeFinancialYear) return [new Date().getFullYear(), new Date().getFullYear()];
        const match = activeFinancialYear.match(/FY(\d{2})-(\d{2})/);
        if (match) {
            return [2000 + parseInt(match[1], 10), 2000 + parseInt(match[2], 10)];
        }
        return [new Date().getFullYear(), new Date().getFullYear()];
    }, [activeFinancialYear]);

    const yearOptions = useMemo(() => {
        if (savedRecords.length === 0) {
            if (startYear === endYear) return [startYear];
            return [startYear, endYear];
        }
        const uniqueYears = Array.from(new Set(savedRecords.map(r => r.year)));
        return uniqueYears.sort((a, b) => a - b);
    }, [savedRecords, startYear, endYear]);

    const selectableMonths = useMemo(() => {
        if (savedRecords.length === 0) return CHRONO_ORDER;
        const unique = Array.from(new Set(savedRecords.map(r => r.month)));
        return unique.sort((a, b) => CHRONO_ORDER.indexOf(a) - CHRONO_ORDER.indexOf(b));
    }, [savedRecords, CHRONO_ORDER]);

    useEffect(() => {
        const isMonthValid = selectableMonths.length === 0 || selectableMonths.includes(month);
        const isYearValid = yearOptions.length === 0 || yearOptions.includes(year);

        if (!isMonthValid || !isYearValid) {
            if (savedRecords.length > 0) {
                // Find the last available record chronologically
                const autoMonth = selectableMonths[selectableMonths.length - 1];
                const match = savedRecords.find(r => r.month === autoMonth);
                if (match) {
                    setMonth(match.month);
                    setYear(match.year);
                }
            } else {
                // Fallback if no records
                const isNextYear = ['January', 'February', 'March'].includes(month);
                setYear(isNextYear ? endYear : startYear);
            }
        }
    }, [selectableMonths, yearOptions, month, year, savedRecords, setMonth, setYear, startYear, endYear]);

    const handleMonthChange = (selectedMonth: string) => {
        setMonth(selectedMonth);
        const match = savedRecords.find(r => r.month === selectedMonth);
        if (match) {
            setYear(match.year);
        } else {
            const isNextYear = ['January', 'February', 'March'].includes(selectedMonth);
            setYear(isNextYear ? endYear : startYear);
        }
    };

    const currentResults = useMemo(() => {
        return savedRecords.filter(r => r.month === month && r.year === year);
    }, [savedRecords, month, year]);

    const isLocked = useMemo(() => {
        return currentResults.length > 0 && currentResults[0].status === 'Finalized';
    }, [currentResults]);

    const hasData = useMemo(() => {
        return currentResults.length > 0;
    }, [currentResults]);

    const hasArrearData = useMemo(() => {
        return arrearHistory?.some(b => b.month === month && b.year === year) || false;
    }, [arrearHistory, month, year]);

    const earliestPeriod = useMemo<{ month: string, year: number, val: number } | null>(() => {
        if (!savedRecords || savedRecords.length === 0) return null;
        
        let minVal = 9999999;
        let earliest: { month: string, year: number, val: number } | null = null;
        
        savedRecords.forEach(r => {
            const mIdx = months.indexOf(r.month);
            const val = r.year * 12 + mIdx;
            if (val < minVal) {
                minVal = val;
                earliest = { month: r.month, year: r.year, val };
            }
        });
        
        return earliest;
    }, [savedRecords]);

    const isBeforeEarliest = useMemo(() => {
        if (!earliestPeriod) return false;
        const mIdx = months.indexOf(month);
        const currentVal = year * 12 + mIdx;
        return currentVal < earliestPeriod.val;
    }, [earliestPeriod, month, year]);

    // Check for unsaved changes in Process Payroll (Temp Storage)
    useEffect(() => {
        const tempKey = `app_temp_payroll_${companyProfile.id}_${month}_${year}`;
        const legacyKey = `app_temp_payroll_${month}_${year}`;
        
        // Clean up legacy unscoped keys if found to prevent "ghost" unsaved changes
        if (localStorage.getItem(legacyKey)) {
            localStorage.removeItem(legacyKey);
        }

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
    }, [month, year, companyProfile.id]);

    useEffect(() => {
        setSelectedEmployeeId('all');
    }, [month, year, reportType]);

    // Initial Jump logic removed to respect global state synchronized across the app.
    // usePayrollPeriod already handles default selection smartly based on processing status.

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

    const executeFreeze = async () => {
        try {
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
                message: (
                    <div className="space-y-2 text-left">
                        <p>Data Frozen and Locked Successfully.</p>
                        <p className="text-[10px] text-slate-400 italic font-medium">Automatic backups (Before & After Confirmation) have been secured in the Data Backup folder.</p>
                    </div>
                ),
                onClose: () => {
                    // TRIGGER ROLLOVER ONLY AFTER MODAL IS CLOSED
                    onRollover(updated);
                }
            });
        } catch (e: any) {
            setModalState({
                isOpen: true,
                type: 'error',
                title: 'Freeze Failed',
                message: `An error occurred during finalization: ${e.message}`
            });
        }
    };

    const handleModalClose = () => {
        const callback = modalState.onClose;
        setModalState(prev => ({ ...prev, isOpen: false }));
        if (callback) callback();
    };

    const handlePinVerify = async () => {
        setPinError('');
        const actualPin = companyProfile.securityPin || '';
        if (pinInput !== actualPin) {
            setPinError('Invalid Security Password / PIN. Access Denied.');
            return;
        }

        setShowPinModal(false);
        setPinInput('');

        if (pinPurpose === 'BEFORE_BACKUP') {
            await initiatePreFreezeBackup();
        } else {
            // --- COMMIT EXIT DATA (if any) ---
            if (Object.keys(exitData).length > 0) {
                const updatedEmployees = employees.map(emp => {
                    if (exitData[emp.id]) {
                        const { dol, reason } = exitData[emp.id];
                        if (reason === 'ON LOP') return { ...emp, dol: '', leavingReason: reason };
                        return { ...emp, dol, leavingReason: reason };
                    }
                    return emp;
                });
                setEmployees(updatedEmployees);
                setZeroWageEmployees([]);
                setExitData({});
            }
            await executeFreeze();
        }
    };

    const initiatePreFreezeBackup = async () => {
        // --- V02.02.41: Pre-validation of storage location ---
        // @ts-ignore
        const currentDir = await window.electronAPI.getAppDirectory();
        if (!currentDir) {
            setModalState({
                isOpen: true,
                type: 'error',
                title: 'Storage Not Configured',
                message: "Automatic backup cannot be performed because a storage location has not been selected. Please go to 'Configuration' and select an application data folder.",
                onClose: () => setModalState({ isOpen: false, type: 'loading', title: '', message: '' })
            });
            return;
        }

        // --- NEW: AUTOMATIC BACKUP (BC - Before Confirmation) ---
        setModalState({
            isOpen: true,
            type: 'loading',
            title: 'Secured Snapshot',
            message: "Creating 'Before Confirmation' snapshot. Please wait..."
        });

        try {

            await new Promise(resolve => setTimeout(resolve, 1500));
            const backupFileName = getBackupFileName('BC', companyProfile, month, year);
            const encryptionKey = companyProfile.securityPin || 'INITIAL_PMS_KEY';
            const subfolderPath = `${getCompanyBackupFolder(companyProfile.establishmentName, companyProfile.id)}/BK_${getMonthAbbr(month)}${String(year).slice(-2)}`;
            const backupRes = await window.electronAPI.createDataBackup({
                fileName: backupFileName,
                subfolder: subfolderPath,
                encryptionKey: encryptionKey
            });


            if (!backupRes.success) {
                setModalState({
                    isOpen: true,
                    type: 'error',
                    title: 'Backup Failed',
                    message: `Automatic backup (BC) failed: ${backupRes.error || 'Unknown error'}.`,
                    onClose: () => setModalState({ ...modalState, isOpen: false })
                });
                return;
            }
            setModalState({ ...modalState, isOpen: false });
            proceedToFreezeConfirmation();
        } catch (backupErr: any) {
            setModalState({
                isOpen: true,
                type: 'error',
                title: 'Backup Error',
                message: `Could not create snapshot: ${backupErr.message}`,
                onClose: () => setModalState({ ...modalState, isOpen: false })
            });
        }
    };

    const proceedToFreezeConfirmation = () => {
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
            // COMPUTE ADVANCE SHORTFALLS
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
                            <div className="space-y-1">
                                {leavingWithAdvance.map((s) => (
                                    <div className="flex justify-between items-center text-xs bg-red-950/40 px-2 py-1.5 rounded border border-red-900/30">
                                        <span className="text-white font-semibold">{s.name}</span>
                                        <span className="text-red-400 font-bold font-mono">Pending ₹ {formatIndianNumber(Math.round(s.balance))}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {advShortfalls.length > 0 && (
                        <div className="bg-amber-900/30 border border-amber-600/40 rounded-xl p-3">
                            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">⚠ Advance Recovery Shortfall</p>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                                {advShortfalls.map(s => (
                                    <div key={s.id} className="flex justify-between items-center text-xs bg-slate-800/60 px-2 py-1.5 rounded">
                                        <span className="text-white font-semibold">{s.name}</span>
                                        <span className="font-mono text-[10px] flex gap-2">
                                            <span className="text-red-400 font-bold">Shortfall ₹ {s.shortfall}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : `Are you sure you want to finalize payroll for ${month} ${year}?\n\nThis will lock all attendance, leave, and advance records for this period.`;

            setModalState({
                isOpen: true,
                type: 'confirm',
                title: 'Confirm Freeze',
                message: confirmMessage,
                onConfirm: () => {
                    setPinPurpose('FINAL_FREEZE');
                    setShowPinModal(true);
                }
            });
        }
    };

    const handleExitChange = (id: string, field: 'dol' | 'reason', value: string) => {
        setExitData(prev => {
            const current = prev[id] || { dol: '', reason: '' };
            const updated = { ...current, [field]: value };
            if (field === 'reason' && value !== '' && value !== 'ON LOP' && !updated.dol) {
                const currentMIdx = months.indexOf(month);
                const currentYear = year;
                updated.dol = `${currentYear}-${String(currentMIdx + 1).padStart(2, '0')}-01`;
            }
            return {
                ...prev,
                [id]: updated
            };
        });
    };

    const processExitAndFreeze = async () => {
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

        // Logic branched to handlePinVerify for final authorization

        if (employeesWithAdvance.length > 0) {
            setModalState({
                isOpen: true,
                type: 'confirm',
                title: 'Pending Advances Found',
                message: (
                    <div className="space-y-3">
                        <p className="text-sm">The following employees are being marked as LEFT but still have outstanding advance balances:</p>
                        <ul className="text-xs text-red-100 font-bold list-disc list-inside bg-red-950/40 p-3 rounded-lg border border-red-500/20">
                            {employeesWithAdvance.map(([id]) => {
                                const emp = employees.find(e => e.id === id);
                                const adv = advanceLedgers.find(a => a.employeeId === id);
                                return <li key={id}>{emp?.name}: ₹ {formatIndianNumber(Math.round(adv?.balance || 0))}</li>;
                            })}
                        </ul>
                        <p className="text-xs text-slate-400 italic">Are you sure you want to finalize their exit and freeze payroll?</p>
                    </div>
                ),
                onConfirm: () => {
                    setPinPurpose('FINAL_FREEZE');
                    setShowPinModal(true);
                }
            });
        } else {
            setPinPurpose('FINAL_FREEZE');
            setShowPinModal(true);
        }
    };

    const handleFreeze = async () => {
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

        if (!companyProfile.securityPin) {
            setModalState({
                isOpen: true,
                type: 'confirm',
                title: 'Security Password Required',
                message: (
                    <div className="space-y-3">
                        <p className="text-slate-300">A separate Security Password / PIN must be set before you can freeze payroll for security reasons.</p>
                        <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest leading-relaxed">
                            Would you like to go to Settings &gt; Company Profile to set your Password now?
                        </p>
                    </div>
                ),
                onConfirm: () => {
                    handleModalClose();
                    onNavigate('settings', 'COMPANY');
                    // Focus the PIN field after navigation delay
                    setTimeout(() => {
                        const pinInput = document.getElementById('security-pin-input');
                        if (pinInput) {
                            pinInput.focus();
                            // Optional: Smooth scroll if needed, though Settings should mount at top
                            pinInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 500);
                }
            });
            return;
        }

        setModalState({
            isOpen: true,
            type: 'backup_check',
            title: 'Backup Verification Check',
            message: 'Have you taken a full backup of the data before final freezing?',
            onConfirm: () => {
                setPinPurpose('BEFORE_BACKUP');
                setShowPinModal(true);
            }
        });
    };


    const generateReport = async () => {
        // Exception for Arrear Report: It relies on History, not Lock state
        if (reportType !== 'Arrear Report' && !isLocked) {
            setModalState({
                isOpen: true,
                type: 'error', // use the Alert design
                title: 'Data Not Frozen',
                message: 'You must finalize this payroll period before reports can be generated.\n\nPlease click the "Confirm & Freeze Data" button at the top right of this screen.'
            });
            return;
        }

        setIsGenerating(true);
        try {
            if ((reportType === 'Pay Sheet' || reportType === 'Pay Slips' || reportType === 'Bank Statement') && currentResults.length === 0) {
                throw new Error("No payroll data found for this period. Please run & save payroll in Pay Process first.");
            }

            let savedPath: string | null = null;
            if (reportType === 'Pay Sheet') {
                const validResults = currentResults.filter(r => r.earnings?.total > 0);
                if (validResults.length === 0) throw new Error("No employees with wages found. Check if payroll has been processed with attendance.");

                if (format === 'Excel') {
                    const validToExport = validResults.filter(r => {
                        if (paySheetFilter === 'all') return true;
                        const emp = employees.find(e => e.id === r.employeeId);
                        if (!emp) return false;
                        if (paySheetFilter === 'site') return emp.site === paySheetFilterValue;
                        if (paySheetFilter === 'branch') return emp.branch === paySheetFilterValue;
                        if (paySheetFilter === 'division') return emp.division === paySheetFilterValue;
                        return true;
                    });

                    if (validToExport.length === 0) throw new Error(`No data found for the selected ${paySheetFilter}: ${paySheetFilterValue}`);

                    const activeCols = getActivePaySheetColumns(validToExport, config || {});

                    const allColumns = [
                        { key: 'days', label: 'Days Paid', getValue: (r: any) => r.payableDays },
                        { key: 'basic', label: 'Basic', getValue: (r: any) => Math.round(r.earnings?.basic || 0) },
                        { key: 'da', label: 'DA', getValue: (r: any) => Math.round(r.earnings?.da || 0) },
                        { key: 'retaining', label: 'Retaining Allw', getValue: (r: any) => Math.round(r.earnings?.retainingAllowance || 0) },
                        { key: 'hra', label: 'HRA', getValue: (r: any) => Math.round(r.earnings?.hra || 0) },
                        { key: 'conveyance', label: 'Conveyance', getValue: (r: any) => Math.round(r.earnings?.conveyance || 0) },
                        { key: 'washing', label: 'Washing Allw', getValue: (r: any) => Math.round(r.earnings?.washing || 0) },
                        { key: 'attire', label: 'Attire Allw', getValue: (r: any) => Math.round(r.earnings?.attire || 0) },
                        { key: 'special1', label: 'Special 1', getValue: (r: any) => Math.round(r.earnings?.special1 || 0) },
                        { key: 'special2', label: 'Special 2', getValue: (r: any) => Math.round(r.earnings?.special2 || 0) },
                        { key: 'special3', label: 'Special 3', getValue: (r: any) => Math.round(r.earnings?.special3 || 0) },
                        { key: 'leaveEncashment', label: 'Leave Encash', getValue: (r: any) => Math.round(r.earnings?.leaveEncashment || 0) },
                        { key: 'otAmount', label: 'OT Amount', getValue: (r: any) => Math.round(r.earnings?.otAmount || 0) },
                        { 
                            key: 'others', 
                            label: 'Others', 
                            getValue: (r: any) => {
                                const earningsKeys = ['basic', 'da', 'retaining', 'hra', 'conveyance', 'washing', 'attire', 'special1', 'special2', 'special3', 'bonus', 'leaveEncashment', 'otAmount', 'arrears'];
                                const displayedEarningsKeys = earningsKeys.filter(k => activeCols.includes(k));
                                const sumOfDisplayed = displayedEarningsKeys.reduce((acc, k) => acc + (k === 'retaining' ? (r.earnings?.retainingAllowance || 0) : (r.earnings?.[k] || 0)), 0);
                                return Math.round((r.earnings?.total || 0) - sumOfDisplayed);
                            }
                        },
                        { key: 'totalEarnings', label: 'GROSS EARNINGS', getValue: (r: any) => Math.round(r.earnings?.total || 0) },
                        { key: 'epf', label: 'PF (EE)', getValue: (r: any) => activeCols.includes('vpf') ? Math.round(r.deductions?.epf || 0) : Math.round((r.deductions?.epf || 0) + (r.deductions?.vpf || 0)) },
                        { key: 'vpf', label: 'VPF (EE)', getValue: (r: any) => Math.round(r.deductions?.vpf || 0) },
                        { key: 'esi', label: 'ESI (EE)', getValue: (r: any) => Math.round(r.deductions?.esi || 0) },
                        { key: 'advanceRecovery', label: 'Advance', getValue: (r: any) => Math.round(r.deductions?.advanceRecovery || 0) },
                        { key: 'pt', label: 'Prof Tax', getValue: (r: any) => Math.round(r.deductions?.pt || 0) },
                        { key: 'it', label: 'Income Tax', getValue: (r: any) => Math.round(r.deductions?.it || 0) },
                        { key: 'lwf', label: 'LWF', getValue: (r: any) => Math.round(r.deductions?.lwf || 0) },
                        { key: 'fine', label: 'Fine', getValue: (r: any) => Math.round(r.deductions?.fine || 0) },
                        { 
                            key: 'otherDeductions', 
                            label: 'Others (DED)', 
                            getValue: (r: any) => {
                                const deductionKeys = ['epf', 'vpf', 'esi', 'advanceRecovery', 'pt', 'lwf', 'it', 'fine'];
                                const displayedDeductionKeys = deductionKeys.filter(k => activeCols.includes(k));
                                let sumOfDisplayed = displayedDeductionKeys.reduce((acc, k) => acc + (r.deductions?.[k] || 0), 0);
                                return Math.round((r.deductions?.total || 0) - sumOfDisplayed);
                            }
                        },
                        { key: 'totalDeductions', label: 'TOTAL DEDUCTIONS', getValue: (r: any) => Math.round(r.deductions?.total || 0) },
                        { key: 'netPay', label: 'NET PAY', getValue: (r: any) => Math.round(r.netPay || 0) }
                    ];

                    let excelData: any[] = [];

                    excelData = validToExport.map(r => {
                        const emp = employees.find(e => e.id === r.employeeId);
                        const row: any = {
                            'ID': r.employeeId,
                            'Name': emp?.name,
                            'Designation': emp?.designation,
                            'Site': emp?.site || '-',
                            'Branch': emp?.branch || '-',
                            'Division': emp?.division || '-',
                        };

                        allColumns.forEach(col => {
                            if (activeCols.includes(col.key)) {
                                row[col.label] = col.getValue(r);
                            }
                        });

                        return row;
                    });

                    let customExcelFilename = undefined;
                    if (paySheetFilter !== 'all') {
                        const monthAbbr = getMonthAbbr(month);
                        customExcelFilename = `${paySheetFilterValue} PaySheet ${monthAbbr} ${year}`;
                    }

                    const fileName = customExcelFilename || getStandardFileName('PaySheet', companyProfile, month, year);
                    savedPath = await generateExcelReport(excelData, 'Pay Sheet', fileName);
                } else {
                    const validToExport = validResults.filter(r => {
                        if (paySheetFilter === 'all') return true;
                        const emp = employees.find(e => e.id === r.employeeId);
                        if (!emp) return false;
                        if (paySheetFilter === 'site') return emp.site === paySheetFilterValue;
                        if (paySheetFilter === 'branch') return emp.branch === paySheetFilterValue;
                        if (paySheetFilter === 'division') return emp.division === paySheetFilterValue;
                        return true;
                    });

                    if (validToExport.length === 0) throw new Error(`No data found for the selected ${paySheetFilter}: ${paySheetFilterValue}`);

                    let subtitle = undefined;
                    let customPDFFileName = undefined;
                    if (paySheetFilter !== 'all') {
                        subtitle = `${paySheetFilter === 'site' ? 'Site' : paySheetFilter === 'branch' ? 'Branch' : 'Division'}: ${paySheetFilterValue}`;
                        customPDFFileName = getStandardFileName(paySheetFilterValue, companyProfile, month, year);
                    }

                    if (paySheetFilter === 'all') {
                        if (useLegacyDesign) {
                            customPDFFileName = getStandardFileName('Legacy Pay Sheet', companyProfile, month, year);
                        } else {
                            customPDFFileName = getStandardFileName('Summary Pay Sheet', companyProfile, month, year);
                        }
                        subtitle = 'Site: CONSOLIDATED';
                    }

                    if (useLegacyDesign) {
                        savedPath = await generateLegacyFormB(validToExport, employees, month, year, companyProfile, subtitle, customPDFFileName);
                    } else {
                        savedPath = await generateSimplePaySheetPDF(validToExport, employees, month, year, companyProfile, subtitle, customPDFFileName, config);
                    }
                }
            } else if (reportType === 'Pay Slips') {
                let slipRecords = currentResults.filter(r => r.netPay > 0);
                let customSlipFilename = undefined;
                let customSlipTitle = undefined;

                if (paySlipFilter === 'all') {
                    if (selectedEmployeeId !== 'all') {
                        slipRecords = slipRecords.filter(r => r.employeeId === selectedEmployeeId);
                    }
                } else if (paySlipFilter === 'site') {
                    if (!paySlipFilterValue) throw new Error("Please select a Site first.");
                    slipRecords = slipRecords.filter(r => {
                        const emp = employees.find(e => e.id === r.employeeId);
                        return emp?.site === paySlipFilterValue;
                    });
                    const monthAbbr = getMonthAbbr(month);
                    customSlipFilename = `${paySlipFilterValue} PaySlips ${monthAbbr} ${year}`;
                    customSlipTitle = `Pay Slips - ${paySlipFilterValue} - ${month} ${year}`;
                } else if (paySlipFilter === 'branch') {
                    if (!paySlipFilterValue) throw new Error("Please select a Branch first.");
                    slipRecords = slipRecords.filter(r => {
                        const emp = employees.find(e => e.id === r.employeeId);
                        return emp?.branch === paySlipFilterValue;
                    });
                    const monthAbbr = getMonthAbbr(month);
                    customSlipFilename = `${paySlipFilterValue} PaySlips ${monthAbbr} ${year}`;
                    customSlipTitle = `Pay Slips - ${paySlipFilterValue} - ${month} ${year}`;
                } else if (paySlipFilter === 'division') {
                    if (!paySlipFilterValue) throw new Error("Please select a Division first.");
                    slipRecords = slipRecords.filter(r => {
                        const emp = employees.find(e => e.id === r.employeeId);
                        return emp?.division === paySlipFilterValue;
                    });
                    const monthAbbr = getMonthAbbr(month);
                    customSlipFilename = `${paySlipFilterValue} PaySlips ${monthAbbr} ${year}`;
                    customSlipTitle = `Pay Slips - ${paySlipFilterValue} - ${month} ${year}`;
                }

                if (slipRecords.length === 0) throw new Error("No matching payroll records found for the selected filter.");
                savedPath = await generatePaySlipsPDF(slipRecords, employees, month, year, companyProfile, customSlipTitle, customSlipFilename);
            } else if (reportType === 'Bank Statement') {
                const bankRecords = currentResults.filter(r => r.netPay > 0);
                if (bankRecords.length === 0) throw new Error("No employees with positive Net Pay found for Bank Statement.");

                if (format === 'Excel') {
                    const data = bankRecords.map(r => {
                        const emp = employees.find(e => e.id === r.employeeId);
                        return {
                            'Emp ID': r.employeeId,
                            'Name': emp?.name,
                            'Bank Name': emp?.bankName || '-',
                            'Account No': emp?.bankAccount,
                            'IFSC': emp?.ifsc,
                            'Amount': r.netPay
                        };
                    });
                    const fileName = getStandardFileName('Bank_Statement', companyProfile, month, year);
                    savedPath = await generateExcelReport(data, 'Bank Statement', fileName);
                } else {
                    savedPath = await generateBankStatementPDF(bankRecords, employees, month, year, companyProfile);
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
                    const fileName = getStandardFileName('LeaveLedger', companyProfile, month, year);
                    savedPath = await generateExcelReport(data, 'Leave Ledger', fileName);
                } else {
                    savedPath = await generateLeaveLedgerReport(currentResults, activeEmps, leaveLedgers, month, year, 'AC', companyProfile);
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
                }).filter(Boolean) as any[];

                if (shortfallData.length === 0) {
                    setModalState({ isOpen: true, type: 'error', title: 'No Data Available', message: 'No Data Available to Report' });
                    return;
                }

                savedPath = await generateAdvanceShortfallReport(shortfallData, month, year, format, companyProfile);
            } else if (reportType === 'Arrear Report') {
                let batch: ArrearBatch | undefined;
                if (arrearHistory && arrearHistory.length > 0) {
                    const [selectedMonth, selectedYear] = arrearSelectedPeriod.split('-');
                    batch = arrearHistory.find(b => b.month === selectedMonth && b.year === parseInt(selectedYear, 10));
                }
                if (!batch || !batch.records || batch.records.length === 0) {
                    throw new Error(`No arrear calculation found. Please process increments in Pay Process > Arrear Salary first.`);
                }
                savedPath = await generateArrearReport(batch.records, batch.effectiveMonth, batch.effectiveYear, batch.month, batch.year, format, companyProfile);
            } else if (reportType === 'Master Template') {
                const fileName = getStandardFileName('MasterTemplate', companyProfile, month, year);
                const wb = (await import('xlsx')).utils.book_new();
                const ws = (await import('xlsx')).utils.json_to_sheet(employees);
                (await import('xlsx')).utils.book_append_sheet(wb, ws, 'Employees');
                savedPath = await generateTemplateWorkbook(wb, fileName, companyProfile.establishmentName);

            }

            if (savedPath) {
                _showAlert(
                    'success',
                    'Report Generated Successfully',
                    `The ${reportType} has been saved to your reports folder.`,
                    () => openSavedReport(savedPath),
                    undefined,
                    'Open Report & Folder',
                    undefined,
                    undefined,
                    2
                );
            } else {
                const filename = (window as any).lastGeneratedFileName || 'the file';
                _showAlert('error', 'Generation Failed', `Similar file is already open, close "${filename}" to generate the new report`);
            }

        } catch (e: any) {
            setModalState({ isOpen: true, type: 'error', title: 'Generation Failed', message: e.message });
        } finally {
            setIsGenerating(false);
        }
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
                    <select value={month} onChange={e => handleMonthChange(e.target.value)} className="bg-transparent border-r border-slate-700 px-4 py-1 text-sm text-white font-bold outline-none focus:text-indigo-400" title="Select Month" aria-label="Select Month">
                        {selectableMonths.map(m => (<option key={m} value={m} className="bg-[#0f172a] text-white">{m}</option>))}
                    </select>
                    <select value={year} onChange={e => setYear(+e.target.value)} className="bg-transparent px-4 py-1 text-sm text-white font-bold outline-none focus:text-indigo-400" title="Select Year" aria-label="Select Year">
                        {yearOptions.map(y => (<option key={y} value={y} className="bg-[#0f172a] text-white">{y}</option>))}
                    </select>
                </div>
            </div>

            {/* Lock/Unlock Section */}
            <div className={`p-6 rounded-xl border flex items-center justify-between shadow-lg transition-all ${isBeforeEarliest ? 'bg-slate-800/50 border-slate-700' : (isLocked ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-amber-900/10 border-amber-500/30')}`}>
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full border ${isBeforeEarliest ? 'bg-slate-800/50 border-slate-700 text-slate-500' : (isLocked ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' : 'bg-amber-900/20 border-amber-500/50 text-amber-400')}`}>
                        {isBeforeEarliest ? <FileText size={24} /> : (isLocked ? <Lock size={24} /> : <Unlock size={24} />)}
                    </div>
                    <div>
                        <h3 className={`font-bold text-lg ${isBeforeEarliest ? 'text-slate-400' : (isLocked ? 'text-emerald-400' : 'text-amber-400')}`}>
                            {isBeforeEarliest ? 'No Data Available' : (isLocked ? 'Payroll Finalized' : 'Payroll in Draft')}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                            {isBeforeEarliest 
                                ? `Last frozen data is available from ${earliestPeriod?.month} ${earliestPeriod?.year} only.`
                                : (isLocked ? 'Data is frozen for compliance reporting.' : 'Freeze data to generate statutory reports and lock edits.')}
                        </p>
                    </div>
                </div>
                {!isLocked && !isBeforeEarliest && (
                    <button
                        onClick={handleFreeze}
                        disabled={!hasData || hasUnsavedChanges}
                        title="Confirm & Freeze Data"
                        aria-label="Confirm & Freeze Data"
                        className={`px-6 py-2.5 rounded-lg font-bold text-sm shadow-lg transition-all ${(hasData && !hasUnsavedChanges)
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        {hasUnsavedChanges
                            ? 'Save in Process Payroll to Freeze'
                            : hasData
                                ? 'Confirm & Freeze Data'
                                : 'No Data to Freeze'}
                    </button>
                )}
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
                            { id: 'Arrear Report', icon: TrendingUp, label: 'Arrear Salary Report' },
                        ].map(item => {
                            const isDraftDisabled = !isLocked;
                            const isDisabled = (item.id === 'Arrear Report' && !hasArrearData) || isDraftDisabled;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => !isDisabled && handleReportTypeChange(item.id)}
                                    disabled={isDisabled}
                                    title={
                                        isDraftDisabled 
                                            ? "Freeze payroll to unlock this report" 
                                            : (item.id === 'Arrear Report' && !hasArrearData)
                                                ? "No arrear data for selected month"
                                                : `Select ${item.label}`
                                    }
                                    aria-label={
                                        isDraftDisabled 
                                            ? "Lock payroll to unlock this report" 
                                            : (item.id === 'Arrear Report' && !hasArrearData)
                                                ? "No arrear data"
                                                : `Select ${item.label}`
                                    }
                                    className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-all ${
                                        isDisabled
                                            ? 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed grayscale'
                                            : reportType === item.id
                                                ? (isWin7
                                                    ? 'bg-blue-600 border-white/50 text-white shadow-[0_0_30px_rgba(37,99,235,0.5)] scale-105 ring-2 ring-white/30'
                                                    : 'bg-blue-600 border-blue-500 text-white shadow-lg scale-105')
                                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                                    }`}
                                >
                                    <item.icon size={24} />
                                    <span className="text-xs font-bold text-center">{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Configuration & Action */}
                <div className={`bg-[#1e293b] rounded-2xl border border-slate-800 p-6 shadow-xl flex flex-col justify-between transition-opacity ${!isLocked ? 'opacity-70' : 'opacity-100'}`}>
                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Configuration</h3>
                        <div className="space-y-4">
                            {reportType !== 'Pay Slips' ? (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500">Output Format</label>
                                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                                        <button
                                            disabled={!isLocked}
                                            onClick={() => setFormat('PDF')}
                                            title={!isLocked ? "Freeze payroll to configure report format" : "Set format to PDF"}
                                            aria-label="Set format to PDF"
                                            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                                                !isLocked
                                                    ? 'bg-slate-800/40 text-slate-500 cursor-not-allowed'
                                                    : format === 'PDF'
                                                        ? 'bg-red-600 text-white shadow-lg'
                                                        : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            PDF
                                        </button>
                                        <button
                                            disabled={!isLocked}
                                            onClick={() => setFormat('Excel')}
                                            title={!isLocked ? "Freeze payroll to configure report format" : "Set format to Excel"}
                                            aria-label="Set format to Excel"
                                            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                                                !isLocked
                                                    ? 'bg-slate-800/40 text-slate-500 cursor-not-allowed'
                                                    : format === 'Excel'
                                                        ? 'bg-emerald-600 text-white shadow-lg'
                                                        : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            Excel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-xs text-blue-300">
                                    Format locked to <b>PDF</b> for Pay Slips.
                                </div>
                            )}

                            {reportType === 'Pay Sheet' && currentResults.length > 0 && (
                                <div className="space-y-3 mt-2 animate-in fade-in slide-in-from-top-2 border-t border-slate-800 pt-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Filter Report By</label>
                                        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                                            {(['all', 'site', 'branch', 'division'] as const).map(f => (
                                                <button
                                                    key={f}
                                                    disabled={!isLocked}
                                                    onClick={() => { setPaySheetFilter(f); setPaySheetFilterValue(''); }}
                                                    title={!isLocked ? "Freeze payroll to configure filters" : `Filter by ${f}`}
                                                    aria-label={`Filter by ${f}`}
                                                    className={`flex-1 py-1.5 text-[10px] uppercase font-black rounded-md transition-all ${
                                                        !isLocked
                                                            ? 'bg-slate-800/40 text-slate-500 cursor-not-allowed'
                                                            : paySheetFilter === f
                                                                ? 'bg-indigo-600 text-white'
                                                                : 'text-slate-500 hover:text-white'
                                                    }`}
                                                >
                                                    {f}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {paySheetFilter !== 'all' && (
                                        <div className="space-y-2 animate-in fade-in zoom-in-95">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                Select {paySheetFilter === 'site' ? 'Site' : paySheetFilter === 'branch' ? 'Branch' : 'Division'}
                                            </label>
                                            <select
                                                disabled={!isLocked}
                                                value={paySheetFilterValue}
                                                onChange={e => setPaySheetFilterValue(e.target.value)}
                                                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title={!isLocked ? "Freeze payroll to configure filters" : `Select ${paySheetFilter}`}
                                                aria-label={`Select ${paySheetFilter}`}
                                            >
                                                <option value="" className="bg-[#0f172a] text-white">-- Select {paySheetFilter === 'site' ? 'Site' : paySheetFilter === 'branch' ? 'Branch' : 'Division'} --</option>
                                                {Array.from(new Set(
                                                    currentResults.map(r => {
                                                        const emp = employees.find(e => e.id === r.employeeId);
                                                        return paySheetFilter === 'site' ? emp?.site : paySheetFilter === 'branch' ? emp?.branch : emp?.division;
                                                    }).filter(Boolean)
                                                ))
                                                    .sort()
                                                    .map(val => (
                                                        <option key={val} value={val!} className="bg-[#0f172a] text-white">{val}</option>
                                                    ))}
                                            </select>
                                        </div>
                                    )}


                                    {format === 'PDF' && (
                                        <div className={`flex items-center gap-3 p-3 bg-indigo-900/10 border border-indigo-500/20 rounded-xl mt-4 transition-all ${
                                            !isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-indigo-900/20'
                                        }`}>
                                            <input 
                                                id="useLegacyDesign"
                                                type="checkbox" 
                                                disabled={!isLocked}
                                                title={!isLocked ? "Freeze payroll to configure layout" : "Use Legacy MS Access Layout"}
                                                checked={useLegacyDesign} 
                                                onChange={() => setUseLegacyDesign(!useLegacyDesign)}
                                                className="w-4 h-4 rounded border-indigo-500 text-indigo-600 focus:ring-indigo-500 bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed" 
                                            />
                                            <label htmlFor="useLegacyDesign" className={!isLocked ? "cursor-not-allowed" : "cursor-pointer"}>
                                                <p className="text-[11px] font-bold text-indigo-400">Use Legacy MS Access Layout</p>
                                                <p className="text-[9px] text-slate-500">Enable 4-row employee blocks (Form B Style)</p>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            )}

                            {reportType === 'Pay Slips' && currentResults.length > 0 && (
                                <div className="space-y-3 mt-2 animate-in fade-in slide-in-from-top-2 border-t border-slate-800 pt-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Filter Slips By</label>
                                        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                                            {(['all', 'site', 'branch', 'division'] as const).map(f => (
                                                <button
                                                    key={f}
                                                    disabled={!isLocked}
                                                    onClick={() => { setPaySlipFilter(f); setPaySlipFilterValue(''); setSelectedEmployeeId('all'); }}
                                                    title={!isLocked ? "Freeze payroll to configure filters" : `Filter Slips by ${f}`}
                                                    aria-label={`Filter Slips by ${f}`}
                                                    className={`flex-1 py-1.5 text-[10px] uppercase font-black rounded-md transition-all ${
                                                        !isLocked
                                                            ? 'bg-slate-800/40 text-slate-500 cursor-not-allowed'
                                                            : paySlipFilter === f
                                                                ? 'bg-indigo-600 text-white'
                                                                : 'text-slate-500 hover:text-white'
                                                    }`}
                                                >
                                                    {f}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {paySlipFilter === 'all' && (
                                        <div className="space-y-2 animate-in fade-in zoom-in-95">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Employee</label>
                                            <select
                                                disabled={!isLocked}
                                                value={selectedEmployeeId}
                                                onChange={e => setSelectedEmployeeId(e.target.value)}
                                                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold outline-none focus:border-indigo-500 transition-colors custom-scrollbar disabled:opacity-50 disabled:cursor-not-allowed"
                                                title={!isLocked ? "Freeze payroll to configure filters" : "Select Employee for Pay Slip"}
                                                aria-label="Select Employee for Pay Slip"
                                            >
                                                <option value="all" className="bg-[#0f172a] text-white">All Employees</option>
                                                {currentResults
                                                    .filter(r => r.netPay > 0)
                                                    .map(r => ({ id: r.employeeId, name: employees.find(e => e.id === r.employeeId)?.name || r.employeeId }))
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map(emp => (
                                                        <option key={emp.id} value={emp.id} className="bg-[#0f172a] text-white">{emp.name}</option>
                                                    ))
                                                }
                                            </select>
                                        </div>
                                    )}

                                    {paySlipFilter !== 'all' && (
                                        <div className="space-y-2 animate-in fade-in zoom-in-95">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                Select {paySlipFilter === 'site' ? 'Site' : paySlipFilter === 'branch' ? 'Branch' : 'Division'}
                                            </label>
                                            <select
                                                disabled={!isLocked}
                                                value={paySlipFilterValue}
                                                onChange={e => setPaySlipFilterValue(e.target.value)}
                                                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title={!isLocked ? "Freeze payroll to configure filters" : `Select ${paySlipFilter}`}
                                                aria-label={`Select ${paySlipFilter}`}
                                            >
                                                <option value="" className="bg-[#0f172a] text-white">-- Select {paySlipFilter === 'site' ? 'Site' : paySlipFilter === 'branch' ? 'Branch' : 'Division'} --</option>
                                                {Array.from(new Set(
                                                    currentResults.map(r => {
                                                        const emp = employees.find(e => e.id === r.employeeId);
                                                        return paySlipFilter === 'site' ? emp?.site : paySlipFilter === 'branch' ? emp?.branch : emp?.division;
                                                    }).filter(Boolean)
                                                ))
                                                    .sort()
                                                    .map(val => (
                                                        <option key={val} value={val!} className="bg-[#0f172a] text-white">{val}</option>
                                                    ))}
                                            </select>
                                        </div>
                                    )}
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
                                        disabled={!isLocked}
                                        value={arrearSelectedPeriod}
                                        onChange={e => setArrearSelectedPeriod(e.target.value)}
                                        title={!isLocked ? "Freeze payroll to configure filters" : "Select Arrear Batch"}
                                        aria-label="Select Arrear Batch"
                                        className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {arrearHistory.map(b => (
                                            <option key={`${b.month}-${b.year}`} value={`${b.month}-${b.year}`} className="bg-[#0f172a] text-white">
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
                        disabled={isGenerating}
                        title={isGenerating ? "Generating Report..." : "Generate and Download Selection"}
                        aria-label={isGenerating ? "Generating Report..." : "Generate and Download Selection"}
                        className={`w-full py-4 font-black rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all mt-6 ${!isLocked
                            ? 'bg-slate-800 hover:bg-slate-700 text-amber-500 border border-slate-600'
                            : (isWin7
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl border border-white/20'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20')
                            }`}
                    >
                        {isGenerating ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                        ) : !isLocked ? (
                            <>
                                <Lock size={20} /> LOCK PAYROLL TO DOWNLOAD (CLICK HERE)
                            </>
                        ) : (
                            <>
                                <Download size={20} /> DOWNLOAD REPORT
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* SECURITY PIN VERIFICATION MODAL */}
            {showPinModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-amber-500/30 shadow-2xl overflow-hidden flex flex-col p-6 gap-6 transform animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center gap-3">
                            <div className="w-16 h-16 bg-amber-900/30 text-amber-500 rounded-full flex items-center justify-center border border-amber-500/20 shadow-xl shadow-amber-900/20">
                                <Lock size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Security Authorization</h3>
                                <p className="text-xs text-slate-400 font-medium mt-1 px-4 leading-relaxed">
                                    {pinPurpose === 'BEFORE_BACKUP' ? (
                                        <>Enter your Security Password / PIN to initiate the <span className="text-white font-black whitespace-nowrap">'Before Confirmation'</span> data backup.</>
                                    ) : (
                                        <>Enter your Security Password / PIN to authorize the <span className="text-white font-black whitespace-nowrap">'After Freezing'</span> process and rollover.</>
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="relative">
                                <label className="text-[10px] font-bold text-amber-500/50 uppercase tracking-widest mb-1.5 block">ENTER SECURITY PASSWORD / PIN</label>
                                <div className="relative">
                                    <input
                                        type={pinShow ? "text" : "password"}
                                        autoFocus
                                        className={`w-full bg-slate-950 border ${pinError ? 'border-red-500/50' : 'border-slate-700'} rounded-xl p-4 text-center text-lg font-mono tracking-[0.5em] text-white outline-none focus:border-amber-500 transition-all`}
                                        value={pinInput}
                                        onChange={e => { 
                                            const val = e.target.value;
                                            setPinInput(val); 
                                            setPinError(''); 
                                            if (val.length === 6) {
                                                pinVerifyBtnRef.current?.focus();
                                            }
                                        }}
                                        onKeyDown={e => e.key === 'Enter' && handlePinVerify()}
                                        placeholder="••••••"
                                        title="Enter your Payroll Security Password / PIN"
                                    />
                                    <button
                                        onClick={() => setPinShow(!pinShow)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-500 transition-colors"
                                        title={pinShow ? "Hide PIN" : "Show PIN"}
                                    >
                                        {pinShow ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {pinError && (
                                    <p className="text-[10px] text-red-400 font-bold mt-2 text-center flex items-center justify-center gap-1">
                                        <AlertTriangle size={10} /> {pinError}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    ref={pinVerifyBtnRef}
                                    onClick={handlePinVerify}
                                    className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-black text-sm rounded-xl shadow-lg shadow-amber-900/30 transition-all uppercase tracking-widest transform hover:scale-[1.02] active:scale-95 focus:ring-4 focus:ring-amber-500/50 outline-none"
                                >
                                    Verify & Proceed
                                </button>
                                <button
                                    onClick={() => { setShowPinModal(false); setPinInput(''); setPinError(''); }}
                                    className="w-full py-3 text-slate-400 hover:text-slate-200 font-bold text-xs transition-colors uppercase tracking-widest"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
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
                                title="Close Modal"
                                aria-label="Close Modal"
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
                                                        {data.reason === 'ON LOP' ? (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    className="bg-slate-800/40 border border-slate-700 text-slate-500 rounded-lg px-3 py-2 text-xs w-20 cursor-not-allowed outline-none"
                                                                    value="-"
                                                                    disabled
                                                                    placeholder="-"
                                                                    title="Exit Date Disabled (ON LOP)"
                                                                    aria-label="Exit Date Disabled (ON LOP)"
                                                                />
                                                                <span className="text-xs text-slate-500 font-mono font-bold select-none">-</span>
                                                            </div>
                                                        ) : (() => {
                                                            const currentMIdx = months.indexOf(month);
                                                            const currentYear = year;

                                                            const prevDate = new Date(currentYear, currentMIdx - 1, 1);
                                                            const prevMIdx = prevDate.getMonth();
                                                            const prevYear = prevDate.getFullYear();

                                                            const curDate = new Date(currentYear, currentMIdx, 1);
                                                            const curMIdx = curDate.getMonth();
                                                            const curYear = curDate.getFullYear();

                                                            let selectedYear = curYear;
                                                            let selectedMIdx = curMIdx;
                                                            let selectedDay = 1;

                                                            if (data.dol) {
                                                                const parts = data.dol.split('-');
                                                                if (parts.length === 3) {
                                                                    selectedYear = parseInt(parts[0], 10);
                                                                    selectedMIdx = parseInt(parts[1], 10) - 1;
                                                                    selectedDay = parseInt(parts[2], 10);
                                                                }
                                                            }

                                                            // Ensure selected month matches either prev or cur; if not, default to current
                                                            const isPrevSelected = selectedYear === prevYear && selectedMIdx === prevMIdx;
                                                            const isCurSelected = selectedYear === curYear && selectedMIdx === curMIdx;
                                                            if (!isPrevSelected && !isCurSelected) {
                                                                selectedYear = curYear;
                                                                selectedMIdx = curMIdx;
                                                            }

                                                            const totalDaysInSelectedMonth = new Date(selectedYear, selectedMIdx + 1, 0).getDate();
                                                            if (selectedDay > totalDaysInSelectedMonth) {
                                                                selectedDay = totalDaysInSelectedMonth;
                                                            }

                                                            const daysArray = Array.from({ length: totalDaysInSelectedMonth }, (_, i) => i + 1);

                                                            return (
                                                                <div className="flex items-center gap-2">
                                                                    {/* Day Selector */}
                                                                    <select
                                                                        className="bg-[#0f172a] border border-slate-600 rounded-lg px-2 py-1.5 text-white text-xs w-16 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all custom-scrollbar"
                                                                        value={selectedDay}
                                                                        onChange={(e) => {
                                                                            const dayVal = e.target.value;
                                                                            if (dayVal) {
                                                                                const newDol = `${selectedYear}-${String(selectedMIdx + 1).padStart(2, '0')}-${String(dayVal).padStart(2, '0')}`;
                                                                                handleExitChange(r.employeeId, 'dol', newDol);
                                                                            }
                                                                        }}
                                                                        title={`Select Day of Leaving for ${emp?.name}`}
                                                                        aria-label={`Select Day of Leaving for ${emp?.name}`}
                                                                    >
                                                                        {daysArray.map(d => (
                                                                            <option key={d} value={d}>
                                                                                {String(d).padStart(2, '0')}
                                                                            </option>
                                                                        ))}
                                                                    </select>

                                                                    {/* Month Selector */}
                                                                    <select
                                                                        className="bg-[#0f172a] border border-slate-600 rounded-lg px-2 py-1.5 text-white text-xs w-24 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all custom-scrollbar"
                                                                        value={`${selectedYear}-${selectedMIdx}`}
                                                                        onChange={(e) => {
                                                                            const [newYStr, newMStr] = e.target.value.split('-');
                                                                            const newY = parseInt(newYStr, 10);
                                                                            const newM = parseInt(newMStr, 10);
                                                                            const maxDays = new Date(newY, newM + 1, 0).getDate();
                                                                            const adjustedDay = selectedDay > maxDays ? maxDays : selectedDay;
                                                                            const newDol = `${newY}-${String(newM + 1).padStart(2, '0')}-${String(adjustedDay).padStart(2, '0')}`;
                                                                            handleExitChange(r.employeeId, 'dol', newDol);
                                                                        }}
                                                                        title={`Select Month of Leaving for ${emp?.name}`}
                                                                        aria-label={`Select Month of Leaving for ${emp?.name}`}
                                                                    >
                                                                        <option value={`${prevYear}-${prevMIdx}`}>{months[prevMIdx]}</option>
                                                                        <option value={`${curYear}-${curMIdx}`}>{months[curMIdx]}</option>
                                                                    </select>

                                                                    {/* Frozen Year Label */}
                                                                    <span className="text-xs text-slate-400 font-mono font-bold select-none">
                                                                        {` - ${selectedYear}`}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}
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
                                                            ₹ {(() => {
                                                                const adv = advanceLedgers.find(a => a.employeeId === r.employeeId);
                                                                const pending = adv ? (adv.balance + (adv.recovery || 0)) : 0;
                                                                return formatIndianNumber(Math.round(pending));
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            className="bg-[#0f172a] border border-slate-600 rounded-lg px-3 py-2 text-white text-xs w-full focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
                                                            value={data.reason}
                                                            onChange={(e) => handleExitChange(r.employeeId, 'reason', e.target.value)}
                                                            title={`Select separation reason for ${emp?.name}`}
                                                            aria-label={`Select separation reason for ${emp?.name}`}
                                                        >
                                                            <option value="" className="bg-[#0f172a] text-white">Select Reason...</option>
                                                            <option value="ON LOP" className="bg-[#0f172a] text-white">ON LOP</option>
                                                            <option value="Resignation" className="bg-[#0f172a] text-white">Resignation</option>
                                                            <option value="Retirement" className="bg-[#0f172a] text-white">Retirement</option>
                                                            <option value="Termination" className="bg-[#0f172a] text-white">Termination</option>
                                                            <option value="Death" className="bg-[#0f172a] text-white">Death</option>
                                                            <option value="Absconding" className="bg-[#0f172a] text-white">Absconding</option>
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
                                    title="Cancel Operation"
                                    aria-label="Cancel Operation"
                                    className="px-6 py-2.5 rounded-xl border border-slate-600 text-slate-300 font-bold text-xs hover:bg-slate-800 transition-all uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={processExitAndFreeze}
                                    title="Proceed and Freeze Payroll"
                                    aria-label="Proceed and Freeze Payroll"
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
                        <button onClick={handleModalClose} title="Close Modal" aria-label="Close Modal" className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                        <div className="flex flex-col items-center gap-2">
                            <div className={`p-3 rounded-full border ${modalState.type === 'error' ? 'bg-red-900/30 text-red-500 border-red-900/50' : modalState.type === 'success' ? 'bg-emerald-900/30 text-emerald-500 border-emerald-900/50' : 'bg-blue-900/30 text-blue-500 border-blue-900/50'}`}>
                                {modalState.type === 'error' ? <AlertTriangle size={24} /> : modalState.type === 'success' ? <CheckCircle2 size={24} /> : <Lock size={24} />}
                            </div>
                            <h3 className="text-lg font-bold text-white text-center">{modalState.title}</h3>
                            <div className="text-sm text-slate-400 text-center whitespace-pre-line w-full">{modalState.message}</div>
                        </div>
                        <div className="mt-4 w-full">
                            {modalState.type === 'backup_check' ? (
                                <div className="flex flex-col gap-2 w-full">
                                    <div className="flex gap-3">
                                        <button onClick={handleModalClose} title="Cancel Action" aria-label="Cancel Action" className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 font-bold hover:bg-slate-800 transition-colors text-xs uppercase tracking-wider">Cancel</button>
                                        <button onClick={() => { handleModalClose(); modalState.onConfirm?.(); }} title="Confirm OK" aria-label="Confirm OK" className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg text-xs uppercase tracking-wider">OK</button>
                                    </div>
                                    <button onClick={() => { handleModalClose(); onNavigate('settings', 'DATA'); }} title="Initiate Backup" aria-label="Initiate Backup" className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-wider">
                                        <Database size={12} /> Initiate Backup
                                    </button>
                                </div>
                            ) : modalState.type === 'confirm' ? (
                                <div className="flex gap-3 w-full">
                                    <button onClick={handleModalClose} title="Cancel Action" aria-label="Cancel Action" className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 font-bold hover:bg-slate-800 transition-colors">Cancel</button>
                                    <button onClick={modalState.onConfirm} title="Confirm Action" aria-label="Confirm Action" className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg">Confirm</button>
                                </div>
                            ) : (
                                <button onClick={handleModalClose} title="Close Modal" aria-label="Close Modal" className="w-full py-2.5 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition-colors">Close</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
