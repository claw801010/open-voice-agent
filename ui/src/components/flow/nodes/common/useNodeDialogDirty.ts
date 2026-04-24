'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { FlowNodeData } from '@/components/flow/types';

/**
 * Baseline snapshot when the node edit dialog opens — used with **Form | Raw JSON** (WE-01-DUALMODE).
 */
export function useNodeDialogDirty(open: boolean, getPendingData: () => FlowNodeData): boolean {
    const [dirtyBaseline, setDirtyBaseline] = useState<string | null>(null);
    const prevOpenRef = useRef(false);

    useEffect(() => {
        if (!open) {
            setDirtyBaseline(null);
            prevOpenRef.current = false;
            return;
        }
        if (!prevOpenRef.current) {
            prevOpenRef.current = true;
            const id = requestAnimationFrame(() => {
                setDirtyBaseline(JSON.stringify(getPendingData()));
            });
            return () => cancelAnimationFrame(id);
        }
    }, [open, getPendingData]);

    return useMemo(() => {
        if (dirtyBaseline === null) return false;
        return JSON.stringify(getPendingData()) !== dirtyBaseline;
    }, [dirtyBaseline, getPendingData]);
}
