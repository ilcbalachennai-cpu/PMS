import React, { useState, useRef } from 'react';
import { Save, Upload, Download, RefreshCw, Building2, ShieldCheck, Palette, Database, AlertTriangle, FileText, Briefcase, MapPin, Lock, X, KeyRound, HelpCircle, Image as ImageIcon, ScrollText, Trash2, Plus } from 'lucide-react';
import { StatutoryConfig, CompanyProfile, LeavePolicy, PFComplianceType } from '../types';
import { BRAND_CONFIG, NATURE_OF_BUSINESS_OPTIONS, PT_STATE_PRESETS, INDIAN_STATES } from '../constants';
import CryptoJS from 'crypto-js';

interface SettingsProps {
  config: StatutoryConfig;
  setConfig: (c: StatutoryConfig) => void;
  companyProfile: CompanyProfile;
  setCompanyProfile: (p: CompanyProfile) => void;
  currentLogo: string;
  setLogo: (url: string) => void;
  leavePolicy: LeavePolicy;
  setLeavePolicy: (l: LeavePolicy) => void;
  onRestore: () => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  config, setConfig, 
  companyProfile, setCompanyProfile, 
  currentLogo, setLogo, 
  leavePolicy, setLeavePolicy,
  onRestore 
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'statutory' | 'leave' | 'data'>('general');
  const [saved, setSaved] = useState(false);
  
  // Encrypted Backup State
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [backupMode, setBackupMode] = useState<'EXPORT' | 'IMPORT'>('EXPORT');
  const backupFileRef = useRef<HTMLInputElement>(null);

  // Factory Reset State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const SUPERVISOR_PASSWORD = "admin";

  const handleEncryptedExport = () => {
    if (!encryptionKey) {
        alert("Please enter a secure password to encrypt your data.");
        return;
    }

    try {
        const dataBundle = {
            employees: JSON.parse(localStorage.getItem('app_employees') || '[]'),
            config: JSON.parse(localStorage.getItem('app_config') || '{}'),
            companyProfile: JSON.parse(localStorage.getItem('app_company_profile') || '{}'),
            attendance: JSON.parse(localStorage.getItem('app_attendance') || '[]'),
            leaveLedgers: JSON.parse(localStorage.getItem('app_leave_ledgers') || '[]'),
            advanceLedgers: JSON.parse(localStorage.getItem('app_advance_ledgers') || '[]'),
            payrollHistory: JSON.parse(localStorage.getItem('app_payroll_history') || '[]'),
            leavePolicy: JSON.parse(localStorage.getItem('app_leave_policy') || '{}'),
            masters: {
                designations: JSON.parse(localStorage.getItem('app_master_designations') || '[]'),
                divisions: JSON.parse(localStorage.getItem('app_master_divisions') || '[]'),
                branches: JSON.parse(localStorage.getItem('app_master_branches') || '[]'),
                sites: JSON.parse(localStorage.getItem('app_master_sites') || '[]'),
            },
            logo: localStorage.getItem('app_logo'),
            timestamp: new Date().toISOString()
        };

        const jsonString = JSON.stringify(dataBundle);
        const encrypted = CryptoJS.AES.encrypt(jsonString, encryptionKey).toString();

        const blob = new Blob([encrypted], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `BharatPay_Secure_Backup_${dateStr}.enc`;
        a.click();
        
        setShowBackupModal(false);
        setEncryptionKey('');
        alert("Encrypted Backup downloaded successfully. Keep your password safe!");
    } catch (e) {
        console.error(e);
        alert("Encryption failed.");
    }
  };

  const handleEncryptedImport = () => {
      const file = backupFileRef.current?.files?.[0];
      if (!file || !encryptionKey) {
          alert("Please select a file and enter the decryption password.");
          return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const encryptedContent = e.target?.result as string;
              
              const bytes = CryptoJS.AES.decrypt(encryptedContent, encryptionKey);
              const decryptedString = bytes.toString(CryptoJS.enc.Utf8);

              if (!decryptedString) {
                  throw new Error("Wrong Password or Corrupt File");
              }

              const data = JSON.parse(decryptedString);

              // 1. Clear existing
              const currentSession = localStorage.getItem('app_session_user');
              localStorage.clear();
              if (currentSession) localStorage.setItem('app_session_user', currentSession);

              // 2. Restore
              if (data.employees) localStorage.setItem('app_employees', JSON.stringify(data.employees));
              if (data.config) localStorage.setItem('app_config', JSON.stringify(data.config));
              if (data.companyProfile) localStorage.setItem('app_company_profile', JSON.stringify(data.companyProfile));
              if (data.attendance) localStorage.setItem('app_attendance', JSON.stringify(data.attendance));
              if (data.leaveLedgers) localStorage.setItem('app_leave_ledgers', JSON.stringify(data.leaveLedgers));
              if (data.advanceLedgers) localStorage.setItem('app_advance_ledgers', JSON.stringify(data.advanceLedgers));
              if (data.payrollHistory) localStorage.setItem('app_payroll_history', JSON.stringify(data.payrollHistory));
              if (data.leavePolicy) localStorage.setItem('app_leave_policy', JSON.stringify(data.leavePolicy));
              if (data.logo) localStorage.setItem('app_logo', data.logo);
              
              if (data.masters) {
                  localStorage.setItem('app_master_designations', JSON.stringify(data.masters.designations));
                  localStorage.setItem('app_master_divisions', JSON.stringify(data.masters.divisions));
                  localStorage.setItem('app_master_branches', JSON.stringify(data.masters.branches));
                  localStorage.setItem('app_master_sites', JSON.stringify(data.masters.sites));
              }

              alert("Data Successfully Imported");
              onRestore();
              window.location.reload();

          } catch (err: any) {
              console.error(err);
              if (err.message === "Wrong Password or Corrupt File") {
                  alert("Decryption Failed: Incorrect password or invalid file format.");
              } else {
                  alert(`Restore Error: ${err.message}`);
              }
          }
      };
      reader.readAsText(file);
  };

  const executeFactoryReset = () => {
      if (resetPassword === SUPERVISOR_PASSWORD) {
          localStorage.clear();
          alert("System has been successfully reset. The application will now restart.");
          onRestore();
          window.location.reload();
      } else {
          setResetError("Incorrect Password. Access Denied.");
      }
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-900/30 text-blue-400 rounded-xl border border-blue-500/20">
                <Building2 size={28} />
            </div>
            <div>
                <h2 className="text-xl font-black text-white">System Configuration</h2>
                <p className="text-slate-400 text-sm">Manage company profile, statutory rules, and data.</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Nav */}
        <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-2 space-y-1 h-fit">
            <button 
                onClick={() => setActiveTab('general')}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 font-bold transition-colors ${activeTab === 'general' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
                <Briefcase size={18} /> General
            </button>
            <button 
                onClick={() => setActiveTab('statutory')}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 font-bold transition-colors ${activeTab === 'statutory' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
                <ShieldCheck size={18} /> Statutory
            </button>
            <button 
                onClick={() => setActiveTab('leave')}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 font-bold transition-colors ${activeTab === 'leave' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
                <FileText size={18} /> Leave Policy
            </button>
            <button 
                onClick={() => setActiveTab('data')}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 font-bold transition-colors ${activeTab === 'data' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
                <Database size={18} /> Data Management
            </button>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
            
            {/* General Settings */}
            {activeTab === 'general' && (
                <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-6 shadow-xl space-y-6">
                    <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Company Profile</h3>
                    
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Logo Upload */}
                        <div className="shrink-0">
                            <label className="block w-32 h-32 rounded-xl bg-slate-900 border-2 border-dashed border-slate-700 hover:border-blue-500 cursor-pointer flex flex-col items-center justify-center gap-2 transition-colors relative overflow-hidden group">
                                <img src={currentLogo} alt="Logo" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Upload className="text-white" size={24} />
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                            </label>
                            <span className="text-xs text-slate-500 block text-center mt-2">Company Logo</span>
                        </div>
                        
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 uppercase">Establishment Name</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none" value={companyProfile.establishmentName} onChange={e => setCompanyProfile({...companyProfile, establishmentName: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 uppercase">City</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none" value={companyProfile.city} onChange={e => setCompanyProfile({...companyProfile, city: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 uppercase">State</label>
                                <select 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none"
                                    value={companyProfile.state} 
                                    onChange={e => setCompanyProfile({...companyProfile, state: e.target.value})}
                                >
                                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 uppercase">Nature of Business</label>
                                <select 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none"
                                    value={companyProfile.natureOfBusiness} 
                                    onChange={e => setCompanyProfile({...companyProfile, natureOfBusiness: e.target.value})}
                                >
                                    {NATURE_OF_BUSINESS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 uppercase">PF Code</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none" value={companyProfile.pfCode} onChange={e => setCompanyProfile({...companyProfile, pfCode: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 uppercase">ESI Code</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none" value={companyProfile.esiCode} onChange={e => setCompanyProfile({...companyProfile, esiCode: e.target.value})} />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-xs font-bold text-slate-400 uppercase">Address</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none" value={companyProfile.address} onChange={e => setCompanyProfile({...companyProfile, address: e.target.value})} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Statutory Settings */}
            {activeTab === 'statutory' && (
                <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-6 shadow-xl space-y-6">
                    <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Statutory Configuration</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* PF */}
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldCheck className="text-blue-400" size={20} />
                                <h4 className="font-bold text-white">Provident Fund (EPF)</h4>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 uppercase">Compliance Type</label>
                                <select 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none"
                                    value={config.pfComplianceType}
                                    onChange={e => setConfig({...config, pfComplianceType: e.target.value as any})}
                                >
                                    <option value="Statutory">Statutory (Mandatory for 20+ Emp)</option>
                                    <option value="Voluntary">Voluntary (Less than 20 Emp)</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Wage Ceiling</label>
                                    <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none" value={config.epfCeiling} onChange={e => setConfig({...config, epfCeiling: +e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Employee Rate</label>
                                    <input type="number" step="0.01" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none" value={config.epfEmployeeRate} onChange={e => setConfig({...config, epfEmployeeRate: +e.target.value})} />
                                </div>
                            </div>
                        </div>

                        {/* ESI */}
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldCheck className="text-pink-400" size={20} />
                                <h4 className="font-bold text-white">Employee State Insurance (ESI)</h4>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 uppercase">Wage Ceiling</label>
                                <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none" value={config.esiCeiling} onChange={e => setConfig({...config, esiCeiling: +e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Employee Rate</label>
                                    <input type="number" step="0.001" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none" value={config.esiEmployeeRate} onChange={e => setConfig({...config, esiEmployeeRate: +e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Employer Rate</label>
                                    <input type="number" step="0.001" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none" value={config.esiEmployerRate} onChange={e => setConfig({...config, esiEmployerRate: +e.target.value})} />
                                </div>
                            </div>
                        </div>

                        {/* PT */}
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 space-y-4 col-span-1 md:col-span-2">
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldCheck className="text-amber-400" size={20} />
                                <h4 className="font-bold text-white">Professional Tax (PT)</h4>
                            </div>
                            <p className="text-xs text-slate-400">
                                Note: PT Logic is automatically determined based on the <b>Branch Location</b> of the employee (Work Location) to comply with state-specific regulations. 
                                The setting below is the default fallback if branch location is not recognized.
                            </p>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 uppercase">Default Deduction Cycle</label>
                                <select 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none"
                                    value={config.ptDeductionCycle}
                                    onChange={e => setConfig({...config, ptDeductionCycle: e.target.value as any})}
                                >
                                    <option value="Monthly">Monthly</option>
                                    <option value="HalfYearly">Half Yearly</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Leave Policy Settings */}
            {activeTab === 'leave' && (
                <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-6 shadow-xl space-y-6">
                    <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Leave Policy Configuration</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {['el', 'sl', 'cl'].map((type) => {
                            const key = type as keyof LeavePolicy;
                            const policy = leavePolicy[key];
                            return (
                                <div key={type} className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 space-y-4">
                                    <h4 className="font-bold text-white uppercase">{policy.label}</h4>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400 uppercase">Max Per Year</label>
                                        <input 
                                            type="number" 
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none" 
                                            value={policy.maxPerYear} 
                                            onChange={e => setLeavePolicy({
                                                ...leavePolicy, 
                                                [key]: { ...policy, maxPerYear: +e.target.value }
                                            })} 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400 uppercase">Max Carry Forward</label>
                                        <input 
                                            type="number" 
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none" 
                                            value={policy.maxCarryForward} 
                                            onChange={e => setLeavePolicy({
                                                ...leavePolicy, 
                                                [key]: { ...policy, maxCarryForward: +e.target.value }
                                            })} 
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Data Management */}
            {activeTab === 'data' && (
                <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-6 shadow-xl space-y-6">
                    <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Data Management</h3>
                    
                    <div className="grid grid-cols-1 gap-4">
                        <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                            <div>
                                <h4 className="font-bold text-white">Backup Data</h4>
                                <p className="text-xs text-slate-400">Export all system data to an encrypted file.</p>
                            </div>
                            <button 
                                onClick={() => { setBackupMode('EXPORT'); setShowBackupModal(true); setEncryptionKey(''); }}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                            >
                                <Download size={16} /> Export (Encrypted)
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                            <div>
                                <h4 className="font-bold text-white">Restore Data</h4>
                                <p className="text-xs text-slate-400">Import system data from a backup file.</p>
                            </div>
                            <button 
                                onClick={() => { setBackupMode('IMPORT'); setShowBackupModal(true); setEncryptionKey(''); }}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                            >
                                <Upload size={16} /> Restore
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-red-900/10 rounded-lg border border-red-900/30">
                            <div>
                                <h4 className="font-bold text-red-400">Factory Reset</h4>
                                <p className="text-xs text-red-300/70">Permanently delete all data and reset to defaults.</p>
                            </div>
                            <button 
                                onClick={() => { setShowResetModal(true); setResetPassword(''); setResetError(''); }}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                            >
                                <RefreshCw size={16} /> Reset
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>

      {/* Backup/Restore Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setShowBackupModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                    <X size={20} />
                </button>
                <div className="flex flex-col items-center gap-2">
                    <div className="p-4 bg-blue-900/20 text-blue-400 rounded-full border border-blue-900/50 mb-2">
                        <Lock size={32} />
                    </div>
                    <h3 className="text-xl font-black text-white text-center">
                        {backupMode === 'EXPORT' ? 'Encrypted Export' : 'Secure Restore'}
                    </h3>
                    <p className="text-xs text-slate-400 text-center leading-relaxed">
                        {backupMode === 'EXPORT' 
                            ? 'Create a secure backup file for your local disk. You must set a password to encrypt this file.'
                            : 'Restore data from a backup file. Existing data will be overwritten.'}
                    </p>
                </div>
                
                <div className="space-y-4 mt-2">
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

                    {/* WARNING BLOCK */}
                    {backupMode === 'IMPORT' && (
                        <div className="bg-amber-900/20 border border-amber-900/50 p-3 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="text-amber-500 shrink-0" size={16} />
                            <p className="text-xs text-amber-200 font-medium leading-tight">
                                Existing Data if any will be overwritten from Import Data
                            </p>
                        </div>
                    )}
                    
                    <button 
                        onClick={backupMode === 'EXPORT' ? handleEncryptedExport : handleEncryptedImport}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        {backupMode === 'EXPORT' ? 'DOWNLOAD SECURE BACKUP' : 'RESTORE DATA'}
                    </button>
                </div>
            </div>
        </div>
       )}

       {/* Reset Modal */}
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

    </div>
  );
};

export default Settings;