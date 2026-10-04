import * as XLSX from 'xlsx-js-style';
import { PayrollResult, Employee, StatutoryConfig, CompanyProfile, ConfigChangeLog } from '../types';
import { generateExcelWorkbook, getStandardFileName } from './reportService';

export interface ECRAuditRow {
  empId: string;
  uan: string;
  name: string;
  prevEPFWage: number;
  currEPFWage: number;
  prevEPSWage: number;
  currEPSWage: number;
  prevEDLIWage: number;
  currEDLIWage: number;
  prevEEPF: number;
  currEEPF: number;
  prevEREPS: number;
  currEREPS: number;
  prevEREPF: number;
  currEREPF: number;
  prevEDLI: number;
  currEDLI: number;
  prevTotalContrib: number;
  currTotalContrib: number;
  prevNCPDays: number;
  currNCPDays: number;
  status: 'Normal' | 'EPS_DROPPED_ZERO' | 'NEW_MEMBER' | 'DROPPED_MEMBER' | 'VARIANCE_HIGH' | 'CONTRIB_CHANGED' | 'RESUMED_FROM_LOP' | 'ON_LOP';
  hasChange: boolean;
  alerts: string[];
  dol?: string;
  leavingReason?: string;
}

/**
 * Check if employee joined before the audit current period
 */
const isJoinedPriorToPeriod = (dojStr: string | undefined, periodStr: string): boolean => {
  if (!dojStr) return false;
  const parts = periodStr.trim().split(/\s+/);
  if (parts.length < 2) return false;
  const mName = parts[0];
  const yNum = parseInt(parts[1], 10);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const mIdx = months.indexOf(mName);
  if (mIdx === -1 || isNaN(yNum)) return false;

  let dojY = 0, dojM = 0;
  if (dojStr.includes('-')) {
    const dParts = dojStr.split('-');
    if (dParts[0].length === 4) {
      dojY = parseInt(dParts[0], 10);
      dojM = parseInt(dParts[1], 10) - 1;
    } else if (dParts[2]?.length === 4) {
      dojY = parseInt(dParts[2], 10);
      dojM = parseInt(dParts[1], 10) - 1;
    }
  }
  if (dojY === 0) return false;
  const periodVal = yNum * 12 + mIdx;
  const dojVal = dojY * 12 + dojM;
  return dojVal < periodVal;
};

export interface EPFVarianceItem {
  empId: string;
  name: string;
  uan: string;
  prevEPF: number;      // prevEEPF + prevEREPF
  currEPF: number;      // currEEPF + currEREPF
  diff: number;         // currEPF - prevEPF
  percent: number;      // percentage change
  prevWage: number;
  currWage: number;
  prevNCP: number;
  currNCP: number;
  prevEEPF: number;
  currEEPF: number;
  prevEREPF: number;
  currEREPF: number;
  status: string;
  reason: string;
}

export interface TotalContribDropItem {
  empId: string;
  name: string;
  uan: string;
  prevTotal: number;
  currTotal: number;
  diff: number;
  percent: number;
  reason: string;
}

export interface ECRAuditSummary {
  prevPeriod: string;
  currPeriod: string;

  // 1. Employee Count
  prevMembers: number;
  currMembers: number;
  memberDiff: number;
  memberPercent: number;

  // 2. Total Contribution (EE + ER EPF + ER EPS + EDLI)
  prevTotalContrib: number;
  currTotalContrib: number;
  totalContribDiff: number;
  totalContribPercent: number;

  // 3. Total EPF (EE PF + ER EPF)
  prevTotalEPF: number;
  currTotalEPF: number;
  totalEPFDiff: number;
  totalEPFPercent: number;

  // Individual EPF components
  prevEEPF: number;
  currEEPF: number;
  eePFDiff: number;
  eePFPercent: number;

  prevEREPF: number;
  currEREPF: number;
  erEPFDiff: number;
  erEPFPercent: number;

  // 4. Total EPS (A/c 10)
  prevEREPS: number;
  currEREPS: number;
  erEPSDiff: number;
  erEPSPercent: number;

  // 5. Total EDLI (A/c 21)
  prevEDLI: number;
  currEDLI: number;
  edliDiff: number;
  edliPercent: number;

  // Categorized alerts
  zeroEPSAlerts: ECRAuditRow[];
  highVarianceAlerts: ECRAuditRow[];
  newMembers: ECRAuditRow[];
  droppedMembers: ECRAuditRow[];
  changedMembers: ECRAuditRow[];
  epfVarianceBreakup: EPFVarianceItem[];
  epsDropBreakup: EPFVarianceItem[];
  totalContribDropBreakup: TotalContribDropItem[];
  rows: ECRAuditRow[];
}

export interface ESIAuditRow {
  empId: string;
  esiNo: string;
  name: string;
  prevWage: number;
  currWage: number;
  prevIP: number;
  currIP: number;
  prevER: number;
  currER: number;
  prevDays: number;
  currDays: number;
  status: 'Normal' | 'CROSSED_CEILING' | 'DROPPED_INTO_COVERAGE' | 'ZERO_CONTRIB' | 'NEW_IP' | 'DROPPED_IP' | 'CONTRIB_CHANGED';
  hasChange: boolean;
  alerts: string[];
  dol?: string;
  leavingReason?: string;
}

export interface ESIAuditSummary {
  prevPeriod: string;
  currPeriod: string;
  prevMembers: number;
  currMembers: number;
  memberDiff: number;
  prevIP: number;
  currIP: number;
  ipDiff: number;
  ipPercent: number;
  prevER: number;
  currER: number;
  erDiff: number;
  erPercent: number;
  ceilingCrossingAlerts: ESIAuditRow[];
  zeroContribAlerts: ESIAuditRow[];
  newIPs: ESIAuditRow[];
  droppedIPs: ESIAuditRow[];
  changedIPs: ESIAuditRow[];
  rows: ESIAuditRow[];
}

export interface PayAuditRow {
  empId: string;
  name: string;
  designation: string;
  prevGross: number;
  currGross: number;
  grossDiff: number;
  grossPercent: number;
  prevNet: number;
  currNet: number;
  netDiff: number;
  prevBasic: number;
  currBasic: number;
  basicDiff: number;
  prevDays: number;
  currDays: number;
  status: 'Normal' | 'HIGH_VARIANCE' | 'NEW_JOINER' | 'EXITED' | 'ZERO_BASIC' | 'PAY_CHANGED';
  hasChange: boolean;
  alerts: string[];
  dol?: string;
  leavingReason?: string;
}

export interface PayAuditSummary {
  prevPeriod: string;
  currPeriod: string;
  prevHeadcount: number;
  currHeadcount: number;
  headcountDiff: number;
  prevGross: number;
  currGross: number;
  grossDiff: number;
  grossPercent: number;
  prevNet: number;
  currNet: number;
  netDiff: number;
  netPercent: number;
  highVarianceAlerts: PayAuditRow[];
  zeroBasicAlerts: PayAuditRow[];
  newJoiners: PayAuditRow[];
  exitedEmployees: PayAuditRow[];
  changedPayEmployees: PayAuditRow[];
  rows: PayAuditRow[];
}

/**
 * Helper to compute single employee ECR figures directly from processed PayrollResult
 */
const computeECRFigures = (r: PayrollResult | undefined, emp: Employee | undefined, config?: StatutoryConfig) => {
  if (!r) {
    return {
      grossWages: 0,
      epfWages: 0,
      epsWages: 0,
      edliWages: 0,
      eeEPF: 0,
      erEPS: 0,
      erEPF: 0,
      edliContrib: 0,
      totalContrib: 0,
      ncpDays: 0,
      isNonContributing: true
    };
  }

  const daysInMonth = r.daysInMonth || 30;
  const ncpDays = Math.max(0, daysInMonth - Math.round(r.payableDays || 0));

  const isOnLOP = (emp?.leavingReason || '').trim().toUpperCase() === 'ON LOP';
  if (isOnLOP) {
    return {
      grossWages: 0,
      epfWages: 0,
      epsWages: 0,
      edliWages: 0,
      eeEPF: 0,
      erEPS: 0,
      erEPF: 0,
      edliContrib: 0,
      totalContrib: 0,
      ncpDays: daysInMonth,
      isNonContributing: true
    };
  }

  const grossWages = Math.round(r.earnings?.total || 0);
  const baseEE = Math.round(r.deductions?.epf || 0);
  const vpfEE = Math.round(r.deductions?.vpf || 0);
  const eeEPF = baseEE + vpfEE;

  const isFrozen = (r.status === 'Finalized');

  // EPF Wages: In frozen records, strictly respect the frozen epfWage; fallback only if missing
  const epfWagesRaw = baseEE > 0 ? Math.round(baseEE / 0.12) : 0;
  const epfWages = (r.epfWage !== undefined && r.epfWage > 0)
    ? r.epfWage
    : Math.min(epfWagesRaw, grossWages > 0 ? grossWages : epfWagesRaw);

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const mIdx = r.month ? MONTHS.indexOf(r.month) : -1;
  const isSep2026Transition = (r.month === 'September' && r.year === 2026);
  const isFromSep2026 = (r.year > 2026 || (r.year === 2026 && mIdx >= 8));

  // EDLI Wages: If data is frozen (Finalized), Audit Trail must STRICTLY use the frozen r.edliWage!
  // Only for Draft records or legacy uncalculated records, compute based on transition/statutory rules.
  let edliWages = 0;
  if (baseEE > 0) {
    if (isFrozen && r.edliWage !== undefined && r.edliWage > 0) {
      edliWages = r.edliWage;
    } else if (r.edliWage !== undefined && r.edliWage > 0 && !isSep2026Transition && !isFromSep2026) {
      edliWages = r.edliWage;
    } else {
      const isScenarioA = emp?.epfEnrolmentStatus === 'EnrolledFrom17Sep2026' ||
        emp?.epfMembershipDate === '2026-09-17' || emp?.epfMembershipDate === '17-09-2026';

      if (isSep2026Transition) {
        const sepEDLICap = isScenarioA
          ? Math.min(11667, epfWages)
          : (epfWages > 15000
              ? 15000 + Math.round(((Math.min(25000, epfWages) - 15000) * 14) / 30)
              : epfWages);
        edliWages = Math.min(sepEDLICap, epfWages, grossWages > 0 ? grossWages : sepEDLICap);
      } else {
        const maxEDLICeiling = isFromSep2026 ? Number(config?.epfCeiling2 || 25000) : Number(config?.epfCeiling1 || 15000);
        edliWages = Math.min(maxEDLICeiling, epfWages, grossWages > 0 ? grossWages : maxEDLICeiling);
      }
    }
  }
  const edliContrib = (isFrozen && r.edliCharges !== undefined)
    ? Math.round(r.edliCharges)
    : Math.round(edliWages * 0.005);

  // Employer contributions: Primary source is the actual stored record in PayrollResult
  let erEPS = 0;
  let erEPF = 0;

  if (r.employerContributions && (r.employerContributions.eps !== undefined || r.employerContributions.epf !== undefined)) {
    erEPS = Math.round(r.employerContributions.eps || 0);
    erEPF = Math.round(r.employerContributions.epf || 0);
  } else {
    // Fallback only if employerContributions object was missing from historical record
    const isNonContributing = (emp && emp.isPFExempt) || r.payableDays === 0;
    const isEPSEligible = emp ? (emp.isEPSEligible !== 'No') : true;
    const isHigherPension = emp?.pfHigherPension?.isHigherPensionOpted === 'Yes';
    let fallbackEPSWage = 0;
    if (!isNonContributing && isEPSEligible) {
      if (isHigherPension) {
        fallbackEPSWage = epfWages;
      } else if (isSep2026Transition) {
        fallbackEPSWage = Math.min(19667, epfWages);
      } else {
        fallbackEPSWage = Math.min(isFromSep2026 ? 25000 : 15000, epfWages);
      }
    }
    erEPS = (!isNonContributing && isEPSEligible) ? Math.round(fallbackEPSWage * 0.0833) : 0;
    erEPF = isNonContributing ? 0 : Math.max(0, baseEE - erEPS);
  }

  // EPS Wages: If data is frozen (Finalized), Audit Trail must STRICTLY use the frozen r.epsWage!
  let epsWages = 0;
  if (erEPS > 0) {
    if (isFrozen && r.epsWage !== undefined && r.epsWage > 0) {
      epsWages = r.epsWage;
    } else {
      const isHigherPension = emp?.pfHigherPension?.isHigherPensionOpted === 'Yes';
      if (isHigherPension) {
        epsWages = epfWages;
      } else if (erEPS === 1638) {
        epsWages = 19667;
      } else if (r.epsWage !== undefined && r.epsWage > 0) {
        epsWages = r.epsWage;
      } else if (isSep2026Transition) {
        epsWages = Math.min(19667, epfWages);
      } else if (isFromSep2026) {
        const maxEPSC = Number(config?.epfCeiling2 || 25000);
        epsWages = Math.min(maxEPSC, epfWages);
      } else {
        const maxEPSC = Number(config?.epfCeiling1 || 15000);
        epsWages = Math.min(maxEPSC, epfWages);
      }
    }
  }

  // Total PF / ECR deposit for this member: EE (A/c 1) + ER EPF (A/c 1) + ER EPS (A/c 10) + EDLI (A/c 21)
  const totalContrib = eeEPF + erEPF + erEPS + edliContrib;
  const isNonContributing = eeEPF === 0 && erEPF === 0 && erEPS === 0;

  return {
    grossWages,
    epfWages,
    epsWages,
    edliWages,
    eeEPF,
    erEPS,
    erEPF,
    edliContrib,
    totalContrib,
    ncpDays,
    isNonContributing
  };
};

/**
 * 1. Calculate ECR Month-over-Month Audit
 */
export const calculateECRAudit = (
  currResults: PayrollResult[],
  prevResults: PayrollResult[],
  employees: Employee[],
  currPeriod: string,
  prevPeriod: string,
  config?: StatutoryConfig
): ECRAuditSummary => {
  const allEmpIds = Array.from(new Set([
    ...currResults.map(r => r.employeeId),
    ...prevResults.map(r => r.employeeId)
  ]));

  const rows: ECRAuditRow[] = [];

  let prevEEPF = 0;
  let currEEPF = 0;
  let prevEREPS = 0;
  let currEREPS = 0;
  let prevEREPF = 0;
  let currEREPF = 0;
  let prevEDLI = 0;
  let currEDLI = 0;
  let prevTotalContrib = 0;
  let currTotalContrib = 0;

  let prevContributors = 0;
  let currContributors = 0;

  for (const empId of allEmpIds) {
    const emp = employees.find(e => e.id === empId);
    const currR = currResults.find(r => r.employeeId === empId);
    const prevR = prevResults.find(r => r.employeeId === empId);

    if (!emp) continue;

    const currFig = computeECRFigures(currR, emp, config);
    const prevFig = computeECRFigures(prevR, emp, config);

    const isPrevActive = prevFig.eeEPF > 0 || prevFig.erEPS > 0 || prevFig.erEPF > 0;
    const isCurrActive = currFig.eeEPF > 0 || currFig.erEPS > 0 || currFig.erEPF > 0;

    if (isPrevActive) prevContributors++;
    if (isCurrActive) currContributors++;

    prevEEPF += prevFig.eeEPF;
    currEEPF += currFig.eeEPF;
    prevEREPS += prevFig.erEPS;
    currEREPS += currFig.erEPS;
    prevEREPF += prevFig.erEPF;
    currEREPF += currFig.erEPF;
    prevEDLI += prevFig.edliContrib;
    currEDLI += currFig.edliContrib;
    prevTotalContrib += prevFig.totalContrib;
    currTotalContrib += currFig.totalContrib;

    // FILTER OUT EMPLOYEES WITH NO EPF / ECR IMPACT:
    // If an employee has NO EPF/EPS contribution in both previous and current periods
    // (e.g. PF Exempt Section 7.A or non-covered staff in both months),
    // they have no impact on the ECR audit and must not be included.
    const hasEPFImpact = isPrevActive || isCurrActive;
    if (!hasEPFImpact) {
      continue;
    }

    const alerts: string[] = [];
    let status: ECRAuditRow['status'] = 'Normal';

    // RULE 1: Employee X had EPF and EPS in previous month (July 2026),
    // and in current month (August 2026) EPF is present, however EPS = 0 -> CRITICAL ALERT
    const hadEPFInPrev = prevFig.eeEPF > 0 || prevFig.erEPF > 0;
    const hadEPSInPrev = prevFig.erEPS > 0;
    const hasEPFInCurr = currFig.eeEPF > 0 || currFig.erEPF > 0;
    const hasEPSInCurr = currFig.erEPS > 0;

    const effectiveDOL = emp.dol || (currR?.esiRemark?.startsWith('Left: ') ? currR.esiRemark.replace('Left: ', '').trim() : '');
    const leavingReason = emp.leavingReason || '';

    if (hadEPFInPrev && hadEPSInPrev && hasEPFInCurr && !hasEPSInCurr) {
      status = 'EPS_DROPPED_ZERO';
      alerts.push(
        `CRITICAL: Employee had EPF (₹${prevFig.eeEPF}) & EPS (₹${prevFig.erEPS}) in ${prevPeriod}, but in ${currPeriod} EPF is present (₹${currFig.eeEPF}) while EPS dropped to ₹0!`
      );
    } else if (!isPrevActive && isCurrActive) {
      const isPriorEmployee = isJoinedPriorToPeriod(emp.doj, currPeriod);
      const isLOPInPrev = prevR && (prevR.payableDays === 0 || prevFig.ncpDays > 0);

      if (isPriorEmployee && isLOPInPrev) {
        status = 'RESUMED_FROM_LOP';
        const prevDays = prevR?.payableDays || 0;
        const currDays = currR?.payableDays || 0;
        alerts.push(`Resumed from LOP in ${prevPeriod} (Payable Days: ${prevDays} ➔ ${currDays} • NCP: ${prevFig.ncpDays}d ➔ ${currFig.ncpDays}d)`);
      } else if (isPriorEmployee) {
        status = 'CONTRIB_CHANGED';
        alerts.push(`Existing employee (DOJ: ${emp.doj || '-'}) - Contributing in ${currPeriod}${prevR ? ' (Previously 0 EPF)' : ` (No record in ${prevPeriod})`}`);
      } else {
        status = 'NEW_MEMBER';
        const dojTag = emp.doj ? ` (DOJ: ${emp.doj})` : '';
        alerts.push(`New Joinee in ${currPeriod}${dojTag} (EPF: ₹${currFig.eeEPF}, EPS: ₹${currFig.erEPS})`);
      }
    } else if (isPrevActive && !isCurrActive) {
      if (effectiveDOL) {
        status = 'DROPPED_MEMBER';
        alerts.push(`Resigned on ${effectiveDOL}${leavingReason ? ` (${leavingReason})` : ''}: Contributed ₹${prevFig.totalContrib} in ${prevPeriod}, no contribution in ${currPeriod}`);
      } else if (currR && currR.payableDays === 0) {
        status = 'ON_LOP';
        const prevDays = prevR?.payableDays || 0;
        alerts.push(`On LOP in ${currPeriod} (Payable Days: ${prevDays} ➔ 0 • NCP: ${currFig.ncpDays}d)`);
      } else {
        status = 'DROPPED_MEMBER';
        alerts.push(`Dropped ECR member: Contributed ₹${prevFig.totalContrib} in ${prevPeriod}, no contribution in ${currPeriod}`);
      }
    } else if (isPrevActive && isCurrActive) {
      // RULE 2: Significant change in EPF or EPS between August 2026 and July 2026
      const epfDiff = currFig.eeEPF - prevFig.eeEPF;
      const epfPct = prevFig.eeEPF > 0 ? (epfDiff / prevFig.eeEPF) * 100 : 0;

      const epsDiff = currFig.erEPS - prevFig.erEPS;
      const epsPct = prevFig.erEPS > 0 ? (epsDiff / prevFig.erEPS) * 100 : 0;

      const isEPFSignificant = Math.abs(epfPct) >= 20 && Math.abs(epfDiff) >= 200;
      const isEPSSignificant = Math.abs(epsPct) >= 20 && Math.abs(epsDiff) >= 100;

      if (isEPFSignificant || isEPSSignificant) {
        status = 'VARIANCE_HIGH';
        if (isEPFSignificant) {
          alerts.push(`Significant EPF Shift: ${epfPct > 0 ? '+' : ''}${epfPct.toFixed(1)}% (₹${prevFig.eeEPF} ➔ ₹${currFig.eeEPF})`);
        }
        if (isEPSSignificant) {
          alerts.push(`Significant EPS Shift: ${epsPct > 0 ? '+' : ''}${epsPct.toFixed(1)}% (₹${prevFig.erEPS} ➔ ₹${currFig.erEPS})`);
        }
        if (currFig.totalContrib < prevFig.totalContrib && currFig.ncpDays > 0) {
          const ncpDiff = currFig.ncpDays - prevFig.ncpDays;
          alerts.push(`NCP Impact: ${currFig.ncpDays} Non-Contributing Days in ${currPeriod}${ncpDiff > 0 ? ` (+${ncpDiff} days absent/LOP)` : ''}`);
        }
      } else if (currFig.totalContrib !== prevFig.totalContrib || currFig.eeEPF !== prevFig.eeEPF || currFig.erEPS !== prevFig.erEPS || currFig.erEPF !== prevFig.erEPF) {
        status = 'CONTRIB_CHANGED';
        const totalDiff = currFig.totalContrib - prevFig.totalContrib;
        alerts.push(`Contribution Shift: ${totalDiff > 0 ? '+' : ''}₹${totalDiff} (₹${prevFig.totalContrib} ➔ ₹${currFig.totalContrib})`);
        if (currFig.ncpDays > 0 && currFig.totalContrib < prevFig.totalContrib) {
          alerts.push(`NCP: ${currFig.ncpDays} Days`);
        }
      }
    }

    const hasChange = currFig.totalContrib !== prevFig.totalContrib ||
      currFig.eeEPF !== prevFig.eeEPF ||
      currFig.erEPS !== prevFig.erEPS ||
      currFig.erEPF !== prevFig.erEPF ||
      currFig.epfWages !== prevFig.epfWages ||
      currFig.epsWages !== prevFig.epsWages ||
      currFig.edliWages !== prevFig.edliWages ||
      currFig.ncpDays !== prevFig.ncpDays ||
      status !== 'Normal' ||
      alerts.length > 0;

    rows.push({
      empId,
      uan: emp.uanc || '-',
      name: emp.name,
      prevEPFWage: prevFig.epfWages,
      currEPFWage: currFig.epfWages,
      prevEPSWage: prevFig.epsWages,
      currEPSWage: currFig.epsWages,
      prevEDLIWage: prevFig.edliWages,
      currEDLIWage: currFig.edliWages,
      prevEEPF: prevFig.eeEPF,
      currEEPF: currFig.eeEPF,
      prevEREPS: prevFig.erEPS,
      currEREPS: currFig.erEPS,
      prevEREPF: prevFig.erEPF,
      currEREPF: currFig.erEPF,
      prevEDLI: prevFig.edliContrib,
      currEDLI: currFig.edliContrib,
      prevTotalContrib: prevFig.totalContrib,
      currTotalContrib: currFig.totalContrib,
      prevNCPDays: prevFig.ncpDays,
      currNCPDays: currFig.ncpDays,
      status,
      hasChange,
      alerts,
      dol: effectiveDOL || undefined,
      leavingReason: leavingReason || undefined
    });
  }

  // Sort by EMP ID naturally (numeric-aware)
  rows.sort((a, b) => (a.empId || '').localeCompare(b.empId || '', undefined, { numeric: true, sensitivity: 'base' }));

  const memberDiff = currContributors - prevContributors;
  const memberPercent = prevContributors > 0 ? Math.round((memberDiff / prevContributors) * 100 * 10) / 10 : 0;

  const prevTotalEPF = prevEEPF + prevEREPF;
  const currTotalEPF = currEEPF + currEREPF;
  const totalEPFDiff = currTotalEPF - prevTotalEPF;
  const totalEPFPercent = prevTotalEPF > 0 ? Math.round((totalEPFDiff / prevTotalEPF) * 100 * 10) / 10 : 0;

  const eePFDiff = currEEPF - prevEEPF;
  const eePFPercent = prevEEPF > 0 ? Math.round((eePFDiff / prevEEPF) * 100 * 10) / 10 : 0;

  const erEPFDiff = currEREPF - prevEREPF;
  const erEPFPercent = prevEREPF > 0 ? Math.round((erEPFDiff / prevEREPF) * 100 * 10) / 10 : 0;

  const erEPSDiff = currEREPS - prevEREPS;
  const erEPSPercent = prevEREPS > 0 ? Math.round((erEPSDiff / prevEREPS) * 100 * 10) / 10 : 0;

  const edliDiff = currEDLI - prevEDLI;
  const edliPercent = prevEDLI > 0 ? Math.round((edliDiff / prevEDLI) * 100 * 10) / 10 : 0;

  const totalContribDiff = currTotalContrib - prevTotalContrib;
  const totalContribPercent = prevTotalContrib > 0 ? Math.round((totalContribDiff / prevTotalContrib) * 100 * 10) / 10 : 0;

  // 1. Calculate EPF Variance Breakup (employees whose Total EPF [EE + ER] shifted)
  const epfVarianceBreakup: EPFVarianceItem[] = rows
    .map(r => {
      const prevEmpEPF = r.prevEEPF + r.prevEREPF;
      const currEmpEPF = r.currEEPF + r.currEREPF;
      const diff = currEmpEPF - prevEmpEPF;
      if (diff === 0) return null;

      const percent = prevEmpEPF > 0 
        ? Math.round((diff / prevEmpEPF) * 100 * 10) / 10 
        : (currEmpEPF > 0 ? 100 : 0);

      // Deduce intuitive human-readable reason
      let reason = '';
      const empObj = employees.find(e => e.id === r.empId);
      const pRec = prevResults.find(x => x.employeeId === r.empId);
      const cRec = currResults.find(x => x.employeeId === r.empId);

      if (r.status === 'NEW_MEMBER') {
        const dojTag = empObj?.doj ? ` (DOJ: ${empObj.doj})` : '';
        reason = `New Joinee in ${currPeriod}${dojTag} (EPF Wage: ₹${r.currEPFWage.toLocaleString()})`;
      } else if (r.status === 'RESUMED_FROM_LOP') {
        const prevDays = pRec?.payableDays ?? 0;
        const currDays = cRec?.payableDays ?? 0;
        reason = `Resumed from LOP in ${prevPeriod} (Payable Days: ${prevDays} ➔ ${currDays} • NCP: ${r.prevNCPDays}d ➔ ${r.currNCPDays}d)`;
      } else if (r.status === 'ON_LOP') {
        const prevDays = pRec?.payableDays ?? 0;
        reason = `On LOP in ${currPeriod} (Payable Days: ${prevDays} ➔ 0 • NCP: ${r.currNCPDays}d)`;
      } else if (r.status === 'DROPPED_MEMBER') {
        reason = r.dol 
          ? `Resigned on ${r.dol}${r.leavingReason ? ` (${r.leavingReason})` : ''}` 
          : `Exited / Dropped in ${currPeriod} (No contribution)`;
      } else {
        const parts: string[] = [];
        if (r.currEPFWage !== r.prevEPFWage) {
          const wDiff = r.currEPFWage - r.prevEPFWage;
          const wPct = r.prevEPFWage > 0 ? Math.round((wDiff / r.prevEPFWage) * 100) : 0;
          parts.push(`Wage: ₹${r.prevEPFWage.toLocaleString()} ➔ ₹${r.currEPFWage.toLocaleString()} (${wDiff > 0 ? '+' : ''}${wPct}%)`);
        }
        if (r.currNCPDays !== r.prevNCPDays) {
          const ncpDiff = r.currNCPDays - r.prevNCPDays;
          parts.push(`NCP / LOP: ${r.currNCPDays}d (${ncpDiff > 0 ? `+${ncpDiff}d LOP` : `${ncpDiff}d`})`);
        }
        if (parts.length > 0) {
          reason = parts.join(' • ');
        } else if (r.alerts.length > 0) {
          reason = r.alerts[0];
        } else {
          reason = `EE PF: ₹${r.prevEEPF.toLocaleString()} ➔ ₹${r.currEEPF.toLocaleString()}, ER EPF: ₹${r.prevEREPF.toLocaleString()} ➔ ₹${r.currEREPF.toLocaleString()}`;
        }
      }

      return {
        empId: r.empId,
        name: r.name,
        uan: r.uan,
        prevEPF: prevEmpEPF,
        currEPF: currEmpEPF,
        diff,
        percent,
        prevWage: r.prevEPFWage,
        currWage: r.currEPFWage,
        prevNCP: r.prevNCPDays,
        currNCP: r.currNCPDays,
        prevEEPF: r.prevEEPF,
        currEEPF: r.currEEPF,
        prevEREPF: r.prevEREPF,
        currEREPF: r.currEREPF,
        status: r.status,
        reason
      };
    })
    .filter(Boolean) as EPFVarianceItem[];

  // Sort by largest absolute variance descending
  epfVarianceBreakup.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  // 2. Calculate EPS Drop Breakup (employees whose EPS decreased)
  const epsDropBreakup: EPFVarianceItem[] = rows
    .filter(r => r.prevEREPS > r.currEREPS)
    .map(r => {
      const diff = r.currEREPS - r.prevEREPS;
      const percent = r.prevEREPS > 0 
        ? Math.round((diff / r.prevEREPS) * 100 * 10) / 10 
        : 0;

      let reason = '';
      if (r.status === 'EPS_DROPPED_ZERO') {
        reason = `EPS dropped to ₹0 (Previous EPS: ₹${r.prevEREPS.toLocaleString()})`;
      } else if (r.status === 'DROPPED_MEMBER') {
        reason = r.dol ? `Resigned on ${r.dol}${r.leavingReason ? ` (${r.leavingReason})` : ''}` : `Exited member`;
      } else if (r.currNCPDays > r.prevNCPDays) {
        reason = `${r.currNCPDays} NCP/LOP Days (+${r.currNCPDays - r.prevNCPDays}d vs prev)`;
      } else if (r.currEPSWage < r.prevEPSWage) {
        reason = `EPS Wage dropped: ₹${r.prevEPSWage.toLocaleString()} ➔ ₹${r.currEPSWage.toLocaleString()}`;
      } else {
        reason = `EPS: ₹${r.prevEREPS.toLocaleString()} ➔ ₹${r.currEREPS.toLocaleString()}`;
      }

      return {
        empId: r.empId,
        name: r.name,
        uan: r.uan,
        prevEPF: r.prevEREPS,
        currEPF: r.currEREPS,
        diff,
        percent,
        prevWage: r.prevEPSWage,
        currWage: r.currEPSWage,
        prevNCP: r.prevNCPDays,
        currNCP: r.currNCPDays,
        prevEEPF: r.prevEEPF,
        currEEPF: r.currEEPF,
        prevEREPF: r.prevEREPF,
        currEREPF: r.currEREPF,
        status: r.status,
        reason
      };
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  // 3. Calculate Total Contribution Drop Breakup (employees whose total contribution dropped)
  const totalContribDropBreakup: TotalContribDropItem[] = rows
    .filter(r => r.prevTotalContrib > r.currTotalContrib)
    .map(r => {
      const diff = r.currTotalContrib - r.prevTotalContrib;
      const percent = r.prevTotalContrib > 0 
        ? Math.round((diff / r.prevTotalContrib) * 100 * 10) / 10 
        : 0;

      let reason = '';
      if (r.status === 'DROPPED_MEMBER') {
        reason = r.dol ? `Resigned on ${r.dol}${r.leavingReason ? ` (${r.leavingReason})` : ''}` : `Exited member`;
      } else if (r.currNCPDays > r.prevNCPDays) {
        reason = `${r.currNCPDays} NCP/LOP Days (+${r.currNCPDays - r.prevNCPDays}d vs prev)`;
      } else if (r.currEPFWage < r.prevEPFWage) {
        reason = `Wage dropped: ₹${r.prevEPFWage.toLocaleString()} ➔ ₹${r.currEPFWage.toLocaleString()}`;
      } else {
        reason = `Contribution: ₹${r.prevTotalContrib.toLocaleString()} ➔ ₹${r.currTotalContrib.toLocaleString()}`;
      }

      return {
        empId: r.empId,
        name: r.name,
        uan: r.uan,
        prevTotal: r.prevTotalContrib,
        currTotal: r.currTotalContrib,
        diff,
        percent,
        reason
      };
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return {
    prevPeriod,
    currPeriod,
    prevMembers: prevContributors,
    currMembers: currContributors,
    memberDiff,
    memberPercent,
    prevTotalContrib,
    currTotalContrib,
    totalContribDiff,
    totalContribPercent,
    prevTotalEPF,
    currTotalEPF,
    totalEPFDiff,
    totalEPFPercent,
    prevEEPF,
    currEEPF,
    eePFDiff,
    eePFPercent,
    prevEREPF,
    currEREPF,
    erEPFDiff,
    erEPFPercent,
    prevEREPS,
    currEREPS,
    erEPSDiff,
    erEPSPercent,
    prevEDLI,
    currEDLI,
    edliDiff,
    edliPercent,
    zeroEPSAlerts: rows.filter(r => r.status === 'EPS_DROPPED_ZERO'),
    highVarianceAlerts: rows.filter(r => r.status === 'VARIANCE_HIGH'),
    newMembers: rows.filter(r => r.status === 'NEW_MEMBER'),
    droppedMembers: rows.filter(r => r.status === 'DROPPED_MEMBER'),
    changedMembers: rows.filter(r => r.status === 'CONTRIB_CHANGED'),
    epfVarianceBreakup,
    epsDropBreakup,
    totalContribDropBreakup,
    rows
  };
};

/**
 * Compute the earned ESI Wage for an employee's payroll result.
 * Correlates directly with ESI contribution (IP Share 0.75% and ER Share 3.25%).
 */
export const computeEarnedESIWage = (
  r: PayrollResult | undefined,
  config?: StatutoryConfig
): number => {
  if (!r) return 0;
  const ip = Math.round(r.deductions?.esi || 0);
  const er = Math.round(r.employerContributions?.esi || 0);
  if (ip === 0 && er === 0) return 0;

  if (config?.pfEsiCalculationBasis === 'OriginalWages' && config.esiOriginalWagesComponents) {
    const comps = config.esiOriginalWagesComponents;
    let base = 0;
    if (comps.basic) base += (r.earnings?.basic || 0);
    if (comps.da) base += (r.earnings?.da || 0);
    if (comps.retaining) base += (r.earnings?.retainingAllowance || 0);
    if (comps.hra) base += (r.earnings?.hra || 0);
    if (comps.conveyance) base += (r.earnings?.conveyance || 0);
    if (comps.washing) base += (r.earnings?.washing || 0);
    if (comps.attire) base += (r.earnings?.attire || 0);
    if (comps.special1) base += (r.earnings?.special1 || 0);
    if (comps.special2) base += (r.earnings?.special2 || 0);
    if (comps.special3) base += (r.earnings?.special3 || 0);
    return Math.round(base);
  }

  // Labour Code basis (default):
  const wageA = (r.earnings?.basic || 0) + (r.earnings?.da || 0) + (r.earnings?.retainingAllowance || 0);
  const gross = (r.earnings?.total || 0);
  const wageC = gross - wageA;
  let wageD = 0;
  if (gross > 0) {
    const allowancePercentage = wageC / gross;
    if (allowancePercentage > 0.50) {
      wageD = wageC - Math.round(gross * 0.50);
    }
  }
  return Math.round(wageA + wageD);
};

/**
 * 2. Calculate ESI Month-over-Month Audit
 */
export const calculateESIAudit = (
  currResults: PayrollResult[],
  prevResults: PayrollResult[],
  employees: Employee[],
  currPeriod: string,
  prevPeriod: string,
  config?: StatutoryConfig
): ESIAuditSummary => {
  const allEmpIds = Array.from(new Set([
    ...currResults.map(r => r.employeeId),
    ...prevResults.map(r => r.employeeId)
  ]));

  const rows: ESIAuditRow[] = [];

  let prevIP = 0;
  let currIP = 0;
  let prevER = 0;
  let currER = 0;

  let prevMembers = 0;
  let currMembers = 0;

  const ceiling = config?.esiCeiling || 21000;

  for (const empId of allEmpIds) {
    const emp = employees.find(e => e.id === empId);
    const currR = currResults.find(r => r.employeeId === empId);
    const prevR = prevResults.find(r => r.employeeId === empId);

    if (!emp) continue;

    const prevIPVal = Math.round(prevR?.deductions?.esi || 0);
    const currIPVal = Math.round(currR?.deductions?.esi || 0);
    const prevERVal = Math.round(prevR?.employerContributions?.esi || 0);
    const currERVal = Math.round(currR?.employerContributions?.esi || 0);

    const prevGross = Math.round(prevR?.earnings?.total || 0);
    const currGross = Math.round(currR?.earnings?.total || 0);

    const prevWage = computeEarnedESIWage(prevR, config);
    const currWage = computeEarnedESIWage(currR, config);

    const prevDays = Math.round(prevR?.payableDays || 0);
    const currDays = Math.round(currR?.payableDays || 0);

    if (prevIPVal > 0 || prevERVal > 0) prevMembers++;
    if (currIPVal > 0 || currERVal > 0) currMembers++;

    prevIP += prevIPVal;
    currIP += currIPVal;
    prevER += prevERVal;
    currER += currERVal;

    // FILTER OUT EMPLOYEES WITH NO ESI IMPACT:
    // If an employee has NO ESI contribution in both previous and current periods,
    // they have no impact on ESI and must not be included in the ESI audit report.
    const hasESIImpact = prevIPVal > 0 || currIPVal > 0 || prevERVal > 0 || currERVal > 0;
    if (!hasESIImpact) {
      continue;
    }

    const effectiveDOL = emp.dol || (currR?.esiRemark?.startsWith('Left: ') ? currR.esiRemark.replace('Left: ', '').trim() : '');
    const leavingReason = emp.leavingReason || '';

    const alerts: string[] = [];
    let status: ESIAuditRow['status'] = 'Normal';

    if (prevIPVal > 0 && currIPVal === 0) {
      if (currGross > ceiling) {
        status = 'CROSSED_CEILING';
        alerts.push(`Salary crossed ESI ceiling (> ₹${ceiling}): ESI ceased`);
      } else if (effectiveDOL) {
        status = 'DROPPED_IP';
        alerts.push(`Resigned on ${effectiveDOL}${leavingReason ? ` (${leavingReason})` : ''}: Contributed in ${prevPeriod}, no contribution in ${currPeriod}`);
      } else if (emp.isESIExempt) {
        status = 'ZERO_CONTRIB';
        alerts.push('ESI Exempt toggled active in Employee Master');
      } else if (currDays === 0) {
        status = 'ZERO_CONTRIB';
        alerts.push('Zero payable days (LOP): Zero ESI contribution');
      } else {
        status = 'DROPPED_IP';
        alerts.push('IP contribution stopped (₹' + prevIPVal + ' ➔ ₹0)');
      }
    } else if (prevIPVal === 0 && currIPVal > 0) {
      if (prevGross > ceiling && currGross <= ceiling) {
        status = 'DROPPED_INTO_COVERAGE';
        alerts.push(`Salary dropped below ceiling (<= ₹${ceiling}): Re-entered ESI coverage`);
      } else {
        status = 'NEW_IP';
        alerts.push('New contributing IP member in ' + currPeriod);
      }
    } else if (prevIPVal > 0 && currIPVal > 0) {
      // Both months contributing: verify if contribution shifted
      if (prevIPVal !== currIPVal || prevERVal !== currERVal) {
        status = 'CONTRIB_CHANGED';
        const ipDiff = currIPVal - prevIPVal;
        const ipPct = prevIPVal > 0 ? (ipDiff / prevIPVal) * 100 : 0;
        alerts.push(`IP Share Shift: ${ipDiff > 0 ? '+' : ''}₹${ipDiff} (${ipPct > 0 ? '+' : ''}${ipPct.toFixed(1)}%)`);
      }
    }

    const hasChange = prevIPVal !== currIPVal || prevERVal !== currERVal || status !== 'Normal' || alerts.length > 0;

    rows.push({
      empId,
      esiNo: emp.esiNumber || '-',
      name: emp.name,
      prevWage,
      currWage,
      prevIP: prevIPVal,
      currIP: currIPVal,
      prevER: prevERVal,
      currER: currERVal,
      prevDays,
      currDays,
      status,
      hasChange,
      alerts,
      dol: effectiveDOL || undefined,
      leavingReason: leavingReason || undefined
    });
  }

  // Sort by EMP ID naturally (numeric-aware)
  rows.sort((a, b) => (a.empId || '').localeCompare(b.empId || '', undefined, { numeric: true, sensitivity: 'base' }));

  const ipDiff = currIP - prevIP;
  const ipPercent = prevIP > 0 ? Math.round((ipDiff / prevIP) * 100 * 10) / 10 : 0;

  const erDiff = currER - prevER;
  const erPercent = prevER > 0 ? Math.round((erDiff / prevER) * 100 * 10) / 10 : 0;

  return {
    prevPeriod,
    currPeriod,
    prevMembers,
    currMembers,
    memberDiff: currMembers - prevMembers,
    prevIP,
    currIP,
    ipDiff,
    ipPercent,
    prevER,
    currER,
    erDiff,
    erPercent,
    ceilingCrossingAlerts: rows.filter(r => r.status === 'CROSSED_CEILING'),
    zeroContribAlerts: rows.filter(r => r.status === 'ZERO_CONTRIB'),
    newIPs: rows.filter(r => r.status === 'NEW_IP'),
    droppedIPs: rows.filter(r => r.status === 'DROPPED_IP'),
    changedIPs: rows.filter(r => r.status === 'CONTRIB_CHANGED'),
    rows
  };
};

/**
 * 3. Calculate Employee Pay Month-over-Month Audit
 */
export const calculatePayAudit = (
  currResults: PayrollResult[],
  prevResults: PayrollResult[],
  employees: Employee[],
  currPeriod: string,
  prevPeriod: string
): PayAuditSummary => {
  const allEmpIds = Array.from(new Set([
    ...currResults.map(r => r.employeeId),
    ...prevResults.map(r => r.employeeId)
  ]));

  const rows: PayAuditRow[] = [];

  let prevGross = 0;
  let currGross = 0;
  let prevNet = 0;
  let currNet = 0;

  for (const empId of allEmpIds) {
    const emp = employees.find(e => e.id === empId);
    const currR = currResults.find(r => r.employeeId === empId);
    const prevR = prevResults.find(r => r.employeeId === empId);

    if (!emp) continue;

    const prevGrossVal = Math.round(prevR?.earnings?.total || 0);
    const currGrossVal = Math.round(currR?.earnings?.total || 0);
    const prevNetVal = Math.round(prevR?.netPay || 0);
    const currNetVal = Math.round(currR?.netPay || 0);

    const prevBasicVal = Math.round(prevR?.earnings?.basic || 0);
    const currBasicVal = Math.round(currR?.earnings?.basic || 0);

    const prevDays = Math.round(prevR?.payableDays || 0);
    const currDays = Math.round(currR?.payableDays || 0);

    prevGross += prevGrossVal;
    currGross += currGrossVal;
    prevNet += prevNetVal;
    currNet += currNetVal;

    // FILTER OUT EMPLOYEES WITH NO PAYROLL IMPACT:
    // If an employee has no earnings, net pay, or payable days in both periods,
    // they have no impact on the employee pay audit and must not be included.
    const hasPayImpact = (currR && (currGrossVal > 0 || currNetVal > 0 || currDays > 0)) ||
                         (prevR && (prevGrossVal > 0 || prevNetVal > 0 || prevDays > 0));
    if (!hasPayImpact) {
      continue;
    }

    const grossDiff = currGrossVal - prevGrossVal;
    const grossPercent = prevGrossVal > 0 ? Math.round((grossDiff / prevGrossVal) * 100 * 10) / 10 : 0;
    const netDiff = currNetVal - prevNetVal;
    const basicDiff = currBasicVal - prevBasicVal;
    const daysDiff = currDays - prevDays;

    const effectiveDOL = emp.dol || (currR?.esiRemark?.startsWith('Left: ') ? currR.esiRemark.replace('Left: ', '').trim() : '');
    const leavingReason = emp.leavingReason || '';

    const alerts: string[] = [];
    let status: PayAuditRow['status'] = 'Normal';

    // 1. Employee Resignation / Exit (check DOL first)
    const isExited = effectiveDOL && (currDays === 0 || !currR || currGrossVal === 0);
    const isAbsentFromPayroll = prevR && !currR;

    if (isExited || (effectiveDOL && currDays < prevDays)) {
      status = 'EXITED';
      alerts.push(`Due to Employee Resigned (DOL: ${effectiveDOL}${leavingReason ? `, ${leavingReason}` : ''})`);
      if (currGrossVal === 0 || currDays === 0) {
        alerts.push(`Gross Pay dropped to ₹0 (-100% / -₹${prevGrossVal.toLocaleString()})`);
      } else {
        alerts.push(`Payable Days: ${prevDays} ➔ ${currDays} days | Gross Shift: ${grossDiff > 0 ? '+' : ''}₹${grossDiff.toLocaleString()} (${grossPercent}%)`);
      }
    } else if (isAbsentFromPayroll) {
      status = 'EXITED';
      alerts.push(`Absent from ${currPeriod} payroll (was ₹${prevGrossVal.toLocaleString()})`);
    } else if ((!prevR || (prevDays === 0 && prevGrossVal === 0)) && currDays > 0) {
      // 2. Newly Joined
      status = 'NEW_JOINER';
      alerts.push(`Due to Newly Joined${emp.doj ? ` (DOJ: ${emp.doj})` : ''}`);
      alerts.push(`Payable Days: ${currDays} | Gross: ₹${currGrossVal.toLocaleString()}`);
    } else if (currR && currBasicVal === 0 && currDays > 0) {
      // 3. Zero Basic Anomaly
      status = 'ZERO_BASIC';
      alerts.push('Anomaly: Basic pay is ₹0 while payable days > 0');
    } else if (prevR && currR && (grossDiff !== 0 || netDiff !== 0 || basicDiff !== 0 || daysDiff !== 0)) {
      // 4. Pay Shift Classification (Active in both months)
      const isHighVariance = Math.abs(grossPercent) >= 15 && Math.abs(grossDiff) >= 1000;
      status = isHighVariance ? 'HIGH_VARIANCE' : 'PAY_CHANGED';

      if (daysDiff > 0) {
        // More payable days worked in current period (e.g. 12 -> 31)
        alerts.push(`Due to increase in Pay days (${prevDays} ➔ ${currDays} days)`);
        if (basicDiff > 0) {
          alerts.push(`Due to Increment: Basic ₹${prevBasicVal.toLocaleString()} ➔ ₹${currBasicVal.toLocaleString()}`);
        }
        alerts.push(`Gross Shift: +₹${grossDiff.toLocaleString()} (+${grossPercent}%)`);
      } else if (daysDiff < 0) {
        // Fewer payable days worked (LOP / Absenteeism)
        alerts.push(`Due to LOP (${Math.abs(daysDiff)} days drop: ${prevDays} ➔ ${currDays} days)`);
        alerts.push(`Gross Shift: ${grossDiff > 0 ? '+' : ''}₹${grossDiff.toLocaleString()} (${grossPercent}%)`);
      } else if (basicDiff > 0 || (grossDiff > 0 && basicDiff === 0)) {
        // Equal days worked (e.g. 31 -> 31), but salary increased -> Due to Increment!
        alerts.push(`Due to Increment${basicDiff > 0 ? `: Basic ₹${prevBasicVal.toLocaleString()} ➔ ₹${currBasicVal.toLocaleString()}` : ''}`);
        alerts.push(`Gross Shift: +₹${grossDiff.toLocaleString()} (+${grossPercent}%)`);
        if (netDiff !== 0) {
          alerts.push(`Net Shift: ${netDiff > 0 ? '+' : ''}₹${netDiff.toLocaleString()}`);
        }
      } else if (grossDiff < 0) {
        // Equal days, but earnings adjusted downwards
        alerts.push(`Pay adjustment: -₹${Math.abs(grossDiff).toLocaleString()} (${grossPercent}%)`);
        if (basicDiff !== 0) {
          alerts.push(`Basic Pay adjusted: ₹${prevBasicVal.toLocaleString()} ➔ ₹${currBasicVal.toLocaleString()}`);
        }
      } else if (netDiff !== 0) {
        // Gross unchanged, but statutory/tax deductions shifted net pay
        alerts.push(`Net Shift: ${netDiff > 0 ? '+' : ''}₹${netDiff.toLocaleString()}`);
      }
    }

    const hasChange = grossDiff !== 0 || netDiff !== 0 || basicDiff !== 0 || status !== 'Normal' || alerts.length > 0;

    rows.push({
      empId,
      name: emp.name,
      designation: emp.designation || '-',
      prevGross: prevGrossVal,
      currGross: currGrossVal,
      grossDiff,
      grossPercent,
      prevNet: prevNetVal,
      currNet: currNetVal,
      netDiff,
      prevBasic: prevBasicVal,
      currBasic: currBasicVal,
      basicDiff,
      prevDays,
      currDays,
      status,
      hasChange,
      alerts,
      dol: effectiveDOL || undefined,
      leavingReason: leavingReason || undefined
    });
  }

  // Sort by EMP ID naturally (numeric-aware)
  rows.sort((a, b) => (a.empId || '').localeCompare(b.empId || '', undefined, { numeric: true, sensitivity: 'base' }));

  const grossDiff = currGross - prevGross;
  const grossPercent = prevGross > 0 ? Math.round((grossDiff / prevGross) * 100 * 10) / 10 : 0;
  const netDiff = currNet - prevNet;
  const netPercent = prevNet > 0 ? Math.round((netDiff / prevNet) * 100 * 10) / 10 : 0;

  return {
    prevPeriod,
    currPeriod,
    prevHeadcount: prevResults.length,
    currHeadcount: currResults.length,
    headcountDiff: currResults.length - prevResults.length,
    prevGross,
    currGross,
    grossDiff,
    grossPercent,
    prevNet,
    currNet,
    netDiff,
    netPercent,
    highVarianceAlerts: rows.filter(r => r.status === 'HIGH_VARIANCE'),
    zeroBasicAlerts: rows.filter(r => r.status === 'ZERO_BASIC'),
    newJoiners: rows.filter(r => r.status === 'NEW_JOINER'),
    exitedEmployees: rows.filter(r => r.status === 'EXITED'),
    changedPayEmployees: rows.filter(r => r.status === 'PAY_CHANGED'),
    rows
  };
};

/**
 * Format a difference number cleanly: returns the numeric difference
 */
const calcDiff = (curr: number, prev: number): number => {
  const c = isNaN(curr) || curr === undefined || curr === null ? 0 : curr;
  const p = isNaN(prev) || prev === undefined || prev === null ? 0 : prev;
  return Math.round((c - p) * 100) / 100;
};

/**
 * Human-readable status badges for Audit Reports
 */
const formatECRStatus = (status: string, alerts: string[]): string => {
  switch (status) {
    case 'EPS_DROPPED_ZERO': return 'EPS Dropped to ₹0';
    case 'NEW_MEMBER': return 'New Member';
    case 'DROPPED_MEMBER': return 'Exited / Resigned';
    case 'VARIANCE_HIGH': return 'High Variance';
    case 'CONTRIB_CHANGED': return 'Contribution Shift';
    case 'RESUMED_FROM_LOP': return 'Resumed from LOP';
    case 'ON_LOP': return 'On LOP';
    case 'Normal':
    default:
      return alerts && alerts.length > 0 ? 'Variance Flagged' : 'Verified Match';
  }
};

const formatESIStatus = (status: string, alerts: string[]): string => {
  switch (status) {
    case 'NEW_IP':
    case 'NEW_MEMBER': return 'New Contributing IP';
    case 'DROPPED_IP':
    case 'DROPPED_MEMBER': return 'Exited / Resigned';
    case 'CROSSED_CEILING':
    case 'EXEMPTED_CEILING': return 'Salary Crossed Ceiling';
    case 'DROPPED_INTO_COVERAGE': return 'Re-entered Coverage';
    case 'ZERO_CONTRIB': return 'Zero Contribution';
    case 'VARIANCE_HIGH': return 'High Variance';
    case 'DAYS_VARIANCE': return 'Days Variance';
    case 'WAGE_VARIANCE': return 'Wage Variance';
    case 'CONTRIB_CHANGED': return 'Contribution Shift';
    case 'Normal':
    default:
      return alerts && alerts.length > 0 ? 'Variance Flagged' : 'Verified Match';
  }
};

const formatPayStatus = (status: string, alerts: string[]): string => {
  switch (status) {
    case 'HIGH_VARIANCE': return 'High Variance';
    case 'ZERO_BASIC': return 'Zero Basic Anomaly';
    case 'NEW_JOINER': return 'New Joiner';
    case 'EXITED': return 'Exited / Resigned';
    case 'PAY_CHANGED': return 'Pay Shift';
    case 'Normal':
    default:
      return alerts && alerts.length > 0 ? 'Variance Flagged' : 'Verified Match';
  }
};

const formatAuditNote = (alerts: string[]): string => {
  if (!alerts || alerts.length === 0) return 'Verified Match';
  return alerts.join(' | ');
};

/**
 * Apply Premium Professional Styling to MoM Audit Comparison Sheets
 * Matches exact format, colors, and styling from user specification:
 * - Header Row: Navy Blue (#002060) background with Bold White text and centered/proper alignment
 * - Data Rows: Crisp borders, centered codes/dates, left-aligned names, right-aligned numbers
 * - Variance Rows: Full Light Sky Blue fill (#BDD7EE) across all columns without gaps, bold black text/numbers
 * - Totals Rows: Soft Gray-Blue fill (#D9E1F2) for month totals, Accent Blue (#BDD7EE) with Navy Bold text and double bottom border for Total Variance
 */
const applyMoMTableStyles = (
  ws: XLSX.WorkSheet,
  colCount: number,
  rowCount: number
) => {
  // Freeze Header Row
  (ws as any)['!freeze'] = { xSplit: 0, ySplit: 1 };
  (ws as any)['!views'] = [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }];

  // Set explicit row heights (26px for header, 20px for data & variance)
  const rowHeights: { hpx: number }[] = [];
  for (let r = 0; r < rowCount; r++) {
    rowHeights.push({ hpx: r === 0 ? 26 : 20 });
  }
  ws['!rows'] = rowHeights;

  // Extract header names to identify columns
  const headerNames: string[] = [];
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    headerNames.push(String(ws[addr]?.v || '').trim());
  }

  // Iterate through all cells
  for (let r = 0; r < rowCount; r++) {
    // Determine row category
    let isVarianceRow = false;
    let isTotalPeriodRow = false;
    let isTotalVarianceRow = false;

    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cellVal = String(ws[addr]?.v || '').trim();
      if (cellVal === 'Variance') {
        isVarianceRow = true;
        break;
      } else if (cellVal === 'Total Variance') {
        isTotalVarianceRow = true;
        break;
      } else if (cellVal.startsWith('Total ')) {
        isTotalPeriodRow = true;
        break;
      }
    }

    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) {
        ws[addr] = { t: 's', v: '' };
      }
      const cell = ws[addr];
      const colHeader = headerNames[c] || '';
      const isTextCol = ['Month', 'Year', 'Emp ID', 'UAN', 'ESI Number', 'Employee Name', 'Designation', 'Audit Status', 'Audit Note'].includes(colHeader);
      const isCenterCol = ['Month', 'Year', 'Emp ID', 'Audit Status'].includes(colHeader);
      const isCodeCol = ['UAN', 'ESI Number', 'Emp ID'].includes(colHeader);

      // Force string type on code columns to prevent Excel scientific notation
      if (isCodeCol && cell.v !== '' && cell.v !== null && cell.v !== undefined) {
        cell.t = 's';
        cell.v = String(cell.v);
      }

      // Format numbers
      if (!isTextCol && typeof cell.v === 'number') {
        cell.t = 'n';
      }

      if (r === 0) {
        // 1. HEADER ROW: Navy Blue #002060 with Bold White Text
        cell.s = {
          fill: { fgColor: { rgb: '002060' }, patternType: 'solid' },
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: {
            horizontal: (isCenterCol || isCodeCol) ? 'center' : (isTextCol ? 'left' : 'right'),
            vertical: 'center',
            wrapText: true
          },
          border: {
            top: { style: 'thin', color: { rgb: '001A4E' } },
            bottom: { style: 'thin', color: { rgb: '001A4E' } },
            left: { style: 'thin', color: { rgb: '001A4E' } },
            right: { style: 'thin', color: { rgb: '001A4E' } }
          }
        };
      } else if (isVarianceRow) {
        // 2. VARIANCE ROW: Light Sky Blue #BDD7EE across ALL columns
        const isVarianceLabel = cell.v === 'Variance';
        const isNumeric = typeof cell.v === 'number';

        cell.s = {
          fill: { fgColor: { rgb: 'BDD7EE' }, patternType: 'solid' },
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '000000' } },
          alignment: {
            horizontal: isVarianceLabel ? 'left' : (isNumeric ? 'right' : (colHeader === 'Audit Status' ? 'center' : (colHeader === 'Audit Note' ? 'left' : 'center'))),
            vertical: 'center',
            wrapText: colHeader === 'Audit Note'
          },
          border: {
            top: { style: 'thin', color: { rgb: '9BC2E6' } },
            bottom: { style: 'thin', color: { rgb: '9BC2E6' } },
            left: { style: 'thin', color: { rgb: '9BC2E6' } },
            right: { style: 'thin', color: { rgb: '9BC2E6' } }
          },
          numFmt: isNumeric ? (Number.isInteger(cell.v) ? '0' : '0.00') : undefined
        };
      } else if (isTotalVarianceRow) {
        // 3. TOTAL VARIANCE ROW: Light Blue #BDD7EE with Bold Navy #002060 and Double Bottom Border
        const isLabel = typeof cell.v === 'string' && cell.v.includes('Total');
        const isNumeric = typeof cell.v === 'number';

        cell.s = {
          fill: { fgColor: { rgb: 'BDD7EE' }, patternType: 'solid' },
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '002060' } },
          alignment: {
            horizontal: isLabel ? 'left' : (isNumeric ? 'right' : 'center'),
            vertical: 'center'
          },
          border: {
            top: { style: 'thin', color: { rgb: '002060' } },
            bottom: { style: 'double', color: { rgb: '002060' } },
            left: { style: 'thin', color: { rgb: '9BC2E6' } },
            right: { style: 'thin', color: { rgb: '9BC2E6' } }
          },
          numFmt: isNumeric ? (Number.isInteger(cell.v) ? '0' : '0.00') : undefined
        };
      } else if (isTotalPeriodRow) {
        // 4. TOTAL PERIOD ROW: Soft Gray-Blue #D9E1F2 with Bold Black Text
        const isLabel = typeof cell.v === 'string' && cell.v.includes('Total');
        const isNumeric = typeof cell.v === 'number';

        cell.s = {
          fill: { fgColor: { rgb: 'D9E1F2' }, patternType: 'solid' },
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '000000' } },
          alignment: {
            horizontal: isLabel ? 'left' : (isNumeric ? 'right' : 'center'),
            vertical: 'center'
          },
          border: {
            top: { style: 'thin', color: { rgb: 'B4C6E7' } },
            bottom: { style: 'thin', color: { rgb: 'B4C6E7' } },
            left: { style: 'thin', color: { rgb: 'B4C6E7' } },
            right: { style: 'thin', color: { rgb: 'B4C6E7' } }
          },
          numFmt: isNumeric ? (Number.isInteger(cell.v) ? '0' : '0.00') : undefined
        };
      } else {
        // 5. DATA ROW: White background, subtle borders, proper alignment
        const isNumeric = typeof cell.v === 'number';

        cell.s = {
          fill: { fgColor: { rgb: 'FFFFFF' }, patternType: 'solid' },
          font: { name: 'Calibri', sz: 11, bold: false, color: { rgb: '000000' } },
          alignment: {
            horizontal: (isCenterCol || isCodeCol) ? 'center' : (isNumeric ? 'right' : 'left'),
            vertical: 'center',
            wrapText: colHeader === 'Audit Note'
          },
          border: {
            top: { style: 'thin', color: { rgb: 'D9D9D9' } },
            bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
            left: { style: 'thin', color: { rgb: 'D9D9D9' } },
            right: { style: 'thin', color: { rgb: 'D9D9D9' } }
          },
          numFmt: isNumeric ? (Number.isInteger(cell.v) ? '0' : '0.00') : undefined
        };
      }
    }
  }
};

/**
 * Export ECR Audit to Excel with Stacked Employee Rows (Baseline, Current, Variance)
 * Styled with Navy Blue header, Light Blue variance fill, NCP Days last, and Audit Status & Note
 */
export const exportECRAuditExcel = async (
  summary: ECRAuditSummary,
  company?: CompanyProfile
): Promise<string | null> => {
  const [prevM, prevYStr] = summary.prevPeriod.split(' ');
  const [currM, currYStr] = summary.currPeriod.split(' ');
  const prevMonthShort = prevM.substring(0, 3);
  const currMonthShort = currM.substring(0, 3);
  const prevYear = parseInt(prevYStr, 10) || 2026;
  const currYear = parseInt(currYStr, 10) || 2026;

  const headers = [
    'Month', 'Year', 'Emp ID', 'UAN', 'Employee Name',
    'EPF Wages', 'EPS Wages', 'EDLI Wages',
    'EE PF', 'ER EPS', 'ER EPF', 'EDLI (0.5%)', 'Total Contrib', 'NCP Days',
    'Audit Status', 'Audit Note'
  ];

  const rows: any[][] = [headers];
  const sortedRows = [...summary.rows].sort((a, b) => (a.empId || '').localeCompare(b.empId || '', undefined, { numeric: true, sensitivity: 'base' }));
  sortedRows.forEach(r => {
    // 1. Baseline Row (e.g. Aug 2026)
    rows.push([
      prevMonthShort,
      prevYear,
      r.empId,
      r.uan,
      r.name,
      r.prevEPFWage,
      r.prevEPSWage,
      r.prevEDLIWage,
      r.prevEEPF,
      r.prevEREPS,
      r.prevEREPF,
      r.prevEDLI,
      r.prevTotalContrib,
      r.prevNCPDays,
      '',
      ''
    ]);

    // 2. Current Row (e.g. Sep 2026)
    rows.push([
      currMonthShort,
      currYear,
      r.empId,
      r.uan,
      r.name,
      r.currEPFWage,
      r.currEPSWage,
      r.currEDLIWage,
      r.currEEPF,
      r.currEREPS,
      r.currEREPF,
      r.currEDLI,
      r.currTotalContrib,
      r.currNCPDays,
      '',
      ''
    ]);

    // 3. Variance Row
    rows.push([
      '',
      '',
      '',
      '',
      'Variance',
      calcDiff(r.currEPFWage, r.prevEPFWage),
      calcDiff(r.currEPSWage, r.prevEPSWage),
      calcDiff(r.currEDLIWage, r.prevEDLIWage),
      calcDiff(r.currEEPF, r.prevEEPF),
      calcDiff(r.currEREPS, r.prevEREPS),
      calcDiff(r.currEREPF, r.prevEREPF),
      calcDiff(r.currEDLI, r.prevEDLI),
      calcDiff(r.currTotalContrib, r.prevTotalContrib),
      calcDiff(r.currNCPDays, r.prevNCPDays),
      formatECRStatus(r.status, r.alerts),
      formatAuditNote(r.alerts)
    ]);
  });

  // Summary Totals at bottom
  rows.push([
    '', '', '', '', `Total ${prevMonthShort} ${prevYear}`,
    summary.rows.reduce((s, r) => s + (r.prevEPFWage || 0), 0),
    summary.rows.reduce((s, r) => s + (r.prevEPSWage || 0), 0),
    summary.rows.reduce((s, r) => s + (r.prevEDLIWage || 0), 0),
    summary.prevEEPF || 0,
    summary.prevEREPS || 0,
    summary.prevEREPF || 0,
    summary.prevEDLI || 0,
    summary.prevTotalContrib || 0,
    summary.rows.reduce((s, r) => s + (r.prevNCPDays || 0), 0),
    '',
    ''
  ]);
  rows.push([
    '', '', '', '', `Total ${currMonthShort} ${currYear}`,
    summary.rows.reduce((s, r) => s + (r.currEPFWage || 0), 0),
    summary.rows.reduce((s, r) => s + (r.currEPSWage || 0), 0),
    summary.rows.reduce((s, r) => s + (r.currEDLIWage || 0), 0),
    summary.currEEPF || 0,
    summary.currEREPS || 0,
    summary.currEREPF || 0,
    summary.currEDLI || 0,
    summary.currTotalContrib || 0,
    summary.rows.reduce((s, r) => s + (r.currNCPDays || 0), 0),
    '',
    ''
  ]);
  rows.push([
    '', '', '', '', 'Total Variance',
    summary.rows.reduce((s, r) => s + ((r.currEPFWage || 0) - (r.prevEPFWage || 0)), 0),
    summary.rows.reduce((s, r) => s + ((r.currEPSWage || 0) - (r.prevEPSWage || 0)), 0),
    summary.rows.reduce((s, r) => s + ((r.currEDLIWage || 0) - (r.prevEDLIWage || 0)), 0),
    summary.eePFDiff || 0,
    summary.erEPSDiff || 0,
    summary.erEPFDiff || 0,
    summary.edliDiff || 0,
    summary.totalContribDiff || 0,
    summary.rows.reduce((s, r) => s + ((r.currNCPDays || 0) - (r.prevNCPDays || 0)), 0),
    '',
    ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 28 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
    { wch: 12 },
    { wch: 22 }, // Audit Status
    { wch: 45 }  // Audit Note
  ];

  // Apply visual formatting matching user specification
  applyMoMTableStyles(ws, headers.length, rows.length);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ECR_MoM_Comparison');

  const fileName = getStandardFileName('ECR_MoM_Comparison', company || {} as any, currM, currYear);
  const subfolder = company ? `${company.establishmentName}___${company.id || ''}___AuditTrailReports` : undefined;
  return await generateExcelWorkbook(wb, fileName, subfolder);
};

/**
 * Export ESI Audit to Excel with Stacked Employee Rows (Baseline, Current, Variance)
 * Styled with Navy Blue header, Light Blue variance fill, and Audit Status & Note
 */
export const exportESIAuditExcel = async (
  summary: ESIAuditSummary,
  company?: CompanyProfile
): Promise<string | null> => {
  const [prevM, prevYStr] = summary.prevPeriod.split(' ');
  const [currM, currYStr] = summary.currPeriod.split(' ');
  const prevMonthShort = prevM.substring(0, 3);
  const currMonthShort = currM.substring(0, 3);
  const prevYear = parseInt(prevYStr, 10) || 2026;
  const currYear = parseInt(currYStr, 10) || 2026;

  const headers = [
    'Month', 'Year', 'Emp ID', 'ESI Number', 'Employee Name',
    'Payable Days', 'ESI Wages', 'IP Share (0.75%)', 'ER Share (3.25%)', 'Total ESI',
    'Audit Status', 'Audit Note'
  ];

  const rows: any[][] = [headers];
  const sortedRows = [...summary.rows].sort((a, b) => (a.empId || '').localeCompare(b.empId || '', undefined, { numeric: true, sensitivity: 'base' }));
  sortedRows.forEach(r => {
    // 1. Baseline Row
    rows.push([
      prevMonthShort,
      prevYear,
      r.empId,
      r.esiNo,
      r.name,
      r.prevDays,
      r.prevWage,
      r.prevIP,
      r.prevER,
      r.prevIP + r.prevER,
      '',
      ''
    ]);

    // 2. Current Row
    rows.push([
      currMonthShort,
      currYear,
      r.empId,
      r.esiNo,
      r.name,
      r.currDays,
      r.currWage,
      r.currIP,
      r.currER,
      r.currIP + r.currER,
      '',
      ''
    ]);

    // 3. Variance Row
    rows.push([
      '',
      '',
      '',
      '',
      'Variance',
      calcDiff(r.currDays, r.prevDays),
      calcDiff(r.currWage, r.prevWage),
      calcDiff(r.currIP, r.prevIP),
      calcDiff(r.currER, r.prevER),
      calcDiff(r.currIP + r.currER, r.prevIP + r.prevER),
      formatESIStatus(r.status, r.alerts),
      formatAuditNote(r.alerts)
    ]);
  });

  // Summary Totals
  rows.push([
    '', '', '', '', `Total ${prevMonthShort} ${prevYear}`,
    summary.rows.reduce((s, r) => s + (r.prevDays || 0), 0),
    summary.rows.reduce((s, r) => s + (r.prevWage || 0), 0),
    summary.prevIP || 0,
    summary.prevER || 0,
    (summary.prevIP || 0) + (summary.prevER || 0),
    '',
    ''
  ]);
  rows.push([
    '', '', '', '', `Total ${currMonthShort} ${currYear}`,
    summary.rows.reduce((s, r) => s + (r.currDays || 0), 0),
    summary.rows.reduce((s, r) => s + (r.currWage || 0), 0),
    summary.currIP || 0,
    summary.currER || 0,
    (summary.currIP || 0) + (summary.currER || 0),
    '',
    ''
  ]);
  rows.push([
    '', '', '', '', 'Total Variance',
    summary.rows.reduce((s, r) => s + ((r.currDays || 0) - (r.prevDays || 0)), 0),
    summary.rows.reduce((s, r) => s + ((r.currWage || 0) - (r.prevWage || 0)), 0),
    summary.ipDiff || 0,
    summary.erDiff || 0,
    ((summary.currIP || 0) + (summary.currER || 0)) - ((summary.prevIP || 0) + (summary.prevER || 0)),
    '',
    ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 28 },
    { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 16 },
    { wch: 22 }, // Audit Status
    { wch: 45 }  // Audit Note
  ];

  // Apply visual formatting matching user specification
  applyMoMTableStyles(ws, headers.length, rows.length);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ESI_MoM_Comparison');

  const fileName = getStandardFileName('ESI_MoM_Comparison', company || {} as any, currM, currYear);
  const subfolder = company ? `${company.establishmentName}___${company.id || ''}___AuditTrailReports` : undefined;
  return await generateExcelWorkbook(wb, fileName, subfolder);
};

/**
 * Export Pay Audit to Excel with Stacked Employee Rows (Baseline, Current, Variance)
 * Styled with Navy Blue header, Light Blue variance fill, and Audit Status & Note
 */
export const exportPayAuditExcel = async (
  summary: PayAuditSummary,
  company?: CompanyProfile
): Promise<string | null> => {
  const [prevM, prevYStr] = summary.prevPeriod.split(' ');
  const [currM, currYStr] = summary.currPeriod.split(' ');
  const prevMonthShort = prevM.substring(0, 3);
  const currMonthShort = currM.substring(0, 3);
  const prevYear = parseInt(prevYStr, 10) || 2026;
  const currYear = parseInt(currYStr, 10) || 2026;

  const headers = [
    'Month', 'Year', 'Emp ID', 'Employee Name', 'Designation',
    'Payable Days', 'Basic Pay', 'Gross Salary', 'Net Pay',
    'Audit Status', 'Audit Note'
  ];

  const rows: any[][] = [headers];
  const sortedRows = [...summary.rows].sort((a, b) => (a.empId || '').localeCompare(b.empId || '', undefined, { numeric: true, sensitivity: 'base' }));
  sortedRows.forEach(r => {
    // 1. Baseline Row
    rows.push([
      prevMonthShort,
      prevYear,
      r.empId,
      r.name,
      r.designation,
      r.prevDays,
      r.prevBasic,
      r.prevGross,
      r.prevNet,
      '',
      ''
    ]);

    // 2. Current Row
    rows.push([
      currMonthShort,
      currYear,
      r.empId,
      r.name,
      r.designation,
      r.currDays,
      r.currBasic,
      r.currGross,
      r.currNet,
      '',
      ''
    ]);

    // 3. Variance Row
    rows.push([
      '',
      '',
      '',
      'Variance',
      '',
      calcDiff(r.currDays, r.prevDays),
      calcDiff(r.currBasic, r.prevBasic),
      calcDiff(r.currGross, r.prevGross),
      calcDiff(r.currNet, r.prevNet),
      formatPayStatus(r.status, r.alerts),
      formatAuditNote(r.alerts)
    ]);
  });

  // Summary Totals
  rows.push([
    '', '', '', `Total ${prevMonthShort} ${prevYear}`, '',
    summary.rows.reduce((s, r) => s + (r.prevDays || 0), 0),
    summary.rows.reduce((s, r) => s + (r.prevBasic || 0), 0),
    summary.prevGross || 0,
    summary.prevNet || 0,
    '',
    ''
  ]);
  rows.push([
    '', '', '', `Total ${currMonthShort} ${currYear}`, '',
    summary.rows.reduce((s, r) => s + (r.currDays || 0), 0),
    summary.rows.reduce((s, r) => s + (r.currBasic || 0), 0),
    summary.currGross || 0,
    summary.currNet || 0,
    '',
    ''
  ]);
  rows.push([
    '', '', '', 'Total Variance', '',
    summary.rows.reduce((s, r) => s + ((r.currDays || 0) - (r.prevDays || 0)), 0),
    summary.rows.reduce((s, r) => s + ((r.currBasic || 0) - (r.prevBasic || 0)), 0),
    summary.grossDiff || 0,
    summary.netDiff || 0,
    '',
    ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 28 }, { wch: 20 },
    { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
    { wch: 22 }, // Audit Status
    { wch: 45 }  // Audit Note
  ];

  // Apply visual formatting matching user specification
  applyMoMTableStyles(ws, headers.length, rows.length);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Salary_MoM_Comparison');

  const fileName = getStandardFileName('Employee_Salary_MoM_Comparison', company || {} as any, currM, currYear);
  const subfolder = company ? `${company.establishmentName}___${company.id || ''}___AuditTrailReports` : undefined;
  return await generateExcelWorkbook(wb, fileName, subfolder);
};

/**
 * Consolidated Month-over-Month Comparison Excel Export
 * Contains sheets for ECR, ESI, and Pay with stacked employee rows and column variance
 * Formatted exactly as shown in user specification (Image 2) with Navy headers, Light Blue variance fill, and Audit Status & Note
 */
export const exportAuditMoMStackedExcel = async (
  ecrSummary: ECRAuditSummary,
  esiSummary: ESIAuditSummary,
  paySummary: PayAuditSummary,
  company?: CompanyProfile,
  activeTab: 'ECR' | 'ESI' | 'PAY' = 'ECR'
): Promise<string | null> => {
  const wb = XLSX.utils.book_new();

  const [prevM, prevYStr] = ecrSummary.prevPeriod.split(' ');
  const [currM, currYStr] = ecrSummary.currPeriod.split(' ');
  const prevMonthShort = prevM.substring(0, 3);
  const currMonthShort = currM.substring(0, 3);
  const prevYear = parseInt(prevYStr, 10) || 2026;
  const currYear = parseInt(currYStr, 10) || 2026;

  // 1. ECR Sheet Construction
  const ecrHeaders = [
    'Month', 'Year', 'Emp ID', 'UAN', 'Employee Name',
    'EPF Wages', 'EPS Wages', 'EDLI Wages',
    'EE PF', 'ER EPS', 'ER EPF', 'EDLI (0.5%)', 'Total Contrib', 'NCP Days',
    'Audit Status', 'Audit Note'
  ];
  const ecrRows: any[][] = [ecrHeaders];
  const sortedECRRows = [...ecrSummary.rows].sort((a, b) => (a.empId || '').localeCompare(b.empId || '', undefined, { numeric: true, sensitivity: 'base' }));
  sortedECRRows.forEach(r => {
    ecrRows.push([
      prevMonthShort, prevYear, r.empId, r.uan, r.name,
      r.prevEPFWage, r.prevEPSWage, r.prevEDLIWage,
      r.prevEEPF, r.prevEREPS, r.prevEREPF, r.prevEDLI, r.prevTotalContrib,
      r.prevNCPDays,
      '',
      ''
    ]);
    ecrRows.push([
      currMonthShort, currYear, r.empId, r.uan, r.name,
      r.currEPFWage, r.currEPSWage, r.currEDLIWage,
      r.currEEPF, r.currEREPS, r.currEREPF, r.currEDLI, r.currTotalContrib,
      r.currNCPDays,
      '',
      ''
    ]);
    ecrRows.push([
      '', '', '', '', 'Variance',
      calcDiff(r.currEPFWage, r.prevEPFWage),
      calcDiff(r.currEPSWage, r.prevEPSWage),
      calcDiff(r.currEDLIWage, r.prevEDLIWage),
      calcDiff(r.currEEPF, r.prevEEPF),
      calcDiff(r.currEREPS, r.prevEREPS),
      calcDiff(r.currEREPF, r.prevEREPF),
      calcDiff(r.currEDLI, r.prevEDLI),
      calcDiff(r.currTotalContrib, r.prevTotalContrib),
      calcDiff(r.currNCPDays, r.prevNCPDays),
      formatECRStatus(r.status, r.alerts),
      formatAuditNote(r.alerts)
    ]);
  });

  ecrRows.push([
    '', '', '', '', `Total ${prevMonthShort} ${prevYear}`,
    ecrSummary.rows.reduce((s, r) => s + (r.prevEPFWage || 0), 0),
    ecrSummary.rows.reduce((s, r) => s + (r.prevEPSWage || 0), 0),
    ecrSummary.rows.reduce((s, r) => s + (r.prevEDLIWage || 0), 0),
    ecrSummary.prevEEPF || 0,
    ecrSummary.prevEREPS || 0,
    ecrSummary.prevEREPF || 0,
    ecrSummary.prevEDLI || 0,
    ecrSummary.prevTotalContrib || 0,
    ecrSummary.rows.reduce((s, r) => s + (r.prevNCPDays || 0), 0),
    '',
    ''
  ]);
  ecrRows.push([
    '', '', '', '', `Total ${currMonthShort} ${currYear}`,
    ecrSummary.rows.reduce((s, r) => s + (r.currEPFWage || 0), 0),
    ecrSummary.rows.reduce((s, r) => s + (r.currEPSWage || 0), 0),
    ecrSummary.rows.reduce((s, r) => s + (r.currEDLIWage || 0), 0),
    ecrSummary.currEEPF || 0,
    ecrSummary.currEREPS || 0,
    ecrSummary.currEREPF || 0,
    ecrSummary.currEDLI || 0,
    ecrSummary.currTotalContrib || 0,
    ecrSummary.rows.reduce((s, r) => s + (r.currNCPDays || 0), 0),
    '',
    ''
  ]);
  ecrRows.push([
    '', '', '', '', 'Total Variance',
    ecrSummary.rows.reduce((s, r) => s + ((r.currEPFWage || 0) - (r.prevEPFWage || 0)), 0),
    ecrSummary.rows.reduce((s, r) => s + ((r.currEPSWage || 0) - (r.prevEPSWage || 0)), 0),
    ecrSummary.rows.reduce((s, r) => s + ((r.currEDLIWage || 0) - (r.prevEDLIWage || 0)), 0),
    ecrSummary.eePFDiff || 0,
    ecrSummary.erEPSDiff || 0,
    ecrSummary.erEPFDiff || 0,
    ecrSummary.edliDiff || 0,
    ecrSummary.totalContribDiff || 0,
    ecrSummary.rows.reduce((s, r) => s + ((r.currNCPDays || 0) - (r.prevNCPDays || 0)), 0),
    '',
    ''
  ]);

  const wsECR = XLSX.utils.aoa_to_sheet(ecrRows);
  wsECR['!cols'] = [
    { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 28 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
    { wch: 12 },
    { wch: 22 }, // Audit Status
    { wch: 45 }  // Audit Note
  ];
  applyMoMTableStyles(wsECR, ecrHeaders.length, ecrRows.length);

  // 2. ESI Sheet Construction
  const esiHeaders = [
    'Month', 'Year', 'Emp ID', 'ESI Number', 'Employee Name',
    'Payable Days', 'ESI Wages', 'IP Share (0.75%)', 'ER Share (3.25%)', 'Total ESI',
    'Audit Status', 'Audit Note'
  ];
  const esiRows: any[][] = [esiHeaders];
  const sortedESIRows = [...esiSummary.rows].sort((a, b) => (a.empId || '').localeCompare(b.empId || '', undefined, { numeric: true, sensitivity: 'base' }));
  sortedESIRows.forEach(r => {
    esiRows.push([
      prevMonthShort, prevYear, r.empId, r.esiNo, r.name,
      r.prevDays, r.prevWage, r.prevIP, r.prevER, r.prevIP + r.prevER,
      '',
      ''
    ]);
    esiRows.push([
      currMonthShort, currYear, r.empId, r.esiNo, r.name,
      r.currDays, r.currWage, r.currIP, r.currER, r.currIP + r.currER,
      '',
      ''
    ]);
    esiRows.push([
      '', '', '', '', 'Variance',
      calcDiff(r.currDays, r.prevDays),
      calcDiff(r.currWage, r.prevWage),
      calcDiff(r.currIP, r.prevIP),
      calcDiff(r.currER, r.prevER),
      calcDiff(r.currIP + r.currER, r.prevIP + r.prevER),
      formatESIStatus(r.status, r.alerts),
      formatAuditNote(r.alerts)
    ]);
  });

  esiRows.push([
    '', '', '', '', `Total ${prevMonthShort} ${prevYear}`,
    esiSummary.rows.reduce((s, r) => s + (r.prevDays || 0), 0),
    esiSummary.rows.reduce((s, r) => s + (r.prevWage || 0), 0),
    esiSummary.prevIP || 0,
    esiSummary.prevER || 0,
    (esiSummary.prevIP || 0) + (esiSummary.prevER || 0),
    '',
    ''
  ]);
  esiRows.push([
    '', '', '', '', `Total ${currMonthShort} ${currYear}`,
    esiSummary.rows.reduce((s, r) => s + (r.currDays || 0), 0),
    esiSummary.rows.reduce((s, r) => s + (r.currWage || 0), 0),
    esiSummary.currIP || 0,
    esiSummary.currER || 0,
    (esiSummary.currIP || 0) + (esiSummary.currER || 0),
    '',
    ''
  ]);
  esiRows.push([
    '', '', '', '', 'Total Variance',
    esiSummary.rows.reduce((s, r) => s + ((r.currDays || 0) - (r.prevDays || 0)), 0),
    esiSummary.rows.reduce((s, r) => s + ((r.currWage || 0) - (r.prevWage || 0)), 0),
    esiSummary.ipDiff || 0,
    esiSummary.erDiff || 0,
    ((esiSummary.currIP || 0) + (esiSummary.currER || 0)) - ((esiSummary.prevIP || 0) + (esiSummary.prevER || 0)),
    '',
    ''
  ]);

  const wsESI = XLSX.utils.aoa_to_sheet(esiRows);
  wsESI['!cols'] = [
    { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 28 },
    { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 16 },
    { wch: 22 }, // Audit Status
    { wch: 45 }  // Audit Note
  ];
  applyMoMTableStyles(wsESI, esiHeaders.length, esiRows.length);

  // 3. Salary Sheet Construction
  const payHeaders = [
    'Month', 'Year', 'Emp ID', 'Employee Name', 'Designation',
    'Payable Days', 'Basic Pay', 'Gross Salary', 'Net Pay',
    'Audit Status', 'Audit Note'
  ];
  const payRows: any[][] = [payHeaders];
  const sortedPayRows = [...paySummary.rows].sort((a, b) => (a.empId || '').localeCompare(b.empId || '', undefined, { numeric: true, sensitivity: 'base' }));
  sortedPayRows.forEach(r => {
    payRows.push([
      prevMonthShort, prevYear, r.empId, r.name, r.designation,
      r.prevDays, r.prevBasic, r.prevGross, r.prevNet,
      '',
      ''
    ]);
    payRows.push([
      currMonthShort, currYear, r.empId, r.name, r.designation,
      r.currDays, r.currBasic, r.currGross, r.currNet,
      '',
      ''
    ]);
    payRows.push([
      '', '', '', 'Variance', '',
      calcDiff(r.currDays, r.prevDays),
      calcDiff(r.currBasic, r.prevBasic),
      calcDiff(r.currGross, r.prevGross),
      calcDiff(r.currNet, r.prevNet),
      formatPayStatus(r.status, r.alerts),
      formatAuditNote(r.alerts)
    ]);
  });

  payRows.push([
    '', '', '', `Total ${prevMonthShort} ${prevYear}`, '',
    paySummary.rows.reduce((s, r) => s + (r.prevDays || 0), 0),
    paySummary.rows.reduce((s, r) => s + (r.prevBasic || 0), 0),
    paySummary.prevGross || 0,
    paySummary.prevNet || 0,
    '',
    ''
  ]);
  payRows.push([
    '', '', '', `Total ${currMonthShort} ${currYear}`, '',
    paySummary.rows.reduce((s, r) => s + (r.currDays || 0), 0),
    paySummary.rows.reduce((s, r) => s + (r.currBasic || 0), 0),
    paySummary.currGross || 0,
    paySummary.currNet || 0,
    '',
    ''
  ]);
  payRows.push([
    '', '', '', 'Total Variance', '',
    paySummary.rows.reduce((s, r) => s + ((r.currDays || 0) - (r.prevDays || 0)), 0),
    paySummary.rows.reduce((s, r) => s + ((r.currBasic || 0) - (r.prevBasic || 0)), 0),
    paySummary.grossDiff || 0,
    paySummary.netDiff || 0,
    '',
    ''
  ]);

  const wsPay = XLSX.utils.aoa_to_sheet(payRows);
  wsPay['!cols'] = [
    { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 28 }, { wch: 20 },
    { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
    { wch: 22 }, // Audit Status
    { wch: 45 }  // Audit Note
  ];
  applyMoMTableStyles(wsPay, payHeaders.length, payRows.length);

  // Append sheets prioritizing the active tab
  if (activeTab === 'ECR') {
    XLSX.utils.book_append_sheet(wb, wsECR, 'ECR_MoM_Comparison');
    XLSX.utils.book_append_sheet(wb, wsESI, 'ESI_MoM_Comparison');
    XLSX.utils.book_append_sheet(wb, wsPay, 'Salary_MoM_Comparison');
  } else if (activeTab === 'ESI') {
    XLSX.utils.book_append_sheet(wb, wsESI, 'ESI_MoM_Comparison');
    XLSX.utils.book_append_sheet(wb, wsECR, 'ECR_MoM_Comparison');
    XLSX.utils.book_append_sheet(wb, wsPay, 'Salary_MoM_Comparison');
  } else {
    XLSX.utils.book_append_sheet(wb, wsPay, 'Salary_MoM_Comparison');
    XLSX.utils.book_append_sheet(wb, wsECR, 'ECR_MoM_Comparison');
    XLSX.utils.book_append_sheet(wb, wsESI, 'ESI_MoM_Comparison');
  }

  const fileName = getStandardFileName('MoM_Comparison_Audit', company || {} as any, currM, currYear);
  const subfolder = company ? `${company.establishmentName}___${company.id || ''}___AuditTrailReports` : undefined;
  return await generateExcelWorkbook(wb, fileName, subfolder);
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG CHANGE AUDIT TRAIL (Company Profile & Statutory Rules)
// ═══════════════════════════════════════════════════════════════════════════

export interface ConfigChangeDiff {
  category: 'Company Profile' | 'Statutory Configuration';
  field: string;
  fieldKey: string;
  oldValue: string;
  newValue: string;
}

export const COMPANY_PROFILE_FIELD_LABELS: Record<string, string> = {
  establishmentName: 'Establishment Name',
  tradeName: 'Trade / Brand Name',
  cin: 'CIN (Corporate Identity No)',
  lin: 'LIN (Labour Identification No)',
  pfCode: 'PF Establishment Code',
  esiCode: 'ESI Registration Code',
  gstNo: 'GSTIN',
  pan: 'PAN Number',
  tan: 'TAN Number',
  ptNo: 'PT Registration No',
  lwfRegNo: 'LWF Registration No',
  doorNo: 'Door / Flat No',
  buildingName: 'Building Name',
  street: 'Street / Road',
  locality: 'Locality',
  area: 'Area',
  city: 'City',
  state: 'State',
  pincode: 'PIN Code',
  mobile: 'Official Mobile Number',
  telephone: 'Telephone / Landline',
  email: 'Official Email Address',
  website: 'Website URL',
  natureOfBusiness: 'Nature of Business',
  allocatedDataSize: 'Allocated Employee Quota',
  dashboardPassword: 'Company Access Password',
  securityPin: 'Payroll Freeze Security PIN',
  smtpHost: 'SMTP Host',
  smtpPort: 'SMTP Port',
  smtpSecurity: 'SMTP Security Protocol',
  smtpUser: 'SMTP User',
  senderEmail: 'SMTP Sender Email',
  senderName: 'SMTP Sender Name',
  specialAllowance1Name: 'Special Allowance 1 Label',
  specialAllowance2Name: 'Special Allowance 2 Label',
  specialAllowance3Name: 'Special Allowance 3 Label',
  flashNews: 'Ticker Flash News',
  loginAlertMessage: 'Login Alert Message',
  loginAlertEnabled: 'Login Alert Enabled'
};

export const STATUTORY_CONFIG_FIELD_LABELS: Record<string, string> = {
  enablePF: 'Enable EPF Compliance',
  enableESI: 'Enable ESI Compliance',
  enableBonus: 'Enable Bonus Calculation',
  enableGratuity: 'Enable Gratuity Calculation',
  epfCeiling: 'EPF Wage Ceiling (₹)',
  epfCeiling1: 'EPF Baseline Ceiling (₹)',
  epfCeilingDate1: 'EPF Baseline Effective Date',
  epfCeiling2: 'EPF Revised Ceiling (₹)',
  epfCeilingDate2: 'EPF Revised Effective Date',
  epfEmployeeRate: 'EPF Employee Rate (%)',
  epfEmployerRate: 'EPF Employer Rate (%)',
  esiCeiling: 'ESI Wage Ceiling (₹)',
  esiCeiling1: 'ESI Baseline Ceiling (₹)',
  esiCeilingDate1: 'ESI Baseline Effective Date',
  esiCeiling2: 'ESI Revised Ceiling (₹)',
  esiCeilingDate2: 'ESI Revised Effective Date',
  esiEmployeeRate: 'ESI Employee Rate (%)',
  esiEmployerRate: 'ESI Employer Rate (%)',
  enableProfessionalTax: 'Enable Professional Tax (PT)',
  ptDeductionCycle: 'PT Deduction Cycle',
  ptSlabs: 'PT Slabs Configuration',
  enableLWF: 'Enable Labour Welfare Fund (LWF)',
  lwfDeductionCycle: 'LWF Deduction Cycle',
  lwfEmployeeContribution: 'LWF Employee Contribution (₹)',
  lwfEmployerContribution: 'LWF Employer Contribution (₹)',
  incomeTaxCalculationType: 'Income Tax Calculation Mode',
  bonusRate: 'Statutory Bonus Rate (%)',
  pfComplianceType: 'PF Compliance Type',
  enableHigherContribution: 'Enable Higher PF Contribution',
  higherContributionType: 'Higher PF Contribution Scope',
  higherContributionComponents: 'Higher Contribution Wage Components',
  leaveWagesComponents: 'Leave Wages Components',
  enableOT: 'Enable Overtime (OT)',
  otCalculationFactor: 'OT Multiplier Factor',
  otComponents: 'OT Wage Components',
  pfEsiCalculationBasis: 'PF & ESI Calculation Basis',
  pfOriginalWagesComponents: 'PF Original Wages Components',
  esiOriginalWagesComponents: 'ESI Original Wages Components',
  bonusWagesComponents: 'Bonus Wage Components',
  gratuityWagesComponents: 'Gratuity Wage Components',
  enableArrearSalary: 'Enable Arrear Salary',
  enableVPF: 'Enable Voluntary PF (VPF)',
  enableDynamicPaySheet: 'Enable Dynamic Pay Sheet',
  dynamicPaySheetColumns: 'Dynamic Pay Sheet Columns'
};

/**
 * Format any configuration value into a concise, human-readable string representation
 */
export const formatConfigValue = (val: any): string => {
  if (val === undefined || val === null || val === '') return '(Blank)';
  if (typeof val === 'boolean') return val ? 'Enabled' : 'Disabled';
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return '(None)';
    if (typeof val[0] === 'object') {
      return `${val.length} Slabs Configured`;
    }
    return val.join(', ');
  }
  if (typeof val === 'object') {
    // If it's a WageBasisComponents object (basic: true, da: true...)
    const activeKeys = Object.entries(val)
      .filter(([_, isTrue]) => !!isTrue)
      .map(([k]) => {
        if (k === 'basic') return 'Basic';
        if (k === 'da') return 'DA';
        if (k === 'retaining') return 'Retaining';
        if (k === 'hra') return 'HRA';
        if (k === 'conveyance') return 'Conveyance';
        if (k === 'washing') return 'Washing';
        if (k === 'attire') return 'Attire';
        if (k === 'special1') return 'Spl 1';
        if (k === 'special2') return 'Spl 2';
        if (k === 'special3') return 'Spl 3';
        return k;
      });
    return activeKeys.length > 0 ? activeKeys.join(', ') : '(None)';
  }
  return String(val).trim();
};

/**
 * Detect field-level differences between original and modified Company Profile
 */
export const getCompanyProfileDiffs = (
  oldProfile: Partial<CompanyProfile> | null | undefined,
  newProfile: Partial<CompanyProfile> | null | undefined
): ConfigChangeDiff[] => {
  if (!oldProfile || !newProfile) return [];
  const diffs: ConfigChangeDiff[] = [];

  const allKeys = Array.from(new Set([
    ...Object.keys(COMPANY_PROFILE_FIELD_LABELS),
    ...Object.keys(oldProfile),
    ...Object.keys(newProfile)
  ]));

  for (const key of allKeys) {
    // Skip internal/volatile keys
    if (['id', 'companySignature', 'isReadOnly'].includes(key)) continue;

    const oldRaw = (oldProfile as any)[key];
    const newRaw = (newProfile as any)[key];

    const oldStr = formatConfigValue(oldRaw);
    const newStr = formatConfigValue(newRaw);

    if (oldStr !== newStr) {
      const fieldLabel = COMPANY_PROFILE_FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      diffs.push({
        category: 'Company Profile',
        field: fieldLabel,
        fieldKey: key,
        oldValue: oldStr,
        newValue: newStr
      });
    }
  }

  return diffs;
};

/**
 * Detect field-level differences between original and modified Statutory Configuration
 */
export const getStatutoryConfigDiffs = (
  oldConfig: Partial<StatutoryConfig> | null | undefined,
  newConfig: Partial<StatutoryConfig> | null | undefined
): ConfigChangeDiff[] => {
  if (!oldConfig || !newConfig) return [];
  const diffs: ConfigChangeDiff[] = [];

  const allKeys = Array.from(new Set([
    ...Object.keys(STATUTORY_CONFIG_FIELD_LABELS),
    ...Object.keys(oldConfig),
    ...Object.keys(newConfig)
  ]));

  for (const key of allKeys) {
    const oldRaw = (oldConfig as any)[key];
    const newRaw = (newConfig as any)[key];

    const oldStr = formatConfigValue(oldRaw);
    const newStr = formatConfigValue(newRaw);

    if (oldStr !== newStr) {
      const fieldLabel = STATUTORY_CONFIG_FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      diffs.push({
        category: 'Statutory Configuration',
        field: fieldLabel,
        fieldKey: key,
        oldValue: oldStr,
        newValue: newStr
      });
    }
  }

  return diffs;
};

/**
 * Persist config change audit log entries to LocalStorage and Electron SQLite DB
 */
export const logConfigChanges = async (
  logs: ConfigChangeLog[],
  companyId: string = 'default'
): Promise<void> => {
  if (!logs || logs.length === 0) return;

  try {
    // 1. Company-specific log key
    const scopedKey = companyId === 'default' ? 'app_config_change_audit_trail' : `app_config_change_audit_trail_${companyId}`;
    const existingRaw = localStorage.getItem(scopedKey);
    let existingLogs: ConfigChangeLog[] = [];
    if (existingRaw) {
      try {
        existingLogs = JSON.parse(existingRaw);
      } catch (e) {
        existingLogs = [];
      }
    }
    const updatedScoped = [...logs, ...existingLogs];
    localStorage.setItem(scopedKey, JSON.stringify(updatedScoped));

    if (window.electronAPI?.dbSet) {
      await window.electronAPI.dbSet(scopedKey, updatedScoped).catch(() => {});
    }

    // 2. Global unified log key for MIS multi-company view
    if (companyId !== 'default') {
      const globalKey = 'app_config_change_audit_trail';
      const globalRaw = localStorage.getItem(globalKey);
      let globalLogs: ConfigChangeLog[] = [];
      if (globalRaw) {
        try {
          globalLogs = JSON.parse(globalRaw);
        } catch (e) {
          globalLogs = [];
        }
      }
      const updatedGlobal = [...logs, ...globalLogs];
      localStorage.setItem(globalKey, JSON.stringify(updatedGlobal));
      if (window.electronAPI?.dbSetGlobal) {
        await window.electronAPI.dbSetGlobal(globalKey, updatedGlobal).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Failed to log config changes:', err);
  }
};

/**
 * Retrieve configuration change audit logs from LocalStorage / Electron DB
 */
export const getConfigChangeLogs = async (
  companyId?: string
): Promise<ConfigChangeLog[]> => {
  try {
    let logs: ConfigChangeLog[] = [];
    const key = (companyId && companyId !== 'default' && companyId !== 'all')
      ? `app_config_change_audit_trail_${companyId}`
      : 'app_config_change_audit_trail';

    // Try Electron DB first
    if (window.electronAPI?.dbGet) {
      try {
        const res = await window.electronAPI.dbGet(key);
        if (res && res.success && res.data) {
          logs = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        }
      } catch (e) {}
    }

    // Fallback to localStorage
    if (!logs || logs.length === 0) {
      const raw = localStorage.getItem(key);
      if (raw) {
        logs = JSON.parse(raw);
      }
    }

    // Fallback to global logs filtered by company if scoped was empty
    if ((!logs || logs.length === 0) && companyId && companyId !== 'default' && companyId !== 'all') {
      const globalRaw = localStorage.getItem('app_config_change_audit_trail');
      if (globalRaw) {
        const parsed = JSON.parse(globalRaw);
        if (Array.isArray(parsed)) {
          logs = parsed.filter(l => l.companyId === companyId);
        }
      }
    }

    if (!Array.isArray(logs)) return [];

    // Sort newest first
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    console.error('Failed to load config change logs:', err);
    return [];
  }
};

/**
 * Export Config Change Audit Trail to an Excel Workbook formatted with Navy Blue header
 */
export const exportConfigChangeExcel = async (
  logs: ConfigChangeLog[],
  company?: CompanyProfile
): Promise<string | null> => {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Sl No',
    'Date & Time',
    'Category',
    'Configuration Field',
    'Previous Value',
    'New Value',
    'Changed By',
    'Approved By (Admin OTP)',
    'Status'
  ];

  const rows: any[][] = [];

  // Title rows
  const companyTitle = company?.establishmentName || 'COMPANY CONFIGURATION';
  rows.push([companyTitle.toUpperCase()]);
  rows.push(['CONFIG CHANGE AUDIT TRAIL (MIS REPORT)']);
  rows.push([`Generated On: ${new Date().toLocaleString('en-IN')} | Total Records: ${logs.length}`]);
  rows.push([]); // blank separator
  rows.push(headers);

  // Data rows
  logs.forEach((log, index) => {
    const formattedDate = new Date(log.timestamp).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    rows.push([
      index + 1,
      formattedDate,
      log.category,
      log.field,
      log.oldValue,
      log.newValue,
      log.changedBy,
      log.approvedBy,
      log.otpVerified ? 'Approved & Verified' : 'Pending'
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 8 },  // Sl No
    { wch: 22 }, // Date & Time
    { wch: 26 }, // Category
    { wch: 34 }, // Field
    { wch: 28 }, // Old Value
    { wch: 28 }, // New Value
    { wch: 24 }, // Changed By
    { wch: 36 }, // Approved By
    { wch: 20 }  // Status
  ];

  // Apply Styles
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:I1');
  const headerRowIdx = 4; // 0-indexed: row 5 is headers

  for (let r = 0; r <= range.e.r; r++) {
    for (let c = 0; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellRef];
      if (!cell) continue;

      if (r === 0) {
        // Company Name Banner
        cell.s = {
          font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: '002060' } },
          alignment: { horizontal: 'left', vertical: 'center' }
        };
      } else if (r === 1) {
        // Report Title
        cell.s = {
          font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: '1E293B' } },
          alignment: { horizontal: 'left', vertical: 'center' }
        };
      } else if (r === 2) {
        // Meta Subtitle
        cell.s = {
          font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '64748B' } },
          alignment: { horizontal: 'left', vertical: 'center' }
        };
      } else if (r === headerRowIdx) {
        // Header Row: Navy Blue #002060, Bold White Text
        cell.s = {
          fill: { fgColor: { rgb: '002060' }, patternType: 'solid' },
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: {
            horizontal: c === 0 || c === 1 || c === 8 ? 'center' : 'left',
            vertical: 'center',
            wrapText: true
          },
          border: {
            top: { style: 'thin', color: { rgb: '001A4E' } },
            bottom: { style: 'thin', color: { rgb: '001A4E' } },
            left: { style: 'thin', color: { rgb: '001A4E' } },
            right: { style: 'thin', color: { rgb: '001A4E' } }
          }
        };
      } else if (r > headerRowIdx) {
        // Data Rows: Alternating zebra styling and clear borders
        const isEven = (r - headerRowIdx) % 2 === 0;
        const bgRgb = isEven ? 'F8FAFC' : 'FFFFFF';

        let textColor = '0F172A';
        let isBold = false;

        if (c === 4) {
          // Old Value (Muted reddish)
          textColor = '991B1B';
        } else if (c === 5) {
          // New Value (Vibrant Greenish)
          textColor = '166534';
          isBold = true;
        } else if (c === 8) {
          // Status (Verified Emerald)
          textColor = '047857';
          isBold = true;
        } else if (c === 3) {
          // Field
          isBold = true;
        }

        cell.s = {
          fill: { fgColor: { rgb: bgRgb }, patternType: 'solid' },
          font: { name: 'Calibri', sz: 10, bold: isBold, color: { rgb: textColor } },
          alignment: {
            horizontal: c === 0 || c === 1 || c === 8 ? 'center' : 'left',
            vertical: 'center',
            wrapText: true
          },
          border: {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } }
          }
        };
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Config_Change_Log');

  const now = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentMonth = months[now.getMonth()];
  const currentYear = now.getFullYear();
  const fileName = getStandardFileName('Config_Change_Audit_Trail', company || {} as any, currentMonth, currentYear);
  const subfolder = company ? `${company.establishmentName}___${company.id || ''}___AuditTrailReports` : undefined;

  return await generateExcelWorkbook(wb, fileName, subfolder);
};
