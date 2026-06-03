const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const AUDIT_SECRET = 'BPP_AUDIT_LOG_SECURE_2026';
const auditLogPath = path.join(__dirname, 'test_audit.log');

const eventsToLog = [
    { type: 'IDENTITY_SYNC_FAILED', message: 'Identity mismatch detected during activation sync', metadata: { userID: 'admin', email: 'user@example.com', mobile: '9876543210' } },
    { type: 'FIDELITY_MISMATCH', message: 'Fidelity check failed during activation', metadata: { cloudData: { email: 'user@example.com', mobile: '9876543210' }, typedData: { email: 'usrr@example.com', mobile: '9876543210' } } }
];

// Clean up old log if it exists
if (fs.existsSync(auditLogPath)) {
    fs.unlinkSync(auditLogPath);
}

console.log("--- ENCRYPTING MOCK LOGS ---");
eventsToLog.forEach(event => {
    const timestamp = new Date().toISOString();
    const rawLogEntry = `[${timestamp}] [${event.type}] ${event.message} ${event.metadata ? JSON.stringify(event.metadata) : ''}`;
    
    // Encrypt exactly as main.ts does
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(String(AUDIT_SECRET)).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(rawLogEntry, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const finalLogEntry = `${iv.toString('hex')}:${encrypted}\n`;
    fs.appendFileSync(auditLogPath, finalLogEntry, 'utf8');
    console.log(`Encrypted: ${finalLogEntry.trim().substring(0, 50)}... (hidden)`);
});
console.log("Mock log generated at: test_audit.log\n");
