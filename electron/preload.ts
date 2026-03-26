import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    saveReport: (fileName: string, data: Uint8Array, type: string) =>
        ipcRenderer.invoke('save-report', { fileName, data, type }),
    dbSet: (key: string, value: any) =>
        ipcRenderer.invoke('db-set', { key, value }),
    dbGet: (key: string) =>
        ipcRenderer.invoke('db-get', key),
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
    startUpdateDownload: (url: string) => ipcRenderer.invoke('start-update-download', url),
    backupAndInstall: () => ipcRenderer.invoke('backup-and-install'),
    findBPPApp: () => ipcRenderer.invoke('find-bpp-app'),
    openItemLocation: (filePath: string) =>
        ipcRenderer.invoke('open-item-location', filePath),
    getOSVersion: () => ipcRenderer.invoke('get-os-version'),
    sendPayslipEmail: (data: any) => ipcRenderer.invoke('send-payslip-email', data),
    onUpdateDownloadComplete: (callback: () => void) => {
        ipcRenderer.on('update-download-complete', callback);
    },
    getIsElectron: () => true
});

console.log("EB: Electron Bridge (electronAPI) Initialized");
