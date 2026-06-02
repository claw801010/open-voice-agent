/**
 * Custom analytics dashboard (MK-01-ANALYTICS-VERTICAL Phase D-lite).
 * Org-backed JSON via `GET/PUT /api/v1/analytics/dashboard-layout`; localStorage mirrors for offline cache.
 */
export type AnalyticsWidgetType =
    | "kpi_row"
    | "quality_rollup"
    | "outcome_top"
    | "dive_deeper"
    | "vertical_shortcuts"
    | "revenue_motions";

export type AnalyticsDashboardWidget = {
    id: string;
    type: AnalyticsWidgetType;
};

const STORAGE_KEY = "analytics-custom-dashboard-v1";
const LAYOUT_VERSION = 1 as const;

type StoredLayout = {
    v: typeof LAYOUT_VERSION;
    widgets: AnalyticsDashboardWidget[];
};

function newId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `w-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const WIDGET_META: Record<
    AnalyticsWidgetType,
    { title: string; description: string }
> = {
    kpi_row: {
        title: "KPI row",
        description:
            "Total calls, outcomes, tool trace breadth (logged function calls), outcome share, top tools by call.",
    },
    quality_rollup: {
        title: "CX & containment",
        description:
            "Org roll-up: average CX score, containment mix, QA coverage, and tool-function success rates.",
    },
    outcome_top: {
        title: "Top outcomes",
        description: "Breakdown of outcome_key / customer_outcome buckets (up to 20).",
    },
    dive_deeper: {
        title: "APIs & call list",
        description: "REST entry points and link to the filterable call list.",
    },
    vertical_shortcuts: {
        title: "Vertical shortcuts",
        description: "Prebuild catalog slugs — open this dashboard or the call list filtered by template.",
    },
    revenue_motions: {
        title: "Revenue & booking (roadmap vs shipped)",
        description: "Motions to pair with vertical packs: booking, upsell, renewals, no-show (honest status).",
    },
};

const DEFAULT_TYPES: readonly AnalyticsWidgetType[] = [
    "kpi_row",
    "quality_rollup",
    "outcome_top",
    "dive_deeper",
    "vertical_shortcuts",
    "revenue_motions",
] as const;

export function defaultWidgetLayout(): AnalyticsDashboardWidget[] {
    return DEFAULT_TYPES.map((type) => ({ id: newId(), type }));
}

/** Known MK-01 catalog slugs — widget order tuned for booking + revenue storytelling vs generic default order. */
const CATALOG_SLUG_WIDGET_PRESETS: Record<string, readonly AnalyticsWidgetType[]> = {
    "healthcare-clinic-screening": [
        "kpi_row",
        "quality_rollup",
        "outcome_top",
        "revenue_motions",
        "dive_deeper",
        "vertical_shortcuts",
    ],
    "retail-wismo-faq": [
        "kpi_row",
        "quality_rollup",
        "outcome_top",
        "revenue_motions",
        "vertical_shortcuts",
        "dive_deeper",
    ],
    "b2b-saas-trial-nurture": [
        "kpi_row",
        "quality_rollup",
        "outcome_top",
        "revenue_motions",
        "dive_deeper",
        "vertical_shortcuts",
    ],
    "insurance-fnol-faq": [
        "kpi_row",
        "quality_rollup",
        "outcome_top",
        "revenue_motions",
        "dive_deeper",
        "vertical_shortcuts",
    ],
    "hospitality-travel-concierge": [
        "kpi_row",
        "quality_rollup",
        "outcome_top",
        "revenue_motions",
        "vertical_shortcuts",
        "dive_deeper",
    ],
    "financial-services-banking-faq": [
        "kpi_row",
        "quality_rollup",
        "outcome_top",
        "revenue_motions",
        "dive_deeper",
        "vertical_shortcuts",
    ],
    "smb-franchise-location-faq": [
        "kpi_row",
        "quality_rollup",
        "outcome_top",
        "revenue_motions",
        "vertical_shortcuts",
        "dive_deeper",
    ],
    "telecom-utilities-outage-faq": [
        "kpi_row",
        "quality_rollup",
        "outcome_top",
        "revenue_motions",
        "dive_deeper",
        "vertical_shortcuts",
    ],
    "public-sector-civic-services-faq": [
        "kpi_row",
        "quality_rollup",
        "outcome_top",
        "revenue_motions",
        "dive_deeper",
        "vertical_shortcuts",
    ],
    "hr-staffing-recruiting-faq": [
        "kpi_row",
        "quality_rollup",
        "outcome_top",
        "revenue_motions",
        "dive_deeper",
        "vertical_shortcuts",
    ],
};

export function buildWidgetLayoutFromTypes(types: readonly AnalyticsWidgetType[]): AnalyticsDashboardWidget[] {
    return types.map((type) => ({ id: newId(), type }));
}

/** Same widget types in the same order (ids ignored). */
export function widgetTypeOrderEquals(a: AnalyticsDashboardWidget[], b: AnalyticsDashboardWidget[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((w, i) => w.type === b[i]!.type);
}

/** True when the board matches the generic default type order (not a vertical-specific preset). */
export function isGenericDefaultWidgetLayout(widgets: AnalyticsDashboardWidget[]): boolean {
    if (widgets.length !== DEFAULT_TYPES.length) return false;
    return widgets.every((w, i) => w.type === DEFAULT_TYPES[i]);
}

/**
 * When the Overview is filtered by a known vertical `catalog_slug`, return a suggested widget order
 * (all five card types; booking/revenue cards earlier). Applied via **Apply vertical preset** or auto when
 * the URL includes `catalog_slug` and the board is still the generic default.
 */
export function widgetPresetForCatalogSlug(slug: string | null | undefined): AnalyticsDashboardWidget[] | null {
    const s = (slug || "").trim();
    if (!s) return null;
    const types = CATALOG_SLUG_WIDGET_PRESETS[s];
    if (!types) return null;
    return buildWidgetLayoutFromTypes(types);
}

function isWidgetType(s: string): s is AnalyticsWidgetType {
    return s in WIDGET_META;
}

/** Parses API `layout` JSON or any object-shaped payload (same validation as localStorage). */
export function parseDashboardLayoutPayload(raw: unknown): AnalyticsDashboardWidget[] | null {
    if (raw == null || typeof raw !== "object" || !("v" in raw) || (raw as StoredLayout).v !== LAYOUT_VERSION) {
        return null;
    }
    const w = (raw as StoredLayout).widgets;
    if (!Array.isArray(w) || w.length === 0) return null;
    const out: AnalyticsDashboardWidget[] = [];
    for (const item of w) {
        if (item == null || typeof item !== "object" || !("id" in item) || !("type" in item)) continue;
        const id = String((item as AnalyticsDashboardWidget).id).trim();
        const type = (item as AnalyticsDashboardWidget).type;
        if (!id || !isWidgetType(type)) continue;
        out.push({ id, type });
    }
    return out.length > 0 ? out : null;
}

function safeParseLayout(raw: string | null): AnalyticsDashboardWidget[] | null {
    if (!raw) return null;
    try {
        const p = JSON.parse(raw) as unknown;
        return parseDashboardLayoutPayload(p);
    } catch {
        return null;
    }
}

export function loadDashboardLayout(): AnalyticsDashboardWidget[] {
    if (typeof window === "undefined") return defaultWidgetLayout();
    return safeParseLayout(window.localStorage.getItem(STORAGE_KEY)) ?? defaultWidgetLayout();
}

export function saveDashboardLayout(widgets: AnalyticsDashboardWidget[]): void {
    if (typeof window === "undefined") return;
    const body: StoredLayout = { v: LAYOUT_VERSION, widgets };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(body));
}

export function addWidgetToLayout(
    current: AnalyticsDashboardWidget[],
    type: AnalyticsWidgetType
): AnalyticsDashboardWidget[] {
    if (current.some((w) => w.type === type)) return current;
    return [...current, { id: newId(), type }];
}

export function removeWidgetById(
    current: AnalyticsDashboardWidget[],
    instanceId: string
): AnalyticsDashboardWidget[] {
    return current.filter((w) => w.id !== instanceId);
}

export const ALL_WIDGET_TYPES = Object.keys(WIDGET_META) as AnalyticsWidgetType[];

export function getAvailableToAdd(current: AnalyticsDashboardWidget[]): AnalyticsWidgetType[] {
    const have = new Set(current.map((w) => w.type));
    return ALL_WIDGET_TYPES.filter((t) => !have.has(t));
}
