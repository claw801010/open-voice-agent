/** Format HTTP cache hit rate for analytics KPI copy. */
export function formatHttpCacheHitRate(
    invocations: number | null | undefined,
    cacheHits: number | null | undefined,
): string | null {
    const inv = invocations ?? 0;
    const hits = cacheHits ?? 0;
    if (inv <= 0) {
        return null;
    }
    const pct = Math.round((hits / inv) * 100);
    return `${hits} / ${inv} (${pct}%)`;
}
