import React, { useState } from 'react';
import { Plus, Trash2, Save, Building, MapPin, Briefcase, Network, Search, X, ShieldCheck, Download, Upload, Database, Lock } from 'lucide-react';
import { LeavePolicy } from '../types';
import CryptoJS from 'crypto-js';

interface MasterManagerProps {
  title: string;
  items: string[];
  setItems: (items: string[]) => void;
  icon: any;
  showAlert: (type: 'success' | 'error' | 'info' | 'warning' | 'confirm', title: string, message: string, onConfirm?: () => void) => void;
}

const MasterManager: React.FC<MasterManagerProps> = ({ title, items, setItems, icon: Icon, showAlert }) => {
  const [newItem, setNewItem] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const handleAdd = () => {
    if (!newItem.trim()) return;
    if (items.includes(newItem.trim())) {
      showAlert('warning', 'Duplicate Item', 'This item already exists in the master list.');
      return;
    }
    setItems([...items, newItem.trim()]);
    setNewItem('');
  };

  const handleDelete = (item: string) => {
    showAlert('confirm', 'Confirm Deletion', `Are you sure you want to delete "${item}" from the ${title}?`, () => {
      setItems(items.filter(i => i !== item));
    });
  };

  const filteredItems = items.filter(i => i.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[600px]">
      <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-900/30 text-blue-400 rounded-lg border border-blue-500/20">
            <Icon size={20} />
          </div>
          <h3 className="font-bold text-sky-400 uppercase tracking-widest text-sm">{title}</h3>
        </div>
        <span className="text-xs text-slate-500 font-mono">Count: {items.length}</span>
      </div>

      <div className="p-6 space-y-4 border-b border-slate-800">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={`Add new ${title.toLowerCase().split(' ')[0]}...`}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            title="Add New Item"
            className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg transition-colors shadow-lg"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search items..."
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-300 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-1 gap-1">
          {filteredItems.map((item, idx) => (
            <div key={idx} className="group flex items-center justify-between p-3 rounded-lg hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700">
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{item}</span>
              <button
                onClick={() => handleDelete(item)}
                title="Delete Item"
                className="text-slate-600 hover:text-red-400 p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {filteredItems.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 py-10">
              <Icon size={48} className="opacity-10 mb-2" />
              <p className="text-xs italic">No records found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface UtilitiesProps {
  designations: string[];
  setDesignations: (items: string[]) => void;
  divisions: string[];
  setDivisions: (items: string[]) => void;
  branches: string[];
  setBranches: (items: string[]) => void;
  sites: string[];
  setSites: (items: string[]) => void;
  onNuclearReset: () => void;
  showAlert: (type: 'success' | 'error' | 'info' | 'warning' | 'confirm', title: string, message: string, onConfirm?: () => void) => void;
}

const Utilities: React.FC<UtilitiesProps> = (props) => {
  const [showPassModal, setShowPassModal] = useState(false);
  const [passMode, setPassMode] = useState<'BACKUP' | 'RESTORE' | null>(null);
  const [passInput, setPassInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleBackup = (password: string) => {
    const allKeys = [
      'employees', 'config', 'companyProfile', 'attendance',
      'leaveLedgers', 'advanceLedgers', 'payrollHistory',
      'fines', 'leavePolicy', 'arrearHistory'
    ];
    const exportData: any = {};
    allKeys.forEach(k => {
      const val = localStorage.getItem(`app_${k}`);
      if (val) exportData[k] = JSON.parse(val);
    });

    exportData.masters = {
      designations: JSON.parse(localStorage.getItem('app_master_designations') || '[]'),
      divisions: JSON.parse(localStorage.getItem('app_master_divisions') || '[]'),
      branches: JSON.parse(localStorage.getItem('app_master_branches') || '[]'),
      sites: JSON.parse(localStorage.getItem('app_master_sites') || '[]'),
    };

    const rawLogo = localStorage.getItem('app_logo');
    if (rawLogo) {
      try {
        exportData.logo = rawLogo.startsWith('"') ? JSON.parse(rawLogo) : rawLogo;
      } catch (e) { exportData.logo = rawLogo; }
    }

    exportData.timestamp = new Date().toISOString();
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(exportData), password).toString();

    const blob = new Blob([encrypted], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateTag = new Date().toISOString().split('T')[0];
    a.download = `PMS_Backup_Secure_${dateTag}.enc`;
    a.click();
    URL.revokeObjectURL(url);
    props.showAlert('success', 'Backup Created', '✅ Secure backup created successfully!');
  };

  const handleRestore = (password: string) => {
    if (!selectedFile) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      try {
        const encrypted = re.target?.result as string;
        let decryptedString = '';

        try {
          const bytes = CryptoJS.AES.decrypt(encrypted, password);
          decryptedString = bytes.toString(CryptoJS.enc.Utf8);

          if (!decryptedString) {
            const legacyBytes = CryptoJS.AES.decrypt(encrypted, 'BPP-2026-SECURE');
            decryptedString = legacyBytes.toString(CryptoJS.enc.Utf8);
          }

          if (!decryptedString) throw new Error("Invalid decryption");
        } catch (e) {
          props.showAlert('error', 'Decryption Failed', '❌ Incorrect password or corrupted backup file.');
          return;
        }

        const data = JSON.parse(decryptedString);

        const currentSession = localStorage.getItem('app_session_user');
        const currentLicense = localStorage.getItem('app_license');
        const currentSetup = localStorage.getItem('app_setup_complete');

        localStorage.clear();

        if (currentSession) localStorage.setItem('app_session_user', currentSession);
        if (currentLicense) localStorage.setItem('app_license', currentLicense);
        localStorage.setItem('app_setup_complete', currentSetup || 'true');

        const getVal = (key: string) => data[key] || data[`app_${key}`];
        const keysToRestore = [
          'employees', 'config', 'companyProfile', 'attendance',
          'leaveLedgers', 'advanceLedgers', 'payrollHistory',
          'fines', 'leavePolicy', 'arrearHistory', 'logo', 'users'
        ];

        keysToRestore.forEach(k => {
          const val = getVal(k);
          if (val) localStorage.setItem(`app_${k}`, JSON.stringify(val));
        });

        const masters = data.masters || data.app_masters;
        if (masters) {
          localStorage.setItem('app_master_designations', JSON.stringify(masters.designations));
          localStorage.setItem('app_master_divisions', JSON.stringify(masters.divisions));
          localStorage.setItem('app_master_branches', JSON.stringify(masters.branches));
          localStorage.setItem('app_master_sites', JSON.stringify(masters.sites));
        }

        props.showAlert('success', 'Restore Complete', '✅ Restoration successful! The application will now reload.');
        setTimeout(() => window.location.reload(), 1500);

      } catch (err) {
        props.showAlert('error', 'Restore Failed', '❌ Restoration failed: Invalid data format.');
      }
    };
    reader.readAsText(selectedFile);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-blue-900/10 border border-blue-800/30 p-6 rounded-2xl flex gap-4 items-center">
        <div className="bg-blue-600 p-3 rounded-xl text-white shadow-lg shadow-blue-900/40">
          <Network size={28} />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">Organizational Hierarchy & Utilities</h2>
          <p className="text-sm text-slate-400">Manage master data used across the Employee and Payroll modules.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MasterManager title="Designation Master" items={props.designations} setItems={props.setDesignations} icon={Briefcase} showAlert={props.showAlert} />
        <MasterManager title="Division Master" items={props.divisions} setItems={props.setDivisions} icon={Network} showAlert={props.showAlert} />
        <MasterManager title="Branch Master" items={props.branches} setItems={props.setBranches} icon={Building} showAlert={props.showAlert} />
        <MasterManager title="Site Master" items={props.sites} setItems={props.setSites} icon={MapPin} showAlert={props.showAlert} />
      </div>

      {/* Data Operations Section */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 mt-12 shadow-2xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-emerald-900/30 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <Database size={28} />
          </div>
          <div>
            <h3 className="text-xl font-black text-white">Data Safety & Backups</h3>
            <p className="text-sm text-slate-400">Securely export your data for migration or safety.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => {
              setPassInput('');
              setPassMode('BACKUP');
              setShowPassModal(true);
            }}
            className="group flex items-center gap-6 p-6 bg-[#0f172a] hover:bg-emerald-900/20 border border-slate-800 hover:border-emerald-500/50 rounded-2xl transition-all shadow-xl hover:-translate-y-1"
          >
            <div className="p-4 bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-colors">
              <Lock size={24} />
            </div>
            <div className="text-left">
              <span className="block font-bold text-white text-lg">Secure .enc Backup</span>
              <span className="block text-xs text-slate-500 mt-1">Unified encrypted export (User Password)</span>
            </div>
            <Download className="ml-auto text-slate-700 group-hover:text-emerald-400 transition-colors" size={20} />
          </button>

          <div className="relative group overflow-hidden rounded-2xl border border-slate-800 p-[1px]">
            <div className="bg-[#0f172a] p-6 flex items-center gap-6 rounded-2xl h-full w-full">
              <div className="p-4 bg-blue-500/10 text-blue-400 rounded-xl">
                <Upload size={24} />
              </div>
              <div className="text-left flex-1">
                <span className="block font-bold text-white text-lg">Restore Data</span>
                <input
                  type="file"
                  accept=".enc"
                  title="Select Backup File"
                  placeholder="Select Backup File"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setSelectedFile(file);
                    setPassInput('');
                    setPassMode('RESTORE');
                    setShowPassModal(true);
                  }}
                  className="mt-2 block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-red-500/20">
          <div className="bg-red-950/20 border border-red-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/10 text-red-400 rounded-xl">
                <Trash2 size={24} />
              </div>
              <div>
                <h4 className="font-bold text-red-400">Danger Zone: Factory Reset</h4>
                <p className="text-xs text-slate-500 max-w-md">This will permanently delete all data. Action is irreversible.</p>
              </div>
            </div>
            <button
              onClick={() => {
                props.showAlert('error', 'Factory Reset', '🚨 CRITICAL WARNING: This will DELETE ALL DATA and cannot be undone. Are you absolutely sure?', () => {
                  props.onNuclearReset();
                });
              }}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-900/40 transition-all active:scale-95"
            >
              Start Factory Reset
            </button>
          </div>
        </div>
      </div>

      {/* Password Entry Modal */}
      {showPassModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-0 flex flex-col relative overflow-hidden">
            <div className={`${passMode === 'BACKUP' ? 'bg-emerald-900/30 border-emerald-500/30' : 'bg-blue-900/30 border-blue-500/30'} p-6 border-b flex items-center gap-4`}>
              <div className={`p-3 rounded-xl shadow-lg shadow-black/20 ${passMode === 'BACKUP' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                <Lock size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">{passMode === 'BACKUP' ? 'Secure Backup' : 'Data Restoration'}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{passMode === 'BACKUP' ? 'Set encryption password' : 'Enter decryption password'}</p>
              </div>
              <button onClick={() => setShowPassModal(false)} title="Close Password Modal" className="ml-auto p-2 text-slate-500 hover:text-white transition-colors bg-slate-900/50 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Password Key</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                  <input
                    autoFocus
                    type="password"
                    value={passInput}
                    onChange={e => setPassInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-3.5 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && passInput) {
                        if (passMode === 'BACKUP') {
                          handleBackup(passInput);
                          setShowPassModal(false);
                          setPassInput('');
                        } else {
                          props.showAlert('confirm', 'Confirm Restore', '⚠️ Warning: This will overwrite ALL your current data. Do you want to proceed?', () => {
                            handleRestore(passInput);
                          });
                          setShowPassModal(false);
                          setPassInput('');
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                  <span className="text-amber-500 font-bold">IMPORTANT:</span> This password is used for AES-256 encryption. If lost, the backup data cannot be recovered.
                </p>
              </div>
            </div>
            <div className="p-4 bg-[#1e293b] border-t border-slate-800 flex gap-3">
              <button onClick={() => setShowPassModal(false)} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all text-sm uppercase tracking-widest">Cancel</button>
              <button
                disabled={!passInput}
                onClick={() => {
                  if (passMode === 'BACKUP') {
                    handleBackup(passInput);
                    setShowPassModal(false);
                    setPassInput('');
                  } else {
                    props.showAlert('confirm', 'Confirm Overwrite', '⚠️ Warning: This will overwrite ALL your current data. Proceed?', () => {
                      handleRestore(passInput);
                      setPassInput('');
                    });
                    setShowPassModal(false);
                  }
                }}
                className={`flex-1 px-4 py-3 ${passMode === 'BACKUP' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-xl font-black transition-all text-xs uppercase tracking-[0.15em] disabled:opacity-50`}
              >
                {passMode === 'BACKUP' ? 'Create Backup' : 'Verify & Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Utilities;
