
import React, { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Calendar, Save, Calculator, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { Employee, CompanyProfile, ArrearBatch, ArrearRecord } from '../types';
import { generateArrearReport } from '../services/reportService';

interface ArrearManagerProps {
  employees: Employee[];
  setEmployees: (emps: Employee[]) => void;
  currentMonth: string;
  currentYear: number;
  companyProfile: CompanyProfile;
  arrearHistory?: ArrearBatch[];
  setArrearHistory?: React.Dispatch<React.SetStateAction<ArrearBatch[]>>;
}

const ArrearManager: React.FC<ArrearManagerProps> = ({ 
    employees, 
    setEmployees, 
    currentMonth, 
    currentYear, 
    companyProfile,
    arrearHistory,
    setArrearHistory
}) => {
  const [incrementType, setIncrementType] = useState<'Percentage' | 'Adhoc'>('Percentage');
  const [percentageMode, setPercentageMode] = useState<'Flat' | 'Specific'>('Flat');
  const [flatPercentage, setFlatPercentage] = useState<number>(0);
  const [specificPercentages, setSpecificPercentages] = useState<Record<string, number>>({});
  const [adhocIncrements, setAdhocIncrements] = useState<Record<string, { basic: number, da: number }>>({});
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const [effectiveMonth, setEffectiveMonth] = useState<string>(currentMonth);
  const [effectiveYear, setEffectiveYear] = useState<number>(currentYear);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Initialize adhoc state
  useEffect(() => {
      const initialAdhoc: Record<string, { basic: number, da: number }> = {};
      employees.forEach(e => {
          if (!e.dol) {
              initialAdhoc[e.id] = { basic: 0, da: 0 };
          }
      });
      setAdhocIncrements(initialAdhoc);
  }, [employees]);

  const activeEmployees = useMemo(() => employees.filter(e => !e.dol), [employees]);

  const calculateMonthsPassed = () => {
      const currentIdx = months.indexOf(currentMonth);
      const effectiveIdx = months.indexOf(effectiveMonth);
      
      const monthsDiff = (currentYear - effectiveYear) * 12 + (currentIdx - effectiveIdx);
      return Math.max(0, monthsDiff);
  };

  const getProposedSalary = (emp: Employee) => {
      let newBasic = emp.basicPay;
      let newDA = emp.da || 0;

      if (incrementType === 'Percentage') {
          const pct = percentageMode === 'Flat' ? flatPercentage : (specificPercentages[emp.id] || 0);
          const factor = 1 + (pct / 100);
          newBasic = Math.round(emp.basicPay * factor);
          newDA = Math.round((emp.da || 0) * factor);
      } else {
          const inc = adhocIncrements[emp.id] || { basic: 0, da: 0 };
          newBasic = emp.basicPay + inc.basic;
          newDA = (emp.da || 0) + inc.da;
      }
      return { newBasic, newDA };
  };

  const handleProcess = () => {
      if (calculateMonthsPassed() < 0) {
          alert("Effective date cannot be in the future relative to current payroll period.");
          return;
      }
      setShowConfirmation(true);
  };

  const executeSave = (generateReportFormat: 'PDF' | 'Excel') => {
      setIsProcessing(true);
      const monthsPassed = calculateMonthsPassed();
      
      const arrearRecords: ArrearRecord[] = [];
      const updatedEmployees = employees.map(emp => {
          if (emp.dol) return emp; // Skip ex-employees for master update

          const { newBasic, newDA } = getProposedSalary(emp);
          const oldBasic = emp.basicPay;
          const oldDA = emp.da || 0;
          
          const diffBasic = newBasic - oldBasic;
          const diffDA = newDA - oldDA;
          
          const monthlyIncr = diffBasic + diffDA;
          
          if (monthlyIncr > 0 && monthsPassed > 0) {
              arrearRecords.push({
                  id: emp.id,
                  name: emp.name,
                  oldBasic, newBasic, diffBasic,
                  oldDA, newDA, diffDA,
                  diffOthers: 0, 
                  monthlyIncrement: monthlyIncr,
                  months: monthsPassed,
                  totalArrear: monthlyIncr * monthsPassed
              });
          }

          return {
              ...emp,
              basicPay: newBasic,
              da: newDA,
          };
      });

      // 1. Update Master
      setEmployees(updatedEmployees);

      // 2. Save to History (Persistence for Reports Module)
      if (arrearRecords.length > 0 && setArrearHistory) {
          const newBatch: ArrearBatch = {
              month: currentMonth,
              year: currentYear,
              effectiveMonth,
              effectiveYear,
              records: arrearRecords
          };
          setArrearHistory(prev => {
              // Replace existing batch for same month/year if exists, or append
              const filtered = prev.filter(b => !(b.month === currentMonth && b.year === currentYear));
              return [...filtered, newBatch];
          });
      }

      // 3. Generate Report immediately
      if (arrearRecords.length > 0) {
          generateArrearReport(
              arrearRecords, 
              effectiveMonth, effectiveYear, 
              currentMonth, currentYear, 
              generateReportFormat, 
              companyProfile
          );
      }

      setIsProcessing(false);
      setShowConfirmation(false);
      alert(`Arrear Wages for the Month ${currentMonth} Year ${currentYear} is Processed & Employee Pay details also updated Successfully`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-600 rounded-xl shadow-lg shadow-purple-900/30">
                    <TrendingUp size={28} className="text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white">Arrear & Increment Manager</h2>
                    <p className="text-slate-400 text-sm">Revise salaries and calculate past dues.</p>
                </div>
            </div>
            
            <div className="flex gap-4 items-end bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Effective From</label>
                    <div className="flex gap-2">
                        <select className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-bold outline-none" value={effectiveMonth} onChange={e => setEffectiveMonth(e.target.value)}>{months.map(m => <option key={m} value={m}>{m}</option>)}</select>
                        <select className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-bold outline-none" value={effectiveYear} onChange={e => setEffectiveYear(+e.target.value)}>{Array.from({length: 5}, (_, i) => currentYear - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}</select>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Arrear Period</span>
                    <p className="text-xl font-black text-emerald-400">{calculateMonthsPassed()} <span className="text-xs text-slate-400 font-normal">Months</span></p>
                </div>
            </div>
        </div>

        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 shadow-lg">
            <div className="flex gap-6 border-b border-slate-800 pb-6 mb-6">
                <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Increment Type</label>
                    <div className="flex gap-2">
                        <button onClick={() => setIncrementType('Percentage')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${incrementType === 'Percentage' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>Percentage Based (%)</button>
                        <button onClick={() => setIncrementType('Adhoc')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${incrementType === 'Adhoc' ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>Ad-hoc / Absolute</button>
                    </div>
                </div>

                {incrementType === 'Percentage' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-left-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Application Mode</label>
                        <div className="flex gap-2">
                            <button onClick={() => setPercentageMode('Flat')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${percentageMode === 'Flat' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Flat % (All Employees)</button>
                            <button onClick={() => setPercentageMode('Specific')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${percentageMode === 'Specific' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Specific % Per Employee</button>
                        </div>
                    </div>
                )}

                {incrementType === 'Percentage' && percentageMode === 'Flat' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-left-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Increment %</label>
                        <div className="flex items-center gap-2">
                            <input type="number" className="w-24 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold outline-none focus:border-blue-500" placeholder="0.00" value={flatPercentage} onChange={e => setFlatPercentage(+e.target.value)} />
                            <span className="text-slate-500 font-bold">%</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="overflow-x-auto max-h-[500px] custom-scrollbar rounded-lg border border-slate-800">
                <table className="w-full text-left text-sm">
                    <thead className="bg-[#0f172a] text-slate-400 uppercase font-bold text-xs sticky top-0 z-10 shadow-md">
                        <tr>
                            <th className="px-4 py-3">Employee</th>
                            <th className="px-4 py-3 text-right">Current Basic</th>
                            {incrementType === 'Adhoc' ? (
                                <th className="px-4 py-3 text-center bg-purple-900/20 text-purple-300">Incr Amt (Basic)</th>
                            ) : (
                                percentageMode === 'Specific' && <th className="px-4 py-3 text-center bg-blue-900/20 text-blue-300">Incr %</th>
                            )}
                            <th className="px-4 py-3 text-right font-black text-emerald-400">New Basic</th>
                            <th className="px-4 py-3 text-right border-l border-slate-700">Current DA</th>
                            {incrementType === 'Adhoc' && <th className="px-4 py-3 text-center bg-purple-900/20 text-purple-300">Incr Amt (DA)</th>}
                            <th className="px-4 py-3 text-right font-black text-emerald-400">New DA</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {activeEmployees.map(emp => {
                            const { newBasic, newDA } = getProposedSalary(emp);
                            const adhoc = adhocIncrements[emp.id] || { basic: 0, da: 0 };
                            
                            return (
                                <tr key={emp.id} className="hover:bg-slate-800/50">
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-white text-xs">{emp.name}</div>
                                        <div className="text-[10px] text-slate-500">{emp.id}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-400">{emp.basicPay}</td>
                                    
                                    {incrementType === 'Adhoc' ? (
                                        <td className="px-4 py-3 text-center bg-purple-900/10">
                                            <input 
                                                type="number" 
                                                className="w-20 bg-slate-900 border border-purple-500/50 rounded px-2 py-1 text-right text-white font-bold outline-none focus:ring-1 focus:ring-purple-500" 
                                                value={adhoc.basic}
                                                onChange={e => setAdhocIncrements({...adhocIncrements, [emp.id]: { ...adhoc, basic: +e.target.value }})}
                                            />
                                        </td>
                                    ) : (
                                        percentageMode === 'Specific' && (
                                            <td className="px-4 py-3 text-center bg-blue-900/10">
                                                <input 
                                                    type="number" 
                                                    className="w-16 bg-slate-900 border border-blue-500/50 rounded px-2 py-1 text-center text-white font-bold outline-none focus:ring-1 focus:ring-blue-500" 
                                                    value={specificPercentages[emp.id] || 0}
                                                    onChange={e => setSpecificPercentages({...specificPercentages, [emp.id]: +e.target.value})}
                                                />
                                            </td>
                                        )
                                    )}

                                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">{newBasic}</td>
                                    
                                    <td className="px-4 py-3 text-right font-mono text-slate-400 border-l border-slate-700">{emp.da || 0}</td>
                                    
                                    {incrementType === 'Adhoc' && (
                                        <td className="px-4 py-3 text-center bg-purple-900/10">
                                            <input 
                                                type="number" 
                                                className="w-20 bg-slate-900 border border-purple-500/50 rounded px-2 py-1 text-right text-white font-bold outline-none focus:ring-1 focus:ring-purple-500" 
                                                value={adhoc.da}
                                                onChange={e => setAdhocIncrements({...adhocIncrements, [emp.id]: { ...adhoc, da: +e.target.value }})}
                                            />
                                        </td>
                                    )}

                                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">{newDA}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex justify-end">
                <button onClick={handleProcess} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl shadow-lg transition-all flex items-center gap-2 transform hover:scale-105 active:scale-95">
                    <Save size={18} /> PROCESS & SAVE INCREMENTS
                </button>
            </div>
        </div>

        {/* CONFIRMATION MODAL */}
        {showConfirmation && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <div className="p-4 bg-amber-900/20 rounded-full text-amber-500 border border-amber-900/50">
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-xl font-black text-white">Confirm Salary Revision</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            This action will <b>permanently update the Basic Pay and DA</b> for all listed active employees in the Master Database.
                            <br/><br/>
                            Calculated Arrears: <b>{calculateMonthsPassed()} Months</b>
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <button onClick={() => executeSave('PDF')} className="flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg transition-all text-xs">
                            <Download size={16} /> Save & PDF Report
                        </button>
                        <button onClick={() => executeSave('Excel')} className="flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg transition-all text-xs">
                            <Download size={16} /> Save & Excel Report
                        </button>
                    </div>
                    <button onClick={() => setShowConfirmation(false)} className="w-full py-2.5 rounded-lg border border-slate-600 text-slate-400 font-bold hover:bg-slate-800 hover:text-white transition-all text-xs">
                        Cancel
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default ArrearManager;
