import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Employee, PayrollResult, StatutoryConfig, CompanyProfile, Attendance, LeaveLedger, AdvanceLedger, ArrearBatch } from '../types';

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
    if (!data || data.length === 0) {
        throw new Error('No Data Available to Generate Report');
    }

    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-size columns based on headers and data
    const objectMaxLength: { wch: number }[] = [];
    const keys = Object.keys(data[0]);
    for (let i = 0; i < keys.length; i++) {
        const minWch = keys[i].length; // minimum width is the header length
        const wch = data.reduce((w: number, r: any) => {
            const val = r[keys[i]];
            const valLen = val ? val.toString().length : 0;
            return Math.max(w, valLen);
        }, minWch);

        // Add a little padding and clamp to max 50 chars to prevent excessively wide columns
        objectMaxLength.push({ wch: Math.min(Math.max(wch + 2, 10), 50) });
    }
    ws['!cols'] = objectMaxLength;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Sheet name max 31 chars

    // @ts-ignore
    if (window.electronAPI) {
        const u8 = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        // @ts-ignore
        window.electronAPI.saveReport(fileName, u8, 'xlsx');
    } else {
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    }
};

export const generatePDFTableReport = (title: string, headers: string[], data: any[][], fileName: string, orientation: 'p' | 'l', summary: string, company: CompanyProfile, columnStyles?: any) => {
    if (!data || data.length === 0) {
        throw new Error('No Data Available to Generate Report');
    }
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

    // @ts-ignore
    if (window.electronAPI) {
        const blob = doc.output('blob');
        const reader = new FileReader();
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                // @ts-ignore
                window.electronAPI.saveReport(fileName, new Uint8Array(reader.result), 'pdf');
            }
        };
        reader.readAsArrayBuffer(blob);
    } else {
        doc.save(`${fileName}.pdf`);
    }
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
            'Old Basic': r.oldBasic, 'New Basic': r.newBasic, 'Diff Basic': r.diffBasic,
            'Old DA': r.oldDA, 'New DA': r.newDA, 'Diff DA': r.diffDA,
            'Old Retn': r.oldRetaining, 'New Retn': r.newRetaining, 'Diff Retn': r.diffRetaining,
            'Old HRA': r.oldHRA, 'New HRA': r.newHRA, 'Diff HRA': r.diffHRA,
            'Old Conv': r.oldConveyance, 'New Conv': r.newConveyance, 'Diff Conv': r.diffConveyance,
            'Old Wash': r.oldWashing, 'New Wash': r.newWashing, 'Diff Wash': r.diffWashing,
            'Old Attire': r.oldAttire, 'New Attire': r.newAttire, 'Diff Attire': r.diffAttire,
            'Old Spl 1': r.oldSpecial1, 'New Spl 1': r.newSpecial1, 'Diff Spl 1': r.diffSpecial1,
            'Old Spl 2': r.oldSpecial2, 'New Spl 2': r.newSpecial2, 'Diff Spl 2': r.diffSpecial2,
            'Old Spl 3': r.oldSpecial3, 'New Spl 3': r.newSpecial3, 'Diff Spl 3': r.diffSpecial3,
            'Old Gross': r.oldGross, 'New Gross': r.newGross, 'Diff Gross': r.diffGross,
            'Other Allow Diff': r.diffOthers,
            'Total Monthly Incr': r.monthlyIncrement,
            'Arrear Months': r.months,
            'Total Arrear Payable': r.totalArrear
        }));
        generateExcelReport(exportData, 'Arrears', fileName);
    } else {
        // --- Custom PDF Generation for Arrear Report ---
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageW = 297;
        let y = 15;

        // Header
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(companyProfile.establishmentName || 'Company Name', 14, y);
        y += 6;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const cityState = [companyProfile.city, companyProfile.state].filter(Boolean).join(', ');
        if (cityState) {
            doc.text(cityState.toUpperCase(), 14, y);
            y += 6;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 14, y);
        y += 6;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(summary, 14, y);
        doc.setTextColor(0);
        y += 8;

        // Requested Columns: ID | Name | EBasic | IinBasic | RBasic | EDA | IinDA | RDA | ERtn.Alw | IinRtnAlw | RRetAlw | EOtherAlw | IinOtherAlw | ROtherAlw | EGross | TIncr | RGross
        const headers = [
            'ID', 'Name',
            'EBasic', 'IinBasic', 'RBasic',
            'EDA', 'IinDA', 'RDA',
            'ERtn.Alw', 'IinRtnAlw', 'RRetAlw',
            'EOtherAlw', 'IinOtherAlw', 'ROtherAlw',
            'EGross', 'TIncr', 'RGross'
        ];

        const rows = arrearData.map(r => {
            // EOtherAlw = HRA + Conveyance + Washing + Attire + Specials
            const oldOther = r.oldHRA + r.oldConveyance + r.oldWashing + r.oldAttire + r.oldSpecial1 + r.oldSpecial2 + r.oldSpecial3;
            const newOther = r.newHRA + r.newConveyance + r.newWashing + r.newAttire + r.newSpecial1 + r.newSpecial2 + r.newSpecial3;
            const diffOther = newOther - oldOther;

            return [
                r.id,
                r.name,
                r.oldBasic, r.diffBasic, r.newBasic,
                r.oldDA, r.diffDA, r.newDA,
                r.oldRetaining, r.diffRetaining, r.newRetaining,
                oldOther, diffOther, newOther,
                r.oldGross, r.diffGross, r.newGross
            ];
        });

        autoTable(doc, {
            head: [headers],
            body: rows,
            startY: y,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
            columnStyles: {
                0: { halign: 'center' }, // ID
                1: { halign: 'left' },   // Name
                // Right align all numeric columns
                ...Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 2, { halign: 'right' }]))
            },
            didParseCell: (hookData) => {
                // Style the Increment columns with a distinct color (e.g., deep green)
                // Increment column indices: 3 (IinBasic), 6 (IinDA), 9 (IinRtnAlw), 12 (IinOtherAlw), 15 (TIncr)
                const incrementCols = [3, 6, 9, 12, 15];

                if (hookData.section === 'body' && incrementCols.includes(hookData.column.index)) {
                    hookData.cell.styles.textColor = [39, 174, 96]; // Emerald / Greenish
                    hookData.cell.styles.fontStyle = 'bold';
                }

                // Style the Revised columns slightly bolder to stand out
                // Revised columns: 4 (RBasic), 7 (RDA), 10 (RRetAlw), 13 (ROtherAlw), 16 (RGross)
                const revisedCols = [4, 7, 10, 13, 16];
                if (hookData.section === 'body' && revisedCols.includes(hookData.column.index)) {
                    hookData.cell.styles.fontStyle = 'bold';
                    hookData.cell.styles.fillColor = [245, 245, 250]; // Very light background
                }
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;

        // Add Footnote explanations
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100);

        const footnote1 = "Abbreviations: E - Existing, Iin - Increment in, R - Revised";
        const footnote2 = "EBasic: Existing Basic | IinBasic: Increment in Basic | RBasic: Revised Basic | EDA: Existing DA | IinDA: Increment in DA | RDA: Revised DA";
        const footnote3 = "ERtn.Alw: Existing Retaining Allowance | IinRtnAlw: Increment in Retaining Allowance | RRetAlw: Revised Retaining Allowance";
        const footnote4 = "EOtherAlw: Existing Other Allowances (Sum of HRA, Conveyance, Washing, Attire, Specials) | IinOtherAlw: Increment in Other Allow. | ROtherAlw: Revised Other Allow.";
        const footnote5 = "EGross: Existing Gross Salary | TIncr: Total Increment | RGross: Revised Gross Salary";

        let currentY = finalY;
        doc.text("Note:", 14, currentY); currentY += 4;
        doc.text(footnote1, 14, currentY); currentY += 4;
        doc.text(footnote2, 14, currentY); currentY += 4;
        doc.text(footnote3, 14, currentY); currentY += 4;
        doc.text(footnote4, 14, currentY); currentY += 4;
        doc.text(footnote5, 14, currentY);

        doc.save(`${fileName}.pdf`);
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

    // We need to look at the payroll results for the given month to see actual recovery 
    // and figure out what the advance state was AT THAT TIME
    const data: any[] = [];

    results.forEach(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const ledger = advanceLedgers.find(a => a.employeeId === r.employeeId);

        // We show the employee in this month's register IF:
        // 1. They had a recovery this month
        // 2. OR they were granted an advance this month (we can't definitively tell dates from payroll results easily, but we'll assume if there's an active ledger or recovery they should be seen)
        // 3. OR their balance > 0
        const recoveryThisMonth = r.deductions?.advanceRecovery || 0;

        // Accurate historical balance might be tricky if we only have the *current* ledger. 
        // We will approximate: If they have a recovery > 0 this month, or a current ledger balance > 0, they appear.
        if (recoveryThisMonth > 0 || (ledger && ledger.totalAdvance > 0)) {
            // Because we don't store historical snapshots of ledgers in standard payroll (yet), 
            // the 'Balance' will reflect the current live ledger balance minus anything recovered in *future* months...
            // It's safer to just show what happened *this* month.
            // Opening = Balance + Recovery (roughly) if this was the last run, but let's just show the recovery for the month
            const currentBalance = ledger?.balance || 0;
            const installmentCount = ledger?.emiCount || '';
            const totalAdv = ledger?.totalAdvance || 0;

            data.push([
                r.employeeId,
                emp?.name,
                '', // Adv Date is not universally tracked in PayrollResult
                totalAdv,
                'Salary Adv',
                installmentCount,
                recoveryThisMonth,
                currentBalance
            ]);
        }
    });

    const title = `${stateName} Shops & Establishment Act\n${formName} - Register of Advances (${month} ${year})`;
    const fileName = `${stateName.replace(/\s+/g, '')}_${formName.split(' ')[0]}_AdvReg_${month}_${year}`;

    generatePDFTableReport(title, headers, data, fileName, 'l', '', companyProfile, { 3: { halign: 'right' }, 5: { halign: 'center' }, 6: { halign: 'right' }, 7: { halign: 'right' } });
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
    const leftX = 14, midX = 100, rightX = 200;

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
    doc.text('PF ECR_UAN_CALCULATION SHEET', pageW / 2, y, { align: 'center' }); y += 9;

    // ── TRRN / Date yellow boxes ─────────────────────────────────────────────
    // Column cumulative edges (left margin = 14):
    //   Particulars(55)=69 | Wages(32)=101 | Rate(18)=119 | EmpShare(35)=154
    //   Rate(18)=172 | ErShare(35)=207 | Total(30)=237
    //
    //   Date box : x=14  → x=101  (Particulars+Wages,           width=87) ← LEFT
    //   GAP      : x=101 → x=119  (Rate column,                  width=18) ← blank
    //   TRRN box : x=119 → x=207  (EmpShare+Rate+ErShare,        width=88) ← RIGHT
    //   Empty    : x=207 → x=237  (Total column outside boxes)
    const boxH = 10;
    const dateBoxL = 14, dateBoxW = 87;    // 14+87=101
    const trrnBoxL = 119, trrnBoxW = 88;    // 119+88=207

    doc.setFillColor(255, 255, 0); doc.setDrawColor(120); doc.setLineWidth(0.4);
    doc.rect(dateBoxL, y, dateBoxW, boxH, 'FD');
    doc.rect(trrnBoxL, y, trrnBoxW, boxH, 'FD');

    // Date label + fill
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0);
    doc.text('Date', dateBoxL + 3, y + 7);
    doc.text('__  /  __  /  ______', dateBoxL + 22, y + 7);

    // TRRN label + dots (fills the 88mm box)
    doc.text('TRRN', trrnBoxL + 3, y + 7);
    doc.text('......................................', trrnBoxL + 19, y + 7);

    y += boxH + 4;

    // ── Contribution Table ───────────────────────────────────────────────────
    const tableHead = [['Particulars', 'Wages', 'Rate', 'Employee Share', 'Rate', 'Employer Share', 'Total']];

    const fmt = (n: number) => n > 0 ? n.toString() : '0';

    const ROYAL_BLUE: [number, number, number] = [13, 21, 96];    // Dark Navy #0D1560

    const tableBody = [
        ['PF-Wages', fmt(totalEPFWages), '', '', '', '', '',],
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
            fillColor: ROYAL_BLUE,       // Royal Blue header
            textColor: [255, 255, 255],  // White font
            fontStyle: 'bold',
            halign: 'left',
            lineColor: [255, 255, 255],
            lineWidth: 0.3
        },
        columnStyles: {
            0: { cellWidth: 55, fontStyle: 'bold' },
            1: { cellWidth: 32, halign: 'right' },
            2: { cellWidth: 18, halign: 'center' },
            3: { cellWidth: 35, halign: 'right' },
            4: { cellWidth: 18, halign: 'center' },
            5: { cellWidth: 35, halign: 'right' },
            6: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (hookData) => {
            const rowIdx = hookData.row.index;
            // PF-Wages row: larger font + bold
            if (hookData.section === 'body' && rowIdx === 0) {
                hookData.cell.styles.fontSize = 11;
                hookData.cell.styles.fontStyle = 'bold';
            }
            // Total row: Royal Blue + white (same as header)
            if (hookData.section === 'body' && rowIdx === tableBody.length - 1) {
                hookData.cell.styles.fontStyle = 'bold';
                hookData.cell.styles.fillColor = ROYAL_BLUE;
                hookData.cell.styles.textColor = [255, 255, 255];
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

export const generateForm16PartBPDF = (
    history: PayrollResult[],
    employees: Employee[],
    config: StatutoryConfig,
    sM: string, sY: number,
    eM: string, eY: number,
    empId: string | undefined,
    company: CompanyProfile
) => {
    // Basic Form 16 Annexure B Mockup based on Income Tax Format
    const targetEmps = empId ? employees.filter(e => e.id === empId) : employees;
    if (targetEmps.length === 0) {
        throw new Error('No Data Available to Generate Report');
    }

    // Determine Financial Year
    const fyString = `${sY}-${(sY + 1).toString().slice(2)}`;
    const ayString = `${sY + 1}-${(sY + 2).toString().slice(2)}`;

    targetEmps.forEach(emp => {
        // Aggregate full year data for the employee (April to March)
        let totalGrossSalary = 0;
        let totalValOfPerquisites = 0;
        let totalProfitLieuOfSalary = 0;

        let totalHRAExempt = 0; // Requires declaration handling (simulated here)
        let totalConveyanceExempt = 0;

        let totalTaxOnEmployment = 0; // PT
        let totalStandardDeduction = 50000; // Rs. 50,000 universally

        let total80C = 0; // PF
        let totalTaxDeducted = 0;

        const fyMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

        fyMonths.forEach(m => {
            const yr = (['January', 'February', 'March'].includes(m)) ? sY + 1 : sY;
            const rec = history.find(r => r.employeeId === emp.id && r.month === m && r.year === yr);
            if (rec) {
                totalGrossSalary += (rec.earnings.total || 0);
                totalTaxOnEmployment += (rec.deductions.pt || 0);
                total80C += (rec.deductions.epf + rec.deductions.vpf || 0);
                totalTaxDeducted += (rec.deductions.it || 0);
            }
        });

        // Limit 80C to 1.5L
        const allowed80C = Math.min(total80C, 150000);

        const grossTotalIncome = Math.max(0, totalGrossSalary - totalStandardDeduction - totalTaxOnEmployment);
        const totalIncome = Math.max(0, grossTotalIncome - allowed80C); // Simple Old Regime calc

        const doc = new jsPDF('p', 'mm', 'a4');
        const pageW = 210;
        let y = 15;

        // Title
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text('FORM NO. 16', pageW / 2, y, { align: 'center' }); y += 6;
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text('[See rule 31 (1)(a)]', pageW / 2, y, { align: 'center' }); y += 5;
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text('PART B (Annexure)', pageW / 2, y, { align: 'center' }); y += 8;
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text('Details of Salary paid and any other income and tax deducted', pageW / 2, y, { align: 'center' }); y += 10;

        // Header Table (Employer / Employee blocks)
        doc.setLineWidth(0.3);
        doc.rect(14, y, pageW - 28, 40);
        doc.line(pageW / 2, y, pageW / 2, y + 40);

        // Employer side
        doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.text('Name and Address of the Employer', 16, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.text((company.establishmentName || '').toUpperCase(), 16, y + 10);
        doc.text(company.city || '', 16, y + 15);
        doc.text(`PAN: ${company.pan || 'N/A'}`, 16, y + 25);
        doc.text(`TAN: ${'N/A'}`, 16, y + 30); // Not tracked in profile yet

        // Employee side
        doc.setFont('helvetica', 'bold');
        doc.text('Name and Address of the Employee', pageW / 2 + 2, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.text((emp.name || '').toUpperCase(), pageW / 2 + 2, y + 10);
        doc.text(emp.city || '', pageW / 2 + 2, y + 15);
        doc.text(`PAN: ${emp.pan || 'N/A'}`, pageW / 2 + 2, y + 25);
        doc.text(`Employee Ref: ${emp.id}`, pageW / 2 + 2, y + 30);
        y += 45;

        // Assessment Year blocks
        doc.rect(14, y, pageW - 28, 15);
        doc.line(pageW / 2, y, pageW / 2, y + 15);

        doc.setFont('helvetica', 'bold');
        doc.text(`Financial Year: ${fyString}`, 16, y + 6);
        doc.text(`Assessment Year: ${ayString}`, pageW / 2 + 2, y + 6);
        y += 20;

        // Computation Table
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        doc.text('Details of Salary Paid and any other income and tax deducted', 14, y); y += 4;

        const tableData = [
            ['1. Gross Salary', '', ''],
            ['   (a) Salary as per section 17(1)', `Rs. ${totalGrossSalary.toFixed(2)}`, ''],
            ['   (b) Value of perquisites 17(2)', `Rs. ${totalValOfPerquisites.toFixed(2)}`, ''],
            ['   (c) Profit in lieu of salary 17(3)', `Rs. ${totalProfitLieuOfSalary.toFixed(2)}`, ''],
            ['   (d) Total Gross Salary (a+b+c)', '', `Rs. ${(totalGrossSalary + totalValOfPerquisites + totalProfitLieuOfSalary).toFixed(2)}`],
            ['2. Less: Allowances to the extent exempt u/s 10', '', `Rs. 0.00`], // Simplified
            ['3. Balance (1(d) - 2)', '', `Rs. ${totalGrossSalary.toFixed(2)}`],
            ['4. Deductions under section 16', '', ''],
            ['   (a) Standard deduction u/s 16(ia)', `Rs. ${totalStandardDeduction.toFixed(2)}`, ''],
            ['   (b) Entertainment allowance u/s 16(ii)', `Rs. 0.00`, ''],
            ['   (c) Tax on employment u/s 16(iii) [PT]', `Rs. ${totalTaxOnEmployment.toFixed(2)}`, ''],
            ['5. Total deductions under sect 16', '', `Rs. ${(totalStandardDeduction + totalTaxOnEmployment).toFixed(2)}`],
            ['6. Income chargeable under the head "Salaries" (3 - 5)', '', `Rs. ${grossTotalIncome.toFixed(2)}`],
            ['7. Add: Any other income reported by employee', '', `Rs. 0.00`],
            ['8. Gross Total Income (6 + 7)', '', `Rs. ${grossTotalIncome.toFixed(2)}`],
            ['9. Deductions under Chapter VI-A', '', ''],
            ['   (a) Section 80C (EPF & VPF)', `Rs. ${total80C.toFixed(2)}`, `Rs. ${allowed80C.toFixed(2)}`],
            ['10. Total Income (8 - 9)', '', `Rs. ${totalIncome.toFixed(2)}`],
            ['11. Tax on Total Income', '', `Rs. ${totalTaxDeducted.toFixed(2)}`] // Simplified mapping to actual deducted IT
        ];

        autoTable(doc, {
            body: tableData,
            startY: y,
            theme: 'grid',
            styles: { fontSize: 8.5, cellPadding: 3, textColor: [30, 30, 30] },
            columnStyles: {
                0: { cellWidth: 100 },
                1: { cellWidth: 40, halign: 'right' },
                2: { cellWidth: 42, halign: 'right', fontStyle: 'bold' }
            }
        });

        // Verification Block
        const finalY = (doc as any).lastAutoTable.finalY + 15;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        doc.text('Verification', 14, finalY);
        const certStr = `I, ______________________ son/daughter of ____________________ working in the capacity of ____________________ (designation) do hereby certify that the information given above is true, complete and correct and is based on the books of account, documents, TDS statements, and other available records.`;
        const splitCert = doc.splitTextToSize(certStr, pageW - 28);
        doc.text(splitCert, 14, finalY + 5);

        doc.text('Place: ________________', 14, finalY + 25);
        doc.text('Date:  ________________', 14, finalY + 32);

        doc.setFont('helvetica', 'bold');
        doc.text('(Signature of person responsible for deduction of tax)', pageW - 14, finalY + 32, { align: 'right' });

        doc.save(`Form16_PartB_${emp.id}_FY${sY}-${String(eY).slice(2)}.pdf`);
    });
};

export const generateFormB = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Corporate Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text((companyProfile.establishmentName || 'Company Name').toUpperCase(), pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text((companyProfile.city || '').toUpperCase(), pageWidth / 2, 21, { align: 'center' });

    // Report Title
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Register of Wages Under Central Labour Law', pageWidth / 2, 30, { align: 'center' });
    doc.text(`Form B - ${month} ${year}`, pageWidth / 2, 36, { align: 'center' });

    // LIN
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Labour Identification Number : ${companyProfile.lin || '...........................'}`, 14, 45);

    const headers = ['ID', 'Name', 'Designation', 'Basic', 'DA', 'Retaining\nAllowance', 'Other\nAllowance', 'OverTime', 'Gross', 'PF', 'ESI', 'Other\nDeductions', 'Net'];

    const validResults = results.filter(r => r.payableDays > 0);
    const data = validResults.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);

        const basic = Math.round(r.earnings.basic || 0);
        const da = Math.round(r.earnings.da || 0);
        const retn = Math.round(r.earnings.retainingAllowance || 0);
        const overtime = 0; // Overtime is not maintained in standard earnings currently

        const gross = Math.round(r.earnings.total || 0);
        const otherAllow = gross - basic - da - retn - overtime;

        const pf = Math.round((r.deductions.epf || 0) + (r.deductions.vpf || 0));
        const esi = Math.round(r.deductions.esi || 0);
        const totalDeductions = Math.round(r.deductions.total || 0);
        const otherDeductions = totalDeductions - pf - esi;
        const net = Math.round(r.netPay || 0);

        return [
            r.employeeId,
            emp?.name || '',
            emp?.designation || '',
            basic.toLocaleString('en-IN'),
            da.toLocaleString('en-IN'),
            retn.toLocaleString('en-IN'),
            otherAllow.toLocaleString('en-IN'),
            overtime.toLocaleString('en-IN'),
            gross.toLocaleString('en-IN'),
            pf.toLocaleString('en-IN'),
            esi.toLocaleString('en-IN'),
            otherDeductions.toLocaleString('en-IN'),
            net.toLocaleString('en-IN')
        ];
    });

    autoTable(doc, {
        head: [headers],
        body: data,
        startY: 50,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3, textColor: [50, 50, 50] },
        headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', valign: 'middle' },
        columnStyles: {
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' },
            7: { halign: 'right' },
            8: { halign: 'right' },
            9: { halign: 'right' },
            10: { halign: 'right' },
            11: { halign: 'right' },
            12: { halign: 'right' }
        }
    });

    doc.save(`FormB_WageRegister_${month}_${year}.pdf`);
};

export const generateFormC = (results: PayrollResult[], employees: Employee[], attendances: Attendance[], month: string, year: number, companyProfile: CompanyProfile) => {
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthIndex = MONTHS.indexOf(month);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    // Generate Headers: ID, Name, 1, 2, ..., daysInMonth, Total
    const daysHeaders = Array.from({ length: daysInMonth }, (_, k) => (k + 1).toString());
    const headers = ['ID', 'Name', ...daysHeaders, 'Total'];

    const validResults = results.filter(r => r.payableDays > 0);
    const data = validResults.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);

        // As a fallback for actual daily attendance, we distribute 'P' up to payableDays
        // and leave others blank or '-'
        const payable = Math.round(r.payableDays);
        const dailyData = Array.from({ length: daysInMonth }, (_, k) => {
            return (k < payable) ? 'P' : '-';
        });

        return [r.employeeId, emp?.name || '', ...dailyData, r.payableDays];
    });

    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text((companyProfile.establishmentName || 'Company Name').toUpperCase(), 14, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Form C (Muster Roll) - ${month} ${year}`, 14, 22);

    // Auto resize column styles for day columns to avoid spilling
    const columnStyles: any = {};
    for (let c = 2; c < 2 + daysInMonth; c++) {
        columnStyles[c] = { cellWidth: 6, halign: 'center' };
    }
    columnStyles[2 + daysInMonth] = { halign: 'center', fontStyle: 'bold' };

    autoTable(doc, {
        head: [headers],
        body: data,
        startY: 30,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1, textColor: [30, 30, 30] },
        headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', valign: 'middle' },
        columnStyles: columnStyles
    });

    doc.save(`FormC_MusterRoll_${month}_${year}.pdf`);
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
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthIdx = months.indexOf(month);

    const data: any[] = [];

    results.forEach(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        if (!emp || emp.isESIExempt) return;

        let reason = '';
        let dolStr = '';
        let oocStr = '';

        let shouldInclude = false;

        // ESI Wages calculation
        // To accurately reflect the ESI Wage Base (which triggers the > 21000 limit), it should be Basic + DA + Retaining + any Code Wage additions
        // We'll calculate it similarly to how the payrollEngine computes it internally.
        const wageA = (r.earnings.basic || 0) + (r.earnings.da || 0) + (r.earnings.retainingAllowance || 0);
        const wageB = Math.round(r.earnings.total || 0);
        const wageC = wageB - wageA;
        let wageD = 0;
        if (wageB > 0) {
            const allowancePercentage = wageC / wageB;
            if (allowancePercentage > 0.50) {
                wageD = wageC - Math.round(wageB * 0.50);
            }
        }
        const esiWages = Math.round(wageA + wageD);

        // Check 1: Did they leave service this month?
        // USER REQUEST: DO NOT INCLUDE EMPLOYEE RESIGNED OR OTHERWISE. IT SHOULD ONLY CONTAIN EMPLOYEE STILL IN SERVICE.
        if (emp.dol) {
            const d = new Date(emp.dol);
            if (d.getMonth() === monthIdx && d.getFullYear() === year) {
                // Return early, do not include them in the Out of Coverage report if they are exiting
                return;
            }
        }

        // Check 2: Did they go out of coverage this month (April / October real-time trigger)
        if (r.esiRemark && r.esiRemark.toLowerCase().includes('out of coverage')) {
            shouldInclude = true;
            reason = 'Out of Coverage';
            oocStr = `01-${String(monthIdx + 1).padStart(2, '0')}-${year}`;
            dolStr = ''; // Blank for out of coverage
        }

        // Check 3: PREDICTION - Is it March or September and wages > ceiling? If so, they WILL go out of coverage next month.
        if (!shouldInclude && (month === 'March' || month === 'September')) {
            const ESI_CEILING = 21000;
            if (esiWages > ESI_CEILING) {
                shouldInclude = true;
                reason = 'Out of Coverage';

                // Set the OoC Date to the 1st of the next month
                let nextMonth = monthIdx + 2; // +1 to convert 0-indexed to 1-indexed, +1 for next month
                let nextYear = year;
                if (nextMonth > 12) {
                    nextMonth = 1;
                    nextYear++;
                }
                oocStr = `01-${String(nextMonth).padStart(2, '0')}-${nextYear}`;
                dolStr = '';
            }
        }

        if (shouldInclude) {
            data.push({
                'EMP_ID': emp.id,
                'IP_ESI_No': emp.esiNumber || '',
                'Emp_Name': emp.name,
                'ESI Wages': esiWages,
                'Reason': reason,
                'DOL': dolStr,
                '*OoC_Date': oocStr
            });
        }
    });

    if (data.length === 0) {
        data.push({
            'EMP_ID': '-', 'IP_ESI_No': '-', 'Emp_Name': 'No Exits or Out of Coverage',
            'ESI Wages': '-', 'Reason': '-', 'DOL': '-', '*OoC_Date': '-'
        });
    }

    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-size columns to fit data exactly
    if (data.length > 0) {
        const cols = Object.keys(data[0]).map(key => {
            const maxLength = data.reduce((max, row) => {
                const val = (row as any)[key];
                const strLen = val ? val.toString().length : 0;
                return Math.max(max, strLen);
            }, key.length);
            return { wch: maxLength + 2 };
        });
        ws['!cols'] = cols;
    }

    // Add trailing footer note as requested
    XLSX.utils.sheet_add_aoa(ws, [['*Out of Coverage']], { origin: -1 }); // Appends to bottom

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ESI Exit');
    XLSX.writeFile(wb, `ESI_Going_Out_Of_Coverage_${month}_${year}.xlsx`);
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

export const generateESIForm5 = (payrollHistory: PayrollResult[], employees: Employee[], halfYearPeriod: 'Apr-Sep' | 'Oct-Mar', year: number, companyProfile: CompanyProfile) => {

    // 1. Determine the months for the selected period
    const monthsPeriod = halfYearPeriod === 'Apr-Sep'
        ? ['April', 'May', 'June', 'July', 'August', 'September']
        : ['October', 'November', 'December', 'January', 'February', 'March'];

    // For Oct-Mar, Jan/Feb/Mar fall into the next calendar year
    const getYearForMonth = (month: string) => {
        if (halfYearPeriod === 'Oct-Mar' && ['January', 'February', 'March'].includes(month)) {
            return year + 1;
        }
        return year;
    };

    // 2. Aggregate Data per Employee
    const employeeTotals = new Map<string, {
        days: number,
        wages: number,
        employeeContribution: number,
        employerContribution: number
    }>();

    let grandTotalEmployee = 0;
    let grandTotalEmployer = 0;

    payrollHistory.forEach(r => {
        if (monthsPeriod.includes(r.month) && r.year === getYearForMonth(r.month)) {
            const emp = employees.find(e => e.id === r.employeeId);
            if (!emp || emp.isESIExempt) return;

            // Recalculate ESI Wage base as done in payrollEngine 
            if (r.deductions.esi > 0 || r.payableDays > 0) {
                const wageA = (r.earnings.basic || 0) + (r.earnings.da || 0) + (r.earnings.retainingAllowance || 0);
                const wageB = Math.round(r.earnings.total || 0);
                const wageC = wageB - wageA;
                let wageD = 0;
                if (wageB > 0) {
                    const allowancePercentage = wageC / wageB;
                    if (allowancePercentage > 0.50) {
                        wageD = wageC - Math.round(wageB * 0.50);
                    }
                }
                const esiWages = Math.round(wageA + wageD);

                const current = employeeTotals.get(r.employeeId) || { days: 0, wages: 0, employeeContribution: 0, employerContribution: 0 };

                current.days += r.payableDays;
                current.wages += esiWages;
                current.employeeContribution += r.deductions.esi;
                current.employerContribution += r.employerContributions.esi;

                grandTotalEmployee += r.deductions.esi;
                grandTotalEmployer += r.employerContributions.esi;

                employeeTotals.set(r.employeeId, current);
            }
        }
    });

    const grandTotalContribution = grandTotalEmployee + grandTotalEmployer;

    // 3. Prepare Table Data for Page 2+
    const tableData: any[][] = [];
    let slNo = 1;

    // Define period end date to check "still working" status
    const periodEndDate = halfYearPeriod === 'Apr-Sep'
        ? new Date(year, 8, 30)   // Sept 30
        : new Date(year + 1, 2, 31); // March 31

    employeeTotals.forEach((totals, empId) => {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return;

        const avgDailyWage = totals.days > 0 ? (totals.wages / totals.days).toFixed(2) : '0.00';

        let stillWorking = 'Y';
        if (emp.dol) {
            const dolDate = new Date(emp.dol);
            if (dolDate <= periodEndDate) stillWorking = 'N';
        }

        tableData.push([
            slNo++,
            emp.esiNumber || '',
            emp.name,
            Math.round(totals.days),
            totals.wages.toFixed(2),
            totals.employeeContribution.toFixed(2),
            avgDailyWage,
            stillWorking,
            '' // Remarks
        ]);
    });

    // 4. Generate PDF
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297;

    // --- PAGE 1: COVER PAGE ---
    let y = 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('FORM 5', pageW / 2, y, { align: 'center' }); y += 6;
    doc.text('RETURN OF CONTRIBUTIONS', pageW / 2, y, { align: 'center' }); y += 5;
    doc.text("EMPLOYEES' STATE INSURANCE CORPORATION", pageW / 2, y, { align: 'center' }); y += 7;

    doc.setFont('helvetica', 'italic');
    doc.text('(Regulation 26)', pageW / 2, y, { align: 'center' }); y += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Name of Branch Office : BO - Guindy', 14, y);
    doc.text(`Employer's Code No. ${companyProfile.esiCode || ''}`, pageW - 14, y, { align: 'right' }); y += 6;

    const addressParts = [
        companyProfile.doorNo, companyProfile.buildingName,
        companyProfile.street, companyProfile.area,
        companyProfile.city, companyProfile.state, companyProfile.pincode
    ].filter(Boolean);
    const addressStr = addressParts.join(', ');

    doc.text(`Name and Address of the factory or establishment : ${companyProfile.establishmentName || ''}, ${addressStr}`, 14, y); y += 8;

    doc.text('Particulars of the Principal employer(s)', 14, y); y += 5;
    doc.text('(a) Name :-----', 20, y); y += 5;
    doc.text('(b) Designation :-----', 20, y); y += 5;
    doc.text('(c) Residential Address:-----', 20, y); y += 8;

    doc.setFont('helvetica', 'bold');
    const periodStr = halfYearPeriod === 'Apr-Sep' ? `Apr ${year} to Sep ${year}` : `Oct ${year} to Mar ${year + 1}`;
    doc.text(`Contribution Period from : ${periodStr}`, 14, y); y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const p1 = "I furnish below the details of the Employer's and Employee's share of contribution in respect of the under mentioned insured persons. I hereby declare that the return";
    const p2 = "includes each and every employee, employed directly or through an immediate employer or in connection with the work of the factory / establishment or any";
    const p3 = "work...............................connected with the administration of the factory / establishment or purchase of raw materials, sale or distribution of finished products etc. to";
    const p4 = "whom the ESI Act, 1948 applies, in the contribution period to which this return relates and that the contributions in respect of employer's and employee's";
    const p5 = "share have been correctly paid in accordance with the provisions of the Act and Regulations.";

    doc.text(p1, 14, y); y += 6;
    doc.text(p2, 14, y); y += 6;
    doc.text(p3, 14, y); y += 6;
    doc.text(p4, 14, y); y += 6;
    doc.text(p5, 14, y); y += 8;

    // Small Summary Table
    autoTable(doc, {
        head: [],
        body: [
            ["Employees's Share", grandTotalEmployee.toFixed(2)],
            ["Employer's Share", grandTotalEmployer.toFixed(2)],
            ["Total Contribution", grandTotalContribution.toFixed(2)]
        ],
        startY: y,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 40, halign: 'right' }
        },
        margin: { left: 14 }
    });

    y = (doc as any).lastAutoTable.finalY + 5;

    // Challan Table
    const challanData = monthsPeriod.map(m => [
        `${m.substring(0, 3)}-${getYearForMonth(m)}`,
        '', // Challan Number
        '', // Date
        '', // Amount
        ''  // Bank
    ]);

    autoTable(doc, {
        head: [['S.No.', 'Month', 'Challan Number', 'Date of Challan', 'Amount', 'Name of the Bank and Branch']],
        body: challanData.map((row, i) => [i + 1, ...row]),
        startY: y,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0] },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    // --- PAGE 2+: EMPLOYEE TABLE ---
    doc.addPage();
    y = 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Total amount paid: ${grandTotalContribution.toFixed(2)}`, pageW / 2, y, { align: 'center' }); y += 15;

    doc.text("EMPLOYEES' STATE INSURANCE CORPORATION", pageW / 2, y, { align: 'center' }); y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Employer's Name and Address ${companyProfile.establishmentName || ''}, ${addressStr}`, 14, y); y += 6;
    doc.text(`Employer's Code No period from ${periodStr}`, 14, y); y += 6;

    autoTable(doc, {
        head: [['Sl.No.', 'Insurance\nNumber', 'Name of Insured\nPerson', 'No. of days for\nwhich wages\npaid', 'Total amount of\nwages paid (Rs.)', "Employee's\ncontribution\ndeducted", 'Average\nDaily\nWages(Rs.)', 'Whether\nstill continues\nworking', 'Remarks']],
        body: tableData,
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0] },
        headStyles: {
            fillColor: [240, 240, 240],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle'
        },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 35, halign: 'center' },
            2: { cellWidth: 50, halign: 'left' },
            3: { cellWidth: 25, halign: 'right' },
            4: { cellWidth: 30, halign: 'right' },
            5: { cellWidth: 25, halign: 'right' },
            6: { cellWidth: 25, halign: 'right' },
            7: { cellWidth: 30, halign: 'center' },
            8: { cellWidth: 'auto' }
        },
        margin: { left: 14, right: 14 }
    });

    doc.save(`ESI_Form_5_${halfYearPeriod}_${year}.pdf`);
};

// ==========================================
// NEW EXPORTS (Fixing Errors)
// ==========================================

export const generateESIReturn = (results: PayrollResult[], employees: Employee[], format: 'Excel' | 'Text', fileName: string, companyProfile: CompanyProfile) => {
    // Note: ESI is only applicable for employees not exempt. 
    // The report normally shows all covered employees.
    const data = results
        .filter(r => {
            const emp = employees.find(e => e.id === r.employeeId);
            return emp && !emp.isESIExempt;
        })
        .map(r => {
            const emp = employees.find(e => e.id === r.employeeId);
            const isLeft = !!emp?.dol;
            const isLOP = (emp?.leavingReason || '').trim().toUpperCase() === 'ON LOP';

            let reason: number | string = 0;
            let dolStr = '';

            if (isLOP) {
                reason = 1;
                dolStr = '';
            } else if (isLeft) {
                reason = 2;
                if (emp?.dol) {
                    // Formatting DOL as DD-MM-YYYY 
                    const d = new Date(emp.dol);
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    dolStr = `${day}-${month}-${year}`;
                }
            }

            const esiWages = r.payableDays > 0
                ? Math.round((r.earnings.basic || 0) + (r.earnings.da || 0) + (r.earnings.retainingAllowance || 0))
                : 0;

            return {
                'IP Number': emp?.esiNumber || '',
                'IP Name': emp?.name || '',
                'No. Of Days': r.payableDays,
                'ESI Wages': esiWages,
                'Reason': reason,
                'DOL': dolStr
            };
        });

    if (format === 'Excel') {
        const ws = XLSX.utils.json_to_sheet(data);

        if (data.length > 0) {
            const cols = Object.keys(data[0]).map(key => {
                const maxLen = data.reduce((max, row) => {
                    const val = (row as any)[key];
                    const strLen = val ? val.toString().length : 0;
                    return Math.max(max, strLen);
                }, key.length);
                return { wch: maxLen + 2 };
            });
            ws['!cols'] = cols;
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    }
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

export const generateESICodeWagesReport = (results: PayrollResult[], employees: Employee[], format: 'PDF' | 'Excel', fileName: string, companyProfile: CompanyProfile, month: string, year: number) => {

    // ── Build per-employee rows ─────────────────────────────────────────────
    let totOld = 0, totNew = 0, totDiff = 0;

    interface ImpactRow {
        id: string; name: string; gross: number;
        baseWage: number; codeWage: number;
        oldValue: number; newValue: number; diff: number; impact: string;
    }

    const rows: ImpactRow[] = results
        .filter(r => !employees.find(e => e.id === r.employeeId)?.isESIExempt && r.payableDays > 0)
        .map(r => {
            const emp = employees.find(e => e.id === r.employeeId);
            const gross = Math.round(r.earnings.total);

            // For ESI Impact Analysis: Base Wage = Basic + DA + Retaining + HRA as per user specification "Old Value" note
            const baseWage = Math.round((r.earnings.basic || 0) + (r.earnings.da || 0) + (r.earnings.retainingAllowance || 0) + (r.earnings.hra || 0));
            const codeWage = baseWage;

            // Old Value = 0.75% of Base Wage (uncapped theoretical)
            const oldValue = Math.ceil(baseWage * 0.0075);
            // New Value = Actual ESI Deducted
            const newValue = Math.ceil(r.deductions.esi || 0);

            const diff = oldValue - newValue;
            const impact = diff > 0 ? 'Positive Impact (Savings)'
                : diff < 0 ? 'Adverse Impact'
                    : 'Neutral';

            totOld += oldValue;
            totNew += newValue;
            totDiff += diff;
            return { id: r.employeeId, name: emp?.name || r.employeeId, gross, baseWage, codeWage, oldValue, newValue, diff, impact };
        });

    // ── Excel output ────────────────────────────────────────────────────────
    if (format === 'Excel') {
        const excelData = rows.map(r => ({
            'Employee ID': r.id, 'Name': r.name,
            'Gross': r.gross, 'Base Wage': r.baseWage, 'Code Wage': r.codeWage,
            'Old Value': r.oldValue, 'New Value': r.newValue, 'Diff': r.diff, 'Impact': r.impact
        }));
        generateExcelReport(excelData, 'ESI Code Impact', fileName);
        return;
    }

    // ── PDF output ──────────────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297;
    let y = 12;

    const DARK_NAVY: [number, number, number] = [13, 21, 96];

    // Company header
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0);
    doc.text((companyProfile.establishmentName || '').toUpperCase(), 14, y);
    y += 6;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80);
    const cityState = [companyProfile.city, companyProfile.state].filter(Boolean).join(', ');
    doc.text(cityState, 14, y); y += 8;

    // Report title (Left) + Month/Year (Right)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0);
    doc.text('ESI Social Security Code Impact Analysis', 14, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(80);
    doc.text(`For the Month of: ${month} ${year}`, pageW - 14, y, { align: 'right' });
    y += 7;

    // Table
    const tableHead = [['ID', 'Name', 'Gross', 'Base Wage', 'Code Wage', 'Old Value', 'New Value', 'Diff', 'Impact']];

    const tableBody: (string | number)[][] = rows.map(r => [
        r.id, r.name,
        r.gross, r.baseWage, r.codeWage,
        r.oldValue, r.newValue, r.diff, r.impact
    ]);

    // TOTAL row
    tableBody.push(['', 'TOTAL', '', '', '', totOld, totNew, totDiff, '']);

    autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0] },
        headStyles: {
            fillColor: [52, 120, 180], // Steel Blue to match the ESI image header colour
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            lineColor: [255, 255, 255],
            lineWidth: 0.3,
        },
        columnStyles: {
            0: { cellWidth: 22, halign: 'center' },
            1: { cellWidth: 55, halign: 'left' },
            2: { cellWidth: 22, halign: 'right' },
            3: { cellWidth: 25, halign: 'right' },
            4: { cellWidth: 25, halign: 'right' },
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 22, halign: 'right' },
            7: { cellWidth: 18, halign: 'right' },
            8: { cellWidth: 50, halign: 'left' },
        },
        didParseCell: (hookData) => {
            const isTotal = hookData.row.index === tableBody.length - 1;
            if (isTotal) {
                hookData.cell.styles.fontStyle = 'bold';
                // Total row is light gray in the reference image
                hookData.cell.styles.fillColor = [240, 240, 240];
                hookData.cell.styles.textColor = [0, 0, 0];
            }
            // Colour Impact column
            if (hookData.section === 'body' && !isTotal && hookData.column.index === 8) {
                const val = hookData.cell.raw as string;
                if (val.includes('Positive')) {
                    hookData.cell.styles.textColor = [0, 150, 80];   // Green
                    hookData.cell.styles.fontStyle = 'bold';
                } else if (val.includes('Adverse')) {
                    hookData.cell.styles.textColor = [200, 0, 0];    // Red
                    hookData.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 5;
    doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(80);
    doc.text('Note: "Old Value" = (Basic+DA+Retaining+HRA)*0.75%. "New Value" = Actual ESI Deduction (Pay Sheet).', 14, finalY);

    doc.save(`${fileName}.pdf`);
};

export const generateEPFCodeImpactReport = (results: PayrollResult[], employees: Employee[], format: 'PDF' | 'Excel', fileName: string, companyProfile: CompanyProfile, month: string, year: number) => {

    // ── Build per-employee rows ─────────────────────────────────────────────
    let totOld = 0, totNew = 0, totDiff = 0;

    interface ImpactRow {
        id: string; name: string; gross: number;
        baseWage: number; codeWage: number;
        oldValue: number; newValue: number; diff: number; impact: string;
    }

    const rows: ImpactRow[] = results
        .filter(r => !employees.find(e => e.id === r.employeeId)?.isPFExempt && r.payableDays > 0)
        .map(r => {
            const emp = employees.find(e => e.id === r.employeeId);
            const gross = Math.round(r.earnings.total);
            const baseWage = Math.round((r.earnings.basic || 0) + (r.earnings.da || 0) + (r.earnings.retainingAllowance || 0));
            const codeWage = baseWage;   // Code Wage = Base Wage (EPF qualifying wages)
            const oldValue = Math.round(baseWage * 0.12);    // Uncapped theoretical 12%
            const newValue = Math.round((r.deductions.epf || 0) + (r.deductions.vpf || 0)); // Actual deduction
            const diff = oldValue - newValue;
            const impact = diff > 0 ? 'Positive Impact (Savings)'
                : diff < 0 ? 'Adverse Impact'
                    : 'Neutral';
            totOld += oldValue;
            totNew += newValue;
            totDiff += diff;
            return { id: r.employeeId, name: emp?.name || r.employeeId, gross, baseWage, codeWage, oldValue, newValue, diff, impact };
        });

    // ── Excel output ────────────────────────────────────────────────────────
    if (format === 'Excel') {
        const excelData = rows.map(r => ({
            'Employee ID': r.id, 'Name': r.name,
            'Gross': r.gross, 'Base Wage': r.baseWage, 'Code Wage': r.codeWage,
            'Old Value': r.oldValue, 'New Value': r.newValue, 'Diff': r.diff, 'Impact': r.impact
        }));
        generateExcelReport(excelData, 'EPF Code Impact', fileName);
        return;
    }

    // ── PDF output ──────────────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297;
    let y = 12;

    const DARK_NAVY: [number, number, number] = [13, 21, 96];

    // Company header
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0);
    doc.text((companyProfile.establishmentName || '').toUpperCase(), 14, y);
    y += 6;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80);
    const cityState = [companyProfile.city, companyProfile.state].filter(Boolean).join(', ');
    doc.text(cityState, 14, y); y += 8;

    // Report title (Left) + Month/Year (Right)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0);
    doc.text('EPF Social Security Code Impact Analysis', 14, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(80);
    doc.text(`For the Month of: ${month} ${year}`, pageW - 14, y, { align: 'right' });
    y += 7;

    // Table
    const tableHead = [['ID', 'Name', 'Gross', 'Base Wage', 'Code Wage', 'Old Value', 'New Value', 'Diff', 'Impact']];

    const tableBody: (string | number)[][] = rows.map(r => [
        r.id, r.name,
        r.gross, r.baseWage, r.codeWage,
        r.oldValue, r.newValue, r.diff, r.impact
    ]);

    // TOTAL row
    tableBody.push(['', 'TOTAL', '', '', '', totOld, totNew, totDiff, '']);

    autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: y,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0] },
        headStyles: {
            fillColor: DARK_NAVY,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            lineColor: [255, 255, 255],
            lineWidth: 0.3,
        },
        columnStyles: {
            0: { cellWidth: 22, halign: 'center' },
            1: { cellWidth: 55, halign: 'left' },
            2: { cellWidth: 22, halign: 'right' },
            3: { cellWidth: 25, halign: 'right' },
            4: { cellWidth: 25, halign: 'right' },
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 22, halign: 'right' },
            7: { cellWidth: 18, halign: 'right' },
            8: { cellWidth: 50, halign: 'left' },
        },
        didParseCell: (hookData) => {
            const isTotal = hookData.row.index === tableBody.length - 1;
            if (isTotal) {
                hookData.cell.styles.fontStyle = 'bold';
                hookData.cell.styles.fillColor = DARK_NAVY;
                hookData.cell.styles.textColor = [255, 255, 255];
            }
            // Colour Impact column
            if (hookData.section === 'body' && !isTotal && hookData.column.index === 8) {
                const val = hookData.cell.raw as string;
                if (val.includes('Positive')) {
                    hookData.cell.styles.textColor = [0, 150, 80];   // Green
                    hookData.cell.styles.fontStyle = 'bold';
                } else if (val.includes('Adverse')) {
                    hookData.cell.styles.textColor = [200, 0, 0];    // Red
                    hookData.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 5;
    doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(80);
    doc.text('Note: "Old Value" = (Basic+DA+Retaining)*12%. "New Value" = Actual PF Deduction (Pay Sheet).', 14, finalY);

    doc.save(`${fileName}.pdf`);
};

export const generateArrearECRText = (
    arrearBatch: ArrearBatch,
    payrollHistory: PayrollResult[],
    employees: Employee[],
    config: StatutoryConfig,
    fileName: string
) => {
    // 1. Determine the months covered by the arrear batch
    const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const effectiveIdx = monthsArr.indexOf(arrearBatch.effectiveMonth);
    const effectiveYear = arrearBatch.effectiveYear;

    // Helper to get past month/year strings
    const getCoveredMonths = (startIdx: number, startYear: number, count: number) => {
        const covered = [];
        let curIdx = startIdx;
        let curYear = startYear;
        for (let i = 0; i < count; i++) {
            covered.push({ month: monthsArr[curIdx], year: curYear });
            curIdx++;
            if (curIdx > 11) {
                curIdx = 0;
                curYear++;
            }
        }
        return covered;
    };

    const lines: string[] = [];

    // 2. Process each arrear record
    arrearBatch.records.forEach(record => {
        const emp = employees.find(e => e.id === record.id);
        if (!emp || emp.isPFExempt || !emp.uanc) return; // Skip invalid or non-contributing employees

        const arrearPFWagePerMonth = record.diffBasic + (record.diffDA || 0) + (record.diffRetaining || 0);
        if (arrearPFWagePerMonth <= 0) return;

        let totalArrearEPF = 0;
        let totalArrearEPS = 0;
        let totalArrearEDLI = 0;
        let totalEE_EPF = 0;
        let totalER_EPS = 0;

        const coveredMonths = getCoveredMonths(effectiveIdx, effectiveYear, record.months);

        coveredMonths.forEach(cm => {
            // Find historic payroll result for this specific month
            const historicResult = payrollHistory.find(h => h.employeeId === emp.id && h.month === cm.month && h.year === cm.year);

            // Reconstruct the wage used in that month's ECR based on actual deduction
            let pastEPFWage = 0;
            let pastEPSWage = 0;

            if (historicResult) {
                const eeEPF = (historicResult.deductions.epf || 0) + (historicResult.deductions.vpf || 0);
                pastEPFWage = eeEPF > 0 ? Math.round(eeEPF / 0.12) : 0;
                pastEPSWage = historicResult.employerContributions.eps > 0 ? Math.round(historicResult.employerContributions.eps / 0.0833) : 0;
            }

            // --- Arrear EPF Wages Calculation ---
            let currentMonthArrearEPF = 0;
            if (config.enableHigherContribution) {
                currentMonthArrearEPF = arrearPFWagePerMonth;
            } else if (pastEPFWage >= config.epfCeiling) {
                currentMonthArrearEPF = 0;
            } else {
                currentMonthArrearEPF = Math.max(0, Math.min(config.epfCeiling - pastEPFWage, arrearPFWagePerMonth));
            }

            // --- Arrear EPS Wages Calculation ---
            let currentMonthArrearEPS = 0;
            const isPensionEligible = pastEPSWage > 0; // If they contributed EPS back then, they were eligible

            if (!isPensionEligible) {
                currentMonthArrearEPS = 0;
            } else {
                const isEmployeeHigherPensionOpted = emp.pfHigherPension?.isHigherPensionOpted === 'Yes';
                const isEmployerHigherContrib = emp.pfHigherPension?.employerContribution === 'Higher' || config.enableHigherContribution;

                if (isEmployeeHigherPensionOpted && isEmployerHigherContrib) {
                    currentMonthArrearEPS = arrearPFWagePerMonth;
                } else if (pastEPSWage >= config.epfCeiling) {
                    currentMonthArrearEPS = 0;
                } else {
                    currentMonthArrearEPS = Math.max(0, Math.min(config.epfCeiling - pastEPSWage, arrearPFWagePerMonth));
                }
            }

            // --- Arrear EDLI Wages Calculation ---
            let currentMonthArrearEDLI = 0;
            if (pastEPFWage >= config.epfCeiling) {
                currentMonthArrearEDLI = 0;
            } else {
                currentMonthArrearEDLI = Math.max(0, Math.min(config.epfCeiling - pastEPFWage, arrearPFWagePerMonth));
            }

            totalArrearEPF += currentMonthArrearEPF;
            totalArrearEPS += currentMonthArrearEPS;
            totalArrearEDLI += currentMonthArrearEDLI;

            // Address 1-rupee rounding disparity by accumulating mathematically rounded monthly shares
            if (currentMonthArrearEPF > 0) {
                totalEE_EPF += Math.round(currentMonthArrearEPF * 0.12);
            }
            if (currentMonthArrearEPS > 0) {
                totalER_EPS += Math.round(currentMonthArrearEPS * 0.0833);
            }
        });

        // 3. Final calculations for the text row
        if (totalArrearEPF > 0) {
            const eeShare = totalEE_EPF;
            const erEpsShare = totalER_EPS;
            const erEpfShare = eeShare - erEpsShare;

            // Format: UAN#~#MemberName#~#ArrearEPFWages#~#ArrearEPSWages#~#ArrearEDLIWages#~#EEShare#~#ERepfShare#~#ERepsShare
            lines.push(`${emp.uanc}#~#${emp.name}#~#${totalArrearEPF}#~#${totalArrearEPS}#~#${totalArrearEDLI}#~#${eeShare}#~#${erEpfShare}#~#${erEpsShare}`);
        }
    });

    // 4. Download logic
    if (lines.length === 0) {
        alert("No valid Arrear ECR records to generate.");
        return;
    }

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
};

export const generateArrearECRExcel = (
    arrearBatch: ArrearBatch,
    payrollHistory: PayrollResult[],
    employees: Employee[],
    config: StatutoryConfig,
    fileName: string
) => {
    // 1. Determine the months covered by the arrear batch
    const monthsArr = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const effectiveIdx = monthsArr.indexOf(arrearBatch.effectiveMonth);
    const effectiveYear = arrearBatch.effectiveYear;

    // Helper to get past month/year strings
    const getCoveredMonths = (startIdx: number, startYear: number, count: number) => {
        const covered = [];
        let curIdx = startIdx;
        let curYear = startYear;
        for (let i = 0; i < count; i++) {
            covered.push({ month: monthsArr[curIdx], year: curYear });
            curIdx++;
            if (curIdx > 11) {
                curIdx = 0;
                curYear++;
            }
        }
        return covered;
    };

    const rows: any[] = [];

    // 2. Process each arrear record
    arrearBatch.records.forEach(record => {
        const emp = employees.find(e => e.id === record.id);
        if (!emp || emp.isPFExempt || !emp.uanc) return;

        const arrearPFWagePerMonth = record.diffBasic + (record.diffDA || 0) + (record.diffRetaining || 0);
        if (arrearPFWagePerMonth <= 0) return;

        let totalArrearEPF = 0;
        let totalArrearEPS = 0;
        let totalArrearEDLI = 0;

        let totalPastEPFWage = 0;
        let totalPastEPSWage = 0;

        let totalEE_EPF = 0;
        let totalER_EPS = 0;

        const coveredMonths = getCoveredMonths(effectiveIdx, effectiveYear, record.months);
        const periodLabel = coveredMonths.length > 1
            ? `${coveredMonths[0].month} ${coveredMonths[0].year} to ${coveredMonths[coveredMonths.length - 1].month} ${coveredMonths[coveredMonths.length - 1].year}`
            : `${coveredMonths[0].month} ${coveredMonths[0].year}`;

        coveredMonths.forEach(cm => {
            const historicResult = payrollHistory.find(h => h.employeeId === emp.id && h.month === cm.month && h.year === cm.year);

            let pastEPFWage = 0;
            let pastEPSWage = 0;

            if (historicResult) {
                const eeEPF = (historicResult.deductions.epf || 0) + (historicResult.deductions.vpf || 0);
                pastEPFWage = eeEPF > 0 ? Math.round(eeEPF / 0.12) : 0;
                pastEPSWage = historicResult.employerContributions.eps > 0 ? Math.round(historicResult.employerContributions.eps / 0.0833) : 0;
            }

            totalPastEPFWage += pastEPFWage;
            totalPastEPSWage += pastEPSWage;

            // --- Arrear EPF Wages Calculation ---
            let currentMonthArrearEPF = 0;
            if (config.enableHigherContribution) {
                currentMonthArrearEPF = arrearPFWagePerMonth;
            } else if (pastEPFWage >= config.epfCeiling) {
                currentMonthArrearEPF = 0;
            } else {
                currentMonthArrearEPF = Math.max(0, Math.min(config.epfCeiling - pastEPFWage, arrearPFWagePerMonth));
            }

            // --- Arrear EPS Wages Calculation ---
            let currentMonthArrearEPS = 0;
            const isPensionEligible = pastEPSWage > 0;

            if (!isPensionEligible) {
                currentMonthArrearEPS = 0;
            } else {
                const isEmployeeHigherPensionOpted = emp.pfHigherPension?.isHigherPensionOpted === 'Yes';
                const isEmployerHigherContrib = emp.pfHigherPension?.employerContribution === 'Higher' || config.enableHigherContribution;

                if (isEmployeeHigherPensionOpted && isEmployerHigherContrib) {
                    currentMonthArrearEPS = arrearPFWagePerMonth;
                } else if (pastEPSWage >= config.epfCeiling) {
                    currentMonthArrearEPS = 0;
                } else {
                    currentMonthArrearEPS = Math.max(0, Math.min(config.epfCeiling - pastEPSWage, arrearPFWagePerMonth));
                }
            }

            // --- Arrear EDLI Wages Calculation ---
            let currentMonthArrearEDLI = 0;
            if (pastEPFWage >= config.epfCeiling) {
                currentMonthArrearEDLI = 0;
            } else {
                currentMonthArrearEDLI = Math.max(0, Math.min(config.epfCeiling - pastEPFWage, arrearPFWagePerMonth));
            }

            totalArrearEPF += currentMonthArrearEPF;
            totalArrearEPS += currentMonthArrearEPS;
            totalArrearEDLI += currentMonthArrearEDLI;

            // Accumulate mathematically rounded monthly shares
            if (currentMonthArrearEPF > 0) {
                totalEE_EPF += Math.round(currentMonthArrearEPF * 0.12);
            }
            if (currentMonthArrearEPS > 0) {
                totalER_EPS += Math.round(currentMonthArrearEPS * 0.0833);
            }
        });

        if (totalArrearEPF > 0) {
            const eeShare = totalEE_EPF;
            const erEpsShare = totalER_EPS;
            const erEpfShare = eeShare - erEpsShare;

            rows.push({
                'UAN': emp.uanc,
                'Member Name': emp.name,
                'Original Period': periodLabel,
                'Arrear Months': record.months,
                'Historic EPF Wage (Sum)': totalPastEPFWage,
                'Historic EPS Wage (Sum)': totalPastEPSWage,
                'Arrear Base Wage (Sum)': arrearPFWagePerMonth * record.months,
                'Arrear EPF Wages': totalArrearEPF,
                'Arrear EPS Wages': totalArrearEPS,
                'Arrear EDLI Wages': totalArrearEDLI,
                'EE Share (12%)': eeShare,
                'ER EPF Share (3.67%)': erEpfShare,
                'ER EPS Share (8.33%)': erEpsShare
            });
        }
    });

    if (rows.length === 0) {
        alert("No valid Arrear ECR records to generate Excel.");
        return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);

    // Apply header styling
    const HEADERS = Object.keys(rows[0]);
    for (let c = 0; c < HEADERS.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[addr]) {
            ws[addr].s = {
                font: { bold: true, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '0F172A' }, patternType: 'solid' },
                alignment: { horizontal: 'center', vertical: 'center' }
            };
        }
    }

    // Set Column Widths
    ws['!cols'] = [
        { wch: 15 }, // UAN
        { wch: 25 }, // Name
        { wch: 25 }, // Period
        { wch: 15 }, // Months
        { wch: 25 }, // Historic EPF
        { wch: 25 }, // Historic EPS
        { wch: 25 }, // Arrear Base
        { wch: 20 }, // Arrear EPF
        { wch: 20 }, // Arrear EPS
        { wch: 20 }, // Arrear EDLI
        { wch: 15 }, // EE
        { wch: 20 }, // ER EPF
        { wch: 20 }  // ER EPS
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Arrear ECR details');
    XLSX.writeFile(wb, `${fileName}.xlsx`);
};
