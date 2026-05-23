"use client";

import { BarChart3, BookOpen, Bot, Settings2, Sparkles } from "lucide-react";
import Link from "next/link";

import { GitHubStarBadge } from "@/components/layout/GitHubStarBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

export default function OverviewPage() {
    const { user, provider } = useAuth();
    const isOSSMode = provider !== "stack";

    return (
        <div className="container mx-auto max-w-7xl px-4 py-8 pb-16 space-y-10">
            <section
                className="ovo-usage-hero px-6 py-8 md:px-10 md:py-10"
                aria-labelledby="overview-dashboard-title"
            >
                <div
                    className="ovo-hero-glow -right-16 -top-20 h-56 w-56 bg-primary/25 dark:bg-chart-2/30 ovo-motion-safe-glow"
                    aria-hidden
                />
                <div
                    className="ovo-hero-glow left-1/4 bottom-0 h-40 w-72 bg-chart-4/20 dark:bg-chart-4/25 ovo-motion-safe-glow"
                    style={{ animationDelay: "-4s" }}
                    aria-hidden
                />
                <div className="relative z-[1] grid gap-8 lg:grid-cols-12 lg:items-end">
                    <div className="space-y-4 lg:col-span-7">
                        <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground shadow-sm backdrop-blur-sm dark:bg-background/30">
                            <Sparkles
                                className="h-3.5 w-3.5 shrink-0 text-primary motion-safe:animate-spin-slow"
                                aria-hidden
                            />
                            Home
                        </p>
                        <h1
                            id="overview-dashboard-title"
                            className="text-4xl font-bold tracking-tight text-balance md:text-5xl"
                        >
                            {isOSSMode
                                ? "Welcome to Dograh"
                                : `Welcome${user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}!`}
                        </h1>
                        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                            {isOSSMode
                                ? "Open source voice AI for builders and operators. Star the project on GitHub, then jump into agents, templates, or analytics."
                                : "Build and operate voice AI workflows—agents, telephony, templates, and call analytics in one place."}
                        </p>
                    </div>
                    {isOSSMode ? (
                        <div className="ovo-glass-panel p-4 sm:p-5 lg:col-span-5">
                            <p className="mb-3 text-xs font-medium text-muted-foreground">Support the project</p>
                            <GitHubStarBadge label="Star us on GitHub" showCount source="overview_page" />
                        </div>
                    ) : null}
                </div>
            </section>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card className="ovo-bento-cell border-0 bg-transparent shadow-none">
                    <CardHeader>
                        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/40">
                            <Bot className="h-4 w-4 text-primary" aria-hidden />
                        </div>
                        <CardTitle>Voice agents</CardTitle>
                        <CardDescription>
                            Build and manage AI voice agents with the visual workflow editor
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild>
                            <Link href="/workflow">Go to agents</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="ovo-bento-cell border-0 bg-transparent shadow-none">
                    <CardHeader>
                        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/40">
                            <Settings2 className="h-4 w-4 text-primary" aria-hidden />
                        </div>
                        <CardTitle>Configure services</CardTitle>
                        <CardDescription>
                            Set up LLM, TTS, and STT providers for your organization
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline">
                            <Link href="/model-configurations">Configure models</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="ovo-bento-cell border-0 bg-transparent shadow-none">
                    <CardHeader>
                        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/40">
                            <BarChart3 className="h-4 w-4 text-primary" aria-hidden />
                        </div>
                        <CardTitle>Usage & analytics</CardTitle>
                        <CardDescription>
                            Monitor tokens, call trends, and MK-01 call intelligence dashboards
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                            <Link href="/usage">Usage</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/analytics">Analytics</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="ovo-bento-cell border-0 bg-transparent shadow-none">
                    <CardHeader>
                        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/40">
                            <BookOpen className="h-4 w-4 text-primary" aria-hidden />
                        </div>
                        <CardTitle>Resources</CardTitle>
                        <CardDescription>Documentation, templates, and community support</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                            <Link href="/workflow/catalog">Template catalog</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <a
                                href="https://docs.dograh.com"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Documentation
                            </a>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <a
                                href="https://github.com/dograh-hq/dograh/issues"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Report an issue
                            </a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
