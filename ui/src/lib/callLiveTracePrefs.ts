const STORAGE_KEY = 'mk01-live-call-trace-enabled';

export function isLiveCallTraceEnabled(): boolean {
    if (typeof window === 'undefined') {
        return true;
    }
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === null) {
        return true;
    }
    return v === '1' || v === 'true';
}

export function setLiveCallTraceEnabled(enabled: boolean): void {
    if (typeof window === 'undefined') {
        return;
    }
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
}
