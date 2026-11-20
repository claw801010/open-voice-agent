'use client';

import { CheckCircle2, Circle, Download, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useUserConfig } from '@/context/UserConfigContext';
import {
    componentStatusLabel,
    setupLocalInference,
    type LocalInferenceCapabilities,
} from '@/lib/inferenceProfiles';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

type Props = {
    capabilities: LocalInferenceCapabilities | null;
    onRefresh: () => Promise<void>;
    activeProfileId: string | null;
    defaultProfileId: string;
};

function StatusDot({ status }: { status: 'ready' | 'partial' | 'offline' }) {
    return (
        <span
            className={cn(
                'inline-block h-2.5 w-2.5 shrink-0 rounded-full',
                status === 'ready' && 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
                status === 'partial' && 'bg-amber-500',
                status === 'offline' && 'bg-muted-foreground/40',
            )}
            aria-hidden
        />
    );
}

export function LocalInferenceSetupPanel({
    capabilities,
    onRefresh,
    activeProfileId,
    defaultProfileId,
}: Props) {
    const { getAccessToken } = useAuth();
    const { refreshConfig } = useUserConfig();
    const [settingUp, setSettingUp] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const localReady = capabilities?.local_stack_ready ?? false;
    const showSetupCta =
        !localReady || activeProfileId === defaultProfileId || activeProfileId === null;

    const onSetup = useCallback(async () => {
        setSettingUp(true);
        try {
            const result = await setupLocalInference(getAccessToken);
            await refreshConfig();
            await onRefresh();
            const failed = result.steps.filter((s) => s.status === 'failed');
            if (failed.length) {
                toast.error(failed[0]?.message ?? 'Some setup steps failed');
            } else if (result.capabilities.local_stack_ready) {
                toast.success('Local models are ready — no API keys needed');
            } else {
                toast.message('Setup running — first Speaches use may download models', {
                    duration: 10000,
                });
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Setup failed');
        } finally {
            setSettingUp(false);
        }
    }, [getAccessToken, onRefresh, refreshConfig]);

    const onScan = async () => {
        setRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <div
            className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-4"
            data-testid="local-inference-setup-panel"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        <h3 className="font-semibold text-sm">Local models — works without API keys</h3>
                    </div>
                    <p className="text-xs text-muted-foreground max-w-prose leading-relaxed">
                        We scan Ollama and Speaches on your machine, download open-source weights when needed, and
                        configure STT, TTS, and LLM automatically. Cloud keys are optional — add them only when you
                        want higher-tier models.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={refreshing || settingUp}
                        onClick={() => void onScan()}
                        data-testid="local-inference-scan"
                    >
                        {refreshing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                        <span className="sr-only">Rescan</span>
                    </Button>
                    {showSetupCta ? (
                        <Button
                            type="button"
                            size="sm"
                            disabled={settingUp}
                            onClick={() => void onSetup()}
                            data-testid="local-inference-setup"
                        >
                            {settingUp ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                    Setting up…
                                </>
                            ) : (
                                <>
                                    <Download className="h-4 w-4 mr-1.5" />
                                    Set up local models
                                </>
                            )}
                        </Button>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 px-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Ready
                        </span>
                    )}
                </div>
            </div>

            {capabilities ? (
                <ul className="grid gap-2 sm:grid-cols-2" aria-label="Local runtime status">
                    {capabilities.components.map((c) => {
                        const status = componentStatusLabel(c);
                        return (
                            <li
                                key={c.id}
                                className="flex gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs"
                                data-testid={`local-component-${c.id}`}
                            >
                                <StatusDot status={status} />
                                <div className="min-w-0 space-y-0.5">
                                    <p className="font-medium">{c.label}</p>
                                    <p className="text-muted-foreground truncate">{c.endpoint}</p>
                                    {c.models_required.length > 0 ? (
                                        <p className="text-[10px] text-muted-foreground">
                                            {status === 'ready'
                                                ? 'Models OK'
                                                : `Needs: ${c.models_required.join(', ')}`}
                                        </p>
                                    ) : null}
                                    {status !== 'ready' && c.hint ? (
                                        <p className="text-[10px] text-muted-foreground">{c.hint}</p>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Circle className="h-3 w-3" />
                    Scanning local runtimes…
                </p>
            )}
        </div>
    );
}
