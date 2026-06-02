import { createToolApiV1ToolsPost, listToolsApiV1ToolsGet } from '@/client/sdk.gen';
import { fetchLocalIntegrationsConfig } from '@/lib/localIntegrationsApi';
import {
    buildLocalIntegrationToolDefinition,
    LOCAL_INTEGRATION_TOOL_SPECS,
} from '@/lib/localIntegrationToolDefinitions';

/**
 * Sets integration API base URLs and creates integration HTTP tools if missing.
 */
export async function wireLocalIntegrationsForWorkflow(input: {
    getAccessToken: () => Promise<string>;
    templateContextVariables: Record<string, string>;
    saveTemplateContextVariables: (vars: Record<string, string>) => Promise<void>;
    toolNames?: string[];
}): Promise<{ baseUrl: string; createdToolNames: string[] }> {
    const cfg = await fetchLocalIntegrationsConfig();
    if (!cfg.enabled) {
        throw new Error('Enable ENABLE_LOCAL_INTEGRATIONS on the API (Settings → Local demo integrations).');
    }
    const baseUrl = cfg.local_integrations_base_url;
    const names = (input.toolNames ?? Object.keys(LOCAL_INTEGRATION_TOOL_SPECS)).filter(
        (n) => n in LOCAL_INTEGRATION_TOOL_SPECS,
    );
    const nextVars = { ...input.templateContextVariables };
    for (const name of names) {
        const varKey = LOCAL_INTEGRATION_TOOL_SPECS[name].varKey;
        nextVars[varKey] = baseUrl;
    }
    await input.saveTemplateContextVariables(nextVars);

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
        const res = await createToolApiV1ToolsPost({
            body: {
                name,
                description: `Local demo integration — ${name} for analytics mapped_data proof.`,
                category: 'http_api',
                icon: 'globe',
                icon_color: '#8B5CF6',
                definition: buildLocalIntegrationToolDefinition(baseUrl, name),
            },
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.tool_uuid) {
            created.push(name);
        }
    }

    return { baseUrl, createdToolNames: created };
}
