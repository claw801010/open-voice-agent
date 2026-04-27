"use client";

import { ChevronsUpDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    buildGroupedPickerFilterSubtitleLookup,
    GROUPED_PICKER_BUILTIN_HEADER_TOOLTIPS,
    GROUPED_PICKER_BUILTIN_OPTION_SUBTITLES,
    resolveGroupedPickerRowHint,
    type VariableSuggestionGroup,
} from "@/constants/contextVariableTemplates";
import { cn } from "@/lib/utils";

function optionMatchesFilter(
    opt: string,
    needle: string,
    subtitleLookup?: Readonly<Record<string, string>>
): boolean {
    if (!needle) return true;
    if (opt.toLowerCase().includes(needle)) return true;
    const sub = subtitleLookup?.[opt];
    return sub ? sub.toLowerCase().includes(needle) : false;
}

/** Filter grouped or flat string lists for the HTTP tool variable / path pickers (case-insensitive substring). */
export function filterGroupedStringOptions(
    groups: readonly VariableSuggestionGroup[],
    flatFallback: readonly string[],
    query: string,
    subtitleLookup?: Readonly<Record<string, string>>
): VariableSuggestionGroup[] {
    const needle = query.trim().toLowerCase();
    if (groups.length > 0) {
        const mapped = groups.map((g) => ({
            label: g.label,
            options: needle
                ? g.options.filter((o) => optionMatchesFilter(o, needle, subtitleLookup))
                : [...g.options],
        }));
        // When not filtering: keep empty groups so picker headers (e.g. Custom flow variables) stay visible.
        if (needle) return mapped.filter((g) => g.options.length > 0);
        return mapped;
    }
    const opts = needle
        ? flatFallback.filter((o) => optionMatchesFilter(o, needle, subtitleLookup))
        : [...flatFallback];
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
    /** Extra one-line hints under options; merged after built-in HTTP + call-context maps. */
    optionSubtitles?: Record<string, string>;
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
    searchPlaceholder = "Filter tokens or hints…",
    groupHeaderTooltips,
    optionSubtitles,
}: GroupedStringOptionPickerProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);

    const mergedSubtitles = useMemo(
        () => ({ ...GROUPED_PICKER_BUILTIN_OPTION_SUBTITLES, ...optionSubtitles }),
        [optionSubtitles]
    );

    const filterSubtitleLookup = useMemo(
        () =>
            buildGroupedPickerFilterSubtitleLookup(
                variableSuggestionGroups,
                variableSuggestions,
                mergedSubtitles
            ),
        [variableSuggestionGroups, variableSuggestions, mergedSubtitles]
    );

    const hasAny =
        variableSuggestionGroups.some((g) => g.options.length > 0) || variableSuggestions.length > 0;

    const filtered = useMemo(
        () =>
            filterGroupedStringOptions(
                variableSuggestionGroups,
                variableSuggestions,
                query,
                filterSubtitleLookup
            ),
        [variableSuggestionGroups, variableSuggestions, query, filterSubtitleLookup]
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
                        title="Matches token text or the hint line (built-in, custom, live, or flow paths)"
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
                                    {group.options.length === 0 ? (
                                        <p className="px-2 py-1.5 text-[10px] text-muted-foreground leading-snug">
                                            No entries in this group yet.
                                        </p>
                                    ) : (
                                        group.options.map((opt) => {
                                            const hint = resolveGroupedPickerRowHint(
                                                group.label,
                                                opt,
                                                mergedSubtitles
                                            );
                                            return (
                                                <button
                                                    key={`${group.label}-${opt}`}
                                                    type="button"
                                                    className="w-full px-2 py-1.5 text-left hover:bg-muted/80 focus:bg-muted/80 focus:outline-none"
                                                    title={hint ? `${opt} — ${hint}` : opt}
                                                    onClick={() => handlePick(opt)}
                                                >
                                                    <span className="block font-mono text-[11px] leading-snug">
                                                        {opt}
                                                    </span>
                                                    {hint ? (
                                                        <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                                                            {hint}
                                                        </span>
                                                    ) : null}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
