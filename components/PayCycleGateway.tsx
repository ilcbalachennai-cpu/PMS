import React, { useMemo } from 'react';
import { CalendarClock, ArrowRight, CheckCircle2, AlertCircle, Calendar, Lock } from 'lucide-react';
import { PayrollResult } from '../types';

interface PayCycleGatewayProps {
  month: string;
  year: number;
  setMonth: (m: string) => void;
  setYear: (y: number) => void;
  onProceed: () => void;
  savedRecords: PayrollResult[];
}

const PayCycleGateway: React.FC<PayCycleGatewayProps> = ({ month, year, setMonth, setYear, onProceed, savedRecords }) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  // Calculate next processing period based on finalized records
  const nextPeriod = useMemo(() => {
    const finalized = savedRecords.filter(r => r.status === 'Finalized');
    if (finalized.length === 0) return null;

    // Find latest finalized year and month
    let maxYear = 0;
    finalized.forEach(r => { if (r.year > maxYear) maxYear = r.year; });
    
    const monthsInMaxYear = finalized.filter(r => r.year === maxYear).map(r => months.indexOf(r.month));
    const maxMonthIdx = Math.max(...monthsInMaxYear);

    let targetMonthIdx = maxMonthIdx + 1;
    let targetYear = maxYear;

    if (targetMonthIdx > 11) {
      targetMonthIdx = 0;
      targetYear++;
    }

    return { month: months[targetMonthIdx], year: targetYear };
  }, [savedRecords]);

  // If nextPeriod exists, auto-force it
  React.useEffect(() => {
    if (nextPeriod) {
      if (month !== nextPeriod.month) setMonth(nextPeriod.month);
      if (year !== nextPeriod.year) setYear(nextPeriod.year);
    }
  }, [nextPeriod]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="flex flex-col items-center justify-start pt-0 h-full animate-in fade-in duration-700 px-6 py-2 overflow-y-auto">
      
      <div className="bg-[#111827]/80 backdrop-blur-2xl border border-slate-800/60 p-7 rounded-[2rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.7)] max-w-md w-full relative overflow-hidden">
        {/* TOP ICON BOX */}
        <div className="flex flex-col items-center text-center mb-4">
            <div className="w-12 h-12 bg-blue-600/10 text-blue-500/90 rounded-[1.2rem] flex items-center justify-center mb-2 ring-1 ring-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                <CalendarClock size={28} />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight uppercase">Pay Cycle Setup</h2>
            <p className="text-slate-500/80 text-[10px] mt-1 font-bold uppercase tracking-widest leading-relaxed">
                Select the processing period.
            </p>
        </div>

        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
                {/* MONTH SELECTOR */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 pl-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Month</label>
                        {nextPeriod && <Lock size={10} className="text-slate-600" />}
                    </div>
                    <div className="relative group">
                        <select
                            title="Select Processing Month"
                            aria-label="Select Processing Month"
                            disabled={!!nextPeriod}
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className={`w-full appearance-none bg-[#020617] border border-slate-800 rounded-xl px-4 py-3 text-white font-black transition-all text-sm focus:border-blue-500/30 outline-none ${nextPeriod ? 'cursor-not-allowed opacity-60' : 'hover:border-slate-600 cursor-pointer'}`}
                        >
                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-600">
                            <Calendar size={14} />
                        </div>
                    </div>
                </div>

                {/* YEAR SELECTOR */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 pl-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Year</label>
                        {nextPeriod && <Lock size={10} className="text-slate-600" />}
                    </div>
                    <div className="relative group">
                        <select
                            title="Select Processing Year"
                            aria-label="Select Processing Year"
                            disabled={!!nextPeriod}
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className={`w-full appearance-none bg-[#020617] border border-slate-800 rounded-xl px-4 py-3 text-white font-black transition-all text-sm focus:border-emerald-500/30 outline-none ${nextPeriod ? 'cursor-not-allowed opacity-60' : 'hover:border-slate-600 cursor-pointer'}`}
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-600">
                            <Calendar size={14} />
                        </div>
                    </div>
                </div>
            </div>

            {/* SEQUENTIAL DATA LOCK INFO BOX */}
            <div className="bg-[#1e293b]/20 p-3 rounded-2xl border border-blue-500/10 flex gap-3 items-center shadow-inner">
                <div className="w-8 h-8 rounded-full bg-blue-500/5 flex items-center justify-center shrink-0 border border-blue-500/10">
                    <AlertCircle className="text-blue-400/60" size={16} />
                </div>
                <div className="text-[10px] leading-relaxed text-slate-400">
                    <span className="text-blue-100/90 font-black text-[11px] uppercase tracking-tighter">Data Lock:</span> {month} {year} is the target period. Sequential processing is enforced for data integrity.
                </div>
            </div>

            {/* ACTION BUTTON */}
            <button 
                onClick={onProceed}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-2 group mt-2 h-12 transform active:scale-[0.98]"
            >
                <CheckCircle2 size={18} className="text-white/90" />
                <span className="text-sm tracking-tight italic">Start Process</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default PayCycleGateway;
