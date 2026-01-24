
import React from 'react';
import { CalendarClock, ArrowRight, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';

interface PayCycleGatewayProps {
  month: string;
  year: number;
  setMonth: (m: string) => void;
  setYear: (y: number) => void;
  onProceed: () => void;
}

const PayCycleGateway: React.FC<PayCycleGatewayProps> = ({ month, year, setMonth, setYear, onProceed }) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  // Dynamic Year Range: Current Year - 5 to Current Year + 1
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="flex flex-col items-center justify-start min-h-[500px] h-full pt-10 pb-8 animate-in fade-in duration-500 p-4">
      
      <div className="bg-[#1e293b] border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl max-w-md w-full relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-600/10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>

        <div className="flex flex-col items-center text-center mb-6">
            <div className="p-3 bg-blue-900/20 text-blue-400 rounded-full mb-3 ring-1 ring-blue-500/30 shadow-lg">
                <CalendarClock size={40} />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">Pay Cycle Setup</h2>
            <p className="text-slate-400 text-xs md:text-sm mt-2 max-w-xs mx-auto">
                Select the financial period you wish to process.
            </p>
        </div>

        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Month</label>
                    <div className="relative">
                        <select
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer hover:bg-slate-800 text-sm"
                        >
                            {months.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                            <Calendar size={14} />
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Year</label>
                    <div className="relative">
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer hover:bg-slate-800 text-sm"
                        >
                            {years.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                            <Calendar size={14} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex gap-3 items-center">
                <AlertCircle className="text-amber-400 shrink-0" size={18} />
                <div className="text-[10px] md:text-xs text-slate-400">
                    Active Context: <span className="text-white font-bold text-xs md:text-sm ml-1">{month} {year}</span>
                </div>
            </div>

            <button 
                onClick={onProceed}
                className="w-full bg-white text-slate-900 hover:bg-slate-100 font-black py-3.5 rounded-xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2 group mt-2 text-sm md:text-base"
            >
                <CheckCircle2 size={18} className="text-emerald-600" />
                START PROCESS
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default PayCycleGateway;
