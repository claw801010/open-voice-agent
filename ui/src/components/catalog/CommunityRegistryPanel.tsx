'use client';

import { useMemo, useState } from 'react';

import { CatalogDistributionBadge } from '@/components/catalog/CatalogDistributionBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    DISTRIBUTION_TIERS,
    filterRegistryListings,
    listingTypeLabel,
    type CommunityRegistry,
    type DistributionTier,
    type RegistryListing,
} from '@/lib/catalog/communityRegistry';

type CommunityRegistryPanelProps = {
    registry: CommunityRegistry;
};

export function CommunityRegistryPanel({ registry }: CommunityRegistryPanelProps) {
    const [tier, setTier] = useState<DistributionTier | 'all'>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [q, setQ] = useState('');

    const rows = useMemo(
        () =>
            filterRegistryListings(registry, {
                tier,
                q,
                excludeTypes: ['vertical_pack'],
                types: typeFilter === 'all' ? undefined : [typeFilter],
            }),
        [registry, tier, typeFilter, q],
    );

    const typeOptions = useMemo(() => {
        const types = new Set<string>();
        for (const row of registry.listings) {
            if (row.type !== 'vertical_pack') types.add(row.type);
        }
        return [...types].sort();
    }, [registry.listings]);

    return (
        <section className="space-y-4" data-testid="community-registry-panel">
            <p className="text-sm text-muted-foreground max-w-3xl">
                Browse tools, prompts, recipes, inference stacks, and governance policies from the
                unified community registry — shareable today, priced tiers ready for marketplace
                checkout later.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="registry-q">
                        Search
                    </label>
                    <Input
                        id="registry-q"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="FAQ, book_slot, local scheduling…"
                        className="mt-1"
                        data-testid="registry-search"
                    />
                </div>
                <div>
                    <span className="text-xs font-medium text-muted-foreground">Tier</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                        <Button
                            type="button"
                            size="sm"
                            variant={tier === 'all' ? 'default' : 'outline'}
                            onClick={() => setTier('all')}
                        >
                            All
                        </Button>
                        {DISTRIBUTION_TIERS.map((t) => (
                            <Button
                                key={t}
                                type="button"
                                size="sm"
                                variant={tier === t ? 'default' : 'outline'}
                                onClick={() => setTier(t)}
                                data-testid={`registry-tier-${t}`}
                            >
                                {t}
                            </Button>
                        ))}
                    </div>
                </div>
                <div>
                    <span className="text-xs font-medium text-muted-foreground">Type</span>
                    <div className="mt-1 flex flex-wrap gap-1 max-w-xl">
                        <Button
                            type="button"
                            size="sm"
                            variant={typeFilter === 'all' ? 'default' : 'outline'}
                            onClick={() => setTypeFilter('all')}
                        >
                            All
                        </Button>
                        {typeOptions.map((t) => (
                            <Button
                                key={t}
                                type="button"
                                size="sm"
                                variant={typeFilter === t ? 'default' : 'outline'}
                                onClick={() => setTypeFilter(t)}
                            >
                                {listingTypeLabel(t)}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            <p className="text-sm text-muted-foreground">
                Showing {rows.length} community assets
                {registry.generated_at
                    ? ` · registry built ${new Date(registry.generated_at).toLocaleDateString()}`
                    : ''}
            </p>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {rows.slice(0, 60).map((row) => (
                    <RegistryListingCard key={row.id} row={row} />
                ))}
            </div>
            {rows.length > 60 ? (
                <p className="text-xs text-muted-foreground">
                    Showing first 60 of {rows.length}. Narrow filters or use{' '}
                    <code className="text-[10px]">GET /api/v1/catalog/registry/export</code> for the
                    full bundle.
                </p>
            ) : null}
            {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No listings match these filters.</p>
            ) : null}
        </section>
    );
}

function RegistryListingCard({ row }: { row: RegistryListing }) {
    return (
        <Card className="h-full border-border/60" data-testid={`registry-listing-${row.id}`}>
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{row.title}</CardTitle>
                    <CatalogDistributionBadge distribution={row.distribution} />
                </div>
                <CardDescription className="text-xs uppercase tracking-wide">
                    {listingTypeLabel(row.type)}
                </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
                <p className="line-clamp-3">{row.summary}</p>
                {row.source_ref ? (
                    <p className="text-[10px] font-mono text-muted-foreground/80 truncate">
                        {row.source_ref}
                    </p>
                ) : null}
                {row.distribution.license_spdx ? (
                    <p className="text-[10px] text-muted-foreground">
                        License: {row.distribution.license_spdx}
                    </p>
                ) : null}
            </CardContent>
        </Card>
    );
}
