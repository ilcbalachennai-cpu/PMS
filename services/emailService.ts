
import { CompanyProfile, Employee } from '../types';

export interface EmailResult {
    success: boolean;
    employeeId: string;
    employeeName: string;
    error?: string;
}

export const sendPayslipsViaEmail = async (
    companyProfile: CompanyProfile,
    employees: Employee[],
    month: string,
    year: number,
    payslipPdfs: { [employeeId: string]: Uint8Array }
): Promise<EmailResult[]> => {
    if (!companyProfile.smtpConfig) {
        throw new Error('SMTP Configuration is missing in Company Profile');
    }

    const results: EmailResult[] = [];

    // We send emails one by one to avoid overwhelming the SMTP server and for better error tracking
    for (const emp of employees) {
        if (!emp.email) {
            results.push({
                success: false,
                employeeId: emp.id,
                employeeName: emp.name,
                error: 'No email address found in profile'
            });
            continue;
        }

        const pdfData = payslipPdfs[emp.id];
        if (!pdfData) {
            results.push({
                success: false,
                employeeId: emp.id,
                employeeName: emp.name,
                error: 'Payslip PDF data missing'
            });
            continue;
        }

        try {
            // @ts-ignore
            if (window.electronAPI && window.electronAPI.sendPayslipEmail) {
                // @ts-ignore
                const res = await window.electronAPI.sendPayslipEmail({
                    smtp: companyProfile.smtpConfig,
                    to: emp.email,
                    subject: `Payslip for ${month} ${year} - ${companyProfile.establishmentName}`,
                    body: `Dear ${emp.name},\n\nPlease find attached your payslip for the month of ${month} ${year}.\n\nBest Regards,\n${companyProfile.smtpConfig.fromName || companyProfile.establishmentName}`,
                    attachment: {
                        filename: `Payslip_${month}_${year}.pdf`,
                        content: pdfData
                    }
                });

                results.push({
                    success: res.success,
                    employeeId: emp.id,
                    employeeName: emp.name,
                    error: res.error
                });
            } else {
                throw new Error('Email API not available in this environment');
            }
        } catch (e: any) {
            results.push({
                success: false,
                employeeId: emp.id,
                employeeName: emp.name,
                error: e.message
            });
        }
    }

    return results;
};
