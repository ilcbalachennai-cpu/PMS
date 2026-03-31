
import CryptoJS from 'crypto-js';
import { LicenseData } from '../types';

// Replace this with your deployed Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbycEpjAIjHnGDzIhlv9iu-_WPTEclB8HKMgIwbZlQ9JqrbCgQsQsM61draKRPBqyOHb/exec";

export interface ActivationResult {
  success: boolean;
  message: string;
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
    // @ts-ignore
    if (window.electronAPI && window.electronAPI.apiFetch) {
      // @ts-ignore
      return await window.electronAPI.apiFetch(url, options);
    }
    const res = await fetch(url, options);
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
export const validateLicenseStartup = async (force: boolean = false): Promise<{ valid: boolean; message?: string }> => {
  const stored = getStoredLicense();
  const currentMachineId = await getMachineId();

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
  }

  // 2. Online Verification / Developer Rescue Sync
  const lastCheck = localStorage.getItem('app_license_last_check');
  const today = new Date().toISOString().split('T')[0];
  const isDev = (window as any).process?.env?.NODE_ENV === 'development';

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
            userID: stored?.userID || 'RESCUE',
            appPassword: adminUser?.password 
          })
        });

        console.log("📥 Sync Response:", result);

      const cloudData = result.data || {};

      // --- ALWAYS Sync Developer Credentials (even if license invalid) ---
      if (cloudData.devUser && cloudData.devPass) {
        const devObj = {
          username: cloudData.devUser,
          password: cloudData.devPass,
          name: String(cloudData.devUser).toUpperCase(),
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
        return { valid: false, message: result.message };
      }

        if (result.success) {
          let activeLicense = stored;

          // 1. IDENTITY RESTORATION (Rescue/Restoration Sync)
          // If local license is missing but Cloud recognizes the identity, re-create it locally!
          if (!activeLicense && cloudData.userName && cloudData.status) {
            console.log("🛠️ Restoring Identity from Cloud Sync...");
            const restoredLicense: any = {
               key: cloudData.licenseKey || (cloudData.isTrial ? "TRIAL" : "RESCUE"),
               userName: cloudData.userName,
               userID: cloudData.userID || "RESCUE",
               registeredTo: cloudData.registeredTo,
               registeredMobile: cloudData.registeredMobile,
               startDate: cloudData.startDate,
               expiryDate: cloudData.expiryDate,
               machineId: currentMachineId,
               status: cloudData.status,
               dataSize: Number(cloudData.dataSize) || 50,
               isTrial: cloudData.isTrial === true
            };
            
            // Checksum & persistence
            restoredLicense.checksum = generateChecksum(restoredLicense);
            const scrambled = scramble(JSON.stringify(restoredLicense));
            localStorage.setItem('app_license_secure', scrambled);
            localStorage.setItem('app_data_size', String(restoredLicense.dataSize));
            // @ts-ignore
            if (window.electronAPI) {
              // @ts-ignore
              window.electronAPI.dbSet('app_license_secure', scrambled);
              // @ts-ignore
              window.electronAPI.dbSet('app_data_size', String(restoredLicense.dataSize));
            }
            activeLicense = restoredLicense;
            console.log("✅ Identity Restored Successfully.");
          }

          if (activeLicense) {
            // 3. Sync Expiry Date & Key
            let storageUpdated = false;
            if (cloudData.expiryDate && cloudData.expiryDate !== activeLicense.expiryDate) {
              activeLicense.expiryDate = cloudData.expiryDate;
              storageUpdated = true;
            }
            if (cloudData.licenseKey && cloudData.licenseKey !== activeLicense.key) {
              activeLicense.key = cloudData.licenseKey;
              storageUpdated = true;
            }

            if (storageUpdated) {
              activeLicense.checksum = generateChecksum(activeLicense);
              const scrambled = scramble(JSON.stringify(activeLicense));
              localStorage.setItem('app_license_secure', scrambled);
              // @ts-ignore
              if (window.electronAPI) window.electronAPI.dbSet('app_license_secure', scrambled);
              console.log("✅ License Key/Expiry synced from cloud.");
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

            if (cloudData.adminUser || cloudData.adminPass) {
              const cloudAdminUser = cloudData.adminUser;
              const cloudAdminPass = cloudData.adminPass;

              const adminIndex = localUsers.findIndex((u: any) => u.role === 'Administrator');

              if (adminIndex !== -1) {
                // Update existing if changed in cloud
                if (localUsers[adminIndex].username !== cloudAdminUser || localUsers[adminIndex].password !== cloudAdminPass) {
                  localUsers[adminIndex].username = cloudAdminUser;
                  localUsers[adminIndex].password = cloudAdminPass;
                  localStorage.setItem('app_users', JSON.stringify(localUsers));
                  // @ts-ignore
                  if (window.electronAPI) window.electronAPI.dbSet('app_users', localUsers);
                }
              } else if (localUsers.length === 0 && cloudAdminUser) {
                // Recover missing admin using restored identity info (NO defaults!)
                const recoveredAdmin = {
                  username: cloudAdminUser,
                  password: cloudAdminPass,
                  name: activeLicense ? activeLicense.userName : 'System Administrator',
                  role: 'Administrator',
                  email: activeLicense ? activeLicense.registeredTo : ''
                };
                localUsers = [recoveredAdmin];
                localStorage.setItem('app_users', JSON.stringify(localUsers));
                // @ts-ignore
                if (window.electronAPI) window.electronAPI.dbSet('app_users', localUsers);
              }
            }
          }

          localStorage.setItem('app_license_last_check', today);
          console.log("✅ Daily License/Trial Sync Complete (Database IDs Only).");
        }

      } catch (e) {
        console.warn("Offline: Using cached license status.");
      }
    }
  }

  return { valid: true };
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

export const APP_VERSION = "02.01.05";
/**
 * Fetches the latest developer messages from Google Sheets
 */
export const fetchLatestMessages = async (): Promise<{ scrollNews: string, statutory: string, header?: string, alignment?: 'LEFT' | 'CENTER' | 'RIGHT', key?: string, messageId?: string } | null> => {
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "GET_MESSAGES" })
    });

    if (result.success && result.messages) {
      const { scrollNews, statutory, header, alignment, key, messageId } = result.messages;

      // Get current stored messages to check for updates
      const storedProfileRaw = localStorage.getItem('app_company_profile');
      const storedProfile = (() => { try { return JSON.parse(storedProfileRaw || '{}'); } catch { return {}; } })();
      const lastNewsDate = localStorage.getItem('app_last_news_date') || "";
      const lastStatutoryDate = localStorage.getItem('app_last_statutory_date') || "";

      let updated = false;

      if (scrollNews?.date && scrollNews.date !== lastNewsDate) {
        storedProfile.flashNews = scrollNews.message;
        localStorage.setItem('app_last_news_date', scrollNews.date);
        updated = true;
      }

      if (statutory?.date && statutory.date !== lastStatutoryDate) {
        storedProfile.postLoginMessage = statutory.message;
        storedProfile.postLoginHeader = header || storedProfile.postLoginHeader;
        storedProfile.postLoginAlignment = alignment || storedProfile.postLoginAlignment;
        localStorage.setItem('app_last_statutory_date', statutory.date);
        updated = true;
      }

      if (updated || key === 'IMMEDIATE') {
        localStorage.setItem('app_company_profile', JSON.stringify(storedProfile));

        // Also check for version here if available in messages
        if (result.latestVersion) {
          localStorage.setItem('app_latest_version', result.latestVersion);
          if (result.downloadUrl) localStorage.setItem('app_download_url', result.downloadUrl);
          if (result.downloadUrlWin7) localStorage.setItem('app_download_url_win7', result.downloadUrlWin7);
        }

        return {
          scrollNews: storedProfile.flashNews,
          statutory: storedProfile.postLoginMessage,
          header: storedProfile.postLoginHeader,
          alignment: storedProfile.postLoginAlignment,
          key: key,
          messageId: messageId || statutory?.date || lastStatutoryDate
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
 * Updates the cloud Developer Board messages (Push from App to Cloud)
 */
export const updateDeveloperMessages = async (scrollNews: string, statutory: string, header?: string, alignment?: string): Promise<ActivationResult> => {
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "UPDATE_MESSAGES",
        scrollNews,
        statutory,
        header,
        alignment,
        key: "UPDATED"
      })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: `Cloud Sync Error: ${error.message || "Unknown Failure"}` };
  }
};
