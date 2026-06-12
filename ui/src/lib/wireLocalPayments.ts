import { createToolApiV1ToolsPost, listToolsApiV1ToolsGet } from '@/client/sdk.gen';
import { fetchLocalPaymentsConfig } from '@/lib/localPaymentsApi';
import { LOCAL_PAYMENT_TOOL_BUILDERS } from '@/lib/localPaymentToolDefinitions';

const PAYMENT_TOOL_NAMES = Object.keys(LOCAL_PAYMENT_TOOL_BUILDERS);

/**
 * Sets collections/billing API base URLs to local payments and creates payment HTTP tools if missing.
 */
export async function wireLocalPaymentsForWorkflow(input: {
    getAccessToken: () => Promise<string>;
    templateContextVariables: Record<string, string>;
    saveTemplateContextVariables: (vars: Record<string, string>) => Promise<void>;
    toolNames?: string[];
}): Promise<{ baseUrl: string; createdToolNames: string[] }> {
    const cfg = await fetchLocalPaymentsConfig();
    if (!cfg.enabled) {
        throw new Error('Enable ENABLE_LOCAL_PAYMENTS on the API (Settings → Local demo payments).');
    }
    const baseUrl = cfg.local_payments_base_url;
    const nextVars = {
        ...input.templateContextVariables,
    };
    if ('collections_api_base_url' in nextVars || input.toolNames?.includes('capture_payment_promise')) {
        nextVars.collections_api_base_url = baseUrl;
    }
    if (
        'billing_api_base_url' in nextVars ||
        input.toolNames?.some((n) =>
            ['confirm_payment_redirect', 'enroll_concierge_visit'].includes(n),
        )
    ) {
        nextVars.billing_api_base_url = baseUrl;
    }
    await input.saveTemplateContextVariables(nextVars);

    const names = (input.toolNames ?? PAYMENT_TOOL_NAMES).filter((n) => n in LOCAL_PAYMENT_TOOL_BUILDERS);
    const token = await input.getAccessToken();
    const toolsRes = await listToolsApiV1ToolsGet({
        headers: { Authorization: `Bearer ${token}` },
    });
    const tools = toolsRes.data ?? [];
    const created: string[] = [];

    for (const name of names) {
        const existing = tools.find(
            (t) => t.name?.toLowerCase() === name.toLowerCase() && t.category === 'http_api',
        );
        if (existing?.tool_uuid) {
            continue;
        }
        const builder = LOCAL_PAYMENT_TOOL_BUILDERS[name];
        const res = await createToolApiV1ToolsPost({
            body: {
                name,
                description: `Local demo payments — ${name} for analytics mapped_data proof.`,
                category: 'http_api',
                icon: 'globe',
                icon_color: '#10B981',
                definition: builder(baseUrl),
            },
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.tool_uuid) {
            created.push(name);
        }
    }

    return { baseUrl, createdToolNames: created };
}
