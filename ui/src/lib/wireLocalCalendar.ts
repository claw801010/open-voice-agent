import { createToolApiV1ToolsPost, listToolsApiV1ToolsGet } from '@/client/sdk.gen';
import { buildLocalBookSlotToolDefinition } from '@/lib/localSchedulingBookSlotTool';
import { fetchLocalSchedulingConfig } from '@/lib/localSchedulingApi';

export function localSchedulingBaseUrl(bookSlotUrl: string): string {
    const trimmed = bookSlotUrl.replace(/\/book_slot\/?$/, '');
    return trimmed || bookSlotUrl;
}

/**
 * Sets scheduling_api_base_url, saves template vars, and creates book_slot tool if missing.
 */
export async function wireLocalCalendarForWorkflow(input: {
    getAccessToken: () => Promise<string>;
    templateContextVariables: Record<string, string>;
    saveTemplateContextVariables: (vars: Record<string, string>) => Promise<void>;
}): Promise<{ toolUuid?: string; baseUrl: string }> {
    const cfg = await fetchLocalSchedulingConfig();
    if (!cfg.enabled) {
        throw new Error('Enable ENABLE_LOCAL_SCHEDULING on the API (Settings → Local demo calendar).');
    }
    const baseUrl = localSchedulingBaseUrl(cfg.book_slot_url);
    const nextVars = {
        ...input.templateContextVariables,
        scheduling_api_base_url: baseUrl,
    };
    await input.saveTemplateContextVariables(nextVars);

    const token = await input.getAccessToken();
    const toolsRes = await listToolsApiV1ToolsGet({
        headers: { Authorization: `Bearer ${token}` },
    });
    const tools = toolsRes.data ?? [];
    const existing = tools.find(
        (t) => t.name?.toLowerCase() === 'book_slot' && t.category === 'http_api',
    );
    if (existing?.tool_uuid) {
        return { toolUuid: existing.tool_uuid, baseUrl };
    }

    const created = await createToolApiV1ToolsPost({
        body: {
            name: 'book_slot',
            description: 'Local demo calendar — books a slot for analytics mapped_data proof.',
            category: 'http_api',
            icon: 'globe',
            icon_color: '#3B82F6',
            definition: buildLocalBookSlotToolDefinition(cfg.book_slot_url),
        },
        headers: { Authorization: `Bearer ${token}` },
    });
    return { toolUuid: created.data?.tool_uuid, baseUrl };
}
