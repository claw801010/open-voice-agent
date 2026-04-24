/**
 * WE-01-HEADER: format latest workflow run usage for header copy (uses existing runs list API).
 */

export type RunWithCost = {
    cost_info?: {
        dograh_token_usage?: number;
        call_duration_seconds?: number | null;
    } | null;
};

function formatDurationSeconds(sec: number): string {
    const s = Math.round(sec);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (rem === 0) return `${m} min`;
    return `${m}m ${rem}s`;
}

/**
 * First run in the list (newest when API returns desc `created_at`) that has usable `cost_info`.
 */
export function summarizeRecentRunUsage(runs: RunWithCost[]): string | null {
    for (const run of runs) {
        const c = run.cost_info;
        if (!c) continue;
        const tokensRaw = c.dograh_token_usage;
        const durRaw = c.call_duration_seconds;
        const hasTokens = tokensRaw != null && Number.isFinite(Number(tokensRaw));
        const hasDur = durRaw != null && Number(durRaw) > 0;
        if (!hasTokens && !hasDur) continue;

        const parts: string[] = [];
        if (hasTokens) {
            const t = Math.round(Number(tokensRaw));
            parts.push(`${t} token${t === 1 ? '' : 's'}`);
        }
        if (hasDur) {
            parts.push(formatDurationSeconds(Number(durRaw)));
        }
        if (parts.length === 0) continue;
        return `Last run: ${parts.join(' · ')}`;
    }
    return null;
}

const AGGREGATE_MAX_RUNS = 10;

/**
 * Latest single-run line plus **Avg last N runs** when at least two runs include `dograh_token_usage`
 * (uses the same newest-first list from `GET /workflow/{id}/runs`).
 */
export function computeRunUsageHints(runs: RunWithCost[]): {
    lastRun: string | null;
    aggregate: string | null;
} {
    const lastRun = summarizeRecentRunUsage(runs);

    const tokenValues: number[] = [];
    for (const run of runs) {
        if (tokenValues.length >= AGGREGATE_MAX_RUNS) break;
        const raw = run.cost_info?.dograh_token_usage;
        if (raw != null && Number.isFinite(Number(raw))) {
            tokenValues.push(Math.round(Number(raw)));
        }
    }

    if (tokenValues.length < 2) {
        return { lastRun, aggregate: null };
    }

    const sum = tokenValues.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / tokenValues.length);
    const aggregate = `Avg last ${tokenValues.length} runs: ${avg} tokens`;

    return { lastRun, aggregate };
}
