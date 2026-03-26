import { useState, useEffect, useCallback } from 'react';

/**
 * A hook to automatically save and restore unsaved form states to localStorage.
 * Perfect for preventing data loss during crashes or accidental reloads.
 */
export function useSessionRecovery<T>(key: string, currentState: T | null, onRestore: (recovered: T) => void) {
    const storageKey = `bpp_session_recovery_${key}`;
    const [hasDraft, setHasDraft] = useState(false);

    // Check for existing draft on mount
    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const draft = JSON.parse(saved);
                // Only flag if draft is actually different (basic check or existence)
                if (draft) {
                    setHasDraft(true);
                }
            } catch (e) {
                console.error('Failed to parse session recovery draft', e);
            }
        }
    }, [storageKey]);

    // Save state on changes (with debouncing/instancy logic handled by component or simple effect)
    useEffect(() => {
        if (currentState) {
            localStorage.setItem(storageKey, JSON.stringify(currentState));
        }
    }, [currentState, storageKey]);

    const restoreDraft = useCallback(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const draft = JSON.parse(saved);
                onRestore(draft);
                setHasDraft(false);
            } catch (e) {
                console.error('Restore failed', e);
            }
        }
    }, [storageKey, onRestore]);

    const clearDraft = useCallback(() => {
        localStorage.removeItem(storageKey);
        setHasDraft(false);
    }, [storageKey]);

    return {
        hasDraft,
        restoreDraft,
        clearDraft
    };
}
