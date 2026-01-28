import React, { useState, useRef } from 'react';
import { Plus, Search, Edit2, User2, Briefcase, Landmark, ShieldAlert, Fingerprint, Upload, Phone, Download, X, Save, MapPin, Trash2, Maximize2, UserPlus, CheckCircle2, AlertTriangle, Home, IndianRupee, ShieldCheck, MapPinned, CreditCard, Building2, UserMinus, Camera } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, User } from '../types';
import { INDIAN_STATES, NATURE_OF_BUSINESS_OPTIONS } from '../constants';

interface EmployeeListProps {
  employees: Employee[];
  setEmployees: (employees: Employee[]) => void;
  onAddEmployee: (newEmp: Employee) => void;
  onBulkAddEmployees?: (newEmps: Employee[]) => void;
  designations: string[];
  divisions: string[];
  branches: string[];
  sites: string[];
  currentUser?: User;
}

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, setEmployees, onAddEmployee, onBulkAddEmployees, designations, divisions, branches, sites, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const getEmptyForm = (): Partial<Employee> => ({
    id: `EMP00${employees.length + 1}`,
    name: '', gender: 'Male', dob: '',
    doj: new Date().toISOString().split('T')[0],
    designation: designations[0] || '',
    division: divisions[0] || '',
    branch: branches[0] || '',
    site: sites[0] || '',
    pan: '', aadhaarNumber: '', uanc: '', pfNumber: '', esiNumber: '',
    fatherSpouseName: '', relationship: 'Father',
    doorNo: '', buildingName: '', street: '', area: '', city: '', state: 'Tamil Nadu', pincode: '',
    mobile: '', bankAccount: '', ifsc: '',
    basicPay: 0, da: 0, retainingAllowance: 0, hra: 0, conveyance: 0, washing: 0, attire: 0, 
    specialAllowance1: 0, specialAllowance2: 0, specialAllowance3: 0,
    isPFExempt: false, isESIExempt: false, employeeVPFRate: 0, isPFHigherWages: false, isEmployerPFHigher: false,
    pfHigherPension: { 
      enabled: false, contributedBefore2014: 'No', dojImpact: '', 
      employeeContribution: 'Regular', employerContribution: 'Regular', isHigherPensionOpted: 'No' 
    },
    epsMaturityConfigured: false, isDeferredPension: false, deferredPensionOption: 'WithEPS',
    photoUrl: '', serviceRecords: []
  });

  const [newEmpForm, setNewEmpForm] = useState<Partial<Employee>>(getEmptyForm());

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || emp.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateGrossWage = (data: Partial<Employee> | Employee) => {
    return (Number(data.basicPay) || 0) + 
           (Number(data.da) || 0) + 
           (Number(data.retainingAllowance) || 0) + 
           (Number(data.hra) || 0) + 
           (Number(data.conveyance) || 0) + 
           (Number(data.washing) || 0) + 
           (Number(data.attire) || 0) + 
           (Number(data.specialAllowance1) || 0) + 
           (Number(data.specialAllowance2) || 0) + 
           (Number(data.specialAllowance3) || 0);
  };

  const calculateAge = (dobString: string | undefined) => {
      if (!dobString) return 0;
      const dob = new Date(dobString);
      const diffMs = Date.now() - dob.getTime();
      const ageDate = new Date(diffMs);
      return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewEmpForm(prev => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const proceedToEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setNewEmpForm({ 
      ...getEmptyForm(), 
      ...emp,
      pfHigherPension: emp.pfHigherPension ? { ...emp.pfHigherPension } : getEmptyForm().pfHigherPension 
    });
    setIsAdding(true);
  };

  const handleCloseModal = () => {
    setIsAdding(false);
    setEditingId(null);
    setNewEmpForm(getEmptyForm());
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpForm.name || !newEmpForm.id) {
        alert("Please fill in mandatory details (Employee ID and Name)");
        return;
    }
    const fullEmp: Employee = {
      ...getEmptyForm(),
      ...newEmpForm as Employee,
      department: newEmpForm.division || '',
      serviceRecords: editingId ? (employees.find(e => e.id === editingId)?.serviceRecords || []) : [{ date: newEmpForm.doj || '', type: 'Appointment', description: 'Initial Appointment' }]
    };
    if (editingId) {
        setEmployees(employees.map(emp => emp.id === editingId ? fullEmp : emp));
        if (selectedEmp?.id === editingId) setSelectedEmp(fullEmp);
    } else {
        onAddEmployee(fullEmp);
    }
    handleCloseModal();
  };

  const FormSectionHeader = ({ icon: Icon, title, color = "text-sky-400", extra }: { icon: any, title: string, color?: string, extra?: React.ReactNode }) => (
    <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-3">
            <Icon size={18} className={color} />
            <h3 className={`text-xs font-black uppercase tracking-widest ${color}`}>{title}</h3>
        </div>
        {extra}
    </div>
  );

  return (
    <div className="space-y-6 text-white relative">
      <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Search Master Records..." className="w-full pl-10 pr-4 py-2.5 bg-[#0f172a] border border-slate-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => { setEditingId(null); setNewEmpForm(getEmptyForm()); setIsAdding(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-shadow shadow-lg font-bold"><Plus size={18} /> Add New Record</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#1e293b] rounded-xl border border-slate-800 shadow-2xl overflow-hidden h-fit max-h-[800px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
                <thead className="bg-[#0f172a] text-sky-400 text-[10px] uppercase tracking-widest font-bold sticky top-0">
                <tr>
                    <th className="px-6 py-4 bg-[#0f172a]">Identity</th>
                    <th className="px-6 py-4 bg-[#0f172a]">Organization</th>
                    <th className="px-6 py-4 bg-[#0f172a]">Standard Wages</th>
                    <th className="px-6 py-4 text-right bg-[#0f172a]">Actions</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                {filteredEmployees.map((emp) => (
                    <tr key={emp.id} onClick={() => setSelectedEmp(emp)} className={`cursor-pointer hover:bg-slate-800/50 ${selectedEmp?.id === emp.id ? 'bg-blue-900/40 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600 overflow-hidden">
                                {emp.photoUrl ? <img src={emp.photoUrl} className="w-full h-full object-cover" /> : <User2 size={18} className="text-slate-400" />}
                            </div>
                            <div>
                                <div className="font-bold text-white text-sm">{emp.name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{emp.id}</div>
                            </div>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="text-[10px] text-sky-400 font-bold uppercase">{emp.designation}</div>
                        <div className="text-[9px] text-slate-500 uppercase">{emp.division} • {emp.branch}</div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="font-mono text-emerald-400 font-bold">₹{calculateGrossWage(emp).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                        <button onClick={(e) => { e.stopPropagation(); proceedToEdit(emp); }} className="text-slate-400 hover:text-blue-400 p-2 hover:bg-blue-900/30 rounded-lg transition-all"><Edit2 size={16} /></button>
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>

        <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-6 shadow-xl h-fit sticky top-24">
          {selectedEmp ? (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col items-center text-center">
                    <div className="w-24 h-24 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 border-2 border-slate-700 shadow-xl overflow-hidden">
                        {selectedEmp.photoUrl ? <img src={selectedEmp.photoUrl} className="w-full h-full object-cover" /> : <User2 size={48} className="text-slate-500" />}
                    </div>
                    <h3 className="text-2xl font-black">{selectedEmp.name}</h3>
                    <p className="text-blue-400 text-xs font-bold uppercase tracking-widest">{selectedEmp.designation}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                        <p className="text-slate-500 uppercase font-bold text-[8px] mb-1">Identity Code</p>
                        <p className="font-mono text-white font-bold">{selectedEmp.id}</p>
                    </div>
                    <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                        <p className="text-slate-500 uppercase font-bold text-[8px] mb-1">Date of Join</p>
                        <p className="text-white font-bold">{selectedEmp.doj}</p>
                    </div>
                </div>
                <div className="space-y-4 pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">UAN No (PF)</span>
                        <span className="font-mono font-bold text-sky-400">{selectedEmp.uanc || 'NOT SET'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Contact</span>
                        <span className="font-bold">{selectedEmp.mobile || 'N/A'}</span>
                    </div>
                </div>
                <button onClick={() => proceedToEdit(selectedEmp)} className="w-full py-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                    <Edit2 size={16} /> Edit Profile Details
                </button>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 italic"><Briefcase size={48} className="mb-4 opacity-10" /><p>Select a member record</p></div>
          )}
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#1e293b] w-full max-w-6xl max-h-[92vh] overflow-y-auto custom-scrollbar rounded-3xl border border-slate-700 shadow-2xl flex flex-col">
            <div className="p-6 bg-[#0f172a] border-b border-slate-700 flex justify-between items-center sticky top-0 z-10">
              <div className="flex items-center gap-3">
                 <div className={`p-2 rounded-xl ${editingId ? 'bg-amber-900/30 text-amber-400' : 'bg-blue-900/30 text-blue-400'}`}>
                    {editingId ? <Edit2 size={24} /> : <Plus size={24} />}
                 </div>
                 <div>
                    <h2 className="text-xl font-black text-white">{editingId ? 'Modify Employee Profile' : 'Register New Employee'}</h2>
                    <p className="text-xs text-slate-500">Master Record Configuration</p>
                 </div>
              </div>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition-all"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-8 space-y-12">
              
              {/* SECTION 1: IDENTITY & EMPLOYMENT */}
              <div>
                <FormSectionHeader icon={User2} title="1. Personal & Employment Identity" />
                <div className="flex flex-col md:flex-row gap-8">
                    {/* PHOTO UPLOAD BOX (RESTORED & EDITABLE) */}
                    <div className="flex flex-col items-center gap-4 shrink-0">
                        <div className="relative group w-32 h-32 bg-slate-900 rounded-2xl border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden transition-all hover:border-blue-500/50">
                            {newEmpForm.photoUrl ? (
                                <img src={newEmpForm.photoUrl} className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center p-4">
                                    <Camera size={24} className="text-slate-600 mx-auto mb-1" />
                                    <span className="text-[8px] font-bold text-slate-500 uppercase">Employee Photo</span>
                                </div>
                            )}
                            <button 
                                type="button"
                                onClick={() => photoInputRef.current?.click()}
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                            >
                                <Upload size={20} className="text-white" />
                            </button>
                            <input ref={photoInputRef} type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                        </div>
                        {newEmpForm.photoUrl && (
                            <button type="button" onClick={() => setNewEmpForm({...newEmpForm, photoUrl: ''})} className="text-[10px] text-red-400 font-bold hover:underline">Remove Photo</button>
                        )}
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Employee ID*</label><input required className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none" value={newEmpForm.id} onChange={e => setNewEmpForm({...newEmpForm, id: e.target.value})} /></div>
                        <div className="space-y-1.5 md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Legal Name*</label><input required className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none" value={newEmpForm.name} onChange={e => setNewEmpForm({...newEmpForm, name: e.target.value})} /></div>
                        
                        {/* MOBILE MOVED TO IDENTITY */}
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-sky-400 uppercase tracking-widest ml-1">Mobile No*</label><input required className="w-full bg-slate-900 border border-sky-900/50 rounded-xl p-3 text-sm text-white font-mono focus:ring-2 focus:ring-blue-500 outline-none" value={newEmpForm.mobile} onChange={e => setNewEmpForm({...newEmpForm, mobile: e.target.value})} /></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Gender</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.gender} onChange={e => setNewEmpForm({...newEmpForm, gender: e.target.value as any})}><option>Male</option><option>Female</option><option>Transgender</option><option>Others</option></select></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Date of Birth</label><input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.dob} onChange={e => setNewEmpForm({...newEmpForm, dob: e.target.value})} /></div>
                        
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Date of Joining</label><input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.doj} onChange={e => setNewEmpForm({...newEmpForm, doj: e.target.value})} /></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Designation</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.designation} onChange={e => setNewEmpForm({...newEmpForm, designation: e.target.value})}>{designations.map(d => <option key={d}>{d}</option>)}</select></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Work Branch</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.branch} onChange={e => setNewEmpForm({...newEmpForm, branch: e.target.value})}>{branches.map(b => <option key={b}>{b}</option>)}</select></div>
                    </div>
                </div>
              </div>

              {/* SECTION 2 & 3: FAMILY & ADDRESS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div>
                    <FormSectionHeader icon={Home} title="2. Family Relations" />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Father / Spouse Name</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.fatherSpouseName} onChange={e => setNewEmpForm({...newEmpForm, fatherSpouseName: e.target.value})} /></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Relationship</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.relationship} onChange={e => setNewEmpForm({...newEmpForm, relationship: e.target.value})}><option>Father</option><option>Spouse</option><option>Mother</option><option>Guardian</option></select></div>
                    </div>
                 </div>
                 
                 <div>
                    <FormSectionHeader icon={MapPinned} title="3. Residential Address" />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Door No / House No</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.doorNo} onChange={e => setNewEmpForm({...newEmpForm, doorNo: e.target.value})} /></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Building / Flat Name</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.buildingName} onChange={e => setNewEmpForm({...newEmpForm, buildingName: e.target.value})} /></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Street</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.street} onChange={e => setNewEmpForm({...newEmpForm, street: e.target.value})} /></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Area</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.area} onChange={e => setNewEmpForm({...newEmpForm, area: e.target.value})} /></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">City / Town</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.city} onChange={e => setNewEmpForm({...newEmpForm, city: e.target.value})} /></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">State</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.state} onChange={e => setNewEmpForm({...newEmpForm, state: e.target.value})}>{INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                        <div className="space-y-1.5 col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pincode</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.pincode} onChange={e => setNewEmpForm({...newEmpForm, pincode: e.target.value})} /></div>
                    </div>
                 </div>
              </div>

              {/* SECTION 4: BANKING (SHIFTED BEFORE WAGES & STATUTORY) */}
              <div>
                <FormSectionHeader icon={Landmark} title="4. Banking & Disbursement" color="text-indigo-400" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-indigo-900/5 p-6 rounded-2xl border border-indigo-900/20">
                    <div className="space-y-1.5 md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Bank Account Number</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.bankAccount} onChange={e => setNewEmpForm({...newEmpForm, bankAccount: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">IFSC Code</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none uppercase" value={newEmpForm.ifsc} onChange={e => setNewEmpForm({...newEmpForm, ifsc: e.target.value})} /></div>
                </div>
              </div>

              {/* SECTION 5: WAGE MATRIX (SHIFTED BEFORE STATUTORY) */}
              <div>
                <FormSectionHeader 
                    icon={IndianRupee} 
                    title={`5. Monthly Compensation Structure (Gross ₹ ${calculateGrossWage(newEmpForm).toLocaleString()})`} 
                    color="text-emerald-400" 
                />
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 bg-emerald-900/5 p-6 rounded-2xl border border-emerald-900/20">
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">Basic Pay*</label><input required type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-bold font-mono outline-none" value={newEmpForm.basicPay} onChange={e => setNewEmpForm({...newEmpForm, basicPay: +e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">DA</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.da} onChange={e => setNewEmpForm({...newEmpForm, da: +e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">Retn Allow</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.retainingAllowance} onChange={e => setNewEmpForm({...newEmpForm, retainingAllowance: +e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">HRA</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.hra} onChange={e => setNewEmpForm({...newEmpForm, hra: +e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">Conveyance</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.conveyance} onChange={e => setNewEmpForm({...newEmpForm, conveyance: +e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">Washing</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.washing} onChange={e => setNewEmpForm({...newEmpForm, washing: +e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">Attire</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.attire} onChange={e => setNewEmpForm({...newEmpForm, attire: +e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">Special-1</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.specialAllowance1} onChange={e => setNewEmpForm({...newEmpForm, specialAllowance1: +e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">Special-2</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.specialAllowance2} onChange={e => setNewEmpForm({...newEmpForm, specialAllowance2: +e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest">Special-3</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.specialAllowance3} onChange={e => setNewEmpForm({...newEmpForm, specialAllowance3: +e.target.value})} /></div>
                </div>
              </div>

              {/* SECTION 6: STATUTORY & COMPLIANCE (MOVED TO END) */}
              <div>
                <FormSectionHeader icon={ShieldCheck} title="6. Statutory IDs & Options" color="text-amber-400" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PAN Number</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none uppercase" value={newEmpForm.pan} onChange={e => setNewEmpForm({...newEmpForm, pan: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aadhaar No</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.aadhaarNumber} onChange={e => setNewEmpForm({...newEmpForm, aadhaarNumber: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">UAN Number</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.uanc} onChange={e => setNewEmpForm({...newEmpForm, uanc: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ESI IP Number</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.esiNumber} onChange={e => setNewEmpForm({...newEmpForm, esiNumber: e.target.value})} /></div>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 mt-8">
                  <div className="flex items-center justify-between mb-6">
                      <div className="flex flex-col">
                          <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={18} /> EPS Maturity Control (Age 58+)</h3>
                          <span className="text-[10px] text-slate-500 mt-1 font-mono">Verified Age: {calculateAge(newEmpForm.dob)} years</span>
                      </div>
                      <label className={`flex items-center gap-2 p-2.5 px-4 rounded-xl border ${newEmpForm.epsMaturityConfigured ? 'bg-emerald-900/20 border-emerald-900/50' : 'bg-slate-800 border-slate-700'} cursor-pointer transition-all`}>
                          <input type="checkbox" className="sr-only" checked={newEmpForm.epsMaturityConfigured} onChange={(e) => setNewEmpForm({...newEmpForm, epsMaturityConfigured: e.target.checked})} />
                          <div className={`w-5 h-5 rounded border flex items-center justify-center ${newEmpForm.epsMaturityConfigured ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500'}`}>{newEmpForm.epsMaturityConfigured && <CheckCircle2 size={14} className="text-white" />}</div>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${newEmpForm.epsMaturityConfigured ? 'text-emerald-400' : 'text-slate-500'}`}>{newEmpForm.epsMaturityConfigured ? 'SETTINGS CONFIRMED' : 'CONFIRM SETTINGS'}</span>
                      </label>
                  </div>
                  {newEmpForm.isDeferredPension && (
                      <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 animate-in fade-in slide-in-from-top-4 mb-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${newEmpForm.deferredPensionOption === 'WithEPS' ? 'bg-blue-900/20 border-blue-500 shadow-lg' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'}`}>
                                  <input type="radio" name="deferredOption" className="w-4 h-4 text-blue-500 focus:ring-blue-500 bg-slate-900 border-slate-700" checked={newEmpForm.deferredPensionOption === 'WithEPS'} onChange={() => setNewEmpForm({...newEmpForm, deferredPensionOption: 'WithEPS'})} />
                                  <div><span className="block text-xs font-black text-white">Pension Eligible</span><span className="block text-[9px] text-slate-400 mt-1">Continue 8.33% to EPS Fund.</span></div>
                              </label>
                              <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${newEmpForm.deferredPensionOption === 'WithoutEPS' ? 'bg-amber-900/20 border-amber-500 shadow-lg' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'}`}>
                                  <input type="radio" name="deferredOption" className="w-4 h-4 text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700" checked={newEmpForm.deferredPensionOption === 'WithoutEPS'} onChange={() => setNewEmpForm({...newEmpForm, deferredPensionOption: 'WithoutEPS'})} />
                                  <div><span className="block text-xs font-black text-white">Full PF Redirect</span><span className="block text-[9px] text-slate-400 mt-1">Full Employer 12% to EPF.</span></div>
                              </label>
                              <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${newEmpForm.deferredPensionOption === 'OptOut' ? 'bg-red-900/20 border-red-500 shadow-lg' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'}`}>
                                  <input type="radio" name="deferredOption" className="w-4 h-4 text-red-500 focus:ring-red-500 bg-slate-900 border-slate-700" checked={newEmpForm.deferredPensionOption === 'OptOut'} onChange={() => setNewEmpForm({...newEmpForm, deferredPensionOption: 'OptOut'})} />
                                  <div><span className="block text-xs font-black text-red-400">Opt Out of EPF</span><span className="block text-[9px] text-red-300 mt-1">Stop ALL contributions.</span></div>
                              </label>
                          </div>
                      </div>
                  )}
                  <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="w-5 h-5 rounded border-slate-700 text-amber-600 focus:ring-amber-500 bg-slate-900" checked={newEmpForm.isDeferredPension} onChange={(e) => setNewEmpForm({...newEmpForm, isDeferredPension: e.target.checked})} />
                      <div><span className="text-sm font-bold text-white block group-hover:text-amber-400 transition-colors">Apply 58+ Maturity Rules</span></div>
                  </label>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="flex justify-end gap-4 pt-8 border-t border-slate-800 sticky bottom-0 bg-[#1e293b] py-6 z-10">
                <button type="button" onClick={handleCloseModal} className="px-8 py-3.5 border border-slate-700 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all font-bold uppercase tracking-widest text-xs">Cancel</button>
                <button type="submit" className="px-12 py-3.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 font-black flex items-center gap-3 uppercase tracking-widest text-xs">
                  <Save size={18} /> {editingId ? 'Update Master' : 'Finalize Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeList;