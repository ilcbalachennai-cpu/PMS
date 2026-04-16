import CryptoJS from 'crypto-js';
import { LicenseData, User } from '../types';

// Replace this with your deployed Google Apps Script Web App URL
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbycEpjAIjHnGDzIhlv9iu-_WPTEclB8HKMgIwbZlQ9JqrbCgQsQsM61draKRPBqyOHb/exec";
export const APP_VERSION = "02.02.17";
const BPP_AUTH_SECRET = "BPP-ULTIMATE-V2-SECURE";

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
  if (!mid) {
    mid = 'WEB-' + Math.random().toString(36).substring(2, 15).toUpperCase();
    localStorage.setItem('app_machine_id', mid);
  }
  return mid;
};

/**
 * Helper for fetch with timeout
 */
const fetchWithTimeout = async (url: string, options: any, timeout = 8000) => {
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
  const key = customKey || SECRET_PEPPER;

  try {
    // 1. Try Modern AES Decryption
    const bytes = CryptoJS.AES.decrypt(scrambled, key);
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
  const str = JSON.stringify(rest);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
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
      if (now < lastKnown) {
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

export const getStoredLicense = (): LicenseData | null => {
  try {
    const scrambled = localStorage.getItem('app_license_secure');
    if (!scrambled) {
      try {
        const raw = localStorage.getItem('app_license');
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    }

    const unscrambled = unscramble(scrambled);
    if (!unscrambled) return null;

    const data: LicenseData = JSON.parse(unscrambled);

    // Integrity Check
    const { checksum, ...rest } = data;
    const calculatedChecksum = generateChecksum(rest);
    if (checksum !== calculatedChecksum) {
      console.error("License Integrity Compromised! Expected:", checksum, "Got:", calculatedChecksum);
      console.error("Data payload that failed:", JSON.stringify(rest));
      return null;
    }

    return data;
  } catch (e) {
    console.error("Exception in getStoredLicense:", e);
    return null;
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
  try {
    // --- V02.02.15: AUTOMATIC AUTHORIZATION INJECTION ---
    if (options.method === 'POST' && options.body) {
      try {
        const bodyObj = JSON.parse(options.body);
        bodyObj.authSecret = BPP_AUTH_SECRET;
        options.body = JSON.stringify(bodyObj);
      } catch (e) {
        console.warn("API Auth Injection failed: Body is not JSON.");
      }
    }

    // @ts-ignore
    if (window.electronAPI && window.electronAPI.apiFetch) {
      // @ts-ignore
      return await window.electronAPI.apiFetch(url, options);
    }
    const res = await fetchWithTimeout(url, options, 8000); // 8s timeout
    try {
      return await res.json();
    } catch { return { success: false, message: 'Invalid JSON response from server' }; }
  } catch (error) {
    console.error("API Fetch Error:", error);
    throw error;
  }
};

/**
 * Trial Registration logic using Google Sheets.
 */
export const registerTrial = async (
  userName: string,
  userID: string,
  email: string,
  mobile: string
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
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'REGISTER_TRIAL',
        userName,
        userID,
        email,
        mobile,
        machineId
      })
    });
    // ... rest of the logic
    if (result.success) {
      const respData = result.data || {};
      const isHistorical = !!respData.startDate && respData.startDate !== new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

      const licenseData: LicenseData = {
        key: 'TRIAL',
        status: respData.status || 'REGISTERED',
        userName: userName,
        userID: userID,
        registeredTo: email,
        registeredMobile: String(mobile),
        machineId: machineId,
        password: respData.password || "AS_REGISTERED",
        dataSize: Number(respData.dataSize || 50),
        startDate: respData.startDate || new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        expiryDate: respData.expiryDate || "",
        isTrial: true,
        checksum: ''
      };

      licenseData.checksum = generateChecksum(licenseData);
      const scrambled = scramble(JSON.stringify(licenseData));
      localStorage.setItem('app_license_secure', scrambled);
      localStorage.setItem('app_data_size', String(licenseData.dataSize));
      localStorage.setItem('app_machine_id', licenseData.machineId);

      // Sync to electron DB
      if ((window as any).electronAPI) {
        await (window as any).electronAPI.dbSet('app_license_secure', scrambled);
        await (window as any).electronAPI.dbSet('app_data_size', String(licenseData.dataSize));
        await (window as any).electronAPI.dbSet('app_machine_id', licenseData.machineId);
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
  mobile: string
): Promise<ActivationResult> => {
  const machineId = await getMachineId();
  const cleanKey = licenseKey.replace(/[^0-9A-Z]/g, '');

  if (!isValidKeyFormat(cleanKey)) {
    return { success: false, message: 'Invalid License Key format.' };
  }

  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'ACTIVATE_LICENSE',
        licenseKey: cleanKey,
        userName,
        userID,
        email,
        mobile,
        machineId
      })
    });

    if (result.success) {
      const respData = result.data || {};
      const licenseData: LicenseData = {
        key: cleanKey,
        status: respData.status || 'REGISTERED',
        userName: userName,
        userID: userID,
        registeredTo: email,
        registeredMobile: String(mobile),
        machineId: machineId,
        password: respData.password || "AS_REGISTERED",
        dataSize: Number(respData.dataSize || 5000),
        startDate: respData.startDate || new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        expiryDate: respData.expiryDate || "",
        isTrial: false,
        checksum: ''
      };

      licenseData.checksum = generateChecksum(licenseData);
      const scrambled = scramble(JSON.stringify(licenseData));
      localStorage.setItem('app_license_secure', scrambled);
      localStorage.setItem('app_data_size', String(licenseData.dataSize));
      localStorage.setItem('app_machine_id', licenseData.machineId);

      // Sync to electron DB
      if ((window as any).electronAPI) {
        await (window as any).electronAPI.dbSet('app_license_secure', scrambled);
        await (window as any).electronAPI.dbSet('app_data_size', String(licenseData.dataSize));
        await (window as any).electronAPI.dbSet('app_machine_id', licenseData.machineId);
      }
      localStorage.setItem('app_license_last_check', new Date().toISOString().split('T')[0]);
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
export const validateLicenseStartup = async (force: boolean = false, attemptedID?: string): Promise<{ valid: boolean; message?: string; data?: any }> => {
    // --- V02.02.12: FORCE INITIALIZATION OF SECURITY MARKERS ---
    // This ensures app_time_sync and other local markers are set BEFORE any blocking checks
    const timeCheck = trackActivityTime();
    const currentMachineId = await getMachineId();
    console.log(`[LICENSE] Hardware ID for Sync: ${currentMachineId}`);
    
    const stored = getStoredLicense();
    
    // 1. OFFLINE ENFORCEMENT (Strict)
    if (stored) {
      if (isExpiredOffline(stored.expiryDate)) {
        return { valid: false, message: 'LICENSE EXPIRED', data: { isExpired: true } };
      }
      
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
    }

  // Ensure the fetched machine ID is persisted for synchronous lookups (getMachineKey)
  if (currentMachineId && currentMachineId !== 'UNKNOWN-MACHINE-ID') {
    localStorage.setItem('app_machine_id', currentMachineId);
  }

  // 1. If we have a local license, perform local integrity/expiry checks
  if (stored) {
    // Machine Lock Check
    if (stored.machineId !== currentMachineId) {
      return {
        valid: false,
        message: 'Unauthorised Access Attempted, BPP App will shut down contact ilcbala.BharatPayRoll@gmail.com'
      };
    }

    // Expiry Check
    const [day, month, year] = stored.expiryDate.split('-');
    const expiry = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59);

    if (expiry < new Date()) {
      return {
        valid: false,
        message: 'License Expired to renew Contact ilcbala.BharatPayRoll@gmail.com'
      };
    }

    // --- V02.02.07: GLOBAL IDENTITY ALIGNMENT ---
    // Ensure local admin username matches the registered License ID (e.g. Sbobby12 instead of admin)
    try {
      const usersRaw = localStorage.getItem('app_users');
      if (usersRaw && stored.userID && stored.userID.toUpperCase() !== 'TRIAL' && stored.userID.toUpperCase() !== 'RESCUE') {
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

  // Perform online sync if:
  // - No license found yet (Rescue Sync)
  // - OR first login of the day
  // - OR development mode
  // - OR Force sync requested
  if (!stored || lastCheck !== today || isDev || force) {

    if ((GOOGLE_SCRIPT_URL as string) !== "YOUR_GOOGLE_SCRIPT_WEB_APP_URL") {
      try {
        console.log(`🌐 Performing ${stored ? (stored.isTrial ? 'Trial' : 'License') : 'Developer Rescue'} Sync...`);

        // Get current admin for sync (if exists)
        const usersRaw = localStorage.getItem('app_users');
        const users = usersRaw ? JSON.parse(usersRaw) : [];
        const adminUser = users.find((u: any) => u.role === 'Administrator') || users[0];

        const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'VALIDATE_STARTUP',
            licenseKey: stored ? (stored.isTrial ? 'TRIAL' : stored.key) : 'RESCUE',
            email: stored?.registeredTo || 'RESCUE',
            mobile: stored?.registeredMobile || 'RESCUE',
            machineId: currentMachineId,
            userID: attemptedID || (stored?.userID || 'RESCUE'),
            appPassword: adminUser?.password 
          })
        });

        console.log("📥 Sync Response:", result);

        const cloudData = result.data || {};

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

        if (!result.success) {
          // --- V02.02.15: IDENTITY RESTORATION PASSTHROUGH ---
          if (result.message === "IDENTITY_RESTORE_REQUIRED") {
             return { 
               valid: false, 
               message: result.message, 
               status: 'PENDING_RESTORE',
               data: result.data 
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
          
          if ((!activeLicense || (localIsTrial && !cloudIsTrial)) && cloudData.userName) {
            console.log("🛠️ Syncing/Restoring Identity from Cloud (FORCE UPGRADE)...");
            const cloudKey = cloudData.licenseKey || cloudData.key;
            
            const restoredLicense: LicenseData = {
               key: cloudKey || (cloudIsTrial ? "TRIAL" : "ACTIVATED"),
               userName: cloudData.userName,
               userID: cloudData.userID || "RESCUE",
               registeredTo: cloudData.registeredTo || cloudData.email || "",
               registeredMobile: cloudData.registeredMobile || cloudData.mobile || "",
               startDate: cloudData.startDate || "",
               expiryDate: cloudData.expiryDate || "",
               machineId: currentMachineId,
               status: cloudData.status || (cloudIsTrial ? "REGISTERED" : "ACTIVATED"),
               dataSize: Number(cloudData.dataSize) || (cloudIsTrial ? 50 : 5000),
               isTrial: cloudIsTrial,
               checksum: ""
            };
            
            restoredLicense.checksum = generateChecksum(restoredLicense);
            const scrambled = scramble(JSON.stringify(restoredLicense));
            localStorage.setItem('app_license_secure', scrambled);
            localStorage.setItem('app_data_size', String(restoredLicense.dataSize));

            if ((window as any).electronAPI) {
              await (window as any).electronAPI.dbSet('app_license_secure', scrambled);
              await (window as any).electronAPI.dbSet('app_data_size', String(restoredLicense.dataSize));
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
            if (cloudData.userID && cloudData.userID !== activeLicense.userID) {
              console.log(`🆔 [SYNC] Cloud User ID mismatch detected: ${activeLicense.userID} -> ${cloudData.userID}`);
              activeLicense.userID = cloudData.userID;
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
            }
            // ✅ FIX: Sync dataSize (Employee Data Limit) from cloud
            const incomingDataSize = cloudData.dataSize ? Number(cloudData.dataSize) : 0;
            if (incomingDataSize > 0 && incomingDataSize !== activeLicense.dataSize) {
              console.log(`📊 Data Limit Update: ${activeLicense.dataSize} -> ${incomingDataSize}`);
              activeLicense.dataSize = incomingDataSize;
              localStorage.setItem('app_data_size', String(incomingDataSize));
              // @ts-ignore
              if (window.electronAPI) window.electronAPI.dbSet('app_data_size', String(incomingDataSize));
              storageUpdated = true;
            }

            if (storageUpdated) {
              activeLicense.checksum = generateChecksum(activeLicense);
              const scrambled = scramble(JSON.stringify(activeLicense));
              localStorage.setItem('app_license_secure', scrambled);
              // @ts-ignore
              if (window.electronAPI) window.electronAPI.dbSet('app_license_secure', scrambled);
              console.log("✅ License successfully sync-updated from cloud.");
            }

            // 4. Version Check
            if (cloudData.latestVersion) {
              localStorage.setItem('app_latest_version', cloudData.latestVersion);
              if (cloudData.downloadUrl) localStorage.setItem('app_download_url', cloudData.downloadUrl);
              if (cloudData.downloadUrlWin7) localStorage.setItem('app_download_url_win7', cloudData.downloadUrlWin7);
            }

            // 4. Smart Admin Recovery & Sync
            const usersRawAfterSync = localStorage.getItem('app_users');
            let localUsers = usersRawAfterSync ? JSON.parse(usersRawAfterSync) : [];

            const cloudAdminUser = String(cloudData.adminUser || "").trim();
            const cloudAdminPass = String(cloudData.adminPass || "").trim();

            if (cloudAdminUser || cloudAdminPass) {

              if (cloudAdminUser) {
                // Find ANY user that might be the primary account if Administrator isn't found
                let adminIndex = localUsers.findIndex((u: any) => u.role === 'Administrator');
                if (adminIndex === -1 && localUsers.length > 0) adminIndex = 0; 

                if (adminIndex !== -1) {
                  const localUser = localUsers[adminIndex];
                  if (localUser.username !== cloudAdminUser || localUser.password !== cloudAdminPass) {
                    console.log(`♻️  Syncing Local User Profile: ${localUser.username} -> ${cloudAdminUser}`);
                    localUser.username = cloudAdminUser;
                    localUser.password = cloudAdminPass;
                    
                    // Also update the name if the cloud provides it
                    if (cloudData.userName) localUser.name = cloudData.userName;

                    localStorage.setItem('app_users', JSON.stringify(localUsers));
                    if ((window as any).electronAPI) (window as any).electronAPI.dbSet('app_users', localUsers);
                  }
                } else if (localUsers.length === 0) {
                  // Total Recovery: Cloud is our only source of truth
                  console.log("🛠️  Recovering local user database from Cloud identity...");
                  const recoveredUser = {
                    username: cloudAdminUser,
                    password: cloudAdminPass,
                    name: cloudData.userName || "System Administrator",
                    role: 'Administrator',
                    email: cloudData.registeredTo || cloudData.registeredTo || ""
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
          return { valid: true, data: { ...cloudData, isSyncBlocked: false, isSyncGracePeriod: false } };
        }

      } catch (e) {
        console.warn("Offline: Using cached license status.");
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
 * NEW: Verifies the OTP sent during initial registration email verification.
 */
export const verifyRegistrationOTP = async (email: string, otp: string): Promise<ActivationResult> => {
    try {
        const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'VERIFY_REG_OTP',
                email,
                otp
            })
        });
        return result;
    } catch (error: any) {
        return { success: false, message: `OTP Verification Error: ${error.message || 'Unknown Failure'}` };
    }
};

/**
 * NEW: Requests a password reset OTP from the cloud.
 */
export const requestResetOTP = async (email: string, userID: string): Promise<ActivationResult> => {
    try {
        const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'REQUEST_OTP_RESET',
                email,
                userID
            })
        });
        return result;
    } catch (error: any) {
        return { success: false, message: `OTP Request Error: ${error.message || "Unknown Failure"}` };
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
        return { success: false, message: `Developer Auth Error: ${error.message || "Unknown Failure"}` };
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
export const trackCloudLogin = async (email: string, machineId: string) => {
  if (!navigator.onLine) {
    console.log("📴 Offline: Skipping cloud login tracking.");
    return;
  }

  try {
    fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'TRACK_LOGIN',
        email: email,
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
export const syncIdentityRepair = async (email: string, newUserID: string, newPassword: string): Promise<ActivationResult> => {
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
  latestVersion?: string,
  downloadUrl?: string,
  downloadUrlWin7?: string
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

      const alert = result.alert; // { message, enabled, date }
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
          downloadUrlWin7: result.downloadUrlWin7
        };
        localStorage.setItem('app_latest_version', result.latestVersion);
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
    // Attempt multi-provider location detection
    let location = "Auto-Detecting...";
    try {
      const locRes = await Promise.any([
        fetch('https://ipapi.co/json/').then(r => r.json()),
        fetch('http://ip-api.com/json').then(r => r.json())
      ]);
      
      if (locRes.city && (locRes.country_name || locRes.country)) {
        location = `${locRes.city}, ${locRes.country_name || locRes.country}`;
      } else if (locRes.region) {
        location = `${locRes.region}, ${locRes.country || 'India'}`;
      }
    } catch (e) {
      console.warn("Location detection failed:", e);
      location = "Auto-Detected";
    }

    fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'HEARTBEAT',
        email: email,
        machineId: machineId,
        userID: userID,
        sessionStart: sessionStart,
        location: location,
        status: status
      })
    }).catch(e => console.error("Heartbeat Tracking Warning:", e));
  } catch (e) {
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
