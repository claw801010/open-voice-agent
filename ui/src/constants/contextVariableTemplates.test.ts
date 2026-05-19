import { describe, expect, it } from "vitest";

import {
    buildGroupedPickerFilterSubtitleLookup,
    CALL_CONTEXT_FLOW_PATH_GROUP_LABEL,
    CALL_CONTEXT_PATH_LABELS,
    CALL_CONTEXT_PATH_PRESET_GROUPS,
    CONVERSATION_CONTEXT_VARIABLE_TEMPLATES,
    GROUPED_PICKER_BUILTIN_HEADER_TOOLTIPS,
    GROUPED_PICKER_BUILTIN_OPTION_SUBTITLES,
    groupedPickerFallbackHint,
    HTTP_VARIABLE_GROUP_LABELS,
    HTTP_VARIABLE_TEMPLATE_LABELS,
    mergePathPresetGroupsWithFlowTemplates,
    resolveGroupedPickerRowHint,
    SYSTEM_CONTEXT_VARIABLE_TEMPLATES,
    templateTokenToDotPath,
} from "./contextVariableTemplates";

describe("GROUPED_PICKER_BUILTIN_HEADER_TOOLTIPS", () => {
    it("includes HTTP variable groups and call-context preset groups", () => {
        expect(GROUPED_PICKER_BUILTIN_HEADER_TOOLTIPS[HTTP_VARIABLE_GROUP_LABELS.system]?.length).toBeGreaterThan(
            10
        );
        expect(GROUPED_PICKER_BUILTIN_HEADER_TOOLTIPS.System?.length).toBeGreaterThan(10);
        expect(GROUPED_PICKER_BUILTIN_HEADER_TOOLTIPS[CALL_CONTEXT_FLOW_PATH_GROUP_LABEL]?.length).toBeGreaterThan(
            10
        );
        expect(GROUPED_PICKER_BUILTIN_HEADER_TOOLTIPS["Common response shapes"]?.length).toBeGreaterThan(10);
    });
});

describe("templateTokenToDotPath", () => {
    it("strips a single {{…}} template to dot path", () => {
        expect(templateTokenToDotPath("{{a.b.c}}")).toBe("a.b.c");
    });

    it("trims inner whitespace", () => {
        expect(templateTokenToDotPath("{{  order_id  }}")).toBe("order_id");
    });

    it("returns null for empty inner", () => {
        expect(templateTokenToDotPath("{{}}")).toBeNull();
    });

    it("returns null for non-matching input", () => {
        expect(templateTokenToDotPath("not a template")).toBeNull();
        expect(templateTokenToDotPath("{x}")).toBeNull();
    });
});

describe("HTTP_VARIABLE_TEMPLATE_LABELS", () => {
    it("has a hint for every built-in system and conversation template token", () => {
        for (const t of SYSTEM_CONTEXT_VARIABLE_TEMPLATES) {
            expect(HTTP_VARIABLE_TEMPLATE_LABELS[t]?.length).toBeGreaterThan(3);
        }
        for (const t of CONVERSATION_CONTEXT_VARIABLE_TEMPLATES) {
            expect(HTTP_VARIABLE_TEMPLATE_LABELS[t]?.length).toBeGreaterThan(3);
        }
    });
});

describe("CALL_CONTEXT_PATH_LABELS", () => {
    it("has a hint for every static preset path option", () => {
        for (const g of CALL_CONTEXT_PATH_PRESET_GROUPS) {
            for (const p of g.options) {
                expect(CALL_CONTEXT_PATH_LABELS[p]?.length).toBeGreaterThan(3);
            }
        }
    });
});

describe("groupedPickerFallbackHint", () => {
    it("returns hints for custom, live, and merged-flow groups", () => {
        expect(groupedPickerFallbackHint(HTTP_VARIABLE_GROUP_LABELS.custom)).toContain("Custom flow");
        expect(groupedPickerFallbackHint(HTTP_VARIABLE_GROUP_LABELS.live)).toContain("Parameter");
        expect(groupedPickerFallbackHint(CALL_CONTEXT_FLOW_PATH_GROUP_LABEL)).toContain("custom");
    });

    it("returns undefined for unrelated group labels", () => {
        expect(groupedPickerFallbackHint("Common response shapes")).toBeUndefined();
    });
});

describe("resolveGroupedPickerRowHint", () => {
    it("prefers explicit subtitles over group fallback", () => {
        const merged = { "{{call_id}}": "Explicit override" };
        expect(resolveGroupedPickerRowHint(HTTP_VARIABLE_GROUP_LABELS.custom, "{{call_id}}", merged)).toBe(
            "Explicit override"
        );
    });

    it("uses fallback for custom tokens not in the map", () => {
        expect(
            resolveGroupedPickerRowHint(
                HTTP_VARIABLE_GROUP_LABELS.custom,
                "{{z99}}",
                GROUPED_PICKER_BUILTIN_OPTION_SUBTITLES
            )
        ).toContain("Custom flow");
    });
});

describe("buildGroupedPickerFilterSubtitleLookup", () => {
    it("includes fallback text for custom options so filters can match it", () => {
        const groups = [{ label: HTTP_VARIABLE_GROUP_LABELS.custom, options: ["{{only.custom}}"] }];
        const lookup = buildGroupedPickerFilterSubtitleLookup(groups, [], GROUPED_PICKER_BUILTIN_OPTION_SUBTITLES);
        expect(lookup["{{only.custom}}"]?.toLowerCase()).toContain("custom flow variable");
    });
});

describe("mergePathPresetGroupsWithFlowTemplates", () => {
    it("returns base unchanged when there are no extra paths", () => {
        const base = CALL_CONTEXT_PATH_PRESET_GROUPS;
        expect(mergePathPresetGroupsWithFlowTemplates(base, [])).toEqual(base);
    });

    it("appends a flow group with sorted extra paths, skipping duplicates in base", () => {
        const merged = mergePathPresetGroupsWithFlowTemplates(CALL_CONTEXT_PATH_PRESET_GROUPS, [
            "{{z_extra}}",
            "{{a_extra}}",
            "{{call_id}}",
            "  {{mid.path}}  ",
        ]);
        const flowGroup = merged.find((g) => g.label === CALL_CONTEXT_FLOW_PATH_GROUP_LABEL);
        expect(flowGroup).toBeDefined();
        expect(flowGroup?.options).toEqual(["a_extra", "mid.path", "z_extra"]);
    });

    it("ignores non-{{…}} template strings in the flat list", () => {
        const merged = mergePathPresetGroupsWithFlowTemplates(
            [
                { label: "A", options: ["x"] },
            ],
            ["bare", "{{valid.one}}", "{{x}}", "{{valid.one}}"]
        );
        const flow = merged.find((g) => g.label === CALL_CONTEXT_FLOW_PATH_GROUP_LABEL);
        expect(flow?.options).toEqual(["valid.one"]);
    });
});
