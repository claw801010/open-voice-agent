import { describe, expect, it } from "vitest";

import {
    buildAnalyticsCallsExploreHref,
    buildAnalyticsCallsOutcomeExploreHref,
    isoRangeToUtcDateParams,
} from "./analyticsOverviewDeepLinks";

describe("analyticsOverviewDeepLinks", () => {
    it("isoRangeToUtcDateParams returns UTC YYYY-MM-DD", () => {
        expect(
            isoRangeToUtcDateParams("2026-04-01T00:00:00+00:00", "2026-04-07T23:59:59.999Z"),
        ).toEqual({ since: "2026-04-01", until: "2026-04-07" });
    });

    it("buildAnalyticsCallsExploreHref includes tool and catalog filters", () => {
        const href = buildAnalyticsCallsExploreHref({
            toolName: "book_slot",
            catalogSlug: "healthcare-clinic-screening",
            catalogVariantId: "booking_complex",
            insightsSinceIso: "2026-05-01T12:00:00.000Z",
            insightsUntilIso: "2026-05-02T18:00:00.000Z",
        });
        expect(href).toContain("/analytics/calls?");
        expect(href).toContain("tool_name=book_slot");
        expect(href).toContain("catalog_slug=healthcare-clinic-screening");
        expect(href).toContain("catalog_variant_id=booking_complex");
        expect(href).toContain("since=2026-05-01");
        expect(href).toContain("until=2026-05-02");
    });

    it("buildAnalyticsCallsExploreHref omits empty optional params", () => {
        const href = buildAnalyticsCallsExploreHref({ toolName: "x" });
        expect(href).toBe("/analytics/calls?tool_name=x");
    });

    it("buildAnalyticsCallsExploreHref supports catalog_slug without tool_name", () => {
        const href = buildAnalyticsCallsExploreHref({ catalogSlug: "healthcare-clinic-screening" });
        expect(href).toBe("/analytics/calls?catalog_slug=healthcare-clinic-screening");
    });

    it("buildAnalyticsCallsOutcomeExploreHref returns null for empty bucket", () => {
        expect(buildAnalyticsCallsOutcomeExploreHref({ outcomeLabel: "(no outcome key)" })).toBeNull();
    });

    it("buildAnalyticsCallsOutcomeExploreHref sets outcome_key", () => {
        const href = buildAnalyticsCallsOutcomeExploreHref({
            outcomeLabel: "booked",
            catalogSlug: "retail-wismo-faq",
            insightsSinceIso: "2026-01-01T00:00:00.000Z",
            insightsUntilIso: "2026-01-02T00:00:00.000Z",
        });
        expect(href).toContain("outcome_key=booked");
        expect(href).toContain("catalog_slug=retail-wismo-faq");
    });
});
