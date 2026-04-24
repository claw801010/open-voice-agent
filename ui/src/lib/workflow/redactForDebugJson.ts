/**
 * Deep-redact likely secrets from an object before showing in WE-01-TEST raw debug JSON.
 * Key-name heuristics only; does not guarantee zero leakage for arbitrary payloads.
 */
const SENSITIVE_KEY = /(api[_-]?key|apikey|secret|token|password|authorization|auth|credential|private[_-]?key|bearer|webhook|client_secret|access_token|refresh_token)/i;

export function redactForDebugJson<T>(value: T): T {
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === 'string') {
        if (/^Bearer\s+\S+/i.test(value) || /^sk-[a-zA-Z0-9_-]{10,}/.test(value)) {
            return '[REDACTED]' as T;
        }
        return value;
    }
    if (typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => redactForDebugJson(item)) as T;
    }
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (SENSITIVE_KEY.test(k)) {
            out[k] = '[REDACTED]';
        } else {
            out[k] = redactForDebugJson(v);
        }
    }
    return out as T;
}
