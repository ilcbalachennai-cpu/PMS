
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Save, AlertCircle, RefreshCw, Building2, ShieldCheck, HelpCircle, Upload, Image as ImageIcon, ScrollText, Trash2, Plus, MapPin, AlertTriangle, CalendarClock, X, KeyRound, Download, Lock, FileText, Phone, Mail, Globe, Briefcase, Database, Loader2, CheckCircle2, Megaphone, HandCoins, MessageSquare, Landmark, Percent, Table, Heart, Camera, Cloud, CheckSquare, Square, Calculator } from 'lucide-react';
import { StatutoryConfig, PFComplianceType, LeavePolicy, CompanyProfile, User } from '../types';
import { PT_STATE_PRESETS, INDIAN_STATES, NATURE_OF_BUSINESS_OPTIONS, LWF_STATE_PRESETS, INITIAL_STATUTORY_CONFIG } from '../constants';
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
  initialTab?: 'STATUTORY' | 'COMPANY' | 'DATA' | 'DEVELOPER';
  userRole?: string;
  currentUser?: User;
}

const Settings: React.FC<SettingsProps> = ({ config, setConfig, companyProfile, setCompanyProfile, currentLogo, setLogo, leavePolicy, setLeavePolicy, onRestore, initialTab = 'STATUTORY', userRole, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'STATUTORY' | 'COMPANY' | 'DATA' | 'DEVELOPER'>(initialTab);
  
  // SCHEMA MIGRATION: Merge current config with defaults to prevent crashes on new features
  const [formData, setFormData] = useState<StatutoryConfig>(() => {
    return {
        ...INITIAL_STATUTORY_CONFIG,
        ...config,
        higherContributionComponents: {
            ...INITIAL_STATUTORY_CONFIG.higherContributionComponents,
            ...(config.higherContributionComponents || {})
        },
        leaveWagesComponents: {
            ...INITIAL_STATUTORY_CONFIG.leaveWagesComponents,
            ...(config.leaveWagesComponents || {})
        }
    };
  });

  const [profileData, setProfileData] = useState(companyProfile);
  const [localLeavePolicy, setLocalLeavePolicy] = useState(leavePolicy);
  const [saved, setSaved] = useState(false);
  const [selectedStatePreset, setSelectedStatePreset] = useState<string>('Tamil Nadu');
  const [selectedLWFState, setSelectedLWFState] = useState<string>('Tamil Nadu');
  
  const logoInputRef = useRef<HTMLInputElement>(null);

  const hasData = useMemo(() => {
      try {
          const emps = JSON.parse(localStorage.getItem('app_employees') || '[]');
          return Array.isArray(emps) && emps.length > 0;
      } catch (e) {
          return false;
      }
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [backupMode, setBackupMode] = useState<'EXPORT' | 'IMPORT'>('EXPORT');
  const backupFileRef = useRef<HTMLInputElement>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [pendingAuthAction, setPendingAuthAction] = useState<(() => void) | null>(null);

  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processStatus, setProcessStatus] = useState('');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const requireAuth = (callback: () => void) => {
      setPendingAuthAction(() => callback);
      setAuthPassword('');
      setAuthError('');
      setShowAuthModal(true);
  };

  const handleAuthSubmit = () => {
      if (authPassword === currentUser?.password) {
          setShowAuthModal(false);
          if (pendingAuthAction) {
              pendingAuthAction();
          }
          setPendingAuthAction(null);
      } else {
          setAuthError('Incorrect Login Password');
      }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEncryptedExport = () => {
    if (!encryptionKey) {
        alert("Please enter a secure password to encrypt your data file.");
        return;
    }

    setIsProcessing(true);
    setProcessProgress(50);
    setProcessStatus('Processing...');

    try {
        const rawLogo = localStorage.getItem('app_logo');
        let processedLogo = rawLogo;
        if (rawLogo && rawLogo.startsWith('"')) {
            try { processedLogo = JSON.parse(rawLogo); } catch(e) {}
        }

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
            logo: processedLogo,
            timestamp: new Date().toISOString()
        };

        const jsonString = JSON.stringify(dataBundle);
        const encrypted = CryptoJS.AES.encrypt(jsonString, encryptionKey).toString();

        const blob = new Blob([encrypted], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const today = new Date();
        let fyStart = today.getFullYear();
        if (today.getMonth() < 3) {
            fyStart = fyStart - 1;
        }
        const fyEnd = fyStart + 1;
        const compName = companyProfile.establishmentName ? companyProfile.establishmentName.replace(/[^a-zA-Z0-9]/g, '_') : 'Company';
        
        a.download = `${compName}_Backup_${fyStart}-${fyEnd}.enc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        setProcessProgress(100);
        setProcessStatus('Export Complete');
        
        setTimeout(() => {
            setShowBackupModal(false);
            setEncryptionKey('');
            setIsProcessing(false);
        }, 1000);

    } catch (e) {
        console.error(e);
        setIsProcessing(false);
        alert("Encryption failed.");
    }
  };

  const executeImport = () => {
      const file = backupFileRef.current?.files?.[0];
      if (!file || !encryptionKey) {
          alert("Please select a file and enter the decryption password.");
          return;
      }

      setIsProcessing(true);
      setProcessProgress(0);
      setProcessStatus('Reading backup file...');

      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const encryptedContent = e.target?.result as string;
              setProcessStatus('Decrypting data...');
              setProcessProgress(40);
              await delay(300);

              const bytes = CryptoJS.AES.decrypt(encryptedContent, encryptionKey);
              const decryptedString = bytes.toString(CryptoJS.enc.Utf8);

              if (!decryptedString) {
                  throw new Error("Wrong Password or Corrupt File");
              }

              setProcessStatus('Verifying data integrity...');
              setProcessProgress(60);
              await delay(300);

              const data = JSON.parse(decryptedString);
              setProcessStatus('Restoring database...');
              setProcessProgress(80);
              await delay(400);

              const currentSession = localStorage.getItem('app_session_user');
              const currentLicense = localStorage.getItem('app_license');
              
              localStorage.clear();
              
              if (currentSession) localStorage.setItem('app_session_user', currentSession);
              if (currentLicense) localStorage.setItem('app_license', currentLicense);

              if (data.employees) localStorage.setItem('app_employees', JSON.stringify(data.employees));
              if (data.config) localStorage.setItem('app_config', JSON.stringify(data.config));
              if (data.companyProfile) localStorage.setItem('app_company_profile', JSON.stringify(data.companyProfile));
              if (data.attendance) localStorage.setItem('app_attendance', JSON.stringify(data.attendance));
              if (data.leaveLedgers) localStorage.setItem('app_leave_ledgers', JSON.stringify(data.leaveLedgers));
              if (data.advanceLedgers) localStorage.setItem('app_advance_ledgers', JSON.stringify(data.advanceLedgers));
              if (data.payrollHistory) localStorage.setItem('app_payroll_history', JSON.stringify(data.payrollHistory));
              if (data.logo) localStorage.setItem('app_logo', JSON.stringify(data.logo));
              
              if (data.masters) {
                  localStorage.setItem('app_master_designations', JSON.stringify(data.masters.designations));
                  localStorage.setItem('app_master_divisions', JSON.stringify(data.masters.divisions));
                  localStorage.setItem('app_master_branches', JSON.stringify(data.masters.branches));
                  localStorage.setItem('app_master_sites', JSON.stringify(data.masters.sites));
              }

              setProcessProgress(100);
              setProcessStatus('Data Restored Successfully!');
              await delay(1000);

              setIsProcessing(false);
              setShowBackupModal(false);
              
              setTimeout(() => {
                  alert("System Restored Successfully. The application will now refresh.");
                  onRestore();
              }, 100);

          } catch (err: any) {
              console.error(err);
              setIsProcessing(false);
              alert(err.message === "Wrong Password or Corrupt File" ? "Decryption Failed: Incorrect password." : `Restore Error: ${err.message}`);
          }
      };
      reader.readAsText(file);
  };

  const initiateRestore = () => {
      const file = backupFileRef.current?.files?.[0];
      if (!file || !encryptionKey) {
          alert("Please select a file and enter the decryption password.");
          return;
      }
      if (hasData) {
          setShowOverwriteConfirm(true);
      } else {
          executeImport();
      }
  };

  const handlePFTypeChange = (type: PFComplianceType) => {
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

  const handleLWFStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const state = e.target.value as keyof typeof LWF_STATE_PRESETS;
    if (LWF_STATE_PRESETS[state]) {
        setSelectedLWFState(state);
        setFormData({
            ...formData,
            lwfDeductionCycle: LWF_STATE_PRESETS[state].cycle as any,
            lwfEmployeeContribution: LWF_STATE_PRESETS[state].emp,
            lwfEmployerContribution: LWF_STATE_PRESETS[state].emplr
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

  const handleHigherContributionToggle = (key: keyof StatutoryConfig['higherContributionComponents']) => {
    const currentComponents = formData.higherContributionComponents || INITIAL_STATUTORY_CONFIG.higherContributionComponents;
    setFormData({
        ...formData,
        higherContributionComponents: {
            ...currentComponents,
            [key]: !currentComponents[key]
        }
    });
  };

  const handleLeaveWagesToggle = (key: keyof StatutoryConfig['leaveWagesComponents']) => {
    const currentComponents = formData.leaveWagesComponents || INITIAL_STATUTORY_CONFIG.leaveWagesComponents;
    setFormData({
        ...formData,
        leaveWagesComponents: {
            ...currentComponents,
            [key]: !currentComponents[key]
        }
    });
  };

  const handleLeavePolicyChange = (type: 'el' | 'sl' | 'cl', field: 'maxPerYear' | 'maxCarryForward' | 'label', value: string | number) => {
    setLocalLeavePolicy({
      ...localLeavePolicy,
      [type]: {
        ...localLeavePolicy[type],
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

  const executeFactoryReset = () => {
      if (resetPassword === currentUser?.password) {
          localStorage.clear();
          alert("System has been successfully reset. The application will now restart.");
          onRestore();
      } else {
          setResetError("Incorrect Login Password. Access Denied.");
      }
  };

  return (
    <div className="max-w-4xl space-y-8 text-white relative">
      
      {/* Header Band - Tab Navigation (Sticky) */}
      <div className="sticky top-20 z-30 bg-[#020617] pt-2 flex gap-4 border-b border-slate-700 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setActiveTab('STATUTORY')} className={`whitespace-nowrap pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'STATUTORY' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
             <ShieldCheck size={16} /> Statutory Rules
          </button>
          <button onClick={() => setActiveTab('COMPANY')} className={`whitespace-nowrap pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'COMPANY' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
             <Building2 size={16} /> Company Profile
          </button>
          <button onClick={() => setActiveTab('DATA')} className={`whitespace-nowrap pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'DATA' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
             <Database size={16} /> Data Management
          </button>
          {userRole === 'Developer' && (
            <button onClick={() => setActiveTab('DEVELOPER')} className={`whitespace-nowrap pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'DEVELOPER' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                <Lock size={16} /> Developer Options
            </button>
          )}
      </div>

      {activeTab === 'STATUTORY' && (
      <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
        <div className="bg-amber-900/20 border border-amber-700/50 p-6 rounded-2xl flex gap-4 text-amber-200">
            <AlertCircle size={28} className="shrink-0 text-amber-400" />
            <div className="text-sm space-y-2">
            <p className="font-bold text-lg text-amber-400">Compliance & Parameter Configuration</p>
            <p className="text-slate-300">These Settings Define How PF, ESI, Leave Policy and Taxes are Calculated Establishment wise</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                        <Landmark className="text-blue-400" size={20} />
                        <h3 className="font-bold uppercase tracking-widest text-xs text-sky-400">Provident Fund (EPF)</h3>
                    </div>
                    {/* Updated styling to match Compliance & Parameter Configuration (Amber) */}
                    <label className="flex items-center gap-2 cursor-pointer p-1.5 bg-amber-900/20 rounded-lg border border-amber-500/20 hover:bg-amber-900/30 transition-all">
                        <input type="checkbox" className="w-4 h-4 rounded border-slate-700 text-amber-500 bg-slate-900 accent-amber-500" checked={formData.enableHigherContribution || false} onChange={e => setFormData({...formData, enableHigherContribution: e.target.checked})} />
                        <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Enable Higher Contribution Rules</span>
                    </label>
                </div>
                
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Compliance Basis</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => handlePFTypeChange('Statutory')} className={`py-2 text-xs font-bold rounded-lg border transition-all ${formData.pfComplianceType === 'Statutory' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>Statutory (12%)</button>
                                    <button onClick={() => handlePFTypeChange('Voluntary')} className={`py-2 text-xs font-bold rounded-lg border transition-all ${formData.pfComplianceType === 'Voluntary' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>Voluntary (10%)</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Statutory Ceiling (₹)</label>
                                    <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.epfCeiling} onChange={e => setFormData({...formData, epfCeiling: +e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Employee Rate (%)</label>
                                    <input type="number" step="0.01" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.epfEmployeeRate * 100} onChange={e => setFormData({...formData, epfEmployeeRate: +e.target.value / 100})} />
                                </div>
                            </div>
                        </div>

                        {formData.enableHigherContribution && (
                            <div className="bg-amber-900/10 p-4 rounded-xl border border-amber-500/20 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Higher Applicability</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {['By Employee', 'By Employee & Employer'].map(type => (
                                            <button 
                                                key={type}
                                                onClick={() => setFormData({...formData, higherContributionType: type as any})}
                                                className={`py-2 px-4 text-left text-xs font-bold rounded-lg border transition-all flex items-center justify-between ${formData.higherContributionType === type ? 'bg-amber-600 border-amber-400 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                            >
                                                {type}
                                                {formData.higherContributionType === type ? <CheckCircle2 size={14} /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-700" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-[9px] text-amber-300 italic leading-relaxed">
                                    * PF Wages will be taken from Higher Contribution Base only if it exceeds Code Wages (Clause 88).
                                </p>
                            </div>
                        )}
                    </div>

                    {formData.enableHigherContribution && (
                        <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Table size={12} className="text-amber-400" />
                                Selected Wage Components for Higher Contribution
                            </label>
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-3">
                                {[
                                    { key: 'basic', label: 'Basic Pay' },
                                    { key: 'da', label: 'DA' },
                                    { key: 'retaining', label: 'Retn Allow' },
                                    { key: 'conveyance', label: 'Conveyance' },
                                    { key: 'washing', label: 'Washing' },
                                    { key: 'attire', label: 'Attire' },
                                    { key: 'special1', label: 'Allow 1' },
                                    { key: 'special2', label: 'Allow 2' },
                                    { key: 'special3', label: 'Allow 3' },
                                ].map(comp => {
                                    const components = formData.higherContributionComponents || INITIAL_STATUTORY_CONFIG.higherContributionComponents;
                                    const isActive = components[comp.key as keyof typeof components];
                                    return (
                                        <button
                                            key={comp.key}
                                            onClick={() => handleHigherContributionToggle(comp.key as any)}
                                            className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold transition-all ${
                                                isActive
                                                ? 'bg-amber-600 border-amber-400 text-white'
                                                : 'bg-slate-800 border-slate-700 text-slate-500'
                                            }`}
                                        >
                                            {isActive ? <CheckSquare size={14} /> : <Square size={14} />}
                                            <span className="truncate">{comp.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                    <ShieldCheck className="text-pink-400" size={20} />
                    <h3 className="font-bold uppercase tracking-widest text-xs text-pink-400">ESI Corporation</h3>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">ESI Ceiling (₹)</label>
                            <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.esiCeiling} onChange={e => setFormData({...formData, esiCeiling: +e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">EE Rate (%)</label>
                            <input type="number" step="0.001" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.esiEmployeeRate * 100} onChange={e => setFormData({...formData, esiEmployeeRate: +e.target.value / 100})} />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center gap-3">
                <Heart className="text-red-400" size={20} />
                <h3 className="font-bold uppercase tracking-widest text-xs text-red-400">Employee Welfare (Bonus & Gratuity)</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                        <Percent size={14} className="text-amber-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Annual Bonus Policy</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Rate (%)</label>
                            <input type="number" step="0.0001" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={(formData.bonusRate * 100).toFixed(2)} onChange={e => setFormData({...formData, bonusRate: +e.target.value / 100})} />
                        </div>
                        <div className="flex flex-col justify-end">
                            <span className="text-[9px] text-slate-500 italic">Standard: 8.33% Min</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                        <Building2 size={14} className="text-blue-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">LIC Gratuity Policy</span>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Calculation Basis (Formula)</label>
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-blue-300 font-mono">
                            (Basic + DA) * (15/26) * Years
                        </div>
                        <p className="text-[9px] text-slate-500 mt-2">Calculated as per LIC Master Policy for Statutory Gratuity (Act 1972).</p>
                    </div>
                </div>
            </div>
        </div>

        {/* RESTORED: Annual Leave Policy Section */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center gap-3">
                <CalendarClock className="text-emerald-400" size={20} />
                <h3 className="font-bold uppercase tracking-widest text-xs text-emerald-400">Annual Leave Policy</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* EL */}
                <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-2">
                        <span className="text-xs font-bold text-slate-300 uppercase">Earned Leave (EL)</span>
                    </div>
                    <div className="space-y-2">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Label</label>
                            <input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" value={localLeavePolicy.el.label} onChange={e => handleLeavePolicyChange('el', 'label', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Max/Year</label>
                                <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.el.maxPerYear} onChange={e => handleLeavePolicyChange('el', 'maxPerYear', +e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Carry Fwd</label>
                                <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.el.maxCarryForward} onChange={e => handleLeavePolicyChange('el', 'maxCarryForward', +e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* SL */}
                <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-2">
                        <span className="text-xs font-bold text-slate-300 uppercase">Sick Leave (SL)</span>
                    </div>
                    <div className="space-y-2">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Label</label>
                            <input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" value={localLeavePolicy.sl.label} onChange={e => handleLeavePolicyChange('sl', 'label', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Max/Year</label>
                                <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.sl.maxPerYear} onChange={e => handleLeavePolicyChange('sl', 'maxPerYear', +e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Carry Fwd</label>
                                <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.sl.maxCarryForward} onChange={e => handleLeavePolicyChange('sl', 'maxCarryForward', +e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* CL */}
                <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-2">
                        <span className="text-xs font-bold text-slate-300 uppercase">Casual Leave (CL)</span>
                    </div>
                    <div className="space-y-2">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Label</label>
                            <input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" value={localLeavePolicy.cl.label} onChange={e => handleLeavePolicyChange('cl', 'label', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Max/Year</label>
                                <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.cl.maxPerYear} onChange={e => handleLeavePolicyChange('cl', 'maxPerYear', +e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Carry Fwd</label>
                                <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.cl.maxCarryForward} onChange={e => handleLeavePolicyChange('cl', 'maxCarryForward', +e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Leave Encashment Wages Policy Section */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Calculator className="text-emerald-400" size={20} />
                    <h3 className="font-bold uppercase tracking-widest text-xs text-emerald-400">Leave Encashment Wages Policy</h3>
                </div>
            </div>
            
            <div className="p-6 space-y-4">
                <p className="text-xs text-slate-400 mb-2">Select the wage components to include for Leave Encashment Calculation (EL/SL/CL).</p>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                        { key: 'basic', label: 'Basic Pay' },
                        { key: 'da', label: 'DA' },
                        { key: 'retaining', label: 'Retn Allow' },
                        { key: 'hra', label: 'HRA' },
                        { key: 'conveyance', label: 'Conveyance' },
                        { key: 'washing', label: 'Washing' },
                        { key: 'attire', label: 'Attire' },
                        { key: 'special1', label: 'Special 1' },
                        { key: 'special2', label: 'Special 2' },
                        { key: 'special3', label: 'Special 3' },
                    ].map(comp => {
                        const components = formData.leaveWagesComponents || INITIAL_STATUTORY_CONFIG.leaveWagesComponents;
                        const isActive = components[comp.key as keyof typeof components];
                        return (
                            <button
                                key={comp.key}
                                onClick={() => handleLeaveWagesToggle(comp.key as any)}
                                className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold transition-all ${
                                    isActive
                                    ? 'bg-emerald-600 border-emerald-400 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-500'
                                }`}
                            >
                                {isActive ? <CheckSquare size={14} /> : <Square size={14} />}
                                <span className="truncate">{comp.label}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="flex justify-end">
                    <span className="text-[10px] text-slate-500 italic">* Default logic uses Basic + DA. Adjust according to company policy.</span>
                </div>
            </div>
        </div>

        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <ScrollText className="text-amber-400" size={20} />
                    <h3 className="font-bold uppercase tracking-widest text-xs text-amber-400">Professional Tax (PT) Matrix</h3>
                </div>
                <div className="flex items-center gap-4">
                    <select className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none" value={selectedStatePreset} onChange={handleStatePresetChange}>
                        {Object.keys(PT_STATE_PRESETS).map(s => <option key={s} value={s}>{s} Preset</option>)}
                    </select>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-slate-700 text-blue-500 bg-slate-900" checked={formData.enableProfessionalTax} onChange={e => setFormData({...formData, enableProfessionalTax: e.target.checked})} />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Enable PT</span>
                    </label>
                </div>
            </div>
            
            {formData.enableProfessionalTax && (
            <div className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Deduction Cycle:</span>
                    <div className="flex gap-2">
                        {['Monthly', 'HalfYearly'].map(c => (
                            <button key={c} onClick={() => setFormData({...formData, ptDeductionCycle: c as any})} className={`px-4 py-1.5 rounded-full text-[10px] font-bold border transition-all ${formData.ptDeductionCycle === c ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>{c}</button>
                        ))}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-800">
                            <tr>
                                <th className="pb-3">Min Earnings (₹)</th>
                                <th className="pb-3">Max Earnings (₹)</th>
                                <th className="pb-3">Deduction (₹)</th>
                                <th className="pb-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {formData.ptSlabs.map((slab, i) => (
                                <tr key={i} className="group">
                                    <td className="py-3"><input type="number" className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white w-24 font-mono" value={slab.min} onChange={e => handleSlabChange(i, 'min', +e.target.value)} /></td>
                                    <td className="py-3"><input type="number" className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white w-24 font-mono" value={slab.max} onChange={e => handleSlabChange(i, 'max', +e.target.value)} /></td>
                                    <td className="py-3"><input type="number" className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white w-24 font-mono font-bold text-amber-400" value={slab.amount} onChange={e => handleSlabChange(i, 'amount', +e.target.value)} /></td>
                                    <td className="py-3 text-right"><button onClick={() => handleDeleteSlab(i)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button onClick={handleAddSlab} className="mt-4 flex items-center gap-2 text-[10px] font-bold text-sky-400 hover:text-sky-300"><Plus size={14} /> Add Slab Row</button>
                </div>
            </div>
            )}
        </div>

        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <HandCoins className="text-emerald-400" size={20} />
                    <h3 className="font-bold uppercase tracking-widest text-xs text-emerald-400">Labour Welfare Fund (LWF)</h3>
                </div>
                <div className="flex items-center gap-4">
                    <select className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none" value={selectedLWFState} onChange={handleLWFStateChange}>
                        {Object.keys(LWF_STATE_PRESETS).map(s => <option key={s} value={s}>{s} Preset</option>)}
                    </select>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-slate-700 text-emerald-500 bg-slate-900" checked={formData.enableLWF} onChange={e => setFormData({...formData, enableLWF: e.target.checked})} />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Enable LWF</span>
                    </label>
                </div>
            </div>
            {formData.enableLWF && (
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Cycle</label>
                        <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.lwfDeductionCycle} onChange={e => setFormData({...formData, lwfDeductionCycle: e.target.value as any})}>
                            <option value="Monthly">Monthly</option>
                            <option value="HalfYearly">Half-Yearly</option>
                            <option value="Yearly">Yearly</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">EE Contribution (₹)</label>
                        <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.lwfEmployeeContribution} onChange={e => setFormData({...formData, lwfEmployeeContribution: +e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">ER Contribution (₹)</label>
                        <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.lwfEmployerContribution} onChange={e => setFormData({...formData, lwfEmployerContribution: +e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Total (₹)</label>
                        <div className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-emerald-400 font-mono font-bold">
                            {(formData.lwfEmployeeContribution + formData.lwfEmployerContribution).toLocaleString()}
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
      )}

      {activeTab === 'COMPANY' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden p-8">
                <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                    <ImageIcon className="text-amber-400" size={24} />
                    <h3 className="font-bold text-sky-400 uppercase tracking-widest text-sm">Establishment Branding</h3>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="relative group shrink-0">
                        <div className="w-32 h-32 rounded-full border-4 border-slate-800 bg-white shadow-2xl overflow-hidden">
                            <img src={currentLogo} className="w-full h-full object-cover" alt="Establishment Logo" />
                        </div>
                        <button onClick={() => logoInputRef.current?.click()} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-full flex items-center justify-center transition-opacity">
                            <Camera className="text-white" size={24} />
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-bold text-white text-lg">Company Logo</h4>
                            <p className="text-xs text-slate-400 mt-1">This logo will appear on all Pay Slips, Reports, and the Login screen.</p>
                        </div>
                        <button onClick={() => logoInputRef.current?.click()} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2">
                            <Upload size={14} /> Upload New Logo
                        </button>
                        <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
                    </div>
                </div>
            </div>

            <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden p-8">
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
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1">Legal Identity & Identification</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Establishment Name*</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.establishmentName} onChange={e => setProfileData({...profileData, establishmentName: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Trade Name (If Any)</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.tradeName} onChange={e => setProfileData({...profileData, tradeName: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-sky-400 uppercase">CIN No (Corporate ID)*</label>
                                <input type="text" className="w-full bg-slate-900 border border-sky-900/50 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-sky-500" value={profileData.cin} onChange={e => setProfileData({...profileData, cin: e.target.value})} placeholder="U00000XX0000XXX000000" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-sky-400 uppercase">LIN No (Labour ID)*</label>
                                <input type="text" className="w-full bg-slate-900 border border-sky-900/50 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-sky-500" value={profileData.lin} onChange={e => setProfileData({...profileData, lin: e.target.value})} placeholder="L0000000000" />
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-3">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1 mt-2">Registration Codes</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">PF Code</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono" value={profileData.pfCode} onChange={e => setProfileData({...profileData, pfCode: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">ESI Code</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono" value={profileData.esiCode} onChange={e => setProfileData({...profileData, esiCode: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">GST No</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono" value={profileData.gstNo} onChange={e => setProfileData({...profileData, gstNo: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">PAN No</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono" value={profileData.pan} onChange={e => setProfileData({...profileData, pan: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-3">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1 mt-2">Address Details (Registered Office)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Door No / Flat No</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.doorNo} onChange={e => setProfileData({...profileData, doorNo: e.target.value})} />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Building Name / Landmark</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.buildingName} onChange={e => setProfileData({...profileData, buildingName: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Street</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.street} onChange={e => setProfileData({...profileData, street: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Locality</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.locality} onChange={e => setProfileData({...profileData, locality: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Area</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.area} onChange={e => setProfileData({...profileData, area: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">City / Town</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.city} onChange={e => setProfileData({...profileData, city: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">State / Union Territory</label>
                                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.state} onChange={e => setProfileData({...profileData, state: e.target.value})}>
                                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Pin Code</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.pincode} onChange={e => setProfileData({...profileData, pincode: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-3">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1 mt-2">Contact & Online Presence</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Phone size={10} /> Mobile No</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono" value={profileData.mobile} onChange={e => setProfileData({...profileData, mobile: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Phone size={10} /> Land Line (Telephone)</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono" value={profileData.telephone} onChange={e => setProfileData({...profileData, telephone: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Mail size={10} /> Official Email</label>
                                <input type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Globe size={10} /> Corporate Website</label>
                                <input type="url" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono" value={profileData.website} onChange={e => setProfileData({...profileData, website: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Nature of Business</label>
                                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.natureOfBusiness} onChange={e => setProfileData({...profileData, natureOfBusiness: e.target.value})}>
                                    {NATURE_OF_BUSINESS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'DEVELOPER' && userRole === 'Developer' && (
        <div className="bg-[#1e293b] rounded-2xl border border-indigo-900/40 shadow-xl overflow-hidden p-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-900/30 text-indigo-400 rounded-lg border border-indigo-500/20">
                        <Lock size={24} />
                    </div>
                    <div>
                    <h3 className="font-bold text-indigo-400 uppercase tracking-widest text-sm">System & Developer Controls</h3>
                    <p className="text-xs text-slate-400">Restricted parameters for application maintenance.</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Megaphone size={12} className="text-amber-500" /> Dashboard News Ticker</label>
                    <textarea rows={3} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-medium" value={profileData.flashNews || ''} onChange={e => setProfileData({...profileData, flashNews: e.target.value})} placeholder="Enter scrolling news text..." />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Globe size={12} className="text-sky-500" /> AI Studio Integration URL</label>
                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono" value={profileData.externalAppUrl || ''} onChange={e => setProfileData({...profileData, externalAppUrl: e.target.value})} placeholder="https://..." />
                </div>
                <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><MessageSquare size={12} className="text-indigo-400" /> Post-Login Modal Message</label>
                    <textarea rows={4} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono" value={profileData.postLoginMessage || ''} onChange={e => setProfileData({...profileData, postLoginMessage: e.target.value})} placeholder="Markdown supported for system notices..." />
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
                {hasData && (
                    <div className="bg-[#0f172a] p-6 rounded-xl border border-slate-800 hover:border-blue-500/50 transition-all group">
                        <div className="p-3 bg-blue-900/20 text-blue-400 rounded-full w-fit mb-4 group-hover:scale-110 transition-transform">
                            <Download size={24} />
                        </div>
                        <h4 className="font-bold text-white mb-2">Backup Data</h4>
                        <p className="text-xs text-slate-400 mb-6 leading-relaxed">Create a secure, encrypted backup file (.enc) of your entire system data.</p>
                        <button onClick={() => { setBackupMode('EXPORT'); setShowBackupModal(true); setEncryptionKey(''); }} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2">
                            <Download size={16} /> Create Backup
                        </button>
                    </div>
                )}
                <div className={`bg-[#0f172a] p-6 rounded-xl border border-slate-800 hover:border-emerald-500/50 transition-all group ${!hasData ? 'md:col-span-2' : ''}`}>
                    <div className="p-3 bg-emerald-900/20 text-emerald-400 rounded-full w-fit mb-4 group-hover:scale-110 transition-transform">
                        <Upload size={24} />
                    </div>
                    <h4 className="font-bold text-white mb-2">Restore Data</h4>
                    <p className="text-xs text-slate-400 mb-6 leading-relaxed">Restore system from an encrypted file. Overwrites current session.</p>
                    <button onClick={() => { setBackupMode('IMPORT'); setShowBackupModal(true); setEncryptionKey(''); }} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2">
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
                            <p className="text-xs text-red-300/60">Permanently delete all data.</p>
                        </div>
                    </div>
                    <button onClick={() => { setShowResetModal(true); setResetPassword(''); setResetError(''); }} className="px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-lg text-xs font-bold transition-all">Factory Reset</button>
                </div>
            </div>
        </div>
      )}

      {activeTab !== 'DATA' && (
      <div className="flex justify-between items-center p-2 pt-6 border-t border-slate-800">
        <div></div>
        <button onClick={handleSave} className={`flex items-center gap-3 px-10 py-4 rounded-2xl font-black transition-all shadow-2xl ${saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
          {saved ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
          {saved ? 'CONFIGURATION SAVED!' : 'UPDATE ALL PARAMETERS'}
        </button>
      </div>
      )}

       {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-sm rounded-2xl border border-red-900/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setShowResetModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                <div className="flex flex-col items-center gap-2">
                    <div className="p-4 bg-red-900/20 text-red-500 rounded-full border border-red-900/50 mb-2">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-black text-white text-center">FACTORY RESET</h3>
                    <p className="text-xs text-red-300 text-center leading-relaxed">CRITICAL WARNING: This action is IRREVERSIBLE.</p>
                </div>
                <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 text-sm text-slate-400 mb-2"><KeyRound size={16} /><span>Confirm Identity</span></div>
                    <input type="password" placeholder="Enter Login Password" autoFocus className={`w-full bg-[#0f172a] border ${resetError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-red-500 transition-all`} value={resetPassword} onChange={(e) => { setResetPassword(e.target.value); setResetError(''); }} onKeyDown={(e) => e.key === 'Enter' && executeFactoryReset()} />
                    {resetError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{resetError}</p>}
                </div>
                <button onClick={executeFactoryReset} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2">
                    <Trash2 size={18} /> CONFIRM DELETE ALL DATA
                </button>
            </div>
        </div>
       )}

       {showBackupModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                {!isProcessing && (
                    <button onClick={() => setShowBackupModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                )}
                <div className="flex flex-col items-center gap-2">
                    <div className={`p-4 rounded-full border mb-2 transition-all duration-500 ${processProgress === 100 ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/50' : isProcessing ? 'bg-indigo-900/30 text-indigo-400 border-indigo-500/50' : 'bg-blue-900/20 text-blue-400 border-blue-900/50'}`}>
                        {processProgress === 100 ? <CheckCircle2 size={32} /> : isProcessing ? <Loader2 size={32} className="animate-spin" /> : <Lock size={32} />}
                    </div>
                    <h3 className="text-xl font-black text-white text-center">
                        {isProcessing ? (backupMode === 'EXPORT' ? 'Exporting Data...' : 'Restoring System...') : (backupMode === 'EXPORT' ? 'Encrypted Export' : 'Secure Restore')}
                    </h3>
                </div>
                {isProcessing ? (
                    <div className="w-full py-6 px-2 space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-end mb-2">
                                <span className={`text-xs font-bold uppercase tracking-widest transition-colors duration-300 ${processProgress === 100 ? 'text-emerald-400 text-sm animate-pulse' : 'text-slate-400'}`}>{processStatus}</span>
                                <span className={`text-xs font-bold font-mono ${processProgress === 100 ? 'text-emerald-400' : 'text-slate-500'}`}>{processProgress}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                                <div className={`h-full transition-all duration-300 ease-out ${backupMode === 'EXPORT' ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]'}`} style={{ width: `${processProgress}%` }}></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 mt-2 w-full">
                        {backupMode === 'IMPORT' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Select Backup File</label>
                                <input type="file" ref={backupFileRef} className="w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700" accept=".enc" />
                            </div>
                        )}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">{backupMode === 'EXPORT' ? 'Set Encryption Password' : 'Enter Decryption Password'}</label>
                            <input type="password" placeholder="Enter Password" className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={encryptionKey} onChange={(e) => setEncryptionKey(e.target.value)} />
                        </div>
                        <button onClick={backupMode === 'EXPORT' ? () => requireAuth(handleEncryptedExport) : () => { const file = backupFileRef.current?.files?.[0]; if (!file || !encryptionKey) { alert("Please select a file and enter password."); return; } requireAuth(initiateRestore); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                            {backupMode === 'EXPORT' ? 'DOWNLOAD BACKUP' : 'RESTORE DATA'}
                        </button>
                    </div>
                )}
            </div>
        </div>
       )}

       {showAuthModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-indigo-500/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                <div className="flex flex-col items-center gap-2">
                    <div className="p-4 bg-indigo-900/20 text-indigo-500 rounded-full border border-indigo-900/50 mb-2">
                        <KeyRound size={32} />
                    </div>
                    <h3 className="text-xl font-black text-white text-center">AUTHORIZE ACTION</h3>
                </div>
                <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <input type="password" placeholder="Login Password" autoFocus className={`w-full bg-[#0f172a] border ${authError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all`} value={authPassword} onChange={(e) => { setAuthPassword(e.target.value); setAuthError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleAuthSubmit()} />
                    {authError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{authError}</p>}
                </div>
                <button onClick={handleAuthSubmit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                    <CheckCircle2 size={18} /> VERIFY & PROCEED
                </button>
            </div>
        </div>
       )}
    </div>
  );
};

export default Settings;
