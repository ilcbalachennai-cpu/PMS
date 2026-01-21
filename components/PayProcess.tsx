
import React, { useState } from 'react';
import { CalendarDays, ClipboardList, Calculator, CalendarClock, Wallet } from 'lucide-react';
import { Employee, Attendance, LeaveLedger, AdvanceLedger, PayrollResult, StatutoryConfig, LeavePolicy } from '../types';
import AttendanceManager from './AttendanceManager';
import LedgerManager from './LedgerManager';
import PayrollProcessor from './PayrollProcessor';

interface PayProcessProps {
  employees: Employee[];
  config: StatutoryConfig;
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
}

const PayProcess: React.FC<PayProcessProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'ledgers' | 'payroll'>('attendance');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
        activeTab === id 
          ? 'bg-blue-600 text-white shadow-lg' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* 1. Gateway / Context Selection Header */}
      <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-900/30 text-blue-400 rounded-xl border border-blue-500/20">
                    <CalendarClock size={28} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-white">Monthly Pay Process</h2>
                    <p className="text-slate-400 text-sm">Select the period and complete the 3-step cycle.</p>
                </div>
            </div>

            <div className="flex items-center gap-3 bg-[#0f172a] p-2 rounded-xl border border-slate-700">
                <select 
                    value={props.month}
                    onChange={e => props.setMonth(e.target.value)}
                    className="bg-transparent border-none text-white font-bold text-sm focus:ring-0 cursor-pointer px-2 outline-none"
                >
                    {months.map(m => <option key={m} value={m} className="bg-[#0f172a]">{m}</option>)}
                </select>
                <div className="w-px h-6 bg-slate-700"></div>
                <select 
                    value={props.year}
                    onChange={e => props.setYear(+e.target.value)}
                    className="bg-transparent border-none text-white font-bold text-sm focus:ring-0 cursor-pointer px-2 outline-none"
                >
                    <option value={2024} className="bg-[#0f172a]">2024</option>
                    <option value={2025} className="bg-[#0f172a]">2025</option>
                </select>
            </div>
        </div>

        {/* 2. Navigation Tabs */}
        <div className="flex gap-2 mt-8 border-b border-slate-700 pb-1">
            <TabButton id="attendance" label="1. Attendance" icon={CalendarDays} />
            <TabButton id="ledgers" label="2. Manage Advances" icon={Wallet} />
            <TabButton id="payroll" label="3. Run Payroll" icon={Calculator} />
        </div>
      </div>

      {/* 3. Content Area */}
      <div className="min-h-[500px]">
        {activeTab === 'attendance' && (
            <AttendanceManager 
                employees={props.employees}
                attendances={props.attendances}
                setAttendances={props.setAttendances}
                month={props.month}
                year={props.year}
                setMonth={props.setMonth} // Passed but effectively controlled by parent
                setYear={props.setYear}
                savedRecords={props.savedRecords}
                leaveLedgers={props.leaveLedgers}
                hideContextSelector={true} // New prop to hide internal selector
            />
        )}

        {activeTab === 'ledgers' && (
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
                viewMode="advance" // STRICTLY ADVANCE MODE
            />
        )}

        {activeTab === 'payroll' && (
            <PayrollProcessor 
                employees={props.employees}
                config={props.config}
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
            />
        )}
      </div>
    </div>
  );
};

export default PayProcess;
