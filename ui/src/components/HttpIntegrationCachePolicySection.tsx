"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import {
    fetchHttpIntegrationCachePolicy,
    fetchOrgIntegrations,
    type HttpIntegrationCacheIntegrationOverride,
    type HttpIntegrationCachePolicy,
    type HttpIntegrationPiiHandling,
    type OrgIntegrationListItem,
    putHttpIntegrationCachePolicy,
} from "@/lib/httpIntegrationCachePolicy";

const DOC_URL = "https://docs.dograh.com/integrations/http-tool-data-policy";

type IntegrationRowDraft = {
    integrationId: string;
    provider: string;
    cacheEnabledWhenShipped: boolean;
    ttlSecondsInput: string;
    piiHandling: HttpIntegrationPiiHandling;
};

function buildIntegrationRows(
    policy: HttpIntegrationCachePolicy,
    integrations: OrgIntegrationListItem[],
): IntegrationRowDraft[] {
    const byId = new Map(
        policy.storedPreferences.integrationOverrides.map((o) => [o.integrationId, o]),
    );
    return integrations.map((int) => {
        const o = byId.get(int.integration_id);
        return {
            integrationId: int.integration_id,
            provider: int.provider,
            cacheEnabledWhenShipped: o?.cacheEnabledWhenShipped ?? false,
            ttlSecondsInput:
                o?.ttlSeconds == null || o?.ttlSeconds === undefined ? "" : String(o.ttlSeconds),
            piiHandling: o?.piiHandling ?? "allow_with_redaction",
        };
    });
}

function serializeDraftState(args: {
    shipped: boolean;
    ttl: string;
    rows: IntegrationRowDraft[];
}): string {
    return JSON.stringify({
        shipped: args.shipped,
        ttl: args.ttl.trim(),
        rows: args.rows.map((r) => ({
            id: r.integrationId,
            ce: r.cacheEnabledWhenShipped,
            ttl: r.ttlSecondsInput.trim(),
            pii: r.piiHandling,
        })),
    });
}

function overridesFromRows(rows: IntegrationRowDraft[]): HttpIntegrationCacheIntegrationOverride[] {
    return rows.map((r) => {
        let ttlSeconds: number | null = null;
        const t = r.ttlSecondsInput.trim();
        if (t !== "") {
            const n = Number(t);
            if (!Number.isFinite(n) || !Number.isInteger(n)) {
                throw new Error(`TTL for ${r.provider} must be a whole number of seconds or blank.`);
            }
            if (n < 60) {
                throw new Error(`TTL for ${r.provider} must be at least 60 seconds.`);
            }
            ttlSeconds = n;
        }
        return {
            integrationId: r.integrationId,
            cacheEnabledWhenShipped: r.cacheEnabledWhenShipped,
            ttlSeconds,
            piiHandling: r.piiHandling,
        };
    });
}

export function HttpIntegrationCachePolicySection() {
    const idShipped = useId();
    const idTtl = useId();
    const { user, loading: authLoading, getAccessToken } = useAuth();
    const hasFetched = useRef(false);
    const baselineRef = useRef<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [policy, setPolicy] = useState<HttpIntegrationCachePolicy | null>(null);
    const [integrations, setIntegrations] = useState<OrgIntegrationListItem[]>([]);

    const [draftShipped, setDraftShipped] = useState(false);
    const [draftTtl, setDraftTtl] = useState("");
    const [integrationRows, setIntegrationRows] = useState<IntegrationRowDraft[]>([]);

    useEffect(() => {
        if (authLoading || !user || hasFetched.current) return;
        hasFetched.current = true;

        void (async () => {
            try {
                const [p, ints] = await Promise.all([
                    fetchHttpIntegrationCachePolicy(getAccessToken),
                    fetchOrgIntegrations(getAccessToken),
                ]);
                setPolicy(p);
                const list = ints ?? [];
                setIntegrations(list);
                if (p) {
                    setDraftShipped(p.storedPreferences.cacheEnabledWhenShipped);
                    setDraftTtl(
                        p.storedPreferences.ttlSeconds == null
                            ? ""
                            : String(p.storedPreferences.ttlSeconds),
                    );
                    setIntegrationRows(buildIntegrationRows(p, list));
                    baselineRef.current = serializeDraftState({
                        shipped: p.storedPreferences.cacheEnabledWhenShipped,
                        ttl:
                            p.storedPreferences.ttlSeconds == null
                                ? ""
                                : String(p.storedPreferences.ttlSeconds),
                        rows: buildIntegrationRows(p, list),
                    });
                }
                if (ints === null) {
                    toast.error("Could not load integrations list for cache policy.");
                }
            } finally {
                setLoading(false);
            }
        })();
    }, [authLoading, user, getAccessToken]);

    const revertDraft = () => {
        if (!policy) return;
        setDraftShipped(policy.storedPreferences.cacheEnabledWhenShipped);
        setDraftTtl(
            policy.storedPreferences.ttlSeconds == null
                ? ""
                : String(policy.storedPreferences.ttlSeconds),
        );
        setIntegrationRows(buildIntegrationRows(policy, integrations));
        baselineRef.current = serializeDraftState({
            shipped: policy.storedPreferences.cacheEnabledWhenShipped,
            ttl:
                policy.storedPreferences.ttlSeconds == null
                    ? ""
                    : String(policy.storedPreferences.ttlSeconds),
            rows: buildIntegrationRows(policy, integrations),
        });
    };

    const dirty =
        baselineRef.current !== null &&
        serializeDraftState({
            shipped: draftShipped,
            ttl: draftTtl,
            rows: integrationRows,
        }) !== baselineRef.current;

    const handleSave = async () => {
        let ttlSeconds: number | null = null;
        const trimmed = draftTtl.trim();
        if (trimmed !== "") {
            const n = Number(trimmed);
            if (!Number.isFinite(n) || !Number.isInteger(n)) {
                toast.error("Org TTL must be a whole number of seconds, or leave blank for default.");
                return;
            }
            if (n < 60) {
                toast.error("Org TTL must be at least 60 seconds.");
                return;
            }
            ttlSeconds = n;
        }

        let overrides: HttpIntegrationCacheIntegrationOverride[];
        try {
            overrides = overridesFromRows(integrationRows);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Invalid per-integration TTL");
            return;
        }

        setSaving(true);
        try {
            const result = await putHttpIntegrationCachePolicy(getAccessToken, {
                cacheEnabledWhenShipped: draftShipped,
                ttlSeconds,
                integrationOverrides: overrides,
            });
            if (!result.ok) {
                toast.error(result.errorMessage);
                return;
            }
            setPolicy(result.policy);
            setDraftShipped(result.policy.storedPreferences.cacheEnabledWhenShipped);
            setDraftTtl(
                result.policy.storedPreferences.ttlSeconds == null
                    ? ""
                    : String(result.policy.storedPreferences.ttlSeconds),
            );
            const nextRows = buildIntegrationRows(result.policy, integrations);
            setIntegrationRows(nextRows);
            baselineRef.current = serializeDraftState({
                shipped: result.policy.storedPreferences.cacheEnabledWhenShipped,
                ttl:
                    result.policy.storedPreferences.ttlSeconds == null
                        ? ""
                        : String(result.policy.storedPreferences.ttlSeconds),
                rows: nextRows,
            });
            toast.success("HTTP cache policy draft saved");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <p className="text-sm text-muted-foreground">Loading...</p>;
    }

    if (!policy) {
        return (
            <p className="text-sm text-muted-foreground">
                Could not load integration cache policy. Try again later or check your organization access.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                HTTP tool calls are still <span className="font-medium text-foreground">live-only</span> until the
                datastore cache ships ({policy.deferralNotBefore}). Save your org&apos;s draft here so the rollout can
                honor it automatically.{" "}
                <a
                    href={DOC_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 underline"
                >
                    Learn more <ExternalLink className="h-3 w-3" />
                </a>
            </p>

            <div className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-1">
                <div>
                    Effective cache today:{" "}
                    <span className="font-medium text-foreground">
                        {policy.cacheEnabled ? "on" : "off"}
                    </span>
                    {" · "}
                    Status: <span className="font-mono text-foreground">{policy.implementationStatus}</span>
                </div>
                <div>
                    Policy schema: <span className="font-mono text-foreground">{policy.policySchemaVersion}</span>
                </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 px-3 py-3">
                <div className="space-y-0.5">
                    <Label htmlFor={idShipped} className="text-sm font-medium cursor-pointer">
                        Request cache when shipped (org default)
                    </Label>
                    <p className="text-xs text-muted-foreground">Draft only — does not enable caching yet.</p>
                </div>
                <Switch
                    id={idShipped}
                    checked={draftShipped}
                    onCheckedChange={setDraftShipped}
                    aria-label="Request HTTP response cache when feature ships"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor={idTtl}>TTL when shipped — org default (seconds)</Label>
                <Input
                    id={idTtl}
                    type="text"
                    inputMode="numeric"
                    placeholder="Leave blank for product default (min 60s if set)"
                    value={draftTtl}
                    onChange={(e) => setDraftTtl(e.target.value)}
                    className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                    Optional. Minimum <span className="font-mono">60</span> when provided. Per-connection TTL overrides
                    below.
                </p>
            </div>

            <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Per-integration drafts</p>
                <p className="text-xs text-muted-foreground">
                    Rows match connections on <span className="font-mono">GET /integration/</span>.{" "}
                    <strong>PII / storage class</strong> is policy intent only until runtime cache ships.
                </p>
                {integrationRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                        No integrations connected — connect a provider first to set per-connection drafts.
                    </p>
                ) : (
                    <div className="rounded-md border border-border/80 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">Provider</TableHead>
                                    <TableHead className="whitespace-nowrap">Connection id</TableHead>
                                    <TableHead className="text-center">Cache when shipped</TableHead>
                                    <TableHead className="whitespace-nowrap">TTL (s)</TableHead>
                                    <TableHead className="min-w-[200px]">PII / storage</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {integrationRows.map((row, idx) => (
                                    <TableRow key={row.integrationId}>
                                        <TableCell className="font-medium">{row.provider}</TableCell>
                                        <TableCell
                                            className="font-mono text-[11px] max-w-[140px] truncate"
                                            title={row.integrationId}
                                        >
                                            {row.integrationId}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={row.cacheEnabledWhenShipped}
                                                onCheckedChange={(v) => {
                                                    setIntegrationRows((prev) =>
                                                        prev.map((r, i) =>
                                                            i === idx ? { ...r, cacheEnabledWhenShipped: v } : r,
                                                        ),
                                                    );
                                                }}
                                                aria-label={`Cache when shipped for ${row.provider}`}
                                            />
                                        </TableCell>
                                        <TableCell className="w-[100px]">
                                            <Input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="—"
                                                className="font-mono h-8 text-xs"
                                                value={row.ttlSecondsInput}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setIntegrationRows((prev) =>
                                                        prev.map((r, i) =>
                                                            i === idx ? { ...r, ttlSecondsInput: val } : r,
                                                        ),
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={row.piiHandling}
                                                onValueChange={(v: HttpIntegrationPiiHandling) => {
                                                    setIntegrationRows((prev) =>
                                                        prev.map((r, i) =>
                                                            i === idx ? { ...r, piiHandling: v } : r,
                                                        ),
                                                    );
                                                }}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="allow_with_redaction">
                                                        Allow cache (org redaction when shipped)
                                                    </SelectItem>
                                                    <SelectItem value="block_cached_store">
                                                        Block storing cached payloads
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void handleSave()} disabled={saving || !dirty}>
                    {saving ? "Saving…" : "Save draft"}
                </Button>
                <Button type="button" variant="outline" onClick={revertDraft} disabled={saving || !dirty}>
                    Reset
                </Button>
            </div>

            {policy.policyAudit.length > 0 ? (
                <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">Recent saves (org audit)</p>
                    <p className="text-[11px] text-muted-foreground">
                        Each row is recorded when draft preferences change. Optional analytics:{" "}
                        <code className="text-[11px]">http_integration_cache_policy_updated</code> (PostHog).
                    </p>
                    <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border/80 bg-muted/20 p-2 text-[11px]">
                        {[...policy.policyAudit].reverse().map((row, i) => (
                            <li
                                key={`${row.ts}-${row.actorProviderId}-${i}`}
                                className="border-b border-border/60 pb-2 last:border-0 last:pb-0"
                            >
                                <span className="font-mono text-foreground/90">{row.ts}</span>
                                <span className="text-muted-foreground"> · actor </span>
                                <span className="font-mono">{row.actorProviderId}</span>
                                <br />
                                <span className="text-muted-foreground">cache_when_shipped </span>
                                <span className="font-medium">{row.cacheEnabledWhenShipped ? "true" : "false"}</span>
                                <span className="text-muted-foreground"> · ttl_s </span>
                                <span className="font-mono">{row.ttlSeconds ?? "—"}</span>
                                {row.integrationOverridesCount != null ? (
                                    <>
                                        <span className="text-muted-foreground"> · integration_rows </span>
                                        <span className="font-mono">{row.integrationOverridesCount}</span>
                                    </>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}
