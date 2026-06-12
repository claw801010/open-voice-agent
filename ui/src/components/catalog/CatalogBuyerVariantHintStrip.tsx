'use client';

import { CatalogBuyerHintTip } from '@/components/catalog/CatalogBuyerHintTip';
import { buyerDemoScriptName, buyerDemoVariantHint } from '@/lib/catalog/buyerDemoHints';

type Props = {
    catalogSlug: string;
    variantId: string;
    /** Playwright / QA hook — defaults to install dialog id. */
    testId?: string;
};

/** Buyer story + script tooltip for catalog variant pickers (install / try / LoopTalk). */
export function CatalogBuyerVariantHintStrip({
    catalogSlug,
    variantId,
    testId = 'catalog-install-variant-hint',
}: Props) {
    const vHint = buyerDemoVariantHint(catalogSlug, variantId);
    const script = buyerDemoScriptName(catalogSlug, variantId);
    if (!vHint) return null;

    return (
        <p
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-teal-500/20 bg-teal-500/5 px-2 py-1.5 text-xs leading-snug text-muted-foreground"
            data-testid={testId}
        >
            <span>
                <strong className="font-medium text-foreground">Tip:</strong> {vHint.story}
            </span>
            {script ? (
                <CatalogBuyerHintTip
                    label={`Run ./scripts/${script}`}
                    tip={[vHint.wire_tip, vHint.analytics_tip, vHint.compliance_note]
                        .filter(Boolean)
                        .join(' ')}
                />
            ) : null}
        </p>
    );
}
