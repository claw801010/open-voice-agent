'use client';

import Link from 'next/link';

import { CatalogBuyerHintTip } from '@/components/catalog/CatalogBuyerHintTip';
import { buildCatalogGuideAnalyticsHref } from '@/lib/analyticsOverviewDeepLinks';
import { verticalHttpProofHintForSlug } from '@/lib/analyticsVerticalHttpHints';
import {
    buyerDemoVariantHint,
    buyerDemoWireModuleHint,
} from '@/lib/catalog/buyerDemoHints';
import { LOCAL_EHR_TOOL_SPECS } from '@/lib/localEhrToolDefinitions';
import { LOCAL_INTEGRATION_TOOL_SPECS } from '@/lib/localIntegrationToolDefinitions';
import { LOCAL_MESSAGING_TOOL_SPECS } from '@/lib/localMessagingToolDefinitions';
import { LOCAL_SCHEDULING_TOOL_BUILDERS } from '@/lib/localSchedulingToolDefinitions';

import { WireLocalCalendarButton } from './WireLocalCalendarButton';
import { WireLocalEhrButton } from './WireLocalEhrButton';
import { WireLocalIntegrationsButton } from './WireLocalIntegrationsButton';
import { WireLocalMessagingButton } from './WireLocalMessagingButton';
import { WireLocalPaymentsButton } from './WireLocalPaymentsButton';

const PAYMENT_TOOL_NAMES = new Set([
    'capture_payment_promise',
    'confirm_payment_redirect',
    'enroll_concierge_visit',
]);

function isSchedulingTool(name: string): boolean {
    if (name in LOCAL_SCHEDULING_TOOL_BUILDERS) {
        return true;
    }
    return name.startsWith('book_') || name.startsWith('schedule_') || name.includes('reschedule');
}

type Props = {
    catalogSlug: string;
    catalogVariantId?: string | null;
    catalogDisplayName?: string | null;
    workflowId: number;
    templateContextVariables?: Record<string, string>;
    saveTemplateContextVariables?: (vars: Record<string, string>) => Promise<void>;
};

export function WorkflowVerticalGuideCard({
    catalogSlug,
    catalogVariantId = null,
    catalogDisplayName,
    workflowId,
    templateContextVariables = {},
    saveTemplateContextVariables,
}: Props) {
    const hint = verticalHttpProofHintForSlug(catalogSlug, catalogVariantId);
    if (!hint) {
        return null;
    }

    const analyticsHref = buildCatalogGuideAnalyticsHref({
        catalogSlug,
        catalogVariantId,
        exampleToolNames: hint.example_tool_names,
    });
    const title = catalogDisplayName?.trim() || catalogSlug;
    const schedulingTools = hint.example_tool_names.filter(isSchedulingTool);
    const paymentTools = hint.example_tool_names.filter((n) => PAYMENT_TOOL_NAMES.has(n));
    const integrationTools = hint.example_tool_names.filter((n) => n in LOCAL_INTEGRATION_TOOL_SPECS);
    const ehrTools = hint.example_tool_names.filter((n) => n in LOCAL_EHR_TOOL_SPECS);
    const messagingTools = hint.example_tool_names.filter((n) => n in LOCAL_MESSAGING_TOOL_SPECS);
    const showSchedulingWire = schedulingTools.length > 0;
    const showPaymentsWire = paymentTools.length > 0;
    const showIntegrationsWire = integrationTools.length > 0;
    const showEhrWire = ehrTools.length > 0;
    const showMessagingWire = messagingTools.length > 0;
    const buyerHint = buyerDemoVariantHint(catalogSlug, catalogVariantId);

    return (
        <div className="mb-3 rounded-md border border-teal-500/25 bg-teal-500/5 p-3 text-[11px]" data-testid="catalog-guide-card">
            <p className="text-xs font-medium text-foreground">
                Catalog guide · {title}
                {catalogVariantId?.trim() ? (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                        · variant <code className="rounded bg-muted px-0.5 text-[10px]">{catalogVariantId.trim()}</code>
                    </span>
                ) : null}
            </p>
            {buyerHint ? (
                <p className="mt-1.5 flex flex-wrap items-start gap-x-2 gap-y-1 text-muted-foreground leading-snug">
                    <span>
                        <strong className="font-medium text-foreground">Buyer story:</strong>{' '}
                        {buyerHint.story}
                    </span>
                    <CatalogBuyerHintTip
                        tip={[buyerHint.analytics_tip, buyerHint.settings_tip, buyerHint.compliance_note]
                            .filter(Boolean)
                            .join(' ')}
                    />
                </p>
            ) : null}
            <p className="mt-1 text-muted-foreground leading-snug">
                Wire HTTP tools named{' '}
                <strong className="font-medium text-foreground">{hint.example_tool_names.join(', ')}</strong> and map
                response fields such as{' '}
                <strong className="font-medium text-foreground">
                    {hint.suggested_response_mapping_keys.slice(0, 3).join(', ')}
                </strong>{' '}
                so Call analytics shows <code className="rounded bg-muted px-0.5 text-[10px]">mapped_data</code>.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
                {saveTemplateContextVariables && showSchedulingWire ? (
                    <WireLocalCalendarButton
                        templateContextVariables={templateContextVariables}
                        saveTemplateContextVariables={saveTemplateContextVariables}
                        toolNames={schedulingTools}
                        hint={buyerDemoWireModuleHint(catalogSlug, catalogVariantId, 'calendar')}
                    />
                ) : null}
                {saveTemplateContextVariables && showPaymentsWire ? (
                    <WireLocalPaymentsButton
                        templateContextVariables={templateContextVariables}
                        saveTemplateContextVariables={saveTemplateContextVariables}
                        toolNames={paymentTools}
                        hint={buyerDemoWireModuleHint(catalogSlug, catalogVariantId, 'payments')}
                    />
                ) : null}
                {saveTemplateContextVariables && showIntegrationsWire ? (
                    <WireLocalIntegrationsButton
                        templateContextVariables={templateContextVariables}
                        saveTemplateContextVariables={saveTemplateContextVariables}
                        toolNames={integrationTools}
                        hint={buyerDemoWireModuleHint(catalogSlug, catalogVariantId, 'integrations')}
                    />
                ) : null}
                {saveTemplateContextVariables && showEhrWire ? (
                    <WireLocalEhrButton
                        templateContextVariables={templateContextVariables}
                        saveTemplateContextVariables={saveTemplateContextVariables}
                        toolNames={ehrTools}
                        hint={buyerDemoWireModuleHint(catalogSlug, catalogVariantId, 'ehr')}
                    />
                ) : null}
                {saveTemplateContextVariables && showMessagingWire ? (
                    <WireLocalMessagingButton
                        templateContextVariables={templateContextVariables}
                        saveTemplateContextVariables={saveTemplateContextVariables}
                        toolNames={messagingTools}
                        hint={buyerDemoWireModuleHint(catalogSlug, catalogVariantId, 'messaging')}
                    />
                ) : null}
            </div>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                <Link href="/tools" className="text-foreground/90 underline-offset-2 hover:underline">
                    Configure HTTP tools
                </Link>
                {showSchedulingWire ? (
                    <Link href="/settings" className="text-foreground/90 underline-offset-2 hover:underline">
                        Local demo calendar
                    </Link>
                ) : null}
                {showPaymentsWire ? (
                    <Link href="/settings" className="text-foreground/90 underline-offset-2 hover:underline">
                        Local demo payments
                    </Link>
                ) : null}
                {showIntegrationsWire ? (
                    <Link href="/settings" className="text-foreground/90 underline-offset-2 hover:underline">
                        Local demo integrations
                    </Link>
                ) : null}
                {showEhrWire ? (
                    <Link href="/settings" className="text-foreground/90 underline-offset-2 hover:underline">
                        Local demo EHR
                    </Link>
                ) : null}
                {showMessagingWire ? (
                    <Link href="/settings" className="text-foreground/90 underline-offset-2 hover:underline">
                        Local demo messaging
                    </Link>
                ) : null}
                <Link href="/analytics/review" className="text-foreground/90 underline-offset-2 hover:underline">
                    Review inbox
                </Link>
                <Link href={analyticsHref} className="text-foreground/90 underline-offset-2 hover:underline">
                    Preview analytics
                </Link>
                <Link
                    href={`/workflow/${workflowId}/settings?section=variables`}
                    className="text-foreground/90 underline-offset-2 hover:underline"
                >
                    Template variables
                </Link>
            </p>
        </div>
    );
}
