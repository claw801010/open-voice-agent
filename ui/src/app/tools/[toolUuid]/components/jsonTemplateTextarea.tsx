"use client";

import { GroupedStringOptionPicker } from "@/components/http/grouped-string-option-picker";
import { useTemplateSnippetInsert } from "@/components/http/templateSnippetInsert";
import { Textarea } from "@/components/ui/textarea";
import type { VariableSuggestionGroup } from "@/constants/contextVariableTemplates";

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

/** JSON-ish textarea with grouped variable insert at cursor / selection (popover preserves saved caret). */
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
    const { elRef: taRef, syncSelection, applySnippet: applyVariable } = useTemplateSnippetInsert<
        HTMLTextAreaElement
    >({
        value,
        onChange,
        variableInsertMode,
    });

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
                <GroupedStringOptionPicker
                    variableSuggestionGroups={variableSuggestionGroups}
                    variableSuggestions={variableSuggestions}
                    triggerClassName="w-[260px]"
                    placeholder={selectPlaceholder}
                    ariaLabel="Insert system, conversation, custom, or tool variable template"
                    onTriggerPointerDown={syncSelection}
                    onPick={applyVariable}
                />
            ) : null}
        </div>
    );
}
