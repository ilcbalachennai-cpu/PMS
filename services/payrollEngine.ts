
import { Employee, StatutoryConfig, PayrollResult, Attendance, LeaveLedger, AdvanceLedger } from '../types';
import { PT_STATE_PRESETS } from '../constants';

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
  
  const leaveEncashment = Math.round(((basic + da) / daysInMonth) * leave.el.encashed);
  
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

  // PF Calculation Logic (PF Wage = Basic + DA + Retaining Allowance)
  const baseWageForPF = basic + da + retaining;
  let epfEmployee = 0;
  let vpfEmployee = 0;
  let epfEmployer = 0;
  let epsEmployer = 0;
  
  if (!employee.isPFExempt) {
    // 1. Employee Statutory Contribution
    let pfWageForEmployee = employee.isPFHigherWages ? baseWageForPF : Math.min(baseWageForPF, config.epfCeiling);
    
    const baseRate = 0.12; 
    epfEmployee = Math.round(pfWageForEmployee * baseRate);
    
    // 2. VPF (Voluntary PF by Employee)
    if (employee.employeeVPFRate > 0) {
      vpfEmployee = Math.round(pfWageForEmployee * (employee.employeeVPFRate / 100));
    }

    // 3. Employer Contribution
    let pfWageForEmployer = employee.isEmployerPFHigher ? baseWageForPF : Math.min(baseWageForPF, config.epfCeiling);
    
    const epsWage = Math.min(pfWageForEmployer, config.epfCeiling);
    epsEmployer = Math.round(epsWage * 0.0833);
    
    const totalEmployerPF = Math.round(pfWageForEmployer * 0.12);
    epfEmployer = totalEmployerPF - epsEmployer;
  }

  // ESI (ESI Wage = Gross Earnings)
  let esiEmployee = 0;
  let esiEmployer = 0;
  if (!employee.isESIExempt && grossEarnings <= config.esiCeiling) {
    esiEmployee = Math.ceil(grossEarnings * config.esiEmployeeRate);
    esiEmployer = Math.ceil(grossEarnings * config.esiEmployerRate);
  }

  // Professional Tax Calculation (Dynamic based on State)
  let pt = 0;
  
  // Default to global config
  let ptCycle = config.ptDeductionCycle;
  let ptSlabs = config.ptSlabs;

  // OVERRIDE: Check if Employee's state has specific rules
  if (employee.state && PT_STATE_PRESETS[employee.state as keyof typeof PT_STATE_PRESETS]) {
      const stateRule = PT_STATE_PRESETS[employee.state as keyof typeof PT_STATE_PRESETS];
      ptCycle = stateRule.cycle as any;
      ptSlabs = stateRule.slabs;
  }

  if (ptCycle === 'HalfYearly') {
    // --- Half-Yearly Logic (e.g. Tamil Nadu) ---
    // Logic: Deduct monthly based on projected half-yearly income and worked months in that block.
    
    // 1. Determine Half-Year Block (Apr-Sep or Oct-Mar)
    let blockStartYear = year;
    let blockStartMonthIdx = 3; // Default to Apr (Index 3)
    
    // Block 1: Apr(3) to Sep(8) -> Start: Apr 1, Current Year
    // Block 2: Oct(9) to Dec(11) -> Start: Oct 1, Current Year
    // Block 2: Jan(0) to Mar(2)  -> Start: Oct 1, Previous Year
    
    if (monthIdx >= 3 && monthIdx <= 8) {
       // Apr - Sep
       blockStartMonthIdx = 3; 
       blockStartYear = year;
    } else {
       // Oct - Mar
       blockStartMonthIdx = 9; // Oct
       if (monthIdx <= 2) { // Jan, Feb, Mar
          blockStartYear = year - 1;
       } else { // Oct, Nov, Dec
          blockStartYear = year;
       }
    }
    
    const blockStartDate = new Date(blockStartYear, blockStartMonthIdx, 1);
    
    // Determine Block End Date
    // If started Apr(3), end is Sep(8) 30th
    // If started Oct(9), end is Mar(2) 31st next year
    const blockEndYear = blockStartMonthIdx === 3 ? blockStartYear : blockStartYear + 1;
    const blockEndMonthIdx = blockStartMonthIdx === 3 ? 8 : 2;
    const blockEndDate = new Date(blockEndYear, blockEndMonthIdx + 1, 0); // Last day of month

    // 2. Determine Effective Start Date (Later of Block Start or DOJ)
    const dojDate = new Date(employee.doj);
    // Normalize times to midnight for comparison
    dojDate.setHours(0,0,0,0);
    blockStartDate.setHours(0,0,0,0);
    blockEndDate.setHours(0,0,0,0);

    const effectiveStartDate = dojDate > blockStartDate ? dojDate : blockStartDate;

    // 3. Calculate Months Worked/Active in this Block
    // Logic: (EndYear - StartYear)*12 + (EndMonth - StartMonth) + 1 (Inclusive)
    let monthsWorked = 0;
    
    if (effectiveStartDate <= blockEndDate) {
        monthsWorked = (blockEndDate.getFullYear() - effectiveStartDate.getFullYear()) * 12 + 
                       (blockEndDate.getMonth() - effectiveStartDate.getMonth()) + 1;
    }

    // Safety clamp (Block is max 6 months)
    monthsWorked = Math.max(1, Math.min(6, monthsWorked));

    // 4. Calculate Projected Income using Standard Monthly Gross (Master)
    // Use Master Salary (22500) * Months (6 or 5) as per Case Study
    const projectedHalfYearlyIncome = standardMonthlyGross * monthsWorked;

    // 5. Find applicable Slab
    const slab = ptSlabs.find(s => projectedHalfYearlyIncome >= s.min && projectedHalfYearlyIncome <= s.max);
    
    if (slab && slab.amount > 0) {
        // 6. Amortize tax over the active months
        // e.g. 1250 / 6 = 208, or 1250 / 5 = 250
        pt = Math.round(slab.amount / monthsWorked);
    }

  } else {
    // --- Monthly Logic (e.g. Karnataka) ---
    // Uses actual Earned Gross for the month
    if (grossEarnings > 0) {
        const slab = ptSlabs.find(s => grossEarnings >= s.min && grossEarnings <= s.max);
        if (slab) {
            pt = slab.amount;
        }
    }
  }

  // Income Tax
  let incomeTax = 0;
  const annualTaxable = (grossEarnings * 12) - 50000;
  if (annualTaxable > 700000) incomeTax = Math.round(((annualTaxable - 700000) * 0.1) / 12);

  const lwf = config.lwfAmount;
  const advanceRecovery = Math.min(advance.monthlyInstallment, advance.balance);

  const totalDeductions = epfEmployee + vpfEmployee + esiEmployee + pt + incomeTax + lwf + advanceRecovery;

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
    deductions: { epf: epfEmployee, vpf: vpfEmployee, esi: esiEmployee, pt, it: incomeTax, lwf, advanceRecovery, total: totalDeductions },
    employerContributions: { epf: epfEmployer, eps: epsEmployer, esi: esiEmployer },
    gratuityAccrual: Math.round(((basic + da) * 15 / 26) / 12),
    netPay: grossEarnings - totalDeductions
  };
};
