import React, { useEffect, useRef } from 'react';
import {
    X, User2, Plus, Edit2, Camera, Upload,
    FileText, Save, Home, MapPinned, Landmark,
    Briefcase, ShieldCheck, ShieldAlert, UserMinus, Lock, BookOpen
} from 'lucide-react';
import { Employee } from '../../types';
import { INDIAN_STATES } from '../../constants';
import { formatIndianNumber } from '../../utils/formatters';

interface EmployeeFormProps {
    editingId: string | null;
    newEmpForm: Partial<Employee>;
    setNewEmpForm: React.Dispatch<React.SetStateAction<Partial<Employee>>>;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    designations: string[];
    divisions: string[];
    branches: string[];
    sites: string[];
    photoInputRef: React.RefObject<HTMLInputElement | null>;
    resumeInputRef: React.RefObject<HTMLInputElement | null>;
    esiForm1InputRef: React.RefObject<HTMLInputElement | null>;
    pfForm2InputRef: React.RefObject<HTMLInputElement | null>;
    pfForm11InputRef: React.RefObject<HTMLInputElement | null>;
    handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleDocumentUpload: (e: React.ChangeEvent<HTMLInputElement>, docType: keyof Required<Employee>['employeeDocuments']) => void;
    onPreviewDoc: (url: string, name: string) => void;
    calculateGrossWage: (data: Partial<Employee> | Employee) => number;
    isSeparationUnlocked: boolean;
    onUnlockSeparation: () => void;
    globalMonth: string;
    globalYear: number;
}

const FormSectionHeader = ({ icon: Icon, title, color = "text-sky-400", extra }: { icon: any, title: string, color?: string, extra?: React.ReactNode }) => (
    <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-3">
            <Icon size={18} className={color} />
            <h3 className={`text-xs font-black uppercase tracking-widest ${color}`}>{title}</h3>
        </div>
        {extra}
    </div>
);

const EmployeeForm: React.FC<EmployeeFormProps> = ({
    editingId,
    newEmpForm,
    setNewEmpForm,
    onClose,
    onSubmit,
    designations,
    divisions,
    branches,
    sites,
    photoInputRef,
    resumeInputRef,
    esiForm1InputRef,
    pfForm2InputRef,
    pfForm11InputRef,
    handlePhotoUpload,
    handleDocumentUpload,
    onPreviewDoc,
    calculateGrossWage,
    isSeparationUnlocked,
    onUnlockSeparation,
    globalMonth,
    globalYear
}) => {
    const nameInputRef = useRef<HTMLInputElement>(null);
    const dojInputRef = useRef<HTMLInputElement>(null);
    const dolInputRef = useRef<HTMLInputElement>(null);
    
    // Persistent rejoining state to track if the session started with a DOL
    const [isRejoining] = React.useState(!!editingId && !!newEmpForm.dol);
    const [isDOJUpdated, setIsDOJUpdated] = React.useState(false);
    const [isDOLRemoved, setIsDOLRemoved] = React.useState(false);

    // List of months for indexing
    const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    useEffect(() => {
        // Automatically focus the name input when the form opens
        // Using a small timeout to ensure the modal animation doesn't interfere
        const timer = setTimeout(() => {
            nameInputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // Effect to handle the selection of DOL text when it receives focus in rejoin mode
    const handleDOLFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (isRejoining && !isDOLRemoved) {
            // Standard .select() only highlights the first segment (dd) in date inputs.
            // We use document.execCommand('selectAll') as a workaround to highlight the whole value.
            const input = e.currentTarget;
            input.select();
            setTimeout(() => {
                try {
                    document.execCommand('selectAll', false, '');
                } catch (err) {}
            }, 0);
        }
    };

    const isDOJValidInRange = (dateStr: string) => {
        if (!dateStr) return false;
        const dojDate = new Date(dateStr);
        const monthIndex = monthsArr.indexOf(globalMonth);
        const startOfMonth = new Date(globalYear, monthIndex, 1);
        const endOfMonth = new Date(globalYear, monthIndex + 1, 0);
        return dojDate >= startOfMonth && dojDate <= endOfMonth;
    };

    return (
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
                    <button onClick={onClose} title="Close Form" aria-label="Close Form" className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition-all"><X size={24} /></button>
                </div>

                <form onSubmit={onSubmit} className="p-8 space-y-12">
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
                                        title="Click to Upload Photo"
                                        aria-label="Click to Upload Photo"
                                        onClick={() => photoInputRef.current?.click()}
                                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                    >
                                        <Upload size={20} className="text-white" />
                                    </button>
                                    <input title="Upload Employee Photo" aria-label="Upload Employee Photo" ref={photoInputRef} type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                </div>
                                {newEmpForm.photoUrl && (
                                    <button type="button" onClick={() => setNewEmpForm({ ...newEmpForm, photoUrl: '' })} title="Remove Employee Photo" aria-label="Remove Employee Photo" className="text-[10px] text-red-400 font-bold hover:underline">Remove Photo</button>
                                )}

                                <div className="w-full space-y-3 mt-4 border-t border-slate-800 pt-4">
                                    <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center mb-2 flex items-center justify-center gap-1.5"><FileText size={10} /> Identity & Statutory Docs (Max 2MB)</h4>

                                    {[
                                        { key: 'resume', label: 'Approved Resume', ref: resumeInputRef },
                                        { key: 'esiForm1', label: 'ESI Form 1', ref: esiForm1InputRef },
                                        { key: 'pfForm2', label: 'PF Form 2', ref: pfForm2InputRef },
                                        { key: 'pfForm11', label: 'PF Form 11', ref: pfForm11InputRef }
                                    ].map(docType => {
                                        const hasDoc = newEmpForm.employeeDocuments?.[docType.key as keyof typeof newEmpForm.employeeDocuments];
                                        return (
                                            <div key={docType.key} className={`relative flex items-center justify-between p-2 rounded-xl border ${hasDoc ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-slate-900/50 border-slate-700 hover:border-blue-500/50'} transition-all group`}>
                                                <div className="flex flex-col">
                                                    <span className={`text-[9px] font-bold uppercase ${hasDoc ? 'text-emerald-400' : 'text-slate-400'}`}>{docType.label}</span>
                                                    <span className="text-[8px] text-slate-500">.PDF / .JPG / .PNG</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    {hasDoc && (
                                                        <>
                                                            <button type="button" onClick={() => {
                                                                onPreviewDoc(hasDoc, `${newEmpForm.name || 'Employee'} - ${docType.label}`);
                                                            }} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors" title={`Preview ${docType.label}`} aria-label={`Preview ${docType.label}`}><FileText size={12} /></button>
                                                            <button type="button" title={`Remove ${docType.label}`} aria-label={`Remove ${docType.label}`} onClick={() => {
                                                                setNewEmpForm(prev => ({
                                                                    ...prev,
                                                                    employeeDocuments: {
                                                                        ...prev.employeeDocuments,
                                                                        [docType.key]: undefined
                                                                    }
                                                                }));
                                                            }} className="p-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"><X size={12} /></button>
                                                        </>
                                                    )}
                                                    {!hasDoc && (
                                                        <button type="button" title={`Upload ${docType.label}`} aria-label={`Upload ${docType.label}`} onClick={() => docType.ref.current?.click()} className="p-1.5 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 rounded-lg transition-colors"><Upload size={14} /></button>
                                                    )}
                                                </div>
                                                <input ref={docType.ref} title={`Upload ${docType.label}`} aria-label={`Upload ${docType.label}`} type="file" className="hidden" accept=".pdf,image/jpeg,image/png" onChange={(e) => handleDocumentUpload(e, docType.key as keyof Required<Employee>['employeeDocuments'])} />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-1.5">
                                    <label htmlFor="employeeIdInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Employee ID*</label>
                                    <div className="relative">
                                        <input
                                            id="employeeIdInput"
                                            readOnly
                                            tabIndex={isRejoining ? -1 : undefined}
                                            title="Automatically Generated Employee ID"
                                            aria-label="Automatically Generated Employee ID"
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-sm text-slate-400 font-bold font-mono outline-none cursor-not-allowed focus:ring-0"
                                            value={newEmpForm.id}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 font-bold uppercase">Auto-Gen</div>
                                    </div>
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <label htmlFor="employeeNameInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Legal Name*</label>
                                    <input 
                                        ref={nameInputRef}
                                        id="employeeNameInput" 
                                        required 
                                        title="Full Legal Name" 
                                        aria-label="Full Legal Name" 
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                                        value={newEmpForm.name} 
                                        onChange={e => setNewEmpForm({ ...newEmpForm, name: e.target.value })} 
                                    />
                                    {isRejoining && (!isDOJUpdated || !isDOLRemoved) && (
                                        <div className="text-[10px] text-pink-500 font-bold uppercase mt-1 animate-pulse">Rejoining Instance: Update Joining Date & Remove Leaving Date</div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="mobileInput" className="text-[10px] font-bold text-sky-400 uppercase tracking-widest ml-1">Mobile No*</label>
                                    <input id="mobileInput" tabIndex={isRejoining ? -1 : undefined} required title="Mobile Number" aria-label="Mobile Number" className="w-full bg-slate-900 border border-sky-900/50 rounded-xl p-3 text-sm text-white font-mono focus:ring-2 focus:ring-blue-500 outline-none" value={newEmpForm.mobile} onChange={e => setNewEmpForm({ ...newEmpForm, mobile: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="emailInput" className="text-[10px] font-bold text-sky-400 uppercase tracking-widest ml-1">Email ID</label>
                                    <input id="emailInput" tabIndex={isRejoining ? -1 : undefined} type="email" title="Employee Email Address" aria-label="Employee Email Address" className="w-full bg-slate-900 border border-sky-900/50 rounded-xl p-3 text-sm text-white font-mono focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-600" placeholder="emp@company.com" value={newEmpForm.email || ''} onChange={e => setNewEmpForm({ ...newEmpForm, email: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="genderInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Gender</label>
                                    <select id="genderInput" tabIndex={isRejoining ? -1 : undefined} title="Gender" aria-label="Gender" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.gender} onChange={e => setNewEmpForm({ ...newEmpForm, gender: e.target.value as any })}><option>Male</option><option>Female</option><option>Transgender</option><option>Others</option></select>
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="dobInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Date of Birth</label>
                                    <input id="dobInput" tabIndex={isRejoining ? -1 : undefined} type="date" title="Date of Birth" aria-label="Date of Birth" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.dob} onChange={e => setNewEmpForm({ ...newEmpForm, dob: e.target.value })} />
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="dojInput" className={`text-[10px] font-bold uppercase tracking-widest ml-1 ${isRejoining && !isDOJUpdated ? 'text-pink-500' : 'text-slate-500'}`}>Date of Joining</label>
                                    <div className="relative">
                                        <input 
                                            ref={dojInputRef}
                                            id="dojInput" 
                                            type="date" 
                                            title="Date of Joining" 
                                            aria-label="Date of Joining" 
                                            className={`w-full bg-slate-900 border rounded-xl p-3 text-sm outline-none transition-all ${isRejoining && !isDOJUpdated ? 'text-pink-500 ring-2 ring-pink-500/50 bg-pink-500/5 border-pink-500/30' : 'text-white border-slate-700 focus:ring-2 focus:ring-blue-500'}`} 
                                            value={newEmpForm.doj} 
                                            onChange={e => {
                                                const val = e.target.value;
                                                setNewEmpForm({ ...newEmpForm, doj: val });
                                                // Real-time highlight: Pink if invalid, White if valid
                                                setIsDOJUpdated(isDOJValidInRange(val));
                                            }} 
                                            onBlur={() => {
                                                // No blocking alerts on blur to prevent focus-lock issues.
                                                // The pink highlight and error message below provide the visual cue.
                                            }}
                                            onKeyDown={(e) => {
                                                if (isRejoining && e.key === 'Tab' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    if (!isDOJValidInRange(newEmpForm.doj || '')) {
                                                        alert(`DOJ is not within the Process Pay Date - ${globalMonth} ${globalYear}`);
                                                    }
                                                    // After alert (or if valid), always move to DOL
                                                    dolInputRef.current?.focus();
                                                }
                                            }}
                                        />
                                        {isRejoining && newEmpForm.doj && !isDOJUpdated && (
                                            <div className="text-[9px] text-pink-500 font-bold uppercase mt-1.5 ml-1 animate-pulse flex items-center gap-1.5">
                                                <ShieldAlert size={10} /> Must be within {globalMonth} {globalYear}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="designationInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Designation</label>
                                    <select id="designationInput" tabIndex={isRejoining ? -1 : undefined} title="Designation" aria-label="Designation" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.designation} onChange={e => setNewEmpForm({ ...newEmpForm, designation: e.target.value })}>{designations.map(d => <option key={d}>{d}</option>)}</select>
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="divisionInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Department/Division</label>
                                    <select id="divisionInput" tabIndex={isRejoining ? -1 : undefined} title="Department/Division" aria-label="Department/Division" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.division} onChange={e => setNewEmpForm({ ...newEmpForm, division: e.target.value })}>{divisions.map(d => <option key={d}>{d}</option>)}</select>
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="branchInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Work Branch</label>
                                    <select id="branchInput" tabIndex={isRejoining ? -1 : undefined} title="Work Branch" aria-label="Work Branch" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.branch} onChange={e => setNewEmpForm({ ...newEmpForm, branch: e.target.value })}>{branches.map(b => <option key={b}>{b}</option>)}</select>
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="siteInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Site</label>
                                    <select id="siteInput" tabIndex={isRejoining ? -1 : undefined} title="Site Name" aria-label="Site Name" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.site} onChange={e => setNewEmpForm({ ...newEmpForm, site: e.target.value })}>{sites.map(s => <option key={s}>{s}</option>)}</select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div>
                            <FormSectionHeader icon={Home} title="2. Family Relations" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/30 p-4 rounded-xl border border-slate-800">
                                 <div className="col-span-2 space-y-1.5"><label htmlFor="fatherSpouseNameInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Father / Spouse Name</label><input id="fatherSpouseNameInput" tabIndex={isRejoining ? -1 : undefined} title="Father or Spouse Name" aria-label="Father or Spouse Name" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.fatherSpouseName} onChange={e => setNewEmpForm({ ...newEmpForm, fatherSpouseName: e.target.value })} /></div>
                                <div className="col-span-2 space-y-1.5"><label htmlFor="relationshipInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Relationship</label><select id="relationshipInput" tabIndex={isRejoining ? -1 : undefined} title="Relationship" aria-label="Relationship" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.relationship} onChange={e => setNewEmpForm({ ...newEmpForm, relationship: e.target.value })}><option>Father</option><option>Spouse</option><option>Mother</option><option>Guardian</option></select></div>

                                <div className="space-y-1.5">
                                    <label htmlFor="maritalStatusInput" className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Married</label>
                                     <select
                                        id="maritalStatusInput"
                                        tabIndex={isRejoining ? -1 : undefined}
                                        title="Marital Status"
                                        aria-label="Marital Status"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none"
                                        value={newEmpForm.maritalStatus || 'No'}
                                        onChange={e => setNewEmpForm({ ...newEmpForm, maritalStatus: e.target.value as 'Yes' | 'No' })}
                                    >
                                        <option value="No">No</option>
                                        <option value="Yes">Yes</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="spouseNameInput" className={`text-[10px] font-bold uppercase tracking-widest ${newEmpForm.maritalStatus === 'Yes' ? 'text-slate-500' : 'text-slate-700'}`}>Spouse Name</label>
                                     <input
                                        id="spouseNameInput"
                                        tabIndex={isRejoining ? -1 : undefined}
                                        title="Spouse Legal Name"
                                        aria-label="Spouse Legal Name"
                                        className={`w-full bg-slate-900 border rounded-xl p-3 text-sm text-white outline-none transition-colors ${newEmpForm.maritalStatus === 'Yes' ? 'border-slate-700' : 'border-slate-800 text-slate-600'}`}
                                        disabled={newEmpForm.maritalStatus !== 'Yes'}
                                        value={newEmpForm.spouseName || ''}
                                        onChange={e => setNewEmpForm({ ...newEmpForm, spouseName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="spouseGenderInput" className={`text-[10px] font-bold uppercase tracking-widest ${newEmpForm.maritalStatus === 'Yes' ? 'text-slate-500' : 'text-slate-700'}`}>Spouse Gender</label>
                                     <select
                                        id="spouseGenderInput"
                                        tabIndex={isRejoining ? -1 : undefined}
                                        title="Spouse Gender"
                                        aria-label="Spouse Gender"
                                        className={`w-full bg-slate-900 border rounded-xl p-3 text-sm text-white outline-none transition-colors ${newEmpForm.maritalStatus === 'Yes' ? 'border-slate-700' : 'border-slate-800 text-slate-600'}`}
                                        disabled={newEmpForm.maritalStatus !== 'Yes'}
                                        value={newEmpForm.spouseGender || ''}
                                        onChange={e => setNewEmpForm({ ...newEmpForm, spouseGender: e.target.value })}
                                    >
                                        <option value="">Select...</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Others">Others</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="spouseAadhaarInput" className={`text-[10px] font-bold uppercase tracking-widest ${newEmpForm.maritalStatus === 'Yes' ? 'text-slate-500' : 'text-slate-700'}`}>Spouse Aadhaar No</label>
                                     <input
                                        id="spouseAadhaarInput"
                                        tabIndex={isRejoining ? -1 : undefined}
                                        title="Spouse Aadhaar Number"
                                        aria-label="Spouse Aadhaar Number"
                                        className={`w-full bg-slate-900 border rounded-xl p-3 text-sm text-white outline-none font-mono transition-colors ${newEmpForm.maritalStatus === 'Yes' ? 'border-slate-700' : 'border-slate-800 text-slate-600'}`}
                                        disabled={newEmpForm.maritalStatus !== 'Yes'}
                                        value={newEmpForm.spouseAadhaar || ''}
                                        onChange={e => setNewEmpForm({ ...newEmpForm, spouseAadhaar: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <FormSectionHeader icon={MapPinned} title="3. Residential Address" />
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5"><label htmlFor="doorNoInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Door No / House No</label><input id="doorNoInput" tabIndex={isRejoining ? -1 : undefined} title="Door No" aria-label="Door No" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.doorNo} onChange={e => setNewEmpForm({ ...newEmpForm, doorNo: e.target.value })} /></div>
                                <div className="space-y-1.5"><label htmlFor="buildingNameInput" className="text-[10px] font-bold text-slate-500 uppercase">Building / Flat Name</label><input id="buildingNameInput" tabIndex={isRejoining ? -1 : undefined} title="Building Name" aria-label="Building Name" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.buildingName} onChange={e => setNewEmpForm({ ...newEmpForm, buildingName: e.target.value })} /></div>
                                <div className="space-y-1.5"><label htmlFor="streetInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Street</label><input id="streetInput" tabIndex={isRejoining ? -1 : undefined} title="Street Name" aria-label="Street Name" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.street} onChange={e => setNewEmpForm({ ...newEmpForm, street: e.target.value })} /></div>
                                <div className="space-y-1.5"><label htmlFor="areaInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Area</label><input id="areaInput" tabIndex={isRejoining ? -1 : undefined} title="Area Locality" aria-label="Area Locality" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.area} onChange={e => setNewEmpForm({ ...newEmpForm, area: e.target.value })} /></div>
                                <div className="space-y-1.5"><label htmlFor="cityInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">City / Town</label><input id="cityInput" tabIndex={isRejoining ? -1 : undefined} title="City or Town" aria-label="City or Town" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.city} onChange={e => setNewEmpForm({ ...newEmpForm, city: e.target.value })} /></div>
                                <div className="space-y-1.5"><label htmlFor="stateSelect" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">State</label><select id="stateSelect" tabIndex={isRejoining ? -1 : undefined} title="State" aria-label="State" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={newEmpForm.state} onChange={e => setNewEmpForm({ ...newEmpForm, state: e.target.value })}>{INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                <div className="space-y-1.5 col-span-2"><label htmlFor="pincodeInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pincode</label><input id="pincodeInput" tabIndex={isRejoining ? -1 : undefined} title="Pincode" aria-label="Pincode" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.pincode} onChange={e => setNewEmpForm({ ...newEmpForm, pincode: e.target.value })} /></div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <FormSectionHeader icon={Landmark} title="4. Banking & Disbursement" color="text-indigo-400" />
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-indigo-900/10 p-6 rounded-2xl border border-indigo-500/20">
                             <div className="space-y-1.5 md:col-span-1"><label htmlFor="bankAccountInput" className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Bank Account No</label><input id="bankAccountInput" tabIndex={isRejoining ? -1 : undefined} title="Bank Account Number" aria-label="Bank Account Number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-indigo-500" value={newEmpForm.bankAccount} onChange={e => setNewEmpForm({ ...newEmpForm, bankAccount: e.target.value })} /></div>
                            <div className="space-y-1.5 md:col-span-1"><label htmlFor="ifscInput" className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">IFSC Code</label><input id="ifscInput" tabIndex={isRejoining ? -1 : undefined} title="IFSC Code" aria-label="IFSC Code" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-indigo-500" value={newEmpForm.ifsc} onChange={e => setNewEmpForm({ ...newEmpForm, ifsc: e.target.value.toUpperCase() })} /></div>
                            <div className="space-y-1.5 md:col-span-1"><label htmlFor="bankNameInput" className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Bank Name</label><input id="bankNameInput" tabIndex={isRejoining ? -1 : undefined} title="Bank Name" aria-label="Bank Name" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500" value={newEmpForm.bankName} onChange={e => setNewEmpForm({ ...newEmpForm, bankName: e.target.value })} /></div>
                            <div className="space-y-1.5 md:col-span-1"><label htmlFor="bankBranchInput" className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Bank Branch</label><input id="bankBranchInput" tabIndex={isRejoining ? -1 : undefined} title="Bank Branch" aria-label="Bank Branch" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500" value={newEmpForm.bankBranch} onChange={e => setNewEmpForm({ ...newEmpForm, bankBranch: e.target.value })} /></div>
                        </div>
                    </div>

                    <div>
                        <FormSectionHeader icon={Briefcase} title="5. Salary Structure & Allowances" color="text-emerald-400" />
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                              <div className="space-y-1.5"><label htmlFor="basicPayInput" className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Basic Pay</label><input id="basicPayInput" tabIndex={isRejoining ? -1 : undefined} type="number" title="Basic Pay Amount" aria-label="Basic Pay Amount" className="w-full bg-slate-900 border border-emerald-900/50 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-emerald-500" value={newEmpForm.basicPay} onChange={e => setNewEmpForm({ ...newEmpForm, basicPay: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label htmlFor="daInput" className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">DA</label><input id="daInput" tabIndex={isRejoining ? -1 : undefined} type="number" title="DA Amount" aria-label="DA Amount" className="w-full bg-slate-900 border border-emerald-900/50 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-emerald-500" value={newEmpForm.da} onChange={e => setNewEmpForm({ ...newEmpForm, da: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label htmlFor="retainingAllwInput" className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Retaining Allow</label><input id="retainingAllwInput" tabIndex={isRejoining ? -1 : undefined} type="number" title="Retaining Allowance" aria-label="Retaining Allowance" className="w-full bg-slate-900 border border-emerald-900/50 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-emerald-500" value={newEmpForm.retainingAllowance} onChange={e => setNewEmpForm({ ...newEmpForm, retainingAllowance: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label htmlFor="hraInput" className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">HRA</label><input id="hraInput" tabIndex={isRejoining ? -1 : undefined} type="number" title="HRA Amount" aria-label="HRA Amount" className="w-full bg-slate-900 border border-emerald-900/50 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-emerald-500" value={newEmpForm.hra} onChange={e => setNewEmpForm({ ...newEmpForm, hra: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label htmlFor="conveyanceInput" className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Conveyance</label><input id="conveyanceInput" tabIndex={isRejoining ? -1 : undefined} type="number" title="Conveyance Amount" aria-label="Conveyance Amount" className="w-full bg-slate-900 border border-emerald-900/50 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-emerald-500" value={newEmpForm.conveyance} onChange={e => setNewEmpForm({ ...newEmpForm, conveyance: +e.target.value })} /></div>

                               <div className="space-y-1.5"><label htmlFor="washingInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Washing Allow</label><input id="washingInput" tabIndex={isRejoining ? -1 : undefined} type="number" title="Washing Allowance" aria-label="Washing Allowance" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-slate-500" value={newEmpForm.washing} onChange={e => setNewEmpForm({ ...newEmpForm, washing: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label htmlFor="attireInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Attire Allow</label><input id="attireInput" tabIndex={isRejoining ? -1 : undefined} type="number" title="Attire Allowance" aria-label="Attire Allowance" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-slate-500" value={newEmpForm.attire} onChange={e => setNewEmpForm({ ...newEmpForm, attire: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label htmlFor="special1Input" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Special Allow 1</label><input id="special1Input" tabIndex={isRejoining ? -1 : undefined} type="number" title="Special Allowance 1" aria-label="Special Allowance 1" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-slate-500" value={newEmpForm.specialAllowance1} onChange={e => setNewEmpForm({ ...newEmpForm, specialAllowance1: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label htmlFor="special2Input" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Special Allow 2</label><input id="special2Input" tabIndex={isRejoining ? -1 : undefined} type="number" title="Special Allowance 2" aria-label="Special Allowance 2" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-slate-500" value={newEmpForm.specialAllowance2} onChange={e => setNewEmpForm({ ...newEmpForm, specialAllowance2: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label htmlFor="special3Input" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Special Allow 3</label><input id="special3Input" tabIndex={isRejoining ? -1 : undefined} type="number" title="Special Allowance 3" aria-label="Special Allowance 3" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-slate-500" value={newEmpForm.specialAllowance3} onChange={e => setNewEmpForm({ ...newEmpForm, specialAllowance3: +e.target.value })} /></div>
                        </div>
                        <div className="mt-4 p-4 bg-emerald-900/10 border border-emerald-500/20 rounded-xl flex justify-between items-center">
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Total Gross Salary</span>
                            <span className="text-2xl font-black text-white font-mono">₹ {formatIndianNumber(calculateGrossWage(newEmpForm))}</span>
                        </div>
                    </div>
                    <div>
                        <FormSectionHeader icon={ShieldCheck} title="6. Statutory Identity Numbers" color="text-amber-400" />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                            <div className="space-y-1.5"><label htmlFor="panInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PAN No</label><input id="panInput" tabIndex={isRejoining ? -1 : undefined} title="PAN Number" aria-label="PAN Number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-amber-500 uppercase" value={newEmpForm.pan} onChange={e => setNewEmpForm({ ...newEmpForm, pan: e.target.value })} /></div>
                            <div className="space-y-1.5"><label htmlFor="aadhaarInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aadhaar No</label><input id="aadhaarInput" tabIndex={isRejoining ? -1 : undefined} title="Aadhaar Number" aria-label="Aadhaar Number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-amber-500" value={newEmpForm.aadhaarNumber} onChange={e => setNewEmpForm({ ...newEmpForm, aadhaarNumber: e.target.value })} /></div>
                            <div className="space-y-1.5"><label htmlFor="uanInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">UAN No</label><input id="uanInput" tabIndex={isRejoining ? -1 : undefined} title="UAN Number" aria-label="UAN Number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-amber-500" value={newEmpForm.uanc} onChange={e => setNewEmpForm({ ...newEmpForm, uanc: e.target.value })} /></div>
                            <div className="space-y-1.5"><label htmlFor="pfNumberInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PF Number</label><input id="pfNumberInput" tabIndex={isRejoining ? -1 : undefined} title="PF Number" aria-label="PF Number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-amber-500" value={newEmpForm.pfNumber} onChange={e => setNewEmpForm({ ...newEmpForm, pfNumber: e.target.value })} /></div>
                            <div className="space-y-1.5"><label htmlFor="esiNumberInput" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ESI Number</label><input id="esiNumberInput" tabIndex={isRejoining ? -1 : undefined} title="ESI Number" aria-label="ESI Number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-amber-500" value={newEmpForm.esiNumber} onChange={e => setNewEmpForm({ ...newEmpForm, esiNumber: e.target.value })} /></div>
                        </div>
                    </div>

                    <div>
                        <FormSectionHeader icon={ShieldAlert} title="7. Statutory Options & Exemptions" color="text-amber-400" />
                        <div className="bg-slate-900/30 p-6 rounded-xl border border-slate-800 space-y-6">
                            <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-700">
                                <div>
                                    <h4 className="text-sm font-bold text-white">A. PF Exempted (Para 69)</h4>
                                    <p className="text-[10px] text-slate-400">Employee excluded from EPF coverage. (Also disables Higher Pension)</p>
                                </div>                                 <label htmlFor="pfExemptInput" className="relative inline-flex items-center cursor-pointer">
                                    <input id="pfExemptInput" tabIndex={isRejoining ? -1 : undefined} title="PF Exempted" aria-label="PF Exempted" type="checkbox" className="sr-only peer" checked={newEmpForm.isPFExempt} onChange={e => {
                                        const isExempt = e.target.checked;
                                        setNewEmpForm(prev => ({
                                            ...prev,
                                            isPFExempt: isExempt,
                                            pfHigherPension: isExempt ? { ...prev.pfHigherPension!, enabled: false } : prev.pfHigherPension
                                        }));
                                    }} />

                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-700">
                                <div>
                                    <h4 className="text-sm font-bold text-white">B. ESI Exempted</h4>
                                    <p className="text-[10px] text-slate-400">Above Wage Ceiling or not covered.</p>
                                </div>
                                 <label htmlFor="esiExemptInput" className="relative inline-flex items-center cursor-pointer">
                                    <input id="esiExemptInput" tabIndex={isRejoining ? -1 : undefined} title="ESI Exempted" aria-label="ESI Exempted" type="checkbox" className="sr-only peer" checked={newEmpForm.isESIExempt} onChange={e => setNewEmpForm({ ...newEmpForm, isESIExempt: e.target.checked })} />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                                </label>
                            </div>

                            <div className={`border-t border-slate-800 pt-6 space-y-4 ${newEmpForm.isPFExempt ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-400">Enable Higher Pension Option (EPS 95)</h4>
                                        <p className="text-[10px] text-slate-400">Apply for Higher Pension on Actual Wages (Joint Option).</p>
                                    </div>
                                     <label htmlFor="higherPensionToggle" className="relative inline-flex items-center cursor-pointer">
                                        <input id="higherPensionToggle" tabIndex={isRejoining ? -1 : undefined} title="Enable Higher Pension" aria-label="Enable Higher Pension" type="checkbox" className="sr-only peer" checked={newEmpForm.pfHigherPension?.enabled} onChange={e => setNewEmpForm(prev => ({ ...prev, pfHigherPension: { ...prev.pfHigherPension!, enabled: e.target.checked } }))} />
                                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                                    </label>
                                </div>

                                {newEmpForm.pfHigherPension?.enabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700 animate-in slide-in-from-top-2">
                                        <div className="space-y-1.5">
                                            <label htmlFor="higherWagesPre2014" className="text-[9px] font-bold text-slate-400 uppercase">1. Contributed on Higher Wages pre-2014?</label>                                             <select id="higherWagesPre2014" tabIndex={isRejoining ? -1 : undefined} title="Contributed on Higher Wages pre-2014" aria-label="Contributed on Higher Wages pre-2014" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-white" value={newEmpForm.pfHigherPension.contributedBefore2014} onChange={e => setNewEmpForm(prev => ({ ...prev, pfHigherPension: { ...prev.pfHigherPension!, contributedBefore2014: e.target.value as any } }))}>
                                                <option>No</option><option>Yes</option>
                                            </select>

                                        </div>
                                        <div className="space-y-1.5">
                                            <label htmlFor="epfMembershipDateInput" className="text-[9px] font-bold text-slate-400 uppercase">2. EPF Membership Date (DOJ Impact)</label>
                                             <input id="epfMembershipDateInput" tabIndex={isRejoining ? -1 : undefined} type="date" title="EPF Membership Date" aria-label="EPF Membership Date" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-white" value={newEmpForm.epfMembershipDate} onChange={e => setNewEmpForm({ ...newEmpForm, epfMembershipDate: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label htmlFor="employeeContribType" className="text-[9px] font-bold text-slate-400 uppercase">3. Employee Contribution Type</label>                                             <select id="employeeContribType" tabIndex={isRejoining ? -1 : undefined} title="Employee Contribution Type" aria-label="Employee Contribution Type" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-white" value={newEmpForm.pfHigherPension.employeeContribution} onChange={e => setNewEmpForm(prev => ({ ...prev, pfHigherPension: { ...prev.pfHigherPension!, employeeContribution: e.target.value as any } }))}>
                                                <option>Regular</option><option>Higher</option>

                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label htmlFor="employerContribType" className="text-[9px] font-bold text-slate-400 uppercase">4. Employer Contribution Type</label>
                                            <select id="employerContribType" tabIndex={isRejoining ? -1 : undefined} title="Employer Contribution Type" aria-label="Employer Contribution Type" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-white" value={newEmpForm.pfHigherPension.employerContribution} onChange={e => setNewEmpForm(prev => ({ ...prev, pfHigherPension: { ...prev.pfHigherPension!, employerContribution: e.target.value as any } }))}>
                                                <option>Regular</option><option>Higher</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5 col-span-2">
                                            <label htmlFor="jointOptionExercised" className="text-[9px] font-bold text-slate-400 uppercase">5. Joint Option Exercised?</label>                                             <select id="jointOptionExercised" tabIndex={isRejoining ? -1 : undefined} title="Joint Option Exercised" aria-label="Joint Option Exercised" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-white" value={newEmpForm.pfHigherPension.isHigherPensionOpted} onChange={e => setNewEmpForm(prev => ({ ...prev, pfHigherPension: { ...prev.pfHigherPension!, isHigherPensionOpted: e.target.value as any } }))}>
                                                <option>No</option><option>Yes</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <FormSectionHeader icon={BookOpen} title="8. Initial Leave Balances (Opening)" color="text-teal-400" />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-teal-900/5 p-6 rounded-xl border border-teal-500/20">
                            <div className="space-y-1.5">
                                <label htmlFor="initEL" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Earned Leave (EL)</label>
                                <input id="initEL" type="number" step="0.1" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-teal-500" 
                                    value={newEmpForm?.initialOpeningBalances?.el ?? 0} 
                                    onChange={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setNewEmpForm(prev => ({ 
                                            ...prev, 
                                            initialOpeningBalances: { 
                                                ...(prev.initialOpeningBalances || { el: 0, sl: 0, cl: 0 }), 
                                                el: val 
                                            } 
                                        }));
                                    }} 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="initSL" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sick Leave (SL)</label>
                                <input id="initSL" type="number" step="0.1" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-teal-500" 
                                    value={newEmpForm?.initialOpeningBalances?.sl ?? 0} 
                                    onChange={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setNewEmpForm(prev => ({ 
                                            ...prev, 
                                            initialOpeningBalances: { 
                                                ...(prev.initialOpeningBalances || { el: 0, sl: 0, cl: 0 }), 
                                                sl: val 
                                            } 
                                        }));
                                    }} 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="initCL" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Casual Leave (CL)</label>
                                <input id="initCL" type="number" step="0.1" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-teal-500" 
                                    value={newEmpForm?.initialOpeningBalances?.cl ?? 0} 
                                    onChange={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setNewEmpForm(prev => ({ 
                                            ...prev, 
                                            initialOpeningBalances: { 
                                                ...(prev.initialOpeningBalances || { el: 0, sl: 0, cl: 0 }), 
                                                cl: val 
                                            } 
                                        }));
                                    }} 
                                />
                            </div>
                        </div>
                    </div>

                    {editingId && (
                        <div>
                            <div className="flex items-center justify-between mb-6 border-b border-red-900/30 pb-2">
                                <div className="flex items-center gap-3">
                                    <UserMinus size={18} className="text-red-400" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-red-400">9. Separation & Final Settlement</h3>
                                </div>
                                {!isSeparationUnlocked && (
                                    <button type="button" onClick={onUnlockSeparation} title="Unlock Restricted Separation Fields" aria-label="Unlock Restricted Separation Fields" className="flex items-center gap-2 text-[10px] font-bold bg-red-900/20 text-red-400 px-3 py-1.5 rounded-lg border border-red-900/30 hover:bg-red-900/40 transition-colors">
                                        <Lock size={12} /> Unlock Restricted Fields
                                    </button>
                                )}
                            </div>
                            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl border transition-all ${isSeparationUnlocked ? 'bg-red-900/10 border-red-500/30' : 'bg-slate-900/30 border-slate-800 opacity-60 pointer-events-none'}`}>
                                <div className="space-y-1.5">
                                    <label htmlFor="dolInput" className={`text-[10px] font-bold uppercase tracking-widest ml-1 ${isRejoining && !isDOLRemoved ? 'text-pink-500' : 'text-slate-500'}`}>Date of Leaving (DOL)</label>
                                     <input 
                                        ref={dolInputRef}
                                        id="dolInput" 
                                         onKeyDown={(e) => {
                                            if (isRejoining && !isDOLRemoved && (e.key === 'Backspace' || e.key === 'Delete')) {
                                                e.preventDefault();
                                                setNewEmpForm({ ...newEmpForm, dol: '', leavingReason: '' });
                                                setIsDOLRemoved(true);
                                            }
                                         }}
                                        type="date" 
                                        onFocus={handleDOLFocus}
                                        title="Date of Leaving" 
                                        aria-label="Date of Leaving" 
                                        className={`w-full bg-slate-900 border rounded-xl p-3 text-sm outline-none transition-all ${isRejoining && !isDOLRemoved ? 'text-pink-500 ring-2 ring-pink-500/50 bg-pink-500/5 border-pink-500/30' : 'text-white border-slate-700 focus:ring-2 focus:ring-blue-500'}`} 
                                        value={newEmpForm.dol} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            setNewEmpForm({ 
                                                ...newEmpForm, 
                                                dol: val,
                                                leavingReason: val === '' ? '' : newEmpForm.leavingReason
                                            });
                                            if (val === '') {
                                                setIsDOLRemoved(true);
                                            }
                                        }} 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="leavingReasonInput" className="text-[10px] font-bold text-red-300 uppercase tracking-widest">Reason for Leaving</label>
                                     <select
                                        id="leavingReasonInput"
                                        title="Reason for Leaving"
                                        aria-label="Reason for Leaving"
                                        className="w-full bg-slate-900 border border-red-900/50 rounded-xl p-3 text-sm text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500"
                                        value={newEmpForm.leavingReason}
                                        onChange={e => {
                                            const val = e.target.value;
                                            const shouldClearDOL = val === '' || val === 'ON LOP';
                                            setNewEmpForm({
                                                ...newEmpForm,
                                                leavingReason: val,
                                                dol: shouldClearDOL ? '' : newEmpForm.dol
                                            });
                                        }}
                                    >
                                        <option value="">Select Reason...</option>
                                        <option value="ON LOP">ON LOP</option>
                                        <option value="Resignation">Resignation</option>
                                        <option value="Retirement">Retirement</option>
                                        <option value="Termination">Termination</option>
                                        <option value="Death">Death</option>
                                        <option value="Absconding">Absconding</option>
                                        <option value="Disablement">Permanent Disablement</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-4 pt-6 border-t border-slate-800">
                        <button type="button" onClick={onClose} title="Cancel and Close Form" aria-label="Cancel and Close Form" className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-sm">Cancel</button>
                        <button 
                            type="submit" 
                            title={isRejoining && (!isDOJUpdated || !isDOLRemoved) ? "Required for Rejoin: 1. Update DOJ 2. Clear DOL" : "Save Employee Record"}
                            aria-label="Save Employee Record" 
                            disabled={isRejoining && (!isDOJUpdated || !isDOLRemoved)}
                            onClick={(e) => {
                                // DOJ month alignment check - Only for NEW registration or REJOIN cases
                                // Regular edits for active employees should not be restricted to the current month
                                if (newEmpForm.doj && (!editingId || isRejoining)) {
                                    const dojDate = new Date(newEmpForm.doj);
                                    const monthIndex = monthsArr.indexOf(globalMonth);
                                    
                                    const startOfMonth = new Date(globalYear, monthIndex, 1);
                                    const endOfMonth = new Date(globalYear, monthIndex + 1, 0);

                                    // Simple check if DOJ is within the globalMonth/Year
                                    if (dojDate < startOfMonth || dojDate > endOfMonth) {
                                        e.preventDefault();
                                        alert(`Invalid DOJ: Date of Joining must be within the current processing month (${globalMonth} ${globalYear}).`);
                                        dojInputRef.current?.focus();
                                        return;
                                    }
                                }
                            }}
                            className={`px-8 py-3 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all text-sm flex items-center gap-2 ${isRejoining && (!isDOJUpdated || !isDOLRemoved) ? 'bg-slate-700 cursor-not-allowed opacity-50' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            <Save size={18} /> Save Record
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EmployeeForm;
