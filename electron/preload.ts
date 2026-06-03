import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    saveReport: (fileName: string, data: Uint8Array, type: string, subfolder?: string) =>
        ipcRenderer.invoke('save-report', { fileName, data, type, subfolder }),
    saveTemplate: (fileName: string, data: Uint8Array, type: string, subfolder?: string) =>
        ipcRenderer.invoke('save-template', { fileName, data, type, subfolder }),

    dbSet: (key: string, value: any) =>
        ipcRenderer.invoke('db-set', { key, value }),
    dbGet: (key: string) =>
        ipcRenderer.invoke('db-get', key),
    dbGetAll: () =>
        ipcRenderer.invoke('db-get-all'),
    sendEmail: (smtpConfig: any, mailOptions: any) =>
        ipcRenderer.invoke('send-email', { smtpConfig, mailOptions }),
    dbDelete: (key: string) =>
        ipcRenderer.invoke('db-delete', key),
    runBackup: (data: any, fileName?: string, subfolder?: string) => {
        if (typeof data === 'object' && data.data) {
            return ipcRenderer.invoke('run-backup', data);
        }
        return ipcRenderer.invoke('run-backup', fileName ? { data, fileName, subfolder } : data);
    },

    createDataBackup: (arg: any) => ipcRenderer.invoke('create-data-backup', arg),
    restoreSqliteBackup: (arg: any) => ipcRenderer.invoke('restore-sqlite-backup', arg),
    closeApp: () => ipcRenderer.invoke('close-app'),
    logAuditEvent: (args: { type: string, message: string, metadata?: any }) => ipcRenderer.invoke('log-audit-event', args),
    getMachineId: () => ipcRenderer.invoke('get-machine-id'),
    selectAppDirectory: () => ipcRenderer.invoke('select-app-directory'),
    initializeAppDirectory: (path: string) => ipcRenderer.invoke('initialize-app-directory', path),
    getAppDirectory: () => ipcRenderer.invoke('get-app-directory'),
    apiFetch: (url: string, options: any) => ipcRenderer.invoke('api-fetch', url, options),
    startUpdateDownload: (url: string, expectedHash?: string) => ipcRenderer.invoke('start-update-download', url, expectedHash),
    prepareForInstall: () => ipcRenderer.invoke('prepare-for-install'),
    backupAndInstall: (options?: { silent?: boolean, username?: string, userEmail?: string }) => ipcRenderer.invoke('backup-and-install', options),
    findBPPApp: () => ipcRenderer.invoke('find-bpp-app'),
    openItemLocation: (filePath: string) =>
        ipcRenderer.invoke('open-item-location', filePath),
    openItemPath: (filePath: string) =>
        ipcRenderer.invoke('open-item-path', filePath),
    openUserManual: () => ipcRenderer.invoke('open-user-manual'),
    handleStatutoryForm: (formName: string, action: 'preview' | 'download') =>
        ipcRenderer.invoke('handle-statutory-form', { formName, action }),
    getOSVersion: () => ipcRenderer.invoke('get-os-version'),
    setFullScreen: (flag: boolean) => ipcRenderer.invoke('set-fullscreen', flag),
    getIsFullScreen: () => ipcRenderer.invoke('get-fullscreen'),
    onUpdateDownloadComplete: (callback: () => void) => {
        ipcRenderer.on('update-download-complete', callback);
    },
    onUpdateDownloadProgress: (callback: (progress: number) => void) => {
        ipcRenderer.on('update-download-progress', (_, progress: number) => callback(progress));
    },
    relaunchApp: () => ipcRenderer.invoke('relaunch-app'),
    openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
    getIsElectron: () => true,
    getIsDev: () => process.env.NODE_ENV === 'development',
    switchCompanyData: (companyId: string) => ipcRenderer.invoke('switch-company-data', companyId),
    dbSetGlobal: (key: string, value: any) => ipcRenderer.invoke('db-set-global', { key, value }),
    dbGetGlobal: (key: string) => ipcRenderer.invoke('db-get-global', key),
    wipeAllData: () => ipcRenderer.invoke('wipe-all-data'),
    listSilos: () => ipcRenderer.invoke('list-silos'),
    deleteSilo: (companyId: string) => ipcRenderer.invoke('delete-silo', companyId),
    wipeCompanyData: (companyId: string) => ipcRenderer.invoke('wipe-company-data', companyId)
});

console.log("EB: Electron Bridge (electronAPI) Initialized");
