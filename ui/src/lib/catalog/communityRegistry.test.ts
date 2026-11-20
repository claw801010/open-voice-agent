import { describe, expect, it } from 'vitest';

import {
    filterRegistryListings,
    formatListingPrice,
    indexVerticalPackDistribution,
    loadStaticCommunityRegistry,
    verticalPackListingId,
} from './communityRegistry';

describe('loadStaticCommunityRegistry', () => {
    it('loads at least 200 listings from committed JSON', () => {
        const reg = loadStaticCommunityRegistry();
        expect(reg.listings.length).toBeGreaterThanOrEqual(200);
        expect(reg.registry_version).toBeGreaterThanOrEqual(1);
    });

    it('indexes vertical pack distribution by slug', () => {
        const reg = loadStaticCommunityRegistry();
        const bySlug = indexVerticalPackDistribution(reg);
        expect(bySlug.has('barber-beauty-salon-faq')).toBe(true);
        expect(bySlug.get('barber-beauty-salon-faq')?.tier).toBe('free');
    });
});

describe('formatListingPrice', () => {
    it('formats free and paid tiers', () => {
        expect(formatListingPrice({ tier: 'free', price_usd_cents: 0 })).toBe('Free');
        expect(formatListingPrice({ tier: 'starter', price_usd_cents: 2900 })).toBe('$29');
        expect(formatListingPrice({ tier: 'enterprise', price_usd_cents: null })).toBe(
            'Contact sales',
        );
    });
});

describe('filterRegistryListings', () => {
    it('excludes vertical packs for community library browse', () => {
        const reg = loadStaticCommunityRegistry();
        const rows = filterRegistryListings(reg, { excludeTypes: ['vertical_pack'] });
        expect(rows.every((r) => r.type !== 'vertical_pack')).toBe(true);
        expect(rows.length).toBeGreaterThan(50);
    });

    it('filters recipes by search query', () => {
        const reg = loadStaticCommunityRegistry();
        const rows = filterRegistryListings(reg, {
            types: ['recipe'],
            q: 'scheduling',
        });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((r) => r.type === 'recipe')).toBe(true);
    });
});

describe('verticalPackListingId', () => {
    it('builds stable listing ids', () => {
        expect(verticalPackListingId('retail-wismo-faq')).toBe('vertical_pack:retail-wismo-faq');
    });
});
