const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Developer PIN used for encryption
const ENCRYPTION_KEY = 'bpp_dev_473748';

function decryptLogFile(inputPath) {
    if (!fs.existsSync(inputPath)) {
        console.error(`Error: File not found -> ${inputPath}`);
        process.exit(1);
    }

    try {
        console.log(`Reading encrypted log file: ${inputPath}...`);
        const encryptedData = fs.readFileSync(inputPath, 'utf8');

        console.log('Decrypting contents...');
        const derivedKey = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const iv = Buffer.alloc(16, 0);
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
        
        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        const outputPath = inputPath.replace('.bpplog', '.json');
        
        // Pretty print if it's valid JSON
        try {
            const jsonObj = JSON.parse(decrypted);
            fs.writeFileSync(outputPath, JSON.stringify(jsonObj, null, 2), 'utf8');
        } catch (jsonErr) {
            // Fallback if not pure JSON
            fs.writeFileSync(outputPath, decrypted, 'utf8');
        }

        console.log(`\nSuccess! Decrypted diagnostic log saved to:\n-> ${outputPath}`);
        console.log(`\nYou can now open ${path.basename(outputPath)} in VS Code to analyze the data.`);

    } catch (error) {
        console.error('\nDecryption failed! The file might be corrupted or not a valid BPP diagnostic log.');
        console.error('Error Details:', error.message);
    }
}

// Check for command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log(`
===================================================
  BPP Diagnostic Log Decryptor Tool (Developer)
===================================================

Usage:
  node decrypt_log.cjs <path_to_bpplog_file>

Example:
  node decrypt_log.cjs BPP_Diagnostics_1715423000.bpplog
`);
} else {
    decryptLogFile(path.resolve(args[0]));
}
