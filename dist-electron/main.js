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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const child_process_1 = require("child_process");
const os = __importStar(require("os"));
let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development';
// ── CONFIGURATION & PERSISTENCE ──
const CONFIG_PATH = path.join(electron_1.app.getPath('userData'), 'app-config.json');
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
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
let appConfig = getAppConfig();
let appBasePath = appConfig.appBasePath || '';
// Helper to get structured paths
const getAppPaths = (base) => {
    const root = path.join(base, 'BharatPP');
    return {
        root,
        data: path.join(root, 'Data'),
        reports: path.join(root, 'Report files'),
        backups: path.join(root, 'Data backup')
    };
};
// ── DATABASE INITIALIZATION ──
let db = null;
function initializeDatabase(basePath) {
    const paths = getAppPaths(basePath);
    // Ensure directories exist
    [paths.data, paths.reports, paths.backups].forEach((dir) => {
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
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
        }
        catch (e) {
            console.error('❌ Auto-restore failed:', e);
        }
    }
    try {
        db = new better_sqlite3_1.default(DB_PATH);
        db.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
    }
    catch (e) {
        console.error('❌ DB connection failed. Database might be corrupted.', e);
        // If corrupted and snapshot exists, try a hail-mary restore
        if (fs.existsSync(snapshotDb)) {
            try {
                if (db)
                    db.close();
                fs.copyFileSync(snapshotDb, DB_PATH);
                db = new better_sqlite3_1.default(DB_PATH);
                console.log('🛠️ Corrupted DB replaced with snapshot.');
            }
            catch (restoreErr) {
                console.error('❌ Hail-mary restore failed.', restoreErr);
            }
        }
    }
}
if (appBasePath) {
    try {
        initializeDatabase(appBasePath);
    }
    catch (e) {
        console.error("Failed to initialize database at stored path:", e);
        appBasePath = ''; // Reset if path is invalid
    }
}
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
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(() => {
    createWindow();
    cleanupOldInstallers();
});
electron_1.app.on('window-all-closed', () => {
    console.error("EVENT 'window-all-closed' WAS FIRED. STACK TRACE:");
    console.trace();
    if (process.platform !== 'darwin')
        electron_1.app.quit();
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
// 2. Report Saving
electron_1.ipcMain.handle('save-report', async (_, { fileName, data, type }) => {
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
    }
    catch (e) {
        console.error('[IPC] Save report failed:', e);
        return { success: false, error: e.message };
    }
});
// 2b. Open File Location (Triggered after user closes dialog)
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
// 3. Simple Key-Value Store
electron_1.ipcMain.handle('db-set', async (_, { key, value }) => {
    try {
        if (!db)
            throw new Error("Database not initialized");
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
        if (!db)
            return { success: true, data: null };
        const row = db.prepare('SELECT value FROM store WHERE key = ?').get(key);
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
// 4. Encrypted Manual Backup
electron_1.ipcMain.handle('run-backup', async (_, encryptedData) => {
    try {
        if (!appBasePath)
            throw new Error("App storage not initialized");
        const paths = getAppPaths(appBasePath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
        const fileName = `backup_${timestamp[0]}_${timestamp[1].slice(0, 8)}.enc`;
        const filePath = path.join(paths.backups, fileName);
        fs.writeFileSync(filePath, encryptedData);
        return { success: true, fileName };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
});
// 5. Automatic Data Backup (triggered by payroll confirmation/rollover)
electron_1.ipcMain.handle('create-data-backup', async (_, fileName) => {
    try {
        if (!appBasePath || !db)
            throw new Error("App storage or database not initialized");
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
    }
    catch (e) {
        console.error('[IPC] Automatic backup failed:', e);
        return { success: false, error: e.message };
    }
});
// 5b. Restore from SQLite Backup (Directly Replace DB File)
electron_1.ipcMain.handle('restore-sqlite-backup', async (_, backupFilePath) => {
    try {
        if (!appBasePath)
            throw new Error("App storage not initialized");
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
    }
    catch (e) {
        console.error('[IPC] SQLite restoration failed:', e);
        // Attempt to re-init if closed
        if (!db && appBasePath)
            initializeDatabase(appBasePath);
        return { success: false, error: e.message };
    }
});
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
                potentialRoots.push(path.join(drive, 'BPP', 'BPP_APP')); // Check subfolder too
            });
        }
        catch (e) {
            // Fallback if WMIC fails
            ['C:', 'D:', 'E:', 'F:', 'G:', 'H:'].forEach(d => {
                potentialRoots.push(path.join(d, '/', 'BPP_APP'));
            });
        }
        // 2. Add User Home
        potentialRoots.push(path.join(electron_1.app.getPath('home'), 'BPP_APP'));
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
electron_1.ipcMain.handle('start-update-download', async (_, downloadUrl) => {
    return new Promise((resolve) => {
        try {
            const dest = getInstallerPath();
            const file = fs.createWriteStream(dest);
            const request = electron_1.net.request({
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
                    electron_1.BrowserWindow.getAllWindows().forEach(win => {
                        win.webContents.send('update-download-complete');
                    });
                    resolve({ success: true, path: dest });
                });
                response.on('error', (err) => {
                    file.end();
                    fs.unlink(dest, () => { });
                    console.error('❌ Update download stream failed:', err);
                    resolve({ success: false, error: err.message });
                });
            });
            request.on('error', (err) => {
                file.end();
                fs.unlink(dest, () => { });
                console.error('❌ Update request failed:', err);
                resolve({ success: false, error: err.message });
            });
            request.end();
        }
        catch (e) {
            resolve({ success: false, error: e.message });
        }
    });
});
electron_1.ipcMain.handle('backup-and-install', async () => {
    try {
        if (!appBasePath)
            throw new Error("App storage not initialized");
        const paths = getAppPaths(appBasePath);
        const snapshotDir = path.join(paths.backups, 'PRE_UPDATE_SNAPSHOT');
        if (!fs.existsSync(snapshotDir))
            fs.mkdirSync(snapshotDir, { recursive: true });
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
        if (!fs.existsSync(installerPath))
            throw new Error("Installer file not found");
        console.log('🚀 Launching update installer...');
        // Use spawn to launch detached so we can quit Electron immediately
        // By passing /currentuser we tell NSIS not to ask the "Who should this apply to?" question.
        // We also force the directory so it doesn't accidentally install a duplicate copy in %LOCALAPPDATA%.
        const installDir = path.dirname(process.execPath);
        const child = (0, child_process_1.spawn)(installerPath, ['/currentuser', `/D=${installDir}`], {
            detached: true,
            stdio: 'ignore'
        });
        child.unref();
        electron_1.app.quit();
        return { success: true };
    }
    catch (e) {
        console.error('❌ Pre-update backup or install failed:', e);
        // Attempt to re-init DB if failed
        if (appBasePath && !db)
            initializeDatabase(appBasePath);
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
