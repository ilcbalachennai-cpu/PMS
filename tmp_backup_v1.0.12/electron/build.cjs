const fs = require('fs');
const path = require('path');
const bytenode = require('bytenode');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { execSync } = require('child_process');

async function build() {
    console.log('--- Building Protected Electron Main Process ---');

    // 1. Compile TS to JS
    console.log('Step 1: Compiling TypeScript...');
    try {
        execSync('npx tsc -p electron/tsconfig.json', { stdio: 'inherit' });
    } catch (err) {
        console.error('TSC Compilation failed');
        process.exit(1);
    }

    const distPath = path.join(__dirname, '../dist-electron');
    const mainJsPath = path.join(distPath, 'main.js');
    const mainJscPath = path.join(distPath, 'main.jsc');

    if (!fs.existsSync(mainJsPath)) {
        console.error('dist-electron/main.js not found!');
        process.exit(1);
    }

    // 2. Obfuscate the JS
    console.log('Step 2: Obfuscating JavaScript...');
    const sourceCode = fs.readFileSync(mainJsPath, 'utf8');
    const obfuscationResult = JavaScriptObfuscator.obfuscate(sourceCode, {
        compact: true,
        controlFlowFlattening: false,
        controlFlowFlatteningThreshold: 0,
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: true,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: true,
        renameGlobals: false,
        selfDefending: false,
        simplify: true,
        splitStrings: false,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        transformObjectKeys: false,
        unicodeEscapeSequence: false
    });
    fs.writeFileSync(mainJsPath, obfuscationResult.getObfuscatedCode());

    // 2.1 Obfuscate Preload
    const preloadJsPath = path.join(distPath, 'preload.js');
    if (fs.existsSync(preloadJsPath)) {
        console.log('Step 2.1: Obfuscating Preload JavaScript...');
        const preloadSource = fs.readFileSync(preloadJsPath, 'utf8');
        const preloadObfuscationResult = JavaScriptObfuscator.obfuscate(preloadSource, {
            compact: true,
            controlFlowFlattening: true,
            debugProtection: true,
            identifierNamesGenerator: 'hexadecimal',
            stringArray: true,
            stringArrayEncoding: ['base64']
        });
        fs.writeFileSync(preloadJsPath, preloadObfuscationResult.getObfuscatedCode());
    }

    // 3. Compile to Bytecode (Bytenode) using exact Electron version
    console.log('Step 3: Compiling to V8 Bytecode (using Electron)...');
    try {
        const electronPath = require('electron');
        const bytenodeCliPath = require.resolve('bytenode/lib/cli.js');

        execSync(`"${electronPath}" "${bytenodeCliPath}" --compile "${mainJsPath}"`, {
            stdio: 'inherit',
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
        });

        // After successful compilation, main.jsc is generated right next to main.js.
    } catch (err) {
        console.error('Bytenode compilation via Electron failed', err);
        process.exit(1);
    }

    // 4. Create Bootstrap Loader
    console.log('Step 4: Creating Bootstrap Loader...');
    const bootstrapCode = `
require('bytenode');
require('./main.jsc');
    `.trim();
    fs.writeFileSync(mainJsPath, bootstrapCode);

    // 5. Ensure dist-electron/package.json exists
    if (!fs.existsSync(distPath)) fs.mkdirSync(distPath);
    fs.writeFileSync(path.join(distPath, 'package.json'), JSON.stringify({ type: 'commonjs' }));

    console.log('--- Protection Complete! ---');
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
