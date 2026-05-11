
import { useState, useEffect, useMemo } from 'react';

const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const usePayrollPeriod = (activeCompanyId: string = 'default') => {
  const getCKey = (key: string) => activeCompanyId === 'default' ? key : `${activeCompanyId}_${key}`;

  const getDefaultPeriod = () => {
    try {
      const historyData = localStorage.getItem(getCKey('app_payroll_history'));
      const attendanceData = localStorage.getItem(getCKey('app_attendance'));

      const history = historyData ? JSON.parse(historyData) : [];
      const attendance = attendanceData ? JSON.parse(attendanceData) : [];

      const getMonthValue = (m: string | null | undefined, y: number | null | undefined) => {
        if (!m || !y) return 0;
        const idx = monthsArr.indexOf(String(m).trim());
        if (idx === -1) return 0;
        return (Number(y) * 12) + idx;
      };

      let lastLockedVal = getMonthValue('March', 2025);
      if (Array.isArray(history) && history.length > 0) {
        history.filter((h: any) => h.status === 'Finalized').forEach((h: any) => {
          const val = getMonthValue(h.month, h.year);
          if (val > lastLockedVal) lastLockedVal = val;
        });
      }

      let latestDraftVal = -1;
      let latestDraftPeriod = null;

      if (Array.isArray(attendance) && attendance.length > 0) {
        attendance.forEach((a: any) => {
          const val = getMonthValue(a.month, a.year);
          if (val > lastLockedVal) {
            const hasData = (a.presentDays || 0) > 0 || (a.earnedLeave || 0) > 0 || (a.sickLeave || 0) > 0 || (a.casualLeave || 0) > 0 || (a.lopDays || 0) > 0 || (a.encashedDays || 0) > 0;
            const isFinalized = history.some((h: any) => h.month === a.month && h.year === a.year && h.status === 'Finalized');
            if (hasData && !isFinalized) {
              if (val > latestDraftVal) {
                latestDraftVal = val;
                latestDraftPeriod = { month: a.month, year: a.year };
              }
            }
          }
        });
      }

      if (latestDraftPeriod) return latestDraftPeriod;
      
      // V03.01.04: Default to last frozen month if available, else standard baseline
      if (lastLockedVal > getMonthValue('March', 2025)) {
        return { month: monthsArr[lastLockedVal % 12], year: Math.floor(lastLockedVal / 12) };
      }
      
      const nextVal = lastLockedVal + 1;
      return { month: monthsArr[nextVal % 12], year: Math.floor(nextVal / 12) };
    } catch (e) {
      console.error("Error determining default period:", e);
      return { month: 'April', year: 2025 };
    }
  };

  const initialPeriod = getDefaultPeriod();
  const [globalMonth, setGlobalMonth] = useState<string>(initialPeriod.month);
  const [globalYear, setGlobalYear] = useState<number>(initialPeriod.year);

  // Sync with activeCompanyId changes
  useEffect(() => {
    const period = getDefaultPeriod();
    setGlobalMonth(period.month);
    setGlobalYear(period.year);
  }, [activeCompanyId]);

  // Helper to find the absolute latest frozen period regardless of the initial period logic
  const latestFrozenPeriod = useMemo(() => {
    try {
      const historyData = localStorage.getItem(getCKey('app_payroll_history'));
      const history = historyData ? JSON.parse(historyData) : [];
      if (Array.isArray(history) && history.length > 0) {
        const frozen = history.filter((h: any) => h.status === 'Finalized');
        if (frozen.length > 0) {
            let latest = frozen[0];
            let maxVal = (latest.year * 12) + monthsArr.indexOf(latest.month);
            frozen.forEach((h: any) => {
                const val = (h.year * 12) + monthsArr.indexOf(h.month);
                if (val > maxVal) {
                    maxVal = val;
                    latest = h;
                }
            });
            return { month: latest.month, year: latest.year };
        }
      }
    } catch (e) {
      console.error("Error getting latest frozen period:", e);
    }
    return null;
  }, [activeCompanyId]);

  return { globalMonth, setGlobalMonth, globalYear, setGlobalYear, latestFrozenPeriod };
};

