"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

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
import { cn } from "@/lib/utils";

// URL regex pattern that validates:
// - http:// or https:// protocol (required)
// - Optional username:password@
// - Domain name or IP address
// - Optional port number
// - Optional path, query string, and fragment
const URL_REGEX =
    /^https?:\/\/(?:[\w-]+(?::[\w-]+)?@)?(?:[\w-]+\.)*[\w-]+(?::\d{1,5})?(?:\/[^\s]*)?$/i;

/** URLs that include `{{…}}` are validated loosely (runtime resolves to a real URL). */
const TEMPLATED_URL_PREFIX = /^https?:\/\//i;

export interface UrlValidationResult {
    valid: boolean;
    error?: string;
}

export function validateUrl(url: string): UrlValidationResult {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
        return { valid: false, error: "URL is required" };
    }

    if (trimmedUrl.includes("{{")) {
        if (!TEMPLATED_URL_PREFIX.test(trimmedUrl)) {
            return {
                valid: false,
                error: "Templated URL must start with http:// or https://",
            };
        }
        return { valid: true };
    }

    if (!URL_REGEX.test(trimmedUrl)) {
        return {
            valid: false,
            error: "Invalid URL format. Must start with http:// or https://",
        };
    }

    return { valid: true };
}

function captureInputSelection(el: HTMLInputElement | null) {
    if (!el) return { start: 0, end: 0 };
    return { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
}

interface UrlInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    /** Show validation error styling and message inline */
    showValidation?: boolean;
    /** Called when validation state changes */
    onValidationChange?: (result: UrlValidationResult) => void;
    /** When set with groups or flat suggestions, shows an insert control next to the URL field */
    variableSuggestionGroups?: VariableSuggestionGroup[];
    variableSuggestions?: string[];
    variableInsertMode?: "replace" | "append";
    selectPlaceholder?: string;
}

export function UrlInput({
    value,
    onChange,
    placeholder = "https://api.example.com/endpoint",
    disabled = false,
    className,
    showValidation = false,
    onValidationChange,
    variableSuggestionGroups = [],
    variableSuggestions = [],
    variableInsertMode = "replace",
    selectPlaceholder = "Insert into URL",
}: UrlInputProps) {
    const [touched, setTouched] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const savedSel = useRef({ start: 0, end: 0 });
    const pendingCaret = useRef<number | null>(null);

    const hasVariablePicker =
        variableSuggestionGroups.length > 0 || variableSuggestions.length > 0;

    const syncSelection = useCallback(() => {
        savedSel.current = captureInputSelection(inputRef.current);
    }, []);

    useLayoutEffect(() => {
        const el = inputRef.current;
        if (el == null || pendingCaret.current == null) return;
        const pos = pendingCaret.current;
        pendingCaret.current = null;
        el.focus();
        el.setSelectionRange(pos, pos);
    }, [value]);

    const applyVariable = useCallback(
        (snippet: string) => {
            const { start, end } = savedSel.current;
            const trimmed = value.trim();

            if (variableInsertMode === "replace") {
                if (start !== end) {
                    const next = value.slice(0, start) + snippet + value.slice(end);
                    pendingCaret.current = start + snippet.length;
                    onChange(next);
                    return;
                }
                if (!trimmed) {
                    pendingCaret.current = snippet.length;
                    onChange(snippet);
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
        },
        [onChange, value, variableInsertMode]
    );

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            onChange(newValue);

            if (onValidationChange && (touched || newValue)) {
                onValidationChange(validateUrl(newValue));
            }
        },
        [onChange, onValidationChange, touched]
    );

    const handleBlur = useCallback(() => {
        setTouched(true);
        const trimmedValue = value.trim();
        if (trimmedValue !== value) {
            onChange(trimmedValue);
        }
        if (onValidationChange && trimmedValue) {
            onValidationChange(validateUrl(trimmedValue));
        }
    }, [onChange, onValidationChange, value]);

    const validation = validateUrl(value);
    const showError = showValidation && touched && !validation.valid && value;

    return (
        <div className="space-y-1">
            <div className="flex flex-wrap items-start gap-2">
                <Input
                    ref={inputRef}
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onSelect={syncSelection}
                    onKeyUp={syncSelection}
                    onMouseUp={syncSelection}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                        "min-w-0 flex-1",
                        showError && "border-destructive focus-visible:ring-destructive",
                        className
                    )}
                />
                {hasVariablePicker && !disabled ? (
                    <Select value="" onValueChange={applyVariable}>
                        <SelectTrigger
                            className="w-[240px] shrink-0"
                            onPointerDownCapture={syncSelection}
                            aria-label="Insert system, conversation, custom, or tool variable into URL"
                        >
                            <SelectValue placeholder={selectPlaceholder} />
                        </SelectTrigger>
                        <SelectContent className="max-h-72 overflow-y-auto">
                            {variableSuggestionGroups.length > 0
                                ? variableSuggestionGroups.map((group) => (
                                      <SelectGroup key={`url-var-${group.label}`}>
                                          <SelectLabel>{group.label}</SelectLabel>
                                          {group.options.map((template) => (
                                              <SelectItem
                                                  key={`url-var-${group.label}-${template}`}
                                                  value={template}
                                              >
                                                  {template}
                                              </SelectItem>
                                          ))}
                                      </SelectGroup>
                                  ))
                                : variableSuggestions.map((template) => (
                                      <SelectItem key={`url-var-${template}`} value={template}>
                                          {template}
                                      </SelectItem>
                                  ))}
                        </SelectContent>
                    </Select>
                ) : null}
            </div>
            {showError && <p className="text-xs text-destructive">{validation.error}</p>}
        </div>
    );
}
