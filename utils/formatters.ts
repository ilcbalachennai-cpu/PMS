/**
 * Generates a clean, readable ID part for Company Signature (never 'default')
 */
export const getCleanCompanyIdPart = (estName?: string, fallbackId?: string): string => {
  // 1. If fallbackId exists and is a valid non-default company ID, use it directly to guarantee 1:1 match with Silo ID!
  if (fallbackId && fallbackId.trim() && fallbackId.toLowerCase() !== 'default' && fallbackId.toLowerCase() !== 'company_default') {
    let cleaned = fallbackId.trim();
    if (cleaned.includes('-')) {
      cleaned = cleaned.split('-')[1];
    }
    if (cleaned.toLowerCase() !== 'default') {
      return cleaned;
    }
  }

  // 2. If fallbackId is default or missing, generate clean prefix from Establishment Name + 6 random digits
  if (estName && estName.trim() && !estName.toLowerCase().startsWith('rescued:') && estName.toLowerCase() !== 'default') {
    const letters = estName.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (letters.length >= 3) {
      const prefix = letters.slice(0, 6);
      const randDigits = Math.floor(100000 + Math.random() * 900000);
      return `${prefix}_${randDigits}`;
    }
  }

  // 3. Ultimate fallback
  const randDigits = Math.floor(100000 + Math.random() * 900000);
  return `COMP_${randDigits}`;
};

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
 * Universal date-time parser that safely handles DD-MM-YYYY HH:mm:ss, ISO strings, etc.
 * Returns timestamp in milliseconds, or 0 if invalid.
 */
export const parseDateTime = (str: string | null | undefined): number => {
  if (!str || typeof str !== 'string') return 0;
  try {
    const cleanStr = str.trim().replace(/\u00a0/g, ' ');

    // 1. Try standard Date.parse first if not in DD-MM-YYYY format
    const looksLikeIndianFormat = /^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(cleanStr);
    if (!looksLikeIndianFormat) {
      const parsedNative = Date.parse(cleanStr);
      if (!isNaN(parsedNative)) {
        const nativeDate = new Date(parsedNative);
        if (nativeDate.getFullYear() > 1900 && nativeDate.getFullYear() < 2100) {
          return parsedNative;
        }
      }
    }

    // 2. Manual parsing fallback for dd-MM-yyyy / yyyy-MM-dd / MM-dd-yyyy formats
    const parts = cleanStr.split(/[\sT]+/).filter(Boolean);
    const datePart = parts[0];
    const timePart = parts[1] || '00:00:00';

    const dateSep = datePart.includes('-') ? '-' : '/';
    const dateParts = datePart.split(dateSep).map(Number);

    let day = 1;
    let month = 1;
    let year = 2026;

    if (dateParts[0] > 1900) {
      year = dateParts[0];
      month = dateParts[1];
      day = dateParts[2];
    } else {
      if (dateParts[2] > 1900) {
        year = dateParts[2];
        if (dateParts[0] > 12) {
          day = dateParts[0];
          month = dateParts[1];
        } else if (dateParts[1] > 12) {
          month = dateParts[0];
          day = dateParts[1];
        } else {
          day = dateParts[0];
          month = dateParts[1];
        }
      } else {
        const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const monthIndex = months.findIndex(m => cleanStr.toLowerCase().includes(m));
        if (monthIndex !== -1) {
          month = monthIndex + 1;
          const yearMatch = cleanStr.match(/\b(19|20)\d{2}\b/);
          if (yearMatch) year = Number(yearMatch[0]);
          const dayMatch = cleanStr.replace(/\b(19|20)\d{2}\b/, '').match(/\b\d{1,2}\b/);
          if (dayMatch) day = Number(dayMatch[0]);
        }
      }
    }

    let [hour, minute, second] = timePart.split(':').map(s => parseInt(s, 10) || 0);
    const isPM = cleanStr.toLowerCase().includes('pm');
    const isAM = cleanStr.toLowerCase().includes('am');

    if (isPM && hour < 12) hour += 12;
    if (isAM && hour === 12) hour = 0;

    const d = new Date(year, month - 1, day, hour, minute, second);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  } catch (e) {
    return 0;
  }
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
 * Checks whether an incoming company profile matches an existing company silo in the local registry.
 * Prevents duplicating company silos for the same establishment entity.
 */
export const findMatchingCompanySilo = (
    profile: { id?: string; establishmentName?: string; tradeName?: string; pan?: string; cin?: string; pfCode?: string; esiCode?: string; companySignature?: string } | null | undefined,
    companiesList: any[]
): any | null => {
    if (!profile || !Array.isArray(companiesList) || companiesList.length === 0) return null;
    const clean = (v: any) => String(v || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    const pId = clean(profile.id);
    const pName = clean(profile.establishmentName || profile.tradeName);
    const pPan = clean(profile.pan);
    const pCin = clean(profile.cin);
    const pPf = clean(profile.pfCode);
    const pEsi = clean(profile.esiCode);
    const pSig = (profile.companySignature || '').trim();

    for (const c of companiesList) {
        if (!c) continue;
        const cId = clean(c.id);
        const cName = clean(c.establishmentName || c.tradeName);
        const cPan = clean(c.pan);
        const cCin = clean(c.cin);
        const cPf = clean(c.pfCode);
        const cEsi = clean(c.esiCode);
        const cSig = (c.companySignature || '').trim();

        // 1. Direct ID match
        if (pId && cId && pId === cId) return c;

        // 2. Direct Signature match
        if (pSig && cSig && pSig === cSig) return c;

        // 3. Establishment Name match (must be at least 3 chars)
        if (pName && cName && pName.length >= 3 && pName === cName) return c;

        // 4. Statutory Identifiers (PAN / CIN / PF Code / ESI Code)
        if (pPan && cPan && pPan === cPan) return c;
        if (pCin && cCin && pCin === cCin) return c;
        if (pPf && cPf && pPf === cPf) return c;
        if (pEsi && cEsi && pEsi === cEsi) return c;
    }

    return null;
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

  return `${firstWord}_FB_${monthLabel}_${dataYear}_${backupDateStr}.enc`;
};

export const getCompanyBackupFolder = (establishmentName: string, id: string): string => {
    const firstWord = (establishmentName || 'COMPANY')
      .trim()
      .split(/\s+/)[0]
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
    
    const idParts = (id || '').split('_');
    const numericPart = idParts.length > 1 ? idParts[idParts.length - 1] : '';

    return `BK_${firstWord}_${numericPart}`;
};

/**
 * Parses any date string format (DD-MM-YYYY, YYYY-MM-DD, ISO etc.) 
 * and returns it as a standardized 'YYYY-MM-DD' string.
 * This is crucial for HTML5 date inputs which strictly require YYYY-MM-DD.
 */
export const parseDateToYYYYMMDD = (val: any): string => {
  if (val === undefined || val === null) return '';
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return '';
  }

  const str = String(val).trim();
  if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') return '';

  // 1. Format DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
  const matchDMY = str.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/);
  if (matchDMY) {
    const d = matchDMY[1].padStart(2, '0');
    const m = matchDMY[2].padStart(2, '0');
    const y = matchDMY[3];
    return `${y}-${m}-${d}`;
  }

  // 2. Format YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const matchYMD = str.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$/);
  if (matchYMD) {
     const y = matchYMD[1];
     const m = matchYMD[2].padStart(2, '0');
     const d = matchYMD[3].padStart(2, '0');
     return `${y}-${m}-${d}`;
  }

  // 3. Fallback: Native Date parsing
  const parsedTime = Date.parse(str);
  if (!isNaN(parsedTime)) {
    const dateObj = new Date(parsedTime);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
};

/**
 * Normalizes all date fields in an Employee object to YYYY-MM-DD
 */
export const normalizeEmployeeDates = (emp: any): any => {
  if (!emp) return emp;
  return {
    ...emp,
    dob: parseDateToYYYYMMDD(emp.dob),
    doj: parseDateToYYYYMMDD(emp.doj),
    dol: emp.dol ? parseDateToYYYYMMDD(emp.dol) : undefined,
    epfMembershipDate: emp.epfMembershipDate ? parseDateToYYYYMMDD(emp.epfMembershipDate) : undefined,
  };
};

/**
 * Checks if any calculation-affecting fields of StatutoryConfig have changed.
 */
export const didConfigCalculationFieldsChange = (c1: any, c2: any): boolean => {
  if (!c1 || !c2) return false;
  const keys = [
    'enablePF', 'enableESI', 'enableBonus', 'enableGratuity',
    'epfCeiling', 'epfEmployeeRate', 'epfEmployerRate',
    'esiCeiling', 'esiEmployeeRate', 'esiEmployerRate',
    'enableProfessionalTax', 'ptDeductionCycle', 'ptSlabs',
    'enableLWF', 'lwfDeductionCycle', 'lwfEmployeeContribution', 'lwfEmployerContribution',
    'incomeTaxCalculationType', 'bonusRate', 'pfComplianceType',
    'enableHigherContribution', 'higherContributionType', 'higherContributionComponents',
    'leaveWagesComponents', 'enableOT', 'otCalculationFactor', 'otComponents',
    'pfEsiCalculationBasis', 'pfOriginalWagesComponents', 'esiOriginalWagesComponents',
    'bonusWagesComponents', 'gratuityWagesComponents', 'enableArrearSalary'
  ];
  return keys.some(key => JSON.stringify(c1[key] ?? null) !== JSON.stringify(c2[key] ?? null));
};

/**
 * Checks if any payroll calculation-affecting fields of Employee have changed.
 */
export const didEmployeePayFieldsChange = (oldEmp: any, newEmp: any): boolean => {
  if (!oldEmp || !newEmp) return false;

  const numFields = [
    'basicPay', 'da', 'retainingAllowance', 'hra', 'conveyance', 'washing', 'attire',
    'specialAllowance1', 'specialAllowance2', 'specialAllowance3',
    'employeeVPFRate', 'epsMaturityConfiguredAge'
  ];
  for (const f of numFields) {
    if (Number(oldEmp[f] || 0) !== Number(newEmp[f] || 0)) return true;
  }

  const boolFields = [
    'isPFExempt', 'isESIExempt', 'isPTExempt', 'isLWFExempt',
    'isPFHigherWages', 'isEmployerPFHigher', 'isDeferredPension', 'epsMaturityConfigured'
  ];
  for (const f of boolFields) {
    if (Boolean(oldEmp[f]) !== Boolean(newEmp[f])) return true;
  }

  // Date fields - normalize to YYYY-MM-DD before comparing to avoid false diffs from format differences
  const dateFields = ['dob', 'doj', 'dol', 'epfMembershipDate'];
  for (const f of dateFields) {
    const d1 = parseDateToYYYYMMDD(oldEmp[f]);
    const d2 = parseDateToYYYYMMDD(newEmp[f]);
    if (d1 !== d2) return true;
  }

  const strFields = [
    'isEPSEligible', 'leavingReason'
  ];
  for (const f of strFields) {
    const s1 = String(oldEmp[f] || '').trim();
    const s2 = String(newEmp[f] || '').trim();
    if (s1 !== s2) return true;
  }
  
  const oldHP = oldEmp.pfHigherPension || {};
  const newHP = newEmp.pfHigherPension || {};
  if (
    Boolean(oldHP.enabled) !== Boolean(newHP.enabled) ||
    String(oldHP.contributedBefore2014 || '').trim() !== String(newHP.contributedBefore2014 || '').trim() ||
    String(oldHP.employeeContribution || '').trim() !== String(newHP.employeeContribution || '').trim() ||
    String(oldHP.employerContribution || '').trim() !== String(newHP.employerContribution || '').trim() ||
    String(oldHP.isHigherPensionOpted || '').trim() !== String(newHP.isHigherPensionOpted || '').trim() ||
    String(oldHP.dojImpact || '').trim() !== String(newHP.dojImpact || '').trim()
  ) {
    return true;
  }
  
  return false;
};
