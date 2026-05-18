"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS: { href: string; label: string }[] = [
    { href: "/analytics", label: "Overview" },
    { href: "/analytics/calls", label: "Call list" },
];

export function AnalyticsSubnav() {
    const pathname = usePathname() ?? "";
    return (
        <nav className="flex flex-wrap gap-2" aria-label="Analytics sections">
            {LINKS.map((item) => {
                const isOverview = item.href === "/analytics";
                const active = isOverview
                    ? pathname === "/analytics"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                            active
                                ? "border-foreground/25 bg-foreground/5 text-foreground"
                                : "border-border bg-card/50 text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground"
                        )}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
