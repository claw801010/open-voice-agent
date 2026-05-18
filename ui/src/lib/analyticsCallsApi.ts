/**
 * Call analytics REST (MK-01-ANALYTICS-VERTICAL) until OpenAPI client is regenerated.
 * @see api/routes/analytics.py
 */
import { getBackendPublicBaseUrl } from '@/lib/apiClient';

export type AnalyticsCallListItem = {
    call_id: string;
    workflow_id: number;
    workflow_slug: string | null;
    /** MK-01 `workflow_configurations.mk01.catalog_variant_id` when set at install */
    catalog_variant_id?: string | null;
    started_at: string;
    duration_ms: number;
    disposition: string | null;
    outcome_key: string | null;
    tool_names: string[];
    /** Set when list is fetched with `include_qm_summary=true` */
    cx_score?: number | null;
    containment?: string | null;
    qa_score?: number | null;
    scorecard_pass_rate?: number | null;
};

export type AnalyticsCallListPage = {
    items: AnalyticsCallListItem[];
    next_cursor: string | null;
};

export type HttpToolSpanSummary = {
    method?: string | null;
    url_template?: string | null;
    request_status?: number | null;
    mapped_data?: Record<string, unknown> | null;
    error_message?: string | null;
};

export type AnalyticsToolSpan = {
    span_id: string;
    tool_name: string;
    tool_type: string;
    started_at: string;
    duration_ms: number;
    http: HttpToolSpanSummary | null;
};

export type AnalyticsCallMetrics = {
    llm_rounds: number;
    tool_invocation_count: number;
    stt_seconds?: number | null;
    tts_seconds?: number | null;
};

export type AnalyticsQaSummary = {
    score?: number | null;
    flags?: string[];
    reviewer_notes?: string | null;
};

export type AnalyticsInsightsOutcomeMixItem = {
    outcome: string;
    count: number;
};

export type AnalyticsInsightsToolNameMixItem = {
    tool_name: string;
    count: number;
};

export type AnalyticsInsightsContainmentMixItem = {
    containment: string;
    count: number;
};

export type AnalyticsInsightsToolHealthItem = {
    function_name: string;
    invocation_count: number;
    success_count: number;
    success_rate: number;
    failed_invocations: number;
};

export type AnalyticsInsightsQualitySummary = {
    sampled_calls: number;
    sample_capped: boolean;
    avg_cx_score: number | null;
    containment_mix: AnalyticsInsightsContainmentMixItem[];
    calls_with_qa: number;
    avg_qa_score: number | null;
    avg_tool_success_rate: number | null;
    tool_health: AnalyticsInsightsToolHealthItem[];
};

export type AnalyticsInsights = {
    total_calls: number;
    calls_with_outcome: number;
    /** Canonical when present: runs with tool evidence in logs and/or `analytics_http_tool_spans`. */
    calls_with_tool_evidence?: number;
    /** Same integer as `calls_with_tool_evidence` when API returns both (legacy key). */
    calls_with_logged_tools: number;
    outcome_mix: AnalyticsInsightsOutcomeMixItem[];
    /** Distinct runs per `function_name`, top 15. */
    tool_name_mix: AnalyticsInsightsToolNameMixItem[];
    quality_summary: AnalyticsInsightsQualitySummary;
    since: string;
    until: string;
};

export type AnalyticsCallDetail = {
    call_id: string;
    workflow_id: number;
    workflow_slug?: string | null;
    catalog_variant_id?: string | null;
    started_at: string;
    ended_at?: string | null;
    duration_ms: number;
    metrics: AnalyticsCallMetrics;
    outcomes: Record<string, unknown>;
    tool_spans: AnalyticsToolSpan[];
    transcript?: string | null;
    ai_summary?: string | null;
    qa?: AnalyticsQaSummary | null;
    follow_ups?: Array<Record<string, unknown>>;
    live_trace?: {
        timeline: Array<Record<string, unknown>>;
        tool_invocations: Array<Record<string, unknown>>;
        llm_inference: {
            inference_count: number;
            avg_ttfb_ms: number | null;
            max_ttfb_ms: number | null;
            models: string[];
        };
    } | null;
    quality_report?: {
        containment: string;
        cx_score: number;
        qa_score?: number | null;
        qa_flags: string[];
        outcome_key?: string | null;
        outcomes: Record<string, unknown>;
        tool_invocation_count: number;
        tool_success_rate: number | null;
        llm_inference: {
            inference_count: number;
            avg_ttfb_ms: number | null;
            max_ttfb_ms: number | null;
            models: string[];
        };
        tool_functions: Array<{
            function_name: string;
            invocation_count: number;
            success_count: number;
            success_rate: number;
            avg_duration_ms: number | null;
        }>;
        error_count: number;
        duration_ms: number;
    } | null;
    scorecard?: CallScorecardPayload | null;
    engineering_links?: {
        langfuse_trace_url?: string;
    };
};

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

function buildExportQuery(params: {
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
}): string {
    const q = new URLSearchParams();
    if (params.workflow_id != null) q.set('workflow_id', String(params.workflow_id));
    if (params.catalog_slug) q.set('catalog_slug', params.catalog_slug);
    if (params.catalog_variant_id) q.set('catalog_variant_id', params.catalog_variant_id);
    if (params.since) q.set('since', params.since);
    if (params.until) q.set('until', params.until);
    if (params.disposition) q.set('disposition', params.disposition);
    if (params.outcome_key) q.set('outcome_key', params.outcome_key);
    if (params.tool_name) q.set('tool_name', params.tool_name);
    if (params.max_rows != null) q.set('max_rows', String(params.max_rows));
    if (params.sampling_mode) q.set('sampling_mode', params.sampling_mode);
    const s = q.toString();
    return s ? `?${s}` : '';
}

function buildListQuery(params: {
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
}): string {
    const q = new URLSearchParams();
    if (params.workflow_id != null) q.set('workflow_id', String(params.workflow_id));
    if (params.catalog_slug) q.set('catalog_slug', params.catalog_slug);
    if (params.catalog_variant_id) q.set('catalog_variant_id', params.catalog_variant_id);
    if (params.since) q.set('since', params.since);
    if (params.until) q.set('until', params.until);
    if (params.disposition) q.set('disposition', params.disposition);
    if (params.outcome_key) q.set('outcome_key', params.outcome_key);
    if (params.tool_name) q.set('tool_name', params.tool_name);
    if (params.limit != null) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', params.cursor);
    if (params.include_qm_summary) q.set('include_qm_summary', 'true');
    const s = q.toString();
    return s ? `?${s}` : '';
}

function buildInsightsQuery(params: {
    days?: number;
    since?: string;
    until?: string;
    workflow_id?: number;
    catalog_slug?: string;
    catalog_variant_id?: string;
}): string {
    const q = new URLSearchParams();
    if (params.days != null) q.set('days', String(params.days));
    if (params.since) q.set('since', params.since);
    if (params.until) q.set('until', params.until);
    if (params.workflow_id != null) q.set('workflow_id', String(params.workflow_id));
    if (params.catalog_slug) q.set('catalog_slug', params.catalog_slug);
    if (params.catalog_variant_id) q.set('catalog_variant_id', params.catalog_variant_id);
    const s = q.toString();
    return s ? `?${s}` : '';
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
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const query = buildInsightsQuery({ ...params, days: params.days ?? 7 });
    const res = await fetch(`${base}/api/v1/analytics/insights${query}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
        },
    });
    if (!res.ok) {
        const text = await res.text();
        const err = new Error(text || `HTTP ${res.status}`);
        Object.assign(err, { status: res.status });
        throw err;
    }
    return res.json() as Promise<AnalyticsInsights>;
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
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const query = buildListQuery({
        ...params,
        limit: params.limit ?? 50,
        cursor: params.cursor ?? undefined,
    });
    const res = await fetch(`${base}/api/v1/analytics/calls${query}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
        },
    });
    if (!res.ok) {
        const text = await res.text();
        const err = new Error(text || `HTTP ${res.status}`);
        Object.assign(err, { status: res.status });
        throw err;
    }
    return res.json() as Promise<AnalyticsCallListPage>;
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
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const query = buildExportQuery({
        ...params,
        max_rows: params.max_rows ?? 5000,
        sampling_mode: params.sampling_mode ?? 'smart',
    });
    const res = await fetch(`${base}/api/v1/analytics/calls/export${query}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/csv',
        },
    });
    if (!res.ok) {
        const text = await res.text();
        const err = new Error(text || `HTTP ${res.status}`);
        Object.assign(err, { status: res.status });
        throw err;
    }
    const blob = await res.blob();
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

/** Same shape as stored org config + localStorage (`normalize_analytics_dashboard_layout` on the server). */
export type AnalyticsDashboardLayoutPayload = {
    v: 1;
    widgets: { id: string; type: string }[];
};

export async function fetchAnalyticsDashboardLayout(
    getAccessToken: () => Promise<string>,
): Promise<AnalyticsDashboardLayoutPayload | null> {
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const res = await fetch(`${base}/api/v1/analytics/dashboard-layout`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
        },
    });
    if (!res.ok) {
        const text = await res.text();
        const err = new Error(text || `HTTP ${res.status}`);
        Object.assign(err, { status: res.status });
        throw err;
    }
    const data = (await res.json()) as { layout: unknown };
    const layout = data.layout;
    if (layout == null) return null;
    if (typeof layout !== 'object' || layout === null) return null;
    return layout as AnalyticsDashboardLayoutPayload;
}

export type AnalyticsRedactionPolicy = {
    detail_redaction_enabled: boolean;
    /** Server: whether this principal may set detail_redaction_enabled to false. */
    may_disable_detail_redaction?: boolean;
};

export async function fetchAnalyticsRedactionPolicy(
    getAccessToken: () => Promise<string>,
): Promise<AnalyticsRedactionPolicy> {
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const res = await fetch(`${base}/api/v1/analytics/redaction-policy`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
        },
    });
    if (!res.ok) {
        const text = await res.text();
        const err = new Error(text || `HTTP ${res.status}`);
        Object.assign(err, { status: res.status });
        throw err;
    }
    return res.json() as Promise<AnalyticsRedactionPolicy>;
}

export type AnalyticsQmExportScheduleSettings = {
    enabled: boolean;
    hour_utc: number;
    window_days: number;
    max_rows: number;
    sampling_mode: 'fifo' | 'smart';
    workflow_id: number | null;
    catalog_slug: string | null;
    catalog_variant_id: string | null;
};

export type AnalyticsQmExportLastRun = {
    started_at: string | null;
    finished_at: string | null;
    status: string | null;
    object_key: string | null;
    error_message: string | null;
};

export type AnalyticsQmExportScheduleResponse = {
    schedule: AnalyticsQmExportScheduleSettings;
    last_run: AnalyticsQmExportLastRun;
    /** True when deployment workers run hourly ARQ cron dispatch. */
    cron_enabled: boolean;
    /** ISO UTC when the next cron slot may enqueue this org; null if disabled or cron off. */
    next_run_at_utc: string | null;
};

/** Aligns with `QM_EXPORT_CRON_DISPATCH_MINUTE_UTC` in the API QM schedule module. */
export const QM_EXPORT_CRON_DISPATCH_MINUTE_UTC = 47;

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

export async function fetchAnalyticsQmExportSchedule(
    getAccessToken: () => Promise<string>,
): Promise<AnalyticsQmExportScheduleResponse> {
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const res = await fetch(`${base}/api/v1/analytics/qm-export-schedule`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
        },
    });
    if (!res.ok) {
        const text = await res.text();
        const err = new Error(text || `HTTP ${res.status}`);
        Object.assign(err, { status: res.status });
        throw err;
    }
    return res.json() as Promise<AnalyticsQmExportScheduleResponse>;
}

export async function fetchAnalyticsQmScorecard(
    getAccessToken: () => Promise<string>,
): Promise<{ scorecard: QmScorecardRubric; qa_prompt_hint: string }> {
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const res = await fetch(`${base}/api/v1/analytics/qm-scorecard`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json() as Promise<{ scorecard: QmScorecardRubric; qa_prompt_hint: string }>;
}

export async function putAnalyticsQmScorecard(
    getAccessToken: () => Promise<string>,
    criteria: QmScorecardRubric['criteria'],
): Promise<{ scorecard: QmScorecardRubric; qa_prompt_hint: string }> {
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const res = await fetch(`${base}/api/v1/analytics/qm-scorecard`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ criteria }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json() as Promise<{ scorecard: QmScorecardRubric; qa_prompt_hint: string }>;
}

export async function putAnalyticsQmExportSchedule(
    getAccessToken: () => Promise<string>,
    body: AnalyticsQmExportScheduleSettings,
): Promise<AnalyticsQmExportScheduleResponse> {
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const res = await fetch(`${base}/api/v1/analytics/qm-export-schedule`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        const err = new Error(text || `HTTP ${res.status}`);
        Object.assign(err, { status: res.status });
        throw err;
    }
    return res.json() as Promise<AnalyticsQmExportScheduleResponse>;
}

export async function putAnalyticsRedactionPolicy(
    getAccessToken: () => Promise<string>,
    policy: Pick<AnalyticsRedactionPolicy, 'detail_redaction_enabled'>,
): Promise<AnalyticsRedactionPolicy> {
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const res = await fetch(`${base}/api/v1/analytics/redaction-policy`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(policy),
    });
    if (!res.ok) {
        const text = await res.text();
        const err = new Error(text || `HTTP ${res.status}`);
        Object.assign(err, { status: res.status });
        throw err;
    }
    return res.json() as Promise<AnalyticsRedactionPolicy>;
}

export async function putAnalyticsDashboardLayout(
    getAccessToken: () => Promise<string>,
    layout: AnalyticsDashboardLayoutPayload,
): Promise<void> {
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const res = await fetch(`${base}/api/v1/analytics/dashboard-layout`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ layout }),
    });
    if (!res.ok) {
        const text = await res.text();
        const err = new Error(text || `HTTP ${res.status}`);
        Object.assign(err, { status: res.status });
        throw err;
    }
}

export async function fetchAnalyticsCallDetail(
    getAccessToken: () => Promise<string>,
    callId: string,
): Promise<AnalyticsCallDetail | null> {
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const enc = encodeURIComponent(callId);
    const res = await fetch(`${base}/api/v1/analytics/calls/${enc}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
        },
    });
    if (res.status === 404) {
        return null;
    }
    if (!res.ok) {
        const text = await res.text();
        const err = new Error(text || `HTTP ${res.status}`);
        Object.assign(err, { status: res.status });
        throw err;
    }
    return res.json() as Promise<AnalyticsCallDetail>;
}
