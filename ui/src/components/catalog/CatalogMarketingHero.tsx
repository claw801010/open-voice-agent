'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';

type CatalogMarketingHeroProps = {
    installable: boolean;
};

export function CatalogMarketingHero({ installable }: CatalogMarketingHeroProps) {
    return (
        <section
            className="ovo-glass-panel mb-8 px-5 py-6 sm:px-8 sm:py-8"
            data-testid="catalog-marketing-hero"
        >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Voice AI templates
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                Industry packs that run local-first — no API keys required
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
                14 vertical workflows, composable capabilities, and a community registry of tools, prompts, and
                recipes. Listen to a voice preview, browse free tiers, or sign in to install and test in your browser.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
                {installable ? (
                    <>
                        <Button size="sm" asChild>
                            <Link href="/workflow/create">Create with AI</Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                            <Link href="/overview">Resume setup</Link>
                        </Button>
                    </>
                ) : (
                    <>
                        <Button size="sm" asChild data-testid="catalog-hero-sign-in">
                            <Link href="/auth/login?redirect=/workflow/catalog">Sign in to install</Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                            <Link href="/auth/signup?redirect=/overview">Sign up — guided setup</Link>
                        </Button>
                    </>
                )}
            </div>
        </section>
    );
}
