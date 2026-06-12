'use client';

import { CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type Props = {
    /** Primary line (visible next to icon or as trigger label). */
    label?: string;
    /** Tooltip body — story, tips, compliance. */
    tip: string;
    /** Optional secondary lines shown in tooltip. */
    extraLines?: string[];
    className?: string;
    /** When set, wraps custom trigger content instead of the default help icon. */
    children?: ReactNode;
};

/** Inline help icon + hover tooltip for MK-01 buyer-demo guidance. */
export function CatalogBuyerHintTip({ label, tip, extraLines = [], className, children }: Props) {
    const body = [tip, ...extraLines.filter(Boolean)].join('\n\n');

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {children ?? (
                    <button
                        type="button"
                        className={
                            className ??
                            'inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline'
                        }
                        aria-label={label ?? 'Buyer demo tip'}
                    >
                        {label ? <span>{label}</span> : null}
                        <CircleHelp className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    </button>
                )}
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm whitespace-pre-line text-left leading-snug">
                {body}
            </TooltipContent>
        </Tooltip>
    );
}
