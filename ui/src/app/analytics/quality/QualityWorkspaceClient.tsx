'use client';

import {
    BarChart3,
    CheckCircle2,
    Loader2,
    MessageSquare,
    Mic,
    Phone,
    ShieldCheck,
    Sparkles,
    Wand2,
    XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ReviewInboxClient } from '@/app/analytics/review/ReviewInboxClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth';
import {
    approveImprovementProposal,
    fetchImprovementQueue,
    MODE_DESCRIPTIONS,
    MODE_LABELS,
    rejectImprovementProposal,
    updateSelfImprovementPolicy,
    type ImprovementProposal,
    type SelfImprovementMode,
} from '@/lib/selfImprovementApi';
import { fetchInteractionTimeline, type InteractionEvent } from '@/lib/interactionTimelineApi';
import { cn } from '@/lib/utils';

function riskBadgeClass(tier: string): string {
    switch (tier) {
        case 'low':
            return 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/25';
        case 'high':
            return 'bg-rose-500/10 text-rose-800 dark:text-rose-200 border-rose-500/25';
        default:
            return 'bg-amber-500/10 text-amber-900 dark:text-amber-100 border-amber-500/25';
    }
}

function ImprovementQueuePanel() {
    const { getAccessToken, user, loading: authLoading } = useAuth();
    const [tab, setTab] = useState<'pending' | 'auto_applied' | 'approved' | 'rejected'>('pending');
    const [items, setItems] = useState<ImprovementProposal[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [mode, setMode] = useState<SelfImprovementMode>('suggest');
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [policyBusy, setPolicyBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchImprovementQueue(getAccessToken, tab);
            setItems(data.items);
            setPendingCount(data.pending_count);
            setMode(data.policy.mode);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not load queue');
        } finally {
            setLoading(false);
        }
    }, [getAccessToken, tab]);

    useEffect(() => {
        if (authLoading || !user) return;
        void load();
    }, [authLoading, user, load]);

    const onModeChange = async (next: SelfImprovementMode) => {
        setPolicyBusy(true);
        try {
            const policy = await updateSelfImprovementPolicy(getAccessToken, { mode: next });
            setMode(policy.mode);
            toast.success(`Policy: ${MODE_LABELS[policy.mode]}`);
            void load();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Policy update failed');
        } finally {
            setPolicyBusy(false);
        }
    };

    const act = async (id: string, action: 'approve' | 'reject') => {
        setBusyId(id);
        try {
            if (action === 'approve') {
                const res = await approveImprovementProposal(getAccessToken, id);
                toast.success(res.message);
            } else {
                const msg = await rejectImprovementProposal(getAccessToken, id);
                toast.message(msg);
            }
            void load();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Action failed');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-4" data-testid="quality-improvement-queue">
            <Card className="border-sky-500/20 bg-sky-500/5">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" aria-hidden />
                        Self-improvement policy
                    </CardTitle>
                    <CardDescription>{MODE_DESCRIPTIONS[mode]}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-3">
                    <Select
                        value={mode}
                        onValueChange={(v) => void onModeChange(v as SelfImprovementMode)}
                        disabled={policyBusy}
                    >
                        <SelectTrigger className="w-[min(100%,20rem)]" data-testid="si-policy-mode">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {(Object.keys(MODE_LABELS) as SelfImprovementMode[]).map((m) => (
                                <SelectItem key={m} value={m}>
                                    {MODE_LABELS[m]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {pendingCount > 0 ? (
                        <Badge variant="secondary">{pendingCount} pending</Badge>
                    ) : (
                        <Badge variant="outline">Queue clear</Badge>
                    )}
                </CardContent>
            </Card>

            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                <TabsList>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="auto_applied">Auto-applied</TabsTrigger>
                    <TabsTrigger value="approved">Approved</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected</TabsTrigger>
                </TabsList>
                <TabsContent value={tab} className="mt-4 space-y-3">
                    {loading ? (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                        </p>
                    ) : items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No items in this tab. Run an{' '}
                            <strong className="font-medium text-foreground">AI review</strong> on a call
                            detail page to enqueue improvements.
                        </p>
                    ) : (
                        items.map((item) => (
                            <Card key={item.id} data-testid={`si-proposal-${item.id}`}>
                                <CardHeader className="pb-2">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                                        <div className="flex flex-wrap gap-1.5">
                                            <Badge variant="outline" className={cn('text-[10px]', riskBadgeClass(item.risk_tier))}>
                                                {item.risk_tier} · {item.category}
                                            </Badge>
                                            <Badge variant="secondary" className="text-[10px]">
                                                {item.status.replace('_', ' ')}
                                            </Badge>
                                        </div>
                                    </div>
                                    {item.workflow_name ? (
                                        <CardDescription>{item.workflow_name}</CardDescription>
                                    ) : null}
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <p className="text-muted-foreground leading-relaxed">{item.text}</p>
                                    {item.reasons.length > 0 ? (
                                        <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                                            {item.reasons.map((r) => (
                                                <li key={r}>{r}</li>
                                            ))}
                                        </ul>
                                    ) : null}
                                    <div className="flex flex-wrap gap-2">
                                        {item.call_id ? (
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/analytics/calls/${encodeURIComponent(item.call_id)}`}>
                                                    View call
                                                </Link>
                                            </Button>
                                        ) : null}
                                        {item.workflow_id ? (
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/workflow/${item.workflow_id}`}>Open workflow</Link>
                                            </Button>
                                        ) : null}
                                        {item.status === 'pending' ? (
                                            <>
                                                <Button
                                                    size="sm"
                                                    disabled={busyId === item.id}
                                                    data-testid={`si-approve-${item.id}`}
                                                    onClick={() => void act(item.id, 'approve')}
                                                >
                                                    {busyId === item.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                    ) : (
                                                        <CheckCircle2 className="h-4 w-4 mr-1" />
                                                    )}
                                                    Approve & apply
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={busyId === item.id}
                                                    onClick={() => void act(item.id, 'reject')}
                                                >
                                                    <XCircle className="h-4 w-4 mr-1" />
                                                    Dismiss
                                                </Button>
                                            </>
                                        ) : null}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function channelIcon(channel: string) {
    if (channel === 'voice') return Mic;
    if (channel === 'email') return MessageSquare;
    if (channel === 'sms') return Phone;
    return MessageSquare;
}

function InteractionTimelinePanel() {
    const { getAccessToken, user, loading: authLoading } = useAuth();
    const [channel, setChannel] = useState<'all' | 'voice' | 'sms' | 'email'>('all');
    const [events, setEvents] = useState<InteractionEvent[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchInteractionTimeline(getAccessToken, { channel, limit: 50 });
            setEvents(data.events);
            setTotal(data.total);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not load timeline');
        } finally {
            setLoading(false);
        }
    }, [getAccessToken, channel]);

    useEffect(() => {
        if (authLoading || !user) return;
        void load();
    }, [authLoading, user, load]);

    return (
        <div className="space-y-4" data-testid="quality-interaction-timeline">
            <div className="flex flex-wrap items-center gap-2">
                {(['all', 'voice', 'sms', 'email'] as const).map((ch) => (
                    <Button
                        key={ch}
                        type="button"
                        size="sm"
                        variant={channel === ch ? 'default' : 'outline'}
                        onClick={() => setChannel(ch)}
                    >
                        {ch === 'all' ? 'All channels' : ch}
                    </Button>
                ))}
                <span className="text-xs text-muted-foreground ml-auto">{total} events stored</span>
            </div>
            {loading ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading timeline…
                </p>
            ) : events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No interactions yet. Complete a voice call or send local demo SMS/email from Settings →
                    Local demo messaging.
                </p>
            ) : (
                <ul className="space-y-2">
                    {events.map((evt) => {
                        const Icon = channelIcon(String(evt.channel));
                        return (
                            <li
                                key={evt.id}
                                className="flex gap-3 rounded-md border border-border/60 bg-card/40 px-3 py-2 text-sm"
                            >
                                <Icon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
                                <div className="min-w-0 flex-1 space-y-1">
                                    <p className="font-medium leading-snug">{evt.summary}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {evt.channel} · {new Date(evt.at).toLocaleString()}
                                        {evt.workflow_name ? ` · ${evt.workflow_name}` : ''}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {evt.call_id ? (
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/analytics/calls/${encodeURIComponent(evt.call_id)}`}>
                                                    Call detail
                                                </Link>
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export function QualityWorkspaceClient() {
    return (
        <div className="space-y-6" data-testid="quality-workspace">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                    <h2 className="font-semibold">Voice quality & agent improvement</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                    One place for <strong className="font-medium text-foreground">QM call review</strong>,{' '}
                    <strong className="font-medium text-foreground">customer follow-up approval</strong>, and{' '}
                    <strong className="font-medium text-foreground">agent self-improvement</strong> — with
                    configurable auto-apply for low-risk prompt changes.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/analytics/calls">
                            <BarChart3 className="h-4 w-4 mr-1.5" />
                            Call list & traces
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/analytics">
                            <Wand2 className="h-4 w-4 mr-1.5" />
                            Overview & QM widgets
                        </Link>
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="improvements">
                <TabsList className="flex-wrap h-auto gap-1">
                    <TabsTrigger value="improvements">Agent improvements</TabsTrigger>
                    <TabsTrigger value="inbox">Customer review inbox</TabsTrigger>
                    <TabsTrigger value="timeline">Omnichannel timeline</TabsTrigger>
                </TabsList>
                <TabsContent value="improvements" className="mt-4">
                    <ImprovementQueuePanel />
                </TabsContent>
                <TabsContent value="inbox" className="mt-4">
                    <ReviewInboxClient />
                </TabsContent>
                <TabsContent value="timeline" className="mt-4">
                    <InteractionTimelinePanel />
                </TabsContent>
            </Tabs>
        </div>
    );
}
