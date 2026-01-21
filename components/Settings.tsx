
import React, { useState } from 'react';
import { Save, AlertCircle, RefreshCw, Building2, ShieldCheck, HelpCircle, Upload, Image as ImageIcon, ScrollText, Trash2, Plus, MapPin, AlertTriangle, CalendarClock } from 'lucide-react';
import { StatutoryConfig, PFComplianceType, LeavePolicy } from '../types';
import { PT_STATE_PRESETS } from '../constants';

interface SettingsProps {
  config: StatutoryConfig;
  setConfig: (config: StatutoryConfig) => void;
  currentLogo: string;
  setLogo: (url: string) => void;
  leavePolicy: LeavePolicy;
  setLeavePolicy: (policy: LeavePolicy) => void;
}

const Settings: React.FC<SettingsProps> = ({ config, setConfig, currentLogo, setLogo, leavePolicy, setLeavePolicy }) => {
  const [formData, setFormData] = useState(config);
  const [localLeavePolicy, setLocalLeavePolicy] = useState(leavePolicy);
  const [saved, setSaved] = useState(false);

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
    setLeavePolicy(localLeavePolicy);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleFactoryReset = () => {
      // First warning
      if(!confirm("⚠️ CRITICAL WARNING ⚠️\n\nYou are about to perform a FACTORY RESET.\n\nThis will PERMANENTLY DELETE:\n• All Employee Profiles\n• Attendance Records\n• Payroll History\n• Saved Settings & Logos\n\nThis action is IRREVERSIBLE.\n\nDo you want to continue?")) {
        return;
      }

      // Second confirmation with manual input
      const confirmation = prompt("To confirm deletion, please type 'DELETE' in the box below:");
      
      if(confirmation === 'DELETE') {
          // Explicitly clear all application specific keys
          const keysToRemove = [
            'app_employees',
            'app_config', 
            'app_logo',
            'app_leave_policy',
            'app_attendance', 
            'app_leave_ledgers', 
            'app_advance_ledgers', 
            'app_payroll_history',
            'app_master_designations',
            'app_master_divisions',
            'app_master_branches',
            'app_master_sites'
          ];
          
          keysToRemove.forEach(k => localStorage.removeItem(k));
          // Also clear everything just in case
          localStorage.clear();

          alert("System has been successfully reset. The application will now restart.");
          window.location.reload();
      } else {
          alert("Reset Cancelled: Verification code did not match.");
      }
  };

  return (
    <div className="max-w-4xl space-y-8 text-white">
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
        
        {/* Branding Configuration */}
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

        {/* Establishment PF Compliance */}
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

        {/* Financial Slabs */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden lg:col-span-2">
          <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sky-400">Wage Ceilings & Rates</h3>
            <button className="text-[10px] font-bold text-blue-400 hover:underline flex items-center gap-1">
              <RefreshCw size={12} /> RESET DEFAULTS
            </button>
          </div>
          
          <div className="p-8 space-y-6">
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

        {/* Leave Policy Manager - MOVED HERE */}
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

        {/* Professional Tax Configuration */}
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

      <div className="flex justify-between items-center p-2 pt-6 border-t border-slate-800">
        <button 
           onClick={handleFactoryReset}
           className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all border border-red-900/50 text-red-500 hover:bg-red-900/20 hover:text-red-400 text-xs"
        >
            <AlertTriangle size={16} /> FACTORY RESET DATA
        </button>

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
    </div>
  );
};

export default Settings;
