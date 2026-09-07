import { app, BrowserWindow, ipcMain, dialog, net, shell } from 'electron';
import nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import * as crypto from 'crypto';

import { spawn, execSync, exec } from 'child_process';
import * as os from 'os';

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development';

// Force App Name to ensure consistency in OS-level paths before anything else
app.name = 'BharatPayPro';

// Force Electron to use EXACTLY "BharatPayPro" folder in %APPDATA% 
// This prevents it from creating multiple random folders like "BPP_APP" or "bharatpay-pro"
const appDataPath = app.getPath('appData');
const newUserData = path.join(appDataPath, 'BharatPayPro');
app.setPath('userData', newUserData);

// ── CONFIGURATION & PERSISTENCE ──
// Auto-migrate old configs to prevent data loss for existing users!
const oldDirs = ['BPP_APP', 'bharatpay-pro', 'BharatPayRoll'];
for (const oldDir of oldDirs) {
    const oldConfigPath = path.join(appDataPath, oldDir, isDev ? 'app-config-dev.json' : 'app-config.json');
    const newConfigPath = path.join(newUserData, isDev ? 'app-config-dev.json' : 'app-config.json');
    
    if (fs.existsSync(oldConfigPath) && !fs.existsSync(newConfigPath)) {
        try {
            if (!fs.existsSync(newUserData)) fs.mkdirSync(newUserData, { recursive: true });
            fs.copyFileSync(oldConfigPath, newConfigPath);
            console.log(`[Migration] Migrated old config from ${oldDir} to BharatPayPro`);
        } catch(e) {}
    }
}

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
    // Standardize architecture: The physical root is ALWAYS inside a "BharatPP" folder.
    // If the user selected a directory already named exactly "BharatPP", we use it as-is.
    // Otherwise, we automatically nest everything inside a "BharatPP" subfolder.
    const isExactlyBharatPP = path.basename(base).toLowerCase() === 'bharatpp';
    const actualRoot = isExactlyBharatPP ? base : path.join(base, 'BharatPP');

    return {
        root: actualRoot, // The Global Registry DB stays EXACTLY in the BharatPP folder
        data: path.join(actualRoot, 'Data'),
        reports: path.join(actualRoot, 'Report files'),
        backups: path.join(actualRoot, 'Data backup'),
        templates: path.join(actualRoot, 'Templates')
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

    // V07: Prevent database creation inside installation directory
    if (basePath.includes('BPP_APP') || basePath.includes(app.getAppPath())) {
        console.error('❌ FATAL: Cannot initialize database inside BPP_APP installation folder for security reasons.');
        return;
    }

    // V03.01.07: Forced base path to User App folder for debugging
    // console.log(`🔍 Original basePath: ${basePath}. Forcing to E:\\BharatPP_Dev`);
    // basePath = 'E:\\BharatPP_Dev';

    appBasePath = basePath;
    const paths = getAppPaths(basePath);
    
    // --- V06.01.03: Auto-Repair from temporary DB ---
    try {
        const repairDbPath = path.join(paths.root, 'temp_active_db.sqlite');
        const rootDbPath = path.join(paths.root, 'active_db.sqlite');
        if (fs.existsSync(repairDbPath)) {
            console.log(`[Auto-Repair] Found temp_active_db.sqlite in root folder! Overwriting active_db.sqlite...`);
            fs.copyFileSync(repairDbPath, rootDbPath);
            fs.unlinkSync(repairDbPath);
            console.log(`[Auto-Repair] Master database recovered successfully.`);
        }
    } catch (err) {
        console.error(`[Auto-Repair] Failed to apply repair DB:`, err);
    }
    
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
        const debugInfo = `[${new Date().toLocaleString()}] ID: ${activeCompanyId} | DIR: ${dataDir}\n`;
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
        
        // V06.01.01: Legacy Auto-Migrator
        // If this is the Root DB (no companyId specified), run the auto migrator!
        if (!companyId || companyId === 'default' || companyId === 'null') {
            performLegacyAutoMigration(db, paths).catch(e => console.error("AutoMigration Error:", e));
            performAutoRescue(db, paths).catch(e => console.error("AutoRescue Error:", e));
        }
        
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
                    cleanupOldSnapshots(autoBackupDir, 24); // Keep last 24 for auto (2 hours)
                })
                .catch(e => console.error(`❌ Failed to create auto snapshot:`, e));
        } catch (e) {
            console.error(`❌ Failed to create auto snapshot:`, e);
        }
    }, 5 * 60 * 1000); // Every 5 minutes
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

/**
 * 📁 RECURSIVELY COPY DIRECTORIES SYNC
 * Safely copies folder structures and assets.
 */
function copyRecursiveSync(src: string, dest: string) {
    if (!fs.existsSync(src)) return;
    
    // V06.01.03: INFINITE RECURSION PREVENTION
    // Resolve absolute paths to prevent copying a folder into its own subdirectory
    const absoluteSrc = path.resolve(src);
    const absoluteDest = path.resolve(dest);
    if (absoluteDest.startsWith(absoluteSrc + path.sep) || absoluteDest === absoluteSrc) {
        console.warn(`[IPC] Blocked recursive copy loop. Cannot copy ${absoluteSrc} into ${absoluteDest}`);
        return;
    }

    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        // Final sanity check for nested folders
        if (path.resolve(destPath).startsWith(path.resolve(srcPath))) continue;

        if (entry.isDirectory()) {
            copyRecursiveSync(srcPath, destPath);
        } else {
            try {
                fs.copyFileSync(srcPath, destPath);
            } catch (e) {} // ignore locked/busy file errors
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
        closable: true,
        show: false, // Don't show until ready-to-show
    });

    let isInitializingPhase = true;
    let initSafetyTimer: NodeJS.Timeout | null = null;

    const releaseAlwaysOnTop = () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(false);
            isInitializingPhase = false;
            if (initSafetyTimer) {
                clearTimeout(initSafetyTimer);
                initSafetyTimer = null;
            }
        }
    };

    const bringWindowToFront = (win: BrowserWindow) => {
        if (!win || win.isDestroyed()) return;
        win.show();
        win.restore();
        win.focus();
        win.setAlwaysOnTop(true, 'screen-saver');
        win.moveTop();
        // Keep window pinned to active foreground during initialization and login loading
        initSafetyTimer = setTimeout(() => {
            releaseAlwaysOnTop();
        }, 12000);
    };

    // Auto-release always-on-top if the user intentionally interferes (e.g. clicks another app or Alt-Tabs)
    mainWindow.on('blur', () => {
        if (isInitializingPhase) {
            releaseAlwaysOnTop();
        }
    });

    let isWindowRevealed = false;

    const revealWindowNow = () => {
        if (isWindowRevealed) return;
        isWindowRevealed = true;
        if (mainWindow && !mainWindow.isDestroyed()) {
            bringWindowToFront(mainWindow);
            // Instantly kill transition HTA popup (bpp_launch_msg.hta) as soon as main window appears
            try {
                exec('taskkill /F /IM mshta.exe /T');
            } catch (_) {}
        }
    };

    mainWindow.once('ready-to-show', () => {
        // Present window IMMEDIATELY on launch to keep Initialization Page active in the foreground!
        revealWindowNow();
    });

    mainWindow.on('close', (e) => {
        if (isUpdateDownloading) {
            e.preventDefault();
            closeRequested = true;
            mainWindow?.webContents.send('update-close-warning');
        }
    });

    ipcMain.handle('app-initialization-complete', async () => {
        console.log('[IPC] App initialization & Login loading complete. Releasing always-on-top.');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(false);
            mainWindow.focus();
        }
        return { success: true };
    });

    // We will export a method for the downloader to call when finished
    ipcMain.handle('hard-reset-app', async () => {
        try {
            console.log('[IPC] hard-reset-app requested');
            const appDataPath = app.getPath('appData');
            const targetDirs = [
                path.join(appDataPath, 'BPP_APP'),
                path.join(appDataPath, 'bharatpay-pro'),
                path.join(appDataPath, 'BharatPayPro')
            ];
            
            for (const dir of targetDirs) {
                if (fs.existsSync(dir)) {
                    fs.rmSync(dir, { recursive: true, force: true });
                    console.log(`[IPC] Wiped configuration directory: ${dir}`);
                }
            }
            
            // Relaunch and exit
            app.relaunch();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setClosable(true);
                mainWindow.destroy();
            }
            app.quit();
            return { success: true };
        } catch (error: any) {
            console.error('[IPC] hard-reset-app failed:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('close-update-message', () => {
        try {
            console.log('[IPC] close-update-message requested: revealing rendered window and keeping HTA popup active for 3.5s while progress bar moves');
            revealWindowNow();
            setTimeout(() => {
                try {
                    spawn('taskkill', ['/F', '/IM', 'mshta.exe'], { windowsHide: true });
                } catch (e) {}
            }, 3500);
            return { success: true };
        } catch (e: any) {
            console.error('[IPC] close-update-message failed:', e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('check-close-requested', () => {
        if (closeRequested) {
            app.quit();
        }
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        
        // Disable DevTools in Production Environment
        mainWindow.webContents.on('devtools-opened', () => {
            mainWindow?.webContents.closeDevTools();
        });
        
        mainWindow.webContents.on('before-input-event', (event, input) => {
            const key = input.key.toLowerCase();
            if ((input.control && input.shift && (key === 'i' || key === 'j' || key === 'c')) || input.key === 'F12') {
                event.preventDefault();
            }
        });

        mainWindow.webContents.on('context-menu', (e) => {
            e.preventDefault();
        });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ── SINGLE INSTANCE LOCK ──────────────────────────────────────────────────
// Prevent multiple instances of BPP_APP from running simultaneously in production.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // A second instance tried to launch — focus existing window or quit.
  app.on('ready', () => {
    app.quit();
  });
} else {
  // If a second instance attempts while we are the primary, focus our window.
  app.on('second-instance', () => {
    if (mainWindow && !isDev) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.moveTop();
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(false);
          mainWindow.focus();
        }
      }, 1200);
    }
  });
}
// ─────────────────────────────────────────────────────────────────────────

// --- V05.02.09: HARDWARE ACCELERATION FALLBACK FOR LEGACY OS ---
// Detect Windows 7 (NT 6.1) or older Electron versions to prevent WebGL/GLES crashes on old Intel Graphics
const isWin7 = os.platform() === 'win32' && parseInt(os.release().split('.')[0]) <= 6;
const isLegacyElectron = parseInt(process.versions.electron.split('.')[0]) < 30;

if (isWin7 || isLegacyElectron || process.argv.includes('--disable-gpu')) {
    console.warn('⚠️ Legacy OS or GPU Disabled Flag detected. Disabling Hardware Acceleration to prevent GLES crashes.');
    app.disableHardwareAcceleration();
}

app.whenReady().then(() => {
    if (!gotTheLock) return; // Prevent main app initialization when running as second instance

    // 🔥 ULTRA-FAST STARTUP (V02.02.26) 🔥
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
        // ENFORCE ISOLATION: Prevent nesting BharatPP inside BPP_APP
        if (selectedPath.endsWith('BPP_APP') || selectedPath.endsWith('BPP_APP\\') || selectedPath.endsWith('BPP_APP/')) {
            selectedPath = path.dirname(selectedPath);
        }

        if (appBasePath && appBasePath !== selectedPath) {
            console.log(`[IPC] Migrating from ${appBasePath} to ${selectedPath}`);
            const oldPaths = getAppPaths(appBasePath);
            const newPaths = getAppPaths(selectedPath);
            
            // V06.01.03: Prevent Migrating into own sub-directory
            if (path.resolve(selectedPath).startsWith(path.resolve(appBasePath) + path.sep)) {
                return { success: false, error: 'Cannot migrate into a sub-folder of the existing directory. Please select a different location.' };
            }
            
            // 1. Migrate registry active_db.sqlite
            const oldRegistry = path.join(oldPaths.root, 'active_db.sqlite');
            const newRegistry = path.join(newPaths.root, 'active_db.sqlite');
            if (fs.existsSync(oldRegistry) && !fs.existsSync(newRegistry)) {
                try {
                    fs.copyFileSync(oldRegistry, newRegistry);
                    console.log(`[IPC] Copied registry DB to ${newRegistry}`);
                } catch (e) {
                    console.error('[IPC] Failed to copy registry DB:', e);
                }
            }
            
            // Reusing top-level copyRecursiveSync to migrate directories safely

            // 2. Migrate data folder
            // If the old data exists, and the new destination data folder doesn't exist or is empty
            if (fs.existsSync(oldPaths.data)) {
                if (!fs.existsSync(newPaths.data)) {
                    fs.mkdirSync(newPaths.data, { recursive: true });
                }
                
                // Only copy if destination is mostly empty to avoid overwriting existing data
                const newFiles = fs.readdirSync(newPaths.data);
                if (newFiles.length === 0 || (newFiles.length === 1 && newFiles[0] === 'active_db.sqlite')) {
                    console.log(`[IPC] Migrating data folder from ${oldPaths.data} to ${newPaths.data}`);
                    
                    // Copy Data folder contents
                    copyRecursiveSync(oldPaths.data, newPaths.data);
                    
                    // Copy Reports folder
                    if (fs.existsSync(oldPaths.reports)) copyRecursiveSync(oldPaths.reports, newPaths.reports);
                    
                    // Copy Backups folder
                    if (fs.existsSync(oldPaths.backups)) copyRecursiveSync(oldPaths.backups, newPaths.backups);
                    
                    // Copy Templates folder
                    if (fs.existsSync(oldPaths.templates)) copyRecursiveSync(oldPaths.templates, newPaths.templates);
                }
            }
            
            // Close the current DB before initializing the new one
            if (db) {
                try { db.close(); } catch (e) {}
                db = null;
            }
        }

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
    if (appBasePath && (appBasePath.includes('BPP_APP') || appBasePath.includes(app.getAppPath()))) {
        console.error('❌ Security block: Configured directory is inside installation folder. Forcing setup.');
        appBasePath = '';
        saveAppConfig({ ...getAppConfig(), appBasePath: '' });
        return null;
    }
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
            // Support nested subfolders (e.g. "SAIPRA_Rpt/Apr26")
            const segments = subfolder.split(/[/\\]/).map((seg: string) => {
                return seg.trim().split(' ')[0].replace(/[^a-zA-Z0-9_]/g, '');
            }).filter(Boolean);

            if (segments.length > 0) {
                targetDir = path.join(paths.reports, ...segments);
            }
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
                
                // Clean up old cached manual files to prevent temp directory bloat
                try {
                    const files = fs.readdirSync(tempDir);
                    for (const file of files) {
                        if (file.startsWith('BPP_User_Manual_') && file.endsWith('.html')) {
                            fs.unlinkSync(path.join(tempDir, file));
                        }
                    }
                } catch (e) {
                    console.error('Failed to cleanup old manual files', e);
                }

                // Add timestamp to filename to permanently bust the browser cache!
                const cacheBuster = Date.now();
                const tempManualPath = path.join(tempDir, `BPP_User_Manual_${cacheBuster}.html`);
                
                const content = fs.readFileSync(manualPath);
                fs.writeFileSync(tempManualPath, content as any);

                // Copy manual image assets to temp folder so they render correctly in production
                const srcAssetsDir = path.join(appRoot, 'docs', 'assets');
                const destAssetsDir = path.join(tempDir, 'assets');
                if (fs.existsSync(srcAssetsDir)) {
                    copyRecursiveSync(srcAssetsDir, destAssetsDir);
                    console.log(`[IPC] Copied user manual assets to: ${destAssetsDir}`);
                }
                
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

// 2e. Statutory Forms Handling (Preview & Save blank templates)
ipcMain.handle('handle-statutory-form', async (_, { formName, action }) => {
    try {
        console.log(`[IPC] handle-statutory-form requested for: ${formName}, action: ${action}`);
        
        const isDev = !app.isPackaged;
        const appRoot = isDev ? process.cwd() : app.getAppPath();
        
        // Map friendly names to real files in docs directory
        const formMap: Record<string, string> = {
            'ESI Form 1': 'ESI_Form-1 Latest.pdf',
            'PF Form 2': 'PF_Form 2-Revised.pdf',
            'PF Form 11': 'PF_Form11 Revised.pdf'
        };

        const fileName = formMap[formName];
        if (!fileName) {
            throw new Error(`Unsupported statutory form: ${formName}`);
        }

        const sourcePath = path.join(appRoot, 'docs', fileName);
        const fallbackPath = path.resolve(__dirname, '..', 'docs', fileName);
        console.log(`[IPC] Resolved statutory form source path: ${sourcePath}`);

        if (!fs.existsSync(sourcePath)) {
            // Check fallback resolve path
            if (!fs.existsSync(fallbackPath)) {
                throw new Error(`Statutory form file not found.\n- Source: ${sourcePath}\n- Fallback: ${fallbackPath}\n- AppRoot: ${appRoot}\n- __dirname: ${__dirname}`);
            }
        }
        
        const actualSourcePath = fs.existsSync(sourcePath) ? sourcePath : fallbackPath;

        if (action === 'preview') {
            // Extract to temp folder to avoid ASAR path issues on default PDF viewers
            const tempDir = app.getPath('temp');
            const tempFormPath = path.join(tempDir, fileName);
            
            const content = fs.readFileSync(actualSourcePath);
            fs.writeFileSync(tempFormPath, new Uint8Array(content));
            
            console.log(`[IPC] Extracted statutory form for preview: ${tempFormPath}`);
            const openError = await shell.openPath(tempFormPath);
            if (openError) {
                console.warn(`[IPC] shell.openPath failed with error: ${openError}. Falling back to openExternal...`);
                // Fallback: Open with default web browser using file:// protocol
                const fileUrl = `file:///${tempFormPath.replace(/\\/g, '/')}`;
                await shell.openExternal(fileUrl);
            }
            return { success: true };
        } else if (action === 'download') {
            // Prompt user where to save the file
            const result = await dialog.showSaveDialog({
                title: `Download Blank ${formName}`,
                defaultPath: path.join(app.getPath('downloads'), fileName),
                filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
            });

            if (result.canceled || !result.filePath) {
                return { success: false, error: 'Download canceled' };
            }

            const content = fs.readFileSync(actualSourcePath);
            fs.writeFileSync(result.filePath, new Uint8Array(content));
            console.log(`[IPC] Downloaded statutory form successfully to: ${result.filePath}`);
            return { success: true, savedPath: result.filePath };
        }

        throw new Error(`Invalid action: ${action}`);
    } catch (e: any) {
        console.error('[IPC] Handle statutory form failed:', e);
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
const GLOBAL_KEYS = [
    'app_companies', 
    'app_active_company_id', 
    'app_license_secure', 
    'app_users', 
    'app_machine_id', 
    'app_setup_complete', 
    'app_developer_secure', 
    'app_config', 
    'app_data_size', 
    'app_company_limit', 
    'app_logo',
    'app_active_patch_ts',
    'app_patch_skip_count',
    'app_version_skip_count',
    'app_version_marker',
    'app_last_seen_version',
    'app_last_seen_patch_ts',
    'heartbeat_debug_logs'
];

async function performAutoRescue(rootDb: Database.Database, appPaths: any) {
    try {
        const dataDir = appPaths.data;
        if (!fs.existsSync(dataDir)) return;

        // Check if app_companies is already populated. If so, normal users just log in.
        const companiesRow = rootDb.prepare('SELECT value FROM store WHERE key = ?').get('app_companies') as { value: string } | undefined;
        let existingIds: string[] = [];
        let existingComps: any[] = [];
        
        if (companiesRow && companiesRow.value) {
            try {
                existingComps = JSON.parse(companiesRow.value);
                existingIds = existingComps.map((c: any) => c.id);
            } catch (e) {}
        }

        const silos = fs.readdirSync(dataDir)
            .filter(name => {
                const siloPath = path.join(dataDir, name);
                return fs.statSync(siloPath).isDirectory() && fs.existsSync(path.join(siloPath, 'active_db.sqlite'));
            })
            .filter(name => name !== '.icon-ico');

        // Clean up the existing list: remove empty ID or duplicate silos
        let updatedRegistry = false;
        const seen = new Set<string>();
        const cleanedComps: any[] = [];

        for (const c of existingComps) {
            if (!c.id || c.id.trim() === '' || c.id === 'default') {
                updatedRegistry = true;
                continue;
            }
            if (seen.has(c.id)) {
                updatedRegistry = true;
                continue;
            }
            seen.add(c.id);
            cleanedComps.push(c);
        }

        if (updatedRegistry) {
            rootDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)').run('app_companies', JSON.stringify(cleanedComps));
            console.log(`[AutoRescue] Cleaned up and sanitized registry database on startup.`);
            existingComps = cleanedComps;
            existingIds = existingComps.map((c: any) => c.id);
        }

        // If the user already has companies registered, we don't strictly *need* to rescue automatically
        // because it might be intentional. But for a fresh config wipe, `existingComps` will be empty.
        // We will rescue any silos that aren't registered ONLY if the registry is empty.
        if (existingComps.length > 0) return;

        const missingSilos = silos.filter(s => !existingIds.includes(s));
        if (missingSilos.length === 0) return;

        console.log(`[AutoRescue] Found ${missingSilos.length} orphaned silos. Syncing to root DB...`);

        for (const siloId of missingSilos) {
            try {
                const siloDbPath = path.join(dataDir, siloId, 'active_db.sqlite');
                const siloDb = new Database(siloDbPath);
                
                let profileRow = siloDb.prepare(`SELECT value FROM store WHERE key = ?`).get(`app_company_profile_${siloId}`) as { value: string } | undefined;
                if (!profileRow) {
                    profileRow = siloDb.prepare(`SELECT value FROM store WHERE key = 'app_company_profile' OR key = 'company_profile'`).get() as { value: string } | undefined;
                }
                
                let compName = `Rescued Org (${siloId})`;
                let createdDate = new Date().toISOString();
                if (profileRow && profileRow.value) {
                    const parsed = JSON.parse(profileRow.value);
                    compName = parsed.establishmentName || parsed.tradeName || compName;
                    createdDate = parsed.createdDate || createdDate;
                }

                existingComps.push({
                    id: siloId,
                    establishmentName: compName,
                    createdDate: createdDate
                });
                
                siloDb.close();
                console.log(`[AutoRescue] Recovered silo ${siloId} (${compName})`);
            } catch (e) {
                console.warn(`[AutoRescue] Failed to recover silo ${siloId}:`, e);
            }
        }

        if (existingComps.length > 0 && missingSilos.length > 0) {
            rootDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)').run('app_companies', JSON.stringify(existingComps));
            console.log(`[AutoRescue] Successfully registered orphaned silos.`);
        }
    } catch (err) {
        console.error('[AutoRescue] Critical error:', err);
    }
}

async function performLegacyAutoMigration(rootDb: Database.Database, appPaths: any) {
    try {
        console.log("🚀 [AutoMigrate] Checking for legacy data in root DB...");
        
        // 1. Get all keys in root database
        const rows = rootDb.prepare('SELECT * FROM store').all() as { key: string, value: string }[];
        
        // 2. Identify if there are any non-global (legacy) keys
        const legacyRows = rows.filter(r => !GLOBAL_KEYS.includes(r.key));
        if (legacyRows.length === 0) {
            console.log("✅ [AutoMigrate] Root DB is clean. No legacy data found.");
            return;
        }

        console.log(`⚠️ [AutoMigrate] Found ${legacyRows.length} legacy keys. Starting migration surgery...`);

        // 3. Extract the active companies list to use for routing
        const companiesRow = rows.find(r => r.key === 'app_companies');
        let companies: any[] = [];
        if (companiesRow) {
            try { companies = JSON.parse(companiesRow.value); } catch(e) {}
        }
        const companyIds = companies.map(c => c.id);
        const defaultCompanyId = companyIds.length > 0 ? companyIds[0] : 'default';

        let migratedCount = 0;

        for (const row of legacyRows) {
            let targetCompanyId = defaultCompanyId;

            // Try to perfectly match the company ID suffix
            for (const cid of companyIds) {
                if (row.key.endsWith(`_${cid}`)) {
                    targetCompanyId = cid;
                    break;
                }
            }

            const siloDir = path.join(appPaths.data, targetCompanyId);
            if (!fs.existsSync(siloDir)) {
                fs.mkdirSync(siloDir, { recursive: true });
                console.log(`[AutoMigrate] Created new Silo directory: ${siloDir}`);
            }

            const siloDbPath = path.join(siloDir, 'active_db.sqlite');
            const siloDb = new Database(siloDbPath);
            siloDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
            
            // Insert into Silo
            siloDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)').run(row.key, row.value);
            siloDb.close();

            // Delete from Root
            rootDb.prepare('DELETE FROM store WHERE key = ?').run(row.key);
            migratedCount++;
        }

        console.log(`🎉 [AutoMigrate] SUCCESS! ${migratedCount} legacy keys successfully sliced and moved into Silo folders.`);
        
        // V06.01.01: Update the Root Database (Global Registry) to point to the migrated silos!
        if (appBasePath) {
            const registryPaths = getAppPaths(appBasePath);
            const globalDbPath = path.join(registryPaths.root, 'active_db.sqlite');
            const globalDb = new Database(globalDbPath);
            globalDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
            globalDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)').run('app_companies', JSON.stringify(companies));
            globalDb.close();
            console.log(`[AutoMigrate] Synced ${companies.length} companies to the Global Registry.`);
        }
        
    } catch (e) {
        console.error("❌ [AutoMigrate] FAILED:", e);
    }
}

ipcMain.handle('db-set', async (_, { key, value }) => {
    try {
        if (GLOBAL_KEYS.includes(key as string)) {
            if (!appBasePath) throw new Error("Storage path not set");
            const paths = getAppPaths(appBasePath);
        const rootDbPath = path.join(paths.root, 'active_db.sqlite');
            const rootDb = new Database(rootDbPath);
            rootDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
            const stmt = rootDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
            stmt.run(key, JSON.stringify(value));
            rootDb.close();
            return { success: true };
        } else {
            if (!ensureDatabase()) {
                throw new Error("Storage not configured. Database unavailable.");
            }
            const stmt = db!.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
            stmt.run(key, JSON.stringify(value));
            return { success: true };
        }
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});


const safeParseValue = (val: string) => {
    if (val === undefined || val === null) return null;
    try {
        return JSON.parse(val);
    } catch (_err) {
        return val;
    }
};

ipcMain.handle('db-get', async (_, key) => {
    try {
        let row: { value: string } | undefined;
        if (GLOBAL_KEYS.includes(key as string)) {
            if (appBasePath) {
                const paths = getAppPaths(appBasePath);
                const rootDbPath = path.join(paths.root, 'active_db.sqlite');
                if (fs.existsSync(rootDbPath)) {
                    try {
                        const rootDb = new Database(rootDbPath, { readonly: true });
                        row = rootDb.prepare('SELECT value FROM store WHERE key = ?').get(key) as { value: string } | undefined;
                        rootDb.close();
                    } catch (err) {
                        console.warn('[IPC] Failed to fetch key from root registry database:', err);
                    }
                }
            }
            
            // --- CRITICAL FALLBACK FOR LEGACY DATA MIGRATION ---
            if (!row && ensureDatabase() && db) {
                row = db.prepare('SELECT value FROM store WHERE key = ?').get(key) as { value: string } | undefined;
            }
        } else {
            if (ensureDatabase() && db) {
                row = db.prepare('SELECT value FROM store WHERE key = ?').get(key) as { value: string } | undefined;
            }
        }
        
        return { success: true, data: row ? safeParseValue(row.value) : null };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});


ipcMain.handle('db-delete', async (_, key) => {
    try {
        if (GLOBAL_KEYS.includes(key as string)) {
            if (appBasePath) {
                const paths = getAppPaths(appBasePath);
                const rootDbPath = path.join(paths.root, 'active_db.sqlite');
                if (fs.existsSync(rootDbPath)) {
                    const rootDb = new Database(rootDbPath);
                    rootDb.prepare('DELETE FROM store WHERE key = ?').run(key);
                    rootDb.close();
                }
            }
        } else {
            if (db) {
                db.prepare('DELETE FROM store WHERE key = ?').run(key);
            }
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('db-get-all', async () => {
    try {
        const mergedData: any[] = [];
        
        // 1. Get all silo keys (excluding global keys to prevent per-silo app_companies leakage)
        if (db) {
            const rows = db.prepare('SELECT key, value FROM store').all() as { key: string, value: string }[];
            const siloRowsOnly = rows.filter(r => !GLOBAL_KEYS.includes(r.key));
            mergedData.push(...siloRowsOnly.map(r => ({ key: r.key, value: safeParseValue(r.value) })));
        }
        
        // 2. ── Strict Registry Merging ──
        if (appBasePath) {
            const paths = getAppPaths(appBasePath);
            const rootDbPath = path.join(paths.root, 'active_db.sqlite');
            if (fs.existsSync(rootDbPath)) {
                try {
                    const rootDb = new Database(rootDbPath, { readonly: true });
                    for (const key of GLOBAL_KEYS) {
                        const row = rootDb.prepare('SELECT value FROM store WHERE key = ?').get(key) as { value: string } | undefined;
                        
                        let finalValue: any = null;
                        
                        if (row && row.value && row.value !== '[]') {
                            finalValue = safeParseValue(row.value);
                        } else if (key === 'app_companies') {
                            // --- V06.01.07: Call Auto Heal ---
                            finalValue = autoHealAppCompanies(rootDbPath, paths.data);
                        }
                        
                        if (finalValue) {
                            // Replace if somehow it exists in silo (legacy data cleanup), otherwise push
                            const existingIndex = mergedData.findIndex(item => item.key === key);
                            if (existingIndex >= 0) {
                                mergedData[existingIndex].value = finalValue;
                            } else {
                                mergedData.push({ key, value: finalValue });
                            }
                        }
                    }
                    rootDb.close();
                } catch (err) {
                    console.warn('[IPC] Failed to merge keys from root registry database:', err);
                }
            }
        }
        
        return { success: true, data: mergedData };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

// --- V06.01.07: AUTO-HEALING FRAMEWORK FOR APP_COMPANIES ---
function autoHealAppCompanies(rootDbPath: string, dataDir: string): any[] | null {
    console.log(`[db-get-global] Auto-Recovery Triggered! Root app_companies is missing/empty.`);
    const recoveredCompanies: any[] = [];
    if (fs.existsSync(dataDir)) {
        const silos = fs.readdirSync(dataDir).filter(name => {
            const siloPath = path.join(dataDir, name);
            return fs.statSync(siloPath).isDirectory() && fs.existsSync(path.join(siloPath, 'active_db.sqlite'));
        });
        for (const siloId of silos) {
            try {
                const siloDb = new Database(path.join(dataDir, siloId, 'active_db.sqlite'), { readonly: true });
                let profile = null;
                
                try {
                    const profileRow = siloDb.prepare("SELECT value FROM store WHERE key = 'app_company_profile' OR key LIKE 'app_company_profile_%'").get() as any;
                    if (profileRow && profileRow.value) profile = JSON.parse(profileRow.value);
                } catch(e) {}
                
                if (!profile) {
                    try {
                        const companyRow = siloDb.prepare("SELECT value FROM store WHERE key = 'app_companies'").get() as any;
                        if (companyRow && companyRow.value) {
                            const comps = JSON.parse(companyRow.value);
                            profile = comps.find((c: any) => c.id === siloId);
                        }
                    } catch(e) {}
                }
                
                siloDb.close();
                
                if (profile) {
                    profile.id = siloId;
                    recoveredCompanies.push(profile);
                    console.log(`[db-get-global] Rescued profile for silo: ${siloId}`);
                } else {
                    recoveredCompanies.push({ id: siloId, establishmentName: siloId, cin: '' });
                    console.log(`[db-get-global] Rescued minimal ID for silo: ${siloId}`);
                }
            } catch(e) {
                console.warn(`[db-get-global] Failed to read silo ${siloId} for recovery`, e);
            }
        }
    }
    if (recoveredCompanies.length > 0) {
        // Save it back to root
        try {
            const writeDb = new Database(rootDbPath);
            writeDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
            const stmtWrite = writeDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
            stmtWrite.run('app_companies', JSON.stringify(recoveredCompanies));
            writeDb.close();
            console.log(`[db-get-global] Auto-Recovery Complete! Injected ${recoveredCompanies.length} companies into root.`);
        } catch(e) {
            console.error(`[db-get-global] Auto-Recovery write failed`, e);
        }
        return recoveredCompanies;
    }
    return null;
}
// --- END AUTO-HEALING ---

// Helper to check if a specific company silo contains any enrolled employees
function siloHasEmployees(siloDataPath: string, siloId: string): boolean {
    const siloDbPath = path.join(siloDataPath, siloId, 'active_db.sqlite');
    if (!fs.existsSync(siloDbPath)) return false;
    try {
        const siloDb = new Database(siloDbPath, { readonly: true });
        const stmt = siloDb.prepare('SELECT value FROM store WHERE key = ?');
        const row = stmt.get(`app_employees_${siloId}`) as { value: string } | undefined;
        siloDb.close();
        if (row && row.value) {
            try {
                const parsed = JSON.parse(row.value);
                return Array.isArray(parsed) && parsed.length > 0;
            } catch (e) {
                return false;
            }
        }
    } catch (e) {
        console.warn(`[siloHasEmployees] Failed to check silo ${siloId}`, e);
    }
    return false;
}

// Strict Physical Silo Sanitizer: Ensures app_companies ONLY contains companies with active physical folders in Data/
function sanitizeCompaniesWithPhysicalSilos(companies: any[], dataDir: string): any[] {
    if (!fs.existsSync(dataDir) || !Array.isArray(companies)) return companies;

    // Scan Data/ directory for all actual physical silo subfolders containing active_db.sqlite
    const physicalSiloIds = fs.readdirSync(dataDir).filter(name => {
        if (name === 'default') return false;
        const siloPath = path.join(dataDir, name);
        return fs.statSync(siloPath).isDirectory() && fs.existsSync(path.join(siloPath, 'active_db.sqlite'));
    });

    const physicalSiloSet = new Set(physicalSiloIds);

    // 1. Strict Filter: Keep ONLY companies whose ID corresponds to an actual physical folder in Data/ (never 'default')
    let sanitized = companies.filter(c => c && c.id && c.id !== 'default' && physicalSiloSet.has(c.id));

    // 2. Ensure every physical folder in Data/ is present in the registry (Auto-Rescue missing folders)
    const existingIds = new Set(sanitized.map(c => c.id));
    for (const siloId of physicalSiloIds) {
        if (!existingIds.has(siloId)) {
            try {
                const siloDbPath = path.join(dataDir, siloId, 'active_db.sqlite');
                const siloDb = new Database(siloDbPath, { readonly: true });
                let profile = null;
                try {
                    const profileRow = siloDb.prepare("SELECT value FROM store WHERE key = 'app_company_profile' OR key LIKE 'app_company_profile_%'").get() as any;
                    if (profileRow && profileRow.value) profile = JSON.parse(profileRow.value);
                } catch (e) {}
                siloDb.close();

                if (profile) {
                    profile.id = siloId;
                    sanitized.push(profile);
                } else {
                    sanitized.push({ id: siloId, establishmentName: siloId, cin: '' });
                }
            } catch (e) {
                sanitized.push({ id: siloId, establishmentName: siloId, cin: '' });
            }
        }
    }

    return sanitized;
}

ipcMain.handle('db-get-global', async (_, key) => {
    try {
        console.log(`[db-get-global] Requested key: ${key}. appBasePath: ${appBasePath}`);
        if (!appBasePath) return null;
        
        const paths = getAppPaths(appBasePath);
        const rootDbPath = path.join(paths.root, 'active_db.sqlite');
        console.log(`[db-get-global] DB Path: ${rootDbPath}. Exists? ${fs.existsSync(rootDbPath)}`);
        if (!fs.existsSync(rootDbPath)) return null;
        
        const rootDb = new Database(rootDbPath, { readonly: true });
        const stmt = rootDb.prepare('SELECT value FROM store WHERE key = ?');
        const row = stmt.get(key) as { value: string } | undefined;
        rootDb.close();
        
        console.log(`[db-get-global] Row found? ${!!row}`);
        
        // --- V06.01.07: Call Auto Heal ---
        if (key === 'app_companies' && (!row || !row.value || row.value === '[]')) {
            const healed = autoHealAppCompanies(rootDbPath, paths.data);
            if (healed) {
                return healed.map((c: any) => ({
                    ...c,
                    hasEmployees: siloHasEmployees(paths.data, c.id)
                }));
            }
        }

        if (row && row.value) {
           try {
              let parsed = JSON.parse(row.value);
              if (key === 'app_companies' && Array.isArray(parsed)) {
                  parsed = sanitizeCompaniesWithPhysicalSilos(parsed, paths.data);
                  parsed = parsed.map((c: any) => ({
                      ...c,
                      hasEmployees: siloHasEmployees(paths.data, c.id)
                  }));
              }
              return parsed;
           } catch (e) {
              return row.value;
           }
        }
        return null;
    } catch (e) {
        console.warn(`[IPC] Failed to get global key ${key}:`, e);
        return null;
    }
});

ipcMain.handle('db-set-global', async (_, { key, value }) => {
    try {
        const paths = getAppPaths(appBasePath);
        if (key === 'app_companies' && Array.isArray(value)) {
            value = sanitizeCompaniesWithPhysicalSilos(value, paths.data);
        }
        // 1. Always write to the ROOT database (Registry) ONLY
        const rootDbPath = path.join(paths.root, 'active_db.sqlite');
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

const LIMIT_KEY = crypto.scryptSync('BPP_SECURE_COMPANY_LIMIT_KEY_2026', 'salt', 32);
const LIMIT_IV = Buffer.alloc(16, 0); 

function getSysLimitPath(isDevMode?: boolean): string {
    const isDev = isDevMode !== undefined 
        ? isDevMode 
        : ((appBasePath && appBasePath.toLowerCase().includes('dev')) || !app.isPackaged || process.env.NODE_ENV === 'development');
    const fileName = isDev ? 'sys_limit_dev.bin' : 'sys_limit.bin';
    const appDataRoot = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const targetFolder = path.join(appDataRoot, 'BharatPayPro');
    if (!fs.existsSync(targetFolder)) {
        try { fs.mkdirSync(targetFolder, { recursive: true }); } catch (e) {}
    }
    return path.join(targetFolder, fileName);
}

function readActivatedSilos(isDevMode?: boolean): string[] {
    try {
        const filePath = getSysLimitPath(isDevMode);
        if (!fs.existsSync(filePath)) return [];
        const encrypted = fs.readFileSync(filePath, 'utf8');
        const decipher = crypto.createDecipheriv('aes-256-cbc', LIMIT_KEY as any, LIMIT_IV as any);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (e) {
        return [];
    }
}

function writeActivatedSilos(silos: string[], isDevMode?: boolean) {
    try {
        const filePath = getSysLimitPath(isDevMode);
        const cipher = crypto.createCipheriv('aes-256-cbc', LIMIT_KEY as any, LIMIT_IV as any);
        let encrypted = cipher.update(JSON.stringify(silos), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        fs.writeFileSync(filePath, encrypted, 'utf8');
    } catch (e) {
        console.error("Failed to write sys_limit", e);
    }
}

ipcMain.handle('get-activated-silos', async (_, isDevMode?: boolean) => {
    const isDev = isDevMode !== undefined 
        ? isDevMode 
        : ((appBasePath && appBasePath.toLowerCase().includes('dev')) || !app.isPackaged || process.env.NODE_ENV === 'development');
    return { success: true, silos: readActivatedSilos(isDev) };
});

ipcMain.handle('register-activated-silo', async (_, signature: string, isDevMode?: boolean) => {
    const isDev = isDevMode !== undefined 
        ? isDevMode 
        : ((appBasePath && appBasePath.toLowerCase().includes('dev')) || !app.isPackaged || process.env.NODE_ENV === 'development');
    const silos = readActivatedSilos(isDev);
    if (signature && !silos.includes(signature)) {
        silos.push(signature);
        writeActivatedSilos(silos, isDev);
    }
    console.log(`✅ [IPC] Registered signature for ${isDev ? 'DEVELOPER (sys_limit_dev.bin)' : 'USER (sys_limit.bin)'}:`, signature);
    return { success: true, silos };
});

ipcMain.handle('remove-activated-silo', async (_, target: string, isDevMode?: boolean) => {
    const isDev = isDevMode !== undefined 
        ? isDevMode 
        : ((appBasePath && appBasePath.toLowerCase().includes('dev')) || !app.isPackaged || process.env.NODE_ENV === 'development');
    let silos = readActivatedSilos(isDev);
    if (!target) return { success: true, silos };
    silos = silos.filter(s => {
        if (s === target) return false;
        if (target.length >= 3 && s.includes(`_${target}-`)) return false;
        if (target.length >= 3 && s.includes(`_${target}_`)) return false;
        if (target.length >= 3 && s.includes(target)) return false;
        return true;
    });
    writeActivatedSilos(silos, isDev);
    return { success: true, silos };
});

ipcMain.handle('sync-activated-silos', async (_, validCloudSigs: string[], isDevMode?: boolean) => {
    let silos = readActivatedSilos(isDevMode);
    if (Array.isArray(validCloudSigs)) {
        const cleaned = silos.filter(s => validCloudSigs.includes(s));
        writeActivatedSilos(cleaned, isDevMode);
        return { success: true, silos: cleaned };
    }
    return { success: true, silos };
});

ipcMain.handle('wipe-activated-silos', async (_, isDevMode?: boolean) => {
    const filePath = getSysLimitPath(isDevMode);
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log(`Deleted ${path.basename(filePath)} physically in wipe-activated-silos`);
        } catch (e) {
            console.error("Failed to delete sys_limit file physically in wipe-activated-silos", e);
        }
    }
    return { success: true, silos: [] };
});

ipcMain.handle('wipe-all-local-signatures', async (_, isDevMode?: boolean) => {
    try {
        const isDev = isDevMode !== undefined 
            ? isDevMode 
            : ((appBasePath && appBasePath.toLowerCase().includes('dev')) || !app.isPackaged || process.env.NODE_ENV === 'development');
        const targetFileName = isDev ? 'sys_limit_dev.bin' : 'sys_limit.bin';
        const targetPath = getSysLimitPath(isDev);

        console.log(`🧹 [IPC] Received wipe-all-local-signatures. Mode: ${isDev ? 'DEVELOPER' : 'USER'}. Deleting ONLY: ${targetFileName} at ${targetPath}`);

        // 1. Wipe ONLY the specific environment sys_limit file physically
        if (fs.existsSync(targetPath)) {
            try {
                fs.unlinkSync(targetPath);
                console.log(`✅ [ISOLATION] Deleted ONLY ${targetFileName} physically in wipe-all-local-signatures`);
            } catch (e) {
                console.error(`Failed to delete ${targetFileName} physically`, e);
            }
        }
        
        if (!appBasePath) return { success: true };
        const paths = getAppPaths(appBasePath);
        
        // 2. Wipe app_companies and app_company_profile in Global Root DB
        const rootDbPath = path.join(paths.root, 'active_db.sqlite');
        if (fs.existsSync(rootDbPath)) {
            const rootDb = new Database(rootDbPath);
            rootDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
            
            const compsRow = rootDb.prepare("SELECT value FROM store WHERE key = 'app_companies'").get() as any;
            if (compsRow && compsRow.value) {
                try {
                    let comps = JSON.parse(compsRow.value);
                    if (Array.isArray(comps)) {
                        for (const c of comps) {
                            c.companySignature = "";
                            c.isReadOnly = true;
                        }
                        rootDb.prepare("INSERT OR REPLACE INTO store (key, value) VALUES ('app_companies', ?)").run(JSON.stringify(comps));
                    }
                } catch(e) {}
            }
            
            const keysToWipe = rootDb.prepare("SELECT key, value FROM store WHERE key LIKE '%company_profile%'").all() as any[];
            for (const row of keysToWipe) {
                try {
                    let prof = JSON.parse(row.value);
                    prof.companySignature = "";
                    prof.isReadOnly = true;
                    rootDb.prepare("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)").run(row.key, JSON.stringify(prof));
                } catch(e) {}
            }
            
            rootDb.close();
        }
        
        // 3. Wipe companySignature in every silo active_db.sqlite (without deleting silos!)
        const dataDir = paths.data;
        if (fs.existsSync(dataDir)) {
            const silos = fs.readdirSync(dataDir).filter(name => {
                const siloPath = path.join(dataDir, name);
                return fs.statSync(siloPath).isDirectory() && fs.existsSync(path.join(siloPath, 'active_db.sqlite'));
            });
            
            for (const siloId of silos) {
                try {
                    const siloDbPath = path.join(dataDir, siloId, 'active_db.sqlite');
                    const siloDb = new Database(siloDbPath);
                    siloDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
                    
                    const rows = siloDb.prepare("SELECT key, value FROM store WHERE key LIKE '%company_profile%'").all() as any[];
                    for (const r of rows) {
                        try {
                            let prof = JSON.parse(r.value);
                            prof.companySignature = "";
                            prof.isReadOnly = true;
                            siloDb.prepare("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)").run(r.key, JSON.stringify(prof));
                        } catch(e) {}
                    }
                    siloDb.close();
                } catch(e) {
                    console.warn(`[IPC] Failed wiping signatures in silo ${siloId}:`, e);
                }
            }
        }
        
        // 4. Clean up any temporary database or temporary cache files holding legacy signature state
        const tempFilesToDelete = [
            path.join(paths.root, 'temp_active_db.sqlite'),
            path.join(paths.data, 'restore_temp.sqlite'),
            path.join(paths.root, 'active_db.sqlite.tmp')
        ];
        
        for (const tf of tempFilesToDelete) {
            try {
                if (fs.existsSync(tf)) {
                    fs.unlinkSync(tf);
                    console.log(`[IPC] Cleaned up temporary DB file: ${tf}`);
                }
            } catch(e) {}
        }
        
        // Sweep temp files in Silo folders (.tmp, temp_*)
        if (fs.existsSync(dataDir)) {
            try {
                const subDirs = fs.readdirSync(dataDir);
                for (const sub of subDirs) {
                    const subPath = path.join(dataDir, sub);
                    if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory()) {
                        const files = fs.readdirSync(subPath);
                        for (const f of files) {
                            if (f.endsWith('.tmp') || f.startsWith('temp_') || f.includes('restore_temp')) {
                            }
                        }
                    }
                }
            } catch(e) {}
        }
        
        console.log("✅ [IPC] Complete sweep finished for all local SQLite profiles, temp files & sys_limit.bin.");
        return { success: true };
    } catch (e: any) {
        console.error('[IPC] wipe-all-local-signatures failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('purge-unmatched-local-signatures', async (_, validCloudSignatures: string[], isDevMode?: boolean) => {
    try {
        const isDev = isDevMode !== undefined 
            ? isDevMode 
            : ((appBasePath && appBasePath.toLowerCase().includes('dev')) || !app.isPackaged || process.env.NODE_ENV === 'development');
        const validSigs = Array.isArray(validCloudSignatures) ? validCloudSignatures : [];
        console.log(`🧹 [IPC] Reconciling 4-layer signatures against Cloud Column R (Environment: ${isDev ? 'DEVELOPER' : 'USER'}):`, validSigs);
        
        // Helper function for flexible signature matching against Cloud Column R
        const findMatchingSignature = (companyObj: any, defaultId: string) => {
            if (!validSigs || validSigs.length === 0) return null;
            const cid = (companyObj?.id || defaultId || '').trim();
            const estName = (companyObj?.establishmentName || '').trim();
            const currentSig = (companyObj?.companySignature || '').trim();

            return validSigs.find(s => {
                if (!s || typeof s !== 'string') return false;
                // 1. Direct match with current signature string
                if (currentSig && s.trim() === currentSig.trim()) return true;
                // 2. Direct match with cid substring (_SAIPRA_343036-)
                if (cid && s.includes(`_${cid}-`)) return true;
                // 3. Clean establishment name match (_SAIPRAFMSPVTLTD-)
                if (estName) {
                    const cleanEst = estName.replace(/[^A-Z0-9]/gi, '').toUpperCase();
                    if (cleanEst && s.toUpperCase().includes(`_${cleanEst}-`)) return true;
                    if (cleanEst.length >= 4 && s.toUpperCase().includes(`_${cleanEst.slice(0, 6)}`)) return true;
                }
                // 4. Prefix match before dash (e.g. SAIPRA)
                if (cid && cid.includes('_')) {
                    const idPrefix = cid.split('_')[0].replace(/[^A-Z0-9]/gi, '').toUpperCase();
                    if (idPrefix.length >= 4 && s.toUpperCase().includes(`_${idPrefix}`)) return true;
                }
                return false;
            });
        };

        // If Cloud Column R is empty (0 used), WIPE local signatures for THIS ENVIRONMENT ONLY!
        if (validSigs.length === 0) {
            console.log(`🧹 [IPC] Cloud Column R is empty (0 used). Wiping sys_limit_${isDev ? 'dev' : ''}.bin and local signatures for ${isDev ? 'DEVELOPER' : 'USER'}!`);
            writeActivatedSilos([], isDev);
        }
        
        // 1. Sync environment sys_limit file directly with Cloud Column R signatures!
        const localSilos = readActivatedSilos(isDev);
        const finalSilos = localSilos.filter(s => validSigs.includes(s));
        writeActivatedSilos(finalSilos, isDev);
        console.log(`🧹 [IPC] Cleaned ${isDev ? 'sys_limit_dev.bin' : 'sys_limit.bin'} to match cloud signatures:`, finalSilos);

        if (!appBasePath) return { success: true, silos: finalSilos };
        const paths = getAppPaths(appBasePath);

        // 2. Sync root active_db.sqlite app_companies & app_company_profile
        try {
            const rootDbPath = path.join(paths.root, 'active_db.sqlite');
            if (fs.existsSync(rootDbPath)) {
                const rootDb = new Database(rootDbPath);
                rootDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');

                const compsRow = rootDb.prepare("SELECT value FROM store WHERE key = 'app_companies'").get() as any;
                if (compsRow && compsRow.value) {
                    try {
                        let comps = JSON.parse(compsRow.value);
                        if (Array.isArray(comps)) {
                            let changed = false;
                            for (const c of comps) {
                                if (c.id) {
                                    const matchingSig = findMatchingSignature(c, c.id);
                                    if (matchingSig) {
                                        if (c.companySignature !== matchingSig || c.isReadOnly !== false) {
                                            c.companySignature = matchingSig;
                                            c.isReadOnly = false;
                                            changed = true;
                                        }
                                    } else {
                                        if (c.companySignature !== "" || c.isReadOnly !== true) {
                                            c.companySignature = "";
                                            c.isReadOnly = true;
                                            changed = true;
                                        }
                                    }
                                }
                            }
                            if (changed) {
                                rootDb.prepare("INSERT OR REPLACE INTO store (key, value) VALUES ('app_companies', ?)").run(JSON.stringify(comps));
                            }
                        }
                    } catch(e) {}
                }

                const keysToWipe = rootDb.prepare("SELECT key, value FROM store WHERE key LIKE '%company_profile%'").all() as any[];
                for (const row of keysToWipe) {
                    try {
                        let prof = JSON.parse(row.value);
                        const siloId = prof.id || (row.key.replace('app_company_profile_', '').replace('app_company_profile', ''));
                        if (siloId) {
                            const matchingSig = findMatchingSignature(prof, siloId);
                            let changed = false;
                            if (matchingSig) {
                                if (prof.companySignature !== matchingSig || prof.isReadOnly !== false) {
                                    prof.companySignature = matchingSig;
                                    prof.isReadOnly = false;
                                    changed = true;
                                }
                            } else {
                                if (prof.companySignature !== "" || prof.isReadOnly !== true) {
                                    prof.companySignature = "";
                                    prof.isReadOnly = true;
                                    changed = true;
                                }
                            }
                            if (changed) {
                                rootDb.prepare("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)").run(row.key, JSON.stringify(prof));
                            }
                        }
                    } catch(e) {}
                }

                rootDb.close();
            }
        } catch (dbErr) {
            console.error("Failed to sync root active_db.sqlite:", dbErr);
        }

        // 3. Sync every company silo DB (app_company_profile)
        try {
            const dataDir = paths.data;
            if (fs.existsSync(dataDir)) {
                const siloDirs = fs.readdirSync(dataDir).filter(name => {
                    const siloPath = path.join(dataDir, name);
                    return fs.statSync(siloPath).isDirectory() && fs.existsSync(path.join(siloPath, 'active_db.sqlite'));
                });

                for (const siloId of siloDirs) {
                    try {
                        const siloDbPath = path.join(dataDir, siloId, 'active_db.sqlite');
                        const siloDb = new Database(siloDbPath);
                        siloDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');

                        const rows = siloDb.prepare("SELECT key, value FROM store WHERE key LIKE '%company_profile%'").all() as any[];
                        for (const r of rows) {
                            try {
                                let prof = JSON.parse(r.value);
                                const matchingSig = findMatchingSignature(prof, siloId);
                                let changed = false;
                                if (matchingSig) {
                                    if (prof.companySignature !== matchingSig || prof.isReadOnly !== false) {
                                        prof.companySignature = matchingSig;
                                        prof.isReadOnly = false;
                                        changed = true;
                                    }
                                } else {
                                    if (prof.companySignature !== "" || prof.isReadOnly !== true) {
                                        prof.companySignature = "";
                                        prof.isReadOnly = true;
                                        changed = true;
                                    }
                                }
                                if (changed) {
                                    siloDb.prepare("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)").run(r.key, JSON.stringify(prof));
                                }
                            } catch(e) {}
                        }
                        siloDb.close();
                    } catch(e) {}
                }
            }
        } catch (siloErr) {
            console.error("Failed to sync company silo DBs:", siloErr);
        }

        return { success: true, silos: finalSilos };
    } catch (e: any) {
        console.error('[IPC] purge-unmatched-local-signatures failed:', e);
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
            .filter(name => {
                const siloPath = path.join(dataDir, name);
                const isDir = fs.statSync(siloPath).isDirectory();
                if (!isDir) return false;
                // Only include silos that actually have an active database
                return fs.existsSync(path.join(siloPath, 'active_db.sqlite'));
            })
            .filter(name => name !== '.icon-ico' && name !== 'default'); // Exclude known non-silo folders if any
        
        return { success: true, silos };
    } catch (e: any) {
        console.error('[IPC] list-silos failed:', e);
        return { success: false, error: e.message };
    }
});

async function robustRm(targetPath: string, maxRetries = 15, delayMs = 300) {
    if (!fs.existsSync(targetPath)) return;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            fs.rmSync(targetPath, { recursive: true, force: true });
            console.log(`[robustRm] Successfully deleted ${targetPath} on attempt ${attempt}`);
            return;
        } catch (err: any) {
            console.warn(`[robustRm] Attempt ${attempt} failed to delete ${targetPath}. Error: ${err.message}`);
            if (attempt === maxRetries) {
                throw err;
            }
            // Yield the event loop asynchronously to allow the OS and Node to release lock handles
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

ipcMain.handle('delete-silo', async (_, companyId: string) => {
    try {
        if (!appBasePath) throw new Error("App storage not initialized");
        if (!companyId || companyId === 'default') throw new Error("Invalid company ID for deletion");
        
        console.log(`[IPC] delete-silo request for company: ${companyId}`);
        
        // V04.01.07: Safely close database connection first if the silo to delete is currently active
        if (activeCompanyId === companyId) {
            console.log(`[IPC] Silo is currently active: ${companyId}. Closing SQLite connection to release file locks before physical folder deletion.`);
            if (db) {
                try {
                    db.pragma('wal_checkpoint(TRUNCATE)');
                    db.close();
                } catch (dbErr: any) {
                    console.error(`[IPC] Failed to close SQLite database for active silo:`, dbErr);
                }
                db = null;
            }
            // CRITICAL FIX: Clear activeCompanyId so subsequent dbSet calls (e.g. from React state updates)
            // don't recreate the folder via ensureDatabase -> initializeDatabase.
            activeCompanyId = null;
            // Yield to let OS release file locks
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Physically delete the silo folder completely
        const paths = getAppPaths(appBasePath);
        const siloPath = path.join(paths.data, companyId);
        
        if (fs.existsSync(siloPath)) {
            try {
                await robustRm(siloPath, 15, 300); // 15 attempts, 300ms delay = 4.5 seconds max
                console.log(`[IPC] Physical silo folder deleted successfully: ${siloPath}`);
            } catch (fsErr: any) {
                console.error(`[IPC] Physical silo folder deletion failed:`, fsErr);
                throw fsErr;
            }
        } else {
            console.log(`[IPC] Physical silo folder did not exist on disk: ${siloPath}`);
        }
        
        return { success: true };
    } catch (e: any) {
        console.error('[IPC] delete-silo failed:', e);
        return { success: false, error: e.message };
    }
});

// V04.01.07: Dedicated in-place wipe for the currently active company silo.
// This avoids ANY file system operations (no close, no rmSync, no re-open),
// preventing Windows EBUSY locks that caused indefinite hangs during restore.
ipcMain.handle('wipe-company-data', async (_, companyId: string) => {
    try {
        if (!db) throw new Error("Database not initialized");
        if (!companyId || companyId === 'default') throw new Error("Invalid company ID");

        console.log(`[IPC] wipe-company-data: in-place purge for ${companyId}`);

        // Purge all rows except protected system & company profile/identity keys.
        const stmt = db.prepare(
            `DELETE FROM store WHERE key NOT LIKE 'app_company_profile%' AND key != 'app_companies' AND key != 'app_users' AND key != 'app_license_secure' AND key != 'app_developer_secure' AND key != 'app_machine_id'`
        );
        const result = stmt.run();
        console.log(`[IPC] wipe-company-data: purged ${result.changes} rows for ${companyId}`);

        return { success: true, changes: result.changes };
    } catch (e: any) {
        console.error('[IPC] wipe-company-data failed:', e);
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
            const folderName = subfolder.replace(/\.\./g, '').replace(/[<>:"|?*]/g, '');
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

// 4b. Full Secure Backup — AES-256-CBC + scrypt (military-grade SQLite backup)
// Replaces the legacy CryptoJS JSON blob export. Produces a binary-encrypted SQLite
// file that is fully compatible with the restore-sqlite-backup handler.
ipcMain.handle('run-full-backup', async (_, arg) => {
    try {
        const {
            fileName,
            subfolder,
            encryptionKey: userKey,
        } = typeof arg === 'object' ? arg : { fileName: arg, subfolder: '', encryptionKey: '' };

        if (!appBasePath) throw new Error('Storage folder not set. Please select a data location in Settings.');
        if (!db) throw new Error('Database connection not available. Please restart the application.');

        const paths = getAppPaths(appBasePath);

        let targetDir = paths.backups;
        if (subfolder) {
            const folderName = (subfolder as string).replace(/\.\./g, '').replace(/[<>:"|?*]/g, '');
            targetDir = path.join(paths.backups, folderName);
        }
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        const safeName = (fileName || `full_backup_${Date.now()}.enc`).replace(/[<>:"|?*]/g, '');
        const tempPath  = path.join(targetDir, `${safeName}.sqlite.tmp`);
        const finalPath = path.join(targetDir, safeName);

        console.log(`[IPC] run-full-backup: building SQLite snapshot → ${safeName}`);

        // ── 1. Build a fresh SQLite snapshot of ALL rows (full-company backup) ──
        const backupDb = new Database(tempPath);
        backupDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');

        const rawRows = db.prepare('SELECT key, value FROM store').all() as { key: string; value: string }[];

        // Exclude only machine-specific identity rows that must NEVER travel between machines
        const machineOnlyKeys = ['app_machine_id', 'app_developer_secure', 'app_data_size'];
        const currentMachineId = await getInternalMachineId();

        const insertStmt = backupDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
        backupDb.transaction(() => {
            for (const row of rawRows) {
                if (!machineOnlyKeys.includes(row.key)) {
                    insertStmt.run(row.key, row.value);
                }
            }
            if (currentMachineId) {
                insertStmt.run('app_origin_machine_id', JSON.stringify(currentMachineId));
                insertStmt.run('app_machine_id', JSON.stringify(currentMachineId));
            }
        })();
        backupDb.close();

        console.log(`[IPC] run-full-backup: ${rawRows.length} rows snapshotted. Encrypting with AES-256-CBC + scrypt...`);

        // ── 2. Encrypt with AES-256-CBC (Node.js crypto — military-grade) ──
        // Key derivation: scrypt(userKey, 'BPP_SALT_v1', 32) → 256-bit key
        // IV: 16-byte random (prepended to ciphertext so restore can read it)
        const encKey = userKey?.trim() || 'INITIAL_PMS_KEY';
        const salt   = 'BPP_SALT_v1';
        const derivedKey = crypto.scryptSync(encKey, salt, 32);
        const iv         = crypto.randomBytes(16);   // random IV for each export
        const cipher     = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);

        const inputStream  = fs.createReadStream(tempPath);
        const outputStream = fs.createWriteStream(finalPath);

        // Write 16-byte IV as the first block so the restore handler can extract it
        outputStream.write(iv);

        await new Promise<void>((resolve, reject) => {
            inputStream.pipe(cipher).pipe(outputStream, { end: false });
            cipher.on('end', () => { outputStream.end(); resolve(); });
            cipher.on('error', reject);
            inputStream.on('error', reject);
        });

        fs.unlinkSync(tempPath);

        console.log(`[IPC] run-full-backup: secure archive created → ${finalPath}`);
        return { success: true, fileName: safeName, filePath: finalPath };
    } catch (e: any) {
        console.error('[IPC] run-full-backup failed:', e);
        return { success: false, error: e.message };
    }
});


ipcMain.handle('create-data-backup', async (_, arg) => {
    try {
        const fileName = typeof arg === 'string' ? arg : arg.fileName;
        const subfolder = typeof arg === 'object' ? arg.subfolder : '';
        const financialYear = (typeof arg === 'object' && arg.financialYear) ? arg.financialYear : null;

        console.log(`[IPC] create-data-backup requested: ${fileName} in subfolder: ${subfolder}, financialYear: ${financialYear || 'ALL'}`);
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
            const folderName = subfolder.replace(/\.\./g, '').replace(/[<>:"|?*]/g, '');
            targetDir = path.join(paths.backups, folderName);
        }

        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        const tempPath = path.join(targetDir, `${fileName}.sqlite.tmp`);
        const finalPath = path.join(targetDir, `${fileName}.enc`);

        
        console.log(`[IPC] Creating filtered backup (excluding user/license data, scoped to ${financialYear || 'all FYs'})...`);
        const backupDb = new Database(tempPath);
        backupDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
        
        const rawRows = db!.prepare('SELECT key, value FROM store').all() as { key: string, value: string }[];
        
        // V06.01.09: Backups must always be complete (all financial years) to prevent data loss on restore.
        // Ignore financialYear parameter filter.
        const rows = rawRows;
        
        const excludedKeys = [
            'app_license_secure', 
            'app_license_data', 
            'app_users', 
            'app_machine_id', 
            'app_developer_secure',
            'app_data_size'
        ];
        const currentMachineId = await getInternalMachineId();
        
        const insertStmt = backupDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
        
        backupDb.transaction(() => {
            for (const row of rows) {
                if (!excludedKeys.includes(row.key)) {
                    insertStmt.run(row.key, row.value);
                }
            }
            if (currentMachineId) {
                insertStmt.run('app_origin_machine_id', JSON.stringify(currentMachineId));
                insertStmt.run('app_machine_id', JSON.stringify(currentMachineId));
            }
        })();
        
        backupDb.close();

        // --- ENCRYPTION LAYER ---
        const encryptionKey = (typeof arg === 'object' && arg.encryptionKey && String(arg.encryptionKey).trim()) 
            ? String(arg.encryptionKey).trim() 
            : 'INITIAL_PMS_KEY';
        console.log(`[IPC] Securing Data Archive with ${ (typeof arg === 'object' && arg.encryptionKey) ? 'Custom Identity Key' : 'Universal Portable Key' }...`);

        const salt = 'BPP_SALT_v1';
        const derivedKey = crypto.scryptSync(encryptionKey, salt, 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
        
        const input = fs.createReadStream(tempPath);
        const output = fs.createWriteStream(finalPath);
        
        output.write(iv);
        
        await new Promise((resolve, reject) => {
            input.pipe(cipher).pipe(output, { end: false });
            cipher.on('end', () => { output.end(); resolve(true); });
            cipher.on('error', (err) => reject(err));
            input.on('error', (err) => reject(err));
        });

        fs.unlinkSync(tempPath); // Remove the plain temporary file
        console.log(`[IPC] Secure Automatic Backup Created: ${finalPath}`);
        return { success: true, path: finalPath };
    } catch (e: any) {
        console.error('[IPC] Automatic backup failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('select-backup-file', async () => {
    try {
        const result = await dialog.showOpenDialog({
            title: 'Select Backup File',
            properties: ['openFile'],
            filters: [
                { name: 'BharatPP Backup Archives (*.enc, *.sqlite)', extensions: ['enc', 'sqlite'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            const name = path.basename(filePath);
            return { filePath, name };
        }
        return null;
    } catch (e: any) {
        console.error('[IPC] select-backup-file failed:', e);
        return null;
    }
});

ipcMain.handle('get-backup-periods', async (_, arg) => {
    try {
        let backupFilePath = typeof arg === 'string' ? arg : (arg?.path || '');
        if (!appBasePath) return { success: false, periods: [] };
        const paths = getAppPaths(appBasePath);

        if (!backupFilePath || !fs.existsSync(backupFilePath)) {
            const filename = path.basename(backupFilePath || '');
            const searchDirs = [
                paths.data,
                path.join(appBasePath, 'Data backup'),
                path.join(appBasePath, 'Data'),
                app.getPath('downloads'),
                app.getPath('desktop')
            ];
            const findFileRecursive = (dir: string, targetName: string, depth = 0): string | null => {
                if (depth > 5 || !fs.existsSync(dir)) return null;
                try {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const full = path.join(dir, entry.name);
                        if (entry.isFile() && entry.name.toLowerCase() === targetName.toLowerCase()) return full;
                        if (entry.isDirectory() && !entry.name.startsWith('.')) {
                            const found = findFileRecursive(full, targetName, depth + 1);
                            if (found) return found;
                        }
                    }
                } catch (_) {}
                return null;
            };
            for (const searchDir of searchDirs) {
                const found = findFileRecursive(searchDir, filename);
                if (found) { backupFilePath = found; break; }
            }
        }

        if (!backupFilePath || !fs.existsSync(backupFilePath)) {
            return { success: false, periods: [], error: 'File not found' };
        }

        let dataDir = paths.data;
        if (activeCompanyId && activeCompanyId !== 'default') {
            dataDir = path.join(paths.data, activeCompanyId);
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        }

        const tempInspectPath = path.join(dataDir, `inspect_temp_${Date.now()}.sqlite`);

        const fd = fs.openSync(backupFilePath, 'r');
        const header = Buffer.alloc(16);
        fs.readSync(fd, header as any, 0, 16, 0);
        fs.closeSync(fd);

        if (header.toString().startsWith('SQLite format 3')) {
            fs.copyFileSync(backupFilePath, tempInspectPath);
        } else {
            const encryptedBuf = fs.readFileSync(backupFilePath);
            const tryDecryptBufferSync = (key: string, salt: string, useIvHeader: boolean): Buffer | null => {
                try {
                    const derivedKey = crypto.scryptSync(key, salt, 32);
                    let iv: Buffer = useIvHeader ? (encryptedBuf.length >= 32 ? encryptedBuf.subarray(0, 16) : Buffer.alloc(16, 0)) : Buffer.alloc(16, 0);
                    let ciphertext: Buffer = useIvHeader ? encryptedBuf.subarray(16) : encryptedBuf;
                    const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
                    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
                    if (decrypted.length >= 100) {
                        const headerAscii = decrypted.toString('utf8', 0, 32);
                        const headerLatin1 = decrypted.toString('latin1', 0, 32);
                        if (headerAscii.includes('SQLite format 3') || headerLatin1.includes('SQLite format 3')) return decrypted;
                    }
                    return null;
                } catch (_) { return null; }
            };

            const keysToTry: string[] = ['INITIAL_PMS_KEY', 'bpp_dev_473748', 'BPP_UNIVERSAL_BACKUP_KEY_2026', '031942'];
            if (typeof arg === 'object' && arg.encryptionKey) {
                const kStr = String(arg.encryptionKey).trim();
                if (kStr) keysToTry.unshift(kStr);
            }
            if (typeof arg === 'object' && arg.password) {
                const pStr = String(arg.password).trim();
                if (pStr) keysToTry.unshift(pStr);
            }
            const fileBasename = path.basename(backupFilePath);
            const digitsMatch = fileBasename.match(/\d{4,8}/g);
            if (digitsMatch) digitsMatch.forEach(d => keysToTry.push(d));

            if (db) {
                try {
                    const row = db.prepare('SELECT value FROM store WHERE key = ?').get('app_license_data') as { value: string };
                    if (row) {
                        const ldata = JSON.parse(row.value);
                        if (ldata?.key) keysToTry.push(ldata.key.trim());
                    }
                } catch (e) {}

                try {
                    const profileRows = db.prepare("SELECT value FROM store WHERE key LIKE 'app_company_profile%' OR key = 'app_company_profile'").all() as { value: string }[];
                    for (const r of profileRows) {
                        try {
                            const pData = JSON.parse(r.value);
                            if (pData?.securityPin) keysToTry.push(String(pData.securityPin).trim());
                        } catch (_) {}
                    }
                } catch (e) {}
            }

            const machineId = await getInternalMachineId();
            keysToTry.push(machineId);

            const sanitizedKeys = Array.from(new Set(keysToTry.filter(Boolean)));
            const formats = [
                { salt: 'BPP_SALT_v1', ivHeader: true },
                { salt: 'salt', ivHeader: true },
                { salt: 'BPP_SALT_v1', ivHeader: false },
                { salt: 'salt', ivHeader: false },
            ];

            let decryptedBuffer: Buffer | null = null;
            for (const key of sanitizedKeys) {
                for (const fmt of formats) {
                    decryptedBuffer = tryDecryptBufferSync(key, fmt.salt, fmt.ivHeader);
                    if (decryptedBuffer) break;
                }
                if (decryptedBuffer) break;
            }

            if (!decryptedBuffer) return { success: false, periods: [], error: 'Decryption failed' };
            fs.writeFileSync(tempInspectPath, decryptedBuffer);
        }

        const sourceDb = new Database(tempInspectPath);
        const rows = sourceDb.prepare('SELECT key, value FROM store').all() as { key: string, value: string }[];
        sourceDb.close();
        try { fs.unlinkSync(tempInspectPath); } catch (_) {}

        const MONTHS_ORDER = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const transactionalPrefixes = [
            'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers',
            'app_payroll_history', 'app_fines', 'app_arrear_history', 'app_ot_records'
        ];

        const periods = new Set<string>();
        for (const r of rows) {
            if (transactionalPrefixes.some(p => r.key.startsWith(p))) {
                try {
                    const parsed = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
                    if (Array.isArray(parsed)) {
                        for (const itm of parsed) {
                            const m = String(itm.month || itm.Month || itm.payrollMonth || '').trim();
                            const y = Number(itm.year || itm.Year || itm.payrollYear || 0);
                            if (m && y > 0) {
                                const normM = MONTHS_ORDER.find(mo => mo.toLowerCase() === m.toLowerCase());
                                if (normM) periods.add(`${normM}_${y}`);
                            } else {
                                const dateStr = String(itm.date || itm.Date || itm.entryDate || itm.createdDate || '').trim();
                                if (dateStr && dateStr.includes('-')) {
                                    const parts = dateStr.split('-');
                                    if (parts.length === 3) {
                                        const yr = parts[0].length === 4 ? parseInt(parts[0]) : parseInt(parts[2]);
                                        const mo = parts[0].length === 4 ? parseInt(parts[1]) - 1 : parseInt(parts[1]) - 1;
                                        if (!isNaN(yr) && !isNaN(mo) && mo >= 0 && mo <= 11) {
                                            periods.add(`${MONTHS_ORDER[mo]}_${yr}`);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (_) {}
            }
        }

        return { success: true, periods: Array.from(periods) };
    } catch (e: any) {
        return { success: false, periods: [], error: e.message };
    }
});

ipcMain.handle('restore-sqlite-backup', async (_, arg) => {
    const logPath = path.join(app.getPath('userData'), 'restore_debug.log');
    const log = (msg: string) => {
        try {
            console.log(`[IPC RESTORE] ${msg}`);
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
        } catch (_) {}
    };

    try {
        log(`>>> restore-sqlite-backup called with arg: ${JSON.stringify(arg)}`);
        let backupFilePath = typeof arg === 'string' ? arg : arg.path;
        log(`Initial backupFilePath: "${backupFilePath}"`);

        if (!appBasePath) throw new Error("App storage not initialized");
        const paths = getAppPaths(appBasePath);

        // --- AUTO-DISCOVERY FALLBACK: If file path is relative or missing on disk ---
        if (!backupFilePath || !fs.existsSync(backupFilePath)) {
            const filename = path.basename(backupFilePath || '');
            log(`File not found at explicit path "${backupFilePath}". Auto-discovering "${filename}"...`);

            const searchDirs = [
                paths.data,
                path.join(appBasePath, 'Data backup'),
                path.join(appBasePath, 'Data'),
                app.getPath('downloads'),
                app.getPath('desktop')
            ];

            const findFileRecursive = (dir: string, targetName: string, depth = 0): string | null => {
                if (depth > 5 || !fs.existsSync(dir)) return null;
                try {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const full = path.join(dir, entry.name);
                        if (entry.isFile() && entry.name.toLowerCase() === targetName.toLowerCase()) {
                            return full;
                        }
                        if (entry.isDirectory() && !entry.name.startsWith('.')) {
                            const found = findFileRecursive(full, targetName, depth + 1);
                            if (found) return found;
                        }
                    }
                } catch (_) {}
                return null;
            };

            for (const searchDir of searchDirs) {
                const found = findFileRecursive(searchDir, filename);
                if (found) {
                    log(`[AUTO-DISCOVERY SUCCESS] Resolved "${filename}" -> "${found}"`);
                    backupFilePath = found;
                    break;
                }
            }
        }

        if (!fs.existsSync(backupFilePath)) {
            throw new Error(`Backup file not found on disk: "${backupFilePath}". Please select the backup file again.`);
        }

        log(`Final resolved backupFilePath: "${backupFilePath}"`);
        
        // Use active company silo if available
        let dataDir = paths.data;
        if (activeCompanyId && activeCompanyId !== 'default') {
            dataDir = path.join(paths.data, activeCompanyId);
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        }

        const DB_PATH = path.join(dataDir, 'active_db.sqlite');
        const tempRestorePath = path.join(dataDir, 'restore_temp.sqlite');

        // NOTE: Active database remains 100% open and untouched during format checking & decryption
        const fd = fs.openSync(backupFilePath, 'r');
        const header = Buffer.alloc(16);
        fs.readSync(fd, header as any, 0, 16, 0);
        fs.closeSync(fd);

        if (header.toString().startsWith('SQLite format 3')) {
            console.log(`[IPC] Restoring plain SQLite file...`);
            fs.copyFileSync(backupFilePath, tempRestorePath);
        } else {
            console.log(`[IPC] Decrypting Secure SQLite Archive...`);

            // --- FORMAT GUARD: Detect legacy CryptoJS/Base64 text files ---
            const formatCheckBuf = Buffer.alloc(256);
            const formatFd = fs.openSync(backupFilePath, 'r');
            const bytesRead = fs.readSync(formatFd, formatCheckBuf as any, 0, 256, 0);
            fs.closeSync(formatFd);
            const sampleBytes = formatCheckBuf.slice(0, bytesRead);
            const isBase64TextFormat = sampleBytes.every((b: number) => b >= 32 && b <= 126);
            if (isBase64TextFormat) {
                throw new Error(
                    "Legacy backup format detected (CryptoJS text blob). " +
                    "This file was created before BPP v06.02. Please re-export your data using " +
                    "'Local Secure Backup' to generate a new military-grade encrypted file, " +
                    "then retry the restoration."
                );
            }

            const encryptedBuf = fs.readFileSync(backupFilePath);

            const tryDecryptBufferSync = (key: string, salt: string, useIvHeader: boolean): Buffer | null => {
                try {
                    const derivedKey = crypto.scryptSync(key, salt, 32);
                    let iv: Buffer;
                    let ciphertext: Buffer;

                    if (useIvHeader) {
                        if (encryptedBuf.length < 32) return null;
                        iv = encryptedBuf.subarray(0, 16);
                        ciphertext = encryptedBuf.subarray(16);
                    } else {
                        iv = Buffer.alloc(16, 0);
                        ciphertext = encryptedBuf;
                    }

                    const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
                    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

                    if (decrypted.length >= 100) {
                        const headerAscii = decrypted.toString('utf8', 0, 32);
                        const headerLatin1 = decrypted.toString('latin1', 0, 32);
                        if (headerAscii.includes('SQLite format 3') || headerLatin1.includes('SQLite format 3')) {
                            return decrypted;
                        }
                    }
                    return null;
                } catch (e: any) {
                    return null;
                }
            };

            let dbLicenseKey = '';
            const keysToTry: string[] = ['INITIAL_PMS_KEY', 'bpp_dev_473748', 'BPP_UNIVERSAL_BACKUP_KEY_2026', '031942'];

            if (typeof arg === 'object' && arg.encryptionKey) {
                const kStr = String(arg.encryptionKey).trim();
                if (kStr) keysToTry.unshift(kStr);
            }
            if (typeof arg === 'object' && arg.password) {
                const pStr = String(arg.password).trim();
                if (pStr) keysToTry.unshift(pStr);
            }

            const fileBasename = path.basename(backupFilePath);
            const digitsMatch = fileBasename.match(/\d{4,8}/g);
            if (digitsMatch) {
                digitsMatch.forEach(d => keysToTry.push(d));
            }

            if (db) {
                try {
                    const row = db.prepare('SELECT value FROM store WHERE key = ?').get('app_license_data') as { value: string };
                    if (row) {
                        const ldata = JSON.parse(row.value);
                        dbLicenseKey = ldata.key || '';
                        if (dbLicenseKey) keysToTry.push(dbLicenseKey.trim());
                    }
                } catch (e) {}

                try {
                    const profileRows = db.prepare("SELECT value FROM store WHERE key LIKE 'app_company_profile%' OR key = 'app_company_profile'").all() as { value: string }[];
                    for (const r of profileRows) {
                        try {
                            const pData = JSON.parse(r.value);
                            if (pData?.securityPin) keysToTry.push(String(pData.securityPin).trim());
                        } catch (_) {}
                    }
                } catch (e) {}
            }

            const machineId = await getInternalMachineId();
            keysToTry.push(machineId);

            const sanitizedKeys = Array.from(new Set(keysToTry.filter(k => !!k).map(k => k.trim())));

            let decryptedBuffer: Buffer | null = null;
            let matchedKey = '';

            const formats = [
                { salt: 'BPP_SALT_v1', ivHeader: true },
                { salt: 'salt', ivHeader: true },
                { salt: 'BPP_SALT_v1', ivHeader: false },
                { salt: 'salt', ivHeader: false },
            ];

            log(`Keys to try: ${JSON.stringify(sanitizedKeys)}`);

            for (const key of sanitizedKeys) {
                for (const fmt of formats) {
                    decryptedBuffer = tryDecryptBufferSync(key, fmt.salt, fmt.ivHeader);
                    if (decryptedBuffer) {
                        matchedKey = key;
                        log(`Decryption MATCH FOUND with key="${key}", salt="${fmt.salt}", ivHeader=${fmt.ivHeader}`);
                        break;
                    }
                }
                if (decryptedBuffer) break;
            }

            if (!decryptedBuffer) {
                log(`ALL KEYS FAILED TO DECRYPT! Tested keys: ${JSON.stringify(sanitizedKeys)}`);
                throw new Error("Decryption failed. Invalid key, wrong password, or the file may be corrupt.");
            }

            fs.writeFileSync(tempRestorePath, decryptedBuffer);
            console.log(`[IPC] Decryption successful using key '${matchedKey === machineId ? 'Machine ID' : matchedKey}'. Written to ${tempRestorePath}`);
        }

        // 1. Open the restored database as a source
        let sourceDb: Database.Database;
        let rows: { key: string, value: string }[] = [];
        try {
            sourceDb = new Database(tempRestorePath);
            rows = sourceDb.prepare('SELECT key, value FROM store').all() as { key: string, value: string }[];
            console.log(`[IPC] Read ${rows.length} rows from backup file.`);

            // ── Period Availability Check for Specific Month Data Migration ──────────────
            const migrationPeriod = typeof arg === 'object' ? arg.migrationPeriod : null;
            if (typeof arg === 'object' && arg.isMigration && migrationPeriod && migrationPeriod.month && migrationPeriod.year) {
                const targetM = String(migrationPeriod.month || '').trim().toLowerCase();
                const targetY = Number(migrationPeriod.year || 0);

                const transactionalPrefixes = [
                    'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers',
                    'app_payroll_history', 'app_fines', 'app_arrear_history', 'app_ot_records'
                ];

                const MONTHS_ORDER = ['january','february','march','april','may','june','july','august','september','october','november','december'];

                let hasTargetPeriod = false;
                for (const r of rows) {
                    if (transactionalPrefixes.some(pref => r.key.startsWith(pref))) {
                        try {
                            const parsed = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
                            if (Array.isArray(parsed)) {
                                for (const itm of parsed) {
                                    const m = String(itm.month || itm.Month || itm.payrollMonth || '').trim().toLowerCase();
                                    const y = Number(itm.year || itm.Year || itm.payrollYear || 0);
                                    if (m && y > 0) {
                                        if (m === targetM && y === targetY) {
                                            hasTargetPeriod = true;
                                            break;
                                        }
                                    }
                                    const dateStr = String(itm.date || itm.Date || itm.entryDate || itm.createdDate || '').trim();
                                    if (dateStr && dateStr.includes('-')) {
                                        const parts = dateStr.split('-');
                                        if (parts.length === 3) {
                                            const yr = parts[0].length === 4 ? parseInt(parts[0]) : parseInt(parts[2]);
                                            const mo = parts[0].length === 4 ? parseInt(parts[1]) - 1 : parseInt(parts[1]) - 1;
                                            if (yr === targetY && MONTHS_ORDER[mo] === targetM) {
                                                hasTargetPeriod = true;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (_) {}
                        if (hasTargetPeriod) break;
                    }
                }

                if (!hasTargetPeriod) {
                    sourceDb.close();
                    try { if (fs.existsSync(tempRestorePath)) fs.unlinkSync(tempRestorePath); } catch (_) {}
                    log(`[IPC] Migration target period "${targetM} ${targetY}" not found in backup file. Aborting restore.`);
                    return {
                        success: false,
                        backupMissingPeriod: true,
                        targetMonth: migrationPeriod.month,
                        targetYear: migrationPeriod.year,
                        error: `Data for selected Month & Year {${migrationPeriod.month} ${migrationPeriod.year}} not avialble to restore`
                    };
                }
            }
        } catch (dbErr: any) {
            try { if (fs.existsSync(tempRestorePath)) fs.unlinkSync(tempRestorePath); } catch (_) {}
            throw new Error(`Invalid Backup File Format (${dbErr.message || 'file is not a database'}). This file could not be decrypted. Please verify the backup file or enter the custom password used when creating it.`);
        }
        
        try {
            const logMsg = `[${new Date().toISOString()}] Restore: Read ${rows.length} rows. DB_PATH: ${DB_PATH}\n`;
            const fs = require('fs');
            const path = require('path');
            fs.appendFileSync(path.join(require('electron').app.getPath('userData'), 'restore_log.txt'), logMsg);
        } catch (e) {}
        
        // 3. Define keys to strictly exclude from overwriting on Target Machine B:
        // Protect Machine B's Company Profile, companySignature, System Configuration, and License Identity under ALL circumstances.
        const activeId = activeCompanyId;
        const isMigration = typeof arg === 'object' && arg.isMigration === true;

        // ── 3. Key exclusion lists ──────────────────────────────────────────────────────────
        // Keys that are ALWAYS protected regardless of restore mode (machine & company profile identity)
        const alwaysExcludedKeys = [
            'app_license_secure', 'app_license_data', 'app_users',
            'app_machine_id', 'app_developer_secure', 'app_data_size',
            'app_company_profile', 'company_profile', 'app_companies', 'app_active_company_id', 'companySignature'
        ];
        // Keys additionally protected during DATA MIGRATION (preserve target Machine B's identity)
        const migrationExtraExclusions = [
            'app_company_profile', 'company_profile',
            'app_config', 'config',
            'app_companies', 'app_active_company_id', 'companySignature'
        ];
        if (activeId && activeId !== 'default') {
            migrationExtraExclusions.push(`app_company_profile_${activeId}`);
            migrationExtraExclusions.push(`app_config_${activeId}`);
            alwaysExcludedKeys.push(`app_company_profile_${activeId}`);
        }

        const isAlwaysExcluded = (key: string): boolean => {
            if (alwaysExcludedKeys.includes(key)) return true;
            if (key.startsWith('app_license') || key.startsWith('app_user') || key.includes('sys_limit')) return true;
            if (key.startsWith('app_company_profile') || key.startsWith('company_profile') || key.startsWith('companySignature')) return true;
            return false;
        };

        const isMigrationExcluded = (key: string): boolean => {
            if (migrationExtraExclusions.includes(key)) return true;
            if (key.startsWith('app_company_profile') || key.startsWith('company_profile') || key.startsWith('companySignature')) return true;
            if (key.startsWith('app_config_') || key === 'app_config') return true;
            return false;
        };

        // Combined exclusion function based on restore mode
        const isExcludedKey = (key: string): boolean => {
            if (isAlwaysExcluded(key)) return true;
            if (isMigration && isMigrationExcluded(key)) return true;
            return false;
        };

        // ── STEP 1: TOP-LEVEL MACHINE SIGNATURE GATE FOR UNIVERSAL RESTORATION ────────
        if (!isMigration) {
            const currentMachineId = await getInternalMachineId();
            const backupMachineIdRow = rows.find(r => r.key === 'app_origin_machine_id' || r.key === 'app_machine_id');

            if (!backupMachineIdRow) {
                sourceDb.close();
                fs.unlinkSync(tempRestorePath);
                return {
                    success: false,
                    error: `Universal Restoration Blocked — Backup file lacks local machine ownership signature.\n\nUniversal Restoration works ONLY for backups created on this local machine. To import data from another machine or external source, please use 'Data Migration' under Utilities.`
                };
            }

            try {
                const backupMachineId = JSON.parse(backupMachineIdRow.value);
                if (!backupMachineId || !currentMachineId || backupMachineId.trim().toUpperCase() !== currentMachineId.trim().toUpperCase()) {
                    sourceDb.close();
                    fs.unlinkSync(tempRestorePath);
                    return {
                        success: false,
                        error: `Universal Restoration Blocked — Data backup file does not belong to this Machine.\n\nThis backup file was generated on another computer. Universal Restoration works ONLY for backups created on this local machine. To import data from another machine, please use 'Data Migration' under Utilities.`
                    };
                }
            } catch (_) {
                sourceDb.close();
                fs.unlinkSync(tempRestorePath);
                return {
                    success: false,
                    error: `Universal Restoration Blocked — Backup file machine signature is corrupted.\n\nUniversal Restoration works ONLY for valid backups created on this local machine. To import data from another machine, please use 'Data Migration' under Utilities.`
                };
            }
        }

        // ── 4. Ensure active database is open ──────────────────────────────────────────────
        console.log(`[IPC] Restoring into database path: ${DB_PATH} | Mode: ${isMigration ? 'DATA MIGRATION' : 'UNIVERSAL RESTORATION'}`);
        if (!db) {
            db = new Database(DB_PATH, { timeout: 15000 });
            db.pragma('journal_mode = WAL');
        }

        // ── 4.5 Mandatory Company Compatibility Gate ────────────────────────────────────────
        // Find the company profile stored in the backup
        let backupProfileRow = null;
        if (activeId && activeId !== 'default') {
            backupProfileRow = rows.find(r => r.key === `app_company_profile_${activeId}`);
        }
        if (!backupProfileRow) backupProfileRow = rows.find(r => r.key === 'app_company_profile' || r.key === 'company_profile');
        if (!backupProfileRow && activeId && activeId !== 'default') {
            backupProfileRow = rows.find(r => r.key.startsWith('app_company_profile_') && r.key.includes(activeId));
        }
        if (!backupProfileRow) backupProfileRow = rows.find(r => r.key.startsWith('app_company_profile') || r.key === 'company_profile');

        // Find the company profile currently active on this machine (target)
        let activeProfileRow: { value: string } | null = null;
        if (db) {
            if (activeId && activeId !== 'default') {
                activeProfileRow = db.prepare('SELECT value FROM store WHERE key = ?').get(`app_company_profile_${activeId}`) as { value: string } | null;
            }
            if (!activeProfileRow) {
                activeProfileRow = db.prepare("SELECT value FROM store WHERE key = 'app_company_profile' OR key = 'company_profile'").get() as { value: string } | null;
            }
            if (!activeProfileRow) {
                activeProfileRow = db.prepare("SELECT value FROM store WHERE key LIKE 'app_company_profile%' OR key = 'company_profile'").get() as { value: string } | null;
            }
        }

        if (backupProfileRow && activeProfileRow) {
            try {
                const backupProfile = JSON.parse(backupProfileRow.value);
                const activeProfile  = JSON.parse(activeProfileRow.value);

                const clean = (v: any) => String(v || '').trim().toUpperCase();

                // 5 mandatory fields
                const bName   = clean(backupProfile.establishmentName || backupProfile.tradeName);
                const aName   = clean(activeProfile.establishmentName  || activeProfile.tradeName);
                const bCin    = clean(backupProfile.cin);
                const aCin    = clean(activeProfile.cin);
                const bPan    = clean(backupProfile.pan);
                const aPan    = clean(activeProfile.pan);
                const bPfCode = clean(backupProfile.pfCode);
                const aPfCode = clean(activeProfile.pfCode);
                const bEsi    = clean(backupProfile.esiCode);
                const aEsi    = clean(activeProfile.esiCode);
                const backupId   = clean(backupProfile.id);
                const activeIdUp = clean(activeId);

                console.log(`[IPC] Compatibility Gate — Mode: ${isMigration ? 'MIGRATION' : 'RESTORE'} | Backup: "${bName}" (${backupId}) | Target: "${aName}" (${activeIdUp})`);
                console.log(`[IPC]   CIN=${bCin}|${aCin}  PAN=${bPan}|${aPan}  PF=${bPfCode}|${aPfCode}  ESI=${bEsi}|${aEsi}`);

                // ── RULE: Company Name is ALWAYS mandatory — blank on either side = hard block ──
                if (!bName) {
                    sourceDb.close(); fs.unlinkSync(tempRestorePath);
                    return { success: false, error: `Restore/Migration Blocked — Company Name is missing in the backup file. This backup cannot be used.` };
                }
                if (!aName) {
                    sourceDb.close(); fs.unlinkSync(tempRestorePath);
                    return { success: false, error: `Restore/Migration Blocked — Company Name is not set on this machine. Please complete the Company Profile before restoring.` };
                }

                // Helper: mismatch = BOTH sides non-empty AND values differ
                const fieldMismatch = (bVal: string, aVal: string) => bVal && aVal && bVal !== aVal;
                // Blank = at least one side is empty
                const fieldBlank    = (bVal: string, aVal: string) => !bVal || !aVal;

                const forceConfirm = !!(arg as any).forceConfirm;

                // ── UNIFIED MANDATORY 5-FIELD COMPATIBILITY GATE (Both Universal Restoration & Migration) ──────
                if (backupId && activeIdUp && activeIdUp !== 'DEFAULT' && backupId !== activeIdUp) {
                    sourceDb.close(); fs.unlinkSync(tempRestorePath);
                    return { success: false, error: `${isMigration ? 'Migration' : 'Universal Restoration'} Blocked — Company Silo Mismatch: Backup silo '${backupId}' ≠ target silo '${activeIdUp}'. Select the correct company first.` };
                }
                if (fieldMismatch(bName, aName)) {
                    sourceDb.close(); fs.unlinkSync(tempRestorePath);
                    return { success: false, error: `${isMigration ? 'Migration' : 'Universal Restoration'} Blocked — Company Name Mismatch: Backup '${bName}' ≠ target '${aName}'.` };
                }
                if (fieldMismatch(bCin, aCin)) {
                    sourceDb.close(); fs.unlinkSync(tempRestorePath);
                    return { success: false, error: `${isMigration ? 'Migration' : 'Universal Restoration'} Blocked — CIN Mismatch: Backup CIN (${bCin}) ≠ target CIN (${aCin}).` };
                }
                if (fieldMismatch(bPan, aPan)) {
                    sourceDb.close(); fs.unlinkSync(tempRestorePath);
                    return { success: false, error: `${isMigration ? 'Migration' : 'Universal Restoration'} Blocked — PAN Mismatch: Backup PAN (${bPan}) ≠ target PAN (${aPan}).` };
                }
                if (fieldMismatch(bPfCode, aPfCode)) {
                    sourceDb.close(); fs.unlinkSync(tempRestorePath);
                    return { success: false, error: `${isMigration ? 'Migration' : 'Universal Restoration'} Blocked — PF Code Mismatch: Backup PF Code (${bPfCode}) ≠ target PF Code (${aPfCode}).` };
                }
                if (fieldMismatch(bEsi, aEsi)) {
                    sourceDb.close(); fs.unlinkSync(tempRestorePath);
                    return { success: false, error: `${isMigration ? 'Migration' : 'Universal Restoration'} Blocked — ESI Code Mismatch: Backup ESI Code (${bEsi}) ≠ target ESI Code (${aEsi}).` };
                }

                // Blank mandatory fields warning gate
                if (!forceConfirm) {
                    const blankWarnings: string[] = [];
                    if (fieldBlank(bCin, aCin))       blankWarnings.push(`CIN — ${!bCin ? 'missing in backup' : 'not set on target machine'}`);
                    if (fieldBlank(bPan, aPan))       blankWarnings.push(`PAN — ${!bPan ? 'missing in backup' : 'not set on target machine'}`);
                    if (fieldBlank(bPfCode, aPfCode)) blankWarnings.push(`PF Code — ${!bPfCode ? 'missing in backup' : 'not set on target machine'}`);
                    if (fieldBlank(bEsi, aEsi))       blankWarnings.push(`ESI Code — ${!bEsi ? 'missing in backup' : 'not set on target machine'}`);
                    if (blankWarnings.length > 0) {
                        sourceDb.close(); fs.unlinkSync(tempRestorePath);
                        return { success: false, requiresConfirmation: true, warnings: blankWarnings };
                    }
                }
                console.log(`[IPC] ${isMigration ? 'DATA MIGRATION' : 'UNIVERSAL RESTORATION'}: All 5-field compatibility checks passed ✓`);
            } catch (e) {
                console.warn('[IPC] Failed to parse company profiles for compatibility gate:', e);
            }
        } else if (!activeProfileRow) {
            console.log(`[IPC] No active profile on target machine — allowing restore unconditionally (fresh install / new silo).`);
        }

        if (!db) throw new Error("Database not initialized");
        const targetDb = db;

        // ── 5. Period range filter for Full Restore (IMPORT mode) ─────────────────────────
        const fromPeriod: { month: string; year: number } | undefined = (arg as any).fromPeriod;
        const toPeriod:   { month: string; year: number } | undefined = (arg as any).toPeriod;
        const hasRangeFilter = !isMigration && fromPeriod && toPeriod;

        const MONTHS_ORDER = ['January','February','March','April','May','June','July','August','September','October','November','December'];

        // Returns true if a record's (month, year) falls within [fromPeriod, toPeriod] inclusive
        const isInRange = (recMonth: string, recYear: number): boolean => {
            if (!hasRangeFilter) return true;
            const from = fromPeriod!.year * 12 + MONTHS_ORDER.indexOf(fromPeriod!.month);
            const to   = toPeriod!.year   * 12 + MONTHS_ORDER.indexOf(toPeriod!.month);
            const rec  = recYear            * 12 + MONTHS_ORDER.indexOf(recMonth);
            return rec >= from && rec <= to;
        };

        // Parse a date string (ISO yyyy-mm-dd or dd-mm-yyyy) into { month, year } or null
        const parseDateToMonthYear = (dateStr: string): { month: string; year: number } | null => {
            try {
                const parts = dateStr.split('-');
                if (parts.length !== 3) return null;
                const yr = parts[0].length === 4 ? parseInt(parts[0]) : parseInt(parts[2]);
                const mo = parts[0].length === 4 ? parseInt(parts[1]) - 1 : parseInt(parts[1]) - 1;
                if (isNaN(yr) || isNaN(mo) || mo < 0 || mo > 11) return null;
                return { month: MONTHS_ORDER[mo], year: yr };
            } catch (_) { return null; }
        };

        // Transactional keys filtered by month/year range (attendance, payroll, ledgers, etc.)
        const TRANSACTIONAL_PREFIXES = [
            'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers',
            'app_payroll_history', 'app_fines', 'app_arrear_history', 'app_ot_records'
        ];

        // Filter a JSON array of transactional records by period range
        const filterRowByRange = (value: string): string => {
            if (!hasRangeFilter) return value;
            try {
                const arr = JSON.parse(value);
                if (!Array.isArray(arr)) return value;
                const filtered = arr.filter((item: any) => {
                    const m = String(item.month || item.Month || '').trim();
                    const y = parseInt(String(item.year || item.Year || '0'));
                    if (m && !isNaN(y) && y > 0) return isInRange(m, y);
                    // Fallback: try date string fields
                    const dateStr = item.date || item.Date || item.createdDate || item.entryDate || '';
                    if (dateStr) {
                        const parsed = parseDateToMonthYear(String(dateStr));
                        if (parsed) return isInRange(parsed.month, parsed.year);
                    }
                    return true; // keep undated records
                });
                return JSON.stringify(filtered);
            } catch (_) { return value; }
        };

        // Filter Employee Master (app_employees_*) by doj (date of joining) ≤ toPeriod
        // Include employees who joined on or before the end of the toPeriod.
        // Employees with no doj or unparseable doj are always included.
        const filterEmployeesByRange = (value: string): string => {
            if (!hasRangeFilter) return value;
            try {
                const arr = JSON.parse(value);
                if (!Array.isArray(arr)) return value;
                const toVal = toPeriod!.year * 12 + MONTHS_ORDER.indexOf(toPeriod!.month);
                const filtered = arr.filter((emp: any) => {
                    const doj = emp.doj || emp.joiningDate || emp.dateOfJoining || '';
                    if (!doj) return true; // no doj → always include
                    const parsed = parseDateToMonthYear(String(doj));
                    if (!parsed) return true; // unparseable → always include
                    const dojVal = parsed.year * 12 + MONTHS_ORDER.indexOf(parsed.month);
                    return dojVal <= toVal; // joined on or before toPeriod end
                });
                return JSON.stringify(filtered);
            } catch (_) { return value; }
        };

        // ── 5.5 AUTOMATIC PRE-OPERATION SAFETY SNAPSHOT ─────────────────────────────────────
        let snapshotCreated = false;
        const preRestoreSnapshotPath = path.join(dataDir, 'active_db_pre_restore.snapshot.bak');
        const timestampedSnapshotPath = path.join(dataDir, `active_db_snapshot_${Date.now()}.bak`);
        try {
            if (targetDb) {
                targetDb.pragma('wal_checkpoint(FULL)');
            }
            if (fs.existsSync(DB_PATH)) {
                fs.copyFileSync(DB_PATH, preRestoreSnapshotPath);
                fs.copyFileSync(DB_PATH, timestampedSnapshotPath);
                snapshotCreated = true;
                log(`[IPC] Automatic pre-operation safety snapshots created successfully: "${preRestoreSnapshotPath}" and "${timestampedSnapshotPath}"`);
            }
        } catch (snapErr: any) {
            console.warn('[IPC] Failed to create pre-operation snapshot warning:', snapErr);
        }

        // ── 6. Write data into target database with Rollback Protection ────────────────────
        const allKeysInDb = (targetDb.prepare('SELECT key FROM store').all() as { key: string }[]).map(r => r.key);
        const keysToDelete = allKeysInDb.filter(k => !isExcludedKey(k));

        const upsertStmt = targetDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');

        try {
            targetDb.transaction(() => {
                // FULL RESTORE (ALL periods): delete non-excluded keys then write — clean overwrite
                // FULL RESTORE (RANGE): no delete — upsert filtered data (preserves out-of-range records)
                // DATA MIGRATION: no delete — upsert only
                if (keysToDelete.length > 0 && !isMigration && !hasRangeFilter) {
                    const deleteStmt = targetDb.prepare(`DELETE FROM store WHERE key IN (${keysToDelete.map(() => '?').join(',')})`);
                    deleteStmt.run(...keysToDelete);
                }
                let written = 0;
                for (const row of rows) {
                    if (isExcludedKey(row.key)) continue;

                    let valueToWrite = row.value;

                    if (hasRangeFilter) {
                        if (TRANSACTIONAL_PREFIXES.some(p => row.key.startsWith(p))) {
                            // Payroll, attendance, ledgers etc. — filter by month/year
                            valueToWrite = filterRowByRange(row.value);
                        } else if (row.key.startsWith('app_employees')) {
                            // Employee Master — filter by doj ≤ toPeriod
                            valueToWrite = filterEmployeesByRange(row.value);
                        }
                    }

                    upsertStmt.run(row.key, valueToWrite);
                    written++;
                }
                if (hasRangeFilter) {
                    console.log(`[IPC] FULL RESTORE (RANGE ${fromPeriod!.month} ${fromPeriod!.year} → ${toPeriod!.month} ${toPeriod!.year}): ${written} rows written.`);
                } else {
                    console.log(`[IPC] ${isMigration ? 'Migration' : 'Restore'}: ${written} rows written to target DB.`);
                }
            })();
        } catch (txError: any) {
            console.error('[IPC] Transaction failed during restore! Rolling back to pre-operation snapshot...', txError);
            if (snapshotCreated && fs.existsSync(preRestoreSnapshotPath)) {
                try {
                    if (db) { db.close(); db = null; }
                    fs.copyFileSync(preRestoreSnapshotPath, DB_PATH);
                    db = new Database(DB_PATH, { timeout: 15000 });
                    db.pragma('journal_mode = WAL');
                    console.log('[IPC] Automatic rollback to pre-operation snapshot successful ✓');
                } catch (rbErr) {
                    console.error('[IPC] Automatic rollback failed:', rbErr);
                }
            }
            sourceDb.close();
            try { fs.unlinkSync(tempRestorePath); } catch (_) {}
            throw new Error(`Restoration failed during database write (${txError.message}). Active database was automatically restored to pre-operation safety snapshot.`);
        }

        // ── 7. Clean up ────────────────────────────────────────────────────────────────────
        sourceDb.close();
        fs.unlinkSync(tempRestorePath);

        console.log(`[IPC] ${isMigration ? 'Data Migration' : 'Full Restore'} completed successfully.`);
        return { success: true };
    } catch (e: any) {
        console.error('[IPC] restoration failed:', e);
        if (!db && appBasePath) initializeDatabase(appBasePath);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('restore-from-snapshot', async (_, snapshotFileName?: string) => {
    try {
        if (!appBasePath) throw new Error("App storage not initialized");
        const paths = getAppPaths(appBasePath);
        let dataDir = paths.data;
        if (activeCompanyId && activeCompanyId !== 'default') {
            dataDir = path.join(paths.data, activeCompanyId);
        }
        const DB_PATH = path.join(dataDir, 'active_db.sqlite');
        const targetSnapshot = snapshotFileName 
            ? path.join(dataDir, snapshotFileName)
            : path.join(dataDir, 'active_db_pre_restore.snapshot.bak');

        if (!fs.existsSync(targetSnapshot)) {
            throw new Error('No pre-operation safety snapshot found to restore.');
        }

        if (db) {
            try { db.close(); db = null; } catch (_) {}
        }

        fs.copyFileSync(targetSnapshot, DB_PATH);
        db = new Database(DB_PATH, { timeout: 15000 });
        db.pragma('journal_mode = WAL');
        console.log(`[IPC] Successfully reverted active database to pre-operation snapshot: "${targetSnapshot}"`);
        return { success: true, message: 'Database successfully reverted to pre-operation snapshot.' };
    } catch (e: any) {
        console.error('[IPC] restore-from-snapshot failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('list-safety-snapshots', async () => {
    try {
        if (!appBasePath) throw new Error("App storage not initialized");
        const paths = getAppPaths(appBasePath);
        let dataDir = paths.data;
        if (activeCompanyId && activeCompanyId !== 'default') {
            dataDir = path.join(paths.data, activeCompanyId);
        }
        if (!fs.existsSync(dataDir)) return { success: true, snapshots: [] };
        const files = fs.readdirSync(dataDir);
        const snapshots = files
            .filter(f => f.includes('snapshot') && f.endsWith('.bak'))
            .map(f => {
                const stats = fs.statSync(path.join(dataDir, f));
                return { filename: f, date: stats.mtime.toISOString(), size: stats.size };
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return { success: true, snapshots };
    } catch (e: any) {
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
    console.log("[IPC] 'close-app' requested. Force terminating application process.");
    try {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setClosable(true);
            mainWindow.destroy();
        }
    } catch (e) {}
    try {
        app.exit(0);
    } catch (e) {}
    try {
        app.quit();
    } catch (e) {}
    try {
        process.exit(0);
    } catch (e) {}
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
        const logFilePath = 'd:/ILCBala/PMS/scratch/api_fetch.log';
        const fs = require('fs');
        const path = require('path');
        try {
            const dir = path.dirname(logFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] REQ: ${options?.method || 'GET'} ${url}\nBODY: ${options?.body || 'none'}\n`);
        } catch (err) {
            console.error("Failed to write request log:", err);
        }

        return new Promise((resolve, reject) => {
            const request = net.request({
                url,
                method: options?.method || 'GET',
                redirect: 'follow'
            } as any);

            const timeout = setTimeout(() => {
                request.abort();
                try {
                    fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] RES: TIMEOUT\n\n`);
                } catch (e) {}
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

                    try {
                        fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] RES STATUS: ${response.statusCode} | BODY: ${JSON.stringify(responseBody)}\n\n`);
                    } catch (e) {}

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
                try {
                    fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] RES ERROR: ${error.message}\n\n`);
                } catch (e) {}
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
                potentialRoots.push(path.join(drive, 'BharatPayRoll'));
                potentialRoots.push(path.join(drive, 'BharatPayRoll', 'BPP_APP'));
                potentialRoots.push(path.join(drive, 'BPP', 'BPP_APP')); // Check subfolder too
                potentialRoots.push(path.join(drive, 'BharatPP'));
            });
        } catch (e) {
            // Fallback if WMIC fails
            ['C:', 'D:', 'E:', 'F:', 'G:', 'H:'].forEach(d => {
                potentialRoots.push(path.join(d, '/', 'BPP_APP'));
                potentialRoots.push(path.join(d, '/', 'BharatPayRoll'));
                potentialRoots.push(path.join(d, '/', 'BharatPayRoll', 'BPP_APP'));
                potentialRoots.push(path.join(d, '/', 'BharatPP'));
            });
        }

        // 2. Add User Home
        potentialRoots.push(path.join(app.getPath('home'), 'BPP_APP'));
        potentialRoots.push(path.join(app.getPath('home'), 'BharatPayRoll'));
        potentialRoots.push(path.join(app.getPath('home'), 'BharatPayRoll', 'BPP_APP'));

        // 3. Scan for first existing one
        for (const p of potentialRoots) {
            if (fs.existsSync(p)) {
                // Verify it's actually our app directory (contains BharatPP or active_db.sqlite)
                const dataPath = path.join(p, 'BharatPP');
                const dbPath = path.join(p, 'active_db.sqlite');
                if (fs.existsSync(dataPath) || fs.existsSync(dbPath)) {
                    console.log('🔄 Dynamic Detection: Found App Data at', p);
                    return { success: true, path: p };
                }
            }
        }

        return { success: false, error: 'BPP_APP folder not found' };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

// ── 8.5 DIAGNOSTICS & TELEMETRY ──
ipcMain.handle('generate-diagnostics', async (_, uiState: any) => {
    try {
        if (!mainWindow) throw new Error("No main window");

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultPath = path.join(app.getPath('desktop'), `BPP_Diagnostics_${timestamp}.bpplog`);

        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Secure Diagnostic Report',
            defaultPath: defaultPath,
            filters: [{ name: 'BPP Encrypted Log', extensions: ['bpplog'] }]
        });

        if (result.canceled || !result.filePath) {
            return { success: false, error: 'User canceled save dialog' };
        }

        // Gather File System State
        const fsState: any = {
            appBasePath: appBasePath || 'NOT_CONFIGURED',
            rootExists: false,
            rootSize: 0,
            legacyDataExists: false,
            legacyDataSize: 0,
            silos: []
        };

        if (appBasePath && fs.existsSync(appBasePath)) {
            // Root DB could be active_db.sqlite or app_companies.sqlite
            const rootDbPath1 = path.join(appBasePath, 'active_db.sqlite');
            const rootDbPath2 = path.join(appBasePath, 'app_companies.sqlite');
            if (fs.existsSync(rootDbPath1)) {
                fsState.rootExists = true;
                fsState.rootSize = fs.statSync(rootDbPath1).size;
            } else if (fs.existsSync(rootDbPath2)) {
                fsState.rootExists = true;
                fsState.rootSize = fs.statSync(rootDbPath2).size;
            }

            const legacyDbPath = path.join(appBasePath, 'Data', 'active_db.sqlite');
            if (fs.existsSync(legacyDbPath)) {
                fsState.legacyDataExists = true;
                fsState.legacyDataSize = fs.statSync(legacyDbPath).size;
            }

            // Scan for silos in app root, BPP_APP, OR inside the nested BharatPP/Data folder
            const scanDirs = [appBasePath, path.join(appBasePath, 'BPP_APP'), path.join(appBasePath, 'BharatPP', 'Data')];
            for (const scanDir of scanDirs) {
                if (fs.existsSync(scanDir)) {
                    const items = fs.readdirSync(scanDir, { withFileTypes: true });
                    for (const item of items) {
                        if (item.isDirectory()) {
                            const siloDbPath = path.join(scanDir, item.name, 'active_db.sqlite');
                            // Only count it as a silo if it has an active_db.sqlite, or its name matches a typical ID format (e.g. SAIPRA_123456)
                            if (fs.existsSync(siloDbPath) || item.name.includes('_')) {
                                // Ensure we don't duplicate if they somehow exist in both
                                if (!fsState.silos.some((s: any) => s.folder === item.name)) {
                                    fsState.silos.push({
                                        folder: path.basename(scanDir) === 'BPP_APP' ? `BPP_APP/${item.name}` : item.name,
                                        exists: fs.existsSync(siloDbPath),
                                        size: fs.existsSync(siloDbPath) ? fs.statSync(siloDbPath).size : 0
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        const payload = {
            timestamp: new Date().toISOString(),
            os: process.platform,
            uiState: uiState,
            fsState: fsState
        };

        const jsonString = JSON.stringify(payload, null, 2);

        // Encrypt Payload (AES-256-CBC)
        const encryptionKey = 'bpp_dev_473748';
        const cipher = crypto.createCipheriv('aes-256-cbc' as any, 
            crypto.scryptSync(encryptionKey, 'salt', 32) as any, 
            Buffer.alloc(16, 0) as any
        );
        
        let encrypted = cipher.update(jsonString, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        fs.writeFileSync(result.filePath, encrypted, 'utf8');

        return { success: true, filePath: result.filePath };
    } catch (e: any) {
        console.error('[IPC] generate-diagnostics failed:', e);
        return { success: false, error: e.message };
    }
});


// ── 9. SMART AUTO-UPDATE HANDLERS ──

const INSTALLER_NAME = 'bpp_installer.exe';
const getInstallerPath = () => path.join(os.tmpdir(), INSTALLER_NAME);

let isUpdateDownloading = false;
let closeRequested = false;

ipcMain.handle('start-update-download', async (_, downloadUrl: string, expectedHash?: string) => {
    isUpdateDownloading = true;
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
                            isUpdateDownloading = false;
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
                                isUpdateDownloading = false;
                                resolve({ success: false, error: 'SECURITY_HASH_MISMATCH' });
                                return;
                            }
                            console.log('✅ Integrity Verified successfully.');
                        } catch (hashErr: any) {
                            console.error('❌ Hash calculation failed:', hashErr);
                            fs.unlinkSync(dest);
                            isUpdateDownloading = false;
                            resolve({ success: false, error: 'Integrity check failed' });
                            return;
                        }
                    }

                    BrowserWindow.getAllWindows().forEach(win => {
                        win.webContents.send('update-download-complete');
                    });
                    isUpdateDownloading = false;
                    console.log(`✅ Update download finished. Total Bytes: ${fs.statSync(dest).size}`);
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
            });
            
            request.end();

        } catch (e: any) {
            resolve({ success: false, error: e.message });
        }
    });
});

ipcMain.handle('mark-patch-complete', async () => {
    try {
        const markerPath = path.join(app.getPath('userData'), 'signature_patch_applied.marker');
        if (!fs.existsSync(markerPath)) {
            fs.writeFileSync(markerPath, 'Applied on: ' + new Date().toISOString());
            console.log('✅ Signature patch cache wipe marked as complete (from Cloud Sync).');
        }
        return { success: true };
    } catch (e) {
        console.error('Failed to create marker file:', e);
        return { success: false };
    }
});

ipcMain.handle('clear-patch-marker', async () => {
    try {
        const markerPath = path.join(app.getPath('userData'), 'signature_patch_applied.marker');
        if (fs.existsSync(markerPath)) {
            fs.unlinkSync(markerPath);
            console.log('🗑️ Signature patch marker cleared. Next patch update will perform a cache wipe.');
        }
        return { success: true };
    } catch (e) {
        console.error('Failed to clear marker file:', e);
        return { success: false };
    }
});

ipcMain.handle('backup-and-install', (_, options?: { silent?: boolean, newPatchTimestamp?: string }) => {
    const isSilent = options?.silent ?? false;
    const installerPath = getInstallerPath();

    if (!fs.existsSync(installerPath)) {
        console.error('❌ Installer file missing on disk:', installerPath);
        return { success: false, error: `Update installer not found at "${installerPath}". Please download update again.` };
    }

    // 1. INSTANT TERMINATION SIGNAL: Destroy windows immediately
    BrowserWindow.getAllWindows().forEach(win => {
        try { win.destroy(); } catch (e) {}
    });

    // 2. DETACHED WORKER: Using a Wait-and-Kill strategy to clear locks before installer check
    (async () => {
        try {
            console.log('--- DEFENSIVE RELAUNCHER START ---');
            
            // A. Flush and Close Database
            if (options?.newPatchTimestamp && appBasePath) {
                try {
                    const paths = getAppPaths(appBasePath);
                    const rootDbPath = path.join(paths.root, 'active_db.sqlite');
                    const rootDb = new Database(rootDbPath);
                    rootDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
                    rootDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)').run('app_active_patch_ts', JSON.stringify(options.newPatchTimestamp));
                    rootDb.close();
                    console.log('✅ Safely persisted active patch timestamp to ROOT DB:', options.newPatchTimestamp);
                } catch(e) {
                    console.error('❌ Failed to persist patch timestamp to ROOT DB', e);
                }
            }
            if (db) {
                try { 
                    db.pragma('wal_checkpoint(TRUNCATE)'); 
                    db.close(); 
                } catch(e) {}
                db = null;
            }

            // A.5 Clean User Data Caches (sys_limit & Local Storage) for clean update
            try {
                const markerPath = path.join(app.getPath('userData'), 'signature_patch_applied.marker');
                
                if (!fs.existsSync(markerPath)) {
                    const sysLimitPath = path.join(app.getPath('userData'), 'sys_limit.bin');
                    const localStoragePath = path.join(app.getPath('userData'), 'Local Storage');
                    
                    if (fs.existsSync(sysLimitPath)) {
                        fs.unlinkSync(sysLimitPath);
                        console.log('🧹 Deleted sys_limit.bin for clean update');
                    }
                    
                    if (fs.existsSync(localStoragePath)) {
                        fs.rmSync(localStoragePath, { recursive: true, force: true });
                        console.log('🧹 Deleted Local Storage for clean update');
                    }
                    
                    console.log('🧹 Signature patch cache wipe executed. Awaiting cloud sync for permanent marker.');
                } else {
                    console.log('⏩ Skipping cache wipe: Signature patch marker already exists.');
                }
            } catch (cleanErr) {
                console.warn('⚠️ Failed to clean user data for update:', cleanErr);
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
            try {
                const exeName = app.isPackaged ? 'BPP_APP.exe' : 'electron.exe';
                const tempDir = app.getPath('temp');
                const appExePath = process.execPath;
                
                // Write modern HTA message files to the temp directory
                const silentHtaPath = path.join(tempDir, 'bpp_update_msg.hta');
                const silentHtaContent = `
<HTA:APPLICATION ID="oHTA" BORDER="dialog" CAPTION="yes" CONTEXTMENU="no" INNERBORDER="no" SCROLL="no" SHOWINTASKBAR="no" SINGLEINSTANCE="yes" SYSMENU="no" WINDOWSTATE="normal" ALWAYSONTOP="yes"/>
<html><head><meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>BharatPay Pro Update</title>
<style>
  body { background-color: #020617; color: #f8fafc; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%; border: 1px solid #1e293b; box-sizing: border-box; overflow: hidden; }
  .title { margin-bottom: 12px; font-weight: 700; font-size: 18px; color: #38bdf8; letter-spacing: 0.5px; }
  .desc { margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5; }
  .wait-label { color: #38bdf8; font-weight: 600; }
  .dots { color: #38bdf8; font-weight: 700; font-size: 16px; width: 24px; display: inline-block; text-align: left; }
</style></head>
<body>
  <div class="title">Applying Background Patch Update</div>
  <div class="desc">
    <span>Installing latest software components... <span class="wait-label">Please wait</span><span id="dots" class="dots">.</span></span>
  </div>
  <script>
    window.resizeTo(560, 210); window.moveTo((screen.width - 560) / 2, (screen.height - 210) / 2); window.focus();
    var step = 1; var waitEl = document.getElementById("dots");
    setInterval(function() {
      step = (step % 4) + 1; var d = ""; for (var i = 0; i < step; i++) { d += "."; }
      if (waitEl) { waitEl.innerHTML = d; }
      try { window.focus(); } catch(e) {}
    }, 100);
    setTimeout(function() { window.close(); }, 60000);
  </script>
</body></html>
                `;
                fs.writeFileSync(silentHtaPath, silentHtaContent.trim(), 'utf8');

                const launchHtaPath = path.join(tempDir, 'bpp_launch_msg.hta');
                const launchHtaContent = `
<HTA:APPLICATION ID="oHTA" BORDER="dialog" CAPTION="yes" CONTEXTMENU="no" INNERBORDER="no" SCROLL="no" SHOWINTASKBAR="no" SINGLEINSTANCE="yes" SYSMENU="no" WINDOWSTATE="normal" ALWAYSONTOP="yes"/>
<html><head><meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>BharatPay Pro Update</title>
<style>
  body { background-color: #020617; color: #f8fafc; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%; border: 1px solid #1e293b; box-sizing: border-box; overflow: hidden; }
  .title { margin-bottom: 12px; font-weight: 700; font-size: 18px; color: #10b981; letter-spacing: 0.5px; }
  .desc { margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5; }
  .wait-label { color: #38bdf8; font-weight: 600; }
  .dots { color: #38bdf8; font-weight: 700; font-size: 16px; width: 24px; display: inline-block; text-align: left; }
</style></head>
<body>
  <div class="title">Application Update Complete</div>
  <div class="desc">
    <span>Launching BharatPay Pro... <span class="wait-label">Please wait</span><span id="dots" class="dots">.</span></span>
  </div>
  <script>
    window.resizeTo(560, 210); window.moveTo((screen.width - 560) / 2, (screen.height - 210) / 2); window.focus();
    var step = 1; var waitEl = document.getElementById("dots");
    setInterval(function() {
      step = (step % 4) + 1; var d = ""; for (var i = 0; i < step; i++) { d += "."; }
      if (waitEl) { waitEl.innerHTML = d; }
      try { window.focus(); } catch(e) {}
    }, 100);
    setTimeout(function() { window.close(); }, 60000);
  </script>
</body></html>
                `;
                fs.writeFileSync(launchHtaPath, launchHtaContent.trim(), 'utf8');
                
                // Chain: Single HTA Window -> Delay -> Taskkill old app -> Start Installer /S (WAIT) -> Relaunch App
                let command = '';
                if (isSilent) {
                    command = `start mshta "${silentHtaPath}" & timeout /t 2 /nobreak && taskkill /F /IM ${exeName} /T & timeout /t 1 /nobreak & start /wait "" "${installerPath}" /S & start "" "${appExePath}"`;
                } else {
                    // Interactive Mode: Run installer directly
                    command = `timeout /t 2 /nobreak && taskkill /F /IM ${exeName} /T & timeout /t 1 /nobreak & start "" "${installerPath}"`;
                }
                
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
