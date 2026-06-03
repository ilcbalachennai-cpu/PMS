const fs = require('fs');
let c = fs.readFileSync('electron/main.ts', 'utf8');

// The newly built backup-and-install handler contains the DB and Snapshot logic. 
// We will extract it out.

const oldBackupInstall = `ipcMain.handle('backup-and-install', (_, options?: { silent?: boolean, username?: string, userEmail?: string }) => {
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

            // C. POWER LAUNCH WITH AUDIT WRAPPER`;

const newBackupInstall = `ipcMain.handle('prepare-for-install', async () => {
    try {
        console.log('--- PREPARE FOR INSTALL START ---');
        // A. Flush and Close Database
        if (db) {
            try { 
                db.pragma('wal_checkpoint(TRUNCATE)'); 
                db.close(); 
                console.log('📦 Database flushed and closed successfully.');
            } catch(e) {
                console.error('Failed to flush database', e);
            }
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
                console.log('📦 Pre-update snapshots created successfully.');
            } catch(e) {
                console.warn("Quick snapshot failed, ignoring...", e);
            }
        }
        
        // Wait an extra second to ensure handles are completely freed by the OS
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('backup-and-install', (_, options?: { silent?: boolean, username?: string, userEmail?: string }) => {
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
            
            // C. POWER LAUNCH WITH AUDIT WRAPPER`;

c = c.replace(oldBackupInstall, newBackupInstall);

fs.writeFileSync('electron/main.ts', c);
console.log("main.ts updated for prepare-for-install");
