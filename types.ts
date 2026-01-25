
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
  opening: number; // New field for Opening Balance
  totalAdvance: number;
  monthlyInstallment: number;
  paidAmount: number;
  balance: number;
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
  ptDeductionCycle: 'Monthly' | 'HalfYearly'; // Monthly for KA/MH, HalfYearly for TN/Kerala
  ptSlabs: { min: number; max: number; amount: number }[];
  lwfAmount: number;
  bonusRate: number;
  pfComplianceType: PFComplianceType; // Company-level compliance
}

export interface CompanyProfile {
  establishmentName: string;
  tradeName: string;
  cin: string; // ID Proof
  lin: string; // Labour Identification No
  pfCode: string;
  esiCode: string;
  gstNo: string;
  pan: string;
  address: string; // Registered Office Address
  state: string;
  city: string;
  mobile: string;
  telephone: string;
  email: string;
  website: string;
  natureOfBusiness: string;
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
  
  // Address Breakdown
  flatNumber: string;
  streetAddress: string;
  city: string;
  state: string;
  pincode: string;
  
  mobile: string;
  bankAccount: string;
  ifsc: string;
  doj: string;
  dol?: string;
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
  photoUrl?: string;
  form1Url?: string;
  form2Url?: string;
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
    total: number;
  };
  employerContributions: {
    epf: number;
    eps: number;
    esi: number;
  };
  gratuityAccrual: number;
  netPay: number;
  status?: 'Draft' | 'Finalized'; // New field for Freezing data
  isCode88?: boolean;
  isESICodeWagesUsed?: boolean;
  esiRemark?: string;
}

export interface User {
  username: string;
  password?: string;
  name: string;
  role: 'Admin' | 'HR' | 'Viewer';
  email: string;
}

export enum View {
  Dashboard = 'dashboard',
  Statutory = 'statutory',
  Employees = 'employees',
  PayProcess = 'pay_process', // Consolidated Pay Process View
  Reports = 'reports',
  Utilities = 'utilities',
  Settings = 'settings',
  AI_Assistant = 'ai_assistant'
}