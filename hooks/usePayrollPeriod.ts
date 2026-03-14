
import { useState } from 'react';

const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const usePayrollPeriod = () => {
  const getMonthValue = (m: string | null | undefined, y: number | null | undefined) => {
    if (!m || !y) return 0;
    const idx = monthsArr.indexOf(String(m).trim());
    if (idx === -1) return 0;
    return (Number(y) * 12) + idx;
  };

  const getActivePeriod = () => {
    try {
      const historyData = localStorage.getItem('app_payroll_history');
      const history = historyData ? JSON.parse(historyData) : [];

      let lastLockedVal = getMonthValue('March', 2025); // Baseline system start
      
      const finalized = Array.isArray(history) ? history.filter((h: any) => h.status === 'Finalized') : [];
      
      if (finalized.length > 0) {
        finalized.forEach((h: any) => {
          const val = getMonthValue(h.month, h.year);
          if (val > lastLockedVal) lastLockedVal = val;
        });
      }

      // The period that is currently open for processing is LFM + 1
      const nextVal = lastLockedVal + 1;
      return { 
        month: monthsArr[nextVal % 12], 
        year: Math.floor(nextVal / 12),
        value: nextVal,
        lastLockedValue: lastLockedVal
      };
    } catch (e) {
      return { month: 'April', year: 2025, value: getMonthValue('April', 2025), lastLockedValue: getMonthValue('March', 2025) };
    }
  };

  const activePeriod = getActivePeriod();
  const [globalMonth, setGlobalMonth] = useState<string>(activePeriod.month);
  const [globalYear, setGlobalYear] = useState<number>(activePeriod.year);

  return { 
    globalMonth, setGlobalMonth, 
    globalYear, setGlobalYear, 
    activePeriod,
    getMonthValue
  };
};
