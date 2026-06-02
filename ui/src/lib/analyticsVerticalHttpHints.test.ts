import { describe, expect, it } from 'vitest';

import {
    verticalHttpProofHintForSlug,
    VERTICAL_HTTP_PROOF_HINTS,
} from './analyticsVerticalHttpHints';

describe('verticalHttpProofHintForSlug', () => {
    it('returns pack-level tools when no variant is set', () => {
        const hint = verticalHttpProofHintForSlug('retail-wismo-faq');
        expect(hint?.example_tool_names).toEqual(['reserve_pickup_slot']);
    });

    it('narrows to variant-specific tools when catalog_variant_id is set', () => {
        const hint = verticalHttpProofHintForSlug('retail-wismo-faq', 'collections_complex');
        expect(hint?.example_tool_names).toEqual(['capture_payment_promise']);
    });

    it('telecom outage variant focuses on lookup_outage_status', () => {
        const hint = verticalHttpProofHintForSlug(
            'telecom-utilities-outage-faq',
            'outage_status_complex',
        );
        expect(hint?.example_tool_names).toEqual(['lookup_outage_status']);
    });

    it('falls back to pack hint for unknown variant ids', () => {
        const hint = verticalHttpProofHintForSlug('healthcare-clinic-screening', 'not-a-variant');
        expect(hint?.example_tool_names).toEqual(
            VERTICAL_HTTP_PROOF_HINTS['healthcare-clinic-screening'].example_tool_names,
        );
    });
});
