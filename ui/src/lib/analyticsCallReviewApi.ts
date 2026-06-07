/**
 * Post-call AI review + follow-ups (MK-01) — typed SDK from full OpenAPI snapshot.
 * Regenerate: `bash scripts/generate_ui_openapi_client.sh --full --offline`
 */
import { createClient } from '@/client/client';
import {
    applyWorkflowImprovementRouteApiV1AnalyticsCallsCallIdApplyWorkflowImprovementPost,
    createCallFollowUpApiV1AnalyticsCallsCallIdFollowUpsPost,
    generateCallAiReviewRouteApiV1AnalyticsCallsCallIdAiReviewPost,
} from '@/client/sdk.gen';
import type {
    ApplyWorkflowImprovementResponse,
    CallAiReviewResponse,
    CreateFollowUpBody,
    FollowUpItemResponse,
} from '@/client/types.gen';
import { createClientConfig, getBackendPublicBaseUrl, setupAuthInterceptor } from '@/lib/apiClient';

export type FollowUpActionType = CreateFollowUpBody['action_type'];

export type CallReviewRecommendation = NonNullable<
    CallAiReviewResponse['recommendations']
>[number];

export type CallAiReview = CallAiReviewResponse;

/** API returns review fields before full OpenAPI regen. */
export type FollowUpItem = FollowUpItemResponse & {
    suggested_message?: string | null;
    requires_review?: boolean;
    status?: FollowUpItemResponse['status'] | 'approved' | 'edited' | 'dismissed';
};

function reviewClient(getAccessToken: () => Promise<string>) {
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

export async function generateCallAiReview(
    getAccessToken: () => Promise<string>,
    callId: string,
    forceRefresh = false,
): Promise<CallAiReview> {
    const client = reviewClient(getAccessToken);
    const { data, error, response } =
        await generateCallAiReviewRouteApiV1AnalyticsCallsCallIdAiReviewPost({
            client,
            path: { call_id: callId },
            body: { force_refresh: forceRefresh },
        });
    if (error || !data) {
        throw new Error(apiErrorMessage(error, response?.status));
    }
    return data;
}

export async function createCallFollowUp(
    getAccessToken: () => Promise<string>,
    callId: string,
    body: {
        action_type: FollowUpActionType;
        notes?: string;
        scheduled_at?: string;
        contact_hint?: string;
    },
): Promise<FollowUpItem> {
    const client = reviewClient(getAccessToken);
    const { data, error, response } = await createCallFollowUpApiV1AnalyticsCallsCallIdFollowUpsPost({
        client,
        path: { call_id: callId },
        body: {
            action_type: body.action_type,
            notes: body.notes ?? '',
            scheduled_at: body.scheduled_at ?? null,
            contact_hint: body.contact_hint ?? null,
        },
    });
    if (error || !data) {
        throw new Error(apiErrorMessage(error, response?.status));
    }
    return data;
}

export async function applyWorkflowImprovement(
    getAccessToken: () => Promise<string>,
    callId: string,
    body: { improvement: string; recommendation_index?: number },
): Promise<ApplyWorkflowImprovementResponse> {
    const client = reviewClient(getAccessToken);
    const { data, error, response } =
        await applyWorkflowImprovementRouteApiV1AnalyticsCallsCallIdApplyWorkflowImprovementPost({
            client,
            path: { call_id: callId },
            body: {
                improvement: body.improvement,
                recommendation_index: body.recommendation_index ?? null,
                target: 'agent_prompt',
            },
        });
    if (error || !data) {
        throw new Error(apiErrorMessage(error, response?.status));
    }
    return data;
}

export type ReviewInboxItem = {
    call_id: string;
    workflow_id?: number | null;
    workflow_name?: string | null;
    catalog_slug?: string | null;
    follow_up: FollowUpItem;
    ai_summary?: string | null;
};

export async function fetchReviewInbox(
    getAccessToken: () => Promise<string>,
    status: 'pending' | 'approved' | 'edited' | 'dismissed' = 'pending',
): Promise<{ items: ReviewInboxItem[]; pending_count: number }> {
    const token = await getAccessToken();
    const res = await fetch(
        `${getBackendPublicBaseUrl()}/api/v1/analytics/review-inbox?status=${encodeURIComponent(status)}`,
        { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
        throw new Error('Failed to load review inbox');
    }
    return res.json() as Promise<{ items: ReviewInboxItem[]; pending_count: number }>;
}

export async function patchCallFollowUp(
    getAccessToken: () => Promise<string>,
    callId: string,
    followUpId: string,
    body: { status?: string; notes?: string; suggested_message?: string },
): Promise<FollowUpItem> {
    const token = await getAccessToken();
    const res = await fetch(
        `${getBackendPublicBaseUrl()}/api/v1/analytics/calls/${encodeURIComponent(callId)}/follow-ups/${encodeURIComponent(followUpId)}`,
        {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        },
    );
    if (!res.ok) {
        throw new Error('Failed to update follow-up');
    }
    return res.json() as Promise<FollowUpItem>;
}
