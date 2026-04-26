"use client";

import { ChevronLeft, ChevronRight, Globe, Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import TimezoneSelect, { type ITimezoneOption } from 'react-timezone-select';
import { toast } from 'sonner';

import { WorkflowUsageTrendPanel } from '@/app/workflow/[workflowId]/components/WorkflowUsageTrendPanel';
import { getCurrentPeriodUsageApiV1OrganizationsUsageCurrentPeriodGet, getDailyUsageBreakdownApiV1OrganizationsUsageDailyBreakdownGet, getMpsCreditsApiV1OrganizationsUsageMpsCreditsGet, getOrgDailyUsageRollupApiV1OrganizationsUsageDailyRollupGet, getOrgWeeklyUsageRollupApiV1OrganizationsUsageWeeklyRollupGet, getUsageHistoryApiV1OrganizationsUsageRunsGet } from '@/client/sdk.gen';
import type { CurrentUsageResponse, DailyUsageBreakdownResponse, MpsCreditsResponse, UsageHistoryResponse, WorkflowRunUsageResponse } from '@/client/types.gen';
import { DailyUsageTable } from '@/components/DailyUsageTable';
import { FilterBuilder } from '@/components/filters/FilterBuilder';
import { MediaPreviewButton, MediaPreviewDialog } from '@/components/MediaPreviewDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Sparkline } from '@/components/ui/sparkline';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { UsageTrendGranularityTabs } from '@/components/usage/UsageTrendGranularityTabs';
import { useUserConfig } from '@/context/UserConfigContext';
import { useAuth } from '@/lib/auth';
import { usageFilterAttributes } from '@/lib/filterAttributes';
import { validateFilter } from '@/lib/filters';
import {
    buildUsageListUrl,
    getInitialUsageFiltersFromSearchParams,
    parseTrendDateRangeFromSearchParams,
    parseTrendDaysFromSearchParams,
    parseTrendGranularityFromSearchParams,
    parseTrendWeeksFromSearchParams,
    TREND_DAYS_PARAM,
    TREND_GRANULARITY_PARAM,
    TREND_SINCE_PARAM,
    TREND_UNTIL_PARAM,
    type TrendGranularity,
    utcDayRangeFromYmd,
    utcWeekRangeFromMonday,
    validateUtcInclusiveTrendRange,
} from '@/lib/usageOrgDeepLink';
import type { UsageTrendBucket } from '@/lib/workflow/workflowRunTrends';
import { dailyRollupApiToUsageTrendBuckets, weeklyRollupApiToUsageTrendBuckets } from '@/lib/workflow/workflowRunTrends';
import { ActiveFilter, DateRangeValue } from '@/types/filters';

// Get local timezone
const getLocalTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function UsagePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { userConfig, saveUserConfig, loading: userConfigLoading, organizationPricing } = useUserConfig();
    const auth = useAuth();

    // Current billing period / quota (org-level)
    const [currentPeriod, setCurrentPeriod] = useState<CurrentUsageResponse | null>(null);
    const [currentPeriodError, setCurrentPeriodError] = useState<string | null>(null);
    const [isLoadingCurrentPeriod, setIsLoadingCurrentPeriod] = useState(true);

    // Org-wide weekly trend (server-side UTC week rollups)
    const [orgTrendLoading, setOrgTrendLoading] = useState(false);
    const [orgTrendError, setOrgTrendError] = useState(false);
    const [orgTrendBuckets, setOrgTrendBuckets] = useState<UsageTrendBucket[]>([]);
    /** Chart lookback: driven by `?trendWeeks=` (default 8) so URL is the source of truth. */
    const orgTrendLookbackWeeks = parseTrendWeeksFromSearchParams(searchParams);
    const orgTrendLookbackDays = parseTrendDaysFromSearchParams(searchParams);
    const orgTrendGranularity = parseTrendGranularityFromSearchParams(searchParams);
    const orgTrendUsesCustomRange = useMemo(() => {
        const dr = parseTrendDateRangeFromSearchParams(searchParams);
        return Boolean(dr.since && dr.until);
    }, [searchParams]);

    const [customTrendSinceDraft, setCustomTrendSinceDraft] = useState('');
    const [customTrendUntilDraft, setCustomTrendUntilDraft] = useState('');

    useEffect(() => {
        const dr = parseTrendDateRangeFromSearchParams(searchParams);
        if (dr.since && dr.until) {
            setCustomTrendSinceDraft(dr.since);
            setCustomTrendUntilDraft(dr.until);
        } else {
            setCustomTrendSinceDraft('');
            setCustomTrendUntilDraft('');
        }
    }, [searchParams]);

    const buildUsageChartUrlOptions = useCallback(() => {
        const dr = parseTrendDateRangeFromSearchParams(searchParams);
        const g = parseTrendGranularityFromSearchParams(searchParams);
        if (dr.since && dr.until) {
            return {
                trendSince: dr.since,
                trendUntil: dr.until,
                ...(g === 'day' ? { trendGranularity: 'day' as const } : {}),
            };
        }
        if (g === 'day') {
            return { trendGranularity: 'day' as const, trendDays: parseTrendDaysFromSearchParams(searchParams) };
        }
        return { trendWeeks: parseTrendWeeksFromSearchParams(searchParams) };
    }, [searchParams]);

    // MPS credits state
    const [mpsCredits, setMpsCredits] = useState<MpsCreditsResponse | null>(null);
    const [isLoadingCredits, setIsLoadingCredits] = useState(true);

    // Usage history state
    const [usageHistory, setUsageHistory] = useState<UsageHistoryResponse | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [currentPage, setCurrentPage] = useState(() => {
        const pageParam = searchParams.get('page');
        return pageParam ? parseInt(pageParam, 10) : 1;
    });
    const [isExecutingFilters, setIsExecutingFilters] = useState(false);

    // Daily usage breakdown state (only for paid orgs)
    const [dailyUsage, setDailyUsage] = useState<DailyUsageBreakdownResponse | null>(null);
    const [isLoadingDaily, setIsLoadingDaily] = useState(false);

    // Initialize filters from URL (`filters` JSON or shorthand `week=YYYY-MM-DD` UTC Monday)
    const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(() =>
        getInitialUsageFiltersFromSearchParams(searchParams),
    );

    // Media preview dialog
    const mediaPreview = MediaPreviewDialog();

    // Timezone state - initialize with empty string to avoid hydration mismatch
    const localTimezone = getLocalTimezone();
    const [selectedTimezone, setSelectedTimezone] = useState<ITimezoneOption | string>('');
    const [savingTimezone, setSavingTimezone] = useState(false);
    const timezoneSelectId = useId(); // Stable ID for react-select to prevent hydration mismatch
    const orgActivityTrendGranularityLabelId = useId();

    /** Last buckets’ token sums for a compact real-data sparkline (WE-01-HYPER-DENSITY). */
    const orgTrendTokenSparklineSeries = useMemo(() => {
        if (orgTrendBuckets.length < 2) return null;
        return orgTrendBuckets.slice(-12).map((b) => (b.tokensSum != null ? b.tokensSum : 0));
    }, [orgTrendBuckets]);

    const fetchCurrentPeriodUsage = useCallback(async () => {
        if (!auth.isAuthenticated) return;
        setIsLoadingCurrentPeriod(true);
        setCurrentPeriodError(null);
        try {
            const response = await getCurrentPeriodUsageApiV1OrganizationsUsageCurrentPeriodGet();
            if (response.data) {
                setCurrentPeriod(response.data);
            } else if (response.error) {
                const err = response.error as { detail?: string };
                setCurrentPeriodError(typeof err?.detail === 'string' ? err.detail : 'Could not load billing period');
                setCurrentPeriod(null);
            }
        } catch {
            setCurrentPeriodError('Could not load billing period');
            setCurrentPeriod(null);
        } finally {
            setIsLoadingCurrentPeriod(false);
        }
    }, [auth.isAuthenticated]);

    const fetchOrgTrend = useCallback(async () => {
        if (!auth.isAuthenticated) return;
        setOrgTrendLoading(true);
        setOrgTrendError(false);
        try {
            const dr = parseTrendDateRangeFromSearchParams(searchParams);
            const g = parseTrendGranularityFromSearchParams(searchParams);
            const fixedQuery = dr.since && dr.until ? { since: dr.since, until: dr.until } : null;

            if (g === 'day') {
                const query = fixedQuery ?? { days: parseTrendDaysFromSearchParams(searchParams) };
                const response = await getOrgDailyUsageRollupApiV1OrganizationsUsageDailyRollupGet({ query });
                if (response.data?.buckets) {
                    setOrgTrendBuckets(dailyRollupApiToUsageTrendBuckets(response.data.buckets));
                } else {
                    setOrgTrendBuckets([]);
                }
            } else {
                const query = fixedQuery ?? { weeks: orgTrendLookbackWeeks };
                const response = await getOrgWeeklyUsageRollupApiV1OrganizationsUsageWeeklyRollupGet({
                    query,
                });
                if (response.data?.buckets) {
                    setOrgTrendBuckets(weeklyRollupApiToUsageTrendBuckets(response.data.buckets));
                } else {
                    setOrgTrendBuckets([]);
                }
            }
        } catch {
            setOrgTrendError(true);
            setOrgTrendBuckets([]);
        } finally {
            setOrgTrendLoading(false);
        }
    }, [auth.isAuthenticated, orgTrendLookbackWeeks, searchParams]);

    // Fetch MPS credits
    const fetchMpsCredits = useCallback(async () => {
        if (!auth.isAuthenticated) return;
        try {
            const response = await getMpsCreditsApiV1OrganizationsUsageMpsCreditsGet();
            if (response.data) {
                setMpsCredits(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch MPS credits:', error);
        } finally {
            setIsLoadingCredits(false);
        }
    }, [auth.isAuthenticated]);

    // Fetch usage history
    const fetchUsageHistory = useCallback(async (page: number, filters?: ActiveFilter[]) => {
        if (!auth.isAuthenticated) return;
        setIsLoadingHistory(true);
        try {
            let filterParam = undefined;
            let startDate = '';
            let endDate = '';

            if (filters && filters.length > 0) {
                // Extract date range filter if present
                const dateRangeFilter = filters.find(f => f.attribute.id === 'dateRange');
                if (dateRangeFilter && dateRangeFilter.value) {
                    const dateValue = dateRangeFilter.value as DateRangeValue;

                    if (dateValue.from) {
                        // The dates are already in the user's local timezone
                        // Convert to UTC ISO string for the backend
                        startDate = dateValue.from.toISOString();
                    }
                    if (dateValue.to) {
                        // Convert to UTC ISO string for the backend
                        endDate = dateValue.to.toISOString();
                    }
                }

                // Process other filters (excluding dateRange)
                const otherFilters = filters.filter(f => f.attribute.id !== 'dateRange');
                if (otherFilters.length > 0) {
                    const filterData = otherFilters.map(filter => ({
                        attribute: filter.attribute.id,
                        type: filter.attribute.type,
                        value: filter.value,
                    }));
                    filterParam = JSON.stringify(filterData);
                }
            }

            const response = await getUsageHistoryApiV1OrganizationsUsageRunsGet({
                query: {
                    page,
                    limit: 50,
                    ...(startDate && { start_date: startDate }),
                    ...(endDate && { end_date: endDate }),
                    ...(filterParam && { filters: filterParam })
                },
            });

            if (response.data) {
                setUsageHistory(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch usage history:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [auth.isAuthenticated]);

    // Fetch daily usage breakdown
    const fetchDailyUsage = useCallback(async () => {
        if (!auth.isAuthenticated || !organizationPricing?.price_per_second_usd) return;

        setIsLoadingDaily(true);
        try {
            const response = await getDailyUsageBreakdownApiV1OrganizationsUsageDailyBreakdownGet({
                query: { days: 7 },
            });

            if (response.data) {
                setDailyUsage(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch daily usage:', error);
        } finally {
            setIsLoadingDaily(false);
        }
    }, [auth.isAuthenticated, organizationPricing]);

    // Handle timezone change
    const handleTimezoneChange = async (timezone: ITimezoneOption | string) => {
        setSelectedTimezone(timezone);
        setSavingTimezone(true);
        try {
            const tzValue = typeof timezone === 'string' ? timezone : timezone.value;
            await saveUserConfig({ timezone: tzValue });
        } catch (error) {
            console.error('Failed to save timezone:', error);
            // Revert to previous timezone on error
            const prevTz = userConfig?.timezone || localTimezone;
            setSelectedTimezone(prevTz);
        } finally {
            setSavingTimezone(false);
        }
    };

    // Update timezone when userConfig loads
    useEffect(() => {
        if (!userConfigLoading) {
            // Config has loaded - set the timezone
            if (userConfig?.timezone) {
                setSelectedTimezone(userConfig.timezone);
            } else {
                // No saved timezone, use local
                setSelectedTimezone(localTimezone);
            }
        }
    }, [userConfig, userConfigLoading, localTimezone]);

    // Initial load and usage history when page/filters change
    useEffect(() => {
        if (auth.isAuthenticated) {
            fetchCurrentPeriodUsage();
            fetchMpsCredits();
            fetchUsageHistory(currentPage, activeFilters);
        }
    }, [auth.isAuthenticated, currentPage, activeFilters, fetchUsageHistory, fetchMpsCredits, fetchCurrentPeriodUsage]);

    useEffect(() => {
        if (auth.isAuthenticated) {
            void fetchOrgTrend();
        }
    }, [auth.isAuthenticated, fetchOrgTrend]);

    // Fetch daily usage when organizationPricing becomes available
    useEffect(() => {
        if (auth.isAuthenticated && organizationPricing?.price_per_second_usd) {
            fetchDailyUsage();
        }
    }, [auth.isAuthenticated, organizationPricing, fetchDailyUsage]);

    // Canonicalize `?week=` to `?page=1&filters=...` so filters are shareable and match FilterBuilder
    useEffect(() => {
        if (!auth.isAuthenticated) return;
        const week = searchParams.get('week');
        if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) return;
        if (searchParams.get('filters')) return;
        const filters = getInitialUsageFiltersFromSearchParams(searchParams);
        if (filters.length === 0) return;
        router.replace(buildUsageListUrl(1, filters, buildUsageChartUrlOptions()));
    }, [auth.isAuthenticated, searchParams, router, buildUsageChartUrlOptions]);

    const handleOrgTrendLookbackChange = useCallback(
        (weeks: number) => {
            const p = new URLSearchParams(searchParams.toString());
            p.delete(TREND_SINCE_PARAM);
            p.delete(TREND_UNTIL_PARAM);
            p.delete(TREND_GRANULARITY_PARAM);
            p.delete(TREND_DAYS_PARAM);
            if (weeks === 8) {
                p.delete('trendWeeks');
            } else {
                p.set('trendWeeks', String(weeks));
            }
            router.replace(p.toString() ? `/usage?${p.toString()}` : '/usage');
        },
        [router, searchParams],
    );

    const handleOrgTrendLookbackDaysChange = useCallback(
        (days: number) => {
            const p = new URLSearchParams(searchParams.toString());
            p.delete(TREND_SINCE_PARAM);
            p.delete(TREND_UNTIL_PARAM);
            p.delete('trendWeeks');
            p.set(TREND_GRANULARITY_PARAM, 'day');
            if (days === 30) {
                p.delete(TREND_DAYS_PARAM);
            } else {
                p.set(TREND_DAYS_PARAM, String(days));
            }
            router.replace(`/usage?${p.toString()}`);
        },
        [router, searchParams],
    );

    const handleOrgTrendGranularityChange = useCallback(
        (g: TrendGranularity) => {
            const p = new URLSearchParams(searchParams.toString());
            p.delete(TREND_SINCE_PARAM);
            p.delete(TREND_UNTIL_PARAM);
            if (g === 'day') {
                p.delete('trendWeeks');
                p.set(TREND_GRANULARITY_PARAM, 'day');
                p.delete(TREND_DAYS_PARAM);
            } else {
                p.delete(TREND_GRANULARITY_PARAM);
                p.delete(TREND_DAYS_PARAM);
                p.delete('trendWeeks');
            }
            router.replace(p.toString() ? `/usage?${p.toString()}` : '/usage');
        },
        [router, searchParams],
    );

    const handleApplyCustomOrgTrendRange = useCallback(() => {
        const err = validateUtcInclusiveTrendRange(customTrendSinceDraft, customTrendUntilDraft);
        if (err) {
            toast.error(err);
            return;
        }
        const p = new URLSearchParams(searchParams.toString());
        p.set(TREND_SINCE_PARAM, customTrendSinceDraft);
        p.set(TREND_UNTIL_PARAM, customTrendUntilDraft);
        p.delete('trendWeeks');
        const g = parseTrendGranularityFromSearchParams(searchParams);
        if (g === 'day') {
            p.set(TREND_GRANULARITY_PARAM, 'day');
        } else {
            p.delete(TREND_GRANULARITY_PARAM);
            p.delete(TREND_DAYS_PARAM);
        }
        router.replace(`/usage?${p.toString()}`);
    }, [customTrendSinceDraft, customTrendUntilDraft, router, searchParams]);

    const handleClearCustomOrgTrendRange = useCallback(() => {
        const p = new URLSearchParams(searchParams.toString());
        p.delete(TREND_SINCE_PARAM);
        p.delete(TREND_UNTIL_PARAM);
        router.replace(p.toString() ? `/usage?${p.toString()}` : '/usage');
    }, [router, searchParams]);

    // Update URL with query parameters
    const updateUrlParams = useCallback(
        (params: { page?: number; filters?: ActiveFilter[] }) => {
            const page = params.page ?? 1;
            const filters = params.filters ?? [];
            router.push(buildUsageListUrl(page, filters, buildUsageChartUrlOptions()));
        },
        [router, buildUsageChartUrlOptions],
    );

    const handleOrgTrendBarClick = useCallback(
        (bucketStartUtcYmd: string) => {
            const dateAttr = usageFilterAttributes.find((a) => a.id === 'dateRange');
            if (!dateAttr) return;
            const g = parseTrendGranularityFromSearchParams(searchParams);
            const { from, to } = g === 'day' ? utcDayRangeFromYmd(bucketStartUtcYmd) : utcWeekRangeFromMonday(bucketStartUtcYmd);
            const f: ActiveFilter = { attribute: dateAttr, value: { from, to }, isValid: false };
            f.isValid = validateFilter(f) === null;
            if (!f.isValid) return;
            const next = [f];
            setActiveFilters(next);
            setCurrentPage(1);
            updateUrlParams({ page: 1, filters: next });
            void fetchUsageHistory(1, next);
            document.getElementById('usage-history-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
        [fetchUsageHistory, searchParams, updateUrlParams],
    );

    const handleApplyFilters = useCallback(async () => {
        setIsExecutingFilters(true);
        setCurrentPage(1); // Reset to first page when applying filters
        updateUrlParams({ page: 1, filters: activeFilters });
        await fetchUsageHistory(1, activeFilters);
        setIsExecutingFilters(false);
    }, [activeFilters, fetchUsageHistory, updateUrlParams]);

    const handleFiltersChange = useCallback((filters: ActiveFilter[]) => {
        setActiveFilters(filters);
    }, []);

    const handleClearFilters = useCallback(async () => {
        setIsExecutingFilters(true);
        setCurrentPage(1);
        updateUrlParams({ page: 1, filters: [] }); // Clear filters from URL
        await fetchUsageHistory(1, []); // Fetch all runs without filters
        setIsExecutingFilters(false);
    }, [fetchUsageHistory, updateUrlParams]);

    // Handle page change
    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
        updateUrlParams({ page: newPage, filters: activeFilters });
        fetchUsageHistory(newPage, activeFilters);
    };

    // Handle row click to navigate to workflow run
    const handleRowClick = (run: WorkflowRunUsageResponse) => {
        router.push(`/workflow/${run.workflow_id}/run/${run.id}`);
    };

    // Format datetime for display with timezone support
    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        const tzValue = typeof selectedTimezone === 'string' ? selectedTimezone : selectedTimezone.value;
        // Use local timezone if none selected (during loading)
        const effectiveTz = tzValue || localTimezone;
        return date.toLocaleString('en-US', {
            timeZone: effectiveTz,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    // Format duration for display
    const formatDuration = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (minutes === 0) return `${remainingSeconds}s`;
        if (remainingSeconds === 0) return `${minutes}m`;
        return `${minutes}m ${remainingSeconds}s`;
    };

    const formatPeriodDay = (iso: string) =>
        new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    return (
        <div className="container mx-auto max-w-7xl p-6 pb-16 space-y-10">
            <section
                className="ovo-usage-hero px-6 py-8 md:px-10 md:py-10"
                aria-labelledby="usage-dashboard-title"
            >
                <div
                    className="ovo-hero-glow -right-16 -top-20 h-56 w-56 bg-primary/25 dark:bg-chart-2/30 ovo-motion-safe-glow"
                    aria-hidden
                />
                <div
                    className="ovo-hero-glow left-1/4 bottom-0 h-40 w-72 bg-chart-4/20 dark:bg-chart-4/25 ovo-motion-safe-glow"
                    style={{ animationDelay: '-4s' }}
                    aria-hidden
                />
                <div className="relative z-[1] grid gap-8 lg:grid-cols-12 lg:items-end">
                    <div className="space-y-4 lg:col-span-7">
                        <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground shadow-sm backdrop-blur-sm dark:bg-background/30">
                            <Sparkles
                                className="h-3.5 w-3.5 shrink-0 text-primary motion-safe:animate-spin-slow"
                                aria-hidden
                            />
                            Operator insights
                        </p>
                        <h1
                            id="usage-dashboard-title"
                            className="text-4xl font-bold tracking-tight text-balance md:text-5xl"
                        >
                            Usage Dashboard
                        </h1>
                        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                            Monitor Dograh token consumption, call time, and activity across your organization—clear
                            typography, generous spacing, and exportable trends when you need to share numbers.
                        </p>
                    </div>
                    <div className="ovo-glass-panel p-4 sm:p-5 lg:col-span-5">
                        <Label className="mb-2 block text-xs font-medium text-muted-foreground">Reporting timezone</Label>
                        <div className="flex items-start gap-2">
                            <Globe className="mt-2 h-4 w-4 shrink-0 text-muted-foreground ovo-icon-float" aria-hidden />
                            <div className="min-w-0 flex-1 max-w-full sm:max-w-[320px]">
                                <TimezoneSelect
                                    instanceId={timezoneSelectId}
                                    value={selectedTimezone}
                                    onChange={handleTimezoneChange}
                                    isDisabled={savingTimezone || userConfigLoading}
                                    placeholder={userConfigLoading ? "Loading..." : "Select timezone"}
                                    styles={{
                                        control: (base, state) => ({
                                            ...base,
                                            minHeight: '40px',
                                            fontSize: '14px',
                                            backgroundColor: 'color-mix(in oklch, var(--card) 55%, transparent)',
                                            borderColor: state.isFocused ? 'var(--ring)' : 'var(--border)',
                                            boxShadow: state.isFocused
                                                ? '0 0 0 2px color-mix(in oklch, var(--ring) 28%, transparent)'
                                                : 'inset 0 1px 0 0 color-mix(in oklch, var(--foreground) 5%, transparent)',
                                            '&:hover': {
                                                borderColor: 'var(--border)',
                                            },
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            zIndex: 9999,
                                            backgroundColor: 'var(--popover)',
                                            border: '1px solid var(--border)',
                                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                                        }),
                                        menuList: (base) => ({
                                            ...base,
                                            backgroundColor: 'var(--popover)',
                                            padding: 0,
                                        }),
                                        option: (base, state) => ({
                                            ...base,
                                            backgroundColor: state.isSelected
                                                ? 'var(--accent)'
                                                : state.isFocused
                                                ? 'var(--accent)'
                                                : 'var(--popover)',
                                            color: 'var(--foreground)',
                                            cursor: 'pointer',
                                            '&:active': {
                                                backgroundColor: 'var(--accent)',
                                            },
                                        }),
                                        singleValue: (base) => ({
                                            ...base,
                                            color: 'var(--foreground)',
                                        }),
                                        input: (base) => ({
                                            ...base,
                                            color: 'var(--foreground)',
                                        }),
                                        placeholder: (base) => ({
                                            ...base,
                                            color: 'var(--muted-foreground)',
                                        }),
                                        indicatorSeparator: (base) => ({
                                            ...base,
                                            backgroundColor: 'var(--border)',
                                        }),
                                        dropdownIndicator: (base) => ({
                                            ...base,
                                            color: 'var(--muted-foreground)',
                                            '&:hover': {
                                                color: 'var(--foreground)',
                                            },
                                        }),
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="space-y-3">
                <h2 className="text-lg font-semibold tracking-tight">Current billing period</h2>
                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                    Dograh token usage and call time for your selected organization&apos;s active billing window.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-6 xl:gap-5">
                {isLoadingCurrentPeriod ? (
                    <div className="ovo-bento-cell md:col-span-6 space-y-3 p-6">
                        <div className="h-4 animate-pulse rounded bg-muted/80 w-1/3" />
                        <div className="h-10 animate-pulse rounded bg-muted/80 w-2/3" />
                        <div className="h-4 animate-pulse rounded bg-muted/60 w-1/2" />
                    </div>
                ) : currentPeriodError ? (
                    <div className="ovo-bento-cell md:col-span-6 p-6" role="status">
                        <p className="text-sm text-muted-foreground">{currentPeriodError}</p>
                    </div>
                ) : currentPeriod ? (
                    <>
                        <div className="ovo-bento-cell md:col-span-4 space-y-4 p-6">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Billing window
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground leading-snug">
                                    {formatPeriodDay(currentPeriod.period_start)} –{' '}
                                    {formatPeriodDay(currentPeriod.period_end)}
                                    {currentPeriod.quota_enabled && currentPeriod.next_refresh_date ? (
                                        <>
                                            <span className="text-muted-foreground/80"> · </span>
                                            Next reset {formatPeriodDay(currentPeriod.next_refresh_date)}
                                        </>
                                    ) : null}
                                </p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground md:text-4xl">
                                    {Math.round(currentPeriod.used_dograh_tokens).toLocaleString()}
                                    {currentPeriod.quota_enabled ? (
                                        <span className="text-xl font-medium text-muted-foreground md:text-2xl">
                                            {' '}
                                            / {currentPeriod.quota_dograh_tokens.toLocaleString()}
                                        </span>
                                    ) : null}
                                </p>
                                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Dograh tokens
                                </p>
                                {currentPeriod.quota_enabled ? (
                                    <Progress
                                        value={Math.min(100, currentPeriod.percentage_used)}
                                        className="mt-3 h-2.5 max-w-xl rounded-full"
                                    />
                                ) : null}
                            </div>
                        </div>
                        <div className="ovo-bento-cell flex flex-col justify-between p-6 md:col-span-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Call time
                            </p>
                            <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">
                                {formatDuration(currentPeriod.total_duration_seconds)}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground leading-snug">Total duration this period</p>
                        </div>
                        <div className="ovo-bento-cell flex flex-col justify-between p-6 md:col-span-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Est. USD
                            </p>
                            {currentPeriod.used_amount_usd != null && currentPeriod.quota_amount_usd != null ? (
                                <>
                                    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">
                                        ${currentPeriod.used_amount_usd.toFixed(2)}
                                        <span className="text-base font-medium text-muted-foreground">
                                            {' '}
                                            / ${currentPeriod.quota_amount_usd.toFixed(2)}
                                        </span>
                                    </p>
                                    <p className="mt-2 text-xs text-muted-foreground leading-snug">
                                        When quota fields are available from billing.
                                    </p>
                                </>
                            ) : (
                                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                    USD estimate not exposed for this org yet.
                                </p>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="ovo-bento-cell md:col-span-6 p-6" role="status">
                        <p className="text-sm text-muted-foreground">No billing data available.</p>
                    </div>
                )}
            </div>

                {/* Org-wide usage trend (UTC week or calendar-day rollups) */}
                <Card className="ovo-glass-panel mb-6 border-0 bg-transparent shadow-none ring-1 ring-border/30">
                    <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <CardTitle>Activity</CardTitle>
                            <CardDescription>
                            Runs and token totals across all voice agents. Choose <strong className="font-medium text-foreground">Week</strong> for ISO
                            Monday buckets (<code className="rounded bg-muted px-1 py-0.5 text-xs">trendWeeks</code>) or{' '}
                            <strong className="font-medium text-foreground">Day</strong> for UTC calendar days (
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">trendGranularity=day</code>,{' '}
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">trendDays</code>). Use{' '}
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">trendSince</code> /{' '}
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">trendUntil</code> (UTC{' '}
                            <span className="whitespace-nowrap">YYYY-MM-DD</span>, inclusive) for a fixed range. Use{' '}
                            <strong className="font-medium text-foreground">CSV</strong> or{' '}
                            <strong className="font-medium text-foreground">PNG</strong> to export the chart.
                            </CardDescription>
                        </div>
                        {orgTrendTokenSparklineSeries ? (
                            <div className="flex shrink-0 flex-col items-end gap-1 sm:pt-0.5">
                                <Sparkline
                                    values={orgTrendTokenSparklineSeries}
                                    decorative={false}
                                    aria-label="Approximate Dograh token totals for the most recent Activity chart buckets"
                                    className="opacity-95"
                                />
                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Tokens trend
                                </span>
                            </div>
                        ) : null}
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                        <UsageTrendGranularityTabs
                            value={orgTrendGranularity}
                            onValueChange={handleOrgTrendGranularityChange}
                            label="Buckets"
                            labelId={orgActivityTrendGranularityLabelId}
                            variant="default"
                        />
                        <fieldset className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 px-3 py-3">
                            <legend className="w-full text-xs font-medium text-muted-foreground">
                                Custom UTC range (inclusive)
                            </legend>
                            <div className="flex flex-wrap items-center gap-2">
                                <Label htmlFor="org-trend-since" className="sr-only">
                                    Trend range start (UTC date)
                                </Label>
                                <Input
                                    id="org-trend-since"
                                    type="date"
                                    className="h-9 w-[160px] text-sm"
                                    value={customTrendSinceDraft}
                                    onChange={(e) => setCustomTrendSinceDraft(e.target.value)}
                                    aria-label="Trend range start UTC date"
                                />
                                <span className="text-muted-foreground text-sm" aria-hidden>
                                    –
                                </span>
                                <Label htmlFor="org-trend-until" className="sr-only">
                                    Trend range end (UTC date)
                                </Label>
                                <Input
                                    id="org-trend-until"
                                    type="date"
                                    className="h-9 w-[160px] text-sm"
                                    value={customTrendUntilDraft}
                                    onChange={(e) => setCustomTrendUntilDraft(e.target.value)}
                                    aria-label="Trend range end UTC date"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" size="sm" variant="secondary" onClick={handleApplyCustomOrgTrendRange}>
                                    Apply range
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleClearCustomOrgTrendRange}
                                    disabled={!orgTrendUsesCustomRange}
                                >
                                    Clear
                                </Button>
                            </div>
                        </fieldset>
                        <WorkflowUsageTrendPanel
                            loading={orgTrendLoading}
                            error={orgTrendError}
                            buckets={orgTrendBuckets}
                            bucketUnit={orgTrendGranularity === 'day' ? 'day' : 'week'}
                            title="All workflows"
                            description={
                                orgTrendUsesCustomRange
                                    ? orgTrendGranularity === 'day'
                                        ? 'UTC calendar days with activity in the selected range; lookback presets are disabled while a custom range is set. Runs stacked inbound vs outbound; line = tokens when recorded.'
                                        : 'UTC weeks with activity in the selected range; lookback presets are disabled while a custom range is set. Runs stacked inbound vs outbound; line = tokens when recorded.'
                                    : orgTrendGranularity === 'day'
                                      ? 'UTC calendar days with activity; runs stacked inbound vs outbound; line = tokens when recorded.'
                                      : 'UTC weeks with activity; runs stacked inbound vs outbound; line = tokens when recorded.'
                            }
                            onWeekClick={handleOrgTrendBarClick}
                            lookbackWeeks={orgTrendLookbackWeeks}
                            onLookbackWeeksChange={
                                orgTrendGranularity === 'week' && !orgTrendUsesCustomRange
                                    ? handleOrgTrendLookbackChange
                                    : undefined
                            }
                            lookbackDays={orgTrendLookbackDays}
                            onLookbackDaysChange={
                                orgTrendGranularity === 'day' && !orgTrendUsesCustomRange
                                    ? handleOrgTrendLookbackDaysChange
                                    : undefined
                            }
                            lookbackSelectorDisabled={orgTrendUsesCustomRange}
                            showExportCsv
                            showExportPng
                            exportCsvFilenameBase={
                                orgTrendGranularity === 'day' ? 'org-usage-daily-trend' : 'org-usage-weekly-trend'
                            }
                        />
                    </CardContent>
                </Card>

                {/* MPS Credits Card */}
                <Card className="ovo-glass-panel mb-6 border-0 bg-transparent shadow-none ring-1 ring-border/30">
                    <CardHeader>
                        <CardTitle>Dograh Model Credits</CardTitle>
                        <CardDescription>
                            These track usage of Dograh models using Dograh Service Keys.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingCredits ? (
                            <div className="animate-pulse space-y-4">
                                <div className="h-4 bg-muted rounded w-1/4"></div>
                                <div className="h-8 bg-muted rounded"></div>
                                <div className="h-4 bg-muted rounded w-1/3"></div>
                            </div>
                        ) : mpsCredits ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-baseline">
                                    <div>
                                        <p className="text-2xl font-bold">
                                            {mpsCredits.total_credits_used.toFixed(2)} <span className="text-lg font-normal text-muted-foreground">/ {mpsCredits.total_quota.toFixed(2)}</span>
                                        </p>
                                        <p className="text-sm text-muted-foreground">Credits Used</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-semibold">{mpsCredits.remaining_credits.toFixed(2)}</p>
                                        <p className="text-sm text-muted-foreground">Remaining</p>
                                    </div>
                                </div>

                                {mpsCredits.total_quota > 0 && (
                                    <Progress value={(mpsCredits.total_credits_used / mpsCredits.total_quota) * 100} className="h-3" />
                                )}
                            </div>
                        ) : (
                            <p className="text-muted-foreground">No Dograh service keys configured. Set up a service key in your model configuration to see usage.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Daily Usage Table - Only for paid organizations */}
                {organizationPricing?.price_per_second_usd && (
                    <div className="mb-6">
                        <DailyUsageTable
                            data={dailyUsage}
                            isLoading={isLoadingDaily}
                        />
                    </div>
                )}

                {/* Filter Builder */}
                <div className="mb-6">
                    <FilterBuilder
                        availableAttributes={usageFilterAttributes}
                        activeFilters={activeFilters}
                        onFiltersChange={handleFiltersChange}
                        onApplyFilters={handleApplyFilters}
                        onClearFilters={handleClearFilters}
                        isExecuting={isExecutingFilters}
                    />
                </div>

                {/* Usage History */}
                <Card id="usage-history-section">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div className="space-y-1.5">
                                <CardTitle>Usage History</CardTitle>
                                <CardDescription>
                                    View detailed usage by workflow run
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoadingHistory ? (
                            <div className="animate-pulse space-y-3">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="h-12 bg-muted rounded"></div>
                                ))}
                            </div>
                        ) : usageHistory && usageHistory.runs.length > 0 ? (
                            <>
                                <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="font-semibold">Run ID</TableHead>
                                                <TableHead className="font-semibold">Agent Name</TableHead>
                                                <TableHead className="font-semibold">Call Type</TableHead>
                                                <TableHead className="font-semibold">Phone Number</TableHead>
                                                <TableHead className="font-semibold">Disposition</TableHead>
                                                <TableHead className="font-semibold">Date</TableHead>
                                                <TableHead className="font-semibold text-right">Duration</TableHead>
                                                <TableHead className="font-semibold text-right">
                                                    {organizationPricing?.price_per_second_usd ? 'Cost (USD)' : 'Dograh Tokens'}
                                                </TableHead>
                                                <TableHead className="font-semibold">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {usageHistory.runs.map((run) => (
                                                <TableRow
                                                    key={run.id}
                                                >
                                                    <TableCell
                                                        className="font-mono text-sm cursor-pointer hover:underline"
                                                        onClick={() => handleRowClick(run)}
                                                    >
                                                        #{run.id}
                                                    </TableCell>
                                                    <TableCell>{run.workflow_name || 'Unknown'}</TableCell>
                                                    <TableCell>
                                                        {run.call_type ? (
                                                            <Badge variant={run.call_type === 'inbound' ? "secondary" : "default"}>
                                                                {run.call_type === 'inbound' ? 'Inbound' : 'Outbound'}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {run.phone_number || '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {run.disposition ? (
                                                            <Badge variant="default">
                                                                {run.disposition}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{formatDateTime(run.created_at)}</TableCell>
                                                    <TableCell className="text-right">
                                                        {formatDuration(run.call_duration_seconds)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {organizationPricing?.price_per_second_usd && run.charge_usd !== undefined && run.charge_usd !== null
                                                            ? `$${run.charge_usd.toFixed(2)}`
                                                            : run.dograh_token_usage.toLocaleString()
                                                        }
                                                    </TableCell>
                                                    <TableCell>
                                                        <MediaPreviewButton
                                                            recordingUrl={run.recording_url}
                                                            transcriptUrl={run.transcript_url}
                                                            runId={run.id}
                                                            onOpenPreview={mediaPreview.openPreview}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Summary */}
                                {activeFilters.length > 0 && (
                                    <div className="mt-4 p-3 bg-muted rounded-md">
                                        <p className="text-sm text-muted-foreground">
                                            Total for filtered period: <span className="font-semibold text-foreground">
                                                {usageHistory.total_dograh_tokens.toLocaleString()} Dograh Tokens
                                            </span>
                                            {' • '}
                                            <span className="font-semibold text-foreground">
                                                {formatDuration(usageHistory.total_duration_seconds)}
                                            </span>
                                        </p>
                                    </div>
                                )}

                                {/* Pagination */}
                                {usageHistory.total_pages > 1 && (
                                    <div className="flex items-center justify-between mt-6">
                                        <p className="text-sm text-muted-foreground">
                                            Page {usageHistory.page} of {usageHistory.total_pages} ({usageHistory.total_count} total runs)
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                                Previous
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage === usageHistory.total_pages}
                                            >
                                                Next
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-center py-8 text-muted-foreground">No usage history found</p>
                        )}
                    </CardContent>
                </Card>

                {/* Media Preview Dialog */}
                {mediaPreview.dialog}
        </div>
    );
}

