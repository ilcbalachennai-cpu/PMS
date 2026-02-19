
import React, { useState, useRef, useMemo } from 'react';
import { CalendarDays, ClipboardList, Calculator, CalendarClock, Wallet, RefreshCw, Gavel, FileSpreadsheet, Upload, CheckCircle2, X, ArrowRight, GitMerge, Lock, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, Attendance, LeaveLedger, AdvanceLedger, PayrollResult, StatutoryConfig, LeavePolicy, CompanyProfile, User, FineRecord, ArrearBatch } from '../types';
import AttendanceManager from './AttendanceManager';
import LedgerManager from './LedgerManager';
import PayrollProcessor from './PayrollProcessor';
import PayCycleGateway from './PayCycleGateway';
import FineManager from './FineManager';
import ArrearManager from './ArrearManager';

interface PayProcessProps {
  employees: Employee[];
  setEmployees?: (emps: Employee[]) => void; // Added setter
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
}

const PayProcess: React.FC<PayProcessProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'ledgers' | 'fines' | 'arrears' | 'payroll'>('attendance');
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
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all text-xs whitespace-nowrap ${
        activeTab === id 
          ? 'bg-blue-600 text-white shadow-lg' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  const downloadMasterTemplate = () => {
    const headers = [
        "Employee ID", "Name", 
        "Present Days", "EL (Availed)", "EL Encash", "SL (Sick)", "CL (Casual)", "LOP",
        "New Advance", "Monthly EMI", "Adv Manual Pay",
        "Income Tax", "Fine Amount", "Fine Reason"
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
            adv?.totalAdvance || 0,
            adv?.monthlyInstallment || 0,
            adv?.paidAmount || 0,
            fine?.tax || 0,
            fine?.amount || 0,
            fine?.reason || ''
        ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master_Input");
    XLSX.writeFile(wb, `Master_Payroll_Template_${props.month}_${props.year}.xlsx`);
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

            const daysInMonth = new Date(props.year, ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(props.month) + 1, 0).getDate();

            data.forEach((row: any) => {
                const empId = String(row['Employee ID'] || row['ID'] || '').trim();
                if (!empId) return;

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

                const advIdx = newAdvanceLedgers.findIndex(a => a.employeeId === empId);
                const totalAdvance = Number(row['New Advance'] || 0);
                const monthlyEMI = Number(row['Monthly EMI'] || 0);
                const paidManual = Number(row['Adv Manual Pay'] || 0);

                if (advIdx >= 0) {
                    const ledger = newAdvanceLedgers[advIdx];
                    ledger.totalAdvance = totalAdvance;
                    ledger.monthlyInstallment = monthlyEMI;
                    ledger.paidAmount = paidManual;
                    ledger.balance = (ledger.opening || 0) + totalAdvance - paidManual;
                } else if (totalAdvance > 0 || monthlyEMI > 0) {
                    newAdvanceLedgers.push({
                        employeeId: empId,
                        opening: 0,
                        totalAdvance,
                        monthlyInstallment: monthlyEMI,
                        paidAmount: paidManual,
                        balance: totalAdvance - paidManual
                    });
                }

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

  // GATEWAY VIEW
  if (isGatewayOpen) {
    return (
        <PayCycleGateway 
            month={props.month}
            setMonth={props.setMonth}
            year={props.year}
            setYear={props.setYear}
            onProceed={() => setIsGatewayOpen(false)}
        />
    );
  }

  // MAIN WORKSPACE VIEW
  return (
    <div className="space-y-4 animate-in fade-in duration-500 relative">
      
      {/* 1. Compact Header with Bulk Actions */}
      <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-900/30 text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
                    <CalendarClock size={24} />
                </div>
                <div>
                    <h2 className="text-lg font-black text-white leading-tight">Monthly Pay Process</h2>
                    <p className="text-slate-400 text-xs">Active Period: <span className="text-white font-bold">{props.month} {props.year}</span></p>
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
                    <button onClick={downloadMasterTemplate} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md border border-slate-600 transition-all text-[10px] font-bold uppercase" title="Consolidated Template">
                        <FileSpreadsheet size={14} className="text-emerald-500" /> Master Template
                    </button>
                    <button 
                        onClick={() => masterFileInputRef.current?.click()} 
                        disabled={isImporting || isLocked} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-white rounded-md shadow-lg transition-all text-[10px] font-bold uppercase ${isLocked ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/20'}`}
                        title={isLocked ? "Payroll is Finalized" : "Import Consolidated Data"}
                    >
                        {isImporting ? <div className="animate-spin rounded-full h-3 w-3 border-2 border-white/30 border-t-white" /> : (isLocked ? <Lock size={14} /> : <Upload size={14} />)} 
                        Import All (1, 2 & 3)
                    </button>
                    <input ref={masterFileInputRef} type="file" className="hidden" accept=".xlsx, .xls" onChange={handleMasterImport} />
                </div>

                <div className="w-[1px] h-6 bg-slate-700 mx-1 hidden lg:block"></div>

                <button 
                    onClick={() => setIsGatewayOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f172a] hover:bg-slate-800 text-slate-300 hover:text-white rounded-md border border-slate-700 transition-all text-[10px] font-bold uppercase"
                >
                    <RefreshCw size={12} />
                    Change Period
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
        <div className="flex gap-1 overflow-x-auto pb-1">
            <TabButton id="attendance" label="1. Attendance" icon={CalendarDays} />
            <TabButton id="ledgers" label="2. Advances" icon={Wallet} />
            <TabButton id="fines" label="3. Tax & Fines" icon={Gavel} />
            <TabButton id="arrears" label="4. Arrear Salary" icon={TrendingUp} />
            <TabButton id="payroll" label="5. Run Payroll" icon={Calculator} />
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
            />
        </div>

        <div className={activeTab === 'arrears' ? 'block' : 'hidden'}>
            {props.setEmployees ? (
                <ArrearManager
                    employees={props.employees}
                    setEmployees={props.setEmployees}
                    currentMonth={props.month}
                    currentYear={props.year}
                    companyProfile={props.companyProfile}
                    arrearHistory={props.arrearHistory}
                    setArrearHistory={props.setArrearHistory}
                />
            ) : (
                <div className="p-8 text-center text-slate-500">Arrear Module Error: Missing Data Access</div>
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
            />
        </div>
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
