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
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
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
