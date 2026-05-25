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
    fetchLocalPaymentRecords,
    fetchLocalPaymentsConfig,
    type LocalPaymentRecord,
    type LocalPaymentsConfig,
} from '@/lib/localPaymentsApi';

export function LocalPaymentsSection() {
    const { getAccessToken } = useAuth();
    const [config, setConfig] = useState<LocalPaymentsConfig | null>(null);
    const [records, setRecords] = useState<LocalPaymentRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const cfg = await fetchLocalPaymentsConfig();
            setConfig(cfg);
            if (cfg.enabled) {
                const token = await getAccessToken();
                setRecords(await fetchLocalPaymentRecords(token));
            } else {
                setRecords([]);
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not load local payments');
        } finally {
            setLoading(false);
        }
    }, [getAccessToken]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    if (loading) {
        return <p className="text-sm text-muted-foreground">Loading local payments…</p>;
    }

    if (!config?.enabled) {
        return (
            <p className="text-sm text-muted-foreground leading-snug">
                Local demo payments is off. Set{' '}
                <code className="rounded bg-muted px-1 text-xs">ENABLE_LOCAL_PAYMENTS=true</code> in{' '}
                <code className="rounded bg-muted px-1 text-xs">api/.env</code> (defaults on in{' '}
                <code className="rounded bg-muted px-1 text-xs">ENVIRONMENT=local</code>) and restart the API.
            </p>
        );
    }

    return (
        <div className="space-y-4 text-sm">
            <p className="text-muted-foreground leading-snug">
                All-in-one collections demos: payment promises and redirect confirms persist under{' '}
                <code className="rounded bg-muted px-1 text-xs">run/local_payments/</code> — no Stripe or
                external processor required. Install retail <strong className="text-foreground">collections_complex</strong>{' '}
                and point <code className="rounded bg-muted px-1 text-xs">collections_api_base_url</code> here
                (auto on install).
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1 text-xs font-mono break-all">
                <p>
                    <span className="text-muted-foreground">POST </span>
                    {config.payment_promises_url}
                </p>
                <p>
                    <span className="text-muted-foreground">POST </span>
                    {config.payment_redirect_confirm_url}
                </p>
            </div>
            <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Records ({records.length})
                </h3>
                {records.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        No records yet — capture via voice HTTP tool or POST the endpoints above.
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Account</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>When</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {records.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell>{r.type}</TableCell>
                                    <TableCell>{r.account_reference ?? '—'}</TableCell>
                                    <TableCell>{r.confirmation_code}</TableCell>
                                    <TableCell className="font-mono text-xs">{r.created_at}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    );
}
