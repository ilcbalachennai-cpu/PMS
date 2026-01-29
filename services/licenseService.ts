
import { LicenseData, AppVersion } from '../types';

// Replace this with your deployed Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = "YOUR_GOOGLE_SCRIPT_WEB_APP_URL"; 

// Generate a pseudo-machine ID for browser (In Electron, use node-machine-id)
const getMachineId = (): string => {
  let mid = localStorage.getItem('app_machine_id');
  if (!mid) {
    mid = 'MID-' + Math.random().toString(36).substring(2, 15).toUpperCase();
    localStorage.setItem('app_machine_id', mid);
  }
  return mid;
};

export const getStoredLicense = (): LicenseData | null => {
  try {
    const data = localStorage.getItem('app_license');
    return data ? JSON.parse(data) : null;
  } catch (e) { return null; }
};

// Simulated Online Activation (Replace with fetch to Google Script in production)
export const activateLicense = async (key: string, name: string, mobile: string): Promise<{ success: boolean; data?: LicenseData; message?: string }> => {
  const machineId = getMachineId();
  
  console.log(`Connecting to Cloud... Verifying Key: ${key} for Machine: ${machineId}`);

  // MOCK LOGIC: For demonstration, keys starting with "BPP-" are valid
  return new Promise((resolve) => {
    setTimeout(() => {
      if (key.startsWith("BPP-") && key.length > 8) {
        const licenseData: LicenseData = {
          key,
          status: 'Active',
          registeredTo: name,
          expiryDate: '2026-03-31', // 1 Year validity
          machineId
        };
        localStorage.setItem('app_license', JSON.stringify(licenseData));
        
        // Also Create the Admin User locally if not exists
        const currentUsers = JSON.parse(localStorage.getItem('app_users') || '[]');
        if (currentUsers.length === 0) {
             // Create Default Admin
        }
        
        resolve({ success: true, data: licenseData });
      } else {
        resolve({ success: false, message: 'Invalid License Key or Machine Mismatch.' });
      }
    }, 1500);
  });
};

export const checkForUpdates = async (): Promise<{ hasUpdate: boolean; version?: AppVersion }> => {
  // MOCK UPDATE CHECK
  return new Promise((resolve) => {
    setTimeout(() => {
        // Example: Check against a remote JSON file
        const remoteVersion = "1.2.0";
        const currentVersion = "1.0.0";
        
        if (remoteVersion > currentVersion) {
            resolve({
                hasUpdate: true,
                version: {
                    version: "1.2.0",
                    releaseDate: "2025-02-20",
                    features: ["AI Compliance Assistant", "Form 6A Automation"],
                    statutoryUpdates: ["PT Slabs 2025", "Code on Wages 2020 Compliance"]
                }
            });
        } else {
            resolve({ hasUpdate: false });
        }
    }, 1500);
  });
};

export const APP_VERSION = "1.0.0";
