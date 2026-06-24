
import { useState, useEffect } from 'react';

const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const usePayrollPeriod = (activeCompanyId: string = 'default', activeFinancialYear?: string, payrollHistory?: any[]) => {
  const getCKey = (key: string) => {
    if (activeCompanyId === 'default') return key;
    const transactionalKeys = [
      'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers', 
      'app_payroll_history', 'app_fines', 'app_arrear_history', 'app_ot_records'
    ];
    if (activeFinancialYear && transactionalKeys.includes(key)) {
      return `${key}_${activeFinancialYear}_${activeCompanyId}`;
    }
    return `${activeCompanyId}_${key}`;
  };

  const [globalMonth, setGlobalMonth] = useState<string>('January');
  const [globalYear, setGlobalYear] = useState<number>(2026);
  const [latestFrozenPeriod, setLatestFrozenPeriod] = useState<{ month: string, year: number } | null>(null);

  useEffect(() => {
    const fetchPeriod = async () => {
      let baseYear = 2025;
      if (activeFinancialYear) {
        const match = activeFinancialYear.match(/FY(\d{2})-(\d{2})/);
        if (match) {
          baseYear = 2000 + parseInt(match[1]);
        }
      }
      try {
        let history: any[] = [];
        let attendance: any[] = [];

        if (payrollHistory && payrollHistory.length > 0) {
          history = payrollHistory;
        } else if (window.electronAPI) {
          const historyRes = await window.electronAPI.dbGet(getCKey('app_payroll_history'));
          if (historyRes.success && historyRes.data) {
            history = typeof historyRes.data === 'string' ? JSON.parse(historyRes.data) : historyRes.data;
          }
        } else {
          // Fallback to localStorage
          const historyData = localStorage.getItem(getCKey('app_payroll_history'));
          history = historyData ? JSON.parse(historyData) : [];
        }

        if (window.electronAPI) {
          const attendanceRes = await window.electronAPI.dbGet(getCKey('app_attendance'));
          if (attendanceRes.success && attendanceRes.data) {
            attendance = typeof attendanceRes.data === 'string' ? JSON.parse(attendanceRes.data) : attendanceRes.data;
          }
        } else {
          // Fallback to localStorage
          const attendanceData = localStorage.getItem(getCKey('app_attendance'));
          attendance = attendanceData ? JSON.parse(attendanceData) : [];
        }

        const getMonthValue = (m: string | null | undefined, y: number | null | undefined) => {
          if (!m || !y) return 0;
          const idx = monthsArr.indexOf(String(m).trim());
          if (idx === -1) return 0;
          return (Number(y) * 12) + idx;
        };

        let lastLockedVal = getMonthValue('March', baseYear);
        if (Array.isArray(history) && history.length > 0) {
          history.filter((h: any) => h.status === 'Finalized').forEach((h: any) => {
            const val = getMonthValue(h.month, h.year);
            if (val > lastLockedVal) lastLockedVal = val;
          });
        }

        let latestDraftVal = -1;
        let latestDraftPeriod: any = null;

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

        // Set latest frozen period
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
              setLatestFrozenPeriod({ month: latest.month, year: latest.year });
          } else {
              setLatestFrozenPeriod(null);
          }
        } else {
          setLatestFrozenPeriod(null);
        }

        if (latestDraftPeriod) {
          setGlobalMonth(latestDraftPeriod.month);
          setGlobalYear(latestDraftPeriod.year);
          return;
        }

        // V03.01.04: Default to last frozen month if available, else standard baseline
        if (lastLockedVal > getMonthValue('March', baseYear)) {
          setGlobalMonth(monthsArr[lastLockedVal % 12]);
          setGlobalYear(Math.floor(lastLockedVal / 12));
          return;
        }

        const nextVal = lastLockedVal + 1;
        setGlobalMonth(monthsArr[nextVal % 12]);
        setGlobalYear(Math.floor(nextVal / 12));

      } catch (e) {
        console.error("Error determining default period:", e);
        setGlobalMonth('April');
        setGlobalYear(baseYear);
      }
    };

    fetchPeriod();
  }, [activeCompanyId, activeFinancialYear, payrollHistory]);

  return { globalMonth, setGlobalMonth, globalYear, setGlobalYear, latestFrozenPeriod };
};

