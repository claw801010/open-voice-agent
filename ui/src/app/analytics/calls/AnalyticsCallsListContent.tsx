"use client";

import { ClipboardList, Download, Loader2, RefreshCw } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
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
    type AnalyticsQmExportLastRun,
    type AnalyticsQmExportScheduleSettings,
    QM_EXPORT_CRON_DISPATCH_MINUTE_UTC,
    downloadAnalyticsCallsServerExport,
    fetchAnalyticsCallsPage,
    fetchAnalyticsQmExportSchedule,
    fetchAnalyticsQmScorecard,
    previewNextQmExportDispatchUtc,
    putAnalyticsQmExportSchedule,
    putAnalyticsQmScorecard,
    type QmScorecardRubric,
} from "@/lib/analyticsCallsApi";
import { useAuth } from "@/lib/auth";
import { downloadAnalyticsCallsCsv } from "@/lib/exportAnalyticsCallsCsv";

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
        catalog_slug: sp.get("catalog_slug")?.trim() || undefined,
        catalog_variant_id: sp.get("catalog_variant_id")?.trim() || undefined,
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
    const [serverExportLoading, setServerExportLoading] = useState(false);

    const defaultQmSchedule = useMemo(
        (): AnalyticsQmExportScheduleSettings => ({
            enabled: false,
            hour_utc: 6,
            window_days: 7,
            max_rows: 5000,
            sampling_mode: 'smart',
            workflow_id: null,
            catalog_slug: null,
            catalog_variant_id: null,
        }),
        [],
    );
    const [qmDraft, setQmDraft] = useState<AnalyticsQmExportScheduleSettings>(defaultQmSchedule);
    const [qmCronEnabled, setQmCronEnabled] = useState(false);
    const [qmLastRun, setQmLastRun] = useState<AnalyticsQmExportLastRun | null>(null);
    const [qmScheduleLoading, setQmScheduleLoading] = useState(true);
    const [qmScheduleSaving, setQmScheduleSaving] = useState(false);

    const [rubricCriteria, setRubricCriteria] = useState<QmScorecardRubric['criteria']>([]);
    const [qaPromptHint, setQaPromptHint] = useState("");
    const [rubricLoading, setRubricLoading] = useState(true);
    const [rubricSaving, setRubricSaving] = useState(false);

    const [workflowId, setWorkflowId] = useState("");
    const [sinceDay, setSinceDay] = useState("");
    const [untilDay, setUntilDay] = useState("");
    const [disposition, setDisposition] = useState("");
    const [outcomeKey, setOutcomeKey] = useState("");
    const [toolName, setToolName] = useState("");
    const [catalogSlug, setCatalogSlug] = useState("");
    const [catalogVariantId, setCatalogVariantId] = useState("");

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

    const qmNextDispatchPreview = useMemo(
        () =>
            previewNextQmExportDispatchUtc({
                hourUtc: qmDraft.hour_utc,
                enabled: qmDraft.enabled,
                cronEnabled: qmCronEnabled,
            }),
        [qmDraft.hour_utc, qmDraft.enabled, qmCronEnabled],
    );

    useEffect(() => {
        setWorkflowId(searchParams.get("workflow_id") || "");
        setSinceDay(searchParams.get("since") || "");
        setUntilDay(searchParams.get("until") || "");
        setDisposition(searchParams.get("disposition") || "");
        setOutcomeKey(searchParams.get("outcome_key") || "");
        setToolName(searchParams.get("tool_name") || "");
        setCatalogSlug(searchParams.get("catalog_slug") || "");
        setCatalogVariantId(searchParams.get("catalog_variant_id") || "");
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
                include_qm_summary: true,
            });
            setItems(page.items);
            setNextCursor(page.next_cursor ?? null);
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

    useEffect(() => {
        if (authLoading || !user || !getAccessToken) return;
        let cancelled = false;
        void (async () => {
            setRubricLoading(true);
            try {
                const { scorecard, qa_prompt_hint } = await fetchAnalyticsQmScorecard(getAccessToken);
                if (!cancelled) {
                    setRubricCriteria(scorecard.criteria ?? []);
                    setQaPromptHint(qa_prompt_hint ?? "");
                }
            } catch {
                if (!cancelled) setRubricCriteria([]);
            } finally {
                if (!cancelled) setRubricLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [authLoading, user?.id, getAccessToken]);

    useEffect(() => {
        if (authLoading || !user || !getAccessToken) return;
        let cancelled = false;
        void (async () => {
            setQmScheduleLoading(true);
            try {
                const data = await fetchAnalyticsQmExportSchedule(getAccessToken);
                if (cancelled) return;
                setQmDraft(data.schedule);
                setQmCronEnabled(data.cron_enabled);
                setQmLastRun(data.last_run);
            } catch {
                if (!cancelled) toast.error("Could not load QM export schedule");
            } finally {
                if (!cancelled) setQmScheduleLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [authLoading, user, getAccessToken]);

    const applyFilters = () => {
        const q = new URLSearchParams();
        if (workflowId && workflowId !== "all") q.set("workflow_id", workflowId);
        if (catalogSlug.trim()) q.set("catalog_slug", catalogSlug.trim());
        if (catalogVariantId.trim()) q.set("catalog_variant_id", catalogVariantId.trim());
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
                include_qm_summary: true,
            });
            setItems((prev) => [...prev, ...page.items]);
            setNextCursor(page.next_cursor ?? null);
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
        <div className="space-y-6 pb-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <ClipboardList className="h-7 w-7 text-teal-500/90" aria-hidden />
                        Call list
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
                <div className="flex flex-wrap gap-2">
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
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={loading || items.length === 0}
                        title={
                            items.length === 0
                                ? "Load calls first"
                                : "Download CSV for rows loaded below (use Load more to add pages)"
                        }
                        onClick={() => {
                            if (items.length === 0) return;
                            downloadAnalyticsCallsCsv(items);
                            toast.success(`Exported ${items.length} row(s) to CSV.`);
                        }}
                    >
                        <Download className="h-4 w-4" />
                        Export CSV (page)
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={loading || serverExportLoading || !getAccessToken}
                        title="Server-side CSV with current filters (up to 5,000 rows); uses same filters as the list"
                        onClick={() => {
                            if (!getAccessToken) return;
                            setServerExportLoading(true);
                            void (async () => {
                                try {
                                    const base = listParamsFromSearchParams(searchParams);
                                    await downloadAnalyticsCallsServerExport(getAccessToken, {
                                        ...base,
                                        max_rows: 5000,
                                        sampling_mode: 'smart',
                                    });
                                    toast.success("Download started (server export, up to 5,000 rows).");
                                } catch (e) {
                                    const msg =
                                        e instanceof Error ? e.message : "Server export failed";
                                    toast.error(msg);
                                } finally {
                                    setServerExportLoading(false);
                                }
                            })();
                        }}
                    >
                        {serverExportLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        Export CSV (server)
                    </Button>
                </div>
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

            <Card className="border-border/80 bg-card/60">
                <CardHeader>
                    <CardTitle className="text-base">QM scorecard rubric</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                        Criteria shown as pass/fail on each call detail when your QA node returns a{' '}
                        <code className="text-[11px]">criteria</code> array in its JSON response.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {rubricLoading ? (
                        <p className="text-sm text-muted-foreground">Loading rubric…</p>
                    ) : (
                        <>
                            {qaPromptHint ? (
                                <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
                                    <p className="font-medium text-foreground/90">QA prompt hint</p>
                                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                                        {qaPromptHint}
                                    </p>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        className="mt-2"
                                        onClick={() => {
                                            void navigator.clipboard.writeText(qaPromptHint);
                                            toast.success('Copied QA prompt hint.');
                                        }}
                                    >
                                        Copy for QA node
                                    </Button>
                                </div>
                            ) : null}
                            <ul className="space-y-2">
                                {rubricCriteria.map((c, i) => (
                                    <li
                                        key={`${c.id}-${i}`}
                                        className="grid gap-2 rounded-md border border-border/60 p-2 sm:grid-cols-2"
                                    >
                                        <Input
                                            placeholder="criterion_id"
                                            value={c.id}
                                            className="font-mono text-xs"
                                            onChange={(e) => {
                                                const id = e.target.value;
                                                setRubricCriteria((prev) =>
                                                    prev.map((row, j) => (j === i ? { ...row, id } : row)),
                                                );
                                            }}
                                        />
                                        <Input
                                            placeholder="Label"
                                            value={c.label}
                                            onChange={(e) => {
                                                const label = e.target.value;
                                                setRubricCriteria((prev) =>
                                                    prev.map((row, j) => (j === i ? { ...row, label } : row)),
                                                );
                                            }}
                                        />
                                    </li>
                                ))}
                            </ul>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        setRubricCriteria((prev) => [
                                            ...prev,
                                            { id: `criterion_${prev.length + 1}`, label: 'New criterion' },
                                        ])
                                    }
                                >
                                    Add criterion
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={rubricSaving || rubricCriteria.length === 0}
                                    onClick={() => {
                                        if (!getAccessToken) return;
                                        setRubricSaving(true);
                                        void (async () => {
                                            try {
                                                const saved = await putAnalyticsQmScorecard(
                                                    getAccessToken,
                                                    rubricCriteria.filter(
                                                        (c) => c.id.trim() && c.label.trim(),
                                                    ),
                                                );
                                                setRubricCriteria(saved.scorecard.criteria);
                                                setQaPromptHint(saved.qa_prompt_hint ?? "");
                                                toast.success('QM scorecard rubric saved.');
                                            } catch (e) {
                                                toast.error(
                                                    e instanceof Error ? e.message : 'Could not save rubric',
                                                );
                                            } finally {
                                                setRubricSaving(false);
                                            }
                                        })();
                                    }}
                                >
                                    {rubricSaving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        'Save rubric'
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/60">
                <CardHeader>
                    <CardTitle className="text-base">Scheduled QM export</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                        Writes the same CSV columns as <strong>Export CSV (server)</strong> to your deployment&apos;s
                        object storage when workers run the hourly job. Requires{" "}
                        <code className="text-[11px]">ENABLE_ANALYTICS_QM_EXPORT_CRON=true</code> on the API worker.
                        {qmScheduleLoading ? null : qmCronEnabled ? (
                            <span className="mt-1 block text-emerald-600 dark:text-emerald-400">
                                Cron dispatch is enabled on this deployment (UTC minute ~:47 each hour).
                            </span>
                        ) : (
                            <span className="mt-1 block text-amber-700 dark:text-amber-400">
                                Cron dispatch is off — schedule is saved but automatic uploads will not run until ops
                                enables the env flag.
                            </span>
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {qmScheduleLoading ? (
                        <p className="text-sm text-muted-foreground">Loading schedule…</p>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                                <div className="space-y-0.5">
                                    <Label htmlFor="qm-export-enabled" className="text-sm font-medium">
                                        Enable scheduled upload
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Runs only in the UTC hour you choose (see below).
                                    </p>
                                </div>
                                <Switch
                                    id="qm-export-enabled"
                                    checked={qmDraft.enabled}
                                    onCheckedChange={(v) => setQmDraft((d) => ({ ...d, enabled: v }))}
                                />
                            </div>
                            {qmNextDispatchPreview ? (
                                <div className="rounded-md border border-border/50 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">Next dispatch</span>
                                    {": "}
                                    <span className="font-mono text-[11px] text-foreground">
                                        {new Date(qmNextDispatchPreview).toLocaleString(undefined, {
                                            timeZone: "UTC",
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                        })}{" "}
                                        UTC
                                    </span>
                                    <span className="mt-1 block">
                                        Hourly worker fires at minute{" "}
                                        {String(QM_EXPORT_CRON_DISPATCH_MINUTE_UTC).padStart(2, "0")} past your
                                        chosen UTC hour.
                                    </span>
                                </div>
                            ) : null}
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="qm-hour-utc">UTC hour (0–23)</Label>
                                    <Select
                                        value={String(qmDraft.hour_utc)}
                                        onValueChange={(v) =>
                                            setQmDraft((d) => ({ ...d, hour_utc: Number.parseInt(v, 10) }))
                                        }
                                    >
                                        <SelectTrigger id="qm-hour-utc">
                                            <SelectValue placeholder="Hour" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60">
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <SelectItem key={i} value={String(i)}>
                                                    {String(i).padStart(2, "0")}:00 UTC
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="qm-window-days">Rolling window (days)</Label>
                                    <Input
                                        id="qm-window-days"
                                        type="number"
                                        min={1}
                                        max={366}
                                        value={qmDraft.window_days}
                                        onChange={(e) => {
                                            const n = Number.parseInt(e.target.value, 10);
                                            setQmDraft((d) => ({
                                                ...d,
                                                window_days: Number.isFinite(n)
                                                    ? Math.min(366, Math.max(1, n))
                                                    : d.window_days,
                                            }));
                                        }}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="qm-max-rows">Max rows</Label>
                                    <Input
                                        id="qm-max-rows"
                                        type="number"
                                        min={1}
                                        max={10000}
                                        value={qmDraft.max_rows}
                                        onChange={(e) => {
                                            const n = Number.parseInt(e.target.value, 10);
                                            setQmDraft((d) => ({
                                                ...d,
                                                max_rows: Number.isFinite(n)
                                                    ? Math.min(10000, Math.max(1, n))
                                                    : d.max_rows,
                                            }));
                                        }}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="qm-sampling">Export sampling</Label>
                                    <Select
                                        value={qmDraft.sampling_mode ?? 'smart'}
                                        onValueChange={(v) =>
                                            setQmDraft((d) => ({
                                                ...d,
                                                sampling_mode: v as 'fifo' | 'smart',
                                            }))
                                        }
                                    >
                                        <SelectTrigger id="qm-sampling">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="smart">Smart — escalations & failed tools</SelectItem>
                                            <SelectItem value="fifo">FIFO — newest first</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label htmlFor="qm-workflow-id">Workflow id (optional)</Label>
                                    <Input
                                        id="qm-workflow-id"
                                        inputMode="numeric"
                                        placeholder="All workflows"
                                        value={qmDraft.workflow_id ?? ""}
                                        onChange={(e) => {
                                            const t = e.target.value.trim();
                                            if (t === "") {
                                                setQmDraft((d) => ({ ...d, workflow_id: null }));
                                                return;
                                            }
                                            const n = Number.parseInt(t, 10);
                                            setQmDraft((d) => ({
                                                ...d,
                                                workflow_id: Number.isFinite(n) ? n : null,
                                            }));
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="qm-catalog-slug">Catalog slug (optional)</Label>
                                    <Input
                                        id="qm-catalog-slug"
                                        placeholder="e.g. healthcare-clinic-screening"
                                        value={qmDraft.catalog_slug ?? ""}
                                        onChange={(e) =>
                                            setQmDraft((d) => ({
                                                ...d,
                                                catalog_slug: e.target.value.trim() || null,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="qm-catalog-variant">Catalog variant id (optional)</Label>
                                    <Input
                                        id="qm-catalog-variant"
                                        placeholder="e.g. booking_complex"
                                        value={qmDraft.catalog_variant_id ?? ""}
                                        onChange={(e) =>
                                            setQmDraft((d) => ({
                                                ...d,
                                                catalog_variant_id: e.target.value.trim() || null,
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={qmScheduleSaving || !getAccessToken}
                                    onClick={() => {
                                        if (!getAccessToken) return;
                                        setQmScheduleSaving(true);
                                        void (async () => {
                                            try {
                                                const saved = await putAnalyticsQmExportSchedule(
                                                    getAccessToken,
                                                    qmDraft,
                                                );
                                                setQmDraft(saved.schedule);
                                                setQmCronEnabled(saved.cron_enabled);
                                                setQmLastRun(saved.last_run);
                                                toast.success("QM export schedule saved.");
                                            } catch (e) {
                                                const msg =
                                                    e instanceof Error ? e.message : "Could not save schedule";
                                                toast.error(msg);
                                            } finally {
                                                setQmScheduleSaving(false);
                                            }
                                        })();
                                    }}
                                >
                                    {qmScheduleSaving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving…
                                        </>
                                    ) : (
                                        "Save schedule"
                                    )}
                                </Button>
                            </div>
                            {qmLastRun?.finished_at ? (
                                <div className="rounded-md border border-border/60 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
                                    <p className="font-medium text-foreground">Last run</p>
                                    <p className="mt-1">
                                        Status:{" "}
                                        <span className="text-foreground">{qmLastRun.status ?? "—"}</span>
                                        {" · "}
                                        Finished:{" "}
                                        <span className="font-mono text-[11px] text-foreground">
                                            {qmLastRun.finished_at}
                                        </span>
                                    </p>
                                    {qmLastRun.object_key ? (
                                        <p className="mt-1 break-all font-mono text-[11px]">{qmLastRun.object_key}</p>
                                    ) : null}
                                    {qmLastRun.error_message ? (
                                        <p className="mt-1 text-destructive">{qmLastRun.error_message}</p>
                                    ) : null}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    No completed upload yet — after the worker runs, status and object key appear here.
                                </p>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

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
                        <Label htmlFor="catalog-slug">Vertical (catalog slug)</Label>
                        <Input
                            id="catalog-slug"
                            placeholder="mk01.catalog_slug, e.g. healthcare-clinic-screening"
                            value={catalogSlug}
                            onChange={(e) => setCatalogSlug(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="catalog-variant">Graph variant (optional)</Label>
                        <Input
                            id="catalog-variant"
                            placeholder="mk01.catalog_variant_id — e.g. simple, booking_complex"
                            value={catalogVariantId}
                            onChange={(e) => setCatalogVariantId(e.target.value)}
                        />
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
                                        <TableHead>Variant</TableHead>
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
                                            <TableCell className="text-sm">
                                                {row.catalog_variant_id ? (
                                                    <Badge variant="outline" className="font-mono text-xs">
                                                        {row.catalog_variant_id}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
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
