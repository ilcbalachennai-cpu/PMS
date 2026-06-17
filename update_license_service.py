import sys

with open('D:/ILCBala/PMS/services/licenseService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = '''  // 1. OFFLINE ENFORCEMENT (Strict)
  if (stored) {
    if (isExpiredOffline(stored.expiryDate)) {
      return { valid: false, message: 'LICENSE EXPIRED', data: { isExpired: true } };
    }'''

new_logic = '''  // 1. OFFLINE ENFORCEMENT (Strict)
  if (stored) {
    if (isExpiredOffline(stored.expiryDate)) {
      // Changed: Return valid: true to allow read-only reports generation
      return { valid: true, message: 'LICENSE EXPIRED', data: { ...stored, isExpired: true, status: stored.isTrial ? 'TRIAL_EXPIRED' : 'LICENSE_EXPIRED' } };
    }'''

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open('D:/ILCBala/PMS/services/licenseService.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated licenseService.ts successfully.")
else:
    print("old_logic not found in licenseService.ts")
