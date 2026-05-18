import { describe, expect, it } from "vitest";

import catalog from "../../../catalog/vertical-packs.json";

import { VERTICAL_HTTP_PROOF_HINTS, verticalHttpProofHintForSlug } from "./analyticsVerticalHttpHints";

describe("analyticsVerticalHttpHints", () => {
    it("every vertical-packs slug has HTTP proof hints", () => {
        for (const pack of catalog.packs) {
            const hint = VERTICAL_HTTP_PROOF_HINTS[pack.slug];
            expect(hint, `missing VERTICAL_HTTP_PROOF_HINTS for ${pack.slug}`).toBeDefined();
            expect(hint!.example_tool_names.length).toBeGreaterThan(0);
            expect(hint!.suggested_response_mapping_keys.length).toBeGreaterThan(0);
        }
    });

    it("verticalHttpProofHintForSlug trims and returns null for unknown", () => {
        expect(verticalHttpProofHintForSlug(null)).toBeNull();
        expect(verticalHttpProofHintForSlug("  ")).toBeNull();
        expect(verticalHttpProofHintForSlug("unknown")).toBeNull();
        expect(verticalHttpProofHintForSlug(" healthcare-clinic-screening ")).not.toBeNull();
    });
});
