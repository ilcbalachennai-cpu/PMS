const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const AUDIT_SECRET = 'BPP_AUDIT_LOG_SECURE_2026';

if (process.argv.length < 3) {
    console.error("Usage: node decrypt_audit.js <path-to-audit.log>");
    process.exit(1);
}

const logPath = process.argv[2];
if (!fs.existsSync(logPath)) {
    console.error("File not found:", logPath);
    process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);

console.log(`\n--- DECRYPTING AUDIT LOG (${lines.length} entries) ---\n`);

lines.forEach((line, idx) => {
    try {
        const parts = line.split(':');
        if (parts.length < 2) {
            console.log(`[Line ${idx + 1}] UNENCRYPTED OR CORRUPT: ${line}`);
            return;
        }

        const ivHex = parts[0];
        const encryptedHex = parts.slice(1).join(':');

        const iv = Buffer.from(ivHex, 'hex');
        const key = crypto.createHash('sha256').update(String(AUDIT_SECRET)).digest();
        const cipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        
        let decrypted = cipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += cipher.final('utf8');

        console.log(`[Entry ${idx + 1}] ${decrypted}`);
    } catch (e) {
        console.error(`[Line ${idx + 1}] ERROR DECRYPTING: ${e.message}`);
    }
});

console.log("\n--- END OF LOG ---\n");
