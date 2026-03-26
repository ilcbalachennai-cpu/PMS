import React, { useState, useMemo, useEffect } from 'react';
import { FileText, Download, Lock, Unlock, Loader2 } from 'lucide-react';
import { Employee, PayrollResult, StatutoryConfig, CompanyProfile, AlertType } from '../types';
import {
    generateExcelReport,
    generateSimplePaySheetPDF,
    generatePaySlipsPDF,
    generateBankStatementPDF,
    getStandardFileName
} from '../services/reportService';
import { usePayrollData } from '../hooks/usePayrollData';
import { usePayrollPeriod } from '../hooks/usePayrollPeriod';

interface ReportsProps {
    results: PayrollResult[];
    employees: Employee[];
    companyProfile: CompanyProfile;
    statutoryConfig: StatutoryConfig;
    showAlert: (type: AlertType, title: string, message: React.ReactNode, onConfirm?: () => void, onCancel?: () => void) => string;
}

const Reports: React.FC<ReportsProps> = ({
    results: savedRecords,
    employees,
    companyProfile,
    showAlert
}) => {
    const { 
        setPayrollHistory: setSavedRecords,
        arrearHistory,
        handleRollover: onRollover
    } = usePayrollData(showAlert);
    
    const { activePeriod } = usePayrollPeriod();
    const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const [month, setMonth] = useState<string>(activePeriod.month);
    const [year, setYear] = useState<number>(activePeriod.year);

    const [reportType, setReportType] = useState<string>('Pay Sheet');
    const [format, setFormat] = useState<'PDF' | 'Excel'>('PDF');
    const [isGenerating, setIsGenerating] = useState(false);
    const [arrearSelectedPeriod, setArrearSelectedPeriod] = useState<string>('');
    const [zeroWageEmployees, setZeroWageEmployees] = useState<PayrollResult[]>([]);
    const [exitData, setExitData] = useState<Record<string, { dol: string, reason: string }>>({});

    useEffect(() => {
        if (arrearHistory && arrearHistory.length > 0) {
            const currentValid = arrearHistory.find(b => `${b.month}-${b.year}` === arrearSelectedPeriod);
            if (!currentValid) {
                const latest = arrearHistory[arrearHistory.length - 1];
                setArrearSelectedPeriod(`${latest.month}-${latest.year}`);
            }
        }
    }, [arrearHistory, arrearSelectedPeriod]);

    const currentResults = useMemo(() => {
        return savedRecords.filter(r => r.month === month && r.year === year);
    }, [savedRecords, month, year]);

    const isFinalized = useMemo(() => {
        return currentResults.length > 0 && currentResults[0].status === 'Finalized';
    }, [currentResults]);

    const isLocked = useMemo(() => isFinalized || (year < activePeriod.year) || (year === activePeriod.year && monthsArr.indexOf(month) < monthsArr.indexOf(activePeriod.month)), [isFinalized, year, activePeriod, month]);

    const hasData = useMemo(() => currentResults.length > 0, [currentResults]);

    const executeFreeze = async () => {
        try {
            const updated = savedRecords.map(r => {
                if (r.month === month && r.year === year) return { ...r, status: 'Finalized' as const };
                return r;
            });
            setSavedRecords(updated);
            showAlert('success', 'Payroll Finalized', 'Data has been frozen and locked successfully.');
            onRollover(month, year, monthsArr, updated);
        } catch (e: any) {
            showAlert('error', 'Freeze Failed', e.message);
        }
    };

    const handleFreeze = async () => {
        if (!hasData) {
            showAlert('error', 'No Data', 'Please calculate payroll before freezing.');
            return;
        }

        const zw = currentResults.filter(r => r.payableDays === 0 || (r.earnings?.total || 0) === 0);
        if (zw.length > 0) {
            setZeroWageEmployees(zw);
            const initialExitData: Record<string, { dol: string, reason: string }> = {};
            zw.forEach(r => {
                const emp = employees.find(e => e.id === r.employeeId);
                if (emp) initialExitData[emp.id] = { dol: emp.dol || `${year}-${String(monthsArr.indexOf(month) + 1).padStart(2, '0')}-01`, reason: emp.leavingReason || 'Resignation' };
            });
            setExitData(initialExitData);
        } else {
            showAlert('confirm', 'Confirm Freeze', 'Are you sure you want to finalize payroll? This will lock all records for this period.', executeFreeze);
        }
    };

    const generateReport = async () => {
        if (reportType !== 'Arrear Report' && !isLocked) {
            showAlert('error', 'Access Denied', 'Please freeze payroll before generating reports.');
            return;
        }

        setIsGenerating(true);
        try {
            let savedPath: string | null = null;
            if (reportType === 'Pay Sheet') {
                if (format === 'Excel') {
                   const data = currentResults.map(r => ({
                        'ID': r.employeeId,
                        'Name': employees.find(e => e.id === r.employeeId)?.name,
                        'Gross': Math.round(r.earnings?.total || 0),
                        'Net': Math.round(r.netPay || 0)
                   }));
                   savedPath = await generateExcelReport(data, 'Pay Sheet', getStandardFileName('PaySheet', companyProfile, month, year));
                } else {
                   savedPath = await generateSimplePaySheetPDF(currentResults, employees, month, year, companyProfile);
                }
            } else if (reportType === 'Pay Slips') {
                savedPath = await generatePaySlipsPDF(currentResults, employees, month, year, companyProfile);
            } else if (reportType === 'Bank Statement') {
                savedPath = await generateBankStatementPDF(currentResults, employees, month, year, companyProfile);
            }

            if (savedPath) {
                showAlert('success', 'Report Generated', 'Report has been saved to your downloads folder.');
            }
        } catch (e: any) {
            showAlert('error', 'Generation Failed', e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-xl shadow-lg">
                        <FileText size={28} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Pay Reports</h2>
                        <p className="text-slate-400 text-sm font-medium">Statements, Slips & Compliance Files</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-[#0f172a] p-1.5 rounded-xl border border-slate-700">
                    <select value={month} onChange={e => setMonth(e.target.value)} className="bg-transparent px-3 py-1 text-xs text-white font-bold outline-none" title="Select Month">
                        {monthsArr.map(m => (<option key={m} value={m}>{m}</option>))}
                    </select>
                    <select value={year} onChange={e => setYear(+e.target.value)} className="bg-transparent px-3 py-1 text-xs text-white font-bold outline-none" title="Select Year">
                        {[2024, 2025, 2026].map(y => (<option key={y} value={y}>{y}</option>))}
                    </select>
                </div>
            </div>

            <div className={`p-6 rounded-xl border flex items-center justify-between shadow-lg transition-all ${isLocked ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-amber-900/10 border-amber-500/30'}`}>
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full border ${isLocked ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' : 'bg-amber-900/20 border-amber-500/50 text-amber-400'}`}>
                        {isLocked ? <Lock size={24} /> : <Unlock size={24} />}
                    </div>
                    <div>
                        <h3 className={`font-bold text-lg ${isLocked ? 'text-emerald-400' : 'text-amber-400'}`}>{isLocked ? 'Payroll Finalized' : 'Payroll in Draft'}</h3>
                        <p className="text-xs text-slate-400 mt-1">
                            {isLocked ? 'Data is frozen for compliance. Unlock to edit if required.' : 'Freeze data to generate statutory reports and lock edits.'}
                        </p>
                    </div>
                </div>
                {!isLocked && (
                    <button onClick={handleFreeze} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-lg transition-all">
                        Confirm & Freeze Data
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-[#1e293b] rounded-2xl border border-slate-800 p-6 shadow-xl">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Available Statements</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {['Pay Sheet', 'Pay Slips', 'Bank Statement', 'Leave Ledger', 'Arrear Report'].map(type => (
                            <button
                                key={type}
                                onClick={() => setReportType(type)}
                                className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left group ${reportType === type ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-900/20' : 'bg-[#0f172a] border-slate-800 hover:border-slate-700'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${reportType === type ? 'bg-white/20' : 'bg-slate-800'}`}>
                                        <FileText size={18} />
                                    </div>
                                    <span className={`text-sm font-bold ${reportType === type ? 'text-white' : 'text-slate-300'}`}>{type}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
                     <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Export Options</h3>
                        <div className="space-y-4">
                            <div className="flex p-1 bg-[#0f172a] rounded-lg border border-slate-800">
                                <button onClick={() => setFormat('PDF')} className={`flex-1 py-1.5 text-[10px] font-black rounded-md transition-all ${format === 'PDF' ? 'bg-slate-800 text-white shadow-inner' : 'text-slate-500'}`}>PDF</button>
                                <button onClick={() => setFormat('Excel')} className={`flex-1 py-1.5 text-[10px] font-black rounded-md transition-all ${format === 'Excel' ? 'bg-slate-800 text-white shadow-inner' : 'text-slate-500'}`}>EXCEL</button>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={generateReport}
                        disabled={isGenerating}
                        className="mt-8 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-4 rounded-xl shadow-xl shadow-indigo-900/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                        GENERATE REPORT
                    </button>
                </div>
            </div>
            {zeroWageEmployees.length > 0 && (
                <ZeroWageModal 
                    employees={zeroWageEmployees.map(zw => employees.find(e => e.id === zw.employeeId)!).filter(Boolean)}
                    exitData={exitData}
                    onExitDataChange={setExitData}
                    onConfirm={executeFreeze}
                    onCancel={() => setZeroWageEmployees([])}
                />
            )}
        </div>
    );
};

const ZeroWageModal: React.FC<{
    employees: Employee[],
    exitData: Record<string, { dol: string, reason: string }>,
    onExitDataChange: (data: Record<string, { dol: string, reason: string }>) => void,
    onConfirm: () => void,
    onCancel: () => void
}> = ({ employees, exitData, onExitDataChange, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-[#1e293b] w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-black text-white italic tracking-tight">ATTENTION: ZERO WAGE DETECTED</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Found {employees.length} employees with 0 payable days</p>
                </div>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
                <p className="text-xs text-slate-300 font-medium leading-relaxed bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                    The following employees have no earnings for this period. If they have left the company, please provide their Date of Leaving (DOL) and Reason below.
                </p>
                
                {employees.map(emp => (
                    <div key={emp.id} className="p-4 bg-[#0f172a] rounded-xl border border-slate-800 flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase">{emp.id}</span>
                            <h4 className="text-white font-bold">{emp.name}</h4>
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="date" 
                                value={exitData[emp.id]?.dol || ''}
                                onChange={e => onExitDataChange({ ...exitData, [emp.id]: { ...exitData[emp.id], dol: e.target.value } })}
                                className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500 transition-all font-bold"
                                title="Date of Leaving"
                            />
                            <select 
                                value={exitData[emp.id]?.reason || 'Resignation'}
                                onChange={e => onExitDataChange({ ...exitData, [emp.id]: { ...exitData[emp.id], reason: e.target.value } })}
                                className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500 transition-all font-bold"
                                title="Reason for Leaving"
                            >
                                <option value="Resignation">Resignation</option>
                                <option value="Retirement">Retirement</option>
                                <option value="Death">Death</option>
                                <option value="Termination">Termination</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-6 border-t border-slate-800 flex gap-4">
                <button onClick={onCancel} className="flex-1 py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all">CANCEL</button>
                <button onClick={onConfirm} className="flex-1 py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all uppercase tracking-widest">FINALIZE ALL</button>
            </div>
        </div>
    </div>
);

export default Reports;
