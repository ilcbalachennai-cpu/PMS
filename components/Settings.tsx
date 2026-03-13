
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Save, AlertCircle, RefreshCw, Building2, ShieldCheck, HelpCircle, Upload, Image as ImageIcon, ScrollText, Trash2, Plus, MapPin, AlertTriangle, CalendarClock, X, KeyRound, Download, Lock, FileText, Phone, Mail, Globe, Briefcase, Database, Loader2, CheckCircle2, Megaphone, HandCoins, MessageSquare, Landmark, Percent, Table, Heart, Camera, Cloud, CheckSquare, Square, Calculator, Wallet, ArrowRight, UserPlus, Eye, EyeOff, Users, Edit2 } from 'lucide-react';
import { StatutoryConfig, PFComplianceType, LeavePolicy, CompanyProfile, User } from '../types';
import { PT_STATE_PRESETS, INDIAN_STATES, NATURE_OF_BUSINESS_OPTIONS, LWF_STATE_PRESETS, INITIAL_STATUTORY_CONFIG, INITIAL_COMPANY_PROFILE } from '../constants';
import CryptoJS from 'crypto-js';
import { fetchLatestMessages, activateFullLicense, getStoredLicense, isValidKeyFormat } from '../services/licenseService';
import { LicenseData } from '../types';

interface SettingsProps {
    config: StatutoryConfig;
    setConfig: (config: StatutoryConfig) => void;
    companyProfile: CompanyProfile;
    setCompanyProfile: (profile: CompanyProfile) => void;
    currentLogo: string;
    setLogo: (url: string) => void;
    leavePolicy: LeavePolicy;
    setLeavePolicy: (policy: LeavePolicy) => void;
    onRestore: () => void;
    onNuclearReset: () => void;
    initialTab?: 'STATUTORY' | 'COMPANY' | 'DATA' | 'DEVELOPER' | 'LICENSE' | 'USERS';
    userRole?: string;
    currentUser?: User;
    isSetupMode?: boolean;
    onSkipSetupRedirect?: () => void;
    showAlert?: (type: any, title: string, message: string, onConfirm?: () => void) => void;
}

const Settings: React.FC<SettingsProps> = ({ config, setConfig, companyProfile, setCompanyProfile, currentLogo, setLogo, leavePolicy, setLeavePolicy, onRestore, onNuclearReset, initialTab = 'STATUTORY', userRole, currentUser, isSetupMode = false, onSkipSetupRedirect, showAlert }) => {
    const [activeTab, setActiveTab] = useState<'STATUTORY' | 'COMPANY' | 'DATA' | 'DEVELOPER' | 'LICENSE' | 'USERS'>(isSetupMode ? 'COMPANY' : initialTab);

    // SCHEMA MIGRATION: Merge current config with defaults to prevent crashes on new features
    const [formData, setFormData] = useState<StatutoryConfig>(() => {
        return {
            ...INITIAL_STATUTORY_CONFIG,
            ...config,
            higherContributionComponents: {
                ...INITIAL_STATUTORY_CONFIG.higherContributionComponents,
                ...config.higherContributionComponents
            },
            leaveWagesComponents: {
                ...INITIAL_STATUTORY_CONFIG.leaveWagesComponents,
                ...config.leaveWagesComponents
            },
            incomeTaxCalculationType: config.incomeTaxCalculationType || INITIAL_STATUTORY_CONFIG.incomeTaxCalculationType
        };
    });

    const [profileData, setProfileData] = useState(companyProfile);
    const [localLeavePolicy, setLocalLeavePolicy] = useState(leavePolicy);
    const [saved, setSaved] = useState(false);
    const [selectedStatePreset, setSelectedStatePreset] = useState<string>('Tamil Nadu');
    const [selectedLWFState, setSelectedLWFState] = useState<string>('Tamil Nadu');

    const logoInputRef = useRef<HTMLInputElement>(null);

    const hasData = useMemo(() => {
        try {
            const emps = JSON.parse(localStorage.getItem('app_employees') || '[]');
            return Array.isArray(emps) && emps.length > 0;
        } catch (e) {
            return false;
        }
    }, []);

    useEffect(() => {
        setActiveTab(isSetupMode ? 'COMPANY' : initialTab);
    }, [initialTab, isSetupMode]);

    const [showResetModal, setShowResetModal] = useState(false);
    const [showPayrollResetModal, setShowPayrollResetModal] = useState(false);
    const [resetPassword, setResetPassword] = useState('');
    const [resetError, setResetError] = useState('');

    const [showBackupModal, setShowBackupModal] = useState(false);
    const [encryptionKey, setEncryptionKey] = useState('');
    const [backupMode, setBackupMode] = useState<'EXPORT' | 'IMPORT'>('EXPORT');
    const backupFileRef = useRef<HTMLInputElement>(null);

    const [selectedBackupFile, setSelectedBackupFile] = useState<File | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authPassword, setAuthPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [pendingAuthAction, setPendingAuthAction] = useState<(() => void) | null>(null);

    const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

    const [isProcessing, setIsProcessing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isActivating, setIsActivating] = useState(false);
    const [processProgress, setProcessProgress] = useState(0);
    const [processStatus, setProcessStatus] = useState('');
    const [isSqliteFile, setIsSqliteFile] = useState(false);

    // License Management State
    const [licenseInfo, setLicenseInfo] = useState<LicenseData | null>(() => getStoredLicense());
    const [newLicenseKey, setNewLicenseKey] = useState('');
    const [newUserName, setNewUserName] = useState(licenseInfo?.userName || '');
    const [newRegEmail, setNewRegEmail] = useState('');
    const [newRegMobile, setNewRegMobile] = useState('');
    const [newUserID, setNewUserID] = useState(licenseInfo?.userID || '');
    const [currentMachineId, setCurrentMachineId] = useState('');
    const fullNameRef = useRef<HTMLInputElement>(null);

    // ── User Management State ──
    const [appUsers, setAppUsers] = useState<User[]>(() => {
        try { return JSON.parse(localStorage.getItem('app_users') || '[]'); } catch { return []; }
    });
    const [umForm, setUmForm] = useState({ name: '', username: '', password: '', role: 'User' as 'Administrator' | 'User' });
    const [umEditId, setUmEditId] = useState<string | null>(null);
    const [umShowPwd, setUmShowPwd] = useState(false);
    const [umError, setUmError] = useState('');
    const umNameRef = useRef<HTMLInputElement>(null);

    const saveAppUsers = (users: User[]) => {
        setAppUsers(users);
        localStorage.setItem('app_users', JSON.stringify(users));
        // @ts-ignore
        if (window.electronAPI) window.electronAPI.dbSet('app_users', users);
    };

    const handleUmSave = () => {
        setUmError('');
        if (!umForm.name.trim() || !umForm.username.trim() || !umForm.password.trim()) {
            setUmError('All fields are required.'); return;
        }

        const cleanUsername = umForm.username.trim().toLowerCase();
        const existing = appUsers.find(u => u.username.toLowerCase() === cleanUsername && u.username.toLowerCase() !== umEditId?.toLowerCase());
        if (existing) { setUmError('Username already exists.'); return; }

        if (umEditId) {
            // Edit mode — update the matched user
            const updated = appUsers.map(u => u.username.toLowerCase() === umEditId.toLowerCase() ? { ...u, name: umForm.name.trim(), username: cleanUsername, password: umForm.password, role: umForm.role } : u);
            saveAppUsers(updated);
        } else {
            // Add new user
            const newUser: User = { name: umForm.name.trim(), username: cleanUsername, password: umForm.password, role: umForm.role, email: '' };
            saveAppUsers([...appUsers, newUser]);
        }
        setUmForm({ name: '', username: '', password: '', role: 'User' });
        setUmEditId(null);
        setUmShowPwd(false);
    };

    const handleUmEdit = (u: User) => {
        setUmForm({ name: u.name, username: u.username, password: u.password ?? '', role: (u.role === 'Administrator' ? 'Administrator' : 'User') });
        setUmEditId(u.username);
        setUmShowPwd(false);
        setUmError('');
        setTimeout(() => umNameRef.current?.focus(), 100);
    };

    const handleUmDelete = (username: string) => {
        if (username === currentUser?.username) { setUmError("You cannot delete your own account."); return; }
        saveAppUsers(appUsers.filter(u => u.username !== username));
    };


    // License Form Synchronization
    useEffect(() => {
        if (licenseInfo) {
            setNewRegEmail(licenseInfo.registeredTo || '');
            setNewRegMobile(licenseInfo.registeredMobile || '');
            setNewUserName(licenseInfo.userName || '');
            setNewUserID(licenseInfo.userID || '');
        }
    }, [licenseInfo]);

    // License Activation Focus
    useEffect(() => {
        if (activeTab === 'LICENSE') {
            setTimeout(() => fullNameRef.current?.focus(), 400);
        }
    }, [activeTab]);

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const requireAuth = (callback: () => void) => {
        setPendingAuthAction(() => callback);
        setAuthPassword('');
        setAuthError('');
        setShowAuthModal(true);
    };

    const handleAuthSubmit = () => {
        const isAuthorized = (isSetupMode && (authPassword === 'setup' || authPassword === '')) || (authPassword === currentUser?.password);
        if (isAuthorized) {
            setShowAuthModal(false);
            if (pendingAuthAction) {
                pendingAuthAction();
            }
            setPendingAuthAction(null);
        } else {
            setAuthError(isSetupMode ? 'Incorrect Setup Password' : 'Incorrect Login Password');
        }
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogo(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEncryptedExport = async () => {
        if (!encryptionKey) {
            showAlert?.('warning', 'Security Required', 'Please enter a secure password to encrypt your data file.');
            return;
        }

        setIsProcessing(true);
        setProcessProgress(50);
        setProcessStatus('Processing...');

        try {
            const rawLogo = localStorage.getItem('app_logo');
            let processedLogo = rawLogo;
            if (rawLogo && rawLogo.startsWith('"')) {
                try { processedLogo = JSON.parse(rawLogo); } catch (e) { }
            }

            const dataBundle = {
                employees: JSON.parse(localStorage.getItem('app_employees') || '[]'),
                config: JSON.parse(localStorage.getItem('app_config') || '{}'),
                companyProfile: JSON.parse(localStorage.getItem('app_company_profile') || '{}'),
                attendance: JSON.parse(localStorage.getItem('app_attendance') || '[]'),
                leaveLedgers: JSON.parse(localStorage.getItem('app_leave_ledgers') || '[]'),
                advanceLedgers: JSON.parse(localStorage.getItem('app_advance_ledgers') || '[]'),
                payrollHistory: JSON.parse(localStorage.getItem('app_payroll_history') || '[]'),
                fines: JSON.parse(localStorage.getItem('app_fines') || '[]'), // Include Fines
                leavePolicy: JSON.parse(localStorage.getItem('app_leave_policy') || '{}'), // Include Leave Policy
                arrearHistory: JSON.parse(localStorage.getItem('app_arrear_history') || '[]'), // Include Arrear History
                users: JSON.parse(localStorage.getItem('app_users') || '[]'), // Include Users for login restore
                developerMetadata: {
                    lastNewsDate: localStorage.getItem('app_last_news_date') || "",
                    lastStatutoryDate: localStorage.getItem('app_last_statutory_date') || ""
                },
                masters: {
                    designations: JSON.parse(localStorage.getItem('app_master_designations') || '[]'),
                    divisions: JSON.parse(localStorage.getItem('app_master_divisions') || '[]'),
                    branches: JSON.parse(localStorage.getItem('app_master_branches') || '[]'),
                    sites: JSON.parse(localStorage.getItem('app_master_sites') || '[]'),
                },
                logo: processedLogo,
                timestamp: new Date().toISOString()
            };

            const jsonString = JSON.stringify(dataBundle);
            const encrypted = CryptoJS.AES.encrypt(jsonString, encryptionKey).toString();

            const blob = new Blob([encrypted], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            const today = new Date();
            let fyStart = today.getFullYear();
            if (today.getMonth() < 3) {
                fyStart = fyStart - 1;
            }
            const fyEnd = fyStart + 1;
            const compName = companyProfile.establishmentName ? companyProfile.establishmentName.replace(/[^a-zA-Z0-9]/g, '_') : 'Company';

            a.download = `${compName}_Backup_${fyStart}-${fyEnd}.enc`;

            // @ts-ignore
            if (window.electronAPI && window.electronAPI.runBackup) {
                setProcessStatus('Saving to BharatPP location...');
                // @ts-ignore
                const res = await window.electronAPI.runBackup(encrypted);
                if (res.success) {
                    setProcessProgress(100);
                    setProcessStatus('Backup Saved Successfully');
                    showAlert?.('success', 'Safe Local Backup Created', `Your data has been encrypted and saved to the BharatPP/Data backup directory as: ${res.fileName}`);
                } else {
                    throw new Error(res.error || "Failed to save file to BharatPP directory.");
                }
            } else {
                // Fallback for Web/Browser
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                setProcessProgress(100);
                setProcessStatus('Export Complete');
            }

            setTimeout(() => {
                setShowBackupModal(false);
                setEncryptionKey('');
                setIsProcessing(false);
            }, 1500);

        } catch (e: any) {
            console.error(e);
            setIsProcessing(false);
            showAlert?.('error', 'Export Failed', e.message || 'Encryption failed. Please try again.');
        }
    };

    const executeImport = async () => {
        const file = selectedBackupFile;
        // Optimization: SQLite files don't need decryption password
        if (!file || (!encryptionKey && !isSqliteFile)) {
            showAlert?.('warning', 'Missing Information', 'Please select a file and enter the decryption password.');
            return;
        }

        setIsProcessing(true);
        setProcessProgress(0);

        // Immediate logic for SQLite restoration to avoid unnecessary FileReader overhead
        if (isSqliteFile) {
            try {
                setProcessStatus('Restoring Database File...');
                setProcessProgress(40);
                // @ts-ignore
                const res = await window.electronAPI.restoreSqliteBackup((file as any).path);
                if (res.success) {
                    setProcessProgress(100);
                    setProcessStatus('Database Restored Successfully!');

                    // CRITICAL FIX: Extract all relevant data from the newly restored SQLite database
                    // and populate localStorage. This ensures the app reloads with the restored state
                    // without losing critical un-backed-up system keys (like partial older backups).
                    const dataKeys = [
                        'app_employees', 'app_config', 'app_company_profile',
                        'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 'app_payroll_history',
                        'app_fines', 'app_leave_policy', 'app_arrear_history', 'app_logo',
                        'app_master_designations', 'app_master_divisions', 'app_master_branches', 'app_master_sites'
                    ];

                    const systemKeys = [
                        'app_license_secure', 'app_data_size', 'app_machine_id', 'app_setup_complete', 'app_users'
                    ];

                    for (const k of dataKeys) {
                        // @ts-ignore
                        const dbRes = await window.electronAPI.dbGet(k);
                        if (dbRes.success && dbRes.data !== null && dbRes.data !== undefined) {
                            localStorage.setItem(k, typeof dbRes.data === 'string' ? dbRes.data : JSON.stringify(dbRes.data));
                        } else {
                            localStorage.removeItem(k); // If it's a data key missing in DB, it wasn't there at backup time
                        }
                    }

                    for (const k of systemKeys) {
                        // @ts-ignore
                        const dbRes = await window.electronAPI.dbGet(k);
                        if (dbRes.success && dbRes.data !== null && dbRes.data !== undefined) {
                            localStorage.setItem(k, typeof dbRes.data === 'string' ? dbRes.data : JSON.stringify(dbRes.data));
                        }
                        // We DO NOT remove systemKeys if missing in DB, to prevent breaking license/login on older backups.
                    }


                    await delay(500);
                    setIsProcessing(false);
                    setShowBackupModal(false);
                    setSelectedBackupFile(null);
                    setEncryptionKey('');
                    setTimeout(() => {
                        showAlert?.('success', 'System Restore Successful', (
                            <div className="space-y-3 text-left">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                                        <CheckCircle2 size={24} className="text-emerald-400" />
                                    </div>
                                    <h4 className="text-lg font-black text-white uppercase tracking-tighter">Restore Complete</h4>
                                </div>
                                <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-2">
                                    <p className="text-xs text-slate-300 leading-relaxed font-medium italic">
                                        "Your entire establishment profile, payroll history, and system configurations have been successfully recovered from the backup vault."
                                    </p>
                                    <div className="h-px bg-slate-800/80 w-full" />
                                    <p className="text-[10px] text-slate-500 font-mono break-all">{file.name}</p>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                    <AlertCircle size={14} className="text-amber-500 shrink-0" />
                                    <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Session Reload Required to Finalize</p>
                                </div>
                            </div>
                        ) as any, () => {
                            onRestore();
                        });
                    }, 100);
                    return;
                } else {
                    throw new Error(res.error || "Failed to restore database file.");
                }
            } catch (err: any) {
                console.error(err);
                setIsProcessing(false);
                showAlert?.('error', 'Restoration Failed', `Restore Error: ${err.message}`);
                return;
            }
        }

        setProcessStatus('Reading backup file...');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result;
                if (!content) throw new Error("Could not read file content");


                // Fallback to existing encrypted JSON logic
                const encryptedContent = content as string;
                setProcessStatus('Decrypting data...');
                setProcessProgress(40);
                await delay(300);

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

                setProcessStatus('Verifying data integrity...');
                setProcessProgress(60);
                await delay(300);

                const data = JSON.parse(decryptedString);
                setProcessStatus('Restoring database...');
                setProcessProgress(80);
                await delay(400);

                // Preserve critical system keys
                const session = sessionStorage.getItem('app_session_user');
                const licenseSecure = localStorage.getItem('app_license_secure');
                const mid = localStorage.getItem('app_machine_id');
                const lastCheck = localStorage.getItem('app_license_last_check');
                const size = localStorage.getItem('app_data_size');
                const setup = localStorage.getItem('app_setup_complete');

                // Surgical Clear: Remove data keys but KEEP identity
                const dataKeys = [
                    'app_employees', 'app_config', 'app_company_profile', 'app_attendance',
                    'app_leave_ledgers', 'app_advance_ledgers', 'app_payroll_history',
                    'app_fines', 'app_leave_policy', 'app_arrear_history', 'app_logo', 'app_users'
                ];
                dataKeys.forEach(k => localStorage.removeItem(k));
                localStorage.removeItem('app_license'); // Cleanup legacy key if any

                // Re-apply preserved keys just in case
                if (session) sessionStorage.setItem('app_session_user', session);
                if (licenseSecure) localStorage.setItem('app_license_secure', licenseSecure);
                if (mid) localStorage.setItem('app_machine_id', mid);
                if (lastCheck) localStorage.setItem('app_license_last_check', lastCheck);
                if (size) localStorage.setItem('app_data_size', size);
                localStorage.setItem('app_setup_complete', setup || 'true');

                // HELPER: Get value from unified or legacy key
                const getVal = (key: string) => data[key] || data[`app_${key}`];

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
                const users = getVal('users');
                const devMeta = getVal('developerMetadata');

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
                if (users) {
                    localStorage.setItem('app_users', JSON.stringify(users));
                    // @ts-ignore
                    if (window.electronAPI) window.electronAPI.dbSet('app_users', users);
                }
                if (devMeta?.lastNewsDate) localStorage.setItem('app_last_news_date', devMeta.lastNewsDate);
                if (devMeta?.lastStatutoryDate) localStorage.setItem('app_last_statutory_date', devMeta.lastStatutoryDate);

                const masters = data.masters || data.app_masters;
                if (masters) {
                    localStorage.setItem('app_master_designations', JSON.stringify(masters.designations));
                    localStorage.setItem('app_master_divisions', JSON.stringify(masters.divisions));
                    localStorage.setItem('app_master_branches', JSON.stringify(masters.branches));
                    localStorage.setItem('app_master_sites', JSON.stringify(masters.sites));
                }

                setProcessProgress(100);
                setProcessStatus('Data Restored Successfully!');
                await delay(500);

                setIsProcessing(false);
                setShowBackupModal(false);
                setSelectedBackupFile(null);
                setEncryptionKey('');

                setTimeout(() => {
                    showAlert?.('success', 'Data Import Successful', (
                        <div className="space-y-3 text-left">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                                    <CheckCircle2 size={24} className="text-emerald-400" />
                                </div>
                                <h4 className="text-lg font-black text-white uppercase tracking-tighter">Import Complete</h4>
                            </div>
                            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-2">
                                <p className="text-xs text-slate-300 leading-relaxed font-medium italic">
                                    "Your payroll records, master data, and statutory configurations have been successfully synchronized from the provided .enc backup file."
                                </p>
                                <div className="h-px bg-slate-800/80 w-full" />
                                <p className="text-[10px] text-slate-500 font-mono break-all">{file.name}</p>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                <AlertCircle size={14} className="text-amber-500 shrink-0" />
                                <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Session Reload Required to Finalize</p>
                            </div>
                        </div>
                    ) as any, () => {
                        onRestore();
                    });
                }, 100);

            } catch (err: any) {
                console.error(err);
                setIsProcessing(false);
                let displayError = `Restore Error: ${err.message}`;
                if (err.message === "Wrong Password or Corrupt File" || err.message.includes("Malformed UTF-8") || err.message === "Invalid Decryption Result") {
                    displayError = "Decryption Failed: Incorrect password or invalid file.";
                }
                showAlert?.('error', 'Restoration Failed', displayError);
            }
        };
        reader.readAsText(file);
    };

    const initiateRestore = () => {
        const file = selectedBackupFile;
        // Bypassing encryptionKey check if it's an automatic SQLite backup
        if (!file || (!encryptionKey && !isSqliteFile)) {
            showAlert?.('warning', 'Input Required', 'Please select a backup file and enter the decryption password.');
            return;
        }
        if (hasData) {
            setShowOverwriteConfirm(true);
        } else {
            executeImport();
        }
    };

    // ... (rest of the component remains unchanged)
    const handlePFTypeChange = (type: PFComplianceType) => {
        const newRate = type === 'Statutory' ? 0.12 : 0.10;
        setFormData({
            ...formData,
            pfComplianceType: type,
            epfEmployeeRate: newRate,
            epfEmployerRate: newRate
        });
    };

    const handleStatePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const state = e.target.value as keyof typeof PT_STATE_PRESETS;
        if (PT_STATE_PRESETS[state]) {
            setSelectedStatePreset(state);
            setFormData({
                ...formData,
                ptDeductionCycle: PT_STATE_PRESETS[state].cycle as 'Monthly' | 'HalfYearly',
                ptSlabs: [...PT_STATE_PRESETS[state].slabs]
            });
        }
    };

    const handleLWFStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const state = e.target.value as keyof typeof LWF_STATE_PRESETS;
        if (LWF_STATE_PRESETS[state]) {
            setSelectedLWFState(state);
            setFormData({
                ...formData,
                lwfDeductionCycle: LWF_STATE_PRESETS[state].cycle as any,
                lwfEmployeeContribution: LWF_STATE_PRESETS[state].emp,
                lwfEmployerContribution: LWF_STATE_PRESETS[state].emplr
            });
        }
    };

    const handleSlabChange = (index: number, field: 'min' | 'max' | 'amount', value: number) => {
        const newSlabs = [...formData.ptSlabs];
        newSlabs[index] = { ...newSlabs[index], [field]: value };
        setFormData({ ...formData, ptSlabs: newSlabs });
    };

    const handleAddSlab = () => {
        setFormData({
            ...formData,
            ptSlabs: [...formData.ptSlabs, { min: 0, max: 0, amount: 0 }]
        });
    };

    const handleDeleteSlab = (index: number) => {
        const newSlabs = formData.ptSlabs.filter((_, i) => i !== index);
        setFormData({ ...formData, ptSlabs: newSlabs });
    };

    const handleHigherContributionToggle = (key: keyof StatutoryConfig['higherContributionComponents']) => {
        const currentComponents = formData.higherContributionComponents || INITIAL_STATUTORY_CONFIG.higherContributionComponents;
        setFormData({
            ...formData,
            higherContributionComponents: {
                ...currentComponents,
                [key]: !currentComponents[key]
            }
        });
    };

    const handleLeaveWagesToggle = (key: keyof StatutoryConfig['leaveWagesComponents']) => {
        const currentComponents = formData.leaveWagesComponents || INITIAL_STATUTORY_CONFIG.leaveWagesComponents;
        setFormData({
            ...formData,
            leaveWagesComponents: {
                ...currentComponents,
                [key]: !currentComponents[key]
            }
        });
    };

    const handleLeavePolicyChange = (type: 'el' | 'sl' | 'cl', field: 'maxPerYear' | 'maxCarryForward' | 'label', value: string | number) => {
        setLocalLeavePolicy({
            ...localLeavePolicy,
            [type]: {
                ...localLeavePolicy[type],
                [field]: value
            }
        });
    };

    const handleSave = () => {
        setConfig(formData);
        setCompanyProfile(profileData);
        setLeavePolicy(localLeavePolicy);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const executeFactoryReset = () => {
        if (resetPassword === currentUser?.password || (isSetupMode && resetPassword === 'setup')) {
            setIsProcessing(true);
            onNuclearReset();
        } else {
            setResetError("Incorrect Login Password. Access Denied.");
        }
    };

    const executePayrollReset = () => {
        if (resetPassword === currentUser?.password || (isSetupMode && resetPassword === 'setup')) {
            setIsProcessing(true);
            localStorage.removeItem('app_employees');
            localStorage.removeItem('app_attendance');
            localStorage.removeItem('app_leave_ledgers');
            localStorage.removeItem('app_advance_ledgers');
            localStorage.removeItem('app_payroll_history');
            localStorage.removeItem('app_fines');
            localStorage.removeItem('app_arrear_history');
            // We keep company profile, config, and license
            setTimeout(() => {
                setIsProcessing(false);
                setShowPayrollResetModal(false);
                showAlert?.('success', 'Payroll Reset Complete', 'All employee and payroll data has been cleared. The application will now reload.', () => {
                    onRestore();
                });
            }, 800); // Artificial delay to ensure UI loading state registers clearly
        } else {
            setResetError("Incorrect Login Password. Access Denied.");
        }
    };

    return (
        <div className="max-w-4xl space-y-8 text-white relative">
            <input
                type="file"
                ref={backupFileRef}
                id="backup-file-input"
                title="Select Backup File"
                className="hidden"
                accept=".enc"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        setSelectedBackupFile(file);
                        setBackupMode('IMPORT');
                        // Reset SQLite detection
                        setIsSqliteFile(false);

                        // Check Signature using ArrayBuffer (safer for binary)
                        const reader = new FileReader();
                        reader.onload = (re) => {
                            const buffer = re.target?.result as ArrayBuffer;
                            if (buffer) {
                                const arr = new Uint8Array(buffer);
                                const signature = String.fromCharCode(...arr);
                                if (signature.startsWith('SQLite format 3')) {
                                    setIsSqliteFile(true);
                                    setEncryptionKey(''); // Not needed for SQLite
                                }
                            }
                        };
                        reader.readAsArrayBuffer(file.slice(0, 16));

                        setShowBackupModal(true);
                    }
                }}
            />
            <div className="sticky top-20 z-30 bg-[#020617] pt-2 flex gap-4 border-b border-slate-700 overflow-x-auto pb-1 scrollbar-hide">
                <button onClick={() => setActiveTab('STATUTORY')} className={`whitespace-nowrap pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'STATUTORY' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                    <ShieldCheck size={16} /> Statutory Rules
                </button>
                <button onClick={() => setActiveTab('COMPANY')} className={`whitespace-nowrap pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'COMPANY' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                    <Building2 size={16} /> Company Profile
                </button>
                <button onClick={() => setActiveTab('DATA')} className={`whitespace-nowrap pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'DATA' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                    <Database size={16} /> Data Management
                </button>
                {userRole === 'Developer' && (
                    <button onClick={() => setActiveTab('DEVELOPER')} className={`whitespace-nowrap pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'DEVELOPER' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                        <Megaphone size={16} /> Developer Options
                    </button>
                )}
                {!isSetupMode && (
                    <button onClick={() => setActiveTab('LICENSE')} className={`whitespace-nowrap pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'LICENSE' ? 'border-pink-500 text-pink-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                        <ShieldCheck size={16} /> License Management
                    </button>
                )}
                {(licenseInfo || !isSetupMode || appUsers.length > 0) && (
                    <button onClick={() => setActiveTab('USERS')} className={`whitespace-nowrap pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'USERS' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                        <Users size={16} /> User Management
                    </button>
                )}
                {isSetupMode && (
                    <div className="ml-auto flex items-center pb-2 pl-4">
                        <button onClick={handleSave} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all shadow-lg ${saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`} title="Save Configuration Elements">
                            {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                            {saved ? 'SAVED' : 'SAVE CONFIGURATION'}
                        </button>
                    </div>
                )}
            </div>

            {activeTab === 'STATUTORY' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                    {/* ... Content of Statutory ... */}
                    <div className="bg-amber-900/20 border border-amber-700/50 p-6 rounded-2xl flex gap-4 text-amber-200">
                        <AlertCircle size={28} className="shrink-0 text-amber-400" />
                        <div className="text-sm space-y-2">
                            <p className="font-bold text-lg text-amber-400">Compliance & Parameter Configuration</p>
                            <p className="text-slate-300">These Settings Define How PF, ESI, Leave Policy and Taxes are Calculated Establishment wise</p>
                        </div>
                    </div>
                    {/* ... (rest of statutory) */}
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                        {/* ... existing ... */}
                        <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 space-y-6">
                            {/* ... */}
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                <div className="flex items-center gap-3">
                                    <Landmark className="text-blue-400" size={20} />
                                    <h3 className="font-bold uppercase tracking-widest text-xs text-sky-400">Provident Fund (EPF)</h3>
                                </div>
                                <label htmlFor="enable-higher-contrib" className="flex items-center gap-2 cursor-pointer p-1.5 bg-amber-900/20 rounded-lg border border-amber-500/20 hover:bg-amber-900/30 transition-all">
                                    <input id="enable-higher-contrib" type="checkbox" className="w-4 h-4 rounded border-slate-700 text-amber-500 bg-slate-900 accent-amber-500" checked={formData.enableHigherContribution || false} onChange={e => setFormData({ ...formData, enableHigherContribution: e.target.checked })} title="Enable Higher Contribution Rules" />
                                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Enable Higher Contribution Rules</span>
                                </label>
                            </div>
                            {/* ... rest of PF config ... */}
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Compliance Basis</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button onClick={() => handlePFTypeChange('Statutory')} className={`py-2 text-xs font-bold rounded-lg border transition-all ${formData.pfComplianceType === 'Statutory' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>Statutory (12%)</button>
                                                <button onClick={() => handlePFTypeChange('Voluntary')} className={`py-2 text-xs font-bold rounded-lg border transition-all ${formData.pfComplianceType === 'Voluntary' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>Voluntary (10%)</button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label htmlFor="epf-ceiling" className="text-[10px] font-bold text-slate-500 uppercase">Statutory Ceiling (₹)</label>
                                                <input id="epf-ceiling" type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.epfCeiling} onChange={e => setFormData({ ...formData, epfCeiling: +e.target.value })} title="Statutory Ceiling Amount" />
                                            </div>
                                            <div className="space-y-1">
                                                <label htmlFor="epf-employee-rate" className="text-[10px] font-bold text-slate-500 uppercase">Employee Rate (%)</label>
                                                <input id="epf-employee-rate" type="number" step="0.01" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.epfEmployeeRate * 100} onChange={e => setFormData({ ...formData, epfEmployeeRate: +e.target.value / 100 })} title="Employee PF Contribution Rate" />
                                            </div>
                                        </div>
                                    </div>
                                    {formData.enableHigherContribution && (
                                        <div className="bg-amber-900/10 p-4 rounded-xl border border-amber-500/20 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                            {/* ... higher contrib ... */}
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Higher Applicability</label>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {['By Employee', 'By Employee & Employer'].map(type => (
                                                        <button key={type} onClick={() => setFormData({ ...formData, higherContributionType: type as any })} className={`py-2 px-4 text-left text-xs font-bold rounded-lg border transition-all flex items-center justify-between ${formData.higherContributionType === type ? 'bg-amber-600 border-amber-400 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`} title={`Select ${type} as Higher Contribution Type`}>{type}{formData.higherContributionType === type ? <CheckCircle2 size={14} /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-700" />}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="text-[9px] text-amber-300 italic leading-relaxed">* PF Wages will be taken from Higher Contribution Base only if it exceeds Code Wages (Clause 88).</p>
                                        </div>
                                    )}
                                </div>
                                {/* ... components select ... */}
                                {formData.enableHigherContribution && (
                                    <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Table size={12} className="text-amber-400" /> Selected Wage Components for Higher Contribution</label>
                                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-3">
                                            {[
                                                { key: 'basic', label: 'Basic Pay' }, { key: 'da', label: 'DA' }, { key: 'retaining', label: 'Retn Allow' },
                                                { key: 'conveyance', label: 'Conveyance' }, { key: 'washing', label: 'Washing' }, { key: 'attire', label: 'Attire' },
                                                { key: 'special1', label: 'Allow 1' }, { key: 'special2', label: 'Allow 2' }, { key: 'special3', label: 'Allow 3' },
                                            ].map(comp => {
                                                const components = formData.higherContributionComponents || INITIAL_STATUTORY_CONFIG.higherContributionComponents;
                                                const isActive = components[comp.key as keyof typeof components];
                                                return (
                                                    <button key={comp.key} onClick={() => handleHigherContributionToggle(comp.key as any)} className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold transition-all ${isActive ? 'bg-amber-600 border-amber-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`} title={`Toggle ${comp.label} for Higher Contribution`}>{isActive ? <CheckSquare size={14} /> : <Square size={14} />}<span className="truncate">{comp.label}</span></button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* ... ESI, Bonus, Leave, PT, LWF sections remain same ... */}
                        <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-800 space-y-6">
                            <div className="flex items-center gap-3 border-b border-slate-800 pb-3"><ShieldCheck className="text-pink-400" size={20} /><h3 className="font-bold uppercase tracking-widest text-xs text-pink-400">ESI Corporation</h3></div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><label htmlFor="esi-ceiling" className="text-[10px] font-bold text-slate-500 uppercase">ESI Ceiling (₹)</label><input id="esi-ceiling" type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.esiCeiling} onChange={e => setFormData({ ...formData, esiCeiling: +e.target.value })} title="ESI Eligibility Ceiling" /></div>
                                    <div className="space-y-1"><label htmlFor="esi-employee-rate" className="text-[10px] font-bold text-slate-500 uppercase">EE Rate (%)</label><input id="esi-employee-rate" type="number" step="0.001" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.esiEmployeeRate * 100} onChange={e => setFormData({ ...formData, esiEmployeeRate: +e.target.value / 100 })} title="Employee ESI Rate" /></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* ... Other sections (Bonus, Leave, PT, LWF) ... */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                        {/* ... Bonus & Gratuity ... */}
                        <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center gap-3"><Heart className="text-red-400" size={20} /><h3 className="font-bold uppercase tracking-widest text-xs text-red-400">Employee Welfare (Bonus & Gratuity)</h3></div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                                <div className="flex items-center gap-2 mb-2"><Percent size={14} className="text-amber-400" /><span className="text-[10px] font-bold text-slate-400 uppercase">Annual Bonus Policy</span></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><label htmlFor="bonus-rate" className="text-[10px] font-bold text-slate-500 uppercase">Rate (%)</label><input id="bonus-rate" type="number" step="0.0001" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={(formData.bonusRate * 100).toFixed(2)} onChange={e => setFormData({ ...formData, bonusRate: +e.target.value / 100 })} title="Annual Bonus Rate" /></div>
                                    <div className="flex flex-col justify-end"><span className="text-[9px] text-slate-500 italic">Standard: 8.33% Min</span></div>
                                </div>
                            </div>
                            <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                                <div className="flex items-center gap-2 mb-2"><Building2 size={14} className="text-blue-400" /><span className="text-[10px] font-bold text-slate-400 uppercase">LIC Gratuity Policy</span></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Calculation Basis (Formula)</label><div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-blue-300 font-mono">(Basic + DA) * (15/26) * Years</div><p className="text-[9px] text-slate-500 mt-2">Calculated as per LIC Master Policy for Statutory Gratuity (Act 1972).</p></div>
                            </div>
                        </div>
                    </div>

                    {/* Annual Leave Policy */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                        <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center gap-3"><CalendarClock className="text-emerald-400" size={20} /><h3 className="font-bold uppercase tracking-widest text-xs text-emerald-400">Annual Leave Policy</h3></div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* EL */}
                            <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                                <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-2"><span className="text-xs font-bold text-slate-300 uppercase">Earned Leave (EL)</span></div>
                                <div className="space-y-2">
                                    <div className="space-y-1"><label htmlFor="el-label" className="text-[10px] font-bold text-slate-500 uppercase">Label</label><input id="el-label" type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" value={localLeavePolicy.el.label} onChange={e => handleLeavePolicyChange('el', 'label', e.target.value)} title="Earned Leave Label" /></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1"><label htmlFor="el-max" className="text-[10px] font-bold text-slate-500 uppercase">Max/Year</label><input id="el-max" type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.el.maxPerYear} onChange={e => handleLeavePolicyChange('el', 'maxPerYear', +e.target.value)} title="Maximum EL per Year" /></div>
                                        <div className="space-y-1"><label htmlFor="el-carry" className="text-[10px] font-bold text-slate-500 uppercase">Carry Fwd</label><input id="el-carry" type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.el.maxCarryForward} onChange={e => handleLeavePolicyChange('el', 'maxCarryForward', +e.target.value)} title="Maximum EL Carry Forward" /></div>
                                    </div>
                                </div>
                            </div>
                            {/* SL */}
                            <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                                <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-2"><span className="text-xs font-bold text-slate-300 uppercase">Sick Leave (SL)</span></div>
                                <div className="space-y-2">
                                    <div className="space-y-1"><label htmlFor="sl-label" className="text-[10px] font-bold text-slate-500 uppercase">Label</label><input id="sl-label" type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" value={localLeavePolicy.sl.label} onChange={e => handleLeavePolicyChange('sl', 'label', e.target.value)} title="Sick Leave Label" /></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1"><label htmlFor="sl-max" className="text-[10px] font-bold text-slate-500 uppercase">Max/Year</label><input id="sl-max" type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.sl.maxPerYear} onChange={e => handleLeavePolicyChange('sl', 'maxPerYear', +e.target.value)} title="Maximum SL per Year" /></div>
                                        <div className="space-y-1"><label htmlFor="sl-carry" className="text-[10px] font-bold text-slate-500 uppercase">Carry Fwd</label><input id="sl-carry" type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.sl.maxCarryForward} onChange={e => handleLeavePolicyChange('sl', 'maxCarryForward', +e.target.value)} title="Maximum SL Carry Forward" /></div>
                                    </div>
                                </div>
                            </div>
                            {/* CL */}
                            <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                                <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-2"><span className="text-xs font-bold text-slate-300 uppercase">Casual Leave (CL)</span></div>
                                <div className="space-y-2">
                                    <div className="space-y-1"><label htmlFor="cl-label" className="text-[10px] font-bold text-slate-500 uppercase">Label</label><input id="cl-label" type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" value={localLeavePolicy.cl.label} onChange={e => handleLeavePolicyChange('cl', 'label', e.target.value)} title="Casual Leave Label" /></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1"><label htmlFor="cl-max" className="text-[10px] font-bold text-slate-500 uppercase">Max/Year</label><input id="cl-max" type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.cl.maxPerYear} onChange={e => handleLeavePolicyChange('cl', 'maxPerYear', +e.target.value)} title="Maximum CL per Year" /></div>
                                        <div className="space-y-1"><label htmlFor="cl-carry" className="text-[10px] font-bold text-slate-500 uppercase">Carry Fwd</label><input id="cl-carry" type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.cl.maxCarryForward} onChange={e => handleLeavePolicyChange('cl', 'maxCarryForward', +e.target.value)} title="Maximum CL Carry Forward" /></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Leave Encashment Wages */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                        <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between"><div className="flex items-center gap-3"><Calculator className="text-emerald-400" size={20} /><h3 className="font-bold uppercase tracking-widest text-xs text-emerald-400">Leave Encashment Wages Policy</h3></div></div>
                        <div className="p-6 space-y-4">
                            <p className="text-xs text-slate-400 mb-2">Select the wage components to include for Leave Encashment Calculation (EL/SL/CL).</p>
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-3">
                                {[{ key: 'basic', label: 'Basic Pay' }, { key: 'da', label: 'DA' }, { key: 'retaining', label: 'Retn Allow' }, { key: 'hra', label: 'HRA' }, { key: 'conveyance', label: 'Conveyance' }, { key: 'washing', label: 'Washing' }, { key: 'attire', label: 'Attire' }, { key: 'special1', label: 'Special 1' }, { key: 'special2', label: 'Special 2' }, { key: 'special3', label: 'Special 3' }].map(comp => {
                                    const components = formData.leaveWagesComponents || INITIAL_STATUTORY_CONFIG.leaveWagesComponents;
                                    const isActive = components[comp.key as keyof typeof components];
                                    return <button key={comp.key} onClick={() => handleLeaveWagesToggle(comp.key as any)} className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold transition-all ${isActive ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`} title={`Toggle ${comp.label} for Leave Encashment`}>{isActive ? <CheckSquare size={14} /> : <Square size={14} />}<span className="truncate">{comp.label}</span></button>;
                                })}
                            </div>
                            <div className="flex justify-end"><span className="text-[10px] text-slate-500 italic">* Default logic uses Basic + DA. Adjust according to company policy.</span></div>
                        </div>
                    </div>

                    {/* PT Matrix */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                        <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3"><ScrollText className="text-amber-400" size={20} /><h3 className="font-bold uppercase tracking-widest text-xs text-amber-400">Professional Tax (PT) Matrix</h3></div>
                            <div className="flex items-center gap-4">
                                <select id="pt-preset-select" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none" value={selectedStatePreset} onChange={handleStatePresetChange} title="Select State Professional Tax Preset">{Object.keys(PT_STATE_PRESETS).map(s => <option key={s} value={s}>{s} Preset</option>)}</select>
                                <label htmlFor="enable-pt" className="flex items-center gap-2 cursor-pointer"><input id="enable-pt" type="checkbox" className="w-4 h-4 rounded border-slate-700 text-blue-500 bg-slate-900" checked={formData.enableProfessionalTax} onChange={e => setFormData({ ...formData, enableProfessionalTax: e.target.checked })} title="Enable Professional Tax Deduction" /><span className="text-[10px] font-bold text-slate-400 uppercase">Enable PT</span></label>
                            </div>
                        </div>
                        {formData.enableProfessionalTax && (
                            <div className="p-6 space-y-6">
                                <div className="flex items-center gap-4"><span className="text-[10px] font-bold text-slate-500 uppercase">Deduction Cycle:</span><div className="flex gap-2">{['Monthly', 'HalfYearly'].map(c => (<button key={c} onClick={() => setFormData({ ...formData, ptDeductionCycle: c as any })} className={`px-4 py-1.5 rounded-full text-[10px] font-bold border transition-all ${formData.ptDeductionCycle === c ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>{c}</button>))}</div></div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-800"><tr><th className="pb-3">Min Earnings (₹)</th><th className="pb-3">Max Earnings (₹)</th><th className="pb-3">Deduction (₹)</th><th className="pb-3 text-right">Action</th></tr></thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {formData.ptSlabs.map((slab, i) => (
                                                <tr key={i} className="group">
                                                    <td className="py-3"><input type="number" className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white w-24 font-mono" value={slab.min} onChange={e => handleSlabChange(i, 'min', +e.target.value)} title="Minimum Earnings for Slab" /></td>
                                                    <td className="py-3"><input type="number" className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white w-24 font-mono" value={slab.max} onChange={e => handleSlabChange(i, 'max', +e.target.value)} title="Maximum Earnings for Slab" /></td>
                                                    <td className="py-3"><input type="number" className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white w-24 font-mono font-bold text-amber-400" value={slab.amount} onChange={e => handleSlabChange(i, 'amount', +e.target.value)} title="PT Amount for Slab" /></td>
                                                    <td className="py-3 text-right"><button onClick={() => handleDeleteSlab(i)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete PT Slab"><Trash2 size={14} /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <button onClick={handleAddSlab} className="mt-4 flex items-center gap-2 text-[10px] font-bold text-sky-400 hover:text-sky-300"><Plus size={14} /> Add Slab Row</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* LWF */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                        <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3"><HandCoins className="text-emerald-400" size={20} /><h3 className="font-bold uppercase tracking-widest text-xs text-emerald-400">Labour Welfare Fund (LWF)</h3></div>
                            <div className="flex items-center gap-4">
                                <select id="lwf-state-select" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none" value={selectedLWFState} onChange={handleLWFStateChange} title="Select State Labour Welfare Fund Preset">{Object.keys(LWF_STATE_PRESETS).map(s => <option key={s} value={s}>{s} Preset</option>)}</select>
                                <label htmlFor="enable-lwf" className="flex items-center gap-2 cursor-pointer"><input id="enable-lwf" type="checkbox" className="w-4 h-4 rounded border-slate-700 text-emerald-500 bg-slate-900" checked={formData.enableLWF} onChange={e => setFormData({ ...formData, enableLWF: e.target.checked })} title="Enable Labour Welfare Fund Deduction" /><span className="text-[10px] font-bold text-slate-400 uppercase">Enable LWF</span></label>
                            </div>
                        </div>
                        {formData.enableLWF && (
                            <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="space-y-1"><label htmlFor="lwf-cycle" className="text-[10px] font-bold text-slate-500 uppercase">Cycle</label><select id="lwf-cycle" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.lwfDeductionCycle} onChange={e => setFormData({ ...formData, lwfDeductionCycle: e.target.value as any })} title="LWF Deduction Cycle"><option value="Monthly">Monthly</option><option value="HalfYearly">Half-Yearly</option><option value="Yearly">Yearly</option></select></div>
                                <div className="space-y-1"><label htmlFor="lwf-ee-contrib" className="text-[10px] font-bold text-slate-500 uppercase">EE Contribution (₹)</label><input id="lwf-ee-contrib" type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.lwfEmployeeContribution} onChange={e => setFormData({ ...formData, lwfEmployeeContribution: +e.target.value })} title="Employee LWF Contribution" /></div>
                                <div className="space-y-1"><label htmlFor="lwf-er-contrib" className="text-[10px] font-bold text-slate-500 uppercase">ER Contribution (₹)</label><input id="lwf-er-contrib" type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.lwfEmployerContribution} onChange={e => setFormData({ ...formData, lwfEmployerContribution: +e.target.value })} title="Employer LWF Contribution" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Total (₹)</label><div className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-emerald-400 font-mono font-bold">{(formData.lwfEmployeeContribution + formData.lwfEmployerContribution).toLocaleString()}</div></div>
                            </div>
                        )}
                    </div>

                    {/* Income Tax Config */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                        <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center gap-3"><Wallet className="text-sky-400" size={20} /><h3 className="font-bold uppercase tracking-widest text-xs text-sky-400">Income Tax (TDS) Calculation</h3></div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                            <div className="text-xs text-slate-400 leading-relaxed">
                                Choose how Income Tax is determined during payroll processing.
                                <ul className="list-disc pl-4 mt-2 space-y-1 text-slate-500">
                                    <li><b>Manual:</b> Uses imported/entered tax value from 'Tax & Fines'. Zero values are respected.</li>
                                    <li><b>Auto:</b> Calculates based on taxable salary if imported value is zero/missing. Imported non-zero values override auto calculation.</li>
                                </ul>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setFormData({ ...formData, incomeTaxCalculationType: 'Manual' })} className={`flex-1 py-3 px-4 rounded-xl border transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${formData.incomeTaxCalculationType === 'Manual' ? 'bg-sky-600 border-sky-500 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                    {formData.incomeTaxCalculationType === 'Manual' ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border border-slate-600" />} Manual (As per Import)
                                </button>
                                <button onClick={() => setFormData({ ...formData, incomeTaxCalculationType: 'Auto' })} className={`flex-1 py-3 px-4 rounded-xl border transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${formData.incomeTaxCalculationType === 'Auto' ? 'bg-sky-600 border-sky-500 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                    {formData.incomeTaxCalculationType === 'Auto' ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border border-slate-600" />} Auto (Taxable Salary)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'COMPANY' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* ... Company Branding & Profile ... */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden p-8">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4"><ImageIcon className="text-amber-400" size={24} /><h3 className="font-bold text-sky-400 uppercase tracking-widest text-sm">Establishment Branding</h3></div>
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="relative group shrink-0">
                                <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-[#0a0f1d] shadow-2xl overflow-hidden border-4 border-white"><img src={currentLogo} className="w-full h-full object-cover" alt="Establishment Logo" /></div>
                                <button onClick={() => logoInputRef.current?.click()} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-full flex items-center justify-center transition-opacity" title="Upload Logo"><Camera className="text-white" size={24} /></button>
                            </div>
                            <div className="space-y-4"><div><h4 className="font-bold text-white text-lg">Company Logo</h4><p className="text-xs text-slate-400 mt-1">This logo will appear on all Pay Slips, Reports, and the Login screen.</p></div><button onClick={() => logoInputRef.current?.click()} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"><Upload size={14} /> Upload New Logo</button><input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={handleLogoChange} /></div>
                        </div>
                    </div>
                    {/* ... Company Profile Form ... */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden p-8">
                        {/* ... existing fields ... */}
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4"><div className="p-2 bg-indigo-900/30 text-indigo-400 rounded-lg border border-indigo-500/20"><Building2 size={24} /></div><div><h3 className="font-bold text-sky-400 uppercase tracking-widest text-sm">Establishment Profile</h3><p className="text-xs text-slate-400">Official details for legal forms and reports.</p></div></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 gap-y-8">
                            {/* ... Legal ID ... */}
                            <div className="md:col-span-3">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1">Legal Identity & Identification</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1"><label htmlFor="profile-est-name" className="text-[10px] font-bold text-slate-400 uppercase">Establishment Name*</label><input id="profile-est-name" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500 uppercase" placeholder="Your Name - as mentioned in App request mail" value={profileData.establishmentName} onChange={e => setProfileData({ ...profileData, establishmentName: e.target.value.toUpperCase() })} title="Establishment Name" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-trade-name" className="text-[10px] font-bold text-slate-400 uppercase">Trade Name (If Any)</label><input id="profile-trade-name" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Trade Name" value={profileData.tradeName} onChange={e => setProfileData({ ...profileData, tradeName: e.target.value })} title="Trade Name" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-cin" className="text-[10px] font-bold text-sky-400 uppercase">CIN No (Corporate ID)*</label><input id="profile-cin" type="text" className="w-full bg-slate-900 border border-sky-900/50 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-500" value={profileData.cin} onChange={e => setProfileData({ ...profileData, cin: e.target.value })} placeholder="U00000XX0000XXX000000" title="Corporate Identification Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-lin" className="text-[10px] font-bold text-sky-400 uppercase">LIN No (Labour ID)*</label><input id="profile-lin" type="text" className="w-full bg-slate-900 border border-sky-900/50 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-500" value={profileData.lin} onChange={e => setProfileData({ ...profileData, lin: e.target.value })} placeholder="L0000000000" title="Labour Identification Number" /></div>
                                </div>
                            </div>
                            {/* ... Registration Codes ... */}
                            <div className="md:col-span-3">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1 mt-2">Registration Codes</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1"><label htmlFor="profile-pf-code" className="text-[10px] font-bold text-slate-400 uppercase">PF Code</label><input id="profile-pf-code" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="PF Code" value={profileData.pfCode} onChange={e => setProfileData({ ...profileData, pfCode: e.target.value })} title="PF Code Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-esi-code" className="text-[10px] font-bold text-slate-400 uppercase">ESI Code</label><input id="profile-esi-code" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="ESI Code" value={profileData.esiCode} onChange={e => setProfileData({ ...profileData, esiCode: e.target.value })} title="ESI Code Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-gst-no" className="text-[10px] font-bold text-slate-400 uppercase">GST No</label><input id="profile-gst-no" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="GST Number" value={profileData.gstNo} onChange={e => setProfileData({ ...profileData, gstNo: e.target.value })} title="GST Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-pan-no" className="text-[10px] font-bold text-slate-400 uppercase">PAN No</label><input id="profile-pan-no" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="PAN Number" value={profileData.pan} onChange={e => setProfileData({ ...profileData, pan: e.target.value })} title="PAN Number" /></div>
                                </div>
                            </div>
                            {/* ... Address ... */}
                            <div className="md:col-span-3">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1 mt-2">Address Details (Registered Office)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1"><label htmlFor="profile-door-no" className="text-[10px] font-bold text-slate-400 uppercase">Door No / Flat No</label><input id="profile-door-no" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Door No" value={profileData.doorNo} onChange={e => setProfileData({ ...profileData, doorNo: e.target.value })} title="Door/Flat Number" /></div>
                                    <div className="space-y-1 md:col-span-2"><label htmlFor="profile-building" className="text-[10px] font-bold text-slate-400 uppercase">Building Name / Landmark</label><input id="profile-building" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Building Name" value={profileData.buildingName} onChange={e => setProfileData({ ...profileData, buildingName: e.target.value })} title="Building Name or Landmark" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-street" className="text-[10px] font-bold text-slate-400 uppercase">Street</label><input id="profile-street" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Street" value={profileData.street} onChange={e => setProfileData({ ...profileData, street: e.target.value })} title="Street Name" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-locality" className="text-[10px] font-bold text-slate-400 uppercase">Locality</label><input id="profile-locality" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Locality" value={profileData.locality} onChange={e => setProfileData({ ...profileData, locality: e.target.value })} title="Locality" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-area" className="text-[10px] font-bold text-slate-400 uppercase">Area</label><input id="profile-area" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Area" value={profileData.area} onChange={e => setProfileData({ ...profileData, area: e.target.value })} title="Area Name" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-city" className="text-[10px] font-bold text-slate-400 uppercase">City / Town</label><input id="profile-city" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="City" value={profileData.city} onChange={e => setProfileData({ ...profileData, city: e.target.value })} title="City or Town" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-state" className="text-[10px] font-bold text-slate-400 uppercase">State / Union Territory</label><select id="profile-state" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.state} onChange={e => setProfileData({ ...profileData, state: e.target.value })} title="Select State">{INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                    <div className="space-y-1"><label htmlFor="profile-pincode" className="text-[10px] font-bold text-slate-400 uppercase">Pin Code</label><input id="profile-pincode" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="600001" value={profileData.pincode} onChange={e => setProfileData({ ...profileData, pincode: e.target.value })} title="Pincode" /></div>
                                </div>
                            </div>
                            {/* ... Contact ... */}
                            <div className="md:col-span-3">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1 mt-2">Contact & Online Presence</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1"><label htmlFor="profile-mobile" className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Phone size={10} /> Mobile No</label><input id="profile-mobile" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="Mobile Number" value={profileData.mobile} onChange={e => setProfileData({ ...profileData, mobile: e.target.value })} title="Mobile Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-telephone" className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Phone size={10} /> Land Line (Telephone)</label><input id="profile-telephone" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="Landline" value={profileData.telephone} onChange={e => setProfileData({ ...profileData, telephone: e.target.value })} title="Telephone Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-email" className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Mail size={10} /> Official Email</label><input id="profile-email" type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="mail@example.com" value={profileData.email} onChange={e => setProfileData({ ...profileData, email: e.target.value })} title="Official Email Address" /></div>
                                    <div className="space-y-1 md:col-span-2"><label htmlFor="profile-website" className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Globe size={10} /> Corporate Website</label><input id="profile-website" type="url" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="https://www.example.com" value={profileData.website} onChange={e => setProfileData({ ...profileData, website: e.target.value })} title="Corporate Website URL" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-business-nature" className="text-[10px] font-bold text-slate-400 uppercase">Nature of Business</label><select id="profile-business-nature" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.natureOfBusiness} onChange={e => setProfileData({ ...profileData, natureOfBusiness: e.target.value })} title="Select Nature of Business">{NATURE_OF_BUSINESS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'DEVELOPER' && userRole === 'Developer' && (
                <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-8 shadow-xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-900/30 text-indigo-400 rounded-lg border border-indigo-500/20">
                                <Megaphone size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Developer Options</h2>
                                <p className="text-xs text-slate-400">Global Scrolling News & Statutory Compliance Updates</p>
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                setIsSyncing(true);
                                const result = await fetchLatestMessages();
                                setIsSyncing(false);
                                if (result && (result.scrollNews || result.statutory)) {
                                    setProfileData(prev => ({
                                        ...prev,
                                        flashNews: result.scrollNews || prev.flashNews,
                                        postLoginMessage: result.statutory || prev.postLoginMessage
                                    }));
                                    showAlert?.('success', 'Sync Complete', 'Latest developer messages fetched from cloud.');
                                } else {
                                    showAlert?.('info', 'Up to Date', 'You already have the latest messages or are offline.');
                                }
                            }}
                            disabled={isSyncing}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                            title="Sync News with Cloud"
                        >
                            {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />}
                            {isSyncing ? 'SYNCING...' : 'SYNC WITH CLOUD'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                            <label htmlFor="dev-flash-news" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Dashboard News Ticker (Marquee)</label>
                            <textarea
                                id="dev-flash-news"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all min-h-[100px] placeholder:text-slate-500/60"
                                placeholder="Enter scrolling news message..."
                                value={profileData.flashNews || ''}
                                onChange={e => setProfileData({ ...profileData, flashNews: e.target.value })}
                                title="Flash News Message"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label htmlFor="dev-ai-url" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">AI Studio Integration URL</label>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-3 text-slate-500" size={18} />
                                    <input
                                        id="dev-ai-url"
                                        type="url"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pl-10 text-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-500/60"
                                        placeholder="https://..."
                                        value={profileData.externalAppUrl || ''}
                                        onChange={e => setProfileData({ ...profileData, externalAppUrl: e.target.value })}
                                        title="External AI Application URL"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="dev-post-login" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Post-Login Modal Message</label>
                                <textarea
                                    id="dev-post-login"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all min-h-[80px] placeholder:text-slate-500/60"
                                    placeholder="Enter statutory compliance or system message..."
                                    value={profileData.postLoginMessage || ''}
                                    onChange={e => setProfileData({ ...profileData, postLoginMessage: e.target.value })}
                                    title="Post-Login Information Message"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'DATA' && (
                <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-8 shadow-xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                        <div className="p-2 bg-indigo-900/30 text-indigo-400 rounded-lg border border-indigo-500/20">
                            <Database size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg">Data Management</h3>
                            <p className="text-xs text-slate-400">Secure backup and restore operations.</p>
                        </div>
                    </div>

                    {isSetupMode ? (
                        <div className="space-y-8 py-4">
                            {/* Pro-active Info Note - Only if company name has been customized (Partial Reset) */}
                            {companyProfile.establishmentName !== INITIAL_COMPANY_PROFILE.establishmentName && (
                                <div className="bg-indigo-600/10 border border-indigo-500/30 p-5 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl">
                                        <AlertCircle size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-indigo-200 mb-1 leading-tight">System Ready for Input</h4>
                                        <p className="text-sm text-indigo-300/80 leading-relaxed font-medium italic">
                                            "Company Profile & Statutory Compliance pre-exist. Proceed to add Employee and Attendance through 'START AFRESH' or restore full data through 'BACKUP DATA'."
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Option 1: Start Fresh */}
                                <div className="bg-[#0f172a] p-8 rounded-2xl border border-blue-500/20 hover:border-blue-500/50 transition-all flex flex-col items-center text-center group">
                                    <div className="w-16 h-16 bg-blue-900/20 text-blue-400 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 group-hover:scale-110 transition-transform">
                                        <Plus size={32} />
                                    </div>
                                    <h4 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Enter Fresh Data</h4>
                                    <p className="text-sm text-slate-400 leading-relaxed mb-6">Start with an empty database. You can manually enter employee details from the Employee Master.</p>
                                    <button
                                        onClick={onSkipSetupRedirect}
                                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-3 mt-auto"
                                    >
                                        START FRESH <ArrowRight size={18} />
                                    </button>
                                </div>

                                {/* Option 2: Restore */}
                                <div className="bg-[#0f172a] p-8 rounded-2xl border border-emerald-500/20 hover:border-emerald-500/50 transition-all flex flex-col items-center text-center group">
                                    <div className="w-16 h-16 bg-emerald-900/20 text-emerald-400 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                                        <Upload size={32} />
                                    </div>
                                    <h4 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Restore from Backup</h4>
                                    <p className="text-sm text-slate-400 leading-relaxed mb-6">Restoring data from a prior encrypted backup file (.enc) including all history.</p>
                                    <button
                                        onClick={() => { setBackupMode('IMPORT'); backupFileRef.current?.click(); }}
                                        className="w-full py-4 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl font-bold transition-all flex items-center justify-center gap-3 mt-auto"
                                    >
                                        <Upload size={18} /> RESTORE BACKUP
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {hasData && (
                                <div className="bg-[#0f172a] p-6 rounded-xl border border-slate-800 hover:border-blue-500/50 transition-all group">
                                    <div className="p-3 bg-blue-900/20 text-blue-400 rounded-full w-fit mb-4 group-hover:scale-110 transition-transform">
                                        <Download size={24} />
                                    </div>
                                    <h4 className="font-bold text-white mb-2">Backup Data</h4>
                                    <p className="text-xs text-slate-400 mb-6 leading-relaxed">Create a secure, encrypted backup file (.enc) of your entire system data.</p>
                                    <button onClick={() => { setBackupMode('EXPORT'); setShowBackupModal(true); setEncryptionKey(''); }} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2">
                                        <Download size={16} /> Create Backup
                                    </button>
                                </div>
                            )}
                            <div className={`bg-[#0f172a] p-6 rounded-xl border border-slate-800 hover:border-emerald-500/50 transition-all group ${!hasData ? 'md:col-span-2' : ''}`}>
                                <div className="p-3 bg-emerald-900/20 text-emerald-400 rounded-full w-fit mb-4 group-hover:scale-110 transition-transform">
                                    <Upload size={24} />
                                </div>
                                <h4 className="font-bold text-white mb-2">Restore Data</h4>
                                <p className="text-xs text-slate-400 mb-6 leading-relaxed">Restore system from an encrypted file. Overwrites current session.</p>
                                <button onClick={() => { setBackupMode('IMPORT'); backupFileRef.current?.click(); }} className="w-full py-3 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-lg font-bold transition-all flex items-center justify-center gap-2">
                                    <Upload size={16} /> Restore Backup
                                </button>
                            </div>
                            {hasData && (
                                <div className="bg-[#0f172a] p-6 rounded-xl border border-slate-800 hover:border-amber-500/50 transition-all group md:col-span-2">
                                    <div className="p-3 bg-amber-900/20 text-amber-400 rounded-full w-fit mb-4 group-hover:scale-110 transition-transform">
                                        <Trash2 size={24} />
                                    </div>
                                    <h4 className="font-bold text-white mb-2">Payroll Data Reset</h4>
                                    <p className="text-xs text-slate-400 mb-6 leading-relaxed">Remove only employee and payroll records. <span className="text-amber-400 font-bold">Keeps Statutory Rules and Company Profile intact.</span></p>
                                    <button onClick={() => { setShowPayrollResetModal(true); setResetPassword(''); setResetError(''); }} className="w-full py-3 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-600/50 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2">
                                        <RefreshCw size={16} /> Reset Employee Database
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="pt-6 border-t border-slate-800">
                        <div className="bg-red-900/10 border border-red-900/30 p-4 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-red-900/20 text-red-500 rounded-lg">
                                    <AlertTriangle size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-red-200 text-sm">Danger Zone</h4>
                                    <p className="text-xs text-red-300/60">Permanently delete all data.</p>
                                </div>
                            </div>
                            <button onClick={() => { setShowResetModal(true); setResetPassword(''); setResetError(''); }} className="px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-lg text-xs font-bold transition-all">Factory Reset</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ... (Footer actions and Modals) ... */}
            {activeTab !== 'DATA' && !isSetupMode && (
                <div className="flex justify-between items-center p-2 pt-6 border-t border-slate-800">
                    <div></div>
                    <button onClick={handleSave} className={`flex items-center gap-3 px-10 py-4 rounded-2xl font-black transition-all shadow-2xl ${saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                        {saved ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
                        {saved ? 'CONFIGURATION SAVED!' : 'UPDATE ALL PARAMETERS'}
                    </button>
                </div>
            )}

            {showResetModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-sm rounded-2xl border border-red-900/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                        {!isProcessing && <button onClick={() => setShowResetModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close Modal"><X size={20} /></button>}
                        <div className="flex flex-col items-center gap-2">
                            <div className="p-4 bg-red-900/20 text-red-500 rounded-full border border-red-900/50 mb-2">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-xl font-black text-white text-center">FACTORY RESET</h3>
                            <p className="text-xs text-red-300 text-center leading-relaxed">CRITICAL WARNING: This action is IRREVERSIBLE.</p>
                        </div>
                        <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-2 text-sm text-slate-400 mb-2"><KeyRound size={16} /><span>Confirm Identity</span></div>
                            <input type="password" placeholder="Enter Login Password" autoFocus disabled={isProcessing} className={`w-full bg-[#0f172a] border ${resetError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-red-500 transition-all disabled:opacity-50`} value={resetPassword} onChange={(e) => { setResetPassword(e.target.value); setResetError(''); }} onKeyDown={(e) => e.key === 'Enter' && executeFactoryReset()} />
                            {resetError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{resetError}</p>}
                        </div>
                        <button onClick={executeFactoryReset} disabled={isProcessing} className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2">
                            {isProcessing ? <><Loader2 size={18} className="animate-spin" /> ERASING DATA...</> : <><Trash2 size={18} /> CONFIRM DELETE ALL DATA</>}
                        </button>
                    </div>
                </div>
            )}

            {showPayrollResetModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-amber-900/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                        <button onClick={() => setShowPayrollResetModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close Modal"><X size={20} /></button>
                        <div className="flex flex-col items-center gap-2">
                            <div className="p-4 bg-amber-900/20 text-amber-500 rounded-full border border-amber-900/50 mb-2">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-black text-white text-center uppercase">Payroll Reset</h3>
                            <p className="text-xs text-amber-300 text-center leading-relaxed">Warning: This will delete ALL employees and payroll history but preserve your Company & Statutory Profile.</p>
                        </div>
                        <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-2 text-sm text-slate-400 mb-2"><KeyRound size={16} /><span>Confirm Identity</span></div>
                            <input type="password" placeholder="Enter Login Password" autoFocus disabled={isProcessing} className={`w-full bg-[#0f172a] border ${resetError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-amber-500 transition-all disabled:opacity-50`} value={resetPassword} onChange={(e) => { setResetPassword(e.target.value); setResetError(''); }} onKeyDown={(e) => e.key === 'Enter' && executePayrollReset()} />
                            {resetError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{resetError}</p>}
                        </div>
                        <button onClick={executePayrollReset} disabled={isProcessing} className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-amber-900/20 transition-all flex items-center justify-center gap-2">
                            {isProcessing ? <><Loader2 size={18} className="animate-spin" /> CLEARING PAYROLL DATA...</> : <><CheckCircle2 size={18} /> CONFIRM PAYROLL RESET</>}
                        </button>
                    </div>
                </div>
            )}

            {showBackupModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                        {!isProcessing && (
                            <button onClick={() => { setShowBackupModal(false); setSelectedBackupFile(null); setEncryptionKey(''); }} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close Modal"><X size={20} /></button>
                        )}
                        <div className="flex flex-col items-center gap-2">
                            <div className={`p-4 rounded-full border mb-2 transition-all duration-500 ${processProgress === 100 ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/50' : isProcessing ? 'bg-indigo-900/30 text-indigo-400 border-indigo-500/50' : 'bg-blue-900/20 text-blue-400 border-blue-900/50'}`}>
                                {processProgress === 100 ? <CheckCircle2 size={32} /> : isProcessing ? <Loader2 size={32} className="animate-spin" /> : <Lock size={32} />}
                            </div>
                            <h3 className="text-xl font-black text-white text-center">
                                {isProcessing ? (backupMode === 'EXPORT' ? 'Exporting Data...' : 'Restoring System...') : (backupMode === 'EXPORT' ? 'Encrypted Export' : 'Secure Restore')}
                            </h3>
                        </div>
                        {isProcessing ? (
                            <div className="w-full py-6 px-2 space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className={`text-xs font-bold uppercase tracking-widest transition-colors duration-300 ${processProgress === 100 ? 'text-emerald-400 text-sm animate-pulse' : 'text-slate-400'}`}>{processStatus}</span>
                                        <span className={`text-xs font-bold font-mono ${processProgress === 100 ? 'text-emerald-400' : 'text-slate-500'}`}>{processProgress}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                                        <div className={`h-full transition-all duration-300 ease-out ${backupMode === 'EXPORT' ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]'}`} style={{ width: `${processProgress}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 mt-2 w-full">
                                {backupMode === 'IMPORT' && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Selected Backup File</label>
                                        <div className="flex gap-2">
                                            <div className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg p-2.5 text-xs text-emerald-400 font-mono truncate flex items-center gap-2">
                                                <FileText size={14} /> {selectedBackupFile?.name || 'No file selected'}
                                            </div>
                                            <button
                                                onClick={() => backupFileRef.current?.click()}
                                                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-700 transition-all text-slate-300"
                                            >
                                                Change
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {!isSqliteFile && (
                                    <div className="space-y-1">
                                        <label htmlFor="backup-encryption-key" className="text-[10px] font-bold text-slate-500 uppercase">{backupMode === 'EXPORT' ? 'Set Encryption Password' : 'Enter Decryption Password'}</label>
                                        <input id="backup-encryption-key" type="password" placeholder="Enter Password" className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={encryptionKey} onChange={(e) => setEncryptionKey(e.target.value)} title={backupMode === 'EXPORT' ? 'Backup Encryption Password' : 'Backup Decryption Password'} />
                                    </div>
                                )}
                                {isSqliteFile && (
                                    <div className="bg-emerald-900/10 border border-emerald-500/20 p-3 rounded-xl">
                                        <p className="text-[10px] text-emerald-400 leading-relaxed font-bold">
                                            Auto-detected Database Backup. No file password required.
                                        </p>
                                    </div>
                                )}
                                <button onClick={backupMode === 'EXPORT' ? () => requireAuth(handleEncryptedExport) : () => { const file = selectedBackupFile; if (!file || (!encryptionKey && !isSqliteFile)) { showAlert?.('warning', 'Input Required', 'Please select a file and enter password.'); return; } requireAuth(initiateRestore); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                                    {backupMode === 'EXPORT' ? 'DOWNLOAD BACKUP' : 'RESTORE DATA'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'LICENSE' && (
                <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-8 shadow-xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                        <div className="p-2 bg-pink-900/30 text-pink-400 rounded-lg border border-pink-500/20">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter">License Management</h2>
                            <p className="text-xs text-slate-400">System Activation & Machine Lock Status</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <Lock size={14} className="text-pink-500" /> Current License Info
                                    </h3>
                                    <button
                                        onClick={async () => {
                                            setIsSyncing(true);
                                            try {
                                                const { validateLicenseStartup } = await import('../services/licenseService');
                                                await validateLicenseStartup();
                                                setLicenseInfo(getStoredLicense());
                                                showAlert?.('success', 'Sync Complete', 'License data successfully refreshed from cloud.');
                                            } catch (err) {
                                                showAlert?.('error', 'Sync Failed', 'Could not connect to cloud services.');
                                            } finally {
                                                setIsSyncing(false);
                                            }
                                        }}
                                        disabled={isSyncing}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-700 transition-all text-sky-400 disabled:opacity-50"
                                    >
                                        <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                                        {isSyncing ? 'Syncing...' : 'Sync Cloud'}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                                        <span className="text-xs text-slate-400">Status</span>
                                        <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${licenseInfo?.isTrial ? 'bg-amber-500/10 text-amber-500' : licenseInfo?.status === 'REGISTERED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                                            {licenseInfo?.status || 'UNREGISTERED'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                                        <span className="text-xs text-slate-400">User ID</span>
                                        <span className={`text-xs font-mono ${licenseInfo?.userID ? 'text-white' : 'text-slate-500 italic'}`}>{licenseInfo?.userID || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                                        <span className="text-xs text-slate-400">Email ID</span>
                                        <span className={`text-[10px] truncate max-w-[150px] ${licenseInfo?.registeredTo ? 'text-slate-300' : 'text-slate-500 italic'}`} title={licenseInfo?.registeredTo}>{licenseInfo?.registeredTo || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                                        <span className="text-xs text-slate-400">Mobile No</span>
                                        <span className={`text-xs font-mono ${licenseInfo?.registeredMobile ? 'text-white' : 'text-slate-500 italic'}`}>{licenseInfo?.registeredMobile || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                                        <span className="text-xs text-slate-400">Machine ID</span>
                                        <span className={`text-[10px] font-mono truncate max-w-[150px] ${licenseInfo?.machineId ? 'text-slate-300' : 'text-slate-500 italic'}`} title={licenseInfo?.machineId}>{licenseInfo?.machineId || 'Fetching...'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                                        <span className="text-xs text-slate-400">Employee Data Limit</span>
                                        <span className={`text-xs font-mono font-black ${licenseInfo?.dataSize ? 'text-emerald-400' : 'text-slate-500 italic'}`}>{licenseInfo?.dataSize || 'N/A'}</span>
                                    </div>
                                    <div className={`flex justify-between items-center py-2 font-bold ${licenseInfo?.expiryDate ? 'text-pink-400' : 'text-slate-500 italic'}`}>
                                        <span className="text-xs text-slate-400 font-normal">Expiry Date</span>
                                        <span className="text-xs">{licenseInfo?.expiryDate || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl">
                                <p className="text-[10px] text-blue-300 leading-relaxed italic">
                                    * License is locked to this Machine ID. To move BharatPay Pro to another computer, please contact support for a license reset.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-6">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <ArrowRight size={14} className="text-blue-500" /> Re-Activate System
                                </h3>

                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label htmlFor="license-full-name" className="text-[10px] font-bold text-slate-500 uppercase pl-1">Full Name / Authorized Person</label>
                                        <input id="license-full-name" ref={fullNameRef} type="text" placeholder="Your Name - as mentioned in App request mail" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" value={newUserName} onChange={e => setNewUserName(e.target.value)} title="Full Name for License" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label htmlFor="license-user-id" className="text-[10px] font-bold text-slate-500 uppercase pl-1">User ID</label>
                                            <input id="license-user-id" type="text" placeholder="User ID" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-mono focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" value={newUserID} onChange={e => setNewUserID(e.target.value)} title="License User ID" />
                                        </div>
                                        <div className="space-y-1">
                                            <label htmlFor="license-key-input" className="text-[10px] font-bold text-slate-500 uppercase pl-1">License Key (16-Digit)</label>
                                            <input id="license-key-input" type="text" placeholder="XXXX-XXXX-XXXX-XXXX" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white placeholder:text-slate-500 text-sm font-mono focus:ring-2 focus:ring-pink-500/50 outline-none transition-all uppercase" value={newLicenseKey} onChange={e => setNewLicenseKey(e.target.value.toUpperCase())} title="16-Digit License Key" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label htmlFor="license-email" className="text-[10px] font-bold text-slate-500 uppercase pl-1">Email ID</label>
                                            <input id="license-email" type="email" title="Registered Email" placeholder="Email Address" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm focus:ring-2 focus:ring-pink-500/50 outline-none transition-all" value={newRegEmail} onChange={e => setNewRegEmail(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <label htmlFor="license-mobile" className="text-[10px] font-bold text-slate-500 uppercase pl-1">Mobile No</label>
                                            <input id="license-mobile" type="tel" title="Activation Mobile Number" placeholder="10-digit mobile" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:ring-2 focus:ring-pink-500/50 outline-none transition-all" value={newRegMobile} onChange={e => setNewRegMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} />
                                        </div>
                                    </div>

                                    <button
                                        onClick={async () => {
                                            if (!isValidKeyFormat(newLicenseKey)) {
                                                showAlert?.('warning', 'Invalid Input', 'Please enter a valid 16-digit license key.');
                                                return;
                                            }
                                            if (!newUserName || !newUserID || !newRegEmail || !newRegMobile) {
                                                showAlert?.('warning', 'Input Required', 'All fields are required for activation.');
                                                return;
                                            }

                                            setIsActivating(true);
                                            const result = await activateFullLicense(newUserName, newUserID, newLicenseKey, newRegEmail, newRegMobile);
                                            setIsActivating(false);

                                            if (result.success) {
                                                showAlert?.('success', 'Success', 'License activated and machine locked successfully.');
                                                setLicenseInfo(getStoredLicense());
                                                setNewLicenseKey('');
                                            } else {
                                                showAlert?.('error', 'Failed', result.message || 'Activation Failed.');
                                            }
                                        }}
                                        disabled={isActivating}
                                        title="Activate License"
                                        className="w-full py-4 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-xl shadow-xl shadow-pink-500/20 transition-all flex items-center justify-center gap-3"
                                    >
                                        {isActivating ? <Loader2 size={24} className="animate-spin" /> : <>Re-Activate System <ArrowRight size={20} /></>}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-2xl p-6 space-y-4">
                                <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck size={16} /> Software Security & Trust Guide
                                </h3>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider underline decoration-indigo-500/50">Why do I see "Windows protected your PC"?</p>
                                        <p className="text-[10px] text-slate-400 leading-relaxed font-medium italic">
                                            This is a standard Microsoft SmartScreen warning for unsigned software. To proceed, click <b>"More Info"</b> and then <b>"Run Anyway"</b>.
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider underline decoration-indigo-500/50">Why can't Google Drive scan for viruses?</p>
                                        <p className="text-[10px] text-slate-400 leading-relaxed font-medium italic">
                                            Google Drive cannot scan files larger than 100MB. BharatPay Pro includes the high-fidelity Electron engine, making it ~120MB+. You can safely click <b>"Download anyway"</b>.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                        <div className="p-1 px-2 bg-emerald-500/20 text-emerald-400 text-[8px] font-black rounded uppercase">Tip</div>
                                        <p className="text-[9px] text-emerald-300/80 font-bold uppercase tracking-widest">
                                            Professional Tip: Purchasing an "EV Code Signing Certificate" will remove these warnings permanently.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            )}
            {activeTab === 'USERS' && (
                <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-8 shadow-xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                        <div className="p-2 bg-sky-900/30 text-sky-400 rounded-lg border border-sky-500/20">
                            <Users size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter">User Management</h2>
                            <p className="text-xs text-slate-400">Account Control & Access Permissions</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-sky-900/30 text-sky-400 rounded-lg border border-sky-500/20"><Users size={20} /></div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-tighter">App User Management</h3>
                                <p className="text-xs text-slate-400">Create & manage BharatPay Pro login accounts</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left: User List */}
                            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                                    <Users size={14} className="text-sky-400" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Existing Users ({appUsers.length})</span>
                                </div>
                                {appUsers.length === 0 ? (
                                    <div className="p-6 text-center text-slate-500 text-xs italic">No users created yet.</div>
                                ) : (
                                    <div className="divide-y divide-slate-800/60">
                                        {appUsers.map(u => (
                                            <div key={u.username} className="px-4 py-3 flex items-center justify-between hover:bg-slate-800/40 transition-colors group">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-lg ${u.role === 'Administrator' ? 'bg-amber-900/20 text-amber-500' : 'bg-slate-800 text-slate-400'}`}>
                                                        <ShieldCheck size={14} />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-black text-white uppercase tracking-tighter">{u.name}</div>
                                                        <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                                            <span>@{u.username}</span>
                                                            <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                                            <span className={`uppercase font-bold ${u.role === 'Administrator' ? 'text-amber-600' : 'text-slate-500'}`}>{u.role}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => handleUmEdit(u)} className="p-1.5 hover:bg-slate-700 text-sky-400 rounded-md transition-colors" title="Edit User"><Edit2 size={14} /></button>
                                                    <button onClick={() => { if (u.username === currentUser?.username) { showAlert?.('error', 'Action Restricted', 'Cannot delete your own account.'); } else { requireAuth(() => handleUmDelete(u.username)); } }} className="p-1.5 hover:bg-red-900/20 text-red-400 rounded-md transition-colors" title="Delete User"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Right: Add/Edit Form */}
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-4">
                                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    {umEditId ? <Edit2 size={12} className="text-sky-400" /> : <UserPlus size={12} className="text-sky-400" />}
                                    {umEditId ? 'Modify Account' : 'Create New Account'}
                                </h3>

                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Full Name</label>
                                        <input ref={umNameRef} type="text" value={umForm.name} onChange={e => setUmForm({ ...umForm, name: e.target.value })} placeholder="Enter user's full name" className="w-full bg-slate-800 border-slate-700 border rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Username / ID</label>
                                        <input type="text" value={umForm.username} onChange={e => setUmForm({ ...umForm, username: e.target.value.toLowerCase().replace(/\s/g, '') })} placeholder="Pick a unique login ID" disabled={!!umEditId} className="w-full bg-slate-800 border-slate-700 border rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all outline-none disabled:opacity-50" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Login Password</label>
                                        <div className="relative">
                                            <input type={umShowPwd ? 'text' : 'password'} value={umForm.password} onChange={e => setUmForm({ ...umForm, password: e.target.value })} placeholder="Enter secure password" className="w-full bg-slate-800 border-slate-700 border rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all outline-none pr-10" />
                                            <button onClick={() => setUmShowPwd(!umShowPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-sky-400 transition-colors">{umShowPwd ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">System Role</label>
                                        <div className="flex gap-2 p-1 bg-slate-800 rounded-xl border border-slate-700">
                                            {(['Administrator', 'User'] as const).map(role => (
                                                <button key={role} onClick={() => setUmForm({ ...umForm, role })} className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${umForm.role === role ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{role}</button>
                                            ))}
                                        </div>
                                    </div>
                                    {umError && <div className="p-2 bg-red-900/20 border border-red-500/20 rounded-lg text-[10px] text-red-400 flex items-center gap-2"><AlertCircle size={12} /> {umError}</div>}
                                    <div className="flex gap-2 pt-2">
                                        {umEditId && <button onClick={() => { setUmEditId(null); setUmForm({ name: '', username: '', password: '', role: 'User' }); }} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold uppercase text-[10px] tracking-widest rounded-xl transition-all">Cancel</button>}
                                        <button onClick={handleUmSave} className="flex-[2] py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2">{umEditId ? 'Update User' : 'Save User'}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showOverwriteConfirm && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-red-500/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                        <button onClick={() => setShowOverwriteConfirm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close Modal"><X size={20} /></button>
                        <div className="flex flex-col items-center gap-2">
                            <div className="p-3 bg-red-900/20 text-red-500 rounded-full border border-red-900/50 mb-2">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-xl font-black text-white text-center">Overwrite Data?</h3>
                            <p className="text-xs text-slate-300 text-center leading-relaxed">
                                Existing data detected. Restoring a backup will <span className="text-red-400 font-bold">PERMANENTLY REPLACE</span> all current records.
                            </p>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setShowOverwriteConfirm(false)} className="flex-1 py-3 border border-slate-600 rounded-xl text-slate-300 font-bold hover:bg-slate-800 transition-all">Cancel</button>
                            <button onClick={() => { setShowOverwriteConfirm(false); executeImport(); }} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg transition-all">Proceed & Overwrite</button>
                        </div>
                    </div>
                </div>
            )}

            {showAuthModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-indigo-500/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                        <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close Authentication Modal"><X size={20} /></button>
                        <div className="flex flex-col items-center gap-2">
                            <div className="p-4 bg-indigo-900/20 text-indigo-500 rounded-full border border-indigo-900/50 mb-2">
                                <KeyRound size={32} />
                            </div>
                            <h3 className="text-xl font-black text-white text-center">AUTHORIZE ACTION</h3>
                        </div>
                        <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                            <label htmlFor="auth-pwd" className="sr-only">Login Password</label>
                            <input id="auth-pwd" type="password" placeholder="Login Password" autoFocus className={`w-full bg-[#0f172a] border ${authError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all`} value={authPassword} onChange={(e) => { setAuthPassword(e.target.value); setAuthError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleAuthSubmit()} title="Login Password" />
                            {authError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{authError}</p>}
                        </div>
                        <button onClick={handleAuthSubmit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                            <CheckCircle2 size={18} /> VERIFY & PROCEED
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
