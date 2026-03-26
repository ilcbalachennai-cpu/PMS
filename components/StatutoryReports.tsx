import React, { useMemo, useState } from 'react';
import { ShieldCheck, Download, ScrollText, Landmark, Lock, BookOpen, Info, X } from 'lucide-react';
import { PayrollResult, Employee, StatutoryConfig, CompanyProfile, AlertType } from '../types';
import { INDIAN_STATES } from '../constants';
import {
    generatePFECR,
    generateESIReturn,
    generatePTReport,
    generateTDSReport,
    generatePFForm12A,
    generateFormB,
    generateFormC,
    generateStateWageRegister,
    generateStatePaySlip,
    generateStateAdvanceRegister,
    generatePFForm3A,
    generatePFForm6A,
    generateESIExitReport,
    generateESICodeWagesReport,
    generateGratuityReport,
    generateBonusReport,
    generateESIForm5,
    generateArrearECRText,
    generateArrearECRExcel,
    generateForm16PartBPDF,
    getStandardFileName
} from '../services/reportService';
import DynamicReportBuilder from './DynamicReportBuilder';
import { usePayrollData } from '../hooks/usePayrollData';
import { usePayrollPeriod } from '../hooks/usePayrollPeriod';

interface StatutoryReportsProps {
    results: PayrollResult[];
    employees: Employee[];
    companyProfile: CompanyProfile;
    statutoryConfig: StatutoryConfig;
    showAlert: (type: AlertType, title: string, message: React.ReactNode, onConfirm?: () => void, onCancel?: () => void) => string;
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
    results: payrollHistory,
    employees,
    companyProfile,
    statutoryConfig: config,
    showAlert
}) => {
    const { 
        attendances,
        advanceLedgers,
        arrearHistory
    } = usePayrollData(showAlert);
    
    const { activePeriod } = usePayrollPeriod();
    const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const [selectedMonth, setSelectedMonth] = useState<string>(activePeriod.month);
    const [selectedYear, setSelectedYear] = useState<number>(activePeriod.year);

    const isFinalized = useMemo(() => {
        const records = payrollHistory.filter(r => r.month === selectedMonth && r.year === selectedYear);
        return records.length > 0 && records[0].status === 'Finalized';
    }, [payrollHistory, selectedMonth, selectedYear]);

    const isLocked = useMemo(() => isFinalized || (selectedYear < activePeriod.year) || (selectedYear === activePeriod.year && monthsArr.indexOf(selectedMonth) < monthsArr.indexOf(activePeriod.month)), [isFinalized, selectedYear, selectedMonth, activePeriod]);

    const [selectedState, setSelectedState] = useState<string>('Tamil Nadu');
    const [reportView, setReportView] = useState<'Standard' | 'Dynamic'>('Standard');

    const currentForms = useMemo(() => STATE_FORM_MAPPINGS[selectedState] || STATE_FORM_MAPPINGS['Default'], [selectedState]);

    const finalizedPeriods = useMemo(() => {
        const unique = new Set<string>();
        return payrollHistory
            .filter(r => r.status === 'Finalized')
            .filter(r => {
                const key = `${r.month}-${r.year}`;
                if (unique.has(key)) return false;
                unique.add(key);
                return true;
            })
            .map(r => ({ month: r.month, year: r.year }));
    }, [payrollHistory]);

    const [rangeModal, setRangeModal] = useState({
        isOpen: false,
        reportType: '',
        startMonth: 'April',
        startYear: selectedYear,
        endMonth: 'March',
        endYear: selectedYear + 1,
        selectedEmployee: 'ALL',
        format: 'PDF' as 'PDF' | 'Excel',
        halfYearPeriod: 'Apr-Sep' as 'Apr-Sep' | 'Oct-Mar',
        periodYear: selectedYear
    });

    const openRangeModal = (reportType: string) => {
        const fyStartYear = ['January', 'February', 'March'].includes(selectedMonth) ? selectedYear - 1 : selectedYear;
        setRangeModal({
            isOpen: true,
            reportType,
            startMonth: 'April',
            startYear: fyStartYear,
            endMonth: 'March',
            endYear: fyStartYear + 1,
            selectedEmployee: 'ALL',
            format: 'PDF',
            halfYearPeriod: (monthsArr.indexOf(selectedMonth) >= 9 || monthsArr.indexOf(selectedMonth) <= 2) ? 'Oct-Mar' : 'Apr-Sep',
            periodYear: fyStartYear
        });
    };

    const handleGenerateRange = async () => {
        setRangeModal({ ...rangeModal, isOpen: false });
        try {
            let savedPath: string | null = null;
            if (rangeModal.reportType === 'Form 3A') {
                savedPath = await generatePFForm3A(payrollHistory, employees, config, rangeModal.startMonth, rangeModal.startYear, rangeModal.endMonth, rangeModal.endYear, rangeModal.selectedEmployee === 'ALL' ? undefined : rangeModal.selectedEmployee, companyProfile);
            } else if (rangeModal.reportType === 'Form 6A') {
                savedPath = await generatePFForm6A(payrollHistory, employees, config, rangeModal.startMonth, rangeModal.startYear, rangeModal.endMonth, rangeModal.endYear, companyProfile);
            } else if (rangeModal.reportType === 'Bonus Statement') {
                savedPath = await generateBonusReport(payrollHistory, employees, config, rangeModal.startMonth, rangeModal.startYear, rangeModal.endMonth, rangeModal.endYear, companyProfile, rangeModal.format);
            } else if (rangeModal.reportType === 'Form 16 (Part B)') {
                savedPath = await generateForm16PartBPDF(payrollHistory, employees, config, rangeModal.startMonth, rangeModal.startYear, rangeModal.endMonth, rangeModal.endYear, rangeModal.selectedEmployee === 'ALL' ? undefined : rangeModal.selectedEmployee, companyProfile);
            } else if (rangeModal.reportType === 'Form 5') {
                savedPath = await generateESIForm5(payrollHistory, employees, rangeModal.halfYearPeriod, rangeModal.periodYear, companyProfile);
            }

            if (savedPath) showAlert('success', 'Report Generated', `Successfully generated ${rangeModal.reportType}!`);
        } catch (e: any) {
            showAlert('error', 'Error', e.message);
        }
    };

    const handleDownload = async (reportName: string, format: string) => {
        const currentData = payrollHistory.filter(r => r.month === selectedMonth && r.year === selectedYear);
        const fileName = getStandardFileName(reportName, companyProfile, selectedMonth, selectedYear);
        try {
            let savedPath: string | null = null;
            if (reportName === 'PF ECR Arrears') {
                const batch = arrearHistory?.find(b => b.month === selectedMonth && b.year === selectedYear);
                if (!batch) throw new Error(`No arrears processed for the period ${selectedMonth} ${selectedYear}`);
                if (format === 'Excel') savedPath = await generateArrearECRExcel(batch, payrollHistory, employees, config, fileName);
                else savedPath = await generateArrearECRText(batch, payrollHistory, employees, config, fileName);
            } else if (reportName.includes('PF ECR')) {
                savedPath = await generatePFECR(currentData, employees, config, format as any, fileName);
            } else if (reportName.includes('ESI Code Wages')) {
                savedPath = await generateESICodeWagesReport(currentData, employees, format as any, fileName, companyProfile, selectedMonth, selectedYear);
            } else if (reportName.includes('ESI Exit')) {
                savedPath = await generateESIExitReport(currentData, employees, selectedMonth, selectedYear, companyProfile);
            } else if (reportName.includes('ESI')) {
                savedPath = await generateESIReturn(currentData, employees, format as any, fileName, companyProfile);
            } else if (reportName.includes('PT')) {
                savedPath = await generatePTReport(currentData, employees, fileName, companyProfile);
            } else if (reportName.includes('TDS')) {
                savedPath = await generateTDSReport(currentData, employees, fileName, companyProfile);
            } else if (reportName.includes('Gratuity')) {
                savedPath = await generateGratuityReport(employees, companyProfile);
            } else if (reportName.includes('Form 12A')) {
                savedPath = await generatePFForm12A(currentData, employees, config, companyProfile, selectedMonth, selectedYear);
            } else if (reportName.includes('Form B')) {
                savedPath = await generateFormB(currentData, employees, selectedMonth, selectedYear, companyProfile);
            } else if (reportName.includes('Form C')) {
                savedPath = await generateFormC(currentData, employees, attendances, selectedMonth, selectedYear, companyProfile);
            } else if (reportName === 'Wage Register') {
                savedPath = await generateStateWageRegister(currentData, employees, selectedMonth, selectedYear, companyProfile, selectedState, currentForms.wage);
            } else if (reportName === 'Pay Slip') {
                savedPath = await generateStatePaySlip(currentData, employees, selectedMonth, selectedYear, companyProfile, selectedState, currentForms.slip);
            } else if (reportName === 'Advance Register') {
                savedPath = await generateStateAdvanceRegister(currentData, employees, advanceLedgers, selectedMonth, selectedYear, companyProfile, selectedState, currentForms.advance);
            }

            if (savedPath) showAlert('success', 'Report Generated', `Successfully generated ${reportName}!`);
        } catch (e: any) {
            showAlert('error', 'Generation Failed', e.message);
        }
    };

    const ReportCard = ({ title, icon: Icon, color, reports, headerAction }: { title: string, icon: any, color: string, reports: { label: string, action: () => void, format?: string, textColor?: string }[], headerAction?: React.ReactNode }) => (
        <div className="bg-[#1e293b] rounded-xl border border-slate-800 shadow-lg overflow-hidden group hover:border-slate-700 transition-all h-full">
            <div className="bg-[#0f172a] p-4 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-${color}-900/20 text-${color}-400 border border-${color}-900/30`}>
                        <Icon size={18} />
                    </div>
                    <h3 className={`font-bold text-${color}-400 text-[10px] uppercase tracking-widest`}>{title}</h3>
                </div>
                {headerAction}
            </div>
            <div className="p-4 grid grid-cols-1 gap-1.5">
                {reports.map((r, i) => (
                    <button key={i} onClick={r.action} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/40 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all group/btn text-left">
                        <span className={`text-[11px] font-bold ${r.textColor || 'text-slate-300'} group-hover/btn:text-white`}>{r.label}</span>
                        <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{r.format || 'PDF'}</span>
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1e293b] p-6 rounded-xl border border-slate-800 shadow-xl">
                <div>
                    <h3 className={`font-bold text-lg ${isLocked ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isLocked ? 'Compliance View Locked' : 'Compliance View Open'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                        {isLocked ? 'Data is frozen for reporting.' : 'Finalize payroll to view compliance reports.'}
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-[#0f172a] p-1 rounded-xl border border-slate-700">
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent px-3 py-1 text-xs text-white font-bold outline-none" title="Select Month">
                        {monthsArr.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value, 10))} className="bg-transparent px-3 py-1 text-xs text-white font-bold outline-none" title="Select Year">
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {reportView === 'Dynamic' ? (
                <DynamicReportBuilder 
                    employees={employees}
                    savedRecords={payrollHistory}
                    month={selectedMonth}
                    year={selectedYear}
                    companyProfile={companyProfile}
                    showAlert={(type, title, message) => showAlert(type as any, title, message)}
                    finalizedPeriods={finalizedPeriods}
                />
            ) : (
                <>
                {!isLocked ? (
                    <div className="flex flex-col items-center justify-center p-12 bg-[#1e293b] rounded-2xl border border-slate-800 text-center">
                        <Lock size={48} className="text-slate-600 mb-4" />
                        <h3 className="text-2xl font-black text-white">Compliance Locked</h3>
                        <p className="text-slate-400 text-sm max-w-sm">Payroll for {selectedMonth} {selectedYear} must be frozen to generate official reports.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
                        <div className="lg:col-span-2 bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl flex items-start gap-3">
                            <Info className="text-indigo-400 shrink-0 mt-1" size={20} />
                            <div>
                                <h4 className="text-sm font-bold text-indigo-300">Social Security Code 2020 Compliance</h4>
                                <p className="text-xs text-indigo-200/70 mt-1">Automatic adjustments applied for Clause 88 (50% exclusion limit).</p>
                            </div>
                        </div>

                        <ReportCard title="EPF & MP Act, 1952" icon={Landmark} color="blue" reports={[
                            { label: 'PF ECR (Electronic Challan Return)', action: () => handleDownload('PF ECR', 'Text'), format: 'TXT' },
                            { label: 'PF ECR (Excel Backup)', action: () => handleDownload('PF ECR', 'Excel'), format: 'XLSX' },
                            { label: 'Form 12A (Revised)', action: () => handleDownload('Form 12A', 'PDF') },
                            { label: 'Annual Form 3A / 6A', action: () => openRangeModal('Form 3A'), format: 'PDF' }
                        ]} />

                        <ReportCard title="ESI Act, 1948" icon={ShieldCheck} color="pink" reports={[
                            { label: 'ESI Monthly Return (Excel)', action: () => handleDownload('ESI', 'Excel'), format: 'XLSX' },
                            { label: 'ESI Exit List', action: () => handleDownload('ESI Exit', 'Excel'), format: 'XLSX' }
                        ]} />

                        <ReportCard title="Labour Registers" icon={BookOpen} color="emerald" reports={[
                            { label: 'Form B (Register of Wages)', action: () => handleDownload('Form B', 'PDF') },
                            { label: 'Form C (Muster Roll)', action: () => handleDownload('Form C', 'PDF') }
                        ]} />

                        <ReportCard 
                            title="State Specific Forms" 
                            icon={ScrollText} 
                            color="teal" 
                            headerAction={<select value={selectedState} onChange={e => setSelectedState(e.target.value)} className="bg-[#1e293b] border border-teal-500/30 text-teal-400 text-[10px] font-bold rounded-lg px-2 py-1 outline-none">{INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select>}
                            reports={[
                                { label: currentForms.wage, action: () => handleDownload('Wage Register', 'PDF') },
                                { label: currentForms.slip, action: () => handleDownload('Pay Slip', 'PDF') }
                            ]} 
                        />
                    </div>
                )}
                </>
            )}

            {rangeModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <h3 className="text-white font-bold">{rangeModal.reportType}</h3>
                            <button onClick={() => setRangeModal({ ...rangeModal, isOpen: false })}><X size={20} className="text-slate-400" /></button>
                        </div>
                        <button onClick={handleGenerateRange} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"><Download size={18} /> Generate</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatutoryReports;
