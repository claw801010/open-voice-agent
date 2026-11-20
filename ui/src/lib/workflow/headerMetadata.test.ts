import { describe, expect, it } from 'vitest';

import type { Mk01InstallMetadata } from '@/types/workflow-configurations';

import { capabilityMotivationFromMk01, marketplaceCatalogHrefFromMk01, analyticsOverviewHrefFromMk01, analyticsCallsHrefForWorkflow, templateSourceFromMk01 } from './headerMetadata';

describe('templateSourceFromMk01', () => {
    it('formats catalog slug', () => {
        const mk: Mk01InstallMetadata = { catalog_slug: 'retail-wismo-faq' };
        expect(templateSourceFromMk01(mk)).toBe('From catalog · Retail Wismo Faq');
    });
});

describe('capabilityMotivationFromMk01', () => {
    const labels = new Map([
        ['appointment_scheduling', 'Appointment scheduling'],
        ['faq_policy', 'FAQ & policy answers'],
    ]);

    it('returns null when no capability ids', () => {
        expect(capabilityMotivationFromMk01(undefined, labels)).toBeNull();
    });

    it('joins capability labels', () => {
        const mk: Mk01InstallMetadata = {
            capability_module_ids: ['appointment_scheduling', 'faq_policy'],
        };
        expect(capabilityMotivationFromMk01(mk, labels)).toBe(
            'Capabilities · Appointment scheduling, FAQ & policy answers',
        );
    });

    it('truncates long lists', () => {
        const mk: Mk01InstallMetadata = {
            capability_module_ids: ['a', 'b', 'c', 'd', 'e'],
        };
        expect(capabilityMotivationFromMk01(mk, labels, 2)).toBe('Capabilities · a, b +3');
    });
});

describe('marketplaceCatalogHrefFromMk01', () => {
    it('returns null without capability ids', () => {
        expect(marketplaceCatalogHrefFromMk01(undefined)).toBeNull();
    });

    it('builds catalog deep link with capabilities query', () => {
        const mk: Mk01InstallMetadata = {
            capability_module_ids: ['site_visit_scheduling', 'faq_policy'],
        };
        expect(marketplaceCatalogHrefFromMk01(mk)).toBe(
            '/workflow/catalog?capabilities=site_visit_scheduling%2Cfaq_policy',
        );
    });
});

describe('analyticsOverviewHrefFromMk01', () => {
    it('returns null without capability ids', () => {
        expect(analyticsOverviewHrefFromMk01(undefined)).toBeNull();
    });

    it('builds overview deep link with motion and catalog filters', () => {
        const mk: Mk01InstallMetadata = {
            catalog_slug: 'construction-trades-faq',
            catalog_variant_id: 'booking_complex',
            capability_module_ids: ['site_visit_scheduling', 'faq_policy'],
        };
        const href = analyticsOverviewHrefFromMk01(mk);
        expect(href).toContain('/analytics?');
        expect(href).toContain('capability_module_id=site_visit_scheduling');
        expect(href).toContain('catalog_slug=construction-trades-faq');
        expect(href).toContain('catalog_variant_id=booking_complex');
    });
});

describe('analyticsCallsHrefForWorkflow', () => {
    it('always includes workflow id', () => {
        expect(analyticsCallsHrefForWorkflow(42, undefined)).toBe('/analytics/calls?workflow_id=42');
    });

    it('adds mk01 catalog and capability filters', () => {
        const mk: Mk01InstallMetadata = {
            catalog_slug: 'retail-wismo-faq',
            catalog_variant_id: 'booking_complex',
            capability_module_ids: ['wismo_status', 'faq_policy'],
        };
        const href = analyticsCallsHrefForWorkflow(7, mk);
        expect(href).toContain('workflow_id=7');
        expect(href).toContain('capability_module_id=wismo_status');
        expect(href).toContain('catalog_slug=retail-wismo-faq');
        expect(href).toContain('catalog_variant_id=booking_complex');
    });
});
