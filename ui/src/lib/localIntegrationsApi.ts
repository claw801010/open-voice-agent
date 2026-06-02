import { getBackendPublicBaseUrl } from '@/lib/apiClient';

export type LocalIntegrationsConfig = {
    enabled: boolean;
    local_integrations_base_url: string;
    message: string;
    endpoints: Record<string, string>;
};

export type LocalIntegrationRecord = {
    id: string;
    type: string;
    path: string;
    confirmation_code: string;
    slot_start: string;
    created_at: string;
    status: string;
};

export async function fetchLocalIntegrationsConfig(): Promise<LocalIntegrationsConfig> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-integrations/config`);
    if (!res.ok) {
        throw new Error('Failed to load local integrations config');
    }
    return res.json() as Promise<LocalIntegrationsConfig>;
}

export async function fetchLocalIntegrationRecords(token: string): Promise<LocalIntegrationRecord[]> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-integrations/records`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error('Failed to load integration records');
    }
    const data = (await res.json()) as { records: LocalIntegrationRecord[] };
    return data.records ?? [];
}
