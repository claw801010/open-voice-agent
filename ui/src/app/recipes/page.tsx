'use client';

import Link from 'next/link';

import { BuilderRecipesPanel } from '@/components/recipes/BuilderRecipesPanel';
import { DismissibleHintBanner } from '@/components/onboarding/DismissibleHintBanner';
import { Button } from '@/components/ui/button';
import { BUILDER_RECIPES } from '@/lib/recipes/builderRecipes';
import { DISMISSIBLE_HINT_KEYS } from '@/lib/onboarding/dismissibleHints';

export default function RecipesPage() {
    return (
        <div className="container mx-auto max-w-5xl space-y-8 px-4 py-8 pb-16">
            <header className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Builder tier · DX-01
                </p>
                <h1 className="text-3xl font-bold tracking-tight">Integration recipes</h1>
                <p className="max-w-2xl text-muted-foreground">
                    Copy-paste friendly setup for embed widgets, inbound PSTN, and outbound campaigns. Tier 3
                    developers: see READMEADK for MCP and full REST.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/workflow/catalog">Template catalog</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/settings">Platform settings</Link>
                    </Button>
                </div>
            </header>

            <DismissibleHintBanner
                hintKey={DISMISSIBLE_HINT_KEYS.settingsRecipes}
                title="Before you wire production"
                data-testid="recipes-page-hint"
            >
                <p>
                    Publish a workflow first, then pick a recipe. For catalog demos, use{' '}
                    <strong className="font-medium text-foreground">Simulation → Start Web test</strong> (no PSTN) before
                    pointing carriers or embed domains at your API.
                </p>
            </DismissibleHintBanner>

            <BuilderRecipesPanel variant="full" showTitle={false} />

            <nav className="text-sm text-muted-foreground" aria-label="Recipe anchors">
                <p className="font-medium text-foreground mb-2">On this page</p>
                <ul className="space-y-1">
                    {BUILDER_RECIPES.map((r) => (
                        <li key={r.id}>
                            <a href={`#${r.id}`} className="underline-offset-2 hover:underline">
                                {r.title}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>

            {BUILDER_RECIPES.map((recipe) => (
                <article
                    key={recipe.id}
                    id={recipe.id}
                    className="scroll-mt-24 rounded-lg border border-border/80 bg-muted/15 p-6 space-y-3"
                >
                    <h2 className="text-xl font-semibold">{recipe.title}</h2>
                    <p className="text-sm text-muted-foreground">{recipe.outcome}</p>
                    <p className="text-xs">
                        <span className="text-muted-foreground">Primary:</span>{' '}
                        <code>{recipe.primaryApi}</code>
                    </p>
                    <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/90">Environment:</span>{' '}
                        {recipe.envVars.join(' · ')}
                    </p>
                    <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                        {recipe.steps.map((step) => (
                            <li key={step}>{step}</li>
                        ))}
                    </ol>
                    <p className="text-xs text-muted-foreground">
                        Full markdown: <code>{recipe.repoDocPath}</code> in the repository.
                    </p>
                </article>
            ))}
        </div>
    );
}
