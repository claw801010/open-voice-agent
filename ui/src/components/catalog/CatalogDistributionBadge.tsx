import { Badge } from '@/components/ui/badge';
import {
    formatListingPrice,
    type ListingDistribution,
    TIER_LABELS,
    type DistributionTier,
} from '@/lib/catalog/communityRegistry';
import { cn } from '@/lib/utils';

const TIER_STYLES: Record<DistributionTier, string> = {
    free: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    community: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    starter: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200',
    pro: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    enterprise: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

type CatalogDistributionBadgeProps = {
    distribution: ListingDistribution;
    showPrice?: boolean;
    className?: string;
    'data-testid'?: string;
};

export function CatalogDistributionBadge({
    distribution,
    showPrice = true,
    className,
    'data-testid': testId,
}: CatalogDistributionBadgeProps) {
    const tier = distribution.tier;
    const tierStyle = TIER_STYLES[tier] ?? TIER_STYLES.free;
    const price = formatListingPrice(distribution);

    return (
        <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
            <Badge
                variant="outline"
                className={cn('text-[10px] font-semibold uppercase tracking-wide', tierStyle)}
                data-testid={testId ?? `catalog-tier-${tier}`}
            >
                {TIER_LABELS[tier] ?? tier}
            </Badge>
            {showPrice ? (
                <span className="text-[10px] font-medium text-muted-foreground">{price}</span>
            ) : null}
        </span>
    );
}
