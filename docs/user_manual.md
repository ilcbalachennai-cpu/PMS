# BharatPay Pro - Comprehensive User Manual
*Version 02.02.17*

Welcome to **BharatPay Pro**, a premium Payroll Management System designed for precision, security, and ease of use. This manual will guide you through every aspect of the software, from initial setup to advanced reporting.

---

## 1. Getting Started

### 1.1 First-Time Installation
When you launch BharatPay Pro for the first time, the system will initialize your local database.
1.  **Grant Permissions**: If Windows Firewall or Anti-Virus prompts you, click "Allow" to ensure the local database and update services can run.
2.  **Registration**: New users must click **"Register Now"**. 
    *   **Enter your Name**: Use your full legal name or establishment administrator name.
    *   **Enter your Email and Mobile number**: Provide valid credentials for OTP verification.
    *   **Verify Identity**: Enter the OTP sent to your inbox to proceed.
    *   **Set Password**: Create a strong **Administrator Password**. (This password is tied to your hardware; do not lose it!)

### 1.2 Hardware Binding & Security
BharatPay Pro uses **Hardware-Locked Identity**. Your license and data are securely tied to your specific machine to ensure maximum data integrity.
*   **Single Admin Policy**: Only one Administrator is permitted per installation.
*   **Internet Synchronization**: The system requires an internet connection **daily** (at least once every 24 hours) to verify license status and prevent unauthorized access.
*   **Idle Timeout**: For security, the app will automatically log you out after 10 minutes of inactivity.

---

## 2. Statutory Compliance Configuration

### 2.1 Default Basis
By default, **Code Wages** (Labour Code compliant) serve as the basis for all statutory calculations, including EPF, ESI, and Gratuity. In case you opt for **Original Wages** (Pre Code Wages) as the basis, you must select the specific wage components for EPF and ESI calculations.

### 2.2 Initial Configuration
First-time users must configure the statutory compliance settings to match their establishment's requirements:
*   **Core Compliance**: Setup EPF, ESI, Professional Tax (PT), and Labour Welfare Fund (LWF).
*   **Policies**: Define your Gratuity, **Leave Policy**, and Bonus Policy.
*   **Optional Modules**: Choose to enable or disable **Overtime (OT)** and **Arrear Salary** calculations based on your needs.

---

## 3. Setting Up Your Company

Before adding employees, configure your establishment profile in **Settings > Company Profile**.
1.  **Establishment Details**: Enter your Name, Address, PAN, GST, PF, and ESI codes.
2.  **Statutory Configuration**: 
    *   Set **PF/ESI Ceilings** as per current central government norms.
    *   Configure **Professional Tax (PT)** slabs based on your state (e.g., Karnataka, Tamil Nadu).

---

## 4. Employee Management

Navigate to the **Employees** section to manage your workforce.
*   **Add Employee**: Click "+" to enter details. **DOJ (Date of Joining)** is critical as the system uses it to calculate pro-rata leave and segments.
*   **Bulk Import**: Use the "Import Excel" feature to migrate large datasets quickly.
*   **Leave Ledgers**: Each employee has automated tracking for EL (Earned Leave), SL (Sick Leave), and CL (Casual Leave).
*   **Documents**: You can upload photos and digital copies of forms (Form 11, etc.) for each employee.

---

## 5. Monthly Payroll Workflow

The "Pay Process" module follows a logical workflow:
1.  **Attendance**: Enter "Present Days" for the month. LOP (Loss of Pay) is automatically calculated based on the days in the month.
2.  **Leave Management**: Record any leaves availed. The system will alert you if an employee exceeds their balance.
3.  **Advance & Fines**: Manage employee loans/advances. The system automatically recovers EMIs until the balance is zero.
4.  **Overtime (OT)**: If enabled, enter OT hours or days.
5.  **Arrear Salary**: For retroactive salary revisions:
    - Select the **Effective Month** from which the increment applies.
    - Choose calculation mode: **Percentage (%)** (Flat/Specific) or **Fixed Ad-hoc Amount**.
    - The system computes total arrears for the elapsed period. **Save Draft** to record and **Finalize** to update Master database.
6.  **Processing**: Click **"Calculate Salaries"**. The engine will handle all PF, ESI, PT, and IT (TDS) tax logic instantly.
7.  **Freezing**: Once verified, "Freeze" the month. This locks the data and advances the system to the next payroll month.

---

## 6. Pay Reports
Once the payroll is processed and finalized, you can generate various payment-related reports:
*   **Pay Sheet**: A detailed summary of earnings and deductions. Filterable by **Site, Branch, or Division**. Export as **Modern/Legacy PDF** or **Excel**.
*   **Pay Slips**: Professional salary slips for individual employees or bulk generation for the entire workforce.
*   **Bank Statement**: Ready-to-use transfer instructions for banks, including accounts and IFSC codes.
*   **Arrear Report**: Detailed breakdown of retroactive salary revisions and payments.
*   **Leave Ledger**: Tracks EL, SL, and CL balances and usage for the month.
*   **Advance Shortfall**: Lists employees where planned advance recovery could not be fully met.

## 7. Statutory Reports
BharatPay Pro automates complex statutory filings and register maintenance:
*   **PF (Provident Fund)**: Generates **PF ECR (Text/Excel)**, Arrear ECR, and statutory forms (12A, 3A, 6A).
*   **ESI**: Generates **Monthly Return (Excel)**, Form 5, Exit reports, and Joiner/Leaver lists.
*   **Taxes**: Professional Tax (PT), TDS (Income Tax), and Labour Welfare Fund (LWF) reports.
*   **Benefits**: Monthly and Period-wise **Bonus & Gratuity** statements.
*   **Labour Registers**: **Form B (Wage Register)**, **Form C (Muster Roll)**, and State-specific registers (e.g., Tamil Nadu, Karnataka).

## 8. MIS (Management Information)
Advanced tools for data-driven HR management:
*   **Dynamic Report Builder**: Create custom reports by selecting your own columns from profile and payroll data.
*   **Increment Analysis**: Analyze salary growth with variance comparisons between two periods.
*   **Mailing Service**: Automated emailing of payslips directly to employees.
*   **Data Analysis**: Bulk registers for employee and payment data across selected years.

## 9. Code Analysis (Social Security)
Stay ahead of compliance with the proposed Social Security Code 2020:
*   **Clause 88 Threshold**: Monitors if exclusions exceed 50% of gross remuneration.
*   **Impact Simulation**: Simulates projected liabilities under the new "Code Wages" definition.
*   **Coverage Monitoring**: Evaluates how the new ceiling affects employee ESI/PF eligibility.

---

## 10. Troubleshooting & Support

### 10.1 Common Errors
*   **"Security Violation"**: Occurs if system clock is changed manually. Reset to "Internet Time" and restart.
*   **"License Locked"**: Ensure internet connectivity. For hardware changes, use **Identity Restoration**.
*   **"Sync Required"**: Triggered after 24 hours offline. Connect for 60 seconds to refresh.

### 10.2 Contacting Support
📧 **Email**: ilcbala.Bharatpayroll@gmail.com
📞 **Support**: Refer to your License Agreement for the dedicated helpdesk number.

---
*© 2026 BharatPay Pro. All Rights Reserved.*
