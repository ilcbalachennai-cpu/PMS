
import React, { useState, useEffect } from 'react';
import {
    Building2,
    ShieldCheck,
    UserPlus,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    ShieldAlert,
    Mail,
    Phone,
    Lock,
    IndianRupee,
    AlertCircle,
    Database,
    Upload,
    Loader2,
    UserCircle,
    Power
} from 'lucide-react';
import { CompanyProfile, StatutoryConfig, User } from '../types';
import { INITIAL_COMPANY_PROFILE, INITIAL_STATUTORY_CONFIG, BRAND_CONFIG } from '../constants';
import { activateFullLicense, registerTrial, isValidKeyFormat } from '../services/licenseService';
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
    const [userName, setUserName] = useState('');
    const [userID, setUserID] = useState('');
    const [licenseKey, setLicenseKey] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regMobile, setRegMobile] = useState('');
    const [_profile, setProfile] = useState<CompanyProfile>(INITIAL_COMPANY_PROFILE);
    const [_config] = useState<StatutoryConfig>(INITIAL_STATUTORY_CONFIG);
    const [adminPassword, setAdminPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    // Restore State
    const [showRestoreFields, setShowRestoreFields] = useState(false);
    const [encryptionKey, setEncryptionKey] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const backupFileRef = React.useRef<HTMLInputElement>(null);
    const passwordRef = React.useRef<HTMLInputElement>(null);
    const decryptPasswordRef = React.useRef<HTMLInputElement>(null);

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Clear error when inputs change
    useEffect(() => {
        setError('');
    }, [userName, userID, regEmail, regMobile, adminPassword, confirmPassword, encryptionKey]);

    // Auto-focus on step change
    useEffect(() => {
        const timer = setTimeout(() => {
            if (step === 1 && nameInputRef.current) {
                nameInputRef.current.focus();
            } else if (step === 2 && passwordRef.current) {
                passwordRef.current.focus();
            }
        }, 50); // Immediate focus
        return () => clearTimeout(timer);
    }, [step]);

    const nameInputRef = React.useRef<HTMLInputElement>(null);

    const nextStep = async () => {
        if (step === 1) {
            if (!userName) {
                setError('Full Name is required.');
                return;
            }
            if (!userID) {
                setError('User ID is required.');
                return;
            }
            if (!regEmail || !regEmail.includes('@')) {
                setError('A valid registered email is required.');
                return;
            }
            if (regMobile.length < 10) {
                setError('A valid mobile number is required.');
                return;
            }

            setIsProcessing(true);
            let result;

            if (licenseKey) {
                // Attempt Full License Activation
                if (!isValidKeyFormat(licenseKey)) {
                    setError('Please enter a valid 16-digit license key.');
                    setIsProcessing(false);
                    return;
                }
                result = await activateFullLicense(userName, userID, licenseKey, regEmail, regMobile);
            } else {
                // Attempt Trial Registration
                result = await registerTrial(userName, userID, regEmail, regMobile);
            }

            setIsProcessing(false);

            if (!result.success) {
                setError(result.message || 'Verification Failed.');
                if (result.message?.includes('Unauthorised')) {
                    // Force shutdown as per user request for unauthorized access
                    setTimeout(() => {
                        // @ts-ignore
                        window.electronAPI.closeApp();
                    }, 3000);
                }
                return;
            }

            if (showAlert && result.message) {
                showAlert('success', 'Verified', result.message);
            }

            // Auto-fill profile email from reg email
            setProfile(prev => ({ ...prev, email: regEmail }));
        }

        if (step === 2) {
            // Relaxed regex: 1 Upper, 1 Lower, 1 Num, 1 Special (wide range), 9+ chars
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{9,}$/;

            if (!adminPassword) {
                setError('Admin password is required.');
                containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            if (adminPassword.length < 9) {
                setError('Password is too short. It must be at least 9 characters long.');
                containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            if (!passwordRegex.test(adminPassword)) {
                setError('Password requirement not met: One uppercase, one lowercase, one number, and one special character are required.');
                containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            if (adminPassword !== confirmPassword) {
                setError('Passwords do not match. Please retype them.');
                containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if (showAlert) {
                showAlert('success', 'Credentials Set', 'Administrator password has been configured successfully.');
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
        setIsProcessing(true); // Immediate feedback
        setError('');

        console.log("🏦 Restore Process Initiated...");

        const file = backupFileRef.current?.files?.[0];
        if (!file) {
            console.warn("⚠️ No backup file selected.");
            setError('Please select a backup file first.');
            setIsProcessing(false);
            return;
        }

        if (!encryptionKey) {
            console.warn("⚠️ No decryption password provided.");
            setError('Decryption password is required to unlock this backup.');
            setIsProcessing(false);
            return;
        }

        if (!adminPassword) {
            console.warn("⚠️ Admin credentials lost.");
            setError('Admin credentials from the previous step were not found. Please go back and re-enter your administrator details.');
            setIsProcessing(false);
            return;
        }

        const reader = new FileReader();

        reader.onerror = (err) => {
            console.error("❌ FileReader Error:", err);
            setIsProcessing(false);
            setError('Failed to read the backup file. It might be in use by another program.');
        };

        reader.onload = async (e) => {
            console.log("📄 Backup file loaded into memory. Length:", (e.target?.result as string).length);
            try {
                const encryptedContent = e.target?.result as string;
                if (!encryptedContent) throw new Error("File is empty or corrupt");

                let decryptedString = '';
                try {
                    const bytes = CryptoJS.AES.decrypt(encryptedContent, encryptionKey);
                    decryptedString = bytes.toString(CryptoJS.enc.Utf8);

                    if (!decryptedString || decryptedString.length < 10) {
                        throw new Error("Invalid Decryption Result");
                    }
                } catch (cryptoErr) {
                    console.error("Decryption Error:", cryptoErr);
                    throw new Error("Incorrect Password: Could not decrypt the file.");
                }

                let data;
                try {
                    data = JSON.parse(decryptedString);
                } catch (parseErr) {
                    throw new Error("Invalid Format: Decrypted data is not a valid backup.");
                }

                // Create Admin User from state (collected in Step 2)
                const adminUser: User = {
                    username: userID || 'admin',
                    password: adminPassword,
                    name: userName || 'System Administrator',
                    role: 'Administrator',
                    email: data.companyProfile?.email || data.app_company_profile?.email || 'admin@bharatpay.com'
                };

                // Backup EVERYTHING critical before clearing (Strict Preservation)
                const currentLicense = localStorage.getItem('app_license_secure');
                const lastCheck = localStorage.getItem('app_license_last_check');
                const mid = localStorage.getItem('app_machine_id');
                const size = localStorage.getItem('app_data_size');

                // Surgical Clear: Remove only data keys, PROTECT system and identity keys
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('app_')) {
                        const isSystemKey = key.includes('license') ||
                            key === 'app_machine_id' ||
                            key === 'app_setup_complete' ||
                            key === 'app_data_size';
                        if (!isSystemKey) {
                            localStorage.removeItem(key);
                        }
                    }
                });

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

                // Ensure License and Machine identity are still correct (re-apply to be safe)
                if (currentLicense) localStorage.setItem('app_license_secure', currentLicense);
                if (lastCheck) localStorage.setItem('app_license_last_check', lastCheck);
                if (mid) localStorage.setItem('app_machine_id', mid);
                if (size) localStorage.setItem('app_data_size', size);

                // Apply newly set Admin password to the restored system
                localStorage.setItem('app_users', JSON.stringify([adminUser]));
                localStorage.setItem('app_setup_complete', 'true');
                sessionStorage.setItem('app_session_user', JSON.stringify(adminUser));

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
                console.error("Restore Execution Failed:", err);
                setIsProcessing(false);
                setError(err.message || "An unexpected error occurred during restoration.");
                containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };
        reader.readAsText(file);
    };


    const handleFreshSetup = () => {
        setIsProcessing(true);
        // Pre-fill empty data to bypass steps 4 and 5
        onComplete({
            companyProfile: INITIAL_COMPANY_PROFILE,
            statutoryConfig: INITIAL_STATUTORY_CONFIG,
            adminUser: {
                username: userID || 'admin',
                password: adminPassword,
                name: userName || 'System Administrator',
                role: 'Administrator',
                email: regEmail || 'admin@bharatpay.com'
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
                {/* Quit Application Button */}
                <button
                    onClick={() => (window as any).electronAPI?.closeApp()}
                    className="absolute top-6 right-6 z-20 p-2.5 bg-slate-800/50 hover:bg-red-600/10 text-red-500 hover:text-red-400 rounded-xl border border-slate-700 hover:border-red-500/50 transition-all flex items-center gap-2 group"
                    title="Quit Application"
                >
                    <Power size={18} className="group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest px-1 hidden md:block">Quit Application</span>
                </button>

                {/* Left: Branding & Info */}
                <div className="md:w-5/12 bg-[#0f172a] p-8 md:p-10 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-800 text-center relative overflow-hidden group shrink-0">
                    <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

                    <div className="relative z-10 flex flex-col items-center gap-8">
                        {/* Logo Section */}
                        <div className="relative">
                            <div className="absolute -inset-4 bg-gradient-to-tr from-blue-600 to-emerald-600 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
                            <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-transparent shadow-2xl overflow-hidden border-4 border-white transform group-hover:scale-105 transition-transform duration-500">
                                <img
                                    src={BRAND_CONFIG.logoUrl}
                                    alt={BRAND_CONFIG.companyName}
                                    className="w-full h-full object-cover"
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
                        </div>

                        {/* Developer Section */}
                        <div className="pt-4 flex flex-col items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase opacity-60">Architected & Engineered by</span>
                            <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-900/50 border border-slate-800 rounded-2xl">
                                <span className="text-sm font-black text-[#FF9933] tracking-wide">{BRAND_CONFIG.companyName}</span>
                            </div>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Decoding Indian Labour Laws</p>
                        </div>
                    </div>
                </div>

                {/* Right: Registration Content */}
                <div ref={containerRef} className="flex-1 p-6 md:p-8 flex flex-col overflow-y-auto no-scrollbar">
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

                    {/* Step 1: License Activation */}
                    {step === 1 && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-blue-900/10 border border-blue-500/20 p-6 rounded-2xl">
                                <div className="flex items-center gap-3 mb-4">
                                    <ShieldCheck className="text-blue-400" size={28} />
                                    <h3 className="font-bold text-xl text-white">License Activation</h3>
                                </div>
                                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                                    Please enter your 16-digit license key and registered contact details. The application will be tied to this machine's hardware ID.
                                </p>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Full Name / Authorized Person *</label>
                                            <div className="relative">
                                                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                                <input
                                                    ref={nameInputRef}
                                                    type="text"
                                                    autoFocus
                                                    title="Full Name / Authorized Person"
                                                    aria-label="Full Name / Authorized Person"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 pl-10 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all uppercase placeholder:normal-case placeholder:text-slate-500"
                                                    placeholder="Your Name - as mentioned in App request mail"
                                                    value={userName}
                                                    onChange={e => setUserName(e.target.value.toUpperCase())}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">User ID *</label>
                                            <div className="relative">
                                                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                                <input
                                                    type="text"
                                                    title="User ID"
                                                    aria-label="User ID"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 pl-10 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-slate-500"
                                                    placeholder="Enter your User ID"
                                                    value={userID}
                                                    onChange={e => setUserID(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">License Key (Leave empty for Trial)</label>
                                            <input
                                                type="text"
                                                title="License Key"
                                                aria-label="License Key"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white font-mono text-center tracking-[0.2em] focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-slate-500"
                                                placeholder="XXXX-XXXX-XXXX-XXXX"
                                                value={licenseKey}
                                                onChange={e => setLicenseKey(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 16))}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Registered Email ID</label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                                <input
                                                    type="email"
                                                    title="Registered Email ID"
                                                    aria-label="Registered Email ID"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 pl-10 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-slate-500"
                                                    placeholder="mail@example.com"
                                                    value={regEmail}
                                                    onChange={e => setRegEmail(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Mobile Number</label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                                <input
                                                    type="tel"
                                                    title="Mobile Number"
                                                    aria-label="Mobile Number"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 pl-10 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-slate-500"
                                                    placeholder="9876543210"
                                                    value={regMobile}
                                                    onChange={e => setRegMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={nextStep}
                                    disabled={isProcessing}
                                    className="group px-10 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-xl shadow-2xl shadow-blue-500/20 transition-all flex items-center gap-3"
                                >
                                    {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <>Verify & Activate <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" /></>}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Administrator Registration */}
                    {step === 2 && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-blue-900/5 border border-blue-500/10 p-4 rounded-xl">
                                <div className="flex items-center gap-3 mb-2">
                                    <UserPlus className="text-blue-400" size={24} />
                                    <h3 className="font-bold text-lg">Create Administrator Account</h3>
                                </div>
                                <p className="text-sm text-slate-400 mb-4 leading-relaxed">Register your primary administrative credentials. These will be required to access the system once the setup is complete.</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">UserID (Login ID)</label>
                                        <div className="relative group">
                                            <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 opacity-60" size={18} />
                                            <input
                                                type="text"
                                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-3.5 pl-10 text-slate-400 font-bold cursor-not-allowed select-none transition-all"
                                                value={userID}
                                                readOnly
                                                disabled
                                                title={`Username is permanently set to: ${userID}`}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                <span className="text-[9px] font-black text-blue-500/50 uppercase tracking-tighter">Read Only</span>
                                                <Lock size={14} className="text-slate-700" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Set Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                            <input
                                                ref={passwordRef}
                                                type="password"
                                                autoFocus
                                                title="Set Password"
                                                aria-label="Set Password"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 pl-10 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-mono placeholder:text-slate-500 placeholder:font-sans"
                                                placeholder="Enter secure password"
                                                value={adminPassword}
                                                onChange={e => setAdminPassword(e.target.value)}
                                            />
                                        </div>
                                        <div className="mt-2 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-2">
                                            <div className="flex items-center gap-2 text-blue-400">
                                                <ShieldAlert size={14} />
                                                <span className="text-[9px] font-black uppercase tracking-widest">Password Complexity Rules</span>
                                            </div>
                                            <ul className="text-[9px] text-slate-400 font-medium grid grid-cols-2 gap-x-4 gap-y-1 list-disc pl-4">
                                                <li>At least 9 characters</li>
                                                <li>One Capital Letter (A-Z)</li>
                                                <li>One Small Letter (a-z)</li>
                                                <li>One Numeric (0-9)</li>
                                                <li className="col-span-2">One Special Character (@, #, $, %, etc.)</li>
                                            </ul>
                                        </div>
                                    </div>
                                    <div className="md:col-start-2 space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Confirm Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                            <input
                                                type="password"
                                                title="Confirm Password"
                                                aria-label="Confirm Password"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 pl-10 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-mono placeholder:text-slate-500 placeholder:font-sans"
                                                placeholder="Retype password"
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
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
                                    Register & Continue <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Choice (Restore vs Manual) */}
                    {step === 3 && (
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
                                        onClick={handleFreshSetup}
                                        className="bg-[#0f172a] p-8 rounded-2xl border-2 border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group flex flex-col items-center text-center"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-emerald-900/20 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                            <Building2 size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold mb-3 text-slate-100">Manual Configuration</h3>
                                        <p className="text-sm text-slate-400 leading-relaxed px-4">Start fresh by defining your establishment profile and statutory rules manually. Best for new installations.</p>
                                        <div className="mt-8 px-6 py-2 bg-emerald-600 group-hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2">Start Fresh Setup <ArrowRight size={16} /></div>
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
                                                onChange={(e) => {
                                                    if (e.target.files && e.target.files.length > 0) {
                                                        // Auto-focus the password field after selecting a file
                                                        setTimeout(() => decryptPasswordRef.current?.focus(), 100);
                                                    }
                                                }}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Decryption Password</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                                <input
                                                    ref={decryptPasswordRef}
                                                    type="password"
                                                    value={encryptionKey}
                                                    onChange={e => setEncryptionKey(e.target.value)}
                                                    title="Decryption Password"
                                                    aria-label="Decryption Password"
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

                    <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
                        Powered by <span className="text-slate-300">BharatPay Pro</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Registration;
