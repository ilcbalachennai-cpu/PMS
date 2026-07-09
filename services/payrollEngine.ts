
import { Employee, StatutoryConfig, PayrollResult, Attendance, LeaveLedger, AdvanceLedger, FineRecord, OTRecord } from '../types';
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

const getComponentBasedWage = (employee: Employee, components: any, factor: number): number => {
    let base = 0;
    if (components.basic) base += employee.basicPay;
    if (components.da) base += (employee.da || 0);
    if (components.retaining) base += (employee.retainingAllowance || 0);
    if (components.hra) base += (employee.hra || 0);
    if (components.conveyance) base += (employee.conveyance || 0);
    if (components.washing) base += (employee.washing || 0);
    if (components.attire) base += (employee.attire || 0);
    if (components.special1) base += (employee.specialAllowance1 || 0);
    if (components.special2) base += (employee.specialAllowance2 || 0);
    if (components.special3) base += (employee.specialAllowance3 || 0);
    return Math.round(base * factor);
};

const getESICoverageRemark = (employee: Employee, config: StatutoryConfig, month: string, year: number, payrollHistory: PayrollResult[], standardMonthlyGross: number): string | null => {
    if (config.enableESI === false || employee.isESIExempt) {
        return null;
    }

    const stdBasic = employee.basicPay || 0;
    const stdDA = employee.da || 0;
    const stdRetaining = employee.retainingAllowance || 0;
    const stdWageA = stdBasic + stdDA + stdRetaining;
    
    let stdESIWageBase = stdWageA;
    if (config.pfEsiCalculationBasis === 'OriginalWages') {
        stdESIWageBase = getComponentBasedWage(employee, config.esiOriginalWagesComponents, 1);
    } else {
        const stdGross = standardMonthlyGross;
        const stdWageC = stdGross - stdWageA;
        let stdWageD = 0;
        if (stdGross > 0) {
            const allowancePercentage = stdWageC / stdGross;
            if (allowancePercentage > 0.50) {
                stdWageD = stdWageC - Math.round(stdGross * 0.50);
            }
        }
        stdESIWageBase = stdWageA + stdWageD;
    }

    const isAboveCeiling = (stdWageA > config.esiCeiling) || (stdESIWageBase > config.esiCeiling);

    const getESIPeriodStart = (m: string, y: number): { month: string; year: number } => {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const mIdx = months.indexOf(m);
        if (mIdx >= 3 && mIdx <= 8) return { month: 'April', year: y };
        else if (mIdx >= 9) return { month: 'October', year: y };
        else return { month: 'October', year: y - 1 };
    };

    const getESIPeriodMonthsUpTo = (m: string, y: number): { month: string; year: number }[] => {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const startInfo = getESIPeriodStart(m, y);
        const startIdx = months.indexOf(startInfo.month);
        const list: { month: string; year: number }[] = [];
        let currYear = startInfo.year;
        let currMIdx = startIdx;
        while (true) {
            const mName = months[currMIdx];
            list.push({ month: mName, year: currYear });
            if (mName === m && currYear === y) break;
            currMIdx++;
            if (currMIdx > 11) {
                currMIdx = 0;
                currYear++;
            }
        }
        return list;
    };

    const periodMonths = getESIPeriodMonthsUpTo(month, year);
    const pastPeriodMonths = periodMonths.filter(pm => !(pm.month === month && pm.year === year));

    const pastRecords = payrollHistory.filter(r => 
        r.employeeId === employee.id &&
        pastPeriodMonths.some(pm => pm.month === r.month && pm.year === r.year)
    );

    let earliestRecord: PayrollResult | undefined = undefined;
    for (const pm of pastPeriodMonths) {
        const match = pastRecords.find(r => r.month === pm.month && r.year === pm.year);
        if (match) {
            earliestRecord = match;
            break;
        }
    }

    const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthIdx = monthsArr.indexOf(month);
    const isStartOfPeriod = month === 'April' || month === 'October';
    const periodStart = new Date(year, monthIdx, 1);
    periodStart.setHours(0, 0, 0, 0);

    const empDOJ = new Date(employee.doj);
    empDOJ.setHours(0, 0, 0, 0);
    const isNewJoinee = empDOJ >= periodStart;

    let wasCoveredAtStart = true;
    if (earliestRecord && earliestRecord.deductions && earliestRecord.deductions.esi !== null && earliestRecord.deductions.esi !== undefined) {
        if (earliestRecord.esiRemark === 'IP is out of coverage (Salary > Ceiling)') {
            wasCoveredAtStart = false;
        } else if (earliestRecord.deductions.esi === 0 && (earliestRecord.esiRemark || '') === '') {
            const earliestBasic = earliestRecord.earnings.basic || 0;
            const earliestDA = earliestRecord.earnings.da || 0;
            const earliestRetaining = earliestRecord.earnings.retainingAllowance || 0;
            const earliestWageA = earliestBasic + earliestDA + earliestRetaining;
            
            let earliestESIBase = earliestWageA;
            if (config.pfEsiCalculationBasis === 'LabourCode') {
                const earliestGross = earliestRecord.earnings.total || 0;
                const earliestWageC = earliestGross - earliestWageA;
                let earliestWageD = 0;
                if (earliestGross > 0) {
                    const allowancePercentage = earliestWageC / earliestGross;
                    if (allowancePercentage > 0.50) {
                        earliestWageD = earliestWageC - Math.round(earliestGross * 0.50);
                    }
                }
                earliestESIBase = earliestWageA + earliestWageD;
            } else {
                let base = 0;
                const comps = config.esiOriginalWagesComponents;
                if (comps.basic) base += (earliestRecord.earnings.basic || 0);
                if (comps.da) base += (earliestRecord.earnings.da || 0);
                if (comps.retaining) base += (earliestRecord.earnings.retainingAllowance || 0);
                if (comps.hra) base += (earliestRecord.earnings.hra || 0);
                if (comps.conveyance) base += (earliestRecord.earnings.conveyance || 0);
                if (comps.washing) base += (earliestRecord.earnings.washing || 0);
                if (comps.attire) base += (earliestRecord.earnings.attire || 0);
                if (comps.special1) base += (earliestRecord.earnings.special1 || 0);
                if (comps.special2) base += (earliestRecord.earnings.special2 || 0);
                if (comps.special3) base += (earliestRecord.earnings.special3 || 0);
                earliestESIBase = base;
            }
            const earliestAboveCeiling = earliestWageA > config.esiCeiling || earliestESIBase > config.esiCeiling;
            wasCoveredAtStart = !earliestAboveCeiling;
        } else {
            wasCoveredAtStart = true;
        }
    } else {
        wasCoveredAtStart = (isStartOfPeriod || isNewJoinee) ? !isAboveCeiling : !isAboveCeiling;
    }

    if (!wasCoveredAtStart) {
        return 'IP is out of coverage (Salary > Ceiling)';
    } else {
        if (isAboveCeiling) {
            return 'Continued Coverage (Mid-Period)';
        }
        return '';
    }
};

export const calculatePayroll = (
    employee: Employee,
    config: StatutoryConfig,
    attendance: Attendance,
    leave: LeaveLedger,
    advance: AdvanceLedger,
    month: string,
    year: number,
    advanceOptions: { restrictTo50Percent: boolean } = { restrictTo50Percent: false },
    fines: FineRecord[] = [],
    otRecord: OTRecord | null = null,
    arrearAmount: number = 0,
    payrollHistory: PayrollResult[] = []
): PayrollResult => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthIdx = months.indexOf(month);
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

    // --- Calculation of Payable Days ---
    const paidLeaveDays = (attendance.earnedLeave || 0) +
        (attendance.sickLeave || 0) +
        (attendance.casualLeave || 0);

    let effectivePayableDays = (attendance.presentDays || 0) + paidLeaveDays;

    // --- DOL (Date of Leaving) Logic Checks ---
    let exitRemark = '';

    if (employee.dol) {
        const periodStart = new Date(year, monthIdx, 1);
        periodStart.setHours(0, 0, 0, 0);

        const periodEnd = new Date(year, monthIdx + 1, 0);
        periodEnd.setHours(23, 59, 59, 999);

        const dolDate = new Date(employee.dol);
        dolDate.setHours(0, 0, 0, 0);

        if (dolDate < periodStart) {
            effectivePayableDays = 0;
            exitRemark = 'Left Service (Previous Period)';
        }
        else if (dolDate >= periodStart && dolDate <= periodEnd) {

            exitRemark = `Left: ${employee.dol}`;
        }
    }

    effectivePayableDays = Math.min(effectivePayableDays, daysInMonth);

    // PREPARE SNAPSHOT: Create a frozen copy of leave ledger state specifically for this payroll run
    const leaveSnapshot = JSON.parse(JSON.stringify(leave));

    // Force update 'availed' and 'encashed' counts in snapshot
    if (leaveSnapshot.el) {
        leaveSnapshot.el.availed = attendance.earnedLeave || 0;
        leaveSnapshot.el.encashed = attendance.encashedDays || 0;
        leaveSnapshot.el.balance = (leaveSnapshot.el.opening || 0) + (leaveSnapshot.el.eligible || 0) - (leaveSnapshot.el.encashed || 0) - (leaveSnapshot.el.availed || 0);
    }
    if (leaveSnapshot.sl) {
        leaveSnapshot.sl.availed = attendance.sickLeave || 0;
        leaveSnapshot.sl.balance = (leaveSnapshot.sl.eligible || 0) - (leaveSnapshot.sl.availed || 0);
    }
    if (leaveSnapshot.cl) {
        leaveSnapshot.cl.availed = attendance.casualLeave || 0;
        leaveSnapshot.cl.balance = (leaveSnapshot.cl.accumulation || 0) - (leaveSnapshot.cl.availed || 0);
    }

    const standardMonthlyGross = employee.basicPay + (employee.da || 0) + (employee.retainingAllowance || 0) + (employee.hra || 0) + (employee.conveyance || 0) + (employee.washing || 0) + (employee.attire || 0) + (employee.specialAllowance1 || 0) + (employee.specialAllowance2 || 0) + (employee.specialAllowance3 || 0);
    const baseESIRemark = getESICoverageRemark(employee, config, month, year, payrollHistory, standardMonthlyGross);

    if (effectivePayableDays <= 0) {
        return {
            employeeId: employee.id,
            month,
            year,
            daysInMonth,
            payableDays: 0,
            earnings: {
                basic: 0, da: 0, retainingAllowance: 0, hra: 0, conveyance: 0, washing: 0, attire: 0,
                special1: 0, special2: 0, special3: 0, bonus: 0, leaveEncashment: 0,
                otAmount: 0, arrears: 0, total: 0
            },
            deductions: { epf: 0, vpf: 0, esi: 0, pt: 0, it: 0, lwf: 0, advanceRecovery: 0, fine: 0, total: 0 },
            employerContributions: { epf: 0, eps: 0, esi: 0, lwf: 0 },
            gratuityAccrual: 0,
            netPay: 0,
            isCode88: false,
            isESICodeWagesUsed: false,
            esiRemark: baseESIRemark || exitRemark || 'No Payable Days',
            fineReason: '',
            leaveSnapshot: leaveSnapshot
        };
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

    const bonusRate = config.enableBonus !== false ? (config.bonusRate || 0) : 0; // Bug fix: Do not divide by 100 as it is already stored as a fraction (e.g., 0.0833)
    let bonus = 0;
    const encashedDays = attendance.encashedDays || 0;

    const lwComponents = config.leaveWagesComponents || { basic: true, da: true, retaining: false, hra: false, conveyance: false, washing: false, attire: false, special1: false, special2: false, special3: false };
    const leaveWageBaseRaw = getComponentBasedWage(employee, lwComponents, 1);

    const leaveEncashment = Math.round((leaveWageBaseRaw / daysInMonth) * encashedDays);

    // Removed bonus from grossEarnings as per user request (Bonus is not paid monthly)
    let grossEarnings = basic + da + retaining + hra + conveyance + washing + attire + special1 + special2 + special3 + leaveEncashment;

    // standardGross moved above for early ESI Check

    // --- PF Calculation Logic ---

    // 1. PF Ceiling (We no longer use proportional ceiling calculation)
    const proratedCeiling = config.epfCeiling;

    // 2. Calculate Code Wages (As per Code on Wages 2020 - Clause 88)
    const wageA = basic + da + retaining; // Basic Wage
    const wageB = grossEarnings;          // Total Remuneration
    const wageC = wageB - wageA;          // Allowances (Exclusions)

    let wageD = 0; // Excess to be added
    if (wageB > 0) {
        const allowancePercentage = wageC / wageB;
        if (allowancePercentage > 0.50) {
            const fiftyPercentOfGross = Math.round(wageB * 0.50);
            wageD = wageC - fiftyPercentOfGross;
        }
    }
    const codeWage = Math.round(wageA + wageD);

    // 2b. Determine Standard Basis Wages based on Global Policy
    let pfStandardBasisWage = codeWage;
    let esiStandardBasisWage = codeWage;

    if (config.pfEsiCalculationBasis === 'OriginalWages') {
        pfStandardBasisWage = getComponentBasedWage(employee, config.pfOriginalWagesComponents, factor);
        esiStandardBasisWage = getComponentBasedWage(employee, config.esiOriginalWagesComponents, factor);
    }

    // --- Bonus Calculation ---
    let bonusBasisWage = codeWage;
    if (config.pfEsiCalculationBasis === 'OriginalWages') {
        bonusBasisWage = getComponentBasedWage(employee, config.bonusWagesComponents, factor);
    }
    bonus = Math.round(bonusBasisWage * bonusRate);

    // Removed bonus from grossEarnings recalculation as per user request
    grossEarnings = basic + da + retaining + hra + conveyance + washing + attire + special1 + special2 + special3 + leaveEncashment;
    
    let isCode88 = (config.pfEsiCalculationBasis === 'LabourCode' && wageD > 0);

    // 3. Determine Final PF Wage based on Configuration & Examples
    let basePFWage = 0;
    let isProportionatePFCapped = false;

    const isHigherContribApplicable = config.enableHigherContribution;

    if (config.enablePF === false) {
        basePFWage = 0;
        isCode88 = false;
    } else if (isHigherContribApplicable) {
        // Logic for "Higher Contribution = Yes" (Examples 2, 4, 6, 8)
        // If Higher Contribution is enabled, we use the sum of configured components (Actual Wage),
        // effectively treating it as "Higher Wages" opted.

        const hc = config.higherContributionComponents;
        let higherWageBase = 0;
        if (hc.basic) higherWageBase += basic;
        if (hc.da) higherWageBase += da;
        if (hc.retaining) higherWageBase += retaining;
        if (hc.hra) higherWageBase += hra;
        if (hc.conveyance) higherWageBase += conveyance;
        if (hc.washing) higherWageBase += washing;
        if (hc.attire) higherWageBase += attire;
        if (hc.special1) higherWageBase += special1;
        if (hc.special2) higherWageBase += special2;
        if (hc.special3) higherWageBase += special3;

        higherWageBase = Math.round(higherWageBase);

        const hcCeiling = Math.round((config.epfCeiling || 15000) * factor);

        if (higherWageBase < hcCeiling) {
            let baseVal = higherWageBase;
            if (grossEarnings > hcCeiling) {
                baseVal = hcCeiling;
            }

            if (config.pfEsiCalculationBasis === 'OriginalWages') {
                basePFWage = baseVal;
                isCode88 = false;
            } else {
                const codeBasisCapped = Math.min(codeWage, hcCeiling);
                basePFWage = Math.max(baseVal, codeBasisCapped);
                isCode88 = (basePFWage === codeBasisCapped && wageD > 0);
            }
        } else {
            basePFWage = higherWageBase;
            isCode88 = false;
        }

    } else {
        // Logic for "Higher Contribution = No" (Examples 1, 3, 5, 7)
        // Rule: Wage is capped at Prorated Ceiling.
        // Exception: If Basis Wage is lower than Ceiling, use Basis Wage.

        // Ex 1, 3, 5: Basis Wage or Actual Wage > Ceiling -> Result: Ceiling.
        // Ex 7: Actual Wage < Basis Wage < Ceiling -> Result: Basis Wage.

        basePFWage = Math.min(pfStandardBasisWage, proratedCeiling);
        
        // Capping is no longer proportional due to NCP days
        isProportionatePFCapped = false;
    }

    let epfEmployee = 0;
    let vpfEmployee = 0;
    let epfEmployer = 0;
    let epsEmployer = 0;

    // Calculate employee age at processing month
    let age = 0;
    if (employee.dob) {
        const dob = new Date(employee.dob);
        const monthIdx = months.indexOf(month);
        const periodEnd = new Date(year, monthIdx + 1, 0); // Last day of processing month
        age = periodEnd.getFullYear() - dob.getFullYear();
        const m = periodEnd.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && periodEnd.getDate() < dob.getDate())) {
            age--;
        }
    }

    const isAge58To60 = age >= 58 && age < 60;
    const isAge60OrAbove = age >= 60;

    let isPFActive = false;
    if (config.enablePF !== false && !employee.isPFExempt) {
        if (isAge58To60) {
            isPFActive = !!employee.isDeferredPension && employee.deferredPensionOption !== 'OptOut';
        } else if (isAge60OrAbove) {
            isPFActive = true;
        } else {
            isPFActive = true;
        }
    }

    if (isPFActive) {
        const hp = employee.pfHigherPension;

        const A5 = hp?.contributedBefore2014 === 'Yes';
        const B5_Date = employee.epfMembershipDate ? new Date(employee.epfMembershipDate) : null;
        const C5 = hp?.employeeContribution || (config.enableHigherContribution ? 'Higher' : 'Regular'); // Default to Higher if global config enabled to match wage calculation
        const D5 = hp?.employerContribution || (config.enableHigherContribution ? 'Higher' : 'Regular'); // Default to Higher if global config enabled
        const E5 = hp?.isHigherPensionOpted === 'Yes';

        const CUTOFF_2014 = new Date('2014-09-01');
        const isPost2014 = B5_Date && B5_Date >= CUTOFF_2014;
        const isPre2014 = B5_Date && B5_Date < CUTOFF_2014;

        // Determine Wages for Split (EPF vs EPS)
        let J5_EPFWage = 0;

        // If Employer is contributing Higher, use the full basePFWage
        if (D5 === 'Higher' || (config.enableHigherContribution && config.higherContributionType === 'By Employee & Employer')) {
            J5_EPFWage = basePFWage;
        } else {
            // If Employer is Regular, cap the wage used for their split logic at Ceiling
            if (C5 === 'Regular') {
                J5_EPFWage = Math.min(basePFWage, config.epfCeiling);
            } else {
                // If Employee is Higher but Employer Regular, base is full, but split calculation handles the cap below
                J5_EPFWage = basePFWage;
            }
        }

        let K5_EPSWage = 0;
        // EPS Logic
        const isGlobalHigherContribBoth = config.enableHigherContribution && config.higherContributionType === 'By Employee & Employer';
        const isEmployerHigher = D5 === 'Higher' || isGlobalHigherContribBoth;
        
        // Employee must meet all these conditions for EPS wages to go above ceiling
        const isEligibleForHigherEPS = 
            employee.isEPSEligible === 'Yes' &&
            A5 === true &&
            C5 === 'Higher' &&
            isEmployerHigher &&
            E5 === true &&
            isPre2014;

        if (!A5 && isPost2014 && basePFWage > config.epfCeiling) {
            K5_EPSWage = 0; // No EPS for new members > 15k
        } else if (isEligibleForHigherEPS) {
            K5_EPSWage = J5_EPFWage; // EPS equals EPF wages
        } else {
            // Otherwise, cap EPS at Ceiling
            K5_EPSWage = Math.min(J5_EPFWage, config.epfCeiling);
        }

        // Employee Share Calculation
        // Use full basePFWage if Higher Contribution is enabled
        let eeBasis = basePFWage;

        epfEmployee = Math.round(eeBasis * config.epfEmployeeRate);

        if (employee.employeeVPFRate > 0) {
            vpfEmployee = Math.round(eeBasis * (employee.employeeVPFRate / 100));
        }

        // Employer Share Calculation
        if (!E5) {
            if (K5_EPSWage === 0) epsEmployer = 0;
            else {
                const basis = Math.min(basePFWage, config.epfCeiling);
                epsEmployer = Math.round(basis * 0.0833);
            }
        } else {
            epsEmployer = Math.round(K5_EPSWage * 0.0833);
        }

        if (K5_EPSWage === 0) {
            epfEmployer = Math.round(J5_EPFWage * config.epfEmployerRate);
        } else if (D5 === 'Higher' || (config.enableHigherContribution && config.higherContributionType === 'By Employee & Employer')) {
            const totalLiability = Math.round(J5_EPFWage * config.epfEmployerRate);
            epfEmployer = totalLiability - epsEmployer;
        } else {
            const totalLiability = Math.round(K5_EPSWage * config.epfEmployerRate);
            epfEmployer = totalLiability - epsEmployer;
        }

        // If employee is 60+ OR (58-60 and WithoutEPS opted) OR NOT EPS Eligible, then EPS = 0 and entire Employer share goes to EPF
        const isWithoutEPS = isAge60OrAbove || (isAge58To60 && employee.deferredPensionOption === 'WithoutEPS') || employee.isEPSEligible === 'No';
        if (isWithoutEPS) {
            const totalER = epfEmployer + epsEmployer;
            epfEmployer = totalER;
            epsEmployer = 0;
        }
    } else {
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
    let esiRemark = exitRemark || baseESIRemark || '';

    if (config.enableESI !== false && !employee.isESIExempt) {
        const esiWageBase = esiStandardBasisWage;

        if (config.pfEsiCalculationBasis === 'LabourCode' && wageD > 0) {
            isESICodeWagesUsed = true;
        }

        if (baseESIRemark === 'IP is out of coverage (Salary > Ceiling)') {
            esiEmployee = 0;
            esiEmployer = 0;
            isESICodeWagesUsed = false;
        } else {
            esiEmployee = Math.round(esiWageBase * config.esiEmployeeRate);
            esiEmployer = Math.round(esiWageBase * config.esiEmployerRate);
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

    // --- FINE / DAMAGES & TAX ---
    const fineRecord = fines.find(f => f.employeeId === employee.id && f.month === month && f.year === year);
    const rawAmount = fineRecord && fineRecord.amount !== undefined && fineRecord.amount !== null ? Number(fineRecord.amount) : 0;
    const fineAmount = isNaN(rawAmount) ? 0 : rawAmount;
    const fineReason = fineRecord ? (fineRecord.reason || '') : '';
    const rawTax = fineRecord && fineRecord.tax !== undefined && fineRecord.tax !== null ? Number(fineRecord.tax) : undefined;
    const manualTax = rawTax !== undefined && !isNaN(rawTax) ? rawTax : undefined;

    // --- Income Tax (TDS) Logic ---
    let incomeTax = 0;

    const itMode = config.incomeTaxCalculationType || 'Manual';
    if (itMode === 'Manual') {
        incomeTax = manualTax || 0;
    } else {
        if (manualTax !== undefined && manualTax > 0) {
            incomeTax = manualTax;
        } else {
            // Auto Calculation Logic (Simplified)
            const annualTaxable = (grossEarnings * 12) - 50000;
            if (annualTaxable > 700000) {
                incomeTax = Math.round(((annualTaxable - 700000) * 0.1) / 12);
            } else {
                incomeTax = 0;
            }
        }
    }

    // --- ADVANCE RECOVERY Logic (Code on Wages 2020) ---
    const statutoryDeductions = epfEmployee + vpfEmployee + esiEmployee + pt + incomeTax + lwfEmployee;

    // Calculate distributable wages for 50% check
    const codeGrossWages = Math.max(0, grossEarnings - statutoryDeductions);

    // advance.recovery is already bounded to totalBalance (opening + newAdvance) when computed in LedgerManager.
    // advance.balance is the POST-recovery remaining — do NOT use it as a cap here.
    let targetRecovery = advance.recovery ?? 0;
    let advanceRecovery = targetRecovery;

    // 1. Restrict to 50% Rule if Configured (Labour Code 2020)
    if (advanceOptions.restrictTo50Percent) {
        const limit50 = Math.round(codeGrossWages * 0.5);
        const availableForNonStatutory = limit50;
        const remainingForAdvance = Math.max(0, availableForNonStatutory - fineAmount);

        advanceRecovery = Math.min(targetRecovery, remainingForAdvance);
    }

    // 2. ABSOLUTE Restriction: No Negative Wages
    if (fineAmount > codeGrossWages) {
        advanceRecovery = 0;
    } else {
        const remainingForAdvance = codeGrossWages - fineAmount;
        if (advanceRecovery > remainingForAdvance) {
            advanceRecovery = remainingForAdvance;
            esiRemark += (esiRemark ? '. ' : '') + "Advance recovery restricted to prevent negative Net Pay";
        }
    }

    const totalDeductions = statutoryDeductions + fineAmount + advanceRecovery;

        let gratuityBasisWage = codeWage;
        if (config.pfEsiCalculationBasis === 'OriginalWages') {
            gratuityBasisWage = getComponentBasedWage(employee, config.gratuityWagesComponents, factor);
        }

        return {
            employeeId: employee.id,
            month,
            year,
            daysInMonth,
            payableDays: effectivePayableDays,
            earnings: {
                basic, da, retainingAllowance: retaining, hra, conveyance, washing, attire,
                special1, special2, special3, bonus, leaveEncashment, 
                otAmount: otRecord?.otAmount || 0,
                arrears: arrearAmount,
                total: grossEarnings + (otRecord?.otAmount || 0) + arrearAmount
            },
            deductions: {
                epf: epfEmployee, vpf: vpfEmployee, esi: esiEmployee, pt, it: incomeTax, lwf: lwfEmployee,
                advanceRecovery, fine: fineAmount, total: totalDeductions
            },
            employerContributions: { epf: epfEmployer, eps: epsEmployer, esi: esiEmployer, lwf: lwfEmployer },
            gratuityAccrual: config.enableGratuity !== false ? Math.round(((gratuityBasisWage) * 15 / 26) / 12) : 0,
        netPay: (grossEarnings + (otRecord?.otAmount || 0) + arrearAmount) - totalDeductions,
        isProportionatePFCapped,
        isCode88,
        isESICodeWagesUsed,
        esiRemark: esiRemark,
        fineReason: fineReason,
        leaveSnapshot: leaveSnapshot
    };
};
