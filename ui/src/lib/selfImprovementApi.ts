/**
 * Agent self-improvement queue + policy API (MK-01-SELFIMPROVE).
 */
import { getBackendPublicBaseUrl } from '@/lib/apiClient';

export type SelfImprovementMode = 'off' | 'suggest' | 'auto_with_queue' | 'full_auto';

export type ImprovementProposalStatus =
    | 'pending'
    | 'auto_applied'
    | 'approved'
    | 'rejected'
    | 'applied';

export type ImprovementProposal = {
    id: string;
    status: ImprovementProposalStatus;
    title: string;
    text: string;
    category: string;
    risk_tier: string;
    requires_human: boolean;
    auto_eligible: boolean;
    decision: string;
    reasons: string[];
    call_id?: string | null;
    workflow_id?: number | null;
    workflow_name?: string | null;
    catalog_slug?: string | null;
    recommendation_index?: number | null;
    applied_node_id?: string | null;
    created_at: string;
    resolved_at?: string | null;
    resolved_by_user_id?: number | null;
};

export type SelfImprovementPolicy = {
    mode: SelfImprovementMode;
    evidence_gates: Record<string, number>;
    category_decisions: Record<string, string>;
    catalog_version: number;
};

export type ImprovementQueueResponse = {
    items: ImprovementProposal[];
    pending_count: number;
    policy: SelfImprovementPolicy;
};

async function authFetch(
    getAccessToken: () => Promise<string | null>,
    path: string,
    init?: RequestInit,
): Promise<Response> {
    const token = await getAccessToken();
    if (!token) throw new Error('Sign in to manage agent improvements');
    return fetch(`${getBackendPublicBaseUrl()}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
    });
}

export async function fetchSelfImprovementPolicy(
    getAccessToken: () => Promise<string | null>,
): Promise<SelfImprovementPolicy> {
    const res = await authFetch(getAccessToken, '/api/v1/analytics/self-improvement/policy');
    if (!res.ok) throw new Error(`Failed to load policy (${res.status})`);
    return res.json() as Promise<SelfImprovementPolicy>;
}

export async function updateSelfImprovementPolicy(
    getAccessToken: () => Promise<string | null>,
    body: Partial<Pick<SelfImprovementPolicy, 'mode' | 'evidence_gates' | 'category_decisions'>>,
): Promise<SelfImprovementPolicy> {
    const res = await authFetch(getAccessToken, '/api/v1/analytics/self-improvement/policy', {
        method: 'PUT',
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to update policy (${res.status})`);
    return res.json() as Promise<SelfImprovementPolicy>;
}

export async function fetchImprovementQueue(
    getAccessToken: () => Promise<string | null>,
    status: 'pending' | 'approved' | 'rejected' | 'auto_applied' | 'all' = 'pending',
): Promise<ImprovementQueueResponse> {
    const res = await authFetch(
        getAccessToken,
        `/api/v1/analytics/self-improvement/queue?status=${encodeURIComponent(status)}`,
    );
    if (!res.ok) throw new Error(`Failed to load improvement queue (${res.status})`);
    return res.json() as Promise<ImprovementQueueResponse>;
}

export async function approveImprovementProposal(
    getAccessToken: () => Promise<string | null>,
    proposalId: string,
): Promise<{ message: string; applied_node_id?: string | null }> {
    const res = await authFetch(
        getAccessToken,
        `/api/v1/analytics/self-improvement/queue/${encodeURIComponent(proposalId)}/approve`,
        { method: 'POST' },
    );
    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `Approve failed (${res.status})`);
    }
    const data = (await res.json()) as { message: string; applied_node_id?: string | null };
    return data;
}

export async function rejectImprovementProposal(
    getAccessToken: () => Promise<string | null>,
    proposalId: string,
): Promise<string> {
    const res = await authFetch(
        getAccessToken,
        `/api/v1/analytics/self-improvement/queue/${encodeURIComponent(proposalId)}/reject`,
        { method: 'POST' },
    );
    if (!res.ok) throw new Error(`Reject failed (${res.status})`);
    const data = (await res.json()) as { message: string };
    return data.message;
}

export const MODE_LABELS: Record<SelfImprovementMode, string> = {
    off: 'Off',
    suggest: 'Suggest only (human approves all)',
    auto_with_queue: 'Auto-apply low risk + queue the rest',
    full_auto: 'Full auto (except blocked categories)',
};

export const MODE_DESCRIPTIONS: Record<SelfImprovementMode, string> = {
    off: 'AI reviews still run, but no prompt changes are proposed.',
    suggest: 'Safest default — every improvement waits in the approval queue.',
    auto_with_queue:
        'Phrasing, tone, and pacing can apply automatically when evidence gates pass; scheduling, pricing, and compliance always need a human.',
    full_auto:
        'Apply all non-blocked categories when gates pass. Compliance and PII categories always require human approval.',
};
