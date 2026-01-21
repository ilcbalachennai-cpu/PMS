import React from 'react';
import { CalendarClock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { View } from '../types';

interface PayCycleGatewayProps {
  month: string;
  year: number;
  setMonth: (m: string) => void;
  setYear: (y: number) => void;
  setActiveView: (v: View) => void;
}

const PayCycleGateway: React.FC<PayCycleGatewayProps> = ({ month, year, setMonth, setYear, setActiveView }) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const handleProceed = () => {
    // Navigate to the first step of the process
    setActiveView(View.PayProcess);
  };

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] animate-in fade-in duration-500">
      
      <div className="bg-[#1e293b] border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-lg w-full relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-600/10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>

        <div className="flex flex-col items-center text-center mb-8">
            <div className="p-4 bg-blue-900/20 text-blue-400 rounded-full mb-4 ring-1 ring-blue-500/30 shadow-lg">
                <CalendarClock size={48} />
            </div>
            <h2 className="text-2xl font-black text-white">Pay Cycle Setup</h2>
            <p className="text-slate-400 text-sm mt-2">
                Select the financial period you wish to process. This selection will synchronize Attendance, Ledgers, and Payroll modules.
            </p>
        </div>

        <div className="space-y-6">
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Select Month</label>
                <div className="grid grid-cols-3 gap-2">
                    {months.map(m => (
                        <button
                            key={m}
                            onClick={() => setMonth(m)}
                            className={`py-2 px-1 text-xs font-bold rounded-lg transition-all border ${
                                month === m 
                                ? 'bg-blue-600 border-blue-500 text-white shadow-md' 
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                            }`}
                        >
                            {m.slice(0, 3)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Select Year</label>
                <div className="flex gap-4">
                    {[2024, 2025].map(y => (
                        <button
                            key={y}
                            onClick={() => setYear(y)}
                            className={`flex-1 py-3 font-bold rounded-xl transition-all border ${
                                year === y 
                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-md' 
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                            }`}
                        >
                            {y}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex gap-3 items-start">
                <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={18} />
                <div className="text-xs text-slate-400">
                    <p>Current Active Context: <span className="text-white font-bold">{month} {year}</span></p>
                    <p className="mt-1 opacity-70">Changing this here updates the global payroll context.</p>
                </div>
            </div>

            <button 
                onClick={handleProceed}
                className="w-full bg-white text-slate-900 hover:bg-slate-100 font-black py-4 rounded-xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3 group"
            >
                <CheckCircle2 size={20} className="text-emerald-600" />
                START PROCESS
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default PayCycleGateway;