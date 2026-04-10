import React, { useState, useRef, useMemo } from 'react';
import { Users } from 'lucide-react';
import { Employee, User, CompanyProfile } from '../types';

// Global OS Detection for UI refinement
const isWin7 = /Windows NT 6.1/.test(window.navigator.userAgent);
import { generateEmployeeXLSX, parseEmployeeXLSX, generateImportFailureReport } from '../services/excelService';
import { openSavedReport } from '../services/reportService';

// Modular Components
import EmployeeToolbar from './Employee/EmployeeToolbar';
import EmployeeTable from './Employee/EmployeeTable';
import EmployeeDetailSidebar from './Employee/EmployeeDetailSidebar';
import RejoinSidebar from './Employee/RejoinSidebar';
import EmployeeForm from './Employee/EmployeeForm';

// Modals
import AuthModal from './Employee/Modals/AuthModal';
import DeleteModal from './Employee/Modals/DeleteModal';
import ExportModal from './Employee/Modals/ExportModal';
import ImportSummaryModal from './Employee/Modals/ImportSummaryModal';
import DocumentPreviewModal from './Employee/Modals/DocumentPreviewModal';

const AVAILABLE_COLUMNS = [
    { key: 'id', label: 'Employee ID' },
    { key: 'name', label: 'Full Name' },
    { key: 'designation', label: 'Designation' },
    { key: 'division', label: 'Department' },
    { key: 'branch', label: 'Branch' },
    { key: 'site', label: 'Work Site' },
    { key: 'doj', label: 'Date of Join' },
    { key: 'mobile', label: 'Contact No' },
    { key: 'uanc', label: 'UAN (PF)' },
    { key: 'pfNumber', label: 'PF Number' },
    { key: 'esiNumber', label: 'ESI Number' },
    { key: 'pan', label: 'PAN Card' },
    { key: 'aadhaarNumber', label: 'Aadhaar No' },
    { key: 'bankAccount', label: 'Bank A/c' },
    { key: 'ifsc', label: 'IFSC Code' },
    { key: 'basicPay', label: 'Basic' },
    { key: 'da', label: 'DA' },
    { key: 'hra', label: 'HRA' },
    { key: 'gross', label: 'Gross Wage' }
];

interface EmployeeListProps {
    employees: Employee[];
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
    onAddEmployee: (newEmp: Employee) => void;
    onBulkAddEmployees: (newEmps: Employee[]) => void;
    designations: string[];
    divisions: string[];
    branches: string[];
    sites: string[];
    currentUser?: User;
    companyProfile: CompanyProfile;
    dataSizeLimit: number;
    showAlert: (
        type: 'info' | 'success' | 'warning' | 'danger' | 'confirm',
        title: string,
        message: string | React.ReactNode,
        onConfirm?: () => void,
        onSecondaryConfirm?: () => void,
        confirmLabel?: string,
        secondaryConfirmLabel?: string,
        cancelLabel?: string,
        autoCloseSecs?: number
    ) => void;
    globalMonth: string;
    globalYear: number;
}

const EmployeeList: React.FC<EmployeeListProps> = ({
    employees, setEmployees, onAddEmployee, onBulkAddEmployees,
    designations, divisions, branches, sites, currentUser, companyProfile, dataSizeLimit, showAlert,
    globalMonth, globalYear
}) => {
    // --- State Management ---
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importSummary, setImportSummary] = useState<any>(null);
    const [previewDoc, setPreviewDoc] = useState<{ url: string, name: string } | null>(null);
    const [isSeparationUnlocked, setIsSeparationUnlocked] = useState(false);
    const [showRejoinPanel, setShowRejoinPanel] = useState(false);
    const [rejoinSearch, setRejoinSearch] = useState('');

    // --- Modal States ---
    const [authModal, setAuthModal] = useState({ isOpen: false, password: '', error: '', targetEmp: null as Employee | null, mode: 'DELETE' as 'DELETE' | 'EXPORT' | 'REJOIN' | 'UNLOCK_SEPARATION' });
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, employee: null as Employee | null });
    const [exportModal, setExportModal] = useState({ isOpen: false, format: 'Excel' as 'Excel' | 'PDF', selectedColumns: AVAILABLE_COLUMNS.map(c => c.key), password: '', error: '' });

    // --- Refs ---
    const photoInputRef = useRef<HTMLInputElement>(null);
    const resumeInputRef = useRef<HTMLInputElement>(null);
    const esiForm1InputRef = useRef<HTMLInputElement>(null);
    const pfForm2InputRef = useRef<HTMLInputElement>(null);
    const pfForm11InputRef = useRef<HTMLInputElement>(null);

    const INITIAL_FORM_STATE: Partial<Employee> = {
        id: '', name: '', designation: 'Security Guard', division: 'Security', branch: '', site: '',
        dob: '', doj: '', mobile: '', gender: 'Male', fatherSpouseName: '', relationship: 'Father',
        doorNo: '', buildingName: '', street: '', area: '', city: '', state: 'Tamil Nadu', pincode: '',
        bankAccount: '', ifsc: '', bankName: '', bankBranch: '',
        basicPay: 0, da: 0, hra: 0, conveyance: 0, washing: 0, attire: 0,
        specialAllowance1: 0, specialAllowance2: 0, specialAllowance3: 0,
        pfHigherPension: { enabled: false, isHigherPensionOpted: 'No', contributedBefore2014: 'No', employeeContribution: 'Regular', employerContribution: 'Regular', dojImpact: '' },
        employeeDocuments: {}
    };

    // --- Form State ---
    const [newEmpForm, setNewEmpForm] = useState<Partial<Employee>>(INITIAL_FORM_STATE);

    // --- Derived Data ---
    const activeEmployees = useMemo(() => employees.filter(e => !e.dol), [employees]);
    const exEmployees = useMemo(() => employees.filter(e => e.dol), [employees]);

    const filteredEmployees = useMemo(() =>
        activeEmployees.filter(emp =>
            emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (emp.uanc && emp.uanc.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (emp.esiNumber && emp.esiNumber.toLowerCase().includes(searchTerm.toLowerCase()))
        ), [activeEmployees, searchTerm]
    );

    const filteredExEmployees = useMemo(() =>
        exEmployees.filter(emp =>
            emp.name.toLowerCase().includes(rejoinSearch.toLowerCase()) ||
            emp.id.toLowerCase().includes(rejoinSearch.toLowerCase()) ||
            (emp.uanc && emp.uanc.toLowerCase().includes(rejoinSearch.toLowerCase())) ||
            (emp.esiNumber && emp.esiNumber.toLowerCase().includes(rejoinSearch.toLowerCase()))
        ), [exEmployees, rejoinSearch]
    );

    // --- Helper Functions ---
    const calculateGrossWage = (emp: Partial<Employee> | Employee) => {
        const total = (emp.basicPay || 0) + (emp.da || 0) + (emp.retainingAllowance || 0) + (emp.hra || 0) + (emp.conveyance || 0) + (emp.washing || 0) + (emp.attire || 0) + (emp.specialAllowance1 || 0) + (emp.specialAllowance2 || 0) + (emp.specialAllowance3 || 0);
        return Math.round(total);
    };

    // --- Action Handlers ---
    const handleAddNew = () => {
        const nextId = employees.length > 0 ? `EMP${(Math.max(...employees.map(e => parseInt(e.id.replace('EMP', '')))) + 1).toString().padStart(4, '0')}` : 'EMP0001';
        setNewEmpForm({ 
            ...INITIAL_FORM_STATE, 
            id: nextId, 
            doj: new Date().toISOString().split('T')[0] 
        });
        setEditingId(null);
        setIsAdding(true);
        setIsSeparationUnlocked(false);
    };

    const handleEdit = (emp: Employee) => {
        setNewEmpForm(emp);
        setEditingId(emp.id);
        setIsAdding(true);
        setIsSeparationUnlocked(false);
    };

    const handleDeleteClick = (emp: Employee, e: React.MouseEvent) => {
        e.stopPropagation();
        setAuthModal({ isOpen: true, password: '', error: '', targetEmp: emp, mode: 'DELETE' });
    };

    const handleAuthSubmit = () => {
        if (authModal.password === 'admin123') { // Simple check for now
            if (authModal.mode === 'DELETE' && authModal.targetEmp) {
                setDeleteModal({ isOpen: true, employee: authModal.targetEmp });
            } else if (authModal.mode === 'UNLOCK_SEPARATION') {
                setIsSeparationUnlocked(true);
            }
            setAuthModal({ ...authModal, isOpen: false, password: '', error: '' });
        } else {
            setAuthModal({ ...authModal, error: 'Authorization Denied: Invalid Access Key' });
        }
    };

    const confirmDelete = async () => {
        if (deleteModal.employee) {
            setEmployees(prev => prev.filter(e => e.id !== deleteModal.employee!.id));
            setDeleteModal({ isOpen: false, employee: null });
            if (selectedEmp?.id === deleteModal.employee.id) setSelectedEmp(null);
        }
    };

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const data = newEmpForm as Employee;
        if (editingId) {
            setEmployees(prev => prev.map(emp => emp.id === editingId ? data : emp));
        } else {
            onAddEmployee(data);
        }
        setIsAdding(false);
        showAlert('success', 'Employee Saved', `${data.id} ${data.name} Saved Successfully`, undefined, undefined, 'OK', undefined, undefined, 0.7);
    };

    const handleImport = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;
            setIsImporting(true);
            try {
                const results = await parseEmployeeXLSX(file, employees, designations, divisions, branches, sites);
                if (results.success > 0 && results.successfulEmployees) {
                    onBulkAddEmployees(results.successfulEmployees);
                }
                setImportSummary(results);
            } finally {
                setIsImporting(false);
            }
        };
        input.click();
    };

    const handleExportSubmit = async () => {
        try {
            const usersStr = localStorage.getItem('app_users');
            const users = usersStr ? JSON.parse(usersStr) : [];
            const isValid = users.some((u: User) =>
                (u.role === 'Administrator' || u.role === 'Developer') &&
                u.password === exportModal.password
            );

            if (isValid) {
                const dataToExport = filteredEmployees.map(emp => {
                    const row: any = {};
                    exportModal.selectedColumns.forEach(col => {
                        if (col === 'gross') row[col] = calculateGrossWage(emp);
                        else row[col] = (emp as any)[col];
                    });
                    return row;
                });
                const filePath = await generateEmployeeXLSX(dataToExport, companyProfile);
                setExportModal({ ...exportModal, isOpen: false, password: '', error: '' });
                
                if (filePath) {
                    showAlert(
                        'success',
                        'Export Successful',
                        'Employee data has been exported to your reports folder.',
                        () => openSavedReport(filePath),
                        undefined,
                        'Open Report & Folder',
                        undefined,
                        undefined,
                        2
                    );
                }
            } else {
                setExportModal({ ...exportModal, error: 'Invalid Password. Admin Required.' });
            }
        } catch (error) {
            setExportModal({ ...exportModal, error: 'Authorization error.' });
        }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setNewEmpForm({ ...newEmpForm, photoUrl: reader.result as string });
            reader.readAsDataURL(file);
        }
    };

    const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewEmpForm(prev => ({
                    ...prev,
                    employeeDocuments: { ...prev.employeeDocuments, [type]: reader.result as string }
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
            {/* STICKY HEADER & TOOLBAR */}
            <div className="sticky top-0 z-20 bg-slate-950 px-8 pt-2 pb-2 border-b border-slate-800 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-xl border transition-all ${isWin7 
                            ? 'bg-blue-600/40 text-white border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]' 
                            : 'bg-blue-600/10 text-blue-400 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                        }`}>
                            <Users size={28} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-4">
                            <h1 className="text-lg font-black tracking-tighter text-white uppercase flex items-center gap-2">
                                Personnel <span className="text-blue-500">Master</span>
                            </h1>
                            <div className="hidden md:block w-[1px] h-4 bg-slate-800 self-center"></div>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] opacity-80 decoration-blue-500/30">Enterprise Employee Lifecycle & Master Record Management</p>
                        </div>
                    </div>
                </div>

                <EmployeeToolbar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    totalActive={activeEmployees.length}
                    totalActiveLabel="Active Employees"
                    limit={dataSizeLimit}
                    isImporting={isImporting}
                    onDownloadTemplate={async () => {
                        const path = await generateEmployeeXLSX([]);
                        if (path) {
                            showAlert(
                                'success',
                                'Template Downloaded',
                                'Employee import template has been saved to your reports folder.',
                                () => openSavedReport(path),
                                undefined,
                                'Open Folder',
                                undefined,
                                undefined,
                                2
                            );
                        }
                    }}
                    onImportClick={handleImport}
                    onExportClick={() => setExportModal({ ...exportModal, isOpen: true })}
                    onShowRejoin={() => setShowRejoinPanel(true)}
                    onAddNew={handleAddNew}
                />
            </div>

            {/* SCROLLABLE TABLE CONTENT */}
            <div className="flex-1 p-4 pt-2 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                    <div className="xl:col-span-3">
                        <EmployeeTable
                            employees={filteredEmployees}
                            selectedEmp={selectedEmp}
                            onSelectEmp={setSelectedEmp}
                            onEdit={handleEdit}
                            onDelete={handleDeleteClick}
                            calculateGrossWage={calculateGrossWage}
                            currentUser={currentUser}
                        />
                    </div>
                    <div className="xl:col-span-1 space-y-6">
                        <EmployeeDetailSidebar
                            selectedEmp={selectedEmp}
                            onEdit={handleEdit}
                        />
                    </div>
                </div>

                <RejoinSidebar
                    isOpen={showRejoinPanel}
                    onClose={() => setShowRejoinPanel(false)}
                    searchTerm={rejoinSearch}
                    onSearchChange={setRejoinSearch}
                    filteredExEmployees={filteredExEmployees}
                    onInitiateRejoin={(emp) => {
                        setNewEmpForm({ ...emp }); // DOJ will be pink/restructured in Form
                        setEditingId(emp.id);
                        setIsAdding(true);
                        setShowRejoinPanel(false);
                        setIsSeparationUnlocked(true);
                    }}
                />

                {isAdding && (
                    <EmployeeForm
                        editingId={editingId}
                        newEmpForm={newEmpForm}
                        setNewEmpForm={setNewEmpForm}
                        onClose={() => setIsAdding(false)}
                        onSubmit={handleAddSubmit}
                        designations={designations}
                        divisions={divisions}
                        branches={branches}
                        sites={sites}
                        photoInputRef={photoInputRef}
                        resumeInputRef={resumeInputRef}
                        esiForm1InputRef={esiForm1InputRef}
                        pfForm2InputRef={pfForm2InputRef}
                        pfForm11InputRef={pfForm11InputRef}
                        handlePhotoUpload={handlePhotoUpload}
                        handleDocumentUpload={handleDocumentUpload}
                        onPreviewDoc={(url, name) => setPreviewDoc({ url, name })}
                        calculateGrossWage={calculateGrossWage}
                        isSeparationUnlocked={isSeparationUnlocked}
                        onUnlockSeparation={() => setAuthModal({ isOpen: true, password: '', error: '', targetEmp: null, mode: 'UNLOCK_SEPARATION' })}
                        globalMonth={globalMonth}
                        globalYear={globalYear}
                    />
                )}

                <AuthModal
                    isOpen={authModal.isOpen}
                    onClose={() => setAuthModal({ ...authModal, isOpen: false })}
                    password={authModal.password}
                    onPasswordChange={(val) => setAuthModal({ ...authModal, password: val, error: '' })}
                    error={authModal.error}
                    onSubmit={handleAuthSubmit}
                    description={authModal.mode === 'DELETE' ? `Confirm deletion of ${authModal.targetEmp?.name}.` : undefined}
                />

                <DeleteModal
                    isOpen={deleteModal.isOpen}
                    onClose={() => setDeleteModal({ isOpen: false, employee: null })}
                    employee={deleteModal.employee}
                    onConfirm={confirmDelete}
                />

                <ExportModal
                    isOpen={exportModal.isOpen}
                    onClose={() => setExportModal({ ...exportModal, isOpen: false })}
                    exportConfig={exportModal}
                    onConfigChange={setExportModal}
                    availableColumns={AVAILABLE_COLUMNS}
                    onToggleColumn={(key) => {
                        const next = exportModal.selectedColumns.includes(key) ? exportModal.selectedColumns.filter(c => c !== key) : [...exportModal.selectedColumns, key];
                        setExportModal({ ...exportModal, selectedColumns: next });
                    }}
                    onToggleAll={() => {
                        const next = exportModal.selectedColumns.length === AVAILABLE_COLUMNS.length ? [] : AVAILABLE_COLUMNS.map(c => c.key);
                        setExportModal({ ...exportModal, selectedColumns: next });
                    }}
                    onSubmit={handleExportSubmit}
                />

                <ImportSummaryModal
                    isOpen={!!importSummary}
                    onClose={() => setImportSummary(null)}
                    summary={importSummary}
                    onDownloadReport={(format) => generateImportFailureReport(importSummary, format, companyProfile)}
                />

                <DocumentPreviewModal
                    isOpen={!!previewDoc}
                    onClose={() => setPreviewDoc(null)}
                    previewDoc={previewDoc}
                />
            </div>
        </div>
    );
};

export default EmployeeList;
