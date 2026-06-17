import sys

with open('D:/ILCBala/PMS/BPP_GAS_Script_V06.01.02.txt', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. handleStartupValidation (TRIAL ACTIVE)
old_1 = """                                    status: expired ? 'TRIAL_EXPIRED' : 'TRIAL ACTIVE',
                                    dataSize: parseInt(row[8]) || 50, 
                                    companyLimit: 1,"""
new_1 = """                                    status: expired ? 'TRIAL_EXPIRED' : 'TRIAL ACTIVE',
                                    dataSize: parseInt(row[8]) || 50, 
                                    splDynamic: row[14] !== undefined && row[14] !== '' ? (String(row[14]).trim() === 'Yes' || String(row[14]).trim() === 'true') : true,
                                    splMIS: row[15] !== undefined && row[15] !== '' ? (String(row[15]).trim() === 'Yes' || String(row[15]).trim() === 'true') : true,
                                    companyLimit: parseInt(row[16]) || 2,"""
content = content.replace(old_1, new_1)

# 2. handleStartupValidation (IDENTITY_RESTORE_REQUIRED)
old_2 = """                                    dataSize: 50,
                                    companyLimit: 1,
                                    startDate: row[6],
                                    expiryDate: row[7]"""
new_2 = """                                    dataSize: parseInt(row[8]) || 50,
                                    splDynamic: row[14] !== undefined && row[14] !== '' ? (String(row[14]).trim() === 'Yes' || String(row[14]).trim() === 'true') : true,
                                    splMIS: row[15] !== undefined && row[15] !== '' ? (String(row[15]).trim() === 'Yes' || String(row[15]).trim() === 'true') : true,
                                    companyLimit: parseInt(row[16]) || 2,
                                    startDate: row[6],
                                    expiryDate: row[7]"""
content = content.replace(old_2, new_2)

# 3. handleTrialRegistration (TRIAL ACTIVE)
old_3 = """                return jsonResponse({ 
                    success: true, 
                    data: { status: 'TRIAL ACTIVE', expiryDate: finalEndDate, password: finalPass } 
                });"""
new_3 = """                return jsonResponse({ 
                    success: true, 
                    data: { 
                        status: 'TRIAL ACTIVE', 
                        expiryDate: finalEndDate, 
                        password: finalPass,
                        dataSize: parseInt(data[i][8]) || 50,
                        splDynamic: data[i][14] !== undefined && data[i][14] !== '' ? (String(data[i][14]).trim() === 'Yes' || String(data[i][14]).trim() === 'true') : true,
                        splMIS: data[i][15] !== undefined && data[i][15] !== '' ? (String(data[i][15]).trim() === 'Yes' || String(data[i][15]).trim() === 'true') : true,
                        companyLimit: parseInt(data[i][16]) || 2
                    } 
                });"""
content = content.replace(old_3, new_3)

# 4. handleVerifyRestoreOTP (isTrial fallback logic)
old_4 = """                    dataSize: isTrial ? data[i][8] : data[i][10],
                    companyLimit: isTrial ? 1 : (parseInt(data[i][16]) || 1)"""
new_4 = """                    dataSize: isTrial ? (parseInt(data[i][8]) || 50) : data[i][10],
                    splDynamic: isTrial ? (data[i][14] !== undefined && data[i][14] !== '' ? (String(data[i][14]).trim() === 'Yes' || String(data[i][14]).trim() === 'true') : true) : (String(data[i][14]).trim() === 'Yes' || String(data[i][14]).trim() === 'true'),
                    splMIS: isTrial ? (data[i][15] !== undefined && data[i][15] !== '' ? (String(data[i][15]).trim() === 'Yes' || String(data[i][15]).trim() === 'true') : true) : (String(data[i][15]).trim() === 'Yes' || String(data[i][15]).trim() === 'true'),
                    companyLimit: isTrial ? (parseInt(data[i][16]) || 2) : (parseInt(data[i][16]) || 1)"""
content = content.replace(old_4, new_4)

with open('D:/ILCBala/PMS/BPP_GAS_Script_V06.01.02_TRIAL.txt', 'w', encoding='utf-8') as f:
    f.write(content)

print('File updated successfully.')
