import { app, BrowserWindow, ipcMain, dialog, net, shell } from 'electron';
import nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import * as crypto from 'crypto';

import { spawn, execSync } from 'child_process';
import * as os from 'os';

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development';

// ── CONFIGURATION & PERSISTENCE ──
const CONFIG_PATH = path.join(app.getPath('userData'), 'app-config.json');

console.log(`🚀 Electron v${process.versions.electron} | Node ${process.versions.node} | Chrome ${process.versions.chrome}`);
if (parseInt(process.versions.electron.split('.')[0]) < 30) {
    console.warn('⚠️  LEGACY MODE DETECTED: This version is for Windows 7 applications.');
} else {
    console.log('✅ WIN10 MODE DETECTED: Layouts optimized for modern Windows environments.');
}

function getAppConfig() {
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        } catch (e) { return {}; }
    }
    return {};
}

function saveAppConfig(config: any) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

let appConfig = getAppConfig();
let appBasePath = appConfig.appBasePath || '';

// Helper to get structured paths
const getAppPaths = (base: string) => {
    // 🔍 SMART PATH RESOLUTION
    // If the base folder already has 'Data' or 'BharatPP/Data', use it correctly.
    let root = base;
    const directDataPath = path.join(base, 'Data');
    const nestedDataPath = path.join(base, 'BharatPP', 'Data');

    if (fs.existsSync(nestedDataPath)) {
        // Case: User selected the PARENT of BharatPP
        root = path.join(base, 'BharatPP');
    } else if (fs.existsSync(directDataPath)) {
        // Case: User selected the 'BharatPP' folder itself
        root = base;
    } else {
        // Case: New installation or empty folder, default to appending BharatPP
        root = path.join(base, 'BharatPP');
    }

    return {
        root,
        data: path.join(root, 'Data'),
        reports: path.join(root, 'Report files'),
        backups: path.join(root, 'Data backup'),
        templates: path.join(root, 'Templates')
    };
};

// ── DATABASE INITIALIZATION ──
let db: Database.Database | null = null;

function initializeDatabase(basePath: string) {
    const paths = getAppPaths(basePath);
    // Ensure directories exist
    [paths.data, paths.reports, paths.backups, paths.templates].forEach((dir: string) => {
        try {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        } catch (err: any) {
            console.error(`❌ Permission Error: Failed to create directory: ${dir}`, err);
            throw new Error(`Permission Denied: Cannot create folder at ${dir}. Please ensure you have write access.`);
        }
    });

    const DB_PATH = path.join(paths.data, 'active_db.sqlite');
    const snapshotDir = path.join(paths.backups, 'PRE_UPDATE_SNAPSHOT');
    const snapshotDb = path.join(snapshotDir, 'active_db_snapshot.sqlite');

    // ── AUTO-RESTORE LOGIC ──
    // If main DB is missing but snapshot exists, restore it.
    if (!fs.existsSync(DB_PATH) && fs.existsSync(snapshotDb)) {
        try {
            console.log('🔄 Main DB missing. Restoring from pre-update snapshot...');
            fs.copyFileSync(snapshotDb, DB_PATH);
            const configSnapshot = path.join(snapshotDir, 'app-config_snapshot.json');
            if (fs.existsSync(configSnapshot)) {
                fs.copyFileSync(configSnapshot, CONFIG_PATH);
            }
            console.log('✅ Restoration complete.');
        } catch (e) {
            console.error('❌ Auto-restore failed:', e);
        }
    }

    try {
        db = new Database(DB_PATH);
        db.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
    } catch (e) {
        console.error('❌ DB connection failed. Database might be corrupted.', e);
        // If corrupted and snapshot exists, try a hail-mary restore
        if (fs.existsSync(snapshotDb)) {
            try {
                if (db) db.close();
                fs.copyFileSync(snapshotDb, DB_PATH);
                db = new Database(DB_PATH);
                console.log('🛠️ Corrupted DB replaced with snapshot.');
            } catch (restoreErr) {
                console.error('❌ Hail-mary restore failed.', restoreErr);
            }
        }
    }
}

// Deferring DB initialization to app.whenReady() for Ultra-Fast Startup.

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        backgroundColor: '#020617', // Match Slate-950/Slate-900 to prevent white flash on load
        icon: path.join(__dirname, '../build/icon.png'),
        webPreferences: {
            preload: path.isAbsolute(path.join(__dirname, 'preload.js'))
                ? path.join(__dirname, 'preload.js')
                : path.resolve(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        autoHideMenuBar: true,
        show: false, // Don't show until ready-to-show
    });

    mainWindow.once('ready-to-show', () => {
        if (mainWindow) mainWindow.show();
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ── SINGLE INSTANCE LOCK ──────────────────────────────────────────────────
// Prevent multiple instances of BPP_APP from running simultaneously in production.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock && !isDev) {
  // A second instance tried to launch — show a warning and quit.
  dialog.showErrorBox(
    '⚠  BharatPay Pro — Already Running',
    'BharatPay Pro is already open on this machine.\n\n' +
    'Only one session is allowed at a time.\n\n' +
    'Please switch to the existing window.\n' +
    'If the app is unresponsive, close it from the Windows Taskbar and try again.'
  );
  app.quit();
} else {
  // If a second instance attempts while we are the primary, focus our window (only in prod).
  app.on('second-instance', () => {
    if (mainWindow && !isDev) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
// ─────────────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
    // ── ULTRA-FAST STARTUP (V02.02.26) ──
    // 1. Create window immediately for perception of speed
    createWindow();

    // 2. Initializing database and cleanup in background
    if (appBasePath) {
        try {
            initializeDatabase(appBasePath);
        } catch (e) {
            console.error("Failed to initialize database at stored path:", e);
            appBasePath = '';
        }
    }
    
    cleanupOldInstallers();
});

app.on('window-all-closed', () => {
    console.error("EVENT 'window-all-closed' WAS FIRED. STACK TRACE:");
    console.trace();
    if (process.platform !== 'darwin') app.quit();
});

// ── IPC HANDLERS ──

// 1. Directory Setup
ipcMain.handle('select-app-directory', async () => {
    if (!mainWindow) return { success: false, error: 'No main window' };
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Application Storage Location'
    });

    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
    }

    return { success: true, path: result.filePaths[0] };
});

ipcMain.handle('initialize-app-directory', async (_, selectedPath: string) => {
    try {
        initializeDatabase(selectedPath);
        appBasePath = selectedPath;
        saveAppConfig({ ...getAppConfig(), appBasePath });
        return { success: true };
    } catch (e: any) {
        console.error('Failed to initialize app directory:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('get-app-directory', async () => {
    return appBasePath || null;
});

// 2. Report Saving
ipcMain.handle('save-report', async (_, { fileName, data, type }) => {
    try {
        console.log(`[IPC] save-report requested: ${fileName}.${type}`);

        if (!appBasePath) {
            console.error('[IPC] appBasePath is missing. App storage not initialized.');
            throw new Error("App storage not initialized. Please select a storage location.");
        }

        const paths = getAppPaths(appBasePath);

        // Ensure the reports directory exists
        if (!fs.existsSync(paths.reports)) {
            console.log(`[IPC] Creating missing reports directory: ${paths.reports}`);
            fs.mkdirSync(paths.reports, { recursive: true });
        }

        const filePath = path.resolve(paths.reports, `${fileName}.${type}`);
        console.log(`[IPC] Saving file to: ${filePath}`);

        // Write the file
        const buffer = Buffer.from(data);
        fs.writeFileSync(filePath, new Uint8Array(buffer));
        console.log(`[IPC] File written successfully. Size: ${buffer.length} bytes`);

        return { success: true, path: filePath };
    } catch (e: any) {
        console.error('[IPC] Save report failed:', e);
        return { success: false, error: e.message };
    }
});
// 2b. Template Saving (routes to BharatPP/Templates instead of Report files)
ipcMain.handle('save-template', async (_, { fileName, data, type }) => {
    try {
        console.log(`[IPC] save-template requested: ${fileName}.${type}`);

        if (!appBasePath) throw new Error("App storage not initialized.");

        const paths = getAppPaths(appBasePath);

        if (!fs.existsSync(paths.templates)) {
            fs.mkdirSync(paths.templates, { recursive: true });
        }

        const filePath = path.resolve(paths.templates, `${fileName}.${type}`);
        console.log(`[IPC] Saving template to: ${filePath}`);

        const buffer = Buffer.from(data);
        fs.writeFileSync(filePath, new Uint8Array(buffer));
        console.log(`[IPC] Template written successfully. Size: ${buffer.length} bytes`);

        return { success: true, path: filePath };
    } catch (e: any) {
        console.error('[IPC] Save template failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('open-item-location', async (_, filePath: string) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            console.log(`[IPC] Opening location for item: ${filePath}`);
            shell.showItemInFolder(filePath);
            return { success: true };
        }
        return { success: false, error: 'File not found' };
    } catch (e: any) {
        console.error('[IPC] Open item location failed:', e);
        return { success: false, error: e.message };
    }
});

// 2c. Open File Path (directly open the file)
ipcMain.handle('open-item-path', async (_, filePath: string) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            console.log(`[IPC] Opening file path directly: ${filePath}`);
            await shell.openPath(filePath);
            return { success: true };
        }
        return { success: false, error: 'File not found' };
    } catch (e: any) {
        console.error('[IPC] Open item path failed:', e);
        return { success: false, error: e.message };
    }
});

// 2d. Dedicated Open User Manual Handler
ipcMain.handle('open-user-manual', async () => {
    try {
        console.log(`[IPC] Received open-user-manual request`);
        
        const isDev = !app.isPackaged;
        const appRoot = isDev ? process.cwd() : app.getAppPath();
        const manualPath = path.join(appRoot, 'docs', 'user_manual.html');

        console.log(`[IPC] Resolved source manual path: ${manualPath}`);
        
        if (fs.existsSync(manualPath)) {
            if (isDev) {
                await shell.openPath(manualPath);
                return { success: true };
            } else {
                // In production, extract to temp to bypass asar shell restrictions
                const tempDir = app.getPath('temp');
                const tempManualPath = path.join(tempDir, 'BPP_User_Manual.html');
                
                const content = fs.readFileSync(manualPath);
                fs.writeFileSync(tempManualPath, content as any);
                
                console.log(`[IPC] Extracted manual to temp: ${tempManualPath}`);
                await shell.openPath(tempManualPath);
                return { success: true };
            }
        } 
        
        // Fallback Strategy
        const altPath = path.resolve(__dirname, '..', 'docs', 'user_manual.html');
        if (fs.existsSync(altPath)) {
            await shell.openPath(altPath);
            return { success: true };
        }

        throw new Error(`User manual not found. Please ensure 'docs/user_manual.html' exists.`);
    } catch (e: any) {
        console.error('[IPC] Open user manual failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('send-email', async (_, { smtpConfig, mailOptions }) => {
    try {
        console.log(`[IPC] send-email requested to: ${mailOptions.to}`);
        
        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure === 'SSL', // true for 465, false for 587/other
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.pass,
            },
            tls: {
                rejectUnauthorized: false // Helps with self-signed certs or local servers
            }
        });

        const info = await transporter.sendMail({
            from: `"${smtpConfig.senderName}" <${smtpConfig.senderEmail}>`,
            to: mailOptions.to,
            subject: mailOptions.subject,
            text: mailOptions.text,
            html: mailOptions.html,
            attachments: mailOptions.attachments ? mailOptions.attachments.map((at: any) => ({
                filename: at.filename,
                content: Buffer.from(at.content)
            })) : []
        });

        console.log(`[IPC] Email sent. MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (e: any) {
        console.error('[IPC] send-email failed:', e);
        return { success: false, error: e.message };
    }
});
// 3. Simple Key-Value Store
ipcMain.handle('db-set', async (_, { key, value }) => {
    try {
        if (!db) throw new Error("Database not initialized");
        const stmt = db.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
        stmt.run(key, JSON.stringify(value));
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('db-get', async (_, key) => {
    try {
        if (!db) return { success: true, data: null };
        const row = db.prepare('SELECT value FROM store WHERE key = ?').get(key) as { value: string };
        return { success: true, data: row ? JSON.parse(row.value) : null };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('db-delete', async (_, key) => {
    try {
        if (!db) return { success: true };
        db.prepare('DELETE FROM store WHERE key = ?').run(key);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

// 4. Encrypted Manual Backup
ipcMain.handle('run-backup', async (_, encryptedData) => {
    try {
        if (!appBasePath) throw new Error("App storage not initialized");
        const paths = getAppPaths(appBasePath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
        const fileName = `backup_${timestamp[0]}_${timestamp[1].slice(0, 8)}.enc`;
        const filePath = path.join(paths.backups, fileName);
        fs.writeFileSync(filePath, encryptedData);
        return { success: true, fileName };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

// 5. Automatic Data Backup (triggered by payroll confirmation/rollover)
ipcMain.handle('create-data-backup', async (_, fileName) => {
    try {
        // Self-Healing Logic: Detect if DB was never initialized despite having a path
        if (!db && appBasePath) {
            console.log("🔄 Self-Healing: Re-initializing database connection before backup...");
            initializeDatabase(appBasePath);
        }

        if (!appBasePath) {
            throw new Error("App storage context is missing. Please select a storage location in Settings.");
        }
        if (!db) {
            throw new Error("Database engine failed to initialize. Check if another instance is running or if the Data folder is read-only.");
        }
        const paths = getAppPaths(appBasePath);

        // Ensure backups directory exists
        if (!fs.existsSync(paths.backups)) {
            fs.mkdirSync(paths.backups, { recursive: true });
        }

        const filePath = path.join(paths.backups, `${fileName}.enc`);
        console.log(`[IPC] Creating automatic backup: ${filePath}`);

        // db.backup() is a better-sqlite3 method that performs an online backup
        await db.backup(filePath);

        console.log(`[IPC] Automatic backup created successfully.`);
        return { success: true, path: filePath };
    } catch (e: any) {
        console.error('[IPC] Automatic backup failed:', e);
        return { success: false, error: e.message };
    }
});

// 5b. Restore from SQLite Backup (Directly Replace DB File)
ipcMain.handle('restore-sqlite-backup', async (_, backupFilePath) => {
    try {
        if (!appBasePath) throw new Error("App storage not initialized");
        const paths = getAppPaths(appBasePath);
        const DB_PATH = path.join(paths.data, 'active_db.sqlite');

        console.log(`[IPC] Restoring SQLite backup from: ${backupFilePath}`);

        if (!fs.existsSync(backupFilePath)) {
            throw new Error("Backup file not found at " + backupFilePath);
        }

        // 1. Close current connection
        if (db) {
            db.close();
            db = null;
        }

        // 2. Perform the swap
        fs.copyFileSync(backupFilePath, DB_PATH);

        // 3. Re-initialize
        initializeDatabase(appBasePath);

        console.log(`[IPC] SQLite restoration successful.`);
        return { success: true };
    } catch (e: any) {
        console.error('[IPC] SQLite restoration failed:', e);
        // Attempt to re-init if closed
        if (!db && appBasePath) initializeDatabase(appBasePath);
        return { success: false, error: e.message };
    }
});

// 6. App Closing
ipcMain.handle('close-app', async () => {
    console.error("IPC 'close-app' WAS CALLED. STACK TRACE:");
    console.trace();
    app.quit();
});

// 6. Machine ID Retrieval
ipcMain.handle('get-machine-id', async () => {
    try {
        try {
            // Primary attempt: wmic
            const output = execSync('wmic csproduct get uuid', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).toString();
            const lines = output.split(/\r?\n/).filter((line: string) => line.trim() && !line.includes('UUID') && !line.includes('wmic'));
            if (lines.length > 0 && lines[0].trim()) {
                return lines[0].trim();
            }
        } catch (e) {
            // Ignore WMIC failure, fallback to PowerShell
        }

        // Fallback: PowerShell (Modern Windows 11)
        const psOutput = execSync('powershell.exe -NoProfile -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).toString();
        if (psOutput && psOutput.trim()) {
            return psOutput.trim();
        }

        return 'UNKNOWN-MACHINE-ID';
    } catch (e) {
        console.error('Failed to get machine ID:', e);
        return 'UNKNOWN-MACHINE-ID';
    }
});

// 7. OS Version Retrieval
ipcMain.handle('get-os-version', async () => {
    return os.release();
});

ipcMain.handle('set-fullscreen', async (_, flag: boolean) => {
    if (mainWindow) {
        mainWindow.setFullScreen(flag);
        return { success: true };
    }
    return { success: false, error: 'No main window' };
});

ipcMain.handle('get-fullscreen', async () => {
    if (mainWindow) {
        return mainWindow.isFullScreen();
    }
    return false;
});

ipcMain.handle('relaunch-app', () => {
    app.relaunch();
    app.exit(0);
});

ipcMain.handle('open-external', async (_, url: string) => {
    try {
        await shell.openExternal(url);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('api-fetch', async (_, url: string, options: any) => {
    try {
        return new Promise((resolve, reject) => {
            const request = net.request({
                url,
                method: options?.method || 'GET',
                redirect: 'follow'
            } as any);

            const timeout = setTimeout(() => {
                request.abort();
                reject({ message: '🔌 API Request Timed Out (30s)' });
            }, 30000);

            if (options?.headers) {
                for (const [key, value] of Object.entries(options.headers)) {
                    request.setHeader(key, value as string);
                }
            }

            request.on('response', (response) => {
                let responseData = '';
                response.on('data', (chunk) => {
                    responseData += chunk.toString('utf8');
                });
                response.on('end', () => {
                    clearTimeout(timeout);
                    let responseBody: any;
                    try {
                        responseBody = JSON.parse(responseData);
                    } catch {
                        responseBody = responseData;
                    }

                    if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
                        console.error(`🔌 fetch failed [${response.statusCode}]:`, responseBody);
                        reject({ message: `HTTP error! status: ${response.statusCode}` });
                    } else {
                        resolve(responseBody);
                    }
                });
            });

            request.on('error', (error) => {
                clearTimeout(timeout);
                console.error('🔌 Error in api-fetch:', error);
                reject({ message: error.message });
            });

            if (options?.body) {
                request.write(options.body);
            }
            request.end();
        });
    } catch (error: any) {
        throw { message: error.message };
    }
});

// 8. Dynamic Folder Detection
ipcMain.handle('find-bpp-app', async () => {
    try {
        const potentialRoots: string[] = [];

        // 1. Get all logical drives on Windows
        try {
            const output = execSync('wmic logicaldisk get name', { encoding: 'utf8' });
            const drives = output.split(/\r?\n/)
                .filter(line => line.trim() && line.includes(':'))
                .map(line => line.trim());

            drives.forEach(drive => {
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
        potentialRoots.push(path.join(app.getPath('home'), 'BPP_APP'));

        // 3. Scan for first existing one
        for (const p of potentialRoots) {
            if (fs.existsSync(p)) {
                // Verify it's actually our app directory (contains BharatPP or active_db.sqlite)
                const dataPath = path.join(p, 'BharatPP', 'Data', 'active_db.sqlite');
                if (fs.existsSync(dataPath)) {
                    console.log('🔍 Dynamic Detection: Found BPP_APP at', p);
                    return { success: true, path: p };
                }
            }
        }

        return { success: false, error: 'BPP_APP folder not found' };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

// ── 9. SMART AUTO-UPDATE HANDLERS ──

const INSTALLER_NAME = 'bpp_installer.exe';
const getInstallerPath = () => path.join(os.tmpdir(), INSTALLER_NAME);

ipcMain.handle('start-update-download', async (_, downloadUrl: string, expectedHash?: string) => {
    return new Promise((resolve) => {
        try {
            const dest = getInstallerPath();
            const file = fs.createWriteStream(dest);

            const request = net.request({
                url: downloadUrl,
                redirect: 'follow'
            });
            
            request.on('response', (response) => {
                const totalBytes = parseInt(response.headers['content-length'] as string, 10) || 0;
                let downloadedBytes = 0;
                let lastEmittedProgress = -1;

                response.on('data', (chunk) => {
                    file.write(chunk);
                    downloadedBytes += chunk.length;
                    
                    if (totalBytes > 0) {
                        const progress = Math.round((downloadedBytes / totalBytes) * 100);
                        if (progress !== lastEmittedProgress) {
                            lastEmittedProgress = progress;
                            BrowserWindow.getAllWindows().forEach(win => {
                                win.webContents.send('update-download-progress', progress);
                            });
                        }
                    }
                });
                
                response.on('end', async () => {
                    file.end();
                    console.log('✅ Update downloaded to:', dest);

                    // ── SHA-256 INTEGRITY VERIFICATION ──
                    if (expectedHash && expectedHash.trim() !== "") {
                        console.log('🛡️ Verifying SHA-256 integrity...');
                        try {
                            const hash = crypto.createHash('sha256');
                            const input = fs.createReadStream(dest);
                            
                            const calculatedHash = await new Promise<string>((res, rej) => {
                                input.on('data', chunk => hash.update(chunk as any));
                                input.on('end', () => res(hash.digest('hex')));
                                input.on('error', err => rej(err));
                            });

                            if (calculatedHash.toLowerCase() !== expectedHash.toLowerCase()) {
                                console.error(`❌ Security Violation: Hash Mismatch!\nExpected: ${expectedHash}\nActual: ${calculatedHash}`);
                                fs.unlinkSync(dest);
                                resolve({ success: false, error: 'SECURITY_HASH_MISMATCH' });
                                return;
                            }
                            console.log('✅ Integrity Verified successfully.');
                        } catch (hashErr: any) {
                            console.error('❌ Hash calculation failed:', hashErr);
                            fs.unlinkSync(dest);
                            resolve({ success: false, error: 'Integrity check failed' });
                            return;
                        }
                    }

                    BrowserWindow.getAllWindows().forEach(win => {
                        win.webContents.send('update-download-complete');
                    });
                    console.log(`✅ Update download finished. Total Bytes: ${fs.statSync(dest).size}`);
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
            });
            
            request.end();

        } catch (e: any) {
            resolve({ success: false, error: e.message });
        }
    });
});

ipcMain.handle('backup-and-install', async (_, options?: { silent?: boolean }) => {
    try {
        if (!appBasePath) throw new Error("App storage not initialized");
        const paths = getAppPaths(appBasePath);
        const snapshotDir = path.join(paths.backups, 'PRE_UPDATE_SNAPSHOT');

        if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });

        // 1. Close DB Connection
        if (db) {
            db.close();
            db = null;
        }

        // 2. Snapshot Data
        const dbFile = path.join(paths.data, 'active_db.sqlite');
        if (fs.existsSync(dbFile)) {
            fs.copyFileSync(dbFile, path.join(snapshotDir, 'active_db_snapshot.sqlite'));
        }
        if (fs.existsSync(CONFIG_PATH)) {
            fs.copyFileSync(CONFIG_PATH, path.join(snapshotDir, 'app-config_snapshot.json'));
        }

        console.log('📦 Data snapshot created in:', snapshotDir);

        // 3. Verify installer file exists and has content
        const installerPath = getInstallerPath();
        if (!fs.existsSync(installerPath)) {
            throw new Error("Installer file not found in temp directory. Please try downloading the update again.");
        }
        const installerSize = fs.statSync(installerPath).size;
        if (installerSize < 1024 * 100) { // Less than 100KB = likely corrupt/incomplete
            fs.unlinkSync(installerPath); // Remove corrupt file
            throw new Error(`Installer file appears corrupt (${installerSize} bytes). Please try downloading the update again.`);
        }

        const isSilent = options?.silent ?? false;
        console.log(`🚀 Launching ${isSilent ? 'SILENT ' : ''}update installer from: ${installerPath} (${installerSize} bytes)`);

        // 4. Unblock the file — removes Zone.Identifier ADS that Windows uses to flag
        //    downloaded files as "from the internet", causing SmartScreen to block them.
        try {
            execSync(
                `powershell.exe -WindowStyle Hidden -Command "Unblock-File -Path '${installerPath}' -ErrorAction SilentlyContinue"`,
                { timeout: 8000 }
            );
            console.log('🔓 File unblocked (Zone.Identifier removed). SmartScreen will not block.');
        } catch (unblockErr) {
            console.warn('⚠️ Could not unblock file (non-fatal, continuing):', unblockErr);
        }

        // 5. Launch the installer via PowerShell Start-Process with RunAs elevation.
        //    This is the most reliable method: it properly elevates, handles SmartScreen,
        //    and works even when the app is not code-signed.
        let launchError: Error | null = null;
        try {
            if (isSilent) {
                // SILENT: Install quietly, then relaunch the app
                const silentCmd = `Start-Process -FilePath '${installerPath}' -ArgumentList '/S' -Wait; Start-Process -FilePath '${process.execPath}'`;
                spawn('powershell.exe', ['-WindowStyle', 'Hidden', '-Command', silentCmd], {
                    detached: true,
                    stdio: 'ignore'
                }).unref();
                console.log('👋 Silent install + auto-relaunch initiated.');
            } else {
                // INTERACTIVE: Show the installer UI to the user
                spawn('powershell.exe', [
                    '-WindowStyle', 'Hidden',
                    '-Command',
                    `Start-Process -FilePath '${installerPath}'`
                ], {
                    detached: true,
                    stdio: 'ignore'
                }).unref();
                console.log('👋 Interactive installer launched.');
            }
        } catch (spawnErr: any) {
            launchError = spawnErr;
        }

        if (launchError) {
            // Launch failed — show the window again so user is not left staring at a black screen
            console.error('❌ Failed to launch installer:', launchError);
            if (mainWindow) {
                mainWindow.show();
                dialog.showErrorBox(
                    'Update Failed to Launch',
                    `The installer could not be started.\n\nError: ${launchError.message}\n\nPlease run the installer manually from:\n${installerPath}`
                );
            }
            return { success: false, error: launchError.message };
        }

        // 6. All good — hide window and hard-exit to release all file locks
        if (mainWindow) {
            mainWindow.hide();
        }
        console.log('✅ Installer launched. Performing hard exit to release file locks...');
        app.exit(0);

        return { success: true };
    } catch (e: any) {
        console.error('❌ Pre-update backup or install failed:', e);
        // Attempt to re-init DB if failed
        if (appBasePath && !db) initializeDatabase(appBasePath);
        return { success: false, error: e.message };
    }
});

function cleanupOldInstallers() {
    try {
        const dest = getInstallerPath();
        if (fs.existsSync(dest)) {
            // Check if it's been there for more than a few minutes (avoid deleting during active download)
            const stats = fs.statSync(dest);
            const ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
            if (ageMinutes > 5) {
                fs.unlinkSync(dest);
                console.log('🧹 Cleaned up old installer file.');
            }
        }

        // Also check if there are any orphaned EXEs in the app root
        if (appBasePath) {
            const rootFiles = fs.readdirSync(appBasePath);
            rootFiles.forEach((file: string) => {
                if (file.toLowerCase().endsWith('.exe') && file.toLowerCase().includes('bpp_app')) {
                    // This might be an old version left behind. 
                    // We don't delete immediately to be safe, but we log it.
                    console.log(`ℹ️ Found potential legacy EXE in root: ${file}`);
                }
            });
        }
    } catch (e) {
        console.warn('⚠️ Cleanup check skipped:', e);
    }
}

console.log("-----------------------------------------");
console.log("ELECTRON MAIN PROCESS: HANDLERS READY");
console.log("-----------------------------------------");
