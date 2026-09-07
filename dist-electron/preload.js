"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
var electronModule = require('electron');
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    saveReport: function (fileName, data, type, subfolder) {
        return electron_1.ipcRenderer.invoke('save-report', { fileName: fileName, data: data, type: type, subfolder: subfolder });
    },
    saveTemplate: function (fileName, data, type, subfolder) {
        return electron_1.ipcRenderer.invoke('save-template', { fileName: fileName, data: data, type: type, subfolder: subfolder });
    },
    dbSet: function (key, value) {
        return electron_1.ipcRenderer.invoke('db-set', { key: key, value: value });
    },
    dbGet: function (key) {
        return electron_1.ipcRenderer.invoke('db-get', key);
    },
    dbGetAll: function () {
        return electron_1.ipcRenderer.invoke('db-get-all');
    },
    sendEmail: function (smtpConfig, mailOptions) {
        return electron_1.ipcRenderer.invoke('send-email', { smtpConfig: smtpConfig, mailOptions: mailOptions });
    },
    dbDelete: function (key) {
        return electron_1.ipcRenderer.invoke('db-delete', key);
    },
    runBackup: function (data, fileName, subfolder) {
        if (typeof data === 'object' && data.data) {
            return electron_1.ipcRenderer.invoke('run-backup', data);
        }
        return electron_1.ipcRenderer.invoke('run-backup', fileName ? { data: data, fileName: fileName, subfolder: subfolder } : data);
    },
    createDataBackup: function (arg) { return electron_1.ipcRenderer.invoke('create-data-backup', arg); },
    runFullBackup: function (arg) { return electron_1.ipcRenderer.invoke('run-full-backup', arg); },
    restoreSqliteBackup: function (arg) { return electron_1.ipcRenderer.invoke('restore-sqlite-backup', arg); },
    getBackupPeriods: function (arg) { return electron_1.ipcRenderer.invoke('get-backup-periods', arg); },
    restoreFromSnapshot: function (snapshotFileName) { return electron_1.ipcRenderer.invoke('restore-from-snapshot', snapshotFileName); },
    listSafetySnapshots: function () { return electron_1.ipcRenderer.invoke('list-safety-snapshots'); },
    selectBackupFile: function () { return electron_1.ipcRenderer.invoke('select-backup-file'); },
    getPathForFile: function (file) {
        try {
            var webUtils = electronModule.webUtils;
            if (webUtils && typeof webUtils.getPathForFile === 'function') {
                return webUtils.getPathForFile(file);
            }
        }
        catch (_) { }
        return file.path || file.filePath || '';
    },
    closeApp: function () { return electron_1.ipcRenderer.invoke('close-app'); },
    hardResetApp: function () { return electron_1.ipcRenderer.invoke('hard-reset-app'); },
    closeUpdateMessage: function () { return electron_1.ipcRenderer.invoke('close-update-message'); },
    logAuditEvent: function (args) { return electron_1.ipcRenderer.invoke('log-audit-event', args); },
    getMachineId: function () { return electron_1.ipcRenderer.invoke('get-machine-id'); },
    selectAppDirectory: function () { return electron_1.ipcRenderer.invoke('select-app-directory'); },
    initializeAppDirectory: function (path) { return electron_1.ipcRenderer.invoke('initialize-app-directory', path); },
    getAppDirectory: function () { return electron_1.ipcRenderer.invoke('get-app-directory'); },
    apiFetch: function (url, options) { return electron_1.ipcRenderer.invoke('api-fetch', url, options); },
    startUpdateDownload: function (url, expectedHash) { return electron_1.ipcRenderer.invoke('start-update-download', url, expectedHash); },
    prepareForInstall: function () { return electron_1.ipcRenderer.invoke('prepare-for-install'); },
    backupAndInstall: function (options) { return electron_1.ipcRenderer.invoke('backup-and-install', options); },
    markPatchComplete: function () { return electron_1.ipcRenderer.invoke('mark-patch-complete'); },
    clearPatchMarker: function () { return electron_1.ipcRenderer.invoke('clear-patch-marker'); },
    findBPPApp: function () { return electron_1.ipcRenderer.invoke('find-bpp-app'); },
    openItemLocation: function (filePath) {
        return electron_1.ipcRenderer.invoke('open-item-location', filePath);
    },
    openItemPath: function (filePath) {
        return electron_1.ipcRenderer.invoke('open-item-path', filePath);
    },
    openUserManual: function () { return electron_1.ipcRenderer.invoke('open-user-manual'); },
    handleStatutoryForm: function (formName, action) {
        return electron_1.ipcRenderer.invoke('handle-statutory-form', { formName: formName, action: action });
    },
    getOSVersion: function () { return electron_1.ipcRenderer.invoke('get-os-version'); },
    signalInitComplete: function () { return electron_1.ipcRenderer.invoke('app-initialization-complete'); },
    setFullScreen: function (flag) { return electron_1.ipcRenderer.invoke('set-fullscreen', flag); },
    getIsFullScreen: function () { return electron_1.ipcRenderer.invoke('get-fullscreen'); },
    onUpdateDownloadComplete: function (callback) {
        electron_1.ipcRenderer.on('update-download-complete', callback);
    },
    onUpdateDownloadProgress: function (callback) {
        electron_1.ipcRenderer.on('update-download-progress', function (_, progress) { return callback(progress); });
    },
    onUpdateCloseWarning: function (callback) {
        electron_1.ipcRenderer.removeAllListeners('update-close-warning');
        electron_1.ipcRenderer.on('update-close-warning', function () { return callback(); });
    },
    relaunchApp: function () { return electron_1.ipcRenderer.invoke('relaunch-app'); },
    openExternal: function (url) { return electron_1.ipcRenderer.invoke('open-external', url); },
    getIsElectron: function () { return true; },
    getIsDev: function () { return process.env.NODE_ENV === 'development'; },
    switchCompanyData: function (companyId) { return electron_1.ipcRenderer.invoke('switch-company-data', companyId); },
    dbSetGlobal: function (key, value) { return electron_1.ipcRenderer.invoke('db-set-global', { key: key, value: value }); },
    dbGetGlobal: function (key) { return electron_1.ipcRenderer.invoke('db-get-global', key); },
    wipeAllData: function () { return electron_1.ipcRenderer.invoke('wipe-all-data'); },
    getActivatedSilos: function (isDevMode) { return electron_1.ipcRenderer.invoke('get-activated-silos', isDevMode); },
    registerActivatedSilo: function (signature, isDevMode) { return electron_1.ipcRenderer.invoke('register-activated-silo', signature, isDevMode); },
    removeActivatedSilo: function (signature, isDevMode) { return electron_1.ipcRenderer.invoke('remove-activated-silo', signature, isDevMode); },
    syncActivatedSilos: function (validCloudSigs) { return electron_1.ipcRenderer.invoke('sync-activated-silos', validCloudSigs); },
    wipeActivatedSilos: function () { return electron_1.ipcRenderer.invoke('wipe-activated-silos'); },
    wipeAllLocalSignatures: function (isDevMode) { return electron_1.ipcRenderer.invoke('wipe-all-local-signatures', isDevMode); },
    purgeUnmatchedLocalSignatures: function (validCloudSignatures, isDevMode) { return electron_1.ipcRenderer.invoke('purge-unmatched-local-signatures', validCloudSignatures, isDevMode); },
    listSilos: function () { return electron_1.ipcRenderer.invoke('list-silos'); },
    deleteSilo: function (companyId) { return electron_1.ipcRenderer.invoke('delete-silo', companyId); },
    wipeCompanyData: function (companyId) { return electron_1.ipcRenderer.invoke('wipe-company-data', companyId); },
    generateDiagnostics: function (uiState) { return electron_1.ipcRenderer.invoke('generate-diagnostics', uiState); }
});
console.log("EB: Electron Bridge (electronAPI) Initialized");
