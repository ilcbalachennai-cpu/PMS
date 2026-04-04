import React, { useState, useRef, useMemo } from 'react';
import { CalendarDays, Calculator, CalendarClock, Wallet, RefreshCw, Gavel, FileSpreadsheet, CheckCircle2, X, ArrowRight, GitMerge, Lock, TrendingUp, UploadCloud, AlertCircle, RotateCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, Attendance, LeaveLedger, AdvanceLedger, PayrollResult, StatutoryConfig, LeavePolicy, CompanyProfile, User, FineRecord, ArrearBatch, OTRecord } from '../types';
import { generateTemplateWorkbook, getStandardFileName } from '../services/reportService';
import { ModalType } from './Shared/CustomModal';
import AttendanceManager from './AttendanceManager';
import LedgerManager from './LedgerManager';
import PayrollProcessor from './PayrollProcessor';
import PayCycleGateway from './PayCycleGateway';
import FineManager from './FineManager';
import ArrearManager from './ArrearManager';
import OTManager from './OTManager';

interface PayProcessProps {
    employees: Employee[];
    setEmployees?: (emps: Employee[]) => void;
    config: StatutoryConfig;
    companyProfile: CompanyProfile;
    attendances: Attendance[];
    setAttendances: (att: Attendance[]) => void;
    leaveLedgers: LeaveLedger[];
    setLeaveLedgers: (l: LeaveLedger[]) => void;
    advanceLedgers: AdvanceLedger[];
    setAdvanceLedgers: (a: AdvanceLedger[]) => void;
    savedRecords: PayrollResult[];
    setSavedRecords: React.Dispatch<React.SetStateAction<PayrollResult[]>>;
    leavePolicy: LeavePolicy;
    month: string;
    setMonth: (m: string) => void;
    year: number;
    setYear: (y: number) => void;
    currentUser?: User;
    fines: FineRecord[];
    setFines: (fines: FineRecord[]) => void;
    arrearHistory?: ArrearBatch[];
    setArrearHistory?: React.Dispatch<React.SetStateAction<ArrearBatch[]>>;
    otRecords: OTRecord[];
    setOTRecords: React.Dispatch<React.SetStateAction<OTRecord[]>>;
    showAlert: (type: ModalType, title: string, message: string, onConfirm?: () => void) => void;
}

// Global OS Detection for UI refinement
const isWin7 = /Windows NT 6.1/.test(window.navigator.userAgent);

const PayProcess: React.FC<PayProcessProps> = (props) => {
    const [activeTab, setActiveTab] = useState<'attendance' | 'ledgers' | 'fines' | 'overtime' | 'arrears' | 'payroll'>('attendance');
    const [isGatewayOpen, setIsGatewayOpen] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const masterFileInputRef = useRef<HTMLInputElement>(null);

    // Compute lock status
    const isLocked = useMemo(() => {
        return props.savedRecords.some(r => r.month === props.month && r.year === props.year && r.status === 'Finalized');
    }, [props.savedRecords, props.month, props.year]);

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            title={`Switch to ${label} tab`}
            aria-label={`Switch to ${label} tab`}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black transition-all text-xs whitespace-nowrap relative group ${activeTab === id
                ? (isWin7 
                    ? 'bg-blue-600/50 text-white shadow-[0_0_20px_rgba(37,99,235,0.25)] border border-blue-400/50' 
                    : 'bg-blue-600 text-white shadow-lg')
                : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
                }`}
        >
            {activeTab === id && isWin7 && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-blue-500 rounded-t-full shadow-[0_0_12px_#3b82f6]"></div>
            )}
            <Icon size={16} className={`${activeTab === id ? (isWin7 ? 'text-blue-400' : 'text-white') : 'text-slate-500'} group-hover:text-blue-400 transition-colors`} />
            {label}
        </button>
    );

    const downloadMasterTemplate = async () => {
        const headers = [
            "Employee ID", "Name",
            "Present Days", "EL (Availed)", "EL Encash", "SL (Sick)", "CL (Casual)", "LOP",
            "Opening Advance", "New Advance", "Monthly EMI", "Adv Manual Pay",
            "Income Tax", "Fine Amount", "Fine Reason", "OT Days", "OT Hours"
        ];

        const activeEmps = props.employees.filter(e => !e.dol);

        const data = activeEmps.map(emp => {
            const att = props.attendances.find(a => a.employeeId === emp.id && a.month === props.month && a.year === props.year);
            const adv = props.advanceLedgers.find(a => a.employeeId === emp.id);
            const fine = props.fines.find(f => f.employeeId === emp.id && f.month === props.month && f.year === props.year);

            return [
                emp.id,
                emp.name,
                att?.presentDays || 0,
                att?.earnedLeave || 0,
                att?.encashedDays || 0,
                att?.sickLeave || 0,
                att?.casualLeave || 0,
                att?.lopDays || 0,
                adv?.opening || 0,
                adv?.totalAdvance || 0,
                adv?.monthlyInstallment || 0,
                adv?.paidAmount || 0,
                fine?.tax || 0,
                fine?.amount || 0,
                fine?.reason || '',
                props.otRecords.find(r => r.employeeId === emp.id && r.month === props.month && r.year === props.year)?.otDays || 0,
                props.otRecords.find(r => r.employeeId === emp.id && r.month === props.month && r.year === props.year)?.otHours || 0
            ];
        });

        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Master_Input");
        const fileName = getStandardFileName('Master_Payroll_Template', props.companyProfile, props.month, props.year);
        await generateTemplateWorkbook(wb, fileName);
    };

    const handleMasterImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isLocked) return;
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();

        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) throw new Error("File is empty");

                const newAttendances = [...props.attendances];
                const newAdvanceLedgers = [...props.advanceLedgers];
                const newFines = props.fines.filter(f => !(f.month === props.month && f.year === props.year));
                const newOTRecords = [...props.otRecords];

                const daysInMonth = new Date(props.year, ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(props.month) + 1, 0).getDate();

                data.forEach((row: any) => {
                    const empId = String(row['Employee ID'] || row['ID'] || '').trim();
                    if (!empId) return;

                    const emp = props.employees.find(e => e.id === empId);
                    if (!emp) return;

                    // 1. OT PROCESSING
                    const otDays = Number(row['OT Days'] || 0);
                    const otHours = Number(row['OT Hours'] || 0);
                    
                    if (otDays > 0 || otHours > 0) {
                        let baseAmount = 0;
                        if (props.config.otComponents.basic) baseAmount += emp.basicPay;
                        if (props.config.otComponents.da) baseAmount += (emp.da || 0);
                        if (props.config.otComponents.retaining) baseAmount += (emp.retainingAllowance || 0);
                        if (props.config.otComponents.hra) baseAmount += (emp.hra || 0);
                        if (props.config.otComponents.conveyance) baseAmount += (emp.conveyance || 0);
                        if (props.config.otComponents.washing) baseAmount += (emp.washing || 0);
                        if (props.config.otComponents.attire) baseAmount += (emp.attire || 0);
                        if (props.config.otComponents.special1) baseAmount += (emp.specialAllowance1 || 0);
                        if (props.config.otComponents.special2) baseAmount += (emp.specialAllowance2 || 0);
                        if (props.config.otComponents.special3) baseAmount += (emp.specialAllowance3 || 0);

                        const rate = baseAmount / daysInMonth;
                        const otAmount = Math.round(rate * (props.config.otCalculationFactor || 1) * (otDays + (otHours / 8)));

                        const otIdx = newOTRecords.findIndex(r => r.employeeId === empId && r.month === props.month && r.year === props.year);
                        const otRecord: OTRecord = { employeeId: empId, month: props.month, year: props.year, otDays, otHours, otRate: rate, otAmount };
                        
                        if (otIdx >= 0) newOTRecords[otIdx] = otRecord;
                        else newOTRecords.push(otRecord);
                    }

                    // 2. ATTENDANCE PROCESSING
                    const attIdx = newAttendances.findIndex(a => a.employeeId === empId && a.month === props.month && a.year === props.year);
                    const attRecord: Attendance = {
                        employeeId: empId,
                        month: props.month,
                        year: props.year,
                        presentDays: Math.min(Number(row['Present Days'] || 0), daysInMonth),
                        earnedLeave: Number(row['EL (Availed)'] || 0),
                        encashedDays: Number(row['EL Encash'] || 0),
                        sickLeave: Number(row['SL (Sick)'] || 0),
                        casualLeave: Number(row['CL (Casual)'] || 0),
                        lopDays: Number(row['LOP'] || 0)
                    };
                    if (attIdx >= 0) newAttendances[attIdx] = attRecord;
                    else newAttendances.push(attRecord);

                    // 3. ADVANCE PROCESSING
                    const advIdx = newAdvanceLedgers.findIndex(a => a.employeeId === empId);
                    const opening = Number(row['Opening Advance'] || 0);
                    const totalAdvance = Number(row['New Advance'] || 0);
                    const monthlyEMI = Number(row['Monthly EMI'] || 0);
                    const paidManual = Number(row['Adv Manual Pay'] || 0);

                    if (advIdx >= 0) {
                        const ledger = newAdvanceLedgers[advIdx];
                        ledger.opening = opening;
                        ledger.totalAdvance = totalAdvance;
                        ledger.emiCount = monthlyEMI;
                        ledger.manualPayment = paidManual;
                        ledger.paidAmount = paidManual; // Sync with legacy field
                        ledger.monthlyInstallment = monthlyEMI; // Sync with legacy field

                        const totalBal = opening + totalAdvance;
                        let recovery = 0;
                        if (paidManual > 0) {
                            recovery = Math.min(paidManual, totalBal);
                        } else if (monthlyEMI > 0) {
                            recovery = Math.min(Math.round(totalBal / monthlyEMI), totalBal);
                        }
                        ledger.recovery = recovery;
                        ledger.balance = Math.max(0, totalBal - recovery);
                    } else if (opening > 0 || totalAdvance > 0 || monthlyEMI > 0) {
                        const totalBal = opening + totalAdvance;
                        let recovery = 0;
                        if (paidManual > 0) {
                            recovery = Math.min(paidManual, totalBal);
                        } else if (monthlyEMI > 0) {
                            recovery = Math.min(Math.round(totalBal / monthlyEMI), totalBal);
                        }
                        newAdvanceLedgers.push({
                            employeeId: empId,
                            opening: opening,
                            totalAdvance,
                            emiCount: monthlyEMI,
                            monthlyInstallment: monthlyEMI,
                            manualPayment: paidManual,
                            paidAmount: paidManual,
                            recovery,
                            balance: Math.max(0, totalBal - recovery)
                        });
                    }

                    // 4. FINE/TAX PROCESSING
                    const fineAmt = Number(row['Fine Amount'] || 0);
                    const fineReason = String(row['Fine Reason'] || '').trim();
                    const taxKeys = ['Income Tax', 'Tax', 'TDS'];
                    let taxVal = 0;
                    for (const k of taxKeys) {
                        if (row[k] !== undefined) {
                            taxVal = Number(row[k]);
                            break;
                        }
                    }

                    if (fineAmt > 0 || taxVal > 0) {
                        newFines.push({
                            employeeId: empId,
                            month: props.month,
                            year: props.year,
                            amount: fineAmt,
                            reason: fineReason,
                            tax: taxVal
                        });
                    }
                });

                props.setAttendances(newAttendances);
                props.setAdvanceLedgers(newAdvanceLedgers);
                props.setFines(newFines);
                props.setOTRecords(newOTRecords);

                setActiveTab('payroll');
                setShowSuccessModal(true);

            } catch (error) {
                console.error(error);
                alert("Error processing Master Import. Please check the file format.");
            } finally {
                setIsImporting(false);
                if (masterFileInputRef.current) masterFileInputRef.current.value = "";
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleMasterReset = () => {
        if (isLocked) return;

        props.showAlert('confirm', 'MASTER DATA RESET', 'This will CLEAR ALL Attendance, Advances (Current), Fines, and OT data for the current period. Opening balances will be preserved. Proceed?', () => {
            // 1. Reset Attendance
            const newAttendances = props.attendances.filter(a => !(a.month === props.month && a.year === props.year));
            props.setAttendances(newAttendances);

            // 2. Reset Fines
            const newFines = props.fines.filter(f => !(f.month === props.month && f.year === props.year));
            props.setFines(newFines);

            // 3. Reset OT
            const newOT = props.otRecords.filter(r => !(r.month === props.month && r.year === props.year));
            props.setOTRecords(newOT);

            // 4. Reset Arrears (if applicable)
            if (props.setArrearHistory) {
                const newArrears = (props.arrearHistory || []).filter(b => !(b.month === props.month && b.year === props.year));
                props.setArrearHistory(newArrears);
            }

            // 5. Reset Advances
            const newAdvances = props.advanceLedgers.map(adv => ({
                ...adv,
                totalAdvance: 0,
                emiCount: 0,
                manualPayment: 0,
                paidAmount: 0,
                monthlyInstallment: 0,
                recovery: 0,
                balance: adv.opening || 0
            }));
            props.setAdvanceLedgers(newAdvances);

            setActiveTab('attendance');
        });
    };

    // GATEWAY VIEW
    if (isGatewayOpen) {
        return (
            <PayCycleGateway
                month={props.month}
                setMonth={props.setMonth}
                year={props.year}
                setYear={props.setYear}
                onProceed={() => setIsGatewayOpen(false)}
                savedRecords={props.savedRecords}
            />
        );
    }

    // MAIN WORKSPACE VIEW
    return (
        <div className="space-y-4 animate-in fade-in duration-500 relative">

            {/* 1. Compact Header with Bulk Actions */}
            <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-800 shadow-xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-900/30 text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
                            <CalendarClock size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white leading-tight uppercase tracking-tight">Monthly Pay Process</h2>
                            <p className="text-slate-400 text-[10px] font-bold">Active Period: <span className="text-white">{props.month} {props.year}</span></p>
                        </div>
                        {isLocked && (
                            <div className="ml-2 px-2 py-0.5 bg-amber-900/30 border border-amber-600/30 rounded-full flex items-center gap-1.5">
                                <Lock size={10} className="text-amber-500" />
                                <span className="text-[9px] font-bold text-amber-400">Locked</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={downloadMasterTemplate}
                                className="flex items-center gap-1.5 bg-slate-800 text-slate-200 px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition-all border border-slate-700 hover:bg-slate-700 shadow-lg text-xs"
                            >
                                <FileSpreadsheet size={15} className="text-emerald-500" /> Master Template
                            </button>

                            <button
                                onClick={() => masterFileInputRef.current?.click()}
                                disabled={isImporting || isLocked}
                                className={`flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition-all shadow-lg disabled:opacity-50 disabled:bg-slate-700 text-xs`}
                                title={isLocked ? "Payroll is Finalized" : "Import Consolidated Data"}
                                aria-label={isLocked ? "Payroll is Finalized" : "Import Consolidated Data (Attendance, Advances, Fines)"}
                            >
                                {isImporting ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : (isLocked ? <Lock size={15} /> : <UploadCloud size={15} />)}
                                Import all
                            </button>
                            <input ref={masterFileInputRef} title="Master File Input" aria-label="Master File Input" type="file" className="hidden" accept=".xlsx, .xls" onChange={handleMasterImport} />
                        </div>

                        <div className="w-[1px] h-6 bg-slate-700 mx-1 hidden lg:block"></div>

                        <button
                            onClick={() => setIsGatewayOpen(true)}
                            title="Change Processing Period"
                            aria-label="Change Payroll Processing Period"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f172a] hover:bg-slate-800 text-slate-300 hover:text-white rounded-md border border-slate-700 transition-all text-[10px] font-bold uppercase"
                        >
                            <RefreshCw size={12} />
                            Change Period
                        </button>

                        <button
                            onClick={handleMasterReset}
                            disabled={isLocked}
                            title="Reset all input data for this month"
                            aria-label="Reset all input data for this month"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-md border border-red-900/30 transition-all text-[10px] font-bold uppercase disabled:opacity-30 disabled:grayscale"
                        >
                            <RotateCw size={12} />
                            Master Reset
                        </button>
                    </div>
                </div>

                {/* Compact Instruction Strip */}
                <div className="mt-4 mb-2 flex items-center justify-center relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                    <div className="relative bg-[#1e293b] px-3">
                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1">
                            <GitMerge size={10} /> Use Master Import "OR" Individual Tabs Below
                        </span>
                    </div>
                </div>

                {/* 2. Navigation Tabs */}
                <div className="flex gap-1 overflow-x-auto pb-2 custom-scrollbar">
                    <TabButton id="attendance" label="1. Attendance" icon={CalendarDays} />
                    <TabButton id="ledgers" label="2. Advances" icon={Wallet} />
                    <TabButton id="fines" label="3. Tax & Fines" icon={Gavel} />
                    {props.config.enableOT && <TabButton id="overtime" label="4. Overtime" icon={CalendarClock} />}
                    {props.config.enableArrearSalary && <TabButton id="arrears" label="5. Arrear Salary" icon={TrendingUp} />}
                    <TabButton id="payroll" label="6. Run Payroll" icon={Calculator} />
                </div>
            </div>

            {/* 3. Content Area */}
            <div className="min-h-[500px]">
                <div className={activeTab === 'attendance' ? 'block' : 'hidden'}>
                    <AttendanceManager
                        employees={props.employees}
                        attendances={props.attendances}
                        setAttendances={props.setAttendances}
                        month={props.month}
                        year={props.year}
                        setMonth={props.setMonth}
                        setYear={props.setYear}
                        savedRecords={props.savedRecords}
                        leaveLedgers={props.leaveLedgers}
                        setLeaveLedgers={props.setLeaveLedgers}
                        hideContextSelector={true}
                        companyProfile={props.companyProfile}
                    />
                </div>

                <div className={activeTab === 'ledgers' ? 'block' : 'hidden'}>
                    <LedgerManager
                        employees={props.employees}
                        leaveLedgers={props.leaveLedgers}
                        setLeaveLedgers={props.setLeaveLedgers}
                        advanceLedgers={props.advanceLedgers}
                        setAdvanceLedgers={props.setAdvanceLedgers}
                        leavePolicy={props.leavePolicy}
                        month={props.month}
                        year={props.year}
                        setMonth={props.setMonth}
                        setYear={props.setYear}
                        savedRecords={props.savedRecords}
                        hideContextSelector={true}
                        viewMode="advance"
                        companyProfile={props.companyProfile}
                    />
                </div>

                <div className={activeTab === 'fines' ? 'block' : 'hidden'}>
                    <FineManager
                        employees={props.employees}
                        fines={props.fines}
                        setFines={props.setFines}
                        month={props.month}
                        year={props.year}
                        savedRecords={props.savedRecords}
                        hideContextSelector={true}
                        companyProfile={props.companyProfile}
                    />
                </div>

                <div className={activeTab === 'overtime' ? 'block' : 'hidden'}>
                    {props.config.enableOT ? (
                        <OTManager
                            employees={props.employees}
                            otRecords={props.otRecords}
                            setOTRecords={props.setOTRecords}
                            config={props.config}
                            month={props.month}
                            year={props.year}
                            savedRecords={props.savedRecords}
                            companyProfile={props.companyProfile}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[50vh] bg-[#0f172a]/30 rounded-2xl border border-slate-800/50 backdrop-blur-sm text-center px-6">
                            <div className="bg-amber-500/10 p-4 rounded-full mb-6 ring-8 ring-amber-500/5">
                                <AlertCircle size={64} className="text-amber-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">OT Policy Not Activated</h3>
                            <div className="flex flex-col gap-1 text-slate-400 max-w-md">
                                <p className="text-sm">
                                    Go to <span className="text-blue-400 font-bold">Configuration</span> → <span className="text-blue-400 font-bold">Statutory Rule</span> → <span className="text-blue-400 font-bold">OverTime Policy</span> to
                                </p>
                                <p className="text-sm">activate this module and configure components.</p>
                                <p className="text-sm border-t border-slate-800 mt-4 pt-4 text-[11px] uppercase font-black tracking-widest text-blue-500 opacity-60">Overtime Management Module</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className={activeTab === 'arrears' ? 'block' : 'hidden'}>
                    {props.config.enableArrearSalary ? (
                        <ArrearManager
                            employees={props.employees}
                            setEmployees={props.setEmployees || (() => { })}
                            currentMonth={props.month}
                            currentYear={props.year}
                            companyProfile={props.companyProfile}
                            arrearHistory={props.arrearHistory}
                            setArrearHistory={props.setArrearHistory}
                            savedRecords={props.savedRecords}
                            showAlert={props.showAlert}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[50vh] bg-[#0f172a]/30 rounded-2xl border border-slate-800/50 backdrop-blur-sm text-center px-6">
                            <div className="bg-emerald-500/10 p-4 rounded-full mb-6 ring-8 ring-emerald-500/5">
                                <AlertCircle size={64} className="text-emerald-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Arrear Module Not Activated</h3>
                            <div className="flex flex-col gap-1 text-slate-400 max-w-md">
                                <p className="text-sm">
                                    Go to <span className="text-blue-400 font-bold">Configuration</span> → <span className="text-blue-400 font-bold">Statutory Rule</span> → <span className="text-blue-400 font-bold">Arrear Salary Module</span> to
                                </p>
                                <p className="text-sm">activate this module.</p>
                                <p className="text-sm border-t border-slate-800 mt-4 pt-4 text-[11px] uppercase font-black tracking-widest text-emerald-500 opacity-60">Arrear Salary Management</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className={activeTab === 'payroll' ? 'block' : 'hidden'}>
                    <PayrollProcessor
                        employees={props.employees}
                        config={props.config}
                        companyProfile={props.companyProfile}
                        attendances={props.attendances}
                        leaveLedgers={props.leaveLedgers}
                        advanceLedgers={props.advanceLedgers}
                        savedRecords={props.savedRecords}
                        setSavedRecords={props.setSavedRecords}
                        month={props.month}
                        year={props.year}
                        setMonth={props.setMonth}
                        setYear={props.setYear}
                        setLeaveLedgers={props.setLeaveLedgers}
                        setAdvanceLedgers={props.setAdvanceLedgers}
                        hideContextSelector={true}
                        currentUser={props.currentUser}
                        fines={props.fines}
                        otRecords={props.otRecords}
                    />
                </div>
            </div>

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-emerald-500/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                        <button title="Close Modal" aria-label="Close Modal" onClick={() => setShowSuccessModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="p-4 bg-emerald-900/30 text-emerald-400 rounded-full border border-emerald-500/50 mb-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                                <CheckCircle2 size={40} />
                            </div>
                            <h3 className="text-xl font-black text-white">Import Successful</h3>
                            <p className="text-sm text-slate-300 leading-relaxed">
                                Master Data of Attendance, Advance & Fine has been successfully updated.
                            </p>
                            <div className="w-full h-px bg-slate-700 my-1"></div>
                            <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider animate-pulse">
                                Proceed to run Calculate Sheet
                            </p>
                        </div>
                        <button onClick={() => setShowSuccessModal(false)} title="Continue to Payroll Processing" aria-label="Continue to Payroll Processing" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-2">
                            CONTINUE <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PayProcess;
