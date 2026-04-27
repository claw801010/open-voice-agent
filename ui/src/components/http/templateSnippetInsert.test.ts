import { describe, expect, it } from "vitest";

import { applyTemplateSnippetEdit } from "./templateSnippetInsert";

describe("applyTemplateSnippetEdit", () => {
    it("replace: inserts at caret without wiping URL", () => {
        const value = "https://api.example.com/orders/";
        const { next, caret } = applyTemplateSnippetEdit({
            value,
            snippet: "{{order_id}}",
            mode: "replace",
            start: value.length,
            end: value.length,
        });
        expect(next).toBe("https://api.example.com/orders/{{order_id}}");
        expect(caret).toBe(next.length);
    });

    it("replace: replaces highlighted range", () => {
        const value = "https://x/{{id}}/done";
        const { next, caret } = applyTemplateSnippetEdit({
            value,
            snippet: "{{order_id}}",
            mode: "replace",
            start: 10,
            end: 16,
        });
        expect(next).toBe("https://x/{{order_id}}/done");
        expect(caret).toBe(10 + "{{order_id}}".length);
    });

    it("replace: empty field becomes snippet", () => {
        const { next, caret } = applyTemplateSnippetEdit({
            value: "   ",
            snippet: "{{a}}",
            mode: "replace",
            start: 0,
            end: 0,
        });
        expect(next).toBe("{{a}}");
        expect(caret).toBe(5);
    });

    it("append: inserts at caret end", () => {
        const value = "Bearer ";
        const { next, caret } = applyTemplateSnippetEdit({
            value,
            snippet: "{{token}}",
            mode: "append",
            start: 7,
            end: 7,
        });
        expect(next).toBe("Bearer {{token}}");
        expect(caret).toBe("Bearer {{token}}".length);
    });
});
