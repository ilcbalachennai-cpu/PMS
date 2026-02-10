
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { PayrollResult, Employee, CompanyProfile, StatutoryConfig, Attendance, LeaveLedger, AdvanceLedger } from '../types';

export const formatDateInd = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
};

export const numberToWords = (n: number): string => {
    const num = Math.round(n);
    if (num === 0) return "Zero";
    const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    
    const output = (num: number): string => {
        if (num < 20) return a[num];
        if (num < 100) return b[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + a[num % 10] : "");
        if (num < 1000) return a[Math.floor(num / 100)] + " Hundred" + (num % 100 !== 0 ? " and " + output(num % 100) : "");
        if (num < 100000) return output(Math.floor(num / 1000)) + " Thousand" + (num % 1000 !== 0 ? " " + output(num % 1000) : "");
        if (num < 10000000) return output(Math.floor(num / 100000)) + " Lakh" + (num % 100000 !== 0 ? " " + output(num % 100000) : "");
        return output(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 !== 0 ? " " + output(num % 10000000) : "");
    };
    return output(num);
};

export const generateExcelReport = (data: any[], sheetName: string, fileName: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); 
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const generatePDFTableReport = (
  title: string,
  headers: string[] | string[][],
  data: string[][],
  fileName: string,
  orientation: 'p' | 'l' = 'p',
  subTitle: string = '',
  companyProfile: CompanyProfile,
  colStyles: any = {},
  footerNote: string = ''
) => {
  const doc = new jsPDF(orientation, 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.text(companyProfile.establishmentName || 'Establishment Name', pageWidth / 2, 15, { align: 'center' });
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text([companyProfile.city, companyProfile.state].filter(Boolean).join(', '), pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12); doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, 30, { align: 'center' });
  if (subTitle) {
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(subTitle, pageWidth / 2, 35, { align: 'center' });
  }

  autoTable(doc, {
    startY: subTitle ? 40 : 35,
    head: Array.isArray(headers[0]) ? headers : [headers],
    body: data,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 9, halign: 'center' },
    bodyStyles: { fontSize: 8 },
    columnStyles: colStyles,
    styles: { overflow: 'linebreak' },
  });

  if (footerNote) {
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(8); doc.setFont("helvetica", "italic");
      doc.text(footerNote, 14, finalY);
  }

  doc.save(`${fileName}.pdf`);
};

export const generateSimplePaySheetPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Desig', 'Days', 'Basic', 'DA', 'Gross', 'PF', 'ESI', 'PT/IT', 'Net'];
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [
            r.employeeId,
            emp?.name || '',
            emp?.designation || '',
            String(r.payableDays),
            Math.round(r.earnings.basic).toLocaleString(),
            Math.round(r.earnings.da).toLocaleString(),
            Math.round(r.earnings.total).toLocaleString(),
            Math.round(r.deductions.epf).toLocaleString(),
            Math.round(r.deductions.esi).toLocaleString(),
            Math.round(r.deductions.pt + r.deductions.it).toLocaleString(),
            Math.round(r.netPay).toLocaleString()
        ];
    });
    
    const colStyles = { 
        4: { halign: 'right' as const }, 5: { halign: 'right' as const }, 6: { halign: 'right' as const }, 
        7: { halign: 'right' as const }, 8: { halign: 'right' as const }, 9: { halign: 'right' as const }, 
        10: { halign: 'right' as const } 
    };
    
    generatePDFTableReport(`Monthly Pay Sheet - ${month} ${year}`, headers, data, `PaySheet_${month}_${year}`, 'l', '', companyProfile, colStyles);
};

export const generatePaySlipsPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    results.forEach((r, i) => {
        if (i > 0) doc.addPage();
        const emp = employees.find(e => e.id === r.employeeId);
        if (!emp) return;

        let y = 20;
        doc.setFontSize(16); doc.setFont("helvetica", "bold");
        doc.text(companyProfile.establishmentName, 105, y, { align: 'center' });
        y += 6;
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text([companyProfile.city, companyProfile.state].filter(Boolean).join(', '), 105, y, { align: 'center' });
        y += 10;
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text(`PAY SLIP - ${month.toUpperCase()} ${year}`, 105, y, { align: 'center' });
        y += 15;

        // Employee Details
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text(`ID: ${emp.id}`, 14, y);
        doc.text(`Name: ${emp.name}`, 14, y + 6);
        doc.text(`Designation: ${emp.designation}`, 14, y + 12);
        
        doc.text(`UAN: ${emp.uanc || 'NA'}`, 120, y);
        doc.text(`PF No: ${emp.pfNumber || 'NA'}`, 120, y + 6);
        doc.text(`ESI No: ${emp.esiNumber || 'NA'}`, 120, y + 12);
        y += 20;

        // Table
        const head = [['Earnings', 'Amount', 'Deductions', 'Amount']];
        const body = [
            ['Basic Pay', Math.round(r.earnings.basic), 'PF', Math.round(r.deductions.epf)],
            ['DA', Math.round(r.earnings.da), 'ESI', Math.round(r.deductions.esi)],
            ['HRA', Math.round(r.earnings.hra), 'PT', Math.round(r.deductions.pt)],
            ['Allowances', Math.round(r.earnings.total - r.earnings.basic - r.earnings.da - r.earnings.hra), 'TDS/Adv', Math.round(r.deductions.it + r.deductions.advanceRecovery + r.deductions.fine + r.deductions.lwf)],
            ['GROSS', Math.round(r.earnings.total), 'TOTAL DED', Math.round(r.deductions.total)]
        ];

        autoTable(doc, {
            startY: y,
            head: head,
            body: body,
            theme: 'grid',
            styles: { fontSize: 10 },
            headStyles: { fillColor: [60, 60, 60] },
            columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } }
        });

        y = (doc as any).lastAutoTable.finalY + 15;
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text(`Net Pay: Rs. ${Math.round(r.netPay).toLocaleString()}`, 14, y);
        doc.setFontSize(10); doc.setFont("helvetica", "italic");
        doc.text(`(${numberToWords(Math.round(r.netPay))} Only)`, 14, y + 6);
    });

    doc.save(`PaySlips_${month}_${year}.pdf`);
};

export const generateBankStatementPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [
            r.employeeId,
            emp?.name || '',
            emp?.bankAccount || '',
            emp?.ifsc || '',
            Math.round(r.netPay).toLocaleString()
        ];
    });
    
    const headers = ['Emp ID', 'Name', 'Account No', 'IFSC', 'Net Pay'];
    const colStyles = { 4: { halign: 'right' as const } };
    generatePDFTableReport(`Bank Statement - ${month} ${year}`, headers, data, `BankStatement_${month}_${year}`, 'p', '', companyProfile, colStyles);
};

export const generateLeaveLedgerReport = (results: PayrollResult[], employees: Employee[], leaveLedgers: LeaveLedger[], month: string, year: number, type: string, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'EL Opn', 'EL Cred', 'EL Used', 'EL Bal', 'SL Bal', 'CL Bal'];
    const data = employees.map(e => {
        const l = leaveLedgers.find(led => led.employeeId === e.id) || { el: {opening:0, eligible:0, availed:0, encashed:0, balance:0}, sl: {balance:0}, cl: {balance:0} };
        const used = (l.el.availed||0) + (l.el.encashed||0);
        return [
            e.id, 
            e.name, 
            String(l.el.opening||0),
            String(l.el.eligible||0),
            String(used),
            String(l.el.balance||0),
            String(l.sl.balance||0),
            String(l.cl.balance||0)
        ];
    });
    
    generatePDFTableReport(`Leave Ledger - ${month} ${year}`, headers, data, `LeaveLedger_${month}_${year}`, 'l', '', companyProfile);
};

export const generateAdvanceShortfallReport = (data: any[], month: string, year: number, format: 'Excel'|'PDF', companyProfile: CompanyProfile) => {
    const formattedData = data.map(d => ({
        ID: d.id,
        Name: d.name,
        Target: d.target,
        Recovered: d.recovered,
        Shortfall: d.shortfall
    }));

    if (format === 'Excel') {
        generateExcelReport(formattedData, 'Shortfall', `Advance_Shortfall_${month}_${year}`);
    } else {
        const rows = data.map(d => [d.id, d.name, String(d.target), String(d.recovered), String(d.shortfall)]);
        const headers = ['ID', 'Name', 'Target', 'Recovered', 'Shortfall'];
        const colStyles = { 2: { halign: 'right' as const }, 3: { halign: 'right' as const }, 4: { halign: 'right' as const } };
        generatePDFTableReport(`Advance Recovery Shortfall - ${month} ${year}`, headers, rows, `Advance_Shortfall_${month}_${year}`, 'p', '', companyProfile, colStyles);
    }
};

export const generatePFECR = (results: PayrollResult[], employees: Employee[], format: 'Text'|'Excel', fileName: string) => {
    const ecrData = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        // Simplified Logic for ECR format
        const wages = Math.round(r.earnings.basic + r.earnings.da + r.earnings.retainingAllowance);
        const epfWage = Math.min(wages, 15000); // Standard Logic
        return {
            UAN: emp?.uanc,
            Name: emp?.name,
            Gross: Math.round(r.earnings.total),
            EPF_Wages: epfWage,
            EPS_Wages: epfWage,
            EDLI_Wages: epfWage,
            EE_Share: Math.round(r.deductions.epf),
            ER_Share_EPS: Math.round(r.employerContributions.eps),
            ER_Share_EPF: Math.round(r.employerContributions.epf),
            NCP_Days: r.daysInMonth - r.payableDays,
            Refund: 0
        };
    });

    if (format === 'Excel') {
        generateExcelReport(ecrData, 'ECR', fileName);
    } else {
        // Generate Text File
        let txt = "";
        ecrData.forEach(row => {
            txt += `${row.UAN}#~#${row.Name}#~#${row.Gross}#~#${row.EPF_Wages}#~#${row.EPS_Wages}#~#${row.EDLI_Wages}#~#${row.EE_Share}#~#${row.ER_Share_EPS}#~#${row.ER_Share_EPF}#~#${row.NCP_Days}#~#${row.Refund}\n`;
        });
        const blob = new Blob([txt], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.txt`;
        a.click();
    }
};

export const generateESIReturn = (results: PayrollResult[], employees: Employee[], format: 'Excel', fileName: string, companyProfile: CompanyProfile) => {
    const data = results.filter(r => r.deductions.esi > 0).map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return {
            'IP Number': emp?.esiNumber,
            'IP Name': emp?.name,
            'Days': r.payableDays,
            'Wages': Math.round(r.earnings.total), // ESI on Gross usually
            'EE Contribution': r.deductions.esi
        };
    });
    generateExcelReport(data, 'ESI Return', fileName);
};

export const generatePTReport = (results: PayrollResult[], employees: Employee[], fileName: string, companyProfile: CompanyProfile) => {
    const data = results.filter(r => r.deductions.pt > 0).map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [r.employeeId, emp?.name || '', String(Math.round(r.earnings.total)), String(r.deductions.pt)];
    });
    const colStyles = { 2: { halign: 'right' as const }, 3: { halign: 'right' as const } };
    generatePDFTableReport('Professional Tax Report', ['ID', 'Name', 'Gross Wages', 'PT Deducted'], data, fileName, 'p', '', companyProfile, colStyles);
};

export const generateTDSReport = (results: PayrollResult[], employees: Employee[], fileName: string, companyProfile: CompanyProfile) => {
    const data = results.filter(r => r.deductions.it > 0).map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [r.employeeId, emp?.name || '', emp?.pan || '', String(r.deductions.it)];
    });
    const colStyles = { 3: { halign: 'right' as const } };
    generatePDFTableReport('Income Tax (TDS) Report', ['ID', 'Name', 'PAN', 'TDS Amount'], data, fileName, 'p', '', companyProfile, colStyles);
};

export const generateCodeOnWagesReport = (results: PayrollResult[], employees: Employee[], format: 'Excel'|'PDF', fileName: string, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Gross', 'Base Wage', 'Code Wage', 'Old Cont', 'New Cont', 'Diff', 'Impact'];
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const wageA = (r.earnings.basic || 0) + (r.earnings.da || 0) + (r.earnings.retainingAllowance || 0);
        const gross = r.earnings.total;
        const wageC = gross - wageA;
        let wageD = 0;
        if (gross > 0 && (wageC / gross) > 0.50) {
             wageD = wageC - Math.round(gross * 0.50);
        }
        const codeWage = wageA + wageD;
        
        let oldCont = 0;
        if (gross <= 21000 && !emp?.isESIExempt) {
            oldCont = Math.ceil(gross * 0.0075) + Math.ceil(gross * 0.0325);
        }

        const newCont = (r.deductions.esi || 0) + (r.employerContributions.esi || 0);
        const diffVal = oldCont - newCont;
        let impact = 'Neutral';
        if (diffVal > 0) impact = 'Positive Impact (Saved)';
        else if (diffVal < 0) impact = 'Negative Impact (Excess Cost)';

        return [
            r.employeeId,
            emp?.name || '',
            String(Math.round(gross)),
            String(Math.round(wageA)),
            String(Math.round(codeWage)),
            String(Math.round(oldCont)),
            String(Math.round(newCont)),
            String(diffVal),
            impact
        ];
    });

    if (format === 'Excel') {
        generateExcelReport(data.map(d => ({ ID: d[0], Name: d[1], Gross: d[2], BaseWage: d[3], CodeWage: d[4], OldCont: d[5], NewCont: d[6], Diff: d[7], Impact: d[8] })), 'ESI Impact', fileName);
    } else {
        const footNote = 'Note: "Old Contribution" simulated on Gross Wages (Standard ESI Rules). "New Contribution" is actual deduction (Code Wages).';
        const colStyles = { 2: { halign: 'right' as const }, 3: { halign: 'right' as const }, 4: { halign: 'right' as const }, 5: { halign: 'right' as const }, 6: { halign: 'right' as const }, 7: { halign: 'right' as const } };
        generatePDFTableReport('ESI Social Security Code Impact Analysis', headers, data, fileName, 'l', '', companyProfile, colStyles, footNote);
    }
};

export const generateEPFCodeImpactReport = (results: PayrollResult[], employees: Employee[], format: 'Excel'|'PDF', fileName: string, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Gross', 'Base Wage', 'Code Wage', 'Old Cont', 'New Cont', 'Diff', 'Impact'];
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const wageA = (r.earnings.basic || 0) + (r.earnings.da || 0) + (r.earnings.retainingAllowance || 0);
        const gross = r.earnings.total;
        const wageC = gross - wageA;
        let wageD = 0;
        if (gross > 0 && (wageC / gross) > 0.50) {
             wageD = wageC - Math.round(gross * 0.50);
        }
        const codeWage = wageA + wageD;
        const oldCont = Math.round(Math.min(wageA, 15000) * 0.24); // Simulated 12% EE + 12% ER
        const newCont = (r.deductions.epf || 0) + (r.employerContributions.epf || 0) + (r.employerContributions.eps || 0);
        const diffVal = oldCont - newCont;
        let impact = 'Neutral';
        if (diffVal > 0) impact = 'Positive Impact (Saved)';
        else if (diffVal < 0) impact = 'Negative Impact (Excess Cost)';

        return [
            r.employeeId,
            emp?.name || '',
            String(Math.round(gross)),
            String(Math.round(wageA)),
            String(Math.round(codeWage)),
            String(Math.round(oldCont)),
            String(Math.round(newCont)),
            String(diffVal),
            impact
        ];
    });

    if (format === 'Excel') {
        generateExcelReport(data.map(d => ({ ID: d[0], Name: d[1], Gross: d[2], BaseWage: d[3], CodeWage: d[4], OldCont: d[5], NewCont: d[6], Diff: d[7], Impact: d[8] })), 'EPF Impact', fileName);
    } else {
        const footNote = 'Note: "Old Contribution" simulated on Basic+DA+Retn (capped @ 15k). "New Contribution" is Actual Total Liability.';
        const colStyles = { 2: { halign: 'right' as const }, 3: { halign: 'right' as const }, 4: { halign: 'right' as const }, 5: { halign: 'right' as const }, 6: { halign: 'right' as const }, 7: { halign: 'right' as const } };
        generatePDFTableReport('EPF Social Security Code Impact Analysis', headers, data, fileName, 'l', '', companyProfile, colStyles, footNote);
    }
};

export const generatePFForm12A = (results: PayrollResult[], employees: Employee[], config: StatutoryConfig, companyProfile: CompanyProfile, month: string, year: number) => {
    const wages1 = results.reduce((sum, r) => sum + (r.deductions.epf / config.epfEmployeeRate), 0);
    const eeShare = results.reduce((sum, r) => sum + r.deductions.epf + r.deductions.vpf, 0);
    const erShareEPF = results.reduce((sum, r) => sum + r.employerContributions.epf, 0);
    const erShareEPS = results.reduce((sum, r) => sum + r.employerContributions.eps, 0);
    const wages10 = results.reduce((sum, r) => sum + (r.employerContributions.eps / 0.0833), 0);
    const wages21 = wages1; 
    const adminCharges = Math.round(wages1 * 0.005);
    const edliCharges = Math.round(wages21 * 0.005);

    const totalEPF = Math.round(eeShare);
    const totalER_EPF = Math.round(erShareEPF);
    const totalEPS = Math.round(erShareEPS);
    const edliCont = edliCharges;
    const ac2 = Math.max(500, adminCharges);

    const headers = ['', 'PF-Wages', 'Employee Share', 'Employer Share', 'Total'];
    
    const rows = [
        ['EPF_Wages (A/c No.1) (12%+3.67%)', String(Math.round(wages1)), String(totalEPF), String(totalER_EPF), String(totalEPF + totalER_EPF)],
        ['EPS_Wages (A/c No.10) (8.33%)', String(Math.round(wages10)), '-', String(totalEPS), String(totalEPS)],
        ['EDLI_Wages (A/c No.21) (0.50%)', String(Math.round(wages21)), '-', String(edliCont), String(edliCont)],
        ['Admin_Charges (A/c No.2) (0.50%)', String(Math.round(wages1)), '-', String(ac2), String(ac2)],
        ['Admin_Charg_EDLI (0.0%)', '0', '-', '0', '0'],
        ['Total', '', String(totalEPF), String(totalER_EPF + totalEPS + edliCont + ac2), String(totalEPF + totalER_EPF + totalEPS + edliCont + ac2)]
    ];

    const colStyles = { 1: { halign: 'right' as const }, 2: { halign: 'right' as const }, 3: { halign: 'right' as const }, 4: { halign: 'right' as const } };
    
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text("PF_Form12A (Revised)", 105, 15, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10); doc.text("(Only for Un-Exempted Establishment)", 105, 20, { align: 'center' });
    
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    
    const startY = 30;
    doc.text(`Name Address of Establishment: ${companyProfile.establishmentName}`, 14, startY);
    doc.text(`${companyProfile.city}, ${companyProfile.state}`, 14, startY + 5);
    
    doc.text(`Code No: ${companyProfile.pfCode}`, 140, startY + 10);
    doc.text(`Currency Period from: 1st ${month} ${year} to End of ${month} ${year}`, 140, startY);
    doc.text(`Statutory Rate: 12%`, 140, startY + 5);

    doc.setFillColor(255, 255, 0); 
    doc.rect(70, startY + 15, 30, 6, 'F');
    doc.rect(150, startY + 15, 30, 6, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("TRRN", 85, startY + 19, { align: 'center' });
    doc.text("Date", 165, startY + 19, { align: 'center' });

    autoTable(doc, {
        startY: startY + 25,
        head: [headers],
        body: rows,
        theme: 'plain', 
        headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', lineWidth: 0, fontSize: 9 },
        bodyStyles: { fontSize: 9, cellPadding: 3 },
        columnStyles: colStyles,
        didParseCell: (data) => {
            if (data.row.index === rows.length - 1) {
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });
    
    doc.save(`PF_Form12A_${month}_${year}.pdf`);
};

export const generateFormB = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Designation', 'Basic', 'DA', 'Gross', 'Deductions', 'Net'];
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [
            r.employeeId, 
            emp?.name || '', 
            emp?.designation || '', 
            Math.round(r.earnings.basic).toLocaleString(), 
            Math.round(r.earnings.da).toLocaleString(), 
            Math.round(r.earnings.total).toLocaleString(), 
            Math.round(r.deductions.total).toLocaleString(), 
            Math.round(r.netPay).toLocaleString()
        ];
    });
    const colStyles = { 3: { halign: 'right' as const }, 4: { halign: 'right' as const }, 5: { halign: 'right' as const }, 6: { halign: 'right' as const }, 7: { halign: 'right' as const } };
    generatePDFTableReport(`Register of Wages Under Central Labour Law\nForm B - ${month} ${year}`, headers, data, `FormB_${month}_${year}`, 'l', `Labour Identification Number : ${companyProfile.lin || '....................'}`, companyProfile, colStyles);
};

export const generateFormC = (records: PayrollResult[], employees: Employee[], attendances: Attendance[], month: string, year: number, companyProfile: CompanyProfile) => {
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

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(companyProfile.establishmentName || 'Establishment Name', centerX, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(companyProfile.city || '', centerX, 20, { align: 'center' });

    let y = 30;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Register of Attendance Under Central Labour Law", centerX, y, { align: 'center' });
    y += 6;
    doc.text(`Form C - Register of Attendance (${month} ${year})`, centerX, y, { align: 'center' });
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Labour Identification Number : ${companyProfile.lin || '....................'}`, 14, y);
    y += 2;

    autoTable(doc, {
        startY: y,
        head: headers,
        body: data,
        theme: 'grid',
        headStyles: { fillColor: [22, 163, 74], textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'left' },
        bodyStyles: { fontSize: 9, halign: 'left' },
        columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
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
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Tamil Nadu Shops & Establishment Act", centerX, y, { align: 'center' });
    y += 6;
    doc.text(`Form R - Register of Wages (${month} ${year})`, centerX, y, { align: 'center' });
    y += 10;

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
        columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
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
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(companyProfile.establishmentName || 'Establishment', 105, y, { align: 'center' });
        y += 6;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(companyProfile.city || '', 105, y, { align: 'center' });
        y += 8;
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Tamil Nadu Shops & Establishment Act", 105, y, { align: 'center' });
        y += 6;
        doc.text(`Form T - Wage Slip (${month} ${year})`, 105, y, { align: 'center' });
        y += 10;

        doc.setFontSize(10);
        doc.text(`TN S & E Reg ID No : ${companyProfile.lin || '....................'}`, 14, y);
        y += 8;
        
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
        
        const totalAdvance = adv.balance || 0;
        const recovered = r.deductions.advanceRecovery || 0;
        
        if (totalAdvance <= 0 && recovered <= 0) return null;
        
        const isNilWages = r.earnings.total === 0 || r.payableDays === 0;
        let empName = emp?.name || '';

        if (isNilWages && totalAdvance > 0) {
            empName = `*${empName}`;
            hasNilWageEntry = true;
        }

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
    const centerX = doc.internal.pageSize.getWidth() / 2;

    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(companyProfile.establishmentName || 'Establishment', centerX, 15, { align: 'center' });
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(companyProfile.city || '', centerX, 20, { align: 'center' });

    let y = 30;
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("Tamil Nadu Shops & Establishment Act", centerX, y, { align: 'center' });
    y += 6;
    doc.text(`Form P - Register of Advances (${month} ${year})`, centerX, y, { align: 'center' });
    y += 10;

    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(`TN S & E Reg ID No : ${companyProfile.lin || '....................'}`, 14, y);
    y += 2;

    autoTable(doc, {
        startY: y,
        head: headers,
        body: data,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 9 },
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
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        doc.text("* Employee wages for the month Nil and advance not recovered", 14, finalY);
    }

    doc.save(`FormP_${month}_${year}.pdf`);
};

export const generatePFForm3A = (history: PayrollResult[], employees: Employee[], config: StatutoryConfig, startMonth: string, startYear: number, endMonth: string, endYear: number, selectedEmployee: string | undefined, companyProfile: CompanyProfile) => {
    const targets = selectedEmployee ? employees.filter(e => e.id === selectedEmployee) : employees;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    targets.forEach((emp, i) => {
        if (i > 0) doc.addPage();
        
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text("For UnExempted Establishment Only ( Form 3A Revises)", 105, 15, { align: 'center' });
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        doc.text("The Employees Provident Fund Scheme 1952 (Paras 35 42)", 105, 20, { align: 'center' });
        doc.text("The Employees Pension Scheme: 1995 (Para 19)", 105, 25, { align: 'center' });
        doc.text(`Contribution Card for Currency Period from: 01/04/${startYear} to 31/03/${endYear}`, 105, 30, { align: 'center' });
        
        const leftX = 14;
        const rightX = 120;
        let y = 40;

        doc.text(`Account No: ${emp.pfNumber || '-'}`, leftX, y);
        doc.text(`Name Address of the Factory/ Establishment`, rightX, y);
        y += 5;
        doc.text(`UAN No: ${emp.uanc || '-'}`, leftX, y);
        doc.setFont("helvetica", "bold");
        doc.text(`${companyProfile.establishmentName}`, rightX, y);
        doc.setFont("helvetica", "normal");
        y += 5;
        doc.text(`Name/ Surname: ${emp.name}`, leftX, y);
        doc.text(`${companyProfile.doorNo}, ${companyProfile.street}`, rightX, y);
        y += 5;
        doc.text(`Father/ Husband Name: ${emp.fatherSpouseName || '-'}`, leftX, y);
        doc.text(`${companyProfile.area}, ${companyProfile.city}, ${companyProfile.state}`, rightX, y);
        y += 5;
        doc.text(`Statutory Rate of Cont: 12%`, leftX, y);
        doc.text(`Pincode - ${companyProfile.pincode}`, rightX, y);
        y += 8;
        doc.text("Voluntary Higher Rate of employee's Cont. (if any): NIL", leftX, y);
        y += 5;
        doc.text("RE Cont. on Hr Wages to EPF (ER) Y/N: N   Vol.Cont. to Pension Y/N: N", leftX, y);
        
        const headers = ['Month/\nYear', 'Amount of\nWages', 'Worker\'s Share\nEPF', 'Employer\'s Share EPF (A/c\n1)', 'PENSION FUND (A/c\n10)', 'Ref. of\nAdv.', 'NCP Days\n(LOP)'];
        const monthNames = ['April','May','June','July','August','September','October','November','December','January','February','March'];
        let totals = { wages: 0, ee: 0, er_epf: 0, er_eps: 0, ncp: 0 };
        
        const rows = monthNames.map(m => {
            const y = (['January','February','March'].includes(m)) ? endYear : startYear;
            const r = history.find(rec => rec.employeeId === emp.id && rec.month === m && rec.year === y);
            
            const ee = r ? r.deductions.epf : 0;
            const er_epf = r ? r.employerContributions.epf : 0;
            const er_eps = r ? r.employerContributions.eps : 0;
            
            const wages = ee > 0 ? Math.round(ee / 0.12) : 0; 
            const ncp = r ? (r.daysInMonth - r.payableDays) : 0;
            
            totals.wages += wages; totals.ee += ee; totals.er_epf += er_epf; totals.er_eps += er_eps; totals.ncp += ncp;
            
            return [
                `${m.substr(0,3)} '${String(y).substr(2)}`, 
                wages > 0 ? String(wages) : '0', 
                ee > 0 ? String(ee) : '0', 
                er_epf > 0 ? String(er_epf) : '0', 
                er_eps > 0 ? String(er_eps) : '0', 
                '0', 
                ncp > 0 ? String(ncp) : '0'
            ];
        });
        
        rows.push([
            'Total :', 
            String(totals.wages), 
            String(totals.ee), 
            String(totals.er_epf), 
            String(totals.er_eps), 
            '', 
            String(totals.ncp)
        ]);

        autoTable(doc, {
            startY: 70,
            head: [headers],
            body: rows,
            theme: 'grid',
            headStyles: { fillColor: [255, 255, 255], textColor: 0, lineWidth: 0.1, lineColor: 0, fontSize: 8, fontStyle: 'bold', halign: 'center' },
            bodyStyles: { lineColor: 0, lineWidth: 0.1, fontSize: 9, halign: 'center' },
            columnStyles: { 0: { halign: 'left' } },
            didParseCell: (data) => {
                if (data.row.index === rows.length - 1) data.cell.styles.fontStyle = 'bold';
            }
        });
        
        let footerY = (doc as any).lastAutoTable.finalY + 10;
        
        doc.text("7- Remarks : A) Date of Leaving Service , if any:", 14, footerY);
        footerY += 5;
        doc.text("       B) Reason for leaving service, if any:", 14, footerY);
        footerY += 10;
        
        const totalShare = totals.ee + totals.er_epf;
        doc.setFontSize(8);
        const certText = `Certified that the total amount of contribution (both shares) indicated in this card i.e. Rs. ${totalShare} has already been remitted in full in EPF A/c. No.1\nand Pension Fund A/c. No. 10 Rs. ${totals.er_eps} (Vide note below)\nCertified that the Difference between the Total of contribution show under Cols. 3 4a 4b of the above table and that arrived at on the total wages shown in Co\nat the prescribed rate is solely due to the rounding off of contribution to the nearest rupee under the rules.`;
        const splitText = doc.splitTextToSize(certText, 180);
        doc.text(splitText, 14, footerY);
        
        footerY += 25;
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        doc.text(`For   ${companyProfile.establishmentName}`, 120, footerY);
        
        footerY += 20;
        doc.setFont("helvetica", "normal");
        const today = new Date();
        const dateStr = today.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        doc.text(dateStr, 14, footerY);
        doc.text("Signature of employer with Official Seal", 140, footerY);
    });
    
    doc.save(`Form3A_${startYear}-${endYear}.pdf`);
};

export const generatePFForm6A = (history: PayrollResult[], employees: Employee[], config: StatutoryConfig, startMonth: string, startYear: number, endMonth: string, endYear: number, companyProfile: CompanyProfile) => {
    const empStats = new Map<string, { wages: number, ee: number, er_epf: number, er_eps: number }>();
    
    const monthNames = ['April','May','June','July','August','September','October','November','December','January','February','March'];
    
    const fyHistory = history.filter(r => {
        const mIdx = monthNames.indexOf(r.month);
        const targetYear = (['January','February','March'].includes(r.month)) ? endYear : startYear;
        return r.year === targetYear && mIdx !== -1;
    });

    fyHistory.forEach(r => {
        const current = empStats.get(r.employeeId) || { wages: 0, ee: 0, er_epf: 0, er_eps: 0 };
        const wages = r.deductions.epf > 0 ? Math.round(r.deductions.epf / 0.12) : 0;
        
        current.wages += wages;
        current.ee += r.deductions.epf;
        current.er_epf += r.employerContributions.epf;
        current.er_eps += r.employerContributions.eps;
        empStats.set(r.employeeId, current);
    });

    const rows = Array.from(empStats.entries()).map(([id, stats], index) => {
        const emp = employees.find(e => e.id === id);
        return [
            String(index + 1),
            emp?.pfNumber || '-',
            emp?.name || '',
            String(Math.round(stats.wages)),
            String(Math.round(stats.ee)),
            String(Math.round(stats.er_epf)),
            String(Math.round(stats.er_eps)),
            '0', 'N', ''
        ];
    });

    const headers = ['Sl.\nNo', 'Account No.', 'Name of member', 'Wages, retaining\nallowance...', 'Amount of worker\'s\ncontributions', 'EPF Diff (ER\nShare)', 'Pension Fund\n(8.33%)', 'Refund of\nAdvance', 'Rate of\nhigher vol', 'Remarks'];
    
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("(FOR UNEXEMPTED ESTABLISHMENTS' ONLY)", 148, 15, { align: 'center' });
    doc.text("FORM 6A", 148, 22, { align: 'center' });
    doc.setFontSize(10);
    doc.text("THE EMPLOYEES' PROVIDENT FUND SCHEME, 1952 (PARAGRAPH 43)", 148, 28, { align: 'center' });
    
    doc.setFontSize(9);
    doc.text(`Annual statement of contribution for the Currency period from 1st ${startMonth} ${startYear} to 31st ${endMonth} ${endYear}`, 14, 40);
    doc.text(`Name & Address of the Establishment: ${companyProfile.establishmentName}`, 14, 46);
    doc.text(`Code No. of the Establishment: ${companyProfile.pfCode}`, 14, 52);
    doc.text("Statutory rate of contribution: 12%", 220, 52);

    autoTable(doc, {
        startY: 60,
        head: [headers],
        body: rows,
        theme: 'grid',
        styles: { fontSize: 8, overflow: 'linebreak' },
        headStyles: { fillColor: [26, 188, 156], textColor: 255, halign: 'center', valign: 'middle' },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { cellWidth: 40 },
            2: { cellWidth: 40 },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' },
            7: { halign: 'right' },
            8: { halign: 'center' }
        }
    });
    
    doc.save(`Form6A_${startYear}-${endYear}.pdf`);
};

export const generateESIExitReport = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const data = results.filter(r => r.earnings.total > 21000).map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [r.employeeId, emp?.name || '', String(r.earnings.total), 'Exceeded Ceiling'];
    });
    const colStyles = { 2: { halign: 'right' as const } };
    generatePDFTableReport(`ESI Exit Report - ${month} ${year}`, ['ID', 'Name', 'Gross', 'Reason'], data, `ESIExit_${month}_${year}`, 'p', '', companyProfile, colStyles);
};

export const generateESICodeWagesReport = (results: PayrollResult[], employees: Employee[], format: 'Excel'|'PDF', fileName: string, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Gross', 'Base Wage', 'Code Wage', 'Old Cont', 'New Cont', 'Diff', 'Impact'];
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const wageA = (r.earnings.basic || 0) + (r.earnings.da || 0) + (r.earnings.retainingAllowance || 0);
        const gross = r.earnings.total;
        const wageC = gross - wageA;
        let wageD = 0;
        if (gross > 0 && (wageC / gross) > 0.50) {
             wageD = wageC - Math.round(gross * 0.50);
        }
        const codeWage = wageA + wageD;
        
        let oldCont = 0;
        if (gross <= 21000 && !emp?.isESIExempt) {
            oldCont = Math.ceil(gross * 0.0075) + Math.ceil(gross * 0.0325);
        }

        const newCont = (r.deductions.esi || 0) + (r.employerContributions.esi || 0);
        const diffVal = oldCont - newCont;
        let impact = 'Neutral';
        if (diffVal > 0) impact = 'Positive Impact (Saved)';
        else if (diffVal < 0) impact = 'Negative Impact (Excess Cost)';

        return [
            r.employeeId,
            emp?.name || '',
            String(Math.round(gross)),
            String(Math.round(wageA)),
            String(Math.round(codeWage)),
            String(Math.round(oldCont)),
            String(Math.round(newCont)),
            String(diffVal),
            impact
        ];
    });

    if (format === 'Excel') {
        generateExcelReport(data.map(d => ({ ID: d[0], Name: d[1], Gross: d[2], BaseWage: d[3], CodeWage: d[4], OldCont: d[5], NewCont: d[6], Diff: d[7], Impact: d[8] })), 'ESI Impact', fileName);
    } else {
        const footNote = 'Note: "Old Contribution" simulated on Gross Wages (Standard ESI Rules). "New Contribution" is actual deduction (Code Wages).';
        const colStyles = { 2: { halign: 'right' as const }, 3: { halign: 'right' as const }, 4: { halign: 'right' as const }, 5: { halign: 'right' as const }, 6: { halign: 'right' as const }, 7: { halign: 'right' as const } };
        generatePDFTableReport('ESI Social Security Code Impact Analysis', headers, data, fileName, 'l', '', companyProfile, colStyles, footNote);
    }
};

export const generateGratuityReport = (employees: Employee[], companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'DOJ', 'Years', 'Gratuity Accrued'];
    const data = employees.map(e => [e.id, e.name, e.doj, '0', '0']); 
    const colStyles = { 3: { halign: 'right' as const }, 4: { halign: 'right' as const } };
    generatePDFTableReport('Gratuity Report', headers, data, 'Gratuity', 'p', '', companyProfile, colStyles);
};

export const generateBonusReport = (history: PayrollResult[], employees: Employee[], config: StatutoryConfig, startMonth: string, startYear: number, endMonth: string, endYear: number, companyProfile: CompanyProfile, format: 'Excel'|'PDF') => {
    const headers = ['ID', 'Name', 'Total Wages', 'Bonus'];
    const data = employees.map(e => [e.id, e.name, '0', '0']); 
    if (format === 'Excel') {
        generateExcelReport([{ID: 'TODO'}], 'Bonus', 'BonusReport');
    } else {
        const colStyles = { 2: { halign: 'right' as const }, 3: { halign: 'right' as const } };
        generatePDFTableReport('Bonus Statement', headers, data, 'BonusReport', 'p', '', companyProfile, colStyles);
    }
};
