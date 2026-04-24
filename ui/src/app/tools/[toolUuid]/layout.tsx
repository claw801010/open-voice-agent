"use client";

import { UnsavedChangesProvider } from "@/context/UnsavedChangesContext";

/**
 * Enables shared unsaved-changes guards (link clicks, back/forward, beforeunload)
 * for the tool editor — see WE-01-DUALMODE follow-up.
 */
export default function ToolDetailLayout({ children }: { children: React.ReactNode }) {
    return <UnsavedChangesProvider>{children}</UnsavedChangesProvider>;
}
