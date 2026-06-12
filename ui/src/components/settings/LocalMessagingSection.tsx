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
    fetchLocalMessagingConfig,
    fetchLocalMessagingRecords,
    type LocalMessagingConfig,
    type LocalMessagingRecord,
} from '@/lib/localMessagingApi';

export function LocalMessagingSection() {
    const { getAccessToken } = useAuth();
    const [config, setConfig] = useState<LocalMessagingConfig | null>(null);
    const [records, setRecords] = useState<LocalMessagingRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const cfg = await fetchLocalMessagingConfig();
            setConfig(cfg);
            if (cfg.enabled) {
                const token = await getAccessToken();
                setRecords(await fetchLocalMessagingRecords(token));
            } else {
                setRecords([]);
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not load local messaging');
        } finally {
            setLoading(false);
        }
    }, [getAccessToken]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    if (loading) {
        return <p className="text-sm text-muted-foreground">Loading local messaging…</p>;
    }

    if (!config?.enabled) {
        return (
            <p className="text-sm text-muted-foreground leading-snug">
                Local demo messaging is off. Set{' '}
                <code className="rounded bg-muted px-1 text-xs">ENABLE_LOCAL_MESSAGING=true</code> in{' '}
                <code className="rounded bg-muted px-1 text-xs">api/.env</code> and restart the API.
            </p>
        );
    }

    return (
        <div className="space-y-4 text-sm" data-testid="local-messaging-section">
            <p className="text-muted-foreground leading-snug">
                SMS and email sends are logged under{' '}
                <code className="rounded bg-muted px-1 text-xs">run/local_messaging/</code> — no Twilio or SendGrid
                keys required. Wire <strong className="text-foreground">send_confirmation_sms</strong> on healthcare
                workflows for post-call outreach proof.
            </p>
            <p className="text-xs text-muted-foreground">
                Channels: {config.channels.join(' · ')}
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1 text-xs font-mono break-all">
                {Object.entries(config.endpoints).map(([key, url]) => (
                    <p key={key}>
                        <span className="text-muted-foreground">POST </span>
                        {url}
                    </p>
                ))}
            </div>
            {records.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Channel</TableHead>
                            <TableHead>To</TableHead>
                            <TableHead>Preview</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {records.slice(0, 8).map((r) => (
                            <TableRow key={r.id}>
                                <TableCell className="uppercase text-xs">{r.channel}</TableCell>
                                <TableCell>{r.to}</TableCell>
                                <TableCell className="max-w-[280px] truncate text-muted-foreground">{r.body}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <p className="text-xs text-muted-foreground">No messages logged yet.</p>
            )}
        </div>
    );
}
