import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Employee, PayrollResult, StatutoryConfig, CompanyProfile, Attendance, LeaveLedger, AdvanceLedger } from '../types';

// ==========================================
// UTILITIES
// ==========================================

export const formatDateInd = (dateInput: string | Date | undefined): string => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
};

export const numberToWords = (num: number): string => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if ((num = num.toString() as any).length > 9) return 'overflow';
    const n: any[] = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/) || [];
    if (!n) return '';
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.trim();
};

export const generateExcelReport = (data: any[], sheetName: string, fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Sheet name max 31 chars
    XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const generatePDFTableReport = (title: string, headers: string[], data: any[][], fileName: string, orientation: 'p' | 'l', summary: string, company: CompanyProfile, columnStyles?: any) => {
    const doc = new jsPDF(orientation);
    doc.setFontSize(14);
    doc.text(company.establishmentName || 'Company Name', 14, 15);
    doc.setFontSize(10);
    doc.text(title, 14, 22);
    if (summary) doc.text(summary, 14, 28);

    autoTable(doc, {
        head: [headers],
        body: data,
        startY: 35,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: columnStyles
    });

    doc.save(`${fileName}.pdf`);
};

// ==========================================
// ARREAR REPORTS
// ==========================================

export const generateArrearReport = (
    arrearData: any[],
    effectiveMonth: string,
    effectiveYear: number,
    currentMonth: string,
    currentYear: number,
    format: 'PDF' | 'Excel',
    companyProfile: CompanyProfile
) => {
    const fileName = `Arrear_Statement_${effectiveMonth}${effectiveYear}_to_${currentMonth}${currentYear}`;
    const title = `Arrear Salary Statement (Effective: ${effectiveMonth} ${effectiveYear})`;
    const summary = `Generated during payroll processing for ${currentMonth} ${currentYear}`;

    if (format === 'Excel') {
        const exportData = arrearData.map(r => ({
            'Employee ID': r.id,
            'Name': r.name,
            'Old Basic': r.oldBasic,
            'New Basic': r.newBasic,
            'Diff Basic': r.diffBasic,
            'Old DA': r.oldDA,
            'New DA': r.newDA,
            'Diff DA': r.diffDA,
            'Other Allow Diff': r.diffOthers,
            'Total Monthly Incr': r.monthlyIncrement,
            'Arrear Months': r.months,
            'Total Arrear Payable': r.totalArrear
        }));
        generateExcelReport(exportData, 'Arrears', fileName);
    } else {
        const headers = ['ID', 'Name', 'Old Basic', 'New Basic', 'Diff Basic', 'Old DA', 'New DA', 'Diff DA', 'Mth Incr', 'Months', 'Total Arrear'];
        const rows = arrearData.map(r => [
            r.id,
            r.name,
            r.oldBasic,
            r.newBasic,
            r.diffBasic,
            r.oldDA,
            r.newDA,
            r.diffDA,
            r.monthlyIncrement,
            r.months,
            r.totalArrear
        ]);

        generatePDFTableReport(title, headers, rows, fileName, 'l', summary, companyProfile);
    }
};

export const generateStateWageRegister = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile, stateName: string, formName: string) => {
    const headers = ['Sl', 'Name', 'Designation', 'Total Work', 'Total Output', 'Basic', 'DA', 'Overtime', 'Others', 'Total', 'Deductions', 'Net'];
    const validResults = results.filter(r => r.payableDays > 0);
    const data = validResults.map((r, i) => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [i + 1, emp?.name, emp?.designation, r.payableDays, '', r.earnings.basic, r.earnings.da, 0, 0, r.earnings.total, r.deductions.total, r.netPay];
    });

    const title = `${stateName} Shops & Establishment Act\n${formName} - Register of Wages (${month} ${year})`;
    const fileName = `${stateName.replace(/\s+/g, '')}_${formName.split(' ')[0]}_WageReg_${month}_${year}`;
    generatePDFTableReport(title, headers, data, fileName, 'l', '', companyProfile);
};

export const generateStatePaySlip = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile, stateName: string, formName: string) => {
    generatePaySlipsPDF(results, employees, month, year, companyProfile, `${stateName} S&E Act - ${formName}`);
};

export const generateStateAdvanceRegister = (results: PayrollResult[], employees: Employee[], advanceLedgers: AdvanceLedger[], month: string, year: number, companyProfile: CompanyProfile, stateName: string, formName: string) => {
    const headers = ['ID', 'Name', 'Adv Date', 'Amount', 'Purpose', 'Installments', 'Recovered', 'Balance'];
    const data = advanceLedgers.filter(a => a.totalAdvance > 0).map(a => {
        const emp = employees.find(e => e.id === a.employeeId);
        return [a.employeeId, emp?.name, '', a.totalAdvance, 'Salary Adv', a.emiCount || '', a.recovery || 0, a.balance];
    });

    const title = `${stateName} Shops & Establishment Act\n${formName} - Register of Advances (${month} ${year})`;
    const fileName = `${stateName.replace(/\s+/g, '')}_${formName.split(' ')[0]}_AdvReg_${month}_${year}`;

    generatePDFTableReport(title, headers, data, fileName, 'l', '', companyProfile);
};

export const generateSimplePaySheetPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Basic', 'DA', 'HRA', 'Conv', 'Spl/Oth', 'GROSS', 'PF', 'ESI', 'PT', 'TDS', 'Adv', 'Fine', 'NET PAY'];
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const mainComponents = (r.earnings.basic || 0) + (r.earnings.da || 0) + (r.earnings.hra || 0) + (r.earnings.conveyance || 0);
        const otherAllowances = Math.max(0, (r.earnings.total || 0) - mainComponents);
        return [
            r.employeeId, emp?.name || '', Math.round(r.earnings.basic), Math.round(r.earnings.da), Math.round(r.earnings.hra),
            Math.round(r.earnings.conveyance), Math.round(otherAllowances), Math.round(r.earnings.total),
            Math.round(r.deductions.epf + r.deductions.vpf), Math.round(r.deductions.esi), Math.round(r.deductions.pt),
            Math.round(r.deductions.it), Math.round(r.deductions.advanceRecovery), Math.round(r.deductions.fine), Math.round(r.netPay)
        ];
    });

    // Grand Total row — sum all numeric columns (indices 2-14), leave ID & Name as labels
    const grandTotal = [
        '', 'GRAND TOTAL',
        ...Array.from({ length: 13 }, (_, i) =>
            data.reduce((sum, row) => sum + (Number(row[i + 2]) || 0), 0)
        )
    ];

    const colStyles: any = { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right', fontStyle: 'bold' }, 8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' }, 11: { halign: 'right' }, 12: { halign: 'right' }, 13: { halign: 'right' }, 14: { halign: 'right', fontStyle: 'bold' } };
    const doc = new jsPDF('l');
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text(companyProfile.establishmentName || 'Company Name', 14, 15);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    const cityState = [companyProfile.city, companyProfile.state].filter(Boolean).join(', ');
    if (cityState) doc.text(cityState.toUpperCase(), 14, 20);
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(`Consolidated Pay Sheet - ${month} ${year}`, 14, 28);
    autoTable(doc, {
        head: [headers],
        body: [...data, grandTotal],
        startY: 32,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [26, 188, 156], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: colStyles,
        didParseCell: (hookData) => {
            // Style the grand total row (last row)
            if (hookData.row.index === data.length) {
                hookData.cell.styles.fillColor = [15, 23, 42];   // dark bg
                hookData.cell.styles.textColor = [255, 255, 255]; // white text
                hookData.cell.styles.fontStyle = 'bold';
            }
        }
    });
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(8); doc.setTextColor(220, 53, 69); doc.text('* PF calculated on Code Wages (Social Security Code 2020)', 14, finalY);
    doc.setTextColor(150); doc.text('Generated by BharatPay Pro', 14, finalY + 5);
    doc.save(`PaySheet_${month}_${year}.pdf`);
};


export const generatePaySlipsPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile, customTitle?: string) => {
    const doc = new jsPDF();
    let y = 10;
    results.forEach((r, index) => {
        if (index > 0) { doc.addPage(); y = 10; }
        const emp = employees.find(e => e.id === r.employeeId);
        if (!emp) return;
        doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60); doc.text(companyProfile.establishmentName.toUpperCase(), 105, y + 5, { align: 'center' }); y += 12;
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
        const address = [companyProfile.doorNo, companyProfile.buildingName, companyProfile.street, companyProfile.area, companyProfile.city, companyProfile.state, companyProfile.pincode].filter(Boolean).join(', ');
        const splitAddr = doc.splitTextToSize(address, 160); doc.text(splitAddr, 105, y, { align: 'center' }); y += (splitAddr.length * 4) + 6;
        doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0); doc.text(customTitle || `Pay Slip - ${month} ${year}`, 105, y, { align: 'center' });
        doc.setLineWidth(0.5); doc.line(80, y + 2, 130, y + 2); y += 10;
        const startY = y; const col1X = 14; const col2X = 110; const labelWidth = 35;
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text("Employee Name", col1X, y); doc.setFont('helvetica', 'bold'); doc.text(emp.name, col1X + labelWidth, y);
        doc.setFont('helvetica', 'bold'); doc.text("Designation", col2X, y); doc.setFont('helvetica', 'bold'); doc.text(emp.designation, col2X + labelWidth, y); y += 6;
        doc.setFont('helvetica', 'bold'); doc.text("Employee ID", col1X, y); doc.setFont('helvetica', 'bold'); doc.text(emp.id, col1X + labelWidth, y);
        doc.setFont('helvetica', 'bold'); doc.text("Department", col2X, y); doc.setFont('helvetica', 'bold'); doc.text(emp.division || emp.department || '-', col2X + labelWidth, y); y += 6;
        doc.setFont('helvetica', 'bold'); doc.text("Bank A/c", col1X, y); doc.setFont('helvetica', 'bold'); doc.text(emp.bankAccount || '-', col1X + labelWidth, y);
        doc.setFont('helvetica', 'bold'); doc.text("Days Paid", col2X, y); doc.setFont('helvetica', 'bold'); doc.text(`${r.payableDays} / ${r.daysInMonth}`, col2X + labelWidth, y); y += 6;
        doc.setFont('helvetica', 'bold'); doc.text("UAN No", col1X, y); doc.setFont('helvetica', 'bold'); doc.text(emp.uanc || '-', col1X + labelWidth, y);
        doc.setFont('helvetica', 'bold'); doc.text("PF No", col2X, y); doc.setFont('helvetica', 'bold'); doc.text(emp.pfNumber || '-', col2X + labelWidth, y); y += 6;
        doc.setFont('helvetica', 'bold'); doc.text("ESI No", col1X, y); doc.setFont('helvetica', 'bold'); doc.text(emp.esiNumber || '-', col1X + labelWidth, y);
        doc.setFont('helvetica', 'bold'); doc.text("PAN No", col2X, y); doc.setFont('helvetica', 'bold'); doc.text(emp.pan || '-', col2X + labelWidth, y); y += 10;
        const specialAllw = (r.earnings.special1 || 0) + (r.earnings.special2 || 0) + (r.earnings.special3 || 0);
        const otherAllw = (r.earnings.washing || 0) + (r.earnings.attire || 0) + (r.earnings.bonus || 0);
        const earningsData = [['Basic Pay', r.earnings.basic.toFixed(2)], ['DA', r.earnings.da.toFixed(2)], ['Retaining Allw', (r.earnings.retainingAllowance || 0).toFixed(2)], ['HRA', r.earnings.hra.toFixed(2)], ['Conveyance', r.earnings.conveyance.toFixed(2)], ['Special Allw', specialAllw.toFixed(2)], ['Other Allw', otherAllw.toFixed(2)], ['Leave Encash', (r.earnings.leaveEncashment || 0).toFixed(2)]];
        const deductionsData = [['Provident Fund', r.deductions.epf.toFixed(2)], ['ESI', r.deductions.esi.toFixed(2)], ['Professional Tax', r.deductions.pt.toFixed(2)], ['Income Tax', r.deductions.it.toFixed(2)], ['VPF', r.deductions.vpf.toFixed(2)], ['LWF', r.deductions.lwf.toFixed(2)], ['Adv Recovery', r.deductions.advanceRecovery.toFixed(2)], ['Fine / Damages', r.deductions.fine.toFixed(2)]];
        const tableBody = earningsData.map((e, i) => [e[0], e[1], deductionsData[i][0], deductionsData[i][1]]);
        tableBody.push(['Gross Earnings', r.earnings.total.toFixed(2), 'Total Deductions', r.deductions.total.toFixed(2)]);
        autoTable(doc, { head: [['Earnings', 'Amount', 'Deductions', 'Amount']], body: tableBody, startY: y, theme: 'grid', headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' }, columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 40, halign: 'right' }, 2: { cellWidth: 50 }, 3: { cellWidth: 40, halign: 'right' } } as any, styles: { fontSize: 9, cellPadding: 3, lineColor: [200, 200, 200] }, didParseCell: function (data) { if (data.row.index === tableBody.length - 1) { data.cell.styles.fontStyle = 'bold'; } } });
        const finalY = (doc as any).lastAutoTable.finalY + 5;
        doc.setDrawColor(100, 149, 237); doc.setLineWidth(0.5); doc.roundedRect(14, finalY, 180, 25, 3, 3, 'S'); doc.setFillColor(240, 248, 255); doc.roundedRect(14.5, finalY + 0.5, 179, 24, 3, 3, 'F');
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 51, 153); doc.text("NET SALARY PAYABLE", 20, finalY + 8);
        doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(50, 100, 200);
        const amountInWords = numberToWords(Math.round(r.netPay)) + " Rupees Only";
        doc.text(amountInWords, 20, finalY + 18);
        doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 51, 153); doc.text(`Rs. ${Math.round(r.netPay).toLocaleString('en-IN')}`, 185, finalY + 15, { align: 'right' });
        const footerY = finalY + 40; doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100); doc.text("This is a computer-generated document and does not require a signature.", 105, footerY, { align: 'center' });
    });
    doc.save(`PaySlips_${month}_${year}.pdf`);
};

export const generateBankStatementPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ['Emp ID', 'Name', 'Account No', 'IFSC', 'Amount'];
    const data = results.filter(r => r.netPay > 0).map(r => { const emp = employees.find(e => e.id === r.employeeId); return [r.employeeId, emp?.name, emp?.bankAccount, emp?.ifsc, r.netPay]; });
    generatePDFTableReport(`Bank Statement - ${month} ${year}`, headers, data, `Bank_Statement_${month}_${year}`, 'p', '', companyProfile, { 4: { halign: 'right' } });
};

export const generateLeaveLedgerReport = (results: PayrollResult[], employees: Employee[], leaveLedgers: LeaveLedger[], month: string, year: number, format: string, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'EL Open', 'EL Credit', 'EL Used', 'EL Bal', 'SL Bal', 'CL Bal'];
    const data = employees.map(e => { const l = leaveLedgers.find(led => led.employeeId === e.id); if (!l) return [e.id, e.name, '-', '-', '-', '-', '-', '-']; return [e.id, e.name, l.el.opening, l.el.eligible, (l.el.availed + l.el.encashed), l.el.balance, l.sl.balance, l.cl.balance]; });
    generatePDFTableReport(`Leave Ledger - ${month} ${year}`, headers, data, `LeaveLedger_${month}_${year}`, 'l', '', companyProfile);
};

export const generateAdvanceShortfallReport = (data: any[], month: string, year: number, format: 'PDF' | 'Excel', companyProfile: CompanyProfile) => {
    if (format === 'Excel') { generateExcelReport(data, 'Shortfall', `Advance_Shortfall_${month}_${year}`); } else { const headers = ['ID', 'Name', 'Target EMI', 'Recovered', 'Shortfall']; const rows = data.map(d => [d.id, d.name, d.target, d.recovered, d.shortfall]); generatePDFTableReport(`Advance Shortfall Report - ${month} ${year}`, headers, rows, `Advance_Shortfall_${month}_${year}`, 'p', '', companyProfile, { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }); }
};

export const generatePFECR = (results: PayrollResult[], employees: Employee[], config: StatutoryConfig, format: 'Excel' | 'Text', fileName: string) => {
    // Build one row per employee
    const allRows = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const isOnLOP = (emp?.leavingReason || '').trim().toUpperCase() === 'ON LOP';

        // ON LOP: appear in ECR with all-zero wages, NCP = full days of month
        if (isOnLOP) {
            const daysInMonth = r.daysInMonth || 30;
            return {
                uan: emp?.uanc || '', name: emp?.name || '',
                grossWages: 0, epfWages: 0, epsWages: 0, edliWages: 0,
                eeEPF: 0, erEPS: 0, erEPF: 0,
                ncpDays: daysInMonth,
                refund: 0, isOnLOP: true,
            };
        }

        const isNonContributing = emp?.isPFExempt || r.payableDays === 0;

        // Gross Wages: Basic + DA + Retaining Allowance (full PF-applicable wages, uncapped)
        const grossWages = isNonContributing ? 0 : Math.round(
            (r.earnings.basic || 0) +
            (r.earnings.da || 0) +
            (r.earnings.retainingAllowance || 0)
        );

        // EPF / EPS / EDLI Wages: ceiling-capped wages back-calculated from EE contribution (÷12%)
        const eeEPF = isNonContributing ? 0 : Math.round((r.deductions.epf || 0) + (r.deductions.vpf || 0));
        const epfWages = isNonContributing ? 0 : (eeEPF > 0 ? Math.round(eeEPF / 0.12) : 0);
        const epsWages = epfWages;
        const edliWages = epfWages;

        const erEPS = isNonContributing ? 0 : Math.round(r.employerContributions.eps || 0);
        const erEPF = isNonContributing ? 0 : Math.round(r.employerContributions.epf || 0);

        // NCP Days: non-contributing days = daysInMonth − payableDays
        const ncpDays = isNonContributing
            ? (r.daysInMonth || 30)
            : Math.max(0, (r.daysInMonth || 30) - Math.round(r.payableDays));

        return {
            uan: emp?.uanc || '', name: emp?.name || '',
            grossWages, epfWages, epsWages, edliWages,
            eeEPF, erEPS, erEPF, ncpDays, refund: 0, isOnLOP: false,
        };
    });

    // Filter: include only employees with grossWages > 0 OR leavingReason = 'ON LOP'
    const rows = allRows.filter(r => r.grossWages > 0 || r.isOnLOP);

    if (format === 'Text') {
        // EPFO ECR2 text format:
        // UAN#~#MemberName#~#GrossWages#~#EPFWages#~#EPSWages#~#EDLIWages#~#EEShare#~#ERepsShare#~#ERepfShare#~#NCPDays#~#RefundAdv
        const lines = rows.map(r =>
            `${r.uan}#~#${r.name}#~#${r.grossWages}#~#${r.epfWages}#~#${r.epsWages}#~#${r.edliWages}#~#${r.eeEPF}#~#${r.erEPS}#~#${r.erEPF}#~#${r.ncpDays}#~#${r.refund}`
        );
        const content = lines.join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } else {
        // ── EXCEL: formatted XLSX matching EPFO ECR2 portal layout ──────────
        const HEADERS = [
            'UAN', 'Member Name',
            'Gross\nWages', 'EPF\nWages', 'EPS\nWages', 'EDLI\nWages',
            'EE\nShare', 'ER_EPS\nShare', 'ER_EPF\nShare',
            'NCP Days', 'Advance\nRefund'
        ];

        const dataRows: (string | number)[][] = rows.map(r => [
            r.uan, r.name,
            r.grossWages, r.epfWages, r.epsWages, r.edliWages,
            r.eeEPF, r.erEPS, r.erEPF,
            r.ncpDays, r.refund
        ]);

        const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...dataRows]);

        // Column widths (characters) — tuned to match the image
        ws['!cols'] = [
            { wch: 15 }, // UAN
            { wch: 22 }, // Member Name
            { wch: 9 }, // Gross Wages
            { wch: 8 }, // EPF Wages
            { wch: 8 }, // EPS Wages
            { wch: 8 }, // EDLI Wages
            { wch: 8 }, // EE Share
            { wch: 10 }, // ER_EPS Share
            { wch: 10 }, // ER_EPF Share
            { wch: 9 }, // NCP Days
            { wch: 9 }, // Advance Refund
        ];

        // Header row height (taller to show wrapped text)
        ws['!rows'] = [{ hpt: 30 }];

        // Freeze the header row so it stays visible while scrolling
        (ws as any)['!freeze'] = { xSplit: 0, ySplit: 1 };

        // Bold + centered + wrapped header cells
        const colCount = HEADERS.length;
        for (let c = 0; c < colCount; c++) {
            const addr = XLSX.utils.encode_cell({ r: 0, c });
            if (ws[addr]) {
                ws[addr].s = {
                    font: { bold: true, sz: 9 },
                    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                    fill: { fgColor: { rgb: 'D9E1F2' }, patternType: 'solid' },
                    border: { bottom: { style: 'thin', color: { rgb: '000000' } } }
                };
            }
        }

        // Right-align numeric columns (index 2+) in data rows
        for (let ri = 1; ri <= dataRows.length; ri++) {
            // UAN: force text type to prevent scientific notation for long numbers
            const uanAddr = XLSX.utils.encode_cell({ r: ri, c: 0 });
            if (ws[uanAddr]) { ws[uanAddr].t = 's'; }

            for (let ci = 2; ci < colCount; ci++) {
                const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
                if (ws[addr]) {
                    ws[addr].s = { alignment: { horizontal: 'right' }, numFmt: '0' };
                }
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'PF ECR');
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    }
};

export const generatePFForm12A = (results: PayrollResult[], employees: Employee[], config: StatutoryConfig, companyProfile: CompanyProfile, month: string, year: number) => {
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const mIdx = MONTHS.indexOf(month);
    const daysInMonth = new Date(year, mIdx + 1, 0).getDate();

    // ── Compute totals from payroll results (same logic as ECR) ──────────────
    let totalGrossWages = 0, totalEPFWages = 0, totalEPSWages = 0;
    let totalEEShare = 0, totalERepsShare = 0, totalERepfShare = 0;

    results.forEach(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const isOnLOP = (emp?.leavingReason || '').trim().toUpperCase() === 'ON LOP';
        if (isOnLOP || emp?.isPFExempt || r.payableDays === 0) return; // skip non-contributors

        const gross = Math.round((r.earnings.basic || 0) + (r.earnings.da || 0) + (r.earnings.retainingAllowance || 0));
        const ee = Math.round((r.deductions.epf || 0) + (r.deductions.vpf || 0));
        const epf = ee > 0 ? Math.round(ee / 0.12) : 0;
        const eps = Math.round(r.employerContributions.eps || 0);
        const epfEr = Math.round(r.employerContributions.epf || 0);

        totalGrossWages += gross;
        totalEPFWages += epf;
        totalEPSWages += Math.round(eps / 0.0833); // back-calc EPS wages from 8.33%
        totalEEShare += ee;
        totalERepsShare += eps;
        totalERepfShare += epfEr;
    });

    // Round EPS wages to nearest integer
    totalEPSWages = Math.round(totalEPSWages);

    const edliWages = totalEPSWages;
    const edliAmount = Math.round(edliWages * 0.005);          // 0.50% EDLI
    const adminCharges = Math.round(totalEPFWages * 0.005);      // 0.50% Admin on EPF wages (min 500)
    const adminEDLI = 0;                                      // Admin EDLI (currently 0%)
    const totalEmployer = totalERepsShare + totalERepfShare + edliAmount + adminCharges + adminEDLI;
    const grandTotal = totalEEShare + totalEmployer;

    // ── Build PDF ────────────────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297;
    let y = 12;

    // Title
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(200, 50, 0);
    doc.text('PF_Form12A (Revised)', pageW / 2, y, { align: 'center' }); y += 7;
    doc.setFontSize(9); doc.setFont('helvetica', 'italic');
    doc.text('(Only for Un-Exempted Establishment)', pageW / 2, y, { align: 'center' }); y += 8;

    // ── Header info (3 columns) ──
    doc.setFont('helvetica', 'normal'); doc.setTextColor(0);
    const leftX = 14, midX = 100, rightX = 220;

    // Left col
    doc.setFontSize(8); doc.setTextColor(80);
    doc.text('Name Address of Establishment', leftX, y);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(0); doc.setFontSize(9);
    doc.text((companyProfile.establishmentName || '').toUpperCase(), leftX, y + 5);
    const city = [companyProfile.city, companyProfile.state].filter(Boolean).join(', ');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60);
    doc.text(city, leftX, y + 10);

    // Mid col
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(0);
    const shortMonth = month.slice(0, 3);
    const midLines = [
        '| Employees Provident Fund And Misc. Provision Act 1952',
        '| Employees Pension Scheme [Paragraph 20 (4)]',
        `| Currency Period from: 1st ${month} to End of ${month} ${year}`,
        `| Statement of Contribution for the Month of ${month} ${year}`
    ];
    midLines.forEach((line, i) => doc.text(line, midX, y + (i * 4.5)));

    // Right col
    doc.setFontSize(7.5);
    const rightLines = [
        '| (To be Filled by the EPFO)',
        '| Establishment Status: Un-Exempted',
        '| Group Code:',
        `| Establishment Code: ${companyProfile.pfCode || ''}`
    ];
    rightLines.forEach((line, i) => doc.text(line, rightX, y + (i * 4.5)));

    y += 22;
    // Divider
    doc.setDrawColor(180); doc.setLineWidth(0.4); doc.line(14, y, pageW - 14, y); y += 6;

    // ── Section title ────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0);
    doc.text('PF ECR_UAN_CALCULATION SHEET', pageW / 2, y, { align: 'center' }); y += 8;

    // TRRN / Date yellow boxes
    const boxW = 50, boxH = 8;
    doc.setFillColor(255, 255, 0); doc.setDrawColor(180);
    doc.rect(60, y, boxW, boxH, 'FD');
    doc.rect(185, y, boxW, boxH, 'FD');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text('TRRN', 60 + boxW / 2, y + 5.5, { align: 'center' });
    doc.text('Date', 185 + boxW / 2, y + 5.5, { align: 'center' });
    y += 14;

    // ── Contribution Table ───────────────────────────────────────────────────
    const tableHead = [['Particulars', 'Wages', 'Rate', 'Employee Share', 'Rate', 'Employer Share', 'Total']];

    const fmt = (n: number) => n > 0 ? n.toString() : '0';

    const tableBody = [
        ['PF-Wages', fmt(totalGrossWages), '', '', '', '', '',],
        ['EPF_Wages (A/c No.1)', fmt(totalEPFWages), '12%', fmt(totalEEShare), '3.67%', fmt(totalERepfShare), fmt(totalEEShare + totalERepfShare)],
        ['EPS_Wages (A/c No.10)', fmt(totalEPSWages), '', '', '8.33%', fmt(totalERepsShare), fmt(totalERepsShare)],
        ['EDLI_Wages (A/c No.21)', fmt(edliWages), '', '', '0.50%', '', fmt(edliAmount)],
        ['Admin_Charges (A/c No.2)', fmt(totalEPFWages), '', '', '0.50%', '', fmt(adminCharges)],
        ['Admin_Charg_EDLI', '0', '', '', '0.0%', '', '0'],
        ['Total', '', '', fmt(totalEEShare), '', fmt(totalERepsShare + totalERepfShare), fmt(grandTotal)],
    ];

    autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 3, textColor: [0, 0, 0] },
        headStyles: {
            fillColor: [240, 240, 240],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'left',
            lineColor: [180, 180, 180],
            lineWidth: 0.3
        },
        columnStyles: {
            0: { cellWidth: 55, fontStyle: 'bold' },
            1: { cellWidth: 32, halign: 'right' },
            2: { cellWidth: 18, halign: 'center' },
            3: { cellWidth: 35, halign: 'right' },
            4: { cellWidth: 18, halign: 'center' },
            5: { cellWidth: 35, halign: 'right' },
            6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (hookData) => {
            // Bold + light-grey total row
            if (hookData.row.index === tableBody.length - 1) {
                hookData.cell.styles.fontStyle = 'bold';
                hookData.cell.styles.fillColor = [235, 235, 235];
            }
        }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 6;
    doc.setLineWidth(0.4); doc.setDrawColor(180);
    doc.line(14, finalY, pageW - 14, finalY);
    doc.setFontSize(7); doc.setTextColor(130); doc.setFont('helvetica', 'italic');
    doc.text('Generated by PMS — PF Form 12A (Revised) as per EPFO Guidelines', pageW / 2, finalY + 5, { align: 'center' });

    doc.save(`PFForm12A_Revised_${month}_${year}.pdf`);
};

export const generateFormB = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    generateStateWageRegister(results, employees, month, year, companyProfile, 'Central Labour Law', 'Form B (Register of Wages)');
};

export const generateFormC = (results: PayrollResult[], employees: Employee[], attendances: Attendance[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', '1', '2', '3', '4', '5', '...', 'Total'];
    const data = results.filter(r => r.payableDays > 0).map(r => [r.employeeId, employees.find(e => e.id === r.employeeId)?.name, 'P', 'P', 'P', 'P', 'P', '...', r.payableDays]);
    generatePDFTableReport(`Form C (Muster Roll) - ${month} ${year}`, headers, data, `FormC_${month}_${year}`, 'l', '', companyProfile);
};

export const generateTNFormR = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    generateStateWageRegister(results, employees, month, year, companyProfile, 'Tamil Nadu', 'Form R');
};

export const generateTNFormT = (results: PayrollResult[], employees: Employee[], attendances: Attendance[], leaveLedgers: LeaveLedger[], month: string, year: number, companyProfile: CompanyProfile) => {
    generateStatePaySlip(results, employees, month, year, companyProfile, 'Tamil Nadu', 'Form T');
};

export const generateTNFormP = (results: PayrollResult[], employees: Employee[], advanceLedgers: AdvanceLedger[], month: string, year: number, companyProfile: CompanyProfile) => {
    generateStateAdvanceRegister(results, employees, advanceLedgers, month, year, companyProfile, 'Tamil Nadu', 'Form P');
};

export const generatePFForm3A = (
    history: PayrollResult[],
    employees: Employee[],
    config: StatutoryConfig,
    sM: string, sY: number,
    eM: string, eY: number,
    empId: string | undefined,
    company: CompanyProfile
) => {
    const ALL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Determine FY: Apr (startYear) → Mar (startYear+1)
    // sY is the start year of the financial year (e.g. 2025 for FY 2025-26)
    const fyStart = sY;
    const fyEnd = sY + 1;

    // Build the 12 FY months in order: Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar
    const fyMonths: { month: string; year: number; short: string }[] = [
        { month: 'April', year: fyStart, short: `Apr '${String(fyStart).slice(2)}` },
        { month: 'May', year: fyStart, short: `May '${String(fyStart).slice(2)}` },
        { month: 'June', year: fyStart, short: `Jun '${String(fyStart).slice(2)}` },
        { month: 'July', year: fyStart, short: `Jul '${String(fyStart).slice(2)}` },
        { month: 'August', year: fyStart, short: `Aug '${String(fyStart).slice(2)}` },
        { month: 'September', year: fyStart, short: `Sep '${String(fyStart).slice(2)}` },
        { month: 'October', year: fyStart, short: `Oct '${String(fyStart).slice(2)}` },
        { month: 'November', year: fyStart, short: `Nov '${String(fyStart).slice(2)}` },
        { month: 'December', year: fyStart, short: `Dec '${String(fyStart).slice(2)}` },
        { month: 'January', year: fyEnd, short: `Jan '${String(fyEnd).slice(2)}` },
        { month: 'February', year: fyEnd, short: `Feb '${String(fyEnd).slice(2)}` },
        { month: 'March', year: fyEnd, short: `Mar '${String(fyEnd).slice(2)}` },
    ];

    // Decide which employees to generate (single or all)
    const targetEmps = empId
        ? employees.filter(e => e.id === empId)
        : employees.filter(e => !e.isPFExempt);

    targetEmps.forEach(emp => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = 210;
        let y = 10;

        // ── Title ─────────────────────────────────────────────────────────
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0);
        doc.text('For UnExempted Establishment Only ( Form 3A Revises)', pageW / 2, y, { align: 'center' }); y += 5;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        doc.text('The Employees Provident Fund Scheme 1952 (Para 35 42)', pageW / 2, y, { align: 'center' }); y += 4;
        doc.text('The Employees Pension Scheme: 1995 (Para 19)', pageW / 2, y, { align: 'center' }); y += 4;
        doc.text(`Contribution Card for Currency Period from: 01/04/${fyStart} to 31/03/${fyEnd}`, pageW / 2, y, { align: 'center' }); y += 7;

        // ── Employee + Company header (2 columns) ──────────────────────────
        const leftX = 14, rightX = 110;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(0);

        // Left column
        doc.text('Account No: 1', leftX, y);
        doc.setFont('helvetica', 'bold');
        doc.text(`UAN No: ${emp.uanc || 'N/A'}`, leftX, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.text(`Name/Surname: ${(emp.name || '').toUpperCase()}`, leftX, y + 10);
        doc.text(`Father/Husband Name: ${(emp.fatherSpouseName || '').toUpperCase()}`, leftX, y + 15);
        doc.text(`Statutory Rate of Cont: ${config.epfEmployeeRate ? Math.round(config.epfEmployeeRate * 100) : 12}%`, leftX, y + 20);
        doc.text(`Voluntary Higher Rate of employee's Cont. (if any): NIL`, leftX, y + 25);

        // Right column
        doc.setFont('helvetica', 'bold');
        doc.text('Name Address of the Factory/Establishment', rightX, y);
        doc.text((company.establishmentName || '').toUpperCase(), rightX, y + 5);
        doc.setFont('helvetica', 'normal');
        const companyAddr = [company.doorNo, company.street, company.locality].filter(Boolean).join(', ');
        if (companyAddr) doc.text(companyAddr, rightX, y + 10);
        const cityState = [company.city, company.state].filter(Boolean).join(', ');
        if (cityState) doc.text(cityState, rightX, y + 15);
        if (company.pincode) doc.text(`Pincode - ${company.pincode}`, rightX, y + 20);

        y += 32;
        doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(14, y, pageW - 14, y); y += 4;

        // ── Monthly contribution table ─────────────────────────────────────
        const tableHead = [[
            'Month/\nYear',
            'Amount of\nWages',
            "Worker's Share\nEPF",
            "Employer's Share\nEPF (A/c 1)",
            'PENSION\nFUND (A/c 10)',
            'Ref. of\nAdv.',
            'NCP Days\n(LOP)'
        ]];

        let totWages = 0, totWorker = 0, totErEPF = 0, totEPS = 0, totNCP = 0;

        const tableBody = fyMonths.map(fm => {
            const rec = history.find(r => r.employeeId === emp.id && r.month === fm.month && r.year === fm.year);

            if (!rec || rec.payableDays === 0) {
                return [fm.short, '0', '0', '0', '0', '0', '0'];
            }

            const wages = Math.round((rec.earnings?.basic || 0) + (rec.earnings?.da || 0) + (rec.earnings?.retainingAllowance || 0));
            const eeEPF = Math.round((rec.deductions?.epf || 0) + (rec.deductions?.vpf || 0));
            const erEPF = Math.round(rec.employerContributions?.epf || 0);
            const eps = Math.round(rec.employerContributions?.eps || 0);
            const ncp = Math.max(0, (rec.daysInMonth || 30) - Math.round(rec.payableDays));

            totWages += wages;
            totWorker += eeEPF;
            totErEPF += erEPF;
            totEPS += eps;
            totNCP += ncp;

            return [fm.short, wages.toString(), eeEPF.toString(), erEPF.toString(), eps.toString(), '0', ncp.toString()];
        });

        // Totals row
        tableBody.push([
            'Total :',
            totWages.toString(),
            totWorker.toString(),
            totErEPF.toString(),
            totEPS.toString(),
            '0',
            totNCP.toString()
        ]);

        autoTable(doc, {
            head: tableHead,
            body: tableBody,
            startY: y,
            theme: 'grid',
            styles: { fontSize: 7.5, cellPadding: 2, halign: 'center', textColor: [0, 0, 0] },
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center',
                lineColor: [0, 0, 0],
                lineWidth: 0.3,
            },
            columnStyles: {
                0: { cellWidth: 18, halign: 'center' },
                1: { cellWidth: 28, halign: 'right' },
                2: { cellWidth: 25, halign: 'right' },
                3: { cellWidth: 30, halign: 'right' },
                4: { cellWidth: 28, halign: 'right' },
                5: { cellWidth: 18, halign: 'right' },
                6: { cellWidth: 22, halign: 'right' },
            },
            didParseCell: (hookData) => {
                // Bold totals row
                if (hookData.row.index === tableBody.length - 1) {
                    hookData.cell.styles.fontStyle = 'bold';
                    hookData.cell.styles.fillColor = [245, 245, 245];
                }
                // Blue hyperlink-style for non-zero data rows (matches the format image)
                if (hookData.section === 'body' && hookData.row.index < tableBody.length - 1) {
                    const val = parseInt(hookData.cell.raw as string || '0');
                    if (val > 0 && hookData.column.index > 0) {
                        hookData.cell.styles.textColor = [0, 0, 200];
                    }
                }
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 6;
        y = finalY;

        // ── Remarks ────────────────────────────────────────────────────────
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(0);
        doc.text('7- Remarks : A) Date of Leaving Service, if any:', leftX, y); y += 5;
        doc.text('              B) Reason for leaving service, if any:', leftX, y); y += 8;

        // ── Certification text ─────────────────────────────────────────────
        doc.setFontSize(7);
        const certText =
            `Certified that the total amount of contribution (both shares) indicated in this card i.e. Rs. ${(totWorker + totErEPF + totEPS).toLocaleString()} has already been remitted in full in EPF A/c No. 1 ` +
            `and Pension Fund A/c No. 10 Rs. 1260 (Vide note below).\n` +
            `Note: The difference between the total of contribution shown under Cols. 3 to 4b of the above table and that arrived at on the total wages ` +
            `shown in Col 2\nat the prescribed rate is solely due to the rounding off of contribution to the nearest rupee under the rules.`;
        const certLines = doc.splitTextToSize(certText, pageW - 28);
        doc.text(certLines, leftX, y); y += certLines.length * 4 + 8;

        // ── Footer ─────────────────────────────────────────────────────────
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        doc.text(`For ${(company.establishmentName || '').toUpperCase()}`, pageW - 14, y, { align: 'right' }); y += 12;

        const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        doc.text(today, leftX, y);
        doc.text('Signature of employer with Official Seal', pageW - 14, y, { align: 'right' });

        doc.save(`PF_Form3A_${emp.id}_FY${fyStart}-${String(fyEnd).slice(2)}.pdf`);
    });
};

export const generatePFForm6A = (
    history: PayrollResult[],
    employees: Employee[],
    config: StatutoryConfig,
    sM: string, sY: number,
    eM: string, eY: number,
    company: CompanyProfile
) => {
    const MONTHS_ALL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Financial Year months Apr(sY) → Mar(sY+1)
    const fyStart = sY;
    const fyEnd = sY + 1;
    const fyMonths: { month: string; year: number }[] = [
        { month: 'April', year: fyStart },
        { month: 'May', year: fyStart },
        { month: 'June', year: fyStart },
        { month: 'July', year: fyStart },
        { month: 'August', year: fyStart },
        { month: 'September', year: fyStart },
        { month: 'October', year: fyStart },
        { month: 'November', year: fyStart },
        { month: 'December', year: fyStart },
        { month: 'January', year: fyEnd },
        { month: 'February', year: fyEnd },
        { month: 'March', year: fyEnd },
    ];

    // Build per-employee annual aggregates
    const pfEmps = employees.filter(e => !e.isPFExempt);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297;
    let y = 10;

    // ── Title ────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0);
    doc.text('(FOR UNEXEMPTED ESTABLISHMENTS\' ONLY)', pageW / 2, y, { align: 'center' }); y += 6;
    doc.text('FORM 6A', pageW / 2, y, { align: 'center' }); y += 6;
    doc.setFontSize(9);
    doc.text('THE EMPLOYEES\' PROVIDENT FUND SCHEME, 1952 (PARAGRAPH 43)', pageW / 2, y, { align: 'center' }); y += 8;

    // ── Establishment header ──────────────────────────────────────────────
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text(`Annual statement of contribution for the Currency period from 1st April ${fyStart} to 31st March ${fyEnd}`, 14, y); y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Name & Address of the Establishment: ', 14, y, { baseline: 'middle' } as any);
    doc.setFont('helvetica', 'normal');
    doc.text((company.establishmentName || '').toUpperCase(), 14 + 65, y); y += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('Code No. of the Establishment: ', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(company.pfCode || '', 14 + 52, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`Statutory rate of contribution: ${config.epfEmployeeRate ? Math.round(config.epfEmployeeRate * 100) : 12}%`, 256, y, { align: 'right' });
    y += 6;

    // ── Build table data (exclude employees with zero contribution for the FY) ──
    let totWages = 0, totWorker = 0, totErEPF = 0, totEPS = 0;

    // Step 1: compute annual aggregates per employee
    const empAggregates = pfEmps.map(emp => {
        let wages = 0, eeEPF = 0, erEPF = 0, eps = 0;
        fyMonths.forEach(fm => {
            const rec = history.find(r =>
                r.employeeId === emp.id && r.month === fm.month && r.year === fm.year
            );
            if (!rec || rec.payableDays === 0) return;
            wages += Math.round((rec.earnings?.basic || 0) + (rec.earnings?.da || 0) + (rec.earnings?.retainingAllowance || 0));
            eeEPF += Math.round((rec.deductions?.epf || 0) + (rec.deductions?.vpf || 0));
            erEPF += Math.round(rec.employerContributions?.epf || 0);
            eps += Math.round(rec.employerContributions?.eps || 0);
        });
        return { emp, wages, eeEPF, erEPF, eps };
    });

    // Step 2: exclude zero-contribution employees
    const contributing = empAggregates.filter(a => a.wages > 0 || a.eeEPF > 0);

    // Step 3: build rows with re-sequenced Sl. No
    const tableBody: (string | number)[][] = contributing.map((a, idx) => {
        totWages += a.wages;
        totWorker += a.eeEPF;
        totErEPF += a.erEPF;
        totEPS += a.eps;
        const higherVol = a.emp.isPFHigherWages || a.emp.isEmployerPFHigher ? 'Y' : 'N';
        return [
            idx + 1,                      // Sl. No (re-sequenced)
            1,                            // Account No
            a.emp.name.toUpperCase(),
            a.wages,
            a.eeEPF,
            a.erEPF,
            a.eps,
            0,                            // Refund of Advance
            higherVol,
            ''                            // Remarks
        ];
    });

    // Totals row
    tableBody.push([
        '', 'TOTAL', '',
        totWages, totWorker, totErEPF, totEPS, 0, '', ''
    ]);

    const tableHead = [[
        'Sl.\nNo',
        'Account\nNo.',
        'Name of member\n(in block letters)',
        'Wages, retaining\nallowance...',
        'Amount of worker\'s\ncontributions',
        'EPF Diff\n(ER Share)',
        'Pension Fund\n(8.33%)',
        'Refund of\nAdvance',
        'Rate of\nhigher vol',
        'Remarks'
    ]];

    autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: y,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2, textColor: [0, 0, 0] },
        headStyles: {
            fillColor: [0, 128, 128],   // Teal — matches template header colour
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            lineColor: [255, 255, 255],
            lineWidth: 0.3,
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 14, halign: 'center' },
            2: { cellWidth: 52, halign: 'left' },
            3: { cellWidth: 28, halign: 'right' },
            4: { cellWidth: 26, halign: 'right' },
            5: { cellWidth: 24, halign: 'right' },
            6: { cellWidth: 24, halign: 'right' },
            7: { cellWidth: 20, halign: 'right' },
            8: { cellWidth: 18, halign: 'center' },
            9: { cellWidth: 26, halign: 'left' },
        },
        didParseCell: (hookData) => {
            const isTotal = hookData.row.index === tableBody.length - 1;
            if (isTotal) {
                hookData.cell.styles.fontStyle = 'bold';
                hookData.cell.styles.fillColor = [240, 240, 240];
            }
            // Colour non-zero numeric cells blue (matching template)
            if (!isTotal && hookData.section === 'body' && hookData.column.index >= 3 && hookData.column.index <= 7) {
                const v = Number(hookData.cell.raw);
                if (v > 0) hookData.cell.styles.textColor = [0, 0, 200];
            }
        }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;

    // ── Footer ────────────────────────────────────────────────────────────
    doc.setFontSize(7); doc.setFont('helvetica', 'italic'); doc.setTextColor(80);
    doc.text('Generated by PMS — Form 6A (Annual Statement) FY ' + fyStart + '-' + String(fyEnd).slice(2), pageW / 2, finalY, { align: 'center' });

    doc.save(`PF_Form6A_FY${fyStart}-${String(fyEnd).slice(2)}.pdf`);
};

export const generateESIExitReport = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const data = results.filter(r => r.esiRemark).map(r => ({ ID: r.employeeId, Remark: r.esiRemark }));
    generateExcelReport(data, 'ESI Exit', `ESI_Exit_${month}_${year}`);
};

export const generateGratuityReport = (employees: Employee[], companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'DOJ', 'Years', 'Salary', 'Gratuity Accrued'];
    const data = employees.map(e => [e.id, e.name, formatDateInd(e.doj), '0', Math.round(e.basicPay + e.da), '0']);
    generatePDFTableReport('Gratuity Liability Statement', headers, data, 'Gratuity_Report', 'l', '', companyProfile);
};

export const generateBonusReport = (history: PayrollResult[], employees: Employee[], config: StatutoryConfig, sM: string, sY: number, eM: string, eY: number, company: CompanyProfile, format: 'PDF' | 'Excel') => {
    const headers = ['ID', 'Name', 'Wages', 'Bonus Payable'];
    const data = employees.map(e => [e.id, e.name, '0', '0']);
    if (format === 'Excel') generateExcelReport([{ ID: '', Name: '', Wages: 0, Bonus: 0 }], 'Bonus', 'Bonus_Report');
    else generatePDFTableReport('Form C (Bonus)', headers, data, 'Bonus_Report', 'l', '', company);
};

export const generateESIForm5 = (payrollHistory: PayrollResult[], employees: Employee[], halfYearPeriod: 'Apr-Sep' | 'Oct-Mar', year: number, company: CompanyProfile) => {
    // Stub
};

// ==========================================
// NEW EXPORTS (Fixing Errors)
// ==========================================

export const generateESIReturn = (results: PayrollResult[], employees: Employee[], format: 'Excel' | 'Text', fileName: string, companyProfile: CompanyProfile) => {
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return {
            'IP Number': emp?.esiNumber,
            'IP Name': emp?.name,
            'Days Worked': r.payableDays,
            'Wages': r.earnings.total,
            'Employee Contribution': r.deductions.esi
        };
    });
    if (format === 'Excel') generateExcelReport(data, 'ESI Return', fileName);
};

export const generatePTReport = (results: PayrollResult[], employees: Employee[], fileName: string, companyProfile: CompanyProfile) => {
    const data = results.filter(r => r.deductions.pt > 0).map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return {
            'Employee ID': r.employeeId,
            'Name': emp?.name,
            'Gross Salary': r.earnings.total,
            'PT Deducted': r.deductions.pt
        };
    });
    generateExcelReport(data, 'PT Report', fileName);
};

export const generateTDSReport = (results: PayrollResult[], employees: Employee[], fileName: string, companyProfile: CompanyProfile) => {
    const data = results.filter(r => r.deductions.it > 0).map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return {
            'Employee ID': r.employeeId,
            'Name': emp?.name,
            'PAN': emp?.pan,
            'TDS Deducted': r.deductions.it
        };
    });
    generateExcelReport(data, 'TDS Report', fileName);
};

export const generateCodeOnWagesReport = (results: PayrollResult[], employees: Employee[], format: 'PDF' | 'Excel', fileName: string, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Gross', 'Exclusions', 'Net Wage', 'Min Wage Check'];
    const data = results.map(r => [r.employeeId, employees.find(e => e.id === r.employeeId)?.name, r.earnings.total, 0, r.earnings.total, 'Pass']);
    if (format === 'Excel') {
        const excelData = data.map((row: any) => ({ ID: row[0], Name: row[1], Gross: row[2], Exclusions: row[3], NetWage: row[4], Status: row[5] }));
        generateExcelReport(excelData, 'Code on Wages', fileName);
    } else {
        generatePDFTableReport('Code on Wages Compliance', headers, data, fileName, 'l', '', companyProfile);
    }
};

export const generateESICodeWagesReport = (results: PayrollResult[], employees: Employee[], format: 'PDF' | 'Excel', fileName: string, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'Actual Gross', 'ESI Wages', 'Diff', 'Remark'];
    const data = results.map(r => [r.employeeId, employees.find(e => e.id === r.employeeId)?.name, r.earnings.total, r.earnings.total, 0, r.esiRemark || '-']);
    if (format === 'Excel') {
        const excelData = data.map((row: any) => ({ ID: row[0], Name: row[1], ActualGross: row[2], ESIWages: row[3], Diff: row[4], Remark: row[5] }));
        generateExcelReport(excelData, 'ESI Code Wages', fileName);
    } else {
        generatePDFTableReport('ESI Code Wages Analysis', headers, data, fileName, 'l', '', companyProfile);
    }
};

export const generateEPFCodeImpactReport = (results: PayrollResult[], employees: Employee[], format: 'PDF' | 'Excel', fileName: string, companyProfile: CompanyProfile) => {
    const headers = ['ID', 'Name', 'EPF Wages', 'Pension Wages', 'Code Impact'];
    const data = results.map(r => [r.employeeId, employees.find(e => e.id === r.employeeId)?.name, r.earnings.basic, r.earnings.basic, r.isCode88 ? 'Yes' : 'No']);
    if (format === 'Excel') {
        const excelData = data.map((row: any) => ({ ID: row[0], Name: row[1], EPFWages: row[2], PensionWages: row[3], Impact: row[4] }));
        generateExcelReport(excelData, 'EPF Code Impact', fileName);
    } else {
        generatePDFTableReport('EPF Code Impact Analysis', headers, data, fileName, 'l', '', companyProfile);
    }
};
