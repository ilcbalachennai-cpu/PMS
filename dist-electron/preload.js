"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    saveReport: (fileName, data, type) => electron_1.ipcRenderer.invoke('save-report', { fileName, data, type }),
    saveTemplate: (fileName, data, type) => electron_1.ipcRenderer.invoke('save-template', { fileName, data, type }),
    dbSet: (key, value) => electron_1.ipcRenderer.invoke('db-set', { key, value }),
    dbGet: (key) => electron_1.ipcRenderer.invoke('db-get', key),
    sendEmail: (smtpConfig, mailOptions) => electron_1.ipcRenderer.invoke('send-email', { smtpConfig, mailOptions }),
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
    openItemPath: (filePath) => electron_1.ipcRenderer.invoke('open-item-path', filePath),
    getOSVersion: () => electron_1.ipcRenderer.invoke('get-os-version'),
    onUpdateDownloadComplete: (callback) => {
        electron_1.ipcRenderer.on('update-download-complete', callback);
    },
    getIsElectron: () => true,
    getIsDev: () => process.env.NODE_ENV === 'development'
});
console.log("EB: Electron Bridge (electronAPI) Initialized");
