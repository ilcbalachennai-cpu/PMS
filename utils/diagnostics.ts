

export const executeDiagnosticExport = async () => {
    try {
        const state = {
            app_companies: localStorage.getItem('app_companies'),
            app_setup_complete: localStorage.getItem('app_setup_complete'),
            app_db_path: localStorage.getItem('app_db_path'),
            session_logout_reason: sessionStorage.getItem('logout_reason'),
            activeCompanyId: sessionStorage.getItem('app_active_company_id'),
            navigatorOnline: navigator.onLine,
            userAgent: navigator.userAgent
        };
        // @ts-ignore
        const result = await window.electronAPI.generateDiagnostics(state);
        
        // We don't always want to show an alert (e.g. if we are looping), 
        // but if it's successful we can log it.
        if (result.success) {
            console.log('[Diagnostics] Secure report exported to:', result.filePath);
            
            // Extract the actual user's name/ID if they are logged in
            let userId = 'Unknown User';
            try {
                const sessionStr = sessionStorage.getItem('app_session_user');
                if (sessionStr) {
                    const userObj = JSON.parse(sessionStr);
                    userId = userObj.username || userObj.id || userId;
                }
            } catch (e) { /* ignore */ }

            window.alert('Diagnostic Log Saved successfully!\n\nPlease send this file to the developer for analysis:\nilcbala.bharatpayroll@gmail.com');
            
            const subject = encodeURIComponent(`error log form ${userId}`);
            const body = encodeURIComponent('Please attach the error log file (saved at desktop) here.');
            
            // Use Electron's native openExternal to guarantee the OS mail client opens
            // @ts-ignore
            if (window.electronAPI && window.electronAPI.openExternal) {
                // @ts-ignore
                window.electronAPI.openExternal(`mailto:ilcbala.bharatpayroll@gmail.com?subject=${subject}&body=${body}`);
            } else {
                window.location.href = `mailto:ilcbala.bharatpayroll@gmail.com?subject=${subject}&body=${body}`;
            }
            
            return true;
        } else {
            console.error('[Diagnostics] Export failed:', result.error);
            return false;
        }
    } catch (e) {
        console.error('[Diagnostics] Critical error during export:', e);
        return false;
    }
};
