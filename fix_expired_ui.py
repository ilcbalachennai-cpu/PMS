import sys
import re

# 1. Update TrialNoticeModal.tsx
with open('d:/ILCBala/PMS/components/Shared/TrialNoticeModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add isFullLicense prop
if 'isFullLicense?: boolean;' not in content:
    content = content.replace(
        'expiryDate: string;\n  onClose: () => void;',
        'expiryDate: string;\n  isFullLicense?: boolean;\n  onClose: () => void;'
    )

    content = content.replace(
        'const TrialNoticeModal: React.FC<TrialNoticeModalProps> = ({ daysRemaining, expiryDate, onClose }) => {',
        'const TrialNoticeModal: React.FC<TrialNoticeModalProps> = ({ daysRemaining, expiryDate, isFullLicense, onClose }) => {'
    )

    # Change "Trial Version Active"
    content = content.replace(
        '>\n                Trial Version Active\n                </span>',
        '>\n                {isFullLicense ? (daysRemaining <= 0 ? "License Expired" : "License Expiring Soon") : (daysRemaining <= 0 ? "Trial Expired" : "Trial Version Active")}\n                </span>'
    )
    # The previous replace might fail due to whitespace. Let's use regex:
    content = re.sub(
        r'>\s*Trial Version Active\s*</span>',
        '>\n                {isFullLicense ? (daysRemaining <= 0 ? "License Expired" : "License Expiring Soon") : (daysRemaining <= 0 ? "Trial Expired" : "Trial Version Active")}\n                </span>',
        content
    )

    # Change "Your Trial: " or "Trial Expiring in "
    content = re.sub(
        r"isCritical \? 'dYs\" Trial Expiring in ' : isUrgent \? 's,\? Trial Expiring in ' : 'Your Trial: '",
        "isFullLicense ? (isCritical ? '🚨 License Expiring in ' : isUrgent ? '⚠️ License Expiring in ' : 'License Valid for: ') : (isCritical ? '🚨 Trial Expiring in ' : isUrgent ? '⚠️ Trial Expiring in ' : 'Your Trial: ')",
        content
    )
    # Also handle the already replaced text if any
    content = re.sub(
        r"This is a trial version of",
        "{isFullLicense ? 'Your license for' : 'This is a trial version of'}",
        content
    )
    content = re.sub(
        r"To continue uninterrupted, purchase a\s*Licensed Version\.",
        "To continue uninterrupted, please renew or purchase a Licensed Version.",
        content
    )

with open('d:/ILCBala/PMS/components/Shared/TrialNoticeModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# 2. Update App.tsx
with open('d:/ILCBala/PMS/App.tsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

# Pass isFullLicense
app_content = app_content.replace(
    'expiryDate={trialInfo.expiryDate}\n              onClose={() => setShowTrialNotice(false)}',
    'expiryDate={trialInfo.expiryDate}\n              isFullLicense={!licenseInfo?.isTrial}\n              onClose={() => setShowTrialNotice(false)}'
)

# Fix Header text
header_search = '{licenseInfo?.isTrial ? "Trial Valid Upto :" : "License Valid Upto :"}'
header_replace = '{isLicenseExpired ? (licenseInfo?.isTrial ? "Trial Expired On :" : "License Expired On :") : (licenseInfo?.isTrial ? "Trial Valid Upto :" : "License Valid Upto :")}'
app_content = app_content.replace(header_search, header_replace)

# Block rendering of specific views
blocker_ui = '''<div className="flex-1 flex flex-col items-center justify-center text-rose-500 bg-slate-950 p-10 text-center"><AlertTriangle size={64} className="mb-6 opacity-80" /><h2 className="text-3xl font-black uppercase tracking-widest mb-2">Access Denied</h2><p className="text-slate-400 max-w-md">Your license has expired. Data entry and processing are locked. You can only generate previously confirmed reports.</p></div>'''

views_to_block = ['EmployeeList', 'PayProcess', 'Utilities', 'AIAssistant']
for view in views_to_block:
    if view == 'EmployeeList':
        app_content = re.sub(
            r'\{activeView === View\.Employees && <EmployeeList.*?/>\}',
            f'{{activeView === View.Employees && (isLicenseExpired ? {blocker_ui} : <EmployeeList employees={{employees}} setEmployees={{setEmployees}} onAddEmployee={{handleAddEmployee}} onBulkAddEmployees={{handleBulkAddEmployees}} designations={{designations}} divisions={{divisions}} branches={{branches}} sites={{sites}} currentUser={{effectiveUser}} companyProfile={{companyProfile}} dataSizeLimit={{dataSizeLimit}} showAlert={{showAlert}} globalMonth={{globalMonth}} globalYear={{globalYear}} activeFinancialYear={{activeFinancialYear}} />)}}',
            app_content
        )
    elif view == 'PayProcess':
        app_content = re.sub(
            r'\{activeView === View\.PayProcess && <PayProcess.*?/>\}',
            f'{{activeView === View.PayProcess && (isLicenseExpired ? {blocker_ui} : <PayProcess employees={{employees}} setEmployees={{setEmployees}} config={{config}} companyProfile={{companyProfile}} attendances={{attendances}} setAttendances={{setAttendances}} leaveLedgers={{leaveLedgers}} setLeaveLedgers={{setLeaveLedgers}} advanceLedgers={{advanceLedgers}} setAdvanceLedgers={{setAdvanceLedgers}} savedRecords={{payrollHistory}} setSavedRecords={{setPayrollHistory}} leavePolicy={{leavePolicy}} month={{globalMonth}} setMonth={{setGlobalMonth}} year={{globalYear}} setYear={{setGlobalYear}} currentUser={{effectiveUser}} fines={{fines}} setFines={{setFines}} arrearHistory={{arrearHistory}} setArrearHistory={{setArrearHistory}} otRecords={{otRecords}} setOTRecords={{setOTRecords}} showAlert={{showAlert}} onNavigate={{safeNavigate}} setSettingsTab={{setSettingsTab}} licenseInfo={{licenseInfo || undefined}} hasPreviousYearData={{hasPreviousYearData}} activeFinancialYear={{activeFinancialYear}} />)}}',
            app_content
        )

with open('d:/ILCBala/PMS/App.tsx', 'w', encoding='utf-8') as f:
    f.write(app_content)

print("Update completed.")
