import { getBackendPublicBaseUrl } from '@/lib/apiClient';

export type InteractionChannel = 'voice' | 'sms' | 'email' | 'web';

export type InteractionEvent = {
    id: string;
    channel: InteractionChannel | string;
    at: string;
    summary: string;
    workflow_run_id?: number | null;
    call_id?: string | null;
    workflow_id?: number | null;
    workflow_name?: string | null;
    catalog_slug?: string | null;
    ref_id?: string | null;
    status?: string | null;
};

export async function fetchInteractionTimeline(
    getAccessToken: () => Promise<string | null>,
    opts?: { channel?: string; limit?: number },
): Promise<{ events: InteractionEvent[]; total: number }> {
    const token = await getAccessToken();
    if (!token) throw new Error('Sign in to view interaction timeline');
    const q = new URLSearchParams();
    q.set('channel', opts?.channel ?? 'all');
    q.set('limit', String(opts?.limit ?? 50));
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/analytics/interactions?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to load timeline (${res.status})`);
    return res.json() as Promise<{ events: InteractionEvent[]; total: number }>;
}
