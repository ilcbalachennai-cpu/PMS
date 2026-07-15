/// <reference types="vite/client" />
/// <reference types="react" />
/// <reference types="react-dom" />

declare global {
    interface Window {
        electronAPI: {
            dbGet: (key: string) => Promise<{ success: boolean; data: any }>;
            dbSet: (key: string, value: any) => Promise<void>;
            dbDelete: (key: string) => Promise<void>;
            restoreSqliteBackup: (path: string) => Promise<{ success: boolean; error?: string }>;
            runBackup: (data: string) => Promise<{ success: boolean; fileName?: string; error?: string }>;
            wipeCompanyData: (companyId: string) => Promise<{ success: boolean; changes?: number; error?: string }>;
            switchCompanyData: (companyId: string) => Promise<{ success: boolean; error?: string }>;
            deleteSilo: (companyId: string) => Promise<{ success: boolean; error?: string }>;
            generateDiagnostics: (uiState: any) => Promise<{ success: boolean; filePath?: string; error?: string }>;
            closeUpdateMessage: () => Promise<{ success: boolean; error?: string }>;
            listSilos: () => Promise<{ success: boolean; silos?: string[]; error?: string }>;
            getActivatedSilos: () => Promise<{ success: boolean; silos: string[] }>;
            registerActivatedSilo: (signature: string) => Promise<{ success: boolean; silos: string[] }>;
            removeActivatedSilo: (signature: string) => Promise<{ success: boolean; silos: string[] }>;
            wipeActivatedSilos: () => Promise<{ success: boolean; silos: string[] }>;
            dbSetGlobal: (key: string, value: any) => Promise<void>;
            dbGetGlobal: (key: string) => Promise<any>;
        };
    }
}

export { };
