import React, { useState } from 'react';
import { Mail, FileBarChart, PieChart, Info, Plus, FileText, Settings2, Trash2, Calendar, Layers, CheckCircle2, Lock, ChevronUp, ChevronDown, Play, Loader2 } from 'lucide-react';
import { PayrollResult, Employee, CompanyProfile } from '../../types';
import { generateDynamicReportPDF, openSavedReport } from '../../services/reportService';
import { sendPayslipEmail } from '../../services/mailService';

interface ColumnDef {
  id: string;
  heading: string;
  source: 'Automatic' | 'Employee Profile' | 'Payroll Data' | 'Create Text' | 'Compare Periods' | 'Percentage Calculation' | 'Other Allowance' | 'Other Deduction';
  field: string;
  order: number;
}

interface DynamicTemplate {
  id: string;
  templateName: string;
  formName: string;
  reportType: string;
  ruleName: string;
  stateName: string;
  orientation: string;
  columns: ColumnDef[];
  createdAt: number;
}

const FIELD_OPTIONS: Record<string, {label: string, value: string}[]> = {
  'Automatic': [
    { label: 'Serial Number (Auto)', value: 'serialNo' },
    { label: 'Custom Formula', value: 'custom' }
  ],
  'Employee Profile': [
    { label: 'Employee ID', value: 'employeeId' },
    { label: 'Name', value: 'name' },
    { label: 'Designation', value: 'designation' },
    { label: 'Division', value: 'division' },
    { label: 'DOJ', value: 'doj' },
    { label: 'Basic Salary (Profile)', value: 'basic_profile' },
    { label: 'Bank Account', value: 'bankAccount' },
    { label: 'UAN', value: 'uan' },
    { label: 'ESIC No', value: 'esic' }
  ],
  'Payroll Data': [
    { label: 'Gross Pay (Current)', value: 'gross' },
    { label: 'Gross Pay (Previous)', value: 'gross_start' },
    { label: 'Gross Pay (New)', value: 'gross_end' },
    { label: 'Net Pay (Current)', value: 'net' },
    { label: 'Net Pay (Previous)', value: 'net_start' },
    { label: 'Net Pay (New)', value: 'net_end' },
    { label: 'CtC (Current)', value: 'c2c' },
    { label: 'CtC (Previous)', value: 'c2c_start' },
    { label: 'CtC (New)', value: 'c2c_end' },
    { label: 'Basic', value: 'basic' },
    { label: 'HRA', value: 'hra' },
    { label: 'PF Deduction', value: 'pf' },
    { label: 'ESI Deduction', value: 'esi' },
    { label: 'Days Worked', value: 'days' }
  ],
  'Compare Periods': [
    { label: 'Gross Variance (Value)', value: 'gross_diff' },
    { label: 'Net Variance (Value)', value: 'net_diff' },
    { label: 'PF Variance (Value)', value: 'pf_diff' },
    { label: 'ESI Variance (Value)', value: 'esi_diff' },
    { label: 'CtC Variance (Value)', value: 'c2c_diff' }
  ],
  'Percentage Calculation': [
    { label: 'Gross Variance %', value: 'gross_percent' },
    { label: 'Net Variance %', value: 'net_percent' },
    { label: 'CtC Variance %', value: 'c2c_percent' },
    { label: 'PF Variance %', value: 'pf_percent' },
    { label: 'ESI Variance %', value: 'esi_percent' }
  ],
  'Create Text': [
    { label: 'Custom Text Value', value: 'custom_text' }
  ],
  'Other Allowance': [
    { label: 'Allowance Value', value: 'allowance_val' }
  ],
  'Other Deduction': [
    { label: 'Deduction Value', value: 'deduction_val' }
  ]
};

const getMonthsInRange = (from: string, to: string, allAvailable: string[]) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  if (!from || !to || from === 'No Frozen Data' || to === 'No Frozen Data') return [];
  
  const parse = (s: string) => {
    const [m, y] = s.split(' ');
    return { month: months.indexOf(m), year: parseInt(y), label: s };
  };

  const start = parse(from);
  const end = parse(to);
  
  // Create a list of all potential labels in order
  return allAvailable.filter(label => {
    const p = parse(label);
    const startVal = start.year * 12 + start.month;
    const endVal = end.year * 12 + end.month;
    const currentVal = p.year * 12 + p.month;
    
    return currentVal >= Math.min(startVal, endVal) && currentVal <= Math.max(startVal, endVal);
  }).reverse(); // Sort ASC for the dropdown
};

interface MISDashboardProps {
  payrollHistory: PayrollResult[];
  employees: Employee[];
  companyProfile: CompanyProfile;
  showAlert: any;
  config?: any;
}

const MISDashboard: React.FC<MISDashboardProps> = ({ companyProfile, payrollHistory, employees, showAlert }) => {
  const [activeTab, setActiveTab] = useState<'MAILING' | 'DYNAMIC_REPORT' | 'MIS_REPORT'>('DYNAMIC_REPORT');
  
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState<string>('January');
  
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [showPresetSuccess, setShowPresetSuccess] = useState(false);

  // Form Configuration State
  const [formName, setFormName] = useState('');
  const [reportType, setReportType] = useState('');
  const [ruleName, setRuleName] = useState('');
  const [stateName, setStateName] = useState('');
  const [orientation, setOrientation] = useState('Portrait (Standard)');
  const [fromPeriod, setFromPeriod] = useState(``);
  const [toPeriod, setToPeriod] = useState(``);
  const [isPresetLocked, setIsPresetLocked] = useState(false);
  const [successMode, setSuccessMode] = useState<'PRESET' | 'FRESH' | 'SAVE' | 'LOAD' | 'DELETE'>('PRESET');

  // New View Mode State
  const [viewMode, setViewMode] = useState<'GALLERY' | 'BUILDER'>('GALLERY');

  // Template Persistence State
  const [savedTemplates, setSavedTemplates] = useState<DynamicTemplate[]>([]);
  const [newlyAddedColumnId, setNewlyAddedColumnId] = useState<string | null>(null);

  // Focus newly added column header
  React.useEffect(() => {
    if (newlyAddedColumnId) {
      const element = document.getElementById(`col-header-${newlyAddedColumnId}`);
      if (element) {
        element.focus();
        setNewlyAddedColumnId(null);
      }
    }
  }, [newlyAddedColumnId]);

  // Common years and months
  const yearOptions = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 5 + i);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  // Calculate verified historical periods for Dynamic Reports based on finalized payroll records
  const availablePeriods = React.useMemo(() => {
    const finalized = payrollHistory.filter(r => r.status === 'Finalized');
    const uniqueMap = new Map<string, { month: number, year: number }>();
    
    finalized.forEach(r => {
      const label = `${r.month} ${r.year}`;
      if (!uniqueMap.has(label)) {
        uniqueMap.set(label, { month: months.indexOf(r.month), year: r.year });
      }
    });
    
    // Sort descending (newest first)
    const sorted = Array.from(uniqueMap.entries()).sort((a, b) => {
      if (a[1].year !== b[1].year) return b[1].year - a[1].year;
      return b[1].month - a[1].month;
    });
    
    return sorted.map(s => s[0]);
  }, [payrollHistory]);
  
  const displayPeriods = availablePeriods.length > 0 ? availablePeriods : ['No Frozen Data'];

  // Mailing State
  const [mailingPeriod, setMailingPeriod] = useState(availablePeriods[0] || '');
  const [selectedEmps, setSelectedEmps] = useState<string[]>([]);
  const [isMailing, setIsMailing] = useState(false);
  const [mailProgress, setMailProgress] = useState(0);
  const [mailStatus, setMailStatus] = useState('');
  const [mailSearch, setMailSearch] = useState('');

  // Sync mailingPeriod when availablePeriods changes
  React.useEffect(() => {
    if (!mailingPeriod && availablePeriods.length > 0) {
        setMailingPeriod(availablePeriods[0]);
    }
  }, [availablePeriods, mailingPeriod]);

  // Initialize from/to period if empty (Default to last two months)
  React.useEffect(() => {
      if (availablePeriods.length >= 2) {
          if (!fromPeriod) setFromPeriod(availablePeriods[1]); 
          if (!toPeriod) setToPeriod(availablePeriods[0]);
      } else if (availablePeriods.length === 1) {
          if (!fromPeriod) setFromPeriod(availablePeriods[0]);
          setToPeriod(availablePeriods[0]);
      } else {
          setFromPeriod('No Frozen Data');
          setToPeriod('No Frozen Data');
      }
  }, [availablePeriods]);

  // Load Saved Templates from DB on mount
  React.useEffect(() => {
    const loadTemplates = async () => {
      try {
        // @ts-ignore
        const res = await window.electronAPI.dbGet('dynamic_report_templates');
        if (res) {
          setSavedTemplates(JSON.parse(res));
        }
      } catch (e) {
        console.error('Failed to load saved templates:', e);
      }
    };
    loadTemplates();
  }, []);


  const handleLoadTemplate = (template: DynamicTemplate) => {
    setColumns(template.columns);
    setFormName(template.formName);
    setReportType(template.reportType);
    setRuleName(template.ruleName);
    setStateName(template.stateName);
    setOrientation(template.orientation);
    setIsPresetLocked(false);
    setSuccessMode('LOAD');
    setShowPresetSuccess(true);
    setViewMode('BUILDER');
  };

  const handleDeleteTemplate = async (id: string) => {
    const confirm = await new Promise(resolve => {
        showAlert('warning', 'Delete Template', 'Are you sure you want to permanently delete this template?', () => resolve(true), () => resolve(false), 'DELETE', 'CANCEL');
    });
    if (!confirm) return;

    const updated = savedTemplates.filter(t => t.id !== id);
    try {
       // @ts-ignore
       await window.electronAPI.dbSet('dynamic_report_templates', JSON.stringify(updated));
       setSavedTemplates(updated);
       setSuccessMode('DELETE');
       setShowPresetSuccess(true);
    } catch (e) {
      showAlert('error', 'Delete Failed', 'Could not delete the template from the database.');
    }
  };

  const handleGenerateReport = async () => {
    try {
      const headers = columns.map(c => c.heading);
      const dataRows: any[][] = [];
      
      const fromRecords = payrollHistory.filter(r => `${r.month} ${r.year}`.trim() === fromPeriod.trim());
      const toRecords = payrollHistory.filter(r => `${r.month} ${r.year}`.trim() === toPeriod.trim());

      let serialNo = 1;
      
      const empIdsInvolved = new Set([...fromRecords.map(r => r.employeeId), ...toRecords.map(r => r.employeeId)]);
      const involvedEmployees = employees.filter(e => empIdsInvolved.has(e.id));
      
      if (involvedEmployees.length === 0) {
          showAlert('error', 'No Data Found', `No finalized payroll data found for the selected periods (${fromPeriod} to ${toPeriod}). Please ensure payroll is 'Finalized' in the Process tab first.`);
          return;
      }
      
      for (const emp of involvedEmployees) {
          const fromRec = fromRecords.find(r => r.employeeId === emp.id);
          const toRec = toRecords.find(r => r.employeeId === emp.id);
          
          if (!fromRec && !toRec) continue;

          const row: any[] = [];
          
          for (const col of columns) {
              let val: any = '';
              
              if (col.source === 'Automatic') {
                  if (col.field === 'serialNo') val = serialNo;
              } else if (col.source === 'Employee Profile') {
                  val = emp[col.field as keyof Employee] || '';
              } else if (col.source === 'Payroll Data') {
                  if (col.field.includes('_') && !col.field.endsWith('_start') && !col.field.endsWith('_end')) {
                      // Dynamic month-based field (e.g., gross_October_2025)
                      const parts = col.field.split('_');
                      const baseField = parts[0];
                      const targetMonth = parts[1];
                      const targetYear = parts[2];
                      const targetLabel = `${targetMonth} ${targetYear}`;
                      
                      const monthRec = payrollHistory.find(r => r.employeeId === emp.id && `${r.month} ${r.year}` === targetLabel && r.status === 'Finalized');
                      
                      if (monthRec) {
                          if (baseField === 'gross') val = monthRec.earnings.total;
                          else if (baseField === 'c2c') val = monthRec.earnings.total + (monthRec.employerContributions?.epf || 0) + (monthRec.employerContributions?.esi || 0);
                          else if (baseField === 'net') val = monthRec.netPay;
                          else if (baseField === 'pf') val = monthRec.deductions.epf || 0;
                          else if (baseField === 'esi') val = monthRec.deductions.esi || 0;
                          else val = 0;
                      } else {
                          val = 0;
                      }
                  } else {
                      const isStart = col.field.endsWith('_start');
                      const isEnd = col.field.endsWith('_end');
                      const rec = isStart ? fromRec : (isEnd ? toRec : toRec);
                      
                      const baseField = col.field.replace('_start', '').replace('_end', '');
                      
                      if (rec) {
                          if (baseField === 'gross') val = rec.earnings.total;
                          else if (baseField === 'c2c') val = rec.earnings.total + (rec.employerContributions?.epf || 0) + (rec.employerContributions?.esi || 0);
                          else if (baseField === 'net') val = rec.netPay;
                          else if (baseField === 'pf') val = rec.deductions.epf || 0;
                          else if (baseField === 'esi') val = rec.deductions.esi || 0;
                          else val = 0;
                      } else {
                          val = 0;
                      }
                  }
              } else if (col.source === 'Compare Periods') {
                  const baseField = col.field.replace('_diff', '');
                  let startVal = 0;
                  let endVal = 0;
                  
                  if (fromRec) {
                      if (baseField === 'gross') startVal = fromRec.earnings.total;
                      else if (baseField === 'c2c') startVal = fromRec.earnings.total + (fromRec.employerContributions?.epf || 0) + (fromRec.employerContributions?.esi || 0);
                      else if (baseField === 'net') startVal = fromRec.netPay;
                      else if (baseField === 'pf') startVal = fromRec.deductions.epf || 0;
                      else if (baseField === 'esi') startVal = fromRec.deductions.esi || 0;
                  }
                  if (toRec) {
                      if (baseField === 'gross') endVal = toRec.earnings.total;
                      else if (baseField === 'c2c') endVal = toRec.earnings.total + (toRec.employerContributions?.epf || 0) + (toRec.employerContributions?.esi || 0);
                      else if (baseField === 'net') endVal = toRec.netPay;
                      else if (baseField === 'pf') endVal = toRec.deductions.epf || 0;
                      else if (baseField === 'esi') endVal = toRec.deductions.esi || 0;
                  }
                  val = endVal - startVal;
              } else if (col.source === 'Percentage Calculation') {
                  const baseField = col.field.replace('_percent', '');
                  let startVal = 0;
                  let endVal = 0;
                  
                  if (fromRec) {
                      if (baseField === 'gross') startVal = fromRec.earnings.total;
                      else if (baseField === 'c2c') startVal = fromRec.earnings.total + (fromRec.employerContributions?.epf || 0) + (fromRec.employerContributions?.esi || 0);
                      else if (baseField === 'net') startVal = fromRec.netPay;
                      else if (baseField === 'pf') startVal = fromRec.deductions.epf || 0;
                      else if (baseField === 'esi') startVal = fromRec.deductions.esi || 0;
                  }
                  if (toRec) {
                      if (baseField === 'gross') endVal = toRec.earnings.total;
                      else if (baseField === 'c2c') endVal = toRec.earnings.total + (toRec.employerContributions?.epf || 0) + (toRec.employerContributions?.esi || 0);
                      else if (baseField === 'net') endVal = toRec.netPay;
                      else if (baseField === 'pf') endVal = toRec.deductions.epf || 0;
                      else if (baseField === 'esi') endVal = toRec.deductions.esi || 0;
                  }
                  const diff = endVal - startVal;
                  val = startVal > 0 ? ((diff / startVal) * 100).toFixed(2) + '%' : (diff > 0 ? '100%' : '0%');
              } else {
                  val = '-';
              }
              
              row.push(val);
          }
          dataRows.push(row);
          serialNo++;
      }
      
      const fileName = `${(formName || 'Report').replace(/\s+/g, '_')}_${fromPeriod.replace(/\s+/g, '')}_${toPeriod.replace(/\s+/g, '')}`;
      const savedPath = await generateDynamicReportPDF(
          formName || 'Dynamic Report',
          [stateName, reportType].filter(Boolean).join(' - '),
          ruleName,
          headers,
          dataRows,
          fileName,
          orientation.includes('Landscape') ? 'l' : 'p',
          companyProfile,
          fromPeriod,
          toPeriod
      );

      if (savedPath) {
          showAlert(
              'success',
              'Report Generated Successfully',
              `The dynamic report '${formName}' has been saved to your reports folder.`,
              () => openSavedReport(savedPath),
              undefined,
              'Open Report & Folder',
              undefined,
              undefined,
              2
          );
      } else {
          showAlert('error', 'Generation Failed', 'An unexpected error occurred while saving the report. Please try again.');
      }
    } catch (err: any) {
        console.error("Failed to generate dynamic PDF", err);
        showAlert('error', 'Generation Error', err.message || 'An error occurred during report generation.');
    }
  };

  const handleIncrementPreset = () => {
    // Scaffold out the 14 columns as per the BPP_APP_V02.0.04 definition
    const presetColumns: ColumnDef[] = [
      { id: '1', heading: 'Sl No', source: 'Automatic', field: 'serialNo', order: 0 },
      { id: '2', heading: 'EmployeeID', source: 'Employee Profile', field: 'id', order: 1 },
      { id: '3', heading: 'Name', source: 'Employee Profile', field: 'name', order: 2 },
      { id: '4', heading: 'Designation', source: 'Employee Profile', field: 'designation', order: 3 },
      { id: '5', heading: 'Date of Join', source: 'Employee Profile', field: 'doj', order: 4 },
      { id: '6', heading: 'Basic Salary', source: 'Employee Profile', field: 'basicPay', order: 5 },
      { id: '7', heading: 'Old Gross', source: 'Payroll Data', field: 'gross_start', order: 6 },
      { id: '8', heading: 'New Gross', source: 'Payroll Data', field: 'gross_end', order: 7 },
      { id: '9', heading: 'Gross Increment', source: 'Compare Periods', field: 'gross_diff', order: 8 },
      { id: '10', heading: 'Increment %', source: 'Percentage Calculation', field: 'gross_percent', order: 9 },
      { id: '11', heading: 'Old CtC', source: 'Payroll Data', field: 'c2c_start', order: 10 },
      { id: '12', heading: 'New CtC', source: 'Payroll Data', field: 'c2c_end', order: 11 },
      { id: '13', heading: 'CtC Increment', source: 'Compare Periods', field: 'c2c_diff', order: 12 },
      { id: '14', heading: 'Net Variance', source: 'Compare Periods', field: 'net_diff', order: 13 }
    ];
    setColumns(presetColumns);
    
    // Set Form Config
    setFormName('Employee Increment Comparison');
    setReportType('INCREMENT REGISTER');
    setRuleName(`Comparison between ${fromPeriod} and ${toPeriod}`);
    setStateName('Tamil Nadu');
    setOrientation('Landscape (Wide)');
    setIsPresetLocked(true);
    
    setSuccessMode('PRESET');
    setShowPresetSuccess(true);
    setViewMode('BUILDER');
  };

  const handleAddColumn = () => {
    if (isPresetLocked) return;
    const newId = Date.now().toString();
    setColumns([...columns, { id: newId, heading: '', source: 'Employee Profile', field: '', order: columns.length }]);
    setNewlyAddedColumnId(newId);
  };

  const updateColumn = (id: string, updates: Partial<ColumnDef>) => {
    setColumns(columns.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeColumn = (id: string) => {
    if (isPresetLocked) return;
    setColumns(columns.filter(c => c.id !== id));
  };
  
  const moveColumn = (index: number, direction: 'up' | 'down') => {
    if (isPresetLocked) return;
    
    const newColumns = [...columns];
    if (direction === 'up' && index > 0) {
      const temp = newColumns[index];
      newColumns[index] = newColumns[index - 1];
      newColumns[index - 1] = temp;
    } else if (direction === 'down' && index < newColumns.length - 1) {
      const temp = newColumns[index];
      newColumns[index] = newColumns[index + 1];
      newColumns[index + 1] = temp;
    }
    setColumns(newColumns);
  };

  const handleStartFresh = () => {
    setColumns([]);
    setFormName('');
    setReportType('');
    setRuleName('');
    setStateName('');
    setOrientation('Portrait (Standard)');
    setIsPresetLocked(false);
    
    // Reset periods to defaults
    if (availablePeriods.length >= 2) {
        setFromPeriod(availablePeriods[1]); 
        setToPeriod(availablePeriods[0]);
    } else if (availablePeriods.length === 1) {
        setFromPeriod(availablePeriods[0]);
        setToPeriod(availablePeriods[0]);
    }

    setSuccessMode('FRESH');
    setShowPresetSuccess(true);
    setViewMode('BUILDER');
  };

  return (
    <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-500">
      
      {showPresetSuccess && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in-95">
           <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-emerald-500/30 flex flex-col items-center p-8 text-center gap-4">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mb-2">
                 <CheckCircle2 size={32} />
              </div>
              <h2 className="text-lg font-black text-white uppercase tracking-widest">
                 {successMode === 'PRESET' ? 'Preset Loaded' : (successMode === 'FRESH' ? 'Form Reset' : (successMode === 'SAVE' ? 'Template Saved' : (successMode === 'LOAD' ? 'Template Loaded' : 'Template Deleted')))}
              </h2>
              <p className="text-slate-400 text-sm">
                 {successMode === 'PRESET' ? 'Configuration successfully loaded into the builder.' : 
                  successMode === 'FRESH' ? 'All fields have been cleared. You can now start a new template.' :
                  successMode === 'SAVE' ? 'The current layout has been stored for future use.' :
                  successMode === 'LOAD' ? 'The selected template has been applied to the builder.' :
                  'The template has been permanently removed.'}
              </p>
              <button 
                onClick={() => setShowPresetSuccess(false)}
                className="mt-4 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl transition-colors shadow-lg shadow-emerald-900/50 w-full"
              >
                 Great!
              </button>
           </div>
        </div>
      )}

      <div className="flex items-center justify-between border-b items-end pb-4 border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center border border-teal-500/30 shadow-inner">
              <FileBarChart className="text-teal-400" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Management Info <span className="text-teal-400 font-light">MIS</span></h2>
              <p className="text-slate-400 text-sm font-medium">Employee Communication & Advanced Reporting</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[#1e293b] p-1.5 rounded-xl border border-slate-700 shadow-inner">
                 <select value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-teal-500 outline-none font-bold shadow-sm cursor-pointer" title="Report Month" aria-label="Report Month">
                   {months.map(m => <option key={m} value={m}>{m}</option>)}
                 </select>
                 <select value={reportYear} onChange={e => setReportYear(+e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-teal-500 outline-none font-bold shadow-sm cursor-pointer" title="Report Year" aria-label="Report Year">
                   {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                 </select>
                 <div className="px-3 text-slate-500 bg-slate-800/50 rounded-lg py-2"><Calendar size={18} /></div>
              </div>
          </div>
      </div>
      
      <div className="bg-[#1e293b] border border-slate-700/50 shadow-2xl rounded-2xl w-full p-6 flex-1 flex flex-col">
        <div className="flex bg-[#0f172a] p-1.5 rounded-xl mb-6 max-w-2xl border border-slate-800 shadow-inner">
          <button 
            onClick={() => setActiveTab('MAILING')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${activeTab === 'MAILING' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Mail size={16} /> Mailing
          </button>
          <button 
            onClick={() => setActiveTab('DYNAMIC_REPORT')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${activeTab === 'DYNAMIC_REPORT' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Layers size={16} /> Dynamic Report
          </button>
          <button 
            onClick={() => setActiveTab('MIS_REPORT')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${activeTab === 'MIS_REPORT' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <PieChart size={16} /> MIS Report
          </button>
        </div>
        
        <div className="text-white flex-1 flex flex-col min-h-0">
            {activeTab === 'DYNAMIC_REPORT' && (
                <div className="flex flex-col h-full animate-in fade-in duration-300">
                    {viewMode === 'GALLERY' ? (
                        /* GALLERY VIEW */
                        <div className="flex flex-col h-full space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 shadow-lg shadow-indigo-900/10">
                                        <Layers className="text-indigo-400" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-white tracking-tight uppercase">Dynamic Form Builder</h3>
                                        <p className="text-slate-400 text-sm font-medium">Select a standard preset or load your custom templates</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleStartFresh} 
                                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl flex items-center gap-3 transition-all shadow-xl shadow-indigo-900/40 border border-indigo-400/50 group"
                                >
                                    <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" /> 
                                    New Template
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pt-2 pr-2">
                                {/* Standard Presets Section */}
                                <div className="mb-10">
                                    <h4 className="text-[10px] font-black text-emerald-400/70 uppercase tracking-[0.25em] mb-6 flex items-center gap-4">
                                        <span className="shrink-0">Official Presets</span>
                                        <div className="h-px bg-emerald-500/20 flex-1"></div>
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="bg-[#1e293b]/50 border border-emerald-500/20 rounded-3xl p-6 hover:border-emerald-500/50 transition-all group relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                <FileText size={80} className="rotate-12" />
                                            </div>
                                            <div className="flex items-start justify-between mb-6">
                                                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                                                    <Lock size={20} />
                                                </div>
                                                <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full uppercase tracking-widest">Read-Only</span>
                                            </div>
                                            <h4 className="text-lg font-bold text-white mb-2 leading-tight">Employee Increment Comparison</h4>
                                            <p className="text-xs text-slate-400 mb-8 line-clamp-3 leading-relaxed">Standard BharatPay Pro layout for analyzing gross and CTC variances between payroll periods.</p>
                                            <button 
                                                onClick={handleIncrementPreset}
                                                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
                                            >
                                                Apply Preset
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Saved Templates Section */}
                                <div className="mb-10">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-6 flex items-center gap-4">
                                        <span className="shrink-0">My Custom Templates</span>
                                        <div className="h-px bg-slate-800 flex-1"></div>
                                    </h4>
                                    
                                    {savedTemplates.length === 0 ? (
                                        <div className="p-16 text-center bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                                            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700/50 opacity-50">
                                                <Layers size={24} className="text-slate-500" />
                                            </div>
                                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No Saved Templates Yet</p>
                                            <p className="text-[11px] text-slate-600 mt-2 italic">Any templates you save will appear here for one-click access</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {savedTemplates.map(t => (
                                                <div key={t.id} className="bg-[#1e293b]/50 border border-slate-700/50 rounded-3xl p-6 hover:border-indigo-500/50 transition-all group relative animate-in zoom-in-95 duration-200">
                                                    <div className="flex items-start justify-between mb-6">
                                                        <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                                                            <FileText size={20} />
                                                        </div>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                                                            className="p-2.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-400/10 rounded-xl"
                                                            title="Delete Template"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                    <h4 className="text-lg font-bold text-white mb-1 leading-tight truncate">{t.templateName}</h4>
                                                    <div className="flex items-center gap-3 mb-8">
                                                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{t.columns.length} Columns</span>
                                                        <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t.orientation.split(' ')[0]}</span>
                                                    </div>
                                                    
                                                    <div className="space-y-2 mb-8">
                                                        <div className="flex justify-between text-[11px]">
                                                            <span className="text-slate-500">Report Type</span>
                                                            <span className="text-slate-300 font-bold truncate max-w-[120px]">{t.reportType || '-'}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[11px]">
                                                            <span className="text-slate-500">Last Modified</span>
                                                            <span className="text-slate-300 font-bold">{new Date(t.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>

                                                    <button 
                                                        onClick={() => handleLoadTemplate(t)}
                                                        className="w-full py-3.5 bg-[#0f172a] hover:bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border border-slate-700 hover:border-indigo-500 shadow-lg flex items-center justify-center gap-2"
                                                    >
                                                        Edit Template
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* BUILDER VIEW */
                        <div className="flex flex-col h-full space-y-6 animate-in slide-in-from-right-4 duration-300">
                           <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                                <div className="flex items-center gap-6">
                                    <button 
                                        onClick={() => setViewMode('GALLERY')}
                                        className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-slate-700 transition-all shadow-lg"
                                        title="Back to Gallery"
                                    >
                                        <Plus className="rotate-45" size={24} />
                                    </button>
                                    <div>
                                        <h3 className="text-2xl font-black text-white tracking-tight uppercase">Template Editor</h3>
                                        <p className="text-slate-400 text-sm font-medium">Currently building: <span className="text-indigo-400 font-bold">{formName || 'New Dynamic Report'}</span></p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8 pb-10">
                                {/* Step 1: Period Selection (The Base) */}
                                <div className="bg-[#1e293b]/30 rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
                                     <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                     <h4 className="flex items-center gap-3 text-sm font-black text-slate-300 mb-8 uppercase tracking-[0.2em]"><Calendar size={20} className="text-blue-400" /> Step 1: Choose Reporting Period</h4>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl">
                                         <div className="space-y-3">
                                             <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] block pl-1">From Period (Start)</label>
                                             <select 
                                                value={fromPeriod} 
                                                onChange={e => { setFromPeriod(e.target.value); if(isPresetLocked) setRuleName(`Comparison between ${e.target.value} and ${toPeriod}`); }} 
                                                className="w-full bg-[#0f172a] border border-slate-700 rounded-2xl px-6 py-4 text-base font-bold text-white focus:ring-4 focus:ring-indigo-500/20 outline-none cursor-pointer shadow-inner transition-all appearance-none" 
                                                title="From Period"
                                                disabled={availablePeriods.length === 0}
                                             >
                                                 {displayPeriods.map(p => <option key={p} value={p}>{p}</option>)}
                                             </select>
                                         </div>
                                         <div className="space-y-3">
                                             <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] block pl-1">To Period (End)</label>
                                             <select 
                                                value={toPeriod} 
                                                onChange={e => { setToPeriod(e.target.value); if(isPresetLocked) setRuleName(`Comparison between ${fromPeriod} and ${e.target.value}`); }} 
                                                className="w-full bg-[#0f172a] border border-slate-700 rounded-2xl px-6 py-4 text-base font-bold text-white focus:ring-4 focus:ring-indigo-500/20 outline-none cursor-pointer shadow-inner transition-all appearance-none" 
                                                title="To Period"
                                                disabled={availablePeriods.length === 0}
                                             >
                                                 {displayPeriods.map(p => <option key={p} value={p}>{p}</option>)}
                                             </select>
                                         </div>
                                     </div>
                                     <div className="mt-8 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-3 max-w-2xl italic">
                                         <Info size={18} className="shrink-0" />
                                         <p>For standard "Month to Month" comparison, ensure both periods represent the months you wish to evaluate.</p>
                                     </div>
                                </div>

                                {/* Step 2: Form Configuration */}
                                <div className="bg-[#1e293b]/30 rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                                    <h4 className="flex items-center gap-3 text-sm font-black text-slate-300 mb-8 uppercase tracking-[0.2em]"><Settings2 size={20} className="text-indigo-400" /> Step 2: Report Configuration</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Form Name</label>
                                            <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" placeholder="e.g. Attendance Register" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Report Type</label>
                                            <input type="text" value={reportType} onChange={e => setReportType(e.target.value)} className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all uppercase" placeholder="FORM XX" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">State Context</label>
                                            <input type="text" value={stateName} onChange={e => setStateName(e.target.value)} className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" placeholder="e.g. Tamil Nadu" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Page Orientation</label>
                                            <select 
                                                title="Choose Page Orientation"
                                                value={orientation} 
                                                onChange={e => setOrientation(e.target.value)} 
                                                className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all cursor-pointer"
                                            >
                                                <option>Portrait (Standard)</option>
                                                <option>Landscape (Wide)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 3: Column Builder */}
                                <div className="bg-[#0f172a] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden min-h-[400px] flex flex-col">
                                    <div className="bg-slate-900 border-b border-slate-800 p-6">
                                        <h4 className="text-sm font-black text-slate-300 uppercase tracking-[0.2em]">Step 3: Define Output Columns</h4>
                                    </div>
                                    <div className="flex-1 p-6 space-y-4">
                                        {columns.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
                                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">No columns added yet</p>
                                                <button onClick={handleAddColumn} className="px-6 py-2 bg-slate-800 text-slate-400 text-xs font-bold rounded-lg border border-slate-700">Add First Column</button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3 pb-4">
                                                {columns.map((col, idx) => (
                                                    <div key={col.id} className="bg-[#1e293b] border border-slate-800 rounded-2xl p-4 flex items-center gap-4 group hover:border-slate-600 transition-all">
                                                         <div className="flex flex-col items-center gap-0.5 shrink-0 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
                                                            <button 
                                                                onClick={() => moveColumn(idx, 'up')} 
                                                                disabled={idx === 0 || isPresetLocked} 
                                                                className="p-1 text-slate-500 hover:text-indigo-400 disabled:opacity-10 transition-colors"
                                                                title="Move Up"
                                                            >
                                                                <ChevronUp size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={() => moveColumn(idx, 'down')} 
                                                                disabled={idx === columns.length - 1 || isPresetLocked} 
                                                                className="p-1 text-slate-500 hover:text-indigo-400 disabled:opacity-10 transition-colors"
                                                                title="Move Down"
                                                            >
                                                                <ChevronDown size={16} />
                                                            </button>
                                                         </div>
                                                        <div className="flex-[2] space-y-1">
                                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">Header</label>
                                                            <input 
                                                                id={`col-header-${col.id}`}
                                                                type="text" 
                                                                value={col.heading} 
                                                                onChange={e => updateColumn(col.id, { heading: e.target.value })} 
                                                                className="w-full bg-[#0f172a] border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:border-indigo-500/50 outline-none" 
                                                                placeholder="Column Header" 
                                                            />
                                                        </div>
                                                        <div className="flex-[2] space-y-1">
                                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">Category</label>
                                                            <select title="Select Column Data Source" value={col.source} onChange={e => updateColumn(col.id, { source: e.target.value as any, field: '' })} className="w-full bg-[#0f172a] border border-slate-800 rounded-lg px-4 py-2 text-sm text-white cursor-pointer">
                                                                {Object.keys(FIELD_OPTIONS).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="flex-[2] space-y-1">
                                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">Field</label>
                                                            <select value={col.field} onChange={e => updateColumn(col.id, { field: e.target.value })} className="w-full bg-[#0f172a] border border-slate-800 rounded-lg px-4 py-2 text-sm text-white cursor-pointer" title="Field">
                                                                <option value="">Select Field</option>
                                                                {(FIELD_OPTIONS[col.source] || []).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                                {col.source === 'Payroll Data' && getMonthsInRange(fromPeriod, toPeriod, availablePeriods).map(m => (
                                                                    <optgroup key={m} label={m}>
                                                                        <option value={`gross_${m.replace(' ', '_')}`}>Gross - {m}</option>
                                                                        <option value={`net_${m.replace(' ', '_')}`}>Net - {m}</option>
                                                                        <option value={`c2c_${m.replace(' ', '_')}`}>CtC - {m}</option>
                                                                        <option value={`pf_${m.replace(' ', '_')}`}>PF - {m}</option>
                                                                        <option value={`esi_${m.replace(' ', '_')}`}>ESI - {m}</option>
                                                                    </optgroup>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        {!isPresetLocked && (
                                                            <button onClick={() => removeColumn(col.id)} className="p-2 text-slate-600 hover:text-red-400 group-hover:bg-red-400/10 rounded-lg transition-all" title="Remove Column">
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}

                                                {!isPresetLocked && (
                                                    <button 
                                                        onClick={handleAddColumn} 
                                                        className="w-full py-4 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30 rounded-2xl transition-all shadow-lg shadow-indigo-900/30 flex items-center justify-center gap-3 group"
                                                    >
                                                        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                                                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">Add New Column</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-slate-900 border-t border-slate-800 p-8 flex items-center justify-between">
                                <div />
                                <button 
                                    onClick={handleGenerateReport} 
                                    disabled={columns.length === 0} 
                                    className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl text-sm font-black uppercase tracking-widest shadow-xl shadow-emerald-900/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    GENERATE PDF REPORT
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'MAILING' && (
                <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                <Mail size={24} className="text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight">Automated Mailing Center</h3>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bulk Pay Slip Dispatch</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                                <Calendar size={14} className="text-slate-500" />
                                <select 
                                    title="Select Month and Year for Mailing"
                                    aria-label="Select Month and Year for Mailing"
                                    className="bg-transparent text-xs font-bold text-slate-300 outline-none cursor-pointer"
                                    value={mailingPeriod}
                                    onChange={(e) => {
                                        setMailingPeriod(e.target.value);
                                        setSelectedEmps([]);
                                    }}
                                >
                                    {displayPeriods.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>

                            <button 
                                onClick={async () => {
                                    if (selectedEmps.length === 0) {
                                        showAlert('warning', 'No Recipients Selected', 'Please select at least one employee to send pay slips.');
                                        return;
                                    }
                                    
                                    const confirm = await new Promise(resolve => {
                                        const title = selectedEmps.length === 1 ? 'Individual Mail Dispatch' : 'Batch Dispatch Confirmation';
                                        const msg = selectedEmps.length === 1 ? 'You are about to send a pay slip via email. Would you like to proceed?' : `You are about to send ${selectedEmps.length} pay slips via email. Would you like to proceed?`;
                                        showAlert('warning', title, msg, () => resolve(true), () => resolve(false), 'PROCEED', 'CANCEL');
                                    });

                                    if (!confirm) return;

                                    setIsMailing(true);
                                    setMailProgress(0);
                                    let successCount = 0;
                                    let errorCount = 0;
                                    let firstError = '';

                                    const recordsToMail = payrollHistory.filter(r => `${r.month} ${r.year}` === mailingPeriod && selectedEmps.includes(r.employeeId));
                                    const month = mailingPeriod.split(' ')[0];
                                    const year = parseInt(mailingPeriod.split(' ')[1]);

                                    for (let i = 0; i < recordsToMail.length; i++) {
                                        const rec = recordsToMail[i];
                                        const emp = employees.find(e => e.id === rec.employeeId);
                                        setMailStatus(`Sending to ${emp?.name || rec.employeeId}...`);
                                        
                                        const res = await sendPayslipEmail(rec, employees, companyProfile, month, year);
                                        
                                        if (res.success) successCount++;
                                        else {
                                            errorCount++;
                                            if (!firstError) firstError = res.error || 'Unknown Error';
                                        }

                                        setMailProgress(Math.round(((i + 1) / recordsToMail.length) * 100));
                                    }

                                    setIsMailing(false);
                                    setMailStatus('');
                                    
                                    if (errorCount === 0) {
                                        showAlert('success', 'Mailing Complete', `Successfully dispatched ${successCount} pay slips via email.`);
                                    } else {
                                        showAlert('warning', 'Batch Partially Failed', `Dispatched: ${successCount}\nFailed: ${errorCount}\n\nReason: ${firstError}\n\nPlease verify SMTP configuration in Company Profile.`);
                                    }
                                    setSelectedEmps([]);
                                }}
                                disabled={isMailing || selectedEmps.length === 0 || mailingPeriod === 'No Frozen Data'}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-900/20 flex items-center gap-2"
                            >
                                <Play size={14} className={isMailing ? 'animate-pulse' : ''} /> {isMailing ? 'DISPATCHING...' : (selectedEmps.length === 1 ? 'SEND INDIVIDUAL MAIL' : 'SEND BULK MAIL')}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        <div className="p-4 bg-slate-900/30 border-b border-slate-800 flex items-center justify-between">
                            <div className="relative w-72">
                                <Settings2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input 
                                    type="text"
                                    title="Search Employees"
                                    aria-label="Search Employees"
                                    placeholder="Search Employee..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-indigo-500/50 transition-all font-medium"
                                    value={mailSearch}
                                    onChange={(e) => setMailSearch(e.target.value)}
                                />
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                                Selection: <span className="text-indigo-400">{selectedEmps.length}</span> Employees
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 z-10 bg-[#0f172a] shadow-sm">
                                    <tr className="border-b border-slate-800">
                                        <th className="p-4 w-12 text-center">
                                            <input 
                                                type="checkbox" 
                                                title="Select All Employees"
                                                aria-label="Select All Employees"
                                                className="w-4 h-4 rounded border-slate-700 bg-slate-900 accent-indigo-500"
                                                checked={(() => {
                                                    const filtered = employees.filter(e => {
                                                        const hasRecord = payrollHistory.some(r => r.employeeId === e.id && `${r.month} ${r.year}` === mailingPeriod);
                                                        return hasRecord && (e.name.toLowerCase().includes(mailSearch.toLowerCase()) || e.id.toLowerCase().includes(mailSearch.toLowerCase()));
                                                    });
                                                    return filtered.length > 0 && filtered.every(e => selectedEmps.includes(e.id));
                                                })()}
                                                onChange={(e) => {
                                                    const filtered = employees.filter(e => {
                                                        const hasRecord = payrollHistory.some(r => r.employeeId === e.id && `${r.month} ${r.year}` === mailingPeriod);
                                                        return hasRecord && (e.name.toLowerCase().includes(mailSearch.toLowerCase()) || e.id.toLowerCase().includes(mailSearch.toLowerCase()));
                                                    });
                                                    if (e.target.checked) {
                                                        setSelectedEmps(prev => Array.from(new Set([...prev, ...filtered.map(emp => emp.id)])));
                                                    } else {
                                                        setSelectedEmps(prev => prev.filter(id => !filtered.some(emp => emp.id === id)));
                                                    }
                                                }}
                                            />
                                        </th>
                                        <th className="p-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-24">ID</th>
                                        <th className="p-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Name</th>
                                        <th className="p-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</th>
                                        <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {employees
                                        .filter(e => {
                                            const hasRecord = payrollHistory.some(r => r.employeeId === e.id && `${r.month} ${r.year}` === mailingPeriod);
                                            return hasRecord && (e.name.toLowerCase().includes(mailSearch.toLowerCase()) || e.id.toLowerCase().includes(mailSearch.toLowerCase()));
                                        })
                                        .map(emp => {
                                            const record = payrollHistory.find(r => r.employeeId === emp.id && `${r.month} ${r.year}` === mailingPeriod);
                                            return (
                                                <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors group">
                                                    <td className="p-4 text-center">
                                                        <input 
                                                            type="checkbox" 
                                                            title={`Select ${emp.name}`}
                                                            aria-label={`Select ${emp.name}`}
                                                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 accent-indigo-500"
                                                            checked={selectedEmps.includes(emp.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setSelectedEmps(prev => [...prev, emp.id]);
                                                                else setSelectedEmps(prev => prev.filter(id => id !== emp.id));
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="p-4 text-xs font-mono text-slate-500">{emp.id}</td>
                                                    <td className="p-4">
                                                        <div className="text-xs font-black text-white uppercase">{emp.name}</div>
                                                        <div className="text-[10px] text-slate-500 font-bold uppercase">{emp.designation}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        {emp.email ? (
                                                            <div className="text-xs text-indigo-400 font-medium flex items-center gap-1.5">
                                                                <Mail size={12} className="opacity-50" /> {emp.email}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] font-bold text-red-400/60 uppercase italic flex items-center gap-1.5">
                                                                <Info size={12} /> Email Missing in Profile
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        {record?.status === 'Finalized' ? (
                                                            emp.email ? (
                                                                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase rounded-lg border border-emerald-500/20">READY</span>
                                                            ) : (
                                                                <span className="px-2.5 py-1 bg-red-500/10 text-red-500 text-[10px] font-black uppercase rounded-lg border border-red-500/20">NOT READY</span>
                                                            )
                                                        ) : (
                                                            <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase rounded-lg border border-amber-500/20">NOT FROZEN</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                            {employees.filter(e => payrollHistory.some(r => r.employeeId === e.id && `${r.month} ${r.year}` === mailingPeriod)).length === 0 && (
                                <div className="p-20 text-center">
                                    <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                                        <Info size={24} className="text-slate-500" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">No finalized payroll records found for {mailingPeriod}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {isMailing && (
                        <div className="sticky bottom-0 z-20 p-6 bg-[#0f172a] border-t border-indigo-500/30 animate-in slide-in-from-bottom-full duration-500">
                             <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-3">
                                    <Loader2 size={18} className="text-indigo-400 animate-spin" />
                                    <span className="text-xs font-black text-white uppercase tracking-widest">{mailStatus}</span>
                                </div>
                                <span className="text-xs font-mono font-bold text-indigo-400">{mailProgress}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 shadow-inner">
                                <div 
                                    className="h-full bg-indigo-500 transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                                    style={{ '--mail-progress': `${mailProgress}%`, width: 'var(--mail-progress)' } as React.CSSProperties}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'MIS_REPORT' && (
                <div className="flex flex-col items-center justify-center p-12 text-center h-full animate-in fade-in">
                    <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 border border-blue-500/20">
                        <PieChart size={48} className="text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">Management Information Center</h3>
                    <p className="text-slate-400 max-w-md mb-8 leading-relaxed">Executive dashboards and synthesized analytical reports for top-level review and business intelligence.</p>
                    <button className="px-8 py-3 bg-slate-800 text-slate-400 text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-2 cursor-not-allowed border border-slate-700">
                        Module Coming Soon
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default MISDashboard;
