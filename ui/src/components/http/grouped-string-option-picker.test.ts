import { describe, expect, it } from "vitest";

import {
    buildGroupedPickerFilterSubtitleLookup,
    GROUPED_PICKER_BUILTIN_OPTION_SUBTITLES,
    HTTP_VARIABLE_GROUP_LABELS,
} from "@/constants/contextVariableTemplates";

import { filterGroupedStringOptions } from "./grouped-string-option-picker";

describe("filterGroupedStringOptions", () => {
    it("returns all groups and options when query is empty", () => {
        const groups = [
            { label: "A", options: ["x", "y"] },
            { label: "B", options: ["z"] },
        ];
        expect(filterGroupedStringOptions(groups, [], "")).toEqual(groups);
    });

    it("keeps empty groups when query is empty (picker headers stay visible)", () => {
        const groups = [
            { label: "A", options: ["x"] },
            { label: "B", options: [] as string[] },
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

    it("matches options by subtitle text when subtitle lookup is provided", () => {
        const groups = [{ label: "System", options: ["{{caller_number}}", "{{locale}}"] }];
        const subtitles = { "{{caller_number}}": "Caller phone (E.164)" };
        expect(filterGroupedStringOptions(groups, [], "e.164", subtitles)).toEqual([
            { label: "System", options: ["{{caller_number}}"] },
        ]);
    });

    it("matches custom-group tokens by fallback hint text (e.g. search “browser”)", () => {
        const groups = [
            { label: HTTP_VARIABLE_GROUP_LABELS.custom, options: ["{{acme.segment}}", "{{other}}"] },
        ];
        const lookup = buildGroupedPickerFilterSubtitleLookup(groups, [], GROUPED_PICKER_BUILTIN_OPTION_SUBTITLES);
        expect(filterGroupedStringOptions(groups, [], "browser", lookup)).toEqual([
            { label: HTTP_VARIABLE_GROUP_LABELS.custom, options: ["{{acme.segment}}", "{{other}}"] },
        ]);
    });
});
