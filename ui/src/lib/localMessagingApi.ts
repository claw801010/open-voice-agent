import { getBackendPublicBaseUrl } from '@/lib/apiClient';

export type LocalMessagingConfig = {
    enabled: boolean;
    local_messaging_base_url: string;
    message: string;
    channels: string[];
    endpoints: Record<string, string>;
};

export type LocalMessagingRecord = {
    id: string;
    channel: string;
    to: string;
    body: string;
    status: string;
    sent_at: string;
};

export async function fetchLocalMessagingConfig(): Promise<LocalMessagingConfig> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-messaging/config`);
    if (!res.ok) {
        throw new Error('Failed to load local messaging config');
    }
    return res.json() as Promise<LocalMessagingConfig>;
}

export async function fetchLocalMessagingRecords(token: string): Promise<LocalMessagingRecord[]> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-messaging/messages`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error('Failed to load messaging records');
    }
    const data = (await res.json()) as { messages: LocalMessagingRecord[] };
    return data.messages ?? [];
}
