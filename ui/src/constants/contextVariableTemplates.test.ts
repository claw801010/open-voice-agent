import { describe, expect, it } from "vitest";

import {
    CALL_CONTEXT_FLOW_PATH_GROUP_LABEL,
    CALL_CONTEXT_PATH_PRESET_GROUPS,
    mergePathPresetGroupsWithFlowTemplates,
    templateTokenToDotPath,
} from "./contextVariableTemplates";

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
