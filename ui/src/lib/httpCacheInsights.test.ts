import { describe, expect, it } from "vitest";

import { formatHttpCacheHitRate } from "./httpCacheInsights";

describe("formatHttpCacheHitRate", () => {
    it("returns null when no invocations", () => {
        expect(formatHttpCacheHitRate(0, 0)).toBeNull();
        expect(formatHttpCacheHitRate(undefined, 1)).toBeNull();
    });

    it("formats hits over invocations with rounded percent", () => {
        expect(formatHttpCacheHitRate(4, 1)).toBe("1 / 4 (25%)");
        expect(formatHttpCacheHitRate(3, 3)).toBe("3 / 3 (100%)");
    });
});
