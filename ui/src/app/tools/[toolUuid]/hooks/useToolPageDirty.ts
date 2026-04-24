'use client';

import type { ToolResponse } from '@/client/types.gen';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Dirty detection for full-page tool editor vs last loaded/saved server state (WE-01-DUALMODE).
 * Baseline resets when `tool` identity/version changes, not when form fields change.
 */
export function useToolPageDirty(
    tool: ToolResponse | null,
    getPending: () => unknown
): boolean {
    const [baseline, setBaseline] = useState<string | null>(null);
    const toolKeyRef = useRef<string | null>(null);
    const getPendingRef = useRef(getPending);
    getPendingRef.current = getPending;

    useEffect(() => {
        if (!tool) {
            setBaseline(null);
            toolKeyRef.current = null;
            return;
        }
        const key = `${tool.tool_uuid}:${tool.updated_at ?? ''}`;
        if (toolKeyRef.current !== key) {
            toolKeyRef.current = key;
            const id = requestAnimationFrame(() => {
                setBaseline(JSON.stringify(getPendingRef.current()));
            });
            return () => cancelAnimationFrame(id);
        }
    }, [tool]);

    return useMemo(() => {
        if (baseline === null || !tool) return false;
        return JSON.stringify(getPending()) !== baseline;
    }, [baseline, tool, getPending]);
}
