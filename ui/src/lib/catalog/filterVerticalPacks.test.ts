import { describe, expect, it } from 'vitest';

import buyerDemoDefaults from '../../../../catalog/buyer-demo-defaults.json';

import {
    packHasReviewInboxStory,
    preferredCatalogProofVariantId,
    type VerticalPack,
} from './filterVerticalPacks';
import { buyerDemoDefaultVariant } from './buyerDemoDefaults';

function packWithVariants(slug: string, variantIds: string[]): VerticalPack {
    return {
        slug,
        industry: 'Test',
        display_name: slug,
        summary: '',
        use_cases: [],
        workflow_variants: variantIds.map((id) => ({
            variant_id: id,
            label: id,
            complexity: id === 'simple' ? 'simple' : 'complex',
            description: '',
        })),
    } as VerticalPack;
}

describe('buyerDemoDefaultVariant', () => {
    it('returns configured default for retail collections', () => {
        expect(buyerDemoDefaultVariant('retail-wismo-faq')).toBe('collections_complex');
    });

    it('returns configured default for telecom outage', () => {
        expect(buyerDemoDefaultVariant('telecom-utilities-outage-faq')).toBe('outage_status_complex');
    });
});

describe('preferredCatalogProofVariantId', () => {
    it('prefers buyer-demo default when variant exists on pack', () => {
        const pack = packWithVariants('retail-wismo-faq', [
            'simple',
            'booking_complex',
            'collections_complex',
        ]);
        expect(preferredCatalogProofVariantId(pack)).toBe('collections_complex');
    });

    it('prefers ehr_sync_complex for healthcare', () => {
        const pack = packWithVariants('healthcare-clinic-screening', [
            'simple',
            'booking_complex',
            'ehr_sync_complex',
        ]);
        expect(preferredCatalogProofVariantId(pack)).toBe('ehr_sync_complex');
    });

    it('falls back to first complex variant when slug not in buyer defaults', () => {
        const pack = packWithVariants('custom-pack', ['simple', 'booking_complex']);
        expect(preferredCatalogProofVariantId(pack)).toBe('booking_complex');
    });
});

describe('buyer demo defaults catalog coverage', () => {
    it('every default variant id is listed in buyer-demo-defaults.json', () => {
        const slugs = Object.keys(buyerDemoDefaults.defaults);
        expect(slugs.length).toBeGreaterThanOrEqual(10);
        expect(buyerDemoDefaults.defaults['telecom-utilities-outage-faq']).toBe('outage_status_complex');
    });
});

describe('packHasReviewInboxStory', () => {
    it('is true when ehr_sync_complex exists', () => {
        expect(
            packHasReviewInboxStory(
                packWithVariants('healthcare-clinic-screening', ['simple', 'ehr_sync_complex']),
            ),
        ).toBe(true);
    });

    it('is false for retail collections pack', () => {
        expect(
            packHasReviewInboxStory(
                packWithVariants('retail-wismo-faq', ['simple', 'collections_complex']),
            ),
        ).toBe(false);
    });
});
