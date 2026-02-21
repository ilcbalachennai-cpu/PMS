
import { Employee, StatutoryConfig, PayrollResult, Attendance, LeaveLedger, AdvanceLedger, FineRecord } from '../types';
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
    year: number,
    advanceOptions: { restrictTo50Percent: boolean } = { restrictTo50Percent: false },
    fines: FineRecord[] = [] // New parameter for Fines
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
    let isLeftService = false;
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
            isLeftService = true;
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

    if (effectivePayableDays <= 0) {
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
            deductions: { epf: 0, vpf: 0, esi: 0, pt: 0, it: 0, lwf: 0, advanceRecovery: 0, fine: 0, total: 0 },
            employerContributions: { epf: 0, eps: 0, esi: 0, lwf: 0 },
            gratuityAccrual: 0,
            netPay: 0,
            isCode88: false,
            isESICodeWagesUsed: false,
            esiRemark: exitRemark || 'No Payable Days',
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

    const bonus = 0;
    const encashedDays = attendance.encashedDays || 0;

    let leaveWageBase = 0;
    const lwComponents = config.leaveWagesComponents || { basic: true, da: true, retaining: false, hra: false, conveyance: false, washing: false, attire: false, special1: false, special2: false, special3: false };

    if (lwComponents.basic) leaveWageBase += employee.basicPay;
    if (lwComponents.da) leaveWageBase += (employee.da || 0);
    if (lwComponents.retaining) leaveWageBase += (employee.retainingAllowance || 0);
    if (lwComponents.hra) leaveWageBase += (employee.hra || 0);
    if (lwComponents.conveyance) leaveWageBase += (employee.conveyance || 0);
    if (lwComponents.washing) leaveWageBase += (employee.washing || 0);
    if (lwComponents.attire) leaveWageBase += (employee.attire || 0);
    if (lwComponents.special1) leaveWageBase += (employee.specialAllowance1 || 0);
    if (lwComponents.special2) leaveWageBase += (employee.specialAllowance2 || 0);
    if (lwComponents.special3) leaveWageBase += (employee.specialAllowance3 || 0);

    const leaveEncashment = Math.round((leaveWageBase / daysInMonth) * encashedDays);

    const grossEarnings = basic + da + retaining + hra + conveyance + washing + attire + special1 + special2 + special3 + bonus + leaveEncashment;

    const standardMonthlyGross = employee.basicPay + (employee.da || 0) + (employee.retainingAllowance || 0) + (employee.hra || 0) + (employee.conveyance || 0) + (employee.washing || 0) + (employee.attire || 0) + (employee.specialAllowance1 || 0) + (employee.specialAllowance2 || 0) + (employee.specialAllowance3 || 0);

    // --- PF Calculation Logic ---

    // 1. Calculate Prorated Ceiling (As per Example 3: 15000/30 * days)
    const proratedCeiling = Math.round((config.epfCeiling / daysInMonth) * effectivePayableDays);

    // 2. Calculate Code Wages (As per Code on Wages 2020)
    // Clause 88: If Exclusions > 50% of Gross, excess is added to Wages.
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
    let isCode88 = wageD > 0;

    // 3. Determine Final PF Wage based on Configuration & Examples
    let basePFWage = 0;

    const isHigherContribApplicable = config.enableHigherContribution;

    if (isHigherContribApplicable) {
        // Logic for "Higher Contribution = Yes" (Examples 2, 4, 6, 8)
        // If Higher Contribution is enabled, we use the sum of configured components (Actual Wage),
        // effectively treating it as "Higher Wages" opted.

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

        higherWageBase = Math.round(higherWageBase);

        // As per Example 6: "Higher Wages (Higher wages even though the code wages is above (a))"
        // This implies we stick to the Actual Wage (Higher Base) even if Code Wage is higher, 
        // provided we are in "Higher Contribution" mode which assumes paying on actuals.
        // And as per Ex 2, 4, 8: We pay on Actuals if > Ceiling.

        basePFWage = higherWageBase;

        // Override isCode88 flag because we are manually forcing the wage base
        isCode88 = false;

    } else {
        // Logic for "Higher Contribution = No" (Examples 1, 3, 5, 7)
        // Rule: Wage is capped at Prorated Ceiling.
        // Exception: If Code Wage is lower than Ceiling, use Code Wage.

        // Ex 1, 3, 5: Code Wage or Actual Wage > Ceiling -> Result: Ceiling.
        // Ex 7: Actual Wage < Code Wage < Ceiling -> Result: Code Wage.

        basePFWage = Math.min(codeWage, proratedCeiling);
    }

    let epfEmployee = 0;
    let vpfEmployee = 0;
    let epfEmployer = 0;
    let epsEmployer = 0;

    const isOptOut = employee.isDeferredPension && employee.deferredPensionOption === 'OptOut';

    if (!employee.isPFExempt && !isOptOut) {
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
        if (A5 && C5 === 'Higher' && D5 === 'Higher' && E5 && isPre2014) {
            K5_EPSWage = J5_EPFWage;
        } else if (!A5 && isPost2014 && basePFWage > config.epfCeiling) {
            K5_EPSWage = 0; // No EPS for new members > 15k
        } else {
            if (J5_EPFWage > config.epfCeiling) {
                // Cap EPS at Ceiling if not explicitly eligible for Higher EPS
                if (D5 === 'Regular') K5_EPSWage = config.epfCeiling;
                else if (!E5) K5_EPSWage = config.epfCeiling;
                else if (!A5) K5_EPSWage = config.epfCeiling;
                else K5_EPSWage = J5_EPFWage;
            } else {
                K5_EPSWage = J5_EPFWage;
            }
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
        // ESI Wage Base according to Code on Wages (Clause 88): Wage A + Wage D
        const esiWageBase = Math.round(wageA + wageD);

        if (wageD > 0) {
            isESICodeWagesUsed = true;
        }

        // Determine if Excluded from Coverage
        // Step 1: Check if Basic+DA+Retaining > ESI Ceiling
        // Step 2: Otherwise Check if Code Wages (esiWageBase) > ESI Ceiling
        let isAboveCeiling = false;

        if (wageA > config.esiCeiling) {
            isAboveCeiling = true;
        } else if (esiWageBase > config.esiCeiling) {
            isAboveCeiling = true;
        }

        if (isAboveCeiling) {
            // Under both steps check if Employee is going out of coverage
            const isStartOfPeriod = month === 'April' || month === 'October';

            const periodStart = new Date(year, monthIdx, 1);
            periodStart.setHours(0, 0, 0, 0);

            const empDOJ = new Date(employee.doj);
            empDOJ.setHours(0, 0, 0, 0);
            const isNewJoinee = empDOJ >= periodStart;

            if (isStartOfPeriod || isNewJoinee) {
                esiEmployee = 0;
                esiEmployer = 0;
                esiRemark = 'IP is out of coverage (Salary > Ceiling)';
                isESICodeWagesUsed = false;
            } else {
                // Continued Coverage
                esiEmployee = Math.ceil(esiWageBase * config.esiEmployeeRate);
                esiEmployer = Math.ceil(esiWageBase * config.esiEmployerRate);
                esiRemark = 'Continued Coverage (Mid-Period)';
            }
        } else {
            esiEmployee = Math.ceil(esiWageBase * config.esiEmployeeRate);
            esiEmployer = Math.ceil(esiWageBase * config.esiEmployerRate);
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
    const fineAmount = fineRecord ? (fineRecord.amount || 0) : 0;
    const fineReason = fineRecord ? (fineRecord.reason || '') : '';
    const manualTax = fineRecord ? fineRecord.tax : undefined;

    // --- Income Tax (TDS) Logic ---
    let incomeTax = 0;

    if (config.incomeTaxCalculationType === 'Manual') {
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
        deductions: {
            epf: epfEmployee, vpf: vpfEmployee, esi: esiEmployee, pt, it: incomeTax, lwf: lwfEmployee,
            advanceRecovery, fine: fineAmount, total: totalDeductions
        },
        employerContributions: { epf: epfEmployer, eps: epsEmployer, esi: esiEmployer, lwf: lwfEmployer },
        gratuityAccrual: Math.round(((basic + da) * 15 / 26) / 12),
        netPay: grossEarnings - totalDeductions,
        isCode88,
        isESICodeWagesUsed,
        esiRemark: esiRemark,
        fineReason: fineReason,
        leaveSnapshot: leaveSnapshot
    };
};
