import { describe, expect, it } from 'vitest';

import type { FeedbackMessage } from '@/app/workflow/[workflowId]/run/[runId]/hooks/useWebSocketRTC';

import { buildLiveTraceFromFeedback } from './callLiveTraceFromFeedback';

describe('buildLiveTraceFromFeedback', () => {
    it('maps function-call completion to tool invocations', () => {
        const messages: FeedbackMessage[] = [
            {
                id: 'func-tc1',
                type: 'function-call',
                text: 'book_slot',
                functionName: 'book_slot',
                status: 'running',
                timestamp: '2026-01-15T10:00:00.000Z',
            },
            {
                id: 'func-tc1',
                type: 'function-call',
                text: JSON.stringify({ status: 'success', status_code: 200, mapped_data: { ok: true } }),
                functionName: 'book_slot',
                status: 'completed',
                timestamp: '2026-01-15T10:00:01.000Z',
            },
        ];
        const trace = buildLiveTraceFromFeedback(messages);
        expect(trace.tool_invocations).toHaveLength(1);
        expect(trace.tool_invocations[0].success).toBe(true);
        expect(trace.timeline.some((e) => e.kind === 'tool')).toBe(true);
    });
});
