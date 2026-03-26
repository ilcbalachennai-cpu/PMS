import React, { useState, useEffect, useRef } from 'react';
import { 
    Layout, Plus, Trash2, Save, ArrowRight, Type, ClipboardList, Play
} from 'lucide-react';
import { 
    Employee, PayrollResult, CompanyProfile, 
    DynamicMISReportTemplate, DynamicMISReportRow 
} from '../types';
import { generateDynamicMISReport } from '../services/reportService';

interface DynamicMISReportBuilderProps {
    employees: Employee[];
    payrollHistory: PayrollResult[];
    month: string;
    year: number;
    companyProfile: CompanyProfile;
    showAlert: (type: any, title: string, message: string) => void;
    finalizedPeriods: { month: string; year: number }[];
}

const STORAGE_KEY = 'app_mis_reports';
const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const DynamicMISReportBuilder: React.FC<DynamicMISReportBuilderProps> = ({
    employees,
    payrollHistory,
    month,
    year,
    companyProfile,
    showAlert,
    finalizedPeriods
}) => {
    const [templates, setTemplates] = useState<DynamicMISReportTemplate[]>([]);
    const [activeTemplate, setActiveTemplate] = useState<DynamicMISReportTemplate | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [openC2CRowId, setOpenC2CRowId] = useState<string | null>(null);
    const rowsContainerRef = useRef<HTMLDivElement>(null);
    
    // Period Range selection
    const [fromPeriod, setFromPeriod] = useState({ month, year });
    const [toPeriod, setToPeriod] = useState({ month, year });

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try { setTemplates(JSON.parse(stored)); } catch (e) { console.error(e); }
        }
    }, []);

    const saveTemplates = (updated: DynamicMISReportTemplate[]) => {
        setTemplates(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    };

    const handleCreateNew = () => {
        const newTemplate: DynamicMISReportTemplate = {
            id: crypto.randomUUID(),
            name: '',
            rows: [
                { id: crypto.randomUUID(), rowNumber: 1, label: 'Employee ID', sourceType: 'Employee', sourceKey: 'id', calcRefs: [] },
                { id: crypto.randomUUID(), rowNumber: 2, label: 'Employee Name', sourceType: 'Employee', sourceKey: 'name', calcRefs: [] }
            ],
            createdAt: new Date().toISOString()
        };
        setActiveTemplate(newTemplate);
        setIsEditing(true);
    };

    const addRow = () => {
        if (!activeTemplate) return;
        const nextRowNumber = activeTemplate.rows.length + 1;
        const newRow: DynamicMISReportRow = {
            id: crypto.randomUUID(),
            rowNumber: nextRowNumber,
            label: '',
            sourceType: 'PayrollEnd',
            sourceKey: 'earnings.total',
            calcRefs: [],
            operator: '-'
        };
        setActiveTemplate({ ...activeTemplate, rows: [...activeTemplate.rows, newRow] });
        
        // Auto-scroll to the new row
        setTimeout(() => {
            if (rowsContainerRef.current) {
                rowsContainerRef.current.scrollTo({
                    top: rowsContainerRef.current.scrollHeight,
                    behavior: 'smooth'
                });
            }
        }, 50);
    };

    const removeRow = (id: string) => {
        if (!activeTemplate) return;
        const updatedRows = activeTemplate.rows
            .filter(r => r.id !== id)
            .map((r, i) => ({ ...r, rowNumber: i + 1 }));
        setActiveTemplate({ ...activeTemplate, rows: updatedRows });
    };

    const updateRow = (id: string, field: keyof DynamicMISReportRow, value: any) => {
        if (!activeTemplate) return;
        setActiveTemplate({
            ...activeTemplate,
            rows: activeTemplate.rows.map(r => r.id === id ? { ...r, [field]: value } : r)
        });
    };

    const handleSaveTemplate = () => {
        if (!activeTemplate || !activeTemplate.name) {
            showAlert('error', 'Incomplete Template', 'Please provide a name for the template.');
            return;
        }
        const existingIndex = templates.findIndex(t => t.id === activeTemplate.id);
        const updated = existingIndex >= 0 
            ? templates.map(t => t.id === activeTemplate.id ? activeTemplate : t)
            : [...templates, activeTemplate];
        
        saveTemplates(updated);
        setIsEditing(false);
        setActiveTemplate(null);
        showAlert('success', 'Saved', `Report template "${activeTemplate.name}" saved.`);
    };

    const handleGenerate = async (template: DynamicMISReportTemplate) => {
        setIsGenerating(true);
        try {
            await generateDynamicMISReport(template, employees, payrollHistory, fromPeriod, toPeriod, companyProfile);
            // Success handled by generateDynamicMISReport
        } catch (e: any) {
            showAlert('error', 'Generation Failed', e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const dataSources = {
        Employee: [
            { key: 'id', label: 'Employee ID' },
            { key: 'name', label: 'Employee Name' },
            { key: 'gender', label: 'Gender' },
            { key: 'dob', label: 'Date of Birth' },
            { key: 'designation', label: 'Designation' },
            { key: 'department', label: 'Department' },
            { key: 'division', label: 'Division' },
            { key: 'branch', label: 'Branch' },
            { key: 'site', label: 'Site/Location' },
            { key: 'pan', label: 'PAN Number' },
            { key: 'aadhaarNumber', label: 'Aadhaar Number' },
            { key: 'uanc', label: 'UAN Number' },
            { key: 'pfNumber', label: 'PF Number' },
            { key: 'esiNumber', label: 'ESI Number' },
            { key: 'mobile', label: 'Mobile Number' },
            { key: 'email', label: 'Email ID' },
            { key: 'bankAccount', label: 'Bank Account' },
            { key: 'ifsc', label: 'IFSC Code' },
            { key: 'doj', label: 'Date of Joining' },
            { key: 'dol', label: 'Date of Leaving' }
        ],
        Payroll: [
            { key: 'daysInMonth', label: 'Days in Month' },
            { key: 'payableDays', label: 'Payable Days' },
            { key: 'earnings.basic', label: 'Basic' },
            { key: 'earnings.da', label: 'D.A.' },
            { key: 'earnings.retainingAllowance', label: 'Retaining Allowance' },
            { key: 'earnings.hra', label: 'H.R.A.' },
            { key: 'earnings.conveyance', label: 'Conveyance' },
            { key: 'earnings.washing', label: 'Washing' },
            { key: 'earnings.attire', label: 'Attire' },
            { key: 'earnings.special1', label: 'Special 1' },
            { key: 'earnings.special2', label: 'Special 2' },
            { key: 'earnings.special3', label: 'Special 3' },
            { key: 'earnings.bonus', label: 'Bonus' },
            { key: 'earnings.leaveEncashment', label: 'Leave Encashment' },
            { key: 'earnings.otAmount', label: 'OT Amount' },
            { key: 'earnings.total', label: 'Gross Pay' },
            { key: 'deductions.epf', label: 'PF (Employee)' },
            { key: 'deductions.vpf', label: 'VPF (Employee)' },
            { key: 'deductions.esi', label: 'ESI (Employee)' },
            { key: 'deductions.pt', label: 'Professional Tax' },
            { key: 'deductions.it', label: 'Income Tax' },
            { key: 'deductions.lwf', label: 'LWF (Employee)' },
            { key: 'deductions.advanceRecovery', label: 'Advance Recovery' },
            { key: 'deductions.fine', label: 'Fine/Damages' },
            { key: 'deductions.total', label: 'Total Deductions' },
            { key: 'employerContributions.epf', label: 'EPF Share (3.67%)' },
            { key: 'employerContributions.eps', label: 'EPS Share (8.33%)' },
            { key: 'employerContributions.totalPF', label: 'Sum of PF (Employer) + EPF (Employer)' },
            { key: 'employerContributions.esi', label: 'ESI (Employer)' },
            { key: 'employerContributions.lwf', label: 'LWF (Employer)' },
            { key: 'netPay', label: 'Net Salary' }
        ],
        ECR: [
            { key: 'epfWages', label: 'EPF Wages' },
            { key: 'epsWages', label: 'EPS Wages (Ceiled)' },
            { key: 'eeEPF', label: 'EE Share (EPF)' },
            { key: 'erEPF', label: 'ER Share (EPF - 3.67%)' },
            { key: 'erEPS', label: 'ER Share (EPS - 8.33%)' },
            { key: 'ncpDays', label: 'NCP Days' }
        ]
    };

    return (
        <div className="space-y-6">
            {!isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <button 
                        onClick={handleCreateNew}
                        className="h-48 border-2 border-dashed border-slate-800 rounded-3xl hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all flex flex-col items-center justify-center gap-4 text-slate-500 hover:text-indigo-400 group"
                    >
                        <div className="p-4 rounded-2xl bg-slate-800/50 group-hover:bg-indigo-500/10 transition-colors">
                            <Plus size={32} />
                        </div>
                        <span className="font-black uppercase tracking-widest text-xs">New MIS Template</span>
                    </button>

                    {templates.map(tmpl => (
                        <div key={tmpl.id} className="bg-[#1e293b] p-6 rounded-3xl border border-slate-800 shadow-xl hover:border-indigo-500/50 transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 rounded-2xl bg-indigo-900/30 text-indigo-400">
                                    <ClipboardList size={24} />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setActiveTemplate(tmpl); setIsEditing(true); }} className="p-2 text-slate-500 hover:text-indigo-400" title="Edit Template"><Layout size={18} /></button>
                                    <button onClick={() => {
                                        if (confirm('Delete this template?')) saveTemplates(templates.filter(t => t.id !== tmpl.id));
                                    }} className="p-2 text-slate-500 hover:text-red-400" title="Delete Template"><Trash2 size={18} /></button>
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">{tmpl.name}</h3>
                            <p className="text-xs text-slate-500 font-medium mb-6">{tmpl.rows.length} Configured Rows</p>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => handleGenerate(tmpl)}
                                    disabled={isGenerating}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20"
                                >
                                    {isGenerating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play size={14} fill="currentColor" />}
                                    Generate
                                </button>
                                <button 
                                    onClick={() => { setActiveTemplate(tmpl); setIsEditing(true); }}
                                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                                >
                                    Edit
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : activeTemplate && (
                <div className="space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 ml-1">Report Name</label>
                                <input 
                                    type="text"
                                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-sm text-[#FFD700] outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-[#FFD700]/50"
                                    value={activeTemplate.name}
                                    onChange={e => setActiveTemplate({...activeTemplate, name: e.target.value})}
                                    placeholder="e.g. Monthly Variance Analysis"
                                />
                            </div>

                            <div className="flex flex-col items-center">
                                <label className="block text-[10px] uppercase font-black text-slate-500 mb-4 tracking-widest">Comparison Period</label>
                                
                                <div className="flex items-center gap-8">
                                    <div className="space-y-2 w-48">
                                        <label className="block text-[9px] font-black text-[#FFD700] mb-1 uppercase tracking-tighter">Start Period</label>
                                        <select 
                                            className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-2.5 text-xs text-slate-300"
                                            value={`${fromPeriod.month} ${fromPeriod.year}`}
                                            onChange={e => {
                                                const [m, y] = e.target.value.split(' ');
                                                setFromPeriod({ month: m, year: parseInt(y) });
                                            }}
                                            title="Start Period"
                                        >
                                            {finalizedPeriods.length > 0 ? (
                                                finalizedPeriods.map(p => (
                                                    <option key={`${p.month} ${p.year}`} value={`${p.month} ${p.year}`}>
                                                        {p.month} {p.year}
                                                    </option>
                                                ))
                                            ) : (
                                                <option value={`${month} ${year}`}>{month} {year}</option>
                                            )}
                                        </select>
                                    </div>

                                    <div className="text-center flex flex-col items-center justify-center text-[#FFD700]">
                                        <ArrowRight size={24} className="mb-1" />
                                        <span className="text-sm font-black italic">Vs</span>
                                    </div>

                                    <div className="space-y-2 w-48">
                                        <label className="block text-[9px] font-black text-[#FFD700] mb-1 uppercase tracking-tighter">End Period</label>
                                        <select 
                                            className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-2.5 text-xs text-slate-300"
                                            value={`${toPeriod.month} ${toPeriod.year}`}
                                            onChange={e => {
                                                const [m, y] = e.target.value.split(' ');
                                                setToPeriod({ month: m, year: parseInt(y) });
                                            }}
                                            title="End Period"
                                        >
                                            {finalizedPeriods.length > 0 ? (
                                                finalizedPeriods.map(p => (
                                                    <option key={`${p.month} ${p.year}`} value={`${p.month} ${p.year}`}>
                                                        {p.month} {p.year}
                                                    </option>
                                                ))
                                            ) : (
                                                <option value={`${month} ${year}`}>{month} {year}</option>
                                            )}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-indigo-900/30 text-indigo-400">
                                    <Type size={16} />
                                </div>
                                <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest">Row Configuration</h3>
                            </div>
                        </div>

                        <div 
                            ref={rowsContainerRef}
                            className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar"
                        >
                            {activeTemplate.rows.map((row) => (
                                <div key={row.id} className="bg-[#0f172a] p-4 rounded-xl border border-slate-700 flex flex-col gap-3 group">
                                    <div className="flex flex-wrap md:flex-nowrap items-center gap-4">
                                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500">
                                        {row.rowNumber}
                                    </div>
                                    
                                    <div className="flex-1 min-w-[200px]">
                                        <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-wider">Row Label</label>
                                        <input 
                                            type="text"
                                            className="w-full bg-[#1e293b] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-600"
                                            value={row.label}
                                            onChange={e => updateRow(row.id, 'label', e.target.value)}
                                            placeholder="Row Label"
                                        />
                                    </div>

                                    <div className="w-48">
                                        <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-wider">Source Category</label>
                                        <select 
                                            className="w-full bg-[#1e293b] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                                            value={row.sourceType}
                                            onChange={e => updateRow(row.id, 'sourceType', e.target.value)}
                                            title="Source Category"
                                        >
                                            <option value="Employee">Employee Profile</option>
                                            <option value="PayrollStart">Payroll (Start Period)</option>
                                            <option value="PayrollEnd">Payroll (End Period)</option>
                                            <option value="C2CStart">C2C Sum (Start Period)</option>
                                            <option value="C2CEnd">C2C Sum (End Period)</option>
                                            <option value="ECRStart">ECR (Start Period)</option>
                                            <option value="ECREnd">ECR (End Period)</option>
                                            <option value="Compare">Compare (Difference)</option>
                                            <option value="Percentage">Percentage (%)</option>
                                            <option value="Text">Static Text</option>
                                        </select>
                                    </div>

                                    <div className="flex-1 min-w-[200px]">
                                        {row.sourceType === 'Compare' || row.sourceType === 'Percentage' ? (
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-wider">Row A</label>
                                                    <select 
                                                        className="w-full bg-[#1e293b] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                                                        value={row.calcRefs[0] || ''}
                                                        onChange={e => updateRow(row.id, 'calcRefs', [parseInt(e.target.value), row.calcRefs[1] || 0])}
                                                        title="Calculation Row A"
                                                    >
                                                        <option value="">Select Row</option>
                                                        {activeTemplate.rows.filter(r => r.rowNumber < row.rowNumber).map(r => (
                                                            <option key={r.rowNumber} value={r.rowNumber}>Row {r.rowNumber}: {r.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="mt-4">
                                                    {row.sourceType === 'Compare' ? (
                                                        <select 
                                                            className="bg-[#1e293b] border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-400 outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                                            value={row.operator || '-'}
                                                            onChange={e => updateRow(row.id, 'operator', e.target.value)}
                                                            title="Select Operator"
                                                        >
                                                            <option value="+">+</option>
                                                            <option value="-">-</option>
                                                            <option value="*">*</option>
                                                            <option value="/">/</option>
                                                        </select>
                                                    ) : (
                                                        <div className="font-black text-xs text-slate-600">/</div>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-wider">Row B</label>
                                                    <select 
                                                        className="w-full bg-[#1e293b] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                                                        value={row.calcRefs[1] || ''}
                                                        onChange={e => updateRow(row.id, 'calcRefs', [row.calcRefs[0] || 0, parseInt(e.target.value)])}
                                                        title="Calculation Row B"
                                                    >
                                                        <option value="">Select Row</option>
                                                        {activeTemplate.rows.filter(r => r.rowNumber < row.rowNumber).map(r => (
                                                            <option key={r.rowNumber} value={r.rowNumber}>Row {r.rowNumber}: {r.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        ) : row.sourceType === 'C2CStart' || row.sourceType === 'C2CEnd' ? (
                                            <div className="relative">
                                                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-wider">C2C Field Selection</label>
                                                <button 
                                                    onClick={() => setOpenC2CRowId(openC2CRowId === row.id ? null : row.id)}
                                                    className="w-full bg-[#1e293b] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 flex items-center justify-between hover:border-slate-700 transition-colors"
                                                >
                                                    <span className="truncate">
                                                        {(row.sourceKeys || []).length === 0 
                                                            ? 'Select Fields to Sum' 
                                                            : `${(row.sourceKeys || []).length} Fields Selected`}
                                                    </span>
                                                    <Plus size={14} className={`text-slate-500 transition-transform ${openC2CRowId === row.id ? 'rotate-45' : ''}`} />
                                                </button>

                                                {openC2CRowId === row.id && (
                                                    <div className="absolute z-50 mt-1 w-full bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl p-3 max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Payroll Fields</div>
                                                            {dataSources.Payroll.filter(p => p.key.includes('.') || p.key === 'netPay').map(opt => {
                                                                const isChecked = (row.sourceKeys || []).includes(opt.key);
                                                                return (
                                                                    <label key={opt.key} className="flex items-center gap-3 cursor-pointer hover:bg-slate-800/50 p-2 rounded-lg transition-colors group/item">
                                                                        <input 
                                                                            type="checkbox"
                                                                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-1 focus:ring-indigo-500 focus:ring-offset-0 transition-all"
                                                                            checked={isChecked}
                                                                            onChange={(e) => {
                                                                                const currentKeys = row.sourceKeys || [];
                                                                                const newKeys = e.target.checked 
                                                                                    ? [...currentKeys, opt.key]
                                                                                    : currentKeys.filter(k => k !== opt.key);
                                                                                updateRow(row.id, 'sourceKeys', newKeys);
                                                                            }}
                                                                        />
                                                                        <span className={`text-xs transition-colors ${isChecked ? 'text-indigo-400 font-bold' : 'text-slate-400 group-hover/item:text-slate-300'}`}>
                                                                            {opt.label}
                                                                        </span>
                                                                    </label>
                                                                );
                                                            })}
                                                            <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-2 mb-1 px-1 border-t border-slate-800 pt-2">ECR / Statutory Fields</div>
                                                            {dataSources.ECR.map(opt => {
                                                                const isChecked = (row.sourceKeys || []).includes(opt.key);
                                                                return (
                                                                    <label key={opt.key} className="flex items-center gap-3 cursor-pointer hover:bg-slate-800/50 p-2 rounded-lg transition-colors group/item">
                                                                        <input 
                                                                            type="checkbox"
                                                                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-1 focus:ring-indigo-500 focus:ring-offset-0 transition-all"
                                                                            checked={isChecked}
                                                                            onChange={(e) => {
                                                                                const currentKeys = row.sourceKeys || [];
                                                                                const newKeys = e.target.checked 
                                                                                    ? [...currentKeys, opt.key]
                                                                                    : currentKeys.filter(k => k !== opt.key);
                                                                                updateRow(row.id, 'sourceKeys', newKeys);
                                                                            }}
                                                                        />
                                                                        <span className={`text-xs transition-colors ${isChecked ? 'text-indigo-400 font-bold' : 'text-slate-400 group-hover/item:text-slate-300'}`}>
                                                                            {opt.label}
                                                                        </span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-end">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenC2CRowId(null);
                                                                }}
                                                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors flex items-center gap-2"
                                                            >
                                                                <Save size={12} />
                                                                Save & Close
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : row.sourceType === 'Text' ? (
                                            <div>
                                                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-wider">Text Value</label>
                                                <input 
                                                    type="text"
                                                    className="w-full bg-[#1e293b] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                                                    value={row.sourceKey}
                                                    onChange={e => updateRow(row.id, 'sourceKey', e.target.value)}
                                                    title="Static Text Value"
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="block text-[9px] font-black text-slate-500 mb-1 uppercase tracking-wider">Data Field</label>
                                                <select 
                                                    className="w-full bg-[#1e293b] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                                                    value={row.sourceKey}
                                                    onChange={e => updateRow(row.id, 'sourceKey', e.target.value)}
                                                    title="Select Data Field"
                                                >
                                                    {(row.sourceType.startsWith('Payroll') ? dataSources.Payroll : 
                                                      row.sourceType.startsWith('ECR') ? dataSources.ECR : dataSources.Employee).map(opt => (
                                                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        onClick={() => removeRow(row.id)}
                                        className="p-2 text-slate-600 hover:text-rose-500 transition-colors"
                                        title="Remove Row"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    </div>

                                    {/* Grayscale Info Summary */}
                                    <div className="mt-1 flex items-center gap-2 border-t border-slate-800/10 pt-2 px-1">
                                        <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">Row Logic:</span>
                                        <span className="text-[10px] text-slate-600 font-medium italic">
                                            {row.sourceType === 'Compare' ? (
                                                row.operator === '+' ? `Add Row ${row.calcRefs[0] || '?'} and Row ${row.calcRefs[1] || '?'}` :
                                                row.operator === '*' ? `Multiply Row ${row.calcRefs[0] || '?'} by Row ${row.calcRefs[1] || '?'}` :
                                                row.operator === '/' ? `Divide Row ${row.calcRefs[0] || '?'} by Row ${row.calcRefs[1] || '?'}` :
                                                `Subtract Row ${row.calcRefs[1] || '?'} from Row ${row.calcRefs[0] || '?'}`
                                             ) :
                                             row.sourceType === 'Percentage' ? `Calculate (Row ${row.calcRefs[0] || '?'} / Row ${row.calcRefs[1] || '?'}) * 100` :
                                             row.sourceType === 'C2CStart' || row.sourceType === 'C2CEnd' ? `Sum of selected fields (${(row.sourceKeys || []).length} selected) from ${row.sourceType === 'C2CStart' ? 'Start' : 'End'} Period` :
                                             row.sourceType === 'Text' ? `Output static text: "${row.sourceKey}"` :
                                             `Pulls field "${row.sourceKey}" from ${row.sourceType.replace(/([A-Z])/g, ' $1').trim()}`}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-center pt-2">
                            <button 
                                onClick={addRow}
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
                            >
                                <Plus size={14} /> Add Row
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => { setIsEditing(false); setActiveTemplate(null); }}
                            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSaveTemplate}
                            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
                        >
                            <Save size={18} /> Save MIS Template
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DynamicMISReportBuilder;
