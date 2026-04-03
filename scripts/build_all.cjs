const { execSync } = require('child_process');

/**
 * Unified Build Runner for BPP_APP_V02.02.07
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

console.log('--- BPP Unified Build System (v02.02.07) ---');

if (arg === 'both') {
    console.log('📝 Mode: Generating BOTH Windows 10 and Windows 7 executables...');
    run('npm run build:all');
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
