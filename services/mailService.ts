import { PayrollResult, Employee, CompanyProfile } from '../types';
import { generateSinglePayslipU8 } from './reportService';

export interface MailOptions {
    to: string;
    subject: string;
    text: string;
    html: string;
    attachments?: Array<{
        filename: string;
        content: Uint8Array;
    }>;
}

export const sendPayslipEmail = async (
    result: PayrollResult,
    employees: Employee[],
    companyProfile: CompanyProfile,
    month: string,
    year: number
): Promise<{ success: boolean; error?: string }> => {
    try {
        const emp = employees.find(e => e.id === result.employeeId);
        if (!emp || !emp.email) {
            return { success: false, error: 'Employee email not found' };
        }

        // 1. Generate PDF
        const pdfU8 = await generateSinglePayslipU8(result, employees, month, year, companyProfile);
        if (!pdfU8) {
            return { success: false, error: 'Failed to generate payslip PDF' };
        }

        // 2. Prepare SMTP Config from Company Profile
        const smtpConfig = {
            host: companyProfile.smtpHost || '',
            port: Number(companyProfile.smtpPort) || 587,
            secure: companyProfile.smtpSecurity || 'TLS', // 'SSL' or 'TLS'
            user: companyProfile.smtpUser || '',
            pass: companyProfile.smtpPassword || '',
            senderName: companyProfile.senderName || companyProfile.establishmentName || 'Payroll System',
            senderEmail: companyProfile.senderEmail || companyProfile.smtpUser || ''
        };

        if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
            return { success: false, error: 'SMTP configuration is incomplete in Company Profile' };
        }

        // 3. Prepare Mail Options
        const subject = `Pay Slip for ${month} ${year} - ${companyProfile.establishmentName}`;
        const bodyText = `Dear ${emp.name},\n\nPlease find attached your pay slip for the month of ${month} ${year}.\n\nRegards,\nPayroll Department\n${companyProfile.establishmentName}`;
        const bodyHtml = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <p>Dear <strong>${emp.name}</strong>,</p>
                <p>Please find attached your pay slip for the month of <strong>${month} ${year}</strong>.</p>
                <br>
                <p>Regards,<br>
                <strong>Payroll Department</strong><br>
                ${companyProfile.establishmentName}</p>
                <hr style="border: none; border-top: 1px solid #eee;">
                <p style="font-size: 11px; color: #999;">This is an automated message. Please do not reply to this email.</p>
            </div>
        `;

        const mailOptions: MailOptions = {
            to: emp.email,
            subject,
            text: bodyText,
            html: bodyHtml,
            attachments: [
                {
                    filename: `PaySlip_${month}_${year}.pdf`,
                    content: pdfU8
                }
            ]
        };

        // 4. Dispatch via Electron IPC
        // @ts-ignore
        const res = await window.electronAPI.sendEmail(smtpConfig, mailOptions);
        return res;

    } catch (e: any) {
        console.error('sendPayslipEmail failed:', e);
        return { success: false, error: e.message };
    }
};
