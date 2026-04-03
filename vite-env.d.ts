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
        };
    }
}

export { };
