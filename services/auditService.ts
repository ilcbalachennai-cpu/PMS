import { PayrollResult, Employee, StatutoryConfig, CompanyProfile } from '../types';
import { generateTemplateWorkbook, getStandardFileName } from './reportService';

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
const computeECRFigures = (r: PayrollResult | undefined, emp: Employee | undefined) => {
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

  // EPF Wages back-calculated from EE normal PF (÷ 12%)
  const epfWagesRaw = baseEE > 0 ? Math.round(baseEE / 0.12) : 0;
  const epfWages = Math.min(epfWagesRaw, grossWages > 0 ? grossWages : epfWagesRaw);

  // EDLI Wages: capped at 15000 max & EDLI Contribution (0.50% A/c 21)
  const edliWages = baseEE > 0 ? Math.min(15000, epfWages, grossWages > 0 ? grossWages : 15000) : 0;
  const edliContrib = Math.round(edliWages * 0.005);

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
      fallbackEPSWage = isHigherPension ? epfWages : Math.min(15000, epfWages);
    }
    erEPS = (!isNonContributing && isEPSEligible) ? Math.round(fallbackEPSWage * 0.0833) : 0;
    erEPF = isNonContributing ? 0 : Math.max(0, baseEE - erEPS);
  }

  // EPS Wages
  let epsWages = 0;
  if (erEPS > 0) {
    const isHigherPension = emp?.pfHigherPension?.isHigherPensionOpted === 'Yes';
    epsWages = isHigherPension ? epfWages : Math.min(15000, epfWages);
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
  prevPeriod: string
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

    const currFig = computeECRFigures(currR, emp);
    const prevFig = computeECRFigures(prevR, emp);

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

  // Sort: alerts first, then name
  rows.sort((a, b) => {
    if (a.alerts.length > 0 && b.alerts.length === 0) return -1;
    if (a.alerts.length === 0 && b.alerts.length > 0) return 1;
    return a.name.localeCompare(b.name);
  });

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

    const prevWage = Math.round(prevR?.earnings?.total || 0);
    const currWage = Math.round(currR?.earnings?.total || 0);

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
      if (currWage > ceiling) {
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
      if (prevWage > ceiling && currWage <= ceiling) {
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

  rows.sort((a, b) => {
    if (a.alerts.length > 0 && b.alerts.length === 0) return -1;
    if (a.alerts.length === 0 && b.alerts.length > 0) return 1;
    return a.name.localeCompare(b.name);
  });

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

  rows.sort((a, b) => {
    if (a.alerts.length > 0 && b.alerts.length === 0) return -1;
    if (a.alerts.length === 0 && b.alerts.length > 0) return 1;
    return a.name.localeCompare(b.name);
  });

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
 * Export ECR Audit to Excel
 */
export const exportECRAuditExcel = async (
  summary: ECRAuditSummary,
  company?: CompanyProfile
): Promise<string | null> => {
  const XLSX = await import('xlsx');
  const headers = [
    'Emp ID', 'UAN', 'Employee Name',
    `${summary.prevPeriod} EPF Wages`, `${summary.currPeriod} EPF Wages`,
    `${summary.prevPeriod} EPS Wages`, `${summary.currPeriod} EPS Wages`,
    `${summary.prevPeriod} NCP Days`, `${summary.currPeriod} NCP Days`, 'NCP Diff',
    `${summary.prevPeriod} EDLI Wages`, `${summary.currPeriod} EDLI Wages`,
    `${summary.prevPeriod} EE PF`, `${summary.currPeriod} EE PF`, 'EE PF Diff',
    `${summary.prevPeriod} ER EPS`, `${summary.currPeriod} ER EPS`, 'ER EPS Diff',
    `${summary.prevPeriod} ER EPF`, `${summary.currPeriod} ER EPF`, 'ER EPF Diff',
    `${summary.prevPeriod} EDLI (0.5%)`, `${summary.currPeriod} EDLI (0.5%)`, 'EDLI Diff',
    `${summary.prevPeriod} Total Contrib`, `${summary.currPeriod} Total Contrib`, 'Total Diff',
    'Audit Status', 'Audit Notes / Alerts'
  ];

  const dataRows = summary.rows.map(r => [
    r.empId, r.uan, r.name,
    r.prevEPFWage, r.currEPFWage,
    r.prevEPSWage, r.currEPSWage,
    r.prevNCPDays, r.currNCPDays, r.currNCPDays - r.prevNCPDays,
    r.prevEDLIWage, r.currEDLIWage,
    r.prevEEPF, r.currEEPF, r.currEEPF - r.prevEEPF,
    r.prevEREPS, r.currEREPS, r.currEREPS - r.prevEREPS,
    r.prevEREPF, r.currEREPF, r.currEREPF - r.prevEREPF,
    r.prevEDLI, r.currEDLI, r.currEDLI - r.prevEDLI,
    r.prevTotalContrib, r.currTotalContrib, r.currTotalContrib - r.prevTotalContrib,
    r.status, r.alerts.join('; ')
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ECR_Audit');

  const fileName = getStandardFileName('ECR_Audit_Variance', company || {} as any, summary.currPeriod.split(' ')[0], Number(summary.currPeriod.split(' ')[1]) || 2026);
  return await generateTemplateWorkbook(wb, fileName, company?.establishmentName);
};

/**
 * Export ESI Audit to Excel
 */
export const exportESIAuditExcel = async (
  summary: ESIAuditSummary,
  company?: CompanyProfile
): Promise<string | null> => {
  const XLSX = await import('xlsx');
  const headers = [
    'Emp ID', 'ESI Number', 'Employee Name',
    `${summary.prevPeriod} Days`, `${summary.currPeriod} Days`,
    `${summary.prevPeriod} Wages`, `${summary.currPeriod} Wages`,
    `${summary.prevPeriod} IP Share`, `${summary.currPeriod} IP Share`, 'IP Diff',
    `${summary.prevPeriod} ER Share`, `${summary.currPeriod} ER Share`, 'ER Diff',
    'Audit Status', 'Audit Notes / Alerts'
  ];

  const dataRows = summary.rows.map(r => [
    r.empId, r.esiNo, r.name,
    r.prevDays, r.currDays,
    r.prevWage, r.currWage,
    r.prevIP, r.currIP, r.currIP - r.prevIP,
    r.prevER, r.currER, r.currER - r.prevER,
    r.status, r.alerts.join('; ')
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ESI_Audit');

  const fileName = getStandardFileName('ESI_Audit_Variance', company || {} as any, summary.currPeriod.split(' ')[0], Number(summary.currPeriod.split(' ')[1]) || 2026);
  return await generateTemplateWorkbook(wb, fileName, company?.establishmentName);
};

/**
 * Export Pay Audit to Excel
 */
export const exportPayAuditExcel = async (
  summary: PayAuditSummary,
  company?: CompanyProfile
): Promise<string | null> => {
  const XLSX = await import('xlsx');
  const headers = [
    'Emp ID', 'Employee Name', 'Designation',
    `${summary.prevPeriod} Days`, `${summary.currPeriod} Days`,
    `${summary.prevPeriod} Basic`, `${summary.currPeriod} Basic`, 'Basic Diff',
    `${summary.prevPeriod} Gross`, `${summary.currPeriod} Gross`, 'Gross Diff', 'Gross % Shift',
    `${summary.prevPeriod} Net Pay`, `${summary.currPeriod} Net Pay`, 'Net Diff',
    'Audit Status', 'Audit Notes / Alerts'
  ];

  const dataRows = summary.rows.map(r => [
    r.empId, r.name, r.designation,
    r.prevDays, r.currDays,
    r.prevBasic, r.currBasic, r.basicDiff,
    r.prevGross, r.currGross, r.grossDiff, `${r.grossPercent}%`,
    r.prevNet, r.currNet, r.netDiff,
    r.status, r.alerts.join('; ')
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pay_Audit');

  const fileName = getStandardFileName('Employee_Pay_Audit', company || {} as any, summary.currPeriod.split(' ')[0], Number(summary.currPeriod.split(' ')[1]) || 2026);
  return await generateTemplateWorkbook(wb, fileName, company?.establishmentName);
};
