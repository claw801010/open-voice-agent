/**
 * Client-side filters for MK-01 marketplace catalog (vertical-packs.json shape).
 */

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

export function catalogFacets(packs: VerticalPack[]) {
    const industries = [...new Set(packs.map((p) => p.industry))].sort();
    const languages = [...new Set(packs.flatMap((p) => p.languages ?? []))].sort();
    const compliance = [...new Set(packs.flatMap((p) => p.compliance_tags ?? []))].sort();
    return { industries, languages, compliance };
}
