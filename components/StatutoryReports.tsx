
import React, { useMemo, useState } from 'react';
import { ShieldCheck, FileSpreadsheet, FileCode, FileText, Download, Eye, ScrollText, Landmark, Lock, AlertTriangle, Scale, BookOpen, X, Book, ClipboardList, Building, Calendar, User, LogOut } from 'lucide-react';
import { PayrollResult, Employee, StatutoryConfig, Attendance, LeaveLedger, AdvanceLedger, CompanyProfile } from '../types';
import { generatePFECR, generateESIReturn, generatePTReport, generateTDSReport, generateCodeOnWagesReport, generatePFForm12A, generatePFForm12, generateFormB, generateCentralWageSlip, generateFormC, generateTNFormR, generateTNFormT, generateTNFormP, generatePFForm3A, generatePFForm6A, generateESIExitReport, generateESICodeWagesReport } from '../services/reportService';

interface StatutoryReportsProps {
  payrollHistory: PayrollResult[];
  employees: Employee[];
  config: StatutoryConfig;
  companyProfile: CompanyProfile;
  globalMonth: string;
  setGlobalMonth: (m: string) => void;
  globalYear: number;
  setGlobalYear: (y: number) => void;
  // Added optional props for extended reports
  attendances?: Attendance[];
  leaveLedgers?: LeaveLedger[];
  advanceLedgers?: AdvanceLedger[];
}

const StatutoryReports: React.FC<StatutoryReportsProps> = ({ 
    payrollHistory,
    employees,
    config,
    companyProfile,
    globalMonth,
    setGlobalMonth,
    globalYear,
    setGlobalYear,
    attendances = [],
    leaveLedgers = [],
    advanceLedgers = []
}) => {
  const [showCode88Modal, setShowCode88Modal] = useState(false);
  
  // Date Range Modal State
  const [rangeModal, setRangeModal] = useState({
    isOpen: false,
    reportType: '',
    startMonth: 'April',
    startYear: globalYear,
    endMonth: 'March',
    endYear: globalYear + 1,
    selectedEmployee: 'ALL' // New field for individual selection
  });
  
  // Dynamic Year Range: Current Year - 5 to Current Year + 1
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Check if current month is finalized
  const isFinalized = useMemo(() => {
    const records = payrollHistory.filter(r => r.month === globalMonth && r.year === globalYear);
    return records.length > 0 && records[0].status === 'Finalized';
  }, [payrollHistory, globalMonth, globalYear]);

  // Hacky way to get attendance for Form C if not passed (though now it should be passed)
  const getAttendanceData = (): Attendance[] => {
      if (attendances.length > 0) return attendances;
      try {
          const saved = localStorage.getItem('app_attendance');
          if (saved) return JSON.parse(saved);
      } catch (e) { console.error(e); }
      return [];
  };

  const openRangeModal = (reportType: string) => {
    // Determine Financial Year based on global selection for default
    // If selected Jan 2025, default range should be Apr 2024 - Mar 2025
    const isJanToMar = ['January', 'February', 'March'].includes(globalMonth);
    const fyStartYear = isJanToMar ? globalYear - 1 : globalYear;

    setRangeModal({
        isOpen: true,
        reportType,
        startMonth: 'April',
        startYear: fyStartYear,
        endMonth: 'March',
        endYear: fyStartYear + 1,
        selectedEmployee: 'ALL'
    });
  };

  const handleGenerateRange = () => {
    try {
        if (rangeModal.reportType === 'Form 3A') {
            generatePFForm3A(
                payrollHistory, 
                employees, 
                config, 
                rangeModal.startMonth, 
                rangeModal.startYear, 
                rangeModal.endMonth, 
                rangeModal.endYear,
                rangeModal.selectedEmployee === 'ALL' ? undefined : rangeModal.selectedEmployee,
                companyProfile
            );
        } else if (rangeModal.reportType === 'Form 6A') {
            generatePFForm6A(
                payrollHistory, 
                employees, 
                config, 
                rangeModal.startMonth, 
                rangeModal.startYear, 
                rangeModal.endMonth, 
                rangeModal.endYear,
                companyProfile
            );
        }
    } catch (e: any) {
        alert(`Error generating report: ${e.message}`);
    }
    setRangeModal({ ...rangeModal, isOpen: false });
  };

  const handleDownload = (reportName: string, format: string) => {
    // 1. Basic Filter for Monthly Reports
    const currentData = payrollHistory.filter(r => r.month === globalMonth && r.year === globalYear);
    const fileName = `${reportName.replace(/ /g, '_')}_${globalMonth}_${globalYear}`;
    const attData = getAttendanceData();

    try {
        if (reportName.includes('ECR')) {
             if (currentData.length === 0) throw new Error("No finalized data for this month.");
             generatePFECR(currentData, employees, format as any, fileName);
        } else if (reportName.includes('ESI Code Wages')) {
             generateESICodeWagesReport(currentData, employees, format as any, fileName, companyProfile);
        } else if (reportName.includes('ESI Exit')) {
             generateESIExitReport(currentData, employees, globalMonth, globalYear, companyProfile);
        } else if (reportName.includes('ESI')) {
             if (currentData.length === 0) throw new Error("No finalized data for this month.");
             generateESIReturn(currentData, employees, format as any, fileName, companyProfile);
        } else if (reportName.includes('PT') || reportName.includes('Professional')) {
             generatePTReport(currentData, employees, fileName, companyProfile);
        } else if (reportName.includes('Form 16A') || reportName.includes('Income Tax')) {
             generateTDSReport(currentData, employees, fileName, companyProfile);
        } else if (reportName.includes('Code 88') || reportName.includes('Social Security')) {
             generateCodeOnWagesReport(currentData, employees, format as any, fileName, companyProfile);
        } else if (reportName.includes('Form 12A (Revised)')) {
             if (currentData.length === 0) throw new Error("No finalized data for this month.");
             generatePFForm12A(currentData, employees, config, companyProfile, globalMonth, globalYear);
        } else if (reportName.includes('Form 12 (Old)')) {
             if (currentData.length === 0) throw new Error("No finalized data for this month.");
             generatePFForm12(currentData, employees, config, globalMonth, globalYear, companyProfile);
        } else if (reportName.includes('Form B') || reportName.includes('Pay Sheet (Central)')) {
             generateFormB(currentData, employees, globalMonth, globalYear, companyProfile);
        } else if (reportName.includes('Pay Slip (Central)')) {
             generateCentralWageSlip(currentData, employees, globalMonth, globalYear);
        } else if (reportName.includes('Form C') || reportName.includes('Muster Roll')) {
             generateFormC(currentData, employees, attData, globalMonth, globalYear, companyProfile);
        } else if (reportName.includes('TN Form R')) {
             generateTNFormR(currentData, employees, globalMonth, globalYear, companyProfile);
        } else if (reportName.includes('TN Form T')) {
             generateTNFormT(currentData, employees, attData, leaveLedgers, globalMonth, globalYear, companyProfile);
        } else if (reportName.includes('TN Form P')) {
             generateTNFormP(currentData, employees, advanceLedgers, globalMonth, globalYear, companyProfile);
        } else if (reportName.includes('Form 3A')) {
             openRangeModal('Form 3A');
        } else if (reportName.includes('Form 6A')) {
             openRangeModal('Form 6A');
        } else if (reportName.includes('Form')) {
             alert(`${reportName} generation is a premium feature coming soon. Please use ECR/Returns for filing.`);
        } else {
            alert("Report generation not implemented for this type yet.");
        }
    } catch (e: any) {
        console.error("Report Generation Error", e);
        alert(`Failed to generate report: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1e293b] p-6 rounded-xl border border-slate-800">
        <div>
           <h2 className="text-2xl font-black text-white">Statutory Reports</h2>
           <p className="text-slate-400 text-sm">Mandatory compliance forms for PF, ESI, Professional Tax, and Income Tax.</p>
        </div>
        <div className="flex items-center gap-3">
             <select 
                value={globalMonth} 
                onChange={e => setGlobalMonth(e.target.value)} 
                className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500"
             >
                {months.map(m => (<option key={m} value={m}>{m}</option>))}
             </select>
             <select value={globalYear} onChange={e => setGlobalYear(+e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white">
                {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                ))}
             </select>
        </div>
      </div>

      {!isFinalized ? (
          <div className="flex flex-col items-center justify-center p-12 bg-[#1e293b] rounded-2xl border border-slate-800 text-center space-y-4">
              <div className="p-4 bg-slate-900 rounded-full text-slate-500">
                  <Lock size={48} />
              </div>
              <h3 className="text-xl font-bold text-white">Reports Locked</h3>
              <p className="text-slate-400 max-w-md">
                  Statutory reports can only be generated after the payroll for 
                  <span className="text-blue-400 font-bold"> {globalMonth} {globalYear} </span> 
                  has been confirmed and frozen.
              </p>
              <p className="text-xs text-slate-500">Go to "Run Payroll" &gt; "Calculate" &gt; "Confirm & Freeze Data"</p>
          </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* NEW: Tamil Nadu Shops & Establishment Act Reports */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl col-span-1 md:col-span-2">
          <div className="bg-[#0f172a] p-4 border-b border-slate-800 flex items-center gap-2">
            <Building className="text-emerald-500" size={20} />
            <h3 className="font-bold text-white text-sm">Tamil Nadu Shops & Establishment Act Reports</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* 1. Register of Wages (Form R) */}
             <div className="flex-1 p-4 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-emerald-500/30 transition-all group">
                <div className="flex items-center gap-3 mb-2">
                    <FileText size={24} className="text-emerald-400" />
                    <div>
                        <h4 className="font-bold text-slate-200">1. Form R</h4>
                        <p className="text-xs text-slate-500">Register of Wages</p>
                    </div>
                </div>
                <button onClick={() => handleDownload('TN Form R', 'PDF')} className="w-full mt-4 flex items-center justify-center gap-2 py-2 bg-emerald-900/20 text-emerald-300 font-bold text-xs rounded-lg hover:bg-emerald-900/40 transition-colors">
                    <Eye size={14} /> View PDF
                </button>
             </div>

             {/* 2. Wage Slip (Form T) */}
             <div className="flex-1 p-4 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-emerald-500/30 transition-all group">
                <div className="flex items-center gap-3 mb-2">
                    <ScrollText size={24} className="text-emerald-400" />
                    <div>
                        <h4 className="font-bold text-slate-200">2. Form T</h4>
                        <p className="text-xs text-slate-500">Wage Slip / Leave Card</p>
                    </div>
                </div>
                <button onClick={() => handleDownload('TN Form T', 'PDF')} className="w-full mt-4 flex items-center justify-center gap-2 py-2 bg-emerald-900/20 text-emerald-300 font-bold text-xs rounded-lg hover:bg-emerald-900/40 transition-colors">
                    <Download size={14} /> Download PDF
                </button>
             </div>

             {/* 3. Register of Advance (Form P) */}
             <div className="flex-1 p-4 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-emerald-500/30 transition-all group">
                <div className="flex items-center gap-3 mb-2">
                    <ClipboardList size={24} className="text-emerald-400" />
                    <div>
                        <h4 className="font-bold text-slate-200">3. Form P</h4>
                        <p className="text-xs text-slate-500">Register of Advances & Fines</p>
                    </div>
                </div>
                <button onClick={() => handleDownload('TN Form P', 'PDF')} className="w-full mt-4 flex items-center justify-center gap-2 py-2 bg-emerald-900/20 text-emerald-300 font-bold text-xs rounded-lg hover:bg-emerald-900/40 transition-colors">
                    <Eye size={14} /> View PDF
                </button>
             </div>
          </div>
        </div>

        {/* Existing Central Law Reports */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl col-span-1 md:col-span-2">
          <div className="bg-[#0f172a] p-4 border-b border-slate-800 flex items-center gap-2">
            <Book className="text-purple-500" size={20} />
            <h3 className="font-bold text-white text-sm">Central Law Report (Small Establishments / Central Rules)</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* 1. Pay Sheet (Form B) */}
             <div className="flex-1 p-4 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-purple-500/30 transition-all group">
                <div className="flex items-center gap-3 mb-2">
                    <FileText size={24} className="text-purple-400" />
                    <div>
                        <h4 className="font-bold text-slate-200">1. Register of Wages (Form B)</h4>
                        <p className="text-xs text-slate-500">Wage Register</p>
                    </div>
                </div>
                <button onClick={() => handleDownload('Form B', 'PDF')} className="w-full mt-4 flex items-center justify-center gap-2 py-2 bg-purple-900/20 text-purple-300 font-bold text-xs rounded-lg hover:bg-purple-900/40 transition-colors">
                    <Eye size={14} /> View PDF
                </button>
             </div>

             {/* 2. Pay Slip (Form XIX) */}
             <div className="flex-1 p-4 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-purple-500/30 transition-all group">
                <div className="flex items-center gap-3 mb-2">
                    <ScrollText size={24} className="text-purple-400" />
                    <div>
                        <h4 className="font-bold text-slate-200">2. Pay Slip (Form XIX)</h4>
                        <p className="text-xs text-slate-500">Wage Slips [Rule 78(1)(b)]</p>
                    </div>
                </div>
                <button onClick={() => handleDownload('Pay Slip (Central)', 'PDF')} className="w-full mt-4 flex items-center justify-center gap-2 py-2 bg-purple-900/20 text-purple-300 font-bold text-xs rounded-lg hover:bg-purple-900/40 transition-colors">
                    <Download size={14} /> Download PDF
                </button>
             </div>

             {/* 3. Muster Roll (Form C) */}
             <div className="flex-1 p-4 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-purple-500/30 transition-all group">
                <div className="flex items-center gap-3 mb-2">
                    <ClipboardList size={24} className="text-purple-400" />
                    <div>
                        <h4 className="font-bold text-slate-200">3. Muster Roll (Form C)</h4>
                        <p className="text-xs text-slate-500">Attendance Register</p>
                    </div>
                </div>
                <button onClick={() => handleDownload('Form C', 'PDF')} className="w-full mt-4 flex items-center justify-center gap-2 py-2 bg-purple-900/20 text-purple-300 font-bold text-xs rounded-lg hover:bg-purple-900/40 transition-colors">
                    <Eye size={14} /> View PDF
                </button>
             </div>
          </div>
        </div>

        {/* 1. Provident Fund (EPF) - SPLIT: Now col-span-1 */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl col-span-1">
          <div className="bg-[#0f172a] p-4 border-b border-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-blue-500" size={20} />
            <h3 className="font-bold text-white text-sm">Provident Fund (EPF)</h3>
          </div>
          {/* Changed internal grid to grid-cols-1 to stack vertically since card is narrower */}
          <div className="p-6 grid grid-cols-1 gap-6">
            
            {/* Returns & Analytics */}
            <div className="space-y-4">
               <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Electronic Returns & Impact</h4>
               
               {/* ECR */}
               <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">ECR (Electronic Challan)</span>
                    <span className="text-[9px] px-2 py-0.5 bg-green-900/30 text-green-400 rounded border border-green-900/50">Monthly</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDownload('PF ECR', 'Excel')} className="flex-1 flex items-center justify-center gap-2 text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-2 rounded hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all">
                      <FileSpreadsheet size={12} /> Excel
                    </button>
                    <button onClick={() => handleDownload('PF ECR', 'Text')} className="flex-1 flex items-center justify-center gap-2 text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-2 rounded hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all">
                      <FileCode size={12} /> Text
                    </button>
                  </div>
               </div>

               {/* Code on Wages */}
               <div className="p-4 rounded-xl bg-amber-900/10 border border-amber-900/30 space-y-3">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Scale size={14} className="text-amber-400" />
                        <span className="text-xs font-bold text-amber-300">Code on Social Security</span>
                      </div>
                      <button 
                        onClick={() => setShowCode88Modal(true)}
                        className="text-[9px] font-bold text-amber-400 hover:text-white bg-amber-900/40 px-2 py-1 rounded transition-colors flex items-center gap-1"
                      >
                        <BookOpen size={10} /> Read
                      </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDownload('Code 88 Impact Report', 'Excel')} className="flex-1 flex items-center justify-center gap-2 text-[10px] font-bold bg-amber-900/20 text-amber-400 px-2 py-2 rounded hover:bg-amber-900/40 border border-amber-900/30 transition-all">
                      <FileSpreadsheet size={12} /> Excel
                    </button>
                    <button onClick={() => handleDownload('Code 88 Impact Report', 'PDF')} className="flex-1 flex items-center justify-center gap-2 text-[10px] font-bold bg-amber-900/20 text-amber-400 px-2 py-2 rounded hover:bg-amber-900/40 border border-amber-900/30 transition-all">
                      <FileText size={12} /> PDF
                    </button>
                  </div>
               </div>
            </div>

            {/* Statutory Forms */}
            <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Statutory Registers</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800 transition-colors border border-slate-800/50">
                    <span className="text-xs font-medium text-slate-300">Form 12A (Revised) - Calculation Sheet</span>
                    <button onClick={() => handleDownload('Form 12A (Revised)', 'PDF')} className="text-blue-400 hover:text-white transition-colors p-1.5 bg-blue-900/20 rounded">
                      <FileText size={14} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800 transition-colors border border-slate-800/50">
                    <span className="text-xs font-medium text-slate-300">Form 12 (Old) - Monthly Statement</span>
                    <button onClick={() => handleDownload('Form 12 (Old)', 'PDF')} className="text-blue-400 hover:text-white transition-colors p-1.5 bg-blue-900/20 rounded">
                      <FileText size={14} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800 transition-colors border border-slate-800/50">
                    <span className="text-xs font-medium text-slate-300">Form 3A (Annual Contribution Card)</span>
                    <button onClick={() => handleDownload('Form 3A', 'PDF')} className="text-blue-400 hover:text-white transition-colors p-1.5 bg-blue-900/20 rounded">
                      <FileText size={14} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800 transition-colors border border-slate-800/50">
                    <span className="text-xs font-medium text-slate-300">Form 6A (Annual Consolidated)</span>
                    <button onClick={() => handleDownload('Form 6A', 'PDF')} className="text-blue-400 hover:text-white transition-colors p-1.5 bg-blue-900/20 rounded">
                      <FileText size={14} />
                    </button>
                  </div>
                </div>
            </div>
          </div>
        </div>

        {/* 2. Employee State Insurance (ESI) - SPLIT: Now col-span-1 */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl col-span-1">
          <div className="bg-[#0f172a] p-4 border-b border-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-pink-500" size={20} />
            <h3 className="font-bold text-white text-sm">ESI Corporation</h3>
          </div>
          {/* Changed internal grid to grid-cols-1 to stack vertically */}
          <div className="p-6 grid grid-cols-1 gap-6">
            
            {/* Monthly Return & Impact - MOVED UP */}
            <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Online Contribution & Impact</h4>
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">Monthly ESI Return</span>
                        <span className="text-[9px] px-2 py-0.5 bg-pink-900/30 text-pink-400 rounded border border-pink-900/50">Mandatory</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handleDownload('Monthly ESI', 'Excel')} className="flex-1 flex items-center justify-center gap-2 text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-2 rounded hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all">
                        <FileSpreadsheet size={14} /> Excel (Upload)
                        </button>
                        <button onClick={() => handleDownload('Monthly ESI View', 'PDF')} className="flex-1 flex items-center justify-center gap-2 text-[10px] font-bold bg-slate-800 text-slate-300 px-4 py-2 rounded hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition-all">
                        <Eye size={14} /> View PDF
                        </button>
                    </div>
                    
                    {/* Exit Report Button */}
                    <button onClick={() => handleDownload('ESI Exit Report', 'PDF')} className="w-full flex items-center justify-center gap-2 text-[10px] font-bold bg-red-900/10 text-red-400 px-4 py-2 rounded hover:bg-red-900/20 border border-red-900/30 transition-all">
                        <LogOut size={14} /> List of Employees Out of Coverage
                    </button>
                </div>

                {/* ESI on Code Wages Report Block */}
                <div className="p-4 rounded-xl bg-pink-900/10 border border-pink-900/30 space-y-3">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Scale size={14} className="text-pink-400" />
                        <span className="text-xs font-bold text-pink-300">ESI on Code Wages</span>
                      </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDownload('ESI Code Wages', 'Excel')} className="flex-1 flex items-center justify-center gap-2 text-[10px] font-bold bg-pink-900/20 text-pink-400 px-2 py-2 rounded hover:bg-pink-900/40 border border-pink-900/30 transition-all">
                      <FileSpreadsheet size={12} /> Excel
                    </button>
                    <button onClick={() => handleDownload('ESI Code Wages', 'PDF')} className="flex-1 flex items-center justify-center gap-2 text-[10px] font-bold bg-pink-900/20 text-pink-400 px-2 py-2 rounded hover:bg-pink-900/40 border border-pink-900/30 transition-all">
                      <FileText size={12} /> PDF
                    </button>
                  </div>
               </div>
            </div>

            {/* Registers - MOVED DOWN */}
            <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Registers & Declaration</h4>
                <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800/50">
                    <span className="text-xs font-medium text-slate-300">Form 1 (Declaration)</span>
                    <button onClick={() => handleDownload('ESI Form 1', 'PDF')} className="flex items-center gap-2 text-xs font-bold bg-pink-900/20 text-pink-400 px-3 py-1.5 rounded hover:bg-pink-900/40 transition-colors">
                        <Eye size={14} /> View
                    </button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800/50">
                    <span className="text-xs font-medium text-slate-300">Form 6 (Register of Employees)</span>
                    <button onClick={() => handleDownload('ESI Form 6', 'PDF')} className="flex items-center gap-2 text-xs font-bold bg-pink-900/20 text-pink-400 px-3 py-1.5 rounded hover:bg-pink-900/40 transition-colors">
                        <Eye size={14} /> View
                    </button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800/50">
                    <span className="text-xs font-medium text-slate-300">Form 7 (Register of Contributions)</span>
                    <button onClick={() => handleDownload('ESI Form 7', 'PDF')} className="flex items-center gap-2 text-xs font-bold bg-pink-900/20 text-pink-400 px-3 py-1.5 rounded hover:bg-pink-900/40 transition-colors">
                        <Eye size={14} /> View
                    </button>
                    </div>
                </div>
            </div>

          </div>
        </div>

        {/* 3. Professional Tax */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="bg-[#0f172a] p-4 border-b border-slate-800 flex items-center gap-2">
            <ScrollText className="text-amber-500" size={20} />
            <h3 className="font-bold text-white text-sm">Professional Tax</h3>
          </div>
          <div className="p-4 flex gap-3">
            <button onClick={() => handleDownload('PT Half-Yearly', 'PDF')} className="flex-1 flex flex-col items-center justify-center gap-2 p-4 bg-slate-900/50 rounded-xl hover:bg-slate-800 border border-slate-800 transition-all group">
              <FileText size={24} className="text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-slate-300">Half-yearly Return</span>
            </button>
            <button onClick={() => handleDownload('PT Annual', 'PDF')} className="flex-1 flex flex-col items-center justify-center gap-2 p-4 bg-slate-900/50 rounded-xl hover:bg-slate-800 border border-slate-800 transition-all group">
              <FileText size={24} className="text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-slate-300">Annual Return</span>
            </button>
          </div>
        </div>

        {/* 4. Income Tax */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="bg-[#0f172a] p-4 border-b border-slate-800 flex items-center gap-2">
            <Landmark className="text-emerald-500" size={20} />
            <h3 className="font-bold text-white text-sm">Income Tax (TDS)</h3>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-800">
              <div>
                 <h4 className="font-bold text-sm text-white">Form 16A</h4>
                 <p className="text-[10px] text-slate-500">Employee-wise TDS Certificate</p>
              </div>
              <button onClick={() => handleDownload('Form 16A', 'PDF')} className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-lg transition-colors shadow-lg">
                <Download size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* RANGE SELECTION MODAL */}
      {rangeModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setRangeModal({ ...rangeModal, isOpen: false })} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                    <X size={20} />
                </button>
                <div className="flex flex-col items-center gap-2 mb-2">
                    <div className="p-3 bg-blue-900/30 text-blue-400 rounded-full border border-blue-900/50">
                        <Calendar size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white">Select Period Range</h3>
                    <p className="text-xs text-slate-400 text-center">Define the Start and End period for <span className="text-sky-400 font-bold">{rangeModal.reportType}</span></p>
                </div>
                
                <div className="space-y-4">
                    {/* FROM PERIOD */}
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">From Period</label>
                        <div className="flex gap-2">
                            <select 
                                value={rangeModal.startMonth}
                                onChange={(e) => setRangeModal({ ...rangeModal, startMonth: e.target.value })}
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white"
                            >
                                {months.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <select 
                                value={rangeModal.startYear}
                                onChange={(e) => setRangeModal({ ...rangeModal, startYear: Number(e.target.value) })}
                                className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white"
                            >
                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* TO PERIOD */}
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">To Period</label>
                        <div className="flex gap-2">
                            <select 
                                value={rangeModal.endMonth}
                                onChange={(e) => setRangeModal({ ...rangeModal, endMonth: e.target.value })}
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white"
                            >
                                {months.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <select 
                                value={rangeModal.endYear}
                                onChange={(e) => setRangeModal({ ...rangeModal, endYear: Number(e.target.value) })}
                                className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white"
                            >
                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Employee Selection for Form 3A */}
                    {rangeModal.reportType === 'Form 3A' && (
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                                <span className="flex items-center gap-2"><User size={12} /> Select Employee</span>
                            </label>
                            <select 
                                value={rangeModal.selectedEmployee}
                                onChange={(e) => setRangeModal({ ...rangeModal, selectedEmployee: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white"
                            >
                                <option value="ALL">ALL EMPLOYEES (Bulk)</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button 
                        onClick={handleGenerateRange}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition-colors mt-2"
                    >
                        GENERATE REPORT
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default StatutoryReports;
