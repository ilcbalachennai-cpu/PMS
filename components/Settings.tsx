
import React, { useState, useRef, useEffect } from 'react';
import { Save, AlertCircle, RefreshCw, Building2, ShieldCheck, HelpCircle, Upload, Image as ImageIcon, ScrollText, Trash2, Plus, MapPin, AlertTriangle, CalendarClock, X, KeyRound, Download, Lock, FileText, Phone, Mail, Globe, Briefcase, Database, Loader2, CheckCircle2 } from 'lucide-react';
import { StatutoryConfig, PFComplianceType, LeavePolicy, CompanyProfile } from '../types';
import { PT_STATE_PRESETS, INDIAN_STATES, NATURE_OF_BUSINESS_OPTIONS } from '../constants';
import CryptoJS from 'crypto-js';

interface SettingsProps {
  config: StatutoryConfig;
  setConfig: (config: StatutoryConfig) => void;
  companyProfile: CompanyProfile;
  setCompanyProfile: (profile: CompanyProfile) => void;
  currentLogo: string;
  setLogo: (url: string) => void;
  leavePolicy: LeavePolicy;
  setLeavePolicy: (policy: LeavePolicy) => void;
  onRestore: () => void;
  initialTab?: 'STATUTORY' | 'COMPANY' | 'DATA';
}

const Settings: React.FC<SettingsProps> = ({ config, setConfig, companyProfile, setCompanyProfile, currentLogo, setLogo, leavePolicy, setLeavePolicy, onRestore, initialTab = 'STATUTORY' }) => {
  const [activeTab, setActiveTab] = useState<'STATUTORY' | 'COMPANY' | 'DATA'>(initialTab);
  const [formData, setFormData] = useState(config);
  const [profileData, setProfileData] = useState(companyProfile);
  const [localLeavePolicy, setLocalLeavePolicy] = useState(leavePolicy);
  const [saved, setSaved] = useState(false);
  const [selectedStatePreset, setSelectedStatePreset] = useState<string>('Tamil Nadu');

  // Sync activeTab if initialTab changes prop
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Factory Reset State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  
  // Encrypted Backup State
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [backupMode, setBackupMode] = useState<'EXPORT' | 'IMPORT'>('EXPORT');
  const backupFileRef = useRef<HTMLInputElement>(null);

  // Progress Bar State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processStatus, setProcessStatus] = useState('');

  const SUPERVISOR_PASSWORD = "admin";

  // Helper for UI breathing room
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // --- ENCRYPTION LOGIC ---
  const handleEncryptedExport = async () => {
    if (!encryptionKey) {
        alert("Please enter a secure password to encrypt your data.");
        return;
    }

    setIsProcessing(true);
    setProcessProgress(0);
    setProcessStatus('Initializing export process...');

    try {
        await delay(500);

        // 1. Gather all data
        setProcessStatus('Gathering system data...');
        setProcessProgress(20);
        await delay(300);

        const dataBundle = {
            employees: JSON.parse(localStorage.getItem('app_employees') || '[]'),
            config: JSON.parse(localStorage.getItem('app_config') || '{}'),
            companyProfile: JSON.parse(localStorage.getItem('app_company_profile') || '{}'),
            attendance: JSON.parse(localStorage.getItem('app_attendance') || '[]'),
            leaveLedgers: JSON.parse(localStorage.getItem('app_leave_ledgers') || '[]'),
            advanceLedgers: JSON.parse(localStorage.getItem('app_advance_ledgers') || '[]'),
            payrollHistory: JSON.parse(localStorage.getItem('app_payroll_history') || '[]'),
            masters: {
                designations: JSON.parse(localStorage.getItem('app_master_designations') || '[]'),
                divisions: JSON.parse(localStorage.getItem('app_master_divisions') || '[]'),
                branches: JSON.parse(localStorage.getItem('app_master_branches') || '[]'),
                sites: JSON.parse(localStorage.getItem('app_master_sites') || '[]'),
            },
            logo: localStorage.getItem('app_logo'),
            timestamp: new Date().toISOString()
        };

        // 2. Encrypt
        setProcessStatus('Encrypting sensitive information...');
        setProcessProgress(50);
        await delay(400);

        const jsonString = JSON.stringify(dataBundle);
        const encrypted = CryptoJS.AES.encrypt(jsonString, encryptionKey).toString();

        setProcessStatus('Generating secure backup file...');
        setProcessProgress(80);
        await delay(400);

        // 3. Download
        const blob = new Blob([encrypted], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `BharatPay_Secure_Backup_${dateStr}.enc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        // 4. Success State - STRICT PAUSE with VISUAL SUCCESS
        setProcessProgress(100);
        setProcessStatus('Data Exported Successfully!');
        
        // Wait 4 seconds with 100% visible (Increased from 2s)
        await delay(4000); 
        
        setShowBackupModal(false);
        setEncryptionKey('');
        setIsProcessing(false);
        
        // Post-close alert (deferred to avoid blocking UI close)
        setTimeout(() => {
            alert("Data Exported Successfully. Please keep the file safe.");
        }, 100);

    } catch (e) {
        console.error(e);
        setIsProcessing(false);
        alert("Encryption failed.");
    }
  };

  const handleEncryptedImport = () => {
      const file = backupFileRef.current?.files?.[0];
      if (!file || !encryptionKey) {
          alert("Please select a file and enter the decryption password.");
          return;
      }

      setIsProcessing(true);
      setProcessProgress(0);
      setProcessStatus('Reading backup file...');

      const reader = new FileReader();
      
      // Basic progress for file reading
      reader.onprogress = (event) => {
          if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 30); // First 30% is reading
              setProcessProgress(percent);
          }
      };

      reader.onload = async (e) => {
          try {
              const encryptedContent = e.target?.result as string;
              
              setProcessStatus('Decrypting data...');
              setProcessProgress(40);
              await delay(300);

              // 1. Decrypt
              const bytes = CryptoJS.AES.decrypt(encryptedContent, encryptionKey);
              const decryptedString = bytes.toString(CryptoJS.enc.Utf8);

              if (!decryptedString) {
                  throw new Error("Wrong Password or Corrupt File");
              }

              setProcessStatus('Verifying data integrity...');
              setProcessProgress(60);
              await delay(300);

              // 2. Parse
              const data = JSON.parse(decryptedString);

              setProcessStatus('Restoring database...');
              setProcessProgress(80);
              await delay(400);

              // 3. PREPARE ENVIRONMENT & AVOID QUOTA ERROR
              // Save current user session from storage to memory
              const currentSession = localStorage.getItem('app_session_user');
              
              // Clear storage to prevent QuotaExceededError (overwrite instead of append)
              localStorage.clear();

              // Restore Session immediately
              if (currentSession) {
                  localStorage.setItem('app_session_user', currentSession);
              }

              // 4. Restore to LocalStorage
              if (data.employees) localStorage.setItem('app_employees', JSON.stringify(data.employees));
              if (data.config) localStorage.setItem('app_config', JSON.stringify(data.config));
              if (data.companyProfile) localStorage.setItem('app_company_profile', JSON.stringify(data.companyProfile));
              if (data.attendance) localStorage.setItem('app_attendance', JSON.stringify(data.attendance));
              if (data.leaveLedgers) localStorage.setItem('app_leave_ledgers', JSON.stringify(data.leaveLedgers));
              if (data.advanceLedgers) localStorage.setItem('app_advance_ledgers', JSON.stringify(data.advanceLedgers));
              if (data.payrollHistory) localStorage.setItem('app_payroll_history', JSON.stringify(data.payrollHistory));
              if (data.logo) localStorage.setItem('app_logo', data.logo);
              
              if (data.masters) {
                  localStorage.setItem('app_master_designations', JSON.stringify(data.masters.designations));
                  localStorage.setItem('app_master_divisions', JSON.stringify(data.masters.divisions));
                  localStorage.setItem('app_master_branches', JSON.stringify(data.masters.branches));
                  localStorage.setItem('app_master_sites', JSON.stringify(data.masters.sites));
              }

              // 5. Success State - STRICT PAUSE with VISUAL SUCCESS
              setProcessProgress(100);
              setProcessStatus('Data Restored Successfully!');
              
              // Wait 4 seconds with 100% visible (Increased from 2s)
              await delay(4000);

              setIsProcessing(false);
              setShowBackupModal(false);
              
              // Post-close alert and reload (deferred)
              setTimeout(() => {
                  alert("System Restored Successfully. The application will now refresh.");
                  onRestore();
              }, 100);

          } catch (err: any) {
              console.error(err);
              setIsProcessing(false);
              if (err.message === "Wrong Password or Corrupt File") {
                  alert("Decryption Failed: Incorrect password or invalid file format.");
              } else if (err.name === 'QuotaExceededError' || err.message?.toLowerCase().includes('quota')) {
                  alert("Restore Partial: Storage limit exceeded. Some data may have been restored.");
                  onRestore();
              } else {
                  alert(`Restore Error: ${err.message}`);
              }
          }
      };
      reader.readAsText(file);
  };

  const handlePFTypeChange = (type: PFComplianceType) => {
    // Logic: Statutory is 12%, Voluntary is 10%
    const newRate = type === 'Statutory' ? 0.12 : 0.10;
    setFormData({
      ...formData,
      pfComplianceType: type,
      epfEmployeeRate: newRate,
      epfEmployerRate: newRate
    });
  };

  const handleStatePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const state = e.target.value as keyof typeof PT_STATE_PRESETS;
    if (PT_STATE_PRESETS[state]) {
      setSelectedStatePreset(state);
      setFormData({
        ...formData,
        ptDeductionCycle: PT_STATE_PRESETS[state].cycle as 'Monthly' | 'HalfYearly',
        ptSlabs: [...PT_STATE_PRESETS[state].slabs]
      });
    }
  };

  const handleSlabChange = (index: number, field: 'min' | 'max' | 'amount', value: number) => {
    const newSlabs = [...formData.ptSlabs];
    newSlabs[index] = { ...newSlabs[index], [field]: value };
    setFormData({ ...formData, ptSlabs: newSlabs });
  };

  const handleAddSlab = () => {
    setFormData({
      ...formData,
      ptSlabs: [...formData.ptSlabs, { min: 0, max: 0, amount: 0 }]
    });
  };

  const handleDeleteSlab = (index: number) => {
    const newSlabs = formData.ptSlabs.filter((_, i) => i !== index);
    setFormData({ ...formData, ptSlabs: newSlabs });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePolicyChange = (key: keyof LeavePolicy, field: 'maxPerYear' | 'maxCarryForward', value: number) => {
    setLocalLeavePolicy({
        ...localLeavePolicy,
        [key]: {
            ...localLeavePolicy[key],
            [field]: value
        }
    });
  };

  const handleSave = () => {
    setConfig(formData);
    setCompanyProfile(profileData);
    setLeavePolicy(localLeavePolicy);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const initiateFactoryReset = () => {
    setShowResetModal(true);
    setResetPassword('');
    setResetError('');
  };

  const executeFactoryReset = () => {
      if (resetPassword === SUPERVISOR_PASSWORD) {
          const keysToRemove = [
            'app_employees',
            'app_config', 
            'app_company_profile',
            'app_logo',
            'app_leave_policy',
            'app_attendance', 
            'app_leave_ledgers', 
            'app_advance_ledgers', 
            'app_payroll_history',
            'app_master_designations',
            'app_master_divisions',
            'app_master_branches',
            'app_master_sites',
            'app_session_user'
          ];
          
          keysToRemove.forEach(k => localStorage.removeItem(k));
          localStorage.clear();

          alert("System has been successfully reset. The application will now restart.");
          onRestore();
      } else {
          setResetError("Incorrect Password. Access Denied.");
      }
  };

  return (
    <div className="max-w-4xl space-y-8 text-white relative">
      
      <div className="flex gap-4 border-b border-slate-700">
          <button 
            onClick={() => setActiveTab('STATUTORY')} 
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'STATUTORY' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
             <ShieldCheck size={16} /> Statutory Rules
          </button>
          <button 
            onClick={() => setActiveTab('COMPANY')} 
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'COMPANY' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
             <Building2 size={16} /> Company Profile
          </button>
          <button 
            onClick={() => setActiveTab('DATA')} 
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'DATA' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
             <Database size={16} /> Data Management
          </button>
      </div>

      {activeTab === 'STATUTORY' && (
      <>
        <div className="bg-amber-900/20 border border-amber-700/50 p-6 rounded-2xl flex gap-4 text-amber-200">
            <AlertCircle size={28} className="shrink-0 text-amber-400" />
            <div className="text-sm space-y-2">
            <p className="font-bold text-lg text-amber-400">Compliance & Parameter Configuration</p>
            <p className="text-slate-300">These settings define how PF, ESI, and Taxes are calculated establishment-wide.</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li>Establishments with 20+ employees must select Statutory PF compliance.</li>
                <li>Statutory EPF ceiling is ₹15,000 for standard contributions.</li>
                <li>PT rules can be customized based on state laws (e.g., Monthly vs Half-Yearly).</li>
            </ul>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
            <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center gap-3">
                <ImageIcon className="text-purple-400" size={24} />
                <h3 className="font-bold text-sky-400">Branding Configuration</h3>
            </div>
            <div className="p-8 flex-1 space-y-6 flex flex-col items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-white border-4 border-slate-700 overflow-hidden shadow-xl mb-4 relative group">
                    <img src={currentLogo} alt="Brand Logo" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-xs font-bold text-white">Preview</span>
                    </div>
                </div>
                
                <div className="w-full">
                    <label className="flex items-center justify-center gap-2 w-full p-4 bg-slate-900 hover:bg-slate-800 border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl cursor-pointer transition-all group">
                        <Upload className="text-slate-500 group-hover:text-blue-400" size={20} />
                        <span className="text-sm font-bold text-slate-400 group-hover:text-white">Upload New Logo</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </label>
                    <p className="text-[10px] text-center text-slate-500 mt-2">Recommended: 200x200px PNG or JPG</p>
                </div>
            </div>
            </div>

            <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
            <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center gap-3">
                <Building2 className="text-blue-400" size={24} />
                <h3 className="font-bold text-sky-400">Company Compliance Level</h3>
            </div>
            <div className="p-8 flex-1 space-y-6">
                <div className="space-y-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">PF Contribution Policy</label>
                <div className="grid grid-cols-1 gap-4">
                    <button 
                    onClick={() => handlePFTypeChange('Voluntary')}
                    className={`p-4 rounded-xl border transition-all text-left flex flex-col gap-1 ${
                        formData.pfComplianceType === 'Voluntary' 
                        ? 'bg-blue-600 border-blue-400 shadow-lg' 
                        : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                    }`}
                    >
                    <span className="font-bold text-white">Voluntary PF (10%)</span>
                    <span className="text-[10px] text-slate-300 opacity-80">For establishments with &lt; 20 employees. Rates defaulted to 10%.</span>
                    </button>
                    <button 
                    onClick={() => handlePFTypeChange('Statutory')}
                    className={`p-4 rounded-xl border transition-all text-left flex flex-col gap-1 ${
                        formData.pfComplianceType === 'Statutory' 
                        ? 'bg-emerald-600 border-emerald-400 shadow-lg' 
                        : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                    }`}
                    >
                    <span className="font-bold flex items-center gap-2 text-white">Statutory PF (12%) <ShieldCheck size={14} /></span>
                    <span className="text-[10px] text-slate-300 opacity-80">Mandatory for 20+ employees. Rates defaulted to 12%.</span>
                    </button>
                </div>
                </div>
                
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex gap-3 text-xs text-slate-400 italic">
                <HelpCircle size={16} className="shrink-0 text-blue-400" />
                Switching types will automatically reset the default percentage rates below.
                </div>
            </div>
            </div>

            <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden lg:col-span-2">
            <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-sky-400">Wage Ceilings & Rates</h3>
                <button className="text-[10px] font-bold text-blue-400 hover:underline flex items-center gap-1">
                <RefreshCw size={12} /> RESET DEFAULTS
                </button>
            </div>
            
            <div className="p-8 space-y-6">
                <p className="text-xs text-amber-400 italic font-medium border-l-2 border-amber-500 pl-3">
                Wages for the Purpose of PF and ESI is as per New Labour Code 2020 subject to Wage Ceiling
                </p>
                <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PF Wage Ceiling</label>
                    <input 
                    type="number" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    value={formData.epfCeiling}
                    onChange={e => setFormData({...formData, epfCeiling: +e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ESI Wage Ceiling</label>
                    <input 
                    type="number" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    value={formData.esiCeiling}
                    onChange={e => setFormData({...formData, esiCeiling: +e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Emp EPF Rate (%)</label>
                    <input 
                    type="number" 
                    step="0.01"
                    className="w-full bg-slate-800 border-2 border-blue-900/50 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold font-mono"
                    value={formData.epfEmployeeRate * 100}
                    onChange={e => setFormData({...formData, epfEmployeeRate: +e.target.value/100})}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Emp ESI Rate (%)</label>
                    <input 
                    type="number" 
                    step="0.01"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    value={formData.esiEmployeeRate * 100}
                    onChange={e => setFormData({...formData, esiEmployeeRate: +e.target.value/100})}
                    />
                </div>
                </div>
            </div>
            </div>

            <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden p-6 lg:col-span-2">
                <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                    <div className="p-2 bg-emerald-900/30 text-emerald-400 rounded-lg border border-emerald-500/20">
                        <CalendarClock size={20} />
                    </div>
                    <div>
                    <h3 className="font-bold text-sky-400 uppercase tracking-widest text-sm">Leave Policy Configuration</h3>
                    <p className="text-xs text-slate-400">Define annual entitlement and carry forward limits.</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {(Object.keys(localLeavePolicy) as Array<keyof LeavePolicy>).map((key) => (
                        <div key={key} className="bg-[#0f172a] p-4 rounded-xl border border-slate-800 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-2 h-2 rounded-full ${key === 'el' ? 'bg-blue-400' : key === 'sl' ? 'bg-emerald-400' : 'bg-amber-400'}`}></div>
                                <h4 className="font-bold text-white text-sm">{localLeavePolicy[key].label}</h4>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Max Days / Year</label>
                                <input 
                                    type="number" 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-sm"
                                    value={localLeavePolicy[key].maxPerYear}
                                    onChange={e => handlePolicyChange(key, 'maxPerYear', +e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Max Carry Forward</label>
                                <input 
                                    type="number" 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-sm"
                                    value={localLeavePolicy[key].maxCarryForward}
                                    onChange={e => handlePolicyChange(key, 'maxCarryForward', +e.target.value)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden lg:col-span-2">
            <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                <ScrollText className="text-amber-500" size={24} />
                <h3 className="font-bold text-sky-400">Professional Tax (PT) Rules</h3>
                </div>
                <div className="flex gap-4 items-center">
                <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-slate-400" />
                    <select 
                    onChange={handleStatePresetChange} 
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500"
                    defaultValue=""
                    >
                    <option value="" disabled>Select State Preset</option>
                    {Object.keys(PT_STATE_PRESETS).map(state => (
                        <option key={state} value={state}>{state}</option>
                    ))}
                    </select>
                </div>
                </div>
            </div>

            <div className="p-8 space-y-6">
                <div className="flex items-center gap-6 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Deduction Frequency</label>
                    <select 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white outline-none"
                    value={formData.ptDeductionCycle}
                    onChange={e => setFormData({...formData, ptDeductionCycle: e.target.value as any})}
                    >
                    <option value="Monthly">Monthly (Every Month)</option>
                    <option value="HalfYearly">Half-Yearly (March & September)</option>
                    </select>
                </div>
                <div className="flex-[2] text-xs text-slate-400 italic border-l border-slate-700 pl-4">
                    <p>{formData.ptDeductionCycle === 'Monthly' 
                    ? 'PT will be deducted every month based on monthly gross income slabs.' 
                    : 'PT will be deducted ONLY in September and March. Slabs represent Half-Yearly Income ranges.'}
                    </p>
                </div>
                </div>

                {selectedStatePreset && (
                <div className="flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700 w-fit">
                    <MapPin size={14} className="text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Active Configuration:</span>
                    <span className="text-xs font-bold uppercase tracking-wide text-amber-400">{selectedStatePreset}</span>
                </div>
                )}

                <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#0f172a] text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                    <tr>
                        <th className="px-6 py-3">Min Income (₹)</th>
                        <th className="px-6 py-3">Max Income (₹)</th>
                        <th className="px-6 py-3">Tax Amount (₹)</th>
                        <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                    {formData.ptSlabs.map((slab, index) => (
                        <tr key={index} className="hover:bg-slate-800/50">
                        <td className="px-6 py-2">
                            <input type="number" className="bg-transparent border border-transparent hover:border-slate-700 focus:border-blue-500 rounded p-1 w-full text-sm text-white font-mono" value={slab.min} onChange={e => handleSlabChange(index, 'min', +e.target.value)} />
                        </td>
                        <td className="px-6 py-2">
                            <input type="number" className="bg-transparent border border-transparent hover:border-slate-700 focus:border-blue-500 rounded p-1 w-full text-sm text-white font-mono" value={slab.max} onChange={e => handleSlabChange(index, 'max', +e.target.value)} />
                        </td>
                        <td className="px-6 py-2">
                            <input type="number" className="bg-transparent border border-transparent hover:border-slate-700 focus:border-blue-500 rounded p-1 w-full text-sm text-amber-400 font-mono font-bold" value={slab.amount} onChange={e => handleSlabChange(index, 'amount', +e.target.value)} />
                        </td>
                        <td className="px-6 py-2 text-right">
                            <button onClick={() => handleDeleteSlab(index)} className="text-slate-600 hover:text-red-400 transition-colors p-2"><Trash2 size={16} /></button>
                        </td>
                        </tr>
                    ))}
                    <tr>
                        <td colSpan={4} className="p-2">
                        <button onClick={handleAddSlab} className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-slate-500 hover:text-blue-400 hover:border-blue-500 hover:bg-slate-900 transition-all text-xs font-bold flex items-center justify-center gap-2">
                            <Plus size={14} /> ADD NEW SLAB ROW
                        </button>
                        </td>
                    </tr>
                    </tbody>
                </table>
                </div>
            </div>
            </div>

        </div>
      </>
      )}

      {activeTab === 'COMPANY' && (
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden p-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                <div className="p-2 bg-indigo-900/30 text-indigo-400 rounded-lg border border-indigo-500/20">
                    <Building2 size={24} />
                </div>
                <div>
                   <h3 className="font-bold text-sky-400 uppercase tracking-widest text-sm">Establishment Profile</h3>
                   <p className="text-xs text-slate-400">Official details for legal forms and reports.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 gap-y-8">
                <div className="md:col-span-3">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1">Legal Identity</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Establishment Name</label>
                            <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" 
                                value={profileData.establishmentName} onChange={e => setProfileData({...profileData, establishmentName: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Trade Name (If Any)</label>
                            <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" 
                                value={profileData.tradeName} onChange={e => setProfileData({...profileData, tradeName: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Nature of Business</label>
                            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500"
                                value={profileData.natureOfBusiness} onChange={e => setProfileData({...profileData, natureOfBusiness: e.target.value})}
                            >
                                <option value="">Select Nature</option>
                                {NATURE_OF_BUSINESS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Corporate ID (CIN)</label>
                            <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono" 
                                value={profileData.cin} onChange={e => setProfileData({...profileData, cin: e.target.value})} />
                        </div>
                    </div>
                </div>

                <div className="md:col-span-3">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1 mt-2">Registration Codes</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">LIN (Labour ID)</label>
                            <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono" 
                                value={profileData.lin} onChange={e => setProfileData({...profileData, lin: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">PF Code</label>
                            <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono" 
                                value={profileData.pfCode} onChange={e => setProfileData({...profileData, pfCode: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">ESI Code</label>
                            <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono" 
                                value={profileData.esiCode} onChange={e => setProfileData({...profileData, esiCode: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">GST No</label>
                            <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono" 
                                value={profileData.gstNo} onChange={e => setProfileData({...profileData, gstNo: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">PAN No</label>
                            <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono" 
                                value={profileData.pan} onChange={e => setProfileData({...profileData, pan: e.target.value})} />
                        </div>
                    </div>
                </div>

                <div className="md:col-span-3">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1 mt-2">Communication & Address</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Registered Office Address</label>
                            <textarea rows={2} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 resize-none" 
                                value={profileData.address} onChange={e => setProfileData({...profileData, address: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">State / Union Territory</label>
                            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500"
                                value={profileData.state} onChange={e => setProfileData({...profileData, state: e.target.value})}
                            >
                                <option value="">Select State</option>
                                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">City</label>
                            <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" 
                                value={profileData.city} onChange={e => setProfileData({...profileData, city: e.target.value})} />
                        </div>
                        
                        <div className="space-y-1 relative">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Mobile No</label>
                            <div className="relative">
                                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input type="tel" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 pl-9 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono" 
                                    value={profileData.mobile} onChange={e => setProfileData({...profileData, mobile: e.target.value})} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Telephone No</label>
                            <div className="relative">
                                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input type="tel" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 pl-9 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono" 
                                    value={profileData.telephone} onChange={e => setProfileData({...profileData, telephone: e.target.value})} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Mail ID</label>
                            <div className="relative">
                                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 pl-9 text-white outline-none focus:ring-1 focus:ring-indigo-500" 
                                    value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Web ID</label>
                            <div className="relative">
                                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input type="url" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 pl-9 text-white outline-none focus:ring-1 focus:ring-indigo-500" 
                                    value={profileData.website} onChange={e => setProfileData({...profileData, website: e.target.value})} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'DATA' && (
        <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-8 shadow-xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="p-2 bg-indigo-900/30 text-indigo-400 rounded-lg border border-indigo-500/20">
                    <Database size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-white text-lg">Data Management</h3>
                    <p className="text-xs text-slate-400">Secure backup and restore operations.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#0f172a] p-6 rounded-xl border border-slate-800 hover:border-blue-500/50 transition-all group">
                    <div className="p-3 bg-blue-900/20 text-blue-400 rounded-full w-fit mb-4 group-hover:scale-110 transition-transform">
                        <Download size={24} />
                    </div>
                    <h4 className="font-bold text-white mb-2">Backup Data</h4>
                    <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                        Create a secure, encrypted backup file (.enc) of your entire system data. You will need to set a password.
                    </p>
                    <button 
                        onClick={() => { setBackupMode('EXPORT'); setShowBackupModal(true); setEncryptionKey(''); }}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
                    >
                        <Download size={16} /> Create Backup
                    </button>
                </div>

                <div className="bg-[#0f172a] p-6 rounded-xl border border-slate-800 hover:border-emerald-500/50 transition-all group">
                    <div className="p-3 bg-emerald-900/20 text-emerald-400 rounded-full w-fit mb-4 group-hover:scale-110 transition-transform">
                        <Upload size={24} />
                    </div>
                    <h4 className="font-bold text-white mb-2">Restore Data</h4>
                    <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                        Restore your system from an existing .enc backup file. This will overwrite current data.
                    </p>
                    <button 
                        onClick={() => { setBackupMode('IMPORT'); setShowBackupModal(true); setEncryptionKey(''); }}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"
                    >
                        <Upload size={16} /> Restore Backup
                    </button>
                </div>
            </div>

            <div className="pt-6 border-t border-slate-800">
                <div className="bg-red-900/10 border border-red-900/30 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-red-900/20 text-red-500 rounded-lg">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-red-200 text-sm">Danger Zone</h4>
                            <p className="text-xs text-red-300/60">Permanently delete all data and reset to factory defaults.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => { setShowResetModal(true); setResetPassword(''); setResetError(''); }}
                        className="px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-lg text-xs font-bold transition-all"
                    >
                        Factory Reset
                    </button>
                </div>
            </div>
        </div>
      )}

      {activeTab !== 'DATA' && (
      <div className="flex justify-between items-center p-2 pt-6 border-t border-slate-800">
        <div></div>
        <button 
          onClick={handleSave}
          className={`flex items-center gap-3 px-10 py-4 rounded-2xl font-black transition-all shadow-2xl ${
            saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {saved ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
          {saved ? 'CONFIGURATION SAVED!' : 'UPDATE ALL PARAMETERS'}
        </button>
      </div>
      )}

       {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-red-900/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setShowResetModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                    <X size={20} />
                </button>
                <div className="flex flex-col items-center gap-2">
                    <div className="p-4 bg-red-900/20 text-red-500 rounded-full border border-red-900/50 mb-2">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-black text-white text-center">FACTORY RESET</h3>
                    <p className="text-xs text-red-300 text-center leading-relaxed">
                        CRITICAL WARNING: This will permanently delete ALL data including employees, payroll history, and settings. This action is IRREVERSIBLE.
                    </p>
                </div>
                
                <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                        <KeyRound size={16} />
                        <span>Supervisor Authorization</span>
                    </div>
                    <input 
                        type="password" 
                        placeholder="Enter Admin Password" 
                        autoFocus
                        className={`w-full bg-[#0f172a] border ${resetError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-red-500 transition-all`}
                        value={resetPassword}
                        onChange={(e) => { setResetPassword(e.target.value); setResetError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && executeFactoryReset()}
                    />
                    {resetError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{resetError}</p>}
                </div>
                
                <button 
                    onClick={executeFactoryReset}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2"
                >
                    <Trash2 size={18} /> CONFIRM DELETE ALL DATA
                </button>
            </div>
        </div>
       )}

       {showBackupModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                {!isProcessing && (
                    <button onClick={() => setShowBackupModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                )}
                
                <div className="flex flex-col items-center gap-2">
                    {/* VISUAL SUCCESS INDICATOR */}
                    <div className={`p-4 rounded-full border mb-2 transition-all duration-500 ${processProgress === 100 ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/50' : isProcessing ? 'bg-indigo-900/30 text-indigo-400 border-indigo-500/50' : 'bg-blue-900/20 text-blue-400 border-blue-900/50'}`}>
                        {processProgress === 100 ? <CheckCircle2 size={32} /> : isProcessing ? <Loader2 size={32} className="animate-spin" /> : <Lock size={32} />}
                    </div>
                    <h3 className="text-xl font-black text-white text-center">
                        {isProcessing 
                            ? (backupMode === 'EXPORT' ? 'Exporting Data...' : 'Restoring System...') 
                            : (backupMode === 'EXPORT' ? 'Encrypted Export' : 'Secure Restore')
                        }
                    </h3>
                    {!isProcessing && (
                        <p className="text-xs text-slate-400 text-center leading-relaxed">
                            {backupMode === 'EXPORT' 
                                ? 'Create a secure backup file for your local disk. You must set a password to encrypt this file.'
                                : 'Restore data from a backup file. Existing data will be overwritten.'}
                        </p>
                    )}
                </div>
                
                {isProcessing ? (
                    <div className="w-full py-6 px-2 space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-end mb-2">
                                <span className={`text-xs font-bold uppercase tracking-widest transition-colors duration-300 ${processProgress === 100 ? 'text-emerald-400 text-sm animate-pulse' : 'text-slate-400'}`}>
                                    {processStatus}
                                </span>
                                <span className={`text-xs font-bold font-mono ${processProgress === 100 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    {processProgress}%
                                </span>
                            </div>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                                <div 
                                    className={`h-full transition-all duration-300 ease-out ${
                                        backupMode === 'EXPORT' ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]'
                                    }`}
                                    style={{ width: `${processProgress}%` }}
                                ></div>
                            </div>
                        </div>
                        <p className="text-[10px] text-center text-slate-500 italic animate-pulse">
                            Please do not close this window or refresh the page.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4 mt-2 w-full">
                        {backupMode === 'IMPORT' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Select Backup File</label>
                                <input 
                                    type="file" 
                                    ref={backupFileRef}
                                    className="w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                                    accept=".enc"
                                />
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">
                                {backupMode === 'EXPORT' ? 'Set Encryption Password' : 'Enter Decryption Password'}
                            </label>
                            <input 
                                type="password" 
                                placeholder="Enter Password" 
                                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                value={encryptionKey}
                                onChange={(e) => setEncryptionKey(e.target.value)}
                            />
                        </div>
                        
                        <button 
                            onClick={backupMode === 'EXPORT' ? handleEncryptedExport : handleEncryptedImport}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            {backupMode === 'EXPORT' ? 'DOWNLOAD SECURE BACKUP' : 'RESTORE DATA'}
                        </button>
                    </div>
                )}
            </div>
        </div>
       )}
    </div>
  );
};

export default Settings;
