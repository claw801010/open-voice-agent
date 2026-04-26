import type { VariableSuggestionGroup } from "@/constants/contextVariableTemplates";

export type CallContextFormRow = { id: string; path: string; value: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}

function primitiveToCell(v: unknown): string {
    if (typeof v === "string") return v;
    return JSON.stringify(v);
}

/** Flatten nested plain objects to dot-path rows (arrays / non-objects become JSON leaves). */
export function flattenCallContextSample(
    obj: Record<string, unknown>,
    prefix = ""
): Omit<CallContextFormRow, "id">[] {
    const out: Omit<CallContextFormRow, "id">[] = [];
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
        const p = prefix ? `${prefix}.${key}` : key;
        const v = obj[key];
        if (isPlainObject(v)) {
            out.push(...flattenCallContextSample(v, p));
        } else {
            out.push({ path: p, value: primitiveToCell(v) });
        }
    }
    return out;
}

export function withRowIds(rows: Omit<CallContextFormRow, "id">[]): CallContextFormRow[] {
    return rows.map((r) => ({
        ...r,
        id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${r.path}-${Math.random().toString(36).slice(2)}`,
    }));
}

export function safeParseCallContextObject(json: string): Record<string, unknown> {
    try {
        const v = JSON.parse(json) as unknown;
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
            return v as Record<string, unknown>;
        }
    } catch {
        /* ignore */
    }
    return {};
}

/** Parse a form value cell: JSON literals, or raw string including `{{...}}` templates. */
export function parseCallContextValueCell(s: string): unknown {
    const t = s.trim();
    if (t === "") return "";
    if (/^\{\{[^}]+\}\}$/.test(t)) return t;
    try {
        return JSON.parse(t) as unknown;
    } catch {
        return s;
    }
}

export function setByDotPath(root: Record<string, unknown>, path: string, val: unknown): void {
    const parts = path.split(".").filter((x) => x.length > 0);
    if (parts.length === 0) return;
    let cur: Record<string, unknown> = root;
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        const next = cur[key];
        if (!isPlainObject(next)) {
            cur[key] = {};
        }
        cur = cur[key] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = val as unknown;
}

export function unflattenCallContextRows(rows: CallContextFormRow[]): Record<string, unknown> {
    const root: Record<string, unknown> = {};
    for (const row of rows) {
        const path = row.path.trim();
        if (!path) continue;
        setByDotPath(root, path, parseCallContextValueCell(row.value));
    }
    return root;
}

export function stringifyCallContextObject(obj: Record<string, unknown>): string {
    return JSON.stringify(obj, null, 2);
}

/** Unique sorted dot paths from call-context preset groups (Form Preset path dropdown). */
export function collectPresetDotPaths(groups: VariableSuggestionGroup[]): string[] {
    const seen = new Set<string>();
    for (const g of groups) {
        for (const o of g.options) {
            const t = o.trim();
            if (t) seen.add(t);
        }
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
}

/** Map dot path → value cell string from sample JSON (same flattening as the Form tab). */
export function pathValueMapFromSampleJson(json: string): Map<string, string> {
    const obj = safeParseCallContextObject(json);
    const m = new Map<string, string>();
    for (const row of flattenCallContextSample(obj)) {
        m.set(row.path, row.value);
    }
    return m;
}

/**
 * When the user picks a preset dot path in the call-context Form: if the value cell was empty and the
 * default sample JSON defines that path, fill the value (same source as Add missing preset rows).
 */
export function mergePresetPathPick(
    path: string,
    previousValue: string,
    defaultSampleMap: ReadonlyMap<string, string>
): { path: string; value?: string } {
    const suggested = defaultSampleMap.get(path);
    const empty = !previousValue.trim();
    if (empty && suggested !== undefined && suggested !== "") {
        return { path, value: suggested };
    }
    return { path };
}

/**
 * For each key in `defaults`, copy into the result if missing; if the key exists in both and both
 * values are plain objects, merge recursively. Does not remove keys. Arrays and other values: only
 * filled when the key is missing in `current`.
 */
export function mergeMissingKeysFromDefault(
    defaults: Record<string, unknown>,
    current: Record<string, unknown>
): Record<string, unknown> {
    const out: Record<string, unknown> = { ...current };
    for (const key of Object.keys(defaults)) {
        const dv = defaults[key];
        const cv = out[key];
        if (cv === undefined) {
            out[key] = dv;
        } else if (isPlainObject(dv) && isPlainObject(cv)) {
            out[key] = mergeMissingKeysFromDefault(dv, cv);
        }
    }
    return out;
}

/** Merge the standard default call-context object into a JSON string without overwriting existing keys. */
export function mergeCallContextJsonWithDefaults(
    currentJson: string,
    defaultJson: string
): string {
    const c = safeParseCallContextObject(currentJson);
    const d = safeParseCallContextObject(defaultJson);
    return stringifyCallContextObject(mergeMissingKeysFromDefault(d, c));
}
