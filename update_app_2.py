import sys
import re

with open('D:/ILCBala/PMS/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Expired Message (line ~1417)
expired_search = """          showAlert('warning', 'License Expired', `Your license expired on ${licenseInfo?.expiryDate || 'an earlier date'}. Data entry and processing are locked. Only report generation is available.`);"""
expired_replace = """          showAlert('warning', 'License Expired', `Your license expired on ${formatExpiryDate(licenseInfo?.expiryDate) || 'an earlier date'}. Data entry and processing are locked. Only report generation is available. Please contact ilcbala.bharatpayroll@gmail.com to renew your license.`);"""
if expired_search in content:
    content = content.replace(expired_search, expired_replace)
    print('Updated Expired Message')
else:
    print('Failed to find Expired Message logic')

# 2. Add 10-day Warning logic in handleAuthLogin
# Currently we have:
trial_notice_search = """    // Daily Trial Notice
    const license = getStoredLicense();
    if (license?.isTrial) {"""

trial_notice_replace = """    // Daily Trial/Expiry Notice
    const license = getStoredLicense();
    if (license) {"""

if trial_notice_search in content:
    content = content.replace(trial_notice_search, trial_notice_replace)
    print('Updated Daily Notice Logic')
else:
    print('Failed to find Daily Notice logic')

# Also change the trial info logic to check daysLeft for Full License
trial_info_search = """          setTrialInfo({
            daysRemaining: daysLeft,
            expiryDate: formatExpiryDate(expiry)
          });
          setShowTrialNotice(true);
          localStorage.setItem('trial_notice_shown_date', today);"""

trial_info_replace = """          // Show for Trial or if Full License has <= 10 days left
          if (license.isTrial || daysLeft <= 10) {
            setTrialInfo({
              daysRemaining: daysLeft,
              expiryDate: formatExpiryDate(expiry)
            });
            setShowTrialNotice(true);
            localStorage.setItem('trial_notice_shown_date', today);
          }"""

if trial_info_search in content:
    content = content.replace(trial_info_search, trial_info_replace)
    print('Updated Trial Info Show Logic')
else:
    print('Failed to find Trial Info Show Logic')


# 3. Update the UI Header (LICENSE VALID UPTO)
header_search = """                          {licenseInfo?.expiryDate && (
                            <span className="text-[9px] font-black text-[#FFD700] uppercase tracking-tighter">
                              {licenseInfo.expiryDate}
                            </span>
                          )}"""

header_replace = """                          {licenseInfo?.expiryDate && (
                            <span className="text-[9px] font-black text-[#FFD700] uppercase tracking-tighter">
                              {formatExpiryDate(licenseInfo.expiryDate)}
                            </span>
                          )}"""

if header_search in content:
    content = content.replace(header_search, header_replace)
    print('Updated UI Header')
else:
    print('Failed to find UI Header logic')

with open('D:/ILCBala/PMS/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
