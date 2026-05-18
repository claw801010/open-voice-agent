"use client";

import { ArrowLeft, ClipboardList, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { CallLiveTracePanel } from '@/components/analytics/CallLiveTracePanel';
import { CallReviewPanel } from '@/components/analytics/CallReviewPanel';
import { CallScorecardPanel, type CallScorecard } from '@/components/analytics/CallScorecardPanel';
import type { CallLiveTrace, CallQualityReport } from '@/lib/callLiveTraceTypes';
import { type AnalyticsCallDetail, fetchAnalyticsCallDetail } from "@/lib/analyticsCallsApi";
import { useAuth } from "@/lib/auth";

function formatDurationMs(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function AnalyticsCallDetailPage() {
    const params = useParams();
    const callId = typeof params.callId === "string" ? params.callId : "";
    const { user, loading: authLoading, getAccessToken } = useAuth();
    const [detail, setDetail] = useState<AnalyticsCallDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (authLoading || !user || !callId || !getAccessToken) return;
        let cancelled = false;
        void (async () => {
            setLoading(true);
            setNotFound(false);
            try {
                const d = await fetchAnalyticsCallDetail(getAccessToken, decodeURIComponent(callId));
                if (!cancelled) {
                    if (d == null) {
                        setNotFound(true);
                        setDetail(null);
                    } else {
                        setNotFound(false);
                        setDetail(d);
                    }
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : "Failed to load call";
                toast.error(msg);
                if (!cancelled) setDetail(null);
                if (!cancelled) setNotFound(false);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [authLoading, user, callId, getAccessToken]);

    if (authLoading || !user) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
                Sign in to view call detail.
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-4 pb-12">
            <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="sm" asChild className="gap-1">
                    <Link href="/analytics/calls">
                        <ArrowLeft className="h-4 w-4" />
                        All calls
                    </Link>
                </Button>
                {typeof detail?.engineering_links?.langfuse_trace_url === "string" ? (
                    <Button variant="outline" size="sm" asChild className="gap-1.5">
                        <a
                            href={detail.engineering_links.langfuse_trace_url}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Open in Langfuse
                        </a>
                    </Button>
                ) : null}
            </div>

            <div className="flex items-start gap-3">
                <ClipboardList className="mt-1 h-8 w-8 shrink-0 text-teal-500/90" aria-hidden />
                <div className="min-w-0">
                    <h1 className="font-mono text-xl font-semibold tracking-tight break-all">{callId}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Outcomes, metrics, tool spans (HTTP <code className="text-xs">mapped_data</code>), and QA
                        summary from{" "}
                        <code className="text-xs">GET /api/v1/analytics/calls/{"{call_id}"}</code>
                    </p>
                </div>
            </div>

            {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
            ) : notFound ? (
                <p className="text-sm text-muted-foreground" role="status">
                    Call not found or not visible for your organization.
                </p>
            ) : detail ? (
                <>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Workflow</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div>
                                    <span className="text-muted-foreground">ID </span>
                                    {detail.workflow_id}
                                </div>
                                {detail.workflow_slug ? (
                                    <div>
                                        <span className="text-muted-foreground">Pack slug </span>
                                        <Badge variant="secondary">{detail.workflow_slug}</Badge>
                                    </div>
                                ) : null}
                                {detail.catalog_variant_id ? (
                                    <div>
                                        <span className="text-muted-foreground">Catalog variant </span>
                                        <Badge variant="outline" className="font-mono">
                                            {detail.catalog_variant_id}
                                        </Badge>
                                    </div>
                                ) : null}
                                <div>
                                    <span className="text-muted-foreground">Started </span>
                                    {new Date(detail.started_at).toLocaleString()}
                                </div>
                                {detail.ended_at ? (
                                    <div>
                                        <span className="text-muted-foreground">Ended </span>
                                        {new Date(detail.ended_at).toLocaleString()}
                                    </div>
                                ) : null}
                                <div>
                                    <span className="text-muted-foreground">Duration </span>
                                    {formatDurationMs(detail.duration_ms)}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Metrics</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-muted-foreground">LLM rounds </span>
                                    {detail.metrics.llm_rounds}
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Tool calls </span>
                                    {detail.metrics.tool_invocation_count}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Customer outcomes</CardTitle>
                            <CardDescription>
                                Customer-defined results from <code className="text-xs">gathered_context</code> (e.g.{" "}
                                <code className="text-xs">outcome_key</code>, disposition tags). Use these for vertical
                                KPIs (booking, escalation, resolution).
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {Object.keys(detail.outcomes || {}).length === 0 ? (
                                <p className="text-sm text-muted-foreground">No outcome fields recorded.</p>
                            ) : (
                                <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
                                    {JSON.stringify(detail.outcomes, null, 2)}
                                </pre>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Tool spans</CardTitle>
                            <CardDescription>
                                Parsed from call logs; HTTP rows expose <code className="text-xs">mapped_data</code>{" "}
                                when the tool returned structured results.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {detail.tool_spans.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No tool invocations logged.</p>
                            ) : (
                                <div className="rounded-md border border-border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Tool</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Duration</TableHead>
                                                <TableHead>HTTP</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {detail.tool_spans.map((span) => (
                                                <TableRow key={span.span_id}>
                                                    <TableCell className="font-medium">{span.tool_name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{span.tool_type}</Badge>
                                                    </TableCell>
                                                    <TableCell className="tabular-nums text-sm">
                                                        {span.duration_ms} ms
                                                    </TableCell>
                                                    <TableCell className="max-w-md">
                                                        {span.http ? (
                                                            <pre className="max-h-40 overflow-auto rounded border border-border/80 bg-muted/30 p-2 text-xs">
                                                                {JSON.stringify(span.http, null, 2)}
                                                            </pre>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <CallLiveTracePanel
                        liveTrace={(detail.live_trace as CallLiveTrace | undefined) ?? null}
                        qualityReport={(detail.quality_report as CallQualityReport | undefined) ?? null}
                    />

                    <CallScorecardPanel scorecard={(detail.scorecard as CallScorecard | undefined) ?? null} />

                    <CallReviewPanel callId={callId} detail={detail} />

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">QM / QA review</CardTitle>
                            <CardDescription>
                                Score, flags, and reviewer notes from workflow annotations when QA nodes ran.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!detail.qa ? (
                                <p className="text-sm text-muted-foreground">No QM or QA metadata stored.</p>
                            ) : (
                                <div className="space-y-3 text-sm">
                                    {detail.qa.score != null ? (
                                        <div>
                                            <span className="text-muted-foreground">Score </span>
                                            {detail.qa.score}
                                        </div>
                                    ) : null}
                                    {detail.qa.flags && detail.qa.flags.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {detail.qa.flags.map((f) => (
                                                <Badge key={f} variant="secondary">
                                                    {f}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : null}
                                    {detail.qa.reviewer_notes?.trim() ? (
                                        <div>
                                            <span className="text-muted-foreground block text-xs mb-1">
                                                Reviewer notes
                                            </span>
                                            <p className="whitespace-pre-wrap rounded-md border border-border/80 bg-muted/30 p-2 text-sm">
                                                {detail.qa.reviewer_notes}
                                            </p>
                                        </div>
                                    ) : null}
                                    {detail.qa.score == null &&
                                    (!detail.qa.flags || detail.qa.flags.length === 0) &&
                                    !detail.qa.reviewer_notes?.trim() ? (
                                        <p className="text-muted-foreground">QA object present but empty.</p>
                                    ) : null}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            ) : null}
        </div>
    );
}
