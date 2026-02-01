
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
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
      doc.text(companyProfile.establishmentName || '', 14, 10);
  }
  doc.setFontSize(10);
  doc.text(title, 14, 16);
  
  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 20,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1 }, 
  });

  if (footer) {
    doc.text(footer, 14, doc.internal.pageSize.height - 10);
  }
  
  doc.save(`${fileName}.pdf`);
};

export const generatePaySlipsPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
  if (!results || results.length === 0) return;
  const doc = new jsPDF();
  
  results.forEach((r, i) => {
    if (i > 0) doc.addPage();
    const emp = employees.find(e => e.id === r.employeeId);
    if (!emp) return;

    // --- Header ---
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(companyProfile.establishmentName || 'Company Name', 105, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const address = [companyProfile.doorNo, companyProfile.buildingName, companyProfile.street, companyProfile.area, companyProfile.city, companyProfile.state, companyProfile.pincode].filter(Boolean).join(', ');
    const splitAddress = doc.splitTextToSize(address, 160);
    doc.text(splitAddress, 105, 22, { align: 'center' });

    let yPos = 22 + (splitAddress.length * 4);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Pay Slip - ${month} ${year}`, 105, yPos + 6, { align: 'center' });
    doc.line(80, yPos + 7, 130, yPos + 7); // Underline

    yPos += 15;

    // --- Employee Details Grid (Mocking standard grid layout) ---
    autoTable(doc, {
        startY: yPos,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 1.5, overflow: 'hidden' },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 35 }, 
            1: { fontStyle: 'bold', textColor: [0, 0, 0], cellWidth: 55 },       
            2: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 35 }, 
            3: { fontStyle: 'bold', textColor: [0, 0, 0], cellWidth: 55 }        
        },
        body: [
            ['Employee Name', emp.name, 'Designation', emp.designation],
            ['Employee ID', emp.id, 'Department', emp.division || emp.department || '-'],
            ['Bank A/c', emp.bankAccount || '-', 'Days Paid', `${r.payableDays} / ${r.daysInMonth}`],
            ['UAN No', emp.uanc || 'N/A', 'PF No', emp.pfNumber || 'N/A'],
            ['ESI No', emp.esiNumber || 'N/A', 'PAN No', emp.pan || 'N/A']
        ],
    });

    const detailsTable = (doc as any).lastAutoTable;
    // Draw Box
    if (detailsTable && detailsTable.finalY) {
        doc.setDrawColor(200, 200, 200);
        // Calculate height using finalY - startY(yPos)
        doc.rect(14, yPos, 182, detailsTable.finalY - yPos);
        yPos = detailsTable.finalY + 5;
    } else {
        yPos += 40; // Fallback spacing
    }

    // --- Salary Details Table ---
    const special = (r.earnings?.special1 || 0) + (r.earnings?.special2 || 0) + (r.earnings?.special3 || 0);
    const otherEarn = (r.earnings?.washing || 0) + (r.earnings?.attire || 0);

    const salaryBody = [
        ['Basic Pay', (r.earnings?.basic || 0).toFixed(2), `Provident Fund${r.isCode88 ? '*' : ''}`, (r.deductions?.epf || 0).toFixed(2)],
        ['DA', (r.earnings?.da || 0).toFixed(2), `ESI${r.isESICodeWagesUsed ? '**' : ''}`, (r.deductions?.esi || 0).toFixed(2)],
        ['Retaining Allw', (r.earnings?.retainingAllowance || 0).toFixed(2), 'Professional Tax', (r.deductions?.pt || 0).toFixed(2)],
        ['HRA', (r.earnings?.hra || 0).toFixed(2), 'Income Tax', (r.deductions?.it || 0).toFixed(2)],
        ['Conveyance', (r.earnings?.conveyance || 0).toFixed(2), 'VPF', (r.deductions?.vpf || 0).toFixed(2)],
        ['Special Allw', special.toFixed(2), 'LWF', (r.deductions?.lwf || 0).toFixed(2)],
        ['Other Allw', otherEarn.toFixed(2), 'Adv Recovery', (r.deductions?.advanceRecovery || 0).toFixed(2)],
        ['Leave Encash', (r.earnings?.leaveEncashment || 0).toFixed(2), 'Fine / Damages', (r.deductions?.fine || 0).toFixed(2)]
    ];

    autoTable(doc, {
        startY: yPos,
        head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
        body: salaryBody,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { textColor: [71, 85, 105] }, 
            1: { halign: 'right', fontStyle: 'bold', font: 'courier' }, 
            2: { textColor: [71, 85, 105] }, 
            3: { halign: 'right', fontStyle: 'bold', font: 'courier' }
        },
        styles: { fontSize: 9, cellPadding: 1.5 },
        foot: [['Gross Earnings', (r.earnings?.total || 0).toFixed(2), 'Total Deductions', (r.deductions?.total || 0).toFixed(2)]],
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' }
    });

    const salaryTable = (doc as any).lastAutoTable;
    if (salaryTable && salaryTable.finalY) {
        yPos = salaryTable.finalY + 5;
    } else {
        yPos += 100;
    }

    // --- Net Pay Section ---
    doc.setDrawColor(59, 130, 246); 
    doc.setFillColor(239, 246, 255); 
    doc.roundedRect(14, yPos, 182, 20, 2, 2, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(30, 64, 175);
    doc.setFont("helvetica", "bold");
    doc.text('NET SALARY PAYABLE', 20, yPos + 8);

    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(37, 99, 235);
    doc.text(`${numberToWords(Math.round(r.netPay || 0))} Rupees Only`, 20, yPos + 15);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138); 
    const netText = `Rs. ${Math.round(r.netPay || 0).toLocaleString('en-IN')}`;
    const netTextWidth = doc.getTextWidth(netText);
    doc.text(netText, 190 - netTextWidth, yPos + 13);

    yPos += 25;

    // --- Footer Notes ---
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    
    if (r.isCode88) doc.text('* PF calculated on Code Wages (Social Security Code 2020)', 14, yPos);
    if (r.isESICodeWagesUsed) doc.text('** ESI calculated on Code Wages (Social Security Code 2020)', 14, yPos + 4);
    if (r.esiRemark) {
        doc.setTextColor(180, 83, 9);
        doc.text(`Remark: ${r.esiRemark}`, 14, yPos + 8);
        doc.setTextColor(100, 116, 139);
    }

    doc.setFont("helvetica", "italic");
    doc.text('This is a computer-generated document and does not require a signature.', 105, 285, { align: 'center' });
  });
  
  doc.save(`Payslips_${month}_${year}.pdf`);
};

export const generateSimplePaySheetPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    // Extended headers for "All Details" request, fit for Landscape A4
    const headers = [
        'ID', 'Name', 
        'Basic', 'DA', 'HRA', 'Conv', 'Spl/Oth', 
        'GROSS', 
        'PF', 'ESI', 'PT', 'TDS', 'Adv', 'Fine', 
        'NET PAY'
    ];
    
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        
        // Summing up Special/Other allowances to save space on PDF
        const specials = (r.earnings?.special1 || 0) + (r.earnings?.special2 || 0) + (r.earnings?.special3 || 0);
        const others = (r.earnings?.washing || 0) + (r.earnings?.attire || 0) + (r.earnings?.bonus || 0) + (r.earnings?.leaveEncashment || 0) + specials;

        return [
            r.employeeId, 
            emp?.name, 
            Math.round(r.earnings?.basic || 0),
            Math.round(r.earnings?.da || 0),
            Math.round(r.earnings?.hra || 0),
            Math.round(r.earnings?.conveyance || 0),
            Math.round(others),
            Math.round(r.earnings?.total || 0),
            
            Math.round((r.deductions?.epf || 0) + (r.deductions?.vpf || 0)),
            Math.round(r.deductions?.esi || 0),
            Math.round(r.deductions?.pt || 0),
            Math.round(r.deductions?.it || 0),
            Math.round(r.deductions?.advanceRecovery || 0),
            Math.round(r.deductions?.fine || 0),
            
            Math.round(r.netPay || 0)
        ];
    });
    
    generatePDFTableReport(
        `Consolidated Pay Sheet - ${month} ${year}`, 
        headers, 
        data, 
        `PaySheet_${month}_${year}`, 
        'l', 
        'Generated by BharatPay Pro', 
        companyProfile
    );
};

export const generateBankStatementPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ['Emp ID', 'Name', 'Bank', 'Account No', 'IFSC', 'Net Pay'];
    const data = results.filter(r => r.netPay > 0).map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [
            r.employeeId, 
            emp?.name, 
            '-', 
            emp?.bankAccount || '', 
            emp?.ifsc || '', 
            (r.netPay || 0).toFixed(2)
        ];
    });
    generatePDFTableReport(`Bank Statement ${month} ${year}`, headers, data, `Bank_Statement_${month}_${year}`, 'p', undefined, companyProfile);
};

export const generateLeaveLedgerReport = (
    results: PayrollResult[], 
    activeEmployees: Employee[], 
    month: string, 
    year: number, 
    type: 'BC'|'AC', 
    companyProfile: CompanyProfile
) => {
    const headers = ['ID', 'Name', 'EL Open', 'EL Credit', 'EL Used', 'EL Bal', 'SL Bal', 'CL Bal'];
    const data = activeEmployees.map(e => {
        // Use Snapshot from payroll results for historical accuracy
        const r = results.find(res => res.employeeId === e.id);
        const l = r?.leaveSnapshot || { 
            el: { opening: 0, eligible: 0, encashed: 0, availed: 0, balance: 0 },
            sl: { eligible: 0, availed: 0, balance: 0 },
            cl: { accumulation: 0, availed: 0, balance: 0 }
        };
        
        return [
            e.id, 
            e.name, 
            l.el.opening || 0, 
            l.el.eligible || 0, 
            l.el.availed || 0, 
            l.el.balance || 0, 
            l.sl.balance || 0, 
            l.cl.balance || 0
        ];
    });
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
            return `${emp?.uanc}#${emp?.pfNumber}#${r.earnings?.total}#${r.earnings?.basic}#${r.earnings?.basic}#${r.earnings?.basic}#${r.deductions?.epf}#${r.employerContributions?.eps}#${r.employerContributions?.epf}#${r.daysInMonth - r.payableDays}#0`;
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
            const wageA = (r.earnings?.basic || 0) + (r.earnings?.da || 0) + (r.earnings?.retainingAllowance || 0);
            const gross = r.earnings?.total || 0;
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
                'Wages': r.earnings?.total, 
                'EE Contribution': r.deductions?.esi,
                'ER Contribution': r.employerContributions?.esi
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
        pt: r.deductions?.pt 
    })).filter(r => (r.pt || 0) > 0);
    generateExcelReport(data, 'PT Report', fileName);
};

export const generateTDSReport = (records: PayrollResult[], employees: Employee[], fileName: string, companyProfile: CompanyProfile) => {
    const data = records.map(r => ({ 
        id: r.employeeId, 
        name: employees.find(e => e.id === r.employeeId)?.name, 
        tds: r.deductions?.it 
    })).filter(r => (r.tds || 0) > 0);
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
        return [r.employeeId, emp?.name, emp?.designation, r.earnings?.basic, r.earnings?.da, r.earnings?.total, r.deductions?.total, r.netPay];
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
        if ((r.deductions?.advanceRecovery || 0) === 0 && (adv?.balance || 0) === 0) return null;
        return [r.employeeId, emp?.name, r.deductions?.advanceRecovery, adv?.balance];
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
        if ((r.earnings?.total || 0) > 21000) return { id: r.employeeId, name: emp?.name, reason: 'Crossed Ceiling' };
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
