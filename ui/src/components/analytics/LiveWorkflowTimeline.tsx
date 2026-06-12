'use client';

import { CheckCircle2, Circle } from 'lucide-react';

import type { AnalyticsCallDetail } from '@/lib/analyticsCallsApi';
import {
    buildHealthcareLiveWorkflowSteps,
    showHealthcareLiveWorkflow,
} from '@/lib/healthcareLiveWorkflow';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
    detail: AnalyticsCallDetail;
};

export function LiveWorkflowTimeline({ detail }: Props) {
    if (!showHealthcareLiveWorkflow(detail)) {
        return null;
    }

    const steps = buildHealthcareLiveWorkflowSteps(detail);
    const ehrStep = steps.find((s) => s.label.includes('Chart synced'));
    const vendor =
        (detail.tool_spans ?? [])
            .flatMap((s) => {
                const m = s.http?.mapped_data as Record<string, unknown> | undefined;
                return m?.ehr_vendor ? [String(m.ehr_vendor)] : [];
            })
            .at(0) ?? 'athenahealth';

    return (
        <Card data-testid="live-workflow-timeline">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Live workflow</CardTitle>
                <CardDescription>
                    Voice + HTTP tool steps — chart write-back appears when{' '}
                    <code className="text-xs">sync_chart_to_ehr</code> runs.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ol className="relative space-y-4 border-l border-border pl-4">
                    {steps.map((step) => (
                        <li key={step.id} className="relative">
                            <span className="absolute -left-[1.35rem] top-0.5 rounded-full bg-background">
                                {step.status === 'done' ? (
                                    <CheckCircle2 className="h-4 w-4 text-teal-600" aria-hidden />
                                ) : (
                                    <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />
                                )}
                            </span>
                            <p className="text-sm font-medium text-foreground">{step.label}</p>
                            {step.detail ? (
                                <p className="text-xs text-muted-foreground">{step.detail}</p>
                            ) : null}
                        </li>
                    ))}
                </ol>
                {ehrStep ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-xs">
                        <span>
                            Synced to EHR · <strong className="font-medium">{vendor}</strong>
                        </span>
                        <span className="rounded bg-teal-600/20 px-2 py-0.5 font-medium text-teal-800 dark:text-teal-200">
                            Live
                        </span>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}
