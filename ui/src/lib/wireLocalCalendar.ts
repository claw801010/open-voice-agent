import { createToolApiV1ToolsPost, listToolsApiV1ToolsGet } from '@/client/sdk.gen';
import { fetchLocalSchedulingConfig } from '@/lib/localSchedulingApi';
import {
    LOCAL_SCHEDULING_TOOL_BUILDERS,
    LOCAL_SCHEDULING_TOOL_NAMES,
} from '@/lib/localSchedulingToolDefinitions';

export function localSchedulingBaseUrl(bookSlotUrl: string): string {
    const trimmed = bookSlotUrl.replace(/\/book_slot\/?$/, '');
    return trimmed || bookSlotUrl;
}

/**
 * Sets scheduling_api_base_url, saves template vars, and creates scheduling HTTP tools if missing.
 */
export async function wireLocalCalendarForWorkflow(input: {
    getAccessToken: () => Promise<string>;
    templateContextVariables: Record<string, string>;
    saveTemplateContextVariables: (vars: Record<string, string>) => Promise<void>;
    toolNames?: string[];
}): Promise<{ baseUrl: string; createdToolNames: string[] }> {
    const cfg = await fetchLocalSchedulingConfig();
    if (!cfg.enabled) {
        throw new Error('Enable ENABLE_LOCAL_SCHEDULING on the API (Settings → Local demo calendar).');
    }
    const baseUrl = localSchedulingBaseUrl(cfg.book_slot_url);
    const appointmentsUrl = cfg.appointments_url;
    const nextVars = {
        ...input.templateContextVariables,
        scheduling_api_base_url: baseUrl,
    };
    await input.saveTemplateContextVariables(nextVars);

    const names = (input.toolNames ?? ['book_slot']).filter(
        (n) =>
            n in LOCAL_SCHEDULING_TOOL_BUILDERS ||
            n.startsWith('book_') ||
            n.startsWith('schedule_') ||
            n.includes('reschedule'),
    );
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
        const builder =
            LOCAL_SCHEDULING_TOOL_BUILDERS[name] ?? LOCAL_SCHEDULING_TOOL_BUILDERS.book_demo;
        const res = await createToolApiV1ToolsPost({
            body: {
                name,
                description: `Local demo calendar — ${name} for analytics mapped_data proof.`,
                category: 'http_api',
                icon: 'globe',
                icon_color: '#3B82F6',
                definition: builder(baseUrl, appointmentsUrl),
            },
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.tool_uuid) {
            created.push(name);
        }
    }

    return { baseUrl, createdToolNames: created };
}

export { LOCAL_SCHEDULING_TOOL_NAMES };
