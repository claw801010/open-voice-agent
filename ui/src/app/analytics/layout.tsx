import type { Metadata } from "next";

import { AnalyticsSubnav } from "./AnalyticsSubnav";

export const metadata: Metadata = {
    title: "Analytics",
    description: "Call outcomes, org rollups, and HTTP tool trace insights.",
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 pb-10 md:p-6">
            <header className="space-y-2 border-b border-border pb-4">
                <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
                <p className="text-sm text-muted-foreground">
                    Outcome rollups for the selected period, a filterable call list, and per-call metrics with API tool
                    traces.
                </p>
                <AnalyticsSubnav />
            </header>
            {children}
        </div>
    );
}
