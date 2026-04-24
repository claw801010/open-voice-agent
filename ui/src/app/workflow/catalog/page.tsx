'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { MarketplaceCatalog } from '@/components/catalog/MarketplaceCatalog';
import { getVerticalPacksCatalogApiV1CatalogVerticalPacksGet } from '@/client/sdk.gen';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import type { CatalogJson } from '@/lib/catalog/filterVerticalPacks';
import logger from '@/lib/logger';

import WorkflowLayout from '../WorkflowLayout';

export default function WorkflowCatalogPage() {
    const { user, redirectToLogin, loading: authLoading } = useAuth();
    const [catalog, setCatalog] = useState<CatalogJson | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            redirectToLogin();
        }
    }, [authLoading, user, redirectToLogin]);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await getVerticalPacksCatalogApiV1CatalogVerticalPacksGet({});
                const data = res.data as CatalogJson | undefined;
                if (data?.packs) {
                    setCatalog(data);
                } else {
                    setLoadError('Invalid catalog response');
                }
            } catch (e) {
                logger.error(`Catalog load failed: ${e}`);
                setLoadError('Could not load catalog');
            }
        };
        load();
    }, []);

    if (authLoading || !user) {
        return (
            <WorkflowLayout showFeaturesNav>
                <div className="container mx-auto px-4 py-8 text-muted-foreground">Loading…</div>
            </WorkflowLayout>
        );
    }

    return (
        <WorkflowLayout showFeaturesNav>
            <MarketplaceCatalog
                catalog={catalog}
                loadError={loadError}
                installable
                title="Template catalog"
                subtitle="Each pack is a ready-made voice workflow for a common business scenario. Install copies it into your organization so you can run Web tests right away; add phone numbers when you are ready for PSTN."
                backButton={
                    <Button variant="outline" asChild>
                        <Link href="/workflow">Back to agents</Link>
                    </Button>
                }
            />
        </WorkflowLayout>
    );
}
