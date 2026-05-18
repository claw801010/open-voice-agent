/** Mirrors API `live_trace` + `quality_report` on call detail. */

export type LiveTraceTimelineEntry = {
    kind: 'conversation' | 'tool' | 'llm' | 'system' | 'error';
    role?: 'user' | 'assistant';
    summary: string;
    timestamp?: string;
    turn?: number;
    tool_name?: string;
    success?: boolean;
    http_status?: number | null;
    ttfb_ms?: number | null;
    processor?: string;
    model?: string;
    fatal?: boolean;
};

export type ToolInvocationDetail = {
    tool_call_id: string;
    tool_name: string;
    started_at?: string;
    ended_at?: string;
    duration_ms: number;
    success: boolean;
    http?: {
        request_status?: number;
        mapped_data?: Record<string, unknown>;
        error_message?: string;
    } | null;
    receive?: {
        status?: string;
        status_code?: number;
        mapped_data?: Record<string, unknown>;
        error?: string;
        data_preview?: string;
    } | null;
};

export type CallLiveTrace = {
    timeline: LiveTraceTimelineEntry[];
    tool_invocations: ToolInvocationDetail[];
    llm_inference: {
        inference_count: number;
        avg_ttfb_ms: number | null;
        max_ttfb_ms: number | null;
        models: string[];
    };
};

export type ToolFunctionReportRow = {
    function_name: string;
    invocation_count: number;
    success_count: number;
    success_rate: number;
    avg_duration_ms: number | null;
};

export type CallQualityReport = {
    containment: 'contained' | 'partial' | 'escalated' | 'unknown' | string;
    cx_score: number;
    qa_score?: number | null;
    qa_flags: string[];
    outcome_key?: string | null;
    outcomes: Record<string, unknown>;
    tool_invocation_count: number;
    tool_success_rate: number | null;
    llm_inference: CallLiveTrace['llm_inference'];
    tool_functions: ToolFunctionReportRow[];
    error_count: number;
    duration_ms: number;
};
