
import React, { useMemo, useState } from 'react';
import { ShieldCheck, FileText, Download, ScrollText, Landmark, Lock, Heart, HandCoins, Percent, Building, Calendar, X, FileSpreadsheet, Eye, Scale, BookOpen, User, LogOut, ReceiptText, ClipboardList, Info, AlertTriangle, CheckCircle } from 'lucide-react';
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
  generateGratuityReport,
  generateBonusReport,
  generateEPFCodeImpactReport,
  generateESIForm5
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
    selectedEmployee: 'ALL',
    format: 'PDF' as 'PDF' | 'Excel',
    // New fields for Form 5
    halfYearPeriod: 'Apr-Sep' as 'Apr-Sep' | 'Oct-Mar',
    periodYear: globalYear
  });

  const [msgModal, setMsgModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'error' | 'success';
  }>({ isOpen: false, title: '', message: '', type: 'error' });

  const openRangeModal = (reportType: string) => {
    const isJanToMar = ['January', 'February', 'March'].includes(globalMonth);
    const fyStartYear = isJanToMar ? globalYear - 1 : globalYear;
    
    // Default for Form 5 based on current global month
    let defaultHalfYear: 'Apr-Sep' | 'Oct-Mar' = 'Apr-Sep';
    if (months.indexOf(globalMonth) >= 9 || months.indexOf(globalMonth) <= 2) {
       defaultHalfYear = 'Oct-Mar'; // Oct, Nov, Dec, Jan, Feb, Mar
    }

    setRangeModal({
        isOpen: true,
        reportType,
        startMonth: 'April',
        startYear: fyStartYear,
        endMonth: 'March',
        endYear: fyStartYear + 1,
        selectedEmployee: 'ALL',
        format: 'PDF',
        halfYearPeriod: defaultHalfYear,
        periodYear: fyStartYear
    });
  };

  const handleGenerateRange = () => {
    try {
        if (rangeModal.reportType === 'Form 3A') {
            generatePFForm3A(payrollHistory, employees, config, rangeModal.startMonth, rangeModal.startYear, rangeModal.endMonth, rangeModal.endYear, rangeModal.selectedEmployee === 'ALL' ? undefined : rangeModal.selectedEmployee, companyProfile);
        } else if (rangeModal.reportType === 'Form 6A') {
            generatePFForm6A(payrollHistory, employees, config, rangeModal.startMonth, rangeModal.startYear, rangeModal.endMonth, rangeModal.endYear, companyProfile);
        } else if (rangeModal.reportType === 'Bonus Statement') {
            generateBonusReport(payrollHistory, employees, config, rangeModal.startMonth, rangeModal.startYear, rangeModal.endMonth, rangeModal.endYear, companyProfile, rangeModal.format);
        } else if (rangeModal.reportType === 'Form 5') {
            generateESIForm5(payrollHistory, employees, rangeModal.halfYearPeriod, rangeModal.periodYear, companyProfile);
        }
    } catch (e: any) { 
        setMsgModal({ isOpen: true, title: 'Error', message: e.message, type: 'error' });
    }
    setRangeModal({ ...rangeModal, isOpen: false });
  };

  const handleDownload = (reportName: string, format: string) => {
    const currentData = payrollHistory.filter(r => r.month === globalMonth && r.year === globalYear);
    const fileName = `${reportName.replace(/ /g, '_')}_${globalMonth}_${globalYear}`;

    try {
        if (reportName.includes('PF ECR')) {
             generatePFECR(currentData, employees, config, format as any, fileName);
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
        } else if (reportName.includes('EPF Code Impact')) {
             generateEPFCodeImpactReport(currentData, employees, format as any, fileName, companyProfile);
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
    } catch (e: any) { 
        setMsgModal({ isOpen: true, title: 'Report Generation Failed', message: e.message, type: 'error' });
    }
  };

  const ReportCard = ({ title, icon: Icon, color, reports }: { title: string, icon: any, color: string, reports: { label: string, action: () => void, format?: string }[] }) => (
    <div className="bg-[#1e293b] rounded-xl border border-slate-800 shadow-lg overflow-hidden group hover:border-slate-700 transition-all">
        <div className="bg-[#0f172a] p-4 flex items-center gap-3 border-b border-slate-800">
            <div className={`p-2 rounded-lg bg-${color}-900/20 text-${color}-400 border border-${color}-900/30`}>
                <Icon size={20} />
            </div>
            <h3 className={`font-bold text-${color}-400 text-sm uppercase tracking-widest`}>{title}</h3>
        </div>
        <div className="p-4 grid grid-cols-1 gap-2">
            {reports.map((r, i) => (
                <button key={i} onClick={r.action} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all group/btn text-left">
                    <span className="text-xs font-bold text-slate-300 group-hover/btn:text-white">{r.label}</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{r.format || 'PDF'}</span>
                </button>
            ))}
        </div>
    </div>
  );

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

        {/* EPF Reports */}
        <ReportCard 
            title="EPF & MP Act, 1952" 
            icon={Landmark} 
            color="blue"
            reports={[
                { label: 'PF ECR (Electronic Challan Return)', action: () => handleDownload('PF ECR', 'Text'), format: 'TXT' },
                { label: 'PF ECR (Excel Backup)', action: () => handleDownload('PF ECR', 'Excel'), format: 'XLSX' },
                { label: 'Form 12A (Monthly Statement)', action: () => handleDownload('Form 12A', 'PDF') },
                { label: 'Form 3A (Member Annual Card)', action: () => openRangeModal('Form 3A'), format: 'PDF' },
                { label: 'Form 6A (Consolidated Annual)', action: () => openRangeModal('Form 6A'), format: 'PDF' },
                { label: 'Code 2020 Impact Analysis', action: () => handleDownload('EPF Code Impact', 'PDF'), format: 'PDF' }
            ]} 
        />

        {/* ESI Reports */}
        <ReportCard 
            title="ESI Act, 1948" 
            icon={ShieldCheck} 
            color="pink"
            reports={[
                { label: 'ESI Monthly Return (Excel)', action: () => handleDownload('ESI', 'Excel'), format: 'XLSX' },
                { label: 'Form 5 (Return of Contribution)', action: () => openRangeModal('Form 5'), format: 'PDF' },
                { label: 'ESI Code Wages Analysis', action: () => handleDownload('ESI Code Wages', 'PDF'), format: 'PDF' },
                { label: 'Exit / Resignation Report', action: () => handleDownload('ESI Exit', 'Excel'), format: 'XLSX' }
            ]} 
        />

        {/* Labour Law Registers */}
        <ReportCard 
            title="Labour Law Registers" 
            icon={BookOpen} 
            color="emerald"
            reports={[
                { label: 'Form B (Register of Wages)', action: () => handleDownload('Form B', 'PDF') },
                { label: 'Form C (Muster Roll)', action: () => handleDownload('Form C', 'PDF') },
                { label: 'TN Form R (Wages)', action: () => handleDownload('TN Form R', 'PDF') },
                { label: 'TN Form T (Pay Slips)', action: () => handleDownload('TN Form T', 'PDF') },
                { label: 'TN Form P (Advances)', action: () => handleDownload('TN Form P', 'PDF') },
                { label: 'Code on Wages 2020 Report', action: () => handleDownload('Social Security', 'PDF') }
            ]} 
        />

        {/* Financial & Others */}
        <ReportCard 
            title="Finance & Benefits" 
            icon={HandCoins} 
            color="amber"
            reports={[
                { label: 'Professional Tax (PT) Report', action: () => handleDownload('PT', 'Excel'), format: 'XLSX' },
                { label: 'TDS / Income Tax Report', action: () => handleDownload('TDS', 'Excel'), format: 'XLSX' },
                { label: 'Bonus Payment Statement', action: () => openRangeModal('Bonus Statement'), format: 'PDF' },
                { label: 'Gratuity Liability (Estimated)', action: () => handleDownload('Gratuity', 'PDF') }
            ]} 
        />

      </div>
      )}

      {/* Range Selection Modal */}
      {rangeModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setRangeModal({...rangeModal, isOpen: false})} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                    <Calendar size={24} className="text-blue-400" />
                    <div>
                        <h3 className="text-lg font-bold text-white">{rangeModal.reportType}</h3>
                        <p className="text-xs text-slate-400">Select reporting period</p>
                    </div>
                </div>
                
                <div className="space-y-4">
                    {rangeModal.reportType === 'Form 5' ? (
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Contribution Period</label>
                            <div className="flex gap-2">
                                <select className="flex-1 bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-sm text-white" value={rangeModal.halfYearPeriod} onChange={e => setRangeModal({...rangeModal, halfYearPeriod: e.target.value as any})}>
                                    <option value="Apr-Sep">Apr - Sep</option>
                                    <option value="Oct-Mar">Oct - Mar</option>
                                </select>
                                <select className="w-24 bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-sm text-white" value={rangeModal.periodYear} onChange={e => setRangeModal({...rangeModal, periodYear: +e.target.value})}>
                                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Start</label>
                                <div className="flex gap-1">
                                    <select className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-xs text-white w-full" value={rangeModal.startMonth} onChange={e => setRangeModal({...rangeModal, startMonth: e.target.value})}>{months.map(m => <option key={m} value={m}>{m.slice(0,3)}</option>)}</select>
                                    <select className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-xs text-white" value={rangeModal.startYear} onChange={e => setRangeModal({...rangeModal, startYear: +e.target.value})}>{yearOptions.map(y => <option key={y} value={y}>{y}</option>)}</select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">End</label>
                                <div className="flex gap-1">
                                    <select className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-xs text-white w-full" value={rangeModal.endMonth} onChange={e => setRangeModal({...rangeModal, endMonth: e.target.value})}>{months.map(m => <option key={m} value={m}>{m.slice(0,3)}</option>)}</select>
                                    <select className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-xs text-white" value={rangeModal.endYear} onChange={e => setRangeModal({...rangeModal, endYear: +e.target.value})}>{yearOptions.map(y => <option key={y} value={y}>{y}</option>)}</select>
                                </div>
                            </div>
                        </div>
                        {rangeModal.reportType === 'Form 3A' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Employee</label>
                                <select className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-sm text-white" value={rangeModal.selectedEmployee} onChange={e => setRangeModal({...rangeModal, selectedEmployee: e.target.value})}>
                                    <option value="ALL">All Employees</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
                                </select>
                            </div>
                        )}
                        </>
                    )}
                </div>

                <button onClick={handleGenerateRange} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl mt-4 transition-all shadow-lg flex items-center justify-center gap-2">
                    <Download size={18} /> Generate Report
                </button>
            </div>
        </div>
      )}

      {/* Message Modal */}
      {msgModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setMsgModal({...msgModal, isOpen: false})} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                <div className="flex flex-col items-center gap-2">
                    <div className={`p-3 rounded-full border ${msgModal.type === 'error' ? 'bg-red-900/30 text-red-500 border-red-900/50' : 'bg-emerald-900/30 text-emerald-500 border-emerald-900/50'}`}>
                        {msgModal.type === 'error' ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
                    </div>
                    <h3 className="text-lg font-bold text-white text-center">{msgModal.title}</h3>
                    <p className="text-sm text-slate-400 text-center">{msgModal.message}</p>
                </div>
                <button onClick={() => setMsgModal({...msgModal, isOpen: false})} className="w-full py-2.5 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600 transition-colors">Close</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default StatutoryReports;
