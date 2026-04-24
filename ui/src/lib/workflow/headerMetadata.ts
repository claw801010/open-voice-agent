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
