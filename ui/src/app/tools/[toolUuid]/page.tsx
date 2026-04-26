"use client";

import { ArrowLeft, Code, ExternalLink, Loader2, Save } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
    getToolApiV1ToolsToolUuidGet,
    listRecordingsApiV1WorkflowRecordingsGet,
    updateToolApiV1ToolsToolUuidPut,
} from "@/client/sdk.gen";
import type { RecordingResponseSchema, ToolResponse, TransferCallConfig as APITransferCallConfig } from "@/client/types.gen";
import type { EndCallConfig } from "@/client/types.gen";
import { type HttpMethod, type KeyValueItem, type ToolParameter, validateUrl } from "@/components/http";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
    CONVERSATION_CONTEXT_VARIABLE_TEMPLATES,
    DEFAULT_CALL_CONTEXT_TEST_JSON,
    DEFAULT_CONTEXT_TEMPLATE_SUGGESTIONS,
    HTTP_VARIABLE_GROUP_LABELS,
    SYSTEM_CONTEXT_VARIABLE_TEMPLATES,
} from "@/constants/contextVariableTemplates";
import { TOOL_DOCUMENTATION_URLS } from "@/constants/documentation";
import { useUnsavedChanges } from "@/context/UnsavedChangesContext";
import { useAuth } from "@/lib/auth";
import { mergeCallContextJsonWithDefaults } from "@/lib/callContextSampleForm";
import { sortDistinctTemplates } from "@/lib/httpToolVariablePickers";

import {
    DEFAULT_END_CALL_REASON_DESCRIPTION,
    type EndCallMessageType,
    getCategoryConfig,
    getToolTypeLabel,
    renderToolIcon,
    type ToolCategory,
} from "../config";
import { BuiltinToolConfig, EndCallToolConfig, HttpApiToolConfig, TransferCallToolConfig } from "./components";
import { useToolFormRawTabs } from "./hooks/useToolFormRawTabs";
import { useToolPageDirty } from "./hooks/useToolPageDirty";

function collectTemplatePathsFromStrings(strings: string[]): string[] {
    const re = /\{\{\s*([^}]+?)\s*\}\}/g;
    const out = new Set<string>();
    for (const str of strings) {
        if (!str) continue;
        const r = new RegExp(re.source, "g");
        let m: RegExpExecArray | null;
        while ((m = r.exec(str)) !== null) {
            const p = m[1].trim();
            if (p) out.add(p);
        }
    }
    return [...out];
}

// Extended HttpApiConfig with parameters (until client types are regenerated)
interface HttpApiConfigWithParams {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    header_fields?: Array<{ key: string; value: string; description?: string }>;
    credential_uuid?: string;
    parameters?: ToolParameter[];
    timeout_ms?: number;
    customMessage?: string;
    response_mapping?: Record<string, string>;
    body_template?: string;
    raw_code?: string;
    raw_language?: 'python' | 'bash';
}

export default function ToolDetailPage() {
    const { toolUuid } = useParams<{ toolUuid: string }>();
    const { user, getAccessToken, redirectToLogin, loading } = useAuth();
    const router = useRouter();

    const [tool, setTool] = useState<ToolResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [showCodeDialog, setShowCodeDialog] = useState(false);

    // Common form state
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    // Shared form state
    const [customMessage, setCustomMessage] = useState("");

    // HTTP API form state
    const [httpMethod, setHttpMethod] = useState<HttpMethod>("POST");
    const [url, setUrl] = useState("");
    const [credentialUuid, setCredentialUuid] = useState("");
    const [headers, setHeaders] = useState<KeyValueItem[]>([]);
    const [parameters, setParameters] = useState<ToolParameter[]>([]);
    const [timeoutMs, setTimeoutMs] = useState(5000);
    const [responseMappings, setResponseMappings] = useState<KeyValueItem[]>([]);
    const [testPayload, setTestPayload] = useState("{}");
    const [isTestingCall, setIsTestingCall] = useState(false);
    const [testResult, setTestResult] = useState<string>("");
    const [lastResponseData, setLastResponseData] = useState<unknown>(null);
    const [rawCode, setRawCode] = useState("");
    const [rawLanguage, setRawLanguage] = useState<'python' | 'bash'>("python");
    const [bodyTemplate, setBodyTemplate] = useState("");
    const [customVariableSuggestions, setCustomVariableSuggestions] = useState<string[]>([]);
    const [customVariableDraft, setCustomVariableDraft] = useState("");
    const [callContextTestJson, setCallContextTestJson] = useState(DEFAULT_CALL_CONTEXT_TEST_JSON);
    const [templatePreviewWarnings, setTemplatePreviewWarnings] = useState<string[]>([]);

    // End Call form state
    const [endCallMessageType, setEndCallMessageType] = useState<EndCallMessageType>("none");
    const [endCallReason, setEndCallReason] = useState(false);
    const [endCallReasonDescription, setEndCallReasonDescription] = useState("");
    const [audioRecordingId, setAudioRecordingId] = useState("");

    const handleEndCallReasonChange = (enabled: boolean) => {
        setEndCallReason(enabled);
        if (enabled && !endCallReasonDescription) {
            setEndCallReasonDescription(DEFAULT_END_CALL_REASON_DESCRIPTION);
        }
    };

    // Transfer Call form state
    const [transferDestination, setTransferDestination] = useState("");
    const [transferMessageType, setTransferMessageType] = useState<EndCallMessageType>("none");
    const [transferTimeout, setTransferTimeout] = useState(30);
    const [transferAudioRecordingId, setTransferAudioRecordingId] = useState("");

    // HTTP API form state - custom message type
    const [customMessageType, setCustomMessageType] = useState<'text' | 'audio'>('text');
    const [customMessageRecordingId, setCustomMessageRecordingId] = useState("");

    // Org-level recordings for audio dropdowns
    const [recordings, setRecordings] = useState<RecordingResponseSchema[]>([]);

    // Redirect if not authenticated
    useEffect(() => {
        if (!loading && !user) {
            redirectToLogin();
        }
    }, [loading, user, redirectToLogin]);

    const populateFormFromTool = useCallback((tool: ToolResponse) => {
        setName(tool.name);
        setDescription(tool.description || "");

        if (tool.category === "end_call") {
            // Populate end call specific fields
            const config = tool.definition?.config as EndCallConfig | undefined;
            if (config) {
                setEndCallMessageType(config.messageType || "none");
                setCustomMessage(config.customMessage || "");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setAudioRecordingId((config as any).audioRecordingId || "");
                setEndCallReason(config.endCallReason ?? false);
                setEndCallReasonDescription(config.endCallReasonDescription || "");
            } else {
                setEndCallMessageType("none");
                setCustomMessage("");
                setAudioRecordingId("");
                setEndCallReason(false);
                setEndCallReasonDescription("");
            }
        } else if (tool.category === "transfer_call") {
            // Populate transfer call specific fields
            const config = tool.definition?.config as APITransferCallConfig | undefined;
            if (config) {
                setTransferDestination(config.destination || "");
                setTransferMessageType(config.messageType || "none");
                setCustomMessage(config.customMessage || "");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setTransferAudioRecordingId((config as any).audioRecordingId || "");
                setTransferTimeout(config.timeout ?? 30);
            } else {
                setTransferDestination("");
                setTransferMessageType("none");
                setCustomMessage("");
                setTransferAudioRecordingId("");
                setTransferTimeout(30);
            }
        } else if (tool.category === "calculator") {
            // Name/description only — no definition config fields in the form
        } else {
            // Populate HTTP API specific fields
            const config = tool.definition?.config as HttpApiConfigWithParams | undefined;
            if (config) {
                setHttpMethod((config.method as HttpMethod) || "POST");
                setUrl(config.url || "");
                setCredentialUuid(config.credential_uuid || "");
                setTimeoutMs(config.timeout_ms || 5000);
                setCustomMessage(config.customMessage || "");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setCustomMessageType((config as any).customMessageType || "text");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setCustomMessageRecordingId((config as any).customMessageRecordingId || "");

                // Convert headers object to array
                if (config.header_fields && config.header_fields.length > 0) {
                    setHeaders(
                        config.header_fields.map((row) => ({
                            key: row.key || "",
                            value: row.value || "",
                            description: row.description || "",
                        }))
                    );
                } else if (config.headers) {
                    setHeaders(
                        Object.entries(config.headers).map(([key, value]) => ({
                            key,
                            value: value as string,
                            description: "",
                        }))
                    );
                } else {
                    setHeaders([]);
                }

                // Load parameters
                if (config.parameters && Array.isArray(config.parameters)) {
                    setParameters(
                        config.parameters.map((p: ToolParameter) => ({
                            name: p.name || "",
                            type: p.type || "string",
                            description: p.description || "",
                            required: p.required ?? true,
                            valueTemplate:
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (p as any).value_template || p.valueTemplate || "",
                        }))
                    );
                } else {
                    setParameters([]);
                }

                if (config.response_mapping) {
                    setResponseMappings(
                        Object.entries(config.response_mapping).map(([key, value]) => ({
                            key,
                            value,
                        }))
                    );
                } else {
                    setResponseMappings([]);
                }
                setRawLanguage(config.raw_language || "python");
                setRawCode(config.raw_code || "");
                setBodyTemplate(config.body_template || "");
            }
        }
    }, []);

    const fetchTool = useCallback(async () => {
        if (loading || !user || !toolUuid) return;

        try {
            setIsLoading(true);
            setError(null);
            const accessToken = await getAccessToken();

            const response = await getToolApiV1ToolsToolUuidGet({
                path: { tool_uuid: toolUuid },
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (response.data) {
                setTool(response.data);
                populateFormFromTool(response.data);
            }
        } catch (err) {
            setError("Failed to fetch tool");
            console.error("Error fetching tool:", err);
        } finally {
            setIsLoading(false);
        }
    }, [loading, user, toolUuid, getAccessToken, populateFormFromTool]);

    const fetchRecordings = useCallback(async () => {
        if (loading || !user) return;
        try {
            const response = await listRecordingsApiV1WorkflowRecordingsGet({
                query: {},
            });
            if (response.data) {
                setRecordings(response.data.recordings);
            }
        } catch {
            // Non-critical — dropdowns will show "No recordings available"
        }
    }, [loading, user]);

    useEffect(() => {
        fetchTool();
        fetchRecordings();
    }, [fetchTool, fetchRecordings]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = window.localStorage.getItem("tool-http-call-context-json");
            if (raw?.trim()) {
                setCallContextTestJson(raw);
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const timer = window.setTimeout(() => {
            try {
                window.localStorage.setItem("tool-http-call-context-json", callContextTestJson);
            } catch {
                // ignore quota / private mode
            }
        }, 500);
        return () => window.clearTimeout(timer);
    }, [callContextTestJson]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = window.localStorage.getItem("tool-custom-variable-suggestions");
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                const normalized = parsed
                    .filter((v) => typeof v === "string")
                    .map((v) => v.trim())
                    .filter(Boolean);
                setCustomVariableSuggestions(normalized);
            }
        } catch {
            // ignore invalid local storage payload
        }
    }, []);

    const addCustomVariableSuggestion = useCallback(() => {
        const cleaned = customVariableDraft.trim().replace(/^\{\{|\}\}$/g, "");
        if (!cleaned) return;
        const template = `{{${cleaned}}}`;
        setCustomVariableSuggestions((prev) => {
            if (prev.includes(template)) return prev;
            const next = [...prev, template].slice(-30);
            if (typeof window !== "undefined") {
                window.localStorage.setItem(
                    "tool-custom-variable-suggestions",
                    JSON.stringify(next)
                );
            }
            return next;
        });
        setCustomVariableDraft("");
        toast.success("Custom variable added to pickers.");
    }, [customVariableDraft]);

    const resetCallContextSample = useCallback(() => {
        setCallContextTestJson(DEFAULT_CALL_CONTEXT_TEST_JSON);
        toast.success("Restored default sample call context.");
    }, []);

    const mergeCallContextDefaults = useCallback(() => {
        setCallContextTestJson((prev) =>
            mergeCallContextJsonWithDefaults(prev, DEFAULT_CALL_CONTEXT_TEST_JSON)
        );
        toast.success("Added missing default sample paths. Your values were kept.");
    }, []);

    const variableSuggestions = useMemo(() => {
        const fromParameters = parameters
            .map((p) => p.name.trim())
            .filter(Boolean)
            .map((key) => `{{${key}}}`);
        const fromMappings = responseMappings
            .map((m) => m.key.trim())
            .filter(Boolean)
            .map((key) => `{{${key}}}`);
        return sortDistinctTemplates([
            ...DEFAULT_CONTEXT_TEMPLATE_SUGGESTIONS,
            ...customVariableSuggestions,
            ...fromParameters,
            ...fromMappings,
        ]);
    }, [customVariableSuggestions, parameters, responseMappings]);

    const variableSuggestionGroups = useMemo(() => {
        const liveParameterAndMapping = sortDistinctTemplates([
            ...parameters
                .map((p) => p.name.trim())
                .filter(Boolean)
                .map((key) => `{{${key}}}`),
            ...responseMappings
                .map((m) => m.key.trim())
                .filter(Boolean)
                .map((key) => `{{${key}}}`),
        ]);
        const customSorted = sortDistinctTemplates(customVariableSuggestions);
        return [
            { label: HTTP_VARIABLE_GROUP_LABELS.system, options: SYSTEM_CONTEXT_VARIABLE_TEMPLATES },
            { label: HTTP_VARIABLE_GROUP_LABELS.conversation, options: CONVERSATION_CONTEXT_VARIABLE_TEMPLATES },
            { label: HTTP_VARIABLE_GROUP_LABELS.custom, options: customSorted },
            { label: HTTP_VARIABLE_GROUP_LABELS.live, options: liveParameterAndMapping },
        ];
    }, [customVariableSuggestions, parameters, responseMappings]);

    const buildPendingPayload = useCallback(() => {
        if (!tool) return {};
        if (tool.category === "calculator") {
            return {
                name,
                description: description || undefined,
                definition: {
                    schema_version: 1,
                    type: "calculator" as const,
                },
            };
        }
        if (tool.category === "end_call") {
            return {
                name,
                description: description || undefined,
                definition: {
                    schema_version: 1,
                    type: "end_call" as const,
                    config: {
                        messageType: endCallMessageType,
                        customMessage: endCallMessageType === "custom" ? customMessage : undefined,
                        audioRecordingId: endCallMessageType === "audio" ? audioRecordingId || undefined : undefined,
                        endCallReason,
                        endCallReasonDescription: endCallReason ? endCallReasonDescription || undefined : undefined,
                    },
                },
            };
        }
        if (tool.category === "transfer_call") {
            return {
                name,
                description: description || undefined,
                definition: {
                    schema_version: 1,
                    type: "transfer_call" as const,
                    config: {
                        destination: transferDestination,
                        messageType: transferMessageType,
                        customMessage: transferMessageType === "custom" ? customMessage : undefined,
                        audioRecordingId: transferMessageType === "audio" ? transferAudioRecordingId || undefined : undefined,
                        timeout: transferTimeout,
                    },
                },
            };
        }
        const headersObject: Record<string, string> = {};
        headers.filter((h) => h.key && h.value).forEach((h) => {
            headersObject[h.key] = h.value;
        });
        const headerFields = headers
            .filter((h) => h.key.trim() && h.value.trim())
            .map((h) => ({
                key: h.key.trim(),
                value: h.value.trim(),
                description: (h.description || "").trim() || undefined,
            }));
        const validParameters = parameters
            .filter((p) => p.name.trim())
            .map((p) => ({
                name: p.name.trim(),
                type: p.type,
                description: p.description || "",
                required: p.required ?? true,
                value_template: (p.valueTemplate || "").trim() || undefined,
            }));
        const responseMappingObject: Record<string, string> = {};
        responseMappings
            .filter((m) => m.key.trim() && m.value.trim())
            .forEach((m) => {
                responseMappingObject[m.key.trim()] = m.value.trim();
            });
        return {
            name,
            description: description || undefined,
            definition: {
                schema_version: 1,
                type: "http_api" as const,
                config: {
                    method: httpMethod,
                    url,
                    credential_uuid: credentialUuid || undefined,
                    headers: Object.keys(headersObject).length > 0 ? headersObject : undefined,
                    header_fields: headerFields.length > 0 ? headerFields : undefined,
                    parameters: validParameters.length > 0 ? validParameters : undefined,
                    timeout_ms: timeoutMs,
                    customMessage: customMessageType === "text" ? customMessage || undefined : undefined,
                    customMessageType,
                    customMessageRecordingId: customMessageType === "audio" ? customMessageRecordingId || undefined : undefined,
                    response_mapping:
                        Object.keys(responseMappingObject).length > 0
                            ? responseMappingObject
                            : undefined,
                    raw_code: rawCode || undefined,
                    raw_language: rawLanguage || undefined,
                    body_template: bodyTemplate.trim() || undefined,
                },
            },
        };
    }, [
        tool,
        name,
        description,
        endCallMessageType,
        customMessage,
        audioRecordingId,
        endCallReason,
        endCallReasonDescription,
        transferDestination,
        transferMessageType,
        transferAudioRecordingId,
        transferTimeout,
        headers,
        parameters,
        httpMethod,
        url,
        credentialUuid,
        timeoutMs,
        customMessageType,
        customMessageRecordingId,
        responseMappings,
        rawCode,
        rawLanguage,
        bodyTemplate,
    ]);

    const buildHeadersObject = useCallback(() => {
        const headersObject: Record<string, string> = {};
        headers.filter((h) => h.key && h.value).forEach((h) => {
            headersObject[h.key] = h.value;
        });
        return headersObject;
    }, [headers]);

    const generateRawCodeFromForm = useCallback(
        (language: 'python' | 'bash') => {
            const headersObject = buildHeadersObject();
            headersObject["Content-Type"] = headersObject["Content-Type"] || "application/json";
            const payload = testPayload.trim() ? testPayload : "{}";
            if (language === "bash") {
                const curlHeaders = Object.entries(headersObject)
                    .map(([k, v]) => `-H '${k}: ${v}'`)
                    .join(" \\\n  ");
                const dataFlag = httpMethod === "GET" || httpMethod === "DELETE"
                    ? ""
                    : ` \\\n  --data '${payload.replace(/'/g, "'\"'\"'")}'`;
                return `curl -X ${httpMethod} '${url}' \\\n  ${curlHeaders}${dataFlag}`;
            }
            return `import requests\n\nurl = "${url}"\nheaders = ${JSON.stringify(headersObject, null, 4)}\npayload = ${payload}\n\nresponse = requests.request(\n    method="${httpMethod}",\n    url=url,\n    headers=headers,\n    ${httpMethod === "GET" || httpMethod === "DELETE" ? "params=payload" : "json=payload"},\n    timeout=${Math.max(1, Math.floor(timeoutMs / 1000))},\n)\n\nprint(response.status_code)\ntry:\n    print(response.json())\nexcept Exception:\n    print(response.text)\n`;
        },
        [buildHeadersObject, httpMethod, testPayload, timeoutMs, url]
    );

    const handleRegenerateRawCode = useCallback(() => {
        setRawCode(generateRawCodeFromForm(rawLanguage));
    }, [generateRawCodeFromForm, rawLanguage]);

    useEffect(() => {
        if (!rawCode.trim()) {
            setRawCode(generateRawCodeFromForm(rawLanguage));
        }
    }, [generateRawCodeFromForm, rawCode, rawLanguage]);

    const collectPrimitivePaths = useCallback(
        (value: unknown, prefix = "", depth = 0): string[] => {
            if (depth > 4) return [];
            if (value === null || value === undefined) return [];
            if (typeof value !== "object") return prefix ? [prefix] : [];
            if (Array.isArray(value)) {
                const paths: string[] = [];
                value.forEach((item, idx) => {
                    const childPrefix = prefix ? `${prefix}.${idx}` : String(idx);
                    paths.push(...collectPrimitivePaths(item, childPrefix, depth + 1));
                });
                return paths;
            }
            const obj = value as Record<string, unknown>;
            return Object.entries(obj).flatMap(([k, v]) => {
                const childPrefix = prefix ? `${prefix}.${k}` : k;
                if (v !== null && typeof v === "object") {
                    return collectPrimitivePaths(v, childPrefix, depth + 1);
                }
                return [childPrefix];
            });
        },
        []
    );

    const handleAutoMapResponse = useCallback(() => {
        if (!lastResponseData) {
            toast.error("Run a test call first to auto-map response fields.");
            return;
        }
        const source =
            typeof lastResponseData === "object" &&
            lastResponseData !== null &&
            "data" in (lastResponseData as Record<string, unknown>)
                ? (lastResponseData as { data: unknown }).data
                : lastResponseData;
        const paths = collectPrimitivePaths(source).slice(0, 30);
        if (paths.length === 0) {
            toast.error("No mappable response fields found.");
            return;
        }
        const nextMappings = paths.map((path) => {
            const leaf = path.split(".").pop() || "value";
            const key = leaf.replace(/[^a-zA-Z0-9_]/g, "_");
            return { key, value: path };
        });
        setResponseMappings(nextMappings);
        toast.success(`Mapped ${nextMappings.length} response fields.`);
    }, [collectPrimitivePaths, lastResponseData]);

    const extractPathValue = useCallback((source: unknown, path: string): unknown => {
        if (!path.trim()) return undefined;
        const segments = path.split(".");
        let current: unknown = source;
        for (const segment of segments) {
            if (current === null || current === undefined) return undefined;
            if (Array.isArray(current)) {
                const idx = Number.parseInt(segment, 10);
                if (Number.isNaN(idx)) return undefined;
                current = current[idx];
                continue;
            }
            if (typeof current === "object") {
                current = (current as Record<string, unknown>)[segment];
                continue;
            }
            return undefined;
        }
        return current;
    }, []);

    const inferParameterType = useCallback((value: unknown): ToolParameter["type"] => {
        if (typeof value === "number") return "number";
        if (typeof value === "boolean") return "boolean";
        return "string";
    }, []);

    const handleApplyMappingsToParameters = useCallback(() => {
        const validMappings = responseMappings
            .filter((m) => m.key.trim() && m.value.trim())
            .map((m) => ({ key: m.key.trim(), value: m.value.trim() }));
        if (validMappings.length === 0) {
            toast.error("Add response mappings first.");
            return;
        }

        const existingByName = new Map(parameters.map((p) => [p.name.trim(), p]));
        const source =
            typeof lastResponseData === "object" &&
            lastResponseData !== null &&
            "data" in (lastResponseData as Record<string, unknown>)
                ? (lastResponseData as { data: unknown }).data
                : lastResponseData;

        const merged = validMappings.map(({ key, value }) => {
            const existing = existingByName.get(key);
            const sampleValue = extractPathValue(source, value);
            const inferred = inferParameterType(sampleValue);
            const template = `{{${key}}}`;

            if (existing) {
                return {
                    ...existing,
                    name: key,
                    description:
                        existing.description?.trim() ||
                        `Derived from mapped response path "${value}".`,
                    type: existing.type || inferred,
                    valueTemplate: existing.valueTemplate || template,
                };
            }

            return {
                name: key,
                type: inferred,
                description: `Derived from mapped response path "${value}".`,
                required: false,
                valueTemplate: template,
            } as ToolParameter;
        });

        // Keep existing parameters that are not touched by mapping keys.
        const untouched = parameters.filter(
            (p) => !validMappings.some((m) => m.key === p.name.trim())
        );
        setParameters([...untouched, ...merged]);
        toast.success(`Applied ${merged.length} mapped fields to parameters.`);
    }, [responseMappings, parameters, lastResponseData, extractPathValue, inferParameterType]);

    const handleTestHttpCall = useCallback(async () => {
        const urlValidation = validateUrl(url);
        if (!urlValidation.valid) {
            setError(urlValidation.error || "Invalid URL");
            return;
        }

        let parsedPayload: Record<string, unknown> = {};
        const trimmed = testPayload.trim();
        if (trimmed) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    parsedPayload = parsed as Record<string, unknown>;
                } else {
                    setError("Test payload must be a JSON object.");
                    return;
                }
            } catch {
                setError("Test payload must be valid JSON.");
                return;
            }
        }

        const trimmedTemplate = bodyTemplate.trim();
        if (trimmedTemplate) {
            try {
                const parsedTemplate = JSON.parse(trimmedTemplate);
                if (!parsedTemplate || typeof parsedTemplate !== "object" || Array.isArray(parsedTemplate)) {
                    setError("Body template must be a JSON object.");
                    return;
                }
            } catch {
                setError("Body template must be valid JSON.");
                return;
            }
        }

        let parsedCallContext: Record<string, unknown> = {};
        const ctxTrim = callContextTestJson.trim();
        if (ctxTrim) {
            try {
                const parsed = JSON.parse(ctxTrim);
                if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                    setError("Call context must be a JSON object.");
                    return;
                }
                parsedCallContext = parsed as Record<string, unknown>;
            } catch {
                setError("Call context must be valid JSON.");
                return;
            }
        }

        try {
            setIsTestingCall(true);
            setError(null);
            setTemplatePreviewWarnings([]);
            const accessToken = await getAccessToken();
            const headersObject = buildHeadersObject();
            const headerFields = headers
                .filter((h) => h.key.trim() && h.value.trim())
                .map((h) => ({
                    key: h.key.trim(),
                    value: h.value.trim(),
                    description: (h.description || "").trim() || undefined,
                }));
            const responseMappingObject: Record<string, string> = {};
            responseMappings
                .filter((m) => m.key.trim() && m.value.trim())
                .forEach((m) => {
                    responseMappingObject[m.key.trim()] = m.value.trim();
                });

            const response = await fetch("/api/v1/tools/test-http-call", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    config: {
                        method: httpMethod,
                        url,
                        credential_uuid: credentialUuid || undefined,
                        headers: Object.keys(headersObject).length ? headersObject : undefined,
                        header_fields: headerFields.length > 0 ? headerFields : undefined,
                        timeout_ms: timeoutMs,
                        response_mapping:
                            Object.keys(responseMappingObject).length > 0
                                ? responseMappingObject
                                : undefined,
                        parameters:
                            parameters.length > 0
                                ? parameters
                                      .filter((p) => p.name.trim())
                                      .map((p) => ({
                                          name: p.name.trim(),
                                          type: p.type,
                                          description: p.description || "",
                                          required: p.required ?? true,
                                          value_template: (p.valueTemplate || "").trim() || undefined,
                                      }))
                                : undefined,
                        body_template: bodyTemplate.trim() || undefined,
                    },
                    arguments: parsedPayload,
                    call_context_vars:
                        Object.keys(parsedCallContext).length > 0 ? parsedCallContext : undefined,
                }),
            });

            const result = await response.json();
            setLastResponseData(result);
            setTestResult(JSON.stringify(result, null, 2));
            if (!response.ok || result?.status === "error") {
                throw new Error(result?.error || "Test call failed");
            }
            const stringsToScan = [
                url,
                bodyTemplate,
                ...headers.map((h) => h.value),
                ...headers.map((h) => (h.description || "").trim()).filter(Boolean),
                ...parameters.map((p) => p.valueTemplate || ""),
            ];
            const paths = collectTemplatePathsFromStrings(stringsToScan);
            setTemplatePreviewWarnings(
                paths.filter(
                    (path) =>
                        extractPathValue(parsedPayload, path) === undefined &&
                        extractPathValue(parsedCallContext, path) === undefined
                )
            );
            toast.success("Test API call succeeded.");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Test call failed";
            setError(message);
            setTemplatePreviewWarnings([]);
            toast.error(message);
        } finally {
            setIsTestingCall(false);
        }
    }, [
        credentialUuid,
        getAccessToken,
        buildHeadersObject,
        httpMethod,
        responseMappings,
        parameters,
        headers,
        testPayload,
        bodyTemplate,
        callContextTestJson,
        timeoutMs,
        url,
        extractPathValue,
    ]);

    const applyToolPayload = useCallback(
        (data: unknown) => {
            if (!tool) return;
            const p = data as {
                name: string;
                description?: string;
                definition?: { type?: string };
            };
            const expectedDefType =
                tool.category === "http_api"
                    ? "http_api"
                    : tool.category === "end_call"
                      ? "end_call"
                      : tool.category === "transfer_call"
                        ? "transfer_call"
                        : tool.category === "calculator"
                          ? "calculator"
                          : "";
            if (p.definition?.type && expectedDefType && p.definition.type !== expectedDefType) {
                toast.error(`definition.type must be "${expectedDefType}" for this tool.`);
                return;
            }
            setName(p.name);
            setDescription(p.description ?? "");
            const merged: ToolResponse = {
                ...tool,
                name: p.name,
                description: p.description ?? null,
                definition: (p.definition ?? tool.definition) as ToolResponse["definition"],
            };
            populateFormFromTool(merged);
        },
        [tool, populateFormFromTool]
    );

    const isFormDirty = useToolPageDirty(tool, buildPendingPayload);

    const { wrapSave, renderFormRawTabs, saveBlocked, discardConfirmNeeded } = useToolFormRawTabs({
        getPendingPayload: buildPendingPayload,
        applyPayload: applyToolPayload,
        formDirty: isFormDirty,
    });

    useUnsavedChanges("tool-detail", discardConfirmNeeded);

    const handleSave = async () => {
        if (!tool) return;

        // Validation based on tool type
        if (tool.category === "calculator") {
            // No validation needed for built-in tools
        } else if (tool.category === "transfer_call") {
            // Validate destination for Transfer Call tools (supports both E.164 and SIP endpoints)
            const e164Pattern = /^\+[1-9]\d{1,14}$/;
            const sipPattern = /^(PJSIP|SIP)\/[\w\-\.@]+$/i;
            const isValidE164 = e164Pattern.test(transferDestination);
            const isValidSip = sipPattern.test(transferDestination);

            if (!transferDestination || (!isValidE164 && !isValidSip)) {
                setError("Please enter a valid phone number (E.164 format) or SIP endpoint (e.g., PJSIP/1234)");
                return;
            }
        } else if (tool.category !== "end_call") {
            // Validate URL for HTTP API tools
            const urlValidation = validateUrl(url);
            if (!urlValidation.valid) {
                setError(urlValidation.error || "Invalid URL");
                return;
            }

            // Validate parameters have names
            const invalidParams = parameters.filter((p) => !p.name.trim());
            if (invalidParams.length > 0) {
                setError("All parameters must have a name");
                return;
            }

            const trimmedTemplate = bodyTemplate.trim();
            if (trimmedTemplate) {
                try {
                    const parsedTemplate = JSON.parse(trimmedTemplate);
                    if (!parsedTemplate || typeof parsedTemplate !== "object" || Array.isArray(parsedTemplate)) {
                        setError("Body template must be a JSON object.");
                        return;
                    }
                } catch {
                    setError("Body template must be valid JSON.");
                    return;
                }
            }
        }

        try {
            setIsSaving(true);
            setError(null);
            setSaveSuccess(false);
            const accessToken = await getAccessToken();

            const requestBody = buildPendingPayload();

            const response = await updateToolApiV1ToolsToolUuidPut({
                path: { tool_uuid: toolUuid },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                body: requestBody as any,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (response.data) {
                setTool(response.data);
                populateFormFromTool(response.data);
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
            }
        } catch (err) {
            setError("Failed to save tool");
            console.error("Error saving tool:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const getCodeSnippet = () => {
        if (!tool) return "";

        const headersObj: Record<string, string> = {
            "Content-Type": "application/json",
        };
        headers.filter((h) => h.key && h.value).forEach((h) => {
            headersObj[h.key] = h.value;
        });

        // Build example body from parameters
        const exampleBody: Record<string, unknown> = {};
        parameters.forEach((p) => {
            if (p.type === "number") {
                exampleBody[p.name] = 0;
            } else if (p.type === "boolean") {
                exampleBody[p.name] = true;
            } else {
                exampleBody[p.name] = `<${p.name}>`;
            }
        });

        const hasBody = httpMethod !== "GET" && httpMethod !== "DELETE" && parameters.length > 0;

        return `// ${tool.name}
// ${tool.description || "HTTP API Tool"}

const response = await fetch("${url}", {
    method: "${httpMethod}",
    headers: ${JSON.stringify(headersObj, null, 4)},${hasBody ? `
    body: JSON.stringify(${JSON.stringify(exampleBody, null, 4)}),` : ""}
});

const data = await response.json();`;
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="space-y-4">
                    <Skeleton className="h-12 w-64" />
                    <Skeleton className="h-64 w-96" />
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                </div>
            </div>
        );
    }

    if (!tool) {
        return (
            <div className="min-h-screen bg-background">
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-4xl mx-auto text-center">
                        <h1 className="text-2xl font-bold mb-4">Tool not found</h1>
                        <Button onClick={() => router.push("/tools")}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Tools
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const isEndCallTool = tool.category === "end_call";
    const isTransferCallTool = tool.category === "transfer_call";
    const isBuiltinTool = tool.category === "calculator";
    const categoryConfig = getCategoryConfig(tool.category as ToolCategory);

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push("/tools")}
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                    style={{
                                        backgroundColor: tool.icon_color || categoryConfig?.iconColor || "#3B82F6",
                                    }}
                                >
                                    {renderToolIcon(tool.category)}
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold">{name}</h1>
                                    <p className="text-sm text-muted-foreground">
                                        {getToolTypeLabel(tool.category)}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {!isEndCallTool && !isTransferCallTool && !isBuiltinTool && (
                                <Button
                                    variant="outline"
                                    onClick={() => setShowCodeDialog(true)}
                                >
                                    <Code className="w-4 h-4 mr-2" />
                                    View Code
                                </Button>
                            )}
                            {TOOL_DOCUMENTATION_URLS[tool.category] && (
                                <a
                                    href={TOOL_DOCUMENTATION_URLS[tool.category]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Docs
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            )}
                        </div>
                    </div>

                    {isBuiltinTool ? (
                        renderFormRawTabs(
                            <BuiltinToolConfig
                                name={name}
                                onNameChange={setName}
                                description={description}
                                onDescriptionChange={setDescription}
                                title="Calculator Configuration"
                                subtitle="Built-in calculator for arithmetic operations. No additional configuration needed."
                            />
                        )
                    ) : isEndCallTool ? (
                        renderFormRawTabs(
                        <EndCallToolConfig
                            name={name}
                            onNameChange={setName}
                            description={description}
                            onDescriptionChange={setDescription}
                            messageType={endCallMessageType}
                            onMessageTypeChange={setEndCallMessageType}
                            customMessage={customMessage}
                            onCustomMessageChange={setCustomMessage}
                            audioRecordingId={audioRecordingId}
                            onAudioRecordingIdChange={setAudioRecordingId}
                            recordings={recordings}
                            endCallReason={endCallReason}
                            onEndCallReasonChange={handleEndCallReasonChange}
                            endCallReasonDescription={endCallReasonDescription}
                            onEndCallReasonDescriptionChange={setEndCallReasonDescription}
                        />
                        )
                    ) : isTransferCallTool ? (
                        renderFormRawTabs(
                        <TransferCallToolConfig
                            name={name}
                            onNameChange={setName}
                            description={description}
                            onDescriptionChange={setDescription}
                            destination={transferDestination}
                            onDestinationChange={setTransferDestination}
                            messageType={transferMessageType}
                            onMessageTypeChange={setTransferMessageType}
                            customMessage={customMessage}
                            onCustomMessageChange={setCustomMessage}
                            audioRecordingId={transferAudioRecordingId}
                            onAudioRecordingIdChange={setTransferAudioRecordingId}
                            recordings={recordings}
                            timeout={transferTimeout}
                            onTimeoutChange={setTransferTimeout}
                        />
                        )
                    ) : (
                        <HttpApiToolConfig
                            name={name}
                            onNameChange={setName}
                            description={description}
                            onDescriptionChange={setDescription}
                            httpMethod={httpMethod}
                            onHttpMethodChange={setHttpMethod}
                            url={url}
                            onUrlChange={setUrl}
                            credentialUuid={credentialUuid}
                            onCredentialUuidChange={setCredentialUuid}
                            headers={headers}
                            onHeadersChange={setHeaders}
                            parameters={parameters}
                            onParametersChange={setParameters}
                            timeoutMs={timeoutMs}
                            onTimeoutMsChange={setTimeoutMs}
                            customMessage={customMessage}
                            onCustomMessageChange={setCustomMessage}
                            customMessageType={customMessageType}
                            onCustomMessageTypeChange={setCustomMessageType}
                            customMessageRecordingId={customMessageRecordingId}
                            onCustomMessageRecordingIdChange={setCustomMessageRecordingId}
                            recordings={recordings}
                            responseMappings={responseMappings}
                            onResponseMappingsChange={setResponseMappings}
                            testPayload={testPayload}
                            onTestPayloadChange={setTestPayload}
                            onTestCall={handleTestHttpCall}
                            isTestingCall={isTestingCall}
                            testResult={testResult}
                            onAutoMapResponse={handleAutoMapResponse}
                            onApplyMappingsToParameters={handleApplyMappingsToParameters}
                            rawCode={rawCode}
                            onRawCodeChange={setRawCode}
                            rawLanguage={rawLanguage}
                            onRawLanguageChange={setRawLanguage}
                            onRegenerateRawCode={handleRegenerateRawCode}
                            bodyTemplate={bodyTemplate}
                            onBodyTemplateChange={setBodyTemplate}
                            variableSuggestions={variableSuggestions}
                            variableSuggestionGroups={variableSuggestionGroups}
                            customVariableDraft={customVariableDraft}
                            onCustomVariableDraftChange={setCustomVariableDraft}
                            onAddCustomVariable={addCustomVariableSuggestion}
                            callContextTestJson={callContextTestJson}
                            onCallContextTestJsonChange={setCallContextTestJson}
                            onResetCallContextSample={resetCallContextSample}
                            onMergeCallContextDefaults={mergeCallContextDefaults}
                            templatePreviewWarnings={templatePreviewWarnings}
                        />
                    )}

                    {error && (
                        <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                            {error}
                        </div>
                    )}

                    {saveSuccess && (
                        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600">
                            Tool saved successfully!
                        </div>
                    )}

                    <div className="flex justify-end mt-6">
                        <Button onClick={wrapSave(handleSave)} disabled={isSaving || saveBlocked}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Save
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Code View Dialog (only for HTTP API tools) */}
            <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Code Preview</DialogTitle>
                        <DialogDescription>
                            JavaScript code to make this API call
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-auto max-h-96">
                        <pre>{getCodeSnippet()}</pre>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
