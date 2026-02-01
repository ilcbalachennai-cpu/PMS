
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PayrollResult, Employee, CompanyProfile, StatutoryConfig, Attendance, LeaveLedger, AdvanceLedger } from '../types';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const formatDateInd = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join('-');
};

export const numberToWords = (num: number): string => {
    const a = ['','One ','Two ','Three ','Four ','Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

    if (!num) return 'Zero';
    const numStr = Math.floor(num).toString();
    if (numStr.length > 9) return 'Overflow';
    
    // Regex for Indian Numbering System: 00,00,00,000
    // Groups: Crore (2), Lakh (2), Thousand (2), Hundred (1), Unit (2)
    const n = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return ""; 
    let str = '';
    str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
    str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
    str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
    str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
    str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) : '';
    return str.trim();
};

export const generateExcelReport = (data: any[], sheetName: string, fileName: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const generatePDFTableReport = (
  title: string, 
  headers: string[], 
  data: any[][], 
  fileName: string, 
  orientation: 'p'|'l', 
  footer?: string, 
  companyProfile?: CompanyProfile
) => {
  const doc = new jsPDF({ orientation });
  doc.setFontSize(14);
  if (companyProfile) {
      doc.text(companyProfile.establishmentName, 14, 10);
  }
  doc.setFontSize(10);
  doc.text(title, 14, 16);
  
  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 20,
    theme: 'grid',
    styles: { fontSize: 8 },
  });

  if (footer) {
    doc.text(footer, 14, doc.internal.pageSize.height - 10);
  }
  
  doc.save(`${fileName}.pdf`);
};

export const generatePaySlipsPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
  const doc = new jsPDF();
  let y = 10;
  
  results.forEach((r, i) => {
    if (i > 0) doc.addPage();
    const emp = employees.find(e => e.id === r.employeeId);
    doc.setFontSize(16);
    doc.text(companyProfile.establishmentName || 'Company Name', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Payslip for ${month} ${year}`, 105, 22, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Employee: ${emp?.name} (${r.employeeId})`, 14, 35);
    doc.text(`Designation: ${emp?.designation}`, 14, 40);
    doc.text(`Department: ${emp?.division || emp?.department}`, 14, 45);
    doc.text(`Net Pay: ${r.netPay}`, 14, 55);
    
    // Add summary table
    autoTable(doc, {
        startY: 60,
        head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
        body: [
            ['Basic', r.earnings.basic, 'EPF', r.deductions.epf],
            ['DA', r.earnings.da, 'ESI', r.deductions.esi],
            ['HRA', r.earnings.hra, 'PT', r.deductions.pt],
            ['Allowances', r.earnings.total - (r.earnings.basic + r.earnings.da + r.earnings.hra), 'TDS', r.deductions.it],
            ['', '', 'Other', (r.deductions.total - (r.deductions.epf + r.deductions.esi + r.deductions.pt + r.deductions.it))],
            ['Total Earnings', r.earnings.total, 'Total Deductions', r.deductions.total]
        ],
        theme: 'grid'
    });
    
    doc.text(`Net Payable: ${Math.round(r.netPay)} (${numberToWords(Math.round(r.netPay))} Only)`, 14, (doc as any).lastAutoTable.finalY + 10);
  });
  
  doc.save(`Payslips_${month}_${year}.pdf`);
};

export const generateSimplePaySheetPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Gross', 'Deductions', 'Net'];
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [r.employeeId, emp?.name, r.earnings.total, r.deductions.total, r.netPay];
    });
    generatePDFTableReport(`Pay Sheet ${month} ${year}`, headers, data, `PaySheet_${month}_${year}`, 'l', undefined, companyProfile);
};

export const generateLeaveLedgerReport = (employees: Employee[], ledgers: LeaveLedger[], attendances: Attendance[], month: string, year: number, type: 'BC'|'AC', companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'EL Open', 'EL Credit', 'EL Used', 'EL Bal', 'SL Bal', 'CL Bal'];
    const data = employees.map(e => {
        const l = ledgers.find(led => led.employeeId === e.id);
        if (!l) return [];
        return [e.id, e.name, l.el.opening, l.el.eligible, l.el.availed, l.el.balance, l.sl.balance, l.cl.balance];
    }).filter(d => d.length > 0);
    generatePDFTableReport(`Leave Ledger (${type}) ${month} ${year}`, headers, data, `LeaveLedger_${type}_${month}_${year}`, 'l', undefined, companyProfile);
};

export const generateAdvanceShortfallReport = (data: any[], month: string, year: number, format: 'PDF'|'Excel', companyProfile: CompanyProfile) => {
    if (format === 'Excel') {
        generateExcelReport(data, 'Shortfall', `Advance_Shortfall_${month}_${year}`);
    } else {
        const headers = ['ID', 'Name', 'Target', 'Recovered', 'Shortfall'];
        const rows = data.map(d => [d.id, d.name, d.target, d.recovered, d.shortfall]);
        generatePDFTableReport(`Advance Shortfall ${month} ${year}`, headers, rows, `Advance_Shortfall_${month}_${year}`, 'p', undefined, companyProfile);
    }
};

export const generatePFECR = (records: PayrollResult[], employees: Employee[], format: 'Excel'|'Text', fileName: string) => {
    if (format === 'Excel') {
        const data = records.map(r => ({ ...r, name: employees.find(e => e.id === r.employeeId)?.name }));
        generateExcelReport(data, 'ECR', fileName);
    } else {
        const textContent = records.map(r => {
            const emp = employees.find(e => e.id === r.employeeId);
            // Example UAN#MEMBERID#GROSS#EPF#EPS#EDLI#EE_SHARE#ER_SHARE_EPS#ER_SHARE_EPF#NCP#REFUND
            return `${emp?.uanc}#${emp?.pfNumber}#${r.earnings.total}#${r.earnings.basic}#${r.earnings.basic}#${r.earnings.basic}#${r.deductions.epf}#${r.employerContributions.eps}#${r.employerContributions.epf}#${r.daysInMonth - r.payableDays}#0`;
        }).join('\n');
        
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.txt`;
        a.click();
    }
};

export const generateESIReturn = (
  records: PayrollResult[],
  employees: Employee[],
  format: 'Excel' | 'PDF',
  fileName: string,
  companyProfile: CompanyProfile
) => {
    if (format === 'Excel') {
        const data = records.map(r => {
            const emp = employees.find(e => e.id === r.employeeId);
            let reasonCode = 0;
            let dolStr = '';
            if (emp?.dol) {
                const dolDate = new Date(emp.dol);
                const monthIdx = MONTHS.indexOf(r.month);
                if (dolDate.getMonth() === monthIdx && dolDate.getFullYear() === r.year) {
                    reasonCode = 2;
                    dolStr = formatDateInd(emp.dol);
                }
            }
            const wageA = (r.earnings.basic || 0) + (r.earnings.da || 0) + (r.earnings.retainingAllowance || 0);
            const gross = r.earnings.total || 0;
            const wageC = gross - wageA;
            let wageD = 0;
            if (gross > 0) {
                const allowancePercentage = wageC / gross;
                if (allowancePercentage > 0.50) {
                    const fiftyPercentOfGross = Math.round(gross * 0.50);
                    wageD = wageC - fiftyPercentOfGross;
                }
            }
            const esiCodeWages = Math.round(wageA + wageD);

            return {
                'IP Number': emp?.esiNumber || '',
                'IP Name': emp?.name || '',
                'No. Of Days': r.payableDays,
                'ESI Wages': esiCodeWages,
                'Reason': reasonCode,
                'DOL': dolStr
            };
        });
        generateExcelReport(data, 'Sheet1', fileName);
    } else {
        const data = records.map(r => {
            const emp = employees.find(e => e.id === r.employeeId);
            return {
                'IP Number': emp?.esiNumber,
                'Name': emp?.name,
                'Days': r.payableDays,
                'Wages': r.earnings.total, 
                'EE Contribution': r.deductions.esi,
                'ER Contribution': r.employerContributions.esi
            };
        });
        const headers = ['IP No', 'Name', 'Days', 'Wages', 'EE Share', 'ER Share'];
        const rows = data.map(d => Object.values(d));
        generatePDFTableReport('ESI Monthly Contribution', headers, rows as any[][], fileName, 'p', undefined, companyProfile);
    }
};

export const generatePTReport = (records: PayrollResult[], employees: Employee[], fileName: string, companyProfile: CompanyProfile) => {
    const data = records.map(r => ({ 
        id: r.employeeId, 
        name: employees.find(e => e.id === r.employeeId)?.name, 
        pt: r.deductions.pt 
    })).filter(r => r.pt > 0);
    generateExcelReport(data, 'PT Report', fileName);
};

export const generateTDSReport = (records: PayrollResult[], employees: Employee[], fileName: string, companyProfile: CompanyProfile) => {
    const data = records.map(r => ({ 
        id: r.employeeId, 
        name: employees.find(e => e.id === r.employeeId)?.name, 
        tds: r.deductions.it 
    })).filter(r => r.tds > 0);
    generateExcelReport(data, 'TDS Report', fileName);
};

export const generateCodeOnWagesReport = (records: PayrollResult[], employees: Employee[], format: 'PDF'|'Excel', fileName: string, companyProfile: CompanyProfile) => {
    generateExcelReport(records, 'CodeOnWages', fileName);
};

export const generatePFForm12A = (records: PayrollResult[], employees: Employee[], config: StatutoryConfig, companyProfile: CompanyProfile, month: string, year: number) => {
    const headers = ['Group', 'Wages', 'EE Share', 'ER Share', 'Admin'];
    // Mock summary
    const data = [['Total', '100000', '12000', '12000', '500']];
    generatePDFTableReport(`Form 12A - ${month} ${year}`, headers, data, `Form12A_${month}_${year}`, 'p', undefined, companyProfile);
};

export const generateFormB = (records: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Designation', 'Basic', 'DA', 'Gross', 'Deductions', 'Net'];
    const data = records.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [r.employeeId, emp?.name, emp?.designation, r.earnings.basic, r.earnings.da, r.earnings.total, r.deductions.total, r.netPay];
    });
    generatePDFTableReport(`Form B - Register of Wages (${month} ${year})`, headers, data, `FormB_${month}_${year}`, 'l', undefined, companyProfile);
};

export const generateFormC = (records: PayrollResult[], employees: Employee[], attendances: Attendance[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Present', 'Leaves', 'LOP'];
    const data = records.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const att = attendances.find(a => a.employeeId === r.employeeId && a.month === month && a.year === year);
        return [r.employeeId, emp?.name, att?.presentDays, (att?.earnedLeave||0)+(att?.sickLeave||0)+(att?.casualLeave||0), att?.lopDays];
    });
    generatePDFTableReport(`Form C - Register of Attendance (${month} ${year})`, headers, data, `FormC_${month}_${year}`, 'p', undefined, companyProfile);
};

export const generateTNFormR = (records: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    generateFormB(records, employees, month, year, companyProfile);
};

export const generateTNFormT = (records: PayrollResult[], employees: Employee[], attendances: Attendance[], ledgers: LeaveLedger[], month: string, year: number, companyProfile: CompanyProfile) => {
    generatePaySlipsPDF(records, employees, month, year, companyProfile);
};

export const generateTNFormP = (records: PayrollResult[], employees: Employee[], advances: AdvanceLedger[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Advance Recovered', 'Balance'];
    const data = records.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const adv = advances.find(a => a.employeeId === r.employeeId);
        if ((r.deductions.advanceRecovery || 0) === 0 && (adv?.balance || 0) === 0) return null;
        return [r.employeeId, emp?.name, r.deductions.advanceRecovery, adv?.balance];
    }).filter(d => d !== null);
    generatePDFTableReport(`Form P - Register of Advances (${month} ${year})`, headers, data as any[][], `FormP_${month}_${year}`, 'p', undefined, companyProfile);
};

export const generatePFForm3A = (history: PayrollResult[], employees: Employee[], config: StatutoryConfig, startMonth: string, startYear: number, endMonth: string, endYear: number, empId: string | undefined, companyProfile: CompanyProfile) => {
    const headers = ['Month', 'Wages', 'EE Share', 'ER Share (EPF)', 'ER Share (EPS)'];
    const data = [['Apr', '15000', '1800', '550', '1250']]; // Mock data
    generatePDFTableReport(`Form 3A (${startYear}-${endYear})`, headers, data, `Form3A`, 'p', undefined, companyProfile);
};

export const generatePFForm6A = (history: PayrollResult[], employees: Employee[], config: StatutoryConfig, startMonth: string, startYear: number, endMonth: string, endYear: number, companyProfile: CompanyProfile) => {
    const headers = ['UAN', 'Name', 'Total Wages', 'Total EE Share', 'Total ER Share'];
    const data = [['1001', 'John Doe', '180000', '21600', '21600']]; // Mock data
    generatePDFTableReport(`Form 6A (${startYear}-${endYear})`, headers, data, `Form6A`, 'l', undefined, companyProfile);
};

export const generateESIExitReport = (records: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const data = records.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        if (emp?.dol) return { id: r.employeeId, name: emp.name, reason: 'Left Service' };
        if (r.earnings.total > 21000) return { id: r.employeeId, name: emp?.name, reason: 'Crossed Ceiling' };
        return null;
    }).filter(d => d !== null);
    generateExcelReport(data as any[], 'ESI Exit', `ESI_Exit_${month}_${year}`);
};

export const generateESICodeWagesReport = (records: PayrollResult[], employees: Employee[], format: 'PDF'|'Excel', fileName: string, companyProfile: CompanyProfile) => {
    generateCodeOnWagesReport(records, employees, format, fileName, companyProfile);
};

export const generateGratuityReport = (employees: Employee[], companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'DOJ', 'Years Service', 'Gratuity Accrued'];
    const data = employees.map(e => {
        const years = 5; // Mock calculation
        const gratuity = 50000; // Mock calculation
        return [e.id, e.name, e.doj, years, gratuity];
    });
    generatePDFTableReport('Gratuity Liability Statement', headers, data, 'Gratuity_Report', 'p', undefined, companyProfile);
};

export const generateBonusReport = (history: PayrollResult[], employees: Employee[], config: StatutoryConfig, startMonth: string, startYear: number, endMonth: string, endYear: number, companyProfile: CompanyProfile, format: 'PDF'|'Excel') => {
    const headers = ['ID', 'Name', 'Total Wages', 'Bonus Payable'];
    const data = [['EMP001', 'John Doe', '100000', '8330']]; // Mock data
    if (format === 'Excel') generateExcelReport(data.map(d => ({id:d[0], name:d[1], wages:d[2], bonus:d[3]})), 'Bonus', 'Bonus_Register');
    else generatePDFTableReport('Form C - Bonus Register', headers, data, 'Bonus_Register', 'p', undefined, companyProfile);
};
