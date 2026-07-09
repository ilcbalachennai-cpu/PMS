
import { StatutoryConfig, Employee, User, LeavePolicy, CompanyProfile } from './types';

// Branding Configuration
export const BRAND_CONFIG = {
  appName: 'BharatPay',
  appNameSuffix: ' Pro',
  companyName: 'ILCBala',
  tagline: 'Decoding Indian Labour Laws',
  logoUrl: './logo.png',
  developerLogoUrl: './logo3.png'
};

export const INITIAL_COMPANY_PROFILE: CompanyProfile = {
  id: 'default',
  establishmentName: '',
  tradeName: '',
  cin: '',
  lin: '',
  pfCode: '',
  esiCode: '',
  gstNo: '',
  pan: '',
  ptNo: '',
  tan: '',
  lwfRegNo: '',
  // Address
  doorNo: '',
  buildingName: '',
  street: '',
  locality: '',
  area: '',
  city: '',
  state: 'Tamil Nadu',
  pincode: '',
  // Contact
  mobile: '',
  telephone: '',
  email: '',
  website: '',
  natureOfBusiness: 'Manufacturing',
  flashNews: 'Welcome to BharatPay Pro! Ensure all PF ECRs are filed before the 15th. Check "Settings" to update this news.',
  flashNewsKey: 'REGULAR',
  postLoginMessage: '# Labour Code  2020 implemented (21-11-2025)\n# Higher Wages , Higher Pension implemented',
  postLoginHeader: 'Statutory Compliance Update',
  postLoginAlignment: 'LEFT',
  postLoginKey: 'REGULAR',
  flashPopupMessage: '',
  flashPopupHeader: 'FLASH ALERT',
  flashPopupPriority: 'REGULAR',
  flashPopupId: '',
  externalAppUrl: '', // Default empty
  securityPin: '',
  loginAlertEnabled: false,
  loginAlertMessage: ''
};

export const NATURE_OF_BUSINESS_OPTIONS = [
  'Manufacturing',
  'Services Industry',
  'Contract Labour',
  'Software / IT Services',
  'Construction',
  'Retail / Trading',
  'Hospitality',
  'Education',
  'Financial Services',
  'Logistics / Transport',
  'Healthcare',
  'Others'
];

export const INITIAL_STATUTORY_CONFIG: StatutoryConfig = {
  enablePF: true,
  enableESI: true,
  enableBonus: true,
  enableGratuity: true,
  epfCeiling: 15000,
  epfEmployeeRate: 0.12,
  epfEmployerRate: 0.12,
  esiCeiling: 21000,
  esiEmployeeRate: 0.0075,
  esiEmployerRate: 0.0325,
  // PT Config
  enableProfessionalTax: true,
  ptDeductionCycle: 'HalfYearly',
  ptSlabs: [
    { min: 0, max: 21000, amount: 0 },
    { min: 21001, max: 30000, amount: 135 },
    { min: 30001, max: 45000, amount: 315 },
    { min: 45001, max: 60000, amount: 690 },
    { min: 60001, max: 75000, amount: 1025 },
    { min: 75001, max: 9999999, amount: 1250 }
  ],
  // LWF Config
  enableLWF: true,
  lwfDeductionCycle: 'Yearly',
  lwfEmployeeContribution: 10,
  lwfEmployerContribution: 20,

  // IT Config
  incomeTaxCalculationType: 'Manual',

  bonusRate: 0.0833,
  pfComplianceType: 'Statutory',

  // NEW: Higher Contribution Rules
  enableHigherContribution: false,
  higherContributionType: 'By Employee',
  higherContributionComponents: {
    basic: true,
    da: true,
    retaining: true,
    hra: false,
    conveyance: false,
    washing: false,
    attire: false,
    special1: false,
    special2: false,
    special3: false
  },

  // NEW: Leave Wages Calculation Policy (Default Basic + DA)
  leaveWagesComponents: {
    basic: true,
    da: true,
    retaining: false,
    hra: false,
    conveyance: false,
    washing: false,
    attire: false,
    special1: false,
    special2: false,
    special3: false
  },

  // NEW: Overtime Policy
  enableOT: false,
  otCalculationFactor: 1,
  otComponents: {
    basic: true,
    da: true,
    retaining: false,
    hra: false,
    conveyance: false,
    washing: false,
    attire: false,
    special1: false,
    special2: false,
    special3: false
  },

  // NEW: Statutory Calculation Basis (Global Policy)
  pfEsiCalculationBasis: 'LabourCode',
  pfOriginalWagesComponents: {
    basic: true,
    da: true,
    retaining: true,
    hra: false,
    conveyance: false,
    washing: false,
    attire: false,
    special1: false,
    special2: false,
    special3: false
  },
  esiOriginalWagesComponents: { basic: true, da: true, retaining: true, hra: true, conveyance: false, washing: false, attire: false, special1: true, special2: true, special3: true },
  bonusWagesComponents: { basic: true, da: true, retaining: false, hra: false, conveyance: false, washing: false, attire: false, special1: false, special2: false, special3: false },
  gratuityWagesComponents: { basic: true, da: true, retaining: false, hra: false, conveyance: false, washing: false, attire: false, special1: false, special2: false, special3: false },
  enableArrearSalary: false,
  enableDynamicPaySheet: false,
  dynamicPaySheetColumns: ['empid', 'name', 'basic', 'da', 'retaining', 'hra', 'conveyance', 'washing', 'attire', 'special1', 'special2', 'special3', 'leaveEncashment', 'otAmount', 'totalEarnings', 'epf', 'vpf', 'esi', 'pt', 'it', 'lwf', 'advanceRecovery', 'fine', 'totalDeductions', 'netPay']
};

export const DEFAULT_LEAVE_POLICY: LeavePolicy = {
  el: { maxPerYear: 18, maxCarryForward: 45, label: 'Earned Leave (EL)' },
  sl: { maxPerYear: 12, maxCarryForward: 0, label: 'Sick Leave (SL)' },
  cl: { maxPerYear: 12, maxCarryForward: 0, label: 'Casual Leave (CL)' }
};

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

export const PT_STATE_PRESETS = {
  'Tamil Nadu': {
    cycle: 'HalfYearly',
    slabs: [
      { min: 0, max: 21000, amount: 0 },
      { min: 21001, max: 30000, amount: 135 },
      { min: 30001, max: 45000, amount: 315 },
      { min: 45001, max: 60000, amount: 690 },
      { min: 60001, max: 75000, amount: 1025 },
      { min: 75001, max: 9999999, amount: 1250 }
    ]
  },
  'Karnataka': {
    cycle: 'Monthly',
    slabs: [
      { min: 0, max: 14999, amount: 0 },
      { min: 15000, max: 9999999, amount: 200 }
    ]
  },
  'Maharashtra': {
    cycle: 'Monthly',
    slabs: [
      { min: 0, max: 7500, amount: 0 },
      { min: 7501, max: 10000, amount: 175 },
      { min: 10001, max: 9999999, amount: 200 }
      // Note: In MH, Feb is 300, but simpler logic used here for standard
    ]
  },
  'West Bengal': {
    cycle: 'Monthly',
    slabs: [
      { min: 0, max: 10000, amount: 0 },
      { min: 10001, max: 15000, amount: 110 },
      { min: 15001, max: 25000, amount: 130 },
      { min: 25001, max: 40000, amount: 150 },
      { min: 40001, max: 9999999, amount: 200 }
    ]
  },
  'Telangana': {
    cycle: 'Monthly',
    slabs: [
      { min: 0, max: 15000, amount: 0 },
      { min: 15001, max: 20000, amount: 150 },
      { min: 20001, max: 9999999, amount: 200 }
    ]
  },
  'Andhra Pradesh': {
    cycle: 'Monthly',
    slabs: [
      { min: 0, max: 15000, amount: 0 },
      { min: 15001, max: 20000, amount: 150 },
      { min: 20001, max: 9999999, amount: 200 }
    ]
  },
  'Kerala': {
    cycle: 'HalfYearly',
    slabs: [
      { min: 0, max: 11999, amount: 0 },
      { min: 12000, max: 17999, amount: 120 },
      { min: 18000, max: 29999, amount: 180 },
      { min: 30000, max: 44999, amount: 300 },
      { min: 45000, max: 59999, amount: 450 },
      { min: 60000, max: 74999, amount: 600 },
      { min: 75000, max: 99999, amount: 750 },
      { min: 100000, max: 124999, amount: 1000 },
      { min: 125000, max: 9999999, amount: 1250 }
    ]
  },
  'Gujarat': {
    cycle: 'Monthly',
    slabs: [
      { min: 0, max: 12000, amount: 0 },
      { min: 12001, max: 9999999, amount: 200 }
    ]
  }
};

export const LWF_STATE_PRESETS = {
  'Tamil Nadu': { cycle: 'Yearly', emp: 10, emplr: 20 }, // Dec
  'Andhra Pradesh': { cycle: 'Yearly', emp: 30, emplr: 70 }, // Dec
  'Telangana': { cycle: 'Yearly', emp: 30, emplr: 70 }, // Dec
  'Karnataka': { cycle: 'Yearly', emp: 20, emplr: 40 }, // Dec
  'Maharashtra': { cycle: 'HalfYearly', emp: 12, emplr: 36 }, // Jun/Dec
  'Kerala': { cycle: 'HalfYearly', emp: 20, emplr: 20 }, // Jun/Dec
  'Gujarat': { cycle: 'HalfYearly', emp: 6, emplr: 12 }, // Jun/Dec
  'West Bengal': { cycle: 'HalfYearly', emp: 3, emplr: 15 }, // Jun/Dec
  'Delhi': { cycle: 'HalfYearly', emp: 0.75, emplr: 2.25 }, // (0.75 * 6 = 4.5, etc. approximate for monthly cycle if configured differently, but mostly half yearly)
  'Haryana': { cycle: 'Monthly', emp: 25, emplr: 50 },
};

export const MOCK_USERS: User[] = [
  {
    username: 'admin',
    password: 'password',
    name: 'Administrator',
    role: 'Administrator',
    email: 'admin@bharatpay.com'
  }
];

export const SAMPLE_EMPLOYEES: Employee[] = [];

export const getActivePaySheetColumns = (results: any[], config: any) => {
  const canonicalMap: Record<string, string> = {
    empid: 'empid', name: 'name', days: 'days', basic: 'basic', da: 'da', retaining: 'retaining',
    hra: 'hra', conveyance: 'conveyance', washing: 'washing', attire: 'attire',
    special1: 'special1', special2: 'special2', special3: 'special3',
    leaveencashment: 'leaveEncashment', otamount: 'otAmount', totalearnings: 'totalEarnings',
    epf: 'epf', vpf: 'vpf', esi: 'esi', pt: 'pt', it: 'it', lwf: 'lwf',
    advancerecovery: 'advanceRecovery', fine: 'fine', totaldeductions: 'totalDeductions', netpay: 'netPay'
  };

  // 1. Determine base list of columns based on dynamic mode settings
  let baseColumns: string[] = [];
  if (config?.enableDynamicPaySheet && config?.dynamicPaySheetColumns) {
    baseColumns = config.dynamicPaySheetColumns
      .map((c: string) => canonicalMap[c.toLowerCase()] || c)
      .filter((c: string) => c !== 'empid' && c !== 'name' && c !== 'bonus' && c !== 'arrears');
  } else {
    // Default static columns in case dynamic mode is disabled
    baseColumns = ['days', 'basic', 'da', 'retaining', 'hra', 'conveyance', 'epf', 'esi', 'advanceRecovery', 'pt'];
  }

  // 2. Filter candidates based on whether they are enabled and have non-zero data for at least one employee
  const activeCols = baseColumns.filter(col => {
    // Days and Basic are always kept if present in configuration
    if (col === 'days' || col === 'basic') return true;

    // Check if there is at least one non-zero record
    return results.some(r => {
      if (col === 'da') return (r.earnings?.da || 0) !== 0;
      if (col === 'retaining') return (r.earnings?.retainingAllowance || 0) !== 0;
      if (col === 'hra') return (r.earnings?.hra || 0) !== 0;
      if (col === 'conveyance') return (r.earnings?.conveyance || 0) !== 0;
      if (col === 'washing') return (r.earnings?.washing || 0) !== 0;
      if (col === 'attire') return (r.earnings?.attire || 0) !== 0;
      if (col === 'special1') return (r.earnings?.special1 || 0) !== 0;
      if (col === 'special2') return (r.earnings?.special2 || 0) !== 0;
      if (col === 'special3') return (r.earnings?.special3 || 0) !== 0;
      if (col === 'leaveEncashment') return (r.earnings?.leaveEncashment || 0) !== 0;
      if (col === 'otAmount') return (r.earnings?.otAmount || 0) !== 0;

      if (col === 'epf') return (r.deductions?.epf || 0) !== 0;
      if (col === 'vpf') return (r.deductions?.vpf || 0) !== 0;
      if (col === 'esi') return (r.deductions?.esi || 0) !== 0;
      if (col === 'advanceRecovery') return (r.deductions?.advanceRecovery || 0) !== 0;
      if (col === 'pt') return (r.deductions?.pt || 0) !== 0;
      if (col === 'it') return (r.deductions?.it || 0) !== 0;
      if (col === 'lwf') return (r.deductions?.lwf || 0) !== 0;
      if (col === 'fine') return (r.deductions?.fine || 0) !== 0;

      return false;
    });
  });

  // 3. Calculate if "others" (Earnings balance) has any data
  const hasOthers = results.some(r => {
    let activeEarningsSum = 0;
    if (activeCols.includes('basic')) activeEarningsSum += (r.earnings?.basic || 0);
    if (activeCols.includes('da')) activeEarningsSum += (r.earnings?.da || 0);
    if (activeCols.includes('retaining')) activeEarningsSum += (r.earnings?.retainingAllowance || 0);
    if (activeCols.includes('hra')) activeEarningsSum += (r.earnings?.hra || 0);
    if (activeCols.includes('conveyance')) activeEarningsSum += (r.earnings?.conveyance || 0);
    if (activeCols.includes('washing')) activeEarningsSum += (r.earnings?.washing || 0);
    if (activeCols.includes('attire')) activeEarningsSum += (r.earnings?.attire || 0);
    if (activeCols.includes('special1')) activeEarningsSum += (r.earnings?.special1 || 0);
    if (activeCols.includes('special2')) activeEarningsSum += (r.earnings?.special2 || 0);
    if (activeCols.includes('special3')) activeEarningsSum += (r.earnings?.special3 || 0);
    if (activeCols.includes('leaveEncashment')) activeEarningsSum += (r.earnings?.leaveEncashment || 0);
    if (activeCols.includes('otAmount')) activeEarningsSum += (r.earnings?.otAmount || 0);

    const othersValue = Math.round((r.earnings?.total || 0) - activeEarningsSum);
    return othersValue !== 0;
  });

  // 4. Calculate if "otherDeductions" (Deductions balance) has any data
  const hasOtherDeductions = results.some(r => {
    let activeDeductionsSum = 0;
    if (activeCols.includes('epf')) activeDeductionsSum += (r.deductions?.epf || 0);
    if (activeCols.includes('vpf')) activeDeductionsSum += (r.deductions?.vpf || 0);
    if (activeCols.includes('esi')) activeDeductionsSum += (r.deductions?.esi || 0);
    if (activeCols.includes('advanceRecovery')) activeDeductionsSum += (r.deductions?.advanceRecovery || 0);
    if (activeCols.includes('pt')) activeDeductionsSum += (r.deductions?.pt || 0);
    if (activeCols.includes('it')) activeDeductionsSum += (r.deductions?.it || 0);
    if (activeCols.includes('lwf')) activeDeductionsSum += (r.deductions?.lwf || 0);
    if (activeCols.includes('fine')) activeDeductionsSum += (r.deductions?.fine || 0);

    const otherDeductionsValue = Math.round((r.deductions?.total || 0) - activeDeductionsSum);
    return otherDeductionsValue !== 0;
  });

  // 5. Build the final ordered columns list
  const finalOrdered: string[] = [];
  const earningsOrder = ['days', 'basic', 'da', 'retaining', 'hra', 'conveyance', 'washing', 'attire', 'special1', 'special2', 'special3', 'leaveEncashment', 'otAmount'];
  const deductionsOrder = ['epf', 'vpf', 'esi', 'advanceRecovery', 'pt', 'it', 'lwf', 'fine'];

  earningsOrder.forEach(col => {
    if (activeCols.includes(col)) finalOrdered.push(col);
  });
  if (hasOthers) finalOrdered.push('others');
  
  // GROSS is always included
  finalOrdered.push('totalEarnings');

  deductionsOrder.forEach(col => {
    if (activeCols.includes(col)) finalOrdered.push(col);
  });
  if (hasOtherDeductions) finalOrdered.push('otherDeductions');

  // TOTAL DED and NET PAY are always included
  finalOrdered.push('totalDeductions');
  finalOrdered.push('netPay');

  return finalOrdered;
};

