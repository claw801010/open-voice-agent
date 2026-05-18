'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type Props = {
    className?: string;
    /** When true, centers spinner in a full-viewport flex container (auth bootstrap). */
    fullScreen?: boolean;
};

/**
 * Spinner rendered only after mount so browser extensions (e.g. Dark Reader) cannot
 * mutate server-rendered SVG attributes and trigger React hydration mismatches.
 */
export function ClientOnlyLoader({ className = 'w-8 h-8', fullScreen = true }: Props) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const shellClass = fullScreen
        ? 'flex items-center justify-center min-h-screen'
        : 'flex items-center justify-center';

    if (!mounted) {
        return (
            <div className={shellClass} aria-busy="true" suppressHydrationWarning>
                <span className="sr-only">Loading</span>
            </div>
        );
    }

    return (
        <div className={shellClass} suppressHydrationWarning>
            <Loader2 className={`${className} animate-spin`} aria-hidden />
        </div>
    );
}
