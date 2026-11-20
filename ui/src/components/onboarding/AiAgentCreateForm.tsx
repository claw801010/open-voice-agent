'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
    createWorkflowFromTemplateApiV1WorkflowCreateTemplatePost,
    createWorkflowRunApiV1WorkflowWorkflowIdRunsPost,
} from '@/client/sdk.gen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { WORKFLOW_RUN_MODES } from '@/constants/workflowRunModes';
import { useAuth } from '@/lib/auth';
import logger from '@/lib/logger';
import type { OnboardingPackChoice } from '@/lib/onboarding/gettingStarted';
import { getRandomId } from '@/lib/utils';

export type AiAgentCreatePrefill = {
    useCase?: string;
    activityDescription?: string;
    callType?: 'inbound' | 'outbound';
};

export type AiAgentCreateFormProps = {
    /** Compact layout for wizard embed */
    variant?: 'default' | 'compact';
    prefill?: AiAgentCreatePrefill;
    /** When user picks an onboarding pack, seed AI fields */
    fromPack?: OnboardingPackChoice | null;
    /** After workflow is created */
    onCreated?: (workflowId: number) => void;
    /** Start Web test immediately after create */
    autoWebTest?: boolean;
    className?: string;
};

function prefillFromPackChoice(pack: OnboardingPackChoice): AiAgentCreatePrefill {
    return {
        useCase: pack.displayName,
        activityDescription: `${pack.tagline} Answer FAQs, route to booking when ready, and keep responses short for voice.`,
        callType: 'inbound',
    };
}

export function AiAgentCreateForm({
    variant = 'default',
    prefill,
    fromPack = null,
    onCreated,
    autoWebTest = false,
    className,
}: AiAgentCreateFormProps) {
    const router = useRouter();
    const { user, getAccessToken } = useAuth();
    const packSeed = fromPack ? prefillFromPackChoice(fromPack) : {};
    const merged = { ...packSeed, ...prefill };

    const [callType, setCallType] = useState<'inbound' | 'outbound'>(merged.callType ?? 'inbound');
    const [useCase, setUseCase] = useState(merged.useCase ?? '');
    const [activityDescription, setActivityDescription] = useState(merged.activityDescription ?? '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (fromPack) {
            const seed = prefillFromPackChoice(fromPack);
            setUseCase(seed.useCase ?? '');
            setActivityDescription(seed.activityDescription ?? '');
        }
    }, [fromPack]);

    const createAgent = useCallback(async () => {
        if (!useCase.trim() || !activityDescription.trim()) {
            setError('Describe your use case and what the agent should do on calls.');
            return;
        }
        if (!user) {
            setError('Sign in to create an agent.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const token = await getAccessToken();
            const res = await createWorkflowFromTemplateApiV1WorkflowCreateTemplatePost({
                body: {
                    call_type: callType,
                    use_case: useCase.trim(),
                    activity_description: activityDescription.trim(),
                },
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const workflowId = res.data?.id;
            if (!workflowId) {
                setError('Create succeeded but no workflow id returned.');
                return;
            }
            if (autoWebTest) {
                const runRes = await createWorkflowRunApiV1WorkflowWorkflowIdRunsPost({
                    path: { workflow_id: workflowId },
                    body: {
                        mode: WORKFLOW_RUN_MODES.SMALL_WEBRTC,
                        name: `AI-${getRandomId()}`,
                    },
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                const runId = runRes.data?.id;
                if (runId) {
                    onCreated?.(workflowId);
                    router.push(`/workflow/${workflowId}/run/${runId}`);
                    return;
                }
            }
            onCreated?.(workflowId);
            if (onCreated) {
                return;
            }
            toast.success('Voice agent created');
            router.push(`/workflow/${workflowId}`);
        } catch (e) {
            logger.error(`AI agent create failed: ${e}`);
            setError('Could not create agent. Check model keys in Settings → Models.');
        } finally {
            setLoading(false);
        }
    }, [
        activityDescription,
        autoWebTest,
        callType,
        getAccessToken,
        onCreated,
        router,
        useCase,
        user,
    ]);

    const compact = variant === 'compact';

    return (
        <div className={className} data-testid="ai-agent-create-form">
            {!compact ? (
                <p className="text-sm text-muted-foreground mb-4">
                    Describe your agent in plain English — we generate the workflow graph, prompts, and sample
                    structure. Refine in the editor or publish when validation passes.
                </p>
            ) : null}
            <div className={compact ? 'space-y-3' : 'space-y-4'}>
                <div className="space-y-2">
                    <Label htmlFor="ai-call-type">Call type</Label>
                    <Select value={callType} onValueChange={(v) => setCallType(v as 'inbound' | 'outbound')}>
                        <SelectTrigger id="ai-call-type">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="inbound">Inbound (callers reach your agent)</SelectItem>
                            <SelectItem value="outbound">Outbound (agent calls users)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="ai-use-case">Use case</Label>
                    <Input
                        id="ai-use-case"
                        value={useCase}
                        onChange={(e) => setUseCase(e.target.value)}
                        placeholder="e.g. Salon booking, Handyman quotes, Coach intake"
                        data-testid="ai-create-use-case"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="ai-activity">What should the agent do?</Label>
                    <Textarea
                        id="ai-activity"
                        value={activityDescription}
                        onChange={(e) => setActivityDescription(e.target.value)}
                        placeholder="Describe the conversation goal — this becomes the agent prompt."
                        className={compact ? 'min-h-[80px]' : 'min-h-[100px]'}
                        data-testid="ai-create-activity"
                    />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button
                    type="button"
                    className={compact ? '' : 'w-full'}
                    disabled={loading || !useCase.trim() || !activityDescription.trim()}
                    data-testid="ai-create-submit"
                    onClick={() => void createAgent()}
                >
                    {loading ? 'Creating agent…' : compact ? 'Create with AI' : 'Create agent with AI'}
                </Button>
            </div>
        </div>
    );
}
