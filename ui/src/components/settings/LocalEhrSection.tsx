'use client';

import { Loader2, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
    fetchLocalEhrAuditLog,
    fetchLocalEhrConfig,
    fetchLocalEhrPatients,
    fetchLocalEhrSyncRecords,
    pushPendingEhrConnectorSyncs,
    updateLocalEhrSettings,
    type LocalEhrAuditEntry,
    type LocalEhrConfig,
    type LocalEhrPatient,
    type LocalEhrSyncRecord,
    type RecordKeepingMode,
} from '@/lib/localEhrApi';

const VENDORS = [
    { id: 'none', label: 'None — local records only' },
    { id: 'athenahealth', label: 'athenaHealth' },
    { id: 'epic', label: 'Epic' },
    { id: 'cerner', label: 'Cerner' },
    { id: 'ecw', label: 'eClinicalWorks' },
] as const;

const MODES: { id: RecordKeepingMode; label: string; hint: string }[] = [
    {
        id: 'local_only',
        label: 'Local record keeping only',
        hint: 'Charts and context stay on this deployment — no outbound EHR connector.',
    },
    {
        id: 'local_with_connector',
        label: 'Local + sync to connector',
        hint: 'Always write locally first, then mirror chart notes to your EHR vendor.',
    },
];

function syncStatusLabel(r: LocalEhrSyncRecord): string {
    const s = r.connector_sync_status ?? r.status;
    if (s === 'local_only') return 'Local only';
    if (s === 'synced') return `Synced · ${r.ehr_vendor}`;
    if (s === 'pending') return 'Pending connector';
    return s;
}

export function LocalEhrSection() {
    const { getAccessToken } = useAuth();
    const [config, setConfig] = useState<LocalEhrConfig | null>(null);
    const [patients, setPatients] = useState<LocalEhrPatient[]>([]);
    const [records, setRecords] = useState<LocalEhrSyncRecord[]>([]);
    const [audit, setAudit] = useState<LocalEhrAuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [pushing, setPushing] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const token = await getAccessToken();
            const cfg = await fetchLocalEhrConfig(token);
            setConfig(cfg);
            if (cfg.enabled) {
                const [p, r, a] = await Promise.all([
                    fetchLocalEhrPatients(token),
                    fetchLocalEhrSyncRecords(token),
                    fetchLocalEhrAuditLog(token),
                ]);
                setPatients(p);
                setRecords(r);
                setAudit(a);
            } else {
                setPatients([]);
                setRecords([]);
                setAudit([]);
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not load local EHR');
        } finally {
            setLoading(false);
        }
    }, [getAccessToken]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const applySettings = async (patch: Parameters<typeof updateLocalEhrSettings>[1]) => {
        try {
            const token = await getAccessToken();
            await updateLocalEhrSettings(token, patch);
            toast.success('EHR settings updated');
            void refresh();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not update settings');
        }
    };

    if (loading) {
        return <p className="text-sm text-muted-foreground">Loading local EHR…</p>;
    }

    if (!config?.enabled) {
        return (
            <p className="text-sm text-muted-foreground leading-snug">
                Local demo EHR is off. Set{' '}
                <code className="rounded bg-muted px-1 text-xs">ENABLE_LOCAL_EHR=true</code> in{' '}
                <code className="rounded bg-muted px-1 text-xs">api/.env</code> and restart the API.
            </p>
        );
    }

    const mode = (config.connector.record_keeping_mode ?? 'local_only') as RecordKeepingMode;
    const vendor = config.connector.vendor ?? 'none';
    const pending = config.connector.pending_connector_sync_count ?? 0;

    return (
        <div className="space-y-5 text-sm" data-testid="local-ehr-section">
            <p className="text-muted-foreground leading-snug">
                HIPAA-oriented <strong className="font-medium text-foreground">local chart storage</strong>{' '}
                per organization under <code className="rounded bg-muted px-1 text-xs">run/local_ehr/</code>.
                Choose local-only record keeping, or keep local as source of truth and sync chart notes to a
                connector when ready.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <Label className="text-xs">Record keeping mode</Label>
                    <Select
                        value={mode}
                        onValueChange={(v) =>
                            void applySettings({
                                record_keeping_mode: v as RecordKeepingMode,
                                vendor: v === 'local_only' ? 'none' : vendor === 'none' ? 'athenahealth' : vendor,
                                connector_sync_enabled: v === 'local_with_connector',
                            })
                        }
                    >
                        <SelectTrigger className="h-9" data-testid="local-ehr-mode-select">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {MODES.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                    {m.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                        {MODES.find((m) => m.id === mode)?.hint}
                    </p>
                </div>
                <div className="grid gap-1.5">
                    <Label className="text-xs">EHR connector (optional)</Label>
                    <Select
                        value={vendor}
                        disabled={mode === 'local_only'}
                        onValueChange={(v) =>
                            void applySettings({
                                vendor: v,
                                record_keeping_mode: v === 'none' ? 'local_only' : 'local_with_connector',
                                connector_sync_enabled: v !== 'none',
                            })
                        }
                    >
                        <SelectTrigger className="h-9" data-testid="local-ehr-vendor-select">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {VENDORS.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                    {v.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {mode === 'local_with_connector' && pending > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
                    <span>{pending} chart note(s) pending connector sync</span>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pushing}
                        data-testid="local-ehr-push-pending"
                        onClick={async () => {
                            setPushing(true);
                            try {
                                const token = await getAccessToken();
                                const res = await pushPendingEhrConnectorSyncs(token);
                                toast.success(`Pushed ${res.pushed} record(s) to connector`);
                                void refresh();
                            } catch (e) {
                                toast.error(e instanceof Error ? e.message : 'Push failed');
                            } finally {
                                setPushing(false);
                            }
                        }}
                    >
                        {pushing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Push pending'}
                    </Button>
                </div>
            ) : null}

            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1 text-xs font-mono break-all max-h-28 overflow-y-auto">
                {Object.entries(config.endpoints).map(([key, url]) => (
                    <p key={key}>
                        <span className="text-muted-foreground">POST </span>
                        {url}
                    </p>
                ))}
            </div>

            {patients.length > 0 ? (
                <div>
                    <p className="mb-2 text-xs font-medium text-foreground">Local patient chart index</p>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Patient</TableHead>
                                <TableHead>Token</TableHead>
                                <TableHead>Gaps</TableHead>
                                <TableHead>Source</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {patients.slice(0, 6).map((p) => (
                                <TableRow key={p.patient_token}>
                                    <TableCell>{p.display_name}</TableCell>
                                    <TableCell className="font-mono text-xs">{p.patient_token}</TableCell>
                                    <TableCell>{p.open_care_gaps?.length ?? 0}</TableCell>
                                    <TableCell className="text-xs">{p.record_source}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : null}

            {records.length > 0 ? (
                <div>
                    <p className="mb-2 text-xs font-medium text-foreground">Chart sync log</p>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Summary</TableHead>
                                <TableHead>Sync</TableHead>
                                <TableHead>When</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {records.slice(0, 8).map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell className="max-w-[200px] truncate">{r.summary}</TableCell>
                                    <TableCell className="text-xs">{syncStatusLabel(r)}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{r.synced_at}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <p className="text-xs text-muted-foreground">
                    No chart sync records yet — run <code className="text-[11px]">sync_chart_to_ehr</code> from a
                    workflow.
                </p>
            )}

            {audit.length > 0 ? (
                <div>
                    <p className="mb-2 text-xs font-medium text-foreground">Audit trail (PHI-minimized)</p>
                    <ul className="max-h-32 space-y-1 overflow-y-auto text-[11px] text-muted-foreground">
                        {audit.slice(0, 8).map((e) => (
                            <li key={e.id}>
                                <span className="font-mono text-foreground/80">{e.action}</span>
                                {e.patient_token ? ` · ${e.patient_token}` : null}
                                {e.connector_vendor ? ` · ${e.connector_vendor}` : null}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Local records are authoritative. Audit entries store action + patient token only — not clinical
                note text. Production: add BAA, encryption at rest, and retention policy before PHI in cloud.
            </p>
        </div>
    );
}
