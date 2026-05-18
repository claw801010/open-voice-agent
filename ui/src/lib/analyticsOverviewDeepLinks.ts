/**
 * MK-01 Analytics Overview → call list exploration (same filters as insights roll-up).
 */

export function isoRangeToUtcDateParams(sinceIso: string, untilIso: string): { since?: string; until?: string } {
    const s = new Date(sinceIso);
    const u = new Date(untilIso);
    if (Number.isNaN(s.getTime()) || Number.isNaN(u.getTime())) {
        return {};
    }
    return {
        since: s.toISOString().slice(0, 10),
        until: u.toISOString().slice(0, 10),
    };
}

/** Opens `/analytics/calls` with tool_name + optional MK-01 slug/variant + date range from insights. */
export function buildAnalyticsCallsExploreHref(opts: {
    toolName?: string;
    catalogSlug?: string;
    catalogVariantId?: string;
    insightsSinceIso?: string;
    insightsUntilIso?: string;
}): string {
    const q = new URLSearchParams();
    const tn = (opts.toolName ?? '').trim();
    if (tn) q.set("tool_name", tn);
    const slug = opts.catalogSlug?.trim();
    if (slug) q.set("catalog_slug", slug);
    const cv = opts.catalogVariantId?.trim();
    if (cv) q.set("catalog_variant_id", cv);
    if (opts.insightsSinceIso && opts.insightsUntilIso) {
        const { since, until } = isoRangeToUtcDateParams(opts.insightsSinceIso, opts.insightsUntilIso);
        if (since) q.set("since", since);
        if (until) q.set("until", until);
    }
    const s = q.toString();
    return s ? `/analytics/calls?${s}` : "/analytics/calls";
}

const NO_OUTCOME_BUCKET = "(no outcome key)";

/** Call list filtered by outcome_key / customer_outcome (API accepts same query param). Returns null for the empty bucket label. */
export function buildAnalyticsCallsOutcomeExploreHref(opts: {
    outcomeLabel: string;
    catalogSlug?: string;
    catalogVariantId?: string;
    insightsSinceIso?: string;
    insightsUntilIso?: string;
}): string | null {
    const label = opts.outcomeLabel.trim();
    if (!label || label === NO_OUTCOME_BUCKET) return null;
    const q = new URLSearchParams();
    q.set("outcome_key", label);
    const slug = opts.catalogSlug?.trim();
    if (slug) q.set("catalog_slug", slug);
    const cv = opts.catalogVariantId?.trim();
    if (cv) q.set("catalog_variant_id", cv);
    if (opts.insightsSinceIso && opts.insightsUntilIso) {
        const { since, until } = isoRangeToUtcDateParams(opts.insightsSinceIso, opts.insightsUntilIso);
        if (since) q.set("since", since);
        if (until) q.set("until", until);
    }
    return `/analytics/calls?${q.toString()}`;
}
