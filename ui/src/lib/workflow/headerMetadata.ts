import type { Mk01InstallMetadata } from '@/types/workflow-configurations';

/** Human-readable slug for header (no PII). */
export function formatCatalogSlugForHeader(slug: string): string {
    return slug
        .split(/[-_]/g)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Template source line when catalog metadata is not loaded yet.
 * Prefer pairing with catalog `display_name` when available.
 */
export function templateSourceFromMk01(mk: Mk01InstallMetadata | undefined): string | null {
    if (!mk) return null;
    if (mk.catalog_slug) {
        return `From catalog · ${formatCatalogSlugForHeader(mk.catalog_slug)}`;
    }
    if (mk.source_template_id != null) {
        return `From template #${mk.source_template_id}`;
    }
    return null;
}

/** Capability motions chosen at marketplace install (no PII). */
export function capabilityMotivationFromMk01(
    mk: Mk01InstallMetadata | undefined,
    labelById: Map<string, string>,
    limit = 4,
): string | null {
    const ids = mk?.capability_module_ids;
    if (!ids?.length) return null;
    const labels = ids.map((id) => labelById.get(id) ?? id).slice(0, limit);
    const extra = ids.length > limit ? ` +${ids.length - limit}` : '';
    return `Capabilities · ${labels.join(', ')}${extra}`;
}

/** Marketplace catalog URL with install motions pre-filtered (MK-02). */
export function marketplaceCatalogHrefFromMk01(mk: Mk01InstallMetadata | undefined): string | null {
    const ids = mk?.capability_module_ids;
    if (!ids?.length) return null;
    const q = encodeURIComponent(ids.join(','));
    return `/workflow/catalog?capabilities=${q}`;
}

/** Analytics Overview filtered by primary install motion (MK-03). */
export function analyticsOverviewHrefFromMk01(mk: Mk01InstallMetadata | undefined): string | null {
    const ids = mk?.capability_module_ids;
    if (!ids?.length) return null;
    const q = new URLSearchParams();
    q.set('capability_module_id', ids[0]);
    if (mk?.catalog_slug) q.set('catalog_slug', mk.catalog_slug);
    if (mk?.catalog_variant_id) q.set('catalog_variant_id', mk.catalog_variant_id);
    return `/analytics?${q.toString()}`;
}

/** Call list scoped to this workflow; preserves mk01 catalog + primary capability when set (MK-03). */
export function analyticsCallsHrefForWorkflow(
    workflowId: number,
    mk: Mk01InstallMetadata | undefined,
): string {
    const q = new URLSearchParams();
    q.set('workflow_id', String(workflowId));
    const cap = mk?.capability_module_ids?.[0];
    if (cap) q.set('capability_module_id', cap);
    if (mk?.catalog_slug) q.set('catalog_slug', mk.catalog_slug);
    if (mk?.catalog_variant_id) q.set('catalog_variant_id', mk.catalog_variant_id);
    return `/analytics/calls?${q.toString()}`;
}
