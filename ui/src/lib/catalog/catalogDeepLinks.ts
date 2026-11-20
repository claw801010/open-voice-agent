/**
 * MK-02 — deep links into the marketplace catalog with capability motion filters.
 */

/** Parse `?capabilities=mod1,mod2` from catalog browse URLs. */
export function parseCapabilityModuleIdsFromSearchParams(sp: URLSearchParams): string[] {
    const raw = sp.get('capabilities')?.trim();
    if (!raw) return [];
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

/** Build `/workflow/catalog` href with optional capability filter chips pre-selected. */
export function buildMarketplaceCatalogHref(opts: { capabilityModuleIds?: readonly string[] }): string {
    const ids = (opts.capabilityModuleIds ?? []).map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return '/workflow/catalog';
    return `/workflow/catalog?capabilities=${encodeURIComponent(ids.join(','))}`;
}

/** Analytics Overview for selected capability motions (primary motion + optional catalog context). */
export function buildCapabilityAnalyticsOverviewHref(opts: {
    capabilityModuleIds: readonly string[];
    catalogSlug?: string;
    catalogVariantId?: string;
}): string | null {
    const primary = opts.capabilityModuleIds.map((s) => s.trim()).find(Boolean);
    if (!primary) return null;
    const q = new URLSearchParams();
    q.set('capability_module_id', primary);
    const slug = opts.catalogSlug?.trim();
    if (slug) q.set('catalog_slug', slug);
    const cv = opts.catalogVariantId?.trim();
    if (cv) q.set('catalog_variant_id', cv);
    return `/analytics?${q.toString()}`;
}

/** Call list filtered by capability motion (and optional catalog slug / variant). */
export function buildCapabilityAnalyticsCallsHref(opts: {
    capabilityModuleIds: readonly string[];
    catalogSlug?: string;
    catalogVariantId?: string;
}): string | null {
    const primary = opts.capabilityModuleIds.map((s) => s.trim()).find(Boolean);
    if (!primary) return null;
    const q = new URLSearchParams();
    q.set('capability_module_id', primary);
    const slug = opts.catalogSlug?.trim();
    if (slug) q.set('catalog_slug', slug);
    const cv = opts.catalogVariantId?.trim();
    if (cv) q.set('catalog_variant_id', cv);
    return `/analytics/calls?${q.toString()}`;
}
