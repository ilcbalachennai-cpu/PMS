import React, { useState } from 'react';
import { Plus, Trash2, Building, MapPin, Briefcase, Network, Search, Download, Upload, Edit3, X, CheckCircle2, ShieldCheck, FileText, User, Phone, Mail } from 'lucide-react';
import { generateMasterTemplateXLSX, parseMasterXLSX } from '../services/excelService';
import { BranchDetail, getBranchName } from '../types';

interface MasterManagerProps {
  title: string;
  items: (string | BranchDetail)[];
  setItems: (items: (string | BranchDetail)[]) => void;
  icon: any;
  showAlert: (type: 'success' | 'error' | 'info' | 'warning' | 'confirm', title: string, message: string, onConfirm?: () => void) => void;
}

interface BranchConfigModalProps {
  branch: BranchDetail;
  onSave: (updated: BranchDetail) => void;
  onClose: () => void;
}

const BranchConfigModal: React.FC<BranchConfigModalProps> = ({ branch, onSave, onClose }) => {
  const [name, setName] = useState(branch.name || '');
  const [address, setAddress] = useState(branch.address || '');
  const [pfCode, setPfCode] = useState(branch.pfCode || '');
  const [esiCode, setEsiCode] = useState(branch.esiCode || '');
  const [ptTaxCode, setPtTaxCode] = useState(branch.ptTaxCode || '');
  const [contactPerson, setContactPerson] = useState(branch.contactPerson || '');
  const [mobile, setMobile] = useState(branch.mobile || '');
  const [email, setEmail] = useState(branch.email || '');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      address: address.trim(),
      pfCode: pfCode.trim(),
      esiCode: esiCode.trim(),
      ptTaxCode: ptTaxCode.trim(),
      contactPerson: contactPerson.trim(),
      mobile: mobile.trim(),
      email: email.trim()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-blue-900/60 shadow-2xl rounded-2xl w-full max-w-2xl p-6 space-y-6 relative text-white">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
              <Building size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-wider text-white">
                Branch Details Configuration
              </h3>
              <p className="text-xs text-slate-400">
                Configure statutory registration codes and contact info for {name || 'Branch'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800" title="Close">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto custom-scrollbar pr-1">
          {/* Field 1: Branch Name */}
          <div className="md:col-span-2 space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Branch Name *
            </label>
            <input
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Chennai Head Office"
            />
          </div>

          {/* Field 2: Branch Address */}
          <div className="md:col-span-2 space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Branch Full Address
            </label>
            <textarea
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Full postal address for reports & payslips..."
            />
          </div>

          {/* Field 3: PF Code */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-400" /> PF Establishment Code
            </label>
            <input
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              value={pfCode}
              onChange={e => setPfCode(e.target.value)}
              placeholder="e.g. TN/CHE/0012345/000"
            />
          </div>

          {/* Field 4: ESI Code */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <ShieldCheck size={14} className="text-violet-400" /> ESI Sub-Code / Registration
            </label>
            <input
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              value={esiCode}
              onChange={e => setEsiCode(e.target.value)}
              placeholder="e.g. 51000123450000001"
            />
          </div>

          {/* Field 5: PT Tax Code */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <FileText size={14} className="text-amber-400" /> Professional Tax (PT-Tax) Code
            </label>
            <input
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              value={ptTaxCode}
              onChange={e => setPtTaxCode(e.target.value)}
              placeholder="e.g. PT-TN-CHE-98765"
            />
          </div>

          {/* Field 6: Contact Person */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <User size={14} className="text-sky-400" /> Branch Contact Person
            </label>
            <input
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
              value={contactPerson}
              onChange={e => setContactPerson(e.target.value)}
              placeholder="e.g. Mr. R. Balaji (HR Head)"
            />
          </div>

          {/* Field 7: Mobile Number */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Phone size={14} className="text-emerald-400" /> Contact Mobile Number
            </label>
            <input
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              placeholder="e.g. 9876543210"
            />
          </div>

          {/* Field 8: Official Mail ID */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Mail size={14} className="text-blue-400" /> Branch Official Email ID
            </label>
            <input
              type="email"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. chennai.hr@loesche.com"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2"
          >
            <CheckCircle2 size={16} /> Save Branch Details
          </button>
        </div>
      </div>
    </div>
  );
};

const MasterManager: React.FC<MasterManagerProps> = ({ title, items, setItems, icon: Icon, showAlert }) => {
  const [newItem, setNewItem] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingBranch, setEditingBranch] = useState<BranchDetail | null>(null);
  const isBranchMaster = title.toLowerCase().includes('branch');

  const getItemName = (item: string | BranchDetail): string => {
    return getBranchName(item);
  };

  const getItemObj = (item: string | BranchDetail): BranchDetail => {
    if (typeof item === 'object' && item !== null) return item;
    return { name: String(item) };
  };

  const handleAdd = () => {
    if (!newItem.trim()) return;
    const nameStr = newItem.trim();
    const existingNames = items.map(getItemName);
    if (existingNames.includes(nameStr)) {
      showAlert('warning', 'Duplicate Item', 'This item already exists in the master list.');
      return;
    }
    const itemToAdd = isBranchMaster ? { name: nameStr } : nameStr;
    setItems([...items, itemToAdd]);
    setNewItem('');
  };

  const handleDelete = (item: string | BranchDetail) => {
    const nameStr = getItemName(item);
    showAlert('confirm', 'Confirm Deletion', `Are you sure you want to delete "${nameStr}" from the ${title}?`, () => {
      setItems(items.filter(i => getItemName(i) !== nameStr));
    });
  };

  const handleSaveBranchDetail = (updated: BranchDetail) => {
    const updatedItems = items.map(i => {
      if (getItemName(i).toLowerCase() === updated.name.toLowerCase() || (editingBranch && getItemName(i).toLowerCase() === editingBranch.name.toLowerCase())) {
        return updated;
      }
      return i;
    });
    setItems(updatedItems);
  };

  const filteredItems = items.filter(i => getItemName(i).toLowerCase().includes(searchTerm.toLowerCase()));

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
            className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg transition-colors shadow-lg flex items-center justify-center gap-1.5"
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
        <div className="grid grid-cols-1 gap-1.5">
          {filteredItems.map((item, idx) => {
            const nameStr = getItemName(item);
            const obj = getItemObj(item);
            const hasDetails = isBranchMaster && (obj.address || obj.pfCode || obj.esiCode || obj.ptTaxCode || obj.contactPerson || obj.mobile || obj.email);

            return (
              <div key={idx} className="group p-3 rounded-xl hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{nameStr}</span>
                    {isBranchMaster && (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${hasDetails ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                        {hasDetails ? 'Info Configured' : 'No Details Set'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isBranchMaster && (
                      <button
                        onClick={() => setEditingBranch(obj)}
                        title="Configure Branch Info (PF, ESI, PT, Address, Contact)"
                        className="text-slate-400 hover:text-blue-400 p-1.5 rounded transition-colors hover:bg-blue-500/10"
                      >
                        <Edit3 size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(item)}
                      title="Delete Item"
                      className="text-slate-600 hover:text-red-400 p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Optional metadata summary pill for Branch Master */}
                {isBranchMaster && hasDetails && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 pt-1 text-[10px] text-slate-400 border-t border-slate-800/60 font-mono">
                    {obj.pfCode && <div><span className="text-slate-500 font-bold">PF:</span> {obj.pfCode}</div>}
                    {obj.esiCode && <div><span className="text-slate-500 font-bold">ESI:</span> {obj.esiCode}</div>}
                    {obj.ptTaxCode && <div><span className="text-slate-500 font-bold">PT:</span> {obj.ptTaxCode}</div>}
                    {obj.contactPerson && <div><span className="text-slate-500 font-bold">Contact:</span> {obj.contactPerson}</div>}
                    {obj.mobile && <div><span className="text-slate-500 font-bold">Mobile:</span> {obj.mobile}</div>}
                    {obj.email && <div><span className="text-slate-500 font-bold">Mail:</span> {obj.email}</div>}
                  </div>
                )}
              </div>
            );
          })}
          {filteredItems.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 py-10">
              <Icon size={48} className="opacity-10 mb-2" />
              <p className="text-xs italic">No records found</p>
            </div>
          )}
        </div>
      </div>

      {editingBranch && (
        <BranchConfigModal
          branch={editingBranch}
          onSave={handleSaveBranchDetail}
          onClose={() => setEditingBranch(null)}
        />
      )}
    </div>
  );
};

interface UtilitiesProps {
  designations: string[];
  setDesignations: (items: string[]) => void;
  divisions: string[];
  setDivisions: (items: string[]) => void;
  branches: any[];
  setBranches: (items: any[]) => void;
  sites: string[];
  setSites: (items: string[]) => void;
  showAlert: (type: 'success' | 'error' | 'info' | 'warning' | 'confirm', title: string, message: string, onConfirm?: () => void) => void;
}

const Utilities: React.FC<UtilitiesProps> = (props) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-blue-900/10 border border-blue-800/30 p-6 rounded-2xl flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="flex gap-4 items-center">
          <div className="bg-blue-600 p-3 rounded-xl text-white shadow-lg shadow-blue-900/40">
            <Network size={28} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Organizational Hierarchy & Utilities</h2>
            <p className="text-sm text-slate-400">Manage master data used across the Employee and Payroll modules.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={async () => {
              await generateMasterTemplateXLSX();
              props.showAlert('success', 'Template Downloaded', 'Master data template has been saved to your reports folder.');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-bold transition-all"
          >
            <Download size={14} /> Download Template
          </button>
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.xlsx';
              input.onchange = async (e: any) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                  const results = await parseMasterXLSX(file);
                  
                  // Merge with existing masters (avoid duplicates)
                  if (results.designations.length > 0) {
                    const merged = Array.from(new Set([...props.designations, ...results.designations]));
                    props.setDesignations(merged);
                  }
                  if (results.divisions.length > 0) {
                    const merged = Array.from(new Set([...props.divisions, ...results.divisions]));
                    props.setDivisions(merged);
                  }
                  if (results.branches.length > 0) {
                    const existingNames = props.branches.map(getBranchName);
                    const newBranches = results.branches.filter(b => !existingNames.includes(b));
                    props.setBranches([...props.branches, ...newBranches]);
                  }
                  if (results.sites.length > 0) {
                    const merged = Array.from(new Set([...props.sites, ...results.sites]));
                    props.setSites(merged);
                  }
                  
                  props.showAlert('success', 'Import Successful', 'Organizational masters have been updated successfully.');
                } catch (err) {
                  props.showAlert('error', 'Import Failed', 'Failed to parse the Excel file. Please use the correct template.');
                }
              };
              input.click();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg text-xs font-bold transition-all"
          >
            <Upload size={14} /> Import Masters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <MasterManager title="Designation Master" items={props.designations} setItems={props.setDesignations as any} icon={Briefcase} showAlert={props.showAlert} />
        <MasterManager title="Division Master" items={props.divisions} setItems={props.setDivisions as any} icon={Network} showAlert={props.showAlert} />
        <MasterManager title="Branch Master" items={props.branches} setItems={props.setBranches as any} icon={Building} showAlert={props.showAlert} />
        <MasterManager title="Site Master" items={props.sites} setItems={props.setSites as any} icon={MapPin} showAlert={props.showAlert} />
      </div>

    </div>
  );
};

export default Utilities;
