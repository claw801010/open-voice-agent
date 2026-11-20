/**
 * MK-01-CAPABILITY-MODULES — modular business motions (appointment, FAQ, lead verify, …).
 */

import catalogJson from '../../../../catalog/capability-modules.json';

export type CapabilityModuleSummary = {
    id: string;
    label: string;
    category: string;
    demand_rank: number;
    summary: string;
    typical_http_tools: string[];
    template_variable_keys: string[];
    pack_ref_count: number;
};

export type CapabilityCategory = {
    id: string;
    label: string;
    description?: string;
};

export type CapabilityModulesCatalog = {
    catalog_version: number;
    description?: string;
    categories: CapabilityCategory[];
    modules: CapabilityModuleSummary[];
};

/** Static import for tests and SSR fallbacks; API may enrich at runtime. */
export function loadStaticCapabilityModules(): CapabilityModulesCatalog {
    const raw = catalogJson as CapabilityModulesCatalog;
    return {
        catalog_version: raw.catalog_version,
        description: raw.description,
        categories: raw.categories ?? [],
        modules: (raw.modules ?? []).map((m) => ({
            id: m.id,
            label: m.label,
            category: m.category,
            demand_rank: m.demand_rank ?? 3,
            summary: m.summary ?? '',
            typical_http_tools: m.typical_http_tools ?? [],
            template_variable_keys: m.template_variable_keys ?? [],
            pack_ref_count: (m as { pack_refs?: unknown[] }).pack_refs?.length ?? 0,
        })),
    };
}

export function capabilityModulesById(
    catalog: CapabilityModulesCatalog,
): Map<string, CapabilityModuleSummary> {
    return new Map(catalog.modules.map((m) => [m.id, m]));
}

export function capabilityModuleLabelsForPack(
    packModuleIds: string[] | undefined,
    byId: Map<string, CapabilityModuleSummary>,
    limit = 4,
): string[] {
    if (!packModuleIds?.length) return [];
    return packModuleIds
        .map((id) => byId.get(id)?.label ?? id)
        .slice(0, limit);
}

export function topCapabilityModulesForFilters(
    catalog: CapabilityModulesCatalog,
    minDemandRank = 4,
): CapabilityModuleSummary[] {
    return [...catalog.modules]
        .filter((m) => m.demand_rank >= minDemandRank)
        .sort((a, b) => b.demand_rank - a.demand_rank || a.label.localeCompare(b.label));
}
