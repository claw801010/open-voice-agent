/**
 * Maps Playwright / gtm_capture env vars to buyer-demo catalog filters.
 * Keep aligned with scripts/seed_gtm_all_buyer_demo_calls.py SLUG_ENV_KEYS.
 */
import buyerDemoDefaults from '../../../../catalog/buyer-demo-defaults.json';

export type BuyerDemoSeededCallCase = {
    envVar: string;
    catalogSlug: string;
    catalogVariantId: string;
};

const ENV_BY_SLUG: Record<string, string> = {
    'healthcare-clinic-screening': 'E2E_GTM_SAMPLE_CALL_ID',
    'retail-wismo-faq': 'E2E_GTM_RETAIL_CALL_ID',
    'telecom-utilities-outage-faq': 'E2E_GTM_TELECOM_CALL_ID',
    'b2b-saas-trial-nurture': 'E2E_GTM_B2B_CALL_ID',
    'insurance-fnol-faq': 'E2E_GTM_INSURANCE_CALL_ID',
    'financial-services-banking-faq': 'E2E_GTM_BANKING_CALL_ID',
    'hospitality-travel-concierge': 'E2E_GTM_HOSPITALITY_CALL_ID',
    'smb-franchise-location-faq': 'E2E_GTM_SMB_CALL_ID',
    'public-sector-civic-services-faq': 'E2E_GTM_CIVIC_CALL_ID',
    'hr-staffing-recruiting-faq': 'E2E_GTM_HR_CALL_ID',
};

/** All ten buyer-default verticals with Playwright call-id env var names. */
export function buyerDemoSeededCallCases(): BuyerDemoSeededCallCase[] {
    const defaults = buyerDemoDefaults.defaults as Record<string, string>;
    return Object.entries(defaults).map(([catalogSlug, catalogVariantId]) => ({
        envVar: ENV_BY_SLUG[catalogSlug] ?? '',
        catalogSlug,
        catalogVariantId,
    }));
}

export function buyerDemoCallsListHref(catalogSlug: string, catalogVariantId: string): string {
    const q = new URLSearchParams({ catalog_slug: catalogSlug, catalog_variant_id: catalogVariantId });
    return `/analytics/calls?${q.toString()}`;
}
