"use client";

import { ClipboardList, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { getWorkflowsApiV1WorkflowFetchGet } from "@/client/sdk.gen";
import type { WorkflowListResponse } from "@/client/types.gen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    type AnalyticsCallListItem,
    fetchAnalyticsCallsPage,
} from "@/lib/analyticsCallsApi";
import { useAuth } from "@/lib/auth";

function formatDurationMs(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
}

function utcDayStart(isoDate: string): string | undefined {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return undefined;
    return `${isoDate}T00:00:00.000Z`;
}

function utcDayEnd(isoDate: string): string | undefined {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return undefined;
    return `${isoDate}T23:59:59.999Z`;
}

function listParamsFromSearchParams(sp: URLSearchParams) {
    const wfRaw = sp.get("workflow_id");
    const wf = wfRaw ? Number.parseInt(wfRaw, 10) : undefined;
    return {
        workflow_id: wf != null && Number.isFinite(wf) ? wf : undefined,
        since: utcDayStart(sp.get("since") || "") || undefined,
        until: utcDayEnd(sp.get("until") || "") || undefined,
        disposition: sp.get("disposition")?.trim() || undefined,
        outcome_key: sp.get("outcome_key")?.trim() || undefined,
        tool_name: sp.get("tool_name")?.trim() || undefined,
    };
}

export default function AnalyticsCallsListContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading, getAccessToken } = useAuth();

    const [workflows, setWorkflows] = useState<WorkflowListResponse[]>([]);
    const [items, setItems] = useState<AnalyticsCallListItem[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const [workflowId, setWorkflowId] = useState("");
    const [sinceDay, setSinceDay] = useState("");
    const [untilDay, setUntilDay] = useState("");
    const [disposition, setDisposition] = useState("");
    const [outcomeKey, setOutcomeKey] = useState("");
    const [toolName, setToolName] = useState("");

    const dashboardStats = useMemo(() => {
        const toolSet = new Set<string>();
        for (const row of items) {
            for (const t of row.tool_names || []) toolSet.add(t);
        }
        const withOutcome = items.filter((i) => i.outcome_key).length;
        return {
            calls: items.length,
            distinctTools: toolSet.size,
            withOutcome,
        };
    }, [items]);

    useEffect(() => {
        setWorkflowId(searchParams.get("workflow_id") || "");
        setSinceDay(searchParams.get("since") || "");
        setUntilDay(searchParams.get("until") || "");
        setDisposition(searchParams.get("disposition") || "");
        setOutcomeKey(searchParams.get("outcome_key") || "");
        setToolName(searchParams.get("tool_name") || "");
    }, [searchParams]);

    useEffect(() => {
        if (authLoading || !user) return;
        void (async () => {
            try {
                const res = await getWorkflowsApiV1WorkflowFetchGet({});
                if (res.data) setWorkflows(res.data);
            } catch {
                toast.error("Could not load workflows for filter");
            }
        })();
    }, [authLoading, user]);

    const fetchFirstPage = useCallback(async () => {
        if (!getAccessToken) return;
        setLoading(true);
        try {
            const base = listParamsFromSearchParams(searchParams);
            const page = await fetchAnalyticsCallsPage(getAccessToken, {
                ...base,
                limit: 50,
                cursor: undefined,
            });
            setItems(page.items);
            setNextCursor(page.next_cursor);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load calls";
            toast.error(msg);
            setItems([]);
            setNextCursor(null);
        } finally {
            setLoading(false);
        }
    }, [getAccessToken, searchParams]);

    useEffect(() => {
        if (authLoading || !user) return;
        void fetchFirstPage();
    }, [authLoading, user, fetchFirstPage]);

    const applyFilters = () => {
        const q = new URLSearchParams();
        if (workflowId && workflowId !== "all") q.set("workflow_id", workflowId);
        if (sinceDay) q.set("since", sinceDay);
        if (untilDay) q.set("until", untilDay);
        if (disposition.trim()) q.set("disposition", disposition.trim());
        if (outcomeKey.trim()) q.set("outcome_key", outcomeKey.trim());
        if (toolName.trim()) q.set("tool_name", toolName.trim());
        const qs = q.toString();
        router.replace(qs ? `/analytics/calls?${qs}` : "/analytics/calls");
    };

    const loadMore = async () => {
        if (!nextCursor || !getAccessToken) return;
        setLoadingMore(true);
        try {
            const base = listParamsFromSearchParams(searchParams);
            const page = await fetchAnalyticsCallsPage(getAccessToken, {
                ...base,
                limit: 50,
                cursor: nextCursor,
            });
            setItems((prev) => [...prev, ...page.items]);
            setNextCursor(page.next_cursor);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load more";
            toast.error(msg);
        } finally {
            setLoadingMore(false);
        }
    };

    if (authLoading || !user) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
                Sign in to view call analytics.
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-4 pb-12">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <ClipboardList className="h-7 w-7 text-teal-500/90" aria-hidden />
                        Call analytics
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        Filterable calls for your organization. Open a row for outcomes, metrics, HTTP tool
                        traces (<code className="text-xs">mapped_data</code>), and QA hints — aligned with{" "}
                        <Link className="underline underline-offset-2" href="/usage">
                            Usage
                        </Link>{" "}
                        data.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => void fetchFirstPage()}
                    disabled={loading}
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-border/80 bg-card/60">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Calls in view</CardTitle>
                        <CardDescription className="text-xs">Current result page</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-semibold tabular-nums">{dashboardStats.calls}</p>
                    </CardContent>
                </Card>
                <Card className="border-border/80 bg-card/60">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Distinct tools</CardTitle>
                        <CardDescription className="text-xs">Unique tool names on this page</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-semibold tabular-nums">{dashboardStats.distinctTools}</p>
                    </CardContent>
                </Card>
                <Card className="border-border/80 bg-card/60">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">With outcome</CardTitle>
                        <CardDescription className="text-xs">Rows reporting an outcome key</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-semibold tabular-nums">{dashboardStats.withOutcome}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Filters</CardTitle>
                    <CardDescription>
                        UTC date filters use full calendar days. Match{" "}
                        <code className="text-xs">gathered_context</code> fields written by your flows (e.g.{" "}
                        <code className="text-xs">outcome_key</code>,{" "}
                        <code className="text-xs">mapped_call_disposition</code>
                        ).
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                        <Label htmlFor="wf">Workflow</Label>
                        <Select value={workflowId || "all"} onValueChange={setWorkflowId}>
                            <SelectTrigger id="wf">
                                <SelectValue placeholder="All workflows" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All workflows</SelectItem>
                                {workflows.map((w) => (
                                    <SelectItem key={w.id} value={String(w.id)}>
                                        {w.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="since">Since (UTC day)</Label>
                        <Input
                            id="since"
                            type="date"
                            value={sinceDay}
                            onChange={(e) => setSinceDay(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="until">Until (UTC day)</Label>
                        <Input
                            id="until"
                            type="date"
                            value={untilDay}
                            onChange={(e) => setUntilDay(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="disp">Disposition</Label>
                        <Input
                            id="disp"
                            placeholder="mapped_call_disposition"
                            value={disposition}
                            onChange={(e) => setDisposition(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="out">Outcome key</Label>
                        <Input
                            id="out"
                            placeholder="outcome_key or customer_outcome"
                            value={outcomeKey}
                            onChange={(e) => setOutcomeKey(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="tool">Tool name</Label>
                        <Input
                            id="tool"
                            placeholder="LLM function name (e.g. book_slot)"
                            value={toolName}
                            onChange={(e) => setToolName(e.target.value)}
                        />
                    </div>
                    <div className="flex items-end sm:col-span-2 lg:col-span-3">
                        <Button type="button" onClick={applyFilters}>
                            Apply filters
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Calls</CardTitle>
                    <CardDescription>
                        API: <code className="text-xs">GET /api/v1/analytics/calls</code> —{" "}
                        <code className="text-xs">call_id</code> is <code className="text-xs">wr-{"{run_id}"}</code>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                        <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : items.length === 0 ? (
                        <p className="text-sm text-muted-foreground" role="status">
                            No calls match these filters.
                        </p>
                    ) : (
                        <div className="rounded-md border border-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Call</TableHead>
                                        <TableHead>Workflow</TableHead>
                                        <TableHead>Started</TableHead>
                                        <TableHead>Duration</TableHead>
                                        <TableHead>Disposition</TableHead>
                                        <TableHead>Outcome</TableHead>
                                        <TableHead>Tools</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((row) => (
                                        <TableRow key={row.call_id}>
                                            <TableCell>
                                                <Link
                                                    className="font-mono text-sm text-teal-600 hover:underline dark:text-teal-400/90"
                                                    href={`/analytics/calls/${encodeURIComponent(row.call_id)}`}
                                                >
                                                    {row.call_id}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">{row.workflow_id}</div>
                                                {row.workflow_slug ? (
                                                    <Badge variant="secondary" className="mt-1 text-xs">
                                                        {row.workflow_slug}
                                                    </Badge>
                                                ) : null}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                                {new Date(row.started_at).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="tabular-nums text-sm">
                                                {formatDurationMs(row.duration_ms)}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {row.disposition ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {row.outcome_key ?? "—"}
                                            </TableCell>
                                            <TableCell className="max-w-[200px]">
                                                <div className="flex flex-wrap gap-1">
                                                    {(row.tool_names || []).map((t) => (
                                                        <Badge key={t} variant="outline" className="text-xs">
                                                            {t}
                                                        </Badge>
                                                    ))}
                                                    {(!row.tool_names || row.tool_names.length === 0) && "—"}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    {nextCursor ? (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void loadMore()}
                            disabled={loadingMore}
                        >
                            {loadingMore ? "Loading…" : "Load more"}
                        </Button>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
