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
let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development';
// ── DATABASE & STORAGE PATHS ──
const APP_DATA_DIR = path.join('D:', 'ILCBala', 'PMS', 'BPP');
const DATA_DIR = path.join(APP_DATA_DIR, 'Data');
const REPORT_DIR = path.join(APP_DATA_DIR, 'Report');
const BACKUP_DIR = path.join(APP_DATA_DIR, 'Backup');
// Ensure directories exist
[DATA_DIR, REPORT_DIR, BACKUP_DIR].forEach(dir => {
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
});
const DB_PATH = path.join(DATA_DIR, 'active_db.sqlite');
const db = new better_sqlite3_1.default(DB_PATH);
db.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
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
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
// ── IPC HANDLERS ──
// 1. Report Saving
electron_1.ipcMain.handle('save-report', async (_, { fileName, data, type }) => {
    try {
        const filePath = path.join(REPORT_DIR, `${fileName}.${type}`);
        fs.writeFileSync(filePath, Buffer.from(data));
        return { success: true, path: filePath };
    }
    catch (e) {
        console.error('Save report failed', e);
        return { success: false, error: e.message };
    }
});
// 2. Simple Key-Value Store (for background persistence only, not boot sync)
electron_1.ipcMain.handle('db-set', async (_, { key, value }) => {
    try {
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
        const row = db.prepare('SELECT value FROM store WHERE key = ?').get(key);
        return { success: true, data: row ? JSON.parse(row.value) : null };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
});
// 3. Encrypted Manual Backup
electron_1.ipcMain.handle('run-backup', async (_, encryptedData) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
        const fileName = `backup_${timestamp[0]}_${timestamp[1].slice(0, 8)}.enc`;
        const filePath = path.join(BACKUP_DIR, fileName);
        fs.writeFileSync(filePath, encryptedData);
        return { success: true, fileName };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
});
// 4. App Closing
electron_1.ipcMain.handle('close-app', async () => {
    console.log("!!! IPC RECEIVED: close-app !!!");
    console.log("Application exiting now...");
    electron_1.app.exit(0);
});
// 5. Machine ID Retrieval (Native Windows)
electron_1.ipcMain.handle('get-machine-id', async () => {
    try {
        const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
        const output = execSync('wmic csproduct get uuid').toString();
        // The output is usually something like "UUID\r\n[some-id]\r\n"
        const lines = output.split(/\r?\n/).filter(line => line.trim() && !line.includes('UUID'));
        return lines[0].trim();
    }
    catch (e) {
        console.error('Failed to get machine ID:', e);
        return 'UNKNOWN-MACHINE-ID';
    }
});
console.log("-----------------------------------------");
console.log("ELECTRON MAIN PROCESS: HANDLERS READY");
console.log("-----------------------------------------");
