'use client';

import { Download, ImageDown } from 'lucide-react';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportUsageTrendChartToPng } from '@/lib/workflow/usageTrendChartExport';
import {
    exportUsageTrendBucketsToCsv,
    USAGE_TREND_LOOKBACK_DAY_OPTIONS,
    USAGE_TREND_LOOKBACK_WEEK_OPTIONS,
    type UsageTrendBucket,
} from '@/lib/workflow/workflowRunTrends';

export { USAGE_TREND_LOOKBACK_DAY_OPTIONS, USAGE_TREND_LOOKBACK_WEEK_OPTIONS };

type ChartRow = {
    name: string;
    weekStart: string;
    runsInbound: number;
    runsOutbound: number;
    /** Total runs (= inbound + outbound) for tooltips / parity */
    runs: number;
    tokens: number | null;
};

type WorkflowUsageTrendPanelProps = {
    loading: boolean;
    error: boolean;
    buckets: UsageTrendBucket[];
    /** X-axis buckets: ISO week Monday vs UTC calendar day (copy / a11y only; data still uses ``weekStart`` as YMD). */
    bucketUnit?: 'week' | 'day';
    /** Override default "Usage trend" heading (e.g. org dashboard) */
    title?: string;
    /** Override default helper text under the heading */
    description?: string;
    /** When set, week bars are clickable (e.g. org /usage dashboard filters the table) */
    onWeekClick?: (weekStartUtcYmd: string) => void;
    /** Taller chart + spacing (usage page); tighter for simulation rail */
    variant?: 'default' | 'compact';
    /** Current rollup lookback (weeks). When `onLookbackWeeksChange` is set, shows a selector. */
    lookbackWeeks?: number;
    onLookbackWeeksChange?: (weeks: number) => void;
    /** Daily rollup lookback (days). When set with `onLookbackDaysChange`, shows day selector instead of weeks. */
    lookbackDays?: number;
    onLookbackDaysChange?: (days: number) => void;
    /** When true, week preset is disabled (e.g. custom UTC date range on `/usage`). */
    lookbackSelectorDisabled?: boolean;
    /** Show a CSV download of the current buckets (org dashboard). */
    showExportCsv?: boolean;
    /** Rasterize the chart area to PNG (org dashboard; requires visible chart). */
    showExportPng?: boolean;
    /** Filename stem for CSV / PNG (no extension), e.g. `org-usage-weekly-trend`. */
    exportCsvFilenameBase?: string;
};

const DEFAULT_TITLE = 'Usage trend';

function TrendTooltip({
    active,
    payload,
    onWeekClick,
}: {
    active?: boolean;
    payload?: Array<{ payload: ChartRow }>;
    onWeekClick?: (weekStartUtcYmd: string) => void;
}) {
    if (!active || !payload?.[0]) return null;
    const p = payload[0].payload;
    return (
        <div className="rounded-md border border-border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-md">
            <p className="font-medium">{p.name}</p>
            <p className="text-muted-foreground">Inbound: {p.runsInbound}</p>
            <p className="text-muted-foreground">Outbound: {p.runsOutbound}</p>
            <p className="text-muted-foreground">Runs (total): {p.runs}</p>
            {p.tokens != null ? (
                <p className="text-muted-foreground">Tokens: ~{Math.round(p.tokens)}</p>
            ) : (
                <p className="text-muted-foreground">Tokens: —</p>
            )}
            {onWeekClick ? <p className="mt-1 text-[10px] text-muted-foreground">Click bar to filter table</p> : null}
        </div>
    );
}

/**
 * Weekly usage trend: dual-axis chart (runs vs tokens) with optional lookback selector.
 * WE-01-HEADER / WE-01-ORG-USAGE.
 */
export function WorkflowUsageTrendPanel({
    loading,
    error,
    buckets,
    bucketUnit = 'week',
    title = DEFAULT_TITLE,
    description,
    onWeekClick,
    variant = 'default',
    lookbackWeeks = 8,
    onLookbackWeeksChange,
    lookbackDays = 30,
    onLookbackDaysChange,
    lookbackSelectorDisabled = false,
    showExportCsv = false,
    showExportPng = false,
    exportCsvFilenameBase = 'usage-weekly-trend',
}: WorkflowUsageTrendPanelProps) {
    const chartCaptureRef = useRef<HTMLDivElement>(null);
    const chartDescriptionId = useId();
    const [pngExporting, setPngExporting] = useState(false);

    const handleExportPng = useCallback(async () => {
        const el = chartCaptureRef.current;
        if (!el || !showExportPng) return;
        setPngExporting(true);
        try {
            await exportUsageTrendChartToPng(el, exportCsvFilenameBase);
        } catch (err) {
            console.error(err);
            toast.error('Could not export chart to PNG. Try again or use CSV for data.');
        } finally {
            setPngExporting(false);
        }
    }, [exportCsvFilenameBase, showExportPng]);

    const chartData: ChartRow[] = useMemo(
        () =>
            buckets.map((b) => ({
                name: b.label,
                weekStart: b.weekStart,
                runsInbound: b.runsInbound,
                runsOutbound: b.runsOutbound,
                runs: b.runCount,
                tokens: b.tokensSum != null ? b.tokensSum : null,
            })),
        [buckets],
    );

    const hasAnyTokens = useMemo(() => chartData.some((d) => d.tokens != null && d.tokens > 0), [chartData]);

    const desc =
        description ??
        (bucketUnit === 'day'
            ? `UTC calendar days with activity (up to ${lookbackDays} day lookback). Runs stacked by inbound vs outbound; token line when cost was recorded.`
            : `UTC weeks with activity (up to ${lookbackWeeks} week lookback). Runs stacked by inbound vs outbound; token line when cost was recorded.`);

    const chartAriaLabel =
        bucketUnit === 'day'
            ? 'Usage chart: stacked inbound and outbound runs per UTC calendar day, optional tokens line'
            : 'Usage chart: stacked inbound and outbound runs per UTC week (ISO Monday start), optional tokens line';

    const chartHeight = variant === 'compact' ? 150 : 240;

    if (loading) {
        return (
            <section className="rounded-lg border border-border/80 bg-muted/15 p-3 shadow-sm space-y-3" aria-busy="true">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2 min-w-0 flex-1">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
                        <div className="h-3 w-48 max-w-full rounded bg-muted animate-pulse" />
                        <div className="h-3 w-full max-w-md rounded bg-muted animate-pulse" />
                    </div>
                    <div className="h-8 w-[130px] rounded-md bg-muted animate-pulse shrink-0" />
                </div>
                <div
                    className={`flex items-end gap-1 pt-1 ${variant === 'compact' ? 'min-h-[120px]' : 'min-h-[200px]'}`}
                >
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex-1 flex flex-col justify-end gap-2 min-w-0">
                            <div
                                className="mx-auto w-full max-w-[40px] rounded-sm bg-muted animate-pulse"
                                style={{ height: `${12 + ((i * 17) % 72)}px` }}
                            />
                            <div className="h-2 w-full rounded bg-muted/80 animate-pulse" />
                        </div>
                    ))}
                </div>
            </section>
        );
    }
    if (error) {
        return (
            <section className="rounded-lg border border-border/80 bg-muted/15 p-3 shadow-sm space-y-2" role="status">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground">Could not load usage.</p>
            </section>
        );
    }
    if (buckets.length === 0) {
        return (
            <section className="rounded-lg border border-border/80 bg-muted/15 p-3 shadow-sm space-y-2" role="status">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground leading-snug">
                    {bucketUnit === 'day'
                        ? 'No workflow runs in this window yet — run a Web or phone call to see daily counts here.'
                        : 'No workflow runs in this window yet — run a Web or phone call to see weekly counts here.'}
                </p>
            </section>
        );
    }

    return (
        <section className="rounded-lg border border-border/80 bg-muted/15 p-3 shadow-sm space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{desc}</p>
                    {onWeekClick ? (
                        <p className="text-[11px] text-muted-foreground mt-1">
                            {bucketUnit === 'day'
                                ? 'Click a run bar to filter the usage table (UTC calendar day).'
                                : 'Click a run bar to filter the usage table (UTC week).'}
                        </p>
                    ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-0.5">
                    {showExportCsv && buckets.length > 0 ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => exportUsageTrendBucketsToCsv(buckets, exportCsvFilenameBase)}
                        >
                            <Download className="h-3.5 w-3.5" aria-hidden />
                            CSV
                        </Button>
                    ) : null}
                    {showExportPng && buckets.length > 0 ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            disabled={pngExporting}
                            onClick={() => void handleExportPng()}
                            aria-label="Download chart as PNG image"
                        >
                            <ImageDown className="h-3.5 w-3.5" aria-hidden />
                            {pngExporting ? 'PNG…' : 'PNG'}
                        </Button>
                    ) : null}
                    {onLookbackDaysChange ? (
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Range</span>
                            <Select
                                value={String(lookbackDays)}
                                onValueChange={(v) => onLookbackDaysChange(Number(v))}
                                disabled={lookbackSelectorDisabled}
                            >
                                <SelectTrigger
                                    size="sm"
                                    className="h-8 w-[130px] text-xs"
                                    aria-label="Days of history"
                                    disabled={lookbackSelectorDisabled}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {USAGE_TREND_LOOKBACK_DAY_OPTIONS.map((d) => (
                                        <SelectItem key={d} value={String(d)} className="text-xs">
                                            Last {d} days
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : onLookbackWeeksChange ? (
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Range</span>
                            <Select
                                value={String(lookbackWeeks)}
                                onValueChange={(v) => onLookbackWeeksChange(Number(v))}
                                disabled={lookbackSelectorDisabled}
                            >
                                <SelectTrigger
                                    size="sm"
                                    className="h-8 w-[130px] text-xs"
                                    aria-label="Weeks of history"
                                    disabled={lookbackSelectorDisabled}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {USAGE_TREND_LOOKBACK_WEEK_OPTIONS.map((w) => (
                                        <SelectItem key={w} value={String(w)} className="text-xs">
                                            Last {w} weeks
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : null}
                </div>
            </div>

            <p id={chartDescriptionId} className="sr-only">
                {desc}
            </p>
            <div
                ref={chartCaptureRef}
                className={`rounded-md bg-background p-1 ${variant === 'compact' ? '-mx-0.5' : ''}`}
                role="img"
                aria-label={chartAriaLabel}
                aria-describedby={chartDescriptionId}
            >
                <ResponsiveContainer width="100%" height={chartHeight}>
                    <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: variant === 'compact' ? 9 : 11 }}
                            interval={variant === 'compact' && chartData.length > 10 ? 'preserveStartEnd' : 0}
                            tickLine={false}
                            axisLine={false}
                            className="fill-muted-foreground"
                        />
                        <YAxis
                            yAxisId="runs"
                            tick={{ fontSize: 10 }}
                            width={variant === 'compact' ? 28 : 32}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                            className="fill-muted-foreground"
                            label={
                                variant === 'compact'
                                    ? undefined
                                    : {
                                          value: 'Runs',
                                          angle: -90,
                                          position: 'insideLeft',
                                          style: { fontSize: 10, fill: 'var(--muted-foreground)' },
                                      }
                            }
                        />
                        {hasAnyTokens ? (
                            <YAxis
                                yAxisId="tokens"
                                orientation="right"
                                tick={{ fontSize: 10 }}
                                width={variant === 'compact' ? 32 : 36}
                                tickLine={false}
                                axisLine={false}
                                className="fill-muted-foreground"
                                label={
                                    variant === 'compact'
                                        ? undefined
                                        : {
                                              value: 'Tokens',
                                              angle: 90,
                                              position: 'insideRight',
                                              style: { fontSize: 10, fill: 'var(--muted-foreground)' },
                                          }
                                }
                            />
                        ) : null}
                        <Tooltip
                            content={<TrendTooltip onWeekClick={onWeekClick} />}
                            cursor={{ fill: 'var(--muted)', opacity: 0.15 }}
                        />
                        <Legend
                            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                            formatter={(value) => {
                                if (value === 'runsInbound') return 'Inbound runs';
                                if (value === 'runsOutbound') return 'Outbound runs';
                                if (value === 'tokens') return 'Tokens (approx.)';
                                return String(value);
                            }}
                        />
                        <Bar
                            yAxisId="runs"
                            dataKey="runsInbound"
                            name="runsInbound"
                            stackId="runsStack"
                            fill="var(--chart-1)"
                            maxBarSize={variant === 'compact' ? 28 : 40}
                            cursor={onWeekClick ? 'pointer' : 'default'}
                            onClick={(_data, index) => {
                                const pt = chartData[index];
                                if (pt?.weekStart) onWeekClick?.(pt.weekStart);
                            }}
                        />
                        <Bar
                            yAxisId="runs"
                            dataKey="runsOutbound"
                            name="runsOutbound"
                            stackId="runsStack"
                            fill="var(--chart-3)"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={variant === 'compact' ? 28 : 40}
                            cursor={onWeekClick ? 'pointer' : 'default'}
                            onClick={(_data, index) => {
                                const pt = chartData[index];
                                if (pt?.weekStart) onWeekClick?.(pt.weekStart);
                            }}
                        />
                        {hasAnyTokens ? (
                            <Line
                                yAxisId="tokens"
                                type="monotone"
                                dataKey="tokens"
                                name="tokens"
                                stroke="var(--chart-2)"
                                strokeWidth={2}
                                dot={{ r: variant === 'compact' ? 2 : 3, fill: 'var(--chart-2)' }}
                                activeDot={{ r: 4 }}
                                connectNulls={false}
                            />
                        ) : null}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
}
