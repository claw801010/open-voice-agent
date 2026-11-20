'use client';

import { BookOpen, ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CatalogBuyerHintTip } from '@/components/catalog/CatalogBuyerHintTip';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BUILDER_RECIPES, type BuilderRecipe } from '@/lib/recipes/builderRecipes';

type Props = {
    variant?: 'compact' | 'full';
    showTitle?: boolean;
};

function RecipeCard({ recipe, compact }: { recipe: BuilderRecipe; compact: boolean }) {
    return (
        <Card className="ovo-bento-cell border border-border/80 bg-card/40 shadow-none">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">{recipe.title}</CardTitle>
                <CardDescription>{recipe.outcome}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/90">Primary API:</span>{' '}
                    <code className="text-[11px]">{recipe.primaryApi}</code>
                </p>
                {!compact ? (
                    <>
                        <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/90">Env:</span>{' '}
                            {recipe.envVars.join(' · ')}
                        </p>
                        <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                            {recipe.steps.map((step) => (
                                <li key={step}>{step}</li>
                            ))}
                        </ol>
                    </>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/recipes#${recipe.id}`}>Open recipe</Link>
                    </Button>
                    <CatalogBuyerHintTip
                        tip={`${recipe.tier}. Full copy-paste steps live in ${recipe.repoDocPath} in the repo.`}
                        label="Repo doc"
                    />
                </div>
            </CardContent>
        </Card>
    );
}

/** Builder-tier integration recipes (embed, PSTN, campaigns). */
export function BuilderRecipesPanel({ variant = 'compact', showTitle = true }: Props) {
    const compact = variant === 'compact';

    return (
        <section data-testid="builder-recipes-panel" aria-labelledby={showTitle ? 'builder-recipes-title' : undefined}>
            {showTitle ? (
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <h2 id="builder-recipes-title" className="flex items-center gap-2 text-lg font-semibold">
                            <BookOpen className="h-5 w-5 text-primary" aria-hidden />
                            Integration recipes
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
                            Minimal-code paths for going live — env vars, API routes, and checklists. OpenAPI:{' '}
                            <code className="text-xs">GET /api/v1/openapi.json</code>
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-1.5" asChild>
                        <a
                            href="https://docs.dograh.com"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            API docs <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    </Button>
                </div>
            ) : null}
            <TooltipProvider delayDuration={300}>
                <div className={compact ? 'grid gap-4 md:grid-cols-3' : 'grid gap-6'}>
                    {BUILDER_RECIPES.map((recipe) => (
                        <RecipeCard key={recipe.id} recipe={recipe} compact={compact} />
                    ))}
                </div>
            </TooltipProvider>
        </section>
    );
}
