import { Suspense } from "react";

import SpinLoader from "@/components/SpinLoader";

import AnalyticsCallsListContent from "./AnalyticsCallsListContent";

export default function AnalyticsCallsListPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-[40vh] items-center justify-center p-8">
                    <SpinLoader />
                </div>
            }
        >
            <AnalyticsCallsListContent />
        </Suspense>
    );
}
