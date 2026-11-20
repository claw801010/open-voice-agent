'use client';

import { Cloud, Cpu, KeyRound, Layers } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { LocalInferenceSetupPanel } from '@/components/LocalInferenceSetupPanel';
import { Button } from '@/components/ui/button';
import { useUserConfig } from '@/context/UserConfigContext';
import {
    applyInferenceProfile,
    fetchInferenceProfiles,
    tierBadgeClass,
    type InferenceProfileSummary,
    type LocalInferenceCapabilities,
} from '@/lib/inferenceProfiles';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

function TierIcon({ tier }: { tier: InferenceProfileSummary['tier'] }) {
    if (tier === 'local') return <Cpu className="h-4 w-4 shrink-0" aria-hidden />;
    if (tier === 'hybrid') return <Layers className="h-4 w-4 shrink-0" aria-hidden />;
    return <Cloud className="h-4 w-4 shrink-0" aria-hidden />;
}

export function InferenceProfileQuickSwitch() {
    const { getAccessToken, loading: authLoading, isAuthenticated } = useAuth();
    const { refreshConfig } = useUserConfig();
    const [profiles, setProfiles] = useState<InferenceProfileSummary[]>([]);
    const [capabilities, setCapabilities] = useState<LocalInferenceCapabilities | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [defaultId, setDefaultId] = useState('local_edge_lean');
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchInferenceProfiles(getAccessToken);
            setProfiles(data.profiles);
            setActiveId(data.active_profile_id);
            setDefaultId(data.default_profile_id);
            setCapabilities(data.capabilities);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not load inference profiles');
        } finally {
            setLoading(false);
        }
    }, [getAccessToken]);

    useEffect(() => {
        if (authLoading || !isAuthenticated) {
            return;
        }
        void load();
    }, [load, authLoading, isAuthenticated]);

    const onApply = async (profileId: string) => {
        setApplying(profileId);
        try {
            const result = await applyInferenceProfile(profileId, getAccessToken);
            setActiveId(result.profile_id);
            await refreshConfig();
            toast.success(`Switched to ${result.label ?? profileId}`);
            for (const w of result.warnings) {
                toast.message(w, { duration: 8000 });
            }
            if (result.tier === 'cloud' || result.tier === 'hybrid') {
                toast.message('Add API keys in the service tabs below when you are ready for cloud models.', {
                    duration: 9000,
                });
            }
            await load();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to apply profile');
        } finally {
            setApplying(null);
        }
    };

    if ((loading || authLoading) && profiles.length === 0) {
        return (
            <p className="text-sm text-muted-foreground" data-testid="inference-profiles-loading">
                Loading inference profiles…
            </p>
        );
    }

    const localProfiles = profiles.filter((p) => p.tier === 'local' || p.tier === 'hybrid');
    const cloudProfiles = profiles.filter((p) => p.tier === 'cloud');

    return (
        <section
            className="ovo-glass-panel mb-8 space-y-5 p-4 sm:p-5"
            aria-label="Inference profile quick switch"
            data-testid="inference-profile-quick-switch"
        >
            <div>
                <h2 className="text-lg font-semibold tracking-tight">How your agent thinks & speaks</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    <strong className="font-medium text-foreground">Default:</strong> open-source models on your
                    machine — no signup or API keys. Switch to cloud when you want premium voices or larger models.
                </p>
            </div>

            <LocalInferenceSetupPanel
                capabilities={capabilities}
                onRefresh={load}
                activeProfileId={activeId}
                defaultProfileId={defaultId}
            />

            {localProfiles.length > 0 ? (
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        On-device (no API keys)
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {localProfiles.map((p) => (
                            <ProfileCard
                                key={p.id}
                                profile={p}
                                isActive={p.id === activeId}
                                applying={applying}
                                onApply={onApply}
                            />
                        ))}
                    </div>
                </div>
            ) : null}

            {cloudProfiles.length > 0 ? (
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5" />
                        Cloud (API keys in tabs below)
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-1">
                        {cloudProfiles.map((p) => (
                            <ProfileCard
                                key={p.id}
                                profile={p}
                                isActive={p.id === activeId}
                                applying={applying}
                                onApply={onApply}
                            />
                        ))}
                    </div>
                </div>
            ) : null}
        </section>
    );
}

function ProfileCard({
    profile: p,
    isActive,
    applying,
    onApply,
}: {
    profile: InferenceProfileSummary;
    isActive: boolean;
    applying: string | null;
    onApply: (id: string) => void;
}) {
    return (
        <div
            className={cn(
                'rounded-lg border p-3 flex flex-col gap-2',
                isActive ? 'border-primary/50 bg-primary/5' : 'border-border/80 bg-background/40',
            )}
            data-testid={`inference-profile-card-${p.id}`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <TierIcon tier={p.tier} />
                    <span className="font-medium text-sm truncate">{p.label}</span>
                </div>
                <span
                    className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        tierBadgeClass(p.tier),
                    )}
                >
                    {p.tier}
                </span>
            </div>
            <p className="text-xs text-muted-foreground leading-snug flex-1">{p.summary}</p>
            {p.requires_api_keys ? (
                <p className="text-[10px] text-muted-foreground">Requires API keys below</p>
            ) : (
                <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">No API keys required</p>
            )}
            <Button
                type="button"
                size="sm"
                variant={isActive ? 'secondary' : 'outline'}
                className="w-full"
                disabled={applying !== null || isActive}
                onClick={() => void onApply(p.id)}
                data-testid={`inference-profile-apply-${p.id}`}
            >
                {applying === p.id ? 'Applying…' : isActive ? 'Active' : 'Use profile'}
            </Button>
        </div>
    );
}
