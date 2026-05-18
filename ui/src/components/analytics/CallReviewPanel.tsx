'use client';

import {
    CalendarClock,
    Loader2,
    Mail,
    MessageSquare,
    Phone,
    Sparkles,
    Wand2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AnalyticsCallDetail } from '@/lib/analyticsCallsApi';
import {
    applyWorkflowImprovement,
    createCallFollowUp,
    generateCallAiReview,
    type CallAiReview,
    type FollowUpActionType,
    type FollowUpItem,
} from '@/lib/analyticsCallReviewApi';
import { useAuth } from '@/lib/auth';

const FOLLOW_UP_OPTIONS: { value: FollowUpActionType; label: string; icon: typeof Phone }[] = [
    { value: 'call', label: 'Call back', icon: Phone },
    { value: 'sms', label: 'SMS', icon: MessageSquare },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'appointment', label: 'Appointment', icon: CalendarClock },
    { value: 'confirm', label: 'Confirm / verify', icon: CalendarClock },
    { value: 'other', label: 'Other', icon: MessageSquare },
];

type Props = {
    callId: string;
    detail: AnalyticsCallDetail;
    onFollowUpsChange?: (items: FollowUpItem[]) => void;
};

export function CallReviewPanel({ callId, detail, onFollowUpsChange }: Props) {
    const { getAccessToken } = useAuth();
    const [review, setReview] = useState<CallAiReview | null>(null);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [followUpType, setFollowUpType] = useState<FollowUpActionType>('call');
    const [followUpNotes, setFollowUpNotes] = useState('');
    const [contactHint, setContactHint] = useState('');
    const [followUps, setFollowUps] = useState<FollowUpItem[]>(
        (detail.follow_ups as FollowUpItem[] | undefined) ?? [],
    );
    const [applyBusyIndex, setApplyBusyIndex] = useState<number | null>(null);

    const runReview = async (force = false) => {
        setReviewLoading(true);
        try {
            const r = await generateCallAiReview(getAccessToken, callId, force);
            setReview(r);
            toast.success(r.source === 'llm' ? 'AI review generated' : 'Review generated (heuristic — add LLM key for richer output)');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Review failed');
        } finally {
            setReviewLoading(false);
        }
    };

    const addFollowUp = async () => {
        try {
            const item = await createCallFollowUp(getAccessToken, callId, {
                action_type: followUpType,
                notes: followUpNotes,
                contact_hint: contactHint || undefined,
            });
            const next = [...followUps, item];
            setFollowUps(next);
            onFollowUpsChange?.(next);
            setFollowUpNotes('');
            toast.success('Follow-up queued');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not save follow-up');
        }
    };

    const applyRecommendation = async (index: number, snippet: string) => {
        setApplyBusyIndex(index);
        try {
            const res = await applyWorkflowImprovement(getAccessToken, callId, {
                improvement: snippet,
                recommendation_index: index,
            });
            toast.success(res.message);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not update workflow');
        } finally {
            setApplyBusyIndex(null);
        }
    };

    const displayReview = review ?? (detail.ai_summary
        ? {
              call_id: callId,
              summary: detail.ai_summary,
              outcome_analysis: '',
              recommendations: [],
              generated_at: '',
              source: 'heuristic' as const,
          }
        : null);

    return (
        <div className="space-y-4">
            <Card className="border-teal-500/20">
                <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-teal-500" aria-hidden />
                                AI call review
                            </CardTitle>
                            <CardDescription>
                                Summary, outcome analysis, and prompt recommendations from the transcript and tool
                                evidence.
                            </CardDescription>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={reviewLoading}
                            onClick={() => runReview(Boolean(review))}
                        >
                            {reviewLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden />
                            ) : (
                                <Sparkles className="h-4 w-4 mr-1" aria-hidden />
                            )}
                            {review ? 'Refresh' : 'Generate'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    {!displayReview ? (
                        <p className="text-muted-foreground">
                            Click Generate to analyze this call. Requires an LLM API key in your user configuration
                            (falls back to a short heuristic review if unavailable).
                        </p>
                    ) : (
                        <>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
                                <p className="whitespace-pre-wrap">{displayReview.summary}</p>
                            </div>
                            {displayReview.outcome_analysis ? (
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Outcome</p>
                                    <p className="whitespace-pre-wrap">{displayReview.outcome_analysis}</p>
                                    {displayReview.suggested_outcome ? (
                                        <Badge variant="secondary" className="mt-2">
                                            {displayReview.suggested_outcome}
                                        </Badge>
                                    ) : null}
                                </div>
                            ) : null}
                            {(displayReview.recommendations ?? []).length > 0 ? (
                                <div className="space-y-3">
                                    <p className="text-xs font-medium text-muted-foreground">Recommendations</p>
                                    {(displayReview.recommendations ?? []).map((rec, i) => (
                                        <div
                                            key={`${rec.title}-${i}`}
                                            className="rounded-md border border-border bg-muted/30 p-3 space-y-2"
                                        >
                                            <p className="font-medium">{rec.title}</p>
                                            <p className="text-muted-foreground text-xs">{rec.detail}</p>
                                            <p className="text-xs font-mono bg-background/80 rounded p-2">
                                                {rec.prompt_snippet}
                                            </p>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5"
                                                disabled={applyBusyIndex === i}
                                                onClick={() => applyRecommendation(i, rec.prompt_snippet)}
                                            >
                                                {applyBusyIndex === i ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                                ) : (
                                                    <Wand2 className="h-3.5 w-3.5" aria-hidden />
                                                )}
                                                Add to agent workflow
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            <Button variant="link" size="sm" className="h-auto p-0" asChild>
                                <Link href={`/workflow/${detail.workflow_id}`}>Open workflow editor</Link>
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>

            {detail.transcript?.trim() ? (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Transcript</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
                            {detail.transcript}
                        </pre>
                    </CardContent>
                </Card>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Customer follow-up</CardTitle>
                    <CardDescription>
                        Queue a next step for your team — call, SMS, email, appointment, confirmation, or other.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Action</Label>
                            <Select
                                value={followUpType}
                                onValueChange={(v) => setFollowUpType(v as FollowUpActionType)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {FOLLOW_UP_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="contact-hint">Contact hint</Label>
                            <Input
                                id="contact-hint"
                                placeholder="Phone, email, or name"
                                value={contactHint}
                                onChange={(e) => setContactHint(e.target.value)}
                            />
                        </div>
                        <div className="sm:col-span-2 space-y-1.5">
                            <Label htmlFor="follow-up-notes">Notes</Label>
                            <Textarea
                                id="follow-up-notes"
                                rows={3}
                                placeholder="What should happen on follow-up?"
                                value={followUpNotes}
                                onChange={(e) => setFollowUpNotes(e.target.value)}
                            />
                        </div>
                    </div>
                    <Button type="button" size="sm" onClick={addFollowUp}>
                        Add follow-up
                    </Button>
                    {followUps.length > 0 ? (
                        <ul className="space-y-2 text-xs border-t border-border pt-3">
                            {followUps.map((fu) => (
                                <li key={fu.id} className="flex flex-wrap gap-2 items-center">
                                    <Badge variant="outline">{fu.action_type}</Badge>
                                    <Badge variant="secondary">{fu.status}</Badge>
                                    <span className="text-muted-foreground">{fu.notes || '—'}</span>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
