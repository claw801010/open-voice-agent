import buyerDemoDefaultsJson from '../../../../catalog/buyer-demo-defaults.json';

const DEFAULTS = buyerDemoDefaultsJson.defaults as Record<string, string>;
const SETTINGS_SECTIONS = (buyerDemoDefaultsJson as { settings_sections?: Record<string, string> })
    .settings_sections ?? {};

const SETTINGS_SECTION_LABELS: Record<string, string> = {
    'local-calendar': 'Local demo calendar',
    'local-payments': 'Local demo payments',
    'local-ehr': 'Local demo EHR',
    'local-messaging': 'Local demo messaging',
    'local-integrations': 'Local demo integrations',
};

/** Buyer-ready variant for marketplace proof links and catalog-buyer-demo.sh. */
export function buyerDemoDefaultVariant(catalogSlug: string): string | undefined {
    const slug = catalogSlug.trim();
    if (!slug) return undefined;
    return DEFAULTS[slug];
}

/** Settings hash for marketplace deep link (e.g. local-payments for collections). */
export function buyerDemoSettingsSection(catalogSlug: string): string | undefined {
    const slug = catalogSlug.trim();
    if (!slug) return undefined;
    return SETTINGS_SECTIONS[slug];
}

export function buyerDemoSettingsSectionLabel(sectionId: string): string {
    return SETTINGS_SECTION_LABELS[sectionId] ?? sectionId;
}

/** Marketplace card → Settings section for the vertical's local all-in-one module. */
export function buildMarketplaceSettingsHref(catalogSlug: string): string | null {
    const section = buyerDemoSettingsSection(catalogSlug);
    if (!section) return null;
    return `/settings#${section}`;
}
