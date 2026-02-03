
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

// --- EPF ECR GENERATION (Excel & Text) ---
export const generatePFECR = (records: PayrollResult[], employees: Employee[], format: 'Excel'|'Text', fileName: string) => {
    // Helper to estimate wages if not explicitly stored (Reverse calc or Basic+DA)
    const processedRecords = records.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const actualWage = (r.earnings?.basic || 0) + (r.earnings?.da || 0) + (r.earnings?.retainingAllowance || 0);
        
        let epfWage = actualWage;
        const ceiling = 15000;
        
        // Reverse Engineer likely wage used
        if ((r.deductions?.epf || 0) > 0) {
             const derived = Math.round((r.deductions?.epf || 0) / 0.12);
             if (Math.abs(derived - actualWage) < 10) epfWage = actualWage;
             else if (Math.abs(derived - ceiling) < 10) epfWage = ceiling;
             else epfWage = derived;
        }
        
        // Logic for EPS/EDLI Wages
        let epsWage = epfWage > ceiling ? ceiling : epfWage;
        if (emp?.pfHigherPension?.isHigherPensionOpted === 'Yes') epsWage = actualWage;
        if ((r.employerContributions?.eps || 0) === 0) epsWage = 0; // Pension Ineligible (e.g. >58)

        let edliWage = epsWage > 0 ? (epfWage > ceiling ? ceiling : epfWage) : 0;
        // EDLI is usually on EPF wage up to 15k cap, even if EPS is 0 (unless exempted)
        if (!emp?.isPFExempt && (r.deductions?.epf || 0) > 0) {
             edliWage = Math.min(epfWage, 15000);
        }

        const isOptOut = emp?.isDeferredPension && emp?.deferredPensionOption === 'OptOut';
        if (isOptOut) {
            epfWage = 0; epsWage = 0; edliWage = 0;
        }

        return {
            uan: emp?.uanc || '',
            name: emp?.name || '',
            gross: Math.round(r.earnings?.total || 0),
            epfWage: Math.round(epfWage),
            epsWage: Math.round(epsWage),
            edliWage: Math.round(edliWage),
            eeShare: Math.round(r.deductions?.epf || 0),
            erShareEPS: Math.round(r.employerContributions?.eps || 0),
            erShareEPF: Math.round(r.employerContributions?.epf || 0),
            ncp: r.daysInMonth - r.payableDays,
            refund: 0
        };
    }).filter(r => r.gross > 0); // FILTER: Only include employees with wages > 0

    if (format === 'Excel') {
        const excelData = processedRecords.map(rec => ({
            'UAN': rec.uan,
            'Name': rec.name,
            'Gross': rec.gross,
            'EPF': rec.epfWage,
            'EPS': rec.epsWage,
            'EDLI': rec.edliWage,
            'EE_Share': rec.eeShare,
            'ER_Share_1': rec.erShareEPS,
            'ER_Share_2': rec.erShareEPF,
            'NCP_Days': rec.ncp,
            'Refund': rec.refund
        }));
        generateExcelReport(excelData, 'ECR', fileName);
    } else {
        const textContent = processedRecords.map(rec => {
            // New Format: UAN#~#Name#~#Gross#~#EPF#~#EPS#~#EDLI#~#EE#~#EPS_ER#~#EPF_ER#~#NCP#~#Refund
            return `${rec.uan}#~#${rec.name}#~#${rec.gross}#~#${rec.epfWage}#~#${rec.epsWage}#~#${rec.edliWage}#~#${rec.eeShare}#~#${rec.erShareEPS}#~#${rec.erShareEPF}#~#${rec.ncp}#~#${rec.refund}`;
        }).join('\n');
        
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.txt`;
        a.click();
    }
};

// --- FORM 12A REVISED ---
export const generatePFForm12A = (records: PayrollResult[], employees: Employee[], config: StatutoryConfig, companyProfile: CompanyProfile, month: string, year: number) => {
    // ... (Existing Form 12A code) ...
    const doc = new jsPDF({ orientation: 'l' }); // LANDSCAPE
    
    // FILTER: Only include employees with earnings > 0
    const activeRecords = records.filter(r => (r.earnings?.total || 0) > 0);

    // Calculate Totals
    let totalEPFWage = 0, totalEPSWage = 0, totalEDLIWage = 0;
    let totalEE = 0, totalEPS = 0, totalEPF_ER = 0;

    activeRecords.forEach(r => {
        const actualWage = (r.earnings?.basic || 0) + (r.earnings?.da || 0) + (r.earnings?.retainingAllowance || 0);
        let epf = actualWage;
        if ((r.deductions?.epf || 0) > 0) {
             const derived = Math.round((r.deductions?.epf || 0) / 0.12);
             if (Math.abs(derived - 15000) < 10) epf = 15000;
             else if (Math.abs(derived - actualWage) < 10) epf = actualWage;
             else epf = derived;
        }
        let eps = (r.employerContributions?.eps || 0) > 0 ? Math.min(epf, 15000) : 0;
        let edli = (r.deductions?.epf || 0) > 0 ? Math.min(epf, 15000) : 0;

        totalEPFWage += epf;
        totalEPSWage += eps;
        totalEDLIWage += edli;
        totalEE += (r.deductions?.epf || 0) + (r.deductions?.vpf || 0);
        totalEPS += (r.employerContributions?.eps || 0);
        totalEPF_ER += (r.employerContributions?.epf || 0);
    });

    const ac2 = Math.max(500, Math.round(totalEPFWage * 0.005));
    const ac21 = Math.round(totalEDLIWage * 0.005);
    const totalRemittance = totalEE + totalEPS + totalEPF_ER + ac2 + ac21;

    // Drawing Constants
    const startY = 15;
    const lineHeight = 5;
    const centerX = 148.5; // Landscape center (297/2)
    const pageWidth = 297;
    const margin = 14;
    
    // --- HEADER ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 0, 0); // RED
    doc.text("PF_Form12A (Revised)", centerX, startY, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0); // BLACK
    doc.text("(Only for Un-Exempted Establishment)", centerX, startY + 6, { align: 'center' });

    let currentY = startY + 18;

    // --- COLUMNS SETUP ---
    // Col 1: Est Details (x=14)
    // Col 2: Act Details (x=100)
    // Col 3: EPFO Details (x=210)

    const col1X = 14;
    const col2X = 100;
    const col3X = 210;

    doc.setFontSize(9);
    
    // Row 1
    doc.setFont("helvetica", "normal");
    doc.text("Name Address of Establishment", col1X, currentY);
    doc.text("| Employees Provident Fund And Misc. Provision Act 1952", col2X, currentY);
    doc.text("| (To be Filled by the EPFO)", col3X, currentY);
    
    // Row 2
    currentY += lineHeight;
    doc.setFont("helvetica", "bold");
    doc.text(companyProfile.establishmentName || 'ESTABLISHMENT NAME', col1X, currentY);
    doc.setFont("helvetica", "normal");
    doc.text("| Employees Pension Scheme [Paragraph 20 (4)]", col2X, currentY);
    doc.text("| Establishment Status: Un-Exempted", col3X, currentY);

    // Row 3
    currentY += lineHeight;
    doc.setFont("helvetica", "normal");
    doc.text(`${companyProfile.city || ''} ${companyProfile.state || ''}`, col1X, currentY);
    doc.text(`| Currency Period from: 1st ${month} to End of ${month} ${year}`, col2X, currentY);
    doc.text(`| Group Code: `, col3X, currentY);

    // Row 4
    currentY += lineHeight;
    doc.text(`| Statement of Contribution for the Month of ${month} ${year}`, col2X, currentY);
    doc.text(`| Establishment Code: ${companyProfile.pfCode || ''}`, col3X, currentY);

    currentY += lineHeight * 2;

    // --- RED LINE ABOVE TITLE ---
    doc.setDrawColor(255, 0, 0); // RED
    doc.setLineWidth(0.5);
    doc.line(margin, currentY - 5, pageWidth - margin, currentY - 5);

    // --- SHEET TITLE ---
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 0, 0); // RED
    doc.text("PF ECR_UAN_CALCULATION SHEET", centerX, currentY, { align: 'center' });
    
    // --- RED LINE BELOW TITLE ---
    currentY += 2;
    doc.line(margin, currentY, pageWidth - margin, currentY);

    // --- YELLOW BARS ---
    currentY += 8;
    const barY = currentY;
    
    doc.setFillColor(255, 255, 0); // YELLOW
    
    // Increased Spacing: Gap ~60 units (approx 20+ chars)
    const boxWidth = 40;
    const spacingFromCenter = 30; // Total gap = 60 units (approx 60mm)
    const trrnX = centerX - boxWidth - spacingFromCenter; 
    const dateX = centerX + spacingFromCenter;
    
    doc.rect(trrnX, barY, boxWidth, 6, 'F');
    doc.rect(dateX, barY, boxWidth, 6, 'F');
    
    doc.setTextColor(0, 0, 0); // BLACK
    doc.setFontSize(9);
    doc.text("TRRN", trrnX + (boxWidth/2), barY + 4, { align: 'center' });
    doc.text("Date", dateX + (boxWidth/2), barY + 4, { align: 'center' });

    // --- RED LINE ABOVE TABLE HEADER ---
    const tableHeaderY = barY + 15;
    doc.setDrawColor(255, 0, 0); // RED
    doc.line(margin, tableHeaderY - 4, pageWidth - margin, tableHeaderY - 4);

    // --- TABLE CONSTRUCTION (Landscape X Coords) ---
    const x1 = 14; 
    const x2 = 70;  // Wage Value
    const x3 = 110; // Employee Share Label
    const x4 = 140; // Employee Share Value
    const x5 = 180; // Employer Share Label
    const x6 = 210; // Employer Share Value
    const x7 = 280; // Total (Right aligned)

    // Table Header Row
    doc.setFont("helvetica", "bold");
    doc.text("PF-Wages", x1, tableHeaderY);
    doc.text(totalEPFWage.toString(), x2, tableHeaderY);
    doc.text("Employee Share", x3, tableHeaderY);
    doc.text("Employer Share", x5, tableHeaderY);
    doc.text("Total", x7, tableHeaderY, { align: 'right' });
  
    let rowY = tableHeaderY + 4;
    rowY += 4;
    doc.setFont("helvetica", "normal");

    // Row 1: EPF
    doc.text("EPF_Wages (A/c No.1)", x1, rowY);
    doc.text("(12%+3.67%)", x1, rowY + 4);
    doc.text(totalEPFWage.toString(), x2, rowY + 2);
    doc.text("12%", x3, rowY + 2);
    doc.text(totalEE.toString(), x4, rowY + 2);
    doc.text("3.67%", x5, rowY + 2);
    doc.text(totalEPF_ER.toString(), x6, rowY + 2);
    doc.text((totalEE + totalEPF_ER).toString(), x7, rowY + 2, { align: 'right' });

    rowY += 12;

    // Row 2: EPS
    doc.text("EPS_Wages (A/c No.10)", x1, rowY);
    doc.text("(8.33%)", x1, rowY + 4);
    doc.text(totalEPSWage.toString(), x2, rowY + 2);
    doc.text("8.33%", x5, rowY + 2);
    doc.text(totalEPS.toString(), x6, rowY + 2);
    doc.text(totalEPS.toString(), x7, rowY + 2, { align: 'right' });

    rowY += 12;

    // Row 3: EDLI
    doc.text("EDLI_Wages (A/c No.21)", x1, rowY);
    doc.text("(0.50%)", x1, rowY + 4);
    doc.text(totalEDLIWage.toString(), x2, rowY + 2);
    doc.text(ac21.toString(), x7, rowY + 2, { align: 'right' });

    rowY += 12;

    // Row 4: Admin Charges A/c 2
    doc.text("Admin_Charges (A/c No.2)", x1, rowY);
    doc.text("(0.50%)", x1, rowY + 4);
    doc.text(totalEPFWage.toString(), x2, rowY + 2);
    doc.text(ac2.toString(), x7, rowY + 2, { align: 'right' });

    rowY += 12;

    // Row 5: Admin EDLI (Usually 0)
    doc.text("Admin_Charg_EDLI (0.0%)", x1, rowY);
    doc.text("0", x2, rowY);
    doc.text("0", x7, rowY, { align: 'right' });

    rowY += 8;

    // Bottom Line (Black)
    doc.setDrawColor(0, 0, 0); 
    doc.line(margin, rowY, pageWidth - margin, rowY);
    
    rowY += 6;

    // Total Row
    doc.setFont("helvetica", "bold");
    doc.text("Total", x2, rowY); 
    doc.text(totalEE.toString(), x4, rowY); 
    doc.text((totalEPF_ER + totalEPS).toString(), x6, rowY);
    doc.text(totalRemittance.toString(), x7, rowY, { align: 'right' });
 
    // Final Line (Red)
    doc.setDrawColor(255, 0, 0); // RED
    doc.setLineWidth(0.5);
    doc.line(margin, rowY + 4, pageWidth - margin, rowY + 4);

    doc.save(`Form12A_${month}_${year}.pdf`);
};

// ... (Existing Form 3A, 6A codes) ...
export const generatePFForm3A = (
    history: PayrollResult[], 
    employees: Employee[], 
    config: StatutoryConfig, 
    startMonth: string, 
    startYear: number, 
    endMonth: string, 
    endYear: number, 
    empId: string | undefined, 
    companyProfile: CompanyProfile
) => {
    // ... existing code ...
    const doc = new jsPDF();
    const monthsOrder = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
    const targets = empId ? employees.filter(e => e.id === empId) : employees;
    targets.forEach((emp, index) => {
        if (index > 0) doc.addPage();
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("For UnExempted Establishment Only ( Form 3A Revises)", 105, 10, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("The Employees Provident Fund Scheme 1952 (Paras 35 42)", 105, 16, { align: 'center' });
        doc.text("The Employees Pension Scheme: 1995 (Para 19)", 105, 21, { align: 'center' });
        doc.text(`Contribution Card for Currency Period from: 01/04/${startYear} to 31/03/${endYear}`, 105, 26, { align: 'center' });
        let y = 35;
        doc.setFontSize(9);
        doc.text(`Account No: ${emp.pfNumber || 'N/A'}`, 14, y);
        doc.text(`UAN No: ${emp.uanc || 'N/A'}`, 14, y + 5);
        doc.text(`Name/ Surname: ${emp.name}`, 14, y + 10);
        doc.text(`Father/ Husband Name: ${emp.fatherSpouseName}`, 14, y + 15);
        doc.text(`Statutory Rate of Cont: 12%`, 14, y + 20);
        doc.text(`Name Address of the Factory/ Establishment`, 120, y);
        doc.setFont("helvetica", "bold");
        doc.text(companyProfile.establishmentName, 120, y + 5);
        doc.setFont("helvetica", "normal");
        const addrLine1 = [companyProfile.doorNo, companyProfile.buildingName, companyProfile.street].filter(Boolean).join(', ');
        const addrLine2 = [companyProfile.area, companyProfile.city, companyProfile.state].filter(Boolean).join(', ');
        doc.text(addrLine1, 120, y + 10);
        doc.text(addrLine2, 120, y + 15);
        doc.text(`Pincode -${companyProfile.pincode}`, 120, y + 20);
        y += 28;
        doc.text(`Voluntary Higher Rate of employee's Cont. (if any): NIL`, 14, y);
        doc.text(`RE Cont. on Hr Wages to EPF (ER) Y/N: N`, 14, y + 5);
        doc.text(`Vol.Cont. to Pension Y/N: N`, 120, y + 5);
        y += 10;
        const headers = ["Month/ Year", "Amount of Wages", "Worker's Share EPF", "Employer's Share EPF (A/c 1)", "PENSION FUND (A/c 10)", "Ref. of Adv.", "NCP Days (LOP)"];
        let totalWages = 0, totalEE = 0, totalER_EPF = 0, totalER_EPS = 0;
        const bodyData = monthsOrder.map((m) => {
            const yr = (m === 'January' || m === 'February' || m === 'March') ? endYear : startYear;
            const rec = history.find(h => h.employeeId === emp.id && h.month === m && h.year === yr);
            const wage = rec ? Math.round((rec.earnings?.basic || 0) + (rec.earnings?.da || 0) + (rec.earnings?.retainingAllowance || 0)) : 0;
            const ee = rec ? Math.round((rec.deductions?.epf || 0) + (rec.deductions?.vpf || 0)) : 0;
            const er_epf = rec ? Math.round(rec.employerContributions?.epf || 0) : 0;
            const er_eps = rec ? Math.round(rec.employerContributions?.eps || 0) : 0;
            const ncp = rec ? (rec.daysInMonth - rec.payableDays) : 0;
            totalWages += wage;
            totalEE += ee;
            totalER_EPF += er_epf;
            totalER_EPS += er_eps;
            const shortMon = m.substring(0,3);
            const shortYr = String(yr).substring(2);
            return [`${shortMon} '${shortYr}`, wage > 0 ? wage.toString() : '0', ee > 0 ? ee.toString() : '0', er_epf > 0 ? er_epf.toString() : '0', er_eps > 0 ? er_eps.toString() : '0', '', ncp > 0 ? ncp.toString() : ''];
        });
        bodyData.push(['Total :', totalWages.toString(), totalEE.toString(), totalER_EPF.toString(), totalER_EPS.toString(), '', '']);
        autoTable(doc, { startY: y, head: [headers], body: bodyData, theme: 'grid', styles: { fontSize: 8, cellPadding: 1.5, halign: 'center', lineWidth: 0.1, lineColor: [200, 200, 200] }, headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] }, columnStyles: { 0: { halign: 'left' } }, didParseCell: (data) => { if (data.section === 'body' && data.row.index === bodyData.length - 1) { data.cell.styles.fontStyle = 'bold'; } } });
        y = (doc as any).lastAutoTable.finalY + 8;
        doc.setFontSize(8);
        doc.text("7- Remarks : A) Date of Leaving Service , if any:", 14, y);
        if (emp.dol) { doc.text(formatDateInd(emp.dol), 80, y); }
        y += 5;
        doc.text("B) Reason for leaving service, if any:", 19, y);
        if (emp.leavingReason) { doc.text(emp.leavingReason, 80, y); }
        y += 10;
        doc.text(`Certified that the total amount of contribution (both shares) indicated in this card i.e. Rs. ${totalEE + totalER_EPF} has already been remitted in full in EPF A/c. No.1`, 14, y);
        y += 4;
        doc.text(`and Pension Fund A/c. No. 10 Rs. ${totalER_EPS} (Vide note below)`, 14, y);
        y += 5;
        doc.text("Certified that the Difference between the Total of contribution show under Cols. 3 4a 4b of the above table and that arrived at on the total wages shown in Col 2", 14, y);
        y += 4;
        doc.text("at the prescribed rate is solely due to the rounding off of contribution to the nearest rupee under the rules.", 14, y);
        y += 15;
        doc.setFont("helvetica", "bold");
        doc.text(`For   ${companyProfile.establishmentName}`, 125, y);
        y += 15;
        const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        doc.setFont("helvetica", "normal");
        doc.text(`${today}`, 14, y);
        doc.text("Signature of employer with Official Seal", 135, y);
    });
    doc.save(`Form3A_${startYear}-${endYear}.pdf`);
};

export const generatePFForm6A = (
    history: PayrollResult[], 
    employees: Employee[], 
    config: StatutoryConfig, 
    startMonth: string, 
    startYear: number, 
    endMonth: string, 
    endYear: number, 
    companyProfile: CompanyProfile
) => {
    // ... existing code ...
    const doc = new jsPDF({ orientation: 'l' });
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("(FOR UNEXEMPTED ESTABLISHMENTS' ONLY)", 148, 10, { align: 'center' });
    doc.text("FORM 6A", 148, 16, { align: 'center' });
    doc.setFontSize(9);
    doc.text("THE EMPLOYEES' PROVIDENT FUND SCHEME, 1952 (PARAGRAPH 43)", 148, 22, { align: 'center' });
    doc.text(`Annual statement of contribution for the Currency period from 1st Apr ${startYear} to 31st Mar ${endYear}`, 14, 30);
    doc.text(`Name & Address of the Establishment: ${companyProfile.establishmentName}`, 14, 36);
    doc.text(`Code No. of the Establishment: ${companyProfile.pfCode}`, 14, 42);
    doc.text(`Statutory rate of contribution: 12%`, 200, 36);
    const headers = ["Sl. No", "Account No.", "Name of member", "Wages, retaining allowance...", "Amount of worker's contributions", "EPF Diff (ER Share)", "Pension Fund (8.33%)", "Refund of Advance", "Rate of higher vol", "Remarks"];
    const monthsOrder = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
    const data = employees.map((emp, index) => {
        let annualWages = 0; let annualEE = 0; let annualER_EPF = 0; let annualER_EPS = 0;
        monthsOrder.forEach(m => {
            const yr = (m === 'January' || m === 'February' || m === 'March') ? endYear : startYear;
            const rec = history.find(h => h.employeeId === emp.id && h.month === m && h.year === yr);
            if (rec) {
                annualWages += Math.round((rec.earnings?.basic||0) + (rec.earnings?.da||0));
                annualEE += Math.round((rec.deductions?.epf || 0) + (rec.deductions?.vpf || 0));
                annualER_EPF += Math.round(rec.employerContributions?.epf || 0);
                annualER_EPS += Math.round(rec.employerContributions?.eps || 0);
            }
        });
        if (annualWages === 0 && annualEE === 0) return null;
        return [(index + 1).toString(), emp.pfNumber || emp.uanc, emp.name, annualWages.toString(), annualEE.toString(), annualER_EPF.toString(), annualER_EPS.toString(), "0", "N", ""];
    }).filter(d => d !== null) as string[][];
    autoTable(doc, { startY: 50, head: [headers], body: data, theme: 'grid', styles: { fontSize: 8, cellPadding: 2, halign: 'center' }, columnStyles: { 2: { halign: 'left' } } });
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text("Signature of Employer (with office seal)", 200, finalY + 20);
    doc.save(`Form6A_${startYear}-${endYear}.pdf`);
};

// --- ESI CODE ON SOCIAL SECURITY IMPACT ANALYSIS ---
export const generateCodeOnWagesReport = (records: PayrollResult[], employees: Employee[], format: 'PDF'|'Excel', fileName: string, companyProfile: CompanyProfile) => {
    // Impact Analysis Data Generation
    const impactData = records.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        
        // 1. Gross Wages
        const gross = r.earnings?.total || 0;

        // 2. ESI Wages (Base = Basic + DA + Retaining) as per User Request
        // Note: Normally ESI is on Gross minus specific allowances, but prompt asks for Basic+DA+Retn comparison
        const esiBaseWage = (r.earnings?.basic || 0) + (r.earnings?.da || 0) + (r.earnings?.retainingAllowance || 0);

        // 3. ESI Code Wages (Derive from System Calculation logic for Clause 88)
        // Clause 88: If Allowances > 50% of Gross, excess is added to wage.
        const wageA = esiBaseWage;
        const wageC = gross - wageA; // Allowances
        let wageD = 0; // Deemed addition
        if (gross > 0) {
            const allowancePercentage = wageC / gross;
            if (allowancePercentage > 0.50) {
                const fiftyPercentOfGross = Math.round(gross * 0.50);
                wageD = wageC - fiftyPercentOfGross;
            }
        }
        const esiCodeWages = Math.round(wageA + wageD);

        // 4. Old ESI Contribution (Simulated on Base Wage)
        // ESI Rate: 0.75% (EE) + 3.25% (ER) = 4.00%
        let oldContribution = 0;
        if (esiBaseWage <= 21000) {
            oldContribution = Math.ceil(esiBaseWage * 0.0075) + Math.ceil(esiBaseWage * 0.0325);
        }

        // 5. ESI Code Contribution (Actual Actuals from Payroll)
        const newContribution = (r.deductions?.esi || 0) + (r.employerContributions?.esi || 0);

        // 6. Impact Difference
        // Saved = Old - New. If Positive, we saved. If Negative, we paid excess.
        const diff = oldContribution - newContribution;
        
        let reason = "Neutral";
        if (diff < 0) reason = "Negative Impact (Excess Cost)";
        else if (diff > 0) reason = "Positive Impact (Saved)";
        else if (newContribution === 0 && oldContribution > 0) reason = "Positive (Out of Coverage)";
        else if (newContribution > 0 && oldContribution === 0) reason = "Negative (New Coverage)";

        // Filter out if no contribution at all involved (unless analysis requires all)
        if (gross === 0) return null;

        return {
            id: r.employeeId,
            name: emp?.name || '',
            gross: gross,
            esiWageBase: esiBaseWage,
            esiCodeWage: esiCodeWages,
            oldContrib: oldContribution,
            newContrib: newContribution,
            impact: diff,
            reason: reason
        };
    }).filter(d => d !== null);

    if (format === 'Excel') {
        const excelData = impactData.map(d => ({
            'EMP ID': d!.id,
            'Employee Name': d!.name,
            'Gross Wages': d!.gross,
            'ESI_Wages(Basic+DA+Retn)': d!.esiWageBase,
            'ESI_Code_Wages': d!.esiCodeWage,
            'Old_ESI_Contribution (4%)': d!.oldContrib,
            'ESI_Code_Contribution (Actual)': d!.newContrib,
            'Excess/Saved': d!.impact,
            'Reason': d!.reason
        }));
        generateExcelReport(excelData, 'ESI_Code_Impact', fileName);
    } else {
        const headers = ['ID', 'Name', 'Gross', 'Base Wage', 'Code Wage', 'Old Cont', 'New Cont', 'Diff', 'Impact'];
        const rows = impactData.map(d => [
            d!.id, 
            d!.name, 
            d!.gross.toString(), 
            d!.esiWageBase.toString(), 
            d!.esiCodeWage.toString(), 
            d!.oldContrib.toString(), 
            d!.newContrib.toString(), 
            d!.impact.toString(),
            d!.reason
        ]);
        
        // Add Summary Row
        const totalOld = impactData.reduce((acc, curr) => acc + curr!.oldContrib, 0);
        const totalNew = impactData.reduce((acc, curr) => acc + curr!.newContrib, 0);
        const totalDiff = totalOld - totalNew;
        rows.push(['TOTAL', '', '', '', '', totalOld.toString(), totalNew.toString(), totalDiff.toString(), totalDiff < 0 ? 'Excess Cost' : 'Saved']);

        generatePDFTableReport(
            'ESI Social Security Code Impact Analysis', 
            headers, 
            rows, 
            fileName, 
            'l', 
            'Note: "Old Contribution" simulated on Basic+DA+Retn @ 4%. "New Contribution" is actual system deduction.', 
            companyProfile
        );
    }
};

// --- EPF CODE ON SOCIAL SECURITY IMPACT ANALYSIS ---
export const generateEPFCodeImpactReport = (records: PayrollResult[], employees: Employee[], format: 'PDF'|'Excel', fileName: string, companyProfile: CompanyProfile) => {
    // Impact Analysis Data Generation
    const impactData = records.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        if (!emp || emp.isPFExempt) return null;

        const gross = r.earnings?.total || 0;
        // EPF Wages (Old Base) = Basic + DA + Retaining
        const basicWages = (r.earnings?.basic || 0) + (r.earnings?.da || 0) + (r.earnings?.retainingAllowance || 0);

        // EPF Code Wages (Clause 88 Logic)
        const wageC = gross - basicWages; // Allowances
        let wageD = 0; // Deemed addition
        if (gross > 0) {
            const allowancePercentage = wageC / gross;
            if (allowancePercentage > 0.50) {
                const fiftyPercentOfGross = Math.round(gross * 0.50);
                wageD = wageC - fiftyPercentOfGross;
            }
        }
        const epfCodeWages = Math.round(basicWages + wageD);

        // Old EPF Contribution (Simulated on Old Base, capped at 15k)
        // Standard: 12% of Min(BasicWages, 15000)
        let oldBasis = basicWages;
        // If employee has opted for higher wages (in general profile), old contribution would follow that preference
        // However, standard impact analysis compares Mandatory Statutory vs Mandatory Statutory under New Code
        if (!emp.isPFHigherWages) {
            oldBasis = Math.min(basicWages, 15000);
        }
        
        // Total Liability ~24% (12% EE + 12% ER) - Simplified to reflect cost impact
        const oldContrib = Math.round(oldBasis * 0.24);

        // EPF Code Contribution (Actual Deduction from Payroll - Total Liability)
        // Note: PayrollResult stores EE and ER separate.
        const newContrib = (r.deductions?.epf || 0) + (r.employerContributions?.epf || 0) + (r.employerContributions?.eps || 0);

        const diff = oldContrib - newContrib;
        
        let reason = "Neutral";
        if (diff < 0) reason = "Negative Impact (Excess Cost)";
        else if (diff > 0) reason = "Positive Impact (Saved)";
        else if (newContrib === 0 && oldContrib > 0) reason = "Positive (Out of Coverage)";
        else if (newContrib > 0 && oldContrib === 0) reason = "Negative (New Coverage)";

        // Filter out if no contribution at all involved
        if (gross === 0) return null;

        return {
            id: r.employeeId,
            name: emp?.name || '',
            gross: gross,
            epfWageBase: basicWages,
            epfCodeWage: epfCodeWages,
            oldContrib: oldContrib,
            newContrib: newContrib,
            impact: diff,
            reason: reason
        };
    }).filter(d => d !== null);

    if (format === 'Excel') {
        const excelData = impactData.map(d => ({
            'EMP ID': d!.id,
            'Employee Name': d!.name,
            'Gross Wages': d!.gross,
            'EPF_Wages(Basic+DA+Retn)': d!.epfWageBase,
            'EPF_Code_Wages': d!.epfCodeWage,
            'Old_EPF_Contribution (24%)': d!.oldContrib,
            'EPF_Code_Contribution (Actual)': d!.newContrib,
            'Excess/Saved': d!.impact,
            'Reason': d!.reason
        }));
        generateExcelReport(excelData, 'EPF_Code_Impact', fileName);
    } else {
        const headers = ['ID', 'Name', 'Gross', 'Base Wage', 'Code Wage', 'Old Cont', 'New Cont', 'Diff', 'Impact'];
        const rows = impactData.map(d => [
            d!.id, 
            d!.name, 
            d!.gross.toString(), 
            d!.epfWageBase.toString(), 
            d!.epfCodeWage.toString(), 
            d!.oldContrib.toString(), 
            d!.newContrib.toString(), 
            d!.impact.toString(),
            d!.reason
        ]);
        
        // Add Summary Row
        const totalOld = impactData.reduce((acc, curr) => acc + curr!.oldContrib, 0);
        const totalNew = impactData.reduce((acc, curr) => acc + curr!.newContrib, 0);
        const totalDiff = totalOld - totalNew;
        rows.push(['TOTAL', '', '', '', '', totalOld.toString(), totalNew.toString(), totalDiff.toString(), totalDiff < 0 ? 'Excess Cost' : 'Saved']);

        generatePDFTableReport(
            'EPF Social Security Code Impact Analysis', 
            headers, 
            rows, 
            fileName, 
            'l', 
            'Note: "Old Contribution" simulated on Basic+DA+Retn (capped @ 15k). "New Contribution" is Actual Total Liability.', 
            companyProfile
        );
    }
};

// ... existing code ...
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
        
        // Calculate Total Used (Availed + Encashed)
        const elUsed = (l.el.availed || 0) + (l.el.encashed || 0);

        return [
            e.id, 
            e.name, 
            l.el.opening || 0, 
            l.el.eligible || 0, 
            elUsed, 
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
