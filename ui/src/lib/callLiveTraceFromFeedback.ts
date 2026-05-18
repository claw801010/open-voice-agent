import type { FeedbackMessage } from '@/app/workflow/[workflowId]/run/[runId]/hooks/useWebSocketRTC';

import type { CallLiveTrace, LiveTraceTimelineEntry, ToolInvocationDetail } from './callLiveTraceTypes';

function parseToolResult(text: string): Record<string, unknown> | null {
    const t = text.trim();
    if (!t.startsWith('{')) {
        return null;
    }
    try {
        return JSON.parse(t) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function httpFromParsed(parsed: Record<string, unknown> | null) {
    if (!parsed) return null;
    const status = parsed.status_code ?? parsed.request_status;
    return {
        request_status: typeof status === 'number' ? status : undefined,
        mapped_data:
            parsed.mapped_data && typeof parsed.mapped_data === 'object'
                ? (parsed.mapped_data as Record<string, unknown>)
                : undefined,
        error_message: typeof parsed.error === 'string' ? parsed.error : undefined,
    };
}

/** Build API-shaped live trace from WebSocket feedback messages during an active test call. */
export function buildLiveTraceFromFeedback(messages: FeedbackMessage[]): CallLiveTrace {
    const timeline: LiveTraceTimelineEntry[] = [];
    const toolInvocations: ToolInvocationDetail[] = [];
    const ttfbMs: number[] = [];
    const models = new Set<string>();

    const runningTools = new Map<string, { name: string; startedAt: string }>();

    for (const msg of messages) {
        if (msg.type === 'user-transcription' && msg.final) {
            timeline.push({
                kind: 'conversation',
                role: 'user',
                summary: msg.text.slice(0, 240),
                timestamp: msg.timestamp,
            });
        } else if (msg.type === 'bot-text') {
            timeline.push({
                kind: 'conversation',
                role: 'assistant',
                summary: msg.text.slice(0, 240),
                timestamp: msg.timestamp,
            });
        } else if (msg.type === 'ttfb-metric') {
            const ms = msg.ttfbSeconds != null ? Math.round(msg.ttfbSeconds * 1000) : null;
            if (ms != null) ttfbMs.push(ms);
            if (msg.model) models.add(msg.model);
            timeline.push({
                kind: 'llm',
                summary: 'Model inference',
                timestamp: msg.timestamp,
                ttfb_ms: ms,
                processor: msg.processor,
                model: msg.model,
            });
        } else if (msg.type === 'function-call') {
            const tcId = msg.id.replace(/^func-/, '');
            if (msg.status === 'running') {
                runningTools.set(tcId, {
                    name: msg.functionName || msg.text,
                    startedAt: msg.timestamp,
                });
                timeline.push({
                    kind: 'tool',
                    summary: `${msg.functionName || msg.text}…`,
                    timestamp: msg.timestamp,
                    tool_name: msg.functionName || msg.text,
                });
            } else {
                const start = runningTools.get(tcId);
                runningTools.delete(tcId);
                const parsed = parseToolResult(msg.text);
                const http = httpFromParsed(parsed);
                const ok =
                    http?.request_status != null
                        ? http.request_status >= 200 && http.request_status < 300
                        : parsed?.status !== 'error';
                timeline.push({
                    kind: 'tool',
                    summary: start?.name || msg.functionName || 'tool',
                    timestamp: msg.timestamp,
                    tool_name: start?.name || msg.functionName,
                    success: ok,
                    http_status: http?.request_status ?? null,
                });
                toolInvocations.push({
                    tool_call_id: tcId,
                    tool_name: start?.name || msg.functionName || 'unknown',
                    started_at: start?.startedAt,
                    ended_at: msg.timestamp,
                    duration_ms: 0,
                    success: ok,
                    http,
                    receive: parsed
                        ? {
                              status: typeof parsed.status === 'string' ? parsed.status : undefined,
                              status_code:
                                  typeof parsed.status_code === 'number' ? parsed.status_code : undefined,
                              mapped_data:
                                  parsed.mapped_data && typeof parsed.mapped_data === 'object'
                                      ? (parsed.mapped_data as Record<string, unknown>)
                                      : undefined,
                              error: typeof parsed.error === 'string' ? parsed.error : undefined,
                              data_preview:
                                  typeof parsed.data === 'string'
                                      ? parsed.data.slice(0, 400)
                                      : undefined,
                          }
                        : null,
                });
            }
        } else if (msg.type === 'node-transition') {
            timeline.push({
                kind: 'system',
                summary: `Node → ${msg.nodeName || msg.text}`,
                timestamp: msg.timestamp,
            });
        } else if (msg.type === 'pipeline-error') {
            timeline.push({
                kind: 'error',
                summary: msg.text.slice(0, 200),
                timestamp: msg.timestamp,
                fatal: msg.fatal,
            });
        }
    }

    return {
        timeline,
        tool_invocations: toolInvocations,
        llm_inference: {
            inference_count: ttfbMs.length,
            avg_ttfb_ms: ttfbMs.length ? Math.round(ttfbMs.reduce((a, b) => a + b, 0) / ttfbMs.length) : null,
            max_ttfb_ms: ttfbMs.length ? Math.max(...ttfbMs) : null,
            models: [...models].sort(),
        },
    };
}
