
import { StatutoryConfig, Employee, User, LeavePolicy, CompanyProfile } from './types';

// Branding Configuration
export const BRAND_CONFIG = {
  appName: 'BharatPay',
  appNameSuffix: 'Pro',
  companyName: 'ILCbala',
  tagline: 'Decoding Indian Labour Laws',
  // SVG Data URI for ILCbala Logo (Permanent)
  logoUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MDAgNDAwIj48Y2lyY2xlIGN4PSIyMDAiIGN5PSIyMDAiIHI9IjIwMCIgZmlsbD0iIzgwMDAwMCIvPjxlbGxpcHNlIGN4PSIyMDAiIGN5PSIyMDAiIHJ4PSIxOTUiIHJ5PSIxMjAiIGZpbGw9IiNGRkQ3MDAiLz48dGV4dCB4PSIyMDAiIHk9IjE4NSIgZm9udC1mYW1pbHk9InNlcmlmIiBmb250LXdlaWdodD0iYm9sZCIgZm9udC1zaXplPSI4MCIgZmlsbD0iIzgwMDAwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+SUxDYmFsYTwvdGV4dD48dGV4dCB4PSIyMDAiIHk9IjI0MCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSJib25kIiBmb250LXN0eWxlPSJpdGFsaWMiIGZvbnQtc2l6ZT0iMjIiIGZpbGw9IiM4MDAwMDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkRlY29kaW5nIEluZGlhbiBMYWJvdXIgTGF3czwvdGV4dD48L3N2Zz4=', 
};

export const INITIAL_COMPANY_PROFILE: CompanyProfile = {
  establishmentName: 'Your Establishment Name',
  tradeName: '',
  cin: '',
  lin: '',
  pfCode: '',
  esiCode: '',
  gstNo: '',
  pan: '',
  address: '',
  state: 'Tamil Nadu',
  city: '',
  mobile: '',
  telephone: '',
  email: '',
  website: '',
  natureOfBusiness: 'Manufacturing',
  flashNews: 'Welcome to BharatPay Pro! Ensure all PF ECRs are filed before the 15th. Check "Settings" to update this news.',
  externalAppUrl: '' // Default empty
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
  
  bonusRate: 0.0833,
  pfComplianceType: 'Statutory' // Default for 20+ employees
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
  { username: 'dev', password: 'dev@123', name: 'Master Developer', role: 'Developer', email: 'dev@bharatpay.com' },
  { username: 'admin', password: 'admin@123', name: 'System Administrator', role: 'Administrator', email: 'admin@bharatpay.com' },
  { username: 'user', password: 'user@123', name: 'Payroll Executive', role: 'User', email: 'user@bharatpay.com' }
];

export const SAMPLE_EMPLOYEES: Employee[] = [];
