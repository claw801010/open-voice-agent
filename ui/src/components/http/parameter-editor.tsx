"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

import { useTemplateSnippetInsert } from "@/components/http/templateSnippetInsert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { VariableSuggestionGroup } from "@/constants/contextVariableTemplates";

import { GroupedStringOptionPicker } from "./grouped-string-option-picker";

function ParameterValueTemplateInput({
    value,
    onChange,
    disabled,
    variableSuggestionGroups,
    variableSuggestions,
    variableInsertMode,
}: {
    value: string;
    onChange: (v: string) => void;
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
        <div className="flex gap-2">
            <Input
                ref={elRef}
                placeholder='e.g., {{customer.id}}'
                value={value}
                onChange={(e) => onChange(e.target.value)}
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
                    triggerClassName="w-[220px] shrink-0"
                    placeholder="Insert variable"
                    ariaLabel="Insert system, conversation, custom, or tool variable for value template"
                    onTriggerPointerDown={syncSelection}
                    onPick={applySnippet}
                />
            ) : null}
        </div>
    );
}

export type ParameterType = "string" | "number" | "boolean";

export interface ToolParameter {
    name: string;
    type: ParameterType;
    description: string;
    required: boolean;
    valueTemplate?: string;
}

interface ParameterEditorProps {
    parameters: ToolParameter[];
    onChange: (parameters: ToolParameter[]) => void;
    disabled?: boolean;
    variableSuggestions?: string[];
    variableInsertMode?: "replace" | "append";
    variableSuggestionGroups?: VariableSuggestionGroup[];
}

export function ParameterEditor({
    parameters,
    onChange,
    disabled = false,
    variableSuggestions = [],
    variableInsertMode = "replace",
    variableSuggestionGroups = [],
}: ParameterEditorProps) {
    const addParameter = () => {
        onChange([
            ...parameters,
            { name: "", type: "string", description: "", required: true, valueTemplate: "" },
        ]);
    };

    const updateParameter = (
        index: number,
        field: keyof ToolParameter,
        value: string | boolean
    ) => {
        const newParams = [...parameters];
        newParams[index] = { ...newParams[index], [field]: value };
        onChange(newParams);
    };

    const removeParameter = (index: number) => {
        onChange(parameters.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4">
            {parameters.length === 0 && (
                <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
                    No parameters defined. Add a parameter to specify what data this tool needs.
                </div>
            )}

            {parameters.map((param, index) => (
                <div
                    key={index}
                    className="border rounded-lg p-4 space-y-3 bg-muted/20"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                            Parameter {index + 1}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeParameter(index)}
                            disabled={disabled}
                            className="h-8 w-8"
                        >
                            <Trash2Icon className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Name</Label>
                            <Label className="text-xs text-muted-foreground">
                                Name of the parameter, like &quot;order_id&quot; or &quot;customer_name&quot;
                            </Label>
                            <Input
                                placeholder="e.g., customer_name"
                                value={param.name}
                                onChange={(e) =>
                                    updateParameter(index, "name", e.target.value)
                                }
                                disabled={disabled}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Type</Label>
                            <Label className="text-xs text-muted-foreground">
                                Type of the parameter, like &quot;string&quot; or &quot;number&quot; or &quot;boolean&quot;
                            </Label>
                            <Select
                                value={param.type}
                                onValueChange={(value: ParameterType) =>
                                    updateParameter(index, "type", value)
                                }
                                disabled={disabled}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="string">String</SelectItem>
                                    <SelectItem value="number">Number</SelectItem>
                                    <SelectItem value="boolean">Boolean</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">Description</Label>
                        <Label className="text-xs text-muted-foreground">
                            Description of the parameter, which makes it easy for LLM to understand, like &quot;The ID of the Customer to fetch Order Details&quot;
                        </Label>
                        <Input
                            placeholder="Describe what this parameter is for..."
                            value={param.description}
                            onChange={(e) =>
                                updateParameter(index, "description", e.target.value)
                            }
                            disabled={disabled}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">Value Template (optional)</Label>
                        <Label className="text-xs text-muted-foreground">
                            Use conversation variables like {"{{customer.name}}"} as fallback when LLM omits this parameter.
                        </Label>
                        <ParameterValueTemplateInput
                            value={param.valueTemplate || ""}
                            onChange={(v) => updateParameter(index, "valueTemplate", v)}
                            disabled={disabled}
                            variableSuggestionGroups={variableSuggestionGroups}
                            variableSuggestions={variableSuggestions}
                            variableInsertMode={variableInsertMode}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch
                            id={`required-${index}`}
                            checked={param.required}
                            onCheckedChange={(checked) =>
                                updateParameter(index, "required", checked)
                            }
                            disabled={disabled}
                        />
                        <Label htmlFor={`required-${index}`} className="text-sm">
                            Required
                        </Label>
                    </div>
                </div>
            ))}

            <Button
                variant="outline"
                size="sm"
                onClick={addParameter}
                className="w-fit"
                disabled={disabled}
            >
                <PlusIcon className="h-4 w-4 mr-1" /> Add Parameter
            </Button>
        </div>
    );
}
