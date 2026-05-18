'use client';

import Link from 'next/link';

import { buildAnalyticsCallsExploreHref } from '@/lib/analyticsOverviewDeepLinks';
import { verticalHttpProofHintForSlug } from '@/lib/analyticsVerticalHttpHints';

import { WireLocalCalendarButton } from './WireLocalCalendarButton';

type Props = {
    catalogSlug: string;
    catalogDisplayName?: string | null;
    workflowId: number;
    templateContextVariables?: Record<string, string>;
    saveTemplateContextVariables?: (vars: Record<string, string>) => Promise<void>;
};

export function WorkflowVerticalGuideCard({
    catalogSlug,
    catalogDisplayName,
    workflowId,
    templateContextVariables = {},
    saveTemplateContextVariables,
}: Props) {
    const hint = verticalHttpProofHintForSlug(catalogSlug);
    if (!hint) {
        return null;
    }

    const analyticsHref = buildAnalyticsCallsExploreHref({ catalogSlug });
    const title = catalogDisplayName?.trim() || catalogSlug;

    return (
        <div className="mb-3 rounded-md border border-teal-500/25 bg-teal-500/5 p-3 text-[11px]">
            <p className="text-xs font-medium text-foreground">Catalog guide · {title}</p>
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
                {saveTemplateContextVariables ? (
                    <WireLocalCalendarButton
                        templateContextVariables={templateContextVariables}
                        saveTemplateContextVariables={saveTemplateContextVariables}
                    />
                ) : null}
            </div>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                <Link href="/tools" className="text-foreground/90 underline-offset-2 hover:underline">
                    Configure HTTP tools
                </Link>
                <Link href="/settings" className="text-foreground/90 underline-offset-2 hover:underline">
                    Local demo calendar
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
