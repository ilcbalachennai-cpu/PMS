import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    saveReport: (fileName: string, data: Uint8Array, type: string) =>
        ipcRenderer.invoke('save-report', { fileName, data, type }),
    saveTemplate: (fileName: string, data: Uint8Array, type: string) =>
        ipcRenderer.invoke('save-template', { fileName, data, type }),
    dbSet: (key: string, value: any) =>
        ipcRenderer.invoke('db-set', { key, value }),
    dbGet: (key: string) =>
        ipcRenderer.invoke('db-get', key),
    sendEmail: (smtpConfig: any, mailOptions: any) =>
        ipcRenderer.invoke('send-email', { smtpConfig, mailOptions }),
    dbDelete: (key: string) =>
        ipcRenderer.invoke('db-delete', key),
    runBackup: (data: any) => ipcRenderer.invoke('run-backup', data),
    createDataBackup: (fileName: string) => ipcRenderer.invoke('create-data-backup', fileName),
    restoreSqliteBackup: (filePath: string) => ipcRenderer.invoke('restore-sqlite-backup', filePath),
    closeApp: () => ipcRenderer.invoke('close-app'),
    getMachineId: () => ipcRenderer.invoke('get-machine-id'),
    selectAppDirectory: () => ipcRenderer.invoke('select-app-directory'),
    initializeAppDirectory: (path: string) => ipcRenderer.invoke('initialize-app-directory', path),
    getAppDirectory: () => ipcRenderer.invoke('get-app-directory'),
    apiFetch: (url: string, options: any) => ipcRenderer.invoke('api-fetch', url, options),
    startUpdateDownload: (url: string, expectedHash?: string) => ipcRenderer.invoke('start-update-download', url, expectedHash),
    backupAndInstall: () => ipcRenderer.invoke('backup-and-install'),
    findBPPApp: () => ipcRenderer.invoke('find-bpp-app'),
    openItemLocation: (filePath: string) =>
        ipcRenderer.invoke('open-item-location', filePath),
    openItemPath: (filePath: string) =>
        ipcRenderer.invoke('open-item-path', filePath),
    openUserManual: () => ipcRenderer.invoke('open-user-manual'),
    getOSVersion: () => ipcRenderer.invoke('get-os-version'),
    onUpdateDownloadComplete: (callback: () => void) => {
        ipcRenderer.on('update-download-complete', callback);
    },
    getIsElectron: () => true,
    getIsDev: () => process.env.NODE_ENV === 'development'
});

console.log("EB: Electron Bridge (electronAPI) Initialized");
