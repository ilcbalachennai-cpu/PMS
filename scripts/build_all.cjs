const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Unified Build Runner for BPP_APP
 * Usage: 
 *   npm run generate:exe Both
 *   npm run generate:exe CreateWin10
 */

const arg = process.argv[2] ? process.argv[2].toLowerCase() : '';

function run(command) {
    console.log(`\n🚀 Executing: ${command}`);
    try {
        execSync(command, { stdio: 'inherit' });
    } catch (err) {
        console.error(`\n❌ Error executing ${command}`);
        process.exit(1);
    }
}

function clearWinUnpacked() {
    const unpackedPath = path.join(__dirname, '..', 'release', 'win-unpacked');
    console.log(`\n🧹 Cleaning up ${unpackedPath} to prevent file locks...`);
    try {
        if (fs.existsSync(unpackedPath)) {
            // Using powershell to forcefully remove the directory to avoid node-level EBUSY
            execSync(`powershell -Command "Remove-Item -Path '${unpackedPath}' -Recurse -Force -ErrorAction SilentlyContinue"`, { stdio: 'ignore' });
        }
    } catch (e) {
        console.warn('⚠️ Warning: Could not fully clear win-unpacked directory, continuing anyway.');
    }
}

console.log('--- BPP Unified Build System ---');

if (arg === 'both') {
    console.log('📝 Mode: Generating BOTH Windows 10 and Windows 7 executables sequentially...');
    
    // 1. Build Windows 10
    console.log('\n--- PHASE 1: WINDOWS 10 BUILD ---');
    run('npm run build:win10');
    
    // 2. Prevent EBUSY errors
    clearWinUnpacked();
    
    // 3. Build Windows 7
    console.log('\n--- PHASE 2: WINDOWS 7 BUILD ---');
    run('npm run build:win7');
    
} else if (arg === 'createwin10') {
    console.log('📝 Mode: Generating ONLY Windows 10 executable...');
    run('npm run build:win10');
} else {
    console.log('\n⚠️  Invalid or missing argument!');
    console.log('Usage:');
    console.log('  npm run generate:exe Both        -> Create Win10 & Win7 EXEs');
    console.log('  npm run generate:exe CreateWin10 -> Create Win10 EXE only');
    process.exit(1);
}

console.log('\n✅ Build Process Complete!');
console.log('📁 Check the "release" folder for your executables.');
