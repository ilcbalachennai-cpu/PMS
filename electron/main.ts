import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development';

// ── DATABASE & STORAGE PATHS ──
const APP_DATA_DIR = path.join('D:', 'ILCBala', 'PMS', 'BPP');
const DATA_DIR = path.join(APP_DATA_DIR, 'Data');
const REPORT_DIR = path.join(APP_DATA_DIR, 'Report');
const BACKUP_DIR = path.join(APP_DATA_DIR, 'Backup');

// Ensure directories exist
[DATA_DIR, REPORT_DIR, BACKUP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const DB_PATH = path.join(DATA_DIR, 'active_db.sqlite');
const db = new Database(DB_PATH);
db.exec('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)');

function createWindow() {
    mainWindow = new BrowserWindow({
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
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ── IPC HANDLERS ──

// 1. Report Saving
ipcMain.handle('save-report', async (_, { fileName, data, type }) => {
    try {
        const filePath = path.join(REPORT_DIR, `${fileName}.${type}`);
        fs.writeFileSync(filePath, Buffer.from(data));
        return { success: true, path: filePath };
    } catch (e: any) {
        console.error('Save report failed', e);
        return { success: false, error: e.message };
    }
});

// 2. Simple Key-Value Store (for background persistence only, not boot sync)
ipcMain.handle('db-set', async (_, { key, value }) => {
    try {
        const stmt = db.prepare('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)');
        stmt.run(key, JSON.stringify(value));
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('db-get', async (_, key) => {
    try {
        const row = db.prepare('SELECT value FROM store WHERE key = ?').get(key) as { value: string };
        return { success: true, data: row ? JSON.parse(row.value) : null };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

// 3. Encrypted Manual Backup
ipcMain.handle('run-backup', async (_, encryptedData) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
        const fileName = `backup_${timestamp[0]}_${timestamp[1].slice(0, 8)}.enc`;
        const filePath = path.join(BACKUP_DIR, fileName);
        fs.writeFileSync(filePath, encryptedData);
        return { success: true, fileName };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});
// 4. App Closing
ipcMain.handle('close-app', async () => {
    console.log("!!! IPC RECEIVED: close-app !!!");
    console.log("Application exiting now...");
    app.exit(0);
});

// 5. Machine ID Retrieval (Native Windows)
ipcMain.handle('get-machine-id', async () => {
    try {
        const { execSync } = await import('child_process');
        const output = execSync('wmic csproduct get uuid').toString();
        // The output is usually something like "UUID\r\n[some-id]\r\n"
        const lines = output.split(/\r?\n/).filter(line => line.trim() && !line.includes('UUID'));
        return lines[0].trim();
    } catch (e) {
        console.error('Failed to get machine ID:', e);
        return 'UNKNOWN-MACHINE-ID';
    }
});

console.log("-----------------------------------------");
console.log("ELECTRON MAIN PROCESS: HANDLERS READY");
console.log("-----------------------------------------");
