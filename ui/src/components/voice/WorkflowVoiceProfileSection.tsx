"use client";

import { AudioLines, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { fetchVoiceProfiles, type VoiceProfile } from "@/lib/voiceProfiles";
import type { WorkflowConfigurations } from "@/types/workflow-configurations";

const ORG_DEFAULT = "__org_default__";

type Props = {
    workflowConfigurations: WorkflowConfigurations;
    onSave: (configurations: WorkflowConfigurations, workflowName: string) => Promise<void>;
    workflowName: string;
};

export function WorkflowVoiceProfileSection({ workflowConfigurations, onSave, workflowName }: Props) {
    const { getAccessToken } = useAuth();
    const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
    const [orgDefaultId, setOrgDefaultId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [voiceProfileId, setVoiceProfileId] = useState(
        workflowConfigurations.voice_profile_id ?? ORG_DEFAULT,
    );

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

    useEffect(() => {
        setVoiceProfileId(workflowConfigurations.voice_profile_id ?? ORG_DEFAULT);
    }, [workflowConfigurations.voice_profile_id]);

    const selectedProfile = useMemo(() => {
        const id = voiceProfileId === ORG_DEFAULT ? orgDefaultId : voiceProfileId;
        return profiles.find((p) => p.id === id);
    }, [voiceProfileId, orgDefaultId, profiles]);

    const isDirty =
        (workflowConfigurations.voice_profile_id ?? ORG_DEFAULT) !== voiceProfileId;

    const handleSave = async () => {
        setSaving(true);
        try {
            const next: WorkflowConfigurations = { ...workflowConfigurations };
            if (voiceProfileId === ORG_DEFAULT) {
                delete next.voice_profile_id;
            } else {
                next.voice_profile_id = voiceProfileId;
            }
            await onSave(next, workflowName);
            toast.success("Voice profile saved");
        } catch {
            toast.error("Failed to save voice profile");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card id="voice-profile">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <AudioLines className="h-4 w-4" />
                    Voice delivery profile
                </CardTitle>
                <CardDescription>
                    Override org default for this agent. Controls authenticity, fillers, natural delivery, and TTS
                    tuning during live calls.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                    <>
                        <div className="space-y-2 max-w-md">
                            <Label>Profile</Label>
                            <Select value={voiceProfileId} onValueChange={setVoiceProfileId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Org default" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ORG_DEFAULT}>Use org default</SelectItem>
                                    {profiles.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name}
                                            {p.id === orgDefaultId ? " (org default)" : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedProfile && (
                            <p className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/40">
                                {selectedProfile.description}
                                <span className="block mt-1 text-xs">
                                    Tone: {selectedProfile.speechSettings.tone}; behavior:{' '}
                                    {selectedProfile.speechSettings.behavior}
                                    {selectedProfile.speechSettings.enableProfessionalFillers &&
                                        `; fillers: ${selectedProfile.speechSettings.fillerIntensity}`}
                                    {selectedProfile.speechSettings.enableExtendedFillers &&
                                        '; extended fillers on'}
                                    {selectedProfile.speechSettings.authenticityLayer?.enabled &&
                                        '; natural delivery on'}
                                </span>
                            </p>
                        )}
                    </>
                )}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2 border-t pt-6">
                <Button type="button" disabled={!isDirty || saving} onClick={() => void handleSave()}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save voice profile
                </Button>
                <Button type="button" variant="outline" asChild>
                    <Link href="/voice-profiles">
                        Manage profiles
                        <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
