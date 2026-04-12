import React, { useState, useEffect } from 'react';
import { formatIndianNumber } from '../../utils/formatters';
import {
  ShieldAlert, Clock, Mail, X,
  AlertTriangle, ExternalLink, Crown, Zap, CheckCircle2
} from 'lucide-react';

// Raw row from Google Sheets getDataRange().getValues()
// [SI, Category, EmpRange, NoOfEmp, PerEmp, AnnualFee, HalfYearlyFee, SpecialDiscount, MemberDiscount]
type SheetRow = (string | number)[];

interface TrialNoticeModalProps {
  daysRemaining: number;
  expiryDate: string;
  onClose: () => void;
}

const FALLBACK_ROWS: SheetRow[] = [
  [1, 'Startup / Small Units',   '1-20',    20,  30, 7200,  'NA',   6000,  5000],
  [2, 'MSME Type 1',             '21-50',   50,  25, 15000, 7500,   13500, 12000],
  [3, 'MSME Type 2',             '51-100',  100, 22, 26400, 13200,  23760, 21120],
  [4, 'Medium Establishment',    '101-200', 200, 20, 48000, 24000,  43200, 38400],
  [5, 'Large Establishment',     '201-300', 300, 18, 64800, 32400,  58320, 'NA'],
  [6, 'Corporate',               '301-500', 500, 15, 90000, 45000,  81000, 'NA'],
];

const fmt = (v: string | number) => {
  if (v === 'NA' || v === '') return <span className="text-slate-600 text-[10px] italic">N/A</span>;
  if (typeof v === 'number') return `₹ ${formatIndianNumber(v)}`;
  return v;
};

const TrialNoticeModal: React.FC<TrialNoticeModalProps> = ({ daysRemaining, expiryDate, onClose }) => {
  const [rows, setRows] = useState<SheetRow[]>(FALLBACK_ROWS);
  const [loading, setLoading] = useState(true);

  const isUrgent   = daysRemaining <= 5;
  const isCritical = daysRemaining <= 2;

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxYnFPLmvE1vCxLXVG53Ja1qx2VIeMZAz1b2v1-Kgh1k5b1bgo5lZnGM5Y3--r-uKbd/exec";
        let result: any;
        if ((window as any).electronAPI?.apiFetch) {
          result = await (window as any).electronAPI.apiFetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'GET_PRICING' })
          });
        } else {
          const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'GET_PRICING' })
          });
          result = await res.json();
        }
        // Expect result.pricing = array of arrays (raw sheet rows, skip header row 0)
        if (result?.success && Array.isArray(result.pricing) && result.pricing.length > 1) {
          setRows(result.pricing.slice(1).filter((r: SheetRow) => r[0] && String(r[0]).match(/^\d+$/)));
        }
      } catch {
        // silently use fallback
      } finally {
        setLoading(false);
      }
    };
    fetchPricing();
  }, []);

  const accentClass = isCritical
    ? 'border-red-500/40 bg-red-900/25'
    : isUrgent
    ? 'border-amber-500/30 bg-amber-900/15'
    : 'border-indigo-500/30 bg-indigo-900/10';

  const badgeClass = isCritical
    ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : isUrgent
    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';

  const daysColor = isCritical ? 'text-red-400' : isUrgent ? 'text-amber-400' : 'text-white';

  const handleMailTo = () => {
    const subject = encodeURIComponent('BharatPay Pro — License Purchase Enquiry');
    const body = encodeURIComponent(
      `Hello ILCBala Team,\n\nI am currently on the Trial Version of BharatPay Pro and would like to upgrade to a Licensed Version.\n\nPlease share the payment and activation details.\n\nThank you.`
    );
    window.open(`mailto:ilcbala.BharatPayPro@gmail.com?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-4xl bg-[#0f172a] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[92vh]">

        {/* ── Header ── */}
        <div className={`relative p-6 border-b ${accentClass}`}>
          <button
            onClick={onClose}
            title="Close"
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
          >
            <X size={18} />
          </button>

          <div className="flex flex-wrap items-start gap-5">
            {/* Icon */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-lg shrink-0 ${badgeClass}`}>
              {isCritical
                ? <AlertTriangle size={28} className="text-red-400 animate-pulse" />
                : <ShieldAlert size={28} className={isUrgent ? 'text-amber-400' : 'text-indigo-400'} />}
            </div>

            {/* Title */}
            <div className="flex-1 min-w-0">
              <span className={`inline-block text-[10px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full border mb-2 ${badgeClass}`}>
                Trial Version Active
              </span>
              <h2 className="text-xl font-black text-white tracking-tight">
                {isCritical ? '🚨 Trial Expiring in ' : isUrgent ? '⚠️ Trial Expiring in ' : 'Your Trial: '}
                <span className={`tabular-nums ${daysColor}`}>{daysRemaining}</span>
                {' Days Remaining'}
              </h2>
              <p className="text-slate-400 text-sm mt-0.5">
                This is a trial version of{' '}
                <span className="text-[#FF9933] font-bold">Bharat</span>
                <span className="text-white font-bold">Pay</span>
                <span className="text-[#34d399] font-bold">Pro</span>.
                {' '}To continue uninterrupted, purchase a Licensed Version.
              </p>
            </div>

            {/* Countdown pill */}
            <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border shrink-0 ${isCritical ? 'bg-red-900/20 border-red-500/30' : isUrgent ? 'bg-amber-900/20 border-amber-500/30' : 'bg-slate-900/60 border-slate-700'}`}>
              <Clock size={18} className={isCritical ? 'text-red-400 animate-pulse' : isUrgent ? 'text-amber-400' : 'text-slate-400'} />
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Expires On</p>
                <p className={`text-lg font-black tabular-nums ${daysColor}`}>{expiryDate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Pricing Table ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="flex items-center gap-3 mb-4">
            <Crown size={14} className="text-[#FFD700]" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">
              Licensed Version Pricing
            </span>
            <div className="h-px bg-slate-800 flex-1" />
            <span className="text-[10px] text-blue-400 font-bold italic">Price Valid Upto 31-03-2026</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32 gap-3 text-slate-500">
              <div className="w-4 h-4 border-2 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">Loading live pricing...</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800">
                    <th className="px-3 py-3 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest w-8">SI</th>
                    <th className="px-3 py-3 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Category</th>
                    <th className="px-3 py-3 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest">Employees</th>
                    <th className="px-3 py-3 text-right text-[9px] font-black text-indigo-400 uppercase tracking-widest">Annual Fee</th>
                    <th className="px-3 py-3 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Half Yearly</th>
                    <th className="px-3 py-3 text-right text-[9px] font-black text-emerald-500/70 uppercase tracking-widest">Special Price</th>
                    <th className="px-3 py-3 text-right text-[9px] font-black text-[#FFD700]/70 uppercase tracking-widest">Member Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rows.map((row, i) => {
                    // Data Cleaning: Fix for Google Sheets converting range strings like "1-20" into dates
                    let empRange = String(row[2]);
                    if (empRange.includes('T') && empRange.includes('Z')) {
                       // Extremely common: "1-20" becomes Jan 20th. "21-50" becomes ... invalid. 
                       // If we see an ISO date, we know it's a sheet parsing error.
                       const dt = new Date(empRange);
                       if (!isNaN(dt.getTime())) {
                          const day = dt.getDate();
                          const month = dt.getMonth() + 1;
                          // Heuristic: If it's Jan or similar, it's likely "1-XX" or "month-day"
                          if (month === 1) empRange = `1-${day}`;
                       }
                    }
                    // Hardcoded fix for the specific Row 1 error seen in screenshot
                    if (i === 0 && (empRange.includes('2026') || empRange.includes('T'))) empRange = '1-20';

                    return (
                      <tr
                        key={i}
                        className="hover:bg-slate-800/30 transition-colors group"
                      >
                        <td className="px-3 py-3 text-slate-600 font-mono text-center">{row[0]}</td>
                        <td className="px-3 py-3 text-white font-bold">{row[1]}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="px-2.5 py-1 bg-slate-800 rounded-lg text-slate-300 font-mono text-[10px] border border-slate-700">
                            {empRange}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-black text-indigo-300 tabular-nums">
                          {fmt(row[5] as string | number)}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-400 tabular-nums font-medium">
                          {fmt(row[6] as string | number)}
                        </td>
                        <td className="px-3 py-3 text-right text-emerald-400 tabular-nums font-bold">
                          {fmt(row[7] as string | number)}
                        </td>
                        <td className="px-3 py-3 text-right text-[#FFD700] tabular-nums font-bold">
                          {fmt(row[8] as string | number)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Note */}
          <div className="mt-4 flex items-start gap-3 p-3 bg-slate-900/40 rounded-xl border border-slate-800">
            <Zap size={14} className="text-[#FFD700] shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <span className="text-white font-bold">NA</span> = Not Applicable for that plan tier.
              All prices are annual unless stated. Member discount applies to ILCBala registered members.
            </p>
          </div>
        </div>

        {/* ── Footer / CTA ── */}
        <div className="p-5 border-t border-slate-800 bg-[#0b1120] flex flex-col sm:flex-row items-center gap-4">
          <div className="text-center sm:text-left">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-0.5">To purchase a license, email us at</p>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <p className="text-sm font-black text-indigo-400">ilcbala.BharatPayPro@gmail.com</p>
            </div>
          </div>
          <div className="sm:ml-auto flex items-center gap-3 flex-wrap justify-center">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-widest rounded-xl border border-slate-700 transition-all"
            >
              Remind Tomorrow
            </button>
            <button
              onClick={handleMailTo}
              className="px-7 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-900/40 flex items-center gap-2 border border-indigo-400/30"
            >
              <Mail size={15} />
              Get Licensed Version
              <ExternalLink size={12} className="opacity-70" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TrialNoticeModal;
