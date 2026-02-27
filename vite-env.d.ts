/// <reference types="vite/client" />
/// <reference types="react" />
/// <reference types="react-dom" />

declare global {
    interface Window {
        electronAPI: {
            dbGet: (key: string) => Promise<any>;
            dbSet: (key: string, value: any) => Promise<void>;
            dbDelete: (key: string) => Promise<void>;
        };
    }
}

export { };
