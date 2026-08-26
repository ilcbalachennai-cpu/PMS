import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    X, Save, RefreshCw, Loader2, Download, Upload, Trash2, AlertTriangle,
    Database, Users, KeyRound, ShieldCheck, Mail, Megaphone, Building2,
    CalendarClock, Calendar, Phone, Globe, CheckCircle2, AlertCircle, Lock, Plus,
    ImageIcon, Camera, Heart, CheckSquare, Square, Landmark, Table, Calculator,
    ScrollText, HandCoins, Wallet, Scale, RotateCw, RotateCcw, TrendingUp,
    ChevronRight, Shield, Info, Settings as SettingsIcon, Eye, EyeOff, ShieldAlert,
    FolderOpen, FileText, Sparkles
} from 'lucide-react';
import { StatutoryConfig, PFComplianceType, LeavePolicy, CompanyProfile, User, UserPermissions, LicenseData, SettingsTab } from '../types';
import { PT_STATE_PRESETS, INDIAN_STATES, NATURE_OF_BUSINESS_OPTIONS, LWF_STATE_PRESETS, INITIAL_STATUTORY_CONFIG, INITIAL_COMPANY_PROFILE } from '../constants';
import CryptoJS from 'crypto-js';
import {
    fetchLatestMessages, updateDeveloperMessages, activateFullLicense,
    getStoredLicense, isValidKeyFormat, updateCloudPassword, validateLicenseStartup,
    requestResetOTP, verifyResetOTP, sendPolicyConfirmationEmailGAS, getAppDeveloper, APP_VERSION, APP_PATCH_TIMESTAMP
} from '../services/licenseService';
import { formatExpiryDate, formatIndianNumber, formatLicenseKey, generateCompanyId, findMatchingCompanySilo, generateBackupFilename, getCompanyBackupFolder, didConfigCalculationFieldsChange } from '../utils/formatters';
import { getMonthAbbr } from '../services/reportService';
import SMTPConfigModal from './Shared/SMTPConfigModal';
import { executeDiagnosticExport } from '../utils/diagnostics';
import { PartialResetFilters } from '../hooks/usePayrollData';

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
    onPayrollReset: (filters?: PartialResetFilters) => Promise<void>;
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
    onClaimCompany?: () => void;
    availableSlots?: number;
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
    showAlert, verifyLicense, activeCompanyId = 'default', onRescueOrganizations, onClaimCompany, availableSlots,
    globalMonth = 'April', globalYear = 2025, activeFinancialYear, isLicenseExpired,
    latestPatchTimestamp, onNavigate
}) => {
    const isReadOnly = companyProfile?.isReadOnly === true;
    const getCKey = (key: string) => activeCompanyId === 'default' ? key : `${key}_${activeCompanyId}`;
    const getPermission = (key: keyof UserPermissions): boolean => {
        if (!currentUser) return false;
        if (currentUser.role === 'Developer' || currentUser.role === 'Administrator') return true;
        if (!currentUser.permissions) return true; // Legacy fallback
        return !!currentUser.permissions[key];
    };
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
    const [registeredSiloCount, setRegisteredSiloCount] = useState<number | null>(null);

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
        } catch (e) { setEnrolledEmployeeCount(0); }
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

    useEffect(() => {
        const isPermitted = (tab: SettingsTab): boolean => {
            if (tab === SettingsTab.Developer) return userRole === 'Developer';
            if (tab === SettingsTab.Company) return getPermission('configCompanyProfile');
            if (tab === SettingsTab.Statutory) return getPermission('configStatutoryRules');
            if (tab === SettingsTab.Data) return getPermission('configDataManagement');
            if (tab === SettingsTab.License) return getPermission('configLicenseManagement');
            if (tab === SettingsTab.Users) return getPermission('configUserManagement');
            return true;
        };

        if (!isPermitted(activeTab)) {
            const tabsOrder = [
                SettingsTab.Company,
                SettingsTab.Statutory,
                SettingsTab.Data,
                SettingsTab.License,
                SettingsTab.Users,
                SettingsTab.Developer
            ];
            const firstPermitted = tabsOrder.find(t => isPermitted(t));
            if (firstPermitted) {
                setActiveTab(firstPermitted);
                setSettingsTab?.(firstPermitted);
            }
        }
    }, [activeTab, currentUser]);

    const [showBackupModal, setShowBackupModal] = useState(false);
    const [encryptionKey, setEncryptionKey] = useState('');
    const [selectedBackupFile, setSelectedBackupFile] = useState<File | null>(null);
    const [selectedBackupPath, setSelectedBackupPath] = useState<string>('');
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
    const [showRestoreSuccessModal, setShowRestoreSuccessModal] = useState(false);
    const [restoreSuccessSummary, setRestoreSuccessSummary] = useState({ fileName: '', rowCount: 0, timestamp: '' });

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
        } catch (e) { }
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
    const [selectedFromKey, setSelectedFromKey] = useState<string>('ALL');
    const [employeeDojScope, setEmployeeDojScope] = useState<'START_MONTH' | 'NEXT_MONTH' | null>(null);
    const [resetCategories, setResetCategories] = useState({
        payrollHistory: true,
        attendance: true,
        advances: true,
        fines: true,
        arrears: true,
        otRecords: true,
        employees: false,
    });
    const [resetMode, setResetMode] = useState<'DEEP' | 'FACTORY'>('FACTORY');
    const [purgeScope, setPurgeScope] = useState<'LIST_ONLY' | 'COMPLETE'>('LIST_ONLY');
    const [isActivating, setIsActivating] = useState(false);

    const closePayrollResetModal = useCallback(() => {
        setSelectedFromKey('ALL');
        setEmployeeDojScope(null);
        setResetCategories({
            payrollHistory: true,
            attendance: true,
            advances: true,
            fines: true,
            arrears: true,
            otRecords: true,
            employees: false,
        });
        setResetPassword('');
        setResetError('');
        setShowPayrollResetModal(false);
    }, []);

    useEffect(() => {
        if (!showPayrollResetModal) {
            setSelectedFromKey('ALL');
            setEmployeeDojScope(null);
            setResetCategories({
                payrollHistory: true,
                attendance: true,
                advances: true,
                fines: true,
                arrears: true,
                otRecords: true,
                employees: false,
            });
            setResetPassword('');
            setResetError('');
        }
    }, [showPayrollResetModal]);

    // Compute Sequential Periods for Partial Reset
    const MONTH_ORDER = useMemo(() => ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'], []);
    const getPeriodIndex = useCallback((m?: string, y?: any) => {
        if (!m || !y) return 0;
        const idx = MONTH_ORDER.indexOf(m);
        return Number(y) * 12 + (idx >= 0 ? idx : 0);
    }, [MONTH_ORDER]);

    const processedPeriods = useMemo(() => {
        const map = new Map<string, { month: string; year: number; val: number }>();
        
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(k => {
                if (k.startsWith('app_payroll_history') || k.startsWith('app_attendance')) {
                    const item = localStorage.getItem(k);
                    if (item) {
                        try {
                            const parsed = JSON.parse(item);
                            if (Array.isArray(parsed)) {
                                parsed.forEach((rec: any) => {
                                    if (rec && rec.month && rec.year) {
                                        const key = `${rec.month}_${rec.year}`;
                                        if (!map.has(key)) {
                                            map.set(key, { month: rec.month, year: Number(rec.year), val: getPeriodIndex(rec.month, rec.year) });
                                        }
                                    }
                                });
                            }
                        } catch (e) {}
                    }
                }
            });
        } catch (e) {}

        // Always include globalMonth / globalYear (yet to freeze data month)
        if (globalMonth && globalYear) {
            const key = `${globalMonth}_${globalYear}`;
            if (!map.has(key)) {
                map.set(key, { month: globalMonth, year: Number(globalYear), val: getPeriodIndex(globalMonth, globalYear) });
            }
        }

        return Array.from(map.values()).sort((a, b) => a.val - b.val);
    }, [globalMonth, globalYear, showPayrollResetModal, getPeriodIndex]);

    const latestPeriod = useMemo(() => {
        if (processedPeriods.length > 0) {
            return processedPeriods[processedPeriods.length - 1];
        }
        return { month: globalMonth || 'April', year: Number(globalYear || new Date().getFullYear()), val: getPeriodIndex(globalMonth || 'April', globalYear || new Date().getFullYear()) };
    }, [processedPeriods, globalMonth, globalYear, getPeriodIndex]);

    const fromObj = useMemo(() => {
        return processedPeriods.find(p => `${p.month}_${p.year}` === selectedFromKey);
    }, [processedPeriods, selectedFromKey]);

    const [backupMode, setBackupMode] = useState<'EXPORT' | 'IMPORT' | 'MIGRATE' | 'DATAMIGRATE'>('EXPORT');
    const [showPeriodModal, setShowPeriodModal] = useState(false);
    const [migratePeriodType, setMigratePeriodType] = useState<'ALL' | 'PERIOD'>('ALL');
    const [migrateMonth, setMigrateMonth] = useState('April');
    const [migrateYear, setMigrateYear] = useState(new Date().getFullYear());
    // Full Restore period range filter
    const [restorePeriodType, setRestorePeriodType] = useState<'ALL' | 'RANGE'>('ALL');
    const [restoreFromMonth, setRestoreFromMonth] = useState('April');
    const [restoreFromYear, setRestoreFromYear] = useState(new Date().getFullYear());
    const [restoreToMonth, setRestoreToMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));
    const [restoreToYear, setRestoreToYear] = useState(new Date().getFullYear());
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
    const [showPolicyOtpModal, setShowPolicyOtpModal] = useState(false);
    const [pendingBasisChange, setPendingBasisChange] = useState<'LabourCode' | 'OriginalWages' | null>(null);
    const [policyOtp, setPolicyOtp] = useState('');
    const [policyPassword, setPolicyPassword] = useState('');
    const [policyOtpStep, setPolicyOtpStep] = useState<'IDENTIFY' | 'OTP'>('IDENTIFY');
    const [policyError, setPolicyError] = useState('');
    const [isRequestingPolicyOtp, setIsRequestingPolicyOtp] = useState(false);
    const [isVerifyingPolicyChange, setIsVerifyingPolicyChange] = useState(false);
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

        // Fetch activated silos count for display
        if ((window as any).electronAPI?.getActivatedSilos) {
            (window as any).electronAPI.getActivatedSilos().then((res: any) => {
                if (res?.success && Array.isArray(res.silos)) {
                    // Filter out any REVOKE tags from the visible count
                    const activeOnly = res.silos.filter((s: string) => !s.startsWith("REVOKE:"));
                    setRegisteredSiloCount(activeOnly.length);
                }
            }).catch(() => {});
        }
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


    const defaultPermissions: UserPermissions = {
        employeeAdd: false,
        employeeEdit: false,
        processPayroll: false,
        payReports: false,
        statutoryReports: false,
        mis: false,
        ssCode: false,
        utilities: false,
        configCompanyProfile: false,
        configStatutoryRules: false,
        configDataManagement: false,
        configLicenseManagement: false,
        configUserManagement: false,
        dmBackup: false,
        dmRestore: false,
        dmMigrate: false,
        dmPartialReset: false,
        dmRescue: false,
        dmPurge: false,
        dmFactoryReset: false,
        dmDiagnostics: false,
        dmStorageLocation: false,
    };

    const [appUsers, setAppUsers] = useState<User[]>(() => {
        try { return JSON.parse(localStorage.getItem('app_users') || '[]'); } catch { return []; }
    });
    const [umForm, setUmForm] = useState({
        name: '',
        username: '',
        password: '',
        role: 'User' as 'Administrator' | 'User',
        email: '',
        permissions: { ...defaultPermissions } as UserPermissions,
        assignedCompanies: [] as string[],
        showRestrictedUnits: false
    });
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

            const cleanUsername = umForm.username.trim().toUpperCase();
            const existing = appUsers.find(u => (u.username || '').toUpperCase() === cleanUsername && (u.username || '').toUpperCase() !== umEditId?.toUpperCase());
            if (existing) { setUmError('Username already exists.'); return; }

            // --- SINGLE ADMIN ENFORCEMENT ---
            if (umForm.role === 'Administrator' && !canSelectAdminRole) {
                setUmError('Only one Administrator is allowed in the system.');
                return;
            }

            const cleanName = umForm.name.trim().toUpperCase();
            let success = false;
            if (umEditId) {
                const updated = appUsers.map(u => (u.username || '').toUpperCase() === umEditId.toUpperCase() ? { ...u, name: cleanName, username: cleanUsername, password: umForm.password, role: umForm.role, permissions: umForm.role === 'Administrator' ? undefined : umForm.permissions, assignedCompanies: umForm.role === 'Administrator' ? undefined : umForm.assignedCompanies, showRestrictedUnits: umForm.role === 'Administrator' ? undefined : umForm.showRestrictedUnits } : u);
                success = saveAppUsers(updated);
            } else {
                const newUser: User = { name: cleanName, username: cleanUsername, password: umForm.password, role: umForm.role, email: umForm.email, permissions: umForm.role === 'Administrator' ? undefined : umForm.permissions, assignedCompanies: umForm.role === 'Administrator' ? undefined : umForm.assignedCompanies, showRestrictedUnits: umForm.role === 'Administrator' ? undefined : umForm.showRestrictedUnits };
                success = saveAppUsers([...appUsers, newUser]);
            }

            if (success) {
                showAlert('success', 'User Account Saved', `Identity for "${umForm.name}" has been ${umEditId ? 'updated' : 'initialized'} successfully.`);
                setUmForm({ name: '', username: '', password: '', role: 'User', email: '', permissions: { ...defaultPermissions }, assignedCompanies: [], showRestrictedUnits: false });
                setUmEditId(null);
                setUmShowPwd(false);
            } else {
                setUmError('Data synchronization failed.');
            }
        } catch (err: any) {
            setUmError(`System Error: ${err.message}`);
        }
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
            let pathVal = (file as any).path || (file as any).filePath || '';
            if (!pathVal && (window.electronAPI as any)?.getPathForFile) {
                try { pathVal = (window.electronAPI as any).getPathForFile(file); } catch (_) {}
            }
            setSelectedBackupPath(pathVal);
            const name = file.name.toUpperCase();
            const isSqlite = name.endsWith('.sqlite') || name.includes('_BC_') || name.includes('_AC_');
            setIsSqliteFile(isSqlite);

            // If we are in MIGRATE or DATAMIGRATE mode, keep it. Otherwise default to standard IMPORT.
            setBackupMode(prev => (prev === 'MIGRATE' || prev === 'DATAMIGRATE') ? prev : 'IMPORT');
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

        // Use overrideKey if provided (from direct PIN parameter or OTP recovery)
        const activeKey = (overrideKey && overrideKey.trim()) ? overrideKey.trim() : (encryptionKey ? encryptionKey.trim() : '');

        // --- FORMAT DETECTION: Determine if the file is a binary SQLite-based archive ---
        // Priority order:
        //  1. If filename contains _BC_ or _AC_ → always SQLite binary (BC/AC auto-backup)
        //  2. If filename ends with .sqlite → plain SQLite
        //  3. Read first 16 bytes of the file:
        //     a. Starts with 'SQLite format 3' → plain SQLite
        //     b. Contains any non-printable byte → binary-encrypted SQLite (new AES-256-CBC format OR old BC/AC)
        //     c. All printable ASCII (Base64) → legacy CryptoJS blob (old full backup format)
        // NOTE: The old rule "PIN entered = CryptoJS" is REMOVED. New full backups are binary AND use a PIN.
        // All modern BPP backup archives (.enc and .sqlite) are processed by SQLite IPC handler
        let detectedAsSqlite = true;

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

                const isRangeRestore = backupMode === 'IMPORT' && restorePeriodType === 'RANGE';
                const resolvedPath = selectedBackupPath || ((window.electronAPI as any)?.getPathForFile && file instanceof File
                    ? ((window.electronAPI as any).getPathForFile(file) || (file as any).path || (file as any).filePath)
                    : ((file as any).path || (file as any).filePath || file.name));

                console.log(`[RESTORE] Executing restore for path: "${resolvedPath}"`);

                // ── Helper: calls the restore IPC, optionally with forceConfirm ─────────────
                const callRestoreIPC = (forceConfirm: boolean) =>
                    window.electronAPI.restoreSqliteBackup({
                        path: resolvedPath,
                        encryptionKey: licenseKey,
                        isMigration: backupMode === 'DATAMIGRATE',
                        forceConfirm,
                        ...(isRangeRestore ? {
                            fromPeriod: { month: restoreFromMonth, year: restoreFromYear },
                            toPeriod:   { month: restoreToMonth,   year: restoreToYear   },
                        } : {}),
                    });

                let res = await callRestoreIPC(false);

                // ── Blank-Field Warning Gate ──────────────────────────────────────────────────
                // If the IPC found blank mandatory fields (PAN/CIN/PF Code/ESI Code),
                // it returns requiresConfirmation=true with a warnings list.
                // Show the user a confirm dialog: Accept → proceed with forceConfirm, Reject → abort.
                if (!res.success && (res as any).requiresConfirmation) {
                    const blankWarnings: string[] = (res as any).warnings || [];
                    setIsProcessing(false);
                    showAlert?.(
                        'confirm',
                        '⚠ Incomplete Mandatory Profile Fields',
                        (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-300">
                                    The following <span className="text-amber-400 font-bold">mandatory fields</span> are blank or missing in the backup / company profile:
                                </p>
                                <ul className="space-y-1">
                                    {blankWarnings.map((w, i) => (
                                        <li key={i} className="flex items-start gap-2 text-[11px] font-mono text-amber-300 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-1.5">
                                            <span className="text-amber-500 shrink-0">⚠</span>
                                            <span>{w}</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-[11px] text-slate-400 italic">
                                    Proceeding without these fields may cause verification issues in future payroll operations.
                                    It is strongly recommended to complete the Company Profile before restoring.
                                </p>
                            </div>
                        ),
                        // onConfirm → user accepted, retry with forceConfirm
                        async () => {
                            setIsProcessing(true);
                            setProcessProgress(40);
                            setProcessStatus('Proceeding with confirmed restore...');
                            try {
                                const confirmedRes = await callRestoreIPC(true);
                                if (!confirmedRes.success) {
                                    throw new Error(confirmedRes.error || 'Restore failed after confirmation.');
                                }
                                setProcessProgress(100);
                                setIsProcessing(false);
                                setShowBackupModal(false);
                                const fileLabel = selectedBackupFile?.name || 'Backup Archive';
                                setSelectedBackupFile(null);
                                setSelectedBackupPath('');
                                setEncryptionKey('');
                                sessionStorage.setItem('settings_initial_tab', 'DATA');
                                setRestoreSuccessSummary({
                                    fileName: fileLabel,
                                    rowCount: 0,
                                    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                });
                                setShowRestoreSuccessModal(true);
                            } catch (confirmErr: any) {
                                setIsProcessing(false);
                                setShowBackupModal(false);
                                setSelectedBackupFile(null);
                                setSelectedBackupPath('');
                                setEncryptionKey('');
                                setActiveTab(SettingsTab.Data);
                                setSettingsTab?.(SettingsTab.Data);
                                const isBlocked = confirmErr.message?.includes("Universal Restoration Blocked") || confirmErr.message?.includes("Blocked");
                                const alertTitle = isBlocked ? 'Restore Blocked' : 'Restoration Failed';
                                const alertBody = isBlocked ? confirmErr.message : `Restore Error: ${confirmErr.message}`;
                                showAlert?.('error', alertTitle, alertBody);
                            }
                        },
                        // onCancel → user rejected, stay on backup modal
                        undefined,
                        'Accept & Proceed',
                        'Reject & Abort'
                    );
                    return; // stop — user will decide via the confirm dialog
                }


                if (res.success) {
                    const isExcludedRestoreKey = (k: string): boolean => {
                        const excludedBase = [
                            'app_license_secure', 
                            'app_license_data', 
                            'app_users', 
                            'app_machine_id', 
                            'app_developer_secure',
                            'app_data_size',
                            'app_companies',
                            'app_active_company_id'
                        ];
                        if (excludedBase.includes(k)) return true;
                        if (k.startsWith('app_company_profile') || k.startsWith('company_profile')) return true;
                        if (k.startsWith('app_config_') || k === 'app_config') return true;
                        if (k.startsWith('app_license') || k.startsWith('app_user') || k.includes('sys_limit')) return true;
                        return false;
                    };

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
                    
                    const isPeriodMigration = backupMode === 'DATAMIGRATE' && migratePeriodType === 'PERIOD';
                    const transactionalPrefixes = [
                        'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers',
                        'app_payroll_history', 'app_fines', 'app_arrear_history', 'app_ot_records'
                    ];

                    Object.keys(localStorage).forEach(key => {
                        const isGlobalAppData = key.startsWith('app_') && !key.includes('_company_');
                        const isThisCompanyData = key.endsWith(`_${activeCompanyId}`);

                        if ((isGlobalAppData || isThisCompanyData) && !protectedKeys.includes(key)) {
                            // V06.01.13: DO NOT wipe local configuration, profile, and user settings!
                            if (isExcludedRestoreKey(key)) {
                                return; // Preserve this local key!
                            }
                            // V06.01.13: For period-specific migration, DO NOT wipe local transactional ledgers from localStorage!
                            if (isPeriodMigration) {
                                const isTxKey = transactionalPrefixes.some(pref => key.startsWith(pref));
                                if (isTxKey) return; // Preserve this local ledger!
                            }
                            localStorage.removeItem(key);
                        }
                    });



                    const recordMatchesPeriod = (itm: any, tMonth: string, tYear: number): boolean => {
                        if (!itm) return false;
                        const m = itm.month || itm.Month;
                        const y = parseInt(itm.year || itm.Year);
                        if (m && !isNaN(y)) {
                            return String(m).trim().toLowerCase() === tMonth.trim().toLowerCase() && y === tYear;
                        }
                        const dateStr = itm.date || itm.Date || itm.createdDate || itm.entryDate;
                        if (dateStr && typeof dateStr === 'string') {
                            try {
                                if (dateStr.includes('-')) {
                                    const parts = dateStr.split('-');
                                    if (parts.length === 3) {
                                        let dMonth = 0, dYear = 0;
                                        if (parts[0].length === 4) { // yyyy-mm-dd
                                            dYear = parseInt(parts[0]);
                                            dMonth = parseInt(parts[1]) - 1;
                                        } else { // dd-mm-yyyy
                                            dYear = parseInt(parts[2]);
                                            dMonth = parseInt(parts[1]) - 1;
                                        }
                                        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                                        return months[dMonth]?.toLowerCase() === tMonth.toLowerCase() && dYear === tYear;
                                    }
                                }
                            } catch (e) {}
                        }
                        return false;
                    };

                    // 2. Fetch ALL data from the restored SQLite DB
                    const dbRes = await window.electronAPI.dbGetAll();
                    if (dbRes.success && Array.isArray(dbRes.data)) {
                        for (const item of dbRes.data) {
                            const storageKey = item.key;
                            
                            // V06.01.13: For both Standard Restore and Data Migration, strictly protect local profile, config, user logins, and licenses
                            if (isExcludedRestoreKey(storageKey)) {
                                console.log(`[RESTORE] Preserved local configuration/license key: ${storageKey}`);
                                continue;
                            }
                            
                            let valToSet = item.value;
                            let parsedVal = typeof item.value === 'string' ? (() => { try { return JSON.parse(item.value); } catch { return item.value; } })() : item.value;
                            
                            // V06.01.13: Period-Specific Ledger Merging
                            if (isPeriodMigration && Array.isArray(parsedVal)) {
                                const isTransactional = transactionalPrefixes.some(pref => storageKey.startsWith(pref));
                                if (isTransactional && storageKey.endsWith(`_${activeCompanyId}`)) {
                                    const localRaw = localStorage.getItem(storageKey);
                                    let localArray: any[] = [];
                                    try {
                                        localArray = localRaw ? JSON.parse(localRaw) : [];
                                    } catch (e) {}
                                    if (!Array.isArray(localArray)) localArray = [];
                                    
                                    // Preserve local records for other months
                                    const preservedLocal = localArray.filter(r => !recordMatchesPeriod(r, migrateMonth, migrateYear));
                                    // Import only target month records from backup
                                    const incomingMigrated = parsedVal.filter(r => recordMatchesPeriod(r, migrateMonth, migrateYear));
                                    
                                    valToSet = [...preservedLocal, ...incomingMigrated];
                                    
                                    // Update combined data back into SQLite database so it matches localStorage!
                                    if (window.electronAPI?.dbSet) {
                                        try {
                                            await window.electronAPI.dbSet(storageKey, valToSet);
                                        } catch (dbErr) {
                                            console.error(`Failed to update SQLite on period merge for ${storageKey}:`, dbErr);
                                        }
                                    }
                                }
                            }
                            
                            try {
                                localStorage.setItem(storageKey, typeof valToSet === 'string' ? valToSet : JSON.stringify(valToSet));
                            } catch (quotaErr) {
                                console.warn(`[RESTORE] LocalStorage write skipped for key ${storageKey}:`, quotaErr);
                            }
                        }

                        // Clear temp payroll calculations & calc caches so stale draft calculations don't override migrated data
                        Object.keys(localStorage).forEach(k => {
                            if (k.startsWith('app_temp_payroll_') || k.startsWith('app_calc_')) {
                                localStorage.removeItem(k);
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
                    const fileLabel = selectedBackupFile?.name || 'Backup Archive';
                    const recordCount = (dbRes && Array.isArray(dbRes.data)) ? dbRes.data.length : 0;
                    setSelectedBackupFile(null);
                    setSelectedBackupPath('');
                    setEncryptionKey('');
                    sessionStorage.setItem('settings_initial_tab', 'DATA');
                    setRestoreSuccessSummary({
                        fileName: fileLabel,
                        rowCount: recordCount,
                        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    });
                    setShowRestoreSuccessModal(true);
                    return;
                } else {
                    throw new Error(res.error || "Failed to restore database file.");
                }
            } catch (err: any) {
                setIsProcessing(false);
                setShowBackupModal(false);
                setSelectedBackupFile(null);
                setSelectedBackupPath('');
                setEncryptionKey('');
                setActiveTab(SettingsTab.Data);
                setSettingsTab?.(SettingsTab.Data);
                const isDecryptionError = err.message.includes("Decryption failed") || err.message.includes("Invalid key");
                const isBlocked = err.message?.includes("Universal Restoration Blocked") || err.message?.includes("Blocked");

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
                    const alertTitle = isBlocked ? 'Restore Blocked' : 'Restoration Failed';
                    const alertBody = isBlocked ? err.message : `Restore Error: ${err.message}`;
                    showAlert?.('error', alertTitle, alertBody);
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

                // V03.01.07: Company ID & Silo Signature Check
                const isDataMigration = backupMode === 'DATAMIGRATE';
                const rawProfile = data.company_profile || data.companyProfile || data.app_company_profile || {};
                const backupCompanyId = rawProfile.id;

                const companiesListRaw = localStorage.getItem('app_companies');
                let companiesList: any[] = [];
                try { companiesList = companiesListRaw ? JSON.parse(companiesListRaw) : []; } catch (e) { }

                const existingMatch = findMatchingCompanySilo(rawProfile, companiesList);

                let targetId = activeCompanyId !== 'default' 
                    ? activeCompanyId 
                    : (existingMatch ? existingMatch.id : (backupCompanyId || generateCompanyId(rawProfile.establishmentName || 'COMPANY')));
                let conflictMessage = "";

                if (isDataMigration) {
                    targetId = (activeCompanyId && activeCompanyId !== 'default') ? activeCompanyId : (existingMatch ? existingMatch.id : (backupCompanyId || targetId));
                    conflictMessage = `DATA MIGRATION ACTIVE: Machine B Target Company Profile (${targetId}), Password & Credentials Preserved 100%.`;
                } else {
                    // Universal Restoration must strictly belong to the same machine and company silo!
                    const backupMachineId = data.app_origin_machine_id || data.app_machine_id;
                    const currentMachineId = window.electronAPI ? await window.electronAPI.getMachineId() : localStorage.getItem('app_machine_id');

                    if (!backupMachineId) {
                        throw new Error(`Universal Restoration Blocked — Backup file lacks local machine ownership signature. Universal Restoration works ONLY for backups created on this local machine. To import data from another machine or external source, please use 'Data Migration' under Utilities.`);
                    }

                    if (!currentMachineId || String(backupMachineId).trim().toUpperCase() !== String(currentMachineId).trim().toUpperCase()) {
                        throw new Error(`Universal Restoration Blocked — Data backup file does not belong to this Machine. This backup file was generated on another computer. Universal Restoration works ONLY for backups created on this local machine. To import data from another machine, please use 'Data Migration' under Utilities.`);
                    }

                    const bIdClean = String(backupCompanyId || '').trim().toUpperCase();
                    const aIdClean = String(activeCompanyId || '').trim().toUpperCase();
                    if (bIdClean && aIdClean && aIdClean !== 'DEFAULT' && bIdClean !== aIdClean) {
                        throw new Error(`Universal Restoration Blocked — This backup file belongs to company silo '${backupCompanyId}', which does not match active company silo '${activeCompanyId}'. Universal Restoration works only for backups created on the same company silo. Please use 'Data Migration' under Utilities to import data from another machine.`);
                    }
                    console.log(`[RESTORE] Universal Restoration matching Silo ID: ${targetId}`);
                    conflictMessage = `Restoring from backup "${targetId}". Full company entity overwrite for recovery.`;
                }

                const targetCompanyObj = {
                    ...INITIAL_COMPANY_PROFILE,
                    ...(companyProfile || {}),
                    ...(profileData || {}),
                    ...(companiesList.find((c: any) => c.id === targetId) || {})
                };

                const companyExists = companiesList.some((c: any) => c.id === targetId);

                const proceedWithRestore = async () => {
                    setIsProcessing(true);

                    // --- AUTOMATIC PRE-MIGRATION SAFETY SNAPSHOT ---
                    setProcessStatus('Creating Pre-Migration Safety Snapshot...');
                    try {
                        const getMergedData = (baseKey: string) => {
                            const fullKey = activeFinancialYear && [
                                'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers',
                                'app_payroll_history', 'app_fines', 'app_arrear_history', 'app_ot_records'
                            ].includes(baseKey) ? `${baseKey}_${activeFinancialYear}_${targetId}` : `${baseKey}_${targetId}`;
                            const raw = localStorage.getItem(fullKey);
                            try { return raw ? JSON.parse(raw) : []; } catch { return []; }
                        };

                        const preMigrationSnapshot = {
                            companyId: targetId,
                            timestamp: new Date().toISOString(),
                            profile: localStorage.getItem(`app_company_profile_${targetId}`),
                            employees: getMergedData('app_employees'),
                            attendance: getMergedData('app_attendance'),
                            leave_ledgers: getMergedData('app_leave_ledgers'),
                            advance_ledgers: getMergedData('app_advance_ledgers'),
                            payroll_history: getMergedData('app_payroll_history'),
                            fines: getMergedData('app_fines'),
                            ot_records: getMergedData('app_ot_records')
                        };

                        const snapshotKey = `app_safety_snapshot_${targetId}`;
                        localStorage.setItem(snapshotKey, JSON.stringify(preMigrationSnapshot));
                        if (window.electronAPI?.dbSet) {
                            await window.electronAPI.dbSet(snapshotKey, preMigrationSnapshot).catch(() => {});
                        }
                        console.log(`[SAFETY SNAPSHOT] Pre-migration snapshot saved successfully for ${targetId}`);
                    } catch (snapErr) {
                        console.warn(`[SAFETY SNAPSHOT] Failed to create pre-migration snapshot:`, snapErr);
                    }

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
                    if (!isDataMigration && window.electronAPI && (window.electronAPI as any).wipeCompanyData) {
                        try {
                            const wipeRes = await (window.electronAPI as any).wipeCompanyData(targetId);
                            console.log(`[RESTORE] SQLite wipe complete. Rows purged: ${wipeRes.changes ?? 'n/a'}`);
                        } catch (err) {
                            console.warn(`[RESTORE] wipeCompanyData failed:`, err);
                        }
                    }

                    if (window.electronAPI?.switchCompanyData) {
                        await window.electronAPI.switchCompanyData(targetId);
                    }

                    // Preserve Machine B target company profile for 100% safety during Data Migration
                    const preservedTargetProfile = isDataMigration ? { ...(targetCompanyObj || profileData) } : null;

                    if (!isDataMigration) {
                        Object.keys(localStorage).forEach(key => {
                            if (key.endsWith(`_${targetId}`)) {
                                localStorage.removeItem(key);
                            }
                        });
                    }

                    const keyMap: Record<string, string[]> = {
                        'employees': ['employees', 'app_employees', 'employee_master', 'employeeMaster'],
                        'config': ['config', 'app_config', 'statutory_config'],
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
                        'logo': ['logo', 'app_logo']
                    };

                    if (!isDataMigration) {
                        keyMap['company_profile'] = ['company_profile', 'companyProfile', 'app_company_profile'];
                    }

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
                                    // Preserve local machine signature if present, but restore all establishment details (Name, Trade Name, PAN, TAN, Address, Statutory Rules)
                                    const existingProfileRaw = localStorage.getItem(getCKey('app_company_profile'));
                                    let localSignature = "";
                                    if (existingProfileRaw) {
                                        try {
                                            const existingProfile = JSON.parse(existingProfileRaw);
                                            localSignature = existingProfile.companySignature || "";
                                        } catch(e) {}
                                    }
                                    const profileToSave = {
                                        ...INITIAL_COMPANY_PROFILE,
                                        ...val,
                                        id: targetId,
                                        companySignature: localSignature || val.companySignature || ""
                                    };
                                    const existingIdx = companiesList.findIndex((c: any) => c.id === targetId);
                                    if (existingIdx !== -1) {
                                        companiesList[existingIdx] = profileToSave;
                                    } else {
                                        companiesList.push(profileToSave);
                                    }
                                    localStorage.setItem('app_companies', JSON.stringify(companiesList));
                                    localStorage.setItem(getCKey('app_company_profile'), JSON.stringify(profileToSave));
                                    if (window.electronAPI?.dbSet) {
                                        await window.electronAPI.dbSet(getCKey('app_company_profile'), profileToSave);
                                    }
                                } else {
                                    if (Array.isArray(val) && targetId !== 'default') {
                                        val = val.map((item: any) => ({ ...item, companyId: targetId }));
                                    }

                                    const isPeriodMigration = isDataMigration && migratePeriodType === 'PERIOD';
                                    const recordMatchesPeriod = (itm: any, tMonth: string, tYear: number): boolean => {
                                        if (!itm) return false;
                                        const targetY = Number(tYear);
                                        const targetM = String(tMonth).trim().toLowerCase();
                                        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
                                        const targetMonthIdx = monthNames.findIndex(m => m === targetM || m.startsWith(targetM) || targetM.startsWith(m));

                                        const rawM = String(itm.month || itm.Month || itm.payrollMonth || '').trim().toLowerCase();
                                        const rawY = Number(itm.year || itm.Year || itm.payrollYear || 0);

                                        if (rawM && rawY > 0) {
                                            if (rawY === targetY) {
                                                const rawMonthIdx = monthNames.findIndex(m => rawM.includes(m) || m.includes(rawM));
                                                if (rawMonthIdx !== -1 && targetMonthIdx !== -1) {
                                                    return rawMonthIdx === targetMonthIdx;
                                                }
                                                const numM = parseInt(rawM);
                                                if (!isNaN(numM) && targetMonthIdx !== -1) {
                                                    return (numM - 1) === targetMonthIdx;
                                                }
                                                if (rawM === targetM) return true;
                                            }
                                        }

                                        const dateStr = String(itm.date || itm.Date || itm.entryDate || itm.createdDate || '').trim();
                                        if (dateStr && dateStr.includes('-')) {
                                            const parts = dateStr.split('-');
                                            if (parts.length === 3) {
                                                let dYear = 0, dMonthIdx = -1;
                                                if (parts[0].length === 4) {
                                                    dYear = parseInt(parts[0]);
                                                    dMonthIdx = parseInt(parts[1]) - 1;
                                                } else if (parts[2].length === 4) {
                                                    dYear = parseInt(parts[2]);
                                                    dMonthIdx = parseInt(parts[1]) - 1;
                                                }
                                                if (dYear === targetY && dMonthIdx === targetMonthIdx) {
                                                    return true;
                                                }
                                            }
                                        }
                                        return false;
                                    };

                                    const transactionalKeys = [
                                        'attendance', 'leave_ledgers', 'advance_ledgers',
                                        'payroll_history', 'fines', 'arrear_history', 'ot_records'
                                    ];

                                    if (transactionalKeys.includes(storageKey) && Array.isArray(val)) {
                                        // Purge legacy un-scoped key for this transactional storageKey to prevent JIT Partitioning from overwriting migrated FY keys on reload
                                        if (isDataMigration) {
                                            const legacyUnscopedKey = `app_${storageKey}_${targetId}`;
                                            const legacyFlatKey = `app_${storageKey}`;
                                            localStorage.removeItem(legacyUnscopedKey);
                                            localStorage.removeItem(legacyFlatKey);
                                            if (window.electronAPI?.dbDelete) {
                                                await window.electronAPI.dbDelete(legacyUnscopedKey).catch(() => {});
                                                await window.electronAPI.dbDelete(legacyFlatKey).catch(() => {});
                                            }
                                        }

                                        // 1. Data Normalization for incoming backup items
                                        let itemsToMigrate = val.map((item: any) => {
                                            const normalized = { ...item };
                                            if (normalized.year !== undefined) normalized.year = Number(normalized.year);
                                            if (normalized.month !== undefined) {
                                                let mStr = String(normalized.month).trim();
                                                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                                                const mIdx = monthNames.findIndex(mn => mn.toLowerCase() === mStr.toLowerCase() || mn.toLowerCase().startsWith(mStr.toLowerCase()) || mStr.toLowerCase().startsWith(mn.toLowerCase()));
                                                if (mIdx !== -1) {
                                                    mStr = monthNames[mIdx];
                                                } else {
                                                    const numM = parseInt(mStr);
                                                    if (!isNaN(numM) && numM >= 1 && numM <= 12) {
                                                        mStr = monthNames[numM - 1];
                                                    }
                                                }
                                                normalized.month = mStr;
                                            }
                                            
                                            const rawPresent = normalized.presentDays ?? normalized.present_days ?? normalized['Paid Days'] ?? normalized.paidDays ?? normalized.Present ?? normalized.present ?? normalized.paid_days;
                                            if (rawPresent !== undefined && rawPresent !== null && rawPresent !== '') {
                                                normalized.presentDays = Number(rawPresent);
                                            }
                                            const rawLop = normalized.lopDays ?? normalized.lop_days ?? normalized.LOP ?? normalized.lop ?? normalized['Loss of Pay'] ?? normalized.absent ?? normalized.absentDays;
                                            if (rawLop !== undefined && rawLop !== null && rawLop !== '') {
                                                normalized.lopDays = Number(rawLop);
                                            }
                                            const rawEL = normalized.earnedLeave ?? normalized.earned_leave ?? normalized.EL ?? normalized.el ?? normalized['EL (Availed)'];
                                            if (rawEL !== undefined && rawEL !== null && rawEL !== '') normalized.earnedLeave = Number(rawEL);

                                            const rawSL = normalized.sickLeave ?? normalized.sick_leave ?? normalized.SL ?? normalized.sl ?? normalized['SL (Sick)'];
                                            if (rawSL !== undefined && rawSL !== null && rawSL !== '') normalized.sickLeave = Number(rawSL);

                                            const rawCL = normalized.casualLeave ?? normalized.casual_leave ?? normalized.CL ?? normalized.cl ?? normalized['CL (Casual)'];
                                            if (rawCL !== undefined && rawCL !== null && rawCL !== '') normalized.casualLeave = Number(rawCL);

                                            return normalized;
                                        });

                                        // 2. Filter for SPECIFIC PERIOD migration if selected
                                        if (isPeriodMigration) {
                                            itemsToMigrate = itemsToMigrate.filter(item => recordMatchesPeriod(item, migrateMonth, migrateYear));
                                        }

                                        const partitions: Record<string, any[]> = {};
                                        itemsToMigrate.forEach((item: any) => {
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

                                        // Safe Fallback: If no partitions were resolved, but itemsToMigrate has elements and storageKey is a ledger key
                                        if (Object.keys(partitions).length === 0 && itemsToMigrate.length > 0 && activeFinancialYear && (storageKey === 'leave_ledgers' || storageKey === 'advance_ledgers')) {
                                            partitions[activeFinancialYear] = itemsToMigrate;
                                        }

                                        if (activeFinancialYear && !partitions[activeFinancialYear]) {
                                            partitions[activeFinancialYear] = [];
                                        }

                                        for (const [fy, partitionVal] of Object.entries(partitions)) {
                                            const targetKey = `app_${storageKey}_${fy}_${targetId}`;
                                            const localRaw = localStorage.getItem(targetKey);
                                            let localArray: any[] = [];
                                            try { localArray = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
                                            if (!Array.isArray(localArray)) localArray = [];

                                            let finalPartitionVal: any[] = [];

                                            if (isPeriodMigration) {
                                                // Preserve Machine B local records for other months, replace target period records with incoming migrated records
                                                const preservedLocal = localArray.filter(r => !recordMatchesPeriod(r, migrateMonth, migrateYear));
                                                finalPartitionVal = [...preservedLocal, ...partitionVal];
                                            } else {
                                                // ALL HISTORY mode: Merge incoming backup records into local array by matching employeeId and month/year (or employeeId for ledgers)
                                                finalPartitionVal = [...localArray];
                                                partitionVal.forEach((incoming: any) => {
                                                    const idx = finalPartitionVal.findIndex(existing => {
                                                        if (incoming.employeeId) {
                                                            if (incoming.month || incoming.Month || incoming.date) {
                                                                return existing.employeeId === incoming.employeeId && recordMatchesPeriod(existing, incoming.month, incoming.year);
                                                            }
                                                            return existing.employeeId === incoming.employeeId;
                                                        }
                                                        return false;
                                                    });
                                                    if (idx !== -1) {
                                                        finalPartitionVal[idx] = { ...finalPartitionVal[idx], ...incoming };
                                                    } else {
                                                        finalPartitionVal.push(incoming);
                                                    }
                                                });
                                            }

                                            try {
                                                localStorage.setItem(targetKey, JSON.stringify(finalPartitionVal));
                                            } catch (e) {
                                                console.warn(`[RESTORE] LocalStorage partition write failed for ${targetKey}`, e);
                                            }
                                            if (window.electronAPI?.dbSet) {
                                                try {
                                                    await window.electronAPI.dbSet(targetKey, finalPartitionVal);
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

                    if (isDataMigration && preservedTargetProfile) {
                        localStorage.setItem(getCKey('app_company_profile'), JSON.stringify(preservedTargetProfile));
                        setProfileData(preservedTargetProfile);
                        setCompanyProfile(preservedTargetProfile);
                        if (window.electronAPI?.dbSet) {
                            await window.electronAPI.dbSet(getCKey('app_company_profile'), preservedTargetProfile).catch(() => {});
                        }

                        const updatedCompaniesList = companiesList.map((c: any) => c.id === targetId ? preservedTargetProfile : c);
                        if (!updatedCompaniesList.some((c: any) => c.id === targetId)) {
                            updatedCompaniesList.push(preservedTargetProfile);
                        }
                        localStorage.setItem('app_companies', JSON.stringify(updatedCompaniesList));
                        if ((window as any).electronAPI?.dbSetGlobal) {
                            await (window as any).electronAPI.dbSetGlobal('app_companies', updatedCompaniesList).catch(() => {});
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
                        showAlert?.('success', isDataMigration ? 'Payroll Data Migration Successful' : 'Universal Restoration Successful', (
                            <div className="space-y-3 text-left">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`p-2 rounded-full border ${isDataMigration ? 'bg-violet-500/20 border-violet-500/30' : 'bg-emerald-500/20 border-emerald-500/30'}`}>
                                        <CheckCircle2 size={24} className={isDataMigration ? 'text-violet-400' : 'text-emerald-400'} />
                                    </div>
                                    <h4 className="text-lg font-black text-white uppercase tracking-tighter">
                                        {isDataMigration ? 'Payroll Data Migration Complete' : 'Full Company Restoration Complete'}
                                    </h4>
                                </div>
                                <div className={`p-4 ${isDataMigration ? 'bg-[#0a0514]/90 border-violet-900/60' : 'bg-slate-900/50 border-slate-800'} border rounded-xl space-y-4`}>
                                    <p className="text-xs text-slate-300 leading-relaxed font-medium italic">
                                        {isDataMigration
                                            ? `Successfully migrated ${restoredCount} payroll data silos from the provided .enc backup file into ${companiesList.find(c => c.id === targetId)?.establishmentName || targetId}.`
                                            : `Successfully restored ${restoredCount} data silos from the provided .enc backup file into ${companiesList.find(c => c.id === targetId)?.establishmentName || targetId}.`
                                        }
                                    </p>
                                    <div className={`flex items-center gap-2 px-3 py-2 ${isDataMigration ? 'bg-violet-500/10 border-violet-500/20' : 'bg-blue-500/10 border-blue-500/20'} border rounded-lg`}>
                                        <AlertCircle size={14} className={isDataMigration ? 'text-violet-400 shrink-0' : 'text-blue-400 shrink-0'} />
                                        <p className={`text-[10px] font-bold uppercase tracking-widest ${isDataMigration ? 'text-violet-300' : 'text-blue-400'}`}>{conflictMessage}</p>
                                    </div>
                                    <div className="h-px bg-slate-800/80 w-full" />
                                    <div className="space-y-1">
                                        <span className="text-[9px] text-slate-500 uppercase font-black block mb-1">
                                            {isDataMigration ? 'Migrated Records Breakdown' : 'Restored Records Breakdown'}
                                        </span>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-2 p-2 bg-slate-950/50 rounded-lg border border-slate-800/50">
                                            <div className="flex justify-between items-center text-[10px]">
                                                <span className="text-slate-400 capitalize">Company Profile</span>
                                                <span className={isDataMigration ? "text-sky-400 font-bold" : "text-emerald-400 font-bold"}>
                                                    {isDataMigration ? "Verified & Preserved (Protected)" : "OK"}
                                                </span>
                                            </div>
                                            {Object.entries(restoredData).map(([silo, details]: [string, any]) => (
                                                silo !== 'company_profile' && (
                                                    <div key={silo} className="flex justify-between items-center text-[10px]">
                                                        <span className="text-slate-400 capitalize">{silo.replace('_', ' ')}</span>
                                                        <span className="text-emerald-400 font-bold">
                                                            {Array.isArray(details) ? `${details.length} Recs` : 'OK'}
                                                        </span>
                                                    </div>
                                                )
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
                        ), async () => {
                            if (window.electronAPI && window.electronAPI.switchCompanyData) {
                                try {
                                    await window.electronAPI.switchCompanyData(targetId);
                                } catch(e) {}
                            }
                            onRestore();
                        });
                    }, 100);
                };

                // --- DATA MIGRATION: 5-FIELD IDENTITY PRE-CHECK ---
                if (isDataMigration && targetCompanyObj) {
                    const legalMismatches: string[] = [];
                    const contactMismatches: string[] = [];
                    const cleanStr = (val: any) => String(val || '').trim().toUpperCase();
                    const getProfileEmail = (p: any) => String(p?.email || p?.officialEmail || p?.senderEmail || p?.smtpUser || p?.contactEmail || '').trim().toLowerCase();
                    const getProfileMobile = (p: any) => String(p?.mobile || p?.contactMobile || p?.registeredMobile || p?.phone || '').trim();

                    // 1. Company Silo ID Check (LEGAL - STRICT)
                    const backupSiloCore = cleanStr(rawProfile.id).replace(/[^A-Z0-9]/g, '');
                    const targetSiloCore = cleanStr(targetCompanyObj.id).replace(/[^A-Z0-9]/g, '');
                    if (backupSiloCore && targetSiloCore && !backupSiloCore.includes(targetSiloCore) && !targetSiloCore.includes(backupSiloCore)) {
                        legalMismatches.push(`Company Silo ID: Backup (${rawProfile.id || 'N/A'}) !== Machine B (${targetCompanyObj.id || 'N/A'})`);
                    }

                    // 2. Company Name Check (LEGAL - STRICT)
                    if (cleanStr(rawProfile.establishmentName) !== cleanStr(targetCompanyObj.establishmentName)) {
                        legalMismatches.push(`Company Name: Backup ("${rawProfile.establishmentName || 'N/A'}") !== Machine B ("${targetCompanyObj.establishmentName || 'N/A'}")`);
                    }

                    // 3. CIN Number Check (LEGAL - STRICT)
                    if (cleanStr(rawProfile.cin) !== cleanStr(targetCompanyObj.cin)) {
                        legalMismatches.push(`CIN Number: Backup (${rawProfile.cin || 'N/A'}) !== Machine B (${targetCompanyObj.cin || 'N/A'})`);
                    }

                    // 4. PAN Number Check (LEGAL - STRICT)
                    if (cleanStr(rawProfile.pan) !== cleanStr(targetCompanyObj.pan)) {
                        legalMismatches.push(`PAN Number: Backup (${rawProfile.pan || 'N/A'}) !== Machine B (${targetCompanyObj.pan || 'N/A'})`);
                    }

                    // 5. Official Mail ID Check (CONTACT - WARNING ONLY)
                    const backupEmail = getProfileEmail(rawProfile);
                    const targetEmail = getProfileEmail(targetCompanyObj);
                    if (backupEmail && targetEmail && backupEmail !== targetEmail) {
                        contactMismatches.push(`Official Mail ID: Backup (${backupEmail}) !== Machine B (${targetEmail})`);
                    } else if (!backupEmail && targetEmail) {
                        contactMismatches.push(`Official Mail ID: Backup (BLANK / MISSING) !== Machine B (${targetEmail})`);
                    } else if (backupEmail && !targetEmail) {
                        contactMismatches.push(`Official Mail ID: Backup (${backupEmail}) !== Machine B (BLANK / MISSING)`);
                    }

                    // 6. Mobile Number Check (CONTACT - WARNING ONLY)
                    const backupMobile = getProfileMobile(rawProfile);
                    const targetMobile = getProfileMobile(targetCompanyObj);
                    if (backupMobile && targetMobile && backupMobile !== targetMobile) {
                        contactMismatches.push(`Mobile Number: Backup (${backupMobile}) !== Machine B (${targetMobile})`);
                    }

                    // Optional Registration Codes Check (PF, ESI, LIN)
                    if (cleanStr(rawProfile.pfCode) && cleanStr(targetCompanyObj.pfCode) && cleanStr(rawProfile.pfCode) !== cleanStr(targetCompanyObj.pfCode)) {
                        contactMismatches.push(`PF Code: Backup (${rawProfile.pfCode}) !== Machine B (${targetCompanyObj.pfCode})`);
                    }
                    if (cleanStr(rawProfile.esiCode) && cleanStr(targetCompanyObj.esiCode) && cleanStr(rawProfile.esiCode) !== cleanStr(targetCompanyObj.esiCode)) {
                        contactMismatches.push(`ESI Code: Backup (${rawProfile.esiCode}) !== Machine B (${targetCompanyObj.esiCode})`);
                    }
                    if (cleanStr(rawProfile.lin) && cleanStr(targetCompanyObj.lin) && cleanStr(rawProfile.lin) !== cleanStr(targetCompanyObj.lin)) {
                        contactMismatches.push(`LIN Number: Backup (${rawProfile.lin}) !== Machine B (${targetCompanyObj.lin})`);
                    }

                    // HARD BLOCK FOR LEGAL IDENTITY MISMATCHES (Silo ID, Company Name, CIN, PAN)
                    if (legalMismatches.length > 0) {
                        setIsProcessing(false);
                        setShowBackupModal(false);
                        setSelectedBackupFile(null);
                        setEncryptionKey('');
                        showAlert?.('error', 'Data Migration Blocked: Legal Identity Mismatch', (
                            <div className="space-y-3 text-left">
                                <div className="p-3 bg-rose-950/60 border border-rose-500/30 rounded-xl space-y-2">
                                    <p className="text-xs font-bold text-rose-300">Legal Company Credentials Mismatch (Company Silo ID, Name, CIN, or PAN):</p>
                                    <ul className="list-disc pl-5 space-y-1 text-[11px] text-rose-200 font-mono">
                                        {legalMismatches.map((m, idx) => <li key={idx}>{m}</li>)}
                                    </ul>
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                                    Data Migration strictly requires Company Silo ID, Company Name, CIN Number, and PAN Number to match compulsorily between Machine A and Machine B.
                                </p>
                            </div>
                        ));
                        return;
                    }

                    // SOFT WARNING FOR CONTACT MISMATCHES (Mail ID / Mobile Number) WITH "PROCEED ANYWAY" OPTION
                    if (contactMismatches.length > 0) {
                        setIsProcessing(false);
                        showAlert?.('confirm', 'Data Migration Warning: Contact Mismatch', (
                            <div className="space-y-3 text-left">
                                <div className="p-3 bg-amber-950/60 border border-amber-500/30 rounded-xl space-y-2">
                                    <p className="text-xs font-bold text-amber-300">The following contact details differ between the backup file and Machine B:</p>
                                    <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-200 font-mono">
                                        {contactMismatches.map((m, idx) => <li key={idx}>{m}</li>)}
                                    </ul>
                                </div>
                                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-300 leading-relaxed">
                                    <strong className="text-sky-400 font-bold block mb-1">PROTECTION GUARANTEE:</strong>
                                    Machine B's existing Official Mail ID, Mobile Number, Database Password, and Security PIN will be <strong className="text-emerald-400 font-bold">100% PRESERVED & UNTOUCHED</strong>.
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed italic font-bold">
                                    Do you wish to proceed with migrating payroll ledgers anyway?
                                </p>
                            </div>
                        ), () => {
                            proceedWithRestore();
                        }, () => {
                            setIsProcessing(false);
                            setShowBackupModal(false);
                            setSelectedBackupFile(null);
                            setEncryptionKey('');
                        }, 'PROCEED ANYWAY (PRESERVE CONTACT)', undefined, 'CANCEL MIGRATION');
                        return;
                    }
                }

                if (!isDataMigration && companyExists) {
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
                setShowBackupModal(false);
                setSelectedBackupFile(null);
                setSelectedBackupPath('');
                setEncryptionKey('');
                setActiveTab(SettingsTab.Data);
                setSettingsTab?.(SettingsTab.Data);
                const isBlocked = err.message?.includes("Universal Restoration Blocked") || err.message?.includes("Blocked");
                let displayError = isBlocked ? err.message : `Restore Error: ${err.message}`;
                if (err.message === "Wrong Password or Corrupt File" || err.message.includes("Malformed UTF-8") || err.message === "Invalid Decryption Result") {
                    displayError = "Decryption Failed: Incorrect password or invalid file.";
                }
                const alertTitle = isBlocked ? 'Restore Blocked' : 'Restoration Failed';
                showAlert?.('error', alertTitle, displayError);
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

                const rawProfile = data.company_profile || data.app_company_profile || data.companyProfile || {};
                const establishmentName = rawProfile.establishmentName || 'COMPANY';

                // Check if an existing company silo matches the incoming profile to avoid creating a duplicate silo
                const existingMatch = findMatchingCompanySilo(rawProfile, companiesList);
                if (existingMatch) {
                    targetCompanyId = existingMatch.id;
                    console.log(`[MIGRATE] Matched existing company silo '${existingMatch.establishmentName}' (${existingMatch.id}). Data will be restored directly into existing silo.`);
                } else if (activeCompanyId && activeCompanyId !== 'default') {
                    targetCompanyId = activeCompanyId;
                } else {
                    targetCompanyId = generateCompanyId(establishmentName);
                }

                const getCKey = (key: string) => `${key}_${targetCompanyId}`;
                console.log(`[MIGRATE] Resolved Target Company ID: ${targetCompanyId}`);

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

        const currentPin = encryptionKey ? encryptionKey.trim() : '';

        // 2FA: Require Login Password to finalize the restore
        requireAuth(() => {
            if (backupMode === 'DATAMIGRATE') {
                setShowPeriodModal(true);
            } else {
                // Universal Restoration (IMPORT mode): restore all periods directly without showing period modal
                setRestorePeriodType('ALL');
                executeImport(currentPin);
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
                                } catch (e) { }
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
                            } catch (e) { }
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
                                } catch (e) { }
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
                attendance: (() => {
                    let baseAtt: any[] = getMergedSiloData('app_attendance', []);
                    try {
                        for (let i = 0; i < localStorage.length; i++) {
                            const k = localStorage.key(i);
                            if (k && k.startsWith(`app_temp_payroll_${activeCompanyId}_`)) {
                                const val = localStorage.getItem(k);
                                if (val) {
                                    const draftObj = JSON.parse(val);
                                    const draftAtt = draftObj.attendances || draftObj.attendance;
                                    if (Array.isArray(draftAtt)) {
                                        draftAtt.forEach((dItem: any) => {
                                            const idx = baseAtt.findIndex(b => 
                                                b.employeeId === dItem.employeeId && 
                                                String(b.month).trim().toLowerCase() === String(dItem.month).trim().toLowerCase() && 
                                                Number(b.year) === Number(dItem.year)
                                            );
                                            if (idx !== -1) {
                                                const dHasData = (dItem.presentDays || 0) > 0 || (dItem.earnedLeave || 0) > 0 || (dItem.sickLeave || 0) > 0 || (dItem.casualLeave || 0) > 0 || (dItem.lopDays || 0) > 0;
                                                const bHasData = (baseAtt[idx].presentDays || 0) > 0 || (baseAtt[idx].earnedLeave || 0) > 0 || (baseAtt[idx].sickLeave || 0) > 0 || (baseAtt[idx].casualLeave || 0) > 0 || (baseAtt[idx].lopDays || 0) > 0;
                                                if (dHasData || !bHasData) {
                                                    baseAtt[idx] = { ...baseAtt[idx], ...dItem };
                                                }
                                            } else {
                                                baseAtt.push(dItem);
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    } catch(e) {}
                    return baseAtt;
                })(),
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

            // ── V06.02: Military-grade AES-256-CBC export via Electron (replaces CryptoJS blob) ──
            // Determine filename
            let fileName = 'backup.enc';
            try {
                fileName = generateBackupFilename(companyProfile.establishmentName, globalMonth, globalYear);
            } catch (e) {
                console.error("Filename generation failed:", e);
                const today = new Date();
                fileName = `backup_${today.getFullYear()}_${today.getMonth() + 1}.enc`;
            }

            if (window.electronAPI?.runFullBackup) {
                setProcessStatus('Encrypting with AES-256-CBC (Military Grade)...');
                setProcessProgress(70);

                const subfolderPath = `${getCompanyBackupFolder(companyProfile.establishmentName, companyProfile.id)}/BK_${getMonthAbbr(globalMonth)}${String(globalYear).slice(-2)}`;

                const res = await window.electronAPI.runFullBackup({
                    fileName,
                    subfolder: subfolderPath,
                    encryptionKey: encryptionKey,
                });

                if (res.success) {
                    setProcessProgress(100);
                    setProcessStatus('Secure Backup Saved Successfully');
                    showAlert?.('success', 'Secure Backup Created & Auto-Saved',
                        `Your data has been encrypted with AES-256-CBC (military-grade) and saved:\n\n${res.fileName || fileName}\n\n* This new format is fully compatible with Universal Restoration and Data Migration.`,
                        () => {
                            if (res.filePath && window.electronAPI.openItemLocation) {
                                window.electronAPI.openItemLocation(res.filePath);
                            }
                        }
                    );
                } else {
                    throw new Error(res.error || 'Backup failed in the secure export handler.');
                }
            } else {
                // Fallback for non-Electron (browser preview only) — still uses CryptoJS
                const encrypted = (window as any).CryptoJS?.AES.encrypt(jsonString, encryptionKey).toString() || jsonString;
                const blob = new Blob([encrypted], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
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

        if (!profileData.mobile || !String(profileData.mobile).trim()) {
            showAlert?.('error', 'Validation Failed', 'Mobile Number is mandatory under Company Profile.');
            return;
        }
        if (!profileData.email || !String(profileData.email).trim()) {
            showAlert?.('error', 'Validation Failed', 'Official Email Address is mandatory under Company Profile.');
            return;
        }

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

    const handleInitiateBasisChange = (targetBasis: 'LabourCode' | 'OriginalWages') => {
        if (formData.pfEsiCalculationBasis === targetBasis) return;
        
        setPendingBasisChange(targetBasis);
        setPolicyOtp('');
        setPolicyPassword('');
        setPolicyOtpStep('IDENTIFY');
        setPolicyError('');
        setShowPolicyOtpModal(true);
    };

    const handleSendPolicyOtp = async () => {
        const email = licenseInfo?.registeredTo || '';
        const userID = licenseInfo?.userID || 'ADMIN';
        if (!email) {
            setPolicyError("No registered administrator email address found.");
            return;
        }

        setIsRequestingPolicyOtp(true);
        setPolicyError('');
        try {
            const targetPolicyText = pendingBasisChange === 'LabourCode' ? 'LABOUR CODE WAGES' : 'LEGACY WAGES BASIS';
            const res = await requestResetOTP(email, userID, `changing statutory calculation policy to ${targetPolicyText} for ${companyProfile.establishmentName || 'company'}`);
            if (res.success) {
                setPolicyOtpStep('OTP');
                showAlert?.('success', 'OTP Dispatched', `A verification code has been sent to ${email}.`);
            } else {
                setPolicyError(res.message || "Failed to dispatch OTP. Please check internet connection.");
            }
        } catch (e: any) {
            setPolicyError(e.message || "OTP Dispatch Error");
        } finally {
            setIsRequestingPolicyOtp(false);
        }
    };

    const handleVerifyAndApplyPolicyChange = async () => {
        if (!policyOtp || policyOtp.length !== 6) {
            setPolicyError("Please enter a valid 6-digit OTP code.");
            return;
        }
        if (!policyPassword) {
            setPolicyError("Please enter your Administrator password.");
            return;
        }

        setIsVerifyingPolicyChange(true);
        setPolicyError('');

        try {
            // 1. Verify password locally
            const isPasswordCorrect = policyPassword === currentUser?.password || (!import.meta.env.PROD && policyPassword === 'Password@123');
            if (!isPasswordCorrect) {
                setPolicyError("Incorrect Administrator password.");
                setIsVerifyingPolicyChange(false);
                return;
            }

            // 2. Verify OTP with cloud Apps Script
            const email = licenseInfo?.registeredTo || '';
            const userID = licenseInfo?.userID || 'ADMIN';
            const res = await verifyResetOTP(email, userID, policyOtp);

            if (!res.success) {
                setPolicyError(res.message || "OTP verification failed. Please try again.");
                setIsVerifyingPolicyChange(false);
                return;
            }

            // 3. Apply the policy change
            if (pendingBasisChange) {
                setFormData({ ...formData, pfEsiCalculationBasis: pendingBasisChange });
                
                // Dispatch post-change confirmation email in background
                sendPolicyChangeConfirmationEmail(pendingBasisChange);
                
                showAlert?.('success', 'Policy Updated', `Calculation basis successfully changed to: ${pendingBasisChange === 'LabourCode' ? 'LABOUR CODE' : 'LEGACY WAGES'}`);
            }

            setShowPolicyOtpModal(false);
        } catch (e: any) {
            setPolicyError(e.message || "An error occurred during verification.");
        } finally {
            setIsVerifyingPolicyChange(false);
        }
    };

    const sendPolicyChangeConfirmationEmail = async (newBasis: string) => {
        const email = licenseInfo?.registeredTo || '';
        const userID = currentUser?.username || 'ADMIN';
        const companyName = companyProfile.establishmentName || 'Payroll System';
        const newPolicyText = newBasis === 'LabourCode' ? 'Labour Code (Clause 88)' : 'Legacy Wages Basis';

        // Call the GAS cloud endpoint to send the confirmation email
        try {
            await sendPolicyConfirmationEmailGAS(email, userID, companyName, newPolicyText);
        } catch (err) {
            console.error("Failed to send cloud post-change confirmation email:", err);
        }

        // Also fallback/send via local SMTP if configured
        if (window.electronAPI) {
            const smtpConfig = {
                host: companyProfile.smtpHost || '',
                port: Number(companyProfile.smtpPort) || 587,
                secure: companyProfile.smtpSecurity || 'TLS',
                user: companyProfile.smtpUser || '',
                pass: companyProfile.smtpPassword || '',
                senderName: companyProfile.senderName || companyProfile.establishmentName || 'Payroll System',
                senderEmail: companyProfile.senderEmail || companyProfile.smtpUser || ''
            };

            if (smtpConfig.host && smtpConfig.user && smtpConfig.pass) {
                const mailOptions = {
                    to: email,
                    subject: `[POLICY CHANGE] Statutory Calculation Basis Modified - ${companyName}`,
                    text: `Dear Administrator,\n\nThis is to confirm that the statutory calculation policy for "${companyName}" has been successfully switched to: ${newPolicyText}.\n\nChange details:\n- Switched to: ${newPolicyText}\n- Date/Time: ${new Date().toLocaleString()}\n- Authorized User: ${currentUser?.name || currentUser?.username}\n\nRegards,\nPayroll Security Auditor`,
                    html: `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background: #fafafa;">
                            <h2 style="color: #e11d48; margin-top: 0; font-weight: 800; text-transform: uppercase; font-size: 16px; letter-spacing: 0.05em;">Security Notice: Policy Change</h2>
                            <p>Dear Administrator,</p>
                            <p>This is to confirm that the statutory calculation policy for <strong>${companyName}</strong> has been successfully modified.</p>
                            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 16px 0;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 6px 0; font-weight: bold; width: 140px; color: #64748b; font-size: 13px;">NEW POLICY:</td>
                                        <td style="padding: 6px 0; font-weight: bold; color: #0f172a; font-size: 13px;">${newPolicyText}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">AUTHORIZED BY:</td>
                                        <td style="padding: 6px 0; color: #334155; font-size: 13px;">${currentUser?.name || currentUser?.username}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; font-weight: bold; color: #64748b; font-size: 13px;">TIMESTAMP:</td>
                                        <td style="padding: 6px 0; color: #334155; font-size: 13px;">${new Date().toLocaleString()}</td>
                                    </tr>
                                </table>
                            </div>
                            <p style="font-size: 12px; color: #64748b;">If you did not authorize this policy change, please investigate immediately or contact support.</p>
                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                            <p style="font-size: 10px; color: #94a3b8; text-align: center; margin: 0;">This is an automated security audit message. Please do not reply.</p>
                        </div>
                    `
                };
                try {
                    await window.electronAPI.sendEmail(smtpConfig, mailOptions);
                } catch (e) {
                    console.error("Local SMTP dispatch failed:", e);
                }
            }
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
            const isAll = selectedFromKey === 'ALL';

            await onPayrollReset({
                isAllMonths: isAll,
                resetRange: (!isAll && fromObj) ? {
                    fromMonth: fromObj.month,
                    fromYear: fromObj.year,
                    toMonth: latestPeriod.month,
                    toYear: latestPeriod.year
                } : undefined,
                employeeDojScope: employeeDojScope || undefined,
                categories: resetCategories
            });
            setIsProcessing(false);
            closePayrollResetModal();
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
                        if (backupMode !== 'MIGRATE' && backupMode !== 'DATAMIGRATE') {
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
                        {companyProfile?.isReadOnly ? (
                            <button
                                onClick={onClaimCompany}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all border border-amber-300 animate-pulse cursor-pointer pointer-events-auto"
                                title="Click to Allot Signature & Unlock Full Access Mode for this company"
                                aria-label="Unlock Full Access Mode"
                            >
                                <Sparkles size={14} className="text-slate-950 animate-spin" style={{ animationDuration: '3s' }} />
                                UNLOCK FULL MODE {availableSlots !== undefined ? `(${availableSlots} SLOT${availableSlots === 1 ? '' : 'S'} AVAILABLE)` : ''}
                            </button>
                        ) : (
                            <button
                                onClick={handleSave}
                                className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[11px] font-black transition-all shadow-xl active:scale-95 ${saved
                                        ? 'bg-emerald-600 text-white shadow-emerald-900/40 ring-2 ring-emerald-500/50'
                                        : isDirty
                                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-900/40 ring-2 ring-white/20'
                                            : 'bg-slate-800 text-slate-400 cursor-default opacity-80'
                                    }`}
                                title="Save Configuration"
                                aria-label="Save Configuration"
                            >
                                {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                                {saved ? 'DATA SAVED' : isDirty ? 'SAVE CONFIGURATION' : 'SAVE CONFIGURATION'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Bottom Row: Navigation Tabs */}
                <div className="flex overflow-x-auto pb-1 custom-scrollbar scroll-smooth px-4 mt-1 border-b border-white/5">
                    {getPermission('configCompanyProfile') && (
                        <button onClick={() => { setActiveTab(SettingsTab.Company); setSettingsTab?.(SettingsTab.Company); }} title="Switch to Company Profile Tab" aria-label="Switch to Company Profile Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === SettingsTab.Company ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                            <Building2 size={14} /> COMPANY PROFILE
                        </button>
                    )}
                    {getPermission('configStatutoryRules') && (
                        <button onClick={() => { setActiveTab(SettingsTab.Statutory); setSettingsTab?.(SettingsTab.Statutory); }} title="Switch to Statutory Rules Tab" aria-label="Switch to Statutory Rules Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === SettingsTab.Statutory ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                            <ShieldCheck size={14} /> STATUTORY RULES
                        </button>
                    )}
                    {getPermission('configDataManagement') && (
                        <button onClick={() => { setActiveTab(SettingsTab.Data); setSettingsTab?.(SettingsTab.Data); }} title="Switch to Data Management Tab" aria-label="Switch to Data Management Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === SettingsTab.Data ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                            <Database size={14} /> DATA MANAGEMENT
                        </button>
                    )}
                    {userRole === 'Developer' && (
                        <button onClick={() => { setActiveTab(SettingsTab.Developer); setSettingsTab?.(SettingsTab.Developer); }} title="Switch to Developer Options Tab" aria-label="Switch to Developer Options Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === SettingsTab.Developer ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                            <Megaphone size={14} /> DEVELOPER OPTIONS
                        </button>
                    )}
                    {getPermission('configLicenseManagement') && (
                        <button onClick={() => { setActiveTab(SettingsTab.License); setSettingsTab?.(SettingsTab.License); }} title="Switch to License Management Tab" aria-label="Switch to License Management Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === SettingsTab.License ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                            <ShieldCheck size={14} /> LICENSE MANAGEMENT
                        </button>
                    )}
                    {getPermission('configUserManagement') && (licenseInfo || !isSetupMode || appUsers.length > 0) && (
                        <button onClick={() => { setActiveTab(SettingsTab.Users); setSettingsTab?.(SettingsTab.Users); }} title="Switch to User Management Tab" aria-label="Switch to User Management Tab" className={`whitespace-nowrap pb-2.5 px-3.5 text-[10px] font-black border-b-[3px] transition-all flex items-center justify-center gap-1.5 ${activeTab === SettingsTab.Users ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-slate-400'}`}>
                            <Users size={14} /> USER MANAGEMENT
                        </button>
                    )}
                </div>
            </div>

            {activeTab === SettingsTab.Statutory && (
                <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                    {isReadOnly && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-amber-300 text-xs font-bold shadow-lg">
                            <div className="flex items-center gap-2">
                                <Lock size={16} className="text-amber-400" />
                                <span>READ-ONLY MODE: Statutory Rules are INACTIVE and locked. Changes are not permitted.</span>
                            </div>
                            <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2.5 py-1 rounded-md font-mono uppercase font-black tracking-wider border border-rose-500/30">INACTIVE MODE</span>
                        </div>
                    )}
                    <div className={isReadOnly ? 'pointer-events-none opacity-75 select-none space-y-8' : 'space-y-8'}>
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
                                        onChange={(e) => handleInitiateBasisChange(e.target.checked ? 'OriginalWages' : 'LabourCode')}
                                        title="Toggle Calculation Basis"
                                    />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-lg"></div>
                                </label>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Card 1: Labour Code */}
                            <button
                                onClick={() => handleInitiateBasisChange('LabourCode')}
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
                                onClick={() => handleInitiateBasisChange('OriginalWages')}
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
                </div>
            )}

            {activeTab === SettingsTab.Company && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    {isReadOnly && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-amber-300 text-xs font-bold shadow-lg">
                            <div className="flex items-center gap-2">
                                <Lock size={16} className="text-amber-400" />
                                <span>READ-ONLY MODE: Establishment Profile is locked. All fields are non-editable.</span>
                            </div>
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-md font-mono uppercase font-black tracking-wider border border-amber-500/30">READ-ONLY</span>
                        </div>
                    )}
                    <div className={isReadOnly ? 'pointer-events-none opacity-75 select-none space-y-8' : 'space-y-8'}>
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
                                                className={`w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-blue-500 font-bold placeholder:text-slate-700 ${companyProfile?.isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                placeholder="Leave blank for open access"
                                                value={profileData.dashboardPassword || ''}
                                                onChange={e => setProfileData({ ...profileData, dashboardPassword: e.target.value })}
                                                disabled={companyProfile?.isReadOnly}
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
                                    <div className="space-y-1"><label htmlFor="profile-pf-code" className="text-[10px] font-bold text-slate-400 uppercase">PF Code{profileData.epfApplicabilityTriggered && <span className="text-red-500 text-sm ml-0.5">*</span>}</label><input id="profile-pf-code" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="PF Code" value={profileData.pfCode} onChange={e => setProfileData({ ...profileData, pfCode: e.target.value })} title="PF Code Number" aria-label="PF Code Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-esi-code" className="text-[10px] font-bold text-slate-400 uppercase">ESI Code{profileData.esiApplicabilityTriggered && <span className="text-red-500 text-sm ml-0.5">*</span>}</label><input id="profile-esi-code" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="ESI Code" value={profileData.esiCode} onChange={e => setProfileData({ ...profileData, esiCode: e.target.value })} title="ESI Code Number" aria-label="ESI Code Number" /></div>
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
                                    <div className="space-y-1"><label htmlFor="profile-mobile" className="text-[10px] font-bold text-sky-400 uppercase flex items-center gap-1.5"><Phone size={10} /> Mobile No<span className="text-red-500 text-sm ml-0.5">*</span></label><input id="profile-mobile" type="text" className="w-full bg-slate-900 border border-sky-900/50 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-sky-500 font-mono placeholder:text-slate-500" placeholder="Mobile Number" value={profileData.mobile} onChange={e => setProfileData({ ...profileData, mobile: e.target.value })} title="Mobile Number" aria-label="Mobile Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-telephone" className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Phone size={10} /> Land Line (Telephone)</label><input id="profile-telephone" type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-500" placeholder="Landline" value={profileData.telephone} onChange={e => setProfileData({ ...profileData, telephone: e.target.value })} title="Telephone Number" aria-label="Telephone Number" /></div>
                                    <div className="space-y-1"><label htmlFor="profile-email" className="text-[10px] font-bold text-sky-400 uppercase flex items-center gap-1.5"><Mail size={10} /> Official Email<span className="text-red-500 text-sm ml-0.5">*</span></label><input id="profile-email" type="email" className="w-full bg-slate-900 border border-sky-900/50 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-500" placeholder="mail@example.com" value={profileData.email} onChange={e => setProfileData({ ...profileData, email: e.target.value })} title="Official Email Address" aria-label="Official Email Address" /></div>
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
                    {isReadOnly && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-amber-300 text-xs font-bold shadow-lg">
                            <div className="flex items-center gap-2">
                                <Lock size={16} className="text-amber-400" />
                                <span>READ-ONLY MODE: Data Management operations are restricted. Only "PURGE COMPANY" is active.</span>
                            </div>
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-md font-mono uppercase font-black tracking-wider border border-amber-500/30">PURGE ONLY</span>
                        </div>
                    )}
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
                                <button onClick={() => { setBackupMode('IMPORT'); backupFileRef.current?.click(); }} disabled={!getPermission('dmRestore')} title={!getPermission('dmRestore') ? "Access Denied: Requires Universal Restoration permission." : ""} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2"><Upload size={14} /> Restore File</button>
                            </div>
                            <div className="bg-[#0f172a] p-8 rounded-2xl border border-amber-500/20 flex flex-col items-center group hover:border-amber-500/40 transition-all">
                                <div className="p-4 bg-amber-900/20 text-amber-500 rounded-full mb-4 shadow-lg group-hover:rotate-12 transition-transform">
                                    <RotateCw size={32} />
                                </div>
                                <h4 className="text-white font-black mb-1 uppercase tracking-tighter">Legacy Migration</h4>
                                <p className="text-[10px] text-slate-500 text-center mb-6">Migrate from Single-Company older version.</p>
                                <button onClick={() => { setBackupMode('MIGRATE'); backupFileRef.current?.click(); }} disabled={isLicenseExpired || !getPermission('dmMigrate')} title={isLicenseExpired ? "Inactive due to Trial/License expired" : (!getPermission('dmMigrate') ? "Access Denied: Requires Legacy Migration permission." : "")} className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-900/30 transition-all flex items-center justify-center gap-2"><RefreshCw size={14} /> Run Migration</button>
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
                                        disabled={isReadOnly || !getPermission('dmBackup')}
                                        title={isReadOnly ? "Read-Only Mode: Local Backup disabled" : (!getPermission('dmBackup') ? "Access Denied: Requires Local Backup permission." : "")}
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
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
                                            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">Same-Machine Full Recovery</span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mb-6 leading-relaxed italic">"Full establishment disaster recovery strictly for backups created on THIS SAME MACHINE. Performs a complete entity overwrite for local recovery. Backups from other machines cannot be restored here (use Data Migration instead)."</p>
                                    <button
                                        onClick={() => { setBackupMode('IMPORT'); backupFileRef.current?.click(); }}
                                        disabled={isReadOnly || !getPermission('dmRestore')}
                                        title={isReadOnly ? "Read-Only Mode: Universal Restoration disabled" : (!getPermission('dmRestore') ? "Access Denied: Requires Universal Restoration permission." : "")}
                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Upload size={14} /> Select & Restore
                                    </button>
                                </div>

                                <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800 hover:border-violet-500/30 transition-all group shadow-lg flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="p-3 bg-violet-900/20 text-violet-400 rounded-xl group-hover:scale-110 transition-transform">
                                                <RefreshCw size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-white uppercase tracking-tighter">Data Migration</h4>
                                                <span className="text-[9px] font-bold text-violet-400 uppercase tracking-widest px-1.5 py-0.5 bg-violet-500/10 border border-violet-500/20 rounded">Cross-Machine Portability</span>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed italic">"Port operational payroll data (Employees, Attendance, Ledgers) from another computer (Machine A to Machine B). Validates 5-field profile compatibility while strictly preserving local settings, logins, and signatures."</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="p-2 bg-violet-500/5 border border-violet-500/10 rounded text-[9px] text-violet-400/80 font-bold uppercase tracking-wider text-center">
                                            Company {activeCompanyId} is copying only Payroll data ledgers
                                        </div>
                                        <button
                                            onClick={() => { setBackupMode('DATAMIGRATE'); backupFileRef.current?.click(); }}
                                            disabled={isReadOnly || !getPermission('dmRestore')}
                                            title={isReadOnly ? "Read-Only Mode: Data Migration disabled" : (!getPermission('dmRestore') ? "Access Denied: Requires Universal Restoration permission." : "")}
                                            className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-violet-900/30 transition-all flex items-center justify-center gap-2"
                                        >
                                            <RefreshCw size={14} /> Select & Migrate Ledgers
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800 hover:border-amber-500/30 transition-all group shadow-lg flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="p-3 bg-amber-900/20 text-amber-500 rounded-xl group-hover:rotate-12 transition-transform">
                                                <RotateCw size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-white uppercase tracking-tighter">Legacy Migration Wizard</h4>
                                                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded">Upgrade from Older Versions</span>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mb-6 leading-relaxed italic">"Used when upgrading from older single-company software versions (v3/v4) or when importing legacy backup files created before the multi-company format. Auto-transforms legacy tables into modern company silos."</p>
                                    </div>
                                    <button
                                        onClick={() => { setBackupMode('MIGRATE'); backupFileRef.current?.click(); }}
                                        disabled={isReadOnly || isLicenseExpired || !getPermission('dmMigrate')}
                                        title={isReadOnly ? "Read-Only Mode: Legacy Migration disabled" : (isLicenseExpired ? "Inactive due to Trial/License expired" : (!getPermission('dmMigrate') ? "Access Denied: Requires Legacy Migration permission." : ""))}
                                        className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-900/30 transition-all flex items-center justify-center gap-2"
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
                                    disabled={isReadOnly || isLicenseExpired || !getPermission('dmPartialReset')}
                                    title={isReadOnly ? "Read-Only Mode: Partial Reset disabled" : (isLicenseExpired ? "Inactive due to Trial/License expired" : (!getPermission('dmPartialReset') ? "Access Denied: Requires Partial Reset permission." : ""))}
                                    className="mt-4 py-2.5 px-4 bg-amber-900/20 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-900/20 disabled:text-amber-500/50 text-amber-500 hover:text-white border border-amber-900/50 hover:border-amber-400 disabled:hover:border-amber-900/50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
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
                                    disabled={isReadOnly || isLicenseExpired || !getPermission('dmRescue')}
                                    title={isReadOnly ? "Read-Only Mode: Organization Rescue disabled" : (isLicenseExpired ? "Inactive due to Trial/License expired" : (!getPermission('dmRescue') ? "Access Denied: Requires Organization Rescue permission." : ""))}
                                    className="mt-4 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
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
                                    disabled={isLicenseExpired || !getPermission('dmPurge')}
                                    title={isLicenseExpired ? "Inactive due to Trial/License expired" : (!getPermission('dmPurge') ? "Access Denied: Requires Purge Company permission." : "")}
                                    className="mt-4 py-2.5 px-4 bg-pink-900/20 hover:bg-pink-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-pink-900/20 disabled:text-pink-500/50 text-pink-500 hover:text-white border border-pink-900/50 hover:border-pink-400 disabled:hover:border-pink-900/50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
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
                                    disabled={isReadOnly || isLicenseExpired || !getPermission('dmFactoryReset')}
                                    title={isReadOnly ? "Read-Only Mode: Factory Reset disabled" : (isLicenseExpired ? "Inactive due to Trial/License expired" : (!getPermission('dmFactoryReset') ? "Access Denied: Requires Factory Reset permission." : ""))}
                                    className="mt-4 py-2.5 px-4 bg-red-900/20 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-900/20 disabled:text-red-500/50 text-red-500 hover:text-white border border-red-900/50 hover:border-red-400 disabled:hover:border-red-900/50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
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
                                    disabled={isReadOnly || !getPermission('dmDiagnostics')}
                                    title={isReadOnly ? "Read-Only Mode: Diagnostic Export disabled" : (!getPermission('dmDiagnostics') ? "Access Denied: Requires Diagnostic Report permission." : "")}
                                    className="mt-4 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                    <FileText size={14} /> Export Diagnostic Logs
                                </button>
                            </div>

                            {/* Safety Snapshot Recovery Card */}
                            <div className="p-5 rounded-2xl border border-emerald-900/40 bg-emerald-950/20 hover:bg-emerald-950/40 transition-colors flex flex-col justify-between group shadow-lg">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-emerald-900/30 text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
                                            <ShieldCheck size={18} />
                                        </div>
                                        <div>
                                            <h5 className="text-xs font-black text-emerald-400 uppercase tracking-tighter">Safety Snapshot Recovery</h5>
                                            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">Automatic Protection</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                                        Revert database to the exact safety snapshot captured automatically <span className="text-emerald-300 font-bold underline underline-offset-2">immediately prior</span> to your last Data Restore or Migration operation.
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        showAlert(
                                            'confirm',
                                            '🛡 Revert to Last Pre-Operation Snapshot?',
                                            'Are you sure you want to revert your database to the safety snapshot captured before your last Restore/Migration attempt? All company profile data and employee records will be restored to their exact state prior to that command.',
                                            async () => {
                                                if ((window.electronAPI as any)?.restoreFromSnapshot) {
                                                    const res = await (window.electronAPI as any).restoreFromSnapshot();
                                                    if (res.success) {
                                                        showAlert('success', 'Snapshot Restored ✓', 'Database successfully reverted to the pre-operation safety snapshot. All company profile data and records have been recovered.');
                                                        onRestore();
                                                    } else {
                                                        showAlert('danger', 'Snapshot Restore Error', res.error || 'Failed to revert to pre-operation snapshot.');
                                                    }
                                                }
                                            }
                                        );
                                    }}
                                    disabled={isReadOnly}
                                    className="mt-4 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white border border-emerald-400/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <RotateCcw size={14} /> Revert To Last Safety Snapshot
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
                                disabled={isReadOnly || !getPermission('dmStorageLocation')}
                                title={isReadOnly ? "Read-Only Mode: Change Directory disabled" : (!getPermission('dmStorageLocation') ? "Access Denied: Requires Secure Change Directory permission." : "")}
                                className="w-full py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-slate-700 shadow-lg active:scale-95"
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
                    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="bg-[#1e293b] w-full max-w-lg rounded-2xl border border-amber-500/40 shadow-2xl p-6 flex flex-col gap-4 relative max-h-[90vh] overflow-y-auto">
                            <button 
                                onClick={closePayrollResetModal} 
                                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors" 
                                title="Close" 
                                aria-label="Close Partial Reset Modal"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                                <div className="p-3 bg-amber-900/20 text-[#FFD700] rounded-xl border border-amber-900/50">
                                    <RotateCw size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Selective Partial Reset</h3>
                                    <p className="text-[11px] text-amber-400 font-medium">Unit: <span className="text-white font-bold">{companyProfile.establishmentName}</span> ({companyProfile.id})</p>
                                </div>
                            </div>

                            {/* Section 1: Sequential Range Protection Filter */}
                            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Calendar size={13} className="text-amber-400" /> Sequential Range Protection
                                    </label>
                                    <span className="text-[9px] font-bold text-amber-400 bg-amber-950/40 border border-amber-800/50 px-2 py-0.5 rounded">Backwards Rollback</span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">From Period (Start Rollback)</label>
                                        <select
                                            value={selectedFromKey}
                                            onChange={(e) => setSelectedFromKey(e.target.value)}
                                            className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer"
                                        >
                                            <option value="ALL">All Months (Full Reset)</option>
                                            {processedPeriods.map(p => (
                                                <option key={`${p.month}_${p.year}`} value={`${p.month}_${p.year}`}>
                                                    From: {p.month} {p.year}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">To Period (Fixed / Latest)</label>
                                        <div className="w-full bg-[#0f172a]/60 border border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-slate-300 flex items-center justify-between">
                                            <span>{latestPeriod.month} {latestPeriod.year}</span>
                                            <span className="text-[8px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded uppercase">
                                                {latestPeriod.month === globalMonth && Number(latestPeriod.year) === Number(globalYear) ? 'Active / Unfrozen' : 'Latest'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {selectedFromKey !== 'ALL' && (
                                    <div className="bg-amber-950/30 border border-amber-900/40 rounded-lg p-2.5 flex items-start gap-2">
                                        <ShieldCheck size={14} className="text-amber-400 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-amber-200 leading-relaxed font-medium">
                                            Rollback will sequentially erase records from <span className="font-bold underline text-white">{selectedFromKey.replace('_', ' ')}</span> through <span className="font-bold underline text-white">{latestPeriod.month} {latestPeriod.year}</span> (including unfrozen data). Records prior to {selectedFromKey.replace('_', ' ')} will remain <span className="font-bold text-emerald-400">100% protected</span>.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Data Category Checkboxes */}
                            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Database size={13} className="text-amber-400" /> Transactional Data Categories
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setResetCategories({
                                                payrollHistory: true, attendance: true, advances: true, fines: true, arrears: true, otRecords: true, employees: false
                                            })}
                                            className="text-[9px] font-bold text-sky-400 hover:underline uppercase"
                                        >
                                            Select All
                                        </button>
                                        <span className="text-slate-600">|</span>
                                        <button
                                            type="button"
                                            onClick={() => setResetCategories({
                                                payrollHistory: false, attendance: false, advances: false, fines: false, arrears: false, otRecords: false, employees: false
                                            })}
                                            className="text-[9px] font-bold text-slate-400 hover:underline uppercase"
                                        >
                                            Deselect All
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    <label className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${resetCategories.payrollHistory ? 'bg-amber-950/30 border-amber-800/60 text-amber-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'}`}>
                                        <input
                                            type="checkbox"
                                            checked={resetCategories.payrollHistory}
                                            onChange={(e) => setResetCategories(prev => ({ ...prev, payrollHistory: e.target.checked }))}
                                            className="rounded border-slate-700 text-amber-600 focus:ring-amber-500"
                                        />
                                        <span className="text-xs font-bold">Processed Payroll</span>
                                    </label>

                                    <label className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${resetCategories.attendance ? 'bg-amber-950/30 border-amber-800/60 text-amber-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'}`}>
                                        <input
                                            type="checkbox"
                                            checked={resetCategories.attendance}
                                            onChange={(e) => setResetCategories(prev => ({ ...prev, attendance: e.target.checked }))}
                                            className="rounded border-slate-700 text-amber-600 focus:ring-amber-500"
                                        />
                                        <span className="text-xs font-bold">Attendance Records</span>
                                    </label>

                                    <label className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${resetCategories.advances ? 'bg-amber-950/30 border-amber-800/60 text-amber-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'}`}>
                                        <input
                                            type="checkbox"
                                            checked={resetCategories.advances}
                                            onChange={(e) => setResetCategories(prev => ({ ...prev, advances: e.target.checked }))}
                                            className="rounded border-slate-700 text-amber-600 focus:ring-amber-500"
                                        />
                                        <span className="text-xs font-bold">Advances & Loans</span>
                                    </label>

                                    <label className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${resetCategories.fines ? 'bg-amber-950/30 border-amber-800/60 text-amber-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'}`}>
                                        <input
                                            type="checkbox"
                                            checked={resetCategories.fines}
                                            onChange={(e) => setResetCategories(prev => ({ ...prev, fines: e.target.checked }))}
                                            className="rounded border-slate-700 text-amber-600 focus:ring-amber-500"
                                        />
                                        <span className="text-xs font-bold">Tax & Fines</span>
                                    </label>

                                    <label className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${resetCategories.arrears ? 'bg-amber-950/30 border-amber-800/60 text-amber-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'}`}>
                                        <input
                                            type="checkbox"
                                            checked={resetCategories.arrears}
                                            onChange={(e) => setResetCategories(prev => ({ ...prev, arrears: e.target.checked }))}
                                            className="rounded border-slate-700 text-amber-600 focus:ring-amber-500"
                                        />
                                        <span className="text-xs font-bold">Salary Arrears</span>
                                    </label>

                                    <label className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${resetCategories.otRecords ? 'bg-amber-950/30 border-amber-800/60 text-amber-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'}`}>
                                        <input
                                            type="checkbox"
                                            checked={resetCategories.otRecords}
                                            onChange={(e) => setResetCategories(prev => ({ ...prev, otRecords: e.target.checked }))}
                                            className="rounded border-slate-700 text-amber-600 focus:ring-amber-500"
                                        />
                                        <span className="text-xs font-bold">Overtime (OT)</span>
                                    </label>

                                    <div className="col-span-1 sm:col-span-2 space-y-2">
                                        <label className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${resetCategories.employees ? 'bg-red-950/30 border-red-800/60 text-red-300' : 'bg-slate-950/40 border-slate-800 text-slate-400'}`}>
                                            <input
                                                type="checkbox"
                                                checked={resetCategories.employees}
                                                onChange={(e) => setResetCategories(prev => ({ ...prev, employees: e.target.checked }))}
                                                className="rounded border-slate-700 text-red-600 focus:ring-red-500"
                                            />
                                            <div>
                                                <span className="text-xs font-bold">Employee Master Profiles</span>
                                                <span className="block text-[9px] text-slate-400">
                                                    {selectedFromKey === 'ALL'
                                                        ? 'Clears all employee master profiles in active company'
                                                        : `Deletes enrolled employee profiles based on Date of Joining (DOJ)`}
                                                </span>
                                            </div>
                                        </label>

                                        {selectedFromKey !== 'ALL' && resetCategories.employees && (
                                            <div className="ml-6 p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2 animate-in fade-in duration-200">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                                                    Employee DOJ Deletion Cutoff:
                                                </label>
                                                <div className="space-y-1.5">
                                                    <label className="flex items-start gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="dojScope"
                                                            checked={employeeDojScope === 'NEXT_MONTH'}
                                                            onChange={() => setEmployeeDojScope('NEXT_MONTH')}
                                                            className="mt-0.5 text-amber-500 focus:ring-amber-500"
                                                        />
                                                        <div className="text-[10px]">
                                                            <span className="font-bold text-emerald-400">Following Month Onwards (Retain {fromObj ? `${fromObj.month} ${fromObj.year}` : 'Start Month'} Hires)</span>
                                                            <span className="block text-[8.5px] text-slate-400 leading-normal">Keeps employees who joined in {fromObj ? `${fromObj.month} ${fromObj.year}` : 'Start Month'} so you do not need to re-enter them.</span>
                                                        </div>
                                                    </label>

                                                    <label className="flex items-start gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="dojScope"
                                                            checked={employeeDojScope === 'START_MONTH'}
                                                            onChange={() => setEmployeeDojScope('START_MONTH')}
                                                            className="mt-0.5 text-amber-500 focus:ring-amber-500"
                                                        />
                                                        <div className="text-[10px]">
                                                            <span className="font-bold text-amber-300">From Start Month ({fromObj ? `${fromObj.month} ${fromObj.year}` : 'Start Month'} Onwards)</span>
                                                            <span className="block text-[8.5px] text-slate-400 leading-normal">Deletes employees who joined in {fromObj ? `${fromObj.month} ${fromObj.year}` : 'Start Month'} or later.</span>
                                                        </div>
                                                    </label>
                                                </div>
                                                {!employeeDojScope && (
                                                    <p className="text-[9px] text-amber-400 font-bold animate-pulse pt-1">
                                                        ⚠️ Please select an employee deletion option above to enable Confirm Reset.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Security Password & Confirmation */}
                            <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Verify Login Password</label>
                                <input 
                                    type="password" 
                                    placeholder="Enter Login Password" 
                                    title="Password" 
                                    disabled={isProcessing} 
                                    className={`w-full bg-[#0f172a] border ${resetError ? 'border-red-500' : 'border-slate-700'} rounded-lg px-4 py-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono`} 
                                    value={resetPassword} 
                                    onChange={(e) => { setResetPassword(e.target.value); setResetError(''); }} 
                                    onKeyDown={(e) => e.key === 'Enter' && executePayrollReset()} 
                                />
                                {resetError && <p className="text-xs text-red-400 font-bold text-center animate-pulse">{resetError}</p>}
                            </div>

                            <div className="flex gap-3">
                                <button 
                                    type="button"
                                    onClick={closePayrollResetModal} 
                                    disabled={isProcessing}
                                    className="flex-1 py-3 border border-slate-700 hover:bg-slate-800 disabled:opacity-50 text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                                >
                                    Cancel
                                </button>
                                {
                                    (() => {
                                        const isDojScopeRequired = selectedFromKey !== 'ALL' && resetCategories.employees;
                                        const isDojScopeSelected = !isDojScopeRequired || (employeeDojScope === 'START_MONTH' || employeeDojScope === 'NEXT_MONTH');
                                        const isResetActionValid = Object.values(resetCategories).some(Boolean) && isDojScopeSelected;

                                        return (
                                            <button 
                                                type="button"
                                                onClick={executePayrollReset} 
                                                disabled={isProcessing || !isResetActionValid} 
                                                className="flex-2 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                                            >
                                                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} 
                                                {isProcessing ? 'RESETTING DATA...' : 'CONFIRM RESET'}
                                            </button>
                                        );
                                    })()
                                }
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showBackupModal && (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className={`${backupMode === 'DATAMIGRATE' ? 'bg-[#180f2b] border-violet-700/50 shadow-violet-900/20' : 'bg-[#052a16] border-emerald-700/50 shadow-emerald-900/20'} w-full max-w-sm rounded-2xl border shadow-2xl p-6 flex flex-col gap-4 relative animate-in zoom-in-95 duration-200`}>
                            {!isProcessing && (
                                <button
                                    onClick={() => setShowBackupModal(false)}
                                    className={`absolute top-4 right-4 ${backupMode === 'DATAMIGRATE' ? 'text-violet-500/50 hover:text-violet-300' : 'text-emerald-500/50 hover:text-emerald-300'}`}
                                    title="Close"
                                    aria-label="Close Backup Modal"
                                >
                                    <X size={20} />
                                </button>
                            )}
                            <div className="flex flex-col items-center gap-2">
                                <div className={`p-4 rounded-full border mb-2 ${
                                    backupMode === 'DATAMIGRATE' 
                                        ? 'bg-violet-900/30 text-violet-400 border-violet-700/50' 
                                        : 'bg-emerald-900/30 text-emerald-400 border-emerald-700/50'
                                }`}>
                                    {backupMode === 'EXPORT' ? <Lock size={32} /> : <Database size={32} />}
                                </div>
                                <h3 className={`text-xl font-black text-center uppercase tracking-widest ${backupMode === 'DATAMIGRATE' ? 'text-violet-50' : 'text-emerald-50'}`}>
                                    {backupMode === 'EXPORT' ? 'SECURE EXPORT' : backupMode === 'DATAMIGRATE' ? 'DATA MIGRATION' : 'SECURE RESTORE'}
                                </h3>
                            </div>

                            <div className="space-y-4 mt-2">
                                {(backupMode === 'IMPORT' || backupMode === 'MIGRATE' || backupMode === 'DATAMIGRATE') && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">SELECT BACKUP FILE</label>
                                        <div className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-700 rounded-xl">
                                            <button
                                                onClick={async () => {
                                                    if ((window.electronAPI as any)?.selectBackupFile) {
                                                        const res = await (window.electronAPI as any).selectBackupFile();
                                                        if (res && res.filePath) {
                                                            setSelectedBackupPath(res.filePath);
                                                            const mockFile = new File([], res.name);
                                                            (mockFile as any).filePath = res.filePath;
                                                            (mockFile as any).path = res.filePath;
                                                            setSelectedBackupFile(mockFile);
                                                            const name = res.name.toUpperCase();
                                                            const isSqlite = name.endsWith('.sqlite') || name.includes('_BC_') || name.includes('_AC_');
                                                            setIsSqliteFile(isSqlite);
                                                            setBackupMode(prev => (prev === 'MIGRATE' || prev === 'DATAMIGRATE') ? prev : 'IMPORT');
                                                            setShowBackupModal(true);
                                                            return;
                                                        }
                                                    }
                                                    backupFileRef.current?.click();
                                                }}
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
                                        className={`w-full border rounded-xl px-4 py-3 text-white outline-none transition-all ${
                                            backupMode === 'DATAMIGRATE'
                                                ? 'bg-[#0a0514] border-violet-900/50 placeholder-violet-900/50 focus:ring-2 focus:ring-violet-500/50'
                                                : 'bg-[#021109] border-emerald-900/50 placeholder-emerald-900/50 focus:ring-2 focus:ring-emerald-500/50'
                                        } ${(isMachineLocked && !isBCACFile) ? 'opacity-50 cursor-not-allowed' : ''} font-mono tracking-widest`}
                                        value={encryptionKey}
                                        onChange={(e) => setEncryptionKey(e.target.value)}
                                    />
                                    {(isMachineLocked && !isBCACFile) && (
                                        <div className={`mt-1 p-2 border rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300 ${
                                            backupMode === 'DATAMIGRATE'
                                                ? 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                        }`}>
                                            <ShieldCheck size={12} />
                                            <span className="text-[9px] font-bold uppercase tracking-widest">Secure Binary Backup Detected</span>
                                        </div>
                                    )}
                                    {isBCACFile && (
                                        <div className={`mt-1 p-2 border rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300 ${
                                            backupMode === 'DATAMIGRATE'
                                                ? 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                        }`}>
                                            <ShieldCheck size={12} className="shrink-0" />
                                            <span className="text-[9px] font-bold uppercase tracking-widest leading-relaxed">
                                                Before/After Confirmation Backup Detected. Enter Security PIN to Restore.
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {processStatus && <p className={`text-[10px] font-bold text-center animate-pulse uppercase tracking-widest ${backupMode === 'DATAMIGRATE' ? 'text-violet-400' : 'text-emerald-400'}`}>{processStatus}</p>}

                                {isProcessing && (
                                    <div className={`w-full border h-2.5 rounded-full overflow-hidden shadow-inner my-2 ${
                                        backupMode === 'DATAMIGRATE' ? 'bg-[#0a0514] border-violet-900/50' : 'bg-[#021109] border-emerald-900/50'
                                    }`}>
                                        <div
                                            ref={progressRef}
                                            className={`h-full transition-all duration-500 ease-out ${
                                                backupMode === 'DATAMIGRATE'
                                                    ? 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.4)]'
                                                    : 'bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                                            }`}
                                        ></div>
                                    </div>
                                )}

                                <button
                                    onClick={backupMode === 'EXPORT' ? handleEncryptedExport : backupMode === 'MIGRATE' ? initiateLegacyMigration : initiateRestore}
                                    disabled={isProcessing || (backupMode !== 'EXPORT' && !selectedBackupFile)}
                                    className={`w-full disabled:opacity-50 text-white font-black text-xs py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest border ${
                                        backupMode === 'DATAMIGRATE'
                                            ? 'bg-violet-600 hover:bg-violet-700 border-violet-500/50 shadow-violet-900/30'
                                            : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500/50 shadow-emerald-900/30'
                                    }`}
                                >
                                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : (backupMode === 'EXPORT' ? <Download size={16} /> : <RefreshCw size={16} />)}
                                    {backupMode === 'EXPORT' ? 'DOWNLOAD ENCRYPTED BACKUP' : backupMode === 'MIGRATE' ? 'MIGRATE & RESTORE' : backupMode === 'DATAMIGRATE' ? 'PROCEED TO MIGRATION' : 'RESTORE DATA'}
                                </button>

                                {(backupMode === 'IMPORT' || backupMode === 'DATAMIGRATE') && !selectedBackupFile && (
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
                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Companies Registered</span>
                                                <span className={`text-sm font-black font-mono px-4 py-1 rounded-lg border ${registeredSiloCount != null && registeredSiloCount >= (licenseInfo?.companyLimit || 1) ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>
                                                    {registeredSiloCount !== null ? `${registeredSiloCount} / ${licenseInfo?.companyLimit || 1}` : '...'}
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
                                        disabled={isActivating || licenseInfo?.status === 'LICENSE ACTIVE' || licenseInfo?.status === 'DEVELOPER ACTIVE' || licenseInfo?.status === 'TRIAL ACTIVE'}
                                        className={`mt-4 w-full py-4 text-white font-black uppercase text-sm rounded-xl shadow-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 ${(licenseInfo?.status === 'LICENSE ACTIVE' || licenseInfo?.status === 'DEVELOPER ACTIVE' || licenseInfo?.status === 'TRIAL ACTIVE') ? 'bg-slate-700 shadow-none' : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 shadow-pink-900/20'}`}
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
                                        For a patch to trigger, <strong className="text-slate-300">Cloud Live Timestamp</strong> must be strictly newer than <strong className="text-slate-300">Local Active Timestamp</strong>.<br />
                                        Additionally, <strong className="text-slate-300">Compiled Executable Version</strong> must not be higher than <strong className="text-slate-300">Cloud App_Config Version</strong>.
                                    </p>

                                    {(() => {
                                        const cloudTs = latestPatchTimestamp || localStorage.getItem('app_latest_patch_timestamp') || '';
                                        const localTs = localStorage.getItem('app_active_patch_ts') || APP_PATCH_TIMESTAMP;
                                        if (cloudTs && localTs && cloudTs > localTs) {
                                            return (
                                                <div className="mt-4 flex justify-center">
                                                    <button
                                                        onClick={() => {
                                                            sessionStorage.setItem('force_patch_update', 'true');
                                                            window.location.reload();
                                                        }}
                                                        className="w-full max-w-sm bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-widest py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                                                    >
                                                        <Download size={16} /> Force Patch Update Now
                                                    </button>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
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
                                                <div className="flex items-center gap-2">
                                                    {/* Delete restricted: Cannot delete self, and Admins can only be deleted by Developers */}
                                                    {u.username !== currentUser?.username && (u.role !== 'Administrator' || userRole === 'Developer') && (
                                                        <button
                                                            onClick={() => handleUmDelete(u.username)}
                                                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/20 transition-all shadow-inner"
                                                            title="Delete User"
                                                        >
                                                            <Trash2 size={12} />
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
                                            className={`w-full bg-[#0a0f1d] border border-white/5 focus:border-sky-500/50 rounded-xl p-3.5 text-white text-xs font-mono uppercase outline-none transition-all focus:ring-4 focus:ring-sky-500/10 ${!!umEditId ? 'opacity-50 grayscale cursor-not-allowed' : ''} placeholder-gray-600`}
                                            value={umForm.username}
                                            onChange={e => setUmForm({ ...umForm, username: e.target.value.toUpperCase() })}
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

                                    {umForm.role === 'User' && (
                                        <div className="space-y-4 border-t border-white/5 pt-4 animate-in fade-in slide-in-from-top-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">
                                                Access Permissions & Tab Control
                                            </label>
                                            
                                            {/* Section 1: Main Tabs & Functions */}
                                            <div className="space-y-2">
                                                <span className="text-[8px] font-black text-sky-500 uppercase tracking-widest pl-1 block">Module Access</span>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {[
                                                        { key: 'employeeAdd', label: '1. Employee Addition' },
                                                        { key: 'employeeEdit', label: '2. Employee Edit' },
                                                        { key: 'processPayroll', label: '3. Process Payroll' },
                                                        { key: 'payReports', label: '4. Pay Reports' },
                                                        { key: 'statutoryReports', label: '5. Statutory Reports' },
                                                        { key: 'mis', label: '6. MIS Dashboard' },
                                                        { key: 'ssCode', label: '7. Social Security Code' },
                                                        { key: 'utilities', label: '8. Utilities' },
                                                    ].map(p => (
                                                        <label key={p.key} className="flex items-center gap-2.5 p-2.5 bg-[#0a0f1d] border border-white/5 hover:border-sky-500/30 rounded-xl cursor-pointer select-none transition-all">
                                                            <input
                                                                type="checkbox"
                                                                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-sky-600 focus:ring-sky-500 focus:ring-offset-slate-900"
                                                                checked={!!umForm.permissions?.[p.key as keyof UserPermissions]}
                                                                onChange={(e) => setUmForm({
                                                                    ...umForm,
                                                                    permissions: {
                                                                        ...umForm.permissions,
                                                                        [p.key]: e.target.checked
                                                                    }
                                                                })}
                                                            />
                                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight truncate">{p.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Section 2: Configuration Tabs */}
                                            <div className="space-y-2 pt-2">
                                                <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest pl-1 block">Configuration Tabs</span>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {[
                                                        { key: 'configCompanyProfile', label: 'a. Company Profile' },
                                                        { key: 'configStatutoryRules', label: 'b. Statutory Rules' },
                                                        { key: 'configDataManagement', label: 'c. Data Management' },
                                                        { key: 'configLicenseManagement', label: 'd. License Management' },
                                                        { key: 'configUserManagement', label: 'e. User Management' },
                                                    ].map(p => (
                                                        <label key={p.key} className="flex items-center gap-2.5 p-2.5 bg-[#0a0f1d] border border-white/5 hover:border-amber-500/30 rounded-xl cursor-pointer select-none transition-all">
                                                            <input
                                                                type="checkbox"
                                                                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-amber-600 focus:ring-amber-500 focus:ring-offset-slate-900"
                                                                checked={!!umForm.permissions?.[p.key as keyof UserPermissions]}
                                                                onChange={(e) => setUmForm({
                                                                    ...umForm,
                                                                    permissions: {
                                                                        ...umForm.permissions,
                                                                        [p.key]: e.target.checked
                                                                    }
                                                                })}
                                                            />
                                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight truncate">{p.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Section 3: Data Management Sub-Functions */}
                                            {!!umForm.permissions?.configDataManagement && (
                                                <div className="space-y-2 pt-3 border-t border-white/5 mt-2 animate-in fade-in duration-300">
                                                    <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest pl-1 block">Data Management Sub-Functions</span>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {[
                                                            { key: 'dmBackup', label: 'I. INITIATE LOCAL BACKUP' },
                                                            { key: 'dmRestore', label: 'II. SELECT & RESTORE' },
                                                            { key: 'dmMigrate', label: 'III. LEGACY MIGRATION' },
                                                            { key: 'dmPartialReset', label: 'IV. PARTIAL RESET' },
                                                            { key: 'dmRescue', label: 'V. SCAN & RESCUE ORPHANS' },
                                                            { key: 'dmPurge', label: 'VI. PURGE COMPANY' },
                                                            { key: 'dmFactoryReset', label: 'VII. FACTORY RESET' },
                                                            { key: 'dmDiagnostics', label: 'VIII. DIAGNOSTIC REPORT' },
                                                            { key: 'dmStorageLocation', label: 'IX. SECURE CHANGE DIRECTORY' },
                                                        ].map(p => (
                                                            <label key={p.key} className="flex items-center gap-2.5 p-2.5 bg-[#0a0f1d] border border-white/5 hover:border-rose-500/30 rounded-xl cursor-pointer select-none transition-all animate-in fade-in zoom-in-95 duration-200">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-rose-500 focus:ring-offset-slate-900"
                                                                    checked={!!umForm.permissions?.[p.key as keyof UserPermissions]}
                                                                    onChange={(e) => setUmForm({
                                                                        ...umForm,
                                                                        permissions: {
                                                                            ...umForm.permissions,
                                                                            [p.key]: e.target.checked
                                                                        }
                                                                    })}
                                                                />
                                                                <span className="text-[9.5px] font-bold text-slate-300 uppercase tracking-tight truncate">{p.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Section 4: Allowed / Assigned Companies */}
                                            {umForm.role === 'User' && (() => {
                                                const savedCompList: any[] = (() => {
                                                    try {
                                                        return JSON.parse(localStorage.getItem('app_companies') || '[]');
                                                    } catch {
                                                        return [];
                                                    }
                                                })();
                                                if (savedCompList.length === 0) return null;
                                                return (
                                                    <div className="space-y-4 border-t border-white/5 pt-4 mt-2 animate-in fade-in duration-300">
                                                        <label className="text-[10px] font-black text-[#FFD700] uppercase tracking-widest px-1">
                                                            Assigned Companies
                                                        </label>
                                                        <div className="grid grid-cols-1 gap-2">
                                                            {savedCompList.map(c => {
                                                                const isChecked = !!umForm.assignedCompanies?.includes(c.id);
                                                                return (
                                                                    <label key={c.id} className="flex items-center gap-2.5 p-2.5 bg-[#0a0f1d] border border-white/5 hover:border-amber-500/30 rounded-xl cursor-pointer select-none transition-all">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                                                                            checked={isChecked}
                                                                            onChange={(e) => {
                                                                                const updated = e.target.checked
                                                                                    ? [...(umForm.assignedCompanies || []), c.id]
                                                                                    : (umForm.assignedCompanies || []).filter(id => id !== c.id);
                                                                                setUmForm({
                                                                                    ...umForm,
                                                                                    assignedCompanies: updated
                                                                                });
                                                                            }}
                                                                        />
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">{c.establishmentName}</span>
                                                                            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-tighter">ID: {c.id}</span>
                                                                        </div>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Option: Show restricted units as inactive selection */}
                                                        <div className="pt-2">
                                                            <label className="flex items-center gap-2.5 p-2.5 bg-[#0a0f1d] border border-white/5 hover:border-amber-500/30 rounded-xl cursor-pointer select-none transition-all">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                                                                    checked={!!umForm.showRestrictedUnits}
                                                                    onChange={(e) => setUmForm({
                                                                        ...umForm,
                                                                        showRestrictedUnits: e.target.checked
                                                                    })}
                                                                />
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">Show Restricted Units in selector screen (as Inactive)</span>
                                                                    <span className="text-[8px] text-slate-500 uppercase tracking-tighter">If unchecked, restricted companies are completely hidden</span>
                                                                </div>
                                                            </label>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                </div>

                                <div className="pt-6 border-t border-white/5 flex flex-col gap-3">
                                    {umError && <div className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-[10px] font-bold text-center animate-pulse uppercase tracking-widest">{umError}</div>}
                                    <div className="flex gap-3">
                                        {umEditId && (
                                            <button
                                                onClick={() => { setUmEditId(null); setUmForm({ name: '', username: '', password: '', role: 'User', email: '', permissions: { ...defaultPermissions }, assignedCompanies: [], showRestrictedUnits: false }); }}
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
                showPeriodModal && (() => {
                    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                    const YEARS  = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
                    const isRestoreMode = backupMode === 'IMPORT';
                    const accentBg    = isRestoreMode ? 'bg-[#052a16]'        : 'bg-[#0f172a]';
                    const accentBorder= isRestoreMode ? 'border-emerald-500/50': 'border-violet-500/50';
                    const accentText  = isRestoreMode ? 'text-emerald-400'     : 'text-violet-400';
                    const accentRing  = isRestoreMode ? 'focus:ring-emerald-500': 'focus:ring-violet-500';
                    const accentBtn   = isRestoreMode
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/30'
                        : 'bg-violet-600 hover:bg-violet-700 shadow-violet-900/30';
                    const accentSel   = isRestoreMode
                        ? 'bg-emerald-600/10 border-emerald-500 text-white shadow-lg shadow-emerald-950/50'
                        : 'bg-violet-600/10 border-violet-500 text-white shadow-lg shadow-violet-950/50';

                    return (
                        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
                            <div className={`${accentBg} w-full max-w-md rounded-2xl border ${accentBorder} shadow-2xl p-6 flex flex-col gap-4 relative`}>
                                <button onClick={() => setShowPeriodModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white" title="Close" aria-label="Close Period Selector"><X size={20} /></button>

                                {/* Header */}
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <div className={`p-3 rounded-full border mb-2 ${isRestoreMode ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/30' : 'bg-violet-900/20 text-violet-400 border-violet-500/30'}`}>
                                        <Calendar size={32} />
                                    </div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-wider">
                                        {isRestoreMode ? 'Select Restore Period' : 'Select Migration Scope'}
                                    </h3>
                                    <p className="text-[11px] text-slate-400">
                                        {isRestoreMode
                                            ? <>Choose to restore <span className="text-emerald-400 font-bold">all periods</span> or restrict to a specific date range. Only transactional data (payroll, attendance, ledgers) within the range will be overwritten.</>
                                            : <>Choose whether to migrate all history or target a specific month for <span className={`${accentText} font-bold font-mono`}>{activeCompanyId}</span>.</>
                                        }
                                    </p>
                                </div>

                                {/* ── RESTORE MODE: ALL vs DATE RANGE ── */}
                                {isRestoreMode && (
                                    <div className="space-y-4 my-2">
                                        <div className="grid grid-cols-2 gap-3">
                                            <button type="button" onClick={() => setRestorePeriodType('ALL')}
                                                className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${restorePeriodType === 'ALL' ? accentSel : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
                                                <span className="text-xs font-bold uppercase tracking-wider">All Periods</span>
                                                <span className="text-[9px] text-slate-500">Restore complete history</span>
                                            </button>
                                            <button type="button" onClick={() => setRestorePeriodType('RANGE')}
                                                className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${restorePeriodType === 'RANGE' ? accentSel : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
                                                <span className="text-xs font-bold uppercase tracking-wider">Date Range</span>
                                                <span className="text-[9px] text-slate-500">From month → To month</span>
                                            </button>
                                        </div>

                                        {restorePeriodType === 'RANGE' && (
                                            <div className="space-y-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800 animate-in slide-in-from-top-2 duration-200">
                                                {/* FROM */}
                                                <div>
                                                    <label className={`text-[9px] font-black uppercase tracking-widest block mb-1 ${accentText}`}>From Period</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <select value={restoreFromMonth} onChange={e => setRestoreFromMonth(e.target.value)}
                                                            className={`w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-white outline-none focus:ring-1 ${accentRing}`}>
                                                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                                        </select>
                                                        <select value={restoreFromYear} onChange={e => setRestoreFromYear(parseInt(e.target.value))}
                                                            className={`w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-white outline-none focus:ring-1 ${accentRing}`}>
                                                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                                {/* TO */}
                                                <div>
                                                    <label className={`text-[9px] font-black uppercase tracking-widest block mb-1 ${accentText}`}>To Period</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <select value={restoreToMonth} onChange={e => setRestoreToMonth(e.target.value)}
                                                            className={`w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-white outline-none focus:ring-1 ${accentRing}`}>
                                                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                                        </select>
                                                        <select value={restoreToYear} onChange={e => setRestoreToYear(parseInt(e.target.value))}
                                                            className={`w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-white outline-none focus:ring-1 ${accentRing}`}>
                                                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                                <p className="text-[9px] text-slate-500 italic">
                                                    * Non-transactional data (employees, company profile, config) will always be fully restored regardless of range.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── MIGRATION MODE: ALL vs SINGLE MONTH (unchanged behaviour) ── */}
                                {!isRestoreMode && (
                                    <div className="space-y-4 my-2">
                                        <div className="grid grid-cols-2 gap-3">
                                            <button type="button" onClick={() => setMigratePeriodType('ALL')}
                                                className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${migratePeriodType === 'ALL' ? accentSel : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
                                                <span className="text-xs font-bold uppercase tracking-wider">All History</span>
                                                <span className="text-[9px] text-slate-500">Migrate all payroll years</span>
                                            </button>
                                            <button type="button" onClick={() => setMigratePeriodType('PERIOD')}
                                                className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${migratePeriodType === 'PERIOD' ? accentSel : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
                                                <span className="text-xs font-bold uppercase tracking-wider">Specific Month</span>
                                                <span className="text-[9px] text-slate-500">Target one month &amp; year</span>
                                            </button>
                                        </div>
                                        {migratePeriodType === 'PERIOD' && (
                                            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800 animate-in slide-in-from-top-2 duration-200">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Month</label>
                                                    <select value={migrateMonth} onChange={e => setMigrateMonth(e.target.value)}
                                                        className={`w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-white outline-none focus:ring-1 ${accentRing}`}>
                                                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Year</label>
                                                    <select value={migrateYear} onChange={e => setMigrateYear(parseInt(e.target.value))}
                                                        className={`w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-white outline-none focus:ring-1 ${accentRing}`}>
                                                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-3 mt-2">
                                    <button onClick={() => setShowPeriodModal(false)}
                                        className="flex-1 py-3 border border-slate-800 rounded-xl text-slate-400 font-bold hover:text-white transition-colors">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => { setShowPeriodModal(false); executeImport(); }}
                                        className={`flex-1 py-3 ${accentBtn} text-white rounded-xl font-black shadow-lg transition-all uppercase text-xs tracking-widest`}>
                                        Proceed
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()
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
                showRestoreSuccessModal && (
                    <div className="fixed inset-0 z-[900] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="bg-[#0f172a] w-full max-w-md rounded-3xl border border-emerald-500/50 shadow-2xl shadow-emerald-950/50 p-6 flex flex-col items-center text-center relative overflow-hidden">
                            <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

                            <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/30 mb-4 animate-bounce">
                                <CheckCircle2 size={48} className="drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                            </div>

                            <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-1">
                                Restoration Successful
                            </h3>
                            <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest mb-4">
                                Database Verified & Synchronized 100%
                            </p>

                            <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-left space-y-2 mb-6">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-medium">Archive Source:</span>
                                    <span className="text-slate-200 font-mono font-bold truncate max-w-[200px]" title={restoreSuccessSummary.fileName}>
                                        {restoreSuccessSummary.fileName}
                                    </span>
                                </div>
                                {restoreSuccessSummary.rowCount > 0 && (
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400 font-medium">Records Restored:</span>
                                        <span className="text-emerald-400 font-mono font-bold">
                                            {formatIndianNumber(restoreSuccessSummary.rowCount)} Entities
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-medium">Completed At:</span>
                                    <span className="text-slate-300 font-mono">
                                        {restoreSuccessSummary.timestamp}
                                    </span>
                                </div>
                            </div>

                            <p className="text-xs text-slate-300 mb-6">
                                The application will now reload to initialize all system modules with your restored dataset.
                            </p>

                            <button
                                onClick={() => {
                                    setShowRestoreSuccessModal(false);
                                    onRestore();
                                    setTimeout(() => {
                                        window.location.reload();
                                    }, 200);
                                }}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/30 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 group cursor-pointer"
                            >
                                <RotateCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                                Initialize Application
                            </button>
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
                showPolicyOtpModal && (
                    <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
                        <div className="bg-[#1e293b] border-2 border-amber-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
                            <button
                                onClick={() => setShowPolicyOtpModal(false)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                            
                            <div className="flex flex-col items-center gap-2 mb-4">
                                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/30 mb-2">
                                    <ShieldAlert size={32} />
                                </div>
                                <h3 className="text-lg font-black text-white text-center">Verify Policy Decision Change</h3>
                                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest text-center">
                                    Statutory Wages Policy Authorization
                                </p>
                                <p className="text-[11px] text-slate-400 text-center mt-2 px-2 leading-relaxed">
                                    You are changing the calculation policy for <strong>{companyProfile.establishmentName}</strong> to: <br />
                                    <span className="text-white font-bold uppercase tracking-wider text-xs">
                                        {pendingBasisChange === 'LabourCode' ? 'Labour Code Wages' : 'Legacy Wages Basis'}
                                    </span>
                                </p>
                            </div>

                            {policyOtpStep === 'IDENTIFY' ? (
                                <div className="space-y-4 mt-2">
                                    <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-center">
                                        <p className="text-[11px] text-slate-300 leading-normal mb-3">
                                            A 6-digit verification code will be sent to the registered Administrator email:<br />
                                            <span className="text-blue-400 font-bold font-mono text-xs">{licenseInfo?.registeredTo || 'Administrator Email'}</span>
                                        </p>
                                        <button
                                            onClick={handleSendPolicyOtp}
                                            disabled={isRequestingPolicyOtp}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-xs tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {isRequestingPolicyOtp ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={14} />
                                                    Dispatching...
                                                </>
                                            ) : (
                                                "Request Verification OTP"
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 mt-2 animate-in fade-in duration-200">
                                    <div className="space-y-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Verification OTP Code</label>
                                            <input
                                                type="text"
                                                maxLength={6}
                                                placeholder="Enter 6-digit OTP"
                                                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono text-center tracking-[0.3em] font-black"
                                                value={policyOtp}
                                                onChange={(e) => setPolicyOtp(e.target.value.replace(/[^0-9]/g, ''))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Administrator Password</label>
                                            <input
                                                type="password"
                                                placeholder="Enter Admin Password"
                                                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono text-center"
                                                value={policyPassword}
                                                onChange={(e) => setPolicyPassword(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {policyError && (
                                <p className="text-[10px] text-red-400 font-bold text-center mt-3 animate-pulse bg-red-950/20 py-1.5 px-3 rounded-lg border border-red-900/30">
                                    {policyError}
                                </p>
                            )}

                            <div className="flex gap-3 mt-5">
                                <button
                                    onClick={() => setShowPolicyOtpModal(false)}
                                    className="flex-1 py-3 border border-slate-700 hover:bg-slate-800 rounded-xl text-slate-300 font-bold text-xs tracking-wider uppercase transition-colors"
                                >
                                    Cancel
                                </button>
                                {policyOtpStep === 'OTP' && (
                                    <button
                                        onClick={handleVerifyAndApplyPolicyChange}
                                        disabled={isVerifyingPolicyChange || policyOtp.length !== 6 || !policyPassword}
                                        className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isVerifyingPolicyChange ? (
                                            <>
                                                <Loader2 className="animate-spin" size={14} />
                                                Verifying...
                                            </>
                                        ) : (
                                            "Confirm & Apply"
                                        )}
                                    </button>
                                )}
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
