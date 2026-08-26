import { useState, useEffect, useRef } from 'react';

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

  const hasInitializedRef = useRef<string>('');

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

        const getMonthValue = (m: string | null | undefined, y: number | null | undefined) => {
          if (!m || !y) return 0;
          const idx = monthsArr.findIndex(item => item.toLowerCase() === String(m).trim().toLowerCase());
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

        // Set latest frozen period
        if (Array.isArray(history) && history.length > 0) {
          const frozen = history.filter((h: any) => h.status === 'Finalized');
          if (frozen.length > 0) {
              let latest = frozen[0];
              let maxVal = getMonthValue(latest.month, latest.year);
              frozen.forEach((h: any) => {
                  const val = getMonthValue(h.month, h.year);
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

        // Only auto-set globalMonth & globalYear on initial mount or when company/FY changes
        const initKey = `${activeCompanyId}_${activeFinancialYear}`;
        if (hasInitializedRef.current !== initKey) {
          hasInitializedRef.current = initKey;

          // Target period is the NEXT unfinalized month after the last finalized period
          const nextVal = lastLockedVal > getMonthValue('March', baseYear) ? lastLockedVal + 1 : getMonthValue('April', baseYear);
          setGlobalMonth(monthsArr[nextVal % 12]);
          setGlobalYear(Math.floor(nextVal / 12));
        }

      } catch (e) {
        console.error("Error determining default period:", e);
        if (!hasInitializedRef.current) {
          setGlobalMonth('April');
          setGlobalYear(baseYear);
        }
      }
    };

    fetchPeriod();
  }, [activeCompanyId, activeFinancialYear, payrollHistory]);

  return { globalMonth, setGlobalMonth, globalYear, setGlobalYear, latestFrozenPeriod };
};
