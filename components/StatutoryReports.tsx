
import React, { useMemo, useState } from 'react';
import { ShieldCheck, FileText, Download, ScrollText, Landmark, Lock, Heart, HandCoins, Percent, Building, Calendar, X, FileSpreadsheet, Eye, Scale, BookOpen, User, LogOut, ReceiptText, ClipboardList, Info } from 'lucide-react';
import { PayrollResult, Employee, StatutoryConfig, Attendance, LeaveLedger, AdvanceLedger, CompanyProfile } from '../types';
import { 
  generatePFECR, 
  generateESIReturn, 
  generatePTReport, 
  generateTDSReport, 
  generateCodeOnWagesReport, 
  generatePFForm12A, 
  generateFormB, 
  generateFormC, 
  generateTNFormR, 
  generateTNFormT, 
  generateTNFormP, 
  generatePFForm3A, 
  generatePFForm6A, 
  generateESIExitReport, 
  generateESICodeWagesReport, 
  generateGratuityReport 
} from '../services/reportService';

interface StatutoryReportsProps {
  payrollHistory: PayrollResult[];
  employees: Employee[];
  config: StatutoryConfig;
  companyProfile: CompanyProfile;
  globalMonth: string;
  setGlobalMonth: (m: string) => void;
  globalYear: number;
  setGlobalYear: (y: number) => void;
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
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const isFinalized = useMemo(() => {
    const records = payrollHistory.filter(r => r.month === globalMonth && r.year === globalYear);
    return records.length > 0 && records[0].status === 'Finalized';
  }, [payrollHistory, globalMonth, globalYear]);

  const [rangeModal, setRangeModal] = useState({
    isOpen: false,
    reportType: '',
    startMonth: 'April',
    startYear: globalYear,
    endMonth: 'March',
    endYear: globalYear + 1,
    selectedEmployee: 'ALL'
  });

  const openRangeModal = (reportType: string) => {
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
            generatePFForm3A(payrollHistory, employees, config, rangeModal.startMonth, rangeModal.startYear, rangeModal.endMonth, rangeModal.endYear, rangeModal.selectedEmployee === 'ALL' ? undefined : rangeModal.selectedEmployee, companyProfile);
        } else if (rangeModal.reportType === 'Form 6A') {
            generatePFForm6A(payrollHistory, employees, config, rangeModal.startMonth, rangeModal.startYear, rangeModal.endMonth, rangeModal.endYear, companyProfile);
        }
    } catch (e: any) { alert(`Error: ${e.message}`); }
    setRangeModal({ ...rangeModal, isOpen: false });
  };

  const handleDownload = (reportName: string, format: string) => {
    const currentData = payrollHistory.filter(r => r.month === globalMonth && r.year === globalYear);
    const fileName = `${reportName.replace(/ /g, '_')}_${globalMonth}_${globalYear}`;

    try {
        if (reportName.includes('ECR')) {
             generatePFECR(currentData, employees, format as any, fileName);
        } else if (reportName.includes('ESI Code Wages')) {
             generateESICodeWagesReport(currentData, employees, format as any, fileName, companyProfile);
        } else if (reportName.includes('ESI Exit')) {
             generateESIExitReport(currentData, employees, globalMonth, globalYear, companyProfile);
        } else if (reportName.includes('ESI')) {
             generateESIReturn(currentData, employees, format as any, fileName, companyProfile);
        } else if (reportName.includes('PT')) {
             generatePTReport(currentData, employees, fileName, companyProfile);
        } else if (reportName.includes('TDS')) {
             generateTDSReport(currentData, employees, fileName, companyProfile);
        } else if (reportName.includes('Gratuity')) {
             generateGratuityReport(employees, companyProfile);
        } else if (reportName.includes('Social Security')) {
             generateCodeOnWagesReport(currentData, employees, format as any, fileName, companyProfile);
        } else if (reportName.includes('Form 12A')) {
             generatePFForm12A(currentData, employees, config, companyProfile, globalMonth, globalYear);
        } else if (reportName.includes('Form B')) {
             generateFormB(currentData, employees, globalMonth, globalYear, companyProfile);
        } else if (reportName.includes('Form C')) {
             generateFormC(currentData, employees, attendances, globalMonth, globalYear, companyProfile);
        } else if (reportName.includes('TN Form R')) {
             generateTNFormR(currentData, employees, globalMonth, globalYear, companyProfile);
        } else if (reportName.includes('TN Form T')) {
             generateTNFormT(currentData, employees, attendances, leaveLedgers, globalMonth, globalYear, companyProfile);
        } else if (reportName.includes('TN Form P')) {
             generateTNFormP(currentData, employees, advanceLedgers, globalMonth, globalYear, companyProfile);
        } else if (reportName.includes('Form 3A')) {
             openRangeModal('Form 3A');
        } else if (reportName.includes('Form 6A')) {
             openRangeModal('Form 6A');
        }
    } catch (e: any) { alert(`Failed: ${e.message}`); }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1e293b] p-6 rounded-xl border border-slate-800 shadow-xl">
        <div>
            <h2 className="text-2xl font-black text-white">Statutory Returns & Registers</h2>
            <p className="text-slate-400 text-sm">Lawful compliance reporting for EPF, ESI, PT, and State Acts.</p>
        </div>
        <div className="flex items-center gap-3">
             <select value={globalMonth} onChange={e => setGlobalMonth(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500">
                {months.map(m => (<option key={m} value={m}>{m}</option>))}
             </select>
             <select value={globalYear} onChange={e => setGlobalYear(+e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500">
                {yearOptions.map(y => (<option key={y} value={y}>{y}</option>))}
             </select>
        </div>
      </div>

      {!isFinalized ? (
          <div className="flex flex-col items-center justify-center p-12 bg-[#1e293b] rounded-2xl border border-slate-800 text-center space-y-4">
              <div className="p-4 bg-slate-900 rounded-full text-slate-500"><Lock size={48} /></div>
              <h3 className="text-xl font-bold text-white">Compliance View Locked</h3>
              <p className="text-slate-400">Payroll for {globalMonth} {globalYear} must be frozen to generate official reports.</p>
          </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
        
        {/* CLAUSE 88 NOTE */}
        <div className="lg:col-span-2 bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl flex items-start gap-3">
            <Info className="text-indigo-400 shrink-0 mt-1" size={20} />
            <div>
                <h4 className="text-sm font-bold text-indigo-300">Code on Social Security, 2020 (Clause 88) Impact</h4>
                <p className="text-xs text-indigo-200/70 mt-1 leading-relaxed">
                    Per Section 142 of the Code on Social Security 2020 (Clause 88), if the aggregate of specified exclusions (allowances) exceeds 50% of the total remuneration, the excess amount shall be deemed as wages. 
                    The system has automatically adjusted the PF & ESI calculations in the reports below where applicable.
                </p>
            </div>
        </div>

        {/* EPF SECTION */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="bg-[#0f172a] p-4 border-b border-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-blue-500" size={20} />
            <h3 className="font-bold text-white text-sm">Employees' Provident Fund (EPF)</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
             <button onClick={() => handleDownload('PF ECR', 'Excel')} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all group">
                <FileSpreadsheet size={16} className="group-hover:scale-110" /> Monthly ECR (Excel)
             </button>
             <button onClick={() => handleDownload('PF ECR', 'Text')} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all group">
                <FileText size={16} className="group-hover:scale-110" /> ECR (Text File)
             </button>
             <button onClick={() => handleDownload('Form 12A', 'PDF')} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all group">
                <FileText size={16} className="group-hover:scale-110" /> Form 12A (Revised)
             </button>
             <div className="grid grid-cols-2 gap-2">
                 <button onClick={() => openRangeModal('Form 3A')} className="w-full py-3 bg-blue-900/10 hover:bg-blue-900/20 text-blue-300 font-bold text-[10px] rounded-xl border border-blue-900/30 flex flex-col items-center justify-center gap-1 transition-all">
                    <Calendar size={14} /> Form 3A (Annual)
                 </button>
                 <button onClick={() => openRangeModal('Form 6A')} className="w-full py-3 bg-blue-900/10 hover:bg-blue-900/20 text-blue-300 font-bold text-[10px] rounded-xl border border-blue-900/30 flex flex-col items-center justify-center gap-1 transition-all">
                    <Calendar size={14} /> Form 6A (Annual)
                 </button>
             </div>
          </div>
        </div>

        {/* ESI SECTION */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="bg-[#0f172a] p-4 border-b border-slate-800 flex items-center gap-2">
            <Landmark className="text-pink-500" size={20} />
            <h3 className="font-bold text-white text-sm">ESIC Compliance</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
             <button onClick={() => handleDownload('ESI Return', 'Excel')} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-pink-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all group">
                <FileSpreadsheet size={16} className="group-hover:scale-110" /> ESI Return (Excel)
             </button>
             <button onClick={() => handleDownload('ESI Code Wages', 'PDF')} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-pink-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all group">
                <Scale size={16} className="group-hover:scale-110" /> Social Security Code
             </button>
             <button onClick={() => handleDownload('ESI Exit Report', 'Excel')} className="w-full py-3 bg-red-900/10 hover:bg-red-900/20 text-red-400 font-bold text-xs rounded-xl border border-red-900/30 flex items-center justify-center gap-2 transition-all group" title="Employees who crossed ESI ceiling or left service">
                <LogOut size={16} className="group-hover:scale-110" /> ESI Exit List
             </button>
             <button disabled className="w-full py-3 bg-slate-800/50 text-slate-500 font-bold text-xs rounded-xl border border-slate-800 flex items-center justify-center gap-2 cursor-not-allowed">
                <ShieldCheck size={16} /> Form 5 (Half-Yearly)
             </button>
          </div>
        </div>

        {/* TAXATION & DEDUCTIONS */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl lg:col-span-2">
            <div className="bg-[#0f172a] p-4 border-b border-slate-800 flex items-center gap-2">
                <ReceiptText className="text-amber-500" size={20} />
                <h3 className="font-bold text-white text-sm">Professional Tax & Income Tax Recovery</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-900/20 text-amber-500 rounded-lg border border-amber-900/30">
                            <ScrollText size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-200">Professional Tax (PT)</h4>
                            <p className="text-[10px] text-slate-500 uppercase">State-wise Deduction Register</p>
                        </div>
                    </div>
                    <button onClick={() => handleDownload('PT Report', 'Excel')} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors shadow-lg">Download Excel</button>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-900/20 text-sky-500 rounded-lg border border-sky-900/30">
                            <Landmark size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-200">Income Tax (TDS)</h4>
                            <p className="text-[10px] text-slate-500 uppercase">Monthly TDS Recovery Summary</p>
                        </div>
                    </div>
                    <button onClick={() => handleDownload('TDS Report', 'Excel')} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg transition-colors shadow-lg">Download Excel</button>
                </div>
            </div>
        </div>

        {/* CENTRAL LABOR LAWS - FORM B & C */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl lg:col-span-2">
            <div className="bg-[#0f172a] p-4 border-b border-slate-800 flex items-center gap-2">
                <BookOpen className="text-emerald-500" size={20} />
                <h3 className="font-bold text-white text-sm">Central Labor Law Registers</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 flex items-center justify-between hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center gap-3">
                        <FileText size={24} className="text-emerald-400" />
                        <div><h4 className="font-bold text-slate-200">Form B</h4><p className="text-[10px] text-slate-500 uppercase">Register of Wages</p></div>
                    </div>
                    <button onClick={() => handleDownload('Form B', 'PDF')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-900/50 font-bold text-xs rounded-lg">Download PDF</button>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 flex items-center justify-between hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center gap-3">
                        <ClipboardList size={24} className="text-emerald-400" />
                        <div><h4 className="font-bold text-slate-200">Form C</h4><p className="text-[10px] text-slate-500 uppercase">Muster Roll / Attendance</p></div>
                    </div>
                    <button onClick={() => handleDownload('Form C', 'PDF')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-900/50 font-bold text-xs rounded-lg">Download PDF</button>
                </div>
            </div>
        </div>

        {/* TAMIL NADU STATE ACTS */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl lg:col-span-2">
          <div className="bg-[#0f172a] p-4 border-b border-slate-800 flex items-center gap-2">
            <Building className="text-indigo-500" size={20} />
            <h3 className="font-bold text-white text-sm">Tamil Nadu Shops & Establishments Act</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-indigo-500/30 transition-all">
                <div className="flex items-center gap-3 mb-2">
                    <FileText size={24} className="text-indigo-400" />
                    <div><h4 className="font-bold text-slate-200">Form R</h4><p className="text-[10px] text-slate-500 uppercase">Register of Wages</p></div>
                </div>
                <button onClick={() => handleDownload('TN Form R', 'PDF')} className="w-full mt-4 py-2 bg-indigo-900/20 text-indigo-300 font-bold text-xs rounded-lg hover:bg-indigo-900/40">Download PDF</button>
             </div>
             <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-indigo-500/30 transition-all">
                <div className="flex items-center gap-3 mb-2">
                    <ScrollText size={24} className="text-indigo-400" />
                    <div><h4 className="font-bold text-slate-200">Form T</h4><p className="text-[10px] text-slate-500 uppercase">Wage Slip/Leave Card</p></div>
                </div>
                <button onClick={() => handleDownload('TN Form T', 'PDF')} className="w-full mt-4 py-2 bg-indigo-900/20 text-indigo-300 font-bold text-xs rounded-lg hover:bg-indigo-900/40">Download PDF</button>
             </div>
             <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-indigo-500/30 transition-all">
                <div className="flex items-center gap-3 mb-2">
                    <HandCoins size={24} className="text-indigo-400" />
                    <div><h4 className="font-bold text-slate-200">Form P</h4><p className="text-[10px] text-slate-500 uppercase">Register of Advances</p></div>
                </div>
                <button onClick={() => handleDownload('TN Form P', 'PDF')} className="w-full mt-4 py-2 bg-indigo-900/20 text-indigo-300 font-bold text-xs rounded-lg hover:bg-indigo-900/40">Download PDF</button>
             </div>
          </div>
        </div>

        {/* WELFARE & GRATUITY */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl lg:col-span-2">
          <div className="bg-[#0f172a] p-4 border-b border-slate-800 flex items-center gap-2">
            <Heart className="text-red-500" size={20} />
            <h3 className="font-bold text-white text-sm">Employee Welfare & Gratuity</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                    <HandCoins size={32} className="text-amber-500 group-hover:scale-110 transition-transform" />
                    <div>
                        <h4 className="font-bold text-slate-200 text-sm">LIC Gratuity Policy</h4>
                        <p className="text-[10px] text-slate-500 uppercase">Monthly Accrual Report</p>
                    </div>
                </div>
                <button onClick={() => handleDownload('Gratuity Statement', 'PDF')} className="px-6 py-2 bg-amber-900/20 text-amber-400 font-bold text-xs rounded-lg hover:bg-amber-900/40 transition-colors">Download PDF</button>
             </div>
             <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 flex items-center justify-between opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                    <Percent size={32} className="text-blue-500" />
                    <div>
                        <h4 className="font-bold text-slate-400 text-sm">Bonus Return (Form C)</h4>
                        <p className="text-[10px] text-slate-500 uppercase">Annual Compliance Only</p>
                    </div>
                </div>
                <span className="text-[10px] font-black text-slate-600 px-3 py-1 bg-slate-800 rounded">ANNUAL</span>
             </div>
          </div>
        </div>

      </div>
      )}

      {/* RANGE MODAL FOR ANNUAL REPORTS */}
      {rangeModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setRangeModal({ ...rangeModal, isOpen: false })} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <X size={20} />
                </button>
                <div className="text-center space-y-1">
                    <h3 className="text-xl font-black text-white">{rangeModal.reportType} Generator</h3>
                    <p className="text-xs text-slate-400">Specify period range for annual returns</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Start Period</label>
                        <select className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-xs text-white" value={rangeModal.startMonth} onChange={e => setRangeModal({...rangeModal, startMonth: e.target.value})} >
                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1 flex flex-col justify-end">
                        <select className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-xs text-white" value={rangeModal.startYear} onChange={e => setRangeModal({...rangeModal, startYear: +e.target.value})} >
                            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">End Period</label>
                        <select className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-xs text-white" value={rangeModal.endMonth} onChange={e => setRangeModal({...rangeModal, endMonth: e.target.value})} >
                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1 flex flex-col justify-end">
                        <select className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-xs text-white" value={rangeModal.endYear} onChange={e => setRangeModal({...rangeModal, endYear: +e.target.value})} >
                            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-1 mt-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Employee Filter</label>
                    <select className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-xs text-white" value={rangeModal.selectedEmployee} onChange={e => setRangeModal({...rangeModal, selectedEmployee: e.target.value})} >
                        <option value="ALL">ALL Employees</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.id} - {e.name}</option>)}
                    </select>
                </div>

                <button onClick={handleGenerateRange} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg mt-4 flex items-center justify-center gap-2 group">
                    <Download size={18} className="group-hover:translate-y-0.5 transition-transform" /> GENERATE STATEMENT
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default StatutoryReports;
