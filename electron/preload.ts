import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    saveReport: (fileName: string, data: Uint8Array, type: string) =>
        ipcRenderer.invoke('save-report', { fileName, data, type }),
    dbSet: (key: string, value: any) =>
        ipcRenderer.invoke('db-set', { key, value }),
    dbGet: (key: string) =>
        ipcRenderer.invoke('db-get', key),
    runBackup: (data: any) =>
        ipcRenderer.invoke('run-backup', data),
    closeApp: () => {
        console.log("Preload: Calling close-app invoke");
        return ipcRenderer.invoke('close-app');
    },
    getIsElectron: () => true
});

console.log("EB: Electron Bridge (electronAPI) Initialized");
