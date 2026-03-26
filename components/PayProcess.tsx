import React, { useState, useRef, useMemo } from 'react';
import { CalendarDays, Calculator, CalendarClock, Wallet, RefreshCw, Gavel, FileSpreadsheet, Upload, CheckCircle2, X, ArrowRight, GitMerge, Lock, TrendingUp, Clock, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, Attendance, PayrollResult, StatutoryConfig, AlertType } from '../types';
import { generateExcelWorkbook, getStandardFileName } from '../services/reportService';
import { usePayrollData } from '../hooks/usePayrollData';
import { usePayrollPeriod } from '../hooks/usePayrollPeriod';

import AttendanceManager from './AttendanceManager';
import LedgerManager from './LedgerManager';
import PayrollProcessor from './PayrollProcessor';
import PayCycleGateway from './PayCycleGateway';
import FineManager from './FineManager';
import ArrearManager from './ArrearManager';
import OverTimeManager from './OverTimeManager';

interface PayProcessProps {
    employees: Employee[];
    statutoryConfig: StatutoryConfig;
    results: PayrollResult[];
    setResults: React.Dispatch<React.SetStateAction<PayrollResult[]>>;
    payrollPeriod: { month: string; year: number; };
    setPayrollPeriod: (p: { month: string; year: number; }) => void;
    showAlert: (type: AlertType, title: string, message: React.ReactNode, onConfirm?: () => void, onCancel?: () => void) => string;
}

const PayProcess: React.FC<PayProcessProps> = ({ 
    employees, 
    statutoryConfig, 
    results, 
    setResults, 
    payrollPeriod, 
    setPayrollPeriod, 
    showAlert 
}) => {
    const { 
        companyProfile,
        attendances,
        setAttendances,
        leaveLedgers,
        setLeaveLedgers,
        advanceLedgers,
        setAdvanceLedgers,
        leavePolicy,
        fines,
        setFines,
        arrearHistory,
        setArrearHistory,
        setEmployees
    } = usePayrollData(showAlert);

    const { activePeriod } = usePayrollPeriod();

    const [activeTab, setActiveTab] = useState<'attendance' | 'ledgers' | 'fines' | 'overtime' | 'arrears' | 'payroll'>('attendance');
    const [isGatewayOpen, setIsGatewayOpen] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const masterFileInputRef = useRef<HTMLInputElement>(null);

    const month = payrollPeriod.month;
    const year = payrollPeriod.year;

    // Compute lock status
    const isLocked = useMemo(() => {
        return results.some(r => r.month === month && r.year === year && r.status === 'Finalized');
    }, [results, month, year]);

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            title={`Switch to ${label} tab`}
            aria-label={`Switch to ${label} tab`}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all text-xs whitespace-nowrap ${activeTab === id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
        >
            <Icon size={16} />
            {label}
        </button>
    );

    const downloadMasterTemplate = async () => {
        try {
            const headers = [
                "Employee ID", "Name",
                "Present Days", "EL (Availed)", "EL Encash", "SL (Sick)", "CL (Casual)", "LOP",
                "OT Days", "OT Hours",
                "New Advance", "Monthly EMI", "Adv Manual Pay",
                "Income Tax", "Fine Amount", "Fine Reason"
            ];

            const activeEmps = employees.filter(emp => !emp.dol);

            const data = activeEmps.map(emp => {
                const att = attendances.find(a => a.employeeId === emp.id && a.month === month && a.year === year);
                const adv = advanceLedgers.find(a => a.employeeId === emp.id);
                const fine = fines.find(f => f.employeeId === emp.id && f.month === month && f.year === year);

                return [
                    emp.id,
                    emp.name,
                    att?.presentDays ?? 0,
                    att?.earnedLeave ?? 0,
                    att?.encashedDays ?? 0,
                    att?.sickLeave ?? 0,
                    att?.casualLeave ?? 0,
                    att?.lopDays ?? 0,
                    att?.otDays ?? 0,
                    att?.otHours ?? 0,
                    adv?.totalAdvance ?? 0,
                    adv?.emiCount ?? 0,
                    adv?.manualPayment ?? 0,
                    fine?.tax ?? 0,
                    fine?.amount ?? 0,
                    fine?.reason ?? ''
                ];
            });

            const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Master_Input");
            const fileName = getStandardFileName('Master_Payroll_Template', companyProfile, month, year);
            await generateExcelWorkbook(wb, fileName);
            showAlert('success', 'Template Downloaded', 'Master payroll template has been generated.');
        } catch (error: any) {
            showAlert('error', 'Download Failed', error.message);
        }
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
                const wb = XLSX.read(bstr, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) throw new Error("File is empty or invalid format");

                const newAttendances = [...attendances];
                const newAdvanceLedgers = [...advanceLedgers];
                const newFines = fines.filter(f => !(f.month === month && f.year === year));

                const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const daysInMonth = new Date(year, months.indexOf(month) + 1, 0).getDate();

                data.forEach((row: any) => {
                    const empId = String(row['Employee ID'] || row['ID'] || '').trim();
                    if (!empId) return;

                    const attIdx = newAttendances.findIndex(a => a.employeeId === empId && a.month === month && a.year === year);
                    const attRecord: Attendance = {
                        employeeId: empId,
                        month: month,
                        year: year,
                        presentDays: Math.min(Number(row['Present Days'] ?? 0), daysInMonth),
                        earnedLeave: Number(row['EL (Availed)'] ?? 0),
                        encashedDays: Number(row['EL Encash'] ?? 0),
                        sickLeave: Number(row['SL (Sick)'] ?? 0),
                        casualLeave: Number(row['CL (Casual)'] ?? 0),
                        lopDays: Number(row['LOP'] ?? 0),
                        otDays: Number(row['OT Days'] ?? 0),
                        otHours: Number(row['OT Hours'] ?? 0)
                    };

                    if (attIdx >= 0) newAttendances[attIdx] = attRecord;
                    else newAttendances.push(attRecord);

                    // Adv Recovery Logic
                    const advIdx = newAdvanceLedgers.findIndex(a => a.employeeId === empId);
                    const totalAdvance = Number(row['New Advance'] ?? 0);
                    const monthlyEMI = Number(row['Monthly EMI'] ?? 0);
                    const paidManual = Number(row['Adv Manual Pay'] ?? 0);

                    if (advIdx >= 0) {
                        const ledger = newAdvanceLedgers[advIdx];
                        ledger.totalAdvance = totalAdvance;
                        ledger.emiCount = monthlyEMI;
                        ledger.manualPayment = paidManual;
                        const totalBal = (ledger.opening || 0) + totalAdvance;
                        ledger.recovery = paidManual > 0 ? Math.min(paidManual, totalBal) : (monthlyEMI > 0 ? Math.min(Math.round(totalBal / monthlyEMI), totalBal) : 0);
                        ledger.balance = Math.max(0, totalBal - ledger.recovery);
                    } else if (totalAdvance > 0) {
                        newAdvanceLedgers.push({
                            employeeId: empId,
                            opening: 0,
                            totalAdvance,
                            emiCount: monthlyEMI,
                            manualPayment: paidManual,
                            recovery: paidManual > 0 ? Math.min(paidManual, totalAdvance) : (monthlyEMI > 0 ? Math.min(Math.round(totalAdvance / monthlyEMI), totalAdvance) : 0),
                            balance: 0
                        });
                    }

                    const fineAmt = Number(row['Fine Amount'] ?? 0);
                    const taxVal = Number(row['Income Tax'] ?? row['Tax'] ?? 0);

                    if (fineAmt > 0 || taxVal > 0) {
                        newFines.push({
                            employeeId: empId,
                            month: month,
                            year: year,
                            amount: fineAmt,
                            reason: String(row['Fine Reason'] ?? '').trim(),
                            tax: taxVal
                        });
                    }
                });

                setAttendances(newAttendances);
                setAdvanceLedgers(newAdvanceLedgers);
                setFines(newFines);

                setActiveTab('payroll');
                setShowSuccessModal(true);

            } catch (error: any) {
                showAlert('error', 'Import Failed', error.message);
            } finally {
                setIsImporting(false);
                if (masterFileInputRef.current) masterFileInputRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    if (isGatewayOpen) {
        return (
            <PayCycleGateway
                month={month}
                year={year}
                setMonth={(m) => setPayrollPeriod({ ...payrollPeriod, month: m })}
                setYear={(y) => setPayrollPeriod({ ...payrollPeriod, year: y })}
                onProceed={() => setIsGatewayOpen(false)}
            />
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500 relative">

            {/* 1. Header with Bulk Actions */}
            <div className="sticky top-[64px] z-30 bg-[#1e293b]/95 backdrop-blur-md p-4 rounded-xl border border-slate-800 shadow-2xl mb-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-900/30 text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
                            <CalendarClock size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white leading-tight">Monthly Pay Process</h2>
                            <p className="text-slate-400 text-xs">Active Period: <span className="text-white font-bold">{month} {year}</span></p>
                        </div>
                        {isLocked && (
                            <div className="ml-2 px-3 py-1 bg-amber-900/30 border border-amber-600/30 rounded-full flex items-center gap-2">
                                <Lock size={12} className="text-amber-500" />
                                <span className="text-[10px] font-bold text-amber-400 uppercase">Locked</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 p-1 bg-slate-900/50 rounded-lg border border-slate-800">
                            <button onClick={downloadMasterTemplate} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md border border-slate-600 transition-all text-[10px] font-bold uppercase">
                                <FileSpreadsheet size={14} className="text-emerald-500" /> Master Template
                            </button>
                            <button
                                onClick={() => masterFileInputRef.current?.click()}
                                disabled={isImporting || isLocked}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-white rounded-md shadow-lg transition-all text-[10px] font-bold uppercase ${isLocked ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/20'}`}
                            >
                                {isImporting ? <Loader2 size={14} className="animate-spin" /> : (isLocked ? <Lock size={14} /> : <Upload size={14} />)}
                                Import All (1, 2 & 3)
                            </button>
                            <input ref={masterFileInputRef} title="Master File Input" type="file" className="hidden" accept=".xlsx, .xls" onChange={handleMasterImport} />
                        </div>

                        <button
                            onClick={() => setIsGatewayOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f172a] hover:bg-slate-800 text-slate-400 hover:text-white rounded-md border border-slate-700 transition-all text-[10px] font-bold uppercase"
                        >
                            <RefreshCw size={12} /> Change Period
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex gap-1 overflow-x-auto pb-1 mt-4">
                    <TabButton id="attendance" label="1. Attendance" icon={CalendarDays} />
                    <TabButton id="ledgers" label="2. Advances" icon={Wallet} />
                    <TabButton id="fines" label="3. Tax & Fines" icon={Gavel} />
                    <TabButton id="overtime" label="4. Overtime" icon={Clock} />
                    <TabButton id="arrears" label="5. Arrear Salary" icon={TrendingUp} />
                    <TabButton id="payroll" label="6. Run Payroll" icon={Calculator} />
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'attendance' && (
                    <AttendanceManager
                        employees={employees}
                        attendances={attendances}
                        setAttendances={setAttendances}
                        month={month}
                        year={year}
                        setMonth={(m) => setPayrollPeriod({ ...payrollPeriod, month: m })}
                        setYear={(y) => setPayrollPeriod({ ...payrollPeriod, year: y })}
                        savedRecords={results}
                        leaveLedgers={leaveLedgers}
                        setLeaveLedgers={setLeaveLedgers}
                        hideContextSelector={true}
                        companyProfile={companyProfile}
                        activePeriod={activePeriod}
                    />
                )}

                {activeTab === 'ledgers' && (
                    <LedgerManager
                        employees={employees}
                        leaveLedgers={leaveLedgers}
                        setLeaveLedgers={setLeaveLedgers}
                        advanceLedgers={advanceLedgers}
                        setAdvanceLedgers={setAdvanceLedgers}
                        leavePolicy={leavePolicy}
                        month={month}
                        year={year}
                        setMonth={(m) => setPayrollPeriod({ ...payrollPeriod, month: m })}
                        setYear={(y) => setPayrollPeriod({ ...payrollPeriod, year: y })}
                        savedRecords={results}
                        hideContextSelector={true}
                        viewMode="advance"
                        companyProfile={companyProfile}
                        activePeriod={activePeriod}
                    />
                )}

                {activeTab === 'fines' && (
                    <FineManager
                        employees={employees}
                        fines={fines}
                        setFines={setFines}
                        month={month}
                        year={year}
                        savedRecords={results}
                        hideContextSelector={true}
                        companyProfile={companyProfile}
                        activePeriod={activePeriod}
                    />
                )}

                {activeTab === 'overtime' && (
                    <OverTimeManager 
                        employees={employees}
                        attendances={attendances}
                        setAttendances={setAttendances}
                        month={month}
                        year={year}
                        config={statutoryConfig}
                        companyProfile={companyProfile}
                        isLocked={isLocked}
                        showAlert={showAlert}
                    />
                )}

                {activeTab === 'arrears' && (
                    <ArrearManager
                        employees={employees}
                        setEmployees={setEmployees}
                        currentMonth={month}
                        currentYear={year}
                        companyProfile={companyProfile}
                        arrearHistory={arrearHistory}
                        setArrearHistory={setArrearHistory}
                        savedRecords={results}
                        showAlert={showAlert}
                        activePeriod={activePeriod}
                    />
                )}

                {activeTab === 'payroll' && (
                    <PayrollProcessor
                        employees={employees}
                        config={statutoryConfig}
                        companyProfile={companyProfile}
                        attendances={attendances}
                        leaveLedgers={leaveLedgers}
                        advanceLedgers={advanceLedgers}
                        savedRecords={results}
                        setSavedRecords={setResults}
                        month={month}
                        year={year}
                        setMonth={(m) => setPayrollPeriod({ ...payrollPeriod, month: m })}
                        setYear={(y) => setPayrollPeriod({ ...payrollPeriod, year: y })}
                        setLeaveLedgers={setLeaveLedgers}
                        setAdvanceLedgers={setAdvanceLedgers}
                        fines={fines}
                        hideContextSelector={true}
                    />
                )}
            </div>

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-emerald-500/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                        <button onClick={() => setShowSuccessModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
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
                        <button onClick={() => setShowSuccessModal(false)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-2">
                            CONTINUE <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PayProcess;
