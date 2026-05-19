/** Stable, case-sensitive sort for `{{…}}` template strings in HTTP tool pickers. */
export function sortDistinctTemplates(templates: readonly string[]): string[] {
    return Array.from(new Set(templates.map((t) => t.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

/**
 * Extract inner paths from `{{ ... }}` templates (URL, JSON body, headers, parameter value templates, raw code).
 * Used to surface tokens in pickers and call-context “From your flow” without re-typing them under Custom flow variable.
 */
export function collectTemplatePathsFromStrings(strings: string[]): string[] {
    const re = /\{\{\s*([^}]+?)\s*\}\}/g;
    const out = new Set<string>();
    for (const str of strings) {
        if (!str) continue;
        const r = new RegExp(re.source, "g");
        let m: RegExpExecArray | null;
        while ((m = r.exec(str)) !== null) {
            const p = m[1].trim();
            if (p) out.add(p);
        }
    }
    return [...out].sort((a, b) => a.localeCompare(b));
}

/** Dot paths from {@link collectTemplatePathsFromStrings} as `{{path}}` tokens for variable pickers. */
export function pathsToTemplateTokens(paths: string[]): string[] {
    return paths.map((p) => `{{${p}}}`);
}
