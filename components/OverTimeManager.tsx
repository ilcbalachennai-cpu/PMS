import React, { useState, useMemo, useRef } from 'react';
import { Clock, Calculator, Download, Upload, Save, Edit2, AlertCircle } from 'lucide-react';
import { Employee, Attendance, StatutoryConfig, CompanyProfile } from '../types';
import { generateOTTemplate, parseOTXLSX } from '../services/excelService';

interface OverTimeManagerProps {
    employees: Employee[];
    attendances: Attendance[];
    setAttendances: (att: Attendance[]) => void;
    month: string;
    year: number;
    config: StatutoryConfig;
    companyProfile: CompanyProfile;
    isLocked: boolean;
    showAlert: (type: any, title: string, message: string) => void;
}

const OverTimeManager: React.FC<OverTimeManagerProps> = ({
    employees,
    attendances,
    setAttendances,
    month,
    year,
    config,
    companyProfile,
    isLocked,
    showAlert
}) => {
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const daysInMonth = new Date(year, months.indexOf(month) + 1, 0).getDate();

    // Filter active employees for OT
    const activeEmployees = useMemo(() => {
        const monthIdx = months.indexOf(month);
        const periodStart = new Date(year, monthIdx, 1);
        periodStart.setHours(0, 0, 0, 0);

        return employees.filter(emp => {
            if (!emp.dol) return true;
            const [y, m, d] = emp.dol.split('-').map(Number);
            const dolDate = new Date(y, m - 1, d);
            dolDate.setHours(0, 0, 0, 0);
            return dolDate >= periodStart;
        });
    }, [employees, month, year]);

    // Calculate OT Rate for an employee
    const calculateOTRate = (emp: Employee) => {
        if (!config.enableOverTime) return 0;

        let otWageBase = 0;
        const components = config.otWagesComponents;
        if (components.basic) otWageBase += emp.basicPay;
        if (components.da) otWageBase += (emp.da || 0);
        if (components.retaining) otWageBase += (emp.retainingAllowance || 0);
        if (components.hra) otWageBase += (emp.hra || 0);
        if (components.conveyance) otWageBase += (emp.conveyance || 0);
        if (components.washing) otWageBase += (emp.washing || 0);
        if (components.attire) otWageBase += (emp.attire || 0);
        if (components.special1) otWageBase += (emp.specialAllowance1 || 0);
        if (components.special2) otWageBase += (emp.specialAllowance2 || 0);
        if (components.special3) otWageBase += (emp.specialAllowance3 || 0);

        const dailyRate = otWageBase / daysInMonth;
        const multiplier = config.otRateType === 'Double' ? 2 : 1;
        return dailyRate * multiplier;
    };

    const getAttendance = (empId: string) => {
        return attendances.find(a => a.employeeId === empId && a.month === month && a.year === year) ||
            { employeeId: empId, month, year, presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0, otDays: 0, otHours: 0 };
    };

    const handleUpdate = (empId: string, field: 'otDays' | 'otHours', value: number) => {
        if (isLocked) return;

        const exists = attendances.some(a => a.employeeId === empId && a.month === month && a.year === year);
        const newVal = Math.max(0, value);

        if (exists) {
            setAttendances(attendances.map(a => {
                if (a.employeeId === empId && a.month === month && a.year === year) {
                    return { ...a, [field]: newVal };
                }
                return a;
            }));
        } else {
            const newRecord: Attendance = {
                employeeId: empId, month, year,
                presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0,
                [field]: newVal
            };
            setAttendances([...attendances, newRecord]);
        }
    };

    const handleSave = () => {
        setIsSaving(true);
        try {
            localStorage.setItem('app_attendance', JSON.stringify(attendances));
            setTimeout(() => {
                setIsSaving(false);
                setIsEditMode(false);
                showAlert('success', 'OT Data Saved', 'OverTime records have been updated successfully.');
            }, 500);
        } catch (e) {
            console.error(e);
            setIsSaving(false);
            showAlert('error', 'Save Failed', 'Could not save OT data.');
        }
    };

    const handleExportTemplate = async () => {
        setIsExporting(true);
        try {
            await generateOTTemplate(activeEmployees, month, year, companyProfile);
        } catch (e) {
            console.error(e);
            showAlert('error', 'Export Failed', 'Could not generate OT template.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const data = await parseOTXLSX(file);
            const newAttendances = [...attendances];
            let count = 0;

            data.forEach((row: any) => {
                const getStr = (keys: string[]) => {
                    for (const k of keys) {
                        const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
                        if (found) return String(row[found]).trim();
                    }
                    return null;
                };
                const getNum = (keys: string[]) => {
                    for (const k of keys) {
                        const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
                        if (found) return Number(row[found]) || 0;
                    }
                    return 0;
                };

                const empId = getStr(['EMP_ID', 'Employee ID', 'ID']);
                if (!empId) return;

                const days = getNum(['Days', 'OT Days']);
                const hours = getNum(['Hours', 'OT Hours']);

                const idx = newAttendances.findIndex(a => a.employeeId === empId && a.month === month && a.year === year);
                if (idx >= 0) {
                    newAttendances[idx] = { ...newAttendances[idx], otDays: days, otHours: hours };
                } else {
                    newAttendances.push({
                        employeeId: empId, month, year,
                        presentDays: 0, earnedLeave: 0, sickLeave: 0, casualLeave: 0, lopDays: 0,
                        otDays: days, otHours: hours
                    });
                }
                count++;
            });

            setAttendances(newAttendances);
            showAlert('success', 'Import Successful', `Updated OT data for ${count} employees. Review and Save.`);
        } catch (e) {
            console.error(e);
            showAlert('error', 'Import Failed', 'Could not process Excel file.');
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (!config.enableOverTime) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed animate-in fade-in zoom-in-95 duration-500">
                <AlertCircle size={48} className="text-amber-500 mb-4 opacity-75" />
                <h3 className="text-xl font-black text-white">OT Policy Not Activated</h3>
                <p className="text-slate-400 mt-2 text-center max-w-md">Go to <b>Configuration &rarr; Statutory Rule &rarr; OverTime Policy</b> to activate this module and configure components.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-600/5 blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="flex items-center gap-3 relative z-10">
                    <div className="p-2.5 bg-sky-600 rounded-lg shadow-md shadow-sky-900/30">
                        <Clock size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">OverTime Management</h2>
                        <p className="text-slate-400 text-[10px] mt-0.5 uppercase tracking-widest font-bold">Payroll Processing Cycle: <span className="text-sky-400">{month} {year}</span></p>
                    </div>
                </div>

                <div className="flex gap-2 relative z-10">
                    {!isLocked && (
                        <button 
                            onClick={isEditMode ? handleSave : () => setIsEditMode(true)}
                            disabled={isSaving}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all transform active:scale-95 shadow-md ${isEditMode ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
                        >
                            {isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : isEditMode ? <Save size={16} /> : <Edit2 size={16} />}
                            {isEditMode ? 'Save' : 'Modify'}
                        </button>
                    )}
                    
                    <button 
                        onClick={handleExportTemplate}
                        disabled={isExporting}
                        className="flex items-center gap-2 bg-[#1e293b] hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-bold border border-slate-700 transition-all shadow-sm"
                    >
                        {isExporting ? <div className="animate-spin rounded-full h-3 w-3 border-2 border-white/30 border-t-white" /> : <Download size={16} />}
                        Template
                    </button>

                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting || isLocked}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold shadow-md shadow-emerald-900/40 transition-all font-sans"
                    >
                        {isImporting ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <Upload size={16} />}
                        Import
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImportExcel} 
                        className="hidden" 
                        accept=".xlsx, .xls" 
                        title="Import OverTime Excel File"
                        aria-label="Import OverTime Excel File"
                    />
                </div>
            </div>

            {/* Grid display */}
            <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-[#0f172a] text-slate-400 font-black text-[10px] uppercase tracking-widest border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-4 border-r border-slate-800">Active Employees</th>
                                <th className="px-6 py-4 text-right">OT Rate (1x/2x)</th>
                                <th className="px-6 py-4 text-center">OT Days</th>
                                <th className="px-6 py-4 text-center">OT Hours</th>
                                <th className="px-6 py-4 text-right bg-sky-900/10 text-sky-400">OT Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {activeEmployees.map(emp => {
                                const att = getAttendance(emp.id);
                                const otRate = calculateOTRate(emp);
                                const otAmount = Math.round((otRate * (att.otDays || 0)) + ((otRate / 8) * (att.otHours || 0)));

                                return (
                                    <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-4 border-r border-slate-800/50">
                                            <div className="font-bold text-white group-hover:text-sky-300 transition-colors">{emp.name}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">{emp.id}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-400">
                                            ₹{otRate.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <input 
                                                title={`OT Days for ${emp.name}`}
                                                aria-label={`OT Days for ${emp.name}`}
                                                type="number" 
                                                disabled={!isEditMode || isLocked}
                                                className={`w-20 bg-[#0f172a] border border-slate-700 p-2 rounded-lg text-center text-sm font-bold transition-all ${isEditMode ? 'focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-white' : 'text-slate-500 opacity-70'}`}
                                                value={att.otDays || ''} 
                                                placeholder="0"
                                                onChange={e => handleUpdate(emp.id, 'otDays', +e.target.value)} 
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <input 
                                                title={`OT Hours for ${emp.name}`}
                                                aria-label={`OT Hours for ${emp.name}`}
                                                type="number" 
                                                disabled={!isEditMode || isLocked}
                                                className={`w-20 bg-[#0f172a] border border-slate-700 p-2 rounded-lg text-center text-sm font-bold transition-all ${isEditMode ? 'focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-white' : 'text-slate-500 opacity-70'}`}
                                                value={att.otHours || ''} 
                                                placeholder="0"
                                                onChange={e => handleUpdate(emp.id, 'otHours', +e.target.value)} 
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-right bg-sky-900/5 font-black text-sky-400 text-base">
                                            ₹ {otAmount.toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="flex justify-between items-center bg-sky-900/10 border border-sky-500/20 p-4 rounded-xl">
                 <div className="flex items-center gap-3 text-sky-300">
                    <Calculator size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">Formula: (Rate * Days) + ((Rate / 8) * Hours)</span>
                 </div>
                 <div className="text-[10px] text-slate-500 italic">
                    * Rates are calculated based on your statutory policy configuration.
                 </div>
            </div>
        </div>
    );
};

export default OverTimeManager;
