import React, { useState, useMemo, useRef } from 'react';
import { Upload, Save, Edit2, Download, Calculator } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, OTRecord, PayrollResult, StatutoryConfig, CompanyProfile } from '../types';
import { generateTemplateWorkbook, getStandardFileName } from '../services/reportService';

interface OTManagerProps {
    employees: Employee[];
    otRecords: OTRecord[];
    setOTRecords: React.Dispatch<React.SetStateAction<OTRecord[]>>;
    config: StatutoryConfig;
    month: string;
    year: number;
    savedRecords: PayrollResult[];
    companyProfile: CompanyProfile;
}

const OTManager: React.FC<OTManagerProps> = ({
    employees,
    otRecords,
    setOTRecords,
    config,
    month,
    year,
    savedRecords,
    companyProfile
}) => {
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [justSaved, setJustSaved] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const daysInMonth = new Date(year, months.indexOf(month) + 1, 0).getDate();

    // Check if current month is locked
    const isLocked = useMemo(() => {
        return savedRecords.some(r => r.month === month && r.year === year && r.status === 'Finalized');
    }, [savedRecords, month, year]);

    // Filter Active Employees
    const activeEmployees = useMemo(() => {
        const monthIdx = months.indexOf(month);
        const periodStart = new Date(year, monthIdx, 1);
        return employees.filter(emp => {
            if (!emp.dol) return true;
            const [y, m, d] = emp.dol.split('-').map(Number);
            const dolDate = new Date(y, m - 1, d);
            return dolDate >= periodStart;
        });
    }, [employees, month, year]);

    // Helper to get or create OT record
    const getOTRecord = (empId: string) => {
        return otRecords.find(r => r.employeeId === empId && r.month === month && r.year === year) ||
            { employeeId: empId, month, year, otDays: 0, otHours: 0, otRate: 0, otAmount: 0 };
    };

    // Calculate OT Rate for an employee
    const calculateOTRate = (emp: Employee) => {
        if (!config.enableOT) return 0;

        let baseAmount = 0;
        if (config.otComponents.basic) baseAmount += emp.basicPay;
        if (config.otComponents.da) baseAmount += (emp.da || 0);
        if (config.otComponents.retaining) baseAmount += (emp.retainingAllowance || 0);
        if (config.otComponents.hra) baseAmount += (emp.hra || 0);
        if (config.otComponents.conveyance) baseAmount += (emp.conveyance || 0);
        if (config.otComponents.washing) baseAmount += (emp.washing || 0);
        if (config.otComponents.attire) baseAmount += (emp.attire || 0);
        if (config.otComponents.special1) baseAmount += (emp.specialAllowance1 || 0);
        if (config.otComponents.special2) baseAmount += (emp.specialAllowance2 || 0);
        if (config.otComponents.special3) baseAmount += (emp.specialAllowance3 || 0);

        // Standard calculation: Sum / Days in Month
        // (This can be refined if we add calculationBase to config later, but current types have flat fields)
        return baseAmount / daysInMonth;
    };

    const handleUpdate = (empId: string, field: 'otDays' | 'otHours', value: number) => {
        if (isLocked) return;
        if (justSaved) setJustSaved(false);

        const emp = activeEmployees.find(e => e.id === empId);
        if (!emp) return;

        const rate = calculateOTRate(emp);
        const existingIdx = otRecords.findIndex(r => r.employeeId === empId && r.month === month && r.year === year);

        const current = getOTRecord(empId);
        const updatedRecord = { ...current, [field]: Math.max(0, value) };
        
        // Recalculate amount
        const totalDays = updatedRecord.otDays + (updatedRecord.otHours / 8);
        updatedRecord.otRate = rate;
        updatedRecord.otAmount = Math.round(rate * (config.otCalculationFactor || 1) * totalDays);

        if (existingIdx >= 0) {
            const newRecords = [...otRecords];
            newRecords[existingIdx] = updatedRecord;
            setOTRecords(newRecords);
        } else {
            setOTRecords([...otRecords, updatedRecord]);
        }
    };

    const handleSave = () => {
        if (isLocked) return;
        setIsSaving(true);
        // Persistence is handled by useSync in App.tsx
        setTimeout(() => {
            setIsSaving(false);
            setJustSaved(true);
        }, 800);
    };

    const downloadTemplate = async () => {
        const headers = ["Employee ID", "Name", "OT Days", "OT Hours"];
        const data = activeEmployees.map(emp => [emp.id, emp.name, 0, 0]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Overtime");
        const fileName = getStandardFileName('OT_Template', companyProfile, month, year);
        await generateTemplateWorkbook(wb, fileName);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isLocked) return;
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

                const newRecords = [...otRecords];
                data.forEach((row: any) => {
                    const empId = String(row['Employee ID'] || row['ID'] || '').trim();
                    if (!empId) return;

                    const emp = activeEmployees.find(e => e.id === empId);
                    if (!emp) return;

                    const rate = calculateOTRate(emp);
                    const otDays = Number(row['OT Days'] || 0);
                    const otHours = Number(row['OT Hours'] || 0);
                    const totalDays = otDays + (otHours / 8);
                    const otAmount = Math.round(rate * (config.otCalculationFactor || 1) * totalDays);

                    const idx = newRecords.findIndex(r => r.employeeId === empId && r.month === month && r.year === year);
                    const record: OTRecord = { employeeId: empId, month, year, otDays, otHours, otRate: rate, otAmount };

                    if (idx >= 0) newRecords[idx] = record;
                    else newRecords.push(record);
                });

                setOTRecords(newRecords);
                setJustSaved(false);
                alert("Import Successful");
            } catch (err) {
                console.error(err);
                alert("Error importing OT data.");
            } finally {
                setIsUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="space-y-6">
            <div className="bg-[#1e293b] p-3 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-blue-900/40 text-blue-400 rounded-lg border border-blue-500/20 shadow-inner">
                        <Calculator size={16} />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-widest mb-0.5">Active OT Policy <span className="text-sky-400 ml-1">({config.otCalculationFactor}x)</span></h4>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">
                            Rate Formula: <span className="text-sky-400 font-mono text-[13px] normal-case tracking-normal">(Sum / {daysInMonth}) × {config.otCalculationFactor}x × (Days + Hrs/8)</span>
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={justSaved ? () => setJustSaved(false) : handleSave}
                        disabled={isSaving || isLocked}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold transition-all shadow-lg text-[12px] ${justSaved
                            ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-900/20'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20'
                            }`}
                    >
                        {isSaving ? <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white" /> : (justSaved ? <Edit2 size={14} /> : <Save size={14} />)}
                        {justSaved ? 'Modify OT' : 'Save OT Records'}
                    </button>

                    <button onClick={downloadTemplate} className="flex items-center gap-1.5 bg-slate-700 text-slate-200 px-3 py-2 rounded-lg font-bold transition-all border border-slate-600 hover:bg-slate-600 text-[12px]">
                        <Download size={15} /> Template
                    </button>

                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading || isLocked || justSaved} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg disabled:opacity-50 text-[12px]">
                        {isUploading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <Upload size={15} />}
                        Import OT
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx, .xls" title="Import OT Excel" aria-label="Import OT Excel" />
                </div>
            </div>


            <div className={`bg-[#1e293b] rounded-xl border border-slate-800 overflow-y-auto custom-scrollbar shadow-2xl max-h-[600px] ${isLocked ? 'opacity-80 pointer-events-none' : ''}`}>
                <table className="w-full text-left">
                    <thead className="bg-[#0f172a] text-sky-400 text-[10px] uppercase font-bold sticky top-0 z-10 shadow-md">
                        <tr>
                            <th className="px-5 py-3">Employee Identity</th>
                            <th className="px-3 py-3 text-right">Daily Rate</th>
                            <th className="px-3 py-3 text-center">OT Days</th>
                            <th className="px-3 py-3 text-center">OT Hours</th>
                            <th className="px-5 py-3 text-right">OT Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {activeEmployees.map(emp => {
                            const record = getOTRecord(emp.id);
                            const disabled = isLocked || justSaved;

                            return (
                                <tr key={emp.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="text-xs font-bold text-white uppercase">{emp.name}</div>
                                        <div className="text-[9px] text-slate-500 font-mono">{emp.id}</div>
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        <div className="text-[11px] text-sky-400 font-mono font-bold">₹ {Math.round(calculateOTRate(emp)).toLocaleString()}</div>
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <input
                                            type="number"
                                            disabled={disabled}
                                            className="w-16 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-center text-[11px] text-white font-mono outline-none focus:border-blue-500 disabled:opacity-50"
                                            value={record.otDays}
                                            onChange={e => handleUpdate(emp.id, 'otDays', +e.target.value || 0)}
                                            title={`OT Days for ${emp.name}`}
                                            aria-label={`OT Days for ${emp.name}`}
                                        />
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <input
                                            type="number"
                                            disabled={disabled}
                                            className="w-16 bg-[#0f172a] border border-slate-700 rounded px-2 py-1 text-center text-[11px] text-white font-mono outline-none focus:border-blue-500 disabled:opacity-50"
                                            value={record.otHours}
                                            onChange={e => handleUpdate(emp.id, 'otHours', +e.target.value || 0)}
                                            title={`OT Hours for ${emp.name}`}
                                            aria-label={`OT Hours for ${emp.name}`}
                                        />
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <div className="text-xs font-black text-emerald-400 font-mono">₹ {record.otAmount.toLocaleString()}</div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {activeEmployees.length === 0 && (
                <div className="text-center py-10 text-slate-500 text-sm">No active employees found.</div>
            )}
        </div>
    );
};

export default OTManager;
