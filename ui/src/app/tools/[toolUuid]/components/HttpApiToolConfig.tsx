"use client";

import { AlertCircle, CircleHelp, ExternalLink, Sparkles, TestTube2 } from "lucide-react";
import { useState } from "react";

import type { RecordingResponseSchema } from "@/client/types.gen";
import { TextOrAudioInput } from "@/components/flow/TextOrAudioInput";
import {
    CredentialSelector,
    type HttpMethod,
    HttpMethodSelector,
    KeyValueEditor,
    type KeyValueItem,
    ParameterEditor,
    type ToolParameter,
    UrlInput,
} from "@/components/http";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    HTTP_RESPONSE_PATH_PRESET_GROUPS,
    HTTP_VARIABLE_GROUP_LABELS,
    type VariableSuggestionGroup,
} from "@/constants/contextVariableTemplates";
import {
    CONTEXT_VARIABLES_DOC_URL,
    SETTINGS_DOCUMENTATION_URLS,
    TOOL_DOCUMENTATION_URLS,
} from "@/constants/documentation";

import { CallContextSampleEditor } from "./CallContextSampleEditor";
import { JsonTemplateTextarea } from "./jsonTemplateTextarea";

function TemplatePreviewWarnings({ paths }: { paths: string[] }) {
    if (paths.length === 0) return null;
    return (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <div className="font-medium flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                These <code className="text-[11px]">{"{{path}}"}</code> locations appear in the URL, headers, body
                template, or parameter value templates, but the path is not present in your test arguments or
                call context JSON (they will be empty in the test request unless you add matching keys).
            </div>
            <ul className="mt-2 list-disc pl-4 space-y-0.5">
                {paths.map((p) => (
                    <li key={p}>
                        <code className="text-[11px]">{`{{${p}}}`}</code>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export interface HttpApiToolConfigProps {
    name: string;
    onNameChange: (name: string) => void;
    description: string;
    onDescriptionChange: (description: string) => void;
    httpMethod: HttpMethod;
    onHttpMethodChange: (method: HttpMethod) => void;
    url: string;
    onUrlChange: (url: string) => void;
    credentialUuid: string;
    onCredentialUuidChange: (uuid: string) => void;
    headers: KeyValueItem[];
    onHeadersChange: (headers: KeyValueItem[]) => void;
    parameters: ToolParameter[];
    onParametersChange: (parameters: ToolParameter[]) => void;
    timeoutMs: number;
    onTimeoutMsChange: (timeout: number) => void;
    customMessage: string;
    onCustomMessageChange: (message: string) => void;
    customMessageType: "text" | "audio";
    onCustomMessageTypeChange: (type: "text" | "audio") => void;
    customMessageRecordingId: string;
    onCustomMessageRecordingIdChange: (id: string) => void;
    recordings?: RecordingResponseSchema[];
    responseMappings: KeyValueItem[];
    onResponseMappingsChange: (items: KeyValueItem[]) => void;
    testPayload: string;
    onTestPayloadChange: (value: string) => void;
    onTestCall: () => void;
    isTestingCall?: boolean;
    testResult?: string;
    onAutoMapResponse?: () => void;
    onApplyMappingsToParameters?: () => void;
    rawCode: string;
    onRawCodeChange: (value: string) => void;
    rawLanguage: "python" | "bash";
    onRawLanguageChange: (value: "python" | "bash") => void;
    onRegenerateRawCode: () => void;
    bodyTemplate: string;
    onBodyTemplateChange: (value: string) => void;
    variableSuggestions: string[];
    variableSuggestionGroups: VariableSuggestionGroup[];
    customVariableDraft: string;
    onCustomVariableDraftChange: (value: string) => void;
    onAddCustomVariable: () => void;
    callContextTestJson: string;
    onCallContextTestJsonChange: (value: string) => void;
    onResetCallContextSample: () => void;
    onMergeCallContextDefaults: () => void;
    /** Add missing top-level keys to test JSON from tool parameter names (value templates when set). */
    onSeedTestPayloadFromParameters?: () => void;
    /** Same as test payload seeding, for optional body template JSON. */
    onSeedBodyTemplateFromParameters?: () => void;
    templatePreviewWarnings: string[];
    /** Loaded from GET /api/v1/organizations/http-integration-cache-policy (HTTP tools only). */
    httpIntegrationCachePolicy?: {
        deferralNotBefore: string;
        cacheEnabled: boolean;
        implementationStatus: string;
    } | null;
}

export function HttpApiToolConfig({
    name,
    onNameChange,
    description,
    onDescriptionChange,
    httpMethod,
    onHttpMethodChange,
    url,
    onUrlChange,
    credentialUuid,
    onCredentialUuidChange,
    headers,
    onHeadersChange,
    parameters,
    onParametersChange,
    timeoutMs,
    onTimeoutMsChange,
    customMessage,
    onCustomMessageChange,
    customMessageType,
    onCustomMessageTypeChange,
    customMessageRecordingId,
    onCustomMessageRecordingIdChange,
    recordings = [],
    responseMappings,
    onResponseMappingsChange,
    testPayload,
    onTestPayloadChange,
    onTestCall,
    isTestingCall = false,
    testResult,
    onAutoMapResponse,
    onApplyMappingsToParameters,
    rawCode,
    onRawCodeChange,
    rawLanguage,
    onRawLanguageChange,
    onRegenerateRawCode,
    bodyTemplate,
    onBodyTemplateChange,
    variableSuggestions,
    variableSuggestionGroups,
    customVariableDraft,
    onCustomVariableDraftChange,
    onAddCustomVariable,
    callContextTestJson,
    onCallContextTestJsonChange,
    onResetCallContextSample,
    onMergeCallContextDefaults,
    onSeedTestPayloadFromParameters,
    onSeedBodyTemplateFromParameters,
    templatePreviewWarnings,
    httpIntegrationCachePolicy,
}: HttpApiToolConfigProps) {
    const [variableInsertMode, setVariableInsertMode] = useState<"replace" | "append">(
        "replace"
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tool Configuration</CardTitle>
                <CardDescription>
                    Configure API call with Simple, Advanced, or Raw code modes.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-4 rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                    Use templates like <code>{"{{conversation.customer.id}}"}</code> or <code>{"{{customer.id}}"}</code> in parameter defaults, header values, body template JSON, and the endpoint URL. Headers and URL resolve {"{{…}}"} after body defaults merge with arguments (same as live calls and Test API Call). Pickers always list four groups (empty groups show a short hint):{" "}
                    <strong className="text-foreground/90">{HTTP_VARIABLE_GROUP_LABELS.system}</strong> and{" "}
                    <strong className="text-foreground/90">{HTTP_VARIABLE_GROUP_LABELS.conversation}</strong> for built-in
                    tokens; <strong className="text-foreground/90">{HTTP_VARIABLE_GROUP_LABELS.custom}</strong> for paths
                    you add above; <strong className="text-foreground/90">{HTTP_VARIABLE_GROUP_LABELS.live}</strong> from
                    parameter names and response-mapping keys. Call context (test) Form tab: preset paths plus{" "}
                    <span className="font-medium text-foreground/80">Use app default</span> per row when a built-in sample
                    exists. Open any picker and type in the filter box to jump quickly.
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <a
                            href={CONTEXT_VARIABLES_DOC_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                            Context variables guide <ExternalLink className="h-3 w-3" />
                        </a>
                        <a
                            href={SETTINGS_DOCUMENTATION_URLS.templateVariables}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                            Workflow template variables <ExternalLink className="h-3 w-3" />
                        </a>
                        <a
                            href={TOOL_DOCUMENTATION_URLS.http_api}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                            HTTP tool docs <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                </div>
                {httpIntegrationCachePolicy ? (
                    <div className="mb-4 rounded-md border border-blue-200/50 bg-blue-500/[0.06] px-3 py-2 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground/85">Integration response cache</span> for this org
                        is <span className="font-medium text-foreground/80">{httpIntegrationCachePolicy.cacheEnabled ? "on" : "off"}</span>
                        {" "}
                        (<code className="text-[10px]">{httpIntegrationCachePolicy.implementationStatus}</code>
                        ). Runtime cache is not planned{" "}
                        <span className="font-medium text-foreground/80">
                            before {httpIntegrationCachePolicy.deferralNotBefore}
                        </span>{" "}
                        unless product policy changes — see{" "}
                        <a
                            href={`${TOOL_DOCUMENTATION_URLS.http_api}#storage-model`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground/90 underline-offset-2 hover:underline"
                        >
                            Storage model
                        </a>
                        .
                    </div>
                ) : null}
                <div className="mb-4 rounded-md border border-border p-3">
                    <Label className="text-xs">Custom flow variable</Label>
                    <div className="mt-2 flex items-center gap-2">
                        <Input
                            value={customVariableDraft}
                            onChange={(e) => onCustomVariableDraftChange(e.target.value)}
                            placeholder="e.g. customer.segment"
                        />
                        <Button type="button" variant="outline" onClick={onAddCustomVariable}>
                            Add
                        </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Enter a path without braces (e.g. <code className="text-[11px]">customer.segment</code>); it is stored as{" "}
                        <code className="text-[11px]">{"{{customer.segment}}"}</code> in pickers. Suggestions are saved in this browser only.
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Added variables appear in picker dropdowns for parameters, headers, body template, endpoint
                        URL, test JSON, and call context (Form and JSON tabs).
                    </p>
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                        <div className="grid gap-1">
                            <Label className="text-xs">Picker insert mode</Label>
                            <Select
                                value={variableInsertMode}
                                onValueChange={(value) =>
                                    setVariableInsertMode(value as "replace" | "append")
                                }
                            >
                                <SelectTrigger className="w-[170px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="replace">Replace field</SelectItem>
                                    <SelectItem value="append">Append to field</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="text-[11px] text-muted-foreground max-w-md pb-0.5">
                            JSON areas (test payload, call context, body template): Replace overwrites the whole field,
                            or only the highlighted range; Append inserts at the text cursor. Single-line fields (URL,
                            headers, parameter value template) use the same mode; place the caret before inserting.
                        </p>
                    </div>
                </div>
                <Tabs defaultValue="simple" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="simple">Simple</TabsTrigger>
                        <TabsTrigger value="advanced">Advanced Form</TabsTrigger>
                        <TabsTrigger value="raw">Raw Code</TabsTrigger>
                    </TabsList>

                    <TabsContent value="simple" className="space-y-4 mt-4">
                        <div className="grid gap-2">
                            <Label>Tool Name</Label>
                            <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g., Book Appointment" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>HTTP Method</Label>
                                <HttpMethodSelector value={httpMethod} onChange={onHttpMethodChange} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Timeout (ms)</Label>
                                <Input type="number" value={timeoutMs} onChange={(e) => onTimeoutMsChange(parseInt(e.target.value) || 5000)} min={1000} max={30000} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Endpoint URL</Label>
                            <Label className="text-xs text-muted-foreground font-normal">
                                Literal URL or templates such as{" "}
                                <code className="text-[11px]">https://api.example.com/orders/{"{{order_id}}"}</code>{" "}
                                (resolved at runtime like headers and body). Use the picker to insert at the caret;
                                same groups as below.
                            </Label>
                            <UrlInput
                                value={url}
                                onChange={onUrlChange}
                                placeholder="https://api.example.com/v1/orders/{{order_id}}"
                                showValidation
                                variableSuggestionGroups={variableSuggestionGroups}
                                variableSuggestions={variableSuggestions}
                                variableInsertMode={variableInsertMode}
                                selectPlaceholder="Insert variable in URL"
                            />
                        </div>
                        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/15 px-3 py-2">
                            <div className="grid gap-1">
                                <Label className="text-xs">Picker insert mode (this tab)</Label>
                                <Select
                                    value={variableInsertMode}
                                    onValueChange={(value) =>
                                        setVariableInsertMode(value as "replace" | "append")
                                    }
                                >
                                    <SelectTrigger className="w-[170px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="replace">Replace field</SelectItem>
                                        <SelectItem value="append">Append to field</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <p className="text-[11px] text-muted-foreground max-w-md pb-0.5">
                                Same setting as the Custom flow variable section at the top. Variable groups:{" "}
                                {HTTP_VARIABLE_GROUP_LABELS.system}, {HTTP_VARIABLE_GROUP_LABELS.conversation},{" "}
                                {HTTP_VARIABLE_GROUP_LABELS.custom}, and {HTTP_VARIABLE_GROUP_LABELS.live}.
                            </p>
                        </div>
                        <div className="grid gap-2 pt-2 border-t">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Label>Test payload (JSON object)</Label>
                                {onSeedTestPayloadFromParameters ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="w-fit"
                                        onClick={onSeedTestPayloadFromParameters}
                                    >
                                        Add missing parameter keys
                                    </Button>
                                ) : null}
                            </div>
                            <Label className="text-xs text-muted-foreground font-normal">
                                Use {"{{path}}"} in string values; pick variables below. Custom paths live in the Custom
                                flow variable section at the top of this card.{" "}
                                <span className="font-medium text-foreground/80">Add missing parameter keys</span> fills
                                top-level keys for each tool parameter name that is not yet in this JSON (from defaults
                                / value templates when set; otherwise empty string).
                            </Label>
                            <JsonTemplateTextarea
                                value={testPayload}
                                onChange={onTestPayloadChange}
                                variableInsertMode={variableInsertMode}
                                variableSuggestionGroups={variableSuggestionGroups}
                                variableSuggestions={variableSuggestions}
                                rows={4}
                                placeholder='{ "order_id": "123" }'
                                selectPlaceholder="Insert into test JSON"
                            />
                        </div>
                        <div className="grid gap-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                    <Label>Call / conversation context (test only)</Label>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button type="button" className="text-muted-foreground hover:text-foreground">
                                                <CircleHelp className="h-3.5 w-3.5" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent sideOffset={6}>
                                            Merged with test payload when resolving {"{{path}}"} templates — same shape
                                            as live call context.
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    <Button type="button" variant="outline" size="sm" onClick={onMergeCallContextDefaults}>
                                        Add missing sample values
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={onResetCallContextSample}>
                                        Reset sample context
                                    </Button>
                                </div>
                            </div>
                            <Label className="text-xs text-muted-foreground">
                                Edit sample values for system and conversation variables; saved in this browser only. On
                                the Form tab, choosing a preset path while the value is empty fills the app default
                                sample for that path when available (hover picker group headers for hints). The Add
                                missing sample values button copies in any standard paths you have not set yet; your
                                values are kept.{" "}
                                <a
                                    href={`${TOOL_DOCUMENTATION_URLS.http_api}#storage-model`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-foreground/90 underline-offset-2 hover:underline"
                                >
                                    Storage model (docs)
                                </a>
                            </Label>
                            <CallContextSampleEditor
                                value={callContextTestJson}
                                onChange={onCallContextTestJsonChange}
                                variableInsertMode={variableInsertMode}
                                variableSuggestionGroups={variableSuggestionGroups}
                                variableSuggestions={variableSuggestions}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="secondary" onClick={onTestCall} disabled={isTestingCall} className="w-fit">
                                <TestTube2 className="h-4 w-4 mr-1.5" />
                                {isTestingCall ? "Testing..." : "Test API Call"}
                            </Button>
                        </div>
                        <TemplatePreviewWarnings paths={templatePreviewWarnings} />
                        {testResult ? (
                            <pre className="rounded-md border border-border bg-muted/30 p-3 text-[11px] overflow-auto max-h-52 whitespace-pre-wrap break-all font-mono">{testResult}</pre>
                        ) : null}
                        <div className="grid gap-2 pt-4 border-t">
                            <Label>Quick Parameters (Simple mode)</Label>
                            <ParameterEditor
                                parameters={parameters}
                                onChange={onParametersChange}
                                variableSuggestions={variableSuggestions}
                                variableSuggestionGroups={variableSuggestionGroups}
                                variableInsertMode={variableInsertMode}
                            />
                        </div>
                        <div className="grid gap-2 pt-4 border-t">
                            <Label>Quick Headers (Simple mode)</Label>
                            <Label className="text-xs text-muted-foreground font-normal">
                                {"{{…}}"} in values resolves after merging body template defaults and parameters (same as URL and test call).
                            </Label>
                            <KeyValueEditor
                                items={headers}
                                onChange={onHeadersChange}
                                keyPlaceholder="Header name"
                                valuePlaceholder="Header value"
                                addButtonText="Add Header"
                                showDescription
                                descriptionPlaceholder="Optional header description"
                                variableSuggestions={variableSuggestions}
                                variableSuggestionGroups={variableSuggestionGroups}
                                variableInsertMode={variableInsertMode}
                            />
                        </div>
                        <div className="grid gap-2 pt-4 border-t">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Label>Quick Body Template (Simple mode)</Label>
                                {onSeedBodyTemplateFromParameters ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="w-fit"
                                        onClick={onSeedBodyTemplateFromParameters}
                                    >
                                        Add missing parameter keys
                                    </Button>
                                ) : null}
                            </div>
                            <Label className="text-xs text-muted-foreground font-normal">
                                Merges with runtime arguments for the request body.{" "}
                                <span className="font-medium text-foreground/80">Add missing parameter keys</span> adds
                                top-level keys from tool parameters (same rules as test payload).
                            </Label>
                            <JsonTemplateTextarea
                                value={bodyTemplate}
                                onChange={onBodyTemplateChange}
                                variableInsertMode={variableInsertMode}
                                variableSuggestionGroups={variableSuggestionGroups}
                                variableSuggestions={variableSuggestions}
                                rows={4}
                                placeholder={'{\n  "customer_id": "{{customer.id}}"\n}'}
                                selectPlaceholder="Insert variable in body template"
                            />
                        </div>
                        <div className="grid gap-2 pt-4 border-t">
                            <Label>Quick response mapping (Simple mode)</Label>
                            <Label className="text-xs text-muted-foreground font-normal">
                                Map names for workflow output from the HTTP response body (plain dot paths, not call-context{" "}
                                <code className="text-[11px]">{"{{…}}"}</code>).
                            </Label>
                            <KeyValueEditor
                                items={responseMappings}
                                onChange={onResponseMappingsChange}
                                keyPlaceholder="Output field"
                                valuePlaceholder="Response path (dot notation)"
                                addButtonText="Add Mapping"
                                variableSuggestionGroups={HTTP_RESPONSE_PATH_PRESET_GROUPS}
                                variableInsertMode={variableInsertMode}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" variant="outline" className="w-fit" onClick={onAutoMapResponse} disabled={!onAutoMapResponse}>
                                    <Sparkles className="h-4 w-4 mr-1.5" />
                                    Auto-map from latest response
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-fit"
                                    onClick={onApplyMappingsToParameters}
                                    disabled={!onApplyMappingsToParameters}
                                >
                                    Apply mapped fields to parameters
                                </Button>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="advanced" className="mt-4">
                        <Tabs defaultValue="settings" className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="settings">Settings</TabsTrigger>
                                <TabsTrigger value="auth">Authentication</TabsTrigger>
                                <TabsTrigger value="parameters">Parameters</TabsTrigger>
                                <TabsTrigger value="response">Response</TabsTrigger>
                            </TabsList>

                            <TabsContent value="settings" className="space-y-4 mt-4">
                                <div className="grid gap-2">
                                    <Label>Tool Name</Label>
                                    <Label className="text-xs text-muted-foreground">Use a descriptive name for the tool.</Label>
                                    <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g., Book Appointment" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Description</Label>
                                    <Label className="text-xs text-muted-foreground">Help the LLM understand what this tool does.</Label>
                                    <Textarea value={description} onChange={(e) => onDescriptionChange(e.target.value)} placeholder="What does this tool do?" rows={3} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>HTTP Method</Label>
                                        <HttpMethodSelector value={httpMethod} onChange={onHttpMethodChange} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Timeout (ms)</Label>
                                        <Input type="number" value={timeoutMs} onChange={(e) => onTimeoutMsChange(parseInt(e.target.value) || 5000)} min={1000} max={30000} />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Endpoint URL</Label>
                                    <Label className="text-xs text-muted-foreground font-normal">
                                        Templates in the path/query are resolved at runtime (same as test call). Picker
                                        inserts at the caret using the same variable groups as parameters and headers.
                                    </Label>
                                    <UrlInput
                                        value={url}
                                        onChange={onUrlChange}
                                        placeholder="https://api.example.com/v1/orders/{{order_id}}"
                                        showValidation
                                        variableSuggestionGroups={variableSuggestionGroups}
                                        variableSuggestions={variableSuggestions}
                                        variableInsertMode={variableInsertMode}
                                        selectPlaceholder="Insert variable in URL"
                                    />
                                </div>
                                <div className="grid gap-2 pt-4 border-t">
                                    <Label>Custom Message</Label>
                                    <Label className="text-xs text-muted-foreground">Optional message before this tool executes.</Label>
                                    <TextOrAudioInput
                                        type={customMessageType}
                                        onTypeChange={onCustomMessageTypeChange}
                                        recordingId={customMessageRecordingId}
                                        onRecordingIdChange={onCustomMessageRecordingIdChange}
                                        recordings={recordings}
                                    >
                                        <>
                                            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-700 border border-amber-200">
                                                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                                <span>This text is spoken as-is. For multilingual workflows, choose phrasing carefully.</span>
                                            </div>
                                            <Textarea value={customMessage} onChange={(e) => onCustomMessageChange(e.target.value)} rows={2} />
                                        </>
                                    </TextOrAudioInput>
                                </div>
                            </TabsContent>

                            <TabsContent value="auth" className="space-y-4 mt-4">
                                <CredentialSelector value={credentialUuid} onChange={onCredentialUuidChange} />
                            </TabsContent>

                            <TabsContent value="parameters" className="space-y-4 mt-4">
                                <div className="grid gap-2">
                                    <div className="flex items-center gap-1">
                                        <Label>Tool Parameters</Label>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button type="button" className="text-muted-foreground hover:text-foreground">
                                                    <CircleHelp className="h-3.5 w-3.5" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent sideOffset={6}>
                                                Parameter descriptions help the model call your API correctly.
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <Label className="text-xs text-muted-foreground">Define parameters the LLM sends with this tool call.</Label>
                                    <ParameterEditor
                                        parameters={parameters}
                                        onChange={onParametersChange}
                                        variableSuggestions={variableSuggestions}
                                        variableSuggestionGroups={variableSuggestionGroups}
                                        variableInsertMode={variableInsertMode}
                                    />
                                </div>
                                <div className="grid gap-2 pt-4 border-t">
                                    <div className="flex items-center gap-1">
                                        <Label>Custom Headers</Label>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button type="button" className="text-muted-foreground hover:text-foreground">
                                                    <CircleHelp className="h-3.5 w-3.5" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent sideOffset={6} className="max-w-xs">
                                                Header values support {"{{path}}"} placeholders. They resolve after
                                                body template defaults merge with tool arguments (same order as URL
                                                and runtime request).
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <KeyValueEditor
                                        items={headers}
                                        onChange={onHeadersChange}
                                        keyPlaceholder="Header name"
                                        valuePlaceholder="Header value"
                                        addButtonText="Add Header"
                                        showDescription
                                        descriptionPlaceholder="Optional header description for your team"
                                        variableSuggestions={variableSuggestions}
                                        variableSuggestionGroups={variableSuggestionGroups}
                                        variableInsertMode={variableInsertMode}
                                    />
                                </div>
                                <div className="grid gap-2 pt-4 border-t">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-1">
                                            <Label>Optional Body Template (JSON)</Label>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button type="button" className="text-muted-foreground hover:text-foreground">
                                                        <CircleHelp className="h-3.5 w-3.5" />
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent sideOffset={6}>
                                                    Body template defaults merge with runtime arguments for every method.
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                        {onSeedBodyTemplateFromParameters ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="w-fit"
                                                onClick={onSeedBodyTemplateFromParameters}
                                            >
                                                Add missing parameter keys
                                            </Button>
                                        ) : null}
                                    </div>
                                    <Label className="text-xs text-muted-foreground">
                                        Add JSON defaults and templates such as {"{{conversation.user.email}}"}.{" "}
                                        <span className="font-medium text-foreground/80">Add missing parameter keys</span>{" "}
                                        fills top-level parameter names not yet in this object.
                                    </Label>
                                    <JsonTemplateTextarea
                                        value={bodyTemplate}
                                        onChange={onBodyTemplateChange}
                                        variableInsertMode={variableInsertMode}
                                        variableSuggestionGroups={variableSuggestionGroups}
                                        variableSuggestions={variableSuggestions}
                                        rows={5}
                                        placeholder={'{\n  "customer_id": "{{customer.id}}",\n  "channel": "voice"\n}'}
                                        selectPlaceholder="Insert variable in body template"
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="response" className="space-y-4 mt-4">
                                <div className="grid gap-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <Label>Test API Call</Label>
                                        {onSeedTestPayloadFromParameters ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="w-fit"
                                                onClick={onSeedTestPayloadFromParameters}
                                            >
                                                Add missing parameter keys
                                            </Button>
                                        ) : null}
                                    </div>
                                    <Label className="text-xs text-muted-foreground font-normal">
                                        Test payload JSON — insert variables with the picker (cursor-aware).{" "}
                                        <span className="font-medium text-foreground/80">Add missing parameter keys</span>{" "}
                                        merges parameter names into the object without overwriting existing keys.
                                    </Label>
                                    <JsonTemplateTextarea
                                        value={testPayload}
                                        onChange={onTestPayloadChange}
                                        variableInsertMode={variableInsertMode}
                                        variableSuggestionGroups={variableSuggestionGroups}
                                        variableSuggestions={variableSuggestions}
                                        rows={6}
                                        placeholder='{ "order_id": "123" }'
                                        selectPlaceholder="Insert into test JSON"
                                    />
                                    <div className="grid gap-2">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-1">
                                                <Label>Call / conversation context (test only)</Label>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button type="button" className="text-muted-foreground hover:text-foreground">
                                                            <CircleHelp className="h-3.5 w-3.5" />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent sideOffset={6}>
                                                        Used to resolve {"{{path}}"} templates during the test request
                                                        (not saved on the tool).
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                <Button type="button" variant="outline" size="sm" onClick={onMergeCallContextDefaults}>
                                                    Add missing sample values
                                                </Button>
                                                <Button type="button" variant="outline" size="sm" onClick={onResetCallContextSample}>
                                                    Reset sample context
                                                </Button>
                                            </div>
                                        </div>
                                        <Label className="text-xs text-muted-foreground">
                                            On the Form tab, choosing a preset path while the value is empty fills the
                                            default sample when defined (hover group headers);{" "}
                                            <span className="font-medium text-foreground/80">Use app default</span> per
                                            row copies the built-in sample for that path. Add missing sample values
                                            copies standard system, conversation, and initial_context keys that are not
                                            present yet. Reset sample context replaces the entire sample. Values are not
                                            saved to the tool.{" "}
                                            <a
                                                href={`${TOOL_DOCUMENTATION_URLS.http_api}#storage-model`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-foreground/90 underline-offset-2 hover:underline"
                                            >
                                                Storage model (docs)
                                            </a>
                                        </Label>
                                        <CallContextSampleEditor
                                            value={callContextTestJson}
                                            onChange={onCallContextTestJsonChange}
                                            variableInsertMode={variableInsertMode}
                                            variableSuggestionGroups={variableSuggestionGroups}
                                            variableSuggestions={variableSuggestions}
                                        />
                                    </div>
                                    <Button type="button" variant="secondary" onClick={onTestCall} disabled={isTestingCall} className="w-fit">
                                        <TestTube2 className="h-4 w-4 mr-1.5" />
                                        {isTestingCall ? "Testing..." : "Test API Call"}
                                    </Button>
                                    <TemplatePreviewWarnings paths={templatePreviewWarnings} />
                                    {testResult ? (
                                        <pre className="rounded-md border border-border bg-muted/30 p-3 text-[11px] overflow-auto max-h-52 whitespace-pre-wrap break-all font-mono">{testResult}</pre>
                                    ) : null}
                                </div>
                                <div className="grid gap-2 pt-4 border-t">
                                    <Label>Response Mapping</Label>
                                    <Label className="text-xs text-muted-foreground font-normal">
                                        Use plain dot paths into the HTTP response body (e.g.{" "}
                                        <code className="text-[11px]">data.id</code>). The per-row insert list is for
                                        typical JSON shapes, not the{" "}
                                        <code className="text-[11px]">{"{{…}}"}</code> call-context variables used
                                        for URL, headers, body, and test payload.
                                    </Label>
                                    <KeyValueEditor
                                        items={responseMappings}
                                        onChange={onResponseMappingsChange}
                                        keyPlaceholder="Output field"
                                        valuePlaceholder="Response path (dot notation)"
                                        addButtonText="Add Mapping"
                                        variableSuggestionGroups={HTTP_RESPONSE_PATH_PRESET_GROUPS}
                                        variableInsertMode={variableInsertMode}
                                    />
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button type="button" variant="outline" className="w-fit" onClick={onAutoMapResponse} disabled={!onAutoMapResponse}>
                                            <Sparkles className="h-4 w-4 mr-1.5" />
                                            Auto-map from latest response
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-fit"
                                            onClick={onApplyMappingsToParameters}
                                            disabled={!onApplyMappingsToParameters}
                                        >
                                            Apply mapped fields to parameters
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </TabsContent>

                    <TabsContent value="raw" className="space-y-4 mt-4">
                        <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1.5">
                            <p>
                                Form and Test API Call resolve {"{{path}}"} the same as production (tool arguments
                                + call / conversation context). Switch to Simple or Advanced to use grouped pickers
                                (system, conversation, custom, tool keys), then return here if you edit raw code. In
                                raw code you build the request yourself; use the same path strings the pickers insert,
                                and see{" "}
                                <a
                                    href={CONTEXT_VARIABLES_DOC_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-foreground/90 hover:underline"
                                >
                                    Context variables <ExternalLink className="h-3 w-3" />
                                </a>{" "}
                                for the full list.
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label>Language</Label>
                            <Select value={rawLanguage} onValueChange={(v) => onRawLanguageChange(v as "python" | "bash")}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="python">Python (default)</SelectItem>
                                    <SelectItem value="bash">Bash / cURL</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>Raw Code</Label>
                                <Button type="button" variant="outline" size="sm" onClick={onRegenerateRawCode}>
                                    Regenerate from form
                                </Button>
                            </div>
                            <Textarea value={rawCode} onChange={(e) => onRawCodeChange(e.target.value)} rows={16} className="font-mono text-xs" spellCheck={false} />
                            <p className="text-xs text-muted-foreground">Raw code starts from current form values and is editable. Python is first-class by default.</p>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
