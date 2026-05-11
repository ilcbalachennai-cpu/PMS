const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const licenseServicePath = path.join(__dirname, '..', 'services', 'licenseService.ts');

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const licenseService = fs.readFileSync(licenseServicePath, 'utf8');

const pkgVersion = pkg.version;
const versionMatch = licenseService.match(/export const APP_VERSION = "(.*)";/);

if (!versionMatch) {
    console.error('❌ Error: Could not find APP_VERSION in licenseService.ts');
    process.exit(1);
}

const serviceVersion = versionMatch[1];

if (pkgVersion !== serviceVersion) {
    console.error('❌ Version Mismatch Audit Failed!');
    console.error(`   package.json version: ${pkgVersion}`);
    console.error(`   licenseService.ts version: ${serviceVersion}`);
    console.error('   Please make sure both versions match before generating the EXE!');
    process.exit(1);
}

console.log('✅ Version consistency audit passed.');
process.exit(0);
