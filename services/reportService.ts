import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { PayrollResult, Employee, StatutoryConfig, CompanyProfile, Attendance, LeaveLedger, AdvanceLedger } from '../types';

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

// Helper: Number to Words (Indian Rupees)
export const numberToWords = (num: number): string => {
  const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];

  if ((num = num.toString() as any).length > 9) return 'overflow';
  const n: any = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return ''; 
  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str;
};

// Excel Generation
export const generateExcelReport = (data: any[], sheetName: string, fileName: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

// PDF Table Report (Generic)
export const generatePDFTableReport = (
  title: string, 
  headers: string[], 
  data: any[][], 
  fileName: string, 
  orientation: 'p' | 'l' = 'p',
  footerText?: string,
  companyProfile?: CompanyProfile
) => {
  const doc = new jsPDF(orientation, 'mm', 'a4');
  
  if (companyProfile) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(companyProfile.establishmentName, 14, 15);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(title, 14, 22);
  } else {
      doc.setFontSize(14);
      doc.text(title, 14, 15);
  }

  autoTable(doc, {
    startY: 30,
    head: [headers],
    body: data,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 }
  });

  if (footerText) {
      const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.text(footerText, 14, pageHeight - 10);
  }

  doc.save(`${fileName}.pdf`);
};

// Pay Sheet PDF
export const generateSimplePaySheetPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ["Emp ID", "Name", "Days", "Basic", "DA", "HRA", "Gross", "PF", "ESI", "PT/IT", "Net Pay"];
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [
            r.employeeId,
            emp?.name || '',
            r.payableDays,
            r.earnings.basic,
            r.earnings.da,
            r.earnings.hra,
            r.earnings.total,
            r.deductions.epf,
            r.deductions.esi,
            r.deductions.pt + r.deductions.it,
            r.netPay
        ];
    });
    generatePDFTableReport(`Pay Sheet - ${month} ${year}`, headers, data, `PaySheet_${month}_${year}`, 'l', undefined, companyProfile);
};

// Pay Slips PDF
export const generatePaySlipsPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    let yPos = 10;
    
    results.forEach((r, index) => {
        if (index > 0 && index % 2 === 0) {
            doc.addPage();
            yPos = 10;
        }
        
        const emp = employees.find(e => e.id === r.employeeId);
        if (!emp) return;

        // Draw Pay Slip Box
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(companyProfile.establishmentName, 105, yPos + 10, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Pay Slip for ${month} ${year}`, 105, yPos + 16, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Emp ID: ${r.employeeId}`, 14, yPos + 25);
        doc.text(`Name: ${emp.name}`, 80, yPos + 25);
        doc.text(`Designation: ${emp.designation}`, 14, yPos + 30);
        doc.text(`Days Worked: ${r.payableDays}`, 80, yPos + 30);

        // Earnings
        let row = yPos + 40;
        doc.text("Earnings", 14, row); doc.text("Amount", 60, row, { align: 'right' });
        doc.text("Deductions", 80, row); doc.text("Amount", 130, row, { align: 'right' });
        row += 5;
        doc.line(14, row-1, 130, row-1);
        
        doc.text("Basic", 14, row); doc.text(String(r.earnings.basic), 60, row, { align: 'right' });
        doc.text("PF", 80, row); doc.text(String(r.deductions.epf), 130, row, { align: 'right' });
        row += 5;
        doc.text("DA", 14, row); doc.text(String(r.earnings.da), 60, row, { align: 'right' });
        doc.text("ESI", 80, row); doc.text(String(r.deductions.esi), 130, row, { align: 'right' });
        row += 5;
        doc.text("HRA", 14, row); doc.text(String(r.earnings.hra), 60, row, { align: 'right' });
        doc.text("PT", 80, row); doc.text(String(r.deductions.pt), 130, row, { align: 'right' });
        row += 5;
        
        doc.setFont("helvetica", "bold");
        doc.text("Gross Earnings", 14, row+5); doc.text(String(r.earnings.total), 60, row+5, { align: 'right' });
        doc.text("Total Ded.", 80, row+5); doc.text(String(r.deductions.total), 130, row+5, { align: 'right' });
        doc.text(`Net Pay: ${r.netPay}`, 14, row+12);
        
        doc.line(10, yPos + 75, 200, yPos + 75); // Separator
        yPos += 80;
    });
    
    doc.save(`PaySlips_${month}_${year}.pdf`);
};

// Bank Statement PDF
export const generateBankStatementPDF = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ["Emp ID", "Name", "Bank Account", "IFSC", "Net Pay"];
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [r.employeeId, emp?.name, emp?.bankAccount, emp?.ifsc, r.netPay];
    });
    generatePDFTableReport(`Bank Statement - ${month} ${year}`, headers, data, `BankStatement_${month}_${year}`, 'p', undefined, companyProfile);
};

// Leave Ledger Report PDF
export const generateLeaveLedgerReport = (
    results: PayrollResult[], 
    employees: Employee[], 
    leaveLedgers: LeaveLedger[], 
    month: string, 
    year: number, 
    format: string, // unused but kept for signature
    companyProfile: CompanyProfile
) => {
    const headers = ["ID", "Name", "EL Open", "EL Cred", "EL Used", "EL Bal", "SL Bal", "CL Bal"];
    const data = employees.map(e => {
        const l = leaveLedgers.find(led => led.employeeId === e.id);
        const elUsed = (l?.el.availed || 0) + (l?.el.encashed || 0);
        return [
            e.id, 
            e.name, 
            l?.el.opening || 0, 
            l?.el.eligible || 0, 
            elUsed, 
            l?.el.balance || 0,
            l?.sl.balance || 0,
            l?.cl.balance || 0
        ];
    });
    generatePDFTableReport(`Leave Ledger - ${month} ${year}`, headers, data, `LeaveLedger_${month}_${year}`, 'l', undefined, companyProfile);
};

// Advance Shortfall Report
export const generateAdvanceShortfallReport = (data: any[], month: string, year: number, format: string, companyProfile: CompanyProfile) => {
    const headers = ["ID", "Name", "Target Rec.", "Actual Rec.", "Shortfall"];
    const rows = data.map(d => [d.id, d.name, d.target, d.recovered, d.shortfall]);
    generatePDFTableReport(`Advance Shortfall - ${month} ${year}`, headers, rows, `AdvShortfall_${month}_${year}`, 'p', undefined, companyProfile);
};

// PF ECR (Text/Excel)
export const generatePFECR = (results: PayrollResult[], employees: Employee[], format: 'Excel' | 'Text', fileName: string) => {
    if (format === 'Text') {
        let content = "";
        results.forEach(r => {
            const emp = employees.find(e => e.id === r.employeeId);
            if (!emp) return;
            const line = `${emp.uanc}#${emp.name}#${r.earnings.total}#${r.earnings.basic}#${r.earnings.basic}#${r.earnings.basic}#${r.deductions.epf}#${r.employerContributions.eps}#${r.employerContributions.epf}#${r.daysInMonth - r.payableDays}#0`;
            content += line + "\n";
        });
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.txt`;
        a.click();
    } else {
        const data = results.map(r => {
            const emp = employees.find(e => e.id === r.employeeId);
            return {
                UAN: emp?.uanc,
                Name: emp?.name,
                Gross: r.earnings.total,
                EPF_Wages: r.earnings.basic, // Simplified
                EE_Share: r.deductions.epf,
                ER_Share_EPF: r.employerContributions.epf,
                ER_Share_EPS: r.employerContributions.eps
            };
        });
        generateExcelReport(data, "PF ECR", fileName);
    }
};

export const generateESIReturn = (results: PayrollResult[], employees: Employee[], format: 'Excel' | 'Text', fileName: string, companyProfile: CompanyProfile) => {
    const data = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return {
            IP_Number: emp?.esiNumber,
            Name: emp?.name,
            Days: r.payableDays,
            Wages: r.earnings.total,
            EE_Contribution: r.deductions.esi,
            ER_Contribution: r.employerContributions.esi
        };
    });
    if (format === 'Excel') {
        generateExcelReport(data, "ESI Return", fileName);
    } else {
        const headers = ["IP No", "Name", "Days", "Wages", "EE Contrib"];
        const rows = data.map(d => [d.IP_Number, d.Name, d.Days, d.Wages, d.EE_Contribution]);
        generatePDFTableReport("ESI Return", headers, rows, fileName, 'p', undefined, companyProfile);
    }
};

export const generatePTReport = (results: PayrollResult[], employees: Employee[], fileName: string, companyProfile: CompanyProfile) => {
    const data = results.filter(r => r.deductions.pt > 0).map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [r.employeeId, emp?.name, r.earnings.total, r.deductions.pt];
    });
    const headers = ["ID", "Name", "Gross Wages", "PT Deducted"];
    generatePDFTableReport("PT Report", headers, data, fileName, 'p', undefined, companyProfile);
};

export const generateTDSReport = (results: PayrollResult[], employees: Employee[], fileName: string, companyProfile: CompanyProfile) => {
    const data = results.filter(r => r.deductions.it > 0).map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [r.employeeId, emp?.name, emp?.pan, r.deductions.it];
    });
    const headers = ["ID", "Name", "PAN", "TDS Deducted"];
    generatePDFTableReport("TDS Report", headers, data, fileName, 'p', undefined, companyProfile);
};

export const generateCodeOnWagesReport = (results: PayrollResult[], employees: Employee[], format: 'Excel'|'PDF', fileName: string, companyProfile: CompanyProfile) => {
    const headers = ["ID", "Name", "Gross", "Basic+DA", "Exclusions", "50% Limit", "Added to Wage", "PF Wage", "ESI Wage"];
    const rows = results.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const basicDA = r.earnings.basic + r.earnings.da + r.earnings.retainingAllowance;
        const exclusions = r.earnings.total - basicDA;
        const limit = r.earnings.total * 0.5;
        const added = exclusions > limit ? exclusions - limit : 0;
        return [
            r.employeeId, 
            emp?.name, 
            r.earnings.total, 
            basicDA, 
            exclusions, 
            limit, 
            added, 
            r.isCode88 ? "Adjusted" : "Normal", 
            r.isESICodeWagesUsed ? "Adjusted" : "Normal"
        ];
    });
    if (format === 'Excel') {
        const data = rows.map(r => ({
            ID: r[0], Name: r[1], Gross: r[2], BasicDA: r[3], Exclusions: r[4], Limit: r[5], Added: r[6], PFWage: r[7], ESIWage: r[8]
        }));
        generateExcelReport(data, "Code on Wages", fileName);
    } else {
        generatePDFTableReport("Social Security Code (Clause 88) Impact", headers, rows, fileName, 'l', undefined, companyProfile);
    }
};

export const generateFormB = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ["Sl.No", "Name", "Designation", "Total Work", "Rate of Wages", "Gross Wages", "Deductions", "Net Wages", "Signature"];
    const rows = results.map((r, i) => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [i+1, emp?.name, emp?.designation, r.payableDays, emp?.basicPay, r.earnings.total, r.deductions.total, r.netPay, ''];
    });
    generatePDFTableReport(`Form B (Wage Register) - ${month} ${year}`, headers, rows, `FormB_${month}_${year}`, 'l', undefined, companyProfile);
};

export const generateFormC = (results: PayrollResult[], employees: Employee[], attendance: Attendance[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ["Sl.No", "Name", "Father/Husband", "Sex", "Date of Join", "Present", "Leave", "Total"];
    const rows = results.map((r, i) => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [i+1, emp?.name, emp?.fatherSpouseName, emp?.gender, formatDateInd(emp?.doj), r.payableDays, (r.daysInMonth - r.payableDays), r.daysInMonth];
    });
    generatePDFTableReport(`Form C (Muster Roll) - ${month} ${year}`, headers, rows, `FormC_${month}_${year}`, 'l', undefined, companyProfile);
};

export const generateTNFormR = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    generateFormB(results, employees, month, year, companyProfile); 
};

export const generateTNFormT = (results: PayrollResult[], employees: Employee[], attendance: Attendance[], leaveLedgers: LeaveLedger[], month: string, year: number, companyProfile: CompanyProfile) => {
    generateSimplePaySheetPDF(results, employees, month, year, companyProfile);
};

export const generateTNFormP = (results: PayrollResult[], employees: Employee[], advanceLedgers: AdvanceLedger[], month: string, year: number, companyProfile: CompanyProfile) => {
    const headers = ["ID", "Name", "Date of Adv", "Amount", "Purpose", "Recovered", "Balance"];
    const rows = results.filter(r => r.deductions.advanceRecovery > 0).map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const adv = advanceLedgers.find(a => a.employeeId === r.employeeId);
        return [r.employeeId, emp?.name, "-", adv?.totalAdvance, "Salary Adv", r.deductions.advanceRecovery, adv?.balance];
    });
    generatePDFTableReport(`Form P (Advances) - ${month} ${year}`, headers, rows, `FormP_${month}_${year}`, 'p', undefined, companyProfile);
};

export const generatePFForm3A = (
    history: PayrollResult[], 
    employees: Employee[], 
    config: StatutoryConfig, 
    startMonth: string, startYear: number, 
    endMonth: string, endYear: number, 
    empId: string | undefined, 
    companyProfile: CompanyProfile
) => {
    const targetEmps = empId ? employees.filter(e => e.id === empId) : employees;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    let yPos = 10;
    doc.text(`Form 3A - Annual Contribution Card (${startYear}-${endYear})`, 105, yPos, { align: 'center' });
    yPos += 10;
    
    if(targetEmps.length > 0) {
        const e = targetEmps[0];
        doc.text(`Name: ${e.name}   UAN: ${e.uanc}`, 14, yPos);
        yPos += 10;
        
        const headers = ["Month", "Wages", "EE Share", "ER Share (PF)", "ER Share (Pen)", "Total"];
        const data = [["Apr", "15000", "1800", "550", "1250", "3600"]]; // Placeholder
        
        autoTable(doc, {
            startY: yPos,
            head: [headers],
            body: data,
        });
    }
    doc.save(`Form3A_${startYear}-${endYear}.pdf`);
};

export const generatePFForm6A = (
    history: PayrollResult[], 
    employees: Employee[], 
    config: StatutoryConfig, 
    startMonth: string, startYear: number, 
    endMonth: string, endYear: number, 
    companyProfile: CompanyProfile
) => {
    const headers = ["UAN", "Name", "Total Wages", "Total EE", "Total ER (PF)", "Total ER (Pen)"];
    const rows = employees.map(e => [e.uanc, e.name, "0", "0", "0", "0"]); // Placeholder
    generatePDFTableReport(`Form 6A (${startYear}-${endYear})`, headers, rows, `Form6A_${startYear}-${endYear}`, 'l', undefined, companyProfile);
};

export const generateESIExitReport = (results: PayrollResult[], employees: Employee[], month: string, year: number, companyProfile: CompanyProfile) => {
    const rows = results.filter(r => r.esiRemark || (r.deductions.esi === 0 && !employees.find(e => e.id === r.employeeId)?.isESIExempt)).map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        return [r.employeeId, emp?.name, r.earnings.total, r.esiRemark || "Exceeded Ceiling"];
    });
    const headers = ["ID", "Name", "Gross", "Reason"];
    generatePDFTableReport(`ESI Exit Report - ${month} ${year}`, headers, rows, `ESI_Exit_${month}_${year}`, 'p', undefined, companyProfile);
};

export const generateESICodeWagesReport = (results: PayrollResult[], employees: Employee[], format: 'Excel'|'PDF', fileName: string, companyProfile: CompanyProfile) => {
    generateCodeOnWagesReport(results, employees, format, fileName, companyProfile);
};

export const generateGratuityReport = (employees: Employee[], companyProfile: CompanyProfile) => {
    const headers = ["ID", "Name", "DOJ", "Years", "Basic+DA", "Gratuity Accrued"];
    const rows = employees.map(e => {
        const years = (new Date().getFullYear() - new Date(e.doj).getFullYear());
        const gratuity = Math.round((e.basicPay + (e.da||0)) * 15 / 26 * years);
        return [e.id, e.name, formatDateInd(e.doj), years, e.basicPay+(e.da||0), gratuity];
    });
    generatePDFTableReport("Gratuity Liability Statement", headers, rows, "Gratuity_Statement", 'l', undefined, companyProfile);
};

export const generateBonusReport = (
    history: PayrollResult[], 
    employees: Employee[], 
    config: StatutoryConfig, 
    startMonth: string, startYear: number, 
    endMonth: string, endYear: number, 
    companyProfile: CompanyProfile,
    format: 'Excel'|'PDF'
) => {
    const headers = ["ID", "Name", "Total Wages", "Bonus Payable"];
    const rows = employees.map(e => [e.id, e.name, "0", "0"]); // Placeholder
    generatePDFTableReport("Bonus Statement (Form C)", headers, rows, "Bonus_Statement", 'l', undefined, companyProfile);
};

export const generateEPFCodeImpactReport = (results: PayrollResult[], employees: Employee[], format: 'Excel'|'PDF', fileName: string, companyProfile: CompanyProfile) => {
    generateCodeOnWagesReport(results, employees, format, fileName, companyProfile);
};

export const generatePFForm12A = (results: PayrollResult[], employees: Employee[], config: StatutoryConfig, companyProfile: CompanyProfile, month: string, year: number) => {
    let total_epf_wages = 0;
    let total_eps_wages = 0;
    let total_edli_wages = 0;
    
    let total_ee_share = 0;
    let total_er_epf_share = 0;
    let total_er_eps_share = 0;

    results.forEach(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        if (!emp) return;

        total_ee_share += (r.deductions.epf || 0) + (r.deductions.vpf || 0);
        total_er_eps_share += (r.employerContributions.eps || 0);
        total_er_epf_share += (r.employerContributions.epf || 0);

        const wage = r.deductions.epf > 0 ? Math.round(r.deductions.epf / config.epfEmployeeRate) : 0;
        
        total_epf_wages += wage;
        
        const eps_wage = r.employerContributions.eps > 0 ? Math.min(wage, 15000) : 0;
        total_eps_wages += eps_wage;
        total_edli_wages += eps_wage; 
    });

    const ac2 = Math.max(500, Math.round(total_epf_wages * 0.005)); 
    const ac21 = Math.round(total_edli_wages * 0.005); 
    
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
    const centerX = pageWidth / 2;
    const marginX = 14;
    const endX = pageWidth - marginX;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 0, 0); 
    doc.text("PF_Form12A (Revised)", centerX, 12, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0); 
    doc.text("(Only for Un-Exempted Establishment)", centerX, 17, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const startY = 28;
    const lineHeight = 5;

    const col1X = marginX; 
    const col2X = 110;  
    const col3X = 210; 

    doc.text("Name Address of Establishment", col1X, startY);
    doc.setFont("helvetica", "bold");
    doc.text(companyProfile.establishmentName || 'ESTABLISHMENT NAME', col1X, startY + lineHeight);
    doc.setFont("helvetica", "normal");
    doc.text(`${companyProfile.city || ''} ${companyProfile.state || ''}`, col1X, startY + lineHeight * 2);

    doc.text("| Employees Provident Fund And Misc. Provision Act 1952", col2X, startY);
    doc.text("| Employees Pension Scheme [Paragraph 20 (4)]", col2X, startY + lineHeight);
    doc.text(`| Currency Period from: 1st ${month} to End of ${month} ${year}`, col2X, startY + lineHeight * 2);
    doc.text(`| Statement of Contribution for the Month of ${month} ${year}`, col2X, startY + lineHeight * 3);

    doc.text("| (To be Filled by the EPFO)", col3X, startY);
    doc.text("| Establishment Status: Un-Exempted", col3X, startY + lineHeight);
    doc.text("| Group Code:", col3X, startY + lineHeight * 2);
    doc.text(`| Establishment Code: ${companyProfile.pfCode || ''}`, col3X, startY + lineHeight * 3);

    const sheetTitleY = startY + lineHeight * 5;
    doc.setDrawColor(255, 0, 0); 
    doc.setLineWidth(0.5);
    
    doc.line(marginX, sheetTitleY, endX, sheetTitleY);
    
    doc.setTextColor(255, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("PF ECR_UAN_CALCULATION SHEET", centerX, sheetTitleY + 5, { align: 'center' });
    
    doc.line(marginX, sheetTitleY + 7, endX, sheetTitleY + 7);

    const trrnY = sheetTitleY + 14;
    const boxWidth = 40;
    const boxHeight = 6;
    
    const trrnBoxX = (pageWidth / 3) - (boxWidth / 2);
    const dateBoxX = (pageWidth * 2 / 3) - (boxWidth / 2);

    doc.setFillColor(255, 255, 0); 
    doc.rect(trrnBoxX, trrnY, boxWidth, boxHeight, 'F'); 
    doc.rect(dateBoxX, trrnY, boxWidth, boxHeight, 'F'); 

    doc.setTextColor(0, 0, 0); 
    doc.setFontSize(10);
    doc.text("TRRN", trrnBoxX + (boxWidth/2), trrnY + 4.5, { align: 'center' });
    doc.text("Date", dateBoxX + (boxWidth/2), trrnY + 4.5, { align: 'center' });

    const tableBody = [
        [
            'EPF_Wages (A/c No.1)\n(12%+3.67%)',
            String(total_epf_wages),
            `12%               ${total_ee_share}`,
            `3.67%             ${total_er_epf_share}`,
            String(total_ee_share + total_er_epf_share)
        ],
        [
            'EPS_Wages (A/c No.10)\n(8.33%)',
            String(total_eps_wages),
            '', 
            `8.33%             ${total_er_eps_share}`,
            String(total_er_eps_share)
        ],
        [
            'EDLI_Wages (A/c No.21)\n(0.50%)',
            String(total_edli_wages),
            '',
            '',
            String(ac21) 
        ],
        [
            'Admin_Charges (A/c No.2)\n(0.50%)',
            String(total_epf_wages),
            '',
            '',
            String(ac2)
        ],
        [
            'Admin_Charg_EDLI (0.0%)',
            '0',
            '',
            '',
            '0'
        ]
    ];

    const grandTotal = total_ee_share + total_er_epf_share + total_er_eps_share + ac21 + ac2;

    autoTable(doc, {
        startY: trrnY + 12,
        margin: { left: marginX, right: marginX },
        head: [['PF-Wages', String(total_epf_wages), 'Employee Share', 'Employer Share', 'Total']],
        body: tableBody,
        foot: [['', 'Total', String(total_ee_share), String(total_er_epf_share + total_er_eps_share), String(grandTotal)]],
        theme: 'plain',
        styles: {
            fontSize: 10,
            cellPadding: 4,
            textColor: 0,
            font: "helvetica",
            lineWidth: 0,
            overflow: 'linebreak'
        },
        headStyles: {
            fontStyle: 'bold',
            textColor: 0,
            minCellHeight: 12,
            valign: 'middle',
            fontSize: 10
        },
        footStyles: {
            fontStyle: 'bold',
            textColor: 0,
            fontSize: 10
        },
        columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 40 },
            2: { cellWidth: 60 },
            3: { cellWidth: 60 },
            4: { cellWidth: 'auto', halign: 'right' }
        },
        willDrawCell: (data) => {
            if (data.section === 'head' || data.section === 'foot') {
                doc.setDrawColor(255, 0, 0); 
                doc.setLineWidth(0.5);
                doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
                doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
            }
        }
    });
    
    doc.save(`PF_Form12A_${month}_${year}.pdf`);
};
