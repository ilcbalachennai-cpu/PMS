
export interface ServiceRecord {
  date: string;
  type: 'Appointment' | 'Assessment' | 'Promotion' | 'Increment';
  description: string;
}

export interface LeaveLedger {
  employeeId: string;
  // Added 'availed' to el structure
  el: { opening: number; eligible: number; encashed: number; availed: number; balance: number };
  sl: { eligible: number; availed: number; balance: number };
  cl: { availed: number; accumulation: number; balance: number };
}

export interface AdvanceLedger {
  employeeId: string;
  opening: number;          // Carry-forward from previous month
  totalAdvance: number;     // New advance given this month
  emiCount: number;         // Number of installments (used when manualPayment is 0)
  manualPayment: number;    // Optional override; if > 0 disables emiCount
  recovery: number;         // Computed: manualPayment > 0 ? manualPayment : totalBalance / emiCount
  balance: number;          // opening + totalAdvance − recovery (carries forward as next month's opening)
  monthlyInstallment?: number; // Added to match component usage
  paidAmount?: number;         // Added to match component usage
}


export interface FineRecord {
  employeeId: string;
  month: string;
  year: number;
  amount: number;
  reason: string;
  tax?: number; // New field for Income Tax (TDS) Override
}

export interface LeavePolicy {
  el: { maxPerYear: number; maxCarryForward: number; label: string };
  sl: { maxPerYear: number; maxCarryForward: number; label: string };
  cl: { maxPerYear: number; maxCarryForward: number; label: string };
}

export interface Attendance {
  employeeId: string;
  month: string;
  year: number;
  presentDays: number;
  earnedLeave: number;
  sickLeave: number;
  casualLeave: number;
  lopDays: number;
  encashedDays?: number; // New field for Leave Encashment input in Attendance
}

export type PFComplianceType = 'Statutory' | 'Voluntary';

export interface StatutoryConfig {
  epfCeiling: number;
  epfEmployeeRate: number;
  epfEmployerRate: number;
  esiCeiling: number;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  // PT Configuration
  enableProfessionalTax: boolean; // New Flag to toggle PT globally
  ptDeductionCycle: 'Monthly' | 'HalfYearly'; // Monthly for KA/MH, HalfYearly for TN/Kerala
  ptSlabs: { min: number; max: number; amount: number }[];
  // LWF Configuration
  enableLWF: boolean;
  lwfDeductionCycle: 'Monthly' | 'HalfYearly' | 'Yearly';
  lwfEmployeeContribution: number;
  lwfEmployerContribution: number;

  // IT Configuration
  incomeTaxCalculationType: 'Manual' | 'Auto';

  bonusRate: number;
  pfComplianceType: PFComplianceType; // Company-level compliance

  // NEW: Higher Contribution Logic
  enableHigherContribution: boolean;
  higherContributionType: 'By Employee' | 'By Employee & Employer';
  higherContributionComponents: {
    basic: boolean;
    da: boolean;
    retaining: boolean;
    conveyance: boolean;
    washing: boolean;
    attire: boolean;
    special1: boolean;
    special2: boolean;
    special3: boolean;
  };

  // NEW: Leave Wages Calculation Policy (Default Basic + DA)
  leaveWagesComponents: {
    basic: boolean;
    da: boolean;
    retaining: boolean;
    hra: boolean;
    conveyance: boolean;
    washing: boolean;
    attire: boolean;
    special1: boolean;
    special2: boolean;
    special3: boolean;
  };

  // NEW: Overtime Policy
  enableOT: boolean;
  otCalculationFactor: 1 | 2;
  otComponents: {
    basic: boolean;
    da: boolean;
    retaining: boolean;
    hra: boolean;
    conveyance: boolean;
    washing: boolean;
    attire: boolean;
    special1: boolean;
    special2: boolean;
    special3: boolean;
  };

  // NEW: Statutory Calculation Basis
  pfEsiCalculationBasis: 'LabourCode' | 'OriginalWages';
  pfOriginalWagesComponents: {
    basic: boolean;
    da: boolean;
    retaining: boolean;
    hra: boolean;
    conveyance: boolean;
    washing: boolean;
    attire: boolean;
    special1: boolean;
    special2: boolean;
    special3: boolean;
  };
  esiOriginalWagesComponents: {
    basic: boolean;
    da: boolean;
    retaining: boolean;
    hra: boolean;
    conveyance: boolean;
    washing: boolean;
    attire: boolean;
    special1: boolean;
    special2: boolean;
    special3: boolean;
  };
  enableArrearSalary: boolean;
}

export interface CompanyProfile {
  establishmentName: string;
  tradeName: string;
  cin: string; // Corporate ID
  lin: string; // Labour Identification No
  pfCode: string;
  esiCode: string;
  gstNo: string;
  pan: string;

  // Granular Address
  doorNo: string;
  buildingName: string;
  street: string;
  locality: string;
  area: string;
  city: string;
  state: string;
  pincode: string;

  // Contact
  mobile: string;
  telephone: string;
  email: string;
  website: string;
  natureOfBusiness: string;
  flashNews?: string; // Ticker News
  flashNewsKey?: string; // News Mode
  postLoginMessage?: string; // Global Popup Message
  postLoginHeader?: string; // Popup Header
  postLoginAlignment?: 'LEFT' | 'CENTER' | 'RIGHT'; // Text Alignment
  postLoginKey?: 'REGULAR' | 'IMMEDIATE'; // Message Priority
  flashPopupMessage?: string; // Flash Popup Content
  flashPopupHeader?: string; // Flash Popup Header
  flashPopupPriority?: 'REGULAR' | 'IMMEDIATE'; // Flash Popup Mode
  flashPopupId?: string; // Flash Date Sync Key
  externalAppUrl?: string; // New field for External App Link
  loginAlertMessage?: string; // New field for Dynamic Login Screen Alert
  loginAlertEnabled?: boolean; // New field to Toggle Login Alert

  // SMTP Configuration
  smtpHost?: string;
  smtpPort?: number;
  smtpSecurity?: 'None' | 'SSL' | 'TLS';
  smtpUser?: string;
  smtpPassword?: string;
  senderName?: string;
  senderEmail?: string;
  securityPin?: string; // PIN for payroll freeze operations
}

export interface Employee {
  id: string;
  name: string;
  gender: 'Male' | 'Female' | 'Transgender' | 'Others'; // Added Gender
  dob: string;
  designation: string;
  department: string; // Mapping to Division in UI
  division: string;
  branch: string;
  site: string;
  pan: string;
  aadhaarNumber: string;
  uanc: string;
  pfNumber: string;
  esiNumber: string;
  insuranceNo?: string;
  fatherSpouseName: string;
  relationship: string;

  // New Family Relations Fields
  maritalStatus?: 'Yes' | 'No';
  spouseName?: string;
  spouseGender?: 'Male' | 'Female' | 'Others' | string;
  spouseAadhaar?: string;

  // GRANULAR ADDRESS Breakdown
  doorNo: string;
  buildingName: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;

  mobile: string;
  bankAccount: string;
  bankName?: string; // New field
  bankBranch?: string; // New field
  ifsc: string;
  doj: string;
  dol?: string;
  email?: string; // New field for mailing
  leavingReason?: string; // New field for Reason of Leaving

  // Wage Components
  basicPay: number;
  da: number;
  retainingAllowance: number;
  hra: number;
  conveyance: number;
  washing: number;
  attire: number;
  specialAllowance1: number;
  specialAllowance2: number;
  specialAllowance3: number;

  isPFExempt: boolean;
  isESIExempt: boolean;
  // Employee Level PF Options
  employeeVPFRate: number; // Voluntary contribution above base 12%
  isPFHigherWages: boolean; // Contribute on full basic (no ceiling)
  isEmployerPFHigher: boolean; // Employer also contributes on full basic

  // NEW: Higher Pension Eligibility Fields
  epfMembershipDate?: string;
  jointDeclaration?: boolean;

  // NEW: PF Higher Pension Option Impact
  pfHigherPension?: {
    enabled: boolean;
    contributedBefore2014: 'Yes' | 'No'; // Header 1
    dojImpact: string; // Header 2 (Date)
    employeeContribution: 'Regular' | 'Higher'; // Header 3
    employerContribution: 'Regular' | 'Higher'; // Header 4
    isHigherPensionOpted: 'Yes' | 'No'; // Header 5
  };

  // NEW: Deferred Pension (Age 58+)
  isDeferredPension?: boolean;
  // Added 'OptOut' to match UI options in EmployeeList.tsx
  deferredPensionOption?: 'WithEPS' | 'WithoutEPS' | 'OptOut';
  // Added 'epsMaturityConfigured' to resolve type error in EmployeeList.tsx line 46
  epsMaturityConfigured?: boolean;

  photoUrl?: string;
  form1Url?: string;
  form2Url?: string;

  employeeDocuments?: {
    resume?: string;
    esiForm1?: string;
    pfForm2?: string;
    pfForm11?: string;
  };

  initialOpeningBalances?: {
    el: number;
    sl: number;
    cl: number;
  };

  serviceRecords: ServiceRecord[];
}

export interface PayrollResult {
  employeeId: string;
  month: string;
  year: number;
  daysInMonth: number;
  payableDays: number;
  earnings: {
    basic: number;
    da: number;
    retainingAllowance: number;
    hra: number;
    conveyance: number;
    washing: number;
    attire: number;
    special1: number;
    special2: number;
    special3: number;
    bonus: number;
    leaveEncashment: number;
    otAmount: number; // New: Overtime Payment
    total: number;
  };
  deductions: {
    epf: number;
    vpf: number;
    esi: number;
    pt: number;
    it: number;
    lwf: number;
    advanceRecovery: number;
    fine: number; // New field for Fine / Damages
    total: number;
  };
  employerContributions: {
    epf: number;
    eps: number;
    esi: number;
    lwf: number;
  };
  gratuityAccrual: number;
  netPay: number;
  status?: 'Draft' | 'Finalized'; // New field for Freezing data
  isCode88?: boolean;
  isESICodeWagesUsed?: boolean;
  isProportionatePFCapped?: boolean; // New flag for proportional PF capped wages warning
  esiRemark?: string;
  leaveSnapshot?: LeaveLedger; // Snapshot of ledger at the time of freezing
  fineReason?: string; // Store reason for fine in result for reporting
}

// New Types for Arrear Management
export interface ArrearRecord {
  id: string;
  name: string;
  oldBasic: number;
  newBasic: number;
  diffBasic: number;
  oldDA: number;
  newDA: number;
  diffDA: number;

  oldRetaining: number;
  newRetaining: number;
  diffRetaining: number;

  oldHRA: number;
  newHRA: number;
  diffHRA: number;

  oldConveyance: number;
  newConveyance: number;
  diffConveyance: number;

  oldWashing: number;
  newWashing: number;
  diffWashing: number;

  oldAttire: number;
  newAttire: number;
  diffAttire: number;

  oldSpecial1: number;
  newSpecial1: number;
  diffSpecial1: number;

  oldSpecial2: number;
  newSpecial2: number;
  diffSpecial2: number;

  oldSpecial3: number;
  newSpecial3: number;
  diffSpecial3: number;

  oldGross: number;
  newGross: number;
  diffGross: number;

  diffOthers: number; // Keep for backwards compatibility or random additions
  monthlyIncrement: number;
  months: number;
  totalArrear: number;
}

export interface ArrearBatch {
  month: string;
  year: number;
  effectiveMonth: string;
  effectiveYear: number;
  records: ArrearRecord[];
  status?: 'Draft' | 'Finalized';
}

export interface User {
  username: string;
  password?: string;
  name: string;
  role: 'Developer' | 'Administrator' | 'User';
  email: string;
}

export enum View {
  Dashboard = 'dashboard',
  Statutory = 'statutory',
  Employees = 'employees',
  PayProcess = 'pay_process', // Consolidated Pay Process View
  Reports = 'reports',
  PFCalculator = 'pf_calculator', // New Module
  MIS = 'mis', // Management Info System
  SSCode = 'ss_code', // New Module for Social Security Code Analysis
  Utilities = 'utilities',
  Settings = 'settings',
  AI_Assistant = 'ai_assistant'
}

export interface LicenseData {
  key: string;
  status: 'Active' | 'Inactive' | 'Expired' | 'Trial' | 'REGISTERED' | 'ACTIVE';
  userName: string;
  userID: string;
  registeredTo: string; // Mail ID
  registeredMobile?: string;
  machineId: string;
  password?: string;
  dataSize: number;
  startDate: string;
  expiryDate: string;
  isTrial: boolean;
  checksum?: string; // For integrity check
}

export interface OTRecord {
  employeeId: string;
  month: string;
  year: number;
  otDays: number;
  otHours: number;
  otRate: number;
  otAmount: number;
}

export interface AppVersion {
  version: string;
  releaseDate: string;
  features: string[];
  statutoryUpdates?: string[];
}
