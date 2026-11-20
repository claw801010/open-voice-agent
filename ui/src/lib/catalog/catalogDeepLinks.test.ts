import { describe, expect, it } from 'vitest';

import {
    buildCapabilityAnalyticsCallsHref,
    buildCapabilityAnalyticsOverviewHref,
    buildMarketplaceCatalogHref,
    parseCapabilityModuleIdsFromSearchParams,
} from './catalogDeepLinks';

describe('parseCapabilityModuleIdsFromSearchParams', () => {
    it('parses comma-separated capabilities', () => {
        const sp = new URLSearchParams('capabilities=site_visit_scheduling,faq_policy');
        expect(parseCapabilityModuleIdsFromSearchParams(sp)).toEqual([
            'site_visit_scheduling',
            'faq_policy',
        ]);
    });

    it('returns empty when param missing', () => {
        expect(parseCapabilityModuleIdsFromSearchParams(new URLSearchParams())).toEqual([]);
    });
});

describe('buildMarketplaceCatalogHref', () => {
    it('returns base path without ids', () => {
        expect(buildMarketplaceCatalogHref({})).toBe('/workflow/catalog');
    });

    it('encodes capability ids', () => {
        expect(
            buildMarketplaceCatalogHref({
                capabilityModuleIds: ['site_visit_scheduling', 'faq_policy'],
            }),
        ).toBe('/workflow/catalog?capabilities=site_visit_scheduling%2Cfaq_policy');
    });
});

describe('buildCapabilityAnalyticsOverviewHref', () => {
    it('returns null without ids', () => {
        expect(buildCapabilityAnalyticsOverviewHref({ capabilityModuleIds: [] })).toBeNull();
    });

    it('uses primary motion and optional catalog context', () => {
        const href = buildCapabilityAnalyticsOverviewHref({
            capabilityModuleIds: ['appointment_booking', 'faq_policy'],
            catalogSlug: 'healthcare-clinic-screening',
        });
        expect(href).toContain('capability_module_id=appointment_booking');
        expect(href).toContain('catalog_slug=healthcare-clinic-screening');
    });
});

describe('buildCapabilityAnalyticsCallsHref', () => {
    it('builds call list filter', () => {
        expect(
            buildCapabilityAnalyticsCallsHref({ capabilityModuleIds: ['site_visit_scheduling'] }),
        ).toBe('/analytics/calls?capability_module_id=site_visit_scheduling');
    });
});
