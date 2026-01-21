
import React, { useMemo } from 'react';
import { ShieldCheck, FileSpreadsheet, FileCode, FileText, Download, Eye, ScrollText, Landmark, Lock } from 'lucide-react';
import { PayrollResult, Employee, StatutoryConfig } from '../types';
import { generatePFECR, generateESIReturn, generatePTReport, generateTDSReport } from '../services/reportService';

interface StatutoryReportsProps {
  payrollHistory: PayrollResult[];
  employees: Employee[];
  config: StatutoryConfig;
  globalMonth: string;
  setGlobalMonth: (m: string) => void;
  globalYear: number;
  setGlobalYear: (y: number) => void;
}

const StatutoryReports: React.FC<StatutoryReportsProps> = ({ 
    payrollHistory,
    employees,
    config,
    globalMonth,
    setGlobalMonth,
    globalYear,
    setGlobalYear
}) => {
  
  // Check if current month is finalized
  const isFinalized = useMemo(() => {
    const records = payrollHistory.filter(r => r.month === globalMonth && r.year === globalYear);
    return records.length > 0 && records[0].status === 'Finalized';
  }, [payrollHistory, globalMonth, globalYear]);

  const handleDownload = (reportName: string, format: string) => {
    // Filter data for current month/year
    const currentData = payrollHistory.filter(r => r.month === globalMonth && r.year === globalYear);
    
    if (currentData.length === 0) {
        alert("No finalized payroll data found for this period. Please Run Payroll and Freeze Data first.");
        return;
    }

    const fileName = `${reportName.replace(/ /g, '_')}_${globalMonth}_${globalYear}`;

    try {
        if (reportName.includes('ECR')) {
             generatePFECR(currentData, employees, format as any, fileName);
        } else if (reportName.includes('ESI')) {
             generateESIReturn(currentData, employees, format as any, fileName);
        } else if (reportName.includes('PT') || reportName.includes('Professional')) {
             generatePTReport(currentData, employees, fileName);
        } else if (reportName.includes('Form 16A') || reportName.includes('Income Tax')) {
             generateTDSReport(currentData, employees, fileName);
        } else if (reportName.includes('Form')) {
            // Placeholder for PDF Forms that require complex layout (Form 5, 10, etc)
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
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
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
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (<option key={m} value={m}>{m}</option>))}
             </select>
             <select value={globalYear} onChange={e => setGlobalYear(+e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white">
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
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
        
        {/* 1. Provident Fund (EPF) */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="bg-[#0f172a] p-4 border-b border-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-blue-500" size={20} />
            <h3 className="font-bold text-white text-sm">Provident Fund (EPF)</h3>
          </div>
          <div className="p-4 space-y-4">
            
            {/* ECR (Electronic Challan Return) */}
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/50 space-y-3">
              <span className="text-xs font-medium text-slate-300 block border-b border-slate-800 pb-2">ECR (Electronic Challan Return)</span>
              <div className="flex gap-2">
                <button onClick={() => handleDownload('PF ECR', 'Excel')} className="flex-1 flex items-center justify-center gap-2 text-[10px] font-bold bg-green-900/20 text-green-400 px-2 py-1.5 rounded hover:bg-green-900/40 border border-green-900/30">
                  <FileSpreadsheet size={12} /> Excel
                </button>
                <button onClick={() => handleDownload('PF ECR', 'Text')} className="flex-1 flex items-center justify-center gap-2 text-[10px] font-bold bg-slate-700 text-slate-300 px-2 py-1.5 rounded hover:bg-slate-600 border border-slate-600">
                  <FileCode size={12} /> Text
                </button>
              </div>
            </div>

            {/* Arrear ECR */}
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/50 space-y-3">
              <span className="text-xs font-medium text-slate-300 block border-b border-slate-800 pb-2">Arrear ECR</span>
              <div className="flex gap-2">
                <button onClick={() => handleDownload('PF Arrear ECR', 'Excel')} className="flex-1 flex items-center justify-center gap-2 text-[10px] font-bold bg-green-900/20 text-green-400 px-2 py-1.5 rounded hover:bg-green-900/40 border border-green-900/30">
                  <FileSpreadsheet size={12} /> Excel
                </button>
                <button onClick={() => handleDownload('PF Arrear ECR', 'Text')} className="flex-1 flex items-center justify-center gap-2 text-[10px] font-bold bg-slate-700 text-slate-300 px-2 py-1.5 rounded hover:bg-slate-600 border border-slate-600">
                  <FileCode size={12} /> Text
                </button>
              </div>
            </div>

            {/* Other PDF Forms */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800 transition-colors border border-slate-800/50">
                <span className="text-xs font-medium text-slate-300">Form 5 (New Joinees)</span>
                <button onClick={() => handleDownload('Form 5', 'PDF')} className="text-blue-400 hover:text-white transition-colors p-1.5 bg-blue-900/20 rounded">
                  <FileText size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800 transition-colors border border-slate-800/50">
                <span className="text-xs font-medium text-slate-300">Form 10 (Resigned Employees)</span>
                <button onClick={() => handleDownload('Form 10', 'PDF')} className="text-blue-400 hover:text-white transition-colors p-1.5 bg-blue-900/20 rounded">
                  <FileText size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800 transition-colors border border-slate-800/50">
                <span className="text-xs font-medium text-slate-300">Form 12A (Monthly Statement)</span>
                <button onClick={() => handleDownload('Form 12A', 'PDF')} className="text-blue-400 hover:text-white transition-colors p-1.5 bg-blue-900/20 rounded">
                  <FileText size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800 transition-colors border border-slate-800/50">
                <span className="text-xs font-medium text-slate-300">Form 3A (Annual Contribution)</span>
                <button onClick={() => handleDownload('Form 3A', 'PDF')} className="text-blue-400 hover:text-white transition-colors p-1.5 bg-blue-900/20 rounded">
                  <FileText size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800 transition-colors border border-slate-800/50">
                <span className="text-xs font-medium text-slate-300">Form 6A (Consolidated Annual)</span>
                <button onClick={() => handleDownload('Form 6A', 'PDF')} className="text-blue-400 hover:text-white transition-colors p-1.5 bg-blue-900/20 rounded">
                  <FileText size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Employee State Insurance (ESI) */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="bg-[#0f172a] p-4 border-b border-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-pink-500" size={20} />
            <h3 className="font-bold text-white text-sm">ESI Corporation</h3>
          </div>
          <div className="p-4 space-y-4">
            
            {/* Form 1 */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800/50">
              <span className="text-xs font-medium text-slate-300">Form 1 (Declaration)</span>
              <button onClick={() => handleDownload('ESI Form 1', 'PDF')} className="flex items-center gap-2 text-xs font-bold bg-pink-900/20 text-pink-400 px-3 py-1.5 rounded hover:bg-pink-900/40 transition-colors">
                <Eye size={14} /> PDF Preview
              </button>
            </div>

            {/* Form 6 (Register of Employees) */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800/50">
              <span className="text-xs font-medium text-slate-300">Form 6 (Register of Employees)</span>
              <button onClick={() => handleDownload('ESI Form 6', 'PDF')} className="flex items-center gap-2 text-xs font-bold bg-pink-900/20 text-pink-400 px-3 py-1.5 rounded hover:bg-pink-900/40 transition-colors">
                <Eye size={14} /> PDF Preview
              </button>
            </div>

            {/* Form 7 (Register of Contributions) */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800/50">
              <span className="text-xs font-medium text-slate-300">Form 7 (Register of Contributions)</span>
              <button onClick={() => handleDownload('ESI Form 7', 'PDF')} className="flex items-center gap-2 text-xs font-bold bg-pink-900/20 text-pink-400 px-3 py-1.5 rounded hover:bg-pink-900/40 transition-colors">
                <Eye size={14} /> PDF Preview
              </button>
            </div>

            {/* Monthly ESI Return (Consolidated) */}
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/50 space-y-3">
              <span className="text-xs font-medium text-slate-300 block border-b border-slate-800 pb-2">Monthly ESI Return</span>
              <div className="flex gap-2">
                <button onClick={() => handleDownload('Monthly ESI', 'Excel')} className="flex-1 flex items-center justify-center gap-2 text-[10px] font-bold bg-green-900/20 text-green-400 px-2 py-2 rounded hover:bg-green-900/40 border border-green-900/30 transition-all">
                  <FileSpreadsheet size={14} /> Excel (For Upload)
                </button>
                <button onClick={() => handleDownload('Monthly ESI View', 'PDF')} className="flex items-center justify-center gap-2 text-[10px] font-bold bg-slate-700 text-slate-300 px-4 py-2 rounded hover:bg-slate-600 border border-slate-600 transition-all">
                  <Eye size={14} /> View
                </button>
              </div>
              <p className="text-[10px] text-slate-500 italic">Generate standard Excel format for ESI Portal upload.</p>
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
    </div>
  );
};

export default StatutoryReports;
