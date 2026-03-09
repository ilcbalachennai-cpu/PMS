"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    saveReport: (fileName, data, type) => electron_1.ipcRenderer.invoke('save-report', { fileName, data, type }),
    dbSet: (key, value) => electron_1.ipcRenderer.invoke('db-set', { key, value }),
    dbGet: (key) => electron_1.ipcRenderer.invoke('db-get', key),
    dbDelete: (key) => electron_1.ipcRenderer.invoke('db-delete', key),
    runBackup: (data) => electron_1.ipcRenderer.invoke('run-backup', data),
    createDataBackup: (fileName) => electron_1.ipcRenderer.invoke('create-data-backup', fileName),
    restoreSqliteBackup: (filePath) => electron_1.ipcRenderer.invoke('restore-sqlite-backup', filePath),
    closeApp: () => electron_1.ipcRenderer.invoke('close-app'),
    getMachineId: () => electron_1.ipcRenderer.invoke('get-machine-id'),
    selectAppDirectory: () => electron_1.ipcRenderer.invoke('select-app-directory'),
    initializeAppDirectory: (path) => electron_1.ipcRenderer.invoke('initialize-app-directory', path),
    getAppDirectory: () => electron_1.ipcRenderer.invoke('get-app-directory'),
    apiFetch: (url, options) => electron_1.ipcRenderer.invoke('api-fetch', url, options),
    startUpdateDownload: (url) => electron_1.ipcRenderer.invoke('start-update-download', url),
    backupAndInstall: () => electron_1.ipcRenderer.invoke('backup-and-install'),
    findBPPApp: () => electron_1.ipcRenderer.invoke('find-bpp-app'),
    openItemLocation: (filePath) => electron_1.ipcRenderer.invoke('open-item-location', filePath),
    getIsElectron: () => true
});
console.log("EB: Electron Bridge (electronAPI) Initialized");
