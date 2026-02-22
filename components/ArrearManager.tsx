
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
    const [adhocIncrements, setAdhocIncrements] = useState<Record<string, { basic: number, da: number, hra: number, conveyance: number, washing: number, attire: number, special1: number, special2: number, special3: number }>>({});

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const [effectiveMonth, setEffectiveMonth] = useState<string>(currentMonth);
    const [effectiveYear, setEffectiveYear] = useState<number>(currentYear);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Initialize adhoc state
    useEffect(() => {
        const initialAdhoc: Record<string, { basic: number, da: number, hra: number, conveyance: number, washing: number, attire: number, special1: number, special2: number, special3: number }> = {};
        employees.forEach(e => {
            if (!e.dol) {
                initialAdhoc[e.id] = { basic: 0, da: 0, hra: 0, conveyance: 0, washing: 0, attire: 0, special1: 0, special2: 0, special3: 0 };
            }
        });
        setAdhocIncrements(initialAdhoc);
    }, [employees]);

    const activeEmployees = useMemo(() => {
        let emps = employees.filter(e => !e.dol);
        if (searchQuery.trim()) {
            const lowerQ = searchQuery.toLowerCase();
            emps = emps.filter(e => e.name.toLowerCase().includes(lowerQ) || e.id.toLowerCase().includes(lowerQ));
        }
        return emps;
    }, [employees, searchQuery]);

    const calculateMonthsPassed = () => {
        const currentIdx = months.indexOf(currentMonth);
        const effectiveIdx = months.indexOf(effectiveMonth);

        const monthsDiff = (currentYear - effectiveYear) * 12 + (currentIdx - effectiveIdx);
        return Math.max(0, monthsDiff);
    };

    const getProposedSalary = (emp: Employee) => {
        let newBasic = emp.basicPay;
        let newDA = emp.da || 0;
        let newHRA = emp.hra || 0;
        let newConveyance = emp.conveyance || 0;
        let newWashing = emp.washing || 0;
        let newAttire = emp.attire || 0;
        let newSpecial1 = emp.specialAllowance1 || 0;
        let newSpecial2 = emp.specialAllowance2 || 0;
        let newSpecial3 = emp.specialAllowance3 || 0;

        if (incrementType === 'Percentage') {
            const pct = percentageMode === 'Flat' ? flatPercentage : (specificPercentages[emp.id] || 0);
            const factor = 1 + (pct / 100);
            newBasic = Math.round(emp.basicPay * factor);
            newDA = Math.round((emp.da || 0) * factor);
            newHRA = Math.round((emp.hra || 0) * factor);
            newConveyance = Math.round((emp.conveyance || 0) * factor);
            newWashing = Math.round((emp.washing || 0) * factor);
            newAttire = Math.round((emp.attire || 0) * factor);
            newSpecial1 = Math.round((emp.specialAllowance1 || 0) * factor);
            newSpecial2 = Math.round((emp.specialAllowance2 || 0) * factor);
            newSpecial3 = Math.round((emp.specialAllowance3 || 0) * factor);
        } else {
            const inc = adhocIncrements[emp.id] || { basic: 0, da: 0, hra: 0, conveyance: 0, washing: 0, attire: 0, special1: 0, special2: 0, special3: 0 };
            newBasic = emp.basicPay + (inc.basic || 0);
            newDA = (emp.da || 0) + (inc.da || 0);
            newHRA = (emp.hra || 0) + (inc.hra || 0);
            newConveyance = (emp.conveyance || 0) + (inc.conveyance || 0);
            newWashing = (emp.washing || 0) + (inc.washing || 0);
            newAttire = (emp.attire || 0) + (inc.attire || 0);
            newSpecial1 = (emp.specialAllowance1 || 0) + (inc.special1 || 0);
            newSpecial2 = (emp.specialAllowance2 || 0) + (inc.special2 || 0);
            newSpecial3 = (emp.specialAllowance3 || 0) + (inc.special3 || 0);
        }

        const oldGross = emp.basicPay + (emp.da || 0) + (emp.hra || 0) + (emp.conveyance || 0) + (emp.washing || 0) + (emp.attire || 0) + (emp.specialAllowance1 || 0) + (emp.specialAllowance2 || 0) + (emp.specialAllowance3 || 0);
        const newGross = newBasic + newDA + newHRA + newConveyance + newWashing + newAttire + newSpecial1 + newSpecial2 + newSpecial3;

        return {
            newBasic, newDA, newHRA, newConveyance, newWashing, newAttire, newSpecial1, newSpecial2, newSpecial3,
            oldGross, newGross
        };
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

            const {
                newBasic, newDA, newHRA, newConveyance, newWashing, newAttire, newSpecial1, newSpecial2, newSpecial3,
                oldGross, newGross
            } = getProposedSalary(emp);

            const oldBasic = emp.basicPay;
            const oldDA = emp.da || 0;
            const oldHRA = emp.hra || 0;
            const oldConveyance = emp.conveyance || 0;
            const oldWashing = emp.washing || 0;
            const oldAttire = emp.attire || 0;
            const oldSpecial1 = emp.specialAllowance1 || 0;
            const oldSpecial2 = emp.specialAllowance2 || 0;
            const oldSpecial3 = emp.specialAllowance3 || 0;

            const diffBasic = newBasic - oldBasic;
            const diffDA = newDA - oldDA;
            const diffHRA = newHRA - oldHRA;
            const diffConveyance = newConveyance - oldConveyance;
            const diffWashing = newWashing - oldWashing;
            const diffAttire = newAttire - oldAttire;
            const diffSpecial1 = newSpecial1 - oldSpecial1;
            const diffSpecial2 = newSpecial2 - oldSpecial2;
            const diffSpecial3 = newSpecial3 - oldSpecial3;
            const diffGross = newGross - oldGross;

            const monthlyIncr = diffGross;

            if (monthlyIncr > 0 && monthsPassed > 0) {
                arrearRecords.push({
                    id: emp.id,
                    name: emp.name,
                    oldBasic, newBasic, diffBasic,
                    oldDA, newDA, diffDA,
                    oldHRA, newHRA, diffHRA,
                    oldConveyance, newConveyance, diffConveyance,
                    oldWashing, newWashing, diffWashing,
                    oldAttire, newAttire, diffAttire,
                    oldSpecial1, newSpecial1, diffSpecial1,
                    oldSpecial2, newSpecial2, diffSpecial2,
                    oldSpecial3, newSpecial3, diffSpecial3,
                    oldGross, newGross, diffGross,
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
                hra: newHRA,
                conveyance: newConveyance,
                washing: newWashing,
                attire: newAttire,
                specialAllowance1: newSpecial1,
                specialAllowance2: newSpecial2,
                specialAllowance3: newSpecial3
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
                            <select className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-bold outline-none" value={effectiveYear} onChange={e => setEffectiveYear(+e.target.value)}>{Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}</select>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Arrear Period</span>
                        <p className="text-xl font-black text-emerald-400">{calculateMonthsPassed()} <span className="text-xs text-slate-400 font-normal">Months</span></p>
                    </div>
                </div>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 shadow-lg">
                <div className="flex gap-6 border-b border-slate-800 pb-3 mb-4">
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

                    {incrementType === 'Adhoc' && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-left-2 flex-1 max-w-sm">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Search Employee</label>
                            <input
                                type="text"
                                placeholder="Search by ID or Name..."
                                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-purple-500 transition-colors"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
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

                {/* Title for the Grid */}
                <div className="flex justify-between items-end mb-4 px-2">
                    <h3 className="text-lg font-bold text-white">Arrear Revision Grid</h3>
                    <div className="text-right">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Effective Month / Year</span>
                        <span className="text-sm font-black text-amber-400">{effectiveMonth} {effectiveYear}</span>
                    </div>
                </div>

                {/* Using a relative container with sticky bottom scrollbar approach. 
                    We ensure max height is tall enough, but if it overflows, the scrollbar stays on screen 
                    if the container itself overflows the screen, but standard Tailwind horizontal scroll works well here. 
                    To make the horizontal scrollbar "float", we rely on the browser's native handling when the container touches bottom. */}
                <div className="overflow-x-auto overflow-y-auto max-h-[60vh] custom-scrollbar rounded-lg border border-slate-800 shadow-xl">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-[#0f172a] text-slate-400 uppercase font-bold text-[10px] sticky top-0 z-30 shadow-md">
                            <tr>
                                <th className="px-4 py-3 sticky left-0 top-0 bg-[#0f172a] z-40 border-r border-slate-700 w-48 shadow-[4px_0_10px_rgba(0,0,0,0.3)]">Employee</th>

                                {/* BASIC */}
                                <th className="px-4 py-3 text-right bg-slate-900/50">Curr Basic</th>
                                {incrementType === 'Adhoc' ? (
                                    <th className="px-4 py-3 text-center bg-purple-900/40 text-purple-300">Incr (Basic)</th>
                                ) : (
                                    percentageMode === 'Specific' && <th className="px-4 py-3 text-center bg-blue-900/40 text-blue-300">Incr %</th>
                                )}
                                <th className="px-4 py-3 text-right text-emerald-400 border-r border-slate-800">New Basic</th>

                                {/* DA */}
                                <th className="px-4 py-3 text-right bg-slate-900/50">Curr DA</th>
                                {incrementType === 'Adhoc' && <th className="px-4 py-3 text-center bg-purple-900/40 text-purple-300">Incr (DA)</th>}
                                <th className="px-4 py-3 text-right text-emerald-400 border-r border-slate-800">New DA</th>

                                {/* HRA */}
                                <th className="px-4 py-3 text-right bg-slate-900/50">Curr HRA</th>
                                {incrementType === 'Adhoc' && <th className="px-4 py-3 text-center bg-purple-900/40 text-purple-300">Incr (HRA)</th>}
                                <th className="px-4 py-3 text-right text-emerald-400 border-r border-slate-800">New HRA</th>

                                {/* Conveyance */}
                                <th className="px-4 py-3 text-right bg-slate-900/50">Curr Conv</th>
                                {incrementType === 'Adhoc' && <th className="px-4 py-3 text-center bg-purple-900/40 text-purple-300">Incr (Conv)</th>}
                                <th className="px-4 py-3 text-right text-emerald-400 border-r border-slate-800">New Conv</th>

                                {/* Washing */}
                                <th className="px-4 py-3 text-right bg-slate-900/50">Curr Wash</th>
                                {incrementType === 'Adhoc' && <th className="px-4 py-3 text-center bg-purple-900/40 text-purple-300">Incr (Wash)</th>}
                                <th className="px-4 py-3 text-right text-emerald-400 border-r border-slate-800">New Wash</th>

                                {/* Attire */}
                                <th className="px-4 py-3 text-right bg-slate-900/50">Curr Attire</th>
                                {incrementType === 'Adhoc' && <th className="px-4 py-3 text-center bg-purple-900/40 text-purple-300">Incr (Attire)</th>}
                                <th className="px-4 py-3 text-right text-emerald-400 border-r border-slate-800">New Attire</th>

                                {/* Special 1 */}
                                <th className="px-4 py-3 text-right bg-slate-900/50">Curr Spl 1</th>
                                {incrementType === 'Adhoc' && <th className="px-4 py-3 text-center bg-purple-900/40 text-purple-300">Incr (Spl 1)</th>}
                                <th className="px-4 py-3 text-right text-emerald-400 border-r border-slate-800">New Spl 1</th>

                                {/* Special 2 */}
                                <th className="px-4 py-3 text-right bg-slate-900/50">Curr Spl 2</th>
                                {incrementType === 'Adhoc' && <th className="px-4 py-3 text-center bg-purple-900/40 text-purple-300">Incr (Spl 2)</th>}
                                <th className="px-4 py-3 text-right text-emerald-400 border-r border-slate-800">New Spl 2</th>

                                {/* Special 3 */}
                                <th className="px-4 py-3 text-right bg-slate-900/50">Curr Spl 3</th>
                                {incrementType === 'Adhoc' && <th className="px-4 py-3 text-center bg-purple-900/40 text-purple-300">Incr (Spl 3)</th>}
                                <th className="px-4 py-3 text-right text-emerald-400 border-r border-slate-800">New Spl 3</th>

                                {/* GROSS TOTALS */}
                                <th className="px-4 py-3 text-right bg-slate-800 border-l border-slate-600 shadow-[-4px_0_10px_rgba(0,0,0,0.2)]">Curr Gross</th>
                                <th className="px-4 py-3 text-right bg-slate-800 text-emerald-400">New Gross</th>
                                <th className="px-4 py-3 text-right bg-indigo-900/40 text-indigo-300 border-l border-indigo-500/30">Total Arrear</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {activeEmployees.map(emp => {
                                const proposed = getProposedSalary(emp);
                                const adhoc = adhocIncrements[emp.id] || { basic: 0, da: 0, hra: 0, conveyance: 0, washing: 0, attire: 0, special1: 0, special2: 0, special3: 0 };

                                const renderAdhocInput = (field: keyof typeof adhoc) => (
                                    <td className="px-2 py-2 text-center bg-purple-900/10">
                                        <input
                                            type="number"
                                            className="w-16 bg-slate-900 border border-purple-500/50 rounded px-1 py-1 text-right text-white font-bold outline-none focus:ring-1 focus:ring-purple-500 text-xs"
                                            value={adhoc[field]}
                                            onChange={e => setAdhocIncrements({ ...adhocIncrements, [emp.id]: { ...adhoc, [field]: +e.target.value } })}
                                        />
                                    </td>
                                );

                                return (
                                    <tr key={emp.id} className="hover:bg-slate-800/50 group">
                                        <td className="px-4 py-2 sticky left-0 bg-[#1e293b] group-hover:bg-slate-800 z-10 border-r border-slate-700 w-48 shadow-[4px_0_10px_rgba(0,0,0,0.3)] transition-colors">
                                            <div className="font-bold text-white text-xs truncate" title={emp.name}>{emp.name}</div>
                                            <div className="text-[10px] text-slate-500">{emp.id}</div>
                                        </td>

                                        {/* BASIC */}
                                        <td className="px-4 py-2 text-right font-mono text-slate-400 bg-slate-900/20">{emp.basicPay}</td>
                                        {incrementType === 'Adhoc' ? renderAdhocInput('basic') : (
                                            percentageMode === 'Specific' && (
                                                <td className="px-2 py-2 text-center bg-blue-900/10">
                                                    <input
                                                        type="number"
                                                        className="w-14 bg-slate-900 border border-blue-500/50 rounded px-1 py-1 text-center text-white font-bold outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                                                        value={specificPercentages[emp.id] || 0}
                                                        onChange={e => setSpecificPercentages({ ...specificPercentages, [emp.id]: +e.target.value })}
                                                    />
                                                </td>
                                            )
                                        )}
                                        <td className="px-4 py-2 text-right font-mono font-bold text-emerald-400 border-r border-slate-800/50">{proposed.newBasic}</td>

                                        {/* DA */}
                                        <td className="px-4 py-2 text-right font-mono text-slate-400 bg-slate-900/20">{emp.da || 0}</td>
                                        {incrementType === 'Adhoc' && renderAdhocInput('da')}
                                        <td className="px-4 py-2 text-right font-mono font-bold text-emerald-400 border-r border-slate-800/50">{proposed.newDA}</td>

                                        {/* HRA */}
                                        <td className="px-4 py-2 text-right font-mono text-slate-400 bg-slate-900/20">{emp.hra || 0}</td>
                                        {incrementType === 'Adhoc' && renderAdhocInput('hra')}
                                        <td className="px-4 py-2 text-right font-mono font-bold text-emerald-400 border-r border-slate-800/50">{proposed.newHRA}</td>

                                        {/* Conveyance */}
                                        <td className="px-4 py-2 text-right font-mono text-slate-400 bg-slate-900/20">{emp.conveyance || 0}</td>
                                        {incrementType === 'Adhoc' && renderAdhocInput('conveyance')}
                                        <td className="px-4 py-2 text-right font-mono font-bold text-emerald-400 border-r border-slate-800/50">{proposed.newConveyance}</td>

                                        {/* Washing */}
                                        <td className="px-4 py-2 text-right font-mono text-slate-400 bg-slate-900/20">{emp.washing || 0}</td>
                                        {incrementType === 'Adhoc' && renderAdhocInput('washing')}
                                        <td className="px-4 py-2 text-right font-mono font-bold text-emerald-400 border-r border-slate-800/50">{proposed.newWashing}</td>

                                        {/* Attire */}
                                        <td className="px-4 py-2 text-right font-mono text-slate-400 bg-slate-900/20">{emp.attire || 0}</td>
                                        {incrementType === 'Adhoc' && renderAdhocInput('attire')}
                                        <td className="px-4 py-2 text-right font-mono font-bold text-emerald-400 border-r border-slate-800/50">{proposed.newAttire}</td>

                                        {/* Special 1 */}
                                        <td className="px-4 py-2 text-right font-mono text-slate-400 bg-slate-900/20">{emp.specialAllowance1 || 0}</td>
                                        {incrementType === 'Adhoc' && renderAdhocInput('special1')}
                                        <td className="px-4 py-2 text-right font-mono font-bold text-emerald-400 border-r border-slate-800/50">{proposed.newSpecial1}</td>

                                        {/* Special 2 */}
                                        <td className="px-4 py-2 text-right font-mono text-slate-400 bg-slate-900/20">{emp.specialAllowance2 || 0}</td>
                                        {incrementType === 'Adhoc' && renderAdhocInput('special2')}
                                        <td className="px-4 py-2 text-right font-mono font-bold text-emerald-400 border-r border-slate-800/50">{proposed.newSpecial2}</td>

                                        {/* Special 3 */}
                                        <td className="px-4 py-2 text-right font-mono text-slate-400 bg-slate-900/20">{emp.specialAllowance3 || 0}</td>
                                        {incrementType === 'Adhoc' && renderAdhocInput('special3')}
                                        <td className="px-4 py-2 text-right font-mono font-bold text-emerald-400 border-r border-slate-800/50">{proposed.newSpecial3}</td>

                                        {/* GROSS TOTALS */}
                                        <td className="px-4 py-2 text-right font-mono font-bold text-slate-300 bg-slate-800 border-l border-slate-600 shadow-[-4px_0_10px_rgba(0,0,0,0.2)]">{proposed.oldGross}</td>
                                        <td className="px-4 py-2 text-right font-mono font-bold text-emerald-400 bg-slate-800">{proposed.newGross}</td>
                                        <td className="px-4 py-2 text-right font-mono font-black text-indigo-400 bg-indigo-900/20 border-l border-indigo-500/30">
                                            {(proposed.newGross - proposed.oldGross) * calculateMonthsPassed()}
                                        </td>
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
                                This action will <b>permanently update all 9 tracked wage components</b> for all listed active employees in the Master Database.
                                <br /><br />
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
