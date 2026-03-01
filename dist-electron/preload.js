"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    saveReport: (fileName, data, type) => electron_1.ipcRenderer.invoke('save-report', { fileName, data, type }),
    dbSet: (key, value) => electron_1.ipcRenderer.invoke('db-set', { key, value }),
    dbGet: (key) => electron_1.ipcRenderer.invoke('db-get', key),
    runBackup: (data) => electron_1.ipcRenderer.invoke('run-backup', data),
    closeApp: () => {
        console.log("Preload: Calling close-app invoke");
        return electron_1.ipcRenderer.invoke('close-app');
    },
    getMachineId: () => electron_1.ipcRenderer.invoke('get-machine-id'),
    getIsElectron: () => true
});
console.log("EB: Electron Bridge (electronAPI) Initialized");
