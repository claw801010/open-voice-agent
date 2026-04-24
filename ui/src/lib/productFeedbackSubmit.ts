/**
 * WE-01-FEEDBACK: POST /api/v1/feedback — in-app product feedback (authenticated).
 */

import { client } from '@/client/client.gen';

export type SubmitProductFeedbackParams = {
    message: string;
    workflowId?: number;
    source?: string;
};

function formatApiError(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'detail' in error) {
        const d = (error as { detail: unknown }).detail;
        if (typeof d === 'string') return d;
        if (Array.isArray(d) && d.length > 0) {
            const first = d[0] as { msg?: string };
            if (first?.msg) return first.msg;
        }
    }
    return 'Could not send feedback';
}

export async function submitProductFeedback(
    params: SubmitProductFeedbackParams,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
    const res = await client.post({
        url: '/api/v1/feedback',
        body: {
            message: params.message,
            workflow_id: params.workflowId,
            source: params.source ?? 'workflow_editor',
        },
    });
    if (res.error) {
        return { ok: false, error: formatApiError(res.error) };
    }
    const data = res.data as { id: number } | undefined;
    if (data?.id == null) {
        return { ok: false, error: 'Unexpected response' };
    }
    return { ok: true, id: data.id };
}
