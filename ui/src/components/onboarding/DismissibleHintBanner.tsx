'use client';

import { X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { dismissHint, isHintDismissed, type DismissibleHintKey } from '@/lib/onboarding/dismissibleHints';
import { cn } from '@/lib/utils';

type Props = {
    hintKey: DismissibleHintKey;
    title: string;
    children: ReactNode;
    className?: string;
    'data-testid'?: string;
};

/** One-time dismissible guide strip; persists in localStorage. */
export function DismissibleHintBanner({ hintKey, title, children, className, 'data-testid': testId }: Props) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setVisible(!isHintDismissed(hintKey));
    }, [hintKey]);

    if (!visible) return null;

    return (
        <div
            role="note"
            data-testid={testId}
            className={cn(
                'relative rounded-md border border-sky-500/25 bg-sky-500/5 px-3 py-3 pr-10 text-sm',
                className,
            )}
        >
            <p className="font-medium text-foreground">{title}</p>
            <div className="mt-1.5 text-muted-foreground leading-relaxed">{children}</div>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
                aria-label="Dismiss tip"
                onClick={() => {
                    dismissHint(hintKey);
                    setVisible(false);
                }}
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}
