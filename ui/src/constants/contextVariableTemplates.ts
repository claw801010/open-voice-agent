export const SYSTEM_CONTEXT_VARIABLE_TEMPLATES = [
    "{{caller_number}}",
    "{{called_number}}",
    "{{call_id}}",
    "{{workflow_id}}",
    "{{organization_id}}",
    "{{timestamp}}",
    "{{timezone}}",
    "{{locale}}",
];

export const CONVERSATION_CONTEXT_VARIABLE_TEMPLATES = [
    "{{initial_context.customer_name}}",
    "{{initial_context.customer_id}}",
    "{{conversation.intent}}",
    "{{conversation.summary}}",
    "{{conversation.last_user_message}}",
    "{{conversation.sentiment}}",
];

export const DEFAULT_CONTEXT_TEMPLATE_SUGGESTIONS = [
    ...SYSTEM_CONTEXT_VARIABLE_TEMPLATES,
    ...CONVERSATION_CONTEXT_VARIABLE_TEMPLATES,
];

/** Short hint under each `{{…}}` row in grouped pickers; filter matches this text too. */
export const HTTP_VARIABLE_TEMPLATE_LABELS: Record<string, string> = {
    "{{caller_number}}": "Caller phone (E.164)",
    "{{called_number}}": "Number that was dialed",
    "{{call_id}}": "Unique call/session id",
    "{{workflow_id}}": "Current workflow id",
    "{{organization_id}}": "Current organization id",
    "{{timestamp}}": "ISO time of the request",
    "{{timezone}}": "IANA timezone id",
    "{{locale}}": "BCP 47 locale (e.g. en-US)",
    "{{initial_context.customer_name}}": "Customer display name from workflow",
    "{{initial_context.customer_id}}": "Customer id from workflow",
    "{{conversation.intent}}": "Last classified intent",
    "{{conversation.summary}}": "Rolling conversation summary",
    "{{conversation.last_user_message}}": "Last user utterance",
    "{{conversation.sentiment}}": "Sentiment label (e.g. neutral)",
};

export interface VariableSuggestionGroup {
    label: string;
    options: string[];
}

/** Labels for HTTP tool variable pickers (Simple + Advanced + JSON insert controls). */
export const HTTP_VARIABLE_GROUP_LABELS = {
    system: "System defaults",
    conversation: "Conversation state",
    custom: "Custom flow variables",
    live: "Tool parameters & mapping keys",
} as const;

/** Native `title` on grouped variable picker headers (`{{…}}` inserts — URL, headers, JSON, etc.). */
export const HTTP_VARIABLE_GROUP_PICKER_TOOLTIPS: Record<string, string> = {
    [HTTP_VARIABLE_GROUP_LABELS.system]:
        "Built-in {{…}} tokens for per-call metadata (phone numbers, call_id, workflow_id, organization_id, time, locale). Values come from the live session; the HTTP tool test card uses an app default sample in call context JSON.",
    [HTTP_VARIABLE_GROUP_LABELS.conversation]:
        "Built-in {{…}} for session fields: initial_context.* and conversation.*. Same runtime vs app default sample split as System.",
    [HTTP_VARIABLE_GROUP_LABELS.custom]:
        "Paths you added under Custom flow variable (stored as {{path}} in this browser). Appears here, in Preset path (Form), and in JSON insert pickers.",
    [HTTP_VARIABLE_GROUP_LABELS.live]:
        "Parameter names and response-mapping keys from this tool — same names the model may send.",
};

/** Extra “Preset path” group in call-context Form (merged from `variableSuggestions`). */
export const CALL_CONTEXT_FLOW_PATH_GROUP_LABEL = "From your flow (custom & tool keys)";

/** Native `title` on call-context Form Preset path groups (dot paths, not {{…}}). */
export const CALL_CONTEXT_PRESET_GROUP_TOOLTIPS: Record<string, string> = {
    System: "Top-level runtime keys: caller/called numbers, call_id, workflow_id, organization_id, time, locale.",
    Conversation: "Nested conversation.* — intent, summary, last_user_message, sentiment.",
    "Initial context": "Nested initial_context.* — e.g. customer_name, customer_id from your workflow.",
    [CALL_CONTEXT_FLOW_PATH_GROUP_LABEL]:
        "Dot paths derived from your custom {{…}} keys plus tool parameter and response-mapping names.",
};

/**
 * Plain dot paths for **response mapping** value fields (paths into the HTTP response JSON). These are not
 * `{{…}}` call-context templates; use the insert control to avoid typos in common API shapes.
 */
export const HTTP_RESPONSE_PATH_PRESET_GROUPS: VariableSuggestionGroup[] = [
    {
        label: "Common response shapes",
        options: ["id", "data", "data.id", "data.items.0", "data.items.0.id", "result", "message", "error"],
    },
];

/** Native `title` on response-mapping value preset group. */
export const HTTP_RESPONSE_PATH_GROUP_TOOLTIPS: Record<string, string> = {
    "Common response shapes":
        "Typical REST JSON response paths — insert then edit to match your API body shape.",
};

/** Merged default native `title` strings for grouped string option pickers (HTTP tool + call context). */
export const GROUPED_PICKER_BUILTIN_HEADER_TOOLTIPS: Record<string, string> = {
    ...HTTP_VARIABLE_GROUP_PICKER_TOOLTIPS,
    ...CALL_CONTEXT_PRESET_GROUP_TOOLTIPS,
    ...HTTP_RESPONSE_PATH_GROUP_TOOLTIPS,
};

/** Dot paths for test call-context sample editor (match runtime `{{path}}` keys). */
export const CALL_CONTEXT_PATH_PRESET_GROUPS: VariableSuggestionGroup[] = [
    {
        label: "System",
        options: [
            "caller_number",
            "called_number",
            "call_id",
            "workflow_id",
            "organization_id",
            "timestamp",
            "timezone",
            "locale",
        ],
    },
    {
        label: "Conversation",
        options: [
            "conversation.intent",
            "conversation.summary",
            "conversation.last_user_message",
            "conversation.sentiment",
        ],
    },
    {
        label: "Initial context",
        options: ["initial_context.customer_name", "initial_context.customer_id"],
    },
];

/** Short hint under each dot path in call-context Preset path pickers; filter matches hint text too. */
export const CALL_CONTEXT_PATH_LABELS: Record<string, string> = {
    caller_number: "Maps to {{caller_number}} in templates",
    called_number: "Maps to {{called_number}}",
    call_id: "Maps to {{call_id}}",
    workflow_id: "Maps to {{workflow_id}}",
    organization_id: "Maps to {{organization_id}}",
    timestamp: "Maps to {{timestamp}}",
    timezone: "Maps to {{timezone}}",
    locale: "Maps to {{locale}}",
    "conversation.intent": "Maps to {{conversation.intent}}",
    "conversation.summary": "Maps to {{conversation.summary}}",
    "conversation.last_user_message": "Maps to {{conversation.last_user_message}}",
    "conversation.sentiment": "Maps to {{conversation.sentiment}}",
    "initial_context.customer_name": "Maps to {{initial_context.customer_name}}",
    "initial_context.customer_id": "Maps to {{initial_context.customer_id}}",
};

/** Merged built-in subtitles for [GroupedStringOptionPicker](ui/src/components/http/grouped-string-option-picker.tsx). */
export const GROUPED_PICKER_BUILTIN_OPTION_SUBTITLES: Record<string, string> = {
    ...HTTP_VARIABLE_TEMPLATE_LABELS,
    ...CALL_CONTEXT_PATH_LABELS,
};

/** `{{a.b.c}}` → `a.b.c` for call-context path fields (matches template resolution keys). */
export function templateTokenToDotPath(template: string): string | null {
    const t = template.trim();
    const m = t.match(/^\{\{([^}]+)\}\}$/);
    if (!m) return null;
    const inner = m[1].trim();
    return inner.length > 0 ? inner : null;
}

/**
 * Append dot paths from `{{…}}` strings (custom variables, live parameter/mapping keys) not already covered by
 * static groups so the call-context Form "Preset path" list matches other pickers.
 */
export function mergePathPresetGroupsWithFlowTemplates(
    base: VariableSuggestionGroup[],
    flatTemplateStrings: string[],
): VariableSuggestionGroup[] {
    const seen = new Set<string>();
    for (const g of base) {
        for (const o of g.options) {
            seen.add(o);
        }
    }
    const extra: string[] = [];
    for (const tmpl of flatTemplateStrings) {
        const p = templateTokenToDotPath(tmpl);
        if (p && !seen.has(p)) {
            seen.add(p);
            extra.push(p);
        }
    }
    extra.sort((a, b) => a.localeCompare(b));
    if (extra.length === 0) {
        return base;
    }
    return [
        ...base,
        {
            label: CALL_CONTEXT_FLOW_PATH_GROUP_LABEL,
            options: extra,
        },
    ];
}

/** Sample JSON for test calls — resolves common {{...}} paths (merge/edit as needed). */
export const DEFAULT_CALL_CONTEXT_TEST_JSON = JSON.stringify(
    {
        caller_number: "+15551234567",
        called_number: "+18005551212",
        call_id: "test-call-example",
        workflow_id: 0,
        organization_id: 0,
        timestamp: "2026-04-25T12:00:00Z",
        timezone: "America/Los_Angeles",
        locale: "en-US",
        conversation: {
            intent: "support",
            summary: "Test conversation summary",
            last_user_message: "Hello",
            sentiment: "neutral",
        },
        initial_context: {
            customer_name: "Test Customer",
            customer_id: "cust_test_123",
        },
    },
    null,
    2
);
