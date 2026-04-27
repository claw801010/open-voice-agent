"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GroupedStringOptionPicker } from "@/components/http/grouped-string-option-picker";
import { useTemplateSnippetInsert } from "@/components/http/templateSnippetInsert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    CALL_CONTEXT_PATH_PRESET_GROUPS,
    DEFAULT_CALL_CONTEXT_TEST_JSON,
    mergePathPresetGroupsWithFlowTemplates,
    type VariableSuggestionGroup,
} from "@/constants/contextVariableTemplates";
import {
    type CallContextFormRow,
    collectPresetDotPaths,
    flattenCallContextSample,
    mergeCallContextJsonWithDefaults,
    mergePresetPathPick,
    pathValueMapFromSampleJson,
    safeParseCallContextObject,
    stringifyCallContextObject,
    unflattenCallContextRows,
    withRowIds,
} from "@/lib/callContextSampleForm";

import { JsonTemplateTextarea } from "./jsonTemplateTextarea";

const TAB_STORAGE_KEY_BASE = "tool-http-call-context-editor-tab";

function tabStorageKey(scopeId?: string): string {
    return scopeId ? `${TAB_STORAGE_KEY_BASE}:${scopeId}` : TAB_STORAGE_KEY_BASE;
}

function InputTemplateVariable({
    value,
    onChange,
    variableInsertMode,
    variableSuggestionGroups,
    variableSuggestions,
    placeholder,
    selectPlaceholder,
}: {
    value: string;
    onChange: (v: string) => void;
    variableInsertMode: "replace" | "append";
    variableSuggestionGroups: VariableSuggestionGroup[];
    variableSuggestions: string[];
    placeholder?: string;
    selectPlaceholder?: string;
}) {
    const { elRef: inputRef, syncSelection, applySnippet: applyVariable } = useTemplateSnippetInsert<
        HTMLInputElement
    >({
        value,
        onChange,
        variableInsertMode,
    });

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Input
                ref={inputRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onSelect={syncSelection}
                onBlur={syncSelection}
                onKeyUp={syncSelection}
                onMouseUp={syncSelection}
                placeholder={placeholder}
                className="min-w-[100px] flex-1 font-mono text-xs"
            />
            {variableSuggestionGroups.length > 0 || variableSuggestions.length > 0 ? (
                <GroupedStringOptionPicker
                    variableSuggestionGroups={variableSuggestionGroups}
                    variableSuggestions={variableSuggestions}
                    triggerClassName="w-[200px] shrink-0"
                    placeholder={selectPlaceholder ?? "Insert variable"}
                    ariaLabel="Insert call context or tool variable into sample value"
                    onTriggerPointerDown={syncSelection}
                    onPick={applyVariable}
                />
            ) : null}
        </div>
    );
}

function rowsFromJsonString(json: string): CallContextFormRow[] {
    const obj = safeParseCallContextObject(json);
    return withRowIds(flattenCallContextSample(obj));
}

export interface CallContextSampleEditorProps {
    value: string;
    onChange: (v: string) => void;
    variableInsertMode: "replace" | "append";
    variableSuggestionGroups: VariableSuggestionGroup[];
    variableSuggestions: string[];
    /** Optional override; defaults to app system + conversation + initial_context presets. */
    pathPresetGroups?: VariableSuggestionGroup[];
    /** When set (e.g. tool UUID), Form|JSON tab choice is remembered per tool in localStorage. */
    storageScopeId?: string;
}

export function CallContextSampleEditor({
    value,
    onChange,
    variableInsertMode,
    variableSuggestionGroups,
    variableSuggestions,
    pathPresetGroups = CALL_CONTEXT_PATH_PRESET_GROUPS,
    storageScopeId,
}: CallContextSampleEditorProps) {
    const [tab, setTab] = useState<"form" | "json">("form");
    const [rows, setRows] = useState<CallContextFormRow[]>(() => rowsFromJsonString(value));
    const lastEmitted = useRef<string | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const key = tabStorageKey(storageScopeId);
        const s = window.localStorage.getItem(key);
        if (s === "json" || s === "form") setTab(s);
    }, [storageScopeId]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(tabStorageKey(storageScopeId), tab);
    }, [tab, storageScopeId]);

    useEffect(() => {
        if (value === lastEmitted.current) return;
        lastEmitted.current = value;
        setRows(rowsFromJsonString(value));
    }, [value]);

    const commitRows = useCallback((nextRows: CallContextFormRow[]) => {
        const obj = unflattenCallContextRows(nextRows);
        const json = stringifyCallContextObject(obj);
        lastEmitted.current = json;
        onChange(json);
        return nextRows;
    }, [onChange]);

    const updateRow = useCallback(
        (id: string, patch: Partial<Pick<CallContextFormRow, "path" | "value">>) => {
            setRows((prev) => commitRows(prev.map((r) => (r.id === id ? { ...r, ...patch } : r))));
        },
        [commitRows]
    );

    const addRow = useCallback(() => {
        setRows((prev) =>
            commitRows([
                ...prev,
                {
                    id:
                        typeof crypto !== "undefined" && "randomUUID" in crypto
                            ? crypto.randomUUID()
                            : `new-${prev.length}`,
                    path: "",
                    value: "",
                },
            ])
        );
    }, [commitRows]);

    const removeRow = useCallback(
        (id: string) => {
            setRows((prev) => commitRows(prev.filter((r) => r.id !== id)));
        },
        [commitRows]
    );

    const duplicatePaths = useMemo(() => {
        const counts = new Map<string, number>();
        for (const r of rows) {
            const p = r.path.trim();
            if (!p) continue;
            counts.set(p, (counts.get(p) ?? 0) + 1);
        }
        return [...counts.entries()].filter(([, n]) => n > 1).map(([p]) => p);
    }, [rows]);

    const pathPresetGroupsMerged = useMemo(
        () => mergePathPresetGroupsWithFlowTemplates(pathPresetGroups, variableSuggestions),
        [pathPresetGroups, variableSuggestions]
    );

    const defaultSamplePathValues = useMemo(
        () => pathValueMapFromSampleJson(DEFAULT_CALL_CONTEXT_TEST_JSON),
        []
    );

    const addMissingPresetRows = useCallback(() => {
        const paths = collectPresetDotPaths(pathPresetGroupsMerged);
        const defaultMap = defaultSamplePathValues;
        setRows((prev) => {
            const existing = new Set(prev.map((r) => r.path.trim()).filter(Boolean));
            const additions: CallContextFormRow[] = [];
            for (const path of paths) {
                if (existing.has(path)) continue;
                existing.add(path);
                additions.push({
                    id:
                        typeof crypto !== "undefined" && "randomUUID" in crypto
                            ? crypto.randomUUID()
                            : `preset-${path}-${Math.random().toString(36).slice(2)}`,
                    path,
                    value: defaultMap.get(path) ?? "",
                });
            }
            if (additions.length === 0) return prev;
            return commitRows([...prev, ...additions]);
        });
    }, [pathPresetGroupsMerged, commitRows, defaultSamplePathValues]);

    return (
        <Tabs value={tab} onValueChange={(v) => setTab(v as "form" | "json")} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="form">Form (paths & values)</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="form" className="mt-3 space-y-3">
                <p className="text-[11px] text-muted-foreground">
                    Edit sample values per dot path (matches {"{{path}}"} in your HTTP templates). Preset path
                    includes system and conversation keys plus any paths from your custom variables and tool
                    parameters (add custom {"{{…}}"} keys in the Custom flow variable field at the top of this
                    card so they appear here and in other pickers). Choosing a preset while the value is empty fills
                    the app default sample for that path when available (hover group headers for hints).{" "}
                    <span className="font-medium text-foreground/80">Use app default</span> on a row copies that
                    sample into the value field when the path exists in the built-in sample. Add rows for anything
                    else; JSON tab stays in sync.
                </p>
                {duplicatePaths.length > 0 ? (
                    <p className="text-[11px] text-amber-800">
                        Duplicate path{duplicatePaths.length > 1 ? "s" : ""}: {duplicatePaths.join(", ")} — last row wins
                        when building JSON.
                    </p>
                ) : null}
                <div className="space-y-3">
                    {rows.map((row) => {
                        const pathTrim = row.path.trim();
                        const hasAppDefault = pathTrim.length > 0 && defaultSamplePathValues.has(pathTrim);
                        return (
                        <div
                            key={row.id}
                            className="rounded-md border border-border p-2 space-y-2 bg-muted/20"
                        >
                            <div className="flex flex-wrap items-start gap-2">
                                <div className="grid min-w-0 flex-1 gap-1">
                                    <Label className="text-[11px] text-muted-foreground">Path</Label>
                                    <div className="flex flex-wrap gap-2">
                                        <Input
                                            value={row.path}
                                            onChange={(e) => updateRow(row.id, { path: e.target.value })}
                                            placeholder="e.g. conversation.intent"
                                            className="min-w-[120px] flex-1 font-mono text-xs"
                                        />
                                        <GroupedStringOptionPicker
                                            variableSuggestionGroups={pathPresetGroupsMerged}
                                            variableSuggestions={[]}
                                            triggerClassName="w-[210px] shrink-0"
                                            placeholder="Preset path"
                                            ariaLabel="Choose a preset dot path (system, conversation, initial context, flow, or custom)"
                                            onPick={(path) => {
                                                const patch = mergePresetPathPick(
                                                    path,
                                                    row.value,
                                                    defaultSamplePathValues
                                                );
                                                updateRow(row.id, patch);
                                            }}
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeRow(row.id)}
                                    aria-label="Remove row"
                                >
                                    <Trash2Icon className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-[11px] text-muted-foreground">Value</Label>
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="min-w-0 flex-1">
                                        <InputTemplateVariable
                                            value={row.value}
                                            onChange={(v) => updateRow(row.id, { value: v })}
                                            variableInsertMode={variableInsertMode}
                                            variableSuggestionGroups={variableSuggestionGroups}
                                            variableSuggestions={variableSuggestions}
                                            placeholder='Literal, JSON, or {{template}}'
                                            selectPlaceholder="Insert into value"
                                        />
                                    </div>
                                    {hasAppDefault ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 shrink-0 text-[11px]"
                                            onClick={() =>
                                                updateRow(row.id, {
                                                    value: defaultSamplePathValues.get(pathTrim) ?? "",
                                                })
                                            }
                                        >
                                            Use app default
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        );
                    })}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={addMissingPresetRows} className="w-fit">
                        Add missing preset rows
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-fit">
                        <PlusIcon className="h-4 w-4 mr-1" />
                        Add path
                    </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                    Add missing preset rows appends one row per path from the Preset path lists (system,
                    conversation, initial context, and From your flow) that is not already in the form. Values are
                    filled from the app default sample when that path exists there (same source as Add missing sample
                    values on the tool card).
                </p>
            </TabsContent>
            <TabsContent value="json" className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit"
                        onClick={() =>
                            onChange(mergeCallContextJsonWithDefaults(value, DEFAULT_CALL_CONTEXT_TEST_JSON))
                        }
                    >
                        Add missing sample keys (JSON)
                    </Button>
                    <p className="text-[11px] text-muted-foreground max-w-xl">
                        Same merge as <span className="font-medium text-foreground/80">Add missing sample values</span>{" "}
                        on the tool card: fills standard system, conversation, and initial_context keys you have not set
                        yet; keeps your existing JSON. Then use the picker below to insert {"{{…}}"} templates.
                    </p>
                </div>
                <JsonTemplateTextarea
                    value={value}
                    onChange={onChange}
                    variableInsertMode={variableInsertMode}
                    variableSuggestionGroups={variableSuggestionGroups}
                    variableSuggestions={variableSuggestions}
                    rows={5}
                    placeholder='{ "conversation": { "intent": "support" } }'
                    selectPlaceholder="Insert variable into context JSON"
                />
            </TabsContent>
        </Tabs>
    );
}
