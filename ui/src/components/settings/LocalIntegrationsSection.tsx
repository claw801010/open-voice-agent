'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/lib/auth';
import {
    fetchLocalIntegrationRecords,
    fetchLocalIntegrationsConfig,
    type LocalIntegrationRecord,
    type LocalIntegrationsConfig,
} from '@/lib/localIntegrationsApi';

import { CatalogBuyerHintTip } from '@/components/catalog/CatalogBuyerHintTip';

export function LocalIntegrationsSection() {
    const { getAccessToken } = useAuth();
    const [config, setConfig] = useState<LocalIntegrationsConfig | null>(null);
    const [records, setRecords] = useState<LocalIntegrationRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const cfg = await fetchLocalIntegrationsConfig();
            setConfig(cfg);
            if (cfg.enabled) {
                const token = await getAccessToken();
                setRecords(await fetchLocalIntegrationRecords(token));
            } else {
                setRecords([]);
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not load local integrations');
        } finally {
            setLoading(false);
        }
    }, [getAccessToken]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    if (loading) {
        return <p className="text-sm text-muted-foreground">Loading local integrations…</p>;
    }

    if (!config?.enabled) {
        return (
            <p className="text-sm text-muted-foreground leading-snug">
                Local demo integrations is off. Set{' '}
                <code className="rounded bg-muted px-1 text-xs">ENABLE_LOCAL_INTEGRATIONS=true</code> in{' '}
                <code className="rounded bg-muted px-1 text-xs">api/.env</code> (defaults on in{' '}
                <code className="rounded bg-muted px-1 text-xs">ENVIRONMENT=local</code>) and restart the API.
            </p>
        );
    }

    return (
        <div className="space-y-4 text-sm" data-testid="local-integrations-section">
            <p className="text-muted-foreground leading-snug">
                All-in-one CRM/OSS/ATS demos: lookup and action HTTP tools persist under{' '}
                <code className="rounded bg-muted px-1 text-xs">run/local_integrations/</code> — no buyer API keys
                required. Install-from-catalog auto-wires{' '}
                <code className="rounded bg-muted px-1 text-xs">*_api_base_url</code> template vars, or use{' '}
                <strong className="text-foreground">Wire local integrations</strong> on the workflow editor guide card
                (hover buttons for per-vertical tips).
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>
                    Banking balance · telecom outage · B2B CRM · insurance claims · hospitality waiver — see{' '}
                    <code className="rounded bg-muted px-1">./scripts/buyer-demo-*.sh</code>
                </span>
                <CatalogBuyerHintTip
                    tip="Tokenized balance and waiver demos use local integrations only — no PCI or CRS keys. Map response fields (available_balance, waiver_status) for analytics mapped_data proof."
                />
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1 text-xs font-mono break-all max-h-40 overflow-y-auto">
                {Object.entries(config.endpoints).map(([key, url]) => (
                    <p key={key}>
                        <span className="text-muted-foreground">POST </span>
                        {url}
                    </p>
                ))}
            </div>
            {records.length === 0 ? (
                <p className="text-muted-foreground">No integration actions recorded yet.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Path</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Created</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {records.slice(0, 20).map((r) => (
                            <TableRow key={r.id}>
                                <TableCell className="font-mono text-xs">{r.type}</TableCell>
                                <TableCell className="font-mono text-xs">{r.path}</TableCell>
                                <TableCell>{r.confirmation_code}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{r.created_at}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}
