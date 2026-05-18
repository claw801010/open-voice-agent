'use client';

import { CheckCircle2, ClipboardCheck, XCircle } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type ScorecardCriterionRow = {
    criterion_id: string;
    label: string;
    description?: string | null;
    pass: boolean | null;
    note?: string | null;
    source_node?: string | null;
};

export type CallScorecard = {
    rubric_version?: number;
    criteria: ScorecardCriterionRow[];
    summary: {
        evaluated_count: number;
        passed_count: number;
        pass_rate: number | null;
        total_criteria: number;
    };
};

type Props = {
    scorecard: CallScorecard | null | undefined;
    className?: string;
};

export function CallScorecardPanel({ scorecard, className }: Props) {
    const rows = scorecard?.criteria ?? [];
    const summary = scorecard?.summary;

    return (
        <Card className={className}>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardCheck className="h-4 w-4 text-teal-600" />
                    QM scorecard
                </CardTitle>
                <CardDescription>
                    Pass/fail against your org rubric. Populated when a workflow QA node returns a{' '}
                    <code className="text-xs">criteria</code> array.{' '}
                    <Link href="/analytics/calls" className="underline underline-offset-2">
                        Edit rubric
                    </Link>{' '}
                    on the call list page.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No rubric criteria configured or no QA scores on this call yet.
                    </p>
                ) : (
                    <>
                        {summary && summary.evaluated_count > 0 ? (
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary" className="tabular-nums">
                                    {summary.passed_count}/{summary.evaluated_count} passed
                                </Badge>
                                {summary.pass_rate != null ? (
                                    <span className="text-muted-foreground">
                                        {Math.round(summary.pass_rate * 100)}% pass rate
                                    </span>
                                ) : null}
                            </div>
                        ) : (
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                QA ran but no criteria were scored — add a{' '}
                                <code className="text-[11px]">criteria</code> array to the QA node JSON
                                response.
                            </p>
                        )}
                        <ul className="divide-y divide-border rounded-md border border-border">
                            {rows.map((row) => (
                                <li
                                    key={row.criterion_id}
                                    className="flex gap-3 px-3 py-2.5 text-sm"
                                >
                                    <span className="mt-0.5 shrink-0">
                                        {row.pass === true ? (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        ) : row.pass === false ? (
                                            <XCircle className="h-4 w-4 text-destructive" />
                                        ) : (
                                            <span className="inline-block h-4 w-4 rounded-full border border-dashed border-muted-foreground/50" />
                                        )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="font-medium">{row.label}</span>
                                        {row.description ? (
                                            <p className="text-xs text-muted-foreground">{row.description}</p>
                                        ) : null}
                                        {row.note ? (
                                            <p
                                                className={cn(
                                                    'mt-1 text-xs',
                                                    row.pass === false
                                                        ? 'text-destructive/90'
                                                        : 'text-muted-foreground',
                                                )}
                                            >
                                                {row.note}
                                            </p>
                                        ) : null}
                                        {row.source_node ? (
                                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                                                From node: {row.source_node}
                                            </p>
                                        ) : null}
                                    </span>
                                    <Badge
                                        variant={
                                            row.pass === true
                                                ? 'secondary'
                                                : row.pass === false
                                                  ? 'destructive'
                                                  : 'outline'
                                        }
                                        className="shrink-0 self-start text-[10px]"
                                    >
                                        {row.pass === true ? 'Pass' : row.pass === false ? 'Fail' : '—'}
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
