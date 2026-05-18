/**
 * Call analytics REST (MK-01) — typed SDK from full OpenAPI snapshot.
 * Regenerate: `bash scripts/generate_ui_openapi_client.sh --full --offline`
 */
import { createClient } from '@/client/client';
import {
    exportAnalyticsCallsCsvApiV1AnalyticsCallsExportGet,
    getAnalyticsCallApiV1AnalyticsCallsCallIdGet,
    getAnalyticsDashboardLayoutApiV1AnalyticsDashboardLayoutGet,
    getAnalyticsInsightsApiV1AnalyticsInsightsGet,
    getAnalyticsQmExportScheduleApiV1AnalyticsQmExportScheduleGet,
    getAnalyticsQmScorecardApiV1AnalyticsQmScorecardGet,
    getAnalyticsRedactionPolicyApiV1AnalyticsRedactionPolicyGet,
    listAnalyticsCallsApiV1AnalyticsCallsGet,
    putAnalyticsDashboardLayoutApiV1AnalyticsDashboardLayoutPut,
    putAnalyticsQmExportScheduleApiV1AnalyticsQmExportSchedulePut,
    putAnalyticsQmScorecardApiV1AnalyticsQmScorecardPut,
    putAnalyticsRedactionPolicyApiV1AnalyticsRedactionPolicyPut,
} from '@/client/sdk.gen';
import type {
    AnalyticsRedactionPolicyResponse,
    CallDetailResponse,
    CallListItemResponse,
    CallListPageResponse,
    CallMetricsResponse,
    ContainmentMixItemResponse,
    HttpToolSpanSummaryResponse,
    InsightsQualitySummaryResponse,
    InsightsResponse,
    OutcomeMixItemResponse,
    QaQmSummaryResponse,
    QmExportLastRunResponse,
    QmExportScheduleGetResponse,
    QmExportScheduleSettingsResponse,
    QmScorecardPutBody,
    ToolHealthItemResponse,
    ToolNameMixItemResponse,
    ToolSpanResponse,
} from '@/client/types.gen';
import { createClientConfig, setupAuthInterceptor } from '@/lib/apiClient';

export type AnalyticsCallListItem = CallListItemResponse;
export type AnalyticsCallListPage = CallListPageResponse;
export type HttpToolSpanSummary = HttpToolSpanSummaryResponse;
export type AnalyticsToolSpan = ToolSpanResponse;
export type AnalyticsCallMetrics = CallMetricsResponse;
export type AnalyticsQaSummary = QaQmSummaryResponse;
export type AnalyticsInsightsOutcomeMixItem = OutcomeMixItemResponse;
export type AnalyticsInsightsToolNameMixItem = ToolNameMixItemResponse;
export type AnalyticsInsightsContainmentMixItem = ContainmentMixItemResponse;
export type AnalyticsInsightsToolHealthItem = ToolHealthItemResponse;
export type AnalyticsInsightsQualitySummary = InsightsQualitySummaryResponse;
export type AnalyticsInsights = InsightsResponse;
export type AnalyticsCallDetail = CallDetailResponse;

export type CallScorecardPayload = {
    rubric_version?: number;
    criteria: Array<{
        criterion_id: string;
        label: string;
        description?: string | null;
        pass: boolean | null;
        note?: string | null;
        source_node?: string | null;
    }>;
    summary: {
        evaluated_count: number;
        passed_count: number;
        pass_rate: number | null;
        total_criteria: number;
    };
};

export type QmScorecardRubric = {
    v: number;
    criteria: Array<{ id: string; label: string; description?: string | null }>;
};

/** Same shape as stored org config + localStorage (`normalize_analytics_dashboard_layout` on the server). */
export type AnalyticsDashboardLayoutPayload = {
    v: 1;
    widgets: { id: string; type: string }[];
};

export type AnalyticsRedactionPolicy = AnalyticsRedactionPolicyResponse;
export type AnalyticsQmExportScheduleSettings = QmExportScheduleSettingsResponse;
export type AnalyticsQmExportLastRun = QmExportLastRunResponse;
export type AnalyticsQmExportScheduleResponse = QmExportScheduleGetResponse;

/** Aligns with `QM_EXPORT_CRON_DISPATCH_MINUTE_UTC` in the API QM schedule module. */
export const QM_EXPORT_CRON_DISPATCH_MINUTE_UTC = 47;

function analyticsClient(getAccessToken: () => Promise<string>) {
    const client = createClient(createClientConfig());
    setupAuthInterceptor(client, getAccessToken);
    return client;
}

function apiErrorMessage(error: unknown, status?: number): string {
    if (error && typeof error === 'object' && 'detail' in error) {
        const d = (error as { detail: unknown }).detail;
        if (typeof d === 'string') {
            return d;
        }
        if (Array.isArray(d) && d.length > 0) {
            return String(d[0]);
        }
    }
    if (typeof error === 'string') {
        return error;
    }
    return status ? `Request failed (${status})` : 'Request failed';
}

function throwApiError(error: unknown, status?: number): never {
    const err = new Error(apiErrorMessage(error, status));
    if (status != null) {
        Object.assign(err, { status });
    }
    throw err;
}

function asQmScorecardRubric(scorecard: { [key: string]: unknown }): QmScorecardRubric {
    return scorecard as QmScorecardRubric;
}

/** Live preview of the next dispatch instant (same rules as GET qm-export-schedule). */
export function previewNextQmExportDispatchUtc(opts: {
    now?: Date;
    hourUtc: number;
    enabled: boolean;
    cronEnabled: boolean;
    cronMinuteUtc?: number;
}): string | null {
    const cronMinuteUtc = opts.cronMinuteUtc ?? QM_EXPORT_CRON_DISPATCH_MINUTE_UTC;
    if (!opts.enabled || !opts.cronEnabled) return null;
    const now = opts.now ?? new Date();
    const y = now.getUTCFullYear();
    const mo = now.getUTCMonth();
    const d = now.getUTCDate();
    let candMs = Date.UTC(y, mo, d, opts.hourUtc, cronMinuteUtc, 0, 0);
    if (candMs <= now.getTime()) {
        const dt = new Date(candMs);
        dt.setUTCDate(dt.getUTCDate() + 1);
        candMs = dt.getTime();
    }
    return new Date(candMs).toISOString();
}

export async function fetchAnalyticsInsights(
    getAccessToken: () => Promise<string>,
    params: {
        days?: number;
        since?: string;
        until?: string;
        workflow_id?: number;
        catalog_slug?: string;
        catalog_variant_id?: string;
    } = {},
): Promise<AnalyticsInsights> {
    const client = analyticsClient(getAccessToken);
    const { data, error, response } = await getAnalyticsInsightsApiV1AnalyticsInsightsGet({
        client,
        query: {
            days: params.days ?? 7,
            since: params.since ?? null,
            until: params.until ?? null,
            workflow_id: params.workflow_id ?? null,
            catalog_slug: params.catalog_slug ?? null,
            catalog_variant_id: params.catalog_variant_id ?? null,
        },
    });
    if (error || !data) {
        throwApiError(error, response?.status);
    }
    return data;
}

export async function fetchAnalyticsCallsPage(
    getAccessToken: () => Promise<string>,
    params: {
        workflow_id?: number;
        catalog_slug?: string;
        catalog_variant_id?: string;
        since?: string;
        until?: string;
        disposition?: string;
        outcome_key?: string;
        tool_name?: string;
        limit?: number;
        cursor?: string | null;
        include_qm_summary?: boolean;
    },
): Promise<AnalyticsCallListPage> {
    const client = analyticsClient(getAccessToken);
    const { data, error, response } = await listAnalyticsCallsApiV1AnalyticsCallsGet({
        client,
        query: {
            workflow_id: params.workflow_id ?? null,
            catalog_slug: params.catalog_slug ?? null,
            catalog_variant_id: params.catalog_variant_id ?? null,
            since: params.since ?? null,
            until: params.until ?? null,
            disposition: params.disposition ?? null,
            outcome_key: params.outcome_key ?? null,
            tool_name: params.tool_name ?? null,
            limit: params.limit ?? 50,
            cursor: params.cursor ?? null,
            include_qm_summary: params.include_qm_summary ?? false,
        },
    });
    if (error || !data) {
        throwApiError(error, response?.status);
    }
    return data;
}

/**
 * Server-side CSV: same filters as the call list (no cursor), up to `max_rows` (default 5000).
 * Opens a browser download; requires auth like other analytics routes.
 */
export async function downloadAnalyticsCallsServerExport(
    getAccessToken: () => Promise<string>,
    params: {
        workflow_id?: number;
        catalog_slug?: string;
        catalog_variant_id?: string;
        since?: string;
        until?: string;
        disposition?: string;
        outcome_key?: string;
        tool_name?: string;
        max_rows?: number;
        sampling_mode?: 'fifo' | 'smart';
    },
): Promise<void> {
    const client = analyticsClient(getAccessToken);
    const { data, error, response } = await exportAnalyticsCallsCsvApiV1AnalyticsCallsExportGet({
        client,
        query: {
            workflow_id: params.workflow_id ?? null,
            catalog_slug: params.catalog_slug ?? null,
            catalog_variant_id: params.catalog_variant_id ?? null,
            since: params.since ?? null,
            until: params.until ?? null,
            disposition: params.disposition ?? null,
            outcome_key: params.outcome_key ?? null,
            tool_name: params.tool_name ?? null,
            max_rows: params.max_rows ?? 5000,
            sampling_mode: params.sampling_mode ?? 'smart',
        },
        parseAs: 'blob',
        headers: { Accept: 'text/csv' },
    });
    if (error || !data) {
        throwApiError(error, response?.status);
    }
    const blob = data instanceof Blob ? data : new Blob([String(data)]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `analytics-calls-export-${stamp}.csv`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function fetchAnalyticsDashboardLayout(
    getAccessToken: () => Promise<string>,
): Promise<AnalyticsDashboardLayoutPayload | null> {
    const client = analyticsClient(getAccessToken);
    const { data, error, response } = await getAnalyticsDashboardLayoutApiV1AnalyticsDashboardLayoutGet({
        client,
    });
    if (error) {
        throwApiError(error, response?.status);
    }
    if (data == null || typeof data !== 'object' || !('layout' in data)) {
        return null;
    }
    const layout = (data as { layout: unknown }).layout;
    if (layout == null || typeof layout !== 'object') {
        return null;
    }
    return layout as AnalyticsDashboardLayoutPayload;
}

export async function fetchAnalyticsRedactionPolicy(
    getAccessToken: () => Promise<string>,
): Promise<AnalyticsRedactionPolicy> {
    const client = analyticsClient(getAccessToken);
    const { data, error, response } = await getAnalyticsRedactionPolicyApiV1AnalyticsRedactionPolicyGet({
        client,
    });
    if (error || !data) {
        throwApiError(error, response?.status);
    }
    return data;
}

export async function fetchAnalyticsQmExportSchedule(
    getAccessToken: () => Promise<string>,
): Promise<AnalyticsQmExportScheduleResponse> {
    const client = analyticsClient(getAccessToken);
    const { data, error, response } = await getAnalyticsQmExportScheduleApiV1AnalyticsQmExportScheduleGet({
        client,
    });
    if (error || !data) {
        throwApiError(error, response?.status);
    }
    return data;
}

export async function fetchAnalyticsQmScorecard(
    getAccessToken: () => Promise<string>,
): Promise<{ scorecard: QmScorecardRubric; qa_prompt_hint: string }> {
    const client = analyticsClient(getAccessToken);
    const { data, error, response } = await getAnalyticsQmScorecardApiV1AnalyticsQmScorecardGet({
        client,
    });
    if (error || !data) {
        throw new Error(apiErrorMessage(error, response?.status));
    }
    return {
        scorecard: asQmScorecardRubric(data.scorecard),
        qa_prompt_hint: data.qa_prompt_hint ?? '',
    };
}

export async function putAnalyticsQmScorecard(
    getAccessToken: () => Promise<string>,
    criteria: QmScorecardRubric['criteria'],
): Promise<{ scorecard: QmScorecardRubric; qa_prompt_hint: string }> {
    const client = analyticsClient(getAccessToken);
    const body: QmScorecardPutBody = { criteria };
    const { data, error, response } = await putAnalyticsQmScorecardApiV1AnalyticsQmScorecardPut({
        client,
        body,
    });
    if (error || !data) {
        throw new Error(apiErrorMessage(error, response?.status));
    }
    return {
        scorecard: asQmScorecardRubric(data.scorecard),
        qa_prompt_hint: data.qa_prompt_hint ?? '',
    };
}

export async function putAnalyticsQmExportSchedule(
    getAccessToken: () => Promise<string>,
    body: AnalyticsQmExportScheduleSettings,
): Promise<AnalyticsQmExportScheduleResponse> {
    const client = analyticsClient(getAccessToken);
    const { data, error, response } = await putAnalyticsQmExportScheduleApiV1AnalyticsQmExportSchedulePut({
        client,
        body: {
            enabled: body.enabled,
            hour_utc: body.hour_utc,
            window_days: body.window_days,
            max_rows: body.max_rows,
            sampling_mode: body.sampling_mode,
            workflow_id: body.workflow_id,
            catalog_slug: body.catalog_slug,
            catalog_variant_id: body.catalog_variant_id,
        },
    });
    if (error || !data) {
        throwApiError(error, response?.status);
    }
    return data;
}

export async function putAnalyticsRedactionPolicy(
    getAccessToken: () => Promise<string>,
    policy: Pick<AnalyticsRedactionPolicy, 'detail_redaction_enabled'>,
): Promise<AnalyticsRedactionPolicy> {
    const client = analyticsClient(getAccessToken);
    const { data, error, response } = await putAnalyticsRedactionPolicyApiV1AnalyticsRedactionPolicyPut({
        client,
        body: policy,
    });
    if (error || !data) {
        throwApiError(error, response?.status);
    }
    return data;
}

export async function putAnalyticsDashboardLayout(
    getAccessToken: () => Promise<string>,
    layout: AnalyticsDashboardLayoutPayload,
): Promise<void> {
    const client = analyticsClient(getAccessToken);
    const { error, response } = await putAnalyticsDashboardLayoutApiV1AnalyticsDashboardLayoutPut({
        client,
        body: { layout },
    });
    if (error) {
        throwApiError(error, response?.status);
    }
}

export async function fetchAnalyticsCallDetail(
    getAccessToken: () => Promise<string>,
    callId: string,
): Promise<AnalyticsCallDetail | null> {
    const client = analyticsClient(getAccessToken);
    const { data, error, response } = await getAnalyticsCallApiV1AnalyticsCallsCallIdGet({
        client,
        path: { call_id: callId },
    });
    if (response?.status === 404) {
        return null;
    }
    if (error || !data) {
        throwApiError(error, response?.status);
    }
    return data;
}
