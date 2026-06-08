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

const win10Script = pkg.scripts['build:win10'] || '';
const win7Script = pkg.scripts['build:win7'] || '';
const expectedArtifactFragment = `BPP_APP_V${pkgVersion}`;

if (!win10Script.includes(expectedArtifactFragment) || !win7Script.includes(expectedArtifactFragment)) {
    console.error('❌ Artifact Name Audit Failed!');
    console.error(`   The build scripts in package.json do not contain the correct artifactName for version ${pkgVersion}.`);
    console.error('   Please manually update the --config.nsis.artifactName in package.json scripts.');
    process.exit(1);
}

// --- Dynamic Baseline Injection ---
const now = new Date();
const pad = (n) => n.toString().padStart(2, '0');
const currentTimestamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

let newLicenseService = licenseService.replace(/export const APP_PATCH_TIMESTAMP = ".*";/, `export const APP_PATCH_TIMESTAMP = "${currentTimestamp}";`);
fs.writeFileSync(licenseServicePath, newLicenseService, 'utf8');
console.log(`✅ Dynamic Baseline injected: ${currentTimestamp}`);

console.log('✅ Version consistency audit passed.');
process.exit(0);
