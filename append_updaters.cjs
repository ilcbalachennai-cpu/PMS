const fs = require('fs');
let c = fs.readFileSync('electron/main.ts', 'utf8');

const updaters = `
// ---------------------------------------------------------
// UPDATER AND DEPLOYMENT IPC HANDLERS
// ---------------------------------------------------------

ipcMain.handle('prepare-for-install', async () => {
    try {
        console.log('--- PREPARE FOR INSTALL START ---');
        // A. Flush and Close Database
        if (db) {
            try { 
                db.pragma('wal_checkpoint(TRUNCATE)'); 
                db.close(); 
                console.log('📦 Database flushed and closed successfully.');
            } catch(e) {
                console.error('Failed to flush database', e);
            }
            db = null;
        }

        // B. Quick Snapshot
        if (appBasePath) {
            try {
                const paths = getAppPaths(appBasePath);
                const snapshotDir = path.join(paths.backups, 'PRE_UPDATE_SNAPSHOT');
                if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });
                const dbFile = path.join(paths.data, 'active_db.sqlite');
                if (fs.existsSync(dbFile)) fs.copyFileSync(dbFile, path.join(snapshotDir, 'active_db_snapshot.sqlite'));
                if (fs.existsSync(CONFIG_PATH)) fs.copyFileSync(CONFIG_PATH, path.join(snapshotDir, 'app-config_snapshot.json'));
                console.log('📦 Pre-update snapshots created successfully.');
            } catch(e) {
                console.warn("Quick snapshot failed, ignoring...", e);
            }
        }
        
        // Wait an extra second to ensure handles are completely freed by the OS
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true };
    } catch(e) {
        return { success: false, error: e?.message };
    }
});

ipcMain.handle('backup-and-install', (_, options) => {
    const isSilent = options?.silent ?? false;
    const username = options?.username || "UnknownUser";
    const userEmail = options?.userEmail || "UnknownEmail";
    const installerPath = getInstallerPath();

    // 1. INSTANT TERMINATION SIGNAL: Destroy windows immediately
    BrowserWindow.getAllWindows().forEach(win => {
        try { win.destroy(); } catch (e) {}
    });

    // 2. DETACHED WORKER
    (async () => {
        try {
            console.log('--- DEFENSIVE RELAUNCHER START ---');
            
            // C. POWER LAUNCH WITH AUDIT WRAPPER
            const psScriptPath = path.join(os.tmpdir(), 'bpp_audit_wrapper.ps1');
            const auditLogPath = path.join(app.getPath('appData'), 'bpp_install_error.log');
            const safeInstallerPath = installerPath.replace(/\\\\/g, '\\\\\\\\');
            const safeLogPath = auditLogPath.replace(/\\\\/g, '\\\\\\\\');

            // Construct PowerShell Script with AES Encryption for the Audit Trail!
            const psScriptContent = [
'$logPath = "' + safeLogPath + '"',
'$timestamp = Get-Date',
'',
'# Collect all logs in an array',
'$logs = @(',
'    "--- BPP Update Audit Log ---",',
'    "Date: $timestamp",',
'    "User: ' + username + '",',
'    "Email: ' + userEmail + '",',
'    "OS: ' + os.type() + ' ' + os.release() + '",',
'    "Starting primary installer..."',
')',
'',
'$proc = Start-Process -FilePath "' + safeInstallerPath + '" ' + (isSilent ? '-ArgumentList "/S"' : '') + ' -PassThru -Wait',
'$exitCode = $proc.ExitCode',
'$logs += "Primary Installer Exit Code: $exitCode"',
'',
'if ($exitCode -eq 0) {',
'    $logs += "Installation Successful!"',
'} else {',
'    $logs += "Installation failed. Attempting Auto-Correction as Administrator..."',
'    try {',
'        $proc2 = Start-Process -FilePath "' + safeInstallerPath + '" ' + (isSilent ? '-ArgumentList "/S"' : '') + ' -Verb RunAs -PassThru -Wait',
'        $fallbackCode = $proc2.ExitCode',
'        $logs += "Fallback Installer Exit Code: $fallbackCode"',
'',
'        if ($fallbackCode -eq 0) {',
'            $logs += "Auto-Correction Successful!"',
'        } else {',
'            $logs += "Auto-Correction Failed! Triggering Developer Handoff..."',
'            $failed = $true',
'        }',
'    } catch {',
'        $logs += "Fallback failed to launch: $_"',
'        $logs += "Auto-Correction Failed! Triggering Developer Handoff..."',
'        $failed = $true',
'    }',
'}',
'',
'# ENCRYPT THE LOG',
'$secret = "BPP_AUDIT_LOG_SECURE_2026"',
'$sha = [System.Security.Cryptography.SHA256]::Create()',
'$key = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($secret))',
'',
'$aes = [System.Security.Cryptography.Aes]::Create()',
'$aes.Key = $key',
'$aes.GenerateIV()',
'$iv = $aes.IV',
'$encryptor = $aes.CreateEncryptor()',
'',
'$logString = $logs -join "[NEWLINE]"',
'$bytes = [System.Text.Encoding]::UTF8.GetBytes($logString.Replace("[NEWLINE]", [char]10))',
'$encrypted = $encryptor.TransformFinalBlock($bytes, 0, $bytes.Length)',
'',
'$ivHex = [System.BitConverter]::ToString($iv).Replace("-", "").ToLower()',
'$encryptedHex = [System.BitConverter]::ToString($encrypted).Replace("-", "").ToLower()',
'$finalString = $ivHex + ":" + $encryptedHex',
'',
'[System.IO.File]::WriteAllText($logPath, $finalString)',
'',
'if ($failed) {',
'    Add-Type -AssemblyName System.Web',
'    $subject = [System.Web.HttpUtility]::UrlEncode("BPP Update Audit Log - Failed")',
'    $body = [System.Web.HttpUtility]::UrlEncode("Updater failed.[NEWLINE][NEWLINE]Please attach the ENCRYPTED log file located at:[NEWLINE]$logPath".Replace("[NEWLINE]", [char]10))',
'    $mailto = "mailto:ilcbala.bharatpayroll@gmail.com?subject=$subject&body=$body"',
'    Start-Process $mailto',
'',
'    Add-Type -AssemblyName PresentationFramework',
'    [System.Windows.MessageBox]::Show("Installation Failed! An email draft has been opened. Please attach the encrypted log file located at $logPath and send it to the developer.", "Update Error", "OK", "Error")',
'}'
].join('\\n');

            fs.writeFileSync(psScriptPath, psScriptContent);

            const { spawn } = require('child_process');
            const psProcess = spawn('powershell.exe', [
                '-ExecutionPolicy', 'Bypass',
                '-WindowStyle', 'Hidden',
                '-File', psScriptPath
            ], {
                detached: true,
                stdio: 'ignore'
            });

            psProcess.unref();

            console.log('--- DEFENSIVE RELAUNCHER DETACHED & APP EXITING ---');
            app.exit(0);

        } catch (error) {
            console.error('Fatal error during update preparation:', error);
            app.exit(1);
        }
    })();
});

ipcMain.handle('start-update-download', async (event, url, expectedHash) => {
    return new Promise((resolve, reject) => {
        try {
            const https = require('https');
            const dest = getInstallerPath();
            const file = fs.createWriteStream(dest);

            const req = https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(\`Server returned \${response.statusCode}: \${response.statusMessage}\`));
                    return;
                }

                const totalBytes = parseInt(response.headers['content-length'], 10);
                let downloadedBytes = 0;

                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    const percent = (downloadedBytes / totalBytes) * 100;
                    if (event.sender && !event.sender.isDestroyed()) {
                        event.sender.send('update-download-progress', { percent, downloadedBytes, totalBytes });
                    }
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve({ success: true, path: dest });
                });
            });

            req.on('error', (err) => {
                fs.unlink(dest, () => {});
                reject(err);
            });
        } catch (error) {
            reject(error);
        }
    });
});
`;

c = c.replace('console.log("-----------------------------------------");\nconsole.log("ELECTRON MAIN PROCESS: HANDLERS READY");', updaters + '\nconsole.log("-----------------------------------------");\nconsole.log("ELECTRON MAIN PROCESS: HANDLERS READY");');

fs.writeFileSync('electron/main.ts', c);
console.log('Successfully appended updaters to main.ts');
