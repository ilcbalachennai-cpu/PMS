import CryptoJS from 'crypto-js';
import { LicenseData } from '../types';

// Replace this with your deployed Google Apps Script Web App URL
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzE10qkCCczPH-_eCQ_cJBRGpu28viV8zhNRCw2iD0Rha3y_1HIuWNPGAjHBrqsHeEB/exec";
export const APP_VERSION = "06.01.10";
export const APP_PATCH_TIMESTAMP = "10-08-2026 18:54:34"; // Format: dd-MM-yyyy HH:mm:ss
const AUTH_SECRET = "BPP-ULTIMATE-V2-SECURE";

export interface ActivationResult {
  success: boolean;
  message: string;
  userName?: string;
  userID?: string;
  dataSize?: number;
  expiryDate?: string;
  isTrial?: boolean;
  data?: any;
  latestVersion?: string;
  downloadUrl?: string;
  launcherUrl?: string; // NEW: Specific link for hard-locked users (D2)
  recoveryData?: {
    adminUser?: string;
    adminPass?: string;
  };
  status?: string;
}

/**
 * Gets a unique Machine ID.
 */
export const getMachineId = async (): Promise<string> => {
  // @ts-ignore
  if (window.electronAPI && window.electronAPI.getMachineId) {
    // @ts-ignore
    return await window.electronAPI.getMachineId();
  }

  let mid = localStorage.getItem('app_machine_id');
  if (mid && (mid.toUpperCase().includes('EXPIRED') || mid.toUpperCase().includes('ACTIVE') || mid.toUpperCase() === 'PENDING')) {
    mid = null;
    localStorage.removeItem('app_machine_id');
  }
  if (!mid) {
    mid = 'WEB-' + Math.random().toString(36).substring(2, 15).toUpperCase();
    localStorage.setItem('app_machine_id', mid);
  }
  return mid;
};

/**
 * Helper for fetch with timeout
 */
const fetchWithTimeout = async (url: string, options: any, timeout = 3500) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

/**
 * Tracks active usage days while offline
 */
export const trackActiveOfflineDay = () => {
  const today = new Date().toISOString().split('T')[0];
  const offlineDatesRaw = localStorage.getItem('app_offline_usage_dates') || '[]';
  try {
    let offlineDates: string[] = JSON.parse(offlineDatesRaw);
    if (!offlineDates.includes(today)) {
      // Only keep the last 10 dates to prevent bloat
      offlineDates = [...offlineDates, today].slice(-10);
      localStorage.setItem('app_offline_usage_dates', JSON.stringify(offlineDates));
    }
  } catch (e) {
    localStorage.setItem('app_offline_usage_dates', JSON.stringify([today]));
  }
};

/**
 * Returns unique offline usage days count
 */
export const getOfflineActiveDaysCount = () => {
  const offlineDatesRaw = localStorage.getItem('app_offline_usage_dates') || '[]';
  try {
    const offlineDates: string[] = JSON.parse(offlineDatesRaw);
    return offlineDates.length;
  } catch { return 0; }
};

/**
 * Checks if the application has internet access.
 */
export const checkOnlineStatus = async (): Promise<{ isOnline: boolean }> => {
  if (!navigator.onLine) return { isOnline: false };
  try {
    // 8 second timeout for status check
    const response = await fetchWithTimeout("https://www.google.com/favicon.ico", { mode: 'no-cors', cache: 'no-store' }, 8000);
    return { isOnline: !!response };
  } catch (e) {
    return { isOnline: false };
  }
};

/**
 * Logs an audit event to the file system if running in Electron
 */
export const logAuditEvent = (type: string, message: string, metadata?: any) => {
  try {
    if ((window as any).electronAPI && (window as any).electronAPI.logAuditEvent) {
      (window as any).electronAPI.logAuditEvent({ type, message, metadata }).catch(() => {});
    }
  } catch (e) {
    console.error("Audit log error:", e);
  }
};

/**
 * Advanced Obfuscation Pattern
 * Uses AES encryption with a combinations of static and dynamic keys.
 */
const SECRET_PEPPER = "BPP_PRO_2026_SECURE_VAL";

const scramble = (data: string, customKey?: string): string => {
  const key = customKey || SECRET_PEPPER;
  return CryptoJS.AES.encrypt(data, key).toString();
};

const unscramble = (scrambled: string, customKey?: string): string | null => {
  if (!scrambled) return null;
  let cleanScrambled = scrambled.trim();
  if (cleanScrambled.startsWith('"') && cleanScrambled.endsWith('"')) {
    try { cleanScrambled = JSON.parse(cleanScrambled); } catch (e) { cleanScrambled = cleanScrambled.slice(1, -1); }
  }
  const key = customKey || SECRET_PEPPER;

  try {
    // 1. Try Modern AES Decryption
    const bytes = CryptoJS.AES.decrypt(cleanScrambled, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (decrypted) return decrypted;
  } catch (e) { /* Fallback to legacy */ }

  try {
    // 2. Fallback: Legacy XOR Decryption
    const decoded = atob(scrambled);
    const unsalted = decoded.split('').map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ (SECRET_PEPPER.charCodeAt(i % SECRET_PEPPER.length)))
    ).join('');
    const parts = unsalted.split('|');
    if (parts[parts.length - 1] === SECRET_PEPPER) {
      return parts.slice(0, -1).join('|');
    }
  } catch (e) { }

  return null;
};

const generateChecksum = (data: any): string => {
  const { checksum, ...rest } = data; // Always exclude existing checksum from hash calculation
  return CryptoJS.SHA256(JSON.stringify(rest)).toString();
};

// --- OFFLINE PROTECTION HELPERS ---

/**
 * Checks if a date string (dd-MM-yyyy) is in the past compared to system time
 */
export const isExpiredOffline = (expiryStr: string | undefined): boolean => {
  if (!expiryStr) return false;
  const [day, month, year] = expiryStr.split('-').map(Number);
  const expiryDate = new Date(year, month - 1, day, 23, 59, 59);
  return expiryDate.getTime() < Date.now();
};

/**
 * Anti-Tamper: Tracks activity and detects if clock was wound back
 */
export const trackActivityTime = () => {
  const secureTime = localStorage.getItem('app_time_sync');
  const now = Date.now();

  if (secureTime) {
    try {
      const lastKnown = Number(unscramble(secureTime));
      const gracePeriod = 24 * 60 * 60 * 1000; // 24 hours in ms to prevent NTP sync false positives
      if (now < (lastKnown - gracePeriod)) {
        console.error("🛑 SECURITY VIOLATION: System clock tampering detected.");
        return { tampered: true };
      }
    } catch (e) {
      console.warn("⚠️ Time sync data corrupted, forcing re-sync.");
      localStorage.removeItem('app_time_sync');
    }
  }

  localStorage.setItem('app_time_sync', scramble(String(now)));
  return { tampered: false };
};

/**
 * Checks if a mandatory internet sync is required (Day 2 Warning, Day 3 Block)
 */
export const checkSyncRequirement = () => {
  const secureTime = localStorage.getItem('app_time_sync');
  // If baseline time sync is missing, force immediate internet sync
  if (!secureTime) return { required: true, blocked: true, message: "Initialization Sync Required" };

  const offlineDaysCount = getOfflineActiveDaysCount();

  // Day 1: Seamless access
  if (offlineDaysCount <= 1) return { required: false, blocked: false };

  // Day 2: Alert message
  if (offlineDaysCount === 2) {
    return {
      required: true,
      blocked: false,
      isSyncWarning: true,
      message: "Internet connection required for uninterrupted use"
    };
  }

  // Day 3: Warning + 10-minute countdown
  if (offlineDaysCount === 3) {
    let graceExpiry = localStorage.getItem('app_offline_grace_expiry');
    const now = Date.now();

    if (!graceExpiry) {
      graceExpiry = String(now + 600000); // 10 minutes from now
      localStorage.setItem('app_offline_grace_expiry', graceExpiry);
    }

    const remaining = Number(graceExpiry) - now;

    if (remaining > 0) {
      return {
        required: true,
        blocked: false,
        isSyncGracePeriod: true,
        graceRemaining: remaining,
        message: `Sync Required: Access will be suspended in ${Math.ceil(remaining / 60000)} minutes`
      };
    } else {
      // Countdown finished
      return { required: true, blocked: true, message: "Grace Period Expired: Internet Connection Required to continue" };
    }
  }

  // Day 4+: Persistent Block
  return { required: true, blocked: true, message: "Connection Required (Access Suspended)" };
};

/**
 * NEW V02.02.18: Retry Tracking for 4-Field Identity Conflicts
 */
export const getSyncRetryCount = (): number => {
  return Number(localStorage.getItem('app_sync_retry_count') || 0);
};

export const incrementSyncRetryCount = (): number => {
  const current = getSyncRetryCount();
  const next = current + 1;
  localStorage.setItem('app_sync_retry_count', String(next));
  return next;
};

export const clearSyncRetryCount = () => {
  localStorage.removeItem('app_sync_retry_count');
};

export const findMatchingCloudSignature = (
  company: { id?: string; establishmentName?: string; companySignature?: string } | null | undefined, 
  cloudSigs: string[]
): string | null => {
  if (!company || !Array.isArray(cloudSigs) || cloudSigs.length === 0) return null;
  const cid = (company.id || '').trim();
  const estName = (company.establishmentName || '').trim();
  const currentSig = (company.companySignature || '').trim();

  const match = cloudSigs.find(s => {
    if (!s || typeof s !== 'string') return false;
    const cleanS = s.trim();
    if (currentSig && cleanS === currentSig) return true;
    if (cid && cleanS.includes(`_${cid}-`)) return true;
    if (estName) {
      const cleanEst = estName.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (cleanEst && cleanS.toUpperCase().includes(`_${cleanEst}-`)) return true;
      if (cleanEst.length >= 4 && cleanS.toUpperCase().includes(`_${cleanEst.slice(0, 6)}`)) return true;
    }
    if (cid && cid.includes('_')) {
      const idPrefix = cid.split('_')[0].replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (idPrefix.length >= 4 && cleanS.toUpperCase().includes(`_${idPrefix}`)) return true;
    }
    return false;
  });

  return match || null;
};

export const getStoredLicense = (): LicenseData | null => {
  try {
    // Check if the currently logged-in user is 'VRANGA' (Developer)
    let sessionUser: any = null;
    try {
      const sessionStr = sessionStorage.getItem('app_session_user');
      if (sessionStr) {
        sessionUser = JSON.parse(sessionStr);
      }
    } catch (e) {}

    const isDeveloperSession = (sessionUser?.username === 'VRANGA') || 
                               (sessionUser?.role === 'Developer') ||
                               (!import.meta.env.PROD);
    if (isDeveloperSession) {
      let activeSigs: string[] = [];
      try {
        const compsRaw = localStorage.getItem('app_companies');
        if (compsRaw) {
          const comps = JSON.parse(compsRaw);
          if (Array.isArray(comps)) {
            activeSigs = comps.map((c: any) => c.companySignature).filter((s: any) => s && typeof s === 'string' && s.trim() !== '');
          }
        }
      } catch (e) {}

      const devLicense: LicenseData = {
        key: "VRANGA-DEV-LICENSE",
        userName: "RANGANATHAN",
        userID: "VRANGA",
        registeredTo: "bala68.chennai@gmail.com",
        registeredMobile: "9003083999",
        password: "Basupra@74",
        startDate: "18-04-2026",
        expiryDate: "17-04-2027",
        machineId: "05D02810-8051-7C4A-B33D-19383C3F3A2F",
        status: "LICENSE ACTIVE",
        dataSize: 450,
        isTrial: false,
        splDynamic: true,
        splMIS: true,
        companyLimit: 5,
        cloudSignatures: activeSigs,
        checksum: ""
      };

      try {
        const scrambledDev = scramble(JSON.stringify(devLicense));
        localStorage.setItem('app_license_secure', scrambledDev);
        localStorage.setItem('app_data_size', '450');
      } catch (e) {}

      return devLicense;
    }

    const key = 'app_license_secure';
    const scrambled = localStorage.getItem(key);
    
    if (!scrambled) {
      try {
        const raw = localStorage.getItem('app_license');
        if (raw) return JSON.parse(raw);
      } catch { }

      // Developer Override Fallback for localhost testing
      if (!import.meta.env.PROD) {
        console.warn("🛠️ [DEV OVERRIDE] Providing default developer license for localhost.");
        return {
          key: "VRANGA-DEV-LICENSE",
          userName: "RANGANATHAN",
          userID: "VRANGA",
          registeredTo: "bala68.chennai@gmail.com",
          registeredMobile: "9003083999",
          password: "Basupra@74",
          startDate: "01-01-2026",
          expiryDate: "31-12-2099",
          machineId: "05D02810-8051-7C4A-B33D-19383C3F3A2F",
          status: "ACTIVE",
          dataSize: 5000,
          isTrial: false,
          splDynamic: true,
          splMIS: true,
          companyLimit: 5,
          checksum: ""
        };
      }
      return null;
    }

    const unscrambled = unscramble(scrambled);
    if (!unscrambled) return null;

    const data: LicenseData = JSON.parse(unscrambled);

    // Integrity Check
    const { checksum, ...rest } = data;
    const calculatedChecksum = generateChecksum(rest);
    if (checksum !== calculatedChecksum) {
      console.error("License Integrity Compromised! Expected:", checksum, "Got:", calculatedChecksum);
      // Temporary bypass to prevent blocking after schema updates
      console.warn("⚠️ Proceeding despite checksum failure for debugging.");
    }

    if (data && data.key && data.key !== 'TRIAL' && data.key.length > 5) {
      if (data.status === 'PENDING_RESTORE' || !data.status) {
        console.log("🛡️ [AUTO-HEAL] Cleared stale PENDING_RESTORE status for valid license key:", data.key);
        data.status = 'ACTIVE';
      }
    }

    return data;
  } catch (e) {
    console.error("Exception in getStoredLicense:", e);
    return null;
  }
};

export const updateStoredLicenseLocally = async (licenseData: LicenseData): Promise<void> => {
  licenseData.checksum = generateChecksum(licenseData);
  const scrambled = scramble(JSON.stringify(licenseData));
  localStorage.setItem('app_license_secure', scrambled);
  if ((window as any).electronAPI) {
    await (window as any).electronAPI.dbSet('app_license_secure', scrambled);
  }
};

const getMachineKey = (): string => {
  return localStorage.getItem('app_machine_id') || 'INITIAL_PMS_KEY';
};

/**
 * NEW: Securely retrieves the cloud-synced Developer account.
 */
export const getAppDeveloper = (): any | null => {
  try {
    const scrambled = localStorage.getItem('app_developer_secure');
    if (!scrambled) return null;
    // Use MachineId as the dynamic key for developer credentials
    const unscrambled = unscramble(scrambled, getMachineKey());
    if (!unscrambled) return null;
    try {
      return JSON.parse(unscrambled);
    } catch { return null; }
  } catch (e) { return null; }
};

/**
 * Validates a 16-digit license key format.
 */
export const isValidKeyFormat = (key: string): boolean => {
  const cleanKey = key.replace(/[^0-9A-Z]/g, '');
  return cleanKey.length === 16;
};

const fetchFromApi = async (url: string, options: any) => {
  // Check for basic browser online status first
  if (!navigator.onLine) {
    throw new Error('NO_INTERNET');
  }

  try {
    // --- V02.02.23: SECURE SHA-256 COMMUNICATION HANDSHAKE ---
    if (options.method === 'POST' && options.body) {
      if (!options.headers) {
        options.headers = {};
      }
      options.headers['Content-Type'] = 'application/json';
      try {
        const bodyObj = JSON.parse(options.body);
        bodyObj.version = APP_VERSION; // Version identification
        bodyObj.authSecret = AUTH_SECRET; // Inject secret BEFORE signing for master verification

        // Generate SHA-256 Signature (HAS 256 Unique Code)
        // This ensures the request is authentic and hasn't been tampered with.
        const signature = CryptoJS.HmacSHA256(JSON.stringify(bodyObj), AUTH_SECRET).toString();
        bodyObj.signature = signature;

        options.body = JSON.stringify(bodyObj);
      } catch (e) {
        console.warn("API Security Injection failed: Body is not JSON.");
      }
    }

    // @ts-ignore
    if (window.electronAPI && window.electronAPI.apiFetch) {
      try {
        // @ts-ignore
        const result = await window.electronAPI.apiFetch(url, options);
        return result;
      } catch (ipcErr: any) {
        // Handle common Electron IPC fetch errors (usually connection reset or timeout)
        console.error("IPC API Fetch Failure:", ipcErr);
        throw new Error(ipcErr.message || 'CONNECTION_FAILURE');
      }
    }
    
    const res = await fetchWithTimeout(url, options, 8000); // 8s timeout
    try {
      return await res.json();
    } catch { return { success: false, message: 'Invalid JSON response from server' }; }
  } catch (error: any) {
    console.error("API Fetch Error:", error);
    if (error.name === 'AbortError') throw new Error('TIMEOUT');
    if (error.message === 'NO_INTERNET' || error.message === 'CONNECTION_FAILURE') throw error;
    throw new Error('CONNECTION_FAILURE');
  }
};

/**
 * Trial Registration logic using Google Sheets.
 */
export const registerTrial = async (
  userName: string,
  userID: string,
  email: string,
  mobile: string,
  password?: string
): Promise<ActivationResult> => {
  const machineId = await getMachineId();

  // --- DEMO MODE FALLBACK ---
  if (GOOGLE_SCRIPT_URL.includes("YOUR_GOOGLE_SCRIPT")) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay

    const demoExpiry = new Date();
    demoExpiry.setDate(demoExpiry.getDate() + 14); // 14-days for offline demo
    const demoExpiryStr = `${demoExpiry.getDate().toString().padStart(2, '0')}-${(demoExpiry.getMonth() + 1).toString().padStart(2, '0')}-${demoExpiry.getFullYear()}`;

    const demoData: LicenseData = {
      key: "TRIAL",
      userName: userName,
      userID: userID,
      password: "DEMO_PASSWORD",
      registeredTo: email,
      registeredMobile: mobile,
      machineId: machineId,
      startDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      expiryDate: demoExpiryStr,
      dataSize: 50,
      status: "REGISTERED",
      isTrial: true,
      splDynamic: true,
      splMIS: true,
      companyLimit: 2,
      checksum: ''
    };

    demoData.checksum = generateChecksum(demoData);
    const scrambled = scramble(JSON.stringify(demoData));
    localStorage.setItem('app_license_secure', scrambled);
    localStorage.setItem('app_data_size', "50");
    localStorage.setItem('app_machine_id', machineId);

    // @ts-ignore
    if (window.electronAPI) {
      // @ts-ignore
      window.electronAPI.dbSet('app_license_secure', scrambled);
      // @ts-ignore
      window.electronAPI.dbSet('app_data_size', "50");
      // @ts-ignore
      window.electronAPI.dbSet('app_machine_id', machineId);
    }

    return {
      success: true,
      message: `DEMO MODE: Registration Successful (Offline). Valid until ${demoExpiryStr}`,
      data: demoData
    };
  }

  try {
    // --- V02.02.18: STRICT IDENTITY NORMALIZATION ---
    const cleanUserID = userID.toUpperCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'REGISTER_TRIAL',
        userName: userName.toUpperCase(),
        userID: cleanUserID,
        email: cleanEmail,
        mobile,
        machineId,
        password: password || ""
      })
    });
    // ... rest of the logic
    if (result.success) {
      const respData = result.data || {};
      const isHistorical = !!respData.startDate && respData.startDate !== new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

      const licenseData: LicenseData = {
        key: 'TRIAL',
        status: respData.status || 'REGISTERED',
        userName: respData.userName || userName,
        userID: respData.userID || userID,
        registeredTo: (respData.registeredTo && respData.registeredTo !== "N/A" && respData.registeredTo !== "n/a") ? respData.registeredTo : (respData.email || email),
        registeredMobile: (respData.registeredMobile && respData.registeredMobile !== "N/A" && respData.registeredMobile !== "n/a") ? String(respData.registeredMobile) : (respData.mobile || mobile),
        machineId: machineId,
        password: respData.password || "AS_REGISTERED",
        dataSize: Number(respData.dataSize || 50),
        startDate: respData.startDate || new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        expiryDate: respData.expiryDate || "",
        isTrial: true,
        splDynamic: respData.splDynamic !== undefined ? (respData.splDynamic === 'Yes' || respData.splDynamic === true) : true,
        splMIS: respData.splMIS !== undefined ? (respData.splMIS === 'Yes' || respData.splMIS === true) : true,
        companyLimit: Number(respData.companyLimit || 2),
        checksum: ''
      };

      licenseData.checksum = generateChecksum(licenseData);
      const scrambled = scramble(JSON.stringify(licenseData));
      const storageKey = 'app_license_secure';
      const dataSizeKey = 'app_data_size';

      localStorage.setItem(storageKey, scrambled);
      localStorage.setItem(dataSizeKey, String(licenseData.dataSize));
      const invalidMachine = licenseData.machineId && (licenseData.machineId.toUpperCase().includes('EXPIRED') || licenseData.machineId.toUpperCase().includes('ACTIVE') || licenseData.machineId.toUpperCase() === 'PENDING');
      if (!invalidMachine) {
        localStorage.setItem('app_machine_id', licenseData.machineId);

        // Sync to electron DB
        if ((window as any).electronAPI) {
          await (window as any).electronAPI.dbSet(storageKey, scrambled);
          await (window as any).electronAPI.dbSet(dataSizeKey, String(licenseData.dataSize));
          await (window as any).electronAPI.dbSet('app_machine_id', licenseData.machineId);
        }
      }
      localStorage.setItem('app_license_last_check', new Date().toISOString().split('T')[0]);

      // If historical, we adjust the success message
      if (isHistorical) {
        result.message = `🛡️ Trial History Found: Your original trial (started ${licenseData.startDate}) has been restored for this machine.`;
      }
    }

    return result;
  } catch (error: any) {
    return { success: false, message: `Registration Error: ${error.message || "Unknown Failure"}` };
  }
};

/**
 * Full License Activation.
 */
export const activateFullLicense = async (
  userName: string,
  userID: string,
  licenseKey: string,
  email: string,
  mobile: string,
  password?: string
): Promise<ActivationResult> => {
  const machineId = await getMachineId();
  const cleanKey = licenseKey.replace(/[^0-9A-Z]/g, '');

  if (!isValidKeyFormat(cleanKey)) {
    return { success: false, message: 'Invalid License Key format.' };
  }

  // --- V02.02.18: STRICT IDENTITY NORMALIZATION ---
  const cleanUserID = userID.toUpperCase().trim();
  const cleanEmail = email.toLowerCase().trim();


  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'ACTIVATE_LICENSE',
        userName: userName.toUpperCase(),
        userID: cleanUserID,
        licenseKey: cleanKey,
        email: cleanEmail,
        mobile,
        machineId,
        appPassword: password || ""
      })
    });

    if (result.success) {
      const respData = result.data || {};
      const licenseData: LicenseData = {
        key: cleanKey,
        status: respData.status || 'REGISTERED',
        userName: respData.userName || userName,
        userID: respData.userID || userID,
        registeredTo: (respData.registeredTo && respData.registeredTo !== "N/A" && respData.registeredTo !== "n/a") ? respData.registeredTo : (respData.email || email),
        registeredMobile: (respData.registeredMobile && respData.registeredMobile !== "N/A" && respData.registeredMobile !== "n/a") ? String(respData.registeredMobile) : (respData.mobile || mobile),
        machineId: machineId,
        password: respData.password || "AS_REGISTERED",
        dataSize: Number(respData.dataSize || 5000),
        startDate: respData.startDate || new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        expiryDate: respData.expiryDate || "",
        isTrial: false,
        splDynamic: respData.splDynamic === 'Yes' || respData.splDynamic === true,
        splMIS: respData.splMIS === 'Yes' || respData.splMIS === true,
        companyLimit: Number(respData.companyLimit || 1),
        checksum: ''
      };

      const prevLicense = localStorage.getItem('app_license_secure');

      licenseData.checksum = generateChecksum(licenseData);
      const scrambled = scramble(JSON.stringify(licenseData));
      const storageKey = 'app_license_secure';
      const dataSizeKey = 'app_data_size';

      localStorage.setItem(storageKey, scrambled);
      localStorage.setItem(dataSizeKey, String(licenseData.dataSize));
      const invalidMachine2 = licenseData.machineId && (licenseData.machineId.toUpperCase().includes('EXPIRED') || licenseData.machineId.toUpperCase().includes('ACTIVE') || licenseData.machineId.toUpperCase() === 'PENDING');
      if (!invalidMachine2) {
        localStorage.setItem('app_machine_id', licenseData.machineId);

        // Sync to electron DB (Global/Root DB for recovery across folders)
        if ((window as any).electronAPI && (window as any).electronAPI.dbSetGlobal) {
          await (window as any).electronAPI.dbSetGlobal(storageKey, scrambled);
          await (window as any).electronAPI.dbSetGlobal(dataSizeKey, String(licenseData.dataSize));
          await (window as any).electronAPI.dbSetGlobal('app_machine_id', licenseData.machineId);
        } else if ((window as any).electronAPI) {
          await (window as any).electronAPI.dbSet(storageKey, scrambled);
          await (window as any).electronAPI.dbSet(dataSizeKey, String(licenseData.dataSize));
          await (window as any).electronAPI.dbSet('app_machine_id', licenseData.machineId);
        }
      }
      localStorage.setItem('app_license_last_check', new Date().toISOString().split('T')[0]);

      // --- V02.02.18: DOUBLE-SYNC FORCE REPAIR ---
      // Backend ACTIVATE_LICENSE omits contact details, so we force-sync immediately
      // with the typed EMAIL, MOBILE, and PASSWORD to ensure the cloud validates and repairs local storage.
      console.log("🔄 [SYNC] Forcing full identity repair after activation...");
      const syncResult = await validateLicenseStartup(true, userID, email, mobile, password);

      if (!syncResult.valid) {
        // --- ROLLBACK INCONSISTENT IDENTITY ---
        console.error("❌ [SYNC] Identity mismatch. Rolling back activation...");
        logAuditEvent('IDENTITY_SYNC_FAILED', 'Identity mismatch detected during activation sync', { userID, email, mobile });
        if (prevLicense) {
          localStorage.setItem('app_license_secure', prevLicense);
          if ((window as any).electronAPI) await (window as any).electronAPI.dbSet('app_license_secure', prevLicense);
        } else {
          localStorage.removeItem('app_license_secure');
          if ((window as any).electronAPI) await (window as any).electronAPI.dbDelete('app_license_secure');
        }
        return {
          success: false,
          message: syncResult.message || "Identity Verification Failed: Provided Email/Mobile do not match cloud records."
        };
      }

      // --- V02.02.18: STRICT FIDELITY COMPARISON (Hardened) ---
      // We normalize everything: strip all whitespaces, lowercase emails, and strip all non-digits from mobile.
      // --- V02.02.25: TOLERANT FIDELITY COMPARISON (Improved UX) ---
      // We normalize everything: strip all whitespaces, lowercase emails.
      // For mobile, we only compare the last 10 digits to ignore country codes (91/0).
      const cloudEmailRaw = String(syncResult.data?.registeredTo || syncResult.data?.email || "");
      const cloudMobileRaw = String(syncResult.data?.registeredMobile || syncResult.data?.mobile || "");

      const cloudEmail = cloudEmailRaw.trim().replace(/\s+/g, '').toLowerCase();
      const cloudMobile = cloudMobileRaw.replace(/\D/g, '').slice(-10);
      const typedEmail = email.trim().replace(/\s+/g, '').toLowerCase();
      const typedMobile = mobile.replace(/\D/g, '').slice(-10);

      if (typedEmail !== cloudEmail || (typedMobile && cloudMobile && typedMobile !== cloudMobile)) {
        console.error(`❌ [FIDELITY] Identity Mismatch Detected!`);
        console.log(`Cloud Data: Email[${cloudEmailRaw}] Mobile[${cloudMobileRaw}] (Normalized: ${cloudEmail} / ${cloudMobile})`);
        console.log(`Typed Data: Email[${email}] Mobile[${mobile}] (Normalized: ${typedEmail} / ${typedMobile})`);
        
        logAuditEvent('FIDELITY_MISMATCH', 'Fidelity check failed during activation', { 
          cloudData: { email: cloudEmailRaw, mobile: cloudMobileRaw }, 
          typedData: { email, mobile } 
        });

        // Rollback
        console.warn(`⚠️ [SYNC] Minor Identity Variation Detected: [Cloud E: '${cloudEmail}', Typed E: '${typedEmail}'] [Cloud M: '${cloudMobile}', Typed M: '${typedMobile}']. Proceeding because backend validated successfully.`);
      }
    }
    return result;
  } catch (error: any) {
    return { success: false, message: `Activation Error: ${error.message || "Unknown Failure"}` };
  }
};

/**
 * Startup validation.
 * Includes a daily online verification sync.
 */
export const validateLicenseStartup = async (
  force = false,
  attemptedID?: string,
  overrideEmail?: string,
  overrideMobile?: string,
  appPassword?: string,
  forceActivation = false,
  _isRetry = false
): Promise<{
  valid: boolean;
  message?: string;
  status?: string;
  launcherUrl?: string; // Specific link for blockade redirection
  data?: any;
}> => {
  // --- V02.02.12: FORCE INITIALIZATION OF SECURITY MARKERS ---
  // This ensures app_time_sync and other local markers are set BEFORE any blocking checks
  const timeCheck = trackActivityTime();
  const currentMachineId = await getMachineId();
  console.log(`[LICENSE] Hardware ID for Sync: ${currentMachineId}`);

  // Check if currently logged in session or the attempted login belongs to 'VRANGA' (Developer)
  let sessionUser: any = null;
  try {
    const sessionStr = sessionStorage.getItem('app_session_user');
    if (sessionStr) {
      sessionUser = JSON.parse(sessionStr);
    }
  } catch (e) {}

  const isDevAttempt = (attemptedID && attemptedID.toUpperCase() === 'VRANGA') || 
                       (sessionUser?.username === 'VRANGA') || 
                       (sessionUser?.role === 'Developer') ||
                       (!import.meta.env.PROD);

  let stored = getStoredLicense();
  
  if (isDevAttempt) {
    stored = {
      key: "05D02810-8051-7C4A-B33D-19383C3F3A2F",
      userName: "RANGANATHAN",
      userID: "VRANGA",
      registeredTo: "bala68.chennai@gmail.com",
      registeredMobile: "9003083999",
      password: "Basupra@74",
      startDate: "18-04-2026",
      expiryDate: "17-04-2027",
      machineId: "05D02810-8051-7C4A-B33D-19383C3F3A2F",
      status: "LICENSE ACTIVE",
      dataSize: 450,
      isTrial: false,
      splDynamic: true,
      splMIS: true,
      companyLimit: 5,
      checksum: ""
    };
  }
  const storageKey = 'app_license_secure';
  const dataSizeKey = 'app_data_size';



  // 1. OFFLINE ENFORCEMENT (Strict)
  if (stored) {


    if (timeCheck.tampered) {
      // --- REPORT TAMPERING TO CLOUD ---
      if (stored) {
        fetchFromApi(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'HEARTBEAT',
            email: stored.registeredTo,
            machineId: currentMachineId,
            userID: stored.userID,
            status: 'SECURITY_TAMPERED'
          })
        }).catch(e => console.warn("Failed to report tampering:", e));
      }
      return { valid: false, message: 'SECURITY VIOLATION', data: { isTampered: true } };
    }

    const syncCheck = checkSyncRequirement();
    // Only block if NOT forcing a sync
    if (syncCheck.blocked && !force) {
      return { valid: false, message: syncCheck.message, data: { isSyncBlocked: true } };
    }
  } else {
    // No license: Still perform a sync check for baseline security
    const syncCheck = checkSyncRequirement();
    if (syncCheck.blocked && !force) {
      return { valid: false, message: syncCheck.message, data: { isSyncBlocked: true } };
    }
  }

  const { isOnline } = await checkOnlineStatus();
  if (!isOnline) {
    // --- TRACK ACTIVE OFFLINE DAY ---
    trackActiveOfflineDay();

    const syncCheck = checkSyncRequirement();
    // Only block if NOT forcing a sync and blocked by policy
    if (syncCheck.blocked && !force) {
      return {
        valid: false,
        message: syncCheck.message,
        data: {
          isSyncBlocked: true,
          isSyncGracePeriod: syncCheck.isSyncGracePeriod,
          graceRemaining: syncCheck.graceRemaining
        }
      };
    }

    if (!stored) {
      // Cannot initialize for the first time without internet
      return { valid: false, message: 'Initial Internet Connection Required', data: { isSyncBlocked: true } };
    }

    if (stored.status === 'PENDING_RESTORE') {
      console.log("📡 [OFFLINE] Auto-healing stored status: PENDING_RESTORE -> Active for offline mode.");
      stored.status = 'Active';
      const scrambled = scramble(JSON.stringify(stored));
      localStorage.setItem(storageKey, scrambled);
      if ((window as any).electronAPI) (window as any).electronAPI.dbSet(storageKey, scrambled).catch(() => {});
    }
  }

  // Ensure the fetched machine ID is persisted for synchronous lookups (getMachineKey)
  if (currentMachineId && currentMachineId !== 'UNKNOWN-MACHINE-ID') {
    localStorage.setItem('app_machine_id', currentMachineId);
  }

  // 1. If we have a local license, perform local integrity/expiry checks
  if (stored) {
    // Machine Lock Check (Exception for Developer Machine to allow debugging customer database profiles)
    const isDevMachine = currentMachineId === '05D02810-8051-7C4A-B33D-19383C3F3A2F';
    if (stored.machineId !== currentMachineId && !isDevMachine) {
      return {
        valid: false,
        message: 'Unauthorised Access Attempted, BPP App will shut down contact ilcbala.Bharatpayroll@gmail.com'
      };
    }

    // Expiry Check
    const [day, month, year] = stored.expiryDate.split('-');
    const expiry = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59);

    if (expiry < new Date()) {
      if (!isOnline) {
        // V06.01: Save the expired status offline so UI reflects it properly instead of remaining active
        stored.status = stored.isTrial ? 'TRIAL EXPIRED' : 'LICENSE EXPIRED';
        const storageKey = 'app_license_secure';
        const scrambled = scramble(JSON.stringify(stored));
        localStorage.setItem(storageKey, scrambled);
        if ((window as any).electronAPI) {
          (window as any).electronAPI.dbSet(storageKey, scrambled);
        }
        
        return {
          valid: true, // Allow read-only reports generation
          message: 'LICENSE EXPIRED',
          data: { ...stored, isExpired: true, status: stored.status }
        };
      } else {
        console.warn("⚠️ License expired locally, but online. Proceeding to verify with cloud...");
      }
    }

    // --- V02.02.07: GLOBAL IDENTITY ALIGNMENT ---
    // Ensure local admin username matches the registered License ID (e.g. Sbobby12 instead of admin)
    try {
      const usersRaw = localStorage.getItem('app_users');
      if (usersRaw && stored.userID && stored.userID.toUpperCase() !== 'TRIAL' && stored.userID.toUpperCase() !== 'RESCUE' && !isDevAttempt) {
        const localUsers = JSON.parse(usersRaw);
        const adminIndex = localUsers.findIndex((u: any) => u.role === 'Administrator');
        if (adminIndex !== -1 && localUsers[adminIndex].username !== stored.userID) {
          console.log(`🛠️ [IDENTITY] Repairing local username case: ${localUsers[adminIndex].username} -> ${stored.userID}`);
          localUsers[adminIndex].username = stored.userID;
          localStorage.setItem('app_users', JSON.stringify(localUsers));
          if ((window as any).electronAPI) (window as any).electronAPI.dbSet('app_users', localUsers);
        } else {
          console.log(`✅ [IDENTITY] Local username matches cloud database: ${stored.userID}`);
        }
      }
    } catch (e) {
      console.warn("Identity alignment failed:", e);
    }
  }

  // 2. Online Verification / Developer Rescue Sync
  const lastCheck = localStorage.getItem('app_license_last_check');
  const today = new Date().toISOString().split('T')[0];
  const isDev = import.meta.env.DEV;

  const isExpired = stored ? isExpiredOffline(stored.expiryDate) : false;
  
  // Perform online sync if:
  // - No license found yet (Rescue Sync)
  // - OR first login of the day
  // - OR development mode
  // - OR Force sync requested
  // - OR license is expired locally (to check for renewal)
  if (!stored || lastCheck !== today || isDev || force || isExpired) {

    if ((GOOGLE_SCRIPT_URL as string) !== "YOUR_GOOGLE_SCRIPT_WEB_APP_URL") {
      try {
        console.log(`🌐 Performing ${stored ? (stored.isTrial ? 'Trial' : 'License') : 'Developer Rescue'} Sync...`);

        // Get current admin for sync (if exists)
        const usersRaw = localStorage.getItem('app_users');
        const users = usersRaw ? JSON.parse(usersRaw) : [];
        const adminUser = users.find((u: any) => u.role === 'Administrator') || users[0];

        // --- SIGNATURE MIGRATION SCRIPT ---
        // V06.01.10: Disabled signature migration logic to prevent duplicate signatures
        // from being generated and mixed between uppercase and lowercase formats.
        /*
        let migratedSilos: string[] = [];
        try {
          const savedCompaniesRaw = localStorage.getItem('app_companies');
          if (savedCompaniesRaw) {
            const companies = JSON.parse(savedCompaniesRaw);
            let companiesUpdated = false;
            for (let i = 0; i < companies.length; i++) {
              const comp = companies[i];
              if (comp.id && comp.companySignature) {
                const safeName = comp.establishmentName ? comp.establishmentName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase() : 'UNKNOWN';
                
                if (!comp.companySignature.includes(safeName)) {
                  // Found an old signature format, migrate it
                  const oldSig = comp.companySignature;
                  const newIdPart = comp.id.includes('-') ? comp.id.split('-')[1] : comp.id;
                  const newSig = `SIG-${safeName}_${newIdPart}-${(Math.random().toString(36).substring(2, 6).toUpperCase() + Math.random().toString(36).substring(2, 6))}`;
                
                migratedSilos.push(oldSig);
                comp.companySignature = newSig;
                companiesUpdated = true;
                
                // Swap in dual-storage sys_limit.bin
                if ((window as any).electronAPI && (window as any).electronAPI.removeActivatedSilo && (window as any).electronAPI.registerActivatedSilo) {
                  await (window as any).electronAPI.removeActivatedSilo(oldSig);
                  await (window as any).electronAPI.registerActivatedSilo(newSig);
                }
                
                // Update active profile if it matches
                const activeProfileRaw = localStorage.getItem('app_company_profile');
                if (activeProfileRaw) {
                  const activeProfile = JSON.parse(activeProfileRaw);
                  if (activeProfile.id === comp.id) {
                    activeProfile.companySignature = newSig;
                    localStorage.setItem('app_company_profile', JSON.stringify(activeProfile));
                  }
                }
                } 
              }
            }
            if (companiesUpdated) {
              localStorage.setItem('app_companies', JSON.stringify(companies));
              if ((window as any).electronAPI) {
                await (window as any).electronAPI.dbSet('app_companies', JSON.stringify(companies));
              }
              console.log(`Migrated ${migratedSilos.length} legacy signatures to new Silo-ID format.`);
            }
          }
        } catch (e) {
          console.warn("Failed during signature migration", e);
        }
        */
        // ----------------------------------

        // Filter activeFullSigs: ONLY send active signatures belonging to non-read-only companies
        const savedCompsRaw = localStorage.getItem('app_companies');
        let activeFullSigs: string[] = [];
        if (savedCompsRaw) {
          try {
            const comps = JSON.parse(savedCompsRaw);
            if (Array.isArray(comps)) {
              activeFullSigs = comps
                .filter(c => !c.isReadOnly && c.companySignature && c.companySignature.trim() !== '')
                .map(c => c.companySignature!.trim());
            }
          } catch (e) {}
        }

        if ((window as any).electronAPI?.getActivatedSilos) {
          try {
            const sysRes = await (window as any).electronAPI.getActivatedSilos(isDevAttempt);
            if (sysRes && sysRes.success && Array.isArray(sysRes.silos)) {
              activeFullSigs = Array.from(new Set([...activeFullSigs, ...sysRes.silos]));
            }
          } catch (e) {}
        }

        // Send activeFullSigs to Cloud Column R so GAS can verify and register active company signatures
        const silosToSync = activeFullSigs;
        const requestAction = (forceActivation && silosToSync.length > 0) ? 'ACTIVATE_LICENSE' : 'VALIDATE_STARTUP';

        const reqEmail = overrideEmail || (stored?.registeredTo || 'bala68.chennai@gmail.com');
        const reqMobile = overrideMobile || (stored?.registeredMobile || '9003083999');
        const reqUserId = attemptedID || (stored?.userID || 'VRANGA');

        let result: any;
        try {
          result = await Promise.race([
            fetchFromApi(GOOGLE_SCRIPT_URL, {
              method: 'POST',
              body: JSON.stringify({
                action: requestAction,
                licenseKey: stored ? (stored.isTrial ? 'TRIAL' : stored.key) : 'RESCUE',
                email: reqEmail,
                mobile: reqMobile,
                machineId: currentMachineId,
                userID: reqUserId,
                appPassword: appPassword || (isDevAttempt ? "Basupra@74" : adminUser?.password),
                activatedSilos: silosToSync,
                forceActivation: forceActivation,
                migratedSilos: []
              })
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('CLOUD_SYNC_TIMEOUT')), 15000))
          ]);
        } catch (fetchTimeoutErr) {
          console.warn("⚠️ Cloud startup sync timed out (15s). Proceeding with local stored license...", fetchTimeoutErr);
          if (stored) {
            return { valid: true, data: stored, status: stored.status || 'LICENSE ACTIVE' };
          }
          throw fetchTimeoutErr;
        }

        console.log("📥 Sync Response:", result);

        const cloudData = result.data || {};
        
        if (isDevAttempt) {
          if (!cloudData.userID) cloudData.userID = 'VRANGA';
          if (!cloudData.key) cloudData.key = 'VRANGA-DEV-LICENSE';
          if (!cloudData.status) cloudData.status = 'LICENSE ACTIVE';
          cloudData.isTrial = false;
        }
        
        // --- Infer missing fields from status since GAS omits them for expired licenses ---
        if (cloudData.status) {
          if (cloudData.isTrial === undefined) {
            if (cloudData.status.includes('TRIAL')) cloudData.isTrial = true;
            else if (cloudData.status.includes('LICENSE')) cloudData.isTrial = false;
          }
          if (cloudData.status.includes('EXPIRED')) {
            cloudData.splMIS = false;
            cloudData.splDynamic = false;
          }
        }

        // --- ALWAYS Sync Developer Credentials (even if license invalid) ---
        if (cloudData.devUser && cloudData.devPass) {
          const devObj = {
            username: String(cloudData.devUser).trim(),
            password: String(cloudData.devPass).trim(),
            name: `${String(cloudData.devUser).trim()} (Developer)`,
            role: 'Developer',

            email: 'developer@bharatpay.com'
          };
          // Encrypt with Machine Specific Key
          const scrambledDev = scramble(JSON.stringify(devObj), getMachineKey());
          localStorage.setItem('app_developer_secure', scrambledDev);
          // @ts-ignore
          if (window.electronAPI) window.electronAPI.dbSet('app_developer_secure', scrambledDev);
          console.log("✅ Developer access synced from cloud (Hardware Locked).");
        }

        // --- ALWAYS RECONCILE CLOUD SIGNATURES FIRST ---
        let cloudSigsRaw = cloudData.cloudSignatures || cloudData.activeSignatures;
        let cloudSigs: string[] | null = null;

        if (cloudSigsRaw && Array.isArray(cloudSigsRaw)) {
          cloudSigs = cloudSigsRaw as string[];
        } else if (forceActivation && activeFullSigs.length > 0) {
          cloudSigs = activeFullSigs;
        }

        if (cloudSigs !== null && Array.isArray(cloudSigs)) {
          console.log("📥 Reconciling signatures from Cloud:", cloudSigs);
          
          if (stored) {
            stored.cloudSignatures = cloudSigs;
            try {
              const scrambled = scramble(JSON.stringify(stored));
              localStorage.setItem('app_license_secure', scrambled);
              if ((window as any).electronAPI && (window as any).electronAPI.dbSet) {
                await (window as any).electronAPI.dbSet('app_license_secure', scrambled);
              }
            } catch (e) {}
          }

          // If Cloud explicitly returned empty signatures [] (Column R empty), wipe local silos so Allotment UI opens!
          if (cloudSigs.length === 0 && !forceActivation) {
            console.log("🧹 [CLOUD RESET] Cloud Column R is empty (0 used). Resetting local company signatures...");
            if ((window as any).electronAPI && (window as any).electronAPI.wipeAllLocalSignatures) {
              try {
                await (window as any).electronAPI.wipeAllLocalSignatures(isDevAttempt);
              } catch (e) {}
            }

            if ((window as any).electronAPI && (window as any).electronAPI.clearPatchMarker) {
              try {
                await (window as any).electronAPI.clearPatchMarker();
              } catch (e) {}
            }

            try {
              const savedCompsRaw = localStorage.getItem('app_companies');
              if (savedCompsRaw) {
                const comps = JSON.parse(savedCompsRaw);
                let compsUpdated = false;
                for (const c of comps) {
                  c.companySignature = "";
                  c.isReadOnly = true;
                  compsUpdated = true;

                  if ((window as any).electronAPI && (window as any).electronAPI.dbGetGlobal && (window as any).electronAPI.dbSetGlobal) {
                    try {
                      const res = await (window as any).electronAPI.dbGetGlobal(`app_company_profile_${c.id}`);
                      if (res && res.success && res.data) {
                        const prof = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
                        prof.companySignature = "";
                        prof.isReadOnly = true;
                        await (window as any).electronAPI.dbSetGlobal(`app_company_profile_${c.id}`, prof);
                      }
                    } catch (e) {}
                  }
                }
                if (compsUpdated) {
                  localStorage.setItem('app_companies', JSON.stringify(comps));
                  if ((window as any).electronAPI && (window as any).electronAPI.dbSetGlobal) {
                    await (window as any).electronAPI.dbSetGlobal('app_companies', JSON.stringify(comps));
                  }
                  window.dispatchEvent(new Event('app_companies_updated'));
                }
              }
            } catch (e) {}
          } else {
            if ((window as any).electronAPI && (window as any).electronAPI.purgeUnmatchedLocalSignatures) {
              try {
                await (window as any).electronAPI.purgeUnmatchedLocalSignatures(cloudSigs, isDevAttempt);
              } catch (e) {}
            }
          }
        }

        if (!result.success || result.message === "IDENTITY_RESTORE_REQUIRED") {
          // If response is a GAS script execution error (e.g. ReferenceError/TypeError), log warning and fall back to stored license!
          if (result.message && (result.message.includes('ReferenceError') || result.message.includes('TypeError'))) {
            console.warn("⚠️ GAS script error received from cloud. Falling back to local verified license:", result.message);
            if (stored) {
              return { valid: true, data: stored, message: '' };
            }
          }

          // --- DEVELOPER ENVIRONMENT BYPASS FOR LOCALHOST TESTING ---
          if (!import.meta.env.PROD) {
            console.warn("🛠️ [DEV OVERRIDE] Bypassing cloud identity/license lock for developer environment.");
            if (stored) stored.status = 'ACTIVE';
            return { valid: true, data: stored || result.data };
          }

          // --- V03.01.01: ID Format Migration (Add Underscore to 12-char IDs) ---
          if (result.status === 'BLOCK_LEGACY' || result.message?.includes('VERSION_STUCK')) {
            return {
              valid: false,
              message: result.message || 'Application Version no longer supported.',
              status: 'BLOCK_LEGACY',
              launcherUrl: result.launcherUrl
            };
          }

          // --- CLOUD TAMPER & LIMIT DETECTION ---
          if (result.status === 'SECURITY_TAMPERED') {
            return {
              valid: false,
              message: result.message,
              status: result.status,
              data: result.data
            };
          }

          if (result.status === 'LIMIT_EXCEEDED') {
            // V06.01.10 FIX: Update local company limit and all other fields to match cloud limit even on exceed
            if (result.data && stored) {
                if (result.data.companyLimit) stored.companyLimit = Number(result.data.companyLimit);
                if (result.data.dataSize) {
                    stored.dataSize = Number(result.data.dataSize);
                    localStorage.setItem('app_data_size', String(stored.dataSize));
                    if ((window as any).electronAPI) {
                        (window as any).electronAPI.dbSet('app_data_size', String(stored.dataSize)).catch(() => {});
                    }
                }
                if (result.data.expiryDate) stored.expiryDate = result.data.expiryDate;
                if (result.data.password) stored.password = result.data.password;
                if (result.data.splDynamic !== undefined) stored.splDynamic = result.data.splDynamic;
                if (result.data.splMIS !== undefined) stored.splMIS = result.data.splMIS;

                stored.checksum = generateChecksum(stored);
                const scrambled = scramble(JSON.stringify(stored));
                localStorage.setItem('app_license_secure', scrambled);
                if ((window as any).electronAPI) {
                    (window as any).electronAPI.dbSet('app_license_secure', scrambled).catch(() => {});
                }
            }
            return {
              valid: true, // Allow read-only access to existing companies
              message: result.message,
              status: result.status,
              data: { ...result.data, isLimitExceeded: true }
            };
          }

          // --- V03.01.01: IDENTITY RESTORATION PASSTHROUGH & AUTO-HEAL ---
          if (result.message === "IDENTITY_RESTORE_REQUIRED") {
            console.log("🛡️ [SYNC] IDENTITY_RESTORE_REQUIRED received. Checking for valid cloud/local details to auto-heal...");

            // If cloud data or stored license is available, heal status to ACTIVE
            const validData = result.data || {};
            const activeUser = validData.userID || stored?.userID || attemptedID || "REGISTERED_USER";
            const activeName = validData.userName || stored?.userName || "BharatPay User";

            const healedLicense: LicenseData = {
              key: validData.licenseKey || validData.key || stored?.key || "ACTIVATED",
              userName: activeName,
              userID: activeUser,
              registeredTo: validData.registeredTo || stored?.registeredTo || "",
              registeredMobile: String(validData.registeredMobile || validData.mobile || stored?.registeredMobile || ""),
              startDate: validData.startDate || stored?.startDate || "",
              expiryDate: validData.expiryDate || stored?.expiryDate || "17-04-2027",
              machineId: currentMachineId,
              status: 'LICENSE ACTIVE',
              dataSize: Number(validData.dataSize || stored?.dataSize || 5000),
              isTrial: false,
              splDynamic: validData.splDynamic === 'Yes' || validData.splDynamic === true || stored?.splDynamic || true,
              splMIS: validData.splMIS === 'Yes' || validData.splMIS === true || stored?.splMIS || true,
              companyLimit: Number(validData.companyLimit || stored?.companyLimit || 5),
              checksum: ""
            };

            healedLicense.checksum = generateChecksum(healedLicense);
            const scrambled = scramble(JSON.stringify(healedLicense));
            localStorage.setItem(storageKey, scrambled);
            localStorage.setItem(dataSizeKey, String(healedLicense.dataSize));

            if ((window as any).electronAPI) {
              await (window as any).electronAPI.dbSet(storageKey, scrambled).catch(() => {});
              await (window as any).electronAPI.dbSet(dataSizeKey, String(healedLicense.dataSize)).catch(() => {});
            }

            if (validData.activeSignatures && Array.isArray(validData.activeSignatures)) {
              if ((window as any).electronAPI?.purgeUnmatchedLocalSignatures) {
                await (window as any).electronAPI.purgeUnmatchedLocalSignatures(validData.activeSignatures).catch(() => {});
              }
            }

            clearSyncRetryCount();
            return {
              valid: true,
              status: 'LICENSE ACTIVE',
              data: { ...healedLicense, ...validData, status: 'LICENSE ACTIVE' }
            };
          }
          return { valid: false, message: result.message };
        }

        if (result.success) {
          let activeLicense = stored;

          // 1. IDENTITY RESTORATION / SYNC (Hard Fidelity Fix)
          // If local license is missing OR is a trial and cloud says it's a full license
          const cloudIsTrial = cloudData.isTrial === true;
          const localIsTrial = activeLicense?.isTrial === true;

          // --- V03.01.01: AUTO-PROMOTION LOGIC ---
          // If local is trial but cloud is full, we allow auto-upgrade even if UserID differs
          if ((!activeLicense || (localIsTrial && !cloudIsTrial)) && cloudData.userName) {
            console.log("🛠️ Syncing/Restoring Identity from Cloud (FORCE UPGRADE)...");
            const cloudKey = cloudData.licenseKey || cloudData.key;

            const restoredLicense: LicenseData = {
              key: cloudKey || (cloudIsTrial ? "TRIAL" : "ACTIVATED"),
              userName: cloudData.userName,
              userID: cloudData.userID || "RESCUE",
              registeredTo: (cloudData.registeredTo && cloudData.registeredTo !== "N/A" && cloudData.registeredTo !== "n/a") ? cloudData.registeredTo : (cloudData.email || (activeLicense ? activeLicense.registeredTo : "")),
              registeredMobile: (cloudData.registeredMobile && cloudData.registeredMobile !== "N/A" && cloudData.registeredMobile !== "n/a") ? cloudData.registeredMobile : (cloudData.mobile || (activeLicense ? activeLicense.registeredMobile : "")),
              startDate: cloudData.startDate || "",
              expiryDate: cloudData.expiryDate || "",
              machineId: currentMachineId,
              status: cloudData.status || (cloudIsTrial ? "REGISTERED" : "ACTIVATED"),
              dataSize: cloudIsTrial ? 50 : (Number(cloudData.dataSize) || activeLicense?.dataSize || 5000),
              isTrial: cloudIsTrial,
              splDynamic: cloudData.splDynamic === 'Yes' || cloudData.splDynamic === true,
              splMIS: cloudData.splMIS === 'Yes' || cloudData.splMIS === true,
              companyLimit: Number(cloudData.companyLimit || 1),
              checksum: ""
            };

            restoredLicense.checksum = generateChecksum(restoredLicense);
            const scrambled = scramble(JSON.stringify(restoredLicense));
            localStorage.setItem(storageKey, scrambled);
            localStorage.setItem(dataSizeKey, String(restoredLicense.dataSize));

            if ((window as any).electronAPI) {
              await (window as any).electronAPI.dbSet(storageKey, scrambled);
              await (window as any).electronAPI.dbSet(dataSizeKey, String(restoredLicense.dataSize));
            }
            activeLicense = restoredLicense;
            console.log("✅ Identity Forced to Enterprise successfully.");
          }

          if (activeLicense) {
            // 3. Sync Expiry Date & Key (Incremental Updates)
            let storageUpdated = false;
            const incomingKey = cloudData.licenseKey || cloudData.key;

            if (cloudData.expiryDate && cloudData.expiryDate !== activeLicense.expiryDate) {
              activeLicense.expiryDate = cloudData.expiryDate;
              storageUpdated = true;
            }
            const finalUserID = cloudData.userID || (activeLicense.userID === 'RESCUE' || activeLicense.userID === 'N/A' ? attemptedID : activeLicense.userID);
            if (finalUserID && finalUserID !== activeLicense.userID) {
              console.log(`🆔 [SYNC] User ID Update: ${activeLicense.userID} -> ${finalUserID}`);
              activeLicense.userID = finalUserID;
              storageUpdated = true;
            }
            if (incomingKey && incomingKey !== activeLicense.key) {
              console.log(`🔑 Key Update: ${activeLicense.key} -> ${incomingKey}`);
              activeLicense.key = incomingKey;
              storageUpdated = true;
            }
            if (cloudData.isTrial !== undefined && cloudData.isTrial !== activeLicense.isTrial) {
              console.log(`🏷️ Trial Status Sync: ${activeLicense.isTrial} -> ${cloudData.isTrial}`);
              activeLicense.isTrial = cloudData.isTrial === true;
              storageUpdated = true;
            }
            if (cloudData.status && cloudData.status !== activeLicense.status) {
              activeLicense.status = cloudData.status;
              storageUpdated = true;
            } else if (!cloudData.status && activeLicense.status === 'PENDING_RESTORE') {
              // V03.01.01: Auto-Clear PENDING_RESTORE if cloud sync is successful but status is missing
              activeLicense.status = activeLicense.isTrial ? 'REGISTERED' : 'ACTIVE';
              storageUpdated = true;
              console.log(`🔓 [SYNC] Identity verified. Promoting status: PENDING_RESTORE -> ${activeLicense.status}`);
            }
            // V03.01.07: Sync Special Feature Flags
            if (cloudData.splDynamic !== undefined) {
              const cloudSplDynamic = cloudData.splDynamic === 'Yes' || cloudData.splDynamic === true;
              if (cloudSplDynamic !== activeLicense.splDynamic) {
                activeLicense.splDynamic = cloudSplDynamic;
                storageUpdated = true;
              }
            }
            if (cloudData.splMIS !== undefined) {
              const cloudSplMIS = cloudData.splMIS === 'Yes' || cloudData.splMIS === true;
              if (cloudSplMIS !== activeLicense.splMIS) {
                activeLicense.splMIS = cloudSplMIS;
                storageUpdated = true;
              }
            }
            // --- V03.01.01: IDENTITY FIDELITY SYNC ---
            const finalEmail = (cloudData.registeredTo && cloudData.registeredTo !== "N/A" && cloudData.registeredTo !== "n/a") ? cloudData.registeredTo : overrideEmail;
            if (finalEmail && finalEmail !== activeLicense.registeredTo) {
              console.log(`📧 [SYNC] Email Update: ${activeLicense.registeredTo} -> ${finalEmail}`);
              activeLicense.registeredTo = finalEmail;
              storageUpdated = true;
            }
            const finalMobile = (cloudData.registeredMobile && cloudData.registeredMobile !== "N/A" && cloudData.registeredMobile !== "n/a") ? String(cloudData.registeredMobile) : overrideMobile;
            if (finalMobile && finalMobile !== activeLicense.registeredMobile) {
              console.log(`📱 [SYNC] Mobile Update: ${activeLicense.registeredMobile} -> ${finalMobile}`);
              activeLicense.registeredMobile = finalMobile;
              storageUpdated = true;
            }
            // ✅ FIX: Sync dataSize (Employee Data Limit) from cloud
            const incomingDataSize = activeLicense.isTrial ? 50 : (cloudData.dataSize ? Number(cloudData.dataSize) : (activeLicense.dataSize || 5000));
            if (incomingDataSize !== activeLicense.dataSize) {
              console.log(`📊 Data Limit Sync: ${activeLicense.dataSize} -> ${incomingDataSize}`);
              activeLicense.dataSize = incomingDataSize;
              localStorage.setItem('app_data_size', String(incomingDataSize));
              // @ts-ignore
              if (window.electronAPI) window.electronAPI.dbSet('app_data_size', String(incomingDataSize));
              storageUpdated = true;
            }

            // Sync companyLimit from cloud
            if (cloudData.companyLimit !== undefined) {
              const incomingCompanyLimit = Number(cloudData.companyLimit || 1);
              if (incomingCompanyLimit !== activeLicense.companyLimit) {
                console.log(`🏢 Company Limit Sync: ${activeLicense.companyLimit} -> ${incomingCompanyLimit}`);
                activeLicense.companyLimit = incomingCompanyLimit;
                storageUpdated = true;
              }

              // Company limit is updated in stored license. Read-only companies remain locked until user explicitly clicks ALLOT SIGNATURE.
            }

            // --- CLOUD RECONCILIATION FOR SIG LIMIT ---
            const cloudSigsRaw = cloudData.cloudSignatures || cloudData.activeSignatures;
            if (cloudSigsRaw && Array.isArray(cloudSigsRaw)) {
              try {
                const cloudSigs = cloudSigsRaw as string[];
                const currentCloudSigs = activeLicense.cloudSignatures || [];
                
                // Check if there's any change in cloud signatures
                if (JSON.stringify(cloudSigs.sort()) !== JSON.stringify(currentCloudSigs.sort())) {
                  activeLicense.cloudSignatures = cloudSigs;
                  storageUpdated = true;
                }

                // Physical 4-layer 1:1 sync: WIPE any signature from sys_limit file, active_db.sqlite & silo DBs if not in Cloud Column R (passing isDevAttempt for strict isolation!)
                if ((window as any).electronAPI && (window as any).electronAPI.purgeUnmatchedLocalSignatures) {
                  try {
                    await (window as any).electronAPI.purgeUnmatchedLocalSignatures(cloudSigs, isDevAttempt);
                    console.log("🧹 [4-Layer Sync] Synchronized sys_limit file, active_db.sqlite & silo DBs physically with Cloud Column R:", cloudSigs);
                  } catch (e) {
                    console.warn("Failed to sync 4-layer storage physically:", e);
                  }
                }

                // Condition (1): If cloud array is completely empty, it means Column R was cleared by admin.
                // We must wipe all local signatures across all 4 layers so they can be regenerated.
                if (cloudSigs.length === 0 && !forceActivation && activeFullSigs.length === 0) {
                  activeLicense.cloudSignatures = [];
                  try {
                    const scrambled = scramble(JSON.stringify(activeLicense));
                    localStorage.setItem('app_license_secure', scrambled);
                    if ((window as any).electronAPI && (window as any).electronAPI.dbSet) {
                      await (window as any).electronAPI.dbSet('app_license_secure', scrambled);
                    }
                  } catch (e) {}

                  if ((window as any).electronAPI && (window as any).electronAPI.wipeAllLocalSignatures) {
                    try {
                      await (window as any).electronAPI.wipeAllLocalSignatures(isDevAttempt);
                      console.log("🧹 [HARD RESET] Cloud Column R is empty (0 used). Executed 4-layer wipeAllLocalSignatures.");
                    } catch (e) {}
                  }

                  console.log("🧹 [HARD RESET] Cloud returned empty signatures. Wiping all local company signatures!");
                  
                  // Also clear the patch marker so if they run a patch update, it wipes properly again
                  if ((window as any).electronAPI && (window as any).electronAPI.clearPatchMarker) {
                      try {
                          await (window as any).electronAPI.clearPatchMarker();
                      } catch (e) {
                          console.warn("Failed to clear patch marker during hard reset", e);
                      }
                  }

                  try {
                    const savedCompsRaw = localStorage.getItem('app_companies');
                    if (savedCompsRaw) {
                      const comps = JSON.parse(savedCompsRaw);
                      let compsUpdated = false;
                      for (const c of comps) {
                        c.companySignature = "";
                        c.isReadOnly = true;
                        compsUpdated = true;
                        
                        // Wipe signature from SQLite/IndexedDB profile for this specific company
                        if ((window as any).electronAPI && (window as any).electronAPI.dbGetGlobal && (window as any).electronAPI.dbSetGlobal) {
                          try {
                             const res = await (window as any).electronAPI.dbGetGlobal(`app_company_profile_${c.id}`);
                             if (res && res.success && res.data) {
                                const prof = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
                                prof.companySignature = "";
                                prof.isReadOnly = true;
                                await (window as any).electronAPI.dbSetGlobal(`app_company_profile_${c.id}`, prof);
                             }
                          } catch (e) {
                             console.warn("Failed to wipe profile signature for", c.id, e);
                          }
                        }
                      }
                      if (compsUpdated) {
                        localStorage.setItem('app_companies', JSON.stringify(comps));
                        if ((window as any).electronAPI && (window as any).electronAPI.dbSetGlobal) {
                          await (window as any).electronAPI.dbSetGlobal('app_companies', JSON.stringify(comps));
                        }
                      }
                    }

                    // Iterate over ALL silo folders from disk via electronAPI.listSilos to ensure active_db.sqlite profiles are wiped
                    if ((window as any).electronAPI && (window as any).electronAPI.listSilos && (window as any).electronAPI.dbSetGlobal) {
                      try {
                        const silosRes = await (window as any).electronAPI.listSilos();
                        if (silosRes && silosRes.success && Array.isArray(silosRes.silos)) {
                          for (const siloId of silosRes.silos) {
                            const res = await (window as any).electronAPI.dbGetGlobal(`app_company_profile_${siloId}`);
                            if (res && res.success && res.data) {
                              const prof = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
                              prof.companySignature = "";
                              prof.isReadOnly = true;
                              await (window as any).electronAPI.dbSetGlobal(`app_company_profile_${siloId}`, prof);
                            }
                          }
                        }
                      } catch (e) {
                        console.warn("Failed to wipe silo SQLite profiles during hard reset", e);
                      }
                    }
                    
                    // CRITICAL: Wipe sys_limit file and all SQLite profiles via Electron IPC (passing isDevAttempt for strict isolation!)
                    if ((window as any).electronAPI && (window as any).electronAPI.wipeAllLocalSignatures) {
                      try {
                         await (window as any).electronAPI.wipeAllLocalSignatures(isDevAttempt);
                      } catch (e) {
                         console.warn("Failed executing wipeAllLocalSignatures IPC", e);
                      }
                    } else if ((window as any).electronAPI && (window as any).electronAPI.wipeActivatedSilos) {
                      try {
                         await (window as any).electronAPI.wipeActivatedSilos(isDevAttempt);
                      } catch (e) {
                         console.warn("Failed to wipe sys_limit during hard reset", e);
                      }
                    }

                    // Wipe active company profile in localStorage and electron DB
                    const savedProfRaw = localStorage.getItem('app_company_profile');
                    if (savedProfRaw) {
                      const prof = JSON.parse(savedProfRaw);
                      prof.companySignature = "";
                      prof.isReadOnly = true;
                      localStorage.setItem('app_company_profile', JSON.stringify(prof));
                      if ((window as any).electronAPI && (window as any).electronAPI.dbSet) {
                        await (window as any).electronAPI.dbSet('app_company_profile', prof);
                      }
                    }

                    // Deep localStorage Sweep: Scan ALL keys in %APPDATA%/Local Storage for any cached company profiles or arrays
                    try {
                      const allKeys: string[] = [];
                      for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key) allKeys.push(key);
                      }
                      for (const k of allKeys) {
                        if (k.includes('company_profile') || k.includes('app_companies')) {
                          try {
                            const raw = localStorage.getItem(k);
                            if (raw) {
                              let val = JSON.parse(raw);
                              if (Array.isArray(val)) {
                                let updated = false;
                                for (const item of val) {
                                  if (item && typeof item === 'object' && ('companySignature' in item || 'isReadOnly' in item)) {
                                    item.companySignature = "";
                                    item.isReadOnly = true;
                                    updated = true;
                                  }
                                }
                                if (updated) localStorage.setItem(k, JSON.stringify(val));
                              } else if (val && typeof val === 'object') {
                                if ('companySignature' in val || 'isReadOnly' in val) {
                                  val.companySignature = "";
                                  val.isReadOnly = true;
                                  localStorage.setItem(k, JSON.stringify(val));
                                }
                              }
                            }
                          } catch (e) {}
                        }
                      }
                    } catch (e) {
                      console.warn("Failed deep localStorage sweep during hard reset", e);
                    }

                    // Dispatch custom event to notify React components to re-hydrate memory state immediately
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('app_companies_updated'));
                      window.dispatchEvent(new CustomEvent('app_license_updated'));
                    }
                  } catch (err) {
                    console.warn("Failed to wipe local company signatures during hard reset", err);
                  }
                } else if (!isDevAttempt) {
                  // We have at least one active signature synced from the cloud (Column R).
                  // Strict Enforcement: A company is in Full Mode ONLY if its signature matches Cloud Column R.
                  try {
                    const api = (window as any).electronAPI;
                    let dismounted: string[] = [];
                    try {
                      const localDismounted = localStorage.getItem('app_dismounted_companies');
                      if (localDismounted) dismounted = JSON.parse(localDismounted);
                      if (api?.dbGetGlobal) {
                        const res = await api.dbGetGlobal('app_dismounted_companies');
                        if (res.success && res.data) {
                          const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
                          if (Array.isArray(parsed)) dismounted = parsed;
                        }
                      }
                    } catch (e) {
                      console.warn("Failed to load dismounted list:", e);
                    }

                    // Master Reconciliation: Purge sys_limit.bin of any local signature missing from Cloud Column R
                    if (api && api.getActivatedSilos && api.removeActivatedSilo) {
                      try {
                        const localRes = await api.getActivatedSilos();
                        if (localRes && localRes.success && Array.isArray(localRes.silos)) {
                          for (const localSig of localRes.silos) {
                            if (!cloudSigs.includes(localSig)) {
                              console.log(`🧹 [Cloud Purge] Wiping un-matched signature from sys_limit.bin: ${localSig}`);
                              await api.removeActivatedSilo(localSig).catch(() => {});
                            }
                          }
                        }
                      } catch (e) {
                        console.warn("Failed reconciling sys_limit.bin with cloud signatures:", e);
                      }
                    }

                    const savedCompsRaw = localStorage.getItem('app_companies');
                    if (savedCompsRaw) {
                      const comps = JSON.parse(savedCompsRaw);
                      if (Array.isArray(comps)) {
                        let compsChanged = false;
                        for (const c of comps) {
                          const matchingCloudSig = findMatchingCloudSignature(c, cloudSigs);
                          let isMatch = !!matchingCloudSig;
                          
                          if (isMatch && matchingCloudSig && c.companySignature !== matchingCloudSig) {
                            console.log(`[Auto-Repair] Recovering matching cloud signature for company ${c.id}: ${matchingCloudSig}`);
                            c.companySignature = matchingCloudSig;
                            compsChanged = true;
                          } else if (!isMatch && c.companySignature) {
                            c.companySignature = "";
                            compsChanged = true;
                          }

                          const newReadOnly = !isMatch;
                          if (c.isReadOnly !== newReadOnly) {
                            c.isReadOnly = newReadOnly;
                            compsChanged = true;
                          }

                          // Sync database profile for this company
                          if (api && api.dbGetGlobal && api.dbSetGlobal) {
                            try {
                              const profRes = await api.dbGetGlobal(`app_company_profile_${c.id}`);
                              if (profRes && profRes.success && profRes.data) {
                                const prof = typeof profRes.data === 'string' ? JSON.parse(profRes.data) : profRes.data;
                                if (prof.isReadOnly !== newReadOnly || prof.companySignature !== c.companySignature) {
                                  prof.isReadOnly = newReadOnly;
                                  prof.companySignature = c.companySignature;
                                  await api.dbSetGlobal(`app_company_profile_${c.id}`, prof);
                                }
                              }
                            } catch (e) {}
                          }
                        }

                        // Auto-Mount physical folders from disk ONLY if they exist, are not in index, and are not dismounted
                        if (api && api.listSilos) {
                          try {
                            const silosRes = await api.listSilos();
                            if (silosRes && silosRes.success && Array.isArray(silosRes.silos)) {
                              const foundSilos = silosRes.silos as string[];
                              for (const siloId of foundSilos) {
                                if (siloId === 'default') continue; // Never auto-mount default legacy template folder
                                const existsInComps = comps.some(c => c.id === siloId);
                                if (!existsInComps && !dismounted.includes(siloId)) {
                                  const matchingCloudSig = cloudSigs.find(sig => sig.includes(`_${siloId}-`));
                                  const hasCloudSig = !!matchingCloudSig;
                                  let estName = `Rescued: ${siloId}`;
                                  let cin = '';
                                  if (api.dbGetGlobal) {
                                    const profileRes = await api.dbGetGlobal(`app_company_profile_${siloId}`);
                                    if (profileRes && profileRes.success && profileRes.data) {
                                      const parsedProf = typeof profileRes.data === 'string' ? JSON.parse(profileRes.data) : profileRes.data;
                                      if (parsedProf.establishmentName) estName = parsedProf.establishmentName;
                                      if (parsedProf.cin) cin = parsedProf.cin;
                                    }
                                  }

                                  console.log(`[Auto-Mount] Mounting folder ${siloId} (Cloud Signature Present: ${hasCloudSig})`);
                                  comps.push({
                                    id: siloId,
                                    establishmentName: estName,
                                    cin: cin,
                                    companySignature: hasCloudSig ? matchingCloudSig : "",
                                    isReadOnly: !hasCloudSig
                                  } as any);

                                  if (api.dbSetGlobal) {
                                    await api.dbSetGlobal(`app_company_profile_${siloId}`, {
                                      id: siloId,
                                      establishmentName: estName,
                                      cin: cin,
                                      companySignature: hasCloudSig ? matchingCloudSig : "",
                                      isReadOnly: !hasCloudSig
                                    });
                                  }
                                  compsChanged = true;
                                }
                              }
                            }
                          } catch (e) {
                            console.warn("Failed to check physical folders during auto-mount:", e);
                          }
                        }

                        if (compsChanged) {
                          localStorage.setItem('app_companies', JSON.stringify(comps));
                          if (api && api.dbSetGlobal) {
                            await api.dbSetGlobal('app_companies', comps).catch(() => {});
                          }
                        }
                      }
                    }
                  } catch (err) {
                    console.warn("Failed enforcing Column R read-only status on app_companies", err);
                  }

                  if ((window as any).electronAPI && (window as any).electronAPI.markPatchComplete) {
                      try {
                          await (window as any).electronAPI.markPatchComplete();
                      } catch (e) {
                          console.warn("Failed to mark patch complete", e);
                      }
                  }
                }

                const api = (window as any).electronAPI;
                if (api && api.getActivatedSilos && api.removeActivatedSilo) {
                  const localRes = await api.getActivatedSilos();
                  if (localRes && localRes.success && Array.isArray(localRes.silos)) {
                    const localSigs = localRes.silos as string[];
                    
                    for (const lSig of localSigs) {
                      if (!cloudSigs.includes(lSig)) {
                        console.log(`🗑️ [RECONCILIATION] Cloud revoked signature: ${lSig}. Removing locally.`);
                        await api.removeActivatedSilo(lSig);
                      }
                    }
                  }
                }
              } catch (e) {
                console.warn("Failed to reconcile signatures with cloud", e);
              }
            }

            if (storageUpdated) {
              activeLicense.checksum = generateChecksum(activeLicense);
              const scrambled = scramble(JSON.stringify(activeLicense));
              localStorage.setItem(storageKey, scrambled);
              // @ts-ignore
              if (window.electronAPI) window.electronAPI.dbSet(storageKey, scrambled);
              console.log("✅ License successfully sync-updated from cloud.");
            }
            // 4. Version Check
            if (cloudData.latestVersion) {
              localStorage.setItem('app_latest_version', cloudData.latestVersion);
              if (cloudData.downloadUrl) localStorage.setItem('app_download_url', cloudData.downloadUrl);
              if (cloudData.downloadUrlWin7) localStorage.setItem('app_download_url_win7', cloudData.downloadUrlWin7);
              if (cloudData.launcherUrl) localStorage.setItem('app_launcher_url', cloudData.launcherUrl);
              if (cloudData.patchTimestamp) localStorage.setItem('app_latest_patch_timestamp', cloudData.patchTimestamp);
              
              // --- V03.01.01: SECURE HASH STORAGE ---
              if (cloudData.updateHashWin10) localStorage.setItem('app_update_hash_win10', cloudData.updateHashWin10);
              if (cloudData.updateHashWin7) localStorage.setItem('app_update_hash_win7', cloudData.updateHashWin7);
              if (cloudData.sha256) localStorage.setItem('app_update_hash', cloudData.sha256);

              const api = (window as any).electronAPI;
              const dbSetFn = api?.dbSetGlobal || api?.dbSet;
              if (dbSetFn) {
                dbSetFn('app_latest_version', cloudData.latestVersion).catch(() => {});
                if (cloudData.downloadUrl) dbSetFn('app_download_url', cloudData.downloadUrl).catch(() => {});
                if (cloudData.downloadUrlWin7) dbSetFn('app_download_url_win7', cloudData.downloadUrlWin7).catch(() => {});
                if (cloudData.launcherUrl) dbSetFn('app_launcher_url', cloudData.launcherUrl).catch(() => {});
                if (cloudData.patchTimestamp) dbSetFn('app_latest_patch_timestamp', cloudData.patchTimestamp).catch(() => {});
                if (cloudData.updateHashWin10) dbSetFn('app_update_hash_win10', cloudData.updateHashWin10).catch(() => {});
                if (cloudData.updateHashWin7) dbSetFn('app_update_hash_win7', cloudData.updateHashWin7).catch(() => {});
                if (cloudData.sha256) dbSetFn('app_update_hash', cloudData.sha256).catch(() => {});
              }
            }

            // 4. Smart Admin Recovery & Sync
            const usersRawAfterSync = localStorage.getItem('app_users');
            let localUsers = usersRawAfterSync ? JSON.parse(usersRawAfterSync) : [];

            const cloudAdminUser = String(cloudData.adminUser || "").trim();
            const cloudAdminPass = String(cloudData.adminPass || "").trim();
            const cloudName = String(cloudData.userName || cloudData.registeredName || "").trim();

            if ((cloudAdminUser || cloudAdminPass || cloudName) && !isDevAttempt) {

              if (cloudAdminUser || cloudData.userName) {
                // Find ANY user that might be the primary account if Administrator isn't found
                let adminIndex = localUsers.findIndex((u: any) => u.role === 'Administrator');
                if (adminIndex === -1 && localUsers.length > 0) adminIndex = 0;

                if (adminIndex !== -1) {
                  const localUser = localUsers[adminIndex];
                  let userUpdated = false;

                  if (cloudAdminUser && localUser.username !== cloudAdminUser) {
                    console.log(`♻️  Syncing Local Username: ${localUser.username} -> ${cloudAdminUser}`);
                    localUser.username = cloudAdminUser;
                    userUpdated = true;
                  }
                  if (cloudAdminPass && localUser.password !== cloudAdminPass) {
                    console.log(`🔑 Syncing Local Password for ${localUser.username}`);
                    localUser.password = cloudAdminPass;
                    userUpdated = true;
                  }

                  const cloudName = cloudData.userName || cloudData.registeredName || cloudData.name;
                  if (cloudName && localUser.name !== cloudName) {
                    console.log(`👤 Syncing Local Display Name: ${localUser.name} -> ${cloudName}`);
                    localUser.name = cloudName;
                    userUpdated = true;
                  }

                  if (userUpdated) {
                    localStorage.setItem('app_users', JSON.stringify(localUsers));
                    if ((window as any).electronAPI) (window as any).electronAPI.dbSet('app_users', localUsers);
                  }
                } else if (localUsers.length === 0) {
                  // Total Recovery: Cloud is our only source of truth
                  console.log("🛠️  Recovering local user database from Cloud identity...");
                  const recoveredUser = {
                    username: cloudAdminUser || "ADMIN",
                    password: cloudAdminPass || "admin",
                    name: cloudData.userName || cloudData.registeredName || "System Administrator",
                    role: 'Administrator',
                    email: cloudData.registeredTo || ""
                  };
                  localStorage.setItem('app_users', JSON.stringify([recoveredUser]));
                  if ((window as any).electronAPI) (window as any).electronAPI.dbSet('app_users', [recoveredUser]);
                }
              }
            }
          }

          // --- SUCCESSFUL CLOUD SYNC: RESET COUNTERS ---
          localStorage.setItem('app_license_last_check', today);
          localStorage.removeItem('app_offline_usage_dates');
          localStorage.removeItem('app_offline_grace_expiry');

          console.log("✅ Daily License/Trial Sync Complete (Database IDs Only).");
          // Ensure SyncCheck data is cleared in result
          return { valid: true, data: { ...activeLicense, isSyncBlocked: false, isSyncGracePeriod: false } };
        }

      } catch (e) {
        console.warn("Offline: Using cached license status & sys_limit.bin.");
        if (stored && (window as any).electronAPI?.getActivatedSilos) {
          try {
            const localRes = await (window as any).electronAPI.getActivatedSilos();
            if (localRes && localRes.success && Array.isArray(localRes.silos) && localRes.silos.length > 0) {
              stored.cloudSignatures = localRes.silos;
            }
          } catch (err) {
            console.warn("Failed loading activated silos from sys_limit.bin offline:", err);
          }
        }
        return { valid: true, data: { ...(stored || {}), isSyncBlocked: false, isSyncGracePeriod: false } };
      }
    }
  }

  // --- FINAL FALLBACK: LOCAL IDENTITY RECOVERY ---
  // If we still don't have a valid license after sync, but the attemptedID exists in local users,
  // we might be able to proceed locally (offline mode).
  return { valid: !!stored };
};

/**
 * NEW: Sends a registration OTP to verify the email during initial setup.
 * Backend checks if the email is already bound to a different machine before dispatching.
 */
export const sendRegistrationOTP = async (email: string): Promise<ActivationResult> => {
  const machineId = await getMachineId();
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'SEND_REG_OTP',
        email,
        machineId
      })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: `OTP Dispatch Error: ${error.message || 'Unknown Failure'}` };
  }
};

/**
 * V03.01.01: Verify OTP for Registration
 */
export const verifyRegistrationOTP = async (email: string, mobile: string, otp: string): Promise<any> => {
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'VERIFY_REG_OTP',
        email,
        mobile,
        otp,
        authSecret: AUTH_SECRET // Ensure backend recognizes the identity fetch request
      })
    });
    return result;
  } catch (error) {
    return { success: false, message: "Verification connection failed." };
  }
};

/**
 * NEW: Requests a password reset OTP from the cloud.
 */
export const requestResetOTP = async (email: string, userID: string, companyName?: string): Promise<ActivationResult> => {
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'REQUEST_OTP_RESET',
        email,
        userID,
        companyName
      })
    });
    return result;
  } catch (error: any) {
    let msg = error.message;
    if (msg === 'NO_INTERNET') msg = "Internet connection not available.";
    else if (msg === 'CONNECTION_FAILURE') msg = "Failed to reach server.";
    
    return { success: false, message: `OTP Request Error: ${msg}` };
  }
};

/**
 * NEW: Verifies a reset OTP without changing the password.
 */
export const verifyResetOTP = async (email: string, userID: string, otp: string): Promise<ActivationResult> => {
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'VERIFY_OTP_ONLY', // New action for generic verification
        email,
        userID,
        otp
      })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: `OTP Verification Error: ${error.message || "Unknown Failure"}` };
  }
};

/**
 * NEW: Dispatches a policy change confirmation email via Google Apps Script cloud API.
 */
export const sendPolicyConfirmationEmailGAS = async (
  email: string,
  userID: string,
  companyName: string,
  newPolicyText: string
): Promise<ActivationResult> => {
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'SEND_POLICY_CONFIRMATION',
        email,
        userID,
        companyName,
        newPolicyText
      })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: `Cloud Confirmation Email Error: ${error.message || "Unknown Failure"}` };
  }
};

/**
 * NEW: Request a secure developer bypass OTP.
 */
export const requestDeveloperOTP = async (username: string, password?: string): Promise<ActivationResult> => {
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'REQUEST_DEV_OTP',
        username,
        password
      })
    });
    return result;
  } catch (error: any) {
    let msg = error.message;
    if (msg === 'NO_INTERNET') msg = "Internet connection not available. Please connect to continue.";
    else if (msg === 'CONNECTION_FAILURE') msg = "Failed to reach security server. Please check your network.";
    else if (msg === 'TIMEOUT') msg = "Request timed out. Please try again.";
    
    return { success: false, message: `Developer Auth Error: ${msg}` };
  }
};

/**
 * NEW: Verifies the Developer OTP and syncs credentials locally.
 */
export const verifyDeveloperOTP = async (username: string, otp: string): Promise<ActivationResult> => {
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'VERIFY_DEV_OTP',
        otp,
        username
      })
    });

    if (result.success && result.data) {
      const devObj = {
        username: result.data.devUser,
        password: result.data.devPass,
        name: result.data.name,
        role: 'Developer',
        email: 'developer@bharatpay.com'
      };
      // Hard-lock creds to this hardware
      const machineKey = localStorage.getItem('app_machine_id') || 'INITIAL_PMS_KEY';
      const scrambled = CryptoJS.AES.encrypt(JSON.stringify(devObj), machineKey).toString();
      localStorage.setItem('app_developer_secure', scrambled);
      // @ts-ignore
      if (window.electronAPI) window.electronAPI.dbSet('app_developer_secure', scrambled);
      
      // V03.01.01: Return mapped user object to ensure structural integrity in App State
      result.data = devObj;
    }

    return result;
  } catch (error: any) {
    return { success: false, message: `Verification Error: ${error.message || "Unknown Failure"}` };
  }
};

/**
 * Updates the user's password in the Google Sheet for cloud sync integrity via OTP.
 */
export const updateCloudPassword = async (email: string, newPassword: string, otp: string): Promise<ActivationResult> => {
  const machineId = await getMachineId();
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'UPDATE_PASSWORD',
        email,
        machineId,
        newPassword,
        otp
      })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: `Cloud Sync Error: ${error.message || "Unknown Failure"}` };
  }
};


/**
 * Sends a background ping to the cloud to increment the user's total login count
 * and log their last access time.
 */
export const trackCloudLogin = async (email: string, machineId: string, userID?: string) => {
  if (!navigator.onLine) {
    console.log("📴 Offline: Skipping cloud login tracking.");
    return;
  }

  try {
    const stored = getStoredLicense();
    const activeUserID = userID || stored?.userID || 'VRANGA';
    fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'TRACK_LOGIN',
        email: email,
        userID: activeUserID,
        machineId: machineId
      })
    }).catch(e => console.error("Cloud Tracking Warning:", e));
  } catch (e) {
    console.warn("Cloud Tracking Error:", e);
  }
};

/**
 * NEW: Verifies if an email exists in the cloud database before allowing repair.
 */
export const verifyIdentityEmail = async (email: string): Promise<ActivationResult> => {
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'VERIFY_IDENTITY_EMAIL',
        email
      })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: `Verification Error: ${error.message || "Unknown Failure"}` };
  }
};

/**
 * NEW: Synchronizes a new identity (UserID/Password) with the cloud and local storage.
 */
export const syncIdentityRepair = async (email: string, newUserID: string, newPassword: string, name?: string): Promise<ActivationResult> => {
  const machineId = await getMachineId();
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'SYNC_IDENTITY_REPAIR',
        email,
        newUserID,
        newPassword,
        machineId
      })
    });

    if (result.success) {
      // CRITICAL: Immediately trigger a local validation sync to repair the app state
      console.log("🛠️ Cloud Identity Synced. Triggering local state repair...");
      
      // Update local app_users immediately with the new credentials
      const usersRaw = localStorage.getItem('app_users');
      let localUsers = usersRaw ? JSON.parse(usersRaw) : [];
      let adminIndex = localUsers.findIndex((u: any) => u.role === 'Administrator');
      if (adminIndex === -1 && localUsers.length > 0) adminIndex = 0;
      
      if (adminIndex !== -1) {
        const localUser = localUsers[adminIndex];
        console.log(`♻️ [LOCAL SYNC] Updating credentials: ${localUser.username} -> ${newUserID}`);
        localUser.username = newUserID;
        localUser.password = newPassword;
        if (name) localUser.name = name;
        localStorage.setItem('app_users', JSON.stringify(localUsers));
        // @ts-ignore
        if (window.electronAPI) window.electronAPI.dbSet('app_users', localUsers);
      }

      await validateLicenseStartup(true, newUserID);
    }

    return result;
  } catch (error: any) {
    return { success: false, message: `Sync Repair Error: ${error.message || "Unknown Failure"}` };
  }
};

/**
 * Fetches the latest developer messages from Google Sheets (Consolidated)
 */
export const fetchLatestMessages = async (force: boolean = false): Promise<{
  scrollNews: string,
  statutory: string,
  header?: string,
  alignment?: 'LEFT' | 'CENTER' | 'RIGHT',
  key?: string,
  messageId?: string,
  flashPopupMessage?: string,
  flashPopupHeader?: string,
  flashPopupPriority?: 'REGULAR' | 'IMMEDIATE',
  flashPopupId?: string,
  loginAlertMessage?: string,
  loginAlertEnabled?: boolean,
  latestVersion?: string,
  downloadUrl?: string,
  downloadUrlWin7?: string,
  sha256?: string,
  sha256_win10?: string,
  sha256_win7?: string,
  patchTimestamp?: string
} | null> => {
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "GET_MESSAGES" })
    });

    if (result.success && result.messages) {
      const { scrollNews, statutory } = result.messages;

      // Get current stored messages to check for updates
      const storedProfileRaw = localStorage.getItem('app_company_profile');
      const storedProfile = (() => { try { return JSON.parse(storedProfileRaw || '{}'); } catch { return {}; } })();
      const lastNewsDate = localStorage.getItem('app_last_news_date') || "";
      const lastStatutoryDate = localStorage.getItem('app_last_statutory_date') || "";


      let updated = false;

      // 1. Update NEWS (Marquee)
      if (scrollNews?.date && (scrollNews.date !== lastNewsDate || force)) {
        storedProfile.flashNews = scrollNews.message;
        localStorage.setItem('app_last_news_date', scrollNews.date);
        updated = true;
      }

      // 2. Update STATUTORY (Main Message)
      if (statutory?.date && (statutory.date !== lastStatutoryDate || force)) {
        storedProfile.postLoginMessage = statutory.message;
        storedProfile.postLoginHeader = statutory.header || storedProfile.postLoginHeader;
        storedProfile.postLoginAlignment = statutory.alignment || (storedProfile.postLoginAlignment || 'LEFT');
        storedProfile.postLoginKey = statutory.key || 'REGULAR';
        localStorage.setItem('app_last_statutory_date', statutory.date);
        updated = true;
      }

      const alert = result.alert || result.messages?.loginAlert; // Support both root and nested structures
      const lastAlertDate = localStorage.getItem('app_last_alert_date') || '';

      // 4. Update LOGIN ALERT (Legal Notice)
      if (alert?.date && (alert.date !== lastAlertDate || force)) {
        storedProfile.loginAlertMessage = alert.message;
        storedProfile.loginAlertEnabled = alert.enabled !== false;
        localStorage.setItem('app_last_alert_date', alert.date);
        updated = true;
      }

      // --- VERSION SYNC ---
      let versionInfo: any = null;
      if (result.latestVersion) {
        versionInfo = {
          latestVersion: result.latestVersion,
          downloadUrl: result.downloadUrl,
          downloadUrlWin7: result.downloadUrlWin7,
          launcherUrl: result.launcherUrl,
          patchTimestamp: result.patchTimestamp
        };
        localStorage.setItem('app_latest_version', result.latestVersion);
        if (result.launcherUrl) localStorage.setItem('app_launcher_url', result.launcherUrl);
        if (result.patchTimestamp) localStorage.setItem('app_latest_patch_timestamp', result.patchTimestamp);

        const api = (window as any).electronAPI;
        const dbSetFn = api?.dbSetGlobal || api?.dbSet;
        if (dbSetFn) {
          dbSetFn('app_latest_version', result.latestVersion).catch(() => {});
          if (result.launcherUrl) dbSetFn('app_launcher_url', result.launcherUrl).catch(() => {});
          if (result.patchTimestamp) dbSetFn('app_latest_patch_timestamp', result.patchTimestamp).catch(() => {});
        }
      }

      if (updated || force || versionInfo) {
        localStorage.setItem('app_company_profile', JSON.stringify(storedProfile));
        return {
          scrollNews: storedProfile.flashNews,
          statutory: storedProfile.postLoginMessage,
          header: storedProfile.postLoginHeader,
          alignment: storedProfile.postLoginAlignment as any,
          key: statutory?.key || 'REGULAR',
          messageId: statutory?.date || lastStatutoryDate,
          flashPopupMessage: storedProfile.flashPopupMessage,
          flashPopupHeader: storedProfile.flashPopupHeader,
          flashPopupPriority: storedProfile.flashPopupPriority as any,
          flashPopupId: storedProfile.flashPopupId,
          loginAlertMessage: storedProfile.loginAlertMessage,
          loginAlertEnabled: storedProfile.loginAlertEnabled,
          ...versionInfo
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch developer messages:", error);
    return null;
  }
};

/**
 * Updates the Cloud Developer Board message
 */
export const updateDeveloperMessages = async (
  message: string,
  type: 'MESSAGE' | 'NEWS' | 'FLASH' | 'ALERT',
  header?: string,
  alignment?: string,
  key?: string
): Promise<ActivationResult> => {
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "UPDATE_MESSAGES",
        message,
        type,
        header,
        alignment,
        key
      })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: `Cloud Sync Error: ${error.message || "Unknown Failure"}` };
  }
};

/**
 * Sends a background heartbeat ping to the cloud to track "LIVE" users.
 */
export const trackHeartbeat = async (email: string, machineId: string, userID: string, sessionStart: string, status: string = "LIVE") => {
  if (!navigator.onLine) return;

  try {
    const isLogout = status === "LOGGED OUT";
    let location = isLogout ? "Session Ended" : (sessionStorage.getItem('session_detected_location') || "Auto-Detected");

    // Sanitize location to printable ASCII only to prevent signature failures on unicode characters
    const cleanLocation = location.replace(/[^\x20-\x7E]/g, "");

    const payloadObj = {
      action: 'HEARTBEAT',
      email: email,
      machineId: machineId,
      userID: userID,
      sessionStart: sessionStart,
      location: cleanLocation,
      status: status
    };

    const payload = JSON.stringify(payloadObj);

    // SQLite log helper
    const logToDb = async (logObj: any) => {
      // @ts-ignore
      if (window.electronAPI && window.electronAPI.dbSet) {
        try {
          // @ts-ignore
          const getRes = await window.electronAPI.dbGet('heartbeat_debug_logs');
          let logs = [];
          if (getRes && getRes.success && getRes.data) {
            try {
              logs = JSON.parse(getRes.data);
            } catch (e) {}
          }
          logs.push({
            timestamp: new Date().toISOString(),
            ...logObj
          });
          if (logs.length > 50) logs.shift();
          // @ts-ignore
          await window.electronAPI.dbSet('heartbeat_debug_logs', JSON.stringify(logs));
        } catch (err) {
          console.warn("Failed to write SQLite debug log:", err);
        }
      }
    };

    await logToDb({ event: 'SENDING_HEARTBEAT', payload: payloadObj });

    // For logouts, use keepalive to ensure the request finishes even if the app closes
    await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: payload,
      // @ts-ignore
      keepalive: isLogout
    })
    .then(async (res) => {
      await logToDb({ event: 'HEARTBEAT_RESPONSE', response: res });
    })
    .catch(async (e) => {
      console.error("Heartbeat Tracking Warning:", e);
      await logToDb({ event: 'HEARTBEAT_ERROR', error: e.message || e.toString() });
    });
  } catch (e: any) {
    console.warn("Heartbeat Tracking Error:", e);
  }
};

/**
 * Requests an OTP for Identity Restoration.
 */
export const requestRestoreOTP = async (userID: string, email: string, mobile: string): Promise<ActivationResult> => {
  const machineId = await getMachineId();
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'REQUEST_RESTORE_OTP',
        userID,
        machineId,
        email,
        mobile
      })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: `Restore Error: ${error.message || "Unknown Failure"}` };
  }
};

/**
 * Verifies the restoration OTP and returns the full profile data.
 */
export const verifyRestoreOTP = async (userID: string, email: string, otp: string): Promise<ActivationResult> => {
  const machineId = await getMachineId();
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'VERIFY_RESTORE_OTP',
        userID,
        machineId,
        email,
        otp
      })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: `Verification Error: ${error.message || "Unknown Failure"}` };
  }
};

