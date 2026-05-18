'use client';

import { Check, Circle } from 'lucide-react';
import Link from 'next/link';

import { buildAnalyticsCallsExploreHref } from '@/lib/analyticsOverviewDeepLinks';
import {
    buildHttpToolHappyPathSteps,
    httpToolHappyPathComplete,
} from '@/lib/httpToolHappyPath';

type Props = {
    toolName: string;
    url: string;
    testCallSucceeded: boolean;
    responseMappings: ReadonlyArray<{ key: string; value: string }>;
    isSaved: boolean;
};

export function HttpToolHappyPathStrip({
    toolName,
    url,
    testCallSucceeded,
    responseMappings,
    isSaved,
}: Props) {
    const steps = buildHttpToolHappyPathSteps({
        url,
        testCallSucceeded,
        responseMappings,
        isSaved,
    });
    const complete = httpToolHappyPathComplete(steps);
    const analyticsHref =
        testCallSucceeded && toolName.trim()
            ? buildAnalyticsCallsExploreHref({ toolName: toolName.trim() })
            : null;

    return (
        <div
            className="mb-4 rounded-md border border-border bg-card/40 p-3"
            role="status"
            aria-label="HTTP tool setup checklist"
        >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-xs font-medium text-foreground">Happy path</p>
                {complete ? (
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        Ready for workflow wiring
                    </span>
                ) : (
                    <span className="text-[11px] text-muted-foreground">
                        Complete the steps below before publishing
                    </span>
                )}
            </div>
            <ol className="grid gap-2 sm:grid-cols-2">
                {steps.map((step) => (
                    <li key={step.id} className="flex items-start gap-2 text-xs">
                        {step.done ? (
                            <Check
                                className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                                aria-hidden
                            />
                        ) : (
                            <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
                        )}
                        <span>
                            <span className="font-medium text-foreground/90">{step.label}</span>
                            <span className="text-muted-foreground"> — {step.detail}</span>
                        </span>
                    </li>
                ))}
            </ol>
            {analyticsHref ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                    After live calls, proof appears in{' '}
                    <Link href={analyticsHref} className="text-foreground/90 underline-offset-2 hover:underline">
                        Call analytics
                    </Link>{' '}
                    (filter by tool name).
                </p>
            ) : null}
        </div>
    );
}
