import { describe, expect, it } from 'vitest';

import buyerDemoDefaults from '../../../../catalog/buyer-demo-defaults.json';
import {
    buyerDemoCallsListHref,
    buyerDemoSeededCallCases,
} from './buyerDemoSeededCalls';

describe('buyerDemoSeededCallCases', () => {
    it('covers all defaults with unique env vars', () => {
        const cases = buyerDemoSeededCallCases();
        const slugs = Object.keys(buyerDemoDefaults.defaults);
        expect(cases).toHaveLength(slugs.length);
        expect(new Set(cases.map((c) => c.catalogSlug))).toEqual(new Set(slugs));
        expect(new Set(cases.map((c) => c.envVar)).size).toBe(slugs.length);
    });

    it('builds analytics calls list href for retail collections', () => {
        expect(buyerDemoCallsListHref('retail-wismo-faq', 'collections_complex')).toBe(
            '/analytics/calls?catalog_slug=retail-wismo-faq&catalog_variant_id=collections_complex',
        );
    });
});
