
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Search, Edit2, User2, Briefcase, Landmark, ShieldAlert, Fingerprint, Upload, Phone, Download, X, Save, MapPin, Trash2, Maximize2, UserPlus, CheckCircle, CheckCircle2, AlertTriangle, Home, IndianRupee, ShieldCheck, MapPinned, CreditCard, Building2, UserMinus, Camera, LogOut, RotateCcw, KeyRound, FileSpreadsheet, FileText, CheckSquare, Square, Filter, Loader2, DatabaseZap, ListPlus, FileX } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee, User, CompanyProfile } from '../types';
import { INDIAN_STATES, NATURE_OF_BUSINESS_OPTIONS } from '../constants';
import { generateExcelReport, generatePDFTableReport, formatDateInd } from '../services/reportService';

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
  companyProfile?: CompanyProfile;
}

const AVAILABLE_COLUMNS = [
    { key: 'id', label: 'Employee ID' },
    { key: 'name', label: 'Name' },
    { key: 'designation', label: 'Designation' },
    { key: 'department', label: 'Department' },
    { key: 'branch', label: 'Branch' },
    { key: 'doj', label: 'Date of Joining' },
    { key: 'mobile', label: 'Mobile No' },
    { key: 'uanc', label: 'UAN' },
    { key: 'pfNumber', label: 'PF Number' },
    { key: 'esiNumber', label: 'ESI Number' },
    { key: 'pan', label: 'PAN' },
    { key: 'aadhaarNumber', label: 'Aadhaar' },
    { key: 'bankAccount', label: 'Bank Account' },
    { key: 'ifsc', label: 'IFSC' },
    { key: 'fatherSpouseName', label: 'Father/Spouse' },
    { key: 'gender', label: 'Gender' },
    { key: 'dob', label: 'Date of Birth' },
    { key: 'grossPay', label: 'Gross Salary' },
    { key: 'dol', label: 'Date of Leaving' },
    { key: 'leavingReason', label: 'Reason for Leaving' },
];

const EmployeeList: React.FC<EmployeeListProps> = ({ employees, setEmployees, onAddEmployee, onBulkAddEmployees, designations, divisions, branches, sites, currentUser, companyProfile }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  const [showRejoinPanel, setShowRejoinPanel] = useState(false);
  const [rejoinSearchTerm, setRejoinSearchTerm] = useState('');
  const [authModal, setAuthModal] = useState({ isOpen: false, password: '', error: '', targetEmp: null as Employee | null });

  // New State for Import Report
  const [importSummary, setImportSummary] = useState<{
      total: number;
      success: number;
      failed: number;
      errors: { row: number; name: string; id: string; reason: string }[]
  } | null>(null);

  const [exportModal, setExportModal] = useState({ 
      isOpen: false, 
      format: 'Excel' as 'Excel' | 'PDF', 
      targetGroup: 'Active' as 'Active' | 'Left',
      selectedColumns: [] as string[],
      password: '', 
      error: '' 
  });

  const [deleteModal, setDeleteModal] = useState({
      isOpen: false,
      targetEmp: null as Employee | null,
      password: '',
      error: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const getEmptyForm = (): Partial<Employee> => ({
    id: `EMP00${employees.length + 1}`,
    name: '', gender: 'Male', dob: '',
    doj: new Date().toISOString().split('T')[0],
    dol: '', leavingReason: '',
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
    epfMembershipDate: '', jointDeclaration: false,
    pfHigherPension: { 
      enabled: false, contributedBefore2014: 'No', dojImpact: '', 
      employeeContribution: 'Regular', employerContribution: 'Regular', isHigherPensionOpted: 'No' 
    },
    epsMaturityConfigured: false, isDeferredPension: false, deferredPensionOption: 'WithEPS',
    photoUrl: '', serviceRecords: []
  });

  const [newEmpForm, setNewEmpForm] = useState<Partial<Employee>>(getEmptyForm());

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || emp.id.toLowerCase().includes(searchTerm.toLowerCase());
    const isActive = !emp.dol; 
    return matchesSearch && (isActive || searchTerm.length > 2);
  });

  const exEmployees = useMemo(() => {
      return employees.filter(e => e.dol && e.dol !== '');
  }, [employees]);

  const filteredExEmployees = exEmployees.filter(emp => 
      emp.name.toLowerCase().includes(rejoinSearchTerm.toLowerCase()) || 
      emp.id.toLowerCase().includes(rejoinSearchTerm.toLowerCase())
  );

  const calculateGrossWage = (data: Partial<Employee> | Employee) => {
    return (Number(data.basicPay) || 0) + (Number(data.da) || 0) + (Number(data.retainingAllowance) || 0) + (Number(data.hra) || 0) + (Number(data.conveyance) || 0) + (Number(data.washing) || 0) + (Number(data.attire) || 0) + (Number(data.specialAllowance1) || 0) + (Number(data.specialAllowance2) || 0) + (Number(data.specialAllowance3) || 0);
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

  const initiateRejoin = (emp: Employee) => {
      setAuthModal({ isOpen: true, password: '', error: '', targetEmp: emp });
  };

  const initiateDelete = (emp: Employee, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteModal({ isOpen: true, targetEmp: emp, password: '', error: '' });
  };

  const handleDeleteSubmit = () => {
      if (!deleteModal.targetEmp) return;
      
      if (deleteModal.password === currentUser?.password && (currentUser?.role === 'Developer' || currentUser?.role === 'Administrator')) {
          const updatedList = employees.filter(e => e.id !== deleteModal.targetEmp!.id);
          setEmployees(updatedList);
          
          if (selectedEmp?.id === deleteModal.targetEmp.id) {
              setSelectedEmp(null);
          }
          
          setDeleteModal({ isOpen: false, targetEmp: null, password: '', error: '' });
      } else {
          setDeleteModal({ ...deleteModal, error: 'Access Denied: Invalid credentials or insufficient privileges.' });
      }
  };

  const confirmRejoinAuth = () => {
      if (authModal.password === currentUser?.password && (currentUser?.role === 'Developer' || currentUser?.role === 'Administrator')) {
          const target = authModal.targetEmp;
          if (target) {
              setAuthModal({ ...authModal, isOpen: false });
              setShowRejoinPanel(false);
              proceedToEdit(target);
          }
      } else {
          setAuthModal({ ...authModal, error: 'Access Denied: Invalid credentials or insufficient privileges.' });
      }
  };

  const openExportModal = () => {
      const defaultCols = AVAILABLE_COLUMNS.filter(c => !['dol', 'leavingReason'].includes(c.key)).map(c => c.key);
      setExportModal({
          isOpen: true,
          format: 'Excel',
          targetGroup: 'Active',
          selectedColumns: defaultCols,
          password: '',
          error: ''
      });
  };

  const toggleColumn = (key: string) => {
      setExportModal(prev => {
          const exists = prev.selectedColumns.includes(key);
          return {
              ...prev,
              selectedColumns: exists 
                  ? prev.selectedColumns.filter(c => c !== key)
                  : [...prev.selectedColumns, key]
          };
      });
  };

  const toggleAllColumns = () => {
      setExportModal(prev => {
          const allRelevant = AVAILABLE_COLUMNS.map(c => c.key);
          const isAllSelected = prev.selectedColumns.length === allRelevant.length;
          return {
              ...prev,
              selectedColumns: isAllSelected ? [] : allRelevant
          };
      });
  };

  const handleExportSubmit = () => {
      if (exportModal.password === currentUser?.password && (currentUser?.role === 'Developer' || currentUser?.role === 'Administrator')) {
          const targetEmps = exportModal.targetGroup === 'Active' 
              ? employees.filter(e => !e.dol)
              : employees.filter(e => e.dol);
          
          const dateStr = formatDateInd(new Date().toISOString());
          const fileName = `${exportModal.targetGroup}_Employees_${dateStr}`;
          const columnsToExport = AVAILABLE_COLUMNS.filter(c => exportModal.selectedColumns.includes(c.key));

          if (exportModal.format === 'Excel') {
              const data = targetEmps.map(e => {
                  const row: any = {};
                  columnsToExport.forEach(col => {
                      if (col.key === 'grossPay') {
                          row[col.label] = calculateGrossWage(e);
                      } else if (['doj', 'dob', 'dol'].includes(col.key)) {
                          row[col.label] = formatDateInd((e as any)[col.key]);
                      } else {
                          row[col.label] = (e as any)[col.key];
                      }
                  });
                  return row;
              });
              generateExcelReport(data, `${exportModal.targetGroup} List`, fileName);
          } else {
              const headers = columnsToExport.map(c => c.label);
              const data = targetEmps.map(e => columnsToExport.map(col => {
                  if (col.key === 'grossPay') return calculateGrossWage(e).toLocaleString();
                  if (['doj', 'dob', 'dol'].includes(col.key)) return formatDateInd((e as any)[col.key]);
                  return (e as any)[col.key] || '-';
              }));
              
              generatePDFTableReport(
                  `${exportModal.targetGroup} Employee Master List`, 
                  headers, 
                  data, 
                  fileName, 
                  'l', 
                  `Total Records: ${targetEmps.length} | Export Date: ${dateStr}`, 
                  companyProfile
              );
          }
          setExportModal({ ...exportModal, isOpen: false, password: '' });
      } else {
          setExportModal({ ...exportModal, error: 'Authentication Failed: Invalid password or insufficient privileges.' });
      }
  };

  const handleDownloadImportReport = (format: 'PDF' | 'Excel') => {
    if (!importSummary) return;

    const data = importSummary.errors.map(err => ({
        'Row No': err.row,
        'Employee Name': err.name,
        'Employee ID': err.id,
        'Reason for Rejection': err.reason
    }));

    const fileName = `Import_Rejection_Report_${formatDateInd(new Date().toISOString())}`;

    if (format === 'Excel') {
        generateExcelReport(data, 'Import Errors', fileName);
    } else {
        const headers = ['Row', 'Employee Name', 'ID', 'Reason for Rejection'];
        const rows = data.map(d => [d['Row No'], d['Employee Name'], d['Employee ID'], d['Reason for Rejection']]);
        const summaryText = `Total Processed: ${importSummary.total} | Successful: ${importSummary.success} | Failed: ${importSummary.failed}`;
        
        generatePDFTableReport(
            'Import Exception Report',
            headers,
            rows,
            fileName,
            'p', 
            summaryText,
            companyProfile
        );
    }
  };

  const handleDownloadTemplate = () => {
    const templateHeaders = [
        "Employee ID", "Full Name", "Gender", "Date of Birth (DD-MM-YYYY)", "Designation", 
        "Department/Division", "Branch", "Site", "Date of Joining (DD-MM-YYYY)", 
        "Mobile Number", "Father or Spouse Name", "Relationship",
        "Door No", "Building Name", "Street", "Area", "City", "State", "Pincode",
        "PAN Number", "Aadhaar Number", "UAN Number", "PF Member ID", "ESI Number",
        "Bank Account Number", "IFSC Code",
        "Basic Pay", "DA", "Retaining Allowance", "HRA", "Conveyance", 
        "Washing Allowance", "Attire Allowance", "Special Allowance 1", 
        "Special Allowance 2", "Special Allowance 3",
        "PF Exempt (TRUE/FALSE)", "ESI Exempt (TRUE/FALSE)",
        "Date of Leaving (DD-MM-YYYY)", "Reason for Leaving"
    ];

    const sampleRow = [
        "EMP101", "John Doe", "Male", "15-05-1990", "Software Engineer", 
        "Engineering", "Chennai", "Main Plant", "01-01-2024", 
        "9876543210", "Jane Doe", "Spouse",
        "12A", "Sun Villa", "Main Road", "Guindy", "Chennai", "Tamil Nadu", "600032",
        "ABCDE1234F", "123456789012", "100234567890", "TN/MAS/0012345/000/0000101", "3112345678",
        "50100012345678", "HDFC0000123",
        "15000", "5000", "0", "8000", "1600",
        "0", "0", "0", "0", "0",
        "FALSE", "FALSE", "", ""
    ];

    const ws = XLSX.utils.aoa_to_sheet([templateHeaders, sampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "EmployeeMasterTemplate");
    XLSX.writeFile(wb, "BharatPay_Employee_Master_Template.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const bstr = evt.target?.result;
            // Use cellDates: true to let XLSX parse Excel dates into JS Date objects
            const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            if (data.length === 0) {
                alert("No data found in the Excel sheet.");
                setIsImporting(false);
                return;
            }

            // --- SORT LOGIC START ---
            // Sort data by Date of Joining to ensure Employee IDs are assigned chronologically
            data.sort((a: any, b: any) => {
                const getRowDoj = (r: any) => {
                    const keys = ['Date of Joining (DD-MM-YYYY)', 'Date of Joining', 'DOJ', 'Joining Date'];
                    for (const k of keys) {
                        const foundKey = Object.keys(r).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
                        if (foundKey && r[foundKey] !== undefined && r[foundKey] !== null) return r[foundKey];
                    }
                    return null;
                };
                
                const parseSortDate = (val: any) => {
                    if (!val) return 9999999999999; // Push empty dates to end
                    if (val instanceof Date) return val.getTime();
                    const str = String(val).trim();
                    // DD-MM-YYYY
                    if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
                        const [d, m, y] = str.split('-').map(Number);
                        return new Date(y, m - 1, d).getTime();
                    }
                    // Excel Serial
                    if (/^\d+$/.test(str) && Number(str) > 20000) {
                        return (Number(str) - 25569) * 86400 * 1000;
                    }
                    // ISO or other
                    const t = Date.parse(str);
                    return isNaN(t) ? 9999999999999 : t;
                };

                return parseSortDate(getRowDoj(a)) - parseSortDate(getRowDoj(b));
            });
            // --- SORT LOGIC END ---

            const validNewEmployees: Employee[] = [];
            const rejectedRecords: { row: number; name: string; id: string; reason: string }[] = [];
            
            // Build Quick Lookup Sets for Existing Data to detect duplicates
            const existingUAN = new Set(employees.filter(e => e.uanc).map(e => String(e.uanc).trim()));
            const existingAadhaar = new Set(employees.filter(e => e.aadhaarNumber).map(e => String(e.aadhaarNumber).trim()));
            const existingPAN = new Set(employees.filter(e => e.pan).map(e => String(e.pan).trim().toLowerCase()));
            const existingESI = new Set(employees.filter(e => e.esiNumber).map(e => String(e.esiNumber).trim()));
            const existingPF = new Set(employees.filter(e => e.pfNumber).map(e => String(e.pfNumber).trim()));
            const existingID = new Set(employees.map(e => e.id.toLowerCase()));

            // Sets for current batch to avoid self-duplication within the file
            const batchUAN = new Set();
            const batchAadhaar = new Set();
            const batchPAN = new Set();
            const batchESI = new Set();
            const batchPF = new Set();
            const batchID = new Set();

            // Calculate current max ID to auto-generate IDs for missing ones
            let currentMaxId = 0;
            employees.forEach(e => {
                const match = e.id.match(/^EMP(\d+)$/);
                if (match) {
                    const num = parseInt(match[1]);
                    if (!isNaN(num) && num > currentMaxId) currentMaxId = num;
                }
            });

            data.forEach((row: any, rowIndex: number) => {
                const rowNum = rowIndex + 2; // Assuming header is row 1
                
                const getVal = (keys: string[]) => {
                    for (const k of keys) {
                        const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
                        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) return row[foundKey];
                    }
                    return null;
                };

                // ID LOGIC: Check provided ID
                let id = String(getVal(['Employee ID', 'ID', 'Emp ID', 'EmpID']) || '').trim();
                
                // NAME LOGIC: Mandatory
                const name = String(getVal(['Full Name', 'Name', 'Employee Name']) || '').trim();
                if (!name || name === 'Unknown') {
                    rejectedRecords.push({ row: rowNum, name: 'Unknown', id: '', reason: "Missing 'Full Name'. Skipped." });
                    return; 
                }

                // IDENTIFIERS Extraction
                const uan = String(getVal(['UAN Number', 'UAN', 'UAN No']) || '').trim();
                const aadhaar = String(getVal(['Aadhaar Number', 'Aadhaar', 'Aadhaar No']) || '').trim();
                const pan = String(getVal(['PAN Number', 'PAN', 'PAN No']) || '').trim().toLowerCase();
                const esi = String(getVal(['ESI Number', 'ESI IP Number', 'ESI No']) || '').trim();
                const pf = String(getVal(['PF Member ID', 'PF ID', 'PF Number']) || '').trim();

                // DUPLICATE CHECKS
                const duplicateReasons: string[] = [];
                if (uan) {
                    if (existingUAN.has(uan) || batchUAN.has(uan)) duplicateReasons.push(`Duplicate UAN (${uan})`);
                }
                if (aadhaar) {
                    if (existingAadhaar.has(aadhaar) || batchAadhaar.has(aadhaar)) duplicateReasons.push(`Duplicate Aadhaar (${aadhaar})`);
                }
                if (pan) {
                    if (existingPAN.has(pan) || batchPAN.has(pan)) duplicateReasons.push(`Duplicate PAN (${pan.toUpperCase()})`);
                }
                if (esi) {
                    if (existingESI.has(esi) || batchESI.has(esi)) duplicateReasons.push(`Duplicate ESI (${esi})`);
                }
                if (pf) {
                    if (existingPF.has(pf) || batchPF.has(pf)) duplicateReasons.push(`Duplicate PF (${pf})`);
                }
                if (id) {
                    if (existingID.has(id.toLowerCase()) || batchID.has(id.toLowerCase())) duplicateReasons.push(`Duplicate ID (${id})`);
                }

                if (duplicateReasons.length > 0) {
                    rejectedRecords.push({ row: rowNum, name, id, reason: duplicateReasons.join(', ') });
                    return;
                }

                // If valid, reserve identifiers in batch sets
                if (uan) batchUAN.add(uan);
                if (aadhaar) batchAadhaar.add(aadhaar);
                if (pan) batchPAN.add(pan);
                if (esi) batchESI.add(esi);
                if (pf) batchPF.add(pf);

                // Auto-generate ID if missing
                if (!id) {
                    currentMaxId++;
                    id = `EMP${String(currentMaxId).padStart(3, '0')}`;
                }
                batchID.add(id.toLowerCase());

                const parseIndDate = (val: any) => {
                    if (!val) return '';
                    if (val instanceof Date) {
                        const offset = val.getTimezoneOffset() * 60000;
                        const localDate = new Date(val.getTime() - offset);
                        return localDate.toISOString().split('T')[0];
                    }
                    const str = String(val).trim();
                    if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
                        const [d, m, y] = str.split('-');
                        return `${y}-${m}-${d}`;
                    }
                    if (/^\d+$/.test(str) && Number(str) > 20000) {
                        const excelDate = new Date((Number(str) - 25569) * 86400 * 1000);
                        return excelDate.toISOString().split('T')[0];
                    }
                    return str;
                };

                const importedEmp: Employee = {
                    ...getEmptyForm() as Employee,
                    id,
                    name,
                    gender: (getVal(['Gender']) as any) || 'Male',
                    dob: parseIndDate(getVal(['Date of Birth (DD-MM-YYYY)', 'Date of Birth', 'DOB'])),
                    designation: String(getVal(['Designation']) || designations[0]),
                    division: String(getVal(['Department/Division', 'Department', 'Division']) || divisions[0]),
                    department: String(getVal(['Department/Division', 'Department', 'Division']) || divisions[0]),
                    branch: String(getVal(['Branch']) || branches[0]),
                    site: String(getVal(['Site']) || sites[0]),
                    doj: parseIndDate(getVal(['Date of Joining (DD-MM-YYYY)', 'Date of Joining', 'DOJ', 'Joining Date'])) || new Date().toISOString().split('T')[0],
                    mobile: String(getVal(['Mobile Number', 'Mobile', 'Mobile No']) || ''),
                    fatherSpouseName: String(getVal(['Father or Spouse Name', 'Father Name', 'Spouse Name']) || ''),
                    relationship: String(getVal(['Relationship']) || 'Father'),
                    doorNo: String(getVal(['Door No', 'House No', 'Flat No']) || ''),
                    buildingName: String(getVal(['Building Name', 'Apartment']) || ''),
                    street: String(getVal(['Street']) || ''),
                    area: String(getVal(['Area', 'Locality']) || ''),
                    city: String(getVal(['City', 'Town']) || ''),
                    state: String(getVal(['State']) || 'Tamil Nadu'),
                    pincode: String(getVal(['Pincode', 'Zip']) || ''),
                    pan: pan.toUpperCase(),
                    aadhaarNumber: aadhaar,
                    uanc: uan,
                    pfNumber: pf,
                    esiNumber: esi,
                    bankAccount: String(getVal(['Bank Account Number', 'Account No', 'Bank A/c']) || ''),
                    ifsc: String(getVal(['IFSC Code', 'IFSC']) || ''),
                    basicPay: Number(getVal(['Basic Pay', 'Basic']) || 0),
                    da: Number(getVal(['DA', 'Dearness Allowance']) || 0),
                    retainingAllowance: Number(getVal(['Retaining Allowance', 'RA']) || 0),
                    hra: Number(getVal(['HRA', 'House Rent Allowance']) || 0),
                    conveyance: Number(getVal(['Conveyance']) || 0),
                    washing: Number(getVal(['Washing Allowance', 'Washing']) || 0),
                    attire: Number(getVal(['Attire Allowance', 'Attire']) || 0),
                    specialAllowance1: Number(getVal(['Special Allowance 1', 'Special 1']) || 0),
                    specialAllowance2: Number(getVal(['Special Allowance 2', 'Special 2']) || 0),
                    specialAllowance3: Number(getVal(['Special Allowance 3', 'Special 3']) || 0),
                    isPFExempt: String(getVal(['PF Exempt', 'PF Exempted'])).toUpperCase() === 'TRUE',
                    isESIExempt: String(getVal(['ESI Exempt', 'ESI Exempted'])).toUpperCase() === 'TRUE',
                    dol: parseIndDate(getVal(['Date of Leaving', 'Date of Leaving (DD-MM-YYYY)', 'DOL'])),
                    leavingReason: String(getVal(['Reason for Leaving', 'Reason']) || ''),
                    serviceRecords: [{ date: parseIndDate(getVal(['Date of Joining', 'DOJ'])) || new Date().toISOString().split('T')[0], type: 'Appointment', description: 'Imported from Excel' }]
                };

                validNewEmployees.push(importedEmp);
            });

            // Process Results
            if (validNewEmployees.length > 0) {
                if (onBulkAddEmployees) {
                    onBulkAddEmployees(validNewEmployees);
                } else {
                    const existingMap = new Map(employees.map(e => [e.id, e]));
                    validNewEmployees.forEach(ne => existingMap.set(ne.id, ne));
                    setEmployees(Array.from(existingMap.values()));
                }
            }

            // Set Import Summary to trigger Report Modal
            setImportSummary({
                total: data.length,
                success: validNewEmployees.length,
                failed: rejectedRecords.length,
                errors: rejectedRecords
            });

        } catch (err: any) {
            console.error("Excel Import Error:", err);
            alert(`Error parsing file: ${err.message || 'Unknown error'}. Please ensure you are using the correct template.`);
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    
    reader.onerror = (err) => {
        console.error("FileReader Error:", err);
        alert("Failed to read file.");
        setIsImporting(false);
    };

    reader.readAsBinaryString(file);
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
        <div className="flex items-center flex-wrap gap-2">
            <button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 rounded-lg transition-all font-bold text-xs" title="Download Excel Template">
                <FileSpreadsheet size={16} /> Template
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="flex items-center gap-2 px-3 py-2 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 border border-emerald-600/30 rounded-lg transition-all font-bold text-xs" title="Bulk Import via Excel">
                {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Import
            </button>
            <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
            
            <div className="w-[1px] h-6 bg-slate-700 mx-1 hidden md:block"></div>

            <button onClick={openExportModal} className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 rounded-lg transition-all font-bold text-xs">
                <Download size={16} /> Export
            </button>
            <button onClick={() => setShowRejoinPanel(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 rounded-lg transition-all font-bold text-xs">
                <RotateCcw size={16} /> Rejoin
            </button>
            <button onClick={() => { setEditingId(null); setNewEmpForm(getEmptyForm()); setIsAdding(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-shadow shadow-lg font-bold">
                <Plus size={18} /> Add New
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#1e293b] rounded-xl border border-slate-800 shadow-2xl overflow-hidden h-fit max-h-[800px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left table-fixed">
                <thead className="bg-[#0f172a] text-sky-400 text-[10px] uppercase tracking-widest font-bold sticky top-0 z-10">
                <tr>
                    <th className="px-3 py-4 bg-[#0f172a] w-2/6">Identity</th>
                    <th className="px-2 py-4 bg-[#0f172a] w-1.5/6">Organization</th>
                    <th className="px-2 py-4 bg-[#0f172a] w-[90px] text-center">Join Date</th>
                    <th className="px-2 py-4 bg-[#0f172a] w-[100px] text-center">Wages</th>
                    <th className="px-3 py-4 text-right bg-[#0f172a] w-[80px]">Actions</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                {filteredEmployees.map((emp) => (
                    <tr key={emp.id} onClick={() => setSelectedEmp(emp)} className={`cursor-pointer hover:bg-slate-800/50 ${selectedEmp?.id === emp.id ? 'bg-blue-900/40 border-l-4 border-blue-500' : 'border-l-4 border-transparent'} ${emp.dol ? 'opacity-60 grayscale' : ''}`}>
                    <td className="px-3 py-3 overflow-hidden">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600 overflow-hidden shrink-0 relative">
                                {emp.photoUrl ? <img src={emp.photoUrl} className="w-full h-full object-cover" alt={emp.name} /> : <User2 size={16} className="text-slate-400" />}
                                {emp.dol && <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center font-black text-[7px] text-white">LEFT</div>}
                            </div>
                            <div className="min-w-0">
                                <div className="font-bold text-white text-xs truncate uppercase leading-tight">{emp.name}</div>
                                <div className="text-[9px] text-slate-500 font-mono truncate">{emp.id}</div>
                            </div>
                        </div>
                    </td>
                    <td className="px-2 py-3 overflow-hidden">
                        <div className="text-[9px] text-sky-400 font-bold uppercase truncate">{emp.designation}</div>
                        <div className="text-[8px] text-slate-500 uppercase truncate">{emp.branch}</div>
                    </td>
                    <td className="px-2 py-3 text-center">
                        <div className="text-[10px] font-mono text-slate-300 whitespace-nowrap">{formatDateInd(emp.doj)}</div>
                    </td>
                    <td className="px-2 py-3 text-center">
                        <div className="font-mono text-emerald-400 font-bold text-xs">₹{calculateGrossWage(emp).toLocaleString()}</div>
                    </td>
                    <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-1">
                            <button 
                                onClick={(e) => { e.stopPropagation(); proceedToEdit(emp); }} 
                                className="text-slate-400 hover:text-blue-400 p-1.5 hover:bg-blue-900/30 rounded-lg transition-all"
                                title="Edit Profile"
                            >
                                <Edit2 size={14} />
                            </button>
                            {(currentUser?.role === 'Developer' || currentUser?.role === 'Administrator') && (
                                <button 
                                    onClick={(e) => initiateDelete(emp, e)} 
                                    className="text-slate-400 hover:text-red-400 p-1.5 hover:bg-red-900/20 rounded-lg transition-all" 
                                    title="Delete Record"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>

        <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-6 shadow-xl h-fit sticky top-24">
          {selectedEmp ? (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col items-center text-center relative">
                    {selectedEmp.dol && (
                        <div className="absolute top-0 right-0 bg-red-900 text-red-100 text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest border border-red-500/50">Ex-Employee</div>
                    )}
                    <div className="w-24 h-24 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 border-2 border-slate-700 shadow-xl overflow-hidden">
                        {selectedEmp.photoUrl ? <img src={selectedEmp.photoUrl} className="w-full h-full object-cover" alt={selectedEmp.name} /> : <User2 size={48} className="text-slate-500" />}
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
                        <p className="text-white font-bold">{formatDateInd(selectedEmp.doj)}</p>
                    </div>
                </div>
                {selectedEmp.dol && (
                    <div className="bg-red-900/10 border border-red-900/30 p-4 rounded-xl text-xs space-y-2">
                        <div className="flex justify-between">
                            <span className="text-red-400 font-bold uppercase">Date of Leaving</span>
                            <span className="text-white font-mono">{formatDateInd(selectedEmp.dol)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-red-400 font-bold uppercase">Reason</span>
                            <span className="text-white text-right">{selectedEmp.leavingReason || 'N/A'}</span>
                        </div>
                    </div>
                )}
                <div className="space-y-4 pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold uppercase text-[9px]">Date of Birth</span>
                        <span className="font-mono font-bold text-slate-300">{formatDateInd(selectedEmp.dob)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold uppercase text-[9px]">UAN No (PF)</span>
                        <span className="font-mono font-bold text-sky-400">{selectedEmp.uanc || 'NOT SET'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-bold uppercase text-[9px]">Contact</span>
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

      {/* REJOIN SLIDE-IN PANEL */}
      <div className={`fixed inset-y-0 right-0 w-96 bg-[#1e293b] border-l border-slate-700 shadow-2xl transform transition-transform duration-300 z-40 flex flex-col ${showRejoinPanel ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-[#0f172a]">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-900/30 rounded text-amber-400"><RotateCcw size={20} /></div>
                  <h3 className="font-bold text-white text-sm">Rejoin Ex-Employee</h3>
              </div>
              <button onClick={() => setShowRejoinPanel(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
          </div>
          <div className="p-4 bg-[#0f172a] border-b border-slate-800">
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input type="text" placeholder="Search Ex-Employees..." className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white outline-none focus:ring-1 focus:ring-amber-500" value={rejoinSearchTerm} onChange={(e) => setRejoinSearchTerm(e.target.value)} />
              </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredExEmployees.length === 0 ? (
                  <div className="text-center text-slate-500 text-xs py-10">No ex-employees found matching criteria.</div>
              ) : (
                  filteredExEmployees.map(emp => (
                      <div key={emp.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 hover:border-amber-500/50 transition-all group">
                          <div className="flex justify-between items-start mb-2">
                              <div>
                                  <h4 className="font-bold text-white text-sm">{emp.name}</h4>
                                  <p className="text-[10px] text-slate-400 font-mono">{emp.id}</p>
                              </div>
                              <span className="text-[9px] font-black text-red-400 bg-red-900/20 px-2 py-1 rounded border border-red-900/30">LEFT: {formatDateInd(emp.dol)}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 line-clamp-1 mb-3">{emp.leavingReason || 'No reason specified'}</p>
                          <button onClick={() => initiateRejoin(emp)} className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2">
                              <Edit2 size={12} /> Rejoin / Edit Profile
                          </button>
                      </div>
                  ))
              )}
          </div>
      </div>

      {/* IMPORT SUMMARY MODAL */}
      {importSummary && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl border border-slate-700 shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-[#0f172a] rounded-t-2xl">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Upload size={20} className="text-blue-400" /> Import Result
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                            Processed {importSummary.total} rows from Excel file.
                        </p>
                    </div>
                    <button onClick={() => setImportSummary(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                </div>
                
                {/* Body */}
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-emerald-900/20 border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Successful</p>
                                <h4 className="text-2xl font-black text-emerald-300">{importSummary.success}</h4>
                            </div>
                            <CheckCircle className="text-emerald-500 opacity-50" size={32} />
                        </div>
                        <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-red-400 uppercase font-bold tracking-wider">Failed / Duplicate</p>
                                <h4 className="text-2xl font-black text-red-300">{importSummary.failed}</h4>
                            </div>
                            <FileX className="text-red-500 opacity-50" size={32} />
                        </div>
                    </div>

                    {importSummary.failed > 0 && (
                        <div className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden">
                            <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 text-xs font-bold text-slate-300 uppercase">
                                Error Details ({importSummary.failed})
                            </div>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-800 text-slate-400 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 w-16">Row</th>
                                            <th className="px-4 py-2">Employee</th>
                                            <th className="px-4 py-2 text-red-300">Reason for Failure</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700 text-slate-300">
                                        {importSummary.errors.map((err, i) => (
                                            <tr key={i} className="hover:bg-slate-800/50">
                                                <td className="px-4 py-2 font-mono text-slate-500">{err.row}</td>
                                                <td className="px-4 py-2">
                                                    <div className="font-bold text-white">{err.name}</div>
                                                    <div className="text-[10px] text-slate-500">{err.id}</div>
                                                </td>
                                                <td className="px-4 py-2 text-red-400">{err.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {importSummary.failed === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-emerald-400">
                            <CheckCircle size={48} className="mb-2" />
                            <p className="font-bold">All records imported successfully!</p>
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-4 border-t border-slate-700 bg-[#1e293b] flex justify-end gap-3 rounded-b-2xl">
                    {importSummary.failed > 0 && (
                        <>
                            <button onClick={() => handleDownloadImportReport('PDF')} className="px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-lg font-bold text-xs transition-colors flex items-center gap-2">
                                <FileText size={16} /> PDF Report
                            </button>
                            <button onClick={() => handleDownloadImportReport('Excel')} className="px-4 py-2 bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/50 rounded-lg font-bold text-xs transition-colors flex items-center gap-2">
                                <FileSpreadsheet size={16} /> Excel Report
                            </button>
                        </>
                    )}
                    <button onClick={() => setImportSummary(null)} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm transition-colors">Close</button>
                </div>
            </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModal.isOpen && deleteModal.targetEmp && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-red-900/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setDeleteModal({ isOpen: false, targetEmp: null, password: '', error: '' })} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                
                <div className="flex flex-col items-center gap-2 mb-2">
                    <div className="p-3 bg-red-900/20 text-red-500 rounded-full border border-red-900/50 mb-2"><Trash2 size={24} /></div>
                    <h3 className="text-lg font-bold text-white text-center">Delete Employee?</h3>
                    <p className="text-xs text-slate-400 text-center">
                        Confirm deletion of <b>{deleteModal.targetEmp.name}</b> ({deleteModal.targetEmp.id}).<br/>
                        <span className="text-red-400 font-bold">This action cannot be undone.</span>
                    </p>
                </div>

                <div className="space-y-3 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-1"><KeyRound size={14} /> Admin Verification</div>
                    <input type="password" placeholder="Enter Password" autoFocus className={`w-full bg-[#0f172a] border ${deleteModal.error ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm`} value={deleteModal.password} onChange={(e) => setDeleteModal({...deleteModal, password: e.target.value, error: ''})} onKeyDown={(e) => e.key === 'Enter' && handleDeleteSubmit()} />
                    {deleteModal.error && <p className="text-[10px] text-red-400 font-bold text-center animate-pulse">{deleteModal.error}</p>}
                </div>
                <button onClick={handleDeleteSubmit} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-900/20 transition-all text-sm flex items-center justify-center gap-2">
                    CONFIRM DELETE
                </button>
            </div>
        </div>
      )}

      {/* EXPORT DATA MODAL */}
      {exportModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl flex flex-col relative max-h-[90vh]">
                <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-900/30 rounded-lg text-blue-400"><Download size={20} /></div>
                        <div>
                            <h3 className="text-lg font-black text-white">Export Master Data</h3>
                            <p className="text-xs text-slate-400">Select data filters and columns</p>
                        </div>
                    </div>
                    <button onClick={() => setExportModal({...exportModal, isOpen: false, error: '', password: ''})} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
                </div>
                
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target Group</label>
                            <div className="flex gap-2">
                                <button onClick={() => setExportModal({...exportModal, targetGroup: 'Active'})} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${exportModal.targetGroup === 'Active' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>Active Employees</button>
                                <button onClick={() => setExportModal({...exportModal, targetGroup: 'Left'})} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${exportModal.targetGroup === 'Left' ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>Ex-Employees</button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Format</label>
                            <div className="flex gap-2">
                                <button onClick={() => setExportModal({...exportModal, format: 'Excel'})} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-2 ${exportModal.format === 'Excel' ? 'bg-emerald-900/40 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}><FileSpreadsheet size={14} /> Excel</button>
                                <button onClick={() => setExportModal({...exportModal, format: 'PDF'})} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-2 ${exportModal.format === 'PDF' ? 'bg-blue-900/40 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}><FileText size={14} /> PDF</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Filter size={12} /> Select Columns</label>
                            <button onClick={toggleAllColumns} className="text-[10px] font-bold text-blue-400 hover:text-blue-300">
                                {exportModal.selectedColumns.length === AVAILABLE_COLUMNS.length ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {AVAILABLE_COLUMNS.map(col => (
                                <button 
                                    key={col.key} 
                                    onClick={() => toggleColumn(col.key)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left ${exportModal.selectedColumns.includes(col.key) ? 'bg-blue-900/20 border-blue-500/50 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                                >
                                    {exportModal.selectedColumns.includes(col.key) ? <CheckSquare size={14} className="text-blue-400 shrink-0" /> : <Square size={14} className="text-slate-600 shrink-0" />}
                                    <span className="truncate">{col.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-3">
                        <div className="flex items-center gap-2 text-xs text-slate-400"><KeyRound size={14} /> Security Verification</div>
                        <input type="password" placeholder="Enter Admin Password" className={`w-full bg-[#0f172a] border ${exportModal.error ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm`} value={exportModal.password} onChange={(e) => setExportModal({...exportModal, password: e.target.value, error: ''})} onKeyDown={(e) => e.key === 'Enter' && handleExportSubmit()} />
                        {exportModal.error && <p className="text-[10px] text-red-400 font-bold animate-pulse">{exportModal.error}</p>}
                    </div>
                </div>

                <div className="p-6 bg-[#1e293b] border-t border-slate-800">
                    <button onClick={handleExportSubmit} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/20 transition-all text-sm flex items-center justify-center gap-2">
                        SECURE DOWNLOAD ({exportModal.selectedColumns.length} cols)
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* AUTH MODAL FOR REJOIN */}
      {authModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                <button onClick={() => setAuthModal({...authModal, isOpen: false})} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-red-900/20 text-red-500 rounded-full border border-red-900/50 mb-2"><KeyRound size={24} /></div>
                    <h3 className="text-lg font-bold text-white text-center">Admin Access Required</h3>
                    <p className="text-xs text-slate-400 text-center">Enter Developer/Admin password to modify ex-employee records.</p>
                </div>
                <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <input type="password" placeholder="Enter Password" autoFocus className={`w-full bg-[#0f172a] border ${authModal.error ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm`} value={authModal.password} onChange={(e) => setAuthModal({...authModal, password: e.target.value, error: ''})} onKeyDown={(e) => e.key === 'Enter' && confirmRejoinAuth()} />
                    {authModal.error && <p className="text-[10px] text-red-400 font-bold text-center animate-pulse">{authModal.error}</p>}
                </div>
                <button onClick={confirmRejoinAuth} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-900/20 transition-all text-sm">CONFIRM ACCESS</button>
            </div>
        </div>
      )}

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
              <div>
                <FormSectionHeader icon={User2} title="1. Personal & Employment Identity" />
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex flex-col items-center gap-4 shrink-0">
                        <div className="relative group w-32 h-32 bg-slate-900 rounded-2xl border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden transition-all hover:border-blue-500/50">
                            {newEmpForm.photoUrl ? (
                                <img src={newEmpForm.photoUrl} className="w-full h-full object-cover" alt="Profile" />
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
                        
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-sky-400 uppercase tracking-widest ml-1">Mobile No*</label><input required className="w-full bg-slate-900 border border-sky-900/50 rounded-xl p-3 text-sm text-white font-mono focus:ring-2 focus:ring-blue-500 outline-none" value={newEmpForm.mobile} onChange={e => setNewEmpForm({...newEmpForm, mobile: e.target.value})} /></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Gender</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.gender} onChange={e => setNewEmpForm({...newEmpForm, gender: e.target.value as any})}><option>Male</option><option>Female</option><option>Transgender</option><option>Others</option></select></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Date of Birth</label><input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.dob} onChange={e => setNewEmpForm({...newEmpForm, dob: e.target.value})} /></div>
                        
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Date of Joining</label><input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.doj} onChange={e => setNewEmpForm({...newEmpForm, doj: e.target.value})} /></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Designation</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.designation} onChange={e => setNewEmpForm({...newEmpForm, designation: e.target.value})}>{designations.map(d => <option key={d}>{d}</option>)}</select></div>
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Work Branch</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.branch} onChange={e => setNewEmpForm({...newEmpForm, branch: e.target.value})}>{branches.map(b => <option key={b}>{b}</option>)}</select></div>
                    </div>
                </div>
              </div>

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
                        <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">State</label><select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={newEmpForm.state} onChange={e => setNewEmpForm({...newEmpForm, state: e.target.value})}>{INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                        <div className="space-y-1.5 col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pincode</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.pincode} onChange={e => setNewEmpForm({...newEmpForm, pincode: e.target.value})} /></div>
                    </div>
                 </div>
              </div>

              <div>
                <FormSectionHeader icon={Landmark} title="4. Banking & Disbursement" color="text-indigo-400" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-indigo-900/5 p-6 rounded-2xl border border-indigo-900/20">
                    <div className="space-y-1.5 md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Bank Account Number</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.bankAccount} onChange={e => setNewEmpForm({...newEmpForm, bankAccount: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">IFSC Code</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none uppercase" value={newEmpForm.ifsc} onChange={e => setNewEmpForm({...newEmpForm, ifsc: e.target.value})} /></div>
                </div>
              </div>

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

              <div>
                <FormSectionHeader icon={ShieldCheck} title="6. Statutory IDs & Options" color="text-amber-400" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PAN Number</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none uppercase" value={newEmpForm.pan} onChange={e => setNewEmpForm({...newEmpForm, pan: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aadhaar No</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.aadhaarNumber} onChange={e => setNewEmpForm({...newEmpForm, aadhaarNumber: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">UAN Number</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.uanc} onChange={e => setNewEmpForm({...newEmpForm, uanc: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ESI IP Number</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.esiNumber} onChange={e => setNewEmpForm({...newEmpForm, esiNumber: e.target.value})} />
                    </div>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 mt-8 mb-4">
                    <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2">PF COMPLIANCE & HIGHER PENSION</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="space-y-1.5">
                             <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${newEmpForm.isPFExempt ? 'bg-amber-900/20 border-amber-500/50' : 'bg-slate-800 border-slate-700'}`}>
                                <input type="checkbox" className="w-4 h-4" checked={newEmpForm.isPFExempt} onChange={e => setNewEmpForm({...newEmpForm, isPFExempt: e.target.checked})} />
                                <span className={`text-[10px] font-bold uppercase ${newEmpForm.isPFExempt ? 'text-amber-400' : 'text-white'}`}>PF Exempted</span>
                            </label>
                        </div>
                        <div className="space-y-1.5">
                            <label className={`text-[10px] font-bold uppercase tracking-widest ${newEmpForm.isPFExempt ? 'text-slate-600' : 'text-slate-500'}`}>Contributed Pre-2014?</label>
                            <select 
                                disabled={newEmpForm.isPFExempt}
                                className={`w-full bg-slate-900 border rounded-xl p-3 text-sm outline-none transition-colors ${newEmpForm.isPFExempt ? 'border-slate-800 text-slate-600 cursor-not-allowed' : 'border-slate-700 text-white'}`}
                                value={newEmpForm.pfHigherPension?.contributedBefore2014 || 'No'}
                                onChange={e => setNewEmpForm({
                                    ...newEmpForm, 
                                    pfHigherPension: { ...newEmpForm.pfHigherPension!, contributedBefore2014: e.target.value as 'Yes'|'No' }
                                })}
                            >
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className={`text-[10px] font-bold uppercase tracking-widest ${newEmpForm.isPFExempt ? 'text-slate-600' : 'text-slate-500'}`}>DOJ Impact (EPF History)</label>
                            <input 
                                type="date" 
                                disabled={newEmpForm.isPFExempt}
                                className={`w-full bg-slate-900 border rounded-xl p-3 text-sm outline-none transition-colors ${newEmpForm.isPFExempt ? 'border-slate-800 text-slate-600 cursor-not-allowed' : 'border-slate-700 text-white'}`}
                                value={newEmpForm.pfHigherPension?.dojImpact || ''} 
                                onChange={e => setNewEmpForm({
                                    ...newEmpForm, 
                                    pfHigherPension: { ...newEmpForm.pfHigherPension!, dojImpact: e.target.value }
                                })} 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1.5">
                            <label className={`text-[10px] font-bold uppercase tracking-widest ${newEmpForm.isPFExempt ? 'text-slate-600' : 'text-slate-500'}`}>Employee Contribution</label>
                            <select 
                                disabled={newEmpForm.isPFExempt}
                                className={`w-full bg-slate-900 border rounded-xl p-3 text-sm outline-none transition-colors ${newEmpForm.isPFExempt ? 'border-slate-800 text-slate-600 cursor-not-allowed' : 'border-slate-700 text-white'}`}
                                value={newEmpForm.pfHigherPension?.employeeContribution || 'Regular'}
                                onChange={e => setNewEmpForm({
                                    ...newEmpForm, 
                                    pfHigherPension: { ...newEmpForm.pfHigherPension!, employeeContribution: e.target.value as 'Regular'|'Higher' }
                                })}
                            >
                                <option value="Regular">Regular (Capped)</option>
                                <option value="Higher">Higher (Actual)</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className={`text-[10px] font-bold uppercase tracking-widest ${newEmpForm.isPFExempt ? 'text-slate-600' : 'text-slate-500'}`}>Employer Contribution</label>
                            <select 
                                disabled={newEmpForm.isPFExempt}
                                className={`w-full bg-slate-900 border rounded-xl p-3 text-sm outline-none transition-colors ${newEmpForm.isPFExempt ? 'border-slate-800 text-slate-600 cursor-not-allowed' : 'border-slate-700 text-white'}`}
                                value={newEmpForm.pfHigherPension?.employerContribution || 'Regular'}
                                onChange={e => setNewEmpForm({
                                    ...newEmpForm, 
                                    pfHigherPension: { ...newEmpForm.pfHigherPension!, employerContribution: e.target.value as 'Regular'|'Higher' }
                                })}
                            >
                                <option value="Regular">Regular (Capped)</option>
                                <option value="Higher">Higher (Actual)</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className={`text-[10px] font-bold uppercase tracking-widest ${newEmpForm.isPFExempt ? 'text-slate-600' : 'text-slate-500'}`}>Higher Pension Opted?</label>
                            <select 
                                disabled={newEmpForm.isPFExempt}
                                className={`w-full border rounded-xl p-3 text-sm font-bold outline-none transition-colors ${
                                    newEmpForm.isPFExempt 
                                    ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed' 
                                    : newEmpForm.pfHigherPension?.isHigherPensionOpted === 'Yes' 
                                        ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400' 
                                        : 'bg-slate-900 border-slate-700 text-white'
                                }`}
                                value={newEmpForm.pfHigherPension?.isHigherPensionOpted || 'No'}
                                onChange={e => setNewEmpForm({
                                    ...newEmpForm, 
                                    pfHigherPension: { ...newEmpForm.pfHigherPension!, isHigherPensionOpted: e.target.value as 'Yes'|'No' }
                                })}
                            >
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className={`bg-slate-900/50 p-6 rounded-3xl border border-slate-800 mt-4 transition-all ${newEmpForm.isPFExempt ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
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

              <div className="bg-red-900/5 p-6 rounded-2xl border border-red-900/20">
                  <FormSectionHeader icon={LogOut} title="7. Separation Details (If Applicable)" color="text-red-400" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Date of Leaving</label>
                          <input type="date" className="w-full bg-slate-900 border border-red-900/50 rounded-xl p-3 text-sm text-white outline-none focus:ring-1 focus:ring-red-500" value={newEmpForm.dol || ''} onChange={e => setNewEmpForm({...newEmpForm, dol: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Reason for Leaving</label>
                          <input className="w-full bg-slate-900 border border-red-900/50 rounded-xl p-3 text-sm text-white outline-none focus:ring-1 focus:ring-red-500" value={newEmpForm.leavingReason || ''} onChange={e => setNewEmpForm({...newEmpForm, leavingReason: e.target.value})} placeholder="Resignation / Retirement / Termination" />
                      </div>
                  </div>
              </div>

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
