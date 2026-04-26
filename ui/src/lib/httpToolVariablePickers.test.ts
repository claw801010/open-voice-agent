import { describe, expect, it } from "vitest";

import { sortDistinctTemplates } from "./httpToolVariablePickers";

describe("sortDistinctTemplates", () => {
    it("dedupes, trims, and sorts", () => {
        expect(sortDistinctTemplates([" {{b}} ", "{{a}}", "{{b}}", "  "])).toEqual(["{{a}}", "{{b}}"]);
    });
});
