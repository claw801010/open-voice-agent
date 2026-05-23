"use client";

import {
    BarChart2,
    Gauge,
    HardDrive,
    LayoutGrid,
    Link2,
    ListOrdered,
    Plus,
    RefreshCw,
    RotateCcw,
    ShieldCheck,
    TrendingUp,
    Wrench,
    X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    addWidgetToLayout,
    defaultWidgetLayout,
    getAvailableToAdd,
    isGenericDefaultWidgetLayout,
    loadDashboardLayout,
    parseDashboardLayoutPayload,
    removeWidgetById,
    saveDashboardLayout,
    widgetPresetForCatalogSlug,
    widgetTypeOrderEquals,
    WIDGET_META,
    type AnalyticsDashboardWidget,
    type AnalyticsWidgetType,
} from "@/lib/analyticsDashboardLayout";
import {
    fetchAnalyticsDashboardLayout,
    fetchAnalyticsInsights,
    fetchAnalyticsRedactionPolicy,
    putAnalyticsDashboardLayout,
    putAnalyticsRedactionPolicy,
    type AnalyticsInsights,
} from "@/lib/analyticsCallsApi";
import {
    buildAnalyticsCallsExploreHref,
    buildAnalyticsCallsOutcomeExploreHref,
} from "@/lib/analyticsOverviewDeepLinks";
import { verticalHttpProofHintForSlug } from "@/lib/analyticsVerticalHttpHints";
import { formatHttpCacheHitRate } from "@/lib/httpCacheInsights";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Canonical slugs from catalog/vertical-packs.json — align MK-01 install `catalog_slug` when publishing. */
const VERTICAL_PREBUILD_SLUGS: { slug: string; label: string }[] = [
    { slug: "healthcare-clinic-screening", label: "Healthcare — screening / triage" },
    { slug: "retail-wismo-faq", label: "Retail — WISMO / FAQ" },
    { slug: "b2b-saas-trial-nurture", label: "B2B SaaS — trial nurture" },
];

function WidgetChrome({
    title,
    description,
    onRemove,
    children,
}: {
    title: string;
    description?: string;
    onRemove: () => void;
    children: React.ReactNode;
}) {
    return (
        <Card className="relative border-border/80">
            <div className="absolute right-2 top-2 z-10">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={onRemove}
                    title="Remove widget from this layout"
                    aria-label="Remove widget"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
            <CardHeader className="pr-12">
                <CardTitle className="text-base">{title}</CardTitle>
                {description ? <CardDescription>{description}</CardDescription> : null}
            </CardHeader>
            <CardContent className="space-y-3">{children}</CardContent>
        </Card>
    );
}

export function AnalyticsDashboardClient() {
    const idDays = useId();
    const idSlug = useId();
    const idVariant = useId();
    const idRedaction = useId();
    const searchParams = useSearchParams();
    const { user, loading: authLoading, getAccessToken } = useAuth();

    const [days, setDays] = useState(7);
    const [catalogSlug, setCatalogSlug] = useState("");
    const [catalogVariantId, setCatalogVariantId] = useState("");
    const [data, setData] = useState<AnalyticsInsights | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [widgets, setWidgets] = useState<AnalyticsDashboardWidget[]>([]);
    const [layoutHydrated, setLayoutHydrated] = useState(false);
    const [addType, setAddType] = useState<AnalyticsWidgetType | "">("");
    const [redactionEnabled, setRedactionEnabled] = useState<boolean | null>(null);
    const [mayDisableRedaction, setMayDisableRedaction] = useState<boolean | null>(null);
    const [redactionSaving, setRedactionSaving] = useState(false);
    const [confirmDisableRedaction, setConfirmDisableRedaction] = useState(false);
    const urlSyncReady = useRef(false);

    useEffect(() => {
        if (authLoading || !user || !getAccessToken) return;
        let cancelled = false;
        setLayoutHydrated(false);
        void (async () => {
            try {
                const raw = await fetchAnalyticsDashboardLayout(getAccessToken);
                const parsed = raw ? parseDashboardLayoutPayload(raw) : null;
                if (!cancelled) {
                    setWidgets(parsed ?? loadDashboardLayout());
                }
            } catch {
                if (!cancelled) {
                    setWidgets(loadDashboardLayout());
                }
            } finally {
                if (!cancelled) {
                    setLayoutHydrated(true);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [authLoading, user?.id, getAccessToken]);

    /** Known vertical in URL + generic default board → vertical preset (does not override customized layouts). */
    useEffect(() => {
        if (!layoutHydrated || !catalogSlug.trim()) return;
        const preset = widgetPresetForCatalogSlug(catalogSlug.trim());
        if (!preset) return;
        setWidgets((prev) => {
            if (!isGenericDefaultWidgetLayout(prev)) return prev;
            if (widgetTypeOrderEquals(prev, preset)) return prev;
            saveDashboardLayout(preset);
            toast.info("Applied vertical dashboard layout for this catalog link.");
            return preset;
        });
    }, [layoutHydrated, catalogSlug]);

    useEffect(() => {
        if (authLoading || !user || !getAccessToken) return;
        let cancelled = false;
        void (async () => {
            try {
                const p = await fetchAnalyticsRedactionPolicy(getAccessToken);
                if (!cancelled) {
                    setRedactionEnabled(p.detail_redaction_enabled);
                    setMayDisableRedaction(p.may_disable_detail_redaction !== false);
                }
            } catch {
                if (!cancelled) {
                    setRedactionEnabled(true);
                    setMayDisableRedaction(true);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [authLoading, user?.id, getAccessToken]);

    const persistRedactionPolicy = useCallback(
        async (enabled: boolean) => {
            if (!getAccessToken) return;
            setRedactionSaving(true);
            try {
                const updated = await putAnalyticsRedactionPolicy(getAccessToken, {
                    detail_redaction_enabled: enabled,
                });
                setRedactionEnabled(enabled);
                if (updated.may_disable_detail_redaction !== undefined) {
                    setMayDisableRedaction(updated.may_disable_detail_redaction !== false);
                }
                toast.success(
                    enabled
                        ? "PII redaction enabled for call detail and server CSV."
                        : "PII redaction disabled for this organization.",
                );
            } catch (e) {
                const msg = e instanceof Error ? e.message : "Could not update redaction policy";
                toast.error(msg);
            } finally {
                setRedactionSaving(false);
            }
        },
        [getAccessToken],
    );

    useEffect(() => {
        if (!layoutHydrated || !user || !getAccessToken) return;
        saveDashboardLayout(widgets);
        const t = setTimeout(() => {
            void putAnalyticsDashboardLayout(getAccessToken, {
                v: 1,
                widgets: widgets.map((w) => ({ id: w.id, type: w.type })),
            }).catch((e) => {
                console.error(e);
                toast.error("Could not save dashboard layout to your organization.");
            });
        }, 600);
        return () => clearTimeout(t);
    }, [widgets, layoutHydrated, user, getAccessToken]);

    useEffect(() => {
        const d = searchParams.get("days");
        if (d) {
            const n = parseInt(d, 10);
            if (Number.isFinite(n) && n >= 1 && n <= 366) setDays(n);
        } else {
            setDays(7);
        }
        const c = searchParams.get("catalog_slug");
        setCatalogSlug(c != null && c.length > 0 ? c : "");
        const cv = searchParams.get("catalog_variant_id");
        setCatalogVariantId(cv != null && cv.length > 0 ? cv : "");
        urlSyncReady.current = true;
    }, [searchParams]);

    useEffect(() => {
        if (typeof window === "undefined" || !urlSyncReady.current) return;
        const p = new URLSearchParams();
        if (days !== 7) p.set("days", String(days));
        if (catalogSlug.trim()) p.set("catalog_slug", catalogSlug.trim());
        if (catalogVariantId.trim()) p.set("catalog_variant_id", catalogVariantId.trim());
        const qs = p.toString();
        const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
        if (next === `${window.location.pathname}${window.location.search}`) return;
        window.history.replaceState(null, "", next);
    }, [days, catalogSlug, catalogVariantId]);

    const load = useCallback(async () => {
        if (!getAccessToken) return;
        setLoading(true);
        setErr(null);
        try {
            const d = await fetchAnalyticsInsights(getAccessToken, {
                days,
                catalog_slug: catalogSlug.trim() || undefined,
                catalog_variant_id: catalogVariantId.trim() || undefined,
            });
            setData(d);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load insights";
            setErr(msg);
            setData(null);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [getAccessToken, days, catalogSlug, catalogVariantId]);

    useEffect(() => {
        if (authLoading || !user) return;
        void load();
    }, [authLoading, user, load]);

    const addWidget = () => {
        if (!addType) {
            toast.info("Choose a widget type to add.");
            return;
        }
        setWidgets((prev) => {
            const next = addWidgetToLayout(prev, addType);
            if (next.length === prev.length) {
                toast.info("That widget is already on the board.");
            } else {
                toast.success("Widget added.");
            }
            return next;
        });
        setAddType("");
    };

    const resetLayout = () => {
        const next = defaultWidgetLayout();
        setWidgets(next);
        saveDashboardLayout(next);
        toast.success("Restored default dashboard layout.");
        if (!getAccessToken) return;
        void putAnalyticsDashboardLayout(getAccessToken, {
            v: 1,
            widgets: next.map((w) => ({ id: w.id, type: w.type })),
        }).catch((e) => {
            console.error(e);
            toast.error("Could not sync default layout to your organization.");
        });
    };

    const applyVerticalPreset = () => {
        const next = widgetPresetForCatalogSlug(catalogSlug);
        if (!next || next.length === 0) {
            toast.info("Enter a known vertical slug (e.g. from Template catalog) or pick one from Vertical shortcuts.");
            return;
        }
        setWidgets(next);
        saveDashboardLayout(next);
        toast.success("Applied vertical widget order (booking & revenue up).");
        if (!getAccessToken) return;
        void putAnalyticsDashboardLayout(getAccessToken, {
            v: 1,
            widgets: next.map((w) => ({ id: w.id, type: w.type })),
        }).catch((e) => {
            console.error(e);
            toast.error("Could not save layout to your organization.");
        });
    };

    if (authLoading || !user) {
        return (
            <p className="min-h-[30vh] text-sm text-muted-foreground">
                Sign in to view org analytics and rollups.
            </p>
        );
    }

    const available = getAvailableToAdd(widgets);

    const renderWidget = (w: AnalyticsDashboardWidget) => {
        const onRemove = () => setWidgets((prev) => removeWidgetById(prev, w.id));
        const meta = WIDGET_META[w.type];

        switch (w.type) {
            case "kpi_row":
                return (
                    <WidgetChrome title={meta.title} description={meta.description} onRemove={onRemove}>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <Card>
                                <CardHeader className="space-y-1">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <TrendingUp className="h-4 w-4" />
                                        <CardDescription>Total calls</CardDescription>
                                    </div>
                                    <CardTitle className="text-2xl tabular-nums">
                                        {loading ? "—" : data?.total_calls ?? 0}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0 text-xs text-muted-foreground">
                                    Workflow runs in range (and vertical slug when set).
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="space-y-1">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <ListOrdered className="h-4 w-4" />
                                        <CardDescription>With outcome</CardDescription>
                                    </div>
                                    <CardTitle className="text-2xl tabular-nums">
                                        {loading ? "—" : data?.calls_with_outcome ?? 0}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0 text-xs text-muted-foreground">
                                    <code className="text-[11px]">outcome_key</code> or{" "}
                                    <code className="text-[11px]">customer_outcome</code> in{" "}
                                    <code className="text-[11px]">gathered_context</code>.
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="space-y-1">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Wrench className="h-4 w-4" />
                                        <CardDescription>With tool evidence</CardDescription>
                                    </div>
                                    <CardTitle className="text-2xl tabular-nums">
                                        {loading
                                            ? "—"
                                            : (data?.calls_with_tool_evidence ??
                                                  data?.calls_with_logged_tools) ??
                                              0}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0 text-xs text-muted-foreground">
                                    Trace in run logs (
                                    <code className="text-[11px]">rtf-function-call-end</code>) or
                                    persisted span rows (
                                    <code className="text-[11px]">analytics_http_tool_spans</code>).
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="space-y-1">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <BarChart2 className="h-4 w-4" />
                                        <CardDescription>Outcome share</CardDescription>
                                    </div>
                                    <CardTitle className="text-base font-medium">
                                        {data && !loading && data.total_calls > 0
                                            ? `${((data.calls_with_outcome / data.total_calls) * 100).toFixed(0)}%`
                                            : "—"}{" "}
                                        <span className="text-sm font-normal text-muted-foreground">
                                            with a recorded key
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                            </Card>
                        </div>
                        {!loading && data && (data.http_tool_invocations ?? 0) > 0 ? (
                            <div className="rounded-md border border-border/80 bg-muted/15 px-3 py-2 text-sm">
                                <p className="flex items-center gap-2 text-xs font-medium text-foreground/90">
                                    <HardDrive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    HTTP integration cache
                                </p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    Cache hits in this window:{" "}
                                    <span className="tabular-nums font-medium text-foreground/90">
                                        {formatHttpCacheHitRate(
                                            data.http_tool_invocations,
                                            data.http_tool_cache_hits,
                                        )}
                                    </span>
                                    . Enable under{" "}
                                    <Link href="/settings" className="underline underline-offset-2">
                                        Settings → HTTP integration cache
                                    </Link>
                                    ; per-tool mode{" "}
                                    <code className="text-[11px]">Use organization HTTP cache policy when enabled</code>.
                                </p>
                            </div>
                        ) : null}
                        {!loading && data && (data.tool_name_mix ?? []).length > 0 ? (
                            <div className="rounded-md border border-border/80 bg-muted/15 px-3 py-2 text-sm">
                                <p className="text-xs font-medium text-foreground/90">Top tools by call</p>
                                <p className="text-[11px] text-muted-foreground">
                                    Click a tool to open the call list with{" "}
                                    <code className="text-[11px]">tool_name</code> and the same catalog / date window.
                                </p>
                                <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                    {(data.tool_name_mix ?? []).slice(0, 8).map((row, i) => (
                                        <li key={`${row.tool_name}-${i}`}>
                                            <Link
                                                href={buildAnalyticsCallsExploreHref({
                                                    toolName: row.tool_name,
                                                    catalogSlug: catalogSlug.trim() || undefined,
                                                    catalogVariantId: catalogVariantId.trim() || undefined,
                                                    insightsSinceIso: data.since,
                                                    insightsUntilIso: data.until,
                                                })}
                                                className="inline-flex items-baseline gap-0.5 rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                <span className="font-mono text-foreground/90">{row.tool_name}</span>
                                                <span className="tabular-nums text-muted-foreground">
                                                    ({row.count})
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        ) : null}
                    </WidgetChrome>
                );
            case "quality_rollup": {
                const qs = data?.quality_summary;
                const maxContainment = Math.max(
                    1,
                    ...(qs?.containment_mix ?? []).map((r) => r.count),
                );
                return (
                    <WidgetChrome title={meta.title} description={meta.description} onRemove={onRemove}>
                        {loading ? (
                            <p className="text-sm text-muted-foreground">Loading…</p>
                        ) : !qs || qs.sampled_calls === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No calls in this window to score yet. Run a Web test or production call with logs.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {qs.sample_capped ? (
                                    <p className="text-xs text-amber-700 dark:text-amber-400">
                                        Quality metrics computed on the most recent {qs.sampled_calls} of{" "}
                                        {data?.total_calls ?? qs.sampled_calls} calls (performance cap).
                                    </p>
                                ) : null}
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Gauge className="h-3.5 w-3.5" />
                                            Avg CX
                                        </div>
                                        <p className="mt-1 text-2xl font-semibold tabular-nums">
                                            {qs.avg_cx_score != null ? qs.avg_cx_score : "—"}
                                            <span className="text-sm font-normal text-muted-foreground"> / 100</span>
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <ShieldCheck className="h-3.5 w-3.5" />
                                            Tool success
                                        </div>
                                        <p className="mt-1 text-2xl font-semibold tabular-nums">
                                            {qs.avg_tool_success_rate != null
                                                ? `${Math.round(qs.avg_tool_success_rate * 100)}%`
                                                : "—"}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                                        <p className="text-xs text-muted-foreground">Calls with QA</p>
                                        <p className="mt-1 text-2xl font-semibold tabular-nums">{qs.calls_with_qa}</p>
                                        {qs.avg_qa_score != null ? (
                                            <p className="text-xs text-muted-foreground">
                                                Avg QA {qs.avg_qa_score}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                                        <p className="text-xs text-muted-foreground">Sampled</p>
                                        <p className="mt-1 text-2xl font-semibold tabular-nums">{qs.sampled_calls}</p>
                                    </div>
                                </div>
                                {(qs.containment_mix?.length ?? 0) > 0 ? (
                                    <div>
                                        <p className="mb-2 text-xs font-medium text-foreground/90">Containment</p>
                                        <ul className="space-y-2">
                                            {(qs.containment_mix ?? []).map((row) => (
                                                <li key={row.containment}>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="capitalize text-foreground/90">
                                                            {row.containment}
                                                        </span>
                                                        <span className="tabular-nums text-muted-foreground">
                                                            {row.count}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                                                        <div
                                                            className="h-full rounded-full bg-teal-600/80"
                                                            style={{
                                                                width: `${(row.count / maxContainment) * 100}%`,
                                                            }}
                                                        />
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}
                                {(qs.tool_health ?? []).length > 0 ? (
                                    <div>
                                        <p className="mb-2 text-xs font-medium text-foreground/90">
                                            Tool functions (lowest success first)
                                        </p>
                                        <div className="overflow-x-auto rounded-md border border-border">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-border bg-muted/30 text-left text-muted-foreground">
                                                        <th className="px-2 py-1.5 font-medium">Function</th>
                                                        <th className="px-2 py-1.5 font-medium">Calls</th>
                                                        <th className="px-2 py-1.5 font-medium">Success</th>
                                                        <th className="px-2 py-1.5 font-medium">Failed</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(qs.tool_health ?? []).slice(0, 8).map((row) => (
                                                        <tr
                                                            key={row.function_name}
                                                            className="border-b border-border/60 last:border-0"
                                                        >
                                                            <td className="px-2 py-1.5 font-mono">{row.function_name}</td>
                                                            <td className="px-2 py-1.5 tabular-nums">{row.invocation_count}</td>
                                                            <td className="px-2 py-1.5 tabular-nums">
                                                                {Math.round(row.success_rate * 100)}%
                                                            </td>
                                                            <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                                                                {row.failed_invocations}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <p className="mt-2 text-[11px] text-muted-foreground">
                                            Open a call from{" "}
                                            <Link href="/analytics/calls" className="underline underline-offset-2">
                                                Call list
                                            </Link>{" "}
                                            for per-call trace, HTTP send/receive, and LLM latency.
                                        </p>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </WidgetChrome>
                );
            }
            case "outcome_top":
                return (
                    <WidgetChrome title={meta.title} description={meta.description} onRemove={onRemove}>
                        {loading ? (
                            <p className="text-sm text-muted-foreground">Loading…</p>
                        ) : !data || (data.outcome_mix?.length ?? 0) === 0 ? (
                            <p className="text-sm text-muted-foreground">No outcome data in this window yet.</p>
                        ) : (
                            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                                {(data.outcome_mix ?? []).map((row, i) => {
                                    const explore = buildAnalyticsCallsOutcomeExploreHref({
                                        outcomeLabel: row.outcome,
                                        catalogSlug: catalogSlug.trim() || undefined,
                                        catalogVariantId: catalogVariantId.trim() || undefined,
                                        insightsSinceIso: data.since,
                                        insightsUntilIso: data.until,
                                    });
                                    return (
                                        <li key={`${i}-${row.outcome}`} className="pl-0.5">
                                            {explore ? (
                                                <Link
                                                    href={explore}
                                                    className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                                                >
                                                    <span className="font-medium text-foreground">{row.outcome}</span>
                                                    <span className="ml-1.5 tabular-nums text-muted-foreground">
                                                        ({row.count})
                                                    </span>
                                                </Link>
                                            ) : (
                                                <>
                                                    <span className="font-medium text-foreground">{row.outcome}</span>
                                                    <span className="ml-1.5 tabular-nums text-muted-foreground">
                                                        ({row.count})
                                                    </span>
                                                </>
                                            )}
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </WidgetChrome>
                );
            case "dive_deeper":
                return (
                    <WidgetChrome title={meta.title} description={meta.description} onRemove={onRemove}>
                        <p className="text-sm">
                            <Link2 className="mb-0.5 mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
                            <code className="text-xs">GET /api/v1/analytics/insights</code> — rollups for this page.
                        </p>
                        <p className="text-sm">
                            <Link2 className="mb-0.5 mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
                            <code className="text-xs">GET /api/v1/analytics/calls</code> and{" "}
                            <code className="text-xs">GET /api/v1/analytics/calls/{"{call_id}"}</code> — per-call
                            metrics and HTTP <code className="text-xs">mapped_data</code> traces.
                        </p>
                        <p>
                            <Button type="button" size="sm" variant="secondary" asChild>
                                <Link href="/analytics/calls">Open call list</Link>
                            </Button>{" "}
                            <span className="text-muted-foreground">— export loaded rows to CSV for QM.</span>
                        </p>
                    </WidgetChrome>
                );
            case "vertical_shortcuts": {
                const qBase = (slug: string) => {
                    const p = new URLSearchParams();
                    p.set("days", String(days));
                    p.set("catalog_slug", slug);
                    return p.toString();
                };
                const listQ = (slug: string) => {
                    const p = new URLSearchParams();
                    p.set("catalog_slug", slug);
                    return p.toString();
                };
                return (
                    <WidgetChrome title={meta.title} description={meta.description} onRemove={onRemove}>
                        <p className="text-xs text-muted-foreground">
                            Use the same <code className="text-[11px]">catalog_slug</code> you set in{" "}
                            <code className="text-[11px]">workflow_configurations.mk01</code> after installing from the
                            template catalog.
                        </p>
                        <ul className="space-y-2 text-sm">
                            {VERTICAL_PREBUILD_SLUGS.map((v) => (
                                <li
                                    key={v.slug}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/20 px-2 py-1.5"
                                >
                                    <span className="font-medium text-foreground">{v.label}</span>
                                    <span className="flex flex-wrap gap-1">
                                        <Button size="sm" variant="outline" asChild>
                                            <Link href={`/analytics?${qBase(v.slug)}`}>Insights</Link>
                                        </Button>
                                        <Button size="sm" variant="outline" asChild>
                                            <Link href={`/analytics/calls?${listQ(v.slug)}`}>Calls</Link>
                                        </Button>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </WidgetChrome>
                );
            }
            case "revenue_motions": {
                const httpHint = verticalHttpProofHintForSlug(catalogSlug);
                return (
                    <WidgetChrome title={meta.title} description={meta.description} onRemove={onRemove}>
                        <p className="text-xs text-muted-foreground">
                            See <span className="font-medium">PREBUILD_VERTICAL_ROADMAP</span> for what is shipped vs
                            roadmap. Booking is the next spine across verticals; these motions map to how buyers pay.
                        </p>
                        <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">
                            <li>
                                <span className="text-foreground">Scheduling / booking</span> — primary evaluation path
                                (stubs in catalog until HTTP spine ships).
                            </li>
                            <li>
                                <span className="text-foreground">Conversion / upsell, renewals</span> — B2B + retail
                                LTV; align <code className="text-[11px]">outcome_key</code> in flows.
                            </li>
                            <li>
                                <span className="text-foreground">No-show / confirm</span> — healthcare + retail
                                utilization; use tool traces to prove API outcomes.
                            </li>
                        </ul>
                        {httpHint ? (
                            <div className="rounded-md border border-border/80 bg-muted/25 p-2 text-xs">
                                <p className="font-medium text-foreground">HTTP proof for this vertical (conventions)</p>
                                <p className="mt-1 text-muted-foreground">
                                    KPI row / top outcomes use <code className="text-[11px]">gathered_context</code>{" "}
                                    (<code className="text-[11px]">outcome_key</code>). Call detail + CSV carry HTTP{" "}
                                    <code className="text-[11px]">mapped_data</code> from your tool&apos;s{" "}
                                    <code className="text-[11px]">response_mapping</code>.
                                </p>
                                <p className="mt-1.5 text-muted-foreground">
                                    <span className="text-foreground/90">Example tools:</span>{" "}
                                    {httpHint.example_tool_names.map((n) => (
                                        <code key={n} className="mr-1 text-[11px]">
                                            {n}
                                        </code>
                                    ))}
                                </p>
                                <p className="mt-1 text-muted-foreground">
                                    <span className="text-foreground/90">Suggested mapping keys → </span>
                                    <code className="text-[11px]">mapped_data</code>
                                    <span className="text-foreground/90">:</span>{" "}
                                    {httpHint.suggested_response_mapping_keys.map((k) => (
                                        <code key={k} className="mr-1 text-[11px]">
                                            {k}
                                        </code>
                                    ))}
                                </p>
                            </div>
                        ) : null}
                        <p className="pt-1 text-xs text-muted-foreground">
                            See <code className="text-[11px]">catalog/PREBUILD_VERTICAL_ROADMAP.md</code> in your clone for
                            booking spine status by vertical and revenue-motion table. Matrix:{" "}
                            <code className="text-[11px]">catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md</code>.
                        </p>
                    </WidgetChrome>
                );
            }
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:items-end">
                    <div className="grid gap-1.5">
                        <Label className="text-xs" htmlFor={idDays}>
                            Period (days)
                        </Label>
                        <Input
                            id={idDays}
                            type="number"
                            min={1}
                            max={366}
                            value={days}
                            onChange={(e) => {
                                const n = Math.min(366, Math.max(1, parseInt(e.target.value, 10) || 1));
                                setDays(n);
                            }}
                            className="w-32"
                        />
                    </div>
                    <div className="grid max-w-sm gap-1.5">
                        <Label className="text-xs" htmlFor={idSlug}>
                            Vertical slug (optional)
                        </Label>
                        <Input
                            id={idSlug}
                            value={catalogSlug}
                            onChange={(e) => setCatalogSlug(e.target.value)}
                            placeholder="e.g. healthcare-clinic-screening"
                            className="w-full"
                        />
                        <p className="text-[11px] text-muted-foreground">MK-01 <code>catalog_slug</code> on workflows.</p>
                    </div>
                    <div className="grid max-w-sm gap-1.5">
                        <Label className="text-xs" htmlFor={idVariant}>
                            Graph variant (optional)
                        </Label>
                        <Input
                            id={idVariant}
                            value={catalogVariantId}
                            onChange={(e) => setCatalogVariantId(e.target.value)}
                            placeholder="e.g. booking_complex"
                            className="w-full"
                        />
                        <p className="text-[11px] text-muted-foreground">
                            MK-01 <code>catalog_variant_id</code> from install (simple vs complex).
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void load()}
                        disabled={loading}
                        className="gap-1.5"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                        Refresh
                    </Button>
                    <div
                        className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground"
                        title="Widget order is saved for your organization (this browser also caches offline)"
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span>Custom layout (org)</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2 rounded-md border border-border/80 bg-muted/15 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 min-w-0">
                    <Label className="text-xs" htmlFor={idRedaction}>
                        PII redaction (organization)
                    </Label>
                    <p className="text-[11px] text-muted-foreground max-w-xl">
                        Applies to <span className="font-medium text-foreground/90">call detail</span> and{" "}
                        <span className="font-medium text-foreground/90">server CSV</span> exports. When on, emails,
                        phone-like patterns, and sensitive keys in HTTP tool data are masked. Disable only for trusted QM
                        workflows.
                    </p>
                    {mayDisableRedaction === false ? (
                        <p className="text-[11px] text-amber-700 dark:text-amber-500/90 max-w-xl">
                            Turning redaction off requires an administrator or permitted role in your organization.
                        </p>
                    ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Switch
                        id={idRedaction}
                        checked={redactionEnabled ?? true}
                        disabled={
                            redactionEnabled === null ||
                            redactionSaving ||
                            authLoading ||
                            (Boolean(redactionEnabled) && mayDisableRedaction === false)
                        }
                        title={
                            Boolean(redactionEnabled) && mayDisableRedaction === false
                                ? "Your role cannot disable organization PII redaction."
                                : undefined
                        }
                        onCheckedChange={(checked) => {
                            if (!checked) {
                                if (mayDisableRedaction === false) {
                                    return;
                                }
                                setConfirmDisableRedaction(true);
                                return;
                            }
                            void persistRedactionPolicy(true);
                        }}
                        aria-label="Toggle PII redaction for analytics exports"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {redactionEnabled === null ? "Loading…" : redactionEnabled ? "On" : "Off"}
                    </span>
                </div>
            </div>

            <AlertDialog open={confirmDisableRedaction} onOpenChange={setConfirmDisableRedaction}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Disable PII redaction?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Call detail and server CSV may expose more raw fields (including tool{" "}
                            <code className="text-[11px]">mapped_data</code>). Use only when your governance allows it.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setConfirmDisableRedaction(false);
                                void persistRedactionPolicy(false);
                            }}
                        >
                            Disable redaction
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {err ? <p className="text-sm text-destructive">{err}</p> : null}

            {data && !err ? (
                <p className="text-xs text-muted-foreground">
                    Range: <span className="font-mono text-foreground/90">{data.since}</span> &mdash;{" "}
                    <span className="font-mono text-foreground/90">{data.until}</span> (UTC). Share this view: copy the
                    URL.
                </p>
            ) : null}

            <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border/80 bg-muted/20 p-3">
                <div className="grid gap-1.5">
                    <Label className="text-xs">Add widget</Label>
                    <Select
                        value={addType || undefined}
                        onValueChange={(v) => setAddType((v as AnalyticsWidgetType) || "")}
                    >
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Choose type" />
                        </SelectTrigger>
                        <SelectContent>
                            {available.map((t) => (
                                <SelectItem key={t} value={t}>
                                    {WIDGET_META[t].title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={addWidget} disabled={available.length === 0} className="gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Add
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={resetLayout}
                    className="gap-1 text-muted-foreground"
                    title="Restore default widgets and save for your organization"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset layout
                </Button>
                {widgetPresetForCatalogSlug(catalogSlug) ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={applyVerticalPreset}
                        className="gap-1"
                        title="Reorder widgets for this vertical (KPI & booking/Revenue cards first). With a known slug in the URL, the generic default layout auto-applies when you open this page."
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        Apply vertical preset
                    </Button>
                ) : null}
                {available.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground pb-1">All widget types are on the board. Remove one to re-add.</p>
                ) : null}
            </div>

            <div className="space-y-4">
                {widgets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No widgets — use Reset layout.</p>
                ) : (
                    widgets.map((w) => <div key={w.id}>{renderWidget(w)}</div>)
                )}
            </div>
        </div>
    );
}
