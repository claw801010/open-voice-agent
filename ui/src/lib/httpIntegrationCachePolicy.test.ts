import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchHttpIntegrationCachePolicy, putHttpIntegrationCachePolicy } from './httpIntegrationCachePolicy';

describe('fetchHttpIntegrationCachePolicy', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            organization_id: 42,
                            cache_enabled: false,
                            deferral_not_before: '2026-07-01',
                            implementation_status: 'not_implemented',
                            policy_schema_version: 4,
                            stored_preferences: {
                                cache_enabled_when_shipped: false,
                                ttl_seconds: null,
                                integration_overrides: [],
                            },
                            policy_audit: [],
                        }),
                } as Response),
            ),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('maps snake_case response to camelCase', async () => {
        const p = await fetchHttpIntegrationCachePolicy(async () => 'tok');
        expect(p).not.toBeNull();
        expect(p!.organizationId).toBe(42);
        expect(p!.cacheEnabled).toBe(false);
        expect(p!.deferralNotBefore).toBe('2026-07-01');
        expect(p!.implementationStatus).toBe('not_implemented');
        expect(p!.policySchemaVersion).toBe(4);
        expect(p!.storedPreferences.cacheEnabledWhenShipped).toBe(false);
        expect(p!.storedPreferences.ttlSeconds).toBeNull();
        expect(p!.storedPreferences.integrationOverrides).toEqual([]);
        expect(p!.policyAudit).toEqual([]);
    });

    it('maps policy_audit entries', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            organization_id: 7,
                            cache_enabled: false,
                            deferral_not_before: '2026-07-01',
                            implementation_status: 'not_implemented',
                            policy_schema_version: 4,
                            stored_preferences: {
                                cache_enabled_when_shipped: true,
                                ttl_seconds: 120,
                                integration_overrides: [],
                            },
                            policy_audit: [
                                {
                                    ts: '2026-05-02T12:00:00Z',
                                    actor_provider_id: 'user-a',
                                    cache_enabled_when_shipped: true,
                                    ttl_seconds: 120,
                                    integration_overrides_count: 2,
                                },
                            ],
                        }),
                } as Response),
            ),
        );
        const p = await fetchHttpIntegrationCachePolicy(async () => 'tok');
        expect(p).not.toBeNull();
        expect(p!.policyAudit).toHaveLength(1);
        expect(p!.policyAudit[0].actorProviderId).toBe('user-a');
        expect(p!.policyAudit[0].ttlSeconds).toBe(120);
        expect(p!.policyAudit[0].integrationOverridesCount).toBe(2);
    });

    it('returns null when HTTP not ok', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: false,
                    json: () => Promise.resolve({}),
                } as Response),
            ),
        );
        const p = await fetchHttpIntegrationCachePolicy(async () => 'tok');
        expect(p).toBeNull();
    });
});

describe('putHttpIntegrationCachePolicy', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns ok and mapped policy on success', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            organization_id: 1,
                            cache_enabled: false,
                            deferral_not_before: '2026-07-01',
                            implementation_status: 'not_implemented',
                            policy_schema_version: 4,
                            stored_preferences: {
                                cache_enabled_when_shipped: true,
                                ttl_seconds: 3600,
                                integration_overrides: [],
                            },
                            policy_audit: [],
                        }),
                } as Response),
            ),
        );
        const r = await putHttpIntegrationCachePolicy(async () => 'tok', {
            cacheEnabledWhenShipped: true,
            ttlSeconds: 3600,
            integrationOverrides: [],
        });
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.policy.storedPreferences.cacheEnabledWhenShipped).toBe(true);
            expect(r.policy.storedPreferences.ttlSeconds).toBe(3600);
            expect(r.policy.storedPreferences.integrationOverrides).toEqual([]);
        }
    });

    it('returns errorMessage from FastAPI detail array', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: false,
                    statusText: 'Unprocessable Entity',
                    json: () =>
                        Promise.resolve({
                            detail: [{ msg: 'ttl_seconds must be >= 60', type: 'value_error' }],
                        }),
                } as Response),
            ),
        );
        const r = await putHttpIntegrationCachePolicy(async () => 'tok', {
            cacheEnabledWhenShipped: false,
            ttlSeconds: 30,
            integrationOverrides: [],
        });
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.errorMessage).toContain('ttl_seconds');
        }
    });
});
