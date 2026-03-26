import React, { useState, useEffect } from 'react';
import {
    FileText, Plus, Trash2, Save, Download, Play, Layout, Settings2,
    ChevronUp, ChevronDown, Columns, Copy, Calendar
} from 'lucide-react';
import { DynamicReportTemplate, DynamicReportColumn, Employee, PayrollResult, CompanyProfile } from '../types';
import { generateDynamicReport } from '../services/reportService';
import { useSessionRecovery } from '../hooks/useSessionRecovery';

const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface DynamicReportBuilderProps {
    employees: Employee[];
    savedRecords: PayrollResult[];
    month: string;
    year: number;
    companyProfile: CompanyProfile;
    showAlert: (type: any, title: string, message: string) => void;
    finalizedPeriods: { month: string; year: number }[];
}

const STORAGE_KEY = 'app_custom_reports';

const DynamicReportBuilder: React.FC<DynamicReportBuilderProps> = ({
    employees,
    savedRecords,
    month,
    year,
    companyProfile,
    showAlert,
    finalizedPeriods
}) => {
    const [templates, setTemplates] = useState<DynamicReportTemplate[]>([]);
    const [activeTemplate, setActiveTemplate] = useState<DynamicReportTemplate | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Initialize templates from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setTemplates(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse templates', e);
            }
        }
    }, []);

    // Save templates to localStorage
    const saveTemplatesToStorage = (updated: DynamicReportTemplate[]) => {
        setTemplates(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    };

    const handleCreateNew = () => {
        const newTemplate: DynamicReportTemplate = {
            id: crypto.randomUUID(),
            name: '',
            type: '',
            ruleName: '',
            state: '',
            orientation: 'l',
            showTotals: true,
            columns: [
                { id: crypto.randomUUID(), header: 'SL No', sourceType: 'Auto', sourceKey: 'sl_no' },
                { id: crypto.randomUUID(), header: '', sourceType: 'Employee', sourceKey: 'id' },
                { id: crypto.randomUUID(), header: '', sourceType: 'Employee', sourceKey: 'name' }
            ],
            createdAt: new Date().toISOString()
        };
        setActiveTemplate(newTemplate);
        setIsEditing(true);
    };

    const [activeSelectorId, setActiveSelectorId] = useState<string | null>(null);

    // Active Session Recovery
    const { hasDraft, restoreDraft, clearDraft } = useSessionRecovery<DynamicReportTemplate>(
        'dynamic_report_builder',
        isEditing ? activeTemplate : null,
        (recovered) => {
            setActiveTemplate(recovered);
            setIsEditing(true);
            showAlert('info', 'Session Restored', 'Your unsaved work has been recovered.');
        }
    );

    const handleLoadIncrementPreset = () => {
        const fromM = activeTemplate?.fromMonth || month;
        const toM = activeTemplate?.toMonth || month;

        const preset: DynamicReportTemplate = {
            id: activeTemplate?.id || crypto.randomUUID(),
            name: 'Employee Increment Comparison Report',
            type: 'INCREMENT REGISTER',
            ruleName: 'Comparison between ' + fromM + ' and ' + toM,
            state: companyProfile.state || 'Tamil Nadu',
            orientation: 'l',
            showTotals: true,
            columns: [
                { id: crypto.randomUUID(), header: 'Sl No', sourceType: 'Auto', sourceKey: 'sl_no' },
                { id: crypto.randomUUID(), header: 'EmployeeID', sourceType: 'Employee', sourceKey: 'id' },
                { id: crypto.randomUUID(), header: 'Name', sourceType: 'Employee', sourceKey: 'name' },
                { id: crypto.randomUUID(), header: 'Gross ' + toM, sourceType: 'EndPeriodResult', sourceKey: 'earnings.total' },
                { id: crypto.randomUUID(), header: 'Gross ' + fromM, sourceType: 'StartPeriodResult', sourceKey: 'earnings.total' },
                { id: crypto.randomUUID(), header: 'Gross Increment', sourceType: 'Compare', sourceKey: 'gross_delta' },
                { id: crypto.randomUUID(), header: 'Increment %', sourceType: 'Percentage', sourceKey: 'gross_inc_pct' },
                { id: crypto.randomUUID(), header: 'PF ' + toM, sourceType: 'EndPeriodResult', sourceKey: 'deductions.epf' },
                { id: crypto.randomUUID(), header: 'PF ' + fromM, sourceType: 'StartPeriodResult', sourceKey: 'deductions.epf' },
                { id: crypto.randomUUID(), header: 'PF Increment %', sourceType: 'Percentage', sourceKey: 'pf_inc_pct' },
                { id: crypto.randomUUID(), header: 'ESI ' + toM, sourceType: 'EndPeriodResult', sourceKey: 'deductions.esi' },
                { id: crypto.randomUUID(), header: 'ESI ' + fromM, sourceType: 'StartPeriodResult', sourceKey: 'deductions.esi' },
                { id: crypto.randomUUID(), header: 'ESI Increment %', sourceType: 'Percentage', sourceKey: 'esi_inc_pct' },
                { id: crypto.randomUUID(), header: 'C2C %', sourceType: 'Percentage', sourceKey: 'c2c_inc_pct' },
            ],
            createdAt: new Date().toISOString()
        };
        setActiveTemplate(preset);
        setIsEditing(true);
        showAlert('success', 'Preset Loaded', 'The 14-column Increment Comparison layout has been applied.');
    };

    const handleSaveTemplate = () => {
        if (!activeTemplate) return;
        
        const existingIndex = templates.findIndex(t => t.id === activeTemplate.id);
        let updated: DynamicReportTemplate[];
        
        if (existingIndex >= 0) {
            updated = [...templates];
            updated[existingIndex] = activeTemplate;
        } else {
            updated = [...templates, activeTemplate];
        }
        
        saveTemplatesToStorage(updated);
        setIsEditing(false);
        clearDraft();
        showAlert('success', 'Template Saved', `Template "${activeTemplate.name}" has been saved successfully.`);
    };

    const handleDeleteTemplate = (id: string) => {
        const updated = templates.filter(t => t.id !== id);
        saveTemplatesToStorage(updated);
        if (activeTemplate?.id === id) {
            setActiveTemplate(null);
            setIsEditing(false);
        }
    };

    const handleDuplicateTemplate = (template: DynamicReportTemplate) => {
        const duplicated: DynamicReportTemplate = {
            ...template,
            id: crypto.randomUUID(),
            name: `${template.name} (Copy)`,
            createdAt: new Date().toISOString()
        };
        saveTemplatesToStorage([...templates, duplicated]);
    };

    const addColumn = () => {
        if (!activeTemplate) return;
        const newCol: DynamicReportColumn = {
            id: crypto.randomUUID(),
            header: '',
            sourceType: 'PayrollResult',
            sourceKey: 'netPay'
        };
        setActiveTemplate({
            ...activeTemplate,
            columns: [...activeTemplate.columns, newCol]
        });
    };

    const removeColumn = (id: string) => {
        if (!activeTemplate) return;
        setActiveTemplate({
            ...activeTemplate,
            columns: activeTemplate.columns.filter(c => c.id !== id)
        });
    };

    const updateColumn = (id: string, field: keyof DynamicReportColumn, value: string) => {
        if (!activeTemplate) return;
        setActiveTemplate({
            ...activeTemplate,
            columns: activeTemplate.columns.map(c => c.id === id ? { ...c, [field]: value } : c)
        });
    };

    const handleSourceTypeChange = (id: string, newType: DynamicReportColumn['sourceType']) => {
        if (!activeTemplate) return;
        
        let defaultKey = '';
        switch (newType) {
            case 'Auto': defaultKey = 'sl_no'; break;
            case 'Employee': defaultKey = 'id'; break;
            case 'PayrollResult': 
            case 'StartPeriodResult':
            case 'EndPeriodResult': defaultKey = 'netPay'; break;
            case 'OtherAllowance': 
            case 'OtherDeductions':
            case 'CustomText': defaultKey = ''; break;
        }

        setActiveTemplate({
            ...activeTemplate,
            columns: activeTemplate.columns.map(c => c.id === id ? { ...c, sourceType: newType, sourceKey: defaultKey } : c)
        });
    };

    const moveColumn = (index: number, direction: 'up' | 'down') => {
        if (!activeTemplate) return;
        const newCols = [...activeTemplate.columns];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newCols.length) return;
        
        const [removed] = newCols.splice(index, 1);
        newCols.splice(targetIndex, 0, removed);
        
        setActiveTemplate({ ...activeTemplate, columns: newCols });
    };

    const handleGenerate = async (template: DynamicReportTemplate) => {
        const fromM = template.fromMonth || month;
        const fromY = template.fromYear || year;
        const toM = template.toMonth || month;
        const toY = template.toYear || year;

        const isRangeReport = (fromM !== toM || fromY !== toY);

        // Define range months for validation
        const getMonthIdx = (m: string) => monthsArr.indexOf(m);
        const fromIdx = fromY * 12 + getMonthIdx(fromM);
        const toIdx = toY * 12 + getMonthIdx(toM);

        const periodResults = savedRecords.filter(r => {
            const rIdx = r.year * 12 + getMonthIdx(r.month);
            return rIdx >= fromIdx && rIdx <= toIdx;
        });

        if (periodResults.length === 0) {
            const rangeText = isRangeReport ? `${fromM} ${fromY} - ${toM} ${toY}` : `${month} ${year}`;
            showAlert('error', 'No Data', `No payroll records found for ${rangeText}.`);
            return;
        }

        setIsGenerating(true);
        try {
            await generateDynamicReport(template, periodResults, employees, month, year, companyProfile, { fromMonth: fromM, fromYear: fromY, toMonth: toM, toYear: toY });
            // Success handled by generateDynamicReport (opens file)
        } catch (e: any) {
            showAlert('error', 'Generation Failed', e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    // Source Options for UI
    const sourceOptions = {
        Employee: [
            { key: 'id', label: 'Employee ID' },
            { key: 'name', label: 'Name' },
            { key: 'designation', label: 'Designation' },
            { key: 'division', label: 'Division/Dept' },
            { key: 'bankAccount', label: 'Bank Acc No' },
            { key: 'ifsc', label: 'IFSC Code' },
            { key: 'pfNumber', label: 'PF Number' },
            { key: 'esiNumber', label: 'ESI Number' },
            { key: 'pan', label: 'PAN Card' },
            { key: 'aadhaarNumber', label: 'Aadhaar No' },
            { key: 'gender', label: 'Gender' },
            { key: 'dob', label: 'Date of Birth' },
            { key: 'doj', label: 'Date of Joining' },
            { key: 'basicPay', label: 'Basic Pay' },
            { key: 'da', label: 'D.A.' },
            { key: 'hra', label: 'H.R.A.' },
            { key: 'conveyance', label: 'Conveyance' },
            { key: 'retainingAllowance', label: 'Retaining' },
            { key: 'washing', label: 'Washing' },
            { key: 'attire', label: 'Attire' },
            { key: 'specialAllowance1', label: 'Special 1' },
            { key: 'specialAllowance2', label: 'Special 2' },
            { key: 'specialAllowance3', label: 'Special 3' },
            { key: 'grossWages', label: 'Gross Wages' },
            { key: 'dailyRate', label: 'Daily Rate' }
        ],
        PayrollResult: [
            { key: 'payableDays', label: 'Payable Days' },
            { key: 'earnings.basic', label: 'Basic Pay' },
            { key: 'earnings.da', label: 'D.A.' },
            { key: 'earnings.retainingAllowance', label: 'Retaining' },
            { key: 'earnings.hra', label: 'H.R.A.' },
            { key: 'earnings.conveyance', label: 'Conveyance' },
            { key: 'earnings.washing', label: 'Washing' },
            { key: 'earnings.attire', label: 'Attire' },
            { key: 'earnings.special1', label: 'Special 1' },
            { key: 'earnings.special2', label: 'Special 2' },
            { key: 'earnings.special3', label: 'Special 3' },
            { key: 'earnings.bonus', label: 'Bonus' },
            { key: 'earnings.leaveEncashment', label: 'Leave Encash' },
            { key: 'earnings.otAmount', label: 'OT' },
            { key: 'earnings.total', label: 'Gross Earnings' },
            { key: 'deductions.epf', label: 'PF (Employee)' },
            { key: 'deductions.esi', label: 'ESI (Employee)' },
            { key: 'deductions.pt', label: 'Prof. Tax' },
            { key: 'deductions.it', label: 'Income Tax (TDS)' },
            { key: 'deductions.advanceRecovery', label: 'Adv. Recovery' },
            { key: 'deductions.fine', label: 'Fine/Damage' },
            { key: 'deductions.total', label: 'Total Deductions' },
            { key: 'netPay', label: 'Net Payable' },
            { key: 'total_c2c', label: 'Total C2C (Gross+Er Contrib)' },
            { key: 'employerContributions.epf', label: 'PF (Employer)' },
            { key: 'employerContributions.eps', label: 'EPS (Employer)' },
            { key: 'employerContributions.esi', label: 'ESI (Employer)' }
        ],
        StartPeriodResult: [
            { key: 'payableDays', label: 'Payable Days' },
            { key: 'earnings.basic', label: 'Basic Pay' },
            { key: 'earnings.da', label: 'D.A.' },
            { key: 'earnings.retainingAllowance', label: 'Retaining' },
            { key: 'earnings.hra', label: 'H.R.A.' },
            { key: 'earnings.conveyance', label: 'Conveyance' },
            { key: 'earnings.washing', label: 'Washing' },
            { key: 'earnings.attire', label: 'Attire' },
            { key: 'earnings.special1', label: 'Special 1' },
            { key: 'earnings.special2', label: 'Special 2' },
            { key: 'earnings.special3', label: 'Special 3' },
            { key: 'earnings.bonus', label: 'Bonus' },
            { key: 'earnings.leaveEncashment', label: 'Leave Encash' },
            { key: 'earnings.total', label: 'Gross Earnings' },
            { key: 'deductions.epf', label: 'PF (Employee)' },
            { key: 'deductions.esi', label: 'ESI (Employee)' },
            { key: 'deductions.pt', label: 'Prof. Tax' },
            { key: 'deductions.it', label: 'Income Tax (TDS)' },
            { key: 'total_c2c', label: 'Total C2C (Gross+Er Contrib)' }
        ],
        EndPeriodResult: [
            { key: 'payableDays', label: 'Payable Days' },
            { key: 'earnings.basic', label: 'Basic Pay' },
            { key: 'earnings.da', label: 'D.A.' },
            { key: 'earnings.retainingAllowance', label: 'Retaining' },
            { key: 'earnings.hra', label: 'H.R.A.' },
            { key: 'earnings.conveyance', label: 'Conveyance' },
            { key: 'earnings.washing', label: 'Washing' },
            { key: 'earnings.attire', label: 'Attire' },
            { key: 'earnings.special1', label: 'Special 1' },
            { key: 'earnings.special2', label: 'Special 2' },
            { key: 'earnings.special3', label: 'Special 3' },
            { key: 'earnings.bonus', label: 'Bonus' },
            { key: 'earnings.leaveEncashment', label: 'Leave Encash' },
            { key: 'earnings.total', label: 'Gross Earnings' },
            { key: 'deductions.epf', label: 'PF (Employee)' },
            { key: 'deductions.esi', label: 'ESI (Employee)' },
            { key: 'deductions.pt', label: 'Prof. Tax' },
            { key: 'deductions.it', label: 'Income Tax (TDS)' },
            { key: 'total_c2c', label: 'Total C2C (Gross+Er Contrib)' }
        ],
        Auto: [
            { key: 'sl_no', label: 'Serial Number (Auto)' },
            { key: 'month_days', label: 'Std Days in the Month' }
        ],
        CustomText: [],
        OtherAllowance: [
            { key: 'earnings.da', label: 'D.A.' },
            { key: 'earnings.hra', label: 'H.R.A.' },
            { key: 'earnings.conveyance', label: 'Conveyance' },
            { key: 'earnings.washing', label: 'Washing' },
            { key: 'earnings.attire', label: 'Attire' },
            { key: 'earnings.retainingAllowance', label: 'Retaining' },
            { key: 'earnings.special1', label: 'Special 1' },
            { key: 'earnings.special2', label: 'Special 2' },
            { key: 'earnings.special3', label: 'Special 3' },
            { key: 'earnings.bonus', label: 'Bonus' },
            { key: 'earnings.leaveEncashment', label: 'Leave Encash' },
            { key: 'earnings.otAmount', label: 'OT Amount' }
        ],
        OtherDeductions: [
            { key: 'deductions.pt', label: 'Prof. Tax' },
            { key: 'deductions.it', label: 'Income Tax' },
            { key: 'deductions.advanceRecovery', label: 'Adv. Recovery' },
            { key: 'deductions.fine', label: 'Fine/Damage' },
            { key: 'deductions.otherDeduction', label: 'Other Deduction' }
        ],
        Compare: [
            { key: 'increment_amount', label: 'Increment Amount (MoM)' },
            { key: 'gross_delta', label: 'Gross Wage Delta' },
            { key: 'pf_delta', label: 'Employer PF Delta' },
            { key: 'esi_delta', label: 'Employer ESI Delta' },
            { key: 'c2c_delta', label: 'C2C Variance (MoM)' },
            { key: 'statutory_impact', label: 'Statutory Impact (Er Delta)' }
        ],
        Percentage: [
            { key: 'increment_pct', label: 'Increment % (MoM)' },
            { key: 'gross_inc_pct', label: 'Gross Inc % (MoM)' },
            { key: 'pf_inc_pct', label: 'PF Inc % (MoM)' },
            { key: 'esi_inc_pct', label: 'ESI Inc % (MoM)' },
            { key: 'c2c_inc_pct', label: 'C2C % Change (MoM)' },
            { key: 'bonus_percentage', label: 'Bonus % calculation' },
            { key: 'ot_percentage', label: 'OT % calculation' }
        ]
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Actions */}
            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-indigo-900/30 border border-indigo-500/20 text-indigo-400">
                        <Layout size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight">Dynamic Form Builder</h2>
                        <p className="text-xs text-slate-400 font-medium">Create custom statutory registers & forms</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!isEditing && (
                        <button 
                            onClick={handleLoadIncrementPreset}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 rounded-xl font-bold text-sm transition-all shadow-lg"
                        >
                            <FileText size={18} /> Increment Preset
                        </button>
                    )}
                    {!isEditing && (
                        <button 
                            onClick={handleCreateNew}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-indigo-500/20"
                        >
                            <Plus size={18} /> New Template
                        </button>
                    )}
                </div>
            </div>

            {hasDraft && !isEditing && (
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 flex items-center justify-between group animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                            <Layout size={24} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-100 italic">Unsaved Session Detected</h4>
                            <p className="text-xs text-slate-400 font-medium">We found work from your last session that wasn't saved.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={clearDraft}
                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-wider"
                        >
                            Discard
                        </button>
                        <button 
                            onClick={restoreDraft}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 uppercase tracking-wider"
                        >
                            <Play size={14} fill="currentColor" /> Restore Session
                        </button>
                    </div>
                </div>
            )}

            {isEditing && activeTemplate ? (
                <div className="space-y-6 animate-in zoom-in-95 duration-300">
                    {/* Template Settings */}
                    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Settings2 size={16} className="text-indigo-400" />
                            <h3 className="text-sm font-bold text-slate-200">Form Configuration</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-[10px] uppercase font-black text-slate-500 mb-1 ml-1">Form Name</label>
                                <input 
                                    type="text"
                                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-slate-500/80"
                                    value={activeTemplate.name}
                                    onChange={e => setActiveTemplate({...activeTemplate, name: e.target.value})}
                                    placeholder="e.g. FORM B"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase font-black text-slate-500 mb-1 ml-1">Report Type</label>
                                <input 
                                    type="text"
                                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-slate-500/80"
                                    value={activeTemplate.type}
                                    onChange={e => setActiveTemplate({...activeTemplate, type: e.target.value})}
                                    placeholder="e.g. PAY REGISTER"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase font-black text-slate-500 mb-1 ml-1">Rule/Act Name</label>
                                <input 
                                    type="text"
                                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-slate-500/80"
                                    value={activeTemplate.ruleName}
                                    onChange={e => setActiveTemplate({...activeTemplate, ruleName: e.target.value})}
                                    placeholder="e.g. Rule 3B of TN Act"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase font-black text-slate-500 mb-1 ml-1">State</label>
                                <input 
                                    type="text"
                                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-slate-500/80"
                                    value={activeTemplate.state}
                                    onChange={e => setActiveTemplate({...activeTemplate, state: e.target.value})}
                                    placeholder="e.g. Tamil Nadu"
                                />
                            </div>
                            <div>
                                <label htmlFor="orientation-select" className="block text-[10px] uppercase font-black text-slate-500 mb-1 ml-1">Orientation</label>
                                <select 
                                    id="orientation-select"
                                    title="Choose report orientation"
                                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    value={activeTemplate.orientation || 'l'}
                                    onChange={e => setActiveTemplate({...activeTemplate, orientation: e.target.value as 'p' | 'l'})}
                                >
                                    <option value="l">Landscape (Wide)</option>
                                    <option value="p">Portrait (Tall)</option>
                                </select>
                            </div>
                        </div>

                        {/* Period Range Selection */}
                        <div className="pt-4 border-t border-slate-800/50">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Calendar size={12} className="text-indigo-400" />
                                Period of Report (Range Selection)
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="block text-[10px] uppercase font-black text-slate-500 ml-1">From Period</label>
                                    <select 
                                        className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
                                        value={`${activeTemplate.fromMonth || month} ${activeTemplate.fromYear || year}`}
                                        onChange={e => {
                                            const [m, y] = e.target.value.split(' ');
                                            setActiveTemplate({...activeTemplate, fromMonth: m, fromYear: parseInt(y)});
                                        }}
                                        title="From Period"
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
                                <div className="space-y-3">
                                    <label className="block text-[10px] uppercase font-black text-slate-500 ml-1">To Period</label>
                                    <select 
                                        className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
                                        value={`${activeTemplate.toMonth || month} ${activeTemplate.toYear || year}`}
                                        onChange={e => {
                                            const [m, y] = e.target.value.split(' ');
                                            setActiveTemplate({...activeTemplate, toMonth: m, toYear: parseInt(y)});
                                        }}
                                        title="To Period"
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
                            <p className="text-[10px] text-slate-500 mt-3 italic">* If left unchanged, the current active period ({month} {year}) will be used for generation.</p>
                        </div>
                    </div>

                    {/* Column Builder */}
                    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Columns size={16} className="text-indigo-400" />
                            <h3 className="text-sm font-bold text-slate-200">Defined Columns</h3>
                        </div>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {activeTemplate.columns.map((col, idx) => (
                                <div key={col.id} className="bg-[#0f172a] p-4 rounded-xl border border-slate-700 flex flex-wrap md:flex-nowrap items-center gap-4 group">
                                    <div className="flex items-center gap-1 text-slate-600">
                                        <button onClick={() => moveColumn(idx, 'up')} className="hover:text-indigo-400" disabled={idx === 0} title="Move Up"><ChevronUp size={16} /></button>
                                        <button onClick={() => moveColumn(idx, 'down')} className="hover:text-indigo-400" disabled={idx === activeTemplate.columns.length - 1} title="Move Down"><ChevronDown size={16} /></button>
                                    </div>
                                    
                                    <div className="flex-1 min-w-[150px]">
                                        <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase">Column Header</label>
                                        <input 
                                            type="text"
                                            className="w-full bg-[#1e293b] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500/80"
                                            value={col.header}
                                            onChange={e => updateColumn(col.id, 'header', e.target.value)}
                                            placeholder="Enter header name"
                                            title="Column Header"
                                        />
                                    </div>

                                    <div className="w-40">
                                        <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase">Source Category</label>
                                        <select 
                                            className="w-full bg-[#1e293b] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                                            value={col.sourceType}
                                            onChange={e => handleSourceTypeChange(col.id, e.target.value as any)}
                                            title="Select Source Category"
                                        >
                                            <option value="Auto">Automatic</option>
                                            <option value="Employee">Employee Profile</option>
                                            {activeTemplate.fromMonth && activeTemplate.toMonth && activeTemplate.fromMonth !== activeTemplate.toMonth ? (
                                                <>
                                                    <option value="StartPeriodResult">Start Period ({activeTemplate.fromMonth})</option>
                                                    <option value="EndPeriodResult">End Period ({activeTemplate.toMonth})</option>
                                                </>
                                            ) : (
                                                <option value="PayrollResult">Payroll Data</option>
                                            )}
                                            <option value="CustomText">Create Text</option>
                                            <option value="Compare">Compare Periods</option>
                                            <option value="Percentage">Percentage Calculation</option>
                                            <option value="OtherAllowance">Other Allowance</option>
                                            <option value="OtherDeductions">Other Deduction</option>
                                        </select>
                                    </div>

                                    <div className="flex-1 min-w-[200px]">
                                        <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase">
                                            {col.sourceType === 'OtherAllowance' || col.sourceType === 'OtherDeductions' ? 'Select Components' : 'Data Field'}
                                        </label>
                                        
                                        {col.sourceType === 'CustomText' ? (
                                            <input 
                                                type="text"
                                                className="w-full bg-[#1e293b] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500/80"
                                                value={col.sourceKey}
                                                onChange={e => updateColumn(col.id, 'sourceKey', e.target.value.substring(0, 15))}
                                                placeholder="Enter text (max 15)"
                                                maxLength={15}
                                            />
                                        ) : (col.sourceType === 'OtherAllowance' || col.sourceType === 'OtherDeductions') ? (
                                            <div className="space-y-2">
                                                {activeSelectorId === col.id ? (
                                                    <div className="bg-[#1e293b] border border-indigo-500/30 rounded-lg p-2 shadow-xl animate-in fade-in slide-in-from-top-1">
                                                        <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto custom-scrollbar mb-2">
                                                            {(sourceOptions as any)[col.sourceType].map((opt: any) => {
                                                                const selected = col.sourceKey.split(',').includes(opt.key);
                                                                return (
                                                                    <label key={opt.key} className="flex items-center gap-1.5 cursor-pointer group/opt p-1 hover:bg-slate-800/50 rounded transition-colors">
                                                                        <input 
                                                                            type="checkbox"
                                                                            className="w-3 h-3 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                                                                            checked={selected}
                                                                            onChange={() => {
                                                                                const current = col.sourceKey ? col.sourceKey.split(',') : [];
                                                                                const updated = selected 
                                                                                    ? current.filter(k => k !== opt.key)
                                                                                    : [...current, opt.key];
                                                                                updateColumn(col.id, 'sourceKey', updated.filter(Boolean).join(','));
                                                                            }}
                                                                        />
                                                                        <span className={`text-[10px] whitespace-nowrap ${selected ? 'text-indigo-400 font-bold' : 'text-slate-400 font-medium'}`}>{opt.label}</span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                        <button 
                                                            onClick={() => setActiveSelectorId(null)}
                                                            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold transition-colors shadow-lg shadow-indigo-600/20"
                                                        >
                                                            Sum & Close
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => setActiveSelectorId(col.id)}
                                                        className="w-full flex items-center justify-between bg-[#1e293b] border border-slate-800 rounded-lg px-3 py-1.5 text-left group hover:border-indigo-500/50 transition-all"
                                                    >
                                                        <span className="text-xs text-slate-300">
                                                            {col.sourceKey ? `Sum of ${col.sourceKey.split(',').length} components` : 'Select components to sum'}
                                                        </span>
                                                        <span className="text-[10px] text-indigo-400 font-bold group-hover:underline">Edit</span>
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <select 
                                                className="w-full bg-[#1e293b] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                                                value={col.sourceKey}
                                                onChange={e => updateColumn(col.id, 'sourceKey', e.target.value)}
                                                title="Select Data Field"
                                            >
                                                {(sourceOptions as any)[col.sourceType].map((opt: any) => (
                                                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    <button 
                                        onClick={() => removeColumn(col.id)}
                                        className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                                        title="Remove Column"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}

                            {/* Add Column Button inside the scrollable area */}
                            <button 
                                onClick={addColumn}
                                className="w-full py-4 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-2 font-bold text-xs"
                            >
                                <Plus size={18} /> Add New Column
                            </button>
                        </div>

                        {/* Totals Toggle */}
                        <div className="pt-4 border-t border-slate-800/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <label htmlFor="show-totals-toggle" className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        id="show-totals-toggle"
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={activeTemplate.showTotals !== false}
                                        onChange={e => setActiveTemplate({...activeTemplate, showTotals: e.target.checked})}
                                        title="Toggle Totals Row"
                                    />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                                <span className="text-xs font-bold text-slate-300">Generate Totals Row at Bottom (Sum and Close)</span>
                            </div>
                            <p className="text-[10px] text-slate-500 italic">Adds a summary row for all numerical columns</p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => { setIsEditing(false); setActiveTemplate(null); }}
                            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSaveTemplate}
                            className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20"
                        >
                            <Save size={18} /> Save Template
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.length === 0 ? (
                        <div className="col-span-full bg-[#1e293b] border-2 border-dashed border-slate-800 rounded-3xl p-12 text-center space-y-4">
                            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto text-slate-600">
                                <Layout size={32} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-300">No Templates Found</h3>
                                <p className="text-sm text-slate-500">Create your first custom report template to get started.</p>
                            </div>
                            <button 
                                onClick={handleCreateNew}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm"
                            >
                                Get Started
                            </button>
                        </div>
                    ) : (
                        templates.map(tmpl => (
                            <div key={tmpl.id} className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden group hover:border-indigo-500/50 transition-all hover:translate-y-[-2px]">
                                <div className="p-5 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="p-2 rounded-lg bg-indigo-900/20 text-indigo-400">
                                            <FileText size={20} />
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleDuplicateTemplate(tmpl)} className="p-1.5 text-slate-400 hover:text-white" title="Duplicate"><Copy size={16} /></button>
                                            <button onClick={() => { setActiveTemplate(tmpl); setIsEditing(true); }} className="p-1.5 text-slate-400 hover:text-indigo-400" title="Edit"><Settings2 size={16} /></button>
                                            <button onClick={() => handleDeleteTemplate(tmpl.id)} className="p-1.5 text-slate-400 hover:text-red-400" title="Delete"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h3 className="text-lg font-bold text-white leading-tight">{tmpl.name}</h3>
                                        <p className="text-xs text-indigo-400 font-bold">{tmpl.state} - {tmpl.type}</p>
                                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{tmpl.ruleName}</p>
                                    </div>

                                    <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                                        <div className="text-[10px] text-slate-500 font-medium">
                                            {tmpl.columns.length} Columns
                                        </div>
                                        <button 
                                            onClick={() => handleGenerate(tmpl)}
                                            disabled={isGenerating}
                                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50"
                                        >
                                            {isGenerating ? <div className="animate-spin rounded-full h-3 w-3 border-2 border-white/30 border-t-white" /> : <Play size={12} />} 
                                            Generate
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default DynamicReportBuilder;
