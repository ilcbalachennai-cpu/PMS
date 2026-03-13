
import { LicenseData, AppVersion } from '../types';

// Replace this with your deployed Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxYnFPLmvE1vCxLXVG53Ja1qx2VIeMZAz1b2v1-Kgh1k5b1bgo5lZnGM5Y3--r-uKbd/exec";

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
 * Simple scrambling/encryption to make the local license data tamper-proof.
 */
const SECRET_PEPPER = "BPP_PRO_2026_SECURE_VAL";

const scramble = (data: string): string => {
  const salted = data + "|" + SECRET_PEPPER;
  return btoa(salted.split('').map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ (SECRET_PEPPER.charCodeAt(i % SECRET_PEPPER.length)))
  ).join(''));
};

const unscramble = (scrambled: string): string | null => {
  try {
    const decoded = atob(scrambled);
    const unsalted = decoded.split('').map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ (SECRET_PEPPER.charCodeAt(i % SECRET_PEPPER.length)))
    ).join('');
    const parts = unsalted.split('|');
    if (parts[parts.length - 1] !== SECRET_PEPPER) return null;
    return parts.slice(0, -1).join('|');
  } catch (e) { return null; }
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
      // Fallback/Legacy check
      const raw = localStorage.getItem('app_license');
      return raw ? JSON.parse(raw) : null;
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
    return await res.json();
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
export const validateLicenseStartup = async (): Promise<{ valid: boolean; message?: string }> => {
  const stored = getStoredLicense();
  if (!stored) return { valid: false, message: 'No license or trial registration found.' };

  const currentMachineId = await getMachineId();

  // 1. Strict Machine Lock Check (Local)
  if (stored.machineId !== currentMachineId) {
    return {
      valid: false,
      message: 'Unauthorised Access Attempted, BPP App will shut down contact ilcbala.BharatPayRoll@gmail.com'
    };
  }

  // 2. Expiry Check (Local)
  // Parse DD-MM-YYYY robustly
  const [day, month, year] = stored.expiryDate.split('-');
  const expiry = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59);

  if (expiry < new Date()) {
    return {
      valid: false,
      message: 'License Expired to renew Contact ilcbala.BharatPayRoll@gmail.com'
    };
  }

  // 3. Daily Online Verification Sync
  const lastCheck = localStorage.getItem('app_license_last_check');
  const today = new Date().toISOString().split('T')[0];
  const isDev = (import.meta as any).env.DEV || (import.meta as any).env.MODE === 'development';

  // Perform online sync only if first login of the day (or dev mode)
  if ((lastCheck !== today || isDev) && (GOOGLE_SCRIPT_URL as string) !== "YOUR_GOOGLE_SCRIPT_WEB_APP_URL") {
    try {
      console.log(`🌐 Performing Daily ${stored.isTrial ? 'Trial' : 'License'} Sync...`);

      // Get current admin for credential sync/backup
      const usersRaw = localStorage.getItem('app_users');
      const users = usersRaw ? JSON.parse(usersRaw) : [];
      const adminUser = users.find((u: any) => u.role === 'Administrator') || users[0];

      console.log("📤 Sending Validation Request:", {
        action: 'VALIDATE_STARTUP',
        licenseKey: stored.isTrial ? 'TRIAL' : stored.key,
        email: stored.registeredTo,
        mobile: stored.registeredMobile,
        machineId: currentMachineId,
        userID: stored.userID,
      });

      const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'VALIDATE_STARTUP',
          licenseKey: stored.isTrial ? 'TRIAL' : stored.key,
          email: stored.registeredTo,
          mobile: stored.registeredMobile,
          machineId: currentMachineId,
          userID: stored.userID,
          appPassword: adminUser?.password // Sync current app password back to cloud
        })
      });

      console.log("📥 Validation Response:", result);

      if (!result.success) {
        return { valid: false, message: result.message };
      }

      if (result.success) {
        const cloudData = result.data || {};

        // 1. Sync Data Limit
        if (cloudData.dataSize) {
          const newLimit = Number(cloudData.dataSize);
          if (newLimit !== stored.dataSize) {
            stored.dataSize = newLimit;
            stored.checksum = generateChecksum(stored);
            const scrambled = scramble(JSON.stringify(stored));
            localStorage.setItem('app_license_secure', scrambled);
            localStorage.setItem('app_data_size', String(newLimit));
            // @ts-ignore
            if (window.electronAPI) {
              // @ts-ignore
              window.electronAPI.dbSet('app_license_secure', scrambled);
              // @ts-ignore
              window.electronAPI.dbSet('app_data_size', String(newLimit));
            }
            console.log(`✅ Data Limit synced from cloud: ${newLimit}`);
          }
        }

        // 2. Version Check
        if (cloudData.latestVersion) {
          localStorage.setItem('app_latest_version', cloudData.latestVersion);
          if (cloudData.downloadUrl) localStorage.setItem('app_download_url', cloudData.downloadUrl);
        }

        // 3. Smart Admin Recovery & Sync
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
          } else if (localUsers.length === 0) {
            // Recover missing admin
            const recoveredAdmin = {
              username: cloudAdminUser || 'admin',
              password: cloudAdminPass || 'admin@123',
              name: stored.userName || 'System Administrator',
              role: 'Administrator',
              email: stored.registeredTo
            };
            localUsers = [recoveredAdmin];
            localStorage.setItem('app_users', JSON.stringify(localUsers));
            // @ts-ignore
            if (window.electronAPI) window.electronAPI.dbSet('app_users', localUsers);
          }
        }

        console.log("✅ Daily License/Trial Sync Complete.");
      }
    } catch (e) {
      console.warn("Offline: Using cached license status.");
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

export const APP_VERSION = "1.0.12";
/**
 * Fetches the latest developer messages from Google Sheets
 */
export const fetchLatestMessages = async (): Promise<{ scrollNews: string, statutory: string } | null> => {
  try {
    const result = await fetchFromApi(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "GET_MESSAGES" })
    });

    if (result.success && result.messages) {
      const { scrollNews, statutory } = result.messages;

      // Get current stored messages to check for updates
      const storedProfile = JSON.parse(localStorage.getItem('app_company_profile') || '{}');
      const lastNewsDate = localStorage.getItem('app_last_news_date') || "";
      const lastStatutoryDate = localStorage.getItem('app_last_statutory_date') || "";

      let updated = false;

      if (scrollNews.date && scrollNews.date !== lastNewsDate) {
        storedProfile.flashNews = scrollNews.message;
        localStorage.setItem('app_last_news_date', scrollNews.date);
        updated = true;
      }

      if (statutory.date && statutory.date !== lastStatutoryDate) {
        storedProfile.postLoginMessage = statutory.message;
        localStorage.setItem('app_last_statutory_date', statutory.date);
        updated = true;
      }

      if (updated) {
        localStorage.setItem('app_company_profile', JSON.stringify(storedProfile));

        // Also check for version here if available in messages
        if (result.latestVersion) {
          localStorage.setItem('app_latest_version', result.latestVersion);
          if (result.downloadUrl) localStorage.setItem('app_download_url', result.downloadUrl);
        }

        return {
          scrollNews: storedProfile.flashNews,
          statutory: storedProfile.postLoginMessage
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch developer messages:", error);
    return null;
  }
};
