import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    X, Save, RefreshCw, Loader2, Download, Upload, Trash2, AlertTriangle, 
    Database, Users, KeyRound, ShieldCheck, Mail, Megaphone, Building2, 
    CalendarClock, Phone, Globe, CheckCircle2, AlertCircle, Lock, Plus,
    ImageIcon, Camera, Heart, CheckSquare, Square, Landmark, Table, Calculator, 
    ScrollText, Percent, HandCoins, Wallet, Scale, RotateCw, TrendingUp,
    ChevronRight, Shield, Info, Settings as SettingsIcon, Eye, EyeOff, ShieldAlert
} from 'lucide-react';
import { StatutoryConfig, PFComplianceType, LeavePolicy, CompanyProfile, User, LicenseData } from '../types';
import { PT_STATE_PRESETS, INDIAN_STATES, NATURE_OF_BUSINESS_OPTIONS, LWF_STATE_PRESETS, INITIAL_STATUTORY_CONFIG } from '../constants';
import CryptoJS from 'crypto-js';
import { 
    fetchLatestMessages, updateDeveloperMessages, activateFullLicense, 
    getStoredLicense, isValidKeyFormat, updateCloudPassword, validateLicenseStartup 
} from '../services/licenseService';
import SMTPConfigModal from './Shared/SMTPConfigModal';

declare global {
  interface Window {
    electronAPI: any;
  }
}

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
    onDirtyChange?: (isDirty: boolean) => void;
    showAlert: (type: 'success' | 'warning' | 'danger' | 'info' | 'confirm' | 'error', title: string, message: string | React.ReactNode, onConfirm?: () => void, onCancel?: () => void, confirmLabel?: string, cancelLabel?: string, cancel2Label?: string) => void;
}

const Settings: React.FC<SettingsProps> = ({ config, setConfig, companyProfile, setCompanyProfile, currentLogo, setLogo, leavePolicy, setLeavePolicy, onRestore, onNuclearReset, initialTab = 'STATUTORY', userRole, currentUser, isSetupMode = false, onSkipSetupRedirect, onDirtyChange, showAlert }) => {
    const [activeTab, setActiveTab] = useState<'STATUTORY' | 'COMPANY' | 'DATA' | 'DEVELOPER' | 'LICENSE' | 'USERS'>(isSetupMode ? 'COMPANY' : initialTab);

    const [formData, setFormData] = useState<StatutoryConfig>(() => {
        const pfOrig = config.pfOriginalWagesComponents || INITIAL_STATUTORY_CONFIG.pfOriginalWagesComponents;
        const esiOrig = config.esiOriginalWagesComponents || INITIAL_STATUTORY_CONFIG.esiOriginalWagesComponents;

        return {
            ...INITIAL_STATUTORY_CONFIG,
            ...config,
            higherContributionComponents: {
                ...INITIAL_STATUTORY_CONFIG.higherContributionComponents,
                ...(config.higherContributionComponents || {})
            },
            leaveWagesComponents: {
                ...INITIAL_STATUTORY_CONFIG.leaveWagesComponents,
                ...(config.leaveWagesComponents || {})
            },
            otComponents: {
                ...INITIAL_STATUTORY_CONFIG.otComponents,
                ...(config.otComponents || {})
            },
            otCalculationFactor: config.otCalculationFactor || INITIAL_STATUTORY_CONFIG.otCalculationFactor,
            incomeTaxCalculationType: config.incomeTaxCalculationType || INITIAL_STATUTORY_CONFIG.incomeTaxCalculationType,
            pfEsiCalculationBasis: config.pfEsiCalculationBasis || INITIAL_STATUTORY_CONFIG.pfEsiCalculationBasis,
            pfOriginalWagesComponents: {
                ...INITIAL_STATUTORY_CONFIG.pfOriginalWagesComponents,
                ...pfOrig
            },
            esiOriginalWagesComponents: {
                ...INITIAL_STATUTORY_CONFIG.esiOriginalWagesComponents,
                ...esiOrig
            }
        };
    });

    const [profileData, setProfileData] = useState(companyProfile);
    const [localLeavePolicy, setLocalLeavePolicy] = useState(leavePolicy);
    const [saved, setSaved] = useState(false);
    const [selectedStatePreset, setSelectedStatePreset] = useState<string>('Tamil Nadu');
    const [selectedLWFState, setSelectedLWFState] = useState<string>('Tamil Nadu');

    const hasData = useMemo(() => {
        try {
            const emps = JSON.parse(localStorage.getItem('app_employees') || '[]');
            return Array.isArray(emps) && emps.length > 0;
        } catch (e) {
            return false;
        }
    }, []);

    const isDirty = useMemo(() => {
        const statutoryDirty = JSON.stringify(formData) !== JSON.stringify(config);
        const profileDirty = JSON.stringify(profileData) !== JSON.stringify(companyProfile);
        const leaveDirty = JSON.stringify(localLeavePolicy) !== JSON.stringify(leavePolicy);
        return statutoryDirty || profileDirty || leaveDirty;
    }, [formData, config, profileData, companyProfile, localLeavePolicy, leavePolicy]);

    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    useEffect(() => {
        setActiveTab(isSetupMode ? 'COMPANY' : initialTab);
    }, [initialTab, isSetupMode]);

    const [showBackupModal, setShowBackupModal] = useState(false);
    const [encryptionKey, setEncryptionKey] = useState('');
    const [selectedBackupFile, setSelectedBackupFile] = useState<File | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authPassword, setAuthPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [pendingAuthAction, setPendingAuthAction] = useState<(() => void) | null>(null);

    const [showSMTPModal, setShowSMTPModal] = useState(false);
    const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

    const [isProcessing, setIsProcessing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const [processProgress, setProcessProgress] = useState(0);
    const [processStatus, setProcessStatus] = useState('');
    const [isSqliteFile, setIsSqliteFile] = useState(false);

    const [licenseInfo, setLicenseInfo] = useState<LicenseData | null>(() => getStoredLicense());
    const [newLicenseKey, setNewLicenseKey] = useState('');
    const [newUserName, setNewUserName] = useState(licenseInfo?.userName || '');
    const [newRegEmail, setNewRegEmail] = useState('');
    const [newRegMobile, setNewRegMobile] = useState('');
    const [newUserID, setNewUserID] = useState(licenseInfo?.userID || '');
    const [showResetModal, setShowResetModal] = useState(false);
    const [showPayrollResetModal, setShowPayrollResetModal] = useState(false);
    const [resetPassword, setResetPassword] = useState('');
    const [resetError, setResetError] = useState('');
    const [isActivating, setIsActivating] = useState(false);

    const [backupMode, setBackupMode] = useState<'EXPORT' | 'IMPORT'>('EXPORT');
    const [currentPass, setCurrentPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [isUpdatingPass, setIsUpdatingPass] = useState(false);
    const [showPassRules, setShowPassRules] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const backupFileRef = useRef<HTMLInputElement>(null);

    const progressRef = useRef<HTMLDivElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setLogo(base64String);
                localStorage.setItem('app_logo', base64String);
                if (window.electronAPI) window.electronAPI.dbSet('app_logo', base64String);
            };
            reader.readAsDataURL(file);
        }
    };


    useEffect(() => {
        if (progressRef.current) {
            progressRef.current.style.width = `${processProgress}%`;
        }
    }, [processProgress]);

    const [appUsers, setAppUsers] = useState<User[]>(() => {
        try { return JSON.parse(localStorage.getItem('app_users') || '[]'); } catch { return []; }
    });
    const [umForm, setUmForm] = useState({ name: '', username: '', password: '', role: 'User' as 'Administrator' | 'User', email: '' });
    const [umEditId, setUmEditId] = useState<string | null>(null);
    const [umShowPwd, setUmShowPwd] = useState(false);
    const [umError, setUmError] = useState('');
    const umNameRef = useRef<HTMLInputElement>(null);

    const saveAppUsers = (users: User[]) => {
        setAppUsers(users);
        localStorage.setItem('app_users', JSON.stringify(users));
        if (window.electronAPI) window.electronAPI.dbSet('app_users', users);
    };

    const handleUmSave = async () => {
        setUmError('');
        if (!umForm.name.trim() || !umForm.username.trim() || !umForm.password.trim()) {
            setUmError('All fields are required.'); return;
        }

        const cleanUsername = umForm.username.trim().toLowerCase();
        const existing = appUsers.find(u => u.username.toLowerCase() === cleanUsername && u.username.toLowerCase() !== umEditId?.toLowerCase());
        if (existing) { setUmError('Username already exists.'); return; }

        if (umEditId) {
            const updated = appUsers.map(u => u.username.toLowerCase() === umEditId.toLowerCase() ? { ...u, name: umForm.name.trim(), username: cleanUsername, password: umForm.password, role: umForm.role } : u);
            saveAppUsers(updated);
        } else {
            const newUser: User = { name: umForm.name.trim(), username: cleanUsername, password: umForm.password, role: umForm.role, email: umForm.email };
            saveAppUsers([...appUsers, newUser]);
        }
        setUmForm({ name: '', username: '', password: '', role: 'User', email: '' });
        setUmEditId(null);
        setUmShowPwd(false);
    };

    const handleUmEdit = (u: User) => {
        setUmForm({ name: u.name, username: u.username, password: u.password ?? '', role: (u.role === 'Administrator' ? 'Administrator' : 'User'), email: u.email || '' });
        setUmEditId(u.username);
        setUmShowPwd(false);
        setUmError('');
        setTimeout(() => umNameRef.current?.focus(), 100);
    };

    const handleUmDelete = (username: string) => {
        if (username === currentUser?.username) { setUmError("You cannot delete your own account."); return; }
        saveAppUsers(appUsers.filter(u => u.username !== username));
    };

    useEffect(() => {
        if (licenseInfo) {
            setNewRegEmail(licenseInfo.registeredTo || '');
            setNewRegMobile(licenseInfo.registeredMobile || '');
            setNewUserName(licenseInfo.userName || '');
            setNewUserID(licenseInfo.userID || '');
        }
    }, [licenseInfo]);

    const handleCloudSync = async () => {
        setIsSyncing(true);
        try {
            const result = await validateLicenseStartup(true); // Force sync
            const updated = getStoredLicense();
            setLicenseInfo(updated);
            if (result.valid) {
                showAlert?.('success', 'Sync Successful', 'License credentials and limits refreshed from cloud.');
                // Trigger global refresh to update Header UI
                onRestore();
            } else {
                showAlert?.('warning', 'Sync Issue', result.message || 'Could not verify license status.');
            }
        } catch (error) {
            showAlert?.('danger', 'Sync Failed', 'Connection error while contacting licensing server.');
        } finally {
            setIsSyncing(false);
        }
    };

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

    const executeImport = async () => {
        const file = selectedBackupFile;
        if (!file || (!encryptionKey && !isSqliteFile)) {
            showAlert?.('warning', 'Missing Information', 'Please select a file and enter the decryption password.');
            return;
        }

        setIsProcessing(true);
        setProcessProgress(0);

        if (isSqliteFile) {
            try {
                setProcessStatus('Restoring Database File...');
                setProcessProgress(40);
                const res = await window.electronAPI.restoreSqliteBackup((file as unknown as { path: string }).path);
                if (res.success) {
                    setProcessProgress(100);
                    const dataKeys = ['app_employees', 'app_config', 'app_company_profile', 'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 'app_payroll_history', 'app_fines', 'app_leave_policy', 'app_arrear_history', 'app_logo', 'app_master_designations', 'app_master_divisions', 'app_master_branches', 'app_master_sites', 'app_ot_records'];
                    const systemKeys = ['app_license_secure', 'app_data_size', 'app_machine_id', 'app_setup_complete', 'app_users'];

                    for (const k of dataKeys) {
                        const dbRes = await window.electronAPI.dbGet(k);
                        if (dbRes.success && dbRes.data !== null && dbRes.data !== undefined) {
                            localStorage.setItem(k, typeof dbRes.data === 'string' ? dbRes.data : JSON.stringify(dbRes.data));
                        } else {
                            localStorage.removeItem(k);
                        }
                    }

                    for (const k of systemKeys) {
                        const dbRes = await window.electronAPI.dbGet(k);
                        if (dbRes.success && dbRes.data !== null && dbRes.data !== undefined) {
                            localStorage.setItem(k, typeof dbRes.data === 'string' ? dbRes.data : JSON.stringify(dbRes.data));
                        }
                    }

                    await delay(500);
                    setIsProcessing(false);
                    setShowBackupModal(false);
                    setSelectedBackupFile(null);
                    setEncryptionKey('');
                    onRestore();
                    return;
                } else {
                    throw new Error(res.error || "Failed to restore database file.");
                }
            } catch (err: any) {
                setIsProcessing(false);
                showAlert?.('error', 'Restoration Failed', `Restore Error: ${err.message}`);
                return;
            }
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result;
                if (!content) throw new Error("Could not read file content");

                const encryptedContent = content as string;
                setProcessStatus('Decrypting secure archive...');
                setProcessProgress(20);
                await delay(300);

                let decryptedString = '';
                try {
                    const bytes = CryptoJS.AES.decrypt(encryptedContent, encryptionKey);
                    decryptedString = bytes.toString(CryptoJS.enc.Utf8);
                    setProcessProgress(50);
                    if (!decryptedString) throw new Error("Invalid Decryption Result");
                } catch (cryptoErr) {
                    throw new Error("Wrong Password or Corrupt File");
                }

                setProcessStatus('Decoding binary structures...');
                setProcessProgress(60);
                await delay(200);
                const data = JSON.parse(decryptedString);
                setProcessProgress(70);

                setProcessStatus('Migrating local databases...');
                const dataKeys = ['app_employees', 'app_config', 'app_company_profile', 'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 'app_payroll_history', 'app_fines', 'app_leave_policy', 'app_arrear_history', 'app_logo', 'app_users', 'app_ot_records'];
                dataKeys.forEach(k => localStorage.removeItem(k));

                const keyMap: Record<string, string[]> = {
                    'employees': ['employees'],
                    'config': ['config'],
                    'company_profile': ['company_profile', 'companyProfile'],
                    'attendance': ['attendance'],
                    'leave_ledgers': ['leave_ledgers', 'leaveLedgers'],
                    'advance_ledgers': ['advance_ledgers', 'advanceLedgers'],
                    'payroll_history': ['payroll_history', 'payrollHistory'],
                    'fines': ['fines'],
                    'leave_policy': ['leave_policy', 'leavePolicy'],
                    'arrear_history': ['arrear_history', 'arrearHistory'],
                    'ot_records': ['ot_records', 'otRecords'],
                    'logo': ['logo'],
                    'users': ['users']
                };

                Object.entries(keyMap).forEach(([storageKey, bundleKeys]) => {
                    let val = null;
                    for (const bk of bundleKeys) {
                        val = data[bk] || data[`app_${bk}`];
                        if (val) break;
                    }
                    if (val) localStorage.setItem(`app_${storageKey}`, JSON.stringify(val));
                });

                const masters = data.masters || data.app_masters;
                if (masters) {
                    localStorage.setItem('app_master_designations', JSON.stringify(masters.designations));
                    localStorage.setItem('app_master_divisions', JSON.stringify(masters.divisions));
                    localStorage.setItem('app_master_branches', JSON.stringify(masters.branches));
                    localStorage.setItem('app_master_sites', JSON.stringify(masters.sites));
                }

                setProcessProgress(100);
                setProcessStatus('Restoration Finalized!');
                await delay(800);

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
                    ), () => {
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
        if (!file || (!encryptionKey && !isSqliteFile)) {
            showAlert?.('warning', 'Input Required', 'Please select a backup file and enter the decryption password.');
            return;
        }

        // 2FA: Require Login Password to finalize the restore
        requireAuth(() => {
            if (hasData) {
                setShowOverwriteConfirm(true);
            } else {
                executeImport();
            }
        });
    };

    const requireAuth = (callback: () => void) => {
        setPendingAuthAction(() => callback);
        setAuthPassword('');
        setAuthError('');
        setShowAuthModal(true);
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
                employees: (() => { try { return JSON.parse(localStorage.getItem('app_employees') || '[]'); } catch { return []; } })(),
                config: (() => { try { return JSON.parse(localStorage.getItem('app_config') || '{}'); } catch { return {}; } })(),
                company_profile: (() => { try { return JSON.parse(localStorage.getItem('app_company_profile') || '{}'); } catch { return {}; } })(),
                attendance: (() => { try { return JSON.parse(localStorage.getItem('app_attendance') || '[]'); } catch { return []; } })(),
                leave_ledgers: (() => { try { return JSON.parse(localStorage.getItem('app_leave_ledgers') || '[]'); } catch { return []; } })(),
                advance_ledgers: (() => { try { return JSON.parse(localStorage.getItem('app_advance_ledgers') || '[]'); } catch { return []; } })(),
                payroll_history: (() => { try { return JSON.parse(localStorage.getItem('app_payroll_history') || '[]'); } catch { return []; } })(),
                fines: (() => { try { return JSON.parse(localStorage.getItem('app_fines') || '[]'); } catch { return []; } })(),
                leave_policy: (() => { try { return JSON.parse(localStorage.getItem('app_leave_policy') || '{}'); } catch { return {}; } })(),
                arrear_history: (() => { try { return JSON.parse(localStorage.getItem('app_arrear_history') || '[]'); } catch { return []; } })(),
                ot_records: (() => { try { return JSON.parse(localStorage.getItem('app_ot_records') || '[]'); } catch { return []; } })(),
                users: (() => { try { return JSON.parse(localStorage.getItem('app_users') || '[]'); } catch { return []; } })(),
                developerMetadata: {
                    lastNewsDate: localStorage.getItem('app_last_news_date') || "",
                    lastStatutoryDate: localStorage.getItem('app_last_statutory_date') || ""
                },
                masters: {
                    designations: (() => { try { return JSON.parse(localStorage.getItem('app_master_designations') || '[]'); } catch { return []; } })(),
                    divisions: (() => { try { return JSON.parse(localStorage.getItem('app_master_divisions') || '[]'); } catch { return []; } })(),
                    branches: (() => { try { return JSON.parse(localStorage.getItem('app_master_branches') || '[]'); } catch { return []; } })(),
                    sites: (() => { try { return JSON.parse(localStorage.getItem('app_master_sites') || '[]'); } catch { return []; } })(),
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
            if (today.getMonth() < 3) fyStart = fyStart - 1;
            const fyEnd = fyStart + 1;
            const compName = companyProfile.establishmentName ? companyProfile.establishmentName.replace(/[^a-zA-Z0-9]/g, '_') : 'Company';
            a.download = `${compName}_Backup_${fyStart}-${fyEnd}.enc`;
            if (window.electronAPI && window.electronAPI.runBackup) {
                setProcessStatus('Saving to BharatPP location...');
                const res = await window.electronAPI.runBackup(encrypted);
                if (res.success) {
                    setProcessProgress(100);
                    setProcessStatus('Backup Saved Successfully');
                    showAlert?.('success', 'Safe Local Backup Created', `Your data has been encrypted and saved as: ${res.fileName}`);
                } else throw new Error(res.error);
            } else {
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                setProcessProgress(100);
                setProcessStatus('Export Complete');
            }
            setTimeout(() => { setShowBackupModal(false); setEncryptionKey(''); setIsProcessing(false); }, 1500);
        } catch (e: any) {
            setIsProcessing(false);
            showAlert?.('error', 'Export Failed', e.message || 'Encryption failed.');
        }
    };

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

    const handleOTToggle = (key: keyof StatutoryConfig['otComponents']) => {
        const currentComponents = formData.otComponents || INITIAL_STATUTORY_CONFIG.otComponents;
        setFormData({
            ...formData,
            otComponents: {
                ...currentComponents,
                [key]: !currentComponents[key]
            }
        });
    };

    const handlePFOriginalWagesToggle = (key: keyof StatutoryConfig['pfOriginalWagesComponents']) => {
        const currentComponents = formData.pfOriginalWagesComponents || INITIAL_STATUTORY_CONFIG.pfOriginalWagesComponents;
        setFormData({
            ...formData,
            pfOriginalWagesComponents: {
                ...currentComponents,
                [key]: !currentComponents[key]
            }
        });
    };

    const handleESIOriginalWagesToggle = (key: keyof StatutoryConfig['esiOriginalWagesComponents']) => {
        const currentComponents = formData.esiOriginalWagesComponents || INITIAL_STATUTORY_CONFIG.esiOriginalWagesComponents;
        setFormData({
            ...formData,
            esiOriginalWagesComponents: {
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
                                const signature = String.fromCharCode(...Array.from(arr));
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
            <div className="sticky top-0 z-30 bg-[#020617] -mt-8 pb-1 border-b border-slate-700 flex flex-col">
                {/* Top Row: Title & Save Button */}
                <div className="flex items-center justify-between px-6 py-3 bg-[#020617]">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-inner">
                            <SettingsIcon size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">System Configuration</h2>
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Establishment Compliance & Advanced Settings</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {isDirty && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-pulse">
                                <AlertCircle size={12} className="text-amber-500" />
                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Unsaved Changes</span>
                            </div>
                        )}
                        <button 
                            onClick={handleSave} 
                            className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[11px] font-black transition-all shadow-xl active:scale-95 ${
                                saved 
                                ? 'bg-emerald-600 text-white shadow-emerald-900/40 ring-2 ring-emerald-500/50' 
                                : isDirty 
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-900/40 ring-2 ring-white/20' 
                                    : 'bg-slate-800 text-slate-400 cursor-default opacity-80'
                            }`} 
                            title="Save Configuration" 
                            aria-label="Save Configuration"
                        >
                            {saved ? <CheckCircle2 size={14} /> : isDirty ? <Save size={14} /> : <Save size={14} />}
                            {saved ? 'DATA SAVED' : isDirty ? 'SAVE CONFIGURATION' : 'SAVE CONFIGURATION'}
                        </button>
                    </div>
                </div>

                {/* Bottom Row: Navigation Tabs */}
                <div className="flex overflow-x-auto pb-1 custom-scrollbar scroll-smooth px-4 mt-1 border-b border-white/5">
                    <button onClick={() => setActiveTab('STATUTORY')} title="Switch to Statutory Rules Tab" aria-label="Switch to Statutory Rules Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === 'STATUTORY' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                        <ShieldCheck size={14} /> STATUTORY RULES
                    </button>
                    <button onClick={() => setActiveTab('COMPANY')} title="Switch to Company Profile Tab" aria-label="Switch to Company Profile Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === 'COMPANY' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                        <Building2 size={14} /> COMPANY PROFILE
                    </button>
                    <button onClick={() => setActiveTab('DATA')} title="Switch to Data Management Tab" aria-label="Switch to Data Management Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === 'DATA' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                        <Database size={14} /> DATA MANAGEMENT
                    </button>
                    {userRole === 'Developer' && (
                        <button onClick={() => setActiveTab('DEVELOPER')} title="Switch to Developer Options Tab" aria-label="Switch to Developer Options Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === 'DEVELOPER' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                            <Megaphone size={14} /> DEVELOPER OPTIONS
                        </button>
                    )}
                    {!isSetupMode && (
                        <button onClick={() => setActiveTab('LICENSE')} title="Switch to License Management Tab" aria-label="Switch to License Management Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === 'LICENSE' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                            <ShieldCheck size={14} /> LICENSE MANAGEMENT
                        </button>
                    )}
                    {(licenseInfo || !isSetupMode || appUsers.length > 0) && (
                        <button onClick={() => setActiveTab('USERS')} title="Switch to User Management Tab" aria-label="Switch to User Management Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === 'USERS' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                            <Users size={14} /> USER MANAGEMENT
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'STATUTORY' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="bg-amber-900/20 border border-amber-700/50 p-6 rounded-2xl flex gap-4 text-amber-200">
                        <AlertCircle size={28} className="shrink-0 text-amber-400" />
                        <div className="text-sm space-y-2">
                            <p className="font-bold text-lg text-amber-400">Compliance & Parameter Configuration</p>
                            <p className="text-slate-300">These Settings Define How PF, ESI, Leave Policy and Taxes are Calculated Establishment wise</p>
                        </div>
                    </div>

                    {/* Statutory Calculation Configuration - NEW GLOBAL TOGGLE */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl animate-in slide-in-from-top-4 duration-500">
                        <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-blue-900/30 text-blue-400 rounded-xl border border-blue-500/20 shadow-inner">
                                    <Scale size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-black uppercase tracking-tighter text-lg text-white">Statutory Calculation Configuration</h3>
                                        <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded text-[9px] font-black text-blue-400 uppercase tracking-widest">Global Policy</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Choose the wage basis for PF & ESI contributions.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 bg-slate-900/80 p-1.5 px-3 rounded-2xl border border-slate-800 shadow-inner">
                                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${formData.pfEsiCalculationBasis === 'LabourCode' ? 'text-slate-500' : 'text-amber-400'}`}>
                                    {formData.pfEsiCalculationBasis === 'LabourCode' ? 'LABOUR CODE (CLAUSE 88)' : 'ORIGINAL WAGES BASIS'}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.pfEsiCalculationBasis === 'OriginalWages'}
                                        onChange={(e) => setFormData({ ...formData, pfEsiCalculationBasis: e.target.checked ? 'OriginalWages' : 'LabourCode' })}
                                        title="Toggle Calculation Basis"
                                    />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-lg"></div>
                                </label>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Card 1: Labour Code */}
                            <button
                                onClick={() => setFormData({ ...formData, pfEsiCalculationBasis: 'LabourCode' })}
                                className={`group relative p-6 rounded-2xl border-2 transition-all text-left overflow-hidden ${formData.pfEsiCalculationBasis === 'LabourCode' ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-900/20' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 opacity-60 hover:opacity-100'}`}
                                title="Select Labour Code Wages Basis"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2 rounded-lg ${formData.pfEsiCalculationBasis === 'LabourCode' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500 grupo-hover:bg-slate-700'}`}>
                                        <CheckCircle2 size={16} />
                                    </div>
                                    <h4 className="font-bold text-sm tracking-tight">Labour Code Wages</h4>
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                                    PF/ESI Wages = Basic + DA + Excess Allowances (if Allowances &gt; 50% of Gross). Subject to Statutory Ceiling for PF.
                                </p>
                                {formData.pfEsiCalculationBasis === 'LabourCode' && (
                                    <div className="absolute top-0 right-0 p-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                                    </div>
                                )}
                            </button>

                            {/* Card 2: Original Wages */}
                            <button
                                onClick={() => setFormData({ ...formData, pfEsiCalculationBasis: 'OriginalWages' })}
                                className={`group relative p-6 rounded-2xl border-2 transition-all text-left overflow-hidden ${formData.pfEsiCalculationBasis === 'OriginalWages' ? 'bg-amber-600/10 border-amber-500 shadow-lg shadow-amber-900/20' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 opacity-60 hover:opacity-100'}`}
                                title="Select Original Wages Basis"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2 rounded-lg ${formData.pfEsiCalculationBasis === 'OriginalWages' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-500 grupo-hover:bg-slate-700'}`}>
                                        {formData.pfEsiCalculationBasis === 'OriginalWages' ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-slate-700" />}
                                    </div>
                                    <h4 className="font-bold text-sm tracking-tight">Original Wages</h4>
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                                    PF/ESI Wages based on selected components below. Subject to Statutory Ceiling for PF unless (Higher Rule) is opted.
                                </p>
                                {formData.pfEsiCalculationBasis === 'OriginalWages' && (
                                    <div className="absolute top-0 right-0 p-2">
                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* PF ORIGINAL WAGES COMPONENTS - Only shows if OriginalWages selected */}
                    {formData.pfEsiCalculationBasis === 'OriginalWages' && (
                        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl animate-in slide-in-from-top-4 duration-500">
                            <div className="p-4 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Landmark size={16} className="text-blue-400" />
                                    <h3 className="font-black uppercase tracking-tighter text-xs text-slate-300">PF Original Wages Components</h3>
                                </div>
                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Select components to include for PF Base</span>
                            </div>
                            <div className="p-5">
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    {[
                                        { key: 'basic', label: 'Basic Pay' }, { key: 'da', label: 'DA' }, { key: 'retaining', label: 'Retn Allow' },
                                        { key: 'hra', label: 'HRA' }, { key: 'conveyance', label: 'Conveyance' }, { key: 'washing', label: 'Washing' },
                                        { key: 'attire', label: 'Attire' }, { key: 'special1', label: 'Allow 1' }, { key: 'special2', label: 'Allow 2' },
                                        { key: 'special3', label: 'Allow 3' },
                                    ].map(comp => {
                                        const components = formData.pfOriginalWagesComponents || INITIAL_STATUTORY_CONFIG.pfOriginalWagesComponents;
                                        const isActive = components[comp.key as keyof typeof components];
                                        return (
                                            <button 
                                                key={comp.key} 
                                                onClick={() => handlePFOriginalWagesToggle(comp.key as any)} 
                                                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm ${isActive ? 'bg-blue-600 border-blue-400 text-white shadow-blue-900/20' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                                                title={`Toggle ${comp.label} for PF Base`}
                                            >
                                                {isActive ? <CheckSquare size={14} className="shrink-0" /> : <Square size={14} className="shrink-0 opacity-40" />}
                                                <span className="truncate">{comp.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ESI ORIGINAL WAGES COMPONENTS - Only shows if OriginalWages selected */}
                    {formData.pfEsiCalculationBasis === 'OriginalWages' && (
                        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl animate-in slide-in-from-top-4 duration-500">
                            <div className="p-4 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Heart size={16} className="text-pink-400" />
                                    <h3 className="font-black uppercase tracking-tighter text-xs text-slate-300">ESI Original Wages Components</h3>
                                </div>
                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Select components to include for ESI Base</span>
                            </div>
                            <div className="p-5">
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    {[
                                        { key: 'basic', label: 'Basic Pay' }, { key: 'da', label: 'DA' }, { key: 'retaining', label: 'Retn Allow' },
                                        { key: 'hra', label: 'HRA' }, { key: 'conveyance', label: 'Conveyance' }, { key: 'washing', label: 'Washing' },
                                        { key: 'attire', label: 'Attire' }, { key: 'special1', label: 'Allow 1' }, { key: 'special2', label: 'Allow 2' },
                                        { key: 'special3', label: 'Allow 3' },
                                    ].map(comp => {
                                        const components = formData.esiOriginalWagesComponents || INITIAL_STATUTORY_CONFIG.esiOriginalWagesComponents;
                                        const isActive = components[comp.key as keyof typeof components];
                                        return (
                                            <button 
                                                key={comp.key} 
                                                onClick={() => handleESIOriginalWagesToggle(comp.key as any)} 
                                                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm ${isActive ? 'bg-pink-600 border-pink-400 text-white shadow-pink-900/20' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-pink-900/20 hover:border-pink-500/30'}`}
                                                title={`Toggle ${comp.label} for ESI Base`}
                                            >
                                                {isActive ? <CheckSquare size={14} className="shrink-0" /> : <Square size={14} className="shrink-0 opacity-40" />}
                                                <span className="truncate">{comp.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
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
                                                <button
                                                    onClick={() => handlePFTypeChange('Statutory')}
                                                    title="Set PF Compliance to Statutory (12%)"
                                                    aria-label="Set PF Compliance to Statutory (12%)"
                                                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${formData.pfComplianceType === 'Statutory' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                                                >
                                                    Statutory (12%)
                                                </button>
                                                <button
                                                     onClick={() => handlePFTypeChange('Voluntary')}
                                                     title="Set PF Compliance to Voluntary (10%)"
                                                     aria-label="Set PF Compliance to Voluntary (10%)"
                                                     className={`py-2 text-xs font-bold rounded-lg border transition-all ${formData.pfComplianceType === 'Voluntary' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                                                 >
                                                     Voluntary (10%)
                                                 </button>
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
                                    <div className="space-y-1"><label htmlFor="esi-ceiling" className="text-[10px] font-bold text-slate-500 uppercase">ESI Ceiling (₹)</label><input id="esi-ceiling" type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.esiCeiling} onChange={e => setFormData({ ...formData, esiCeiling: +e.target.value })} title="ESI Eligibility Ceiling" aria-label="ESI Eligibility Ceiling" /></div>
                                    <div className="space-y-1"><label htmlFor="esi-employee-rate" className="text-[10px] font-bold text-slate-500 uppercase">EE Rate (%)</label><input id="esi-employee-rate" type="number" step="0.001" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.esiEmployeeRate * 100} onChange={e => setFormData({ ...formData, esiEmployeeRate: +e.target.value / 100 })} title="Employee ESI Rate" aria-label="Employee ESI Rate" /></div>
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
                                <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-2"><Percent size={14} className="text-amber-400" /><span className="text-xs font-bold text-slate-300 uppercase">Annual Bonus Policy</span></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><label htmlFor="bonus-rate" className="text-[10px] font-bold text-slate-500 uppercase">Rate (%)</label><input id="bonus-rate" type="number" step="0.0001" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={(formData.bonusRate * 100).toFixed(2)} onChange={e => setFormData({ ...formData, bonusRate: +e.target.value / 100 })} title="Annual Bonus Rate" aria-label="Annual Bonus Rate" /></div>
                                    <div className="flex flex-col justify-end"><span className="text-[9px] text-slate-500 italic">Standard: 8.33% Min</span></div>
                                </div>
                            </div>
                            <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                                <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-2"><Building2 size={14} className="text-blue-400" /><span className="text-xs font-bold text-slate-300 uppercase">LIC Gratuity Policy</span></div>
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
                                    <div className="space-y-1"><label htmlFor="el-label" className="text-[10px] font-bold text-slate-500 uppercase">Label</label><input id="el-label" type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" value={localLeavePolicy.el.label} onChange={e => handleLeavePolicyChange('el', 'label', e.target.value)} title="Earned Leave Label" aria-label="Earned Leave Label" /></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1"><label htmlFor="el-max" className="text-[10px] font-bold text-slate-500 uppercase">Max/Year</label><input id="el-max" type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.el.maxPerYear} onChange={e => handleLeavePolicyChange('el', 'maxPerYear', +e.target.value)} title="Maximum EL per Year" aria-label="Maximum EL per Year" /></div>
                                        <div className="space-y-1"><label htmlFor="el-carry" className="text-[10px] font-bold text-slate-500 uppercase">Carry Fwd</label><input id="el-carry" type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.el.maxCarryForward} onChange={e => handleLeavePolicyChange('el', 'maxCarryForward', +e.target.value)} title="Maximum EL Carry Forward" aria-label="Maximum EL Carry Forward" /></div>
                                    </div>
                                </div>
                            </div>
                            {/* SL */}
                            <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                                <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-2"><span className="text-xs font-bold text-slate-300 uppercase">Sick Leave (SL)</span></div>
                                <div className="space-y-2">
                                    <div className="space-y-1"><label htmlFor="sl-label" className="text-[10px] font-bold text-slate-500 uppercase">Label</label><input id="sl-label" type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" value={localLeavePolicy.sl.label} onChange={e => handleLeavePolicyChange('sl', 'label', e.target.value)} title="Sick Leave Label" aria-label="Sick Leave Label" /></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1"><label htmlFor="sl-max" className="text-[10px] font-bold text-slate-500 uppercase">Max/Year</label><input id="sl-max" type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.sl.maxPerYear} onChange={e => handleLeavePolicyChange('sl', 'maxPerYear', +e.target.value)} title="Maximum SL per Year" aria-label="Maximum SL per Year" /></div>
                                        <div className="space-y-1"><label htmlFor="sl-carry" className="text-[10px] font-bold text-slate-500 uppercase">Carry Fwd</label><input id="sl-carry" type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.sl.maxCarryForward} onChange={e => handleLeavePolicyChange('sl', 'maxCarryForward', +e.target.value)} title="Maximum SL Carry Forward" aria-label="Maximum SL Carry Forward" /></div>
                                    </div>
                                </div>
                            </div>
                            {/* CL */}
                            <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                                <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-2"><span className="text-xs font-bold text-slate-300 uppercase">Casual Leave (CL)</span></div>
                                <div className="space-y-2">
                                    <div className="space-y-1"><label htmlFor="cl-label" className="text-[10px] font-bold text-slate-500 uppercase">Label</label><input id="cl-label" type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" value={localLeavePolicy.cl.label} onChange={e => handleLeavePolicyChange('cl', 'label', e.target.value)} title="Casual Leave Label" aria-label="Casual Leave Label" /></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1"><label htmlFor="cl-max" className="text-[10px] font-bold text-slate-500 uppercase">Max/Year</label><input id="cl-max" type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.cl.maxPerYear} onChange={e => handleLeavePolicyChange('cl', 'maxPerYear', +e.target.value)} title="Maximum CL per Year" aria-label="Maximum CL per Year" /></div>
                                        <div className="space-y-1"><label htmlFor="cl-carry" className="text-[10px] font-bold text-slate-500 uppercase">Carry Fwd</label><input id="cl-carry" type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.cl.maxCarryForward} onChange={e => handleLeavePolicyChange('cl', 'maxCarryForward', +e.target.value)} title="Maximum CL Carry Forward" aria-label="Maximum CL Carry Forward" /></div>
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
                                    return <button key={comp.key} onClick={() => handleLeaveWagesToggle(comp.key as any)} className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold transition-all ${isActive ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`} title={`Toggle ${comp.label} for Leave Encashment`} aria-label={`Toggle ${comp.label} for Leave Encashment`}>{isActive ? <CheckSquare size={14} /> : <Square size={14} />}<span className="truncate">{comp.label}</span></button>;
                                })}
                            </div>
                            <div className="flex justify-end"><span className="text-[10px] text-slate-500 italic">* Default logic uses Basic + DA. Adjust according to company policy.</span></div>
                        </div>
                    </div>

                    {/* Overtime (OT) Policy */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                        <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Calculator className="text-blue-400" size={20} />
                                <h3 className="font-bold uppercase tracking-widest text-xs text-sky-400">Overtime (OT) Policy</h3>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer p-1.5 px-3 bg-blue-900/20 rounded-lg border border-blue-500/20 hover:bg-blue-900/30 transition-all">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-700 text-blue-500 bg-slate-900 accent-blue-500"
                                    checked={formData.enableOT || false}
                                    onChange={e => setFormData({ ...formData, enableOT: e.target.checked })}
                                    title="Enable Overtime Policy"
                                />
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Enable OT Policy</span>
                            </label>
                        </div>
                        {formData.enableOT && (
                            <div className="p-6 space-y-8 animate-in slide-in-from-top-4 duration-500">
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Calculation Factor:</span>
                                        <div className="flex gap-2 p-1 bg-slate-900 rounded-lg border border-slate-800">
                                            {[
                                                { label: 'Single Rate (1x)', value: 1 },
                                                { label: 'Double Rate (2x)', value: 2 }
                                            ].map(opt => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setFormData({ ...formData, otCalculationFactor: opt.value as 1 | 2 })}
                                                    className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${formData.otCalculationFactor === opt.value ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-slate-500 hover:text-slate-300'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                                        <Table size={14} className="text-blue-400" />
                                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Selected Wage Components for OT Calculation</span>
                                    </div>
                                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-3">
                                        {[
                                            { key: 'basic', label: 'Basic Pay' }, { key: 'da', label: 'DA' }, { key: 'retaining', label: 'Retn Allow' },
                                            { key: 'hra', label: 'HRA' }, { key: 'conveyance', label: 'Conveyance' }, { key: 'washing', label: 'Washing' },
                                            { key: 'attire', label: 'Attire' }, { key: 'special1', label: 'Special 1' }, { key: 'special2', label: 'Special 2' },
                                            { key: 'special3', label: 'Special 3' }
                                        ].map(comp => {
                                            const isActive = formData.otComponents?.[comp.key as keyof typeof formData.otComponents];
                                            return (
                                                <button
                                                    key={comp.key}
                                                    onClick={() => handleOTToggle(comp.key as any)}
                                                    title={`Toggle ${comp.label} for Overtime`}
                                                    className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold transition-all ${isActive ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                                                >
                                                    {isActive ? <CheckSquare size={14} /> : <Square size={14} />}
                                                    <span className="truncate">{comp.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex justify-end pr-1">
                                        <span className="text-[9px] text-slate-500 italic">* OT Rate Calculation: (Selected Components / Monthly Days) * (1x / 2x) * Capacity Factor.</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Arrear Salary Module Configuration */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                        <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="text-emerald-400" size={20} />
                                <h3 className="font-bold uppercase tracking-widest text-xs text-emerald-400">Arrear Salary Module</h3>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer p-1.5 px-3 bg-emerald-900/20 rounded-lg border border-emerald-500/20 hover:bg-emerald-900/30 transition-all">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-700 text-emerald-500 bg-slate-900 accent-emerald-500"
                                    checked={formData.enableArrearSalary || false}
                                    onChange={e => setFormData({ ...formData, enableArrearSalary: e.target.checked })}
                                    title="Enable Arrear Salary Module"
                                />
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Enable Arrear Module</span>
                            </label>
                        </div>
                        <div className="p-6 bg-slate-900/30">
                            <p className="text-[11px] text-slate-400 leading-relaxed italic">
                                "Enabling this module allows processing of salary arrears for previous months within the current pay cycle. A dedicated 'Arrear Salary' tab will appear in the Pay Process workspace."
                            </p>
                        </div>
                    </div>

                    {/* PT Matrix */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                        <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3"><ScrollText className="text-amber-400" size={20} /><h3 className="font-bold uppercase tracking-widest text-xs text-amber-400">Professional Tax (PT) Matrix</h3></div>
                            <div className="flex items-center gap-4">
                                <select id="pt-preset-select" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none" value={selectedStatePreset} onChange={handleStatePresetChange} title="Select State Professional Tax Preset" aria-label="Select State Professional Tax Preset">{Object.keys(PT_STATE_PRESETS).map(s => <option key={s} value={s}>{s} Preset</option>)}</select>
                                <label htmlFor="enable-pt" className="flex items-center gap-2 cursor-pointer"><input id="enable-pt" type="checkbox" className="w-4 h-4 rounded border-slate-700 text-blue-500 bg-slate-900" checked={formData.enableProfessionalTax} onChange={e => setFormData({ ...formData, enableProfessionalTax: e.target.checked })} title="Enable Professional Tax Deduction" aria-label="Enable Professional Tax Deduction" /><span className="text-[10px] font-bold text-slate-400 uppercase">Enable PT</span></label>
                            </div>
                        </div>
                        {formData.enableProfessionalTax && (
                            <div className="p-6 space-y-6">
                                <div className="flex items-center gap-4"><span className="text-[10px] font-bold text-slate-500 uppercase">Deduction Cycle:</span><div className="flex gap-2">{['Monthly', 'HalfYearly'].map(c => (<button key={c} onClick={() => setFormData({ ...formData, ptDeductionCycle: c as any })} title={`Set PT Cycle to ${c}`} aria-label={`Set PT Cycle to ${c}`} className={`px-4 py-1.5 rounded-full text-[10px] font-bold border transition-all ${formData.ptDeductionCycle === c ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>{c}</button>))}</div></div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-800"><tr><th className="pb-3">Min Earnings (₹)</th><th className="pb-3">Max Earnings (₹)</th><th className="pb-3">Deduction (₹)</th><th className="pb-3 text-right">Action</th></tr></thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {formData.ptSlabs.map((slab, i) => (
                                                <tr key={i} className="group">
                                                    <td className="py-3"><input type="number" className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white w-24 font-mono" value={slab.min} onChange={e => handleSlabChange(i, 'min', +e.target.value)} title="Minimum Earnings for Slab" aria-label="Minimum Earnings for Slab" /></td>
                                                    <td className="py-3"><input type="number" className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white w-24 font-mono" value={slab.max} onChange={e => handleSlabChange(i, 'max', +e.target.value)} title="Maximum Earnings for Slab" aria-label="Maximum Earnings for Slab" /></td>
                                                    <td className="py-3"><input type="number" className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white w-24 font-mono font-bold text-amber-400" value={slab.amount} onChange={e => handleSlabChange(i, 'amount', +e.target.value)} title="PT Amount for Slab" aria-label="PT Amount for Slab" /></td>
                                                    <td className="py-3 text-right"><button onClick={() => handleDeleteSlab(i)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete PT Slab" aria-label="Delete PT Slab"><Trash2 size={14} /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <button onClick={handleAddSlab} title="Add New PT Slab Row" aria-label="Add New PT Slab Row" className="mt-4 flex items-center gap-2 text-[10px] font-bold text-sky-400 hover:text-sky-300"><Plus size={14} /> Add Slab Row</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* LWF */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                        <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3"><HandCoins className="text-emerald-400" size={20} /><h3 className="font-bold uppercase tracking-widest text-xs text-emerald-400">Labour Welfare Fund (LWF)</h3></div>
                            <div className="flex items-center gap-4">
                                <select id="lwf-state-select" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none" value={selectedLWFState} onChange={handleLWFStateChange} title="Select State Labour Welfare Fund Preset" aria-label="Select State Labour Welfare Fund Preset">{Object.keys(LWF_STATE_PRESETS).map(s => <option key={s} value={s}>{s} Preset</option>)}</select>
                                <label htmlFor="enable-lwf" className="flex items-center gap-2 cursor-pointer"><input id="enable-lwf" type="checkbox" className="w-4 h-4 rounded border-slate-700 text-emerald-500 bg-slate-900" checked={formData.enableLWF} onChange={e => setFormData({ ...formData, enableLWF: e.target.checked })} title="Enable Labour Welfare Fund Deduction" aria-label="Enable Labour Welfare Fund Deduction" /><span className="text-[10px] font-bold text-slate-400 uppercase">Enable LWF</span></label>
                            </div>
                        </div>
                        {formData.enableLWF && (
                            <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="space-y-1"><label htmlFor="lwf-cycle" className="text-[10px] font-bold text-slate-500 uppercase">Cycle</label><select id="lwf-cycle" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.lwfDeductionCycle} onChange={e => setFormData({ ...formData, lwfDeductionCycle: e.target.value as any })} title="LWF Deduction Cycle" aria-label="LWF Deduction Cycle"><option value="Monthly">Monthly</option><option value="HalfYearly">Half-Yearly</option><option value="Yearly">Yearly</option></select></div>
                                <div className="space-y-1"><label htmlFor="lwf-ee-contrib" className="text-[10px] font-bold text-slate-500 uppercase">EE Contribution (₹)</label><input id="lwf-ee-contrib" type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.lwfEmployeeContribution} onChange={e => setFormData({ ...formData, lwfEmployeeContribution: +e.target.value })} title="Employee LWF Contribution" aria-label="Employee LWF Contribution" /></div>
                                <div className="space-y-1"><label htmlFor="lwf-er-contrib" className="text-[10px] font-bold text-slate-500 uppercase">ER Contribution (₹)</label><input id="lwf-er-contrib" type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.lwfEmployerContribution} onChange={e => setFormData({ ...formData, lwfEmployerContribution: +e.target.value })} title="Employer LWF Contribution" aria-label="Employer LWF Contribution" /></div>
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
                                 <button onClick={() => setFormData({ ...formData, incomeTaxCalculationType: 'Manual' })} title="Set Income Tax Calculation to Manual" aria-label="Set Income Tax Calculation to Manual" className={`flex-1 py-3 px-4 rounded-xl border transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${formData.incomeTaxCalculationType === 'Manual' ? 'bg-sky-600 border-sky-500 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                     {formData.incomeTaxCalculationType === 'Manual' ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border border-slate-600" />} Manual (As per Import)
                                 </button>
                                 <button onClick={() => setFormData({ ...formData, incomeTaxCalculationType: 'Auto' })} title="Set Income Tax Calculation to Auto" aria-label="Set Income Tax Calculation to Auto" className={`flex-1 py-3 px-4 rounded-xl border transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${formData.incomeTaxCalculationType === 'Auto' ? 'bg-sky-600 border-sky-500 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
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
                                <button onClick={() => logoInputRef.current?.click()} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-full flex items-center justify-center transition-opacity" title="Change Company Logo" aria-label="Change Company Logo"><Camera className="text-white" size={24} /></button>
                            </div>
                            <div className="space-y-4"><div><h4 className="font-bold text-white text-lg">Company Logo</h4><p className="text-xs text-slate-400 mt-1">This logo will appear on all Pay Slips, Reports, and the Login screen.</p></div><button onClick={() => logoInputRef.current?.click()} title="Upload New Logo" aria-label="Upload New Logo" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"><Upload size={14} /> Upload New Logo</button><input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={handleLogoChange} title="Upload Company Logo" aria-label="Upload Company Logo" /></div>
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
                                    <div className="space-y-1"><label htmlFor="profile-est-name" className="text-[10px] font-bold text-slate-400 uppercase">Establishment Name*</label><input id="profile-est-name" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500 uppercase" placeholder="Your Name - as mentioned in App request mail" value={profileData.establishmentName} onChange={e => setProfileData({ ...profileData, establishmentName: e.target.value.toUpperCase() })} title="Establishment Name" aria-label="Establishment Name" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-trade-name" className="text-[10px] font-bold text-slate-400 uppercase">Trade Name (If Any)</label><input id="profile-trade-name" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Trade Name" value={profileData.tradeName} onChange={e => setProfileData({ ...profileData, tradeName: e.target.value })} title="Trade Name" aria-label="Trade Name" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-cin" className="text-[10px] font-bold text-sky-400 uppercase">CIN No (Corporate ID)*</label><input id="profile-cin" type="text" className="w-full bg-slate-900 border border-sky-900/50 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-500" value={profileData.cin} onChange={e => setProfileData({ ...profileData, cin: e.target.value })} placeholder="U00000XX0000XXX000000" title="Corporate Identification Number" aria-label="Corporate Identification Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-lin" className="text-[10px] font-bold text-sky-400 uppercase">LIN No (Labour ID)*</label><input id="profile-lin" type="text" className="w-full bg-slate-900 border border-sky-900/50 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-500" value={profileData.lin} onChange={e => setProfileData({ ...profileData, lin: e.target.value })} placeholder="L0000000000" title="Labour Identification Number" aria-label="Labour Identification Number" /></div>
                                </div>
                            </div>
                            {/* ... Registration Codes ... */}
                            <div className="md:col-span-3">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1 mt-2">Registration Codes</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1"><label htmlFor="profile-pf-code" className="text-[10px] font-bold text-slate-400 uppercase">PF Code</label><input id="profile-pf-code" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="PF Code" value={profileData.pfCode} onChange={e => setProfileData({ ...profileData, pfCode: e.target.value })} title="PF Code Number" aria-label="PF Code Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-esi-code" className="text-[10px] font-bold text-slate-400 uppercase">ESI Code</label><input id="profile-esi-code" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="ESI Code" value={profileData.esiCode} onChange={e => setProfileData({ ...profileData, esiCode: e.target.value })} title="ESI Code Number" aria-label="ESI Code Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-gst-no" className="text-[10px] font-bold text-slate-400 uppercase">GST No</label><input id="profile-gst-no" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="GST Number" value={profileData.gstNo} onChange={e => setProfileData({ ...profileData, gstNo: e.target.value })} title="GST Number" aria-label="GST Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-pan-no" className="text-[10px] font-bold text-slate-400 uppercase">PAN No</label><input id="profile-pan-no" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="PAN Number" value={profileData.pan} onChange={e => setProfileData({ ...profileData, pan: e.target.value })} title="PAN Number" aria-label="PAN Number" /></div>
                                </div>
                            </div>
                            {/* ... Address ... */}
                            <div className="md:col-span-3">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1 mt-2">Address Details (Registered Office)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1"><label htmlFor="profile-door-no" className="text-[10px] font-bold text-slate-400 uppercase">Door No / Flat No</label><input id="profile-door-no" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Door No" value={profileData.doorNo} onChange={e => setProfileData({ ...profileData, doorNo: e.target.value })} title="Door/Flat Number" aria-label="Door/Flat Number" /></div>
                                    <div className="space-y-1 md:col-span-2"><label htmlFor="profile-building" className="text-[10px] font-bold text-slate-400 uppercase">Building Name / Landmark</label><input id="profile-building" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Building Name" value={profileData.buildingName} onChange={e => setProfileData({ ...profileData, buildingName: e.target.value })} title="Building Name or Landmark" aria-label="Building Name or Landmark" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-street" className="text-[10px] font-bold text-slate-400 uppercase">Street</label><input id="profile-street" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Street" value={profileData.street} onChange={e => setProfileData({ ...profileData, street: e.target.value })} title="Street Name" aria-label="Street Name" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-locality" className="text-[10px] font-bold text-slate-400 uppercase">Locality</label><input id="profile-locality" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Locality" value={profileData.locality} onChange={e => setProfileData({ ...profileData, locality: e.target.value })} title="Locality" aria-label="Locality" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-area" className="text-[10px] font-bold text-slate-400 uppercase">Area</label><input id="profile-area" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Area" value={profileData.area} onChange={e => setProfileData({ ...profileData, area: e.target.value })} title="Area Name" aria-label="Area Name" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-city" className="text-[10px] font-bold text-slate-400 uppercase">City / Town</label><input id="profile-city" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="City" value={profileData.city} onChange={e => setProfileData({ ...profileData, city: e.target.value })} title="City or Town" aria-label="City or Town" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-state" className="text-[10px] font-bold text-slate-400 uppercase">State / Union Territory</label><select id="profile-state" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.state} onChange={e => setProfileData({ ...profileData, state: e.target.value })} title="Select State" aria-label="Select State">{INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                    <div className="space-y-1"><label htmlFor="profile-pincode" className="text-[10px] font-bold text-slate-400 uppercase">Pin Code</label><input id="profile-pincode" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="600001" value={profileData.pincode} onChange={e => setProfileData({ ...profileData, pincode: e.target.value })} title="Pincode" aria-label="Pincode" /></div>
                                </div>
                            </div>
                            {/* ... Contact ... */}
                            <div className="md:col-span-3">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1 mt-2">Contact & Online Presence</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1"><label htmlFor="profile-mobile" className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Phone size={10} /> Mobile No</label><input id="profile-mobile" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="Mobile Number" value={profileData.mobile} onChange={e => setProfileData({ ...profileData, mobile: e.target.value })} title="Mobile Number" aria-label="Mobile Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-telephone" className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Phone size={10} /> Land Line (Telephone)</label><input id="profile-telephone" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="Landline" value={profileData.telephone} onChange={e => setProfileData({ ...profileData, telephone: e.target.value })} title="Telephone Number" aria-label="Telephone Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-email" className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Mail size={10} /> Official Email</label><input id="profile-email" type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="mail@example.com" value={profileData.email} onChange={e => setProfileData({ ...profileData, email: e.target.value })} title="Official Email Address" aria-label="Official Email Address" /></div>
                                    <div className="space-y-1 md:col-span-2"><label htmlFor="profile-website" className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Globe size={10} /> Corporate Website</label><input id="profile-website" type="url" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="https://www.example.com" value={profileData.website} onChange={e => setProfileData({ ...profileData, website: e.target.value })} title="Corporate Website URL" aria-label="Corporate Website URL" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-business-nature" className="text-[10px] font-bold text-slate-400 uppercase">Nature of Business</label><select id="profile-business-nature" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.natureOfBusiness} onChange={e => setProfileData({ ...profileData, natureOfBusiness: e.target.value })} title="Select Nature of Business" aria-label="Select Nature of Business">{NATURE_OF_BUSINESS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                                </div>
                            </div>

                            {/* ... SMTP Configuration ... */}
                            <div className="md:col-span-3">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-4 mt-2">
                                    <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2"><Mail size={12} /> SMTP CONFIGURATION (FOR MAILING PAYSLIPS)</h4>
                                    <button onClick={() => setShowSMTPModal(true)} className="text-[9px] font-black bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-3 rounded-md uppercase tracking-widest transition-colors flex items-center gap-1"><AlertCircle size={10} /> HOW TO CONFIGURE?</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
                                    <div className="space-y-1 flex flex-col justify-end"><label htmlFor="smtp-host" className="text-[10px] font-bold text-slate-400 uppercase">SMTP HOST</label><input id="smtp-host" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-emerald-500 font-mono placeholder:text-slate-500" placeholder="smtp.gmail.com" value={profileData.smtpHost || ''} onChange={e => setProfileData({ ...profileData, smtpHost: e.target.value })} /></div>
                                    <div className="space-y-1 flex flex-col justify-end"><label htmlFor="smtp-port" className="text-[10px] font-bold text-slate-400 uppercase">PORT</label><input id="smtp-port" type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-emerald-500 font-mono placeholder:text-slate-500" placeholder="465" value={profileData.smtpPort || ''} onChange={e => { const port = parseInt(e.target.value); let sec = profileData.smtpSecurity || 'None'; if (port === 465) sec = 'SSL'; else if (port === 587) sec = 'TLS'; setProfileData({ ...profileData, smtpPort: port || undefined, smtpSecurity: sec as any }); }} /></div>
                                    <div className="space-y-1 flex flex-col justify-end"><label htmlFor="smtp-security" className="text-[10px] font-bold text-slate-400 uppercase">SECURITY</label><select id="smtp-security" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-emerald-500 font-mono" value={profileData.smtpSecurity || 'None'} onChange={e => setProfileData({ ...profileData, smtpSecurity: e.target.value as any })}><option value="None">None</option><option value="SSL">SSL</option><option value="TLS">TLS</option></select></div>
                                    <div className="space-y-1 flex flex-col justify-end"><label htmlFor="smtp-user" className="text-[10px] font-bold text-slate-400 uppercase">SMTP USER (EMAIL)</label><input id="smtp-user" type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-emerald-500 font-mono placeholder:text-slate-500" placeholder="your.email@gmail.com" value={profileData.smtpUser || ''} onChange={e => setProfileData({ ...profileData, smtpUser: e.target.value })} /></div>
                                    <div className="space-y-1 flex flex-col justify-end"><label htmlFor="smtp-password" className="text-[10px] font-bold text-slate-400 uppercase">SMTP PASSWORD</label><input id="smtp-password" type="password" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-emerald-500 font-mono placeholder:text-slate-500" placeholder="••••••••••••••••" value={profileData.smtpPassword || ''} onChange={e => setProfileData({ ...profileData, smtpPassword: e.target.value })} /></div>
                                    <div className="space-y-1 flex flex-col justify-end"><label htmlFor="smtp-sender-name" className="text-[10px] font-bold text-slate-400 uppercase">SENDER NAME (IN MAIL)</label><input id="smtp-sender-name" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-500" placeholder="HR Department" value={profileData.senderName || ''} onChange={e => setProfileData({ ...profileData, senderName: e.target.value })} /></div>
                                    <div className="space-y-1 flex flex-col justify-end md:col-span-2 xl:col-span-3"><label htmlFor="smtp-sender-email" className="text-[10px] font-bold text-slate-400 uppercase">REPLY-TO EMAIL (IF DIFFERENT)</label><input id="smtp-sender-email" type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-emerald-500 font-mono placeholder:text-slate-500" placeholder="hr@yourcompany.com" value={profileData.senderEmail || ''} onChange={e => setProfileData({ ...profileData, senderEmail: e.target.value })} /></div>
                                </div>
                            </div>

                            {/* Payroll Security PIN Section */}
                            <div className="md:col-span-3">
                                <div className="flex items-center gap-3 border-b border-slate-800 pb-2 mb-4 mt-4">
                                    <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                                        <Lock size={12} /> PAYROLL SECURITY PIN (MANDATORY FOR FREEZE)
                                    </h4>
                                </div>
                                <div className="bg-amber-900/10 border border-amber-700/20 p-6 rounded-xl space-y-4">
                                    <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                                        <div className="flex-1 space-y-2">
                                            <p className="text-[11px] text-amber-200/70 leading-relaxed">
                                                This separate PIN is required whenever you **Freeze Attendance** or **Finalize Payroll**. 
                                                It ensures that critical data backups cannot be initiated without explicit authorization.
                                            </p>
                                        </div>
                                        <div className="w-full md:w-64 relative">
                                            <label htmlFor="security-pin-input" className="text-[9px] font-black text-amber-500/50 uppercase tracking-widest mb-1.5 block">SECURITY PIN / PASSWORD</label>
                                            <div className="relative">
                                                <input 
                                                    id="security-pin-input"
                                                    type={showPin ? "text" : "password"} 
                                                    className="w-full bg-slate-950 border border-amber-900/30 rounded-lg p-3 text-sm text-white font-mono outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-700"
                                                    placeholder="Enter Security PIN"
                                                    value={profileData.securityPin || ''}
                                                    onChange={e => setProfileData({ ...profileData, securityPin: e.target.value })}
                                                    title="Set Security PIN for Payroll Operations"
                                                    aria-label="Set Security PIN for Payroll Operations"
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={() => setShowPin(!showPin)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400 transition-colors"
                                                    title={showPin ? "Hide PIN" : "Show PIN"}
                                                >
                                                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'DEVELOPER' && userRole === 'Developer' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-8 shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-900/40 text-indigo-400 rounded-xl border border-indigo-500/20 shadow-lg"><Megaphone size={28} /></div>
                                <div>
                                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Developer Command Center</h2>
                                    <p className="text-xs text-slate-400">Consolidated Global Messaging Board</p>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    setIsSyncing(true);
                                    const result = await fetchLatestMessages(true);
                                    setIsSyncing(false);
                                    if (result) {
                                        setProfileData(prev => ({
                                            ...prev,
                                            flashNews: result.scrollNews || prev.flashNews,
                                            flashNewsKey: result.key || prev.flashNewsKey,
                                            postLoginMessage: result.statutory || prev.postLoginMessage,
                                            postLoginHeader: result.header || prev.postLoginHeader,
                                            postLoginAlignment: result.alignment || prev.postLoginAlignment,
                                            postLoginKey: (result.key as any) || prev.postLoginKey,
                                            flashPopupMessage: result.flashPopupMessage || prev.flashPopupMessage,
                                            flashPopupHeader: result.flashPopupHeader || prev.flashPopupHeader,
                                            flashPopupPriority: (result.flashPopupPriority as any) || prev.flashPopupPriority,
                                            flashPopupId: result.flashPopupId || prev.flashPopupId
                                        }));
                                        showAlert?.('success', 'Full Sync Complete', 'Developer messages refreshed from cloud.');
                                    }
                                }}
                                disabled={isSyncing}
                                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sky-400 text-[10px] font-black rounded-xl transition-all flex items-center gap-1 border border-slate-700 uppercase tracking-widest"
                            >
                                {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Master Pull
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-6 flex flex-col space-y-4">
                                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Main Message Broadcast</h3>
                                    <button 
                                        onClick={async () => { 
                                            setIsSyncing(true); 
                                            const res = await updateDeveloperMessages(profileData.postLoginMessage || '', 'MESSAGE', profileData.postLoginHeader, profileData.postLoginAlignment, profileData.postLoginKey); 
                                            setIsSyncing(false); 
                                            if (res.success) showAlert?.('success', 'Published', 'Main Message updated globally.'); 
                                        }} 
                                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-lg transition-all"
                                    >
                                        PUSH TO CLOUD
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    <input type="text" title="Header" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white" placeholder="Message Header" value={profileData.postLoginHeader || ''} onChange={e => setProfileData({...profileData, postLoginHeader: e.target.value})} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-slate-500 font-bold uppercase">Alignment</label>
                                            <select title="Alignment" className="w-full bg-slate-950 border border-slate-800 text-white text-[10px] p-2 rounded-lg" value={profileData.postLoginAlignment || 'LEFT'} onChange={e => setProfileData({...profileData, postLoginAlignment: e.target.value as any})}><option value="LEFT">LEFT</option><option value="CENTER">CENTER</option></select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-slate-500 font-bold uppercase">Priority</label>
                                            <select title="Priority" className="w-full bg-slate-100 border border-slate-800 text-black text-[10px] p-2 rounded-lg font-bold" value={profileData.postLoginKey || 'REGULAR'} onChange={e => setProfileData({...profileData, postLoginKey: e.target.value as any})}><option value="REGULAR">Regular</option><option value="IMMEDIATE">Immediate</option></select>
                                        </div>
                                    </div>
                                    <textarea title="Message Content" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-slate-300 min-h-[160px] leading-relaxed" value={profileData.postLoginMessage || ''} onChange={e => setProfileData({...profileData, postLoginMessage: e.target.value})} />
                                </div>
                            </div>
                            <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-6 flex flex-col space-y-4">
                                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                    <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest">News Ticker broadcast</h3>
                                    <button 
                                        onClick={async () => { 
                                            setIsSyncing(true); 
                                            const res = await updateDeveloperMessages(profileData.flashNews || '', 'NEWS', 'MARQUEE', 'LEFT', profileData.flashNewsKey); 
                                            setIsSyncing(false); 
                                            if (res.success) showAlert?.('success', 'Published', 'Ticker updated globally.'); 
                                        }} 
                                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black rounded-lg transition-all"
                                    >
                                        PUSH TO CLOUD
                                    </button>
                                </div>
                                <div className="flex flex-col h-full space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] text-slate-500 font-bold uppercase">Ticker Mode</label>
                                        <select title="Ticker Mode" className="w-full bg-slate-950 border border-slate-800 text-white text-[10px] p-2 rounded-lg" value={profileData.flashNewsKey || 'REGULAR'} onChange={e => setProfileData({...profileData, flashNewsKey: e.target.value})}><option value="REGULAR">Regular Scroll</option><option value="IMMEDIATE">Urgent Priority</option></select>
                                    </div>
                                    <textarea title="Ticker Content" className="w-full flex-grow bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-emerald-400 min-h-[120px] leading-relaxed" value={profileData.flashNews || ''} onChange={e => setProfileData({...profileData, flashNews: e.target.value})} />
                                </div>
                            </div>
                            <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-6 flex flex-col space-y-4 md:col-span-2">
                                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                    <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest">Flash Popup Alert (3rd Tier)</h3>
                                    <button 
                                        onClick={async () => { 
                                            setIsSyncing(true); 
                                            const res = await updateDeveloperMessages(profileData.flashPopupMessage || '', 'FLASH', profileData.flashPopupHeader, 'CENTER', profileData.flashPopupPriority); 
                                            setIsSyncing(false); 
                                            if (res.success) showAlert?.('success', 'Published', 'Flash Alert updated globally.'); 
                                        }} 
                                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black rounded-lg transition-all"
                                    >
                                        PUSH TO CLOUD
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-1 space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-slate-500 font-bold uppercase">Alert Header</label>
                                            <input type="text" title="Flash Header" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white" placeholder="FLASH ALERT" value={profileData.flashPopupHeader || ''} onChange={e => setProfileData({...profileData, flashPopupHeader: e.target.value})} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-slate-500 font-bold uppercase">Priority</label>
                                            <select title="Flash Priority" className="w-full bg-slate-950 border border-slate-800 text-white text-[10px] p-2 rounded-lg" value={profileData.flashPopupPriority || 'REGULAR'} onChange={e => setProfileData({...profileData, flashPopupPriority: e.target.value as any})}><option value="REGULAR">Standard</option><option value="IMMEDIATE">System Critical (Auto-Show)</option></select>
                                        </div>
                                        <p className="text-[9px] text-slate-500 italic">Flash alerts appear as a persistent floating notice until cleared by the user.</p>
                                    </div>
                                    <div className="lg:col-span-2">
                                        <textarea title="Flash Content" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-amber-200 min-h-[140px] leading-relaxed" value={profileData.flashPopupMessage || ''} onChange={e => setProfileData({...profileData, flashPopupMessage: e.target.value})} />
                                    </div>
                                </div>
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
                            <h3 className="font-black text-white text-lg uppercase tracking-tighter">Data Management Center</h3>
                            <p className="text-xs text-slate-400">Secure Backup, Restoration & System Maintenance</p>
                        </div>
                    </div>

                    {isSetupMode ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-[#0f172a] p-8 rounded-2xl border border-blue-500/20 flex flex-col items-center group hover:border-blue-500/40 transition-all">
                                <div className="p-4 bg-blue-900/20 text-blue-400 rounded-full mb-4 shadow-lg group-hover:scale-110 transition-transform">
                                    <Plus size={32} />
                                </div>
                                <h4 className="text-white font-black mb-1 uppercase tracking-tighter">Enter Fresh Data</h4>
                                <p className="text-[10px] text-slate-500 text-center mb-6">Start with an empty system for new installation.</p>
                                <button onClick={onSkipSetupRedirect} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all">Skip to Dashboard</button>
                            </div>
                            <div className="bg-[#0f172a] p-8 rounded-2xl border border-emerald-500/20 flex flex-col items-center group hover:border-emerald-500/40 transition-all">
                                <div className="p-4 bg-emerald-900/20 text-emerald-400 rounded-full mb-4 shadow-lg group-hover:scale-110 transition-transform">
                                    <Upload size={32} />
                                </div>
                                <h4 className="text-white font-black mb-1 uppercase tracking-tighter">Restore Existing Backup</h4>
                                <p className="text-[10px] text-slate-500 text-center mb-6">Import data from a .enc or .sqlite backup file.</p>
                                <button onClick={() => { setBackupMode('IMPORT'); backupFileRef.current?.click(); }} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"><Upload size={14} /> Restore File</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Backup & Restore Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800 hover:border-blue-500/30 transition-all group shadow-lg relative overflow-hidden">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-blue-900/20 text-blue-400 rounded-xl group-hover:scale-110 transition-transform">
                                            <Download size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-white uppercase tracking-tighter">Local Secure Backup</h4>
                                            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded">Encrypted (.enc)</span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-6 leading-relaxed italic">"Create a secure, portable snapshot of your entire payroll database (Employees, Attendance, Settings) for archival or migration."</p>
                                    <button 
                                        onClick={() => requireAuth(() => { setBackupMode('EXPORT'); setShowBackupModal(true); setEncryptionKey(''); })} 
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Lock size={14} /> Authorize & Backup
                                    </button>
                                </div>

                                <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800 hover:border-emerald-500/30 transition-all group shadow-lg">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-emerald-900/20 text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
                                            <Upload size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-white uppercase tracking-tighter">Universal Restoration</h4>
                                            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">Enc / SQLite</span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-6 leading-relaxed italic">"Reverse previous exports or recover from database files directly. Atomic restoration ensures system integrity on failure."</p>
                                    <button 
                                        onClick={() => backupFileRef.current?.click()} 
                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Upload size={14} /> Select & Restore
                                    </button>
                                </div>
                            </div>

                            {/* System Maintenance Sections */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                                    <AlertTriangle size={14} className="text-amber-500" />
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Maintenance Tools</h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Standard Maintenance Card */}
                                    <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/60 transition-colors flex flex-col justify-between group">
                                        <div>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-amber-900/20 text-amber-500 rounded-lg group-hover:rotate-12 transition-transform">
                                                    <RotateCw size={18} />
                                                </div>
                                                <h5 className="text-xs font-black text-slate-200 uppercase tracking-tighter">Standard Maintenance</h5>
                                            </div>
                                            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Clear all <span className="text-amber-400 font-bold underline underline-offset-2">Transactional Records</span> (Employees, Attendance, PayHistory) while keeping Company Profile and Master Config intact.</p>
                                        </div>
                                        <button 
                                            onClick={() => requireAuth(() => { setShowPayrollResetModal(true); setResetPassword(''); setResetError(''); })}
                                            className="mt-4 py-2.5 px-4 bg-amber-900/20 hover:bg-amber-600 text-amber-500 hover:text-white border border-amber-900/50 hover:border-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                        >
                                            Initiate Payroll Reset
                                        </button>
                                    </div>

                                    {/* System Maintenance Card */}
                                    <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/60 transition-colors flex flex-col justify-between group">
                                        <div>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-red-900/20 text-red-500 rounded-lg group-hover:scale-110 transition-transform">
                                                    <Trash2 size={18} />
                                                </div>
                                                <h5 className="text-xs font-black text-slate-200 uppercase tracking-tighter">System Maintenance</h5>
                                            </div>
                                            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Perform a full <span className="text-red-500 font-bold underline underline-offset-2">Wipe-Out</span>. Clears all data including License Identity and User Accounts. Used for system decommissioning.</p>
                                        </div>
                                        <button 
                                            onClick={() => requireAuth(() => { setShowResetModal(true); setResetPassword(''); setResetError(''); })}
                                            className="mt-4 py-2.5 px-4 bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 hover:border-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                        >
                                            Initiate Factory Reset
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}



            {showResetModal && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-red-900/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                        {!isProcessing && <button onClick={() => setShowResetModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close" aria-label="Close Factory Reset Modal"><X size={20} /></button>}
                        <div className="flex flex-col items-center gap-2">
                            <div className="p-4 bg-red-900/20 text-red-500 rounded-full border border-red-900/50 mb-2"><AlertTriangle size={32} /></div>
                            <h3 className="text-xl font-black text-white text-center">FACTORY RESET</h3>
                            <p className="text-xs text-red-300 text-center leading-relaxed">CRITICAL WARNING: This action is IRREVERSIBLE.</p>
                        </div>
                        <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                            <input type="password" placeholder="Enter Login Password" title="Password" autoFocus disabled={isProcessing} className={`w-full bg-[#0f172a] border ${resetError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-red-500 transition-all`} value={resetPassword} onChange={(e) => { setResetPassword(e.target.value); setResetError(''); }} onKeyDown={(e) => e.key === 'Enter' && executeFactoryReset()} />
                            {resetError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{resetError}</p>}
                        </div>
                        <button onClick={executeFactoryReset} disabled={isProcessing} className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />} {isProcessing ? 'ERASING...' : 'CONFIRM DELETE ALL'}
                        </button>
                    </div>
                </div>
            )}

            {showPayrollResetModal && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-amber-900/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                        <button onClick={() => setShowPayrollResetModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close" aria-label="Close Payroll Reset Modal"><X size={20} /></button>
                        <div className="flex flex-col items-center gap-2">
                            <div className="p-4 bg-amber-900/20 text-amber-500 rounded-full border border-amber-900/50 mb-2"><Trash2 size={32} /></div>
                            <h3 className="text-xl font-black text-white text-center">PAYROLL RESET</h3>
                            <p className="text-xs text-amber-300 text-center leading-relaxed">This will erase all employees but preserve company settings.</p>
                        </div>
                        <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                            <input type="password" placeholder="Enter Login Password" title="Password" autoFocus disabled={isProcessing} className={`w-full bg-[#0f172a] border ${resetError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-amber-500 transition-all`} value={resetPassword} onChange={(e) => { setResetPassword(e.target.value); setResetError(''); }} onKeyDown={(e) => e.key === 'Enter' && executePayrollReset()} />
                            {resetError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{resetError}</p>}
                        </div>
                        <button onClick={executePayrollReset} disabled={isProcessing} className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                             {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} {isProcessing ? 'CLEARING...' : 'CONFIRM RESET'}
                        </button>
                    </div>
                </div>
            )}

            {showBackupModal && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl p-6 flex flex-col gap-4 relative">
                        {!isProcessing && <button onClick={() => setShowBackupModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close" aria-label="Close Backup Modal"><X size={20} /></button>}
                        <div className="flex flex-col items-center gap-2">
                            <div className="p-4 bg-blue-900/20 text-blue-400 rounded-full border border-blue-900/50 mb-2">{backupMode === 'EXPORT' ? <Lock size={32} /> : <Database size={32} />}</div>
                            <h3 className="text-xl font-black text-white text-center uppercase tracking-widest">{backupMode === 'EXPORT' ? 'SECURE EXPORT' : 'Secure Restore'}</h3>
                        </div>
                        
                        <div className="space-y-4 mt-2">
                            {backupMode === 'IMPORT' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">SELECT BACKUP FILE</label>
                                    <div className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-700 rounded-xl">
                                        <button 
                                            onClick={() => backupFileRef.current?.click()}
                                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700 transition-colors uppercase"
                                        >
                                            Choose File
                                        </button>
                                        <span className="text-[10px] text-slate-400 font-medium truncate flex-1">
                                            {selectedBackupFile ? selectedBackupFile.name : 'No file chosen'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                                    {backupMode === 'EXPORT' ? 'SET ENCRYPTION PASSWORD' : 'ENTER DECRYPTION PASSWORD'}
                                </label>
                                <input 
                                    type="password" 
                                    placeholder="Enter Password" 
                                    title="Password" 
                                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                                    value={encryptionKey} 
                                    onChange={(e) => setEncryptionKey(e.target.value)} 
                                />
                            </div>

                            {processStatus && <p className="text-[10px] text-blue-400 font-bold text-center animate-pulse uppercase tracking-widest">{processStatus}</p>}
                            
                            {isProcessing && (
                                <div className="w-full bg-[#0f172a] border border-slate-800 h-2.5 rounded-full overflow-hidden shadow-inner my-2">
                                    <div 
                                        className="h-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 transition-all duration-500 ease-out shadow-[0_0_12px_rgba(59,130,246,0.4)]" 
                                        style={{ width: `${processProgress}%` }}
                                    ></div>
                                </div>
                            )}

                            <button 
                                onClick={backupMode === 'EXPORT' ? handleEncryptedExport : initiateRestore} 
                                disabled={isProcessing || (backupMode === 'IMPORT' && !selectedBackupFile)} 
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                            >
                                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : (backupMode === 'EXPORT' ? <Download size={16} /> : <RefreshCw size={16} />)}
                                {backupMode === 'EXPORT' ? 'DOWNLOAD ENCRYPTED BACKUP' : 'RESTORE DATA'}
                            </button>
                            
                            {backupMode === 'IMPORT' && !selectedBackupFile && (
                                <p className="text-[9px] text-slate-500 text-center italic font-medium">
                                    * Please select a valid .enc or .sqlite file to proceed
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'LICENSE' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Header with Global Save Action */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-pink-900/30 text-pink-400 rounded-xl border border-pink-500/20 shadow-lg">
                                <ShieldCheck size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">License Management</h2>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">System Activation & Machine Lock Status</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column: Current License Details */}
                        <div className="bg-[#0f172a] rounded-3xl p-8 border border-white/5 shadow-2xl flex flex-col justify-between">
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <Lock size={14} className="text-pink-500" /> Current License Info
                                    </h3>
                                    <button 
                                        onClick={handleCloudSync}
                                        disabled={isSyncing}
                                        className="px-4 py-1.5 bg-sky-900/20 hover:bg-sky-900/40 text-sky-400 text-[10px] font-black rounded-lg border border-sky-500/20 transition-all flex items-center gap-2 uppercase tracking-widest"
                                    >
                                        {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                        Sync Cloud
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center py-1.5">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">License Key</span>
                                        <span className="text-xs font-mono text-rose-500 font-black tracking-widest bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/20">
                                            {licenseInfo?.key || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-1.5 border-t border-white/5">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</span>
                                        <span className="text-xs font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                                            {licenseInfo?.status || 'UNREGISTERED'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-1.5 border-t border-white/5">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">User ID</span>
                                        <span className="text-xs font-black text-slate-300">{licenseInfo?.userID || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1.5 border-t border-white/5">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email ID</span>
                                        <span className="text-xs font-bold text-slate-400 lowercase">{licenseInfo?.registeredTo || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1.5 border-t border-white/5">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mobile No</span>
                                        <span className="text-xs font-mono text-slate-300">{licenseInfo?.registeredMobile || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1.5 border-t border-white/5">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employee Data Limit</span>
                                        <span className="text-sm font-black text-emerald-500 font-mono bg-emerald-500/10 px-4 py-1 rounded-lg border border-emerald-500/20">
                                            {licenseInfo?.dataSize || 0}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-1.5 border-t border-white/5">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expiry Date</span>
                                        <span className="text-xs font-bold text-pink-400 italic">
                                            {licenseInfo?.expiryDate ? new Date(licenseInfo.expiryDate.split('-').reverse().join('-')).toDateString() : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 p-4 bg-sky-900/10 rounded-2xl border border-sky-500/20 flex gap-3">
                                <Info size={18} className="text-sky-400 shrink-0" />
                                <p className="text-[10px] text-sky-300/80 leading-relaxed font-medium italic">
                                    * License is locked to this Machine ID. To move BharatPay Pro to another computer, please contact support for a license reset.
                                </p>
                            </div>
                        </div>

                        {/* Right Column: Re-Activation Form */}
                        <div className="bg-[#0f172a] rounded-3xl p-8 border border-white/5 shadow-2xl flex flex-col gap-6">
                            <div className="flex items-center gap-3">
                                <ChevronRight size={20} className="text-pink-500" />
                                <div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Re-Activate System</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Update credentials to restore full access</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Full Name / Authorized Person</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter Full Name"
                                        className="w-full bg-[#0a0f1d] border border-white/5 focus:border-pink-500/50 rounded-xl p-3 text-white text-xs font-bold outline-none transition-all focus:ring-4 focus:ring-pink-500/10"
                                        value={newUserName}
                                        onChange={e => setNewUserName(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">User ID</label>
                                        <input 
                                            type="text" 
                                            placeholder="Sbobby12"
                                            className="w-full bg-[#0a0f1d] border border-white/5 focus:border-pink-500/50 rounded-xl p-3 text-white text-xs font-mono outline-none transition-all focus:ring-4 focus:ring-pink-500/10"
                                            value={newUserID}
                                            onChange={e => setNewUserID(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">License Key (16-Digit)</label>
                                        <input 
                                            type="text" 
                                            placeholder="XXXX-XXXX-XXXX-XXXX"
                                            className="w-full bg-[#0a0f1d] border border-white/5 focus:border-pink-500/50 rounded-xl p-3 text-white text-xs font-mono uppercase outline-none transition-all focus:ring-4 focus:ring-pink-500/10"
                                            value={newLicenseKey}
                                            onChange={e => setNewLicenseKey(e.target.value.toUpperCase())}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Email ID</label>
                                        <input 
                                            type="email" 
                                            placeholder="bala.saipra@gmail.com"
                                            className="w-full bg-[#0a0f1d] border border-white/5 focus:border-pink-500/50 rounded-xl p-3 text-white text-xs font-bold outline-none transition-all focus:ring-4 focus:ring-pink-500/10"
                                            value={newRegEmail}
                                            onChange={e => setNewRegEmail(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Mobile No</label>
                                        <input 
                                            type="text" 
                                            placeholder="9962520292"
                                            className="w-full bg-[#0a0f1d] border border-white/5 focus:border-pink-500/50 rounded-xl p-3 text-white text-xs font-mono outline-none transition-all focus:ring-4 focus:ring-pink-500/10"
                                            value={newRegMobile}
                                            onChange={e => setNewRegMobile(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={async () => {
                                    if (!isValidKeyFormat(newLicenseKey)) {
                                        showAlert?.('warning', 'Invalid Key', 'Please enter a valid 16-digit license key.');
                                        return;
                                    }
                                    setIsActivating(true);
                                    const result = await activateFullLicense(newUserName, newUserID, newLicenseKey, newRegEmail, newRegMobile);
                                    setIsActivating(false);
                                    if (result.success) {
                                        showAlert?.('success', 'Activation Successful', result.message);
                                        setLicenseInfo(getStoredLicense());
                                        // Trigger global refresh to update Header UI (Trial -> License)
                                        setTimeout(() => onRestore(), 500);
                                    } else {
                                        showAlert?.('danger', 'Activation Failed', result.message);
                                    }
                                }}
                                disabled={isActivating}
                                className="mt-4 w-full py-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-black uppercase text-sm rounded-xl shadow-xl shadow-pink-900/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                            >
                                {isActivating ? <Loader2 size={20} className="animate-spin" /> : <Shield size={20} />}
                                {isActivating ? 'Activating...' : 'Re-Activate System'}
                            </button>
                        </div>
                    </div>

                    {/* NEW SECTION: Security & Credentials */}
                    <div className="bg-[#0f172a] rounded-3xl p-8 border border-white/5 shadow-2xl flex flex-col gap-8">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <div className="flex items-center gap-3">
                                <KeyRound size={24} className="text-pink-500" />
                                <div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Security & Credentials</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Update Login Credentials & Cloud Sync</p>
                                </div>
                            </div>
                            
                            {sessionStorage.getItem('app_forced_reset') === 'true' && (
                                <div className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-500 text-[9px] font-black uppercase animate-pulse">
                                    Action Required: Forced Reset Active
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Current Password</label>
                                <input 
                                    type="password" 
                                    placeholder="Verify identity"
                                    className="w-full bg-[#0a0f1d] border border-white/5 focus:border-pink-500/50 rounded-xl p-3.5 text-white text-xs font-mono outline-none transition-all focus:ring-4 focus:ring-pink-500/10"
                                    value={currentPass}
                                    onChange={e => setCurrentPass(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">New Secure Password</label>
                                <div className="relative group">
                                    <input 
                                        type="password" 
                                        placeholder="Set new credentials"
                                        onFocus={() => setShowPassRules(true)}
                                        onBlur={() => setShowPassRules(false)}
                                        className="w-full bg-[#0a0f1d] border border-white/5 focus:border-pink-500/50 rounded-xl p-3.5 text-white text-xs font-mono outline-none transition-all focus:ring-4 focus:ring-pink-500/10"
                                        value={newPass}
                                        onChange={e => setNewPass(e.target.value)}
                                    />
                                    {showPassRules && (
                                        <div className="absolute top-14 left-0 right-0 z-50 bg-[#1e293b] border border-slate-700 rounded-xl p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                                            <div className="flex items-center gap-2 text-pink-400 mb-3 border-b border-white/5 pb-2">
                                                <ShieldAlert size={16} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Complexity Requirements</span>
                                            </div>
                                            <ul className="grid grid-cols-1 gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                <li className={`flex items-center gap-2 ${newPass.length >= 9 ? 'text-emerald-500' : ''}`}>
                                                    <CheckCircle2 size={12} /> Minimum 9 Characters
                                                </li>
                                                <li className={`flex items-center gap-2 ${/[A-Z]/.test(newPass) ? 'text-emerald-500' : ''}`}>
                                                    <CheckCircle2 size={12} /> One Capital (A-Z)
                                                </li>
                                                <li className={`flex items-center gap-2 ${/[a-z]/.test(newPass) ? 'text-emerald-500' : ''}`}>
                                                    <CheckCircle2 size={12} /> One Small (a-z)
                                                </li>
                                                <li className={`flex items-center gap-2 ${/[0-9]/.test(newPass) ? 'text-emerald-500' : ''}`}>
                                                    <CheckCircle2 size={12} /> One Numeric (0-9)
                                                </li>
                                                <li className={`flex items-center gap-2 ${/[^A-Za-z0-9]/.test(newPass) ? 'text-emerald-500' : ''}`}>
                                                    <CheckCircle2 size={12} /> One Special Char
                                                </li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Confirm New Password</label>
                                <input 
                                    type="password" 
                                    placeholder="Match new password"
                                    className="w-full bg-[#0a0f1d] border border-white/5 focus:border-pink-500/50 rounded-xl p-3.5 text-white text-xs font-mono outline-none transition-all focus:ring-4 focus:ring-pink-500/10"
                                    value={confirmPass}
                                    onChange={e => setConfirmPass(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-4 bg-rose-500/5 border border-rose-500/10 p-4 rounded-2xl">
                             <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
                                <ShieldAlert size={20} />
                             </div>
                             <div className="flex-1">
                                <h4 className="text-[11px] font-black text-white uppercase tracking-tighter">Production Safeguard</h4>
                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Updating your login password will trigger an immediate Cloud Sync. Ensure you have an active internet connection to keep your account safe across all distributed machines.</p>
                             </div>
                             <button 
                                onClick={async () => {
                                    if (!currentPass || !newPass || !confirmPass) {
                                        showAlert('warning', 'Incomplete Form', 'Please fill in all password fields.');
                                        return;
                                    }
                                    if (newPass !== confirmPass) {
                                        showAlert('warning', 'Mismatch', 'New passwords do not match.');
                                        return;
                                    }
                                    // Severity check
                                    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{9,}$/;
                                    if (!regex.test(newPass)) {
                                        showAlert('warning', 'Complexity Failed', 'New password must meet all security requirements.');
                                        return;
                                    }

                                    setIsUpdatingPass(true);
                                    try {
                                        const usersRaw = localStorage.getItem('app_users');
                                        const users: User[] = usersRaw ? JSON.parse(usersRaw) : [];
                                        const adminIndex = users.findIndex(u => u.role === 'Administrator');
                                        
                                        if (adminIndex === -1 || users[adminIndex].password !== currentPass) {
                                            showAlert('danger', 'Verification Failed', 'The current password you entered is incorrect.');
                                            return;
                                        }

                                        // 1. Update Cloud
                                        const syncResult = await updateCloudPassword(licenseInfo?.registeredTo || '', newPass);
                                        if (!syncResult.success) {
                                            showAlert('warning', 'Cloud Sync Warning', 'Local password updated, but cloud sync failed. Ensure your internet is active for full security.');
                                        }

                                        // 2. Update Local
                                        users[adminIndex].password = newPass;
                                        localStorage.setItem('app_users', JSON.stringify(users));
                                        // @ts-ignore
                                        if (window.electronAPI) await window.electronAPI.dbSet('app_users', users);

                                        showAlert('success', 'Security Updated', 'Your main login password has been rotated successfully. Use this new password for next login.');
                                        
                                        // Clear forced reset state
                                        sessionStorage.removeItem('app_forced_reset');
                                        setCurrentPass('');
                                        setNewPass('');
                                        setConfirmPass('');
                                    } finally {
                                        setIsUpdatingPass(false);
                                    }
                                }}
                                disabled={isUpdatingPass}
                                className="px-8 py-3.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-xl shadow-pink-900/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                             >
                                {isUpdatingPass ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Rotate Password
                             </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'USERS' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Header with Global Save Action */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-sky-900/30 text-sky-400 rounded-xl border border-sky-500/20 shadow-lg">
                                <Users size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">User Management</h2>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Account Control & Access Permissions</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column: Existing Users */}
                        <div className="bg-[#0f172a] rounded-3xl p-8 border border-white/5 shadow-2xl flex flex-col h-full">
                            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <Users size={14} className="text-sky-500" /> Existing Users ({appUsers.length})
                                </h3>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 min-h-[400px]">
                                {appUsers.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 py-20">
                                        <Users size={48} className="opacity-10 mb-4" />
                                        <p className="text-sm font-bold uppercase tracking-widest italic opacity-40">No users created yet.</p>
                                    </div>
                                ) : (
                                    appUsers.map(u => (
                                        <div key={u.username} className="group p-4 bg-[#0a0f1d] border border-white/5 hover:border-sky-500/30 rounded-2xl transition-all flex items-center justify-between shadow-lg">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20 text-sky-400 font-black">
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-black text-white uppercase tracking-tight">{u.name}</div>
                                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                                                        @{u.username} • <span className="text-sky-500/80">{u.role}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleUmEdit(u)}
                                                    className="p-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-lg border border-sky-500/20 transition-all shadow-inner"
                                                    title="Edit User"
                                                >
                                                    <RotateCw size={14} />
                                                </button>
                                                {/* Delete restricted: Cannot delete self, and Admins can only be deleted by Developers */}
                                                {u.username !== currentUser?.username && (u.role !== 'Administrator' || userRole === 'Developer') && (
                                                    <button 
                                                        onClick={() => handleUmDelete(u.username)}
                                                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/20 transition-all shadow-inner"
                                                        title="Delete User"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Right Column: User Creation Form */}
                        <div className="bg-[#0f172a] rounded-3xl p-8 border border-white/5 shadow-2xl flex flex-col gap-8 h-full">
                            <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                                <Plus size={20} className="text-sky-500" />
                                <div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">{umEditId ? 'Modify Account' : 'Create New Account'}</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{umEditId ? 'Update user credentials and roles' : 'Initialize a fresh secure login'}</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Full Name</label>
                                    <input 
                                        ref={umNameRef}
                                        type="text" 
                                        placeholder="Enter user's full name"
                                        className="w-full bg-[#0a0f1d] border border-white/5 focus:border-sky-500/50 rounded-xl p-3.5 text-white text-xs font-bold outline-none transition-all focus:ring-4 focus:ring-sky-500/10 placeholder-gray-600"
                                        value={umForm.name}
                                        onChange={e => setUmForm({...umForm, name: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Username / ID</label>
                                    <input 
                                        type="text" 
                                        placeholder="Pick a unique login id"
                                        disabled={!!umEditId}
                                        className={`w-full bg-[#0a0f1d] border border-white/5 focus:border-sky-500/50 rounded-xl p-3.5 text-white text-xs font-mono lowercase outline-none transition-all focus:ring-4 focus:ring-sky-500/10 ${!!umEditId ? 'opacity-50 grayscale cursor-not-allowed' : ''} placeholder-gray-600`}
                                        value={umForm.username}
                                        onChange={e => setUmForm({...umForm, username: e.target.value.toLowerCase()})}
                                    />
                                </div>

                                <div className="space-y-1.5 relative">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Login Password</label>
                                    <div className="relative group">
                                        <input 
                                            type={umShowPwd ? "text" : "password"} 
                                            placeholder="Enter secure password"
                                            className="w-full bg-[#0a0f1d] border border-white/5 focus:border-sky-500/50 rounded-xl p-3.5 text-white text-xs font-mono outline-none transition-all focus:ring-4 focus:ring-sky-500/10 pr-12 placeholder-gray-600"
                                            value={umForm.password}
                                            onChange={e => setUmForm({...umForm, password: e.target.value})}
                                        />
                                        <button 
                                            onClick={() => setUmShowPwd(!umShowPwd)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-sky-400 transition-colors bg-white/5 p-1 rounded-lg"
                                            title={umShowPwd ? "Hide Password" : "Show Password"}
                                        >
                                            {umShowPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">System Role</label>
                                    <div className="grid grid-cols-2 gap-2 bg-[#0a0f1d] p-1.5 rounded-2xl border border-white/5">
                                        <button 
                                            onClick={() => setUmForm({...umForm, role: 'Administrator'})}
                                            className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${umForm.role === 'Administrator' ? 'bg-sky-600/20 text-sky-400 ring-2 ring-sky-500/30 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            Administrator
                                        </button>
                                        <button 
                                            onClick={() => setUmForm({...umForm, role: 'User'})}
                                            className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${umForm.role === 'User' ? 'bg-sky-600 text-white shadow-xl shadow-sky-900/40 ring-2 ring-white/20' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            User
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto pt-6 border-t border-white/5 flex flex-col gap-3">
                                {umError && <div className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-[10px] font-bold text-center animate-pulse uppercase tracking-widest">{umError}</div>}
                                <div className="flex gap-3">
                                    {umEditId && (
                                        <button 
                                            onClick={() => { setUmEditId(null); setUmForm({ name: '', username: '', password: '', role: 'User', email: '' }); }}
                                            className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black uppercase text-xs rounded-xl transition-all active:scale-[0.98]"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                    <button 
                                        onClick={handleUmSave}
                                        className="flex-[2] py-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-black uppercase text-xs rounded-xl shadow-xl shadow-sky-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <Save size={16} />
                                        {umEditId ? 'Update Identity' : 'Save User Account'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showOverwriteConfirm && (
                <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-red-500/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                        <button onClick={() => setShowOverwriteConfirm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close" aria-label="Close Overwrite Confirmation"><X size={20} /></button>
                        <div className="flex flex-col items-center gap-2">
                            <div className="p-3 bg-red-900/20 text-red-500 rounded-full border border-red-900/50 mb-2"><AlertTriangle size={32} /></div>
                            <h3 className="text-xl font-black text-white text-center">Overwrite Data?</h3>
                            <p className="text-xs text-slate-300 text-center">Restoring a backup will <span className="text-red-400 font-bold">REPLACE ALL CURRENT RECORDS</span>.</p>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setShowOverwriteConfirm(false)} className="flex-1 py-3 border border-slate-600 rounded-xl text-slate-300 font-bold">Cancel</button>
                            <button onClick={() => { setShowOverwriteConfirm(false); executeImport(); }} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold">Overwrite</button>
                        </div>
                    </div>
                </div>
            )}

            {showAuthModal && (
                <div className="fixed inset-0 z-[800] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-indigo-500/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                        <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close" aria-label="Close Authorization Modal"><X size={20} /></button>
                        <div className="flex flex-col items-center gap-2">
                            <div className="p-4 bg-indigo-900/20 text-indigo-500 rounded-full border border-indigo-900/50 mb-2"><KeyRound size={32} /></div>
                            <h3 className="text-xl font-black text-white text-center uppercase tracking-widest">Authorize Action</h3>
                        </div>
                        <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                            <input type="password" placeholder="Login Password" autoFocus className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono" value={authPassword} onChange={(e) => { setAuthPassword(e.target.value); setAuthError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleAuthSubmit()} />
                            {authError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{authError}</p>}
                        </div>
                        <button onClick={handleAuthSubmit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                            <CheckCircle2 size={18} /> VERIFY & PROCEED
                        </button>
                    </div>
                </div>
            )}

            {showSMTPModal && (
                <SMTPConfigModal onClose={() => setShowSMTPModal(false)} />
            )}
        </div>
    );
};

export default Settings;
