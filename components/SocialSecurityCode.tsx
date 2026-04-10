import React, { useMemo, useState, useEffect } from 'react';
import { ShieldCheck, Landmark, X, ReceiptText, Info, Calendar, Scale, BookOpen, Lock } from 'lucide-react';
import { PayrollResult, Employee, StatutoryConfig, CompanyProfile } from '../types';
import {
    generateEPFCodeImpactReport,
    generateESICodeWagesReport,
    getStandardFileName,
    openSavedReport
} from '../services/reportService';

const isWin7 = /Windows NT 6.1/.test(window.navigator.userAgent);

interface SocialSecurityCodeProps {
    payrollHistory: PayrollResult[];
    employees: Employee[];
    config: StatutoryConfig;
    companyProfile: CompanyProfile;
    globalMonth: string;
    setGlobalMonth: (m: string) => void;
    globalYear: number;
    setGlobalYear: (y: number) => void;
    showAlert: any;
}

const SocialSecurityCode: React.FC<SocialSecurityCodeProps> = ({
    payrollHistory,
    employees,
    config,
    companyProfile,
    globalMonth,
    setGlobalMonth,
    globalYear,
    setGlobalYear,
    showAlert: _showAlert
}) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);

    const [showLegalModal, setShowLegalModal] = useState(false);
    const [impactModal, setImpactModal] = useState({
        isOpen: false,
        mode: 'Theoretical' as 'Theoretical' | 'Historical',
        prevPeriod: ''
    });

    const isFinalized = useMemo(() => {
        if (!Array.isArray(payrollHistory)) return false;
        const records = payrollHistory.filter(r => r.month === globalMonth && r.year === globalYear);
        return records.length > 0 && records[0].status === 'Finalized';
    }, [payrollHistory, globalMonth, globalYear]);

    const availablePeriods = useMemo(() => {
        if (!Array.isArray(payrollHistory)) return [];
        const pds = new Set<string>();
        payrollHistory.forEach(r => {
            if (r.status === 'Finalized') {
                pds.add(`${r.month} ${r.year}`);
            }
        });
        return Array.from(pds).sort((a, b) => {
            const [m1, y1] = a.split(' ');
            const [m2, y2] = b.split(' ');
            const yearDiff = parseInt(y2 || '0') - parseInt(y1 || '0');
            if (yearDiff !== 0) return yearDiff;
            return months.indexOf(m2) - months.indexOf(m1);
        });
    }, [payrollHistory, months]);

    useEffect(() => {
        if (availablePeriods.length > 0 && !impactModal.prevPeriod) {
            const others = availablePeriods.filter(p => p !== `${globalMonth} ${globalYear}`);
            setImpactModal(prev => ({ ...prev, prevPeriod: others[0] || availablePeriods[0] }));
        }
    }, [availablePeriods, globalMonth, globalYear]);

    const handleDownload = async (reportName: string, format: string) => {
        if (!Array.isArray(payrollHistory) || !Array.isArray(employees)) return;
        const currentData = payrollHistory.filter(r => r.month === globalMonth && r.year === globalYear);
        const fileName = getStandardFileName(reportName, companyProfile, globalMonth, globalYear);
        let savedPath: string | null = null;

        try {
            if (reportName.includes('ESI Code Wages')) {
                savedPath = await generateESICodeWagesReport(currentData, employees, format as any, fileName, companyProfile, globalMonth, globalYear);
            } else if (reportName.includes('EPF Code Impact')) {
                let prevResults: PayrollResult[] | undefined = undefined;
                let prevLabel: string | undefined = undefined;
                
                if (impactModal.mode === 'Historical' && impactModal.prevPeriod) {
                    const [m, y] = impactModal.prevPeriod.split(' ');
                    prevResults = payrollHistory.filter(r => r.month === m && r.year === parseInt(y));
                    prevLabel = impactModal.prevPeriod;
                }

                savedPath = await generateEPFCodeImpactReport(currentData, employees, format as any, fileName, companyProfile, globalMonth, globalYear, prevResults, prevLabel);
            }

            if (savedPath) {
                _showAlert(
                    'success',
                    'Report Generated Successfully',
                    `The ${reportName} has been saved to your reports folder.`,
                    () => openSavedReport(savedPath),
                    undefined,
                    'Open Report & Folder',
                    undefined,
                    undefined,
                    2
                );
            }
        } catch (e: any) {
            _showAlert('error', 'Report Generation Failed', e.message);
        }
    };

    const ReportCard = ({ title, icon: Icon, color, reports, children }: { title: string, icon: any, color: 'blue' | 'pink' | 'amber', reports: { label: string, action: () => void, format?: string, infoAction?: () => void }[], children?: React.ReactNode }) => {
        const theme = {
            blue: { bg: 'bg-blue-900/20', text: 'text-blue-400', border: 'border-blue-900/30', win7bg: 'bg-blue-900/30', win7border: 'border-blue-400/20', hover: 'hover:border-blue-500/50' },
            pink: { bg: 'bg-pink-900/20', text: 'text-pink-400', border: 'border-pink-900/30', win7bg: 'bg-pink-900/30', win7border: 'border-pink-400/20', hover: 'hover:border-pink-500/50' },
            amber: { bg: 'bg-amber-900/20', text: 'text-amber-400', border: 'border-amber-900/30', win7bg: 'bg-amber-900/30', win7border: 'border-amber-400/20', hover: 'hover:border-amber-500/50' }
        }[color] || { bg: 'bg-slate-900/20', text: 'text-slate-400', border: 'border-slate-900/30', win7bg: 'bg-slate-900/30', win7border: 'border-slate-400/20', hover: 'hover:border-slate-500/50' };

        return (
            <div className={`bg-[#1e293b] rounded-xl border border-slate-800 shadow-lg overflow-hidden group transition-all h-full ${isWin7 ? `${theme.hover} hover:shadow-[0_0_30px_rgba(0,0,0,0.3)]` : 'hover:border-slate-700'}`}>
                <div className={`p-4 flex items-center justify-between border-b border-slate-800 ${isWin7 ? `bg-gradient-to-r from-[#0f172a] to-[#1e293b]` : 'bg-[#0f172a]'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`rounded-xl border shadow-[inset_0_0_10px_rgba(0,0,0,0.2)] ${isWin7 ? `p-2.5 ${theme.win7bg} ${theme.text} ${theme.win7border}` : `p-2 ${theme.bg} ${theme.text} ${theme.border}`}`}>
                            <Icon size={20} className={`${isWin7 ? `drop-shadow-[0_0_8px_currentColor]` : ''}`} />
                        </div>
                        <h3 className={`uppercase ${isWin7 ? `font-black ${theme.text} text-xs tracking-[0.15em]` : `font-bold ${theme.text} text-sm tracking-widest`}`}>{title}</h3>
                    </div>
                </div>
            <div className="p-4 space-y-4">
                {children}
                <div className="grid grid-cols-1 gap-2 pt-2">
                    {reports.map((r, i) => (
                        <div key={i} className="flex gap-2">
                            <button onClick={r.action} className="flex-1 flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all group/btn text-left">
                                <span className="text-xs font-bold text-slate-300 group-hover/btn:text-white">{r.label}</span>
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{r.format || 'PDF'}</span>
                            </button>
                            {r.infoAction && (
                                <button onClick={(e) => { e.stopPropagation(); r.infoAction?.(); }} className="px-3 rounded-lg bg-indigo-900/20 text-indigo-400 hover:bg-indigo-900/40 border border-indigo-900/30 transition-all border-dashed" title="Legal Definition">
                                    <Info size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    ); };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 relative pb-20">
            {/* Page Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-[#1e293b] to-[#0f172a] p-8 rounded-3xl border border-blue-500/20 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full -mr-20 -mt-20"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-500 rounded-lg"><Scale className="text-white" size={24} /></div>
                        <h2 className="text-3xl font-black text-white tracking-tight uppercase">Social Security & Code Wages Analysis</h2>
                    </div>
                    <p className="text-slate-400 text-sm font-medium">Policy impact simulations and Clause 88 threshold compliance monitoring.</p>
                </div>
                <div className="flex items-center gap-4 relative z-10 hidden md:flex">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Active Analysis Period</span>
                        <div className="flex items-center gap-2">
                            <select aria-label="Select global month" title="Global Month" value={globalMonth} onChange={e => setGlobalMonth(e.target.value)} className="bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500">
                                {months.map(m => (<option key={m} value={m}>{m}</option>))}
                            </select>
                            <select aria-label="Select global year" title="Global Year" value={globalYear} onChange={e => setGlobalYear(+e.target.value)} className="bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500">
                                {yearOptions.map(y => (<option key={y} value={y}>{y}</option>))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Clause 88 Context - Always Visible */}
            <div className="bg-indigo-900/10 border border-indigo-500/20 p-6 rounded-2xl flex items-start gap-5">
                <div className="p-3 bg-indigo-500/20 rounded-xl"><Info className="text-indigo-400" size={24} /></div>
                <div className="space-y-1">
                    <h4 className="text-sm font-black text-indigo-300 uppercase tracking-widest">Wages Definition & The 50% Threshold</h4>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-4xl">
                        Under Section 2(88) of the SS Code 2020, "Wages" includes basic pay, DA, and retaining allowance. 
                        However, if the aggregate of specified exclusions (like HRA, Bonus, etc.) exceeds 50% of the total remuneration, the excess amount is deemed as wages for PF/ESI contributions.
                    </p>
                    <button onClick={() => setShowLegalModal(true)} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-tighter mt-2 underline underline-offset-4 decoration-dotted">View Comprehensive Legal Definition</button>
                </div>
            </div>

            {!isFinalized ? (
                <div className="flex flex-col items-center justify-center p-20 bg-[#0f172a]/50 rounded-3xl border-2 border-dashed border-slate-800 text-center space-y-6">
                    <div className="p-6 bg-slate-900 rounded-full text-slate-600 shadow-inner"><Lock size={64} /></div>
                    <div className="max-w-md">
                        <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-wide">Analysis Locked</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">Please ensure payroll for {globalMonth} {globalYear} is processed and frozen to run impact simulations.</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Module Cards */}

                    {/* EPF Module */}
                    <ReportCard
                        title="EPF Impact Analysis (Proposed Code)"
                        icon={Landmark}
                        color="blue"
                        reports={[
                            { label: 'Run Impact Analysis Report', action: () => setImpactModal({ ...impactModal, isOpen: true }), format: 'PDF', infoAction: () => setShowLegalModal(true) }
                        ]}
                    >
                         <p className="text-[11px] text-slate-400 leading-relaxed italic">
                            Simulates the financial impact of the 15,000 ceiling enforcement and the "50% of Gross" rule for PF Wages. 
                            Compare against your theoretical current basis or last month&apos;s actuals.
                        </p>
                    </ReportCard>

                    {/* ESI Module */}
                    <ReportCard
                        title="ESI Coverage Analysis (Proposed Code)"
                        icon={ShieldCheck}
                        color="pink"
                        reports={[
                            { label: 'Generate ESI Code Wage Analysis', action: () => handleDownload('ESI Code Wages', 'PDF'), format: 'PDF' }
                        ]}
                    >
                        <p className="text-[11px] text-slate-400 leading-relaxed italic">
                            Identifies employees whose ESI coverage status might change due to the new wage definition. 
                            Calculates projected employer and employee liabilities.
                        </p>
                    </ReportCard>
                </div>
            )}

            {/* Modals migrate directly from StatutoryReports */}
            {impactModal.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#1e293b] w-full max-w-lg rounded-3xl border border-blue-500/30 shadow-[0_0_40px_rgba(37,99,235,0.2)] overflow-hidden flex flex-col animate-in zoom-in-95">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/10 rounded-2xl"><Landmark className="text-white" size={24} /></div>
                                <div>
                                    <h3 className="text-lg font-black text-white tracking-tight uppercase">EPF Code Impact</h3>
                                    <p className="text-blue-100 text-[10px] font-bold opacity-80 uppercase tracking-widest">Select Comparison Basis</p>
                                </div>
                            </div>
                            <button onClick={() => setImpactModal({ ...impactModal, isOpen: false })} className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-all" title="Close"><X size={20} /></button>
                        </div>
                        <div className="p-8 space-y-8">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] pl-1">Choose Analysis Mode</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button onClick={() => setImpactModal({ ...impactModal, mode: 'Theoretical' })} className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 text-center ${impactModal.mode === 'Theoretical' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}>
                                        <div className={`p-3 rounded-xl ${impactModal.mode === 'Theoretical' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'}`}><ReceiptText size={20} /></div>
                                        <div>
                                            <div className={`font-black text-sm ${impactModal.mode === 'Theoretical' ? 'text-white' : 'text-slate-400'}`}>Theoretical</div>
                                            <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase leading-tight italic">What it should be now</div>
                                        </div>
                                    </button>
                                    <button onClick={() => setImpactModal({ ...impactModal, mode: 'Historical' })} className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 text-center ${impactModal.mode === 'Historical' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}>
                                        <div className={`p-3 rounded-xl ${impactModal.mode === 'Historical' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'}`}><Calendar size={20} /></div>
                                        <div>
                                            <div className={`font-black text-sm ${impactModal.mode === 'Historical' ? 'text-white' : 'text-slate-400'}`}>Historical</div>
                                            <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase leading-tight italic">What was actually paid</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                            {impactModal.mode === 'Historical' && (
                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] pl-1">Comparison Period</label>
                                    <select aria-label="Select comparison period" title="Comparison Period" value={impactModal.prevPeriod} onChange={(e) => setImpactModal({ ...impactModal, prevPeriod: e.target.value })} className="w-full bg-[#0f172a] border border-slate-700 rounded-2xl px-6 py-4 text-base font-bold text-white focus:ring-4 focus:ring-blue-500/20 outline-none cursor-pointer">
                                        {availablePeriods.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-[#0f172a] border-t border-slate-800 flex gap-3">
                            <button onClick={() => setImpactModal({ ...impactModal, isOpen: false })} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-xl transition-all uppercase tracking-widest text-xs">Cancel</button>
                            <button onClick={() => { setImpactModal({ ...impactModal, isOpen: false }); handleDownload('EPF Code Impact', 'PDF'); }} className="flex-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all shadow-lg shadow-blue-900/40 uppercase tracking-widest text-xs">Run Analysis</button>
                        </div>
                    </div>
                </div>
            )}

            {showLegalModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-500">
                    <div className="bg-[#111827] w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-[2rem] border border-white/5 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] flex flex-col relative animate-in zoom-in-95 duration-500">
                        {/* Header Gradient */}
                        <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 p-8 flex items-center justify-between border-b border-white/10">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-white/15 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner group-hover:scale-110 transition-transform">
                                    <BookOpen className="text-white" size={32} />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-white tracking-tight uppercase italic leading-none">Legal Definition: "Wages"</h3>
                                    <p className="text-blue-100 text-xs font-bold opacity-70 uppercase tracking-[0.3em]">Social Security Code, 2020</p>
                                </div>
                            </div>
                            <button onClick={() => setShowLegalModal(false)} className="p-3 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all transform hover:rotate-90" title="Close"><X size={28} /></button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-10 overflow-y-auto space-y-8 custom-scrollbar bg-gradient-to-b from-transparent to-[#1a1c2e]/30">
                            {/* Blue Note Banner */}
                            <div className="p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-start gap-4">
                                <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                                <p className="text-[13px] text-indigo-200 font-medium italic leading-relaxed">
                                    Note: This definition governs the calculation for the 50% threshold limit under the Code on Social Security, 2020.
                                </p>
                            </div>

                            {/* Verbatim Definition */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-4 italic">Social Security Code Sec 2 (88)</h4>
                                <p className="text-[15px] text-slate-100 font-medium leading-relaxed">
                                    <span className="text-blue-400 font-black italic">"wages"</span> means all remuneration, whether by way of salaries, allowances or otherwise, expressed in terms of money or capable of being so expressed which would, if the terms of employment, express or implied, were fulfilled, be payable to a person employed in respect of his employment or of work done in such employment, and <span className="text-indigo-400 font-black">includes—</span>
                                </p>
                            </div>

                            {/* Inclusions Block */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {[
                                    { id: '(a)', val: 'basic pay' },
                                    { id: '(b)', val: 'dearness allowance' },
                                    { id: '(c)', val: 'retaining allowance' }
                                ].map(item => (
                                    <div key={item.id} className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl flex items-center gap-3 group hover:bg-indigo-900/20 hover:border-indigo-500/30 transition-all">
                                        <span className="text-indigo-400 font-black text-xs italic">{item.id}</span>
                                        <span className="text-slate-200 font-bold text-sm tracking-tight">{item.val}</span>
                                    </div>
                                ))}
                            </div>

                            {/* 50% Rule Highlight */}
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-3xl opacity-20 blur group-hover:opacity-30 transition duration-500" />
                                <div className="relative p-7 bg-slate-900/80 border border-white/10 rounded-2xl space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-600 rounded-lg text-white"><ShieldCheck size={18} /></div>
                                        <h4 className="text-xs font-black text-white uppercase tracking-widest italic font-outline-sm">The 50% Threshold Rule (Proviso)</h4>
                                    </div>
                                    <p className="text-blue-100 text-[14px] font-medium leading-[1.6] italic">
                                        "Provided that... if the aggregate of specified exclusions exceeds <span className="text-indigo-400 font-black underline underline-offset-4 decoration-blue-500">one-half (50%)</span> of the total remuneration, the excess amount shall be <span className="text-indigo-400 font-bold">deemed as remuneration</span> and shall be accordingly added in wages."
                                    </p>
                                </div>
                            </div>

                            {/* Exclusions Grid */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 opacity-60">
                                    <div className="h-[1px] flex-1 bg-slate-700" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Exclusions Checklist</span>
                                    <div className="h-[1px] flex-1 bg-slate-700" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 p-6 bg-slate-900/40 rounded-3xl border border-slate-800/50">
                                    {[
                                        'Statutory Bonus', 'House Rent Allowance (HRA)', 'Employer PF/ESI Contribution',
                                        'Conveyance Allowance', 'Overtime Allowance', 'Gratuity on Termination',
                                        'Retrenchment Compensation', 'Special Expenses Defrayed'
                                    ].map(ex => (
                                        <div key={ex} className="flex items-center gap-3 group">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-indigo-500 transition-colors" />
                                            <span className="text-[12px] font-medium text-slate-400 group-hover:text-slate-200 transition-colors">{ex}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer Action */}
                        <div className="p-8 bg-[#0b0f1a] border-t border-white/5 flex justify-end">
                            <button 
                                onClick={() => setShowLegalModal(false)} 
                                className="group relative px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-[0_8px_20px_-4px_rgba(79,70,229,0.5)] active:scale-95 overflow-hidden"
                            >
                                <span className="relative z-10 flex items-center gap-2 uppercase tracking-widest text-sm">
                                    Understood <Landmark size={18} className="opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default SocialSecurityCode;
