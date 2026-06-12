import buyerDemoDefaultsJson from '../../../../catalog/buyer-demo-defaults.json';
import buyerDemoHintsJson from '../../../../catalog/buyer-demo-hints.json';

export type BuyerDemoVariantHint = {
    story: string;
    primary_tool: string;
    wire_tip: string;
    analytics_tip: string;
    settings_tip: string;
    script: string;
    compliance_note?: string;
};

export type BuyerDemoSlugHints = {
    card_tip?: string;
    variants: Record<string, BuyerDemoVariantHint>;
};

const HINTS_BY_SLUG = (buyerDemoHintsJson as { by_slug: Record<string, BuyerDemoSlugHints> }).by_slug;
const DEFAULT_VARIANTS = buyerDemoDefaultsJson.defaults as Record<string, string>;

/** Resolved buyer-demo hint for slug + variant (falls back to default variant from buyer-demo-defaults.json). */
export function buyerDemoVariantHint(
    catalogSlug: string,
    catalogVariantId?: string | null,
): BuyerDemoVariantHint | undefined {
    const slug = catalogSlug.trim();
    if (!slug) return undefined;
    const pack = HINTS_BY_SLUG[slug];
    if (!pack?.variants) return undefined;
    const variant = (catalogVariantId || '').trim() || DEFAULT_VARIANTS[slug] || '';
    if (!variant) return undefined;
    return pack.variants[variant];
}

export function buyerDemoCardTip(catalogSlug: string): string | undefined {
    const slug = catalogSlug.trim();
    return HINTS_BY_SLUG[slug]?.card_tip;
}

/** Short script name for marketplace / install dialog (e.g. buyer-demo-banking-balance.sh). */
export function buyerDemoScriptName(
    catalogSlug: string,
    catalogVariantId?: string | null,
): string | undefined {
    return buyerDemoVariantHint(catalogSlug, catalogVariantId)?.script;
}

export function buyerDemoWireModuleHint(
    catalogSlug: string,
    catalogVariantId: string | null | undefined,
    module: 'calendar' | 'payments' | 'integrations' | 'ehr' | 'messaging',
): string | undefined {
    const hint = buyerDemoVariantHint(catalogSlug, catalogVariantId);
    if (!hint) return undefined;
    if (module === 'integrations') return hint.wire_tip;
    if (module === 'payments') return hint.wire_tip;
    if (module === 'calendar') {
        return 'Books against local scheduling API — map slot_start and confirmation_code for analytics.';
    }
    if (module === 'ehr') {
        return 'Syncs chart notes to local EHR — map chart_sync_id and patient_id on call detail.';
    }
    if (module === 'messaging') {
        return 'Queues SMS for review inbox approval before send — map message_id when approved.';
    }
    return hint.wire_tip;
}
