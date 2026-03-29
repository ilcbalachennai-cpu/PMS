
import { useState } from 'react';

const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const usePayrollPeriod = () => {
  const getDefaultPeriod = () => {
    try {
      const historyData = localStorage.getItem('app_payroll_history');
      const attendanceData = localStorage.getItem('app_attendance');

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

  return { globalMonth, setGlobalMonth, globalYear, setGlobalYear };
};
