"use client";

import { useLayoutEffect, useRef } from "react";

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { VariableSuggestionGroup } from "@/constants/contextVariableTemplates";

function captureTextareaSelection(el: HTMLTextAreaElement | null) {
    if (!el) return { start: 0, end: 0 };
    return { start: el.selectionStart, end: el.selectionEnd };
}

export interface JsonTemplateTextareaProps {
    value: string;
    onChange: (v: string) => void;
    variableInsertMode: "replace" | "append";
    variableSuggestionGroups: VariableSuggestionGroup[];
    variableSuggestions: string[];
    rows?: number;
    placeholder?: string;
    selectPlaceholder?: string;
}

/** JSON-ish textarea with grouped variable insert at cursor / selection (survives Select focus loss). */
export function JsonTemplateTextarea({
    value,
    onChange,
    variableInsertMode,
    variableSuggestionGroups,
    variableSuggestions,
    rows = 5,
    placeholder,
    selectPlaceholder = "Insert variable template",
}: JsonTemplateTextareaProps) {
    const taRef = useRef<HTMLTextAreaElement>(null);
    const savedSel = useRef({ start: 0, end: 0 });
    const pendingCaret = useRef<number | null>(null);

    const syncSelection = () => {
        savedSel.current = captureTextareaSelection(taRef.current);
    };

    useLayoutEffect(() => {
        const el = taRef.current;
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
        <div className="grid gap-2">
            <Textarea
                ref={taRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onSelect={syncSelection}
                onBlur={syncSelection}
                onKeyUp={syncSelection}
                onMouseUp={syncSelection}
                rows={rows}
                className="font-mono text-xs"
                placeholder={placeholder}
            />
            {variableSuggestionGroups.length > 0 || variableSuggestions.length > 0 ? (
                <Select value="" onValueChange={applyVariable}>
                    <SelectTrigger
                        className="w-[260px]"
                        onPointerDownCapture={syncSelection}
                    >
                        <SelectValue placeholder={selectPlaceholder} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                        {variableSuggestionGroups.length > 0
                            ? variableSuggestionGroups.map((group) => (
                                  <SelectGroup key={`json-var-${group.label}`}>
                                      <SelectLabel>{group.label}</SelectLabel>
                                      {group.options.map((template) => (
                                          <SelectItem
                                              key={`json-var-${group.label}-${template}`}
                                              value={template}
                                          >
                                              {template}
                                          </SelectItem>
                                      ))}
                                  </SelectGroup>
                              ))
                            : variableSuggestions.map((template) => (
                                  <SelectItem key={`json-var-${template}`} value={template}>
                                      {template}
                                  </SelectItem>
                              ))}
                    </SelectContent>
                </Select>
            ) : null}
        </div>
    );
}
