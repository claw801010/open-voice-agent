'use client';

import { Loader2, Mail, MessageSquare, Phone, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    fetchReviewInbox,
    patchCallFollowUp,
    type ReviewInboxItem,
} from '@/lib/analyticsCallReviewApi';
import { useAuth } from '@/lib/auth';

const CHANNEL_ICON = {
    sms: MessageSquare,
    email: Mail,
    call: Phone,
} as const;

function channelIcon(actionType: string) {
    if (actionType in CHANNEL_ICON) {
        return CHANNEL_ICON[actionType as keyof typeof CHANNEL_ICON];
    }
    return MessageSquare;
}

export function ReviewInboxClient() {
    const { user, loading: authLoading, getAccessToken } = useAuth();
    const [tab, setTab] = useState<'pending' | 'approved' | 'edited' | 'dismissed'>('pending');
    const [items, setItems] = useState<ReviewInboxItem[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
        if (!getAccessToken) return;
        setLoading(true);
        try {
            const data = await fetchReviewInbox(getAccessToken, tab);
            setItems(data.items);
            setPendingCount(data.pending_count);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not load review inbox');
        } finally {
            setLoading(false);
        }
    }, [getAccessToken, tab]);

    useEffect(() => {
        if (authLoading || !user) return;
        void load();
    }, [authLoading, user, load]);

    const act = async (
        item: ReviewInboxItem,
        status: 'approved' | 'edited' | 'dismissed',
        message?: string,
    ) => {
        setBusyId(item.follow_up.id);
        try {
            await patchCallFollowUp(getAccessToken, item.call_id, item.follow_up.id, {
                status,
                suggested_message: message ?? item.follow_up.suggested_message ?? undefined,
                notes: item.follow_up.notes,
            });
            toast.success(status === 'approved' ? 'Approved & queued' : status === 'edited' ? 'Saved edit' : 'Dismissed');
            void load();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Update failed');
        } finally {
            setBusyId(null);
        }
    };

    if (authLoading || !user) {
        return <p className="text-sm text-muted-foreground">Sign in to open the review inbox.</p>;
    }

    return (
        <div className="space-y-6" data-testid="review-inbox">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Review inbox</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Human-in-the-loop for sensitive SMS, email, and call follow-ups. Your data stays yours — we
                        never train models on patient data.
                    </p>
                </div>
                {pendingCount > 0 ? (
                    <Badge variant="secondary">{pendingCount} pending</Badge>
                ) : null}
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                <TabsList>
                    <TabsTrigger value="pending">Review</TabsTrigger>
                    <TabsTrigger value="approved">Approved</TabsTrigger>
                    <TabsTrigger value="edited">Edited</TabsTrigger>
                    <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
                </TabsList>
                <TabsContent value={tab} className="mt-4 space-y-4">
                    {loading ? (
                        <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : items.length === 0 ? (
                        <Card>
                            <CardContent className="py-8 text-center text-sm text-muted-foreground">
                                No items in this tab. Queue follow-ups with a suggested message from{' '}
                                <Link href="/analytics/calls" className="underline">
                                    call detail
                                </Link>
                                .
                            </CardContent>
                        </Card>
                    ) : (
                        items.map((item) => {
                            const Icon = channelIcon(item.follow_up.action_type);
                            const draftKey = item.follow_up.id;
                            const message =
                                drafts[draftKey] ??
                                item.follow_up.suggested_message ??
                                item.follow_up.notes;
                            return (
                                <Card key={`${item.call_id}-${item.follow_up.id}`}>
                                    <CardHeader className="pb-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Icon className="h-4 w-4 text-muted-foreground" />
                                            <CardTitle className="text-base">
                                                {item.follow_up.contact_hint || item.workflow_name || item.call_id}
                                            </CardTitle>
                                            <Badge variant="outline" className="uppercase text-[10px]">
                                                {item.follow_up.action_type}
                                            </Badge>
                                            {item.catalog_slug ? (
                                                <Badge variant="secondary" className="font-mono text-[10px]">
                                                    {item.catalog_slug}
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <CardDescription>{item.follow_up.notes || item.ai_summary}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground">
                                                Suggested response
                                            </p>
                                            <Textarea
                                                className="mt-1 min-h-[100px] text-sm"
                                                value={message}
                                                onChange={(e) =>
                                                    setDrafts((d) => ({ ...d, [draftKey]: e.target.value }))
                                                }
                                                readOnly={tab !== 'pending'}
                                            />
                                        </div>
                                        {tab === 'pending' ? (
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    disabled={busyId === item.follow_up.id}
                                                    onClick={() => void act(item, 'approved', message)}
                                                >
                                                    {busyId === item.follow_up.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        'Approve & send'
                                                    )}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={busyId === item.follow_up.id}
                                                    onClick={() => void act(item, 'edited', message)}
                                                >
                                                    Save edit
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={busyId === item.follow_up.id}
                                                    onClick={() => void act(item, 'dismissed')}
                                                >
                                                    Dismiss
                                                </Button>
                                                <Button size="sm" variant="link" asChild>
                                                    <Link href={`/analytics/calls/${encodeURIComponent(item.call_id)}`}>
                                                        Open call
                                                    </Link>
                                                </Button>
                                            </div>
                                        ) : null}
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </TabsContent>
            </Tabs>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Your data stays yours. We never train models on your patient data.
            </p>
        </div>
    );
}
