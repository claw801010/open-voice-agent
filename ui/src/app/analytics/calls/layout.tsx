import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Call analytics",
    description: "Filterable call list and per-call outcomes, metrics, and HTTP tool traces.",
};

export default function AnalyticsCallsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
