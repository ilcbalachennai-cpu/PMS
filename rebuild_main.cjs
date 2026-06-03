const fs = require('fs');
let c = fs.readFileSync('electron/main.ts', 'utf8');

// Fix 1: Company Name Check in restore-sqlite-backup
const oldRestore = `        const activeId = arg.activeSiloId;

        let backupProfileRow = rows.find(r => r.key === 'app_company_profile');
        if (activeId && activeId !== 'default') {
            backupProfileRow = rows.find(r => r.key.startsWith('app_company_profile_') && r.key.includes(activeId));
        }

        if (backupProfileRow) {
            try {
                const backupProfile = JSON.parse(backupProfileRow.value);
                const backupName = backupProfile.establishmentName;
                
                const activeProfileRow = db.prepare('SELECT value FROM store WHERE key = ?').get('company_profile') as { value: string } | undefined;
                if (activeProfileRow) {
                    const activeProfile = JSON.parse(activeProfileRow.value);
                    const activeName = activeProfile.establishmentName;
                    
                    if (backupName && activeName && backupName !== activeName) {
                        sourceDb.close();
                        fs.unlinkSync(tempRestorePath);
                        return { success: false, error: \`Data restoration failed due to conflict in Company Name. Backup belongs to '\${backupName}', but active company is '\${activeName}'.\` };
                    }
                }
            } catch (e) {
                console.warn("Could not parse company profile for safety check", e);
            }
        }`;

const newRestore = `        const activeId = arg.activeSiloId;

        let backupProfileRow = rows.find(r => r.key === 'app_company_profile');
        if (activeId && activeId !== 'default') {
            backupProfileRow = rows.find(r => r.key.startsWith('app_company_profile_') && r.key.includes(activeId));
        }
        if (!backupProfileRow) {
            backupProfileRow = rows.find(r => r.key.startsWith('app_company_profile') || r.key === 'company_profile');
        }

        if (backupProfileRow) {
            try {
                const backupProfile = JSON.parse(backupProfileRow.value);
                const backupName = backupProfile.establishmentName || backupProfile.tradeName;
                
                let activeProfileRow = null;
                if (activeId && activeId !== 'default') {
                    activeProfileRow = db.prepare("SELECT value FROM store WHERE key = ?").get(\`app_company_profile_\${activeId}\`) as { value: string } | undefined;
                }
                if (!activeProfileRow) {
                    activeProfileRow = db.prepare("SELECT value FROM store WHERE key = 'app_company_profile' OR key = 'company_profile'").get() as { value: string } | undefined;
                }
                if (!activeProfileRow) {
                    activeProfileRow = db.prepare("SELECT value FROM store WHERE key LIKE 'app_company_profile%' OR key = 'company_profile'").get() as { value: string } | undefined;
                }

                if (activeProfileRow) {
                    const activeProfile = JSON.parse(activeProfileRow.value);
                    const activeName = activeProfile.establishmentName || activeProfile.tradeName;
                    
                    if (backupName && activeName) {
                        const bNameClean = backupName.trim().toUpperCase();
                        const aNameClean = activeName.trim().toUpperCase();
                        if (bNameClean !== aNameClean) {
                            sourceDb.close();
                            fs.unlinkSync(tempRestorePath);
                            return { success: false, error: \`Data Restoration Failed: Company Name Mismatch. The backup belongs to '\${bNameClean}', but your active importing company is '\${aNameClean}'.\` };
                        }
                    }
                }
            } catch (e) {
                console.warn("Could not parse company profile for safety check", e);
            }
        }`;

c = c.replace(oldRestore, newRestore);

// Fix 2: Delete old keys before restore
const oldMerge = `        // 5. Merge rows into active database, skipping excluded keys
        const upsertStmt = db.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
        
        db.transaction(() => {
            for (const row of rows) {`;

const newMerge = `        // 5. Merge rows into active database, skipping excluded keys
        const deleteStmt = db.prepare(\`DELETE FROM store WHERE key NOT IN (\${excludedKeys.map(() => '?').join(',')})\`);
        const upsertStmt = db.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
        
        db.transaction(() => {
            deleteStmt.run(...excludedKeys);
            for (const row of rows) {`;

c = c.replace(oldMerge, newMerge);

// Fix 3: Dynamic Folder Paths
const oldPaths = `            drives.forEach(drive => {
                potentialRoots.push(path.join(drive, 'BPP_APP'));
                potentialRoots.push(path.join(drive, 'BPP', 'BPP_APP')); // Check subfolder too
            });
        } catch (e) {
            // Fallback if WMIC fails
            ['C:', 'D:', 'E:', 'F:', 'G:', 'H:'].forEach(d => {
                potentialRoots.push(path.join(d, '/', 'BPP_APP'));
            });
        }

        // 2. Add User Home
        potentialRoots.push(path.join(app.getPath('home'), 'BPP_APP'));`;

const newPaths = `            drives.forEach(drive => {
                potentialRoots.push(path.join(drive, 'BPP_APP'));
                potentialRoots.push(path.join(drive, 'BharatPayRoll', 'BPP_APP'));
                potentialRoots.push(path.join(drive, 'BPP', 'BPP_APP')); // Check subfolder too
            });
        } catch (e) {
            // Fallback if WMIC fails
            ['C:', 'D:', 'E:', 'F:', 'G:', 'H:'].forEach(d => {
                potentialRoots.push(path.join(d, '/', 'BPP_APP'));
                potentialRoots.push(path.join(d, '/', 'BharatPayRoll', 'BPP_APP'));
            });
        }

        // 2. Add User Home
        potentialRoots.push(path.join(app.getPath('home'), 'BPP_APP'));
        potentialRoots.push(path.join(app.getPath('home'), 'BharatPayRoll', 'BPP_APP'));`;

c = c.replace(oldPaths, newPaths);

// Fix 4: backup-and-install
const oldBackupInstall = `ipcMain.handle('backup-and-install', (_, options?: { silent?: boolean }) => {
    const isSilent = options?.silent ?? false;
    const installerPath = getInstallerPath();

    // 1. INSTANT TERMINATION SIGNAL: Destroy windows immediately
    BrowserWindow.getAllWindows().forEach(win => {
        try { win.destroy(); } catch (e) {}
    });

    // 2. DETACHED WORKER: Using a Wait-and-Kill strategy to clear locks before installer check
    (async () => {
        try {
            console.log('--- DEFENSIVE RELAUNCHER START ---');
            
            // A. Flush and Close Database
            if (db) {
                try { 
                    db.pragma('wal_checkpoint(TRUNCATE)'); 
                    db.close(); 
                } catch(e) {}
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
                } catch(e) {
                    console.warn("Quick snapshot failed, ignoring...", e);
                }
            }

            // C. POWER LAUNCH WITH AUDIT WRAPPER
            try {
                const exeName = app.isPackaged ? 'BPP_APP.exe' : 'electron.exe';
                const wrapperPath = path.join(os.tmpdir(), 'bpp_audit_wrapper.ps1');
                const logPath = path.join(app.getPath('userData'), 'bpp_install_error.log');
                
                const scriptContent = \`
$logPath = "\${logPath.replace(/\\\\/g, '\\\\\\\\')}"
"--- BPP Update Audit Log ---" | Out-File -FilePath $logPath -Encoding utf8
"Date: $(Get-Date)" | Out-File -FilePath $logPath -Append -Encoding utf8
"Killing \${exeName}..." | Out-File -FilePath $logPath -Append -Encoding utf8
Stop-Process -Name "\${exeName.replace('.exe', '')}" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

"Starting primary installer..." | Out-File -FilePath $logPath -Append -Encoding utf8
$proc = Start-Process -FilePath "\${installerPath.replace(/\\\\/g, '\\\\\\\\')}" \${isSilent ? '-ArgumentList "/S"' : ''} -PassThru -Wait
$exitCode = $proc.ExitCode
"Primary Installer Exit Code: $exitCode" | Out-File -FilePath $logPath -Append -Encoding utf8

if ($exitCode -eq 0) {
    "Installation Successful!" | Out-File -FilePath $logPath -Append -Encoding utf8
    exit 0
}

"Installation failed. Attempting Auto-Correction as Administrator..." | Out-File -FilePath $logPath -Append -Encoding utf8
try {
    $proc2 = Start-Process -FilePath "\${installerPath.replace(/\\\\/g, '\\\\\\\\')}" \${isSilent ? '-ArgumentList "/S"' : ''} -Verb RunAs -PassThru -Wait
    $fallbackCode = $proc2.ExitCode
    "Fallback Installer Exit Code: $fallbackCode" | Out-File -FilePath $logPath -Append -Encoding utf8

    if ($fallbackCode -eq 0) {
        "Auto-Correction Successful!" | Out-File -FilePath $logPath -Append -Encoding utf8
        exit 0
    }
} catch {
    "Fallback failed to launch: $_" | Out-File -FilePath $logPath -Append -Encoding utf8
}

"Auto-Correction Failed! Triggering Developer Handoff..." | Out-File -FilePath $logPath -Append -Encoding utf8
\`;
                fs.writeFileSync(wrapperPath, scriptContent);
                
                spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', wrapperPath], {
                    detached: true,
                    stdio: 'ignore',
                    windowsHide: true
                }).unref();
            } catch(e) {
                console.error("Failed to launch updater", e);
            }

            // 3. HARD EXIT
            app.exit(0);
        } catch(e) {}
    })();

    return { success: true };
});`;

const newBackupInstall = `ipcMain.handle('backup-and-install', (_, options?: { silent?: boolean, username?: string, userEmail?: string }) => {
    const isSilent = options?.silent ?? false;
    const username = options?.username || "UnknownUser";
    const userEmail = options?.userEmail || "UnknownEmail";
    const installerPath = getInstallerPath();

    // 1. INSTANT TERMINATION SIGNAL: Destroy windows immediately
    BrowserWindow.getAllWindows().forEach(win => {
        try { win.destroy(); } catch (e) {}
    });

    // 2. DETACHED WORKER: Using a Wait-and-Kill strategy to clear locks before installer check
    (async () => {
        try {
            console.log('--- DEFENSIVE RELAUNCHER START ---');
            
            // A. Flush and Close Database
            if (db) {
                try { 
                    db.pragma('wal_checkpoint(TRUNCATE)'); 
                    db.close(); 
                } catch(e) {}
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
                } catch(e) {
                    console.warn("Quick snapshot failed, ignoring...", e);
                }
            }

            // C. POWER LAUNCH WITH AUDIT WRAPPER
            try {
                const currentExePath = app.getPath('exe');
                const exeName = require('path').basename(currentExePath);
                const wrapperPath = path.join(os.tmpdir(), 'bpp_audit_wrapper.ps1');
                const logPath = path.join(app.getPath('userData'), 'bpp_install_error.log');
                
                const scriptContent = \`
$logPath = "\${logPath.replace(/\\\\/g, '\\\\\\\\')}"
"--- BPP Update Audit Log ---" | Out-File -FilePath $logPath -Encoding utf8
"Date: $(Get-Date)" | Out-File -FilePath $logPath -Append -Encoding utf8
"User: \${username}" | Out-File -FilePath $logPath -Append -Encoding utf8
"Email: \${userEmail}" | Out-File -FilePath $logPath -Append -Encoding utf8
"OS: \${os.type()} \${os.release()}" | Out-File -FilePath $logPath -Append -Encoding utf8

"Killing \${exeName}..." | Out-File -FilePath $logPath -Append -Encoding utf8
Stop-Process -Name "\${exeName.replace('.exe', '')}" -Force -ErrorAction SilentlyContinue

"Waiting for process locks to release on \${currentExePath.replace(/\\\\/g, '\\\\\\\\')}..." | Out-File -FilePath $logPath -Append -Encoding utf8
$retries = 15
while ($retries -gt 0) {
    try {
        $stream = [System.IO.File]::Open("\${currentExePath.replace(/\\\\/g, '\\\\\\\\')}", 'Open', 'Read', 'None')
        $stream.Close()
        "Lock released successfully." | Out-File -FilePath $logPath -Append -Encoding utf8
        break
    } catch {
        Start-Sleep -Seconds 1
        $retries--
    }
}
if ($retries -eq 0) {
    "Warning: File still appears locked after 15 seconds, proceeding anyway..." | Out-File -FilePath $logPath -Append -Encoding utf8
}

"Starting primary installer..." | Out-File -FilePath $logPath -Append -Encoding utf8
$proc = Start-Process -FilePath "\${installerPath.replace(/\\\\/g, '\\\\\\\\')}" \${isSilent ? '-ArgumentList "/S"' : ''} -PassThru -Wait
$exitCode = $proc.ExitCode
"Primary Installer Exit Code: $exitCode" | Out-File -FilePath $logPath -Append -Encoding utf8

if ($exitCode -eq 0) {
    "Installation Successful!" | Out-File -FilePath $logPath -Append -Encoding utf8
    exit 0
}

"Installation failed. Attempting Auto-Correction as Administrator..." | Out-File -FilePath $logPath -Append -Encoding utf8
try {
    $proc2 = Start-Process -FilePath "\${installerPath.replace(/\\\\/g, '\\\\\\\\')}" \${isSilent ? '-ArgumentList "/S"' : ''} -Verb RunAs -PassThru -Wait
    $fallbackCode = $proc2.ExitCode
    "Fallback Installer Exit Code: $fallbackCode" | Out-File -FilePath $logPath -Append -Encoding utf8

    if ($fallbackCode -eq 0) {
        "Auto-Correction Successful!" | Out-File -FilePath $logPath -Append -Encoding utf8
        exit 0
    }
} catch {
    "Fallback failed to launch: $_" | Out-File -FilePath $logPath -Append -Encoding utf8
}

"Auto-Correction Failed! Triggering Developer Handoff..." | Out-File -FilePath $logPath -Append -Encoding utf8

Add-Type -AssemblyName System.Web
$subject = [System.Web.HttpUtility]::UrlEncode("BPP Update Audit Log - Failed")
$body = [System.Web.HttpUtility]::UrlEncode("Installation failed.\`nUser: \${username}\`nEmail: \${userEmail}\`nOS: \${os.type()} \${os.release()}\`n\`nPlease attach the log file located at:\`n$logPath")
$mailto = "mailto:ilcbala.bharatpayroll@gmail.com?subject=$subject&body=$body"

Start-Process $mailto

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show("Update Failed! An email draft has been opened. Please attach the log file located at $logPath and send it to the developer.", "Update Error", 'OK', 'Error')
\`;
                fs.writeFileSync(wrapperPath, scriptContent);
                
                spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', wrapperPath], {
                    detached: true,
                    stdio: 'ignore',
                    windowsHide: true
                }).unref();
            } catch(e) {
                console.error("Failed to launch updater", e);
            }

            // 3. HARD EXIT
            app.exit(0);
        } catch(e) {}
    })();

    return { success: true };
});`;

c = c.replace(oldBackupInstall, newBackupInstall);

// Fix 5: Update downloading flags
const oldDownload = `ipcMain.handle('start-update-download', async (_, downloadUrl: string, expectedHash?: string) => {
    return new Promise((resolve) => {
        try {
            const dest = getInstallerPath();
            const file = fs.createWriteStream(dest);

            const request = net.request({`;

const newDownload = `let isUpdateDownloading = false;
let closeRequested = false;

ipcMain.handle('start-update-download', async (_, downloadUrl: string, expectedHash?: string) => {
    isUpdateDownloading = true;
    return new Promise((resolve) => {
        try {
            const dest = getInstallerPath();
            const file = fs.createWriteStream(dest);

            const request = net.request({`;

c = c.replace(oldDownload, newDownload);

const oldSuccess = `                    BrowserWindow.getAllWindows().forEach(win => {
                        win.webContents.send('update-download-complete');
                    });
                    console.log(\`✅ Update download finished. Total Bytes: \${fs.statSync(dest).size}\`);
                    resolve({ success: true, path: dest });
                });
                
                response.on('error', (err: any) => {
                    file.end();
                    fs.unlink(dest, () => { });
                    console.error('❌ Update download stream failed:', err);
                    resolve({ success: false, error: err.message });
                });
            });

            request.on('error', (err: any) => {
                file.end();
                fs.unlink(dest, () => { });
                console.error('❌ Update request failed:', err);
                resolve({ success: false, error: err.message });
            });`;

const newSuccess = `                    BrowserWindow.getAllWindows().forEach(win => {
                        win.webContents.send('update-download-complete');
                    });
                    isUpdateDownloading = false;
                    console.log(\`✅ Update download finished. Total Bytes: \${fs.statSync(dest).size}\`);
                    resolve({ success: true, path: dest });
                    if (closeRequested) app.quit();
                });
                
                response.on('error', (err: any) => {
                    file.end();
                    fs.unlink(dest, () => { });
                    console.error('❌ Update download stream failed:', err);
                    isUpdateDownloading = false;
                    resolve({ success: false, error: err.message });
                    if (closeRequested) app.quit();
                });
            });

            request.on('error', (err: any) => {
                file.end();
                fs.unlink(dest, () => { });
                console.error('❌ Update request failed:', err);
                isUpdateDownloading = false;
                resolve({ success: false, error: err.message });
                if (closeRequested) app.quit();
            });`;

c = c.replace(oldSuccess, newSuccess);

const oldHashFail = `                            if (calculatedHash.toLowerCase() !== expectedHash.toLowerCase()) {
                                console.error(\`❌ Security Violation: Hash Mismatch!\\nExpected: \${expectedHash}\\nActual: \${calculatedHash}\`);
                                fs.unlinkSync(dest);
                                resolve({ success: false, error: 'SECURITY_HASH_MISMATCH' });
                                return;
                            }
                        } catch (hashErr: any) {
                            console.error('❌ Hash calculation failed:', hashErr);
                            fs.unlinkSync(dest);
                            resolve({ success: false, error: 'Integrity check failed' });
                            return;
                        }`;

const newHashFail = `                            if (calculatedHash.toLowerCase() !== expectedHash.toLowerCase()) {
                                console.error(\`❌ Security Violation: Hash Mismatch!\\nExpected: \${expectedHash}\\nActual: \${calculatedHash}\`);
                                fs.unlinkSync(dest);
                                isUpdateDownloading = false;
                                resolve({ success: false, error: 'SECURITY_HASH_MISMATCH' });
                                return;
                            }
                        } catch (hashErr: any) {
                            console.error('❌ Hash calculation failed:', hashErr);
                            fs.unlinkSync(dest);
                            isUpdateDownloading = false;
                            resolve({ success: false, error: 'Integrity check failed' });
                            return;
                        }`;
c = c.replace(oldHashFail, newHashFail);

fs.writeFileSync('electron/main.ts', c);
console.log("Successfully rebuilt main.ts from scratch!");
