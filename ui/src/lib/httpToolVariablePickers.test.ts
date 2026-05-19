import { describe, expect, it } from "vitest";

import {
    collectTemplatePathsFromStrings,
    pathsToTemplateTokens,
    sortDistinctTemplates,
} from "./httpToolVariablePickers";

describe("sortDistinctTemplates", () => {
    it("dedupes, trims, and sorts", () => {
        expect(sortDistinctTemplates([" {{b}} ", "{{a}}", "{{b}}", "  "])).toEqual(["{{a}}", "{{b}}"]);
    });
});

describe("collectTemplatePathsFromStrings", () => {
    it("collects inner paths with optional spaces", () => {
        expect(
            collectTemplatePathsFromStrings([
                "https://x.com/v1/{{api.order_id}}/x",
                '{{ body.foo }} and {{api.order_id}}',
            ])
        ).toEqual(["api.order_id", "body.foo"]);
    });
});

describe("pathsToTemplateTokens", () => {
    it("wraps paths as mustache tokens", () => {
        expect(pathsToTemplateTokens(["a.b", "c"])).toEqual(["{{a.b}}", "{{c}}"]);
    });
});
