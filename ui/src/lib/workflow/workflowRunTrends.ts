/**
 * WE-01-HEADER: aggregate workflow runs by week for a lightweight usage trend (editor).
 */

export type RunForTrend = {
    created_at: string;
    call_type?: string | null;
    cost_info?: {
        dograh_token_usage?: number | null;
        call_duration_seconds?: number | null;
    } | null;
};

export type UsageTrendBucket = {
    /** UTC date string (YYYY-MM-DD) for Monday of that week */
    weekStart: string;
    /** Short label for the bar */
    label: string;
    runCount: number;
    /** Inbound runs (stacked bar segment); with ``runsOutbound`` sums to ``runCount`` when known. */
    runsInbound: number;
    runsOutbound: number;
    /** Sum of Dograh tokens when any run in the week had usage; null if none */
    tokensSum: number | null;
};

/** Weeks offered in usage trend lookback selectors (UTC weekly rollup window). */
export const USAGE_TREND_LOOKBACK_WEEK_OPTIONS = [4, 8, 12, 26, 52] as const;

/** Days offered in org daily rollup chart selector (UTC calendar-day buckets). */
export const USAGE_TREND_LOOKBACK_DAY_OPTIONS = [7, 14, 30, 60, 90] as const;

function escapeCsvField(value: string): string {
    if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

/** Client-side CSV download for weekly trend buckets (org dashboard export). */
export function exportUsageTrendBucketsToCsv(buckets: UsageTrendBucket[], filenameBase: string): void {
    const header = 'week_start_utc,week_label,runs,runs_inbound,runs_outbound,dograh_tokens_approx';
    const lines = [header];
    for (const b of buckets) {
        const tok = b.tokensSum != null && Number.isFinite(b.tokensSum) ? String(Math.round(b.tokensSum)) : '';
        lines.push(
            [
                b.weekStart,
                escapeCsvField(b.label),
                String(b.runCount),
                String(b.runsInbound),
                String(b.runsOutbound),
                tok,
            ].join(','),
        );
    }
    const blob = new Blob([`${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.csv`;
    a.rel = 'noopener';
    a.click();
    URL.revokeObjectURL(url);
}

function mondayUtcIso(iso: string): string {
    const d = new Date(iso);
    const day = d.getUTCDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setUTCDate(d.getUTCDate() + diff);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}

export function formatWeekLabel(weekStartYmd: string): string {
    const d = new Date(`${weekStartYmd}T12:00:00.000Z`);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function rollupRunsSplit(
    runCount: number,
    runsInbound?: number | null,
    runsOutbound?: number | null,
): { runsInbound: number; runsOutbound: number } {
    let ri = Math.max(0, Math.round(Number(runsInbound ?? 0)));
    let ro = Math.max(0, Math.round(Number(runsOutbound ?? 0)));
    if (ri === 0 && ro === 0 && runCount > 0) {
        return { runsInbound: 0, runsOutbound: runCount };
    }
    if (ri + ro !== runCount && runCount >= 0) {
        if (ri > runCount) {
            ri = runCount;
            ro = 0;
        } else {
            ro = Math.max(0, runCount - ri);
        }
    }
    return { runsInbound: ri, runsOutbound: ro };
}

/** Map GET …/usage/weekly-rollup buckets to the editor / usage page chart shape. */
export function weeklyRollupApiToUsageTrendBuckets(
    buckets: {
        week_start: string;
        run_count: number;
        runs_inbound?: number | null;
        runs_outbound?: number | null;
        dograh_tokens?: number | null;
    }[],
): UsageTrendBucket[] {
    return buckets.map((b) => {
        const split = rollupRunsSplit(b.run_count, b.runs_inbound, b.runs_outbound);
        return {
            weekStart: b.week_start,
            label: formatWeekLabel(b.week_start),
            runCount: b.run_count,
            runsInbound: split.runsInbound,
            runsOutbound: split.runsOutbound,
            tokensSum:
                b.dograh_tokens != null && Number.isFinite(Number(b.dograh_tokens)) && Number(b.dograh_tokens) > 0
                    ? Math.round(Number(b.dograh_tokens))
                    : null,
        };
    });
}

/** Map GET …/usage/daily-rollup buckets to the same chart shape as weekly (``weekStart`` holds UTC **day** YYYY-MM-DD). */
export function dailyRollupApiToUsageTrendBuckets(
    buckets: {
        day_start: string;
        run_count: number;
        runs_inbound?: number | null;
        runs_outbound?: number | null;
        dograh_tokens?: number | null;
    }[],
): UsageTrendBucket[] {
    return buckets.map((b) => {
        const split = rollupRunsSplit(b.run_count, b.runs_inbound, b.runs_outbound);
        return {
            weekStart: b.day_start,
            label: formatWeekLabel(b.day_start),
            runCount: b.run_count,
            runsInbound: split.runsInbound,
            runsOutbound: split.runsOutbound,
            tokensSum:
                b.dograh_tokens != null && Number.isFinite(Number(b.dograh_tokens)) && Number(b.dograh_tokens) > 0
                    ? Math.round(Number(b.dograh_tokens))
                    : null,
        };
    });
}

/**
 * Filter runs to ``created_at`` in ``[sinceYmd 00:00 UTC, untilYmd+1 00:00 UTC)`` for client-side trend fallback
 * when the rollup API fails but a custom UTC calendar range is selected.
 */
export function filterRunsForTrendUtcInclusiveYmdRange<T extends RunForTrend>(
    runs: T[],
    sinceYmd: string,
    untilYmd: string,
): T[] {
    const sinceMs = new Date(`${sinceYmd}T00:00:00.000Z`).getTime();
    const untilEnd = new Date(`${untilYmd}T00:00:00.000Z`);
    untilEnd.setUTCDate(untilEnd.getUTCDate() + 1);
    const untilMs = untilEnd.getTime();
    return runs.filter((r) => {
        const t = new Date(r.created_at).getTime();
        return t >= sinceMs && t < untilMs;
    });
}

/**
 * Group runs into ISO weeks (UTC Monday), keep the last ``maxWeeks`` weeks that appear in data.
 * ``runs`` should be newest-first (API default).
 */
export function aggregateRunsByWeek(runs: RunForTrend[], maxWeeks = 8): UsageTrendBucket[] {
    const map = new Map<
        string,
        { count: number; inbound: number; outbound: number; tokens: number; anyTokens: boolean }
    >();
    for (const r of runs) {
        if (!r.created_at) continue;
        const wk = mondayUtcIso(r.created_at);
        const cur = map.get(wk) ?? { count: 0, inbound: 0, outbound: 0, tokens: 0, anyTokens: false };
        cur.count += 1;
        if (String(r.call_type ?? '').toLowerCase() === 'inbound') {
            cur.inbound += 1;
        } else {
            cur.outbound += 1;
        }
        const raw = r.cost_info?.dograh_token_usage;
        if (raw != null && Number.isFinite(Number(raw))) {
            cur.tokens += Math.round(Number(raw));
            cur.anyTokens = true;
        }
        map.set(wk, cur);
    }
    const keys = [...map.keys()].sort();
    const slice = keys.slice(-maxWeeks);
    return slice.map((weekStart) => {
        const v = map.get(weekStart)!;
        return {
            weekStart,
            label: formatWeekLabel(weekStart),
            runCount: v.count,
            runsInbound: v.inbound,
            runsOutbound: v.outbound,
            tokensSum: v.anyTokens ? v.tokens : null,
        };
    });
}

/** UTC calendar day ``YYYY-MM-DD`` from an ISO ``created_at`` string. */
function utcCalendarDayYmd(iso: string): string {
    return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Group runs into UTC calendar days, keep the last ``maxDays`` days that appear in data.
 * ``runs`` should be newest-first (API default). ``weekStart`` on each bucket holds the day YMD.
 */
export function aggregateRunsByDay(runs: RunForTrend[], maxDays = 30): UsageTrendBucket[] {
    const map = new Map<
        string,
        { count: number; inbound: number; outbound: number; tokens: number; anyTokens: boolean }
    >();
    for (const r of runs) {
        if (!r.created_at) continue;
        const day = utcCalendarDayYmd(r.created_at);
        const cur = map.get(day) ?? { count: 0, inbound: 0, outbound: 0, tokens: 0, anyTokens: false };
        cur.count += 1;
        if (String(r.call_type ?? '').toLowerCase() === 'inbound') {
            cur.inbound += 1;
        } else {
            cur.outbound += 1;
        }
        const raw = r.cost_info?.dograh_token_usage;
        if (raw != null && Number.isFinite(Number(raw))) {
            cur.tokens += Math.round(Number(raw));
            cur.anyTokens = true;
        }
        map.set(day, cur);
    }
    const keys = [...map.keys()].sort();
    const slice = keys.slice(-maxDays);
    return slice.map((dayStart) => {
        const v = map.get(dayStart)!;
        return {
            weekStart: dayStart,
            label: formatWeekLabel(dayStart),
            runCount: v.count,
            runsInbound: v.inbound,
            runsOutbound: v.outbound,
            tokensSum: v.anyTokens ? v.tokens : null,
        };
    });
}

export function formatUsageTrendHint(
    buckets: UsageTrendBucket[],
    bucketUnit: 'week' | 'day' = 'week',
): string | null {
    if (buckets.length === 0) return null;
    const totalRuns = buckets.reduce((s, b) => s + b.runCount, 0);
    const totalTok = buckets.reduce((s, b) => s + (b.tokensSum ?? 0), 0);
    const anyTok = buckets.some((b) => b.tokensSum != null && b.tokensSum > 0);
    const n = buckets.length;
    const unitLabel =
        n === 1 ? (bucketUnit === 'day' ? 'day' : 'wk') : bucketUnit === 'day' ? 'days' : 'wks';
    if (anyTok) {
        return `Trend (${n} ${unitLabel}): ${totalRuns} run${totalRuns === 1 ? '' : 's'} · ~${Math.round(totalTok)} tokens`;
    }
    return `Trend (${n} ${unitLabel}): ${totalRuns} run${totalRuns === 1 ? '' : 's'}`;
}
