'use client';

import { useSyncExternalStore } from 'react';

/**
 * Subscribes to `window.matchMedia(query)`. SSR snapshot is `false`.
 */
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (onChange) => {
            if (typeof window === 'undefined') {
                return () => {};
            }
            const mq = window.matchMedia(query);
            mq.addEventListener('change', onChange);
            return () => mq.removeEventListener('change', onChange);
        },
        () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false),
        () => false,
    );
}
