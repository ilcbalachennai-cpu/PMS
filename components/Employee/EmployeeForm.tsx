import React from 'react';
import {
    X, User2, Plus, Edit2, Camera, Upload,
    FileText, Save, Home, MapPinned, Landmark,
    Briefcase, ShieldCheck, ShieldAlert, UserMinus, Lock
} from 'lucide-react';
import { Employee, User } from '../../types';
import { INDIAN_STATES } from '../../constants';

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
    onUnlockSeparation
}) => {
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
                    <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition-all"><X size={24} /></button>
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
                                        onClick={() => photoInputRef.current?.click()}
                                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                    >
                                        <Upload size={20} className="text-white" />
                                    </button>
                                    <input ref={photoInputRef} type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                </div>
                                {newEmpForm.photoUrl && (
                                    <button type="button" onClick={() => setNewEmpForm({ ...newEmpForm, photoUrl: '' })} className="text-[10px] text-red-400 font-bold hover:underline">Remove Photo</button>
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
                                                            }} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors" title="Preview Document"><FileText size={12} /></button>
                                                            <button type="button" onClick={() => {
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
                                                        <button type="button" onClick={() => docType.ref.current?.click()} className="p-1.5 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 rounded-lg transition-colors"><Upload size={14} /></button>
                                                    )}
                                                </div>
                                                <input ref={docType.ref} type="file" className="hidden" accept=".pdf,image/jpeg,image/png" onChange={(e) => handleDocumentUpload(e, docType.key as keyof Required<Employee>['employeeDocuments'])} />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Employee ID*</label>
                                    <div className="relative">
                                        <input
                                            readOnly
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-sm text-slate-400 font-bold font-mono outline-none cursor-not-allowed focus:ring-0"
                                            value={newEmpForm.id}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 font-bold uppercase">Auto-Gen</div>
                                    </div>
                                </div>
                                <div className="space-y-1.5 md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Legal Name*</label><input required className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none" value={newEmpForm.name} onChange={e => setNewEmpForm({ ...newEmpForm, name: e.target.value })} /></div>

                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-sky-400 uppercase tracking-widest ml-1">Mobile No*</label><input required className="w-full bg-slate-900 border border-sky-900/50 rounded-xl p-3 text-sm text-white font-mono focus:ring-2 focus:ring-blue-500 outline-none" value={newEmpForm.mobile} onChange={e => setNewEmpForm({ ...newEmpForm, mobile: e.target.value })} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Gender</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.gender} onChange={e => setNewEmpForm({ ...newEmpForm, gender: e.target.value as any })}><option>Male</option><option>Female</option><option>Transgender</option><option>Others</option></select></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Date of Birth</label><input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.dob} onChange={e => setNewEmpForm({ ...newEmpForm, dob: e.target.value })} /></div>

                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Date of Joining</label><input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.doj} onChange={e => setNewEmpForm({ ...newEmpForm, doj: e.target.value })} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Designation</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.designation} onChange={e => setNewEmpForm({ ...newEmpForm, designation: e.target.value })}>{designations.map(d => <option key={d}>{d}</option>)}</select></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Department/Division</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.division} onChange={e => setNewEmpForm({ ...newEmpForm, division: e.target.value })}>{divisions.map(d => <option key={d}>{d}</option>)}</select></div>

                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Work Branch</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.branch} onChange={e => setNewEmpForm({ ...newEmpForm, branch: e.target.value })}>{branches.map(b => <option key={b}>{b}</option>)}</select></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Site</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.site} onChange={e => setNewEmpForm({ ...newEmpForm, site: e.target.value })}>{sites.map(s => <option key={s}>{s}</option>)}</select></div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div>
                            <FormSectionHeader icon={Home} title="2. Family Relations" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/30 p-4 rounded-xl border border-slate-800">
                                <div className="col-span-2 space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Father / Spouse Name</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.fatherSpouseName} onChange={e => setNewEmpForm({ ...newEmpForm, fatherSpouseName: e.target.value })} /></div>
                                <div className="col-span-2 space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Relationship</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.relationship} onChange={e => setNewEmpForm({ ...newEmpForm, relationship: e.target.value })}><option>Father</option><option>Spouse</option><option>Mother</option><option>Guardian</option></select></div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Married</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none"
                                        value={newEmpForm.maritalStatus || 'No'}
                                        onChange={e => setNewEmpForm({ ...newEmpForm, maritalStatus: e.target.value as 'Yes' | 'No' })}
                                    >
                                        <option value="No">No</option>
                                        <option value="Yes">Yes</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className={`text-[10px] font-bold uppercase tracking-widest ${newEmpForm.maritalStatus === 'Yes' ? 'text-slate-500' : 'text-slate-700'}`}>Spouse Name</label>
                                    <input
                                        className={`w-full bg-slate-900 border rounded-xl p-3 text-sm text-white outline-none transition-colors ${newEmpForm.maritalStatus === 'Yes' ? 'border-slate-700' : 'border-slate-800 text-slate-600'}`}
                                        disabled={newEmpForm.maritalStatus !== 'Yes'}
                                        value={newEmpForm.spouseName || ''}
                                        onChange={e => setNewEmpForm({ ...newEmpForm, spouseName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className={`text-[10px] font-bold uppercase tracking-widest ${newEmpForm.maritalStatus === 'Yes' ? 'text-slate-500' : 'text-slate-700'}`}>Spouse Gender</label>
                                    <select
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
                                    <label className={`text-[10px] font-bold uppercase tracking-widest ${newEmpForm.maritalStatus === 'Yes' ? 'text-slate-500' : 'text-slate-700'}`}>Spouse Aadhaar No</label>
                                    <input
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
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Door No / House No</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.doorNo} onChange={e => setNewEmpForm({ ...newEmpForm, doorNo: e.target.value })} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase">Building / Flat Name</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.buildingName} onChange={e => setNewEmpForm({ ...newEmpForm, buildingName: e.target.value })} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Street</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.street} onChange={e => setNewEmpForm({ ...newEmpForm, street: e.target.value })} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Area</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.area} onChange={e => setNewEmpForm({ ...newEmpForm, area: e.target.value })} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">City / Town</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none" value={newEmpForm.city} onChange={e => setNewEmpForm({ ...newEmpForm, city: e.target.value })} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">State</label><select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={newEmpForm.state} onChange={e => setNewEmpForm({ ...newEmpForm, state: e.target.value })}>{INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                <div className="space-y-1.5 col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pincode</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none" value={newEmpForm.pincode} onChange={e => setNewEmpForm({ ...newEmpForm, pincode: e.target.value })} /></div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <FormSectionHeader icon={Landmark} title="4. Banking & Disbursement" color="text-indigo-400" />
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-indigo-900/10 p-6 rounded-2xl border border-indigo-500/20">
                            <div className="space-y-1.5 md:col-span-1"><label className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Bank Account No</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-indigo-500" value={newEmpForm.bankAccount} onChange={e => setNewEmpForm({ ...newEmpForm, bankAccount: e.target.value })} /></div>
                            <div className="space-y-1.5 md:col-span-1"><label className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">IFSC Code</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-indigo-500" value={newEmpForm.ifsc} onChange={e => setNewEmpForm({ ...newEmpForm, ifsc: e.target.value.toUpperCase() })} /></div>
                            <div className="space-y-1.5 md:col-span-1"><label className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Bank Name</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500" value={newEmpForm.bankName} onChange={e => setNewEmpForm({ ...newEmpForm, bankName: e.target.value })} /></div>
                            <div className="space-y-1.5 md:col-span-1"><label className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Bank Branch</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-indigo-500" value={newEmpForm.bankBranch} onChange={e => setNewEmpForm({ ...newEmpForm, bankBranch: e.target.value })} /></div>
                        </div>
                    </div>

                    <div>
                        <FormSectionHeader icon={Briefcase} title="5. Salary Structure & Allowances" color="text-emerald-400" />
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Basic Pay</label><input type="number" className="w-full bg-slate-900 border border-emerald-900/50 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-emerald-500" value={newEmpForm.basicPay} onChange={e => setNewEmpForm({ ...newEmpForm, basicPay: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">DA</label><input type="number" className="w-full bg-slate-900 border border-emerald-900/50 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-emerald-500" value={newEmpForm.da} onChange={e => setNewEmpForm({ ...newEmpForm, da: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Retaining Allow</label><input type="number" className="w-full bg-slate-900 border border-emerald-900/50 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-emerald-500" value={newEmpForm.retainingAllowance} onChange={e => setNewEmpForm({ ...newEmpForm, retainingAllowance: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">HRA</label><input type="number" className="w-full bg-slate-900 border border-emerald-900/50 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-emerald-500" value={newEmpForm.hra} onChange={e => setNewEmpForm({ ...newEmpForm, hra: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Conveyance</label><input type="number" className="w-full bg-slate-900 border border-emerald-900/50 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-emerald-500" value={newEmpForm.conveyance} onChange={e => setNewEmpForm({ ...newEmpForm, conveyance: +e.target.value })} /></div>

                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Washing Allow</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-slate-500" value={newEmpForm.washing} onChange={e => setNewEmpForm({ ...newEmpForm, washing: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Attire Allow</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-slate-500" value={newEmpForm.attire} onChange={e => setNewEmpForm({ ...newEmpForm, attire: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Special Allow 1</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-slate-500" value={newEmpForm.specialAllowance1} onChange={e => setNewEmpForm({ ...newEmpForm, specialAllowance1: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Special Allow 2</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-slate-500" value={newEmpForm.specialAllowance2} onChange={e => setNewEmpForm({ ...newEmpForm, specialAllowance2: +e.target.value })} /></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Special Allow 3</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-slate-500" value={newEmpForm.specialAllowance3} onChange={e => setNewEmpForm({ ...newEmpForm, specialAllowance3: +e.target.value })} /></div>
                        </div>
                        <div className="mt-4 p-4 bg-emerald-900/10 border border-emerald-500/20 rounded-xl flex justify-between items-center">
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Total Gross Salary</span>
                            <span className="text-2xl font-black text-white font-mono">₹{calculateGrossWage(newEmpForm).toLocaleString()}</span>
                        </div>
                    </div>

                    <div>
                        <FormSectionHeader icon={ShieldCheck} title="6. Statutory Identity Numbers" color="text-amber-400" />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PAN No</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-amber-500 uppercase" value={newEmpForm.pan} onChange={e => setNewEmpForm({ ...newEmpForm, pan: e.target.value })} /></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aadhaar No</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-amber-500" value={newEmpForm.aadhaarNumber} onChange={e => setNewEmpForm({ ...newEmpForm, aadhaarNumber: e.target.value })} /></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">UAN No</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-amber-500" value={newEmpForm.uanc} onChange={e => setNewEmpForm({ ...newEmpForm, uanc: e.target.value })} /></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PF Number</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-amber-500" value={newEmpForm.pfNumber} onChange={e => setNewEmpForm({ ...newEmpForm, pfNumber: e.target.value })} /></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ESI Number</label><input className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-amber-500" value={newEmpForm.esiNumber} onChange={e => setNewEmpForm({ ...newEmpForm, esiNumber: e.target.value })} /></div>
                        </div>
                    </div>

                    <div>
                        <FormSectionHeader icon={ShieldAlert} title="7. Statutory Options & Exemptions" color="text-amber-400" />
                        <div className="bg-slate-900/30 p-6 rounded-xl border border-slate-800 space-y-6">
                            <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-700">
                                <div>
                                    <h4 className="text-sm font-bold text-white">A. PF Exempted (Para 69)</h4>
                                    <p className="text-[10px] text-slate-400">Employee excluded from EPF coverage. (Also disables Higher Pension)</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={newEmpForm.isPFExempt} onChange={e => {
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
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={newEmpForm.isESIExempt} onChange={e => setNewEmpForm({ ...newEmpForm, isESIExempt: e.target.checked })} />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                                </label>
                            </div>

                            <div className={`border-t border-slate-800 pt-6 space-y-4 ${newEmpForm.isPFExempt ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-400">Enable Higher Pension Option (EPS 95)</h4>
                                        <p className="text-[10px] text-slate-400">Apply for Higher Pension on Actual Wages (Joint Option).</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={newEmpForm.pfHigherPension?.enabled} onChange={e => setNewEmpForm(prev => ({ ...prev, pfHigherPension: { ...prev.pfHigherPension!, enabled: e.target.checked } }))} />
                                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                                    </label>
                                </div>

                                {newEmpForm.pfHigherPension?.enabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700 animate-in slide-in-from-top-2">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">1. Contributed on Higher Wages pre-2014?</label>
                                            <select className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-white" value={newEmpForm.pfHigherPension.contributedBefore2014} onChange={e => setNewEmpForm(prev => ({ ...prev, pfHigherPension: { ...prev.pfHigherPension!, contributedBefore2014: e.target.value as any } }))}>
                                                <option>No</option><option>Yes</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">2. EPF Membership Date (DOJ Impact)</label>
                                            <input type="date" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-white" value={newEmpForm.epfMembershipDate} onChange={e => setNewEmpForm({ ...newEmpForm, epfMembershipDate: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">3. Employee Contribution Type</label>
                                            <select className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-white" value={newEmpForm.pfHigherPension.employeeContribution} onChange={e => setNewEmpForm(prev => ({ ...prev, pfHigherPension: { ...prev.pfHigherPension!, employeeContribution: e.target.value as any } }))}>
                                                <option>Regular</option><option>Higher</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">4. Employer Contribution Type</label>
                                            <select className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-white" value={newEmpForm.pfHigherPension.employerContribution} onChange={e => setNewEmpForm(prev => ({ ...prev, pfHigherPension: { ...prev.pfHigherPension!, employerContribution: e.target.value as any } }))}>
                                                <option>Regular</option><option>Higher</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5 col-span-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">5. Joint Option Exercised?</label>
                                            <select className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs text-white" value={newEmpForm.pfHigherPension.isHigherPensionOpted} onChange={e => setNewEmpForm(prev => ({ ...prev, pfHigherPension: { ...prev.pfHigherPension!, isHigherPensionOpted: e.target.value as any } }))}>
                                                <option>No</option><option>Yes</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {editingId && (
                        <div>
                            <div className="flex items-center justify-between mb-6 border-b border-red-900/30 pb-2">
                                <div className="flex items-center gap-3">
                                    <UserMinus size={18} className="text-red-400" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-red-400">8. Separation & Final Settlement</h3>
                                </div>
                                {!isSeparationUnlocked && (
                                    <button type="button" onClick={onUnlockSeparation} className="flex items-center gap-2 text-[10px] font-bold bg-red-900/20 text-red-400 px-3 py-1.5 rounded-lg border border-red-900/30 hover:bg-red-900/40 transition-colors">
                                        <Lock size={12} /> Unlock Restricted Fields
                                    </button>
                                )}
                            </div>
                            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl border transition-all ${isSeparationUnlocked ? 'bg-red-900/10 border-red-500/30' : 'bg-slate-900/30 border-slate-800 opacity-60 pointer-events-none'}`}>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-red-300 uppercase tracking-widest">Date of Leaving (DOL)</label>
                                    <input type="date" className="w-full bg-slate-900 border border-red-900/50 rounded-xl p-3 text-sm text-white outline-none focus:border-red-500" value={newEmpForm.dol} onChange={e => setNewEmpForm({ ...newEmpForm, dol: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-red-300 uppercase tracking-widest">Reason for Leaving</label>
                                    <select
                                        id="leavingReasonInput"
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
                        <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-sm">Cancel</button>
                        <button type="submit" className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all text-sm flex items-center gap-2">
                            <Save size={18} /> Save Record
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EmployeeForm;
