"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

import { useTemplateSnippetInsert } from "@/components/http/templateSnippetInsert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VariableSuggestionGroup } from "@/constants/contextVariableTemplates";

import { GroupedStringOptionPicker } from "./grouped-string-option-picker";

function KeyValueValueWithPicker({
    value,
    onChange,
    valuePlaceholder,
    disabled,
    variableSuggestionGroups,
    variableSuggestions,
    variableInsertMode,
}: {
    value: string;
    onChange: (v: string) => void;
    valuePlaceholder: string;
    disabled: boolean;
    variableSuggestionGroups: VariableSuggestionGroup[];
    variableSuggestions: string[];
    variableInsertMode: "replace" | "append";
}) {
    const { elRef, syncSelection, applySnippet } = useTemplateSnippetInsert<HTMLInputElement>({
        value,
        onChange,
        variableInsertMode,
    });

    return (
        <>
            <Input
                ref={elRef}
                placeholder={valuePlaceholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1"
                disabled={disabled}
                onSelect={syncSelection}
                onBlur={syncSelection}
                onKeyUp={syncSelection}
                onMouseUp={syncSelection}
            />
            {variableSuggestions.length > 0 || variableSuggestionGroups.length > 0 ? (
                <GroupedStringOptionPicker
                    variableSuggestionGroups={variableSuggestionGroups}
                    variableSuggestions={variableSuggestions}
                    disabled={disabled}
                    triggerClassName="w-[190px] shrink-0"
                    placeholder="Insert var"
                    ariaLabel="Insert system, conversation, custom, or tool variable into value"
                    onTriggerPointerDown={syncSelection}
                    onPick={applySnippet}
                />
            ) : null}
        </>
    );
}

export interface KeyValueItem {
    key: string;
    value: string;
    description?: string;
}

interface KeyValueEditorProps {
    items: KeyValueItem[];
    onChange: (items: KeyValueItem[]) => void;
    keyPlaceholder?: string;
    valuePlaceholder?: string;
    addButtonText?: string;
    emptyMessage?: string;
    disabled?: boolean;
    showDescription?: boolean;
    descriptionPlaceholder?: string;
    variableSuggestions?: string[];
    variableInsertMode?: "replace" | "append";
    variableSuggestionGroups?: VariableSuggestionGroup[];
}

export function KeyValueEditor({
    items,
    onChange,
    keyPlaceholder = "Key",
    valuePlaceholder = "Value",
    addButtonText = "Add",
    disabled = false,
    showDescription = false,
    descriptionPlaceholder = "Optional description",
    variableSuggestions = [],
    variableInsertMode = "replace",
    variableSuggestionGroups = [],
}: KeyValueEditorProps) {
    const addItem = () => {
        onChange([...items, { key: "", value: "", description: "" }]);
    };

    const updateItem = (
        index: number,
        field: "key" | "value" | "description",
        value: string
    ) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        onChange(newItems);
    };

    const removeItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            {items.map((item, index) => (
                <div key={index} className="space-y-2 rounded-md border border-border p-2">
                    <div className="flex items-center gap-2">
                        <Input
                            placeholder={keyPlaceholder}
                            value={item.key}
                            onChange={(e) => updateItem(index, "key", e.target.value)}
                            className="flex-1"
                            disabled={disabled}
                        />
                        <KeyValueValueWithPicker
                            value={item.value}
                            onChange={(v) => updateItem(index, "value", v)}
                            valuePlaceholder={valuePlaceholder}
                            disabled={disabled}
                            variableSuggestionGroups={variableSuggestionGroups}
                            variableSuggestions={variableSuggestions}
                            variableInsertMode={variableInsertMode}
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => removeItem(index)}
                            disabled={disabled}
                        >
                            <Trash2Icon className="h-4 w-4" />
                        </Button>
                    </div>
                    {showDescription && (
                        <Input
                            placeholder={descriptionPlaceholder}
                            value={item.description || ""}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                            disabled={disabled}
                        />
                    )}
                </div>
            ))}

            <Button
                variant="outline"
                size="sm"
                onClick={addItem}
                className="w-fit"
                disabled={disabled}
            >
                <PlusIcon className="h-4 w-4 mr-1" /> {addButtonText}
            </Button>
        </div>
    );
}
