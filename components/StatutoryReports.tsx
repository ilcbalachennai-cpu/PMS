import React, { useMemo, useState } from 'react';
import { ShieldCheck, Landmark, X, FileText, AlertTriangle, CheckCircle, Table, Download, BookOpen, ScrollText, HandCoins, ReceiptText } from 'lucide-react';
import { PayrollResult, Employee, StatutoryConfig, CompanyProfile, Attendance, LeaveLedger, AdvanceLedger, ArrearBatch } from '../types';
import { INDIAN_STATES } from '../constants';
import {
    generatePFECR,
    generateArrearECRText,
    generateArrearECRExcel,
    generatePFForm12A,
    generateESIReturn,
    generateESIForm5,
    generateESIExitReport,
    generatePTReport,
    generateTDSReport,
    generateGratuityReport,
    generateBonusReport,
    generateFormB,
    generateFormC,
    generateStateWageRegister,
    generateStatePaySlip,
    generateStateAdvanceRegister,
    getStandardFileName,
    openSavedReport,
    generatePFForm3A,
    generatePFForm6A
} from '../services/reportService';

const isWin7 = /Windows NT 6.1/.test(window.navigator.userAgent);

interface StatutoryReportsProps {
    payrollHistory: PayrollResult[];
    employees: Employee[];
    config: StatutoryConfig;
    companyProfile: CompanyProfile;
    globalMonth: string;
    setGlobalMonth: (m: string) => void;
    globalYear: number;
    setGlobalYear: (y: number) => void;
    attendances?: Attendance[];
    leaveLedgers?: LeaveLedger[];
    advanceLedgers?: AdvanceLedger[];
    arrearHistory?: ArrearBatch[];
    latestFrozenPeriod: { month: string; year: number } | null;
    showAlert: any;
}

const STATE_FORM_MAPPINGS: Record<string, { wage: string; slip: string; advance: string }> = {
    'Tamil Nadu': { wage: 'Form R (Wage Register)', slip: 'Form T (Wage Slip)', advance: 'Form P (Advances)' },
    'Karnataka': { wage: 'Form T (Wage Register)', slip: 'Form V (Wage Slip)', advance: 'Form XXII (Advances)' },
    'Maharashtra': { wage: 'Form II (Wage Register)', slip: 'Form III (Wage Slip)', advance: 'Form IV (Advances)' },
    'Andhra Pradesh': { wage: 'Form XXIII (Wage Register)', slip: 'Form XXIV (Wage Slip)', advance: 'Form XXII (Advances)' },
    'Telangana': { wage: 'Form XXIII (Wage Register)', slip: 'Form XXIV (Wage Slip)', advance: 'Form XXII (Advances)' },
    'West Bengal': { wage: 'Form J (Register of Wages)', slip: 'Form H (Pay Slip)', advance: 'Form M (Advances)' },
    'Default': { wage: 'Wage Register', slip: 'Pay Slip', advance: 'Advance Register' }
};

const StatutoryReports: React.FC<StatutoryReportsProps> = ({
    payrollHistory,
    employees,
    config,
    companyProfile,
    globalMonth,
    setGlobalMonth,
    globalYear,
    setGlobalYear,
    attendances = [],
    leaveLedgers = [],
    advanceLedgers = [],
    arrearHistory = [],
    latestFrozenPeriod,
    showAlert: _showAlert
}) => {
    const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);

    const [selectedState, setSelectedState] = useState<string>(companyProfile.state || 'Tamil Nadu');
    const [rangeModal, setRangeModal] = useState({ isOpen: false, reportType: '', fromMonth: globalMonth, fromYear: globalYear, toMonth: globalMonth, toYear: globalYear });
    const [msgModal, setMsgModal] = useState({ isOpen: false, title: '', message: '', type: 'error' as 'error' | 'success', onConfirm: null as any });

    const currentForms = useMemo(() => STATE_FORM_MAPPINGS[selectedState] || STATE_FORM_MAPPINGS['Default'], [selectedState]);

    const openRangeModal = (reportType: string) => {
        const isJanToMar = ['January', 'February', 'March'].includes(globalMonth);
        const startYear = isJanToMar ? globalYear - 1 : globalYear;
        setRangeModal({ isOpen: true, reportType, fromMonth: 'April', fromYear: startYear, toMonth: globalMonth, toYear: globalYear });
    };

    const handleDownload = async (reportName: string, format: 'PDF' | 'Excel' | 'Text') => {
        const currentData = payrollHistory.filter(r => r.month === globalMonth && r.year === globalYear);
        if (currentData.length === 0) {
            setMsgModal({ isOpen: true, title: 'No Data Found', message: `No final records found for ${globalMonth} ${globalYear}. Please finalize payroll first.`, type: 'error', onConfirm: null });
            return;
        }
        const fileName = getStandardFileName(reportName, companyProfile, globalMonth, globalYear);
        let savedPath: string | null = null;

        try {
            if (reportName.includes('PF ECR')) {
                savedPath = await generatePFECR(currentData, employees, config, format as 'Excel' | 'Text', fileName);
            } else if (reportName === 'PF ECR Arrears') {
                const batch = arrearHistory?.find(b => b.month === globalMonth && b.year === globalYear);
                if (!batch) throw new Error(`No arrears processed for ${globalMonth} ${globalYear}`);
                savedPath = format === 'Excel' ? await generateArrearECRExcel(batch, payrollHistory, employees, config, fileName) : await generateArrearECRText(batch, payrollHistory, employees, config, fileName);
            } else if (reportName.includes('ESI Monthly')) {
                savedPath = await generateESIReturn(currentData, employees, 'Excel', fileName, companyProfile);
            } else if (reportName.includes('Form 12A')) {
                savedPath = await generatePFForm12A(currentData, employees, config, companyProfile, globalMonth, globalYear);
            } else if (reportName.includes('Gratuity')) {
                savedPath = await generateGratuityReport(employees, companyProfile);
            } else if (reportName.includes('Bonus')) {
                savedPath = await generateBonusReport(payrollHistory, employees, config, globalMonth, globalYear, globalMonth, globalYear, companyProfile, format as 'PDF' | 'Excel');
            } else if (reportName.includes('PT Report')) {
                savedPath = await generatePTReport(currentData, employees, fileName, companyProfile);
            } else if (reportName.includes('TDS Report')) {
                savedPath = await generateTDSReport(currentData, employees, fileName, companyProfile);
            } else if (reportName.includes('ESI Exit')) {
                savedPath = await generateESIExitReport(currentData, employees, globalMonth, globalYear, companyProfile);
            } else if (reportName.includes('Form B')) {
                savedPath = await generateFormB(currentData, employees, globalMonth, globalYear, companyProfile);
            } else if (reportName.includes('Form C')) {
                savedPath = await generateFormC(currentData, employees, attendances, globalMonth, globalYear, companyProfile);
            } else if (reportName === 'Wage Register') {
                savedPath = await generateStateWageRegister(currentData, employees, globalMonth, globalYear, companyProfile, selectedState, currentForms.wage);
            } else if (reportName === 'Wage Slip') {
                savedPath = await generateStatePaySlip(currentData, employees, globalMonth, globalYear, companyProfile, selectedState, currentForms.slip);
            } else if (reportName === 'Advance Register') {
                savedPath = await generateStateAdvanceRegister(currentData, employees, advanceLedgers, globalMonth, globalYear, companyProfile, selectedState, currentForms.advance);
            }

            if (savedPath) _showAlert('success', 'Report Generated', `Saved as ${fileName}`, () => openSavedReport(savedPath), undefined, 'Open Report', undefined, undefined, 2);
        } catch (e: any) { setMsgModal({ isOpen: true, title: 'Error', message: e.message, type: 'error', onConfirm: null }); }
    };

    const handleGenerateRange = async () => {
        setRangeModal(p => ({ ...p, isOpen: false }));
        let savedPath: string | null = null;
        try {
            if (rangeModal.reportType === 'Form 5') {
                const season = rangeModal.fromMonth === 'April' ? 'Apr-Sep' : 'Oct-Mar';
                savedPath = await generateESIForm5(payrollHistory, employees, season as any, rangeModal.fromYear, companyProfile);
            } else if (rangeModal.reportType === 'Form 3A') {
                savedPath = await generatePFForm3A(payrollHistory, employees, config, rangeModal.fromMonth, rangeModal.fromYear, rangeModal.toMonth, rangeModal.toYear, undefined, companyProfile);
            } else if (rangeModal.reportType === 'Form 6A') {
                savedPath = await generatePFForm6A(payrollHistory, employees, config, rangeModal.fromMonth, rangeModal.fromYear, rangeModal.toMonth, rangeModal.toYear, companyProfile);
            }
            if (savedPath) _showAlert('success', 'Range Report Generated', 'Saved to your reports folder.', () => openSavedReport(savedPath));
        } catch (err: any) { setMsgModal({ isOpen: true, title: 'Error', message: err.message, type: 'error', onConfirm: null }); }
    };

    const ReportCard = ({ title, icon: Icon, color, reports, headerAction }: { title: string, icon: any, color: string, reports: { label: string, action: () => void, format?: string, textColor?: string }[], headerAction?: React.ReactNode }) => (
        <div className={`bg-[#1e293b] rounded-xl border border-slate-800 shadow-lg overflow-hidden group transition-all h-full ${isWin7 ? `hover:border-${color}-500/50` : 'hover:border-slate-700'}`}>
            <div className={`p-4 flex items-center justify-between border-b border-slate-800 ${isWin7 ? `bg-gradient-to-r from-[#0f172a] to-[#1e293b]` : 'bg-[#0f172a]'}`}>
                <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${isWin7 ? `bg-${color}-900/30 text-${color}-400 border border-${color}-400/20` : `bg-${color}-900/20 text-${color}-400`}`}><Icon size={18} /></div>
                    <h3 className={`uppercase font-bold text-xs tracking-widest text-${color}-400`}>{title}</h3>
                </div>
                {headerAction}
            </div>
            <div className="p-3 grid grid-cols-1 gap-2">
                {reports.map((r, i) => (
                    <button key={i} onClick={r.action} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/40 hover:bg-slate-800 border border-slate-800/50 transition-all text-left group/btn">
                        <span className={`text-[11px] font-bold ${r.textColor || 'text-slate-300'} group-hover/btn:text-white`}>{r.label}</span>
                        <span className="text-[9px] font-black text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{r.format || 'PDF'}</span>
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 pb-20">
            {/* Header / Filter Section */}
            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase italic tracking-tighter">
                        <ShieldCheck className="text-blue-400" size={28} /> Statutory Compliance
                    </h2>
                    <p className="text-slate-400 text-xs mt-1 font-medium">Official PF, ESI, and Labour Law Returns.</p>
                </div>
                <div className="flex items-center gap-3">
                    <select title="Select Month" value={globalMonth} onChange={e => setGlobalMonth(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500">
                        {monthsArr.map(m => (<option key={m} value={m}>{m}</option>))}
                    </select>
                    <select title="Select Year" value={globalYear} onChange={e => setGlobalYear(+e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500">
                        {yearOptions.map(y => (<option key={y} value={y}>{y}</option>))}
                    </select>
                </div>
            </div>

            {/* Main Compliance Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ReportCard title="EPF & MP Act, 1952" icon={Landmark} color="blue" reports={[
                    { label: 'PF ECR (Electronic Challan Return)', action: () => handleDownload('PF ECR', 'Text'), format: 'TXT' },
                    { label: 'PF ECR (Excel Backup)', action: () => handleDownload('PF ECR', 'Excel'), format: 'XLSX' },
                    { label: 'PF ECR Arrear (Text Format)', action: () => handleDownload('PF ECR Arrears', 'Text'), format: 'TXT', textColor: 'text-amber-400' },
                    { label: 'PF ECR Arear ( Excel Backup)', action: () => handleDownload('PF ECR Arrears', 'Excel'), format: 'XLSX', textColor: 'text-amber-400' },
                    { label: 'Form 12A', action: () => handleDownload('Form 12A', 'PDF') },
                    { label: 'Form 3A', action: () => openRangeModal('Form 3A'), format: 'PDF' },
                    { label: 'Form 6A', action: () => openRangeModal('Form 6A'), format: 'PDF' }
                ]} />

                <ReportCard title="ESI Act, 1948" icon={ShieldCheck} color="pink" reports={[
                    { label: 'ESI Monthly Return', action: () => handleDownload('ESI Monthly', 'Excel'), format: 'XLSX' },
                    { label: 'Form 5 (Contribution)', action: () => openRangeModal('Form 5'), format: 'PDF' },
                    { label: 'ESI Exit/OoC IP', action: () => handleDownload('ESI Exit', 'Excel'), format: 'XLSX' }
                ]} />

                <ReportCard title="Taxes & Benefits" icon={FileText} color="amber" reports={[
                    { label: 'Professional Tax Report', action: () => handleDownload('PT Report', 'Excel'), format: 'XLSX' },
                    { label: 'TDS (Income Tax) Report', action: () => handleDownload('TDS Report', 'Excel'), format: 'XLSX' },
                    { label: 'Gratuity Valuation', action: () => handleDownload('Gratuity', 'PDF') },
                    { label: 'Bonus Statement', action: () => handleDownload('Bonus', 'PDF') }
                ]} />
            </div>

            {/* Registers Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ReportCard title="Central Labour Registers" icon={BookOpen} color="emerald" reports={[
                    { label: 'Register of Wages (Form B)', action: () => handleDownload('Form B', 'PDF') },
                    { label: 'Muster Roll (Form C)', action: () => handleDownload('Form C', 'PDF') }
                ]} />

                <ReportCard
                    title="State Labour Registers"
                    icon={ScrollText}
                    color="teal"
                    headerAction={
                        <select
                            title="Filter by State"
                            value={selectedState}
                            onChange={e => setSelectedState(e.target.value)}
                            className="bg-slate-900 border border-teal-500/30 text-teal-400 text-[10px] font-bold rounded px-1.5 py-0.5 outline-none"
                        >
                            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    }
                    reports={[
                        { label: currentForms.wage, action: () => handleDownload('Wage Register', 'PDF') },
                        { label: currentForms.slip, action: () => handleDownload('Wage Slip', 'PDF') },
                        { label: currentForms.advance, action: () => handleDownload('Advance Register', 'PDF') }
                    ]}
                />
            </div>

            {rangeModal.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 p-8 shadow-2xl relative">
                        <button title="Close" onClick={() => setRangeModal(p => ({ ...p, isOpen: false }))} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <ReceiptText className="text-blue-500" size={24} /> Range: {rangeModal.reportType}
                        </h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <select title="From Month" value={rangeModal.fromMonth} onChange={e => setRangeModal(p => ({ ...p, fromMonth: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white">
                                    {monthsArr.map(m => (<option key={m} value={m}>{m}</option>))}
                                </select>
                                <select title="From Year" value={rangeModal.fromYear} onChange={e => setRangeModal(p => ({ ...p, fromYear: +e.target.value }))} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white">
                                    {yearOptions.map(y => (<option key={y} value={y}>{y}</option>))}
                                </select>
                            </div>
                            <div className="text-center text-[10px] font-black text-slate-600 uppercase tracking-widest">To</div>
                            <div className="grid grid-cols-2 gap-3">
                                <select title="To Month" value={rangeModal.toMonth} onChange={e => setRangeModal(p => ({ ...p, toMonth: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white">
                                    {monthsArr.map(m => (<option key={m} value={m}>{m}</option>))}
                                </select>
                                <select title="To Year" value={rangeModal.toYear} onChange={e => setGlobalYear(+e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white">
                                    {yearOptions.map(y => (<option key={y} value={y}>{y}</option>))}
                                </select>
                            </div>
                        </div>
                        <button onClick={handleGenerateRange} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl mt-6">Generate</button>
                    </div>
                </div>
            )}

            {msgModal.isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">
                    <div className="bg-[#1e293b] max-w-sm w-full rounded-2xl border border-slate-700 p-8 text-center space-y-4 shadow-2xl">
                        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${msgModal.type === 'error' ? 'bg-red-950 text-red-500' : 'bg-emerald-950 text-emerald-500'}`}>
                            {msgModal.type === 'error' ? <AlertTriangle size={32} /> : <CheckCircle size={32} />}
                        </div>
                        <h3 className="text-lg font-bold text-white uppercase">{msgModal.title}</h3>
                        <p className="text-slate-400 text-sm">{msgModal.message}</p>
                        <button onClick={() => setMsgModal(p => ({ ...p, isOpen: false }))} className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all">Dismiss</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatutoryReports;
