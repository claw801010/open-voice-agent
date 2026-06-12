import { getBackendPublicBaseUrl } from '@/lib/apiClient';

export type RecordKeepingMode = 'local_only' | 'local_with_connector';

export type LocalEhrConnector = {
    vendor: string;
    display_name: string;
    record_keeping_mode: RecordKeepingMode;
    connector_sync_enabled: boolean;
    connector_configured: boolean;
    pending_connector_sync_count: number;
    phi_minimization: boolean;
    audit_enabled: boolean;
    updated_at?: string;
};

export type LocalEhrConfig = {
    enabled: boolean;
    local_ehr_base_url: string;
    message: string;
    connector: LocalEhrConnector;
    supported_vendors: string[];
    record_keeping_modes: RecordKeepingMode[];
    endpoints: Record<string, string>;
    compliance: {
        phi_minimization: boolean;
        audit_trail: boolean;
        local_record_authoritative: boolean;
        connector_optional: boolean;
    };
};

export type LocalEhrPatient = {
    patient_id: string;
    patient_token: string;
    display_name: string;
    mrn_token?: string;
    primary_insurance?: string;
    open_care_gaps?: { gap_id: string; label: string; status: string }[];
    record_source: string;
    connector_external_id?: string | null;
    updated_at?: string;
};

export type LocalEhrSyncRecord = {
    id: string;
    patient_token: string;
    summary: string;
    ehr_vendor: string;
    status: string;
    synced_at: string;
    connector_sync_status?: string;
    record_source?: string;
    connector_external_id?: string | null;
};

export type LocalEhrAuditEntry = {
    id: string;
    action: string;
    patient_token?: string | null;
    detail?: string | null;
    connector_vendor?: string | null;
    at: string;
};

export async function fetchLocalEhrConfig(token: string): Promise<LocalEhrConfig> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-ehr/config`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error('Failed to load local EHR config');
    }
    return res.json() as Promise<LocalEhrConfig>;
}

export async function updateLocalEhrSettings(
    token: string,
    body: {
        vendor?: string;
        record_keeping_mode?: RecordKeepingMode;
        connector_sync_enabled?: boolean;
    },
): Promise<LocalEhrConnector> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-ehr/connector`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        throw new Error('Failed to update EHR settings');
    }
    return res.json() as Promise<LocalEhrConnector>;
}

/** @deprecated use updateLocalEhrSettings */
export async function updateLocalEhrConnector(
    token: string,
    vendor: string,
): Promise<{ vendor: string; display_name: string }> {
    const cfg = await updateLocalEhrSettings(token, {
        vendor,
        record_keeping_mode: vendor === 'none' ? 'local_only' : 'local_with_connector',
        connector_sync_enabled: vendor !== 'none',
    });
    return { vendor: cfg.vendor, display_name: cfg.display_name };
}

export async function fetchLocalEhrPatients(token: string): Promise<LocalEhrPatient[]> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-ehr/patients`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error('Failed to load local EHR patients');
    }
    const data = (await res.json()) as { patients: LocalEhrPatient[] };
    return data.patients ?? [];
}

export async function fetchLocalEhrSyncRecords(token: string): Promise<LocalEhrSyncRecord[]> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-ehr/sync-records`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error('Failed to load EHR sync records');
    }
    const data = (await res.json()) as { records: LocalEhrSyncRecord[] };
    return data.records ?? [];
}

export async function fetchLocalEhrAuditLog(token: string): Promise<LocalEhrAuditEntry[]> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-ehr/audit-log`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error('Failed to load EHR audit log');
    }
    const data = (await res.json()) as { entries: LocalEhrAuditEntry[] };
    return data.entries ?? [];
}

export async function pushPendingEhrConnectorSyncs(token: string): Promise<{ pushed: number }> {
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/local-ehr/connector/push-pending`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error('Failed to push pending syncs');
    }
    return res.json() as Promise<{ pushed: number }>;
}
