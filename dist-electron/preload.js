"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    saveReport: (fileName, data, type, subfolder) => electron_1.ipcRenderer.invoke('save-report', { fileName, data, type, subfolder }),
    saveTemplate: (fileName, data, type, subfolder) => electron_1.ipcRenderer.invoke('save-template', { fileName, data, type, subfolder }),
    dbSet: (key, value) => electron_1.ipcRenderer.invoke('db-set', { key, value }),
    dbGet: (key) => electron_1.ipcRenderer.invoke('db-get', key),
    dbGetAll: () => electron_1.ipcRenderer.invoke('db-get-all'),
    sendEmail: (smtpConfig, mailOptions) => electron_1.ipcRenderer.invoke('send-email', { smtpConfig, mailOptions }),
    dbDelete: (key) => electron_1.ipcRenderer.invoke('db-delete', key),
    runBackup: (data, fileName, subfolder) => {
        if (typeof data === 'object' && data.data) {
            return electron_1.ipcRenderer.invoke('run-backup', data);
        }
        return electron_1.ipcRenderer.invoke('run-backup', fileName ? { data, fileName, subfolder } : data);
    },
    createDataBackup: (arg) => electron_1.ipcRenderer.invoke('create-data-backup', arg),
    restoreSqliteBackup: (arg) => electron_1.ipcRenderer.invoke('restore-sqlite-backup', arg),
    closeApp: () => electron_1.ipcRenderer.invoke('close-app'),
    logAuditEvent: (args) => electron_1.ipcRenderer.invoke('log-audit-event', args),
    getMachineId: () => electron_1.ipcRenderer.invoke('get-machine-id'),
    selectAppDirectory: () => electron_1.ipcRenderer.invoke('select-app-directory'),
    initializeAppDirectory: (path) => electron_1.ipcRenderer.invoke('initialize-app-directory', path),
    getAppDirectory: () => electron_1.ipcRenderer.invoke('get-app-directory'),
    apiFetch: (url, options) => electron_1.ipcRenderer.invoke('api-fetch', url, options),
    startUpdateDownload: (url, expectedHash) => electron_1.ipcRenderer.invoke('start-update-download', url, expectedHash),
    prepareForInstall: () => electron_1.ipcRenderer.invoke('prepare-for-install'),
    backupAndInstall: (options) => electron_1.ipcRenderer.invoke('backup-and-install', options),
    findBPPApp: () => electron_1.ipcRenderer.invoke('find-bpp-app'),
    openItemLocation: (filePath) => electron_1.ipcRenderer.invoke('open-item-location', filePath),
    openItemPath: (filePath) => electron_1.ipcRenderer.invoke('open-item-path', filePath),
    openUserManual: () => electron_1.ipcRenderer.invoke('open-user-manual'),
    handleStatutoryForm: (formName, action) => electron_1.ipcRenderer.invoke('handle-statutory-form', { formName, action }),
    getOSVersion: () => electron_1.ipcRenderer.invoke('get-os-version'),
    setFullScreen: (flag) => electron_1.ipcRenderer.invoke('set-fullscreen', flag),
    getIsFullScreen: () => electron_1.ipcRenderer.invoke('get-fullscreen'),
    onUpdateDownloadComplete: (callback) => {
        electron_1.ipcRenderer.on('update-download-complete', callback);
    },
    onUpdateDownloadProgress: (callback) => {
        electron_1.ipcRenderer.on('update-download-progress', (_, progress) => callback(progress));
    },
    relaunchApp: () => electron_1.ipcRenderer.invoke('relaunch-app'),
    openExternal: (url) => electron_1.ipcRenderer.invoke('open-external', url),
    getIsElectron: () => true,
    getIsDev: () => process.env.NODE_ENV === 'development',
    switchCompanyData: (companyId) => electron_1.ipcRenderer.invoke('switch-company-data', companyId),
    dbSetGlobal: (key, value) => electron_1.ipcRenderer.invoke('db-set-global', { key, value }),
    dbGetGlobal: (key) => electron_1.ipcRenderer.invoke('db-get-global', key),
    wipeAllData: () => electron_1.ipcRenderer.invoke('wipe-all-data'),
    listSilos: () => electron_1.ipcRenderer.invoke('list-silos'),
    deleteSilo: (companyId) => electron_1.ipcRenderer.invoke('delete-silo', companyId),
    wipeCompanyData: (companyId) => electron_1.ipcRenderer.invoke('wipe-company-data', companyId)
});
console.log("EB: Electron Bridge (electronAPI) Initialized");
