
import React, { useState, useEffect } from 'react';
import {
    Building2,
    ShieldCheck,
    UserPlus,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    ShieldAlert,
    Landmark,
    MapPin,
    Mail,
    Phone,
    Globe,
    Lock,
    IndianRupee,
    Briefcase,
    AlertCircle,
    Database,
    Upload,
    Loader2,
    UserCircle
} from 'lucide-react';
import { CompanyProfile, StatutoryConfig, User } from '../types';
import { INITIAL_COMPANY_PROFILE, INITIAL_STATUTORY_CONFIG, INDIAN_STATES, NATURE_OF_BUSINESS_OPTIONS, BRAND_CONFIG } from '../constants';
import CryptoJS from 'crypto-js';

interface RegistrationProps {
    onComplete: (data: {
        companyProfile: CompanyProfile;
        statutoryConfig: StatutoryConfig;
        adminUser: User;
    }) => void;
    onRestore: () => void;
    showAlert?: (type: 'success' | 'error' | 'info' | 'warning' | 'confirm', title: string, message: string, onConfirm?: () => void) => void;
}

const Registration: React.FC<RegistrationProps> = ({ onComplete, onRestore, showAlert }) => {
    const [step, setStep] = useState(1);
    const [profile, setProfile] = useState<CompanyProfile>(INITIAL_COMPANY_PROFILE);
    const [config, setConfig] = useState<StatutoryConfig>(INITIAL_STATUTORY_CONFIG);
    const [adminPassword, setAdminPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    // Restore State
    const [showRestoreFields, setShowRestoreFields] = useState(false);
    const [encryptionKey, setEncryptionKey] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const backupFileRef = React.useRef<HTMLInputElement>(null);
    const passwordRef = React.useRef<HTMLInputElement>(null);

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Auto-focus password on start
    useEffect(() => {
        if (step === 1 && passwordRef.current) {
            passwordRef.current.focus();
        }
    }, [step]);

    const nextStep = () => {
        if (step === 1) {
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{9,}$/;

            if (!adminPassword) {
                setError('Admin password is required.');
                return;
            }
            if (adminPassword.length < 9) {
                setError('Password must be at least 9 characters long.');
                return;
            }
            if (!passwordRegex.test(adminPassword)) {
                setError('Password must contain at least one uppercase letter, one number, and one special character.');
                return;
            }
            if (adminPassword !== confirmPassword) {
                setError('Passwords do not match.');
                return;
            }
        }
        setError('');
        setStep(s => s + 1);
    };

    const prevStep = () => {
        setError('');
        if (showRestoreFields) {
            setShowRestoreFields(false);
        } else {
            setStep(s => s - 1);
        }
    };

    const executeRestore = () => {
        const file = backupFileRef.current?.files?.[0];
        if (!file || !encryptionKey) {
            setError('Please select a backup file and enter the decryption password.');
            return;
        }

        setIsProcessing(true);
        setError('');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const encryptedContent = e.target?.result as string;
                let decryptedString = '';

                try {
                    const bytes = CryptoJS.AES.decrypt(encryptedContent, encryptionKey);
                    decryptedString = bytes.toString(CryptoJS.enc.Utf8);

                    if (!decryptedString) {
                        throw new Error("Invalid Decryption Result");
                    }
                } catch (cryptoErr) {
                    throw new Error("Wrong Password or Corrupt File");
                }

                const data = JSON.parse(decryptedString);

                // Create Admin User from Step 1
                const adminUser: User = {
                    username: 'admin',
                    password: adminPassword,
                    name: 'System Administrator',
                    role: 'Administrator',
                    email: data.companyProfile?.email || data.app_company_profile?.email || 'admin@bharatpay.com'
                };

                // Clear current storage before restoration
                localStorage.clear();

                // HELPER: Get value from unified or legacy key
                const getVal = (key: string) => data[key] || data[`app_${key}`];

                // Restore Core Keys (Unified & Legacy Fallback)
                const employees = getVal('employees');
                const config = getVal('config');
                const profile = getVal('companyProfile');
                const attendance = getVal('attendance');
                const leaveLedgers = getVal('leaveLedgers');
                const advanceLedgers = getVal('advanceLedgers');
                const payrollHistory = getVal('payrollHistory');
                const fines = getVal('fines');
                const leavePolicy = getVal('leavePolicy');
                const arrearHistory = getVal('arrearHistory');
                const logo = getVal('logo');

                if (employees) localStorage.setItem('app_employees', JSON.stringify(employees));
                if (config) localStorage.setItem('app_config', JSON.stringify(config));
                if (profile) localStorage.setItem('app_company_profile', JSON.stringify(profile));
                if (attendance) localStorage.setItem('app_attendance', JSON.stringify(attendance));
                if (leaveLedgers) localStorage.setItem('app_leave_ledgers', JSON.stringify(leaveLedgers));
                if (advanceLedgers) localStorage.setItem('app_advance_ledgers', JSON.stringify(advanceLedgers));
                if (payrollHistory) localStorage.setItem('app_payroll_history', JSON.stringify(payrollHistory));
                if (fines) localStorage.setItem('app_fines', JSON.stringify(fines));
                if (leavePolicy) localStorage.setItem('app_leave_policy', JSON.stringify(leavePolicy));
                if (arrearHistory) localStorage.setItem('app_arrear_history', JSON.stringify(arrearHistory));
                if (logo) localStorage.setItem('app_logo', JSON.stringify(logo));

                const masters = data.masters || data.app_masters;
                if (masters) {
                    localStorage.setItem('app_master_designations', JSON.stringify(masters.designations));
                    localStorage.setItem('app_master_divisions', JSON.stringify(masters.divisions));
                    localStorage.setItem('app_master_branches', JSON.stringify(masters.branches));
                    localStorage.setItem('app_master_sites', JSON.stringify(masters.sites));
                }

                // Apply newly set Admin password to the restored system
                localStorage.setItem('app_users', JSON.stringify([adminUser]));
                localStorage.setItem('app_setup_complete', 'true');
                localStorage.setItem('app_session_user', JSON.stringify(adminUser));

                await delay(800);
                setIsProcessing(false);
                if (showAlert) {
                    showAlert('success', 'Restoration Complete', '✅ Your data has been restored successfully! The application will now reload to apply changes.', () => {
                        onRestore();
                    });
                } else {
                    onRestore(); // Refresh app
                }
            } catch (err: any) {
                console.error(err);
                setIsProcessing(false);
                let displayError = `Restoration Failed: ${err.message}`;
                if (err.message === "Wrong Password or Corrupt File" || err.message.includes("Malformed UTF-8") || err.message === "Invalid Decryption Result") {
                    displayError = "Incorrect decryption password or invalid backup file.";
                }
                setError(displayError);
            }
        };
        reader.readAsText(file);
    };

    const handleFinish = () => {
        if (!profile.establishmentName) {
            setError('Establishment Name is required.');
            return;
        }

        onComplete({
            companyProfile: profile,
            statutoryConfig: config,
            adminUser: {
                username: 'admin',
                password: adminPassword,
                name: 'System Administrator',
                role: 'Administrator',
                email: profile.email || 'admin@bharatpay.com'
            }
        });
    };

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center gap-4 mb-4">
            {[1, 2, 3].map((s) => (
                <React.Fragment key={s}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${step === s
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110 ring-4 ring-blue-900/10'
                        : step > s
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}>
                        {step > s ? <CheckCircle2 size={20} /> : s}
                    </div>
                    {s < 3 && <div className={`w-12 h-0.5 rounded ${step > s ? 'bg-emerald-500' : 'bg-slate-800'}`} />}
                </React.Fragment>
            ))}
        </div>
    );

    return (
        <div className="min-h-screen w-full bg-[#020617] flex items-center justify-center p-2 md:p-4 relative overflow-hidden">
            <style>
                {`
                    .no-scrollbar::-webkit-scrollbar { display: none; }
                    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                `}
            </style>
            {/* Background Decor */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-900/10 rounded-full blur-[100px]"></div>
            </div>

            {/* Registration Card */}
            <div className="w-full max-w-6xl relative z-10 bg-[#1e293b] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row md:h-[min(800px,90vh)]">

                {/* Left: Branding & Info */}
                <div className="md:w-5/12 bg-[#0f172a] p-8 md:p-10 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-800 text-center relative overflow-hidden group shrink-0">
                    <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

                    <div className="relative z-10 flex flex-col items-center gap-8">
                        {/* Logo Section */}
                        <div className="relative">
                            <div className="absolute -inset-4 bg-gradient-to-tr from-blue-600 to-emerald-600 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
                            <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-white shadow-2xl p-[6px] overflow-hidden border-4 border-[#1e293b] transform group-hover:scale-105 transition-transform duration-500">
                                <img
                                    src={BRAND_CONFIG.logoUrl}
                                    alt={BRAND_CONFIG.companyName}
                                    className="w-full h-full object-cover rounded-full"
                                />
                            </div>
                        </div>

                        {/* App Title Section */}
                        <div className="space-y-3">
                            <div className="flex flex-col items-center gap-1">
                                <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full mb-2">
                                    <IndianRupee size={16} className="text-[#FF9933]" />
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Enterprise Payroll Solutions</span>
                                </div>
                                <h1 className="text-4xl font-black tracking-tighter leading-none">
                                    <span className="text-[#FF9933] drop-shadow-sm">Bharat</span>
                                    <span className="text-white drop-shadow-md">Pay</span>
                                    <span className="text-[#4ADE80]">{BRAND_CONFIG.appNameSuffix}</span>
                                </h1>
                            </div>
                            <div className="h-1 w-24 bg-gradient-to-r from-transparent via-blue-500 to-transparent mx-auto rounded-full opacity-50"></div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em]">DECODING INDIAN LABOUR LAWS</p>
                        </div>

                        {/* Developer Section */}
                        <div className="pt-8 flex flex-col items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase opacity-60">Architected & Engineered by</span>
                            <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-900/50 border border-slate-800 rounded-2xl">
                                <span className="text-sm font-black text-[#FF9933] tracking-wide">{BRAND_CONFIG.companyName}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Registration Content */}
                <div className="flex-1 p-6 md:p-8 flex flex-col overflow-y-auto no-scrollbar">
                    <div className="mb-4 text-center flex flex-col items-center">
                        <h2 className="text-xl font-black text-white mb-1 uppercase tracking-tight">System Initialization</h2>
                        <p className="text-xs text-slate-400 max-w-sm">Complete the following steps to personalize your BharatPay Pro environment.</p>
                    </div>

                    {renderStepIndicator()}

                    {error && (
                        <div className="mb-8 p-4 bg-red-900/20 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-400 text-sm animate-in shake duration-300">
                            <AlertCircle size={20} />
                            {error}
                        </div>
                    )}

                    {/* Step 1: Administrator Registration */}
                    {step === 1 && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-blue-900/5 border border-blue-500/10 p-4 rounded-xl">
                                <div className="flex items-center gap-3 mb-2">
                                    <UserPlus className="text-blue-400" size={24} />
                                    <h3 className="font-bold text-lg">Create Administrator Account</h3>
                                </div>
                                <p className="text-sm text-slate-400 mb-4 leading-relaxed">Register your primary administrative credentials. These will be required to access the system once the setup is complete.</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Admin Username</label>
                                        <div className="relative">
                                            <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                            <input
                                                type="text"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 pl-10 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all opacity-70 cursor-not-allowed"
                                                value="admin"
                                                readOnly
                                                title="Username is fixed as 'admin'"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Admin Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                            <input
                                                ref={passwordRef}
                                                type="password"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 pl-10 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-mono"
                                                placeholder="Enter secure password"
                                                value={adminPassword}
                                                onChange={e => setAdminPassword(e.target.value)}
                                            />
                                        </div>
                                        <div className="px-1 py-1">
                                            <p className="text-[9px] text-[#FF9933] font-medium tracking-tight">
                                                Requirement: Min 9 characters, 1 Uppercase, 1 Number, 1 Special character.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="md:col-start-2 space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Confirm Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                            <input
                                                type="password"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 pl-10 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-mono"
                                                placeholder="Retype password"
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={nextStep}
                                    className="group px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xl shadow-blue-500/20 transition-all flex items-center gap-2"
                                >
                                    Register & Continue <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Choice (Restore vs Manual) */}
                    {step === 2 && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            {!showRestoreFields ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div
                                        onClick={() => setShowRestoreFields(true)}
                                        className="bg-[#0f172a] p-6 rounded-2xl border-2 border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer group flex flex-col items-center text-center"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-blue-900/20 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                            <Database size={28} />
                                        </div>
                                        <h3 className="text-lg font-bold mb-1 text-slate-100">Restore Data Backup</h3>
                                        <p className="text-xs text-slate-400 leading-relaxed px-2">Recommended if you have a backup of employees, profiles, and attendance.</p>
                                        <div className="mt-4 px-5 py-1.5 bg-blue-600 group-hover:bg-blue-700 text-white font-bold rounded-lg transition-colors text-sm">Select Backup File</div>
                                    </div>

                                    <div
                                        onClick={nextStep}
                                        className="bg-[#0f172a] p-8 rounded-2xl border-2 border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group flex flex-col items-center text-center"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-emerald-900/20 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                            <Building2 size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold mb-3 text-slate-100">Manual Configuration</h3>
                                        <p className="text-sm text-slate-400 leading-relaxed px-4">Start fresh by defining your establishment profile and statutory rules manually. Best for new installations.</p>
                                        <div className="mt-8 px-6 py-2 bg-emerald-600 group-hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors">Start Fresh Setup</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-[#1e293b]/50 border border-slate-800 p-8 rounded-2xl space-y-8 animate-in zoom-in-95 duration-200">
                                    <div className="flex items-center gap-3">
                                        <Database className="text-blue-400" size={24} />
                                        <h3 className="font-bold text-lg">Restore Data Backup</h3>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Backup File (.enc)</label>
                                            <input
                                                ref={backupFileRef}
                                                type="file"
                                                accept=".enc"
                                                title="Select Backup File"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-400 file:bg-blue-600 file:border-none file:text-white file:px-4 file:py-1.5 file:rounded-lg file:mr-4 file:font-bold hover:file:bg-blue-700"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Decryption Password</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                                <input
                                                    type="password"
                                                    value={encryptionKey}
                                                    onChange={e => setEncryptionKey(e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 pl-10 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-mono"
                                                    placeholder="Enter decryption password"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between">
                                        <button
                                            onClick={() => setShowRestoreFields(false)}
                                            className="px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
                                        >
                                            Back to Choice
                                        </button>
                                        <button
                                            onClick={executeRestore}
                                            disabled={isProcessing}
                                            className="px-10 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-xl shadow-xl shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />} Restore & Finish
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!showRestoreFields && (
                                <button
                                    onClick={prevStep}
                                    className="mt-4 text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-2"
                                >
                                    <ArrowLeft size={16} /> Back to Administration Step
                                </button>
                            )}
                        </div>
                    )}

                    {/* Step 3: Company Profile */}
                    {step === 3 && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-[#1e293b]/50 border border-slate-800 p-4 rounded-2xl space-y-4">
                                <div className="flex items-center gap-3 mb-1">
                                    <Building2 className="text-amber-400" size={24} />
                                    <h3 className="font-bold text-lg">Establishment Details</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Establishment Name *</label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-amber-500/50 outline-none transition-all"
                                            placeholder="e.g. Bharat Solutions Private Limited"
                                            value={profile.establishmentName}
                                            onChange={e => setProfile({ ...profile, establishmentName: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">City</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                            <input
                                                type="text"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 pl-10 text-white focus:ring-2 focus:ring-amber-500/50 outline-none transition-all"
                                                placeholder="e.g. Chennai"
                                                value={profile.city}
                                                onChange={e => setProfile({ ...profile, city: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">State</label>
                                        <select
                                            title="Select State"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-amber-500/50 outline-none transition-all"
                                            value={profile.state}
                                            onChange={e => setProfile({ ...profile, state: e.target.value })}
                                        >
                                            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Nature of Business</label>
                                        <select
                                            title="Nature of Business"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-amber-500/50 outline-none transition-all"
                                            value={profile.natureOfBusiness}
                                            onChange={e => setProfile({ ...profile, natureOfBusiness: e.target.value })}
                                        >
                                            {NATURE_OF_BUSINESS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Email (Official)</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                            <input
                                                type="email"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 pl-10 text-white focus:ring-2 focus:ring-amber-500/50 outline-none transition-all"
                                                placeholder="hr@company.com"
                                                value={profile.email}
                                                onChange={e => setProfile({ ...profile, email: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between">
                                <button
                                    onClick={prevStep}
                                    className="px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all flex items-center gap-2"
                                >
                                    <ArrowLeft size={20} /> Back
                                </button>
                                <button
                                    onClick={nextStep}
                                    className="group px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xl shadow-blue-500/20 transition-all flex items-center gap-2"
                                >
                                    Statutory Setup <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Statutory (New step index because of choice) */}
                    {step === 4 && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-emerald-900/5 border border-emerald-500/10 p-4 rounded-xl space-y-3">
                                    <div className="flex items-center gap-3">
                                        <ShieldCheck className="text-emerald-400" size={20} />
                                        <h3 className="font-bold text-sm">PF & ESI Configuration</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-500 uppercase">EPF Ceiling (₹)</label>
                                            <input
                                                type="number"
                                                title="EPF Ceiling"
                                                placeholder="15000"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono"
                                                value={config.epfCeiling}
                                                onChange={e => setConfig({ ...config, epfCeiling: +e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">ESI Ceiling (₹)</label>
                                            <input
                                                type="number"
                                                title="ESI Ceiling"
                                                placeholder="21000"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono"
                                                value={config.esiCeiling}
                                                onChange={e => setConfig({ ...config, esiCeiling: +e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-sky-900/5 border border-sky-500/10 p-4 rounded-xl space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Landmark className="text-sky-400" size={20} />
                                        <h3 className="font-bold text-sm">Professional Tax</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-2 bg-slate-950/50 rounded-lg border border-slate-800">
                                            <span className="text-xs text-slate-300">Enable PT Calculation</span>
                                            <input
                                                type="checkbox"
                                                title="Enable Professional Tax"
                                                className="w-5 h-5 accent-sky-500"
                                                checked={config.enableProfessionalTax}
                                                onChange={e => setConfig({ ...config, enableProfessionalTax: e.target.checked })}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500 italic">Default slabs are set for {profile.state}. You can refine these later in Configuration.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-900/5 border border-amber-500/10 p-4 rounded-xl flex gap-3">
                                <ShieldAlert className="text-amber-500 shrink-0" size={20} />
                                <div>
                                    <p className="text-xs font-bold text-amber-200">Legal Compliance Disclaimer</p>
                                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">By finalizing, you acknowledge that initial payroll parameters are set as per standard Indian Labour Laws. You can customize these at any time in the Configuration panel.</p>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4">
                                <button
                                    onClick={prevStep}
                                    className="px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all flex items-center gap-2"
                                >
                                    <ArrowLeft size={20} /> Back
                                </button>
                                <button
                                    onClick={handleFinish}
                                    className="px-10 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black uppercase tracking-widest rounded-xl shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2"
                                >
                                    Complete Registration <CheckCircle2 size={20} />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
                        Powered by <span className="text-slate-300">BharatPay Pro</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Registration;
