
import React, { useState } from 'react';
import { Mail, FileText, Send, Search, AlertCircle, CheckCircle2, Loader2, Calendar, Layout } from 'lucide-react';
import { Employee, PayrollResult, CompanyProfile } from '../types';
import DynamicReportBuilder from './DynamicReportBuilder';
import DynamicMISReportBuilder from './DynamicMISReportBuilder';
import { generatePayslipForEmail } from '../services/reportService';
import { sendPayslipsViaEmail } from '../services/emailService';

interface MISDashboardProps {
    employees: Employee[];
    payrollHistory: PayrollResult[];
    companyProfile: CompanyProfile;
    month: string;
    year: number;
    showAlert: (type: any, title: string, message: string) => void;
}

const MISDashboard: React.FC<MISDashboardProps> = ({
    employees,
    payrollHistory,
    companyProfile,
    month,
    year,
    showAlert
}) => {
    const [activeTab, setActiveTab] = useState<'mailing' | 'dynamic' | 'mis'>('mailing');
    const [selectedMonth, setSelectedMonth] = useState(month);
    const [selectedYear, setSelectedYear] = useState(year);
    const [isMailing, setIsMailing] = useState(false);
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Extract unique finalized periods (Month/Year) from payroll history
    const finalizedPeriods = React.useMemo(() => {
        const unique = new Set<string>();
        payrollHistory.forEach(p => {
            if (p.status === 'Finalized') {
                unique.add(`${p.month} ${p.year}`);
            }
        });
        
        return Array.from(unique).map(p => {
            const [m, y] = p.split(' ');
            return { month: m, year: parseInt(y) };
        }).sort((a, b) => {
            const valA = monthsArr.indexOf(a.month) + a.year * 12;
            const valB = monthsArr.indexOf(b.month) + b.year * 12;
            return valB - valA; // Latest first
        });
    }, [payrollHistory]);

    // Extract unique finalized years and months
    const availableYears = React.useMemo(() => {
        const years = new Set<number>();
        finalizedPeriods.forEach(p => years.add(p.year));
        return Array.from(years).sort((a, b) => b - a);
    }, [finalizedPeriods]);

    const availableMonthsForYear = React.useMemo(() => {
        return finalizedPeriods
            .filter(p => p.year === selectedYear)
            .map(p => p.month);
    }, [finalizedPeriods, selectedYear]);

    // Update local selection if props change or if nothing is selected yet
    React.useEffect(() => {
        if (finalizedPeriods.length > 0) {
            const exists = finalizedPeriods.some(p => p.month === selectedMonth && p.year === selectedYear);
            if (!exists) {
                // If current selection is invalid, default to latest available for that year, or absolute latest
                if (availableMonthsForYear.length > 0) {
                    setSelectedMonth(availableMonthsForYear[0]);
                } else {
                    setSelectedMonth(finalizedPeriods[0].month);
                    setSelectedYear(finalizedPeriods[0].year);
                }
            }
        }
    }, [finalizedPeriods, selectedMonth, selectedYear, availableMonthsForYear]);

    const monthIdx = monthsArr.indexOf(selectedMonth);
    const startDate = new Date(selectedYear, monthIdx, 1);
    const endDate = new Date(selectedYear, monthIdx + 1, 0);

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            emp.id.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;

        const doj = new Date(emp.doj);
        if (doj > endDate) return false;

        if (emp.dol) {
            const dol = new Date(emp.dol);
            if (dol < startDate) return false;
        }

        return true;
    }).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

    const handleToggleEmployee = (id: string) => {
        setSelectedEmployees(prev => 
            prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedEmployees.length === filteredEmployees.length) {
            setSelectedEmployees([]);
        } else {
            setSelectedEmployees(filteredEmployees.map(e => e.id));
        }
    };

    const handleSendPayslips = async () => {
        if (selectedEmployees.length === 0) {
            showAlert('error', 'No Employees Selected', 'Please select at least one employee to send payslips.');
            return;
        }

        if (!companyProfile.smtpConfig) {
            showAlert('error', 'SMTP Not Configured', 'Please configure SMTP settings in Configuration > Company Profile to send emails.');
            return;
        }

        setIsMailing(true);
        try {
            const payslipPdfs: { [id: string]: Uint8Array } = {};
            
            // 1. Generate PDFs for each selected employee
            for (const empId of selectedEmployees) {
                const emp = employees.find(e => e.id === empId);
                const payroll = payrollHistory.find(p => p.employeeId === empId && p.month === selectedMonth && p.year === selectedYear);
                
                if (emp && payroll) {
                    const pdfData = await generatePayslipForEmail(payroll, emp, month, year, companyProfile);
                    if (pdfData) {
                        payslipPdfs[empId] = pdfData;
                    }
                }
            }

            // 2. Send Emails
            const targetEmployees = employees.filter(e => selectedEmployees.includes(e.id));
            const mailResults = await sendPayslipsViaEmail(companyProfile, targetEmployees, selectedMonth, selectedYear, payslipPdfs);
            
            const successCount = mailResults.filter(r => r.success).length;
            const failCount = mailResults.length - successCount;

            if (failCount === 0) {
                showAlert('success', 'Mailing Complete', `Successfully sent payslips to ${successCount} employees.`);
            } else {
                showAlert('info', 'Mailing Processed', `Sent: ${successCount}, Failed: ${failCount}. Check logs for details.`);
            }
        } catch (e: any) {
            showAlert('error', 'Mailing Failed', e.message);
        } finally {
            setIsMailing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-indigo-900/30 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10 shrink-0">
                            <Calendar size={28} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-black text-white tracking-tight flex flex-wrap items-center gap-2">
                                Management Info <span className="text-xs font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md">MIS</span>
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase opacity-70">Employee Communication & Advanced Reporting</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap bg-[#0f172a] p-1.5 rounded-2xl border border-slate-800 shadow-inner gap-1">
                        <button
                            onClick={() => setActiveTab('mailing')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                activeTab === 'mailing' 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            <Mail size={14} />
                            Mailing
                        </button>
                        <button
                            onClick={() => setActiveTab('dynamic')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                activeTab === 'dynamic' 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            <FileText size={14} />
                            Dynamic Report
                        </button>
                        <button
                            onClick={() => setActiveTab('mis')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                activeTab === 'mis' 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            <Layout size={14} />
                            MIS Report
                        </button>
                    </div>
                </div>

                <div className="h-px bg-slate-800/50 w-full"></div>

                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="flex items-center gap-4 bg-[#0f172a]/50 p-4 rounded-2xl border border-slate-800/50 w-full sm:w-auto shadow-inner">
                        <div className="space-y-1.5 flex-1 sm:flex-none">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Reporting Year</label>
                            <select 
                                className="w-full sm:w-32 bg-[#0f172a] border border-slate-700 rounded-xl p-2.5 text-xs text-amber-100 font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                                value={selectedYear}
                                title="Select Year"
                                onChange={e => setSelectedYear(parseInt(e.target.value))}
                            >
                                {availableYears.length > 0 ? (
                                    availableYears.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))
                                ) : (
                                    <option value={year}>{year}</option>
                                )}
                            </select>
                        </div>

                        <div className="space-y-1.5 font-bold flex-1 sm:flex-none">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Reporting Month</label>
                            <select 
                                className="w-full sm:w-48 bg-[#0f172a] border border-slate-700 rounded-xl p-2.5 text-xs text-amber-400 font-black outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                                value={selectedMonth}
                                title="Select Month"
                                onChange={e => setSelectedMonth(e.target.value)}
                            >
                                {availableMonthsForYear.length > 0 ? (
                                    availableMonthsForYear.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))
                                ) : (
                                    <option value={month}>{month}</option>
                                )}
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex-1 text-right hidden lg:block">
                        <div className="inline-flex flex-col items-end gap-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Report Period</span>
                            <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs font-black text-indigo-400 shadow-lg shadow-indigo-500/5">
                                {selectedMonth} {selectedYear}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {activeTab === 'mailing' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Employee Selection List */}
                    <div className="lg:col-span-2 bg-[#1e293b] border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[600px]">
                        <div className="p-4 border-b border-slate-800 bg-[#1e293b] sticky top-0 z-10 flex items-center gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by name or ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-[#0f172a] border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <button
                                onClick={handleSelectAll}
                                className="px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                            >
                                {selectedEmployees.length === filteredEmployees.length ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {filteredEmployees.map(emp => (
                                <div
                                    key={emp.id}
                                    onClick={() => handleToggleEmployee(emp.id)}
                                    className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                                        selectedEmployees.includes(emp.id)
                                        ? 'bg-indigo-900/20 border-indigo-500/50 shelf-shadow'
                                        : 'bg-[#0f172a]/50 border-slate-800 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm relative ${
                                            selectedEmployees.includes(emp.id) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                                        }`}>
                                            {emp.name.charAt(0)}
                                            {emp.dol && (
                                                <div className="absolute -bottom-1 -right-1 bg-red-600 text-[8px] text-white font-black px-1 rounded-md border border-[#1e293b]">LEFT</div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{emp.name}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{emp.id}</span>
                                                <span className="text-slate-700">•</span>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest ${emp.email ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {emp.email || 'No Email Added'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                        selectedEmployees.includes(emp.id)
                                        ? 'bg-indigo-600 border-indigo-600'
                                        : 'border-slate-700 group-hover:border-slate-600'
                                    }`}>
                                        {selectedEmployees.includes(emp.id) && <CheckCircle2 size={16} className="text-white" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action Panel */}
                    <div className="space-y-6">
                        <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Send size={16} className="text-indigo-400" />
                                Send Payslips
                            </h3>

                            <div className="space-y-4">
                                <div className="p-4 bg-[#0f172a] rounded-xl border border-slate-800">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Selected Period</span>
                                        <div className="px-2 py-1 bg-indigo-900/30 text-indigo-400 rounded text-[10px] font-black uppercase pulse">
                                            {selectedMonth} {selectedYear}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Selected Employees</span>
                                        <span className="text-sm font-black text-white">{selectedEmployees.length}</span>
                                    </div>
                                </div>

                                {!companyProfile.smtpConfig && (
                                    <div className="p-4 bg-rose-900/20 border border-rose-500/30 rounded-xl flex gap-3">
                                        <AlertCircle className="text-rose-500 shrink-0" size={20} />
                                        <p className="text-xs text-rose-200 leading-relaxed font-medium">
                                            SMTP settings are not configured. Go to <b>Configuration {'>'} Company</b> to set up your email provider.
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={handleSendPayslips}
                                    disabled={isMailing || selectedEmployees.length === 0}
                                    className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest transition-all ${
                                        isMailing || selectedEmployees.length === 0
                                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'
                                    }`}
                                >
                                    {isMailing ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send size={18} />
                                            Send Via Email
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Mailing Tips</h3>
                            <ul className="space-y-3">
                                <li className="flex gap-3 text-xs text-slate-400 font-medium leading-relaxed">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                    Ensure employee email IDs are correct in the Employee Master.
                                </li>
                                <li className="flex gap-3 text-xs text-slate-400 font-medium leading-relaxed">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                    Only employees with a confirmed payslip for {selectedMonth} {selectedYear} will receive the email.
                                </li>
                                <li className="flex gap-3 text-xs text-slate-400 font-medium leading-relaxed">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                    Each email will include a secure PDF attachment of the payslip.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'dynamic' ? (
                <DynamicReportBuilder 
                    employees={employees}
                    savedRecords={payrollHistory}
                    month={selectedMonth}
                    year={selectedYear}
                    companyProfile={companyProfile}
                    showAlert={showAlert}
                    finalizedPeriods={finalizedPeriods}
                />
            ) : (
                <DynamicMISReportBuilder 
                    employees={employees}
                    payrollHistory={payrollHistory}
                    month={selectedMonth}
                    year={selectedYear}
                    companyProfile={companyProfile}
                    showAlert={showAlert}
                    finalizedPeriods={finalizedPeriods}
                />
            )}
        </div>
    );
};

export default MISDashboard;
