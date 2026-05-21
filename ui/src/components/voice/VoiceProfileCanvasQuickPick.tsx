"use client";

import { ExternalLink, Loader2, Mic } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { fetchVoiceProfiles, type VoiceProfile } from "@/lib/voiceProfiles";
import type { WorkflowConfigurations } from "@/types/workflow-configurations";

const ORG_DEFAULT = "__org_default__";

type Props = {
    workflowConfigurations: WorkflowConfigurations;
    workflowName: string;
    disabled?: boolean;
    onSave: (configurations: WorkflowConfigurations, workflowName: string) => Promise<void>;
};

function profileSummary(p: VoiceProfile): string {
    const s = p.speechSettings;
    const parts: string[] = [];
    parts.push(`${Math.round(s.authenticityLevel * 100)}% authentic`);
    if (s.enableProfessionalFillers) {
        parts.push(`fillers ${s.fillerIntensity}`);
    } else {
        parts.push("no fillers");
    }
    if (s.enableBreathPauses) parts.push("pauses");
    return parts.join(" · ");
}

export function VoiceProfileCanvasQuickPick({
    workflowConfigurations,
    workflowName,
    disabled = false,
    onSave,
}: Props) {
    const { getAccessToken } = useAuth();
    const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
    const [orgDefaultId, setOrgDefaultId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const storedId = workflowConfigurations.voice_profile_id;
    const selectValue = storedId ?? ORG_DEFAULT;

    useEffect(() => {
        void (async () => {
            setLoading(true);
            const list = await fetchVoiceProfiles(getAccessToken);
            setLoading(false);
            if (list) {
                setProfiles(list.profiles);
                setOrgDefaultId(list.defaultProfileId);
            }
        })();
    }, [getAccessToken]);

    const effectiveProfile = useMemo(() => {
        const id = selectValue === ORG_DEFAULT ? orgDefaultId : selectValue;
        return profiles.find((p) => p.id === id) ?? null;
    }, [selectValue, orgDefaultId, profiles]);

    const handleChange = useCallback(
        async (value: string) => {
            if (disabled) return;
            setSaving(true);
            try {
                const next: WorkflowConfigurations = { ...workflowConfigurations };
                if (value === ORG_DEFAULT) {
                    delete next.voice_profile_id;
                } else {
                    next.voice_profile_id = value;
                }
                await onSave(next, workflowName);
                toast.success("Voice profile updated");
            } catch {
                toast.error("Failed to save voice profile");
            } finally {
                setSaving(false);
            }
        },
        [disabled, onSave, workflowConfigurations, workflowName],
    );

    return (
        <div
            className="absolute top-3 left-3 z-10 flex max-w-[min(100%,22rem)] flex-col gap-1.5 rounded-lg border border-[#3a3a3a] bg-[#1a1a1a]/95 px-3 py-2 shadow-lg backdrop-blur-sm"
            data-testid="voice-profile-canvas-quick-pick"
        >
            <div className="flex items-center gap-2">
                <Mic className="h-3.5 w-3.5 shrink-0 text-teal-400" aria-hidden />
                <Label className="text-[11px] font-medium text-white/90">Voice profile</Label>
                {saving || loading ? (
                    <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-white/50" />
                ) : null}
            </div>
            <Select
                value={selectValue}
                onValueChange={(v) => void handleChange(v)}
                disabled={disabled || loading || saving}
            >
                <SelectTrigger className="h-8 border-[#3a3a3a] bg-[#252525] text-xs text-white">
                    <SelectValue placeholder="Org default" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-[#3a3a3a]">
                    <SelectItem value={ORG_DEFAULT} className="text-white focus:bg-[#2a2a2a]">
                        Org default
                        {orgDefaultId
                            ? ` (${profiles.find((p) => p.id === orgDefaultId)?.name ?? "preset"})`
                            : ""}
                    </SelectItem>
                    {profiles.map((p) => (
                        <SelectItem
                            key={p.id}
                            value={p.id}
                            className="text-white focus:bg-[#2a2a2a]"
                        >
                            {p.name}
                            {p.isBuiltin ? "" : " · custom"}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {effectiveProfile ? (
                <TooltipProvider delayDuration={300}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <p className="text-[10px] leading-snug text-white/65 line-clamp-2 cursor-default">
                                {profileSummary(effectiveProfile)}
                            </p>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs text-xs">
                            {effectiveProfile.description || "No description"}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ) : null}
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 justify-start px-0 text-[10px] text-teal-400 hover:text-teal-300 hover:bg-transparent"
                asChild
            >
                <Link href="/voice-profiles">
                    Manage profiles
                    <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
            </Button>
        </div>
    );
}
