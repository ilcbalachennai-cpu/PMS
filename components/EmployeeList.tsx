
import React, { useState, useRef } from 'react';
import { Plus, Search, Edit2, Image as ImageIcon, User2, Briefcase, Landmark, ShieldAlert, Fingerprint, Upload, Phone, FileSpreadsheet, Download, Lock, X, Save, MapPin, KeyRound, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee } from '../types';
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
}

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, setEmployees, onAddEmployee, onBulkAddEmployees, designations, divisions, branches, sites }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- CONFIGURATION ---
  const SUPERVISOR_PASSWORD = "admin"; 
  // ---------------------

  // --- PASSWORD MODAL STATE ---
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pendingEditEmp, setPendingEditEmp] = useState<Employee | null>(null);
  const [pendingAction, setPendingAction] = useState<'EDIT' | 'DELETE' | null>(null);

  const getEmptyForm = (): Partial<Employee> => ({
    id: `EMP00${employees.length + 1}`,
    name: '',
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
    state: '', // Default empty to trigger validation visual
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
    // 1. Define Headers
    const headers = [
      "Employee ID", "Name", "Designation", "Division", "Branch", "Site", 
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

    // 2. Mock Data Row
    const data = [
      [
        "EMP101", "John Doe", "Engineer", "Engineering", "Chennai", "Main Plant", 
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

    // 3. Create Workbook
    const wb = XLSX.utils.book_new();

    // 4. Add Template Sheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    
    // --- Add Dropdown Validation Logic via Workaround (SheetJS CE) ---
    // We create a second sheet with Master Data and reference it if possible, 
    // or at least provide it for Copy-Paste.
    
    const masterData = [
        ["Valid States", "Valid Divisions", "Valid Branches"],
        ...INDIAN_STATES.map((s, i) => [
            s, 
            divisions[i] || "", 
            branches[i] || ""
        ])
    ];
    const wsMaster = XLSX.utils.aoa_to_sheet(masterData);

    // Apply Validation to State Column (Column N -> Index 13)
    if (!ws['!dataValidation']) ws['!dataValidation'] = [];
    ws['!dataValidation'].push({
      sqref: "N2:N1000", // Apply to State column rows 2-1000
      type: "list",
      operator: "equal",
      formula1: "'MasterData'!$A$2:$A$40", // Reference the MasterData sheet
      showDropDown: true,
      showErrorMessage: true,
      errorTitle: "Invalid State",
      error: "Please select a valid state from the list."
    });

    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.utils.book_append_sheet(wb, wsMaster, "MasterData");

    // 5. Download
    XLSX.writeFile(wb, "Employee_Import_Template_With_Masters.xlsx");
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
      
      // Helper to match headers case-insensitively and ignoring whitespace (e.g. "State " == "state")
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
        designation: safeString(getValue(row, "Designation")) || "Staff",
        department: safeString(getValue(row, "Division")) || "",
        division: safeString(getValue(row, "Division")) || "",
        branch: safeString(getValue(row, "Branch")) || "",
        site: safeString(getValue(row, "Site")) || "",
        doj: processDate(getValue(row, "DOJ (YYYY-MM-DD)")) || new Date().toISOString().split('T')[0],
        dob: processDate(getValue(row, "DOB (YYYY-MM-DD)")),
        
        fatherSpouseName: safeString(getValue(row, "Father/Spouse Name")),
        relationship: safeString(getValue(row, "Relationship")) || "Father",
        
        // Map Excel Address Columns using Robust Getter
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

  // --- END EXCEL HANDLING ---

  const initiateEdit = (emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setPendingEditEmp(emp);
    setPendingAction('EDIT');
    setPasswordInput("");
    setPasswordError("");
    setShowPasswordModal(true);
  };

  const initiateDelete = (emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingEditEmp(emp);
    setPendingAction('DELETE');
    setPasswordInput("");
    setPasswordError("");
    setShowPasswordModal(true);
  };

  const performDelete = (id: string) => {
      const updatedList = employees.filter(emp => emp.id !== id);
      setEmployees(updatedList);
      if (selectedEmp?.id === id) {
          setSelectedEmp(null);
      }
  };

  const verifyPasswordAndProceed = () => {
    if (passwordInput === SUPERVISOR_PASSWORD) {
        setShowPasswordModal(false);
        if (pendingEditEmp) {
            if (pendingAction === 'EDIT') {
                proceedToEdit(pendingEditEmp);
            } else if (pendingAction === 'DELETE') {
                performDelete(pendingEditEmp.id);
            }
        }
        // Reset state
        setPendingEditEmp(null);
        setPendingAction(null);
    } else {
        setPasswordError("Incorrect Password. Try 'admin'");
    }
  };

  const proceedToEdit = (emp: Employee) => {
    setEditingId(emp.id);
    
    // Initialize form with defaults FIRST, then spread employee data
    const safeFormState = { 
        ...getEmptyForm(),
        ...emp,
        flatNumber: emp.flatNumber || '',
        streetAddress: emp.streetAddress || '',
        city: emp.city || '',
        state: emp.state || '', // Allow empty state to persist empty to show validation error
        pincode: emp.pincode || '',
        designation: emp.designation || '',
        division: emp.division || '',
        branch: emp.branch || '',
        site: emp.site || '',
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
        // Update existing record
        const updatedList = employees.map(emp => emp.id === editingId ? fullEmp : emp);
        setEmployees(updatedList);
        
        if (selectedEmp?.id === editingId) {
            setSelectedEmp(fullEmp);
        }
    } else {
        // Add new record
        onAddEmployee(fullEmp);
    }
    
    handleCloseModal();
  };

  return (
    <div className="space-y-6 text-white relative">
      <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Search Master Records..." className="w-full pl-10 pr-4 py-2.5 bg-[#0f172a] border border-slate-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        
        <div className="flex items-center gap-3">
            <button 
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors border border-slate-600 text-sm font-bold"
                title="Download Excel Template"
            >
                <Download size={16} /> Template
            </button>
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-lg text-sm font-bold"
            >
                <FileSpreadsheet size={16} /> Import Excel
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleExcelUpload} 
                className="hidden" 
                accept=".xlsx, .xls" 
            />
            <button 
            onClick={() => { setIsAdding(true); setEditingId(null); setNewEmpForm(getEmptyForm()); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-shadow shadow-lg font-bold"
            >
            <Plus size={18} /> Add Manual
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#1e293b] rounded-xl border border-slate-800 overflow-hidden shadow-2xl h-fit">
          <table className="w-full text-left">
            <thead className="bg-[#0f172a] text-sky-400 text-[10px] uppercase tracking-widest font-bold">
              <tr>
                <th className="px-6 py-4">Employee Identity</th>
                <th className="px-6 py-4">Hierarchy</th>
                <th className="px-6 py-4">Gross Wages</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} onClick={() => setSelectedEmp(emp)} className={`cursor-pointer hover:bg-slate-800/50 ${selectedEmp?.id === emp.id ? 'bg-blue-900/40 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden shrink-0 border border-slate-600 flex items-center justify-center">
                            {emp.photoUrl ? (
                                <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                            ) : (
                                <User2 size={16} className="text-slate-400" />
                            )}
                        </div>
                        <div>
                            {/* Updated Name Display Logic - RED if State is missing */}
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
                     <div className="flex items-center gap-1 font-mono text-emerald-400 font-bold">
                        <span>₹</span>
                        {calculateGrossWage(emp).toLocaleString()}
                     </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                        <button 
                            onClick={(e) => initiateEdit(emp, e)} 
                            className="text-slate-400 hover:text-blue-400 p-2 hover:bg-blue-900/30 rounded transition-colors" 
                            title="Edit (Password Required)"
                        >
                             <div className="relative">
                               <Edit2 size={16} />
                               <Lock size={8} className="absolute -top-1 -right-1 text-amber-400" />
                             </div>
                        </button>
                        <button 
                            onClick={(e) => initiateDelete(emp, e)} 
                            className="text-slate-400 hover:text-red-400 p-2 hover:bg-red-900/30 rounded transition-colors" 
                            title="Delete Record (Password Required)"
                        >
                             <div className="relative">
                               <Trash2 size={16} />
                               <Lock size={8} className="absolute -top-1 -right-1 text-red-500" />
                             </div>
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                 <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-500 text-sm">
                        No employees found. Use "Import Excel" or "Add Manual" to populate the master.
                    </td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-6 shadow-xl sticky top-24 h-fit max-h-[calc(100vh-10rem)] overflow-y-auto">
          {selectedEmp ? (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex items-start gap-5">
                <div className="flex flex-col items-center gap-2">
                    <div className="relative group w-24 h-24 rounded-xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                    {selectedEmp.photoUrl ? (
                        <img src={selectedEmp.photoUrl} alt={selectedEmp.name} className="w-full h-full object-cover" />
                    ) : (
                        <User2 size={40} className="text-slate-600" />
                    )}
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity">
                        <Upload size={16} className="text-white mb-1" />
                        <span className="text-[8px] text-slate-200 uppercase font-bold">Update</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleDetailPhotoUpload} />
                    </label>
                    </div>
                    {selectedEmp.mobile && (
                        <div className="flex items-center gap-1.5 text-xs font-mono text-sky-400 bg-blue-900/20 px-2.5 py-1 rounded-lg border border-blue-900/30">
                            <Phone size={12} />
                            <span>{selectedEmp.mobile}</span>
                        </div>
                    )}
                </div>
                <div className="pt-2">
                  <h3 className="text-2xl font-black text-white leading-tight">{selectedEmp.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                     <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300 border border-slate-600 font-mono">{selectedEmp.id}</span>
                  </div>
                  <p className="text-sm text-blue-400 font-bold mt-2">{selectedEmp.designation}</p>
                </div>
              </div>

              <div className="space-y-6">
                <section>
                  <h4 className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Briefcase size={12} /> Organizational Placement</h4>
                  <div className="bg-[#0f172a] p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-y-4 gap-x-2">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Division</span>
                      <div className="text-xs text-slate-200">{selectedEmp.division || selectedEmp.department}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Branch</span>
                      <div className="text-xs text-slate-200">{selectedEmp.branch || 'N/A'}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Site Location</span>
                      <div className="text-xs text-slate-200">{selectedEmp.site || 'N/A'}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Designation</span>
                      <div className="text-xs text-sky-400 font-bold">{selectedEmp.designation}</div>
                    </div>
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
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">UAN Number</span>
                            <div className="text-xs font-mono text-white">{selectedEmp.uanc || 'N/A'}</div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">PF Number</span>
                            <div className="text-xs font-mono text-white">{selectedEmp.pfNumber || 'N/A'}</div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">PAN Card</span>
                            <div className="text-xs font-mono text-white uppercase">{selectedEmp.pan || 'N/A'}</div>
                        </div>
                         <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Aadhaar Number</span>
                            <div className="text-xs font-mono text-white uppercase">{selectedEmp.aadhaarNumber || 'N/A'}</div>
                        </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Landmark size={12} /> Master Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs text-slate-300">
                    <div><span className="text-slate-500 block">Father/Spouse</span>{selectedEmp.fatherSpouseName}</div>
                    <div><span className="text-slate-500 block">Relationship</span>{selectedEmp.relationship}</div>
                    <div><span className="text-slate-500 block">DOB</span>{formatDate(selectedEmp.dob)}</div>
                    <div><span className="text-slate-500 block">DOJ</span>{formatDate(selectedEmp.doj)}</div>
                    <div className="col-span-2"><span className="text-slate-500 block">Bank Account</span>{selectedEmp.bankAccount} ({selectedEmp.ifsc})</div>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500"><Briefcase size={48} className="mb-4 opacity-20" /><p>Select employee record.</p></div>
          )}
        </div>
      </div>

      {/* CUSTOM PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setShowPasswordModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                    <X size={20} />
                </button>
                <div className="flex flex-col items-center gap-2">
                    <div className={`p-3 rounded-full border ${pendingAction === 'DELETE' ? 'bg-red-900/30 text-red-500 border-red-900/50' : 'bg-amber-900/30 text-amber-500 border-amber-900/50'}`}>
                        <KeyRound size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white">Supervisor Access</h3>
                    <p className="text-xs text-slate-400 text-center">
                        {pendingAction === 'DELETE' ? 'Authorize Deletion. This action is permanent.' : 'Restricted Action. Please verify identity.'}
                    </p>
                </div>
                
                <div className="space-y-3 mt-2">
                    <input 
                        type="password" 
                        placeholder="Enter Supervisor Password" 
                        autoFocus
                        className={`w-full bg-[#0f172a] border ${passwordError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-amber-500`}
                        value={passwordInput}
                        onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && verifyPasswordAndProceed()}
                    />
                    {passwordError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{passwordError}</p>}
                    
                    <button 
                        onClick={verifyPasswordAndProceed}
                        className={`w-full text-white font-bold py-3 rounded-lg shadow-lg transition-colors mt-2 ${pendingAction === 'DELETE' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                    >
                        {pendingAction === 'DELETE' ? 'CONFIRM DELETION' : 'VERIFY & PROCEED'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Add/Edit Employee Modal/Form */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1e293b] w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
            <div className="p-6 bg-[#0f172a] border-b border-slate-700 flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-xl font-bold text-sky-400 flex items-center gap-2">
                {editingId ? <Edit2 size={20} /> : <Plus size={20} />} 
                {editingId ? 'Edit Employee Master' : 'Create New Employee Master'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                
                {/* Photo & Identity Section */}
                <div className="md:col-span-3">
                     <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Profile Image & Primary Info</h3>
                     <div className="flex flex-col md:flex-row gap-6 mb-6">
                        <div className="shrink-0 flex flex-col items-center gap-2">
                             <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden hover:border-blue-500 transition-colors group relative cursor-pointer">
                                {newEmpForm.photoUrl ? (
                                    <img src={newEmpForm.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="text-slate-500 group-hover:text-blue-400" size={24} />
                                )}
                                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handlePhotoUpload} />
                             </div>
                             <span className="text-[10px] text-slate-400">Upload Photo</span>
                        </div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Employee ID <span className="text-red-400">*</span></label>
                                <input required type="text" readOnly={!!editingId} className={`w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500 ${editingId ? 'opacity-50 cursor-not-allowed' : ''}`} value={newEmpForm.id} onChange={e => setNewEmpForm({...newEmpForm, id: e.target.value})} />
                            </div>
                            <div className="space-y-1">
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
                        </div>
                     </div>
                </div>

                {/* Organization Hierarchy */}
                <div className="md:col-span-3">
                    <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 border-b border-slate-800 pb-2 mt-4">Organizational Hierarchy</h3>
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Site Location</label>
                  <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.site} onChange={e => setNewEmpForm({...newEmpForm, site: e.target.value})}>
                    {sites.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Personal & Family Section */}
                <div className="md:col-span-3">
                    <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 border-b border-slate-800 pb-2 mt-4">Personal & Family Details</h3>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Father / Spouse Name</label>
                  <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.fatherSpouseName} onChange={e => setNewEmpForm({...newEmpForm, fatherSpouseName: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Relationship</label>
                  <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.relationship} onChange={e => setNewEmpForm({...newEmpForm, relationship: e.target.value})}>
                    <option value="Father">Father</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Mother">Mother</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Mobile Number</label>
                  <input type="tel" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.mobile} onChange={e => setNewEmpForm({...newEmpForm, mobile: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Date of Birth</label>
                  <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.dob} onChange={e => setNewEmpForm({...newEmpForm, dob: e.target.value})} />
                </div>
                
                {/* NEW ADDRESS BREAKDOWN */}
                <div className="md:col-span-3 space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700/50 mt-2">
                   <h4 className="text-[10px] font-bold text-slate-400 uppercase">Residential Address</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Flat / Door No</label>
                          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.flatNumber} onChange={e => setNewEmpForm({...newEmpForm, flatNumber: e.target.value})} />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Pincode</label>
                          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.pincode} onChange={e => setNewEmpForm({...newEmpForm, pincode: e.target.value})} />
                       </div>
                       <div className="space-y-1 md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Street / Building / Area</label>
                          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.streetAddress} onChange={e => setNewEmpForm({...newEmpForm, streetAddress: e.target.value})} />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">City</label>
                          <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.city} onChange={e => setNewEmpForm({...newEmpForm, city: e.target.value})} />
                       </div>
                       <div className="space-y-1">
                          {/* UPDATED: Red label if State is missing */}
                          <label className={`text-[10px] font-bold uppercase ${!newEmpForm.state ? 'text-red-500' : 'text-slate-500'}`}>State</label>
                          <select 
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500" 
                            value={newEmpForm.state} 
                            onChange={e => setNewEmpForm({...newEmpForm, state: e.target.value})}
                          >
                            <option value="">Select State</option>
                            {INDIAN_STATES.map((state) => (
                                <option key={state} value={state}>{state}</option>
                            ))}
                          </select>
                       </div>
                   </div>
                </div>

                {/* Wage Structure Section - All 10 Components */}
                <div className="md:col-span-3">
                    <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 border-b border-slate-800 pb-2 mt-4">Wage Structure</h3>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Basic Pay</label>
                  <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.basicPay} onChange={e => setNewEmpForm({...newEmpForm, basicPay: +e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">DA</label>
                  <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.da} onChange={e => setNewEmpForm({...newEmpForm, da: +e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Retaining Allowance</label>
                  <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.retainingAllowance} onChange={e => setNewEmpForm({...newEmpForm, retainingAllowance: +e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">HRA</label>
                  <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.hra} onChange={e => setNewEmpForm({...newEmpForm, hra: +e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Conveyance</label>
                  <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.conveyance} onChange={e => setNewEmpForm({...newEmpForm, conveyance: +e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Washing</label>
                  <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.washing} onChange={e => setNewEmpForm({...newEmpForm, washing: +e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Attire</label>
                  <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.attire} onChange={e => setNewEmpForm({...newEmpForm, attire: +e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Special Allowance 1</label>
                  <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.specialAllowance1} onChange={e => setNewEmpForm({...newEmpForm, specialAllowance1: +e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Special Allowance 2</label>
                  <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.specialAllowance2} onChange={e => setNewEmpForm({...newEmpForm, specialAllowance2: +e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Special Allowance 3</label>
                  <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.specialAllowance3} onChange={e => setNewEmpForm({...newEmpForm, specialAllowance3: +e.target.value})} />
                </div>

                {/* Bank Details Section */}
                <div className="md:col-span-3">
                    <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 border-b border-slate-800 pb-2 mt-4">Bank Details</h3>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Bank Account Number</label>
                  <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.bankAccount} onChange={e => setNewEmpForm({...newEmpForm, bankAccount: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">IFSC Code</label>
                  <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.ifsc} onChange={e => setNewEmpForm({...newEmpForm, ifsc: e.target.value})} />
                </div>

                {/* Compliance Section */}
                <div className="md:col-span-3">
                    <h3 className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 border-b border-slate-800 pb-2 mt-4">Compliance IDs</h3>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">PAN Number</label>
                  <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.pan} onChange={e => setNewEmpForm({...newEmpForm, pan: e.target.value})} />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Aadhaar Number</label>
                   <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.aadhaarNumber} onChange={e => setNewEmpForm({...newEmpForm, aadhaarNumber: e.target.value})} placeholder="12 Digit Aadhaar" maxLength={12} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">UAN (Universal Account Number)</label>
                  <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.uanc} onChange={e => setNewEmpForm({...newEmpForm, uanc: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">PF Number</label>
                  <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.pfNumber} onChange={e => setNewEmpForm({...newEmpForm, pfNumber: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">ESI Number</label>
                  <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-blue-500" value={newEmpForm.esiNumber} onChange={e => setNewEmpForm({...newEmpForm, esiNumber: e.target.value})} />
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
    </div>
  );
};

export default EmployeeList;
