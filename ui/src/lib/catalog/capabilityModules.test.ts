import { describe, expect, it } from 'vitest';

import {
    capabilityModuleLabelsForPack,
    capabilityModulesById,
    loadStaticCapabilityModules,
    topCapabilityModulesForFilters,
} from './capabilityModules';
import { defaultCatalogFilters, filterVerticalPacks, type VerticalPack } from './filterVerticalPacks';

describe('loadStaticCapabilityModules', () => {
    it('loads at least 24 modules from catalog JSON', () => {
        const cat = loadStaticCapabilityModules();
        expect(cat.modules.length).toBeGreaterThanOrEqual(24);
        expect(cat.categories.length).toBeGreaterThanOrEqual(4);
    });

    it('includes high-demand buyer motions', () => {
        const ids = new Set(loadStaticCapabilityModules().modules.map((m) => m.id));
        expect(ids.has('appointment_scheduling')).toBe(true);
        expect(ids.has('lead_verification')).toBe(true);
        expect(ids.has('product_assistance')).toBe(true);
    });
});

describe('filterVerticalPacks capabilityModules', () => {
    const pack = (slug: string, mods: string[]): VerticalPack =>
        ({
            slug,
            display_name: slug,
            summary: '',
            industry: 'Retail',
            capability_module_ids: mods,
        }) as VerticalPack;

    it('filters packs by capability module id (OR)', () => {
        const packs = [
            pack('a', ['faq_policy', 'order_status_wismo']),
            pack('b', ['appointment_scheduling']),
        ];
        const filtered = filterVerticalPacks(packs, {
            ...defaultCatalogFilters(),
            capabilityModules: ['lead_verification'],
        });
        expect(filtered).toHaveLength(0);

        const faq = filterVerticalPacks(packs, {
            ...defaultCatalogFilters(),
            capabilityModules: ['faq_policy'],
        });
        expect(faq.map((p) => p.slug)).toEqual(['a']);
    });
});

describe('capabilityModuleLabelsForPack', () => {
    it('maps ids to labels with limit', () => {
        const byId = capabilityModulesById(loadStaticCapabilityModules());
        const labels = capabilityModuleLabelsForPack(
            ['appointment_scheduling', 'faq_policy', 'lead_verification'],
            byId,
            2,
        );
        expect(labels).toHaveLength(2);
        expect(labels[0]).toContain('Appointment');
    });
});

describe('topCapabilityModulesForFilters', () => {
    it('returns demand_rank 4+ modules sorted by rank', () => {
        const top = topCapabilityModulesForFilters(loadStaticCapabilityModules(), 5);
        expect(top.length).toBeGreaterThan(5);
        expect(top.every((m) => m.demand_rank >= 5)).toBe(true);
    });
});
