import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";

export function captureTextControlSelection(el: HTMLInputElement | HTMLTextAreaElement | null): {
    start: number;
    end: number;
} {
    if (!el) return { start: 0, end: 0 };
    return { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
}

/**
 * Insert a `{{…}}` (or other) snippet with **replace** vs **append** semantics.
 *
 * - **replace** + non-empty selection → replace that range.
 * - **replace** + collapsed caret → insert at caret (does not wipe the whole field).
 * - **replace** + empty value → field becomes the snippet.
 * - **append** → insert at end of selection range (caret when collapsed).
 */
export function applyTemplateSnippetEdit(args: {
    value: string;
    snippet: string;
    mode: "replace" | "append";
    start: number;
    end: number;
}): { next: string; caret: number } {
    const { value, snippet, mode, start, end } = args;
    const trimmed = value.trim();

    if (mode === "replace") {
        if (start !== end) {
            const next = value.slice(0, start) + snippet + value.slice(end);
            return { next, caret: start + snippet.length };
        }
        if (!trimmed) {
            return { next: snippet, caret: snippet.length };
        }
        const insertAt = start;
        const next = value.slice(0, insertAt) + snippet + value.slice(insertAt);
        return { next, caret: insertAt + snippet.length };
    }

    if (!trimmed) {
        return { next: snippet, caret: snippet.length };
    }
    const insertAt = end;
    const next = value.slice(0, insertAt) + snippet + value.slice(insertAt);
    return { next, caret: insertAt + snippet.length };
}

export function useTemplateSnippetInsert<T extends HTMLInputElement | HTMLTextAreaElement>(args: {
    value: string;
    onChange: (next: string) => void;
    variableInsertMode: "replace" | "append";
}): {
    elRef: RefObject<T | null>;
    syncSelection: () => void;
    applySnippet: (snippet: string) => void;
} {
    const { value, onChange, variableInsertMode } = args;
    const elRef = useRef<T | null>(null);
    const savedSel = useRef({ start: 0, end: 0 });
    const pendingCaret = useRef<number | null>(null);

    const syncSelection = useCallback(() => {
        savedSel.current = captureTextControlSelection(elRef.current);
    }, []);

    useLayoutEffect(() => {
        const el = elRef.current;
        if (el == null || pendingCaret.current == null) return;
        const pos = pendingCaret.current;
        pendingCaret.current = null;
        el.focus();
        el.setSelectionRange(pos, pos);
    }, [value]);

    const applySnippet = useCallback(
        (snippet: string) => {
            const { next, caret } = applyTemplateSnippetEdit({
                value,
                snippet,
                mode: variableInsertMode,
                start: savedSel.current.start,
                end: savedSel.current.end,
            });
            pendingCaret.current = caret;
            onChange(next);
        },
        [value, onChange, variableInsertMode]
    );

    return { elRef, syncSelection, applySnippet };
}
