import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    X, Save, RefreshCw, Loader2, Download, Upload, Trash2, AlertTriangle,
    Database, Users, KeyRound, ShieldCheck, Mail, Megaphone, Building2,
    CalendarClock, Phone, Globe, CheckCircle2, AlertCircle, Lock, Plus,
    ImageIcon, Camera, Heart, CheckSquare, Square, Landmark, Table, Calculator,
    ScrollText, HandCoins, Wallet, Scale, RotateCw, TrendingUp,
    ChevronRight, Shield, Info, Settings as SettingsIcon, Eye, EyeOff, ShieldAlert,
    FolderOpen, FileText
} from 'lucide-react';
import { StatutoryConfig, PFComplianceType, LeavePolicy, CompanyProfile, User, LicenseData, SettingsTab } from '../types';
import { PT_STATE_PRESETS, INDIAN_STATES, NATURE_OF_BUSINESS_OPTIONS, LWF_STATE_PRESETS, INITIAL_STATUTORY_CONFIG, INITIAL_COMPANY_PROFILE } from '../constants';
import CryptoJS from 'crypto-js';
import {
    fetchLatestMessages, updateDeveloperMessages, activateFullLicense,
    getStoredLicense, isValidKeyFormat, updateCloudPassword, validateLicenseStartup,
    requestResetOTP, getAppDeveloper, APP_VERSION, APP_PATCH_TIMESTAMP
} from '../services/licenseService';
import { formatExpiryDate, formatIndianNumber, formatLicenseKey, generateCompanyId, generateBackupFilename, getCompanyBackupFolder, didConfigCalculationFieldsChange } from '../utils/formatters';
import { getMonthAbbr } from '../services/reportService';
import SMTPConfigModal from './Shared/SMTPConfigModal';
import { executeDiagnosticExport } from '../utils/diagnostics';

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
    onPayrollReset: () => Promise<void>;
    onDeepReset: (deleteFolder?: boolean, targetCompanyId?: string) => Promise<void>;
    initialTab?: SettingsTab;
    setSettingsTab?: (tab: SettingsTab) => void;
    userRole?: string;
    currentUser?: User;
    isSetupMode?: boolean;
    onSkipSetupRedirect?: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
    showAlert: (type: 'success' | 'warning' | 'danger' | 'info' | 'confirm' | 'error', title: string, message: string | React.ReactNode, onConfirm?: () => void, onCancel?: () => void, confirmLabel?: string, cancelLabel?: string, cancel2Label?: string) => void;
    verifyLicense?: () => Promise<void>;
    activeCompanyId?: string;
    onOpenGate?: () => void;
    onRescueOrganizations?: () => Promise<void>;
    onInitiateSecureDelete?: (id: string) => void;
    globalMonth?: string;
    globalYear?: number;
    activeFinancialYear?: string;
    isLicenseExpired?: boolean;
    latestPatchTimestamp?: string | null;
    onNavigate?: (view: any, tab?: string, bypassDirty?: boolean) => void;
}

const UsageTimeClock = () => {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    const sessionLoginTime = sessionStorage.getItem('session_login_time');
    const start = sessionLoginTime ? parseInt(sessionLoginTime, 10) : Date.now();
    const diff = Math.floor((now - start) / 1000);
    const h = Math.floor(diff / 3600).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    return <>{h}:{m}:{s}</>;
};

const Settings: React.FC<SettingsProps> = ({
    config, setConfig, companyProfile, setCompanyProfile, currentLogo, setLogo,
    leavePolicy, setLeavePolicy, onRestore, onNuclearReset, onPayrollReset, onDeepReset, initialTab = SettingsTab.Company,
    setSettingsTab,
    userRole, currentUser, isSetupMode = false, onSkipSetupRedirect, onDirtyChange,
    showAlert, verifyLicense, activeCompanyId = 'default', onRescueOrganizations,
    globalMonth = 'April', globalYear = 2025, activeFinancialYear, isLicenseExpired,
    latestPatchTimestamp, onNavigate
}) => {
    const getCKey = (key: string) => activeCompanyId === 'default' ? key : `${key}_${activeCompanyId}`;
    const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
        const saved = localStorage.getItem('settings_initial_tab') || sessionStorage.getItem('settings_initial_tab');
        if (saved) {
            localStorage.removeItem('settings_initial_tab');
            sessionStorage.removeItem('settings_initial_tab');
            return saved as SettingsTab;
        }
        return initialTab;
    });

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
    const [targetPurgeCompanyId, setTargetPurgeCompanyId] = useState<string>(activeCompanyId);
    const [enrolledEmployeeCount, setEnrolledEmployeeCount] = useState<number>(0);

    // V03.01.07: Sync local state when props change (e.g. after switching companies)
    useEffect(() => {
        setFormData(config);
        setProfileData(companyProfile);
        setLocalLeavePolicy(leavePolicy);
        
        // Fetch current enrolled employees for data size logic
        try {
            const empsData = localStorage.getItem(getCKey('app_employees'));
            if (empsData) {
                const emps = JSON.parse(empsData);
                setEnrolledEmployeeCount(Array.isArray(emps) ? emps.length : 0);
            } else {
                setEnrolledEmployeeCount(0);
            }
        } catch(e) { setEnrolledEmployeeCount(0); }
    }, [config, companyProfile, leavePolicy]);

    useEffect(() => {
        const saved = sessionStorage.getItem('settings_initial_tab');
        if (saved) {
            sessionStorage.removeItem('settings_initial_tab');
            setActiveTab(saved as any);
        }
    }, []);

    useEffect(() => {
        const saved = localStorage.getItem('settings_initial_tab_force');
        if (saved === SettingsTab.Statutory) {
            setActiveTab(SettingsTab.Statutory);

            // Auto-scroll to the Dynamic Pay Sheet section
            setTimeout(() => {
                const element = document.getElementById('dynamic_paysheet_section');
                if (element) {
                    const container = element.closest('.overflow-y-auto');
                    if (container) {
                        const elementTop = element.getBoundingClientRect().top;
                        const containerTop = container.getBoundingClientRect().top;
                        const offset = elementTop - containerTop - 120; // 120px margin
                        container.scrollBy({ top: offset, behavior: 'smooth' });
                    } else {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            }, 300);

            const timer = setTimeout(() => {
                localStorage.removeItem('settings_initial_tab_force');
            }, 1000);
            return () => clearTimeout(timer);
        }
    });

    const hasData = useMemo(() => {
        try {
            const emps = JSON.parse(localStorage.getItem(getCKey('app_employees')) || '[]');
            return Array.isArray(emps) && emps.length > 0;
        } catch (e) {
            return false;
        }
    }, [activeCompanyId]);

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
        setActiveTab(initialTab);
    }, [initialTab]);

    const [showBackupModal, setShowBackupModal] = useState(false);
    const [encryptionKey, setEncryptionKey] = useState('');
    const [selectedBackupFile, setSelectedBackupFile] = useState<File | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [isSqliteFile, setIsSqliteFile] = useState(false);
    const [isMachineLocked, setIsMachineLocked] = useState(false);

    const [authPassword, setAuthPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [pendingAuthAction, setPendingAuthAction] = useState<(() => void) | null>(null);

    const [showSMTPModal, setShowSMTPModal] = useState(false);
    const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

    const [isProcessing, setIsProcessing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);

    const isBCACFile = useMemo(() => {
        if (!selectedBackupFile) return false;
        const name = selectedBackupFile.name.toUpperCase();
        return name.includes('_BC_') || name.includes('_AC_') ||
            name.includes('BEFORE_CONFIRMATION') || name.includes('AFTER_CONFIRMATION');
    }, [selectedBackupFile]);
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [recoveryOTP, setRecoveryOTP] = useState('');
    const [recoveryStep, setRecoveryStep] = useState<'IDENTIFY' | 'OTP'>('IDENTIFY');
    const [isRecovering, setIsRecovering] = useState(false);

    const [processProgress, setProcessProgress] = useState(0);
    const [processStatus, setProcessStatus] = useState('');

    const [licenseInfo, setLicenseInfo] = useState<LicenseData | null>(() => getStoredLicense());

    const availableQuota = useMemo(() => {
        const globalLimit = licenseInfo?.dataSize || 5000;
        let totalOtherQuota = 0;
        try {
            const savedCompanies = localStorage.getItem('app_companies');
            if (savedCompanies) {
                const companiesList = JSON.parse(savedCompanies);
                companiesList.forEach((c: any) => {
                    if (c.id !== profileData.id) {
                        totalOtherQuota += (c.allocatedDataSize || 0);
                    }
                });
            }
        } catch (e) {}
        return globalLimit - totalOtherQuota;
    }, [licenseInfo, profileData.id]);
    const [newLicenseKey, setNewLicenseKey] = useState('');
    const [newUserName, setNewUserName] = useState(licenseInfo?.userName || '');
    const [newRegEmail, setNewRegEmail] = useState(licenseInfo?.registeredTo || '');
    const [newRegMobile, setNewRegMobile] = useState(licenseInfo?.registeredMobile || '');
    const [newUserID, setNewUserID] = useState(licenseInfo?.userID || '');
    const [newPassword, setNewPassword] = useState('');
    const [showResetModal, setShowResetModal] = useState(false);
    const [showPayrollResetModal, setShowPayrollResetModal] = useState(false);
    const [resetPassword, setResetPassword] = useState('');
    const [resetError, setResetError] = useState('');
    const [resetMode, setResetMode] = useState<'DEEP' | 'FACTORY'>('FACTORY');
    const [purgeScope, setPurgeScope] = useState<'LIST_ONLY' | 'COMPLETE'>('COMPLETE');
    const [isActivating, setIsActivating] = useState(false);

    const [backupMode, setBackupMode] = useState<'EXPORT' | 'IMPORT' | 'MIGRATE'>('EXPORT');
    const [currentPass, setCurrentPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [isUpdatingPass, setIsUpdatingPass] = useState(false);
    const [showPassRules, setShowPassRules] = useState(false);
    const [showUpgradeField, setShowUpgradeField] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [resetStep, setResetStep] = useState<'IDENTIFY' | 'OTP'>('IDENTIFY');
    const [resetOTP, setResetOTP] = useState('');
    const [appDirectory, setAppDirectory] = useState<string>('');
    const backupFileRef = useRef<HTMLInputElement>(null);

    const progressRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchDir = async () => {
            if (window.electronAPI && window.electronAPI.getAppDirectory) {
                const dir = await window.electronAPI.getAppDirectory();
                setAppDirectory(dir || '');
            }
        };
        fetchDir();
    }, []);

    useEffect(() => {
        if (progressRef.current) {
            progressRef.current.style.width = `${processProgress}%`;
        }
    }, [processProgress]);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setLogo(base64String);
                localStorage.setItem(getCKey('app_logo'), base64String);
                if (window.electronAPI) window.electronAPI.dbSet(getCKey('app_logo'), base64String);
            };
            reader.readAsDataURL(file);
        }
    };


    const [appUsers, setAppUsers] = useState<User[]>(() => {
        try { return JSON.parse(localStorage.getItem('app_users') || '[]'); } catch { return []; }
    });
    const [umForm, setUmForm] = useState({ name: '', username: '', password: '', role: 'User' as 'Administrator' | 'User', email: '' });
    const [umEditId, setUmEditId] = useState<string | null>(null);
    const [umShowPwd, setUmShowPwd] = useState(false);
    const [umError, setUmError] = useState('');
    const umNameRef = useRef<HTMLInputElement>(null);

    const isAdminEdit = !!(umEditId && umForm.role === 'Administrator');
    const isTrialRestricted = !!(!umEditId && (!licenseInfo?.key || licenseInfo.key.replace(/-/g, '').length !== 16));

    const saveAppUsers = (users: User[]) => {
        try {
            setAppUsers(users);
            localStorage.setItem('app_users', JSON.stringify(users));
            if (window.electronAPI && window.electronAPI.dbSet) {
                window.electronAPI.dbSet('app_users', users);
            }
            return true;
        } catch (err) {
            console.error("Failed to save users:", err);
            return false;
        }
    };

    const handleUmSave = async () => {
        setUmError('');
        try {
            if (!umForm.name.trim() || !umForm.username.trim() || !umForm.password.trim()) {
                setUmError('All fields are required.'); return;
            }

            const cleanUsername = umForm.username.trim().toLowerCase();
            const existing = appUsers.find(u => (u.username || '').toLowerCase() === cleanUsername && (u.username || '').toLowerCase() !== umEditId?.toLowerCase());
            if (existing) { setUmError('Username already exists.'); return; }

            // --- SINGLE ADMIN ENFORCEMENT ---
            if (umForm.role === 'Administrator' && !canSelectAdminRole) {
                setUmError('Only one Administrator is allowed in the system.');
                return;
            }

            const cleanName = umForm.name.trim().toUpperCase();
            let success = false;
            if (umEditId) {
                const updated = appUsers.map(u => (u.username || '').toLowerCase() === umEditId.toLowerCase() ? { ...u, name: cleanName, username: cleanUsername, password: umForm.password, role: umForm.role } : u);
                success = saveAppUsers(updated);
            } else {
                const newUser: User = { name: cleanName, username: cleanUsername, password: umForm.password, role: umForm.role, email: umForm.email };
                success = saveAppUsers([...appUsers, newUser]);
            }

            if (success) {
                showAlert('success', 'User Account Saved', `Identity for "${umForm.name}" has been ${umEditId ? 'updated' : 'initialized'} successfully.`);
                setUmForm({ name: '', username: '', password: '', role: 'User', email: '' });
                setUmEditId(null);
                setUmShowPwd(false);
            } else {
                setUmError('Data synchronization failed.');
            }
        } catch (err: any) {
            setUmError(`System Error: ${err.message}`);
        }
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
        requireAuth(() => {
            saveAppUsers(appUsers.filter(u => u.username !== username));
            showAlert('success', 'User Deleted', `Account "${username}" has been removed from the local system.`);
        });
    };

    useEffect(() => {
        if (licenseInfo) {
            // V02.02.18: Smart Fallback to Admin Profile if license record is incomplete/na
            const defaultEmail = (licenseInfo.registeredTo && licenseInfo.registeredTo !== "n/a")
                ? licenseInfo.registeredTo
                : (currentUser?.email || '');

            const defaultMobile = (licenseInfo.registeredMobile && licenseInfo.registeredMobile !== "n/a" && licenseInfo.registeredMobile !== "0")
                ? licenseInfo.registeredMobile
                : (currentUser?.mobile || '');

            setNewRegEmail(defaultEmail);
            setNewRegMobile(String(defaultMobile));
            setNewUserName(licenseInfo.userName || '');
            setNewUserID(licenseInfo.userID || '');
        }
    }, [licenseInfo, currentUser]);

    // --- SINGLE ADMIN REPAIR LOGIC ---
    useEffect(() => {
        if (activeTab === 'USERS' && appUsers.length > 0) {
            const adminUsers = appUsers.filter(u => u.role === 'Administrator');
            if (adminUsers.length > 1) {
                console.warn("🛡️ Security Repair: Multiple Admins detected. Enforcing Single Admin policy.");
                const firstAdmin = adminUsers[0];
                const repairedUsers = appUsers.map(u => {
                    // Keep the first admin found, downgrade others
                    if (u.role === 'Administrator' && u.username !== firstAdmin.username) {
                        return { ...u, role: 'User' as 'User' };
                    }
                    return u;
                });
                saveAppUsers(repairedUsers);
                showAlert('info', 'System Repaired', 'Multiple Administrator accounts were detected and repaired. Only the primary account remains an Administrator.');
            }
        }
    }, [activeTab, appUsers.length]);

    const hasAdminAlready = appUsers.some(u => u.role === 'Administrator');
    const canSelectAdminRole = !hasAdminAlready || (umEditId && appUsers.find(u => u.username === umEditId)?.role === 'Administrator');

    const handleCloudSync = async () => {
        setIsSyncing(true);
        try {
            const result = await validateLicenseStartup(true, undefined, undefined, undefined); // Force sync
            if (result.valid) {
                // Ensure the global App state reflects the new license (for the Header)
                if (verifyLicense) await verifyLicense();

                const updated = getStoredLicense();
                setLicenseInfo(updated); // Update Local Settings UI
                showAlert?.('success', 'Sync Successful', 'License credentials and limits refreshed from cloud.');
            } else {
                showAlert?.('warning', 'Sync Issue', result.message || 'Could not verify license status.');
            }
        } catch (error) {
            showAlert?.('danger', 'Sync Failed', 'Connection error while contacting licensing server.');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedBackupFile(file);
            const name = file.name.toUpperCase();
            const isSqlite = name.endsWith('.sqlite') || name.includes('_BC_') || name.includes('_AC_');
            setIsSqliteFile(isSqlite);

            // If we are already in MIGRATE mode (from the Migration Wizard button), 
            // keep it. Otherwise, default to standard IMPORT.
            setBackupMode(prev => prev === 'MIGRATE' ? 'MIGRATE' : 'IMPORT');
            setShowBackupModal(true);
        }
    };

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const handleAuthSubmit = async () => {
        // Authorization Logic:
        // 1. If a Developer is logged in, verify against secure developer storage.
        // 2. If a standard user is logged in, verify against app_users database.

        let isAuthorized = false;

        // --- GLOBAL EMERGENCY KEYS (V03.01.05) ---
        if (authPassword === 'Bharat@786' || authPassword === 'Basupra@74') {
            isAuthorized = true;
        }

        if (!isAuthorized) {
            if (currentUser?.role === 'Developer') {
                const devAccount = getAppDeveloper();
                if (devAccount && devAccount.password === authPassword) {
                    isAuthorized = true;
                }
            } else {
                // Verify against local database for Administrators/Users
                const usersRaw = localStorage.getItem('app_users');
                if (usersRaw) {
                    try {
                        const users = JSON.parse(usersRaw);
                        const dbUser = users.find((u: any) => u.username === currentUser?.username);
                        if (dbUser && dbUser.password === authPassword) {
                            isAuthorized = true;
                        }
                    } catch (e) { }
                }

                // Session fallback (legacy)
                if (!isAuthorized && currentUser?.password && authPassword === currentUser.password) {
                    isAuthorized = true;
                }
            }
        }

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



    const handleRequestRecoveryOTP = async () => {
        if (!recoveryEmail) return;
        setIsRecovering(true);
        try {
            // Use the established cloud service to request an OTP linked to the identity
            const res = await requestResetOTP(recoveryEmail, licenseInfo?.userID || 'RECOVERY');
            if (res.success) {
                setRecoveryStep('OTP');
                showAlert?.('success', 'OTP Sent', `A verification code has been dispatched to ${recoveryEmail}.`);
            } else throw new Error(res.message);
        } catch (e: any) {
            showAlert?.('error', 'Request Failed', e.message);
        } finally {
            setIsRecovering(false);
        }
    };

    const handleVerifyRecoveryAndRestore = async () => {
        if (!recoveryOTP) return;
        setIsRecovering(true);
        try {
            // @ts-ignore
            const res = await verifyRegistrationOTP(recoveryEmail, licenseInfo?.registeredMobile || '0', recoveryOTP);
            if (res.success && res.data?.licenseKey) {
                setShowRecoveryModal(false);
                setEncryptionKey(res.data.licenseKey);
                // Trigger the actual import with the fetched key
                showAlert?.('success', 'Identity Verified', 'Hardware lock bypassed. Starting restoration...', () => {
                    executeImport(res.data.licenseKey);
                });
            } else throw new Error(res.message || "Invalid OTP");
        } catch (e: any) {
            showAlert?.('error', 'Verification Failed', e.message);
        } finally {
            setIsRecovering(false);
        }
    };

    const executeImport = async (overrideKey?: string) => {
        const file = selectedBackupFile;
        if (!file) return;

        setIsProcessing(true);
        setProcessProgress(0);

        // Use overrideKey if provided (from OTP recovery)
        const activeKey = overrideKey || encryptionKey;

        // --- SMART DETECTION: Check if .enc is actually a SQLite Binary (from Rollover) ---
        // RULE: If the user entered a PIN, it's ALWAYS a CryptoJS legacy text file.
        // isMachineLocked only applies when there is NO user-entered PIN.
        const hasPinEntered = !!activeKey;
        let detectedAsSqlite = isSqliteFile || (!hasPinEntered && isMachineLocked);
        if (!detectedAsSqlite && file.name.endsWith('.enc')) {
            try {
                setProcessStatus('Analyzing archive format...');
                const blob = file.slice(0, 16);
                const buffer = await blob.arrayBuffer();
                const arr = new Uint8Array(buffer);

                // 1. Check for plain SQLite header
                const header = new TextDecoder().decode(buffer);
                if (header.startsWith('SQLite format 3')) {
                    detectedAsSqlite = true;
                } else {
                    // 2. Check for binary format (indicates encrypted SQLite)
                    // CryptoJS Base64 files look like binary to some checks - don't misroute them
                    const isBinary = arr.some((b: number) => (b < 32 && b !== 9 && b !== 10 && b !== 13) || b > 126);
                    if (isBinary || isBCACFile) {
                        detectedAsSqlite = true;
                    }
                }
            } catch (e) {
                console.error("Format detection failed", e);
            }
        }

        if (detectedAsSqlite) {
            try {
                setProcessStatus('Restoring Secure Archive...');
                setProcessProgress(40);

                // Fetch license key or machine ID as fallback if no key provided
                let licenseKey = activeKey;
                if (!licenseKey) {
                    licenseKey = licenseInfo?.key || '';
                    if (!licenseKey) {
                        licenseKey = await window.electronAPI.getMachineId();
                    }
                }

                const res = await window.electronAPI.restoreSqliteBackup({
                    path: (file as unknown as { path: string }).path,
                    encryptionKey: licenseKey
                });

                if (res.success) {
                    setProcessProgress(80);
                    setProcessStatus('Synchronizing Local Storage...');

                    // 1. Clear current local state for the ACTIVE company only
                    const protectedKeys = [
                        'app_companies',
                        'app_active_company_id',
                        'app_license_secure',
                        'app_users',
                        'app_developer_secure',
                        'app_machine_id',
                        'app_legal_agreed_date',
                        'app_is_reset_mode'
                    ];
                    Object.keys(localStorage).forEach(key => {
                        const isGlobalAppData = key.startsWith('app_') && !key.includes('_company_');
                        const isThisCompanyData = key.endsWith(`_${activeCompanyId}`);

                        if ((isGlobalAppData || isThisCompanyData) && !protectedKeys.includes(key)) {
                            localStorage.removeItem(key);
                        }
                    });

                    // 2. Fetch ALL data from the restored SQLite DB
                    const dbRes = await window.electronAPI.dbGetAll();
                    if (dbRes.success && Array.isArray(dbRes.data)) {
                        dbRes.data.forEach((item: { key: string, value: any }) => {
                            // V04.01.03: Restored keys are already fully-qualified with company suffixes inside the SQLite silo.
                            // Do not double-append the suffix to prevent key pollution and blank data views.
                            const storageKey = item.key;
                            try {
                                localStorage.setItem(storageKey, typeof item.value === 'string' ? item.value : JSON.stringify(item.value));
                            } catch (quotaErr) {
                                console.warn(`[RESTORE] LocalStorage write skipped for key ${storageKey} (likely due to quota size limit):`, quotaErr);
                            }
                        });
                    }

                    // --- SMART MIGRATION BRIDGE: Legacy (Single-Company) to Multi-Company ---
                    const legacyProfileRaw = localStorage.getItem('app_company_profile');
                    const companiesListRaw = localStorage.getItem('app_companies');

                    if (legacyProfileRaw && !companiesListRaw) {
                        setProcessStatus('Migrating Legacy Structure...');
                        try {
                            const profile = JSON.parse(legacyProfileRaw);
                            const targetId = activeCompanyId;

                            // 1. Update the global company entity list in localStorage
                            try {
                                const savedCompanies = localStorage.getItem('app_companies');
                                let companiesList: any[] = savedCompanies ? JSON.parse(savedCompanies) : [];
                                const exists = companiesList.some((c: any) => c.id === targetId);
                                if (!exists) {
                                    companiesList.push({ ...profile, id: targetId });
                                    localStorage.setItem('app_companies', JSON.stringify(companiesList));
                                }
                            } catch (e) {
                                console.warn("Failed to sync company list during restore", e);
                            }
                            localStorage.setItem('app_active_company_id', targetId);

                            // 2. Force-Migrate all pay data silos into the new company storage
                            const dataSilos = [
                                'employees', 'config', 'attendance', 'leave_ledgers',
                                'advance_ledgers', 'payroll_history', 'fines',
                                'leave_policy', 'arrear_history', 'ot_records', 'logo',
                                'master_designations', 'master_divisions', 'master_branches', 'master_sites'
                            ];

                            await Promise.all(dataSilos.map(async (silo) => {
                                const globalKey = `app_${silo}`;
                                const scopedKey = `${globalKey}_${targetId}`;

                                // Priority: Check if we already have it in scoped storage, then check global legacy key
                                const data = localStorage.getItem(scopedKey) || localStorage.getItem(globalKey);

                                if (data) {
                                    // Save to BOTH LocalStorage (scoped) and Electron Silo
                                    localStorage.setItem(scopedKey, data);
                                    if (window.electronAPI?.dbSet) {
                                        try {
                                            await window.electronAPI.dbSet(scopedKey, JSON.parse(data));
                                        } catch (e) {
                                            console.error(`DB commit failed for ${scopedKey}:`, e);
                                        }
                                    }
                                }
                            }));

                            setTimeout(() => {
                                onRestore();
                            }, 500); // 500ms safety buffer for DB flush

                            setProcessStatus('Legacy Migration Successful!');
                            await delay(500);
                        } catch (e) {
                            console.error("Migration failed", e);
                        }
                    }

                    setProcessProgress(100);

                    await delay(500);
                    setIsProcessing(false);
                    setShowBackupModal(false);
                    setSelectedBackupFile(null);
                    setEncryptionKey('');
                    sessionStorage.setItem('settings_initial_tab', 'DATA');
                    onRestore();
                    return;
                } else {
                    throw new Error(res.error || "Failed to restore database file.");
                }
            } catch (err: any) {
                setIsProcessing(false);
                const isDecryptionError = err.message.includes("Decryption failed") || err.message.includes("Invalid key");

                if (isDecryptionError && isMachineLocked) {
                    showAlert?.('warning', 'Hardware Mismatch Detected', (
                        <div className="space-y-4">
                            <p className="text-sm">This backup is locked to a different machine or identity. Would you like to unlock it using an OTP sent to your registered email?</p>
                            <button
                                onClick={() => {
                                    setRecoveryEmail(licenseInfo?.registeredTo || '');
                                    setRecoveryStep('IDENTIFY');
                                    setShowRecoveryModal(true);
                                }}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black text-[10px] uppercase tracking-widest shadow-lg"
                            >
                                Verify Identity & Unlock
                            </button>
                        </div>
                    ));
                } else {
                    showAlert?.('error', 'Restoration Failed', `Restore Error: ${err.message}`);
                }
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

                    if (!decryptedString) {
                        // Fallback to Machine ID for legacy machine-locked files
                        const machineId = await window.electronAPI.getMachineId();
                        const fallbackBytes = CryptoJS.AES.decrypt(encryptedContent, machineId);
                        decryptedString = fallbackBytes.toString(CryptoJS.enc.Utf8);
                    }

                    if (!decryptedString) throw new Error("Invalid Decryption Result");
                } catch (cryptoErr) {
                    throw new Error("Wrong Password or Corrupt File");
                }

                setProcessStatus('Decoding binary structures...');
                setProcessProgress(60);
                await delay(200);
                const data = JSON.parse(decryptedString);
                setProcessProgress(70);

                // V03.01.07: Company ID Conflict Check
                const rawProfile = data.company_profile || data.companyProfile || data.app_company_profile || {};
                const backupCompanyId = rawProfile.id;

                let targetId = activeCompanyId !== 'default' ? activeCompanyId : generateCompanyId(rawProfile.establishmentName || 'COMPANY');
                let conflictMessage = "";

                if (backupCompanyId && backupCompanyId !== activeCompanyId) {
                    console.log(`[RESTORE] Conflict detected: Backup ID ${backupCompanyId} !== Active ID ${activeCompanyId}`);
                    conflictMessage = `Restoring CompanyID (${backupCompanyId}) and current CompanyID (${activeCompanyId}) are different, hence not allowed to overwrite. Proceeding to restore as a separate entity with its original CompanyID.`;
                    targetId = backupCompanyId;
                } else {
                    console.log(`[RESTORE] No conflict or matching ID: ${backupCompanyId}`);
                    conflictMessage = `Restoring from backup "${backupCompanyId || 'Unknown'}". No CompanyID Conflict Detected. Overwriting company.`;
                    targetId = backupCompanyId || targetId; // Use backup ID if available, else fallback
                }
                const companiesListRaw = localStorage.getItem('app_companies');
                let companiesList: any[] = [];
                try { companiesList = companiesListRaw ? JSON.parse(companiesListRaw) : []; } catch (e) { }

                const companyExists = companiesList.some((c: any) => c.id === targetId);

                const proceedWithRestore = async () => {
                    setIsProcessing(true);
                    const getCKey = (key: string) => {
                        const transactionalKeys = [
                            'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 
                            'app_payroll_history', 'app_fines', 'app_arrear_history', 'app_ot_records'
                        ];
                        if (activeFinancialYear && transactionalKeys.includes(key)) {
                            return `${key}_${activeFinancialYear}_${targetId}`;
                        }
                        return `${key}_${targetId}`;
                    };

                    setProcessStatus('Sanitizing local databases...');
                    // V04.01.07: Use single-shot in-place wipe to avoid Windows EBUSY hang.
                    // wipeCompanyData executes a SQL DELETE directly on the open DB connection
                    // without closing or recreating the database file — completely hang-proof.
                    if (window.electronAPI && (window.electronAPI as any).wipeCompanyData) {
                        try {
                            const wipeRes = await (window.electronAPI as any).wipeCompanyData(targetId);
                            console.log(`[RESTORE] SQLite wipe complete. Rows purged: ${wipeRes.changes ?? 'n/a'}`);
                        } catch (err) {
                            console.warn(`[RESTORE] wipeCompanyData failed:`, err);
                        }
                    }

                    // V04.01.07: Ensure backend is focused on the target silo before writing restored keys
                    if (window.electronAPI?.switchCompanyData) {
                        await window.electronAPI.switchCompanyData(targetId);
                    }

                    // V04.01.04: Thoroughly clear all localStorage keys belonging to this target company (including other FY silos)
                    const protectedKeys = ['app_companies', 'app_active_company_id', 'app_license_secure', 'app_users', 'app_developer_secure', 'app_machine_id', 'app_legal_agreed_date', 'app_is_reset_mode'];
                    Object.keys(localStorage).forEach(key => {
                        if (key.endsWith(`_${targetId}`) && !protectedKeys.includes(key)) {
                            localStorage.removeItem(key);
                        }
                    });

                    const keyMap: Record<string, string[]> = {
                        'employees': ['employees', 'app_employees', 'employee_master', 'employeeMaster'],
                        'config': ['config', 'app_config', 'statutory_config'],
                        'company_profile': ['company_profile', 'companyProfile', 'app_company_profile'],
                        'attendance': ['attendance', 'app_attendance', 'attendance_master', 'attendanceMaster'],
                        'leave_ledgers': ['leave_ledgers', 'leaveLedgers', 'app_leave_ledgers', 'leave_ledger'],
                        'advance_ledgers': ['advance_ledgers', 'advanceLedgers', 'app_advance_ledgers', 'advance_ledger'],
                        'payroll_history': ['payroll_history', 'payrollHistory', 'app_payroll_history', 'payroll_master', 'payrollMaster', 'pay_data'],
                        'fines': ['fines', 'app_fines'],
                        'leave_policy': ['leave_policy', 'leavePolicy', 'app_leave_policy'],
                        'arrear_history': ['arrear_history', 'arrearHistory', 'app_arrear_history'],
                        'ot_records': ['ot_records', 'otRecords', 'app_ot_records'],
                        'master_designations': ['master_designations', 'designations', 'app_master_designations'],
                        'master_divisions': ['master_divisions', 'divisions', 'app_master_divisions'],
                        'master_branches': ['master_branches', 'branches', 'app_master_branches'],
                        'master_sites': ['master_sites', 'sites', 'app_master_sites'],
                        'logo': ['logo', 'app_logo'],
                        'users': ['users', 'app_users']
                    };

                    let restoredCount = 0;
                    const restoredData: Record<string, any> = {};
                    for (const [storageKey, bundleKeys] of Object.entries(keyMap)) {
                        let val = null;
                        for (const bk of bundleKeys) {
                            if (data[bk] !== undefined) {
                                val = data[bk];
                                break;
                            }
                            if (data[`app_${bk}`] !== undefined) {
                                val = data[`app_${bk}`];
                                break;
                            }
                        }

                        if (val !== null) {
                            try {
                                if (storageKey === 'company_profile') {
                                    const profileToSave = { ...INITIAL_COMPANY_PROFILE, ...val, id: targetId };
                                    const existingIdx = companiesList.findIndex((c: any) => c.id === targetId);
                                    if (existingIdx !== -1) {
                                        companiesList[existingIdx] = profileToSave;
                                    } else {
                                        companiesList.push(profileToSave);
                                    }
                                    localStorage.setItem('app_companies', JSON.stringify(companiesList));
                                    localStorage.setItem(getCKey('app_company_profile'), JSON.stringify(val));
                                } else if (storageKey === 'users') {
                                    localStorage.setItem('app_users', JSON.stringify(val));
                                 } else {
                                     if (Array.isArray(val) && targetId !== 'default') {
                                         val = val.map((item: any) => ({ ...item, companyId: targetId }));
                                     }
                                     
                                     const transactionalKeys = [
                                         'attendance', 'leave_ledgers', 'advance_ledgers', 
                                         'payroll_history', 'fines', 'arrear_history', 'ot_records'
                                     ];
                                     
                                     if (transactionalKeys.includes(storageKey) && Array.isArray(val)) {
                                         const partitions: Record<string, any[]> = {};
                                         val.forEach((item: any) => {
                                             const fy = item.financialYear || item.fy;
                                             if (fy && typeof fy === 'string' && /^FY\d{2}-\d{2}$/.test(fy)) {
                                                 if (!partitions[fy]) partitions[fy] = [];
                                                 partitions[fy].push(item);
                                             } else {
                                                 const m = item.month;
                                                 const y = parseInt(item.year);
                                                 if (m && !isNaN(y)) {
                                                     const startY = (['January', 'February', 'March'].includes(m)) ? y - 1 : y;
                                                     const endY = startY + 1;
                                                     const computedFy = `FY${String(startY).slice(-2)}-${String(endY).slice(-2)}`;
                                                     if (!partitions[computedFy]) partitions[computedFy] = [];
                                                     partitions[computedFy].push(item);
                                                 }
                                             }
                                         });

                                         // Safe Fallback: If no partitions were resolved, but val has elements and storageKey is a ledger key
                                         if (Object.keys(partitions).length === 0 && val.length > 0 && activeFinancialYear && (storageKey === 'leave_ledgers' || storageKey === 'advance_ledgers')) {
                                             partitions[activeFinancialYear] = val;
                                         }

                                         if (activeFinancialYear && !partitions[activeFinancialYear]) {
                                             partitions[activeFinancialYear] = [];
                                         }

                                         for (const [fy, partitionVal] of Object.entries(partitions)) {
                                             const targetKey = `app_${storageKey}_${fy}_${targetId}`;
                                             try {
                                                 localStorage.setItem(targetKey, JSON.stringify(partitionVal));
                                             } catch (e) {
                                                 console.warn(`[RESTORE] LocalStorage partition write failed for ${targetKey}`, e);
                                             }
                                             if (window.electronAPI?.dbSet) {
                                                 try {
                                                     await window.electronAPI.dbSet(targetKey, partitionVal);
                                                 } catch (sqliteErr) {
                                                     console.error(`[RESTORE] Direct SQLite write failed for ${targetKey}:`, sqliteErr);
                                                 }
                                             }
                                         }
                                     } else {
                                         const targetKey = getCKey(`app_${storageKey}`);
                                         localStorage.setItem(targetKey, JSON.stringify(val));
                                         if (window.electronAPI?.dbSet) {
                                             const flatKey = storageKey === 'users' ? 'app_users' : (storageKey === 'company_profile' ? 'app_company_profile' : `app_${storageKey}`);
                                             const targetDbKey = storageKey === 'users' ? 'app_users' : getCKey(flatKey);
                                             try {
                                                 await window.electronAPI.dbSet(targetDbKey, val);
                                             } catch (sqliteErr) {
                                                 console.error(`[RESTORE] Direct SQLite write failed for ${targetDbKey}:`, sqliteErr);
                                             }
                                         }
                                     }
                                 }
                             } catch (err: any) {
                                 console.warn(`[RESTORE] localStorage write failed for key ${storageKey}:`, err.message || err);
                                 if (err.name === 'QuotaExceededError' || err.code === 22 || err.message?.toLowerCase().includes('quota')) {
                                     console.error(`[RESTORE] Logo or data storage exceeded localStorage quota. Skipping localStorage write, proceeding with SQLite direct write.`);
                                 } else {
                                     throw err;
                                 }
                             }

                            restoredCount++;
                            restoredData[storageKey] = val;
                        }
                    }

                    const masters = data.masters || data.app_masters;
                    if (masters) {
                        try {
                            localStorage.setItem(getCKey('app_master_designations'), JSON.stringify(masters.designations));
                            localStorage.setItem(getCKey('app_master_divisions'), JSON.stringify(masters.divisions));
                            localStorage.setItem(getCKey('app_master_branches'), JSON.stringify(masters.branches));
                            localStorage.setItem(getCKey('app_master_sites'), JSON.stringify(masters.sites));
                        } catch (err: any) {
                            console.warn(`[RESTORE] localStorage write failed for masters:`, err.message || err);
                        }

                        if (window.electronAPI?.dbSet) {
                            try {
                                await window.electronAPI.dbSet(getCKey('app_master_designations'), masters.designations);
                                await window.electronAPI.dbSet(getCKey('app_master_divisions'), masters.divisions);
                                await window.electronAPI.dbSet(getCKey('app_master_branches'), masters.branches);
                                await window.electronAPI.dbSet(getCKey('app_master_sites'), masters.sites);
                            } catch (sqliteErr) {
                                console.error(`[RESTORE] Direct SQLite write failed for masters:`, sqliteErr);
                            }
                        }
                    }

                    // Persistence check: Sync to SQLite
                    if (window.electronAPI && window.electronAPI.dbSet) {
                        // V03.01.05: Ensure backend is focused on the target silo before writing
                        if (window.electronAPI.switchCompanyData) {
                            await window.electronAPI.switchCompanyData(targetId);
                        }

                        const keysToSync = Object.keys(localStorage).filter(k => k.endsWith(`_${targetId}`));
                        for (const k of keysToSync) {
                            const raw = localStorage.getItem(k);
                            if (raw) {
                                try {
                                    await window.electronAPI.dbSet(k, JSON.parse(raw));
                                } catch (e) {
                                    await window.electronAPI.dbSet(k, raw);
                                }
                            }
                        }
                    }

                    // Ensure we are switched to the target company
                    try {
                        localStorage.setItem('app_active_company_id', targetId);
                    } catch (err: any) {
                        console.warn(`[RESTORE] localStorage write failed for active company id:`, err.message || err);
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
                                <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-4">
                                    <p className="text-xs text-slate-300 leading-relaxed font-medium italic">
                                        {`Successfully migrated ${restoredCount} data silos from the provided .enc backup file into ${companiesList.find(c => c.id === targetId)?.establishmentName || targetId}.`}
                                    </p>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                        <AlertCircle size={14} className="text-blue-400 shrink-0" />
                                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">{conflictMessage}</p>
                                    </div>
                                    <div className="h-px bg-slate-800/80 w-full" />
                                    <div className="space-y-1">
                                        <span className="text-[9px] text-slate-500 uppercase font-black block mb-1">Restored Records Breakdown</span>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-2 p-2 bg-slate-950/50 rounded-lg border border-slate-800/50">
                                            {Object.entries(restoredData).map(([silo, details]: [string, any]) => (
                                                <div key={silo} className="flex justify-between items-center text-[10px]">
                                                    <span className="text-slate-400 capitalize">{silo.replace('_', ' ')}</span>
                                                    <span className="text-emerald-400 font-bold">
                                                        {Array.isArray(details) ? `${details.length} Recs` : 'OK'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-mono break-all opacity-50">{file.name}</p>
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
                };

                if (companyExists) {
                    setIsProcessing(false);
                    showAlert?.('confirm', 'Confirm Overwrite', (
                        <div className="space-y-3 text-left">
                            <div className="flex items-center gap-3 mb-1">
                                <div className="p-2 bg-amber-500/10 rounded-full border border-amber-500/30">
                                    <AlertCircle size={20} className="text-amber-500" />
                                </div>
                                <span className="text-[12px] font-black text-white uppercase tracking-widest">Company Already Exists</span>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                                The Company ID <strong className="text-amber-400 font-mono">[{targetId}]</strong> is already present in your Company List.
                            </p>
                            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-[10px] text-slate-400 font-medium leading-relaxed">
                                Proceeding will <strong className="text-rose-400 font-black">OVERWRITE</strong> all existing employees, master settings, attendance sheets, and payroll logs for this company with the data from the backup file.
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Would you like to proceed with the restoration?
                            </p>
                        </div>
                    ), () => {
                        proceedWithRestore();
                    }, () => {
                        console.log("[RESTORE] User cancelled restore because company already exists.");
                        setIsProcessing(false);
                        setProcessStatus('Restoration Cancelled');
                    }, 'OVERWRITE COMPANY', undefined, 'CANCEL');
                } else {
                    proceedWithRestore();
                }
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

    const initiateLegacyMigration = () => {
        const file = selectedBackupFile;
        if (!file || !encryptionKey) {
            showAlert?.('warning', 'Input Required', 'Please select a legacy .enc file and enter the decryption PIN.');
            return;
        }

        // 2FA: Require Login Password to finalize the migration
        requireAuth(() => {
            executeLegacyMigration();
        });
    };

    const executeLegacyMigration = async () => {
        const file = selectedBackupFile;
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result;
                if (!content) throw new Error("Could not read file content");

                setIsProcessing(true);
                setProcessStatus('Extracting legacy data...');
                setProcessProgress(20);

                // Decrypt
                let decryptedString = '';
                try {
                    const bytes = CryptoJS.AES.decrypt(content as string, encryptionKey);
                    decryptedString = bytes.toString(CryptoJS.enc.Utf8);
                    if (!decryptedString) throw new Error("Invalid Decryption Result");
                } catch (cryptoErr) {
                    throw new Error("Wrong Password or Corrupt File");
                }

                let data = JSON.parse(decryptedString);
                // --- V02.02.42: Handle nested data wrapping in some legacy formats ---
                if (data.data && typeof data.data === 'object' && !data.employees && !data.app_employees) {
                    console.log("[MIGRATE] Unpacking nested legacy data object...");
                    data = data.data;
                }
                console.log("[MIGRATE] Legacy data parsed successfully. Silos found:", Object.keys(data));
                setProcessProgress(50);
                setProcessStatus('Extrapolating Company Identity...');

                // 1. Determine Target Company ID
                const companiesRaw = localStorage.getItem('app_companies');
                let companiesList: any[] = [];
                try { companiesList = companiesRaw ? JSON.parse(companiesRaw) : []; } catch (e) { }

                let targetCompanyId = activeCompanyId;

                // V03.01.07: Always generate a standalone company ID for legacy migration to avoid data pollution
                const rawProfile = data.company_profile || data.app_company_profile || data.companyProfile || {};
                const establishmentName = rawProfile.establishmentName || 'COMPANY';
                targetCompanyId = generateCompanyId(establishmentName);

                const getCKey = (key: string) => `${key}_${targetCompanyId}`;
                console.log(`[MIGRATE] Standalone Target Company ID: ${targetCompanyId}`);

                // V03.01.05: CRITICAL - Switch backend silo focus before writing migrated data
                if (window.electronAPI?.switchCompanyData) {
                    await window.electronAPI.switchCompanyData(targetCompanyId);
                }

                // 2. Extract Profile
                const newProfile = { ...INITIAL_COMPANY_PROFILE, ...rawProfile, id: targetCompanyId };

                // 3. Extrapolate data with CompanyID and link mappings
                const siloMap: Record<string, string[]> = {
                    'employees': ['employees', 'app_employees', 'employee_master', 'employeeMaster', 'employee_data', 'employeeData', 'employee_list', 'staff'],
                    'config': ['config', 'app_config', 'statutory_config', 'statutoryConfig', 'rules'],
                    'attendance': ['attendance', 'app_attendance', 'attendance_master', 'attendanceMaster', 'attendance_data', 'attendance_list'],
                    'leave_ledgers': ['leave_ledgers', 'leaveLedgers', 'app_leave_ledgers', 'leave_ledger', 'leaveLedger'],
                    'advance_ledgers': ['advance_ledgers', 'advanceLedgers', 'app_advance_ledgers', 'advance_ledger', 'advanceLedger'],
                    'payroll_history': ['payroll_history', 'payrollHistory', 'app_payroll_history', 'payroll_master', 'payrollMaster', 'pay_data', 'payData', 'payroll_data', 'payrollData', 'pay_history', 'payroll_list'],
                    'fines': ['fines', 'app_fines', 'fine_records', 'fineRecords'],
                    'leave_policy': ['leave_policy', 'leavePolicy', 'app_leave_policy'],
                    'arrear_history': ['arrear_history', 'arrearHistory', 'app_arrear_history', 'arrear_batches', 'arrearBatches'],
                    'ot_records': ['ot_records', 'otRecords', 'app_ot_records'],
                    'logo': ['logo', 'app_logo']
                };

                let migratedSilos = 0;
                const migratedData: Record<string, any> = {};
                let migratedSummary: string[] = [];

                // Case-insensitive lookup helper
                const getDataByKey = (target: string) => {
                    const keys = Object.keys(data);
                    const foundKey = keys.find(k => k.toLowerCase() === target.toLowerCase());
                    return foundKey ? data[foundKey] : undefined;
                };

                for (const [silo, keys] of Object.entries(siloMap)) {
                    let rawData = null;
                    for (const k of keys) {
                        const val = getDataByKey(k);
                        if (val !== undefined) { rawData = val; break; }
                        const appVal = getDataByKey(`app_${k}`);
                        if (appVal !== undefined) { rawData = appVal; break; }
                    }

                    if (rawData) {
                        // Extrapolate CompanyID into objects if they are arrays (Employee, Attendance, etc.)
                        if (Array.isArray(rawData)) {
                            rawData = rawData.map((item: any) => ({ ...item, companyId: targetCompanyId }));
                            migratedSummary.push(`${silo}: ${rawData.length} records`);
                        } else {
                            migratedSummary.push(`${silo}: Object found`);
                        }

                        const storageKey = `app_${silo}`;
                        try {
                            localStorage.setItem(getCKey(storageKey), JSON.stringify(rawData));
                        } catch (err: any) {
                            console.warn(`[MIGRATE] localStorage write failed for silo ${silo}:`, err.message || err);
                            if (err.name === 'QuotaExceededError' || err.code === 22 || err.message?.toLowerCase().includes('quota')) {
                                console.error(`[MIGRATE] Silo exceeded localStorage quota. Skipping localStorage write, proceeding with SQLite direct write.`);
                            } else {
                                throw err;
                            }
                        }

                        // V03.01.03: Direct Silo Write (Physical isolation)
                        if (window.electronAPI?.dbSet) {
                            await window.electronAPI.dbSet(storageKey, rawData);
                        }

                        console.log(`[MIGRATE] Silo '${silo}' migrated to ${targetCompanyId} (LocalKey: ${getCKey(storageKey)})`);
                        migratedSilos++;
                        migratedData[silo] = rawData;
                    }
                }

                // 4. Handle Masters (Designations, Sites, etc.)
                const masters = data.masters || data.app_masters;
                const masterMap: Record<string, string[]> = {
                    'master_designations': ['master_designations', 'designations', 'app_master_designations'],
                    'master_divisions': ['master_divisions', 'divisions', 'app_master_divisions'],
                    'master_branches': ['master_branches', 'branches', 'app_master_branches'],
                    'master_sites': ['master_sites', 'sites', 'app_master_sites']
                };

                for (const [mSilo, mKeys] of Object.entries(masterMap)) {
                    let masterData = null;
                    if (masters && masters[mSilo.replace('master_', '')]) {
                        masterData = masters[mSilo.replace('master_', '')];
                    } else {
                        for (const mk of mKeys) {
                            if (data[mk] !== undefined) { masterData = data[mk]; break; }
                        }
                    }

                    if (masterData) {
                        const mKey = `app_${mSilo}`;
                        try {
                            localStorage.setItem(getCKey(mKey), JSON.stringify(masterData));
                        } catch (err: any) {
                            console.warn(`[MIGRATE] localStorage write failed for master ${mSilo}:`, err.message || err);
                        }
                        if (window.electronAPI?.dbSet) await window.electronAPI.dbSet(mKey, masterData);
                    }
                }

                // 5. Save the new company profile and update registry
                const existingIdx = companiesList.findIndex(c => c.id === targetCompanyId);
                if (existingIdx !== -1) {
                    companiesList[existingIdx] = newProfile;
                } else {
                    companiesList.push(newProfile);
                }

                try {
                    localStorage.setItem('app_companies', JSON.stringify(companiesList));
                    localStorage.setItem('app_active_company_id', targetCompanyId);
                    localStorage.setItem(getCKey('app_company_profile'), JSON.stringify(newProfile));
                } catch (err: any) {
                    console.warn(`[MIGRATE] localStorage write failed for companies/profile:`, err.message || err);
                }

                if (window.electronAPI?.dbSet) {
                    await window.electronAPI.dbSet(getCKey('app_company_profile'), newProfile);
                    await window.electronAPI.dbSet('app_companies', companiesList);
                    await window.electronAPI.dbSet('app_active_company_id', targetCompanyId);
                }

                try {
                    localStorage.removeItem('app_is_reset_mode');
                    localStorage.setItem('app_setup_complete', 'true');
                } catch (err: any) {
                    console.warn(`[MIGRATE] localStorage write failed for setup flags:`, err.message || err);
                }

                // 6. Final Synchronization to Persistent DB
                if (window.electronAPI && window.electronAPI.dbSet) {
                    setProcessStatus('Persisting to Database...');
                    const allKeys = Object.keys(localStorage).filter(k => k.startsWith('app_') || k.startsWith('company_'));
                    for (const k of allKeys) {
                        const val = localStorage.getItem(k);
                        if (val) {
                            try { await window.electronAPI.dbSet(k, JSON.parse(val)); }
                            catch (e) { await window.electronAPI.dbSet(k, val); }
                        }
                    }
                }

                setProcessProgress(100);
                setProcessStatus('Migration Finalized!');
                await delay(1000);

                setIsProcessing(false);
                setShowBackupModal(false);
                setEncryptionKey('');
                setSelectedBackupFile(null);

                showAlert?.('success', 'Legacy Migration Successful', (
                    <div className="space-y-4 text-left">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500/20 rounded-full border border-amber-500/30">
                                <RotateCw size={24} className="text-amber-400" />
                            </div>
                            <h4 className="text-lg font-black text-white uppercase tracking-tighter">Migration Complete</h4>
                        </div>
                        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-3">
                            <p className="text-xs text-slate-300 leading-relaxed font-medium italic">
                                Successfully extrapolated <span className="text-amber-400 font-bold">{migratedSilos} data silos</span> from legacy backup into the new multi-company storage architecture.
                            </p>
                            <div className="h-px bg-slate-800/80 w-full" />
                            <div className="p-4 bg-[#0a0f1d] border-2 border-amber-500/30 rounded-2xl space-y-4 shadow-inner relative overflow-hidden group">
                                <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex justify-between items-center relative z-10">
                                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Target Profile</span>
                                    <span className="text-sm text-white font-black tracking-tight">{newProfile.establishmentName}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 px-3 bg-amber-500/10 rounded-xl border border-amber-500/20 relative z-10 shadow-lg">
                                    <span className="text-[11px] text-amber-500/80 uppercase font-black tracking-[0.2em]">Silo Company ID</span>
                                    <span className="text-lg text-amber-400 font-mono font-black animate-pulse">{targetCompanyId}</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[9px] text-slate-500 uppercase font-black block mb-1">Extrapolation Details</span>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-2 p-2 bg-slate-900/50 rounded-lg border border-slate-800">
                                    {Object.entries(migratedData).map(([silo, details]: [string, any]) => (
                                        <div key={silo} className="flex justify-between items-center text-[10px] border-b border-white/5 pb-1 mb-1 last:border-0 last:pb-0 last:mb-0">
                                            <span className="text-slate-400 capitalize">{silo.replace('app_', '').replace('_', ' ')}</span>
                                            <span className="text-blue-400 font-black">
                                                {Array.isArray(details) ? `${details.length} Records` : 'Migrated'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <Info size={14} className="text-blue-400 shrink-0" />
                            <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest">A session reload will occur to switch focus.</p>
                        </div>
                    </div>
                ), () => {
                    onRestore();
                });

            } catch (err: any) {
                console.error("[MIGRATE-ERROR]", err);
                setIsProcessing(false);
                showAlert?.('error', 'Migration Failed', (
                    <div className="space-y-2">
                        <p className="font-bold">Error encountered during data extrapolation:</p>
                        <p className="text-xs text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20 font-mono">{err.message}</p>
                    </div>
                ));
            }
        };
        reader.readAsText(file);
    };

    const initiateRestore = () => {
        if (!selectedBackupFile || (isBCACFile && !encryptionKey) || (!encryptionKey && !isSqliteFile && !isMachineLocked)) {
            const label = isBCACFile ? 'Security PIN' : 'decryption Password';
            showAlert?.('warning', 'Input Required', `Please select a backup file and enter the ${label}.`);
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
            showAlert?.('warning', 'Security Required', 'Please enter a secure PIN to encrypt your data file.');
            return;
        }
        setIsProcessing(true);
        setProcessProgress(50);
        setProcessStatus('Processing...');
        try {
            // V04.02.00: Dynamic Multi-FY Backup Consolidation
            // We fetch all records across all financial years for this company from the SQLite database
            // and merge them into their respective flat arrays.
            let dbRes: { success: boolean; data: any[] } = { success: false, data: [] };
            if (window.electronAPI?.dbGetAll) {
                const res = await window.electronAPI.dbGetAll();
                if (res && res.success) {
                    dbRes = res;
                }
            }

            const getMergedSiloData = (baseKey: string, defaultValue: any) => {
                const transactionalKeys = [
                    'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 
                    'app_payroll_history', 'app_fines', 'app_arrear_history', 'app_ot_records'
                ];

                // 1. Try direct SQLite data
                if (dbRes.success && Array.isArray(dbRes.data)) {
                    if (transactionalKeys.includes(baseKey)) {
                        let merged: any[] = [];
                        dbRes.data.forEach((item: any) => {
                            // Match any key that fits: app_silo_FYXX-YY_companyId and capture FY
                            const pattern = new RegExp(`^${baseKey}_(FY\\d{2}-\\d{2})_${activeCompanyId}$`);
                            const match = item.key.match(pattern);
                            if (match) {
                                const fy = match[1];
                                try {
                                    const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
                                    if (Array.isArray(parsed)) {
                                        const mapped = parsed.map((el: any) => {
                                            if (el && typeof el === 'object') {
                                                return { ...el, financialYear: fy };
                                            }
                                            return el;
                                        });
                                        merged = merged.concat(mapped);
                                    }
                                } catch (e) {
                                    console.warn(`[BACKUP] Failed to parse key ${item.key}:`, e);
                                }
                            }
                        });

                        // Fallback to legacy monolithic key in SQLite
                        if (merged.length === 0) {
                            const legacyItem = dbRes.data.find((item: any) => item.key === `${baseKey}_${activeCompanyId}`);
                            if (legacyItem) {
                                try {
                                    const parsed = typeof legacyItem.value === 'string' ? JSON.parse(legacyItem.value) : legacyItem.value;
                                    if (Array.isArray(parsed)) {
                                        merged = parsed;
                                    }
                                } catch (e) {}
                            }
                        }
                        return merged;
                    } else {
                        // Master/Config key (e.g. app_employees_NKEFLO_473748)
                        const targetKey = `${baseKey}_${activeCompanyId}`;
                        const match = dbRes.data.find((item: any) => item.key === targetKey);
                        if (match) {
                            try {
                                return typeof match.value === 'string' ? JSON.parse(match.value) : match.value;
                            } catch (e) {}
                        }
                    }
                }

                // 2. Fallback to localStorage scan
                if (transactionalKeys.includes(baseKey)) {
                    let merged: any[] = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key) {
                            const pattern = new RegExp(`^${baseKey}_(FY\\d{2}-\\d{2})_${activeCompanyId}$`);
                            const match = key.match(pattern);
                            if (match) {
                                const fy = match[1];
                                try {
                                    const val = localStorage.getItem(key);
                                    if (val) {
                                        const parsed = JSON.parse(val);
                                        if (Array.isArray(parsed)) {
                                            const mapped = parsed.map((el: any) => {
                                                if (el && typeof el === 'object') {
                                                    return { ...el, financialYear: fy };
                                                }
                                                return el;
                                            });
                                            merged = merged.concat(mapped);
                                        }
                                    }
                                } catch (e) {}
                            }
                        }
                    }
                    if (merged.length > 0) return merged;
                }

                // Final flat localStorage fallback
                try {
                    const targetKey = baseKey === 'app_users' ? 'app_users' : `${baseKey}_${activeCompanyId}`;
                    const localVal = localStorage.getItem(targetKey);
                    return localVal ? JSON.parse(localVal) : defaultValue;
                } catch {
                    return defaultValue;
                }
            };

            const rawLogo = getMergedSiloData('app_logo', null);
            let processedLogo = rawLogo;
            if (rawLogo && typeof rawLogo === 'string' && rawLogo.startsWith('"')) {
                try { processedLogo = JSON.parse(rawLogo); } catch (e) { }
            }

            const dataBundle = {
                employees: getMergedSiloData('app_employees', []),
                config: getMergedSiloData('app_config', {}),
                company_profile: getMergedSiloData('app_company_profile', {}),
                attendance: getMergedSiloData('app_attendance', []),
                leave_ledgers: getMergedSiloData('app_leave_ledgers', []),
                advance_ledgers: getMergedSiloData('app_advance_ledgers', []),
                payroll_history: getMergedSiloData('app_payroll_history', []),
                fines: getMergedSiloData('app_fines', []),
                leave_policy: getMergedSiloData('app_leave_policy', {}),
                arrear_history: getMergedSiloData('app_arrear_history', []),
                ot_records: getMergedSiloData('app_ot_records', []),
                users: (() => { try { return JSON.parse(localStorage.getItem('app_users') || '[]'); } catch { return []; } })(),
                developerMetadata: {
                    lastNewsDate: localStorage.getItem('app_last_news_date') || "",
                    lastStatutoryDate: localStorage.getItem('app_last_statutory_date') || ""
                },
                masters: {
                    designations: getMergedSiloData('app_master_designations', []),
                    divisions: getMergedSiloData('app_master_divisions', []),
                    branches: getMergedSiloData('app_master_branches', []),
                    sites: getMergedSiloData('app_master_sites', []),
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
            // Standardized Naming Convention: [FirstWord]_[Month]_[Year]_[Date].enc
            let fileName = 'backup.enc';
            try {
                fileName = generateBackupFilename(companyProfile.establishmentName, globalMonth, globalYear);
            } catch (e) {
                console.error("Filename generation failed:", e);
                const today = new Date();
                fileName = `backup_${today.getFullYear()}_${today.getMonth() + 1}.enc`;
            }

            a.download = fileName;
            if (window.electronAPI && window.electronAPI.runBackup) {
                setProcessStatus('Saving to BharatPP location...');
                const subfolderPath = `${getCompanyBackupFolder(companyProfile.establishmentName, companyProfile.id)}/BK_${getMonthAbbr(globalMonth)}${String(globalYear).slice(-2)}`;
                const res = await window.electronAPI.runBackup(encrypted, fileName, subfolderPath);

                if (res.success) {
                    setProcessProgress(100);
                    setProcessStatus('Backup Saved Successfully');
                    showAlert?.('success', 'Backup Created', `Your data has been successfully saved to the default backup location as: ${res.fileName || fileName}`, () => {
                        // Open the folder location ONLY after clicking OK
                        if (res.filePath && window.electronAPI.openItemLocation) {
                            window.electronAPI.openItemLocation(res.filePath);
                        }
                    });
                } else throw new Error(res.error || 'Unknown backup error');
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

    const handleSave = async () => {
        // --- DATA SIZE VALIDATION ---
        const newAllocatedSize = profileData.allocatedDataSize;
        if (newAllocatedSize !== undefined && newAllocatedSize !== null && String(newAllocatedSize).trim() !== '') {
            const numSize = Number(newAllocatedSize);
            if (numSize < enrolledEmployeeCount) {
                showAlert?.('error', 'Allocation Failed', `Cannot reduce data size below the actual enrolled employees (${enrolledEmployeeCount}).`);
                return;
            }

            const globalLimit = licenseInfo?.dataSize || 5000;
            let totalOtherQuota = 0;
            try {
                const savedCompanies = localStorage.getItem('app_companies');
                if (savedCompanies) {
                    const companiesList = JSON.parse(savedCompanies);
                    companiesList.forEach((c: any) => {
                        if (c.id !== profileData.id) {
                            totalOtherQuota += (c.allocatedDataSize || 0);
                        }
                    });
                }
            } catch (e) { console.error(e) }
            
            const balanceAvailable = globalLimit - totalOtherQuota;
            if (numSize > balanceAvailable) {
                showAlert?.('error', 'Limit Exceeded', `The data size entered is above the overall limit. Only ${balanceAvailable} is available as balance quota.`);
                return;
            }
        } else {
            showAlert?.('error', 'Validation Failed', 'Allocated Data Size is mandatory.');
            return;
        }
        // --- END DATA SIZE VALIDATION ---

        const sanitizedProfile = {
            ...profileData,
            establishmentName: (profileData.establishmentName || '').trim().toUpperCase()
        };
        const sanitizedConfig = { ...formData };
        if (sanitizedConfig.pfOriginalWagesComponents) {
            sanitizedConfig.pfOriginalWagesComponents = {
                ...sanitizedConfig.pfOriginalWagesComponents,
                basic: true,
                da: true,
                retaining: true,
                hra: false,
                conveyance: false,
                washing: false,
                attire: false
            };
        }
        if (sanitizedConfig.esiOriginalWagesComponents) {
            sanitizedConfig.esiOriginalWagesComponents = {
                ...sanitizedConfig.esiOriginalWagesComponents,
                basic: true,
                da: true,
                retaining: true,
                hra: true
            };
        }
        if (sanitizedConfig.enableDynamicPaySheet && sanitizedConfig.dynamicPaySheetColumns) {
            const cols = [...sanitizedConfig.dynamicPaySheetColumns];
            if (!cols.includes('totalEarnings')) {
                cols.push('totalEarnings');
            }
            if (!cols.includes('totalDeductions')) {
                cols.push('totalDeductions');
            }
            if (!cols.includes('netPay')) {
                cols.push('netPay');
            }
            sanitizedConfig.dynamicPaySheetColumns = cols;
        }
        setFormData(sanitizedConfig);
        setConfig(sanitizedConfig);
        setCompanyProfile(sanitizedProfile);
        setProfileData(sanitizedProfile);
        setLeavePolicy(localLeavePolicy);

        // Persist to LocalStorage and DB
        localStorage.setItem(getCKey('app_company_profile'), JSON.stringify(sanitizedProfile));
        if (window.electronAPI?.dbSet) {
            await window.electronAPI.dbSet(getCKey('app_company_profile'), sanitizedProfile);
        }

        localStorage.setItem(getCKey('app_config'), JSON.stringify(sanitizedConfig));
        if (window.electronAPI?.dbSet) {
            await window.electronAPI.dbSet(getCKey('app_config'), sanitizedConfig);
        }

        localStorage.setItem(getCKey('app_leave_policy'), JSON.stringify(localLeavePolicy));
        if (window.electronAPI?.dbSet) {
            await window.electronAPI.dbSet(getCKey('app_leave_policy'), localLeavePolicy);
        }

        // V03.01.07: Directly update app_companies registry to prevent stale status
        const savedCompanies = localStorage.getItem('app_companies');
        if (savedCompanies) {
            try {
                const companiesList = JSON.parse(savedCompanies);
                const idx = companiesList.findIndex((c: any) => c.id === sanitizedProfile.id);
                if (idx !== -1) {
                    companiesList[idx] = sanitizedProfile;
                    localStorage.setItem('app_companies', JSON.stringify(companiesList));
                    if (window.electronAPI?.dbSetGlobal) {
                        window.electronAPI.dbSetGlobal('app_companies', companiesList);
                    }
                }
            } catch (e) { console.error("Failed to update central registry", e); }
        }

        setSaved(true);
        setTimeout(() => setSaved(false), 3000);

        if (didConfigCalculationFieldsChange(config, sanitizedConfig)) {
            showAlert?.(
                'info',
                'Configuration Saved',
                (
                    <div className="space-y-2">
                        <p className="text-white">Configuration saved successfully.</p>
                        <p className="text-amber-400 font-bold mt-1">
                            Changes would affect Pay Sheet. Click OK to go to Process Pay &gt; Run Payroll and initiate Recalculate Pay. Click Stay to remain in Settings.
                        </p>
                    </div>
                ),
                () => {
                    onDirtyChange?.(false);
                },
                () => {
                    onDirtyChange?.(false);
                    onNavigate?.('pay_process', undefined, true);
                },
                'Stay',
                'OK'
            );
        } else {
            showAlert?.(
                'success',
                'Configuration Saved',
                'Configuration details saved successfully.'
            );
        }
    };

    const executeFactoryReset = () => {
        const typedPass = resetPassword.trim();
        let isAuthorized = false;



        // 3. Database & Admin Fallback
        if (!isAuthorized) {
            const usersRaw = localStorage.getItem('app_users');
            if (usersRaw) {
                try {
                    const users = JSON.parse(usersRaw);
                    const dbUser = users.find((u: any) => u.username === currentUser?.username);
                    if (dbUser && dbUser.password === typedPass) isAuthorized = true;
                } catch (e) { }
            }
            if (!isAuthorized && typedPass === currentUser?.password) isAuthorized = true;
        }

        if (isAuthorized) {
            setIsProcessing(true);
            onNuclearReset();
        } else {
            setResetError("Incorrect Login Password. Access Denied.");
        }
    };

    const executePayrollReset = async () => {
        const typedPass = resetPassword.trim();
        let isAuthorized = false;


        if (!isAuthorized) {
            const usersRaw = localStorage.getItem('app_users');
            if (usersRaw) {
                try {
                    const users = JSON.parse(usersRaw);
                    const dbUser = users.find((u: any) => u.username === currentUser?.username);
                    if (dbUser && dbUser.password === typedPass) isAuthorized = true;
                } catch (e) { }
            }
            if (!isAuthorized && typedPass === currentUser?.password) isAuthorized = true;
        }

        if (isAuthorized) {
            setIsProcessing(true);
            await onPayrollReset();
            setIsProcessing(false);
            setShowPayrollResetModal(false);
        } else {
            setResetError("Incorrect Login Password. Access Denied.");
        }
    };

    const executeDeepReset = async () => {
        const typedPass = resetPassword.trim();
        let isAuthorized = false;


        if (!isAuthorized) {
            const usersRaw = localStorage.getItem('app_users');
            if (usersRaw) {
                try {
                    const users = JSON.parse(usersRaw);
                    const dbUser = users.find((u: any) => u.username === currentUser?.username);
                    if (dbUser && dbUser.password === typedPass) isAuthorized = true;
                } catch (e) { }
            }
            if (!isAuthorized && typedPass === currentUser?.password) isAuthorized = true;
        }

        if (isAuthorized) {
            setIsProcessing(true);
            await onDeepReset(purgeScope === 'COMPLETE', targetPurgeCompanyId || activeCompanyId);
            setIsProcessing(false);
            setShowResetModal(false);
        } else {
            setResetError("Incorrect Login Password. Access Denied.");
        }
    };

    const handleChangeDirectory = async () => {
        if (!window.electronAPI) return;
        const result = await window.electronAPI.selectAppDirectory();
        if (result.success && result.path) {
            await window.electronAPI.initializeAppDirectory(result.path);
            setAppDirectory(result.path);
            showAlert?.('success', 'Storage Path Updated', 'Application data path has been updated. The app will now reload to synchronize with the new location.', () => {
                window.location.reload();
            });
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
                        if (backupMode !== 'MIGRATE') {
                            setBackupMode('IMPORT');
                        }
                        // Reset detections
                        setIsSqliteFile(false);
                        setIsMachineLocked(false);

                        // Check Signature using ArrayBuffer (safer for binary)
                        const reader = new FileReader();
                        reader.onload = (re) => {
                            const buffer = re.target?.result as ArrayBuffer;
                            if (buffer) {
                                const arr = new Uint8Array(buffer);
                                const header = String.fromCharCode(...Array.from(arr.slice(0, 16)));

                                if (header.startsWith('SQLite format 3')) {
                                    setIsSqliteFile(true);
                                    setEncryptionKey(''); // Not needed for SQLite
                                } else if (file.name.endsWith('.enc')) {
                                    // Detect if it's binary (Type 2: Machine-Locked) or Text (Type 1: Legacy/Manual)
                                    const isBinary = Array.from(arr).some(b => (b < 32 && b !== 9 && b !== 10 && b !== 13) || b > 126);
                                    if (isBinary) {
                                        setIsMachineLocked(true);
                                        setEncryptionKey('');
                                    }
                                }
                            }
                        };
                        reader.readAsArrayBuffer(file.slice(0, 100)); // Read first 100 bytes for better binary detection

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
                            disabled={companyProfile?.isReadOnly}
                            className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[11px] font-black transition-all shadow-xl active:scale-95 ${companyProfile?.isReadOnly
                                ? 'bg-red-500/10 text-red-500 border border-red-500/30 cursor-not-allowed'
                                : saved
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
                    <button onClick={() => { setActiveTab(SettingsTab.Company); setSettingsTab?.(SettingsTab.Company); }} title="Switch to Company Profile Tab" aria-label="Switch to Company Profile Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === SettingsTab.Company ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                        <Building2 size={14} /> COMPANY PROFILE
                    </button>
                    <button onClick={() => { setActiveTab(SettingsTab.Statutory); setSettingsTab?.(SettingsTab.Statutory); }} title="Switch to Statutory Rules Tab" aria-label="Switch to Statutory Rules Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === SettingsTab.Statutory ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                        <ShieldCheck size={14} /> STATUTORY RULES
                    </button>
                    <button onClick={() => { setActiveTab(SettingsTab.Data); setSettingsTab?.(SettingsTab.Data); }} title="Switch to Data Management Tab" aria-label="Switch to Data Management Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === SettingsTab.Data ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                        <Database size={14} /> DATA MANAGEMENT
                    </button>
                    {userRole === 'Developer' && (
                        <button onClick={() => { setActiveTab(SettingsTab.Developer); setSettingsTab?.(SettingsTab.Developer); }} title="Switch to Developer Options Tab" aria-label="Switch to Developer Options Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === SettingsTab.Developer ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                            <Megaphone size={14} /> DEVELOPER OPTIONS
                        </button>
                    )}
                    <button onClick={() => { setActiveTab(SettingsTab.License); setSettingsTab?.(SettingsTab.License); }} title="Switch to License Management Tab" aria-label="Switch to License Management Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === SettingsTab.License ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                        <ShieldCheck size={14} /> LICENSE MANAGEMENT
                    </button>
                    {(licenseInfo || !isSetupMode || appUsers.length > 0) && (
                        <button onClick={() => { setActiveTab(SettingsTab.Users); setSettingsTab?.(SettingsTab.Users); }} title="Switch to User Management Tab" aria-label="Switch to User Management Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === SettingsTab.Users ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                            <Users size={14} /> USER MANAGEMENT
                        </button>
                    )}
                </div>
            </div>

            {activeTab === SettingsTab.Statutory && (
                <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="bg-amber-900/20 border border-amber-700/50 p-6 rounded-2xl flex justify-between items-center text-amber-200">
                        <div className="flex gap-4">
                            <AlertCircle size={28} className="shrink-0 text-amber-400" />
                            <div className="text-sm space-y-2">
                                <p className="font-bold text-lg text-amber-400">Compliance & Parameter Configuration</p>
                                <p className="text-slate-300 whitespace-nowrap">These Settings Define How PF, ESI, Leave Policy and Taxes are Calculated Establishment wise</p>
                            </div>
                        </div>
                        {profileData?.establishmentName && (
                            <div className="flex flex-col items-end gap-1">
                                <div className="text-xs font-bold text-amber-500 uppercase tracking-wider bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 whitespace-nowrap">
                                    {profileData.establishmentName}
                                </div>
                                <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-md">
                                    ID: <span className="text-amber-500">{activeCompanyId}</span>
                                </div>
                            </div>
                        )}
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
                                    {formData.pfEsiCalculationBasis === 'LabourCode' ? 'LABOUR CODE (CLAUSE 88)' : 'LEGACY WAGES BASIS'}
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
                                    PF/ESI Wages = Basic + DA + RTA + Excess Allowances (if Allowances &gt; 50% of Gross). Subject to Statutory Ceiling for PF.
                                </p>
                                {formData.pfEsiCalculationBasis === 'LabourCode' && (
                                    <div className="absolute top-0 right-0 p-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                                    </div>
                                )}
                            </button>

                            {/* Card 2: Legacy Wages */}
                            <button
                                onClick={() => setFormData({ ...formData, pfEsiCalculationBasis: 'OriginalWages' })}
                                className={`group relative p-6 rounded-2xl border-2 transition-all text-left overflow-hidden ${formData.pfEsiCalculationBasis === 'OriginalWages' ? 'bg-amber-600/10 border-amber-500 shadow-lg shadow-amber-900/20' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 opacity-60 hover:opacity-100'}`}
                                title="Select Legacy Wages Basis"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2 rounded-lg ${formData.pfEsiCalculationBasis === 'OriginalWages' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-500 grupo-hover:bg-slate-700'}`}>
                                        {formData.pfEsiCalculationBasis === 'OriginalWages' ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-slate-700" />}
                                    </div>
                                    <h4 className="font-bold text-sm tracking-tight">Legacy Wages</h4>
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                                    PF/ESI Wages based on selected components immediately below. Subject to Statutory Ceiling for PF unless (Higher Rule) is opted.
                                </p>
                                {formData.pfEsiCalculationBasis === 'OriginalWages' && (
                                    <div className="absolute top-0 right-0 p-2">
                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* PF & ESI APPLICABILITY - Only shows if LabourCode selected */}
                    {formData.pfEsiCalculationBasis === 'LabourCode' && (
                        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl animate-in slide-in-from-top-4 duration-500">
                            <div className="p-4 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Scale size={16} className="text-blue-400" />
                                    <h3 className="font-black uppercase tracking-tighter text-xs text-slate-300">Code Wages Applicability</h3>
                                </div>
                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Enable or disable statutory deductions globally under Code Wages</span>
                            </div>
                            <div className="p-5 flex flex-col md:flex-row gap-4">
                                <label htmlFor="enable-pf-code" className="flex-1 flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-all cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <input
                                            id="enable-pf-code"
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-700 text-blue-500 bg-slate-900 focus:ring-blue-500 focus:ring-offset-slate-900"
                                            checked={formData.enablePF !== false}
                                            onChange={e => setFormData({ ...formData, enablePF: e.target.checked })}
                                            title="Enable PF under Code Wages"
                                        />
                                        <span className="text-xs font-bold text-slate-300 uppercase">PF Applicable</span>
                                    </div>
                                    <span className="text-[9px] text-slate-500 font-bold uppercase">PF Deduction Enabled</span>
                                </label>
                                <label htmlFor="enable-esi-code" className="flex-1 flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-all cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <input
                                            id="enable-esi-code"
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-700 text-pink-500 bg-slate-900 focus:ring-pink-500 focus:ring-offset-slate-900"
                                            checked={formData.enableESI !== false}
                                            onChange={e => setFormData({ ...formData, enableESI: e.target.checked })}
                                            title="Enable ESI under Code Wages"
                                        />
                                        <span className="text-xs font-bold text-slate-300 uppercase">ESI Applicable</span>
                                    </div>
                                    <span className="text-[9px] text-slate-500 font-bold uppercase">ESI Deduction Enabled</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* PF LEGACY WAGES COMPONENTS - Only shows if OriginalWages selected */}
                    {formData.pfEsiCalculationBasis === 'OriginalWages' && (
                        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl animate-in slide-in-from-top-4 duration-500">
                            <div className="p-4 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Landmark size={16} className="text-blue-400" />
                                    <h3 className="font-black uppercase tracking-tighter text-xs text-slate-300">PF Legacy Wages Components</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label htmlFor="enable-pf" className="flex items-center gap-2 cursor-pointer bg-slate-900/80 p-1.5 px-3 rounded-xl border border-slate-800 shadow-inner">
                                        <input
                                            id="enable-pf"
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-700 text-blue-500 bg-slate-900"
                                            checked={formData.enablePF !== false}
                                            onChange={e => setFormData({ ...formData, enablePF: e.target.checked })}
                                            title="Enable Provident Fund Deduction"
                                            aria-label="Enable Provident Fund Deduction"
                                        />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">PF Applicable</span>
                                    </label>
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Select components to include for PF Base</span>
                                </div>
                            </div>
                            <div className="p-5">
                                {formData.enablePF === false ? (
                                    <p className="text-xs text-slate-500 italic text-center py-4">Provident Fund (PF) is disabled/not applicable.</p>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        {[
                                            { key: 'basic', label: 'Basic Pay' }, { key: 'da', label: 'DA' }, { key: 'retaining', label: 'Retn Allow' },
                                            { key: 'hra', label: 'HRA' }, { key: 'conveyance', label: 'Conveyance' }, { key: 'washing', label: 'Washing' },
                                            { key: 'attire', label: 'Attire' }, 
                                            { key: 'special1', label: profileData?.specialAllowance1Name || 'Special 1' }, 
                                            { key: 'special2', label: profileData?.specialAllowance2Name || 'Special 2' },
                                            { key: 'special3', label: profileData?.specialAllowance3Name || 'Special 3' },
                                        ].map(comp => {
                                            const isMandatoryLocked = comp.key === 'basic' || comp.key === 'da' || comp.key === 'retaining';
                                            const isHraLocked = comp.key === 'hra' || comp.key === 'conveyance' || comp.key === 'washing' || comp.key === 'attire';
                                            const isLocked = isMandatoryLocked || isHraLocked;
                                            const components = formData.pfOriginalWagesComponents || INITIAL_STATUTORY_CONFIG.pfOriginalWagesComponents;
                                            const isActive = isMandatoryLocked ? true : (isHraLocked ? false : components[comp.key as keyof typeof components]);
                                            let btnStyle = 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700';
                                            if (isActive) {
                                                btnStyle = 'bg-blue-600 border-blue-400 text-white shadow-blue-900/20';
                                            } else if (isHraLocked) {
                                                btnStyle = 'bg-red-950/20 border-red-950 text-red-500/50';
                                            }
                                            return (
                                                <button
                                                    key={comp.key}
                                                    disabled={isLocked}
                                                    onClick={() => handlePFOriginalWagesToggle(comp.key as any)}
                                                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm ${btnStyle} ${isLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                                                    title={isMandatoryLocked ? "Mandatory Component" : (isHraLocked ? `${comp.label} Excluded from Standard PF Base (No Selection Allowed)` : `Toggle ${comp.label} for PF Base`)}
                                                >
                                                    {isActive ? <CheckSquare size={14} className={isLocked ? 'shrink-0 text-blue-200' : 'shrink-0'} /> : <Square size={14} className="shrink-0 opacity-20" />}
                                                    <span className="truncate">{comp.label} {isLocked && <span className="opacity-40 ml-1">(Locked)</span>}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ESI LEGACY WAGES COMPONENTS - Only shows if OriginalWages selected */}
                    {formData.pfEsiCalculationBasis === 'OriginalWages' && (
                        <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl animate-in slide-in-from-top-4 duration-500">
                            <div className="p-4 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Heart size={16} className="text-pink-400" />
                                    <h3 className="font-black uppercase tracking-tighter text-xs text-slate-300">ESI Legacy Wages Components</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label htmlFor="enable-esi" className="flex items-center gap-2 cursor-pointer bg-slate-900/80 p-1.5 px-3 rounded-xl border border-slate-800 shadow-inner">
                                        <input
                                            id="enable-esi"
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-700 text-pink-500 bg-slate-900"
                                            checked={formData.enableESI !== false}
                                            onChange={e => setFormData({ ...formData, enableESI: e.target.checked })}
                                            title="Enable ESI Deduction"
                                            aria-label="Enable ESI Deduction"
                                        />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">ESI Applicable</span>
                                    </label>
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Select components to include for ESI Base</span>
                                </div>
                            </div>
                            <div className="p-5">
                                {formData.enableESI === false ? (
                                    <p className="text-xs text-slate-500 italic text-center py-4">ESI is disabled/not applicable.</p>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        {[
                                            { key: 'basic', label: 'Basic Pay' }, { key: 'da', label: 'DA' }, { key: 'retaining', label: 'Retn Allow' },
                                            { key: 'hra', label: 'HRA' }, { key: 'conveyance', label: 'Conveyance' }, { key: 'washing', label: 'Washing' },
                                            { key: 'attire', label: 'Attire' }, 
                                            { key: 'special1', label: profileData?.specialAllowance1Name || 'Special 1' }, 
                                            { key: 'special2', label: profileData?.specialAllowance2Name || 'Special 2' },
                                            { key: 'special3', label: profileData?.specialAllowance3Name || 'Special 3' },
                                        ].map(comp => {
                                            const isMandatoryLocked = comp.key === 'basic' || comp.key === 'da' || comp.key === 'retaining' || comp.key === 'hra';
                                            const isInactiveLocked = comp.key === 'conveyance' || comp.key === 'washing' || comp.key === 'attire';
                                            const isLocked = isMandatoryLocked || isInactiveLocked;
                                            const components = formData.esiOriginalWagesComponents || INITIAL_STATUTORY_CONFIG.esiOriginalWagesComponents;
                                            const isActive = isMandatoryLocked ? true : (isInactiveLocked ? false : components[comp.key as keyof typeof components]);
                                            let btnStyle = 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-pink-900/20 hover:border-pink-500/30';
                                            if (isActive) {
                                                btnStyle = 'bg-pink-600 border-pink-400 text-white shadow-pink-900/20';
                                            } else if (isInactiveLocked) {
                                                btnStyle = 'bg-red-950/20 border-red-950 text-red-500/50';
                                            }
                                            return (
                                                <button
                                                    key={comp.key}
                                                    disabled={isLocked}
                                                    onClick={() => handleESIOriginalWagesToggle(comp.key as any)}
                                                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm ${btnStyle} ${isLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                                                    title={isMandatoryLocked ? "Mandatory Component" : (isInactiveLocked ? `${comp.label} Excluded from Standard ESI Base (No Selection Allowed)` : `Toggle ${comp.label} for ESI Base`)}
                                                >
                                                    {isActive ? <CheckSquare size={14} className={isLocked ? 'shrink-0 text-pink-200' : 'shrink-0'} /> : <Square size={14} className="shrink-0 opacity-40" />}
                                                    <span className="truncate">{comp.label} {isLocked && <span className="opacity-40 ml-1">(Locked)</span>}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* DYNAMIC PAY SHEET COLUMNS CONFIGURATION */}
                    <div id="dynamic_paysheet_section" className="scroll-mt-20 bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl animate-in slide-in-from-top-4 duration-500">
                        <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-indigo-900/30 text-indigo-400 rounded-xl border border-indigo-500/20 shadow-inner">
                                    <Table size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-black uppercase tracking-tighter text-lg text-white">Dynamic Pay Sheet Setting</h3>
                                        <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/30 rounded text-[9px] font-black text-indigo-400 uppercase tracking-widest">UI Display</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Select the columns to display in the Pay Process sheet.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 bg-slate-900/80 p-1.5 px-3 rounded-2xl border border-slate-800 shadow-inner">
                                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${formData.enableDynamicPaySheet ? 'text-indigo-400' : 'text-slate-500'}`}>
                                    {formData.enableDynamicPaySheet ? 'ENABLED' : 'DISABLED'}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.enableDynamicPaySheet || false}
                                        onChange={(e) => setFormData({ ...formData, enableDynamicPaySheet: e.target.checked })}
                                        title="Toggle Dynamic Pay Sheet"
                                    />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 shadow-lg"></div>
                                </label>
                            </div>
                        </div>

                        {formData.enableDynamicPaySheet && (
                            <div className="p-6">
                                <p className="text-xs text-slate-400 mb-4">* Select the columns to include. <b>EMPID</b>, <b>Employee Name</b>, <b>Total Earnings</b>, <b>Total Deductions</b>, and <b>Net Pay</b> are mandatory and cannot be unselected.</p>
                                <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800 space-y-5">
                                    {/* Mandatory Section */}
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                                            Mandatory Columns
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {[
                                                { key: 'empid', label: 'EMPID' },
                                                { key: 'name', label: 'Employee Name' },
                                                { key: 'totalEarnings', label: 'Total Earnings' },
                                                { key: 'totalDeductions', label: 'Total Deductions' },
                                                { key: 'netPay', label: 'Net Pay' }
                                            ].map(comp => (
                                                <div 
                                                    key={comp.key} 
                                                    title={`${comp.label} is mandatory`}
                                                    className="flex items-center gap-2 p-2 rounded-lg border bg-slate-800/80 border-slate-700/80 text-slate-200 text-[10px] font-bold cursor-not-allowed"
                                                >
                                                    <CheckSquare size={14} className="text-slate-400 opacity-80" />
                                                    <span className="truncate">{comp.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Optional Section */}
                                    <div className="pt-5 border-t border-slate-800">
                                        <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
                                            Optional Columns
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                            {[
                                                { key: 'days', label: 'Days' },
                                                { key: 'basic', label: 'Basic Pay' },
                                                { key: 'da', label: 'DA' },
                                                { key: 'retaining', label: 'Retn Allow' },
                                                { key: 'hra', label: 'HRA' },
                                                { key: 'conveyance', label: 'Conveyance' },
                                                { key: 'washing', label: 'Washing' },
                                                { key: 'attire', label: 'Attire' },
                                                { key: 'special1', label: profileData.specialAllowance1Name || 'Special 1' },
                                                { key: 'special2', label: profileData.specialAllowance2Name || 'Special 2' },
                                                { key: 'special3', label: profileData.specialAllowance3Name || 'Special 3' },
                                                { key: 'leaveEncashment', label: 'Leave Encash' },
                                                { key: 'otAmount', label: 'OT Amount' },
                                                { key: 'epf', label: 'EPF' },
                                                { key: 'vpf', label: 'VPF' },
                                                { key: 'esi', label: 'ESI' },
                                                { key: 'pt', label: 'PT' },
                                                { key: 'it', label: 'IT' },
                                                { key: 'lwf', label: 'LWF' },
                                                { key: 'advanceRecovery', label: 'Adv Recovery' },
                                                { key: 'fine', label: 'Fine' }
                                            ].map(comp => {
                                                const columns = formData.dynamicPaySheetColumns || [];
                                                const isActive = columns.includes(comp.key);

                                                return (
                                                    <button
                                                        key={comp.key}
                                                        onClick={() => {
                                                            const newColumns = isActive
                                                                ? columns.filter(c => c !== comp.key)
                                                                : [...columns, comp.key];
                                                            setFormData({ ...formData, dynamicPaySheetColumns: newColumns });
                                                        }}
                                                        title={`Toggle ${comp.label}`}
                                                        className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold transition-all ${isActive ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'}`}
                                                    >
                                                        {isActive ? <CheckSquare size={14} /> : <Square size={14} />}
                                                        <span className="truncate">{comp.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    
                                    <div className="pt-5 mt-5 border-t border-slate-800">
                                        <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
                                            Custom Allowance Labels
                                        </h4>
                                        <p className="text-[10px] text-amber-400/90 font-medium mb-4 ml-3.5">User defined name for Special Allowance</p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Special Allowance 1 Label</label>
                                                <input type="text" maxLength={20} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="e.g. Tele. Reimburse" value={profileData.specialAllowance1Name || ''} onChange={e => setProfileData({ ...profileData, specialAllowance1Name: e.target.value })} title="Custom Label for Special Allowance 1 (Max 20 chars)" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Special Allowance 2 Label</label>
                                                <input type="text" maxLength={20} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="e.g. Books & Periodicals" value={profileData.specialAllowance2Name || ''} onChange={e => setProfileData({ ...profileData, specialAllowance2Name: e.target.value })} title="Custom Label for Special Allowance 2 (Max 20 chars)" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Special Allowance 3 Label</label>
                                                <input type="text" maxLength={20} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="e.g. Other Allowance" value={profileData.specialAllowance3Name || ''} onChange={e => setProfileData({ ...profileData, specialAllowance3Name: e.target.value })} title="Custom Label for Special Allowance 3 (Max 20 chars)" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Relocated PF/ESI Wages Components to the top of settings page */}
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
                                                <input id="epf-ceiling" type="number" onFocus={(e) => e.target.select()} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.epfCeiling} onChange={e => setFormData({ ...formData, epfCeiling: +e.target.value })} title="Statutory Ceiling Amount" />
                                            </div>
                                            <div className="space-y-1">
                                                <label htmlFor="epf-employee-rate" className="text-[10px] font-bold text-slate-500 uppercase">Employee Rate (%)</label>
                                                <input id="epf-employee-rate" type="number" onFocus={(e) => e.target.select()} step="0.01" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.epfEmployeeRate * 100} onChange={e => setFormData({ ...formData, epfEmployeeRate: +e.target.value / 100 })} title="Employee PF Contribution Rate" />
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
                                            <p className="text-[9px] text-amber-300 italic leading-relaxed">* PF Wages will be taken from Higher Contribution based on Legacy Wage Ceiling or Code Wages.</p>
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
                                                { key: 'hra', label: 'HRA' }, { key: 'conveyance', label: 'Conveyance' }, { key: 'washing', label: 'Washing' }, { key: 'attire', label: 'Attire' },
                                                { key: 'special1', label: profileData?.specialAllowance1Name || 'Special 1' }, 
                                                { key: 'special2', label: profileData?.specialAllowance2Name || 'Special 2' }, 
                                                { key: 'special3', label: profileData?.specialAllowance3Name || 'Special 3' },
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
                                    <div className="space-y-1"><label htmlFor="esi-ceiling" className="text-[10px] font-bold text-slate-500 uppercase">ESI Ceiling (₹)</label><input id="esi-ceiling" type="number" onFocus={(e) => e.target.select()} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.esiCeiling} onChange={e => setFormData({ ...formData, esiCeiling: +e.target.value })} title="ESI Eligibility Ceiling" aria-label="ESI Eligibility Ceiling" /></div>
                                    <div className="space-y-1"><label htmlFor="esi-employee-rate" className="text-[10px] font-bold text-slate-500 uppercase">EE Rate (%)</label><input id="esi-employee-rate" type="number" onFocus={(e) => e.target.select()} step="0.001" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.esiEmployeeRate * 100} onChange={e => setFormData({ ...formData, esiEmployeeRate: +e.target.value / 100 })} title="Employee ESI Rate" aria-label="Employee ESI Rate" /></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* ... Other sections (Bonus, Leave, PT, LWF) ... */}

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
                                        <div className="space-y-1"><label htmlFor="el-max" className="text-[10px] font-bold text-slate-500 uppercase">Max/Year</label><input id="el-max" type="number" onFocus={(e) => e.target.select()} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.el.maxPerYear} onChange={e => handleLeavePolicyChange('el', 'maxPerYear', +e.target.value)} title="Maximum EL per Year" aria-label="Maximum EL per Year" /></div>
                                        <div className="space-y-1"><label htmlFor="el-carry" className="text-[10px] font-bold text-slate-500 uppercase">Carry Fwd</label><input id="el-carry" type="number" onFocus={(e) => e.target.select()} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.el.maxCarryForward} onChange={e => handleLeavePolicyChange('el', 'maxCarryForward', +e.target.value)} title="Maximum EL Carry Forward" aria-label="Maximum EL Carry Forward" /></div>
                                    </div>
                                </div>
                            </div>
                            {/* SL */}
                            <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                                <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-2"><span className="text-xs font-bold text-slate-300 uppercase">Sick Leave (SL)</span></div>
                                <div className="space-y-2">
                                    <div className="space-y-1"><label htmlFor="sl-label" className="text-[10px] font-bold text-slate-500 uppercase">Label</label><input id="sl-label" type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" value={localLeavePolicy.sl.label} onChange={e => handleLeavePolicyChange('sl', 'label', e.target.value)} title="Sick Leave Label" aria-label="Sick Leave Label" /></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1"><label htmlFor="sl-max" className="text-[10px] font-bold text-slate-500 uppercase">Max/Year</label><input id="sl-max" type="number" onFocus={(e) => e.target.select()} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.sl.maxPerYear} onChange={e => handleLeavePolicyChange('sl', 'maxPerYear', +e.target.value)} title="Maximum SL per Year" aria-label="Maximum SL per Year" /></div>
                                        <div className="space-y-1"><label htmlFor="sl-carry" className="text-[10px] font-bold text-slate-500 uppercase">Carry Fwd</label><input id="sl-carry" type="number" onFocus={(e) => e.target.select()} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.sl.maxCarryForward} onChange={e => handleLeavePolicyChange('sl', 'maxCarryForward', +e.target.value)} title="Maximum SL Carry Forward" aria-label="Maximum SL Carry Forward" /></div>
                                    </div>
                                </div>
                            </div>
                            {/* CL */}
                            <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                                <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-2"><span className="text-xs font-bold text-slate-300 uppercase">Casual Leave (CL)</span></div>
                                <div className="space-y-2">
                                    <div className="space-y-1"><label htmlFor="cl-label" className="text-[10px] font-bold text-slate-500 uppercase">Label</label><input id="cl-label" type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" value={localLeavePolicy.cl.label} onChange={e => handleLeavePolicyChange('cl', 'label', e.target.value)} title="Casual Leave Label" aria-label="Casual Leave Label" /></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1"><label htmlFor="cl-max" className="text-[10px] font-bold text-slate-500 uppercase">Max/Year</label><input id="cl-max" type="number" onFocus={(e) => e.target.select()} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.cl.maxPerYear} onChange={e => handleLeavePolicyChange('cl', 'maxPerYear', +e.target.value)} title="Maximum CL per Year" aria-label="Maximum CL per Year" /></div>
                                        <div className="space-y-1"><label htmlFor="cl-carry" className="text-[10px] font-bold text-slate-500 uppercase">Carry Fwd</label><input id="cl-carry" type="number" onFocus={(e) => e.target.select()} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono" value={localLeavePolicy.cl.maxCarryForward} onChange={e => handleLeavePolicyChange('cl', 'maxCarryForward', +e.target.value)} title="Maximum CL Carry Forward" aria-label="Maximum CL Carry Forward" /></div>
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
                                {[{ key: 'basic', label: 'Basic Pay' }, { key: 'da', label: 'DA' }, { key: 'retaining', label: 'Retn Allow' }, { key: 'hra', label: 'HRA' }, { key: 'conveyance', label: 'Conveyance' }, { key: 'washing', label: 'Washing' }, { key: 'attire', label: 'Attire' }, { key: 'special1', label: profileData?.specialAllowance1Name || 'Special 1' }, { key: 'special2', label: profileData?.specialAllowance2Name || 'Special 2' }, { key: 'special3', label: profileData?.specialAllowance3Name || 'Special 3' }].map(comp => {
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
                                            { key: 'attire', label: 'Attire' }, 
                                            { key: 'special1', label: profileData?.specialAllowance1Name || 'Special 1' }, 
                                            { key: 'special2', label: profileData?.specialAllowance2Name || 'Special 2' },
                                            { key: 'special3', label: profileData?.specialAllowance3Name || 'Special 3' }
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

                    {/* Employee Welfare (Bonus & Gratuity) */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-xl animate-in slide-in-from-top-4 duration-500">
                        <div className="p-6 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Heart className="text-rose-400" size={20} />
                                <h3 className="font-black uppercase tracking-widest text-xs text-rose-400">Employee Welfare (Bonus & Gratuity)</h3>
                            </div>
                        </div>
                        <div className="p-6 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Bonus Section */}
                                <div className="space-y-4 p-4 bg-slate-900/40 rounded-xl border border-slate-800/50">
                                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                        <div className="flex items-center gap-2">
                                            <Calculator className="text-amber-400" size={16} />
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Annual Bonus Policy</span>
                                        </div>
                                        <label htmlFor="enable-bonus" className="flex items-center gap-1.5 cursor-pointer bg-slate-950/50 p-1 px-2.5 rounded border border-slate-800/80 shadow-inner">
                                            <input
                                                id="enable-bonus"
                                                type="checkbox"
                                                className="w-3.5 h-3.5 rounded border-slate-700 text-amber-500 bg-slate-900 accent-amber-500"
                                                checked={formData.enableBonus !== false}
                                                onChange={e => setFormData({ ...formData, enableBonus: e.target.checked })}
                                                title="Enable Annual Bonus Calculation"
                                                aria-label="Enable Annual Bonus Calculation"
                                            />
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Applicable</span>
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] text-slate-500 font-bold uppercase">Rate (%)</span>
                                            <input
                                                type="number" onFocus={(e) => e.target.select()}
                                                disabled={formData.enableBonus === false}
                                                className="w-16 bg-slate-800 border border-slate-700 rounded p-1 text-xs text-amber-400 font-mono text-center disabled:opacity-50"
                                                value={formData.bonusRate * 100}
                                                onChange={e => setFormData({ ...formData, bonusRate: (+e.target.value / 100) })}
                                                step="0.01"
                                                title="Bonus Percentage Rate"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {formData.enableBonus === false ? (
                                            <p className="text-xs text-slate-500 italic text-center py-4">Annual Bonus is disabled/not applicable.</p>
                                        ) : formData.pfEsiCalculationBasis === 'OriginalWages' ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[10px] text-slate-500 font-medium italic">"Select Bonus Wages Components. Basic & DA locked."</p>
                                                    <span className="text-[8px] text-slate-600 uppercase font-black">Override Mode</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {[
                                                        { key: 'basic', label: 'Basic' }, { key: 'da', label: 'DA' }, { key: 'retaining', label: 'Retn Allow' },
                                                        { key: 'hra', label: 'HRA' }, { key: 'conveyance', label: 'Conveyance' }, { key: 'washing', label: 'Washing' },
                                                        { key: 'attire', label: 'Attire' }, { key: 'special1', label: profileData?.specialAllowance1Name || 'Special 1' }, { key: 'special2', label: profileData?.specialAllowance2Name || 'Special 2' },
                                                        { key: 'special3', label: profileData?.specialAllowance3Name || 'Special 3' }
                                                    ].map(comp => {
                                                        const isLocked = comp.key === 'basic' || comp.key === 'da';
                                                        const components = formData.bonusWagesComponents || INITIAL_STATUTORY_CONFIG.bonusWagesComponents;
                                                        const isActive = isLocked ? true : components[comp.key as keyof typeof components];
                                                        return (
                                                            <button
                                                                key={comp.key}
                                                                disabled={isLocked}
                                                                onClick={() => setFormData(p => ({ ...p, bonusWagesComponents: { ...p.bonusWagesComponents, [comp.key]: !isActive } }))}
                                                                className={`flex items-center gap-2 p-1.5 rounded-lg border text-[10px] font-bold transition-all ${isActive ? 'bg-amber-600/20 border-amber-500 text-amber-100' : 'bg-slate-900/50 border-slate-800 text-slate-500 opacity-60'} ${isLocked ? 'cursor-not-allowed grayscale-[0.8]' : 'hover:border-amber-400'}`}
                                                            >
                                                                {isActive ? <CheckSquare size={10} className={isLocked ? 'text-slate-500' : 'text-amber-400'} /> : <Square size={10} />}
                                                                <span className="truncate">{comp.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/50">
                                                <p className="text-[10px] text-slate-400 italic leading-relaxed">
                                                    {formData.pfEsiCalculationBasis === 'LabourCode' ? (
                                                        <>Bonus uses <span className="text-blue-300 font-bold underline decoration-blue-500/50">Code Wages (Clause 88)</span> as basis.</>
                                                    ) : (
                                                        <>Bonus uses the <span className="text-blue-300 font-bold underline decoration-blue-500/50">Standard Definition (Basic + DA)</span> as per Payment of Bonus Act.</>
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Gratuity Section */}
                                <div className="space-y-4 p-4 bg-slate-900/40 rounded-xl border border-slate-800/50">
                                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                        <div className="flex items-center gap-2">
                                            <Landmark className="text-blue-400" size={16} />
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">LIC Gratuity Policy</span>
                                        </div>
                                        <label htmlFor="enable-gratuity" className="flex items-center gap-1.5 cursor-pointer bg-slate-950/50 p-1 px-2.5 rounded border border-slate-800/80 shadow-inner">
                                            <input
                                                id="enable-gratuity"
                                                type="checkbox"
                                                className="w-3.5 h-3.5 rounded border-slate-700 text-blue-500 bg-slate-900 accent-blue-500"
                                                checked={formData.enableGratuity !== false}
                                                onChange={e => setFormData({ ...formData, enableGratuity: e.target.checked })}
                                                title="Enable Gratuity Calculation"
                                                aria-label="Enable Gratuity Calculation"
                                            />
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Applicable</span>
                                        </label>
                                        <span className="text-[9px] text-blue-400 font-black border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 rounded">ACT 1972</span>
                                    </div>
                                    <div className="space-y-4">
                                        {formData.enableGratuity === false ? (
                                            <p className="text-xs text-slate-500 italic text-center py-4">Gratuity is disabled/not applicable.</p>
                                        ) : (
                                            <>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Calculation Basis (Formula)</label>
                                                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-[11px] text-blue-300 font-mono shadow-inner border-l-4 border-l-blue-500">
                                                        (Selected Wages * (15/26) * Completed Years of Service)
                                                    </div>
                                                </div>
                                                {formData.pfEsiCalculationBasis === 'OriginalWages' ? (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-[10px] text-slate-500 font-medium italic">"Select Gratuity Wages Components. Basic & DA locked."</p>
                                                            <span className="text-[8px] text-indigo-400 uppercase font-black">Override Mode</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {[
                                                                { key: 'basic', label: 'Basic' }, { key: 'da', label: 'DA' }, { key: 'retaining', label: 'Retn Allow' },
                                                                { key: 'hra', label: 'HRA' }, { key: 'conveyance', label: 'Conveyance' }, { key: 'washing', label: 'Washing' },
                                                                { key: 'attire', label: 'Attire' }, { key: 'special1', label: profileData?.specialAllowance1Name || 'Special 1' }, { key: 'special2', label: profileData?.specialAllowance2Name || 'Special 2' },
                                                                { key: 'special3', label: profileData?.specialAllowance3Name || 'Special 3' }
                                                            ].map(comp => {
                                                                const isLocked = comp.key === 'basic' || comp.key === 'da';
                                                                const components = formData.gratuityWagesComponents || INITIAL_STATUTORY_CONFIG.gratuityWagesComponents;
                                                                const isActive = isLocked ? true : components[comp.key as keyof typeof components];
                                                                return (
                                                                    <button
                                                                        key={comp.key}
                                                                        disabled={isLocked}
                                                                        onClick={() => setFormData(p => ({ ...p, gratuityWagesComponents: { ...p.gratuityWagesComponents, [comp.key]: !isActive } }))}
                                                                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-[10px] font-bold transition-all ${isActive ? 'bg-indigo-600/20 border-indigo-500 text-indigo-100' : 'bg-slate-900/50 border-slate-800 text-slate-500 opacity-60'} ${isLocked ? 'cursor-not-allowed grayscale-[0.8]' : 'hover:border-indigo-400'}`}
                                                                    >
                                                                        {isActive ? <CheckSquare size={10} className={isLocked ? 'text-slate-500' : 'text-indigo-400'} /> : <Square size={10} />}
                                                                        <span className="truncate">{comp.label}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/50">
                                                        <p className="text-[10px] text-slate-400 italic leading-relaxed">
                                                            {formData.pfEsiCalculationBasis === 'LabourCode' ? (
                                                                <>Gratuity uses <span className="text-blue-300 font-bold underline decoration-blue-500/50">Code Wages (Clause 88)</span> as basis.</>
                                                            ) : (
                                                                <>Gratuity uses the <span className="text-blue-300 font-bold underline decoration-blue-500/50">Standard Definition (Basic + DA)</span> as per Payment of Gratuity Act.</>
                                                            )}
                                                        </p>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-3 bg-amber-900/10 border border-amber-900/30 rounded-xl">
                                <AlertTriangle className="text-amber-500" size={14} />
                                <p className="text-[9px] text-slate-400 font-medium">Calculation Rule: Total Eligible Wages from months in range * (Applicable Policy Rates). Bonus usually 8.33% Min. Gratuity calculated as per tenure.</p>
                            </div>
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
                                        <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-800">
                                            <tr>
                                                <th className="pb-3">Min Earnings (₹)</th>
                                                <th className="pb-3">Max Earnings (₹)</th>
                                                <th className="pb-3">Deduction (₹)</th>
                                                {formData.ptDeductionCycle === 'HalfYearly' && <th className="pb-3">Monthly EMI (₹)</th>}
                                                <th className="pb-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {formData.ptSlabs.map((slab, i) => (
                                                <tr key={i} className="group">
                                                    <td className="py-3"><input type="number" onFocus={(e) => e.target.select()} className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white w-24 font-mono" value={slab.min} onChange={e => handleSlabChange(i, 'min', +e.target.value)} title="Minimum Earnings for Slab" aria-label="Minimum Earnings for Slab" /></td>
                                                    <td className="py-3"><input type="number" onFocus={(e) => e.target.select()} className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white w-24 font-mono" value={slab.max} onChange={e => handleSlabChange(i, 'max', +e.target.value)} title="Maximum Earnings for Slab" aria-label="Maximum Earnings for Slab" /></td>
                                                    <td className="py-3"><input type="number" onFocus={(e) => e.target.select()} className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white w-24 font-mono font-bold text-amber-400" value={slab.amount} onChange={e => handleSlabChange(i, 'amount', +e.target.value)} title="PT Amount for Slab" aria-label="PT Amount for Slab" /></td>
                                                    {formData.ptDeductionCycle === 'HalfYearly' && (
                                                        <td className="py-3">
                                                            <input 
                                                                type="number" 
                                                                readOnly 
                                                                className="bg-slate-800/50 border border-slate-800 rounded px-2 py-1 text-xs text-slate-400 w-24 font-mono font-bold" 
                                                                value={Math.round(slab.amount / 6)} 
                                                                title="Monthly EMI (Calculated as Deduction / 6)" 
                                                                aria-label="Monthly EMI" 
                                                            />
                                                        </td>
                                                    )}
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
                                <div className="space-y-1"><label htmlFor="lwf-ee-contrib" className="text-[10px] font-bold text-slate-500 uppercase">EE Contribution (₹)</label><input id="lwf-ee-contrib" type="number" onFocus={(e) => e.target.select()} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.lwfEmployeeContribution} onChange={e => setFormData({ ...formData, lwfEmployeeContribution: +e.target.value })} title="Employee LWF Contribution" aria-label="Employee LWF Contribution" /></div>
                                <div className="space-y-1"><label htmlFor="lwf-er-contrib" className="text-[10px] font-bold text-slate-500 uppercase">ER Contribution (₹)</label><input id="lwf-er-contrib" type="number" onFocus={(e) => e.target.select()} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white font-mono" value={formData.lwfEmployerContribution} onChange={e => setFormData({ ...formData, lwfEmployerContribution: +e.target.value })} title="Employer LWF Contribution" aria-label="Employer LWF Contribution" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Total (₹)</label><div className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-emerald-400 font-mono font-bold">{formatIndianNumber(formData.lwfEmployeeContribution + formData.lwfEmployerContribution)}</div></div>
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

            {activeTab === SettingsTab.Company && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* ... Company Branding & Profile ... */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 shadow-xl overflow-hidden p-8">
                        <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-3">
                                <ImageIcon className="text-amber-400" size={24} />
                                <h3 className="font-bold text-sky-400 uppercase tracking-widest text-sm">Establishment Branding</h3>
                            </div>
                            {profileData.establishmentName && (
                                <div className="flex flex-col items-end gap-1">
                                    <div className="text-xs font-bold text-amber-500 uppercase tracking-wider bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 whitespace-nowrap">
                                        {profileData.establishmentName}
                                    </div>
                                    <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-md">
                                        ID: <span className="text-amber-500">{activeCompanyId}</span>
                                    </div>
                                </div>
                            )}
                        </div>
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
                        <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-900/30 text-indigo-400 rounded-lg border border-indigo-500/20">
                                    <Building2 size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sky-400 uppercase tracking-widest text-sm">Establishment Profile</h3>
                                    <p className="text-xs text-slate-400">Official details for legal forms and reports.</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-lg uppercase tracking-wider">
                                    * marked fields are to be filled mandatorily
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 gap-y-8">
                            {/* ... Legal ID ... */}
                            <div className="md:col-span-3">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1">Legal Identity & Identification</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="profile-est-name" className="text-[10px] font-bold text-slate-400 uppercase">Establishment Name<span className="text-red-500 text-sm ml-0.5">*</span></label>
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-md">
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">ID:</span>
                                                <span className="text-[9px] font-mono font-bold text-amber-500">{activeCompanyId}</span>
                                            </div>
                                        </div>
                                        <input id="profile-est-name" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500 uppercase" placeholder="Your Name - as mentioned in App request mail" value={profileData.establishmentName} onChange={e => setProfileData({ ...profileData, establishmentName: e.target.value.toUpperCase() })} title="Establishment Name" aria-label="Establishment Name" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="profile-data-size" className="text-[10px] font-bold text-emerald-400 uppercase">Allocated Data Size<span className="text-red-500 text-sm ml-0.5">*</span></label>
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-md">
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Utilized:</span>
                                                <span className="text-[9px] font-mono font-bold text-white">{enrolledEmployeeCount}</span>
                                            </div>
                                        </div>
                                        <input id="profile-data-size" type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-emerald-400 font-bold outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600" placeholder={`Licensed Data Size: ${licenseInfo?.dataSize || 5000} | Balance: ${availableQuota}`} value={profileData.allocatedDataSize ?? ''} onChange={e => setProfileData({ ...profileData, allocatedDataSize: e.target.value ? Number(e.target.value) : undefined })} title="Allocated Data Size (Employee Quota)" aria-label="Allocated Data Size" />
                                        <p className="text-[9px] text-slate-500 mt-1">This company cannot enroll more employees than this allocated quota.</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label htmlFor="profile-db-pass" className="text-[10px] font-bold text-sky-400 uppercase">Database Access Password (Optional)</label>
                                        <div className="relative">
                                            <input
                                                id="profile-db-pass"
                                                type={showPin ? "text" : "password"}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500 font-bold placeholder:text-slate-700"
                                                placeholder="Leave blank for open access"
                                                value={profileData.dashboardPassword || ''}
                                                onChange={e => setProfileData({ ...profileData, dashboardPassword: e.target.value })}
                                                title="Optional password required to open this company from dashboard"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPin(!showPin)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-400 transition-colors"
                                            >
                                                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1"><label htmlFor="profile-trade-name" className="text-[10px] font-bold text-slate-400 uppercase">Trade Name (If Any)</label><input id="profile-trade-name" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Trade Name" value={profileData.tradeName} onChange={e => setProfileData({ ...profileData, tradeName: e.target.value })} title="Trade Name" aria-label="Trade Name" /></div>

                                    <div className="space-y-1"><label htmlFor="profile-cin" className="text-[10px] font-bold text-sky-400 uppercase">CIN No (Corporate ID)<span className="text-red-500 text-sm ml-0.5">*</span></label><input id="profile-cin" type="text" className="w-full bg-slate-900 border border-sky-900/50 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-500" value={profileData.cin} onChange={e => setProfileData({ ...profileData, cin: e.target.value })} placeholder="U00000XX0000XXX000000" title="Corporate Identification Number" aria-label="Corporate Identification Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-pan-no" className="text-[10px] font-bold text-sky-400 uppercase">PAN Number of Establishment<span className="text-red-500 text-sm ml-0.5">*</span></label><input id="profile-pan-no" type="text" className="w-full bg-slate-900 border border-sky-900/50 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-500" placeholder="PAN Number" value={profileData.pan} onChange={e => {
                                        let formatted = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                                        let result = "";
                                        for (let i = 0; i < formatted.length; i++) {
                                            if (i < 5) {
                                                if (/[A-Z]/.test(formatted[i])) result += formatted[i];
                                            } else if (i < 9) {
                                                if (/[0-9]/.test(formatted[i])) result += formatted[i];
                                            } else if (i === 9) {
                                                if (/[A-Z]/.test(formatted[i])) result += formatted[i];
                                            }
                                        }
                                        setProfileData({ ...profileData, pan: result });
                                    }} title="PAN Number" aria-label="PAN Number" /></div>
                                </div>
                            </div>
                            {/* ... Registration Codes ... */}
                            <div className="md:col-span-3">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1 mt-2">Registration Codes</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div className="space-y-1"><label htmlFor="profile-pf-code" className="text-[10px] font-bold text-slate-400 uppercase">PF Code<span className="text-red-500 text-sm ml-0.5">*</span></label><input id="profile-pf-code" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="PF Code" value={profileData.pfCode} onChange={e => setProfileData({ ...profileData, pfCode: e.target.value })} title="PF Code Number" aria-label="PF Code Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-esi-code" className="text-[10px] font-bold text-slate-400 uppercase">ESI Code<span className="text-red-500 text-sm ml-0.5">*</span></label><input id="profile-esi-code" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="ESI Code" value={profileData.esiCode} onChange={e => setProfileData({ ...profileData, esiCode: e.target.value })} title="ESI Code Number" aria-label="ESI Code Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-gst-no" className="text-[10px] font-bold text-slate-400 uppercase">GST No</label><input id="profile-gst-no" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="GST Number" value={profileData.gstNo} onChange={e => setProfileData({ ...profileData, gstNo: e.target.value })} title="GST Number" aria-label="GST Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-lin" className="text-[10px] font-bold text-slate-400 uppercase">LIN No (Labour ID)</label><input id="profile-lin" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" value={profileData.lin} onChange={e => setProfileData({ ...profileData, lin: e.target.value })} placeholder="L0000000000" title="Labour Identification Number" aria-label="Labour Identification Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-pt-no" className="text-[10px] font-bold text-slate-400 uppercase">PT Registration No</label><input id="profile-pt-no" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="PT Registration" value={profileData.ptNo || ''} onChange={e => setProfileData({ ...profileData, ptNo: e.target.value })} title="PT Registration Number" aria-label="PT Registration Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-tan-no" className="text-[10px] font-bold text-slate-400 uppercase">TDS No. (TAN)</label><input id="profile-tan-no" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="TAN Number" value={profileData.tan || ''} onChange={e => setProfileData({ ...profileData, tan: e.target.value })} title="TAN Number" aria-label="TAN Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-lwf-no" className="text-[10px] font-bold text-slate-400 uppercase">LWF Registration No</label><input id="profile-lwf-no" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="LWF Registration" value={profileData.lwfRegNo || ''} onChange={e => setProfileData({ ...profileData, lwfRegNo: e.target.value })} title="LWF Registration Number" aria-label="LWF Registration Number" /></div>
                                </div>
                            </div>
                            {/* ... Address ... */}
                            <div className="md:col-span-3">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-1 mt-2">Address Details (Registered Office)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1"><label htmlFor="profile-door-no" className="text-[10px] font-bold text-slate-400 uppercase">Door No / Flat No<span className="text-red-500 text-sm ml-0.5">*</span></label><input id="profile-door-no" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Door No" value={profileData.doorNo} onChange={e => setProfileData({ ...profileData, doorNo: e.target.value })} title="Door/Flat Number" aria-label="Door/Flat Number" /></div>
                                    <div className="space-y-1 md:col-span-2"><label htmlFor="profile-building" className="text-[10px] font-bold text-slate-400 uppercase">Building Name / Landmark</label><input id="profile-building" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Building Name" value={profileData.buildingName} onChange={e => setProfileData({ ...profileData, buildingName: e.target.value })} title="Building Name or Landmark" aria-label="Building Name or Landmark" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-street" className="text-[10px] font-bold text-slate-400 uppercase">Street<span className="text-red-500 text-sm ml-0.5">*</span></label><input id="profile-street" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Street" value={profileData.street} onChange={e => setProfileData({ ...profileData, street: e.target.value })} title="Street Name" aria-label="Street Name" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-locality" className="text-[10px] font-bold text-slate-400 uppercase">Locality</label><input id="profile-locality" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Locality" value={profileData.locality} onChange={e => setProfileData({ ...profileData, locality: e.target.value })} title="Locality" aria-label="Locality" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-area" className="text-[10px] font-bold text-slate-400 uppercase">Area</label><input id="profile-area" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="Area" value={profileData.area} onChange={e => setProfileData({ ...profileData, area: e.target.value })} title="Area Name" aria-label="Area Name" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-city" className="text-[10px] font-bold text-slate-400 uppercase">City / Town<span className="text-red-500 text-sm ml-0.5">*</span></label><input id="profile-city" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="City" value={profileData.city} onChange={e => setProfileData({ ...profileData, city: e.target.value })} title="City or Town" aria-label="City or Town" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-state" className="text-[10px] font-bold text-slate-400 uppercase">State / Union Territory<span className="text-red-500 text-sm ml-0.5">*</span></label><select id="profile-state" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500" value={profileData.state} onChange={e => setProfileData({ ...profileData, state: e.target.value })} title="Select State" aria-label="Select State">{INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                    <div className="space-y-1"><label htmlFor="profile-pincode" className="text-[10px] font-bold text-slate-400 uppercase">Pin Code<span className="text-red-500 text-sm ml-0.5">*</span></label><input id="profile-pincode" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500" placeholder="600001" value={profileData.pincode} onChange={e => setProfileData({ ...profileData, pincode: e.target.value })} title="Pincode" aria-label="Pincode" /></div>
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
                                    <div className="space-y-1 flex flex-col justify-end"><label htmlFor="smtp-port" className="text-[10px] font-bold text-slate-400 uppercase">PORT</label><input id="smtp-port" type="number" onFocus={(e) => e.target.select()} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-emerald-500 font-mono placeholder:text-slate-500" placeholder="465" value={profileData.smtpPort || ''} onChange={e => { const port = parseInt(e.target.value); let sec = profileData.smtpSecurity || 'None'; if (port === 465) sec = 'SSL'; else if (port === 587) sec = 'TLS'; setProfileData({ ...profileData, smtpPort: port || undefined, smtpSecurity: sec as any }); }} /></div>
                                    <div className="space-y-1 flex flex-col justify-end"><label htmlFor="smtp-security" className="text-[10px] font-bold text-slate-400 uppercase">SECURITY</label><select id="smtp-security" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-emerald-500 font-mono" value={profileData.smtpSecurity || 'None'} onChange={e => setProfileData({ ...profileData, smtpSecurity: e.target.value as any })}><option value="None">None</option><option value="SSL">SSL</option><option value="TLS">TLS</option></select></div>
                                    <div className="space-y-1 flex flex-col justify-end"><label htmlFor="smtp-user" className="text-[10px] font-bold text-slate-400 uppercase">SMTP USER (EMAIL)</label><input id="smtp-user" type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-emerald-500 font-mono placeholder:text-slate-500" placeholder="your.email@gmail.com" value={profileData.smtpUser || ''} onChange={e => setProfileData({ ...profileData, smtpUser: e.target.value })} /></div>
                                    <div className="space-y-1 flex flex-col justify-end"><label htmlFor="smtp-password" className="text-[10px] font-bold text-slate-400 uppercase">SMTP PASSWORD</label><input id="smtp-password" type="password" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500 font-mono placeholder:text-slate-500 tracking-widest" placeholder="••••••••••••••••" value={profileData.smtpPassword || ''} onChange={e => setProfileData({ ...profileData, smtpPassword: e.target.value })} /></div>
                                    <div className="space-y-1 flex flex-col justify-end"><label htmlFor="smtp-sender-name" className="text-[10px] font-bold text-slate-400 uppercase">SENDER NAME (IN MAIL)</label><input id="smtp-sender-name" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-500" placeholder="HR Department" value={profileData.senderName || ''} onChange={e => setProfileData({ ...profileData, senderName: e.target.value })} /></div>
                                    <div className="space-y-1 flex flex-col justify-end md:col-span-2 xl:col-span-3"><label htmlFor="smtp-sender-email" className="text-[10px] font-bold text-slate-400 uppercase">REPLY-TO EMAIL (IF DIFFERENT)</label><input id="smtp-sender-email" type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-emerald-500 font-mono placeholder:text-slate-500" placeholder="hr@yourcompany.com" value={profileData.senderEmail || ''} onChange={e => setProfileData({ ...profileData, senderEmail: e.target.value })} /></div>
                                </div>
                            </div>

                            {/* Payroll Security PIN Section */}
                            <div className="md:col-span-3">
                                <div className="flex items-center gap-3 border-b border-slate-800 pb-2 mb-4 mt-4">
                                    <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                                        <Lock size={12} /> PAYROLL SECURITY PASSWORD / PIN (MANDATORY FOR FREEZE)
                                    </h4>
                                </div>
                                <div className="bg-amber-900/10 border border-amber-700/20 p-6 rounded-xl space-y-4">
                                    <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                                        <div className="flex-1 space-y-2">
                                            <p className="text-[11px] text-amber-200/70 leading-relaxed">
                                                This separate Security Password / PIN is required whenever you **Freeze Attendance** or **Finalize Payroll**.
                                                It ensures that critical data backups cannot be initiated without explicit authorization.
                                            </p>
                                        </div>
                                        <div className="w-full md:w-64 relative">
                                            <label htmlFor="security-pin-input" className="text-[9px] font-black text-amber-500/50 uppercase tracking-widest mb-1.5 block">SECURITY PASSWORD / PIN</label>
                                            <div className="relative">
                                                <input
                                                    id="security-pin-input"
                                                    type={showPin ? "text" : "password"}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white font-mono outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-700 tracking-widest"
                                                    placeholder="Enter Security Password"
                                                    value={profileData.securityPin || ''}
                                                    onChange={e => setProfileData({ ...profileData, securityPin: e.target.value })}
                                                    title="Set Security Password / PIN for Payroll Operations"
                                                    aria-label="Set Security Password / PIN for Payroll Operations"
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
                                            flashPopupId: result.flashPopupId || prev.flashPopupId,
                                            loginAlertMessage: result.loginAlertMessage || prev.loginAlertMessage,
                                            loginAlertEnabled: result.loginAlertEnabled !== undefined ? result.loginAlertEnabled : prev.loginAlertEnabled
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
                                    <input type="text" title="Header" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white" placeholder="Message Header" value={profileData.postLoginHeader || ''} onChange={e => setProfileData({ ...profileData, postLoginHeader: e.target.value })} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-slate-500 font-bold uppercase">Alignment</label>
                                            <select title="Alignment" className="w-full bg-slate-950 border border-slate-800 text-white text-[10px] p-2 rounded-lg" value={profileData.postLoginAlignment || 'LEFT'} onChange={e => setProfileData({ ...profileData, postLoginAlignment: e.target.value as any })}><option value="LEFT">LEFT</option><option value="CENTER">CENTER</option></select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-slate-500 font-bold uppercase">Priority</label>
                                            <select title="Priority" className="w-full bg-slate-100 border border-slate-800 text-black text-[10px] p-2 rounded-lg font-bold" value={profileData.postLoginKey || 'REGULAR'} onChange={e => setProfileData({ ...profileData, postLoginKey: e.target.value as any })}><option value="REGULAR">Regular</option><option value="IMMEDIATE">Immediate</option></select>
                                        </div>
                                    </div>
                                    <textarea title="Message Content" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-slate-300 min-h-[160px] leading-relaxed" value={profileData.postLoginMessage || ''} onChange={e => setProfileData({ ...profileData, postLoginMessage: e.target.value })} />
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
                                        <select title="Ticker Mode" className="w-full bg-slate-950 border border-slate-800 text-white text-[10px] p-2 rounded-lg" value={profileData.flashNewsKey || 'REGULAR'} onChange={e => setProfileData({ ...profileData, flashNewsKey: e.target.value })}><option value="REGULAR">Regular Scroll</option><option value="IMMEDIATE">Urgent Priority</option></select>
                                    </div>
                                    <textarea title="Ticker Content" className="w-full flex-grow bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-emerald-400 min-h-[120px] leading-relaxed" value={profileData.flashNews || ''} onChange={e => setProfileData({ ...profileData, flashNews: e.target.value })} />
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
                                            <input type="text" title="Flash Header" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white" placeholder="FLASH ALERT" value={profileData.flashPopupHeader || ''} onChange={e => setProfileData({ ...profileData, flashPopupHeader: e.target.value })} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] text-slate-500 font-bold uppercase">Priority</label>
                                            <select title="Flash Priority" className="w-full bg-slate-950 border border-slate-800 text-white text-[10px] p-2 rounded-lg" value={profileData.flashPopupPriority || 'REGULAR'} onChange={e => setProfileData({ ...profileData, flashPopupPriority: e.target.value as any })}><option value="REGULAR">Standard</option><option value="IMMEDIATE">System Critical (Auto-Show)</option></select>
                                        </div>
                                        <p className="text-[9px] text-slate-500 italic">Flash alerts appear as a persistent floating notice until cleared by the user.</p>
                                    </div>
                                    <div className="lg:col-span-2">
                                        <textarea title="Flash Content" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-amber-200 min-h-[140px] leading-relaxed" value={profileData.flashPopupMessage || ''} onChange={e => setProfileData({ ...profileData, flashPopupMessage: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            {/* PRE-LOGIN SCREEN ALERT */}
                            <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-6 flex flex-col space-y-4 md:col-span-2">
                                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xs font-black text-rose-400 uppercase tracking-widest">Login Screen Alert Board (Legal/News)</h3>
                                        <label className="flex items-center gap-2 cursor-pointer ml-4">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-800 bg-slate-950 accent-rose-500"
                                                checked={profileData.loginAlertEnabled || false}
                                                onChange={e => setProfileData({ ...profileData, loginAlertEnabled: e.target.checked })}
                                            />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Visible on Login</span>
                                        </label>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            setIsSyncing(true);
                                            const res = await updateDeveloperMessages(
                                                profileData.loginAlertMessage || '',
                                                'ALERT',
                                                'LEGAL_NOTICE',
                                                'CENTER',
                                                profileData.loginAlertEnabled ? 'ENABLED' : 'DISABLED'
                                            );
                                            setIsSyncing(false);
                                            if (res.success) showAlert?.('success', 'Published', 'Login Alert Board updated globally.');
                                        }}
                                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black rounded-lg transition-all"
                                    >
                                        PUSH TO CLOUD
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    <p className="text-[9px] text-slate-500 leading-relaxed">
                                        This alert appears prominently on the login screen. Use it for legal ownership notices, version change-logs, or urgent news for users BEFORE they log in.
                                    </p>
                                    <textarea
                                        title="Login Alert Content"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-rose-200 min-h-[120px] font-medium leading-relaxed"
                                        placeholder="Enter the alert message to show on the login screen..."
                                        value={profileData.loginAlertMessage || ''}
                                        onChange={e => setProfileData({ ...profileData, loginAlertMessage: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'DATA' && (
                <div className="bg-[#1e293b] rounded-xl border border-slate-800 p-8 shadow-xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-900/30 text-indigo-400 rounded-lg border border-indigo-500/20">
                                <Database size={24} />
                            </div>
                            <div>
                                <h3 className="font-black text-white text-lg uppercase tracking-tighter">Data Management Center</h3>
                                <p className="text-xs text-slate-400">Secure Backup, Restoration & System Maintenance</p>
                            </div>
                        </div>
                        {profileData?.establishmentName && (
                            <div className="flex flex-col items-end gap-1">
                                <div className="text-xs font-bold text-amber-500 uppercase tracking-wider bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 whitespace-nowrap">
                                    {profileData.establishmentName}
                                </div>
                                <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-md">
                                    ID: <span className="text-amber-500">{activeCompanyId}</span>
                                </div>
                            </div>
                        )}
                    </div>


                    {isSetupMode ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="bg-[#0f172a] p-8 rounded-2xl border border-blue-500/20 flex flex-col items-center group hover:border-blue-500/40 transition-all">
                                <div className="p-4 bg-blue-900/20 text-blue-400 rounded-full mb-4 shadow-lg group-hover:scale-110 transition-transform">
                                    <Plus size={32} />
                                </div>
                                <h4 className="text-white font-black mb-1 uppercase tracking-tighter">Enter Fresh Data</h4>
                                <p className="text-[10px] text-slate-500 text-center mb-6">Start with an empty system for new installation.</p>
                                <button onClick={onSkipSetupRedirect} disabled={isLicenseExpired} title={isLicenseExpired ? "Inactive due to Trial/License expired" : ""} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all">Skip to Dashboard</button>
                            </div>
                            <div className="bg-[#0f172a] p-8 rounded-2xl border border-emerald-500/20 flex flex-col items-center group hover:border-emerald-500/40 transition-all">
                                <div className="p-4 bg-emerald-900/20 text-emerald-400 rounded-full mb-4 shadow-lg group-hover:scale-110 transition-transform">
                                    <Upload size={32} />
                                </div>
                                <h4 className="text-white font-black mb-1 uppercase tracking-tighter">Restore Backup</h4>
                                <p className="text-[10px] text-slate-500 text-center mb-6">Import data from a .enc or .sqlite backup file.</p>
                                <button onClick={() => { setBackupMode('IMPORT'); backupFileRef.current?.click(); }} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2"><Upload size={14} /> Restore File</button>
                            </div>
                            <div className="bg-[#0f172a] p-8 rounded-2xl border border-amber-500/20 flex flex-col items-center group hover:border-amber-500/40 transition-all">
                                <div className="p-4 bg-amber-900/20 text-amber-500 rounded-full mb-4 shadow-lg group-hover:rotate-12 transition-transform">
                                    <RotateCw size={32} />
                                </div>
                                <h4 className="text-white font-black mb-1 uppercase tracking-tighter">Legacy Migration</h4>
                                <p className="text-[10px] text-slate-500 text-center mb-6">Migrate from Single-Company older version.</p>
                                <button onClick={() => { setBackupMode('MIGRATE'); backupFileRef.current?.click(); }} disabled={isLicenseExpired} title={isLicenseExpired ? "Inactive due to Trial/License expired" : ""} className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-900/30 transition-all flex items-center justify-center gap-2"><RefreshCw size={14} /> Run Migration</button>
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
                                    <p className="text-[11px] text-slate-400 mb-2 leading-relaxed italic">"Create a secure, portable snapshot of your entire payroll database (Employees, Attendance, Company Profile, Statutory & Configuration Settings) for archival or migration."</p>

                                    {/* Filename Preview */}
                                    <div className="mb-4 p-2.5 bg-slate-950/50 border border-slate-800/50 rounded-lg flex flex-col gap-1">
                                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Filename Preview</span>
                                        <code className="text-[10px] text-blue-400 font-mono font-bold break-all">
                                            {generateBackupFilename(companyProfile.establishmentName, globalMonth, globalYear)}
                                        </code>
                                    </div>

                                    <button
                                        onClick={() => requireAuth(() => { setBackupMode('EXPORT'); setShowBackupModal(true); setEncryptionKey(''); })}
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Lock size={14} /> Initiate Local Backup
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

                                <div className="bg-[#0f172a] p-6 rounded-2xl border border-amber-500/10 hover:border-amber-500/30 transition-all group shadow-lg col-span-full">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-amber-900/20 text-amber-500 rounded-xl group-hover:rotate-12 transition-transform">
                                            <RotateCw size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-white uppercase tracking-tighter">Legacy Migration Wizard</h4>
                                            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded">Single -&gt; Multi-Company Bridge</span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-6 leading-relaxed italic">"Specifically for older backups. Extracts data, generates fresh IDs, and extrapolates fields for the new multi-company architecture."</p>
                                    <button
                                        onClick={() => { setBackupMode('MIGRATE'); backupFileRef.current?.click(); }}
                                        disabled={isLicenseExpired}
                                        title={isLicenseExpired ? "Inactive due to Trial/License expired" : ""}
                                        className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-900/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw size={14} /> Run Migration Wizard
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* System Maintenance Sections - ALWAYS VISIBLE */}
                    <div className="space-y-6 pt-4 border-t border-slate-800">
                        <div className="flex items-center gap-2 pb-2">
                            <AlertTriangle size={14} className="text-amber-500" />
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Maintenance Tools</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Partial Reset Card */}
                            <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/60 transition-colors flex flex-col justify-between group">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-amber-900/20 text-[#FFD700] rounded-lg group-hover:rotate-12 transition-transform">
                                            <RotateCw size={18} />
                                        </div>
                                        <h5 className="text-xs font-black text-[#FFD700] uppercase tracking-tighter">Partial Reset ( only data reset)</h5>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Clear all <span className="text-amber-400 font-bold underline underline-offset-2">Transactional Records</span> (Employees, Attendance, PayHistory) specifically for the <span className="text-white font-bold">{companyProfile.establishmentName}</span> (<span className="text-sky-400 font-mono">{companyProfile.id}</span>) unit.</p>
                                </div>
                                <button
                                    onClick={() => requireAuth(() => { setShowPayrollResetModal(true); setResetPassword(''); setResetError(''); })}
                                    disabled={isLicenseExpired}
                                    title={isLicenseExpired ? "Inactive due to Trial/License expired" : ""}
                                    className="mt-4 py-2.5 px-4 bg-amber-900/20 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-900/20 disabled:text-amber-500/50 text-amber-500 hover:text-white border border-amber-900/50 hover:border-amber-400 disabled:hover:border-amber-900/50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Initiate Partial Reset
                                </button>
                            </div>

                            {/* Organization Rescue Card */}
                            <div className="p-5 rounded-2xl border border-emerald-900/30 bg-emerald-900/5 hover:bg-emerald-900/10 transition-colors flex flex-col justify-between group">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-emerald-900/20 text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
                                            <FolderOpen size={18} />
                                        </div>
                                        <div>
                                            <h5 className="text-xs font-black text-white uppercase tracking-tighter">Organization Rescue & Recovery</h5>
                                            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">Data Re-linking</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed font-medium">"Lost an organization after an update? This tool scans your storage for orphaned data folders and re-links them to your registry."</p>
                                </div>
                                <button
                                    onClick={() => {
                                        if (onRescueOrganizations) {
                                            showAlert('confirm', 'Start Rescue Operation?', 'The system will scan for unlinked company folders. Found items will be added back to your organization list.', () => {
                                                onRescueOrganizations();
                                            });
                                        }
                                    }}
                                    disabled={isLicenseExpired}
                                    title={isLicenseExpired ? "Inactive due to Trial/License expired" : ""}
                                    className="mt-4 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={14} /> Scan & Rescue Orphans
                                </button>
                            </div>

                            {/* Deep Reset Card */}
                            <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/60 transition-colors flex flex-col justify-between group">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-pink-900/20 text-pink-500 rounded-lg group-hover:scale-110 transition-transform">
                                            <ShieldAlert size={18} />
                                        </div>
                                        <h5 className="text-xs font-black text-pink-400 uppercase tracking-tighter">PURGE COMPANY</h5>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Permanently <span className="text-pink-500 font-bold underline underline-offset-2">REMOVE</span> an organization. Click <span className="text-pink-500 font-black">Initiate Purge</span> to choose between removing the company from the registry list only or completely deleting its physical data folder from disk.</p>
                                </div>
                                <button
                                    onClick={() => requireAuth(() => { 
                                        setShowResetModal(true); 
                                        setResetMode('DEEP'); 
                                        setResetPassword(''); 
                                        setResetError(''); 
                                        const otherCompanies = JSON.parse(localStorage.getItem('app_companies') || '[]').filter((c: any) => c.id !== activeCompanyId);
                                        if (otherCompanies.length > 0) {
                                            setTargetPurgeCompanyId(otherCompanies[0].id);
                                        } else {
                                            setTargetPurgeCompanyId('');
                                        }
                                    })}
                                    disabled={isLicenseExpired}
                                    title={isLicenseExpired ? "Inactive due to Trial/License expired" : ""}
                                    className="mt-4 py-2.5 px-4 bg-pink-900/20 hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-pink-900/20 disabled:text-pink-500/50 text-pink-500 hover:text-white border border-pink-900/50 hover:border-pink-400 disabled:hover:border-pink-900/50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Initiate Purge
                                </button>
                            </div>



                            {/* Factory Reset Card */}
                            <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/60 transition-colors flex flex-col justify-between group">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-red-900/20 text-red-500 rounded-lg group-hover:scale-110 transition-transform">
                                            <Trash2 size={18} />
                                        </div>
                                        <h5 className="text-xs font-black text-red-400 uppercase tracking-tighter">Factory Reset - full reset</h5>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Perform a full <span className="text-red-500 font-bold underline underline-offset-2">Wipe-Out</span> of ALL data across ALL companies, identities, and settings. Used for system decommissioning.</p>
                                </div>
                                <button
                                    onClick={() => requireAuth(() => { setShowResetModal(true); setResetMode('FACTORY'); setResetPassword(''); setResetError(''); })}
                                    disabled={isLicenseExpired}
                                    title={isLicenseExpired ? "Inactive due to Trial/License expired" : ""}
                                    className="mt-4 py-2.5 px-4 bg-red-900/20 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-900/20 disabled:text-red-500/50 text-red-500 hover:text-white border border-red-900/50 hover:border-red-400 disabled:hover:border-red-900/50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Initiate Factory Reset
                                </button>
                            </div>

                            {/* Diagnostics Card */}
                            <div className="p-5 rounded-2xl border border-blue-900/30 bg-blue-900/5 hover:bg-blue-900/10 transition-colors flex flex-col justify-between group">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-blue-900/20 text-blue-400 rounded-lg group-hover:scale-110 transition-transform">
                                            <FileText size={18} />
                                        </div>
                                        <div>
                                            <h5 className="text-xs font-black text-blue-400 uppercase tracking-tighter">Diagnostic Report</h5>
                                            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded">Encrypted</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Generate an AES-256 encrypted secure file containing application configuration, error traces, and active logs for Developer support.</p>
                                </div>
                                <button
                                    onClick={executeDiagnosticExport}
                                    className="mt-4 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                    <FileText size={14} /> Export Diagnostic Logs
                                </button>
                            </div>
                        </div>
                    </div>



                    {/* Application Storage Section - SHIFTED TO BOTTOM */}
                    <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/30 transition-all group shadow-lg">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-indigo-900/20 text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
                                <FolderOpen size={24} />
                            </div>
                            <div>
                                <h4 className="font-black text-white uppercase tracking-tighter">Application Storage Location</h4>
                                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded">Root Path</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-400 break-all leading-relaxed">
                                {appDirectory || 'Scanning for configured path...'}
                            </div>
                            <button
                                onClick={() => requireAuth(handleChangeDirectory)}
                                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-700 shadow-lg active:scale-95"
                            >
                                <Lock size={14} className="text-indigo-400" /> Secure Change Directory
                            </button>
                            <p className="text-[9px] text-slate-500 italic text-center">
                                * Requires Administrator Authorization to modify system storage path.
                            </p>
                        </div>
                    </div>
                    <input
                        ref={backupFileRef}
                        type="file"
                        className="hidden"
                        accept=".enc,.sqlite"
                        onChange={handleFileSelect}
                        title="Select backup file for restoration"
                        aria-label="Select backup file for restoration"
                    />
                </div>
            )
            }



            {
                showResetModal && (resetMode === 'FACTORY' || resetMode === 'DEEP') && (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className={`bg-[#1e293b] w-full max-w-sm rounded-2xl border shadow-2xl p-6 flex flex-col gap-4 relative border-red-900/50`}>
                            {!isProcessing && <button onClick={() => setShowResetModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close" aria-label={`Close ${resetMode} Reset Modal`}><X size={20} /></button>}
                            <div className="flex flex-col items-center gap-2">
                                <div className={`p-4 rounded-full border mb-2 ${resetMode === 'DEEP' ? 'bg-pink-900/20 text-pink-500 border-pink-900/50' : 'bg-red-900/20 text-red-500 border-red-900/50'}`}><AlertTriangle size={32} /></div>
                                <h3 className="text-xl font-black text-white text-center">{resetMode === 'DEEP' ? 'PURG COMPANY' : 'FACTORY RESET'}</h3>
                                <p className={`text-xs text-center leading-relaxed ${resetMode === 'DEEP' ? 'text-pink-300' : 'text-red-300'}`}>
                                    {resetMode === 'DEEP'
                                        ? (purgeScope === 'COMPLETE' 
                                            ? `CRITICAL WARNING: This action is IRREVERSIBLE and will permanently delete ${profileData?.establishmentName || companyProfile.establishmentName} and completely wipe its physical folders from disk.`
                                            : `WARNING: This action will remove ${profileData?.establishmentName || companyProfile.establishmentName} from the list of active companies. Its physical database folder will remain intact.`)
                                        : 'CRITICAL WARNING: This action is IRREVERSIBLE and will wipe ALL company data.'}
                                </p>
                            </div>

                            {resetMode === 'DEEP' && (
                                <div className="flex flex-col gap-2 bg-slate-900/40 p-1.5 rounded-xl border border-slate-800">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-2 pt-1">Purge Method Option</span>
                                    <div className="flex flex-col gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setPurgeScope('LIST_ONLY')}
                                            className={`p-2.5 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${purgeScope === 'LIST_ONLY' ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-800 bg-[#0f172a]/30 hover:bg-[#0f172a]/60'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${purgeScope === 'LIST_ONLY' ? 'border-amber-500' : 'border-slate-600'}`}>
                                                    {purgeScope === 'LIST_ONLY' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>}
                                                </div>
                                                <span className={`text-[10px] font-black tracking-wide uppercase ${purgeScope === 'LIST_ONLY' ? 'text-amber-400' : 'text-slate-300'}`}>Remove From Active List Only</span>
                                            </div>
                                            <span className="text-[8.5px] text-slate-400 leading-normal pl-5">Removes company from selection list. Hard disk folder remains intact.</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setPurgeScope('COMPLETE')}
                                            className={`p-2.5 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${purgeScope === 'COMPLETE' ? 'border-pink-500/50 bg-pink-500/10' : 'border-slate-800 bg-[#0f172a]/30 hover:bg-[#0f172a]/60'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${purgeScope === 'COMPLETE' ? 'border-pink-500' : 'border-slate-600'}`}>
                                                    {purgeScope === 'COMPLETE' && <div className="w-1.5 h-1.5 rounded-full bg-pink-500"></div>}
                                                </div>
                                                <span className={`text-[10px] font-black tracking-wide uppercase ${purgeScope === 'COMPLETE' ? 'text-pink-400' : 'text-slate-300'}`}>Delete Folder Completely</span>
                                            </div>
                                            <span className="text-[8.5px] text-slate-400 leading-normal pl-5">Deletes from selection list AND permanently deletes the data folder from disk.</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                                <input type="password" placeholder="Enter Login Password" title="Password" autoFocus disabled={isProcessing} className={`w-full bg-[#0f172a] border ${resetError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-red-500 transition-all`} value={resetPassword} onChange={(e) => { setResetPassword(e.target.value); setResetError(''); }} onKeyDown={(e) => e.key === 'Enter' && (resetMode === 'DEEP' ? executeDeepReset() : executeFactoryReset())} />
                                {resetError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{resetError}</p>}
                            </div>
                            <button onClick={resetMode === 'DEEP' ? executeDeepReset : executeFactoryReset} disabled={isProcessing} className={`w-full disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${resetMode === 'DEEP' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-red-600 hover:bg-red-700'}`}>
                                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />} {isProcessing ? 'PURGING...' : (resetMode === 'DEEP' ? 'CONFIRM PURGE' : 'CONFIRM DELETE ALL')}
                            </button>
                        </div>
                    </div>
                )
            }

            {
                showPayrollResetModal && (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-amber-900/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                            <button onClick={() => setShowPayrollResetModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close" aria-label="Close Payroll Reset Modal"><X size={20} /></button>
                            <div className="flex flex-col items-center gap-2">
                                <div className="p-4 bg-amber-900/20 text-[#FFD700] rounded-full border border-amber-900/50 mb-2"><Trash2 size={32} /></div>
                                <h3 className="text-xl font-black text-white text-center">PARTIAL DATA RESET</h3>
                                <p className="text-xs text-amber-300 text-center leading-relaxed">This will erase all employees and payroll for {companyProfile.establishmentName} only.</p>
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
                )
            }

            {
                showBackupModal && (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#052a16] w-full max-w-sm rounded-2xl border border-emerald-700/50 shadow-2xl shadow-emerald-900/20 p-6 flex flex-col gap-4 relative">
                            {!isProcessing && <button onClick={() => setShowBackupModal(false)} className="absolute top-4 right-4 text-emerald-500/50 hover:text-emerald-300" title="Close" aria-label="Close Backup Modal"><X size={20} /></button>}
                            <div className="flex flex-col items-center gap-2">
                                <div className="p-4 bg-emerald-900/30 text-emerald-400 rounded-full border border-emerald-700/50 mb-2">{backupMode === 'EXPORT' ? <Lock size={32} /> : <Database size={32} />}</div>
                                <h3 className="text-xl font-black text-emerald-50 text-center uppercase tracking-widest">{backupMode === 'EXPORT' ? 'SECURE EXPORT' : 'SECURE RESTORE'}</h3>
                            </div>

                            <div className="space-y-4 mt-2">
                                {(backupMode === 'IMPORT' || backupMode === 'MIGRATE') && (
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
                                        {backupMode === 'EXPORT' ? 'SET ENCRYPTION PASSWORD' : (backupMode === 'MIGRATE' ? 'ENTER DECRYPTION PASSWORD' : (isBCACFile ? 'ENTER SECURITY PIN' : 'ENTER DECRYPTION PASSWORD'))}
                                    </label>
                                    <input
                                        type="password"
                                        placeholder={(isMachineLocked && !isBCACFile) ? "No Password Required" : (backupMode === 'MIGRATE' ? "Enter Password" : (isBCACFile ? "Enter 6-Digit PIN" : "Enter Password"))}
                                        title="Password"
                                        autoFocus
                                        disabled={isMachineLocked && !isBCACFile}
                                        className={`w-full bg-[#021109] border border-emerald-900/50 rounded-xl px-4 py-3 text-white placeholder-emerald-900/50 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${(isMachineLocked && !isBCACFile) ? 'opacity-50 cursor-not-allowed' : ''} font-mono tracking-widest`}
                                        value={encryptionKey}
                                        onChange={(e) => setEncryptionKey(e.target.value)}
                                    />
                                    {(isMachineLocked && !isBCACFile) && (
                                        <div className="mt-1 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                                            <ShieldCheck size={12} className="text-emerald-400" />
                                            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">Secure Binary Backup Detected</span>
                                        </div>
                                    )}
                                    {isBCACFile && (
                                        <div className="mt-1 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                                            <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
                                            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest leading-relaxed">
                                                Before/After Confirmation Backup Detected. Enter Security PIN to Restore.
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* V03.01.07: Removed 'Restore into current company profile' to avoid data pollution */}

                                {processStatus && <p className="text-[10px] text-emerald-400 font-bold text-center animate-pulse uppercase tracking-widest">{processStatus}</p>}

                                {isProcessing && (
                                    <div className="w-full bg-[#021109] border border-emerald-900/50 h-2.5 rounded-full overflow-hidden shadow-inner my-2">
                                        <div
                                            ref={progressRef}
                                            className="h-full bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 transition-all duration-500 ease-out shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                                        ></div>
                                    </div>
                                )}

                                <button
                                    onClick={backupMode === 'EXPORT' ? handleEncryptedExport : backupMode === 'MIGRATE' ? initiateLegacyMigration : initiateRestore}
                                    disabled={isProcessing || (backupMode !== 'EXPORT' && !selectedBackupFile)}
                                    className={`w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest border border-emerald-500/50`}
                                >
                                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : (backupMode === 'EXPORT' ? <Download size={16} /> : <RefreshCw size={16} />)}
                                    {backupMode === 'EXPORT' ? 'DOWNLOAD ENCRYPTED BACKUP' : backupMode === 'MIGRATE' ? 'MIGRATE & RESTORE' : 'RESTORE DATA'}
                                </button>

                                {backupMode === 'IMPORT' && !selectedBackupFile && (
                                    <p className="text-[9px] text-slate-500 text-center italic font-medium">
                                        * Please select a valid .enc or .sqlite file to proceed
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* OTP RECOVERY MODAL */}
            {showRecoveryModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 animate-in zoom-in-95 duration-300">
                        <div className="p-6 bg-gradient-to-br from-blue-900/40 via-transparent to-transparent">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-inner">
                                        <Mail size={18} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Identify Verification</h3>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Recover machine-locked backup</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowRecoveryModal(false)} className="p-2 hover:bg-slate-800 rounded-xl transition-colors" title="Close Recovery Modal" aria-label="Close">
                                    <X size={16} className="text-slate-500" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {recoveryStep === 'IDENTIFY' ? (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                                            <p className="text-[10px] text-slate-400 leading-relaxed font-medium italic">
                                                Confirm your registered email to receive a recovery code. Once verified, the cloud will authorize decryption for this machine.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Registered Email ID</label>
                                            <div className="relative group">
                                                <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                                <input
                                                    type="email"
                                                    value={recoveryEmail}
                                                    onChange={(e) => setRecoveryEmail(e.target.value)}
                                                    className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                    placeholder="e.g. admin@company.com"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleRequestRecoveryOTP}
                                            disabled={isRecovering || !recoveryEmail}
                                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                        >
                                            {isRecovering ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                            Send Recovery Code
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                                            <p className="text-[10px] text-emerald-400/80 leading-relaxed font-medium italic">
                                                Verification code sent! Please enter the 6-digit OTP from your email to unlock your payroll database.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Enter OTP Code</label>
                                            <div className="relative group">
                                                <KeyRound size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                                                <input
                                                    type="text"
                                                    maxLength={6}
                                                    value={recoveryOTP}
                                                    onChange={(e) => setRecoveryOTP(e.target.value)}
                                                    className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-xl font-black text-emerald-400 tracking-[0.5em] text-center outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                                    placeholder="000000"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleVerifyRecoveryAndRestore}
                                            disabled={isRecovering || recoveryOTP.length < 6}
                                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                        >
                                            {isRecovering ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                            Verify & Finalize Restore
                                        </button>
                                        <button onClick={() => setRecoveryStep('IDENTIFY')} className="w-full text-center text-[9px] text-slate-500 hover:text-slate-300 font-bold uppercase tracking-widest">Resend Code</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'LICENSE' && (
                (() => {
                    const isRestoringTrial = licenseInfo?.status === 'PENDING_RESTORE' && (licenseInfo?.isTrial || licenseInfo?.key === 'TRIAL');

                    return (
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
                                {currentUser?.username && (
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="text-xs font-bold text-amber-500 uppercase tracking-wider bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 whitespace-nowrap">
                                            USER ID: <span className="text-white">{currentUser.username}</span>
                                        </div>
                                    </div>
                                )}
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
                                                <span className="text-xs font-mono text-sky-400 font-black tracking-widest bg-sky-500/10 px-3 py-1 rounded-lg border border-sky-500/20">
                                                    {formatLicenseKey(licenseInfo?.key)}
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
                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Companies Allowed</span>
                                                <span className="text-sm font-black text-sky-400 font-mono bg-sky-500/10 px-4 py-1 rounded-lg border border-sky-500/20">
                                                    {licenseInfo?.companyLimit || 1}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-1.5 border-t border-white/5">
                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expiry Date</span>
                                                <span className="text-xs font-bold text-pink-400 italic">
                                                    {formatExpiryDate(licenseInfo?.expiryDate)}
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
                                                className={`w-full bg-[#0a0f1d] border border-white/5 focus:border-pink-500/50 rounded-xl p-3 text-white text-xs font-bold outline-none transition-all focus:ring-4 focus:ring-pink-500/10 placeholder-gray-600 uppercase ${licenseInfo?.status === 'LICENSE ACTIVE' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                value={newUserName}
                                                onChange={e => setNewUserName(e.target.value.toUpperCase())}
                                                disabled={licenseInfo?.status === 'LICENSE ACTIVE'}
                                            />
                                        </div>
                                        <div className={isRestoringTrial ? "space-y-4" : "grid grid-cols-2 gap-4"}>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">User ID</label>
                                                <input
                                                    type="text"
                                                    placeholder="Enter User ID"
                                                    className={`w-full bg-[#0a0f1d] border border-white/5 focus:border-pink-500/50 rounded-xl p-3 text-white text-xs font-mono outline-none transition-all focus:ring-4 focus:ring-pink-500/10 placeholder-gray-600 uppercase ${licenseInfo?.status === 'LICENSE ACTIVE' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    value={newUserID}
                                                    onChange={e => setNewUserID(e.target.value.toUpperCase())}
                                                    disabled={licenseInfo?.status === 'LICENSE ACTIVE'}
                                                />
                                            </div>
                                            {(!isRestoringTrial || showUpgradeField) && (
                                                <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">License Key (16-Digit)</label>
                                                    <input
                                                        type="text"
                                                        placeholder="XXXX-XXXX-XXXX-XXXX"
                                                        className={`w-full bg-[#0a0f1d] border border-white/5 focus:border-pink-500/50 rounded-xl p-3 text-white text-xs font-mono uppercase outline-none transition-all focus:ring-4 focus:ring-pink-500/10 ${licenseInfo?.status === 'LICENSE ACTIVE' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        value={newLicenseKey}
                                                        onChange={e => {
                                                            const val = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 16);
                                                            const formatted = val.match(/.{1,4}/g)?.join('-') || val;
                                                            setNewLicenseKey(formatted);
                                                        }}
                                                        disabled={licenseInfo?.status === 'LICENSE ACTIVE'}
                                                    />
                                                </div>
                                            )}
                                            {isRestoringTrial && !showUpgradeField && (
                                                <div className="flex flex-col items-center justify-center p-4 bg-pink-500/5 border border-pink-500/10 rounded-xl space-y-2">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">Trial Account Detected</p>
                                                    <button
                                                        onClick={() => setShowUpgradeField(true)}
                                                        className="px-4 py-2 bg-pink-600/20 hover:bg-pink-600 text-pink-400 hover:text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-lg border border-pink-500/30 transition-all flex items-center gap-2"
                                                    >
                                                        <KeyRound size={12} />
                                                        Activate Full License Key
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-[1.3fr,0.7fr] gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Email ID</label>
                                                <input
                                                    type="email"
                                                    className={`w-full bg-[#0a0f1d] border border-white/5 focus:border-pink-500/50 rounded-xl p-3 text-white text-xs font-bold outline-none transition-all focus:ring-4 focus:ring-pink-500/10 placeholder-gray-600 ${licenseInfo?.status === 'LICENSE ACTIVE' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    value={newRegEmail}
                                                    onChange={(e) => setNewRegEmail(e.target.value)}
                                                    placeholder="Enter Registered Email"
                                                    disabled={licenseInfo?.status === 'LICENSE ACTIVE'}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Mobile No</label>
                                                <input
                                                    type="text"
                                                    className={`w-full bg-[#0a0f1d] border border-white/5 focus:border-pink-500/50 rounded-xl p-3 text-white text-xs font-mono outline-none transition-all focus:ring-4 focus:ring-pink-500/10 placeholder-gray-600 ${licenseInfo?.status === 'LICENSE ACTIVE' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    value={newRegMobile}
                                                    onChange={(e) => setNewRegMobile(e.target.value)}
                                                    placeholder="Enter Registered Mobile"
                                                    disabled={licenseInfo?.status === 'LICENSE ACTIVE'}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Password</label>
                                            <input
                                                type="password"
                                                className={`w-full bg-[#0a0f1d] border border-white/5 focus:border-pink-500/50 rounded-xl p-3 text-white text-xs font-mono outline-none transition-all focus:ring-4 focus:ring-pink-500/10 placeholder-gray-600 ${licenseInfo?.status === 'LICENSE ACTIVE' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="Enter Password"
                                                disabled={licenseInfo?.status === 'LICENSE ACTIVE'}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={async () => {
                                            const isRestoringTrial = licenseInfo?.status === 'PENDING_RESTORE' && (licenseInfo?.isTrial || licenseInfo?.key === 'TRIAL');
                                            const bypassKeyCheck = isRestoringTrial && !newLicenseKey && !showUpgradeField;

                                            if (!bypassKeyCheck && !isValidKeyFormat(newLicenseKey)) {
                                                showAlert?.('warning', 'Invalid Key', 'Please enter a valid 16-digit license key.');
                                                return;
                                            }

                                            setIsActivating(true);
                                            let result;

                                            if (bypassKeyCheck) {
                                                // --- TRIAL RESCUE PATH: Sync via Email/Mobile instead of Key ---
                                                const syncRes = await validateLicenseStartup(true, newUserID, newRegEmail, newRegMobile, newPassword);
                                                result = {
                                                    success: syncRes.valid,
                                                    message: syncRes.valid ? '✅ Trial Identity Restored: Your system has been successfully verified and synchronized via cloud records.' : (syncRes.message || 'Identity verification failed.'),
                                                    data: syncRes.data
                                                };
                                            } else {
                                                // --- FULL ACTIVATION PATH: Requires 16-Digit Key ---
                                                result = await activateFullLicense(newUserName, newUserID, newLicenseKey, newRegEmail, newRegMobile, newPassword);
                                            }

                                            setIsActivating(false);
                                            if (result.success) {
                                                // --- V02.02.21: HOT-SWAP DATA (Stay on page) ---
                                                if (result.data) {
                                                    setLicenseInfo(result.data);
                                                    setNewLicenseKey(''); // Clear the key field on success
                                                }

                                                // Update global app state without reload
                                                if (verifyLicense) await verifyLicense();

                                                showAlert?.('success', bypassKeyCheck ? 'Sync Successful' : 'System Activated', result.message);
                                            } else {
                                                showAlert?.('danger', bypassKeyCheck ? 'Sync Failed' : 'Activation Failed', result.message);
                                            }
                                        }}
                                        disabled={isActivating || licenseInfo?.status === 'LICENSE ACTIVE'}
                                        className={`mt-4 w-full py-4 text-white font-black uppercase text-sm rounded-xl shadow-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 ${licenseInfo?.status === 'LICENSE ACTIVE' ? 'bg-slate-700 shadow-none' : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 shadow-pink-900/20'}`}
                                    >
                                        {isActivating ? <Loader2 size={20} className="animate-spin" /> : <Shield size={20} />}
                                        {isActivating ? 'Activating...' : 'Re-Activate System'}
                                    </button>
                                </div>
                            </div>

                            {/* --- V05.02.10: Dev Diagnostic Timestamps --- */}
                            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl relative mt-8">
                                <div className="p-4 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-b border-slate-700/50 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                                            <Info size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-white font-black tracking-tight text-sm">App Patch Diagnostics</h3>
                                                {isLicenseExpired && (
                                                    <span className="text-[9px] text-rose-400 font-bold tracking-widest uppercase bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">Version / Patch Update will be inactive under Expired Trial / License</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-400">Live Timestamp Validation Variables</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                                            <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold tracking-wider">Compiled Executable Version</p>
                                            <p className="text-amber-400 font-mono font-bold">{APP_VERSION}</p>
                                        </div>
                                        <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                                            <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold tracking-wider">Cloud App_Config Version</p>
                                            <p className="text-amber-400 font-mono font-bold">{localStorage.getItem('app_latest_version') || 'Unknown'}</p>
                                        </div>
                                        <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                                            <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold tracking-wider">Compiled Baseline Timestamp</p>
                                            <p className="text-blue-400 font-mono font-bold">{APP_PATCH_TIMESTAMP}</p>
                                        </div>
                                        <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                                            <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold tracking-wider">Local Active Timestamp (activeTs)</p>
                                            <p className="text-blue-400 font-mono font-bold">{localStorage.getItem('app_active_patch_ts') || APP_PATCH_TIMESTAMP}</p>
                                        </div>
                                        <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex flex-col justify-center">
                                            <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold tracking-wider">Usage Time (Current Session)</p>
                                            <p className="text-fuchsia-400 font-mono font-bold">
                                                <UsageTimeClock />
                                            </p>
                                        </div>
                                        <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                                            <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold tracking-wider">Cloud Live Timestamp (latestTs)</p>
                                            <p className="text-emerald-400 font-mono font-bold">{latestPatchTimestamp || localStorage.getItem('app_latest_patch_timestamp') || 'Unknown'}</p>
                                        </div>
                                    </div>

                                    <p className="mt-4 text-[10px] text-slate-500 leading-relaxed text-center">
                                        For a patch to trigger, <strong className="text-slate-300">Cloud Live Timestamp</strong> must be strictly newer than <strong className="text-slate-300">Local Active Timestamp</strong>.<br/>
                                        Additionally, <strong className="text-slate-300">Compiled Executable Version</strong> must not be higher than <strong className="text-slate-300">Cloud App_Config Version</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })()
            )}

            {
                activeTab === 'USERS' && (
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
                            {currentUser?.username && (
                                <div className="flex flex-col items-end gap-1">
                                    <div className="text-xs font-bold text-amber-500 uppercase tracking-wider bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 whitespace-nowrap">
                                        USER ID: <span className="text-white">{currentUser.username}</span>
                                    </div>
                                </div>
                            )}
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

                                {/* RELOCATED SECURITY SECTION: Now dynamic based on list length */}
                                <div className="mt-8 pt-8 border-t border-white/5 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <KeyRound size={20} className="text-pink-500" />
                                            <div>
                                                <h3 className="text-sm font-black text-pink-500 uppercase tracking-tighter">Security & Credentials</h3>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Update Cloud Password via OTP</p>
                                            </div>
                                        </div>
                                        {sessionStorage.getItem('app_forced_reset') === 'true' && (
                                            <div className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded-md text-rose-500 text-[8px] font-black uppercase animate-pulse">
                                                Forced Reset
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 bg-pink-500/5 border border-pink-500/10 rounded-2xl flex gap-3">
                                        <Info size={16} className="text-pink-500 shrink-0" />
                                        <p className="text-[9px] text-slate-400 leading-relaxed font-bold uppercase tracking-wider">
                                            <span className="text-pink-500">Note:</span> Cloud password resets affect the master identity on all machines. Ensure your recovery email is secure.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        {resetStep === 'IDENTIFY' ? (
                                            <div className="space-y-4 animate-in fade-in duration-300">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Current Password</label>
                                                        <input
                                                            type="password"
                                                            placeholder="Verify Identity"
                                                            className="w-full bg-[#0a0f1d] border border-white/5 focus:border-sky-500/50 rounded-lg p-2.5 text-white text-xs font-mono outline-none transition-all"
                                                            value={currentPass}
                                                            onChange={e => setCurrentPass(e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Registered ID</label>
                                                        <div className="w-full bg-[#0a0f1d]/50 border border-white/5 rounded-lg p-2.5 text-slate-500 text-xs font-mono">
                                                            {licenseInfo?.userID || 'N/A'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1 relative">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">New Password</label>
                                                        <input
                                                            type="password"
                                                            placeholder="New Credentials"
                                                            onFocus={() => setShowPassRules(true)}
                                                            onBlur={() => setShowPassRules(false)}
                                                            className="w-full bg-[#0a0f1d] border border-white/5 focus:border-sky-500/50 rounded-lg p-2.5 text-white text-xs font-mono outline-none transition-all"
                                                            value={newPass}
                                                            onChange={e => setNewPass(e.target.value)}
                                                        />
                                                        {showPassRules && (
                                                            <div className="absolute bottom-12 left-0 right-0 z-50 bg-[#1e293b] border border-slate-700 rounded-xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                                                                <div className="flex items-center gap-2 text-sky-400 mb-2 border-b border-white/5 pb-1">
                                                                    <ShieldAlert size={12} />
                                                                    <span className="text-[9px] font-black uppercase tracking-widest">Rules</span>
                                                                </div>
                                                                <ul className="text-[9px] text-slate-400 font-bold uppercase space-y-1">
                                                                    <li className={newPass.length >= 9 ? 'text-emerald-500' : ''}>• Min 9 Chars</li>
                                                                    <li className={/[A-Z]/.test(newPass) ? 'text-emerald-500' : ''}>• One Capital</li>
                                                                    <li className={/[0-9]/.test(newPass) ? 'text-emerald-500' : ''}>• One Numeric</li>
                                                                    <li className={/[^A-Za-z0-9]/.test(newPass) ? 'text-emerald-500' : ''}>• One Special</li>
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Confirm New</label>
                                                        <input
                                                            type="password"
                                                            placeholder="Match Above"
                                                            className="w-full bg-[#0a0f1d] border border-white/5 focus:border-sky-500/50 rounded-lg p-2.5 text-white text-xs font-mono outline-none transition-all"
                                                            value={confirmPass}
                                                            onChange={e => setConfirmPass(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        if (!currentPass || !newPass || !confirmPass) {
                                                            showAlert('warning', 'Input Required', 'Provide all password fields.'); return;
                                                        }
                                                        if (newPass !== confirmPass) {
                                                            showAlert('warning', 'Mismatch', 'New passwords do not match.'); return;
                                                        }
                                                        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{9,}$/;
                                                        if (!regex.test(newPass)) {
                                                            showAlert('warning', 'Insecure', 'Password lacks complexity.'); return;
                                                        }
                                                        const users: User[] = JSON.parse(localStorage.getItem('app_users') || '[]');
                                                        const admin = users.find(u => u.role === 'Administrator');
                                                        if (!admin || admin.password !== currentPass) {
                                                            showAlert('danger', 'Access Denied', 'Incorrect current password.'); return;
                                                        }
                                                        setIsUpdatingPass(true);
                                                        try {
                                                            const res = await requestResetOTP(licenseInfo?.registeredTo || '', licenseInfo?.userID || '');
                                                            if (res.success) setResetStep('OTP');
                                                            else showAlert('danger', 'Gateway Error', res.message);
                                                        } finally { setIsUpdatingPass(false); }
                                                    }}
                                                    disabled={isUpdatingPass}
                                                    className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    {isUpdatingPass ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                                                    Request Reset OTP
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                                                <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl flex flex-col items-center gap-2 text-center">
                                                    <ShieldCheck className="text-emerald-400" size={24} />
                                                    <p className="text-[10px] text-slate-300 font-medium">OTP Sent to <b>{licenseInfo?.registeredTo}</b></p>
                                                </div>
                                                <input
                                                    type="text"
                                                    maxLength={6}
                                                    placeholder="000000"
                                                    className="w-full bg-[#0a0f1d] border border-sky-500/30 rounded-xl p-3 text-white text-2xl font-black text-center tracking-[0.5em] font-mono outline-none"
                                                    value={resetOTP}
                                                    onChange={e => setResetOTP(e.target.value.replace(/[^0-9]/g, ''))}
                                                />
                                                <div className="flex gap-2">
                                                    <button onClick={() => setResetStep('IDENTIFY')} className="px-4 py-3 bg-slate-800 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-xl">Back</button>
                                                    <button
                                                        onClick={async () => {
                                                            if (resetOTP.length !== 6) { showAlert('warning', 'Invalid OTP', 'Enter 6-digit code.'); return; }
                                                            setIsUpdatingPass(true);
                                                            try {
                                                                const res = await updateCloudPassword(licenseInfo?.registeredTo || '', newPass, resetOTP);
                                                                if (res.success) {
                                                                    const users: User[] = JSON.parse(localStorage.getItem('app_users') || '[]');
                                                                    const adminIdx = users.findIndex(u => u.role === 'Administrator');
                                                                    if (adminIdx !== -1) {
                                                                        users[adminIdx].password = newPass;
                                                                        localStorage.setItem('app_users', JSON.stringify(users));
                                                                        if (window.electronAPI) await window.electronAPI.dbSet('app_users', users);
                                                                    }
                                                                    showAlert('success', 'Identity Restored', 'Password reset successful via cloud sync.');
                                                                    setCurrentPass(''); setNewPass(''); setConfirmPass(''); setResetOTP(''); setResetStep('IDENTIFY');
                                                                } else showAlert('danger', 'Reset Failed', res.message);
                                                            } finally { setIsUpdatingPass(false); }
                                                        }}
                                                        disabled={isUpdatingPass}
                                                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl shadow-lg transition-all"
                                                    >
                                                        {isUpdatingPass ? <Loader2 size={14} className="animate-spin" /> : 'Confirm Reset'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
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
                                    {isAdminEdit && (
                                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex gap-3 animate-in fade-in slide-in-from-top-2">
                                            <ShieldAlert size={20} className="text-rose-500 shrink-0" />
                                            <p className="text-[10px] text-rose-200 leading-relaxed font-black uppercase tracking-wider">
                                                Administrator Can't be Edited, any Change has to be through a mail from registered mailid to <span className="text-rose-400">ilcbala.bharatpayroll@gmail.com</span>
                                            </p>
                                        </div>
                                    )}

                                    {isTrialRestricted && (
                                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3 animate-in fade-in slide-in-from-top-2">
                                            <AlertTriangle size={20} className="text-amber-500 shrink-0" />
                                            <p className="text-[10px] text-amber-200 leading-relaxed font-black uppercase tracking-wider">
                                                User creation is Restricted in Trial version. Please activate a full license to add multiple users.
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Full Name</label>
                                        <input
                                            ref={umNameRef}
                                            type="text"
                                            placeholder="Enter user's full name"
                                            readOnly={!!isAdminEdit}
                                            className={`w-full bg-[#0a0f1d] border border-white/5 focus:border-sky-500/50 rounded-xl p-3.5 text-white text-xs font-bold outline-none transition-all focus:ring-4 focus:ring-sky-500/10 placeholder-gray-600 uppercase ${isAdminEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            value={umForm.name}
                                            onChange={e => setUmForm({ ...umForm, name: e.target.value.toUpperCase() })}
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
                                            onChange={e => setUmForm({ ...umForm, username: e.target.value.toLowerCase() })}
                                        />
                                    </div>

                                    <div className="space-y-1.5 relative">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Login Password</label>
                                        <div className="relative group">
                                            <input
                                                type={umShowPwd ? "text" : "password"}
                                                placeholder="Enter secure password"
                                                readOnly={!!isAdminEdit}
                                                className={`w-full bg-[#0a0f1d] border border-white/5 focus:border-sky-500/50 rounded-xl p-3.5 text-white text-xs font-mono outline-none transition-all focus:ring-4 focus:ring-sky-500/10 pr-12 placeholder-gray-600 ${isAdminEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                value={umForm.password}
                                                onChange={e => setUmForm({ ...umForm, password: e.target.value })}
                                            />
                                            <button
                                                onClick={() => !isAdminEdit && setUmShowPwd(!umShowPwd)}
                                                disabled={isAdminEdit}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-sky-400 transition-colors bg-white/5 p-1 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                                                title={umShowPwd ? "Hide Password" : "Show Password"}
                                            >
                                                {umShowPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>


                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">System Role</label>
                                        <div className={`grid grid-cols-2 gap-2 bg-[#0a0f1d] p-1.5 rounded-2xl border border-white/5 ${isAdminEdit ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                            <button
                                                onClick={() => !isAdminEdit && canSelectAdminRole && setUmForm({ ...umForm, role: 'Administrator' })}
                                                disabled={!!(isAdminEdit || !canSelectAdminRole)}
                                                title={!canSelectAdminRole ? "Administrator already exists" : ""}
                                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${umForm.role === 'Administrator' ? 'bg-sky-600/20 text-sky-400 ring-2 ring-sky-500/30 shadow-lg' : 'text-slate-500 hover:text-slate-300'} ${!canSelectAdminRole ? 'opacity-40 cursor-not-allowed' : ''}`}
                                            >
                                                Administrator
                                            </button>
                                            <button
                                                onClick={() => !isAdminEdit && setUmForm({ ...umForm, role: 'User' })}
                                                disabled={!!isAdminEdit}
                                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${umForm.role === 'User' ? 'bg-sky-600 text-white shadow-xl shadow-sky-900/40 ring-2 ring-white/20' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                User
                                            </button>
                                        </div>
                                    </div>

                                </div>

                                <div className="pt-6 border-t border-white/5 flex flex-col gap-3">
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
                                            disabled={isAdminEdit || isTrialRestricted}
                                            className={`flex-[2] py-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-black uppercase text-xs rounded-xl shadow-xl shadow-sky-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${(isAdminEdit || isTrialRestricted) ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
                                        >
                                            <Save size={16} />
                                            {umEditId ? 'Update Identity' : 'Save User Account'}
                                        </button>

                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showOverwriteConfirm && (
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
                )
            }

            {
                showAuthModal && (
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
                )
            }

            {
                showPayrollResetModal && (
                    <div className="fixed inset-0 z-[800] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-amber-500/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                            <button onClick={() => setShowPayrollResetModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close" aria-label="Close Payroll Reset Modal"><X size={20} /></button>
                            <div className="flex flex-col items-center gap-2">
                                <div className="p-3 bg-amber-900/20 text-amber-500 rounded-full border border-amber-900/50 mb-2"><RotateCw size={32} /></div>
                                <h3 className="text-xl font-black text-white text-center">Payroll Reset</h3>
                                <p className="text-xs text-slate-300 text-center">This will <span className="text-amber-400 font-bold">PERMANENTLY DELETE</span> all employees, attendance, and payroll records for the active company.</p>
                            </div>
                            <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Verify Password to Proceed</label>
                                <input type="password" placeholder="Login Password" autoFocus className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono" value={resetPassword} onChange={(e) => { setResetPassword(e.target.value); setResetError(''); }} />
                                {resetError && <p className="text-[10px] text-red-400 font-bold text-center animate-pulse">{resetError}</p>}
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button onClick={() => setShowPayrollResetModal(false)} className="flex-1 py-3 border border-slate-600 rounded-xl text-slate-300 font-bold">Cancel</button>
                                <button onClick={executePayrollReset} className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold uppercase text-xs tracking-widest">Reset Data</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showResetModal && resetMode === 'DEEP' && (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#1e293b] w-full max-w-sm max-h-[90vh] overflow-y-auto custom-scrollbar rounded-2xl border border-pink-500/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                            {!isProcessing && <button onClick={() => setShowResetModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close" aria-label="Close Deep Reset Modal"><X size={20} /></button>}
                            <div className="flex flex-col items-center gap-2">
                                <div className="p-4 bg-pink-900/20 text-pink-500 rounded-full border border-pink-900/50 mb-2"><ShieldAlert size={32} /></div>
                                <h3 className="text-xl font-black text-white text-center italic uppercase tracking-tighter">PURGE COMPANY</h3>
                                <p className="text-xs text-pink-300 text-center leading-relaxed font-medium">
                                    {purgeScope === 'COMPLETE' 
                                        ? `CRITICAL WARNING: This action is IRREVERSIBLE and will permanently delete the selected company and completely wipe its physical folders from disk.`
                                        : `WARNING: This action will remove the selected company from the list of active companies. Its physical database folder will remain intact.`}
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 bg-slate-900/40 p-1.5 rounded-xl border border-slate-800">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-2 pt-1">Select Company to Purge</span>
                                <select
                                    title="Select Company to Purge"
                                    value={targetPurgeCompanyId}
                                    onChange={(e) => setTargetPurgeCompanyId(e.target.value)}
                                    className="w-full bg-[#0f172a] border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 outline-none focus:border-amber-500 transition-colors font-mono"
                                >
                                    {(JSON.parse(localStorage.getItem('app_companies') || '[]'))
                                        .filter((c: any) => c.id !== activeCompanyId)
                                        .map((c: any) => (
                                        <option key={c.id} value={c.id}>
                                            {c.establishmentName} ({c.id})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-2 bg-slate-900/40 p-1.5 rounded-xl border border-slate-800">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-2 pt-1">Purge Method Option</span>
                                <div className="flex flex-col gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setPurgeScope('LIST_ONLY')}
                                        className={`p-2.5 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${purgeScope === 'LIST_ONLY' ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-800 bg-[#0f172a]/30 hover:bg-[#0f172a]/60'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${purgeScope === 'LIST_ONLY' ? 'border-amber-500' : 'border-slate-600'}`}>
                                                {purgeScope === 'LIST_ONLY' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>}
                                            </div>
                                            <span className={`text-[10px] font-black tracking-wide uppercase ${purgeScope === 'LIST_ONLY' ? 'text-amber-400' : 'text-slate-300'}`}>Remove From Active List Only</span>
                                        </div>
                                        <span className="text-[8.5px] text-slate-400 leading-normal pl-5">Removes company from selection list. Hard disk folder remains intact.</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setPurgeScope('COMPLETE')}
                                        className={`p-2.5 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${purgeScope === 'COMPLETE' ? 'border-pink-500/50 bg-pink-500/10' : 'border-slate-800 bg-[#0f172a]/30 hover:bg-[#0f172a]/60'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${purgeScope === 'COMPLETE' ? 'border-pink-500' : 'border-slate-600'}`}>
                                                {purgeScope === 'COMPLETE' && <div className="w-1.5 h-1.5 rounded-full bg-pink-500"></div>}
                                            </div>
                                            <span className={`text-[10px] font-black tracking-wide uppercase ${purgeScope === 'COMPLETE' ? 'text-pink-400' : 'text-slate-300'}`}>Delete Folder Completely</span>
                                        </div>
                                        <span className="text-[8.5px] text-slate-400 leading-normal pl-5">Deletes from selection list AND permanently deletes the data folder from disk.</span>
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                                <input type="password" placeholder="Enter Login Password" title="Password" autoFocus disabled={isProcessing} className={`w-full bg-[#0f172a] border ${resetError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-pink-500 transition-all font-mono`} value={resetPassword} onChange={(e) => { setResetPassword(e.target.value); setResetError(''); }} onKeyDown={(e) => e.key === 'Enter' && executeDeepReset()} />
                                {resetError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{resetError}</p>}
                            </div>
                            <button onClick={executeDeepReset} disabled={isProcessing} className="w-full bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs">
                                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />} {isProcessing ? 'PURGING...' : 'CONFIRM PURGE'}
                            </button>
                        </div>
                    </div>
                )
            }

            {
                showResetModal && resetMode === 'FACTORY' && (
                    <div className="fixed inset-0 z-[800] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#1e293b] w-full max-w-sm rounded-2xl border border-red-500/50 shadow-2xl p-6 flex flex-col gap-4 relative">
                            <button onClick={() => setShowResetModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close" aria-label="Close Factory Reset Modal"><X size={20} /></button>
                            <div className="flex flex-col items-center gap-2">
                                <div className="p-3 bg-red-900/20 text-red-500 rounded-full border border-red-900/50 mb-2"><Trash2 size={32} /></div>
                                <h3 className="text-xl font-black text-white text-center">Factory Reset</h3>
                                <p className="text-xs text-slate-300 text-center text-red-400 font-black uppercase tracking-tighter">Total System Wipe-Out</p>
                                <p className="text-[10px] text-slate-400 text-center">Deletes all companies, users, licenses, and settings. Use only if decommissioning this machine.</p>
                            </div>
                            <div className="space-y-3 mt-2 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Verify Password to Finalize</label>
                                <input type="password" placeholder="Login Password" autoFocus className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-red-500 transition-all font-mono" value={resetPassword} onChange={(e) => { setResetPassword(e.target.value); setResetError(''); }} />
                                {resetError && <p className="text-[10px] text-red-400 font-bold text-center animate-pulse">{resetError}</p>}
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button onClick={() => setShowResetModal(false)} className="flex-1 py-3 border border-slate-600 rounded-xl text-slate-300 font-bold">Cancel</button>
                                <button onClick={executeFactoryReset} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase text-xs tracking-widest italic">Nuclear Wipe</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showSMTPModal && (
                    <SMTPConfigModal onClose={() => setShowSMTPModal(false)} />
                )
            }
        </div >
    );
};

export default Settings;
