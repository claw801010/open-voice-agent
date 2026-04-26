import { describe, expect, it } from "vitest";

import { DEFAULT_CALL_CONTEXT_TEST_JSON } from "@/constants/contextVariableTemplates";

import {
    collectPresetDotPaths,
    mergeCallContextJsonWithDefaults,
    mergeMissingKeysFromDefault,
    pathValueMapFromSampleJson,
} from "./callContextSampleForm";

describe("mergeMissingKeysFromDefault", () => {
    it("adds only missing top-level keys from defaults", () => {
        const d = { a: 1, b: 2, nested: { x: 1, y: 2 } };
        const c = { a: 99, nested: { x: 0 } };
        const m = mergeMissingKeysFromDefault(d, c);
        expect(m).toEqual({ a: 99, b: 2, nested: { x: 0, y: 2 } });
    });

    it("fills in completely missing nested branch", () => {
        const m = mergeMissingKeysFromDefault(
            { conversation: { intent: "a", summary: "s" } },
            { initial_context: { customer_id: "x" } } as Record<string, unknown>
        );
        expect(m).toEqual({
            conversation: { intent: "a", summary: "s" },
            initial_context: { customer_id: "x" },
        });
    });
});

describe("collectPresetDotPaths", () => {
    it("returns sorted unique paths", () => {
        const paths = collectPresetDotPaths([
            { label: "A", options: ["z", "a"] },
            { label: "B", options: ["a", "b"] },
        ]);
        expect(paths).toEqual(["a", "b", "z"]);
    });
});

describe("pathValueMapFromSampleJson", () => {
    it("maps flattened paths from default sample", () => {
        const m = pathValueMapFromSampleJson(DEFAULT_CALL_CONTEXT_TEST_JSON);
        expect(m.get("caller_number")).toBeDefined();
        expect(m.get("conversation.intent")).toBeDefined();
    });

    it("handles invalid JSON as empty map", () => {
        expect(pathValueMapFromSampleJson("not json").size).toBe(0);
    });
});

describe("mergeCallContextJsonWithDefaults", () => {
    it("rehydrates an empty test context from DEFAULT_CALL_CONTEXT_TEST_JSON", () => {
        const out = mergeCallContextJsonWithDefaults("{}", DEFAULT_CALL_CONTEXT_TEST_JSON);
        const p = JSON.parse(out) as Record<string, unknown>;
        expect(p.caller_number).toBeDefined();
        expect(p.conversation).toBeDefined();
    });

    it("preserves user override when merging on top of defaults", () => {
        const current = JSON.stringify(
            { caller_number: "+1custom", conversation: { intent: "custom" } },
            null,
            2
        );
        const out = mergeCallContextJsonWithDefaults(current, DEFAULT_CALL_CONTEXT_TEST_JSON);
        const p = JSON.parse(out) as {
            caller_number: string;
            conversation: { intent: string; summary?: string };
        };
        expect(p.caller_number).toBe("+1custom");
        expect(p.conversation.intent).toBe("custom");
        expect(p.conversation.summary).toBeDefined();
    });
});
