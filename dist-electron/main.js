"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
var nodemailer_1 = __importDefault(require("nodemailer"));
var path = __importStar(require("path"));
var fs = __importStar(require("fs"));
var better_sqlite3_1 = __importDefault(require("better-sqlite3"));
var crypto = __importStar(require("crypto"));
var child_process_1 = require("child_process");
var os = __importStar(require("os"));
var mainWindow = null;
var isDev = process.env.NODE_ENV === 'development';
// Force App Name to ensure consistency in OS-level paths before anything else
electron_1.app.name = 'BharatPayPro';
// Force Electron to use EXACTLY "BharatPayPro" folder in %APPDATA% 
// This prevents it from creating multiple random folders like "BPP_APP" or "bharatpay-pro"
var appDataPath = electron_1.app.getPath('appData');
var newUserData = path.join(appDataPath, 'BharatPayPro');
electron_1.app.setPath('userData', newUserData);
// ── CONFIGURATION & PERSISTENCE ──
// Auto-migrate old configs to prevent data loss for existing users!
var oldDirs = ['BPP_APP', 'bharatpay-pro', 'BharatPayRoll'];
for (var _i = 0, oldDirs_1 = oldDirs; _i < oldDirs_1.length; _i++) {
    var oldDir = oldDirs_1[_i];
    var oldConfigPath = path.join(appDataPath, oldDir, isDev ? 'app-config-dev.json' : 'app-config.json');
    var newConfigPath = path.join(newUserData, isDev ? 'app-config-dev.json' : 'app-config.json');
    if (fs.existsSync(oldConfigPath) && !fs.existsSync(newConfigPath)) {
        try {
            if (!fs.existsSync(newUserData))
                fs.mkdirSync(newUserData, { recursive: true });
            fs.copyFileSync(oldConfigPath, newConfigPath);
            console.log("[Migration] Migrated old config from ".concat(oldDir, " to BharatPayPro"));
        }
        catch (e) { }
    }
}
// V03.01.06: Isolate Developer and Production database configurations
var CONFIG_PATH = isDev
    ? path.join(electron_1.app.getPath('userData'), 'app-config-dev.json')
    : path.join(electron_1.app.getPath('userData'), 'app-config.json');
console.log("\uD83D\uDE80 Electron v".concat(process.versions.electron, " | Node ").concat(process.versions.node, " | Chrome ").concat(process.versions.chrome));
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
        var dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        console.log("\u2705 App config saved to: ".concat(CONFIG_PATH));
    }
    catch (e) {
        console.error("\u274C Failed to save app config:", e);
    }
}
var appConfig = getAppConfig();
var appBasePath = appConfig.appBasePath || (isDev ? 'E:\\BharatPP_Dev' : '');
// Helper to get structured paths
var getAppPaths = function (base) {
    // Standardize architecture: The physical root is ALWAYS inside a "BharatPP" folder.
    // If the user selected a directory already named exactly "BharatPP", we use it as-is.
    // Otherwise, we automatically nest everything inside a "BharatPP" subfolder.
    var isExactlyBharatPP = path.basename(base).toLowerCase() === 'bharatpp';
    var actualRoot = isExactlyBharatPP ? base : path.join(base, 'BharatPP');
    return {
        root: actualRoot, // The Global Registry DB stays EXACTLY in the BharatPP folder
        data: path.join(actualRoot, 'Data'),
        reports: path.join(actualRoot, 'Report files'),
        backups: path.join(actualRoot, 'Data backup'),
        templates: path.join(actualRoot, 'Templates')
    };
};
// ── DATABASE INITIALIZATION ──
var db = null;
var activeCompanyId = null;
function initializeDatabase(basePath, companyId) {
    if (!basePath) {
        console.error('❌ Cannot initialize database: basePath is empty');
        return;
    }
    // V07: Prevent database creation inside installation directory
    if (basePath.includes('BPP_APP') || basePath.includes(electron_1.app.getAppPath())) {
        console.error('❌ FATAL: Cannot initialize database inside BPP_APP installation folder for security reasons.');
        return;
    }
    // V03.01.07: Forced base path to User App folder for debugging
    // console.log(`🔍 Original basePath: ${basePath}. Forcing to E:\\BharatPP_Dev`);
    // basePath = 'E:\\BharatPP_Dev';
    appBasePath = basePath;
    var paths = getAppPaths(basePath);
    // --- V06.01.03: Auto-Repair from temporary DB ---
    try {
        var repairDbPath = path.join(paths.root, 'temp_active_db.sqlite');
        var rootDbPath = path.join(paths.root, 'active_db.sqlite');
        if (fs.existsSync(repairDbPath)) {
            console.log("[Auto-Repair] Found temp_active_db.sqlite in root folder! Overwriting active_db.sqlite...");
            fs.copyFileSync(repairDbPath, rootDbPath);
            fs.unlinkSync(repairDbPath);
            console.log("[Auto-Repair] Master database recovered successfully.");
        }
    }
    catch (err) {
        console.error("[Auto-Repair] Failed to apply repair DB:", err);
    }
    // V03.01.03: Direct Silo Provisioning
    activeCompanyId = companyId || activeCompanyId || null;
    var dataDir = paths.data;
    if (activeCompanyId && activeCompanyId !== 'default' && activeCompanyId !== 'null') {
        dataDir = path.join(paths.data, activeCompanyId);
        // FORCE CREATE THE SILO FOLDER
        if (!fs.existsSync(dataDir)) {
            console.log("[DB] Provisioning silo folder: ".concat(dataDir));
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }
    // DEBUG TRACER: Write current state to a file for diagnosis
    try {
        var debugInfo = "[".concat(new Date().toLocaleString(), "] ID: ").concat(activeCompanyId, " | DIR: ").concat(dataDir, "\n");
        fs.appendFileSync(path.join(paths.data, 'silo_debug.txt'), debugInfo);
    }
    catch (e) { }
    var DB_PATH = path.join(dataDir, 'active_db.sqlite');
    // Ensure directories exist
    var dirsToCreate = [dataDir, paths.reports, paths.backups, paths.templates];
    dirsToCreate.forEach(function (dir) {
        try {
            if (!fs.existsSync(dir)) {
                console.log("\uD83D\uDCC1 Creating directory: ".concat(dir));
                fs.mkdirSync(dir, { recursive: true });
            }
        }
        catch (err) {
            console.error("\u274C Permission Error: Failed to create directory: ".concat(dir), err);
            throw new Error("Permission Denied: Cannot create folder at ".concat(dir, ". Please ensure you have write access to this location."));
        }
    });
    try {
        console.log("\uD83D\uDDC4\uFE0F Opening isolated database: ".concat(DB_PATH));
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
        // V06.01.01: Legacy Auto-Migrator
        // If this is the Root DB (no companyId specified), run the auto migrator!
        if (!companyId || companyId === 'default' || companyId === 'null') {
            performLegacyAutoMigration(db, paths).catch(function (e) { return console.error("AutoMigration Error:", e); });
            performAutoRescue(db, paths).catch(function (e) { return console.error("AutoRescue Error:", e); });
        }
        // V03.01.07: Create a startup backup
        try {
            var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            var autoBackupDir_1 = path.join(paths.backups, 'AUTO_SNAPSHOTS');
            if (!fs.existsSync(autoBackupDir_1)) {
                fs.mkdirSync(autoBackupDir_1, { recursive: true });
            }
            var backupPath_1 = path.join(autoBackupDir_1, "startup_db_".concat(timestamp, ".sqlite"));
            // Use safe backup API
            db.backup(backupPath_1)
                .then(function () {
                console.log("\u2705 Startup snapshot created: ".concat(backupPath_1));
                cleanupOldSnapshots(autoBackupDir_1, 5); // Keep last 5
            })
                .catch(function (e) { return console.error("\u274C Failed to create startup snapshot:", e); });
            // Start interval snapshots
            startAutoSnapshot(basePath, companyId || 'default');
        }
        catch (e) {
            console.error("\u274C Failed to initialize snapshot system:", e);
        }
    }
    catch (e) {
        console.error('❌ DB connection failed:', e);
        var errorLog = "[".concat(new Date().toISOString(), "] DB connection failed at ").concat(DB_PATH, ": ").concat(e.message, "\n");
        fs.appendFileSync(path.join(electron_1.app.getPath('userData'), 'electron_errors.txt'), errorLog);
        // V03.01.07: Log error to a file we can easily access
        try {
            var errorFilePath = path.join(paths.data, 'error_log.txt');
            fs.appendFileSync(errorFilePath, errorLog);
            console.log("\uD83D\uDCDD Error logged to: ".concat(errorFilePath));
        }
        catch (err) { }
        // V03.01.07: Safe Recovery from Snapshot
        var snapshotDb = path.join(paths.backups, 'PRE_UPDATE_SNAPSHOT', 'active_db_snapshot.sqlite');
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
                    var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    var failedPath = "".concat(DB_PATH, ".failed_").concat(timestamp);
                    fs.renameSync(DB_PATH, failedPath);
                    console.warn("\u26A0\uFE0F Failed DB preserved at: ".concat(failedPath));
                }
                fs.copyFileSync(snapshotDb, DB_PATH);
                db = new better_sqlite3_1.default(DB_PATH);
                console.log('✅ Safe recovery successful using snapshot.');
            }
            catch (restoreErr) {
                throw new Error("Database Error: ".concat(e.message, ". Recovery failed: ").concat(restoreErr.message));
            }
        }
        else {
            throw new Error("Database Error: ".concat(e.message, ". Path: ").concat(DB_PATH));
        }
    }
}
function cleanupOldSnapshots(dir, maxFiles) {
    try {
        var files = fs.readdirSync(dir)
            .filter(function (f) { return f.endsWith('.sqlite'); })
            .map(function (f) { return ({ name: f, stat: fs.statSync(path.join(dir, f)) }); })
            .sort(function (a, b) { return b.stat.mtime.getTime() - a.stat.mtime.getTime(); });
        if (files.length > maxFiles) {
            for (var i = maxFiles; i < files.length; i++) {
                fs.unlinkSync(path.join(dir, files[i].name));
                console.log("\uD83D\uDDD1\uFE0F Deleted old snapshot: ".concat(files[i].name));
            }
        }
    }
    catch (e) {
        console.error("\u274C Failed to cleanup old snapshots:", e);
    }
}
var autoSnapshotInterval = null;
function startAutoSnapshot(basePath, _companyId) {
    if (autoSnapshotInterval)
        clearInterval(autoSnapshotInterval);
    autoSnapshotInterval = setInterval(function () {
        if (!db)
            return;
        try {
            var paths = getAppPaths(basePath);
            var autoBackupDir_2 = path.join(paths.backups, 'AUTO_SNAPSHOTS');
            if (!fs.existsSync(autoBackupDir_2))
                fs.mkdirSync(autoBackupDir_2, { recursive: true });
            var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            var backupPath_2 = path.join(autoBackupDir_2, "auto_db_".concat(timestamp, ".sqlite"));
            db.backup(backupPath_2)
                .then(function () {
                console.log("\u2705 Auto snapshot created: ".concat(backupPath_2));
                cleanupOldSnapshots(autoBackupDir_2, 24); // Keep last 24 for auto (2 hours)
            })
                .catch(function (e) { return console.error("\u274C Failed to create auto snapshot:", e); });
        }
        catch (e) {
            console.error("\u274C Failed to create auto snapshot:", e);
        }
    }, 5 * 60 * 1000); // Every 5 minutes
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
    var config = getAppConfig();
    var savedPath = config.appBasePath || appBasePath;
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
            var errorLog = "[".concat(new Date().toISOString(), "] On-demand recovery failed: ").concat(e.message, "\n");
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
    // V06.01.03: INFINITE RECURSION PREVENTION
    // Resolve absolute paths to prevent copying a folder into its own subdirectory
    var absoluteSrc = path.resolve(src);
    var absoluteDest = path.resolve(dest);
    if (absoluteDest.startsWith(absoluteSrc + path.sep) || absoluteDest === absoluteSrc) {
        console.warn("[IPC] Blocked recursive copy loop. Cannot copy ".concat(absoluteSrc, " into ").concat(absoluteDest));
        return;
    }
    if (!fs.existsSync(dest))
        fs.mkdirSync(dest, { recursive: true });
    var entries = fs.readdirSync(src, { withFileTypes: true });
    for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
        var entry = entries_1[_i];
        var srcPath = path.join(src, entry.name);
        var destPath = path.join(dest, entry.name);
        // Final sanity check for nested folders
        if (path.resolve(destPath).startsWith(path.resolve(srcPath)))
            continue;
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
    var _this = this;
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
        closable: true,
        show: false, // Don't show until ready-to-show
    });
    var isInitializingPhase = true;
    var initSafetyTimer = null;
    var releaseAlwaysOnTop = function () {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(false);
            isInitializingPhase = false;
            if (initSafetyTimer) {
                clearTimeout(initSafetyTimer);
                initSafetyTimer = null;
            }
        }
    };
    var bringWindowToFront = function (win) {
        if (!win || win.isDestroyed())
            return;
        win.show();
        win.restore();
        win.focus();
        win.setAlwaysOnTop(true, 'screen-saver');
        win.moveTop();
        // Keep window pinned to active foreground during initialization and login loading
        initSafetyTimer = setTimeout(function () {
            releaseAlwaysOnTop();
        }, 12000);
    };
    // Auto-release always-on-top if the user intentionally interferes (e.g. clicks another app or Alt-Tabs)
    mainWindow.on('blur', function () {
        if (isInitializingPhase) {
            releaseAlwaysOnTop();
        }
    });
    var isWindowRevealed = false;
    var revealWindowNow = function () {
        if (isWindowRevealed)
            return;
        isWindowRevealed = true;
        if (mainWindow && !mainWindow.isDestroyed()) {
            bringWindowToFront(mainWindow);
            // Instantly kill transition HTA popup (bpp_launch_msg.hta) as soon as main window appears
            try {
                (0, child_process_1.exec)('taskkill /F /IM mshta.exe /T');
            }
            catch (_) { }
        }
    };
    mainWindow.once('ready-to-show', function () {
        // Present window IMMEDIATELY on launch to keep Initialization Page active in the foreground!
        revealWindowNow();
    });
    mainWindow.on('close', function (e) {
        if (isUpdateDownloading) {
            e.preventDefault();
            closeRequested = true;
            mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('update-close-warning');
        }
    });
    electron_1.ipcMain.handle('app-initialization-complete', function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            console.log('[IPC] App initialization & Login loading complete. Releasing always-on-top.');
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setAlwaysOnTop(false);
                mainWindow.focus();
            }
            return [2 /*return*/, { success: true }];
        });
    }); });
    // We will export a method for the downloader to call when finished
    electron_1.ipcMain.handle('hard-reset-app', function () { return __awaiter(_this, void 0, void 0, function () {
        var appDataPath_1, targetDirs, _i, targetDirs_1, dir;
        return __generator(this, function (_a) {
            try {
                console.log('[IPC] hard-reset-app requested');
                appDataPath_1 = electron_1.app.getPath('appData');
                targetDirs = [
                    path.join(appDataPath_1, 'BPP_APP'),
                    path.join(appDataPath_1, 'bharatpay-pro'),
                    path.join(appDataPath_1, 'BharatPayPro')
                ];
                for (_i = 0, targetDirs_1 = targetDirs; _i < targetDirs_1.length; _i++) {
                    dir = targetDirs_1[_i];
                    if (fs.existsSync(dir)) {
                        fs.rmSync(dir, { recursive: true, force: true });
                        console.log("[IPC] Wiped configuration directory: ".concat(dir));
                    }
                }
                // Relaunch and exit
                electron_1.app.relaunch();
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.setClosable(true);
                    mainWindow.destroy();
                }
                electron_1.app.quit();
                return [2 /*return*/, { success: true }];
            }
            catch (error) {
                console.error('[IPC] hard-reset-app failed:', error);
                return [2 /*return*/, { success: false, error: error.message }];
            }
            return [2 /*return*/];
        });
    }); });
    electron_1.ipcMain.handle('close-update-message', function () {
        try {
            console.log('[IPC] close-update-message requested: revealing rendered window and keeping HTA popup active for 3.5s while progress bar moves');
            revealWindowNow();
            setTimeout(function () {
                try {
                    (0, child_process_1.spawn)('taskkill', ['/F', '/IM', 'mshta.exe'], { windowsHide: true });
                }
                catch (e) { }
            }, 3500);
            return { success: true };
        }
        catch (e) {
            console.error('[IPC] close-update-message failed:', e);
            return { success: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle('check-close-requested', function () {
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
        mainWindow.webContents.on('devtools-opened', function () {
            mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.closeDevTools();
        });
        mainWindow.webContents.on('before-input-event', function (event, input) {
            var key = input.key.toLowerCase();
            if ((input.control && input.shift && (key === 'i' || key === 'j' || key === 'c')) || input.key === 'F12') {
                event.preventDefault();
            }
        });
        mainWindow.webContents.on('context-menu', function (e) {
            e.preventDefault();
        });
    }
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}
// ── SINGLE INSTANCE LOCK ──────────────────────────────────────────────────
// Prevent multiple instances of BPP_APP from running simultaneously in production.
var gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    // A second instance tried to launch — focus existing window or quit.
    electron_1.app.on('ready', function () {
        electron_1.app.quit();
    });
}
else {
    // If a second instance attempts while we are the primary, focus our window.
    electron_1.app.on('second-instance', function () {
        if (mainWindow && !isDev) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
            mainWindow.moveTop();
            setTimeout(function () {
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
var isWin7 = os.platform() === 'win32' && parseInt(os.release().split('.')[0]) <= 6;
var isLegacyElectron = parseInt(process.versions.electron.split('.')[0]) < 30;
if (isWin7 || isLegacyElectron || process.argv.includes('--disable-gpu')) {
    console.warn('⚠️ Legacy OS or GPU Disabled Flag detected. Disabling Hardware Acceleration to prevent GLES crashes.');
    electron_1.app.disableHardwareAcceleration();
}
electron_1.app.whenReady().then(function () {
    if (!gotTheLock)
        return; // Prevent main app initialization when running as second instance
    // 🔥 ULTRA-FAST STARTUP (V02.02.26) 🔥
    // 1. Create window immediately for perception of speed
    createWindow();
    // 2. Initializing database and cleanup in background
    if (appBasePath) {
        try {
            console.log("\uD83D\uDD04 Auto-initializing database from config: ".concat(appBasePath));
            initializeDatabase(appBasePath);
        }
        catch (e) {
            console.error("❌ Failed to initialize database at stored path:", e);
            // V03.01.02: Don't clear appBasePath immediately if it exists on disk but failed to open (e.g. locked)
            // Only clear if the path itself is invalid/missing
            if (!fs.existsSync(appBasePath)) {
                appBasePath = '';
                saveAppConfig(__assign(__assign({}, getAppConfig()), { appBasePath: '' }));
            }
        }
    }
    else {
        console.warn("⚠️ No stored appBasePath found in config.");
    }
    cleanupOldInstallers();
});
electron_1.app.on('window-all-closed', function () {
    console.error("EVENT 'window-all-closed' WAS FIRED. STACK TRACE:");
    console.trace();
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('will-quit', function () {
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
electron_1.ipcMain.handle('select-app-directory', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!mainWindow)
                    return [2 /*return*/, { success: false, error: 'No main window' }];
                return [4 /*yield*/, electron_1.dialog.showOpenDialog(mainWindow, {
                        properties: ['openDirectory', 'createDirectory'],
                        title: 'Select Application Storage Location'
                    })];
            case 1:
                result = _a.sent();
                if (result.canceled || result.filePaths.length === 0) {
                    return [2 /*return*/, { success: false, canceled: true }];
                }
                return [2 /*return*/, { success: true, path: result.filePaths[0] }];
        }
    });
}); });
electron_1.ipcMain.handle('initialize-app-directory', function (_, selectedPath) { return __awaiter(void 0, void 0, void 0, function () {
    var oldPaths, newPaths, oldRegistry, newRegistry, newFiles;
    return __generator(this, function (_a) {
        try {
            // ENFORCE ISOLATION: Prevent nesting BharatPP inside BPP_APP
            if (selectedPath.endsWith('BPP_APP') || selectedPath.endsWith('BPP_APP\\') || selectedPath.endsWith('BPP_APP/')) {
                selectedPath = path.dirname(selectedPath);
            }
            if (appBasePath && appBasePath !== selectedPath) {
                console.log("[IPC] Migrating from ".concat(appBasePath, " to ").concat(selectedPath));
                oldPaths = getAppPaths(appBasePath);
                newPaths = getAppPaths(selectedPath);
                // V06.01.03: Prevent Migrating into own sub-directory
                if (path.resolve(selectedPath).startsWith(path.resolve(appBasePath) + path.sep)) {
                    return [2 /*return*/, { success: false, error: 'Cannot migrate into a sub-folder of the existing directory. Please select a different location.' }];
                }
                oldRegistry = path.join(oldPaths.root, 'active_db.sqlite');
                newRegistry = path.join(newPaths.root, 'active_db.sqlite');
                if (fs.existsSync(oldRegistry) && !fs.existsSync(newRegistry)) {
                    try {
                        fs.copyFileSync(oldRegistry, newRegistry);
                        console.log("[IPC] Copied registry DB to ".concat(newRegistry));
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
                    newFiles = fs.readdirSync(newPaths.data);
                    if (newFiles.length === 0 || (newFiles.length === 1 && newFiles[0] === 'active_db.sqlite')) {
                        console.log("[IPC] Migrating data folder from ".concat(oldPaths.data, " to ").concat(newPaths.data));
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
            saveAppConfig(__assign(__assign({}, getAppConfig()), { appBasePath: appBasePath }));
            return [2 /*return*/, { success: true }];
        }
        catch (e) {
            console.error('Failed to initialize app directory:', e);
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
electron_1.ipcMain.handle('get-app-directory', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        if (appBasePath && (appBasePath.includes('BPP_APP') || appBasePath.includes(electron_1.app.getAppPath()))) {
            console.error('❌ Security block: Configured directory is inside installation folder. Forcing setup.');
            appBasePath = '';
            saveAppConfig(__assign(__assign({}, getAppConfig()), { appBasePath: '' }));
            return [2 /*return*/, null];
        }
        return [2 /*return*/, appBasePath || null];
    });
}); });
electron_1.ipcMain.handle('switch-company-data', function (_, companyId) { return __awaiter(void 0, void 0, void 0, function () {
    var paths, siloPath;
    return __generator(this, function (_a) {
        try {
            if (!appBasePath)
                throw new Error("Storage path not set");
            console.log("[IPC] Switching to company data silo: ".concat(companyId));
            // 1. Force provision the folder if it's a real company (not 'default')
            if (companyId && companyId !== 'default') {
                paths = getAppPaths(appBasePath);
                siloPath = path.join(paths.data, companyId);
                if (!fs.existsSync(siloPath)) {
                    console.log("[IPC] Provisioning new physical silo at: ".concat(siloPath));
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
            return [2 /*return*/, { success: true }];
        }
        catch (e) {
            console.error('[IPC] Company data switch failed:', e);
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
// 2. Report Saving
electron_1.ipcMain.handle('save-report', function (_1, _a) { return __awaiter(void 0, [_1, _a], void 0, function (_, _b) {
    var paths, targetDir, segments, filePath, buffer;
    var fileName = _b.fileName, data = _b.data, type = _b.type, subfolder = _b.subfolder;
    return __generator(this, function (_c) {
        try {
            console.log("[IPC] save-report requested: ".concat(fileName, ".").concat(type, " in subfolder: ").concat(subfolder));
            if (!appBasePath) {
                throw new Error("App storage not initialized. Please select a storage location.");
            }
            paths = getAppPaths(appBasePath);
            targetDir = paths.reports;
            if (subfolder) {
                segments = subfolder.split(/[/\\]/).map(function (seg) {
                    return seg.trim().split(' ')[0].replace(/[^a-zA-Z0-9_]/g, '');
                }).filter(Boolean);
                if (segments.length > 0) {
                    targetDir = path.join.apply(path, __spreadArray([paths.reports], segments, false));
                }
            }
            // Ensure the reports directory exists
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            filePath = path.resolve(targetDir, "".concat(fileName, ".").concat(type));
            console.log("[IPC] Saving file to: ".concat(filePath));
            buffer = Buffer.from(data);
            fs.writeFileSync(filePath, new Uint8Array(buffer));
            return [2 /*return*/, { success: true, path: filePath }];
        }
        catch (e) {
            console.error('[IPC] Save report failed:', e);
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
// 2b. Template Saving (routes to BharatPP/Templates instead of Report files)
electron_1.ipcMain.handle('save-template', function (_1, _a) { return __awaiter(void 0, [_1, _a], void 0, function (_, _b) {
    var paths, targetDir, folderName, filePath, buffer;
    var fileName = _b.fileName, data = _b.data, type = _b.type, subfolder = _b.subfolder;
    return __generator(this, function (_c) {
        try {
            console.log("[IPC] save-template requested: ".concat(fileName, ".").concat(type, " in subfolder: ").concat(subfolder));
            if (!appBasePath)
                throw new Error("App storage not initialized.");
            paths = getAppPaths(appBasePath);
            targetDir = paths.templates;
            if (subfolder) {
                folderName = subfolder.trim().split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                targetDir = path.join(paths.templates, folderName);
            }
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            filePath = path.resolve(targetDir, "".concat(fileName, ".").concat(type));
            console.log("[IPC] Saving template to: ".concat(filePath));
            buffer = Buffer.from(data);
            fs.writeFileSync(filePath, new Uint8Array(buffer));
            return [2 /*return*/, { success: true, path: filePath }];
        }
        catch (e) {
            console.error('[IPC] Save template failed:', e);
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
electron_1.ipcMain.handle('open-item-location', function (_, filePath) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        try {
            if (filePath && fs.existsSync(filePath)) {
                console.log("[IPC] Opening location for item: ".concat(filePath));
                electron_1.shell.showItemInFolder(filePath);
                return [2 /*return*/, { success: true }];
            }
            return [2 /*return*/, { success: false, error: 'File not found' }];
        }
        catch (e) {
            console.error('[IPC] Open item location failed:', e);
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
// 2c. Open File Path (directly open the file)
electron_1.ipcMain.handle('open-item-path', function (_, filePath) { return __awaiter(void 0, void 0, void 0, function () {
    var e_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                if (!(filePath && fs.existsSync(filePath))) return [3 /*break*/, 2];
                console.log("[IPC] Opening file path directly: ".concat(filePath));
                return [4 /*yield*/, electron_1.shell.openPath(filePath)];
            case 1:
                _a.sent();
                return [2 /*return*/, { success: true }];
            case 2: return [2 /*return*/, { success: false, error: 'File not found' }];
            case 3:
                e_1 = _a.sent();
                console.error('[IPC] Open item path failed:', e_1);
                return [2 /*return*/, { success: false, error: e_1.message }];
            case 4: return [2 /*return*/];
        }
    });
}); });
// 2d. Dedicated Open User Manual Handler
electron_1.ipcMain.handle('open-user-manual', function () { return __awaiter(void 0, void 0, void 0, function () {
    var isDev_1, appRoot, manualPath, tempDir, files, _i, files_1, file, cacheBuster, tempManualPath, content, srcAssetsDir, destAssetsDir, altPath, e_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 7, , 8]);
                console.log("[IPC] Received open-user-manual request");
                isDev_1 = !electron_1.app.isPackaged;
                appRoot = isDev_1 ? process.cwd() : electron_1.app.getAppPath();
                manualPath = path.join(appRoot, 'docs', 'user_manual.html');
                console.log("[IPC] Resolved source manual path: ".concat(manualPath));
                if (!fs.existsSync(manualPath)) return [3 /*break*/, 4];
                if (!isDev_1) return [3 /*break*/, 2];
                return [4 /*yield*/, electron_1.shell.openPath(manualPath)];
            case 1:
                _a.sent();
                return [2 /*return*/, { success: true }];
            case 2:
                tempDir = electron_1.app.getPath('temp');
                // Clean up old cached manual files to prevent temp directory bloat
                try {
                    files = fs.readdirSync(tempDir);
                    for (_i = 0, files_1 = files; _i < files_1.length; _i++) {
                        file = files_1[_i];
                        if (file.startsWith('BPP_User_Manual_') && file.endsWith('.html')) {
                            fs.unlinkSync(path.join(tempDir, file));
                        }
                    }
                }
                catch (e) {
                    console.error('Failed to cleanup old manual files', e);
                }
                cacheBuster = Date.now();
                tempManualPath = path.join(tempDir, "BPP_User_Manual_".concat(cacheBuster, ".html"));
                content = fs.readFileSync(manualPath);
                fs.writeFileSync(tempManualPath, content);
                srcAssetsDir = path.join(appRoot, 'docs', 'assets');
                destAssetsDir = path.join(tempDir, 'assets');
                if (fs.existsSync(srcAssetsDir)) {
                    copyRecursiveSync(srcAssetsDir, destAssetsDir);
                    console.log("[IPC] Copied user manual assets to: ".concat(destAssetsDir));
                }
                console.log("[IPC] Extracted manual to temp: ".concat(tempManualPath));
                return [4 /*yield*/, electron_1.shell.openPath(tempManualPath)];
            case 3:
                _a.sent();
                return [2 /*return*/, { success: true }];
            case 4:
                altPath = path.resolve(__dirname, '..', 'docs', 'user_manual.html');
                if (!fs.existsSync(altPath)) return [3 /*break*/, 6];
                return [4 /*yield*/, electron_1.shell.openPath(altPath)];
            case 5:
                _a.sent();
                return [2 /*return*/, { success: true }];
            case 6: throw new Error("User manual not found. Please ensure 'docs/user_manual.html' exists.");
            case 7:
                e_2 = _a.sent();
                console.error('[IPC] Open user manual failed:', e_2);
                return [2 /*return*/, { success: false, error: e_2.message }];
            case 8: return [2 /*return*/];
        }
    });
}); });
// 2e. Statutory Forms Handling (Preview & Save blank templates)
electron_1.ipcMain.handle('handle-statutory-form', function (_1, _a) { return __awaiter(void 0, [_1, _a], void 0, function (_, _b) {
    var isDev_2, appRoot, formMap, fileName, sourcePath, fallbackPath, actualSourcePath, tempDir, tempFormPath, content, openError, fileUrl, result, content, e_3;
    var formName = _b.formName, action = _b.action;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 7, , 8]);
                console.log("[IPC] handle-statutory-form requested for: ".concat(formName, ", action: ").concat(action));
                isDev_2 = !electron_1.app.isPackaged;
                appRoot = isDev_2 ? process.cwd() : electron_1.app.getAppPath();
                formMap = {
                    'ESI Form 1': 'ESI_Form-1 Latest.pdf',
                    'PF Form 2': 'PF_Form 2-Revised.pdf',
                    'PF Form 11': 'PF_Form11 Revised.pdf'
                };
                fileName = formMap[formName];
                if (!fileName) {
                    throw new Error("Unsupported statutory form: ".concat(formName));
                }
                sourcePath = path.join(appRoot, 'docs', fileName);
                fallbackPath = path.resolve(__dirname, '..', 'docs', fileName);
                console.log("[IPC] Resolved statutory form source path: ".concat(sourcePath));
                if (!fs.existsSync(sourcePath)) {
                    // Check fallback resolve path
                    if (!fs.existsSync(fallbackPath)) {
                        throw new Error("Statutory form file not found.\n- Source: ".concat(sourcePath, "\n- Fallback: ").concat(fallbackPath, "\n- AppRoot: ").concat(appRoot, "\n- __dirname: ").concat(__dirname));
                    }
                }
                actualSourcePath = fs.existsSync(sourcePath) ? sourcePath : fallbackPath;
                if (!(action === 'preview')) return [3 /*break*/, 4];
                tempDir = electron_1.app.getPath('temp');
                tempFormPath = path.join(tempDir, fileName);
                content = fs.readFileSync(actualSourcePath);
                fs.writeFileSync(tempFormPath, new Uint8Array(content));
                console.log("[IPC] Extracted statutory form for preview: ".concat(tempFormPath));
                return [4 /*yield*/, electron_1.shell.openPath(tempFormPath)];
            case 1:
                openError = _c.sent();
                if (!openError) return [3 /*break*/, 3];
                console.warn("[IPC] shell.openPath failed with error: ".concat(openError, ". Falling back to openExternal..."));
                fileUrl = "file:///".concat(tempFormPath.replace(/\\/g, '/'));
                return [4 /*yield*/, electron_1.shell.openExternal(fileUrl)];
            case 2:
                _c.sent();
                _c.label = 3;
            case 3: return [2 /*return*/, { success: true }];
            case 4:
                if (!(action === 'download')) return [3 /*break*/, 6];
                return [4 /*yield*/, electron_1.dialog.showSaveDialog({
                        title: "Download Blank ".concat(formName),
                        defaultPath: path.join(electron_1.app.getPath('downloads'), fileName),
                        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
                    })];
            case 5:
                result = _c.sent();
                if (result.canceled || !result.filePath) {
                    return [2 /*return*/, { success: false, error: 'Download canceled' }];
                }
                content = fs.readFileSync(actualSourcePath);
                fs.writeFileSync(result.filePath, new Uint8Array(content));
                console.log("[IPC] Downloaded statutory form successfully to: ".concat(result.filePath));
                return [2 /*return*/, { success: true, savedPath: result.filePath }];
            case 6: throw new Error("Invalid action: ".concat(action));
            case 7:
                e_3 = _c.sent();
                console.error('[IPC] Handle statutory form failed:', e_3);
                return [2 /*return*/, { success: false, error: e_3.message }];
            case 8: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle('send-email', function (_1, _a) { return __awaiter(void 0, [_1, _a], void 0, function (_, _b) {
    var transporter, info, e_4;
    var smtpConfig = _b.smtpConfig, mailOptions = _b.mailOptions;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                console.log("[IPC] send-email requested to: ".concat(mailOptions.to));
                transporter = nodemailer_1.default.createTransport({
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
                return [4 /*yield*/, transporter.sendMail({
                        from: "\"".concat(smtpConfig.senderName, "\" <").concat(smtpConfig.senderEmail, ">"),
                        to: mailOptions.to,
                        subject: mailOptions.subject,
                        text: mailOptions.text,
                        html: mailOptions.html,
                        attachments: mailOptions.attachments ? mailOptions.attachments.map(function (at) { return ({
                            filename: at.filename,
                            content: Buffer.from(at.content)
                        }); }) : []
                    })];
            case 1:
                info = _c.sent();
                console.log("[IPC] Email sent. MessageId: ".concat(info.messageId));
                return [2 /*return*/, { success: true, messageId: info.messageId }];
            case 2:
                e_4 = _c.sent();
                console.error('[IPC] send-email failed:', e_4);
                return [2 /*return*/, { success: false, error: e_4.message }];
            case 3: return [2 /*return*/];
        }
    });
}); });
// 3. Simple Key-Value Store
var GLOBAL_KEYS = [
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
function performAutoRescue(rootDb, appPaths) {
    return __awaiter(this, void 0, void 0, function () {
        var dataDir_1, companiesRow, existingIds_1, existingComps, silos, updatedRegistry, seen, cleanedComps, _i, existingComps_1, c, missingSilos, _a, missingSilos_1, siloId, siloDbPath, siloDb, profileRow, compName, createdDate, parsed;
        return __generator(this, function (_b) {
            try {
                dataDir_1 = appPaths.data;
                if (!fs.existsSync(dataDir_1))
                    return [2 /*return*/];
                companiesRow = rootDb.prepare('SELECT value FROM store WHERE key = ?').get('app_companies');
                existingIds_1 = [];
                existingComps = [];
                if (companiesRow && companiesRow.value) {
                    try {
                        existingComps = JSON.parse(companiesRow.value);
                        existingIds_1 = existingComps.map(function (c) { return c.id; });
                    }
                    catch (e) { }
                }
                silos = fs.readdirSync(dataDir_1)
                    .filter(function (name) {
                    var siloPath = path.join(dataDir_1, name);
                    return fs.statSync(siloPath).isDirectory() && fs.existsSync(path.join(siloPath, 'active_db.sqlite'));
                })
                    .filter(function (name) { return name !== '.icon-ico'; });
                updatedRegistry = false;
                seen = new Set();
                cleanedComps = [];
                for (_i = 0, existingComps_1 = existingComps; _i < existingComps_1.length; _i++) {
                    c = existingComps_1[_i];
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
                    console.log("[AutoRescue] Cleaned up and sanitized registry database on startup.");
                    existingComps = cleanedComps;
                    existingIds_1 = existingComps.map(function (c) { return c.id; });
                }
                // If the user already has companies registered, we don't strictly *need* to rescue automatically
                // because it might be intentional. But for a fresh config wipe, `existingComps` will be empty.
                // We will rescue any silos that aren't registered ONLY if the registry is empty.
                if (existingComps.length > 0)
                    return [2 /*return*/];
                missingSilos = silos.filter(function (s) { return !existingIds_1.includes(s); });
                if (missingSilos.length === 0)
                    return [2 /*return*/];
                console.log("[AutoRescue] Found ".concat(missingSilos.length, " orphaned silos. Syncing to root DB..."));
                for (_a = 0, missingSilos_1 = missingSilos; _a < missingSilos_1.length; _a++) {
                    siloId = missingSilos_1[_a];
                    try {
                        siloDbPath = path.join(dataDir_1, siloId, 'active_db.sqlite');
                        siloDb = new better_sqlite3_1.default(siloDbPath);
                        profileRow = siloDb.prepare("SELECT value FROM store WHERE key = ?").get("app_company_profile_".concat(siloId));
                        if (!profileRow) {
                            profileRow = siloDb.prepare("SELECT value FROM store WHERE key = 'app_company_profile' OR key = 'company_profile'").get();
                        }
                        compName = "Rescued Org (".concat(siloId, ")");
                        createdDate = new Date().toISOString();
                        if (profileRow && profileRow.value) {
                            parsed = JSON.parse(profileRow.value);
                            compName = parsed.establishmentName || parsed.tradeName || compName;
                            createdDate = parsed.createdDate || createdDate;
                        }
                        existingComps.push({
                            id: siloId,
                            establishmentName: compName,
                            createdDate: createdDate
                        });
                        siloDb.close();
                        console.log("[AutoRescue] Recovered silo ".concat(siloId, " (").concat(compName, ")"));
                    }
                    catch (e) {
                        console.warn("[AutoRescue] Failed to recover silo ".concat(siloId, ":"), e);
                    }
                }
                if (existingComps.length > 0 && missingSilos.length > 0) {
                    rootDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)').run('app_companies', JSON.stringify(existingComps));
                    console.log("[AutoRescue] Successfully registered orphaned silos.");
                }
            }
            catch (err) {
                console.error('[AutoRescue] Critical error:', err);
            }
            return [2 /*return*/];
        });
    });
}
function performLegacyAutoMigration(rootDb, appPaths) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, legacyRows, companiesRow, companies, companyIds, defaultCompanyId, migratedCount, _i, legacyRows_1, row, targetCompanyId, _a, companyIds_1, cid, siloDir, siloDbPath, siloDb, registryPaths, globalDbPath, globalDb;
        return __generator(this, function (_b) {
            try {
                console.log("🚀 [AutoMigrate] Checking for legacy data in root DB...");
                rows = rootDb.prepare('SELECT * FROM store').all();
                legacyRows = rows.filter(function (r) { return !GLOBAL_KEYS.includes(r.key); });
                if (legacyRows.length === 0) {
                    console.log("✅ [AutoMigrate] Root DB is clean. No legacy data found.");
                    return [2 /*return*/];
                }
                console.log("\u26A0\uFE0F [AutoMigrate] Found ".concat(legacyRows.length, " legacy keys. Starting migration surgery..."));
                companiesRow = rows.find(function (r) { return r.key === 'app_companies'; });
                companies = [];
                if (companiesRow) {
                    try {
                        companies = JSON.parse(companiesRow.value);
                    }
                    catch (e) { }
                }
                companyIds = companies.map(function (c) { return c.id; });
                defaultCompanyId = companyIds.length > 0 ? companyIds[0] : 'default';
                migratedCount = 0;
                for (_i = 0, legacyRows_1 = legacyRows; _i < legacyRows_1.length; _i++) {
                    row = legacyRows_1[_i];
                    targetCompanyId = defaultCompanyId;
                    // Try to perfectly match the company ID suffix
                    for (_a = 0, companyIds_1 = companyIds; _a < companyIds_1.length; _a++) {
                        cid = companyIds_1[_a];
                        if (row.key.endsWith("_".concat(cid))) {
                            targetCompanyId = cid;
                            break;
                        }
                    }
                    siloDir = path.join(appPaths.data, targetCompanyId);
                    if (!fs.existsSync(siloDir)) {
                        fs.mkdirSync(siloDir, { recursive: true });
                        console.log("[AutoMigrate] Created new Silo directory: ".concat(siloDir));
                    }
                    siloDbPath = path.join(siloDir, 'active_db.sqlite');
                    siloDb = new better_sqlite3_1.default(siloDbPath);
                    siloDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
                    // Insert into Silo
                    siloDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)').run(row.key, row.value);
                    siloDb.close();
                    // Delete from Root
                    rootDb.prepare('DELETE FROM store WHERE key = ?').run(row.key);
                    migratedCount++;
                }
                console.log("\uD83C\uDF89 [AutoMigrate] SUCCESS! ".concat(migratedCount, " legacy keys successfully sliced and moved into Silo folders."));
                // V06.01.01: Update the Root Database (Global Registry) to point to the migrated silos!
                if (appBasePath) {
                    registryPaths = getAppPaths(appBasePath);
                    globalDbPath = path.join(registryPaths.root, 'active_db.sqlite');
                    globalDb = new better_sqlite3_1.default(globalDbPath);
                    globalDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
                    globalDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)').run('app_companies', JSON.stringify(companies));
                    globalDb.close();
                    console.log("[AutoMigrate] Synced ".concat(companies.length, " companies to the Global Registry."));
                }
            }
            catch (e) {
                console.error("❌ [AutoMigrate] FAILED:", e);
            }
            return [2 /*return*/];
        });
    });
}
electron_1.ipcMain.handle('db-set', function (_1, _a) { return __awaiter(void 0, [_1, _a], void 0, function (_, _b) {
    var paths, rootDbPath, rootDb, stmt, stmt;
    var key = _b.key, value = _b.value;
    return __generator(this, function (_c) {
        try {
            if (GLOBAL_KEYS.includes(key)) {
                if (!appBasePath)
                    throw new Error("Storage path not set");
                paths = getAppPaths(appBasePath);
                rootDbPath = path.join(paths.root, 'active_db.sqlite');
                rootDb = new better_sqlite3_1.default(rootDbPath);
                rootDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
                stmt = rootDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
                stmt.run(key, JSON.stringify(value));
                rootDb.close();
                return [2 /*return*/, { success: true }];
            }
            else {
                if (!ensureDatabase()) {
                    throw new Error("Storage not configured. Database unavailable.");
                }
                stmt = db.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
                stmt.run(key, JSON.stringify(value));
                return [2 /*return*/, { success: true }];
            }
        }
        catch (e) {
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
var safeParseValue = function (val) {
    if (val === undefined || val === null)
        return null;
    try {
        return JSON.parse(val);
    }
    catch (_err) {
        return val;
    }
};
electron_1.ipcMain.handle('db-get', function (_, key) { return __awaiter(void 0, void 0, void 0, function () {
    var row, paths, rootDbPath, rootDb;
    return __generator(this, function (_a) {
        try {
            row = void 0;
            if (GLOBAL_KEYS.includes(key)) {
                if (appBasePath) {
                    paths = getAppPaths(appBasePath);
                    rootDbPath = path.join(paths.root, 'active_db.sqlite');
                    if (fs.existsSync(rootDbPath)) {
                        try {
                            rootDb = new better_sqlite3_1.default(rootDbPath, { readonly: true });
                            row = rootDb.prepare('SELECT value FROM store WHERE key = ?').get(key);
                            rootDb.close();
                        }
                        catch (err) {
                            console.warn('[IPC] Failed to fetch key from root registry database:', err);
                        }
                    }
                }
                // --- CRITICAL FALLBACK FOR LEGACY DATA MIGRATION ---
                if (!row && ensureDatabase() && db) {
                    row = db.prepare('SELECT value FROM store WHERE key = ?').get(key);
                }
            }
            else {
                if (ensureDatabase() && db) {
                    row = db.prepare('SELECT value FROM store WHERE key = ?').get(key);
                }
            }
            return [2 /*return*/, { success: true, data: row ? safeParseValue(row.value) : null }];
        }
        catch (e) {
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
electron_1.ipcMain.handle('db-delete', function (_, key) { return __awaiter(void 0, void 0, void 0, function () {
    var paths, rootDbPath, rootDb;
    return __generator(this, function (_a) {
        try {
            if (GLOBAL_KEYS.includes(key)) {
                if (appBasePath) {
                    paths = getAppPaths(appBasePath);
                    rootDbPath = path.join(paths.root, 'active_db.sqlite');
                    if (fs.existsSync(rootDbPath)) {
                        rootDb = new better_sqlite3_1.default(rootDbPath);
                        rootDb.prepare('DELETE FROM store WHERE key = ?').run(key);
                        rootDb.close();
                    }
                }
            }
            else {
                if (db) {
                    db.prepare('DELETE FROM store WHERE key = ?').run(key);
                }
            }
            return [2 /*return*/, { success: true }];
        }
        catch (e) {
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
electron_1.ipcMain.handle('db-get-all', function () { return __awaiter(void 0, void 0, void 0, function () {
    var mergedData, rows, siloRowsOnly, paths, rootDbPath, rootDb, _loop_1, _i, GLOBAL_KEYS_1, key;
    return __generator(this, function (_a) {
        try {
            mergedData = [];
            // 1. Get all silo keys (excluding global keys to prevent per-silo app_companies leakage)
            if (db) {
                rows = db.prepare('SELECT key, value FROM store').all();
                siloRowsOnly = rows.filter(function (r) { return !GLOBAL_KEYS.includes(r.key); });
                mergedData.push.apply(mergedData, siloRowsOnly.map(function (r) { return ({ key: r.key, value: safeParseValue(r.value) }); }));
            }
            // 2. ── Strict Registry Merging ──
            if (appBasePath) {
                paths = getAppPaths(appBasePath);
                rootDbPath = path.join(paths.root, 'active_db.sqlite');
                if (fs.existsSync(rootDbPath)) {
                    try {
                        rootDb = new better_sqlite3_1.default(rootDbPath, { readonly: true });
                        _loop_1 = function (key) {
                            var row = rootDb.prepare('SELECT value FROM store WHERE key = ?').get(key);
                            var finalValue = null;
                            if (row && row.value && row.value !== '[]') {
                                finalValue = safeParseValue(row.value);
                            }
                            else if (key === 'app_companies') {
                                // --- V06.01.07: Call Auto Heal ---
                                finalValue = autoHealAppCompanies(rootDbPath, paths.data);
                            }
                            if (finalValue) {
                                // Replace if somehow it exists in silo (legacy data cleanup), otherwise push
                                var existingIndex = mergedData.findIndex(function (item) { return item.key === key; });
                                if (existingIndex >= 0) {
                                    mergedData[existingIndex].value = finalValue;
                                }
                                else {
                                    mergedData.push({ key: key, value: finalValue });
                                }
                            }
                        };
                        for (_i = 0, GLOBAL_KEYS_1 = GLOBAL_KEYS; _i < GLOBAL_KEYS_1.length; _i++) {
                            key = GLOBAL_KEYS_1[_i];
                            _loop_1(key);
                        }
                        rootDb.close();
                    }
                    catch (err) {
                        console.warn('[IPC] Failed to merge keys from root registry database:', err);
                    }
                }
            }
            return [2 /*return*/, { success: true, data: mergedData }];
        }
        catch (e) {
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
// --- V06.01.07: AUTO-HEALING FRAMEWORK FOR APP_COMPANIES ---
function autoHealAppCompanies(rootDbPath, dataDir) {
    console.log("[db-get-global] Auto-Recovery Triggered! Root app_companies is missing/empty.");
    var recoveredCompanies = [];
    if (fs.existsSync(dataDir)) {
        var silos = fs.readdirSync(dataDir).filter(function (name) {
            var siloPath = path.join(dataDir, name);
            return fs.statSync(siloPath).isDirectory() && fs.existsSync(path.join(siloPath, 'active_db.sqlite'));
        });
        var _loop_2 = function (siloId) {
            try {
                var siloDb = new better_sqlite3_1.default(path.join(dataDir, siloId, 'active_db.sqlite'), { readonly: true });
                var profile = null;
                try {
                    var profileRow = siloDb.prepare("SELECT value FROM store WHERE key = 'app_company_profile' OR key LIKE 'app_company_profile_%'").get();
                    if (profileRow && profileRow.value)
                        profile = JSON.parse(profileRow.value);
                }
                catch (e) { }
                if (!profile) {
                    try {
                        var companyRow = siloDb.prepare("SELECT value FROM store WHERE key = 'app_companies'").get();
                        if (companyRow && companyRow.value) {
                            var comps = JSON.parse(companyRow.value);
                            profile = comps.find(function (c) { return c.id === siloId; });
                        }
                    }
                    catch (e) { }
                }
                siloDb.close();
                if (profile) {
                    profile.id = siloId;
                    recoveredCompanies.push(profile);
                    console.log("[db-get-global] Rescued profile for silo: ".concat(siloId));
                }
                else {
                    recoveredCompanies.push({ id: siloId, establishmentName: siloId, cin: '' });
                    console.log("[db-get-global] Rescued minimal ID for silo: ".concat(siloId));
                }
            }
            catch (e) {
                console.warn("[db-get-global] Failed to read silo ".concat(siloId, " for recovery"), e);
            }
        };
        for (var _i = 0, silos_1 = silos; _i < silos_1.length; _i++) {
            var siloId = silos_1[_i];
            _loop_2(siloId);
        }
    }
    if (recoveredCompanies.length > 0) {
        // Save it back to root
        try {
            var writeDb = new better_sqlite3_1.default(rootDbPath);
            writeDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
            var stmtWrite = writeDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
            stmtWrite.run('app_companies', JSON.stringify(recoveredCompanies));
            writeDb.close();
            console.log("[db-get-global] Auto-Recovery Complete! Injected ".concat(recoveredCompanies.length, " companies into root."));
        }
        catch (e) {
            console.error("[db-get-global] Auto-Recovery write failed", e);
        }
        return recoveredCompanies;
    }
    return null;
}
// --- END AUTO-HEALING ---
// Helper to check if a specific company silo contains any enrolled employees
function siloHasEmployees(siloDataPath, siloId) {
    var siloDbPath = path.join(siloDataPath, siloId, 'active_db.sqlite');
    if (!fs.existsSync(siloDbPath))
        return false;
    try {
        var siloDb = new better_sqlite3_1.default(siloDbPath, { readonly: true });
        var stmt = siloDb.prepare('SELECT value FROM store WHERE key = ?');
        var row = stmt.get("app_employees_".concat(siloId));
        siloDb.close();
        if (row && row.value) {
            try {
                var parsed = JSON.parse(row.value);
                return Array.isArray(parsed) && parsed.length > 0;
            }
            catch (e) {
                return false;
            }
        }
    }
    catch (e) {
        console.warn("[siloHasEmployees] Failed to check silo ".concat(siloId), e);
    }
    return false;
}
// Strict Physical Silo Sanitizer: Ensures app_companies ONLY contains companies with active physical folders in Data/
function sanitizeCompaniesWithPhysicalSilos(companies, dataDir) {
    if (!fs.existsSync(dataDir) || !Array.isArray(companies))
        return companies;
    // Scan Data/ directory for all actual physical silo subfolders containing active_db.sqlite
    var physicalSiloIds = fs.readdirSync(dataDir).filter(function (name) {
        if (name === 'default')
            return false;
        var siloPath = path.join(dataDir, name);
        return fs.statSync(siloPath).isDirectory() && fs.existsSync(path.join(siloPath, 'active_db.sqlite'));
    });
    var physicalSiloSet = new Set(physicalSiloIds);
    // 1. Strict Filter: Keep ONLY companies whose ID corresponds to an actual physical folder in Data/ (never 'default')
    var sanitized = companies.filter(function (c) { return c && c.id && c.id !== 'default' && physicalSiloSet.has(c.id); });
    // 2. Ensure every physical folder in Data/ is present in the registry (Auto-Rescue missing folders)
    var existingIds = new Set(sanitized.map(function (c) { return c.id; }));
    for (var _i = 0, physicalSiloIds_1 = physicalSiloIds; _i < physicalSiloIds_1.length; _i++) {
        var siloId = physicalSiloIds_1[_i];
        if (!existingIds.has(siloId)) {
            try {
                var siloDbPath = path.join(dataDir, siloId, 'active_db.sqlite');
                var siloDb = new better_sqlite3_1.default(siloDbPath, { readonly: true });
                var profile = null;
                try {
                    var profileRow = siloDb.prepare("SELECT value FROM store WHERE key = 'app_company_profile' OR key LIKE 'app_company_profile_%'").get();
                    if (profileRow && profileRow.value)
                        profile = JSON.parse(profileRow.value);
                }
                catch (e) { }
                siloDb.close();
                if (profile) {
                    profile.id = siloId;
                    sanitized.push(profile);
                }
                else {
                    sanitized.push({ id: siloId, establishmentName: siloId, cin: '' });
                }
            }
            catch (e) {
                sanitized.push({ id: siloId, establishmentName: siloId, cin: '' });
            }
        }
    }
    return sanitized;
}
electron_1.ipcMain.handle('db-get-global', function (_, key) { return __awaiter(void 0, void 0, void 0, function () {
    var paths_1, rootDbPath, rootDb, stmt, row, healed, parsed;
    return __generator(this, function (_a) {
        try {
            console.log("[db-get-global] Requested key: ".concat(key, ". appBasePath: ").concat(appBasePath));
            if (!appBasePath)
                return [2 /*return*/, null];
            paths_1 = getAppPaths(appBasePath);
            rootDbPath = path.join(paths_1.root, 'active_db.sqlite');
            console.log("[db-get-global] DB Path: ".concat(rootDbPath, ". Exists? ").concat(fs.existsSync(rootDbPath)));
            if (!fs.existsSync(rootDbPath))
                return [2 /*return*/, null];
            rootDb = new better_sqlite3_1.default(rootDbPath, { readonly: true });
            stmt = rootDb.prepare('SELECT value FROM store WHERE key = ?');
            row = stmt.get(key);
            rootDb.close();
            console.log("[db-get-global] Row found? ".concat(!!row));
            // --- V06.01.07: Call Auto Heal ---
            if (key === 'app_companies' && (!row || !row.value || row.value === '[]')) {
                healed = autoHealAppCompanies(rootDbPath, paths_1.data);
                if (healed) {
                    return [2 /*return*/, healed.map(function (c) { return (__assign(__assign({}, c), { hasEmployees: siloHasEmployees(paths_1.data, c.id) })); })];
                }
            }
            if (row && row.value) {
                try {
                    parsed = JSON.parse(row.value);
                    if (key === 'app_companies' && Array.isArray(parsed)) {
                        parsed = sanitizeCompaniesWithPhysicalSilos(parsed, paths_1.data);
                        parsed = parsed.map(function (c) { return (__assign(__assign({}, c), { hasEmployees: siloHasEmployees(paths_1.data, c.id) })); });
                    }
                    return [2 /*return*/, parsed];
                }
                catch (e) {
                    return [2 /*return*/, row.value];
                }
            }
            return [2 /*return*/, null];
        }
        catch (e) {
            console.warn("[IPC] Failed to get global key ".concat(key, ":"), e);
            return [2 /*return*/, null];
        }
        return [2 /*return*/];
    });
}); });
electron_1.ipcMain.handle('db-set-global', function (_1, _a) { return __awaiter(void 0, [_1, _a], void 0, function (_, _b) {
    var paths, rootDbPath, rootDb, stmt;
    var key = _b.key, value = _b.value;
    return __generator(this, function (_c) {
        try {
            paths = getAppPaths(appBasePath);
            if (key === 'app_companies' && Array.isArray(value)) {
                value = sanitizeCompaniesWithPhysicalSilos(value, paths.data);
            }
            rootDbPath = path.join(paths.root, 'active_db.sqlite');
            rootDb = new better_sqlite3_1.default(rootDbPath);
            rootDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
            stmt = rootDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
            stmt.run(key, JSON.stringify(value));
            rootDb.close();
            return [2 /*return*/, { success: true }];
        }
        catch (e) {
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
var LIMIT_KEY = crypto.scryptSync('BPP_SECURE_COMPANY_LIMIT_KEY_2026', 'salt', 32);
var LIMIT_IV = Buffer.alloc(16, 0);
function getSysLimitPath(isDevMode) {
    var isDev = isDevMode !== undefined
        ? isDevMode
        : ((appBasePath && appBasePath.toLowerCase().includes('dev')) || !electron_1.app.isPackaged || process.env.NODE_ENV === 'development');
    var fileName = isDev ? 'sys_limit_dev.bin' : 'sys_limit.bin';
    var appDataRoot = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    var targetFolder = path.join(appDataRoot, 'BharatPayPro');
    if (!fs.existsSync(targetFolder)) {
        try {
            fs.mkdirSync(targetFolder, { recursive: true });
        }
        catch (e) { }
    }
    return path.join(targetFolder, fileName);
}
function readActivatedSilos(isDevMode) {
    try {
        var filePath = getSysLimitPath(isDevMode);
        if (!fs.existsSync(filePath))
            return [];
        var encrypted = fs.readFileSync(filePath, 'utf8');
        var decipher = crypto.createDecipheriv('aes-256-cbc', LIMIT_KEY, LIMIT_IV);
        var decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    }
    catch (e) {
        return [];
    }
}
function writeActivatedSilos(silos, isDevMode) {
    try {
        var filePath = getSysLimitPath(isDevMode);
        var cipher = crypto.createCipheriv('aes-256-cbc', LIMIT_KEY, LIMIT_IV);
        var encrypted = cipher.update(JSON.stringify(silos), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        fs.writeFileSync(filePath, encrypted, 'utf8');
    }
    catch (e) {
        console.error("Failed to write sys_limit", e);
    }
}
electron_1.ipcMain.handle('get-activated-silos', function (_, isDevMode) { return __awaiter(void 0, void 0, void 0, function () {
    var isDev;
    return __generator(this, function (_a) {
        isDev = isDevMode !== undefined
            ? isDevMode
            : ((appBasePath && appBasePath.toLowerCase().includes('dev')) || !electron_1.app.isPackaged || process.env.NODE_ENV === 'development');
        return [2 /*return*/, { success: true, silos: readActivatedSilos(isDev) }];
    });
}); });
electron_1.ipcMain.handle('register-activated-silo', function (_, signature, isDevMode) { return __awaiter(void 0, void 0, void 0, function () {
    var isDev, silos;
    return __generator(this, function (_a) {
        isDev = isDevMode !== undefined
            ? isDevMode
            : ((appBasePath && appBasePath.toLowerCase().includes('dev')) || !electron_1.app.isPackaged || process.env.NODE_ENV === 'development');
        silos = readActivatedSilos(isDev);
        if (signature && !silos.includes(signature)) {
            silos.push(signature);
            writeActivatedSilos(silos, isDev);
        }
        console.log("\u2705 [IPC] Registered signature for ".concat(isDev ? 'DEVELOPER (sys_limit_dev.bin)' : 'USER (sys_limit.bin)', ":"), signature);
        return [2 /*return*/, { success: true, silos: silos }];
    });
}); });
electron_1.ipcMain.handle('remove-activated-silo', function (_, target, isDevMode) { return __awaiter(void 0, void 0, void 0, function () {
    var isDev, silos;
    return __generator(this, function (_a) {
        isDev = isDevMode !== undefined
            ? isDevMode
            : ((appBasePath && appBasePath.toLowerCase().includes('dev')) || !electron_1.app.isPackaged || process.env.NODE_ENV === 'development');
        silos = readActivatedSilos(isDev);
        if (!target)
            return [2 /*return*/, { success: true, silos: silos }];
        silos = silos.filter(function (s) {
            if (s === target)
                return false;
            if (target.length >= 3 && s.includes("_".concat(target, "-")))
                return false;
            if (target.length >= 3 && s.includes("_".concat(target, "_")))
                return false;
            if (target.length >= 3 && s.includes(target))
                return false;
            return true;
        });
        writeActivatedSilos(silos, isDev);
        return [2 /*return*/, { success: true, silos: silos }];
    });
}); });
electron_1.ipcMain.handle('sync-activated-silos', function (_, validCloudSigs, isDevMode) { return __awaiter(void 0, void 0, void 0, function () {
    var silos, cleaned;
    return __generator(this, function (_a) {
        silos = readActivatedSilos(isDevMode);
        if (Array.isArray(validCloudSigs)) {
            cleaned = silos.filter(function (s) { return validCloudSigs.includes(s); });
            writeActivatedSilos(cleaned, isDevMode);
            return [2 /*return*/, { success: true, silos: cleaned }];
        }
        return [2 /*return*/, { success: true, silos: silos }];
    });
}); });
electron_1.ipcMain.handle('wipe-activated-silos', function (_, isDevMode) { return __awaiter(void 0, void 0, void 0, function () {
    var filePath;
    return __generator(this, function (_a) {
        filePath = getSysLimitPath(isDevMode);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log("Deleted ".concat(path.basename(filePath), " physically in wipe-activated-silos"));
            }
            catch (e) {
                console.error("Failed to delete sys_limit file physically in wipe-activated-silos", e);
            }
        }
        return [2 /*return*/, { success: true, silos: [] }];
    });
}); });
electron_1.ipcMain.handle('wipe-all-local-signatures', function (_, isDevMode) { return __awaiter(void 0, void 0, void 0, function () {
    var isDev_3, targetFileName, targetPath, paths, rootDbPath, rootDb, compsRow, comps, _i, comps_1, c, keysToWipe, _a, keysToWipe_1, row, prof, dataDir_2, silos, _b, silos_2, siloId, siloDbPath, siloDb, rows, _c, rows_1, r, prof, tempFilesToDelete, _d, tempFilesToDelete_1, tf, subDirs, _e, subDirs_1, sub, subPath, files, _f, files_2, f;
    return __generator(this, function (_g) {
        try {
            isDev_3 = isDevMode !== undefined
                ? isDevMode
                : ((appBasePath && appBasePath.toLowerCase().includes('dev')) || !electron_1.app.isPackaged || process.env.NODE_ENV === 'development');
            targetFileName = isDev_3 ? 'sys_limit_dev.bin' : 'sys_limit.bin';
            targetPath = getSysLimitPath(isDev_3);
            console.log("\uD83E\uDDF9 [IPC] Received wipe-all-local-signatures. Mode: ".concat(isDev_3 ? 'DEVELOPER' : 'USER', ". Deleting ONLY: ").concat(targetFileName, " at ").concat(targetPath));
            // 1. Wipe ONLY the specific environment sys_limit file physically
            if (fs.existsSync(targetPath)) {
                try {
                    fs.unlinkSync(targetPath);
                    console.log("\u2705 [ISOLATION] Deleted ONLY ".concat(targetFileName, " physically in wipe-all-local-signatures"));
                }
                catch (e) {
                    console.error("Failed to delete ".concat(targetFileName, " physically"), e);
                }
            }
            if (!appBasePath)
                return [2 /*return*/, { success: true }];
            paths = getAppPaths(appBasePath);
            rootDbPath = path.join(paths.root, 'active_db.sqlite');
            if (fs.existsSync(rootDbPath)) {
                rootDb = new better_sqlite3_1.default(rootDbPath);
                rootDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
                compsRow = rootDb.prepare("SELECT value FROM store WHERE key = 'app_companies'").get();
                if (compsRow && compsRow.value) {
                    try {
                        comps = JSON.parse(compsRow.value);
                        if (Array.isArray(comps)) {
                            for (_i = 0, comps_1 = comps; _i < comps_1.length; _i++) {
                                c = comps_1[_i];
                                c.companySignature = "";
                                c.isReadOnly = true;
                            }
                            rootDb.prepare("INSERT OR REPLACE INTO store (key, value) VALUES ('app_companies', ?)").run(JSON.stringify(comps));
                        }
                    }
                    catch (e) { }
                }
                keysToWipe = rootDb.prepare("SELECT key, value FROM store WHERE key LIKE '%company_profile%'").all();
                for (_a = 0, keysToWipe_1 = keysToWipe; _a < keysToWipe_1.length; _a++) {
                    row = keysToWipe_1[_a];
                    try {
                        prof = JSON.parse(row.value);
                        prof.companySignature = "";
                        prof.isReadOnly = true;
                        rootDb.prepare("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)").run(row.key, JSON.stringify(prof));
                    }
                    catch (e) { }
                }
                rootDb.close();
            }
            dataDir_2 = paths.data;
            if (fs.existsSync(dataDir_2)) {
                silos = fs.readdirSync(dataDir_2).filter(function (name) {
                    var siloPath = path.join(dataDir_2, name);
                    return fs.statSync(siloPath).isDirectory() && fs.existsSync(path.join(siloPath, 'active_db.sqlite'));
                });
                for (_b = 0, silos_2 = silos; _b < silos_2.length; _b++) {
                    siloId = silos_2[_b];
                    try {
                        siloDbPath = path.join(dataDir_2, siloId, 'active_db.sqlite');
                        siloDb = new better_sqlite3_1.default(siloDbPath);
                        siloDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
                        rows = siloDb.prepare("SELECT key, value FROM store WHERE key LIKE '%company_profile%'").all();
                        for (_c = 0, rows_1 = rows; _c < rows_1.length; _c++) {
                            r = rows_1[_c];
                            try {
                                prof = JSON.parse(r.value);
                                prof.companySignature = "";
                                prof.isReadOnly = true;
                                siloDb.prepare("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)").run(r.key, JSON.stringify(prof));
                            }
                            catch (e) { }
                        }
                        siloDb.close();
                    }
                    catch (e) {
                        console.warn("[IPC] Failed wiping signatures in silo ".concat(siloId, ":"), e);
                    }
                }
            }
            tempFilesToDelete = [
                path.join(paths.root, 'temp_active_db.sqlite'),
                path.join(paths.data, 'restore_temp.sqlite'),
                path.join(paths.root, 'active_db.sqlite.tmp')
            ];
            for (_d = 0, tempFilesToDelete_1 = tempFilesToDelete; _d < tempFilesToDelete_1.length; _d++) {
                tf = tempFilesToDelete_1[_d];
                try {
                    if (fs.existsSync(tf)) {
                        fs.unlinkSync(tf);
                        console.log("[IPC] Cleaned up temporary DB file: ".concat(tf));
                    }
                }
                catch (e) { }
            }
            // Sweep temp files in Silo folders (.tmp, temp_*)
            if (fs.existsSync(dataDir_2)) {
                try {
                    subDirs = fs.readdirSync(dataDir_2);
                    for (_e = 0, subDirs_1 = subDirs; _e < subDirs_1.length; _e++) {
                        sub = subDirs_1[_e];
                        subPath = path.join(dataDir_2, sub);
                        if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory()) {
                            files = fs.readdirSync(subPath);
                            for (_f = 0, files_2 = files; _f < files_2.length; _f++) {
                                f = files_2[_f];
                                if (f.endsWith('.tmp') || f.startsWith('temp_') || f.includes('restore_temp')) {
                                }
                            }
                        }
                    }
                }
                catch (e) { }
            }
            console.log("✅ [IPC] Complete sweep finished for all local SQLite profiles, temp files & sys_limit.bin.");
            return [2 /*return*/, { success: true }];
        }
        catch (e) {
            console.error('[IPC] wipe-all-local-signatures failed:', e);
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
electron_1.ipcMain.handle('purge-unmatched-local-signatures', function (_, validCloudSignatures, isDevMode) { return __awaiter(void 0, void 0, void 0, function () {
    var isDev_4, validSigs_1, findMatchingSignature, localSilos, finalSilos, paths, rootDbPath, rootDb, compsRow, comps, changed, _i, comps_2, c, matchingSig, keysToWipe, _a, keysToWipe_2, row, prof, siloId, matchingSig, changed, dataDir_3, siloDirs, _b, siloDirs_1, siloId, siloDbPath, siloDb, rows, _c, rows_2, r, prof, matchingSig, changed;
    return __generator(this, function (_d) {
        try {
            isDev_4 = isDevMode !== undefined
                ? isDevMode
                : ((appBasePath && appBasePath.toLowerCase().includes('dev')) || !electron_1.app.isPackaged || process.env.NODE_ENV === 'development');
            validSigs_1 = Array.isArray(validCloudSignatures) ? validCloudSignatures : [];
            console.log("\uD83E\uDDF9 [IPC] Reconciling 4-layer signatures against Cloud Column R (Environment: ".concat(isDev_4 ? 'DEVELOPER' : 'USER', "):"), validSigs_1);
            findMatchingSignature = function (companyObj, defaultId) {
                if (!validSigs_1 || validSigs_1.length === 0)
                    return null;
                var cid = ((companyObj === null || companyObj === void 0 ? void 0 : companyObj.id) || defaultId || '').trim();
                var estName = ((companyObj === null || companyObj === void 0 ? void 0 : companyObj.establishmentName) || '').trim();
                var currentSig = ((companyObj === null || companyObj === void 0 ? void 0 : companyObj.companySignature) || '').trim();
                return validSigs_1.find(function (s) {
                    if (!s || typeof s !== 'string')
                        return false;
                    // 1. Direct match with current signature string
                    if (currentSig && s.trim() === currentSig.trim())
                        return true;
                    // 2. Direct match with cid substring (_SAIPRA_343036-)
                    if (cid && s.includes("_".concat(cid, "-")))
                        return true;
                    // 3. Clean establishment name match (_SAIPRAFMSPVTLTD-)
                    if (estName) {
                        var cleanEst = estName.replace(/[^A-Z0-9]/gi, '').toUpperCase();
                        if (cleanEst && s.toUpperCase().includes("_".concat(cleanEst, "-")))
                            return true;
                        if (cleanEst.length >= 4 && s.toUpperCase().includes("_".concat(cleanEst.slice(0, 6))))
                            return true;
                    }
                    // 4. Prefix match before dash (e.g. SAIPRA)
                    if (cid && cid.includes('_')) {
                        var idPrefix = cid.split('_')[0].replace(/[^A-Z0-9]/gi, '').toUpperCase();
                        if (idPrefix.length >= 4 && s.toUpperCase().includes("_".concat(idPrefix)))
                            return true;
                    }
                    return false;
                });
            };
            // If Cloud Column R is empty (0 used), WIPE local signatures for THIS ENVIRONMENT ONLY!
            if (validSigs_1.length === 0) {
                console.log("\uD83E\uDDF9 [IPC] Cloud Column R is empty (0 used). Wiping sys_limit_".concat(isDev_4 ? 'dev' : '', ".bin and local signatures for ").concat(isDev_4 ? 'DEVELOPER' : 'USER', "!"));
                writeActivatedSilos([], isDev_4);
            }
            localSilos = readActivatedSilos(isDev_4);
            finalSilos = localSilos.filter(function (s) { return validSigs_1.includes(s); });
            writeActivatedSilos(finalSilos, isDev_4);
            console.log("\uD83E\uDDF9 [IPC] Cleaned ".concat(isDev_4 ? 'sys_limit_dev.bin' : 'sys_limit.bin', " to match cloud signatures:"), finalSilos);
            if (!appBasePath)
                return [2 /*return*/, { success: true, silos: finalSilos }];
            paths = getAppPaths(appBasePath);
            // 2. Sync root active_db.sqlite app_companies & app_company_profile
            try {
                rootDbPath = path.join(paths.root, 'active_db.sqlite');
                if (fs.existsSync(rootDbPath)) {
                    rootDb = new better_sqlite3_1.default(rootDbPath);
                    rootDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
                    compsRow = rootDb.prepare("SELECT value FROM store WHERE key = 'app_companies'").get();
                    if (compsRow && compsRow.value) {
                        try {
                            comps = JSON.parse(compsRow.value);
                            if (Array.isArray(comps)) {
                                changed = false;
                                for (_i = 0, comps_2 = comps; _i < comps_2.length; _i++) {
                                    c = comps_2[_i];
                                    if (c.id) {
                                        matchingSig = findMatchingSignature(c, c.id);
                                        if (matchingSig) {
                                            if (c.companySignature !== matchingSig || c.isReadOnly !== false) {
                                                c.companySignature = matchingSig;
                                                c.isReadOnly = false;
                                                changed = true;
                                            }
                                        }
                                        else {
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
                        }
                        catch (e) { }
                    }
                    keysToWipe = rootDb.prepare("SELECT key, value FROM store WHERE key LIKE '%company_profile%'").all();
                    for (_a = 0, keysToWipe_2 = keysToWipe; _a < keysToWipe_2.length; _a++) {
                        row = keysToWipe_2[_a];
                        try {
                            prof = JSON.parse(row.value);
                            siloId = prof.id || (row.key.replace('app_company_profile_', '').replace('app_company_profile', ''));
                            if (siloId) {
                                matchingSig = findMatchingSignature(prof, siloId);
                                changed = false;
                                if (matchingSig) {
                                    if (prof.companySignature !== matchingSig || prof.isReadOnly !== false) {
                                        prof.companySignature = matchingSig;
                                        prof.isReadOnly = false;
                                        changed = true;
                                    }
                                }
                                else {
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
                        }
                        catch (e) { }
                    }
                    rootDb.close();
                }
            }
            catch (dbErr) {
                console.error("Failed to sync root active_db.sqlite:", dbErr);
            }
            // 3. Sync every company silo DB (app_company_profile)
            try {
                dataDir_3 = paths.data;
                if (fs.existsSync(dataDir_3)) {
                    siloDirs = fs.readdirSync(dataDir_3).filter(function (name) {
                        var siloPath = path.join(dataDir_3, name);
                        return fs.statSync(siloPath).isDirectory() && fs.existsSync(path.join(siloPath, 'active_db.sqlite'));
                    });
                    for (_b = 0, siloDirs_1 = siloDirs; _b < siloDirs_1.length; _b++) {
                        siloId = siloDirs_1[_b];
                        try {
                            siloDbPath = path.join(dataDir_3, siloId, 'active_db.sqlite');
                            siloDb = new better_sqlite3_1.default(siloDbPath);
                            siloDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
                            rows = siloDb.prepare("SELECT key, value FROM store WHERE key LIKE '%company_profile%'").all();
                            for (_c = 0, rows_2 = rows; _c < rows_2.length; _c++) {
                                r = rows_2[_c];
                                try {
                                    prof = JSON.parse(r.value);
                                    matchingSig = findMatchingSignature(prof, siloId);
                                    changed = false;
                                    if (matchingSig) {
                                        if (prof.companySignature !== matchingSig || prof.isReadOnly !== false) {
                                            prof.companySignature = matchingSig;
                                            prof.isReadOnly = false;
                                            changed = true;
                                        }
                                    }
                                    else {
                                        if (prof.companySignature !== "" || prof.isReadOnly !== true) {
                                            prof.companySignature = "";
                                            prof.isReadOnly = true;
                                            changed = true;
                                        }
                                    }
                                    if (changed) {
                                        siloDb.prepare("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)").run(r.key, JSON.stringify(prof));
                                    }
                                }
                                catch (e) { }
                            }
                            siloDb.close();
                        }
                        catch (e) { }
                    }
                }
            }
            catch (siloErr) {
                console.error("Failed to sync company silo DBs:", siloErr);
            }
            return [2 /*return*/, { success: true, silos: finalSilos }];
        }
        catch (e) {
            console.error('[IPC] purge-unmatched-local-signatures failed:', e);
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
electron_1.ipcMain.handle('list-silos', function () { return __awaiter(void 0, void 0, void 0, function () {
    var paths, dataDir_4, silos;
    return __generator(this, function (_a) {
        try {
            if (!appBasePath)
                throw new Error("App storage not initialized");
            paths = getAppPaths(appBasePath);
            dataDir_4 = paths.data;
            if (!fs.existsSync(dataDir_4))
                return [2 /*return*/, { success: true, silos: [] }];
            silos = fs.readdirSync(dataDir_4)
                .filter(function (name) {
                var siloPath = path.join(dataDir_4, name);
                var isDir = fs.statSync(siloPath).isDirectory();
                if (!isDir)
                    return false;
                // Only include silos that actually have an active database
                return fs.existsSync(path.join(siloPath, 'active_db.sqlite'));
            })
                .filter(function (name) { return name !== '.icon-ico' && name !== 'default'; });
            return [2 /*return*/, { success: true, silos: silos }];
        }
        catch (e) {
            console.error('[IPC] list-silos failed:', e);
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
function robustRm(targetPath_1) {
    return __awaiter(this, arguments, void 0, function (targetPath, maxRetries, delayMs) {
        var attempt, err_1;
        if (maxRetries === void 0) { maxRetries = 15; }
        if (delayMs === void 0) { delayMs = 300; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!fs.existsSync(targetPath))
                        return [2 /*return*/];
                    attempt = 1;
                    _a.label = 1;
                case 1:
                    if (!(attempt <= maxRetries)) return [3 /*break*/, 6];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 3, , 5]);
                    fs.rmSync(targetPath, { recursive: true, force: true });
                    console.log("[robustRm] Successfully deleted ".concat(targetPath, " on attempt ").concat(attempt));
                    return [2 /*return*/];
                case 3:
                    err_1 = _a.sent();
                    console.warn("[robustRm] Attempt ".concat(attempt, " failed to delete ").concat(targetPath, ". Error: ").concat(err_1.message));
                    if (attempt === maxRetries) {
                        throw err_1;
                    }
                    // Yield the event loop asynchronously to allow the OS and Node to release lock handles
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delayMs); })];
                case 4:
                    // Yield the event loop asynchronously to allow the OS and Node to release lock handles
                    _a.sent();
                    return [3 /*break*/, 5];
                case 5:
                    attempt++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/];
            }
        });
    });
}
electron_1.ipcMain.handle('delete-silo', function (_, companyId) { return __awaiter(void 0, void 0, void 0, function () {
    var paths, siloPath, fsErr_1, e_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 9, , 10]);
                if (!appBasePath)
                    throw new Error("App storage not initialized");
                if (!companyId || companyId === 'default')
                    throw new Error("Invalid company ID for deletion");
                console.log("[IPC] delete-silo request for company: ".concat(companyId));
                if (!(activeCompanyId === companyId)) return [3 /*break*/, 2];
                console.log("[IPC] Silo is currently active: ".concat(companyId, ". Closing SQLite connection to release file locks before physical folder deletion."));
                if (db) {
                    try {
                        db.pragma('wal_checkpoint(TRUNCATE)');
                        db.close();
                    }
                    catch (dbErr) {
                        console.error("[IPC] Failed to close SQLite database for active silo:", dbErr);
                    }
                    db = null;
                }
                // CRITICAL FIX: Clear activeCompanyId so subsequent dbSet calls (e.g. from React state updates)
                // don't recreate the folder via ensureDatabase -> initializeDatabase.
                activeCompanyId = null;
                // Yield to let OS release file locks
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
            case 1:
                // Yield to let OS release file locks
                _a.sent();
                _a.label = 2;
            case 2:
                paths = getAppPaths(appBasePath);
                siloPath = path.join(paths.data, companyId);
                if (!fs.existsSync(siloPath)) return [3 /*break*/, 7];
                _a.label = 3;
            case 3:
                _a.trys.push([3, 5, , 6]);
                return [4 /*yield*/, robustRm(siloPath, 15, 300)];
            case 4:
                _a.sent(); // 15 attempts, 300ms delay = 4.5 seconds max
                console.log("[IPC] Physical silo folder deleted successfully: ".concat(siloPath));
                return [3 /*break*/, 6];
            case 5:
                fsErr_1 = _a.sent();
                console.error("[IPC] Physical silo folder deletion failed:", fsErr_1);
                throw fsErr_1;
            case 6: return [3 /*break*/, 8];
            case 7:
                console.log("[IPC] Physical silo folder did not exist on disk: ".concat(siloPath));
                _a.label = 8;
            case 8: return [2 /*return*/, { success: true }];
            case 9:
                e_5 = _a.sent();
                console.error('[IPC] delete-silo failed:', e_5);
                return [2 /*return*/, { success: false, error: e_5.message }];
            case 10: return [2 /*return*/];
        }
    });
}); });
// V04.01.07: Dedicated in-place wipe for the currently active company silo.
// This avoids ANY file system operations (no close, no rmSync, no re-open),
// preventing Windows EBUSY locks that caused indefinite hangs during restore.
electron_1.ipcMain.handle('wipe-company-data', function (_, companyId) { return __awaiter(void 0, void 0, void 0, function () {
    var stmt, result;
    return __generator(this, function (_a) {
        try {
            if (!db)
                throw new Error("Database not initialized");
            if (!companyId || companyId === 'default')
                throw new Error("Invalid company ID");
            console.log("[IPC] wipe-company-data: in-place purge for ".concat(companyId));
            stmt = db.prepare("DELETE FROM store WHERE key NOT LIKE 'app_company_profile%' AND key != 'app_companies' AND key != 'app_users' AND key != 'app_license_secure' AND key != 'app_developer_secure' AND key != 'app_machine_id'");
            result = stmt.run();
            console.log("[IPC] wipe-company-data: purged ".concat(result.changes, " rows for ").concat(companyId));
            return [2 /*return*/, { success: true, changes: result.changes }];
        }
        catch (e) {
            console.error('[IPC] wipe-company-data failed:', e);
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
electron_1.ipcMain.handle('wipe-all-data', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
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
            return [2 /*return*/, { success: true }];
        }
        catch (e) {
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
electron_1.ipcMain.handle('run-backup', function (_, arg1, arg2, arg3) { return __awaiter(void 0, void 0, void 0, function () {
    var data, fileName, subfolder, paths, targetDir, folderName, filePath;
    return __generator(this, function (_a) {
        try {
            data = void 0, fileName = void 0, subfolder = void 0;
            // Handle object wrapping from preload.ts or positional arguments
            if (typeof arg1 === 'object' && arg1 !== null && arg1.data !== undefined) {
                (data = arg1.data, fileName = arg1.fileName, subfolder = arg1.subfolder);
            }
            else {
                data = arg1;
                fileName = arg2;
                subfolder = arg3;
            }
            if (!appBasePath)
                throw new Error("Storage folder not set. Please select a data location in Settings.");
            paths = getAppPaths(appBasePath);
            targetDir = paths.backups;
            if (subfolder) {
                folderName = subfolder.replace(/\.\./g, '').replace(/[<>:"|?*]/g, '');
                targetDir = path.join(paths.backups, folderName);
                if (!fs.existsSync(targetDir))
                    fs.mkdirSync(targetDir, { recursive: true });
            }
            filePath = path.join(targetDir, fileName || "backup_".concat(Date.now(), ".enc"));
            fs.writeFileSync(filePath, data);
            return [2 /*return*/, { success: true, fileName: fileName, filePath: filePath }];
        }
        catch (e) {
            console.error('[IPC] run-backup failed:', e);
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
// 4b. Full Secure Backup — AES-256-CBC + scrypt (military-grade SQLite backup)
// Replaces the legacy CryptoJS JSON blob export. Produces a binary-encrypted SQLite
// file that is fully compatible with the restore-sqlite-backup handler.
electron_1.ipcMain.handle('run-full-backup', function (_, arg) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, fileName, subfolder, userKey, paths, targetDir, folderName, safeName, tempPath, finalPath, backupDb, rawRows_1, machineOnlyKeys_1, currentMachineId_1, insertStmt_1, encKey, salt, derivedKey, iv, cipher_1, inputStream_1, outputStream_1, e_6;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                _a = typeof arg === 'object' ? arg : { fileName: arg, subfolder: '', encryptionKey: '' }, fileName = _a.fileName, subfolder = _a.subfolder, userKey = _a.encryptionKey;
                if (!appBasePath)
                    throw new Error('Storage folder not set. Please select a data location in Settings.');
                if (!db)
                    throw new Error('Database connection not available. Please restart the application.');
                paths = getAppPaths(appBasePath);
                targetDir = paths.backups;
                if (subfolder) {
                    folderName = subfolder.replace(/\.\./g, '').replace(/[<>:"|?*]/g, '');
                    targetDir = path.join(paths.backups, folderName);
                }
                if (!fs.existsSync(targetDir))
                    fs.mkdirSync(targetDir, { recursive: true });
                safeName = (fileName || "full_backup_".concat(Date.now(), ".enc")).replace(/[<>:"|?*]/g, '');
                tempPath = path.join(targetDir, "".concat(safeName, ".sqlite.tmp"));
                finalPath = path.join(targetDir, safeName);
                console.log("[IPC] run-full-backup: building SQLite snapshot \u2192 ".concat(safeName));
                backupDb = new better_sqlite3_1.default(tempPath);
                backupDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
                rawRows_1 = db.prepare('SELECT key, value FROM store').all();
                machineOnlyKeys_1 = ['app_machine_id', 'app_developer_secure', 'app_data_size'];
                return [4 /*yield*/, getInternalMachineId()];
            case 1:
                currentMachineId_1 = _b.sent();
                insertStmt_1 = backupDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
                backupDb.transaction(function () {
                    for (var _i = 0, rawRows_2 = rawRows_1; _i < rawRows_2.length; _i++) {
                        var row = rawRows_2[_i];
                        if (!machineOnlyKeys_1.includes(row.key)) {
                            insertStmt_1.run(row.key, row.value);
                        }
                    }
                    if (currentMachineId_1) {
                        insertStmt_1.run('app_origin_machine_id', JSON.stringify(currentMachineId_1));
                        insertStmt_1.run('app_machine_id', JSON.stringify(currentMachineId_1));
                    }
                })();
                backupDb.close();
                console.log("[IPC] run-full-backup: ".concat(rawRows_1.length, " rows snapshotted. Encrypting with AES-256-CBC + scrypt..."));
                encKey = (userKey === null || userKey === void 0 ? void 0 : userKey.trim()) || 'INITIAL_PMS_KEY';
                salt = 'BPP_SALT_v1';
                derivedKey = crypto.scryptSync(encKey, salt, 32);
                iv = crypto.randomBytes(16);
                cipher_1 = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
                inputStream_1 = fs.createReadStream(tempPath);
                outputStream_1 = fs.createWriteStream(finalPath);
                // Write 16-byte IV as the first block so the restore handler can extract it
                outputStream_1.write(iv);
                return [4 /*yield*/, new Promise(function (resolve, reject) {
                        inputStream_1.pipe(cipher_1).pipe(outputStream_1, { end: false });
                        cipher_1.on('end', function () { outputStream_1.end(); resolve(); });
                        cipher_1.on('error', reject);
                        inputStream_1.on('error', reject);
                    })];
            case 2:
                _b.sent();
                fs.unlinkSync(tempPath);
                console.log("[IPC] run-full-backup: secure archive created \u2192 ".concat(finalPath));
                return [2 /*return*/, { success: true, fileName: safeName, filePath: finalPath }];
            case 3:
                e_6 = _b.sent();
                console.error('[IPC] run-full-backup failed:', e_6);
                return [2 /*return*/, { success: false, error: e_6.message }];
            case 4: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle('create-data-backup', function (_, arg) { return __awaiter(void 0, void 0, void 0, function () {
    var fileName, subfolder, financialYear, paths, targetDir, folderName, tempPath, finalPath, backupDb, rawRows, rows_3, excludedKeys_1, currentMachineId_2, insertStmt_2, encryptionKey, salt, derivedKey, iv, cipher_2, input_1, output_1, e_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                fileName = typeof arg === 'string' ? arg : arg.fileName;
                subfolder = typeof arg === 'object' ? arg.subfolder : '';
                financialYear = (typeof arg === 'object' && arg.financialYear) ? arg.financialYear : null;
                console.log("[IPC] create-data-backup requested: ".concat(fileName, " in subfolder: ").concat(subfolder, ", financialYear: ").concat(financialYear || 'ALL'));
                console.log("[IPC] Current DB instance: ".concat(db ? 'Present' : 'NULL'));
                console.log("[IPC] Current appBasePath: ".concat(appBasePath));
                if (!appBasePath)
                    throw new Error("Storage folder not set. Please select a data location in Settings.");
                if (!db) {
                    // Last ditch effort to recover
                    ensureDatabase();
                    if (!db)
                        throw new Error("Database connection failed at ".concat(appBasePath, ". Please restart the application."));
                }
                paths = getAppPaths(appBasePath);
                targetDir = paths.backups;
                if (subfolder) {
                    folderName = subfolder.replace(/\.\./g, '').replace(/[<>:"|?*]/g, '');
                    targetDir = path.join(paths.backups, folderName);
                }
                if (!fs.existsSync(targetDir))
                    fs.mkdirSync(targetDir, { recursive: true });
                tempPath = path.join(targetDir, "".concat(fileName, ".sqlite.tmp"));
                finalPath = path.join(targetDir, "".concat(fileName, ".enc"));
                console.log("[IPC] Creating filtered backup (excluding user/license data, scoped to ".concat(financialYear || 'all FYs', ")..."));
                backupDb = new better_sqlite3_1.default(tempPath);
                backupDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
                rawRows = db.prepare('SELECT key, value FROM store').all();
                rows_3 = rawRows;
                excludedKeys_1 = [
                    'app_license_secure',
                    'app_license_data',
                    'app_users',
                    'app_machine_id',
                    'app_developer_secure',
                    'app_data_size'
                ];
                return [4 /*yield*/, getInternalMachineId()];
            case 1:
                currentMachineId_2 = _a.sent();
                insertStmt_2 = backupDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
                backupDb.transaction(function () {
                    for (var _i = 0, rows_4 = rows_3; _i < rows_4.length; _i++) {
                        var row = rows_4[_i];
                        if (!excludedKeys_1.includes(row.key)) {
                            insertStmt_2.run(row.key, row.value);
                        }
                    }
                    if (currentMachineId_2) {
                        insertStmt_2.run('app_origin_machine_id', JSON.stringify(currentMachineId_2));
                        insertStmt_2.run('app_machine_id', JSON.stringify(currentMachineId_2));
                    }
                })();
                backupDb.close();
                encryptionKey = (typeof arg === 'object' && arg.encryptionKey && String(arg.encryptionKey).trim())
                    ? String(arg.encryptionKey).trim()
                    : 'INITIAL_PMS_KEY';
                console.log("[IPC] Securing Data Archive with ".concat((typeof arg === 'object' && arg.encryptionKey) ? 'Custom Identity Key' : 'Universal Portable Key', "..."));
                salt = 'BPP_SALT_v1';
                derivedKey = crypto.scryptSync(encryptionKey, salt, 32);
                iv = crypto.randomBytes(16);
                cipher_2 = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
                input_1 = fs.createReadStream(tempPath);
                output_1 = fs.createWriteStream(finalPath);
                output_1.write(iv);
                return [4 /*yield*/, new Promise(function (resolve, reject) {
                        input_1.pipe(cipher_2).pipe(output_1, { end: false });
                        cipher_2.on('end', function () { output_1.end(); resolve(true); });
                        cipher_2.on('error', function (err) { return reject(err); });
                        input_1.on('error', function (err) { return reject(err); });
                    })];
            case 2:
                _a.sent();
                fs.unlinkSync(tempPath); // Remove the plain temporary file
                console.log("[IPC] Secure Automatic Backup Created: ".concat(finalPath));
                return [2 /*return*/, { success: true, path: finalPath }];
            case 3:
                e_7 = _a.sent();
                console.error('[IPC] Automatic backup failed:', e_7);
                return [2 /*return*/, { success: false, error: e_7.message }];
            case 4: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle('select-backup-file', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result, filePath, name_1, e_8;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, electron_1.dialog.showOpenDialog({
                        title: 'Select Backup File',
                        properties: ['openFile'],
                        filters: [
                            { name: 'BharatPP Backup Archives (*.enc, *.sqlite)', extensions: ['enc', 'sqlite'] },
                            { name: 'All Files', extensions: ['*'] }
                        ]
                    })];
            case 1:
                result = _a.sent();
                if (!result.canceled && result.filePaths.length > 0) {
                    filePath = result.filePaths[0];
                    name_1 = path.basename(filePath);
                    return [2 /*return*/, { filePath: filePath, name: name_1 }];
                }
                return [2 /*return*/, null];
            case 2:
                e_8 = _a.sent();
                console.error('[IPC] select-backup-file failed:', e_8);
                return [2 /*return*/, null];
            case 3: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle('restore-sqlite-backup', function (_, arg) { return __awaiter(void 0, void 0, void 0, function () {
    var logPath, log, backupFilePath, paths, filename, searchDirs, findFileRecursive_1, _i, searchDirs_1, searchDir, found, dataDir, DB_PATH, tempRestorePath, fd, header, formatCheckBuf, formatFd, bytesRead, sampleBytes, isBase64TextFormat, encryptedBuf_1, tryDecryptBufferSync, dbLicenseKey, keysToTry_1, kStr, pStr, fileBasename, digitsMatch, row, ldata, profileRows, _a, profileRows_1, r, pData, machineId, sanitizedKeys, decryptedBuffer, matchedKey, formats, _b, sanitizedKeys_1, key, _c, formats_1, fmt, sourceDb, rows_5, logMsg, fs_1, path_1, activeId_1, isMigration_1, alwaysExcludedKeys_1, migrationExtraExclusions_1, isAlwaysExcluded_1, isMigrationExcluded_1, isExcludedKey_1, currentMachineId, backupMachineIdRow, backupMachineId, backupProfileRow, activeProfileRow, backupProfile, activeProfile, clean, bName, aName, bCin, aCin, bPan, aPan, bPfCode, aPfCode, bEsi, aEsi, backupId, activeIdUp, fieldMismatch, fieldBlank, forceConfirm, blankWarnings, targetDb_1, fromPeriod_1, toPeriod_1, hasRangeFilter_1, MONTHS_ORDER_1, isInRange_1, parseDateToMonthYear_1, TRANSACTIONAL_PREFIXES_1, filterRowByRange_1, filterEmployeesByRange_1, snapshotCreated, preRestoreSnapshotPath, timestampedSnapshotPath, allKeysInDb, keysToDelete_1, upsertStmt_1, e_9;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                logPath = path.join(electron_1.app.getPath('userData'), 'restore_debug.log');
                log = function (msg) {
                    try {
                        console.log("[IPC RESTORE] ".concat(msg));
                        fs.appendFileSync(logPath, "[".concat(new Date().toISOString(), "] ").concat(msg, "\n"));
                    }
                    catch (_) { }
                };
                _d.label = 1;
            case 1:
                _d.trys.push([1, 7, , 8]);
                log(">>> restore-sqlite-backup called with arg: ".concat(JSON.stringify(arg)));
                backupFilePath = typeof arg === 'string' ? arg : arg.path;
                log("Initial backupFilePath: \"".concat(backupFilePath, "\""));
                if (!appBasePath)
                    throw new Error("App storage not initialized");
                paths = getAppPaths(appBasePath);
                // --- AUTO-DISCOVERY FALLBACK: If file path is relative or missing on disk ---
                if (!backupFilePath || !fs.existsSync(backupFilePath)) {
                    filename = path.basename(backupFilePath || '');
                    log("File not found at explicit path \"".concat(backupFilePath, "\". Auto-discovering \"").concat(filename, "\"..."));
                    searchDirs = [
                        paths.data,
                        path.join(appBasePath, 'Data backup'),
                        path.join(appBasePath, 'Data'),
                        electron_1.app.getPath('downloads'),
                        electron_1.app.getPath('desktop')
                    ];
                    findFileRecursive_1 = function (dir, targetName, depth) {
                        if (depth === void 0) { depth = 0; }
                        if (depth > 5 || !fs.existsSync(dir))
                            return null;
                        try {
                            var entries = fs.readdirSync(dir, { withFileTypes: true });
                            for (var _i = 0, entries_2 = entries; _i < entries_2.length; _i++) {
                                var entry = entries_2[_i];
                                var full = path.join(dir, entry.name);
                                if (entry.isFile() && entry.name.toLowerCase() === targetName.toLowerCase()) {
                                    return full;
                                }
                                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                                    var found = findFileRecursive_1(full, targetName, depth + 1);
                                    if (found)
                                        return found;
                                }
                            }
                        }
                        catch (_) { }
                        return null;
                    };
                    for (_i = 0, searchDirs_1 = searchDirs; _i < searchDirs_1.length; _i++) {
                        searchDir = searchDirs_1[_i];
                        found = findFileRecursive_1(searchDir, filename);
                        if (found) {
                            log("[AUTO-DISCOVERY SUCCESS] Resolved \"".concat(filename, "\" -> \"").concat(found, "\""));
                            backupFilePath = found;
                            break;
                        }
                    }
                }
                if (!fs.existsSync(backupFilePath)) {
                    throw new Error("Backup file not found on disk: \"".concat(backupFilePath, "\". Please select the backup file again."));
                }
                log("Final resolved backupFilePath: \"".concat(backupFilePath, "\""));
                dataDir = paths.data;
                if (activeCompanyId && activeCompanyId !== 'default') {
                    dataDir = path.join(paths.data, activeCompanyId);
                    if (!fs.existsSync(dataDir))
                        fs.mkdirSync(dataDir, { recursive: true });
                }
                DB_PATH = path.join(dataDir, 'active_db.sqlite');
                tempRestorePath = path.join(dataDir, 'restore_temp.sqlite');
                fd = fs.openSync(backupFilePath, 'r');
                header = Buffer.alloc(16);
                fs.readSync(fd, header, 0, 16, 0);
                fs.closeSync(fd);
                if (!header.toString().startsWith('SQLite format 3')) return [3 /*break*/, 2];
                console.log("[IPC] Restoring plain SQLite file...");
                fs.copyFileSync(backupFilePath, tempRestorePath);
                return [3 /*break*/, 4];
            case 2:
                console.log("[IPC] Decrypting Secure SQLite Archive...");
                formatCheckBuf = Buffer.alloc(256);
                formatFd = fs.openSync(backupFilePath, 'r');
                bytesRead = fs.readSync(formatFd, formatCheckBuf, 0, 256, 0);
                fs.closeSync(formatFd);
                sampleBytes = formatCheckBuf.slice(0, bytesRead);
                isBase64TextFormat = sampleBytes.every(function (b) { return b >= 32 && b <= 126; });
                if (isBase64TextFormat) {
                    throw new Error("Legacy backup format detected (CryptoJS text blob). " +
                        "This file was created before BPP v06.02. Please re-export your data using " +
                        "'Local Secure Backup' to generate a new military-grade encrypted file, " +
                        "then retry the restoration.");
                }
                encryptedBuf_1 = fs.readFileSync(backupFilePath);
                tryDecryptBufferSync = function (key, salt, useIvHeader) {
                    try {
                        var derivedKey = crypto.scryptSync(key, salt, 32);
                        var iv = void 0;
                        var ciphertext = void 0;
                        if (useIvHeader) {
                            if (encryptedBuf_1.length < 32)
                                return null;
                            iv = encryptedBuf_1.subarray(0, 16);
                            ciphertext = encryptedBuf_1.subarray(16);
                        }
                        else {
                            iv = Buffer.alloc(16, 0);
                            ciphertext = encryptedBuf_1;
                        }
                        var decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
                        var decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
                        if (decrypted.length >= 100) {
                            var headerAscii = decrypted.toString('utf8', 0, 32);
                            var headerLatin1 = decrypted.toString('latin1', 0, 32);
                            if (headerAscii.includes('SQLite format 3') || headerLatin1.includes('SQLite format 3')) {
                                return decrypted;
                            }
                        }
                        return null;
                    }
                    catch (e) {
                        return null;
                    }
                };
                dbLicenseKey = '';
                keysToTry_1 = ['INITIAL_PMS_KEY', 'bpp_dev_473748', 'BPP_UNIVERSAL_BACKUP_KEY_2026', '031942'];
                if (typeof arg === 'object' && arg.encryptionKey) {
                    kStr = String(arg.encryptionKey).trim();
                    if (kStr)
                        keysToTry_1.unshift(kStr);
                }
                if (typeof arg === 'object' && arg.password) {
                    pStr = String(arg.password).trim();
                    if (pStr)
                        keysToTry_1.unshift(pStr);
                }
                fileBasename = path.basename(backupFilePath);
                digitsMatch = fileBasename.match(/\d{4,8}/g);
                if (digitsMatch) {
                    digitsMatch.forEach(function (d) { return keysToTry_1.push(d); });
                }
                if (db) {
                    try {
                        row = db.prepare('SELECT value FROM store WHERE key = ?').get('app_license_data');
                        if (row) {
                            ldata = JSON.parse(row.value);
                            dbLicenseKey = ldata.key || '';
                            if (dbLicenseKey)
                                keysToTry_1.push(dbLicenseKey.trim());
                        }
                    }
                    catch (e) { }
                    try {
                        profileRows = db.prepare("SELECT value FROM store WHERE key LIKE 'app_company_profile%' OR key = 'app_company_profile'").all();
                        for (_a = 0, profileRows_1 = profileRows; _a < profileRows_1.length; _a++) {
                            r = profileRows_1[_a];
                            try {
                                pData = JSON.parse(r.value);
                                if (pData === null || pData === void 0 ? void 0 : pData.securityPin)
                                    keysToTry_1.push(String(pData.securityPin).trim());
                            }
                            catch (_) { }
                        }
                    }
                    catch (e) { }
                }
                return [4 /*yield*/, getInternalMachineId()];
            case 3:
                machineId = _d.sent();
                keysToTry_1.push(machineId);
                sanitizedKeys = Array.from(new Set(keysToTry_1.filter(function (k) { return !!k; }).map(function (k) { return k.trim(); })));
                decryptedBuffer = null;
                matchedKey = '';
                formats = [
                    { salt: 'BPP_SALT_v1', ivHeader: true },
                    { salt: 'salt', ivHeader: true },
                    { salt: 'BPP_SALT_v1', ivHeader: false },
                    { salt: 'salt', ivHeader: false },
                ];
                log("Keys to try: ".concat(JSON.stringify(sanitizedKeys)));
                for (_b = 0, sanitizedKeys_1 = sanitizedKeys; _b < sanitizedKeys_1.length; _b++) {
                    key = sanitizedKeys_1[_b];
                    for (_c = 0, formats_1 = formats; _c < formats_1.length; _c++) {
                        fmt = formats_1[_c];
                        decryptedBuffer = tryDecryptBufferSync(key, fmt.salt, fmt.ivHeader);
                        if (decryptedBuffer) {
                            matchedKey = key;
                            log("Decryption MATCH FOUND with key=\"".concat(key, "\", salt=\"").concat(fmt.salt, "\", ivHeader=").concat(fmt.ivHeader));
                            break;
                        }
                    }
                    if (decryptedBuffer)
                        break;
                }
                if (!decryptedBuffer) {
                    log("ALL KEYS FAILED TO DECRYPT! Tested keys: ".concat(JSON.stringify(sanitizedKeys)));
                    throw new Error("Decryption failed. Invalid key, wrong password, or the file may be corrupt.");
                }
                fs.writeFileSync(tempRestorePath, decryptedBuffer);
                console.log("[IPC] Decryption successful using key '".concat(matchedKey === machineId ? 'Machine ID' : matchedKey, "'. Written to ").concat(tempRestorePath));
                _d.label = 4;
            case 4:
                sourceDb = void 0;
                rows_5 = [];
                try {
                    sourceDb = new better_sqlite3_1.default(tempRestorePath);
                    rows_5 = sourceDb.prepare('SELECT key, value FROM store').all();
                    console.log("[IPC] Read ".concat(rows_5.length, " rows from backup file."));
                }
                catch (dbErr) {
                    try {
                        if (fs.existsSync(tempRestorePath))
                            fs.unlinkSync(tempRestorePath);
                    }
                    catch (_) { }
                    throw new Error("Invalid Backup File Format (".concat(dbErr.message || 'file is not a database', "). This file could not be decrypted. Please verify the backup file or enter the custom password used when creating it."));
                }
                try {
                    logMsg = "[".concat(new Date().toISOString(), "] Restore: Read ").concat(rows_5.length, " rows. DB_PATH: ").concat(DB_PATH, "\n");
                    fs_1 = require('fs');
                    path_1 = require('path');
                    fs_1.appendFileSync(path_1.join(require('electron').app.getPath('userData'), 'restore_log.txt'), logMsg);
                }
                catch (e) { }
                activeId_1 = activeCompanyId;
                isMigration_1 = typeof arg === 'object' && arg.isMigration === true;
                alwaysExcludedKeys_1 = [
                    'app_license_secure', 'app_license_data', 'app_users',
                    'app_machine_id', 'app_developer_secure', 'app_data_size',
                    'app_company_profile', 'company_profile', 'app_companies', 'app_active_company_id', 'companySignature'
                ];
                migrationExtraExclusions_1 = [
                    'app_company_profile', 'company_profile',
                    'app_config', 'config',
                    'app_companies', 'app_active_company_id', 'companySignature'
                ];
                if (activeId_1 && activeId_1 !== 'default') {
                    migrationExtraExclusions_1.push("app_company_profile_".concat(activeId_1));
                    migrationExtraExclusions_1.push("app_config_".concat(activeId_1));
                    alwaysExcludedKeys_1.push("app_company_profile_".concat(activeId_1));
                }
                isAlwaysExcluded_1 = function (key) {
                    if (alwaysExcludedKeys_1.includes(key))
                        return true;
                    if (key.startsWith('app_license') || key.startsWith('app_user') || key.includes('sys_limit'))
                        return true;
                    if (key.startsWith('app_company_profile') || key.startsWith('company_profile') || key.startsWith('companySignature'))
                        return true;
                    return false;
                };
                isMigrationExcluded_1 = function (key) {
                    if (migrationExtraExclusions_1.includes(key))
                        return true;
                    if (key.startsWith('app_company_profile') || key.startsWith('company_profile') || key.startsWith('companySignature'))
                        return true;
                    if (key.startsWith('app_config_') || key === 'app_config')
                        return true;
                    return false;
                };
                isExcludedKey_1 = function (key) {
                    if (isAlwaysExcluded_1(key))
                        return true;
                    if (isMigration_1 && isMigrationExcluded_1(key))
                        return true;
                    return false;
                };
                if (!!isMigration_1) return [3 /*break*/, 6];
                return [4 /*yield*/, getInternalMachineId()];
            case 5:
                currentMachineId = _d.sent();
                backupMachineIdRow = rows_5.find(function (r) { return r.key === 'app_origin_machine_id' || r.key === 'app_machine_id'; });
                if (!backupMachineIdRow) {
                    sourceDb.close();
                    fs.unlinkSync(tempRestorePath);
                    return [2 /*return*/, {
                            success: false,
                            error: "Universal Restoration Blocked \u2014 Backup file lacks local machine ownership signature.\n\nUniversal Restoration works ONLY for backups created on this local machine. To import data from another machine or external source, please use 'Data Migration' under Utilities."
                        }];
                }
                try {
                    backupMachineId = JSON.parse(backupMachineIdRow.value);
                    if (!backupMachineId || !currentMachineId || backupMachineId.trim().toUpperCase() !== currentMachineId.trim().toUpperCase()) {
                        sourceDb.close();
                        fs.unlinkSync(tempRestorePath);
                        return [2 /*return*/, {
                                success: false,
                                error: "Universal Restoration Blocked \u2014 Data backup file does not belong to this Machine.\n\nThis backup file was generated on another computer. Universal Restoration works ONLY for backups created on this local machine. To import data from another machine, please use 'Data Migration' under Utilities."
                            }];
                    }
                }
                catch (_) {
                    sourceDb.close();
                    fs.unlinkSync(tempRestorePath);
                    return [2 /*return*/, {
                            success: false,
                            error: "Universal Restoration Blocked \u2014 Backup file machine signature is corrupted.\n\nUniversal Restoration works ONLY for valid backups created on this local machine. To import data from another machine, please use 'Data Migration' under Utilities."
                        }];
                }
                _d.label = 6;
            case 6:
                // ── 4. Ensure active database is open ──────────────────────────────────────────────
                console.log("[IPC] Restoring into database path: ".concat(DB_PATH, " | Mode: ").concat(isMigration_1 ? 'DATA MIGRATION' : 'UNIVERSAL RESTORATION'));
                if (!db) {
                    db = new better_sqlite3_1.default(DB_PATH, { timeout: 15000 });
                    db.pragma('journal_mode = WAL');
                }
                backupProfileRow = null;
                if (activeId_1 && activeId_1 !== 'default') {
                    backupProfileRow = rows_5.find(function (r) { return r.key === "app_company_profile_".concat(activeId_1); });
                }
                if (!backupProfileRow)
                    backupProfileRow = rows_5.find(function (r) { return r.key === 'app_company_profile' || r.key === 'company_profile'; });
                if (!backupProfileRow && activeId_1 && activeId_1 !== 'default') {
                    backupProfileRow = rows_5.find(function (r) { return r.key.startsWith('app_company_profile_') && r.key.includes(activeId_1); });
                }
                if (!backupProfileRow)
                    backupProfileRow = rows_5.find(function (r) { return r.key.startsWith('app_company_profile') || r.key === 'company_profile'; });
                activeProfileRow = null;
                if (db) {
                    if (activeId_1 && activeId_1 !== 'default') {
                        activeProfileRow = db.prepare('SELECT value FROM store WHERE key = ?').get("app_company_profile_".concat(activeId_1));
                    }
                    if (!activeProfileRow) {
                        activeProfileRow = db.prepare("SELECT value FROM store WHERE key = 'app_company_profile' OR key = 'company_profile'").get();
                    }
                    if (!activeProfileRow) {
                        activeProfileRow = db.prepare("SELECT value FROM store WHERE key LIKE 'app_company_profile%' OR key = 'company_profile'").get();
                    }
                }
                if (backupProfileRow && activeProfileRow) {
                    try {
                        backupProfile = JSON.parse(backupProfileRow.value);
                        activeProfile = JSON.parse(activeProfileRow.value);
                        clean = function (v) { return String(v || '').trim().toUpperCase(); };
                        bName = clean(backupProfile.establishmentName || backupProfile.tradeName);
                        aName = clean(activeProfile.establishmentName || activeProfile.tradeName);
                        bCin = clean(backupProfile.cin);
                        aCin = clean(activeProfile.cin);
                        bPan = clean(backupProfile.pan);
                        aPan = clean(activeProfile.pan);
                        bPfCode = clean(backupProfile.pfCode);
                        aPfCode = clean(activeProfile.pfCode);
                        bEsi = clean(backupProfile.esiCode);
                        aEsi = clean(activeProfile.esiCode);
                        backupId = clean(backupProfile.id);
                        activeIdUp = clean(activeId_1);
                        console.log("[IPC] Compatibility Gate \u2014 Mode: ".concat(isMigration_1 ? 'MIGRATION' : 'RESTORE', " | Backup: \"").concat(bName, "\" (").concat(backupId, ") | Target: \"").concat(aName, "\" (").concat(activeIdUp, ")"));
                        console.log("[IPC]   CIN=".concat(bCin, "|").concat(aCin, "  PAN=").concat(bPan, "|").concat(aPan, "  PF=").concat(bPfCode, "|").concat(aPfCode, "  ESI=").concat(bEsi, "|").concat(aEsi));
                        // ── RULE: Company Name is ALWAYS mandatory — blank on either side = hard block ──
                        if (!bName) {
                            sourceDb.close();
                            fs.unlinkSync(tempRestorePath);
                            return [2 /*return*/, { success: false, error: "Restore/Migration Blocked \u2014 Company Name is missing in the backup file. This backup cannot be used." }];
                        }
                        if (!aName) {
                            sourceDb.close();
                            fs.unlinkSync(tempRestorePath);
                            return [2 /*return*/, { success: false, error: "Restore/Migration Blocked \u2014 Company Name is not set on this machine. Please complete the Company Profile before restoring." }];
                        }
                        fieldMismatch = function (bVal, aVal) { return bVal && aVal && bVal !== aVal; };
                        fieldBlank = function (bVal, aVal) { return !bVal || !aVal; };
                        forceConfirm = !!arg.forceConfirm;
                        // ── UNIFIED MANDATORY 5-FIELD COMPATIBILITY GATE (Both Universal Restoration & Migration) ──────
                        if (backupId && activeIdUp && activeIdUp !== 'DEFAULT' && backupId !== activeIdUp) {
                            sourceDb.close();
                            fs.unlinkSync(tempRestorePath);
                            return [2 /*return*/, { success: false, error: "".concat(isMigration_1 ? 'Migration' : 'Universal Restoration', " Blocked \u2014 Company Silo Mismatch: Backup silo '").concat(backupId, "' \u2260 target silo '").concat(activeIdUp, "'. Select the correct company first.") }];
                        }
                        if (fieldMismatch(bName, aName)) {
                            sourceDb.close();
                            fs.unlinkSync(tempRestorePath);
                            return [2 /*return*/, { success: false, error: "".concat(isMigration_1 ? 'Migration' : 'Universal Restoration', " Blocked \u2014 Company Name Mismatch: Backup '").concat(bName, "' \u2260 target '").concat(aName, "'.") }];
                        }
                        if (fieldMismatch(bCin, aCin)) {
                            sourceDb.close();
                            fs.unlinkSync(tempRestorePath);
                            return [2 /*return*/, { success: false, error: "".concat(isMigration_1 ? 'Migration' : 'Universal Restoration', " Blocked \u2014 CIN Mismatch: Backup CIN (").concat(bCin, ") \u2260 target CIN (").concat(aCin, ").") }];
                        }
                        if (fieldMismatch(bPan, aPan)) {
                            sourceDb.close();
                            fs.unlinkSync(tempRestorePath);
                            return [2 /*return*/, { success: false, error: "".concat(isMigration_1 ? 'Migration' : 'Universal Restoration', " Blocked \u2014 PAN Mismatch: Backup PAN (").concat(bPan, ") \u2260 target PAN (").concat(aPan, ").") }];
                        }
                        if (fieldMismatch(bPfCode, aPfCode)) {
                            sourceDb.close();
                            fs.unlinkSync(tempRestorePath);
                            return [2 /*return*/, { success: false, error: "".concat(isMigration_1 ? 'Migration' : 'Universal Restoration', " Blocked \u2014 PF Code Mismatch: Backup PF Code (").concat(bPfCode, ") \u2260 target PF Code (").concat(aPfCode, ").") }];
                        }
                        if (fieldMismatch(bEsi, aEsi)) {
                            sourceDb.close();
                            fs.unlinkSync(tempRestorePath);
                            return [2 /*return*/, { success: false, error: "".concat(isMigration_1 ? 'Migration' : 'Universal Restoration', " Blocked \u2014 ESI Code Mismatch: Backup ESI Code (").concat(bEsi, ") \u2260 target ESI Code (").concat(aEsi, ").") }];
                        }
                        // Blank mandatory fields warning gate
                        if (!forceConfirm) {
                            blankWarnings = [];
                            if (fieldBlank(bCin, aCin))
                                blankWarnings.push("CIN \u2014 ".concat(!bCin ? 'missing in backup' : 'not set on target machine'));
                            if (fieldBlank(bPan, aPan))
                                blankWarnings.push("PAN \u2014 ".concat(!bPan ? 'missing in backup' : 'not set on target machine'));
                            if (fieldBlank(bPfCode, aPfCode))
                                blankWarnings.push("PF Code \u2014 ".concat(!bPfCode ? 'missing in backup' : 'not set on target machine'));
                            if (fieldBlank(bEsi, aEsi))
                                blankWarnings.push("ESI Code \u2014 ".concat(!bEsi ? 'missing in backup' : 'not set on target machine'));
                            if (blankWarnings.length > 0) {
                                sourceDb.close();
                                fs.unlinkSync(tempRestorePath);
                                return [2 /*return*/, { success: false, requiresConfirmation: true, warnings: blankWarnings }];
                            }
                        }
                        console.log("[IPC] ".concat(isMigration_1 ? 'DATA MIGRATION' : 'UNIVERSAL RESTORATION', ": All 5-field compatibility checks passed \u2713"));
                    }
                    catch (e) {
                        console.warn('[IPC] Failed to parse company profiles for compatibility gate:', e);
                    }
                }
                else if (!activeProfileRow) {
                    console.log("[IPC] No active profile on target machine \u2014 allowing restore unconditionally (fresh install / new silo).");
                }
                if (!db)
                    throw new Error("Database not initialized");
                targetDb_1 = db;
                fromPeriod_1 = arg.fromPeriod;
                toPeriod_1 = arg.toPeriod;
                hasRangeFilter_1 = !isMigration_1 && fromPeriod_1 && toPeriod_1;
                MONTHS_ORDER_1 = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                isInRange_1 = function (recMonth, recYear) {
                    if (!hasRangeFilter_1)
                        return true;
                    var from = fromPeriod_1.year * 12 + MONTHS_ORDER_1.indexOf(fromPeriod_1.month);
                    var to = toPeriod_1.year * 12 + MONTHS_ORDER_1.indexOf(toPeriod_1.month);
                    var rec = recYear * 12 + MONTHS_ORDER_1.indexOf(recMonth);
                    return rec >= from && rec <= to;
                };
                parseDateToMonthYear_1 = function (dateStr) {
                    try {
                        var parts = dateStr.split('-');
                        if (parts.length !== 3)
                            return null;
                        var yr = parts[0].length === 4 ? parseInt(parts[0]) : parseInt(parts[2]);
                        var mo = parts[0].length === 4 ? parseInt(parts[1]) - 1 : parseInt(parts[1]) - 1;
                        if (isNaN(yr) || isNaN(mo) || mo < 0 || mo > 11)
                            return null;
                        return { month: MONTHS_ORDER_1[mo], year: yr };
                    }
                    catch (_) {
                        return null;
                    }
                };
                TRANSACTIONAL_PREFIXES_1 = [
                    'app_attendance', 'app_leave_ledgers', 'app_advance_ledgers',
                    'app_payroll_history', 'app_fines', 'app_arrear_history', 'app_ot_records'
                ];
                filterRowByRange_1 = function (value) {
                    if (!hasRangeFilter_1)
                        return value;
                    try {
                        var arr = JSON.parse(value);
                        if (!Array.isArray(arr))
                            return value;
                        var filtered = arr.filter(function (item) {
                            var m = String(item.month || item.Month || '').trim();
                            var y = parseInt(String(item.year || item.Year || '0'));
                            if (m && !isNaN(y) && y > 0)
                                return isInRange_1(m, y);
                            // Fallback: try date string fields
                            var dateStr = item.date || item.Date || item.createdDate || item.entryDate || '';
                            if (dateStr) {
                                var parsed = parseDateToMonthYear_1(String(dateStr));
                                if (parsed)
                                    return isInRange_1(parsed.month, parsed.year);
                            }
                            return true; // keep undated records
                        });
                        return JSON.stringify(filtered);
                    }
                    catch (_) {
                        return value;
                    }
                };
                filterEmployeesByRange_1 = function (value) {
                    if (!hasRangeFilter_1)
                        return value;
                    try {
                        var arr = JSON.parse(value);
                        if (!Array.isArray(arr))
                            return value;
                        var toVal_1 = toPeriod_1.year * 12 + MONTHS_ORDER_1.indexOf(toPeriod_1.month);
                        var filtered = arr.filter(function (emp) {
                            var doj = emp.doj || emp.joiningDate || emp.dateOfJoining || '';
                            if (!doj)
                                return true; // no doj → always include
                            var parsed = parseDateToMonthYear_1(String(doj));
                            if (!parsed)
                                return true; // unparseable → always include
                            var dojVal = parsed.year * 12 + MONTHS_ORDER_1.indexOf(parsed.month);
                            return dojVal <= toVal_1; // joined on or before toPeriod end
                        });
                        return JSON.stringify(filtered);
                    }
                    catch (_) {
                        return value;
                    }
                };
                snapshotCreated = false;
                preRestoreSnapshotPath = path.join(dataDir, 'active_db_pre_restore.snapshot.bak');
                timestampedSnapshotPath = path.join(dataDir, "active_db_snapshot_".concat(Date.now(), ".bak"));
                try {
                    if (targetDb_1) {
                        targetDb_1.pragma('wal_checkpoint(FULL)');
                    }
                    if (fs.existsSync(DB_PATH)) {
                        fs.copyFileSync(DB_PATH, preRestoreSnapshotPath);
                        fs.copyFileSync(DB_PATH, timestampedSnapshotPath);
                        snapshotCreated = true;
                        log("[IPC] Automatic pre-operation safety snapshots created successfully: \"".concat(preRestoreSnapshotPath, "\" and \"").concat(timestampedSnapshotPath, "\""));
                    }
                }
                catch (snapErr) {
                    console.warn('[IPC] Failed to create pre-operation snapshot warning:', snapErr);
                }
                allKeysInDb = targetDb_1.prepare('SELECT key FROM store').all().map(function (r) { return r.key; });
                keysToDelete_1 = allKeysInDb.filter(function (k) { return !isExcludedKey_1(k); });
                upsertStmt_1 = targetDb_1.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
                try {
                    targetDb_1.transaction(function () {
                        // FULL RESTORE (ALL periods): delete non-excluded keys then write — clean overwrite
                        // FULL RESTORE (RANGE): no delete — upsert filtered data (preserves out-of-range records)
                        // DATA MIGRATION: no delete — upsert only
                        if (keysToDelete_1.length > 0 && !isMigration_1 && !hasRangeFilter_1) {
                            var deleteStmt = targetDb_1.prepare("DELETE FROM store WHERE key IN (".concat(keysToDelete_1.map(function () { return '?'; }).join(','), ")"));
                            deleteStmt.run.apply(deleteStmt, keysToDelete_1);
                        }
                        var written = 0;
                        var _loop_3 = function (row) {
                            if (isExcludedKey_1(row.key))
                                return "continue";
                            var valueToWrite = row.value;
                            if (hasRangeFilter_1) {
                                if (TRANSACTIONAL_PREFIXES_1.some(function (p) { return row.key.startsWith(p); })) {
                                    // Payroll, attendance, ledgers etc. — filter by month/year
                                    valueToWrite = filterRowByRange_1(row.value);
                                }
                                else if (row.key.startsWith('app_employees')) {
                                    // Employee Master — filter by doj ≤ toPeriod
                                    valueToWrite = filterEmployeesByRange_1(row.value);
                                }
                            }
                            upsertStmt_1.run(row.key, valueToWrite);
                            written++;
                        };
                        for (var _i = 0, rows_6 = rows_5; _i < rows_6.length; _i++) {
                            var row = rows_6[_i];
                            _loop_3(row);
                        }
                        if (hasRangeFilter_1) {
                            console.log("[IPC] FULL RESTORE (RANGE ".concat(fromPeriod_1.month, " ").concat(fromPeriod_1.year, " \u2192 ").concat(toPeriod_1.month, " ").concat(toPeriod_1.year, "): ").concat(written, " rows written."));
                        }
                        else {
                            console.log("[IPC] ".concat(isMigration_1 ? 'Migration' : 'Restore', ": ").concat(written, " rows written to target DB."));
                        }
                    })();
                }
                catch (txError) {
                    console.error('[IPC] Transaction failed during restore! Rolling back to pre-operation snapshot...', txError);
                    if (snapshotCreated && fs.existsSync(preRestoreSnapshotPath)) {
                        try {
                            if (db) {
                                db.close();
                                db = null;
                            }
                            fs.copyFileSync(preRestoreSnapshotPath, DB_PATH);
                            db = new better_sqlite3_1.default(DB_PATH, { timeout: 15000 });
                            db.pragma('journal_mode = WAL');
                            console.log('[IPC] Automatic rollback to pre-operation snapshot successful ✓');
                        }
                        catch (rbErr) {
                            console.error('[IPC] Automatic rollback failed:', rbErr);
                        }
                    }
                    sourceDb.close();
                    try {
                        fs.unlinkSync(tempRestorePath);
                    }
                    catch (_) { }
                    throw new Error("Restoration failed during database write (".concat(txError.message, "). Active database was automatically restored to pre-operation safety snapshot."));
                }
                // ── 7. Clean up ────────────────────────────────────────────────────────────────────
                sourceDb.close();
                fs.unlinkSync(tempRestorePath);
                console.log("[IPC] ".concat(isMigration_1 ? 'Data Migration' : 'Full Restore', " completed successfully."));
                return [2 /*return*/, { success: true }];
            case 7:
                e_9 = _d.sent();
                console.error('[IPC] restoration failed:', e_9);
                if (!db && appBasePath)
                    initializeDatabase(appBasePath);
                return [2 /*return*/, { success: false, error: e_9.message }];
            case 8: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle('restore-from-snapshot', function (_, snapshotFileName) { return __awaiter(void 0, void 0, void 0, function () {
    var paths, dataDir, DB_PATH, targetSnapshot;
    return __generator(this, function (_a) {
        try {
            if (!appBasePath)
                throw new Error("App storage not initialized");
            paths = getAppPaths(appBasePath);
            dataDir = paths.data;
            if (activeCompanyId && activeCompanyId !== 'default') {
                dataDir = path.join(paths.data, activeCompanyId);
            }
            DB_PATH = path.join(dataDir, 'active_db.sqlite');
            targetSnapshot = snapshotFileName
                ? path.join(dataDir, snapshotFileName)
                : path.join(dataDir, 'active_db_pre_restore.snapshot.bak');
            if (!fs.existsSync(targetSnapshot)) {
                throw new Error('No pre-operation safety snapshot found to restore.');
            }
            if (db) {
                try {
                    db.close();
                    db = null;
                }
                catch (_) { }
            }
            fs.copyFileSync(targetSnapshot, DB_PATH);
            db = new better_sqlite3_1.default(DB_PATH, { timeout: 15000 });
            db.pragma('journal_mode = WAL');
            console.log("[IPC] Successfully reverted active database to pre-operation snapshot: \"".concat(targetSnapshot, "\""));
            return [2 /*return*/, { success: true, message: 'Database successfully reverted to pre-operation snapshot.' }];
        }
        catch (e) {
            console.error('[IPC] restore-from-snapshot failed:', e);
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
electron_1.ipcMain.handle('list-safety-snapshots', function () { return __awaiter(void 0, void 0, void 0, function () {
    var paths, dataDir_5, files, snapshots;
    return __generator(this, function (_a) {
        try {
            if (!appBasePath)
                throw new Error("App storage not initialized");
            paths = getAppPaths(appBasePath);
            dataDir_5 = paths.data;
            if (activeCompanyId && activeCompanyId !== 'default') {
                dataDir_5 = path.join(paths.data, activeCompanyId);
            }
            if (!fs.existsSync(dataDir_5))
                return [2 /*return*/, { success: true, snapshots: [] }];
            files = fs.readdirSync(dataDir_5);
            snapshots = files
                .filter(function (f) { return f.includes('snapshot') && f.endsWith('.bak'); })
                .map(function (f) {
                var stats = fs.statSync(path.join(dataDir_5, f));
                return { filename: f, date: stats.mtime.toISOString(), size: stats.size };
            })
                .sort(function (a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime(); });
            return [2 /*return*/, { success: true, snapshots: snapshots }];
        }
        catch (e) {
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
function getInternalMachineId() {
    return __awaiter(this, void 0, void 0, function () {
        var output, lines, psOutput;
        return __generator(this, function (_a) {
            try {
                output = (0, child_process_1.execSync)('wmic csproduct get uuid', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).toString();
                lines = output.split(/\r?\n/).filter(function (line) { return line.trim() && !line.includes('UUID'); });
                if (lines.length > 0 && lines[0].trim())
                    return [2 /*return*/, lines[0].trim()];
            }
            catch (e) { }
            try {
                psOutput = (0, child_process_1.execSync)('powershell.exe -NoProfile -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).toString();
                if (psOutput && psOutput.trim())
                    return [2 /*return*/, psOutput.trim()];
            }
            catch (e) { }
            return [2 /*return*/, 'FALLBACK-MACHINE-ID-SECURE'];
        });
    });
}
// 6. App Closing
electron_1.ipcMain.handle('close-app', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        console.log("[IPC] 'close-app' requested. Force terminating application process.");
        try {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setClosable(true);
                mainWindow.destroy();
            }
        }
        catch (e) { }
        try {
            electron_1.app.exit(0);
        }
        catch (e) { }
        try {
            electron_1.app.quit();
        }
        catch (e) { }
        try {
            process.exit(0);
        }
        catch (e) { }
        return [2 /*return*/];
    });
}); });
// 6. Machine ID Retrieval
electron_1.ipcMain.handle('get-machine-id', function () { return __awaiter(void 0, void 0, void 0, function () {
    var output, lines, psOutput;
    return __generator(this, function (_a) {
        try {
            try {
                output = (0, child_process_1.execSync)('wmic csproduct get uuid', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).toString();
                lines = output.split(/\r?\n/).filter(function (line) { return line.trim() && !line.includes('UUID') && !line.includes('wmic'); });
                if (lines.length > 0 && lines[0].trim()) {
                    return [2 /*return*/, lines[0].trim()];
                }
            }
            catch (e) {
                // Ignore WMIC failure, fallback to PowerShell
            }
            psOutput = (0, child_process_1.execSync)('powershell.exe -NoProfile -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).toString();
            if (psOutput && psOutput.trim()) {
                return [2 /*return*/, psOutput.trim()];
            }
            return [2 /*return*/, 'UNKNOWN-MACHINE-ID'];
        }
        catch (e) {
            console.error('Failed to get machine ID:', e);
            return [2 /*return*/, 'UNKNOWN-MACHINE-ID'];
        }
        return [2 /*return*/];
    });
}); });
// 7. OS Version Retrieval
electron_1.ipcMain.handle('get-os-version', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, os.release()];
    });
}); });
electron_1.ipcMain.handle('set-fullscreen', function (_, flag) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        if (mainWindow) {
            mainWindow.setFullScreen(flag);
            return [2 /*return*/, { success: true }];
        }
        return [2 /*return*/, { success: false, error: 'No main window' }];
    });
}); });
electron_1.ipcMain.handle('get-fullscreen', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        if (mainWindow) {
            return [2 /*return*/, mainWindow.isFullScreen()];
        }
        return [2 /*return*/, false];
    });
}); });
electron_1.ipcMain.handle('relaunch-app', function () {
    electron_1.app.relaunch();
    electron_1.app.exit(0);
});
electron_1.ipcMain.handle('open-external', function (_, url) { return __awaiter(void 0, void 0, void 0, function () {
    var e_10;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, electron_1.shell.openExternal(url)];
            case 1:
                _a.sent();
                return [2 /*return*/, { success: true }];
            case 2:
                e_10 = _a.sent();
                return [2 /*return*/, { success: false, error: e_10.message }];
            case 3: return [2 /*return*/];
        }
    });
}); });
electron_1.ipcMain.handle('api-fetch', function (_, url, options) { return __awaiter(void 0, void 0, void 0, function () {
    var logFilePath_1, fs_2, path_2, dir;
    return __generator(this, function (_a) {
        try {
            logFilePath_1 = 'd:/ILCBala/PMS/scratch/api_fetch.log';
            fs_2 = require('fs');
            path_2 = require('path');
            try {
                dir = path_2.dirname(logFilePath_1);
                if (!fs_2.existsSync(dir)) {
                    fs_2.mkdirSync(dir, { recursive: true });
                }
                fs_2.appendFileSync(logFilePath_1, "[".concat(new Date().toISOString(), "] REQ: ").concat((options === null || options === void 0 ? void 0 : options.method) || 'GET', " ").concat(url, "\nBODY: ").concat((options === null || options === void 0 ? void 0 : options.body) || 'none', "\n"));
            }
            catch (err) {
                console.error("Failed to write request log:", err);
            }
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    var request = electron_1.net.request({
                        url: url,
                        method: (options === null || options === void 0 ? void 0 : options.method) || 'GET',
                        redirect: 'follow'
                    });
                    var timeout = setTimeout(function () {
                        request.abort();
                        try {
                            fs_2.appendFileSync(logFilePath_1, "[".concat(new Date().toISOString(), "] RES: TIMEOUT\n\n"));
                        }
                        catch (e) { }
                        reject({ message: '🔌 API Request Timed Out (30s)' });
                    }, 30000);
                    if (options === null || options === void 0 ? void 0 : options.headers) {
                        for (var _i = 0, _a = Object.entries(options.headers); _i < _a.length; _i++) {
                            var _b = _a[_i], key = _b[0], value = _b[1];
                            request.setHeader(key, value);
                        }
                    }
                    request.on('response', function (response) {
                        var responseData = '';
                        response.on('data', function (chunk) {
                            responseData += chunk.toString('utf8');
                        });
                        response.on('end', function () {
                            clearTimeout(timeout);
                            var responseBody;
                            try {
                                responseBody = JSON.parse(responseData);
                            }
                            catch (_a) {
                                responseBody = responseData;
                            }
                            try {
                                fs_2.appendFileSync(logFilePath_1, "[".concat(new Date().toISOString(), "] RES STATUS: ").concat(response.statusCode, " | BODY: ").concat(JSON.stringify(responseBody), "\n\n"));
                            }
                            catch (e) { }
                            if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
                                console.error("\uD83D\uDD0C fetch failed [".concat(response.statusCode, "]:"), responseBody);
                                reject({ message: "HTTP error! status: ".concat(response.statusCode) });
                            }
                            else {
                                resolve(responseBody);
                            }
                        });
                    });
                    request.on('error', function (error) {
                        clearTimeout(timeout);
                        console.error('🔌 Error in api-fetch:', error);
                        try {
                            fs_2.appendFileSync(logFilePath_1, "[".concat(new Date().toISOString(), "] RES ERROR: ").concat(error.message, "\n\n"));
                        }
                        catch (e) { }
                        reject({ message: error.message });
                    });
                    if (options === null || options === void 0 ? void 0 : options.body) {
                        request.write(options.body);
                    }
                    request.end();
                })];
        }
        catch (error) {
            throw { message: error.message };
        }
        return [2 /*return*/];
    });
}); });
// 8. Dynamic Folder Detection
electron_1.ipcMain.handle('find-bpp-app', function () { return __awaiter(void 0, void 0, void 0, function () {
    var potentialRoots_2, output, drives, _i, potentialRoots_1, p, dataPath, dbPath;
    return __generator(this, function (_a) {
        try {
            potentialRoots_2 = [];
            // 1. Get all logical drives on Windows
            try {
                output = (0, child_process_1.execSync)('wmic logicaldisk get name', { encoding: 'utf8' });
                drives = output.split(/\r?\n/)
                    .filter(function (line) { return line.trim() && line.includes(':'); })
                    .map(function (line) { return line.trim(); });
                drives.forEach(function (drive) {
                    potentialRoots_2.push(path.join(drive, 'BPP_APP'));
                    potentialRoots_2.push(path.join(drive, 'BharatPayRoll'));
                    potentialRoots_2.push(path.join(drive, 'BharatPayRoll', 'BPP_APP'));
                    potentialRoots_2.push(path.join(drive, 'BPP', 'BPP_APP')); // Check subfolder too
                    potentialRoots_2.push(path.join(drive, 'BharatPP'));
                });
            }
            catch (e) {
                // Fallback if WMIC fails
                ['C:', 'D:', 'E:', 'F:', 'G:', 'H:'].forEach(function (d) {
                    potentialRoots_2.push(path.join(d, '/', 'BPP_APP'));
                    potentialRoots_2.push(path.join(d, '/', 'BharatPayRoll'));
                    potentialRoots_2.push(path.join(d, '/', 'BharatPayRoll', 'BPP_APP'));
                    potentialRoots_2.push(path.join(d, '/', 'BharatPP'));
                });
            }
            // 2. Add User Home
            potentialRoots_2.push(path.join(electron_1.app.getPath('home'), 'BPP_APP'));
            potentialRoots_2.push(path.join(electron_1.app.getPath('home'), 'BharatPayRoll'));
            potentialRoots_2.push(path.join(electron_1.app.getPath('home'), 'BharatPayRoll', 'BPP_APP'));
            // 3. Scan for first existing one
            for (_i = 0, potentialRoots_1 = potentialRoots_2; _i < potentialRoots_1.length; _i++) {
                p = potentialRoots_1[_i];
                if (fs.existsSync(p)) {
                    dataPath = path.join(p, 'BharatPP');
                    dbPath = path.join(p, 'active_db.sqlite');
                    if (fs.existsSync(dataPath) || fs.existsSync(dbPath)) {
                        console.log('🔄 Dynamic Detection: Found App Data at', p);
                        return [2 /*return*/, { success: true, path: p }];
                    }
                }
            }
            return [2 /*return*/, { success: false, error: 'BPP_APP folder not found' }];
        }
        catch (e) {
            return [2 /*return*/, { success: false, error: e.message }];
        }
        return [2 /*return*/];
    });
}); });
// ── 8.5 DIAGNOSTICS & TELEMETRY ──
electron_1.ipcMain.handle('generate-diagnostics', function (_, uiState) { return __awaiter(void 0, void 0, void 0, function () {
    var timestamp, defaultPath, result, fsState, rootDbPath1, rootDbPath2, legacyDbPath, scanDirs, _i, scanDirs_1, scanDir, items, _loop_4, _a, items_1, item, payload, jsonString, encryptionKey, cipher, encrypted, e_11;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                if (!mainWindow)
                    throw new Error("No main window");
                timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                defaultPath = path.join(electron_1.app.getPath('desktop'), "BPP_Diagnostics_".concat(timestamp, ".bpplog"));
                return [4 /*yield*/, electron_1.dialog.showSaveDialog(mainWindow, {
                        title: 'Save Secure Diagnostic Report',
                        defaultPath: defaultPath,
                        filters: [{ name: 'BPP Encrypted Log', extensions: ['bpplog'] }]
                    })];
            case 1:
                result = _b.sent();
                if (result.canceled || !result.filePath) {
                    return [2 /*return*/, { success: false, error: 'User canceled save dialog' }];
                }
                fsState = {
                    appBasePath: appBasePath || 'NOT_CONFIGURED',
                    rootExists: false,
                    rootSize: 0,
                    legacyDataExists: false,
                    legacyDataSize: 0,
                    silos: []
                };
                if (appBasePath && fs.existsSync(appBasePath)) {
                    rootDbPath1 = path.join(appBasePath, 'active_db.sqlite');
                    rootDbPath2 = path.join(appBasePath, 'app_companies.sqlite');
                    if (fs.existsSync(rootDbPath1)) {
                        fsState.rootExists = true;
                        fsState.rootSize = fs.statSync(rootDbPath1).size;
                    }
                    else if (fs.existsSync(rootDbPath2)) {
                        fsState.rootExists = true;
                        fsState.rootSize = fs.statSync(rootDbPath2).size;
                    }
                    legacyDbPath = path.join(appBasePath, 'Data', 'active_db.sqlite');
                    if (fs.existsSync(legacyDbPath)) {
                        fsState.legacyDataExists = true;
                        fsState.legacyDataSize = fs.statSync(legacyDbPath).size;
                    }
                    scanDirs = [appBasePath, path.join(appBasePath, 'BPP_APP'), path.join(appBasePath, 'BharatPP', 'Data')];
                    for (_i = 0, scanDirs_1 = scanDirs; _i < scanDirs_1.length; _i++) {
                        scanDir = scanDirs_1[_i];
                        if (fs.existsSync(scanDir)) {
                            items = fs.readdirSync(scanDir, { withFileTypes: true });
                            _loop_4 = function (item) {
                                if (item.isDirectory()) {
                                    var siloDbPath = path.join(scanDir, item.name, 'active_db.sqlite');
                                    // Only count it as a silo if it has an active_db.sqlite, or its name matches a typical ID format (e.g. SAIPRA_123456)
                                    if (fs.existsSync(siloDbPath) || item.name.includes('_')) {
                                        // Ensure we don't duplicate if they somehow exist in both
                                        if (!fsState.silos.some(function (s) { return s.folder === item.name; })) {
                                            fsState.silos.push({
                                                folder: path.basename(scanDir) === 'BPP_APP' ? "BPP_APP/".concat(item.name) : item.name,
                                                exists: fs.existsSync(siloDbPath),
                                                size: fs.existsSync(siloDbPath) ? fs.statSync(siloDbPath).size : 0
                                            });
                                        }
                                    }
                                }
                            };
                            for (_a = 0, items_1 = items; _a < items_1.length; _a++) {
                                item = items_1[_a];
                                _loop_4(item);
                            }
                        }
                    }
                }
                payload = {
                    timestamp: new Date().toISOString(),
                    os: process.platform,
                    uiState: uiState,
                    fsState: fsState
                };
                jsonString = JSON.stringify(payload, null, 2);
                encryptionKey = 'bpp_dev_473748';
                cipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync(encryptionKey, 'salt', 32), Buffer.alloc(16, 0));
                encrypted = cipher.update(jsonString, 'utf8', 'base64');
                encrypted += cipher.final('base64');
                fs.writeFileSync(result.filePath, encrypted, 'utf8');
                return [2 /*return*/, { success: true, filePath: result.filePath }];
            case 2:
                e_11 = _b.sent();
                console.error('[IPC] generate-diagnostics failed:', e_11);
                return [2 /*return*/, { success: false, error: e_11.message }];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ── 9. SMART AUTO-UPDATE HANDLERS ──
var INSTALLER_NAME = 'bpp_installer.exe';
var getInstallerPath = function () { return path.join(os.tmpdir(), INSTALLER_NAME); };
var isUpdateDownloading = false;
var closeRequested = false;
electron_1.ipcMain.handle('start-update-download', function (_, downloadUrl, expectedHash) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        isUpdateDownloading = true;
        return [2 /*return*/, new Promise(function (resolve) {
                try {
                    var dest_1 = getInstallerPath();
                    var file_1 = fs.createWriteStream(dest_1);
                    var request = electron_1.net.request({
                        url: downloadUrl,
                        redirect: 'follow'
                    });
                    request.on('response', function (response) {
                        var totalBytes = parseInt(response.headers['content-length'], 10) || 0;
                        var downloadedBytes = 0;
                        var lastEmittedProgress = -1;
                        response.on('data', function (chunk) {
                            file_1.write(chunk);
                            downloadedBytes += chunk.length;
                            if (totalBytes > 0) {
                                var progress_1 = Math.round((downloadedBytes / totalBytes) * 100);
                                if (progress_1 !== lastEmittedProgress) {
                                    lastEmittedProgress = progress_1;
                                    electron_1.BrowserWindow.getAllWindows().forEach(function (win) {
                                        win.webContents.send('update-download-progress', progress_1);
                                    });
                                }
                            }
                        });
                        response.on('end', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var buffer, fd, hash_1, input_2, calculatedHash, hashErr_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        file_1.end();
                                        console.log('✅ Update downloaded to:', dest_1);
                                        // --- V02.02.40: BINARY INTEGRITY CHECK ---
                                        // Verify the file is actually a Windows Executable (MZ Header)
                                        try {
                                            buffer = new Uint8Array(2);
                                            fd = fs.openSync(dest_1, 'r');
                                            fs.readSync(fd, buffer, 0, 2, 0);
                                            fs.closeSync(fd);
                                            if (String.fromCharCode(buffer[0], buffer[1]) !== 'MZ') {
                                                console.error('❌ Security Violation: Downloaded file is not a valid Windows Executable.');
                                                fs.unlinkSync(dest_1);
                                                isUpdateDownloading = false;
                                                resolve({ success: false, error: 'INVALID_BINARY_TYPE' });
                                                return [2 /*return*/];
                                            }
                                        }
                                        catch (e) {
                                            console.error('❌ Failed to verify binary header:', e);
                                        }
                                        if (!(expectedHash && expectedHash.trim() !== "")) return [3 /*break*/, 4];
                                        console.log('🛡️ Verifying SHA-256 integrity...');
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 3, , 4]);
                                        hash_1 = crypto.createHash('sha256');
                                        input_2 = fs.createReadStream(dest_1);
                                        return [4 /*yield*/, new Promise(function (res, rej) {
                                                input_2.on('data', function (chunk) { return hash_1.update(chunk); });
                                                input_2.on('end', function () { return res(hash_1.digest('hex')); });
                                                input_2.on('error', function (err) { return rej(err); });
                                            })];
                                    case 2:
                                        calculatedHash = _a.sent();
                                        if (calculatedHash.toLowerCase() !== expectedHash.toLowerCase()) {
                                            console.error("\u274C Security Violation: Hash Mismatch!\nExpected: ".concat(expectedHash, "\nActual: ").concat(calculatedHash));
                                            fs.unlinkSync(dest_1);
                                            isUpdateDownloading = false;
                                            resolve({ success: false, error: 'SECURITY_HASH_MISMATCH' });
                                            return [2 /*return*/];
                                        }
                                        console.log('✅ Integrity Verified successfully.');
                                        return [3 /*break*/, 4];
                                    case 3:
                                        hashErr_1 = _a.sent();
                                        console.error('❌ Hash calculation failed:', hashErr_1);
                                        fs.unlinkSync(dest_1);
                                        isUpdateDownloading = false;
                                        resolve({ success: false, error: 'Integrity check failed' });
                                        return [2 /*return*/];
                                    case 4:
                                        electron_1.BrowserWindow.getAllWindows().forEach(function (win) {
                                            win.webContents.send('update-download-complete');
                                        });
                                        isUpdateDownloading = false;
                                        console.log("\u2705 Update download finished. Total Bytes: ".concat(fs.statSync(dest_1).size));
                                        resolve({ success: true, path: dest_1 });
                                        if (closeRequested)
                                            electron_1.app.quit();
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        response.on('error', function (err) {
                            file_1.end();
                            fs.unlink(dest_1, function () { });
                            console.error('❌ Update download stream failed:', err);
                            isUpdateDownloading = false;
                            resolve({ success: false, error: err.message });
                            if (closeRequested)
                                electron_1.app.quit();
                        });
                    });
                    request.on('error', function (err) {
                        file_1.end();
                        fs.unlink(dest_1, function () { });
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
            })];
    });
}); });
electron_1.ipcMain.handle('mark-patch-complete', function () { return __awaiter(void 0, void 0, void 0, function () {
    var markerPath;
    return __generator(this, function (_a) {
        try {
            markerPath = path.join(electron_1.app.getPath('userData'), 'signature_patch_applied.marker');
            if (!fs.existsSync(markerPath)) {
                fs.writeFileSync(markerPath, 'Applied on: ' + new Date().toISOString());
                console.log('✅ Signature patch cache wipe marked as complete (from Cloud Sync).');
            }
            return [2 /*return*/, { success: true }];
        }
        catch (e) {
            console.error('Failed to create marker file:', e);
            return [2 /*return*/, { success: false }];
        }
        return [2 /*return*/];
    });
}); });
electron_1.ipcMain.handle('clear-patch-marker', function () { return __awaiter(void 0, void 0, void 0, function () {
    var markerPath;
    return __generator(this, function (_a) {
        try {
            markerPath = path.join(electron_1.app.getPath('userData'), 'signature_patch_applied.marker');
            if (fs.existsSync(markerPath)) {
                fs.unlinkSync(markerPath);
                console.log('🗑️ Signature patch marker cleared. Next patch update will perform a cache wipe.');
            }
            return [2 /*return*/, { success: true }];
        }
        catch (e) {
            console.error('Failed to clear marker file:', e);
            return [2 /*return*/, { success: false }];
        }
        return [2 /*return*/];
    });
}); });
electron_1.ipcMain.handle('backup-and-install', function (_, options) {
    var _a;
    var isSilent = (_a = options === null || options === void 0 ? void 0 : options.silent) !== null && _a !== void 0 ? _a : false;
    var installerPath = getInstallerPath();
    if (!fs.existsSync(installerPath)) {
        console.error('❌ Installer file missing on disk:', installerPath);
        return { success: false, error: "Update installer not found at \"".concat(installerPath, "\". Please download update again.") };
    }
    // 1. INSTANT TERMINATION SIGNAL: Destroy windows immediately
    electron_1.BrowserWindow.getAllWindows().forEach(function (win) {
        try {
            win.destroy();
        }
        catch (e) { }
    });
    // 2. DETACHED WORKER: Using a Wait-and-Kill strategy to clear locks before installer check
    (function () { return __awaiter(void 0, void 0, void 0, function () {
        var paths, rootDbPath, rootDb, markerPath, sysLimitPath, localStoragePath, paths, snapshotDir, dbFile, exeName, tempDir, appExePath, silentHtaPath, silentHtaContent, launchHtaPath, launchHtaContent, command;
        return __generator(this, function (_a) {
            try {
                console.log('--- DEFENSIVE RELAUNCHER START ---');
                // A. Flush and Close Database
                if ((options === null || options === void 0 ? void 0 : options.newPatchTimestamp) && appBasePath) {
                    try {
                        paths = getAppPaths(appBasePath);
                        rootDbPath = path.join(paths.root, 'active_db.sqlite');
                        rootDb = new better_sqlite3_1.default(rootDbPath);
                        rootDb.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
                        rootDb.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)').run('app_active_patch_ts', JSON.stringify(options.newPatchTimestamp));
                        rootDb.close();
                        console.log('✅ Safely persisted active patch timestamp to ROOT DB:', options.newPatchTimestamp);
                    }
                    catch (e) {
                        console.error('❌ Failed to persist patch timestamp to ROOT DB', e);
                    }
                }
                if (db) {
                    try {
                        db.pragma('wal_checkpoint(TRUNCATE)');
                        db.close();
                    }
                    catch (e) { }
                    db = null;
                }
                // A.5 Clean User Data Caches (sys_limit & Local Storage) for clean update
                try {
                    markerPath = path.join(electron_1.app.getPath('userData'), 'signature_patch_applied.marker');
                    if (!fs.existsSync(markerPath)) {
                        sysLimitPath = path.join(electron_1.app.getPath('userData'), 'sys_limit.bin');
                        localStoragePath = path.join(electron_1.app.getPath('userData'), 'Local Storage');
                        if (fs.existsSync(sysLimitPath)) {
                            fs.unlinkSync(sysLimitPath);
                            console.log('🧹 Deleted sys_limit.bin for clean update');
                        }
                        if (fs.existsSync(localStoragePath)) {
                            fs.rmSync(localStoragePath, { recursive: true, force: true });
                            console.log('🧹 Deleted Local Storage for clean update');
                        }
                        console.log('🧹 Signature patch cache wipe executed. Awaiting cloud sync for permanent marker.');
                    }
                    else {
                        console.log('⏩ Skipping cache wipe: Signature patch marker already exists.');
                    }
                }
                catch (cleanErr) {
                    console.warn('⚠️ Failed to clean user data for update:', cleanErr);
                }
                // B. Snapshot/Backup
                try {
                    if (appBasePath) {
                        paths = getAppPaths(appBasePath);
                        snapshotDir = path.join(paths.backups, "v".concat(electron_1.app.getVersion(), "_SAFETY_BACKUP"));
                        if (!fs.existsSync(snapshotDir))
                            fs.mkdirSync(snapshotDir, { recursive: true });
                        dbFile = path.join(paths.data, 'active_db.sqlite');
                        if (fs.existsSync(dbFile)) {
                            fs.copyFileSync(dbFile, path.join(snapshotDir, 'active_db_snapshot.sqlite'));
                        }
                    }
                }
                catch (backupErr) {
                    console.warn('⚠️ Safety backup skipped:', backupErr);
                }
                // C. POWER LAUNCH: Wait 2s -> Kill BPP_APP -> Launch Installer
                try {
                    exeName = electron_1.app.isPackaged ? 'BPP_APP.exe' : 'electron.exe';
                    tempDir = electron_1.app.getPath('temp');
                    appExePath = process.execPath;
                    silentHtaPath = path.join(tempDir, 'bpp_update_msg.hta');
                    silentHtaContent = "\n<HTA:APPLICATION ID=\"oHTA\" BORDER=\"dialog\" CAPTION=\"yes\" CONTEXTMENU=\"no\" INNERBORDER=\"no\" SCROLL=\"no\" SHOWINTASKBAR=\"no\" SINGLEINSTANCE=\"yes\" SYSMENU=\"no\" WINDOWSTATE=\"normal\" ALWAYSONTOP=\"yes\"/>\n<html><head><meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\"/>\n<title>BharatPay Pro Update</title>\n<style>\n  body { background-color: #020617; color: #f8fafc; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%; border: 1px solid #1e293b; box-sizing: border-box; overflow: hidden; }\n  .title { margin-bottom: 12px; font-weight: 700; font-size: 18px; color: #38bdf8; letter-spacing: 0.5px; }\n  .desc { margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5; }\n  .wait-label { color: #38bdf8; font-weight: 600; }\n  .dots { color: #38bdf8; font-weight: 700; font-size: 16px; width: 24px; display: inline-block; text-align: left; }\n</style></head>\n<body>\n  <div class=\"title\">Applying Background Patch Update</div>\n  <div class=\"desc\">\n    <span>Installing latest software components... <span class=\"wait-label\">Please wait</span><span id=\"dots\" class=\"dots\">.</span></span>\n  </div>\n  <script>\n    window.resizeTo(560, 210); window.moveTo((screen.width - 560) / 2, (screen.height - 210) / 2); window.focus();\n    var step = 1; var waitEl = document.getElementById(\"dots\");\n    setInterval(function() {\n      step = (step % 4) + 1; var d = \"\"; for (var i = 0; i < step; i++) { d += \".\"; }\n      if (waitEl) { waitEl.innerHTML = d; }\n      try { window.focus(); } catch(e) {}\n    }, 100);\n    setTimeout(function() { window.close(); }, 60000);\n  </script>\n</body></html>\n                ";
                    fs.writeFileSync(silentHtaPath, silentHtaContent.trim(), 'utf8');
                    launchHtaPath = path.join(tempDir, 'bpp_launch_msg.hta');
                    launchHtaContent = "\n<HTA:APPLICATION ID=\"oHTA\" BORDER=\"dialog\" CAPTION=\"yes\" CONTEXTMENU=\"no\" INNERBORDER=\"no\" SCROLL=\"no\" SHOWINTASKBAR=\"no\" SINGLEINSTANCE=\"yes\" SYSMENU=\"no\" WINDOWSTATE=\"normal\" ALWAYSONTOP=\"yes\"/>\n<html><head><meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\"/>\n<title>BharatPay Pro Update</title>\n<style>\n  body { background-color: #020617; color: #f8fafc; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%; border: 1px solid #1e293b; box-sizing: border-box; overflow: hidden; }\n  .title { margin-bottom: 12px; font-weight: 700; font-size: 18px; color: #10b981; letter-spacing: 0.5px; }\n  .desc { margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5; }\n  .wait-label { color: #38bdf8; font-weight: 600; }\n  .dots { color: #38bdf8; font-weight: 700; font-size: 16px; width: 24px; display: inline-block; text-align: left; }\n</style></head>\n<body>\n  <div class=\"title\">Application Update Complete</div>\n  <div class=\"desc\">\n    <span>Launching BharatPay Pro... <span class=\"wait-label\">Please wait</span><span id=\"dots\" class=\"dots\">.</span></span>\n  </div>\n  <script>\n    window.resizeTo(560, 210); window.moveTo((screen.width - 560) / 2, (screen.height - 210) / 2); window.focus();\n    var step = 1; var waitEl = document.getElementById(\"dots\");\n    setInterval(function() {\n      step = (step % 4) + 1; var d = \"\"; for (var i = 0; i < step; i++) { d += \".\"; }\n      if (waitEl) { waitEl.innerHTML = d; }\n      try { window.focus(); } catch(e) {}\n    }, 100);\n    setTimeout(function() { window.close(); }, 60000);\n  </script>\n</body></html>\n                ";
                    fs.writeFileSync(launchHtaPath, launchHtaContent.trim(), 'utf8');
                    command = '';
                    if (isSilent) {
                        command = "start mshta \"".concat(silentHtaPath, "\" & timeout /t 2 /nobreak && taskkill /F /IM ").concat(exeName, " /T & timeout /t 1 /nobreak & start /wait \"\" \"").concat(installerPath, "\" /S & start \"\" \"").concat(appExePath, "\"");
                    }
                    else {
                        // Interactive Mode: Run installer directly
                        command = "timeout /t 2 /nobreak && taskkill /F /IM ".concat(exeName, " /T & timeout /t 1 /nobreak & start \"\" \"").concat(installerPath, "\"");
                    }
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
            return [2 /*return*/];
        });
    }); })();
    return { success: true };
});
function cleanupOldInstallers() {
    try {
        var dest = getInstallerPath();
        if (fs.existsSync(dest)) {
            // Check if it's been there for more than a few minutes (avoid deleting during active download)
            var stats = fs.statSync(dest);
            var ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
            if (ageMinutes > 5) {
                fs.unlinkSync(dest);
                console.log('🧹 Cleaned up old installer file.');
            }
        }
        // Also check if there are any orphaned EXEs in the app root
        if (appBasePath) {
            var rootFiles = fs.readdirSync(appBasePath);
            rootFiles.forEach(function (file) {
                if (file.toLowerCase().endsWith('.exe') && file.toLowerCase().includes('bpp_app')) {
                    // This might be an old version left behind. 
                    // We don't delete immediately to be safe, but we log it.
                    console.log("\u2139\uFE0F Found potential legacy EXE in root: ".concat(file));
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
