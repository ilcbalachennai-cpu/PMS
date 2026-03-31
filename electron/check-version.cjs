const fs = require('fs');
const path = require('path');

function checkElectronVersion() {
    console.log('🔍 Checking Electron Environment...');
    
    try {
        const electronPackagePath = path.join(__dirname, '../node_modules/electron/package.json');
        if (!fs.existsSync(electronPackagePath)) {
            console.warn('⚠️  Electron not found in node_modules! Please run "npm install".');
            return;
        }

        const pkg = JSON.parse(fs.readFileSync(electronPackagePath, 'utf8'));
        const version = pkg.version;
        const majorVersion = parseInt(version.split('.')[0]);

        if (majorVersion < 30) {
            console.error('❌  LEGACY ELECTRON DETECTED (v' + version + ')');
            console.error('⚠️  Current environment is set for Windows 7. Layouts may be distorted on Windows 10.');
            console.log('🛠️  Attempting auto-restoration for Win10...');
            
            const { execSync } = require('child_process');
            try {
                execSync('npm run build:restore', { stdio: 'inherit' });
                console.log('✅ Restoration complete. Please restart your dev server.');
                process.exit(1);
            } catch (e) {
                console.error('❌ Auto-restoration failed. Please run "npm run build:restore" manually.');
                process.exit(1);
            }
        } else {
            console.log('✅ Electron v' + version + ' detected (Win10 Mode).');
        }
    } catch (err) {
        console.warn('⚠️  Version check skipped due to error:', err.message);
    }
}

checkElectronVersion();
