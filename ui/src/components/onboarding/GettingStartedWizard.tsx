'use client';

import {
    BarChart3,
    CheckCircle2,
    Circle,
    Loader2,
    Mic,
    Package,
    Sparkles,
    X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { LocalInferenceSetupPanel } from '@/components/LocalInferenceSetupPanel';
import { AiAgentCreateForm } from '@/components/onboarding/AiAgentCreateForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserConfig } from '@/context/UserConfigContext';
import { useAuth } from '@/lib/auth';
import {
    applyInferenceProfile,
    fetchInferenceProfiles,
    type LocalInferenceCapabilities,
} from '@/lib/inferenceProfiles';
import {
    installOnboardingPack,
    startOnboardingWebTest,
} from '@/lib/onboarding/gettingStartedActions';
import {
    activeGettingStartedStep,
    buildGettingStartedProofHref,
    completedStepCount,
    dismissGettingStarted,
    GETTING_STARTED_STEP_LABELS,
    GETTING_STARTED_STEP_ORDER,
    installedWorkflowId,
    isStepDone,
    loadGettingStartedState,
    markStep,
    ONBOARDING_PACK_CHOICES,
    onboardingVariantForSlug,
    saveGettingStartedState,
    shouldShowGettingStartedWizard,
    type GettingStartedState,
} from '@/lib/onboarding/gettingStarted';
import { cn } from '@/lib/utils';

function StepIcon({ done, active }: { done: boolean; active: boolean }) {
    if (done) {
        return <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />;
    }
    return (
        <Circle
            className={cn(
                'h-5 w-5 shrink-0',
                active ? 'text-primary' : 'text-muted-foreground/50',
            )}
            aria-hidden
        />
    );
}

export function GettingStartedWizard() {
    const router = useRouter();
    const { getAccessToken, loading: authLoading, isAuthenticated } = useAuth();
    const { refreshConfig } = useUserConfig();
    const [state, setState] = useState<GettingStartedState | null>(null);
    const [capabilities, setCapabilities] = useState<LocalInferenceCapabilities | null>(null);
    const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
    const [defaultProfileId, setDefaultProfileId] = useState('local_edge_lean');
    const [profilesLoading, setProfilesLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);

    const persist = useCallback((next: GettingStartedState) => {
        setState(next);
        saveGettingStartedState(next);
    }, []);

    useEffect(() => {
        setState(loadGettingStartedState());
    }, []);

    const refreshProfiles = useCallback(async () => {
        setProfilesLoading(true);
        try {
            const data = await fetchInferenceProfiles(getAccessToken);
            setCapabilities(data.capabilities);
            setActiveProfileId(data.active_profile_id);
            setDefaultProfileId(data.default_profile_id);
            return data;
        } catch {
            return null;
        } finally {
            setProfilesLoading(false);
        }
    }, [getAccessToken]);

    useEffect(() => {
        if (authLoading || !isAuthenticated) return;
        void refreshProfiles();
    }, [authLoading, isAuthenticated, refreshProfiles]);

    // Auto-complete step 1 when local profile is already active or stack is ready.
    useEffect(() => {
        if (!state || isStepDone(state, 'local_models')) return;
        const localActive =
            activeProfileId === defaultProfileId || activeProfileId === 'local_edge_lean';
        const stackReady = capabilities?.local_stack_ready ?? false;
        if (localActive || stackReady) {
            persist(markStep(state, 'local_models', { status: 'done' }));
        }
    }, [state, activeProfileId, defaultProfileId, capabilities, persist]);

    if (!state || !shouldShowGettingStartedWizard(state)) {
        return null;
    }

    const activeStep = activeGettingStartedStep(state);
    const doneCount = completedStepCount(state);
    const wfId = installedWorkflowId(state);
    const packSlug = state.selectedPackSlug;
    const variantId = onboardingVariantForSlug(packSlug);

    const onDismiss = () => {
        persist(dismissGettingStarted(state));
    };

    const onApplyLocal = async () => {
        setBusy('apply-local');
        try {
            await applyInferenceProfile(defaultProfileId, getAccessToken);
            await refreshConfig();
            await refreshProfiles();
            persist(markStep(state, 'local_models', { status: 'done' }));
            toast.success('Local voice stack applied — no API keys required');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not apply local profile');
        } finally {
            setBusy(null);
        }
    };

    const onSkipLocal = () => {
        persist(markStep(state, 'local_models', { status: 'skipped' }));
        toast.message('You can add cloud API keys anytime under Configure models.');
    };

    const onAiCreated = (workflowId: number) => {
        const choice = ONBOARDING_PACK_CHOICES.find((p) => p.slug === packSlug) ?? ONBOARDING_PACK_CHOICES[0];
        let next = markStep(state, 'install_template', {
            status: 'done',
            workflowId,
            catalogSlug: choice.slug,
            variantId: onboardingVariantForSlug(choice.slug),
        });
        persist(next);
        toast.success('AI agent created — continue with Web test');
    };

    const onInstall = async () => {
        const choice = ONBOARDING_PACK_CHOICES.find((p) => p.slug === packSlug) ?? ONBOARDING_PACK_CHOICES[0];
        setBusy('install');
        try {
            const res = await installOnboardingPack(
                getAccessToken,
                choice.slug,
                `Getting started · ${choice.displayName}`,
            );
            if (!res.ok) {
                toast.error(res.error);
                return;
            }
            let next = { ...state, selectedPackSlug: res.catalogSlug };
            next = markStep(next, 'install_template', {
                status: 'done',
                workflowId: res.workflowId,
                catalogSlug: res.catalogSlug,
                variantId: res.variantId,
            });
            persist(next);
            toast.success(`Installed ${choice.displayName}`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Install failed');
        } finally {
            setBusy(null);
        }
    };

    const onWebTest = async () => {
        const id = wfId ?? state.steps.install_template.workflowId;
        if (!id) {
            toast.error('Install a template or create with AI first');
            return;
        }
        setBusy('web-test');
        try {
            const res = await startOnboardingWebTest(getAccessToken, id);
            if (!res.ok) {
                toast.error(res.error);
                return;
            }
            persist(
                markStep(state, 'web_test', {
                    status: 'done',
                    workflowId: res.workflowId,
                    runId: res.runId,
                }),
            );
            router.push(`/workflow/${res.workflowId}/run/${res.runId}`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Web test failed');
        } finally {
            setBusy(null);
        }
    };

    const onProveValue = () => {
        const slug = state.steps.install_template.catalogSlug ?? packSlug;
        persist(markStep(state, 'prove_value', { status: 'done' }));
        router.push(
            buildGettingStartedProofHref({
                workflowId: wfId,
                catalogSlug: slug,
                variantId: state.steps.install_template.variantId ?? variantId,
            }),
        );
    };

    const proofHref = buildGettingStartedProofHref({
        workflowId: wfId,
        catalogSlug: state.steps.install_template.catalogSlug ?? packSlug,
        variantId: state.steps.install_template.variantId ?? variantId,
    });

    return (
        <Card
            className="ovo-bento-cell border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-background shadow-sm"
            data-testid="getting-started-wizard"
        >
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                            <CardTitle className="text-lg">Get value in under 10 minutes</CardTitle>
                        </div>
                        <CardDescription className="max-w-2xl leading-relaxed">
                            Local voice models, a ready-made template, one Web test call, and analytics proof — no
                            external API keys required on day one.
                        </CardDescription>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8 text-muted-foreground"
                        aria-label="Dismiss getting started guide"
                        data-testid="getting-started-dismiss"
                        onClick={onDismiss}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex items-center gap-2 pt-2" aria-label="Progress">
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${(doneCount / GETTING_STARTED_STEP_ORDER.length) * 100}%` }}
                        />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {doneCount}/{GETTING_STARTED_STEP_ORDER.length}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Getting started steps">
                    {GETTING_STARTED_STEP_ORDER.map((stepId) => {
                        const done = isStepDone(state, stepId);
                        const active = stepId === activeStep;
                        return (
                            <li
                                key={stepId}
                                className={cn(
                                    'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
                                    active && 'border-primary/40 bg-primary/5',
                                    done && !active && 'border-emerald-500/25 bg-emerald-500/5',
                                    !active && !done && 'border-border/60 opacity-70',
                                )}
                                data-testid={`getting-started-step-${stepId}`}
                            >
                                <StepIcon done={done} active={active} />
                                <span className={cn('font-medium', active && 'text-foreground')}>
                                    {GETTING_STARTED_STEP_LABELS[stepId]}
                                </span>
                            </li>
                        );
                    })}
                </ol>

                {activeStep === 'local_models' ? (
                    <div className="space-y-4" data-testid="getting-started-panel-local">
                        <LocalInferenceSetupPanel
                            capabilities={capabilities}
                            onRefresh={refreshProfiles}
                            activeProfileId={activeProfileId}
                            defaultProfileId={defaultProfileId}
                        />
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                disabled={busy !== null || profilesLoading}
                                data-testid="getting-started-apply-local"
                                onClick={() => void onApplyLocal()}
                            >
                                {busy === 'apply-local' ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                ) : null}
                                Use local models
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busy !== null}
                                data-testid="getting-started-skip-local"
                                onClick={onSkipLocal}
                            >
                                I&apos;ll use cloud keys later
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/model-configurations">Configure models</Link>
                            </Button>
                        </div>
                    </div>
                ) : null}

                {activeStep === 'install_template' ? (
                    <div className="space-y-4" data-testid="getting-started-panel-install">
                        <p className="text-sm text-muted-foreground">
                            Pick a vertical — each ships with <strong className="font-medium text-foreground">local scheduling or CRM stubs</strong> so tools work without Salesforce or Calendly.
                        </p>
                        <ul className="grid gap-2 sm:grid-cols-3">
                            {ONBOARDING_PACK_CHOICES.map((pack) => {
                                const selected = packSlug === pack.slug;
                                return (
                                    <li key={pack.slug}>
                                        <button
                                            type="button"
                                            className={cn(
                                                'w-full text-left rounded-lg border p-3 transition-colors',
                                                selected
                                                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                                    : 'border-border/60 hover:border-border hover:bg-muted/30',
                                            )}
                                            data-testid={`getting-started-pack-${pack.slug}`}
                                            onClick={() =>
                                                persist({ ...state, selectedPackSlug: pack.slug })
                                            }
                                        >
                                            <div className="flex items-center gap-2">
                                                <Package className="h-4 w-4 text-primary shrink-0" aria-hidden />
                                                <span className="font-medium text-sm">{pack.displayName}</span>
                                                {pack.recommended ? (
                                                    <span className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300 font-semibold">
                                                        Recommended
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                                                {pack.tagline}
                                            </p>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                disabled={busy !== null}
                                data-testid="getting-started-install"
                                onClick={() => void onInstall()}
                            >
                                {busy === 'install' ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                ) : null}
                                Install template
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/workflow/catalog">Browse full catalog</Link>
                            </Button>
                        </div>
                        <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 space-y-3">
                            <p className="text-sm font-medium">Or create with AI</p>
                            <p className="text-xs text-muted-foreground">
                                Describe your business — we generate the workflow graph and prompts automatically.
                            </p>
                            <AiAgentCreateForm
                                variant="compact"
                                fromPack={
                                    ONBOARDING_PACK_CHOICES.find((p) => p.slug === packSlug) ?? null
                                }
                                onCreated={onAiCreated}
                            />
                        </div>
                    </div>
                ) : null}

                {activeStep === 'web_test' ? (
                    <div className="space-y-3" data-testid="getting-started-panel-web-test">
                        <p className="text-sm text-muted-foreground">
                            Start a <strong className="font-medium text-foreground">browser mic test</strong> — uses
                            LLM, STT, and TTS only. No PSTN charges and no phone number required.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                disabled={busy !== null || !wfId}
                                data-testid="getting-started-web-test"
                                onClick={() => void onWebTest()}
                            >
                                {busy === 'web-test' ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                ) : (
                                    <Mic className="h-4 w-4 mr-1.5" />
                                )}
                                Start Web test
                            </Button>
                            {wfId ? (
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={`/workflow/${wfId}`}>Open workflow editor</Link>
                                </Button>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {activeStep === 'prove_value' ? (
                    <div className="space-y-3" data-testid="getting-started-panel-prove">
                        <p className="text-sm text-muted-foreground">
                            After your test call, open <strong className="font-medium text-foreground">Analytics → Calls</strong> to
                            see the trace, HTTP tool spans, and quality signals — your Day-1 proof artifact.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                data-testid="getting-started-proof"
                                onClick={onProveValue}
                            >
                                <BarChart3 className="h-4 w-4 mr-1.5" />
                                Open call analytics
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={proofHref}>Preview filter link</Link>
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                data-testid="getting-started-finish"
                                onClick={() => persist(markStep(state, 'prove_value', { status: 'done' }))}
                            >
                                Mark complete
                            </Button>
                        </div>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}
