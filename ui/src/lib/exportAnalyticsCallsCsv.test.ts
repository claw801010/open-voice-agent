import { describe, expect, it } from "vitest";

import { analyticsCallsToCsv, escapeCsvCell } from "./exportAnalyticsCallsCsv";
import type { AnalyticsCallListItem } from "@/lib/analyticsCallsApi";

describe("exportAnalyticsCallsCsv", () => {
    it("escapeCsvCell quotes commas and quotes", () => {
        expect(escapeCsvCell("a,b")).toBe('"a,b"');
        expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    });

    it("includes header and rows", () => {
        const rows: AnalyticsCallListItem[] = [
            {
                call_id: "wr-1",
                workflow_id: 2,
                workflow_slug: "healthcare-clinic-screening",
                started_at: "2026-04-01T12:00:00Z",
                duration_ms: 60000,
                disposition: "completed",
                outcome_key: "booked",
                tool_names: ["reserve_slot"],
                cx_score: 82,
                containment: "contained",
                qa_score: 4.5,
                scorecard_pass_rate: 0.75,
            },
        ];
        const csv = analyticsCallsToCsv(rows, false);
        const header = csv.split("\r\n")[0];
        expect(header).toContain("call_id");
        expect(header).toContain("cx_score");
        expect(header).toContain("scorecard_pass_rate");
        expect(csv).toContain("wr-1");
        expect(csv).toContain("reserve_slot");
        expect(csv).toContain("healthcare-clinic-screening");
        expect(csv).toContain("contained");
        expect(csv).toContain("0.75");
    });
});
