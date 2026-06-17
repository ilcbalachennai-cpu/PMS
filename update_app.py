import sys
import re

with open('D:/ILCBala/PMS/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the showLicenseGate and isExpired logic
content = re.sub(
    r'const isExpired = licenseStatus\.message === \'LICENSE EXPIRED\' \|\| \(licenseStatus\.data\?\.isExpired\);.*?const showLicenseGate = licenseStatus\.checked && \(isExpired \|\| isTampered \|\| isSyncBlocked\);',
    '''const isLicenseExpired = licenseStatus.message === 'LICENSE EXPIRED' || licenseStatus.data?.isExpired || licenseStatus.data?.status === 'TRIAL_EXPIRED' || licenseStatus.data?.status === 'LICENSE_EXPIRED' || licenseInfo?.status === 'TRIAL_EXPIRED' || licenseInfo?.status === 'LICENSE_EXPIRED';
  const isExpired = false; // Disabled blocking gate for expiry to allow read-only mode
  const isTampered = licenseStatus.message === 'SECURITY VIOLATION' || (licenseStatus.data?.isTampered);
  const isSyncBlocked = licenseStatus.data?.isSyncBlocked;
  const syncMessage = licenseStatus.message;
  const isSyncWarning = !isSyncBlocked && syncMessage?.includes('uninterrupted use');

  const showStartupOverlay = isStartupTimerActive || isAppDirectoryConfigured === null || !licenseStatus.checked;
  const showLicenseGate = licenseStatus.checked && (isTampered || isSyncBlocked);''',
    content,
    flags=re.DOTALL
)

# Now, we also need to disable the navigation links and show an alert upon login
# First, let's update handleAuthLogin:
content = re.sub(
    r'(} else \{\s*setTimeout\(\(\) => \{\s*showAlert\(\'success\', \'System Secured\', `Welcome back, \$\{user\.name \|\| user\.username\}\. Connected to local database successfully\.`, undefined, undefined, \'Proceed\', undefined, undefined, 2\);\s*\}, 500\);\s*\})',
    '''} else {
      setTimeout(() => { 
        if (isLicenseExpired) {
          showAlert('warning', 'License Expired', `Your license expired on ${licenseInfo?.expiryDate || 'an earlier date'}. Data entry and processing are locked. Only report generation is available.`);
        } else {
          showAlert('success', 'System Secured', `Welcome back, ${user.name || user.username}. Connected to local database successfully.`, undefined, undefined, 'Proceed', undefined, undefined, 2); 
        }
      }, 500);
    }''',
    content,
    flags=re.DOTALL
)

# Finally, update the navigation items to be disabled if isLicenseExpired
content = content.replace('disabled={isNavLocked || isCompanyGateOpen}', 'disabled={isNavLocked || isCompanyGateOpen || isLicenseExpired}')
content = content.replace('disabled={isCompanyGateOpen && activeView !== View.Dashboard}', 'disabled={(isCompanyGateOpen && activeView !== View.Dashboard) || isLicenseExpired}')
# BUT we want to allow Reports to be accessed. 
# So we revert Reports and Statutory Reports and SSCode and MIS
content = content.replace('view={View.Reports} icon={FileText} label="Pay Reports" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen || isLicenseExpired}', 'view={View.Reports} icon={FileText} label="Pay Reports" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen}')
content = content.replace('view={View.Statutory} icon={ShieldCheck} label="Statutory Reports" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen || isLicenseExpired}', 'view={View.Statutory} icon={ShieldCheck} label="Statutory Reports" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen}')
content = content.replace('view={View.SSCode} icon={Scale} label="Social Security / Code Wages" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen || isLicenseExpired}', 'view={View.SSCode} icon={Scale} label="Social Security / Code Wages" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen}')
content = content.replace('view={View.MIS} icon={IndianRupee} label="Management Info (MIS)" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen || isLicenseExpired}', 'view={View.MIS} icon={IndianRupee} label="Management Info (MIS)" activeView={activeView} onNavigate={safeNavigate} isSidebarOpen={isSidebarOpen} disabled={isNavLocked || isCompanyGateOpen}')

with open('D:/ILCBala/PMS/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done updating App.tsx')
