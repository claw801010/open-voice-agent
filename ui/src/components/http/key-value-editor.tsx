"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { VariableSuggestionGroup } from "@/constants/contextVariableTemplates";

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
                        <Input
                            placeholder={valuePlaceholder}
                            value={item.value}
                            onChange={(e) => updateItem(index, "value", e.target.value)}
                            className="flex-1"
                            disabled={disabled}
                        />
                        {variableSuggestions.length > 0 ||
                        variableSuggestionGroups.length > 0 ? (
                            <Select
                                value=""
                                onValueChange={(value) =>
                                    updateItem(
                                        index,
                                        "value",
                                        variableInsertMode === "append" && (item.value || "").trim()
                                            ? `${item.value} ${value}`
                                            : value
                                    )
                                }
                                disabled={disabled}
                            >
                                <SelectTrigger
                                    className="w-[190px]"
                                    aria-label="Insert system, conversation, custom, or tool variable into value"
                                >
                                    <SelectValue placeholder="Insert var" />
                                </SelectTrigger>
                                <SelectContent className="max-h-72 overflow-y-auto">
                                    {variableSuggestionGroups.length > 0
                                        ? variableSuggestionGroups.map((group) => (
                                              <SelectGroup key={group.label}>
                                                  <SelectLabel>{group.label}</SelectLabel>
                                                  {group.options.map((template) => (
                                                      <SelectItem key={template} value={template}>
                                                          {template}
                                                      </SelectItem>
                                                  ))}
                                              </SelectGroup>
                                          ))
                                        : variableSuggestions.map((template) => (
                                              <SelectItem key={template} value={template}>
                                                  {template}
                                              </SelectItem>
                                          ))}
                                </SelectContent>
                            </Select>
                        ) : null}
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
