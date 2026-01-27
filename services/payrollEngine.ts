
import { Employee, StatutoryConfig, PayrollResult, Attendance, LeaveLedger, AdvanceLedger } from '../types';
import { PT_STATE_PRESETS } from '../constants';

// Helper to map Branch/City to State for PT Compliance
const getBranchState = (branchName: string = ''): string | null => {
  const b = branchName.toLowerCase().trim();
  
  // Tamil Nadu
  if (b.includes('chennai') || b.includes('coimbatore') || b.includes('madurai') || b.includes('salem') || b.includes('tiruchirappalli') || b.includes('kanchipuram') || b.includes('hosur') || b.includes('tamil')) return 'Tamil Nadu';
  
  // Karnataka
  if (b.includes('bangalore') || b.includes('bengaluru') || b.includes('mysore') || b.includes('mangalore') || b.includes('hubli') || b.includes('belgaum') || b.includes('udupi') || b.includes('karnataka')) return 'Karnataka';
  
  // Maharashtra
  if (b.includes('mumbai') || b.includes('pune') || b.includes('nagpur') || b.includes('nashik') || b.includes('aurangabad') || b.includes('thane') || b.includes('maharashtra')) return 'Maharashtra';
  
  // West Bengal
  if (b.includes('kolkata') || b.includes('howrah') || b.includes('durgapur') || b.includes('siliguri') || b.includes('bengal')) return 'West Bengal';
  
  // Telangana
  if (b.includes('hyderabad') || b.includes('warangal') || b.includes('nizamabad') || b.includes('telangana')) return 'Telangana';
  
  // Andhra Pradesh
  if (b.includes('visakhapatnam') || b.includes('vizag') || b.includes('vijayawada') || b.includes('guntur') || b.includes('tirupati') || b.includes('andhra')) return 'Andhra Pradesh';
  
  // Kerala
  if (b.includes('kochi') || b.includes('cochin') || b.includes('trivandrum') || b.includes('thiruvananthapuram') || b.includes('kozhikode') || b.includes('calicut') || b.includes('kerala')) return 'Kerala';
  
  // Gujarat
  if (b.includes('ahmedabad') || b.includes('surat') || b.includes('vadodara') || b.includes('baroda') || b.includes('rajkot') || b.includes('gandhinagar') || b.includes('gujarat')) return 'Gujarat';
  
  return null;
};

export const calculatePayroll = (
  employee: Employee,
  config: StatutoryConfig,
  attendance: Attendance,
  leave: LeaveLedger,
  advance: AdvanceLedger,
  month: string,
  year: number
): PayrollResult => {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthIdx = months.indexOf(month);
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  
  const lop = Math.min(attendance.lopDays, daysInMonth);
  const payableDays = daysInMonth - lop;
  const factor = payableDays / daysInMonth;

  // Prorated Earnings for all 10 components (Earned Wages)
  const basic = Math.round(employee.basicPay * factor);
  const da = Math.round((employee.da || 0) * factor);
  const retaining = Math.round((employee.retainingAllowance || 0) * factor);
  const hra = Math.round((employee.hra || 0) * factor);
  const conveyance = Math.round((employee.conveyance || 0) * factor);
  const washing = Math.round((employee.washing || 0) * factor);
  const attire = Math.round((employee.attire || 0) * factor);
  const special1 = Math.round((employee.specialAllowance1 || 0) * factor);
  const special2 = Math.round((employee.specialAllowance2 || 0) * factor);
  const special3 = Math.round((employee.specialAllowance3 || 0) * factor);
  
  // Bonus is payable annually, not monthly. 
  const bonus = 0; 
  
  // Updated Leave Encashment Calculation using attendance.encashedDays
  // Formula: (Basic + DA) / DaysInMonth * EncashedDays
  const encashedDays = attendance.encashedDays || 0;
  const leaveEncashment = Math.round(((employee.basicPay + (employee.da || 0)) / daysInMonth) * encashedDays);
  
  // Total Earned Gross for this specific month
  const grossEarnings = basic + da + retaining + hra + conveyance + washing + attire + special1 + special2 + special3 + bonus + leaveEncashment;

  // Standard Monthly Gross (Master Salary) - Used for Half-Yearly Projections
  const standardMonthlyGross = employee.basicPay + 
    (employee.da || 0) + 
    (employee.retainingAllowance || 0) + 
    (employee.hra || 0) + 
    (employee.conveyance || 0) + 
    (employee.washing || 0) + 
    (employee.attire || 0) + 
    (employee.specialAllowance1 || 0) + 
    (employee.specialAllowance2 || 0) + 
    (employee.specialAllowance3 || 0);

  // --- PF Calculation Logic (New 6-Step Logic) ---
  
  // Step 1: Basic + DA + Retaining Allowance = A
  const wageA = basic + da + retaining;
  
  // Step 2: Gross wages including all components = B
  const wageB = grossEarnings;

  // Step 3: Gross wages - A = C (Allowances)
  const wageC = wageB - wageA;

  // Step 4: If C/B > 50%, then excess amount D = C - (50% of B)
  let wageD = 0;
  if (wageB > 0) {
      const allowancePercentage = wageC / wageB;
      if (allowancePercentage > 0.50) {
          // Calculate the excess amount
          const fiftyPercentOfGross = Math.round(wageB * 0.50);
          wageD = wageC - fiftyPercentOfGross;
      }
  }

  // Step 5: Gross PF wages = A + D
  let grossPFWage = wageA + wageD;
  grossPFWage = Math.round(grossPFWage);

  const isCode88 = wageD > 0;

  let epfEmployee = 0;
  let vpfEmployee = 0;
  let epfEmployer = 0;
  let epsEmployer = 0;
  
  if (!employee.isPFExempt) {
    // Determine Logic Basis
    const higherPension = employee.pfHigherPension;
    const isHigherPensionEnabled = higherPension?.enabled;

    // 1. Employee Statutory Contribution
    let pfWageForEmployee = 0;
    if (isHigherPensionEnabled && higherPension.employeeContribution === 'Higher') {
       pfWageForEmployee = grossPFWage;
    } else {
       pfWageForEmployee = employee.isPFHigherWages ? grossPFWage : Math.min(grossPFWage, config.epfCeiling);
    }
    
    const baseRate = 0.12; 
    epfEmployee = Math.round(pfWageForEmployee * baseRate);
    
    // 2. VPF (Voluntary PF by Employee)
    if (employee.employeeVPFRate > 0) {
      vpfEmployee = Math.round(pfWageForEmployee * (employee.employeeVPFRate / 100));
    }

    // 3. Employer Contribution Logic (Splitting into EPS and EPF)
    let pfWageForEmployer = 0;
    if (isHigherPensionEnabled && higherPension.employerContribution === 'Higher') {
        pfWageForEmployer = grossPFWage;
    } else {
        pfWageForEmployer = employee.isEmployerPFHigher ? grossPFWage : Math.min(grossPFWage, config.epfCeiling);
    }

    // EPS Calculation
    let epsWage = 0;
    if (isHigherPensionEnabled && higherPension.isHigherPensionOpted === 'Yes') {
        // Impact: EPS calculated on Full Wages (or Employer PF Wages if capped differently, but usually implies full for higher pension)
        epsWage = grossPFWage; 
    } else {
        // Standard: Capped at Ceiling (15000)
        epsWage = Math.min(pfWageForEmployer, config.epfCeiling);
    }
    
    epsEmployer = Math.round(epsWage * 0.0833);
    
    // Total Employer Share is 12% of (Employer PF Wage)
    const totalEmployerPF = Math.round(pfWageForEmployer * 0.12);
    
    // EPF (Employer) = Total Share - EPS Share
    // If EPS > Total due to high wage calculation (unlikely with 8.33 vs 12, but safe check), handle appropriately
    epfEmployer = Math.max(0, totalEmployerPF - epsEmployer);
  }

  // --- ESI Calculation (Updated for Social Security Code 2020) ---
  let esiEmployee = 0;
  let esiEmployer = 0;
  let isESICodeWagesUsed = false;
  let esiRemark = '';

  if (!employee.isESIExempt) {
    // 1. Determine Effective ESI Wages
    // As per Code on Social Security 2020, "Wages" definition is consistent with Code on Wages.
    // Therefore, ESI Wage should be the same as 'grossPFWage' (A + D), not Gross Earnings.
    
    let effectiveESIWage = grossPFWage;
    
    // Flag if Code Wages differs from Actual Gross (for reporting purposes)
    if (Math.abs(effectiveESIWage - grossEarnings) > 1) {
        isESICodeWagesUsed = true;
    }

    // 2. Ceiling Check (21000) with Cycle Logic (April/Oct)
    if (effectiveESIWage > config.esiCeiling) {
        // Exceeds ceiling (21000)
        
        // Check if current month is start of contribution period (April or October)
        // Rule: "if it exceed continue to contribute till the following month if April or October whichever is earlier"
        // "then if the month is April or October, no more ESI contribution allowed"
        
        if (month === 'April' || month === 'October') {
             // Employee goes OUT OF COVERAGE for this new period
             esiEmployee = 0;
             esiEmployer = 0;
             esiRemark = 'IP is out of coverage';
             isESICodeWagesUsed = false; // Reset flag as no contribution is made
        } else {
             // Continue contributing (Employee was covered at start of period or coverage continues)
             esiEmployee = Math.ceil(effectiveESIWage * config.esiEmployeeRate);
             esiEmployer = Math.ceil(effectiveESIWage * config.esiEmployerRate);
        }

    } else {
        // Within Ceiling -> Standard Calculation
        esiEmployee = Math.ceil(effectiveESIWage * config.esiEmployeeRate);
        esiEmployer = Math.ceil(effectiveESIWage * config.esiEmployerRate);
    }
  }

  // --- Professional Tax Calculation (Dynamic based on Branch/Work Location) ---
  let pt = 0;
  
  if (config.enableProfessionalTax !== false) {
      // Default to global config
      let ptCycle = config.ptDeductionCycle;
      let ptSlabs = config.ptSlabs;

      // OVERRIDE: Determine State based on Branch (Organization Hierarchy)
      const branchState = getBranchState(employee.branch);

      if (branchState && PT_STATE_PRESETS[branchState as keyof typeof PT_STATE_PRESETS]) {
          const stateRule = PT_STATE_PRESETS[branchState as keyof typeof PT_STATE_PRESETS];
          ptCycle = stateRule.cycle as any;
          ptSlabs = stateRule.slabs;
      }

      if (ptCycle === 'HalfYearly') {
        // --- Half-Yearly Logic (e.g. Tamil Nadu) ---
        let blockStartYear = year;
        let blockStartMonthIdx = 3; 
        
        if (monthIdx >= 3 && monthIdx <= 8) {
           blockStartMonthIdx = 3; 
           blockStartYear = year;
        } else {
           blockStartMonthIdx = 9; 
           if (monthIdx <= 2) { 
              blockStartYear = year - 1;
           } else { 
              blockStartYear = year;
           }
        }
        
        const blockStartDate = new Date(blockStartYear, blockStartMonthIdx, 1);
        const blockEndYear = blockStartMonthIdx === 3 ? blockStartYear : blockStartYear + 1;
        const blockEndMonthIdx = blockStartMonthIdx === 3 ? 8 : 2;
        const blockEndDate = new Date(blockEndYear, blockEndMonthIdx + 1, 0); 

        const dojDate = new Date(employee.doj);
        dojDate.setHours(0,0,0,0);
        blockStartDate.setHours(0,0,0,0);
        blockEndDate.setHours(0,0,0,0);

        const effectiveStartDate = dojDate > blockStartDate ? dojDate : blockStartDate;

        let monthsWorked = 0;
        if (effectiveStartDate <= blockEndDate) {
            monthsWorked = (blockEndDate.getFullYear() - effectiveStartDate.getFullYear()) * 12 + 
                           (blockEndDate.getMonth() - effectiveStartDate.getMonth()) + 1;
        }
        monthsWorked = Math.max(1, Math.min(6, monthsWorked));
        const projectedHalfYearlyIncome = standardMonthlyGross * monthsWorked;
        const slab = ptSlabs.find(s => projectedHalfYearlyIncome >= s.min && projectedHalfYearlyIncome <= s.max);
        
        if (slab && slab.amount > 0) {
            pt = Math.round(slab.amount / monthsWorked);
        }

      } else {
        // --- Monthly Logic ---
        if (grossEarnings > 0) {
            const slab = ptSlabs.find(s => grossEarnings >= s.min && grossEarnings <= s.max);
            if (slab) {
                pt = slab.amount;
            }
        }
      }
  }

  // --- Labour Welfare Fund (LWF) Calculation ---
  let lwfEmployee = 0;
  let lwfEmployer = 0;

  if (config.enableLWF !== false) {
      let isLWFDeductionMonth = false;
      
      // Determine Cycle Logic
      if (config.lwfDeductionCycle === 'Monthly') {
          isLWFDeductionMonth = true;
      } else if (config.lwfDeductionCycle === 'HalfYearly') {
          // Typically June and December
          isLWFDeductionMonth = month === 'June' || month === 'December';
      } else if (config.lwfDeductionCycle === 'Yearly') {
          // Typically December
          isLWFDeductionMonth = month === 'December';
      }

      if (isLWFDeductionMonth && grossEarnings > 0) {
          lwfEmployee = config.lwfEmployeeContribution;
          lwfEmployer = config.lwfEmployerContribution;
      }
  }

  // Income Tax
  let incomeTax = 0;
  const annualTaxable = (grossEarnings * 12) - 50000;
  if (annualTaxable > 700000) incomeTax = Math.round(((annualTaxable - 700000) * 0.1) / 12);

  const advanceRecovery = Math.min(advance.monthlyInstallment, advance.balance);

  const totalDeductions = epfEmployee + vpfEmployee + esiEmployee + pt + incomeTax + lwfEmployee + advanceRecovery;

  return {
    employeeId: employee.id,
    month,
    year,
    daysInMonth,
    payableDays,
    earnings: { 
      basic, 
      da, 
      retainingAllowance: retaining, 
      hra, 
      conveyance, 
      washing, 
      attire, 
      special1, 
      special2, 
      special3, 
      bonus, 
      leaveEncashment, 
      total: grossEarnings 
    },
    deductions: { 
        epf: epfEmployee, 
        vpf: vpfEmployee, 
        esi: esiEmployee, 
        pt, 
        it: incomeTax, 
        lwf: lwfEmployee, 
        advanceRecovery, 
        total: totalDeductions 
    },
    employerContributions: { 
        epf: epfEmployer, 
        eps: epsEmployer, 
        esi: esiEmployer,
        lwf: lwfEmployer 
    },
    gratuityAccrual: Math.round(((basic + da) * 15 / 26) / 12),
    netPay: grossEarnings - totalDeductions,
    isCode88,
    isESICodeWagesUsed,
    esiRemark
  };
};
