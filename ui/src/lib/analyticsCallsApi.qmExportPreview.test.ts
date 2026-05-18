import { describe, expect, it } from "vitest";

import { previewNextQmExportDispatchUtc } from "./analyticsCallsApi";

describe("previewNextQmExportDispatchUtc", () => {
    it("returns null when disabled or cron off", () => {
        const now = new Date("2026-05-08T12:00:00.000Z");
        expect(
            previewNextQmExportDispatchUtc({
                now,
                hourUtc: 6,
                enabled: false,
                cronEnabled: true,
            }),
        ).toBeNull();
        expect(
            previewNextQmExportDispatchUtc({
                now,
                hourUtc: 6,
                enabled: true,
                cronEnabled: false,
            }),
        ).toBeNull();
    });

    it("uses same UTC hour before :47", () => {
        const now = new Date("2026-05-08T06:30:00.000Z");
        expect(
            previewNextQmExportDispatchUtc({
                now,
                hourUtc: 6,
                enabled: true,
                cronEnabled: true,
                cronMinuteUtc: 47,
            }),
        ).toBe("2026-05-08T06:47:00.000Z");
    });

    it("rolls to next day after :47 in that hour", () => {
        const now = new Date("2026-05-08T06:48:00.000Z");
        expect(
            previewNextQmExportDispatchUtc({
                now,
                hourUtc: 6,
                enabled: true,
                cronEnabled: true,
                cronMinuteUtc: 47,
            }),
        ).toBe("2026-05-09T06:47:00.000Z");
    });

    it("targets later hour same calendar day", () => {
        const now = new Date("2026-05-08T05:50:00.000Z");
        expect(
            previewNextQmExportDispatchUtc({
                now,
                hourUtc: 6,
                enabled: true,
                cronEnabled: true,
                cronMinuteUtc: 47,
            }),
        ).toBe("2026-05-08T06:47:00.000Z");
    });
});
