
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
  
  // --- DOL (Date of Leaving) LOGIC ---
  let effectivePayableDays = 0;
  let isLeftService = false;
  let exitRemark = '';

  if (employee.dol) {
      const periodStart = new Date(year, monthIdx, 1);
      periodStart.setHours(0,0,0,0);
      
      const periodEnd = new Date(year, monthIdx + 1, 0);
      periodEnd.setHours(23,59,59,999);
      
      const dolDate = new Date(employee.dol);
      dolDate.setHours(0,0,0,0);

      // Case 1: Employee Left BEFORE this month started
      if (dolDate < periodStart) {
          return {
            employeeId: employee.id,
            month,
            year,
            daysInMonth,
            payableDays: 0,
            earnings: { 
                basic: 0, da: 0, retainingAllowance: 0, hra: 0, conveyance: 0, washing: 0, attire: 0, 
                special1: 0, special2: 0, special3: 0, bonus: 0, leaveEncashment: 0, total: 0 
            },
            deductions: { epf: 0, vpf: 0, esi: 0, pt: 0, it: 0, lwf: 0, advanceRecovery: 0, total: 0 },
            employerContributions: { epf: 0, eps: 0, esi: 0, lwf: 0 },
            gratuityAccrual: 0,
            netPay: 0,
            isCode88: false,
            isESICodeWagesUsed: false,
            esiRemark: 'Left Service'
          };
      }

      // Case 2: Employee Left DURING this month
      if (dolDate >= periodStart && dolDate <= periodEnd) {
          isLeftService = true;
          exitRemark = `Left: ${employee.dol}`;
          const daysUntilDOL = dolDate.getDate(); 
          const lop = Math.min(attendance.lopDays, daysInMonth);
          const requestedPayable = daysInMonth - lop;
          effectivePayableDays = Math.min(requestedPayable, daysUntilDOL);
      } else {
          const lop = Math.min(attendance.lopDays, daysInMonth);
          effectivePayableDays = daysInMonth - lop;
      }
  } else {
      const lop = Math.min(attendance.lopDays, daysInMonth);
      effectivePayableDays = daysInMonth - lop;
  }

  const factor = effectivePayableDays / daysInMonth;

  // Prorated Earnings
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
  
  const bonus = 0; 
  const encashedDays = attendance.encashedDays || 0;
  const leaveEncashment = Math.round(((employee.basicPay + (employee.da || 0)) / daysInMonth) * encashedDays);
  const grossEarnings = basic + da + retaining + hra + conveyance + washing + attire + special1 + special2 + special3 + bonus + leaveEncashment;

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

  // --- PF Calculation Logic ---
  const wageA = basic + da + retaining;
  const wageB = grossEarnings;
  const wageC = wageB - wageA;

  let wageD = 0;
  if (wageB > 0) {
      const allowancePercentage = wageC / wageB;
      if (allowancePercentage > 0.50) {
          const fiftyPercentOfGross = Math.round(wageB * 0.50);
          wageD = wageC - fiftyPercentOfGross;
      }
  }

  // Base Logic: Code Wages (Clause 88)
  let basePFWage = Math.round(wageA + wageD);
  let isCode88 = wageD > 0;

  // --- NEW: Higher Contribution Wage Arriving ---
  if (config.enableHigherContribution) {
    const hc = config.higherContributionComponents;
    let higherWageBase = 0;
    if (hc.basic) higherWageBase += basic;
    if (hc.da) higherWageBase += da;
    if (hc.retaining) higherWageBase += retaining;
    if (hc.conveyance) higherWageBase += conveyance;
    if (hc.washing) higherWageBase += washing;
    if (hc.attire) higherWageBase += attire;
    if (hc.special1) higherWageBase += special1;
    if (hc.special2) higherWageBase += special2;
    if (hc.special3) higherWageBase += special3;

    // RULE: Only consider if higher than Code Wages
    if (higherWageBase > basePFWage) {
        basePFWage = Math.round(higherWageBase);
        isCode88 = false; // Higher base overrides Code adjustment
    }
  }

  let epfEmployee = 0;
  let vpfEmployee = 0;
  let epfEmployer = 0;
  let epsEmployer = 0;
  
  // OPT OUT LOGIC (AGE 58+)
  const isOptOut = employee.isDeferredPension && employee.deferredPensionOption === 'OptOut';

  if (!employee.isPFExempt && !isOptOut) {
    const hp = employee.pfHigherPension;
    
    const A5 = hp?.contributedBefore2014 === 'Yes';
    const B5_Date = employee.epfMembershipDate ? new Date(employee.epfMembershipDate) : null;
    const C5 = hp?.employeeContribution || (employee.isPFHigherWages ? 'Higher' : 'Regular');
    const D5 = hp?.employerContribution || (employee.isEmployerPFHigher ? 'Higher' : 'Regular');
    const E5 = hp?.isHigherPensionOpted === 'Yes';
    
    const CUTOFF_2014 = new Date('2014-09-01');
    const isPost2014 = B5_Date && B5_Date >= CUTOFF_2014;
    const isPre2014 = B5_Date && B5_Date < CUTOFF_2014;

    // J5: EPF WAGES (Column J)
    let J5_EPFWage = 0;
    if (D5 === 'Higher' || (config.enableHigherContribution && config.higherContributionType === 'By Employee & Employer')) {
        J5_EPFWage = basePFWage;
    } else {
        if (C5 === 'Regular') {
            J5_EPFWage = Math.min(basePFWage, config.epfCeiling);
        } else {
            J5_EPFWage = basePFWage; 
        }
    }

    // K5: EPS WAGES (Column K)
    let K5_EPSWage = 0;
    if (A5 && C5 === 'Higher' && D5 === 'Higher' && E5 && isPre2014) {
        K5_EPSWage = J5_EPFWage;
    } else if (!A5 && isPost2014 && basePFWage > config.epfCeiling) {
        K5_EPSWage = 0;
    } else {
        if (J5_EPFWage > config.epfCeiling) {
            if (D5 === 'Regular') K5_EPSWage = config.epfCeiling;
            else if (!E5) K5_EPSWage = config.epfCeiling;
            else if (!A5) K5_EPSWage = config.epfCeiling;
            else K5_EPSWage = J5_EPFWage;
        } else {
            K5_EPSWage = J5_EPFWage;
        }
    }

    // M5: EPF Remitted (Employee Share)
    // If Higher Contribution is enabled "By Employee", we calculate share on basePFWage without ceiling if selected
    let eeBasis = (config.enableHigherContribution && config.higherContributionType !== 'By Employee') 
        ? J5_EPFWage 
        : (config.enableHigherContribution ? basePFWage : J5_EPFWage);
    
    epfEmployee = Math.round(eeBasis * config.epfEmployeeRate);

    // VPF
    if (employee.employeeVPFRate > 0) {
        vpfEmployee = Math.round(eeBasis * (employee.employeeVPFRate / 100));
    }

    // N5: EPS Remitted (Pension Fund)
    if (!E5) {
        if (K5_EPSWage === 0) epsEmployer = 0;
        else {
            const basis = Math.min(basePFWage, config.epfCeiling);
            epsEmployer = Math.round(basis * 0.0833);
        }
    } else {
        epsEmployer = Math.round(K5_EPSWage * 0.0833);
    }

    // O5: EPF Employer Share (Diff)
    if (K5_EPSWage === 0) {
        epfEmployer = Math.round(J5_EPFWage * config.epfEmployerRate);
    } else if (D5 === 'Higher' || (config.enableHigherContribution && config.higherContributionType === 'By Employee & Employer')) {
        const totalLiability = Math.round(J5_EPFWage * config.epfEmployerRate);
        epfEmployer = totalLiability - epsEmployer;
    } else {
        const totalLiability = Math.round(K5_EPSWage * config.epfEmployerRate);
        epfEmployer = totalLiability - epsEmployer;
    }

    if (employee.isDeferredPension && employee.deferredPensionOption === 'WithoutEPS') {
       const totalER = epfEmployer + epsEmployer;
       epfEmployer = totalER;
       epsEmployer = 0;
    }

  } else if (isOptOut) {
      basePFWage = 0;
      isCode88 = false;
      epfEmployee = 0;
      vpfEmployee = 0;
      epfEmployer = 0;
      epsEmployer = 0;
  }

  // --- ESI Calculation ---
  let esiEmployee = 0;
  let esiEmployer = 0;
  let isESICodeWagesUsed = false;
  let esiRemark = exitRemark || '';

  if (!employee.isESIExempt) {
    const esiWageBase = isOptOut ? Math.round(wageA + wageD) : basePFWage;
    let effectiveESIWage = esiWageBase;

    if (Math.abs(effectiveESIWage - grossEarnings) > 1) {
        isESICodeWagesUsed = true;
    }

    if (effectiveESIWage > config.esiCeiling) {
        if (month === 'April' || month === 'October') {
             esiEmployee = 0;
             esiEmployer = 0;
             esiRemark = 'IP is out of coverage';
             isESICodeWagesUsed = false;
        } else {
             esiEmployee = Math.ceil(effectiveESIWage * config.esiEmployeeRate);
             esiEmployer = Math.ceil(effectiveESIWage * config.esiEmployerRate);
        }
    } else {
        esiEmployee = Math.ceil(effectiveESIWage * config.esiEmployeeRate);
        esiEmployer = Math.ceil(effectiveESIWage * config.esiEmployerRate);
    }
  }

  // --- Professional Tax ---
  let pt = 0;
  if (config.enableProfessionalTax !== false) {
      let ptCycle = config.ptDeductionCycle;
      let ptSlabs = config.ptSlabs;
      const branchState = getBranchState(employee.branch);

      if (branchState && PT_STATE_PRESETS[branchState as keyof typeof PT_STATE_PRESETS]) {
          const stateRule = PT_STATE_PRESETS[branchState as keyof typeof PT_STATE_PRESETS];
          ptCycle = stateRule.cycle as any;
          ptSlabs = stateRule.slabs;
      }

      if (ptCycle === 'HalfYearly') {
        let blockStartYear = year;
        let blockStartMonthIdx = 3; 
        if (monthIdx >= 3 && monthIdx <= 8) {
           blockStartMonthIdx = 3; blockStartYear = year;
        } else {
           blockStartMonthIdx = 9; 
           blockStartYear = (monthIdx <= 2) ? year - 1 : year;
        }
        const blockStartDate = new Date(blockStartYear, blockStartMonthIdx, 1);
        const blockEndYear = blockStartMonthIdx === 3 ? blockStartYear : blockStartYear + 1;
        const blockEndMonthIdx = blockStartMonthIdx === 3 ? 8 : 2;
        const blockEndDate = new Date(blockEndYear, blockEndMonthIdx + 1, 0); 
        const dojDate = new Date(employee.doj);
        const effectiveStartDate = dojDate > blockStartDate ? dojDate : blockStartDate;

        let monthsWorked = 0;
        if (effectiveStartDate <= blockEndDate) {
            monthsWorked = (blockEndDate.getFullYear() - effectiveStartDate.getFullYear()) * 12 + 
                           (blockEndDate.getMonth() - effectiveStartDate.getMonth()) + 1;
        }
        monthsWorked = Math.max(1, Math.min(6, monthsWorked));
        const slab = ptSlabs.find(s => (standardMonthlyGross * monthsWorked) >= s.min && (standardMonthlyGross * monthsWorked) <= s.max);
        if (slab && slab.amount > 0) pt = Math.round(slab.amount / monthsWorked);
      } else {
        if (grossEarnings > 0) {
            const slab = ptSlabs.find(s => grossEarnings >= s.min && grossEarnings <= s.max);
            if (slab) pt = slab.amount;
        }
      }
  }

  // --- LWF ---
  let lwfEmployee = 0;
  let lwfEmployer = 0;
  if (config.enableLWF !== false) {
      let isLWFDeductionMonth = false;
      if (config.lwfDeductionCycle === 'Monthly') isLWFDeductionMonth = true;
      else if (config.lwfDeductionCycle === 'HalfYearly') isLWFDeductionMonth = month === 'June' || month === 'December';
      else if (config.lwfDeductionCycle === 'Yearly') isLWFDeductionMonth = month === 'December';

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
    payableDays: effectivePayableDays,
    earnings: { 
      basic, da, retainingAllowance: retaining, hra, conveyance, washing, attire, 
      special1, special2, special3, bonus, leaveEncashment, total: grossEarnings 
    },
    deductions: { epf: epfEmployee, vpf: vpfEmployee, esi: esiEmployee, pt, it: incomeTax, lwf: lwfEmployee, advanceRecovery, total: totalDeductions },
    employerContributions: { epf: epfEmployer, eps: epsEmployer, esi: esiEmployer, lwf: lwfEmployer },
    gratuityAccrual: Math.round(((basic + da) * 15 / 26) / 12),
    netPay: grossEarnings - totalDeductions,
    isCode88,
    isESICodeWagesUsed,
    esiRemark
  };
};
