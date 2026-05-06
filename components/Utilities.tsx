import React, { useState } from 'react';
import { Plus, Trash2, Building, MapPin, Briefcase, Network, Search, Download, Upload } from 'lucide-react';
import { generateMasterTemplateXLSX, parseMasterXLSX } from '../services/excelService';


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
                    const merged = Array.from(new Set([...props.branches, ...results.branches]));
                    props.setBranches(merged);
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
        <MasterManager title="Designation Master" items={props.designations} setItems={props.setDesignations} icon={Briefcase} showAlert={props.showAlert} />
        <MasterManager title="Division Master" items={props.divisions} setItems={props.setDivisions} icon={Network} showAlert={props.showAlert} />
        <MasterManager title="Branch Master" items={props.branches} setItems={props.setBranches} icon={Building} showAlert={props.showAlert} />
        <MasterManager title="Site Master" items={props.sites} setItems={props.setSites} icon={MapPin} showAlert={props.showAlert} />
      </div>

    </div>
  );
};

export default Utilities;
