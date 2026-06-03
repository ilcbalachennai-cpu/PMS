"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const nodemailer_1 = __importDefault(require("nodemailer"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const crypto = __importStar(require("crypto"));
const child_process_1 = require("child_process");
const os = __importStar(require("os"));
let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development';
// ── CONFIGURATION & PERSISTENCE ──
// V03.01.06: Isolate Developer and Production database configurations
const CONFIG_PATH = isDev
    ? path.join(electron_1.app.getPath('userData'), 'app-config-dev.json')
    : path.join(electron_1.app.getPath('userData'), 'app-config.json');
console.log(`🚀 Electron v${process.versions.electron} | Node ${process.versions.node} | Chrome ${process.versions.chrome}`);
if (parseInt(process.versions.electron.split('.')[0]) < 30) {
    console.warn('⚠️  LEGACY MODE DETECTED: This version is for Windows 7 applications.');
}
else {
    console.log('✅ WIN10 MODE DETECTED: Layouts optimized for modern Windows environments.');
}
function getAppConfig() {
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        }
        catch (e) {
            return {};
        }
    }
    return {};
}
function saveAppConfig(config) {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        console.log(`✅ App config saved to: ${CONFIG_PATH}`);
    }
    catch (e) {
        console.error(`❌ Failed to save app config:`, e);
    }
}
let appConfig = getAppConfig();
let appBasePath = appConfig.appBasePath || (isDev ? 'E:\\BharatPP_Dev' : '');
// Helper to get structured paths
const getAppPaths = (base) => {
    // 🔍 SMART PATH RESOLUTION
    // If the base folder already has 'Data' or 'BharatPP/Data', use it correctly.
    let root = base;
    const directDataPath = path.join(base, 'Data');
    const nestedDataPath = path.join(base, 'BharatPP', 'Data');
    if (fs.existsSync(nestedDataPath)) {
        // Case: User selected the PARENT of BharatPP
        root = path.join(base, 'BharatPP');
    }
    else if (fs.existsSync(directDataPath)) {
        // Case: User selected the 'BharatPP' folder itself
        root = base;
    }
    else {
        // Case: New installation or empty folder
        // V04.00.02: Prevent nested BharatPP folder creation if already pointing to Dev/Prod root
        if (base.endsWith('BharatPP') || base.endsWith('BharatPP_Dev')) {
            root = base;
        }
        else {
            root = path.join(base, 'BharatPP');
        }
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
let db = null;
let activeCompanyId = null;
function initializeDatabase(basePath, companyId) {
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
        const debugInfo = `[${new Date().toLocaleString()}] ID: ${activeCompanyId} | DIR: ${dataDir}\n`;
        fs.appendFileSync(path.join(paths.data, 'silo_debug.txt'), debugInfo);
    }
    catch (e) { }
    const DB_PATH = path.join(dataDir, 'active_db.sqlite');
    // Ensure directories exist
    const dirsToCreate = [dataDir, paths.reports, paths.backups, paths.templates];
    dirsToCreate.forEach((dir) => {
        try {
            if (!fs.existsSync(dir)) {
                console.log(`📁 Creating directory: ${dir}`);
                fs.mkdirSync(dir, { recursive: true });
            }
        }
        catch (err) {
            console.error(`❌ Permission Error: Failed to create directory: ${dir}`, err);
            throw new Error(`Permission Denied: Cannot create folder at ${dir}. Please ensure you have write access to this location.`);
        }
    });
    try {
        console.log(`🗄️ Opening isolated database: ${DB_PATH}`);
        if (db) {
            try {
                db.close();
            }
            catch (e) { }
            db = null;
        }
        db = new better_sqlite3_1.default(DB_PATH, { timeout: 15000 }); // Increased timeout for slow drives
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
        }
        catch (e) {
            console.error(`❌ Failed to initialize snapshot system:`, e);
        }
    }
    catch (e) {
        console.error('❌ DB connection failed:', e);
        const errorLog = `[${new Date().toISOString()}] DB connection failed at ${DB_PATH}: ${e.message}\n`;
        fs.appendFileSync(path.join(electron_1.app.getPath('userData'), 'electron_errors.txt'), errorLog);
        // V03.01.07: Log error to a file we can easily access
        try {
            const errorFilePath = path.join(paths.data, 'error_log.txt');
            fs.appendFileSync(errorFilePath, errorLog);
            console.log(`📝 Error logged to: ${errorFilePath}`);
        }
        catch (err) { }
        // V03.01.07: Safe Recovery from Snapshot
        const snapshotDb = path.join(paths.backups, 'PRE_UPDATE_SNAPSHOT', 'active_db_snapshot.sqlite');
        if (fs.existsSync(snapshotDb)) {
            try {
                console.log('🛠️ Attempting safe recovery from snapshot...');
                if (db) {
                    try {
                        db.close();
                    }
                    catch (err) { }
                }
                // Backup the failed DB before overwriting
                if (fs.existsSync(DB_PATH)) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const failedPath = `${DB_PATH}.failed_${timestamp}`;
                    fs.renameSync(DB_PATH, failedPath);
                    console.warn(`⚠️ Failed DB preserved at: ${failedPath}`);
                }
                fs.copyFileSync(snapshotDb, DB_PATH);
                db = new better_sqlite3_1.default(DB_PATH);
                console.log('✅ Safe recovery successful using snapshot.');
            }
            catch (restoreErr) {
                throw new Error(`Database Error: ${e.message}. Recovery failed: ${restoreErr.message}`);
            }
        }
        else {
            throw new Error(`Database Error: ${e.message}. Path: ${DB_PATH}`);
        }
    }
}
function cleanupOldSnapshots(dir, maxFiles) {
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
    }
    catch (e) {
        console.error(`❌ Failed to cleanup old snapshots:`, e);
    }
}
let autoSnapshotInterval = null;
function startAutoSnapshot(basePath, _companyId) {
    if (autoSnapshotInterval)
        clearInterval(autoSnapshotInterval);
    autoSnapshotInterval = setInterval(() => {
        if (!db)
            return;
        try {
            const paths = getAppPaths(basePath);
            const autoBackupDir = path.join(paths.backups, 'AUTO_SNAPSHOTS');
            if (!fs.existsSync(autoBackupDir))
                fs.mkdirSync(autoBackupDir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(autoBackupDir, `auto_db_${timestamp}.sqlite`);
            db.backup(backupPath)
                .then(() => {
                console.log(`✅ Auto snapshot created: ${backupPath}`);
                cleanupOldSnapshots(autoBackupDir, 10); // Keep last 10 for auto
            })
                .catch(e => console.error(`❌ Failed to create auto snapshot:`, e));
        }
        catch (e) {
            console.error(`❌ Failed to create auto snapshot:`, e);
        }
    }, 30 * 60 * 1000); // Every 30 minutes
}
/**
 * 🛡️ DATABASE HEALTH CHECK
 */
function isDatabaseHealthy() {
    try {
        if (!db)
            return false;
        db.prepare('SELECT 1').get();
        return true;
    }
    catch (e) {
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
    if (db && appBasePath && isDatabaseHealthy())
        return true;
    console.log('🔍 Database check failed or unhealthy. Attempting on-demand recovery...');
    const config = getAppConfig();
    const savedPath = config.appBasePath || appBasePath;
    if (savedPath) {
        try {
            // If DB exists but is unhealthy, close it first
            if (db) {
                try {
                    db.close();
                }
                catch (e) { }
                db = null;
            }
            initializeDatabase(savedPath);
            return db !== null && isDatabaseHealthy();
        }
        catch (e) {
            console.error('❌ On-demand initialization failed:', e);
            const errorLog = `[${new Date().toISOString()}] On-demand recovery failed: ${e.message}\n`;
            try {
                fs.appendFileSync(path.join(electron_1.app.getPath('userData'), 'electron_errors.txt'), errorLog);
            }
            catch (err) { }
            return false;
        }
    }
    return false;
}
/**
 * 📁 RECURSIVELY COPY DIRECTORIES SYNC
 * Safely copies folder structures and assets.
 */
function copyRecursiveSync(src, dest) {
    if (!fs.existsSync(src))
        return;
    if (!fs.existsSync(dest))
        fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyRecursiveSync(srcPath, destPath);
        }
        else {
            try {
                fs.copyFileSync(srcPath, destPath);
            }
            catch (e) { } // ignore locked/busy file errors
        }
    }
}
// Deferring DB initialization to app.whenReady() for Ultra-Fast Startup.
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
        if (mainWindow)
            mainWindow.show();
    });
    mainWindow.on('close', (e) => {
        if (isUpdateDownloading) {
            e.preventDefault();
            closeRequested = true;
            electron_1.dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Update in Progress',
                message: 'A new version is currently downloading in the background.\n\nThe application will close automatically upon completion to apply the update. Please wait.',
                buttons: ['OK']
            });
        }
    });
    // We will export a method for the downloader to call when finished
    electron_1.ipcMain.handle('check-close-requested', () => {
        if (closeRequested) {
            electron_1.app.quit();
        }
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        // Disable DevTools in Production Environment
        mainWindow.webContents.on('devtools-opened', () => {
            mainWindow?.webContents.closeDevTools();
        });
        mainWindow.webContents.on('before-input-event', (event, input) => {
            if ((input.control && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12') {
                event.preventDefault();
            }
        });
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// ── SINGLE INSTANCE LOCK ──────────────────────────────────────────────────
// Prevent multiple instances of BPP_APP from running simultaneously in production.
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock && !isDev) {
    // A second instance tried to launch — show the custom already running UI.
    electron_1.app.whenReady().then(() => {
        const errorWin = new electron_1.BrowserWindow({
            width: 420,
            height: 380,
            frame: false,
            transparent: true,
            resizable: false,
            alwaysOnTop: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });
        errorWin.loadFile(path.join(__dirname, 'already-running.html'));
        errorWin.on('closed', () => electron_1.app.quit());
    });
}
else {
    // If a second instance attempts while we are the primary, focus our window (only in prod).
    electron_1.app.on('second-instance', () => {
        if (mainWindow && !isDev) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
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
    electron_1.app.disableHardwareAcceleration();
}
electron_1.app.whenReady().then(() => {
    // ── ULTRA-FAST STARTUP (V02.02.26) ──
    // 1. Create window immediately for perception of speed
    createWindow();
    // 2. Initializing database and cleanup in background
    if (appBasePath) {
        try {
            console.log(`🔄 Auto-initializing database from config: ${appBasePath}`);
            initializeDatabase(appBasePath);
        }
        catch (e) {
            console.error("❌ Failed to initialize database at stored path:", e);
            // V03.01.02: Don't clear appBasePath immediately if it exists on disk but failed to open (e.g. locked)
            // Only clear if the path itself is invalid/missing
            if (!fs.existsSync(appBasePath)) {
                appBasePath = '';
                saveAppConfig({ ...getAppConfig(), appBasePath: '' });
            }
        }
    }
    else {
        console.warn("⚠️ No stored appBasePath found in config.");
    }
    cleanupOldInstallers();
});
electron_1.app.on('window-all-closed', () => {
    console.error("EVENT 'window-all-closed' WAS FIRED. STACK TRACE:");
    console.trace();
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('will-quit', () => {
    if (db) {
        console.log('🔌 Closing database before quit...');
        try {
            db.close();
        }
        catch (e) { }
        db = null;
    }
});
// ── IPC HANDLERS ──
// 1. Directory Setup
electron_1.ipcMain.handle('select-app-directory', async () => {
    if (!mainWindow)
        return { success: false, error: 'No main window' };
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Application Storage Location'
    });
    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
    }
    return { success: true, path: result.filePaths[0] };
});
electron_1.ipcMain.handle('initialize-app-directory', async (_, selectedPath) => {
    try {
        // ENFORCE ISOLATION: Prevent nesting BharatPP inside BPP_APP
        if (selectedPath.endsWith('BPP_APP') || selectedPath.endsWith('BPP_APP\\') || selectedPath.endsWith('BPP_APP/')) {
            selectedPath = path.dirname(selectedPath);
        }
        if (appBasePath && appBasePath !== selectedPath) {
            console.log(`[IPC] Migrating from ${appBasePath} to ${selectedPath}`);
            const oldPaths = getAppPaths(appBasePath);
            const newPaths = getAppPaths(selectedPath);
            // 1. Migrate registry active_db.sqlite
            const oldRegistry = path.join(appBasePath, 'active_db.sqlite');
            const newRegistry = path.join(selectedPath, 'active_db.sqlite');
            if (fs.existsSync(oldRegistry) && !fs.existsSync(newRegistry)) {
                try {
                    fs.copyFileSync(oldRegistry, newRegistry);
                    console.log(`[IPC] Copied registry DB to ${newRegistry}`);
                }
                catch (e) {
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
                    if (fs.existsSync(oldPaths.reports))
                        copyRecursiveSync(oldPaths.reports, newPaths.reports);
                    // Copy Backups folder
                    if (fs.existsSync(oldPaths.backups))
                        copyRecursiveSync(oldPaths.backups, newPaths.backups);
                    // Copy Templates folder
                    if (fs.existsSync(oldPaths.templates))
                        copyRecursiveSync(oldPaths.templates, newPaths.templates);
                }
            }
            // Close the current DB before initializing the new one
            if (db) {
                try {
                    db.close();
                }
                catch (e) { }
                db = null;
            }
        }
        initializeDatabase(selectedPath);
        appBasePath = selectedPath;
        saveAppConfig({ ...getAppConfig(), appBasePath });
        return { success: true };
    }
    catch (e) {
        console.error('Failed to initialize app directory:', e);
        return { success: false, error: e.message };
    }
});
electron_1.ipcMain.handle('get-app-directory', async () => {
    return appBasePath || null;
});
electron_1.ipcMain.handle('switch-company-data', async (_, companyId) => {
    try {
        if (!appBasePath)
            throw new Error("Storage path not set");
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
            try {
                db.close();
            }
            catch (e) { }
            db = null;
        }
        // 3. Re-initialize with scope
        initializeDatabase(appBasePath, companyId);
        return { success: true };
    }
    catch (e) {
        console.error('[IPC] Company data switch failed:', e);
        return { success: false, error: e.message };
    }
});
// 2. Report Saving
electron_1.ipcMain.handle('save-report', async (_, { fileName, data, type, subfolder }) => {
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
    }
    catch (e) {
        console.error('[IPC] Save report failed:', e);
        return { success: false, error: e.message };
    }
});
// 2b. Template Saving (routes to BharatPP/Templates instead of Report files)
electron_1.ipcMain.handle('save-template', async (_, { fileName, data, type, subfolder }) => {
    try {
        console.log(`[IPC] save-template requested: ${fileName}.${type} in subfolder: ${subfolder}`);
        if (!appBasePath)
            throw new Error("App storage not initialized.");
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
    }
    catch (e) {
        console.error('[IPC] Save template failed:', e);
        return { success: false, error: e.message };
    }
});
electron_1.ipcMain.handle('open-item-location', async (_, filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            console.log(`[IPC] Opening location for item: ${filePath}`);
            electron_1.shell.showItemInFolder(filePath);
            return { success: true };
        }
        return { success: false, error: 'File not found' };
    }
    catch (e) {
        console.error('[IPC] Open item location failed:', e);
        return { success: false, error: e.message };
    }
});
// 2c. Open File Path (directly open the file)
electron_1.ipcMain.handle('open-item-path', async (_, filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            console.log(`[IPC] Opening file path directly: ${filePath}`);
            await electron_1.shell.openPath(filePath);
            return { success: true };
        }
        return { success: false, error: 'File not found' };
    }
    catch (e) {
        console.error('[IPC] Open item path failed:', e);
        return { success: false, error: e.message };
    }
});
// 2d. Dedicated Open User Manual Handler
electron_1.ipcMain.handle('open-user-manual', async () => {
    try {
        console.log(`[IPC] Received open-user-manual request`);
        const isDev = !electron_1.app.isPackaged;
        const appRoot = isDev ? process.cwd() : electron_1.app.getAppPath();
        const manualPath = path.join(appRoot, 'docs', 'user_manual.html');
        console.log(`[IPC] Resolved source manual path: ${manualPath}`);
        if (fs.existsSync(manualPath)) {
            if (isDev) {
                await electron_1.shell.openPath(manualPath);
                return { success: true };
            }
            else {
                // In production, extract to temp to bypass asar shell restrictions
                const tempDir = electron_1.app.getPath('temp');
                const tempManualPath = path.join(tempDir, 'BPP_User_Manual.html');
                const content = fs.readFileSync(manualPath);
                fs.writeFileSync(tempManualPath, content);
                // Copy manual image assets to temp folder so they render correctly in production
                const srcAssetsDir = path.join(appRoot, 'docs', 'assets');
                const destAssetsDir = path.join(tempDir, 'assets');
                if (fs.existsSync(srcAssetsDir)) {
                    copyRecursiveSync(srcAssetsDir, destAssetsDir);
                    console.log(`[IPC] Copied user manual assets to: ${destAssetsDir}`);
                }
                console.log(`[IPC] Extracted manual to temp: ${tempManualPath}`);
                await electron_1.shell.openPath(tempManualPath);
                return { success: true };
            }
        }
        // Fallback Strategy
        const altPath = path.resolve(__dirname, '..', 'docs', 'user_manual.html');
        if (fs.existsSync(altPath)) {
            await electron_1.shell.openPath(altPath);
            return { success: true };
        }
        throw new Error(`User manual not found. Please ensure 'docs/user_manual.html' exists.`);
    }
    catch (e) {
        console.error('[IPC] Open user manual failed:', e);
        return { success: false, error: e.message };
    }
});
// 2e. Statutory Forms Handling (Preview & Save blank templates)
electron_1.ipcMain.handle('handle-statutory-form', async (_, { formName, action }) => {
    try {
        console.log(`[IPC] handle-statutory-form requested for: ${formName}, action: ${action}`);
        const isDev = !electron_1.app.isPackaged;
        const appRoot = isDev ? process.cwd() : electron_1.app.getAppPath();
        // Map friendly names to real files in docs directory
        const formMap = {
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
            const tempDir = electron_1.app.getPath('temp');
            const tempFormPath = path.join(tempDir, fileName);
            const content = fs.readFileSync(actualSourcePath);
            fs.writeFileSync(tempFormPath, new Uint8Array(content));
            console.log(`[IPC] Extracted statutory form for preview: ${tempFormPath}`);
            const openError = await electron_1.shell.openPath(tempFormPath);
            if (openError) {
                console.warn(`[IPC] shell.openPath failed with error: ${openError}. Falling back to openExternal...`);
                // Fallback: Open with default web browser using file:// protocol
                const fileUrl = `file:///${tempFormPath.replace(/\\/g, '/')}`;
                await electron_1.shell.openExternal(fileUrl);
            }
            return { success: true };
        }
        else if (action === 'download') {
            // Prompt user where to save the file
            const result = await electron_1.dialog.showSaveDialog({
                title: `Download Blank ${formName}`,
                defaultPath: path.join(electron_1.app.getPath('downloads'), fileName),
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
    }
    catch (e) {
        console.error('[IPC] Handle statutory form failed:', e);
        return { success: false, error: e.message };
    }
});
electron_1.ipcMain.handle('send-email', async (_, { smtpConfig, mailOptions }) => {
    try {
        console.log(`[IPC] send-email requested to: ${mailOptions.to}`);
        const transporter = nodemailer_1.default.createTransport({
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
            attachments: mailOptions.attachments ? mailOptions.attachments.map((at) => ({
                filename: at.filename,
                content: Buffer.from(at.content)
            })) : []
        });
        console.log(`[IPC] Email sent. MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    }
    catch (e) {
        console.error('[IPC] send-email failed:', e);
        return { success: false, error: e.message };
    }
});
// 3. Simple Key-Value Store
electron_1.ipcMain.handle('db-set', async (_, { key, value }) => {
    try {
        if (!ensureDatabase()) {
            throw new Error("Storage not configured. Database unavailable.");
        }
        const stmt = db.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
        stmt.run(key, JSON.stringify(value));
        return { success: true };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
});
electron_1.ipcMain.handle('db-get', async (_, key) => {
    try {
        if (!ensureDatabase())
            return { success: true, data: null };
        let row = db.prepare('SELECT value FROM store WHERE key = ?').get(key);
        // ── Robust Registry Fallback for Global Keys ──
        const globalKeys = ['app_companies', 'app_active_company_id', 'app_license_secure', 'app_users', 'app_machine_id', 'app_setup_complete', 'app_developer_secure'];
        if (!row && appBasePath && globalKeys.includes(key)) {
            const rootDbPath = path.join(appBasePath, 'active_db.sqlite');
            if (fs.existsSync(rootDbPath)) {
                try {
                    const rootDb = new better_sqlite3_1.default(rootDbPath);
                    row = rootDb.prepare('SELECT value FROM store WHERE key = ?').get(key);
                    rootDb.close();
                }
                catch (err) {
                    console.warn('[IPC] Failed to fetch key from root registry database:', err);
                }
            }
        }
        return { success: true, data: row ? JSON.parse(row.value) : null };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
});
electron_1.ipcMain.handle('db-delete', async (_, key) => {
    try {
        if (!db)
            return { success: true };
        db.prepare('DELETE FROM store WHERE key = ?').run(key);
        return { success: true };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
});
electron_1.ipcMain.handle('db-get-all', async () => {
    try {
        if (!db)
            return { success: true, data: [] };
        const rows = db.prepare('SELECT key, value FROM store').all();
        const mergedData = rows.map(r => ({ key: r.key, value: JSON.parse(r.value) }));
        // ── Robust Registry Merging ──
        if (appBasePath) {
            const rootDbPath = path.join(appBasePath, 'active_db.sqlite');
            if (fs.existsSync(rootDbPath)) {
                try {
                    const rootDb = new better_sqlite3_1.default(rootDbPath);
                    const globalKeys = ['app_companies', 'app_active_company_id'];
                    for (const key of globalKeys) {
                        const exists = mergedData.some(item => item.key === key);
                        if (!exists) {
                            const row = rootDb.prepare('SELECT value FROM store WHERE key = ?').get(key);
                            if (row) {
                                mergedData.push({ key, value: JSON.parse(row.value) });
                            }
                        }
                    }
                    rootDb.close();
                }
                catch (err) {
                    console.warn('[IPC] Failed to merge keys from root registry database:', err);
                }
            }
        }
        return { success: true, data: mergedData };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
});
electron_1.ipcMain.handle('db-get-global', async (_, key) => {
    try {
        console.log(`[db-get-global] Requested key: ${key}. appBasePath: ${appBasePath}`);
        if (!appBasePath)
            return null;
        const rootDbPath = path.join(appBasePath, 'active_db.sqlite');
        console.log(`[db-get-global] DB Path: ${rootDbPath}. Exists? ${fs.existsSync(rootDbPath)}`);
        if (!fs.existsSync(rootDbPath))
            return null;
        const rootDb = new better_sqlite3_1.default(rootDbPath, { readonly: true });
        // Use readonly connection to avoid locking issues just for a read!
        // V03.00.00: It used to do CREATE TABLE IF NOT EXISTS store, but readonly DBs can't.
        // Assuming store already exists.
        const stmt = rootDb.prepare('SELECT value FROM store WHERE key = ?');
        const row = stmt.get(key);
        rootDb.close();
        console.log(`[db-get-global] Row found? ${!!row}`);
        if (row && row.value) {
            try {
                return JSON.parse(row.value);
            }
            catch (e) {
                return row.value;
            }
        }
        return null;
    }
    catch (e) {
        console.warn(`[IPC] Failed to get global key ${key}:`, e);
        return null;
    }
});
electron_1.ipcMain.handle('db-set-global', async (_, { key, value }) => {
    try {
        // 1. Always write to the ROOT database (Registry)
        const rootDbPath = path.join(appBasePath, 'active_db.sqlite');
        const rootDb = new better_sqlite3_1.default(rootDbPath);
        rootDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
        const stmt = rootDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
        stmt.run(key, JSON.stringify(value));
        rootDb.close();
        // 2. ALSO write to the currently active isolated database connection as a backup silo!
        if (db) {
            try {
                const activeStmt = db.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
                activeStmt.run(key, JSON.stringify(value));
            }
            catch (activeErr) {
                console.warn('[IPC] Failed to replicate global key in active database:', activeErr);
            }
        }
        return { success: true };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
});
electron_1.ipcMain.handle('list-silos', async () => {
    try {
        if (!appBasePath)
            throw new Error("App storage not initialized");
        const paths = getAppPaths(appBasePath);
        const dataDir = paths.data;
        if (!fs.existsSync(dataDir))
            return { success: true, silos: [] };
        const silos = fs.readdirSync(dataDir)
            .filter(name => fs.statSync(path.join(dataDir, name)).isDirectory())
            .filter(name => name !== '.icon-ico'); // Exclude known non-silo folders if any
        return { success: true, silos };
    }
    catch (e) {
        console.error('[IPC] list-silos failed:', e);
        return { success: false, error: e.message };
    }
});
async function robustRm(targetPath, maxRetries = 15, delayMs = 300) {
    if (!fs.existsSync(targetPath))
        return;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            fs.rmSync(targetPath, { recursive: true, force: true });
            console.log(`[robustRm] Successfully deleted ${targetPath} on attempt ${attempt}`);
            return;
        }
        catch (err) {
            console.warn(`[robustRm] Attempt ${attempt} failed to delete ${targetPath}. Error: ${err.message}`);
            if (attempt === maxRetries) {
                throw err;
            }
            // Yield the event loop asynchronously to allow the OS and Node to release lock handles
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}
electron_1.ipcMain.handle('delete-silo', async (_, companyId) => {
    try {
        if (!appBasePath)
            throw new Error("App storage not initialized");
        if (!companyId || companyId === 'default')
            throw new Error("Invalid company ID for deletion");
        console.log(`[IPC] delete-silo request for company: ${companyId}`);
        // V04.01.07: Safely close database connection first if the silo to delete is currently active
        if (activeCompanyId === companyId) {
            console.log(`[IPC] Silo is currently active: ${companyId}. Closing SQLite connection to release file locks before physical folder deletion.`);
            if (db) {
                try {
                    db.pragma('wal_checkpoint(TRUNCATE)');
                    db.close();
                }
                catch (dbErr) {
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
            }
            catch (fsErr) {
                console.error(`[IPC] Physical silo folder deletion failed:`, fsErr);
                throw fsErr;
            }
        }
        else {
            console.log(`[IPC] Physical silo folder did not exist on disk: ${siloPath}`);
        }
        return { success: true };
    }
    catch (e) {
        console.error('[IPC] delete-silo failed:', e);
        return { success: false, error: e.message };
    }
});
// V04.01.07: Dedicated in-place wipe for the currently active company silo.
// This avoids ANY file system operations (no close, no rmSync, no re-open),
// preventing Windows EBUSY locks that caused indefinite hangs during restore.
electron_1.ipcMain.handle('wipe-company-data', async (_, companyId) => {
    try {
        if (!db)
            throw new Error("Database not initialized");
        if (!companyId || companyId === 'default')
            throw new Error("Invalid company ID");
        console.log(`[IPC] wipe-company-data: in-place purge for ${companyId}`);
        // Purge all rows except the three protected system keys.
        // Using != (not LIKE without wildcards) for clarity and correctness.
        const stmt = db.prepare(`DELETE FROM store WHERE key != 'app_users' AND key != 'app_license_secure' AND key != 'app_developer_secure'`);
        const result = stmt.run();
        console.log(`[IPC] wipe-company-data: purged ${result.changes} rows for ${companyId}`);
        return { success: true, changes: result.changes };
    }
    catch (e) {
        console.error('[IPC] wipe-company-data failed:', e);
        return { success: false, error: e.message };
    }
});
electron_1.ipcMain.handle('wipe-all-data', async () => {
    try {
        if (db) {
            db.close();
            db = null;
        }
        if (fs.existsSync(appBasePath)) {
            // Safety: Only delete within the app data dir
            fs.rmSync(appBasePath, { recursive: true, force: true });
            fs.mkdirSync(appBasePath, { recursive: true });
        }
        return { success: true };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
});
electron_1.ipcMain.handle('run-backup', async (_, arg1, arg2, arg3) => {
    try {
        let data, fileName, subfolder;
        // Handle object wrapping from preload.ts or positional arguments
        if (typeof arg1 === 'object' && arg1 !== null && arg1.data !== undefined) {
            ({ data, fileName, subfolder } = arg1);
        }
        else {
            data = arg1;
            fileName = arg2;
            subfolder = arg3;
        }
        if (!appBasePath)
            throw new Error("Storage folder not set. Please select a data location in Settings.");
        const paths = getAppPaths(appBasePath);
        let targetDir = paths.backups;
        if (subfolder) {
            const folderName = subfolder.trim().split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            targetDir = path.join(paths.backups, folderName);
            if (!fs.existsSync(targetDir))
                fs.mkdirSync(targetDir, { recursive: true });
        }
        const filePath = path.join(targetDir, fileName || `backup_${Date.now()}.enc`);
        fs.writeFileSync(filePath, data);
        return { success: true, fileName, filePath };
    }
    catch (e) {
        console.error('[IPC] run-backup failed:', e);
        return { success: false, error: e.message };
    }
});
// 5. Automatic Data Backup (triggered by payroll confirmation/rollover)
electron_1.ipcMain.handle('create-data-backup', async (_, arg) => {
    try {
        const fileName = typeof arg === 'string' ? arg : arg.fileName;
        const subfolder = typeof arg === 'object' ? arg.subfolder : '';
        const financialYear = (typeof arg === 'object' && arg.financialYear) ? arg.financialYear : null;
        console.log(`[IPC] create-data-backup requested: ${fileName} in subfolder: ${subfolder}, financialYear: ${financialYear || 'ALL'}`);
        console.log(`[IPC] Current DB instance: ${db ? 'Present' : 'NULL'}`);
        console.log(`[IPC] Current appBasePath: ${appBasePath}`);
        if (!appBasePath)
            throw new Error("Storage folder not set. Please select a data location in Settings.");
        if (!db) {
            // Last ditch effort to recover
            ensureDatabase();
            if (!db)
                throw new Error(`Database connection failed at ${appBasePath}. Please restart the application.`);
        }
        const paths = getAppPaths(appBasePath);
        let targetDir = paths.backups;
        if (subfolder) {
            // Use only the first word and sanitize
            const folderName = subfolder.trim().split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            targetDir = path.join(paths.backups, folderName);
        }
        if (!fs.existsSync(targetDir))
            fs.mkdirSync(targetDir, { recursive: true });
        const tempPath = path.join(targetDir, `${fileName}.sqlite.tmp`);
        const finalPath = path.join(targetDir, `${fileName}.enc`);
        console.log(`[IPC] Creating filtered backup (excluding user/license data, scoped to ${financialYear || 'all FYs'})...`);
        const backupDb = new better_sqlite3_1.default(tempPath);
        backupDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
        const rawRows = db.prepare('SELECT key, value FROM store').all();
        // Filter rows based on financial year if specified
        const rows = financialYear
            ? rawRows.filter(row => {
                if (row.key.includes('_FY')) {
                    return row.key.includes(`_${financialYear}_`);
                }
                return true;
            })
            : rawRows;
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
        console.log(`[IPC] Securing Archive with ${(typeof arg === 'object' && arg.encryptionKey) ? 'Custom Identity Key' : 'Machine Lock'}...`);
        const cipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync(encryptionKey, 'salt', 32), Buffer.alloc(16, 0));
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
    }
    catch (e) {
        console.error('[IPC] Automatic backup failed:', e);
        return { success: false, error: e.message };
    }
});
// 5b. Restore from SQLite Backup (Directly Replace DB File)
electron_1.ipcMain.handle('restore-sqlite-backup', async (_, arg) => {
    try {
        const backupFilePath = typeof arg === 'string' ? arg : arg.path;
        if (!appBasePath)
            throw new Error("App storage not initialized");
        const paths = getAppPaths(appBasePath);
        // Use active company silo if available
        let dataDir = paths.data;
        if (activeCompanyId && activeCompanyId !== 'default') {
            dataDir = path.join(paths.data, activeCompanyId);
            if (!fs.existsSync(dataDir))
                fs.mkdirSync(dataDir, { recursive: true });
        }
        const DB_PATH = path.join(dataDir, 'active_db.sqlite');
        const tempRestorePath = path.join(dataDir, 'restore_temp.sqlite');
        // Check if it's a plain SQLite file or encrypted
        const fd = fs.openSync(backupFilePath, 'r');
        const header = Buffer.alloc(16);
        fs.readSync(fd, header, 0, 16, 0);
        fs.closeSync(fd);
        if (header.toString().startsWith('SQLite format 3')) {
            console.log(`[IPC] Restoring plain SQLite file...`);
            fs.copyFileSync(backupFilePath, tempRestorePath);
        }
        else {
            console.log(`[IPC] Decrypting Secure SQLite Archive...`);
            // --- FORMAT GUARD: Detect CryptoJS/Base64 text files before attempting binary decryption ---
            const formatCheckBuf = Buffer.alloc(256);
            const formatFd = fs.openSync(backupFilePath, 'r');
            const bytesRead = fs.readSync(formatFd, formatCheckBuf, 0, 256, 0);
            fs.closeSync(formatFd);
            const sampleBytes = formatCheckBuf.slice(0, bytesRead);
            const isBase64TextFormat = sampleBytes.every((b) => b >= 32 && b <= 126);
            if (isBase64TextFormat) {
                throw new Error("This backup was created with the legacy PIN-based format. Please use the 'Import Data' option with your original PIN to restore this file.");
            }
            // Try decryption with provided key, stored license key, or fall back to machineId.
            let dbLicenseKey = '';
            if (db) {
                try {
                    const row = db.prepare('SELECT value FROM store WHERE key = ?').get('app_license_data');
                    if (row) {
                        const data = JSON.parse(row.value);
                        dbLicenseKey = data.key || '';
                        console.log(`[IPC] Extracted license identity for fallback: ${dbLicenseKey.substring(0, 4)}...`);
                    }
                }
                catch (e) { }
            }
            const machineId = await getInternalMachineId();
            const keysToTry = [];
            if (typeof arg === 'object' && arg.encryptionKey)
                keysToTry.push(arg.encryptionKey);
            if (dbLicenseKey)
                keysToTry.push(dbLicenseKey);
            keysToTry.push('INITIAL_PMS_KEY'); // Universal safety fallback
            keysToTry.push(machineId);
            let success = false;
            // Filter out empty keys and trim them to ensure exact matching
            const sanitizedKeys = Array.from(new Set(keysToTry.filter(k => !!k).map(k => k.trim())));
            for (const key of sanitizedKeys) {
                console.log(`[IPC] Attempting decryption with: ${key === machineId ? 'Machine ID' : (key === dbLicenseKey ? 'License Identity' : (key === 'INITIAL_PMS_KEY' ? 'Safety Fallback' : 'Provided PIN'))}...`);
                const tryDecrypt = async (k) => {
                    return new Promise((resolve) => {
                        try {
                            const derivedKey = crypto.scryptSync(k, 'salt', 32);
                            const iv = Buffer.alloc(16, 0);
                            const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
                            const input = fs.createReadStream(backupFilePath);
                            const output = fs.createWriteStream(tempRestorePath);
                            const onError = (err) => {
                                console.warn(`[IPC] Decryption attempt failed: ${err.message}`);
                                try {
                                    output.destroy();
                                }
                                catch (_) { }
                                try {
                                    if (fs.existsSync(tempRestorePath))
                                        fs.unlinkSync(tempRestorePath);
                                }
                                catch (_) { }
                                resolve(false);
                            };
                            input.on('error', onError);
                            decipher.on('error', onError);
                            output.on('error', onError);
                            output.on('finish', () => resolve(true));
                            input.pipe(decipher).pipe(output);
                        }
                        catch (e) {
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
        const sourceDb = new better_sqlite3_1.default(tempRestorePath);
        // 2. Read all rows from the source store
        const rows = sourceDb.prepare('SELECT key, value FROM store').all();
        console.log(`[IPC] Read ${rows.length} rows from backup file.`);
        try {
            const logMsg = `[${new Date().toISOString()}] Restore: Read ${rows.length} rows. DB_PATH: ${DB_PATH}\n`;
            const fs = require('fs');
            const path = require('path');
            fs.appendFileSync(path.join(require('electron').app.getPath('userData'), 'restore_log.txt'), logMsg);
        }
        catch (e) { }
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
            db = new better_sqlite3_1.default(DB_PATH, { timeout: 15000 });
            db.pragma('journal_mode = WAL');
        }
        // 4.5 Check for Company Name conflict (V04.01.02: Supports app_ prefixed & scoped keys, and case-insensitive check)
        const activeId = activeCompanyId;
        let backupProfileRow = null;
        if (activeId && activeId !== 'default') {
            backupProfileRow = rows.find(r => r.key === `app_company_profile_${activeId}`);
        }
        if (!backupProfileRow) {
            backupProfileRow = rows.find(r => r.key === 'app_company_profile' || r.key === 'company_profile');
        }
        if (!backupProfileRow && activeId && activeId !== 'default') {
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
                    activeProfileRow = db.prepare("SELECT value FROM store WHERE key = ?").get(`app_company_profile_${activeId}`);
                }
                if (!activeProfileRow) {
                    activeProfileRow = db.prepare("SELECT value FROM store WHERE key = 'app_company_profile' OR key = 'company_profile'").get();
                }
                if (!activeProfileRow) {
                    activeProfileRow = db.prepare("SELECT value FROM store WHERE key LIKE 'app_company_profile%' OR key = 'company_profile'").get();
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
                            return { success: false, error: `Data Restoration Failed: Company Name Mismatch. The backup belongs to '${bNameClean}', but your active importing company is '${aNameClean}'.` };
                        }
                    }
                }
            }
            catch (e) {
                console.warn('[IPC] Failed to parse company profile for name check:', e);
            }
        }
        // 5. Merge rows into active database, skipping excluded keys
        const deleteStmt = db.prepare(`DELETE FROM store WHERE key NOT IN (${excludedKeys.map(() => '?').join(',')})`);
        const upsertStmt = db.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
        db.transaction(() => {
            deleteStmt.run(...excludedKeys);
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
    }
    catch (e) {
        console.error('[IPC] restoration failed:', e);
        if (!db && appBasePath)
            initializeDatabase(appBasePath);
        return { success: false, error: e.message };
    }
});
async function getInternalMachineId() {
    try {
        const output = (0, child_process_1.execSync)('wmic csproduct get uuid', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).toString();
        const lines = output.split(/\r?\n/).filter((line) => line.trim() && !line.includes('UUID'));
        if (lines.length > 0 && lines[0].trim())
            return lines[0].trim();
    }
    catch (e) { }
    try {
        const psOutput = (0, child_process_1.execSync)('powershell.exe -NoProfile -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).toString();
        if (psOutput && psOutput.trim())
            return psOutput.trim();
    }
    catch (e) { }
    return 'FALLBACK-MACHINE-ID-SECURE';
}
// 6. App Closing
electron_1.ipcMain.handle('close-app', async () => {
    console.error("IPC 'close-app' WAS CALLED. STACK TRACE:");
    console.trace();
    electron_1.app.quit();
});
// 6. Machine ID Retrieval
electron_1.ipcMain.handle('get-machine-id', async () => {
    try {
        try {
            // Primary attempt: wmic
            const output = (0, child_process_1.execSync)('wmic csproduct get uuid', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).toString();
            const lines = output.split(/\r?\n/).filter((line) => line.trim() && !line.includes('UUID') && !line.includes('wmic'));
            if (lines.length > 0 && lines[0].trim()) {
                return lines[0].trim();
            }
        }
        catch (e) {
            // Ignore WMIC failure, fallback to PowerShell
        }
        // Fallback: PowerShell (Modern Windows 11)
        const psOutput = (0, child_process_1.execSync)('powershell.exe -NoProfile -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).toString();
        if (psOutput && psOutput.trim()) {
            return psOutput.trim();
        }
        return 'UNKNOWN-MACHINE-ID';
    }
    catch (e) {
        console.error('Failed to get machine ID:', e);
        return 'UNKNOWN-MACHINE-ID';
    }
});
// 7. OS Version Retrieval
electron_1.ipcMain.handle('get-os-version', async () => {
    return os.release();
});
electron_1.ipcMain.handle('set-fullscreen', async (_, flag) => {
    if (mainWindow) {
        mainWindow.setFullScreen(flag);
        return { success: true };
    }
    return { success: false, error: 'No main window' };
});
electron_1.ipcMain.handle('get-fullscreen', async () => {
    if (mainWindow) {
        return mainWindow.isFullScreen();
    }
    return false;
});
electron_1.ipcMain.handle('relaunch-app', () => {
    electron_1.app.relaunch();
    electron_1.app.exit(0);
});
electron_1.ipcMain.handle('open-external', async (_, url) => {
    try {
        await electron_1.shell.openExternal(url);
        return { success: true };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
});
electron_1.ipcMain.handle('api-fetch', async (_, url, options) => {
    try {
        return new Promise((resolve, reject) => {
            const request = electron_1.net.request({
                url,
                method: options?.method || 'GET',
                redirect: 'follow'
            });
            const timeout = setTimeout(() => {
                request.abort();
                reject({ message: '🔌 API Request Timed Out (30s)' });
            }, 30000);
            if (options?.headers) {
                for (const [key, value] of Object.entries(options.headers)) {
                    request.setHeader(key, value);
                }
            }
            request.on('response', (response) => {
                let responseData = '';
                response.on('data', (chunk) => {
                    responseData += chunk.toString('utf8');
                });
                response.on('end', () => {
                    clearTimeout(timeout);
                    let responseBody;
                    try {
                        responseBody = JSON.parse(responseData);
                    }
                    catch {
                        responseBody = responseData;
                    }
                    if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
                        console.error(`🔌 fetch failed [${response.statusCode}]:`, responseBody);
                        reject({ message: `HTTP error! status: ${response.statusCode}` });
                    }
                    else {
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
    }
    catch (error) {
        throw { message: error.message };
    }
});
// 8. Dynamic Folder Detection
electron_1.ipcMain.handle('find-bpp-app', async () => {
    try {
        const potentialRoots = [];
        // 1. Get all logical drives on Windows
        try {
            const output = (0, child_process_1.execSync)('wmic logicaldisk get name', { encoding: 'utf8' });
            const drives = output.split(/\r?\n/)
                .filter(line => line.trim() && line.includes(':'))
                .map(line => line.trim());
            drives.forEach(drive => {
                potentialRoots.push(path.join(drive, 'BPP_APP'));
                potentialRoots.push(path.join(drive, 'BharatPayRoll', 'BPP_APP'));
                potentialRoots.push(path.join(drive, 'BPP', 'BPP_APP')); // Check subfolder too
            });
        }
        catch (e) {
            // Fallback if WMIC fails
            ['C:', 'D:', 'E:', 'F:', 'G:', 'H:'].forEach(d => {
                potentialRoots.push(path.join(d, '/', 'BPP_APP'));
                potentialRoots.push(path.join(d, '/', 'BharatPayRoll', 'BPP_APP'));
            });
        }
        // 2. Add User Home
        potentialRoots.push(path.join(electron_1.app.getPath('home'), 'BPP_APP'));
        potentialRoots.push(path.join(electron_1.app.getPath('home'), 'BharatPayRoll', 'BPP_APP'));
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
    }
    catch (e) {
        return { success: false, error: e.message };
    }
});
// ── 9. SMART AUTO-UPDATE HANDLERS ──
const INSTALLER_NAME = 'bpp_installer.exe';
const getInstallerPath = () => path.join(os.tmpdir(), INSTALLER_NAME);
let isUpdateDownloading = false;
let closeRequested = false;
electron_1.ipcMain.handle('start-update-download', async (_, downloadUrl, expectedHash) => {
    isUpdateDownloading = true;
    return new Promise((resolve) => {
        try {
            const dest = getInstallerPath();
            const file = fs.createWriteStream(dest);
            const request = electron_1.net.request({
                url: downloadUrl,
                redirect: 'follow'
            });
            request.on('response', (response) => {
                const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
                let downloadedBytes = 0;
                let lastEmittedProgress = -1;
                response.on('data', (chunk) => {
                    file.write(chunk);
                    downloadedBytes += chunk.length;
                    if (totalBytes > 0) {
                        const progress = Math.round((downloadedBytes / totalBytes) * 100);
                        if (progress !== lastEmittedProgress) {
                            lastEmittedProgress = progress;
                            electron_1.BrowserWindow.getAllWindows().forEach(win => {
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
                    }
                    catch (e) {
                        console.error('❌ Failed to verify binary header:', e);
                    }
                    // ── SHA-256 INTEGRITY VERIFICATION ──
                    if (expectedHash && expectedHash.trim() !== "") {
                        console.log('🛡️ Verifying SHA-256 integrity...');
                        try {
                            const hash = crypto.createHash('sha256');
                            const input = fs.createReadStream(dest);
                            const calculatedHash = await new Promise((res, rej) => {
                                input.on('data', chunk => hash.update(chunk));
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
                        }
                        catch (hashErr) {
                            console.error('❌ Hash calculation failed:', hashErr);
                            fs.unlinkSync(dest);
                            isUpdateDownloading = false;
                            resolve({ success: false, error: 'Integrity check failed' });
                            return;
                        }
                    }
                    electron_1.BrowserWindow.getAllWindows().forEach(win => {
                        win.webContents.send('update-download-complete');
                    });
                    isUpdateDownloading = false;
                    console.log(`✅ Update download finished. Total Bytes: ${fs.statSync(dest).size}`);
                    resolve({ success: true, path: dest });
                    if (closeRequested)
                        electron_1.app.quit();
                });
                response.on('error', (err) => {
                    file.end();
                    fs.unlink(dest, () => { });
                    console.error('❌ Update download stream failed:', err);
                    isUpdateDownloading = false;
                    resolve({ success: false, error: err.message });
                    if (closeRequested)
                        electron_1.app.quit();
                });
            });
            request.on('error', (err) => {
                file.end();
                fs.unlink(dest, () => { });
                console.error('❌ Update request failed:', err);
                isUpdateDownloading = false;
                resolve({ success: false, error: err.message });
                if (closeRequested)
                    electron_1.app.quit();
            });
            request.end();
        }
        catch (e) {
            resolve({ success: false, error: e.message });
        }
    });
});
electron_1.ipcMain.handle('backup-and-install', (_, options) => {
    const isSilent = options?.silent ?? false;
    const installerPath = getInstallerPath();
    // 1. INSTANT TERMINATION SIGNAL: Destroy windows immediately
    electron_1.BrowserWindow.getAllWindows().forEach(win => {
        try {
            win.destroy();
        }
        catch (e) { }
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
                }
                catch (e) { }
                db = null;
            }
            // B. Snapshot/Backup
            try {
                if (appBasePath) {
                    const paths = getAppPaths(appBasePath);
                    const snapshotDir = path.join(paths.backups, `v${electron_1.app.getVersion()}_SAFETY_BACKUP`);
                    if (!fs.existsSync(snapshotDir))
                        fs.mkdirSync(snapshotDir, { recursive: true });
                    const dbFile = path.join(paths.data, 'active_db.sqlite');
                    if (fs.existsSync(dbFile)) {
                        fs.copyFileSync(dbFile, path.join(snapshotDir, 'active_db_snapshot.sqlite'));
                    }
                }
            }
            catch (backupErr) {
                console.warn('⚠️ Safety backup skipped:', backupErr);
            }
            // C. POWER LAUNCH: Wait 2s -> Kill BPP_APP -> Launch Installer
            // This ensures no 'Already Running' warning pops up.
            try {
                // Determine binary name for taskkill
                const exeName = electron_1.app.isPackaged ? 'BPP_APP.exe' : 'electron.exe';
                // Chain: Delay -> Taskkill -> Delay -> Start Installer
                const command = `timeout /t 2 /nobreak && taskkill /F /IM ${exeName} /T & timeout /t 1 /nobreak & start "" "${installerPath}" ${isSilent ? '/S' : ''}`;
                (0, child_process_1.spawn)('cmd', ['/c', command], {
                    detached: true,
                    stdio: 'ignore',
                    windowsHide: true,
                    shell: true
                }).unref();
                console.log('🚀 Defensive sequence triggered via CMD.');
            }
            catch (launchErr) {
                console.error('🚀 Primary launch failed, trying fallback:', launchErr);
                electron_1.shell.openPath(installerPath);
            }
            // D. FINAL EXIT
            electron_1.app.exit(0);
        }
        catch (err) {
            console.error('❌ Critical failure in relauncher:', err);
            electron_1.app.exit(1);
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
            rootFiles.forEach((file) => {
                if (file.toLowerCase().endsWith('.exe') && file.toLowerCase().includes('bpp_app')) {
                    // This might be an old version left behind. 
                    // We don't delete immediately to be safe, but we log it.
                    console.log(`ℹ️ Found potential legacy EXE in root: ${file}`);
                }
            });
        }
    }
    catch (e) {
        console.warn('⚠️ Cleanup check skipped:', e);
    }
}
console.log("-----------------------------------------");
console.log("ELECTRON MAIN PROCESS: HANDLERS READY");
console.log("-----------------------------------------");
