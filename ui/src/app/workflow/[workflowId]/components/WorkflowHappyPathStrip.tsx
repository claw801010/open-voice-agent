'use client';

import { Check, Circle } from 'lucide-react';
import Link from 'next/link';

import { buildAnalyticsCallsExploreHref } from '@/lib/analyticsOverviewDeepLinks';
import { WORKFLOW_EDITOR_BEST_PRACTICES } from '@/lib/workflowCreationOptions';
import {
    buildWorkflowHappyPathSteps,
    workflowHappyPathComplete,
} from '@/lib/workflowHappyPath';

type Props = {
    workflowId: number;
    workflowName: string;
    nodes: Parameters<typeof buildWorkflowHappyPathSteps>[0]['nodes'];
    validationErrorCount: number;
    hasPublishedVersion: boolean;
    toolNamesByUuid: ReadonlyMap<string, string>;
    catalogSlug?: string | null;
    editorMode: 'edit' | 'simulation';
};

export function WorkflowHappyPathStrip({
    workflowId,
    workflowName,
    nodes,
    validationErrorCount,
    hasPublishedVersion,
    toolNamesByUuid,
    catalogSlug,
    editorMode,
}: Props) {
    const steps = buildWorkflowHappyPathSteps({
        nodes,
        validationErrorCount,
        hasPublishedVersion,
        toolNamesByUuid,
        catalogSlug,
    });
    const complete = workflowHappyPathComplete(steps);
    const workflowNameTrimmed = (workflowName ?? '').trim();
    const analyticsHref =
        hasPublishedVersion && workflowNameTrimmed
            ? buildAnalyticsCallsExploreHref({
                  toolName: workflowNameTrimmed,
                  catalogSlug: catalogSlug ?? undefined,
              })
            : null;

    return (
        <div
            className="mb-3 rounded-md border border-border bg-card/50 p-3"
            role="status"
            aria-label="Workflow outcome checklist"
        >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-xs font-medium text-foreground">Outcome checklist</p>
                {complete ? (
                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        Ready to run calls
                    </span>
                ) : (
                    <span className="text-[11px] text-muted-foreground">
                        {editorMode === 'simulation' ? 'Switch to Edit to wire the graph' : 'Maximize proof before publish'}
                    </span>
                )}
            </div>
            <ol className="grid gap-1.5">
                {steps.map((step) => (
                    <li key={step.id} className="flex items-start gap-2 text-[11px]">
                        {step.done ? (
                            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        ) : (
                            <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
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
                    After live traffic, review proof in{' '}
                    <Link href={analyticsHref} className="text-foreground/90 underline-offset-2 hover:underline">
                        Call analytics
                    </Link>
                    .
                </p>
            ) : null}
            {!complete ? (
                <ul className="mt-2 list-disc pl-4 text-[10px] text-muted-foreground space-y-0.5">
                    {WORKFLOW_EDITOR_BEST_PRACTICES.slice(0, 2).map((tip) => (
                        <li key={tip}>{tip}</li>
                    ))}
                </ul>
            ) : null}
            <p className="mt-2 text-[10px] text-muted-foreground">
                <Link href={`/workflow/${workflowId}/settings`} className="underline-offset-2 hover:underline">
                    Workflow settings
                </Link>
                {' · '}
                <Link href="/tools" className="underline-offset-2 hover:underline">
                    HTTP tools
                </Link>
            </p>
        </div>
    );
}
