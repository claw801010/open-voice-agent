import { describe, expect, it } from "vitest";

import catalog from "../../../catalog/vertical-packs.json";

import {
    addWidgetToLayout,
    defaultWidgetLayout,
    getAvailableToAdd,
    isGenericDefaultWidgetLayout,
    loadDashboardLayout,
    removeWidgetById,
    widgetPresetForCatalogSlug,
    widgetTypeOrderEquals,
} from "./analyticsDashboardLayout";

describe("analyticsDashboardLayout", () => {

    it("defaultWidgetLayout has all widget types once", () => {
        const d = defaultWidgetLayout();
        const types = d.map((w) => w.type);
        expect(new Set(types).size).toBe(types.length);
        expect(types.length).toBeGreaterThan(0);
    });

    it("addWidgetToLayout does not duplicate a type already on the board", () => {
        const a = defaultWidgetLayout();
        const again = addWidgetToLayout(a, a[0].type);
        expect(again.length).toBe(a.length);
    });

    it("removeWidgetById drops the instance", () => {
        const a = defaultWidgetLayout();
        const r = removeWidgetById(a, a[0].id);
        expect(r.length).toBe(a.length - 1);
    });

    it("getAvailableToAdd is empty when board is full", () => {
        const a = defaultWidgetLayout();
        expect(getAvailableToAdd(a).length).toBe(0);
    });

    it("loadDashboardLayout returns default when storage empty", () => {
        expect(loadDashboardLayout().length).toBe(defaultWidgetLayout().length);
    });

    it("widgetPresetForCatalogSlug returns null for unknown slug", () => {
        expect(widgetPresetForCatalogSlug(null)).toBeNull();
        expect(widgetPresetForCatalogSlug("")).toBeNull();
        expect(widgetPresetForCatalogSlug("unknown-pack")).toBeNull();
    });

    it("widgetPresetForCatalogSlug returns six widgets for healthcare slug", () => {
        const p = widgetPresetForCatalogSlug("healthcare-clinic-screening");
        expect(p).not.toBeNull();
        expect(p!.length).toBe(6);
        expect(p!.map((w) => w.type)[0]).toBe("kpi_row");
        expect(p!.map((w) => w.type)).toContain("revenue_motions");
    });

    it("every vertical-packs.json slug has a dashboard widget preset", () => {
        for (const pack of catalog.packs) {
            const preset = widgetPresetForCatalogSlug(pack.slug);
            expect(preset, `missing CATALOG_SLUG_WIDGET_PRESETS entry for ${pack.slug}`).not.toBeNull();
            expect(preset!.length).toBe(6);
        }
    });

    it("isGenericDefaultWidgetLayout matches default type order only", () => {
        const d = defaultWidgetLayout();
        expect(isGenericDefaultWidgetLayout(d)).toBe(true);
        const preset = widgetPresetForCatalogSlug("healthcare-clinic-screening");
        expect(preset).not.toBeNull();
        expect(isGenericDefaultWidgetLayout(preset!)).toBe(false);
    });

    it("widgetTypeOrderEquals ignores widget ids", () => {
        const a = defaultWidgetLayout();
        const b = a.map((w) => ({ ...w, id: `copy-${w.id}` }));
        expect(widgetTypeOrderEquals(a, b)).toBe(true);
    });
});
