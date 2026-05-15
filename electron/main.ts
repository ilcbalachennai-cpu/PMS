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
// V03.01.06: Isolate Developer and Production database configurations
const CONFIG_PATH = isDev 
    ? path.join(app.getPath('userData'), 'app-config-dev.json') 
    : path.join(app.getPath('userData'), 'app-config.json');

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
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        console.log(`✅ App config saved to: ${CONFIG_PATH}`);
    } catch (e) {
        console.error(`❌ Failed to save app config:`, e);
    }
}

let appConfig = getAppConfig();
let appBasePath = appConfig.appBasePath || (isDev ? 'E:\\BharatPP_Dev' : '');

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
let activeCompanyId: string | null = null;

function initializeDatabase(basePath: string, companyId?: string) {
    if (!basePath) {
        console.error('❌ Cannot initialize database: basePath is empty');
        return;
    }

    // V03.01.07: Forced base path to User App folder for debugging
    // console.log(`🔍 Original basePath: ${basePath}. Forcing to E:\\BharatPP_Dev`);
    // basePath = 'E:\\BharatPP_Dev';

    appBasePath = basePath;
    const paths = getAppPaths(basePath);
    
    // V03.01.03: Direct Silo Provisioning
    activeCompanyId = companyId || activeCompanyId || null;
    let dataDir = paths.data;
    
    if (activeCompanyId && activeCompanyId !== 'default' && activeCompanyId !== 'null') {
        dataDir = path.join(paths.data, activeCompanyId);
        // FORCE CREATE THE SILO FOLDER
        if (!fs.existsSync(dataDir)) {
            console.log(`[DB] Provisioning silo folder: ${dataDir}`);
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    // DEBUG TRACER: Write current state to a file for diagnosis
    try {
        const debugInfo = `[${new Date().toISOString()}] ID: ${activeCompanyId} | DIR: ${dataDir}\n`;
        fs.appendFileSync(path.join(paths.data, 'silo_debug.txt'), debugInfo);
    } catch (e) {}

    const DB_PATH = path.join(dataDir, 'active_db.sqlite');
    
    // Ensure directories exist
    const dirsToCreate = [dataDir, paths.reports, paths.backups, paths.templates];
    dirsToCreate.forEach((dir: string) => {
        try {
            if (!fs.existsSync(dir)) {
                console.log(`📁 Creating directory: ${dir}`);
                fs.mkdirSync(dir, { recursive: true });
            }
        } catch (err: any) {
            console.error(`❌ Permission Error: Failed to create directory: ${dir}`, err);
            throw new Error(`Permission Denied: Cannot create folder at ${dir}. Please ensure you have write access to this location.`);
        }
    });

    try {
        console.log(`🗄️ Opening isolated database: ${DB_PATH}`);
        if (db) {
            try { db.close(); } catch (e) {}
            db = null;
        }
        
        db = new Database(DB_PATH, { timeout: 15000 }); // Increased timeout for slow drives
        db.pragma('journal_mode = WAL');
        db.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
        
        // V03.01.01: Sync the global appBasePath to ensure persistence
        appBasePath = basePath;
        
        console.log('✅ Database initialized successfully.');
        
        // V03.01.07: Create a startup backup
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const autoBackupDir = path.join(paths.backups, 'AUTO_SNAPSHOTS');
            if (!fs.existsSync(autoBackupDir)) {
                fs.mkdirSync(autoBackupDir, { recursive: true });
            }
            const backupPath = path.join(autoBackupDir, `startup_db_${timestamp}.sqlite`);
            
            // Use safe backup API
            db.backup(backupPath)
                .then(() => {
                    console.log(`✅ Startup snapshot created: ${backupPath}`);
                    cleanupOldSnapshots(autoBackupDir, 5); // Keep last 5
                })
                .catch(e => console.error(`❌ Failed to create startup snapshot:`, e));
                
            // Start interval snapshots
            startAutoSnapshot(basePath, companyId || 'default');
        } catch (e) {
            console.error(`❌ Failed to initialize snapshot system:`, e);
        }
    } catch (e: any) {
        console.error('❌ DB connection failed:', e);
        const errorLog = `[${new Date().toISOString()}] DB connection failed at ${DB_PATH}: ${e.message}\n`;
        fs.appendFileSync(path.join(app.getPath('userData'), 'electron_errors.txt'), errorLog);
        
        // V03.01.07: Log error to a file we can easily access
        try {
            const errorFilePath = path.join(paths.data, 'error_log.txt');
            fs.appendFileSync(errorFilePath, errorLog);
            console.log(`📝 Error logged to: ${errorFilePath}`);
        } catch (err) {}
        
        // V03.01.07: Safe Recovery from Snapshot
        const snapshotDb = path.join(paths.backups, 'PRE_UPDATE_SNAPSHOT', 'active_db_snapshot.sqlite');
        
        if (fs.existsSync(snapshotDb)) {
            try {
                console.log('🛠️ Attempting safe recovery from snapshot...');
                if (db) { try { db.close(); } catch (err) {} }
                
                // Backup the failed DB before overwriting
                if (fs.existsSync(DB_PATH)) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const failedPath = `${DB_PATH}.failed_${timestamp}`;
                    fs.renameSync(DB_PATH, failedPath);
                    console.warn(`⚠️ Failed DB preserved at: ${failedPath}`);
                }
                
                fs.copyFileSync(snapshotDb, DB_PATH);
                db = new Database(DB_PATH);
                console.log('✅ Safe recovery successful using snapshot.');
            } catch (restoreErr: any) {
                throw new Error(`Database Error: ${e.message}. Recovery failed: ${restoreErr.message}`);
            }
        } else {
            throw new Error(`Database Error: ${e.message}. Path: ${DB_PATH}`);
        }
    }
}

function cleanupOldSnapshots(dir: string, maxFiles: number) {
    try {
        const files = fs.readdirSync(dir)
            .filter(f => f.endsWith('.sqlite'))
            .map(f => ({ name: f, stat: fs.statSync(path.join(dir, f)) }))
            .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

        if (files.length > maxFiles) {
            for (let i = maxFiles; i < files.length; i++) {
                fs.unlinkSync(path.join(dir, files[i].name));
                console.log(`🗑️ Deleted old snapshot: ${files[i].name}`);
            }
        }
    } catch (e) {
        console.error(`❌ Failed to cleanup old snapshots:`, e);
    }
}

let autoSnapshotInterval: NodeJS.Timeout | null = null;

function startAutoSnapshot(basePath: string, _companyId: string) {
    if (autoSnapshotInterval) clearInterval(autoSnapshotInterval);
    
    autoSnapshotInterval = setInterval(() => {
        if (!db) return;
        
        try {
            const paths = getAppPaths(basePath);
            const autoBackupDir = path.join(paths.backups, 'AUTO_SNAPSHOTS');
            if (!fs.existsSync(autoBackupDir)) fs.mkdirSync(autoBackupDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(autoBackupDir, `auto_db_${timestamp}.sqlite`);
            
            db.backup(backupPath)
                .then(() => {
                    console.log(`✅ Auto snapshot created: ${backupPath}`);
                    cleanupOldSnapshots(autoBackupDir, 10); // Keep last 10 for auto
                })
                .catch(e => console.error(`❌ Failed to create auto snapshot:`, e));
        } catch (e) {
            console.error(`❌ Failed to create auto snapshot:`, e);
        }
    }, 30 * 60 * 1000); // Every 30 minutes
}

/**
 * 🛡️ DATABASE HEALTH CHECK
 */
function isDatabaseHealthy() {
    try {
        if (!db) return false;
        db.prepare('SELECT 1').get();
        return true;
    } catch (e) {
        console.error('❌ Database health check failed:', e);
        return false;
    }
}

/**
 * 🛡️ ENSURE DATABASE IS READY
 * Centralized helper to prevent "Database not initialized" errors.
 * Attempts to re-initialize from config if db is null.
 */
function ensureDatabase() {
    if (db && appBasePath && isDatabaseHealthy()) return true;

    console.log('🔍 Database check failed or unhealthy. Attempting on-demand recovery...');
    const config = getAppConfig();
    const savedPath = config.appBasePath || appBasePath;

    if (savedPath) {
        try {
            // If DB exists but is unhealthy, close it first
            if (db) {
                try { db.close(); } catch (e) {}
                db = null;
            }
            initializeDatabase(savedPath);
            return db !== null && isDatabaseHealthy();
        } catch (e: any) {
            console.error('❌ On-demand initialization failed:', e);
            const errorLog = `[${new Date().toISOString()}] On-demand recovery failed: ${e.message}\n`;
            try {
                fs.appendFileSync(path.join(app.getPath('userData'), 'electron_errors.txt'), errorLog);
            } catch (err) {}
            return false;
        }
    }
    
    return false;
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
            console.log(`🔄 Auto-initializing database from config: ${appBasePath}`);
            initializeDatabase(appBasePath);
        } catch (e) {
            console.error("❌ Failed to initialize database at stored path:", e);
            // V03.01.02: Don't clear appBasePath immediately if it exists on disk but failed to open (e.g. locked)
            // Only clear if the path itself is invalid/missing
            if (!fs.existsSync(appBasePath)) {
                appBasePath = '';
                saveAppConfig({ ...getAppConfig(), appBasePath: '' });
            }
        }
    } else {
        console.warn("⚠️ No stored appBasePath found in config.");
    }
    
    cleanupOldInstallers();
});

app.on('window-all-closed', () => {
    console.error("EVENT 'window-all-closed' WAS FIRED. STACK TRACE:");
    console.trace();
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    if (db) {
        console.log('🔌 Closing database before quit...');
        try { db.close(); } catch (e) {}
        db = null;
    }
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

ipcMain.handle('switch-company-data', async (_, companyId: string) => {
    try {
        if (!appBasePath) throw new Error("Storage path not set");
        console.log(`[IPC] Switching to company data silo: ${companyId}`);
        
        // 1. Force provision the folder if it's a real company (not 'default')
        if (companyId && companyId !== 'default') {
            const paths = getAppPaths(appBasePath);
            const siloPath = path.join(paths.data, companyId);
            if (!fs.existsSync(siloPath)) {
                console.log(`[IPC] Provisioning new physical silo at: ${siloPath}`);
                fs.mkdirSync(siloPath, { recursive: true });
            }
        }

        // 2. Flush and close current connection
        if (db) {
            try { db.close(); } catch(e) {}
            db = null;
        }

        // 3. Re-initialize with scope
        initializeDatabase(appBasePath, companyId);
        
        return { success: true };
    } catch (e: any) {
        console.error('[IPC] Company data switch failed:', e);
        return { success: false, error: e.message };
    }
});

// 2. Report Saving
ipcMain.handle('save-report', async (_, { fileName, data, type, subfolder }) => {
    try {
        console.log(`[IPC] save-report requested: ${fileName}.${type} in subfolder: ${subfolder}`);

        if (!appBasePath) {
            throw new Error("App storage not initialized. Please select a storage location.");
        }

        const paths = getAppPaths(appBasePath);
        let targetDir = paths.reports;

        if (subfolder) {
            const folderName = subfolder.trim().split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            targetDir = path.join(paths.reports, folderName);
        }

        // Ensure the reports directory exists
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const filePath = path.resolve(targetDir, `${fileName}.${type}`);
        console.log(`[IPC] Saving file to: ${filePath}`);

        // Write the file
        const buffer = Buffer.from(data);
        fs.writeFileSync(filePath, new Uint8Array(buffer));

        return { success: true, path: filePath };
    } catch (e: any) {
        console.error('[IPC] Save report failed:', e);
        return { success: false, error: e.message };
    }
});

// 2b. Template Saving (routes to BharatPP/Templates instead of Report files)
ipcMain.handle('save-template', async (_, { fileName, data, type, subfolder }) => {
    try {
        console.log(`[IPC] save-template requested: ${fileName}.${type} in subfolder: ${subfolder}`);

        if (!appBasePath) throw new Error("App storage not initialized.");

        const paths = getAppPaths(appBasePath);
        let targetDir = paths.templates;

        if (subfolder) {
            const folderName = subfolder.trim().split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            targetDir = path.join(paths.templates, folderName);
        }

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const filePath = path.resolve(targetDir, `${fileName}.${type}`);
        console.log(`[IPC] Saving template to: ${filePath}`);

        const buffer = Buffer.from(data);
        fs.writeFileSync(filePath, new Uint8Array(buffer));

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
        if (!ensureDatabase()) {
            throw new Error("Storage not configured. Database unavailable.");
        }
        const stmt = db!.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
        stmt.run(key, JSON.stringify(value));
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});


ipcMain.handle('db-get', async (_, key) => {
    try {
        if (!ensureDatabase()) return { success: true, data: null };
        const row = db!.prepare('SELECT value FROM store WHERE key = ?').get(key) as { value: string };
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

ipcMain.handle('db-get-all', async () => {
    try {
        if (!db) return { success: true, data: [] };
        const rows = db.prepare('SELECT key, value FROM store').all() as { key: string, value: string }[];
        return { success: true, data: rows.map(r => ({ key: r.key, value: JSON.parse(r.value) })) };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('db-set-global', async (_, { key, value }) => {
    try {
        // Always write to the ROOT database (Registry)
        const rootDbPath = path.join(appBasePath, 'active_db.sqlite');
        const rootDb = new Database(rootDbPath);
        rootDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
        const stmt = rootDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
        stmt.run(key, JSON.stringify(value));
        rootDb.close();
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('list-silos', async () => {
    try {
        if (!appBasePath) throw new Error("App storage not initialized");
        const paths = getAppPaths(appBasePath);
        const dataDir = paths.data;
        if (!fs.existsSync(dataDir)) return { success: true, silos: [] };

        const silos = fs.readdirSync(dataDir)
            .filter(name => fs.statSync(path.join(dataDir, name)).isDirectory())
            .filter(name => name !== '.icon-ico'); // Exclude known non-silo folders if any
        
        return { success: true, silos };
    } catch (e: any) {
        console.error('[IPC] list-silos failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('delete-silo', async (_, companyId: string) => {
    try {
        if (!appBasePath) throw new Error("App storage not initialized");
        if (!companyId || companyId === 'default') throw new Error("Invalid company ID for deletion");
        
        const paths = getAppPaths(appBasePath);
        const siloPath = path.join(paths.data, companyId);
        
        if (fs.existsSync(siloPath)) {
            console.log(`[IPC] Deleting physical silo folder: ${siloPath}`);
            fs.rmSync(siloPath, { recursive: true, force: true });
        }
        
        return { success: true };
    } catch (e: any) {
        console.error('[IPC] delete-silo failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('wipe-all-data', async () => {
    try {
        if (db) { db.close(); db = null; }
        if (fs.existsSync(appBasePath)) {
            // Safety: Only delete within the app data dir
            fs.rmSync(appBasePath, { recursive: true, force: true });
            fs.mkdirSync(appBasePath, { recursive: true });
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('run-backup', async (_, arg1, arg2, arg3) => {
    try {
        let data, fileName, subfolder;
        
        // Handle object wrapping from preload.ts or positional arguments
        if (typeof arg1 === 'object' && arg1 !== null && arg1.data !== undefined) {
            ({ data, fileName, subfolder } = arg1);
        } else {
            data = arg1;
            fileName = arg2;
            subfolder = arg3;
        }

        if (!appBasePath) throw new Error("Storage folder not set. Please select a data location in Settings.");
        const paths = getAppPaths(appBasePath);
        
        let targetDir = paths.backups;
        if (subfolder) {
            const folderName = subfolder.trim().split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            targetDir = path.join(paths.backups, folderName);
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        }

        const filePath = path.join(targetDir, fileName || `backup_${Date.now()}.enc`);
        fs.writeFileSync(filePath, data);
        return { success: true, fileName, filePath };
    } catch (e: any) {
        console.error('[IPC] run-backup failed:', e);
        return { success: false, error: e.message };
    }
});

// 5. Automatic Data Backup (triggered by payroll confirmation/rollover)
ipcMain.handle('create-data-backup', async (_, arg) => {
    try {
        const fileName = typeof arg === 'string' ? arg : arg.fileName;
        const subfolder = typeof arg === 'object' ? arg.subfolder : '';

        console.log(`[IPC] create-data-backup requested: ${fileName} in subfolder: ${subfolder}`);
        console.log(`[IPC] Current DB instance: ${db ? 'Present' : 'NULL'}`);
        console.log(`[IPC] Current appBasePath: ${appBasePath}`);


        if (!appBasePath) throw new Error("Storage folder not set. Please select a data location in Settings.");
        if (!db) {
            // Last ditch effort to recover
            ensureDatabase();
            if (!db) throw new Error(`Database connection failed at ${appBasePath}. Please restart the application.`);
        }

        const paths = getAppPaths(appBasePath);

        let targetDir = paths.backups;
        if (subfolder) {
            // Use only the first word and sanitize
            const folderName = subfolder.trim().split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            targetDir = path.join(paths.backups, folderName);
        }

        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        const tempPath = path.join(targetDir, `${fileName}.sqlite.tmp`);
        const finalPath = path.join(targetDir, `${fileName}.enc`);

        
        console.log(`[IPC] Creating filtered backup (excluding user/license data)...`);
        const backupDb = new Database(tempPath);
        backupDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
        
        const rows = db!.prepare('SELECT key, value FROM store').all() as { key: string, value: string }[];
        
        const excludedKeys = [
            'app_license_secure', 
            'app_license_data', 
            'app_users', 
            'app_machine_id', 
            'app_developer_secure',
            'app_data_size'
        ];
        
        const insertStmt = backupDb.prepare('INSERT INTO store (key, value) VALUES (?, ?)');
        
        backupDb.transaction(() => {
            for (const row of rows) {
                if (!excludedKeys.includes(row.key)) {
                    insertStmt.run(row.key, row.value);
                }
            }
        })();
        
        backupDb.close();

        // --- ENCRYPTION LAYER ---
        const encryptionKey = (typeof arg === 'object' && arg.encryptionKey) ? arg.encryptionKey : await getInternalMachineId();
        console.log(`[IPC] Securing Archive with ${ (typeof arg === 'object' && arg.encryptionKey) ? 'Custom Identity Key' : 'Machine Lock' }...`);

        const cipher = crypto.createCipheriv('aes-256-cbc' as any, 
            crypto.scryptSync(encryptionKey, 'salt', 32) as any, 
            Buffer.alloc(16, 0) as any
        );
        
        const input = fs.createReadStream(tempPath);
        const output = fs.createWriteStream(finalPath);
        
        await new Promise((resolve, reject) => {
            input.pipe(cipher).pipe(output)
                 .on('finish', () => resolve(true))
                 .on('error', (err) => reject(err));
        });

        fs.unlinkSync(tempPath); // Remove the plain temporary file
        console.log(`[IPC] Secure Automatic Backup Created: ${finalPath}`);
        return { success: true, path: finalPath };
    } catch (e: any) {
        console.error('[IPC] Automatic backup failed:', e);
        return { success: false, error: e.message };
    }
});

// 5b. Restore from SQLite Backup (Directly Replace DB File)
ipcMain.handle('restore-sqlite-backup', async (_, arg) => {
    try {
        const backupFilePath = typeof arg === 'string' ? arg : arg.path;
        if (!appBasePath) throw new Error("App storage not initialized");
        const paths = getAppPaths(appBasePath);
        
        // Use active company silo if available
        let dataDir = paths.data;
        if (activeCompanyId && activeCompanyId !== 'default') {
            dataDir = path.join(paths.data, activeCompanyId);
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        }

        const DB_PATH = path.join(dataDir, 'active_db.sqlite');
        const tempRestorePath = path.join(dataDir, 'restore_temp.sqlite');

        // Check if it's a plain SQLite file or encrypted
        const fd = fs.openSync(backupFilePath, 'r');
        const header = Buffer.alloc(16);
        fs.readSync(fd, header as any, 0, 16, 0);
        fs.closeSync(fd);

        if (header.toString().startsWith('SQLite format 3')) {
            console.log(`[IPC] Restoring plain SQLite file...`);
            fs.copyFileSync(backupFilePath, tempRestorePath);
        } else {
            console.log(`[IPC] Decrypting Secure SQLite Archive...`);

            // --- FORMAT GUARD: Detect CryptoJS/Base64 text files before attempting binary decryption ---
            const formatCheckBuf = Buffer.alloc(256);
            const formatFd = fs.openSync(backupFilePath, 'r');
            const bytesRead = fs.readSync(formatFd, formatCheckBuf as any, 0, 256, 0);
            fs.closeSync(formatFd);
            const sampleBytes = formatCheckBuf.slice(0, bytesRead);
            const isBase64TextFormat = sampleBytes.every((b: number) => b >= 32 && b <= 126);
            if (isBase64TextFormat) {
                throw new Error("This backup was created with the legacy PIN-based format. Please use the 'Import Data' option with your original PIN to restore this file.");
            }

            // Try decryption with provided key, stored license key, or fall back to machineId.
            let dbLicenseKey = '';
            if (db) {
                try {
                    const row = db.prepare('SELECT value FROM store WHERE key = ?').get('app_license_data') as { value: string };
                    if (row) {
                        const data = JSON.parse(row.value);
                        dbLicenseKey = data.key || '';
                        console.log(`[IPC] Extracted license identity for fallback: ${dbLicenseKey.substring(0, 4)}...`);
                    }
                } catch (e) {}
            }

            const machineId = await getInternalMachineId();
            const keysToTry = [];
            if (typeof arg === 'object' && arg.encryptionKey) keysToTry.push(arg.encryptionKey);
            if (dbLicenseKey) keysToTry.push(dbLicenseKey);
            keysToTry.push('INITIAL_PMS_KEY'); // Universal safety fallback
            keysToTry.push(machineId);

            let success = false;
            // Filter out empty keys and trim them to ensure exact matching
            const sanitizedKeys = Array.from(new Set(keysToTry.filter(k => !!k).map(k => k.trim())));
            
            for (const key of sanitizedKeys) {
                console.log(`[IPC] Attempting decryption with: ${key === machineId ? 'Machine ID' : (key === dbLicenseKey ? 'License Identity' : (key === 'INITIAL_PMS_KEY' ? 'Safety Fallback' : 'Provided PIN'))}...`);
                
                const tryDecrypt = async (k: string): Promise<boolean> => {
                    return new Promise((resolve) => {
                        try {
                            const derivedKey = crypto.scryptSync(k, 'salt', 32) as any;
                            const iv = Buffer.alloc(16, 0) as any;
                            const decipher = crypto.createDecipheriv('aes-256-cbc' as any, derivedKey, iv);
                            const input = fs.createReadStream(backupFilePath);
                            const output = fs.createWriteStream(tempRestorePath);

                            const onError = (err: Error) => {
                                console.warn(`[IPC] Decryption attempt failed: ${err.message}`);
                                try { output.destroy(); } catch (_) {}
                                try { if (fs.existsSync(tempRestorePath)) fs.unlinkSync(tempRestorePath); } catch (_) {}
                                resolve(false);
                            };

                            input.on('error', onError);
                            decipher.on('error', onError);
                            output.on('error', onError);
                            output.on('finish', () => resolve(true));

                            input.pipe(decipher).pipe(output);
                        } catch (e) {
                            resolve(false);
                        }
                    });
                };

                success = await tryDecrypt(key);
                if (success) {
                    console.log(`[IPC] Decryption successful with ${key === machineId ? 'Machine ID' : 'Provided Key'}.`);
                    break;
                }
            }

            if (!success) {
                throw new Error("Decryption failed. Invalid key or unauthorized hardware.");
            }
            
            // Final safety check: ensure the temp file actually exists before proceeding
            if (!fs.existsSync(tempRestorePath)) {
                throw new Error("Restoration Error: Decrypted temporary file not found on disk.");
            }
        }

        // 1. Open the restored database as a source
        const sourceDb = new Database(tempRestorePath);
        
        // 2. Read all rows from the source store
        const rows = sourceDb.prepare('SELECT key, value FROM store').all() as { key: string, value: string }[];
        console.log(`[IPC] Read ${rows.length} rows from backup file.`);
        
        try {
            const logMsg = `[${new Date().toISOString()}] Restore: Read ${rows.length} rows. DB_PATH: ${DB_PATH}\n`;
            const fs = require('fs');
            const path = require('path');
            fs.appendFileSync(path.join(require('electron').app.getPath('userData'), 'restore_log.txt'), logMsg);
        } catch (e) {}
        
        // 3. Define keys to exclude (License and User management)
        const excludedKeys = [
            'app_license_secure', 
            'app_license_data', 
            'app_users', 
            'app_machine_id', 
            'app_developer_secure',
            'app_data_size'
        ];
        
        // 4. Ensure active database is open
        console.log(`[IPC] Restoring into database path: ${DB_PATH}`);
        if (!db) {
            db = new Database(DB_PATH, { timeout: 15000 });
            db.pragma('journal_mode = WAL');
        }
        
        // 4.5 Check for Company Name conflict
        const backupProfileRow = rows.find(r => r.key === 'company_profile');
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
                        return { success: false, error: `Data restoration failed due to conflict in Company Name. Backup belongs to '${backupName}', but active company is '${activeName}'.` };
                    }
                }
            } catch (e) {
                console.warn('[IPC] Failed to parse company profile for name check:', e);
            }
        }
        
        // 5. Merge rows into active database, skipping excluded keys
        const upsertStmt = db.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
        
        db.transaction(() => {
            for (const row of rows) {
                if (!excludedKeys.includes(row.key)) {
                    upsertStmt.run(row.key, row.value);
                }
            }
        })();
        
        // 6. Clean up
        sourceDb.close();
        fs.unlinkSync(tempRestorePath);

        console.log(`[IPC] restoration successful.`);
        return { success: true };
    } catch (e: any) {
        console.error('[IPC] restoration failed:', e);
        if (!db && appBasePath) initializeDatabase(appBasePath);
        return { success: false, error: e.message };
    }
});

async function getInternalMachineId() {
    try {
        const output = execSync('wmic csproduct get uuid', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).toString();
        const lines = output.split(/\r?\n/).filter((line: string) => line.trim() && !line.includes('UUID'));
        if (lines.length > 0 && lines[0].trim()) return lines[0].trim();
    } catch (e) { }

    try {
        const psOutput = execSync('powershell.exe -NoProfile -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).toString();
        if (psOutput && psOutput.trim()) return psOutput.trim();
    } catch (e) { }

    return 'FALLBACK-MACHINE-ID-SECURE';
}

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

                    // --- V02.02.40: BINARY INTEGRITY CHECK ---
                    // Verify the file is actually a Windows Executable (MZ Header)
                    try {
                        const buffer = new Uint8Array(2);
                        const fd = fs.openSync(dest, 'r');
                        fs.readSync(fd, buffer, 0, 2, 0);
                        fs.closeSync(fd);
                        if (String.fromCharCode(buffer[0], buffer[1]) !== 'MZ') {
                            console.error('❌ Security Violation: Downloaded file is not a valid Windows Executable.');
                            fs.unlinkSync(dest);
                            resolve({ success: false, error: 'INVALID_BINARY_TYPE' });
                            return;
                        }
                    } catch (e) {
                        console.error('❌ Failed to verify binary header:', e);
                    }

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

ipcMain.handle('backup-and-install', (_, options?: { silent?: boolean }) => {
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

            // B. Snapshot/Backup
            try {
                if (appBasePath) {
                    const paths = getAppPaths(appBasePath);
                    const snapshotDir = path.join(paths.backups, `v${app.getVersion()}_SAFETY_BACKUP`);
                    if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });
                    
                    const dbFile = path.join(paths.data, 'active_db.sqlite');
                    if (fs.existsSync(dbFile)) {
                        fs.copyFileSync(dbFile, path.join(snapshotDir, 'active_db_snapshot.sqlite'));
                    }
                }
            } catch (backupErr) {
                console.warn('⚠️ Safety backup skipped:', backupErr);
            }

            // C. POWER LAUNCH: Wait 2s -> Kill BPP_APP -> Launch Installer
            // This ensures no 'Already Running' warning pops up.
            try {
                // Determine binary name for taskkill
                const exeName = app.isPackaged ? 'BPP_APP.exe' : 'electron.exe';
                
                // Chain: Delay -> Taskkill -> Delay -> Start Installer
                const command = `timeout /t 2 /nobreak && taskkill /F /IM ${exeName} /T & timeout /t 1 /nobreak & start "" "${installerPath}" ${isSilent ? '/S' : ''}`;
                
                spawn('cmd', ['/c', command], {
                    detached: true,
                    stdio: 'ignore',
                    windowsHide: true,
                    shell: true
                }).unref();
                
                console.log('🚀 Defensive sequence triggered via CMD.');
            } catch (launchErr) {
                console.error('🚀 Primary launch failed, trying fallback:', launchErr);
                shell.openPath(installerPath);
            }

            // D. FINAL EXIT
            app.exit(0);

        } catch (err) {
            console.error('❌ Critical failure in relauncher:', err);
            app.exit(1);
        }
    })();

    return { success: true };
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
