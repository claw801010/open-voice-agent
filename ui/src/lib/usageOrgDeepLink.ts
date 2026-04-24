/**
 * WE-01-ORG-USAGE: UTC week helpers and /usage URL parsing for `?week=YYYY-MM-DD` (Monday UTC),
 * optional `?trendWeeks=` (weekly chart lookback: 4 | 8 | 12 | 26 | 52),
 * and optional `?trendSince=` / `?trendUntil=` (UTC **YYYY-MM-DD**, inclusive) for a custom chart range.
 */

import { decodeFiltersFromURL, encodeFiltersToURL, validateFilter } from '@/lib/filters';
import { USAGE_TREND_LOOKBACK_DAY_OPTIONS, USAGE_TREND_LOOKBACK_WEEK_OPTIONS } from '@/lib/workflow/workflowRunTrends';
import { usageFilterAttributes } from '@/lib/filterAttributes';
import type { ActiveFilter } from '@/types/filters';

const TREND_WEEKS_ALLOWED = new Set<number>([...USAGE_TREND_LOOKBACK_WEEK_OPTIONS]);
const TREND_DAYS_ALLOWED = new Set<number>([...USAGE_TREND_LOOKBACK_DAY_OPTIONS]);

const DEFAULT_TREND_WEEKS = 8;
const DEFAULT_TREND_DAYS = 30;

/** Query key: ``week`` (default) or ``day`` for org activity chart rollup granularity. */
export const TREND_GRANULARITY_PARAM = 'trendGranularity';
/** Rolling lookback in **days** when ``trendGranularity=day`` (default **30**). */
export const TREND_DAYS_PARAM = 'trendDays';

export type TrendGranularity = 'week' | 'day';

/** Query keys for custom weekly chart UTC date range (inclusive dates). */
export const TREND_SINCE_PARAM = 'trendSince';
export const TREND_UNTIL_PARAM = 'trendUntil';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Max inclusive UTC calendar span for weekly rollup `since`/`until` (matches API). */
export const TREND_DATE_RANGE_MAX_DAYS = 366;

/**
 * Client-side validation for custom chart range before hitting the API.
 * Returns an error message, or `null` if valid.
 */
export function validateUtcInclusiveTrendRange(since: string, until: string): string | null {
    if (!YMD.test(since) || !YMD.test(until)) {
        return 'Use UTC dates as YYYY-MM-DD.';
    }
    const sinceDt = new Date(`${since}T00:00:00.000Z`);
    const untilDay = new Date(`${until}T00:00:00.000Z`);
    const untilExclusive = new Date(untilDay);
    untilExclusive.setUTCDate(untilExclusive.getUTCDate() + 1);
    if (sinceDt >= untilExclusive) {
        return 'Start date must be before end date.';
    }
    const days = (untilExclusive.getTime() - sinceDt.getTime()) / 86400000;
    if (days > TREND_DATE_RANGE_MAX_DAYS) {
        return `Date range cannot exceed ${TREND_DATE_RANGE_MAX_DAYS} days.`;
    }
    return null;
}

/** When both are set, the org chart uses API ``since``/``until`` instead of ``weeks``. */
export function parseTrendDateRangeFromSearchParams(searchParams: URLSearchParams): {
    since: string | null;
    until: string | null;
} {
    const s = searchParams.get(TREND_SINCE_PARAM);
    const u = searchParams.get(TREND_UNTIL_PARAM);
    if (s && u && YMD.test(s) && YMD.test(u)) {
        return { since: s, until: u };
    }
    return { since: null, until: null };
}

/**
 * UTC Monday `YYYY-MM-DD` for the ISO week containing `date` (default: now).
 * Matches week boundaries in `workflowRunTrends.ts` (UTC Monday).
 */
export function getUtcWeekMondayYmdFromDate(date: Date = new Date()): string {
    const d = new Date(date.getTime());
    const day = d.getUTCDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setUTCDate(d.getUTCDate() + diff);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}

/** Monday 00:00:00.000Z through Sunday 23:59:59.999Z for the ISO week starting `weekStartYmd`. */
export function utcWeekRangeFromMonday(weekStartYmd: string): { from: Date; to: Date } {
    const from = new Date(`${weekStartYmd}T00:00:00.000Z`);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 6);
    to.setUTCHours(23, 59, 59, 999);
    return { from, to };
}

/** Single UTC calendar day (inclusive) for daily chart bar → usage history date filter. */
export function utcDayRangeFromYmd(dayYmd: string): { from: Date; to: Date } {
    const from = new Date(`${dayYmd}T00:00:00.000Z`);
    const to = new Date(`${dayYmd}T23:59:59.999Z`);
    return { from, to };
}

function weekFilterFromParam(week: string): ActiveFilter[] {
    const dateAttr = usageFilterAttributes.find((a) => a.id === 'dateRange');
    if (!dateAttr) return [];
    const { from, to } = utcWeekRangeFromMonday(week);
    const filter: ActiveFilter = { attribute: dateAttr, value: { from, to }, isValid: false };
    filter.isValid = validateFilter(filter) === null;
    return filter.isValid ? [filter] : [];
}

/**
 * Initial filters: explicit `filters` query wins; else `week=` (UTC Monday) sets date range only.
 */
export function getInitialUsageFiltersFromSearchParams(searchParams: URLSearchParams): ActiveFilter[] {
    const decoded = decodeFiltersFromURL(searchParams, usageFilterAttributes);
    if (decoded.length > 0) {
        return decoded;
    }
    const week = searchParams.get('week');
    if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) {
        return weekFilterFromParam(week);
    }
    return [];
}

/** Parse `?trendWeeks=` for the weekly activity chart lookback (default **8**). */
export function parseTrendWeeksFromSearchParams(searchParams: URLSearchParams): number {
    const raw = searchParams.get('trendWeeks');
    if (raw == null || raw === '') return DEFAULT_TREND_WEEKS;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || !TREND_WEEKS_ALLOWED.has(n)) return DEFAULT_TREND_WEEKS;
    return n;
}

/** Parse ``?trendGranularity=`` — **day** enables daily rollup chart; default **week**. */
export function parseTrendGranularityFromSearchParams(searchParams: URLSearchParams): TrendGranularity {
    const raw = searchParams.get(TREND_GRANULARITY_PARAM);
    if (raw === 'day') return 'day';
    return 'week';
}

/** Parse ``?trendDays=`` for daily chart rolling lookback (default **30**). */
export function parseTrendDaysFromSearchParams(searchParams: URLSearchParams): number {
    const raw = searchParams.get(TREND_DAYS_PARAM);
    if (raw == null || raw === '') return DEFAULT_TREND_DAYS;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || !TREND_DAYS_ALLOWED.has(n)) return DEFAULT_TREND_DAYS;
    return n;
}

export type BuildUsageListUrlOptions = {
    /** Weekly chart lookback; omitted from URL when **8** (default). Ignored when ``trendSince``+``trendUntil`` are set or when ``trendGranularity`` is **day**. */
    trendWeeks?: number;
    /** UTC date ``YYYY-MM-DD`` (inclusive); both required together. */
    trendSince?: string | null;
    trendUntil?: string | null;
    /** Chart bucket size for org activity trend. */
    trendGranularity?: TrendGranularity;
    /** Rolling day lookback when ``trendGranularity`` is **day**; omitted when **30** (default). */
    trendDays?: number;
};

/** Build `/usage` query with page + encoded filters (drops legacy `week` when canonicalizing). */
export function buildUsageListUrl(page: number, filters: ActiveFilter[], options?: BuildUsageListUrlOptions): string {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (filters.length > 0) {
        const fs = encodeFiltersToURL(filters);
        if (fs) {
            new URLSearchParams(fs).forEach((value, key) => params.set(key, value));
        }
    }
    if (options?.trendSince && options?.trendUntil) {
        params.set(TREND_SINCE_PARAM, options.trendSince);
        params.set(TREND_UNTIL_PARAM, options.trendUntil);
        if (options.trendGranularity === 'day') {
            params.set(TREND_GRANULARITY_PARAM, 'day');
        }
    } else if (options?.trendGranularity === 'day') {
        params.set(TREND_GRANULARITY_PARAM, 'day');
        const td = options.trendDays;
        if (td != null && td !== DEFAULT_TREND_DAYS && TREND_DAYS_ALLOWED.has(td)) {
            params.set(TREND_DAYS_PARAM, String(td));
        }
    } else {
        const tw = options?.trendWeeks;
        if (tw != null && tw !== DEFAULT_TREND_WEEKS && TREND_WEEKS_ALLOWED.has(tw)) {
            params.set('trendWeeks', String(tw));
        }
    }
    const q = params.toString();
    return q ? `/usage?${q}` : '/usage';
}
