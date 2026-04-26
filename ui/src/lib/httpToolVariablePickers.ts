/** Stable, case-sensitive sort for `{{…}}` template strings in HTTP tool pickers. */
export function sortDistinctTemplates(templates: readonly string[]): string[] {
    return Array.from(new Set(templates.map((t) => t.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
