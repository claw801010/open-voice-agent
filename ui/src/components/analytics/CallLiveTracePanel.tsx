'use client';

import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Cpu,
    Gauge,
    Network,
    Wrench,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CallLiveTrace, CallQualityReport, LiveTraceTimelineEntry } from '@/lib/callLiveTraceTypes';
import { cn } from '@/lib/utils';

type Props = {
    liveTrace: CallLiveTrace | null | undefined;
    qualityReport?: CallQualityReport | null;
    compact?: boolean;
    className?: string;
};

function containmentVariant(c: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (c === 'contained') return 'default';
    if (c === 'escalated') return 'destructive';
    if (c === 'partial') return 'secondary';
    return 'outline';
}

function kindIcon(entry: LiveTraceTimelineEntry) {
    switch (entry.kind) {
        case 'tool':
            return <Wrench className="h-3.5 w-3.5 shrink-0 text-amber-500" />;
        case 'llm':
            return <Cpu className="h-3.5 w-3.5 shrink-0 text-violet-500" />;
        case 'error':
            return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />;
        case 'system':
            return <Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
        default:
            return entry.role === 'user' ? (
                <span className="text-[10px] font-medium text-muted-foreground">U</span>
            ) : (
                <span className="text-[10px] font-medium text-teal-600">A</span>
            );
    }
}

function formatTs(ts?: string) {
    if (!ts) return '';
    try {
        return new Date(ts).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    } catch {
        return ts;
    }
}

function MetricTile({
    label,
    value,
    sub,
    icon: Icon,
    badgeVariant,
}: {
    label: string;
    value: string;
    sub?: string;
    icon: typeof Gauge;
    badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}) {
    return (
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </div>
            {badgeVariant ? (
                <Badge variant={badgeVariant} className="mt-2 capitalize">
                    {value}
                </Badge>
            ) : (
                <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-semibold tabular-nums">{value}</span>
                    {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
                </div>
            )}
        </div>
    );
}

function QualityOverview({ report }: { report: CallQualityReport }) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="CX score" value={`${report.cx_score}`} sub="/ 100" icon={Gauge} />
            <MetricTile
                label="Containment"
                value={report.containment}
                icon={CheckCircle2}
                badgeVariant={containmentVariant(report.containment)}
            />
            <MetricTile
                label="Tool success"
                value={
                    report.tool_success_rate != null ? `${Math.round(report.tool_success_rate * 100)}%` : '—'
                }
                sub={`${report.tool_invocation_count} calls`}
                icon={Wrench}
            />
            <MetricTile
                label="LLM latency"
                value={
                    report.llm_inference.avg_ttfb_ms != null
                        ? `${report.llm_inference.avg_ttfb_ms} ms`
                        : '—'
                }
                sub={
                    report.llm_inference.inference_count
                        ? `${report.llm_inference.inference_count} inferences`
                        : undefined
                }
                icon={Cpu}
            />
        </div>
    );
}

function TimelineList({ entries }: { entries: LiveTraceTimelineEntry[] }) {
    if (entries.length === 0) {
        return <p className="text-sm text-muted-foreground">No trace events yet.</p>;
    }
    return (
        <ul className="max-h-[min(420px,50vh)] space-y-1 overflow-y-auto pr-1">
            {entries.map((e, i) => (
                <li
                    key={`${e.timestamp}-${i}`}
                    className={cn(
                        'flex gap-2 rounded-md px-2 py-1.5 text-sm',
                        e.kind === 'error' && 'bg-destructive/10',
                    )}
                >
                    <span className="mt-0.5 w-4 shrink-0">{kindIcon(e)}</span>
                    <span className="min-w-0 flex-1">
                        <span className="line-clamp-2">{e.summary}</span>
                        {e.kind === 'tool' && e.http_status != null ? (
                            <span className="ml-1 text-xs text-muted-foreground">HTTP {e.http_status}</span>
                        ) : null}
                        {e.kind === 'llm' && e.ttfb_ms != null ? (
                            <span className="ml-1 text-xs text-muted-foreground">{e.ttfb_ms} ms</span>
                        ) : null}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                        {formatTs(e.timestamp)}
                    </span>
                </li>
            ))}
        </ul>
    );
}

function ToolInvocationRow({
    inv,
}: {
    inv: CallLiveTrace['tool_invocations'][number];
}) {
    const [open, setOpen] = useState(false);
    const hasDetail = Boolean(inv.http || inv.receive);
    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger
                className="flex w-full items-center gap-2 rounded-md border border-border/60 px-2 py-2 text-left text-sm hover:bg-muted/40"
                disabled={!hasDetail}
            >
                {hasDetail ? (
                    open ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                    )
                ) : (
                    <span className="w-4" />
                )}
                <Wrench className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span className="min-w-0 flex-1 truncate font-medium">{inv.tool_name}</span>
                <Badge variant={inv.success ? 'secondary' : 'destructive'} className="shrink-0 text-[10px]">
                    {inv.success ? 'OK' : 'fail'}
                </Badge>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{inv.duration_ms} ms</span>
            </CollapsibleTrigger>
            {hasDetail ? (
                <CollapsibleContent className="space-y-2 border-l-2 border-border/60 px-3 pb-2 pt-1 text-xs">
                    {inv.http ? (
                        <div>
                            <span className="font-medium text-muted-foreground">Send / HTTP </span>
                            <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-2">
                                {JSON.stringify(inv.http, null, 2)}
                            </pre>
                        </div>
                    ) : null}
                    {inv.receive ? (
                        <div>
                            <span className="font-medium text-muted-foreground">Receive </span>
                            <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-2">
                                {JSON.stringify(inv.receive, null, 2)}
                            </pre>
                        </div>
                    ) : null}
                </CollapsibleContent>
            ) : null}
        </Collapsible>
    );
}

function ToolFunctionsTable({ report }: { report: CallQualityReport }) {
    const rows = report.tool_functions;
    if (rows.length === 0) {
        return <p className="text-sm text-muted-foreground">No tool functions invoked.</p>;
    }
    return (
        <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Function</th>
                        <th className="px-3 py-2 font-medium">Calls</th>
                        <th className="px-3 py-2 font-medium">Success</th>
                        <th className="px-3 py-2 font-medium">Avg ms</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.function_name} className="border-b border-border/60 last:border-0">
                            <td className="px-3 py-2 font-mono text-xs">{r.function_name}</td>
                            <td className="px-3 py-2 tabular-nums">{r.invocation_count}</td>
                            <td className="px-3 py-2 tabular-nums">
                                {Math.round(r.success_rate * 100)}%
                            </td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">
                                {r.avg_duration_ms ?? '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function CallLiveTracePanel({ liveTrace, qualityReport, compact, className }: Props) {
    const trace = liveTrace ?? { timeline: [], tool_invocations: [], llm_inference: { inference_count: 0, avg_ttfb_ms: null, max_ttfb_ms: null, models: [] } };
    const hasData =
        trace.timeline.length > 0 ||
        trace.tool_invocations.length > 0 ||
        trace.llm_inference.inference_count > 0;

    const inner = (
        <Tabs defaultValue={qualityReport ? 'quality' : 'timeline'} className="w-full">
            <TabsList className={cn('grid w-full', qualityReport ? 'grid-cols-4' : 'grid-cols-3')}>
                {qualityReport ? <TabsTrigger value="quality">Quality</TabsTrigger> : null}
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="tools">
                    Tools
                    {trace.tool_invocations.length > 0 ? (
                        <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                            {trace.tool_invocations.length}
                        </Badge>
                    ) : null}
                </TabsTrigger>
                <TabsTrigger value="llm">LLM</TabsTrigger>
            </TabsList>

            {qualityReport ? (
                <TabsContent value="quality" className="mt-3 space-y-4">
                    <QualityOverview report={qualityReport} />
                    {qualityReport.qa_flags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {qualityReport.qa_flags.map((f) => (
                                <Badge key={f} variant="outline">
                                    {f}
                                </Badge>
                            ))}
                        </div>
                    ) : null}
                    {qualityReport.outcome_key ? (
                        <p className="text-sm text-muted-foreground">
                            Outcome: <span className="font-medium text-foreground">{qualityReport.outcome_key}</span>
                        </p>
                    ) : null}
                    <div>
                        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Tool functions
                        </h4>
                        <ToolFunctionsTable report={qualityReport} />
                    </div>
                </TabsContent>
            ) : null}

            <TabsContent value="timeline" className="mt-3">
                <TimelineList entries={trace.timeline} />
            </TabsContent>

            <TabsContent value="tools" className="mt-3 space-y-2">
                {trace.tool_invocations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tool/API activity yet.</p>
                ) : (
                    trace.tool_invocations.map((inv) => (
                        <ToolInvocationRow key={inv.tool_call_id} inv={inv} />
                    ))
                )}
            </TabsContent>

            <TabsContent value="llm" className="mt-3 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-border/80 bg-muted/20 p-2">
                        <span className="text-xs text-muted-foreground">Inferences</span>
                        <p className="text-lg font-semibold tabular-nums">{trace.llm_inference.inference_count}</p>
                    </div>
                    <div className="rounded-md border border-border/80 bg-muted/20 p-2">
                        <span className="text-xs text-muted-foreground">Avg TTFB</span>
                        <p className="text-lg font-semibold tabular-nums">
                            {trace.llm_inference.avg_ttfb_ms != null
                                ? `${trace.llm_inference.avg_ttfb_ms} ms`
                                : '—'}
                        </p>
                    </div>
                </div>
                {trace.llm_inference.models.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {trace.llm_inference.models.map((m) => (
                            <Badge key={m} variant="outline" className="font-mono text-[10px]">
                                {m}
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground">Model metrics appear as the agent responds.</p>
                )}
            </TabsContent>
        </Tabs>
    );

    if (compact) {
        return (
            <div className={cn('flex h-full flex-col bg-background', className)}>
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                    <Network className="h-4 w-4 text-teal-600" />
                    <span className="text-sm font-medium">Live trace</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3">{hasData ? inner : <p className="text-sm text-muted-foreground">Waiting for call activity…</p>}</div>
            </div>
        );
    }

    return (
        <Card className={className}>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Network className="h-4 w-4 text-teal-600" />
                    Call trace & quality
                </CardTitle>
                <CardDescription>
                    Tool calls, HTTP send/receive, LLM latency, containment, and per-function ratings from call logs.
                </CardDescription>
            </CardHeader>
            <CardContent>{hasData || qualityReport ? inner : <p className="text-sm text-muted-foreground">No trace data for this call.</p>}</CardContent>
        </Card>
    );
}
