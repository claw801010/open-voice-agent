import type { AnalyticsCallListItem } from "@/lib/analyticsCallsApi";

/** Escape a cell for RFC 4180-style CSV (comma-separated). */
export function escapeCsvCell(value: string): string {
    if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

const HEADERS = [
    "call_id",
    "workflow_id",
    "workflow_slug",
    "catalog_variant_id",
    "started_at",
    "duration_ms",
    "disposition",
    "outcome_key",
    "tool_names",
    "cx_score",
    "containment",
    "qa_score",
    "scorecard_pass_rate",
] as const;

function rowFromItem(item: AnalyticsCallListItem): string[] {
    const passRate = item.scorecard_pass_rate;
    return [
        item.call_id,
        String(item.workflow_id),
        item.workflow_slug ?? "",
        item.catalog_variant_id ?? "",
        item.started_at,
        String(item.duration_ms),
        item.disposition ?? "",
        item.outcome_key ?? "",
        (item.tool_names ?? []).join("; "),
        item.cx_score != null ? String(item.cx_score) : "",
        item.containment ?? "",
        item.qa_score != null ? String(item.qa_score) : "",
        passRate != null ? String(passRate) : "",
    ];
}

/** Build CSV text for analytics call list rows (UTF-8; BOM prefix optional for Excel). */
export function analyticsCallsToCsv(rows: AnalyticsCallListItem[], includeBom = true): string {
    const lines = [
        HEADERS.join(","),
        ...rows.map((r) => rowFromItem(r).map(escapeCsvCell).join(",")),
    ];
    const body = lines.join("\r\n");
    return includeBom ? `\uFEFF${body}` : body;
}

export function downloadAnalyticsCallsCsv(rows: AnalyticsCallListItem[], filenameBase = "analytics-calls"): void {
    if (rows.length === 0) return;
    const csv = analyticsCallsToCsv(rows, true);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `${filenameBase}-${stamp}.csv`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
