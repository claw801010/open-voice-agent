import { describe, expect, it } from 'vitest';

import {
    buildMarketplaceSettingsHref,
    buyerDemoSettingsSection,
    buyerDemoSettingsSectionLabel,
} from './buyerDemoDefaults';

describe('buyerDemoSettings deep links', () => {
    it('maps retail to local payments settings', () => {
        expect(buyerDemoSettingsSection('retail-wismo-faq')).toBe('local-payments');
        expect(buildMarketplaceSettingsHref('retail-wismo-faq')).toBe('/settings#local-payments');
        expect(buyerDemoSettingsSectionLabel('local-payments')).toBe('Local demo payments');
    });

    it('maps telecom to local integrations settings', () => {
        expect(buyerDemoSettingsSection('telecom-utilities-outage-faq')).toBe('local-integrations');
        expect(buildMarketplaceSettingsHref('telecom-utilities-outage-faq')).toBe(
            '/settings#local-integrations',
        );
    });

    it('maps healthcare to local EHR settings', () => {
        expect(buildMarketplaceSettingsHref('healthcare-clinic-screening')).toBe('/settings#local-ehr');
    });
});
