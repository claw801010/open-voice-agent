/**
 * Call analytics REST (MK-01-ANALYTICS-VERTICAL) until OpenAPI client is regenerated.
 * @see api/routes/analytics.py
 */
import { getBackendPublicBaseUrl } from '@/lib/apiClient';

export type AnalyticsCallListItem = {
    call_id: string;
    workflow_id: number;
    workflow_slug: string | null;
    started_at: string;
    duration_ms: number;
    disposition: string | null;
    outcome_key: string | null;
    tool_names: string[];
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

export type AnalyticsCallDetail = {
    call_id: string;
    workflow_id: number;
    workflow_slug?: string | null;
    started_at: string;
    ended_at?: string | null;
    duration_ms: number;
    metrics: AnalyticsCallMetrics;
    outcomes: Record<string, unknown>;
    tool_spans: AnalyticsToolSpan[];
    ai_summary?: string | null;
    qa?: AnalyticsQaSummary | null;
};

function buildListQuery(params: {
    workflow_id?: number;
    since?: string;
    until?: string;
    disposition?: string;
    outcome_key?: string;
    tool_name?: string;
    limit?: number;
    cursor?: string | null;
}): string {
    const q = new URLSearchParams();
    if (params.workflow_id != null) q.set('workflow_id', String(params.workflow_id));
    if (params.since) q.set('since', params.since);
    if (params.until) q.set('until', params.until);
    if (params.disposition) q.set('disposition', params.disposition);
    if (params.outcome_key) q.set('outcome_key', params.outcome_key);
    if (params.tool_name) q.set('tool_name', params.tool_name);
    if (params.limit != null) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', params.cursor);
    const s = q.toString();
    return s ? `?${s}` : '';
}

export async function fetchAnalyticsCallsPage(
    getAccessToken: () => Promise<string>,
    params: {
        workflow_id?: number;
        since?: string;
        until?: string;
        disposition?: string;
        outcome_key?: string;
        tool_name?: string;
        limit?: number;
        cursor?: string | null;
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
