/**
 * Centralized Date Utilities for License & Trial Management
 */

/**
 * Parses an expiry date string from various formats (DD-MM-YYYY, ISO, Locale String)
 * Returns a valid Date object or null if invalid.
 */
export const parseExpiryDate = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr) return null;

  // 1. Try DD-MM-YYYY format (common in this app)
  // Ensure it operates ONLY on DD-MM-YYYY by checking that parts[2] looks like a 4 digit year.
  if (dateStr.includes('-') && !dateStr.includes('T')) {
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[2].length === 4) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const dt = new Date(year, month, day, 23, 59, 59);
      if (!isNaN(dt.getTime())) return dt;
    }
  }

  // 2. Try native parsing (handles ISO strings and long locale strings like "Mon Jul 06 2026...")
  const nativeDt = new Date(dateStr);
  if (!isNaN(nativeDt.getTime())) {
    // Ensure we set to end of day if it's just a date
    if (nativeDt.getHours() === 0 && nativeDt.getMinutes() === 0) {
      nativeDt.setHours(23, 59, 59);
    }
    return nativeDt;
  }

  return null;
};

/**
 * Formats a date object or string into professional DD-MM-YYYY
 */
export const formatExpiryDate = (date: Date | string | undefined | null): string => {
  if (!date) return 'N/A';
  
  const d = (typeof date === 'string') ? parseExpiryDate(date) : date;
  if (!d || isNaN(d.getTime())) return 'N/A';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
};

/**
 * Formats a number according to the Indian Numbering System (en-IN)
 * Example: 100000 -> 1,00,000
 */
export const formatIndianNumber = (num: number | string | undefined | null): string => {
  if (num === undefined || num === null || num === '') return '0';
  const val = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(val)) return '0';
  
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(val);
};

/**
 * Formats a value as Indian Rupee (₹) with Indian Numbering System
 * Example: 100000 -> ₹ 1,00,000
 */
export const formatCurrency = (num: number | string | undefined | null, includeSymbol = true): string => {
  if (num === undefined || num === null || num === '') return includeSymbol ? '₹ 0' : '0';
  const val = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(val)) return includeSymbol ? '₹ 0' : '0';

  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(val);

  return includeSymbol ? `₹ ${formatted}` : formatted;
};

/**
 * Formats a 16-character license key into XXXX-XXXX-XXXX-XXXX
 */
export const formatLicenseKey = (key: string | undefined | null): string => {
  if (!key || key === 'N/A' || key === 'TRIAL') return key || 'N/A';
  
  // Remove any existing hyphens and normalize
  const clean = key.replace(/-/g, '').toUpperCase();
  if (clean.length !== 16) return key; // Not a standard key or already formatted differently
  
  // Group into 4s with hyphens
  const parts = clean.match(/.{1,4}/g);
  return parts ? parts.join('-') : key;
};

/**
 * Generates a standard Company ID based on the establishment name.
 * Pattern: FIRST6CHARS_RANDOM6DIGITS (e.g., NKEFLO_476704)
 */
export const generateCompanyId = (establishmentName: string): string => {
  const cleanName = (establishmentName || 'COMPANY')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 6)
    .toUpperCase();
  
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  return `${cleanName}_${randomSuffix}`;
};

/**
 * Generates a standard backup filename based on company name, data month/year, and current date.
 * Pattern: [FirstWordOfCompany]_[DataMonth]_[Year]_[DateOfBackup].enc
 * Example: NKE_DEC_2025_04May2026.enc
 */
export const generateBackupFilename = (establishmentName: string, dataMonth: string, dataYear: number): string => {
  const firstWord = (establishmentName || 'COMPANY')
    .trim()
    .split(/\s+/)[0]
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  
  const monthLabel = String(dataMonth || 'UNK').substring(0, 3).toUpperCase();
  
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  // Use manual array to ensure consistency across locales
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[today.getMonth()];
  const year = today.getFullYear();
  const backupDateStr = `${day}${monthName}${year}`; // e.g., 04May2026

  return `${firstWord}_${monthLabel}_${dataYear}_${backupDateStr}.enc`;
};

