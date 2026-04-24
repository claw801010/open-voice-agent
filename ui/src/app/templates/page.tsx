import { MarketplaceCatalog } from '@/components/catalog/MarketplaceCatalog';
import type { CatalogJson } from '@/lib/catalog/filterVerticalPacks';

async function loadCatalog(): Promise<{ catalog: CatalogJson | null; error: string | null }> {
    const base =
        process.env.BACKEND_URL || process.env.INTERNAL_API_URL || 'http://127.0.0.1:8000';
    try {
        const res = await fetch(`${base.replace(/\/$/, '')}/api/v1/catalog/vertical-packs`, {
            next: { revalidate: 300 },
            headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
            return { catalog: null, error: `Catalog unavailable (${res.status})` };
        }
        const data = (await res.json()) as CatalogJson;
        if (!data?.packs) {
            return { catalog: null, error: 'Invalid catalog response' };
        }
        return { catalog: data, error: null };
    } catch {
        return {
            catalog: null,
            error: 'Could not reach the API to load the catalog. Ensure the backend is running or set BACKEND_URL.',
        };
    }
}

/**
 * Public, SEO-oriented browse surface for MK-01-BROWSE (optional static-friendly route).
 * Install requires signing in via /workflow/catalog.
 */
export default async function PublicTemplatesPage() {
    const { catalog, error } = await loadCatalog();

    return (
        <main className="min-h-screen bg-background">
            <MarketplaceCatalog
                catalog={catalog}
                loadError={error}
                installable={false}
                title="Voice workflow templates"
                subtitle="Browse industry packs before you sign in—filters match industry, use case, language, and compliance. After you sign in, install copies a pack into your org for Web tests; add phone numbers when you are ready for PSTN."
            />
        </main>
    );
}
