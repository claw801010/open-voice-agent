import { createToolApiV1ToolsPost, listToolsApiV1ToolsGet } from '@/client/sdk.gen';
import { fetchLocalEhrConfig } from '@/lib/localEhrApi';
import { buildLocalEhrToolDefinition, LOCAL_EHR_TOOL_SPECS } from '@/lib/localEhrToolDefinitions';

const EHR_VAR = 'ehr_api_base_url';

export async function wireLocalEhrForWorkflow(input: {
    getAccessToken: () => Promise<string>;
    templateContextVariables: Record<string, string>;
    saveTemplateContextVariables: (vars: Record<string, string>) => Promise<void>;
    toolNames?: string[];
}): Promise<{ baseUrl: string; createdToolNames: string[] }> {
    const token = await input.getAccessToken();
    const cfg = await fetchLocalEhrConfig(token);
    if (!cfg.enabled) {
        throw new Error('Enable ENABLE_LOCAL_EHR on the API (Settings → Local demo EHR).');
    }
    const baseUrl = cfg.local_ehr_base_url;
    const names = (input.toolNames ?? Object.keys(LOCAL_EHR_TOOL_SPECS)).filter(
        (n) => n in LOCAL_EHR_TOOL_SPECS,
    );
    const nextVars = { ...input.templateContextVariables, [EHR_VAR]: baseUrl };
    await input.saveTemplateContextVariables(nextVars);

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
                description: `Local demo EHR — ${name} (patient context / prior auth / chart sync).`,
                category: 'http_api',
                icon: 'heart-pulse',
                icon_color: '#0D9488',
                definition: buildLocalEhrToolDefinition(baseUrl, name),
            },
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.tool_uuid) {
            created.push(name);
        }
    }

    return { baseUrl, createdToolNames: created };
}
