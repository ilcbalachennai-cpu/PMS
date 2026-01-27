
import React, { useState, useRef } from 'react';
import { Plus, Search, Edit2, Image as ImageIcon, User2, Briefcase, Landmark, ShieldAlert, Fingerprint, Upload, Phone, FileSpreadsheet, Download, Lock, X, Save, MapPin, KeyRound, Trash2, Maximize2, Minimize2, ArrowLeft } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, User } from '../types';
import { INDIAN_STATES } from '../constants';

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
  const [isFullScreen, setIsFullScreen] = useState(false); // True Full Screen Mode
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth State for Deletion
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const getEmptyForm = (): Partial<Employee> => ({
    id: `EMP00${employees.length + 1}`,
    name: '',
    gender: 'Male', // Default Gender
    dob: '',
    doj: new Date().toISOString().split('T')[0],
    designation: designations[0] || '',
    department: divisions[0] || '',
    division: divisions[0] || '',
    branch: branches[0] || '',
    site: sites[0] || '',
    pan: '',
    aadhaarNumber: '',
    uanc: '',
    pfNumber: '',
    esiNumber: '',
    fatherSpouseName: '',
    relationship: 'Father',
    
    // Address Breakdown
    flatNumber: '',
    streetAddress: '',
    city: '',
    state: '', 
    pincode: '',

    mobile: '',
    bankAccount: '',
    ifsc: '',
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
    photoUrl: '',
    serviceRecords: []
  });

  // New Employee Form State
  const [newEmpForm, setNewEmpForm] = useState<Partial<Employee>>(getEmptyForm());

  const filteredEmployees = employees.filter(emp => 
    String(emp.name).toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(emp.id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateGrossWage = (emp: Employee) => {
    return (emp.basicPay || 0) + 
           (emp.da || 0) + 
           (emp.retainingAllowance || 0) + 
           (emp.hra || 0) + 
           (emp.conveyance || 0) + 
           (emp.washing || 0) + 
           (emp.attire || 0) + 
           (emp.specialAllowance1 || 0) + 
           (emp.specialAllowance2 || 0) + 
           (emp.specialAllowance3 || 0);
  };

  const formatDate = (isoDate: string | undefined | number) => {
    if (!isoDate) return 'N/A';
    const strDate = String(isoDate);
    const parts = strDate.split('-');
    if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day}-${month}-${year}`;
    }
    return strDate;
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

  const handleDetailPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedEmp) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const updated = { ...selectedEmp, photoUrl: reader.result as string };
        setEmployees(employees.map(e => e.id === selectedEmp.id ? updated : e));
        setSelectedEmp(updated);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- EXCEL HANDLING ---

  const downloadTemplate = () => {
    const headers = [
      "Employee ID", "Name", "Gender", "Designation", "Division", "Branch", "Site", 
      "DOJ (YYYY-MM-DD)", "DOB (YYYY-MM-DD)", 
      "Father/Spouse Name", "Relationship", 
      "Flat/Door No", "Street/Building", "City", "State", "Pincode", 
      "Mobile",
      "PAN", "Aadhaar", "UAN", "PF Number", "Bank Account", "IFSC",
      "Basic Pay", "DA", "HRA", "Conveyance", 
      "Retaining Allowance", "Washing Allowance", "Attire Allowance",
      "Special Allowance 1", "Special Allowance 2", "Special Allowance 3",
      "PF Option", "VPF Rate"
    ];

    const data = [
      [
        "EMP101", "John Doe", "Male", "Engineer", "Engineering", "Chennai", "Main Plant", 
        "2023-01-01", "1990-01-01", 
        "Robert Doe", "Father", 
        "No 12", "Anna Salai", "Chennai", "Tamil Nadu", "600002",
        "9876543210",
        "ABCDE1234F", "123456789012", "101234567890", "TN/MAS/0012345/000/0000001", "1234567890", "HDFC0000123",
        20000, 5000, 10000, 1600, 
        0, 500, 0,
        2000, 0, 0,
        "Standard", 0
      ]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Employee_Import_Template.xlsx");
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const safeString = (val: any) => val ? String(val).trim() : "";
      
      const getValue = (row: any, key: string) => {
        const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
        return foundKey ? row[foundKey] : undefined;
      };

      const processDate = (val: any) => {
         if (!val) return "";
         if (typeof val === 'number') {
             const date = new Date(Math.round((val - 25569) * 86400 * 1000));
             return date.toISOString().split('T')[0];
         }
         return String(val).trim();
      };

      const newEmployees: Employee[] = data.map((row: any) => ({
        id: safeString(getValue(row, "Employee ID")) || `EMP${Math.floor(Math.random() * 10000)}`,
        name: safeString(getValue(row, "Name")) || "Unknown",
        gender: safeString(getValue(row, "Gender")) as any || "Male",
        designation: safeString(getValue(row, "Designation")) || "Staff",
        department: safeString(getValue(row, "Division")) || "",
        division: safeString(getValue(row, "Division")) || "",
        branch: safeString(getValue(row, "Branch")) || "",
        site: safeString(getValue(row, "Site")) || "",
        doj: processDate(getValue(row, "DOJ (YYYY-MM-DD)")) || new Date().toISOString().split('T')[0],
        dob: processDate(getValue(row, "DOB (YYYY-MM-DD)")),
        
        fatherSpouseName: safeString(getValue(row, "Father/Spouse Name")),
        relationship: safeString(getValue(row, "Relationship")) || "Father",
        
        flatNumber: safeString(getValue(row, "Flat/Door No")),
        streetAddress: safeString(getValue(row, "Street/Building")) || safeString(getValue(row, "Address")), 
        city: safeString(getValue(row, "City")),
        state: safeString(getValue(row, "State")) || "Tamil Nadu",
        pincode: safeString(getValue(row, "Pincode")),

        mobile: safeString(getValue(row, "Mobile")),
        
        pan: safeString(getValue(row, "PAN")),
        aadhaarNumber: safeString(getValue(row, "Aadhaar")),
        uanc: safeString(getValue(row, "UAN")),
        pfNumber: safeString(getValue(row, "PF Number")),
        esiNumber: "", 
        
        bankAccount: safeString(getValue(row, "Bank Account")),
        ifsc: safeString(getValue(row, "IFSC")),

        basicPay: Number(getValue(row, "Basic Pay")) || 0,
        da: Number(getValue(row, "DA")) || 0,
        hra: Number(getValue(row, "HRA")) || 0,
        conveyance: Number(getValue(row, "Conveyance")) || 0,
        retainingAllowance: Number(getValue(row, "Retaining Allowance")) || 0,
        washing: Number(getValue(row, "Washing Allowance")) || 0,
        attire: Number(getValue(row, "Attire Allowance")) || 0,
        specialAllowance1: Number(getValue(row, "Special Allowance 1")) || 0,
        specialAllowance2: Number(getValue(row, "Special Allowance 2")) || 0,
        specialAllowance3: Number(getValue(row, "Special Allowance 3")) || 0,

        isPFExempt: safeString(getValue(row, "PF Option")).toLowerCase() === "exempt",
        isPFHigherWages: safeString(getValue(row, "PF Option")).toLowerCase() === "higher wages",
        isEmployerPFHigher: false,
        isESIExempt: false,
        employeeVPFRate: Number(getValue(row, "VPF Rate")) || 0,

        serviceRecords: [{ date: new Date().toISOString().split('T')[0], type: 'Appointment', description: 'Imported via Excel' }]
      }));

      if (onBulkAddEmployees) {
          onBulkAddEmployees(newEmployees);
      } else {
          setEmployees([...employees, ...newEmployees]);
      }
      alert(`Successfully imported ${newEmployees.length} employees!`);
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canDelete = currentUser?.role === 'Developer' || currentUser?.role === 'Administrator';
  const canEdit = true; 

  const initiateDelete = (emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(emp);
    setAuthPassword('');
    setAuthError('');
  };

  const handleConfirmDelete = () => {
      if (!deleteTarget) return;
      if (authPassword === currentUser?.password) {
          const updatedList = employees.filter(e => e.id !== deleteTarget.id);
          setEmployees(updatedList);
          if (selectedEmp?.id === deleteTarget.id) {
              setSelectedEmp(null);
          }
          setDeleteTarget(null);
      } else {
          setAuthError("Incorrect password. Access Denied.");
      }
  };

  const proceedToEdit = (emp: Employee) => {
    setEditingId(emp.id);
    const safeFormState = { 
        ...getEmptyForm(),
        ...emp,
        // Explicitly map potentially undefined fields to ensure inputs are controlled
        flatNumber: emp.flatNumber || '',
        streetAddress: emp.streetAddress || '',
        city: emp.city || '',
        state: emp.state || '',
        pincode: emp.pincode || '',
        designation: emp.designation || designations[0] || '',
        division: emp.division || divisions[0] || '',
        branch: emp.branch || branches[0] || '',
        site: emp.site || sites[0] || '',
        gender: emp.gender || 'Male'
    };
    
    setNewEmpForm(safeFormState);
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
        alert("Please fill in basic details (ID and Name)");
        return;
    }
    
    const existingData = editingId ? employees.find(e => e.id === editingId) : {};

    const fullEmp: Employee = {
      ...getEmptyForm(), 
      ...existingData, 
      ...newEmpForm as Employee, 
      department: newEmpForm.division || '', 
      serviceRecords: editingId 
        ? (employees.find(e => e.id === editingId)?.serviceRecords || []) 
        : [{ date: newEmpForm.doj || '', type: 'Appointment', description: 'Initial Appointment' }]
    };
    
    if (editingId) {
        const updatedList = employees.map(emp => emp.id === editingId ? fullEmp : emp);
        setEmployees(updatedList);
        if (selectedEmp?.id === editingId) {
            setSelectedEmp(fullEmp);
        }
    } else {
        onAddEmployee(fullEmp);
    }
    handleCloseModal();
  };

  return (
    <div className="space-y-6 text-white relative">
      {/* Search & Action Bar - Only show when NOT in full screen, as FS has its own header */}
      {!isFullScreen && (
      <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Search Master Records..." className="w-full pl-10 pr-4 py-2.5 bg-[#0f172a] border border-slate-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        
        <div className="flex items-center gap-3">
            <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors border border-slate-600 text-sm font-bold"><Download size={16} /> Template</button>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-lg text-sm font-bold"><Upload size={16} /> Import</button>
            <input type="file" ref={fileInputRef} onChange={handleExcelUpload} className="hidden" accept=".xlsx, .xls" />
            <button 
                onClick={() => setIsFullScreen(true)}
                className="p-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg border border-slate-600 transition-colors"
                title="Expand to Full Screen"
            >
                <Maximize2 size={20} />
            </button>
            <button onClick={() => { setIsAdding(true); setEditingId(null); setNewEmpForm(getEmptyForm()); }} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-shadow shadow-lg font-bold"><Plus size={18} /> Add Manual</button>
        </div>
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* List View - Dynamically styles based on isFullScreen */}
        <div className={`${
            isFullScreen 
            ? 'fixed inset-0 z-[100] bg-[#0f172a] flex flex-col p-4 w-screen h-screen' 
            : 'lg:col-span-2 bg-[#1e293b] rounded-xl border border-slate-800 shadow-2xl h-fit max-h-[calc(100vh-12rem)] overflow-y-auto custom-scrollbar'
        }`}>
          
          {/* Internal Header for Full Screen Mode */}
          {isFullScreen && (
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800 shrink-0">
                  <div className="flex items-center gap-4">
                      <button onClick={() => setIsFullScreen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                          <ArrowLeft size={24} />
                      </button>
                      <div>
                          <h2 className="text-xl font-bold text-white flex items-center gap-2">Employee Master List <span className="text-[10px] px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded border border-blue-900/50 uppercase tracking-widest">Full Screen</span></h2>
                          <p className="text-xs text-slate-400">Viewing {filteredEmployees.length} records</p>
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                      <div className="relative w-64">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                            type="text" 
                            placeholder="Search in full screen..." 
                            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-blue-500" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            autoFocus
                          />
                      </div>
                      <button onClick={() => setIsFullScreen(false)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors text-sm font-bold">
                          <Minimize2 size={16} /> Exit
                      </button>
                  </div>
              </div>
          )}

          <div className={isFullScreen ? "flex-1 overflow-y-auto custom-scrollbar relative" : "relative"}>
            <table className="w-full text-left relative">
                <thead className="bg-[#0f172a] text-sky-400 text-[10px] uppercase tracking-widest font-bold sticky top-0 z-10 shadow-md">
                <tr>
                    <th className="px-6 py-4 bg-[#0f172a]">Employee Identity</th>
                    <th className="px-6 py-4 bg-[#0f172a]">Hierarchy</th>
                    <th className="px-6 py-4 bg-[#0f172a]">Gross Wages</th>
                    <th className="px-6 py-4 text-right bg-[#0f172a]">Actions</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                {filteredEmployees.map((emp) => (
                    <tr key={emp.id} onClick={() => !isFullScreen && setSelectedEmp(emp)} className={`cursor-pointer hover:bg-slate-800/50 ${selectedEmp?.id === emp.id && !isFullScreen ? 'bg-blue-900/40 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden shrink-0 border border-slate-600 flex items-center justify-center">
                                {emp.photoUrl ? <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" /> : <User2 size={16} className="text-slate-400" />}
                            </div>
                            <div>
                                <div className={`font-bold ${!emp.state ? 'text-red-500' : 'text-white'}`}>{emp.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{emp.id}</div>
                            </div>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="text-[10px] text-sky-400 font-bold uppercase">{emp.designation}</div>
                        <div className="text-[9px] text-slate-500 uppercase">{emp.division} • {emp.branch}</div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-1 font-mono text-emerald-400 font-bold"><span>₹</span>{calculateGrossWage(emp).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                            {canEdit && <button onClick={(e) => { e.stopPropagation(); proceedToEdit(emp); }} className="text-slate-400 hover:text-blue-400 p-2 hover:bg-blue-900/30 rounded transition-colors" title="Edit Record"><Edit2 size={16} /></button>}
                            {canDelete && <button onClick={(e) => initiateDelete(emp, e)} className="text-slate-400 hover:text-red-400 p-2 hover:bg-red-900/30 rounded transition-colors" title="Delete Record"><Trash2 size={16} /></button>}
                        </div>
                    </td>
                    </tr>
                ))}
                {filteredEmployees.length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-500 text-sm">No employees found.</td></tr>
                )}
                </tbody>
            </table>
          </div>
        </div>

        {/* Detail View - Only show if NOT in Full Screen Mode */}
        {!isFullScreen && (
        <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-6 shadow-xl sticky top-24 h-fit max-h-[calc(100vh-10rem)] overflow-y-auto custom-scrollbar">
          {selectedEmp ? (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex items-start gap-5">
                <div className="flex flex-col items-center gap-2">
                    <div className="relative group w-24 h-24 rounded-xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                    {selectedEmp.photoUrl ? <img src={selectedEmp.photoUrl} alt={selectedEmp.name} className="w-full h-full object-cover" /> : <User2 size={40} className="text-slate-600" />}
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity">
                        <Upload size={16} className="text-white mb-1" />
                        <span className="text-[8px] text-slate-200 uppercase font-bold">Update</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleDetailPhotoUpload} />
                    </label>
                    </div>
                    {selectedEmp.mobile && <div className="flex items-center gap-1.5 text-xs font-mono text-sky-400 bg-blue-900/20 px-2.5 py-1 rounded-lg border border-blue-900/30"><Phone size={12} /><span>{selectedEmp.mobile}</span></div>}
                </div>
                <div className="pt-2">
                  <h3 className="text-2xl font-black text-white leading-tight">{selectedEmp.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                     <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300 border border-slate-600 font-mono">{selectedEmp.id}</span>
                     {selectedEmp.gender && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-900/40 text-purple-300 border border-purple-800/50 uppercase">{selectedEmp.gender}</span>}
                  </div>
                  <p className="text-sm text-blue-400 font-bold mt-2">{selectedEmp.designation}</p>
                </div>
              </div>

              <div className="space-y-6">
                <section>
                  <h4 className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Briefcase size={12} /> Organizational Placement</h4>
                  <div className="bg-[#0f172a] p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-y-4 gap-x-2">
                    <div className="space-y-1"><span className="text-[9px] font-bold text-slate-500 uppercase">Division</span><div className="text-xs text-slate-200">{selectedEmp.division || selectedEmp.department}</div></div>
                    <div className="space-y-1"><span className="text-[9px] font-bold text-slate-500 uppercase">Branch</span><div className="text-xs text-slate-200">{selectedEmp.branch || 'N/A'}</div></div>
                    <div className="space-y-1"><span className="text-[9px] font-bold text-slate-500 uppercase">Site Location</span><div className="text-xs text-slate-200">{selectedEmp.site || 'N/A'}</div></div>
                    <div className="space-y-1"><span className="text-[9px] font-bold text-slate-500 uppercase">Designation</span><div className="text-xs text-sky-400 font-bold">{selectedEmp.designation}</div></div>
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-3 flex items-center gap-2"><MapPin size={12} /> Address Details</h4>
                  <div className="bg-[#0f172a] p-4 rounded-xl border border-slate-800 space-y-2">
                      {selectedEmp.flatNumber && <div className="text-xs text-slate-200">{selectedEmp.flatNumber},</div>}
                      <div className="text-xs text-slate-200">{selectedEmp.streetAddress}</div>
                      <div className="text-xs text-slate-200">{selectedEmp.city}, {selectedEmp.state}</div>
                      <div className="text-xs font-mono text-slate-400">PIN: {selectedEmp.pincode}</div>
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Fingerprint size={12} /> Statutory Identifiers</h4>
                  <div className="bg-[#0f172a] p-5 rounded-xl border border-slate-800 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><span className="text-[10px] font-bold text-slate-500 uppercase">UAN Number</span><div className="text-xs font-mono text-white">{selectedEmp.uanc || 'N/A'}</div></div>
                        <div className="space-y-1"><span className="text-[10px] font-bold text-slate-500 uppercase">PF Number</span><div className="text-xs font-mono text-white">{selectedEmp.pfNumber || 'N/A'}</div></div>
                        <div className="space-y-1"><span className="text-[10px] font-bold text-slate-500 uppercase">PAN Card</span><div className="text-xs font-mono text-white uppercase">{selectedEmp.pan || 'N/A'}</div></div>
                         <div className="space-y-1"><span className="text-[10px] font-bold text-slate-500 uppercase">Aadhaar Number</span><div className="text-xs font-mono text-white uppercase">{selectedEmp.aadhaarNumber || 'N/A'}</div></div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500"><Briefcase size={48} className="mb-4 opacity-20" /><p>Select employee record.</p></div>
          )}
        </div>
        )}
      </div>

      {/* Add/Edit Employee Modal/Form */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1e293b] w-full max-w-5xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
            <div className="p-6 bg-[#0f172a] border-b border-slate-700 flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-xl font-bold text-sky-400 flex items-center gap-2">{editingId ? <Edit2 size={20} /> : <Plus size={20} />} {editingId ? 'Edit Employee Master' : 'Create New Employee Master'}</h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-8 space-y-8">
              {/* Photo & Identity */}
              <div>
                 <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Profile Image & Primary Info</h3>
                 <div className="flex flex-col md:flex-row gap-6 mb-6">
                    <div className="shrink-0 flex flex-col items-center gap-2">
                         <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden hover:border-blue-500 transition-colors group relative cursor-pointer">
                            {newEmpForm.photoUrl ? <img src={newEmpForm.photoUrl} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-500 group-hover:text-blue-400" size={24} />}
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handlePhotoUpload} />
                         </div>
                         <span className="text-[10px] text-slate-400">Upload Photo</span>
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Employee ID <span className="text-red-400">*</span></label>
                            <input required type="text" readOnly={!!editingId} className={`w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500 ${editingId ? 'opacity-50 cursor-not-allowed' : ''}`} value={newEmpForm.id} onChange={e => setNewEmpForm({...newEmpForm, id: e.target.value})} />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Full Name <span className="text-red-400">*</span></label>
                            <input required type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.name} onChange={e => setNewEmpForm({...newEmpForm, name: e.target.value})} />
                        </div>
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Designation</label>
                            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.designation} onChange={e => setNewEmpForm({...newEmpForm, designation: e.target.value})}>
                                {designations.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                         </div>
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Date of Joining</label>
                            <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.doj} onChange={e => setNewEmpForm({...newEmpForm, doj: e.target.value})} />
                         </div>
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Gender</label>
                            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.gender} onChange={e => setNewEmpForm({...newEmpForm, gender: e.target.value as any})}>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Transgender">Transgender</option>
                                <option value="Others">Others</option>
                            </select>
                         </div>
                    </div>
                 </div>
              </div>

              {/* Personal & Family */}
              <div>
                  <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Family & Organization</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1 md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Father/Spouse Name</label>
                          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.fatherSpouseName} onChange={e => setNewEmpForm({...newEmpForm, fatherSpouseName: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Relationship</label>
                          <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.relationship} onChange={e => setNewEmpForm({...newEmpForm, relationship: e.target.value})}>
                              <option value="Father">Father</option>
                              <option value="Husband">Husband</option>
                              <option value="Mother">Mother</option>
                              <option value="Wife">Wife</option>
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Date of Birth</label>
                          <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.dob} onChange={e => setNewEmpForm({...newEmpForm, dob: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Division</label>
                          <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.division} onChange={e => setNewEmpForm({...newEmpForm, division: e.target.value})}>
                              {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Branch</label>
                          <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.branch} onChange={e => setNewEmpForm({...newEmpForm, branch: e.target.value})}>
                              {branches.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Site</label>
                          <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.site} onChange={e => setNewEmpForm({...newEmpForm, site: e.target.value})}>
                              {sites.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      </div>
                  </div>
              </div>

              {/* Contact & Address */}
              <div>
                  <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Address & Communication</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1 md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Flat/Door No & Street</label>
                          <div className="flex gap-2">
                              <input type="text" placeholder="No." className="w-1/4 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.flatNumber} onChange={e => setNewEmpForm({...newEmpForm, flatNumber: e.target.value})} />
                              <input type="text" placeholder="Street Address" className="w-3/4 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.streetAddress} onChange={e => setNewEmpForm({...newEmpForm, streetAddress: e.target.value})} />
                          </div>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">City</label>
                          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.city} onChange={e => setNewEmpForm({...newEmpForm, city: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">State</label>
                          <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.state} onChange={e => setNewEmpForm({...newEmpForm, state: e.target.value})}>
                              <option value="">Select State</option>
                              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Pincode</label>
                          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.pincode} onChange={e => setNewEmpForm({...newEmpForm, pincode: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Mobile No</label>
                          <input type="tel" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.mobile} onChange={e => setNewEmpForm({...newEmpForm, mobile: e.target.value})} />
                      </div>
                  </div>
              </div>

              {/* Statutory Info */}
              <div>
                  <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Statutory Identifiers</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">UAN Number</label>
                          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.uanc} onChange={e => setNewEmpForm({...newEmpForm, uanc: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">PF Number</label>
                          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.pfNumber} onChange={e => setNewEmpForm({...newEmpForm, pfNumber: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">ESI Number</label>
                          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.esiNumber} onChange={e => setNewEmpForm({...newEmpForm,esiNumber: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">PAN Number</label>
                          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500 uppercase" value={newEmpForm.pan} onChange={e => setNewEmpForm({...newEmpForm, pan: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Aadhaar Number</label>
                          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.aadhaarNumber} onChange={e => setNewEmpForm({...newEmpForm, aadhaarNumber: e.target.value})} />
                      </div>
                  </div>
              </div>

              {/* Bank Details */}
              <div>
                  <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Bank Account Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Bank Account No</label>
                          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.bankAccount} onChange={e => setNewEmpForm({...newEmpForm, bankAccount: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">IFSC Code</label>
                          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500 uppercase" value={newEmpForm.ifsc} onChange={e => setNewEmpForm({...newEmpForm, ifsc: e.target.value})} />
                      </div>
                  </div>
              </div>

              {/* Wage Components */}
              <div>
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Wage Components (Monthly)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Basic Pay</label>
                          <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-emerald-500" value={newEmpForm.basicPay} onChange={e => setNewEmpForm({...newEmpForm, basicPay: +e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">DA</label>
                          <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-emerald-500" value={newEmpForm.da} onChange={e => setNewEmpForm({...newEmpForm, da: +e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">HRA</label>
                          <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-emerald-500" value={newEmpForm.hra} onChange={e => setNewEmpForm({...newEmpForm, hra: +e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Conveyance</label>
                          <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-emerald-500" value={newEmpForm.conveyance} onChange={e => setNewEmpForm({...newEmpForm, conveyance: +e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Retaining Allw</label>
                          <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-emerald-500" value={newEmpForm.retainingAllowance} onChange={e => setNewEmpForm({...newEmpForm, retainingAllowance: +e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Washing Allw</label>
                          <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-emerald-500" value={newEmpForm.washing} onChange={e => setNewEmpForm({...newEmpForm, washing: +e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Attire Allw</label>
                          <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-emerald-500" value={newEmpForm.attire} onChange={e => setNewEmpForm({...newEmpForm, attire: +e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Special Allw 1</label>
                          <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-emerald-500" value={newEmpForm.specialAllowance1} onChange={e => setNewEmpForm({...newEmpForm, specialAllowance1: +e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Special Allw 2</label>
                          <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-emerald-500" value={newEmpForm.specialAllowance2} onChange={e => setNewEmpForm({...newEmpForm, specialAllowance2: +e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Special Allw 3</label>
                          <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-emerald-500" value={newEmpForm.specialAllowance3} onChange={e => setNewEmpForm({...newEmpForm, specialAllowance3: +e.target.value})} />
                      </div>
                  </div>
              </div>

              {/* PF & ESI Options */}
              <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                  <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-4">Statutory Options</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500 bg-slate-800" checked={newEmpForm.isPFExempt} onChange={e => setNewEmpForm({...newEmpForm, isPFExempt: e.target.checked})} />
                          <span className="text-sm text-slate-300">PF Exempt</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500 bg-slate-800" checked={newEmpForm.isESIExempt} onChange={e => setNewEmpForm({...newEmpForm, isESIExempt: e.target.checked})} />
                          <span className="text-sm text-slate-300">ESI Exempt</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500 bg-slate-800" checked={newEmpForm.isPFHigherWages} onChange={e => setNewEmpForm({...newEmpForm, isPFHigherWages: e.target.checked})} />
                          <span className="text-sm text-slate-300">PF on Full Basic</span>
                      </label>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Voluntary PF (%)</label>
                          <input type="number" className="w-20 bg-slate-800 border border-slate-600 rounded p-1.5 text-white font-mono text-sm" value={newEmpForm.employeeVPFRate} onChange={e => setNewEmpForm({...newEmpForm, employeeVPFRate: +e.target.value})} />
                      </div>
                  </div>
              </div>

              <div className="flex justify-end gap-4 pt-8 border-t border-slate-800 sticky bottom-0 bg-[#1e293b] py-4">
                <button type="button" onClick={handleCloseModal} className="px-6 py-2.5 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all font-bold">
                  CANCEL
                </button>
                <button type="submit" className="px-10 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg font-black flex items-center gap-2">
                  <Save size={18} /> {editingId ? 'UPDATE RECORD' : 'SAVE MASTER RECORD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-red-900/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setDeleteTarget(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                    <X size={20} />
                </button>
                <div className="flex flex-col items-center gap-2">
                    <div className="p-4 bg-red-900/20 text-red-500 rounded-full border border-red-900/50 mb-2">
                        <Trash2 size={32} />
                    </div>
                    <h3 className="text-xl font-black text-white text-center">DELETE EMPLOYEE</h3>
                    <p className="text-xs text-red-300 text-center leading-relaxed">
                        Are you sure you want to permanently delete:
                        <br />
                        <span className="text-yellow-400 font-bold text-lg block mt-2">{deleteTarget.name}</span>
                        <span className="block mt-2">This action cannot be undone.</span>
                    </p>
                </div>
                
                <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                        <KeyRound size={16} />
                        <span>Confirm Password</span>
                    </div>
                    <input 
                        type="password" 
                        placeholder="Enter your password" 
                        autoFocus
                        className={`w-full bg-[#0f172a] border ${authError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                        value={authPassword}
                        onChange={(e) => { setAuthPassword(e.target.value); setAuthError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmDelete()}
                    />
                    {authError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{authError}</p>}
                </div>
                
                <button 
                    onClick={handleConfirmDelete}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2"
                >
                    <Trash2 size={18} /> CONFIRM DELETE
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeList;
