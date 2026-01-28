
import React, { useMemo } from 'react';
import { Calculator, Download, FileText, AlertCircle, FileSpreadsheet, Building2, IndianRupee, Users, Lock } from 'lucide-react';
import { Employee, PayrollResult, StatutoryConfig, CompanyProfile } from '../types';
import { generatePFECR, generatePFForm12A } from '../services/reportService';

interface PFCalculatorProps {
  employees: Employee[];
  payrollHistory: PayrollResult[];
  config: StatutoryConfig;
  companyProfile: CompanyProfile;
  month: string;
  setMonth: (m: string) => void;
  year: number;
  setYear: (y: number) => void;
}

const PFCalculator: React.FC<PFCalculatorProps> = ({
  employees,
  payrollHistory,
  config,
  companyProfile,
  month,
  setMonth,
  year,
  setYear
}) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);

  // 1. Filter Data for Month
  const currentRecords = useMemo(() => {
    return payrollHistory.filter(r => r.month === month && r.year === year);
  }, [payrollHistory, month, year]);

  // Check if finalized
  const isFinalized = useMemo(() => {
    return currentRecords.length > 0 && currentRecords[0].status === 'Finalized';
  }, [currentRecords]);

  // 2. Calculate ECR Data & Challan Aggregates
  const { ecrData, challan } = useMemo(() => {
    let totalEPFWages = 0;
    let totalEPSWages = 0;
    let totalEDLIWages = 0;
    
    let ac1_EE = 0;
    let ac1_ER = 0; // EPF Difference
    let ac10 = 0;   // EPS
    let ac21 = 0;   // EDLI Contribution
    let ac2 = 0;    // Admin Charges
    
    const rows = currentRecords.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      if (!emp) return null;

      // OPT OUT CHECK
      const isOptOut = emp.isDeferredPension && emp.deferredPensionOption === 'OptOut';

      // Actual Wage (Basic + DA + Retaining)
      const actualWage = r.earnings.basic + r.earnings.da + r.earnings.retainingAllowance;
      
      // Statutory Wage Caps - Forced to 0 if Opt Out
      const epfWage = isOptOut ? 0 : (emp.isPFHigherWages ? actualWage : Math.min(actualWage, 15000));
      const epsWage = isOptOut ? 0 : ((emp.pfHigherPension?.enabled && emp.pfHigherPension.isHigherPensionOpted === 'Yes') 
          ? actualWage 
          : Math.min(actualWage, 15000)); 
      const edliWage = isOptOut ? 0 : Math.min(actualWage, 15000);

      // Accumulate Wages
      totalEPFWages += Math.round(epfWage);
      totalEPSWages += Math.round(epsWage);
      totalEDLIWages += Math.round(edliWage);

      // Accumulate Contributions
      ac1_EE += (r.deductions.epf + r.deductions.vpf); 
      ac1_ER += r.employerContributions.epf;
      ac10 += r.employerContributions.eps;

      return {
        uan: emp.uanc,
        name: emp.name,
        gross: r.earnings.total,
        epfWage: Math.round(epfWage),
        epsWage: Math.round(epsWage),
        edliWage: Math.round(edliWage),
        eeShare: Math.round(r.deductions.epf),
        erShareEPS: Math.round(r.employerContributions.eps),
        erShareEPFDiff: Math.round(r.employerContributions.epf),
        ncp: r.daysInMonth - r.payableDays,
        refund: 0,
        isOptOut 
      };
    }).filter(Boolean) as any[];

    // Final Challan Calculations
    const adminCharges = Math.round(totalEPFWages * 0.005);
    ac2 = Math.max(500, adminCharges); 
    
    ac21 = Math.round(totalEDLIWages * 0.005);

    // Total Remittance
    const totalRemittance = ac1_EE + ac1_ER + ac10 + ac2 + ac21; 

    return {
      ecrData: rows,
      challan: {
        totalEPFWages,
        totalEPSWages,
        totalEDLIWages,
        ac1_Total: ac1_EE + ac1_ER,
        ac1_EE,
        ac1_ER,
        ac2,
        ac10,
        ac21,
        ac22: 0,
        totalRemittance
      }
    };
  }, [currentRecords, employees, config]);

  const handleDownloadECR = () => {
      if (currentRecords.length === 0) return;
      generatePFECR(currentRecords, employees, 'Text', `PF_ECR_${month}_${year}`);
  };

  const handleDownloadChallan = () => {
      if (currentRecords.length === 0) return;
      generatePFForm12A(currentRecords, employees, config, companyProfile, month, year);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/30">
                <Calculator size={28} className="text-white" />
            </div>
            <div>
                <h2 className="text-2xl font-black text-white">PF ECR Calculator</h2>
                <p className="text-slate-400 text-sm">Comprehensive Challan & ECR Analysis</p>
            </div>
        </div>

        <div className="flex items-center gap-3 bg-[#0f172a] p-2 rounded-xl border border-slate-700">
             <select value={month} onChange={e => setMonth(e.target.value)} className="bg-transparent border-r border-slate-700 px-4 py-1 text-sm text-white font-bold outline-none focus:text-blue-400">
                {months.map(m => (<option key={m} value={m}>{m}</option>))}
             </select>
             <select value={year} onChange={e => setYear(+e.target.value)} className="bg-transparent px-4 py-1 text-sm text-white font-bold outline-none focus:text-blue-400">
                {yearOptions.map(y => (<option key={y} value={y}>{y}</option>))}
             </select>
        </div>
      </div>

      {currentRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 bg-[#1e293b] rounded-2xl border border-slate-800 border-dashed text-center">
              <AlertCircle size={48} className="text-slate-600 mb-4" />
              <h3 className="text-xl font-bold text-white">No Payroll Data Found</h3>
              <p className="text-slate-400 mt-2">Please run and save payroll for <span className="text-blue-400 font-bold">{month} {year}</span> to generate ECR.</p>
          </div>
      ) : !isFinalized ? (
          <div className="flex flex-col items-center justify-center p-16 bg-[#1e293b] rounded-2xl border border-slate-800 border-dashed text-center">
              <div className="p-4 bg-amber-900/20 text-amber-500 rounded-full border border-amber-900/50 mb-4"><Lock size={40} /></div>
              <h3 className="text-xl font-bold text-white">Payroll Not Finalized</h3>
              <p className="text-slate-400 mt-2 max-w-lg leading-relaxed">PF ECR generation requires the payroll for <span className="text-blue-400 font-bold">{month} {year}</span> to be permanently frozen.</p>
              <div className="mt-6 p-4 bg-[#0f172a] rounded-xl border border-slate-700 text-sm text-slate-300">Go to <span className="font-bold text-white">Analytics &gt; Pay Reports</span> and click <span className="font-bold text-emerald-400">Confirm & Freeze Data</span>.</div>
          </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden group">
                  <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><IndianRupee size={64} /></div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Remittance</p>
                  <h3 className="text-3xl font-black text-emerald-400">₹{challan.totalRemittance.toLocaleString()}</h3>
                  <div className="mt-4 flex items-center gap-2 text-[10px] text-emerald-300 bg-emerald-900/20 px-2 py-1 rounded w-fit"><span>A/c 1 + 2 + 10 + 21 + 22</span></div>
              </div>
              <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden group">
                  <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Users size={64} /></div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Subscribers</p>
                  <h3 className="text-3xl font-black text-blue-400">{ecrData.filter(d => d.epfWage > 0).length}</h3>
                  <p className="text-xs text-slate-400 mt-1">Actively Contributing</p>
              </div>
              <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden group">
                  <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Building2 size={64} /></div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total EPF Wages</p>
                  <h3 className="text-3xl font-black text-amber-400">₹{challan.totalEPFWages.toLocaleString()}</h3>
                  <div className="mt-4 text-[10px] text-slate-400">EPS Wages: <span className="font-bold text-white">₹{challan.totalEPSWages.toLocaleString()}</span></div>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#1e293b] rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
                  <div className="bg-[#0f172a] p-4 border-b border-slate-800 flex justify-between items-center">
                      <h3 className="font-bold text-white text-sm">Challan Summary</h3>
                      <button onClick={handleDownloadChallan} className="text-[10px] bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded border border-slate-700 transition-colors flex items-center gap-1">
                          <FileText size={12} /> Download PDF
                      </button>
                  </div>
                  <table className="w-full text-sm text-left">
                      <thead className="text-[10px] uppercase bg-slate-900/50 text-slate-400">
                          <tr><th className="px-6 py-3">Account Head</th><th className="px-6 py-3 text-right">Amount (₹)</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                          <tr><td className="px-6 py-3"><span className="font-bold text-white">A/c No. 1</span> <span className="text-xs text-slate-500 ml-2">PF Contribution (EE + ER Diff)</span></td><td className="px-6 py-3 text-right font-mono font-bold text-white">{challan.ac1_Total.toLocaleString()}</td></tr>
                          <tr><td className="px-6 py-3"><span className="font-bold text-white">A/c No. 2</span> <span className="text-xs text-slate-500 ml-2">Admin Charges (0.5%, Min 500)</span></td><td className="px-6 py-3 text-right font-mono text-amber-400">{challan.ac2.toLocaleString()}</td></tr>
                          <tr><td className="px-6 py-3"><span className="font-bold text-white">A/c No. 10</span> <span className="text-xs text-slate-500 ml-2">Pension Fund (8.33%)</span></td><td className="px-6 py-3 text-right font-mono text-white">{challan.ac10.toLocaleString()}</td></tr>
                          <tr><td className="px-6 py-3"><span className="font-bold text-white">A/c No. 21</span> <span className="text-xs text-slate-500 ml-2">EDLI Contribution (0.5%)</span></td><td className="px-6 py-3 text-right font-mono text-white">{challan.ac21.toLocaleString()}</td></tr>
                          <tr><td className="px-6 py-3"><span className="font-bold text-white">A/c No. 22</span> <span className="text-xs text-slate-500 ml-2">EDLI Admin Charges</span></td><td className="px-6 py-3 text-right font-mono text-slate-500">{challan.ac22.toLocaleString()}</td></tr>
                          <tr className="bg-slate-900/80"><td className="px-6 py-4 font-black text-emerald-400 uppercase tracking-widest text-xs">Total Remittance</td><td className="px-6 py-4 text-right font-black text-emerald-400 font-mono text-lg">₹{challan.totalRemittance.toLocaleString()}</td></tr>
                      </tbody>
                  </table>
              </div>
              <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-lg p-6 flex flex-col justify-center gap-4">
                  <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2 mb-2">ECR Actions</h3>
                  <button onClick={handleDownloadECR} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-3 group">
                      <Download className="group-hover:scale-110 transition-transform" /> Generate ECR Text File
                  </button>
                  <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-900/50 text-xs text-blue-300 leading-relaxed"><p className="flex gap-2"><AlertCircle size={14} className="shrink-0 mt-0.5" /> <span>Ensure <b>UAN</b> is updated for all employees in Master before generation.</span></p></div>
              </div>
          </div>

          <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
              <div className="bg-[#0f172a] p-4 border-b border-slate-800"><h3 className="font-bold text-white text-sm flex items-center gap-2"><FileSpreadsheet size={16} className="text-slate-400" /> ECR Data Preview</h3></div>
              <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                  <table className="w-full text-left text-[10px]">
                      <thead className="bg-[#0f172a] text-slate-400 uppercase font-bold sticky top-0 z-10 shadow-md">
                          <tr>
                              <th className="px-4 py-3 whitespace-nowrap">UAN</th>
                              <th className="px-4 py-3 whitespace-nowrap">Name</th>
                              <th className="px-4 py-3 text-right whitespace-nowrap">Gross</th>
                              <th className="px-4 py-3 text-right whitespace-nowrap text-blue-400">EPF</th>
                              <th className="px-4 py-3 text-right whitespace-nowrap text-amber-400">EPS</th>
                              <th className="px-4 py-3 text-right whitespace-nowrap text-pink-400">EDLI</th>
                              <th className="px-4 py-3 text-right whitespace-nowrap">EE_Share</th>
                              <th className="px-4 py-3 text-right whitespace-nowrap">ER_Share_</th>
                              <th className="px-4 py-3 text-right whitespace-nowrap">ER_Share_</th>
                              <th className="px-4 py-3 text-center whitespace-nowrap">NCP_Days</th>
                              <th className="px-4 py-3 text-center whitespace-nowrap">Refund</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                          {ecrData.map((row, i) => (
                              <tr key={i} className={`hover:bg-slate-800/50 transition-colors ${row.isOptOut ? 'opacity-40 grayscale italic' : ''}`}>
                                  <td className="px-4 py-3 font-mono text-slate-300">{row.uan || 'N/A'}</td>
                                  <td className="px-4 py-3 font-bold text-white">{row.name} {row.isOptOut && "(Opt Out)"}</td>
                                  <td className="px-4 py-3 text-right font-mono text-slate-400">{row.gross}</td>
                                  <td className="px-4 py-3 text-right font-mono font-bold text-blue-400">{row.epfWage}</td>
                                  <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">{row.epsWage}</td>
                                  <td className="px-4 py-3 text-right font-mono font-bold text-pink-400">{row.edliWage}</td>
                                  <td className="px-4 py-3 text-right font-mono text-slate-300">{row.eeShare}</td>
                                  <td className="px-4 py-3 text-right font-mono text-slate-300">{row.erShareEPS}</td>
                                  <td className="px-4 py-3 text-right font-mono text-slate-300">{row.erShareEPFDiff}</td>
                                  <td className="px-4 py-3 text-center font-mono text-red-400">{row.ncp}</td>
                                  <td className="px-4 py-3 text-center font-mono text-slate-500">{row.refund}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PFCalculator;
