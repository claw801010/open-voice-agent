"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { GroupedStringOptionPicker } from "@/components/http/grouped-string-option-picker";
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
    pathValueMapFromSampleJson,
    safeParseCallContextObject,
    stringifyCallContextObject,
    unflattenCallContextRows,
    withRowIds,
} from "@/lib/callContextSampleForm";

import { JsonTemplateTextarea } from "./jsonTemplateTextarea";

const TAB_STORAGE_KEY = "tool-http-call-context-editor-tab";

function captureInputSelection(el: HTMLInputElement | null) {
    if (!el) return { start: 0, end: 0 };
    return { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
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
    const inputRef = useRef<HTMLInputElement>(null);
    const savedSel = useRef({ start: 0, end: 0 });
    const pendingCaret = useRef<number | null>(null);

    const syncSelection = () => {
        savedSel.current = captureInputSelection(inputRef.current);
    };

    useLayoutEffect(() => {
        const el = inputRef.current;
        if (el == null || pendingCaret.current == null) return;
        const pos = pendingCaret.current;
        pendingCaret.current = null;
        el.focus();
        el.setSelectionRange(pos, pos);
    }, [value]);

    const applyVariable = (snippet: string) => {
        const { start, end } = savedSel.current;
        const trimmed = value.trim();

        if (variableInsertMode === "replace") {
            if (start !== end) {
                const next = value.slice(0, start) + snippet + value.slice(end);
                pendingCaret.current = start + snippet.length;
                onChange(next);
                return;
            }
            pendingCaret.current = snippet.length;
            onChange(snippet);
            return;
        }

        if (!trimmed) {
            pendingCaret.current = snippet.length;
            onChange(snippet);
            return;
        }
        const insertAt = end;
        const next = value.slice(0, insertAt) + snippet + value.slice(insertAt);
        pendingCaret.current = insertAt + snippet.length;
        onChange(next);
    };

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
}

export function CallContextSampleEditor({
    value,
    onChange,
    variableInsertMode,
    variableSuggestionGroups,
    variableSuggestions,
    pathPresetGroups = CALL_CONTEXT_PATH_PRESET_GROUPS,
}: CallContextSampleEditorProps) {
    const [tab, setTab] = useState<"form" | "json">("form");
    const [rows, setRows] = useState<CallContextFormRow[]>(() => rowsFromJsonString(value));
    const lastEmitted = useRef<string | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const s = window.localStorage.getItem(TAB_STORAGE_KEY);
        if (s === "json" || s === "form") setTab(s);
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(TAB_STORAGE_KEY, tab);
    }, [tab]);

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

    const addMissingPresetRows = useCallback(() => {
        const paths = collectPresetDotPaths(pathPresetGroupsMerged);
        const defaultMap = pathValueMapFromSampleJson(DEFAULT_CALL_CONTEXT_TEST_JSON);
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
    }, [pathPresetGroupsMerged, commitRows]);

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
                    card so they appear here and in other pickers). Add rows for anything else; JSON tab stays in
                    sync.
                </p>
                {duplicatePaths.length > 0 ? (
                    <p className="text-[11px] text-amber-800">
                        Duplicate path{duplicatePaths.length > 1 ? "s" : ""}: {duplicatePaths.join(", ")} — last row wins
                        when building JSON.
                    </p>
                ) : null}
                <div className="space-y-3">
                    {rows.map((row) => (
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
                                            onPick={(path) => updateRow(row.id, { path })}
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
                        </div>
                    ))}
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
            <TabsContent value="json" className="mt-3">
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
