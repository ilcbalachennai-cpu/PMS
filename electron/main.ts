import { app, BrowserWindow, ipcMain, dialog, net, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import nodemailer from 'nodemailer';

import { spawn, execSync } from 'child_process';
import * as os from 'os';

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development';

// ── CONFIGURATION & PERSISTENCE ──
const CONFIG_PATH = path.join(app.getPath('userData'), 'app-config.json');

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
    const root = path.join(base, 'BharatPP');
    return {
        root,
        data: path.join(root, 'Data'),
        reports: path.join(root, 'Reports'),
        backups: path.join(root, 'Backups')
    };
};

// ── DATABASE INITIALIZATION ──
let db: Database.Database | null = null;
let lastDbError: string | null = null;

function initializeDatabase(basePath: string) {
    try {
        const paths = getAppPaths(basePath);
        
        // Ensure directories exist
        [paths.data, paths.reports, paths.backups].forEach((dir: string) => {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        });

        const DB_PATH = path.join(paths.data, 'active_db.sqlite');
        const snapshotDir = path.join(paths.backups, 'PRE_UPDATE_SNAPSHOT');
        const snapshotDb = path.join(snapshotDir, 'active_db_snapshot.sqlite');

        // ── AUTO-RESTORE LOGIC ──
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
            db = new Database(DB_PATH, { timeout: 10000 }); // Increase timeout for slow disks/removable drives
            db.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
            console.log('✅ Database initialized successfully at:', DB_PATH);
            lastDbError = null;
            return true;
        } catch (e: any) {
            lastDbError = e.message;
            console.error(`❌ DB connection failed at ${DB_PATH}:`, e);
            
            // If corrupted and snapshot exists, try a hail-mary restore
            if (fs.existsSync(snapshotDb)) {
                try {
                    if (db) db.close();
                    fs.copyFileSync(snapshotDb, DB_PATH);
                    db = new Database(DB_PATH);
                    console.log('🛠️ Corrupted DB replaced with snapshot.');
                    return true;
                } catch (restoreErr) {
                    console.error('❌ Hail-mary restore failed.', restoreErr);
                }
            }
            return false;
        }
    } catch (outerErr: any) {
        console.error('❌ Critical failure in initializeDatabase:', outerErr);
        return false;
    }
}

if (appBasePath) {
    try {
        initializeDatabase(appBasePath);
    } catch (e) {
        console.error("Failed to initialize database at stored path:", e);
        appBasePath = ''; // Reset if path is invalid
    }
}

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
// Prevent multiple instances of BPP_APP from running simultaneously.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
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
  // If a second instance attempts while we are the primary, focus our window.
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
// ─────────────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
    createWindow();
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

// 2b. Open File Location (Triggered after user closes dialog)
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

// 3. Simple Key-Value Store
ipcMain.handle('db-set', async (_, { key, value }) => {
    try {
        if (!db) {
            console.log(`[IPC] db-set: DB null for key "${key}". Attempting lazy re-init...`);
            if (appBasePath) initializeDatabase(appBasePath);
        }
        if (!db) throw new Error(`Database not initialized. ${lastDbError || 'Please ensure app storage is configured and accessible.'}`);
        const stmt = db.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
        stmt.run(key, JSON.stringify(value));
        return { success: true };
    } catch (e: any) {
        console.error(`[IPC] db-set failed for key "${key}":`, e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('db-get', async (_, key) => {
    try {
        if (!db) {
            console.log(`[IPC] db-get: DB null for key "${key}". Attempting lazy re-init...`);
            if (appBasePath) initializeDatabase(appBasePath);
        }
        if (!db) return { success: true, data: null }; // Silent fallback if init failed
        const row = db.prepare('SELECT value FROM store WHERE key = ?').get(key) as { value: string };
        return { success: true, data: row ? JSON.parse(row.value) : null };
    } catch (e: any) {
        console.error(`[IPC] db-get failed for key "${key}":`, e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('db-delete', async (_, key) => {
    try {
        if (!db) {
            console.log(`[IPC] db-delete: DB null for key "${key}". Attempting lazy re-init...`);
            if (appBasePath) initializeDatabase(appBasePath);
        }
        if (!db) return { success: true };
        db.prepare('DELETE FROM store WHERE key = ?').run(key);
        return { success: true };
    } catch (e: any) {
        console.error(`[IPC] db-delete failed for key "${key}":`, e);
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
        if (!appBasePath) {
            throw new Error("Application storage location is not configured. Please set a storage directory in Settings.");
        }

        if (!db) {
            console.log('[IPC] create-data-backup: DB null. Attempting lazy recovery...');
            initializeDatabase(appBasePath);
            if (!db) {
                throw new Error(`The database file could not be opened. (Error: ${lastDbError || 'Unknown'}). This usually happens if the file is locked by another process (like Antivirus) or is corrupted. Please restart the app.`);
            }
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

ipcMain.handle('start-update-download', async (_, downloadUrl: string) => {
    return new Promise((resolve) => {
        try {
            const dest = getInstallerPath();
            const file = fs.createWriteStream(dest);

            const request = net.request({
                url: downloadUrl,
                redirect: 'follow'
            });
            
            request.on('response', (response) => {
                response.on('data', (chunk) => {
                    file.write(chunk);
                });
                
                response.on('end', () => {
                    file.end();
                    console.log('✅ Update downloaded to:', dest);
                    BrowserWindow.getAllWindows().forEach(win => {
                        win.webContents.send('update-download-complete');
                    });
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

ipcMain.handle('backup-and-install', async () => {
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

        // 3. Launch Installer
        const installerPath = getInstallerPath();
        if (!fs.existsSync(installerPath)) throw new Error("Installer file not found");

        console.log('🚀 Launching update installer...');

        // Use spawn to launch detached so we can quit Electron immediately
        // By passing /currentuser we tell NSIS not to ask the "Who should this apply to?" question.
        // We also force the directory so it doesn't accidentally install a duplicate copy in %LOCALAPPDATA%.
        const installDir = path.dirname(process.execPath);
        const child = spawn(installerPath, ['/currentuser', `/D=${installDir}`], {
            detached: true,
            stdio: 'ignore'
        });
        child.unref();

        app.quit();
        return { success: true };
    } catch (e: any) {
        console.error('❌ Pre-update backup or install failed:', e);
        // Attempt to re-init DB if failed
        if (appBasePath && !db) initializeDatabase(appBasePath);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('send-payslip-email', async (_event, data: any) => {
    const { smtp, to, subject, body, attachment } = data;
    
    try {
        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: smtp.port,
            secure: smtp.secure,
            auth: {
                user: smtp.user,
                pass: smtp.pass
            }
        });

        const mailOptions = {
            from: `"${smtp.fromName}" <${smtp.user}>`,
            to: to,
            subject: subject,
            text: body,
            attachments: [
                {
                    filename: attachment.filename,
                    content: Buffer.from(attachment.content)
                }
            ]
        };

        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (e: any) {
        console.error('❌ Email sending failed:', e);
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
