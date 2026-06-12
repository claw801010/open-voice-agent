import { createToolApiV1ToolsPost, listToolsApiV1ToolsGet } from '@/client/sdk.gen';
import { fetchLocalMessagingConfig } from '@/lib/localMessagingApi';
import {
    buildLocalMessagingToolDefinition,
    LOCAL_MESSAGING_TOOL_SPECS,
} from '@/lib/localMessagingToolDefinitions';

const MESSAGING_VAR = 'messaging_api_base_url';

export async function wireLocalMessagingForWorkflow(input: {
    getAccessToken: () => Promise<string>;
    templateContextVariables: Record<string, string>;
    saveTemplateContextVariables: (vars: Record<string, string>) => Promise<void>;
    toolNames?: string[];
}): Promise<{ baseUrl: string; createdToolNames: string[] }> {
    const cfg = await fetchLocalMessagingConfig();
    if (!cfg.enabled) {
        throw new Error('Enable ENABLE_LOCAL_MESSAGING on the API (Settings → Local demo messaging).');
    }
    const baseUrl = cfg.local_messaging_base_url;
    const names = (input.toolNames ?? Object.keys(LOCAL_MESSAGING_TOOL_SPECS)).filter(
        (n) => n in LOCAL_MESSAGING_TOOL_SPECS,
    );
    const nextVars = { ...input.templateContextVariables, [MESSAGING_VAR]: baseUrl };
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
                description: `Local demo messaging — ${name} (SMS / email log for outreach proof).`,
                category: 'http_api',
                icon: 'message-square',
                icon_color: '#2563EB',
                definition: buildLocalMessagingToolDefinition(baseUrl, name),
            },
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.tool_uuid) {
            created.push(name);
        }
    }

    return { baseUrl, createdToolNames: created };
}
