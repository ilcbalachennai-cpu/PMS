
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { PayrollResult, Employee, Attendance, LeaveLedger, AdvanceLedger, StatutoryConfig, CompanyProfile } from '../types';

// Helper: Format Date to DD-MM-YYYY
export const formatDateInd = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
};

// Helper: Number to Words (Indian Format)
export const numberToWords = (num: number): string => {
    const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
    
    if ((num = Math.floor(num)) === 0) return 'Zero';
    if (num.toString().length > 9) return 'Overflow';
    
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    
    let str = '';
    str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0] as any] + ' ' + a[n[1][1] as any]) + 'Crore ' : '';
    str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0] as any] + ' ' + a[n[2][1] as any]) + 'Lakh ' : '';
    str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0] as any] + ' ' + a[n[3][1] as any]) + 'Thousand ' : '';
    str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0] as any] + ' ' + a[n[4][1] as any]) + 'Hundred ' : '';
    str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0] as any] + ' ' + a[n[5][1] as any]) + 'only ' : '';
    
    return str;
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
  data: string[][], 
  fileName: string, 
  orientation: 'p' | 'l', 
  summary: string, 
  companyProfile?: CompanyProfile
) => {
  const doc = new jsPDF(orientation, 'mm', 'a4');
  
  if (companyProfile) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(companyProfile.establishmentName || '', 14, 15);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(companyProfile.city || '', 14, 20);
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 30);
  
  if (summary) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(summary, 14, 36);
  }

  autoTable(doc, {
      startY: 40,
      head: [headers],
      body: data,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 9, fontStyle: 'bold' },
  });
  doc.save(`${fileName}.pdf`);
};

export const generateSimplePaySheetPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Days', 'Gross', 'PF', 'ESI', 'Net Pay'];
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [
            r.employeeId,
            emp?.name || '',
            String(r.payableDays),
            String(r.earnings.total),
            String(r.deductions.epf),
            String(r.deductions.esi),
            String(r.netPay)
        ];
    });
    generatePDFTableReport(`Pay Sheet - ${month} ${year}`, headers, data, `PaySheet_${month}_${year}`, 'l', `Total Records: ${results.length}`, companyProfile);
};

export const generatePaySlipsPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    results.forEach((r, i) => {
        if (i > 0) doc.addPage();
        const emp = employees.find(e => e.id === r.employeeId);
        doc.setFontSize(14);
        doc.text(companyProfile.establishmentName || 'Company', 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Payslip for ${month} ${year}`, 105, 30, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Name: ${emp?.name} (${r.employeeId})`, 20, 45);
        doc.text(`Designation: ${emp?.designation}`, 20, 50);
        
        doc.text(`Gross Earnings: ${r.earnings.total}`, 20, 65);
        doc.text(`Total Deductions: ${r.deductions.total}`, 20, 70);
        doc.text(`Net Pay: ${r.netPay}`, 20, 80);
    });
    
    doc.save(`Payslips_${month}_${year}.pdf`);
};

export const generateBankStatementPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Account No', 'IFSC', 'Amount'];
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [
            r.employeeId,
            emp?.name || '',
            emp?.bankAccount || '',
            emp?.ifsc || '',
            String(r.netPay)
        ];
    });
    generatePDFTableReport(`Bank Statement - ${month} ${year}`, headers, data, `BankStatement_${month}_${year}`, 'p', '', companyProfile);
};

export const generateLeaveLedgerReport = (results: PayrollResult[], employees: Employee[], month: string, year: number, type: string, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'EL Bal', 'SL Bal', 'CL Bal'];
    const data = employees.map(e => {
        return [e.id, e.name, '0', '0', '0']; 
    });
    generatePDFTableReport(`Leave Ledger - ${month} ${year}`, headers, data, `LeaveLedger_${month}_${year}`, 'p', '', companyProfile);
};

export const generateAdvanceShortfallReport = (data: any[], month: string, year: number, format: string, companyProfile: CompanyProfile) => {
    if (format === 'Excel') {
        generateExcelReport(data, 'Shortfall', `AdvShortfall_${month}_${year}`);
    } else {
        const headers = ['ID', 'Name', 'Target', 'Recovered', 'Shortfall'];
        const rows = data.map(d => [d.id, d.name, String(d.target), String(d.recovered), String(d.shortfall)]);
        generatePDFTableReport(`Advance Shortfall - ${month} ${year}`, headers, rows, `AdvShortfall_${month}_${year}`, 'p', '', companyProfile);
    }
};

export const generatePFECR = (results: PayrollResult[], employees: Employee[], format: 'Excel'|'Text', fileName: string) => {
    if (format === 'Excel') {
        const data = results.map(r => ({
            UAN: employees.find(e => e.id === r.employeeId)?.uanc,
            Name: employees.find(e => e.id === r.employeeId)?.name,
            Gross: r.earnings.total,
            EPF: r.deductions.epf
        }));
        generateExcelReport(data, 'ECR', fileName);
    } else {
        const textContent = results.map(r => `${r.employeeId},${r.earnings.total},${r.deductions.epf}`).join('\n');
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.txt`;
        a.click();
    }
};

export const generateESIReturn = (results: PayrollResult[], employees: Employee[], format: 'Excel'|'PDF', fileName: string, companyProfile: CompanyProfile) => {
    if (format === 'Excel') {
        const data = results.map(r => ({
            IP_Number: employees.find(e => e.id === r.employeeId)?.esiNumber,
            Name: employees.find(e => e.id === r.employeeId)?.name,
            Wages: r.earnings.total,
            ESI_EE: r.deductions.esi
        }));
        generateExcelReport(data, 'ESI Return', fileName);
    } else {
        const headers = ['IP No', 'Name', 'Wages', 'ESI'];
        const data = results.map(r => [
            employees.find(e => e.id === r.employeeId)?.esiNumber || '',
            employees.find(e => e.id === r.employeeId)?.name || '',
            String(r.earnings.total),
            String(r.deductions.esi)
        ]);
        generatePDFTableReport('ESI Monthly Return', headers, data, fileName, 'p', '', companyProfile);
    }
};

export const generatePTReport = (results: PayrollResult[], employees: Employee[], fileName: string, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Gross', 'PT'];
    const data = results.map(r => [
        r.employeeId,
        employees.find(e => e.id === r.employeeId)?.name || '',
        String(r.earnings.total),
        String(r.deductions.pt)
    ]);
    generatePDFTableReport('PT Report', headers, data, fileName, 'p', '', companyProfile);
};

export const generateTDSReport = (results: PayrollResult[], employees: Employee[], fileName: string, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Gross', 'IT'];
    const data = results.map(r => [
        r.employeeId,
        employees.find(e => e.id === r.employeeId)?.name || '',
        String(r.earnings.total),
        String(r.deductions.it)
    ]);
    generatePDFTableReport('TDS Report', headers, data, fileName, 'p', '', companyProfile);
};

export const generateCodeOnWagesReport = (results: PayrollResult[], employees: Employee[], format: 'Excel'|'PDF', fileName: string, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Gross', 'Code Wages', 'Diff'];
    const data = results.map(r => [
        r.employeeId,
        employees.find(e => e.id === r.employeeId)?.name || '',
        String(r.earnings.total),
        String(r.earnings.basic + r.earnings.da + r.earnings.retainingAllowance),
        String(r.isCode88 ? 'Yes' : 'No')
    ]);
    if (format === 'Excel') {
        generateExcelReport(results.map(r => ({ ID: r.employeeId, CodeWages: r.isCode88 })), 'Code Wages', fileName);
    } else {
        generatePDFTableReport('Code on Wages Report', headers, data, fileName, 'p', '', companyProfile);
    }
};

export const generatePFForm12A = (results: PayrollResult[], employees: Employee[], config: StatutoryConfig, companyProfile: CompanyProfile, month: string, year: number) => {
    const headers = ['Category', 'Wages', 'Cont. 1', 'Cont. 10', 'Cont. 2', 'Cont. 21', 'Cont. 22'];
    const data = [['Total', '100000', '12000', '8330', '500', '500', '0']];
    generatePDFTableReport(`Form 12A - ${month} ${year}`, headers, data, `Form12A_${month}_${year}`, 'p', '', companyProfile);
};

export const generateFormB = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Designation', 'Total Days', 'Total Wages'];
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [r.employeeId, emp?.name || '', emp?.designation || '', String(r.payableDays), String(r.earnings.total)];
    });
    generatePDFTableReport(`Form B - Register of Wages - ${month} ${year}`, headers, data, `FormB_${month}_${year}`, 'l', '', companyProfile);
};

export const generateFormC = (records: PayrollResult[], employees: Employee[], attendances: Attendance[], month: string, year: number, companyProfile: CompanyProfile) => {
    // Filter active records (Remove Zero Days employees)
    const activeRecords = records.filter(r => r.payableDays > 0);

    const headers = [['ID', 'Name', 'Present', 'Leaves', 'LOP']];
    const data = activeRecords.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const att = attendances.find(a => a.employeeId === r.employeeId && a.month === month && a.year === year);
        const totalLeaves = (att?.earnedLeave||0)+(att?.sickLeave||0)+(att?.casualLeave||0);
        return [
            r.employeeId, 
            emp?.name || '', 
            String(att?.presentDays || 0), 
            String(totalLeaves), 
            String(att?.lopDays || 0)
        ];
    });

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    // Establishment Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(companyProfile.establishmentName || 'Establishment Name', centerX, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(companyProfile.city || '', centerX, 20, { align: 'center' });

    let y = 30;
    // Central Labour Law Header
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Register of Attendance Under Central Labour Law", centerX, y, { align: 'center' });
    y += 6;
    
    // Form C Title
    doc.text(`Form C - Register of Attendance (${month} ${year})`, centerX, y, { align: 'center' });
    y += 10;

    // LIN (Bold) - Left Aligned
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Labour Identification Number : ${companyProfile.lin || '....................'}`, 14, y);
    y += 2;

    autoTable(doc, {
        startY: y,
        head: headers,
        body: data,
        theme: 'grid',
        // Green Header Style
        headStyles: { fillColor: [22, 163, 74], textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'left' },
        bodyStyles: { fontSize: 9, halign: 'left' },
        styles: { overflow: 'linebreak', cellPadding: 2 },
        margin: { left: 14, right: 14 }
    });

    doc.save(`FormC_${month}_${year}.pdf`);
};

export const generateTNFormR = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const activeRecords = results.filter(r => (r.earnings?.total || 0) > 0);
    const headers = [['ID', 'Name', 'Designation', 'Basic', 'DA', 'Gross', 'Deductions', 'Net']];
    const data = activeRecords.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [
            r.employeeId, 
            emp?.name || '', 
            emp?.designation || '', 
            Math.round(r.earnings?.basic||0).toLocaleString(), 
            Math.round(r.earnings?.da||0).toLocaleString(), 
            Math.round(r.earnings?.total||0).toLocaleString(), 
            Math.round(r.deductions?.total||0).toLocaleString(), 
            Math.round(r.netPay||0).toLocaleString()
        ];
    });

    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(companyProfile.establishmentName || 'Establishment', centerX, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(companyProfile.city || '', centerX, 20, { align: 'center' });

    let y = 30;
    // TN Act Header
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Tamil Nadu Shops & Establishment Act", centerX, y, { align: 'center' });
    y += 6;
    doc.text(`Form R - Register of Wages (${month} ${year})`, centerX, y, { align: 'center' });
    y += 10;

    // Reg ID (Left Aligned)
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`TN S & E Reg ID No : ${companyProfile.lin || '....................'}`, 14, y);
    y += 2;

    autoTable(doc, {
        startY: y,
        head: headers,
        body: data,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 9 },
        // Right Align Amount Columns (Basic, DA, Gross, Deductions, Net -> Indices 3,4,5,6,7)
        columnStyles: {
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' },
            7: { halign: 'right' }
        },
        styles: { overflow: 'linebreak', cellPadding: 2 },
        margin: { left: 14, right: 14 }
    });

    doc.save(`FormR_${month}_${year}.pdf`);
};

export const generateTNFormT = (results: PayrollResult[], employees: Employee[], attendances: Attendance[], leaveLedgers: LeaveLedger[], month: string, year: number, companyProfile: CompanyProfile) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    let y = 20;
    const records = results.filter(r => r.netPay > 0);
    
    if (records.length === 0) {
        alert("No valid payroll records found for Form T generation.");
        return;
    }

    records.forEach((r, i) => {
        if (i > 0) {
            doc.addPage();
            y = 20;
        }
        const emp = employees.find(e => e.id === r.employeeId);
        
        // Header
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(companyProfile.establishmentName || 'Establishment', 105, y, { align: 'center' });
        y += 6;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(companyProfile.city || '', 105, y, { align: 'center' });
        y += 8;
        
        // TN Act Header
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Tamil Nadu Shops & Establishment Act", 105, y, { align: 'center' });
        y += 6;
        doc.text(`Form T - Wage Slip (${month} ${year})`, 105, y, { align: 'center' });
        y += 10;

        // Reg ID
        doc.setFontSize(10);
        doc.text(`TN S & E Reg ID No : ${companyProfile.lin || '....................'}`, 14, y);
        y += 8;
        
        // Emp Details
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Name: ${emp?.name} (${r.employeeId})`, 14, y);
        doc.text(`Designation: ${emp?.designation || '-'}`, 140, y);
        y += 6;
        doc.text(`Days Worked: ${r.payableDays}`, 14, y);
        doc.text(`Bank A/c: ${emp?.bankAccount || '-'}`, 140, y);
        y += 8;

        autoTable(doc, {
            startY: y,
            head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
            body: [
                ['Basic Pay', Math.round(r.earnings.basic).toLocaleString(), 'Provident Fund', Math.round(r.deductions.epf).toLocaleString()],
                ['DA', Math.round(r.earnings.da).toLocaleString(), 'ESI', Math.round(r.deductions.esi).toLocaleString()],
                ['HRA', Math.round(r.earnings.hra).toLocaleString(), 'Prof Tax', Math.round(r.deductions.pt).toLocaleString()],
                ['Allowances', Math.round(r.earnings.total - r.earnings.basic - r.earnings.da - r.earnings.hra).toLocaleString(), 'TDS / LWF / Adv', Math.round(r.deductions.it + r.deductions.lwf + r.deductions.advanceRecovery).toLocaleString()],
                ['GROSS EARNINGS', Math.round(r.earnings.total).toLocaleString(), 'TOTAL DEDUCTIONS', Math.round(r.deductions.total).toLocaleString()]
            ],
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 1.5 },
            headStyles: { fillColor: [50, 50, 50], textColor: 255 },
            columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } }
        });
        
        y = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Net Pay: Rs. ${Math.round(r.netPay).toLocaleString()}`, 14, y);
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.text(`(${numberToWords(Math.round(r.netPay))} Only)`, 14, y + 6);
        
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("Signature of Employer", 160, y + 20, { align: 'right' });
        doc.text("Signature of Employee", 14, y + 20, { align: 'left' });
    });
    doc.save(`FormT_${month}_${year}.pdf`);
};

export const generateTNFormP = (results: PayrollResult[], employees: Employee[], advanceLedgers: AdvanceLedger[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = [['ID', 'Name', 'Total Advance', 'Recovered', 'Balance']];
    let hasNilWageEntry = false;

    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const adv = advanceLedgers.find(a => a.employeeId === r.employeeId);
        
        if (!adv) return null;
        
        // Ledger Balance (Total Advance Outstanding)
        const totalAdvance = adv.balance || 0;
        const recovered = r.deductions.advanceRecovery || 0;
        
        // Filter out if no debt and no payment
        if (totalAdvance <= 0 && recovered <= 0) return null;
        
        // Identify Nil Wages (0 Gross or 0 Payable Days)
        const isNilWages = r.earnings.total === 0 || r.payableDays === 0;
        let empName = emp?.name || '';

        // If Nil Wages and still has outstanding advance, mark with *
        if (isNilWages && totalAdvance > 0) {
            empName = `*${empName}`;
            hasNilWageEntry = true;
        }

        // Calculation per requirement
        const balance = totalAdvance - recovered;

        return [
            r.employeeId, 
            empName, 
            String(totalAdvance), 
            String(recovered), 
            String(balance)
        ];
    }).filter(d => d !== null) as string[][];

    if (data.length === 0) {
        alert("No advance records found for this period to generate Form P.");
        return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(companyProfile.establishmentName || 'Establishment', centerX, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(companyProfile.city || '', centerX, 20, { align: 'center' });

    let y = 30;
    // TN Act Header
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Tamil Nadu Shops & Establishment Act", centerX, y, { align: 'center' });
    y += 6;
    doc.text(`Form P - Register of Advances (${month} ${year})`, centerX, y, { align: 'center' });
    y += 10;

    // Reg ID
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`TN S & E Reg ID No : ${companyProfile.lin || '....................'}`, 14, y);
    y += 2;

    autoTable(doc, {
        startY: y,
        head: headers,
        body: data,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 9 },
        // Right Align Amount Columns (Total Advance, Recovered, Balance -> Indices 2,3,4)
        columnStyles: {
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' }
        },
        styles: { overflow: 'linebreak', cellPadding: 2 },
        margin: { left: 14, right: 14 }
    });

    if (hasNilWageEntry) {
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("* Employee wages for the month Nil and advance not recovered", 14, finalY);
    }

    doc.save(`FormP_${month}_${year}.pdf`);
};

export const generatePFForm3A = (history: PayrollResult[], employees: Employee[], config: StatutoryConfig, startMonth: string, startYear: number, endMonth: string, endYear: number, selectedEmployee: string | undefined, companyProfile: CompanyProfile) => {
    generatePDFTableReport(`Form 3A (Annual)`, ['Month', 'Wages', 'PF'], [], `Form3A`, 'p', '', companyProfile);
};

export const generatePFForm6A = (history: PayrollResult[], employees: Employee[], config: StatutoryConfig, startMonth: string, startYear: number, endMonth: string, endYear: number, companyProfile: CompanyProfile) => {
    generatePDFTableReport(`Form 6A (Annual)`, ['Name', 'Wages', 'PF'], [], `Form6A`, 'l', '', companyProfile);
};

export const generateESIExitReport = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const data = results.filter(r => r.earnings.total > 21000).map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [r.employeeId, emp?.name || '', String(r.earnings.total), 'Exceeded Ceiling'];
    });
    generatePDFTableReport(`ESI Exit Report - ${month} ${year}`, ['ID', 'Name', 'Gross', 'Reason'], data, `ESIExit_${month}_${year}`, 'p', '', companyProfile);
};

export const generateESICodeWagesReport = (results: PayrollResult[], employees: Employee[], format: 'Excel'|'PDF', fileName: string, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Gross', 'ESI Wages', 'Code Wages?'];
    const data = results.map(r => [
        r.employeeId,
        employees.find(e => e.id === r.employeeId)?.name || '',
        String(r.earnings.total),
        String(r.earnings.total), 
        r.isESICodeWagesUsed ? 'Yes' : 'No'
    ]);
    if(format === 'Excel') {
        generateExcelReport(results.map(r => ({ ID: r.employeeId, ESIWages: r.earnings.total })), 'ESI Wages', fileName);
    } else {
        generatePDFTableReport('ESI Code Wages', headers, data, fileName, 'p', '', companyProfile);
    }
};

export const generateGratuityReport = (employees: Employee[], companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'DOJ', 'Years', 'Gratuity Accrued'];
    const data = employees.map(e => [e.id, e.name, e.doj, '0', '0']); 
    generatePDFTableReport('Gratuity Report', headers, data, 'Gratuity', 'p', '', companyProfile);
};

export const generateBonusReport = (history: PayrollResult[], employees: Employee[], config: StatutoryConfig, startMonth: string, startYear: number, endMonth: string, endYear: number, companyProfile: CompanyProfile, format: 'Excel'|'PDF') => {
    const headers = ['ID', 'Name', 'Total Wages', 'Bonus'];
    const data = employees.map(e => [e.id, e.name, '0', '0']); 
    if (format === 'Excel') {
        generateExcelReport([{ID: 'TODO'}], 'Bonus', 'BonusReport');
    } else {
        generatePDFTableReport('Bonus Statement', headers, data, 'BonusReport', 'p', '', companyProfile);
    }
};

export const generateEPFCodeImpactReport = (results: PayrollResult[], employees: Employee[], format: 'Excel'|'PDF', fileName: string, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Actual Basic', 'PF Wage', 'Impact'];
    const data = results.map(r => [
        r.employeeId, 
        employees.find(e => e.id === r.employeeId)?.name || '',
        String(r.earnings.basic),
        String(r.earnings.basic), 
        r.isCode88 ? 'Yes' : 'No'
    ]);
    if(format === 'Excel') {
        generateExcelReport(results.map(r => ({ ID: r.employeeId, Impact: r.isCode88 })), 'PF Code Impact', fileName);
    } else {
        generatePDFTableReport('EPF Code Impact', headers, data, fileName, 'p', '', companyProfile);
    }
};
