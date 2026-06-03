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

    it('B2B conversion variant focuses on update_crm_deal_stage', () => {
        const hint = verticalHttpProofHintForSlug('b2b-saas-trial-nurture', 'conversion_complex');
        expect(hint?.example_tool_names).toEqual(['update_crm_deal_stage']);
    });

    it('insurance claims lookup variant focuses on lookup_claim_status', () => {
        const hint = verticalHttpProofHintForSlug('insurance-fnol-faq', 'claims_lookup_complex');
        expect(hint?.example_tool_names).toEqual(['lookup_claim_status']);
    });

    it('banking balance variant focuses on lookup_account_balance', () => {
        const hint = verticalHttpProofHintForSlug(
            'financial-services-banking-faq',
            'balance_lookup_complex',
        );
        expect(hint?.example_tool_names).toEqual(['lookup_account_balance']);
    });

    it('hospitality waiver variant focuses on apply_cancellation_waiver', () => {
        const hint = verticalHttpProofHintForSlug(
            'hospitality-travel-concierge',
            'waiver_complex',
        );
        expect(hint?.example_tool_names).toEqual(['apply_cancellation_waiver']);
    });

    it('falls back to pack hint for unknown variant ids', () => {
        const hint = verticalHttpProofHintForSlug('healthcare-clinic-screening', 'not-a-variant');
        expect(hint?.example_tool_names).toEqual(
            VERTICAL_HTTP_PROOF_HINTS['healthcare-clinic-screening'].example_tool_names,
        );
    });
});
