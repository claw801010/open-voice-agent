'use client';

import { Loader2, MessageSquareText, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import logger from '@/lib/logger';
import type { SimulationChatTurn } from '@/lib/workflow/simulationTextTurn';
import { postSimulationTextTurn } from '@/lib/workflow/simulationTextTurn';

export type SimulationManualChatPanelProps = {
    workflowId: number;
};

const personaStorageKey = (workflowId: number) =>
    `workflow_simulation_user_persona_${workflowId}`;

export function SimulationManualChatPanel({ workflowId }: SimulationManualChatPanelProps) {
    const { getAccessToken } = useAuth();
    const [messages, setMessages] = useState<SimulationChatTurn[]>([]);
    const [draft, setDraft] = useState('');
    const [userPersona, setUserPersona] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            const s = sessionStorage.getItem(personaStorageKey(workflowId));
            setUserPersona(s ?? '');
        } catch {
            setUserPersona('');
        }
    }, [workflowId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, sending]);

    const send = useCallback(async () => {
        const text = draft.trim();
        if (!text || sending) return;
        setSending(true);
        const userMsg: SimulationChatTurn = { role: 'user', content: text };
        const prior = messages;
        setDraft('');
        setMessages((prev) => [...prev, userMsg]);
        try {
            const { reply } = await postSimulationTextTurn(
                workflowId,
                {
                    message: text,
                    conversation_history: prior.map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                    user_persona: userPersona.trim() || undefined,
                },
                getAccessToken,
            );
            setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        } catch (e) {
            logger.error(`Simulation text turn: ${e}`);
            const msg = e instanceof Error ? e.message : 'Text simulation failed';
            toast.error(msg);
            setMessages(prior);
            setDraft(text);
        } finally {
            setSending(false);
        }
    }, [draft, sending, messages, workflowId, getAccessToken, userPersona]);

    return (
        <section className="rounded-md border border-border bg-background/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Manual chat (text)
                </h3>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
                One LLM reply per send using the <strong className="text-foreground">first Agent</strong> after{' '}
                <strong className="text-foreground">Start</strong> on your <strong className="text-foreground">saved draft</strong>, your{' '}
                <strong className="text-foreground">org LLM key</strong>, and template variables. No PSTN; not a full voice
                pipeline.
            </p>
            <div className="space-y-1.5">
                <Label htmlFor={`sim-user-persona-${workflowId}`} className="text-[11px] text-muted-foreground">
                    Simulated caller persona <span className="font-normal">(optional)</span>
                </Label>
                <Textarea
                    id={`sim-user-persona-${workflowId}`}
                    value={userPersona}
                    onChange={(e) => {
                        const v = e.target.value;
                        setUserPersona(v);
                        try {
                            sessionStorage.setItem(personaStorageKey(workflowId), v);
                        } catch {
                            /* ignore */
                        }
                    }}
                    placeholder="e.g. Frustrated customer calling about a late shipment"
                    className="min-h-[56px] text-xs resize-y"
                    disabled={sending}
                />
                <p className="text-[10px] text-muted-foreground leading-snug">
                    When set, each message you send is prefixed for the agent so it can role-play against that caller type.
                    Stored in this browser for this workflow only.
                </p>
            </div>
            <div className="max-h-[220px] min-h-[80px] overflow-y-auto rounded-md border border-border bg-muted/20 p-2 space-y-2">
                {messages.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">Messages appear here.</p>
                ) : (
                    messages.map((m, i) => (
                        <div
                            key={`${m.role}-${i}-${m.content.slice(0, 24)}`}
                            className={`text-xs whitespace-pre-wrap break-words rounded px-2 py-1.5 ${
                                m.role === 'user'
                                    ? 'bg-teal-500/15 text-foreground ml-4'
                                    : 'bg-muted/60 text-foreground mr-4'
                            }`}
                        >
                            <span className="font-medium text-[10px] uppercase text-muted-foreground block mb-0.5">
                                {m.role === 'user' ? 'You' : 'Agent'}
                            </span>
                            {m.content}
                        </div>
                    ))
                )}
                <div ref={bottomRef} />
            </div>
            <div className="flex flex-col gap-2">
                <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a test message…"
                    className="min-h-[72px] text-xs resize-y"
                    disabled={sending}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                        }
                    }}
                />
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="w-full gap-2"
                    disabled={sending || !draft.trim()}
                    onClick={() => void send()}
                >
                    {sending ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                            Sending…
                        </>
                    ) : (
                        <>
                            <Send className="h-4 w-4 shrink-0" aria-hidden />
                            Send
                        </>
                    )}
                </Button>
            </div>
        </section>
    );
}
