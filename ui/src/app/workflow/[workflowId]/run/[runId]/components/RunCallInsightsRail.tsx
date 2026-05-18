'use client';

import { useMemo, useState } from 'react';

import { CallLiveTracePanel } from '@/components/analytics/CallLiveTracePanel';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildLiveTraceFromFeedback } from '@/lib/callLiveTraceFromFeedback';
import { isLiveCallTraceEnabled, setLiveCallTraceEnabled } from '@/lib/callLiveTracePrefs';

import type { FeedbackMessage } from '../hooks/useWebSocketRTC';
import { RealtimeFeedback } from './RealtimeFeedback';

type Props = {
    messages: FeedbackMessage[];
    isCallActive: boolean;
    isCallCompleted: boolean;
};

export function RunCallInsightsRail({ messages, isCallActive, isCallCompleted }: Props) {
    const [traceOn, setTraceOn] = useState(isLiveCallTraceEnabled);
    const liveTrace = useMemo(() => buildLiveTraceFromFeedback(messages), [messages]);

    const toggleTrace = (on: boolean) => {
        setTraceOn(on);
        setLiveCallTraceEnabled(on);
    };

    return (
        <div className="flex h-full flex-col border-l border-border bg-background">
            <div className="flex items-center justify-end gap-2 border-b border-border px-3 py-2">
                <Switch
                    id="live-trace-toggle"
                    checked={traceOn}
                    onCheckedChange={toggleTrace}
                    aria-label="Enable technical trace"
                />
                <Label htmlFor="live-trace-toggle" className="text-xs text-muted-foreground">
                    Technical trace
                </Label>
            </div>

            <Tabs defaultValue="transcript" className="flex min-h-0 flex-1 flex-col">
                <TabsList className="mx-3 mt-2 grid w-auto grid-cols-2">
                    <TabsTrigger value="transcript" className="text-xs">
                        Transcript
                    </TabsTrigger>
                    <TabsTrigger value="trace" className="text-xs">
                        Tools & LLM
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="transcript" className="mt-0 min-h-0 flex-1 overflow-hidden">
                    <RealtimeFeedback
                        mode="live"
                        messages={messages}
                        isCallActive={isCallActive}
                        isCallCompleted={isCallCompleted}
                    />
                </TabsContent>
                <TabsContent value="trace" className="mt-0 min-h-0 flex-1 overflow-hidden">
                    {traceOn ? (
                        <CallLiveTracePanel liveTrace={liveTrace} compact className="h-full" />
                    ) : (
                        <p className="p-4 text-sm text-muted-foreground">
                            Turn on technical trace to see tool calls, HTTP send/receive, and LLM latency
                            during the call.
                        </p>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
