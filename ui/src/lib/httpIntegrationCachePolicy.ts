/**
 * WE-01-DATASTORE-INTEG — org read stub for HTTP integration response cache (roadmap).
 * @see api/routes/organization.py `GET /organizations/http-integration-cache-policy`
 */
import { getBackendPublicBaseUrl } from '@/lib/apiClient';

export type HttpIntegrationPiiHandling = 'allow_with_redaction' | 'block_cached_store';

export type HttpIntegrationCacheIntegrationOverride = {
    integrationId: string;
    cacheEnabledWhenShipped: boolean;
    ttlSeconds: number | null;
    piiHandling: HttpIntegrationPiiHandling;
};

export type HttpIntegrationCacheStoredPreferences = {
    /** Org draft: request cache when the feature ships (runtime still off). */
    cacheEnabledWhenShipped: boolean;
    ttlSeconds: number | null;
    /** Per Nango connection id (draft only). */
    integrationOverrides: HttpIntegrationCacheIntegrationOverride[];
};

export type HttpIntegrationCachePolicyAuditEntry = {
    ts: string;
    actorProviderId: string;
    cacheEnabledWhenShipped: boolean;
    ttlSeconds: number | null;
    integrationOverridesCount?: number | null;
};

export type HttpIntegrationCachePolicy = {
    organizationId: number;
    cacheEnabled: boolean;
    deferralNotBefore: string;
    implementationStatus: string;
    /** Bump when API JSON shape changes (forward-compatible UI). */
    policySchemaVersion: number;
    storedPreferences: HttpIntegrationCacheStoredPreferences;
    /** Newest entries last; capped server-side. */
    policyAudit: HttpIntegrationCachePolicyAuditEntry[];
};

/** @see api/routes/integration.py `GET /integration/` */
export type OrgIntegrationListItem = {
    id: number;
    integration_id: string;
    organisation_id: number;
    provider: string;
    is_active: boolean;
};

function formatFastApiDetail(detail: unknown): string {
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail)) {
        const parts = detail
            .map((item) => {
                if (item && typeof item === 'object' && 'msg' in item) {
                    return String((item as { msg: unknown }).msg);
                }
                return '';
            })
            .filter(Boolean);
        if (parts.length) return parts.join('; ');
    }
    return 'Request failed';
}

type HttpIntegrationCachePolicyApiJson = {
    organization_id?: number;
    cache_enabled?: boolean;
    deferral_not_before?: string;
    implementation_status?: string;
    policy_schema_version?: number;
    stored_preferences?: {
        cache_enabled_when_shipped?: boolean;
        ttl_seconds?: number | null;
        integration_overrides?: Array<{
            integration_id?: string;
            cache_enabled_when_shipped?: boolean;
            ttl_seconds?: number | null;
            pii_handling?: string;
        }>;
    };
    policy_audit?: Array<{
        ts?: string;
        actor_provider_id?: string;
        cache_enabled_when_shipped?: boolean;
        ttl_seconds?: number | null;
        integration_overrides_count?: number | null;
    }>;
};

function mapPiiHandling(raw: string | undefined): HttpIntegrationPiiHandling {
    return raw === 'block_cached_store' ? 'block_cached_store' : 'allow_with_redaction';
}

function mapPolicyJson(data: HttpIntegrationCachePolicyApiJson): HttpIntegrationCachePolicy {
    const sp = data.stored_preferences ?? {};
    const rawOv = Array.isArray(sp.integration_overrides) ? sp.integration_overrides : [];
    const integrationOverrides: HttpIntegrationCacheIntegrationOverride[] = rawOv
        .filter((row) => row && typeof row.integration_id === 'string' && row.integration_id.trim())
        .map((row) => ({
            integrationId: String(row.integration_id),
            cacheEnabledWhenShipped: Boolean(row.cache_enabled_when_shipped),
            ttlSeconds:
                row.ttl_seconds === null || row.ttl_seconds === undefined
                    ? null
                    : Number(row.ttl_seconds),
            piiHandling: mapPiiHandling(row.pii_handling),
        }));

    const rawAudit = Array.isArray(data.policy_audit) ? data.policy_audit : [];
    const policyAudit: HttpIntegrationCachePolicyAuditEntry[] = rawAudit
        .filter(
            (row) =>
                row &&
                typeof row.ts === 'string' &&
                typeof row.actor_provider_id === 'string' &&
                typeof row.cache_enabled_when_shipped === 'boolean',
        )
        .map((row) => ({
            ts: String(row.ts),
            actorProviderId: String(row.actor_provider_id),
            cacheEnabledWhenShipped: Boolean(row.cache_enabled_when_shipped),
            ttlSeconds:
                row.ttl_seconds === null || row.ttl_seconds === undefined
                    ? null
                    : Number(row.ttl_seconds),
            integrationOverridesCount:
                row.integration_overrides_count === null ||
                row.integration_overrides_count === undefined
                    ? undefined
                    : Number(row.integration_overrides_count),
        }));

    return {
        organizationId: Number(data.organization_id),
        cacheEnabled: Boolean(data.cache_enabled),
        deferralNotBefore: String(data.deferral_not_before ?? ''),
        implementationStatus: String(data.implementation_status ?? ''),
        policySchemaVersion: Number(data.policy_schema_version ?? 4),
        storedPreferences: {
            cacheEnabledWhenShipped: Boolean(sp.cache_enabled_when_shipped),
            ttlSeconds:
                sp.ttl_seconds === null || sp.ttl_seconds === undefined
                    ? null
                    : Number(sp.ttl_seconds),
            integrationOverrides,
        },
        policyAudit,
    };
}

export async function fetchHttpIntegrationCachePolicy(
    getAccessToken: () => Promise<string>,
): Promise<HttpIntegrationCachePolicy | null> {
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const res = await fetch(`${base}/api/v1/organizations/http-integration-cache-policy`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
        },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as HttpIntegrationCachePolicyApiJson;
    return mapPolicyJson(data);
}

export async function fetchOrgIntegrations(
    getAccessToken: () => Promise<string>,
): Promise<OrgIntegrationListItem[] | null> {
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const res = await fetch(`${base}/api/v1/integration/`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
        },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
        (row): row is OrgIntegrationListItem =>
            !!row &&
            typeof row === 'object' &&
            typeof (row as OrgIntegrationListItem).integration_id === 'string',
    ) as OrgIntegrationListItem[];
}

export type HttpIntegrationCachePutBody = {
    cacheEnabledWhenShipped: boolean;
    ttlSeconds: number | null;
    integrationOverrides: HttpIntegrationCacheIntegrationOverride[];
};

export type HttpIntegrationCachePutResult =
    | { ok: true; policy: HttpIntegrationCachePolicy }
    | { ok: false; errorMessage: string };

/** Persist org draft preferences (runtime cache remains off). */
export async function putHttpIntegrationCachePolicy(
    getAccessToken: () => Promise<string>,
    body: HttpIntegrationCachePutBody,
): Promise<HttpIntegrationCachePutResult> {
    const base = getBackendPublicBaseUrl();
    const token = await getAccessToken();
    const res = await fetch(`${base}/api/v1/organizations/http-integration-cache-policy`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            cache_enabled_when_shipped: body.cacheEnabledWhenShipped,
            ttl_seconds: body.ttlSeconds,
            integration_overrides: body.integrationOverrides.map((o) => ({
                integration_id: o.integrationId,
                cache_enabled_when_shipped: o.cacheEnabledWhenShipped,
                ttl_seconds: o.ttlSeconds,
                pii_handling: o.piiHandling,
            })),
        }),
    });
    let payload: unknown;
    try {
        payload = await res.json();
    } catch {
        payload = null;
    }
    if (!res.ok) {
        const msg =
            payload && typeof payload === 'object' && 'detail' in payload
                ? formatFastApiDetail((payload as { detail: unknown }).detail)
                : res.statusText || 'Request failed';
        return { ok: false, errorMessage: msg };
    }
    return { ok: true, policy: mapPolicyJson(payload as HttpIntegrationCachePolicyApiJson) };
}
