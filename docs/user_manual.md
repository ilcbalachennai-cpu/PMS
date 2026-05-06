# BharatPay Pro - Comprehensive User Manual
*Version 03.01.03*

Welcome to **BharatPay Pro**, a premium Payroll Management System designed for precision, security, and ease of use. This manual will guide you through every aspect of the software, including the advanced **Multi-Company Architecture** introduced in the 03.xx series.

---

## 1. Getting Started

### 1.1 First-Time Installation
When you launch BharatPay Pro for the first time, the system will initialize your environment.
1.  **Grant Permissions**: If Windows Firewall or Anti-Virus prompts you, click "Allow" to ensure the local database and update services can run.
2.  **Registration**: New users must click **"Register Now"**. 
    *   **Verify Identity**: Provide valid credentials for OTP verification.
    *   **Set Password**: Create a strong **Administrator Password**. (This password is tied to your hardware; do not lose it!)

### 1.2 Hardware Binding & Security
BharatPay Pro uses **Hardware-Locked Identity**. Your license and data are securely tied to your specific machine.
*   **Daily Sync**: The system requires an internet connection **daily** to verify license status.
*   **Identity Restoration**: If you move to a new machine, use the **Restoration Portal** with your registered Email/Mobile.

---

## 2. Multi-Organization Management

BharatPay Pro 03.01.03 supports managing multiple establishments or companies within a single installation. Each company operates in its own **Data Silo**, ensuring total isolation of payroll, employees, and settings.

### 2.1 The Organization Gate
When you log into an installation with multiple companies, the **Organization Selector** will appear:
*   **Select Unit**: Choose the establishment you wish to work on for the current session.
*   **Single-Company Mode**: If you have only one establishment registered, the system will **Auto-Load** your dashboard directly, bypassing the selector for a faster workflow.

### 2.2 Adding a New Establishment
To manage an additional company:
1.  Go to the **Organization Gate** (via Logout or Switcher).
2.  Click **"Add New Unit"**.
3.  Complete the registration for the new establishment. It will be assigned a unique **Company ID** (e.g., CHEN01_102).

### 2.3 The Company Switcher
While working in the Dashboard, you can quickly jump between organizations:
*   Use the **Company Selector** in the sidebar.
*   Note: For data integrity, switching is restricted while you have an active payroll process or report open. Return to the Dashboard to switch units.

---

## 3. Statutory Compliance Configuration

### 3.1 Default Basis
By default, **Code Wages** (Labour Code compliant) serve as the basis for all statutory calculations. You can opt for **Original Wages** (Pre Code Wages) in the Configuration settings.

### 3.2 Global & Local Policies
While most policies are specific to an organization (e.g., Leave Policy), the **Hardware License** is global to your installation. Ensure each establishment's profile is fully updated in **Settings > Company Profile**.

---

## 4. Setting Up Your Company

Before adding employees, configure your establishment profile:
1.  **Establishment Details**: Enter Name, Address, PAN, GST, PF, and ESI codes.
2.  **Statutory Configuration**: 
    *   Set **PF/ESI Ceilings** as per current central government norms.
    *   Configure **Professional Tax (PT)** slabs based on your state.

---

## 5. Employee Management

Navigate to the **Employees** section to manage your workforce.
*   **Bulk Import**: Use the "Import Excel" feature to migrate large datasets quickly.
*   **Data Isolation**: Employees added to one company will **never** appear in another, ensuring strict data privacy between establishments.

---

## 6. Monthly Payroll Workflow

The "Pay Process" module follows a logical workflow:
1.  **Attendance**: Enter "Present Days" for the month.
2.  **Leave Management**: Record leaves availed. 
3.  **Advance & Fines**: Manage employee loans with automated EMI recovery.
4.  **Arrear Salary**: Compute retroactive increments with flat percentage or ad-hoc amounts.
5.  **Processing**: Click **"Calculate Salaries"**. The engine handles PF, ESI, PT, and IT (TDS) logic instantly.
6.  **Safety Backup**: Before every major update or finalization, the system creates a **Safety Snapshot** of your database and configuration in the `Data backup` folder.

---

## 7. Pay Reports
Once the payroll is processed, you can generate various reports:
*   **Pay Sheet**: Filterable by **Site, Branch, or Division**. Export as PDF or Excel.
*   **Pay Slips**: Professional slips for individual or bulk generation.
*   **Bank Statement**: Ready-to-use transfer instructions.

## 8. Statutory Reports
BharatPay Pro automates complex statutory filings:
*   **PF (Provident Fund)**: Generates **PF ECR (Text/Excel)** and forms (12A, 3A, 6A).
*   **ESI**: Generates **Monthly Return (Excel)** and Form 5.
*   **Labour Registers**: **Form B (Wage Register)** and **Form C (Muster Roll)** compliant with current laws.

---

## 9. Code Analysis (Social Security)
Stay ahead of compliance with the proposed Social Security Code 2020:
*   **Clause 88 Threshold**: Monitors if exclusions exceed 50% of gross remuneration.
*   **Impact Simulation**: Simulates projected liabilities under the new "Code Wages" definition.

---

## 10. Troubleshooting & Support

### 10.1 Common Errors
*   **"Security Violation"**: Occurs if system clock is changed. Reset to "Internet Time".
*   **"License Locked"**: Ensure internet connectivity. For hardware changes, use **Identity Restoration**.

### 10.2 Contacting Support
📧 **Email**: ilcbala.Bharatpayroll@gmail.com
📞 **Support**: Refer to your License Agreement for the dedicated helpdesk number.

---
*© 2026 BharatPay Pro. All Rights Reserved. (Version 03.01.03)*
