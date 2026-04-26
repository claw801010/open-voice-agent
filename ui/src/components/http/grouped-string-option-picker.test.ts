import { describe, expect, it } from "vitest";

import { filterGroupedStringOptions } from "./grouped-string-option-picker";

describe("filterGroupedStringOptions", () => {
    it("returns all groups and options when query is empty", () => {
        const groups = [
            { label: "A", options: ["x", "y"] },
            { label: "B", options: ["z"] },
        ];
        expect(filterGroupedStringOptions(groups, [], "")).toEqual(groups);
    });

    it("filters case-insensitive within groups", () => {
        const groups = [{ label: "System", options: ["caller_number", "foo"] }];
        expect(filterGroupedStringOptions(groups, [], "CALL")).toEqual([
            { label: "System", options: ["caller_number"] },
        ]);
    });

    it("drops groups with no matches", () => {
        const groups = [
            { label: "A", options: ["nomatch"] },
            { label: "B", options: ["caller_number"] },
        ];
        expect(filterGroupedStringOptions(groups, [], "caller")).toEqual([
            { label: "B", options: ["caller_number"] },
        ]);
    });

    it("uses flat fallback when groups array is empty", () => {
        expect(filterGroupedStringOptions([], ["{{a}}", "{{b}}"], "b")).toEqual([{ label: "", options: ["{{b}}"] }]);
    });

    it("returns empty when flat fallback has no matches", () => {
        expect(filterGroupedStringOptions([], ["{{a}}"], "zzz")).toEqual([]);
    });
});
