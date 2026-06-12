/**
 * Client-side filters for MK-01 marketplace catalog (vertical-packs.json shape).
 */

import { buyerDemoDefaultVariant } from '@/lib/catalog/buyerDemoDefaults';

/** Optional simple vs complex graphs for the same vertical (see catalog/PREBUILD_VERTICAL_ROADMAP.md). */
export type WorkflowVariantMeta = {
    variant_id: string;
    label: string;
    complexity: 'simple' | 'complex';
    packaged_definition_ref: string;
    description?: string;
};

export type VerticalPack = {
    slug: string;
    /** Partner pack semver (MK-01-PARTNER); bump on published updates */
    pack_semver?: string;
    display_name: string;
    summary: string;
    industry: string;
    use_cases?: string[];
    languages?: string[];
    supported_modes?: string[];
    compliance_tags?: string[];
    default_template_variables?: Record<string, string>;
    cost_latency_estimate_band?: string;
    /** MK-01: built-in vertical voice delivery preset applied on catalog install */
    recommended_voice_profile_id?: string;
    /** MK-01 depth: hosted voice sample (API path or absolute URL) */
    preview_audio_url?: string | null;
    /** Simple + booking/complex JSON graphs; default install uses workflow_template ref only */
    workflow_variants?: WorkflowVariantMeta[];
};

export type CatalogJson = {
    catalog_version: number;
    description?: string;
    packs: VerticalPack[];
};

export type CatalogFilters = {
    /** Exact industry string from catalog or "all" */
    industry: string;
    /** Case-insensitive substring match on name, summary, use_cases */
    useCaseSearch: string;
    /** Pack must support at least one selected language (OR) */
    languages: string[];
    /** Pack must have at least one selected tag (OR) */
    complianceTags: string[];
};

export const defaultCatalogFilters = (): CatalogFilters => ({
    industry: 'all',
    useCaseSearch: '',
    languages: [],
    complianceTags: [],
});

export function filterVerticalPacks(packs: VerticalPack[], f: CatalogFilters): VerticalPack[] {
    const q = f.useCaseSearch.trim().toLowerCase();
    return packs.filter((p) => {
        if (f.industry !== 'all' && p.industry !== f.industry) {
            return false;
        }
        if (q) {
            const hay = [p.display_name, p.summary, ...(p.use_cases ?? [])].join(' ').toLowerCase();
            if (!hay.includes(q)) {
                return false;
            }
        }
        if (f.languages.length > 0) {
            const langs = new Set(p.languages ?? []);
            if (!f.languages.some((l) => langs.has(l))) {
                return false;
            }
        }
        if (f.complianceTags.length > 0) {
            const tags = new Set(p.compliance_tags ?? []);
            if (!f.complianceTags.some((t) => tags.has(t))) {
                return false;
            }
        }
        return true;
    });
}

/** Prefer buyer-ready variant from catalog/buyer-demo-defaults.json, else first complex graph. */
export function preferredCatalogProofVariantId(pack: VerticalPack): string {
    const variants = pack.workflow_variants ?? [];
    const preferred = buyerDemoDefaultVariant(pack.slug);
    if (preferred && variants.some((v) => v.variant_id === preferred)) {
        return preferred;
    }
    const complex = variants.find((v) => v.complexity === 'complex');
    if (complex) {
        return complex.variant_id;
    }
    const simple = variants.find((v) => v.complexity === 'simple');
    if (simple) {
        return simple.variant_id;
    }
    return variants[0]?.variant_id ?? '';
}

/** Slugs with human-in-the-loop review inbox in the buyer story (MK-01 healthcare). */
export function packHasReviewInboxStory(pack: VerticalPack): boolean {
    return (pack.workflow_variants ?? []).some((v) => v.variant_id === 'ehr_sync_complex');
}

export function catalogFacets(packs: VerticalPack[]) {
    const industries = [...new Set(packs.map((p) => p.industry))].sort();
    const languages = [...new Set(packs.flatMap((p) => p.languages ?? []))].sort();
    const compliance = [...new Set(packs.flatMap((p) => p.compliance_tags ?? []))].sort();
    return { industries, languages, compliance };
}
