/**
 * MK-01-REGISTRY — unified community catalog (verticals, tools, prompts, recipes).
 */

import registryJson from '../../../../catalog/community-registry.json';

import { getBackendPublicBaseUrl } from '@/lib/apiClient';

export type DistributionTier =
    | 'free'
    | 'community'
    | 'starter'
    | 'pro'
    | 'enterprise';

export type ListingDistribution = {
    tier: DistributionTier;
    price_usd_cents: number | null;
    currency?: string;
    license_spdx?: string;
    publisher_id?: string;
    certification?: string;
};

export type RegistryListing = {
    id: string;
    type: string;
    title: string;
    summary: string;
    tags?: string[];
    vertical_slugs?: string[];
    source_ref?: string;
    distribution: ListingDistribution;
    install?: Record<string, unknown>;
    assets?: Record<string, unknown>;
    quality?: Record<string, unknown>;
};

export type CommunityRegistry = {
    registry_version: number;
    generated_at?: string;
    description?: string;
    listing_count?: number;
    listing_types?: string[];
    publishers?: { id: string; display_name?: string; url?: string }[];
    listings: RegistryListing[];
};

export const DISTRIBUTION_TIERS: readonly DistributionTier[] = [
    'free',
    'community',
    'starter',
    'pro',
    'enterprise',
] as const;

export const TIER_LABELS: Record<DistributionTier, string> = {
    free: 'Free',
    community: 'Community',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
};

export function formatListingPrice(dist: ListingDistribution): string {
    if (dist.tier === 'enterprise' && dist.price_usd_cents == null) {
        return 'Contact sales';
    }
    const cents = dist.price_usd_cents ?? 0;
    if (cents <= 0) {
        return 'Free';
    }
    return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** Static import for tests, SSR, and offline browse when API is down. */
export function loadStaticCommunityRegistry(): CommunityRegistry {
    const raw = registryJson as CommunityRegistry;
    return {
        registry_version: raw.registry_version ?? 1,
        generated_at: raw.generated_at,
        description: raw.description,
        listing_count: raw.listing_count ?? raw.listings?.length ?? 0,
        listing_types: raw.listing_types ?? [],
        publishers: raw.publishers ?? [],
        listings: raw.listings ?? [],
    };
}

export function verticalPackListingId(slug: string): string {
    return `vertical_pack:${slug}`;
}

export function indexVerticalPackDistribution(
    registry: CommunityRegistry,
): Map<string, ListingDistribution> {
    const map = new Map<string, ListingDistribution>();
    for (const row of registry.listings) {
        if (row.type === 'vertical_pack' && row.id.startsWith('vertical_pack:')) {
            const slug = row.id.slice('vertical_pack:'.length);
            map.set(slug, row.distribution);
        }
    }
    return map;
}

export function filterRegistryListings(
    registry: CommunityRegistry,
    opts: {
        types?: string[];
        tier?: DistributionTier | 'all';
        q?: string;
        excludeTypes?: string[];
    },
): RegistryListing[] {
    const q = (opts.q ?? '').trim().toLowerCase();
    const typeSet = opts.types?.length ? new Set(opts.types) : null;
    const exclude = new Set(opts.excludeTypes ?? []);
    return registry.listings.filter((row) => {
        if (exclude.has(row.type)) return false;
        if (typeSet && !typeSet.has(row.type)) return false;
        if (opts.tier && opts.tier !== 'all' && row.distribution?.tier !== opts.tier) {
            return false;
        }
        if (q) {
            const hay = [row.id, row.type, row.title, row.summary, ...(row.tags ?? [])]
                .join(' ')
                .toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}

export type RegistryBrowsePage = {
    registry_version: number;
    generated_at?: string | null;
    total: number;
    limit: number;
    offset: number;
    listing_types: string[];
    publishers: CommunityRegistry['publishers'];
    listings: RegistryListing[];
};

export async function fetchCommunityRegistry(opts?: {
    type?: string;
    tier?: string;
    q?: string;
    limit?: number;
    offset?: number;
}): Promise<RegistryBrowsePage> {
    const q = new URLSearchParams();
    if (opts?.type) q.set('type', opts.type);
    if (opts?.tier) q.set('tier', opts.tier);
    if (opts?.q) q.set('q', opts.q);
    q.set('limit', String(opts?.limit ?? 200));
    q.set('offset', String(opts?.offset ?? 0));
    const res = await fetch(`${getBackendPublicBaseUrl()}/api/v1/catalog/registry?${q}`, {
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
        throw new Error(`Registry unavailable (${res.status})`);
    }
    return res.json() as Promise<RegistryBrowsePage>;
}

export const LIBRARY_LISTING_TYPES = [
    'recipe',
    'best_practice',
    'tool_stub',
    'prompt_pack',
    'inference_profile',
    'governance_policy',
    'skill_import',
    'native_tool_template',
    'workflow_variant',
    'capability_module',
] as const;

export function listingTypeLabel(type: string): string {
    return type.replace(/_/g, ' ');
}
