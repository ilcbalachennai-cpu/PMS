import React, { useState, useRef } from 'react';
import { 
  Search, Plus, Upload, Download, Trash2, Edit2, 
  MoreVertical, User, MapPin, Briefcase, Calendar, 
  Phone, Mail, FileText, CheckCircle, X, AlertTriangle,
  CreditCard, Shield
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, User as UserType, CompanyProfile } from '../types';

interface EmployeeListProps {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  onAddEmployee: (employee: Employee) => void;
  onBulkAddEmployees: (employees: Employee[]) => void;
  designations: string[];
  divisions: string[];
  branches: string[];
  sites: string[];
  currentUser: UserType | null;
  companyProfile: CompanyProfile;
}

const INITIAL_EMPLOYEE: Employee = {
  id: '',
  name: '',
  gender: 'Male',
  dob: '',
  designation: '',
  department: '',
  division: '',
  branch: '',
  site: '',
  pan: '',
  aadhaarNumber: '',
  uanc: '',
  pfNumber: '',
  esiNumber: '',
  fatherSpouseName: '',
  relationship: 'Father',
  doorNo: '',
  buildingName: '',
  street: '',
  area: '',
  city: '',
  state: 'Tamil Nadu',
  pincode: '',
  mobile: '',
  bankAccount: '',
  ifsc: '',
  doj: '',
  basicPay: 0,
  da: 0,
  retainingAllowance: 0,
  hra: 0,
  conveyance: 0,
  washing: 0,
  attire: 0,
  specialAllowance1: 0,
  specialAllowance2: 0,
  specialAllowance3: 0,
  isPFExempt: false,
  isESIExempt: false,
  employeeVPFRate: 0,
  isPFHigherWages: false,
  isEmployerPFHigher: false,
  serviceRecords: []
};

const EmployeeList: React.FC<EmployeeListProps> = ({
  employees,
  setEmployees,
  onAddEmployee,
  onBulkAddEmployees,
  designations,
  divisions,
  branches,
  sites,
  currentUser,
  companyProfile
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [newEmpForm, setNewEmpForm] = useState<Employee>(INITIAL_EMPLOYEE);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
      if (!newEmpForm.name || !newEmpForm.id || !newEmpForm.doj) {
          alert("Please fill in required fields: Name, ID, DOJ");
          return;
      }
      if (isEditMode) {
          setEmployees(employees.map(e => e.id === newEmpForm.id ? newEmpForm : e));
      } else {
          onAddEmployee(newEmpForm);
      }
      setIsModalOpen(false);
      setNewEmpForm(INITIAL_EMPLOYEE);
  };

  const handleDelete = (id: string) => {
      if(confirm('Are you sure you want to delete this employee?')) {
          setEmployees(employees.filter(e => e.id !== id));
      }
  };

  const openEdit = (emp: Employee) => {
      setNewEmpForm(emp);
      setIsEditMode(true);
      setIsModalOpen(true);
  };

  const openAdd = () => {
      setNewEmpForm({...INITIAL_EMPLOYEE, id: `EMP${String(employees.length + 1).padStart(3, '0')}`});
      setIsEditMode(false);
      setIsModalOpen(true);
  };

   const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const mappedEmployees: Employee[] = data.map((row: any) => ({
             ...INITIAL_EMPLOYEE,
             id: row['Employee ID'] || row['ID'],
             name: row['Name'],
             designation: row['Designation'] || 'Staff',
             doj: row['DOJ'] || new Date().toISOString().split('T')[0],
             basicPay: Number(row['Basic'] || 0),
             serviceRecords: []
        }));
        
        onBulkAddEmployees(mappedEmployees);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        console.error(err);
        alert('Error parsing file');
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#1e293b] p-6 rounded-xl border border-slate-800 shadow-xl">
            <div>
                <h2 className="text-xl font-black text-white">Employee Master</h2>
                <p className="text-slate-400 text-sm">Manage employee records, salary structures, and KYC.</p>
            </div>
            <div className="flex gap-3">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search employees..." 
                        className="bg-[#0f172a] border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                 </div>
                 <button onClick={() => fileInputRef.current?.click()} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm transition-colors border border-slate-600"><Upload size={16}/> Import</button>
                 <input type="file" ref={fileInputRef} onChange={handleBulkUpload} className="hidden" accept=".xlsx, .xls" />
                 <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm transition-colors shadow-lg"><Plus size={16}/> Add New</button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map(emp => (
                <div key={emp.id} className="bg-[#1e293b] p-5 rounded-xl border border-slate-800 hover:border-blue-500/50 transition-all group relative">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold border border-slate-600">
                                {emp.name.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-sm">{emp.name}</h3>
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest">{emp.designation}</p>
                            </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(emp)} className="p-2 text-blue-400 hover:bg-blue-900/20 rounded-lg"><Edit2 size={16}/></button>
                            <button onClick={() => handleDelete(emp.id)} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg"><Trash2 size={16}/></button>
                        </div>
                    </div>
                    <div className="space-y-2 text-xs text-slate-400 bg-[#0f172a] p-3 rounded-lg border border-slate-800">
                        <div className="flex justify-between"><span>ID:</span> <span className="text-white font-mono">{emp.id}</span></div>
                        <div className="flex justify-between"><span>Branch:</span> <span className="text-white">{emp.branch || '-'}</span></div>
                        <div className="flex justify-between"><span>DOJ:</span> <span className="text-white">{emp.doj}</span></div>
                        <div className="flex justify-between"><span>Status:</span> <span className={emp.dol ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>{emp.dol ? 'Inactive' : 'Active'}</span></div>
                    </div>
                </div>
            ))}
        </div>

        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-[#1e293b] w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
                    <div className="p-6 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-[#1e293b] z-10">
                        <div>
                            <h2 className="text-xl font-bold text-white">{isEditMode ? 'Edit Employee Record' : 'Onboard New Employee'}</h2>
                            <p className="text-xs text-slate-400">{isEditMode ? `Updating details for ${newEmpForm.id}` : 'Enter personal and official details'}</p>
                        </div>
                        <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-white" /></button>
                    </div>
                    
                    <div className="p-6 space-y-8">
                        {/* Official Details */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2"><Briefcase size={14} /> Official Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Employee ID*</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.id} onChange={e => setNewEmpForm({...newEmpForm, id: e.target.value})} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name*</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.name} onChange={e => setNewEmpForm({...newEmpForm, name: e.target.value})} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Gender</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.gender} onChange={e => setNewEmpForm({...newEmpForm, gender: e.target.value as any})}><option>Male</option><option>Female</option><option>Transgender</option><option>Others</option></select></div>
                                
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Date of Joining*</label><input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.doj} onChange={e => setNewEmpForm({...newEmpForm, doj: e.target.value})} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Designation</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.designation} onChange={e => setNewEmpForm({...newEmpForm, designation: e.target.value})}>{designations.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Department</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.division} onChange={e => setNewEmpForm({...newEmpForm, division: e.target.value})}>{divisions.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Branch</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.branch} onChange={e => setNewEmpForm({...newEmpForm, branch: e.target.value})}>{branches.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Work Site</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.site} onChange={e => setNewEmpForm({...newEmpForm, site: e.target.value})}>{sites.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-red-400 uppercase tracking-widest ml-1">Date of Leaving</label><input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-1 focus:ring-red-500" value={newEmpForm.dol || ''} onChange={e => setNewEmpForm({...newEmpForm, dol: e.target.value})} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-red-400 uppercase tracking-widest ml-1">Reason for Leaving</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-1 focus:ring-red-500" value={newEmpForm.leavingReason || ''} onChange={e => setNewEmpForm({...newEmpForm, leavingReason: e.target.value})} placeholder="Optional" /></div>
                            </div>
                        </div>

                        {/* Statutory Details */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2"><Shield size={14} /> Statutory & KYC</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">UAN Number</label><input className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-mono" value={newEmpForm.uanc} onChange={e => setNewEmpForm({...newEmpForm, uanc: e.target.value})} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">PF Number</label><input className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-mono" value={newEmpForm.pfNumber} onChange={e => setNewEmpForm({...newEmpForm, pfNumber: e.target.value})} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">ESI Number</label><input className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-mono" value={newEmpForm.esiNumber} onChange={e => setNewEmpForm({...newEmpForm, esiNumber: e.target.value})} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">PAN Number</label><input className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-mono" value={newEmpForm.pan} onChange={e => setNewEmpForm({...newEmpForm, pan: e.target.value})} /></div>
                                
                                <div className="col-span-full flex gap-4 pt-2">
                                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer"><input type="checkbox" checked={newEmpForm.isPFExempt} onChange={e => setNewEmpForm({...newEmpForm, isPFExempt: e.target.checked})} className="rounded bg-slate-800 border-slate-600" /> Exclude from PF</label>
                                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer"><input type="checkbox" checked={newEmpForm.isESIExempt} onChange={e => setNewEmpForm({...newEmpForm, isESIExempt: e.target.checked})} className="rounded bg-slate-800 border-slate-600" /> Exclude from ESI</label>
                                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer"><input type="checkbox" checked={newEmpForm.isPFHigherWages} onChange={e => setNewEmpForm({...newEmpForm, isPFHigherWages: e.target.checked})} className="rounded bg-slate-800 border-slate-600" /> PF on Full Basic</label>
                                </div>
                            </div>
                        </div>
                        
                        {/* Salary Details */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2"><CreditCard size={14} /> Wage Structure (Monthly)</h4>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">Basic Pay</label><input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={newEmpForm.basicPay} onChange={e => setNewEmpForm({...newEmpForm, basicPay: +e.target.value})} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">DA</label><input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={newEmpForm.da} onChange={e => setNewEmpForm({...newEmpForm, da: +e.target.value})} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">HRA</label><input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={newEmpForm.hra} onChange={e => setNewEmpForm({...newEmpForm, hra: +e.target.value})} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">Conveyance</label><input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={newEmpForm.conveyance} onChange={e => setNewEmpForm({...newEmpForm, conveyance: +e.target.value})} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">Other Allw.</label><input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={newEmpForm.specialAllowance1} onChange={e => setNewEmpForm({...newEmpForm, specialAllowance1: +e.target.value})} /></div>
                            </div>
                        </div>

                         {/* Contact Details */}
                         <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><MapPin size={14} /> Contact & Bank</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">Mobile Number</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.mobile} onChange={e => setNewEmpForm({...newEmpForm, mobile: e.target.value})} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">Bank Account</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.bankAccount} onChange={e => setNewEmpForm({...newEmpForm, bankAccount: e.target.value})} /></div>
                                <div className="md:col-span-2 space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">Full Address</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.street} onChange={e => setNewEmpForm({...newEmpForm, street: e.target.value})} placeholder="Street, Area, City" /></div>
                            </div>
                        </div>

                    </div>
                    
                    <div className="p-6 border-t border-slate-700 flex justify-end gap-3 sticky bottom-0 bg-[#1e293b]">
                        <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 font-bold transition-colors">Cancel</button>
                        <button onClick={handleSubmit} className="px-8 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-bold shadow-lg transition-colors">Save Employee Record</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default EmployeeList;