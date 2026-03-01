
import { LicenseData, AppVersion } from '../types';

// Replace this with your deployed Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = "YOUR_GOOGLE_SCRIPT_WEB_APP_URL";

export interface ActivationResult {
  success: boolean;
  message: string;
  dataSize?: number;
  expiryDate?: string;
  isTrial?: boolean;
  data?: any;
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
    if (checksum !== generateChecksum(rest)) {
      console.error("License Integrity Compromised!");
      return null;
    }

    return data;
  } catch (e) { return null; }
};

/**
 * Validates a 16-digit license key format.
 */
export const isValidKeyFormat = (key: string): boolean => {
  const cleanKey = key.replace(/[^0-9A-Z]/g, '');
  return cleanKey.length === 16;
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
    const demoData: LicenseData = {
      key: "TRIAL",
      userName: userName,
      userID: userID,
      password: "DEMO_PASSWORD",
      registeredTo: email,
      registeredMobile: mobile,
      machineId: machineId,
      startDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      expiryDate: "31-12-2026",
      dataSize: 50,
      status: "REGISTERED",
      isTrial: true,
      checksum: ''
    };

    demoData.checksum = generateChecksum(demoData);
    const scrambled = scramble(JSON.stringify(demoData));
    localStorage.setItem('app_license_secure', scrambled);
    localStorage.setItem('app_data_size', "50");

    return {
      success: true,
      message: "DEMO MODE: Registration Successful (Offline). Valid until 31-12-2026",
      data: demoData
    };
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
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

    const result = await response.json();
    // ... rest of the logic

    if (result.success && result.data) {
      const licenseData: LicenseData = {
        ...result.data,
        key: 'TRIAL',
        checksum: ''
      };
      licenseData.checksum = generateChecksum(result.data);

      const scrambled = scramble(JSON.stringify(licenseData));
      localStorage.setItem('app_license_secure', scrambled);
      localStorage.setItem('app_data_size', String(licenseData.dataSize));

      // Also sync to electron DB if available
      // @ts-ignore
      if (window.electronAPI) window.electronAPI.dbSet('app_license_secure', scrambled);
    }

    return result;
  } catch (error) {
    return { success: false, message: "Connection Error: Check internet or Backend URL." };
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
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'ACTIVATE_LICENSE',
        userName,
        userID,
        licenseKey: cleanKey,
        email,
        mobile,
        machineId
      })
    });
    const result = await response.json();

    if (result.success && result.data) {
      const licenseData: LicenseData = {
        ...result.data,
        checksum: ''
      };
      licenseData.checksum = generateChecksum(result.data);

      const scrambled = scramble(JSON.stringify(licenseData));
      localStorage.setItem('app_license_secure', scrambled);
      localStorage.setItem('app_data_size', String(licenseData.dataSize));

      // @ts-ignore
      if (window.electronAPI) window.electronAPI.dbSet('app_license_secure', scrambled);
    }
    return result;
  } catch (error) {
    return { success: false, message: "Activation failed. Please check your internet connection." };
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
  const expiry = new Date(stored.expiryDate);
  if (expiry < new Date()) {
    return {
      valid: false,
      message: 'License Expired to renew Contact ilcbala.BharatPayRoll@gmail.com'
    };
  }

  // 3. Daily Online Verification Sync
  const lastCheck = localStorage.getItem('app_license_last_check');
  const today = new Date().toISOString().split('T')[0];

  if (lastCheck !== today && GOOGLE_SCRIPT_URL !== "YOUR_GOOGLE_SCRIPT_WEB_APP_URL") {
    try {
      console.log("🌐 Performing Daily License Sync...");
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'VALIDATE_STARTUP',
          licenseKey: stored.key,
          email: stored.registeredTo,
          mobile: stored.registeredMobile,
          machineId: currentMachineId
        })
      });
      const result = await response.json();

      if (!result.success) {
        return { valid: false, message: result.message };
      }

      localStorage.setItem('app_license_last_check', today);
    } catch (e) {
      console.warn("Offline: Skipping daily sync.");
    }
  }

  return { valid: true };
};

export const APP_VERSION = "1.0.0";
/**
 * Fetches the latest developer messages from Google Sheets
 */
export const fetchLatestMessages = async (): Promise<{ scrollNews: string, statutory: string } | null> => {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "GET_MESSAGES" })
    });
    const result = await response.json();

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
