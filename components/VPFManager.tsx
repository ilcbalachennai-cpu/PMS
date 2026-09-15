import React, { useState, useMemo, useRef } from 'react';
import { Upload, Save, Lock, Search, Download, Edit2, Landmark, CheckCircle2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { Employee, VPFRecord, PayrollResult, CompanyProfile, StatutoryConfig } from '../types';
import { generateTemplateWorkbook, getStandardFileName } from '../services/reportService';
import { formatIndianNumber } from '../utils/formatters';

interface VPFManagerProps {
    employees: Employee[];
    vpfRecords: VPFRecord[];
    setVpfRecords: (records: VPFRecord[]) => void;
    month: string;
    year: number;
    savedRecords: PayrollResult[];
    companyProfile: CompanyProfile;
    config?: StatutoryConfig;
    justSaved?: boolean;
    setJustSaved?: (val: boolean | ((prev: boolean) => boolean)) => void;
}

const VPFManager: React.FC<VPFManagerProps> = (props) => {
    const {
        employees,
        vpfRecords,
        setVpfRecords,
        month,
        year,
        savedRecords,
        companyProfile,
    } = props;

    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [localJustSaved, setLocalJustSaved] = useState(false);
    const justSaved = props.justSaved !== undefined ? props.justSaved : localJustSaved;
    const setJustSaved = (val: boolean | ((prev: boolean) => boolean)) => {
        const nextVal = typeof val === 'function' ? val(justSaved) : val;
        setLocalJustSaved(nextVal);
        props.setJustSaved?.(nextVal);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        type: 'confirm' | 'success' | 'error';
        title: string;
        message: string;
    }>({ isOpen: false, type: 'confirm', title: '', message: '' });

    const isLocked = useMemo(() => {
        return savedRecords.some(r => r.month === month && r.year === year && r.status === 'Finalized');
    }, [savedRecords, month, year]);

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const filteredEmployees = useMemo(() => {
        const monthIdx = months.indexOf(month);
        const periodStart = new Date(year, monthIdx, 1);
        periodStart.setHours(0, 0, 0, 0);

        return employees.filter(emp => {
            let isActive = true;
            if (emp.dol) {
                const [y, m, d] = emp.dol.split('-').map(Number);
                const dolDate = new Date(y, m - 1, d);
                dolDate.setHours(0, 0, 0, 0);
                isActive = dolDate >= periodStart;
            }
            if (!isActive) return false;

            const searchMatch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                emp.id.toLowerCase().includes(searchTerm.toLowerCase());
            return searchMatch;
        });
    }, [employees, month, year, searchTerm]);

    const getVPFRecord = (empId: string): VPFRecord => {
        const existing = vpfRecords.find(v => v.employeeId === empId && v.month === month && v.year === year);
        if (existing) return existing;
        return {
            companyId: companyProfile.id,
            employeeId: empId,
            month,
            year,
            vpfAmount: 0,
            pfAdvRepay: 0
        };
    };

    const handleUpdate = (empId: string, field: 'vpfAmount' | 'pfAdvRepay', value: string | number) => {
        if (isLocked || justSaved) return;

        const existingIndex = vpfRecords.findIndex(v => v.employeeId === empId && v.month === month && v.year === year);
        const numVal = value === '' || value === undefined || value === null ? 0 : Math.max(0, Number(value));
        const cleanVal = isNaN(numVal) ? 0 : Math.round(numVal);

        let newRecords = [...vpfRecords];
        if (existingIndex >= 0) {
            newRecords[existingIndex] = { ...newRecords[existingIndex], [field]: cleanVal };
        } else {
            newRecords.push({
                companyId: companyProfile.id,
                employeeId: empId,
                month,
                year,
                vpfAmount: field === 'vpfAmount' ? cleanVal : 0,
                pfAdvRepay: field === 'pfAdvRepay' ? cleanVal : 0
            });
        }
        setVpfRecords(newRecords);
    };

    const handleSave = () => {
        if (isLocked) return;
        setIsSaving(true);
        setTimeout(() => {
            localStorage.setItem('app_vpf_records', JSON.stringify(vpfRecords));
            setIsSaving(false);
            setJustSaved(true);
            setModalState({
                isOpen: true,
                type: 'success',
                title: 'Records Updated',
                message: 'VPF & PF Advance Refund register has been saved successfully.'
            });
        }, 500);
    };

    const downloadTemplate = async () => {
        const headers = ["Employee ID", "Name", "VPF", "PF_Adv_Repay"];
        const data = filteredEmployees.map(e => {
            const rec = vpfRecords.find(v => v.employeeId === e.id && v.month === month && v.year === year);
            return [e.id, e.name, rec?.vpfAmount || 0, rec?.pfAdvRepay || 0];
        });
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "VPF_PF_Adv");
        const fileName = getStandardFileName('VPF_PF_Adv_Template', companyProfile, month, year);
        await generateTemplateWorkbook(wb, fileName, companyProfile.establishmentName);
    };

    const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isLocked || justSaved) return;
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) throw new Error("File is empty");

                const newRecords = [...vpfRecords.filter(v => !(v.month === month && v.year === year))];
                let count = 0;

                data.forEach((row: any) => {
                    const id = String(row['Employee ID'] || row['ID'] || row['Emp ID'] || '').trim();
                    if (!id) return;

                    const vpfKeys = ['VPF', 'VPF Amount', 'VPF (₹)', 'vpf'];
                    let vpfVal = 0;
                    for (const k of vpfKeys) {
                        if (row[k] !== undefined) {
                            const val = Number(row[k]);
                            if (!isNaN(val)) { vpfVal = Math.round(Math.max(0, val)); break; }
                        }
                    }

                    const pfAdvKeys = ['PF_Adv_Repay', 'PF Adv Repay', 'PF Advance Repay', 'Advance Refund', 'PF_Adv_Refund', 'pfAdvRepay'];
                    let pfAdvVal = 0;
                    for (const k of pfAdvKeys) {
                        if (row[k] !== undefined) {
                            const val = Number(row[k]);
                            if (!isNaN(val)) { pfAdvVal = Math.round(Math.max(0, val)); break; }
                        }
                    }

                    if (vpfVal > 0 || pfAdvVal > 0) {
                        newRecords.push({
                            companyId: companyProfile.id,
                            employeeId: id,
                            month,
                            year,
                            vpfAmount: vpfVal,
                            pfAdvRepay: pfAdvVal
                        });
                        count++;
                    }
                });

                setVpfRecords(newRecords);
                setModalState({
                    isOpen: true,
                    type: 'success',
                    title: 'Import Successful',
                    message: `Successfully imported ${count} VPF & PF Advance Refund records.`
                });
            } catch (err) {
                setModalState({
                    isOpen: true,
                    type: 'error',
                    title: 'Import Error',
                    message: 'Failed to parse Excel file. Please ensure columns "Employee ID", "VPF", and "PF_Adv_Repay" exist.'
                });
            } finally {
                setIsUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    // Aggregate totals
    const totalVPF = useMemo(() => {
        return filteredEmployees.reduce((acc, emp) => {
            const rec = vpfRecords.find(v => v.employeeId === emp.id && v.month === month && v.year === year);
            return acc + (rec?.vpfAmount || 0);
        }, 0);
    }, [filteredEmployees, vpfRecords, month, year]);

    const totalPFAdvRepay = useMemo(() => {
        return filteredEmployees.reduce((acc, emp) => {
            const rec = vpfRecords.find(v => v.employeeId === emp.id && v.month === month && v.year === year);
            return acc + (rec?.pfAdvRepay || 0);
        }, 0);
    }, [filteredEmployees, vpfRecords, month, year]);

    return (
        <div className="space-y-6">
            {isLocked && (
                <div className="bg-amber-900/20 border border-amber-700 p-4 rounded-xl flex gap-3 items-center animate-in fade-in slide-in-from-top-2">
                    <Lock size={20} className="text-amber-400" />
                    <div>
                        <h3 className="font-bold text-amber-200 text-sm">Register Locked</h3>
                        <p className="text-xs text-amber-300/80">Payroll is finalized for this month. Records cannot be modified.</p>
                    </div>
                </div>
            )}

            {/* Ribbon Bar */}
            <div className="bg-[#1e293b] p-3 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-purple-900/30 border border-purple-500/20 text-purple-400">
                        <Landmark size={20} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-white uppercase tracking-tight">VPF & PF Advance Refund</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{month} {year}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
                        <input
                            type="text"
                            title="Search Employee Records"
                            aria-label="Search Employee Records"
                            placeholder="Search employee..."
                            className="pl-8 pr-3 py-1.5 bg-[#0f172a] border border-slate-700 rounded-lg text-[10px] font-bold text-white outline-none focus:ring-1 focus:ring-blue-500 w-36 tracking-tight"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {!isLocked && (
                        <>
                            <button
                                title={justSaved ? 'Enable Editing' : 'Save Records'}
                                aria-label={justSaved ? 'Enable Editing' : 'Save Records'}
                                onClick={justSaved ? () => setJustSaved(false) : handleSave}
                                disabled={isSaving}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-[12px] transition-all shadow-lg ${
                                    justSaved
                                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-900/20'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20'
                                }`}
                            >
                                {isSaving ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                                ) : justSaved ? (
                                    <Edit2 size={15} />
                                ) : (
                                    <Save size={15} />
                                )}
                                {justSaved ? 'Modify Records' : 'Save Records'}
                            </button>

                            <button
                                title="Download Import Template"
                                aria-label="Download Import Template"
                                onClick={downloadTemplate}
                                className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg font-bold text-[12px] border border-slate-600 transition-all"
                            >
                                <Download size={15} /> Download Template
                            </button>

                            <button
                                title="Import from Excel"
                                aria-label="Import from Excel"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading || justSaved}
                                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-[12px] transition-all shadow-lg disabled:opacity-50 disabled:bg-slate-700"
                            >
                                <Upload size={15} /> Import Data
                            </button>
                            <input
                                type="file"
                                title="Excel File Input"
                                aria-label="Excel File Input"
                                ref={fileInputRef}
                                onChange={handleExcelImport}
                                className="hidden"
                                accept=".xlsx, .xls"
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-[#1e293b] rounded-xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#0f172a] text-slate-400 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
                            <tr>
                                <th className="p-3 w-12 text-center">#</th>
                                <th className="p-3 w-28">Emp ID</th>
                                <th className="p-3">Employee Name</th>
                                <th className="p-3">Designation</th>
                                <th className="p-3">Department</th>
                                <th className="p-3 w-40 text-right">VPF (₹)</th>
                                <th className="p-3 w-44 text-right">PF Adv Repay (₹)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-xs text-slate-200">
                            {filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500 font-bold">
                                        No active employees found matching the search criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredEmployees.map((emp, idx) => {
                                    const rec = getVPFRecord(emp.id);
                                    const inputDisabled = isLocked || justSaved;

                                    return (
                                        <tr key={emp.id} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="p-3 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                                            <td className="p-3 font-mono font-bold text-blue-400">{emp.id}</td>
                                            <td className="p-3 font-semibold text-white">
                                                {emp.name}
                                                {emp.isPFExempt && (
                                                    <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40">
                                                        PF Exempt
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-slate-400">{emp.designation || '-'}</td>
                                            <td className="p-3 text-slate-400">{emp.division || emp.department || '-'}</td>
                                            <td className="p-3 text-right">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    placeholder="0"
                                                    disabled={inputDisabled}
                                                    value={rec.vpfAmount > 0 ? rec.vpfAmount : ''}
                                                    onChange={e => handleUpdate(emp.id, 'vpfAmount', e.target.value)}
                                                    className="w-32 bg-[#0f172a] border border-slate-700 rounded px-2.5 py-1 text-right font-mono font-bold text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:bg-slate-800/40 transition-colors"
                                                />
                                            </td>
                                            <td className="p-3 text-right">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    placeholder="0"
                                                    disabled={inputDisabled}
                                                    value={rec.pfAdvRepay > 0 ? rec.pfAdvRepay : ''}
                                                    onChange={e => handleUpdate(emp.id, 'pfAdvRepay', e.target.value)}
                                                    className="w-32 bg-[#0f172a] border border-slate-700 rounded px-2.5 py-1 text-right font-mono font-bold text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:bg-slate-800/40 transition-colors"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {filteredEmployees.length > 0 && (
                            <tfoot className="bg-[#0f172a] text-xs font-bold text-slate-300 border-t-2 border-slate-700 sticky bottom-0 z-10">
                                <tr>
                                    <td colSpan={5} className="p-3 text-right uppercase tracking-wider text-slate-400 font-black">
                                        Total ({filteredEmployees.length} Employees):
                                    </td>
                                    <td className="p-3 text-right font-mono text-purple-400 font-black text-sm">
                                        ₹ {formatIndianNumber(totalVPF)}
                                    </td>
                                    <td className="p-3 text-right font-mono text-purple-400 font-black text-sm">
                                        ₹ {formatIndianNumber(totalPFAdvRepay)}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Custom Modal for Alerts */}
            {modalState.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-[#1e293b] border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${modalState.type === 'success' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/20' : 'bg-red-900/30 text-red-400 border border-red-500/20'}`}>
                                {modalState.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">{modalState.title}</h3>
                                <p className="text-xs text-slate-400">{modalState.message}</p>
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VPFManager;
