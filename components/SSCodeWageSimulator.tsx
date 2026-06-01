import React, { useState } from 'react';
import { X, Calculator, Info, Printer } from 'lucide-react';

interface SSCodeWageSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
}

const SSCodeWageSimulator: React.FC<SSCodeWageSimulatorProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  // Wages Includes
  const [basic, setBasic] = useState<number>(10000);
  const [da, setDa] = useState<number>(5000);
  const [retaining, setRetaining] = useState<number>(2000);

  // Allowances (Wages Excludes)
  const [washing, setWashing] = useState<number>(500);
  const [bonus, setBonus] = useState<number>(1500);
  const [accommodations, setAccommodations] = useState<number>(0);
  const [pension, setPension] = useState<number>(0);
  const [conveyance, setConveyance] = useState<number>(1000);
  const [special, setSpecial] = useState<number>(500);
  const [hra, setHra] = useState<number>(3500);
  const [award, setAward] = useState<number>(0);
  const [ot, setOt] = useState<number>(900);
  const [commission, setCommission] = useState<number>(300);
  const [showLogic, setShowLogic] = useState<boolean>(false);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);

  // Core Calculations (Row 7 and Row 19)
  const totalA = basic + da + retaining;
  const totalB = washing + bonus + accommodations + pension + conveyance + special + hra + award + ot + commission;
  
  // Row 20
  const gross = totalA + totalB;
  
  // Row 21: Percentage of B on Gross
  const percentageB = gross > 0 ? (totalB / gross) * 100 : 0;
  const isThresholdCrossed = percentageB > 50;

  // Row 22: Wages for PF
  const pfOldLaw = Math.min(totalA, 15000);
  const pfSSCodeBase = isThresholdCrossed ? (gross / 2) : totalA;
  const pfSSCode = Math.min(pfSSCodeBase, 15000);

  // Row 23: Wages for ESI
  const esiOldLaw = totalA + special + hra + ot + commission;
  const esiSSCode = isThresholdCrossed ? (gross / 2) : totalA;

  // Row 24: ESI Wage Ceiling
  const esiCeiling = 21000;

  // Row 25: ESI Applicable
  const esiApplicableOld = (esiOldLaw - ot) <= esiCeiling ? "Yes" : "No";
  const esiApplicableSS = esiSSCode <= esiCeiling ? "Yes" : "No";

  const renderInputRow = (
    slNo: string,
    description: string,
    value: number,
    setter: (val: number) => void,
    isInclude: boolean,
    indexLabel?: string
  ) => (
    <tr className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
      <td className="p-2 text-center text-xs font-mono text-slate-400 border-r border-slate-700/50">{slNo}</td>
      <td className="p-2 text-sm font-medium text-slate-300 border-r border-slate-700/50">
        <div className="flex items-center gap-2">
          {indexLabel && <span className="w-5 text-center text-[10px] font-bold text-slate-500 bg-slate-800 rounded">{indexLabel}</span>}
          {description}
        </div>
      </td>
      <td className={`p-2 border-r border-slate-700/50 ${isInclude ? 'bg-emerald-900/10' : 'bg-rose-900/10'}`}>
        <input
          type="number"
          value={value === 0 ? '' : value}
          onChange={(e) => setter(Number(e.target.value))}
          placeholder="0"
          className="w-full bg-transparent text-right text-sm font-bold text-slate-200 outline-none focus:text-blue-400 placeholder-slate-600"
        />
      </td>
      <td className={`p-2 ${isInclude ? 'bg-emerald-900/10' : 'bg-rose-900/10'}`}>
        <div className="text-right text-sm font-bold text-slate-200">{value}</div>
      </td>
    </tr>
  );

  const renderPreviewRow = (slNo: string, description: string, val1: number, val2: number, indexLabel?: string) => (
    <tr>
      <td className="border border-gray-400 p-2 text-center text-xs text-gray-500">{slNo}</td>
      <td className="border border-gray-400 p-2 text-sm text-gray-800">
        <div className="flex items-center gap-2">
          {indexLabel && <span className="w-5 text-center text-[10px] font-bold text-gray-600 bg-gray-200 rounded">{indexLabel}</span>}
          {description}
        </div>
      </td>
      <td className="border border-gray-400 p-2 text-right text-sm text-gray-900 font-medium">{val1 === 0 ? '' : val1.toFixed(2)}</td>
      <td className="border border-gray-400 p-2 text-right text-sm text-gray-900 font-medium">{val2 === 0 ? '' : val2.toFixed(2)}</td>
    </tr>
  );

  if (isPreviewMode) {
    return (
      <div className="fixed inset-0 z-[200] bg-gray-100 flex flex-col print:bg-white print:static print:block">
        {/* Top Action Bar (hidden in actual print) */}
        <div className="bg-white border-b border-gray-300 p-4 flex justify-between items-center shadow-sm print:hidden shrink-0">
          <h2 className="text-xl font-black text-gray-800">Print Preview</h2>
          <div className="flex gap-3">
            <button onClick={() => setIsPreviewMode(false)} className="px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-bold hover:bg-gray-50 text-gray-700 transition-colors">Back to Editor</button>
            <button onClick={() => window.print()} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/30">
              <Printer size={18} /> Print Document
            </button>
          </div>
        </div>
        
        {/* Printable Page Container */}
        <div className="flex-1 overflow-auto p-8 print:p-0 print:overflow-visible flex justify-center relative">
          <div className="w-full max-w-4xl bg-white p-12 shadow-2xl print:shadow-none print:p-0 border border-gray-200 print:border-none h-max relative overflow-hidden">
            
            {/* Watermark */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0 overflow-hidden">
              <div className="text-[130px] font-black text-gray-100/80 transform -rotate-45 select-none whitespace-nowrap tracking-widest">
                BharatPay Pro
              </div>
            </div>

            <div className="relative z-10">
              <div className="mb-6 border-b-2 border-gray-800 pb-4">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <img src="/logo.png" alt="BharatPay Pro" className="h-14 w-14 object-cover rounded-full ring-4 ring-orange-500/20 shadow-md" onError={(e) => (e.currentTarget.src = '/logo3.png')} />
                  <div className="text-3xl font-black tracking-tight mt-1">
                    <span className="text-orange-600">Bharat</span>
                    <span className="text-blue-700">Pay</span>
                    <span className="text-emerald-600 ml-1">Pro</span>
                  </div>
                </div>
                <div className="text-gray-300">
                  <Printer size={32} />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 uppercase tracking-widest">Interactive Wage Simulator</h1>
                <p className="text-sm font-bold text-gray-500 mt-1 uppercase tracking-wider">Social Security Code Wages PF and ESI Calculation</p>
              </div>
            </div>
            
            <table className="w-full text-left border-collapse border-2 border-gray-800">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 p-3 text-xs font-black text-gray-600 uppercase tracking-widest text-center w-16">Sl No</th>
                  <th className="border border-gray-400 p-3 text-xs font-black text-gray-600 uppercase tracking-widest">Description</th>
                  <th className="border border-gray-400 p-3 text-xs font-black text-gray-600 uppercase tracking-widest text-right w-32">Old Law</th>
                  <th className="border border-gray-400 p-3 text-xs font-black text-gray-600 uppercase tracking-widest text-right w-32">SS Code</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-gray-200"><td colSpan={4} className="p-2 text-xs font-black text-gray-800 uppercase tracking-widest border border-gray-400">Wages Includes:</td></tr>
                {renderPreviewRow('', 'Basic', basic, basic)}
                {renderPreviewRow('', 'DA', da, da)}
                {renderPreviewRow('', 'Retaining Allowance', retaining, retaining)}
                <tr className="bg-gray-100 border-y-2 border-gray-400">
                  <td colSpan={2} className="p-3 text-right text-sm font-black text-gray-800 uppercase tracking-widest border-r border-gray-400">(A)</td>
                  <td className="p-3 text-right text-sm font-black text-gray-800 border-r border-gray-400">{totalA.toFixed(2)}</td>
                  <td className="p-3 text-right text-sm font-black text-gray-800">{totalA.toFixed(2)}</td>
                </tr>

                <tr className="bg-gray-200"><td colSpan={4} className="p-2 text-xs font-black text-gray-800 uppercase tracking-widest border border-gray-400">Allowances: (Wages Excludes)</td></tr>
                {renderPreviewRow('', 'Washing', washing, washing)}
                {renderPreviewRow('', 'Statutory Bonus', bonus, bonus, 'a')}
                {renderPreviewRow('', 'House Accommodation', accommodations, accommodations, 'b')}
                {renderPreviewRow('', 'Contribution to Pension/Provident', pension, pension, 'c')}
                {renderPreviewRow('', 'Conveyance', conveyance, conveyance, 'd')}
                {renderPreviewRow('', 'Special Expenses', special, special, 'e')}
                {renderPreviewRow('', 'HRA', hra, hra, 'f')}
                {renderPreviewRow('', 'Award / Settlement', award, award, 'g')}
                {renderPreviewRow('', 'Over Time', ot, ot, 'h')}
                {renderPreviewRow('', 'Commission', commission, commission, 'i')}
                <tr className="bg-gray-100 border-y-2 border-gray-400">
                  <td colSpan={2} className="p-3 text-right text-sm font-black text-gray-800 uppercase tracking-widest border-r border-gray-400">(B)</td>
                  <td className="p-3 text-right text-sm font-black text-gray-800 border-r border-gray-400">{totalB.toFixed(2)}</td>
                  <td className="p-3 text-right text-sm font-black text-gray-800">{totalB.toFixed(2)}</td>
                </tr>

                <tr className="bg-gray-200 border-y-2 border-gray-800">
                  <td colSpan={2} className="p-3 text-right text-sm font-black text-gray-900 uppercase tracking-widest border-r border-gray-800">GROSS (C) = ( A+B )</td>
                  <td className="p-3 text-right text-sm font-black text-gray-900 border-r border-gray-800">{gross.toFixed(2)}</td>
                  <td className="p-3 text-right text-sm font-black text-gray-900">{gross.toFixed(2)}</td>
                </tr>

                <tr>
                  <td colSpan={2} className="p-3 text-sm font-bold text-gray-700 border border-gray-400">Percentage of "B" on Gross</td>
                  <td className="p-3 text-right text-sm font-bold text-gray-500 border border-gray-400">NA</td>
                  <td className="p-3 text-right text-sm font-black text-gray-900 border border-gray-400">{percentageB.toFixed(2)}%</td>
                </tr>
                <tr>
                  <td colSpan={2} className="p-3 text-sm font-bold text-gray-700 border border-gray-400">Wages for PF = "A" or 50% of "C" whichever is higher, subject to PF wage ceiling of ₹ 15000</td>
                  <td className="p-3 text-right text-sm font-bold text-gray-900 border border-gray-400">{pfOldLaw.toFixed(2)}</td>
                  <td className="p-3 text-right text-sm font-bold text-gray-900 border border-gray-400">{pfSSCode.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="p-3 text-sm font-bold text-gray-700 border border-gray-400">Wages for ESI = "A" + e + f + h + i</td>
                  <td className="p-3 text-right text-sm font-bold text-gray-900 border border-gray-400">{esiOldLaw.toFixed(2)}</td>
                  <td className="p-3 text-right text-sm font-bold text-gray-900 border border-gray-400">{esiSSCode.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="p-3 text-sm font-bold text-gray-700 border border-gray-400">ESI Wage Ceiling</td>
                  <td className="p-3 text-right text-sm font-bold text-gray-900 border border-gray-400">{esiCeiling.toFixed(2)}</td>
                  <td className="p-3 text-right text-sm font-bold text-gray-900 border border-gray-400">{esiCeiling.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-100">
                  <td colSpan={2} className="p-3 text-sm font-black text-gray-900 uppercase tracking-widest border border-gray-400">ESI Applicable</td>
                  <td className="p-3 text-right text-sm font-black border border-gray-400 text-gray-900">{esiApplicableOld}</td>
                  <td className="p-3 text-right text-sm font-black border border-gray-400 text-gray-900">{esiApplicableSS}</td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 print:static print:bg-white print:p-0 print:block">
      <div className="bg-[#0f172a] w-full max-w-3xl max-h-[90vh] rounded-2xl border border-blue-500/30 shadow-[0_0_50px_rgba(37,99,235,0.15)] flex flex-col overflow-hidden animate-in zoom-in-95 print:max-h-none print:shadow-none print:border-none print:text-black print:bg-white">
        
        {/* Header */}
        <div className="bg-[#1e293b] p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 rounded-xl border border-blue-500/30">
              <Calculator className="text-blue-400" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-widest">Interactive Wage Simulator</h3>
              <div className="flex items-center gap-3">
                <p className="text-xs font-bold text-slate-400 tracking-wider">Social Security Code Wages PF and ESI Calculation</p>
                <button onClick={() => setShowLogic(!showLogic)} className="text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1 print:hidden">
                  <Info className="w-3 h-3" />
                  {showLogic ? 'Hide Logic' : 'Calculation Logic'}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 print:hidden">
            <button onClick={() => setIsPreviewMode(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-slate-700" title="Print Simulator">
              <Printer size={16} />
              Print Preview
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-rose-500/20 rounded-lg transition-colors" title="Close Simulator">
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Logic Explanation Panel */}
        {showLogic && (
          <div className="bg-slate-800 p-6 border-b border-slate-700 text-sm text-slate-300 print:block">
            <h4 className="text-white font-bold mb-3 uppercase tracking-wider">Calculation Logic Breakdown</h4>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h5 className="font-bold text-blue-400 mb-2">🏛️ Provident Fund (PF)</h5>
                <ul className="space-y-2 list-disc ml-6 text-slate-300 leading-relaxed">
                  <li><strong>Legacy (Old Law):</strong> PF is calculated on "A" (Basic + DA + Retaining). Capped at the ₹15,000 statutory wage ceiling.</li>
                  <li><strong>SS Code:</strong> Checks if allowances (B) exceed 50% of Gross (C). If yes, the PF wage base is forcibly bumped up to exactly 50% of Gross. Capped at ₹15,000.</li>
                </ul>
              </div>
              <div>
                <h5 className="font-bold text-emerald-400 mb-2">🏥 Employee's State Insurance (ESI)</h5>
                <ul className="space-y-2 list-disc ml-6 text-slate-300 leading-relaxed">
                  <li><strong>Legacy (Old Law):</strong> Wages = "A" + Special Expenses + HRA + Over Time + Commission. Applicability check (≤ ₹21,000) excludes Over Time, but actual deduction includes it.</li>
                  <li><strong>SS Code:</strong> Wages = "A" or 50% of "C" (whichever is higher). This standardized wage is tested directly against the ₹21,000 ceiling.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-6 print:p-0 flex flex-col min-h-0">
          <div className="rounded-xl border border-slate-700/80 bg-[#1e293b] shadow-xl flex-1 overflow-y-auto custom-scrollbar print:overflow-visible print:shadow-none print:border-gray-300 print:bg-white relative">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 bg-slate-900 p-3 text-xs font-black text-slate-400 uppercase tracking-widest text-center border-b border-r border-slate-700 w-16 shadow-md shadow-black/20">Sl No</th>
                  <th className="sticky top-0 z-10 bg-slate-900 p-3 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-r border-slate-700 shadow-md shadow-black/20">Description</th>
                  <th className="sticky top-0 z-10 bg-slate-900 p-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right border-b border-r border-slate-700 w-32 shadow-md shadow-black/20">Old Law</th>
                  <th className="sticky top-0 z-10 bg-slate-900 p-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right border-b border-slate-700 w-32 shadow-md shadow-black/20">SS Code</th>
                </tr>
              </thead>
              <tbody>
                {/* Wages Includes */}
                <tr>
                  <td colSpan={4} className="p-2 bg-emerald-900/20 text-xs font-black text-emerald-400 uppercase tracking-widest border-b border-slate-700">
                    Wages Includes:
                  </td>
                </tr>
                {renderInputRow('', 'Basic', basic, setBasic, true)}
                {renderInputRow('', 'DA', da, setDa, true)}
                {renderInputRow('', 'Retaining Allowance', retaining, setRetaining, true)}
                <tr className="bg-emerald-950/30 border-y border-slate-700">
                  <td colSpan={2} className="p-3 text-right text-sm font-black text-emerald-300 uppercase tracking-widest border-r border-slate-700">(A)</td>
                  <td className="p-3 text-right text-sm font-black text-emerald-400 border-r border-slate-700">{totalA.toFixed(2)}</td>
                  <td className="p-3 text-right text-sm font-black text-emerald-400">{totalA.toFixed(2)}</td>
                </tr>

                {/* Allowances Excludes */}
                <tr>
                  <td colSpan={4} className="p-2 bg-rose-900/20 text-xs font-black text-rose-400 uppercase tracking-widest border-b border-slate-700">
                    Allowances: (Wages Excludes)
                  </td>
                </tr>
                {renderInputRow('', 'Washing', washing, setWashing, false)}
                {renderInputRow('', 'Statutory Bonus', bonus, setBonus, false, 'a')}
                {renderInputRow('', 'House Accommodation', accommodations, setAccommodations, false, 'b')}
                {renderInputRow('', 'Contribution to Pension/Provident', pension, setPension, false, 'c')}
                {renderInputRow('', 'Conveyance', conveyance, setConveyance, false, 'd')}
                {renderInputRow('', 'Special Expenses', special, setSpecial, false, 'e')}
                {renderInputRow('', 'HRA', hra, setHra, false, 'f')}
                {renderInputRow('', 'Award / Settlement', award, setAward, false, 'g')}
                {renderInputRow('', 'Over Time', ot, setOt, false, 'h')}
                {renderInputRow('', 'Commission', commission, setCommission, false, 'i')}
                <tr className="bg-rose-950/30 border-y border-slate-700">
                  <td colSpan={2} className="p-3 text-right text-sm font-black text-rose-300 uppercase tracking-widest border-r border-slate-700">(B)</td>
                  <td className="p-3 text-right text-sm font-black text-rose-400 border-r border-slate-700">{totalB.toFixed(2)}</td>
                  <td className="p-3 text-right text-sm font-black text-rose-400">{totalB.toFixed(2)}</td>
                </tr>

                {/* Gross */}
                <tr className="bg-slate-800/50 border-b border-slate-700">
                  <td colSpan={2} className="p-3 text-right text-sm font-black text-white uppercase tracking-widest border-r border-slate-700">GROSS (C) = ( A+B )</td>
                  <td className="p-3 text-right text-sm font-black text-white border-r border-slate-700">{gross.toFixed(2)}</td>
                  <td className="p-3 text-right text-sm font-black text-white">{gross.toFixed(2)}</td>
                </tr>

                {/* Calculations */}
                <tr className="border-b border-slate-700 bg-indigo-950/20">
                  <td colSpan={2} className="p-3 text-sm font-bold text-slate-300 border-r border-slate-700">Percentage of "B" on Gross</td>
                  <td className="p-3 text-right text-sm font-bold text-slate-500 border-r border-slate-700">NA</td>
                  <td className={`p-3 text-right text-sm font-black ${isThresholdCrossed ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {percentageB.toFixed(2)}%
                  </td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td colSpan={2} className="p-3 text-sm font-bold text-slate-300 border-r border-slate-700">Wages for PF = "A" or 50% of "C" whichever is higher, subject to PF wage ceiling of ₹ 15000</td>
                  <td className="p-3 text-right text-sm font-bold text-white border-r border-slate-700">{pfOldLaw.toFixed(2)}</td>
                  <td className="p-3 text-right text-sm font-bold text-blue-400">{pfSSCode.toFixed(2)}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td colSpan={2} className="p-3 text-sm font-bold text-slate-300 border-r border-slate-700">Wages for ESI = "A" + e + f + h + i</td>
                  <td className="p-3 text-right text-sm font-bold text-white border-r border-slate-700">{esiOldLaw.toFixed(2)}</td>
                  <td className="p-3 text-right text-sm font-bold text-blue-400">{esiSSCode.toFixed(2)}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td colSpan={2} className="p-3 text-sm font-bold text-slate-300 border-r border-slate-700">ESI Wage Ceiling</td>
                  <td className="p-3 text-right text-sm font-bold text-white border-r border-slate-700">{esiCeiling.toFixed(2)}</td>
                  <td className="p-3 text-right text-sm font-bold text-white">{esiCeiling.toFixed(2)}</td>
                </tr>
                <tr className="border-b border-slate-700 bg-slate-900/50">
                  <td colSpan={2} className="p-3 text-sm font-black text-slate-300 uppercase tracking-widest border-r border-slate-700">ESI Applicable</td>
                  <td className={`p-3 text-right text-sm font-black border-r border-slate-700 ${esiApplicableOld === 'Yes' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {esiApplicableOld}
                  </td>
                  <td className={`p-3 text-right text-sm font-black ${esiApplicableSS === 'Yes' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {esiApplicableSS}
                  </td>
                </tr>

              </tbody>
            </table>
          </div>

          {/* Helper Note */}
          <div className="mt-4 p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl flex items-start gap-3 shrink-0">
            <Info className="text-blue-400 mt-0.5" size={16} />
            <p className="text-xs text-blue-200/80 leading-relaxed font-medium">
              You can edit the values in the "Old Law" column to instantly test how the Social Security Code affects the PF and ESI limits.
              If the Percentage of "B" on Gross exceeds 50%, the SS Code Wages are bumped to 50% of the Gross.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SSCodeWageSimulator;
