import { describe, expect, it } from 'vitest';

import {
    buyerDemoCardTip,
    buyerDemoScriptName,
    buyerDemoVariantHint,
    buyerDemoWireModuleHint,
} from './buyerDemoHints';

describe('buyerDemoHints', () => {
    it('resolves banking balance lookup hint from default variant', () => {
        const hint = buyerDemoVariantHint('financial-services-banking-faq');
        expect(hint?.primary_tool).toBe('lookup_account_balance');
        expect(hint?.script).toBe('buyer-demo-banking-balance.sh');
        expect(hint?.compliance_note).toMatch(/PCI/i);
    });

    it('resolves hospitality waiver hint', () => {
        const hint = buyerDemoVariantHint('hospitality-travel-concierge', 'waiver_complex');
        expect(hint?.primary_tool).toBe('apply_cancellation_waiver');
        expect(buyerDemoScriptName('hospitality-travel-concierge')).toBe(
            'buyer-demo-hospitality-waiver.sh',
        );
    });

    it('exposes card tips for marketplace', () => {
        expect(buyerDemoCardTip('financial-services-banking-faq')).toMatch(/tokenized balance/i);
        expect(buyerDemoCardTip('hospitality-travel-concierge')).toMatch(/waiver/i);
        expect(buyerDemoCardTip('smb-franchise-location-faq')).toMatch(/lead capture/i);
        expect(buyerDemoCardTip('public-sector-civic-services-faq')).toMatch(/Permit status/i);
        expect(buyerDemoCardTip('hr-staffing-recruiting-faq')).toMatch(/ATS/i);
    });

    it('maps wire module hints for integrations variants', () => {
        const tip = buyerDemoWireModuleHint(
            'financial-services-banking-faq',
            'balance_lookup_complex',
            'integrations',
        );
        expect(tip).toMatch(/lookup_account_balance/i);
    });
});
