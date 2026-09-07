# Provident Fund (PF) Calculation Specification & Guide
*BharatPay Pro - Payroll Management System*

This document outlines the official calculation specification for **Employees' Provident Fund (EPF)** and **Employees' Pension Scheme (EPS)** in BharatPay Pro, covering both **Normal Statutory Conditions** and **Higher Contribution Conditions**.

---

## 1. Fundamentals & Core Variables

### 1.1 Baseline Parameters
* **`epfCeiling`**: The statutory EPF wage ceiling, standardly **₹15,000** per month (configurable in Statutory Settings).
* **`epfEmployeeRate`**: Standard **12%** (0.12).
* **`epfEmployerRate`**: Standard **12%** (0.12) total employer contribution.
* **`epsRate`**: Standard **8.33%** (0.0833) allocated to Pension Scheme (EPS).
* **`daysInMonth`**: Total calendar days in the processing month (28, 29, 30, or 31).
* **`effectivePayableDays`**: Sum of days worked:
  $$\text{effectivePayableDays} = \text{Present} + \text{WeeklyOff} + \text{FestivalHoliday} + \text{PaidLeave}$$
* **Proration Factor**:
  $$\text{factor} = \frac{\text{effectivePayableDays}}{\text{daysInMonth}}$$
* **Prorated Statutory Ceiling**:
  $$\text{hcCeiling} = \text{round}(\text{epfCeiling} \times \text{factor})$$

### 1.2 Earnings & Code on Wages (50% Rule)
* Each earned salary component (Basic Pay, DA, Retaining, HRA, Conveyance, Washing, Attire, Special Allowances) is calculated for the days worked:
  $$\text{Component} = \text{round}(\text{Master Salary} \times \text{factor})$$
* **Wage A** (Core Wages): $\text{Basic} + \text{DA} + \text{Retaining}$
* **Wage B** (Allowances): $\text{HRA} + \text{Conveyance} + \text{Washing} + \text{Attire} + \text{Special Allowances}$
* **Wage D** (Code on Wages 8.8 excess):
  $$\text{If } \text{Wage B} > 50\% \text{ of Gross} \implies \text{Wage D} = \text{round}(\text{Wage B} - 50\% \text{ of Gross})$$
* **Code Wages (`codeWage`)**:
  $$\text{codeWage} = \text{Wage A} + \text{Wage D}$$

---

## 2. Normal Conditions (`enableHigherContribution = false`)

In normal compliance mode, Provident Fund contributions are strictly subject to the statutory wage ceiling (₹15,000), prorated for days worked.

### 2.1 Formula
$$\text{basePFWage} = \min(\text{pfStandardBasisWage}, \text{hcCeiling})$$

* Under **Labour Code** basis: $\text{pfStandardBasisWage} = \text{codeWage}$
* Under **Original Wages** basis: $\text{pfStandardBasisWage} = \text{sum of configured PF wage components}$

### 2.2 Rules
1. **Wages Exceed Ceiling**: If the basis wage exceeds the prorated ceiling (₹15,000 for a full month), the PF wage is **capped at the ceiling**.
2. **Wages Below Ceiling**: If the basis wage is less than the prorated ceiling, the PF wage equals the **basis wage**.

### 2.3 Examples (Normal Conditions)

| Employee Scenario | Gross | Basic Pay | Days Worked / Month | Prorated Ceiling | PF Wage Base | EE PF (12%) | ER Total (12%) | EPS (8.33%) | EPF (3.67%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ex 1: Standard Above Ceiling** | ₹40,000 | ₹20,000 | 31 / 31 (Aug) | ₹15,000 | **₹15,000** | ₹1,800 | ₹1,800 | ₹1,250 | ₹550 |
| **Ex 2: Prorated Ceiling (29 Days)**| ₹38,000 | ₹18,710 | 29 / 31 (Aug) | ₹14,032 | **₹14,032** | ₹1,684 | ₹1,684 | ₹1,169 | ₹515 |
| **Ex 3: Low Wage (Below Ceiling)** | ₹12,000 | ₹10,000 | 30 / 30 (Sep) | ₹15,000 | **₹10,000** | ₹1,200 | ₹1,200 | ₹833 | ₹367 |
| **Ex 4: Low Wage Prorated** | ₹10,000 | ₹8,000 | 20 / 30 (Sep) | ₹10,000 | **₹5,333** | ₹640 | ₹640 | ₹444 | ₹196 |

---

## 3. Higher Contribution Conditions (`enableHigherContribution = true`)

When **Higher Contribution** is enabled, PF is calculated beyond the statutory ceiling on actual selected components, while strictly safeguarding the statutory ceiling floor.

### 3.1 Component Selection (`higherContributionComponents`)
The employer selects which specific salary components constitute the Higher PF wage base (e.g., Basic Pay, DA, Retaining Allowance, etc.):
$$\text{higherWageBase} = \sum (\text{Selected Components prorated for Days Worked})$$

### 3.2 Calculation Logic Engine
```ts
const hcCeiling = Math.round((config.epfCeiling || 15000) * factor);

if (higherWageBase < hcCeiling) {
    let baseVal = higherWageBase;
    if (grossEarnings > hcCeiling) {
        baseVal = hcCeiling;
    }

    if (config.pfEsiCalculationBasis === 'OriginalWages') {
        basePFWage = baseVal;
        isCode88 = false;
    } else {
        const codeBasisCapped = Math.min(codeWage, hcCeiling);
        basePFWage = Math.max(baseVal, codeBasisCapped);
        isCode88 = (basePFWage === codeBasisCapped && wageD > 0);
    }
} else {
    basePFWage = higherWageBase;
    isCode88 = false;
}
```

### 3.3 The 4 Operational Scenarios

#### **Scenario 1: Selected Components $\ge$ Statutory Ceiling (Higher Wages Opted)**
* **Condition**: $\text{higherWageBase} \ge \text{hcCeiling}$
* **Result**: $\text{basePFWage} = \text{higherWageBase}$
* **Example**: Employee with Basic Pay = ₹25,000 (Full Month):
  - $\text{higherWageBase} = 25,000 \ge 15,000$
  - **PF Wage Base** = **₹25,000**
  - **Employee PF (12%)** = **₹3,000**

#### **Scenario 2: Selected Components $<$ Ceiling with High Gross (Employee ID 0043's Case)**
* **Condition**: $\text{higherWageBase} < \text{hcCeiling}$ and $\text{grossEarnings} > \text{hcCeiling}$
* **Data (Employee ID 0043)**:
  - Basic Pay = ₹14,777 *(below ₹15,000)*
  - Gross Earnings = ₹32,741 *(exceeds ₹15,000)*
  - 50% Code Wages = ₹16,371 *(exceeds ₹15,000)*
* **Evaluation**:
  1. Employee did not opt for higher wages on 50% gross.
  2. Selected components are below ceiling, so statutory ceiling floor activates: `baseVal = ₹15,000`.
  3. Under Code on Wages, code wage is capped at the ceiling:
     $$\text{codeBasisCapped} = \min(16371, 15000) = \mathbf{15,000}$$
  4. Final PF Wage Base:
     $$\text{basePFWage} = \max(15000, 15000) = \mathbf{15,000}$$
* **Result**: **PF Wage Base = ₹15,000**, **Employee PF (12%) = ₹1,800** *(strictly capped at ceiling, avoiding inflation to ₹16,371 / ₹1,964)*.

#### **Scenario 3: Proportionate Ceiling for Partial Month**
* **Condition**: Worked fewer days than total days in month (e.g., 29 days in August).
* **Data**: Basic Pay = ₹10,000, Gross = ₹25,000, 29/31 days worked:
  - $\text{hcCeiling} = \text{round}(15000 \times \frac{29}{31}) = \mathbf{14,032}$
  - Selected Basic (prorated) = ₹9,355 (< ₹14,032).
  - Since Gross > ₹14,032, base lifts to prorated ceiling: `baseVal = ₹14,032`.
* **Result**: **PF Wage Base = ₹14,032**, **Employee PF (12%) = ₹1,684**.

#### **Scenario 4: Low Gross Below Statutory Ceiling**
* **Condition**: $\text{grossEarnings} \le \text{hcCeiling}$
* **Result**: PF wages cannot exceed actual earnings; contributions are calculated on actual prorated components.

---

## 4. Applicability Scope (`higherContributionType`)

| Applicability Mode | Employee PF Share | Employer PF / EPS Share |
| :--- | :--- | :--- |
| **By Employee** | Calculated on the **full Higher PF Wage Base** (`basePFWage`) | Capped at **Statutory Ceiling** ($\min(\text{basePFWage}, \text{hcCeiling})$) |
| **By Employee & Employer** | Calculated on the **full Higher PF Wage Base** (`basePFWage`) | Calculated on the **full Higher PF Wage Base** (`basePFWage`) |

---

## 5. Employer Contribution Split (EPF vs. EPS)

### 5.1 Total Employer Liability (12%)
$$\text{Total Employer Liability} = \text{round}(\text{Employer Wage Base} \times 12\%)$$
*(Where Employer Wage Base is `basePFWage` under "By Employee & Employer", or capped at ceiling under "By Employee").*

### 5.2 Pension Scheme Share (EPS - 8.33%)
* **Standard Case**: Capped at Statutory Ceiling:
  $$\text{EPS Employer} = \text{round}(\min(\text{basePFWage}, \text{hcCeiling}) \times 8.33\%)$$
  *(Maximum ₹1,250 for full month, or prorated for partial days).*
* **Higher Pension Opted (Supreme Court Ruling Criteria)**:
  If the employee meets all statutory joint option conditions (pre-2014 member, opted higher pension, higher EPS eligible):
  $$\text{EPS Employer} = \text{round}(\text{basePFWage} \times 8.33\%)$$
* **Age 58+ / Exemption Exclusions**:
  If employee is **$\ge$ 60 years old**, or **58–60 with `WithoutEPS`**, or has **`isEPSEligible = 'No'`**:
  $$\text{EPS Employer} = 0$$
  $$\text{EPF Employer} = \text{Total Employer Liability} \quad (\text{Entire 12\% goes to EPF})$$

### 5.3 Provident Fund Share (EPF Employer - 3.67%)
$$\text{EPF Employer} = \text{Total Employer Liability} - \text{EPS Employer}$$

---

## 6. Comprehensive Comparison Matrix

| Scenario | Basic Pay | Gross Earnings | Days Worked | Compliance Mode | PF Wage Base | EE PF (12%) | ER Total (12%) | ER EPS (8.33%) | ER EPF (3.67%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Normal: Above Ceiling** | ₹25,000 | ₹45,000 | 31 / 31 | Normal | **₹15,000** | ₹1,800 | ₹1,800 | ₹1,250 | ₹550 |
| **Higher: High Basic** | ₹25,000 | ₹45,000 | 31 / 31 | Higher (Both) | **₹25,000** | ₹3,000 | ₹3,000 | ₹1,250 | ₹1,750 |
| **Higher: High Basic (EE Only)** | ₹25,000 | ₹45,000 | 31 / 31 | Higher (EE Only) | **₹25,000** | ₹3,000 | ₹1,800 | ₹1,250 | ₹550 |
| **Emp 0043: Basic < 15k, Gross > 15k** | ₹14,777 | ₹32,741 | 31 / 31 | Higher (Both) | **₹15,000** | ₹1,800 | ₹1,800 | ₹1,250 | ₹550 |
| **Partial Month: 29 Days in Aug** | ₹14,777 | ₹30,628 | 29 / 31 | Higher (Both) | **₹14,032** | ₹1,684 | ₹1,684 | ₹1,169 | ₹515 |
| **Partial Month: Low Basic (10k)** | ₹10,000 | ₹25,000 | 29 / 31 | Higher (Both) | **₹14,032** | ₹1,684 | ₹1,684 | ₹1,169 | ₹515 |
| **Senior (Age $\ge$ 60): High Basic** | ₹25,000 | ₹45,000 | 31 / 31 | Higher (Both) | **₹25,000** | ₹3,000 | ₹3,000 | **₹0** | **₹3,000** |
