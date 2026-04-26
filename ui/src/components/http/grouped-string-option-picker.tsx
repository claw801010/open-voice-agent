"use client";

import { ChevronsUpDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    GROUPED_PICKER_BUILTIN_HEADER_TOOLTIPS,
    type VariableSuggestionGroup,
} from "@/constants/contextVariableTemplates";
import { cn } from "@/lib/utils";

/** Filter grouped or flat string lists for the HTTP tool variable / path pickers (case-insensitive substring). */
export function filterGroupedStringOptions(
    groups: readonly VariableSuggestionGroup[],
    flatFallback: readonly string[],
    query: string
): VariableSuggestionGroup[] {
    const needle = query.trim().toLowerCase();
    if (groups.length > 0) {
        return groups
            .map((g) => ({
                label: g.label,
                options: needle ? g.options.filter((o) => o.toLowerCase().includes(needle)) : [...g.options],
            }))
            .filter((g) => g.options.length > 0);
    }
    const opts = needle ? flatFallback.filter((o) => o.toLowerCase().includes(needle)) : [...flatFallback];
    if (opts.length === 0) return [];
    return [{ label: "", options: opts }];
}

export interface GroupedStringOptionPickerProps {
    variableSuggestionGroups: VariableSuggestionGroup[];
    variableSuggestions: string[];
    onPick: (value: string) => void;
    disabled?: boolean;
    triggerClassName?: string;
    placeholder: string;
    ariaLabel: string;
    /** Run before the popover opens (e.g. capture input/textarea selection for caret insert). */
    onTriggerPointerDown?: () => void;
    align?: "start" | "center" | "end";
    searchPlaceholder?: string;
    /** Optional `title` on group headers; defaults merge with built-in tooltips for known labels. */
    groupHeaderTooltips?: Record<string, string>;
}

export function GroupedStringOptionPicker({
    variableSuggestionGroups,
    variableSuggestions,
    onPick,
    disabled = false,
    triggerClassName,
    placeholder,
    ariaLabel,
    onTriggerPointerDown,
    align = "start",
    searchPlaceholder = "Filter…",
    groupHeaderTooltips,
}: GroupedStringOptionPickerProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);

    const hasAny =
        variableSuggestionGroups.some((g) => g.options.length > 0) || variableSuggestions.length > 0;

    const filtered = useMemo(
        () => filterGroupedStringOptions(variableSuggestionGroups, variableSuggestions, query),
        [variableSuggestionGroups, variableSuggestions, query]
    );

    const handleOpenChange = (next: boolean) => {
        if (next) setQuery("");
        setOpen(next);
    };

    useEffect(() => {
        if (!open) return;
        const id = window.requestAnimationFrame(() => {
            searchRef.current?.focus();
        });
        return () => window.cancelAnimationFrame(id);
    }, [open]);

    const handlePick = (value: string) => {
        onPick(value);
        setOpen(false);
    };

    if (!hasAny) return null;

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={ariaLabel}
                    disabled={disabled}
                    className={cn("justify-between font-normal", triggerClassName)}
                    onPointerDownCapture={onTriggerPointerDown}
                >
                    <span className="truncate text-muted-foreground">{placeholder}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align={align} className="w-[min(100vw-1.5rem,22rem)] p-0">
                <div className="border-b border-border px-2 py-2">
                    <Input
                        ref={searchRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="h-8 text-xs"
                        aria-label="Filter list"
                        autoComplete="off"
                    />
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                    {filtered.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">No matches.</p>
                    ) : (
                        filtered.map((group) => (
                            <div key={group.label || "__flat__"}>
                                {group.label ? (
                                    <div
                                        className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                                        title={
                                            groupHeaderTooltips?.[group.label] ??
                                            GROUPED_PICKER_BUILTIN_HEADER_TOOLTIPS[group.label]
                                        }
                                    >
                                        {group.label}
                                    </div>
                                ) : null}
                                <div className="pb-1">
                                    {group.options.map((opt) => (
                                        <button
                                            key={`${group.label}-${opt}`}
                                            type="button"
                                            className="w-full px-2 py-1.5 text-left font-mono text-[11px] leading-snug hover:bg-muted/80 focus:bg-muted/80 focus:outline-none"
                                            onClick={() => handlePick(opt)}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
