'use client';

import type { ReactElement } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Wraps wire-local buttons with hover tips when a buyer-demo hint is available. */
export function WireLocalActionHint({
    hint,
    children,
}: {
    hint?: string;
    children: ReactElement;
}) {
    const text = hint?.trim();
    if (!text) {
        return children;
    }
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-left leading-snug">
                {text}
            </TooltipContent>
        </Tooltip>
    );
}
